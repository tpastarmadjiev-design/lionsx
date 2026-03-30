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

// ─── TOGGLES (set to false to disable any protection) ───
const CAMERA_STABILITY_ENABLED = true;
const CAMERA_SHAKE_THRESHOLD = 0.06;
const BODY_REALISM_ENABLED = true;
const GRACE_PERIOD_MS = 2000;

// ─── BODY REALISM CHECK ───
// When holding phone at face, MediaPipe "guesses" body landmarks
// but places them all very close together (near the face).
// Real body has shoulder-to-hip distance > 12% of frame height.
// This catches fake/partial body detection.

type BodyCheckType = 'full' | 'upper' | 'seated';

const EXERCISE_BODY_CHECK: Record<string, BodyCheckType> = {
  'squats': 'full', 'lunges': 'full', 'jumps': 'full', 'burpees': 'full',
  'mountain-climbers': 'full', 'high-knees': 'full', 'jumping-jacks': 'full',
  'jump-rope': 'full', 'calf-raises': 'full', 'dumbbell-goblet-squat': 'full',
  'dumbbell-thrusters': 'full', 'dumbbell-windmill': 'full', 'toe-touches': 'full',
  'dumbbell-romanian-deadlift': 'full', 'wall-sit': 'full', 'deep-squat-hold': 'full',
  'hip-circles': 'full',
  'push-ups': 'upper', 'pike-push-ups': 'upper', 'diamond-push-ups': 'upper',
  'sit-ups': 'upper', 'dips': 'upper', 'pull-ups': 'upper',
  'bench-press': 'upper', 'dumbbell-chest-press': 'upper',
  'dumbbell-bicep-curls': 'upper', 'dumbbell-hammer-curls': 'upper',
  'dumbbell-shoulder-press': 'upper', 'dumbbell-lateral-raises': 'upper',
  'dumbbell-front-raises': 'upper', 'dumbbell-bent-over-rows': 'upper',
  'dumbbell-tricep-overhead-extension': 'upper', 'dumbbell-punches': 'upper',
  'cat-cow-stretch': 'upper', 'plank': 'upper', 'cobra-stretch': 'upper',
  'shoulder-stretch-hold': 'upper',
  'lat-pulldown': 'seated', 'seated-cable-row': 'seated',
};

function isBodyRealistic(pose: any[], checkType: BodyCheckType): boolean {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lHip = pose[23], rHip = pose[24];
  const lElbow = pose[13], rElbow = pose[14];

  let shoulderY: number | null = null;
  if (lShoulder && rShoulder) shoulderY = (lShoulder.y + rShoulder.y) / 2;
  else if (lShoulder) shoulderY = lShoulder.y;
  else if (rShoulder) shoulderY = rShoulder.y;

  let hipY: number | null = null;
  if (lHip && rHip) hipY = (lHip.y + rHip.y) / 2;
  else if (lHip) hipY = lHip.y;
  else if (rHip) hipY = rHip.y;

  let elbowY: number | null = null;
  if (lElbow && rElbow) elbowY = (lElbow.y + rElbow.y) / 2;
  else if (lElbow) elbowY = lElbow.y;
  else if (rElbow) elbowY = rElbow.y;

  switch (checkType) {
    case 'full':
      if (shoulderY === null || hipY === null) return false;
      return Math.abs(hipY - shoulderY) > 0.12;
    case 'upper':
      if (shoulderY === null) return false;
      if (hipY !== null && Math.abs(hipY - shoulderY) > 0.08) return true;
      if (elbowY !== null && Math.abs(elbowY - shoulderY) > 0.04) return true;
      return false;
    case 'seated':
      if (shoulderY === null) return false;
      if (elbowY !== null && Math.abs(elbowY - shoulderY) > 0.03) return true;
      if (hipY !== null && Math.abs(hipY - shoulderY) > 0.05) return true;
      return false;
  }
}

const TIMED_HOLD_EXERCISES: ExerciseType[] = [
  'plank', 'wall-sit', 'hip-circles', 'shoulder-stretch-hold', 'deep-squat-hold', 'cobra-stretch'
];

