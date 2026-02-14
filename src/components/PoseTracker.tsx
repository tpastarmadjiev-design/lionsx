import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { createRepCycleState, validateRep, recordDownPhase, recordUpPhase, recordOrientationSample, type ExerciseType, type SessionSuspicionTracker } from '@/lib/antiCheat';
import { createPushUpState, detectPushUp, checkUpperBodyVisibility } from '@/lib/pushUpDetector';

interface PoseTrackerProps {
  exercise: 'sit-ups' | 'push-ups' | 'jumps' | 'plank' | 'dips' | 'pull-ups' | 'bench-press';
  isActive: boolean;
  onRepComplete: () => void;
  onSecondComplete?: () => void;
  suspicionTracker?: SessionSuspicionTracker;
  onCameraReady?: () => void;
  onCameraError?: (message: string) => void;
}

type RepPhase = 'up' | 'down' | 'neutral';

export function PoseTracker({ exercise, isActive, onRepComplete, onSecondComplete, suspicionTracker, onCameraReady, onCameraError }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number>();
  const lastPhaseRef = useRef<RepPhase>('neutral');
  const plankStartRef = useRef<number | null>(null);
  const lastPlankSecondRef = useRef<number>(0);
  const repCycleStateRef = useRef(createRepCycleState());
  const pushUpStateRef = useRef(createPushUpState());
  const pushUpBodyVisibleRef = useRef(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibilityWarning, setVisibilityWarning] = useState<string | null>(null);

  // Initialize MediaPipe
  useEffect(() => {
    let isMounted = true;
    
    const initializePoseLandmarker = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        
        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numPoses: 1
        });
        
        if (isMounted) {
          poseLandmarkerRef.current = poseLandmarker;
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Failed to initialize pose landmarker:', err);
        if (isMounted) {
          setError('Failed to initialize pose detection. Please try again.');
          setIsLoading(false);
        }
      }
    };

    initializePoseLandmarker();
    
    return () => {
      isMounted = false;
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  // Start/stop camera based on isActive prop
  useEffect(() => {
    if (!videoRef.current || isLoading) return;
    
    let stream: MediaStream | null = null;
    
    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 }
        });
        
        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadeddata = () => {
            onCameraReady?.();
          };
        } else if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        const msg = 'Camera permission is required to start this exercise.';
        setError(msg);
        onCameraError?.(msg);
      }
    };

    if (isActive) {
      startCamera();
    } else {
      // Stop camera when not active
      if (videoRef.current?.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    }
    
    return () => {
      // Cleanup: always stop the camera
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (videoRef.current?.srcObject) {
        const currentStream = videoRef.current.srcObject as MediaStream;
        currentStream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [isLoading, isActive]);

  // Detect rep based on exercise type
  const detectRep = useCallback((landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;
    
    const pose = landmarks[0];
    
    // --- PUSH-UPS: dedicated detector with strong anti-cheat ---
    if (exercise === 'push-ups') {
      // Visibility gate: require upper body before tracking
      const visMsg = checkUpperBodyVisibility(pose);
      if (visMsg) {
        if (!visibilityWarning) setVisibilityWarning(visMsg);
        pushUpBodyVisibleRef.current = false;
        return;
      }
      if (visibilityWarning) setVisibilityWarning(null);
      pushUpBodyVisibleRef.current = true;

      const { repCounted, phase } = detectPushUp(pose, pushUpStateRef.current);
      if (repCounted) {
        // Also feed the generic suspicion tracker for admin monitoring
        if (suspicionTracker) {
          suspicionTracker.totalReps++;
          suspicionTracker.lpTimestamps.push({ time: Date.now(), lp: 1 });
          recordOrientationSample(suspicionTracker, pose);
        }
        onRepComplete();
      }
      return; // Skip generic logic
    }
    
    // Key landmarks indices
    const NOSE = 0;
    const LEFT_SHOULDER = 11;
    const RIGHT_SHOULDER = 12;
    const LEFT_ELBOW = 13;
    const RIGHT_ELBOW = 14;
    const LEFT_WRIST = 15;
    const RIGHT_WRIST = 16;
    const LEFT_HIP = 23;
    const RIGHT_HIP = 24;
    const LEFT_KNEE = 25;
    const RIGHT_KNEE = 26;
    
    let currentPhase: RepPhase = 'neutral';
    
    switch (exercise) {
      case 'bench-press': {
        // Detect arm extension/flexion
        const leftElbow = pose[LEFT_ELBOW];
        const rightElbow = pose[RIGHT_ELBOW];
        const leftShoulder = pose[LEFT_SHOULDER];
        const rightShoulder = pose[RIGHT_SHOULDER];
        const leftWrist = pose[LEFT_WRIST];
        const rightWrist = pose[RIGHT_WRIST];
        
        if (!leftElbow || !rightElbow || !leftShoulder || !rightShoulder) break;
        
        const avgElbowY = (leftElbow.y + rightElbow.y) / 2;
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        
        if (avgElbowY > avgShoulderY + 0.05) {
          currentPhase = 'down';
        } 
        else if (avgElbowY <= avgShoulderY + 0.02) {
          currentPhase = 'up';
        }
        break;
      }
      
      case 'sit-ups': {
        const shoulder = pose[LEFT_SHOULDER];
        const hip = pose[LEFT_HIP];
        const knee = pose[LEFT_KNEE];
        
        if (!shoulder || !hip || !knee) break;
        
        const shoulderKneeDist = Math.abs(shoulder.y - knee.y);
        
        if (shoulderKneeDist < 0.15) {
          currentPhase = 'up';
        } else if (shoulderKneeDist > 0.25) {
          currentPhase = 'down';
        }
        break;
      }
      
      case 'jumps': {
        const hip = pose[LEFT_HIP];
        const knee = pose[LEFT_KNEE];
        
        if (!hip || !knee) break;
        
        if (hip.y < 0.4) {
          currentPhase = 'up';
        } else if (hip.y > 0.55) {
          currentPhase = 'down';
        }
        break;
      }
      
      case 'pull-ups':
      case 'dips': {
        const nose = pose[NOSE];
        const shoulder = pose[LEFT_SHOULDER];
        
        if (!nose || !shoulder) break;
        
        if (nose.y < 0.35) {
          currentPhase = 'up';
        } else if (nose.y > 0.5) {
          currentPhase = 'down';
        }
        break;
      }
      
      case 'plank': {
        const shoulder = pose[LEFT_SHOULDER];
        const hip = pose[LEFT_HIP];
        
        if (!shoulder || !hip) {
          // Lost tracking — pause scoring
          plankStartRef.current = null;
          return;
        }
        
        const isPlankPosition = Math.abs(shoulder.y - hip.y) < 0.15;
        
        if (isPlankPosition) {
          if (!plankStartRef.current) {
            plankStartRef.current = Date.now();
            lastPlankSecondRef.current = 0;
          } else {
            const elapsed = Math.floor((Date.now() - plankStartRef.current) / 1000);
            // Award 1 point every 2 seconds of continuous valid hold
            const pointsEarned = Math.floor(elapsed / 2);
            if (pointsEarned > lastPlankSecondRef.current) {
              lastPlankSecondRef.current = pointsEarned;
              onSecondComplete?.();
            }
          }
        } else {
          // Form broken — reset timer, no points until form restored
          plankStartRef.current = null;
          lastPlankSecondRef.current = 0;
        }
        return;
      }
    }
    
    // Track phase transitions with anti-cheat validation
    if (currentPhase === 'down' && lastPhaseRef.current !== 'down') {
      recordDownPhase(repCycleStateRef.current, pose);
      if (suspicionTracker) {
        recordOrientationSample(suspicionTracker, pose);
      }
    }
    
    // Count rep on phase transition (down -> up) with validation
    if (lastPhaseRef.current === 'down' && currentPhase === 'up') {
      recordUpPhase(repCycleStateRef.current, pose);
      if (validateRep(exercise as ExerciseType, repCycleStateRef.current, pose, suspicionTracker)) {
        onRepComplete();
      }
    }
    
    if (currentPhase !== 'neutral') {
      lastPhaseRef.current = currentPhase;
    }
  }, [exercise, onRepComplete, onSecondComplete, visibilityWarning]);

  // Pose detection loop
  useEffect(() => {
    if (!isActive || isLoading || !videoRef.current || !canvasRef.current || !poseLandmarkerRef.current) {
      return;
    }
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    let lastVideoTime = -1;
    
    const detectPose = () => {
      if (!poseLandmarkerRef.current || video.currentTime === lastVideoTime) {
        animationFrameRef.current = requestAnimationFrame(detectPose);
        return;
      }
      
      lastVideoTime = video.currentTime;
      
      const results = poseLandmarkerRef.current.detectForVideo(video, performance.now());
      
      // Draw clean video feed only (no landmarks)
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Track reps in background without drawing
      if (results.landmarks && results.landmarks.length > 0) {
        detectRep(results.landmarks);
      }
      
      ctx.restore();
      animationFrameRef.current = requestAnimationFrame(detectPose);
    };
    
    if (video.readyState >= 2) {
      detectPose();
    } else {
      video.addEventListener('loadeddata', detectPose);
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isActive, isLoading, detectRep]);

  if (error) {
    return (
      <div className="w-full aspect-[4/3] bg-secondary rounded-xl flex items-center justify-center">
        <p className="text-destructive text-center px-4">{error}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="w-full aspect-[4/3] bg-secondary rounded-xl flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-muted-foreground text-sm">Loading pose detection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-secondary rounded-xl overflow-hidden">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="absolute inset-0 w-full h-full object-cover opacity-0"
      />
      <canvas
        ref={canvasRef}
        width={640}
        height={480}
        className="w-full h-full object-cover"
        style={{ transform: 'scaleX(-1)' }}
      />
      {/* Push-up upper body visibility warning */}
      {visibilityWarning && exercise === 'push-ups' && (
        <div className="absolute bottom-0 inset-x-0 bg-destructive/90 text-destructive-foreground text-xs sm:text-sm text-center px-3 py-2">
          {visibilityWarning}
        </div>
      )}
    </div>
  );
}
