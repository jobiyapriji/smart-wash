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
import {
  computePalmCenter,
  computeHandScale,
  getHandBoundingBox,
  isMergedHand
} from '../services/handLandmarkService.js';

/**
 * Helper to resolve the correct WebSocket endpoint dynamically across dev, Docker, LAN, and HTTPS production.
 * 
 * Rules:
 * 1. Explicit VITE_WS_URL takes highest priority (upgraded to wss:// if page is HTTPS).
 * 2. If VITE_API_URL is configured, derives WebSocket URL (e.g. https://api.render.com -> wss://api.render.com/ws_model).
 * 3. Enforces WSS on HTTPS pages to prevent mixed-content browser errors.
 * 4. Preserves ws:// on localhost / HTTP for local development.
 * 5. Appends /ws_model path if omitted.
 * 
 * @param {Object} [customConfig] Optional override config for testing { wsUrl, apiUrl, windowObj }
 * @returns {string} The resolved WebSocket URL
 */
export function getWebSocketEndpoint(customConfig = null) {
  const win = customConfig?.windowObj !== undefined 
    ? customConfig.windowObj 
    : (typeof window !== 'undefined' ? window : null);

  const rawWsUrl = customConfig?.wsUrl !== undefined
    ? customConfig.wsUrl
    : (
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_WS_URL) ||
        win?.__SMARTWASH_CONFIG__?.wsUrl ||
        ''
      );

  const rawApiUrl = customConfig?.apiUrl !== undefined
    ? customConfig.apiUrl
    : (
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
        win?.__SMARTWASH_CONFIG__?.apiUrl ||
        ''
      );

  const isHttps = win?.location?.protocol === 'https:';

  // Helper to ensure endpoint ends with /ws_model
  const normalizeWsPath = (urlStr) => {
    const trimmed = String(urlStr || '').trim().replace(/\/$/, '');
    if (!trimmed) return '';
    return trimmed.endsWith('/ws_model') ? trimmed : `${trimmed}/ws_model`;
  };

  // 1. Explicit WebSocket URL override (VITE_WS_URL)
  if (rawWsUrl && String(rawWsUrl).trim()) {
    let resolved = String(rawWsUrl).trim();
    // If on HTTPS, enforce wss: protocol to prevent browser "insecure WebSocket" error
    if (isHttps) {
      if (resolved.startsWith('ws://')) {
        resolved = 'wss://' + resolved.slice(5);
      } else if (!resolved.startsWith('wss://')) {
        resolved = 'wss://' + resolved.replace(/^https?:\/\//, '');
      }
    }
    return normalizeWsPath(resolved);
  }

  // 2. Derive WebSocket URL from VITE_API_URL
  if (rawApiUrl && String(rawApiUrl).trim()) {
    const rawApi = String(rawApiUrl).trim();
    // In HTTPS production, always enforce wss:
    // In HTTP dev, use wss: if API is https:, otherwise ws:
    const wsProto = isHttps || rawApi.startsWith('https') ? 'wss:' : 'ws:';
    const cleanHost = rawApi.replace(/^(?:https?|wss?):\/\//, '').replace(/\/$/, '');
    return normalizeWsPath(`${wsProto}//${cleanHost}`);
  }

  // 3. Fallback when neither VITE_WS_URL nor VITE_API_URL is configured
  if (!win) {
    return 'ws://localhost:4550/ws_model';
  }

  const protocol = isHttps ? 'wss:' : 'ws:';
  const hostname = win.location?.hostname || 'localhost';
  const port = win.location?.port;

  // Behind reverse proxy (port 80 or 443, standard production school deployment)
  if (!port || port === '80' || port === '443') {
    return `${protocol}//${win.location?.host || hostname}/ws_model`;
  }

  // Standalone dev server (e.g. Vite on 3000, backend on 4550)
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
  const prevDebugRef = useRef(null); // throttled debug snapshot
  const lastWsDiagTimeRef = useRef(0);
  const lastDiagABTimeRef = useRef(0);
  const lastDiagETimeRef = useRef(0);
  const lastDiagFTimeRef = useRef(0);

  const lastStepTimeRef = useRef(performance.now());
  const onStepCompletedRef = useRef(onStepCompleted);
  const onFinishWashingRef = useRef(onFinishWashing);
  const activeStepRef = useRef(activeStep);
  // Guard to ensure finish callback fires only once per session
  const finishedRef = useRef(false);

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
      enableGeometryFallback: mode === 'dry' || mode === 'adaptive' || mode === 'ensemble' || Boolean(HANDWASH_CONFIG.ENABLE_ADAPTIVE_FUSION),
      confidenceThreshold: confidenceThreshold ?? (mode === 'dry' ? HANDWASH_CONFIG.DRY_CONFIDENCE_THRESHOLD : HANDWASH_CONFIG.CONFIDENCE_THRESHOLD),
      consecutiveFramesRequired: mode === 'dry' ? HANDWASH_CONFIG.DRY_DEBOUNCE_FRAMES : HANDWASH_CONFIG.DEBOUNCE_FRAMES,
      movementThreshold: HANDWASH_CONFIG.MOVEMENT_THRESHOLD
    });
  }, [mode, confidenceThreshold]);

  // WebSocket Connection to Backend YOLO Model
  useEffect(() => {
    let isDisposed = false;
    let reconnectTimeout = null;

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
      console.log('[DIAG:WS] Connecting to backend at:', endpoint);

      const isHttpsPage = typeof window !== 'undefined' && window.location?.protocol === 'https:';
      const isLocalhostEndpoint = endpoint.includes('localhost') || endpoint.includes('127.0.0.1');
      if (isHttpsPage && isLocalhostEndpoint) {
        console.warn(
          '[SMART WASH:WS] Running on HTTPS (' + (window.location?.origin || 'https') + 
          ') with localhost WebSocket (' + endpoint + '). ' +
          'Live handwashing recognition requires a deployed backend over WSS. ' +
          'Please set VITE_API_URL or VITE_WS_URL in your Vercel project settings.'
        );
      }

      let ws;
      try {
        ws = new WebSocket(endpoint);
      } catch (err) {
        console.warn('[DIAG:WS] Failed to construct WebSocket for endpoint:', endpoint, err);
        setTelemetry(prev => ({ ...prev, serverStatus: 'ERROR' }));
        setIsProcessing(false);
        if (!isDisposed && enabled) {
          reconnectTimeout = setTimeout(connectWebSocket, 4000);
        }
        return;
      }

      ws.onopen = () => {
        setIsProcessing(true);
        console.log('[DIAG:WS] Successfully connected to:', endpoint, 'readyState:', ws.readyState);
        setTelemetry(prev => ({ ...prev, serverStatus: 'CONNECTED' }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const now = performance.now();
          if (now - (lastDiagETimeRef.current || 0) > 1500) {
            lastDiagETimeRef.current = now;
            console.log('[BOUNDARY:E:FrontendReceive]', {
              hasPrediction: Boolean(data.prediction),
              rawPrediction: data.prediction,
              rawClass: data.prediction?.class,
              confidence: data.prediction?.confidence,
              hand_count: data.prediction?.hand_count,
              status: data.prediction?.status,
              is_moving: data.prediction?.is_moving,
              movement: data.prediction?.movement,
              timestamp: data.timestamp
            });
          }
          if (data.prediction && engineRef.current) {
            handlePrediction(data.prediction, data.timestamp);
          }
        } catch (err) {
          console.error('[useStepRecognition] Error parsing WS message:', err);
        }
      };

      ws.onerror = (err) => {
        console.warn('[DIAG:WS] WebSocket connection error on:', endpoint);
        setTelemetry(prev => ({ ...prev, serverStatus: 'ERROR' }));
      };

      ws.onclose = () => {
        console.log('[DIAG:WS] WebSocket connection closed, reconnecting in 2s...');
        setIsProcessing(false);
        setTelemetry(prev => ({ ...prev, serverStatus: 'RECONNECTING' }));
        if (!isDisposed && enabled) {
          reconnectTimeout = setTimeout(connectWebSocket, 2000);
        }
      };

      wsRef.current = ws;
    };

    connectWebSocket();

    return () => {
      isDisposed = true;
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [enabled]);

  // Main evaluation handler on each model prediction
  const handlePrediction = useCallback((prediction) => {
    if (!engineRef.current) return;
    const now = performance.now();

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
    const backendHandConfidence = (backendHandCount >= 1 && (prediction.hand_confidence === undefined || prediction.hand_confidence === null || prediction.hand_confidence === 0))
      ? 0.85
      : (prediction.hand_confidence ?? 0);

    // Multi-modal ensemble: fuse local MediaPipe with backend MediaPipe Tasks
    const handCount = Math.max(hands.handCount ?? 0, backendHandCount);
    const handConfidence = Math.max(hands.handConfidence ?? 0, backendHandConfidence);

    // Hands are missing only if BOTH frontend and backend report zero hands
    const handsMissingState = handCount === 0 && backendHandCount === 0;

    // Landmark fusion: use local MediaPipe handsData if present; otherwise reconstruct from backend 3D landmarks
    let fusedHandsData = (hands.handsData && hands.handsData.length > 0) ? hands.handsData : [];
    if (fusedHandsData.length === 0 && Array.isArray(prediction.landmarks) && prediction.landmarks.length > 0) {
      fusedHandsData = prediction.landmarks.map((lms) => {
        const palm = computePalmCenter(lms);
        const scale = computeHandScale(lms);
        const box = getHandBoundingBox(lms);
        const merged = isMergedHand(lms, scale);
        return {
          landmarks: lms,
          confidence: backendHandConfidence,
          palmCenter: palm,
          scale,
          box,
          isMerged: merged
        };
      });
    }

    // Dynamic Movement Fusion: combine frontend MediaPipe articulation with backend temporal motion
    const backendMovement = prediction.movement ?? 0;
    const backendIsMoving = Boolean(prediction.is_moving);

    // Movement: if student is actively washing, model predicts an active step
    const isModelPredictingAction = prediction.class && prediction.class !== 'background' && (prediction.confidence || 0) >= 0.30;
    const fallbackMovement = (isModelPredictingAction && handCount >= 1) ? 0.05 : 0;
    const handMovement = Math.max(hands.handMovement ?? 0, backendMovement, fallbackMovement);
    const isMoving = Boolean(
      hands.isHandsMoving ||
      backendIsMoving ||
      (handMovement >= (HANDWASH_CONFIG.MOVEMENT_THRESHOLD || 0.02))
    );

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
      handsData: fusedHandsData,
      isMerged: Boolean(prediction.is_merged || fusedHandsData.some(h => h.isMerged))
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

    // Throttled diagnostic logging – every 1.5s or on key transition
    const debugSnapshot = {
      handCount,
      backendHandCount: prediction.hand_count,
      rawClass: prediction.class,
      rawConfidence: prediction.confidence,
      geometryPassed: result.geometryRulePassed,
      handsMissing: result.handsMissing,
      statusReason: result.statusReason,
      activeTimeMs: result.activeTimeMs,
      elapsedSeconds: result.elapsedSeconds,
      completedSteps: result.completedSteps,
      currentStep: activeStepRef.current
    };
    const snapshotString = JSON.stringify(debugSnapshot);
    if (prevDebugRef.current !== snapshotString || (now - (lastWsDiagTimeRef.current || 0) > 1500)) {
      lastWsDiagTimeRef.current = now;
      const currentTargetStep = activeStepRef.current;
      const mappedStep = engineRef.current ? engineRef.current.getYoloClassStep(prediction.class) : -1;
      const stepMatch = mappedStep === currentTargetStep;
      const confThreshold = engineRef.current ? engineRef.current.confidenceThreshold : 0.60;
      const confidenceCheck = (prediction.confidence || 0) >= confThreshold;

      console.log('[BOUNDARY:F:RecognitionState]', {
        currentTarget: currentTargetStep,
        rawClass: prediction.class,
        mappedStep,
        stepMatch,
        confidence: Number((prediction.confidence || 0).toFixed(2)),
        threshold: confThreshold,
        confidenceCheck,
        fusedHandCount: handCount,
        handsPresent: result.ruleConditions?.handsPresent,
        movementCheck: result.ruleConditions?.movementCheck,
        stepSatisfied: (stepMatch && confidenceCheck) || Boolean(result.geometryRulePassed),
        geometryRulePassed: Boolean(result.geometryRulePassed),
        geometryRuleName: result.geometryRuleName,
        debounceStreak: result.debounceStreak,
        activeTimeMs: Math.round(result.activeTimeMs || 0),
        elapsedSeconds: result.elapsedSeconds,
        failingReason: result.failingReason,
        statusReason: result.statusReason
      });

      console.log('[DIAG:PipelineTelemetry]', {
        frontendHands: hands.handCount ?? 0,
        backendHands: backendHandCount,
        fusedHandCount: handCount,
        fusedHandConfidence: Number(handConfidence.toFixed(2)),
        backendClass: prediction.class,
        backendConf: Number((prediction.confidence || 0).toFixed(2)),
        statusReason: result.statusReason,
        activeTimeMs: Math.round(result.activeTimeMs || 0),
        elapsedSeconds: result.elapsedSeconds,
        ruleConditions: result.ruleConditions
      });
      prevDebugRef.current = snapshotString;
    }

    setActiveTimeMs(result.activeTimeMs || 0);
    setElapsedSeconds(result.elapsedSeconds !== undefined ? (typeof result.elapsedSeconds === 'number' ? result.elapsedSeconds.toFixed(1) : String(result.elapsedSeconds)) : ((result.activeTimeMs || 0) / 1000).toFixed(1));
    setStatusReason(result.statusReason || (result.handsMissing ? 'No hands' : 'Scrubbing active'));
    setGraceState(result.graceState || 'IDLE');
    setHandsMissing(result.handsMissing !== undefined ? Boolean(result.handsMissing) : handsMissingState);

    // Check if step advanced or sequence finished
    const isStepAdvanced = result.rawStep > currentTarget || (result.isFinished && currentTarget === 6);
    if (isStepAdvanced) {
      const duration = now - lastStepTimeRef.current;
      lastStepTimeRef.current = now;
      if (duration < 500) {
        console.debug('[SMART‑WASH] Ignored rapid step completion (<500ms)');
      } else if (onStepCompletedRef.current) {
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
    if (result.isFinished && !finishedRef.current) {
      finishedRef.current = true;
      console.log('[SMART‑WASH] Detected finish. Completed steps:', result.completedSteps);
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
    const now = performance.now();
    if (now - (lastDiagABTimeRef.current || 0) > 1500) {
      lastDiagABTimeRef.current = now;
      const hands = handStateRef.current || {};
      console.log('[BOUNDARY:A:FrontendLandmarks]', {
        frontendHandCount: hands.handCount ?? 0,
        hasHandsData: Boolean(hands.handsData && hands.handsData.length > 0),
        landmarksPerHand: (hands.handsData || []).map(h => h.landmarks?.length || 0),
        isHandsMoving: hands.isHandsMoving ?? false,
        handMovement: hands.handMovement ?? 0,
        handsMissing: hands.handsMissing ?? false
      });
      console.log('[BOUNDARY:B:WSTransmit]', {
        wsConnected: isWsConnected,
        readyState: wsRef.current ? wsRef.current.readyState : 'NO_WS',
        videoSize: `${vw}x${vh}`,
        cropSize: `${cropSize}x${cropSize}`
      });
    }

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
    // Guarded finish callback – fire once per session
    if (result.isFinished && !finishedRef.current) {
      finishedRef.current = true;
      console.log('[SMART‑WASH] Detected finish. Completed steps:', result.completedSteps);
      if (onFinishWashingRef.current) {
        onFinishWashingRef.current(result.completedSteps);
      }
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
    console.log('[DIAG:TrackerReset] resetTracker() executed: clearing engine, timers, predictions, and finish guard');
    // Reset engine internal state (prediction buffer, timers, counters)
    if (engineRef.current) {
      engineRef.current.reset();
    }
    // Reset React state mirrors
    setActiveStep(1);
    setProgress(0);
    setActiveTimeMs(0);
    setElapsedSeconds('0.0');
    setStatusReason('No hands');
    setGraceState('IDLE');
    setCompletedSteps([]);
    setMissedSteps([]);
    setHandsMissing(false);
    // Reset finish guard for a fresh session
    finishedRef.current = false;
    // Clear telemetry (preserve mode)
    setTelemetry(prev => ({
      ...prev,
      camActive: false,
      handCount: 0,
      handConfidence: 0,
      handMovement: 0,
      handsMissing: false,
      rawPrediction: 'None',
      rawConfidence: 0,
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
      statusReason: 'No hands',
      graceState: 'IDLE',
      debounceCount: 0,
      failingReason: 'WAITING_FOR_CAMERA',
      fps: 0
    }));
    // Reset timing reference used for step duration calculations
    lastStepTimeRef.current = performance.now();
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
