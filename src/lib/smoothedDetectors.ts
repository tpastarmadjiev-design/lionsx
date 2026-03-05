/**
 * Upgraded exercise detectors with frame smoothing and consecutive-frame confirmation.
 * Covers: Bench Press, Dumbbell Chest Press, Dumbbell Bent-over Row, Dumbbell Bicep Curl.
 *
 * Uses standard MediaPipe Pose landmark indices:
 *   LEFT_SHOULDER=11, RIGHT_SHOULDER=12,
 *   LEFT_ELBOW=13, RIGHT_ELBOW=14,
 *   LEFT_WRIST=15, RIGHT_WRIST=16,
 *   LEFT_HIP=23, RIGHT_HIP=24
 */

import { getFeedback } from './exerciseFeedbackMap';

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

type Phase = 'up' | 'down' | 'neutral';

// ─── Shared helpers ───

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

/** Simple ring-buffer moving average */
class SmoothBuffer {
  private buf: number[] = [];
  constructor(private size: number) {}
  push(v: number): number {
    this.buf.push(v);
    if (this.buf.length > this.size) this.buf.shift();
    return this.buf.reduce((a, b) => a + b, 0) / this.buf.length;
  }
  reset() { this.buf = []; }
}

/** Requires a phase to be sustained for N consecutive frames before switching */
class PhaseConfirmer {
  private pending: Phase = 'neutral';
  private count = 0;
  private confirmed: Phase = 'neutral';
  constructor(private required: number = 2) {}

  update(raw: Phase): Phase {
    if (raw === this.pending) {
      this.count++;
    } else {
      this.pending = raw;
      this.count = 1;
    }
    if (this.count >= this.required && raw !== 'neutral') {
      this.confirmed = raw;
    }
    return this.confirmed;
  }
  reset() { this.pending = 'neutral'; this.count = 0; this.confirmed = 'neutral'; }
}

// ─── Body height estimator ───
function estimateBodyHeight(pose: Landmark[]): number {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lHip = pose[23], rHip = pose[24];
  if (!lShoulder || !rShoulder || !lHip || !rHip) return 0.4; // fallback
  const shoulderY = (lShoulder.y + rShoulder.y) / 2;
  const hipY = (lHip.y + rHip.y) / 2;
  // Torso length ≈ 40% of body height, so body_height ≈ torso * 2.5
  return Math.abs(hipY - shoulderY) * 2.5;
}

// ═══════════════════════════════════════════
// BENCH PRESS / DUMBBELL CHEST PRESS
// ═══════════════════════════════════════════

// Landmarks: LEFT_SHOULDER=11, RIGHT_SHOULDER=12, LEFT_ELBOW=13, RIGHT_ELBOW=14
// Logic: TOP = elbow Y ≤ shoulder Y + 0.12 * bodyHeight
//        BOTTOM = elbow Y ≥ shoulder Y + 0.15 * bodyHeight
// Rep cycle: TOP → BOTTOM → TOP (per-arm, use min reps)

interface BenchPressState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

export function createBenchPressState(): BenchPressState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _benchPressState = createBenchPressState();
const _chestPressState = createBenchPressState();

function detectBenchPressInternal(pose: Landmark[], state: BenchPressState, exerciseKey: string): { phase: Phase; feedback: string } {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  if (!lShoulder || !rShoulder || !lElbow || !rElbow) return { phase: 'neutral', feedback: state.feedback };

  const bodyHeight = estimateBodyHeight(pose);
  const topThreshold = 0.12 * bodyHeight;
  const bottomThreshold = 0.15 * bodyHeight;

  // Relative elbow height (positive = elbow below shoulder in screen coords)
  const leftRel = state.leftSmooth.push(lElbow.y - lShoulder.y);
  const rightRel = state.rightSmooth.push(rElbow.y - rShoulder.y);

  // Determine raw phase for each arm
  const leftAtTop = leftRel <= topThreshold;
  const leftAtBottom = leftRel >= bottomThreshold;
  const rightAtTop = rightRel <= topThreshold;
  const rightAtBottom = rightRel >= bottomThreshold;

  let rawPhase: Phase = 'neutral';
  // Both arms should agree (tolerant: either arm at position counts)
  if (leftAtTop || rightAtTop) rawPhase = 'up';
  if (leftAtBottom || rightAtBottom) rawPhase = 'down';

  const confirmedPhase = state.confirmer.update(rawPhase);

  let feedback = state.feedback;
  // Detect transitions
  if (state.phase === 'up' && confirmedPhase === 'down') {
    feedback = getFeedback(exerciseKey, 'DOWN');
  } else if (state.phase === 'down' && confirmedPhase === 'up') {
    feedback = getFeedback(exerciseKey, 'UP');
    if (leftAtTop) state.leftReps++;
    if (rightAtTop) state.rightReps++;
    const minReps = Math.min(state.leftReps, state.rightReps);
    if (minReps > 0) {
      feedback = getFeedback(exerciseKey, 'REP_COMPLETE');
    }
  }

  if (confirmedPhase !== 'neutral') {
    state.phase = confirmedPhase;
  }
  state.feedback = feedback;

  return { phase: confirmedPhase, feedback };
}

// Track total counted reps separately so PoseTracker can use the standard down→up flow
export function detectBenchPressPhaseSmoothed(pose: Landmark[]): Phase {
  const { phase } = detectBenchPressInternal(pose, _benchPressState, 'bench-press');
  return phase;
}

export function getBenchPressFeedback(): string {
  return _benchPressState.feedback;
}

export function resetBenchPressState() {
  Object.assign(_benchPressState, createBenchPressState());
}

export function detectChestPressPhaseSmoothed(pose: Landmark[]): Phase {
  const { phase } = detectBenchPressInternal(pose, _chestPressState, 'dumbbell-chest-press');
  return phase;
}

export function getChestPressFeedback(): string {
  return _chestPressState.feedback;
}

export function resetChestPressState() {
  Object.assign(_chestPressState, createBenchPressState());
}

// ═══════════════════════════════════════════
// DUMBBELL BENT-OVER ROW
// ═══════════════════════════════════════════

// Landmarks: LEFT_SHOULDER=11, RIGHT_SHOULDER=12, LEFT_ELBOW=13, RIGHT_ELBOW=14
// TOP: elbow Y ≤ shoulder Y - 0.05 * bodyHeight (elbows pulled up)
// BOTTOM: elbow Y ≥ shoulder Y + 0.05 * bodyHeight (arms hanging)
// Rep cycle: BOTTOM → TOP → BOTTOM

interface RowState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createRowState(): RowState {
  return {
    leftSmooth: new SmoothBuffer(3),
    rightSmooth: new SmoothBuffer(3),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _rowState = createRowState();

export function detectBentOverRowPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  if (!lShoulder || !rShoulder || !lElbow || !rElbow) return 'neutral';

  const bodyHeight = estimateBodyHeight(pose);
  const threshold = 0.05 * bodyHeight;

  const leftRel = _rowState.leftSmooth.push(lElbow.y - lShoulder.y);
  const rightRel = _rowState.rightSmooth.push(rElbow.y - rShoulder.y);

  // TOP: elbows above shoulders (negative relative = above)
  const leftAtTop = leftRel <= -threshold;
  const rightAtTop = rightRel <= -threshold;
  // BOTTOM: elbows below shoulders
  const leftAtBottom = leftRel >= threshold;
  const rightAtBottom = rightRel >= threshold;

  let rawPhase: Phase = 'neutral';
  if (leftAtTop || rightAtTop) rawPhase = 'up';
  if (leftAtBottom || rightAtBottom) rawPhase = 'down';

  const confirmed = _rowState.confirmer.update(rawPhase);

  // Feedback
  if (_rowState.phase === 'down' && confirmed === 'up') {
    _rowState.feedback = getFeedback('dumbbell-bent-over-rows', 'UP');
    if (leftAtTop) _rowState.leftReps++;
    if (rightAtTop) _rowState.rightReps++;
    const minReps = Math.min(_rowState.leftReps, _rowState.rightReps);
    if (minReps > 0) {
      _rowState.feedback = getFeedback('dumbbell-bent-over-rows', 'REP_COMPLETE');
    }
  } else if (_rowState.phase === 'up' && confirmed === 'down') {
    _rowState.feedback = getFeedback('dumbbell-bent-over-rows', 'DOWN');
  }

  if (confirmed !== 'neutral') _rowState.phase = confirmed;
  return confirmed;
}

export function getBentOverRowFeedback(): string {
  return _rowState.feedback;
}

export function resetBentOverRowState() {
  Object.assign(_rowState, createRowState());
}

// ═══════════════════════════════════════════
// DUMBBELL BICEP CURL
// ═══════════════════════════════════════════

// Landmarks: shoulder(11,12), elbow(13,14), wrist(15,16)
// Angle: shoulder→elbow→wrist
// TOP (curled): angle ≤ 55°
// BOTTOM (extended): angle ≥ 150°
// Rep cycle: BOTTOM → TOP → BOTTOM

interface CurlState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createCurlState(): CurlState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _curlState = createCurlState();

export function detectBicepCurlPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  const lWrist = pose[15], rWrist = pose[16];
  if (!lShoulder || !rShoulder || !lElbow || !rElbow || !lWrist || !rWrist) return 'neutral';

  const leftAngle = _curlState.leftSmooth.push(angleBetween(lShoulder, lElbow, lWrist));
  const rightAngle = _curlState.rightSmooth.push(angleBetween(rShoulder, rElbow, rWrist));

  const leftAtTop = leftAngle <= 55;
  const rightAtTop = rightAngle <= 55;
  const leftAtBottom = leftAngle >= 150;
  const rightAtBottom = rightAngle >= 150;

  let rawPhase: Phase = 'neutral';
  if (leftAtTop || rightAtTop) rawPhase = 'up';
  if (leftAtBottom || rightAtBottom) rawPhase = 'down';

  const confirmed = _curlState.confirmer.update(rawPhase);

