import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import moment from 'moment';

import { api } from '../services/api';
import { logout } from '../services/auth';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import PlatformLogo from '../components/branding/PlatformLogo';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';

const Card = ({ children, className = '' }) => (
  <div
    className={[
      'ui-glass ui-card ui-card-hover p-8 text-[color:var(--app-fg)]',
      className
    ].filter(Boolean).join(' ')}
  >
    {children}
  </div>
);

const BadgeIcon = ({ className = '', children }) => (
  <span className={`material-symbols-outlined p-2 rounded-full ${className}`}>{children}</span>
);

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'SC';
  const first = parts[0]?.[0] || 'S';
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] || 'C') : (parts[0]?.[1] || 'C');
  return (first + last).toUpperCase();
}

function NavTabs({ navigate, t }) {
  const location = useLocation();
  const path = location.pathname || '';
  const isHome = path === '/' || path.startsWith('/home');
  const isDiscovery = path.startsWith('/patient/discovery');
  const isDashboard = path.startsWith('/patient/dashboard') || path === '/patient' || path === '/patient/';
  const isHistory = path.startsWith('/history') || path.startsWith('/patient/history');

  const common = 'px-3 py-1 text-sm font-semibold transition';

  return (
    <div className="flex items-center gap-6">
      <button
        type="button"
        onClick={() => navigate('/')}
        className={`${common} ${isHome ? 'text-[color:var(--app-fg)] border-b-2 border-[color:var(--accent)] pb-1' : 'text-[color:var(--muted)] hover:text-[color:var(--app-fg)]'}`}
      >
        {t('navHome')}
      </button>
      <button
        type="button"
        onClick={() => navigate('/patient/discovery')}
        className={`${common} ${isDiscovery ? 'text-[color:var(--app-fg)] border-b-2 border-[color:var(--accent)] pb-1' : 'text-[color:var(--muted)] hover:text-[color:var(--app-fg)]'}`}
      >
        {t('navDiscovery')}
      </button>
      <button
        type="button"
        onClick={() => navigate('/patient/dashboard')}
        className={`${common} ${isDashboard ? 'text-[color:var(--app-fg)] border-b-2 border-[color:var(--accent)] pb-1' : 'text-[color:var(--muted)] hover:text-[color:var(--app-fg)]'}`}
      >
        {t('navDashboard')}
      </button>
      <button
        type="button"
        onClick={() => navigate('/history')}
        className={`${common} ${isHistory ? 'text-[color:var(--app-fg)] border-b-2 border-[color:var(--accent)] pb-1' : 'text-[color:var(--muted)] hover:text-[color:var(--app-fg)]'}`}
      >
        {t('navHistory')}
      </button>
    </div>
  );
}

