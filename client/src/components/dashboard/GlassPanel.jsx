import React from 'react';

export default function GlassPanel({ children, className = '' }) {
  return (
    <div
      className={[
        'rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-sm',
        className
      ].join(' ')}
    >
      {children}
    </div>
  );
}

