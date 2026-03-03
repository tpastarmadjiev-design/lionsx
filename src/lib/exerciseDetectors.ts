/**
 * Pose-based exercise detectors for all LIONSX exercises.
 * Each detector analyzes landmark positions to count reps or validate holds.
 */

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// Landmark indices
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

/** Calculate angle at point B formed by points A-B-C */
function angleBetween(a: Landmark, b: Landmark, c: Landmark): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };
  const dot = ba.x * bc.x + ba.y * bc.y;
  const magBA = Math.sqrt(ba.x * ba.x + ba.y * ba.y);
  const magBC = Math.sqrt(bc.x * bc.x + bc.y * bc.y);
  if (magBA === 0 || magBC === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / (magBA * magBC)));
  return Math.acos(cosAngle) * (180 / Math.PI);
}

type Phase = 'up' | 'down' | 'neutral';

// ─── SQUATS ───
export function detectSquatPhase(pose: Landmark[]): Phase {
  const hip = pose[LEFT_HIP];
  const knee = pose[LEFT_KNEE];
  const ankle = pose[LEFT_ANKLE];
  if (!hip || !knee || !ankle) return 'neutral';
  
  const kneeAngle = angleBetween(hip, knee, ankle);
  // Down: knee bent < 110°; Up: knee extended > 155°
  if (kneeAngle < 110) return 'down';
  if (kneeAngle > 155) return 'up';
  return 'neutral';
}

// ─── LUNGES ───
export function detectLungePhase(pose: Landmark[]): Phase {
  // Check both legs, use the one with deeper bend
  const lHip = pose[LEFT_HIP], lKnee = pose[LEFT_KNEE], lAnkle = pose[LEFT_ANKLE];
  const rHip = pose[RIGHT_HIP], rKnee = pose[RIGHT_KNEE], rAnkle = pose[RIGHT_ANKLE];
  if (!lHip || !lKnee || !lAnkle || !rHip || !rKnee || !rAnkle) return 'neutral';
  
  const leftAngle = angleBetween(lHip, lKnee, lAnkle);
  const rightAngle = angleBetween(rHip, rKnee, rAnkle);
  const minAngle = Math.min(leftAngle, rightAngle);
  
  if (minAngle < 110) return 'down';
  if (leftAngle > 155 && rightAngle > 155) return 'up';
  return 'neutral';
}

// ─── PIKE PUSH-UPS ───
export function detectPikePushUpPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER];
  const elbow = pose[LEFT_ELBOW];
  const wrist = pose[LEFT_WRIST];
  const hip = pose[LEFT_HIP];
  if (!shoulder || !elbow || !wrist || !hip) return 'neutral';
  
  const elbowAngle = angleBetween(shoulder, elbow, wrist);
  // Verify pike position: hips should be above shoulders or nearly level
  const isPike = hip.y < shoulder.y + 0.05;
  if (!isPike) return 'neutral';
  
  if (elbowAngle < 100) return 'down';
  if (elbowAngle > 150) return 'up';
  return 'neutral';
}

// ─── DIAMOND PUSH-UPS ───
export function detectDiamondPushUpPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER];
  const elbow = pose[LEFT_ELBOW];
  const wrist = pose[LEFT_WRIST];
  if (!shoulder || !elbow || !wrist) return 'neutral';
  
  const elbowAngle = angleBetween(shoulder, elbow, wrist);
  if (elbowAngle < 100) return 'down';
  if (elbowAngle > 150) return 'up';
  return 'neutral';
}

// ─── CALF RAISES ───
export function detectCalfRaisePhase(pose: Landmark[]): Phase {
  const ankle = pose[LEFT_ANKLE];
  const heel = pose[LEFT_HEEL];
  const foot = pose[LEFT_FOOT_INDEX];
  if (!ankle || !heel || !foot) return 'neutral';

  // When on tippy-toes, heel rises above foot index level
  const heelElevation = foot.y - heel.y;
  if (heelElevation > 0.02) return 'up';
  if (heelElevation < 0.005) return 'down';
  return 'neutral';
}

