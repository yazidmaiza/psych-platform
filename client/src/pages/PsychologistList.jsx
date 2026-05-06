import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { logout } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { api, toAbsoluteUrl } from '../services/api';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import moment from 'moment';

const StarRating = ({ rating, total }) => {
  const { t } = useTranslation();
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
        {rating > 0 ? `${rating.toFixed(1)} (${total})` : t('noRatingsYet')}
      </span>
    </div>
  );
};

const Glass = ({ children, className = '' }) => (
  <div className={`rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl shadow-sm ${className}`}>
    {children}
  </div>
);

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function MapEventHandler({ locationDenied, setFilters }) {
  useMapEvents({
    click(e) {
      if (locationDenied) {
        setFilters(f => ({ ...f, lat: e.latlng.lat, lng: e.latlng.lng }));
      }
    }
  });
  return null;
}

function MapCenterControl({ lat, lng, recenterTrigger }) {
  const map = useMap();
  useEffect(() => {
    if (lat && lng && recenterTrigger > 0) {
      map.flyTo([lat, lng], 14, { animate: true });
    }
  }, [lat, lng, recenterTrigger, map]);
  return null;
}

/* ─── Helpers ───────────────────────────────────────────────────────── */

function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

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
  const { t, i18n } = useTranslation();
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
          <h2 className="text-lg font-semibold text-white">{t('chooseSessionTime')}</h2>
          <p className="mt-1 text-sm text-white/60">
            {t('with')} <span className="font-semibold text-white">{psychologistName}</span>
            {sessionPrice > 0 && (
              <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs font-semibold text-white/70">
                {sessionPrice} TND
              </span>
            )}
          </p>
        </div>

        {/* Duration selector */}
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-2 rtl:text-right" dir={i18n.dir()}>{t('sessionDuration')}</div>
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
                {d === 60 ? t('1hour') : t('1h30min')}
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
            <div className="py-8 text-center text-sm text-white/50 rtl:text-right" dir={i18n.dir()}>{t('loadingTimes')}</div>
          )}
          {!loading && groupedByDay.length === 0 && !error && (
            <div className="py-8 text-center text-sm text-white/50 rtl:text-right" dir={i18n.dir()}>
              {t('noSlots')}
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
          <div className="mt-3 rounded-2xl border border-indigo-400/20 bg-indigo-500/10 px-4 py-3 text-sm text-indigo-100 rtl:text-right" dir={i18n.dir()}>
            <span className="font-semibold">{t('selected')}</span>{' '}
            {moment(selectedWindow.start).format('ddd D MMM, HH:mm')} – {endTime(selectedWindow.start)}
            {' '}({duration === 60 ? t('1hour') : t('1h30min')})
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={handleBook}
            disabled={!selectedWindow || booking || !!success}
            className="flex-1 rounded-2xl bg-emerald-500/90 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition disabled:opacity-50"
          >
            {booking ? t('sending') : t('confirmBooking')}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────────────── */
function PsychologistList() {
  const { t, i18n } = useTranslation();
  const [psychologists, setPsychologists] = useState([]);
  const [filters, setFilters] = useState({ search: '', distance: 10, lat: null, lng: null, sort: 'rating' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [viewMode, setViewMode] = useState('map'); // 'list' or 'map'
  const [openPsychologistUserIds, setOpenPsychologistUserIds] = useState(new Set());
  const [useLocation, setUseLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  // Slot picker modal state
  const [slotPickerTarget, setSlotPickerTarget] = useState(null); // { userId, name, sessionPrice }

  const navigate = useNavigate();
  const myUserId = localStorage.getItem('userId');

  // Debounce logic for search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedFilters(filters);
    }, 400); // 400ms debounce
    return () => clearTimeout(handler);
  }, [filters]);

  const fetchPsychologists = useCallback(async (currentFilters) => {
    try {
      setError('');
      
      let url = '/api/psychologists?';
      if (currentFilters.lat && currentFilters.lng) {
        url = `/api/psychologists/nearby?lat=${currentFilters.lat}&lng=${currentFilters.lng}&distance=${currentFilters.distance}&`;
      }
      
      if (currentFilters.search) url += `search=${encodeURIComponent(currentFilters.search)}&`;
      if (currentFilters.sort) url += `sort=${encodeURIComponent(currentFilters.sort)}&`;

      const data = await api.get(url);
      setPsychologists(Array.isArray(data) ? data : []);
    } catch (err) {
      setPsychologists([]);
      setError(err.message || 'Failed to load psychologists');
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchPsychologists(debouncedFilters).then(() => {
      if (mounted) setLoading(false);
    });
    return () => { mounted = false; };
  }, [debouncedFilters, fetchPsychologists]);

  useEffect(() => {
    let watchId;
    if (useLocation) {
      if (!navigator.geolocation) {
        setLocationDenied(true);
        return;
      }
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          setLocationDenied(false);
          setFilters(f => ({ ...f, lat: pos.coords.latitude, lng: pos.coords.longitude }));
        },
        (err) => {
          console.warn('Geolocation error:', err);
          setLocationDenied(true);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setFilters(f => ({ ...f, lat: null, lng: null, sort: f.sort === 'distance' ? 'rating' : f.sort }));
      setLocationDenied(false);
    }
    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [useLocation]);

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
    const run = async () => {
      await fetchOpenSessions();
    };
    run();
  }, [fetchOpenSessions]);

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
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        {/* Header */}
        <div className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3" dir={i18n.dir()}>
                <PlatformLogo size={40} className="mt-0.5" />
                <div className="min-w-0">
                  <h1 className="text-xl sm:text-2xl font-semibold tracking-tight">{t('patientDashboard')}</h1>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    {t('dashboardDesc')}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2" dir={i18n.dir()}>
                 <ThemeToggleButton />
                  <select
                    className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-2 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition outline-none cursor-pointer"
                    value={i18n.language}
                    onChange={(e) => i18n.changeLanguage(e.target.value)}
                  >
                    <option value="en">EN</option>
                    <option value="fr">FR</option>
                    <option value="ar">AR</option>
                  </select>
                <button
                  onClick={() => navigate('/history')}
                  className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
                >
                  {t('mySessions')}
                </button>
                <button
                  onClick={() => {
                    setNotificationsOpen(true);
                    refreshUnreadNotifications();
                  }}
                  className="relative rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  {t('notifications')}
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
                  {t('logout')}
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          {/* Filters */}
          <Glass className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between" dir={i18n.dir()}>
              <div>
                <h2 className="text-sm font-semibold text-white">{t('searchFilters')}</h2>
                <p className="mt-1 text-xs text-white/60">
                  {t('useFiltersThenSearch')}
                </p>
              </div>

              <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-end flex-wrap">
                <input
                  className="w-full lg:max-w-[280px] rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white placeholder:text-white/60 outline-none focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
                  placeholder={t('searchPlaceholder')}
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                />
                
                <select
                  className="rounded-2xl border border-white/10 bg-slate-950/30 px-4 py-3 text-sm text-white outline-none focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
                  value={filters.sort}
                  onChange={e => setFilters({ ...filters, sort: e.target.value })}
                >
                  {filters.lat && <option value="distance">{t('sortByDistance')}</option>}
                  <option value="rating">{t('sortByRating')}</option>
                </select>

                <div className="flex gap-2 items-center">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold rtl:ml-2 ltr:mr-2">
                    <div className="relative inline-block w-10 h-6">
                      <input 
                        type="checkbox" 
                        className="peer sr-only"
                        checked={useLocation}
                        onChange={(e) => setUseLocation(e.target.checked)}
                      />
                      <div className="absolute inset-0 rounded-full bg-white/10 peer-checked:bg-indigo-500 transition"></div>
                      <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4"></div>
                    </div>
                    {t('useMyLocation')}
                  </label>

                  {useLocation && (
                    <div className={`flex h-[46px] items-center rounded-2xl border px-4 text-sm font-semibold ${locationDenied ? 'border-amber-500/50 bg-amber-500/10 text-amber-200' : 'border-emerald-500/50 bg-emerald-500/10 text-emerald-200'}`}>
                      {locationDenied ? '📍 ' + t('denied') : '📍 ' + (filters.lat ? t('gps') : t('locating'))}
                    </div>
                  )}
                  {useLocation && filters.lat && (
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white/50 h-[46px] rtl:flex-row-reverse">
                      <span>{t('within')}</span>
                      <input
                        type="number"
                        className="w-16 h-9 rounded-xl border border-white/10 bg-transparent px-2 text-center text-white outline-none focus:border-indigo-400/40"
                        min="1"
                        value={filters.distance}
                        onChange={e => setFilters(f => ({ ...f, distance: Number(e.target.value) || 1 }))}
                      />
                      <span>{t('km')}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50 rtl:text-right" dir={i18n.dir()}>
                {error}
              </div>
            )}
          </Glass>

          {/* View Toggle */}
          <div className="mt-6 flex gap-2">
            <button
              onClick={() => setViewMode('list')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${viewMode === 'list' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
            >
              {t('listView')}
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${viewMode === 'map' ? 'bg-indigo-500 text-white' : 'bg-white/5 text-white/60 hover:bg-white/10'}`}
            >
              {t('mapView')}
            </button>
          </div>

          {/* Content */}
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3 min-w-0" dir={i18n.dir()}>
              <h3 className="text-sm font-semibold text-white">
                {t('availablePsychologists')}
              </h3>
              <div className="text-xs text-white/60 shrink-0">
                {loading ? '...' : `${visiblePsychologists.length} `}
              </div>
            </div>

            {(!loading && visiblePsychologists.length === 0) && (
              <Glass className="mt-4 p-10 text-center rtl:text-right" dir={i18n.dir()}>
                <div className="text-sm font-semibold">{t('noPsychologists')}</div>
                <p className="mt-2 text-sm text-white/60">
                  {t('changeFilters')}
                </p>
              </Glass>
            )}

            <div className="mt-4">
              {viewMode === 'map' ? (
                <div className="h-[600px] rounded-3xl overflow-hidden border border-white/10 relative z-0">
                  {filters.lat && (
                    <button
                      onClick={() => setRecenterTrigger(t => t + 1)}
                      className="absolute bottom-6 left-6 z-[400] rounded-xl bg-slate-900/90 backdrop-blur border border-white/20 px-4 py-3 text-sm font-bold text-white shadow-xl hover:bg-slate-800 transition rtl:right-6 rtl:left-auto"
                    >
                      {t('recenterLocation')}
                    </button>
                  )}
                  {locationDenied && (
                    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] rounded-xl bg-amber-500/90 px-4 py-2 text-sm font-bold text-white shadow-xl text-center w-max max-w-xs">
                      {t('deniedLocation')}
                    </div>
                  )}

                  <MapContainer center={filters.lat ? [filters.lat, filters.lng] : [36.8065, 10.1815]} zoom={13} className="h-full w-full bg-slate-800">
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    
                    <MapEventHandler locationDenied={locationDenied} setFilters={setFilters} />
                    <MapCenterControl lat={filters.lat} lng={filters.lng} recenterTrigger={recenterTrigger} />

                    {filters.lat && (
                      <Marker position={[filters.lat, filters.lng]} icon={redIcon}>
                        <Popup><b className="text-slate-800">{t('youAreHere')}</b></Popup>
                      </Marker>
                    )}
                    {visiblePsychologists.map(psy => (
                      psy.location && psy.location.coordinates ? (
                        <Marker key={psy._id} position={[psy.location.coordinates[1], psy.location.coordinates[0]]}>
                          <Popup>
                            <div className="font-semibold text-slate-800 rtl:text-right" dir={i18n.dir()}>{psy.firstName} {psy.lastName}</div>
                            <div className="text-xs text-slate-600 mt-1 rtl:text-right" dir={i18n.dir()}>
                              {psy.city || t('cityNotSet')}
                              {useLocation && filters.lat && filters.lng && (
                                <span className="block mt-1 font-semibold text-indigo-600">
                                  {t('kmAway', { distance: getDistanceFromLatLonInKm(filters.lat, filters.lng, psy.location.coordinates[1], psy.location.coordinates[0])?.toFixed(1) })}
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-bold text-emerald-600 mt-1 rtl:text-right" dir={i18n.dir()}>
                              {psy.sessionPrice ? `${psy.sessionPrice} TND` : ''}
                            </div>
                            <button
                              onClick={() => navigate(`/p/psychologist/${psy._id}`)}
                              className="mt-2 text-indigo-600 underline text-xs w-full rtl:text-right" dir={i18n.dir()}
                            >
                              {t('viewProfile')}
                            </button>
                          </Popup>
                        </Marker>
                      ) : null
                    ))}
                  </MapContainer>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {visiblePsychologists.map((psy) => {
                    const initials = `${psy.firstName?.[0] || ''}${psy.lastName?.[0] || ''}`.toUpperCase();
                    const psychologistUserId = String(psy.userId?._id || psy.userId || '');
                    const photoUrl = toAbsoluteUrl(psy.photo);

                    return (
                      <Glass key={psy._id} className="p-5 transition hover:bg-white/10">
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                            {photoUrl ? (
                              <img src={photoUrl} alt={`${psy.firstName} ${psy.lastName}`} className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-sm font-bold text-white">
                                {initials || 'P'}
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0" dir={i18n.dir()}>
                                <div className="truncate text-base font-semibold">
                                  {psy.firstName} {psy.lastName}
                                </div>
                                <div className="mt-1 text-sm text-white/60 flex flex-wrap gap-1 items-center">
                                  {psy.city || t('notSet')}
                                  {useLocation && filters.lat && filters.lng && psy.location?.coordinates && (
                                    <span className="font-semibold text-indigo-400">
                                      | {t('kmAway', { distance: getDistanceFromLatLonInKm(filters.lat, filters.lng, psy.location.coordinates[1], psy.location.coordinates[0])?.toFixed(1) })}
                                    </span>
                                  )}
                                </div>
                              </div>

                              <div className="shrink-0 text-right rtl:text-left">
                                <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                                  {psy.sessionPrice > 0 ? `${psy.sessionPrice} TND` : t('priceNotSet')}
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 flex" dir={i18n.dir()}>
                              <StarRating rating={psy.averageRating || 0} total={psy.totalRatings || 0} />
                            </div>

                            <div className="mt-3 grid gap-2 text-sm text-white/70" dir={i18n.dir()}>
                              <div className="truncate">
                                <span className="text-white/50">{t('languages')}</span>{' '}
                                {Array.isArray(psy.languages) ? psy.languages.join(', ') : (psy.languages || t('notSet'))}
                              </div>
                              <div className="truncate">
                                <span className="text-white/50">{t('specializations')}</span>{' '}
                                {Array.isArray(psy.specializations) ? psy.specializations.join(', ') : (psy.specializations || t('notSet'))}
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
                                {t('bookSession')}
                              </button>
                              <button
                                className="h-[44px] flex-1 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                                onClick={() => navigate(`/p/psychologist/${psy._id}`)}
                              >
                                {t('viewProfile')}
                              </button>
                            </div>
                          </div>
                        </div>
                      </Glass>
                    );
                  })}
                </div>
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
