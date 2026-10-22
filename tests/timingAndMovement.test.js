/**
 * SMART WASH — Timing and Movement Verification Suite
 * 
 * Verifies the 6 key timing, movement, and gating requirements:
 * 1. Palm-to-palm pose, rub up/down for 6 s -> Step 1 completes in 6-8 s.
 * 2. Same pose but hands still for 3 s -> timer pauses, progress is kept.
 * 3. Hands hidden for 300 ms -> timer continues (holds last state < 500 ms).
 * 4. Hands hidden for 2 s -> timer pauses and shows "No hands".
 * 5. Wrong pose for Step 1 -> no credit ("Wrong pose for Step 1").
 * 6. A small face in the background does not block starting.
 * 
 * Bonus verification:
 * 7. Single merged hand (overlapping palms) is accepted for Step 1.
 */

import { describe, it, expect } from 'vitest';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { filterMultiPersonFaces } from '../shared/services/faceFilterService.js';
import { HANDWASH_CONFIG } from '../shared/config/handwashConfig.js';

describe('TEST 1: Palm-to-palm pose, rub up/down for 6 s -> Step 1 completes in 6-8 s', () => {
  it('completes Step 1 in 6.4 s in dry mode (4-frame debounce + 6.0 s dt accumulation)', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry' });
    let now = 1000;
    const startTime = now;
    let completedTimestamp = null;

    // Send frames @ 100ms interval with valid palm-to-palm pose and active rubbing
    for (let i = 0; i < 90; i++) {
      const output = engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.15,
        isHandsMoving: true
      }, now);

      if (output.completedSteps.includes(1) && completedTimestamp === null) {
        completedTimestamp = now;
      }
      now += 100;
    }

    expect(completedTimestamp).not.toBeNull();
    const totalDurationSec = (completedTimestamp - startTime) / 1000;
    // 4 frames debounce (400ms) + 60 frames dt (6000ms) = 6.4s
    expect(totalDurationSec).toBeGreaterThanOrEqual(6.0);
    expect(totalDurationSec).toBeLessThanOrEqual(8.0);
    expect(engine.completedSteps).toContain(1);
    expect(engine.currentStep).toBe(2);
  });

  it('completes Step 1 in 6.8 s in strict mode (8-frame debounce + 6.0 s dt accumulation)', () => {
    const engine = new StepRecognitionEngine({ mode: 'strict' });
    let now = 1000;
    const startTime = now;
    let completedTimestamp = null;

    // Send frames @ 100ms interval with valid palm-to-palm pose and active rubbing
    for (let i = 0; i < 90; i++) {
      const output = engine.predict({
        class: 'Step_1',
        confidence: 0.88,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.20,
        isHandsMoving: true
      }, now);

      if (output.completedSteps.includes(1) && completedTimestamp === null) {
        completedTimestamp = now;
      }
      now += 100;
    }

    expect(completedTimestamp).not.toBeNull();
    const totalDurationSec = (completedTimestamp - startTime) / 1000;
    // 8 frames debounce (800ms) + 60 frames dt (6000ms) = 6.8s
    expect(totalDurationSec).toBeGreaterThanOrEqual(6.0);
    expect(totalDurationSec).toBeLessThanOrEqual(8.0);
    expect(engine.completedSteps).toContain(1);
    expect(engine.currentStep).toBe(2);
  });
});

describe('TEST 2: Same pose but hands still for 3 s -> timer pauses, progress is kept', () => {
  it('pauses timer accumulation and retains progress when hands stop moving', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry' });
    let now = 1000;

    // 1. Rub actively for 2.4 seconds (24 frames after debounce)
    for (let i = 0; i < 28; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.15,
        isHandsMoving: true
      }, now);
      now += 100;
    }

    const progressBeforeStill = engine.activeTimeMs;
    expect(progressBeforeStill).toBeGreaterThanOrEqual(2000);
    expect(progressBeforeStill).toBeLessThan(6000);

    // 2. Same pose, but hands become still for 3 seconds (30 frames @ 100ms)
    for (let i = 0; i < 30; i++) {
      const output = engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.0,
        isHandsMoving: false
      }, now);
      now += 100;

      // During still period, timer MUST NOT advance
      expect(output.activeTimeMs).toBe(progressBeforeStill);
    }

    // Progress is preserved (not reset to 0)
    expect(engine.activeTimeMs).toBe(progressBeforeStill);
    expect(engine.graceState).toBe('PAUSED');
    expect(engine.statusReason).toBe('Hands not moving');
    expect(engine.currentStep).toBe(1);
    expect(engine.completedSteps.length).toBe(0);
  });
});

describe('TEST 3: Hands hidden for 300 ms -> timer continues', () => {
  it('continues timer accumulation without pausing when hands briefly drop for 300 ms', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry' });
    let now = 1000;

    // 1. Establish active scrubbing for 2.0 seconds
    for (let i = 0; i < 24; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.15,
        isHandsMoving: true
      }, now);
      now += 100;
    }

    const timeBeforeDropout = engine.activeTimeMs;

    // 2. Hands vanish from camera for 300 ms (3 frames @ 100ms)
    // < 500 ms hold duration retains last valid hand state
    for (let i = 0; i < 3; i++) {
      const output = engine.predict({
        class: 'background',
        confidence: 0.10,
        handCount: 0,
        handConfidence: 0.0,
        handMovement: 0.0
      }, now);
      now += 100;

      // Timer CONTINUES accumulating dt
      expect(output.activeTimeMs).toBeGreaterThan(timeBeforeDropout);
      expect(output.graceState).toBe('ACTIVE');
    }

    // 3. Hands reappear and continue scrubbing
    const outputAfterReappear = engine.predict({
      class: 'Step_1',
      confidence: 0.85,
      handCount: 2,
      handConfidence: 0.95,
      handMovement: 0.15,
      isHandsMoving: true
    }, now);

    expect(outputAfterReappear.activeTimeMs).toBeGreaterThan(timeBeforeDropout + 300);
    expect(engine.graceState).toBe('ACTIVE');
  });
});

