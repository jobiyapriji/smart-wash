import React, { useEffect, useRef, useState } from 'react';
import { useLanguage } from '../../../../src/i18n/LanguageContext.jsx';

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],         // Thumb
  [0, 5], [5, 6], [6, 7], [7, 8],         // Index
  [5, 9], [9, 10], [10, 11], [11, 12],    // Middle
  [9, 13], [13, 14], [14, 15], [15, 16],  // Ring
  [13, 17], [17, 18], [18, 19], [19, 20], // Pinky
  [0, 17]                                 // Palm base
];

/**
 * KioskCamera Component
 * Renders webcam video feed with face ID bounding boxes and hand landmark graphics.
 * When ?debug=1 is enabled, draws live MediaPipe hand skeleton landmarks on canvas
 * and displays live condition checklist + "Copy debug log" button.
 */
export function KioskCamera({
  videoRef,
  state = 'idle',
  activeStep = 0,
  confidence = 0,
  student = null,
  handsData = [],
  isDebug = false,
  telemetry = null,
  fps = 0,
  isDryMode = false,
  copyDebugLog = null,
  faceCount = 0,
  faceBoxPercent = 0,
  faceDistance = null,
  framingGuidance = 'Look at the camera'
}) {
  const { t } = useLanguage();
  const localVideoRef = useRef(null);
  const targetVideoRef = videoRef || localVideoRef;
  const canvasRef = useRef(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let stream = null;

    async function initCamera() {
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720, facingMode: 'user' }
          });
          if (targetVideoRef.current) {
            targetVideoRef.current.srcObject = stream;
          }
        }
      } catch (err) {
        console.warn("[KioskCamera] Camera access denied or not available; using simulated feed.", err);
      }
    }

    initCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [targetVideoRef]);

  // Prompt Fix 7: Draw MediaPipe hand landmarks and skeleton on canvas over video
  useEffect(() => {
    if (!isDebug || !canvasRef.current || !targetVideoRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const video = targetVideoRef.current;

    const w = video.videoWidth || 640;
    const h = video.videoHeight || 480;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    ctx.clearRect(0, 0, w, h);

    if (!handsData || handsData.length === 0) return;

    handsData.forEach((hand, handIdx) => {
      const landmarks = hand.landmarks;
      if (!landmarks || landmarks.length < 21) return;

      const handColor = handIdx === 0 ? '#38bdf8' : '#34d399';

      // Draw bone connections
      ctx.strokeStyle = handColor;
      ctx.lineWidth = 3;
      HAND_CONNECTIONS.forEach(([startIdx, endIdx]) => {
        const p1 = landmarks[startIdx];
        const p2 = landmarks[endIdx];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x * w, p1.y * h);
          ctx.lineTo(p2.x * w, p2.y * h);
          ctx.stroke();
        }
      });

      // Draw 21 landmark nodes
      landmarks.forEach((pt, idx) => {
        const isFingertip = [4, 8, 12, 16, 20].includes(idx);
        ctx.fillStyle = isFingertip ? '#f43f5e' : '#fbbf24';
        ctx.beginPath();
        ctx.arc(pt.x * w, pt.y * h, isFingertip ? 5 : 3.5, 0, 2 * Math.PI);
        ctx.fill();
      });

      // Draw merged hand tag if palms overlap
      if (hand.isMerged) {
        const palm = hand.palmCenter;
        if (palm) {
          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 14px monospace';
          ctx.fillText('MERGED PALMS', palm.x * w - 40, palm.y * h - 15);
        }
      }
    });
  }, [handsData, isDebug, targetVideoRef]);

  const handleCopyLog = () => {
    let logText = '';
    if (copyDebugLog) {
      logText = copyDebugLog();
    } else if (telemetry) {
      logText = JSON.stringify(telemetry, null, 2);
    }
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(logText).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '380px',
      borderRadius: '28px 28px 28px 4px',
      overflow: 'hidden',
      background: '#090d16',
      border: '3px solid #1E293B',
      boxShadow: '6px 6px 0px 0px #1E293B'
    }}>
      <video
        ref={targetVideoRef}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          transform: 'scaleX(-1)' // Mirror view for natural kiosk feedback
        }}
      />

      {/* MediaPipe Hand Landmarks Canvas Overlay (mirrored to match video) */}
      {isDebug && (
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            transform: 'scaleX(-1)', // Match mirrored video feed
            zIndex: 10
          }}
        />
      )}

      {/* Simulated Live View Overlay Graphic */}
      <div style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '16px',
        zIndex: 20
      }}>
        {/* Top Camera Status Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            background: '#FFFDF5',
            padding: '6px 14px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            border: '2px solid #1E293B',
            boxShadow: '2px 2px 0px #1E293B'
          }}>
            <span style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              background: state === 'washing' ? '#8B5CF6' : state === 'identifying' ? '#F472B6' : '#34D399',
              border: '1.5px solid #1E293B'
            }} />
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
              {t('ai_vision_engine')}
            </span>
          </div>

          {state === 'identifying' && (
            <div style={{
              background: '#8B5CF6',
              border: '2px solid #1E293B',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 800,
              boxShadow: '2px 2px 0px #1E293B',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {t('scanning_face')}
            </div>
          )}
        </div>

        {/* Center Face ID / Landmark Bounding Box Overlay */}
        {state === 'identifying' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '280px',
            height: '360px',
            borderRadius: '160px',
            border: '3.5px dashed #8B5CF6',
            boxShadow: '0 0 0 4px rgba(139, 92, 246, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexDirection: 'column',
            paddingBottom: '20px'
          }}>
            <span style={{
              fontSize: '13px',
              color: '#1E293B',
              fontWeight: 800,
              background: framingGuidance === 'Move back a little' || framingGuidance === 'Come closer' ? '#FBBF24' : '#FFFDF5',
              border: '2px solid #1E293B',
              padding: '6px 16px',
              borderRadius: '9999px',
              boxShadow: '3px 3px 0px #1E293B',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {framingGuidance || 'Look at the camera'}
            </span>
          </div>
        )}

        {state === 'ready' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: '#FFFDF5',
            border: '2.5px solid #1E293B',
            borderRadius: '20px',
            padding: '18px 24px',
            textAlign: 'center',
            boxShadow: '5px 5px 0px #1E293B',
            zIndex: 25
          }}>
            <div style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: '#34D399',
              border: '2px solid #1E293B',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '22px',
              marginBottom: '6px',
              boxShadow: '2px 2px 0px #1E293B'
            }}>
              👋
            </div>
            <div style={{ fontSize: '18px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
              Hi {student?.name || 'there'}!
            </div>
            <div style={{ fontSize: '13px', color: '#64748B', fontWeight: 600, marginTop: '4px' }}>
              Show your hands to start washing
            </div>
          </div>
        )}

        {state === 'washing' && (
          <div style={{
            position: 'absolute',
            top: '55%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '320px',
            height: '220px',
            borderRadius: '24px',
            border: '2.5px dashed #8B5CF6',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexDirection: 'column',
            paddingBottom: '14px'
          }}>
            <div style={{
              background: '#FFFDF5',
              padding: '6px 16px',
              borderRadius: '9999px',
              border: '2px solid #1E293B',
              boxShadow: '3px 3px 0px #1E293B',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{ fontSize: '16px' }}>👐</span>
              <span style={{ fontSize: '12px', color: '#1E293B', fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}>
                {t('rub_hands_in_view', { step: activeStep || 1 })}
              </span>
            </div>
          </div>
        )}

        {/* Bottom Student Recognition Tag */}
        {student && (
          <div style={{
            alignSelf: 'flex-start',
            background: '#FFFDF5',
            padding: '8px 16px',
            borderRadius: '16px',
            border: '2px solid #1E293B',
            boxShadow: '3px 3px 0px #1E293B',
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '34px',
              height: '34px',
              borderRadius: '50%',
              background: '#8B5CF6',
              border: '2px solid #1E293B',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'Outfit, sans-serif'
            }}>
              {student.name ? student.name[0] : 'S'}
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1E293B', fontFamily: 'Outfit, sans-serif' }}>
                {student.name}
              </div>
              <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>
                {t('student_id_label')}: {student.studentId}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Debug Overlay HUD (?debug=1) */}
      {isDebug && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: '#0F172A',
          border: isDryMode ? '2px solid #EAB308' : '2px solid #334155',
          padding: '12px 14px',
          borderRadius: '12px',
          fontFamily: 'monospace',
          fontSize: '11px',
          color: '#F8FAFC',
          zIndex: 9999,
          boxShadow: '4px 4px 0px 0px #000000',
          maxWidth: '350px',
          pointerEvents: 'auto'
        }}>
          {/* Header */}
          <div style={{
            color: isDryMode ? '#eab308' : '#38bdf8',
            fontWeight: 'bold',
            marginBottom: '6px',
            borderBottom: isDryMode ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(56, 189, 248, 0.4)',
            paddingBottom: '4px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>[DEBUG ?debug=1] {isDryMode ? '🧪 DRY TEST' : '🛡️ STRICT'}</span>
            <span style={{ fontSize: '10px', color: '#94a3b8' }}>FPS: {fps || 0}</span>
          </div>

          {/* Machine State & Face Telemetry */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', margin: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Machine State:</span>
              <span id="debug-machine-state" style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                {String(state).toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Face Count:</span>
              <span id="debug-face-count" style={{ color: faceCount > 0 ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                {faceCount} face(s)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Face Box Size:</span>
              <span id="debug-face-box-size" style={{
                color: (faceBoxPercent >= 25 && faceBoxPercent <= 60) ? '#22c55e' : faceBoxPercent > 0 ? '#facc15' : '#94a3b8',
                fontWeight: 'bold'
              }}>
                {faceBoxPercent}% (Target: 25-60%)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Recognition Dist:</span>
              <span id="debug-face-distance" style={{
                color: (faceDistance !== null && faceDistance !== Infinity && faceDistance < 0.50) ? '#22c55e' : '#facc15',
                fontWeight: 'bold'
              }}>
                {faceDistance !== null && faceDistance !== Infinity && faceDistance !== undefined
                  ? Number(faceDistance).toFixed(3)
                  : 'N/A'} (&lt; 0.50)
              </span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Framing Help:</span>
              <span id="debug-framing-help" style={{ color: '#e2e8f0', fontWeight: 'bold' }}>
                {framingGuidance || 'Look at the camera'}
              </span>
            </div>
          </div>

          {/* Washing Condition Checklist (When telemetry available during washing) */}
          {telemetry && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Hands Count:</span>
                <span style={{ color: (telemetry.ruleConditions?.handsPresent) ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                  {(telemetry.ruleConditions?.handsPresent) ? '✓ PASS' : '✗ FAIL'} ({telemetry.handCount} hands)
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Pose / Geometry:</span>
                <span style={{ color: (telemetry.ruleConditions?.stepMatch) ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                  {(telemetry.ruleConditions?.stepMatch) ? '✓ PASS' : '✗ FAIL'} {telemetry.geometryRulePassed ? `(Geom: ${telemetry.geometryRuleName})` : ''}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Classifier:</span>
                <span style={{ color: (telemetry.ruleConditions?.confidenceCheck) ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                  {(telemetry.ruleConditions?.confidenceCheck) ? '✓ PASS' : '✗ FAIL'} {telemetry.rawPrediction} ({(telemetry.rawConfidence || 0).toFixed(2)})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Movement:</span>
                <span style={{ color: (telemetry.ruleConditions?.movementCheck) ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                  {(telemetry.ruleConditions?.movementCheck) ? '✓ PASS' : '✗ FAIL'} ({(telemetry.handMovement || 0).toFixed(3)} ≥ {(telemetry.movementThreshold || 0.05).toFixed(2)})
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Grace Window:</span>
                <span style={{
                  color: telemetry.graceState === 'ACTIVE' ? '#22c55e' : telemetry.graceState === 'IN_GRACE' ? '#facc15' : '#f87171',
                  fontWeight: 'bold'
                }}>
                  {telemetry.graceState || 'IDLE'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '4px', marginTop: '2px' }}>
                <span>Step Timer:</span>
                <span style={{ color: '#38bdf8', fontWeight: 'bold' }}>
                  {telemetry.activeTimeMs || 0} ms / 6000 ms ({telemetry.elapsedSeconds || '0.0'}s)
                </span>
              </div>

              <div style={{
                marginTop: '6px',
                padding: '5px 8px',
                background: 'rgba(255, 255, 255, 0.07)',
                borderRadius: '6px',
                fontSize: '10px'
              }}>
                <div style={{ color: telemetry.failingReason?.includes('ALL') ? '#22c55e' : '#f87171', fontWeight: 'bold' }}>
                  STATUS: {telemetry.statusReason || telemetry.failingReason}
                </div>
              </div>
            </div>
          )}

          {/* Copy debug log Button */}
          {(copyDebugLog || telemetry) && (
            <button
              id="copy-debug-log-btn"
              onClick={handleCopyLog}
              style={{
                marginTop: '8px',
                width: '100%',
                padding: '6px 10px',
                background: copied ? '#10b981' : 'rgba(59, 130, 246, 0.3)',
                border: copied ? '1px solid #10b981' : '1px solid rgba(59, 130, 246, 0.6)',
                borderRadius: '6px',
                color: '#ffffff',
                fontFamily: 'monospace',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              {copied ? '✓ Copied to clipboard!' : '📋 Copy debug log (last 10s JSON)'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default KioskCamera;
