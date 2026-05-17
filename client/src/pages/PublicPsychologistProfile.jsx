import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, toAbsoluteUrl } from '../services/api';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import { useTranslation } from 'react-i18next';

function PublicPsychologistProfile() {
  const [psy, setPsy] = useState(null);
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get(`/api/psychologists/${id}`);
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

  const fullName = `${psy?.firstName || ''} ${psy?.lastName || ''}`.trim() || 'Psychologist';
  const headline = (() => {
    const firstSpec = Array.isArray(psy?.specializations) ? psy.specializations[0] : null;
    if (firstSpec && String(firstSpec).trim()) return `${firstSpec} Specialist`;
    return 'Clinical Psychologist';
  })();

  const ratingText = (() => {
    const average = Number(psy?.averageRating || 0);
    const total = Number(psy?.totalRatings || 0);
    if (average > 0) return `${average.toFixed(1)} (${total || 0} Reviews)`;
    return 'No reviews yet';
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

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body-md antialiased pt-[88px] selection:bg-primary-fixed selection:text-on-primary-fixed">
      <header className="fixed top-0 w-full z-50 bg-surface/70 dark:bg-surface-container/70 backdrop-blur-lg border-b border-white/20 dark:border-white/10 shadow-[0_8px_30px_rgba(27,77,92,0.08)]">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <div className="flex items-center gap-4">
            <button
              aria-label="Back"
              onClick={() => navigate('/')}
              className="text-on-surface-variant hover:text-primary transition-colors flex items-center justify-center p-2 rounded-full hover:bg-secondary-container/50 scale-95 transition-transform duration-200"
              title={t('backToPsychologists')}
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <span className="text-title-md font-title-md font-bold text-primary dark:text-primary-fixed tracking-tight">
              PsychPlatform
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-on-surface-variant dark:text-outline-variant hover:text-primary transition-all duration-300 hover:bg-secondary-container/50 p-2 rounded-full scale-95 transition-transform duration-200" aria-label="Notifications">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <button className="text-on-surface-variant dark:text-outline-variant hover:text-primary transition-all duration-300 hover:bg-secondary-container/50 p-2 rounded-full scale-95 transition-transform duration-200" aria-label="Help">
              <span className="material-symbols-outlined">help_outline</span>
            </button>
            <button
              onClick={() => navigate('/login')}
              className="ml-4 bg-primary text-on-primary font-label-sm text-label-sm px-6 py-2.5 rounded-full hover:shadow-[0_8px_30px_rgba(27,77,92,0.15)] hover:-translate-y-0.5 transition-all duration-300 flex items-center gap-2"
            >
              {t('login')}
            </button>
          </div>
        </div>
      </header>

      <main className="w-full">
        <section className="relative w-full bg-gradient-to-b from-primary-fixed/30 to-surface pt-section-padding pb-section-padding overflow-hidden">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-secondary-fixed/40 rounded-full blur-[120px] -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
          <div className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop relative z-10">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-gutter">
              <div className="relative group">
                <div className="w-40 h-40 md:w-48 md:h-48 rounded-full overflow-hidden border-4 border-surface-container-lowest shadow-[0_8px_30px_rgba(27,77,92,0.12)] bg-surface-container-lowest">
                  {psy?.photo ? (
                    <img
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                      alt={`${fullName} profile`}
                      src={toAbsoluteUrl(psy.photo)}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary-fixed/60 text-primary font-display-lg text-4xl">
                      {(psy?.firstName?.[0] || 'P')}{(psy?.lastName?.[0] || 'P')}
                    </div>
                  )}
                </div>
                <div className="absolute bottom-2 right-2 bg-secondary-container text-on-secondary-container w-10 h-10 rounded-full flex items-center justify-center border-2 border-surface-container-lowest shadow-sm" title={t('verifiedProfessional')}>
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left mt-6 md:mt-4">
                <h1 className="font-display-lg text-display-lg text-primary mb-2">{fullName}</h1>
                <p className="font-title-md text-title-md text-on-surface-variant mb-6">{headline}</p>

                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 mb-8">
                  <div className="flex items-center gap-1.5 text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-full font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1", fontSize: 18 }}>star</span>
                    <span>{ratingText}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-full font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-secondary" style={{ fontSize: 18 }}>schedule</span>
                    <span>{availabilityText}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-on-surface-variant bg-surface-container-low px-3 py-1.5 rounded-full font-label-sm text-label-sm">
                    <span className="material-symbols-outlined text-primary" style={{ fontSize: 18 }}>location_on</span>
                    <span>{psy?.city ? psy.city : t('cityNotProvided')}</span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 justify-center md:justify-start">
                  <button
                    onClick={() => navigate('/register')}
                    className="bg-primary text-on-primary font-label-sm text-label-sm px-8 py-4 rounded-full shadow-[0_8px_30px_rgba(27,77,92,0.15)] hover:shadow-[0_8px_30px_rgba(27,77,92,0.25)] hover:-translate-y-0.5 transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {t('signUpToBook')}
                    <span className="material-symbols-outlined" style={{ fontSize: 20 }}>arrow_forward</span>
                  </button>
                  <button
                    onClick={() => navigate('/login')}
                    className="bg-transparent border border-outline-variant text-primary font-label-sm text-label-sm px-8 py-4 rounded-full hover:bg-surface-container hover:border-outline transition-all duration-300 flex items-center justify-center gap-2"
                  >
                    {t('loginToViewAvailability')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-padding">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div className="glass-card p-8 min-h-[32px] transition-all duration-300 hover:shadow-[0_12px_40px_rgba(27,77,92,0.12)] hover:-translate-y-1">
                <h2 className="font-headline-lg text-headline-lg text-primary mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined text-surface-tint" style={{ fontSize: 32 }}>person_book</span>
                  {t('about')} {psy?.firstName ? psy.firstName : t('thisPsychologist')}
                </h2>
                <div className="font-body-lg text-body-lg text-on-surface-variant space-y-4 leading-relaxed">
                  <p>{psy?.bio && String(psy.bio).trim() ? psy.bio : t('noBio')}</p>
                </div>
              </div>

              <div className="glass-card p-8 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(27,77,92,0.12)] hover:-translate-y-1">
                <h2 className="font-headline-lg text-headline-lg text-primary mb-6 flex items-center gap-3">
                  <span className="material-symbols-outlined text-surface-tint" style={{ fontSize: 32 }}>psychology</span>
                  {t('specializationsTitle')}
                </h2>
                <div className="flex flex-wrap gap-3">
                  {(Array.isArray(psy?.specializations) && psy.specializations.length) ? (
                    psy.specializations.map((s, idx) => (
                      <span
                        key={`${s}-${idx}`}
                        className="bg-secondary-container/30 text-on-secondary-container px-4 py-2 rounded-full font-label-sm text-label-sm border border-secondary-container/50"
                      >
                        {s}
                      </span>
                    ))
                  ) : (
                    <span className="bg-secondary-container/30 text-on-secondary-container px-4 py-2 rounded-full font-label-sm text-label-sm border border-secondary-container/50">
                      {t('notProvided')}
                    </span>
                  )}
                </div>
              </div>

              <div className="glass-card p-8 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(27,77,92,0.12)] hover:-translate-y-1">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="font-headline-lg text-headline-lg text-primary flex items-center gap-3">
                    <span className="material-symbols-outlined text-surface-tint" style={{ fontSize: 32 }}>forum</span>
                    {t('patientReviews')}
                  </h2>
                  <div className="text-right">
                    <div className="font-title-md text-title-md text-primary font-bold">
                      {Number(psy?.averageRating || 0) > 0 ? `${Number(psy.averageRating).toFixed(1)} / 5.0` : '—'}
                    </div>
                    <div className="font-label-sm text-label-sm text-on-surface-variant">
                      {Number(psy?.totalRatings || 0) > 0 ? t('basedOnReviews', { count: psy.totalRatings }) : t('noReviewsYet')}
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-surface-container-lowest/50 rounded-lg p-6 border border-surface-variant/50">
                    <div className="flex items-center gap-1 text-tertiary mb-3">
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
                    <p className="font-body-md text-body-md text-on-surface italic">
                      {t('reviewsPlaceholder')}
                    </p>
                    <p className="font-label-sm text-label-sm text-on-surface-variant mt-4">- PsychPlatform</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col gap-8">
              <div className="glass-card p-6 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(27,77,92,0.12)]">
                <h3 className="font-title-md text-title-md text-primary mb-6 border-b border-surface-variant pb-4">{t('details')}</h3>
                <ul className="space-y-5">
                  <li className="flex items-start gap-4">
                    <div className="bg-primary-container/20 p-2 rounded-full mt-1">
                      <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 20 }}>language</span>
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-primary font-bold">{t('languagesSpoken')}</div>
                      <div className="font-body-md text-body-md text-on-surface-variant">{languagesText}</div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="bg-primary-container/20 p-2 rounded-full mt-1">
                      <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 20 }}>payments</span>
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-primary font-bold">{t('sessionPrice')}</div>
                      <div className="font-body-md text-body-md text-on-surface-variant">
                        {psy?.sessionPrice ? `${psy.sessionPrice} TND` : t('notProvided')}
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="bg-primary-container/20 p-2 rounded-full mt-1">
                      <span className="material-symbols-outlined text-primary-container" style={{ fontSize: 20 }}>calendar_month</span>
                    </div>
                    <div>
                      <div className="font-label-sm text-label-sm text-primary font-bold">{t('availability')}</div>
                      <div className="font-body-md text-body-md text-on-surface-variant">{availabilityText}</div>
                    </div>
                  </li>
                </ul>
              </div>

              <div className="glass-card p-6 transition-all duration-300 hover:shadow-[0_12px_40px_rgba(27,77,92,0.12)]">
                <h3 className="font-title-md text-title-md text-primary mb-4 border-b border-surface-variant pb-4">{t('officeLocation')}</h3>
                <div className="w-full h-48 bg-surface-container-high rounded-lg mb-4 overflow-hidden relative">
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
                    <div className="w-full h-full bg-gradient-to-br from-surface-container-high to-surface-container flex items-center justify-center">
                      <span className="material-symbols-outlined text-primary drop-shadow-md" style={{ fontVariationSettings: "'FILL' 1", fontSize: 40 }}>location_on</span>
                    </div>
                  )}
                </div>
                <div className="flex items-start gap-3 text-on-surface-variant">
                  <span className="material-symbols-outlined mt-1" style={{ fontSize: 20 }}>business</span>
                  <div>
                    <p className="font-body-md text-body-md font-semibold text-primary">{t('clinicName')}</p>
                    <p className="font-body-md text-body-md">{psy?.city ? psy.city : t('cityNotProvided')}</p>
                  </div>
                </div>
                {!mapPosition && (
                  <p className="mt-4 text-on-surface-variant text-sm">
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
