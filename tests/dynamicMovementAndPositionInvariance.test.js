import { describe, it, expect, beforeEach } from 'vitest';
import {
  HandMovementTracker,
  computeHandScale,
  computePalmCenter,
  isMergedHand
} from '../shared/services/handLandmarkService.js';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { HANDWASH_CONFIG } from '../shared/config/handwashConfig.js';

// Helper to create synthetic 21 landmarks for a hand at given offset and scale
function createSyntheticHand(offsetX = 0.5, offsetY = 0.5, scale = 0.15, angleRad = 0.0) {
  // Base hand skeleton layout (wrist at 0, fingers extending upward)
  const basePoints = [
    [0.0, 0.0],       // 0: Wrist
    [-0.04, -0.04],   // 1: Thumb CMC
    [-0.07, -0.07],   // 2: Thumb MCP
    [-0.09, -0.10],   // 3: Thumb IP
    [-0.11, -0.13],   // 4: Thumb Tip
    [-0.04, -0.10],   // 5: Index MCP
    [-0.05, -0.14],   // 6: Index PIP
    [-0.05, -0.17],   // 7: Index DIP
    [-0.05, -0.20],   // 8: Index Tip
    [0.0, -0.11],     // 9: Middle MCP
    [0.0, -0.16],     // 10: Middle PIP
    [0.0, -0.19],     // 11: Middle DIP
    [0.0, -0.22],     // 12: Middle Tip
    [0.03, -0.10],    // 13: Ring MCP
    [0.04, -0.14],    // 14: Ring PIP
    [0.04, -0.17],    // 15: Ring DIP
    [0.04, -0.20],    // 16: Ring Tip
    [0.06, -0.09],    // 17: Pinky MCP
    [0.08, -0.12],    // 18: Pinky PIP
    [0.09, -0.15],    // 19: Pinky DIP
    [0.10, -0.17]     // 20: Pinky Tip
  ];

  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  return basePoints.map(([bx, by]) => {
    // Rotate and scale
    const rx = (bx * cosA - by * sinA) * (scale / 0.15);
    const ry = (bx * sinA + by * cosA) * (scale / 0.15);
    return {
      x: offsetX + rx,
      y: offsetY + ry,
      z: 0.0
    };
  });
}