export default function PatientDashboard() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const [sessions, setSessions] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [psychologistsByUserId, setPsychologistsByUserId] = useState({});
  const [loading, setLoading] = useState(true);

  const refreshUnreadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/api/notifications/unread-count');
      setUnreadNotifications(Number(data?.count || 0));
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  const fetchDashboard = useCallback(async () => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;

    setLoading(true);
    try {
      const [sessionData, notifData] = await Promise.all([
        api.get('/api/sessions/patient/' + userId),
        api.get('/api/notifications')
      ]);

      const sessionList = Array.isArray(sessionData) ? sessionData : [];
      const notifList = Array.isArray(notifData) ? notifData : [];

      setSessions(sessionList);
      setNotifications(notifList);
      setUnreadNotifications(notifList.filter((n) => !n.isRead).length);

      const uniquePsychologistIds = [...new Set(sessionList.map((s) => String(s?.psychologistId || '')).filter(Boolean))];
      if (uniquePsychologistIds.length) {
        const results = await Promise.all(
          uniquePsychologistIds.map(async (id) => {
            try {
              const psy = await api.get('/api/psychologists/by-user/' + id);
              return [id, psy];
            } catch {
              return [id, null];
            }
          })
        );
        setPsychologistsByUserId(Object.fromEntries(results));
      } else {
        setPsychologistsByUserId({});
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    refreshUnreadNotifications();
  }, [refreshUnreadNotifications]);

  const meName = useMemo(() => {
    const stored = localStorage.getItem('userName');
    if (stored && stored.trim()) return stored.trim();
    return t('patient');
  }, [t]);

  const upcoming = useMemo(() => {
    const now = new Date();
    const candidates = (sessions || []).filter((s) => !['completed', 'canceled'].includes(s.status));
    const withDate = candidates.map((s) => ({
      ...s,
      _sortDate: s.scheduledStart ? new Date(s.scheduledStart) : new Date(s.createdAt || 0)
    }));

    return withDate
      .filter((s) => (s.scheduledStart ? new Date(s.scheduledStart) >= now : true))
      .sort((a, b) => a._sortDate - b._sortDate)
      .slice(0, 2);
  }, [sessions]);

  const nextSession = upcoming[0] || null;

  const sessionsCompleted = useMemo(() => (sessions || []).filter((s) => s.status === 'completed').length, [sessions]);

  const careScore = useMemo(() => {
    const active = (sessions || []).filter((s) => s.status === 'active').length;
    const pending = (sessions || []).filter((s) => ['requested', 'pending', 'pending_payment', 'paid', 'verified'].includes(s.status)).length;
    return Math.min(100, sessionsCompleted * 8 + active * 12 + Math.min(3, pending) * 4);
  }, [sessions, sessionsCompleted]);

  const recentHistory = useMemo(() => {
    return (sessions || [])
      .filter((s) => ['completed', 'canceled'].includes(s.status))
      .slice(0, 2);
  }, [sessions]);

  const recentNotifs = useMemo(() => (notifications || []).slice(0, 3), [notifications]);

  const fmtDay = (d) => {
    if (!d) return '';
    try {
      return moment(d).format('MMM D');
    } catch {
      return '';
    }
  };

  const fmtTime = (d) => {
    if (!d) return '';
    try {
      return moment(d).format('h:mm A');
    } catch {
      return '';
    }
  };

  return (
    <div className="bg-[var(--app-bg)] text-[var(--app-fg)] antialiased min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
                <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-3">
                      <PlatformLogo size={36} />
                      <div className="min-w-0">
                        <h1 className="truncate text-lg sm:text-xl font-semibold tracking-tight text-[color:var(--app-fg)]">
                          {t('mySessions')}
                        </h1>
                        <div className="mt-1 text-xs text-[color:var(--muted)]">
                          Review bookings, continue active sessions, and revisit completed notes.
                        </div>
                      </div>
                    </div>
      
                    <nav className="hidden md:flex items-center justify-center gap-3">
                      <NavTabs navigate={navigate} t={t} />
                    </nav>
      
                    <div className="flex items-center gap-2">
                      <ThemeToggleButton />
      
                      <select
                        className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm outline-none transition hover:brightness-110 cursor-pointer"
                        value={i18n.language}
                        onChange={(e) => i18n.changeLanguage(e.target.value)}
                      >
                        <option value="en">EN</option>
                        <option value="fr">FR</option>
                        <option value="ar">AR</option>
                      </select>
      
                      <button
                        type="button"
                        onClick={() => setNotificationsOpen(true)}
                        className="relative grid h-10 w-10 place-items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] shadow-sm hover:brightness-110 transition"
                        aria-label={t('notifications')}
                        title={t('notifications')}
                      >
                        <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>notifications</span>
                        {unreadNotifications > 0 && (
                          <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-sky-600 px-1 text-[11px] font-bold text-white">
                            {unreadNotifications > 99 ? '99+' : unreadNotifications}
                          </span>
                        )}
                      </button>
      
                      <button
                        type="button"
                        onClick={() => navigate('/patient/profile')}
                        className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] shadow-sm hover:brightness-110 transition"
                        aria-label={t('editProfile')}
                        title={t('editProfile')}
                      >
                        <span className="material-symbols-outlined text-[22px]">account_circle</span>
                      </button>
      
                      <button
                        type="button"
                        onClick={logout}
                        className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:brightness-110 transition"
                      >
                        {t('logout')}
                      </button>
                    </div>
                  </div>
                </div>
              </header>

      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-padding">
        <div className="mb-12" dir={i18n.dir()}>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-[color:var(--app-fg)] mb-2">
            {t('welcomeBackWithName', { name: meName })}
          </h1>
          <p className="font-body-md text-body-md text-[color:var(--muted)]">{t('patientOverview')}</p>
        </div>

        {loading ? (
          <div className="ui-glass px-6 py-4 text-[color:var(--muted)]">{t('loadingDashboard')}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-gutter">
              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-[color:var(--muted)] uppercase tracking-wider">{t('nextSession')}</span>
                  <BadgeIcon className="text-[color:var(--accent)] bg-[color:var(--accent-12)]">calendar_month</BadgeIcon>
                </div>
                <div>
                  <h3 className="font-title-md text-title-md text-[color:var(--app-fg)]">
                    {nextSession?.scheduledStart ? `${moment(nextSession.scheduledStart).format('dddd, h:mm A')}` : t('notScheduled')}
                  </h3>
                  <p className="font-body-md text-body-md text-[color:var(--muted)] mt-1">
                    {nextSession ? (psychologistsByUserId[String(nextSession.psychologistId)] ? `Dr. ${psychologistsByUserId[String(nextSession.psychologistId)]?.firstName || ''} ${psychologistsByUserId[String(nextSession.psychologistId)]?.lastName || ''}`.trim() : t('yourPsychologist')) : '—'}
                  </p>
                </div>
              </Card>

              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-[color:var(--muted)] uppercase tracking-wider">{t('sessionsCompleted')}</span>
                  <BadgeIcon className="text-[color:var(--app-fg)] bg-white/10">check_circle</BadgeIcon>
                </div>
                <div>
                  <h3 className="font-title-md text-title-md text-[color:var(--app-fg)]">{t('sessionsCount', { count: sessionsCompleted })}</h3>
                  <p className="font-body-md text-body-md text-[color:var(--muted)] mt-1">{t('keepItUp')}</p>
                </div>
              </Card>

              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-[color:var(--muted)] uppercase tracking-wider">{t('careScore')}</span>
                  <BadgeIcon className="text-[color:var(--app-fg)] bg-white/10">health_and_safety</BadgeIcon>
                </div>
                <div>
                  <h3 className="font-title-md text-title-md text-[color:var(--app-fg)]">{careScore} / 100</h3>
                  <p className="font-body-md text-body-md text-[color:var(--muted)] mt-1">{t('excellentProgress')}</p>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
              <div className="lg:col-span-2 flex flex-col gap-gutter">
                <section className="bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] backdrop-blur-md border border-[color:var(--panel-border)] p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)]">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-title-md text-title-md text-[color:var(--app-fg)]">{t('upcomingAppointments')}</h2>
                    <button type="button" className="font-label-sm text-label-sm text-[color:var(--accent)] hover:underline" onClick={() => navigate('/history')}>
                      {t('viewAll')}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {upcoming.length === 0 ? (
                      <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-[color:var(--muted)]">
                        {t('noUpcomingAppointments')}
                      </div>
                    ) : (
                      upcoming.map((s) => {
                        const psy = psychologistsByUserId[String(s.psychologistId)];
                        const name = psy ? `Dr. ${psy.firstName || ''} ${psy.lastName || ''}`.trim() : t('yourPsychologist');
                        const initials = getInitials(name);
                        return (
                          <div key={s._id} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10" dir={i18n.dir()}>
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-[color:var(--accent-12)] text-[color:var(--app-fg)] flex items-center justify-center font-title-md text-title-md">
                                {initials}
                              </div>
                              <div>
                                <h4 className="font-title-md text-title-md text-[color:var(--app-fg)]">{name}</h4>
                                <p className="font-body-md text-body-md text-[color:var(--muted)]">{t('sessionStatus', { status: s.status })}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-title-md text-title-md text-[color:var(--app-fg)]">
                                {s.scheduledStart ? fmtDay(s.scheduledStart) : '—'}
                              </p>
                              <p className="font-body-md text-body-md text-[color:var(--muted)]">
                                {s.scheduledStart ? fmtTime(s.scheduledStart) : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] backdrop-blur-md border border-[color:var(--panel-border)] p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)]">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-title-md text-title-md text-[color:var(--app-fg)]">{t('myHistory')}</h2>
                  </div>

                  <div className="relative border-l border-white/10 ml-4 space-y-8 pb-4">
                    {recentHistory.length === 0 ? (
                      <div className="pl-8 text-[color:var(--muted)]">{t('noHistoryYet')}</div>
                    ) : (
                      recentHistory.map((s, idx) => {
                        const psy = psychologistsByUserId[String(s.psychologistId)];
                        const name = psy ? `Dr. ${psy.firstName || ''} ${psy.lastName || ''}`.trim() : t('yourPsychologist');
                        const dotClass = idx === 0 ? 'bg-[color:var(--accent)]' : 'bg-white/30';
                        return (
                          <div key={s._id} className="relative pl-8" dir={i18n.dir()}>
                            <div className={`absolute w-3 h-3 ${dotClass} rounded-full -left-[6.5px] top-1.5 ring-4 ring-[color:var(--app-bg)]`}></div>
                            <h4 className="font-title-md text-title-md text-[color:var(--app-fg)]">{s.status === 'completed' ? t('sessionSummary') : t('sessionUpdate')}</h4>
                            <p className="font-label-sm text-label-sm text-[color:var(--muted)] mb-2">
                              {fmtDay(s.scheduledStart || s.createdAt)} • {name}
                            </p>
                            <p className="font-body-md text-body-md text-[color:var(--muted)]">
                              {s.status === 'completed' ? t('sessionCompletedHint') : t('sessionCanceledHint')}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <div className="lg:col-span-1">
                <aside className="bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] backdrop-blur-md border border-[color:var(--panel-border)] p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)] h-full">
                  <h2 className="font-title-md text-title-md text-[color:var(--app-fg)] mb-6">{t('recentNotifications')}</h2>
                  <div className="space-y-6" dir={i18n.dir()}>
                    {recentNotifs.length === 0 ? (
                      <div className="text-[color:var(--muted)]">{t('noNotificationsYet')}</div>
                    ) : (
                      recentNotifs.map((n) => (
                        <div key={n._id} className="flex gap-4 items-start">
                          <div className="mt-1 bg-[color:var(--accent-12)] text-[color:var(--accent)] p-2 rounded-full">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                          </div>
                          <div>
                            <h5 className="font-label-sm text-label-sm text-[color:var(--app-fg)]">{n.title || t('notification')}</h5>
                            <p className="font-body-md text-body-md text-[color:var(--muted)] mt-1">{n.message || ''}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </aside>
              </div>
            </div>
          </>
        )}
      </main>

      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => {
          setNotificationsOpen(false);
          fetchDashboard();
        }}
      />
    </div>
  );
}
