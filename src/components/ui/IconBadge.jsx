import React from 'react';

/**
 * Playful Geometric IconBadge
 * Icons are never alone: always inside a colored circle or rounded square,
 * with 2px dark border and a hard pop shadow.
 */
export function IconBadge({
  icon: IconComponent,
  children,
  color = 'violet', // 'violet' | 'pink' | 'amber' | 'mint' | 'cream' | 'dark'
  shape = 'circle', // 'circle' | 'square' | 'blob'
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  className = '',
  style = {}
}) {
  const getColorStyles = () => {
    switch (color) {
      case 'pink':
        return { bg: 'var(--secondary)', text: '#1E293B' };
      case 'amber':
        return { bg: 'var(--tertiary)', text: '#1E293B' };
      case 'mint':
        return { bg: 'var(--quaternary)', text: '#1E293B' };
      case 'cream':
        return { bg: 'var(--background)', text: '#1E293B' };
      case 'dark':
        return { bg: 'var(--border-dark)', text: '#FFFFFF' };
      case 'violet':
      default:
        return { bg: 'var(--accent)', text: '#FFFFFF' };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { size: '32px', iconSize: 16, shadow: '2px 2px 0px #1E293B' };
      case 'lg':
        return { size: '56px', iconSize: 28, shadow: '4px 4px 0px #1E293B' };
      case 'xl':
        return { size: '72px', iconSize: 36, shadow: '6px 6px 0px #1E293B' };
      case 'md':
      default:
        return { size: '44px', iconSize: 22, shadow: '3px 3px 0px #1E293B' };
    }
  };

  const getBorderRadius = () => {
    switch (shape) {
      case 'square': return 'var(--radius-md, 16px)';
      case 'blob': return '24px 24px 24px 6px';
      case 'arch': return '9999px 9999px 0 0';
      case 'circle':
      default:
        return '50%';
    }
  };

  const c = getColorStyles();
  const s = getSizeStyles();

  const renderContent = () => {
    if (React.isValidElement(IconComponent)) {
      return IconComponent;
    }
    if (IconComponent) {
      const Comp = IconComponent;
      return <Comp size={s.iconSize} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />;
    }
    return children;
  };

  return (
    <div
      className={`icon-badge ${className}`}
      style={{
        width: s.size,
        height: s.size,
        borderRadius: getBorderRadius(),
        backgroundColor: c.bg,
        color: c.text,
        border: '2px solid var(--border-dark, #1E293B)',
        boxShadow: s.shadow,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxSizing: 'border-box',
        ...style
      }}
    >
      {renderContent()}
    </div>
  );
}

export default IconBadge;
