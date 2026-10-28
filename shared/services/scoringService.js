/**
 * SMART WASH — WHO Handwashing Scoring Engine (Strict Tier & Bonus Edition)
 * 
 * Rules enforced:
 * - Deterministic compliance scoring formula:
 *   Score = max(0, min(100, BaseCompletion - P_missed - P_out_of_order))
 * - Tiers:
 *     0 - 39:  "Let's try again"
 *    40 - 69:  "Good try"
 *    70 - 89:  "Great job"
 *    90 - 100: "Superstar"
 * - Hygiene bonus: Awarded ONLY if score >= 70 AND >= 4 steps verified.
 * - Score 2/100 never shows "Superstar" or a bonus!
 */

import { HANDWASH_CONFIG } from '../config/handwashConfig.js';

export const TARGET_STEP_DURATION_MS = 6000;

export function calculateHandwashScore(completedSteps = [], missedSteps = [], options = {}) {
  const weights = options.weights || HANDWASH_CONFIG.SCORING_WEIGHTS || {
    MAX_COMPLETION_POINTS: 60,
    MAX_TIME_POINTS: 20,
    MAX_TECHNIQUE_POINTS: 20,
    POINTS_PER_STEP: 10,
    TARGET_STEP_DURATION_MS: 6000,
    CONFIDENCE_HIGH_THRESHOLD: 0.85,
    CONFIDENCE_MIN_THRESHOLD: 0.60,
    PAUSE_PENALTY_POINTS: 1.5,
    INVALID_POSE_PENALTY_POINTS: 0.5,
    OUT_OF_ORDER_PENALTY: 10,
    BONUS_MIN_SCORE: 70,
    BONUS_MIN_STEPS: 4,
    BONUS_STANDARD: 10,
    BONUS_SUPERSTAR: 15
  };

  if ((!completedSteps || completedSteps.length === 0) && (!missedSteps || missedSteps.length === 0)) {
    return {
      totalScore: 0,
      completionScore: 0,
      timeScore: 0,
      techniqueScore: 0,
      breakdown: {
        stepsCompleted: 0,
        completionPoints: 0,
        timePoints: 0,
        confidencePoints: 0,
        cadencePoints: 0,
        orderPenalties: 0,
        missedPenalties: 0,
        totalScrubTimeSec: 0,
        pauseCount: 0
      },
      grade: HANDWASH_CONFIG.TIERS.TRY_AGAIN.label,
      tier: 'TRY_AGAIN',
      feedbackMessage: "No handwashing steps recorded. Let's try again!",
      bonusAwarded: false,
      bonusPoints: 0,
      stepDetails: []
    };
  }

  // 1. Deduplicate completed steps by stepNumber (prevent duplicate step inflation)
  const uniqueStepsMap = new Map();
  for (const step of completedSteps) {
    if (step === null || step === undefined) continue;
    const stepNum = typeof step === 'object' ? (step.stepNumber ?? 0) : Number(step);
    if (stepNum < 1 || stepNum > 6) continue;

    if (!uniqueStepsMap.has(stepNum)) {
      uniqueStepsMap.set(stepNum, typeof step === 'object' ? { ...step, stepNumber: stepNum } : { stepNumber: stepNum, completed: true });
    } else {
      const existing = uniqueStepsMap.get(stepNum);
      const incoming = typeof step === 'object' ? step : { stepNumber: stepNum, completed: true };
      uniqueStepsMap.set(stepNum, {
        ...existing,
        ...incoming,
        activeTimeMs: Math.max(existing.activeTimeMs || 0, incoming.activeTimeMs || 0),
        durationMs: Math.max(existing.durationMs || 0, incoming.durationMs || 0),
        pauseCount: (existing.pauseCount || 0) + (incoming.pauseCount || 0)
      });
    }
  }

  const verifiedSteps = Array.from(uniqueStepsMap.values());
  const numCompleted = verifiedSteps.length;

  // Component A: Step Completion (up to 60 pts, 10 per verified WHO step)
  const completionPoints = Math.min(weights.MAX_COMPLETION_POINTS, numCompleted * weights.POINTS_PER_STEP);

  // Component B: Completion Time / Scrub Duration (up to 20 pts)
  // Target: 6000ms active scrub per step.
  let stepTimePointsTotal = 0;
  let totalActiveScrubMs = 0;
  let totalPauseCount = 0;
  let totalPauseDurationMs = 0;
  let totalInvalidPoseFrames = 0;
  let hasAnyRecordedTiming = false;
  let hasAnyRecordedConfidence = false;
  let confidenceRatiosSum = 0;
  const stepDetails = [];

  for (const step of verifiedSteps) {
    const targetMs = weights.TARGET_STEP_DURATION_MS || 6000;
    const activeMs = step.activeTimeMs !== undefined 
      ? step.activeTimeMs 
      : (step.durationMs !== undefined ? step.durationMs : null);

    const isTimingRecorded = activeMs !== null && activeMs !== undefined;
    if (isTimingRecorded) {
      hasAnyRecordedTiming = true;
      totalActiveScrubMs += activeMs;
      // Step ratio capped at 1.0 per step so rushing does not earn full time credit
      const ratio = Math.min(1.0, Math.max(0.0, activeMs / targetMs));
      let stepTimePt = ratio * (weights.MAX_TIME_POINTS / 6);

      // Deduct for excessive idle abandonment during the step (>10s pause)
      if (step.pauseDurationMs && step.pauseDurationMs > 10000) {
        const excessPauseSec = (step.pauseDurationMs - 10000) / 1000;
        stepTimePt = Math.max(0, stepTimePt - Math.min(2, excessPauseSec * 0.2));
      }
      stepTimePointsTotal += stepTimePt;
    }

    // Technique: Confidence evaluation
    const isConfRecorded = step.avgConfidence !== undefined && step.avgConfidence !== null;
    if (isConfRecorded) {
      hasAnyRecordedConfidence = true;
      const conf = step.avgConfidence;
      const confRatio = conf >= (weights.CONFIDENCE_HIGH_THRESHOLD || 0.85)
        ? 1.0
        : (conf <= (weights.CONFIDENCE_MIN_THRESHOLD || 0.60) ? 0.0 : (conf - 0.60) / 0.25);
      confidenceRatiosSum += confRatio;
    }

    // Technique: Cadence & Interruption tracking
    if (step.pauseCount) totalPauseCount += step.pauseCount;
    if (step.pauseDurationMs) totalPauseDurationMs += step.pauseDurationMs;
    if (step.invalidPoseFrames) totalInvalidPoseFrames += step.invalidPoseFrames;

    stepDetails.push({
      stepNumber: step.stepNumber,
      activeTimeMs: activeMs || 0,
      durationMs: step.durationMs || activeMs || 0,
      avgConfidence: step.avgConfidence ?? null,
      pauseCount: step.pauseCount || 0,
      completed: true
    });
  }

  // Final time score:
  // If timing was never recorded, explicitly award 0 points (do not assume perfect time).
  const timeScore = hasAnyRecordedTiming 
    ? Math.min(weights.MAX_TIME_POINTS, Math.max(0, stepTimePointsTotal))
    : 0;

  // Technique Component (up to 20 pts: 10 pts confidence + 10 pts cadence):
  // 1. Confidence points (up to 10 pts):
  const confidencePoints = hasAnyRecordedConfidence
    ? Math.min(10, Math.max(0, (confidenceRatiosSum / 6) * 10))
    : 0;

  // 2. Cadence & Smoothness points (up to 10 pts):
  // Base cadence scales with completed steps (10 pts for 6 steps = 1.67 pts/step)
  const baseCadence = (numCompleted / 6) * 10;
  const pauseDeduction = totalPauseCount * (weights.PAUSE_PENALTY_POINTS || 1.5);
  const invalidPoseDeduction = Math.min(3, totalInvalidPoseFrames * 0.05);
  const cadencePoints = Math.max(0, baseCadence - pauseDeduction - invalidPoseDeduction);

  const techniqueScore = Math.min(weights.MAX_TECHNIQUE_POINTS, confidencePoints + cadencePoints);

  // Sequence penalties (out-of-order transitions):
  let outOfOrderViolations = 0;
  let lastStepNum = 0;
  for (const step of completedSteps) {
    const stepNum = typeof step === 'object' && step !== null ? (step.stepNumber ?? 0) : Number(step);
    if (stepNum > 0 && stepNum < lastStepNum) {
      outOfOrderViolations++;
    }
    if (stepNum > 0) lastStepNum = stepNum;
  }
  const orderPenalties = outOfOrderViolations * (weights.OUT_OF_ORDER_PENALTY || 10);

  // Missed steps penalty (for skipped/omitted steps):
  const missedCount = Array.isArray(missedSteps) ? missedSteps.length : 0;
  const missedPenalties = missedCount * 5;

  // Combined score capped at 100
  let rawScore = completionPoints + timeScore + techniqueScore - orderPenalties - missedPenalties;
  const totalScore = Math.max(0, Math.min(100, Math.round(rawScore)));

  // Tier determination
  let grade = HANDWASH_CONFIG.TIERS.TRY_AGAIN.label;
  let tier = 'TRY_AGAIN';
  let feedbackMessage = "Let's try again! Keep practicing all 6 WHO steps.";

  if (totalScore >= HANDWASH_CONFIG.TIERS.SUPERSTAR.min) {
    grade = HANDWASH_CONFIG.TIERS.SUPERSTAR.label;
    tier = 'SUPERSTAR';
    feedbackMessage = 'Superstar! Outstanding WHO handwash technique!';
  } else if (totalScore >= HANDWASH_CONFIG.TIERS.GREAT_JOB.min) {
    grade = HANDWASH_CONFIG.TIERS.GREAT_JOB.label;
    tier = 'GREAT_JOB';
    feedbackMessage = 'Great job! You followed the correct technique!';
  } else if (totalScore >= HANDWASH_CONFIG.TIERS.GOOD_TRY.min) {
    grade = HANDWASH_CONFIG.TIERS.GOOD_TRY.label;
    tier = 'GOOD_TRY';
    feedbackMessage = 'Good try! Cover all areas thoroughly next time.';
  }

  // Documented Hygiene Bonus Rule:
  // Awarded ONLY if totalScore >= 70 AND numCompleted >= 4
  const qualifiesForBonus = totalScore >= (weights.BONUS_MIN_SCORE || 70) && 
                            numCompleted >= (weights.BONUS_MIN_STEPS || 4);

  let bonusPoints = 0;
  if (qualifiesForBonus) {
    if (totalScore >= (HANDWASH_CONFIG.TIERS.SUPERSTAR.min || 90) && numCompleted === 6 && totalPauseCount <= 1) {
      bonusPoints = weights.BONUS_SUPERSTAR || 15;
    } else {
      bonusPoints = weights.BONUS_STANDARD || 10;
    }
  }

  return {
    totalScore,
    completionScore: Math.round(completionPoints),
    timeScore: Math.round(timeScore),
    techniqueScore: Math.round(techniqueScore),
    breakdown: {
      stepsCompleted: numCompleted,
      completionPoints: Math.round(completionPoints),
      timePoints: Number(timeScore.toFixed(1)),
      confidencePoints: Number(confidencePoints.toFixed(1)),
      cadencePoints: Number(cadencePoints.toFixed(1)),
      orderPenalties,
      missedPenalties,
      totalScrubTimeSec: Number((totalActiveScrubMs / 1000).toFixed(1)),
      pauseCount: totalPauseCount
    },
    grade,
    tier,
    feedbackMessage,
    bonusAwarded: qualifiesForBonus,
    bonusPoints,
    stepDetails
  };
}

export function calculateStreak(sessionHistory = []) {
  if (!sessionHistory || !Array.isArray(sessionHistory) || sessionHistory.length === 0) {
    return 0;
  }
  
  // Sort descending by timestamp (newest sessions first)
  const sorted = [...sessionHistory].sort((a, b) => {
    const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp || 0).getTime();
    const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp || 0).getTime();
    return tB - tA;
  });

  let streak = 0;
  for (const session of sorted) {
    // Exclude developer / dry test sessions
    if (session.mode === 'dry' || session.mode === 'test') continue;
    
    const score = session.complianceScore ?? session.score ?? 0;
    // A compliant session requires score >= 70 and not abandoned
    if (score >= 70 && session.status !== 'abandoned') {
      streak++;
    } else {
      // Streak breaks at the most recent non-compliant session
      break;
    }
  }
  return streak;
}