// ─── BURPEES ───
export function detectBurpeePhase(pose: Landmark[]): Phase {
  const nose = pose[NOSE];
  const hip = pose[LEFT_HIP];
  const shoulder = pose[LEFT_SHOULDER];
  if (!nose || !hip || !shoulder) return 'neutral';
  
  // Standing: nose high, shoulder-hip vertical
  // Plank: nose low, shoulder-hip nearly horizontal
  const isPlankLike = Math.abs(shoulder.y - hip.y) < 0.15 && nose.y > 0.5;
  const isStanding = nose.y < 0.35;
  
  if (isPlankLike) return 'down';
  if (isStanding) return 'up';
  return 'neutral';
}

// ─── MOUNTAIN CLIMBERS ───
let lastMCKnee: 'left' | 'right' | null = null;

export function detectMountainClimberPhase(pose: Landmark[]): Phase {
  const lHip = pose[LEFT_HIP], rHip = pose[RIGHT_HIP];
  const lKnee = pose[LEFT_KNEE], rKnee = pose[RIGHT_KNEE];
  const lShoulder = pose[LEFT_SHOULDER];
  if (!lHip || !rHip || !lKnee || !rKnee || !lShoulder) return 'neutral';
  
  // Must be in plank-like position
  if (Math.abs(lShoulder.y - lHip.y) > 0.2) return 'neutral';
  
  const avgHipY = (lHip.y + rHip.y) / 2;
  const leftDrive = avgHipY - lKnee.y;
  const rightDrive = avgHipY - rKnee.y;
  
  // Knee drive: knee comes forward (Y closer to hip or past it)
  if (leftDrive > 0.05 && lastMCKnee !== 'left') {
    lastMCKnee = 'left';
    return 'up'; // triggers rep
  }
  if (rightDrive > 0.05 && lastMCKnee !== 'right') {
    lastMCKnee = 'right';
    return 'up';
  }
  
  if (leftDrive < 0 && rightDrive < 0) {
    lastMCKnee = null;
    return 'down';
  }
  return 'neutral';
}

export function resetMountainClimberState() {
  lastMCKnee = null;
}

// ─── HIGH KNEES ───
let lastHKKnee: 'left' | 'right' | null = null;

export function detectHighKneePhase(pose: Landmark[]): Phase {
  const lHip = pose[LEFT_HIP], rHip = pose[RIGHT_HIP];
  const lKnee = pose[LEFT_KNEE], rKnee = pose[RIGHT_KNEE];
  if (!lHip || !rHip || !lKnee || !rKnee) return 'neutral';
  
  const avgHipY = (lHip.y + rHip.y) / 2;
  
  // Knee must rise to hip level or above (in screen coords, Y decreases going up)
  if (lKnee.y < avgHipY && lastHKKnee !== 'left') {
    lastHKKnee = 'left';
    return 'up';
  }
  if (rKnee.y < avgHipY && lastHKKnee !== 'right') {
    lastHKKnee = 'right';
    return 'up';
  }
  
  if (lKnee.y > avgHipY + 0.1 && rKnee.y > avgHipY + 0.1) {
    lastHKKnee = null;
    return 'down';
  }
  return 'neutral';
}

export function resetHighKneeState() {
  lastHKKnee = null;
}

// ─── JUMPING JACKS ───
export function detectJumpingJackPhase(pose: Landmark[]): Phase {
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lAnkle = pose[LEFT_ANKLE], rAnkle = pose[RIGHT_ANKLE];
  const lHip = pose[LEFT_HIP], rHip = pose[RIGHT_HIP];
  if (!lWrist || !rWrist || !lShoulder || !rShoulder || !lAnkle || !rAnkle || !lHip || !rHip) return 'neutral';
  
  // Arms up: wrists above shoulders
  const armsUp = lWrist.y < lShoulder.y && rWrist.y < rShoulder.y;
  // Legs spread: ankles wider than hips
  const hipWidth = Math.abs(lHip.x - rHip.x);
  const ankleWidth = Math.abs(lAnkle.x - rAnkle.x);
  const legsSpread = ankleWidth > hipWidth * 1.3;
  
  if (armsUp && legsSpread) return 'up';
  
  const armsDown = lWrist.y > lShoulder.y && rWrist.y > rShoulder.y;
  const legsClosed = ankleWidth < hipWidth * 1.1;
  if (armsDown && legsClosed) return 'down';
  
  return 'neutral';
}

// ─── JUMP ROPE ───
export function detectJumpRopePhase(pose: Landmark[]): Phase {
  const hip = pose[LEFT_HIP];
  const ankle = pose[LEFT_ANKLE];
  if (!hip || !ankle) return 'neutral';
  
  // Small vertical oscillation of hips
  if (hip.y < 0.45) return 'up';
  if (hip.y > 0.52) return 'down';
  return 'neutral';
}

