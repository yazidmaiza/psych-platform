import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, toAbsoluteUrl } from '../services/api';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useTranslation } from 'react-i18next';
import { getUser, isLoggedIn, logout } from '../services/auth';

function PublicPsychologistProfile() {
  const [psy, setPsy] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const detailsRef = useRef(null);
  const isPatientLoggedIn = isLoggedIn() && getUser().role === 'patient';

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.getPublic(`/api/psychologists/${id}`);
        setPsy(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, [id]);

  if (!psy) {
    return (
      <div className="min-h-screen bg-surface text-on-surface font-body-md antialiased flex items-center justify-center">
        <div className="glass-card px-6 py-4 text-on-surface-variant">{t('loading')}...</div>
      </div>
    );
  }

  const fullName = `${psy?.firstName || ''} ${psy?.lastName || ''}`.trim() || 'Mental Health Professional';
  const headline = (() => {
    const firstSpec = Array.isArray(psy?.specializations) ? psy.specializations[0] : null;
    if (firstSpec && String(firstSpec).trim()) return `${firstSpec} Specialist`;
    return 'Licensed Clinical Psychologist';
  })();

  const ratingText = (() => {
    const average = Number(psy?.averageRating || 0);
    const total = Number(psy?.totalRatings || 0);
    if (average > 0) return `${average.toFixed(1)} (${total || 0} reviews)`;
    return 'No verified reviews yet';
  })();

  const availabilityText = (() => {
    const value = psy?.availability;
    if (Array.isArray(value) && value.length) return value.join(', ');
    if (typeof value === 'string' && value.trim()) return value;
    return t('availabilityNotProvided');
  })();

  const languagesText = (() => {
    const value = psy?.languages;
    if (Array.isArray(value) && value.length) return value.join(', ');
    if (typeof value === 'string' && value.trim()) return value;
    return t('notProvided');
  })();

  const mapPosition = (() => {
    const coords = psy?.location?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const [lng, lat] = coords;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
    return [latNum, lngNum];
  })();

  const scrollToDetails = () => {
    detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] font-body-md antialiased pt-[88px] selection:bg-indigo-500/30 selection:text-white">
      <header className="fixed top-0 w-full z-50 bg-black/10 backdrop-blur-xl border-b border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.12)]">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <div className="flex items-center gap-4">
            <button
              aria-label="Back"
              onClick={() => navigate('/')}
              className="text-white/70 hover:text-white transition-colors flex items-center justify-center p-2 rounded-full hover:bg-white/5 scale-95 transition-transform duration-200"
              title={t('backToPsychologists')}
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="text-title-md font-title-md font-bold text-white tracking-tight">
              {t('navTitle')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isLoggedIn() ? (
              <>
                <button
                  onClick={() => navigate('/patient/dashboard')}
                  className="glass-button-secondary px-5 py-2.5 rounded-full transition-all duration-300 flex items-center gap-2"
                >
                  {t('patientDashboard')}
                </button>
                <button
                  onClick={() => navigate('/my-sessions')}
                  className="glass-button-secondary px-5 py-2.5 rounded-full transition-all duration-300 flex items-center gap-2"
                >
                  {t('mySessions')}
                </button>
                <button
                  onClick={() => navigate('/patient/discovery')}
                  className="glass-button-secondary px-5 py-2.5 rounded-full transition-all duration-300 flex items-center gap-2"
                >
                  {t('navDiscovery')}
                </button>
                <button
                  onClick={logout}
                  className="glass-button px-6 py-2.5 rounded-full hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2"
                >
                  {t('logout')}
                </button>
              </>
            ) : null}
            <button className="text-white/70 hover:text-white transition-all duration-300 hover:bg-white/5 p-2 rounded-full scale-95 transition-transform duration-200" aria-label="Help">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
            {!isLoggedIn() && (
              <button
                onClick={() => navigate('/login')}
                className="ml-4 glass-button px-6 py-2.5 rounded-full hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2"
              >
                {t('login')}
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full">
        <section className="relative w-full bg-gradient-to-b from-indigo-500/10 via-transparent to-transparent pt-section-padding pb-section-padding overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-fuchsia-500/15 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-gutter">
              <div className="relative group">
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.2)] bg-white/5">
                  {psy?.photo ? (
                    <img
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      alt={`${fullName} profile`}
                      src={toAbsoluteUrl(psy.photo)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-white/10 text-white font-display-lg text-4xl">
                      {(psy?.firstName?.[0] || 'P')}{(psy?.lastName?.[0] || 'P')}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-2 right-2 bg-emerald-500/20 text-emerald-200 w-10 h-10 rounded-full flex items-center justify-center border-2 border-white/10 shadow-sm" title={t('verifiedProfessional')}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left mt-6 md:mt-4">
                <h1 className="font-display-lg text-display-lg text-white mb-2">{fullName}</h1>
                <p className="font-title-md text-title-md text-white/65 mb-6">{headline}</p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-8">
                  <div className="flex items-center gap-1.5 text-white/70 bg-white/5 px-3 py-1.5 rounded-full font-label-sm text-label-sm border border-white/10">
                    <span className="material-symbols-outlined text-amber-300" style={{ fontVariationSettings: "'FILL' 1", fontSize: 18 }}>star</span>
                    <span>{ratingText}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/70 bg-white/5 px-3 py-1.5 rounded-full font-label-sm text-label-sm border border-white/10">
                    <span className="material-symbols-outlined text-cyan-300" style={{ fontSize: 18 }}>schedule</span>
                    <span>{availabilityText}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-white/70 bg-white/5 px-3 py-1.5 rounded-full font-label-sm text-label-sm border border-white/10">
                    <span className="material-symbols-outlined text-indigo-300" style={{ fontSize: 18 }}>location_on</span>
                    <span>{psy?.city ? psy.city : t('cityNotProvided')}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  {isPatientLoggedIn ? (
                    <>
                      <button
                        onClick={() => navigate(`/session/create/${psy._id}`)}
                        className="glass-button px-8 py-4 rounded-full hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        {t('bookSession')}
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                      </button>
                      <button
                        onClick={scrollToDetails}
                        className="glass-button-secondary px-8 py-4 rounded-full transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        {t('viewAvailability')}
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => navigate('/register')}
                        className="glass-button px-8 py-4 rounded-full hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        {t('signUpToBook')}
                        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                      </button>
                      <button
                        onClick={() => navigate('/login')}
                        className="glass-button-secondary px-8 py-4 rounded-full transition-all duration-300 flex items-center justify-center gap-2"
                      >
                        {t('loginToViewAvailability')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section ref={detailsRef} className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-padding">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div className="glass-card border border-[var(--panel-border)] bg-[var(--panel-bg)] p-8 min-h-[32px] transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] hover:-translate-y-1">
                <h2 className="font-headline-lg text-headline-lg text-white mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--accent)]" style={{ fontSize: 32 }}>person_book</span>
                  {t('about')} {psy?.firstName ? psy.firstName : t('thisPsychologist')}
                </h2>
                <div className="font-body-lg text-body-lg text-white/65 space-y-4 leading-relaxed">
                  <p>{psy?.bio && String(psy.bio).trim() ? psy.bio : t('noBio')}</p>
                </div>
              </div>

              <div className="glass-card border border-[var(--panel-border)] bg-[linear-gradient(135deg,var(--accent-10),var(--panel-bg))] p-8 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] hover:-translate-y-1">
                <h2 className="font-headline-lg text-headline-lg text-white mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[var(--accent)]" style={{ fontSize: 32 }}>psychology</span>
                  {t('specializationsTitle')}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {(Array.isArray(psy?.specializations) && psy.specializations.length) ? (
                    psy.specializations.map((s, idx) => (
                      <span
                        key={`${s}-${idx}`}
                        className="bg-[var(--accent-08)] text-white/85 px-4 py-2 rounded-full font-label-sm text-label-sm border border-[var(--accent-20)]"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="bg-[var(--accent-08)] text-white/65 px-4 py-2 rounded-full font-label-sm text-label-sm border border-[var(--accent-20)]">
                      {t('notProvided')}
                    </span>
                  )}
                </div>
              </div>

              <div className="glass-card border border-[var(--panel-border)] bg-[linear-gradient(135deg,var(--accent-08),var(--panel-bg))] p-8 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)] hover:-translate-y-1">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-headline-lg text-headline-lg text-white flex items-center gap-3">
                    <span className="material-symbols-outlined text-[var(--accent)]" style={{ fontSize: 32 }}>forum</span>
                    {t('patientReviews')}
                  </h2>
                  <div className="text-right">
                    <div className="font-title-md text-title-md text-white font-bold">
                      {Number(psy?.averageRating || 0) > 0 ? `${Number(psy.averageRating).toFixed(1)} / 5.0` : '—'}
                    </div>
                    <div className="font-label-sm text-label-sm text-white/60">
                      {Number(psy?.totalRatings || 0) > 0 ? t('basedOnReviews', { count: psy.totalRatings }) : t('noReviewsYet')}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-[var(--accent-08)] rounded-lg p-6 border border-[var(--accent-20)]">
                    <div className="flex items-center gap-1 text-[var(--accent)] mb-3">
                      {[0, 1, 2, 3, 4].map((i) => (
                        <span
                          key={i}
                          className="material-symbols-outlined"
                          style={{ fontVariationSettings: "'FILL' 1", fontSize: 18 }}
                        >
                          star
                        </span>
                      ))}
                    </div>
                    <p className="font-body-md text-body-md text-white/65 italic">
                      {t('reviewsPlaceholder')}
                    </p>
                    <p className="font-label-sm text-label-sm text-white/45 mt-4">- Psych Platform Team</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-8">
              <div className="glass-card border border-[var(--panel-border)] bg-[var(--panel-bg)] p-6 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
                <h3 className="font-title-md text-title-md text-white mb-6 border-b border-[var(--panel-border)] pb-4">{t('details')}</h3>
                <ul className="space-y-5">
                  <li className="flex items-start gap-4">
                    <div className="bg-[var(--accent-08)] p-2 rounded-full mt-1 border border-[var(--accent-20)]">
                      <span className="material-symbols-outlined text-[var(--accent)]" style={{ fontSize: 20 }}>language</span>
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-white font-bold">{t('languagesSpoken')}</div>
                      <div className="font-body-md text-body-md text-white/65">{languagesText}</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="bg-[var(--accent-08)] p-2 rounded-full mt-1 border border-[var(--accent-20)]">
                      <span className="material-symbols-outlined text-[var(--accent)]" style={{ fontSize: 20 }}>payments</span>
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-white font-bold">{t('sessionPrice')}</div>
                      <div className="font-body-md text-body-md text-white/65">
                        {psy?.sessionPrice ? `${psy.sessionPrice} TND` : t('notProvided')}
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="bg-[var(--accent-08)] p-2 rounded-full mt-1 border border-[var(--accent-20)]">
                      <span className="material-symbols-outlined text-[var(--accent)]" style={{ fontSize: 20 }}>calendar_month</span>
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-white font-bold">{t('availability')}</div>
                      <div className="font-body-md text-body-md text-white/65">{availabilityText}</div>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="glass-card border border-[var(--panel-border)] bg-[linear-gradient(135deg,var(--accent-08),var(--panel-bg))] p-6 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(0,0,0,0.16)]">
                <h3 className="font-title-md text-title-md text-white mb-4 border-b border-[var(--panel-border)] pb-4">{t('officeLocation')}</h3>
                <div className="w-full h-48 bg-[var(--accent-08)] rounded-lg mb-4 overflow-hidden relative border border-[var(--accent-20)]">
                  {mapPosition ? (
                    <MapContainer
                      center={mapPosition}
                      zoom={13}
                      scrollWheelZoom={false}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <Marker position={mapPosition} />
                    </MapContainer>
                  ) : (
                    <div className="w-full h-full bg-[linear-gradient(135deg,var(--accent-08),var(--panel-bg))] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[var(--accent)] drop-shadow-md" style={{ fontVariationSettings: "'FILL' 1", fontSize: 40 }}>location_on</span>
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-3 text-white/65">
                  <span className="material-symbols-outlined mt-1" style={{ fontSize: 20 }}>business</span>
                  <div>
                    <p className="font-body-md text-body-md font-semibold text-white">{t('clinicName')}</p>
                    <p className="font-body-md text-body-md">{psy?.city ? psy.city : t('cityNotProvided')}</p>
                  </div>
                </div>
                {!mapPosition && (
                  <p className="mt-4 text-white/50 text-sm">
                    {t('noMapLocation')}
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default PublicPsychologistProfile;
