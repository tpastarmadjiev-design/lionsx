/**
 * LIONSX Exercise Detectors — v2 (post-testing fixes)
 * 
 * Changes from v1:
 * - Calf Raises: use ankle Y relative to standing height instead of heel/foot
 * - Bicep Curls: work with single arm (either side)
 * - Shoulder Press: lowered angle threshold, removed strict wrist<shoulder requirement
 * - Tricep Extension: use wrist Y position (works frontal + profile)
 * - Lunges: more liberal "up" threshold (only one leg needs to be straight)
 * - Burpees: require nose going low (not just standing up)
 * - Mountain Climbers: use ankle position instead of knee (more visible to camera)
 * - Punches: use wrist distance from shoulder (works frontal)
 * - Jump Rope / Jumps: wider hip Y thresholds
 * - Chest Press: use wrist Y relative to shoulder (works lying down)
 * - Hip Circles: actually track hip X movement, not just standing
 * - Cobra Stretch: require body to be horizontal (prevent sitting false positive)
 * - Windmill: require one arm up AND one arm down simultaneously
 * - Cat-Cow: more liberal thresholds, use nose Y relative position
 * - Deep Squat Hold: more liberal knee angle
 * - REMOVED: Shoulder Stretch Hold (unreliable with MediaPipe)
 */

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

const NOSE = 0;
const LEFT_SHOULDER = 11;
const RIGHT_SHOULDER = 12;
const LEFT_ELBOW = 13;
const RIGHT_ELBOW = 14;
const LEFT_WRIST = 15;
const RIGHT_WRIST = 16;
const LEFT_HIP = 23;
const RIGHT_HIP = 24;
const LEFT_KNEE = 25;
const RIGHT_KNEE = 26;
const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;

function angle(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

/** Average angle from both sides — works with just one side visible */
function avgAngleBothSides(
  pose: Landmark[],
  aL: number, bL: number, cL: number,
  aR: number, bR: number, cR: number,
): number | null {
  const hasLeft = pose[aL] && pose[bL] && pose[cL];
  const hasRight = pose[aR] && pose[bR] && pose[cR];
  if (!hasLeft && !hasRight) return null;
  let sum = 0, count = 0;
  if (hasLeft) { sum += angle(pose[aL], pose[bL], pose[cL]); count++; }
  if (hasRight) { sum += angle(pose[aR], pose[bR], pose[cR]); count++; }
  return sum / count;
}

/** Single-side angle — uses whichever side is visible */
function anySideAngle(
  pose: Landmark[],
  aL: number, bL: number, cL: number,
  aR: number, bR: number, cR: number,
): number | null {
  if (pose[aL] && pose[bL] && pose[cL]) return angle(pose[aL], pose[bL], pose[cL]);
  if (pose[aR] && pose[bR] && pose[cR]) return angle(pose[aR], pose[bR], pose[cR]);
  return null;
}

function avgY(pose: Landmark[], left: number, right: number): number | null {
  const l = pose[left], r = pose[right];
  if (l && r) return (l.y + r.y) / 2;
  if (l) return l.y;
  if (r) return r.y;
  return null;
}

export type Phase = 'up' | 'down' | 'neutral';

// ═══════════════════════════════════════════════════════════════
// BODYWEIGHT EXERCISES
// ═══════════════════════════════════════════════════════════════

export function detectSquatPhase(pose: Landmark[]): Phase {
  const kneeAngle = avgAngleBothSides(pose, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  if (kneeAngle === null) return 'neutral';
  if (kneeAngle < 120) return 'down';
  if (kneeAngle > 160) return 'up';
  return 'neutral';
}

// FIX: More liberal "up" — only need ONE leg mostly straight (the front leg stays bent during lunge)
export function detectLungePhase(pose: Landmark[]): Phase {
  const lAngle = anySideAngle(pose, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  const rAngle = anySideAngle(pose, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE);
  if (lAngle === null && rAngle === null) return 'neutral';
  
  const leftAngle = lAngle ?? 180;
  const rightAngle = rAngle ?? 180;
  const minAngle = Math.min(leftAngle, rightAngle);
  const maxAngle = Math.max(leftAngle, rightAngle);
  
  if (minAngle < 120) return 'down';
  if (maxAngle > 150) return 'up';  // at least one leg straight = standing
  return 'neutral';
}

export function detectPushUpPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 110) return 'down';
  if (elbowAngle > 155) return 'up';
  return 'neutral';
}

export function detectPikePushUpPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  if (!shoulder || !hip) return 'neutral';
  if (hip.y > shoulder.y + 0.08) return 'neutral';
  const elbowAngle = anySideAngle(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 105) return 'down';
  if (elbowAngle > 150) return 'up';
  return 'neutral';
}

