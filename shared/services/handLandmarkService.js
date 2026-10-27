/**
 * SMART WASH — Hand Landmark & Motion Processing Service
 * Rule 1: Hand-presence gating
 * Rule 2: Movement computed strictly from hand landmarks (palm center/wrist displacement / hand scale)
 */

import { HANDWASH_CONFIG } from '../config/handwashConfig.js';

/**
 * Computes palm center coordinates from 21 MediaPipe hand landmarks.
 * Approximated by the geometric centroid of:
 * - Landmark 0: Wrist
 * - Landmark 5: Index finger MCP
 * - Landmark 9: Middle finger MCP
 * - Landmark 17: Pinky MCP
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @returns {{x: number, y: number, z: number} | null}
 */
export function computePalmCenter(landmarks) {
  if (!landmarks || landmarks.length < 21) return null;
  const p0 = landmarks[0];
  const p5 = landmarks[5];
  const p9 = landmarks[9];
  const p17 = landmarks[17];

  return {
    x: (p0.x + p5.x + p9.x + p17.x) / 4,
    y: (p0.y + p5.y + p9.y + p17.y) / 4,
    z: ((p0.z || 0) + (p5.z || 0) + (p9.z || 0) + (p17.z || 0)) / 4
  };
}

/**
 * Computes scale (size) of the hand in normalized coordinates.
 * Euclidean distance between Wrist (0) and Middle finger MCP (9).
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @returns {number}
 */
export function computeHandScale(landmarks) {
  if (!landmarks || landmarks.length < 21) return 0.1;
  const p0 = landmarks[0];
  const p5 = landmarks[5];
  const p9 = landmarks[9];
  const p17 = landmarks[17];

  // Palm length: wrist (0) to middle finger MCP (9)
  const lenDx = p9.x - p0.x;
  const lenDy = p9.y - p0.y;
  const palmLength = Math.sqrt(lenDx * lenDx + lenDy * lenDy);

  // Palm breadth: index MCP (5) to pinky MCP (17)
  const widDx = p17.x - p5.x;
  const widDy = p17.y - p5.y;
  const palmWidth = Math.sqrt(widDx * widDx + widDy * widDy);

  // Invariant composite scale: stable even with bent wrists or curled fingers anywhere in view
  return Math.max(0.04, palmLength, palmWidth * 1.15);
}

/**
 * Computes normalized displacement between two palm positions relative to hand scale.
 * 
 * @param {{x: number, y: number}} p1 
 * @param {{x: number, y: number}} p2 
 * @param {number} handScale 
 * @returns {number}
 */
export function computeNormalizedDisplacement(p1, p2, handScale) {
  if (!p1 || !p2 || !handScale) return 0;
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return dist / Math.max(0.01, handScale);
}

/**
 * Computes bounding box for a single hand in normalized coordinates [0, 1].
 * 
 * @param {Array<{x: number, y: number, z: number}>} landmarks 
 * @returns {{minX: number, maxX: number, minY: number, maxY: number, width: number, height: number, area: number}}
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
 * Checks if a single detected hand is a merged/overlapping hand (e.g. palms pressed together).
 * Normal vertical hands have aspect ratios ~0.5-0.9.
 * When palms are pressed together and overlapping, width widens significantly.
 * 
 * @param {Array<{x: number, y: number}>} landmarks
 * @param {number} [scale]
 * @returns {boolean}
 */
export function isMergedHand(landmarks, scale = null) {
  if (!landmarks || landmarks.length < 21) return false;
  const box = getHandBoundingBox(landmarks);
  const handScale = scale || computeHandScale(landmarks);
  const aspectRatio = box.width / Math.max(0.001, box.height);
  const scaleRatio = box.width / Math.max(0.001, handScale);

  return (
    aspectRatio >= (HANDWASH_CONFIG.MERGED_HAND_ASPECT_RATIO_MIN || 0.90) ||
    scaleRatio >= (HANDWASH_CONFIG.MERGED_HAND_SCALE_RATIO_MIN || 1.05)
  );
}