  if (_curlState.phase === 'down' && confirmed === 'up') {
    _curlState.feedback = getFeedback('dumbbell-bicep-curls', 'UP');
    if (leftAtTop) _curlState.leftReps++;
    if (rightAtTop) _curlState.rightReps++;
    const minReps = Math.min(_curlState.leftReps, _curlState.rightReps);
    if (minReps > 0) {
      _curlState.feedback = getFeedback('dumbbell-bicep-curls', 'REP_COMPLETE');
    }
  } else if (_curlState.phase === 'up' && confirmed === 'down') {
    _curlState.feedback = getFeedback('dumbbell-bicep-curls', 'DOWN');
  }

  if (confirmed !== 'neutral') _curlState.phase = confirmed;
  return confirmed;
}

export function getBicepCurlFeedback(): string {
  return _curlState.feedback;
}

export function resetBicepCurlState() {
  Object.assign(_curlState, createCurlState());
}

// ═══════════════════════════════════════════
// DUMBBELL FRONT RAISES
// ═══════════════════════════════════════════
// Landmarks: shoulder(11,12), wrist(15,16), hip(23,24)
// UP: wrist.y ≤ shoulder.y - 0.20 * bodyHeight
// DOWN: wrist.y ≥ hipY
// Rep: down → up → down

interface FrontRaiseState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createFrontRaiseState(): FrontRaiseState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _frontRaiseState = createFrontRaiseState();

export function detectFrontRaisePhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lWrist = pose[15], rWrist = pose[16];
  const lHip = pose[23], rHip = pose[24];
  if (!lShoulder || !rShoulder || !lWrist || !rWrist) return 'neutral';

  const bodyHeight = estimateBodyHeight(pose);
  const upThreshold = 0.20 * bodyHeight;
  const hipY = (lHip && rHip) ? (lHip.y + rHip.y) / 2 : (lShoulder.y + 0.35 * bodyHeight);

  const leftRel = _frontRaiseState.leftSmooth.push(lWrist.y - lShoulder.y);
  const rightRel = _frontRaiseState.rightSmooth.push(rWrist.y - rShoulder.y);

  const leftUp = leftRel <= -upThreshold;
  const rightUp = rightRel <= -upThreshold;
  const leftDown = lWrist.y >= hipY;
  const rightDown = rWrist.y >= hipY;

  let rawPhase: Phase = 'neutral';
  if (leftUp || rightUp) rawPhase = 'up';
  if (leftDown || rightDown) rawPhase = 'down';

  const confirmed = _frontRaiseState.confirmer.update(rawPhase);

  if (_frontRaiseState.phase === 'down' && confirmed === 'up') {
    _frontRaiseState.feedback = getFeedback('dumbbell-front-raises', 'UP');
    if (leftUp) _frontRaiseState.leftReps++;
    if (rightUp) _frontRaiseState.rightReps++;
    const minReps = Math.min(_frontRaiseState.leftReps, _frontRaiseState.rightReps);
    if (minReps > 0 || _frontRaiseState.leftReps > 0 || _frontRaiseState.rightReps > 0) {
      _frontRaiseState.feedback = getFeedback('dumbbell-front-raises', 'REP_COMPLETE');
    }
  } else if (_frontRaiseState.phase === 'up' && confirmed === 'down') {
    _frontRaiseState.feedback = getFeedback('dumbbell-front-raises', 'DOWN');
  }

  if (confirmed !== 'neutral') _frontRaiseState.phase = confirmed;
  return confirmed;
}

export function getFrontRaiseFeedback(): string { return _frontRaiseState.feedback; }
export function resetFrontRaiseState() { Object.assign(_frontRaiseState, createFrontRaiseState()); }

// ═══════════════════════════════════════════
// DUMBBELL GOBLET SQUAT
// ═══════════════════════════════════════════
// Landmarks: hip(23,24), knee(25,26)
// DOWN: knee.y increases ≥ 0.20 * baseline hip-knee distance
// UP: knee.y returns near baseline
// Rep: up → down → up

interface GobletSquatState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineLeft: number | null;
  baselineRight: number | null;
  feedback: string;
}

function createGobletSquatState(): GobletSquatState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    baselineLeft: null,
    baselineRight: null,
    feedback: '',
  };
}

const _gobletSquatState = createGobletSquatState();

export function detectGobletSquatPhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24];
  const lKnee = pose[25], rKnee = pose[26];
  if (!lHip || !rHip || !lKnee || !rKnee) return 'neutral';

  const leftDist = _gobletSquatState.leftSmooth.push(lKnee.y - lHip.y);
  const rightDist = _gobletSquatState.rightSmooth.push(rKnee.y - rHip.y);

  // Set baseline on first good reading
  if (_gobletSquatState.baselineLeft === null) _gobletSquatState.baselineLeft = leftDist;
  if (_gobletSquatState.baselineRight === null) _gobletSquatState.baselineRight = rightDist;

  const bl = _gobletSquatState.baselineLeft;
  const br = _gobletSquatState.baselineRight;
  const downThreshold = 0.20;
  const upThreshold = 0.08;

  // DOWN: knee drops significantly (distance shrinks in screen coords since knee comes closer to hip)
  // Actually in squat, hip drops AND knee bends → hip-knee Y distance decreases
  // Use absolute knee Y movement relative to hip
  const leftChange = (leftDist - bl) / Math.max(bl, 0.1);
  const rightChange = (rightDist - br) / Math.max(br, 0.1);

  const isDown = leftChange < -downThreshold || rightChange < -downThreshold;
  const isUp = Math.abs(leftChange) < upThreshold && Math.abs(rightChange) < upThreshold;

  let rawPhase: Phase = 'neutral';
  if (isDown) rawPhase = 'down';
  if (isUp) rawPhase = 'up';

  const confirmed = _gobletSquatState.confirmer.update(rawPhase);

  if (_gobletSquatState.phase === 'down' && confirmed === 'up') {
    _gobletSquatState.feedback = getFeedback('dumbbell-goblet-squat', 'REP_COMPLETE');
  } else if (_gobletSquatState.phase === 'up' && confirmed === 'down') {
    _gobletSquatState.feedback = getFeedback('dumbbell-goblet-squat', 'DOWN');
  }

  // Continuously update baseline toward standing position
  if (confirmed === 'up') {
    _gobletSquatState.baselineLeft = leftDist;
    _gobletSquatState.baselineRight = rightDist;
  }

  if (confirmed !== 'neutral') _gobletSquatState.phase = confirmed;
  return confirmed;
}

export function getGobletSquatFeedback(): string { return _gobletSquatState.feedback; }
export function resetGobletSquatState() { Object.assign(_gobletSquatState, createGobletSquatState()); }

// ═══════════════════════════════════════════
// DUMBBELL HAMMER CURLS (simplified wrist-vs-elbow)
// ═══════════════════════════════════════════
// Landmarks: shoulder(11,12), elbow(13,14), wrist(15,16)
// UP: wrist.y significantly higher than elbow.y
// DOWN: wrist.y below elbow.y
// Rep: down → up → down

interface HammerCurlState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createHammerCurlState(): HammerCurlState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _hammerCurlState = createHammerCurlState();

export function detectHammerCurlPhaseSmoothed(pose: Landmark[]): Phase {
  const lElbow = pose[13], rElbow = pose[14];
  const lWrist = pose[15], rWrist = pose[16];
  if (!lElbow || !rElbow || !lWrist || !rWrist) return 'neutral';

  // Relative: wrist.y - elbow.y (negative = wrist above elbow)
  const leftRel = _hammerCurlState.leftSmooth.push(lWrist.y - lElbow.y);
  const rightRel = _hammerCurlState.rightSmooth.push(rWrist.y - rElbow.y);

  const bodyHeight = estimateBodyHeight(pose);
  const upThresh = -0.04 * bodyHeight; // wrist clearly above elbow
  const downThresh = 0.06 * bodyHeight; // wrist clearly below elbow

  const leftUp = leftRel <= upThresh;
  const rightUp = rightRel <= upThresh;
  const leftDown = leftRel >= downThresh;
  const rightDown = rightRel >= downThresh;

  let rawPhase: Phase = 'neutral';
  if (leftUp || rightUp) rawPhase = 'up';
  if (leftDown || rightDown) rawPhase = 'down';

  const confirmed = _hammerCurlState.confirmer.update(rawPhase);

  if (_hammerCurlState.phase === 'down' && confirmed === 'up') {
    _hammerCurlState.feedback = getFeedback('dumbbell-hammer-curls', 'UP');
    if (leftUp) _hammerCurlState.leftReps++;
    if (rightUp) _hammerCurlState.rightReps++;
    if (_hammerCurlState.leftReps > 0 || _hammerCurlState.rightReps > 0) {
      _hammerCurlState.feedback = getFeedback('dumbbell-hammer-curls', 'REP_COMPLETE');
    }
  } else if (_hammerCurlState.phase === 'up' && confirmed === 'down') {
    _hammerCurlState.feedback = getFeedback('dumbbell-hammer-curls', 'DOWN');
  }

  if (confirmed !== 'neutral') _hammerCurlState.phase = confirmed;
  return confirmed;
}

export function getHammerCurlFeedback(): string { return _hammerCurlState.feedback; }
export function resetHammerCurlState() { Object.assign(_hammerCurlState, createHammerCurlState()); }

// ═══════════════════════════════════════════
// DUMBBELL LATERAL RAISES (smoothed)
// ═══════════════════════════════════════════
// Landmarks: shoulder(11,12), wrist(15,16), hip(23,24)
// UP: wrist.y ≈ shoulder.y (±20%)
// DOWN: wrist.y below hip.y
// Rep: down → up → down

interface LateralRaiseState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createLateralRaiseState(): LateralRaiseState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _lateralRaiseState = createLateralRaiseState();

