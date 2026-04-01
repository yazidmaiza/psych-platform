import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { logout } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';
import moment from 'moment';

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

/* ─── Helpers ───────────────────────────────────────────────────────── */

// Generate 30-min-step start times within [slotStart, slotEnd - minDuration]
// Returns array of Date objects
function generateWindows(slotStart, slotEnd, durationMinutes) {
  const windows = [];
  const stepMs = 30 * 60 * 1000; // 30-min steps
  const durationMs = durationMinutes * 60 * 1000;
  let cursor = new Date(slotStart);
  while (cursor.getTime() + durationMs <= new Date(slotEnd).getTime()) {
    windows.push(new Date(cursor));
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return windows;
}

/* ─── Slot Picker Modal ─────────────────────────────────────────────── */
function SlotPickerModal({ psychologistUserId, psychologistName, sessionPrice, onClose, onBooked }) {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [duration, setDuration] = useState(60); // 60 or 90 minutes
  const [selectedWindow, setSelectedWindow] = useState(null); // { slotId, start: Date }
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.get(`/api/calendar/slots/${psychologistUserId}`);
        const available = (Array.isArray(data) ? data : []).filter(
          s => !s.isBooked && !s.pendingSessionId && new Date(s.end) > new Date()
        );
        setSlots(available);
      } catch (e) {
        setError(e.message || 'Failed to load available slots.');
      } finally {
        setLoading(false);
      }
    })();
  }, [psychologistUserId]);

  // Reset selection when duration changes
  useEffect(() => {
    setSelectedWindow(null);
  }, [duration]);

  // Build all time windows across all slots for the chosen duration
  const allWindows = useMemo(() => {
    const result = [];
    for (const slot of slots) {
      const windows = generateWindows(slot.start, slot.end, duration);
      for (const w of windows) {
        result.push({ slotId: slot._id, start: w });
      }
    }
    return result;
  }, [slots, duration]);

  // Group windows by date for display
  const groupedByDay = useMemo(() => {
    const map = new Map();
    for (const w of allWindows) {
      const key = moment(w.start).format('YYYY-MM-DD');
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(w);
    }
    return [...map.entries()]; // [ [dateKey, [windows...]], ... ]
  }, [allWindows]);

  const handleBook = async () => {
    if (!selectedWindow) return;
    setBooking(true);
    setError('');
    try {
      await api.post(`/api/calendar/slots/${selectedWindow.slotId}/request`, {
        chosenStart: selectedWindow.start.toISOString(),
        chosenDuration: duration
      });
      setSuccess('Booking request sent! The psychologist will confirm shortly.');
      setTimeout(() => {
        onBooked();
        onClose();
      }, 2000);
    } catch (e) {
      setError(e.message || 'Failed to send booking request.');
    } finally {
      setBooking(false);
    }
  };

  const fmtTime = (d) => moment(d).format('HH:mm');
  const endTime = (start) => moment(start).add(duration, 'minutes').format('HH:mm');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative w-full max-w-lg rounded-3xl border border-white/10 bg-slate-950/90 p-6 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-white">Choose a session time</h2>
          <p className="mt-1 text-sm text-white/60">
            With <span className="font-semibold text-white">{psychologistName}</span>
            {sessionPrice > 0 && (
              <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-white/70">
                {sessionPrice} TND
              </span>
            )}
          </p>
        </div>

        {/* Duration selector */}
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2">Session duration</div>
          <div className="flex gap-2">
            {[60, 90].map(d => (
              <button
                key={d}
                type="button"
                onClick={() => setDuration(d)}
                className={[
                  'flex-1 rounded-2xl border py-2.5 text-sm font-semibold transition',
                  duration === d
                    ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                    : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                ].join(' ')}
              >
                {d === 60 ? '1 hour' : '1h 30 min'}
              </button>
            ))}
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {success}
          </div>
        )}

        {/* Time slots grouped by day */}
        <div className="max-h-64 overflow-y-auto pr-1">
          {loading && (
            <div className="py-8 text-center text-sm text-white/50">Loading available times...</div>
          )}
          {!loading && groupedByDay.length === 0 && !error && (
            <div className="py-8 text-center text-sm text-white/50">
              No available slots for this duration right now.
            </div>
          )}

          {!loading && groupedByDay.map(([dayKey, windows]) => (
            <div key={dayKey} className="mb-4">
              {/* Day label */}
              <div className="mb-2 text-xs font-semibold text-white/50 uppercase tracking-wide">
                {moment(dayKey).format('ddd, D MMMM YYYY')}
              </div>
              {/* Time chips grid */}
              <div className="flex flex-wrap gap-2">
                {windows.map((w, i) => {
                  const isSelected =
                    selectedWindow?.slotId === w.slotId &&
                    selectedWindow?.start.getTime() === w.start.getTime();
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setSelectedWindow(w)}
                      className={[
                        'rounded-2xl border px-3 py-2 text-xs font-semibold transition',
                        isSelected
                          ? 'border-indigo-400/40 bg-indigo-500/20 text-white'
                          : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
                      ].join(' ')}
                    >
                      {fmtTime(w.start)} – {endTime(w.start)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Selected summary */}
        {selectedWindow && (
          <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100">
            <span className="font-semibold">Selected:</span>{' '}
            {moment(selectedWindow.start).format('ddd D MMM, HH:mm')} – {endTime(selectedWindow.start)}
            {' '}({duration === 60 ? '1 hour' : '1h 30 min'})
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleBook}
            disabled={!selectedWindow || booking || !!success}
            className="flex-1 rounded-2xl bg-emerald-500/90 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
          >
            {booking ? 'Sending...' : 'Confirm booking'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
function PsychologistList() {
  const [psychologists, setPsychologists] = useState([]);
  const [filters, setFilters] = useState({ city: '', language: '', specialization: '' });
  const [openPsychologistUserIds, setOpenPsychologistUserIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Slot picker modal state
  const [slotPickerTarget, setSlotPickerTarget] = useState(null); // { userId, name, sessionPrice }

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
      return !openPsychologistUserIds.has(psyUserId);
    });
  }, [psychologists, openPsychologistUserIds]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative">
        {/* Header */}
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
          {/* Filters */}
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

          {/* List */}
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
                              {psy.sessionPrice > 0 ? `${psy.sessionPrice} TND` : 'Price not set'}
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
                              setSlotPickerTarget({
                                userId: psychologistUserId,
                                name: `${psy.firstName} ${psy.lastName}`,
                                sessionPrice: psy.sessionPrice || 0
                              });
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

      {/* Slot picker modal */}
      {slotPickerTarget && (
        <SlotPickerModal
          psychologistUserId={slotPickerTarget.userId}
          psychologistName={slotPickerTarget.name}
          sessionPrice={slotPickerTarget.sessionPrice}
          onClose={() => setSlotPickerTarget(null)}
          onBooked={() => {
            setSlotPickerTarget(null);
            fetchOpenSessions();
            fetchPsychologists();
          }}
        />
      )}
    </div>
  );
}

export default PsychologistList;
