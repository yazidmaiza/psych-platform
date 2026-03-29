import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

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

const Glass = ({ children, className = '' }) => (
  <div className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-sm ${className}`}>
    {children}
  </div>
);

const formatDate = (d) => {
  try {
    return new Date(d).toLocaleDateString();
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
  const [loading, setLoading] = useState(true);
  const [cancelingId, setCancelingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const fetchAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const sessionData = await api.get('/api/sessions/patient/' + userId);
      setSessions(Array.isArray(sessionData) ? sessionData : []);

      const summaryMap = {};
      const ratedByPsychologist = {};
      await Promise.all(
        (sessionData || [])
          .filter(s => s.status === 'completed')
          .map(async s => {
            try {
              const summary = await api.get('/api/chatbot/' + s._id + '/summary');
              summaryMap[s._id] = summary;
            } catch {}

            // Check rating eligibility/status (accepts psychologist userId or profileId)
            try {
              const check = await api.get('/api/ratings/check/' + s.psychologistId);
              ratedByPsychologist[String(s.psychologistId)] = !!check?.hasRated;
            } catch {
              ratedByPsychologist[String(s.psychologistId)] = false;
            }
          })
      );
      setSummaries(summaryMap);
      setRatedMap(ratedByPsychologist);
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

  if (loading) return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <div className="text-sm text-white/60">Loading your sessions...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background (match Session page look) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative">
        <div className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">My sessions</h1>
                <p className="mt-1 text-sm text-white/60">
                  Review bookings, complete payment, and continue sessions.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/patient/dashboard')}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {sessions.length === 0 && (
            <Glass className="p-10 text-center">
              <div className="text-sm font-semibold">No sessions yet</div>
              <p className="mt-2 text-sm text-white/60">
                Book your first session to get started.
              </p>
              <button
                type="button"
                onClick={() => navigate('/patient/dashboard')}
                className="mt-6 rounded-2xl bg-indigo-500/90 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 transition"
              >
                Browse psychologists
              </button>
            </Glass>
          )}

          <div className="grid grid-cols-1 gap-4">
            {sessions.map((session) => {
              const summary = summaries[session._id];
              const hasRated = !!ratedMap[String(session.psychologistId)];
              const isExpanded = expandedId === session._id;
              const canCancel = ['requested', 'pending', 'pending_payment', 'paid'].includes(session.status);

              return (
                <Glass key={session._id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-white">
                          {SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}
                        </div>
                        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${STATUS_STYLES[session.status] || STATUS_STYLES.pending}`}>
                          {session.status}
                        </span>
                        <span className="text-[11px] text-white/50">
                          {formatDate(session.createdAt)}
                        </span>
                      </div>

                      {session.status === 'requested' && (
                        <div className="mt-3 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
                          Waiting for the psychologist to confirm your booking.
                        </div>
                      )}

                      {session.status === 'canceled' && (
                        <div className="mt-3 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                          This booking was canceled.
                        </div>
                      )}
                    </div>

                    <div className="flex w-full flex-col gap-2 sm:w-[280px]">
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

                      {(session.status === 'completed' && !hasRated) && (
                        <button
                          type="button"
                          onClick={() => navigate('/rate/' + session.psychologistId)}
                          className="h-[44px] w-full rounded-2xl bg-fuchsia-500/80 px-4 text-sm font-semibold text-white hover:bg-fuchsia-500 transition"
                        >
                          Rate your psychologist
                        </button>
                      )}

                      {session.status === 'completed' && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : session._id)}
                          className="h-[44px] w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                        >
                          {isExpanded ? 'Hide summary' : 'View summary'}
                        </button>
                      )}
                    </div>
                  </div>

                  {session.status === 'completed' && isExpanded && (
                    <div className="mt-5">
                      {summary ? (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-center">
                              <div className="text-[11px] font-semibold text-white/50">Emotion</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {summary.emotionalIndicators?.dominantEmotion || 'N/A'}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-4 text-center">
                              <div className="text-[11px] font-semibold text-white/50">Urgency</div>
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
                                {summary.keyThemes.map((theme, i) => (
                                  <span key={i} className="rounded-full border border-indigo-400/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-100">
                                    {theme}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-4 text-sm text-white/70 leading-relaxed whitespace-pre-wrap">
                            {summary.rawSummary}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm text-white/60">
                          No AI summary available.
                        </div>
                      )}
                    </div>
                  )}
                </Glass>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
