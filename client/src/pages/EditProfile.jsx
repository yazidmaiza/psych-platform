import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';
import DashboardSidebar from '../components/dashboard/DashboardSidebar';

const SPECIALIZATIONS = ['Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD', 'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'];
const LANGUAGES = ['Arabic', 'French', 'English', 'Darija'];

const EMPTY_PROFILE = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  bio: '',
  city: '',
  country: '',
  hourlyRate: '',
  specializations: [],
  languages: [],
  availability: {},
  photo: ''
};

export default function EditProfile() {
  const { t } = useTranslation();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const userId = localStorage.getItem('userId');

  useEffect(() => {
    let mounted = true;
    const fetchProfile = async () => {
      if (!userId) {
        if (mounted) setLoading(false);
        return;
      }
      if (mounted) setLoading(true);
      try {
        const p = await api.get('/api/psychologists/by-user/' + userId);
        if (!mounted) return;
        setProfile({
          firstName: p.firstName || '',
          lastName: p.lastName || '',
          email: p.email || '',
          phone: p.phone || '',
          bio: p.bio || '',
          city: p.city || '',
          country: p.country || '',
          hourlyRate: p.sessionPrice != null ? p.sessionPrice : '',
          specializations: p.specializations || [],
          languages: p.languages || [],
          availability: p.availability || {},
          photo: p.photo || ''
        });
      } catch (e) {
        // if 404 or not found, keep empty profile
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [userId]);

  const updateField = (field, value) => {
    setProfile(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const toggleSpecialization = (spec) => {
    setProfile(prev => ({
      ...prev,
      specializations: prev.specializations.includes(spec)
        ? prev.specializations.filter(s => s !== spec)
        : [...prev.specializations, spec]
    }));
    setSaved(false);
  };

  const toggleLanguage = (lang) => {
    setProfile(prev => ({
      ...prev,
      languages: prev.languages.includes(lang)
        ? prev.languages.filter(l => l !== lang)
        : [...prev.languages, lang]
    }));
    setSaved(false);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put('/api/profile', profile);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'profile', label: t('profileInfo') },
    { id: 'specializations', label: t('specializationsAndLanguages') },
    { id: 'availability', label: t('availability') },
    { id: 'documents', label: t('documents') },
  ];

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] flex">
      <DashboardSidebar role="psychologist" />

      <main className="flex-1 p-6 lg:p-8 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
            <div>
              <h1 className="page-title">{t('editProfile')}</h1>
              <p className="page-subtitle">{t('editProfileSubtitle')}</p>
            </div>
            <div className="flex items-center gap-3">
              {saved && (
                <span className="text-sm text-emerald-400 font-semibold">✓ {t('saved')}</span>
              )}
              <button
                onClick={handleSave}
                disabled={loading}
                className="glass-button disabled:opacity-50"
              >
                {loading ? t('saving') : t('saveChanges')}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="h-20 w-20 rounded-2xl overflow-hidden border border-white/10">
              <img
                src={profile.photo}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h2 className="font-semibold text-white">{profile.firstName} {profile.lastName}</h2>
              <p className="text-sm text-white/60">{profile.email}</p>
              <label className="mt-2 inline-flex items-center gap-2 text-sm text-indigo-400 cursor-pointer hover:text-indigo-300 transition">
                <span>📷</span> {t('changePhoto')}
                <input type="file" accept="image/*" className="hidden" />
              </label>
            </div>
          </div>

          <div className="flex gap-1 mb-6 border-b border-white/10">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 text-sm font-semibold border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-400'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'profile' && (
            <div className="space-y-4">
              <GlassPanel className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">{t('firstName')}</label>
                    <input
                      className="glass-input w-full"
                      value={profile.firstName}
                      onChange={e => updateField('firstName', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">{t('lastName')}</label>
                    <input
                      className="glass-input w-full"
                      value={profile.lastName}
                      onChange={e => updateField('lastName', e.target.value)}
                    />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="form-label">{t('email')}</label>
                  <input
                    className="glass-input w-full"
                    type="email"
                    value={profile.email}
                    onChange={e => updateField('email', e.target.value)}
                  />
                </div>
                <div className="mt-4">
                  <label className="form-label">{t('phone')}</label>
                  <input
                    className="glass-input w-full"
                    value={profile.phone}
                    onChange={e => updateField('phone', e.target.value)}
                  />
                </div>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="form-label">{t('city')}</label>
                    <input
                      className="glass-input w-full"
                      value={profile.city}
                      onChange={e => updateField('city', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="form-label">{t('country')}</label>
                    <input
                      className="glass-input w-full"
                      value={profile.country}
                      onChange={e => updateField('country', e.target.value)}
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
                      value={profile.hourlyRate}
                      onChange={e => updateField('hourlyRate', e.target.value)}
                    />
                    <span className="text-white/60">/ {t('hour')}</span>
                  </div>
                </div>
                <div className="mt-4">
                  <label className="form-label">{t('bio')}</label>
                  <textarea
                    className="glass-input w-full min-h-[120px] resize-none"
                    value={profile.bio}
                    onChange={e => updateField('bio', e.target.value)}
                  />
                </div>
              </GlassPanel>
            </div>
          )}

          {activeTab === 'specializations' && (
            <div className="space-y-4">
              <GlassPanel className="p-5">
                <h3 className="text-lg font-semibold text-white mb-4">{t('specializations')}</h3>
                <div className="flex flex-wrap gap-2">
                  {SPECIALIZATIONS.map(spec => (
                    <button
                      key={spec}
                      onClick={() => toggleSpecialization(spec)}
                      className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                        profile.specializations.includes(spec)
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
                <h3 className="text-lg font-semibold text-white mb-4">{t('languages')}</h3>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map(lang => (
                    <button
                      key={lang}
                      onClick={() => toggleLanguage(lang)}
                      className={`h-9 rounded-xl px-4 text-sm font-semibold transition ${
                        profile.languages.includes(lang)
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

          {activeTab === 'availability' && (
            <div className="space-y-4">
              {Object.entries(profile.availability).map(([day, slots]) => (
                <GlassPanel key={day} className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold text-white capitalize">{day}</h3>
                    <button className="text-xs text-indigo-400 hover:text-indigo-300 transition">
                      + {t('addSlot')}
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {slots.map(slot => (
                      <span
                        key={slot}
                        className="inline-flex items-center gap-1 rounded-xl bg-indigo-500/10 px-3 py-1.5 text-sm text-indigo-300 border border-indigo-500/20"
                      >
                        {slot}
                        <button className="text-indigo-400/60 hover:text-indigo-400 ml-1">×</button>
                      </span>
                    ))}
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}

          {activeTab === 'documents' && (
            <div className="space-y-4">
              {['CV', 'Diploma', 'ID (Front)', 'ID (Back)', 'Intro Video'].map(doc => (
                <GlassPanel key={doc} className="p-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-white/5 flex items-center justify-center text-lg">
                        📄
                      </div>
                      <div>
                        <p className="font-semibold text-white">{doc}</p>
                        <p className="text-xs text-white/60">{t('uploadedOn')} 2026-01-15</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="h-9 rounded-xl bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition">
                        {t('view')}
                      </button>
                      <button className="h-9 rounded-xl bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition">
                        {t('replace')}
                      </button>
                    </div>
                  </div>
                </GlassPanel>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}