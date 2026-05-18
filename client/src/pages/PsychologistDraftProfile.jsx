import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const Pill = ({ children, tone = 'slate' }) => (
  <span
    className={[
      'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold',
      tone === 'green' ? 'bg-emerald-100 text-emerald-700' : '',
      tone === 'amber' ? 'bg-amber-100 text-amber-800' : '',
      tone === 'red' ? 'bg-rose-100 text-rose-700' : '',
      tone === 'slate' ? 'bg-slate-100 text-slate-700' : ''
    ].join(' ')}
  >
    {children}
  </span>
);

export default function PsychologistDraftProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.get('/api/psychologists/me');
        if (!cancelled) setProfile(data || null);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Failed to load profile');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const status = String(profile?.profileStatus || 'Draft');
  const statusTone = status === 'Approved' ? 'green' : status === 'Rejected' ? 'red' : status === 'Submitted' ? 'amber' : 'slate';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">Your profile</div>
            <h1 className="truncate text-xl font-bold text-blue-700">Draft / Submitted Profile</h1>
          </div>
          <div className="flex items-center gap-3">
            <Pill tone={statusTone}>{status}</Pill>
            <button
              type="button"
              onClick={() => navigate('/setup')}
              className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
            >
              Back to setup
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid gap-4">
        {loading && (
          <div className="bg-white rounded-2xl shadow p-6 text-sm text-gray-600">Loading profile…</div>
        )}

        {!loading && error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-xl">
            {error}
          </div>
        )}

        {!loading && !error && profile && (
          <>
            <div className="bg-white rounded-2xl shadow p-6 grid gap-3">
              <div className="text-lg font-bold text-gray-800">Basic info</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase text-gray-400">Name</div>
                  <div className="mt-1 font-semibold text-gray-800">
                    {profile.firstName || '—'} {profile.lastName || ''}
                  </div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-xs font-semibold uppercase text-gray-400">City</div>
                  <div className="mt-1 font-semibold text-gray-800">{profile.city || '—'}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 md:col-span-2">
                  <div className="text-xs font-semibold uppercase text-gray-400">Availability</div>
                  <div className="mt-1 font-semibold text-gray-800">{profile.availability || '—'}</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6 grid gap-3">
              <div className="text-lg font-bold text-gray-800">Bio</div>
              <div className="text-sm text-gray-700 whitespace-pre-wrap">{profile.bio || '—'}</div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6 grid gap-3">
              <div className="text-lg font-bold text-gray-800">Specializations</div>
              <div className="flex flex-wrap gap-2">
                {(profile.specializations || []).length ? (
                  profile.specializations.map((s) => <Pill key={s}>{s}</Pill>)
                ) : (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6 grid gap-3">
              <div className="text-lg font-bold text-gray-800">Languages</div>
              <div className="flex flex-wrap gap-2">
                {(profile.languages || []).length ? (
                  profile.languages.map((l) => <Pill key={l}>{l}</Pill>)
                ) : (
                  <div className="text-sm text-gray-500">—</div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
