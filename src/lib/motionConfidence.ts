/**
 * Motion Confidence Score Engine
 *
 * Validates movement quality before allowing rep phase transitions.
 * Prevents false reps from jitter, camera noise, accidental movement, or partial tracking loss.
 *
 * Does NOT modify any exercise detection logic, thresholds, or rep cycles.
 */

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

type Phase = 'up' | 'down' | 'neutral';

// ─── Direction tracking ───

type Direction = 1 | -1 | 0; // increasing, decreasing, unchanged

const DIRECTION_HISTORY = 5;
const CONFIDENCE_SMOOTH_WINDOW = 3;
const CONFIDENCE_THRESHOLD = 0.45;

// Minimum movement magnitudes per frame
const MIN_ANGLE_CHANGE = 6;        // degrees
const MIN_POSITION_CHANGE = 0.02;  // normalized coordinates
const MAX_LANDMARK_JUMP = 0.15;    // normalized coordinates

export interface MotionConfidenceState {
  /** Last N movement direction samples (+1 / -1 / 0) */
  directionHistory: Direction[];
  /** Previous movement value for computing deltas */
  prevValue: number | null;
  /** Previous landmark positions for jump detection (shoulders+hips) */
  prevLandmarks: { x: number; y: number }[] | null;
  /** Smoothed confidence scores */
  confidenceHistory: number[];
  /** Current smoothed confidence */
  confidence: number;
  /** Whether this exercise uses angle-based tracking */
  isAngleBased: boolean;
  /** Frames since last valid landmark data (for failsafe hold) */
  framesSinceLandmarks: number;
  /** Last valid confidence to hold during brief landmark loss */
  lastValidConfidence: number;
}

// Exercise movement type mapping (same categories as adaptiveThreshold)
const ANGLE_EXERCISES = new Set([
  'push-ups', 'pike-push-ups', 'diamond-push-ups', 'bench-press',
  'dumbbell-bicep-curls', 'dumbbell-thrusters', 'dumbbell-chest-press',
  'dumbbell-punches',
]);

export function createMotionConfidenceState(exercise: string): MotionConfidenceState {
  return {
    directionHistory: [],
    prevValue: null,
    prevLandmarks: null,
    confidenceHistory: [],
    confidence: 1.0, // Start at 1.0 to not block initial positioning/calibration
    isAngleBased: ANGLE_EXERCISES.has(exercise),
    framesSinceLandmarks: 0,
    lastValidConfidence: 1.0,
  };
}

/** Extract the primary tracking value for direction analysis */
function extractTrackingValue(exercise: string, pose: Landmark[]): number | null {
  // Use the same primary landmark as the exercise detectors
  // Vertical hip
  if (['squats', 'lunges', 'burpees', 'jumps', 'dumbbell-goblet-squat',
       'dumbbell-romanian-deadlift', 'high-knees'].includes(exercise)) {
    const lH = pose[23], rH = pose[24];
    if (!lH && !rH) return null;
    return lH && rH ? (lH.y + rH.y) / 2 : (lH || rH)!.y;
  }
  // Vertical shoulder
  if (['sit-ups', 'cobra-stretch'].includes(exercise)) {
    const lS = pose[11], rS = pose[12];
    if (!lS && !rS) return null;
    return lS && rS ? (lS.y + rS.y) / 2 : (lS || rS)!.y;
  }
  // Relative shoulder-hip
  if (exercise === 'cat-cow-stretch') {
    const lS = pose[11], rS = pose[12], lH = pose[23], rH = pose[24];
    if ((!lS && !rS) || (!lH && !rH)) return null;
    const sY = lS && rS ? (lS.y + rS.y) / 2 : (lS || rS)!.y;
    const hY = lH && rH ? (lH.y + rH.y) / 2 : (lH || rH)!.y;
    return sY - hY;
  }
  // Vertical ankle
  if (['calf-raises', 'jump-rope'].includes(exercise)) {
    const lA = pose[27], rA = pose[28];
    if (!lA && !rA) return null;
    return lA && rA ? (lA.y + rA.y) / 2 : (lA || rA)!.y;
  }
  // Horizontal ankle
  if (exercise === 'jumping-jacks') {
    const lA = pose[27], rA = pose[28];
    if (!lA || !rA) return null;
    return Math.abs(lA.x - rA.x);
  }
  // Horizontal knee
  if (exercise === 'mountain-climbers') {
    const lK = pose[25], rK = pose[26];
    if (!lK && !rK) return null;
    return lK && rK ? (lK.x + rK.x) / 2 : (lK || rK)!.x;
  }
  // Angle-based (elbow angle)
  if (ANGLE_EXERCISES.has(exercise)) {
    const lS = pose[11], lE = pose[13], lW = pose[15];
    const rS = pose[12], rE = pose[14], rW = pose[16];
    let sum = 0, count = 0;
    if (lS && lE && lW) { sum += angleBetween(lS, lE, lW); count++; }
    if (rS && rE && rW) { sum += angleBetween(rS, rE, rW); count++; }
    return count > 0 ? sum / count : null;
  }
  // Wrist vertical
  if (['dumbbell-shoulder-press', 'dumbbell-front-raises', 'dumbbell-lateral-raises',
       'dumbbell-windmill'].includes(exercise)) {
    const lW = pose[15], rW = pose[16];
    if (!lW && !rW) return null;
    return lW && rW ? (lW.y + rW.y) / 2 : (lW || rW)!.y;
  }
  // Elbow vertical
  if (['dumbbell-tricep-overhead-extension', 'dumbbell-bent-over-rows'].includes(exercise)) {
    const lE = pose[13], rE = pose[14];
    if (!lE && !rE) return null;
    return lE && rE ? (lE.y + rE.y) / 2 : (lE || rE)!.y;
  }
  // Nose vertical (pull-ups, dips)
  if (['pull-ups', 'dips'].includes(exercise)) {
    const nose = pose[0];
    if (!nose) return null;
    return nose.y;
  }
  // Wrist-elbow relative
  if (exercise === 'dumbbell-hammer-curls') {
    const lE = pose[13], lW = pose[15];
    if (!lE || !lW) return null;
    return lW.y - lE.y;
  }
  // Shoulder-ankle distance
  if (exercise === 'toe-touches') {
    const lS = pose[11], rS = pose[12], lA = pose[27], rA = pose[28];
    if ((!lS && !rS) || (!lA && !rA)) return null;
    const sY = lS && rS ? (lS.y + rS.y) / 2 : (lS || rS)!.y;
    const aY = lA && rA ? (lA.y + rA.y) / 2 : (lA || rA)!.y;
    return Math.abs(aY - sY);
  }
  // Hip horizontal
  if (exercise === 'hip-circles') {
    const lH = pose[23], rH = pose[24];
    if (!lH && !rH) return null;
    return lH && rH ? (lH.x + rH.x) / 2 : (lH || rH)!.x;
  }
  return null;
}

