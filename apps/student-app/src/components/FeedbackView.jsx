import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../../../src/i18n/LanguageContext.jsx';
import { speak, cancelSpeech } from '../../../../src/services/speechService.js';
import { HANDWASH_CONFIG } from '../../../../shared/config/handwashConfig.js';
import { Squiggle } from '../../../../src/components/ui/Squiggle.jsx';
import { Star, Award, CheckCircle2, RotateCcw } from 'lucide-react';

export function FeedbackView({
  score = 0,
  scoreBreakdown = null,
  student = null,
  completedSteps = [],
  onReset = null,
  sessionDurationMs = null
}) {
  const { lang, t } = useLanguage();
  const [countdown, setCountdown] = useState(8);

  // Rule 7: Strict Tiers
  const isSuperstar = score >= 90;
  const isGreatJob = score >= 70 && score < 90;
  const isGoodTry = score >= 40 && score < 70;
  const isTryAgain = score < 40;

  // Documented Hygiene Bonus rule: Awarded ONLY if score >= 70 AND >= 4 steps verified
  const bonusAwarded = scoreBreakdown?.bonusAwarded !== undefined
    ? scoreBreakdown.bonusAwarded
    : (score >= HANDWASH_CONFIG.BONUS_MIN_SCORE && completedSteps.length >= HANDWASH_CONFIG.BONUS_MIN_STEPS);

  const bonusPoints = scoreBreakdown?.bonusPoints !== undefined
    ? scoreBreakdown.bonusPoints
    : (bonusAwarded
        ? (isSuperstar && completedSteps.length === 6
            ? (HANDWASH_CONFIG.BONUS_POINTS_SUPERSTAR || 15)
            : (HANDWASH_CONFIG.BONUS_POINTS || 10))
        : 0);

  // Spoken audio feedback on mount
  useEffect(() => {
    const audioKey = isSuperstar 
      ? 'encouragement_excellent_audio' 
      : (isGreatJob ? 'encouragement_good_audio' : 'encouragement_practice_audio');

    speak(audioKey, lang);

    return () => {
      cancelSpeech();
    };
  }, [isSuperstar, isGreatJob, lang]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onReset) onReset();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onReset]);

  // Tier Color Palette
  const tierColor = isSuperstar 
    ? '#34D399' // Mint
    : isGreatJob 
    ? '#8B5CF6' // Violet
    : isGoodTry 
    ? '#FBBF24' // Amber
    : '#F472B6'; // Pink

  const tierBadgeBg = isSuperstar 
    ? '#D1FAE5' 
    : isGreatJob 
    ? '#EDE9FE' 
    : isGoodTry 
    ? '#FEF3C7' 
    : '#FCE7F3';

  const tierTitle = isSuperstar 
    ? (student ? `Superstar Wash, ${student.name}! 🌟` : 'Superstar Wash! 🌟')
    : (isGreatJob 
      ? (student ? `Great Job, ${student.name}! 🎉` : 'Great Job! 🎉')
      : (isGoodTry 
        ? 'Good Try! 👍' 
        : "Let's Try Again! 🧼"));

  const encourageMessage = isSuperstar
    ? 'Sparkling Clean & Full WHO Compliance Mastered!'
    : (isGreatJob
      ? 'Great technique! Follow all steps in order for a perfect score.'
      : (isGoodTry
        ? 'Good attempt buddy! Keep practicing all 6 WHO steps.'
        : 'Hands need a thorough wash! Complete all steps to earn points.'));

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      gap: '20px',
      textAlign: 'center',
      padding: '16px',
      fontFamily: 'Plus Jakarta Sans, sans-serif'
    }}>
      {/* Big Score in a Sticker Circle with Star Burst */}
      <div style={{ position: 'relative', width: '160px', height: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {/* Star Burst Decorative Ring */}
        <div style={{
          position: 'absolute',
          width: '158px',
          height: '158px',
          borderRadius: '50%',
          border: '3px dashed #1E293B',
          opacity: 0.4
        }} />

        {/* Sticker Circle */}
        <div style={{
          width: '136px',
          height: '136px',
          borderRadius: '50%',
          background: tierColor,
          border: '3px solid #1E293B',
          boxShadow: '6px 6px 0px 0px #1E293B',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2
        }}>
          <span style={{
            fontSize: '44px',
            fontWeight: 900,
            color: isGreatJob ? '#FFFFFF' : '#1E293B',
            lineHeight: 1,
            fontFamily: 'Outfit, sans-serif'
          }}>
            {score}
          </span>
          <span style={{
            fontSize: '11px',
            fontWeight: 800,
            color: isGreatJob ? '#FFFFFF' : '#1E293B',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginTop: '2px',
            fontFamily: 'Outfit, sans-serif'
          }}>
            {t('score_out_of_100')}
          </span>
        </div>

        {/* Floating Mini Badges */}
        <div style={{
          position: 'absolute',
          top: '-4px',
          right: '-4px',
          width: '36px',
          height: '36px',
          borderRadius: '50%',
          background: '#FBBF24',
          border: '2px solid #1E293B',
          boxShadow: '2px 2px 0px 0px #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 3
        }}>
          <Star size={18} strokeWidth={2.5} color="#1E293B" fill="#FBBF24" />
        </div>
      </div>

      {/* Encouragement Banner & Student Name */}
      <div style={{ maxWidth: '440px' }}>
        <h2 style={{
          margin: '0 0 6px 0',
          fontSize: '26px',
          fontWeight: 800,
          color: '#1E293B',
          fontFamily: 'Outfit, sans-serif',
          lineHeight: 1.25
        }}>
          {tierTitle}
        </h2>

        {/* Squiggle Underline under Student Name */}
        {student?.name && (
          <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 10px 0' }}>
            <Squiggle width={140} color={tierColor} />
          </div>
        )}

        <div style={{
          background: tierBadgeBg,
          border: '2px solid #1E293B',
          borderRadius: '9999px',
          padding: '6px 16px',
          display: 'inline-block',
          boxShadow: '3px 3px 0px 0px #1E293B',
          marginTop: '4px'
        }}>
          <p style={{
            margin: 0,
            fontSize: '13px',
            color: '#1E293B',
            fontWeight: 700,
            fontFamily: 'Plus Jakarta Sans, sans-serif'
          }}>
            {encourageMessage}
          </p>
        </div>
      </div>

      {/* Summary Sticker Chips */}
      <div style={{
        display: 'flex',
        gap: '16px',
        background: '#FFFFFF',
        padding: '12px 24px',
        borderRadius: '20px',
        border: '2px solid #1E293B',
        boxShadow: '4px 4px 0px 0px #1E293B'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', fontWeight: 900, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            {completedSteps.length} / 6
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            {t('steps_tracked')}
          </div>
        </div>

        <div style={{ width: '2px', background: '#E2E8F0', borderRadius: '1px' }} />

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '18px',
            fontWeight: 900,
            color: bonusAwarded ? '#8B5CF6' : '#64748B',
            fontFamily: 'Outfit, sans-serif'
          }}>
            +{bonusPoints} pts
          </div>
          <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase' }}>
            {t('streak_bonus')}
          </div>
        </div>
      </div>

      {/* Performance Breakdown Pill */}
      {scoreBreakdown && scoreBreakdown.completionScore !== undefined && (
        <div style={{
          display: 'flex',
          gap: '10px',
          fontSize: '11px',
          fontWeight: 700,
          color: '#64748B',
          background: 'rgba(255, 255, 255, 0.85)',
          padding: '4px 14px',
          borderRadius: '9999px',
          border: '1.5px solid #CBD5E1',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <span>Steps: {scoreBreakdown.completionScore}/60</span>
          <span>•</span>
          <span>Time: {scoreBreakdown.timeScore}/20</span>
          <span>•</span>
          <span>Technique: {scoreBreakdown.techniqueScore}/20</span>
        </div>
      )}

      {/* Auto Reset Footer */}
      <div style={{ marginTop: '8px' }}>
        <button
          onClick={onReset}
          style={{
            padding: '10px 22px',
            borderRadius: '9999px',
            border: '2px solid #1E293B',
            background: '#FFFDF5',
            color: '#1E293B',
            fontSize: '13px',
            fontWeight: 800,
            cursor: 'pointer',
            boxShadow: '3px 3px 0px 0px #1E293B',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: 'Outfit, sans-serif'
          }}
        >
          <RotateCcw size={16} strokeWidth={2.5} color="#1E293B" />
          <span>{t('reset_next_student', { countdown })}</span>
        </button>
      </div>
    </div>
  );
}

export default FeedbackView;