export function detectLateralRaisePhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lWrist = pose[15], rWrist = pose[16];
  const lHip = pose[23], rHip = pose[24];
  if (!lShoulder || !rShoulder || !lWrist || !rWrist) return 'neutral';

  const bodyHeight = estimateBodyHeight(pose);
  const tolerance = 0.20 * bodyHeight;
  const hipY = (lHip && rHip) ? (lHip.y + rHip.y) / 2 : (lShoulder.y + 0.35 * bodyHeight);

  const leftRel = _lateralRaiseState.leftSmooth.push(lWrist.y - lShoulder.y);
  const rightRel = _lateralRaiseState.rightSmooth.push(rWrist.y - rShoulder.y);

  // UP: wrist near shoulder height
  const leftUp = Math.abs(leftRel) <= tolerance;
  const rightUp = Math.abs(rightRel) <= tolerance;
  // DOWN: wrist below hip
  const leftDown = lWrist.y > hipY;
  const rightDown = rWrist.y > hipY;

  let rawPhase: Phase = 'neutral';
  if (leftUp || rightUp) rawPhase = 'up';
  if (leftDown || rightDown) rawPhase = 'down';

  const confirmed = _lateralRaiseState.confirmer.update(rawPhase);

  if (_lateralRaiseState.phase === 'down' && confirmed === 'up') {
    _lateralRaiseState.feedback = getFeedback('dumbbell-lateral-raises', 'UP');
    if (leftUp) _lateralRaiseState.leftReps++;
    if (rightUp) _lateralRaiseState.rightReps++;
    if (_lateralRaiseState.leftReps > 0 || _lateralRaiseState.rightReps > 0) {
      _lateralRaiseState.feedback = getFeedback('dumbbell-lateral-raises', 'REP_COMPLETE');
    }
  } else if (_lateralRaiseState.phase === 'up' && confirmed === 'down') {
    _lateralRaiseState.feedback = getFeedback('dumbbell-lateral-raises', 'DOWN');
  }

  if (confirmed !== 'neutral') _lateralRaiseState.phase = confirmed;
  return confirmed;
}

export function getLateralRaiseFeedback(): string { return _lateralRaiseState.feedback; }
export function resetLateralRaiseState() { Object.assign(_lateralRaiseState, createLateralRaiseState()); }

// ═══════════════════════════════════════════
// DEADLIFT (hip vertical motion via 23/24)
// ═══════════════════════════════════════════
// Only hips. DOWN: hip.y increases 20% from baseline. UP: returns to baseline.
// Rep: up → down → up. Works with single hip visible.

interface DeadliftState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}

function createDeadliftState(): DeadliftState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    baselineY: null,
    feedback: '',
  };
}

const _deadliftState = createDeadliftState();

export function detectDeadliftPhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24];
  if (!lHip && !rHip) return 'neutral';

  let smoothedY: number;
  if (lHip && rHip) {
    smoothedY = (_deadliftState.leftSmooth.push(lHip.y) + _deadliftState.rightSmooth.push(rHip.y)) / 2;
  } else if (lHip) {
    smoothedY = _deadliftState.leftSmooth.push(lHip.y);
  } else {
    smoothedY = _deadliftState.rightSmooth.push(rHip!.y);
  }

  if (_deadliftState.baselineY === null) {
    _deadliftState.baselineY = smoothedY;
    return 'neutral';
  }

  const bl = _deadliftState.baselineY;
  const downThreshold = bl * 0.20;
  const upThreshold = bl * 0.05;
  const displacement = smoothedY - bl;

  let rawPhase: Phase = 'neutral';
  if (displacement >= downThreshold) rawPhase = 'down';
  if (Math.abs(displacement) <= upThreshold) rawPhase = 'up';

  const confirmed = _deadliftState.confirmer.update(rawPhase);

  if (_deadliftState.phase === 'up' && confirmed === 'down') {
    _deadliftState.feedback = getFeedback('dumbbell-romanian-deadlift', 'DOWN');
  } else if (_deadliftState.phase === 'down' && confirmed === 'up') {
    _deadliftState.feedback = getFeedback('dumbbell-romanian-deadlift', 'REP_COMPLETE');
  }

  if (confirmed === 'up') _deadliftState.baselineY = smoothedY;
  if (confirmed !== 'neutral') _deadliftState.phase = confirmed;
  return confirmed;
}

export function getDeadliftFeedback(): string { return _deadliftState.feedback; }
export function resetDeadliftState() { Object.assign(_deadliftState, createDeadliftState()); }

// ═══════════════════════════════════════════
// DUMBBELL SHOULDER PRESS (wrist-only vertical)
// ═══════════════════════════════════════════
// Only wrists 15/16. UP: wrist.y rises 25% above baseline. DOWN: returns to baseline.
// Works with single wrist. Seated or standing.

interface ShoulderPressState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}

function createShoulderPressState(): ShoulderPressState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    baselineY: null,
    feedback: '',
  };
}

const _shoulderPressState = createShoulderPressState();

export function detectShoulderPressPhaseSmoothed(pose: Landmark[]): Phase {
  const lWrist = pose[15], rWrist = pose[16];
  if (!lWrist && !rWrist) return 'neutral';

  let smoothedY: number;
  if (lWrist && rWrist) {
    smoothedY = (_shoulderPressState.leftSmooth.push(lWrist.y) + _shoulderPressState.rightSmooth.push(rWrist.y)) / 2;
  } else if (lWrist) {
    smoothedY = _shoulderPressState.leftSmooth.push(lWrist.y);
  } else {
    smoothedY = _shoulderPressState.rightSmooth.push(rWrist!.y);
  }

  if (_shoulderPressState.baselineY === null) {
    _shoulderPressState.baselineY = smoothedY;
    return 'neutral';
  }

  const bl = _shoulderPressState.baselineY;
  const upThreshold = bl * 0.25;
  const downThreshold = bl * 0.05;
  const displacement = bl - smoothedY; // positive = wrists went up

  let rawPhase: Phase = 'neutral';
  if (displacement >= upThreshold) rawPhase = 'up';
  if (Math.abs(displacement) <= downThreshold) rawPhase = 'down';

  const confirmed = _shoulderPressState.confirmer.update(rawPhase);

  if (_shoulderPressState.phase === 'down' && confirmed === 'up') {
    _shoulderPressState.feedback = getFeedback('dumbbell-shoulder-press', 'UP');
  } else if (_shoulderPressState.phase === 'up' && confirmed === 'down') {
    _shoulderPressState.feedback = getFeedback('dumbbell-shoulder-press', 'REP_COMPLETE');
  }

  if (confirmed === 'down') _shoulderPressState.baselineY = smoothedY;
  if (confirmed !== 'neutral') _shoulderPressState.phase = confirmed;
  return confirmed;
}

export function getShoulderPressFeedback(): string { return _shoulderPressState.feedback; }
export function resetShoulderPressState() { Object.assign(_shoulderPressState, createShoulderPressState()); }

// ═══════════════════════════════════════════
// DUMBBELL TRICEP OVERHEAD EXTENSION (elbow-only vertical)
// ═══════════════════════════════════════════
// Only elbows 13/14. DOWN: elbow.y increases 15% from baseline. UP: returns.
// Rep: down → up → down. Works with single elbow.

interface TricepExtState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}

function createTricepExtState(): TricepExtState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    baselineY: null,
    feedback: '',
  };
}

const _tricepExtState = createTricepExtState();

export function detectTricepExtPhaseSmoothed(pose: Landmark[]): Phase {
  const lElbow = pose[13], rElbow = pose[14];
  if (!lElbow && !rElbow) return 'neutral';

  let smoothedY: number;
  if (lElbow && rElbow) {
    smoothedY = (_tricepExtState.leftSmooth.push(lElbow.y) + _tricepExtState.rightSmooth.push(rElbow.y)) / 2;
  } else if (lElbow) {
    smoothedY = _tricepExtState.leftSmooth.push(lElbow.y);
  } else {
    smoothedY = _tricepExtState.rightSmooth.push(rElbow!.y);
  }

  if (_tricepExtState.baselineY === null) {
    _tricepExtState.baselineY = smoothedY;
    return 'neutral';
  }

  const bl = _tricepExtState.baselineY;
  const downThreshold = bl * 0.15;
  const upThreshold = bl * 0.05;
  const displacement = smoothedY - bl;

  let rawPhase: Phase = 'neutral';
  if (displacement >= downThreshold) rawPhase = 'down';
  if (Math.abs(displacement) <= upThreshold) rawPhase = 'up';

  const confirmed = _tricepExtState.confirmer.update(rawPhase);

  if (_tricepExtState.phase === 'up' && confirmed === 'down') {
    _tricepExtState.feedback = getFeedback('dumbbell-tricep-overhead-extension', 'DOWN');
  } else if (_tricepExtState.phase === 'down' && confirmed === 'up') {
    _tricepExtState.feedback = getFeedback('dumbbell-tricep-overhead-extension', 'REP_COMPLETE');
  }

  if (confirmed === 'up') _tricepExtState.baselineY = smoothedY;
  if (confirmed !== 'neutral') _tricepExtState.phase = confirmed;
  return confirmed;
}

export function getTricepExtFeedback(): string { return _tricepExtState.feedback; }
export function resetTricepExtState() { Object.assign(_tricepExtState, createTricepExtState()); }

// ═══════════════════════════════════════════
// DUMBBELL PUNCHES (angle + Z-based)
// ═══════════════════════════════════════════
// Landmarks: shoulder(11,12), elbow(13,14), wrist(15,16)
// Punch = elbow angle ≥ 160° AND wrist Z forward ≥ 0.08
// Retracted = elbow angle ≤ 110°
// Rep: bottom → top → bottom per arm; total = min(left, right)

interface PunchState {
  leftAngleSmooth: SmoothBuffer;
  rightAngleSmooth: SmoothBuffer;
  leftZSmooth: SmoothBuffer;
  rightZSmooth: SmoothBuffer;
  confirmerLeft: PhaseConfirmer;
  confirmerRight: PhaseConfirmer;
  phaseLeft: Phase;
  phaseRight: Phase;
  leftReps: number;
  rightReps: number;
  baselineLeftZ: number | null;
  baselineRightZ: number | null;
  feedback: string;
}

function createPunchState(): PunchState {
  return {
    leftAngleSmooth: new SmoothBuffer(4),
    rightAngleSmooth: new SmoothBuffer(4),
    leftZSmooth: new SmoothBuffer(4),
    rightZSmooth: new SmoothBuffer(4),
    confirmerLeft: new PhaseConfirmer(2),
    confirmerRight: new PhaseConfirmer(2),
    phaseLeft: 'neutral',
    phaseRight: 'neutral',
    leftReps: 0,
    rightReps: 0,
    baselineLeftZ: null,
    baselineRightZ: null,
    feedback: '',
  };
}

const _punchState = createPunchState();

