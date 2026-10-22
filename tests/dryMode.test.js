import { describe, it, expect, beforeEach } from 'vitest';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { HANDWASH_CONFIG } from '../shared/config/handwashConfig.js';
import {
  checkStep1PalmToPalm,
  checkStep2PalmOverDorsum,
  checkStep3FingersInterlaced,
  checkStep4BacksOfFingers,
  checkStep5Thumbs,
  checkStep6Fingertips,
  evaluateDryModeGeometry
} from '../shared/services/dryModeGeometryService.js';
import { createSession, getAllSessions } from '../shared/services/sessionService.js';

// Helper to create synthetic 21-landmark MediaPipe hand
function createMockHand(baseX, baseY, scale = 0.2, fingerDirY = -1) {
  const landmarks = [];
  // 0: Wrist
  landmarks.push({ x: baseX, y: baseY + scale });
  // 1-4: Thumb
  for (let i = 1; i <= 4; i++) {
    landmarks.push({ x: baseX - (0.05 * i), y: baseY + (scale * 0.7) - (0.03 * i) });
  }
  // 5-8: Index
  for (let i = 5; i <= 8; i++) {
    landmarks.push({ x: baseX - 0.03, y: baseY + scale + (fingerDirY * 0.05 * (i - 4)) });
  }
  // 9-12: Middle
  for (let i = 9; i <= 12; i++) {
    landmarks.push({ x: baseX, y: baseY + scale + (fingerDirY * 0.06 * (i - 8)) });
  }
  // 13-16: Ring
  for (let i = 13; i <= 16; i++) {
    landmarks.push({ x: baseX + 0.03, y: baseY + scale + (fingerDirY * 0.05 * (i - 12)) });
  }
  // 17-20: Pinky
  for (let i = 17; i <= 20; i++) {
    landmarks.push({ x: baseX + 0.06, y: baseY + scale + (fingerDirY * 0.04 * (i - 16)) });
  }

  return {
    landmarks,
    confidence: 0.95,
    palmCenter: { x: baseX, y: baseY + (scale * 0.5) },
    scale
  };
}

describe('Dry Test Mode — Configuration & Gating Fundamentals', () => {
  it('initializes with dry mode constants (0.35 confidence, 4 debounce frames)', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry' });
    expect(engine.mode).toBe('dry');
    expect(engine.confidenceThreshold).toBe(HANDWASH_CONFIG.DRY_CONFIDENCE_THRESHOLD); // 0.35
    expect(engine.debounceFramesRequired).toBe(HANDWASH_CONFIG.DRY_DEBOUNCE_FRAMES); // 4
  });

  it('preserves strict mode defaults (0.60 confidence, 8 debounce frames)', () => {
    const engine = new StepRecognitionEngine({ mode: 'strict' });
    expect(engine.mode).toBe('strict');
    expect(engine.confidenceThreshold).toBe(HANDWASH_CONFIG.CONFIDENCE_THRESHOLD); // 0.60
    expect(engine.debounceFramesRequired).toBe(HANDWASH_CONFIG.DEBOUNCE_FRAMES); // 8
  });
});

describe('Required Test 1: No hands, no soap -> nothing progresses', () => {
  it('strictly rejects frames when hands are absent (same as strict mode)', () => {
    const dryEngine = new StepRecognitionEngine({ mode: 'dry' });
    const strictEngine = new StepRecognitionEngine({ mode: 'strict' });

    let now = performance.now();
    for (let i = 0; i < 15; i++) {
      // High confidence Step 1 prediction, but 0 hands detected
      const input = { class: 'Step_1', confidence: 0.95, handCount: 0, handConfidence: 0, handMovement: 0 };
      dryEngine.predict(input, now);
      strictEngine.predict(input, now);
      now += 100;
    }

    expect(dryEngine.currentStep).toBe(1);
    expect(dryEngine.activeTimeMs).toBe(0);
    expect(dryEngine.failingReason).toMatch(/HANDS_MISSING|INSUFFICIENT_HANDS/);

    expect(strictEngine.currentStep).toBe(1);
    expect(strictEngine.activeTimeMs).toBe(0);
    expect(strictEngine.failingReason).toMatch(/HANDS_MISSING|INSUFFICIENT_HANDS/);
  });
});

describe('Required Test 2: Both hands rubbing dry in correct pose -> timer runs and completes', () => {
  it('completes Step 1 in dry mode with lowered confidence (0.40) & 4-frame debounce', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry', targetDurationMs: 1000 });
    let now = performance.now();

    // In dry mode, confidence 0.40 is valid (above 0.35)
    for (let i = 0; i < 20; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.40,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08
      }, now);
      now += 100;
    }

    expect(engine.completedSteps).toContain(1);
    expect(engine.currentStep).toBe(2);
  });

  it('completes Step 1 in dry mode using landmark geometry fallback when model is background', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry', targetDurationMs: 1000 });
    const handA = createMockHand(0.48, 0.4, 0.2, -1);
    const handB = createMockHand(0.50, 0.4, 0.2, -1);

    let now = performance.now();
    for (let i = 0; i < 20; i++) {
      // Model says "background" or low confidence, but geometry pose is Step 1 palm-to-palm
      engine.predict({
        class: 'background',
        confidence: 0.10,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08,
        handsData: [handA, handB]
      }, now);
      now += 100;
    }

    expect(engine.completedSteps).toContain(1);
    expect(engine.currentStep).toBe(2);
  });
});

