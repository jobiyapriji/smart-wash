/**
 * SMART WASH — WHO Handwashing Step Recognition Engine (Strict Gating Edition)
 * 
 * Rules enforced:
 * 1. Hand-presence gate: MediaPipe reports >= 1 hand (2 hands for two-handed steps) with landmark confidence >= 0.6.
 *    If missing > 500ms, pause all timers, show "Show your hands to the camera", and do NOT credit anything.
 * 2. Hand landmark movement: displacement of hand landmarks divided by hand scale.
 * 3. Strict step crediting: Frame counts toward 6s timer only if ALL 5 are true:
 *    - hands present (rule 1)
 *    - predicted step == current target step (strictly matching, no cross-step credit)
 *    - confidence >= 0.60
 *    - hand movement above threshold (>= 0.05)
 *    - debounce: 8 consecutive qualifying frames before counting starts
 *    Any non-qualifying frame pauses timer (does not reset progress).
 * 4. Explicit class mapping table: unmapped classes (e.g. Step_7, background) are "no step" (-1), never progress.
 * 5. No time-based auto-advance and no skip button in production.
 */

import {
  HANDWASH_CONFIG,
  YOLO_TO_WHO_STEP_MAP,
  STEP_REQUIRED_HANDS
} from '../config/handwashConfig.js';
import { evaluateDryModeGeometry } from './dryModeGeometryService.js';
import { isMergedHand } from './handLandmarkService.js';

export const WHO_STEPS_INFO = [
  { 
    id: 0, 
    name: "Wet Hands & Apply Soap", 
    instruction: "Wet hands with water and apply sufficient soap to cover all hand surfaces.",
    cue: "Wet & Soap",
    icon: "🧼",
    recommendedDurationMs: 5000 
  },
  { 
    id: 1, 
    name: "Palm to Palm", 
    instruction: "Rub your palms together firmly in circular motions.",
    cue: "Rub palms in circles",
    icon: "🤲",
    recommendedDurationMs: 6000 
  },
  { 
    id: 2, 
    name: "Right Palm over Left Dorsum & vice versa", 
    instruction: "Place right palm over back of left hand with fingers interlaced, rub well, then swap hands.",
    cue: "Rub backs of hands",
    icon: "🖐️",
    recommendedDurationMs: 6000 
  },
  { 
    id: 3, 
    name: "Palm to Palm with Fingers Interlaced", 
    instruction: "Interlace your fingers palm-to-palm and rub back and forth in between fingers.",
    cue: "Interlace fingers & rub",
    icon: "🤝",
    recommendedDurationMs: 6000 
  },
  { 
    id: 4, 
    name: "Backs of Fingers to Opposing Palms", 
    instruction: "Clasp backs of fingers against opposing palms with fingers interlocked and rub side-to-side.",
    cue: "Interlock backs of fingers",
    icon: "✊",
    recommendedDurationMs: 6000 
  },
  { 
    id: 5, 
    name: "Rotational Rubbing of Thumbs", 
    instruction: "Clasp your left thumb in your right palm and rub rotationally, then switch hands.",
    cue: "Rotate thumbs in palms",
    icon: "👍",
    recommendedDurationMs: 6000 
  },
  { 
    id: 6, 
    name: "Rotational Rubbing of Fingertips on Palms", 
    instruction: "Rub the fingertips of your right hand circularly in the left palm, then swap sides.",
    cue: "Rub fingertips in circles",
    icon: "💅",
    recommendedDurationMs: 6000 
  }
];

