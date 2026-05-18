import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SPECIALIZATIONS = [
  'Anxiety', 'Depression', 'Stress', 'Trauma', 'PTSD',
  'Relationships', 'Family', 'Addiction', 'Sleep', 'Self-esteem'
];

const LANGUAGES = ['Arabic', 'French', 'English', 'Darija'];

export default function PsychologistSetup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: documents, 2: profile, 3: awaiting admin

  const [checklist, setChecklist] = useState({
    cv: false,
    diploma: false,
    idFront: false,
    idBack: false,
    introVideo: false
  });
  const [checklistLoading, setChecklistLoading] = useState(false);

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
  const [idFront, setIdFront] = useState(null);
  const [idBack, setIdBack] = useState(null);
  const [introVideo, setIntroVideo] = useState(null);

  const [idFrontPreview, setIdFrontPreview] = useState('');
  const [idBackPreview, setIdBackPreview] = useState('');
  const [introVideoPreview, setIntroVideoPreview] = useState('');

  const [loading, setLoading] = useState(false);
  const [uploadingType, setUploadingType] = useState('');
  const [error, setError] = useState('');

  const refreshChecklist = async () => {
    setChecklistLoading(true);
    try {
      const data = await api.get('/api/credential-documents/checklist');
      setChecklist(
        data?.checklist || {
          cv: false,
          diploma: false,
          idFront: false,
          idBack: false,
          introVideo: false
        }
      );
    } catch (e) {
      // best-effort; upload calls will surface any errors
    } finally {
      setChecklistLoading(false);
    }
  };

  useEffect(() => {
    refreshChecklist();
  }, []);

  useEffect(() => {
    if (!idFront) {
      setIdFrontPreview('');
      return;
    }
    const url = URL.createObjectURL(idFront);
    setIdFrontPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [idFront]);

  useEffect(() => {
    if (!idBack) {
      setIdBackPreview('');
      return;
    }
    const url = URL.createObjectURL(idBack);
    setIdBackPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [idBack]);

  useEffect(() => {
    if (!introVideo) {
      setIntroVideoPreview('');
      return;
    }
    const url = URL.createObjectURL(introVideo);
    setIntroVideoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [introVideo]);

  const toggleItem = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value) ? prev[field].filter((i) => i !== value) : [...prev[field], value]
    }));
  };

  const uploadOne = async (type, file) => {
    if (!file) return;
    setLoading(true);
    setUploadingType(type);
    setError('');
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('file', file);
      await api.postForm('/api/credential-documents/upload', formData);
      await refreshChecklist();
    } catch (err) {
      setError(err.message || 'Failed to upload document.');
    } finally {
      setLoading(false);
      setUploadingType('');
    }
  };

  const handleDocumentsContinue = () => {
    const allComplete = Object.values(checklist).every(Boolean);
    if (!allComplete) {
      setError('Please upload your CV, diploma, ID front/back, and intro video before continuing.');
      return;
    }
    setError('');
    setStep(2);
  };

  const handleProfileSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.city) {
      return setError('First name, last name and city are required.');
    }
    setLoading(true);
    setError('');
    try {
      // New signups create a draft psychologist row; fill it in here.
      // Older accounts may not have one yet.
      try {
        await api.put('/api/psychologists/me', form);
      } catch (e) {
        if (e?.status === 404) await api.post('/api/psychologists/profile', form);
        else throw e;
      }

      await api.post('/api/onboarding/submit', {});
      navigate('/psychologist/draft-profile');
    } catch (err) {
      setError(err.message || 'Failed to submit onboarding. Please try again.');
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
            Your onboarding application has been submitted. An admin will review your documents and approve or reject your profile.
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
          <h1 className="text-xl font-bold text-blue-700">{step === 1 ? 'Upload Your Credential Documents' : 'Complete Your Profile'}</h1>
          <span className="text-sm text-gray-400">Step {step} of 2</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 text-sm p-4 rounded-xl">
            {error}
          </div>
        )}

        {step === 1 && (
          <>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700">
              Upload your credential documents first. After that, you’ll complete your profile details and submit for admin review.
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-700">Documents</h2>
                <span className="text-xs text-gray-400">{checklistLoading ? 'Checking...' : ''}</span>
              </div>

              <div className="flex flex-col gap-6">
                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-2 block">CV (PDF only)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setCv(e.target.files[0] || null)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">{checklist.cv ? 'Uploaded' : 'Not uploaded'}</div>
                    <button
                      type="button"
                      onClick={() => uploadOne('cv', cv)}
                      disabled={loading || !cv}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200"
                    >
                      {uploadingType === 'cv' ? 'Uploading...' : checklist.cv ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-semibold text-gray-600 mb-2 block">Diploma (PDF only)</label>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setDiploma(e.target.files[0] || null)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
                  />
                  <div className="mt-2 flex items-center justify-between gap-3">
                    <div className="text-xs text-gray-500">{checklist.diploma ? 'Uploaded' : 'Not uploaded'}</div>
                    <button
                      type="button"
                      onClick={() => uploadOne('diploma', diploma)}
                      disabled={loading || !diploma}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200"
                    >
                      {uploadingType === 'diploma' ? 'Uploading...' : checklist.diploma ? 'Replace' : 'Upload'}
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-700">ID Card</h3>
                  <p className="text-xs text-gray-500 mt-1">Upload clear images (JPG/JPEG/PNG, max 5MB each).</p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-2 block">Front</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => setIdFront(e.target.files[0] || null)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
                      />
                      {idFrontPreview && (
                        <img
                          src={idFrontPreview}
                          alt="ID front preview"
                          className="mt-2 w-full h-40 object-contain bg-gray-50 border border-gray-200 rounded-xl"
                        />
                      )}
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">{checklist.idFront ? 'Uploaded' : 'Not uploaded'}</div>
                        <button
                          type="button"
                          onClick={() => uploadOne('idFront', idFront)}
                          disabled={loading || !idFront}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200"
                        >
                          {uploadingType === 'idFront' ? 'Uploading...' : checklist.idFront ? 'Replace' : 'Upload'}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-semibold text-gray-600 mb-2 block">Back</label>
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={(e) => setIdBack(e.target.files[0] || null)}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
                      />
                      {idBackPreview && (
                        <img
                          src={idBackPreview}
                          alt="ID back preview"
                          className="mt-2 w-full h-40 object-contain bg-gray-50 border border-gray-200 rounded-xl"
                        />
                      )}
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <div className="text-xs text-gray-500">{checklist.idBack ? 'Uploaded' : 'Not uploaded'}</div>
                        <button
                          type="button"
                          onClick={() => uploadOne('idBack', idBack)}
                          disabled={loading || !idBack}
                          className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200"
                        >
                          {uploadingType === 'idBack' ? 'Uploading...' : checklist.idBack ? 'Replace' : 'Upload'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-700">Introduction Video</h3>
                  <p className="text-xs text-gray-500 mt-1">Record a short video (1–3 min) introducing yourself to patients.</p>

                  <div className="mt-3">
                    <input
                      type="file"
                      accept="video/mp4,video/webm,video/quicktime,.mov"
                      onChange={(e) => setIntroVideo(e.target.files[0] || null)}
                      className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm"
                    />
                    {introVideoPreview && (
                      <video
                        src={introVideoPreview}
                        controls
                        className="mt-2 w-full max-h-64 bg-gray-50 border border-gray-200 rounded-xl"
                      />
                    )}
                    <div className="mt-2 flex items-center justify-between gap-3">
                      <div className="text-xs text-gray-500">{checklist.introVideo ? 'Uploaded' : 'Not uploaded'}</div>
                      <button
                        type="button"
                        onClick={() => uploadOne('introVideo', introVideo)}
                        disabled={loading || !introVideo}
                        className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:bg-slate-200 disabled:text-slate-500 disabled:hover:bg-slate-200"
                      >
                        {uploadingType === 'introVideo' ? 'Uploading...' : checklist.introVideo ? 'Replace' : 'Upload'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleDocumentsContinue}
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
            >
              Continue to Profile -&gt;
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Basic Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">First Name</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="First name"
                    value={form.firstName}
                    onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Last Name</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="Last name"
                    value={form.lastName}
                    onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">City</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="City"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 uppercase font-semibold mb-1 block">Availability</label>
                  <input
                    className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    placeholder="e.g. Mon-Fri 9am-5pm"
                    value={form.availability}
                    onChange={(e) => setForm({ ...form, availability: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow p-6">
              <h2 className="text-lg font-bold text-gray-700 mb-4">Specializations</h2>
              <div className="flex flex-wrap gap-2">
                {SPECIALIZATIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => toggleItem('specializations', s)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                      form.specializations.includes(s)
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
                {LANGUAGES.map((l) => (
                  <button
                    key={l}
                    onClick={() => toggleItem('languages', l)}
                    className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${
                      form.languages.includes(l)
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
              {loading ? 'Submitting...' : 'Submit for Admin Review ->'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
