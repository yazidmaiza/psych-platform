import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

const SPECIALIZATIONS = ['Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD', 'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'];
const LANGUAGES = ['Arabic', 'French', 'English', 'Darija'];

const STEPS = [
  { id: 1, label: 'personalInfo' },
  { id: 2, label: 'locationAvailability' },
  { id: 3, label: 'specializationsLanguages' },
  { id: 4, label: 'documents' },
];

export default function PsychologistSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    city: '',
    country: '',
    specializations: [],
    languages: [],
    hourlyRate: '',
    documents: { cv: null, diploma: null, idFront: null, idBack: null, video: null },
  });
  const [previews, setPreviews] = useState({});
  const [hydrating, setHydrating] = useState(true);

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      setHydrating(true);
      try {
        const me = await api.get('/api/psychologists/me');
        if (!mounted) return;
        setFormData((prev) => ({
          ...prev,
          firstName: me?.firstName || '',
          lastName: me?.lastName || '',
          bio: me?.bio || '',
          city: me?.city || '',
          country: me?.country || '',
          specializations: Array.isArray(me?.specializations) ? me.specializations : [],
          languages: Array.isArray(me?.languages) ? me.languages : [],
          hourlyRate: me?.sessionPrice != null ? String(me.sessionPrice) : '',
        }));
      } catch (e) {
        try {
          const userId = localStorage.getItem('userId');
          if (!userId) throw e;
          const byUser = await api.get('/api/psychologists/by-user/' + userId);
          if (!mounted) return;
          setFormData((prev) => ({
            ...prev,
            firstName: byUser?.firstName || '',
            lastName: byUser?.lastName || '',
            bio: byUser?.bio || '',
            city: byUser?.city || '',
            country: byUser?.country || '',
            specializations: Array.isArray(byUser?.specializations) ? byUser.specializations : [],
            languages: Array.isArray(byUser?.languages) ? byUser.languages : [],
            hourlyRate: byUser?.sessionPrice != null ? String(byUser.sessionPrice) : '',
          }));
        } catch {
          // ignore hydration errors; user can still fill manually
        }
      } finally {
        if (mounted) setHydrating(false);
      }
    };

    hydrate();
    return () => {
      mounted = false;
    };
  }, []);

  const toggleSpecialization = (spec) => {
    setFormData(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec]
    }));
  };

  const toggleLanguage = (lang) => {
    setFormData(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
  };

  const handleFileUpload = (type, file) => {
    if (!file) return;
    setFormData(prev => ({ ...prev, documents: { ...prev.documents, [type]: file } }));
    if (file.type?.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews(p => ({ ...p, [type]: e.target.result }));
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await api.put('/api/psychologists/me', {
        firstName: formData.firstName,
        lastName: formData.lastName,
        bio: formData.bio,
        city: formData.city,
        country: formData.country,
        specializations: formData.specializations,
        languages: formData.languages,
        sessionPrice: formData.hourlyRate ? Number(formData.hourlyRate) : 0,
      });

      const fd = new FormData();
      fd.append('cv', formData.documents.cv);
      fd.append('diploma', formData.documents.diploma);
      fd.append('idFront', formData.documents.idFront);
      fd.append('idBack', formData.documents.idBack);
      if (formData.documents.video) fd.append('introVideo', formData.documents.video);

      await api.postForm('/api/verification/upload', fd);
      navigate('/psychologist/dashboard');
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const canProceed = () => {
    if (step === 1) return formData.firstName && formData.lastName && formData.bio;
    if (step === 2) return formData.city && formData.country;
    if (step === 3) return formData.specializations.length > 0 && formData.languages.length > 0;
    if (step === 4) return formData.documents.cv && formData.documents.diploma && formData.documents.idFront && formData.documents.idBack && formData.documents.video;
    return false;
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        {hydrating && (
          <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
            Loading your saved setup…
          </div>
        )}
        <div className="mb-8">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight text-white">{t('psychologistSetup')}</h1>
              <p className="mt-1 text-sm text-white/60">{t('completeSetup')} {t('to')} {t('continue')}</p>
            </div>
            <span className="text-sm text-white/60">{t('step')} {step} {t('of')} {STEPS.length}</span>
          </div>
          <div className="mt-5 rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
            <div className="flex gap-2">
            {STEPS.map(s => (
              <div key={s.id} className="flex-1">
                <div className={`h-2 rounded-full transition-all ${
                  s.id < step ? 'bg-emerald-500' : s.id === step ? 'bg-indigo-500' : 'bg-white/10'
                }`} />
              </div>
            ))}
            </div>
            <div className="mt-3 flex justify-between gap-2">
              {STEPS.map(s => (
                <span key={s.id} className={`text-[10px] font-semibold uppercase tracking-wide ${
                  s.id <= step ? 'text-indigo-300' : 'text-white/30'
                }`}>
                  {t(s.label)}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <h2 className="text-lg font-semibold text-white mb-1">{t('personalInformation')}</h2>
              <p className="mb-4 text-sm text-white/50">{t('shareYourBackground')}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">{t('firstName')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.firstName}
                    onChange={e => updateField('firstName', e.target.value)}
                    placeholder={t('firstNamePlaceholder')}
                  />
                </div>
                <div>
                  <label className="form-label">{t('lastName')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.lastName}
                    onChange={e => updateField('lastName', e.target.value)}
                    placeholder={t('lastNamePlaceholder')}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="form-label">{t('bio')}</label>
                <textarea
                  className="glass-input w-full min-h-[120px] resize-none"
                  value={formData.bio}
                  onChange={e => updateField('bio', e.target.value)}
                  placeholder={t('bioPlaceholder')}
                />
              </div>
            </GlassPanel>
          </div>
        )}

        {/* Step 2: Location & Availability */}
        {step === 2 && (
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <h2 className="text-lg font-semibold text-white mb-1">{t('locationAndAvailability')}</h2>
              <p className="mb-4 text-sm text-white/50">{t('addYourPracticeLocation')}</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">{t('city')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.city}
                    onChange={e => updateField('city', e.target.value)}
                    placeholder={t('cityPlaceholder')}
                  />
                </div>
                <div>
                  <label className="form-label">{t('country')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.country}
                    onChange={e => updateField('country', e.target.value)}
                    placeholder={t('countryPlaceholder')}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="form-label">{t('hourlyRate')}</label>
                <div className="flex items-center gap-2">
                  <span className="text-white/60">$</span>
                  <input
                    className="glass-input w-32"
                    type="number"
                    value={formData.hourlyRate}
                    onChange={e => updateField('hourlyRate', e.target.value)}
                    placeholder="120"
                  />
                  <span className="text-white/60">/ {t('hour')}</span>
                </div>
              </div>
            </GlassPanel>
          </div>
        )}

        {/* Step 3: Specializations & Languages */}
        {step === 3 && (
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <h2 className="text-lg font-semibold text-white mb-1">{t('specializations')}</h2>
              <p className="mb-4 text-sm text-white/50">{t('selectAreasOfPractice')}</p>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map(spec => (
                  <button
                    key={spec}
                    onClick={() => toggleSpecialization(spec)}
                    className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                      formData.specializations.includes(spec)
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {spec}
                  </button>
                ))}
              </div>
            </GlassPanel>

            <GlassPanel className="p-5">
              <h2 className="text-lg font-semibold text-white mb-1">{t('languages')}</h2>
              <p className="mb-4 text-sm text-white/50">{t('chooseLanguagesYouSpeak')}</p>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang}
                    onClick={() => toggleLanguage(lang)}
                    className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                      formData.languages.includes(lang)
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            </GlassPanel>
          </div>
        )}

        {/* Step 4: Documents */}
        {step === 4 && (
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <h2 className="text-lg font-semibold text-white mb-1">{t('requiredDocuments')}</h2>
              <p className="mb-4 text-sm text-white/50">{t('uploadYourVerificationFiles')}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'cv', label: t('cv') },
                  { key: 'diploma', label: t('diploma') },
                  { key: 'idFront', label: t('idFront') },
                  { key: 'idBack', label: t('idBack') },
                  { key: 'video', label: t('introVideo') },
                ].map(doc => (
                  <div key={doc.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <label className="block text-sm font-semibold text-white mb-3">{doc.label}</label>
                    <input
                      type="file"
                      accept={doc.key === 'video' ? 'video/*' : 'image/*,.pdf'}
                      onChange={e => handleFileUpload(doc.key, e.target.files[0])}
                      className="hidden"
                      id={`file-${doc.key}`}
                    />
                    <label
                      htmlFor={`file-${doc.key}`}
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-white/10 bg-white/5 p-6 cursor-pointer hover:bg-white/10 transition"
                    >
                      {previews[doc.key] ? (
                        <img src={previews[doc.key]} alt="preview" className="h-20 w-20 object-cover rounded-lg" />
                      ) : (
                        <>
                          <span className="text-2xl">📎</span>
                          <span className="text-xs text-white/60">{t('clickToUpload')}</span>
                        </>
                      )}
                    </label>
                    {formData.documents[doc.key] && (
                      <p className="text-xs text-emerald-400 mt-2 text-center">
                        ✓ {formData.documents[doc.key].name}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        )}

        {/* Navigation */}
        <div className="flex gap-3 mt-8">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="glass-button-secondary flex-1"
            >
              {t('previous')}
            </button>
          )}
          {step < STEPS.length ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canProceed()}
              className="glass-button flex-1 disabled:opacity-50"
            >
              {t('next')}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canProceed() || loading}
              className="glass-button flex-1 disabled:opacity-50"
            >
              {loading ? t('submitting') : t('completeSetup')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
