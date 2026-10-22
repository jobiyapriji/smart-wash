import React from 'react';

/**
 * Playful Geometric StepDots (6 WHO Steps)
 * Shows 6 step dots with tactile sticker styling.
 */
export function StepDots({
  totalSteps = 6,
  currentStep = 1,
  completedSteps = [],
  className = '',
  style = {}
}) {
  const getStepColor = (idx) => {
    // Rotation: 1 violet, 2 pink, 3 amber, 4 mint, 5 violet, 6 pink
    const colors = ['var(--accent)', 'var(--secondary)', 'var(--tertiary)', 'var(--quaternary)', 'var(--accent)', 'var(--secondary)'];
    return colors[(idx - 1) % colors.length];
  };

  return (
    <div
      className={`step-dots ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 16px',
        backgroundColor: '#FFFFFF',
        border: '2px solid var(--border-dark)',
        borderRadius: 'var(--radius-full)',
        boxShadow: 'var(--shadow-pop)',
        ...style
      }}
    >
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((stepNum) => {
        const isDone = completedSteps.includes(stepNum);
        const isCurrent = stepNum === currentStep;
        const color = getStepColor(stepNum);

        return (
          <div
            key={stepNum}
            style={{
              width: isCurrent ? '34px' : '26px',
              height: isCurrent ? '34px' : '26px',
              borderRadius: '50%',
              backgroundColor: isDone ? 'var(--quaternary)' : isCurrent ? color : 'var(--muted)',
              border: '2px solid var(--border-dark)',
              color: isDone ? '#1E293B' : isCurrent ? (stepNum === 1 || stepNum === 5 ? '#FFFFFF' : '#1E293B') : 'var(--muted-foreground)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-heading)',
              fontWeight: 800,
              fontSize: isCurrent ? '14px' : '12px',
              boxShadow: isCurrent ? '2px 2px 0px #1E293B' : 'none',
              transform: isCurrent ? 'scale(1.15)' : 'scale(1)',
              transition: 'var(--transition-bounce)'
            }}
          >
            {isDone ? '✓' : stepNum}
          </div>
        );
      })}
    </div>
  );
}

export default StepDots;
