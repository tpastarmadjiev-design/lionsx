import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import { createRepCycleState, validateRep, recordDownPhase, recordUpPhase, recordOrientationSample, type ExerciseType, type SessionSuspicionTracker } from '@/lib/antiCheat';
import { getFeedback } from '@/lib/exerciseFeedbackMap';
import { createPushUpState, detectPushUp, checkUpperBodyVisibility } from '@/lib/pushUpDetector';
import { checkPositioning, type PositioningResult } from '@/lib/positioningCheck';
import { createAdaptiveState, updateAdaptive, shouldCountRep, getAdaptiveMessage, isCalibrating, type AdaptiveState } from '@/lib/adaptiveThreshold';
import { createMotionConfidenceState, updateMotionConfidence, isMotionConfident, type MotionConfidenceState } from '@/lib/motionConfidence';
import { createGhostRepState, updateGhostRepState, shouldAllowRep, onRepCounted, getGhostRepMessage, clearResumeMessage, type GhostRepState } from '@/lib/ghostRepPrevention';
import {
  detectSquatPhase, detectLungePhase, detectPikePushUpPhase, detectDiamondPushUpPhase,
  detectCalfRaisePhase, detectBurpeePhase, detectMountainClimberPhase, detectHighKneePhase,
  detectJumpingJackPhase, detectJumpRopePhase, detectToeTouchPhase, detectCatCowPhase,
  isWallSitValid, isDeepSquatHoldValid, isShoulderStretchValid, isCobraStretchValid, isHipCircleValid,
  resetMountainClimberState, resetHighKneeState,
  detectBicepCurlPhase, detectHammerCurlPhase, detectShoulderPressPhase,
  detectLateralRaisePhase, detectFrontRaisePhase, detectBentOverRowPhase,
  detectGobletSquatPhase, detectChestPressPhase,
  detectRomanianDeadliftPhase,
  detectWindmillPhase,
} from '@/lib/exerciseDetectors';
import {
  detectBenchPressPhaseSmoothed,
  detectFrontRaisePhaseSmoothed, detectGobletSquatPhaseSmoothed,
  detectHammerCurlPhaseSmoothed, detectLateralRaisePhaseSmoothed,
  detectPunchPhaseSmoothed, detectThrusterPhaseSmoothed, detectTricepExtPhaseSmoothed,
  detectPushUpPhaseSmoothed, detectPikePushUpPhaseSmoothed,
  detectSquatPhaseSmoothed, detectLungePhaseSmoothed, detectCalfRaisePhaseSmoothed,
  detectBurpeePhaseSmoothed, detectMountainClimberPhaseSmoothed,
  detectJumpingJackPhaseSmoothed, detectHighKneePhaseSmoothed, detectJumpRopePhaseSmoothed,
  detectJumpPhaseSmoothed, detectSitUpPhaseSmoothed, detectCatCowPhaseSmoothed,
  detectToeTouchPhaseSmoothed, detectDiamondPushUpPhaseSmoothed,
  detectCobraPhaseSmoothed, detectHipCirclePhaseSmoothed,
  isPlankValidSmoothed, isWallSitValidSmoothed, isDeepSquatHoldValidSmoothed, isShoulderStretchValidSmoothed,
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
const TIMED_HOLD_EXERCISES: ExerciseType[] = ['plank', 'wall-sit', 'shoulder-stretch-hold', 'deep-squat-hold'];

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
  
  // Positioning check state
  const [positioningReady, setPositioningReady] = useState(false);
  const positioningReadyRef = useRef(false);
  const [positioningResult, setPositioningResult] = useState<PositioningResult | null>(null);
  
  // Adaptive threshold state
  const adaptiveStateRef = useRef<AdaptiveState>(createAdaptiveState(exercise));
  const [adaptiveMessage, setAdaptiveMessage] = useState<string | null>('Learning your movement...');
  
  // Motion confidence state
  const motionConfidenceRef = useRef<MotionConfidenceState>(createMotionConfidenceState(exercise));
  
  // Ghost rep prevention state
  const ghostRepRef = useRef<GhostRepState>(createGhostRepState());
  const [ghostRepMessage, setGhostRepMessage] = useState<string | null>(null);
  const ghostRepMessageTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
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
    resetSmoothedDetector('dumbbell-punches');
    resetSmoothedDetector(exercise);
    setExerciseFeedback(null);
    setPositioningReady(false);
    positioningReadyRef.current = false;
    setPositioningResult(null);
    adaptiveStateRef.current = createAdaptiveState(exercise);
    setAdaptiveMessage('Learning your movement...');
    motionConfidenceRef.current = createMotionConfidenceState(exercise);
    ghostRepRef.current = createGhostRepState();
    setGhostRepMessage(null);
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
      case 'push-ups': return detectPushUpPhaseSmoothed(pose);
      case 'pike-push-ups': return detectPikePushUpPhaseSmoothed(pose);
      case 'squats': return detectSquatPhaseSmoothed(pose);
      case 'lunges': return detectLungePhaseSmoothed(pose);
      case 'calf-raises': return detectCalfRaisePhaseSmoothed(pose);
      case 'bench-press': return detectBenchPressPhaseSmoothed(pose);
      case 'diamond-push-ups': return detectDiamondPushUpPhaseSmoothed(pose);
      case 'burpees': return detectBurpeePhaseSmoothed(pose);
      case 'mountain-climbers': return detectMountainClimberPhaseSmoothed(pose);
      case 'high-knees': return detectHighKneePhaseSmoothed(pose);
      case 'jumping-jacks': return detectJumpingJackPhaseSmoothed(pose);
      case 'jump-rope': return detectJumpRopePhaseSmoothed(pose);
      case 'toe-touches': return detectToeTouchPhaseSmoothed(pose);
      case 'cat-cow-stretch': return detectCatCowPhaseSmoothed(pose);
      case 'jumps': return detectJumpPhaseSmoothed(pose);
      case 'sit-ups': return detectSitUpPhaseSmoothed(pose);
      case 'cobra-stretch': return detectCobraPhaseSmoothed(pose);
      case 'hip-circles': return detectHipCirclePhaseSmoothed(pose);
      case 'dumbbell-bicep-curls': return detectBicepCurlPhase(pose);
      case 'dumbbell-hammer-curls': return detectHammerCurlPhaseSmoothed(pose);
      case 'dumbbell-shoulder-press': return detectShoulderPressPhase(pose);
      case 'dumbbell-lateral-raises': return detectLateralRaisePhaseSmoothed(pose);
      case 'dumbbell-front-raises': return detectFrontRaisePhaseSmoothed(pose);
      case 'dumbbell-bent-over-rows': return detectBentOverRowPhase(pose);
      case 'dumbbell-goblet-squat': return detectGobletSquatPhaseSmoothed(pose);
      case 'dumbbell-thrusters': return detectThrusterPhaseSmoothed(pose);
      case 'dumbbell-chest-press': return detectChestPressPhase(pose);
      case 'dumbbell-tricep-overhead-extension': return detectTricepExtPhaseSmoothed(pose);
      case 'dumbbell-punches': return detectPunchPhaseSmoothed(pose);
      case 'dumbbell-romanian-deadlift': return detectRomanianDeadliftPhase(pose);
      case 'dumbbell-windmill': return detectWindmillPhase(pose);
      default: return 'neutral';
    }
  }, [exercise]);

  // Check timed hold validity
  const isHoldValid = useCallback((pose: any[]): boolean => {
    switch (exercise) {
      case 'plank': return isPlankValidSmoothed(pose);
      case 'wall-sit': return isWallSitValidSmoothed(pose);
      case 'deep-squat-hold': return isDeepSquatHoldValidSmoothed(pose);
      case 'shoulder-stretch-hold': return isShoulderStretchValidSmoothed(pose);
      default: return false;
    }
  }, [exercise]);

  // Detect rep based on exercise type
  const detectRep = useCallback((landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;
    
    const pose = landmarks[0];
    
    // ── POSITIONING CHECK ──
    // Must pass before any rep counting begins
    if (!positioningReadyRef.current) {
      const result = checkPositioning(pose);
      setPositioningResult(result);
      if (result.isReady) {
        positioningReadyRef.current = true;
        setPositioningReady(true);
      }
      return; // Don't count anything until positioned
    }

    // ── MOTION CONFIDENCE: update every frame ──
    updateMotionConfidence(motionConfidenceRef.current, exercise, pose);

    // ── GHOST REP PREVENTION: update idle detection every frame ──
    updateGhostRepState(ghostRepRef.current, pose);
    
    // Update ghost rep UI message
    const grMsg = getGhostRepMessage(ghostRepRef.current);
    if (grMsg !== ghostRepMessage) {
      setGhostRepMessage(grMsg);
      if (grMsg === 'Go!') {
        if (ghostRepMessageTimeoutRef.current) clearTimeout(ghostRepMessageTimeoutRef.current);
        ghostRepMessageTimeoutRef.current = setTimeout(() => {
          clearResumeMessage(ghostRepRef.current);
          setGhostRepMessage(null);
        }, 1000);
      }
    }

    // ── ADAPTIVE THRESHOLD: feed data ──
    const prePhase = getPhaseForExercise(pose);
    updateAdaptive(adaptiveStateRef.current, pose, prePhase);
    
    // Update adaptive message
    const msg = getAdaptiveMessage(adaptiveStateRef.current);
    if (msg !== null) {
      setAdaptiveMessage(msg);
    } else if (adaptiveStateRef.current.calibrated) {
      setAdaptiveMessage(null);
    }
    
    // --- TIMED HOLD EXERCISES ---
    if (isTimedHold) {
      const valid = isHoldValid(pose);
      if (valid) {
        if (!holdStartRef.current) {
          holdStartRef.current = Date.now();
          lastHoldPointRef.current = 0;
          setExerciseFeedback(getFeedback(exercise, 'HOLD'));
        } else {
          const elapsed = Math.floor((Date.now() - holdStartRef.current) / 1000);
          const pointsEarned = Math.floor(elapsed / 2);
          if (pointsEarned > lastHoldPointRef.current) {
            lastHoldPointRef.current = pointsEarned;
            onSecondComplete?.();
            setExerciseFeedback(getFeedback(exercise, 'GOOD'));
            if (feedbackTimeoutRef.current) clearTimeout(feedbackTimeoutRef.current);
            feedbackTimeoutRef.current = setTimeout(() => setExerciseFeedback(getFeedback(exercise, 'HOLD')), 1500);
          }
        }
      } else {
        holdStartRef.current = null;
        lastHoldPointRef.current = 0;
        setExerciseFeedback(null);
      }
      return;
    }

    // --- REP-BASED EXERCISES ---
    let currentPhase: RepPhase = 'neutral';

    // ── MOTION CONFIDENCE: gate phase detection ──
    if (isMotionConfident(motionConfidenceRef.current)) {
      const detectedPhase = getPhaseForExercise(pose);
      if (detectedPhase !== 'neutral') {
        currentPhase = detectedPhase;
      } else {
        const NOSE = 0;
        switch (exercise) {
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
        // ── ADAPTIVE THRESHOLD: filter tiny movements ──
        if (shouldCountRep(adaptiveStateRef.current, pose)) {
          // ── GHOST REP PREVENTION: check idle + cooldown + micro-movement ──
          if (shouldAllowRep(ghostRepRef.current, adaptiveStateRef.current.calibratedRange)) {
            onRepComplete();
            onRepCounted(ghostRepRef.current);
          }
        }
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
  }, [exercise, onRepComplete, onSecondComplete, visibilityWarning, isTimedHold, isHoldValid, getPhaseForExercise, suspicionTracker, ghostRepMessage]);

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

      {/* Positioning Check Indicator */}
      {!positioningReady && positioningResult && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className={`px-6 py-4 rounded-2xl backdrop-blur-sm flex flex-col items-center gap-2 ${
            positioningResult.isReady
              ? 'bg-green-500/20 border border-green-500/40'
              : 'bg-destructive/20 border border-destructive/40'
          }`}>
            <div className={`w-4 h-4 rounded-full ${
              positioningResult.isReady ? 'bg-green-500' : 'bg-destructive'
            }`} />
            <p className={`text-sm font-semibold ${
              positioningResult.isReady ? 'text-green-400' : 'text-destructive'
            }`}>
              {positioningResult.message}
            </p>
            <p className="text-xs text-muted-foreground">
              {positioningResult.visibleCount}/{positioningResult.requiredCount} landmarks visible
            </p>
          </div>
        </div>
      )}

      {/* Positioning not yet checked - waiting for first frame */}
      {!positioningReady && !positioningResult && isActive && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
          <div className="px-6 py-4 rounded-2xl backdrop-blur-sm bg-secondary/60 border border-border flex flex-col items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-muted-foreground animate-pulse" />
            <p className="text-sm font-semibold text-muted-foreground">
              Checking position...
            </p>
          </div>
        </div>
      )}

      {/* Adaptive Threshold Calibration Message */}
      {positioningReady && adaptiveMessage && (
        <div className="absolute top-12 inset-x-0 flex justify-center pointer-events-none z-10">
          <span className="px-4 py-2 rounded-full text-xs font-semibold shadow-lg bg-accent/80 text-accent-foreground">
            {adaptiveMessage}
          </span>
        </div>
      )}

      {/* Ghost Rep Prevention: Idle / Resume Message */}
      {positioningReady && ghostRepMessage && (
        <div className="absolute bottom-12 inset-x-0 flex justify-center pointer-events-none z-10">
          <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg ${
            ghostRepMessage === 'Go!'
              ? 'bg-green-500/90 text-white'
              : 'bg-amber-500/90 text-white'
          }`}>
            {ghostRepMessage}
          </span>
        </div>
      )}

      {visibilityWarning && exercise === 'push-ups' && (
        <div className="absolute bottom-0 inset-x-0 bg-destructive/90 text-destructive-foreground text-xs sm:text-sm text-center px-3 py-2">
          {visibilityWarning}
        </div>
      )}
      {exerciseFeedback && (SMOOTHED_EXERCISES.includes(exercise) || isTimedHold) && (
        <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-none">
          <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-lg ${
            exerciseFeedback === 'Rep Completed!' || exerciseFeedback === getFeedback(exercise, 'GOOD')
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