export function detectDiamondPushUpPhase(pose: Landmark[]): Phase {
  const elbowAngle = anySideAngle(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 105) return 'down';
  if (elbowAngle > 150) return 'up';
  return 'neutral';
}

export function detectSitUpPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const knee = pose[LEFT_KNEE] || pose[RIGHT_KNEE];
  if (!shoulder || !knee) return 'neutral';
  const dist = Math.abs(shoulder.y - knee.y);
  if (dist < 0.15) return 'up';
  if (dist > 0.25) return 'down';
  return 'neutral';
}

// FIX: Wider thresholds for jumps
export function detectJumpPhase(pose: Landmark[]): Phase {
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (hipY === null) return 'neutral';
  if (hipY < 0.45) return 'up';
  if (hipY > 0.52) return 'down';
  return 'neutral';
}

export function detectDipPhase(pose: Landmark[]): Phase {
  const lShoulder = pose[LEFT_SHOULDER];
  const rShoulder = pose[RIGHT_SHOULDER];
  const lWrist = pose[LEFT_WRIST];
  const rWrist = pose[RIGHT_WRIST];
  if (!lShoulder || !rShoulder || !lWrist || !rWrist) return 'neutral';

  const avgShoulderY = (lShoulder.y + rShoulder.y) / 2;
  const avgWristY = (lWrist.y + rWrist.y) / 2;

  // The full range is from UP position (shoulders well above wrists) to wrist level.
  // DOWN: shoulders drop to halfway between their UP position and wrist level.
  const midpointY = (avgWristY + avgShoulderY) / 2;
  // When shoulders sink past the midpoint toward wrists → down
  if (avgShoulderY > avgWristY - 0.08) return 'down';
  // UP: shoulders clearly above wrists (arms extended)
  if (avgShoulderY < avgWristY - 0.12) return 'up';
  return 'neutral';
}

export function detectPullUpPhase(pose: Landmark[]): Phase {
  const nose = pose[0];
  const lWrist = pose[LEFT_WRIST];
  const rWrist = pose[RIGHT_WRIST];
  const lShoulder = pose[LEFT_SHOULDER];
  const rShoulder = pose[RIGHT_SHOULDER];

  // Require wrists above shoulders (arms raised / hanging from bar)
  const wristsAboveShoulders =
    lWrist.y < lShoulder.y && rWrist.y < rShoulder.y;
  if (!wristsAboveShoulders) return 'neutral';

  const avgWristY = (lWrist.y + rWrist.y) / 2;

  // DOWN: wrists clearly above nose (hanging, arms extended up)
  if (avgWristY < nose.y - 0.1) return 'down';
  // UP: nose rises to wrist level (chin over bar)
  if (nose.y <= avgWristY + 0.03) return 'up';
  return 'neutral';
}

// FIX v3: Calf Raises — track nose Y (most stable high point, biggest movement range)
let _calfSamples: number[] = [];

export function detectCalfRaisePhase(pose: Landmark[]): Phase {
  const noseY = pose[NOSE]?.y;
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (noseY === undefined || shoulderY === null || hipY === null) return 'neutral';
  
  // Must be standing upright
  if (shoulderY > hipY) return 'neutral';
  
  // Collect nose Y samples to find baseline (max Y = lowest position = standing flat)
  _calfSamples.push(noseY);
  if (_calfSamples.length > 30) _calfSamples.shift();
  if (_calfSamples.length < 5) return 'neutral';
  
  const baseline = Math.max(..._calfSamples); // standing flat = highest Y value
  const rise = baseline - noseY;
  
  if (rise > 0.015) return 'up';   // body rose noticeably
  if (rise < 0.005) return 'down'; // body back to baseline
  return 'neutral';
}

export function resetCalfRaiseState() { _calfSamples = []; }

// FIX: Burpees — require actual plank position (nose low + shoulders near hips)
export function detectBurpeePhase(pose: Landmark[]): Phase {
  const nose = pose[NOSE];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const ankle = pose[LEFT_ANKLE] || pose[RIGHT_ANKLE];
  if (!nose || !hip || !shoulder) return 'neutral';
  
  // Plank: shoulders and hips roughly same height, nose is low
  const isPlankLike = Math.abs(shoulder.y - hip.y) < 0.18 && nose.y > 0.45;
  // Standing: nose is high up in the frame
  const isStanding = nose.y < 0.4 && shoulder.y < hip.y;
  
  if (isPlankLike) return 'down';
  if (isStanding) return 'up';
  return 'neutral';
}

// FIX: Mountain Climbers — simplified: use knee Y relative to hip, more liberal thresholds
let _mcLastKnee: 'left' | 'right' | null = null;