export function detectPunchPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  const lWrist = pose[15], rWrist = pose[16];

  let leftValid = !!(lShoulder && lElbow && lWrist);
  let rightValid = !!(rShoulder && rElbow && rWrist);
  if (!leftValid && !rightValid) return 'neutral';

  // Initialize baselines
  if (leftValid && _punchState.baselineLeftZ === null && lWrist.z != null) {
    _punchState.baselineLeftZ = lWrist.z;
  }
  if (rightValid && _punchState.baselineRightZ === null && rWrist.z != null) {
    _punchState.baselineRightZ = rWrist.z;
  }

  // --- Left arm ---
  if (leftValid) {
    const angle = _punchState.leftAngleSmooth.push(angleBetween(lShoulder!, lElbow!, lWrist!));
    const zForward = (_punchState.baselineLeftZ != null && lWrist!.z != null)
      ? _punchState.leftZSmooth.push(_punchState.baselineLeftZ - lWrist!.z)
      : 0;

    let rawLeft: Phase = 'neutral';
    if (angle >= 160 && zForward >= 0.08) rawLeft = 'up'; // punch extended
    if (angle <= 110) rawLeft = 'down'; // retracted

    const confirmedLeft = _punchState.confirmerLeft.update(rawLeft);
    if (_punchState.phaseLeft === 'down' && confirmedLeft === 'up') {
      _punchState.feedback = getFeedback('dumbbell-punches', 'UP');
    } else if (_punchState.phaseLeft === 'up' && confirmedLeft === 'down') {
      _punchState.leftReps++;
      _punchState.feedback = getFeedback('dumbbell-punches', 'DOWN');
    }
    if (confirmedLeft !== 'neutral') _punchState.phaseLeft = confirmedLeft;
  }

  // --- Right arm ---
  if (rightValid) {
    const angle = _punchState.rightAngleSmooth.push(angleBetween(rShoulder!, rElbow!, rWrist!));
    const zForward = (_punchState.baselineRightZ != null && rWrist!.z != null)
      ? _punchState.rightZSmooth.push(_punchState.baselineRightZ - rWrist!.z)
      : 0;

    let rawRight: Phase = 'neutral';
    if (angle >= 160 && zForward >= 0.08) rawRight = 'up';
    if (angle <= 110) rawRight = 'down';

    const confirmedRight = _punchState.confirmerRight.update(rawRight);
    if (_punchState.phaseRight === 'down' && confirmedRight === 'up') {
      _punchState.feedback = getFeedback('dumbbell-punches', 'UP');
    } else if (_punchState.phaseRight === 'up' && confirmedRight === 'down') {
      _punchState.rightReps++;
      _punchState.feedback = getFeedback('dumbbell-punches', 'DOWN');
    }
    if (confirmedRight !== 'neutral') _punchState.phaseRight = confirmedRight;
  }

  // Total reps = min of both arms
  const minReps = Math.min(_punchState.leftReps, _punchState.rightReps);
  if (minReps > 0 && (_punchState.feedback === getFeedback('dumbbell-punches', 'DOWN'))) {
    _punchState.feedback = getFeedback('dumbbell-punches', 'REP_COMPLETE');
  }

  // Return combined phase for PoseTracker compatibility
  if (_punchState.phaseLeft === 'up' || _punchState.phaseRight === 'up') return 'up';
  if (_punchState.phaseLeft === 'down' || _punchState.phaseRight === 'down') return 'down';
  return 'neutral';
}

export function getPunchFeedback(): string { return _punchState.feedback; }
export function resetPunchSmoothedState() { Object.assign(_punchState, createPunchState()); }

// ═══════════════════════════════════════════
// DUMBBELL THRUSTERS (elbow angle only)
// ═══════════════════════════════════════════
// Landmarks: shoulder(11,12), elbow(13,14), wrist(15,16)
// BOTTOM: elbow angle ≤ 110°
// TOP: elbow angle ≥ 165°
// Rep: bottom → top → bottom; total = min(left, right)

interface ThrusterState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createThrusterState(): ThrusterState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _thrusterState = createThrusterState();

export function detectThrusterPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  const lWrist = pose[15], rWrist = pose[16];

  const leftValid = !!(lShoulder && lElbow && lWrist);
  const rightValid = !!(rShoulder && rElbow && rWrist);
  if (!leftValid && !rightValid) return 'neutral';

  let leftAngle = 0, rightAngle = 0;
  if (leftValid) leftAngle = _thrusterState.leftSmooth.push(angleBetween(lShoulder!, lElbow!, lWrist!));
  if (rightValid) rightAngle = _thrusterState.rightSmooth.push(angleBetween(rShoulder!, rElbow!, rWrist!));

  const leftTop = leftValid && leftAngle >= 165;
  const rightTop = rightValid && rightAngle >= 165;
  const leftBottom = leftValid && leftAngle <= 110;
  const rightBottom = rightValid && rightAngle <= 110;

  let rawPhase: Phase = 'neutral';
  if (leftTop || rightTop) rawPhase = 'up';
  if (leftBottom || rightBottom) rawPhase = 'down';

  const confirmed = _thrusterState.confirmer.update(rawPhase);

  if (_thrusterState.phase === 'down' && confirmed === 'up') {
    _thrusterState.feedback = getFeedback('dumbbell-thrusters', 'UP');
    if (leftTop) _thrusterState.leftReps++;
    if (rightTop) _thrusterState.rightReps++;
    const minReps = Math.min(_thrusterState.leftReps, _thrusterState.rightReps);
    if (minReps > 0) {
      _thrusterState.feedback = getFeedback('dumbbell-thrusters', 'REP_COMPLETE');
    }
  } else if (_thrusterState.phase === 'up' && confirmed === 'down') {
    _thrusterState.feedback = getFeedback('dumbbell-thrusters', 'DOWN');
  }

  if (confirmed !== 'neutral') _thrusterState.phase = confirmed;
  return confirmed;
}

export function getThrusterFeedback(): string { return _thrusterState.feedback; }
export function resetThrusterState() { Object.assign(_thrusterState, createThrusterState()); }

// ═══════════════════════════════════════════
// PUSH-UPS (elbow angle, bilateral)
// ═══════════════════════════════════════════
// Landmarks: shoulder(11,12), elbow(13,14), wrist(15,16)
// TOP: elbow angle ≥ 160°   BOTTOM: elbow angle ≤ 95°
// Rep: TOP → BOTTOM → TOP; use min arm reps

interface PushUpSmoothedState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createPushUpSmoothedState(): PushUpSmoothedState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _pushUpSmoothedState = createPushUpSmoothedState();

export function detectPushUpPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  const lWrist = pose[15], rWrist = pose[16];

  const leftValid = !!(lShoulder && lElbow && lWrist);
  const rightValid = !!(rShoulder && rElbow && rWrist);
  if (!leftValid && !rightValid) return 'neutral';

  let leftAngle = 0, rightAngle = 0;
  if (leftValid) leftAngle = _pushUpSmoothedState.leftSmooth.push(angleBetween(lShoulder!, lElbow!, lWrist!));
  if (rightValid) rightAngle = _pushUpSmoothedState.rightSmooth.push(angleBetween(rShoulder!, rElbow!, rWrist!));

  const leftTop = leftValid && leftAngle >= 160;
  const rightTop = rightValid && rightAngle >= 160;
  const leftBottom = leftValid && leftAngle <= 95;
  const rightBottom = rightValid && rightAngle <= 95;

  let rawPhase: Phase = 'neutral';
  if (leftTop || rightTop) rawPhase = 'up';
  if (leftBottom || rightBottom) rawPhase = 'down';

  const confirmed = _pushUpSmoothedState.confirmer.update(rawPhase);

  if (_pushUpSmoothedState.phase === 'up' && confirmed === 'down') {
    _pushUpSmoothedState.feedback = getFeedback('push-ups', 'DOWN');
  } else if (_pushUpSmoothedState.phase === 'down' && confirmed === 'up') {
    _pushUpSmoothedState.feedback = getFeedback('push-ups', 'UP');
    if (leftTop) _pushUpSmoothedState.leftReps++;
    if (rightTop) _pushUpSmoothedState.rightReps++;
    const minReps = Math.min(_pushUpSmoothedState.leftReps, _pushUpSmoothedState.rightReps);
    if (minReps > 0) {
      _pushUpSmoothedState.feedback = getFeedback('push-ups', 'REP_COMPLETE');
    }
  }

  if (confirmed !== 'neutral') _pushUpSmoothedState.phase = confirmed;
  return confirmed;
}

export function getPushUpFeedback(): string { return _pushUpSmoothedState.feedback; }
export function resetPushUpSmoothedState() { Object.assign(_pushUpSmoothedState, createPushUpSmoothedState()); }

// ═══════════════════════════════════════════
// PIKE PUSH-UPS (elbow angle, bilateral)
// ═══════════════════════════════════════════
// Same landmarks as push-ups. BOTTOM: ≤ 100°  TOP: ≥ 160°
// Rep: TOP → BOTTOM → TOP

interface PikePushUpState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}

function createPikePushUpState(): PikePushUpState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    leftReps: 0,
    rightReps: 0,
    feedback: '',
  };
}

const _pikePushUpState = createPikePushUpState();

export function detectPikePushUpPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  const lElbow = pose[13], rElbow = pose[14];
  const lWrist = pose[15], rWrist = pose[16];

  const leftValid = !!(lShoulder && lElbow && lWrist);
  const rightValid = !!(rShoulder && rElbow && rWrist);
  if (!leftValid && !rightValid) return 'neutral';

  let leftAngle = 0, rightAngle = 0;
  if (leftValid) leftAngle = _pikePushUpState.leftSmooth.push(angleBetween(lShoulder!, lElbow!, lWrist!));
  if (rightValid) rightAngle = _pikePushUpState.rightSmooth.push(angleBetween(rShoulder!, rElbow!, rWrist!));

  const leftTop = leftValid && leftAngle >= 160;
  const rightTop = rightValid && rightAngle >= 160;
  const leftBottom = leftValid && leftAngle <= 100;
  const rightBottom = rightValid && rightAngle <= 100;

  let rawPhase: Phase = 'neutral';
  if (leftTop || rightTop) rawPhase = 'up';
  if (leftBottom || rightBottom) rawPhase = 'down';

  const confirmed = _pikePushUpState.confirmer.update(rawPhase);

  if (_pikePushUpState.phase === 'up' && confirmed === 'down') {
    _pikePushUpState.feedback = getFeedback('pike-push-ups', 'DOWN');
  } else if (_pikePushUpState.phase === 'down' && confirmed === 'up') {
    _pikePushUpState.feedback = getFeedback('pike-push-ups', 'UP');
    if (leftTop) _pikePushUpState.leftReps++;
    if (rightTop) _pikePushUpState.rightReps++;
    const minReps = Math.min(_pikePushUpState.leftReps, _pikePushUpState.rightReps);
    if (minReps > 0) {
      _pikePushUpState.feedback = getFeedback('pike-push-ups', 'REP_COMPLETE');
    }
  }

  if (confirmed !== 'neutral') _pikePushUpState.phase = confirmed;
  return confirmed;
}

