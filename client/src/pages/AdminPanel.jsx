import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';

const API = 'http://localhost:5000';

const getHeaders = () => ({
  Authorization: 'Bearer ' + localStorage.getItem('token'),
  'Content-Type': 'application/json'
});

export default function AdminPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [assetUrls, setAssetUrls] = useState({});
  const [faceChecks, setFaceChecks] = useState({});
  const [faceDiag, setFaceDiag] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (localStorage.getItem('role') !== 'admin') {
      navigate('/login');
      return;
    }
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [statsRes, usersRes, verifyRes] = await Promise.all([
        fetch(API + '/api/admin/stats', { headers: getHeaders() }),
        fetch(API + '/api/admin/users', { headers: getHeaders() }),
        fetch(API + '/api/verification/pending', { headers: getHeaders() })
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const verifyData = await verifyRes.json();

      setStats(statsData);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setPendingVerifications(Array.isArray(verifyData) ? verifyData : []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      const res = await fetch(API + '/api/admin/users/' + id, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || 'Failed to delete user');
      setMessage('User deleted');
      setUsers(users.filter((u) => u._id !== id));
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const updateRole = async (id, role) => {
    try {
      const res = await fetch(API + '/api/admin/users/' + id + '/role', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || 'Failed to update role');
      setMessage('Role updated');
      setUsers(users.map((u) => (u._id === id ? { ...u, role: data.role } : u)));
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const approvePsy = async (id) => {
    try {
      const res = await fetch(API + '/api/verification/' + id + '/approve', {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || 'Failed to approve');
      setMessage('Psychologist approved');
      setPendingVerifications(pendingVerifications.filter((p) => p._id !== id));
    } catch (err) {
      setError('Failed to approve');
    }
  };

  const rejectPsy = async (id) => {
    try {
      const res = await fetch(API + '/api/verification/' + id + '/reject', {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message || 'Failed to reject');
      setMessage('Psychologist rejected');
      setPendingVerifications(pendingVerifications.filter((p) => p._id !== id));
    } catch (err) {
      setError('Failed to reject');
    }
  };

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const viewFile = async (filename) => {
    try {
      const res = await fetch(API + '/api/verification/file/' + filename, {
        headers: getHeaders()
      });
      if (!res.ok) throw new Error('Failed to load file');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url);
    } catch (err) {
      setError('Could not open file');
    }
  };

  const loadAssetPreview = async (key, assetPath) => {
    try {
      const existingUrl = assetUrls[key];
      if (existingUrl) return;

      const res = await fetch(API + '/api/verification/asset?path=' + encodeURIComponent(assetPath), {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      });
      if (!res.ok) throw new Error('Failed to load asset');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setAssetUrls((prev) => ({ ...prev, [key]: url }));
    } catch (err) {
      setError('Could not load asset preview');
    }
  };

  const runFaceCheck = async (psy) => {
    const key = `face:${psy._id}`;
    const userId = typeof psy.userId === 'string' ? psy.userId : psy.userId?._id;
    if (!userId) {
      setFaceChecks((prev) => ({
        ...prev,
        [key]: { loading: false, result: { match: false, confidence: 0, error: 'Missing userId for this request' } }
      }));
      return;
    }

    setFaceChecks((prev) => ({ ...prev, [key]: { loading: true, result: null } }));
    try {
      const res = await fetch(API + '/api/verification/face-check/' + userId, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setFaceChecks((prev) => ({ ...prev, [key]: { loading: false, result: data } }));
    } catch (err) {
      setFaceChecks((prev) => ({
        ...prev,
        [key]: { loading: false, result: { match: false, confidence: 0, error: 'Request failed' } }
      }));
    }
  };

  const loadFaceDiagnostics = async () => {
    try {
      const res = await fetch(API + '/api/verification/face-check-diagnostics', {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
      });
      const data = await res.json();
      setFaceDiag(data);
    } catch (err) {
      setFaceDiag({ error: 'Failed to load diagnostics' });
    }
  };

  useEffect(() => {
    return () => {
      Object.values(assetUrls).forEach((url) => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (e) {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const statCards = useMemo(() => {
    if (!stats) return [];
    return [
      { label: 'Total Users', value: stats.totalUsers },
      { label: 'Patients', value: stats.totalPatients },
      { label: 'Psychologists', value: stats.totalPsychologists },
      { label: 'Total Sessions', value: stats.totalSessions },
      { label: 'Active', value: stats.activeSessions },
      { label: 'Completed', value: stats.completedSessions }
    ];
  }, [stats]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-sm text-white/70">Loading admin dashboard…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-950/50 backdrop-blur">
        <div className="mx-auto max-w-6xl px-6 py-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <PlatformLogo size={40} />
            <div>
              <h1 className="text-xl md:text-2xl font-bold tracking-tight">Admin Dashboard</h1>
              <p className="text-sm text-white/60">Review verifications, manage users, and monitor platform stats.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggleButton />
            <button
              onClick={fetchData}
              className="h-10 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition"
            >
              Refresh
            </button>
            <button
              onClick={logout}
              className="h-10 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white hover:bg-rose-500 transition"
            >
              Logout
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8 space-y-6">
        {error && (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-50">
            {message}
          </div>
        )}

        {statCards.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {statCards.map((s) => (
              <div key={s.label} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{s.label}</div>
                <div className="mt-2 text-2xl font-bold">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold">Users</h2>
            <p className="text-sm text-white/60">Manage roles and remove accounts when needed.</p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-white/5 text-white/70">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Role</th>
                    <th className="px-4 py-3 text-left font-semibold">Created</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-white/5">
                      <td className="px-4 py-3">{u.email}</td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          onChange={(e) => updateRole(u._id, e.target.value)}
                          disabled={u.role === 'admin'}
                          className="h-9 rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60"
                        >
                          <option value="patient">patient</option>
                          <option value="psychologist">psychologist</option>
                          <option value="admin">admin</option>
                        </select>
                      </td>
                      <td className="px-4 py-3 text-white/60">{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        {u.role !== 'admin' && (
                          <button
                            onClick={() => deleteUser(u._id)}
                            className="h-9 rounded-2xl bg-rose-500/90 px-3 text-xs font-semibold text-white hover:bg-rose-500 transition"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Pending Verifications</h2>
              <p className="text-sm text-white/60">Review uploaded documents, intro video, and face check.</p>
            </div>
            <div className="text-sm text-white/60">{pendingVerifications.length} pending</div>
          </div>

          {pendingVerifications.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
              No pending verifications.
            </div>
          )}

          <div className="grid gap-4">
            {pendingVerifications.map((psy) => (
              <div key={psy._id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-base">{psy.firstName} {psy.lastName}</p>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-semibold text-white/70">
                        {psy.city || '—'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-white/60 break-all">{psy.userId?.email}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {psy.cvUrl && (
                        <button
                          onClick={() => viewFile(psy.cvUrl)}
                          className="h-9 rounded-2xl bg-indigo-500/90 px-3 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                        >
                          View CV
                        </button>
                      )}
                      {psy.diplomaUrl && (
                        <button
                          onClick={() => viewFile(psy.diplomaUrl)}
                          className="h-9 rounded-2xl bg-indigo-500/90 px-3 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                        >
                          View Diploma
                        </button>
                      )}
                      {psy.introVideo && (
                        <button
                          onClick={() => loadAssetPreview(`introVideo:${psy._id}`, psy.introVideo)}
                          className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                        >
                          Load Intro Video
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => approvePsy(psy._id)}
                      className="h-10 rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white hover:bg-emerald-500 transition"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => rejectPsy(psy._id)}
                      className="h-10 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white hover:bg-rose-500 transition"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                {psy.aiVerificationSummary && (
                  <details className="mt-4 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <summary className="cursor-pointer select-none text-sm font-semibold text-white/80">
                      AI Analysis
                    </summary>
                    <div className="mt-3 whitespace-pre-wrap text-sm text-white/70">{psy.aiVerificationSummary}</div>
                  </details>
                )}

                {assetUrls[`introVideo:${psy._id}`] && (
                  <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <p className="text-sm font-semibold text-white/80">Introduction Video</p>
                    <video
                      src={assetUrls[`introVideo:${psy._id}`]}
                      controls
                      className="mt-3 w-full max-h-80 rounded-2xl bg-black/40"
                    />
                  </div>
                )}

                <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <p className="text-sm font-semibold text-white/80">Automated Face Verification</p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => runFaceCheck(psy)}
                        disabled={!psy.userId?._id && typeof psy.userId !== 'string' ? true : faceChecks[`face:${psy._id}`]?.loading}
                        className="h-9 rounded-2xl bg-indigo-500/90 px-3 text-xs font-semibold text-white hover:bg-indigo-500 transition disabled:opacity-60"
                      >
                        {faceChecks[`face:${psy._id}`]?.loading ? 'Running…' : 'Run Face Check'}
                      </button>
                      <button
                        onClick={loadFaceDiagnostics}
                        className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                      >
                        Diagnostics
                      </button>
                    </div>
                  </div>

                  {faceChecks[`face:${psy._id}`]?.result && (
                    <div className="mt-3 text-sm text-white/70">
                      {faceChecks[`face:${psy._id}`].result.error ? (
                        <p>Face check could not be completed: {faceChecks[`face:${psy._id}`].result.error}</p>
                      ) : faceChecks[`face:${psy._id}`].result.match ? (
                        <p>
                          Face Match Confirmed <span className="text-white/50">·</span> Confidence: {faceChecks[`face:${psy._id}`].result.confidence}%
                        </p>
                      ) : (
                        <p>
                          Face Mismatch Detected <span className="text-white/50">·</span> Confidence: {faceChecks[`face:${psy._id}`].result.confidence}%
                        </p>
                      )}
                    </div>
                  )}

                  {faceDiag && (
                    <details className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                      <summary className="cursor-pointer select-none text-xs font-semibold text-white/70">Diagnostics output</summary>
                      <pre className="mt-2 whitespace-pre-wrap text-xs text-white/60">{JSON.stringify(faceDiag, null, 2)}</pre>
                    </details>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