// ─── TOE TOUCHES ───
export function detectToeTouchPhase(pose: Landmark[]): Phase {
  const wrist = pose[LEFT_WRIST];
  const ankle = pose[LEFT_ANKLE];
  const shoulder = pose[LEFT_SHOULDER];
  if (!wrist || !ankle || !shoulder) return 'neutral';
  
  const handFootDist = Math.abs(wrist.y - ankle.y);
  
  if (handFootDist < 0.08) return 'down'; // touching toes
  if (wrist.y < shoulder.y + 0.05) return 'up'; // standing upright
  return 'neutral';
}

// ─── CAT-COW STRETCH ───
export function detectCatCowPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER];
  const hip = pose[LEFT_HIP];
  const nose = pose[NOSE];
  if (!shoulder || !hip || !nose) return 'neutral';
  
  // Cat: back rounded up (nose tucked, shoulder above hip line)
  // Cow: back arched down (nose up, shoulder below hip line)
  const spineAngle = shoulder.y - hip.y;
  
  if (spineAngle < -0.03 && nose.y > shoulder.y) return 'down'; // cat
  if (spineAngle > 0.03 && nose.y < shoulder.y) return 'up';   // cow
  return 'neutral';
}

// ─── TIMED HOLD DETECTORS (return boolean: is in valid position?) ───

/** Wall Sit: thighs approximately parallel to floor */
export function isWallSitValid(pose: Landmark[]): boolean {
  const hip = pose[LEFT_HIP];
  const knee = pose[LEFT_KNEE];
  const ankle = pose[LEFT_ANKLE];
  const shoulder = pose[LEFT_SHOULDER];
  if (!hip || !knee || !ankle || !shoulder) return false;
  
  const kneeAngle = angleBetween(hip, knee, ankle);
  // Valid wall sit: knee angle between 70-110° (thighs roughly parallel)
  // Back should be roughly vertical (shoulder above hip)
  return kneeAngle >= 70 && kneeAngle <= 120 && shoulder.y < hip.y;
}

/** Deep Squat Hold */
export function isDeepSquatHoldValid(pose: Landmark[]): boolean {
  const hip = pose[LEFT_HIP];
  const knee = pose[LEFT_KNEE];
  const ankle = pose[LEFT_ANKLE];
  if (!hip || !knee || !ankle) return false;
  
  const kneeAngle = angleBetween(hip, knee, ankle);
  return kneeAngle < 90; // Deep squat
}

/** Shoulder Stretch Hold: arm behind head */
export function isShoulderStretchValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER];
  const elbow = pose[LEFT_ELBOW];
  const wrist = pose[LEFT_WRIST];
  if (!shoulder || !elbow || !wrist) return false;
  
  // Elbow should be above shoulder, wrist behind head
  return elbow.y < shoulder.y && wrist.y > elbow.y;
}

/** Cobra Stretch: prone back extension */
export function isCobraStretchValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER];
  const hip = pose[LEFT_HIP];
  const nose = pose[NOSE];
  if (!shoulder || !hip || !nose) return false;
  
  // Hip on floor (high Y), shoulder raised, nose above shoulder
  return hip.y > 0.6 && shoulder.y < hip.y - 0.1 && nose.y < shoulder.y;
}

/** Hip Circles: timed exercise, just verify standing position */
export function isHipCircleValid(pose: Landmark[]): boolean {
  const shoulder = pose[LEFT_SHOULDER];
  const hip = pose[LEFT_HIP];
  const knee = pose[LEFT_KNEE];
  if (!shoulder || !hip || !knee) return false;
  
  // Must be standing upright
  return shoulder.y < hip.y && hip.y < knee.y;
}

// ─── DUMBBELL EXERCISES ───

/** Dumbbell Bicep Curls: delegates to smoothed detector */
export { detectBicepCurlPhaseSmoothed as detectBicepCurlPhase } from './smoothedDetectors';

/** Dumbbell Hammer Curls: same as bicep curls (angle-based) */
export { detectBicepCurlPhaseSmoothed as detectHammerCurlPhase } from './smoothedDetectors';

