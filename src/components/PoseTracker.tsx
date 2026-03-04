import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { createRepCycleState, validateRep, recordDownPhase, recordUpPhase, recordOrientationSample, type ExerciseType, type SessionSuspicionTracker } from '@/lib/antiCheat';
import { createPushUpState, detectPushUp, checkUpperBodyVisibility } from '@/lib/pushUpDetector';
import {
  detectSquatPhase, detectLungePhase, detectPikePushUpPhase, detectDiamondPushUpPhase,
  detectCalfRaisePhase, detectBurpeePhase, detectMountainClimberPhase, detectHighKneePhase,
  detectJumpingJackPhase, detectJumpRopePhase, detectToeTouchPhase, detectCatCowPhase,
  isWallSitValid, isDeepSquatHoldValid, isShoulderStretchValid, isCobraStretchValid, isHipCircleValid,
  resetMountainClimberState, resetHighKneeState,
  detectBicepCurlPhase, detectHammerCurlPhase, detectShoulderPressPhase,
  detectLateralRaisePhase, detectFrontRaisePhase, detectBentOverRowPhase,
  detectGobletSquatPhase, detectThrusterPhase, detectChestPressPhase,
  detectTricepExtensionPhase, detectPunchPhase, detectRomanianDeadliftPhase,
  detectWindmillPhase, resetPunchState,
} from '@/lib/exerciseDetectors';
import {
  detectBenchPressPhaseSmoothed,
  detectFrontRaisePhaseSmoothed, detectGobletSquatPhaseSmoothed,
  detectHammerCurlPhaseSmoothed, detectLateralRaisePhaseSmoothed,
  getSmoothedFeedback, resetSmoothedDetector, SMOOTHED_EXERCISES,
} from '@/lib/smoothedDetectors';

interface PoseTrackerProps {
  exercise: ExerciseType;
  isActive: boolean;
  facingMode?: 'user' | 'environment';
  onRepComplete: () => void;
  onSecondComplete?: () => void;
  suspicionTracker?: SessionSuspicionTracker;
  onCameraReady?: () => void;
  onCameraError?: (message: string) => void;
}

type RepPhase = 'up' | 'down' | 'neutral';

// Timed hold exercises use the plank-style scoring pattern
const TIMED_HOLD_EXERCISES: ExerciseType[] = ['plank', 'wall-sit', 'hip-circles', 'shoulder-stretch-hold', 'deep-squat-hold', 'cobra-stretch'];

