/**
 * Ghost Rep Prevention Engine
 *
 * Prevents false repetitions caused by residual motion after the user stops moving.
 * Uses idle detection, rep cooldown, and micro-movement filtering.
 *
 * Does NOT modify any exercise detection logic, thresholds, or rep cycles.
 */

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// Thresholds
const IDLE_THRESHOLD = 0.015;       // normalized coordinate change to be considered idle
const RESUME_THRESHOLD = 0.03;      // movement needed to resume from idle
const IDLE_FRAME_COUNT = 12;        // ~0.4s at 30fps / ~1.5s at 8fps detection rate
const REP_COOLDOWN_FRAMES = 6;      // ~0.2s minimum between reps
const MICRO_MOVEMENT_RATIO = 0.15;  // 15% of calibrated range

// Key landmarks for overall body movement tracking
const TRACKED_LANDMARKS = [11, 12, 23, 24]; // Shoulders + Hips

export interface GhostRepState {
  /** Previous positions of tracked landmarks */
  prevPositions: { x: number; y: number }[] | null;
  /** Running tally of consecutive idle frames */
  idleFrameCount: number;
  /** Whether the user is currently considered idle */
  isIdle: boolean;
  /** Frames since last rep was counted */
  framesSinceLastRep: number;
  /** Calibrated movement range from adaptive threshold (if available) */
  calibratedRange: number;
  /** Current movement magnitude */
  currentMovement: number;
  /** Status message for UI */
  message: string | null;
}

export function createGhostRepState(): GhostRepState {
  return {
    prevPositions: null,
    idleFrameCount: 0,
    isIdle: false,
    framesSinceLastRep: REP_COOLDOWN_FRAMES, // Start ready
    calibratedRange: 0,
    currentMovement: 0,
    message: null,
  };
}

/**
 * Update ghost rep state with a new pose frame.
 * Call every detection frame.
 */
export function updateGhostRepState(state: GhostRepState, pose: Landmark[]): void {
  // Always increment cooldown counter
  if (state.framesSinceLastRep < REP_COOLDOWN_FRAMES) {
    state.framesSinceLastRep++;
  }

  // Calculate overall body movement magnitude
  const currentPositions: { x: number; y: number }[] = [];
  for (const idx of TRACKED_LANDMARKS) {
    const lm = pose[idx];
    currentPositions[idx] = lm ? { x: lm.x, y: lm.y } : { x: 0, y: 0 };
  }

  if (state.prevPositions === null) {
    state.prevPositions = currentPositions;
    return;
  }

  // Compute average movement across tracked landmarks
  let totalMovement = 0;
  let validCount = 0;
  for (const idx of TRACKED_LANDMARKS) {
    const curr = currentPositions[idx];
    const prev = state.prevPositions[idx];
    if (!curr || !prev) continue;
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    totalMovement += Math.sqrt(dx * dx + dy * dy);
    validCount++;
  }

  state.prevPositions = currentPositions;

  const avgMovement = validCount > 0 ? totalMovement / validCount : 0;
  state.currentMovement = avgMovement;

  // ── IDLE DETECTION ──
  if (avgMovement < IDLE_THRESHOLD) {
    state.idleFrameCount++;
    if (state.idleFrameCount >= IDLE_FRAME_COUNT && !state.isIdle) {
      state.isIdle = true;
      state.message = 'Move to continue';
    }
  } else {
    // Check if movement is strong enough to resume from idle
    if (state.isIdle) {
      if (avgMovement >= RESUME_THRESHOLD) {
        state.isIdle = false;
        state.idleFrameCount = 0;
        state.message = 'Go!';
        // Clear "Go!" message after a short delay (handled by caller)
      }
    } else {
      state.idleFrameCount = 0;
      // Clear any stale message once moving normally
      if (state.message === 'Move to continue') {
        state.message = null;
      }
    }
  }
}

/**
 * Check if a rep should be allowed based on ghost rep prevention rules.
 * Call this BEFORE counting a rep.
 *
 * @param calibratedRange - from adaptive threshold engine (0 if not calibrated)
 * @param currentMovementAmplitude - current movement value magnitude
 */
export function shouldAllowRep(
  state: GhostRepState,
  calibratedRange?: number,
): boolean {
  // TEMPORARILY BYPASSED — always allow reps
  return true;

  // 1. Block if user is idle
  // if (state.isIdle) return false;

  // 2. Block if within cooldown period
  // if (state.framesSinceLastRep < REP_COOLDOWN_FRAMES) return false;

  // 3. Micro-movement filter: reject movements < 15% of calibrated range
  // if (calibratedRange && calibratedRange > 0) {
  //   const microThreshold = calibratedRange * MICRO_MOVEMENT_RATIO;
  //   if (state.currentMovement < microThreshold) return false;
  // }

  // return true;
}

/**
 * Signal that a rep was just counted (resets cooldown timer).
 */
export function onRepCounted(state: GhostRepState): void {
  state.framesSinceLastRep = 0;
}

/**
 * Get the current ghost rep status message (for UI overlay).
 * Returns null when no message should be shown.
 */
export function getGhostRepMessage(state: GhostRepState): string | null {
  return state.message;
}

/**
 * Clear the "Go!" resume message after it's been shown briefly.
 */
export function clearResumeMessage(state: GhostRepState): void {
  if (state.message === 'Go!') {
    state.message = null;
  }
}

/**
 * Check if user is currently idle.
 */
export function isUserIdle(state: GhostRepState): boolean {
  return state.isIdle;
}
