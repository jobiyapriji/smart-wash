import React from 'react';

/**
 * Playful Geometric Confetti Background Shapes
 * Adds decorative primitive shapes (circles, triangles, squiggles, pills)
 * that give the "Wild Decoration" Memphis flavor. Hidden on mobile.
 */
export function Confetti({ className = '' }) {
  return (
    <div
      className={`confetti-layer hide-on-mobile ${className}`}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0
      }}
    >
      {/* 1. Big Yellow Sun / Circle (Top Left) */}
      <div
        style={{
          position: 'absolute',
          top: '-30px',
          left: '4%',
          width: '90px',
          height: '90px',
          borderRadius: '50%',
          backgroundColor: 'var(--tertiary)',
          border: '3px solid var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          opacity: 0.9
        }}
      />

      {/* 2. Hot Pink Pill (Top Right) */}
      <div
        style={{
          position: 'absolute',
          top: '40px',
          right: '5%',
          width: '70px',
          height: '32px',
          borderRadius: 'var(--radius-full)',
          backgroundColor: 'var(--secondary)',
          border: '3px solid var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          transform: 'rotate(-18deg)',
          opacity: 0.85
        }}
      />

      {/* 3. Mint / Emerald Square (Bottom Left) */}
      <div
        style={{
          position: 'absolute',
          bottom: '12%',
          left: '3%',
          width: '45px',
          height: '45px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--quaternary)',
          border: '3px solid var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          transform: 'rotate(15deg)',
          opacity: 0.9
        }}
      />

      {/* 4. Violet Star / Cross (Mid Right) */}
      <div
        style={{
          position: 'absolute',
          top: '45%',
          right: '3%',
          width: '36px',
          height: '36px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--accent)',
          fontSize: '34px',
          fontWeight: 900,
          textShadow: '2px 2px 0px var(--border-dark)'
        }}
      >
        ✦
      </div>

      {/* 5. Small Yellow Diamond (Bottom Right) */}
      <div
        style={{
          position: 'absolute',
          bottom: '8%',
          right: '7%',
          width: '32px',
          height: '32px',
          backgroundColor: 'var(--tertiary)',
          border: '2px solid var(--border-dark)',
          boxShadow: '3px 3px 0px var(--border-dark)',
          transform: 'rotate(45deg)'
        }}
      />

      {/* 6. Blue / Cyan Floating Ring (Mid Left) */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '6%',
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: '4px solid #38BDF8',
          boxShadow: '2px 2px 0px var(--border-dark)'
        }}
      />
    </div>
  );
}

export default Confetti;
