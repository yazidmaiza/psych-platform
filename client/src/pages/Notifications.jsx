import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await api.get('/api/notifications');
      setNotifications(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const openNotification = async (n) => {
    try {
      if (!n.isRead) await api.put('/api/notifications/' + n._id + '/read', {});
    } catch {}

    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    try {
      await api.put('/api/notifications/read/all', {});
      fetchNotifications();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400">
        Loading...
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
          <h1 className="text-2xl font-bold text-blue-700">Notifications</h1>
            <p className="text-gray-500 text-sm mt-1">
              {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={markAllRead}
              className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-2xl text-sm font-semibold hover:bg-gray-50 transition"
            >
              Mark all read
            </button>
            <button
              onClick={() => navigate(-1)}
              className="text-blue-600 text-sm font-semibold hover:underline"
            >
              {'<- Back'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-3">
        {notifications.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
            No notifications yet.
          </div>
        )}

        {notifications.map(n => (
          <button
            key={n._id}
            onClick={() => openNotification(n)}
            className={`text-left bg-white rounded-2xl shadow p-5 hover:shadow-md transition border ${n.isRead ? 'border-transparent' : 'border-blue-200'}`}
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-gray-800">{n.title || 'Notification'}</p>
                <p className="text-sm text-gray-600 mt-1">{n.message}</p>
              </div>
              <div className="text-xs text-gray-400 whitespace-nowrap">
                {new Date(n.createdAt).toLocaleString()}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
