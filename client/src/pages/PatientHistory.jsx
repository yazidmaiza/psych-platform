import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';
import ConversationDrawer from '../components/conversation/ConversationDrawer';

const SESSION_TYPE_LABELS = {
  preparation: 'First consultation preparation',
  followup: 'Follow-up session',
  free: 'Free expression'
};

const emotionLabel = (emotion) => {
  if (emotion === 'anxiety') return 'Anxiety';
  if (emotion === 'sadness') return 'Sadness';
  if (emotion === 'anger') return 'Anger';
  if (emotion === 'positivity') return 'Positivity';
  return emotion;
};

const statusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50';
  if (s === 'completed') return 'border-sky-500/20 bg-sky-500/10 text-sky-50';
  if (s === 'canceled' || s === 'rejected') return 'border-rose-500/20 bg-rose-500/10 text-rose-50';
  return 'border-amber-500/20 bg-amber-500/10 text-amber-50';
};

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '';
  }
};

export default function PatientHistory() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [chatOpen, setChatOpen] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [emotions, setEmotions] = useState([]);
  const [patientMeta, setPatientMeta] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [onlyCompleted, setOnlyCompleted] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      setError('');
      try {
        const [patientList, sessionData, emotionData] = await Promise.all([
          api.get('/api/dashboard/patients'),
          api.get('/api/sessions/patient/' + patientId),
          api.get('/api/dashboard/emotions/' + patientId)
        ]);

        const list = Array.isArray(patientList) ? patientList : [];
        setPatientMeta(list.find((p) => String(p.patientId) === String(patientId)) || null);

        const sess = Array.isArray(sessionData) ? sessionData : [];
        setSessions(sess);

        setEmotions(Array.isArray(emotionData) ? emotionData : []);

        // Single summary per patient (endpoint does not provide session-specific summaries).
        const hasCompleted = sess.some((s) => String(s.status) === 'completed');
        if (hasCompleted) {
          try {
            const s = await api.get('/api/chatbot/summary?patientId=' + patientId);
            setSummary(s || null);
          } catch {
            setSummary(null);
          }
        } else {
          setSummary(null);
        }
      } catch (e) {
        setError(e.message || 'Failed to load patient history');
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [patientId]);

  const filteredSessions = useMemo(() => {
    const q = String(query || '').trim().toLowerCase();
    let list = sessions;
    if (onlyCompleted) list = list.filter((s) => String(s.status) === 'completed');
    if (!q) return list;
    return list.filter((s) => {
      const type = SESSION_TYPE_LABELS[s.sessionType] || s.sessionType || '';
      return `${type} ${s.status} ${fmtDate(s.createdAt)}`.toLowerCase().includes(q);
    });
  }, [onlyCompleted, query, sessions]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => String(s.status) === 'completed').length;
    const active = sessions.filter((s) => String(s.status) === 'active').length;
    return { total, completed, active };
  }, [sessions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
          <div className="absolute inset-0 bg-[var(--app-bg)]" />
        </div>
        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 text-sm text-white/60">
          Loading patient history…
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <button
                  onClick={() => navigate(-1)}
                  className="text-xs font-semibold text-white/70 hover:text-white"
                >
                  ← Back
                </button>
                <div className="mt-2 flex items-center gap-2">
                  <h1 className="truncate text-lg font-semibold tracking-tight">Patient history</h1>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/70">
                    {patientMeta?.email || patientId}
                  </span>
                </div>
                <div className="mt-1 text-xs text-white/50">
                  {stats.total} sessions · {stats.completed} completed · {stats.active} active
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => navigate(`/patient/${patientId}`)}
                  className="h-9 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-white/80 hover:bg-white/10"
                >
                  View details
                </button>
                <button
                  onClick={() => setChatOpen(true)}
                  className="h-9 rounded-2xl bg-indigo-500/25 px-4 text-xs font-semibold text-indigo-50 hover:bg-indigo-500/35"
                >
                  Open chat
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {error && (
            <GlassPanel className="p-5">
              <div className="text-sm font-semibold text-rose-200/90">Could not load history</div>
              <div className="mt-1 text-xs text-white/60">{error}</div>
            </GlassPanel>
          )}

          <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-5">
              <GlassPanel className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-white/80">Sessions</div>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search sessions…"
                        className="h-9 w-[220px] rounded-2xl border border-white/10 bg-white/5 px-4 text-xs text-white/80 outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/15"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setOnlyCompleted((v) => !v)}
                      className={[
                        'h-9 rounded-2xl border px-4 text-xs font-semibold transition',
                        onlyCompleted
                          ? 'border-indigo-400/30 bg-indigo-500/20 text-indigo-50'
                          : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'
                      ].join(' ')}
                      title="Show only completed sessions"
                    >
                      Completed only
                    </button>
                  </div>
                </div>

                <div className="mt-4 space-y-3">
                  {filteredSessions.length === 0 && (
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
                      No sessions match your filters.
                    </div>
                  )}

                  {filteredSessions.map((s) => (
                    <div
                      key={s._id}
                      className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/7"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white/85">
                            {SESSION_TYPE_LABELS[s.sessionType] || s.sessionType || 'Session'}
                          </div>
                          <div className="mt-1 text-xs text-white/55">{fmtDate(s.createdAt)}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusBadgeClass(s.status)}`}>
                            {String(s.status || 'unknown')}
                          </span>
                          <button
                            onClick={async () => {
                              const token = localStorage.getItem('token');
                              const res = await fetch(`http://localhost:5000/api/sessions/${s._id}/report/pdf`, {
                                headers: { Authorization: 'Bearer ' + token }
                              });
                              const blob = await res.blob();
                              const url = window.URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = `report-${s._id}.pdf`;
                              a.click();
                              window.URL.revokeObjectURL(url);
                            }}
                            disabled={String(s.status) !== 'completed'}
                            className="h-9 rounded-2xl border border-white/10 bg-white/5 px-4 text-xs font-semibold text-white/80 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                            title={String(s.status) === 'completed' ? 'Download report' : 'Report available after completion'}
                          >
                            PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            </div>

            <div className="space-y-5">
              {emotions.length > 0 && (
                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-white/80">Emotional indicators</div>
                  <div className="mt-4 space-y-3">
                    {Object.entries(emotions?.[0]?.scores || {}).map(([emotion, score]) => (
                      <div key={emotion}>
                        <div className="mb-1 flex items-center justify-between text-xs text-white/65">
                          <span className="font-semibold text-white/75">{emotionLabel(emotion)}</span>
                          <span>{score}%</span>
                        </div>
                        <div className="h-2.5 w-full rounded-full bg-white/10">
                          <div
                            className={[
                              'h-2.5 rounded-full transition-all',
                              emotion === 'anxiety'
                                ? 'bg-rose-400/80'
                                : emotion === 'sadness'
                                  ? 'bg-sky-400/80'
                                  : emotion === 'anger'
                                    ? 'bg-amber-400/80'
                                    : 'bg-emerald-400/80'
                            ].join(' ')}
                            style={{ width: `${Math.max(0, Math.min(100, Number(score) || 0))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              )}

              {summary && (
                <GlassPanel className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-white/80">AI summary</div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-white/60">
                      Latest
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                      <div className="text-[11px] font-semibold text-white/55">Emotion</div>
                      <div className="mt-1 text-xs font-semibold text-white/80 capitalize">
                        {summary.emotionalIndicators?.dominantEmotion || '—'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                      <div className="text-[11px] font-semibold text-white/55">Urgency</div>
                      <div className="mt-1 text-xs font-semibold text-white/80">
                        {summary.emotionalIndicators?.urgencyScore ? `${summary.emotionalIndicators.urgencyScore} / 5` : '—'}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
                      <div className="text-[11px] font-semibold text-white/55">Trend</div>
                      <div className="mt-1 text-xs font-semibold text-white/80 capitalize">
                        {summary.emotionalIndicators?.sentimentTrend || '—'}
                      </div>
                    </div>
                  </div>

                  {summary.keyThemes?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Key themes</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {summary.keyThemes.slice(0, 10).map((t, i) => (
                          <span key={i} className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-50/90">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {summary.rawSummary && (
                    <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Clinical summary</div>
                      <div className="mt-2 text-xs leading-relaxed text-white/70">{summary.rawSummary}</div>
                    </div>
                  )}
                </GlassPanel>
              )}
            </div>
          </div>
        </main>
      </div>

      <ConversationDrawer
        open={chatOpen}
        otherUserId={patientId}
        title="Patient chat"
        subtitle={patientMeta?.email || patientId}
        onClose={() => setChatOpen(false)}
      />
    </div>
  );
}
