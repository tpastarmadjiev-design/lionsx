/**
 * Push-up specific detection with strong anti-cheat protection.
 * Validates shoulder/torso movement, elbow angle, range of motion,
 * and realistic frequency. Does NOT affect any other exercise.
 */

interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// Minimum time between reps (ms) — 0.4s = 2.5 reps/sec absolute max
const MIN_REP_INTERVAL_MS = 400;

// Minimum elbow angle change (degrees) to count as real flexion/extension
const MIN_ELBOW_ANGLE_CHANGE = 25;

// Minimum shoulder vertical displacement (normalised coords) between top & bottom
const MIN_SHOULDER_AMPLITUDE = 0.03;

// Visibility threshold for a landmark to be considered "visible"
const VISIBILITY_THRESHOLD = 0.5;

// MediaPipe landmark indices
const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;

export type PushUpPhase = 'up' | 'down' | 'neutral';

export interface PushUpState {
  lastRepTime: number;
  bottomShoulderY: number | null;
  bottomElbowAngle: number | null;
  topShoulderY: number | null;
  topElbowAngle: number | null;
  phase: PushUpPhase;
}

export function createPushUpState(): PushUpState {
  return {
    lastRepTime: 0,
    bottomShoulderY: null,
    bottomElbowAngle: null,
    topShoulderY: null,
    topElbowAngle: null,
    phase: 'neutral',
  };
}

/** Compute angle at elbow (shoulder-elbow-wrist) in degrees */
function elbowAngle(
  shoulder: LandmarkPoint,
  elbow: LandmarkPoint,
  wrist: LandmarkPoint,
): number {
  const ux = shoulder.x - elbow.x;
  const uy = shoulder.y - elbow.y;
  const vx = wrist.x - elbow.x;
  const vy = wrist.y - elbow.y;
  const dot = ux * vx + uy * vy;
  const magU = Math.sqrt(ux * ux + uy * uy);
  const magV = Math.sqrt(vx * vx + vy * vy);
  if (magU === 0 || magV === 0) return 180;
  const cos = Math.max(-1, Math.min(1, dot / (magU * magV)));
  return Math.acos(cos) * (180 / Math.PI);
}

function isVisible(lm: LandmarkPoint | undefined): boolean {
  if (!lm) return false;
  return (lm.visibility ?? 1) >= VISIBILITY_THRESHOLD;
}

/**
 * Checks whether the upper body (head, shoulders, torso) is visible.
 * Returns null if OK, or a user-facing message if not.
 */
export function checkUpperBodyVisibility(pose: LandmarkPoint[]): string | null {
  const nose = pose[NOSE];
  const lShoulder = pose[LEFT_SHOULDER];
  const rShoulder = pose[RIGHT_SHOULDER];
  const lHip = pose[LEFT_HIP];
  const rHip = pose[RIGHT_HIP];

  const headOk = isVisible(nose);
  const shouldersOk = isVisible(lShoulder) && isVisible(rShoulder);
  const torsoOk = isVisible(lHip) || isVisible(rHip);

  if (!headOk || !shouldersOk || !torsoOk) {
    return 'Please position the camera so your upper body is fully visible for accurate push-up tracking.';
  }
  return null;
}

/**
 * Detect current push-up phase and validate reps.
 * Returns true when a valid rep is completed (down → up with all checks passing).
 */
export function detectPushUp(
  pose: LandmarkPoint[],
  state: PushUpState,
): { repCounted: boolean; phase: PushUpPhase } {
  const lShoulder = pose[LEFT_SHOULDER];
  const rShoulder = pose[RIGHT_SHOULDER];
  const lElbow = pose[LEFT_ELBOW];
  const rElbow = pose[RIGHT_ELBOW];
  const lWrist = pose[LEFT_WRIST];
  const rWrist = pose[RIGHT_WRIST];

  if (!lShoulder || !rShoulder || !lElbow || !rElbow || !lWrist || !rWrist) {
    return { repCounted: false, phase: state.phase };
  }

  // Average shoulder Y (normalised: 0=top, 1=bottom of frame)
  const avgShoulderY = (lShoulder.y + rShoulder.y) / 2;

  // Average elbow angle (both arms)
  const leftAngle = elbowAngle(lShoulder, lElbow, lWrist);
  const rightAngle = elbowAngle(rShoulder, rElbow, rWrist);
  const avgAngle = (leftAngle + rightAngle) / 2;

  // Determine phase based on elbow angle
  // Down: elbows bent (<120°), Up: elbows extended (>150°)
  let currentPhase: PushUpPhase = state.phase;

  if (avgAngle < 110) {
    currentPhase = 'down';
  } else if (avgAngle > 150) {
    currentPhase = 'up';
  }

  // --- Transition: entering DOWN phase ---
  if (currentPhase === 'down' && state.phase !== 'down') {
    state.bottomShoulderY = avgShoulderY;
    state.bottomElbowAngle = avgAngle;
  }

  // --- Transition: DOWN → UP = potential rep ---
  let repCounted = false;
  if (state.phase === 'down' && currentPhase === 'up') {
    state.topShoulderY = avgShoulderY;
    state.topElbowAngle = avgAngle;

    const now = Date.now();

    // 1. Frequency filter
    const timeSinceLastRep = now - state.lastRepTime;
    if (state.lastRepTime > 0 && timeSinceLastRep < MIN_REP_INTERVAL_MS) {
      // Too fast — reject
      state.phase = currentPhase;
      return { repCounted: false, phase: currentPhase };
    }

    // 2. Elbow angle change validation
    const angleChange = Math.abs((state.topElbowAngle ?? 180) - (state.bottomElbowAngle ?? 180));
    if (angleChange < MIN_ELBOW_ANGLE_CHANGE) {
      // Wrist moved but elbow barely changed — reject
      state.phase = currentPhase;
      return { repCounted: false, phase: currentPhase };
    }

    // 3. Shoulder / torso vertical displacement
    const shoulderDisplacement = Math.abs((state.bottomShoulderY ?? 0) - (state.topShoulderY ?? 0));
    if (shoulderDisplacement < MIN_SHOULDER_AMPLITUDE) {
      // No real torso movement — reject
      state.phase = currentPhase;
      return { repCounted: false, phase: currentPhase };
    }

    // All checks passed — count the rep
    state.lastRepTime = now;
    repCounted = true;
  }

  state.phase = currentPhase;
  return { repCounted, phase: currentPhase };
}
