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

export function calculateHandwashScore(completedSteps = [], missedSteps = []) {
  if (completedSteps.length === 0 && missedSteps.length === 0) {
    return {
      totalScore: 0,
      completionScore: 0,
      grade: HANDWASH_CONFIG.TIERS.TRY_AGAIN.label,
      tier: 'TRY_AGAIN',
      feedbackMessage: "No handwashing steps recorded. Let's try again!",
      bonusAwarded: false,
      bonusPoints: 0
    };
  }

  const EXPECTED_STEPS = 6;
  const W_i = 1;
  const totalWeightCompleted = completedSteps.length * W_i;
  const totalWeightExpected = EXPECTED_STEPS * W_i;

  // Base completion score (out of 100)
  const baseScore = (totalWeightCompleted / totalWeightExpected) * 100;

  // Penalties
  const P_missed = missedSteps.length * 15;

  let outOfOrderViolations = 0;
  let lastStep = 0;
  for (const step of completedSteps) {
    const stepNum = typeof step === 'object' && step !== null ? (step.stepNumber ?? 0) : Number(step);
    if (stepNum < lastStep) {
      outOfOrderViolations++;
    }
    lastStep = stepNum;
  }
  const P_out_of_order = outOfOrderViolations * 10;

  let totalScore = baseScore - P_missed - P_out_of_order;
  totalScore = Math.max(0, Math.min(100, Math.round(totalScore)));

  // Determine Tiers strictly based on Rule 7
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

  // Rule 7: Award hygiene bonus ONLY if score >= 70 AND >= 4 verified steps
  const qualifiesForBonus = totalScore >= HANDWASH_CONFIG.BONUS_MIN_SCORE && 
                            completedSteps.length >= HANDWASH_CONFIG.BONUS_MIN_STEPS;
  const bonusPoints = qualifiesForBonus ? HANDWASH_CONFIG.BONUS_POINTS : 0;

  return {
    totalScore,
    completionScore: Math.round(baseScore),
    grade,
    tier,
    feedbackMessage,
    bonusAwarded: qualifiesForBonus,
    bonusPoints
  };
}

export function calculateStreak(sessionHistory = []) {
  if (!sessionHistory || sessionHistory.length === 0) return 0;
  let streak = 0;
  for (const session of sessionHistory) {
    if ((session.score || 0) >= 70) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}
