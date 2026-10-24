import { describe, it, expect, vi } from 'vitest';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { calculateHandwashScore } from '../shared/services/scoringService.js';
import { createDefaultSession, validateSessionContract } from '../shared/types.js';
import { YOLO_TO_WHO_STEP_MAP } from '../shared/config/handwashConfig.js';
import fs from 'fs';
import path from 'path';

describe('Audit: 6 Steps Handwashing Process Verification', () => {

  it('1. Video assets step_1.mp4 to step_6.mp4 exist in public/assets', () => {
    const assetsDir = path.resolve(__dirname, '../public/assets');
    expect(fs.existsSync(assetsDir)).toBe(true);

    for (let i = 1; i <= 6; i++) {
      const vidFile = path.join(assetsDir, `step_${i}.mp4`);
      expect(fs.existsSync(vidFile)).toBe(true);
      const stat = fs.statSync(vidFile);
      expect(stat.size).toBeGreaterThan(100000); // Verify non-empty video file
    }
  });

  it('2. Full 6-step sequential progression from Step 1 to Step 6 finishes with rawStep 7 and all 6 steps completed', () => {
    const engine = new StepRecognitionEngine({ mode: 'strict', targetDurationMs: 6000 });
    let now = 1000;

    for (let step = 1; step <= 6; step++) {
      // 8 frames debounce (800ms) + 60 frames @ 100ms (6000ms) = 68 frames
      for (let f = 0; f < 72; f++) {
        engine.predict({
          class: `Step_${step}`,
          confidence: 0.90,
          handCount: 2,
          handConfidence: 0.95,
          handMovement: 0.12
        }, now);
        now += 100;
      }
    }

    expect(engine.completedSteps).toEqual([1, 2, 3, 4, 5, 6]);
    expect(engine.currentStep).toBe(7);

    const scoreResult = calculateHandwashScore(engine.completedSteps, []);
    expect(scoreResult.totalScore).toBe(100);
    expect(scoreResult.grade).toBe('Superstar');
    expect(scoreResult.tier).toBe('SUPERSTAR');
    expect(scoreResult.bonusAwarded).toBe(true);
  });

  it('3. Robust class mapping handles lowercase, uppercase, and dash formats for all 6 steps', () => {
    const engine = new StepRecognitionEngine();

    for (let i = 1; i <= 6; i++) {
      expect(engine.getYoloClassStep(`step_${i}`)).toBe(i);
      expect(engine.getYoloClassStep(`Step_${i}`)).toBe(i);
      expect(engine.getYoloClassStep(`STEP_${i}`)).toBe(i);
      expect(engine.getYoloClassStep(`step-${i}`)).toBe(i);
      expect(engine.getYoloClassStep(`Step ${i}`)).toBe(i);
    }

    // Rejection of invalid / unmapped classes
    expect(engine.getYoloClassStep('Step_7_Left')).toBe(-1);
    expect(engine.getYoloClassStep('step_7')).toBe(-1);
    expect(engine.getYoloClassStep('background')).toBe(-1);
    expect(engine.getYoloClassStep('random_object')).toBe(-1);
  });

  it('4. Initial default session conforms to agreed data contract (validateSessionContract)', () => {
    const sess = createDefaultSession('STU_TEST_01', 'Audit Student');
    expect(validateSessionContract(sess)).toBe(true);
    expect(sess.score).toBe(0);
    expect(Array.isArray(sess.steps)).toBe(true);
  });
});
