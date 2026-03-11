/**
 * Anti-cheat types and session tracking for LIONSX.
 * Types only + basic session tracking. No rep blocking.
 */

export type ExerciseType = 
  | 'sit-ups' | 'push-ups' | 'jumps' | 'plank' | 'dips' | 'pull-ups' | 'bench-press'
  | 'squats' | 'lunges' | 'pike-push-ups' | 'diamond-push-ups' | 'wall-sit' | 'calf-raises'
  | 'burpees' | 'mountain-climbers' | 'high-knees' | 'jumping-jacks' | 'jump-rope'
  | 'toe-touches' | 'hip-circles' | 'cat-cow-stretch' | 'shoulder-stretch-hold' | 'deep-squat-hold' | 'cobra-stretch'
  | 'dumbbell-bicep-curls' | 'dumbbell-hammer-curls' | 'dumbbell-shoulder-press'
  | 'dumbbell-lateral-raises' | 'dumbbell-front-raises' | 'dumbbell-bent-over-rows'
  | 'dumbbell-goblet-squat' | 'dumbbell-thrusters' | 'dumbbell-chest-press'
  | 'dumbbell-tricep-overhead-extension' | 'dumbbell-punches' | 'dumbbell-romanian-deadlift'
  | 'dumbbell-windmill' | 'lat-pulldown' | 'seated-cable-row';

export interface SessionSuspicionTracker {
  totalReps: number;
  lpTimestamps: { time: number; lp: number }[];
  orientationSamples: number[];
  repTempos: number[];
}

export function createSessionSuspicionTracker(): SessionSuspicionTracker {
  return {
    totalReps: 0,
    lpTimestamps: [],
    orientationSamples: [],
    repTempos: [],
  };
}

export function recordRep(tracker: SessionSuspicionTracker) {
  tracker.totalReps++;
  tracker.lpTimestamps.push({ time: Date.now(), lp: 1 });
}

export interface SuspicionFlags {
  unrealisticSpeed: boolean;
  singleAxisMotion: boolean;
  microMovements: boolean;
  volumeSpike: boolean;
  noOrientationChange: boolean;
}

export function getSuspicionFlags(_tracker: SessionSuspicionTracker): SuspicionFlags {
  return { unrealisticSpeed: false, singleAxisMotion: false, microMovements: false, volumeSpike: false, noOrientationChange: false };
}

export function computeSuspicionScore(_flags: SuspicionFlags): number { return 0; }

export function getAverageAxisDistribution(_tracker: SessionSuspicionTracker): { x: number; y: number; z: number } {
  return { x: 33, y: 33, z: 34 };
}

export function getAverageTempo(tracker: SessionSuspicionTracker): number {
  if (tracker.repTempos.length === 0) return 0;
  return Math.round(tracker.repTempos.reduce((a, b) => a + b, 0) / tracker.repTempos.length);
}
