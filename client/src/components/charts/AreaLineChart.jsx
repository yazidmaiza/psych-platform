import React, { useMemo } from 'react';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

export default function AreaLineChart({ data, height = 180 }) {
  const normalized = useMemo(() => {
    const safe = Array.isArray(data) ? data : [];
    const maxValue = safe.reduce((m, d) => Math.max(m, Number(d?.count || 0)), 0) || 1;
    return { safe, maxValue };
  }, [data]);

  const width = 520;
  const paddingX = 18;
  const paddingY = 16;

  const points = useMemo(() => {
    const items = normalized.safe;
    if (items.length === 0) return [];
    const innerW = width - paddingX * 2;
    const innerH = height - paddingY * 2;
    return items.map((d, i) => {
      const x = paddingX + (items.length === 1 ? innerW / 2 : (innerW * i) / (items.length - 1));
      const v = clamp(Number(d?.count || 0), 0, normalized.maxValue);
      const y = paddingY + innerH - (innerH * v) / normalized.maxValue;
      return { x, y, v, label: String(d?.date || '') };
    });
  }, [height, normalized.maxValue, normalized.safe]);

  const path = useMemo(() => {
    if (points.length === 0) return '';
    return points.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  }, [points]);

  const area = useMemo(() => {
    if (points.length === 0) return '';
    const last = points[points.length - 1];
    const first = points[0];
    const baseY = height - paddingY;
    return `${path} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  }, [height, path, points]);

  const xLabels = useMemo(() => {
    const items = points;
    if (items.length <= 2) return items.map((p) => ({ x: p.x, text: p.label.slice(5) }));
    const idxs = [0, Math.floor((items.length - 1) / 2), items.length - 1];
    return idxs.map((i) => ({ x: items[i].x, text: items[i].label.slice(5) }));
  }, [points]);

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Sessions over time"
        className="h-auto w-full"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(99,102,241,0.35)" />
            <stop offset="100%" stopColor="rgba(99,102,241,0.02)" />
          </linearGradient>
          <linearGradient id="chartStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(99,102,241,0.95)" />
            <stop offset="100%" stopColor="rgba(217,70,239,0.85)" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width={width} height={height} rx="18" fill="rgba(255,255,255,0.02)" />

        {/* grid */}
        {[0.25, 0.5, 0.75].map((t) => {
          const y = paddingY + (height - paddingY * 2) * t;
          return <line key={t} x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(255,255,255,0.06)" />;
        })}

        {area && <path d={area} fill="url(#chartFill)" />}
        {path && <path d={path} fill="none" stroke="url(#chartStroke)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}

        {/* points */}
        {points.map((p) => (
          <g key={p.label}>
            <circle cx={p.x} cy={p.y} r="4.2" fill="rgba(15,23,42,0.9)" stroke="rgba(99,102,241,0.9)" strokeWidth="2" />
          </g>
        ))}

        {/* x-axis labels */}
        {xLabels.map((l) => (
          <text
            key={l.x}
            x={l.x}
            y={height - 6}
            textAnchor="middle"
            fontSize="11"
            fill="rgba(255,255,255,0.55)"
          >
            {l.text}
          </text>
        ))}
      </svg>
    </div>
  );
}

