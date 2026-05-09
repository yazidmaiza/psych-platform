import React, { useEffect, useMemo, useState } from 'react';
import { api, toAbsoluteUrl } from '../../services/api';

const getVoicesSafe = () => {
  try {
    return window.speechSynthesis?.getVoices?.() || [];
  } catch {
    return [];
  }
};

export default function TtsPlayer({ text }) {
  const [supported, setSupported] = useState(Boolean(window.speechSynthesis));
  const [voices, setVoices] = useState([]);
  const [voiceURI, setVoiceURI] = useState('');
  const [rate, setRate] = useState(0.95);
  const [speaking, setSpeaking] = useState(false);
  const [langMode, setLangMode] = useState('auto'); // auto | en | ar
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudLoading, setCloudLoading] = useState(false);
  const [cloudError, setCloudError] = useState('');
  const [cloudPlaying, setCloudPlaying] = useState(false);

  useEffect(() => {
    if (!window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const sync = () => setVoices(getVoicesSafe());
    sync();
    window.speechSynthesis.onvoiceschanged = sync;
    return () => {
      try { window.speechSynthesis.onvoiceschanged = null; } catch {}
    };
  }, []);

  const filteredVoices = useMemo(() => {
    if (langMode === 'auto') return voices;
    const prefix = langMode === 'ar' ? 'ar' : 'en';
    const v = voices.filter((x) => String(x.lang || '').toLowerCase().startsWith(prefix));
    return v.length ? v : voices;
  }, [langMode, voices]);

  const bestVoiceForLang = useMemo(() => {
    const wantPrefix = langMode === 'ar' ? 'ar' : langMode === 'en' ? 'en' : '';
    if (!wantPrefix) return null;
    const exact = voices.find((v) => String(v.lang || '').toLowerCase().startsWith(wantPrefix));
    return exact || null;
  }, [langMode, voices]);

  const selectedVoice = useMemo(() => {
    if (voiceURI) return filteredVoices.find((v) => v.voiceURI === voiceURI) || null;
    // If user selected a language but didn't pick a specific voice, prefer the best match for that language.
    if (langMode !== 'auto' && bestVoiceForLang) return bestVoiceForLang;
    return null;
  }, [voiceURI, filteredVoices, langMode, bestVoiceForLang]);

  const stop = () => {
    try {
      window.speechSynthesis.cancel();
    } catch {}
    setSpeaking(false);
    try {
      if (window.__ttsCloudAudio) {
        window.__ttsCloudAudio.pause();
        window.__ttsCloudAudio.currentTime = 0;
      }
    } catch {}
    setCloudPlaying(false);
  };

  const speak = () => {
    if (!supported) return;
    const value = String(text || '').trim();
    if (!value) return;
    stop();
    const u = new SpeechSynthesisUtterance(value);
    u.rate = rate;
    if (langMode === 'ar') u.lang = 'ar-SA';
    if (langMode === 'en') u.lang = 'en-US';
    if (selectedVoice) u.voice = selectedVoice;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  };

  const speakCloud = async () => {
    const value = String(text || '').trim();
    if (!value) return;
    stop();
    setCloudLoading(true);
    setCloudError('');
    setCloudUrl('');
    try {
      const payload = {
        text: value,
        language: langMode,
        style: 'neutral',
        speed: rate
      };
      const data = await api.post('/api/tts/speak', payload);
      const url = toAbsoluteUrl(data?.url);
      setCloudUrl(url);
      const audio = new Audio(url);
      window.__ttsCloudAudio = audio;
      audio.onended = () => setCloudPlaying(false);
      audio.onerror = () => setCloudPlaying(false);
      await audio.play();
      setCloudPlaying(true);
    } catch (e) {
      setCloudError(e.message || 'Cloud TTS failed');
    } finally {
      setCloudLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={speaking ? stop : (langMode !== 'auto' && !bestVoiceForLang ? speakCloud : speak)}
        className={`h-9 rounded-2xl border border-white/10 px-3 text-xs font-semibold transition ${
          (speaking || cloudPlaying) ? 'bg-indigo-500/25 text-indigo-50' : 'bg-white/5 text-white/80 hover:bg-white/10'
        }`}
        aria-label={speaking ? 'Stop listening' : 'Listen to message'}
      >
        {(speaking || cloudPlaying) ? 'Stop' : (cloudLoading ? 'Loading…' : 'Listen')}
      </button>
      <select
        value={langMode}
        onChange={(e) => {
          setLangMode(e.target.value);
          setVoiceURI('');
        }}
        className="h-9 rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-xs text-white/80"
        aria-label="Reading language"
        title="Language"
      >
        <option value="auto">Auto</option>
        <option value="en">English</option>
        <option value="ar">Arabic</option>
      </select>
      <select
        value={String(rate)}
        onChange={(e) => setRate(Number(e.target.value) || 1)}
        className="h-9 rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-xs text-white/80"
        aria-label="Speech rate"
        title="Speed"
      >
        <option value="0.85">0.85x</option>
        <option value="0.95">0.95x</option>
        <option value="1">1.0x</option>
        <option value="1.1">1.1x</option>
      </select>
      {filteredVoices.length > 0 && (
        <select
          value={voiceURI}
          onChange={(e) => setVoiceURI(e.target.value)}
          className="h-9 max-w-[220px] rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-xs text-white/80"
          aria-label="Voice style"
          title="Voice"
        >
          <option value="">Default voice</option>
          {filteredVoices.slice(0, 20).map((v) => (
            <option key={v.voiceURI} value={v.voiceURI}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
      )}

      {langMode !== 'auto' && !bestVoiceForLang && (
        <span className="text-[11px] text-white/50">
          No {langMode === 'ar' ? 'Arabic' : 'English'} voice installed on this device — using cloud voice.
        </span>
      )}
      {cloudError && <span className="text-[11px] text-rose-200/80">{cloudError}</span>}
    </div>
  );
}
