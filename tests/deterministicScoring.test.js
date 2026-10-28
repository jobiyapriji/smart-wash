import { describe, it, expect, beforeEach } from 'vitest';
import { calculateHandwashScore } from '../shared/services/scoringService.js';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from '../apps/student-app/src/studentStateMachine.js';

describe('Deterministic Scoring & Session Isolation Test Suite', () => {
  const createStep = ({
    stepNumber,
    activeTimeMs = 6000,
    durationMs = 6000,
    avgConfidence = 0.92,
    pauseCount = 0,
    pauseDurationMs = 0,
    invalidPoseFrames = 0,
    completed = true
  }) => ({
    stepNumber,
    activeTimeMs,
    durationMs,
    avgConfidence,
    pauseCount,
    pauseDurationMs,
    invalidPoseFrames,
    completed
  });

  // 1. Perfect Session
  it('awards 100/100 and +15 Superstar bonus for a verified perfect 6-step session', () => {
    const perfectSteps = [1, 2, 3, 4, 5, 6].map(num => createStep({
      stepNumber: num,
      activeTimeMs: 6000,
      durationMs: 6000,
      avgConfidence: 0.95,
      pauseCount: 0
    }));

    const result = calculateHandwashScore(perfectSteps, []);

    expect(result.totalScore).toBe(100);
    expect(result.completionScore).toBe(60);
    expect(result.timeScore).toBe(20);
    expect(result.techniqueScore).toBe(20);
    expect(result.grade).toBe('Superstar');
    expect(result.tier).toBe('SUPERSTAR');
    expect(result.bonusAwarded).toBe(true);
    expect(result.bonusPoints).toBe(15);
  });

  // 2. Rushed Session (Distinguishes completion from perfect scrub duration)
  it('penalizes a rushed session where all 6 steps are finished with only 3s scrub each', () => {
    const rushedSteps = [1, 2, 3, 4, 5, 6].map(num => createStep({
      stepNumber: num,
      activeTimeMs: 3000, // Half of 6000ms target
      durationMs: 3000,
      avgConfidence: 0.88,
      pauseCount: 0
    }));

    const result = calculateHandwashScore(rushedSteps, []);

    // 60 completion + 10 time (half time) + 20 technique = 90
    expect(result.totalScore).toBe(90);
    expect(result.completionScore).toBe(60);
    expect(result.timeScore).toBe(10);
    expect(result.techniqueScore).toBe(20);
    // Student receives Great Job or Superstar, with standard bonus
    expect(result.totalScore).toBeLessThan(100);
  });

  // 3. Interrupted & Messy Session
  it('penalizes frequent interruptions, pauses, and invalid poses', () => {
    const messySteps = [1, 2, 3, 4, 5, 6].map(num => createStep({
      stepNumber: num,
      activeTimeMs: 6000,
      durationMs: 12000,
      avgConfidence: 0.72, // Lower confidence (confRatio ~ (0.72 - 0.60)/0.25 = 0.48)
      pauseCount: 2,       // Pauses incur penalty
      invalidPoseFrames: 10
    }));

    const result = calculateHandwashScore(messySteps, []);

    expect(result.totalScore).toBeLessThanOrEqual(85);
    expect(result.totalScore).toBeGreaterThanOrEqual(60);
    expect(result.breakdown.pauseCount).toBe(12);
  });

  // 4. Partial Session (3 completed steps, 3 missed)
  it('calculates score accurately for partial sessions with missed steps and awards 0 bonus', () => {
    const partialSteps = [1, 2, 3].map(num => createStep({
      stepNumber: num,
      activeTimeMs: 6000,
      durationMs: 6000,
      avgConfidence: 0.90,
      pauseCount: 0
    }));
    const missedSteps = [4, 5, 6];

    const result = calculateHandwashScore(partialSteps, missedSteps);

    // 30 completion + 10 time + 10 technique - 15 missed penalty = 35
    expect(result.totalScore).toBe(35);
    expect(result.grade).toBe("Let's try again");
    expect(result.tier).toBe('TRY_AGAIN');
    expect(result.bonusAwarded).toBe(false);
    expect(result.bonusPoints).toBe(0);
  });

  // 5. Incomplete / Poor Session
  it('handles incomplete session with 1 poorly executed step', () => {
    const poorSteps = [
      createStep({
        stepNumber: 1,
        activeTimeMs: 2000,
        avgConfidence: 0.62,
        pauseCount: 3,
        invalidPoseFrames: 15
      })
    ];
    const missedSteps = [2, 3, 4, 5, 6];

    const result = calculateHandwashScore(poorSteps, missedSteps);

    expect(result.totalScore).toBe(0);
    expect(result.grade).toBe("Let's try again");
    expect(result.bonusAwarded).toBe(false);
    expect(result.bonusPoints).toBe(0);
  });

  // 6. Determinism: Identical inputs ALWAYS produce identical scores
  it('is strictly deterministic: identical session records produce identical scores across 100 runs', () => {
    const sampleRecord = [
      createStep({ stepNumber: 1, activeTimeMs: 5500, avgConfidence: 0.86, pauseCount: 1 }),
      createStep({ stepNumber: 2, activeTimeMs: 6100, avgConfidence: 0.92, pauseCount: 0 }),
      createStep({ stepNumber: 3, activeTimeMs: 4800, avgConfidence: 0.79, pauseCount: 2 }),
      createStep({ stepNumber: 4, activeTimeMs: 6000, avgConfidence: 0.89, pauseCount: 0 }),
      createStep({ stepNumber: 5, activeTimeMs: 5200, avgConfidence: 0.84, pauseCount: 1 })
    ];

    const firstRun = calculateHandwashScore(sampleRecord, [6]);

    for (let i = 0; i < 100; i++) {
      const subsequentRun = calculateHandwashScore(sampleRecord, [6]);
      expect(subsequentRun.totalScore).toBe(firstRun.totalScore);
      expect(subsequentRun.completionScore).toBe(firstRun.completionScore);
      expect(subsequentRun.timeScore).toBe(firstRun.timeScore);
      expect(subsequentRun.techniqueScore).toBe(firstRun.techniqueScore);
      expect(subsequentRun.bonusAwarded).toBe(firstRun.bonusAwarded);
      expect(subsequentRun.bonusPoints).toBe(firstRun.bonusPoints);
    }
  });

  // 7. Deduplication: Duplicate step submissions do not inflate score
  it('deduplicates duplicate step submissions and prevents artificial point inflation', () => {
    const duplicatedSteps = [
      createStep({ stepNumber: 1, activeTimeMs: 6000, avgConfidence: 0.90 }),
      createStep({ stepNumber: 1, activeTimeMs: 6000, avgConfidence: 0.90 }),
      createStep({ stepNumber: 1, activeTimeMs: 6000, avgConfidence: 0.90 }),
      createStep({ stepNumber: 2, activeTimeMs: 6000, avgConfidence: 0.90 })
    ];

    const result = calculateHandwashScore(duplicatedSteps, [3, 4, 5, 6]);

    // Only steps 1 and 2 should be credited (20 completion points max)
    expect(result.breakdown.stepsCompleted).toBe(2);
    expect(result.completionScore).toBe(20);
  });

  // 8. Explicit Handling of Unrecorded Metrics (Never assume perfection)
  it('awards 0 time and 0 confidence points if timing or confidence metrics were never recorded', () => {
    // Array of plain step numbers (no duration or confidence metadata attached)
    const plainSteps = [1, 2, 3, 4];
    const result = calculateHandwashScore(plainSteps, [5, 6]);

    expect(result.breakdown.timePoints).toBe(0);
    expect(result.breakdown.confidencePoints).toBe(0);
    // Base completion for 4 steps: 40 points
    expect(result.completionScore).toBe(40);
  });

  // 9. Step Recognition Engine Reset & Session Isolation
  it('resets engine state cleanly between sessions, preventing state leakage', () => {
    const engine = new StepRecognitionEngine();
    let now = 1000;

    // Simulate Step 1 completion
    for (let f = 0; f < 70; f++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.90,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.12
      }, now);
      now += 100;
    }

    expect(engine.completedSteps.length).toBeGreaterThan(0);
    expect(engine.getStepRecords().length).toBeGreaterThan(0);

    // Reset engine for new session
    engine.reset();

    expect(engine.currentStep).toBe(1);
    expect(engine.completedSteps.length).toBe(0);
    expect(engine.missedSteps.length).toBe(0);
    expect(engine.activeTimeMs).toBe(0);
    expect(engine.completedStepRecords.length).toBe(0);
    expect(engine.stepMetrics).toEqual({});

    // Next frame received for new session initializes clean Step 1 metrics
    engine.predict({ class: 'Step_1', confidence: 0.90, handCount: 2 }, now);
    expect(engine.stepMetrics[1].activeTimeMs).toBe(0);
    expect(engine.stepMetrics[1].pauseCount).toBe(0);
  });

  // 10. Student State Machine Reset on New Student Identification
  it('resets score and completed steps in state machine when a new student is identified', () => {
    // Session 1: Finished student with score 95
    let state = {
      ...INITIAL_KIOSK_STATE,
      currentState: KIOSK_STATES.FEEDBACK,
      student: { studentId: 'STU_001', name: 'Alice' },
      completedSteps: [1, 2, 3, 4, 5, 6],
      finalScore: 95,
      scoreBreakdown: { completionPoints: 60, timePoints: 18, techniquePoints: 17 }
    };

    // New student arrives
    state = kioskReducer(state, {
      type: 'STUDENT_IDENTIFIED',
      payload: { student: { studentId: 'STU_002', name: 'Bob' } }
    });

    expect(state.student.studentId).toBe('STU_002');
    expect(state.student.name).toBe('Bob');
    expect(state.finalScore).toBe(0);
    expect(state.completedSteps).toEqual([]);
    expect(state.scoreBreakdown).toBeNull();
  });
});
