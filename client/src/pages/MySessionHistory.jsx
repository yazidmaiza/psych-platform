import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

const SESSION_TYPE_LABELS = {
  preparation: 'First consultation preparation',
  followup: 'Follow-up session',
  free: 'Free expression'
};

const STATUS_STYLES = {
  requested: 'border-amber-400/20 bg-amber-500/10 text-amber-100',
  pending: 'border-white/10 bg-white/5 text-white/70',
  pending_payment: 'border-yellow-400/20 bg-yellow-500/10 text-yellow-100',
  paid: 'border-yellow-400/20 bg-yellow-500/10 text-yellow-100',
  active: 'border-indigo-400/20 bg-indigo-500/10 text-indigo-100',
  completed: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-100',
  canceled: 'border-rose-400/20 bg-rose-500/10 text-rose-100'
};

const STATUS_META = {
  requested: { label: 'Requested', icon: '⏳' },
  pending: { label: 'Pending', icon: '⌛' },
  pending_payment: { label: 'Awaiting payment', icon: '💳' },
  paid: { label: 'Paid', icon: '🔐' },
  active: { label: 'Active', icon: '▶' },
  completed: { label: 'Completed', icon: '✓' },
  canceled: { label: 'Canceled', icon: '✕' }
};

const FILTERS = ['all', 'requested', 'pending', 'pending_payment', 'paid', 'active', 'completed', 'canceled'];

const formatDate = (value) => {
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '';
  }
};

