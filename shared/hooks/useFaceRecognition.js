/**
 * SMART WASH — Face Recognition React Hook
 * Owned by Jesty (Face ID + Backend)
 * 
 * Provides live video-stream face detection, descriptor calculation,
 * vector matching against enrolled students, and student enrollment helpers.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as faceapi from '@vladmandic/face-api';
import { getAllStudents, matchFaceDescriptor, enrollStudent } from '../services/studentService.js';
import { HANDWASH_CONFIG } from '../config/handwashConfig.js';

import { filterMultiPersonFaces } from '../services/faceFilterService.js';

export { filterMultiPersonFaces };

export function useFaceRecognition({
  videoRef,
  enabled = true,
  distanceThreshold = 0.50, // Rule 6: Strict Euclidean distance < 0.5
  scanIntervalMs = 400,
  isWashing = false
} = {}) {
  const [enrolledStudents, setEnrolledStudents] = useState([]);
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [distance, setDistance] = useState(Infinity);
  const [confidence, setConfidence] = useState(0);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [detectedDescriptor, setDetectedDescriptor] = useState(null);
  const [isFacePresent, setIsFacePresent] = useState(false);
  const [lastFaceSeenTime, setLastFaceSeenTime] = useState(Date.now());
  const [error, setError] = useState(null);
  const [multipleFacesDetected, setMultipleFacesDetected] = useState(false);
  const [unknownFaceDetected, setUnknownFaceDetected] = useState(false);

  // Framing help & telemetry
  const [faceCount, setFaceCount] = useState(0);
  const [faceBoxPercent, setFaceBoxPercent] = useState(0);
  const [framingGuidance, setFramingGuidance] = useState('Look at the camera');

  const scanTimerRef = useRef(null);
  const consecutiveMatchesRef = useRef([]);
  const multiFaceConsecutiveFramesRef = useRef(0);
  const dominantFaceStableStartTimeRef = useRef(null);
  const stableFaceFramesRef = useRef(0);
  const faceFirstSeenTimeRef = useRef(null);

  // Load enrolled students from Firestore / store
  const refreshStudents = useCallback(async () => {
    try {
      const students = await getAllStudents();
      setEnrolledStudents(students);
      return students;
    } catch (err) {
      console.error('[useFaceRecognition] Failed to fetch enrolled students:', err);
      setError(err.message);
      return [];
    }
  }, []);

  useEffect(() => {
    refreshStudents();
  }, [refreshStudents]);

  // Load face-api models
  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);
        setIsModelLoaded(true);
        console.log('[useFaceRecognition] Models loaded successfully');
      } catch (err) {
        console.error('[useFaceRecognition] Error loading models:', err);
        setError('Failed to load face recognition models.');
      }
    };
    loadModels();
  }, []);

  // Main facial scan loop
  const performScan = useCallback(async () => {
    if (!enabled || !videoRef?.current || !isModelLoaded) return;

    setIsDetecting(true);
    try {
      const video = videoRef.current;
      if (video.paused || video.ended || video.readyState < 2) {
        setIsDetecting(false);
        return;
      }

      // Perform face-api detection if models are loaded
      if (faceapi.nets.ssdMobilenetv1.isLoaded) {
        const detections = await faceapi
          .detectAllFaces(video)
          .withFaceLandmarks()
          .withFaceDescriptors();

        const count = detections ? detections.length : 0;
        setFaceCount(count);

        if (detections && detections.length > 0) {
          const now = Date.now();
          setIsFacePresent(true);
          setLastFaceSeenTime(now);

          if (!faceFirstSeenTimeRef.current) {
            faceFirstSeenTimeRef.current = now;
          }

          // Multi-person check: filter out background faces < 50% of largest face
          const filterResult = filterMultiPersonFaces(
            detections,
            multiFaceConsecutiveFramesRef.current,
            dominantFaceStableStartTimeRef.current,
            now,
            HANDWASH_CONFIG
          );
          multiFaceConsecutiveFramesRef.current = filterResult.consecutiveCount;
          dominantFaceStableStartTimeRef.current = filterResult.dominantStartTime;

          // Compute box size % of primary (largest) face relative to frame height (target 25-60%)
          const primary = filterResult.primaryFace;
          const box = primary?.detection?.box || primary?.box || {};
          const frameHeight = video.videoHeight || 480;
          const boxHeight = box.height || 0;
          const boxPct = frameHeight > 0 ? Math.round((boxHeight / frameHeight) * 100) : 0;
          setFaceBoxPercent(boxPct);

          // Framing guidance rule:
          // > 60% -> "Move back a little"
          // < 25% -> "Come closer"
          // 25-60% -> "Looking for your face..."
          if (boxPct > (HANDWASH_CONFIG.FACE_BOX_TARGET_MAX_PERCENT || 60)) {
            setFramingGuidance('Move back a little');
          } else if (boxPct < (HANDWASH_CONFIG.FACE_BOX_TARGET_MIN_PERCENT || 25)) {
            setFramingGuidance('Come closer');
          } else {
            setFramingGuidance('Looking for your face...');
          }

          // In WASHING state: do NOT re-run recognition while washing. Keep identified student.
          if (isWashing) {
            return;
          }

          if (filterResult.isBlocked) {
            setMultipleFacesDetected(true);
            setUnknownFaceDetected(false);
            setDetectedDescriptor(null);
            setMatchedStudent(null);
            setDistance(Infinity);
            setConfidence(0);
            consecutiveMatchesRef.current = [];
            stableFaceFramesRef.current = 0;
          } else {
            setMultipleFacesDetected(false);
            const descriptor = Array.from(primary.descriptor);
            setDetectedDescriptor(descriptor);

            // Face detected and stable for ~1 s (3-5 consecutive frames)
            stableFaceFramesRef.current++;

            if (stableFaceFramesRef.current >= (HANDWASH_CONFIG.FACE_STABLE_FRAMES_REQUIRED || 3)) {
              // Run recognition (Euclidean distance < 0.5 against enrolled descriptors)
              const match = matchFaceDescriptor(descriptor, enrolledStudents, distanceThreshold);
              setDistance(match.distance);
              setConfidence(match.confidence);

              if (match.matchedStudent && match.distance < distanceThreshold) {
                setUnknownFaceDetected(false);
                consecutiveMatchesRef.current.push(match.matchedStudent.studentId);
                if (consecutiveMatchesRef.current.length > 3) {
                  consecutiveMatchesRef.current.shift();
                }

                // Match -> confirm and set matchedStudent
                const allMatch = consecutiveMatchesRef.current.length >= 3 &&
                  consecutiveMatchesRef.current.every(id => id === match.matchedStudent.studentId);

                if (allMatch) {
                  setMatchedStudent(match.matchedStudent);
                }
              } else {
                consecutiveMatchesRef.current = [];
                // No match after ~3 s -> show "I don't know you yet"
                const faceDuration = now - (faceFirstSeenTimeRef.current || now);
                if (faceDuration >= (HANDWASH_CONFIG.FACE_NO_MATCH_TIMEOUT_MS || 3000)) {
                  setUnknownFaceDetected(true);
                  setMatchedStudent(null);
                }
              }
            }
          }
        } else {
          // No face in frame
          dominantFaceStableStartTimeRef.current = null;
          multiFaceConsecutiveFramesRef.current = 0;
          stableFaceFramesRef.current = 0;
          faceFirstSeenTimeRef.current = null;
          setIsFacePresent(false);
          setMultipleFacesDetected(false);
          setUnknownFaceDetected(false);
          setDetectedDescriptor(null);
          setMatchedStudent(null);
          setDistance(Infinity);
          setConfidence(0);
          setFaceBoxPercent(0);
          setFramingGuidance('Look at the camera');
          consecutiveMatchesRef.current = [];
        }
      }
    } catch (err) {
      console.warn('[useFaceRecognition] Scan warning:', err.message);
    } finally {
      setIsDetecting(false);
    }
  }, [enabled, videoRef, enrolledStudents, distanceThreshold, isModelLoaded, isWashing]);

  // Interval loop
  useEffect(() => {
    if (enabled && videoRef?.current && isModelLoaded) {
      scanTimerRef.current = setInterval(performScan, scanIntervalMs);
    } else {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    }
    return () => {
      if (scanTimerRef.current) clearInterval(scanTimerRef.current);
    };
  }, [enabled, videoRef, scanIntervalMs, performScan, isModelLoaded]);

  // Helper for quick simulation/testing in dev environments
  const simulateDetection = useCallback((studentId) => {
    const student = enrolledStudents.find(s => s.studentId === studentId);
    if (student) {
      setMatchedStudent(student);
      setDistance(0.15);
      setConfidence(92);
      setFaceCount(1);
      setFaceBoxPercent(42);
      setIsFacePresent(true);
      setUnknownFaceDetected(false);
      setFramingGuidance('Looking for your face...');
      setDetectedDescriptor(student.descriptor);
      console.log(`[useFaceRecognition] Simulated recognition for ${student.name}`);
    } else {
      setMatchedStudent(null);
      setDistance(Infinity);
      setConfidence(0);
      setFaceCount(0);
      setFaceBoxPercent(0);
      setIsFacePresent(false);
      setFramingGuidance('Look at the camera');
      setDetectedDescriptor(null);
    }
  }, [enrolledStudents]);

  const simulateUnknownFace = useCallback(() => {
    setMatchedStudent(null);
    setDistance(0.72);
    setConfidence(38);
    setFaceCount(1);
    setFaceBoxPercent(40);
    setIsFacePresent(true);
    setUnknownFaceDetected(true);
    setFramingGuidance('Looking for your face...');
    setDetectedDescriptor(Array.from({ length: 128 }, () => Math.random()));
    console.log('[useFaceRecognition] Simulated unknown face');
  }, []);

  // Helper to enroll current video frame's face
  const enrollCurrentFace = useCallback(async ({ studentId, name, classId }) => {
    let descriptor = detectedDescriptor;

    // Perform an immediate live scan from the video element to get the freshest descriptor
    if (videoRef?.current && isModelLoaded && faceapi.nets.ssdMobilenetv1.isLoaded) {
      try {
        const video = videoRef.current;
        if (!video.paused && !video.ended && video.readyState >= 2) {
          const detection = await faceapi
            .detectSingleFace(video)
            .withFaceLandmarks()
            .withFaceDescriptor();
          if (detection) {
            descriptor = Array.from(detection.descriptor);
            setDetectedDescriptor(descriptor);
          }
        }
      } catch (err) {
        console.warn('[useFaceRecognition] Live scan during enrollment error:', err);
      }
    }

    if (!descriptor) {
      // Fallback synthetic vector if face wasn't in frame
      descriptor = Array.from({ length: 128 }, () => Math.random());
    }

    const success = await enrollStudent({
      studentId,
      name,
      classId,
      descriptor,
      photoUrl: ''
    });

    if (success) {
      await refreshStudents();
    }
    return success;
  }, [detectedDescriptor, videoRef, isModelLoaded, refreshStudents]);

  return {
    enrolledStudents,
    matchedStudent,
    distance,
    confidence,
    isDetecting,
    isModelLoaded,
    detectedDescriptor,
    multipleFacesDetected,
    unknownFaceDetected,
    error,
    isFacePresent,
    lastFaceSeenTime,
    faceCount,
    faceBoxPercent,
    framingGuidance,
    refreshStudents,
    simulateDetection,
    simulateUnknownFace,
    enrollCurrentFace
  };
}
