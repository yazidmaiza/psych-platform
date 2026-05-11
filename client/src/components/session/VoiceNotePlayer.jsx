import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, toAbsoluteUrl } from '../../services/api';
import WaveformBars from './WaveformBars';

const formatDuration = (ms) => {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}:${String(r).padStart(2, '0')}` : `0:${String(r).padStart(2, '0')}`;
};

export default function VoiceNotePlayer({ messageId, voice }) {
  const audioRef = useRef(null);
  const [signedUrl, setSignedUrl] = useState('');
  const [status, setStatus] = useState('idle'); // idle | loading | ready | error
  const [err, setErr] = useState('');
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1.0);

  const durationLabel = useMemo(() => formatDuration(voice?.durationMs || 0), [voice?.durationMs]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const id = String(messageId || '');
      if (!id) return;
      setStatus('loading');
      setErr('');
      try {
        const data = await api.get(`/api/messages/${id}/voice-access-url`);
        const url = toAbsoluteUrl(data?.url);
        if (!mounted) return;
        setSignedUrl(url);
        setStatus('ready');
      } catch (e) {
        if (!mounted) return;
        setStatus('error');
        setErr(e.message || 'Failed to load audio');
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [messageId]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onTime = () => {
      const d = el.duration || 0;
      const t = el.currentTime || 0;
      if (!Number.isFinite(d) || d <= 0) return setProgress(0);
      setProgress(Math.max(0, Math.min(1, t / d)));
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    el.addEventListener('timeupdate', onTime);
    el.addEventListener('play', onPlay);
    el.addEventListener('pause', onPause);
    el.addEventListener('ended', onEnded);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('play', onPlay);
      el.removeEventListener('pause', onPause);
      el.removeEventListener('ended', onEnded);
    };
  }, []);

  const toggle = async () => {
    const el = audioRef.current;
    if (!el) return;
    try {
      if (el.paused) await el.play();
      else el.pause();
    } catch (e) {
      setErr('Playback failed. Tap download and try opening externally.');
    }
  };

  return (
    <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 p-3">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          disabled={status !== 'ready'}
          className={`h-10 w-10 rounded-2xl border border-white/10 transition ${
            status !== 'ready'
              ? 'bg-white/5 text-white/40'
              : playing
                ? 'bg-indigo-500/30 text-indigo-50'
                : 'bg-white/5 text-white/80 hover:bg-white/10'
          }`}
          aria-label={playing ? 'Pause voice message' : 'Play voice message'}
          title={playing ? 'Pause' : 'Play'}
        >
          {playing ? '❚❚' : '▶'}
        </button>

        <div className="min-w-0 flex-1">
          <WaveformBars seed={messageId} progress={progress} />
          <div className="mt-1 flex items-center justify-between text-[11px] text-white/50">
            <span>{durationLabel}</span>
            <span>{status === 'loading' ? 'Loading…' : status === 'error' ? 'Unavailable' : `${speed.toFixed(1)}x`}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={String(speed)}
            onChange={(e) => setSpeed(Number(e.target.value) || 1)}
            disabled={status !== 'ready'}
            className="h-10 rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-xs text-white/80"
            aria-label="Playback speed"
            title="Speed"
          >
            <option value="0.75">0.75x</option>
            <option value="1">1.0x</option>
            <option value="1.25">1.25x</option>
            <option value="1.5">1.5x</option>
          </select>
          <a
            href={signedUrl || '#'}
            download
            className={`h-10 rounded-2xl border border-white/10 px-3 text-xs font-semibold inline-flex items-center ${
              signedUrl ? 'bg-white/5 text-white/80 hover:bg-white/10' : 'bg-white/5 text-white/40 pointer-events-none'
            }`}
            title="Download"
          >
            Download
          </a>
        </div>
      </div>

      {err && <div className="mt-2 text-[11px] text-rose-200/80">{err}</div>}

      {signedUrl && (
        <audio ref={audioRef} preload="metadata">
          <source src={signedUrl} type={voice?.mimeType || 'audio/webm'} />
        </audio>
      )}
    </div>
  );
}