/** Dumbbell Shoulder Press: wrists go from shoulder level to above head */
export function detectShoulderPressPhase(pose: Landmark[]): Phase {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lElbow = pose[LEFT_ELBOW], rElbow = pose[RIGHT_ELBOW];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  if (!lShoulder || !lElbow || !lWrist || !rShoulder || !rElbow || !rWrist) return 'neutral';
  const leftAngle = angleBetween(lShoulder, lElbow, lWrist);
  const rightAngle = angleBetween(rShoulder, rElbow, rWrist);
  const avgAngle = (leftAngle + rightAngle) / 2;
  const wristsAboveHead = lWrist.y < lShoulder.y - 0.1 && rWrist.y < rShoulder.y - 0.1;
  if (wristsAboveHead && avgAngle > 150) return 'up';
  if (avgAngle < 100) return 'down';
  return 'neutral';
}

/** Dumbbell Lateral Raises: arms go from sides to shoulder height */
export function detectLateralRaisePhase(pose: Landmark[]): Phase {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  if (!lShoulder || !rShoulder || !lWrist || !rWrist) return 'neutral';
  const armsUp = lWrist.y < lShoulder.y + 0.03 && rWrist.y < rShoulder.y + 0.03;
  const armsDown = lWrist.y > lShoulder.y + 0.15 && rWrist.y > rShoulder.y + 0.15;
  if (armsUp) return 'up';
  if (armsDown) return 'down';
  return 'neutral';
}

/** Dumbbell Front Raises: arms go forward and up to shoulder height */
export function detectFrontRaisePhase(pose: Landmark[]): Phase {
  return detectLateralRaisePhase(pose); // same landmark logic
}

/** Dumbbell Bent-over Rows: delegates to smoothed detector */
export { detectBentOverRowPhaseSmoothed as detectBentOverRowPhase } from './smoothedDetectors';

/** Dumbbell Goblet Squat: squat with arms at chest */
export function detectGobletSquatPhase(pose: Landmark[]): Phase {
  return detectSquatPhase(pose); // same knee angle logic
}

/** Dumbbell Thrusters: squat + press combo */
export function detectThrusterPhase(pose: Landmark[]): Phase {
  const hip = pose[LEFT_HIP];
  const knee = pose[LEFT_KNEE];
  const ankle = pose[LEFT_ANKLE];
  const wrist = pose[LEFT_WRIST];
  const shoulder = pose[LEFT_SHOULDER];
  if (!hip || !knee || !ankle || !wrist || !shoulder) return 'neutral';
  const kneeAngle = angleBetween(hip, knee, ankle);
  const wristAboveHead = wrist.y < shoulder.y - 0.1;
  if (kneeAngle < 110) return 'down'; // squat phase
  if (kneeAngle > 155 && wristAboveHead) return 'up'; // press phase
  return 'neutral';
}

/** Dumbbell Chest Press: delegates to smoothed detector (same as bench press) */
export { detectChestPressPhaseSmoothed as detectChestPressPhase } from './smoothedDetectors';

/** Dumbbell Tricep Overhead Extension: elbow behind head */
export function detectTricepExtensionPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER];
  const elbow = pose[LEFT_ELBOW];
  const wrist = pose[LEFT_WRIST];
  if (!shoulder || !elbow || !wrist) return 'neutral';
  // Elbow must be above shoulder (overhead position)
  if (elbow.y > shoulder.y) return 'neutral';
  const elbowAngle = angleBetween(shoulder, elbow, wrist);
  if (elbowAngle > 150) return 'up';
  if (elbowAngle < 80) return 'down';
  return 'neutral';
}

/** Dumbbell Punches: alternating arm extensions */
let lastPunchArm: 'left' | 'right' | null = null;

export function detectPunchPhase(pose: Landmark[]): Phase {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lElbow = pose[LEFT_ELBOW], rElbow = pose[RIGHT_ELBOW];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  if (!lShoulder || !rShoulder || !lElbow || !rElbow || !lWrist || !rWrist) return 'neutral';
  const leftAngle = angleBetween(lShoulder, lElbow, lWrist);
  const rightAngle = angleBetween(rShoulder, rElbow, rWrist);
  if (leftAngle > 150 && lastPunchArm !== 'left') {
    lastPunchArm = 'left';
    return 'up';
  }
  if (rightAngle > 150 && lastPunchArm !== 'right') {
    lastPunchArm = 'right';
    return 'up';
  }
  if (leftAngle < 100 && rightAngle < 100) {
    lastPunchArm = null;
    return 'down';
  }
  return 'neutral';
}

