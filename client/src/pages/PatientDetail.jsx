import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';
import ConversationDrawer from '../components/conversation/ConversationDrawer';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString();
  } catch {
    return '';
  }
};

const fmtTime = (d) => {
  try {
    return new Date(d).toLocaleTimeString();
  } catch {
    return '';
  }
};

const emotionLabel = (emotion) => {
  if (emotion === 'anxiety') return 'Anxiety';
  if (emotion === 'sadness') return 'Sadness';
  if (emotion === 'anger') return 'Anger';
  if (emotion === 'positivity') return 'Positivity';
  return emotion;
};

const SESSION_TYPE_LABELS = {
  preparation: 'First consultation preparation',
  followup: 'Follow-up session',
  free: 'Free expression'
};

const sessionStatusBadgeClass = (status) => {
  const s = String(status || '').toLowerCase();
  if (s === 'active') return 'border-emerald-400/30 bg-emerald-500/15 text-emerald-50';
  if (s === 'completed') return 'border-sky-400/30 bg-sky-500/15 text-sky-50';
  if (s === 'canceled' || s === 'rejected') return 'border-rose-400/30 bg-rose-500/15 text-rose-50';
  return 'border-amber-400/30 bg-amber-500/15 text-amber-50';
};

const TabButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'h-9 rounded-2xl border px-4 text-xs font-semibold shadow-sm backdrop-blur transition',
      active
        ? 'border-[color:var(--accent-25)] bg-[color:var(--accent-10)] text-[color:var(--app-fg)]'
        : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] hover:brightness-110'
    ].join(' ')}
  >
    {children}
  </button>
);

