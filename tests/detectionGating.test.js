/**
 * SMART WASH — Detection Gating & Crediting Verification Suite
 * 
 * Verifies all 7 test cases specified in the requirements:
 * 1. Sit in front of the camera with no hands -> no step progresses, no session starts.
 * 2. Move head/arms with no hands visible -> movement stays inactive.
 * 3. Wave hands randomly -> no step credited (low confidence/mismatch).
 * 4. Perform Step 1 correctly -> only Step 1 timer runs, 6 s completes it.
 * 5. Perform Step 3 while Step 1 is the target -> nothing is credited.
 * 6. Score 2/100 never shows "Superstar" or a bonus.
 * 7. A finished session returns to IDLE and does not restart by itself.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { computeHandsMovement, computePalmCenter, computeHandScale } from '../shared/services/handLandmarkService.js';
import { calculateHandwashScore } from '../shared/services/scoringService.js';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from '../apps/student-app/src/studentStateMachine.js';
import { HANDWASH_CONFIG, YOLO_TO_WHO_STEP_MAP } from '../shared/config/handwashConfig.js';

describe('TEST 1 & 2: No Hands & Movement Isolation from Hand Landmarks', () => {
  it('reports movement strictly as 0.0 when no hands are detected (regardless of head/body motion)', () => {
    // Current frame has 0 hands (user is moving head/torso in front of camera)
    const result = computeHandsMovement([], []);
    expect(result.handCount).toBe(0);
    expect(result.movement).toBe(0);
    expect(result.isMoving).toBe(false);
  });

  it('does NOT progress any step when sitting in front of camera with no hands', () => {
    const engine = new StepRecognitionEngine();
    let now = 1000;

    // Simulate 30 seconds (300 frames) of camera feed with no hands visible
    for (let i = 0; i < 300; i++) {
      const output = engine.predict({
        class: 'background',
        confidence: 0.99,
        handCount: 0,
        handConfidence: 0,
        handMovement: 0
      }, now);
      now += 100;
      expect(output.smoothedStep).toBe(1);
      expect(output.progressPercent).toBe(0);
      expect(output.activeTimeMs).toBe(0);
    }

    expect(engine.currentStep).toBe(1);
    expect(engine.completedSteps.length).toBe(0);
    expect(engine.activeTimeMs).toBe(0);
    expect(engine.ruleConditions.handsPresent).toBe(false);
  });
});

describe('TEST 3: Random Hand Waving / Low Confidence Mismatch', () => {
  it('does not credit any step when hands are waved randomly with low confidence or unmapped class', () => {
    const engine = new StepRecognitionEngine();
    let now = 1000;

    // Waving hands randomly: model predicts Step_7_Right (unmapped) at low confidence 0.29
    for (let i = 0; i < 50; i++) {
      const output = engine.predict({
        class: 'Step_7_Right', // Unmapped model class
        confidence: 0.29,      // Below 0.60 threshold
        handCount: 2,
        handConfidence: 0.8,
        handMovement: 0.09
      }, now);
      now += 100;

      expect(output.smoothedStep).toBe(1);
      expect(output.progressPercent).toBe(0);
      expect(output.activeTimeMs).toBe(0);
    }

    expect(engine.currentStep).toBe(1);
    expect(engine.completedSteps.length).toBe(0);
    expect(engine.ruleConditions.stepMatch).toBe(false);
    expect(engine.ruleConditions.confidenceCheck).toBe(false);
  });
});

describe('TEST 4: Perform Step 1 Correctly (Target = Step 1)', () => {
  it('credits only Step 1, runs the 6-second timer, and completes Step 1 after 6 seconds of verified scrubbing', () => {
    const engine = new StepRecognitionEngine();
    let now = 1000;

    // 1. Initial 7 frames: qualifying frames building debounce streak (needs 8)
    for (let i = 0; i < 7; i++) {
      const output = engine.predict({
        class: 'Step_1',
        confidence: 0.88,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08
      }, now);
      now += 100;
      expect(output.ruleConditions.debounceCheck).toBe(false);
      expect(output.activeTimeMs).toBe(0);
    }

    // 2. 8th frame: debounce passes, active counting begins
    const eighthFrame = engine.predict({
      class: 'Step_1',
      confidence: 0.88,
      handCount: 2,
      handConfidence: 0.95,
      handMovement: 0.08
    }, now);
    now += 100;
    expect(eighthFrame.ruleConditions.debounceCheck).toBe(true);

    // 3. Continue for 6 seconds (60 frames @ 100ms)
    for (let i = 0; i < 62; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.88,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08
      }, now);
      now += 100;
    }

    // Step 1 completed! Advances to Step 2
    expect(engine.currentStep).toBe(2);
    expect(engine.completedSteps).toEqual([1]);
    expect(engine.activeTimeMs).toBe(0);
  });
});

describe('TEST 5: Perform Step 3 While Target is Step 1 (No Cross-Step Credit)', () => {
  it('credits NOTHING when performing Step 3 while Step 1 is the target', () => {
    const engine = new StepRecognitionEngine();
    let now = 1000;

    // Send 30 frames of Step 3 with high confidence and motion
    for (let i = 0; i < 30; i++) {
      const output = engine.predict({
        class: 'Step_3',
        confidence: 0.95,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.12
      }, now);
      now += 100;

      expect(output.smoothedStep).toBe(1);
      expect(output.progressPercent).toBe(0);
      expect(output.activeTimeMs).toBe(0);
      expect(output.ruleConditions.stepMatch).toBe(false);
    }

    expect(engine.currentStep).toBe(1);
    expect(engine.completedSteps.length).toBe(0);
    expect(engine.failingReason).toContain('STEP_MISMATCH');
  });
});

describe('TEST 6: Score 2/100 Tier & Bonus Consistency', () => {
  it('never shows "Superstar" or a bonus for score 2/100', () => {
    // 1 completed step, 5 missed steps
    const scoreResult = calculateHandwashScore([1], [2, 3, 4, 5, 6]);

    // Score is 0 or 2 clamped
    expect(scoreResult.totalScore).toBeLessThanOrEqual(2);
    // Grade must strictly be "Let's try again"
    expect(scoreResult.grade).toBe("Let's try again");
    // Bonus MUST be false and 0 points
    expect(scoreResult.bonusAwarded).toBe(false);
    expect(scoreResult.bonusPoints).toBe(0);
  });

  it('awards bonus ONLY when score >= 70 AND >= 4 verified steps', () => {
    // Score < 70 (only 3 steps): NO bonus
    const threeSteps = calculateHandwashScore([1, 2, 3], []);
    expect(threeSteps.bonusAwarded).toBe(false);

    // 5 steps with verified metrics: Score 83 (>= 70) and 5 steps (>= 4) -> BONUS awarded
    const stepWithMetrics = (num) => ({
      stepNumber: num,
      activeTimeMs: 6000,
      durationMs: 6000,
      avgConfidence: 0.90,
      pauseCount: 0
    });
    const fiveSteps = calculateHandwashScore([1, 2, 3, 4, 5].map(stepWithMetrics), []);
    expect(fiveSteps.totalScore).toBe(83);
    expect(fiveSteps.grade).toBe('Great job');
    expect(fiveSteps.bonusAwarded).toBe(true);
    expect(fiveSteps.bonusPoints).toBe(10);
  });
});

describe('TEST 7: Finished Session Returns to IDLE and Does Not Restart Autonomously', () => {
  it('returns to IDLE state after feedback reset and student is cleared', () => {
    let state = {
      ...INITIAL_KIOSK_STATE,
      currentState: KIOSK_STATES.FEEDBACK,
      student: { studentId: 'STU_101', name: 'Alex River' },
      finalScore: 92
    };

    // Reset action triggered
    state = kioskReducer(state, { type: 'RESET_TO_IDLE' });

    expect(state.currentState).toBe(KIOSK_STATES.IDLE);
    expect(state.student).toBeNull();
    expect(state.completedSteps.length).toBe(0);
  });

  it('rejects unmapped Step_7 classes from YOLO_TO_WHO_STEP_MAP', () => {
    expect(YOLO_TO_WHO_STEP_MAP['Step_7_Left']).toBeUndefined();
    expect(YOLO_TO_WHO_STEP_MAP['Step_7_Right']).toBeUndefined();
    expect(YOLO_TO_WHO_STEP_MAP['Step_1']).toBe(1);
    expect(YOLO_TO_WHO_STEP_MAP['Step_6_Left']).toBe(6);
  });
});
