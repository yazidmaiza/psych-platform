import React from 'react';

export default function GlassPanel({ children, className = '' }) {
  return (
    <div
      className={[
        'ui-glass ui-card ui-card-hover',
        className
      ].join(' ')}
    >
      {children}
    </div>
  );
}

