import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import moment from 'moment';

import { api } from '../services/api';
import { logout } from '../services/auth';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white/70 backdrop-blur-md border border-white p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)] hover:shadow-[0_12px_40px_rgba(27,77,92,0.12)] transition-shadow duration-300 ${className}`}>
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
    <div className="bg-background text-on-background antialiased min-h-screen flex flex-col">
      <header className="bg-surface/70 dark:bg-surface-container/70 backdrop-blur-xl top-0 sticky z-50 border-b border-white/20 dark:border-outline-variant/20 shadow-[0_8px_30px_rgba(27,77,92,0.08)]">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <div className="font-display-lg text-title-md font-bold text-primary dark:text-primary-fixed-dim">
            PsychPlatform
          </div>

          <nav className="hidden md:flex gap-8 items-center">
            <button
              type="button"
              onClick={() => navigate('/patient/discovery')}
              className="text-on-surface-variant dark:text-outline hover:text-primary dark:hover:text-primary-fixed-dim transition-colors font-body-md text-body-md"
            >
              {t('navDiscovery')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/patient/dashboard')}
              className="text-primary dark:text-primary-fixed-dim font-bold border-b-2 border-primary dark:border-primary-fixed-dim pb-1 font-body-md text-body-md"
            >
              {t('navDashboard')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-on-surface-variant dark:text-outline hover:text-primary dark:hover:text-primary-fixed-dim transition-colors font-body-md text-body-md"
            >
              {t('navHistory')}
            </button>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggleButton />

            <select
              className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/70 px-2 py-2 text-sm font-semibold text-on-surface hover:brightness-110 transition outline-none cursor-pointer"
              value={i18n.language}
              onChange={(e) => i18n.changeLanguage(e.target.value)}
            >
              <option value="en">EN</option>
              <option value="fr">FR</option>
              <option value="ar">AR</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setNotificationsOpen(true);
                refreshUnreadNotifications();
              }}
              className="relative text-primary dark:text-primary-fixed-dim p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-all duration-300"
              aria-label="Notifications"
              title={t('notifications')}
            >
              <span className="material-symbols-outlined">notifications</span>
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-primary px-1 text-[11px] font-bold text-on-primary">
                  {unreadNotifications > 99 ? '99+' : unreadNotifications}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => navigate('/patient/profile')}
              className="text-primary dark:text-primary-fixed-dim p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-all duration-300"
              aria-label={t('editProfile')}
              title={t('editProfile')}
            >
              <span className="material-symbols-outlined">account_circle</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="ml-1 rounded-2xl bg-error px-4 py-2 text-sm font-semibold text-on-error hover:brightness-110 transition"
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-padding">
        <div className="mb-12" dir={i18n.dir()}>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">
            {t('welcomeBackWithName', { name: meName })}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('patientOverview')}</p>
        </div>

        {loading ? (
          <div className="glass-card px-6 py-4 text-on-surface-variant">{t('loadingDashboard')}</div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mb-gutter">
              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('nextSession')}</span>
                  <BadgeIcon className="text-primary bg-primary-fixed/30">calendar_month</BadgeIcon>
                </div>
                <div>
                  <h3 className="font-title-md text-title-md text-primary">
                    {nextSession?.scheduledStart ? `${moment(nextSession.scheduledStart).format('dddd, h:mm A')}` : t('notScheduled')}
                  </h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">
                    {nextSession ? (psychologistsByUserId[String(nextSession.psychologistId)] ? `Dr. ${psychologistsByUserId[String(nextSession.psychologistId)]?.firstName || ''} ${psychologistsByUserId[String(nextSession.psychologistId)]?.lastName || ''}`.trim() : t('yourPsychologist')) : '—'}
                  </p>
                </div>
              </Card>

              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('sessionsCompleted')}</span>
                  <BadgeIcon className="text-secondary bg-secondary-fixed/30">check_circle</BadgeIcon>
                </div>
                <div>
                  <h3 className="font-title-md text-title-md text-primary">{t('sessionsCount', { count: sessionsCompleted })}</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t('keepItUp')}</p>
                </div>
              </Card>

              <Card className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
                    {t('careScore')}
                    <span className="ml-1 text-[10px] text-on-surface-variant/70" title="Clinical engagement indicator, not a chatbot quality score.">
                      info
                    </span>
                  </span>
                  <BadgeIcon className="text-tertiary-container bg-tertiary-fixed/30">health_and_safety</BadgeIcon>
                </div>
                <div>
                  <h3 className="font-title-md text-title-md text-primary">{careScore} / 100</h3>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t('excellentProgress')}</p>
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter">
              <div className="lg:col-span-2 flex flex-col gap-gutter">
                <section className="bg-white/70 backdrop-blur-md border border-white p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)]">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-title-md text-title-md text-primary">{t('upcomingAppointments')}</h2>
                    <button type="button" className="font-label-sm text-label-sm text-primary hover:underline" onClick={() => navigate('/history')}>
                      {t('viewAll')}
                    </button>
                  </div>

                  <div className="space-y-4">
                    {upcoming.length === 0 ? (
                      <div className="p-4 bg-surface rounded-xl border border-outline-variant/30 text-on-surface-variant">
                        {t('noUpcomingAppointments')}
                      </div>
                    ) : (
                      upcoming.map((s) => {
                        const psy = psychologistsByUserId[String(s.psychologistId)];
                        const name = psy ? `Dr. ${psy.firstName || ''} ${psy.lastName || ''}`.trim() : t('yourPsychologist');
                        const initials = getInitials(name);
                        return (
                          <div key={s._id} className="flex items-center justify-between p-4 bg-surface rounded-xl border border-outline-variant/30" dir={i18n.dir()}>
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-title-md text-title-md">
                                {initials}
                              </div>
                              <div>
                                <h4 className="font-title-md text-title-md text-on-surface">{name}</h4>
                                <p className="font-body-md text-body-md text-on-surface-variant">{t('sessionStatus', { status: s.status })}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="font-title-md text-title-md text-primary">
                                {s.scheduledStart ? fmtDay(s.scheduledStart) : '—'}
                              </p>
                              <p className="font-body-md text-body-md text-on-surface-variant">
                                {s.scheduledStart ? fmtTime(s.scheduledStart) : ''}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="bg-white/70 backdrop-blur-md border border-white p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)]">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-title-md text-title-md text-primary">{t('myHistory')}</h2>
                  </div>

                  <div className="relative border-l border-outline-variant/50 ml-4 space-y-8 pb-4">
                    {recentHistory.length === 0 ? (
                      <div className="pl-8 text-on-surface-variant">{t('noHistoryYet')}</div>
                    ) : (
                      recentHistory.map((s, idx) => {
                        const psy = psychologistsByUserId[String(s.psychologistId)];
                        const name = psy ? `Dr. ${psy.firstName || ''} ${psy.lastName || ''}`.trim() : t('yourPsychologist');
                        const dotClass = idx === 0 ? 'bg-primary' : 'bg-outline';
                        return (
                          <div key={s._id} className="relative pl-8" dir={i18n.dir()}>
                            <div className={`absolute w-3 h-3 ${dotClass} rounded-full -left-[6.5px] top-1.5 ring-4 ring-white`}></div>
                            <h4 className="font-title-md text-title-md text-on-surface">{s.status === 'completed' ? t('sessionSummary') : t('sessionUpdate')}</h4>
                            <p className="font-label-sm text-label-sm text-on-surface-variant mb-2">
                              {fmtDay(s.scheduledStart || s.createdAt)} • {name}
                            </p>
                            <p className="font-body-md text-body-md text-on-surface-variant">
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
                <aside className="bg-white/70 backdrop-blur-md border border-white p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)] h-full">
                  <h2 className="font-title-md text-title-md text-primary mb-6">{t('recentNotifications')}</h2>
                  <div className="space-y-6" dir={i18n.dir()}>
                    {recentNotifs.length === 0 ? (
                      <div className="text-on-surface-variant">{t('noNotificationsYet')}</div>
                    ) : (
                      recentNotifs.map((n) => (
                        <div key={n._id} className="flex gap-4 items-start">
                          <div className="mt-1 bg-primary-container/20 text-primary p-2 rounded-full">
                            <span className="material-symbols-outlined text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>mail</span>
                          </div>
                          <div>
                            <h5 className="font-label-sm text-label-sm text-on-surface">{n.title || t('notification')}</h5>
                            <p className="font-body-md text-body-md text-on-surface-variant mt-1">{n.message || ''}</p>
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

      <footer className="bg-error-container/10 dark:bg-error-container/5 backdrop-blur-md w-full py-8 mt-auto border-t border-error/10 dark:border-error-container/10">
        <div className="flex flex-col md:flex-row justify-between items-center px-margin-mobile md:px-margin-desktop gap-gutter max-w-container-max mx-auto">
          <div className="font-title-md text-error">PsychPlatform</div>
          <div className="flex gap-6">
            <button type="button" className="font-label-sm text-label-sm text-on-surface-variant dark:text-outline hover:text-error dark:hover:text-error-container transition-colors hover:opacity-80 transition-opacity">
              {t('crisisResources')}
            </button>
            <button type="button" className="font-label-sm text-label-sm text-on-surface-variant dark:text-outline hover:text-error dark:hover:text-error-container transition-colors hover:opacity-80 transition-opacity">
              {t('supportCenter')}
            </button>
            <button type="button" className="font-label-sm text-label-sm text-on-surface-variant dark:text-outline hover:text-error dark:hover:text-error-container transition-colors hover:opacity-80 transition-opacity">
              {t('privacyPolicy')}
            </button>
          </div>
          <p className="font-body-md text-body-md text-error dark:text-error-container text-center md:text-right">
            {t('footerCrisisNote')}
          </p>
        </div>
      </footer>

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
