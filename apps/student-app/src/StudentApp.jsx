import React, { useState, useReducer, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { kioskReducer, INITIAL_KIOSK_STATE, KIOSK_STATES } from './studentStateMachine.js';
import { KioskCamera } from './components/StudentCamera.jsx';
import { WashingView } from './components/WashingView.jsx';
import { FeedbackView } from './components/FeedbackView.jsx';
import { LanguageSelectView } from './components/LanguageSelectView.jsx';
import { LoadingPage } from '../../../src/components/LoadingPage.jsx';

import { useLanguage } from '../../../src/i18n/LanguageContext.jsx';
import { cancelSpeech, speak } from '../../../src/services/speechService.js';

import { useFaceRecognition } from '../../../shared/hooks/useFaceRecognition.js';
import { useStepRecognition } from '../../../shared/hooks/useStepRecognition.js';
import { useMediaPipeHands } from '../../../shared/hooks/useMediaPipeHands.js';
import { createSession, updateSession, recordUnknownVisit } from '../../../shared/services/sessionService.js';
import { calculateHandwashScore } from '../../../shared/services/scoringService.js';
import { getAllStudents } from '../../../shared/services/studentService.js';
import { isMockFirebase } from '../../../shared/firebaseConfig.js';
import { HANDWASH_CONFIG } from '../../../shared/config/handwashConfig.js';

import { Button } from '../../../src/components/ui/Button.jsx';
import { IconBadge } from '../../../src/components/ui/IconBadge.jsx';
import { Pill } from '../../../src/components/ui/Pill.jsx';
import { Confetti } from '../../../src/components/ui/Confetti.jsx';
import { LogOut, Sparkles, User, AlertTriangle, Users, Search, HandMetal, ChevronRight, HelpCircle } from 'lucide-react';

export function StudentKioskApp({ useMock = false }) {
  const navigate = useNavigate();
  const { lang, setLang, t, languages } = useLanguage();
  const [state, dispatch] = useReducer(kioskReducer, INITIAL_KIOSK_STATE);
  const videoRef = useRef(null);
  const missedStepsRef = useRef([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__kioskDispatch = dispatch;
    }
  }, [dispatch]);

  // Check for ?debug=1 URL flag
  const isDebug = typeof window !== 'undefined' && window.location.search.includes('debug=1');

  // Developer exception: ?allowGuest=1 enables dev test mode
  const isAllowGuest = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('allowGuest') === '1';

  // Detection Mode: "strict" (real washing, default) | "dry" (testing via ?mode=dry)
  const isDryMode = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('mode') === 'dry' || HANDWASH_CONFIG.DETECTION_MODE === 'dry')
    : HANDWASH_CONFIG.DETECTION_MODE === 'dry';
  const detectionMode = isDryMode ? 'dry' : 'strict';

  const [isInitializingKiosk, setIsInitializingKiosk] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  // 1. MediaPipe Hands Hook (Rule 1 & Rule 2) - Keep active across camera states for immediate detection
  const handState = useMediaPipeHands({
    videoRef,
    enabled: [
      KIOSK_STATES.IDLE,
      KIOSK_STATES.IDENTIFYING,
      KIOSK_STATES.READY,
      KIOSK_STATES.WASHING
    ].includes(state.currentState)
  });

  // 2. Face Recognition Hook (Rule 6: distance < 0.50, 10 frames / ~3s evaluation window)
  const { 
    matchedStudent, 
    confidence: faceConfidence, 
    distance: faceDistance,
    bestDistance,
    framesChecked,
    unknownReason,
    faceCount,
    faceBoxPercent,
    framingGuidance,
    detectedDescriptor, 
    multipleFacesDetected, 
    unknownFaceDetected,
    isFacePresent,
    lastFaceSeenTime,
    simulateUnknownFace 
  } = useFaceRecognition({
    videoRef,
    enabled: [
      KIOSK_STATES.IDLE, 
      KIOSK_STATES.IDENTIFYING, 
      KIOSK_STATES.UNKNOWN_STUDENT, 
      KIOSK_STATES.MULTIPLE_FACES,
      KIOSK_STATES.WASHING
    ].includes(state.currentState),
    isWashing: state.currentState === KIOSK_STATES.WASHING,
    distanceThreshold: HANDWASH_CONFIG.FACE_MATCH_DISTANCE_THRESHOLD,
    scanIntervalMs: 350
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__simulateUnknownFace = simulateUnknownFace;
    }
  }, [simulateUnknownFace]);

  // 3. READY State Countdown (3s auto-transition to WASHING)
  const [readyCountdown, setReadyCountdown] = useState(3);

  useEffect(() => {
    if (state.currentState !== KIOSK_STATES.READY) {
      setReadyCountdown(3);
      return;
    }

    setReadyCountdown(3);
    const interval = setInterval(() => {
      setReadyCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          dispatch({ type: 'START_WASHING' });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [state.currentState]);

  // Single source of truth for identified student:
  // ONLY non-null on confirmed match in READY, WASHING, SCORING, or FEEDBACK states.
  // Strictly null in IDLE, IDENTIFYING, UNKNOWN_STUDENT, MULTIPLE_FACES, LANGUAGE_SELECT,
  // or when face is lost / session ends.
  const identifiedStudent = [
    KIOSK_STATES.READY,
    KIOSK_STATES.WASHING,
    KIOSK_STATES.SCORING,
    KIOSK_STATES.FEEDBACK
  ].includes(state.currentState) ? (state.student || null) : null;

  const handleProceedWithStudent = useCallback(async (student, modeOverride = null) => {
    const sessionMode = modeOverride || (student?.isTest ? 'test' : detectionMode);
    try {
      const result = await createSession(student.studentId, student.name, 'face_recognition', student.classId || 'UNKNOWN', sessionMode);
      dispatch({
        type: 'STUDENT_IDENTIFIED',
        payload: {
          student,
          sessionId: result.id
        }
      });
    } catch (err) {
      console.warn('[StudentApp] Session creation fallback:', err);
      dispatch({
        type: 'STUDENT_IDENTIFIED',
        payload: {
          student,
          sessionId: `sess_${Date.now()}`
        }
      });
    }
  }, [detectionMode]);

  // Autonomous Face Recognition State Machine Integration (IDLE <-> IDENTIFYING)
  useEffect(() => {
    if ([KIOSK_STATES.LANGUAGE_SELECT, KIOSK_STATES.READY, KIOSK_STATES.WASHING, KIOSK_STATES.SCORING, KIOSK_STATES.FEEDBACK].includes(state.currentState)) return;

    if (multipleFacesDetected) {
      if (state.currentState !== KIOSK_STATES.MULTIPLE_FACES) dispatch({ type: 'MULTIPLE_FACES_DETECTED' });
      return;
    }

    if (detectedDescriptor || unknownFaceDetected || isFacePresent) {
      if (state.currentState === KIOSK_STATES.IDLE) {
        dispatch({ type: 'START_IDENTIFICATION' });
      }
      return;
    }

    // If no face is detected, return to IDLE after a short delay
    if (!detectedDescriptor && !multipleFacesDetected && !unknownFaceDetected && !isFacePresent && state.currentState !== KIOSK_STATES.IDLE) {
      const timer = setTimeout(() => {
        dispatch({ type: 'RESET_TO_IDLE' });
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [state.currentState, multipleFacesDetected, unknownFaceDetected, detectedDescriptor, isFacePresent]);

  // 1. IDENTIFYING & UNKNOWN AUTO-RECOVERY:
  // Match -> go to READY showing the student's name
  // No match after 10 frames (~3 s) -> show UNKNOWN_STUDENT
  // In UNKNOWN: auto-recover if match appears, or return to IDLE when face leaves for 2s
  useEffect(() => {
    if (state.currentState === KIOSK_STATES.IDENTIFYING) {
      if (matchedStudent) {
        handleProceedWithStudent(matchedStudent);
      } else if (unknownFaceDetected) {
        dispatch({ type: 'UNKNOWN_FACE_DETECTED' });
      }
    } else if (state.currentState === KIOSK_STATES.UNKNOWN_STUDENT) {
      if (matchedStudent) {
        // Auto-recovery: person recognized (lighting improved or teacher enrolled them)
        handleProceedWithStudent(matchedStudent);
      } else if (!isFacePresent && !unknownFaceDetected) {
        // Face has left frame for 2s
        dispatch({ type: 'RESET_TO_IDLE' });
      }
    }
  }, [state.currentState, matchedStudent, unknownFaceDetected, isFacePresent, handleProceedWithStudent]);

  // When person walks away from unknown screen for 2s, return to IDLE
  useEffect(() => {
    if (state.currentState !== KIOSK_STATES.UNKNOWN_STUDENT) return;
    if (!isFacePresent) {
      const timer = setTimeout(() => {
        if (!isFacePresent && state.currentState === KIOSK_STATES.UNKNOWN_STUDENT) {
          dispatch({ type: 'RESET_TO_IDLE' });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [state.currentState, isFacePresent]);

  // Speak title and body once when UNKNOWN screen appears, and record privacy-safe daily visit
  const hasSpokenUnknownRef = useRef(false);
  const hasRecordedUnknownRef = useRef(false);

  useEffect(() => {
    if (state.currentState === KIOSK_STATES.UNKNOWN_STUDENT) {
      if (!hasSpokenUnknownRef.current) {
        hasSpokenUnknownRef.current = true;
        speak(
          'unknown_person_audio',
          lang,
          `${t('unknown_person_title')}. ${t('unknown_person_body')}`
        );
      }
      if (!hasRecordedUnknownRef.current) {
        hasRecordedUnknownRef.current = true;
        recordUnknownVisit().catch(err => console.warn('[StudentApp] Failed to record unknown visit:', err));
      }
    } else {
      hasSpokenUnknownRef.current = false;
      hasRecordedUnknownRef.current = false;
    }
  }, [state.currentState, lang, t]);

  const bothAbsentStartTimeRef = useRef(null);

  // Prompt Fix 6: Face lost during washing
  // Hands often cover the face while washing. Do not cancel or pause a session because the face disappears;
  // only cancel after 15 s with no face AND no hands.
  useEffect(() => {
    if (state.currentState !== KIOSK_STATES.WASHING) {
      bothAbsentStartTimeRef.current = null;
      return;
    }

    const safetyInterval = setInterval(() => {
      const now = Date.now();
      const faceAbsent = !isFacePresent && !detectedDescriptor;
      const handsAbsent = handState.handsMissing || handState.handCount === 0;

      if (faceAbsent && handsAbsent) {
        if (!bothAbsentStartTimeRef.current) {
          bothAbsentStartTimeRef.current = now;
        }
        const absentDuration = now - bothAbsentStartTimeRef.current;

        if (absentDuration >= (HANDWASH_CONFIG.FACE_ABSENT_TIMEOUT_MS || 15000)) {
          console.warn('[StudentApp] Session cancelled: both face AND hands absent for >=15s mid-session');
          resetTracker();
          cancelSpeech();
          dispatch({ type: 'RESET_TO_IDLE' });
        }
      } else {
        bothAbsentStartTimeRef.current = null;
      }
    }, 500);

    return () => clearInterval(safetyInterval);
  }, [state.currentState, isFacePresent, detectedDescriptor, handState.handsMissing, handState.handCount]);

  const handleStepComplete = useCallback((stepData) => {
    dispatch({ type: 'STEP_COMPLETED', payload: stepData });
  }, []);

  // Finish washing and compute explainable compliance score
  const handleFinishWashing = useCallback(async (finalEngineSteps = null) => {
    dispatch({ type: 'START_SCORING' });

    const currentMissed = missedStepsRef.current || [];
    
    // Ensure all completed steps from engine (including Step 6) are included
    let stepsToScore = state.completedSteps || [];
    if (Array.isArray(finalEngineSteps) && finalEngineSteps.length > 0) {
      const existingStepNums = new Set(stepsToScore.map(s => typeof s === 'object' ? s.stepNumber : s));
      const merged = [...stepsToScore];
      for (const stepNum of finalEngineSteps) {
        if (!existingStepNums.has(stepNum)) {
          merged.push({
            stepNumber: stepNum,
            durationMs: 6000,
            avgConfidence: 0.95,
            completed: true
          });
          existingStepNums.add(stepNum);
        }
      }
      stepsToScore = merged;
    }

    const scoreBreakdown = calculateHandwashScore(stepsToScore, currentMissed);
    const computedScore = scoreBreakdown.totalScore;

    // Rule 7: Only save to Firebase if >= 1 verified step, >= 10s scrub time, and NOT a dev test session
    const totalScrubSec = stepsToScore.reduce((acc, s) => acc + (typeof s === 'object' ? (s.durationMs || 0) : 6000), 0) / 1000;
    const isTestMode = detectionMode === 'test' || state.student?.isTest;

    const shouldSave = stepsToScore.length >= HANDWASH_CONFIG.MIN_VERIFIED_STEPS_TO_SAVE && 
                       totalScrubSec >= HANDWASH_CONFIG.MIN_VERIFIED_SCRUB_TIME_SEC && 
                       !isTestMode;

    if (shouldSave && state.sessionId) {
      await updateSession(state.sessionId, {
        score: computedScore,
        complianceScore: computedScore,
        steps: stepsToScore,
        completedSteps: stepsToScore,
        missedSteps: currentMissed,
        status: 'completed',
        mode: detectionMode
      });
    } else {
      console.log('[StudentApp] Session omitted from Firebase persistence. Criteria met?', shouldSave);
    }

    dispatch({
      type: 'SCORING_COMPLETE',
      payload: {
        score: computedScore,
        steps: stepsToScore
      }
    });
  }, [state.completedSteps, state.sessionId, state.student, detectionMode]);

  // Step Recognition Hook with real elapsed dt & 500ms grace window (Fix 1, 2, 3, 4)
  const {
    activeStep: mlActiveStep,
    confidence: stepConfidence,
    progress: mlProgress,
    activeTimeMs,
    elapsedSeconds,
    statusReason,
    graceState,
    isHandsMoving,
    handsMissing,
    resetTracker,
    telemetry,
    fps,
    missedSteps,
    skipStep,
    jumpToStep,
    copyDebugLog
  } = useStepRecognition({
    videoRef,
    enabled: state.currentState === KIOSK_STATES.WASHING,
    mode: detectionMode,
    handState,
    onStepCompleted: handleStepComplete,
    onFinishWashing: handleFinishWashing
  });

  missedStepsRef.current = missedSteps;

  const handleResetToIdle = useCallback(() => {
    resetTracker();
    dispatch({ type: 'RESET_TO_IDLE' });
  }, [resetTracker]);

  const handleExitKiosk = useCallback(() => {
    setIsExiting(true);
    setTimeout(() => {
      navigate('/');
    }, 450);
  }, [navigate]);

  if (isInitializingKiosk) {
    return (
      <LoadingPage
        message="Loading Kiosk..."
        duration={1000}
        onComplete={() => setIsInitializingKiosk(false)}
      />
    );
  }

  if (isExiting) {
    return (
      <LoadingPage
        message="Exiting Kiosk..."
        duration={400}
      />
    );
  }

  return (
    <div className="bg-dot-grid" style={{
      width: '100%',
      minHeight: '100vh',
      background: 'var(--background)',
      color: 'var(--foreground)',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Plus Jakarta Sans', sans-serif",
      position: 'relative',
      overflowX: 'hidden'
    }}>
      {/* Ambient Playful Confetti Shapes */}
      <Confetti />

      {/* Top Playful Header */}
      <header style={{
        padding: '12px 24px',
        background: '#FFFFFF',
        borderBottom: '2.5px solid #1E293B',
        boxShadow: '0 4px 0 0 #1E293B',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        zIndex: 30
      }}>
        {/* Brand & Mode */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '44px',
            height: '44px',
            borderRadius: '14px',
            background: 'var(--accent)',
            border: '2px solid #1E293B',
            boxShadow: '3px 3px 0 0 #1E293B',
            transform: 'rotate(-4deg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px'
          }}>
            🧼
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 style={{
                margin: 0,
                fontSize: '20px',
                fontWeight: 800,
                color: '#1E293B',
                fontFamily: 'Outfit, sans-serif'
              }}>
                {t('kiosk_title')}
              </h1>
              <span style={{
                fontSize: '11px',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '9999px',
                border: '1.5px solid #1E293B',
                background: 'var(--quaternary)',
                color: '#1E293B',
                textTransform: 'uppercase',
                fontFamily: 'Outfit, sans-serif'
              }}>
                {t(`state_${state.currentState}`)}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              {isMockFirebase && (
                <span style={{
                  padding: '2px 6px',
                  background: '#FEF3C7',
                  border: '1px solid #1E293B',
                  color: '#1E293B',
                  fontSize: '9px',
                  fontWeight: 800,
                  borderRadius: '4px'
                }}>
                  [LOCAL DEMO]
                </span>
              )}
              {isDryMode && (
                <span style={{
                  padding: '2px 8px',
                  background: '#FEF3C7',
                  border: '1.5px solid #1E293B',
                  color: '#1E293B',
                  fontSize: '10px',
                  fontWeight: 800,
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🧪 TEST MODE
                </span>
              )}
              {isAllowGuest && (
                <span style={{
                  padding: '2px 8px',
                  background: '#FEE2E2',
                  border: '1.5px solid #1E293B',
                  color: '#1E293B',
                  fontSize: '10px',
                  fontWeight: 800,
                  borderRadius: '9999px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  🧪 TEST MODE: GUEST ACTIVE
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right Header Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Persistent Voice Guidance Switcher */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#FFFDF5',
            padding: '3px 6px',
            borderRadius: '9999px',
            border: '2px solid #1E293B',
            boxShadow: '2px 2px 0 0 #1E293B',
            gap: '4px'
          }}>
            <span style={{ fontSize: '13px', marginLeft: '6px', marginRight: '2px' }}>🎙️</span>
            {languages.map((l, idx) => {
              const colors = ['#8B5CF6', '#34D399', '#FBBF24'];
              const isSelected = lang === l.code;
              return (
                <button
                  key={l.code}
                  id={`header-lang-btn-${l.code}`}
                  onClick={() => {
                    cancelSpeech();
                    setLang(l.code);
                    if (state.currentState === KIOSK_STATES.WASHING) {
                      speak(`step_${mlActiveStep}_audio`, l.code);
                    }
                  }}
                  style={{
                    background: isSelected ? colors[idx % 3] : 'transparent',
                    color: isSelected ? (idx === 0 ? '#FFFFFF' : '#1E293B') : '#64748B',
                    border: isSelected ? '1.5px solid #1E293B' : '1.5px solid transparent',
                    borderRadius: '9999px',
                    padding: '3px 10px',
                    fontSize: '11px',
                    fontWeight: 800,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    fontFamily: l.code === 'ml' ? "'Noto Sans Malayalam', sans-serif" : l.code === 'hi' ? "'Noto Sans Devanagari', sans-serif" : 'Outfit, sans-serif'
                  }}
                  title={`Switch voice guidance to ${l.nativeName}`}
                >
                  {l.nativeName}
                </button>
              );
            })}
          </div>

          {/* Exit Kiosk Button */}
          <Button
            variant="secondary"
            size="sm"
            onClick={handleExitKiosk}
            title="Return to Mode Selector"
          >
            <LogOut size={14} strokeWidth={2.5} style={{ marginRight: '4px' }} />
            {t('exit_kiosk')}
          </Button>
        </div>
      </header>

      {/* Main Kiosk Content Grid */}
      <main style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '24px',
        padding: '24px',
        boxSizing: 'border-box',
        zIndex: 10
      }}>
        {/* Left Column: Webcam inside Sticker Blob Frame */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column' }}>
          <KioskCamera
            videoRef={videoRef}
            state={state.currentState}
            activeStep={mlActiveStep}
            confidence={stepConfidence || faceConfidence}
            student={identifiedStudent}
            handsData={handState.handsData}
            isDebug={isDebug}
            telemetry={telemetry}
            fps={fps}
            isDryMode={isDryMode}
            copyDebugLog={copyDebugLog}
            faceCount={faceCount}
            faceBoxPercent={faceBoxPercent}
            faceDistance={faceDistance}
            bestDistance={bestDistance}
            framesChecked={framesChecked}
            unknownReason={unknownReason}
            framingGuidance={framingGuidance}
          />
        </div>

        {/* Right Column: Dynamic State Views in White Sticker Card */}
        <div style={{
          background: '#FFFFFF',
          borderRadius: '28px',
          padding: '28px',
          border: '3px solid #1E293B',
          boxShadow: '6px 6px 0px 0px #1E293B',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          position: 'relative'
        }}>
          {state.currentState === KIOSK_STATES.LANGUAGE_SELECT && (
            <LanguageSelectView
              onSelectLanguage={() => dispatch({ type: 'SELECT_LANGUAGE' })}
            />
          )}

          {/* IDLE State View */}
          {state.currentState === KIOSK_STATES.IDLE && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <IconBadge icon={Sparkles} color="violet" size="lg" shape="arch" />
              
              <h2 style={{
                margin: 0,
                fontSize: '38px',
                fontWeight: 800,
                color: '#1E293B',
                fontFamily: 'Outfit, sans-serif',
                lineHeight: 1.2
              }}>
                {t('welcome_title')}
              </h2>
              
              <p style={{
                margin: 0,
                color: '#64748B',
                fontSize: '16px',
                fontWeight: 600,
                maxWidth: '420px',
                lineHeight: 1.5
              }}>
                {t('welcome_subtitle')}
              </p>
              
              <div style={{
                background: '#FEF3C7',
                border: '2px solid #1E293B',
                borderRadius: '16px',
                padding: '12px 20px',
                color: '#1E293B',
                fontSize: '14px',
                fontWeight: 800,
                boxShadow: '3px 3px 0px 0px #1E293B',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'Outfit, sans-serif'
              }}>
                <span>👋 Step up and look at the camera to begin!</span>
              </div>

              {/* Quick Select Student */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', maxWidth: '340px', marginTop: '10px' }}>
                <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('quick_select_student')}
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleProceedWithStudent({ studentId: 'STU_101', name: 'Alex River', classId: 'Grade 5-A' })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      border: '2px solid #1E293B',
                      background: '#FFFDF5',
                      color: '#1E293B',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    👤 Alex River
                  </button>
                  <button
                    onClick={() => handleProceedWithStudent({ studentId: 'STU_102', name: 'Jordan Taylor', classId: 'Grade 5-A' })}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '9999px',
                      border: '2px solid #1E293B',
                      background: '#FFFDF5',
                      color: '#1E293B',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '2px 2px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    👤 Jordan Taylor
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 1. IDENTIFYING State View */}
          {state.currentState === KIOSK_STATES.IDENTIFYING && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px' }}>
              <IconBadge icon={Search} color="pink" size="lg" shape="circle" />
              
              <h2 style={{
                margin: 0,
                fontSize: '36px',
                fontWeight: 800,
                color: '#1E293B',
                fontFamily: 'Outfit, sans-serif'
              }}>
                Looking for your face...
              </h2>
              
              <p style={{
                margin: 0,
                color: '#64748B',
                fontSize: '15px',
                fontWeight: 600,
                maxWidth: '380px',
                lineHeight: 1.5
              }}>
                Look directly at the camera to identify yourself.
              </p>

              {/* Dynamic Framing Guidance Banner */}
              <div style={{
                marginTop: '6px',
                padding: '10px 18px',
                borderRadius: '9999px',
                background: framingGuidance === 'Move back a little' || framingGuidance === 'Come closer' ? '#FEF3C7' : '#EDE9FE',
                border: '2px solid #1E293B',
                color: '#1E293B',
                fontSize: '14px',
                fontWeight: 800,
                boxShadow: '3px 3px 0px 0px #1E293B',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                fontFamily: 'Outfit, sans-serif'
              }}>
                <span>{framingGuidance === 'Move back a little' ? '↔️' : framingGuidance === 'Come closer' ? '🔍' : '👤'}</span>
                <span>{framingGuidance}</span>
                {faceBoxPercent > 0 && (
                  <span style={{ fontSize: '11px', color: '#64748B' }}>({faceBoxPercent}% of frame)</span>
                )}
              </div>
            </div>
          )}

          {/* 2. READY State View */}
          {state.currentState === KIOSK_STATES.READY && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <IconBadge icon={HandMetal} color="mint" size="lg" shape="circle" />
              
              <h2 style={{
                margin: 0,
                fontSize: '34px',
                fontWeight: 800,
                color: '#1E293B',
                fontFamily: 'Outfit, sans-serif',
                lineHeight: 1.25
              }}>
                Hi {state.student?.name || 'there'}! Show your hands to start
              </h2>
              
              <p style={{
                margin: 0,
                color: '#64748B',
                fontSize: '15px',
                fontWeight: 600,
                maxWidth: '420px',
                lineHeight: 1.5
              }}>
                Get your hands ready in front of the camera. Wash session begins automatically in:
              </p>

              {/* Countdown Sticker Circle */}
              <div id="ready-countdown" style={{
                width: '84px',
                height: '84px',
                borderRadius: '50%',
                background: '#34D399',
                border: '3px solid #1E293B',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '44px',
                fontWeight: 900,
                color: '#1E293B',
                boxShadow: '4px 4px 0px 0px #1E293B',
                fontFamily: 'Outfit, monospace, sans-serif'
              }}>
                {readyCountdown}
              </div>

              <button
                id="ready-start-now-btn"
                onClick={() => dispatch({ type: 'START_WASHING' })}
                style={{
                  padding: '12px 30px',
                  borderRadius: '9999px',
                  border: '2px solid #1E293B',
                  background: '#8B5CF6',
                  color: '#FFFFFF',
                  fontWeight: 800,
                  fontSize: '15px',
                  cursor: 'pointer',
                  boxShadow: '4px 4px 0px 0px #1E293B',
                  fontFamily: 'Outfit, sans-serif',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>Start Washing Now</span>
                <ChevronRight size={18} strokeWidth={3} />
              </button>
            </div>
          )}

          {/* MULTIPLE FACES State View */}
          {state.currentState === KIOSK_STATES.MULTIPLE_FACES && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <IconBadge icon={Users} color="pink" size="lg" shape="square" />
              
              <h2 style={{
                margin: 0,
                fontSize: '34px',
                fontWeight: 800,
                color: '#1E293B',
                fontFamily: 'Outfit, sans-serif'
              }}>
                {t('multiple_faces_title')}
              </h2>
              
              <p style={{
                margin: 0,
                color: '#64748B',
                fontSize: '15px',
                fontWeight: 600,
                maxWidth: '400px',
                lineHeight: 1.5
              }}>
                {t('multiple_faces_desc')}
              </p>
            </div>
          )}

          {/* UNKNOWN PERSON State View (No buttons in normal flow) */}
          {state.currentState === KIOSK_STATES.UNKNOWN_STUDENT && (
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <IconBadge icon={HelpCircle} color="amber" size="lg" shape="circle" />
              
              <h2 style={{
                margin: 0,
                fontSize: '34px',
                fontWeight: 800,
                color: '#1E293B',
                fontFamily: 'Outfit, sans-serif',
                lineHeight: 1.25,
                maxWidth: '440px',
                wordBreak: 'break-word'
              }}>
                {t('unknown_person_title')}
              </h2>
              
              <p style={{
                margin: 0,
                color: '#64748B',
                fontSize: '16px',
                fontWeight: 600,
                maxWidth: '420px',
                lineHeight: 1.5,
                wordBreak: 'break-word'
              }}>
                {t('unknown_person_body')}
              </p>

              {/* Developer Test Mode Exception (?allowGuest=1) */}
              {isAllowGuest && (
                <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '3px 10px',
                    borderRadius: '9999px',
                    border: '1.5px solid #1E293B',
                    background: '#FEF3C7',
                    color: '#1E293B',
                    textTransform: 'uppercase',
                    fontFamily: 'Outfit, sans-serif'
                  }}>
                    🧪 TEST MODE: DEV GUEST ACTIVE
                  </span>
                  <button
                    id="dev-test-wash-btn"
                    onClick={() => handleProceedWithStudent({
                      studentId: 'DEV_TEST_USER',
                      name: 'Dev Test User',
                      classId: 'Test Class',
                      isTest: true
                    }, 'test')}
                    style={{
                      padding: '10px 22px',
                      borderRadius: '9999px',
                      border: '2px solid #1E293B',
                      background: '#8B5CF6',
                      color: '#FFFFFF',
                      fontSize: '13px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      boxShadow: '3px 3px 0 0 #1E293B',
                      fontFamily: 'Outfit, sans-serif'
                    }}
                  >
                    Start Test Wash (Dev Only) ➔
                  </button>
                </div>
              )}
            </div>
          )}

          {/* WASHING State View */}
          {state.currentState === KIOSK_STATES.WASHING && (
            <WashingView
              activeStep={mlActiveStep}
              confidence={stepConfidence || 0.88}
              progress={mlProgress}
              activeTimeMs={activeTimeMs}
              elapsedSeconds={elapsedSeconds}
              statusReason={statusReason}
              graceState={graceState}
              isHandsMoving={isHandsMoving}
              handsMissing={handsMissing}
              isDryMode={isDryMode}
              onStepComplete={handleStepComplete}
              onFinishWashing={handleFinishWashing}
              onSkipStep={skipStep}
              onJumpToStep={jumpToStep}
            />
          )}

          {/* FEEDBACK State View */}
          {state.currentState === KIOSK_STATES.FEEDBACK && (
            <FeedbackView
              score={state.finalScore}
              student={state.student}
              completedSteps={state.completedSteps}
              onReset={handleResetToIdle}
            />
          )}
        </div>
      </main>

      {/* Persistent Language Switcher Widget in the Corner */}
      <div style={{
        position: 'fixed',
        bottom: '16px',
        right: '16px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        background: '#FFFDF5',
        border: '2px solid #1E293B',
        borderRadius: '9999px',
        padding: '6px 12px',
        boxShadow: '3px 3px 0px 0px #1E293B'
      }}>
        <span style={{ fontSize: '14px' }}>🎙️</span>
        <span style={{ fontSize: '11px', color: '#1E293B', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>Voice:</span>
        {languages.map((l, idx) => {
          const colors = ['#8B5CF6', '#34D399', '#FBBF24'];
          const isSelected = lang === l.code;
          return (
            <button
              key={l.code}
              id={`corner-lang-btn-${l.code}`}
              onClick={() => {
                cancelSpeech();
                setLang(l.code);
                if (state.currentState === KIOSK_STATES.WASHING) {
                  speak(`step_${mlActiveStep}_audio`, l.code);
                }
              }}
              style={{
                background: isSelected ? colors[idx % 3] : 'transparent',
                color: isSelected ? (idx === 0 ? '#FFFFFF' : '#1E293B') : '#64748B',
                border: isSelected ? '1.5px solid #1E293B' : '1.5px solid transparent',
                borderRadius: '9999px',
                padding: '3px 8px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer',
                fontFamily: l.code === 'ml' ? "'Noto Sans Malayalam', sans-serif" : l.code === 'hi' ? "'Noto Sans Devanagari', sans-serif" : 'Outfit, sans-serif',
                transition: 'all 0.15s ease'
              }}
            >
              {l.nativeName}
            </button>
          );
        })}
        <button
          id="corner-open-modal-btn"
          onClick={() => {
            cancelSpeech();
            dispatch({ type: 'OPEN_LANGUAGE_SELECT' });
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#1E293B',
            fontSize: '12px',
            cursor: 'pointer',
            padding: '2px 4px',
            fontWeight: 800
          }}
          title="Open voice language selection screen"
        >
          ⚙️
        </button>
      </div>
    </div>
  );
}

export default StudentKioskApp;
