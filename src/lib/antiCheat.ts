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

export interface SuspicionFlags {
  unrealisticSpeed: boolean;
  singleAxisMotion: boolean;
  microMovements: boolean;
  volumeSpike: boolean;
  noOrientationChange: boolean;
}

export interface SessionSuspicionTracker {
  speedViolations: number;
  singleAxisCount: number;
  microMovementStreak: number;
  lpTimestamps: { time: number; lp: number }[];
  orientationSamples: number[];
  totalReps: number;
  repTempos: number[];
  axisDistribution: { x: number; y: number; z: number };
  axisDistributionCount: number;
}

export function createSessionSuspicionTracker(): SessionSuspicionTracker {
  return {
    speedViolations: 0,
    singleAxisCount: 0,
    microMovementStreak: 0,
    lpTimestamps: [],
    orientationSamples: [],
    totalReps: 0,
    repTempos: [],
    axisDistribution: { x: 0, y: 0, z: 0 },
    axisDistributionCount: 0,
  };
}

export function getSuspicionFlags(tracker: SessionSuspicionTracker): SuspicionFlags {
  // Unrealistic Speed: exceeded max reps/sec more than 3 times
  const unrealisticSpeed = tracker.speedViolations > 3;

  // Single Axis Motion: >80% on one axis for more than 10 reps
  const singleAxisMotion = tracker.singleAxisCount > 10;

  // Micro Movements: amplitude below threshold for 20+ consecutive reps
  const microMovements = tracker.microMovementStreak >= 20;

  // Volume Spike: >150 LP within 10 seconds
  let volumeSpike = false;
  if (tracker.lpTimestamps.length > 1) {
    for (let i = 0; i < tracker.lpTimestamps.length; i++) {
      let lpSum = 0;
      for (let j = i; j < tracker.lpTimestamps.length; j++) {
        if (tracker.lpTimestamps[j].time - tracker.lpTimestamps[i].time > 10000) break;
        lpSum += tracker.lpTimestamps[j].lp;
      }
      if (lpSum > 150) { volumeSpike = true; break; }
    }
  }

  // No Orientation Change: <10° total change across all samples
  let noOrientationChange = false;
  if (tracker.orientationSamples.length > 2) {
    const minO = Math.min(...tracker.orientationSamples);
    const maxO = Math.max(...tracker.orientationSamples);
    noOrientationChange = (maxO - minO) < 10;
  }

  return { unrealisticSpeed, singleAxisMotion, microMovements, volumeSpike, noOrientationChange };
}

export function computeSuspicionScore(flags: SuspicionFlags): number {
  let score = 0;
  if (flags.unrealisticSpeed) score += 20;
  if (flags.singleAxisMotion) score += 20;
  if (flags.microMovements) score += 20;
  if (flags.volumeSpike) score += 20;
  if (flags.noOrientationChange) score += 20;
  return Math.min(score, 100);
}

export function getAverageAxisDistribution(tracker: SessionSuspicionTracker): { x: number; y: number; z: number } {
  const c = tracker.axisDistributionCount;
  if (c === 0) return { x: 33, y: 33, z: 34 };
  const total = tracker.axisDistribution.x + tracker.axisDistribution.y + tracker.axisDistribution.z;
  if (total === 0) return { x: 33, y: 33, z: 34 };
  return {
    x: Math.round((tracker.axisDistribution.x / total) * 100),
    y: Math.round((tracker.axisDistribution.y / total) * 100),
    z: Math.round((tracker.axisDistribution.z / total) * 100),
  };
}