export class StepRecognitionEngine {
  constructor(options = {}) {
    this.mode = options.mode ?? HANDWASH_CONFIG.DETECTION_MODE ?? 'strict';
    const isDry = this.mode === 'dry';

    const defaultConfidence = isDry
      ? HANDWASH_CONFIG.DRY_CONFIDENCE_THRESHOLD
      : HANDWASH_CONFIG.CONFIDENCE_THRESHOLD;

    const defaultDebounce = isDry
      ? HANDWASH_CONFIG.DRY_DEBOUNCE_FRAMES
      : HANDWASH_CONFIG.DEBOUNCE_FRAMES;

    const defaultMovement = HANDWASH_CONFIG.MOVEMENT_THRESHOLD ?? 0.05;

    this.confidenceThreshold = options.confidenceThreshold ?? defaultConfidence;
    this.debounceFramesRequired = options.consecutiveFramesRequired ?? defaultDebounce;
    this.movementThreshold = options.movementThreshold ?? defaultMovement;
    this.targetDurationMs = options.targetDurationMs ?? HANDWASH_CONFIG.STEP_TARGET_DURATION_MS;
    this.handsMissingPauseMs = options.handsMissingPauseMs ?? HANDWASH_CONFIG.HANDS_MISSING_PAUSE_MS;
    this.handStateHoldMs = options.handStateHoldMs ?? HANDWASH_CONFIG.HAND_STATE_HOLD_MS ?? 500;
    this.gracePeriodMs = options.gracePeriodMs ?? HANDWASH_CONFIG.GRACE_PERIOD_MS ?? 500;
    this.geometryThresholds = options.geometryThresholds ?? HANDWASH_CONFIG.GEOMETRY_THRESHOLDS;

    this.currentStep = 1;
    this.completedSteps = [];
    this.missedSteps = [];
    this.activeTimeMs = 0;
    this.lastFrameTime = null;
    this.lastCriteriaMetTime = null;
    this.isStepActive = false;
    this.graceState = 'IDLE'; // 'ACTIVE' | 'IN_GRACE' | 'PAUSED' | 'IDLE'
    this.lastHandsSeenTime = null;
    this.lastValidHandState = null;
    this.debounceStreak = 0;
    this.historyWindowSize = options.historyWindowSize || 8;
    this.predictionHistory = [];
    this.telemetryLog = []; // Last 10s of frame telemetry
    this.failingReason = 'INITIALIZING';
    this.statusReason = 'No hands';
    this.geometryRulePassed = false;
    this.geometryRuleName = null;
    this.ruleConditions = {
      handsPresent: false,
      stepMatch: false,
      confidenceCheck: false,
      movementCheck: false,
      debounceCheck: false,
      geometryRulePassed: false,
      geometryRuleName: null
    };
  }

  /**
   * Explicit Class Mapping (Rule 4)
   * Step_7, background, and unknown classes map to -1 ("no step").
   */
  getYoloClassStep(yoloClass) {
    if (!yoloClass) return -1;
    const mapped = YOLO_TO_WHO_STEP_MAP[yoloClass];
    return mapped !== undefined ? mapped : -1;
  }

  mapStepToYoloClass(stepId) {
    const matching = [];
    for (const [cls, mappedStep] of Object.entries(YOLO_TO_WHO_STEP_MAP)) {
      if (mappedStep === stepId) matching.push(cls);
    }
    return matching.length > 0 ? matching : ['background'];
  }