export function getPikePushUpFeedback(): string { return _pikePushUpState.feedback; }
export function resetPikePushUpState() { Object.assign(_pikePushUpState, createPikePushUpState()); }

// ═══════════════════════════════════════════
// SQUATS (hip vertical drop)
// ═══════════════════════════════════════════
// Landmarks: hip(23,24), knee(25,26)
// BOTTOM: hip drops ≥ 0.12   TOP: hip returns to baseline
// Rep: TOP → BOTTOM → TOP; use averaged hips

interface SquatSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}

function createSquatSmoothedState(): SquatSmoothedState {
  return {
    smooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    baselineY: null,
    feedback: '',
  };
}

const _squatSmoothedState = createSquatSmoothedState();

export function detectSquatPhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24];
  if (!lHip && !rHip) return 'neutral';
  const hipY = lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)!.y;
  const smoothed = _squatSmoothedState.smooth.push(hipY);

  if (_squatSmoothedState.baselineY === null) {
    _squatSmoothedState.baselineY = smoothed;
    return 'neutral';
  }

  const drop = smoothed - _squatSmoothedState.baselineY;

  let rawPhase: Phase = 'neutral';
  if (drop >= 0.12) rawPhase = 'down';
  if (Math.abs(drop) < 0.04) rawPhase = 'up';

  const confirmed = _squatSmoothedState.confirmer.update(rawPhase);

  if (_squatSmoothedState.phase === 'up' && confirmed === 'down') {
    _squatSmoothedState.feedback = getFeedback('squats', 'DOWN');
  } else if (_squatSmoothedState.phase === 'down' && confirmed === 'up') {
    _squatSmoothedState.feedback = getFeedback('squats', 'REP_COMPLETE');
  }

  if (confirmed === 'up') _squatSmoothedState.baselineY = smoothed;
  if (confirmed !== 'neutral') _squatSmoothedState.phase = confirmed;
  return confirmed;
}

export function getSquatFeedback(): string { return _squatSmoothedState.feedback; }
export function resetSquatSmoothedState() { Object.assign(_squatSmoothedState, createSquatSmoothedState()); }

// ═══════════════════════════════════════════
// LUNGES (hip vertical drop)
// ═══════════════════════════════════════════
// Landmarks: hip(23,24), knee(25,26)
// BOTTOM: hip drops ≥ 0.10   TOP: hip returns to baseline
// Rep: TOP → BOTTOM → TOP; use averaged hips

interface LungeSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}

function createLungeSmoothedState(): LungeSmoothedState {
  return {
    smooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    baselineY: null,
    feedback: '',
  };
}

const _lungeSmoothedState = createLungeSmoothedState();

export function detectLungePhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24];
  if (!lHip && !rHip) return 'neutral';
  const hipY = lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)!.y;
  const smoothed = _lungeSmoothedState.smooth.push(hipY);

  if (_lungeSmoothedState.baselineY === null) {
    _lungeSmoothedState.baselineY = smoothed;
    return 'neutral';
  }

  const drop = smoothed - _lungeSmoothedState.baselineY;

  let rawPhase: Phase = 'neutral';
  if (drop >= 0.10) rawPhase = 'down';
  if (Math.abs(drop) < 0.04) rawPhase = 'up';

  const confirmed = _lungeSmoothedState.confirmer.update(rawPhase);

  if (_lungeSmoothedState.phase === 'up' && confirmed === 'down') {
    _lungeSmoothedState.feedback = getFeedback('lunges', 'DOWN');
  } else if (_lungeSmoothedState.phase === 'down' && confirmed === 'up') {
    _lungeSmoothedState.feedback = getFeedback('lunges', 'REP_COMPLETE');
  }

  if (confirmed === 'up') _lungeSmoothedState.baselineY = smoothed;
  if (confirmed !== 'neutral') _lungeSmoothedState.phase = confirmed;
  return confirmed;
}

export function getLungeFeedback(): string { return _lungeSmoothedState.feedback; }
export function resetLungeSmoothedState() { Object.assign(_lungeSmoothedState, createLungeSmoothedState()); }

// ═══════════════════════════════════════════
// CALF RAISES (ankle Y vertical movement)
// ═══════════════════════════════════════════
// Landmarks: ankle(27,28)
// TOP: ankle rises ≥ 0.05 from baseline   BOTTOM: returns to baseline
// Rep: BOTTOM → TOP → BOTTOM; use averaged ankles

interface CalfRaiseState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  reps: number;
  feedback: string;
}

function createCalfRaiseState(): CalfRaiseState {
  return {
    leftSmooth: new SmoothBuffer(4),
    rightSmooth: new SmoothBuffer(4),
    confirmer: new PhaseConfirmer(2),
    phase: 'neutral',
    baselineY: null,
    reps: 0,
    feedback: '',
  };
}

const _calfRaiseState = createCalfRaiseState();

export function detectCalfRaisePhaseSmoothed(pose: Landmark[]): Phase {
  const lAnkle = pose[27], rAnkle = pose[28];
  if (!lAnkle && !rAnkle) return 'neutral';

  let smoothedY: number;
  if (lAnkle && rAnkle) {
    smoothedY = (_calfRaiseState.leftSmooth.push(lAnkle.y) + _calfRaiseState.rightSmooth.push(rAnkle.y)) / 2;
  } else if (lAnkle) {
    smoothedY = _calfRaiseState.leftSmooth.push(lAnkle.y);
  } else {
    smoothedY = _calfRaiseState.rightSmooth.push(rAnkle!.y);
  }

  if (_calfRaiseState.baselineY === null) {
    _calfRaiseState.baselineY = smoothedY;
    return 'neutral';
  }

  const bl = _calfRaiseState.baselineY;
  // In screen coords, up = smaller Y. Rise = baseline - current
  const rise = bl - smoothedY;

  let rawPhase: Phase = 'neutral';
  if (rise >= 0.05) rawPhase = 'up';
  if (Math.abs(rise) < 0.02) rawPhase = 'down';

  const confirmed = _calfRaiseState.confirmer.update(rawPhase);

  if (_calfRaiseState.phase === 'down' && confirmed === 'up') {
    _calfRaiseState.feedback = getFeedback('calf-raises', 'UP');
  } else if (_calfRaiseState.phase === 'up' && confirmed === 'down') {
    _calfRaiseState.reps++;
    _calfRaiseState.feedback = getFeedback('calf-raises', 'REP_COMPLETE');
  }

  // Update baseline when at rest
  if (confirmed === 'down') _calfRaiseState.baselineY = smoothedY;
  if (confirmed !== 'neutral') _calfRaiseState.phase = confirmed;
  return confirmed;
}

export function getCalfRaiseFeedback(): string { return _calfRaiseState.feedback; }
export function resetCalfRaiseState() { Object.assign(_calfRaiseState, createCalfRaiseState()); }

// ═══════════════════════════════════════════
// BURPEES (hip vertical drop + jump)
// ═══════════════════════════════════════════
// Landmarks: hip(23,24)
// BOTTOM: hip drops ≥ 0.15   TOP: hip rises ≥ 0.20 above bottom
// Rep: TOP → BOTTOM → TOP

interface BurpeeSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  bottomY: number | null;
  feedback: string;
}
function createBurpeeSmoothedState(): BurpeeSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineY: null, bottomY: null, feedback: '' };
}
const _burpeeState2 = createBurpeeSmoothedState();

export function detectBurpeePhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24];
  if (!lHip && !rHip) return 'neutral';
  const hipY = lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)!.y;
  const smoothed = _burpeeState2.smooth.push(hipY);
  if (_burpeeState2.baselineY === null) { _burpeeState2.baselineY = smoothed; return 'neutral'; }
  const drop = smoothed - _burpeeState2.baselineY;
  let raw: Phase = 'neutral';
  if (drop >= 0.15) {
    raw = 'down';
    _burpeeState2.bottomY = smoothed;
  }
  // TOP: hip must rise ≥ 0.20 above the bottom position
  if (_burpeeState2.bottomY !== null && (_burpeeState2.bottomY - smoothed) >= 0.20) raw = 'up';
  else if (_burpeeState2.bottomY === null && Math.abs(drop) < 0.05) raw = 'up';
  const confirmed = _burpeeState2.confirmer.update(raw);
  if (_burpeeState2.phase === 'up' && confirmed === 'down') _burpeeState2.feedback = getFeedback('burpees', 'DOWN');
  else if (_burpeeState2.phase === 'down' && confirmed === 'up') {
    _burpeeState2.feedback = getFeedback('burpees', 'REP_COMPLETE');
    _burpeeState2.bottomY = null;
  }
  if (confirmed === 'up') _burpeeState2.baselineY = smoothed;
  if (confirmed !== 'neutral') _burpeeState2.phase = confirmed;
  return confirmed;
}
export function getBurpeeFeedback(): string { return _burpeeState2.feedback; }
export function resetBurpeeSmoothedState() { Object.assign(_burpeeState2, createBurpeeSmoothedState()); }

// ═══════════════════════════════════════════
// MOUNTAIN CLIMBERS (alternating knee X drive)
// ═══════════════════════════════════════════
// Landmarks: knee(25,26)
// FORWARD: knee X moves ≥ 0.08 forward   BACK: returns to baseline
// Count alternating knees; 2 drives = 1 rep

