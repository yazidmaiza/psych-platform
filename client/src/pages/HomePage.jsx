import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { api, toAbsoluteUrl } from '../services/api';
import GlassPanel from '../components/GlassPanel';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';
import { getUser, isLoggedIn, logout } from '../services/auth';

const StarRating = ({ rating = 0, total = 0 }) => {
  const stars = [1, 2, 3, 4, 5];
  const rounded = Math.round(Number(rating) || 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {stars.map((s) => (
          <span key={s} className={s <= rounded ? 'text-amber-300 text-sm' : 'text-white/20 text-sm'}>
            ★
          </span>
        ))}
      </div>
      <span className="text-xs text-white/60">
        {Number(total) > 0 ? `${Number(rating || 0).toFixed(1)} (${total})` : 'No ratings yet'}
      </span>
    </div>
  );
};

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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

function PatientNavTabs({ navigate, t }) {
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

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const currentRole = isLoggedIn() ? getUser().role : null;
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [psychologists, setPsychologists] = useState([]);
  const [filters, setFilters] = useState({ search: '', distance: 10, lat: null, lng: null, sort: 'rating' });
  const [debouncedFilters, setDebouncedFilters] = useState(filters);
  const [useLocation, setUseLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [viewMode, setViewMode] = useState('list');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

      const data = await api.getPublic(url);
      setPsychologists(Array.isArray(data) ? data : []);
    } catch (e) {
      setPsychologists([]);
      setError(e.message || 'Failed to load psychologists');
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

  useEffect(() => {
    const refreshUnreadNotifications = async () => {
      if (currentRole !== 'patient') {
        setUnreadNotifications(0);
        return;
      }
      try {
        const data = await api.get('/api/notifications/unread-count');
        setUnreadNotifications(Number(data?.count || 0));
      } catch {
        setUnreadNotifications(0);
      }
    };

    refreshUnreadNotifications();
  }, [currentRole]);

  useEffect(() => {
    const elements = Array.from(document.querySelectorAll('[data-reveal]'));
    if (!elements.length) return;

    if (!('IntersectionObserver' in window)) {
      elements.forEach((el) => el.classList.add('is-visible'));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -10% 0px' }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [viewMode, loading, psychologists.length]);

  const visible = useMemo(() => psychologists.slice(0, 9), [psychologists]);

  const renderAuthActions = () => {
    if (!isLoggedIn()) {
      return (
        <>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
          >
            {t('login')}
          </button>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow hover:brightness-110 transition"
          >
            {t('createAccount')}
          </button>
        </>
      );
    }

    if (currentRole === 'psychologist') {
      return (
        <>
          <button
            type="button"
            onClick={() => navigate('/psychologist/dashboard')}
            className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
          >
            Psychologist dashboard
          </button>
          <button
            type="button"
            onClick={() => navigate('/calendar')}
            className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow hover:brightness-110 transition"
          >
            {t('logout')}
          </button>
        </>
      );
    }

    if (currentRole === 'admin') {
      return (
        <>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
          >
            Admin panel
          </button>
          <button
            type="button"
            onClick={() => navigate('/admin/audit')}
            className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
          >
            Audit log
          </button>
          <button
            type="button"
            onClick={logout}
            className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow hover:brightness-110 transition"
          >
            {t('logout')}
          </button>
        </>
      );
    }

    return (
      <>
        <button
          type="button"
          onClick={() => navigate('/patient/dashboard')}
          className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
        >
          {t('patientDashboard')}
        </button>
        <button
          type="button"
          onClick={() => navigate('/my-sessions')}
          className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
        >
          {t('mySessions')}
        </button>
        <button
          type="button"
          onClick={logout}
          className="rounded-2xl bg-[color:var(--accent)] px-3 py-2 text-sm font-semibold text-white shadow hover:brightness-110 transition"
        >
          {t('logout')}
        </button>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="home-float-slow absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[color:var(--accent-15)] blur-3xl" />
        <div className="home-float absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-[color:var(--accent-10)] blur-3xl" />
        <div className="home-float absolute top-32 right-1/3 hidden h-72 w-72 rounded-full bg-[color:var(--accent-08)] blur-3xl lg:block" />
        <div className="absolute inset-0 bg-[var(--app-bg)]" />
      </div>

      <div className="relative">
        {/* Top nav */}
        <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
          {currentRole === 'patient' ? (
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
                  <PatientNavTabs navigate={navigate} t={t} />
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
                    className="relative grid h-10 w-10 place-items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
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
                    className="grid h-10 w-10 place-items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
                    aria-label={t('editProfile')}
                    title={t('editProfile')}
                  >
                    <span className="material-symbols-outlined text-[22px]">account_circle</span>
                  </button>

                  <button
                    type="button"
                    onClick={logout}
                    className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
                  >
                    {t('logout')}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <PlatformLogo size={36} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tracking-tight text-[color:var(--app-fg)]">{t('navTitle')}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">{t('navSubtitle')}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <ThemeToggleButton />
                  <select
                    className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm outline-none transition hover:brightness-110 rtl:ml-2 ltr:mr-2 cursor-pointer"
                    value={i18n.language}
                    onChange={(e) => i18n.changeLanguage(e.target.value)}
                  >
                    <option value="en">EN</option>
                    <option value="fr">FR</option>
                    <option value="ar">AR</option>
                  </select>
                  {renderAuthActions()}
                </div>
              </div>
            </div>
          )}
        </header>

        {/* Hero */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-10 pb-10 sm:px-6 lg:pt-14">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div data-reveal className="reveal inline-flex items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)] shadow-sm backdrop-blur-xl">
                {t('badge')}
              </div>
              <h1 data-reveal className="reveal reveal-d1 mt-4 max-w-3xl text-3xl font-semibold leading-[1.08] tracking-tight text-[color:var(--app-fg)] sm:text-4xl lg:text-5xl">
                {t('heroTitle')}
              </h1>
              <p data-reveal className="reveal reveal-d2 mt-4 max-w-xl text-sm leading-relaxed text-[color:var(--muted)] sm:text-base">
                {t('heroSubtitle')}
              </p>
              <div data-reveal className="reveal reveal-d3 mt-7 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="h-11 rounded-2xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white shadow transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
                >
                  {t('getStarted')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/p/psychologist/' + (visible[0]?._id || ''))}
                  disabled={!visible[0]?._id}
                  className="h-11 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-5 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm backdrop-blur-xl transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
                >
                  {t('exploreProfile')}
                </button>
              </div>

              <div className="mt-9 grid gap-3 sm:grid-cols-3">
                {[
                  { k: t('secure'), v: t('secureText') },
                  { k: t('booking'), v: t('bookingText') },
                  { k: t('insights'), v: t('insightsText') }
                ].map((x, idx) => (
                  <div
                    key={x.k}
                    data-reveal
                    className="reveal rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-4 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(0,0,0,0.22)]"
                    style={{ transitionDelay: `${80 * idx}ms` }}
                  >
                    <div className="text-sm font-semibold text-[color:var(--app-fg)]">{x.k}</div>
                    <div className="mt-1 text-xs text-[color:var(--muted)]">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <GlassPanel data-reveal className="reveal reveal-d4 relative overflow-hidden p-5 shadow-[0_20px_60px_rgba(0,0,0,0.24)] sm:p-6">
              <div className="pointer-events-none absolute -top-16 right-0 h-40 w-40 rounded-full bg-[color:var(--accent-12)] blur-3xl" />
              <div className="pointer-events-none absolute -bottom-20 left-6 h-44 w-44 rounded-full bg-[color:var(--accent-10)] blur-3xl" />

              <div className="relative">
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{t('findPsychologist')}</div>
                <div className="mt-1 text-xs text-[color:var(--muted)]">{t('liveSearchText')}</div>

                <div className="mt-4 grid gap-3">
                  <input
                    className="glass-input w-full transition focus:shadow-[0_0_0_4px_var(--accent-12)]"
                    placeholder={t('search')}
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  />

                  <select
                    className="glass-input w-full cursor-pointer transition focus:shadow-[0_0_0_4px_var(--accent-12)]"
                    value={filters.sort}
                    onChange={e => setFilters({ ...filters, sort: e.target.value })}
                  >
                    {filters.lat && <option value="distance">{t('sortByDistance')}</option>}
                    <option value="rating">{t('sortByRating')}</option>
                  </select>

                  <div className="mt-1 flex items-center gap-2 text-sm font-semibold">
                    <label className="flex flex-1 cursor-pointer items-center gap-2 text-[color:var(--app-fg)] select-none">
                      <div className="relative inline-block h-6 w-10 shrink-0">
                        <input
                          type="checkbox"
                          className="peer sr-only"
                          checked={useLocation}
                          onChange={(e) => setUseLocation(e.target.checked)}
                        />
                        <div className="absolute inset-0 rounded-full bg-[color:var(--panel-border)] transition peer-checked:bg-[color:var(--accent)]" />
                        <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-4" />
                        <div className="absolute inset-0 rounded-full shadow-inner opacity-60" />
                      </div>
                      {t('useMyLocation')}
                    </label>

                    {useLocation && filters.lat && (
                      <div className="flex h-[38px] items-center gap-2 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 text-sm text-[color:var(--muted)] shadow-sm backdrop-blur-xl rtl:flex-row-reverse rtl:gap-1">
                        <span>{t('within')}</span>
                        <input
                          type="number"
                          className="h-8 w-16 rounded-xl border border-[color:var(--panel-border)] bg-transparent px-2 text-center text-[color:var(--app-fg)] outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
                          min="1"
                          value={filters.distance}
                          onChange={e => setFilters(f => ({ ...f, distance: Number(e.target.value) || 1 }))}
                        />
                        <span>{t('km')}</span>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
              </div>
            </GlassPanel>
          </div>
        </section>

        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6">
          <div className="h-px w-full bg-gradient-to-r from-transparent via-[color:var(--accent-25)] to-transparent opacity-70" />
        </div>

        {currentRole === 'patient' && (
          <NotificationsDrawer
            open={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
          />
        )}

        {/* Psychologists grid */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 data-reveal className="reveal text-lg font-semibold tracking-tight text-[color:var(--app-fg)]">{t('availablePsychologists')}</h2>
              <p data-reveal className="reveal reveal-d1 mt-1 text-sm text-[color:var(--muted)]">{t('browseProfiles')}</p>
            </div>
            
            <div data-reveal className="reveal reveal-d2 mt-4 sm:mt-0 flex gap-2">
              <button
                onClick={() => setViewMode('list')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)] ${viewMode === 'list' ? 'bg-[color:var(--accent)] text-white shadow hover:brightness-110' : 'border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--muted)] shadow-sm hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0'}`}
              >
                {t('listView')}
              </button>
              <button
                onClick={() => setViewMode('map')}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)] ${viewMode === 'map' ? 'bg-[color:var(--accent)] text-white shadow hover:brightness-110' : 'border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--muted)] shadow-sm hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0'}`}
              >
                {t('mapView')}
              </button>
            </div>
          </div>

          <div className="mt-4">
            {viewMode === 'map' ? (
              <div data-reveal className="reveal relative z-0 h-[600px] overflow-hidden rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] shadow-[0_18px_55px_rgba(0,0,0,0.22)]">
                {filters.lat && (
                  <button
                    onClick={() => setRecenterTrigger(t => t + 1)}
                    className="absolute bottom-6 left-6 z-[400] rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3 text-sm font-bold text-[color:var(--app-fg)] shadow-lg backdrop-blur transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 rtl:right-6 rtl:left-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
                  >
                    {t('recenterLocation')}
                  </button>
                )}
                {locationDenied && (
                  <div className="absolute top-6 left-1/2 z-[400] w-max max-w-xs -translate-x-1/2 rounded-xl bg-amber-500/90 px-4 py-2 text-center text-sm font-bold text-white shadow-xl">
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
                  {visible.map(psy => (
                    psy.location && psy.location.coordinates ? (
                      <Marker key={psy._id} position={[psy.location.coordinates[1], psy.location.coordinates[0]]}>
                        <Popup>
                          <div className="space-y-2 text-slate-800 rtl:text-right" dir={i18n.dir()}>
                            <div className="font-semibold">
                              {psy.firstName} {psy.lastName}
                            </div>
                            <div className="text-xs text-slate-600">
                              {psy.city || t('cityNotSet')}
                              {useLocation && filters.lat && filters.lng && (
                                <span className="mt-1 block font-semibold text-[color:var(--accent)]">
                                  {t('kmAway', { distance: getDistanceFromLatLonInKm(filters.lat, filters.lng, psy.location.coordinates[1], psy.location.coordinates[0])?.toFixed(1) })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => navigate(`/p/psychologist/${psy._id}`)}
                                className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
                              >
                                {t('viewProfile')}
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    ) : null
                  ))}
                </MapContainer>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} data-reveal className={`reveal rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-5 shadow-sm backdrop-blur-xl ${i < 3 ? `reveal-d${i + 1}` : 'reveal-d4'}`}>
                <div className="home-shimmer h-4 w-2/3 rounded bg-[color:var(--accent-10)]" />
                <div className="home-shimmer mt-3 h-3 w-1/2 rounded bg-[color:var(--accent-10)]" />
                <div className="home-shimmer mt-5 h-9 w-full rounded-2xl bg-[color:var(--accent-10)]" />
              </div>
            ))}

            {!loading && visible.map((psy, idx) => {
              const initials = `${psy.firstName?.[0] || ''}${psy.lastName?.[0] || ''}`.toUpperCase() || 'P';
              const photoUrl = toAbsoluteUrl(psy.photo);
              const revealDelay = Math.min(idx, 5) * 80;
              return (
                <GlassPanel
                  key={psy._id}
                  data-reveal
                  className="reveal p-5 transition hover:brightness-110 hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(0,0,0,0.22)]"
                  style={{ transitionDelay: `${revealDelay}ms` }}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] shadow-sm">
                      {photoUrl ? (
                        <img src={photoUrl} alt={`${psy.firstName} ${psy.lastName}`} className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-sm font-bold text-[color:var(--app-fg)]">
                          {initials}
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold">
                        {psy.firstName} {psy.lastName}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-[color:var(--muted)]">
                        {psy.city || t('notSet')}
                        {useLocation && filters.lat && filters.lng && psy.location?.coordinates && (
                          <span className="font-semibold text-[color:var(--accent)]">
                            | {t('kmAway', { distance: getDistanceFromLatLonInKm(filters.lat, filters.lng, psy.location.coordinates[1], psy.location.coordinates[0])?.toFixed(1) })}
                          </span>
                        )}
                      </div>
                      <div className="mt-3">
                        <StarRating rating={psy.averageRating || 0} total={psy.totalRatings || 0} />
                      </div>
                      <div className="mt-3 truncate text-sm text-[color:var(--muted)]">
                        <span className="text-[color:var(--muted)]">{t('languages')}</span>{' '}
                        {Array.isArray(psy.languages) ? psy.languages.join(', ') : (psy.languages || t('notSet'))}
                      </div>
                      <div className="mt-2 truncate text-sm text-[color:var(--muted)]">
                        <span className="text-[color:var(--muted)]">{t('specializations')}</span>{' '}
                        {Array.isArray(psy.specializations) ? psy.specializations.slice(0, 3).join(', ') : (psy.specializations || t('notSet'))}
                        {Array.isArray(psy.specializations) && psy.specializations.length > 3 ? '...' : ''}
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/p/psychologist/${psy._id}`)}
                        className="mt-5 h-11 w-full rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow transition hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-20)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--app-bg)]"
                      >
                        {t('viewProfile')}
                      </button>
                    </div>
                  </div>
                </GlassPanel>
              );
            })}
              </div>
            )}
          </div>

          {!loading && psychologists.length > visible.length && (
            <div className="mt-6 text-center text-sm text-[color:var(--muted)]">
              {t('showingTop', { count: visible.length })}
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <footer className="border-t border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold text-[color:var(--app-fg)]">{t('readyToStart')}</div>
                <div className="mt-1 text-sm text-[color:var(--muted)]">{t('createAccountToBook')}</div>
              </div>
              <div className="flex gap-2">
                {renderAuthActions()}
              </div>
            </div>
            <div className="mt-8 text-xs text-[color:var(--muted)]/70">
              {t('footerNote')}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