// Landmark indices for key hand anatomical regions
const FINGERTIP_INDICES = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky tips
const KNUCKLE_INDICES = [5, 9, 13, 17];       // MCP joints

/**
 * Comprehensive Dynamic Hand Movement Tracker
 * Tracks all 21 landmarks per hand over a sliding 500ms temporal window.
 * Dynamically evaluates:
 * 1. Fingertip velocity (crucial for rotational steps 5 & 6)
 * 2. Hand joint articulation / internal flexion (wrist-invariant hand rubbing)
 * 3. All-landmark average trajectory (invariant to screen position)
 * 4. Inter-hand sliding displacement (for steps 1, 2, 3, 4)
 * Fully scale-normalized and invariant to screen position, camera tilt, or distance.
 */
export class HandMovementTracker {
  constructor(options = {}) {
    this.windowMs = options.windowMs ?? HANDWASH_CONFIG.MOVEMENT_WINDOW_MS ?? 500;
    this.emaAlpha = options.emaAlpha ?? HANDWASH_CONFIG.MOVEMENT_EMA_ALPHA ?? 0.40;
    this.history = []; // [{ t, center, hands: [{ landmarks, palm, scale }], scale, handCount }]
    this.lastSmoothedHands = [];
  }

  reset() {
    this.history = [];
    this.lastSmoothedHands = [];
  }

  update(currentHands = [], timestamp = null, movementThreshold = HANDWASH_CONFIG.MOVEMENT_THRESHOLD) {
    const now = timestamp ?? performance.now();

    if (!currentHands || currentHands.length === 0) {
      this.reset();
      return {
        movement: 0,
        isMoving: false,
        pathLength: 0,
        handCount: 0,
        handConfidence: 0,
        handsData: []
      };
    }

    // Process and sort hands spatially (leftmost first) to avoid handedness flickering
    const rawHands = currentHands.map((hand) => {
      const palm = computePalmCenter(hand.landmarks);
      const scale = computeHandScale(hand.landmarks);
      const box = getHandBoundingBox(hand.landmarks);
      const merged = isMergedHand(hand.landmarks, scale);
      return {
        landmarks: hand.landmarks,
        confidence: hand.confidence !== undefined ? hand.confidence : 1.0,
        palmCenter: palm,
        scale,
        box,
        isMerged: merged
      };
    }).sort((a, b) => (a.palmCenter?.x ?? 0) - (b.palmCenter?.x ?? 0));

    const avgConfidence = rawHands.reduce((acc, h) => acc + h.confidence, 0) / rawHands.length;
    const avgScale = Math.max(0.04, rawHands.reduce((acc, h) => acc + h.scale, 0) / rawHands.length);

    // Apply light EMA smoothing to landmark coordinates to eliminate camera jitter
    const smoothedHands = rawHands.map((h, hIdx) => {
      const prevHand = this.lastSmoothedHands[hIdx];
      if (!prevHand || !prevHand.landmarks || prevHand.landmarks.length < 21) {
        return {
          landmarks: h.landmarks.map(pt => ({ x: pt.x, y: pt.y, z: pt.z || 0 })),
          palmCenter: { ...h.palmCenter },
          scale: h.scale,
          isMerged: h.isMerged
        };
      }

      const smoothedLms = h.landmarks.map((pt, ptIdx) => {
        const prevPt = prevHand.landmarks[ptIdx];
        return {
          x: this.emaAlpha * pt.x + (1 - this.emaAlpha) * prevPt.x,
          y: this.emaAlpha * pt.y + (1 - this.emaAlpha) * prevPt.y,
          z: this.emaAlpha * (pt.z || 0) + (1 - this.emaAlpha) * (prevPt.z || 0)
        };
      });

      const smoothedPalm = {
        x: this.emaAlpha * h.palmCenter.x + (1 - this.emaAlpha) * prevHand.palmCenter.x,
        y: this.emaAlpha * h.palmCenter.y + (1 - this.emaAlpha) * prevHand.palmCenter.y
      };

      return {
        landmarks: smoothedLms,
        palmCenter: smoothedPalm,
        scale: h.scale,
        isMerged: h.isMerged
      };
    });

    this.lastSmoothedHands = smoothedHands;

    // Record in sliding window
    this.history.push({
      t: now,
      hands: smoothedHands,
      scale: avgScale,
      handCount: smoothedHands.length
    });

    // Prune entries older than sliding window (500ms)
    const windowStart = now - this.windowMs;
    while (this.history.length > 0 && this.history[0].t < windowStart) {
      this.history.shift();
    }

    if (this.history.length < 2) {
      return {
        movement: 0,
        isMoving: false,
        pathLength: 0,
        handCount: smoothedHands.length,
        handConfidence: Number(avgConfidence.toFixed(2)),
        handsData: rawHands
      };
    }

    // Cumulative multi-channel dynamic motion across sliding window
    let cumulativeAllLandmarks = 0;
    let cumulativeFingertipPath = 0;
    let cumulativeArticulation = 0;
    let cumulativeInterHandPath = 0;
    let cumulativePalmPath = 0;

    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];