interface MCSmoothedState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineLeftX: number | null;
  baselineRightX: number | null;
  lastLeg: 'left' | 'right' | null;
  halfReps: number;
  feedback: string;
}
function createMCSmoothedState(): MCSmoothedState {
  return { leftSmooth: new SmoothBuffer(4), rightSmooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineLeftX: null, baselineRightX: null, lastLeg: null, halfReps: 0, feedback: '' };
}
const _mcState2 = createMCSmoothedState();

export function detectMountainClimberPhaseSmoothed(pose: Landmark[]): Phase {
  const lKnee = pose[25], rKnee = pose[26];
  if (!lKnee && !rKnee) return 'neutral';

  const leftX = lKnee ? _mcState2.leftSmooth.push(lKnee.x) : null;
  const rightX = rKnee ? _mcState2.rightSmooth.push(rKnee.x) : null;

  // Initialize baselines
  if (leftX !== null && _mcState2.baselineLeftX === null) _mcState2.baselineLeftX = leftX;
  if (rightX !== null && _mcState2.baselineRightX === null) _mcState2.baselineRightX = rightX;

  const leftForward = leftX !== null && _mcState2.baselineLeftX !== null && Math.abs(leftX - _mcState2.baselineLeftX) >= 0.08;
  const rightForward = rightX !== null && _mcState2.baselineRightX !== null && Math.abs(rightX - _mcState2.baselineRightX) >= 0.08;
  const leftBack = leftX !== null && _mcState2.baselineLeftX !== null && Math.abs(leftX - _mcState2.baselineLeftX) < 0.03;
  const rightBack = rightX !== null && _mcState2.baselineRightX !== null && Math.abs(rightX - _mcState2.baselineRightX) < 0.03;

  let raw: Phase = 'neutral';
  if (leftForward || rightForward) raw = 'up';
  if ((leftX === null || leftBack) && (rightX === null || rightBack)) raw = 'down';

  const confirmed = _mcState2.confirmer.update(raw);
  if (_mcState2.phase === 'down' && confirmed === 'up') {
    const currentLeg = leftForward ? 'left' : 'right';
    if (_mcState2.lastLeg && _mcState2.lastLeg !== currentLeg) {
      _mcState2.halfReps++;
      _mcState2.feedback = _mcState2.halfReps % 2 === 0 ? getFeedback('mountain-climbers', 'REP_COMPLETE') : getFeedback('mountain-climbers', 'ACTION');
    } else {
      _mcState2.feedback = getFeedback('mountain-climbers', 'ACTION');
    }
    _mcState2.lastLeg = currentLeg;
  } else if (_mcState2.phase === 'up' && confirmed === 'down') {
    _mcState2.feedback = getFeedback('mountain-climbers', 'DOWN');
    // Update baselines when at rest
    if (leftX !== null) _mcState2.baselineLeftX = leftX;
    if (rightX !== null) _mcState2.baselineRightX = rightX;
  }
  if (confirmed !== 'neutral') _mcState2.phase = confirmed;
  return confirmed;
}
export function getMountainClimberFeedback(): string { return _mcState2.feedback; }
export function resetMCSmoothedState() { Object.assign(_mcState2, createMCSmoothedState()); }

// ═══════════════════════════════════════════
// JUMPING JACKS (ankle horizontal spread)
// ═══════════════════════════════════════════
// Landmarks: ankle(27,28)
// OPEN: ankles separate ≥ 0.18   CLOSED: ankles return to baseline
// Rep: CLOSED → OPEN → CLOSED

interface JJSmoothedState {
  ankleSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineDist: number | null;
  feedback: string;
}
function createJJSmoothedState(): JJSmoothedState {
  return { ankleSmooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineDist: null, feedback: '' };
}
const _jjState2 = createJJSmoothedState();

export function detectJumpingJackPhaseSmoothed(pose: Landmark[]): Phase {
  const lAnkle = pose[27], rAnkle = pose[28];
  if (!lAnkle || !rAnkle) return 'neutral';
  const ankleDist = _jjState2.ankleSmooth.push(Math.abs(lAnkle.x - rAnkle.x));

  if (_jjState2.baselineDist === null) { _jjState2.baselineDist = ankleDist; return 'neutral'; }

  let raw: Phase = 'neutral';
  if (ankleDist >= 0.18) raw = 'up';
  if (ankleDist < 0.08) raw = 'down';
  const confirmed = _jjState2.confirmer.update(raw);
  if (_jjState2.phase === 'down' && confirmed === 'up') _jjState2.feedback = getFeedback('jumping-jacks', 'OPEN');
  else if (_jjState2.phase === 'up' && confirmed === 'down') _jjState2.feedback = getFeedback('jumping-jacks', 'REP_COMPLETE');
  if (confirmed === 'down') _jjState2.baselineDist = ankleDist;
  if (confirmed !== 'neutral') _jjState2.phase = confirmed;
  return confirmed;
}
export function getJumpingJackFeedback(): string { return _jjState2.feedback; }
export function resetJJSmoothedState() { Object.assign(_jjState2, createJJSmoothedState()); }

// ═══════════════════════════════════════════
// HIGH KNEES (alternating knee lifts)
// ═══════════════════════════════════════════

interface HKSmoothedState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  lastLeg: 'left' | 'right' | null;
  halfReps: number;
  feedback: string;
}
function createHKSmoothedState(): HKSmoothedState {
  return { leftSmooth: new SmoothBuffer(4), rightSmooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', lastLeg: null, halfReps: 0, feedback: '' };
}
const _hkState2 = createHKSmoothedState();

export function detectHighKneePhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24], lKnee = pose[25], rKnee = pose[26];
  if ((!lHip || !lKnee) && (!rHip || !rKnee)) return 'neutral';
  const leftRel = (lHip && lKnee) ? _hkState2.leftSmooth.push(lKnee.y - lHip.y) : 999;
  const rightRel = (rHip && rKnee) ? _hkState2.rightSmooth.push(rKnee.y - rHip.y) : 999;
  const leftLifted = leftRel < 0.08;
  const rightLifted = rightRel < 0.08;
  let raw: Phase = 'neutral';
  if (leftLifted || rightLifted) raw = 'up';
  if (!leftLifted && !rightLifted) raw = 'down';
  const confirmed = _hkState2.confirmer.update(raw);
  if (_hkState2.phase === 'down' && confirmed === 'up') {
    const currentLeg = leftLifted ? 'left' : 'right';
    if (_hkState2.lastLeg && _hkState2.lastLeg !== currentLeg) {
      _hkState2.halfReps++;
      _hkState2.feedback = _hkState2.halfReps % 2 === 0 ? getFeedback('high-knees', 'REP_COMPLETE') : getFeedback('high-knees', 'DOWN');
    } else {
      _hkState2.feedback = getFeedback('high-knees', 'ACTION');
    }
    _hkState2.lastLeg = currentLeg;
  }
  if (confirmed !== 'neutral') _hkState2.phase = confirmed;
  return confirmed;
}
export function getHighKneeFeedback(): string { return _hkState2.feedback; }
export function resetHKSmoothedState() { Object.assign(_hkState2, createHKSmoothedState()); }

// ═══════════════════════════════════════════
// JUMP ROPE (ankle vertical jumps)
// ═══════════════════════════════════════════

interface JRSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}
function createJRSmoothedState(): JRSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineY: null, feedback: '' };
}
const _jrState2 = createJRSmoothedState();

export function detectJumpRopePhaseSmoothed(pose: Landmark[]): Phase {
  const lAnkle = pose[27], rAnkle = pose[28];
  if (!lAnkle && !rAnkle) return 'neutral';
  const ankleY = lAnkle && rAnkle ? (lAnkle.y + rAnkle.y) / 2 : (lAnkle || rAnkle)!.y;
  const smoothed = _jrState2.smooth.push(ankleY);
  if (_jrState2.baselineY === null) { _jrState2.baselineY = smoothed; return 'neutral'; }
  const rise = _jrState2.baselineY - smoothed;
  let raw: Phase = 'neutral';
  if (rise >= 0.03) raw = 'up';
  if (Math.abs(rise) < 0.01) raw = 'down';
  const confirmed = _jrState2.confirmer.update(raw);
  if (_jrState2.phase === 'down' && confirmed === 'up') _jrState2.feedback = getFeedback('jump-rope', 'ACTION');
  else if (_jrState2.phase === 'up' && confirmed === 'down') _jrState2.feedback = getFeedback('jump-rope', 'REP_COMPLETE');
  if (confirmed === 'down') _jrState2.baselineY = smoothed;
  if (confirmed !== 'neutral') _jrState2.phase = confirmed;
  return confirmed;
}
export function getJumpRopeFeedback(): string { return _jrState2.feedback; }
export function resetJRSmoothedState() { Object.assign(_jrState2, createJRSmoothedState()); }

// ═══════════════════════════════════════════
// JUMPS (hip vertical jump)
// ═══════════════════════════════════════════

interface JumpSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}
function createJumpSmoothedState(): JumpSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineY: null, feedback: '' };
}
const _jumpState2 = createJumpSmoothedState();

export function detectJumpPhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24];
  if (!lHip && !rHip) return 'neutral';
  const hipY = lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)!.y;
  const smoothed = _jumpState2.smooth.push(hipY);
  if (_jumpState2.baselineY === null) { _jumpState2.baselineY = smoothed; return 'neutral'; }
  const rise = _jumpState2.baselineY - smoothed;
  let raw: Phase = 'neutral';
  if (rise >= 0.20) raw = 'up';
  if (Math.abs(rise) < 0.04) { raw = 'down'; _jumpState2.baselineY = smoothed; }
  const confirmed = _jumpState2.confirmer.update(raw);
  if (_jumpState2.phase === 'down' && confirmed === 'up') _jumpState2.feedback = getFeedback('jumps', 'ACTION');
  else if (_jumpState2.phase === 'up' && confirmed === 'down') _jumpState2.feedback = getFeedback('jumps', 'REP_COMPLETE');
  if (confirmed !== 'neutral') _jumpState2.phase = confirmed;
  return confirmed;
}
export function getJumpFeedback(): string { return _jumpState2.feedback; }
export function resetJumpSmoothedState() { Object.assign(_jumpState2, createJumpSmoothedState()); }

// ═══════════════════════════════════════════
// SIT-UPS (shoulder-hip distance)
// ═══════════════════════════════════════════