describe('Dynamic Hand Movement & Position Invariance Suite', () => {
  let tracker;

  beforeEach(() => {
    tracker = new HandMovementTracker({ windowMs: 500 });
  });

  describe('Position Invariance Tests', () => {
    const testPositions = [
      { name: 'Center', x: 0.5, y: 0.5 },
      { name: 'Top-Left Corner', x: 0.12, y: 0.15 },
      { name: 'Top-Right Corner', x: 0.85, y: 0.18 },
      { name: 'Bottom-Left', x: 0.15, y: 0.82 },
      { name: 'Bottom-Right Corner', x: 0.82, y: 0.85 }
    ];

    testPositions.forEach(pos => {
      it(`computes consistent hand scale invariant to screen position (${pos.name})`, () => {
        const hand = createSyntheticHand(pos.x, pos.y, 0.18);
        const scale = computeHandScale(hand);

        // Scale should measure anatomical size (~0.18), not affected by position
        expect(scale).toBeGreaterThan(0.10);
        expect(scale).toBeLessThan(0.25);
      });
    });

    testPositions.forEach(pos => {
      it(`correctly recognizes stationary hands anywhere in the frame (${pos.name}) without false movement`, () => {
        const hand = createSyntheticHand(pos.x, pos.y, 0.15);
        const handsInput = [{ landmarks: hand, confidence: 0.95 }];

        // Simulate 6 frames of completely stationary hand
        let lastResult = null;
        for (let i = 0; i < 6; i++) {
          lastResult = tracker.update(handsInput, 1000 + i * 80);
        }

        expect(lastResult.isMoving).toBe(false);
        expect(lastResult.movement).toBeLessThan(0.01);
      });
    });
  });

  describe('Dynamic Motion Detection for WHO Handwashing Steps', () => {
    it('detects palm-to-palm sliding motion (Step 1)', () => {
      let result = null;
      // Simulate two hands sliding back and forth
      for (let f = 0; f < 8; f++) {
        const delta = Math.sin(f * 0.8) * 0.025;
        const leftHand = createSyntheticHand(0.48 - delta, 0.5, 0.15);
        const rightHand = createSyntheticHand(0.52 + delta, 0.5, 0.15);

        result = tracker.update([
          { landmarks: leftHand, confidence: 0.9 },
          { landmarks: rightHand, confidence: 0.9 }
        ], 1000 + f * 80);
      }

      expect(result.movement).toBeGreaterThan(0.02);
      expect(result.isMoving).toBe(true);
    });

    it('detects rotational fingertip rubbing on palm (Step 6)', () => {
      let result = null;
      // Palm stays stationary while fingertips circle
      const stationaryPalm = createSyntheticHand(0.45, 0.5, 0.15);

      for (let f = 0; f < 8; f++) {
        const angle = f * 0.8;
        const radius = 0.02;
        const circlingHand = createSyntheticHand(
          0.50 + Math.cos(angle) * radius,
          0.50 + Math.sin(angle) * radius,
          0.15
        );

        result = tracker.update([
          { landmarks: stationaryPalm, confidence: 0.9 },
          { landmarks: circlingHand, confidence: 0.9 }
        ], 1000 + f * 80);
      }

      expect(result.movement).toBeGreaterThan(0.02);
      expect(result.isMoving).toBe(true);
    });

    it('detects thumb rotational rubbing (Step 5)', () => {
      let result = null;
      // Right hand rotates around stationary left thumb
      const leftHand = createSyntheticHand(0.48, 0.5, 0.15);

      for (let f = 0; f < 8; f++) {
        const tiltAngle = (f % 2 === 0 ? 0.25 : -0.25);
        const rightHand = createSyntheticHand(0.52, 0.5, 0.15, tiltAngle);

        result = tracker.update([
          { landmarks: leftHand, confidence: 0.9 },
          { landmarks: rightHand, confidence: 0.9 }
        ], 1000 + f * 80);
      }

      expect(result.movement).toBeGreaterThan(0.02);
      expect(result.isMoving).toBe(true);
    });

    it('detects internal joint articulation / finger curling even if wrist is held fixed', () => {
      let result = null;
      for (let f = 0; f < 8; f++) {
        // Hand where wrist is stationary at (0.5, 0.5) but fingertips flex in and out
        const hand = createSyntheticHand(0.5, 0.5, 0.15);
        const flexFactor = 0.8 + 0.3 * Math.sin(f * 1.0);
        // Modify fingertips
        [4, 8, 12, 16, 20].forEach(tip => {
          hand[tip].x = hand[0].x + (hand[tip].x - hand[0].x) * flexFactor;
          hand[tip].y = hand[0].y + (hand[tip].y - hand[0].y) * flexFactor;
        });

        result = tracker.update([{ landmarks: hand, confidence: 0.95 }], 1000 + f * 80);
      }

      expect(result.movement).toBeGreaterThan(0.015);
      expect(result.isMoving).toBe(true);
    });
  });

  describe('StepRecognitionEngine Dynamic Motion Gating', () => {
    it('credits time when dynamic movement is detected', () => {
      const engine = new StepRecognitionEngine({
        mode: 'strict',
        movementThreshold: 0.020,
        consecutiveFramesRequired: 3
      });

      let output = null;
      let timestamp = 1000;

      // 4 qualifying frames with movement >= 0.020
      for (let i = 0; i < 6; i++) {
        timestamp += 100;
        output = engine.predict({
          class: 'Step_1',
          confidence: 0.85,
          handCount: 2,
          handConfidence: 0.9,
          handMovement: 0.045, // Dynamic motion detected!
          isHandsMoving: true,
          handsData: [{ landmarks: createSyntheticHand(0.5, 0.5), confidence: 0.9 }]
        }, timestamp);
      }

      expect(output.ruleConditions.movementCheck).toBe(true);
      expect(output.statusReason).toBe('Scrubbing active');
      expect(output.activeTimeMs).toBeGreaterThan(0);
    });

    it('pauses crediting and warns when hands are completely motionless', () => {
      const engine = new StepRecognitionEngine({
        mode: 'strict',
        movementThreshold: 0.020,
        consecutiveFramesRequired: 3
      });

      let output = null;
      let timestamp = 1000;

      // Feed stationary hand (handMovement = 0.005 < 0.020)
      for (let i = 0; i < 8; i++) {
        timestamp += 100;
        output = engine.predict({
          class: 'Step_1',
          confidence: 0.85,
          handCount: 2,
          handConfidence: 0.9,
          handMovement: 0.005, // Motionless!
          isHandsMoving: false,
          handsData: [{ landmarks: createSyntheticHand(0.5, 0.5), confidence: 0.9 }]
        }, timestamp);
      }

      expect(output.ruleConditions.movementCheck).toBe(false);
      expect(output.statusReason).toBe('Hands not moving');
    });
  });
});