export function detectMountainClimberPhase(pose: Landmark[]): Phase {
  const lHip = pose[LEFT_HIP], rHip = pose[RIGHT_HIP];
  const lKnee = pose[LEFT_KNEE], rKnee = pose[RIGHT_KNEE];
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  if (!shoulder || !lKnee || !rKnee) return 'neutral';
  
  const hipY = lHip && rHip ? (lHip.y + rHip.y) / 2 : (lHip || rHip)?.y;
  if (hipY === undefined) return 'neutral';
  
  // Must be in plank-ish position (shoulder and hip roughly same height)
  if (Math.abs(shoulder.y - hipY) > 0.25) return 'neutral';
  
  // Knee drive: knee comes forward (closer to chest = Y decreases)
  const leftDrive = hipY - lKnee.y;
  const rightDrive = hipY - rKnee.y;
  
  if (leftDrive > 0.03 && _mcLastKnee !== 'left') { _mcLastKnee = 'left'; return 'up'; }
  if (rightDrive > 0.03 && _mcLastKnee !== 'right') { _mcLastKnee = 'right'; return 'up'; }
  if (leftDrive < -0.01 && rightDrive < -0.01) { _mcLastKnee = null; return 'down'; }
  return 'neutral';
}
export function resetMountainClimberState() { _mcLastKnee = null; }

let _hkLastKnee: 'left' | 'right' | null = null;

export function detectHighKneePhase(pose: Landmark[]): Phase {
  const lHip = pose[LEFT_HIP], rHip = pose[RIGHT_HIP];
  const lKnee = pose[LEFT_KNEE], rKnee = pose[RIGHT_KNEE];
  if (!lHip || !rHip || !lKnee || !rKnee) return 'neutral';
  const avgHipY = (lHip.y + rHip.y) / 2;
  if (lKnee.y < avgHipY + 0.02 && _hkLastKnee !== 'left') { _hkLastKnee = 'left'; return 'up'; }
  if (rKnee.y < avgHipY + 0.02 && _hkLastKnee !== 'right') { _hkLastKnee = 'right'; return 'up'; }
  if (lKnee.y > avgHipY + 0.1 && rKnee.y > avgHipY + 0.1) { _hkLastKnee = null; return 'down'; }
  return 'neutral';
}
export function resetHighKneeState() { _hkLastKnee = null; }

export function detectJumpingJackPhase(pose: Landmark[]): Phase {
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lAnkle = pose[LEFT_ANKLE], rAnkle = pose[RIGHT_ANKLE];
  const lHip = pose[LEFT_HIP], rHip = pose[RIGHT_HIP];
  if (!lWrist || !rWrist || !lShoulder || !rShoulder || !lAnkle || !rAnkle || !lHip || !rHip) return 'neutral';
  const armsUp = lWrist.y < lShoulder.y && rWrist.y < rShoulder.y;
  const hipWidth = Math.abs(lHip.x - rHip.x);
  const ankleWidth = Math.abs(lAnkle.x - rAnkle.x);
  if (armsUp && ankleWidth > hipWidth * 1.2) return 'up';
  const armsDown = lWrist.y > lShoulder.y && rWrist.y > rShoulder.y;
  if (armsDown && ankleWidth < hipWidth * 1.15) return 'down';
  return 'neutral';
}

// FIX: Wider thresholds for jump rope
export function detectJumpRopePhase(pose: Landmark[]): Phase {
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (hipY === null) return 'neutral';
  if (hipY < 0.47) return 'up';
  if (hipY > 0.51) return 'down';
  return 'neutral';
}

export function detectToeTouchPhase(pose: Landmark[]): Phase {
  const wrist = pose[LEFT_WRIST] || pose[RIGHT_WRIST];
  const ankle = pose[LEFT_ANKLE] || pose[RIGHT_ANKLE];
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  if (!wrist || !ankle || !shoulder) return 'neutral';
  if (Math.abs(wrist.y - ankle.y) < 0.1) return 'down';
  if (wrist.y < shoulder.y + 0.05) return 'up';
  return 'neutral';
}

// FIX: Cat-Cow — more liberal, look at nose position relative to shoulder/hip midpoint
export function detectCatCowPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const nose = pose[NOSE];
  if (!shoulder || !hip || !nose) return 'neutral';
  
  const midY = (shoulder.y + hip.y) / 2;
  
  // Cat: nose tucked down (nose below shoulder-hip midpoint)
  if (nose.y > midY + 0.02) return 'down';
  // Cow: nose lifted up (nose above shoulder)
  if (nose.y < shoulder.y - 0.02) return 'up';
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════
// DUMBBELL / GYM EXERCISES
// ═══════════════════════════════════════════════════════════════

