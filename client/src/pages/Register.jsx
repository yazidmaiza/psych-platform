import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { getDeviceId } from '../services/auth';
import GlassPanel from '../components/GlassPanel';
import PlatformLogo from '../components/branding/PlatformLogo';

const SPECIALIZATIONS = ['Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD', 'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'];
const LANGUAGES = ['Arabic', 'French', 'English', 'Darija'];

export default function Register() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    birthDate: '',
    telephone: '',
    email: '',
    password: '',
    confirmPassword: '',
    // Psychologist onboarding (collected before account creation; submitted immediately after register)
    firstName: '',
    lastName: '',
    bio: '',
    city: '',
    country: '',
    sessionPrice: '',
    specializations: [],
    languages: [],
    documents: { cv: null, diploma: null, idFront: null, idBack: null, introVideo: null },
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState({});

  const tr = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const totalSteps = role === 'psychologist' ? 5 : 3;

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError('');
  };

  const toggleSpecialization = (spec) => {
    setFormData((prev) => ({
      ...prev,
      specializations: prev.specializations.includes(spec) ? prev.specializations.filter((s) => s !== spec) : [...prev.specializations, spec],
    }));
    setError('');
  };

  const toggleLanguage = (lang) => {
    setFormData((prev) => ({
      ...prev,
      languages: prev.languages.includes(lang) ? prev.languages.filter((l) => l !== lang) : [...prev.languages, lang],
    }));
    setError('');
  };

  const handleFileUpload = (type, file) => {
    if (!file) return;
    setFormData((prev) => ({ ...prev, documents: { ...prev.documents, [type]: file } }));
    setError('');

    if (file.type?.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreviews((p) => ({ ...p, [type]: e.target.result }));
      reader.readAsDataURL(file);
    } else {
      setPreviews((p) => ({ ...p, [type]: '' }));
    }
  };

  const validateStep = () => {
    if (step === 1 && !role) {
      setError(t('selectRole'));
      return false;
    }
    if (step === 2) {
      if (!formData.fullName || !formData.birthDate || !formData.telephone) {
        setError(t('fillAllFields'));
        return false;
      }
    }

    // Psychologist: collect profile + credential documents BEFORE creating the account.
    if (role === 'psychologist' && step === 3) {
      if (!formData.firstName || !formData.lastName || !formData.bio || !formData.city) {
        setError(t('fillAllFields'));
        return false;
      }
      if (formData.specializations.length === 0 || formData.languages.length === 0) {
        setError(t('fillAllFields'));
        return false;
      }
    }

    if (role === 'psychologist' && step === 4) {
      const requiredDocs = ['cv', 'diploma', 'idFront', 'idBack', 'introVideo'];
      const missing = requiredDocs.filter((k) => !formData.documents?.[k]);
      if (missing.length > 0) {
        setError(t('fillAllFields'));
        return false;
      }
    }

    const accountStep = role === 'psychologist' ? 5 : 3;
    if (step === accountStep) {
      if (!formData.email || !formData.password || !formData.confirmPassword) {
        setError(t('fillAllFields'));
        return false;
      }
      if (formData.password.length < 8 || !/\d/.test(formData.password)) {
        setError(t('passwordRequirements'));
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError(t('passwordsDoNotMatch'));
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep()) {
      setStep((s) => s + 1);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateStep()) return;
    setLoading(true);
    try {
      setError('');

      // Start registration: send verification code and create a pending registration (no account yet).
      const startRes = await api.post('/api/auth/register/start', {
        fullName: formData.fullName,
        birthDate: formData.birthDate,
        telephone: formData.telephone,
        email: formData.email,
        password: formData.password,
        role,
        deviceId: getDeviceId(),
        ...(role === 'psychologist'
          ? {
              firstName: formData.firstName,
              lastName: formData.lastName,
              bio: formData.bio,
              city: formData.city,
              country: formData.country || '',
              specializations: formData.specializations,
              languages: formData.languages,
              sessionPrice: formData.sessionPrice ? Number(formData.sessionPrice) : 0,
            }
          : {}),
      });

      if (role === 'psychologist') {
        // Upload documents to the pending registration.
        const fd = new FormData();
        fd.append('cv', formData.documents.cv);
        fd.append('diploma', formData.documents.diploma);
        fd.append('idFront', formData.documents.idFront);
        fd.append('idBack', formData.documents.idBack);
        fd.append('introVideo', formData.documents.introVideo);
        await api.postForm(`/api/auth/register/pending/${startRes.pendingId}/documents`, fd);
      }

      navigate('/verify-email', { state: { email: formData.email, mode: 'register', pendingId: startRes.pendingId } });
    } catch (err) {
      setError(err?.message || t('registrationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const roleCards = [
    { id: 'patient', title: t('patient'), desc: t('patientDesc'), color: 'from-emerald-500/20 to-emerald-600/10' },
    {
      id: 'psychologist',
      title: t('psychologist'),
      desc: t('psychologistDesc'),
      color: 'from-indigo-500/20 to-indigo-600/10',
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] flex items-center justify-center p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6 transition">
          <span>←</span> {t('backToHome')}
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <PlatformLogo size={40} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Psych Platform</h1>
            <p className="text-xs text-white/60">{t('registerSubtitle')}</p>
          </div>
        </div>

        <GlassPanel className="p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-white/60">
                {t('step')} {step} {t('of')} {totalSteps}
              </span>
              <span className="text-xs text-white/40">
                {role === 'psychologist'
                  ? step === 1
                    ? t('roleSelection')
                    : step === 2
                      ? t('personalInfo')
                      : step === 3
                        ? tr('profile', 'Profile')
                        : step === 4
                          ? tr('documents', 'Documents')
                          : t('accountDetails')
                  : step === 1
                    ? t('roleSelection')
                    : step === 2
                      ? t('personalInfo')
                      : t('accountDetails')}
              </span>
            </div>
            <div className="h-2 rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all duration-300"
                style={{ width: `${(step / totalSteps) * 100}%` }}
              />
            </div>
          </div>

          <h2 className="text-lg font-semibold text-white mb-4">{t('createAccount')}</h2>

          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50 mb-4">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-white/60">{t('chooseRole')}</p>
              <div className="grid gap-3">
                {roleCards.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => {
                      setRole(card.id);
                      setError('');
                    }}
                    className={`glass-card text-left transition-all ${
                      role === card.id ? 'border-indigo-500/50 bg-indigo-500/10 ring-2 ring-indigo-500/30' : 'hover:bg-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-4 p-4">
                      <div className={`rounded-xl bg-gradient-to-br ${card.color} p-3`}>
                        <span className="text-2xl">{card.id === 'patient' ? '🧑‍⚕️' : '👨‍⚕️'}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{card.title}</h3>
                        <p className="text-sm text-white/60 mt-1">{card.desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={handleNext} className="glass-button w-full mt-4">
                {t('continue')}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <label className="form-label">{t('fullName')}</label>
                <input
                  className="glass-input w-full"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  placeholder={t('fullName')}
                />
              </div>
              <div>
                <label className="form-label">{t('birthDate')}</label>
                <input type="date" className="glass-input w-full" value={formData.birthDate} onChange={(e) => updateField('birthDate', e.target.value)} />
              </div>
              <div>
                <label className="form-label">{t('telephone')}</label>
                <input
                  className="glass-input w-full"
                  type="tel"
                  value={formData.telephone}
                  onChange={(e) => updateField('telephone', e.target.value)}
                  placeholder={t('telephone')}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="glass-button-secondary flex-1">
                  {t('back')}
                </button>
                <button onClick={handleNext} className="glass-button flex-1">
                  {t('next')}
                </button>
              </div>
            </div>
          )}

          {role === 'psychologist' && step === 3 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">{tr('firstName', 'First name')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.firstName}
                    onChange={(e) => updateField('firstName', e.target.value)}
                    placeholder={tr('firstName', 'First name')}
                  />
                </div>
                <div>
                  <label className="form-label">{tr('lastName', 'Last name')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.lastName}
                    onChange={(e) => updateField('lastName', e.target.value)}
                    placeholder={tr('lastName', 'Last name')}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">{tr('bio', 'Bio')}</label>
                <textarea
                  className="glass-input w-full min-h-[120px] resize-none"
                  value={formData.bio}
                  onChange={(e) => updateField('bio', e.target.value)}
                  placeholder={tr('bio', 'Tell patients about your approach')}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">{tr('city', 'City')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.city}
                    onChange={(e) => updateField('city', e.target.value)}
                    placeholder={tr('city', 'City')}
                  />
                </div>
                <div>
                  <label className="form-label">{tr('country', 'Country')}</label>
                  <input
                    className="glass-input w-full"
                    value={formData.country}
                    onChange={(e) => updateField('country', e.target.value)}
                    placeholder={tr('country', 'Country')}
                  />
                </div>
                <div>
                  <label className="form-label">{tr('sessionPrice', 'Session price')}</label>
                  <div className="flex items-center gap-2">
                    <span className="text-white/60">$</span>
                    <input
                      className="glass-input w-full"
                      type="number"
                      min="0"
                      value={formData.sessionPrice}
                      onChange={(e) => updateField('sessionPrice', e.target.value)}
                      placeholder="120"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <label className="block text-sm font-semibold text-white mb-3">{tr('specializations', 'Specializations')}</label>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATIONS.map((spec) => (
                    <button
                      key={spec}
                      type="button"
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
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <label className="block text-sm font-semibold text-white mb-3">{tr('languages', 'Languages')}</label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
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
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(2)} className="glass-button-secondary flex-1">
                  {t('back')}
                </button>
                <button onClick={handleNext} className="glass-button flex-1">
                  {t('next')}
                </button>
              </div>
            </div>
          )}

          {role === 'psychologist' && step === 4 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { key: 'cv', label: tr('cv', 'CV (PDF)'), accept: 'application/pdf' },
                  { key: 'diploma', label: tr('diploma', 'Diploma (PDF)'), accept: 'application/pdf' },
                  { key: 'idFront', label: tr('idFront', 'ID Front (JPG/PNG)'), accept: 'image/jpeg,image/png' },
                  { key: 'idBack', label: tr('idBack', 'ID Back (JPG/PNG)'), accept: 'image/jpeg,image/png' },
                  { key: 'introVideo', label: tr('introVideo', 'Intro video (MP4/MOV/WEBM)'), accept: 'video/mp4,video/webm,video/quicktime' },
                ].map((doc) => (
                  <div key={doc.key} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <label className="block text-sm font-semibold text-white mb-3">{doc.label}</label>
                    <input
                      type="file"
                      accept={doc.accept}
                      onChange={(e) => handleFileUpload(doc.key, e.target.files[0])}
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
                          <span className="text-xs text-white/60">{tr('clickToUpload', 'Click to upload')}</span>
                        </>
                      )}
                    </label>
                    {formData.documents?.[doc.key] && (
                      <p className="text-xs text-emerald-400 mt-2 text-center">✓ {formData.documents[doc.key].name}</p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-3">
                <button onClick={() => setStep(3)} className="glass-button-secondary flex-1">
                  {t('back')}
                </button>
                <button onClick={handleNext} className="glass-button flex-1">
                  {t('next')}
                </button>
              </div>
            </div>
          )}

          {(role !== 'psychologist' ? step === 3 : step === 5) && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="form-label">{t('email')}</label>
                <input
                  type="email"
                  className="glass-input w-full"
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  placeholder={t('email')}
                  required
                />
              </div>
              <div>
                <label className="form-label">{t('password')}</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="glass-input w-full pr-12"
                    value={formData.password}
                    onChange={(e) => updateField('password', e.target.value)}
                    placeholder={t('password')}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
                <p className="text-xs text-white/40 mt-1">{t('passwordRequirements')}</p>
              </div>
              <div>
                <label className="form-label">{t('confirmPassword')}</label>
                <input
                  type="password"
                  className="glass-input w-full"
                  value={formData.confirmPassword}
                  onChange={(e) => updateField('confirmPassword', e.target.value)}
                  placeholder={t('confirmPassword')}
                  required
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(role === 'psychologist' ? 4 : 2)}
                  className="glass-button-secondary flex-1"
                >
                  {t('back')}
                </button>
                <button type="submit" disabled={loading} className="glass-button flex-1 disabled:opacity-50">
                  {loading ? t('creatingAccount') : t('createAccount')}
                </button>
              </div>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-white/60">
            {t('alreadyHaveAccount')}{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              {t('signIn')}
            </Link>
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}