export function resetPunchState() {
  lastPunchArm = null;
}

/** Dumbbell Romanian Deadlift: hip hinge, torso forward */
export function detectRomanianDeadliftPhase(pose: Landmark[]): Phase {
  const shoulder = pose[LEFT_SHOULDER];
  const hip = pose[LEFT_HIP];
  const knee = pose[LEFT_KNEE];
  if (!shoulder || !hip || !knee) return 'neutral';
  const hipAngle = angleBetween(shoulder, hip, knee);
  if (hipAngle < 100) return 'down'; // bent over
  if (hipAngle > 160) return 'up'; // standing
  return 'neutral';
}

/** Dumbbell Windmill: side bend with arm overhead */
export function detectWindmillPhase(pose: Landmark[]): Phase {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  const lHip = pose[LEFT_HIP];
  if (!lShoulder || !rShoulder || !lWrist || !rWrist || !lHip) return 'neutral';
  // One wrist high, one wrist low (touching floor)
  const spread = Math.abs(lWrist.y - rWrist.y);
  if (spread > 0.3 && (lWrist.y > lHip.y || rWrist.y > lHip.y)) return 'down';
  if (spread < 0.1) return 'up';
  return 'neutral';
}

/** Shoulder Stabilization Hold: arms extended at sides */
export function isShoulderStabilizationValid(pose: Landmark[]): boolean {
  const lShoulder = pose[LEFT_SHOULDER], rShoulder = pose[RIGHT_SHOULDER];
  const lWrist = pose[LEFT_WRIST], rWrist = pose[RIGHT_WRIST];
  if (!lShoulder || !rShoulder || !lWrist || !rWrist) return false;
  // Wrists should be approximately at shoulder height (arms extended)
  const leftDiff = Math.abs(lWrist.y - lShoulder.y);
  const rightDiff = Math.abs(rWrist.y - rShoulder.y);
  return leftDiff < 0.08 && rightDiff < 0.08;
}

// ─── Exercise instruction data ───
export interface ExerciseInstruction {
  positioning: string;
  cameraGuide: string;
  tips: string[];
}