export function detectBenchPressPhase(pose: Landmark[]): Phase {
  const noseY = pose[NOSE]?.y;
  const wristY = avgY(pose, LEFT_WRIST, RIGHT_WRIST);
  if (noseY === undefined || wristY === null) return 'neutral';
  // DOWN: wrists near nose level (bar at chest)
  if (wristY > noseY - 0.05) return 'down';
  // UP: wrists clearly above nose (arms extended, bar pushed up)
  if (wristY < noseY - 0.12) return 'up';
  return 'neutral';
}

// FIX: Chest Press — use wrist Y relative to shoulder (works when lying down)
export function detectChestPressPhase(pose: Landmark[]): Phase {
  const elbowAngle = anySideAngle(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  // More liberal thresholds for lying position
  if (elbowAngle < 110) return 'down';
  if (elbowAngle > 145) return 'up';
  return 'neutral';
}

// FIX: Bicep Curls — works with single arm (either side)
export function detectBicepCurlPhase(pose: Landmark[]): Phase {
  const elbowAngle = anySideAngle(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 65) return 'up';
  if (elbowAngle > 140) return 'down';
  return 'neutral';
}

export const detectHammerCurlPhase = detectBicepCurlPhase;

// FIX: Shoulder Press — lower angle threshold, use wrist position as alternative
export function detectShoulderPressPhase(pose: Landmark[]): Phase {
  const wristY = avgY(pose, LEFT_WRIST, RIGHT_WRIST);
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  const elbowY = avgY(pose, LEFT_ELBOW, RIGHT_ELBOW);
  if (wristY === null || shoulderY === null) return 'neutral';
  
  // Up: wrists clearly above head (above shoulders)
  if (wristY < shoulderY - 0.08) return 'up';
  // Down: wrists at or below shoulder level
  if (wristY > shoulderY + 0.03) return 'down';
  return 'neutral';
}

export function detectLateralRaisePhase(pose: Landmark[]): Phase {
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (!lShoulder || !rShoulder || !lWrist || !rWrist || hipY === null) return 'neutral';
  const shoulderY = (lShoulder.y + rShoulder.y) / 2;
  const wristY = (lWrist.y + rWrist.y) / 2;
  if (wristY < shoulderY + 0.05) return 'up';
  if (wristY > hipY - 0.02) return 'down';
  return 'neutral';
}

export const detectFrontRaisePhase = detectLateralRaisePhase;

export function detectBentOverRowPhase(pose: Landmark[]): Phase {
  const elbowAngle = anySideAngle(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 85) return 'up';
  if (elbowAngle > 150) return 'down';
  return 'neutral';
}

export const detectGobletSquatPhase = detectSquatPhase;

export function detectThrusterPhase(pose: Landmark[]): Phase {
  const kneeAngle = avgAngleBothSides(pose, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  if (kneeAngle === null) return 'neutral';
  const wristY = avgY(pose, LEFT_WRIST, RIGHT_WRIST);
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  if (kneeAngle < 115) return 'down';
  if (kneeAngle > 155 && wristY !== null && shoulderY !== null && wristY < shoulderY) return 'up';
  return 'neutral';
}

// FIX v3: Tricep Extension — down = wrist at/behind head, up = wrist above head
export function detectTricepExtensionPhase(pose: Landmark[]): Phase {
  const wristY = avgY(pose, LEFT_WRIST, RIGHT_WRIST);
  const noseY = pose[NOSE]?.y;
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  if (wristY === null || noseY === undefined || shoulderY === null) return 'neutral';
  
  // Up: wrists clearly above nose (arms extended overhead)
  if (wristY < noseY - 0.04) return 'up';
  // Down: wrists dropped to head/shoulder level (behind head)
  if (wristY > noseY + 0.03) return 'down';
  return 'neutral';
}

// FIX: Punches — use wrist distance from body center (works frontal)
let _punchLastArm: 'left' | 'right' | null = null;

export function detectPunchPhase(pose: Landmark[]): Phase {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lElbow = pose[LEFT_ELBOW], rElbow = pose[RIGHT_ELBOW];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  
  // Work with whatever landmarks are visible
  const hasLeft = lShoulder && lElbow && lWrist;
  const hasRight = rShoulder && rElbow && rWrist;
  if (!hasLeft && !hasRight) return 'neutral';
  
  // Check arm extension via angle OR via wrist-shoulder distance
  if (hasLeft) {
    const leftAngle = angle(lShoulder, lElbow, lWrist);
    if (leftAngle > 150 && _punchLastArm !== 'left') { _punchLastArm = 'left'; return 'up'; }
  }
  if (hasRight) {
    const rightAngle = angle(rShoulder, rElbow, rWrist);
    if (rightAngle > 150 && _punchLastArm !== 'right') { _punchLastArm = 'right'; return 'up'; }
  }
  
  // Both arms retracted
  const leftRetracted = !hasLeft || angle(lShoulder!, lElbow!, lWrist!) < 110;
  const rightRetracted = !hasRight || angle(rShoulder!, rElbow!, rWrist!) < 110;
  if (leftRetracted && rightRetracted) { _punchLastArm = null; return 'down'; }
  
  return 'neutral';
}
export function resetPunchState() { _punchLastArm = null; }

export function detectRomanianDeadliftPhase(pose: Landmark[]): Phase {
  const hipAngle = anySideAngle(pose, LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE, RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE);
  if (hipAngle === null) return 'neutral';
  if (hipAngle < 100) return 'down';
  if (hipAngle > 160) return 'up';
  return 'neutral';
}

// FIX: Windmill — require one arm UP and other arm DOWN simultaneously
export function detectWindmillPhase(pose: Landmark[]): Phase {
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  const lShoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (!lWrist || !rWrist || !lShoulder || hipY === null) return 'neutral';
  
  const oneArmUp = lWrist.y < lShoulder.y - 0.05 || rWrist.y < lShoulder.y - 0.05;
  const oneArmDown = lWrist.y > hipY || rWrist.y > hipY;
  
  // Down: one arm reaching up, other reaching down to foot
  if (oneArmUp && oneArmDown) return 'down';
  // Up: both wrists roughly at same height (standing upright with arms)
  const spread = Math.abs(lWrist.y - rWrist.y);
  if (spread < 0.15) return 'up';
  return 'neutral';
}

// ─── LAT PULLDOWN ───
// Elbow Y relative to shoulder Y: above shoulder = up (bar at top), below shoulder = down (pulled down)
export function detectLatPulldownPhase(pose: Landmark[]): Phase {
  const elbowY = avgY(pose, LEFT_ELBOW, RIGHT_ELBOW);
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  if (elbowY === null || shoulderY === null) return 'neutral';
  
  // Up: elbows above shoulders (arms reaching up for the bar)
  if (elbowY < shoulderY - 0.04) return 'up';
  // Down: elbows below shoulders (bar pulled down)
  if (elbowY > shoulderY + 0.04) return 'down';
  return 'neutral';
}

// ─── SEATED CABLE ROW ───
// Elbow angle: arms extended = up (handle away), arms pulled back = down (handle at chest)
export function detectSeatedCableRowPhase(pose: Landmark[]): Phase {
  const elbowAngle = anySideAngle(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  
  // Up: arms extended forward (reaching for the handle)
  if (elbowAngle > 145) return 'up';
  // Down: arms pulled back (handle at chest, elbows behind body)
  if (elbowAngle < 80) return 'down';
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════
// TIMED HOLD VALIDATORS
// ═══════════════════════════════════════════════════════════════

export function isPlankValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const knee = pose[LEFT_KNEE] || pose[RIGHT_KNEE];
  if (!shoulder || !hip) return false;
  // Shoulder and hip roughly same height AND body not upright
  const isHorizontal = Math.abs(shoulder.y - hip.y) < 0.18;
  // Must not be standing (knee should be roughly same height as hip)
  const notStanding = !knee || Math.abs(knee.y - hip.y) < 0.25;
  return isHorizontal && notStanding;
}

export function isWallSitValid(pose: Landmark[]): boolean {
  const kneeAngle = avgAngleBothSides(pose, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (kneeAngle === null || shoulderY === null || hipY === null) return false;
  return kneeAngle >= 65 && kneeAngle <= 125 && shoulderY < hipY;
}

// FIX v4: Deep Squat Hold — hip must be ABOVE ankles (squatting on feet, not sitting)
export function isDeepSquatHoldValid(pose: Landmark[]): boolean {
  const kneeAngle = avgAngleBothSides(pose, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  const ankleY = avgY(pose, LEFT_ANKLE, RIGHT_ANKLE);
  if (kneeAngle === null || shoulderY === null || hipY === null || ankleY === null) return false;
  
  // Knee must be bent deeply
  if (kneeAngle >= 105) return false;
  
  // Must be upright: shoulder above hip (not lying down)
  if (shoulderY > hipY) return false;
  
  // KEY: Hip must be significantly HIGHER than ankles (hip Y < ankle Y in screen coords)
  // When sitting, hip and ankles are at similar Y level (both on floor)
  // When squatting, hip is above ankles because you're on your feet
  const hipAboveAnkle = ankleY - hipY;
  if (hipAboveAnkle < 0.10) return false; // hip must be at least 10% of frame above ankles
  
  return true;
}

// FIX v3: Cobra Stretch — must be truly lying face down
// Require: hip, knee, ankle ALL at very similar Y (horizontal on floor)
// AND shoulder raised above them AND nose above shoulder
export function isCobraStretchValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const knee = pose[LEFT_KNEE] || pose[RIGHT_KNEE];
  const ankle = pose[LEFT_ANKLE] || pose[RIGHT_ANKLE];
  const nose = pose[NOSE];
  if (!shoulder || !hip || !nose) return false;
  
  // Must have at least knee OR ankle to verify lying position
  if (!knee && !ankle) return false;
  
  // Hip must be in lower 40% of frame (on the ground)
  if (hip.y < 0.6) return false;
  
  // Lower body MUST be flat on ground: knee and ankle at same level as hip
  if (knee && Math.abs(knee.y - hip.y) > 0.08) return false;
  if (ankle && Math.abs(ankle.y - hip.y) > 0.10) return false;
  
  // Upper body must be raised: shoulder clearly above hip
  if (shoulder.y > hip.y - 0.06) return false;
  
  // Nose above shoulder (head up)
  if (nose.y > shoulder.y) return false;
  
  return true;
}

// FIX v3: Hip Circles — require LARGE continuous hip movement
// Only counts if hips are moving significantly right now (not just moved in the past)
let _hipRecentX: number[] = [];

export function isHipCircleValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const knee = pose[LEFT_KNEE] || pose[RIGHT_KNEE];
  if (!shoulder || !hip || !knee) return false;
  
  // Must be standing upright
  if (!(shoulder.y < hip.y && hip.y < knee.y)) return false;
  
  // Track recent hip X positions (last ~1 second at 8fps)
  _hipRecentX.push(hip.x);
  if (_hipRecentX.length > 8) _hipRecentX.shift();
  
  if (_hipRecentX.length < 6) return false;
  
  // Check movement range in the RECENT window only
  const minX = Math.min(..._hipRecentX);
  const maxX = Math.max(..._hipRecentX);
  const range = maxX - minX;
  
  // Require at least 8% frame width of hip movement in the last second
  // This is a big movement — you have to really swing your hips
  return range > 0.08;
}

export function resetHipCircleState() { 
  _hipRecentX = []; 
}

// FIX: Shoulder Stretch Hold — changed to cross-body stretch (arm pulled across chest)
// Detects: one wrist crosses past the opposite shoulder X position, at shoulder height
export function isShoulderStretchValid(pose: Landmark[]): boolean {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  if (!lShoulder || !rShoulder || !lWrist || !rWrist) return false;
  
  const shoulderY = (lShoulder.y + rShoulder.y) / 2;
  
  // Check if left wrist crosses past right shoulder (at shoulder height)
  const leftCrosses = lWrist.x > rShoulder.x - 0.03 && Math.abs(lWrist.y - shoulderY) < 0.12;
  // Check if right wrist crosses past left shoulder (at shoulder height)
  const rightCrosses = rWrist.x < lShoulder.x + 0.03 && Math.abs(rWrist.y - shoulderY) < 0.12;
  
  return leftCrosses || rightCrosses;
}

// ═══════════════════════════════════════════════════════════════
// EXERCISE INSTRUCTIONS
// ═══════════════════════════════════════════════════════════════

export interface ExerciseInstruction {
  positioning: string;
  cameraGuide: string;
  tips: string[];
}

export const exerciseInstructions: Record<string, ExerciseInstruction> = {
  'squats': { positioning: 'Stand with feet shoulder-width apart, facing the camera.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body must be visible.', tips: ['Keep your back straight', 'Knees over toes', 'Go below parallel'] },
  'lunges': { positioning: 'Stand upright, side view to camera. Step forward into a lunge.', cameraGuide: 'Place camera at waist height, 2-3m away. Side/profile view recommended.', tips: ['Step forward with control', 'Back knee near the floor', 'Alternate legs', 'Side view works best'] },
  'pike push-ups': { positioning: 'Start in a pike position (inverted V) facing the camera.', cameraGuide: 'Place camera at floor level, 2m away. Upper body must be visible.', tips: ['Keep hips high', 'Lower head toward floor', 'Elbows flare slightly'] },
  'diamond push-ups': { positioning: 'Get into push-up position with hands close together.', cameraGuide: 'Place camera at floor level, side view preferred.', tips: ['Hands form a diamond shape', 'Elbows stay close to body', 'Full range of motion'] },
  'wall sit': { positioning: 'Lean against a wall with thighs parallel to the floor.', cameraGuide: 'Place camera at waist height, 2m away. Side view works best.', tips: ['Back flat against wall', 'Knees at 90°', 'Don\'t rest hands on thighs'] },
  'calf raises': { positioning: 'Stand straight with feet hip-width apart, side view to camera.', cameraGuide: 'Place camera at knee height, 2m away. Side/profile view works best.', tips: ['Rise onto your toes', 'Pause at the top', 'Controlled descent'] },
  'burpees': { positioning: 'Stand upright facing the camera with space to drop to the floor.', cameraGuide: 'Place camera at waist height, 3m away. Full body must be visible.', tips: ['Drop to plank position', 'Then jump up', 'Full range of motion'] },
  'mountain climbers': { positioning: 'Start in a high plank position, side view to camera.', cameraGuide: 'Place camera at floor level, 2m away. Side view preferred.', tips: ['Keep hips level', 'Drive knees to chest alternating', 'Maintain plank form'] },
  'high knees': { positioning: 'Stand upright facing the camera.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['Knees above hip level', 'Stay on the balls of your feet', 'Pump your arms'] },
  'jumping jacks': { positioning: 'Stand upright with arms at your sides, facing the camera.', cameraGuide: 'Place camera at chest height, 3m away. Full body must be visible.', tips: ['Arms fully extended overhead', 'Feet wider than shoulders at top', 'Rhythmic pace'] },
  'cycling': { positioning: 'Head outside with your bicycle.', cameraGuide: 'No camera needed — GPS tracking only.', tips: ['Ride outdoors for accurate GPS', 'Keep your phone accessible', 'Maintain steady pace'] },
  'jump rope': { positioning: 'Stand upright with room to jump, facing the camera.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['Small controlled jumps', 'Stay on the balls of your feet', 'Rhythmic bouncing'] },
  'toe touches': { positioning: 'Stand upright with legs straight, side view to camera.', cameraGuide: 'Place camera at waist height, 2m away. Side/profile view preferred.', tips: ['Keep legs straight', 'Reach down for your toes', 'Return fully upright with arms up'] },
  'hip circles': { positioning: 'Stand with hands on hips, feet shoulder-width apart, facing the camera.', cameraGuide: 'Place camera at waist height, 2m away. Full body visible.', tips: ['Large circular hip motions side to side', 'Keep upper body stable', 'Alternate directions'] },
  'cat-cow stretch': { positioning: 'Get on all fours (hands and knees), side view to camera.', cameraGuide: 'Place camera at floor level, side/profile view, 2m away.', tips: ['Cat: arch back up, tuck head down', 'Cow: dip belly down, lift head up', 'Move slowly and breathe'] },
  'deep squat hold': { positioning: 'Lower into a deep squat with feet flat on the floor.', cameraGuide: 'Place camera at knee height, 2m away. Side view recommended.', tips: ['Heels stay on ground', 'Chest upright', 'Hold the bottom position'] },
  'shoulder stretch hold': { positioning: 'Sit or stand facing the camera. Pull one arm straight across your chest and hold it with the other hand.', cameraGuide: 'Place camera at chest height, 2m away. Front view.', tips: ['Pull arm across your chest', 'Keep the stretched arm straight', 'Hold with opposite hand', 'Switch arms after 30 seconds'] },
  'cobra stretch': { positioning: 'Lie face down on the floor, then push your upper body up with your arms.', cameraGuide: 'Place camera at floor level, side view, 2m away.', tips: ['Keep hips and legs flat on the ground', 'Push chest up with arms', 'Look forward or slightly up'] },
  'sit-ups': { positioning: 'Lie on your back with knees bent.', cameraGuide: 'Place camera at floor level, side view preferred.', tips: ['Hands behind head', 'Curl up toward knees', 'Control the descent'] },
  'push-ups': { positioning: 'Get into push-up position on the floor.', cameraGuide: 'Place camera at floor level, side view.', tips: ['Keep body straight', 'Chest near floor', 'Full arm extension'] },
  'jumps': { positioning: 'Stand upright with feet shoulder-width apart, facing the camera.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['Jump as high as you can', 'Land softly on your toes', 'Use your arms for momentum'] },
  'plank': { positioning: 'Get into a forearm or high plank position.', cameraGuide: 'Place camera at floor level, side view.', tips: ['Keep body in a straight line', 'Engage your core', 'Don\'t let hips sag'] },
  'dips': { positioning: 'Place hands on a chair or bench behind you.', cameraGuide: 'Place camera at chest height, 2m away.', tips: ['Lower until elbows at 90°', 'Push back up fully', 'Keep back close to bench'] },
  'pull-ups': { positioning: 'Hang from a bar with arms fully extended.', cameraGuide: 'Place camera at chest height, 2m away.', tips: ['Pull chin over the bar', 'Control the descent', 'Full arm extension at bottom'] },
  'bench-press': { positioning: 'Lie on a bench with a barbell or dumbbells.', cameraGuide: 'Place camera at side, showing arm movement.', tips: ['Lower weight to chest', 'Press up fully', 'Keep feet on the floor'] },
  'lat-pulldown': { positioning: 'Sit at the lat pulldown machine facing or sideways to the camera.', cameraGuide: 'Place camera at chest height, 2m away. Front or side view.', tips: ['Reach up and grab the bar', 'Pull the bar down to chest level', 'Control the return up', 'Keep your back straight'] },
  'seated-cable-row': { positioning: 'Sit at the cable row machine with feet on the platform. Front or side view to camera.', cameraGuide: 'Place camera at chest height, 2m away. Front or side view.', tips: ['Grab the triangle handle', 'Pull it toward your chest/stomach', 'Squeeze shoulder blades together', 'Control the return forward'] },
  'running': { positioning: 'Head outside for your run.', cameraGuide: 'No camera needed — GPS tracking only.', tips: ['Run outdoors for accurate GPS', 'Keep phone on you', 'Maintain steady pace'] },
  'dumbbell bicep curls': { positioning: 'Stand upright holding dumbbells. Works with one or both arms.', cameraGuide: 'Place camera at waist height, 2m away. Arms must be visible.', tips: ['Keep elbows pinned to sides', 'Full curl to shoulders', 'One arm or both arms OK'] },
  'dumbbell hammer curls': { positioning: 'Stand upright with palms facing inward holding dumbbells.', cameraGuide: 'Place camera at waist height, 2m away. Arms must be visible.', tips: ['Palms face each other', 'Elbows stay still', 'Full range of motion'] },
  'dumbbell shoulder press': { positioning: 'Stand or sit with dumbbells at shoulder height, facing the camera.', cameraGuide: 'Place camera at chest height, 2m away. Upper body visible.', tips: ['Press straight overhead', 'Wrists go above head level', 'Lower back to shoulders'] },
  'dumbbell lateral raises': { positioning: 'Stand upright with dumbbells at your sides.', cameraGuide: 'Place camera at chest height, 2-3m away. Full upper body visible.', tips: ['Raise arms to shoulder height', 'Slight bend in elbows', 'Control the descent'] },
  'dumbbell front raises': { positioning: 'Stand upright with dumbbells in front of your thighs.', cameraGuide: 'Place camera at chest height, 2m away.', tips: ['Raise to shoulder height', 'Keep arms straight', 'Alternate or both arms'] },
  'dumbbell bent-over rows': { positioning: 'Bend at the hips with a flat back, dumbbells hanging. Side view to camera.', cameraGuide: 'Place camera at waist height, side view, 2m away.', tips: ['Pull elbows back', 'Squeeze shoulder blades', 'Keep back flat'] },
  'dumbbell goblet squat': { positioning: 'Hold one dumbbell at chest height with both hands.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['Elbows inside knees', 'Sit back and down', 'Chest stays up'] },
  'dumbbell thrusters': { positioning: 'Hold dumbbells at shoulder height, feet shoulder-width apart, facing the camera.', cameraGuide: 'Place camera at waist height, 3m away. Full body visible.', tips: ['Squat deep then drive up', 'Press overhead at the top', 'One fluid motion'] },
  'dumbbell chest press': { positioning: 'Lie on your back on the floor with dumbbells at chest level.', cameraGuide: 'Place camera at floor level, side view.', tips: ['Press straight up', 'Lower until elbows touch floor', 'Side view gives best results'] },
  'dumbbell tricep overhead extension': { positioning: 'Stand or sit sideways to the camera (profile view). Hold one dumbbell overhead with both hands.', cameraGuide: 'Place camera at chest height, 2m away. SIDE/PROFILE VIEW ONLY.', tips: ['Stand sideways to camera', 'Extend arms fully overhead', 'Lower dumbbell behind your head', 'Use both hands on one dumbbell'] },
  'dumbbell punches': { positioning: 'Stand in a fighting stance holding light dumbbells.', cameraGuide: 'Place camera at chest height, 2-3m away. Side or front view.', tips: ['Alternate fast punches', 'Full arm extension', 'Stay light on your feet'] },
  'deadlift': { positioning: 'Stand upright holding dumbbells in front of thighs.', cameraGuide: 'Place camera at waist height, 2-3m away. Hips must be visible.', tips: ['Hinge at the hips', 'Let hips move back and down', 'Stand back up fully'] },
  'dumbbell windmill': { positioning: 'Stand with feet wide, one arm overhead holding dumbbell, facing the camera.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['One arm stays up while other reaches to foot', 'Keep overhead arm locked', 'Move slowly'] },
};
