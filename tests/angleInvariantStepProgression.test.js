import { describe, it, expect } from 'vitest';
import {
  computePalmNormal,
  dotProduct3D,
  checkStep1PalmToPalm,
  checkStep2PalmOverDorsum,
  checkStep3FingersInterlaced,
  checkStep4BacksOfFingers,
  checkStep5Thumbs,
  checkStep6Fingertips,
  evaluateDryModeGeometry
} from '../shared/services/dryModeGeometryService.js';
import { StepRecognitionEngine } from '../shared/services/stepModelService.js';
import { HANDWASH_CONFIG } from '../shared/config/handwashConfig.js';

// Helper to construct a synthetic 21-landmark hand with 3D orientation
function create3DHand({
  wrist = { x: 0.5, y: 0.6, z: 0 },
  indexMcp = { x: 0.45, y: 0.45, z: 0 },
  middleMcp = { x: 0.5, y: 0.43, z: 0 },
  pinkyMcp = { x: 0.55, y: 0.48, z: 0 },
  scale = 0.20,
  isMerged = false,
  boxWidth = null,
  boxHeight = null
} = {}) {
  const landmarks = [];
  // 0: Wrist
  landmarks[0] = { x: wrist.x, y: wrist.y, z: wrist.z ?? 0 };

  // 1-4: Thumb
  for (let i = 1; i <= 4; i++) {
    landmarks[i] = {
      x: wrist.x - 0.04 * i,
      y: wrist.y - 0.03 * i,
      z: wrist.z ?? 0
    };
  }

  // 5-8: Index
  landmarks[5] = { x: indexMcp.x, y: indexMcp.y, z: indexMcp.z ?? 0 };
  for (let i = 6; i <= 8; i++) {
    landmarks[i] = {
      x: indexMcp.x + (indexMcp.x - wrist.x) * 0.2 * (i - 5),
      y: indexMcp.y + (indexMcp.y - wrist.y) * 0.2 * (i - 5),
      z: indexMcp.z ?? 0
    };
  }

  // 9-12: Middle
  landmarks[9] = { x: middleMcp.x, y: middleMcp.y, z: middleMcp.z ?? 0 };
  for (let i = 10; i <= 12; i++) {
    landmarks[i] = {
      x: middleMcp.x + (middleMcp.x - wrist.x) * 0.2 * (i - 9),
      y: middleMcp.y + (middleMcp.y - wrist.y) * 0.2 * (i - 9),
      z: middleMcp.z ?? 0
    };
  }

  // 13-16: Ring
  landmarks[13] = {
    x: (middleMcp.x + pinkyMcp.x) / 2,
    y: (middleMcp.y + pinkyMcp.y) / 2,
    z: middleMcp.z ?? 0
  };
  for (let i = 14; i <= 16; i++) {
    landmarks[i] = {
      x: landmarks[13].x + 0.02 * (i - 13),
      y: landmarks[13].y - 0.04 * (i - 13),
      z: landmarks[13].z ?? 0
    };
  }

  // 17-20: Pinky
  landmarks[17] = { x: pinkyMcp.x, y: pinkyMcp.y, z: pinkyMcp.z ?? 0 };
  for (let i = 18; i <= 20; i++) {
    landmarks[i] = {
      x: pinkyMcp.x + 0.02 * (i - 17),
      y: pinkyMcp.y - 0.03 * (i - 17),
      z: pinkyMcp.z ?? 0
    };
  }

  // Override bounding box dimensions if specified (e.g. for merged hand aspect ratio)
  if (boxWidth !== null && boxHeight !== null) {
    landmarks[4] = { x: wrist.x - boxWidth / 2, y: wrist.y, z: 0 };
    landmarks[20] = { x: wrist.x + boxWidth / 2, y: wrist.y - boxHeight, z: 0 };
  }

  return {
    landmarks,
    confidence: 0.95,
    palmCenter: {
      x: (landmarks[0].x + landmarks[5].x + landmarks[9].x + landmarks[17].x) / 4,
      y: (landmarks[0].y + landmarks[5].y + landmarks[9].y + landmarks[17].y) / 4,
      z: (landmarks[0].z + landmarks[5].z + landmarks[9].z + landmarks[17].z) / 4
    },
    scale,
    isMerged
  };
}