interface SitUpSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineY: number | null;
  feedback: string;
}
function createSitUpSmoothedState(): SitUpSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineY: null, feedback: '' };
}
const _sitUpState2 = createSitUpSmoothedState();

export function detectSitUpPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  if (!lShoulder && !rShoulder) return 'neutral';
  const shoulderY = lShoulder && rShoulder ? (lShoulder.y + rShoulder.y) / 2 : (lShoulder || rShoulder)!.y;
  const smoothed = _sitUpState2.smooth.push(shoulderY);
  if (_sitUpState2.baselineY === null) { _sitUpState2.baselineY = smoothed; return 'neutral'; }
  const rise = _sitUpState2.baselineY - smoothed;
  let raw: Phase = 'neutral';
  if (rise >= 0.15) raw = 'up';
  if (Math.abs(rise) < 0.04) { raw = 'down'; _sitUpState2.baselineY = smoothed; }
  const confirmed = _sitUpState2.confirmer.update(raw);
  if (_sitUpState2.phase === 'down' && confirmed === 'up') _sitUpState2.feedback = getFeedback('sit-ups', 'UP');
  else if (_sitUpState2.phase === 'up' && confirmed === 'down') _sitUpState2.feedback = getFeedback('sit-ups', 'REP_COMPLETE');
  if (confirmed !== 'neutral') _sitUpState2.phase = confirmed;
  return confirmed;
}
export function getSitUpFeedback(): string { return _sitUpState2.feedback; }
export function resetSitUpSmoothedState() { Object.assign(_sitUpState2, createSitUpSmoothedState()); }

// ═══════════════════════════════════════════
// CAT-COW STRETCH (hip-shoulder relative)
// ═══════════════════════════════════════════

interface CatCowSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineRel: number | null;
  feedback: string;
}
function createCatCowSmoothedState(): CatCowSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineRel: null, feedback: '' };
}
const _catCowState2 = createCatCowSmoothedState();

export function detectCatCowPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12], lHip = pose[23], rHip = pose[24];
  if ((!lShoulder && !rShoulder) || (!lHip && !rHip)) return 'neutral';
  const shoulderY = lShoulder && rShoulder ? (lShoulder.y + rShoulder.y) / 2 : (lShoulder || rShoulder)!.y;
  const hipY = lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)!.y;
  const rel = _catCowState2.smooth.push(shoulderY - hipY);
  if (_catCowState2.baselineRel === null) { _catCowState2.baselineRel = rel; return 'neutral'; }
  const change = rel - _catCowState2.baselineRel;
  let raw: Phase = 'neutral';
  if (change >= 0.08) raw = 'up';   // CAT: shoulders rise relative to hips
  if (change <= -0.08) raw = 'down'; // COW: shoulders drop relative to hips
  const confirmed = _catCowState2.confirmer.update(raw);
  if (_catCowState2.phase === 'down' && confirmed === 'up') _catCowState2.feedback = getFeedback('cat-cow-stretch', 'ACTION');
  else if (_catCowState2.phase === 'up' && confirmed === 'down') _catCowState2.feedback = getFeedback('cat-cow-stretch', 'REP_COMPLETE');
  if (confirmed !== 'neutral') _catCowState2.phase = confirmed;
  return confirmed;
}
export function getCatCowFeedback(): string { return _catCowState2.feedback; }
export function resetCatCowSmoothedState() { Object.assign(_catCowState2, createCatCowSmoothedState()); }

// ═══════════════════════════════════════════
// TOE TOUCHES (shoulder→ankle distance)
// ═══════════════════════════════════════════

interface ToeTouchSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  feedback: string;
}
function createToeTouchSmoothedState(): ToeTouchSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', feedback: '' };
}
const _toeTouchState2 = createToeTouchSmoothedState();

export function detectToeTouchPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12], lAnkle = pose[27], rAnkle = pose[28];
  if ((!lShoulder && !rShoulder) || (!lAnkle && !rAnkle)) return 'neutral';
  const shoulderY = lShoulder && rShoulder ? (lShoulder.y + rShoulder.y) / 2 : (lShoulder || rShoulder)!.y;
  const ankleY = lAnkle && rAnkle ? (lAnkle.y + rAnkle.y) / 2 : (lAnkle || rAnkle)!.y;
  const dist = _toeTouchState2.smooth.push(Math.abs(ankleY - shoulderY));
  let raw: Phase = 'neutral';
  if (dist < 0.12) raw = 'down';
  if (dist > 0.30) raw = 'up';
  const confirmed = _toeTouchState2.confirmer.update(raw);
  if (_toeTouchState2.phase === 'up' && confirmed === 'down') _toeTouchState2.feedback = getFeedback('toe-touches', 'DOWN');
  else if (_toeTouchState2.phase === 'down' && confirmed === 'up') _toeTouchState2.feedback = getFeedback('toe-touches', 'REP_COMPLETE');
  if (confirmed !== 'neutral') _toeTouchState2.phase = confirmed;
  return confirmed;
}
export function getToeTouchFeedback(): string { return _toeTouchState2.feedback; }
export function resetToeTouchSmoothedState() { Object.assign(_toeTouchState2, createToeTouchSmoothedState()); }

// ═══════════════════════════════════════════
// DIAMOND PUSH-UPS (elbow angle ≤90° bottom)
// ═══════════════════════════════════════════

interface DiamondPushUpState {
  leftSmooth: SmoothBuffer;
  rightSmooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  leftReps: number;
  rightReps: number;
  feedback: string;
}
function createDiamondPushUpState(): DiamondPushUpState {
  return { leftSmooth: new SmoothBuffer(4), rightSmooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', leftReps: 0, rightReps: 0, feedback: '' };
}
const _diamondPushUpState = createDiamondPushUpState();

export function detectDiamondPushUpPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12], lElbow = pose[13], rElbow = pose[14], lWrist = pose[15], rWrist = pose[16];
  const leftValid = !!(lShoulder && lElbow && lWrist);
  const rightValid = !!(rShoulder && rElbow && rWrist);
  if (!leftValid && !rightValid) return 'neutral';
  let leftAngle = 0, rightAngle = 0;
  if (leftValid) leftAngle = _diamondPushUpState.leftSmooth.push(angleBetween(lShoulder!, lElbow!, lWrist!));
  if (rightValid) rightAngle = _diamondPushUpState.rightSmooth.push(angleBetween(rShoulder!, rElbow!, rWrist!));
  const leftTop = leftValid && leftAngle >= 160;
  const rightTop = rightValid && rightAngle >= 160;
  const leftBottom = leftValid && leftAngle <= 90;
  const rightBottom = rightValid && rightAngle <= 90;
  let rawPhase: Phase = 'neutral';
  if (leftTop || rightTop) rawPhase = 'up';
  if (leftBottom || rightBottom) rawPhase = 'down';
  const confirmed = _diamondPushUpState.confirmer.update(rawPhase);
  if (_diamondPushUpState.phase === 'up' && confirmed === 'down') {
    _diamondPushUpState.feedback = getFeedback('diamond-push-ups', 'DOWN');
  } else if (_diamondPushUpState.phase === 'down' && confirmed === 'up') {
    _diamondPushUpState.feedback = getFeedback('diamond-push-ups', 'UP');
    if (leftTop) _diamondPushUpState.leftReps++;
    if (rightTop) _diamondPushUpState.rightReps++;
    if (Math.min(_diamondPushUpState.leftReps, _diamondPushUpState.rightReps) > 0) _diamondPushUpState.feedback = getFeedback('diamond-push-ups', 'REP_COMPLETE');
  }
  if (confirmed !== 'neutral') _diamondPushUpState.phase = confirmed;
  return confirmed;
}
export function getDiamondPushUpFeedback(): string { return _diamondPushUpState.feedback; }
export function resetDiamondPushUpState() { Object.assign(_diamondPushUpState, createDiamondPushUpState()); }

// ═══════════════════════════════════════════
// COBRA STRETCH (shoulder rise, rep-based)
// ═══════════════════════════════════════════

interface CobraSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineRel: number | null;
  feedback: string;
}
function createCobraSmoothedState(): CobraSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineRel: null, feedback: '' };
}
const _cobraState2 = createCobraSmoothedState();

export function detectCobraPhaseSmoothed(pose: Landmark[]): Phase {
  const lShoulder = pose[11], rShoulder = pose[12];
  if (!lShoulder && !rShoulder) return 'neutral';
  const shoulderY = lShoulder && rShoulder ? (lShoulder.y + rShoulder.y) / 2 : (lShoulder || rShoulder)!.y;
  const smoothed = _cobraState2.smooth.push(shoulderY);
  if (_cobraState2.baselineRel === null) { _cobraState2.baselineRel = smoothed; return 'neutral'; }
  const rise = _cobraState2.baselineRel - smoothed;
  let raw: Phase = 'neutral';
  if (rise >= 0.12) raw = 'up';
  if (Math.abs(rise) < 0.04) { raw = 'down'; _cobraState2.baselineRel = smoothed; }
  const confirmed = _cobraState2.confirmer.update(raw);
  if (_cobraState2.phase === 'down' && confirmed === 'up') _cobraState2.feedback = getFeedback('cobra-stretch', 'UP');
  else if (_cobraState2.phase === 'up' && confirmed === 'down') _cobraState2.feedback = getFeedback('cobra-stretch', 'REP_COMPLETE');
  if (confirmed !== 'neutral') _cobraState2.phase = confirmed;
  return confirmed;
}
export function getCobraFeedback(): string { return _cobraState2.feedback; }
export function resetCobraSmoothedState() { Object.assign(_cobraState2, createCobraSmoothedState()); }

// ═══════════════════════════════════════════
// HIP CIRCLES (hip X oscillation as proxy)
// ═══════════════════════════════════════════

interface HipCircleSmoothedState {
  smooth: SmoothBuffer;
  confirmer: PhaseConfirmer;
  phase: Phase;
  baselineX: number | null;
  feedback: string;
}
function createHipCircleSmoothedState(): HipCircleSmoothedState {
  return { smooth: new SmoothBuffer(4), confirmer: new PhaseConfirmer(2), phase: 'neutral', baselineX: null, feedback: '' };
}
const _hipCircleState2 = createHipCircleSmoothedState();

