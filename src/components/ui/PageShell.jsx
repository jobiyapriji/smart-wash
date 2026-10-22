import React from 'react';
import { Confetti } from './Confetti.jsx';

/**
 * Playful Geometric PageShell
 * Wraps screens in the warm cream dot-grid background with ambient confetti.
 */
export function PageShell({
  children,
  maxWidth = '1120px',
  showConfetti = true,
  className = '',
  style = {}
}) {
  return (
    <div
      className={`bg-dot-grid ${className}`}
      style={{
        minHeight: '100vh',
        width: '100%',
        backgroundColor: 'var(--background)',
        color: 'var(--foreground)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '24px 16px 48px',
        boxSizing: 'border-box',
        overflowX: 'hidden',
        ...style
      }}
    >
      {showConfetti && <Confetti />}

      <div
        style={{
          width: '100%',
          maxWidth,
          position: 'relative',
          zIndex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center'
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default PageShell;
