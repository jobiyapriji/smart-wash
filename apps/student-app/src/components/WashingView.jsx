import React, { useState, useEffect } from 'react';
import { WHO_STEPS_INFO } from '../../../../shared/services/stepModelService.js';
import { useLanguage } from '../../../../src/i18n/LanguageContext.jsx';
import { speak, cancelSpeech } from '../../../../src/services/speechService.js';
import { Check, AlertTriangle, Clock, Sparkles } from 'lucide-react';

const STEP_COLORS = {
  1: { bg: '#8B5CF6', text: '#FFFFFF', lightBg: '#EDE9FE', border: '#1E293B' }, // Violet
  2: { bg: '#F472B6', text: '#1E293B', lightBg: '#FCE7F3', border: '#1E293B' }, // Pink
  3: { bg: '#FBBF24', text: '#1E293B', lightBg: '#FEF3C7', border: '#1E293B' }, // Amber
  4: { bg: '#34D399', text: '#1E293B', lightBg: '#D1FAE5', border: '#1E293B' }, // Mint
  5: { bg: '#8B5CF6', text: '#FFFFFF', lightBg: '#EDE9FE', border: '#1E293B' }, // Violet
  6: { bg: '#F472B6', text: '#1E293B', lightBg: '#FCE7F3', border: '#1E293B' }  // Pink
};

