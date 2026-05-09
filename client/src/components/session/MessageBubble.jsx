import React from 'react';
import VoiceNotePlayer from './VoiceNotePlayer';
import TtsPlayer from './TtsPlayer';
import { api } from '../../services/api';

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
  tone = 'default',
  kind = 'text',
  voice = null,
  isRead = false
}) {
  const [localTranscription, setLocalTranscription] = React.useState(voice?.transcription || null);
  const [retrying, setRetrying] = React.useState(false);

  React.useEffect(() => {
    setLocalTranscription(voice?.transcription || null);
  }, [voice?.transcription]);
  const bubbleTone =
    tone === 'warning'
      ? 'bg-amber-500/15 border-amber-400/20 text-[color:var(--app-fg)]'
      : isMe
        ? 'bg-[color:var(--accent-15)] border-[color:var(--accent-25)] text-[color:var(--app-fg)]'
        : 'bg-[color:var(--panel-bg)] border-[color:var(--panel-border)] text-[color:var(--app-fg)]';

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[85%] sm:max-w-[70%] rounded-2xl border px-4 py-3 shadow-sm ${bubbleTone}`}>
        {kind === 'voice' && voice?.url ? (
          <div>
            <div className="text-xs font-semibold text-[color:var(--muted)]">Voice message</div>
            <VoiceNotePlayer
              messageId={String(voice?.url || '').match(/\/api\/messages\/([^/]+)\/voice/)?.[1] || ''}
              voice={voice}
            />

            {/* Transcription */}
            {localTranscription?.status === 'pending' && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
                Transcribing…
              </div>
            )}
            {localTranscription?.status === 'ready' && localTranscription?.text && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                <div className="text-[11px] font-semibold text-white/60">Transcription</div>
                <div className="mt-1 text-xs text-white/80 whitespace-pre-wrap">{localTranscription.text}</div>
              </div>
            )}
            {localTranscription?.status === 'error' && (
              <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-50">
                <div className="font-semibold">Transcription failed</div>
                <div className="mt-1 opacity-80">{localTranscription?.error || 'Unknown error'}</div>
                <button
                  type="button"
                  disabled={retrying}
                  onClick={async () => {
                    const messageId = String(voice?.url || '').match(/\/api\/messages\/([^/]+)\/voice/)?.[1] || '';
                    if (!messageId) return;
                    setRetrying(true);
                    setLocalTranscription({ status: 'pending', text: '', error: '' });
                    try {
                      const data = await api.post(`/api/messages/${messageId}/voice-transcribe`, {});
                      if (data?.status === 'ready') setLocalTranscription({ status: 'ready', text: data.text || '', error: '' });
                      else setLocalTranscription({ status: 'error', text: '', error: data?.error || 'Transcription failed' });
                    } catch (e) {
                      setLocalTranscription({ status: 'error', text: '', error: e.message || 'Transcription failed' });
                    } finally {
                      setRetrying(false);
                    }
                  }}
                  className="mt-2 h-9 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 text-xs font-semibold text-rose-50 hover:bg-rose-500/15 disabled:opacity-60"
                >
                  {retrying ? 'Retrying…' : 'Retry'}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{content}</p>
            <div className="mt-2">
              <TtsPlayer text={content} />
            </div>
          </div>
        )}
        {timestamp && (
          <div className="mt-1 text-[11px] text-[color:var(--muted)]">
            {formatTime(timestamp)}{isMe ? (
              <span className="ml-2 text-white/50">{isRead ? '✓✓' : '✓'}</span>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