  /**
   * Evaluates each video frame with the strict gating rules, real elapsed time dt,
   * 500ms grace window before pausing, and dry-mode fallback.
   * 
   * @param {Object} input
   * @param {string} input.class Raw model prediction class string (e.g. "Step_1")
   * @param {number} input.confidence Model prediction confidence (0.0 - 1.0)
   * @param {number} input.handCount Number of hands detected by MediaPipe
   * @param {number} input.handConfidence Confidence of MediaPipe hands
   * @param {number} input.handMovement Normalized hand landmark displacement
   * @param {Array} input.handsData MediaPipe hand landmarks data
   * @param {boolean} input.isMerged Single merged hand flag
   * @param {boolean} input.isHandRubbing Direct motion boolean override (optional)
   * @param {number} timestamp performance.now()
   */
  predict(input = {}, timestamp) {
    const now = timestamp || performance.now();
    if (this.currentStep > 6) {
      return this._getOutput(1.0);
    }

    let rawClass = input.class || input.rawPrediction || 'background';
    let confidence = input.confidence !== undefined ? input.confidence : 0;
    let handCount = input.handCount !== undefined ? input.handCount : (input.isHandRubbing ? 2 : 0);
    let handConfidence = input.handConfidence !== undefined ? input.handConfidence : (handCount > 0 ? 0.90 : 0);
    let handMovement = input.handMovement !== undefined 
      ? input.handMovement 
      : (input.isHandRubbing ? 0.15 : 0);
    let handsData = input.handsData || [];
    let isMerged = Boolean(
      input.isMerged ||
      handsData.some(h => h.isMerged || (h.landmarks && isMergedHand(h.landmarks, h.scale)))
    );
    let isHandsMoving = input.isHandsMoving;

    const minConf = HANDWASH_CONFIG.HAND_LANDMARK_MIN_CONFIDENCE || 0.30;
    const hasRawQualifyingHands = handCount >= 1 && handConfidence >= minConf;

    // Prompt Fix 3: If hands vanish for < 500 ms, keep the last state (hold last value)
    if (hasRawQualifyingHands) {
      this.lastHandsSeenTime = now;
      this.lastValidHandState = {
        handCount,
        handConfidence,
        handMovement,
        handsData,
        isMerged,
        isHandsMoving,
        rawClass,
        confidence
      };
    } else {
      const vanishElapsed = this.lastHandsSeenTime !== null ? (now - this.lastHandsSeenTime) : Infinity;
      if (this.lastValidHandState && vanishElapsed < this.handStateHoldMs) {
        // Retain last state during brief dropouts (< 500 ms)
        handCount = this.lastValidHandState.handCount;
        handConfidence = this.lastValidHandState.handConfidence;
        if (input.handMovement === undefined) {
          handMovement = this.lastValidHandState.handMovement;
        }
        if (handsData.length === 0) {
          handsData = this.lastValidHandState.handsData;
        }
        isMerged = isMerged || this.lastValidHandState.isMerged;
        if (isHandsMoving === undefined) {
          isHandsMoving = this.lastValidHandState.isHandsMoving;
        }
        if ((rawClass === 'background' || !input.class) && this.lastValidHandState.rawClass) {
          rawClass = this.lastValidHandState.rawClass;
          confidence = this.lastValidHandState.confidence;
        }
      } else {
        this.lastValidHandState = null;
      }
    }

    const handsMissing = this.lastHandsSeenTime === null || (now - this.lastHandsSeenTime) > this.handsMissingPauseMs;

    const requiredHands = STEP_REQUIRED_HANDS[this.currentStep] || 1;
    const mappedStep = this.getYoloClassStep(rawClass);

    // RULE 1: Overlapping / Merged hands for all WHO rubbing steps
    // During active rubbing, hands touch and frequently merge into a single detection area.
    const handsCountQualifies = (handCount >= requiredHands) || (handCount >= 1 && (isMerged || handsData.length >= 1 || this.currentStep >= 1));

    const handsPresent = !handsMissing && 
      (handCount >= 1) &&
      handsCountQualifies && 
      (handConfidence >= minConf);

    // RULE 2: Movement check (>= threshold strictly from landmarks or direct motion boolean)
    const movementCheck = isHandsMoving !== undefined 
      ? isHandsMoving 
      : (handMovement >= this.movementThreshold);

    // RULE 3 & 4: Step validation (Classifier vs Landmark Geometry Fallback)
    const stepMatch = mappedStep === this.currentStep;
    const confidenceCheck = confidence >= this.confidenceThreshold;
    const classifierPassed = stepMatch && confidenceCheck;

    let geometryPassed = false;
    let geometryName = null;

    if (this.mode === 'dry') {
      const geomResult = evaluateDryModeGeometry(
        this.currentStep,
        handsData,
        handMovement,
        this.geometryThresholds
      );
      geometryPassed = geomResult.passed;
      geometryName = geomResult.ruleName;
    }

    this.geometryRulePassed = geometryPassed;
    this.geometryRuleName = geometryPassed ? geometryName : null;

    // In Dry Mode: frame qualifies if classifier matches OR landmark-geometry fallback matches
    const stepSatisfied = this.mode === 'dry'
      ? (classifierPassed || geometryPassed)
      : classifierPassed;

    // Update rolling prediction history for telemetry
    this.predictionHistory.push(rawClass);
    if (this.predictionHistory.length > this.historyWindowSize) {
      this.predictionHistory.shift();
    }

    const allCriteriaMet = handsPresent && stepSatisfied && movementCheck;

    // Status strings (single exact reason for banner + detailed for HUD)
    let singleReason = 'Scrubbing active';
    let detailedReason = 'ALL_CONDITIONS_MET (COUNTING)';

    if (!handsPresent) {
      singleReason = 'No hands';
      detailedReason = handsMissing 
        ? 'No hands (HANDS_MISSING: >500ms absent)' 
        : `No hands (INSUFFICIENT_HANDS: detected ${handCount}/${requiredHands})`;
    } else if (!stepSatisfied) {
      if (confidence < this.confidenceThreshold && (stepMatch || this.mode === 'dry')) {
        singleReason = 'Low confidence';
        detailedReason = `Low confidence (LOW_CONFIDENCE: ${confidence.toFixed(2)} < ${this.confidenceThreshold.toFixed(2)})`;
      } else {
        singleReason = `Wrong pose for Step ${this.currentStep}`;
        detailedReason = `Wrong pose for Step ${this.currentStep} (WRONG_POSE_OR_STEP: STEP_MISMATCH: model ${rawClass} -> Step ${mappedStep}, target: Step ${this.currentStep})`;
      }
    } else if (!movementCheck) {
      singleReason = 'Hands not moving';
      detailedReason = `Hands not moving (LOW_MOVEMENT: ${handMovement.toFixed(3)} < ${this.movementThreshold.toFixed(2)})`;
    }

    // Timing Logic:
    // 1. Debounce applies ONLY to starting a step (or resuming after a hard pause).
    // 2. While running, accumulate real elapsed dt (actual ms since last frame).
    // 3. When conditions fail, allow a 500 ms grace window before pausing.
    // 4. A pause keeps accumulated progress; it never resets it.
    if (allCriteriaMet) {
      this.lastCriteriaMetTime = now;

      if (!this.isStepActive) {
        // Step initiation debounce check
        this.debounceStreak++;
        if (this.debounceStreak >= this.debounceFramesRequired) {
          this.isStepActive = true;
          this.graceState = 'ACTIVE';
          this.lastFrameTime = now;
          this.statusReason = singleReason;
          this.failingReason = geometryPassed && !classifierPassed
            ? `ALL_CONDITIONS_MET (GEOMETRY_FALLBACK: ${geometryName})`
            : detailedReason;
        } else {
          this.graceState = 'DEBOUNCING';
          this.statusReason = `Debouncing (${this.debounceStreak}/${this.debounceFramesRequired})`;
          this.failingReason = `DEBOUNCING (${this.debounceStreak}/${this.debounceFramesRequired})`;
          this.lastFrameTime = now;
        }
      } else {
        // Actively scrubbing: accumulate real elapsed time
        this.graceState = 'ACTIVE';
        this.statusReason = singleReason;
        this.failingReason = geometryPassed && !classifierPassed
          ? `ALL_CONDITIONS_MET (GEOMETRY_FALLBACK: ${geometryName})`
          : detailedReason;

        if (this.lastFrameTime) {
          const delta = Math.min(350, Math.max(0, now - this.lastFrameTime));
          this.activeTimeMs += delta;
        }
        this.lastFrameTime = now;

        // Check if 6.0s target reached
        if (this.activeTimeMs >= this.targetDurationMs) {
          if (!this.completedSteps.includes(this.currentStep)) {
            this.completedSteps.push(this.currentStep);
          }
          this.activeTimeMs = 0;
          this.lastFrameTime = null;
          this.lastCriteriaMetTime = null;
          this.debounceStreak = 0;
          this.isStepActive = false;
          this.graceState = 'IDLE';
          this.currentStep++;
        }
      }
    } else {
      // Conditions not met on this frame: pause timer accumulation while preserving progress
      if (this.isStepActive) {
        const timeSinceMet = this.lastCriteriaMetTime ? (now - this.lastCriteriaMetTime) : Infinity;

        if (timeSinceMet < this.gracePeriodMs) {
          // IN 500ms GRACE WINDOW: timer accumulation is frozen (progress preserved)
          // Debounce streak is held so that resuming within 500ms doesn't re-require full debounce
          this.graceState = 'IN_GRACE';
          this.statusReason = singleReason;
          this.failingReason = detailedReason;
          this.lastFrameTime = now;
        } else {
          // Grace window expired (>= 500ms): full pause, requires debounce to resume
          this.graceState = 'PAUSED';
          this.isStepActive = false;
          this.debounceStreak = 0;
          this.lastFrameTime = null;
          this.statusReason = singleReason;
          this.failingReason = detailedReason;
        }
      } else {
        // Was already inactive: remain paused
        this.graceState = 'PAUSED';
        this.debounceStreak = 0;
        this.lastFrameTime = null;
        this.statusReason = singleReason;
        this.failingReason = detailedReason;
      }
    }

    this.ruleConditions = {
      handsPresent,
      stepMatch: stepMatch || geometryPassed,
      confidenceCheck: confidenceCheck || geometryPassed,
      movementCheck,
      debounceCheck: this.isStepActive || (this.debounceStreak >= this.debounceFramesRequired),
      geometryRulePassed: geometryPassed,
      geometryRuleName: this.geometryRuleName
    };

    // Buffer last 10s of frame telemetry for "Copy debug log"
    this.telemetryLog.push({
      timestamp: Math.round(now),
      step: this.currentStep,
      activeTimeMs: Math.round(this.activeTimeMs),
      progressPercent: Number(Math.min(100, (this.activeTimeMs / this.targetDurationMs) * 100).toFixed(1)),
      handCount,
      handMovement: Number(handMovement.toFixed(3)),
      rawClass,
      rawConfidence: Number(confidence.toFixed(2)),
      statusReason: this.statusReason,
      failingReason: this.failingReason,
      graceState: this.graceState,
      allCriteriaMet
    });

    const tenSecAgo = now - 10000;
    while (this.telemetryLog.length > 0 && this.telemetryLog[0].timestamp < tenSecAgo) {
      this.telemetryLog.shift();
    }

    return this._getOutput(confidence, handsMissing);
  }

