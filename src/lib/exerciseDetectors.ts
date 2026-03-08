/**
 * LIONSX Exercise Detectors — Clean Edition
 * 
 * Each detector returns a Phase ('up' | 'down' | 'neutral').
 * The PoseTracker counts a rep on the transition: down → up.
 * 
 * Design principles:
 * - Simple angle/position checks with HYSTERESIS (different thresholds for entering vs exiting a phase)
 * - No smoothing buffers, no confirmation frames, no baseline tracking
 * - Each exercise is self-contained
 * - Liberal thresholds — we'd rather count a slightly imperfect rep than miss a real one
 */

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// ─── Landmark indices (MediaPipe Pose) ───
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
const LEFT_HEEL = 29;
const RIGHT_HEEL = 30;
const LEFT_FOOT_INDEX = 31;
const RIGHT_FOOT_INDEX = 32;

/** Calculate angle at point B formed by points A-B-C (in degrees) */
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

/** Average of left and right side angles (uses whichever sides are available) */
function avgAngleBothSides(
  pose: Landmark[],
  jointA_L: number, jointB_L: number, jointC_L: number,
  jointA_R: number, jointB_R: number, jointC_R: number,
): number | null {
  const hasLeft = pose[jointA_L] && pose[jointB_L] && pose[jointC_L];
  const hasRight = pose[jointA_R] && pose[jointB_R] && pose[jointC_R];
  if (!hasLeft && !hasRight) return null;
  
  let sum = 0, count = 0;
  if (hasLeft) { sum += angle(pose[jointA_L], pose[jointB_L], pose[jointC_L]); count++; }
  if (hasRight) { sum += angle(pose[jointA_R], pose[jointB_R], pose[jointC_R]); count++; }
  return sum / count;
}

/** Average Y position of left and right landmarks */
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

export function detectLungePhase(pose: Landmark[]): Phase {
  const lHip = pose[LEFT_HIP], lKnee = pose[LEFT_KNEE], lAnkle = pose[LEFT_ANKLE];
  const rHip = pose[RIGHT_HIP], rKnee = pose[RIGHT_KNEE], rAnkle = pose[RIGHT_ANKLE];
  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) return 'neutral';
  const leftAngle = angle(lHip, lKnee, lAnkle);
  const rightAngle = angle(rHip, rKnee, rAnkle);
  const minAngle = Math.min(leftAngle, rightAngle);
  if (minAngle < 115) return 'down';
  if (leftAngle > 155 && rightAngle > 155) return 'up';
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
  const shoulder = pose[LEFT_SHOULDER];
  const hip = pose[LEFT_HIP];
  if (!shoulder || !hip) return 'neutral';
  if (hip.y > shoulder.y + 0.08) return 'neutral';
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 105) return 'down';
  if (elbowAngle > 150) return 'up';
  return 'neutral';
}

export function detectDiamondPushUpPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
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

export function detectJumpPhase(pose: Landmark[]): Phase {
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (hipY === null) return 'neutral';
  if (hipY < 0.42) return 'up';
  if (hipY > 0.55) return 'down';
  return 'neutral';
}

export function detectDipPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 100) return 'down';
  if (elbowAngle > 155) return 'up';
  return 'neutral';
}

export function detectPullUpPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 90) return 'up';
  if (elbowAngle > 155) return 'down';
  return 'neutral';
}

export function detectCalfRaisePhase(pose: Landmark[]): Phase {
  const heel = pose[LEFT_HEEL] || pose[RIGHT_HEEL];
  const foot = pose[LEFT_FOOT_INDEX] || pose[RIGHT_FOOT_INDEX];
  if (!heel || !foot) return 'neutral';
  const heelElevation = foot.y - heel.y;
  if (heelElevation > 0.015) return 'up';
  if (heelElevation < 0.003) return 'down';
  return 'neutral';
}

export function detectBurpeePhase(pose: Landmark[]): Phase {
  const nose = pose[NOSE];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  if (!nose || !hip || !shoulder) return 'neutral';
  const isPlankLike = Math.abs(shoulder.y - hip.y) < 0.15 && nose.y > 0.5;
  const isStanding = nose.y < 0.4;
  if (isPlankLike) return 'down';
  if (isStanding) return 'up';
  return 'neutral';
}