const HOLD_SECONDS_PER_POINT = 1.5;

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
  const [debugLandmarks, setDebugLandmarks] = useState({ sY: 0, hY: 0, eY: 0, sh: 0, se: 0 });

  const isTimedHold = TIMED_HOLD_EXERCISES.includes(exercise);

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

  useEffect(() => {
    if (isActive) activeStartTimeRef.current = Date.now();
  }, [isActive]);

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
        if (isMounted) { poseLandmarkerRef.current = poseLandmarker; setIsLoading(false); }
      } catch (err) {
        console.error('Failed to initialize pose landmarker:', err);
        if (isMounted) { setError('Failed to initialize pose detection. Please try again.'); setIsLoading(false); }
      }
    };
    init();
    return () => { isMounted = false; poseLandmarkerRef.current?.close(); };
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(track => track.stop()); streamRef.current = null; }
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
        if (!cancelled) { const msg = 'Camera permission is required to start this exercise.'; setError(msg); onCameraError?.(msg); }
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
    if (Date.now() - activeStartTimeRef.current < GRACE_PERIOD_MS) return;

    // ─── PROTECTION 2: Body realism — skip if body proportions are fake ───
    if (BODY_REALISM_ENABLED) {
      const checkType = EXERCISE_BODY_CHECK[exercise] || 'upper';
      if (!isBodyRealistic(pose, checkType)) return;
    }

    // ─── PROTECTION 3: Camera stability — skip if camera is shaking ───
    if (CAMERA_STABILITY_ENABLED) {
      let sumX = 0, sumY = 0, count = 0;
      for (const lm of pose) {
        if (lm && lm.visibility > 0.5) { sumX += lm.x; sumY += lm.y; count++; }
      }
      if (count > 0) {
        const avgX = sumX / count;
        const avgY = sumY / count;
        const prev = prevAvgPosRef.current;
        prevAvgPosRef.current = { x: avgX, y: avgY };
        if (prev) {
          const dx = avgX - prev.x;
          const dy = avgY - prev.y;
          if (Math.sqrt(dx * dx + dy * dy) > CAMERA_SHAKE_THRESHOLD) return;
        } else {
          return;
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
      if (exercise === 'bench-press') {
        const now = Date.now();
        if (now - lastRepTimeRef.current < 500) return;
        lastRepTimeRef.current = now;
      }
      if (suspicionTracker) recordRep(suspicionTracker);
      onRepComplete();
    }
    if (currentPhase !== 'neutral') lastPhaseRef.current = currentPhase;
  }, [exercise, isTimedHold, isHoldValid, getPhase, onRepComplete, onSecondComplete, suspicionTracker]);

  useEffect(() => {
    if (!isActive || isLoading || !videoRef.current || !canvasRef.current || !poseLandmarkerRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let lastVideoTime = -1;
    const loop = () => {
      if (!poseLandmarkerRef.current || video.currentTime === lastVideoTime) {
        animationFrameRef.current = requestAnimationFrame(loop); return;
      }
      lastVideoTime = video.currentTime;
      ctx.save(); ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height); ctx.restore();
      const now = performance.now();
      if (now - lastProcessTimeRef.current >= ML_INTERVAL_MS) {
        lastProcessTimeRef.current = now;
        const results = poseLandmarkerRef.current.detectForVideo(video, now);
        if (results.landmarks && results.landmarks.length > 0) {
          const p = results.landmarks[0];
          const sY = ((p[11]?.y ?? 0) + (p[12]?.y ?? 0)) / 2;
          const hY = ((p[23]?.y ?? 0) + (p[24]?.y ?? 0)) / 2;
          const eY = ((p[13]?.y ?? 0) + (p[14]?.y ?? 0)) / 2;
          setDebugLandmarks({ sY, hY, eY, sh: Math.abs(hY - sY), se: Math.abs(eY - sY) });
          detectRep(results.landmarks);
        }
      }
      animationFrameRef.current = requestAnimationFrame(loop);
    };
    if (video.readyState >= 2) loop();
    else video.addEventListener('loadeddata', loop);
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
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
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover opacity-0" />
      <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-cover"
        style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : undefined }} />
      <div style={{ position: 'absolute', top: 4, left: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 4, fontFamily: 'monospace', zIndex: 10 }}>
        S:{debugLandmarks.sY.toFixed(2)} H:{debugLandmarks.hY.toFixed(2)} E:{debugLandmarks.eY.toFixed(2)} | S-H:{debugLandmarks.sh.toFixed(2)} S-E:{debugLandmarks.se.toFixed(2)}
      </div>
    </div>
  );
}
