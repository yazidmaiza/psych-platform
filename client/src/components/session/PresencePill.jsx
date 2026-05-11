import React from 'react';

export default function PresencePill({ online, labelOnline = 'Online', labelOffline = 'Offline' }) {
  const tone = online
    ? 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100'
    : 'border-white/10 bg-white/5 text-white/60';
  const dot = online ? 'bg-emerald-400' : 'bg-white/30';

  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px] font-semibold ${tone}`}>
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {online ? labelOnline : labelOffline}
    </span>
  );
}

