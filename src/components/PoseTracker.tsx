import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';
import type { ExerciseType, SessionSuspicionTracker } from '@/lib/antiCheat';
import { recordRep } from '@/lib/antiCheat';
import {
  detectSquatPhase, detectLungePhase, detectPushUpPhase,
  detectPikePushUpPhase, detectDiamondPushUpPhase, detectSitUpPhase,
  detectJumpPhase, detectDipPhase, detectPullUpPhase,
  detectCalfRaisePhase, detectBurpeePhase,
  detectMountainClimberPhase, detectHighKneePhase,
  detectJumpingJackPhase, detectJumpRopePhase,
  detectToeTouchPhase, detectCatCowPhase,
  detectBenchPressPhase, detectChestPressPhase,
  detectBicepCurlPhase, detectHammerCurlPhase,
  detectShoulderPressPhase, detectLateralRaisePhase,
  detectFrontRaisePhase, detectBentOverRowPhase,
  detectGobletSquatPhase, detectThrusterPhase,
  detectTricepExtensionPhase, detectPunchPhase,
  detectRomanianDeadliftPhase, detectWindmillPhase,
  detectLatPulldownPhase, detectSeatedCableRowPhase,
  isPlankValid, isWallSitValid, isDeepSquatHoldValid,
  isShoulderStretchValid, isCobraStretchValid, isHipCircleValid,
  resetMountainClimberState, resetHighKneeState, resetPunchState,
  resetCalfRaiseState, resetHipCircleState,
  type Phase,
} from '@/lib/exerciseDetectors';

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

// ─── TOGGLES ───
const CAMERA_STABILITY_ENABLED = true;
const CAMERA_SHAKE_THRESHOLD = 0.06;
const VISIBILITY_CHECK_ENABLED = true;
const GRACE_PERIOD_MS = 2000; // ignore first 2 seconds

// ─── PER-EXERCISE MINIMUM VISIBLE LANDMARKS ───
// Each exercise needs specific body parts visible to count reps.
// If fewer landmarks are visible than required, the frame is SKIPPED.
// 
// Landmarks reference:
// 0=nose, 11-12=shoulders, 13-14=elbows, 15-16=wrists
// 23-24=hips, 25-26=knees, 27-28=ankles
//
// "Visible" = landmark exists AND visibility > 0.3
//
// Logic per exercise:
// - Full body (squats, lunges, jumps, etc): need shoulders + hips + knees = ~10+
// - Upper body (push-ups, curls, press): need shoulders + elbows + wrists = ~6+
// - Seated/machine (lat pulldown, cable row): need shoulders + elbows = ~4+
// - Timed holds (plank, cobra): need shoulders + hips = ~4+
// - Face-only visible = 2-3 landmarks → ALWAYS skip

const MIN_LANDMARKS: Record<string, number> = {
  // Full body exercises — need to see torso + legs
  'squats': 10,
  'lunges': 10,
  'jumps': 8,
  'burpees': 8,
  'mountain-climbers': 8,
  'high-knees': 10,
  'jumping-jacks': 12,
  'jump-rope': 8,
  'calf-raises': 8,
  'dumbbell-goblet-squat': 10,
  'dumbbell-thrusters': 10,
  'dumbbell-windmill': 10,
  'toe-touches': 8,
  'dumbbell-romanian-deadlift': 8,

  // Upper body — need shoulders + arms visible
  'push-ups': 6,
  'pike-push-ups': 6,
  'diamond-push-ups': 6,
  'sit-ups': 6,
  'dips': 6,
  'pull-ups': 6,
  'bench-press': 5,
  'dumbbell-chest-press': 5,
  'dumbbell-bicep-curls': 5,
  'dumbbell-hammer-curls': 5,
  'dumbbell-shoulder-press': 5,
  'dumbbell-lateral-raises': 6,
  'dumbbell-front-raises': 6,
  'dumbbell-bent-over-rows': 5,
  'dumbbell-tricep-overhead-extension': 5,
  'dumbbell-punches': 5,
  'cat-cow-stretch': 5,

  // Seated/machine exercises
  'lat-pulldown': 4,
  'seated-cable-row': 4,

  // Timed holds — more relaxed
  'plank': 4,
  'wall-sit': 6,
  'deep-squat-hold': 8,
  'cobra-stretch': 4,
  'hip-circles': 8,
  'shoulder-stretch-hold': 4,
};

const TIMED_HOLD_EXERCISES: ExerciseType[] = [
  'plank', 'wall-sit', 'hip-circles', 'shoulder-stretch-hold', 'deep-squat-hold', 'cobra-stretch'
];

const HOLD_SECONDS_PER_POINT = 1.5;