export default function PatientDetail() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [chatOpen, setChatOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [patientMeta, setPatientMeta] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionIdForReport, setSessionIdForReport] = useState(null);

  const [data, setData] = useState({ messages: [], notes: [] });
  const [emotions, setEmotions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [emotionFormOpen, setEmotionFormOpen] = useState(false);
  const [emotionSessionId, setEmotionSessionId] = useState(null);
  const [savingEmotions, setSavingEmotions] = useState(false);
  const [emotionDraft, setEmotionDraft] = useState({
    anxiety: 0,
    sadness: 0,
    anger: 0,
    positivity: 0
  });

  const [riskAlerts, setRiskAlerts] = useState([]);
  const socketRef = useRef(null);

  const [tab, setTab] = useState('overview'); // overview | history | alerts | notes | documents | chat

  // History (sessions)
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyOnlyCompleted, setHistoryOnlyCompleted] = useState(false);

  // Notes
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Documents + RAG
  const [documents, setDocuments] = useState([]);
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [querying, setQuerying] = useState(false);

  // Chat preview
  const [chatQuery, setChatQuery] = useState('');

  const fetchDocuments = useCallback(async () => {
    try {
      const docs = await api.get('/api/documents/patient/' + patientId);
      const next = Array.isArray(docs) ? docs : [];
      setDocuments(next);
      setSelectedDoc((current) => {
        if (current && next.some((d) => String(d._id) === String(current))) return current;
        return next[0]?._id || null;
      });
    } catch {
      setDocuments([]);
      setSelectedDoc(null);
    }
  }, [patientId]);

  const fetchRiskAlerts = useCallback(async () => {
    try {
      const alerts = await api.get(`/api/risk-alerts/patient/${patientId}`);
      setRiskAlerts(Array.isArray(alerts) ? alerts : []);
    } catch {
      setRiskAlerts([]);
    }
  }, [patientId]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [patients, detail, emotionRes, sessionRes] = await Promise.all([
        api.get('/api/dashboard/patients'),
        api.get(`/api/dashboard/patient/${patientId}`),
        api.get(`/api/dashboard/emotions/${patientId}`),
        api.get(`/api/sessions/patient/${patientId}`)
      ]);

      const list = Array.isArray(patients) ? patients : [];
      setPatientMeta(list.find((p) => String(p.patientId) === String(patientId)) || null);

      setData(detail || { messages: [], notes: [] });
      setEmotions(Array.isArray(emotionRes) ? emotionRes : []);

      const sess = Array.isArray(sessionRes) ? sessionRes : [];
      setSessions(sess);

      const active = sess.find((s) => String(s.status) === 'active');
      setActiveSessionId(active ? active._id : null);
      setEmotionSessionId((current) => current || (active ? active._id : sess[0]?._id || null));

      const completed = sess.find((s) => String(s.status) === 'completed');
      setSessionIdForReport(completed ? completed._id : null);

      // Always try to load the latest AI summary (and latestReport link) for this patient.
      try {
        const summaryRes = await api.get(`/api/chatbot/summary?patientId=${patientId}`);
        setSummary(summaryRes || null);
      } catch {
        setSummary(null);
      }
    } catch (e) {
      setError(e?.message || 'Failed to load patient');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchAll();
    fetchDocuments();
    fetchRiskAlerts();
  }, [fetchAll, fetchDocuments, fetchRiskAlerts]);

  // Real-time risk alert updates via Socket.IO
  useEffect(() => {
    const raw = localStorage.getItem('user');
    if (!raw) return;
    const user = JSON.parse(raw);
    if (user.role !== 'psychologist') return;

    const socket = io('http://localhost:5000', {
      auth: { token: localStorage.getItem('token') },
      transports: ['websocket']
    });
    socketRef.current = socket;
    socket.emit('join_psychologist_room', user.id || user._id);

    socket.on('risk_alert', (payload) => {
      if (String(payload.patientId) === String(patientId)) fetchRiskAlerts();
    });

    return () => {
      try {
        socket.disconnect();
      } catch {}
    };
  }, [fetchRiskAlerts, patientId]);

  const downloadPDF = useCallback(async () => {
    if (!sessionIdForReport) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:5000/api/sessions/${sessionIdForReport}/report/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${sessionIdForReport}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, [sessionIdForReport]);

  const downloadSessionPDF = useCallback(async (sessionId) => {
    if (!sessionId) return;
    const token = localStorage.getItem('token');
    const res = await fetch(`http://localhost:5000/api/sessions/${sessionId}/report/pdf`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report-${sessionId}.pdf`;
    a.click();
    window.URL.revokeObjectURL(url);
  }, []);

  const downloadChatbotReport = useCallback(async (explicitReportId) => {
    try {
      const reportId = explicitReportId || summary?.latestReport?._id;
      if (!reportId) return;
      const token = localStorage.getItem('token');
      const res = await fetch(`http://localhost:5000/api/chatbot/reports/${reportId}/pdf`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        throw new Error(json?.message || 'Failed to download PDF');
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `chatbot-report-${reportId}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e?.message || 'Failed to download PDF');
    }
  }, [summary]);

  // If navigated here from a notification, auto-download the specified report id.
  useEffect(() => {
    const reportId = searchParams.get('downloadChatbotReport');
    if (!reportId) return;

    downloadChatbotReport(reportId);

    // remove param after triggering once
    const next = new URLSearchParams(searchParams);
    next.delete('downloadChatbotReport');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [downloadChatbotReport]);

  const endSession = useCallback(async () => {
    if (!activeSessionId) return;
    if (!window.confirm('End this session? The patient will be prompted to rate you.')) return;
    try {
      await api.put(`/api/sessions/${activeSessionId}/end`, {});
      setActiveSessionId(null);
      await fetchAll();
    } catch {
      alert('Failed to end session. Please try again.');
    }
  }, [activeSessionId, fetchAll]);

  const addNote = useCallback(async () => {
    const value = String(newNote || '').trim();
    if (!value) return;
    setSavingNote(true);
    try {
      await api.post('/api/dashboard/notes', { patientId, sessionId: activeSessionId || undefined, content: value });
      setNewNote('');
      await fetchAll();
    } catch (e) {
      alert(e?.message || 'Failed to save note');
    } finally {
      setSavingNote(false);
    }
  }, [activeSessionId, fetchAll, newNote, patientId]);

  const saveEmotionalIndicators = useCallback(async () => {
    if (!emotionSessionId) {
      alert('Select a session first.');
      return;
    }
    setSavingEmotions(true);
    try {
      const scores = {
        anxiety: clamp(Number(emotionDraft.anxiety) || 0, 0, 100),
        sadness: clamp(Number(emotionDraft.sadness) || 0, 0, 100),
        anger: clamp(Number(emotionDraft.anger) || 0, 0, 100),
        positivity: clamp(Number(emotionDraft.positivity) || 0, 0, 100)
      };
      await api.post('/api/dashboard/emotions', { patientId, sessionId: emotionSessionId, scores });
      setEmotionFormOpen(false);
      await fetchAll();
    } catch (e) {
      alert(e?.message || 'Failed to save emotional indicators');
    } finally {
      setSavingEmotions(false);
    }
  }, [emotionDraft, emotionSessionId, fetchAll, patientId]);

  const acknowledgeAlert = useCallback(async (alertId) => {
    try {
      await api.put(`/api/risk-alerts/${alertId}/acknowledge`, {});
      setRiskAlerts((prev) =>
        prev.map((a) => (a._id === alertId ? { ...a, isAcknowledged: true, acknowledgedAt: new Date().toISOString() } : a))
      );
    } catch {
      // ignore
    }
  }, []);

  const uploadDocument = useCallback(async () => {
    if (!docFile) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('document', docFile);
      formData.append('patientId', patientId);
      const res = await fetch(`http://localhost:5000/api/documents/upload/${patientId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Upload failed');
      setDocFile(null);
      await fetchDocuments();
    } catch (e) {
      alert(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }, [docFile, fetchDocuments, patientId]);

  const queryDocument = useCallback(async () => {
    if (!selectedDoc || !String(question || '').trim()) return;
    setQuerying(true);
    setAnswer('');
    try {
      const result = await api.post(`/api/documents/query/${selectedDoc}`, { question });
      setAnswer(String(result?.answer || '').trim());
    } catch (e) {
      alert(e?.message || 'Query failed');
    } finally {
      setQuerying(false);
    }
  }, [question, selectedDoc]);

  const stats = useMemo(() => {
    const total = sessions.length;
    const completed = sessions.filter((s) => String(s.status) === 'completed').length;
    const active = sessions.filter((s) => String(s.status) === 'active').length;
    return { total, completed, active };
  }, [sessions]);

  const unackedAlerts = useMemo(() => riskAlerts.filter((a) => !a.isAcknowledged), [riskAlerts]);

  const filteredMessages = useMemo(() => {
    const q = String(chatQuery || '').trim().toLowerCase();
    const list = Array.isArray(data?.messages) ? data.messages : [];
    if (!q) return list.slice(-50);
    return list.filter((m) => String(m.content || '').toLowerCase().includes(q)).slice(-50);
  }, [chatQuery, data?.messages]);

  const filteredSessions = useMemo(() => {
    const q = String(historyQuery || '').trim().toLowerCase();
    let list = sessions;
    if (historyOnlyCompleted) list = list.filter((s) => String(s.status) === 'completed');
    if (!q) return list;
    return list.filter((s) => {
      const type = SESSION_TYPE_LABELS[s.sessionType] || s.sessionType || '';
      return `${type} ${s.status} ${fmtDate(s.createdAt)}`.toLowerCase().includes(q);
    });
  }, [historyOnlyCompleted, historyQuery, sessions]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
        <div className="pointer-events-none fixed inset-0">
          <div className="absolute -top-24 left-1/2 h-80 w-[620px] -translate-x-1/2 rounded-full bg-[color:var(--accent-12)] blur-3xl" />
          <div className="absolute -bottom-28 right-[-160px] h-96 w-96 rounded-full bg-[color:var(--accent-10)] blur-3xl" />
          <div className="absolute -bottom-16 left-[-120px] h-72 w-72 rounded-full bg-[color:var(--accent-08)] blur-3xl" />
          <div className="absolute inset-0 bg-[var(--app-bg)]" />
        </div>
        <div className="relative mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 text-sm text-[color:var(--muted)]">
          Loading patient...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-80 w-[620px] -translate-x-1/2 rounded-full bg-[color:var(--accent-12)] blur-3xl" />
        <div className="absolute -bottom-28 right-[-160px] h-96 w-96 rounded-full bg-[color:var(--accent-10)] blur-3xl" />
        <div className="absolute -bottom-16 left-[-120px] h-72 w-72 rounded-full bg-[color:var(--accent-08)] blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PlatformLogo size={30} />
                <div className="text-xs font-semibold text-[color:var(--muted)]">PsychPlatform</div>
              </div>
              <ThemeToggleButton />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <button onClick={() => navigate(-1)} className="text-xs font-semibold text-[color:var(--muted)] hover:text-[color:var(--app-fg)] transition">
                  ← Back
                </button>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold tracking-tight text-[color:var(--app-fg)]">Patient details</h1>
                  <span className="ui-pill">
                    {patientMeta?.email || patientId}
                  </span>
                  {unackedAlerts.length > 0 && (
                    <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-800 shadow-sm">
                      {unackedAlerts.length} alert{unackedAlerts.length === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {stats.total} sessions · {stats.completed} completed · {stats.active} active
                </div>
              </div>

              <div className="flex max-w-full items-center gap-2 overflow-x-auto whitespace-nowrap">
                <button
                  onClick={() => setChatOpen(true)}
                  className="h-9 ui-btn-primary px-4 text-xs"
                >
                  Open chat
                </button>
                {activeSessionId && (
                    <button
                      onClick={endSession}
                      className="h-9 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 text-xs font-semibold text-rose-800 shadow-sm transition hover:bg-rose-500/15"
                      title="End the active session"
                    >
                      End session
                    </button>
                )}
                {sessionIdForReport && (
                  <button
                    onClick={downloadPDF}
                    className="h-9 ui-btn-ghost px-4 text-xs"
                  >
                    Download report
                  </button>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <TabButton active={tab === 'overview'} onClick={() => setTab('overview')}>
                Overview
              </TabButton>
              <TabButton active={tab === 'history'} onClick={() => setTab('history')}>
                History
              </TabButton>
              <TabButton active={tab === 'alerts'} onClick={() => setTab('alerts')}>
                Risk alerts
              </TabButton>
              <TabButton active={tab === 'notes'} onClick={() => setTab('notes')}>
                Private notes
              </TabButton>
              <TabButton active={tab === 'documents'} onClick={() => setTab('documents')}>
                Documents
              </TabButton>
              <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
                Chat preview
              </TabButton>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {error && (
            <GlassPanel className="p-5">
              <div className="text-sm font-semibold text-rose-800">Could not load patient</div>
              <div className="mt-1 text-xs text-[color:var(--muted)]">{error}</div>
            </GlassPanel>
          )}

          {tab === 'overview' && (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <GlassPanel className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[color:var(--app-fg)]">AI summary</div>
                    <span className="ui-pill">Latest</span>
                  </div>
                  {!summary ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-5 text-sm text-[color:var(--muted)] shadow-sm backdrop-blur">
                      No AI summary available yet (requires at least one completed session).
                    </div>
                  ) : (
                    <>
                      <div className="mt-4 grid grid-cols-3 gap-2">
                        <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-3 text-center shadow-sm backdrop-blur">
                          <div className="text-[11px] font-semibold text-[color:var(--muted)]">Emotion</div>
                          <div className="mt-1 text-xs font-semibold text-[color:var(--app-fg)] capitalize">
                            {summary.emotionalIndicators?.dominantEmotion || '—'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-3 text-center shadow-sm backdrop-blur">
                          <div className="text-[11px] font-semibold text-[color:var(--muted)]">Urgency</div>
                          <div className="mt-1 text-xs font-semibold text-[color:var(--app-fg)]">
                            {summary.emotionalIndicators?.urgencyScore ? `${summary.emotionalIndicators.urgencyScore} / 5` : '—'}
                          </div>
                        </div>
                        <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-3 text-center shadow-sm backdrop-blur">
                          <div className="text-[11px] font-semibold text-[color:var(--muted)]">Trend</div>
                          <div className="mt-1 text-xs font-semibold text-[color:var(--app-fg)] capitalize">
                            {summary.emotionalIndicators?.sentimentTrend || '—'}
                          </div>
                        </div>
                      </div>

                      {summary.keyThemes?.length > 0 && (
                        <div className="mt-4">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Key themes</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {summary.keyThemes.slice(0, 12).map((t, i) => (
                              <span
                                key={i}
                                className="rounded-full border border-[color:var(--accent-20)] bg-[color:var(--accent-10)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-fg)] shadow-sm"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {summary.recommendations?.length > 0 && (
                        <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Suggested follow-ups</div>
                          <div className="mt-2 space-y-2">
                            {summary.recommendations.slice(0, 6).map((rec, i) => (
                              <div key={i} className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3 text-xs text-[color:var(--muted)] shadow-sm backdrop-blur">
                                <span className="font-semibold text-[color:var(--app-fg)]">{i + 1}.</span> {rec}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {summary.rawSummary && (
                        <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Clinical summary</div>
                          <div className="mt-2 text-xs leading-relaxed text-[color:var(--muted)]">{summary.rawSummary}</div>
                        </div>
                      )}

                      {summary.latestReport?._id && (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={downloadChatbotReport}
                            className="h-9 ui-btn-primary px-4 text-xs"
                          >
                            Download chatbot PDF
                          </button>
                          <div className="text-xs text-[color:var(--muted)]">
                            Generated {fmtDate(summary.latestReport.createdAt)}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </GlassPanel>
              </div>

              <div className="space-y-5">
                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">Emotional indicators</div>
                  {emotions.length === 0 ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-5 text-sm text-[color:var(--muted)] shadow-sm backdrop-blur">
                      No emotional indicators yet.
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {Object.entries(emotions?.[0]?.scores || {}).map(([emotion, score]) => (
                        <div key={emotion}>
                          <div className="mb-1 flex items-center justify-between text-xs text-[color:var(--muted)]">
                            <span className="font-semibold text-[color:var(--app-fg)]">{emotionLabel(emotion)}</span>
                            <span>{score}%</span>
                          </div>
                          <div className="h-2.5 w-full rounded-full bg-[color:var(--accent-10)]">
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
                              style={{ width: `${clamp(Number(score) || 0, 0, 100)}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEmotionFormOpen((v) => !v)}
                      className="h-9 ui-btn-ghost px-4 text-xs"
                    >
                      {emotionFormOpen ? 'Hide' : 'Add indicators'}
                    </button>
                  </div>

                  {emotionFormOpen && (
                    <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur">
                      <div className="grid gap-3">
                        <label className="grid gap-1 text-xs text-[color:var(--muted)]">
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Session</span>
                          <select
                            value={emotionSessionId || ''}
                            onChange={(e) => setEmotionSessionId(e.target.value || null)}
                            className="ui-input text-xs"
                          >
                            <option value="" disabled>
                              Select a session
                            </option>
                            {sessions.map((s) => (
                              <option key={s._id} value={s._id}>
                                {fmtDate(s.createdAt)} · {String(s.status || 'session')}
                              </option>
                            ))}
                          </select>
                        </label>

                        {['anxiety', 'sadness', 'anger', 'positivity'].map((key) => (
                          <label key={key} className="grid gap-1 text-xs text-[color:var(--muted)]">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-[color:var(--app-fg)]">{emotionLabel(key)}</span>
                              <span>{clamp(Number(emotionDraft[key]) || 0, 0, 100)}%</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={clamp(Number(emotionDraft[key]) || 0, 0, 100)}
                              onChange={(e) => setEmotionDraft((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                            />
                          </label>
                        ))}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={saveEmotionalIndicators}
                            disabled={savingEmotions || !emotionSessionId}
                            className="h-10 ui-btn-primary px-4 text-xs disabled:opacity-50"
                          >
                            {savingEmotions ? 'Saving…' : 'Save indicators'}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmotionDraft({ anxiety: 0, sadness: 0, anger: 0, positivity: 0 })}
                            className="h-10 ui-btn-ghost px-4 text-xs"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </GlassPanel>
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-2">
                <GlassPanel className="p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[color:var(--app-fg)]">Sessions</div>
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={historyQuery}
                        onChange={(e) => setHistoryQuery(e.target.value)}
                        placeholder="Search sessions..."
                        className="h-9 w-[220px] rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-xs text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] shadow-sm backdrop-blur focus:ring-2 focus:ring-[color:var(--accent-12)]"
                      />
                      <button
                        type="button"
                        onClick={() => setHistoryOnlyCompleted((v) => !v)}
                        className={[
                          'h-9 rounded-2xl border px-4 text-xs font-semibold shadow-sm backdrop-blur transition',
                          historyOnlyCompleted
                            ? 'border-[color:var(--accent-25)] bg-[color:var(--accent-10)] text-[color:var(--app-fg)]'
                            : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] hover:brightness-110'
                        ].join(' ')}
                        title="Show only completed sessions"
                      >
                        Completed only
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 space-y-3">
                    {filteredSessions.length === 0 && (
                      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm backdrop-blur">
                        No sessions match your filters.
                      </div>
                    )}

                    {filteredSessions.map((s) => (
                      <div
                        key={s._id}
                        className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[color:var(--app-fg)]">
                              {SESSION_TYPE_LABELS[s.sessionType] || s.sessionType || 'Session'}
                            </div>
                            <div className="mt-1 text-xs text-[color:var(--muted)]">{fmtDate(s.createdAt)}</div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={[
                                'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                                sessionStatusBadgeClass(s.status)
                              ].join(' ')}
                            >
                              {String(s.status || 'unknown')}
                            </span>
                            <button
                              type="button"
                              onClick={() => downloadSessionPDF(s._id)}
                              disabled={String(s.status) !== 'completed'}
                              className="h-9 ui-btn-ghost px-4 text-xs disabled:cursor-not-allowed disabled:opacity-40"
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
                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">At a glance</div>
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    {[
                      { label: 'Total', value: stats.total },
                      { label: 'Active', value: stats.active },
                      { label: 'Completed', value: stats.completed }
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-3 text-center shadow-sm backdrop-blur"
                      >
                        <div className="text-[11px] font-semibold text-[color:var(--muted)]">{item.label}</div>
                        <div className="mt-1 text-sm font-semibold text-[color:var(--app-fg)]">{item.value}</div>
                      </div>
                    ))}
                  </div>
                </GlassPanel>
              </div>
            </div>
          )}

          {tab === 'alerts' && (
            <div className="mt-5 space-y-5">
              <GlassPanel className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">Risk alerts</div>
                  <div className="text-xs text-[color:var(--muted)]">
                    {unackedAlerts.length > 0 ? `${unackedAlerts.length} unacknowledged` : 'All acknowledged'}
                  </div>
                </div>

                {riskAlerts.length === 0 ? (
                  <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm backdrop-blur">
                    No risk alerts detected.
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    {riskAlerts.map((alert) => {
                      const severity = String(alert.severity || 'medium').toLowerCase();
                      const theme =
                        severity === 'low'
                          ? { border: 'border-amber-300/40', bg: 'bg-amber-50/70', text: 'text-amber-900', dot: 'bg-amber-500' }
                          : severity === 'high' || severity === 'critical'
                            ? { border: 'border-rose-300/45', bg: 'bg-rose-50/70', text: 'text-rose-900', dot: 'bg-rose-500' }
                            : { border: 'border-orange-300/45', bg: 'bg-orange-50/70', text: 'text-orange-900', dot: 'bg-orange-500' };

                      return (
                        <div
                          key={alert._id}
                          className={['rounded-2xl border p-4', theme.border, theme.bg, alert.isAcknowledged ? 'opacity-70' : ''].join(' ')}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`h-2 w-2 rounded-full ${theme.dot}`} />
                                <div className={`text-sm font-semibold ${theme.text}`}>
                                  {String(alert.riskCategory || 'risk').replaceAll('_', ' ')}
                                </div>
                                <span className="ui-pill">
                                  {String(alert.severity || 'medium').toUpperCase()}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-[color:var(--muted)]">
                                {fmtDate(alert.createdAt)} · {fmtTime(alert.createdAt)}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {!alert.isAcknowledged ? (
                                <button
                                  onClick={() => acknowledgeAlert(alert._id)}
                                  className="h-9 ui-btn-ghost px-4 text-xs"
                                >
                                  Acknowledge
                                </button>
                              ) : (
                                <span className="text-xs font-semibold text-emerald-800">Acknowledged</span>
                              )}
                            </div>
                          </div>

                          {alert.triggerMessage && (
                            <div className="mt-3 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-3 text-xs text-[color:var(--muted)] shadow-sm backdrop-blur">
                              “{String(alert.triggerMessage).slice(0, 240)}
                              {String(alert.triggerMessage).length > 240 ? '…' : ''}”
                            </div>
                          )}

                          <div className="mt-3 text-[11px] text-[color:var(--muted)]">Score: {alert.riskScore}/100</div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassPanel>
            </div>
          )}

          {tab === 'notes' && (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">Add note</div>
                  <div className="mt-3">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Write a private note for yourself (visible only to you)…"
                      className="h-32 w-full resize-none rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3 text-sm text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] shadow-sm backdrop-blur transition focus:ring-2"
                    />
                  </div>
                  <button
                    onClick={addNote}
                    disabled={savingNote || !String(newNote || '').trim()}
                    className="mt-3 h-10 w-full ui-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {savingNote ? 'Saving...' : 'Save note'}
                  </button>
                </GlassPanel>
              </div>

              <div className="lg:col-span-2">
                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">Notes</div>
                  <div className="mt-4 space-y-3">
                    {Array.isArray(data?.notes) && data.notes.length > 0 ? (
                      data.notes.map((note) => (
                        <div key={note._id} className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur">
                          <div className="text-sm text-[color:var(--app-fg)]">{note.content}</div>
                          <div className="mt-2 text-xs text-[color:var(--muted)]">
                            {fmtDate(note.createdAt)} · {fmtTime(note.createdAt)}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm backdrop-blur">No notes yet.</div>
                    )}
                  </div>
                </GlassPanel>
              </div>
            </div>
          )}

          {tab === 'documents' && (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="space-y-5 lg:col-span-1">
                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">Upload PDF</div>
                  <div className="mt-3">
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                      className="block w-full rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-xs text-[color:var(--app-fg)] shadow-sm backdrop-blur file:mr-3 file:rounded-xl file:border-0 file:bg-[color:var(--panel-bg)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--app-fg)] hover:file:brightness-110"
                    />
                  </div>
                  <button
                    onClick={uploadDocument}
                    disabled={uploading || !docFile}
                    className="mt-3 h-10 w-full ui-btn-primary text-xs disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    {uploading ? 'Uploading...' : 'Upload'}
                  </button>
                  <div className="mt-2 text-[11px] text-[color:var(--muted)]">Uploaded documents stay private and are only visible to authorized staff.</div>
                </GlassPanel>

                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">Ask about a document</div>
                  {!selectedDoc ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-5 text-sm text-[color:var(--muted)] shadow-sm backdrop-blur">
                      Select a document to ask questions.
                    </div>
                  ) : (
                    <>
                      <div className="mt-3">
                        <input
                          value={question}
                          onChange={(e) => setQuestion(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && queryDocument()}
                          placeholder="e.g. What are the main symptoms mentioned?"
                          className="ui-input px-4 text-xs"
                        />
                      </div>
                      <button
                        onClick={queryDocument}
                        disabled={querying || !String(question || '').trim()}
                        className="mt-3 h-10 w-full ui-btn-ghost text-xs disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {querying ? 'Thinking...' : 'Ask'}
                      </button>
                      {answer && (
                        <div className="mt-3 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Answer</div>
                          <div className="mt-2 text-xs leading-relaxed text-[color:var(--muted)]">{answer}</div>
                        </div>
                      )}
                    </>
                  )}
                </GlassPanel>
              </div>

              <div className="lg:col-span-2">
                <GlassPanel className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[color:var(--app-fg)]">Documents</div>
                    <button
                      onClick={fetchDocuments}
                      className="h-9 ui-btn-ghost px-4 text-xs"
                    >
                      Refresh
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {documents.length === 0 ? (
                      <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 text-center text-sm text-[color:var(--muted)] shadow-sm backdrop-blur">
                        No documents uploaded yet.
                      </div>
                    ) : (
                      documents.map((doc) => (
                        <button
                          key={doc._id}
                          type="button"
                          onClick={() => {
                            setSelectedDoc(doc._id);
                            setAnswer('');
                          }}
                          className={[
                            'flex w-full items-center justify-between gap-3 rounded-2xl border p-4 text-left transition',
                            selectedDoc === doc._id
                              ? 'border-[color:var(--accent-25)] bg-[color:var(--accent-10)] shadow-sm'
                              : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] hover:brightness-110 shadow-sm backdrop-blur'
                          ].join(' ')}
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-[color:var(--app-fg)]">{doc.originalName}</div>
                            <div className="mt-1 text-xs text-[color:var(--muted)]">{fmtDate(doc.createdAt)}</div>
                          </div>
                          {selectedDoc === doc._id && (
                            <span className="ui-pill">
                              Selected
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </GlassPanel>
              </div>
            </div>
          )}

          {tab === 'chat' && (
            <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-3">
              <div className="lg:col-span-1">
                <GlassPanel className="p-5">
                  <div className="text-sm font-semibold text-[color:var(--app-fg)]">Search messages</div>
                  <input
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    placeholder="Type to filter..."
                    className="mt-3 ui-input px-4 text-xs"
                  />
                  <div className="mt-2 text-[11px] text-[color:var(--muted)]">Showing the most recent 50 matches.</div>
                </GlassPanel>
              </div>
              <div className="lg:col-span-2">
                <GlassPanel className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-[color:var(--app-fg)]">Chat preview</div>
                    <button
                      onClick={() => setChatOpen(true)}
                      className="h-9 ui-btn-primary px-4 text-xs"
                    >
                      Open full chat
                    </button>
                  </div>

                  <div className="mt-4 h-[420px] space-y-3 overflow-y-auto rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur">
                    {filteredMessages.length === 0 ? (
                      <div className="py-10 text-center text-sm text-[color:var(--muted)]">No messages.</div>
                    ) : (
                      filteredMessages.map((msg) => {
                        const fromPatient = String(msg.senderId) === String(patientId);
                        return (
                          <div key={msg._id} className={`flex ${fromPatient ? 'justify-start' : 'justify-end'}`}>
                            <div
                              className={[
                                'max-w-[80%] rounded-2xl px-4 py-3',
                                fromPatient
                                  ? 'border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] shadow-sm backdrop-blur'
                                  : 'border border-[color:var(--accent-20)] bg-[color:var(--accent-10)] text-[color:var(--app-fg)] shadow-sm'
                              ].join(' ')}
                            >
                              <div className="text-sm leading-relaxed">{msg.content}</div>
                              <div className="mt-1 text-[11px] text-[color:var(--muted)]">{fmtTime(msg.createdAt)}</div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </GlassPanel>
              </div>
            </div>
          )}
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
