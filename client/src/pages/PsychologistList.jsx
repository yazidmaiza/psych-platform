import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import { api, toAbsoluteUrl } from '../services/api';
import { logout, isLoggedIn } from '../services/auth';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import GlassPanel from '../components/dashboard/GlassPanel';

const SPECIALTIES = ['Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD', 'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'];

const redIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

function getPsychologistPosition(psychologist) {
  const coords = psychologist?.location?.coordinates;
  if (Array.isArray(coords) && coords.length >= 2) {
    const lng = Number(coords[0]);
    const lat = Number(coords[1]);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  }

  const lat = Number(psychologist?.location?.lat ?? psychologist?.latitude);
  const lng = Number(psychologist?.location?.lng ?? psychologist?.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];

  return null;
}

function getDistanceKm(lat1, lng1, lat2, lng2) {
  if ([lat1, lng1, lat2, lng2].some((value) => !Number.isFinite(Number(value)))) return null;
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

function MapBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) {
      map.setView([36.8065, 10.1815], 7);
      return;
    }

    if (points.length === 1) {
      map.setView(points[0], 10);
      return;
    }

    const bounds = L.latLngBounds(points);
    map.fitBounds(bounds.pad(0.18));
  }, [map, points]);

  return null;
}

const StarRating = ({ rating = 0, total = 0 }) => {
  const stars = [1, 2, 3, 4, 5];
  const rounded = Math.round(Number(rating) || 0);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-0.5">
        {stars.map((star) => (
          <span key={star} className={star <= rounded ? 'text-amber-300 text-xs' : 'text-white/20 text-xs'}>
            ★
          </span>
        ))}
      </div>
      <span className="text-xs text-white/60">
        {Number(total) > 0 ? `${Number(rating || 0).toFixed(1)} (${total})` : 'Not yet rated'}
      </span>
    </div>
  );
};

