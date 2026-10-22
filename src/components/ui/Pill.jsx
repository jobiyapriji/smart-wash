import React from 'react';

export function Pill({
  children,
  color = 'violet', // 'violet' | 'pink' | 'amber' | 'mint' | 'muted' | 'white'
  size = 'md', // 'sm' | 'md'
  icon = null,
  className = '',
  style = {},
  ...props
}) {
  const getColorStyles = () => {
    switch (color) {
      case 'pink':
        return { bg: 'var(--secondary)', text: '#1E293B', border: 'var(--border-dark)' };
      case 'amber':
        return { bg: 'var(--tertiary)', text: '#1E293B', border: 'var(--border-dark)' };
      case 'mint':
        return { bg: 'var(--quaternary)', text: '#1E293B', border: 'var(--border-dark)' };
      case 'muted':
        return { bg: 'var(--muted)', text: 'var(--foreground)', border: 'var(--border-dark)' };
      case 'white':
        return { bg: '#FFFFFF', text: 'var(--foreground)', border: 'var(--border-dark)' };
      case 'violet':
      default:
        return { bg: 'var(--accent)', text: '#FFFFFF', border: 'var(--border-dark)' };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { padding: '4px 10px', fontSize: '11px', shadow: '2px 2px 0px #1E293B' };
      case 'md':
      default:
        return { padding: '6px 14px', fontSize: '13px', shadow: '3px 3px 0px #1E293B' };
    }
  };

  const c = getColorStyles();
  const s = getSizeStyles();

  return (
    <span
      className={`playful-pill ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'var(--font-heading)',
        fontWeight: 800,
        letterSpacing: '0.04em',
        borderRadius: 'var(--radius-full)',
        backgroundColor: c.bg,
        color: c.text,
        border: `2px solid ${c.border}`,
        boxShadow: s.shadow,
        boxSizing: 'border-box',
        ...s,
        ...style
      }}
      {...props}
    >
      {icon && <span style={{ display: 'inline-flex', alignItems: 'center' }}>{icon}</span>}
      <span>{children}</span>
    </span>
  );
}

export default Pill;