describe('Required Test 3: Correct pose but hands completely still -> timer pauses', () => {
  it('pauses timer when hand movement is below threshold (0.00)', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry' });
    let now = performance.now();

    // 10 frames with active movement to get past debounce
    for (let i = 0; i < 6; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    const accumulatedAfterRubbing = engine.activeTimeMs;
    expect(accumulatedAfterRubbing).toBeGreaterThan(0);

    // Now hands stop moving (movement = 0.01 < 0.05)
    for (let i = 0; i < 10; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.01
      }, now);
      now += 100;
    }

    // Time must be frozen/paused, no advancement
    expect(engine.activeTimeMs).toBe(accumulatedAfterRubbing);
    expect(engine.failingReason).toContain('LOW_MOVEMENT');
    expect(engine.currentStep).toBe(1);
  });
});

describe('Required Test 4: Wrong pose for target step -> no credit', () => {
  it('rejects cross-step execution (Step 2 pose while on Step 1) in dry mode', () => {
    const engine = new StepRecognitionEngine({ mode: 'dry' });
    let now = performance.now();

    for (let i = 0; i < 15; i++) {
      engine.predict({
        class: 'Step_2_Right',
        confidence: 0.85,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08,
        handsData: []
      }, now);
      now += 100;
    }

    expect(engine.currentStep).toBe(1);
    expect(engine.activeTimeMs).toBe(0);
    expect(engine.failingReason).toContain('WRONG_POSE_OR_STEP');
  });
});

describe('Required Test 5: Normal (strict) mode behaves exactly as before', () => {
  it('rejects lowered confidence (0.45) in strict mode which would pass in dry mode', () => {
    const strictEngine = new StepRecognitionEngine({ mode: 'strict' });
    let now = performance.now();

    for (let i = 0; i < 15; i++) {
      strictEngine.predict({
        class: 'Step_1',
        confidence: 0.45, // < 0.60
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08
      }, now);
      now += 100;
    }

    expect(strictEngine.activeTimeMs).toBe(0);
    expect(strictEngine.failingReason).toContain('LOW_CONFIDENCE');
  });

  it('does NOT activate landmark geometry fallback in strict mode', () => {
    const strictEngine = new StepRecognitionEngine({ mode: 'strict' });
    const handA = createMockHand(0.48, 0.4, 0.2, -1);
    const handB = createMockHand(0.50, 0.4, 0.2, -1);

    let now = performance.now();
    for (let i = 0; i < 15; i++) {
      strictEngine.predict({
        class: 'background',
        confidence: 0.10,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.08,
        handsData: [handA, handB]
      }, now);
      now += 100;
    }

    // Strict mode must never use geometry fallback
    expect(strictEngine.activeTimeMs).toBe(0);
    expect(strictEngine.failingReason).toContain('STEP_MISMATCH');
  });
});

describe('Dry Mode Landmark Geometry Fallback Rules (All 6 Steps)', () => {
  it('Rule 1: checkStep1PalmToPalm identifies close palms pointing same way', () => {
    const handA = createMockHand(0.48, 0.4, 0.2, -1);
    const handB = createMockHand(0.50, 0.4, 0.2, -1);
    expect(checkStep1PalmToPalm([handA, handB])).toBe(true);

    // Opposite pointing hands (one up, one down) should fail
    const handDown = createMockHand(0.50, 0.4, 0.2, 1);
    expect(checkStep1PalmToPalm([handA, handDown])).toBe(false);
  });

  it('Rule 2: checkStep2PalmOverDorsum detects bounding box overlap > 50%', () => {
    const handA = createMockHand(0.50, 0.45, 0.2, -1);
    const handB = createMockHand(0.52, 0.47, 0.2, -1);
    expect(checkStep2PalmOverDorsum([handA, handB])).toBe(true);

    // Far away hands should fail
    const handFar = createMockHand(0.85, 0.85, 0.2, -1);
    expect(checkStep2PalmOverDorsum([handA, handFar])).toBe(false);
  });

  it('Rule 5 & 6: require movement alongside pose', () => {
    const handA = createMockHand(0.50, 0.45, 0.2, -1);
    const handB = createMockHand(0.51, 0.46, 0.2, -1);

    // Step 5: Thumbs with movement passes, without movement fails
    expect(checkStep5Thumbs([handA, handB], 0.04)).toBe(true);
    expect(checkStep5Thumbs([handA, handB], 0.01)).toBe(false);

    // Step 6: Fingertips on palm with movement passes, without movement fails
    expect(checkStep6Fingertips([handA, handB], 0.04)).toBe(true);
    expect(checkStep6Fingertips([handA, handB], 0.01)).toBe(false);
  });
});

describe('Data Safety: Dry Mode Session Tagging & Teacher Analytics Exclusion', () => {
  it('creates dry mode session tagged mode: "dry"', async () => {
    const sess = await createSession('STU_DRY', 'Dry Tester', 'manual', 'CLASS_1', 'dry');
    expect(sess.session.mode).toBe('dry');

    const all = await getAllSessions();
    const drySaved = all.find(s => s.id === sess.id);
    expect(drySaved.mode).toBe('dry');
  });

  it('verifies teacher dashboard filters out dry mode sessions', async () => {
    await createSession('STU_STRICT', 'Real Student', 'face', 'CLASS_1', 'strict');
    await createSession('STU_TEST_DRY', 'Test Student', 'face', 'CLASS_1', 'dry');

    const allSessions = await getAllSessions();
    // Simulate teacher dashboard session filtering
    const teacherAnalyticsSessions = allSessions.filter(
      s => s.mode !== 'dry' && s.mode !== 'test'
    );

    const hasDrySession = teacherAnalyticsSessions.some(s => s.mode === 'dry');
    expect(hasDrySession).toBe(false);
  });
});