// ─── Alternating exercises (need state for left/right tracking) ───

let _mcLastKnee: 'left' | 'right' | null = null;

export function detectMountainClimberPhase(pose: Landmark[]): Phase {
  const lHip = pose[LEFT_HIP], rHip = pose[RIGHT_HIP];
  const lKnee = pose[LEFT_KNEE], rKnee = pose[RIGHT_KNEE];
  const lShoulder = pose[LEFT_SHOULDER];
  if (!lHip || !rHip || !lKnee || !rKnee || !lShoulder) return 'neutral';
  if (Math.abs(lShoulder.y - lHip.y) > 0.22) return 'neutral';
  const avgHipY = (lHip.y + rHip.y) / 2;
  if (avgHipY - lKnee.y > 0.04 && _mcLastKnee !== 'left') { _mcLastKnee = 'left'; return 'up'; }
  if (avgHipY - rKnee.y > 0.04 && _mcLastKnee !== 'right') { _mcLastKnee = 'right'; return 'up'; }
  if (lKnee.y > avgHipY && rKnee.y > avgHipY) { _mcLastKnee = null; return 'down'; }
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

export function detectJumpRopePhase(pose: Landmark[]): Phase {
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (hipY === null) return 'neutral';
  if (hipY < 0.46) return 'up';
  if (hipY > 0.52) return 'down';
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

export function detectCatCowPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const nose = pose[NOSE];
  if (!shoulder || !hip || !nose) return 'neutral';
  const spineAngle = shoulder.y - hip.y;
  if (spineAngle < -0.03 && nose.y > shoulder.y) return 'down';
  if (spineAngle > 0.03 && nose.y < shoulder.y) return 'up';
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════
// DUMBBELL / GYM EXERCISES
// ═══════════════════════════════════════════════════════════════

export function detectBenchPressPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 100) return 'down';
  if (elbowAngle > 155) return 'up';
  return 'neutral';
}

export const detectChestPressPhase = detectBenchPressPhase;

export function detectBicepCurlPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 60) return 'up';
  if (elbowAngle > 145) return 'down';
  return 'neutral';
}

export const detectHammerCurlPhase = detectBicepCurlPhase;

export function detectShoulderPressPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  const wristY = avgY(pose, LEFT_WRIST, RIGHT_WRIST);
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  if (wristY === null || shoulderY === null) return 'neutral';
  if (elbowAngle < 100) return 'down';
  if (elbowAngle > 160 && wristY < shoulderY) return 'up';
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
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
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

export function detectTricepExtensionPhase(pose: Landmark[]): Phase {
  const elbowAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_ELBOW, LEFT_WRIST, RIGHT_SHOULDER, RIGHT_ELBOW, RIGHT_WRIST);
  if (elbowAngle === null) return 'neutral';
  if (elbowAngle < 70) return 'down';
  if (elbowAngle > 150) return 'up';
  return 'neutral';
}

let _punchLastArm: 'left' | 'right' | null = null;

export function detectPunchPhase(pose: Landmark[]): Phase {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lElbow = pose[LEFT_ELBOW], rElbow = pose[RIGHT_ELBOW];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  if (!lShoulder || !rShoulder || !lElbow || !rElbow || !lWrist || !rWrist) return 'neutral';
  const leftAngle = angle(lShoulder, lElbow, lWrist);
  const rightAngle = angle(rShoulder, rElbow, rWrist);
  if (leftAngle > 155 && _punchLastArm !== 'left') { _punchLastArm = 'left'; return 'up'; }
  if (rightAngle > 155 && _punchLastArm !== 'right') { _punchLastArm = 'right'; return 'up'; }
  if (leftAngle < 110 && rightAngle < 110) { _punchLastArm = null; return 'down'; }
  return 'neutral';
}
export function resetPunchState() { _punchLastArm = null; }