export function detectHipCirclePhaseSmoothed(pose: Landmark[]): Phase {
  const lHip = pose[23], rHip = pose[24];
  if (!lHip && !rHip) return 'neutral';
  const hipX = lHip && rHip ? (lHip.x + rHip.x) / 2 : (lHip || rHip)!.x;
  const smoothed = _hipCircleState2.smooth.push(hipX);
  if (_hipCircleState2.baselineX === null) { _hipCircleState2.baselineX = smoothed; return 'neutral'; }
  const displacement = smoothed - _hipCircleState2.baselineX;
  let raw: Phase = 'neutral';
  if (displacement > 0.04) raw = 'up';
  if (displacement < -0.04) raw = 'down';
  const confirmed = _hipCircleState2.confirmer.update(raw);
  if (_hipCircleState2.phase === 'down' && confirmed === 'up') _hipCircleState2.feedback = getFeedback('hip-circles', 'ACTION');
  else if (_hipCircleState2.phase === 'up' && confirmed === 'down') _hipCircleState2.feedback = getFeedback('hip-circles', 'REP_COMPLETE');
  if (confirmed !== 'neutral') _hipCircleState2.phase = confirmed;
  return confirmed;
}
export function getHipCircleFeedback(): string { return _hipCircleState2.feedback; }
export function resetHipCircleSmoothedState() { Object.assign(_hipCircleState2, createHipCircleSmoothedState()); }

// ═══════════════════════════════════════════
// TIMED HOLD VALIDATORS (smoothed)
// ═══════════════════════════════════════════

const _plankSmooth = new SmoothBuffer(4);
export function isPlankValidSmoothed(pose: Landmark[]): boolean {
  const lShoulder = pose[11], rShoulder = pose[12], lHip = pose[23], rHip = pose[24];
  if ((!lShoulder && !rShoulder) || (!lHip && !rHip)) return false;
  const shoulderY = lShoulder && rShoulder ? (lShoulder.y + rShoulder.y) / 2 : (lShoulder || rShoulder)!.y;
  const hipY = lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)!.y;
  return _plankSmooth.push(Math.abs(shoulderY - hipY)) < 0.15;
}

const _wallSitSmooth = new SmoothBuffer(4);
export function isWallSitValidSmoothed(pose: Landmark[]): boolean {
  const lHip = pose[23], rHip = pose[24], lKnee = pose[25], rKnee = pose[26];
  if ((!lHip || !lKnee) && (!rHip || !rKnee)) return false;
  let angle = 180;
  if (lHip && lKnee) { const lAnkle = pose[27]; if (lAnkle) angle = Math.min(angle, angleBetween(lHip, lKnee, lAnkle)); }
  if (rHip && rKnee) { const rAnkle = pose[28]; if (rAnkle) angle = Math.min(angle, angleBetween(rHip, rKnee, rAnkle)); }
  return _wallSitSmooth.push(angle) <= 110;
}

const _deepSquatSmooth = new SmoothBuffer(4);
export function isDeepSquatHoldValidSmoothed(pose: Landmark[]): boolean {
  const lHip = pose[23], rHip = pose[24], lKnee = pose[25], rKnee = pose[26];
  if ((!lHip || !lKnee) && (!rHip || !rKnee)) return false;
  let angle = 180;
  if (lHip && lKnee) { const lAnkle = pose[27]; if (lAnkle) angle = Math.min(angle, angleBetween(lHip, lKnee, lAnkle)); }
  if (rHip && rKnee) { const rAnkle = pose[28]; if (rAnkle) angle = Math.min(angle, angleBetween(rHip, rKnee, rAnkle)); }
  return _deepSquatSmooth.push(angle) <= 95;
}

const _shoulderStretchSmooth = new SmoothBuffer(4);
export function isShoulderStretchValidSmoothed(pose: Landmark[]): boolean {
  const lShoulder = pose[11], rShoulder = pose[12], lWrist = pose[15], rWrist = pose[16];
  if ((!lShoulder || !lWrist) && (!rShoulder || !rWrist)) return false;
  let crossed = false;
  if (lShoulder && lWrist) crossed = crossed || (lWrist.x > lShoulder.x + 0.1);
  if (rShoulder && rWrist) crossed = crossed || (rWrist.x < rShoulder.x - 0.1);
  return crossed;
}

// ─── Master feedback getter ───
export type SmoothedExercise = 'bench-press' | 'dumbbell-chest-press' | 'dumbbell-bent-over-rows' | 'dumbbell-bicep-curls'
  | 'dumbbell-front-raises' | 'dumbbell-goblet-squat' | 'dumbbell-hammer-curls' | 'dumbbell-lateral-raises'
  | 'dumbbell-romanian-deadlift' | 'dumbbell-shoulder-press' | 'dumbbell-tricep-overhead-extension'
  | 'dumbbell-punches' | 'dumbbell-thrusters'
  | 'push-ups' | 'pike-push-ups' | 'squats' | 'lunges' | 'calf-raises'
  | 'burpees' | 'mountain-climbers' | 'jumping-jacks' | 'high-knees' | 'jump-rope'
  | 'jumps' | 'sit-ups' | 'cat-cow-stretch' | 'toe-touches' | 'diamond-push-ups'
  | 'cobra-stretch' | 'hip-circles';

export function getSmoothedFeedback(exercise: string): string | null {
  switch (exercise) {
    case 'bench-press': return getBenchPressFeedback();
    case 'dumbbell-chest-press': return getChestPressFeedback();
    case 'dumbbell-bent-over-rows': return getBentOverRowFeedback();
    case 'dumbbell-bicep-curls': return getBicepCurlFeedback();
    case 'dumbbell-front-raises': return getFrontRaiseFeedback();
    case 'dumbbell-goblet-squat': return getGobletSquatFeedback();
    case 'dumbbell-hammer-curls': return getHammerCurlFeedback();
    case 'dumbbell-lateral-raises': return getLateralRaiseFeedback();
    case 'dumbbell-romanian-deadlift': return getDeadliftFeedback();
    case 'dumbbell-shoulder-press': return getShoulderPressFeedback();
    case 'dumbbell-tricep-overhead-extension': return getTricepExtFeedback();
    case 'dumbbell-punches': return getPunchFeedback();
    case 'dumbbell-thrusters': return getThrusterFeedback();
    case 'push-ups': return getPushUpFeedback();
    case 'pike-push-ups': return getPikePushUpFeedback();
    case 'squats': return getSquatFeedback();
    case 'lunges': return getLungeFeedback();
    case 'calf-raises': return getCalfRaiseFeedback();
    case 'burpees': return getBurpeeFeedback();
    case 'mountain-climbers': return getMountainClimberFeedback();
    case 'jumping-jacks': return getJumpingJackFeedback();
    case 'high-knees': return getHighKneeFeedback();
    case 'jump-rope': return getJumpRopeFeedback();
    case 'jumps': return getJumpFeedback();
    case 'sit-ups': return getSitUpFeedback();
    case 'cat-cow-stretch': return getCatCowFeedback();
    case 'toe-touches': return getToeTouchFeedback();
    case 'diamond-push-ups': return getDiamondPushUpFeedback();
    case 'cobra-stretch': return getCobraFeedback();
    case 'hip-circles': return getHipCircleFeedback();
    default: return null;
  }
}

export function resetSmoothedDetector(exercise: string) {
  switch (exercise) {
    case 'bench-press': resetBenchPressState(); break;
    case 'dumbbell-chest-press': resetChestPressState(); break;
    case 'dumbbell-bent-over-rows': resetBentOverRowState(); break;
    case 'dumbbell-bicep-curls': resetBicepCurlState(); break;
    case 'dumbbell-front-raises': resetFrontRaiseState(); break;
    case 'dumbbell-goblet-squat': resetGobletSquatState(); break;
    case 'dumbbell-hammer-curls': resetHammerCurlState(); break;
    case 'dumbbell-lateral-raises': resetLateralRaiseState(); break;
    case 'dumbbell-romanian-deadlift': resetDeadliftState(); break;
    case 'dumbbell-shoulder-press': resetShoulderPressState(); break;
    case 'dumbbell-tricep-overhead-extension': resetTricepExtState(); break;
    case 'dumbbell-punches': resetPunchSmoothedState(); break;
    case 'dumbbell-thrusters': resetThrusterState(); break;
    case 'push-ups': resetPushUpSmoothedState(); break;
    case 'pike-push-ups': resetPikePushUpState(); break;
    case 'squats': resetSquatSmoothedState(); break;
    case 'lunges': resetLungeSmoothedState(); break;
    case 'calf-raises': resetCalfRaiseState(); break;
    case 'burpees': resetBurpeeSmoothedState(); break;
    case 'mountain-climbers': resetMCSmoothedState(); break;
    case 'jumping-jacks': resetJJSmoothedState(); break;
    case 'high-knees': resetHKSmoothedState(); break;
    case 'jump-rope': resetJRSmoothedState(); break;
    case 'jumps': resetJumpSmoothedState(); break;
    case 'sit-ups': resetSitUpSmoothedState(); break;
    case 'cat-cow-stretch': resetCatCowSmoothedState(); break;
    case 'toe-touches': resetToeTouchSmoothedState(); break;
    case 'diamond-push-ups': resetDiamondPushUpState(); break;
    case 'cobra-stretch': resetCobraSmoothedState(); break;
    case 'hip-circles': resetHipCircleSmoothedState(); break;
  }
}

/** List of exercises that use smoothed detectors */
export const SMOOTHED_EXERCISES: string[] = [
  'bench-press', 'dumbbell-chest-press', 'dumbbell-bent-over-rows', 'dumbbell-bicep-curls',
  'dumbbell-front-raises', 'dumbbell-goblet-squat', 'dumbbell-hammer-curls', 'dumbbell-lateral-raises',
  'dumbbell-romanian-deadlift', 'dumbbell-shoulder-press', 'dumbbell-tricep-overhead-extension',
  'dumbbell-punches', 'dumbbell-thrusters',
  'push-ups', 'pike-push-ups', 'squats', 'lunges', 'calf-raises',
  'burpees', 'mountain-climbers', 'jumping-jacks', 'high-knees', 'jump-rope',
  'jumps', 'sit-ups', 'cat-cow-stretch', 'toe-touches', 'diamond-push-ups',
  'cobra-stretch', 'hip-circles',
];
