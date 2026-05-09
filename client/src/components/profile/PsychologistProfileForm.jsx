import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import GlassPanel from '../dashboard/GlassPanel';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

const SPECIALIZATIONS = [
  'Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD',
  'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'
];

const LANGUAGES = ['Arabic', 'French', 'English', 'Darija'];

const Chip = ({ active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'rounded-full border px-3 py-2 text-xs font-semibold transition',
      active
        ? 'border-indigo-400/30 bg-indigo-500/20 text-white'
        : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'
    ].join(' ')}
  >
    {children}
  </button>
);

export default function PsychologistProfileForm({ onSaved }) {
  const userId = localStorage.getItem('userId');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    city: '',
    availability: '',
    specializations: [],
    languages: [],
    sessionPrice: '',
    location: null // { lat, lng }
  });
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState('');
  const [profileExists, setProfileExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [photoSuccess, setPhotoSuccess] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState('');
  const [photoModeration, setPhotoModeration] = useState(null);

  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;
  const PHOTO_MIN_SIZE = 300;
  const ALLOWED_PHOTO_MIMES = useMemo(() => new Set(['image/jpeg', 'image/png', 'image/webp']), []);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!userId) throw new Error('Missing user id');
      const p = await api.get('/api/psychologists/by-user/' + userId);
      setProfileExists(true);
      setCurrentPhotoUrl(p.photo || '');
      setForm({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        bio: p.bio || '',
        city: p.city || '',
        availability: p.availability || '',
        specializations: p.specializations || [],
        languages: p.languages || [],
        sessionPrice: p.sessionPrice != null ? String(p.sessionPrice) : '',
        location: p.location && p.location.coordinates ? { lat: p.location.coordinates[1], lng: p.location.coordinates[0] } : null
      });
    } catch (e) {
      if (e?.status === 404) {
        setProfileExists(false);
        setForm({
          firstName: '',
          lastName: '',
          bio: '',
          city: '',
          availability: '',
          specializations: [],
          languages: [],
          sessionPrice: '',
          location: null
        });
      } else {
        setError(e.message || 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchPhotoModeration = useCallback(async () => {
    setPhotoError('');
    try {
      const data = await api.get('/api/profile-photos/me');
      setPhotoModeration(data || null);
      if (data?.approvedPhotoUrl) setCurrentPhotoUrl(data.approvedPhotoUrl);
    } catch (e) {
      // Avoid blocking profile UI if moderation endpoint fails.
      setPhotoModeration(null);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  useEffect(() => {
    fetchPhotoModeration();
  }, [fetchPhotoModeration]);

  useEffect(() => {
    if (!photoFile) {
      setPhotoPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(photoFile);
    setPhotoPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const toggleItem = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((i) => i !== value)
        : [...prev[field], value]
    }));
  };

  const missingRequired = useMemo(() => {
    return !form.firstName || !form.lastName || !form.city;
  }, [form.city, form.firstName, form.lastName]);

  const validatePhotoFile = async (file) => {
    if (!file) return { ok: false, message: 'Please select an image.' };
    if (!ALLOWED_PHOTO_MIMES.has(file.type)) return { ok: false, message: 'Allowed formats: JPG, PNG, WEBP.' };
    if (file.size > PHOTO_MAX_BYTES) return { ok: false, message: 'Max file size is 5MB.' };

    const url = URL.createObjectURL(file);
    try {
      const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = () => reject(new Error('Failed to read image.'));
        img.src = url;
      });

      if (dims.width < PHOTO_MIN_SIZE || dims.height < PHOTO_MIN_SIZE) {
        return { ok: false, message: `Minimum resolution is ${PHOTO_MIN_SIZE}x${PHOTO_MIN_SIZE}px.` };
      }

      return { ok: true, message: '' };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const onSelectPhoto = async (file) => {
    setPhotoError('');
    setPhotoSuccess('');
    if (!file) {
      setPhotoFile(null);
      return;
    }
    const result = await validatePhotoFile(file);
    if (!result.ok) {
      setPhotoFile(null);
      setPhotoError(result.message);
      return;
    }
    setPhotoFile(file);
  };

  const handleUploadPhoto = async () => {
    setPhotoError('');
    setPhotoSuccess('');
    const result = await validatePhotoFile(photoFile);
    if (!result.ok) {
      setPhotoError(result.message);
      return;
    }

    setPhotoUploading(true);
    try {
      const formData = new FormData();
      formData.append('photo', photoFile);
      const res = await api.postForm('/api/profile-photos/upload', formData);
      setPhotoModeration(res || null);
      setPhotoFile(null);
      setPhotoSuccess('Upload succeeded. Your photo is pending moderation.');
    } catch (e) {
      setPhotoError(e.message || 'Failed to upload photo.');
    } finally {
      setPhotoUploading(false);
      fetchPhotoModeration();
    }
  };

  const handleSave = async () => {
    if (missingRequired) {
      setError('First name, last name and city are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        ...form,
        sessionPrice: form.sessionPrice !== '' ? Number(form.sessionPrice) : 0
      };

      if (profileExists) {
        await api.put('/api/psychologists/me', payload);
        setSuccess('Profile updated successfully.');
      } else {
        await api.post('/api/psychologists/profile', payload);
        setProfileExists(true);
        setSuccess('Profile created successfully.');
      }
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <GlassPanel className="p-6">
        <div className="text-sm text-white/60">Loading profile...</div>
      </GlassPanel>
    );
  }

  return (
    <div className="grid gap-4">
      {(error || success) && (
        <div
          className={[
            'rounded-3xl border p-4 text-sm',
            error ? 'border-rose-500/20 bg-rose-500/10 text-rose-50' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50'
          ].join(' ')}
        >
          {error || success}
        </div>
      )}

      <GlassPanel className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm font-semibold text-white">Profile photo</div>
            <div className="mt-1 text-xs text-white/60">Upload a clear headshot (JPG/PNG/WEBP, max 5MB). Photos are reviewed automatically.</div>
          </div>
          {photoModeration?.status && (
            <div
              className={[
                'shrink-0 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide',
                photoModeration.status === 'approved'
                  ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
                  : photoModeration.status === 'rejected'
                    ? 'border-rose-500/20 bg-rose-500/10 text-rose-100'
                    : 'border-amber-500/20 bg-amber-500/10 text-amber-100'
              ].join(' ')}
            >
              {photoModeration.status}
            </div>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[140px_1fr]">
          <div className="h-[140px] w-[140px] overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            {(photoPreviewUrl || currentPhotoUrl) ? (
              <img
                src={photoPreviewUrl || currentPhotoUrl}
                alt="Profile preview"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/50">
                No photo
              </div>
            )}
          </div>

          <div className="grid gap-3">
            <div className="grid gap-2">
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => onSelectPhoto(e.target.files?.[0] || null)}
                className="block w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-500/90 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-white hover:file:bg-indigo-500 transition"
                disabled={photoUploading}
              />

              {photoModeration?.status === 'rejected' && photoModeration?.rejectionReason && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-50">
                  Rejected: {photoModeration.rejectionReason}
                </div>
              )}

              {(photoError || photoSuccess) && (
                <div
                  className={[
                    'rounded-2xl border px-3 py-2 text-xs',
                    photoError ? 'border-rose-500/20 bg-rose-500/10 text-rose-50' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-50'
                  ].join(' ')}
                >
                  {photoError || photoSuccess}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={handleUploadPhoto}
                disabled={photoUploading || !photoFile}
                className="h-11 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition disabled:opacity-50"
              >
                {photoUploading ? 'Uploading...' : 'Upload photo'}
              </button>
              <button
                type="button"
                onClick={() => { setPhotoFile(null); setPhotoError(''); setPhotoSuccess(''); }}
                disabled={photoUploading}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
              >
                Clear
              </button>
              {photoModeration?.status === 'pending' && (
                <div className="text-xs text-white/60 sm:ml-2">
                  Public display is disabled until approved.
                </div>
              )}
            </div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="text-sm font-semibold text-white">Basic information</div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">First name</span>
            <input
              className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-500/20"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
              placeholder="First name"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Last name</span>
            <input
              className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-500/20"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
              placeholder="Last name"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">City</span>
            <input
              className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-500/20"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="City"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Availability</span>
            <input
              className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-500/20"
              value={form.availability}
              onChange={(e) => setForm({ ...form, availability: e.target.value })}
              placeholder="Example: Mon-Fri 09:00-17:00"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Session fee (TND)</span>
            <input
              type="number"
              min="0"
              step="1"
              className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-500/20"
              value={form.sessionPrice}
              onChange={(e) => setForm({ ...form, sessionPrice: e.target.value })}
              placeholder="e.g. 80"
            />
          </label>
        </div>

        <label className="mt-4 grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Bio</span>
          <textarea
            className="min-h-[110px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/30 focus:ring-2 focus:ring-indigo-500/20 resize-none"
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Short professional bio..."
          />
        </label>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="text-sm font-semibold text-white">Office Location</div>
        <div className="mt-1 text-xs text-white/60 mb-3">Click on the map to set your office location. This helps patients find you nearby.</div>
        <div className="h-64 rounded-2xl overflow-hidden border border-white/10 relative z-0">
          <MapContainer center={form.location ? [form.location.lat, form.location.lng] : [36.8065, 10.1815]} zoom={13} className="h-full w-full bg-slate-800">
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <LocationMarker position={form.location} setPosition={(pos) => setForm({ ...form, location: pos })} />
          </MapContainer>
        </div>
        {form.location && (
          <div className="mt-2 text-xs text-emerald-400">Location selected: {form.location.lat.toFixed(4)}, {form.location.lng.toFixed(4)}</div>
        )}
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="text-sm font-semibold text-white">Specializations</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {SPECIALIZATIONS.map((s) => (
            <Chip key={s} active={form.specializations.includes(s)} onClick={() => toggleItem('specializations', s)}>
              {s}
            </Chip>
          ))}
        </div>
      </GlassPanel>

      <GlassPanel className="p-5">
        <div className="text-sm font-semibold text-white">Languages</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {LANGUAGES.map((l) => (
            <Chip key={l} active={form.languages.includes(l)} onClick={() => toggleItem('languages', l)}>
              {l}
            </Chip>
          ))}
        </div>
      </GlassPanel>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={fetchProfile}
          className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
          disabled={saving}
        >
          Reset
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || missingRequired}
          className="h-11 flex-1 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save changes'}
        </button>
      </div>
    </div>
  );
}

function LocationMarker({ position, setPosition }) {
  useMapEvents({
    click(e) {
      setPosition(e.latlng);
    },
  });

  return position === null ? null : (
    <Marker position={position}></Marker>
  );
}

