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
 * Computes 3D surface normal vector for a palm using landmarks:
 * - Landmark 0: Wrist
 * - Landmark 5: Index MCP
 * - Landmark 17: Pinky MCP
 * Invariant to 3D rotation, roll, pitch, and yaw.
 */
export function computePalmNormal(landmarks) {
  if (!landmarks || landmarks.length < 21) return { x: 0, y: 0, z: 1 };
  const p0 = landmarks[0];
  const p5 = landmarks[5];
  const p17 = landmarks[17];

  const z0 = p0.z || 0;
  const z5 = p5.z || 0;
  const z17 = p17.z || 0;

  const v1 = { x: p5.x - p0.x, y: p5.y - p0.y, z: z5 - z0 };
  const v2 = { x: p17.x - p0.x, y: p17.y - p0.y, z: z17 - z0 };

  // Cross product: v1 x v2
  const nx = v1.y * v2.z - v1.z * v2.y;
  const ny = v1.z * v2.x - v1.x * v2.z;
  const nz = v1.x * v2.y - v1.y * v2.x;

  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-5) return { x: 0, y: 0, z: 1 };
  return { x: nx / len, y: ny / len, z: nz / len };
}

/**
 * 3D dot product between two vector objects.
 */
export function dotProduct3D(v1, v2) {
  if (!v1 || !v2) return 0;
  return (v1.x * v2.x) + (v1.y * v2.y) + ((v1.z || 0) * (v2.z || 0));
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
// The 6 Landmark Geometry Rules (MediaPipe Normalized & Angle-Invariant)
// -------------------------------------------------------------

/**
 * STEP 1: Palm to Palm (Angle-Invariant 3D Geometry Rule)
 * 
 * Condition:
 * - Both hands present (or single merged-hand detection from overlapping palms)
 * - Palm centres closer than ~0.75 hand-widths
 * - Angle-invariant opposition: 3D palm surface normals face opposite directions (dot <= -0.20)
 *   OR finger direction vectors align (dot >= 0.40)
 *   OR bounding boxes overlap >= 35%
 */
export function checkStep1PalmToPalm(handsData = [], thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS) {
  if (!handsData || handsData.length === 0) return false;

  // Case A: Overlapping hands merged into 1 detected hand
  if (handsData.length === 1) {
    const h = handsData[0];
    if (!h.landmarks) return false;
    if (isMergedHand(h.landmarks, h.scale)) return true;

    // In natural rubbing, palms held vertically create a merged silhouette:
    // Check bounding box area and width relative to hand scale
    const box = getHandBoundingBox(h.landmarks);
    const handScale = h.scale || computeHandScale(h.landmarks);
    const scaleRatio = box.width / Math.max(0.001, handScale);
    if (scaleRatio >= 0.70 && box.area >= 0.012) {
      return true;
    }
    return false;
  }

  // Case B: 2 detected hands
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  if (!palmA || !palmB) return false;

  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  const avgHandWidth = Math.max(0.01, (scaleA + scaleB) / 2);

  const palmDist = dist2D(palmA, palmB);
  const normalizedPalmDist = palmDist / avgHandWidth;
  const maxPalmDist = thresholds?.STEP_1_PALM_DISTANCE ?? 0.85;
  const boxA = getHandBoundingBox(hA.landmarks);
  const boxB = getHandBoundingBox(hB.landmarks);
  const boxOverlap = computeBoxOverlap(boxA, boxB);

  const dirA = getHandDirectionVector(hA.landmarks);
  const dirB = getHandDirectionVector(hB.landmarks);
  const dirDot = (dirA.x * dirB.x) + (dirA.y * dirB.y);

  // Fingers pointing opposite ways (e.g. one pointing up, one down) is not palm to palm
  if (dirDot < 0.10) return false;

  // Close overlap during active scrubbing: hands overlap and fingers generally point in similar direction
  if (boxOverlap >= 0.15 && normalizedPalmDist <= (maxPalmDist * 1.8)) {
    return true;
  }

  // 1. 3D Palmar Surface Normal opposition (invariant to camera orientation)
  const normA = computePalmNormal(hA.landmarks);
  const normB = computePalmNormal(hB.landmarks);
  const normalDot = dotProduct3D(normA, normB);
  const minOpposition = thresholds?.STEP_1_NORMAL_OPPOSITION ?? -0.15;
  if (normalDot <= minOpposition && normalizedPalmDist <= (maxPalmDist * 1.8)) {
    return true;
  }

  // 2. 2D Finger Direction alignment
  const minDot = thresholds?.STEP_1_FINGER_DIR_DOT ?? 0.35;
  if (dirDot >= minDot && normalizedPalmDist <= (maxPalmDist * 1.8)) {
    return true;
  }

  // 3. Fallback: Bounding box overlap >= 15% within rubbing distance
  return boxOverlap >= (thresholds?.STEP_1_BOX_OVERLAP ?? 0.15) && normalizedPalmDist <= (maxPalmDist * 1.8);
}

/**
 * STEP 2: Palm Over Back of Hand (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - Bounding boxes overlap > 40%
 * - One hand's palm centre inside or touching the other's bounding box
 */
export function checkStep2PalmOverDorsum(handsData = [], thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS) {
  if (!handsData || handsData.length === 0) return false;

  // Case A: Overlapping / stacked hands merged into 1 detected hand (dorsum rub)
  if (handsData.length === 1) {
    const h = handsData[0];
    if (!h.landmarks) return false;
    if (isMergedHand(h.landmarks, h.scale)) return true;

    // In natural dorsum rubbing, one hand on top of another creates a merged silhouette:
    const box = getHandBoundingBox(h.landmarks);
    const handScale = h.scale || computeHandScale(h.landmarks);
    const scaleRatio = box.width / Math.max(0.001, handScale);
    if (scaleRatio >= 0.70 && box.area >= 0.012) {
      return true;
    }
    return false;
  }

  // Case B: 2 detected hands
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const boxA = getHandBoundingBox(hA.landmarks);
  const boxB = getHandBoundingBox(hB.landmarks);
  const overlap = computeBoxOverlap(boxA, boxB);
  const minOverlap = thresholds?.STEP_2_BOX_OVERLAP ?? 0.30;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  if (!palmA || !palmB) return false;

  const palmDist = dist2D(palmA, palmB);
  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  const avgScale = Math.max(0.01, (scaleA + scaleB) / 2);
  const normalizedPalmDist = palmDist / avgScale;

  const palmAInBoxB = isPointInBox(palmA, boxB, 0.08);
  const palmBInBoxA = isPointInBox(palmB, boxA, 0.08);

  // Both hands present: require bounding box overlap >= 30% OR close palms with palm-in-box contact
  if (overlap >= minOverlap && (palmAInBoxB || palmBInBoxA)) {
    return true;
  }
  if (overlap >= 0.20 && normalizedPalmDist <= 0.85) {
    return true;
  }

  return false;
}

/**
 * STEP 3: Fingers Interlaced (Approximate Geometry Rule)
 * 
 * Condition:
 * - Both hands present
 * - Bounding boxes overlap > 45%
 * - Fingertip positions of the two hands alternate across horizontal or vertical axis
 */
export function checkStep3FingersInterlaced(handsData = [], thresholds = HANDWASH_CONFIG.GEOMETRY_THRESHOLDS) {
  if (!handsData || handsData.length === 0) return false;

  // Case A: Overlapping hands merged into 1 detected hand (interlaced fingers)
  if (handsData.length === 1) {
    const h = handsData[0];
    if (!h.landmarks || h.landmarks.length < 21) return false;

    const box = getHandBoundingBox(h.landmarks);
    const handScale = h.scale || computeHandScale(h.landmarks);
    const scaleRatio = box.width / Math.max(0.001, handScale);
    const aspectRatio = box.width / Math.max(0.001, box.height);

    // Single merged hand from interlaced hands forms a wide merged contour
    if (isMergedHand(h.landmarks, handScale) || (scaleRatio >= 0.70 && box.area >= 0.012) || aspectRatio >= 0.85) {
      return true;
    }
    return false;
  }

  // Case B: 2 detected hands
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const boxA = getHandBoundingBox(hA.landmarks);
  const boxB = getHandBoundingBox(hB.landmarks);
  const overlap = computeBoxOverlap(boxA, boxB);
  const minOverlap = thresholds?.STEP_3_BOX_OVERLAP ?? 0.25;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  if (!palmA || !palmB) return false;

  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  const avgScale = Math.max(0.01, (scaleA + scaleB) / 2);
  const palmDist = dist2D(palmA, palmB);
  const normalizedPalmDist = palmDist / avgScale;

  // Both hands must be close together (hands in contact or overlapping)
  if (overlap < 0.15 && normalizedPalmDist > 1.2) return false;

  // Check finger direction vectors (both hands pointing generally in similar direction)
  const dirA = getHandDirectionVector(hA.landmarks);
  const dirB = getHandDirectionVector(hB.landmarks);
  const dirDot = (dirA.x * dirB.x) + (dirA.y * dirB.y);
  if (dirDot < -0.30) return false;

  // Distinguish from Step 2 (palm over dorsum):
  // Only reject if one hand is stacked flat on top of the other's dorsum with normals pointing same way
  const palmAInBoxB = isPointInBox(palmA, boxB, 0.02);
  const palmBInBoxA = isPointInBox(palmB, boxA, 0.02);
  const normA = computePalmNormal(hA.landmarks);
  const normB = computePalmNormal(hB.landmarks);
  const normalDot = dotProduct3D(normA, normB);
  if ((palmAInBoxB || palmBInBoxA) && normalDot > 0.50) {
    return false; // Stacking on back of hand is Step 2 (dorsum rub)
  }

  // Project fingertips onto the axis perpendicular to hand direction (angle-invariant lateral interleaving)
  const avgDirX = (dirA.x + dirB.x) / 2;
  const avgDirY = (dirA.y + dirB.y) / 2;
  const dirLen = Math.hypot(avgDirX, avgDirY) || 1;
  const perpX = -avgDirY / dirLen;
  const perpY = avgDirX / dirLen;

  const tipIndices = [8, 12, 16, 20];
  const tips = [];
  for (const idx of tipIndices) {
    if (hA.landmarks[idx]) tips.push({ proj: hA.landmarks[idx].x * perpX + hA.landmarks[idx].y * perpY, owner: 'A' });
    if (hB.landmarks[idx]) tips.push({ proj: hB.landmarks[idx].x * perpX + hB.landmarks[idx].y * perpY, owner: 'B' });
  }

  tips.sort((a, b) => a.proj - b.proj);
  let lateralAlternations = 0;
  for (let i = 1; i < tips.length; i++) {
    if (tips[i].owner !== tips[i - 1].owner) lateralAlternations++;
  }

  const minAlternations = thresholds?.STEP_3_MIN_ALTERNATIONS ?? 2;
  return lateralAlternations >= minAlternations;
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
  if (!handsData || handsData.length === 0) return false;

  const maxCurlRatio = thresholds?.STEP_4_CURL_RATIO ?? 0.95;
  const maxRestingDist = thresholds?.STEP_4_RESTING_DIST ?? 1.25;

  // Helper: Verifies true finger curling (tips curled inward toward wrist/palm)
  const isHandCurled = (landmarks, palm, scale) => {
    if (!landmarks || landmarks.length < 21) return false;
    const wrist = landmarks[0];
    let curledCount = 0;
    // Pairs: [tip, pip] for Index (8,6), Middle (12,10), Ring (16,14), Pinky (20,18)
    const pairs = [[8, 6], [12, 10], [16, 14], [20, 18]];
    for (const [tipIdx, pipIdx] of pairs) {
      if (landmarks[tipIdx] && landmarks[pipIdx]) {
        const tipToWrist = dist2D(landmarks[tipIdx], wrist);
        const pipToWrist = dist2D(landmarks[pipIdx], wrist);
        if (tipToWrist <= pipToWrist * 1.25) {
          curledCount++;
        }
      }
    }
    // Also check average fingertip distance to palm
    const tipDist = getAvgFingertipToPalmDist(landmarks, palm);
    const avgCurlPassed = (tipDist / Math.max(0.01, scale)) <= maxCurlRatio;

    return curledCount >= 2 || avgCurlPassed;
  };

  // Case A: Overlapping hands merged into 1 detected hand (locked/clasped fingers)
  if (handsData.length === 1) {
    const h = handsData[0];
    if (!h.landmarks || h.landmarks.length < 21) return false;

    const box = getHandBoundingBox(h.landmarks);
    const handScale = h.scale || computeHandScale(h.landmarks);
    const scaleRatio = box.width / Math.max(0.001, handScale);
    const aspectRatio = box.width / Math.max(0.001, box.height);
    const palm = h.palmCenter || computePalmCenter(h.landmarks);

    // Merged hand from locked/interlocked fingers forms a wide, compact contour
    if (isMergedHand(h.landmarks, handScale)) return true;
    if (scaleRatio >= 0.65 && box.area >= 0.012) return true;
    if (aspectRatio >= 0.75 && box.area >= 0.012) return true;
    if (palm && isHandCurled(h.landmarks, palm, handScale) && box.area >= 0.010) return true;

    return false;
  }

  // Case B: 2 detected hands
  const hA = handsData[0];
  const hB = handsData[1];
  if (!hA.landmarks || !hB.landmarks) return false;

  const palmA = hA.palmCenter || computePalmCenter(hA.landmarks);
  const palmB = hB.palmCenter || computePalmCenter(hB.landmarks);
  const scaleA = hA.scale || computeHandScale(hA.landmarks);
  const scaleB = hB.scale || computeHandScale(hB.landmarks);
  if (!palmA || !palmB) return false;

  const avgScale = Math.max(0.01, (scaleA + scaleB) / 2);
  const palmDist = dist2D(palmA, palmB);
  const normalizedPalmDist = palmDist / avgScale;

  const boxA = getHandBoundingBox(hA.landmarks);
  const boxB = getHandBoundingBox(hB.landmarks);
  const overlap = computeBoxOverlap(boxA, boxB);

  const isACurled = isHandCurled(hA.landmarks, palmA, scaleA);
  const isBCurled = isHandCurled(hB.landmarks, palmB, scaleB);

  // 1. One or both hands curled and in close proximity (resting on opposing palm/fingers)
  const aRestingOnB = isACurled && (palmDist <= scaleB * maxRestingDist);
  const bRestingOnA = isBCurled && (palmDist <= scaleA * maxRestingDist);
  if (aRestingOnB || bRestingOnA) return true;

  // 2. Overlapping hand bounding boxes with at least one curled hand or close palms
  if (overlap >= 0.20 && (isACurled || isBCurled || normalizedPalmDist <= 1.15)) {
    return true;
  }

  // 3. Hands in close clasp contact
  if (normalizedPalmDist <= 0.95 && overlap >= 0.15) {
    return true;
  }

  return false;
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