function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA === 0 || magBC === 0) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cos) * (180 / Math.PI);
}

/** Check if key landmarks jumped too far between frames */
function checkLandmarkStability(pose: Landmark[], prevLandmarks: { x: number; y: number }[] | null): boolean {
  if (!prevLandmarks) return true; // No previous data = stable
  
  const indices = [11, 12, 23, 24]; // shoulders + hips
  for (const idx of indices) {
    const curr = pose[idx];
    const prev = prevLandmarks[idx];
    if (!curr || !prev) continue;
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    if (dx > MAX_LANDMARK_JUMP || dy > MAX_LANDMARK_JUMP) return false;
  }
  return true;
}

/** Store current landmark positions for next frame comparison */
function storeLandmarks(pose: Landmark[]): { x: number; y: number }[] {
  const stored: { x: number; y: number }[] = [];
  for (let i = 0; i < pose.length; i++) {
    const lm = pose[i];
    stored[i] = lm ? { x: lm.x, y: lm.y } : { x: 0, y: 0 };
  }
  return stored;
}

/**
 * Update the motion confidence state with a new frame.
 * Call every detection frame.
 */
export function updateMotionConfidence(
  state: MotionConfidenceState,
  exercise: string,
  pose: Landmark[],
): number {
  const value = extractTrackingValue(exercise, pose);
  
  // ── FAILSAFE: if landmarks lost, hold previous confidence for up to 2 frames ──
  if (value === null) {
    state.framesSinceLandmarks++;
    if (state.framesSinceLandmarks <= 2) {
      return state.lastValidConfidence;
    }
    // After 2 frames, degrade confidence
    state.confidence = Math.max(0, state.confidence - 0.2);
    return state.confidence;
  }
  state.framesSinceLandmarks = 0;

  // ── Compute direction ──
  let direction: Direction = 0;
  let magnitude = 0;
  if (state.prevValue !== null) {
    const delta = value - state.prevValue;
    magnitude = Math.abs(delta);
    if (delta > 0) direction = 1;
    else if (delta < 0) direction = -1;
  }
  state.prevValue = value;

  // Store direction history (last 5 frames)
  state.directionHistory.push(direction);
  if (state.directionHistory.length > DIRECTION_HISTORY) state.directionHistory.shift();

  // ── Compute confidence components ──
  
  // 1. Direction consistency: at least 3 of last 5 frames same direction
  let directionScore = 0;
  if (state.directionHistory.length >= 3) {
    const positives = state.directionHistory.filter(d => d === 1).length;
    const negatives = state.directionHistory.filter(d => d === -1).length;
    const maxConsistent = Math.max(positives, negatives);
    directionScore = Math.min(1, maxConsistent / 3); // 3/5 = 1.0
  } else {
    directionScore = 0.5; // Not enough data yet
  }

  // 2. Movement magnitude
  let magnitudeScore = 0;
  const minMag = state.isAngleBased ? MIN_ANGLE_CHANGE : MIN_POSITION_CHANGE;
  magnitudeScore = Math.min(1, magnitude / minMag);

  // 3. Landmark stability
  const stable = checkLandmarkStability(pose, state.prevLandmarks);
  const stabilityScore = stable ? 1.0 : 0.2;
  state.prevLandmarks = storeLandmarks(pose);

  // ── Combine scores (weighted average) ──
  const rawConfidence = (directionScore * 0.4) + (magnitudeScore * 0.3) + (stabilityScore * 0.3);

  // ── Smooth over last 3 scores ──
  state.confidenceHistory.push(rawConfidence);
  if (state.confidenceHistory.length > CONFIDENCE_SMOOTH_WINDOW) state.confidenceHistory.shift();
  
  const smoothed = state.confidenceHistory.reduce((a, b) => a + b, 0) / state.confidenceHistory.length;
  state.confidence = smoothed;
  state.lastValidConfidence = smoothed;

  return smoothed;
}

/**
 * Check if motion confidence is high enough to allow a phase transition.
 */
export function isMotionConfident(state: MotionConfidenceState): boolean {
  return state.confidence >= CONFIDENCE_THRESHOLD;
}

/**
 * Get the current confidence score (0-1)
 */
export function getMotionConfidence(state: MotionConfidenceState): number {
  return state.confidence;
}