export default function MySessionHistory() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [sessions, setSessions] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [ratedMap, setRatedMap] = useState({});
  const [myNotes, setMyNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchAll = useCallback(async () => {
    if (!userId) {
      setSessions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const sessionData = await api.get('/api/sessions/patient/' + userId);
      setSessions(Array.isArray(sessionData) ? sessionData : []);

      const summaryMap = {};
      const ratedByPsychologist = {};
      await Promise.all(
        (sessionData || [])
          .filter((session) => session.status === 'completed')
          .map(async (session) => {
            try {
              const summary = await api.get('/api/chatbot/summary');
              summaryMap[session._id] = summary;
            } catch {}

            try {
              const check = await api.get('/api/ratings/check/' + session.psychologistId);
              ratedByPsychologist[String(session.psychologistId)] = !!check?.hasRated;
            } catch {
              ratedByPsychologist[String(session.psychologistId)] = false;
            }
          })
      );

      setSummaries(summaryMap);
      setRatedMap(ratedByPsychologist);

      try {
        const notes = await api.get('/api/dashboard/notes/patient/me');
        setMyNotes(Array.isArray(notes) ? notes : []);
      } catch {
        setMyNotes([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const cancelBooking = async (sessionId) => {
    if (!window.confirm('Cancel this booking?')) return;

    setCancelingId(sessionId);
    try {
      await api.post('/api/sessions/' + sessionId + '/cancel', {});
      await fetchAll();
    } catch (err) {
      alert(err.message || 'Failed to cancel booking');
    } finally {
      setCancelingId(null);
    }
  };

  const visibleSessions = useMemo(() => {
    return sessions
      .filter((session) => filter === 'all' || session.status === filter)
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [filter, sessions]);

  const summaryStats = useMemo(() => {
    const counts = sessions.reduce((acc, session) => {
      const key = String(session.status || 'pending');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return {
      total: sessions.length,
      active: counts.active || 0,
      completed: counts.completed || 0,
      pending: (counts.requested || 0) + (counts.pending || 0) + (counts.pending_payment || 0) + (counts.paid || 0)
    };
  }, [sessions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)] flex items-center justify-center">
        <GlassPanel className="px-6 py-4 text-sm text-white/70 shadow-[0_20px_60px_rgba(15,23,42,0.18)]">
          Loading your sessions...
        </GlassPanel>
      </div>
    );
  }

  const hasSessions = sessions.length > 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[color:var(--app-bg)]" />
      </div>

      <div className="relative">
        <div className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)]/90 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
                  Session history
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
                </div>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">My sessions</h1>
                <p className="mt-1 max-w-2xl text-sm text-white/60">
                  Review bookings, continue active sessions, complete payments, and revisit completed notes.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/patient/dashboard')}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  Back to dashboard
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/patient/discovery')}
                  className="rounded-2xl bg-indigo-500/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
                >
                  Book new session
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <GlassPanel className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Total sessions</div>
              <div className="mt-2 text-3xl font-semibold">{summaryStats.total}</div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Active</div>
              <div className="mt-2 text-3xl font-semibold text-indigo-200">{summaryStats.active}</div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Completed</div>
              <div className="mt-2 text-3xl font-semibold text-emerald-200">{summaryStats.completed}</div>
            </GlassPanel>
            <GlassPanel className="p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/45">Needs action</div>
              <div className="mt-2 text-3xl font-semibold text-amber-200">{summaryStats.pending}</div>
            </GlassPanel>
          </div>

          <GlassPanel className="mt-4 p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Filters</div>
                <div className="mt-2 text-sm text-white/60">
                  Switch between statuses to focus on what needs attention.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {FILTERS.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setFilter(status)}
                    className={`h-9 rounded-xl px-4 text-sm font-semibold capitalize transition whitespace-nowrap ${
                      filter === status
                        ? 'bg-indigo-500 text-white'
                        : 'bg-white/5 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          </GlassPanel>

          {!hasSessions && (
            <GlassPanel className="mt-4 p-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/15 text-2xl">
                📅
              </div>
              <div className="mt-4 text-lg font-semibold">No sessions yet</div>
              <p className="mt-2 text-sm text-white/60">
                Book your first session to get started.
              </p>
              <button
                type="button"
                onClick={() => navigate('/patient/discovery')}
                className="mt-6 rounded-2xl bg-indigo-500/90 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500"
              >
                Browse psychologists
              </button>
            </GlassPanel>
          )}

          {hasSessions && visibleSessions.length === 0 && (
            <GlassPanel className="mt-4 p-10 text-center text-white/50">
              No sessions match this filter.
            </GlassPanel>
          )}

          <div className="mt-4 grid grid-cols-1 gap-4">
            {visibleSessions.map((session) => {
              const summary = summaries[session._id];
              const hasRated = !!ratedMap[String(session.psychologistId)];
              const isExpanded = expandedId === session._id;
              const canCancel = ['requested', 'pending', 'pending_payment', 'paid'].includes(session.status);
              const meta = STATUS_META[session.status] || STATUS_META.pending;
              const psychologistName = session.psychologistName || session.psychologist?.fullName || session.psychologist?.name || 'Psychologist';

              return (
                <GlassPanel key={session._id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : session._id)}
                      className="flex flex-1 items-start gap-4 text-left"
                    >
                      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg ${
                        session.status === 'active' ? 'bg-indigo-500/20 text-indigo-200' :
                        session.status === 'completed' ? 'bg-emerald-500/20 text-emerald-200' :
                        session.status === 'canceled' ? 'bg-rose-500/20 text-rose-200' :
                        'bg-amber-500/20 text-amber-200'
                      }`}>
                        {meta.icon}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white">
                            {SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}
                          </div>
                          <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${STATUS_STYLES[session.status] || STATUS_STYLES.pending}`}>
                            {meta.label}
                          </span>
                          <span className="text-[11px] text-white/50">
                            {formatDate(session.createdAt)}
                          </span>
                        </div>

                        <div className="mt-2 text-lg font-semibold tracking-tight text-white">
                          {psychologistName}
                        </div>
                        <p className="mt-1 text-sm text-white/60">
                          {session.summary || session.reason || 'Session details are available after expanding the card.'}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {session.status === 'requested' && (
                            <span className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                              Waiting confirmation
                            </span>
                          )}

                          {session.status === 'canceled' && (
                            <span className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-100">
                              Booking canceled
                            </span>
                          )}

                          {session.status === 'completed' && hasRated && (
                            <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100">
                              Already rated
                            </span>
                          )}
                        </div>
                      </div>
                    </button>

                    <div className="flex w-full flex-col gap-2 lg:w-[280px]">
                      {session.status === 'active' && (
                        <button
                          type="button"
                          onClick={() => navigate('/session/' + session._id)}
                          className="h-[44px] w-full rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition"
                        >
                          Continue session
                        </button>
                      )}

                      {session.status === 'pending_payment' && (
                        <button
                          type="button"
                          onClick={() => navigate('/payment/' + session._id)}
                          className="h-[44px] w-full rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white hover:bg-emerald-500 transition"
                        >
                          Pay within 24 hours
                        </button>
                      )}

                      {session.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => navigate('/payment/' + session._id)}
                          className="h-[44px] w-full rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white hover:bg-emerald-500 transition"
                        >
                          Complete payment
                        </button>
                      )}

                      {session.status === 'paid' && (
                        <button
                          type="button"
                          onClick={() => navigate('/verify/' + session._id)}
                          className="h-[44px] w-full rounded-2xl bg-amber-500/90 px-4 text-sm font-semibold text-white hover:bg-amber-500 transition"
                        >
                          Enter access code
                        </button>
                      )}

                      {canCancel && (
                        <button
                          type="button"
                          onClick={() => cancelBooking(session._id)}
                          disabled={cancelingId === session._id}
                          className="h-[44px] w-full rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white hover:bg-rose-500 transition disabled:opacity-50"
                        >
                          {cancelingId === session._id ? 'Canceling...' : 'Cancel booking'}
                        </button>
                      )}

                      {session.status === 'completed' && !hasRated && (
                        <button
                          type="button"
                          onClick={() => navigate('/rate/' + session.psychologistId)}
                          className="h-[44px] w-full rounded-2xl bg-fuchsia-500/80 px-4 text-sm font-semibold text-white hover:bg-fuchsia-500 transition"
                        >
                          Rate your psychologist
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : session._id)}
                        className="h-[44px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                      >
                        {isExpanded ? 'Collapse details' : 'Expand details'}
                      </button>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-5">
                      {session.status === 'completed' && summary ? (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-center">
                              <div className="text-[11px] font-semibold text-white/50">Emotion</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {summary.emotionalIndicators?.dominantEmotion || 'N/A'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-center">
                              <div className="text-[11px] font-semibold text-white/50">
                                Clinical urgency
                                <span className="ml-1 text-[10px] text-white/40" title="Clinical assessment, not a chatbot quality score.">
                                  info
                                </span>
                              </div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {summary.emotionalIndicators?.urgencyScore || 'N/A'} / 5
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-center">
                              <div className="text-[11px] font-semibold text-white/50">Trend</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {summary.emotionalIndicators?.sentimentTrend || 'N/A'}
                              </div>
                            </div>
                          </div>

                          {Array.isArray(summary.keyThemes) && summary.keyThemes.length > 0 && (
                            <div className="mt-4">
                              <div className="text-xs font-semibold text-white/60">Key themes</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {summary.keyThemes.map((theme, index) => (
                                  <span key={index} className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-100">
                                    {theme}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-white/70">
                            {summary.rawSummary}
                          </div>

                          {(() => {
                            const sessionNotes = myNotes.filter((note) => String(note.psychologistId) === String(session.psychologistId));
                            if (sessionNotes.length === 0) return null;

                            return (
                              <div className="mt-5 border-t border-white/10 pt-4">
                                <div className="mb-3 text-xs font-semibold text-white/60">Psychologist's notes</div>
                                <div className="flex flex-col gap-2">
                                  {sessionNotes.map((note) => (
                                    <div key={note._id} className="rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3">
                                      <p className="text-sm text-amber-100">{note.content}</p>
                                      <p className="mt-1 text-[11px] text-white/40">
                                        {new Date(note.createdAt).toLocaleDateString()}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                          {session.status === 'completed'
                            ? 'No AI summary available.'
                            : 'Expand this card to review the session details.'}
                        </div>
                      )}
                    </div>
                  )}
                </GlassPanel>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
