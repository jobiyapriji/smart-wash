/**
 * SMART WASH — Dry Test Mode Landmark Geometry Service
 * 
 * Provides fallback heuristic step validation using MediaPipe hand landmark vectors
 * when testing without water, soap, or foam bubbles.
 * 
 * NOTE: Each geometry rule is an APPROXIMATE geometric heuristic normalized by hand scale.
 * Tunable thresholds are sourced from HANDWASH_CONFIG.GEOMETRY_THRESHOLDS.
 */

import { HANDWASH_CONFIG } from '../config/handwashConfig.js';
import { computePalmCenter, computeHandScale, isMergedHand } from './handLandmarkService.js';

// -------------------------------------------------------------
// Geometric Helper Functions
// -------------------------------------------------------------

/**
 * Computes bounding box for a single hand in normalized coordinates [0, 1].
 */
export function getHandBoundingBox(landmarks) {
  if (!landmarks || landmarks.length < 21) {
    return { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0, area: 0 };
  }
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < landmarks.length; i++) {
    const pt = landmarks[i];
    if (pt.x < minX) minX = pt.x;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.y > maxY) maxY = pt.y;
  }
  const width = Math.max(0.001, maxX - minX);
  const height = Math.max(0.001, maxY - minY);
  return { minX, maxX, minY, maxY, width, height, area: width * height };
}

/**
 * Computes bounding box overlap ratio between two hands:
 * Intersection Area / Min(Area_A, Area_B).
 */
export function computeBoxOverlap(boxA, boxB) {
  if (!boxA || !boxB || boxA.area === 0 || boxB.area === 0) return 0;
  const ixMin = Math.max(boxA.minX, boxB.minX);
  const ixMax = Math.min(boxA.maxX, boxB.maxX);
  const iyMin = Math.max(boxA.minY, boxB.minY);
  const iyMax = Math.min(boxA.maxY, boxB.maxY);

  if (ixMax <= ixMin || iyMax <= iyMin) return 0;
  const interArea = (ixMax - ixMin) * (iyMax - iyMin);
  const minArea = Math.min(boxA.area, boxB.area);
  return Math.min(1.0, interArea / Math.max(0.001, minArea));
}

/**
 * Checks if a 2D point is contained within a bounding box (with optional tolerance).
 */
export function isPointInBox(pt, box, tolerance = 0.05) {
  if (!pt || !box) return false;
  return (
    pt.x >= box.minX - tolerance &&
    pt.x <= box.maxX + tolerance &&
    pt.y >= box.minY - tolerance &&
    pt.y <= box.maxY + tolerance
  );
}

/**
 * Euclidean distance between two 2D points.
 */
