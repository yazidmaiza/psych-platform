import React, { useEffect, useMemo, useRef, useState } from 'react';
import MessageBubble from './MessageBubble';
import TypingIndicator from './TypingIndicator';

const EmptyState = ({ title, description, actionLabel, onAction }) => (
  <div className="grid place-items-center rounded-3xl border border-white/10 bg-white/5 px-6 py-16 text-center">
    <div className="max-w-md">
      <h3 className="text-base font-semibold text-white">{title}</h3>
      {description && <p className="mt-2 text-sm text-white/70">{description}</p>}
      {actionLabel && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 rounded-xl bg-indigo-500/90 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  </div>
);

export default function ChatBox({
  title,
  subtitle,
  messages,
  meId,
  disabled,
  disabledReason,
  placeholder = 'Write a message...',
  sendLabel = 'Send',
  typing,
  typingLabel,
  onSend,
  onRequestEnable,
  showVoiceOptions,
  isRecording,
  onRecordToggle,
  isMuted,
  onMuteToggle
}) {
  const [draft, setDraft] = useState('');
  const scrollerRef = useRef(null);

  const normalized = useMemo(() => (Array.isArray(messages) ? messages : []), [messages]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [normalized.length, typing]);

  const canSend = !disabled && draft.trim().length > 0;

  const submit = () => {
    const text = draft.trim();
    if (!text || disabled) return;
    setDraft('');
    onSend?.(text);
  };

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">{title}</div>
            {subtitle && <div className="mt-1 truncate text-xs text-white/60">{subtitle}</div>}
          </div>
          {disabled && disabledReason && (
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-white/70">
              {disabledReason}
            </span>
          )}
        </div>
      </div>

      <div
        ref={scrollerRef}
        className="flex-1 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-inner backdrop-blur overflow-y-auto"
      >
        {normalized.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description={disabled ? 'This chat is currently unavailable.' : 'Start the conversation when you are ready.'}
            actionLabel={disabled && onRequestEnable ? 'Learn more' : undefined}
            onAction={onRequestEnable}
          />
        ) : (
          <div className="flex flex-col gap-3">
            {normalized.map((m, idx) => {
              const id = m._id || m.id || idx;
              const isMe = String(m.senderId || m.sender || '') === String(meId) || m.role === 'user';
              const content = m.content;
              return (
                <MessageBubble
                  key={id}
                  isMe={isMe}
                  content={content}
                  timestamp={m.createdAt}
                />
              );
            })}
            {typing && (
              <div className="flex justify-start">
                <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3">
                  <TypingIndicator label={typingLabel} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-3 backdrop-blur">
        <div className="flex items-end gap-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            rows={2}
            placeholder={placeholder}
            disabled={disabled}
            className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-50"
          />
          {showVoiceOptions && !disabled && (
            <>
              <button
                type="button"
                onClick={onRecordToggle}
                className={`flex h-[44px] items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
                  isRecording 
                    ? 'bg-rose-500 text-white animate-pulse shadow-lg shadow-rose-500/20' 
                    : 'bg-white/5 text-white/80 hover:bg-white/10'
                }`}
                title={isRecording ? "Stop recording (max 5s)" : "Record voice message"}
              >
                {isRecording ? 'Stop' : 'Record'}
              </button>
              <button
                type="button"
                onClick={onMuteToggle}
                className={`flex h-[44px] items-center justify-center rounded-2xl px-4 text-sm font-semibold transition ${
                  isMuted 
                    ? 'bg-white/5 text-white/50 hover:bg-white/10' 
                    : 'bg-indigo-500/20 text-indigo-200 hover:bg-indigo-500/30'
                }`}
                title={isMuted ? "Unmute text-to-speech" : "Mute text-to-speech"}
              >
                {isMuted ? 'Muted' : 'Sound'}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="h-[44px] rounded-2xl bg-indigo-500/90 px-5 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition disabled:opacity-40"
          >
            {sendLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

