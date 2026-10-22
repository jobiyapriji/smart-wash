import React from 'react';

export function Label({ children, className = '', style = {}, ...props }) {
  return (
    <label
      className={`playful-label ${className}`}
      style={{
        fontFamily: 'var(--font-heading)',
        fontSize: '12px',
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: 'var(--foreground)',
        display: 'block',
        marginBottom: '6px',
        ...style
      }}
      {...props}
    >
      {children}
    </label>
  );
}

export function Input({
  label,
  error,
  icon,
  className = '',
  style = {},
  ...props
}) {
  return (
    <div style={{ width: '100%', marginBottom: '16px' }}>
      {label && <Label>{label}</Label>}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              left: '14px',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
              color: 'var(--muted-foreground)'
            }}
          >
            {icon}
          </span>
        )}
        <input
          className={`playful-input ${className}`}
          style={{
            paddingLeft: icon ? '42px' : '16px',
            borderColor: error ? '#EF4444' : undefined,
            ...style
          }}
          {...props}
        />
      </div>
      {error && (
        <span
          style={{
            color: '#DC2626',
            fontSize: '12px',
            fontWeight: 600,
            marginTop: '4px',
            display: 'block'
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

export function Select({
  label,
  error,
  options = [],
  children,
  className = '',
  style = {},
  ...props
}) {
  return (
    <div style={{ width: '100%', marginBottom: '16px' }}>
      {label && <Label>{label}</Label>}
      <select
        className={`playful-input ${className}`}
        style={{
          borderColor: error ? '#EF4444' : undefined,
          cursor: 'pointer',
          appearance: 'auto',
          ...style
        }}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        {children}
      </select>
      {error && (
        <span
          style={{
            color: '#DC2626',
            fontSize: '12px',
            fontWeight: 600,
            marginTop: '4px',
            display: 'block'
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

export default Input;