export function detectRomanianDeadliftPhase(pose: Landmark[]): Phase {
  const hipAngle = avgAngleBothSides(pose, LEFT_SHOULDER, LEFT_HIP, LEFT_KNEE, RIGHT_SHOULDER, RIGHT_HIP, RIGHT_KNEE);
  if (hipAngle === null) return 'neutral';
  if (hipAngle < 100) return 'down';
  if (hipAngle > 160) return 'up';
  return 'neutral';
}

export function detectWindmillPhase(pose: Landmark[]): Phase {
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  const lHip = pose[LEFT_HIP];
  if (!lWrist || !rWrist || !lHip) return 'neutral';
  const spread = Math.abs(lWrist.y - rWrist.y);
  if (spread > 0.25 && (lWrist.y > lHip.y || rWrist.y > lHip.y)) return 'down';
  if (spread < 0.12) return 'up';
  return 'neutral';
}

// ═══════════════════════════════════════════════════════════════
// TIMED HOLD VALIDATORS
// ═══════════════════════════════════════════════════════════════

export function isPlankValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  if (!shoulder || !hip) return false;
  return Math.abs(shoulder.y - hip.y) < 0.18;
}

export function isWallSitValid(pose: Landmark[]): boolean {
  const kneeAngle = avgAngleBothSides(pose, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  const shoulderY = avgY(pose, LEFT_SHOULDER, RIGHT_SHOULDER);
  const hipY = avgY(pose, LEFT_HIP, RIGHT_HIP);
  if (kneeAngle === null || shoulderY === null || hipY === null) return false;
  return kneeAngle >= 65 && kneeAngle <= 125 && shoulderY < hipY;
}

export function isDeepSquatHoldValid(pose: Landmark[]): boolean {
  const kneeAngle = avgAngleBothSides(pose, LEFT_HIP, LEFT_KNEE, LEFT_ANKLE, RIGHT_HIP, RIGHT_KNEE, RIGHT_ANKLE);
  if (kneeAngle === null) return false;
  return kneeAngle < 95;
}

export function isShoulderStretchValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const elbow = pose[LEFT_ELBOW] || pose[RIGHT_ELBOW];
  const wrist = pose[LEFT_WRIST] || pose[RIGHT_WRIST];
  if (!shoulder || !elbow || !wrist) return false;
  return elbow.y < shoulder.y && wrist.y > elbow.y;
}

export function isCobraStretchValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const nose = pose[NOSE];
  if (!shoulder || !hip || !nose) return false;
  return hip.y > 0.55 && shoulder.y < hip.y - 0.08 && nose.y < shoulder.y;
}

