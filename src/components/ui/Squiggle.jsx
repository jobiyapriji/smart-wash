import React from 'react';

/**
 * Playful Geometric Squiggle SVG Divider & Underline
 */
export function Squiggle({
  color = 'var(--secondary)', // violet, pink, amber, mint
  width = '120px',
  height = '14px',
  strokeWidth = 3.5,
  className = '',
  style = {}
}) {
  return (
    <div
      className={`squiggle-divider ${className}`}
      style={{
        display: 'inline-block',
        width,
        height,
        ...style
      }}
    >
      <svg
        viewBox="0 0 120 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: '100%', height: '100%', display: 'block' }}
      >
        <path
          d="M 2 7 Q 17 0, 32 7 T 62 7 T 92 7 T 118 7"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function SquiggleDivider({
  color = 'var(--border-dark)',
  height = 20,
  className = '',
  style = {}
}) {
  return (
    <div
      className={`squiggle-section-divider ${className}`}
      style={{
        width: '100%',
        height: `${height}px`,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        margin: '24px 0',
        ...style
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 800 20"
        preserveAspectRatio="none"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M 0 10 Q 25 0, 50 10 T 100 10 T 150 10 T 200 10 T 250 10 T 300 10 T 350 10 T 400 10 T 450 10 T 500 10 T 550 10 T 600 10 T 650 10 T 700 10 T 750 10 T 800 10"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default Squiggle;
