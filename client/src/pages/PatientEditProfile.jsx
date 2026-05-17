import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { api, toAbsoluteUrl } from '../services/api';
import { logout } from '../services/auth';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import NotificationsDrawer from '../components/notifications/NotificationsDrawer';

const Card = ({ children, className = '' }) => (
  <div className={`bg-white/70 backdrop-blur-md border border-white p-8 rounded-[24px] shadow-[0_8px_30px_rgba(27,77,92,0.08)] ${className}`}>
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
    <div className="bg-background text-on-background antialiased min-h-screen flex flex-col">
      <header className="bg-surface/70 dark:bg-surface-container/70 backdrop-blur-xl top-0 sticky z-50 border-b border-white/20 dark:border-outline-variant/20 shadow-[0_8px_30px_rgba(27,77,92,0.08)]">
        <div className="flex justify-between items-center w-full px-margin-mobile md:px-margin-desktop py-4 max-w-container-max mx-auto">
          <div className="font-display-lg text-title-md font-bold text-primary dark:text-primary-fixed-dim">
            PsychPlatform
          </div>

          <nav className="hidden md:flex gap-8 items-center">
            <button
              type="button"
              onClick={() => navigate('/patient/discovery')}
              className="text-on-surface-variant dark:text-outline hover:text-primary dark:hover:text-primary-fixed-dim transition-colors font-body-md text-body-md"
            >
              {t('navDiscovery')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/patient/dashboard')}
              className="text-on-surface-variant dark:text-outline hover:text-primary dark:hover:text-primary-fixed-dim transition-colors font-body-md text-body-md"
            >
              {t('navDashboard')}
            </button>
            <button
              type="button"
              onClick={() => navigate('/history')}
              className="text-on-surface-variant dark:text-outline hover:text-primary dark:hover:text-primary-fixed-dim transition-colors font-body-md text-body-md"
            >
              {t('navHistory')}
            </button>
          </nav>

          <div className="flex items-center gap-2" dir={i18n.dir()}>
            <ThemeToggleButton />
            <select
              className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/70 px-2 py-2 text-sm font-semibold text-on-surface hover:brightness-110 transition outline-none cursor-pointer"
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
              className="text-primary dark:text-primary-fixed-dim p-2 rounded-full hover:bg-surface-container-low dark:hover:bg-surface-container-highest transition-all duration-300"
              aria-label={t('notifications')}
              title={t('notifications')}
            >
              <span className="material-symbols-outlined">notifications</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="ml-1 rounded-2xl bg-error px-4 py-2 text-sm font-semibold text-on-error hover:brightness-110 transition"
            >
              {t('logout')}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-container-max mx-auto px-margin-mobile md:px-margin-desktop py-section-padding">
        <div className="mb-8" dir={i18n.dir()}>
          <h1 className="font-headline-lg text-headline-lg-mobile md:text-headline-lg text-primary mb-2">{t('editProfile')}</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{t('editProfileDesc')}</p>
        </div>

        {loading ? (
          <div className="glass-card px-6 py-4 text-on-surface-variant">{t('loading')}...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
            <div className="lg:col-span-7 flex flex-col gap-gutter">
              <Card>
                <div className="font-title-md text-title-md text-primary mb-6">{t('profileInfo')}</div>

                {error && (
                  <div className="mb-4 rounded-2xl border border-error/20 bg-error-container/40 px-4 py-3 text-sm text-on-error-container">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-4 rounded-2xl border border-secondary/20 bg-secondary-container/40 px-4 py-3 text-sm text-on-secondary-container">
                    {success}
                  </div>
                )}

                <div className="grid gap-4">
                  <label className="grid gap-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('firstName')}</span>
                    <input
                      value={profile.firstName}
                      onChange={(e) => setProfile((p) => ({ ...p, firstName: e.target.value }))}
                      className="h-12 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/70 px-4 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary-fixed/40"
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">{t('lastName')}</span>
                    <input
                      value={profile.lastName}
                      onChange={(e) => setProfile((p) => ({ ...p, lastName: e.target.value }))}
                      className="h-12 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/70 px-4 text-sm text-on-surface outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary-fixed/40"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={saveProfile}
                    className="h-12 rounded-2xl bg-primary px-5 text-sm font-semibold text-on-primary hover:brightness-110 transition disabled:opacity-50"
                  >
                    {saving ? t('saving') : t('saveChanges')}
                  </button>
                </div>
              </Card>
            </div>

            <div className="lg:col-span-5 flex flex-col gap-gutter">
              <Card>
                <div className="font-title-md text-title-md text-primary mb-6">{t('profilePhoto')}</div>
                <div className="flex items-center gap-5">
                  <div className="w-20 h-20 rounded-full overflow-hidden border border-outline-variant/40 bg-surface-container-lowest/70 flex items-center justify-center text-primary font-title-md text-title-md">
                    {displayPhoto ? (
                      <img src={displayPhoto} alt={t('profilePhoto')} className="w-full h-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>

                  <div className="flex-1">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                      className="block w-full text-sm text-on-surface-variant"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={!photoFile || uploading}
                        onClick={uploadPhoto}
                        className="h-11 rounded-2xl bg-secondary px-4 text-sm font-semibold text-on-secondary hover:brightness-110 transition disabled:opacity-50"
                      >
                        {uploading ? t('uploading') : t('uploadPhoto')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setPhotoFile(null)}
                        className="h-11 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/70 px-4 text-sm font-semibold text-on-surface hover:brightness-110 transition"
                      >
                        {t('cancel')}
                      </button>
                    </div>
                    <p className="mt-2 text-sm text-on-surface-variant">{t('photoHint')}</p>
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

