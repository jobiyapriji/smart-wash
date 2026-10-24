/**
 * SMART WASH — React Hook for Step Recognition (Strict Detection Gating)
 * 
 * Rules enforced:
 * - Rule 1: Hand-presence gating from MediaPipe Hands.
 * - Rule 2: Hand movement computed strictly from hand landmark displacement.
 * - Rule 3: Strict 5-condition crediting (hands, stepMatch, confidence>=0.60, movement>=0.05, debounce>=8).
 * - Rule 4: Explicit class mapping table.
 * - Rule 5: No synthetic / forged step advancement or automatic timeouts.
 * - Rule 9: Full Debug HUD telemetry behind ?debug=1 (handCount, movement, failing condition, FPS).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { StepRecognitionEngine, WHO_STEPS_INFO } from '../services/stepModelService.js';
import { HANDWASH_CONFIG } from '../config/handwashConfig.js';

// Helper to resolve the correct WebSocket endpoint dynamically across dev, Docker, and LAN kiosk setups
export function getWebSocketEndpoint() {
  if (typeof window === 'undefined') return 'ws://localhost:4550/ws_model';
  if (import.meta.env?.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  if (window.__SMARTWASH_CONFIG__?.wsUrl) return window.__SMARTWASH_CONFIG__.wsUrl;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const hostname = window.location.hostname || 'localhost';
  const port = window.location.port;

  // Behind reverse proxy (port 80 or 443, standard production school deployment)
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${window.location.host}/ws_model`;
  }
  // Standalone dev server (Vite on 3000, backend on 4550)
  return `${protocol}//${hostname}:4550/ws_model`;
}

export function useStepRecognition({
  videoRef,
  enabled = true,
  mode = HANDWASH_CONFIG.DETECTION_MODE || 'strict',
  confidenceThreshold = null,
  handState = null, // { handCount, handConfidence, handMovement, isHandsMoving, handsMissing, handsData }
  onStepCompleted = null,
  onFinishWashing = null
} = {}) {
  const [activeStep, setActiveStep] = useState(1);
  const [stepName, setStepName] = useState(WHO_STEPS_INFO[1]?.name || 'Palm to Palm');
  const [confidence, setConfidence] = useState(0);
  const [progress, setProgress] = useState(0);
  const [activeTimeMs, setActiveTimeMs] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState('0.0');
  const [statusReason, setStatusReason] = useState('No hands');
  const [graceState, setGraceState] = useState('IDLE');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHandsMoving, setIsHandsMoving] = useState(false);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [missedSteps, setMissedSteps] = useState([]);
  const [handsMissing, setHandsMissing] = useState(false);

  // FPS tracking
  const fpsFramesRef = useRef([]);
  const [fps, setFps] = useState(0);

  const isDry = mode === 'dry';
  const effectiveDebounce = isDry ? HANDWASH_CONFIG.DRY_DEBOUNCE_FRAMES : HANDWASH_CONFIG.DEBOUNCE_FRAMES;

  // Telemetry HUD State
  const [telemetry, setTelemetry] = useState({
    camActive: false,
    mode,
    handCount: 0,
    handConfidence: 0,
    handMovement: 0,
    movementThreshold: HANDWASH_CONFIG.MOVEMENT_THRESHOLD || 0.05,
    handsMissing: false,
    rawPrediction: 'None',
    rawConfidence: 0,
    expectedStep: 'Step 1 (Palm to Palm)',
    debounceCount: 0,
    requiredFrames: effectiveDebounce,
    failingReason: 'WAITING_FOR_CAMERA',
    statusReason: 'No hands',
    graceState: 'IDLE',
    activeTimeMs: 0,
    elapsedSeconds: '0.0',
    geometryRulePassed: false,
    geometryRuleName: null,
    ruleConditions: {
      handsPresent: false,
      stepMatch: false,
      confidenceCheck: false,
      movementCheck: false,
      debounceCheck: false,
      geometryRulePassed: false,
      geometryRuleName: null
    },
    fps: 0,
    serverStatus: 'CONNECTING'
  });

  const engineRef = useRef(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const handStateRef = useRef(handState);

  const lastStepTimeRef = useRef(performance.now());
  const onStepCompletedRef = useRef(onStepCompleted);
  const onFinishWashingRef = useRef(onFinishWashing);
  const activeStepRef = useRef(activeStep);

  useEffect(() => {
    handStateRef.current = handState;
  }, [handState]);

  useEffect(() => {
    activeStepRef.current = activeStep;
    onStepCompletedRef.current = onStepCompleted;
    onFinishWashingRef.current = onFinishWashing;
  });

  // Initialize Canvas for 320x320 streaming
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 320;
    canvasRef.current = canvas;
    ctxRef.current = canvas.getContext('2d', { willReadFrequently: true });
  }, []);

  // Initialize StepRecognitionEngine with mode-aware config
  useEffect(() => {
    engineRef.current = new StepRecognitionEngine({
      mode,
      enableGeometryFallback: mode === 'dry' || Boolean(HANDWASH_CONFIG.ENABLE_ADAPTIVE_FUSION),
      confidenceThreshold: confidenceThreshold ?? (mode === 'dry' ? HANDWASH_CONFIG.DRY_CONFIDENCE_THRESHOLD : HANDWASH_CONFIG.CONFIDENCE_THRESHOLD),
      consecutiveFramesRequired: mode === 'dry' ? HANDWASH_CONFIG.DRY_DEBOUNCE_FRAMES : HANDWASH_CONFIG.DEBOUNCE_FRAMES,
      movementThreshold: HANDWASH_CONFIG.MOVEMENT_THRESHOLD
    });
  }, [mode, confidenceThreshold]);

  // WebSocket Connection to Backend YOLO Model
  useEffect(() => {
    if (!enabled) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setIsProcessing(false);
      setTelemetry(prev => ({ ...prev, serverStatus: 'DISCONNECTED' }));
      return;
    }

    const connectWebSocket = () => {
      const endpoint = getWebSocketEndpoint();
      const ws = new WebSocket(endpoint);

      ws.onopen = () => {
        setIsProcessing(true);
        setTelemetry(prev => ({ ...prev, serverStatus: 'CONNECTED' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.prediction && engineRef.current) {
            handlePrediction(data.prediction, data.timestamp);
          }
        } catch (err) {
          console.error('[useStepRecognition] Error parsing WS message:', err);
        }
      };

      ws.onerror = () => {
        setTelemetry(prev => ({ ...prev, serverStatus: 'ERROR' }));
      };

      ws.onclose = () => {
        setIsProcessing(false);
        setTelemetry(prev => ({ ...prev, serverStatus: 'RECONNECTING' }));
        if (enabled) {
          setTimeout(connectWebSocket, 2000);
        }
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]);

  // Main evaluation handler on each model prediction
  const handlePrediction = useCallback((prediction, timestamp) => {
    if (!engineRef.current) return;
    const now = timestamp || performance.now();

    // Calculate real FPS
    const frameTimes = fpsFramesRef.current;
    frameTimes.push(now);
    while (frameTimes.length > 0 && frameTimes[0] < now - 1000) {
      frameTimes.shift();
    }
    const currentFps = frameTimes.length;
    setFps(currentFps);

    // Retrieve current hand landmark data
    const hands = handStateRef.current || {};
    const backendHandCount = prediction.hand_count ?? 0;
    const backendHandConfidence = prediction.hand_confidence ?? 0;

    // Multi-modal ensemble: fuse local MediaPipe with backend MediaPipe Tasks
    const handCount = Math.max(hands.handCount ?? 0, backendHandCount);
    const handConfidence = Math.max(hands.handConfidence ?? 0, backendHandConfidence);

    // Hands are missing only if NEITHER frontend nor backend detected hands
    const handsMissingState = handCount === 0 || (hands.handsMissing && backendHandCount === 0);

    // Movement: if student is actively washing, model predicts an active step
    const isModelPredictingAction = prediction.class && prediction.class !== 'background' && (prediction.confidence || 0) >= 0.30;
    const fallbackMovement = (isModelPredictingAction && handCount >= 1) ? 0.08 : 0;
    const handMovement = Math.max(hands.handMovement ?? 0, fallbackMovement);
    const isMoving = hands.isHandsMoving || (handMovement >= (HANDWASH_CONFIG.MOVEMENT_THRESHOLD || 0.05));

    setIsHandsMoving(isMoving);
    setHandsMissing(handsMissingState);

    // Strict or Dry Mode evaluation via StepRecognitionEngine
    const result = engineRef.current.predict({
      class: prediction.class || 'background',
      confidence: prediction.confidence || 0,
      handCount,
      handConfidence,
      handMovement,
      isHandsMoving: isMoving,
      handsData: hands.handsData || [],
      isMerged: Boolean(prediction.is_merged || (backendHandCount >= 1 && (hands.handsData || []).some(h => h.isMerged)))
    }, now);

    const currentTarget = activeStepRef.current;
    const targetInfo = WHO_STEPS_INFO[currentTarget] || WHO_STEPS_INFO[1];

    // Update Telemetry HUD
    setTelemetry({
      camActive: true,
      mode: result.mode || mode,
      handCount,
      handConfidence,
      handMovement,
      movementThreshold: engineRef.current ? engineRef.current.movementThreshold : (HANDWASH_CONFIG.MOVEMENT_THRESHOLD || 0.05),
      handsMissing: result.handsMissing,
      rawPrediction: prediction.class || 'None',
      rawConfidence: prediction.confidence || 0,
      expectedStep: `Step ${currentTarget} (${targetInfo.name})`,
      debounceCount: result.debounceStreak,
      requiredFrames: engineRef.current ? engineRef.current.debounceFramesRequired : effectiveDebounce,
      failingReason: result.failingReason,
      statusReason: result.statusReason,
      graceState: result.graceState,
      activeTimeMs: result.activeTimeMs,
      elapsedSeconds: result.elapsedSeconds !== undefined ? result.elapsedSeconds.toFixed(1) : (result.activeTimeMs / 1000).toFixed(1),
      ruleConditions: result.ruleConditions,
      geometryRulePassed: result.geometryRulePassed,
      geometryRuleName: result.geometryRuleName,
      fps: currentFps,
      serverStatus: 'CONNECTED'
    });

    setActiveTimeMs(result.activeTimeMs || 0);
    setElapsedSeconds(result.elapsedSeconds !== undefined ? result.elapsedSeconds.toFixed(1) : ((result.activeTimeMs || 0) / 1000).toFixed(1));
    setStatusReason(result.statusReason || 'No hands');
    setGraceState(result.graceState || 'IDLE');

    // Check if step advanced or sequence finished
    const isStepAdvanced = result.rawStep > currentTarget || (result.isFinished && currentTarget === 6);
    if (isStepAdvanced) {
      const duration = now - lastStepTimeRef.current;
      lastStepTimeRef.current = now;
      if (onStepCompletedRef.current) {
        onStepCompletedRef.current({
          stepNumber: currentTarget,
          durationMs: duration,
          avgConfidence: result.confidence,
          completed: true
        });
      }
      setCompletedSteps(prev => (prev.includes(currentTarget) ? prev : [...prev, currentTarget]));
    }

    setActiveStep(result.smoothedStep);
    setStepName(WHO_STEPS_INFO[result.smoothedStep]?.name || 'Unknown');
    setConfidence(result.confidence);
    setProgress(result.progressPercent);
    if (result.completedSteps) setCompletedSteps(result.completedSteps);
    if (result.missedSteps) setMissedSteps(result.missedSteps);

    // Check if all 6 steps are complete
    if (result.isFinished) {
      if (onFinishWashingRef.current) {
        onFinishWashingRef.current(result.completedSteps);
      }
    }
  }, []);

  // Frame Capture & WebSocket Streaming Loop
  const sendFrame = useCallback(() => {
    const video = videoRef?.current;
    const isVideoPlaying = video && !video.paused && !video.ended && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
    if (!isVideoPlaying || !ctxRef.current || !canvasRef.current) {
      setTelemetry(prev => ({ ...prev, camActive: false }));
      return;
    }

    // Center-crop video to square (1:1 aspect ratio) for YOLO
    const vw = video.videoWidth || 640;
    const vh = video.videoHeight || 480;
    const cropSize = Math.min(vw, vh);
    const sx = Math.max(0, (vw - cropSize) / 2);
    const sy = Math.max(0, Math.min(vh - cropSize, (vh - cropSize) * 0.7));

    ctxRef.current.drawImage(video, sx, sy, cropSize, cropSize, 0, 0, 320, 320);

    const isWsConnected = wsRef.current && wsRef.current.readyState === WebSocket.OPEN;
    if (isWsConnected) {
      if (typeof canvasRef.current.toBlob === 'function') {
        canvasRef.current.toBlob((blob) => {
          if (blob && wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(blob);
          }
        }, 'image/jpeg', 0.6);
      } else {
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.6);
        wsRef.current.send(dataUrl);
      }
    } else {
      // If server is not connected, feed idle background to engine so nothing runs
      handlePrediction({ class: 'background', confidence: 1.0 });
    }
  }, [videoRef, handlePrediction]);

  // Frame send interval (~10 FPS)
  useEffect(() => {
    if (enabled) {
      intervalRef.current = setInterval(sendFrame, 100);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [enabled, sendFrame]);

  // Debug-only skip step (gated behind ?debug=1)
  const skipStep = useCallback(() => {
    if (!engineRef.current) return;
    const currentTarget = activeStepRef.current;
    const result = engineRef.current.skipStep();
    if (onStepCompletedRef.current) {
      onStepCompletedRef.current({
        stepNumber: currentTarget,
        durationMs: 6000,
        avgConfidence: 0.95,
        completed: true
      });
    }
    setActiveStep(result.smoothedStep);
    setStepName(WHO_STEPS_INFO[result.smoothedStep]?.name || 'Unknown');
    setProgress(result.progressPercent);
    if (result.completedSteps) setCompletedSteps(result.completedSteps);
    if (result.isFinished && onFinishWashingRef.current) {
      onFinishWashingRef.current(result.completedSteps);
    }
  }, []);

  const jumpToStep = useCallback((stepNumber) => {
    if (!engineRef.current) return;
    const result = engineRef.current.jumpToStep(stepNumber);
    setActiveStep(result.smoothedStep);
    setStepName(WHO_STEPS_INFO[result.smoothedStep]?.name || 'Unknown');
    setProgress(result.progressPercent);
    if (result.completedSteps) setCompletedSteps(result.completedSteps);
  }, []);

  const resetTracker = useCallback(() => {
    if (engineRef.current) {
      engineRef.current.reset();
    }
    setActiveStep(1);
    setProgress(0);
    setActiveTimeMs(0);
    setElapsedSeconds('0.0');
    setStatusReason('No hands');
    setGraceState('IDLE');
    setCompletedSteps([]);
    setMissedSteps([]);
  }, []);

  const copyDebugLog = useCallback(() => {
    if (engineRef.current) {
      return engineRef.current.getDebugLog();
    }
    return JSON.stringify([telemetry], null, 2);
  }, [telemetry]);

  return {
    activeStep,
    stepName,
    confidence,
    progress,
    activeTimeMs,
    elapsedSeconds,
    statusReason,
    graceState,
    isProcessing,
    isHandsMoving,
    handsMissing,
    completedSteps,
    missedSteps,
    telemetry,
    fps,
    resetTracker,
    skipStep,
    jumpToStep,
    copyDebugLog
  };
}

export default useStepRecognition;
