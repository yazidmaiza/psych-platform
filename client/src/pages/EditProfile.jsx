import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, toAbsoluteUrl } from '../services/api';
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
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');
  const [error, setError] = useState('');
  const [credentialDocs, setCredentialDocs] = useState([]);
  const [credentialDocsLoading, setCredentialDocsLoading] = useState(false);
  const [credentialDocsError, setCredentialDocsError] = useState('');
  const [credentialUploadType, setCredentialUploadType] = useState('');
  const [credentialUploadLoading, setCredentialUploadLoading] = useState(false);
  const [credentialUploadFiles, setCredentialUploadFiles] = useState({
    cv: null,
    diploma: null,
    idFront: null,
    idBack: null,
    introVideo: null,
  });

  const userId = localStorage.getItem('userId');

  useEffect(() => {
    let mounted = true;

    const mapProfile = (p) => ({
      firstName: p.firstName || '',
      lastName: p.lastName || '',
      email: p.email || '',
      phone: p.phone || '',
      bio: p.bio || '',
      city: p.city || '',
      country: p.country || '',
      hourlyRate: p.sessionPrice != null ? String(p.sessionPrice) : '',
      specializations: p.specializations || [],
      languages: p.languages || [],
      availability: p.availability || {},
      photo: p.photo || ''
    });

    const fetchProfile = async () => {
      if (mounted) {
        setLoading(true);
        setError('');
      }

      if (!userId) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const p = await api.get('/api/psychologists/by-user/' + userId);
        if (!mounted) return;
        setProfile(mapProfile(p || {}));
      } catch (e) {
        try {
          const me = await api.get('/api/psychologists/me');
          if (mounted) setProfile(mapProfile(me || {}));
        } catch {
          if (mounted) setError(t('failedToLoadProfile'));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchProfile();
    return () => { mounted = false; };
  }, [userId, t]);

  useEffect(() => {
    let mounted = true;

    const fetchCredentialDocs = async () => {
      if (activeTab !== 'documents') return;
      setCredentialDocsLoading(true);
      setCredentialDocsError('');
      try {
        const data = await api.get('/api/credential-documents/my');
        if (!mounted) return;
        setCredentialDocs(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!mounted) return;
        setCredentialDocs([]);
        setCredentialDocsError(e.message || 'Failed to load credential documents');
      } finally {
        if (mounted) setCredentialDocsLoading(false);
      }
    };

    fetchCredentialDocs();
    return () => {
      mounted = false;
    };
  }, [activeTab]);

  const openCredentialDoc = async (doc) => {
    if (!doc?._id) return;
    try {
      const data = await api.get(`/api/credential-documents/${doc._id}/access-url`);
      const url = toAbsoluteUrl(data?.url || '');
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setCredentialDocsError(e.message || 'Could not open document');
    }
  };

  const uploadCredentialDoc = async (type) => {
    const file = credentialUploadFiles?.[type] || null;
    if (!file) return;

    setCredentialUploadType(type);
    setCredentialUploadLoading(true);
    setCredentialDocsError('');
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);
      await api.postForm('/api/credential-documents/upload', formData);
      setCredentialUploadFiles((prev) => ({ ...prev, [type]: null }));

      const data = await api.get('/api/credential-documents/my');
      setCredentialDocs(Array.isArray(data) ? data : []);
    } catch (e) {
      setCredentialDocsError(e.message || 'Failed to upload document');
    } finally {
      setCredentialUploadLoading(false);
      setCredentialUploadType('');
    }
  };

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
    setSaving(true);
    setError('');
    try {
      await api.put('/api/psychologists/me', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        email: profile.email,
        phone: profile.phone,
        bio: profile.bio,
        city: profile.city,
        country: profile.country,
        specializations: profile.specializations,
        languages: profile.languages,
        availability: profile.availability,
        sessionPrice: profile.hourlyRate !== '' ? Number(profile.hourlyRate) : 0,
        photo: profile.photo
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e.message || t('failedToSaveProfile'));
    } finally {
      setSaving(false);
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
          {error && (
            <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

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
                disabled={loading || saving}
                className="glass-button disabled:opacity-50"
              >
                {saving ? t('saving') : t('saveChanges')}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-8">
            <div className="h-20 w-20 rounded-2xl overflow-hidden border border-white/10">
              {profile.photo ? (
                <img
                  src={toAbsoluteUrl(profile.photo)}
                  alt="Profile"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-white/5 text-white/50 flex items-center justify-center text-lg font-semibold">
                  {(profile.firstName?.[0] || 'P').toUpperCase()}
                </div>
              )}
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
              {credentialDocsError && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {credentialDocsError}
                </div>
              )}

              <GlassPanel className="p-5">
                <h3 className="text-lg font-semibold text-white mb-4">{t('documents')}</h3>

                {credentialDocsLoading ? (
                  <div className="text-sm text-white/60">Loading documents…</div>
                ) : credentialDocs.length === 0 ? (
                  <div className="text-sm text-white/60">No documents uploaded yet.</div>
                ) : (
                  <div className="space-y-3">
                    {credentialDocs.map((doc) => (
                      <div
                        key={doc._id}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-white capitalize">{String(doc.type || '')}</div>
                          <div className="text-xs text-white/60 truncate">{doc.originalName || doc.storagePath}</div>
                        </div>
                        <button
                          onClick={() => openCredentialDoc(doc)}
                          className="h-9 rounded-xl bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                        >
                          {t('view')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </GlassPanel>

              <GlassPanel className="p-5">
                <h3 className="text-lg font-semibold text-white mb-4">{t('replace')}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { type: 'cv', label: 'CV (PDF)', accept: 'application/pdf' },
                    { type: 'diploma', label: 'Diploma (PDF)', accept: 'application/pdf' },
                    { type: 'idFront', label: 'ID Front (JPG/PNG)', accept: 'image/jpeg,image/png' },
                    { type: 'idBack', label: 'ID Back (JPG/PNG)', accept: 'image/jpeg,image/png' },
                    { type: 'introVideo', label: 'Intro Video (MP4/MOV/WEBM)', accept: 'video/mp4,video/webm,video/quicktime' },
                  ].map((item) => (
                    <div key={item.type} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <div className="text-sm font-semibold text-white mb-2">{item.label}</div>
                      <input
                        type="file"
                        accept={item.accept}
                        onChange={(e) =>
                          setCredentialUploadFiles((prev) => ({ ...prev, [item.type]: e.target.files?.[0] || null }))
                        }
                        className="glass-input w-full"
                      />
                      <button
                        onClick={() => uploadCredentialDoc(item.type)}
                        disabled={!credentialUploadFiles?.[item.type] || credentialUploadLoading}
                        className="glass-button w-full mt-3 disabled:opacity-50"
                      >
                        {credentialUploadLoading && credentialUploadType === item.type ? 'Uploading…' : t('replace')}
                      </button>
                    </div>
                  ))}
                </div>
              </GlassPanel>
              {false && ['CV', 'Diploma', 'ID (Front)', 'ID (Back)', 'Intro Video'].map((doc) => (
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