export function PoseTracker({ exercise, isActive, facingMode = 'user', onRepComplete, onSecondComplete, suspicionTracker, onCameraReady, onCameraError }: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number>();
  const lastPhaseRef = useRef<RepPhase>('neutral');
  const holdStartRef = useRef<number | null>(null);
  const lastHoldPointRef = useRef<number>(0);
  const repCycleStateRef = useRef(createRepCycleState());
  const pushUpStateRef = useRef(createPushUpState());
  const pushUpBodyVisibleRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const ML_INTERVAL_MS = 125; // ~8 FPS cap for pose detection
  
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibilityWarning, setVisibilityWarning] = useState<string | null>(null);
  const [exerciseFeedback, setExerciseFeedback] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  const isTimedHold = TIMED_HOLD_EXERCISES.includes(exercise);

  // Reset alternating-leg state when exercise changes
  useEffect(() => {
    resetMountainClimberState();
    resetHighKneeState();
    resetPunchState();
    resetSmoothedDetector(exercise);
    setExerciseFeedback(null);
  }, [exercise]);

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

  // Helper to fully stop any active stream
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  // Start/stop camera – only re-runs when isActive or facingMode actually changes
  useEffect(() => {
    if (!videoRef.current || isLoading) return;

    if (!isActive) {
      stopStream();
      return;
    }

    // Stop previous stream before starting new one
    stopStream();

    let cancelled = false;

    const startCamera = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (cancelled) {
          newStream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.onloadeddata = () => {
            if (!cancelled) onCameraReady?.();
          };
        }
      } catch (err) {
        console.error('Camera access denied:', err);
        if (!cancelled) {
          const msg = 'Camera permission is required to start this exercise.';
          setError(msg);
          onCameraError?.(msg);
        }
      }
    };

    startCamera();

    return () => {
      cancelled = true;
      stopStream();
    };
  }, [isLoading, isActive, facingMode, stopStream]);

  // Get phase for rep-based exercises using the new detectors
  const getPhaseForExercise = useCallback((pose: any[]): RepPhase => {
    switch (exercise) {
      case 'bench-press': return detectBenchPressPhaseSmoothed(pose);
      case 'squats': return detectSquatPhase(pose);
      case 'lunges': return detectLungePhase(pose);
      case 'pike-push-ups': return detectPikePushUpPhase(pose);
      case 'diamond-push-ups': return detectDiamondPushUpPhase(pose);
      case 'calf-raises': return detectCalfRaisePhase(pose);
      case 'burpees': return detectBurpeePhase(pose);
      case 'mountain-climbers': return detectMountainClimberPhase(pose);
      case 'high-knees': return detectHighKneePhase(pose);
      case 'jumping-jacks': return detectJumpingJackPhase(pose);
      case 'jump-rope': return detectJumpRopePhase(pose);
      case 'toe-touches': return detectToeTouchPhase(pose);
      case 'cat-cow-stretch': return detectCatCowPhase(pose);
      case 'dumbbell-bicep-curls': return detectBicepCurlPhase(pose);
      case 'dumbbell-hammer-curls': return detectHammerCurlPhaseSmoothed(pose);
      case 'dumbbell-shoulder-press': return detectShoulderPressPhase(pose);
      case 'dumbbell-lateral-raises': return detectLateralRaisePhaseSmoothed(pose);
      case 'dumbbell-front-raises': return detectFrontRaisePhaseSmoothed(pose);
      case 'dumbbell-bent-over-rows': return detectBentOverRowPhase(pose);
      case 'dumbbell-goblet-squat': return detectGobletSquatPhaseSmoothed(pose);
      case 'dumbbell-thrusters': return detectThrusterPhase(pose);
      case 'dumbbell-chest-press': return detectChestPressPhase(pose);
      case 'dumbbell-tricep-overhead-extension': return detectTricepExtensionPhase(pose);
      case 'dumbbell-punches': return detectPunchPhase(pose);
      case 'dumbbell-romanian-deadlift': return detectRomanianDeadliftPhase(pose); // now uses smoothed hip detector
      case 'dumbbell-windmill': return detectWindmillPhase(pose);
      default: return 'neutral';
    }
  }, [exercise]);

  // Check timed hold validity
  const isHoldValid = useCallback((pose: any[]): boolean => {
    switch (exercise) {
      case 'plank': {
        const shoulder = pose[11];
        const hip = pose[23];
        if (!shoulder || !hip) return false;
        return Math.abs(shoulder.y - hip.y) < 0.15;
      }
      case 'wall-sit': return isWallSitValid(pose);
      case 'deep-squat-hold': return isDeepSquatHoldValid(pose);
      case 'shoulder-stretch-hold': return isShoulderStretchValid(pose);
      case 'cobra-stretch': return isCobraStretchValid(pose);
      case 'hip-circles': return isHipCircleValid(pose);
      default: return false;
    }
  }, [exercise]);

  // Detect rep based on exercise type
  const detectRep = useCallback((landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;
    
    const pose = landmarks[0];
    
    // --- PUSH-UPS: dedicated detector ---
    if (exercise === 'push-ups') {
      const visMsg = checkUpperBodyVisibility(pose);
      if (visMsg) {
        if (!visibilityWarning) setVisibilityWarning(visMsg);
        pushUpBodyVisibleRef.current = false;
        return;
      }
      if (visibilityWarning) setVisibilityWarning(null);
      pushUpBodyVisibleRef.current = true;

      const { repCounted } = detectPushUp(pose, pushUpStateRef.current);
      if (repCounted) {
        if (suspicionTracker) {
          suspicionTracker.totalReps++;
          suspicionTracker.lpTimestamps.push({ time: Date.now(), lp: 1 });
          recordOrientationSample(suspicionTracker, pose);
        }
        onRepComplete();
      }
      return;
    }
    
    // --- TIMED HOLD EXERCISES ---
    if (isTimedHold) {
      const valid = isHoldValid(pose);
      if (valid) {
        if (!holdStartRef.current) {
          holdStartRef.current = Date.now();
          lastHoldPointRef.current = 0;
        } else {
          const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
          const pointsEarned = Math.floor(elapsed / 2);
          if (pointsEarned > lastHoldPointRef.current) {
            lastHoldPointRef.current = pointsEarned;
            onSecondComplete?.();
          }
        }
      } else {
        holdStartRef.current = null;
        lastHoldPointRef.current = 0;
      }
      return;
    }

    // --- LEGACY EXERCISES (sit-ups, jumps, dips, pull-ups, bench-press) ---
    let currentPhase: RepPhase = 'neutral';

    // Check new exercise detectors first
    const detectedPhase = getPhaseForExercise(pose);
    if (detectedPhase !== 'neutral') {
      currentPhase = detectedPhase;
    } else {
      // Fallback for original exercises
      const NOSE = 0;
      const LEFT_SHOULDER = 11;
      const RIGHT_SHOULDER = 12;
      const LEFT_ELBOW = 13;
      const RIGHT_ELBOW = 14;
      const LEFT_HIP = 23;
      const LEFT_KNEE = 25;
      
      switch (exercise) {
        case 'bench-press': {
          // Handled by smoothed detector in getPhaseForExercise
          break;
        }
        case 'sit-ups': {
          const shoulder = pose[LEFT_SHOULDER];
          const knee = pose[LEFT_KNEE];
          if (!shoulder || !knee) break;
          const shoulderKneeDist = Math.abs(shoulder.y - knee.y);
          if (shoulderKneeDist < 0.15) currentPhase = 'up';
          else if (shoulderKneeDist > 0.25) currentPhase = 'down';
          break;
        }
        case 'jumps': {
          const hip = pose[LEFT_HIP];
          if (!hip) break;
          if (hip.y < 0.4) currentPhase = 'up';
          else if (hip.y > 0.55) currentPhase = 'down';
          break;
        }
        case 'pull-ups':
        case 'dips': {
          const nose = pose[NOSE];
          if (!nose) break;
          if (nose.y < 0.35) currentPhase = 'up';
          else if (nose.y > 0.5) currentPhase = 'down';
          break;
        }
      }
    }
    
    // Track phase transitions with anti-cheat validation
    if (currentPhase === 'down' && lastPhaseRef.current !== 'down') {
      recordDownPhase(repCycleStateRef.current, pose);
      if (suspicionTracker) {
        recordOrientationSample(suspicionTracker, pose);
      }
    }
    
    if (lastPhaseRef.current === 'down' && currentPhase === 'up') {
      recordUpPhase(repCycleStateRef.current, pose);
      if (validateRep(exercise as ExerciseType, repCycleStateRef.current, pose, suspicionTracker)) {
        onRepComplete();
      }
    }
    
    if (currentPhase !== 'neutral') {
      lastPhaseRef.current = currentPhase;
    }

    // Update smoothed-detector feedback overlay
    if (SMOOTHED_EXERCISES.includes(exercise)) {
      const fb = getSmoothedFeedback(exercise);
      if (fb) {
        setExerciseFeedback(fb);
        if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = setTimeout(() => setExerciseFeedback(null), 1500);
      }
    }
  }, [exercise, onRepComplete, onSecondComplete, visibilityWarning, isTimedHold, isHoldValid, getPhaseForExercise, suspicionTracker]);

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

      // Always draw the camera feed for smooth preview
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      // Throttle ML inference to ~8 FPS
      const now = performance.now();
      if (now - lastProcessTimeRef.current >= ML_INTERVAL_MS) {
        lastProcessTimeRef.current = now;
        const results = poseLandmarkerRef.current.detectForVideo(video, now);
        if (results.landmarks && results.landmarks.length > 0) {
          detectRep(results.landmarks);
        }
      }

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
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }}
      />
      {visibilityWarning && exercise === 'push-ups' && (
        <div className="absolute bottom-0 inset-x-0 bg-destructive/90 text-destructive-foreground text-xs sm:text-sm text-center px-3 py-2">
          {visibilityWarning}
        </div>
      )}
      {exerciseFeedback && SMOOTHED_EXERCISES.includes(exercise) && (
        <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
          <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg ${
            exerciseFeedback === 'Rep Completed!'
              ? 'bg-green-500/90 text-white'
              : 'bg-primary/80 text-primary-foreground'
          }`}>
            {exerciseFeedback}
          </span>
        </div>
      )}
    </div>
  );
}