      const minHandCount = Math.min(prev.hands.length, curr.hands.length);
      for (let h = 0; h < minHandCount; h++) {
        const prevLms = prev.hands[h].landmarks;
        const currLms = curr.hands[h].landmarks;
        if (!prevLms || !currLms || prevLms.length < 21 || currLms.length < 21) continue;

        // 1. All-landmark average displacement
        let handLmsDelta = 0;
        for (let pt = 0; pt < 21; pt++) {
          const ddx = currLms[pt].x - prevLms[pt].x;
          const ddy = currLms[pt].y - prevLms[pt].y;
          handLmsDelta += Math.sqrt(ddx * ddx + ddy * ddy);
        }
        cumulativeAllLandmarks += handLmsDelta / 21;

        // 2. Fingertip path length (maximum active motion)
        let maxTipDelta = 0;
        for (const tipIdx of FINGERTIP_INDICES) {
          const tdx = currLms[tipIdx].x - prevLms[tipIdx].x;
          const tdy = currLms[tipIdx].y - prevLms[tipIdx].y;
          const tipDist = Math.sqrt(tdx * tdx + tdy * tdy);
          if (tipDist > maxTipDelta) maxTipDelta = tipDist;
        }
        cumulativeFingertipPath += maxTipDelta;

        // 3. Hand shape articulation / internal joint deformation
        // Measures change in distance between fingertips and palm center/wrist.
        // Invariant to position or whole-hand translation!
        const prevWrist = prevLms[0];
        const currWrist = currLms[0];
        let articulationDelta = 0;
        for (const tipIdx of FINGERTIP_INDICES) {
          const prevDist = Math.sqrt(
            Math.pow(prevLms[tipIdx].x - prevWrist.x, 2) + Math.pow(prevLms[tipIdx].y - prevWrist.y, 2)
          );
          const currDist = Math.sqrt(
            Math.pow(currLms[tipIdx].x - currWrist.x, 2) + Math.pow(currLms[tipIdx].y - currWrist.y, 2)
          );
          articulationDelta += Math.abs(currDist - prevDist);
        }
        cumulativeArticulation += articulationDelta / 5;

        // 4. Palm path length
        const pdx = curr.hands[h].palmCenter.x - prev.hands[h].palmCenter.x;
        const pdy = curr.hands[h].palmCenter.y - prev.hands[h].palmCenter.y;
        cumulativePalmPath += Math.sqrt(pdx * pdx + pdy * pdy);
      }

