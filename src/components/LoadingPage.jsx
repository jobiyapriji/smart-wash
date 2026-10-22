import React, { useState, useEffect, useRef } from 'react';
import { HandsRubbingAnimation } from './HandsRubbingAnimation.jsx';
import { Confetti } from './ui/Confetti.jsx';

/**
 * SMART WASH — Playful Geometric Loading Screen
 * Re-styled with warm cream dot-grid background, sticker stage with hard shadow,
 * and the charming hand-rubbing animation.
 */
export function LoadingPage({
  message = 'Loading...',
  submessage = '',
  progress = null,
  duration = 1400,
  onComplete = null,
  fullScreen = true
}) {
  const [internalProgress, setInternalProgress] = useState(progress !== null ? progress : 0);
  const startTimeRef = useRef(Date.now());
  const timerRef = useRef(null);

  // Controlled progress sync
  useEffect(() => {
    if (progress !== null) {
      setInternalProgress(Math.min(100, Math.max(0, progress)));
    }
  }, [progress]);

  // Automatic smooth progress when progress prop is not provided
  useEffect(() => {
    if (progress !== null) return;

    startTimeRef.current = Date.now();
    const interval = 25;

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));

      setInternalProgress(pct);

      if (pct >= 100) {
        clearInterval(timerRef.current);
        if (onComplete) {
          setTimeout(() => {
            onComplete();
          }, 150);
        }
      }
    }, interval);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [progress, duration, onComplete]);

  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className="bg-dot-grid"
      style={{
        position: fullScreen ? 'fixed' : 'relative',
        inset: fullScreen ? 0 : 'auto',
        width: '100%',
        minHeight: fullScreen ? '100vh' : '360px',
        zIndex: 99999,
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
        fontFamily: 'var(--font-body)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        boxSizing: 'border-box',
        overflow: 'hidden'
      }}
    >
      <style>{`
        @keyframes bounceDotViolet {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes bounceDotPink {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.3); opacity: 1; }
        }
        @keyframes bounceDotAmber {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1.3); opacity: 1; }
        }
      `}</style>

      {/* Playful Confetti background elements */}
      <Confetti />

      {/* Playful Geometric Sticker Stage */}
      <div
        className="sticker-card animate-pop-in"
        style={{
          width: '100%',
          maxWidth: '440px',
          padding: '36px 32px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          boxShadow: '8px 8px 0px 0px var(--border-dark)',
          borderRadius: '24px',
          position: 'relative',
          zIndex: 10
        }}
      >
        {/* Top decorative color strip */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            backgroundColor: 'var(--accent)',
            borderTopLeftRadius: '22px',
            borderTopRightRadius: '22px'
          }}
        />

        {/* The Cartoon Hand Rubbing Animation */}
        <div style={{ marginBottom: '16px' }}>
          <HandsRubbingAnimation size={170} />
        </div>

        {/* Title in Outfit */}
        <h2
          style={{
            fontFamily: 'var(--font-heading)',
            fontSize: '26px',
            fontWeight: 800,
            letterSpacing: '-0.02em',
            margin: '0 0 6px 0',
            color: 'var(--foreground)'
          }}
        >
          SMART WASH
        </h2>

        {/* Loading text with rotating colored bouncing dots */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
            fontSize: '14px',
            color: 'var(--muted-foreground)',
            fontWeight: 600,
            marginBottom: submessage ? '4px' : '20px'
          }}
        >
          <span>{message}</span>
          <span style={{ display: 'inline-flex', gap: '4px', marginLeft: '4px' }}>
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--accent)',
                display: 'inline-block',
                animation: 'bounceDotViolet 1.2s infinite ease-in-out',
                animationDelay: '0s'
              }}
            />
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--secondary)',
                display: 'inline-block',
                animation: 'bounceDotPink 1.2s infinite ease-in-out',
                animationDelay: '0.2s'
              }}
            />
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'var(--tertiary)',
                display: 'inline-block',
                animation: 'bounceDotAmber 1.2s infinite ease-in-out',
                animationDelay: '0.4s'
              }}
            />
          </span>
        </div>

        {submessage && (
          <div style={{ fontSize: '12px', color: 'var(--muted-foreground)', marginBottom: '16px' }}>
            {submessage}
          </div>
        )}

        {/* Chunky Pop Progress Bar */}
        <div
          style={{
            width: '100%',
            maxWidth: '240px',
            height: '14px',
            backgroundColor: 'var(--muted)',
            border: '2px solid var(--border-dark)',
            borderRadius: 'var(--radius-full)',
            overflow: 'hidden',
            boxShadow: '2px 2px 0px 0px var(--border-dark)',
            position: 'relative'
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${internalProgress}%`,
              backgroundColor: 'var(--quaternary)',
              borderRight: internalProgress > 0 && internalProgress < 100 ? '2px solid var(--border-dark)' : 'none',
              transition: 'width 0.12s ease-out'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default LoadingPage;