export function WashingView({
  activeStep = 1,
  confidence = 0.85,
  progress = 0,
  activeTimeMs = 0,
  elapsedSeconds = null,
  statusReason = null,
  graceState = 'IDLE',
  isHandsMoving = true,
  handsMissing = false,
  isDryMode = false,
  onStepComplete = null,
  onFinishWashing = null,
  onSkipStep = null,
  onJumpToStep = null
}) {
  const { lang, t } = useLanguage();
  const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=1');
  const currentStepInfo = WHO_STEPS_INFO[activeStep] || WHO_STEPS_INFO[1];
  const recDuration = (currentStepInfo.recommendedDurationMs || 6000) / 1000;
  const onStepCompleteRef = React.useRef(onStepComplete);
  const onFinishWashingRef = React.useRef(onFinishWashing);
  const confidenceRef = React.useRef(confidence);
  const [mediaFailed, setMediaFailed] = useState(false);

  React.useEffect(() => {
    onStepCompleteRef.current = onStepComplete;
    onFinishWashingRef.current = onFinishWashing;
    confidenceRef.current = confidence;
  });

  // Synchronized Multimedia Guidance (Voice Assistant & Video Loop)
  React.useEffect(() => {
    setMediaFailed(false);
    
    // Voice Assistant with multilingual speech / pre-recorded MP3 fallback
    speak(`step_${activeStep}_audio`, lang);

    return () => {
      cancelSpeech();
    };
  }, [activeStep, lang]);

  const progressPercent = Math.min(100, Math.max(0, progress));
  const displayTimer = elapsedSeconds !== null 
    ? `${elapsedSeconds}s` 
    : `${(activeTimeMs / 1000).toFixed(1)}s`;

  const isScrubbingActive = graceState === 'ACTIVE';
  const isInGrace = graceState === 'IN_GRACE';
  const isScrubbingPaused = !isScrubbingActive && !isInGrace;

  // Single exact status reason resolution
  const currentStatusReason = statusReason || (handsMissing ? 'No hands' : !isHandsMoving ? 'Hands not moving' : 'Scrubbing active');
  const currentStepColor = STEP_COLORS[activeStep] || STEP_COLORS[1];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      justifyContent: 'space-between',
      gap: '14px'
    }}>
      {/* Rule 1: Hands Missing Warning Banner */}
      {handsMissing && (
        <div style={{
          background: '#FEF3C7',
          border: '2.5px solid #1E293B',
          borderRadius: '16px',
          padding: '10px 18px',
          color: '#1E293B',
          fontWeight: 800,
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '10px',
          boxShadow: '4px 4px 0px 0px #1E293B',
          fontFamily: 'Outfit, sans-serif'
        }}>
          <div style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: '#FBBF24',
            border: '2px solid #1E293B',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <AlertTriangle size={16} strokeWidth={2.5} color="#1E293B" />
          </div>
          <span>Show your hands to the camera</span>
        </div>
      )}

      {/* Multimedia Instruction Panel */}
      {!mediaFailed && (
        <div style={{ 
          width: '100%',
          height: '140px',
          background: '#090D16',
          borderRadius: '20px',
          overflow: 'hidden',
          position: 'relative',
          border: '2.5px solid #1E293B',
          boxShadow: '4px 4px 0px 0px #1E293B'
        }}>
          <video 
            key={`vid-step-${activeStep}`}
            src={`/assets/step_${activeStep}.mp4`} 
            autoPlay 
            loop 
            muted 
            playsInline
            onError={() => {
              console.warn(`[WashingView] Graceful degradation: Video asset /assets/step_${activeStep}.mp4 not found.`);
              setMediaFailed(true);
            }}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{
            position: 'absolute',
            bottom: '10px',
            left: '10px',
            background: '#FFFDF5',
            border: '2px solid #1E293B',
            padding: '3px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: 800,
            color: '#1E293B',
            boxShadow: '2px 2px 0px 0px #1E293B',
            fontFamily: 'Outfit, sans-serif'
          }}>
            {t('live_demo')}
          </div>
        </div>
      )}

      {/* Active Step Sticker Banner */}
      <div style={{
        background: '#FFFFFF',
        borderRadius: '20px',
        padding: '16px 20px',
        border: '2.5px solid #1E293B',
        boxShadow: '4px 4px 0px 0px #1E293B'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                background: currentStepColor.bg,
                color: currentStepColor.text,
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1.5px solid #1E293B',
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                fontFamily: 'Outfit, sans-serif'
              }}>
                {t('who_standard_banner')}
              </span>
              {isDryMode && (
                <span style={{
                  background: '#FEF3C7',
                  border: '1.5px solid #1E293B',
                  color: '#1E293B',
                  padding: '2px 8px',
                  borderRadius: '9999px',
                  fontSize: '10px',
                  fontWeight: 800,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontFamily: 'Outfit, sans-serif'
                }}>
                  🧪 TEST MODE
                </span>
              )}
            </div>
            <h2 style={{
              margin: '2px 0 0 0',
              fontSize: '22px',
              fontWeight: 800,
              color: '#1E293B',
              lineHeight: 1.25,
              fontFamily: 'Outfit, sans-serif',
              wordBreak: 'break-word'
            }}>
              {t('step_header', { step: activeStep, name: t(`step_${activeStep}_name`) })}
            </h2>
          </div>

          {/* Step Timer Sticker Box */}
          <div style={{
            background: isScrubbingActive ? '#D1FAE5' : isInGrace ? '#FEF3C7' : '#FCE7F3',
            border: '2px solid #1E293B',
            borderRadius: '16px',
            padding: '8px 14px',
            textAlign: 'center',
            minWidth: '85px',
            boxShadow: '3px 3px 0px 0px #1E293B',
            flexShrink: 0
          }}>
            <div style={{
              fontSize: '22px',
              fontWeight: 900,
              fontFamily: 'Outfit, monospace, sans-serif',
              color: '#1E293B',
              lineHeight: 1.1
            }}>
              {displayTimer}
            </div>
            <div style={{ fontSize: '10px', color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginTop: '2px' }}>
              of {recDuration.toFixed(1)}s
            </div>
          </div>
        </div>

        {/* Chunky Step Progress Bar */}
        <div style={{
          width: '100%',
          height: '14px',
          background: '#F1F5F9',
          borderRadius: '9999px',
          border: '2px solid #1E293B',
          overflow: 'hidden',
          padding: '1px'
        }}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: isScrubbingActive 
              ? 'linear-gradient(90deg, #8B5CF6, #34D399)' 
              : isInGrace 
              ? '#FBBF24' 
              : '#F472B6',
            borderRadius: '9999px',
            transition: 'width 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }} />
        </div>
      </div>

      {/* Status Reason Sticker Banner (Never color alone: icon + text + dark text) */}
      <div style={{
        padding: '12px 16px',
        borderRadius: '16px',
        background: isScrubbingActive ? '#D1FAE5' : isInGrace ? '#FEF3C7' : '#FCE7F3',
        border: '2px solid #1E293B',
        boxShadow: '3px 3px 0px 0px #1E293B',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        transition: 'all 0.3s ease'
      }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: isScrubbingActive ? '#34D399' : isInGrace ? '#FBBF24' : '#F472B6',
          border: '2px solid #1E293B',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '18px',
          flexShrink: 0
        }}>
          {isScrubbingActive ? (currentStepInfo.icon || '🧼') : isInGrace ? '⏳' : '⚠️'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#1E293B'
            }} />
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: '#1E293B',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {isScrubbingActive 
                ? t('active_movement') 
                : isInGrace 
                ? 'GRACE WINDOW (500MS)' 
                : currentStatusReason.toUpperCase()}
            </span>
          </div>

          <div style={{
            fontSize: '13px',
            fontWeight: 700,
            color: '#1E293B',
            marginTop: '2px',
            lineHeight: '1.3',
            wordBreak: 'break-word'
          }}>
            {isScrubbingActive
              ? t(`step_${activeStep}_instruction`)
              : currentStatusReason === 'No hands'
              ? 'No hands visible — hold both hands in front of camera'
              : currentStatusReason === 'Hands not moving'
              ? 'Hands not moving — keep scrubbing up and down firmly'
              : currentStatusReason?.startsWith('Wrong pose')
              ? `${currentStatusReason} — match the demo pose`
              : currentStatusReason === 'Low confidence'
              ? 'Low confidence — align palms to the camera'
              : currentStatusReason}
          </div>
        </div>

        <div style={{
          padding: '4px 10px',
          borderRadius: '9999px',
          background: '#FFFDF5',
          border: '1.5px solid #1E293B',
          fontSize: '10px',
          fontWeight: 800,
          color: '#1E293B',
          textTransform: 'uppercase',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          fontFamily: 'Outfit, sans-serif'
        }}>
          {isScrubbingActive ? t('timer_active') : isInGrace ? 'HOLDING PROGRESS' : t('timer_frozen')}
        </div>
      </div>

      {/* Grid of WHO 6 Steps - Rotating Confetti Colors & Sticker Styling */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        {WHO_STEPS_INFO.slice(1).map((step) => {
          const isActive = step.id === activeStep;
          const isDone = step.id < activeStep;
          const translatedName = t(`step_${step.id}_name`);
          const confColor = STEP_COLORS[step.id] || STEP_COLORS[1];

          return (
            <div
              key={step.id}
              onClick={() => {
                if (isDebug && onJumpToStep) onJumpToStep(step.id);
              }}
              style={{
                cursor: isDebug ? 'pointer' : 'default',
                background: isActive
                  ? confColor.bg
                  : isDone
                  ? '#D1FAE5'
                  : '#FFFFFF',
                borderRadius: '16px',
                padding: '10px 12px',
                border: '2px solid #1E293B',
                boxShadow: isActive 
                  ? '4px 4px 0px 0px #1E293B' 
                  : '2px 2px 0px 0px #1E293B',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: '84px',
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
                transform: isActive ? 'scale(1.03)' : 'none'
              }}
              title={isDebug ? `Click to jump to Step ${step.id} (Debug)` : undefined}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  color: isActive ? confColor.text : '#1E293B',
                  fontFamily: 'Outfit, sans-serif'
                }}>
                  {t('step_badge', { step: step.id })}
                </span>
                
                {isDone && (
                  <div style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: '#34D399',
                    border: '1.5px solid #1E293B',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={12} strokeWidth={3} color="#1E293B" />
                  </div>
                )}
                
                {isActive && (
                  <span style={{
                    fontSize: '9px',
                    background: '#1E293B',
                    color: '#FFFFFF',
                    padding: '2px 6px',
                    borderRadius: '9999px',
                    fontWeight: 800,
                    fontFamily: 'Outfit, sans-serif'
                  }}>
                    {t('in_progress')}
                  </span>
                )}
              </div>

              <span style={{
                fontSize: '12px',
                fontWeight: 700,
                color: isActive ? confColor.text : '#1E293B',
                marginTop: '4px',
                lineHeight: 1.25,
                wordBreak: 'break-word',
                fontFamily: 'Plus Jakarta Sans, sans-serif'
              }}>
                {translatedName}
              </span>
            </div>
          );
        })}
      </div>

      {/* Autonomous AI Touchless Status Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#FFFDF5',
        padding: '10px 16px',
        borderRadius: '16px',
        border: '2px solid #1E293B',
        boxShadow: '3px 3px 0px 0px #1E293B',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: '#34D399',
            border: '1.5px solid #1E293B',
            flexShrink: 0
          }} />
          <span style={{ fontSize: '12px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
            {t('touchless_active')}
          </span>
        </div>

        {/* Rule 5: Demo Skip / Finish Button visible ONLY when ?debug=1 */}
        {isDebug && (
          <button
            id="skip-or-finish-step-btn"
            onClick={() => {
              if (activeStep >= 6) {
                if (onStepComplete) {
                  onStepComplete({
                    stepNumber: 6,
                    durationMs: recDuration * 1000,
                    avgConfidence: confidence || 0.95,
                    completed: true
                  });
                }
                if (onFinishWashing) onFinishWashing();
              } else {
                if (onSkipStep) {
                  onSkipStep();
                }
              }
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '9999px',
              border: '2px solid #1E293B',
              background: activeStep >= 6 ? '#34D399' : '#FBBF24',
              color: '#1E293B',
              fontWeight: 800,
              fontSize: '11px',
              cursor: 'pointer',
              boxShadow: '2px 2px 0px 0px #1E293B',
              whiteSpace: 'nowrap',
              fontFamily: 'Outfit, sans-serif'
            }}
            title={activeStep >= 6 ? "Finish Washing & View Score (Debug)" : "Skip to next step (Debug)"}
          >
            {activeStep >= 6 ? t('complete_and_score') : t('skip_step')} [DEBUG]
          </button>
        )}
      </div>
    </div>
  );
}

export default WashingView;
