/**
 * Adaptive Threshold Engine — dynamically adjusts movement validation
 * based on the user's natural range during first 3-5 movements.
 *
 * Sits ON TOP of existing exercise detection without modifying it.
 * Provides a movement filter that rejects tiny oscillations (< 20% of calibrated range).
 */

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

type Phase = 'up' | 'down' | 'neutral';

// Movement axis type for each exercise
type MovementType = 'vertical-hip' | 'vertical-shoulder' | 'vertical-ankle' | 'horizontal-ankle'
  | 'horizontal-knee' | 'angle-elbow' | 'relative-shoulder-hip' | 'hip-knee-dist'
  | 'shoulder-ankle-dist' | 'hip-horizontal' | 'wrist-vertical' | 'elbow-vertical'
  | 'wrist-elbow-vertical';

interface ExerciseMovementConfig {
  type: MovementType;
  minSafeRange: number; // minimum range to accept calibration
}

const EXERCISE_CONFIGS: Record<string, ExerciseMovementConfig> = {
  // Vertical hip exercises
  'squats': { type: 'vertical-hip', minSafeRange: 0.04 },
  'lunges': { type: 'vertical-hip', minSafeRange: 0.04 },
  'burpees': { type: 'vertical-hip', minSafeRange: 0.04 },
  'jumps': { type: 'vertical-hip', minSafeRange: 0.04 },
  'dumbbell-goblet-squat': { type: 'hip-knee-dist', minSafeRange: 0.04 },
  'dumbbell-romanian-deadlift': { type: 'vertical-hip', minSafeRange: 0.04 },

  // Vertical shoulder exercises
  'sit-ups': { type: 'vertical-shoulder', minSafeRange: 0.04 },
  'cobra-stretch': { type: 'vertical-shoulder', minSafeRange: 0.04 },

  // Relative shoulder-hip exercises
  'cat-cow-stretch': { type: 'relative-shoulder-hip', minSafeRange: 0.04 },

  // Vertical ankle exercises
  'calf-raises': { type: 'vertical-ankle', minSafeRange: 0.04 },
  'jump-rope': { type: 'vertical-ankle', minSafeRange: 0.04 },

  // Horizontal ankle exercises
  'jumping-jacks': { type: 'horizontal-ankle', minSafeRange: 0.04 },

  // Horizontal knee exercises
  'mountain-climbers': { type: 'horizontal-knee', minSafeRange: 0.04 },

  // Angle-based elbow exercises
  'push-ups': { type: 'angle-elbow', minSafeRange: 20 },
  'pike-push-ups': { type: 'angle-elbow', minSafeRange: 20 },
  'diamond-push-ups': { type: 'angle-elbow', minSafeRange: 20 },
  'bench-press': { type: 'angle-elbow', minSafeRange: 20 },
  'dumbbell-bicep-curls': { type: 'angle-elbow', minSafeRange: 20 },
  'dumbbell-thrusters': { type: 'angle-elbow', minSafeRange: 20 },

  // Wrist-elbow relative
  'dumbbell-hammer-curls': { type: 'wrist-elbow-vertical', minSafeRange: 0.04 },

  // Wrist vertical
  'dumbbell-shoulder-press': { type: 'wrist-vertical', minSafeRange: 0.04 },
  'dumbbell-front-raises': { type: 'wrist-vertical', minSafeRange: 0.04 },
  'dumbbell-lateral-raises': { type: 'wrist-vertical', minSafeRange: 0.04 },
  'dumbbell-chest-press': { type: 'angle-elbow', minSafeRange: 20 },

  // Elbow vertical
  'dumbbell-tricep-overhead-extension': { type: 'elbow-vertical', minSafeRange: 0.04 },
  'dumbbell-bent-over-rows': { type: 'elbow-vertical', minSafeRange: 0.04 },

  // Shoulder-ankle distance
  'toe-touches': { type: 'shoulder-ankle-dist', minSafeRange: 0.04 },

  // Hip horizontal
  'hip-circles': { type: 'hip-horizontal', minSafeRange: 0.04 },

  // High knees uses knee-hip relative
  'high-knees': { type: 'vertical-hip', minSafeRange: 0.04 },

  // Dumbbell punches (angle-based)
  'dumbbell-punches': { type: 'angle-elbow', minSafeRange: 20 },

  // Dumbbell windmill
  'dumbbell-windmill': { type: 'wrist-vertical', minSafeRange: 0.04 },
};

