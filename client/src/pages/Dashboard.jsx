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

const StatCard = ({ label, value, hint }) => (
  <GlassPanel className="p-5">
    <div className="text-xs font-semibold text-white/60">{label}</div>
    <div className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</div>
    {hint && <div className="mt-1 text-xs text-white/50">{hint}</div>}
  </GlassPanel>
);

function Dashboard() {
  const navigate = useNavigate();

  const [section, setSection] = useState('patients');
  const [patientSearch, setPatientSearch] = useState('');

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
    if (s === 'accepted' || s === 'active') return 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50';
    if (s === 'rejected' || s === 'canceled') return 'border-rose-500/20 bg-rose-500/10 text-rose-50';
    return 'border-amber-500/20 bg-amber-500/10 text-amber-50';
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
      {/* Background (match Session page look) */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <PlatformLogo size={36} />
                <div className="min-w-0">
                  <h1 className="truncate text-lg sm:text-xl font-semibold tracking-tight">Dashboard</h1>
                  <div className="mt-1 text-xs text-[color:var(--muted)]">
                    {section === 'patients' ? 'Manage patients and consultations' : 'Your performance at a glance'}
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
                    <div className="text-sm font-semibold text-white">Your patients</div>
                    <button
                      type="button"
                      onClick={fetchPatients}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                    >
                      Refresh
                    </button>
                  </div>

                  <GlassPanel className="p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-semibold text-white/60">
                        {patientsLoading ? 'Loading…' : `${filteredPatients.length} / ${patients.length} shown`}
                      </div>
                      <div className="w-full sm:max-w-sm">
                        <input
                          value={patientSearch}
                          onChange={(e) => setPatientSearch(e.target.value)}
                          placeholder="Search by email or status…"
                          className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white/80 placeholder:text-white/30"
                        />
                      </div>
                    </div>
                  </GlassPanel>

                  {patientsError && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
                      {patientsError}
                    </div>
                  )}

                  {(!patientsLoading && patients.length === 0) && (
                    <GlassPanel className="p-10 text-center">
                      <div className="text-sm font-semibold">No patients yet</div>
                      <div className="mt-2 text-sm text-white/60">
                        When a patient books a consultation, they will appear here.
                      </div>
                    </GlassPanel>
                  )}

                  <div className="grid gap-3">
                    {filteredPatients.map((request) => (
                      <GlassPanel key={request._id} className="p-5 transition hover:bg-white/10">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold text-white">{request.email}</div>
                            <div className="mt-1 grid gap-1 text-sm text-white/60 sm:grid-cols-2">
                              <div>Sessions: <span className="text-white/80">{request.sessionCount}</span></div>
                              <div>
                                Last activity:{' '}
                                <span className="text-white/80">
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

                          <div className="flex flex-col gap-2 sm:w-[240px]">
                            <button
                              type="button"
                              className="h-11 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                              onClick={() => navigate(`/patient/${request.patientId?.toString()}`)}
                            >
                              Session and notes
                            </button>
                            <button
                              type="button"
                              className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                              onClick={() => navigate(`/history/${request.patientId}`)}
                            >
                              Patient history
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
                    <div className="text-sm font-semibold text-white">Statistics</div>
                    <button
                      type="button"
                      onClick={fetchStats}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                      disabled={statsLoading}
                    >
                      {statsLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {statsError && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
                      {statsError}
                    </div>
                  )}

                  {!stats && statsLoading && (
                    <GlassPanel className="p-6">
                      <div className="text-sm text-white/60">Loading statistics...</div>
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
                            <div className="text-sm font-semibold text-white">Sessions (last 14 days)</div>
                            <div className="mt-1 text-xs text-white/60">New sessions created per day</div>
                          </div>
                          <div className="text-xs text-white/60">
                            Max:{' '}
                            <span className="text-white/80">
                              {Math.max(0, ...(Array.isArray(stats.sessionsByDay) ? stats.sessionsByDay.map((d) => Number(d.count || 0)) : [0]))}
                            </span>
                          </div>
                        </div>
                        <div className="mt-4">
                          <AreaLineChart data={stats.sessionsByDay || []} />
                        </div>
                      </GlassPanel>

                      <GlassPanel className="p-5">
                        <div className="text-sm font-semibold text-white">Session breakdown</div>
                        <div className="mt-1 text-xs text-white/60">Active vs pending vs completed</div>
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
                    <div className="text-sm font-semibold text-white">Credential documents</div>
                    <button
                      type="button"
                      onClick={fetchCredentialDocs}
                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                      disabled={credentialDocsLoading}
                    >
                      {credentialDocsLoading ? 'Refreshing...' : 'Refresh'}
                    </button>
                  </div>

                  {credentialDocsError && (
                    <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
                      {credentialDocsError}
                    </div>
                  )}

                  <GlassPanel className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="text-sm font-semibold text-white">Onboarding status</div>
                        <div className="mt-1 text-xs text-white/60">
                          {onboardingLoading ? 'Loading...' : onboarding?.profileStatus || '—'}
                        </div>
                        {onboarding?.profileStatus === 'Rejected' && onboarding?.rejectionReason && (
                          <div className="mt-2 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-50">
                            Rejected: {onboarding.rejectionReason}
                          </div>
                        )}
                        {onboarding?.profileStatus === 'Submitted' && (
                          <div className="mt-2 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-50">
                            Application submitted and locked for review.
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {(onboarding?.profileStatus === 'Draft' || onboarding?.profileStatus === 'Rejected') && (
                          <button
                            type="button"
                            onClick={submitOnboarding}
                            className="h-10 rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white hover:bg-emerald-500 transition"
                          >
                            {onboarding?.profileStatus === 'Rejected' ? 'Resubmit' : 'Submit'}
                          </button>
                        )}
                      </div>
                    </div>
                  </GlassPanel>

                  {(onboarding?.profileStatus === 'Draft' || onboarding?.profileStatus === 'Rejected') && (
                    <GlassPanel className="p-5">
                      <div className="text-sm font-semibold text-white">Upload replacements</div>
                      <div className="mt-1 text-xs text-white/60">
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
                          <div key={item.type} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white">{item.label}</div>
                              <div className="mt-1 break-all text-xs text-white/50">
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
                                className="block w-full sm:w-auto text-xs text-white/70 file:mr-3 file:rounded-xl file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-white/15"
                              />
                              <button
                                type="button"
                                onClick={() => uploadCredentialDoc(item.type)}
                                disabled={!credentialUploadFiles?.[item.type] || credentialUploadLoading}
                                className="h-10 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-50"
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
                      <div className="mt-2 text-sm text-white/60">
                        Upload your documents during onboarding to submit for verification.
                      </div>
                    </GlassPanel>
                  )}

                  <div className="grid gap-3">
                    {credentialDocs.map((doc) => (
                      <GlassPanel key={doc._id} className="p-5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-white">
                              {String(doc.type || '').toUpperCase()} <span className="text-white/50">·</span> v{doc.version}
                            </div>
                            <div className="mt-1 break-all text-xs text-white/60">{doc.originalName}</div>
                            <div className="mt-1 text-xs text-white/50">
                              Uploaded: {doc.createdAt ? new Date(doc.createdAt).toLocaleString() : '—'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => openCredentialDoc(doc)}
                              className="h-10 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition"
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
      </div>
    </div>
  );
}

export default Dashboard;
