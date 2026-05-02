import React from 'react';

const formatTime = (value) => {
  if (!value) return '';
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export default function MessageBubble({
  isMe,
  content,
  timestamp,
  tone = 'default'
}) {
  const bubbleTone =
    tone === 'warning'
      ? 'bg-amber-500/15 border-amber-400/20 text-[color:var(--app-fg)]'
      : isMe
        ? 'bg-[color:var(--accent-15)] border-[color:var(--accent-25)] text-[color:var(--app-fg)]'
        : 'bg-[color:var(--panel-bg)] border-[color:var(--panel-border)] text-[color:var(--app-fg)]';

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl border px-4 py-3 shadow-sm ${bubbleTone}`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        {timestamp && (
          <div className="mt-1 text-[11px] text-[color:var(--muted)]">
            {formatTime(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

