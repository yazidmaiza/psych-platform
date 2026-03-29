import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SPECIALIZATIONS = [
  'Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD',
  'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'
];

const LANGUAGES = ['Arabic', 'French', 'English', 'Darija'];

export default function EditProfile() {
  const navigate = useNavigate();
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

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const userId = localStorage.getItem('userId');
        const data = await api.get('/api/psychologists?userId=' + userId);
        if (data && data.length > 0) {
          const p = data[0];
          setForm({
            firstName: p.firstName || '',
            lastName: p.lastName || '',
            bio: p.bio || '',
            city: p.city || '',
            availability: p.availability || '',
            specializations: p.specializations || [],
            languages: p.languages || []
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const toggleItem = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(i => i !== value)
        : [...prev[field], value]
    }));
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.city) {
      return setError('First name, last name and city are required.');
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/api/psychologists/me', form);
      setSuccess('Profile updated successfully.');
      setTimeout(() => navigate('/psychologist/dashboard'), 1500);
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate('/psychologist/dashboard')} className="text-blue-600 text-sm font-semibold hover:underline">
            {'<- Back to Dashboard'}
          </button>
          <h1 className="text-xl font-bold text-blue-700">Edit Profile</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">
        {error && <p className="text-red-500 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">{success}</p>}

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Basic Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">First Name</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.firstName}
                onChange={e => setForm({ ...form, firstName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Last Name</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.lastName}
                onChange={e => setForm({ ...form, lastName: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">City</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.city}
                onChange={e => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Availability</label>
              <input
                className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                value={form.availability}
                onChange={e => setForm({ ...form, availability: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Bio</label>
            <textarea
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
              rows={3}
              value={form.bio}
              onChange={e => setForm({ ...form, bio: e.target.value })}
            />
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Specializations</h2>
          <div className="flex flex-wrap gap-2">
            {SPECIALIZATIONS.map(s => (
              <button
                key={s}
                onClick={() => toggleItem('specializations', s)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${form.specializations.includes(s)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow p-6">
          <h2 className="text-lg font-bold text-gray-700 mb-4">Languages</h2>
          <div className="flex flex-wrap gap-2">
            {LANGUAGES.map(l => (
              <button
                key={l}
                onClick={() => toggleItem('languages', l)}
                className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${form.languages.includes(l)
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                  }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
