/**
 * SMART WASH — MediaPipe Hands Integration Hook
 * Rules enforced:
 * - Rule 1: Hand-presence gating (>= 1 or 2 hands with landmark confidence >= 0.6)
 * - Rule 2: Hand movement computed strictly from landmark displacement relative to hand scale
 * - Missing hands > 500ms detected and flagged
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { HANDWASH_CONFIG } from '../config/handwashConfig.js';
import { HandMovementTracker } from '../services/handLandmarkService.js';

export function useMediaPipeHands({
  videoRef,
  enabled = true,
  mode = HANDWASH_CONFIG.DETECTION_MODE || 'strict',
  scanIntervalMs = 80 // ~12.5 FPS for high responsiveness with low CPU overhead
} = {}) {
  const [handCount, setHandCount] = useState(0);
  const [handConfidence, setHandConfidence] = useState(0);
  const [handMovement, setHandMovement] = useState(0);
  const [isHandsMoving, setIsHandsMoving] = useState(false);
  const [handsMissing, setHandsMissing] = useState(true);
  const [isModelReady, setIsModelReady] = useState(false);
  const [handsData, setHandsData] = useState([]);

  const handsInstanceRef = useRef(null);
  const movementTrackerRef = useRef(new HandMovementTracker());
  const lastValidHandsRef = useRef([]);
  const lastHandsSeenTimeRef = useRef(0);
  const timerRef = useRef(null);
  const isProcessingFrameRef = useRef(false);

  const effectiveThreshold = mode === 'dry'
    ? HANDWASH_CONFIG.DRY_MOVEMENT_PATH_THRESHOLD
    : HANDWASH_CONFIG.STRICT_MOVEMENT_PATH_THRESHOLD;

  // Initialize MediaPipe Hands
  useEffect(() => {
    let isMounted = true;

    async function initHands() {
      try {
        const { Hands } = await import('@mediapipe/hands');
        const hands = new Hands({
          locateFile: (file) => `/mediapipe/hands/${file}`
        });

        // Prompt Fix 3: maxNumHands=2, minHandDetectionConfidence=0.3, minHandPresenceConfidence=0.3, minTrackingConfidence=0.3
        hands.setOptions({
          maxNumHands: HANDWASH_CONFIG.MAX_NUM_HANDS || 2,
          modelComplexity: 0, // Lite model for real-time responsiveness
          minDetectionConfidence: HANDWASH_CONFIG.HAND_DETECTION_CONFIDENCE || 0.30,
          minHandPresenceConfidence: HANDWASH_CONFIG.HAND_PRESENCE_CONFIDENCE || 0.30,
          minTrackingConfidence: HANDWASH_CONFIG.HAND_TRACKING_CONFIDENCE || 0.30
        });

        hands.onResults((results) => {
          if (!isMounted) return;
          const now = performance.now();

          const rawLandmarksList = results.multiHandLandmarks || [];
          const handednessList = results.multiHandedness || [];

          // Filter qualifying hands with confidence >= 0.30
          let qualifyingHands = [];
          for (let i = 0; i < rawLandmarksList.length; i++) {
            const conf = handednessList[i]?.score ?? 1.0;
            if (conf >= (HANDWASH_CONFIG.HAND_LANDMARK_MIN_CONFIDENCE || 0.30)) {
              qualifyingHands.push({
                landmarks: rawLandmarksList[i],
                confidence: conf
              });
            }
          }

          // Prompt Fix 3: If hands vanish for < 500 ms, keep the last state (hold last value)
          if (qualifyingHands.length > 0) {
            lastHandsSeenTimeRef.current = now;
            lastValidHandsRef.current = qualifyingHands;
            setHandsMissing(false);
          } else {
            const vanishElapsed = now - lastHandsSeenTimeRef.current;
            if (vanishElapsed < (HANDWASH_CONFIG.HAND_STATE_HOLD_MS || 500) && lastValidHandsRef.current.length > 0) {
              // Retain held hands during brief dropouts
              qualifyingHands = lastValidHandsRef.current;
            } else {
              lastValidHandsRef.current = [];
              if (vanishElapsed > (HANDWASH_CONFIG.HANDS_MISSING_PAUSE_MS || 500)) {
                setHandsMissing(true);
              }
            }
          }

          // Prompt Fix 2: Sliding 500ms window path-length movement metric with EMA 0.5
          const motionResult = movementTrackerRef.current.update(
            qualifyingHands,
            now,
            effectiveThreshold
          );

          setHandCount(motionResult.handCount);
          setHandConfidence(motionResult.handConfidence);
          setHandMovement(motionResult.movement);
          setIsHandsMoving(motionResult.isMoving);
          setHandsData(motionResult.handsData || []);
          isProcessingFrameRef.current = false;
        });

        await hands.initialize();
        if (isMounted) {
          handsInstanceRef.current = hands;
          setIsModelReady(true);
          console.log('[useMediaPipeHands] MediaPipe Hands model initialized successfully');
        }
      } catch (err) {
        console.warn('[useMediaPipeHands] Could not initialize MediaPipe Hands locally:', err.message);
      }
    }

    initHands();

    return () => {
      isMounted = false;
      if (handsInstanceRef.current) {
        try {
          handsInstanceRef.current.close();
        } catch {
          // ignore cleanup errors
        }
      }
    };
  }, [effectiveThreshold]);

  // Frame processing loop
  useEffect(() => {
    if (!enabled || !isModelReady) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const processFrame = async () => {
      const video = videoRef?.current;
      const isVideoReady = video && !video.paused && !video.ended && video.readyState >= 2;
      if (!isVideoReady || isProcessingFrameRef.current || !handsInstanceRef.current) {
        return;
      }

      try {
        isProcessingFrameRef.current = true;
        await handsInstanceRef.current.send({ image: video });
      } catch (err) {
        isProcessingFrameRef.current = false;
        console.warn('[useMediaPipeHands] Frame inference error:', err.message);
      }
    };

    timerRef.current = setInterval(processFrame, scanIntervalMs);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [enabled, isModelReady, scanIntervalMs, videoRef]);

  // Periodic missing-hands check (every 100ms)
  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const elapsed = performance.now() - lastHandsSeenTimeRef.current;
      if (elapsed > (HANDWASH_CONFIG.HANDS_MISSING_PAUSE_MS || 500)) {
        setHandsMissing(true);
        setHandMovement(0);
        setIsHandsMoving(false);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [enabled]);

  return {
    handCount,
    handConfidence,
    handMovement,
    isHandsMoving,
    handsMissing,
    isModelReady,
    handsData
  };
}

export default useMediaPipeHands;
