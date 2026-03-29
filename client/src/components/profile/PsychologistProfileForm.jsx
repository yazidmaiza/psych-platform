import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../../services/api';
import GlassPanel from '../dashboard/GlassPanel';

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
    languages: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (!userId) throw new Error('Missing user id');
      const p = await api.get('/api/psychologists/by-user/' + userId);
      setForm({
        firstName: p.firstName || '',
        lastName: p.lastName || '',
        bio: p.bio || '',
        city: p.city || '',
        availability: p.availability || '',
        specializations: p.specializations || [],
        languages: p.languages || []
      });
    } catch (e) {
      setError(e.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

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

  const handleSave = async () => {
    if (missingRequired) {
      setError('First name, last name and city are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/api/psychologists/me', form);
      setSuccess('Profile updated successfully.');
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

