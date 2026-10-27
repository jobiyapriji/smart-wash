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

