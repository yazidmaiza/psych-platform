import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { logout } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';

const StarRating = ({ rating, total }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {stars.map((star) => (
          <span
            key={star}
            className={`text-sm ${star <= Math.round(rating) ? 'text-amber-300' : 'text-white/20'}`}
          >
            *
          </span>
        ))}
      </div>
      <span className="text-xs text-white/60">
        {rating > 0 ? `${rating.toFixed(1)} (${total})` : 'No ratings yet'}
      </span>
    </div>
  );
};

const Glass = ({ children, className = '' }) => (
  <div className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-sm ${className}`}>
    {children}
  </div>
);

function PsychologistList() {
  const [psychologists, setPsychologists] = useState([]);
  const [filters, setFilters] = useState({ city: '', language: '', specialization: '' });
  const [openPsychologistUserIds, setOpenPsychologistUserIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const navigate = useNavigate();
  const myUserId = localStorage.getItem('userId');
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchPsychologists = useCallback(async () => {
    try {
      setError('');
      const currentFilters = filtersRef.current;
      let url = '/api/psychologists?';
      if (currentFilters.city) url += `city=${currentFilters.city}&`;
      if (currentFilters.language) url += `language=${currentFilters.language}&`;
      if (currentFilters.specialization) url += `specialization=${currentFilters.specialization}&`;

      const data = await api.get(url);
      setPsychologists(Array.isArray(data) ? data : []);
    } catch (err) {
      setPsychologists([]);
      setError(err.message || 'Failed to load psychologists');
    }
  }, []);

  const fetchOpenSessions = useCallback(async () => {
    if (!myUserId) return;
    try {
      const sessions = await api.get('/api/sessions/patient/' + myUserId);
      const open = (Array.isArray(sessions) ? sessions : [])
        .filter(s => !['completed', 'canceled'].includes(s.status))
        .map(s => String(s.psychologistId));
      setOpenPsychologistUserIds(new Set(open));
    } catch (err) {
      setOpenPsychologistUserIds(new Set());
    }
  }, [myUserId]);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      setLoading(true);
      await Promise.all([fetchPsychologists(), fetchOpenSessions()]);
      if (mounted) setLoading(false);
    };
    run();
    return () => { mounted = false; };
  }, [fetchOpenSessions, fetchPsychologists]);

  const refreshUnreadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/api/notifications');
      const list = Array.isArray(data) ? data : [];
      setUnreadNotifications(list.filter(n => !n.isRead).length);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    refreshUnreadNotifications();
  }, [refreshUnreadNotifications]);

  const visiblePsychologists = useMemo(() => {
    return psychologists.filter(psy => {
      const psyUserId = String(psy.userId?._id || psy.userId || '');
      // If there is already an open session with this psychologist, hide them
      return !openPsychologistUserIds.has(psyUserId);
    });
  }, [psychologists, openPsychologistUserIds]);

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
                <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">Patient dashboard</h1>
                <p className="mt-1 text-sm text-white/60">
                  Find a psychologist, book a session, and continue your care.
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  onClick={() => navigate('/history')}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  My Sessions
                </button>
                <button
                  onClick={() => navigate('/calendar')}
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Calendar
                </button>
                <button
                  onClick={() => {
                    setNotificationsOpen(true);
                    refreshUnreadNotifications();
                  }}
                  className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Notifications
                  {unreadNotifications > 0 && (
                    <span className="absolute -right-1 -top-1 grid h-5 min-w-[20px] place-items-center rounded-full bg-indigo-500 px-1 text-[11px] font-bold text-white">
                      {unreadNotifications > 99 ? '99+' : unreadNotifications}
                    </span>
                  )}
                </button>
                <button
                  onClick={logout}
                  className="rounded-xl bg-rose-500/90 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500 transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <Glass className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Search filters</h2>
                <p className="mt-1 text-xs text-white/60">
                  Use one or more filters, then search.
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end">
                <input
                  className="w-full lg:max-w-[220px] rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="City"
                  value={filters.city}
                  onChange={e => setFilters({ ...filters, city: e.target.value })}
                />
                <input
                  className="w-full lg:max-w-[220px] rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Language"
                  value={filters.language}
                  onChange={e => setFilters({ ...filters, language: e.target.value })}
                />
                <input
                  className="w-full lg:max-w-[240px] rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Specialization"
                  value={filters.specialization}
                  onChange={e => setFilters({ ...filters, specialization: e.target.value })}
                />

                <div className="flex gap-2">
                  <button
                    className="h-[46px] rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                    onClick={() => setFilters({ city: '', language: '', specialization: '' })}
                  >
                    Clear
                  </button>
                  <button
                    className="h-[46px] rounded-2xl bg-indigo-500/90 px-5 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                    onClick={fetchPsychologists}
                  >
                    Search
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                {error}
              </div>
            )}
          </Glass>

          <div className="mt-6">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">
                Available psychologists
              </h3>
              <div className="text-xs text-white/60">
                {loading ? 'Loading...' : `${visiblePsychologists.length} shown`}
              </div>
            </div>

            {(!loading && visiblePsychologists.length === 0) && (
              <Glass className="mt-4 p-10 text-center">
                <div className="text-sm font-semibold">No psychologists available</div>
                <p className="mt-2 text-sm text-white/60">
                  Try changing your filters or check back later.
                </p>
              </Glass>
            )}

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {visiblePsychologists.map((psy) => {
                const initials = `${psy.firstName?.[0] || ''}${psy.lastName?.[0] || ''}`.toUpperCase();
                const psychologistUserId = String(psy.userId?._id || psy.userId || '');

                return (
                  <Glass key={psy._id} className="p-5 transition hover:bg-white/10">
                    <div className="flex items-start gap-4">
                      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold text-white">
                        {initials || 'P'}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-base font-semibold">
                              {psy.firstName} {psy.lastName}
                            </div>
                            <div className="mt-1 text-sm text-white/60">
                              {psy.city || 'City not set'}
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                              {psy.sessionPrice ? `${psy.sessionPrice} TND` : 'Price not set'}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <StarRating rating={psy.averageRating || 0} total={psy.totalRatings || 0} />
                        </div>

                        <div className="mt-3 grid gap-2 text-sm text-white/70">
                          <div className="truncate">
                            <span className="text-white/50">Languages:</span>{' '}
                            {Array.isArray(psy.languages) ? psy.languages.join(', ') : (psy.languages || 'Not set')}
                          </div>
                          <div className="truncate">
                            <span className="text-white/50">Specializations:</span>{' '}
                            {Array.isArray(psy.specializations) ? psy.specializations.join(', ') : (psy.specializations || 'Not set')}
                          </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                          <button
                            className="h-[44px] flex-1 rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
                            onClick={() => {
                              if (!psychologistUserId) return;
                              navigate(`/calendar/${psychologistUserId}`);
                            }}
                            disabled={!psychologistUserId}
                          >
                            Book a session
                          </button>
                          <button
                            className="h-[44px] flex-1 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                            onClick={() => navigate(`/psychologist/${psy._id}`)}
                          >
                            View profile
                          </button>
                        </div>
                      </div>
                    </div>
                  </Glass>
                );
              })}
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
      </div>
    </div>
  );
}

export default PsychologistList;
