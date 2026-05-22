import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { logout } from '../services/auth';
import GlassPanel from '../components/dashboard/GlassPanel';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preferences, setPreferences] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();

  const normalizeNotification = useCallback((item) => ({
    ...item,
    id: item?._id || item?.id,
    isRead: Boolean(item?.isRead ?? item?.read),
    timestamp: item?.createdAt || item?.timestamp || new Date().toISOString()
  }), []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/notifications');
      setNotifications(Array.isArray(data) ? data.map(normalizeNotification) : []);
    } catch (err) {
      console.error(err);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [normalizeNotification]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const data = await api.get('/api/notifications/preferences');
        setPreferences(data);
      } catch (err) {
        console.error(err);
      }
    };
    loadPrefs();
  }, []);

  const openNotification = async (n) => {
    try {
      if (!n.isRead && n.id) {
        await api.put(`/api/notifications/${n.id}/read`, {});
        setNotifications((prev) => prev.map((item) => (item.id === n.id ? { ...item, isRead: true } : item)));
      }
    } catch {}

    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read/all', {});
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
    } catch (err) {
      console.error(err);
    }
  };

  const updatePreferences = async (next) => {
    if (!next) return;
    setSaving(true);
    try {
      const data = await api.put('/api/notifications/preferences', next);
      setPreferences(data);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const updatePreferenceField = (field, value) => {
    if (!preferences) return;
    setPreferences((prev) => ({ ...(prev || {}), [field]: value }));
    updatePreferences({ [field]: value });
  };

  const notificationsByFilter = useMemo(() => {
    return notifications.filter((item) => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !item.isRead;
      return String(item.type || 'generic') === filter;
    });
  }, [filter, notifications]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)] flex items-center justify-center">
        <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-6 py-4 text-sm text-[color:var(--app-fg)] shadow-[0_20px_60px_rgba(15,23,42,0.15)] backdrop-blur">
          Loading notifications…
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-0 top-48 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]/80 px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.15)] backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <PlatformLogo size={44} />
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
                Notifications
                <span className={`h-1.5 w-1.5 rounded-full ${unreadCount > 0 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Your notification center</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/60">
                Review recent alerts, open linked pages, and fine-tune delivery preferences.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={markAllRead}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Mark all read
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Back
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="h-10 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 pb-4">
          <div className="mx-auto w-full max-w-4xl space-y-4">
            <GlassPanel className="p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-white/45">Unread</div>
                  <div className="mt-2 text-3xl font-semibold">{unreadCount}</div>
                  <p className="mt-1 text-sm text-white/60">
                    {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'All caught up'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {['all', 'unread', 'session', 'message', 'booking', 'rating', 'system', 'generic'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setFilter(type)}
                      className={`h-9 rounded-xl px-4 text-sm font-semibold transition whitespace-nowrap ${
                        filter === type
                          ? 'bg-indigo-500 text-white'
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            </GlassPanel>

            {preferences && (
              <GlassPanel className="p-5">
                <div className="text-sm font-semibold text-white/90">Notification preferences</div>
                <div className="mt-4 grid gap-3">
                  {[
                    ['inAppEnabled', 'In-app notifications'],
                    ['emailEnabled', 'Email notifications'],
                    ['pushEnabled', 'Push notifications']
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-4 text-sm text-white/70">
                      <span>{label}</span>
                      <input
                        type="checkbox"
                        checked={Boolean(preferences[key])}
                        onChange={(e) => updatePreferenceField(key, e.target.checked)}
                        className="h-4 w-4 accent-indigo-500"
                      />
                    </label>
                  ))}
                  {saving && <div className="text-xs text-white/40">Saving...</div>}
                </div>
              </GlassPanel>
            )}

            <div className="space-y-3">
              {notificationsByFilter.length === 0 ? (
                <GlassPanel className="p-10 text-center text-white/50">
                  No notifications yet.
                </GlassPanel>
              ) : (
                notificationsByFilter.map((notification) => (
                  <GlassPanel
                    key={notification.id}
                    className={`p-5 cursor-pointer transition ${!notification.isRead ? 'border-indigo-500/30 bg-indigo-500/5' : ''}`}
                    onClick={() => openNotification(notification)}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`h-10 w-10 rounded-xl flex items-center justify-center text-lg ${{
                        session: 'bg-indigo-500/20 text-indigo-300',
                        message: 'bg-emerald-500/20 text-emerald-300',
                        booking: 'bg-amber-500/20 text-amber-300',
                        rating: 'bg-fuchsia-500/20 text-fuchsia-300',
                        system: 'bg-white/10 text-white/70',
                        generic: 'bg-white/10 text-white/70'
                      }[notification.type] || 'bg-white/10 text-white/70'}`}>
                        {{
                          session: '📅',
                          message: '💬',
                          booking: '✅',
                          rating: '⭐',
                          system: '🔔',
                          generic: '🔔'
                        }[notification.type] || '🔔'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{notification.title || 'Notification'}</h3>
                          {!notification.isRead && <span className="h-2 w-2 rounded-full bg-indigo-400" />}
                        </div>
                        <p className="mt-1 text-sm text-white/60">{notification.message}</p>
                        <p className="mt-2 text-xs text-white/40">
                          {new Date(notification.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </GlassPanel>
                ))
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
