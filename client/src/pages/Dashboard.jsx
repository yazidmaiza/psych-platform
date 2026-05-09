import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
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

  const [patients, setPatients] = useState([]);
  const [patientsLoading, setPatientsLoading] = useState(true);
  const [patientsError, setPatientsError] = useState('');

  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState('');

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [profileOpen, setProfileOpen] = useState(false);

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
                <button
                  type="button"
                  onClick={() => setNotificationsOpen(true)}
                  className="relative rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
                >
                  Notifications
                  {unreadNotifications > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center rounded-full bg-indigo-500/90 px-2 py-0.5 text-[11px] font-semibold text-white">
                      {unreadNotifications}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setProfileOpen(true)}
                  className="rounded-2xl bg-[color:var(--accent-90)] px-3 py-2 text-sm font-semibold text-white shadow hover:brightness-110 transition"
                >
                  Edit profile
                </button>
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
                    {patients.map((request) => (
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
