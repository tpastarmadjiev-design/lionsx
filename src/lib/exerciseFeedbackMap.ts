/**
 * Centralized feedback mapping for all exercises.
 * Feedback is purely visual guidance — does NOT affect detection logic.
 */

export type FeedbackPhase = 'DOWN' | 'UP' | 'ACTION' | 'HOLD' | 'GOOD' | 'REP_COMPLETE' | 'OPEN' | 'CLOSE';

interface ExerciseFeedback {
  DOWN?: string;
  UP?: string;
  ACTION?: string;
  HOLD?: string;
  GOOD?: string;
  REP_COMPLETE?: string;
  OPEN?: string;
  CLOSE?: string;
}

const DEFAULTS: Record<FeedbackPhase, string> = {
  UP: 'Up!',
  DOWN: 'Lower',
  ACTION: 'Go!',
  HOLD: 'Hold!',
  GOOD: 'Great!',
  REP_COMPLETE: 'Rep Completed!',
  OPEN: 'Open!',
  CLOSE: 'Close!',
};

export const exerciseFeedbackMap: Record<string, ExerciseFeedback> = {
  // ── Push exercises ──
  'push-ups': {
    DOWN: 'Lower chest',
    UP: 'Push up',
    REP_COMPLETE: 'Rep Completed!',
  },
  'diamond-push-ups': {
    DOWN: 'Lower chest',
    UP: 'Push up',
    REP_COMPLETE: 'Rep Completed!',
  },
  'pike-push-ups': {
    DOWN: 'Lower head',
    UP: 'Push up',
    REP_COMPLETE: 'Rep Completed!',
  },

  // ── Leg exercises ──
  'squats': {
    DOWN: 'Sit down',
    UP: 'Stand up',
    REP_COMPLETE: 'Rep Completed!',
  },
  'lunges': {
    DOWN: 'Step down',
    UP: 'Push up',
    REP_COMPLETE: 'Rep Completed!',
  },
  'calf-raises': {
    UP: 'Rise up',
    DOWN: 'Lower heels',
    REP_COMPLETE: 'Rep Completed!',
  },

  // ── Cardio exercises ──
  'burpees': {
    DOWN: 'Down!',
    ACTION: 'Jump!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'mountain-climbers': {
    ACTION: 'Drive knees!',
    DOWN: 'Back!',
    REP_COMPLETE: 'Keep going!',
  },
  'jumping-jacks': {
    OPEN: 'Open!',
    CLOSE: 'Close!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'high-knees': {
    ACTION: 'Lift knees!',
    DOWN: 'Switch!',
    REP_COMPLETE: 'Keep going!',
  },
  'jump-rope': {
    ACTION: 'Jump!',
    REP_COMPLETE: 'Nice!',
  },
  'jumps': {
    ACTION: 'Jump!',
    REP_COMPLETE: 'Rep Completed!',
  },

  // ── Core exercises ──
  'sit-ups': {
    UP: 'Sit up!',
    DOWN: 'Lower back',
    REP_COMPLETE: 'Rep Completed!',
  },

  // ── Timed holds ──
  'plank': {
    HOLD: 'Hold!',
    GOOD: 'Great!',
  },
  'wall-sit': {
    HOLD: 'Hold position',
    GOOD: 'Strong!',
  },

  // ── Stretches / Mobility ──
  'cat-cow-stretch': {
    ACTION: 'Flow!',
    REP_COMPLETE: 'Nice stretch!',
  },
  'cobra-stretch': {
    UP: 'Lift chest!',
    DOWN: 'Lower!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'deep-squat-hold': {
    HOLD: 'Hold squat',
    GOOD: 'Great depth!',
  },
  'hip-circles': {
    ACTION: 'Circle hips',
    REP_COMPLETE: 'Nice!',
  },
  'shoulder-stretch-hold': {
    HOLD: 'Hold stretch',
    GOOD: 'Relax shoulders',
  },
  'toe-touches': {
    DOWN: 'Reach down',
    UP: 'Stand tall',
    REP_COMPLETE: 'Rep Completed!',
  },

  // ── Dumbbell exercises ──
  'bench-press': {
    DOWN: 'Lower',
    UP: 'Push',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-chest-press': {
    DOWN: 'Lower',
    UP: 'Press',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-bent-over-rows': {
    DOWN: 'Lower',
    UP: 'Pull!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-bicep-curls': {
    DOWN: 'Lower',
    UP: 'Curl!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-front-raises': {
    DOWN: 'Lower',
    UP: 'Raise!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-goblet-squat': {
    DOWN: 'Squat!',
    UP: 'Stand',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-hammer-curls': {
    DOWN: 'Lower',
    UP: 'Curl!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-lateral-raises': {
    DOWN: 'Lower',
    UP: 'Raise!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-romanian-deadlift': {
    DOWN: 'Lower',
    UP: 'Lift',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-shoulder-press': {
    DOWN: 'Lower',
    UP: 'Press!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-tricep-overhead-extension': {
    DOWN: 'Lower',
    UP: 'Extend',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-punches': {
    UP: 'Punch!',
    DOWN: 'Reset!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-thrusters': {
    DOWN: 'Squat!',
    UP: 'Press!',
    REP_COMPLETE: 'Rep Completed!',
  },
  'dumbbell-windmill': {
    DOWN: 'Lower',
    UP: 'Lift',
    REP_COMPLETE: 'Rep Completed!',
  },
};

/**
 * Get the feedback message for a given exercise and phase.
 * Falls back to defaults if the exercise or phase is not mapped.
 */
export function getFeedback(exercise: string, phase: FeedbackPhase): string {
  const map = exerciseFeedbackMap[exercise];
  if (map && map[phase]) return map[phase]!;
  return DEFAULTS[phase];
}
