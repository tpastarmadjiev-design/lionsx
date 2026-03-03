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

function detectBenchPressInternal(pose: Landmark[], state: BenchPressState): { phase: Phase; feedback: string } {
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
    feedback = 'Lower';
  } else if (state.phase === 'down' && confirmedPhase === 'up') {
    feedback = 'Push';
    // Count per-arm reps
    if (leftAtTop) state.leftReps++;
    if (rightAtTop) state.rightReps++;
    // A full rep is the min of both arms
    const minReps = Math.min(state.leftReps, state.rightReps);
    if (minReps > 0) {
      feedback = 'Rep Completed!';
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
  const { phase } = detectBenchPressInternal(pose, _benchPressState);
  return phase;
}

export function getBenchPressFeedback(): string {
  return _benchPressState.feedback;
}

export function resetBenchPressState() {
  Object.assign(_benchPressState, createBenchPressState());
}

export function detectChestPressPhaseSmoothed(pose: Landmark[]): Phase {
  const { phase } = detectBenchPressInternal(pose, _chestPressState);
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
    _rowState.feedback = 'Pull!';
    if (leftAtTop) _rowState.leftReps++;
    if (rightAtTop) _rowState.rightReps++;
    const minReps = Math.min(_rowState.leftReps, _rowState.rightReps);
    if (minReps > 0) {
      _rowState.feedback = 'Rep Completed!';
    }
  } else if (_rowState.phase === 'up' && confirmed === 'down') {
    _rowState.feedback = 'Lower';
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
    _curlState.feedback = 'Curl!';
    if (leftAtTop) _curlState.leftReps++;
    if (rightAtTop) _curlState.rightReps++;
    const minReps = Math.min(_curlState.leftReps, _curlState.rightReps);
    if (minReps > 0) {
      _curlState.feedback = 'Rep Completed!';
    }
  } else if (_curlState.phase === 'up' && confirmed === 'down') {
    _curlState.feedback = 'Lower';
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
    _frontRaiseState.feedback = 'Raise!';
    if (leftUp) _frontRaiseState.leftReps++;
    if (rightUp) _frontRaiseState.rightReps++;
    const minReps = Math.min(_frontRaiseState.leftReps, _frontRaiseState.rightReps);
    if (minReps > 0 || _frontRaiseState.leftReps > 0 || _frontRaiseState.rightReps > 0) {
      _frontRaiseState.feedback = 'Rep Completed!';
    }
  } else if (_frontRaiseState.phase === 'up' && confirmed === 'down') {
    _frontRaiseState.feedback = 'Lower';
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
    _gobletSquatState.feedback = 'Rep Completed!';
  } else if (_gobletSquatState.phase === 'up' && confirmed === 'down') {
    _gobletSquatState.feedback = 'Squat!';
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
    _hammerCurlState.feedback = 'Curl!';
    if (leftUp) _hammerCurlState.leftReps++;
    if (rightUp) _hammerCurlState.rightReps++;
    if (_hammerCurlState.leftReps > 0 || _hammerCurlState.rightReps > 0) {
      _hammerCurlState.feedback = 'Rep Completed!';
    }
  } else if (_hammerCurlState.phase === 'up' && confirmed === 'down') {
    _hammerCurlState.feedback = 'Lower';
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
    _lateralRaiseState.feedback = 'Raise!';
    if (leftUp) _lateralRaiseState.leftReps++;
    if (rightUp) _lateralRaiseState.rightReps++;
    if (_lateralRaiseState.leftReps > 0 || _lateralRaiseState.rightReps > 0) {
      _lateralRaiseState.feedback = 'Rep Completed!';
    }
  } else if (_lateralRaiseState.phase === 'up' && confirmed === 'down') {
    _lateralRaiseState.feedback = 'Lower';
  }

  if (confirmed !== 'neutral') _lateralRaiseState.phase = confirmed;
  return confirmed;
}

export function getLateralRaiseFeedback(): string { return _lateralRaiseState.feedback; }
export function resetLateralRaiseState() { Object.assign(_lateralRaiseState, createLateralRaiseState()); }

// ─── Master feedback getter ───
export type SmoothedExercise = 'bench-press' | 'dumbbell-chest-press' | 'dumbbell-bent-over-rows' | 'dumbbell-bicep-curls'
  | 'dumbbell-front-raises' | 'dumbbell-goblet-squat' | 'dumbbell-hammer-curls' | 'dumbbell-lateral-raises';

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
  }
}

/** List of exercises that use smoothed detectors */
export const SMOOTHED_EXERCISES: string[] = [
  'bench-press', 'dumbbell-chest-press', 'dumbbell-bent-over-rows', 'dumbbell-bicep-curls',
  'dumbbell-front-raises', 'dumbbell-goblet-squat', 'dumbbell-hammer-curls', 'dumbbell-lateral-raises',
];