export function isHipCircleValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER] || pose[RIGHT_SHOULDER];
  const hip = pose[LEFT_HIP] || pose[RIGHT_HIP];
  const knee = pose[LEFT_KNEE] || pose[RIGHT_KNEE];
  if (!shoulder || !hip || !knee) return false;
  return shoulder.y < hip.y && hip.y < knee.y;
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
  'lunges': { positioning: 'Stand upright facing the camera with feet together.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body must be visible.', tips: ['Step forward with control', 'Back knee near the floor', 'Alternate legs'] },
  'pike push-ups': { positioning: 'Start in a pike position (inverted V) facing the camera.', cameraGuide: 'Place camera at floor level, 2m away. Upper body must be visible.', tips: ['Keep hips high', 'Lower head toward floor', 'Elbows flare slightly'] },
  'diamond push-ups': { positioning: 'Get into push-up position with hands close together.', cameraGuide: 'Place camera at floor level, side view preferred.', tips: ['Hands form a diamond shape', 'Elbows stay close to body', 'Full range of motion'] },
  'wall sit': { positioning: 'Lean against a wall with thighs parallel to the floor.', cameraGuide: 'Place camera at waist height, 2m away. Side view works best.', tips: ['Back flat against wall', 'Knees at 90°', 'Don\'t rest hands on thighs'] },
  'calf raises': { positioning: 'Stand straight with feet hip-width apart.', cameraGuide: 'Place camera at floor level, 2m away. Feet and legs must be visible.', tips: ['Rise onto your toes', 'Pause at the top', 'Controlled descent'] },
  'burpees': { positioning: 'Stand upright facing the camera with space to drop to the floor.', cameraGuide: 'Place camera at waist height, 3m away. Full body must be visible.', tips: ['Jump up at the top', 'Chest touches floor in plank', 'Explosive movement'] },
  'mountain climbers': { positioning: 'Start in a high plank position facing the camera.', cameraGuide: 'Place camera at floor level, 2m away.', tips: ['Keep hips level', 'Drive knees to chest', 'Maintain plank form'] },
  'high knees': { positioning: 'Stand upright facing the camera.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['Knees above hip level', 'Stay on the balls of your feet', 'Pump your arms'] },
  'jumping jacks': { positioning: 'Stand upright with arms at your sides.', cameraGuide: 'Place camera at chest height, 3m away. Full body must be visible.', tips: ['Arms fully extended overhead', 'Feet wider than shoulders at top', 'Rhythmic pace'] },
  'cycling': { positioning: 'Head outside with your bicycle.', cameraGuide: 'No camera needed — GPS tracking only.', tips: ['Ride outdoors for accurate GPS', 'Keep your phone accessible', 'Maintain steady pace'] },
  'jump rope': { positioning: 'Stand upright with room to jump.', cameraGuide: 'Place camera at waist height, 2-3m away.', tips: ['Small controlled jumps', 'Stay on the balls of your feet', 'Wrists rotate the rope'] },
  'toe touches': { positioning: 'Stand upright with legs straight.', cameraGuide: 'Place camera at waist height, 2m away. Side view preferred.', tips: ['Keep legs straight', 'Reach for your toes', 'Return fully upright'] },
  'hip circles': { positioning: 'Stand with hands on hips, feet shoulder-width apart.', cameraGuide: 'Place camera at waist height, 2m away.', tips: ['Large circular hip motions', 'Keep upper body stable', 'Alternate directions'] },
  'cat-cow stretch': { positioning: 'Get on all fours (hands and knees) facing the camera.', cameraGuide: 'Place camera at floor level, side view, 2m away.', tips: ['Arch back up (cat)', 'Dip belly down (cow)', 'Move slowly and breathe'] },
  'shoulder stretch hold': { positioning: 'Stand upright, raise one arm and bend elbow behind head.', cameraGuide: 'Place camera at chest height, 2m away.', tips: ['Elbow points to ceiling', 'Use other hand to gently pull elbow', 'Keep torso upright'] },
  'deep squat hold': { positioning: 'Lower into a deep squat with feet flat on the floor.', cameraGuide: 'Place camera at floor level, 2m away.', tips: ['Heels stay on ground', 'Chest upright', 'Hold the bottom position'] },
  'cobra stretch': { positioning: 'Lie face down, then push your upper body up with your arms.', cameraGuide: 'Place camera at floor level, side view, 2m away.', tips: ['Hips stay on the ground', 'Arms extend gradually', 'Look forward or slightly up'] },
  'sit-ups': { positioning: 'Lie on your back with knees bent.', cameraGuide: 'Place camera at floor level, side view.', tips: ['Hands behind head', 'Curl up toward knees', 'Control the descent'] },
  'push-ups': { positioning: 'Get into push-up position on the floor.', cameraGuide: 'Place camera at floor level, side view.', tips: ['Keep body straight', 'Chest near floor', 'Full arm extension'] },
  'jumps': { positioning: 'Stand upright with feet shoulder-width apart.', cameraGuide: 'Place camera at waist height, 2m away.', tips: ['Jump as high as you can', 'Land softly', 'Use your arms'] },
  'plank': { positioning: 'Get into a forearm or high plank position.', cameraGuide: 'Place camera at floor level, side view.', tips: ['Keep body in a straight line', 'Engage your core', 'Don\'t let hips sag'] },
  'dips': { positioning: 'Place hands on a chair or bench behind you.', cameraGuide: 'Place camera at chest height, 2m away.', tips: ['Lower until elbows at 90°', 'Push back up fully', 'Keep back close to bench'] },
  'pull-ups': { positioning: 'Hang from a bar with arms fully extended.', cameraGuide: 'Place camera at chest height, 2m away.', tips: ['Pull chin over the bar', 'Control the descent', 'Full arm extension at bottom'] },
  'bench-press': { positioning: 'Lie on a bench with a barbell or dumbbells.', cameraGuide: 'Place camera at side, showing arm movement.', tips: ['Lower weight to chest', 'Press up fully', 'Keep feet on the floor'] },
  'running': { positioning: 'Head outside for your run.', cameraGuide: 'No camera needed — GPS tracking only.', tips: ['Run outdoors for accurate GPS', 'Keep phone on you', 'Maintain steady pace'] },
  'dumbbell bicep curls': { positioning: 'Stand upright holding dumbbells at your sides.', cameraGuide: 'Place camera at waist height, 2m away. Arms must be visible.', tips: ['Keep elbows pinned to sides', 'Full curl to shoulders', 'Control the lowering phase'] },
  'dumbbell hammer curls': { positioning: 'Stand upright with palms facing inward holding dumbbells.', cameraGuide: 'Place camera at waist height, 2m away. Arms must be visible.', tips: ['Palms face each other', 'Elbows stay still', 'Full range of motion'] },
  'dumbbell shoulder press': { positioning: 'Stand or sit with dumbbells at shoulder height.', cameraGuide: 'Place camera at chest height, 2m away. Upper body visible.', tips: ['Press straight overhead', 'Don\'t arch your back', 'Lower to shoulder level'] },
  'dumbbell lateral raises': { positioning: 'Stand upright with dumbbells at your sides.', cameraGuide: 'Place camera at chest height, 2-3m away. Full upper body visible.', tips: ['Raise arms to shoulder height', 'Slight bend in elbows', 'Control the descent'] },
  'dumbbell front raises': { positioning: 'Stand upright with dumbbells in front of your thighs.', cameraGuide: 'Place camera at chest height, 2m away.', tips: ['Raise to shoulder height', 'Keep arms straight', 'Alternate or both arms'] },
  'dumbbell bent-over rows': { positioning: 'Bend at the hips with a flat back, dumbbells hanging.', cameraGuide: 'Place camera at waist height, side view, 2m away.', tips: ['Pull elbows back', 'Squeeze shoulder blades', 'Keep back flat'] },
  'dumbbell goblet squat': { positioning: 'Hold one dumbbell at chest height with both hands.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['Elbows inside knees', 'Sit back and down', 'Chest stays up'] },
  'dumbbell thrusters': { positioning: 'Hold dumbbells at shoulder height, feet shoulder-width apart.', cameraGuide: 'Place camera at waist height, 3m away. Full body visible.', tips: ['Squat deep then drive up', 'Press overhead at the top', 'One fluid motion'] },
  'dumbbell chest press': { positioning: 'Lie on your back on the floor with dumbbells at chest level.', cameraGuide: 'Place camera at floor level, side view.', tips: ['Press straight up', 'Lower until elbows touch floor', 'Keep core engaged'] },
  'dumbbell tricep overhead extension': { positioning: 'Stand or sit, hold one dumbbell overhead with both hands.', cameraGuide: 'Place camera at chest height, 2m away. Upper body visible.', tips: ['Keep elbows close to head', 'Lower behind your head', 'Extend fully'] },
  'dumbbell punches': { positioning: 'Stand in a fighting stance holding light dumbbells.', cameraGuide: 'Place camera at chest height, 2-3m away.', tips: ['Alternate fast punches', 'Full arm extension', 'Stay light on your feet'] },
  'deadlift': { positioning: 'Stand upright holding dumbbells in front of thighs.', cameraGuide: 'Place camera at waist height, 2-3m away. Hips must be visible.', tips: ['Hinge at the hips', 'Let hips move back and down', 'Stand back up fully'] },
  'dumbbell windmill': { positioning: 'Stand with feet wide, one arm overhead holding dumbbell.', cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.', tips: ['Reach down to opposite foot', 'Keep overhead arm locked', 'Move slowly'] },
};