const CALIBRATION_MOVEMENTS = 5;
const TOLERANCE_BUFFER = 0.15; // 15% buffer
const CHEAT_FILTER = 0.20; // 20% minimum movement

export interface AdaptiveState {
  exercise: string;
  calibrated: boolean;
  calibrating: boolean;
  movementSamples: number[];
  phaseTransitions: number;
  lastPhase: Phase;
  minValue: number;
  maxValue: number;
  calibratedRange: number;
  minMovementThreshold: number;
  message: string;
}

export function createAdaptiveState(exercise: string): AdaptiveState {
  return {
    exercise,
    calibrated: false,
    calibrating: true,
    movementSamples: [],
    phaseTransitions: 0,
    lastPhase: 'neutral',
    minValue: Infinity,
    maxValue: -Infinity,
    calibratedRange: 0,
    minMovementThreshold: 0,
    message: 'Learning your movement...',
  };
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

/** Extract the primary movement value for this exercise from current pose */
function extractMovementValue(exercise: string, pose: Landmark[]): number | null {
  const config = EXERCISE_CONFIGS[exercise];
  if (!config) return null;

  switch (config.type) {
    case 'vertical-hip': {
      const lHip = pose[23], rHip = pose[24];
      if (!lHip && !rHip) return null;
      return lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)!.y;
    }
    case 'vertical-shoulder': {
      const lS = pose[11], rS = pose[12];
      if (!lS && !rS) return null;
      return lS && rS ? (lS.y + rS.y) / 2 : (lS || rS)!.y;
    }
    case 'vertical-ankle': {
      const lA = pose[27], rA = pose[28];
      if (!lA && !rA) return null;
      return lA && rA ? (lA.y + rA.y) / 2 : (lA || rA)!.y;
    }
    case 'horizontal-ankle': {
      const lA = pose[27], rA = pose[28];
      if (!lA || !rA) return null;
      return Math.abs(lA.x - rA.x);
    }
    case 'horizontal-knee': {
      const lK = pose[25], rK = pose[26];
      if (!lK && !rK) return null;
      return lK && rK ? (lK.x + rK.x) / 2 : (lK || rK)!.x;
    }
    case 'angle-elbow': {
      const lS = pose[11], lE = pose[13], lW = pose[15];
      const rS = pose[12], rE = pose[14], rW = pose[16];
      const leftValid = !!(lS && lE && lW);
      const rightValid = !!(rS && rE && rW);
      if (!leftValid && !rightValid) return null;
      let avg = 0, count = 0;
      if (leftValid) { avg += angleBetween(lS!, lE!, lW!); count++; }
      if (rightValid) { avg += angleBetween(rS!, rE!, rW!); count++; }
      return avg / count;
    }
    case 'relative-shoulder-hip': {
      const lS = pose[11], rS = pose[12], lH = pose[23], rH = pose[24];
      if ((!lS && !rS) || (!lH && !rH)) return null;
      const sY = lS && rS ? (lS.y + rS.y) / 2 : (lS || rS)!.y;
      const hY = lH && rH ? (lH.y + rH.y) / 2 : (lH || rH)!.y;
      return sY - hY;
    }
    case 'hip-knee-dist': {
      const lH = pose[23], rH = pose[24], lK = pose[25], rK = pose[26];
      if ((!lH || !lK) && (!rH || !rK)) return null;
      let dist = 0, count = 0;
      if (lH && lK) { dist += lK.y - lH.y; count++; }
      if (rH && rK) { dist += rK.y - rH.y; count++; }
      return dist / count;
    }
    case 'shoulder-ankle-dist': {
      const lS = pose[11], rS = pose[12], lA = pose[27], rA = pose[28];
      if ((!lS && !rS) || (!lA && !rA)) return null;
      const sY = lS && rS ? (lS.y + rS.y) / 2 : (lS || rS)!.y;
      const aY = lA && rA ? (lA.y + rA.y) / 2 : (lA || rA)!.y;
      return Math.abs(aY - sY);
    }
    case 'hip-horizontal': {
      const lH = pose[23], rH = pose[24];
      if (!lH && !rH) return null;
      return lH && rH ? (lH.x + rH.x) / 2 : (lH || rH)!.x;
    }
    case 'wrist-vertical': {
      const lW = pose[15], rW = pose[16];
      if (!lW && !rW) return null;
      return lW && rW ? (lW.y + rW.y) / 2 : (lW || rW)!.y;
    }
    case 'elbow-vertical': {
      const lE = pose[13], rE = pose[14];
      if (!lE && !rE) return null;
      return lE && rE ? (lE.y + rE.y) / 2 : (lE || rE)!.y;
    }
    case 'wrist-elbow-vertical': {
      const lE = pose[13], rE = pose[14], lW = pose[15], rW = pose[16];
      if ((!lE || !lW) && (!rE || !rW)) return null;
      let rel = 0, count = 0;
      if (lE && lW) { rel += lW.y - lE.y; count++; }
      if (rE && rW) { rel += rW.y - rE.y; count++; }
      return rel / count;
    }
    default:
      return null;
  }
}