export default function PsychologistList() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [psychologists, setPsychologists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [selectedSpecialties, setSelectedSpecialties] = useState([]);
  const [priceRange, setPriceRange] = useState(200);
  const [distanceKm, setDistanceKm] = useState(25);
  const [useLocation, setUseLocation] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [location, setLocation] = useState({ lat: null, lng: null });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    const handler = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(handler);
  }, [searchInput]);

  useEffect(() => {
    let watchId;

    if (useLocation) {
      if (!navigator.geolocation) {
        setLocationDenied(true);
        setLocation({ lat: null, lng: null });
        return undefined;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocationDenied(false);
          setLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        () => {
          setLocationDenied(true);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    } else {
      setLocation({ lat: null, lng: null });
      setLocationDenied(false);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [useLocation]);

  const fetchPsychologists = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams();
      params.set('limit', '100');

      if (debouncedSearch) params.set('search', debouncedSearch);
      if (useLocation && location.lat != null && location.lng != null) {
        params.set('lat', String(location.lat));
        params.set('lng', String(location.lng));
        params.set('distance', String(distanceKm));
      }

      const data = await api.get(`/api/psychologists/search?${params.toString()}`);
      setPsychologists(Array.isArray(data) ? data : []);
    } catch (err) {
      setPsychologists([]);
      setError(err.message || 'Unable to load psychologist profiles.');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, distanceKm, location.lat, location.lng, useLocation]);

  useEffect(() => {
    fetchPsychologists();
  }, [fetchPsychologists]);

  const refreshUnreadNotifications = useCallback(async () => {
    try {
      const data = await api.get('/api/notifications');
      const list = Array.isArray(data) ? data : [];
      setUnreadNotifications(list.filter((notification) => !notification.isRead).length);
    } catch {
      setUnreadNotifications(0);
    }
  }, []);

  useEffect(() => {
    refreshUnreadNotifications();
  }, [refreshUnreadNotifications]);

  const filtered = useMemo(() => {
    let result = [...psychologists];

    if (selectedSpecialties.length > 0) {
      result = result.filter((psychologist) =>
        Array.isArray(psychologist.specializations)
          ? psychologist.specializations.some((specialty) => selectedSpecialties.includes(specialty))
          : selectedSpecialties.includes(psychologist.specializations)
      );
    }

    result = result.filter((psychologist) => {
      const price = Number(psychologist.sessionPrice ?? psychologist.hourlyRate ?? psychologist.price ?? 0);
      return price === 0 || price <= priceRange;
    });

    if (sortBy === 'price') {
      result.sort((a, b) => Number(a.sessionPrice ?? a.hourlyRate ?? a.price ?? 0) - Number(b.sessionPrice ?? b.hourlyRate ?? b.price ?? 0));
    } else {
      result.sort((a, b) => Number(b.averageRating || 0) - Number(a.averageRating || 0));
    }

    return result;
  }, [psychologists, selectedSpecialties, sortBy, priceRange]);

  const mapPoints = useMemo(() => {
    const points = filtered.map(getPsychologistPosition).filter(Boolean);
    if (useLocation && location.lat != null && location.lng != null) {
      return [[location.lat, location.lng], ...points];
    }
    return points;
  }, [filtered, location.lat, location.lng, useLocation]);

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-[color:var(--accent-15)] blur-3xl" />
        <div className="absolute -bottom-32 right-1/4 h-96 w-96 rounded-full bg-[color:var(--accent-10)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-40 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <PlatformLogo size={36} />
              <div className="min-w-0">
                <h1 className="truncate text-lg sm:text-xl font-semibold tracking-tight text-[color:var(--app-fg)]">
                  {t('allPsychologists')}
                </h1>
                <div className="mt-1 text-xs text-[color:var(--muted)]">
                  {t('browseAllProfiles')}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <ThemeToggleButton />

              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                className="relative grid h-10 w-10 place-items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] shadow-sm hover:brightness-110 transition"
                aria-label="Notifications"
                title="Notifications"
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
                onClick={logout}
                className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm hover:brightness-110 transition"
              >
                {t('logout')}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8">
          <h2 className="text-3xl font-bold tracking-tight text-[color:var(--app-fg)] sm:text-4xl">
            {t('allPsychologists')}
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[color:var(--muted)]">
            Discover mental health professionals by specialty, session fee, and distance. Map results are synchronized with live backend data.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-[320px_1fr] xl:items-start">
          <GlassPanel className="sticky top-[92px] h-fit p-5 sm:p-6">
            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {t('searchPsychologists')}
              </label>
              <input
                className="ui-input"
                placeholder={t('searchPsychologists')}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {t('sortBy')}
              </label>
              <select className="ui-input" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="rating">{t('sortByRating')}</option>
                <option value="price">{t('sortByPrice')}</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {t('priceRange')}
              </label>
              <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs text-[color:var(--muted)]">
                  <span>50</span>
                  <span>{priceRange} TND</span>
                  <span>200</span>
                </div>
                <input
                  type="range"
                  min="50"
                  max="200"
                  step="10"
                  value={priceRange}
                  onChange={(e) => setPriceRange(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((priceRange - 50) / 150) * 100}%, rgba(148,163,184,0.28) ${((priceRange - 50) / 150) * 100}%, rgba(148,163,184,0.28) 100%)`
                  }}
                />
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                {t('specializations')}
              </label>
              <div className="flex flex-wrap gap-2">
                {SPECIALTIES.map((specialty) => {
                  const active = selectedSpecialties.includes(specialty);
                  return (
                    <button
                      key={specialty}
                      type="button"
                      onClick={() => {
                        setSelectedSpecialties((previous) =>
                          previous.includes(specialty)
                            ? previous.filter((value) => value !== specialty)
                            : [...previous, specialty]
                        );
                      }}
                      className="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--panel-border)',
                        backgroundColor: active ? 'var(--accent-10)' : 'var(--panel-bg)',
                        color: 'var(--app-fg)'
                      }}
                    >
                      {specialty}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3 text-sm font-semibold">
              <span className="min-w-0 whitespace-nowrap text-[color:var(--app-fg)]">{t('useMyLocation')}</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--accent)]"
                checked={useLocation}
                onChange={(e) => setUseLocation(e.target.checked)}
              />
            </label>

            <div className="mt-4 flex items-center gap-3 text-sm text-[color:var(--muted)]">
              {useLocation && locationDenied && (
                <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-700">
                  {t('denied')}
                </span>
              )}
              {useLocation && !locationDenied && location.lat != null && location.lng != null && (
                <span className="rounded-full border border-[color:var(--accent-25)] bg-[color:var(--accent-10)] px-3 py-1 text-xs font-semibold text-[color:var(--app-fg)]">
                  {t('gps')}
                </span>
              )}
            </div>

            {useLocation && (
              <div className="mt-3 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3">
                <div className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
                  <span>{t('within')}</span>
                  <span>{distanceKm} km</span>
                </div>
                <input
                  type="range"
                  min="5"
                  max="100"
                  step="5"
                  value={distanceKm}
                  onChange={(e) => setDistanceKm(Number(e.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full"
                  style={{
                    background: `linear-gradient(to right, var(--accent) 0%, var(--accent) ${((distanceKm - 5) / 95) * 100}%, rgba(148,163,184,0.28) ${((distanceKm - 5) / 95) * 100}%, rgba(148,163,184,0.28) 100%)`
                  }}
                />
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </GlassPanel>

          <div className="space-y-6">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-[color:var(--app-fg)]">{t('availablePsychologists')}</h3>
                <p className="text-sm text-[color:var(--muted)]">
                  {loading ? 'Loading profiles...' : `${filtered.length} professionals available`}
                </p>
              </div>
              <div className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
                {useLocation && location.lat != null && location.lng != null ? 'Sorted by nearest distance' : 'All locations'}
              </div>
            </div>

            <GlassPanel className="overflow-hidden p-0 xl:sticky xl:top-[92px]">
              <div className="border-b border-[color:var(--panel-border)] px-5 py-4 sm:px-6">
                <h2 className="text-sm font-semibold text-[color:var(--app-fg)]">{t('mapView')}</h2>
                <p className="mt-1 text-xs text-[color:var(--muted)]">
                  Explore clinic locations and open each professional profile directly from the map.
                </p>
              </div>

              <div className="h-[500px] w-full">
                <MapContainer center={[36.8065, 10.1815]} zoom={7} scrollWheelZoom={false} className="h-full w-full">
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <MapBounds points={mapPoints} />

                  {useLocation && location.lat != null && location.lng != null && (
                    <Marker position={[location.lat, location.lng]} icon={redIcon}>
                      <Popup>
                        <div className="text-sm font-semibold text-slate-800">{t('youAreHere')}</div>
                      </Popup>
                    </Marker>
                  )}

                  {filtered.map((psychologist) => {
                    const position = getPsychologistPosition(psychologist);
                    if (!position) return null;

                    const distance = useLocation && location.lat != null && location.lng != null
                      ? getDistanceKm(location.lat, location.lng, position[0], position[1])
                      : null;

                    return (
                      <Marker key={psychologist._id} position={position}>
                        <Popup>
                          <div className="space-y-2 text-slate-800">
                            <div className="font-semibold">
                              {psychologist.firstName} {psychologist.lastName}
                            </div>
                            <div className="text-xs text-slate-600">
                              {psychologist.city || t('cityNotSet')}
                              {distance != null && (
                                <span className="mt-1 block font-semibold text-[color:var(--accent)]">
                                  {distance.toFixed(1)} km away
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => isLoggedIn() ? navigate(`/session/create/${psychologist._id}`) : navigate('/register')}
                                className="rounded-xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)]"
                              >
                                {t('bookSession')}
                              </button>

                              <button
                                type="button"
                                onClick={() => navigate(`/p/psychologist/${psychologist._id}`)}
                                className="rounded-xl bg-[color:var(--accent)] px-3 py-2 text-xs font-semibold text-white"
                              >
                                {t('viewProfile')}
                              </button>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </MapContainer>
              </div>
            </GlassPanel>

            <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">
              {loading && Array.from({ length: 4 }).map((_, index) => (
                <GlassPanel key={index} className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-16 w-16 rounded-full bg-white/10" />
                    <div className="min-w-0 flex-1">
                      <div className="h-4 w-2/3 rounded bg-white/10" />
                      <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
                      <div className="mt-4 h-3 w-full rounded bg-white/10" />
                      <div className="mt-4 h-10 w-32 rounded-full bg-white/10" />
                    </div>
                  </div>
                </GlassPanel>
              ))}

              {!loading && filtered.length === 0 && (
                <GlassPanel className="p-8 text-center sm:col-span-2 2xl:col-span-3">
                  <div className="text-3xl">🔍</div>
                  <p className="mt-3 text-sm text-[color:var(--muted)]">{t('noPsychologistsFound')}</p>
                </GlassPanel>
              )}

              {!loading && filtered.map((psychologist) => {
                const photoUrl = toAbsoluteUrl(psychologist.photo);
                const initials = `${psychologist.firstName?.[0] || ''}${psychologist.lastName?.[0] || ''}`.toUpperCase() || 'P';
                const price = Number(psychologist.sessionPrice ?? psychologist.hourlyRate ?? psychologist.price ?? 0);
                const position = getPsychologistPosition(psychologist);
                const distance = useLocation && position && location.lat != null && location.lng != null
                  ? getDistanceKm(location.lat, location.lng, position[0], position[1])
                  : null;

                return (
                  <GlassPanel key={psychologist._id} className="p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]">
                        {photoUrl ? (
                          <img src={photoUrl} alt={`${psychologist.firstName} ${psychologist.lastName}`} className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-sm font-bold text-[color:var(--app-fg)]">
                            {initials}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <h3 className="truncate text-base font-semibold text-[color:var(--app-fg)]">
                              {psychologist.firstName} {psychologist.lastName}
                            </h3>
                            <p className="mt-1 text-xs text-[color:var(--muted)]">{psychologist.city || t('notSet')}</p>
                          </div>

                          <div className="shrink-0 text-right">
                            <div className="text-lg font-bold text-[color:var(--app-fg)]">{price} TND</div>
                            <div className="text-[10px] text-[color:var(--muted)]">/ {t('hour')}</div>
                          </div>
                        </div>

                        <div className="mt-2">
                          <StarRating rating={psychologist.averageRating || 0} total={psychologist.totalRatings || 0} />
                        </div>

                        {distance != null && (
                          <div className="mt-2 text-xs font-semibold text-[color:var(--accent)]">
                            {distance.toFixed(1)} km away
                          </div>
                        )}

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Array.isArray(psychologist.specializations) && psychologist.specializations.slice(0, 3).map((specialty) => (
                            <span
                              key={specialty}
                              className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-2.5 py-0.5 text-[10px] font-medium text-[color:var(--app-fg)]"
                            >
                              {specialty}
                            </span>
                          ))}
                        </div>

                        <p className="mt-3 line-clamp-2 text-xs text-[color:var(--muted)]">
                          {psychologist.bio || t('notSet')}
                        </p>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[color:var(--panel-border)] pt-3">
                          <span className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-fg)]">
                            {psychologist.availability === 'available' ? 'Available' : 'Unavailable'}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => isLoggedIn() ? navigate(`/session/create/${psychologist._id}`) : navigate('/register')}
                              className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-xs font-semibold text-[color:var(--app-fg)]"
                            >
                              {t('bookSession')}
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/p/psychologist/${psychologist._id}`)}
                              className="rounded-full bg-[color:var(--accent)] px-4 py-2 text-xs font-semibold text-white"
                            >
                              {t('viewProfile')}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>
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
  );
}
