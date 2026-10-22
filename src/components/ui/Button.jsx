import React from 'react';

/**
 * Playful Geometric "Candy" Button
 * - primary: violet, white bold text, pill, 2px dark border, hard pop shadow, press effect
 * - secondary: transparent, dark border, fills amber on hover
 * - accent / fun variants: pink, mint, amber
 */
export function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'pink' | 'mint' | 'amber' | 'ghost'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon = null,
  className = '',
  style = {},
  disabled = false,
  onClick,
  type = 'button',
  ...props
}) {
  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return {
          backgroundColor: 'transparent',
          color: 'var(--foreground)',
          borderColor: 'var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          hoverBg: 'var(--tertiary)'
        };
      case 'pink':
        return {
          backgroundColor: 'var(--secondary)',
          color: 'var(--foreground)',
          borderColor: 'var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          hoverBg: '#f43f5e'
        };
      case 'amber':
        return {
          backgroundColor: 'var(--tertiary)',
          color: 'var(--foreground)',
          borderColor: 'var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          hoverBg: '#f59e0b'
        };
      case 'mint':
        return {
          backgroundColor: 'var(--quaternary)',
          color: 'var(--foreground)',
          borderColor: 'var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          hoverBg: '#10b981'
        };
      case 'ghost':
        return {
          backgroundColor: 'transparent',
          color: 'var(--foreground)',
          borderColor: 'transparent',
          boxShadow: 'none',
          hoverBg: 'var(--muted)'
        };
      case 'primary':
      default:
        return {
          backgroundColor: 'var(--accent)',
          color: '#FFFFFF',
          borderColor: 'var(--border-dark)',
          boxShadow: 'var(--shadow-pop)',
          hoverBg: '#7c3aed'
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          minHeight: '38px',
          padding: '6px 16px',
          fontSize: '13px'
        };
      case 'lg':
        return {
          minHeight: '56px',
          padding: '16px 36px',
          fontSize: '18px'
        };
      case 'md':
      default:
        return {
          minHeight: '48px',
          padding: '12px 24px',
          fontSize: '15px'
        };
    }
  };

  const vStyles = getVariantStyles();
  const sStyles = getSizeStyles();

  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`btn-candy ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        fontFamily: 'var(--font-heading)',
        fontWeight: 700,
        borderRadius: 'var(--radius-full)',
        border: `2px solid ${vStyles.borderColor}`,
        backgroundColor: vStyles.backgroundColor,
        color: vStyles.color,
        boxShadow: disabled ? 'none' : vStyles.boxShadow,
        opacity: disabled ? 0.6 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'var(--transition-bounce)',
        textDecoration: 'none',
        boxSizing: 'border-box',
        ...sStyles,
        ...style
      }}
      onMouseEnter={(e) => {
        if (!disabled && variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(-2px, -2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-pop-hover)';
          if (variant === 'secondary') {
            e.currentTarget.style.backgroundColor = 'var(--tertiary)';
          }
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled && variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(0px, 0px)';
          e.currentTarget.style.boxShadow = vStyles.boxShadow;
          if (variant === 'secondary') {
            e.currentTarget.style.backgroundColor = 'transparent';
          }
        }
      }}
      onMouseDown={(e) => {
        if (!disabled && variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(2px, 2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-pop-active)';
        }
      }}
      onMouseUp={(e) => {
        if (!disabled && variant !== 'ghost') {
          e.currentTarget.style.transform = 'translate(-2px, -2px)';
          e.currentTarget.style.boxShadow = 'var(--shadow-pop-hover)';
        }
      }}
      {...props}
    >
      {icon && (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: variant === 'primary' ? '#FFFFFF' : 'var(--border-dark)',
            color: variant === 'primary' ? 'var(--accent)' : '#FFFFFF',
            fontSize: '14px',
            flexShrink: 0
          }}
        >
          {icon}
        </span>
      )}
      <span>{children}</span>
    </button>
  );
}

export default Button;