/**
 * Feed a new pose frame into the adaptive engine.
 * Call this every detection frame.
 */
export function updateAdaptive(state: AdaptiveState, pose: Landmark[], currentPhase: Phase): void {
  const value = extractMovementValue(state.exercise, pose);
  if (value === null) return;

  // Track min/max
  if (value < state.minValue) state.minValue = value;
  if (value > state.maxValue) state.maxValue = value;

  // Count phase transitions for calibration
  if (currentPhase !== 'neutral' && currentPhase !== state.lastPhase && state.lastPhase !== 'neutral') {
    state.phaseTransitions++;
  }
  if (currentPhase !== 'neutral') state.lastPhase = currentPhase;

  // Check if calibration complete
  if (!state.calibrated && state.phaseTransitions >= CALIBRATION_MOVEMENTS) {
    const config = EXERCISE_CONFIGS[state.exercise];
    const range = state.maxValue - state.minValue;

    if (config && range >= config.minSafeRange) {
      state.calibratedRange = range;
      state.minMovementThreshold = range * CHEAT_FILTER;
      state.calibrated = true;
      state.calibrating = false;
      state.message = 'Ready!';
    } else {
      // Range too small — disable adaptive, fall back to defaults
      state.calibrated = true;
      state.calibrating = false;
      state.calibratedRange = 0;
      state.minMovementThreshold = 0;
      state.message = 'Ready!';
    }
  }
}

/**
 * Check if a detected rep should be counted based on adaptive calibration.
 * Returns true if the rep is valid (movement was large enough).
 * Always returns true during calibration phase or if exercise has no config.
 */
export function shouldCountRep(state: AdaptiveState, pose: Landmark[]): boolean {
  // Always count during calibration or if no calibration data
  if (!state.calibrated || state.calibratedRange === 0) return true;

  // No config for this exercise — always count
  if (!EXERCISE_CONFIGS[state.exercise]) return true;

  const value = extractMovementValue(state.exercise, pose);
  if (value === null) return true;

  // Check if current movement amplitude exceeds minimum threshold
  const currentRange = Math.abs(value - state.minValue);
  const alternativeRange = Math.abs(state.maxValue - value);
  const movementAmplitude = Math.max(currentRange, alternativeRange);

  return movementAmplitude >= state.minMovementThreshold;
}

/**
 * Get the current adaptive status message
 */
export function getAdaptiveMessage(state: AdaptiveState): string | null {
  if (state.calibrating) return state.message;
  return null; // Don't show after calibration unless transitioning
}

export function isCalibrating(state: AdaptiveState): boolean {
  return state.calibrating;
}

export function isCalibrated(state: AdaptiveState): boolean {
  return state.calibrated;
}
