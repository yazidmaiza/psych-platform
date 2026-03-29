import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SPECIALIZATIONS = [
  'Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD',
  'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'
];

const LANGUAGES = ['Arabic', 'French', 'English', 'Darija'];

export default function PsychologistSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    bio: '',
    city: '',
    availability: '',
    specializations: [],
    languages: []
  });
  const [cv, setCv] = useState(null);
  const [diploma, setDiploma] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleItem = (field, value) => {
    setForm(prev => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter(i => i !== value)
        : [...prev[field], value]
    }));
  };

  const handleProfileSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.city) {
      return setError('First name, last name and city are required.');
    }
    setLoading(true);
    setError('');
    try {
      await api.post('/api/psychologists/profile', form);
      setStep(2);
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async () => {
    if (!cv || !diploma) {
      return setError('Both CV and diploma are required.');
    }
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('cv', cv);
      formData.append('diploma', diploma);

      const res = await fetch('http://localhost:5000/api/verification/upload', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      setStep(3);
    } catch (err) {
      setError(err.message || 'Failed to upload documents.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 3) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow p-10 max-w-md w-full text-center">
          <div className="text-2xl mb-4">Submitting...</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Awaiting Admin Approval</h2>
          <p className="text-gray-500 text-sm">
            Your documents have been submitted and analyzed. An admin will review and approve your account shortly.
          </p>
          <button
            onClick={() => navigate('/psychologist/dashboard')}
            className="mt-6 w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-blue-700">
            {step === 1 ? 'Complete Your Profile' : 'Upload Your Documents'}
          </h1>
          <span className="text-sm text-gray-400">Step {step} of 2</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">
        {error && <p className="text-red-500 text-sm">{error}</p>}

        {step === 1 && (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Basic Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">First Name</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={e => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Last Name</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={e => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">City</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="City"
                    value={form.city}
                    onChange={e => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Availability</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="e.g. Mon-Fri 9am-5pm"
                    value={form.availability}
                    onChange={e => setForm({ ...form, availability: e.target.value })}
                  />
                </div>
              </div>
              <div className="mt-4">
                <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Bio</label>
                <textarea
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                  placeholder="Describe your experience and approach..."
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
              onClick={handleProfileSubmit}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Continue to Document Upload ->'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
              Please upload your CV and diploma in PDF format. Our AI will analyze them and an admin will approve your account.
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-6">Upload Documents</h2>

              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-2 block">CV (PDF only)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => setCv(e.target.files[0])}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
                  />
                  {cv && <p className="text-green-600 text-xs mt-1">Selected: {cv.name}</p>}
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-2 block">Diploma (PDF only)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={e => setDiploma(e.target.files[0])}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
                  />
                  {diploma && <p className="text-green-600 text-xs mt-1">Selected: {diploma.name}</p>}
                </div>
              </div>
            </div>

            <button
              onClick={handleDocumentUpload}
              disabled={loading || !cv || !diploma}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? 'Uploading & Analyzing...' : 'Submit for Verification ->'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

