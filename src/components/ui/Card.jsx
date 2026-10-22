import React from 'react';

/**
 * Playful Geometric "Sticker" Card
 * - White background, 2px dark border, rounded-xl/2xl
 * - Hard pop shadow (soft #E2E8F0, or pop color)
 * - Optional colored header strip (violet, pink, amber, mint)
 * - Optional floating icon badge half-in/half-out over top border
 * - Optional interactive wiggle on hover (for teacher dashboard)
 */
export function Card({
  children,
  headerStripColor = null, // 'violet' | 'pink' | 'amber' | 'mint' | string
  badge = null, // React node (IconBadge or custom)
  interactive = false, // Wiggle on hover
  shadowColor = 'soft', // 'soft' | 'dark' | 'pink' | 'amber' | 'mint' | 'violet'
  className = '',
  style = {},
  onClick,
  ...props
}) {
  const getShadow = () => {
    switch (shadowColor) {
      case 'dark':
        return 'var(--shadow-pop)';
      case 'pink':
        return 'var(--shadow-card-pink)';
      case 'amber':
        return 'var(--shadow-card-amber)';
      case 'mint':
        return 'var(--shadow-card-mint)';
      case 'violet':
        return 'var(--shadow-card-violet)';
      case 'soft':
      default:
        return 'var(--shadow-card-soft)';
    }
  };

  const getStripBg = (color) => {
    switch (color) {
      case 'violet': return 'var(--accent)';
      case 'pink': return 'var(--secondary)';
      case 'amber': return 'var(--tertiary)';
      case 'mint': return 'var(--quaternary)';
      default: return color;
    }
  };

  return (
    <div
      onClick={onClick}
      className={`sticker-card ${interactive ? 'sticker-card-interactive' : ''} ${className}`}
      style={{
        backgroundColor: 'var(--card)',
        border: '2px solid var(--border-dark)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: getShadow(),
        position: 'relative',
        transition: 'var(--transition-bounce)',
        cursor: onClick ? 'pointer' : 'default',
        boxSizing: 'border-box',
        ...style
      }}
      {...props}
    >
      {/* Optional Top Header Strip */}
      {headerStripColor && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '8px',
            backgroundColor: getStripBg(headerStripColor),
            borderTopLeftRadius: 'calc(var(--radius-lg) - 2px)',
            borderTopRightRadius: 'calc(var(--radius-lg) - 2px)'
          }}
        />
      )}

      {/* Floating Badge (Half-in/half-out over the top border) */}
      {badge && (
        <div
          style={{
            position: 'absolute',
            top: '-24px',
            left: '24px',
            zIndex: 10
          }}
        >
          {badge}
        </div>
      )}

      {children}
    </div>
  );
}

export default Card;