export function getAverageTempo(tracker: SessionSuspicionTracker): number {
  if (tracker.repTempos.length === 0) return 0;
  return Math.round(tracker.repTempos.reduce((a, b) => a + b, 0) / tracker.repTempos.length);
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
 * Also records suspicious activity into the session tracker.
 */
export function validateRep(
  exercise: ExerciseType,
  state: RepCycleState,
  currentLandmarks: LandmarkPoint[],
  suspicionTracker?: SessionSuspicionTracker,
): boolean {
  if (exercise === 'plank') return true;

  const now = Date.now();

  // 1. Minimum rep duration check
  const minDuration = MIN_REP_DURATION_MS[exercise] || 700;
  if (state.downStartTime !== null) {
    const repDuration = now - state.downStartTime;
    if (repDuration < minDuration) {
      if (suspicionTracker) suspicionTracker.speedViolations++;
      return false;
    }
    // Record tempo
    if (suspicionTracker) {
      suspicionTracker.repTempos.push(repDuration);
    }
  }

  // 2. Max reps/sec rate limiting
  const maxRps = MAX_REPS_PER_SEC[exercise] || 1.0;
  const minIntervalMs = 1000 / maxRps;
  if (state.lastRepTime > 0 && (now - state.lastRepTime) < minIntervalMs) {
    if (suspicionTracker) suspicionTracker.speedViolations++;
    return false;
  }

  // 3. Minimum amplitude check
  if (state.downLandmarks && currentLandmarks.length > 0) {
    const amplitude = computeAmplitude(state.downLandmarks, currentLandmarks);
    if (amplitude < MIN_AMPLITUDE) {
      if (suspicionTracker) {
        suspicionTracker.microMovementStreak++;
      }
      return false;
    } else {
      if (suspicionTracker) suspicionTracker.microMovementStreak = 0;
    }
  }

  // 4. Multi-axis motion check
  if (state.downLandmarks && currentLandmarks.length > 0) {
    const axisInfo = getAxisDistribution(state.downLandmarks, currentLandmarks);
    if (suspicionTracker) {
      suspicionTracker.axisDistribution.x += axisInfo.x;
      suspicionTracker.axisDistribution.y += axisInfo.y;
      suspicionTracker.axisDistribution.z += axisInfo.z;
      suspicionTracker.axisDistributionCount++;
    }
    if (isSingleAxisMotion(state.downLandmarks, currentLandmarks)) {
      if (suspicionTracker) suspicionTracker.singleAxisCount++;
      return false;
    }
  }

  // 5. Rep accepted — update state
  state.lastRepTime = now;
  state.recentRepTimestamps.push(now);
  if (state.recentRepTimestamps.length > 10) {
    state.recentRepTimestamps.shift();
  }

  // Track LP timestamp for volume spike detection
  if (suspicionTracker) {
    suspicionTracker.totalReps++;
    suspicionTracker.lpTimestamps.push({ time: now, lp: 1 });
  }

  return true;
}

/** Record orientation sample (shoulder-to-hip angle). */
export function recordOrientationSample(tracker: SessionSuspicionTracker, landmarks: LandmarkPoint[]) {
  if (landmarks.length < 25) return;
  const shoulder = landmarks[11];
  const hip = landmarks[23];
  if (!shoulder || !hip) return;
  const angle = Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x) * (180 / Math.PI);
  tracker.orientationSamples.push(angle);
}

export function recordDownPhase(state: RepCycleState, landmarks: LandmarkPoint[]) {
  state.downStartTime = Date.now();
  state.downLandmarks = landmarks.slice(0, 33).map(l => ({ x: l.x, y: l.y, z: l.z }));
}

export function recordUpPhase(state: RepCycleState, landmarks: LandmarkPoint[]) {
  state.upLandmarks = landmarks.slice(0, 33).map(l => ({ x: l.x, y: l.y, z: l.z }));
}

function computeAmplitude(landmarksA: LandmarkPoint[], landmarksB: LandmarkPoint[]): number {
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

function getAxisDistribution(landmarksA: LandmarkPoint[], landmarksB: LandmarkPoint[]): { x: number; y: number; z: number } {
  const keyIndices = [11, 12, 13, 14, 23, 24, 25, 26];
  let totalDx = 0, totalDy = 0, totalDz = 0;

  for (const idx of keyIndices) {
    if (idx < landmarksA.length && idx < landmarksB.length) {
      totalDx += Math.abs(landmarksB[idx].x - landmarksA[idx].x);
      totalDy += Math.abs(landmarksB[idx].y - landmarksA[idx].y);
      totalDz += Math.abs((landmarksB[idx].z || 0) - (landmarksA[idx].z || 0));
    }
  }

  return { x: totalDx, y: totalDy, z: totalDz };
}

function isSingleAxisMotion(landmarksA: LandmarkPoint[], landmarksB: LandmarkPoint[]): boolean {
  const { x: totalDx, y: totalDy, z: totalDz } = getAxisDistribution(landmarksA, landmarksB);
  const total = totalDx + totalDy + totalDz;
  if (total < 0.001) return true;
  return (totalDx / total > 0.8) || (totalDy / total > 0.8) || (totalDz / total > 0.8);
}