/** Count how many landmarks have good visibility */
function countVisibleLandmarks(pose: any[]): number {
  let count = 0;
  for (const lm of pose) {
    if (lm && (lm.visibility === undefined || lm.visibility > 0.3)) {
      count++;
    }
  }
  return count;
}

export function PoseTracker({
  exercise, isActive, facingMode = 'user',
  onRepComplete, onSecondComplete, suspicionTracker,
  onCameraReady, onCameraError,
}: PoseTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationFrameRef = useRef<number>();
  const lastPhaseRef = useRef<Phase>('neutral');
  const holdStartRef = useRef<number | null>(null);
  const lastHoldPointRef = useRef<number>(0);
  const lastRepTimeRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const lastProcessTimeRef = useRef<number>(0);
  const prevAvgPosRef = useRef<{ x: number; y: number } | null>(null);
  const activeStartTimeRef = useRef<number>(0);
  const ML_INTERVAL_MS = 125;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  

  const isTimedHold = TIMED_HOLD_EXERCISES.includes(exercise);

  // Reset state when exercise changes
  useEffect(() => {
    resetMountainClimberState();
    resetHighKneeState();
    resetPunchState();
    resetCalfRaiseState();
    resetHipCircleState();
    lastPhaseRef.current = 'neutral';
    holdStartRef.current = null;
    lastHoldPointRef.current = 0;
    lastRepTimeRef.current = 0;
    prevAvgPosRef.current = null;
    activeStartTimeRef.current = Date.now();
  }, [exercise]);

  // Also reset start time when exercise becomes active
  useEffect(() => {
    if (isActive) {
      activeStartTimeRef.current = Date.now();
    }
  }, [isActive]);

  // Initialize MediaPipe
  useEffect(() => {
    let isMounted = true;
    const init = async () => {
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
    init();
    return () => { isMounted = false; poseLandmarkerRef.current?.close(); };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  useEffect(() => {
    if (!videoRef.current || isLoading) return;
    if (!isActive) { stopStream(); return; }
    stopStream();
    let cancelled = false;
    const startCamera = async () => {
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }
        });
        if (cancelled) { newStream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = newStream;
        if (videoRef.current) {
          videoRef.current.srcObject = newStream;
          videoRef.current.onloadeddata = () => { if (!cancelled) onCameraReady?.(); };
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
    return () => { cancelled = true; stopStream(); };
  }, [isLoading, isActive, facingMode, stopStream]);

  const getPhase = useCallback((pose: any[]): Phase => {
    switch (exercise) {
      case 'squats': return detectSquatPhase(pose);
      case 'lunges': return detectLungePhase(pose);
      case 'push-ups': return detectPushUpPhase(pose);
      case 'pike-push-ups': return detectPikePushUpPhase(pose);
      case 'diamond-push-ups': return detectDiamondPushUpPhase(pose);
      case 'sit-ups': return detectSitUpPhase(pose);
      case 'jumps': return detectJumpPhase(pose);
      case 'dips': return detectDipPhase(pose);
      case 'pull-ups': return detectPullUpPhase(pose);
      case 'calf-raises': return detectCalfRaisePhase(pose);
      case 'burpees': return detectBurpeePhase(pose);
      case 'mountain-climbers': return detectMountainClimberPhase(pose);
      case 'high-knees': return detectHighKneePhase(pose);
      case 'jumping-jacks': return detectJumpingJackPhase(pose);
      case 'jump-rope': return detectJumpRopePhase(pose);
      case 'toe-touches': return detectToeTouchPhase(pose);
      case 'cat-cow-stretch': return detectCatCowPhase(pose);
      case 'bench-press': return detectBenchPressPhase(pose);
      case 'dumbbell-chest-press': return detectChestPressPhase(pose);
      case 'dumbbell-bicep-curls': return detectBicepCurlPhase(pose);
      case 'dumbbell-hammer-curls': return detectHammerCurlPhase(pose);
      case 'dumbbell-shoulder-press': return detectShoulderPressPhase(pose);
      case 'dumbbell-lateral-raises': return detectLateralRaisePhase(pose);
      case 'dumbbell-front-raises': return detectFrontRaisePhase(pose);
      case 'dumbbell-bent-over-rows': return detectBentOverRowPhase(pose);
      case 'dumbbell-goblet-squat': return detectGobletSquatPhase(pose);
      case 'dumbbell-thrusters': return detectThrusterPhase(pose);
      case 'dumbbell-tricep-overhead-extension': return detectTricepExtensionPhase(pose);
      case 'dumbbell-punches': return detectPunchPhase(pose);
      case 'dumbbell-romanian-deadlift': return detectRomanianDeadliftPhase(pose);
      case 'dumbbell-windmill': return detectWindmillPhase(pose);
      case 'lat-pulldown': return detectLatPulldownPhase(pose);
      case 'seated-cable-row': return detectSeatedCableRowPhase(pose);
      default: return 'neutral';
    }
  }, [exercise]);

  const isHoldValid = useCallback((pose: any[]): boolean => {
    switch (exercise) {
      case 'plank': return isPlankValid(pose);
      case 'wall-sit': return isWallSitValid(pose);
      case 'deep-squat-hold': return isDeepSquatHoldValid(pose);
      case 'shoulder-stretch-hold': return isShoulderStretchValid(pose);
      case 'cobra-stretch': return isCobraStretchValid(pose);
      case 'hip-circles': return isHipCircleValid(pose);
      default: return false;
    }
  }, [exercise]);

  const detectRep = useCallback((landmarks: any[]) => {
    if (!landmarks || landmarks.length === 0) return;
    const pose = landmarks[0];

    // ─── PROTECTION 1: Grace period — skip first 2 seconds ───
    if (Date.now() - activeStartTimeRef.current < GRACE_PERIOD_MS) {
      return;
    }

    // ─── PROTECTION 2: Minimum visible landmarks per exercise ───
    if (VISIBILITY_CHECK_ENABLED) {
      const visibleCount = countVisibleLandmarks(pose);
      const minRequired = MIN_LANDMARKS[exercise] || 6; // default 6 if not listed
      if (visibleCount < minRequired) {
        return; // not enough body visible — skip frame
      }
    }

    // ─── PROTECTION 3: Camera stability — skip if camera is shaking ───
    if (CAMERA_STABILITY_ENABLED) {
      let sumX = 0, sumY = 0, count = 0;
      for (const lm of pose) {
        if (lm && lm.visibility > 0.5) {
          sumX += lm.x;
          sumY += lm.y;
          count++;
        }
      }
      if (count > 0) {
        const avgX = sumX / count;
        const avgY = sumY / count;
        const prev = prevAvgPosRef.current;
        prevAvgPosRef.current = { x: avgX, y: avgY };
        if (prev) {
          const dx = avgX - prev.x;
          const dy = avgY - prev.y;
          const shift = Math.sqrt(dx * dx + dy * dy);
          if (shift > CAMERA_SHAKE_THRESHOLD) {
            return; // camera shaking — skip this frame
          }
        } else {
          return; // first frame — no previous reference, skip
        }
      }
    }

    // ─── TIMED HOLDS ───
    if (isTimedHold) {
      const valid = isHoldValid(pose);
      if (valid) {
        if (!holdStartRef.current) {
          holdStartRef.current = Date.now();
          lastHoldPointRef.current = 0;
        } else {
          const elapsedSec = (Date.now() - holdStartRef.current) / 1000;
          const pointsEarned = Math.floor(elapsedSec / HOLD_SECONDS_PER_POINT);
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

    // ─── REP-BASED: count on down → up ───
    const currentPhase = getPhase(pose);
    if (lastPhaseRef.current === 'down' && currentPhase === 'up') {
      // Bench press: enforce 500ms minimum between reps to prevent double counting
      if (exercise === 'bench-press') {
        const now = Date.now();
        if (now - lastRepTimeRef.current < 500) return;
        lastRepTimeRef.current = now;
      }
      if (suspicionTracker) recordRep(suspicionTracker);
      onRepComplete();
    }
    if (currentPhase !== 'neutral') {
      lastPhaseRef.current = currentPhase;
    }
  }, [exercise, isTimedHold, isHoldValid, getPhase, onRepComplete, onSecondComplete, suspicionTracker]);

  // ─── Pose detection loop ───
  useEffect(() => {
    if (!isActive || isLoading || !videoRef.current || !canvasRef.current || !poseLandmarkerRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let lastVideoTime = -1;

    const loop = () => {
      if (!poseLandmarkerRef.current || video.currentTime === lastVideoTime) {
        animationFrameRef.current = requestAnimationFrame(loop);
        return;
      }
      lastVideoTime = video.currentTime;
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      ctx.restore();

      const now = performance.now();
      if (now - lastProcessTimeRef.current >= ML_INTERVAL_MS) {
        lastProcessTimeRef.current = now;
      const results = poseLandmarkerRef.current.detectForVideo(video, now);
        if (results.landmarks && results.landmarks.length > 0) {
          const pose = results.landmarks[0];
          detectRep(results.landmarks);
        }
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };

    if (video.readyState >= 2) loop();
    else video.addEventListener('loadeddata', loop);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [isActive, isLoading, detectRep]);

  // ─── Render ───
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
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0" />
      <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }} />
    </div>
  );
}