describe('Angle-Invariant 3D Palm Surface Normal & Relative Geometry', () => {
  it('computes opposite 3D surface normals for opposing palms (Step 1)', () => {
    // Hand A: Palm facing +Z (towards camera)
    const handA = create3DHand({
      wrist: { x: 0.45, y: 0.6, z: 0 },
      indexMcp: { x: 0.42, y: 0.45, z: 0 },
      pinkyMcp: { x: 0.48, y: 0.48, z: 0 }
    });

    // Hand B: Palm facing -Z (away from camera, towards Hand A)
    const handB = create3DHand({
      wrist: { x: 0.47, y: 0.6, z: 0.02 },
      indexMcp: { x: 0.50, y: 0.45, z: 0.02 },
      pinkyMcp: { x: 0.44, y: 0.48, z: 0.02 }
    });

    const normA = computePalmNormal(handA.landmarks);
    const normB = computePalmNormal(handB.landmarks);
    const dot = dotProduct3D(normA, normB);

    // Opposing normals produce negative dot product
    expect(dot).toBeLessThanOrEqual(-0.20);
    const passed = checkStep1PalmToPalm([handA, handB]);
    expect(passed).toBe(true);
  });

  it('validates Step 1 when hands are angled at 30-45 degrees tilt', () => {
    // Angled hands tilted diagonally (varying camera perspective)
    const handA = create3DHand({
      wrist: { x: 0.40, y: 0.55, z: 0.05 },
      indexMcp: { x: 0.35, y: 0.42, z: 0.08 },
      pinkyMcp: { x: 0.42, y: 0.44, z: 0.02 }
    });

    const handB = create3DHand({
      wrist: { x: 0.43, y: 0.56, z: 0.05 },
      indexMcp: { x: 0.47, y: 0.43, z: 0.02 },
      pinkyMcp: { x: 0.41, y: 0.45, z: 0.08 }
    });

    const result = evaluateDryModeGeometry(1, [handA, handB], 0.08);
    expect(result.passed).toBe(true);
    expect(result.ruleName).toBe('Step 1 (Palm to Palm)');
  });

  it('validates Step 1 when hands merge into a single wide detection box (aspect ratio >= 1.10)', () => {
    // Single detected hand with aspect ratio 1.35 representing merged palms
    const mergedHand = create3DHand({
      wrist: { x: 0.50, y: 0.60, z: 0 },
      scale: 0.20,
      boxWidth: 0.35,
      boxHeight: 0.25
    });

    const passed = checkStep1PalmToPalm([mergedHand]);
    expect(passed).toBe(true);
  });
});

describe('Adaptive Ensemble Fusion: Bypassing 6-Video ML Angle Constraint', () => {
  it('progresses and completes Step 1 in live kiosk mode even when ML model outputs background / low confidence due to camera angle', () => {
    const engine = new StepRecognitionEngine({
      mode: 'strict',
      enableGeometryFallback: true,
      targetDurationMs: 1000 // 1 second for fast unit test
    });

    // Realistic simulation:
    // Camera is mounted at an angle where the narrow 1-video trained LSTM outputs "background" with 0.20 confidence.
    // The student is physically performing Step 1 (palms touching, rubbing at 0.08 movement).
    const handA = create3DHand({
      wrist: { x: 0.45, y: 0.6, z: 0 },
      indexMcp: { x: 0.42, y: 0.45, z: 0 },
      pinkyMcp: { x: 0.48, y: 0.48, z: 0 }
    });
    const handB = create3DHand({
      wrist: { x: 0.47, y: 0.6, z: 0.02 },
      indexMcp: { x: 0.50, y: 0.45, z: 0.02 },
      pinkyMcp: { x: 0.44, y: 0.48, z: 0.02 }
    });

    let now = 1000;
    // Step requires 8 debounce frames before active counting begins
    for (let i = 0; i < 20; i++) {
      const output = engine.predict({
        class: 'background', // ML model failed to recognize step due to angle
        confidence: 0.20,    // Low ML confidence
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08,
        handsData: [handA, handB]
      }, now);
      now += 100;
    }

    // Thanks to Adaptive Ensemble Fusion, Step 1 passed and advanced to Step 2!
    expect(engine.currentStep).toBe(2);
    expect(engine.completedSteps).toEqual([1]);
  });

  it('rejects random hand motion when neither classifier nor 3D geometry matches', () => {
    const engine = new StepRecognitionEngine({
      mode: 'strict',
      enableGeometryFallback: true
    });

    // Two hands wide apart (palm distance > 1.0) waving randomly
    const handA = create3DHand({ wrist: { x: 0.15, y: 0.6, z: 0 } });
    const handB = create3DHand({ wrist: { x: 0.85, y: 0.6, z: 0 } });

    let now = 1000;
    for (let i = 0; i < 20; i++) {
      const output = engine.predict({
        class: 'background',
        confidence: 0.25,
        handCount: 2,
        handConfidence: 0.90,
        handMovement: 0.10,
        handsData: [handA, handB]
      }, now);
      now += 100;

      expect(output.activeTimeMs).toBe(0);
      expect(output.ruleConditions.stepMatch).toBe(false);
    }

    expect(engine.currentStep).toBe(1);
    expect(engine.completedSteps.length).toBe(0);
  });
});