function dist2D(p1, p2) {
  if (!p1 || !p2) return Infinity;
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Computes finger direction vector from wrist (0) to middle MCP (9).
 */
function getHandDirectionVector(landmarks) {
  if (!landmarks || landmarks.length < 21) return { x: 0, y: -1 };
  const wrist = landmarks[0];
  const middleMcp = landmarks[9];
  const dx = middleMcp.x - wrist.x;
  const dy = middleMcp.y - wrist.y;
  const len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
  return { x: dx / len, y: dy / len };
}

/**
 * Returns average distance from fingertips (8, 12, 16, 20) to palm center.
 */
function getAvgFingertipToPalmDist(landmarks, palmCenter) {
  if (!landmarks || !palmCenter) return Infinity;
  const tipIndices = [8, 12, 16, 20];
  let sum = 0;
  for (const idx of tipIndices) {
    sum += dist2D(landmarks[idx], palmCenter);
  }
  return sum / tipIndices.length;
}

// -------------------------------------------------------------
// The 6 Landmark Geometry Rules (MediaPipe Normalized)
// -------------------------------------------------------------

/**
 * STEP 1: Palm to Palm (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - Palm centres closer than ~0.6 hand-widths
 * - Fingers pointing the same way (dot product of direction vectors > 0.5)
 * 
 * Tunable Thresholds:
 * - STEP_1_PALM_DISTANCE: default 0.60
 * - STEP_1_FINGER_DIR_DOT: default 0.50
 */
export function checkStep1PalmToPalm(handsData = [], thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS) {
  if (!handsData || handsData.length === 0) return false;

  // Case A: Overlapping hands merged into 1 detected hand
  if (handsData.length === 1) {
    const h = handsData[0];
    if (!h.landmarks) return false;
    return isMergedHand(h.landmarks, h.scale);
  }

  // Case B: 2 detected hands
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  // If either detected hand is already marked as merged
  if (hA.isMerged || hB.isMerged) return true;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  if (!palmA || !palmB) return false;

  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  const avgHandWidth = Math.max(0.01, (scaleA + scaleB) / 2);

  const palmDist = dist2D(palmA, palmB);
  const normalizedPalmDist = palmDist / avgHandWidth;
  const maxPalmDist = thresholds?.STEP_1_PALM_DISTANCE ?? 0.60;
  if (normalizedPalmDist > maxPalmDist) return false;

  const dirA = getHandDirectionVector(hA.landmarks);
  const dirB = getHandDirectionVector(hB.landmarks);
  const dot = (dirA.x * dirB.x) + (dirA.y * dirB.y);
  const minDot = thresholds?.STEP_1_FINGER_DIR_DOT ?? 0.50;

  return dot >= minDot;
}

/**
 * STEP 2: Palm Over Back of Hand (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - Bounding boxes overlap > 50%
 * - One hand's palm centre inside the other's bounding box
 * 
 * Tunable Thresholds:
 * - STEP_2_BOX_OVERLAP: default 0.50
 */
export function checkStep2PalmOverDorsum(handsData = [], thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS) {
  if (!handsData || handsData.length < 2) return false;
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const boxA = getHandBoundingBox(hA.landmarks);
  const boxB = getHandBoundingBox(hB.landmarks);
  const overlap = computeBoxOverlap(boxA, boxB);
  const minOverlap = thresholds?.STEP_2_BOX_OVERLAP ?? 0.50;
  if (overlap < minOverlap) return false;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  if (!palmA || !palmB) return false;

  const palmAInBoxB = isPointInBox(palmA, boxB);
  const palmBInBoxA = isPointInBox(palmB, boxA);

  return palmAInBoxB || palmBInBoxA;
}

/**
 * STEP 3: Fingers Interlaced (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - Bounding boxes overlap > 60%
 * - Fingertip x-positions of the two hands alternate across horizontal axis
 * 
 * Tunable Thresholds:
 * - STEP_3_BOX_OVERLAP: default 0.60
 * - STEP_3_MIN_ALTERNATIONS: default 2
 */
export function checkStep3FingersInterlaced(handsData = [], thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS) {
  if (!handsData || handsData.length < 2) return false;
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const boxA = getHandBoundingBox(hA.landmarks);
  const boxB = getHandBoundingBox(hB.landmarks);
  const overlap = computeBoxOverlap(boxA, boxB);
  const minOverlap = thresholds?.STEP_3_BOX_OVERLAP ?? 0.60;
  if (overlap < minOverlap) return false;

  // Collect fingertips of both hands (index, middle, ring, pinky)
  const tipIndices = [8, 12, 16, 20];
  const tips = [];
  for (const idx of tipIndices) {
    tips.push({ x: hA.landmarks[idx].x, owner: 'A' });
    tips.push({ x: hB.landmarks[idx].x, owner: 'B' });
  }

  // Sort fingertips by horizontal x coordinate
  tips.sort((a, b) => a.x - b.x);

  // Count owner alternations (A -> B or B -> A)
  let alternations = 0;
  for (let i = 1; i < tips.length; i++) {
    if (tips[i].owner !== tips[i - 1].owner) {
      alternations++;
    }
  }

  const minAlternations = thresholds?.STEP_3_MIN_ALTERNATIONS ?? 2;
  return alternations >= minAlternations;
}

/**
 * STEP 4: Backs of Fingers to Opposing Palms (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - Fingers of one hand curled (fingertip-to-palm distance is small)
 * - Curled fingers rest on the opposing hand's palm
 * 
 * Tunable Thresholds:
 * - STEP_4_CURL_RATIO: default 0.85
 * - STEP_4_RESTING_DIST: default 0.80
 */
export function checkStep4BacksOfFingers(handsData = [], thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS) {
  if (!handsData || handsData.length < 2) return false;
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  if (!palmA || !palmB) return false;

  const maxCurlRatio = thresholds?.STEP_4_CURL_RATIO ?? 0.85;
  const maxRestingDist = thresholds?.STEP_4_RESTING_DIST ?? 0.80;

  // Check if Hand A is curled and resting on Palm B
  const tipDistA = getAvgFingertipToPalmDist(hA.landmarks, palmA);
  const isACurled = (tipDistA / Math.max(0.01, scaleA)) <= maxCurlRatio;
  const aRestingOnB = isACurled && (dist2D(palmA, palmB) <= scaleB * maxRestingDist);

  // Check symmetrically if Hand B is curled and resting on Palm A
  const tipDistB = getAvgFingertipToPalmDist(hB.landmarks, palmB);
  const isBCurled = (tipDistB / Math.max(0.01, scaleB)) <= maxCurlRatio;
  const bRestingOnA = isBCurled && (dist2D(palmB, palmA) <= scaleA * maxRestingDist);

  return aRestingOnB || bRestingOnA;
}

/**
 * STEP 5: Rotational Rubbing of Thumbs (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - One thumb tip (landmark 4) inside the other hand's fist / palm area
 * - Rotation movement present above threshold
 * 
 * Tunable Thresholds:
 * - STEP_5_THUMB_PALM_DIST: default 0.80
 * - STEP_5_ROTATION_MOVEMENT: default 0.03
 */
export function checkStep5Thumbs(
  handsData = [],
  handMovement = 0,
  thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS
) {
  if (!handsData || handsData.length < 2) return false;
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const thumbA = hA.landmarks[4];
  const thumbB = hB.landmarks[4];
  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  if (!thumbA || !thumbB || !palmA || !palmB) return false;

  const maxDistRatio = thresholds?.STEP_5_THUMB_PALM_DIST ?? 0.80;
  const minMovement = thresholds?.STEP_5_ROTATION_MOVEMENT ?? 0.03;

  const boxA = getHandBoundingBox(hA.landmarks);
  const boxB = getHandBoundingBox(hB.landmarks);

  // Thumb A inside Palm/Fist B
  const thumbAInB = dist2D(thumbA, palmB) <= (scaleB * maxDistRatio) || isPointInBox(thumbA, boxB);
  // Thumb B inside Palm/Fist A
  const thumbBInA = dist2D(thumbB, palmA) <= (scaleA * maxDistRatio) || isPointInBox(thumbB, boxA);

  const thumbClasped = thumbAInB || thumbBInA;
  const movementPassed = handMovement >= minMovement;

  return thumbClasped && movementPassed;
}

/**
 * STEP 6: Rotational Rubbing of Fingertips (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - Fingertips of one hand (tips 8, 12, 16, 20) within the opposing palm's area
 * - Circular / rubbing movement present
 * 
 * Tunable Thresholds:
 * - STEP_6_FINGERTIP_DIST: default 0.60
 * - STEP_6_CIRCULAR_MOVEMENT: default 0.03
 */
export function checkStep6Fingertips(
  handsData = [],
  handMovement = 0,
  thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS
) {
  if (!handsData || handsData.length < 2) return false;
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  if (!palmA || !palmB) return false;

  const maxDistRatio = thresholds?.STEP_6_FINGERTIP_DIST ?? 0.60;
  const minMovement = thresholds?.STEP_6_CIRCULAR_MOVEMENT ?? 0.03;

  // Fingertips of Hand A centered in Palm B
  const tipsA = [hA.landmarks[8], hA.landmarks[12], hA.landmarks[16], hA.landmarks[20]];
  const avgTipA = {
    x: tipsA.reduce((acc, p) => acc + p.x, 0) / 4,
    y: tipsA.reduce((acc, p) => acc + p.y, 0) / 4
  };
  const tipsAInPalmB = dist2D(avgTipA, palmB) <= (scaleB * maxDistRatio);

  // Fingertips of Hand B centered in Palm A
  const tipsB = [hB.landmarks[8], hB.landmarks[12], hB.landmarks[16], hB.landmarks[20]];
  const avgTipB = {
    x: tipsB.reduce((acc, p) => acc + p.x, 0) / 4,
    y: tipsB.reduce((acc, p) => acc + p.y, 0) / 4
  };
  const tipsBInPalmA = dist2D(avgTipB, palmA) <= (scaleA * maxDistRatio);

  const tipsInPalm = tipsAInPalmB || tipsBInPalmA;
  const movementPassed = handMovement >= minMovement;

  return tipsInPalm && movementPassed;
}

/**
 * Master dispatcher: Evaluates the geometry rule corresponding to the current target step.
 * 
 * @param {number} stepNumber (1 - 6)
 * @param {Array} handsData MediaPipe hands data array
 * @param {number} handMovement Current frame hand movement
 * @param {object} customThresholds Optional override thresholds
 * @returns {{ passed: boolean, ruleName: string, stepNumber: number }}
 */
export function evaluateDryModeGeometry(
  stepNumber,
  handsData = [],
  handMovement = 0,
  customThresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS
) {
  const thresholds = customThresholds || HANDWASH_CONFIG.GEOMETRY_THRESHOLDS;
  let passed = false;
  let ruleName = `Step ${stepNumber}`;

  switch (stepNumber) {
    case 1:
      ruleName = 'Step 1 (Palm to Palm)';
      passed = checkStep1PalmToPalm(handsData, thresholds);
      break;
    case 2:
      ruleName = 'Step 2 (Palm over Dorsum)';
      passed = checkStep2PalmOverDorsum(handsData, thresholds);
      break;
    case 3:
      ruleName = 'Step 3 (Fingers Interlaced)';
      passed = checkStep3FingersInterlaced(handsData, thresholds);
      break;
    case 4:
      ruleName = 'Step 4 (Backs of Fingers)';
      passed = checkStep4BacksOfFingers(handsData, thresholds);
      break;
    case 5:
      ruleName = 'Step 5 (Rotational Thumbs)';
      passed = checkStep5Thumbs(handsData, handMovement, thresholds);
      break;
    case 6:
      ruleName = 'Step 6 (Fingertips on Palm)';
      passed = checkStep6Fingertips(handsData, handMovement, thresholds);
      break;
    default:
      passed = false;
  }

  return { passed, ruleName, stepNumber };
}
