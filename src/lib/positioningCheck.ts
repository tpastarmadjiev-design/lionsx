/**
 * Positioning Check — verifies that the user is visible and properly positioned
 * before exercise begins. Checks 8 core landmarks and requires at least 6 visible.
 *
 * Does NOT modify any exercise detection logic.
 */

interface Landmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

// Core body landmarks to check
const CORE_LANDMARKS = [11, 12, 23, 24, 25, 26, 27, 28] as const;
// Labels for debugging
const LANDMARK_NAMES: Record<number, string> = {
  11: 'Left Shoulder', 12: 'Right Shoulder',
  23: 'Left Hip', 24: 'Right Hip',
  25: 'Left Knee', 26: 'Right Knee',
  27: 'Left Ankle', 28: 'Right Ankle',
};

const MIN_VISIBLE = 6;
const VISIBILITY_THRESHOLD = 0.5; // MediaPipe visibility confidence

export interface PositioningResult {
  isReady: boolean;
  visibleCount: number;
  requiredCount: number;
  message: string;
}

/**
 * Check if the user is properly positioned in front of the camera.
 * @param pose - single pose landmark array from MediaPipe
 * @returns positioning result with ready status and message
 */
export function checkPositioning(pose: Landmark[]): PositioningResult {
  if (!pose || pose.length === 0) {
    return {
      isReady: false,
      visibleCount: 0,
      requiredCount: MIN_VISIBLE,
      message: 'Step back so your full body is visible',
    };
  }

  let visibleCount = 0;
  for (const idx of CORE_LANDMARKS) {
    const lm = pose[idx];
    if (lm && lm.visibility !== undefined && lm.visibility >= VISIBILITY_THRESHOLD) {
      visibleCount++;
    } else if (lm && lm.visibility === undefined) {
      // If visibility is not provided, check if coordinates are valid (not 0,0)
      if (lm.x > 0.01 && lm.y > 0.01 && lm.x < 0.99 && lm.y < 0.99) {
        visibleCount++;
      }
    }
  }

  const isReady = visibleCount >= MIN_VISIBLE;

  return {
    isReady,
    visibleCount,
    requiredCount: MIN_VISIBLE,
    message: isReady ? 'Ready!' : 'Step back so your full body is visible',
  };
}
