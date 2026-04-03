import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useTranslation } from 'react-i18next';

const StarRating = ({ rating = 0, total = 0 }) => {
  const stars = [1, 2, 3, 4, 5];
  const rounded = Math.round(Number(rating) || 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {stars.map((s) => (
          <span key={s} className={s <= rounded ? 'text-amber-300 text-sm' : 'text-white/20 text-sm'}>
            *
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

export default function HomePage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
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

      const data = await api.get(url);
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

  const visible = useMemo(() => psychologists.slice(0, 9), [psychologists]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative">
        {/* Top nav */}
        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">{t('navTitle')}</div>
                <div className="mt-1 text-xs text-white/60">{t('navSubtitle')}</div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-2xl border border-white/10 bg-white/5 px-2 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition outline-none rtl:ml-2 ltr:mr-2 cursor-pointer"
                  value={i18n.language}
                  onChange={(e) => i18n.changeLanguage(e.target.value)}
                >
                  <option value="en">EN</option>
                  <option value="fr">FR</option>
                  <option value="ar">AR</option>
                </select>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  {t('login')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="rounded-2xl bg-indigo-500/90 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                >
                  {t('createAccount')}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-10 pb-8 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                {t('badge')}
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
                {t('heroTitle')}
              </h1>
              <p className="mt-4 max-w-xl text-sm sm:text-base text-white/60 leading-relaxed">
                {t('heroSubtitle')}
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="h-11 rounded-2xl bg-emerald-500/90 px-5 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition"
                >
                  {t('getStarted')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/p/psychologist/' + (visible[0]?._id || ''))}
                  disabled={!visible[0]?._id}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                >
                  {t('exploreProfile')}
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { k: t('secure'), v: t('secureText') },
                  { k: t('booking'), v: t('bookingText') },
                  { k: t('insights'), v: t('insightsText') }
                ].map((x) => (
                  <div key={x.k} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <div className="text-sm font-semibold">{x.k}</div>
                    <div className="mt-1 text-xs text-white/60">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <GlassPanel className="p-5 flex flex-col justify-end">
              <div className="text-sm font-semibold">{t('findPsychologist')}</div>
              <div className="mt-1 text-xs text-white/60">{t('liveSearchText')}</div>

              <div className="mt-4 grid gap-3">
                <input
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950/30 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={t('searchPlaceholder')}
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                />
                
                <select
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950/30 px-4 text-sm text-white outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  value={filters.sort}
                  onChange={e => setFilters({ ...filters, sort: e.target.value })}
                >
                  {filters.lat && <option value="distance">{t('sortByDistance')}</option>}
                  <option value="rating">{t('sortByRating')}</option>
                </select>

                <div className="flex gap-2 items-center text-sm font-semibold mt-1">
                  <label className="flex items-center gap-2 cursor-pointer flex-1">
                    <div className="relative inline-block w-10 h-6 shrink-0">
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
                  
                  {useLocation && filters.lat && (
                    <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/30 px-3 text-sm text-white/50 h-[38px] rtl:flex-row-reverse rtl:gap-1">
                      <span>{t('within')}</span>
                      <input
                        type="number"
                        className="w-16 h-8 rounded-xl border border-white/10 bg-transparent px-2 text-center text-white outline-none focus:border-indigo-400/40"
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
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                  {error}
                </div>
              )}
            </GlassPanel>
          </div>
        </section>

        {/* Psychologists grid */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">{t('availablePsychologists')}</h2>
              <p className="mt-1 text-sm text-white/60">{t('browseProfiles')}</p>
            </div>
            
            <div className="mt-4 sm:mt-0 flex gap-2">
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
          </div>

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
                  {visible.map(psy => (
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
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
                <div className="mt-5 h-9 w-full rounded-2xl bg-white/10" />
              </div>
            ))}

            {!loading && visible.map((psy) => {
              const initials = `${psy.firstName?.[0] || ''}${psy.lastName?.[0] || ''}`.toUpperCase() || 'P';
              return (
                <GlassPanel key={psy._id} className="p-5 transition hover:bg-white/10">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
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
                      <div className="mt-3">
                        <StarRating rating={psy.averageRating || 0} total={psy.totalRatings || 0} />
                      </div>
                      <div className="mt-3 text-sm text-white/70 truncate">
                        <span className="text-white/50">{t('languages')}</span>{' '}
                        {Array.isArray(psy.languages) ? psy.languages.join(', ') : (psy.languages || t('notSet'))}
                      </div>
                      <div className="mt-2 text-sm text-white/70 truncate">
                        <span className="text-white/50">{t('specializations')}</span>{' '}
                        {Array.isArray(psy.specializations) ? psy.specializations.slice(0, 3).join(', ') : (psy.specializations || t('notSet'))}
                        {Array.isArray(psy.specializations) && psy.specializations.length > 3 ? '...' : ''}
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/p/psychologist/${psy._id}`)}
                        className="mt-5 h-11 w-full rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
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
            <div className="mt-6 text-center text-sm text-white/60">
              {t('showingTop', { count: visible.length })}
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <footer className="border-t border-white/10 bg-slate-950/40 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">{t('readyToStart')}</div>
                <div className="mt-1 text-sm text-white/60">{t('createAccountToBook')}</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  {t('login')}
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="h-11 rounded-2xl bg-emerald-500/90 px-5 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition"
                >
                  {t('createAccount')}
                </button>
              </div>
            </div>
            <div className="mt-8 text-xs text-white/40">
              {t('footerNote')}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

