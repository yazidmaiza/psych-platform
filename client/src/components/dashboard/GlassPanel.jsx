import React from 'react';

export default function GlassPanel({ children, className = '' }) {
  return (
    <div
      className={[
        'rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] backdrop-blur-xl shadow-sm',
        className
      ].join(' ')}
    >
      {children}
    </div>
  );
}

