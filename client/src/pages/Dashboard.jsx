import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toAbsoluteUrl } from '../services/api';
import { logout } from '../services/auth';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';
import GlassPanel from '../components/dashboard/GlassPanel';
import PsychologistProfileDrawer from '../components/profile/PsychologistProfileDrawer';
import AreaLineChart from '../components/charts/AreaLineChart';
import StackedBar from '../components/charts/StackedBar';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import ConversationDrawer from '../components/conversation/ConversationDrawer';

const StatCard = ({ label, value, hint }) => (
  <GlassPanel className="p-5">
    <div className="text-xs font-semibold text-slate-500">{label}</div>
    <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{value}</div>
    {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
  </GlassPanel>
);

function Dashboard() {
  const navigate = useNavigate();

  const [section, setSection] = useState('patients');
  const [patientSearch, setPatientSearch] = useState('');
  const [messagesSearch, setMessagesSearch] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatPatientId, setChatPatientId] = useState(null);
  const [chatTitle, setChatTitle] = useState('Messages');
  const [chatSubtitle, setChatSubtitle] = useState('');

  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState('');

  const [credentialDocs, setCredentialDocs] = useState([]);
  const [credentialDocsLoading, setCredentialDocsLoading] = useState(false);
  const [credentialDocsError, setCredentialDocsError] = useState('');
  const [credentialUploadType, setCredentialUploadType] = useState('');
  const [credentialUploadLoading, setCredentialUploadLoading] = useState(false);
  const [credentialUploadFiles, setCredentialUploadFiles] = useState({
    cv: null,
    diploma: null,
    idFront: null,
    idBack: null,
    introVideo: null
  });
  const [onboarding, setOnboarding] = useState(null);
  const [onboardingLoading, setOnboardingLoading] = useState(false);

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [profileOpen, setProfileOpen] = useState(false);

  const filteredPatients = useMemo(() => {
    const q = String(patientSearch || '').trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const email = String(p?.email || '').toLowerCase();
      const status = String(p?.status || '').toLowerCase();
      return email.includes(q) || status.includes(q);
    });
  }, [patientSearch, patients]);

  const filteredMessagePatients = useMemo(() => {
    const q = String(messagesSearch || '').trim().toLowerCase();
    if (!q) return patients;
    return patients.filter((p) => {
      const email = String(p?.email || '').toLowerCase();
      const status = String(p?.status || '').toLowerCase();
      return email.includes(q) || status.includes(q);
    });
  }, [messagesSearch, patients]);

  const fetchPatients = useCallback(async () => {
    setPatientsLoading(true);
    setPatientsError('');
    try {
      const data = await api.get('/api/dashboard/patients');
      setPatients(Array.isArray(data) ? data : []);
    } catch (e) {
      setPatients([]);
      setPatientsError(e.message || 'Failed to load patients');
    } finally {
      setPatientsLoading(false);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError('');
    try {
      const data = await api.get('/api/dashboard/stats');
      setStats(data || null);
    } catch (e) {
      setStats(null);
      setStatsError(e.message || 'Failed to load statistics');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchCredentialDocs = useCallback(async () => {
    setCredentialDocsLoading(true);
    setCredentialDocsError('');
    try {
      const data = await api.get('/api/credential-documents/my');
      setCredentialDocs(Array.isArray(data) ? data : []);
    } catch (e) {
      setCredentialDocs([]);
      setCredentialDocsError(e.message || 'Failed to load credential documents');
    } finally {
      setCredentialDocsLoading(false);
    }
  }, []);

  const fetchOnboarding = useCallback(async () => {
    setOnboardingLoading(true);
    try {
      const data = await api.get('/api/onboarding/me');
      setOnboarding(data || null);
    } catch {
      setOnboarding(null);
    } finally {
      setOnboardingLoading(false);
    }
  }, []);

  const uploadCredentialDoc = useCallback(async (type) => {
    const file = credentialUploadFiles?.[type] || null;
    if (!file) return;
    setCredentialUploadType(type);
    setCredentialUploadLoading(true);
    setCredentialDocsError('');
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);
      await api.postForm('/api/credential-documents/upload', formData);
      setCredentialUploadFiles((prev) => ({ ...prev, [type]: null }));
      await Promise.all([fetchCredentialDocs(), fetchOnboarding()]);
    } catch (e) {
      setCredentialDocsError(e.message || 'Failed to upload document');
    } finally {
      setCredentialUploadLoading(false);
      setCredentialUploadType('');
    }
  }, [credentialUploadFiles, fetchCredentialDocs, fetchOnboarding]);

  const openChatForPatient = useCallback((patient) => {
    const id = patient?.patientId?.toString?.() || patient?.patientId;
    if (!id) return;
    setChatPatientId(id);
    setChatTitle('Messages');
    setChatSubtitle(String(patient?.email || id));
    setChatOpen(true);
  }, []);

  const refreshUnreadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/api/notifications');
      const list = Array.isArray(data) ? data : [];
      setUnreadNotifications(list.filter((n) => !n.isRead).length);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    fetchPatients();
    refreshUnreadNotifications();
  }, [fetchPatients, refreshUnreadNotifications]);

  useEffect(() => {
    if (section !== 'statistics') return;
    if (stats || statsLoading) return;
    fetchStats();
  }, [fetchStats, section, stats, statsLoading]);

  useEffect(() => {
    if (section !== 'documents') return;
    fetchCredentialDocs();
    fetchOnboarding();
    // Important: do NOT depend on `credentialDocsLoading` here.
    // Depending on loading state creates a fetch loop (loading false -> fetch -> false -> fetch ...),
    // which quickly hits the API rate limiter (429).
  }, [fetchCredentialDocs, fetchOnboarding, section]);

  const openCredentialDoc = useCallback(async (doc) => {
    try {
      const data = await api.get(`/api/credential-documents/${doc._id}/access-url`);
      const url = toAbsoluteUrl(data?.url);
      const res = await fetch(url);
      if (!res.ok) throw new Error('Failed to download document');
      const blob = await res.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      window.open(objectUrl);
    } catch (e) {
      setCredentialDocsError(e.message || 'Could not open document');
    }
  }, []);

  const submitOnboarding = useCallback(async () => {
    try {
      setCredentialDocsError('');
      await api.post('/api/onboarding/submit', {});
      await fetchOnboarding();
      setCredentialDocsError('Submitted for review.');
    } catch (e) {
      setCredentialDocsError(e.message || 'Submission failed');
    }
  }, [fetchOnboarding]);

  const statusBadge = useCallback((status) => {
    const s = String(status || '').toLowerCase();
    if (s === 'accepted' || s === 'active') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-800';
    if (s === 'rejected' || s === 'canceled') return 'border-rose-500/20 bg-rose-500/10 text-rose-800';
    return 'border-amber-500/25 bg-amber-500/10 text-amber-800';
  }, []);

  const breakdownSegments = useMemo(() => {
    return [
      { label: 'Active', value: Number(stats?.activeSessions || 0), className: 'bg-sky-500/80' },
      { label: 'Pending', value: Number(stats?.pendingSessions || 0), className: 'bg-amber-400/80' },
      { label: 'Completed', value: Number(stats?.completedSessions || 0), className: 'bg-emerald-500/80' }
    ];
  }, [stats?.activeSessions, stats?.completedSessions, stats?.pendingSessions]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      {/* Soft light background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-80 w-[620px] -translate-x-1/2 rounded-full bg-[color:var(--accent-12)] blur-3xl" />
        <div className="absolute -bottom-28 right-[-160px] h-96 w-96 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="absolute -bottom-16 left-[-120px] h-72 w-72 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <PlatformLogo size={36} />
                <div className="min-w-0">
                  <h1 className="truncate text-lg sm:text-xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {section === 'patients'
                      ? 'Manage patients and consultations'
                      : section === 'messages'
                        ? 'Messages with your patients'
                        : section === 'documents'
                          ? 'Upload and manage credential documents'
                          : 'Your performance at a glance'}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <ThemeToggleButton />
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
          <div className="grid gap-4 lg:grid-cols-[320px_1fr] lg:items-start">
            <DashboardSidebar
              section={section}
              onSectionChange={setSection}
              onOpenProfile={() => setProfileOpen(true)}
              onOpenNotifications={() => setNotificationsOpen(true)}
              unreadNotifications={unreadNotifications}
              onGoCalendar={() => navigate('/calendar')}
              onLogout={logout}
            />

            <div className="grid gap-4">
              {section === 'patients' && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Your patients</div>
                    <button
                      type="button"
                      onClick={fetchPatients}
                      className="ui-btn-ghost px-3 py-2 text-xs"
                    >
                      Refresh
                    </button>
                  </div>

                  <GlassPanel className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-semibold text-slate-500">
                        {patientsLoading ? 'Loading…' : `${filteredPatients.length} / ${patients.length} shown`}
                      </div>
                      <div className="w-full sm:max-w-sm">
                        <input
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Search by email or status…"
                          className="ui-input"
                        />
                      </div>
                    </div>
                  </GlassPanel>

                  {patientsError && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-800 shadow-sm">
                      {patientsError}
                    </div>
                  )}

                  {(!patientsLoading && patients.length === 0) && (
                    <GlassPanel className="p-10 text-center">
                      <div className="text-sm font-semibold">No patients yet</div>
                      <div className="mt-2 text-sm text-slate-500">
                        When a patient books a consultation, they will appear here.
                      </div>
                    </GlassPanel>
                  )}

                  <div className="grid gap-3">
                    {filteredPatients.map((request) => (
                      <GlassPanel key={request._id} className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex items-start gap-3">
                            <div className="h-12 w-12 overflow-hidden rounded-2xl border border-[color:var(--panel-border)] bg-white/60 shrink-0 shadow-sm">
                              {request?.photo ? (
                                <img
                                  src={toAbsoluteUrl(request.photo)}
                                  alt={request.fullName || request.email}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="grid h-full w-full place-items-center text-sm font-bold text-slate-700">
                                  {(request.fullName || request.email || 'P').slice(0, 2).toUpperCase()}
                                </div>
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-base font-semibold text-slate-900">
                                {request.fullName || request.email}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-slate-500">{request.email}</div>
                            <div className="mt-1 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                              <div>Sessions: <span className="text-slate-800">{request.sessionCount}</span></div>
                              <div>
                                Last activity:{' '}
                                <span className="text-slate-800">
                                  {request.lastSession ? new Date(request.lastSession).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                            </div>
                            <span
                              className={[
                                'mt-3 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                                statusBadge(request.status)
                              ].join(' ')}
                            >
                              {request.status || 'pending'}
                            </span>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2 sm:w-[240px]">
                            <button
                              type="button"
                              className="h-11 ui-btn-primary"
                              onClick={() => navigate(`/patient/${request.patientId?.toString()}`)}
                            >
                              Session and notes
                            </button>
                          </div>
                        </div>
                      </GlassPanel>
                    ))}
                  </div>
                </>
              )}

              {section === 'messages' && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Messages</div>
                    <button
                      type="button"
                      onClick={fetchPatients}
                      className="ui-btn-ghost px-3 py-2 text-xs"
                      disabled={patientsLoading}
                    >
                      {patientsLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  <GlassPanel className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-semibold text-slate-500">
                        {patientsLoading ? 'Loading...' : `${filteredMessagePatients.length} / ${patients.length} shown`}
                      </div>
                      <div className="w-full sm:max-w-sm">
                        <input
                          value={messagesSearch}
                          onChange={(e) => setMessagesSearch(e.target.value)}
                          placeholder="Search patients..."
                          className="ui-input text-sm"
                        />
                      </div>
                    </div>
                  </GlassPanel>

                  {patientsError && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-800 shadow-sm">
                      {patientsError}
                    </div>
                  )}

                  {!patientsLoading && filteredMessagePatients.length === 0 && (
                    <GlassPanel className="p-10 text-center">
                      <div className="text-sm font-semibold">No patients found</div>
                      <div className="mt-2 text-sm text-slate-500">
                        Try adjusting your search.
                      </div>
                    </GlassPanel>
                  )}

                  <div className="grid gap-3">
                    {filteredMessagePatients.map((p) => (
                      <GlassPanel key={String(p.patientId)} className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="truncate text-sm font-semibold text-slate-900">
                                {p.email || p.patientId}
                              </div>
                              <span
                                className={[
                                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                                  statusBadge(p.status)
                                ].join(' ')}
                              >
                                {String(p.status || 'pending')}
                              </span>
                            </div>
                            <div className="mt-1 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                              <div>Sessions: <span className="text-slate-800">{p.sessionCount}</span></div>
                              <div>
                                Last activity:{' '}
                                <span className="text-slate-800">
                                  {p.lastSession ? new Date(p.lastSession).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              className="h-10 ui-btn-ghost"
                              onClick={() => navigate(`/patient/${p.patientId?.toString?.() || p.patientId}`)}
                            >
                              View patient
                            </button>
                            <button
                              type="button"
                              className="h-10 ui-btn-primary"
                              onClick={() => openChatForPatient(p)}
                            >
                              Open chat
                            </button>
                          </div>
                        </div>
                      </GlassPanel>
                    ))}
                  </div>
                </>
              )}

              {section === 'statistics' && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Statistics</div>
                    <button
                      type="button"
                      onClick={fetchStats}
                      className="ui-btn-ghost px-3 py-2 text-xs"
                      disabled={statsLoading}
                    >
                      {statsLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {statsError && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-800 shadow-sm">
                      {statsError}
                    </div>
                  )}

                  {!stats && statsLoading && (
                    <GlassPanel className="p-6">
                      <div className="text-sm text-slate-600">Loading statistics...</div>
                    </GlassPanel>
                  )}

                  {stats && (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        <StatCard label="Total sessions" value={stats.totalSessions || 0} />
                        <StatCard label="Active sessions" value={stats.activeSessions || 0} />
                        <StatCard label="Patients" value={stats.totalPatients || 0} />
                        <StatCard label="Completion rate" value={`${stats.completionRate || 0}%`} hint="Completed / total" />
                        <StatCard label="Completed" value={stats.completedSessions || 0} />
                        <StatCard label="Pending" value={stats.pendingSessions || 0} hint="Awaiting confirmation or payment" />
                        <StatCard
                          label="Average rating"
                          value={Number(stats.averageRating || 0).toFixed(1)}
                          hint={`${stats.totalRatings || 0} ratings`}
                        />
                      </div>

                      <GlassPanel className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">Sessions (last 14 days)</div>
                            <div className="mt-1 text-xs text-slate-500">New sessions created per day</div>
                          </div>
                          <div className="text-xs text-slate-500">
                            Max:{' '}
                            <span className="text-slate-800">
                              {Math.max(0, ...(Array.isArray(stats.sessionsByDay) ? stats.sessionsByDay.map((d) => Number(d.count || 0)) : [0]))}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <AreaLineChart data={stats.sessionsByDay || []} />
                        </div>
                      </GlassPanel>

                      <GlassPanel className="p-5">
                        <div className="text-sm font-semibold text-slate-900">Session breakdown</div>
                        <div className="mt-1 text-xs text-slate-500">Active vs pending vs completed</div>
                        <div className="mt-4">
                          <StackedBar segments={breakdownSegments} />
                        </div>
                      </GlassPanel>
                    </>
                  )}
                </>
              )}

              {section === 'documents' && (
                <>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-slate-900">Credential documents</div>
                    <button
                      type="button"
                      onClick={fetchCredentialDocs}
                      className="ui-btn-ghost px-3 py-2 text-xs"
                      disabled={credentialDocsLoading}
                    >
                      {credentialDocsLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {credentialDocsError && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-800 shadow-sm">
                      {credentialDocsError}
                    </div>
                  )}

                  <GlassPanel className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">Onboarding status</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {onboardingLoading ? 'Loading...' : onboarding?.profileStatus || '—'}
                        </div>
                        {onboarding?.profileStatus === 'Rejected' && onboarding?.rejectionReason && (
                          <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-800">
                            Rejected: {onboarding.rejectionReason}
                          </div>
                        )}
                        {onboarding?.profileStatus === 'Submitted' && (
                          <div className="mt-2 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs text-amber-900">
                            Application submitted and locked for review.
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(onboarding?.profileStatus === 'Draft' || onboarding?.profileStatus === 'Rejected') && (
                          <button
                            type="button"
                            onClick={submitOnboarding}
                            className="h-10 ui-btn-primary"
                          >
                            {onboarding?.profileStatus === 'Rejected' ? 'Resubmit' : 'Submit'}
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassPanel>

                  {(onboarding?.profileStatus === 'Draft' || onboarding?.profileStatus === 'Rejected') && (
                    <GlassPanel className="p-5">
                      <div className="text-sm font-semibold text-slate-900">Upload replacements</div>
                      <div className="mt-1 text-xs text-slate-500">
                        After admin rejection, upload updated documents here, then click <span className="font-semibold">Resubmit</span>.
                      </div>
                      <div className="mt-4 grid gap-3">
                        {[
                          { type: 'cv', label: 'CV (PDF)' , accept: 'application/pdf' },
                          { type: 'diploma', label: 'Diploma (PDF)' , accept: 'application/pdf' },
                          { type: 'idFront', label: 'ID Front (JPG/PNG)', accept: 'image/jpeg,image/png' },
                          { type: 'idBack', label: 'ID Back (JPG/PNG)', accept: 'image/jpeg,image/png' },
                          { type: 'introVideo', label: 'Intro Video (MP4/MOV/WEBM)', accept: 'video/mp4,video/webm,video/quicktime,.mov' }
                        ].map((item) => (
                          <div key={item.type} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[color:var(--panel-border)] bg-white/60 p-4 shadow-sm backdrop-blur">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-slate-900">{item.label}</div>
                              <div className="mt-1 break-all text-xs text-slate-500">
                                {credentialUploadFiles?.[item.type]?.name || 'No file selected'}
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                              <input
                                type="file"
                                accept={item.accept}
                                onChange={(e) => {
                                  const f = e.target.files?.[0] || null;
                                  setCredentialUploadFiles((prev) => ({ ...prev, [item.type]: f }));
                                }}
                                className="block w-full sm:w-auto text-xs text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-900/5 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-900/10"
                              />
                              <button
                                type="button"
                                onClick={() => uploadCredentialDoc(item.type)}
                                disabled={!credentialUploadFiles?.[item.type] || credentialUploadLoading}
                                className="h-10 ui-btn-primary disabled:opacity-50"
                              >
                                {credentialUploadLoading && credentialUploadType === item.type ? 'Uploading...' : 'Upload'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </GlassPanel>
                  )}

                  {!credentialDocsLoading && credentialDocs.length === 0 && (
                    <GlassPanel className="p-10 text-center">
                      <div className="text-sm font-semibold">No documents yet</div>
                      <div className="mt-2 text-sm text-slate-500">
                        Upload your documents during onboarding to submit for verification.
                      </div>
                    </GlassPanel>
                  )}

                  <div className="grid gap-3">
                    {credentialDocs.map((doc) => (
                      <GlassPanel key={doc._id} className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900">
                              {String(doc.type || '').toUpperCase()} <span className="text-slate-400">·</span> v{doc.version}
                            </div>
                            <div className="mt-1 break-all text-xs text-slate-600">{doc.originalName}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              Uploaded: {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openCredentialDoc(doc)}
                              className="h-10 ui-btn-primary"
                            >
                              Open
                            </button>
                          </div>
                        </div>
                      </GlassPanel>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </main>

        <NotificationsDrawer
          open={notificationsOpen}
          onClose={() => {
            setNotificationsOpen(false);
            refreshUnreadNotifications();
          }}
        />

        <PsychologistProfileDrawer
          open={profileOpen}
          onClose={() => setProfileOpen(false)}
          onSaved={() => {
            // Keep drawer open so the user can see the success state; they can close manually.
          }}
        />

        <ConversationDrawer
          open={chatOpen}
          otherUserId={chatPatientId}
          title={chatTitle}
          subtitle={chatSubtitle}
          onClose={() => setChatOpen(false)}
        />
      </div>
    </div>
  );
}

export default Dashboard;