  _getOutput(confidence = 0, handsMissing = false) {
    const isFinished = this.currentStep > 6;
    const effectiveStep = Math.min(6, this.currentStep);
    const targetMs = this.targetDurationMs;
    const progressPercent = isFinished 
      ? 100 
      : Math.min(100, Math.round((this.activeTimeMs / targetMs) * 100));
    const elapsedSeconds = Number((this.activeTimeMs / 1000).toFixed(1));

    return {
      rawStep: this.currentStep,
      smoothedStep: effectiveStep,
      isFinished,
      confidence,
      progressPercent,
      activeTimeMs: this.activeTimeMs,
      elapsedSeconds,
      targetTimeMs: targetMs,
      completedSteps: this.completedSteps,
      missedSteps: this.missedSteps,
      handsMissing,
      failingReason: this.failingReason,
      statusReason: this.statusReason,
      graceState: this.graceState,
      isStepActive: this.isStepActive,
      ruleConditions: this.ruleConditions,
      debounceStreak: this.debounceStreak,
      mode: this.mode,
      geometryRulePassed: this.geometryRulePassed,
      geometryRuleName: this.geometryRuleName,
      telemetryLog: this.telemetryLog
    };
  }

  getDebugLog() {
    return JSON.stringify(this.telemetryLog, null, 2);
  }