export const exerciseInstructions: Record<string, ExerciseInstruction> = {
  'squats': {
    positioning: 'Stand with feet shoulder-width apart, facing the camera.',
    cameraGuide: 'Place camera at waist height, 2-3m away. Full body must be visible.',
    tips: ['Keep your back straight', 'Knees over toes', 'Go below parallel'],
  },
  'lunges': {
    positioning: 'Stand upright facing the camera with feet together.',
    cameraGuide: 'Place camera at waist height, 2-3m away. Full body must be visible.',
    tips: ['Step forward with control', 'Back knee near the floor', 'Alternate legs'],
  },
  'pike push-ups': {
    positioning: 'Start in a pike position (inverted V) facing the camera.',
    cameraGuide: 'Place camera at floor level, 2m away. Upper body must be visible.',
    tips: ['Keep hips high', 'Lower head toward floor', 'Elbows flare slightly'],
  },
  'diamond push-ups': {
    positioning: 'Get into push-up position with hands close together.',
    cameraGuide: 'Place camera at floor level, side view preferred.',
    tips: ['Hands form a diamond shape', 'Elbows stay close to body', 'Full range of motion'],
  },
  'wall sit': {
    positioning: 'Lean against a wall with thighs parallel to the floor.',
    cameraGuide: 'Place camera at waist height, 2m away. Side view works best.',
    tips: ['Back flat against wall', 'Knees at 90°', 'Don\'t rest hands on thighs'],
  },
  'calf raises': {
    positioning: 'Stand straight with feet hip-width apart.',
    cameraGuide: 'Place camera at floor level, 2m away. Feet and legs must be visible.',
    tips: ['Rise onto your toes', 'Pause at the top', 'Controlled descent'],
  },
  'burpees': {
    positioning: 'Stand upright facing the camera with space to drop to the floor.',
    cameraGuide: 'Place camera at waist height, 3m away. Full body must be visible.',
    tips: ['Jump up at the top', 'Chest touches floor in plank', 'Explosive movement'],
  },
  'mountain climbers': {
    positioning: 'Start in a high plank position facing the camera.',
    cameraGuide: 'Place camera at floor level, 2m away.',
    tips: ['Keep hips level', 'Drive knees to chest', 'Maintain plank form'],
  },
  'high knees': {
    positioning: 'Stand upright facing the camera.',
    cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.',
    tips: ['Knees above hip level', 'Stay on the balls of your feet', 'Pump your arms'],
  },
  'jumping jacks': {
    positioning: 'Stand upright with arms at your sides.',
    cameraGuide: 'Place camera at chest height, 3m away. Full body must be visible.',
    tips: ['Arms fully extended overhead', 'Feet wider than shoulders at top', 'Rhythmic pace'],
  },
  'cycling': {
    positioning: 'Head outside with your bicycle.',
    cameraGuide: 'No camera needed — GPS tracking only.',
    tips: ['Ride outdoors for accurate GPS', 'Keep your phone accessible', 'Maintain steady pace'],
  },
  'jump rope': {
    positioning: 'Stand upright with room to jump.',
    cameraGuide: 'Place camera at waist height, 2-3m away.',
    tips: ['Small controlled jumps', 'Stay on the balls of your feet', 'Wrists rotate the rope'],
  },
  'toe touches': {
    positioning: 'Stand upright with legs straight.',
    cameraGuide: 'Place camera at waist height, 2m away. Side view preferred.',
    tips: ['Keep legs straight', 'Reach for your toes', 'Return fully upright'],
  },
  'hip circles': {
    positioning: 'Stand with hands on hips, feet shoulder-width apart.',
    cameraGuide: 'Place camera at waist height, 2m away.',
    tips: ['Large circular hip motions', 'Keep upper body stable', 'Alternate directions'],
  },
  'cat-cow stretch': {
    positioning: 'Get on all fours (hands and knees) facing the camera.',
    cameraGuide: 'Place camera at floor level, side view, 2m away.',
    tips: ['Arch back up (cat)', 'Dip belly down (cow)', 'Move slowly and breathe'],
  },
  'shoulder stretch hold': {
    positioning: 'Stand upright, raise one arm and bend elbow behind head.',
    cameraGuide: 'Place camera at chest height, 2m away.',
    tips: ['Elbow points to ceiling', 'Use other hand to gently pull elbow', 'Keep torso upright'],
  },
  'deep squat hold': {
    positioning: 'Lower into a deep squat with feet flat on the floor.',
    cameraGuide: 'Place camera at floor level, 2m away.',
    tips: ['Heels stay on ground', 'Chest upright', 'Hold the bottom position'],
  },
  'cobra stretch': {
    positioning: 'Lie face down, then push your upper body up with your arms.',
    cameraGuide: 'Place camera at floor level, side view, 2m away.',
    tips: ['Hips stay on the ground', 'Arms extend gradually', 'Look forward or slightly up'],
  },
  // Existing exercises
  'sit-ups': {
    positioning: 'Lie on your back with knees bent.',
    cameraGuide: 'Place camera at floor level, side view.',
    tips: ['Hands behind head', 'Curl up toward knees', 'Control the descent'],
  },
  'push-ups': {
    positioning: 'Get into push-up position on the floor.',
    cameraGuide: 'Place camera at floor level, side view.',
    tips: ['Keep body straight', 'Chest near floor', 'Full arm extension'],
  },
  'jumps': {
    positioning: 'Stand upright with feet shoulder-width apart.',
    cameraGuide: 'Place camera at waist height, 2m away.',
    tips: ['Jump as high as you can', 'Land softly', 'Use your arms'],
  },
  'plank': {
    positioning: 'Get into a forearm or high plank position.',
    cameraGuide: 'Place camera at floor level, side view.',
    tips: ['Keep body in a straight line', 'Engage your core', 'Don\'t let hips sag'],
  },
  'dips': {
    positioning: 'Place hands on a chair or bench behind you.',
    cameraGuide: 'Place camera at chest height, 2m away.',
    tips: ['Lower until elbows at 90°', 'Push back up fully', 'Keep back close to bench'],
  },
  'pull-ups': {
    positioning: 'Hang from a bar with arms fully extended.',
    cameraGuide: 'Place camera at chest height, 2m away.',
    tips: ['Pull chin over the bar', 'Control the descent', 'Full arm extension at bottom'],
  },
  'bench-press': {
    positioning: 'Lie on a bench with a barbell or dumbbells.',
    cameraGuide: 'Place camera at side, showing arm movement.',
    tips: ['Lower weight to chest', 'Press up fully', 'Keep feet on the floor'],
  },
  'running': {
    positioning: 'Head outside for your run.',
    cameraGuide: 'No camera needed — GPS tracking only.',
    tips: ['Run outdoors for accurate GPS', 'Keep phone on you', 'Maintain steady pace'],
  },
  'dumbbell bicep curls': {
    positioning: 'Stand upright holding dumbbells at your sides.',
    cameraGuide: 'Place camera at waist height, 2m away. Arms must be visible.',
    tips: ['Keep elbows pinned to sides', 'Full curl to shoulders', 'Control the lowering phase'],
  },
  'dumbbell hammer curls': {
    positioning: 'Stand upright with palms facing inward holding dumbbells.',
    cameraGuide: 'Place camera at waist height, 2m away. Arms must be visible.',
    tips: ['Palms face each other', 'Elbows stay still', 'Full range of motion'],
  },
  'dumbbell shoulder press': {
    positioning: 'Stand or sit with dumbbells at shoulder height.',
    cameraGuide: 'Place camera at chest height, 2m away. Upper body visible.',
    tips: ['Press straight overhead', 'Don\'t arch your back', 'Lower to shoulder level'],
  },
  'dumbbell lateral raises': {
    positioning: 'Stand upright with dumbbells at your sides.',
    cameraGuide: 'Place camera at chest height, 2-3m away. Full upper body visible.',
    tips: ['Raise arms to shoulder height', 'Slight bend in elbows', 'Control the descent'],
  },
  'dumbbell front raises': {
    positioning: 'Stand upright with dumbbells in front of your thighs.',
    cameraGuide: 'Place camera at chest height, 2m away.',
    tips: ['Raise to shoulder height', 'Keep arms straight', 'Alternate or both arms'],
  },
  'dumbbell bent-over rows': {
    positioning: 'Bend at the hips with a flat back, dumbbells hanging.',
    cameraGuide: 'Place camera at waist height, side view, 2m away.',
    tips: ['Pull elbows back', 'Squeeze shoulder blades', 'Keep back flat'],
  },
  'dumbbell goblet squat': {
    positioning: 'Hold one dumbbell at chest height with both hands.',
    cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.',
    tips: ['Elbows inside knees', 'Sit back and down', 'Chest stays up'],
  },
  'dumbbell thrusters': {
    positioning: 'Hold dumbbells at shoulder height, feet shoulder-width apart.',
    cameraGuide: 'Place camera at waist height, 3m away. Full body visible.',
    tips: ['Squat deep then drive up', 'Press overhead at the top', 'One fluid motion'],
  },
  'dumbbell chest press': {
    positioning: 'Lie on your back on the floor with dumbbells at chest level.',
    cameraGuide: 'Place camera at floor level, side view.',
    tips: ['Press straight up', 'Lower until elbows touch floor', 'Keep core engaged'],
  },
  'dumbbell tricep overhead extension': {
    positioning: 'Stand or sit, hold one dumbbell overhead with both hands.',
    cameraGuide: 'Place camera at chest height, 2m away. Upper body visible.',
    tips: ['Keep elbows close to head', 'Lower behind your head', 'Extend fully'],
  },
  'dumbbell punches': {
    positioning: 'Stand in a fighting stance holding light dumbbells.',
    cameraGuide: 'Place camera at chest height, 2-3m away.',
    tips: ['Alternate fast punches', 'Full arm extension', 'Stay light on your feet'],
  },
  'dumbbell romanian deadlift': {
    positioning: 'Stand upright holding dumbbells in front of thighs.',
    cameraGuide: 'Place camera at waist height, side view, 2m away.',
    tips: ['Hinge at the hips', 'Keep back flat', 'Feel hamstring stretch'],
  },
  'dumbbell windmill': {
    positioning: 'Stand with feet wide, one arm overhead holding dumbbell.',
    cameraGuide: 'Place camera at waist height, 2-3m away. Full body visible.',
    tips: ['Reach down to opposite foot', 'Keep overhead arm locked', 'Move slowly'],
  },
  'shoulder stabilization hold': {
    positioning: 'Stand upright, extend arms straight out to the sides with light dumbbells.',
    cameraGuide: 'Place camera at chest height, 3m away. Full wingspan visible.',
    tips: ['Arms at shoulder height', 'Keep arms straight', 'Hold steady — don\'t drop'],
  },
};