describe('TEST 4: Hands hidden for 2 s -> timer pauses and shows "No hands"', () => {
  it('pauses timer after 500 ms grace/hold window expires and displays "No hands"', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry' });
    let now = 1000;

    // 1. Scrub actively for 2.0 seconds
    for (let i = 0; i < 24; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.15,
        isHandsMoving: true
      }, now);
      now += 100;
    }

    // 2. Hands hidden for 2 seconds (20 frames @ 100ms)
    for (let i = 0; i < 20; i++) {
      engine.predict({
        class: 'background',
        confidence: 0.0,
        handCount: 0,
        handConfidence: 0.0,
        handMovement: 0.0
      }, now);
      now += 100;
    }

    // After 2 seconds of no hands:
    expect(engine.graceState).toBe('PAUSED');
    expect(engine.statusReason).toBe('No hands');
    // Progress is retained, not reset to 0
    expect(engine.activeTimeMs).toBeGreaterThan(0);
    expect(engine.currentStep).toBe(1);
  });
});

describe('TEST 5: Wrong pose for Step 1 -> no credit', () => {
  it('rejects cross-step poses and reports exact status "Wrong pose for Step 1"', () => {
    const engine = new StepRecognitionEngine({ mode: 'strict' });
    let now = 1000;

    // Perform Step 2 (backs of hands) while target is Step 1
    for (let i = 0; i < 30; i++) {
      const output = engine.predict({
        class: 'Step_2_Right',
        confidence: 0.90,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.15,
        isHandsMoving: true
      }, now);
      now += 100;

      expect(output.activeTimeMs).toBe(0);
      expect(output.progressPercent).toBe(0);
      expect(output.statusReason).toBe('Wrong pose for Step 1');
    }

    expect(engine.currentStep).toBe(1);
    expect(engine.activeTimeMs).toBe(0);
    expect(engine.completedSteps.length).toBe(0);
  });
});

describe('TEST 6: A small face in the background does not block starting', () => {
  it('filters out background faces with area < 50% of the primary face', () => {
    // Primary student face: 250 x 250 = 62,500 px^2
    // Background face: 70 x 70 = 4,900 px^2 (ratio = 7.8% < 50%)
    const detections = [
      { box: { width: 250, height: 250 }, descriptor: new Float32Array(128) },
      { box: { width: 70, height: 70 }, descriptor: new Float32Array(128) }
    ];

    let consecutiveCount = 0;
    let dominantStartTime = 1000;

    // Simulate 15 consecutive frames with the background face present
    for (let i = 0; i < 15; i++) {
      const result = filterMultiPersonFaces(
        detections,
        consecutiveCount,
        dominantStartTime,
        1000 + (i * 100),
        HANDWASH_CONFIG
      );
      consecutiveCount = result.consecutiveCount;

      expect(result.significantFaces.length).toBe(1);
      expect(result.isBlocked).toBe(false);
    }
  });

  it('blocks when two large faces are present for 10 frames, but auto-continues after 2s of dominant stability', () => {
    // Two large faces: 250x250 and 240x240 (ratio = 92% >= 50%)
    const twoLargeFaces = [
      { box: { width: 250, height: 250 }, descriptor: new Float32Array(128) },
      { box: { width: 240, height: 240 }, descriptor: new Float32Array(128) }
    ];

    let consecutiveCount = 0;
    let dominantStartTime = 1000;
    let now = 1000;

    // Frames 1 to 9: building consecutive multi-face count
    for (let i = 0; i < 9; i++) {
      const result = filterMultiPersonFaces(
        twoLargeFaces,
        consecutiveCount,
        dominantStartTime,
        now,
        HANDWASH_CONFIG
      );
      consecutiveCount = result.consecutiveCount;
      dominantStartTime = result.dominantStartTime;
      now += 100;
      expect(result.isBlocked).toBe(false);
    }

    // Frame 10 (consecutiveCount = 10, dominant stable duration = 900ms < 2000ms): BLOCKED
    const frame10 = filterMultiPersonFaces(
      twoLargeFaces,
      consecutiveCount,
      dominantStartTime,
      now,
      HANDWASH_CONFIG
    );
    expect(frame10.consecutiveCount).toBe(10);
    expect(frame10.isBlocked).toBe(true);

    // After 2.0s of stable dominant face (now = 3100ms, elapsed = 2100ms >= 2000ms): AUTO-CONTINUE
    now = 3100;
    const stableResult = filterMultiPersonFaces(
      twoLargeFaces,
      15,
      dominantStartTime,
      now,
      HANDWASH_CONFIG
    );
    expect(stableResult.isBlocked).toBe(false);
  });
});

describe('TEST 7: Overlapping / Merged Hand Accepted for Step 1', () => {
  it('accepts 1 merged hand (aspect ratio >= 1.15) for Step 1 palm-to-palm rubbing', () => {
    const engine = new StepRecognitionEngine({ mode: 'strict' });
    let now = 1000;

    // Simulate 1 merged hand with motion
    for (let i = 0; i < 20; i++) {
      const output = engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 1,
        handConfidence: 0.90,
        isMerged: true,
        handMovement: 0.20,
        isHandsMoving: true
      }, now);
      now += 100;

      expect(output.ruleConditions.handsPresent).toBe(true);
    }

    expect(engine.isStepActive).toBe(true);
    expect(engine.activeTimeMs).toBeGreaterThan(0);
  });
});
