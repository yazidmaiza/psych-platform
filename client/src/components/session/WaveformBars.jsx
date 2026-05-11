import React, { useMemo } from 'react';

const mulberry32 = (a) => () => {
  let t = (a += 0x6D2B79F5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

// Lightweight, “premium-feeling” waveform visualization:
// - deterministic pseudo-random bars per message id
// - progress overlay synced to audio currentTime
export default function WaveformBars({ seed = '0', bars = 36, progress = 0 }) {
  const heights = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < String(seed).length; i += 1) hash = (hash * 31 + String(seed).charCodeAt(i)) >>> 0;
    const rnd = mulberry32(hash || 1);
    const arr = Array.from({ length: bars }, () => 0.2 + rnd() * 0.8);
    // Smooth the ends slightly
    return arr.map((v, idx) => {
      const t = idx / (bars - 1);
      const window = 0.6 + 0.4 * Math.sin(Math.PI * t);
      return Math.max(0.18, Math.min(1, v * window));
    });
  }, [bars, seed]);

  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  const activeCount = Math.floor(clamped * bars);

  return (
    <div className="flex items-end gap-[2px] h-8">
      {heights.map((h, idx) => {
        const active = idx <= activeCount;
        return (
          <span
            key={idx}
            className={`w-[3px] rounded-full transition-colors duration-200 ${
              active ? 'bg-indigo-300/80' : 'bg-white/20'
            }`}
            style={{ height: `${Math.round(h * 100)}%` }}
          />
        );
      })}
    </div>
  );
}

