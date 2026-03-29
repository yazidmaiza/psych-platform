import React, { useMemo } from 'react';

export default function StackedBar({ segments }) {
  const safe = useMemo(() => {
    const list = Array.isArray(segments) ? segments : [];
    const total = list.reduce((s, x) => s + Number(x?.value || 0), 0) || 1;
    return { list, total };
  }, [segments]);

  return (
    <div className="w-full">
      <div className="flex h-3 w-full overflow-hidden rounded-full border border-white/10 bg-white/5">
        {safe.list.map((seg) => {
          const w = (Number(seg?.value || 0) / safe.total) * 100;
          return (
            <div
              key={seg.label}
              className={seg.className || 'bg-indigo-500/80'}
              style={{ width: `${w}%` }}
              title={`${seg.label}: ${seg.value}`}
            />
          );
        })}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {safe.list.map((seg) => (
          <div key={seg.label} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
            <div className="flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${seg.className || 'bg-indigo-500/80'}`} />
              <span className="text-xs font-semibold text-white/80">{seg.label}</span>
            </div>
            <span className="text-xs text-white/60">{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

