/**
 * Anti-cheat validation for pose-based exercise tracking.
 * Validates rep cycles against realistic movement patterns.
 */

export type ExerciseType = 'sit-ups' | 'push-ups' | 'jumps' | 'plank' | 'dips' | 'pull-ups' | 'bench-press';

// Max reps per second per exercise
const MAX_REPS_PER_SEC: Record<string, number> = {
  'push-ups': 0.8,
  'pull-ups': 0.5,
  'sit-ups': 0.8,
  'jumps': 1.0,
  'dips': 0.8,
  'bench-press': 0.8,
};

// Minimum duration (ms) for one full rep cycle
const MIN_REP_DURATION_MS: Record<string, number> = {
  'push-ups': 800,
  'pull-ups': 1200,
  'sit-ups': 1000,
  'jumps': 600,
  'dips': 800,
  'bench-press': 800,
};

// Minimum landmark displacement (normalized coords) to count as real movement
const MIN_AMPLITUDE = 0.04; // ~4% of frame height

interface LandmarkPoint {
  x: number;
  y: number;
  z?: number;
}

interface RepCycleState {
  lastRepTime: number;
  downStartTime: number | null;
  downLandmarks: LandmarkPoint[] | null;
  upLandmarks: LandmarkPoint[] | null;
  recentRepTimestamps: number[];
}

export function createRepCycleState(): RepCycleState {
  return {
    lastRepTime: 0,
    downStartTime: null,
    downLandmarks: null,
    upLandmarks: null,
    recentRepTimestamps: [],
  };
}

/**
 * Validates whether a rep transition (down→up) should be counted.
 * Returns true if the rep passes all anti-cheat checks.
 */
export function validateRep(
  exercise: ExerciseType,
  state: RepCycleState,
  currentLandmarks: LandmarkPoint[],
): boolean {
  if (exercise === 'plank') return true; // time-based, no rep validation

  const now = Date.now();

  // 1. Minimum rep duration check
  const minDuration = MIN_REP_DURATION_MS[exercise] || 700;
  if (state.downStartTime !== null) {
    const repDuration = now - state.downStartTime;
    if (repDuration < minDuration) {
      return false;
    }
  }

  // 2. Max reps/sec rate limiting
  const maxRps = MAX_REPS_PER_SEC[exercise] || 1.0;
  const minIntervalMs = 1000 / maxRps;
  if (state.lastRepTime > 0 && (now - state.lastRepTime) < minIntervalMs) {
    return false;
  }

  // 3. Minimum amplitude check - ensure landmarks actually moved enough
  if (state.downLandmarks && currentLandmarks.length > 0) {
    const amplitude = computeAmplitude(state.downLandmarks, currentLandmarks);
    if (amplitude < MIN_AMPLITUDE) {
      return false;
    }
  }

  // 4. Multi-axis motion check - movement must not be isolated to single axis
  if (state.downLandmarks && currentLandmarks.length > 0) {
    if (isSingleAxisMotion(state.downLandmarks, currentLandmarks)) {
      return false;
    }
  }

  // 5. Rep accepted — update state
  state.lastRepTime = now;
  state.recentRepTimestamps.push(now);
  // Keep only last 10 timestamps
  if (state.recentRepTimestamps.length > 10) {
    state.recentRepTimestamps.shift();
  }

  return true;
}

/**
 * Record that the user entered the "down" phase.
 */
export function recordDownPhase(state: RepCycleState, landmarks: LandmarkPoint[]) {
  state.downStartTime = Date.now();
  state.downLandmarks = landmarks.slice(0, 33).map(l => ({ x: l.x, y: l.y, z: l.z }));
}

/**
 * Record the "up" phase landmarks for comparison.
 */
export function recordUpPhase(state: RepCycleState, landmarks: LandmarkPoint[]) {
  state.upLandmarks = landmarks.slice(0, 33).map(l => ({ x: l.x, y: l.y, z: l.z }));
}

/**
 * Compute average displacement across key body landmarks between two poses.
 */
function computeAmplitude(landmarksA: LandmarkPoint[], landmarksB: LandmarkPoint[]): number {
  // Use key joints: shoulders (11,12), elbows (13,14), hips (23,24), knees (25,26)
  const keyIndices = [11, 12, 13, 14, 23, 24, 25, 26];
  let totalDisplacement = 0;
  let count = 0;

  for (const idx of keyIndices) {
    if (idx < landmarksA.length && idx < landmarksB.length) {
      const a = landmarksA[idx];
      const b = landmarksB[idx];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dz = (b.z || 0) - (a.z || 0);
      totalDisplacement += Math.sqrt(dx * dx + dy * dy + dz * dz);
      count++;
    }
  }

  return count > 0 ? totalDisplacement / count : 0;
}

/**
 * Check if >80% of motion is on a single axis (indicates fake/shake movement).
 */
function isSingleAxisMotion(landmarksA: LandmarkPoint[], landmarksB: LandmarkPoint[]): boolean {
  const keyIndices = [11, 12, 13, 14, 23, 24, 25, 26];
  let totalDx = 0, totalDy = 0, totalDz = 0;

  for (const idx of keyIndices) {
    if (idx < landmarksA.length && idx < landmarksB.length) {
      totalDx += Math.abs(landmarksB[idx].x - landmarksA[idx].x);
      totalDy += Math.abs(landmarksB[idx].y - landmarksA[idx].y);
      totalDz += Math.abs((landmarksB[idx].z || 0) - (landmarksA[idx].z || 0));
    }
  }

  const total = totalDx + totalDy + totalDz;
  if (total < 0.001) return true; // no movement at all

  // If any single axis accounts for >80% of total motion, it's suspicious
  return (totalDx / total > 0.8) || (totalDy / total > 0.8) || (totalDz / total > 0.8);
}
