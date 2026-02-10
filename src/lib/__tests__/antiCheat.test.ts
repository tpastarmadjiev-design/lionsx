import { describe, it, expect, beforeEach } from 'vitest';
import { createRepCycleState, validateRep, recordDownPhase, recordUpPhase } from '@/lib/antiCheat';
import type { ExerciseType } from '@/lib/antiCheat';

function makeLandmarks(yOffset = 0, xOffset = 0, zOffset = 0) {
  return Array.from({ length: 33 }, (_, i) => ({
    x: 0.5 + xOffset + (i % 7) * 0.012,
    y: 0.5 + yOffset + (i % 5) * 0.015,
    z: 0.1 + zOffset + (i % 3) * 0.01,
  }));
}

describe('Anti-cheat rep validation', () => {
  let state: ReturnType<typeof createRepCycleState>;

  beforeEach(() => {
    state = createRepCycleState();
  });

  it('accepts a valid rep with sufficient amplitude and duration', () => {
    const downLandmarks = makeLandmarks(0.1, 0.05, 0.03);
    recordDownPhase(state, downLandmarks);

    // Simulate time passing (>800ms for push-ups)
    state.downStartTime = Date.now() - 1000;

    const upLandmarks = makeLandmarks(-0.1, -0.05, -0.03);
    recordUpPhase(state, upLandmarks);

    const result = validateRep('push-ups', state, upLandmarks);
    expect(result).toBe(true);
  });

  it('rejects a rep that is too fast (under min duration)', () => {
    const downLandmarks = makeLandmarks(0.1, 0.05, 0.03);
    recordDownPhase(state, downLandmarks);

    // downStartTime is just now — way too fast
    const upLandmarks = makeLandmarks(-0.1, -0.05, -0.03);
    const result = validateRep('push-ups', state, upLandmarks);
    expect(result).toBe(false);
  });

  it('rejects reps exceeding max rate', () => {
    const down = makeLandmarks(0.1, 0.05, 0.03);
    const up = makeLandmarks(-0.1, -0.05, -0.03);

    // First rep — valid
    recordDownPhase(state, down);
    state.downStartTime = Date.now() - 1500;
    expect(validateRep('push-ups', state, up)).toBe(true);

    // Second rep immediately after — too fast (rate limit)
    recordDownPhase(state, down);
    state.downStartTime = Date.now() - 1000;
    expect(validateRep('push-ups', state, up)).toBe(false);
  });

  it('rejects movement with insufficient amplitude', () => {
    const downLandmarks = makeLandmarks(0.0, 0.0);
    recordDownPhase(state, downLandmarks);
    state.downStartTime = Date.now() - 2000;

    // Tiny displacement — fake shake
    const upLandmarks = makeLandmarks(0.001, 0.001);
    const result = validateRep('push-ups', state, upLandmarks);
    expect(result).toBe(false);
  });

  it('rejects single-axis motion (Y-only shake)', () => {
    // All movement on Y axis only
    const downLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.3, z: 0.1 }));
    recordDownPhase(state, downLandmarks);
    state.downStartTime = Date.now() - 2000;

    const upLandmarks = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.6, z: 0.1 }));
    const result = validateRep('push-ups', state, upLandmarks);
    expect(result).toBe(false);
  });

  it('plank always passes validation (time-based)', () => {
    expect(validateRep('plank', state, [])).toBe(true);
  });

  it('respects different min durations per exercise', () => {
    const down = makeLandmarks(0.1, 0.05, 0.03);
    const up = makeLandmarks(-0.1, -0.05, -0.03);

    // Pull-ups need 1200ms min
    recordDownPhase(state, down);
    state.downStartTime = Date.now() - 900; // only 900ms
    expect(validateRep('pull-ups', state, up)).toBe(false);

    // Reset and try with enough time
    state = createRepCycleState();
    recordDownPhase(state, down);
    state.downStartTime = Date.now() - 1500;
    expect(validateRep('pull-ups', state, up)).toBe(true);
  });

  it('does not double-count rapid successive reps', () => {
    const down = makeLandmarks(0.1, 0.05, 0.03);
    const up = makeLandmarks(-0.1, -0.05, -0.03);

    recordDownPhase(state, down);
    state.downStartTime = Date.now() - 2000;
    expect(validateRep('sit-ups', state, up)).toBe(true);

    // Immediate second rep
    recordDownPhase(state, down);
    state.downStartTime = Date.now() - 100;
    expect(validateRep('sit-ups', state, up)).toBe(false);
  });
});