describe('Step 3: Palm-to-Palm Fingers Interlaced Geometry & Transitions', () => {
  it('validates Step 3 when palms oppose each other and fingertips alternate', () => {
    // Hand A: Left hand with opposing normal
    const handA = create3DHand({
      wrist: { x: 0.45, y: 0.6, z: 0 },
      indexMcp: { x: 0.42, y: 0.45, z: 0 },
      pinkyMcp: { x: 0.48, y: 0.48, z: 0 }
    });
    // Hand B: Right hand with opposing normal
    const handB = create3DHand({
      wrist: { x: 0.47, y: 0.6, z: 0.02 },
      indexMcp: { x: 0.50, y: 0.45, z: 0.02 },
      pinkyMcp: { x: 0.44, y: 0.48, z: 0.02 }
    });

    // Interlace fingertips: alternate x coordinates of index(8), middle(12), ring(16), pinky(20)
    // A: 8->0.41, 12->0.45, 16->0.49, 20->0.53
    // B: 8->0.43, 12->0.47, 16->0.51, 20->0.55
    handA.landmarks[8] = { x: 0.41, y: 0.35, z: 0 };
    handB.landmarks[8] = { x: 0.43, y: 0.35, z: 0 };
    handA.landmarks[12] = { x: 0.45, y: 0.33, z: 0 };
    handB.landmarks[12] = { x: 0.47, y: 0.33, z: 0 };
    handA.landmarks[16] = { x: 0.49, y: 0.35, z: 0 };
    handB.landmarks[16] = { x: 0.51, y: 0.35, z: 0 };
    handA.landmarks[20] = { x: 0.53, y: 0.37, z: 0 };
    handB.landmarks[20] = { x: 0.55, y: 0.37, z: 0 };

    const isStep3 = checkStep3FingersInterlaced([handA, handB]);
    expect(isStep3).toBe(true);

    const result = evaluateDryModeGeometry(3, [handA, handB], 0.08);
    expect(result.passed).toBe(true);
    expect(result.ruleName).toBe('Step 3 (Fingers Interlaced)');
  });

  it('rejects Step 3 when palms are parallel but fingers are not interlaced (Step 1 pose)', () => {
    // Both hands palm to palm, but fingers do not alternate (all Hand A to the left of Hand B)
    const handA = create3DHand({
      wrist: { x: 0.44, y: 0.6, z: 0 },
      indexMcp: { x: 0.42, y: 0.45, z: 0 },
      pinkyMcp: { x: 0.46, y: 0.48, z: 0 }
    });
    const handB = create3DHand({
      wrist: { x: 0.48, y: 0.6, z: 0.02 },
      indexMcp: { x: 0.50, y: 0.45, z: 0.02 },
      pinkyMcp: { x: 0.46, y: 0.48, z: 0.02 }
    });

    // All handA fingertips are < 0.46, all handB fingertips are > 0.48 -> zero alternations
    handA.landmarks[8] = { x: 0.40, y: 0.35, z: 0 };
    handA.landmarks[12] = { x: 0.42, y: 0.33, z: 0 };
    handA.landmarks[16] = { x: 0.44, y: 0.35, z: 0 };
    handA.landmarks[20] = { x: 0.45, y: 0.37, z: 0 };

    handB.landmarks[8] = { x: 0.49, y: 0.35, z: 0 };
    handB.landmarks[12] = { x: 0.51, y: 0.33, z: 0 };
    handB.landmarks[16] = { x: 0.53, y: 0.35, z: 0 };
    handB.landmarks[20] = { x: 0.55, y: 0.37, z: 0 };

    const isStep3 = checkStep3FingersInterlaced([handA, handB]);
    expect(isStep3).toBe(false);
  });

  it('validates Step 3 when MediaPipe detects a single merged hand from tightly interlaced fingers', () => {
    const mergedHand = {
      landmarks: Array.from({ length: 21 }, (_, i) => ({
        x: 0.40 + (i % 5) * 0.05,
        y: 0.35 + Math.floor(i / 5) * 0.05,
        z: 0
      })),
      scale: 0.18,
      isMerged: true
    };

    const isStep3 = checkStep3FingersInterlaced([mergedHand]);
    expect(isStep3).toBe(true);

    const result = evaluateDryModeGeometry(3, [mergedHand], 0.08);
    expect(result.passed).toBe(true);
    expect(result.ruleName).toBe('Step 3 (Fingers Interlaced)');
  });

  it('rejects Step 3 when hands are stacked in palm-over-dorsum pose (Step 2)', () => {
    const handA = create3DHand({
      wrist: { x: 0.5, y: 0.6, z: 0 },
      indexMcp: { x: 0.45, y: 0.45, z: 0 },
      pinkyMcp: { x: 0.55, y: 0.48, z: 0 }
    });
    const handB = create3DHand({
      wrist: { x: 0.5, y: 0.6, z: 0.05 },
      indexMcp: { x: 0.45, y: 0.45, z: 0.05 },
      pinkyMcp: { x: 0.55, y: 0.48, z: 0.05 }
    });

    const isStep3 = checkStep3FingersInterlaced([handA, handB]);
    expect(isStep3).toBe(false);
  });

  it('advances Step 3 timer continuously when movement qualifies and pauses/holds without reset on wrong pose', () => {
    const engine = new StepRecognitionEngine({
      mode: 'strict',
      consecutiveFramesRequired: 3,
      targetDurationMs: 1000
    });
    engine.currentStep = 3;

    let now = 1000;
    // Debounce streak requires 3 frames
    for (let i = 0; i < 5; i++) {
      engine.predict({
        class: 'Step_3',
        confidence: 0.95,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    expect(engine.isStepActive).toBe(true);
    const progressBeforeWrongPose = engine.activeTimeMs;
    expect(progressBeforeWrongPose).toBeGreaterThan(0);

    // Wrong pose presented: Step_1 instead of Step_3
    engine.predict({
      class: 'Step_1',
      confidence: 0.95,
      handCount: 2,
      handConfidence: 0.95,
      handMovement: 0.08
    }, now);

    // Timer is frozen/paused, but progress is preserved (never reset to 0.0s)
    expect(engine.activeTimeMs).toBe(progressBeforeWrongPose);
    expect(engine.statusReason).toContain('Wrong pose for Step 3');

    // Correct Step 3 pose resumes and reaches target
    now += 200;
    for (let i = 0; i < 15; i++) {
      engine.predict({
        class: 'Step_3',
        confidence: 0.95,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    expect(engine.completedSteps).toContain(3);
    expect(engine.currentStep).toBe(4);
  });

  it('accepts Step 3 adaptive ensemble fusion when model predicts Step_4 with verified interlaced geometry', () => {
    const engine = new StepRecognitionEngine({
      mode: 'adaptive',
      enableGeometryFallback: true,
      consecutiveFramesRequired: 3,
      targetDurationMs: 500
    });
    engine.currentStep = 3;

    const mergedHand = {
      landmarks: Array.from({ length: 21 }, (_, i) => ({
        x: 0.40 + (i % 5) * 0.05,
        y: 0.35 + Math.floor(i / 5) * 0.05,
        z: 0
      })),
      scale: 0.18,
      isMerged: true
    };

    let now = 1000;
    let geomPassedOnStep3 = false;
    for (let i = 0; i < 12; i++) {
      const res = engine.predict({
        class: 'Step_4', // raw classifier outputs Step_4 during interlaced fingers
        confidence: 0.95,
        handCount: 1,
        handConfidence: 0.95,
        handMovement: 0.08,
        handsData: [mergedHand]
      }, now);
      if (res.rawStep === 3) {
        geomPassedOnStep3 = res.geometryRulePassed;
      }
      now += 100;
    }

    expect(geomPassedOnStep3).toBe(true);
    expect(engine.completedSteps).toContain(3);
    expect(engine.currentStep).toBe(4);
  });

  it('progresses smoothly through Step 1 -> Step 2 -> Step 3', () => {
    const engine = new StepRecognitionEngine({
      mode: 'strict',
      targetDurationMs: 500 // 500ms per step for unit test
    });

    let now = 1000;

    // Advance Step 1 (predict Step_1)
    for (let i = 0; i < 15; i++) {
      engine.predict({
        class: 'Step_1',
        confidence: 0.95,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    expect(engine.completedSteps).toContain(1);
    expect(engine.currentStep).toBe(2);

    // Advance Step 2 (predict Step_2)
    for (let i = 0; i < 15; i++) {
      engine.predict({
        class: 'Step_2',
        confidence: 0.95,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    expect(engine.completedSteps).toContain(2);
    expect(engine.currentStep).toBe(3);

    // Advance Step 3 (predict Step_3)
    for (let i = 0; i < 15; i++) {
      engine.predict({
        class: 'Step_3',
        confidence: 0.95,
        handCount: 2,
        handConfidence: 0.95,
        handMovement: 0.08
      }, now);
      now += 100;
    }
    expect(engine.completedSteps).toContain(3);
    expect(engine.currentStep).toBe(4);
  });
});

describe('Steps 4, 5, 6 Geometry & Full 6-Step Sequence Transition', () => {
  it('validates Step 4 when fingers are curled against opposing palm', () => {
    const handA = create3DHand({
      wrist: { x: 0.48, y: 0.6, z: 0 },
      scale: 0.20
    });
    const handB = create3DHand({
      wrist: { x: 0.50, y: 0.6, z: 0.02 },
      scale: 0.20
    });

    // Curl fingers of Hand A: fingertips closer to wrist than PIP joints
    // Index: tip 8, pip 6
    handA.landmarks[6] = { x: 0.45, y: 0.50, z: 0 };
    handA.landmarks[8] = { x: 0.46, y: 0.55, z: 0 }; // curled back toward wrist (0.60)
    // Middle: tip 12, pip 10
    handA.landmarks[10] = { x: 0.49, y: 0.48, z: 0 };
    handA.landmarks[12] = { x: 0.49, y: 0.54, z: 0 }; // curled back toward wrist
    // Ring: tip 16, pip 14
    handA.landmarks[14] = { x: 0.52, y: 0.50, z: 0 };
    handA.landmarks[16] = { x: 0.52, y: 0.55, z: 0 };

    const isStep4 = checkStep4BacksOfFingers([handA, handB]);
    expect(isStep4).toBe(true);

    const res = evaluateDryModeGeometry(4, [handA, handB], 0.08);
    expect(res.passed).toBe(true);
    expect(res.ruleName).toBe('Step 4 (Backs of Fingers)');
  });

  it('validates Step 5 when thumb is clasped with rotational motion', () => {
    const handA = create3DHand({ wrist: { x: 0.48, y: 0.55, z: 0 } });
    const handB = create3DHand({ wrist: { x: 0.50, y: 0.55, z: 0.02 } });

    // Place thumb of Hand A (landmark 4) directly at palm center of Hand B
    handA.landmarks[4] = { x: handB.palmCenter.x, y: handB.palmCenter.y, z: handB.palmCenter.z };

    // With rotational movement >= 0.03
    expect(checkStep5Thumbs([handA, handB], 0.05)).toBe(true);
    // Without movement -> fails
    expect(checkStep5Thumbs([handA, handB], 0.01)).toBe(false);
  });

  it('validates Step 6 when fingertips are rubbed circularly on opposing palm', () => {
    const handA = create3DHand({ wrist: { x: 0.46, y: 0.55, z: 0 } });
    const handB = create3DHand({ wrist: { x: 0.52, y: 0.55, z: 0.02 } });

    // Center fingertips of Hand A (8, 12, 16, 20) on Palm B
    const palm = handB.palmCenter;
    handA.landmarks[8] = { x: palm.x - 0.01, y: palm.y, z: palm.z };
    handA.landmarks[12] = { x: palm.x, y: palm.y, z: palm.z };
    handA.landmarks[16] = { x: palm.x + 0.01, y: palm.y, z: palm.z };
    handA.landmarks[20] = { x: palm.x + 0.02, y: palm.y, z: palm.z };

    // With rubbing movement >= 0.03
    expect(checkStep6Fingertips([handA, handB], 0.05)).toBe(true);
    // Without movement -> fails
    expect(checkStep6Fingertips([handA, handB], 0.01)).toBe(false);
  });

  it('progresses through the entire 6-step WHO sequence and finishes cleanly', () => {
    const engine = new StepRecognitionEngine({
      mode: 'strict',
      targetDurationMs: 300 // 300ms per step
    });

    let now = 1000;

    let lastOutput = null;
    for (let step = 1; step <= 6; step++) {
      expect(engine.currentStep).toBe(step);

      // Perform the step for 12 frames (1200ms > 300ms target)
      for (let f = 0; f < 12; f++) {
        lastOutput = engine.predict({
          class: `Step_${step}`,
          confidence: 0.95,
          handCount: 2,
          handConfidence: 0.95,
          handMovement: 0.08
        }, now);
        now += 100;
      }

      expect(engine.completedSteps).toContain(step);
    }

    // After Step 6, sequence is completed
    expect(engine.completedSteps).toEqual([1, 2, 3, 4, 5, 6]);
    expect(engine.currentStep).toBeGreaterThan(6);
    expect(lastOutput.isFinished).toBe(true);
  });
});