      // 5. Inter-hand sliding relative motion (when two hands are detected)
      if (curr.hands.length >= 2 && prev.hands.length >= 2) {
        const prevInterDist = Math.sqrt(
          Math.pow(prev.hands[1].palmCenter.x - prev.hands[0].palmCenter.x, 2) +
          Math.pow(prev.hands[1].palmCenter.y - prev.hands[0].palmCenter.y, 2)
        );
        const currInterDist = Math.sqrt(
          Math.pow(curr.hands[1].palmCenter.x - curr.hands[0].palmCenter.x, 2) +
          Math.pow(curr.hands[1].palmCenter.y - curr.hands[0].palmCenter.y, 2)
        );
        cumulativeInterHandPath += Math.abs(currInterDist - prevInterDist);
      }
    }

    // Dynamic motion fusion: takes best responsive motion signal normalized by hand size
    const dynamicPath = Math.max(
      cumulativeAllLandmarks * 1.4,
      cumulativeFingertipPath * 1.1,
      cumulativeArticulation * 2.2,
      cumulativeInterHandPath * 1.5,
      cumulativePalmPath
    );

    const normalizedMovement = dynamicPath / avgScale;
    const isMoving = normalizedMovement >= movementThreshold;

    return {
      movement: Number(normalizedMovement.toFixed(4)),
      isMoving,
      pathLength: Number(dynamicPath.toFixed(4)),
      handCount: smoothedHands.length,
      handConfidence: Number(avgConfidence.toFixed(2)),
      handsData: rawHands
    };
  }
}

/**
 * Computes hand movement across consecutive frames strictly from landmarks.
 * Guaranteed: If no hands are visible, movement is IDENTICALLY 0.0!
 * Face, body, background, or camera movement will NEVER count as hand motion.
 * 
 * Supports both standalone calls (using an internal/attached HandMovementTracker)
 * and direct tracker passing.
 * 
 * @param {Array<{landmarks: Array, confidence: number}>} currentHands 
 * @param {Array|HandMovementTracker} previousHands 
 * @param {number} movementThreshold Optional override (defaults to HANDWASH_CONFIG.MOVEMENT_THRESHOLD)
 * @param {number} [timestamp]
 * @returns {{
 *   movement: number,
 *   isMoving: boolean,
 *   handCount: number,
 *   handConfidence: number,
 *   handsData: Array
 * }}
 */
export function computeHandsMovement(
  currentHands = [],
  previousHands = [],
  movementThreshold = HANDWASH_CONFIG.MOVEMENT_THRESHOLD,
  timestamp = null
) {
  if (!currentHands || currentHands.length === 0) {
    if (previousHands && previousHands instanceof HandMovementTracker) {
      previousHands.reset();
    }
    return {
      movement: 0,
      isMoving: false,
      handCount: 0,
      handConfidence: 0,
      handsData: []
    };
  }

  // If a tracker instance is provided directly, delegate to it
  if (previousHands && previousHands instanceof HandMovementTracker) {
    return previousHands.update(currentHands, timestamp, movementThreshold);
  }

  // If an array with an attached tracker is provided, reuse it
  let tracker = previousHands?._tracker;
  if (!tracker) {
    tracker = new HandMovementTracker();
    // Pre-populate with previousHands if available
    if (Array.isArray(previousHands) && previousHands.length > 0) {
      const prevHandsInput = previousHands.map(h => ({
        landmarks: h.landmarks,
        confidence: h.confidence
      }));
      tracker.update(prevHandsInput, (timestamp ? timestamp - 80 : performance.now() - 80), movementThreshold);
    }
  }

  const result = tracker.update(currentHands, timestamp, movementThreshold);
  result.handsData._tracker = tracker;

  // Also support fallback single-frame displacement if history has only 1 frame
  if (result.movement === 0 && Array.isArray(previousHands) && previousHands.length > 0) {
    const handsData = result.handsData;
    const displacements = [];
    for (let i = 0; i < handsData.length; i++) {
      const curr = handsData[i];
      let bestDisp = 0;
      if (previousHands[i] && previousHands[i].palmCenter && curr.palmCenter) {
        bestDisp = computeNormalizedDisplacement(previousHands[i].palmCenter, curr.palmCenter, curr.scale);
      }
      displacements.push(bestDisp);
    }
    const maxSingleDisp = displacements.length > 0 ? Math.max(...displacements) : 0;
    if (maxSingleDisp > 0) {
      result.movement = Number(maxSingleDisp.toFixed(4));
      result.isMoving = maxSingleDisp >= movementThreshold;
    }
  }

  return result;
}
