import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../services/api';

const formatDateTime = (value) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '';
  }
};

export default function NotificationsDrawer({ open, onClose }) {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const unreadCount = useMemo(
    () => (notifications || []).filter((n) => !n.isRead).length,
    [notifications]
  );

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (e) {
      setNotifications([]);
      setError(e.message || 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [fetchNotifications, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, open]);

  const openNotification = async (n) => {
    try {
      if (!n.isRead) await api.put('/api/notifications/' + n._id + '/read', {});
    } catch {}

    if (n.link) navigate(n.link);
    onClose?.();
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read/all', {});
      fetchNotifications();
    } catch (e) {
      setError(e.message || 'Failed to mark all read');
    }
  };

  return (
    <div className={`fixed inset-0 z-[70] ${open ? '' : 'pointer-events-none'}`}>
      <button
        type="button"
        aria-label="Close notifications"
        className={[
          'absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity',
          open ? 'opacity-100' : 'opacity-0'
        ].join(' ')}
        onClick={onClose}
      />

      <aside
        className={[
          'absolute right-0 top-0 h-full w-full max-w-md border-l border-[color:var(--panel-border)] bg-[color:var(--app-bg-85)] shadow-2xl backdrop-blur-xl',
          'transition-transform duration-200',
          open ? 'translate-x-0' : 'translate-x-full'
        ].join(' ')}
        aria-hidden={!open}
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-[color:var(--panel-border)] p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base font-semibold text-[color:var(--app-fg)]">Notifications</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {loading ? 'Loading...' : (unreadCount > 0 ? `${unreadCount} unread` : 'All caught up')}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
              >
                Close
              </button>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                type="button"
                onClick={fetchNotifications}
                className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={markAllRead}
                className="rounded-xl bg-[color:var(--accent-90)] px-3 py-2 text-xs font-semibold text-white hover:brightness-110 transition"
              >
                Mark all read
              </button>
            </div>

            {error && (
              <div className="mt-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-50">
                {error}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {(!loading && notifications.length === 0) && (
              <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
                No notifications yet.
              </div>
            )}

            <div className="flex flex-col gap-3">
              {notifications.map((n) => (
                <button
                  key={n._id}
                  type="button"
                  onClick={() => openNotification(n)}
                  className={[
                    'text-left rounded-3xl border p-4 transition',
                    'bg-white/5 hover:bg-white/10',
                    n.isRead ? 'border-white/10' : 'border-indigo-400/30'
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white">
                        {n.title || 'Notification'}
                      </div>
                      <div className="mt-1 text-sm text-white/70">
                        {n.message}
                      </div>
                    </div>
                    <div className="shrink-0 text-[11px] text-white/50">
                      {formatDateTime(n.createdAt)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

