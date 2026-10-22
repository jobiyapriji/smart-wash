/**
 * SMART WASH — Multi-Person Face Filtering Service
 * 
 * Rules enforced:
 * 1. Calculate face area (width * height) for all faces in frame
 * 2. Count only faces whose area is >= 50% of the largest face (ignores background faces)
 * 3. Require the extra face for 10 consecutive frames before blocking
 * 4. Never block permanently: auto-continue if the dominant face is stable for 2 seconds
 */

import { HANDWASH_CONFIG } from '../config/handwashConfig.js';

export function filterMultiPersonFaces(
  detections,
  consecutiveCount = 0,
  dominantStartTime = null,
  now = Date.now(),
  config = HANDWASH_CONFIG
) {
  if (!detections || detections.length === 0) {
    return {
      significantFaces: [],
      primaryFace: null,
      isBlocked: false,
      consecutiveCount: 0,
      dominantStartTime: null
    };
  }

  const faceAreas = detections.map(d => {
    const box = d.detection?.box || d.box || {};
    return (box.width || 0) * (box.height || 0);
  });
  const maxArea = Math.max(...faceAreas);
  const primaryIndex = faceAreas.indexOf(maxArea);
  const primaryFace = detections[primaryIndex];

  const minRatio = config?.MIN_SECONDARY_FACE_AREA_RATIO ?? 0.50;
  const minSecondaryArea = maxArea * minRatio;
  const significantFaces = detections.filter((d, i) => faceAreas[i] >= minSecondaryArea);

  let newConsecutiveCount = consecutiveCount;
  if (significantFaces.length > 1) {
    newConsecutiveCount++;
  } else {
    newConsecutiveCount = 0;
  }

  const newDominantStartTime = dominantStartTime || now;
  const dominantStableDuration = now - newDominantStartTime;
  const stableDurationReq = config?.DOMINANT_FACE_STABLE_AUTO_CONTINUE_MS ?? 2000;
  const isDominantStableFor2s = dominantStableDuration >= stableDurationReq;

  const framesReq = config?.MULTI_FACE_CONSECUTIVE_FRAMES ?? 10;
  const isBlockedByMultiple = newConsecutiveCount >= framesReq;
  const isBlocked = isBlockedByMultiple && !isDominantStableFor2s;

  return {
    significantFaces,
    primaryFace,
    isBlocked,
    consecutiveCount: newConsecutiveCount,
    dominantStartTime: newDominantStartTime
  };
}