  // Debug-only skip step (gated behind ?debug=1)
  skipStep() {
    if (this.currentStep <= 6) {
      if (!this.completedSteps.includes(this.currentStep)) {
        this.completedSteps.push(this.currentStep);
      }
      this.currentStep++;
      this.activeTimeMs = 0;
      this.lastFrameTime = null;
      this.lastCriteriaMetTime = null;
      this.debounceStreak = 0;
      this.isStepActive = false;
      this.graceState = 'IDLE';
    }
    return this._getOutput(0.95, false);
  }

  // Debug-only jump to step
  jumpToStep(stepNumber) {
    if (stepNumber < 1 || stepNumber > 6) return this._getOutput();
    while (this.currentStep < stepNumber) {
      if (!this.completedSteps.includes(this.currentStep) && !this.missedSteps.includes(this.currentStep)) {
        this.missedSteps.push(this.currentStep);
      }
      this.currentStep++;
    }
    this.currentStep = stepNumber;
    this.activeTimeMs = 0;
    this.lastFrameTime = null;
    this.lastCriteriaMetTime = null;
    this.debounceStreak = 0;
    this.isStepActive = false;
    this.graceState = 'IDLE';
    return this._getOutput(0.95, false);
  }

  reset() {
    this.currentStep = 1;
    this.completedSteps = [];
    this.missedSteps = [];
    this.activeTimeMs = 0;
    this.lastFrameTime = null;
    this.lastCriteriaMetTime = null;
    this.lastHandsSeenTime = null;
    this.lastValidHandState = null;
    this.debounceStreak = 0;
    this.isStepActive = false;
    this.graceState = 'IDLE';
    this.telemetryLog = [];
    this.predictionHistory = [];
    this.failingReason = 'INITIALIZING';
    this.statusReason = 'No hands';
  }
}

export default StepRecognitionEngine;
