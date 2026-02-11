import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { createRepCycleState, validateRep, recordDownPhase, recordUpPhase, recordOrientationSample, type ExerciseType, type SessionSuspicionTracker } from '@/lib/antiCheat';

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
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      case 'push-ups':
      case 'bench-press': {
        // Detect arm extension/flexion
        const leftElbow = pose[LEFT_ELBOW];
        const rightElbow = pose[RIGHT_ELBOW];
        const leftShoulder = pose[LEFT_SHOULDER];
        const rightShoulder = pose[RIGHT_SHOULDER];
        const leftWrist = pose[LEFT_WRIST];
        const rightWrist = pose[RIGHT_WRIST];
        
        if (!leftElbow || !rightElbow || !leftShoulder || !rightShoulder) break;
        
        // Calculate elbow angle (simplified)
        const avgElbowY = (leftElbow.y + rightElbow.y) / 2;
        const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2;
        const avgWristY = (leftWrist?.y + rightWrist?.y) / 2 || avgElbowY;
        
        // Down position: elbow below shoulder
        if (avgElbowY > avgShoulderY + 0.05) {
          currentPhase = 'down';
        } 
        // Up position: elbow at or above shoulder
        else if (avgElbowY <= avgShoulderY + 0.02) {
          currentPhase = 'up';
        }
        break;
      }
      
      case 'sit-ups': {
        // Detect torso angle relative to legs
        const shoulder = pose[LEFT_SHOULDER];
        const hip = pose[LEFT_HIP];
        const knee = pose[LEFT_KNEE];
        
        if (!shoulder || !hip || !knee) break;
        
        // Up: shoulder close to knee height
        // Down: shoulder far from knee
        const shoulderKneeDist = Math.abs(shoulder.y - knee.y);
        
        if (shoulderKneeDist < 0.15) {
          currentPhase = 'up';
        } else if (shoulderKneeDist > 0.25) {
          currentPhase = 'down';
        }
        break;
      }
      
      case 'jumps': {
        // Detect vertical movement
        const hip = pose[LEFT_HIP];
        const knee = pose[LEFT_KNEE];
        
        if (!hip || !knee) break;
        
        // Jump: hips high relative to screen
        // Ground: hips lower
        if (hip.y < 0.4) {
          currentPhase = 'up';
        } else if (hip.y > 0.55) {
          currentPhase = 'down';
        }
        break;
      }
      
      case 'pull-ups':
      case 'dips': {
        // Detect vertical body position
        const nose = pose[NOSE];
        const shoulder = pose[LEFT_SHOULDER];
        const elbow = pose[LEFT_ELBOW];
        
        if (!nose || !shoulder) break;
        
        // Up position: chin above certain threshold
        if (nose.y < 0.35) {
          currentPhase = 'up';
        } else if (nose.y > 0.5) {
          currentPhase = 'down';
        }
        break;
      }
      
      case 'plank': {
        // For plank, we track time instead of reps
        const shoulder = pose[LEFT_SHOULDER];
        const hip = pose[LEFT_HIP];
        
        if (!shoulder || !hip) {
          plankStartRef.current = null;
          return;
        }
        
        // Check if in plank position (body roughly horizontal)
        const isPlankPosition = Math.abs(shoulder.y - hip.y) < 0.15;
        
        if (isPlankPosition) {
          if (!plankStartRef.current) {
            plankStartRef.current = Date.now();
            lastPlankSecondRef.current = 0;
          } else {
            const elapsed = Math.floor((Date.now() - plankStartRef.current) / 1000);
            if (elapsed > lastPlankSecondRef.current) {
              lastPlankSecondRef.current = elapsed;
              onSecondComplete?.();
            }
          }
        } else {
          plankStartRef.current = null;
        }
        return; // Don't process phases for plank
      }
    }
    
    // Track phase transitions with anti-cheat validation
    if (currentPhase === 'down' && lastPhaseRef.current !== 'down') {
      recordDownPhase(repCycleStateRef.current, pose);
      // Record orientation sample for suspicion tracking
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
  }, [exercise, onRepComplete, onSecondComplete]);

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
        style={{ transform: 'scaleX(-1)' }} // Mirror for user
      />
    </div>
  );
}
