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
      ? 'bg-amber-500/15 border-amber-400/20 text-amber-50'
      : isMe
        ? 'bg-indigo-500/20 border-indigo-400/20 text-white'
        : 'bg-white/10 border-white/10 text-white/90';

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl border px-4 py-3 shadow-sm ${bubbleTone}`}>
        <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
        {timestamp && (
          <div className={`mt-1 text-[11px] ${isMe ? 'text-white/60' : 'text-white/50'}`}>
            {formatTime(timestamp)}
          </div>
        )}
      </div>
    </div>
  );
}

