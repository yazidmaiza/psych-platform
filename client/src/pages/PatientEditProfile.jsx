import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { api, toAbsoluteUrl } from '../services/api';
import { logout } from '../services/auth';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';

const Card = ({ children, className = '' }) => (
  <div className={`rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]/85 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl sm:p-8 ${className}`}>
    {children}
  </div>
);

export default function PatientEditProfile() {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    fullName: '',
    photo: ''
  });

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreview('');
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const loadMe = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.get('/api/users/me');
      setProfile({
        firstName: data?.firstName || '',
        lastName: data?.lastName || '',
        fullName: data?.fullName || '',
        photo: data?.photo || ''
      });
    } catch (e) {
      setError(e.message || t('profileLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const displayPhoto = useMemo(() => {
    if (photoPreview) return photoPreview;
    if (profile.photo) return toAbsoluteUrl(profile.photo);
    return '';
  }, [photoPreview, profile.photo]);

  const initials = useMemo(() => {
    const f = String(profile.firstName || '').trim();
    const l = String(profile.lastName || '').trim();
    const combined = `${f} ${l}`.trim() || String(profile.fullName || '').trim();
    const parts = combined.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'P';
    const a = parts[0]?.[0] || 'P';
    const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || a) : (parts[0]?.[1] || a);
    return (a + b).toUpperCase();
  }, [profile.firstName, profile.fullName, profile.lastName]);

  const saveProfile = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const updated = await api.put('/api/users/me', {
        firstName: profile.firstName,
        lastName: profile.lastName
      });
      setProfile((p) => ({ ...p, ...updated }));
      if (typeof updated?.fullName === 'string') {
        localStorage.setItem('userName', updated.fullName);
      }
      setSuccess(t('profileSaved'));
    } catch (e) {
      setError(e.message || t('profileSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = async () => {
    if (!photoFile) return;
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      const fd = new FormData();
      fd.append('photo', photoFile);
      const res = await api.postForm('/api/users/me/photo', fd);
      setProfile((p) => ({ ...p, photo: res?.photo || p.photo }));
      setPhotoFile(null);
      setSuccess(t('photoUploaded'));
    } catch (e) {
      setError(e.message || t('photoUploadFailed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] antialiased">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-28 left-1/4 h-96 w-96 rounded-full bg-[color:var(--accent-15)] blur-3xl" />
        <div className="absolute -bottom-28 right-1/4 h-96 w-96 rounded-full bg-[color:var(--accent-10)] blur-3xl" />
      </div>

      <header className="sticky top-0 z-50 border-b border-[color:var(--panel-border)] bg-[color:var(--app-bg-70)] backdrop-blur-xl shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <div className="font-display-lg text-title-md font-bold text-[color:var(--app-fg)]">
            {t('navTitle')}
          </div>

          <nav className="hidden md:flex gap-8 items-center">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-[color:var(--muted)] hover:text-[color:var(--app-fg)] transition-colors font-body-md text-body-md"
            >
              {t('navHome')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/patient/discovery')}
              className="text-[color:var(--muted)] hover:text-[color:var(--app-fg)] transition-colors font-body-md text-body-md"
            >
              {t('navDiscovery')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/patient/dashboard')}
              className="text-[color:var(--muted)] hover:text-[color:var(--app-fg)] transition-colors font-body-md text-body-md"
            >
              {t('navDashboard')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-[color:var(--muted)] hover:text-[color:var(--app-fg)] transition-colors font-body-md text-body-md"
            >
              {t('navHistory')}
            </button>
          </nav>

          <div className="flex items-center gap-2" dir={i18n.dir()}>
            <ThemeToggleButton />
            <select
              className="cursor-pointer rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm outline-none transition hover:brightness-110"
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
              className="rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-2 text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
              aria-label={t('notifications')}
              title={t('notifications')}
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="ml-1 rounded-2xl bg-[color:var(--accent)] px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-110 transition"
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="relative flex-grow w-full max-w-7xl mx-auto px-4 md:px-6 py-10 sm:py-12">
        <div className="mb-8" dir={i18n.dir()}>
          <div className="inline-flex items-center rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)] shadow-sm">
            {t('editProfile')}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[color:var(--app-fg)] sm:text-4xl lg:text-5xl">
            {t('editProfile')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[color:var(--muted)] sm:text-base">
            {t('editProfileDesc')}
          </p>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-6 py-4 text-[color:var(--muted)] shadow-sm backdrop-blur-xl">{t('loading')}...</div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7 flex flex-col gap-6">
              <Card>
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{t('profileInfo')}</div>
                    <div className="mt-2 text-lg font-semibold text-[color:var(--app-fg)]">{profile.fullName || `${profile.firstName} ${profile.lastName}`.trim() || t('patient')}</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--accent-10)] px-3 py-2 text-xs font-semibold text-[color:var(--app-fg)]">
                    {t('profilePhoto')}
                  </div>
                </div>

                {error && (
                  <div className="mb-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                    {success}
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1 sm:col-span-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{t('firstName')}</span>
                    <input
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                      className="h-12 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-sm text-[color:var(--app-fg)] outline-none shadow-sm transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">{t('lastName')}</span>
                    <input
                      value={profile.lastName}
                      onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                      className="h-12 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-sm text-[color:var(--app-fg)] outline-none shadow-sm transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
                    />
                  </label>

                  <label className="grid gap-1 sm:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Full name</span>
                    <input
                      value={profile.fullName}
                      readOnly
                      className="h-12 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--accent-08)] px-4 text-sm text-[color:var(--muted)] outline-none shadow-sm"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveProfile}
                    className="h-12 rounded-2xl bg-[color:var(--accent)] px-5 text-sm font-semibold text-white shadow hover:brightness-110 transition disabled:opacity-50 sm:col-span-2"
                  >
                    {saving ? t('saving') : t('saveChanges')}
                  </button>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-6">
              <Card>
                <div className="mb-6 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">{t('profilePhoto')}</div>
                    <div className="mt-2 text-lg font-semibold text-[color:var(--app-fg)]">Update your picture</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-3 py-2 text-xs font-semibold text-[color:var(--muted)] shadow-sm">
                    PNG, JPG, WEBP
                  </div>
                </div>

                <div className="flex items-start gap-5">
                  <div className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] shadow-sm">
                    {displayPhoto ? (
                      <img src={displayPhoto} alt={t('profilePhoto')} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="flex-1 space-y-4">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="block w-full cursor-pointer rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3 text-sm text-[color:var(--muted)] shadow-sm file:mr-4 file:rounded-xl file:border-0 file:bg-[color:var(--accent)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:brightness-110"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!photoFile || uploading}
                        onClick={uploadPhoto}
                        className="h-11 rounded-2xl bg-[color:var(--accent)] px-4 text-sm font-semibold text-white shadow hover:brightness-110 transition disabled:opacity-50"
                      >
                        {uploading ? t('uploading') : t('uploadPhoto')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFile(null)}
                        className="h-11 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm hover:brightness-110 transition"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-[color:var(--muted)]">{t('photoHint')}</p>
                  </div>
                </div>
              </Card>

              <Card>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Account summary</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">First name</div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--app-fg)]">{profile.firstName || '—'}</div>
                  </div>
                  <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">Last name</div>
                    <div className="mt-1 text-sm font-semibold text-[color:var(--app-fg)]">{profile.lastName || '—'}</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        )}
      </main>

      <NotificationsDrawer
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
    </div>
  );
}

