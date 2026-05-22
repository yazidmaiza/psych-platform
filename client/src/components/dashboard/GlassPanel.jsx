import React from 'react';

export default function GlassPanel({ children, className = '', ...props }) {
  return (
    <div
      className={[
        'ui-glass ui-card ui-card-hover',
        className
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  );
}

