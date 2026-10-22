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
  const p9 = landmarks[9];
  const dx = p9.x - p0.x;
  const dy = p9.y - p0.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  return Math.max(0.01, dist);
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
 * Computes hand movement across consecutive frames strictly from landmarks.
 * Guaranteed: If no hands are visible, movement is IDENTICALLY 0.0!
 * Face, body, background, or camera movement will NEVER count as hand motion.
 * 
 * @param {Array<{landmarks: Array, confidence: number}>} currentHands 
 * @param {Array<{landmarks: Array, palmCenter: object, scale: number}>} previousHands 
 * @param {number} movementThreshold Optional override (defaults to HANDWASH_CONFIG.MOVEMENT_THRESHOLD)
 * @returns {{
 *   movement: number,
 *   isMoving: boolean,
 *   handCount: number,
 *   handConfidence: number,
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
    aspectRatio >= (HANDWASH_CONFIG.MERGED_HAND_ASPECT_RATIO_MIN || 1.15) ||
    scaleRatio >= (HANDWASH_CONFIG.MERGED_HAND_SCALE_RATIO_MIN || 1.25)
  );
}

/**
 * Stateful Hand Movement Tracker
 * Tracks palm center and wrist positions over a sliding 500 ms window.
 * Applies light EMA (alpha = 0.5) smoothing to filter jitter and preserve slow rubbing.
 * Normalized movement = total path length / hand size.
 */
export class HandMovementTracker {
  constructor(options = {}) {
    this.windowMs = options.windowMs ?? HANDWASH_CONFIG.MOVEMENT_WINDOW_MS ?? 500;
    this.emaAlpha = options.emaAlpha ?? HANDWASH_CONFIG.MOVEMENT_EMA_ALPHA ?? 0.50;
    this.history = []; // [{ t, center, hands, scale }]
    this.lastSmoothedCenter = null;
    this.lastSmoothedHands = [];
  }

  reset() {
    this.history = [];
    this.lastSmoothedCenter = null;
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

    const handsData = currentHands.map((hand) => {
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
    });

    const avgConfidence = handsData.reduce((acc, h) => acc + h.confidence, 0) / handsData.length;
    const avgScale = handsData.reduce((acc, h) => acc + h.scale, 0) / handsData.length;

    // Palm center (or midpoint of 2 hands)
    let rawCenter = { x: 0, y: 0 };
    if (handsData.length === 1) {
      rawCenter = { x: handsData[0].palmCenter.x, y: handsData[0].palmCenter.y };
    } else {
      rawCenter = {
        x: (handsData[0].palmCenter.x + handsData[1].palmCenter.x) / 2,
        y: (handsData[0].palmCenter.y + handsData[1].palmCenter.y) / 2
      };
    }

    // Apply EMA 0.5 smoothing
    let smoothedCenter;
    if (!this.lastSmoothedCenter) {
      smoothedCenter = { ...rawCenter };
    } else {
      smoothedCenter = {
        x: this.emaAlpha * rawCenter.x + (1 - this.emaAlpha) * this.lastSmoothedCenter.x,
        y: this.emaAlpha * rawCenter.y + (1 - this.emaAlpha) * this.lastSmoothedCenter.y
      };
    }
    this.lastSmoothedCenter = smoothedCenter;

    // Smooth individual hand centers
    const smoothedHands = handsData.map((h, idx) => {
      const prev = this.lastSmoothedHands[idx];
      if (!prev) return { ...h.palmCenter };
      return {
        x: this.emaAlpha * h.palmCenter.x + (1 - this.emaAlpha) * prev.x,
        y: this.emaAlpha * h.palmCenter.y + (1 - this.emaAlpha) * prev.y
      };
    });
    this.lastSmoothedHands = smoothedHands;

    // Add entry to sliding window history
    this.history.push({
      t: now,
      center: smoothedCenter,
      hands: smoothedHands,
      scale: avgScale,
      handCount: handsData.length
    });

    // Prune entries older than sliding window (500ms)
    const windowStart = now - this.windowMs;
    while (this.history.length > 0 && this.history[0].t < windowStart) {
      this.history.shift();
    }

    // Calculate total path length over the sliding window
    let centerPath = 0;
    let hand0Path = 0;
    let hand1Path = 0;
    let relativeDistPath = 0;

    for (let i = 1; i < this.history.length; i++) {
      const prev = this.history[i - 1];
      const curr = this.history[i];

      const dx = curr.center.x - prev.center.x;
      const dy = curr.center.y - prev.center.y;
      centerPath += Math.sqrt(dx * dx + dy * dy);

      if (curr.hands[0] && prev.hands[0]) {
        const dx0 = curr.hands[0].x - prev.hands[0].x;
        const dy0 = curr.hands[0].y - prev.hands[0].y;
        hand0Path += Math.sqrt(dx0 * dx0 + dy0 * dy0);
      }
      if (curr.hands[1] && prev.hands[1]) {
        const dx1 = curr.hands[1].x - prev.hands[1].x;
        const dy1 = curr.hands[1].y - prev.hands[1].y;
        hand1Path += Math.sqrt(dx1 * dx1 + dy1 * dy1);
      }

      if (curr.hands.length >= 2 && prev.hands.length >= 2) {
        const prevDist = Math.sqrt(
          Math.pow(prev.hands[1].x - prev.hands[0].x, 2) +
          Math.pow(prev.hands[1].y - prev.hands[0].y, 2)
        );
        const currDist = Math.sqrt(
          Math.pow(curr.hands[1].x - curr.hands[0].x, 2) +
          Math.pow(curr.hands[1].y - curr.hands[0].y, 2)
        );
        relativeDistPath += Math.abs(currDist - prevDist);
      }
    }

    const bestPath = Math.max(centerPath, hand0Path, hand1Path, relativeDistPath);
    const normalizedMovement = bestPath / Math.max(0.01, avgScale);

    return {
      movement: Number(normalizedMovement.toFixed(4)),
      isMoving: normalizedMovement >= movementThreshold,
      pathLength: Number(bestPath.toFixed(4)),
      handCount: handsData.length,
      handConfidence: Number(avgConfidence.toFixed(2)),
      handsData
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
