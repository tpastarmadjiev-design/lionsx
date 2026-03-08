import { describe, it, expect } from 'vitest';
import { createSessionSuspicionTracker, recordRep, getSuspicionFlags, computeSuspicionScore } from '@/lib/antiCheat';
import { detectSquatPhase, detectPushUpPhase, detectBicepCurlPhase } from '@/lib/exerciseDetectors';

describe('Session tracking', () => {
  it('records reps correctly', () => {
    const tracker = createSessionSuspicionTracker();
    expect(tracker.totalReps).toBe(0);
    recordRep(tracker);
    recordRep(tracker);
    expect(tracker.totalReps).toBe(2);
    expect(tracker.lpTimestamps.length).toBe(2);
  });

  it('suspicion flags are always clean (blocking removed)', () => {
    const tracker = createSessionSuspicionTracker();
    const flags = getSuspicionFlags(tracker);
    expect(computeSuspicionScore(flags)).toBe(0);
  });
});

describe('Exercise detectors return neutral for empty input', () => {
  it('squat returns neutral for empty pose', () => {
    expect(detectSquatPhase([])).toBe('neutral');
  });
  it('push-up returns neutral for empty pose', () => {
    expect(detectPushUpPhase([])).toBe('neutral');
  });
  it('bicep curl returns neutral for empty pose', () => {
    expect(detectBicepCurlPhase([])).toBe('neutral');
  });
});
