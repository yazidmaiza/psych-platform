import React from 'react';

export default function TypingIndicator({ label = 'Typing' }) {
  return (
    <div className="flex items-center gap-2 text-xs text-white/70">
      <span>{label}</span>
      <span className="inline-flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:-0.2s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce [animation-delay:-0.1s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-white/50 animate-bounce" />
      </span>
    </div>
  );
}

