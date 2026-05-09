import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';

const API = 'http://localhost:5000';
const REVIEW_QUEUE_FILTERS_KEY = 'admin_review_queue_filters_v1';

const getHeaders = () => ({
  Authorization: 'Bearer ' + localStorage.getItem('token'),
  'Content-Type': 'application/json'
});

export default function AdminPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit, setQueueLimit] = useState(20);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);
  const [queueFilters, setQueueFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(REVIEW_QUEUE_FILTERS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        status: parsed?.status || 'Submitted',
        rejected: typeof parsed?.rejected === 'boolean' ? parsed.rejected : null,
        completeness: parsed?.completeness || '',
        dateFrom: parsed?.dateFrom || '',
        dateTo: parsed?.dateTo || '',
        sortBy: parsed?.sortBy || 'submittedAt',
        order: parsed?.order || 'desc',
        search: parsed?.search || ''
      };
    } catch {
      return {
        status: 'Submitted',
        rejected: null,
        completeness: '',
        dateFrom: '',
        dateTo: '',
        sortBy: 'submittedAt',
        order: 'desc',
        search: ''
      };
    }
  });
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

  useEffect(() => {
    try {
      localStorage.setItem(REVIEW_QUEUE_FILTERS_KEY, JSON.stringify(queueFilters));
    } catch {
      // ignore
    }
  }, [queueFilters]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const [statsRes, usersRes, verifyRes] = await Promise.all([
        fetch(API + '/api/admin/stats', { headers: getHeaders() }),
        fetch(API + '/api/admin/users', { headers: getHeaders() }),
        fetchReviewQueue({ page: 1, limit: queueLimit, filters: queueFilters })
      ]);

      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const verifyData = verifyRes;

      setStats(statsData);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setPendingVerifications(Array.isArray(verifyData?.items) ? verifyData.items : []);
      setQueuePage(verifyData?.page || 1);
      setQueueLimit(verifyData?.limit || queueLimit);
      setQueueTotal(verifyData?.total || 0);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviewQueue = async ({ page, limit, filters }) => {
    const params = new URLSearchParams();
    params.set('page', String(page || 1));
    params.set('limit', String(limit || 20));
    if (filters?.status) params.set('status', filters.status);
    if (typeof filters?.rejected === 'boolean') params.set('rejected', String(filters.rejected));
    if (filters?.completeness) params.set('completeness', filters.completeness);
    if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.set('dateTo', filters.dateTo);
    if (filters?.sortBy) params.set('sortBy', filters.sortBy);
    if (filters?.order) params.set('order', filters.order);
    if (filters?.search) params.set('search', filters.search);

    const res = await fetch(API + `/api/review-queue/applications?${params.toString()}`, { headers: getHeaders() });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to load review queue');
    return data;
  };

  const refreshPendingVerifications = async (overrides = {}) => {
    setQueueLoading(true);
    try {
      const data = await fetchReviewQueue({
        page: overrides.page || queuePage || 1,
        limit: overrides.limit || queueLimit || 20,
        filters: overrides.filters || queueFilters
      });
      setPendingVerifications(Array.isArray(data?.items) ? data.items : []);
      setQueuePage(data?.page || 1);
      setQueueLimit(data?.limit || queueLimit);
      setQueueTotal(data?.total || 0);
      return Array.isArray(data?.items) ? data.items : [];
    } finally {
      setQueueLoading(false);
    }
  };

  const getLatestPendingPsychologist = async (psychologistId) => {
    const refreshed = await refreshPendingVerifications();
    return refreshed.find((p) => String(p._id) === String(psychologistId)) || null;
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
      const reason = window.prompt('Rejection reason (required):');
      if (!reason || !String(reason).trim()) {
        return setError('Rejection reason is required.');
      }
      const res = await fetch(API + '/api/verification/' + id + '/reject', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ reason: String(reason).trim() })
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

  const goToAuditLog = () => navigate('/admin/audit');

  const fetchCredentialAccessUrl = async (docId, ttlSeconds = 300) => {
    const res = await fetch(API + `/api/credential-documents/${docId}/access-url?ttlSeconds=${ttlSeconds}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to get access URL');
    const url = String(data.url || '');
    if (!url.startsWith('/')) return url;
    return API + url;
  };

  const openCredentialDocument = async (credentialDoc) => {
    try {
      if (!credentialDoc?._id) throw new Error('Missing document id');
      const signedUrl = await fetchCredentialAccessUrl(credentialDoc._id, 300);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error('Failed to load document');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      window.open(url);
    } catch (err) {
      setError(err.message || 'Could not open document');
    }
  };

  const loadCredentialPreview = async (key, credentialDoc) => {
    try {
      const existingUrl = assetUrls[key];
      if (existingUrl) return;

      if (!credentialDoc?._id) throw new Error('Missing document id');
      const signedUrl = await fetchCredentialAccessUrl(credentialDoc._id, 300);
      const res = await fetch(signedUrl);
      if (!res.ok) throw new Error('Failed to load document');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      setAssetUrls((prev) => ({ ...prev, [key]: url }));
    } catch (err) {
      setError(err.message || 'Could not load preview');
    }
  };

  const resolveCredentialDocFromPsy = (psy, type) => {
    const candidate = psy?.credentialDocs?.[type];
    if (!candidate || !candidate._id) return null;
    return candidate;
  };

  const openLatestCredentialDocument = async (psychologistId, type) => {
    try {
      const latest = await getLatestPendingPsychologist(psychologistId);
      if (!latest) throw new Error('Psychologist is not in the pending list (refresh the page).');
      const doc = resolveCredentialDocFromPsy(latest, type);
      if (!doc) throw new Error('Document not found for this psychologist.');
      await openCredentialDocument(doc);
    } catch (err) {
      setError(err.message || 'Could not open document');
    }
  };

  const loadLatestCredentialPreview = async (psychologistId, type) => {
    try {
      const latest = await getLatestPendingPsychologist(psychologistId);
      if (!latest) throw new Error('Psychologist is not in the pending list (refresh the page).');
      const doc = resolveCredentialDocFromPsy(latest, type);
      if (!doc) throw new Error('Document not found for this psychologist.');
      const key = `${type}:${psychologistId}:${doc._id}`;
      await loadCredentialPreview(key, doc);
    } catch (err) {
      setError(err.message || 'Could not load preview');
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
              onClick={goToAuditLog}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Audit Log
            </button>
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
            <div className="text-sm text-white/60">
              {queueLoading ? 'Loading…' : `${pendingVerifications.length} shown`} <span className="text-white/30">·</span> Total: {queueTotal}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="md:col-span-1">
                <div className="text-xs font-semibold text-white/60">Status</div>
                <select
                  value={queueFilters.status}
                  onChange={(e) => {
                    setQueuePage(1);
                    setQueueFilters((prev) => ({ ...prev, status: e.target.value }));
                    refreshPendingVerifications({ page: 1, filters: { ...queueFilters, status: e.target.value } });
                  }}
                  className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
                >
                  <option value="Submitted">Submitted</option>
                  <option value="Rejected">Rejected</option>
                  <option value="Approved">Approved</option>
                  <option value="Draft">Draft</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <div className="text-xs font-semibold text-white/60">Rejected</div>
                <select
                  value={queueFilters.rejected === null ? '' : String(queueFilters.rejected)}
                  onChange={(e) => {
                    const v = e.target.value === '' ? null : e.target.value === 'true';
                    setQueuePage(1);
                    setQueueFilters((prev) => ({ ...prev, rejected: v }));
                    refreshPendingVerifications({ page: 1, filters: { ...queueFilters, rejected: v } });
                  }}
                  className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
                >
                  <option value="">All</option>
                  <option value="false">Not rejected</option>
                  <option value="true">Rejected</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <div className="text-xs font-semibold text-white/60">Completeness</div>
                <select
                  value={queueFilters.completeness}
                  onChange={(e) => {
                    setQueuePage(1);
                    setQueueFilters((prev) => ({ ...prev, completeness: e.target.value }));
                    refreshPendingVerifications({ page: 1, filters: { ...queueFilters, completeness: e.target.value } });
                  }}
                  className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
                >
                  <option value="">All</option>
                  <option value="complete">Complete</option>
                  <option value="docs_only">Docs only</option>
                  <option value="incomplete">Incomplete</option>
                </select>
              </div>

              <div className="md:col-span-1">
                <div className="text-xs font-semibold text-white/60">Submitted from</div>
                <input
                  type="date"
                  value={queueFilters.dateFrom}
                  onChange={(e) => setQueueFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                  onBlur={() => {
                    setQueuePage(1);
                    refreshPendingVerifications({ page: 1, filters: queueFilters });
                  }}
                  className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
                />
              </div>

              <div className="md:col-span-1">
                <div className="text-xs font-semibold text-white/60">Submitted to</div>
                <input
                  type="date"
                  value={queueFilters.dateTo}
                  onChange={(e) => setQueueFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                  onBlur={() => {
                    setQueuePage(1);
                    refreshPendingVerifications({ page: 1, filters: queueFilters });
                  }}
                  className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
                />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-5">
              <div className="md:col-span-3">
                <div className="text-xs font-semibold text-white/60">Search (name, email, city)</div>
                <input
                  value={queueFilters.search}
                  onChange={(e) => setQueueFilters((prev) => ({ ...prev, search: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setQueuePage(1);
                      refreshPendingVerifications({ page: 1, filters: queueFilters });
                    }
                  }}
                  placeholder="Search…"
                  className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
                />
              </div>

              <div className="md:col-span-1">
                <div className="text-xs font-semibold text-white/60">Sort</div>
                <select
                  value={`${queueFilters.sortBy}:${queueFilters.order}`}
                  onChange={(e) => {
                    const [sortBy, order] = String(e.target.value).split(':');
                    const next = { ...queueFilters, sortBy, order };
                    setQueuePage(1);
                    setQueueFilters(next);
                    refreshPendingVerifications({ page: 1, filters: next });
                  }}
                  className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
                >
                  <option value="submittedAt:desc">Submitted (newest)</option>
                  <option value="submittedAt:asc">Submitted (oldest)</option>
                  <option value="createdAt:desc">Created (newest)</option>
                  <option value="createdAt:asc">Created (oldest)</option>
                </select>
              </div>

              <div className="md:col-span-1 flex items-end gap-2">
                <button
                  onClick={() => refreshPendingVerifications({ page: 1 })}
                  className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Apply
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs text-white/50">
                Page {queuePage} <span className="text-white/30">·</span> {queueLimit}/page
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const next = Math.max(1, queuePage - 1);
                    setQueuePage(next);
                    refreshPendingVerifications({ page: next });
                  }}
                  disabled={queuePage <= 1 || queueLoading}
                  className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-60"
                >
                  Prev
                </button>
                <button
                  onClick={() => {
                    const maxPage = Math.max(1, Math.ceil((queueTotal || 0) / (queueLimit || 20)));
                    const next = Math.min(maxPage, queuePage + 1);
                    setQueuePage(next);
                    refreshPendingVerifications({ page: next });
                  }}
                  disabled={queueLoading}
                  className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-60"
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          {pendingVerifications.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
              No applications match the current filters.
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
                      {psy.credentialDocs?.cv && (
                        <button
                          onClick={() => openLatestCredentialDocument(psy._id, 'cv')}
                          className="h-9 rounded-2xl bg-indigo-500/90 px-3 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                        >
                          View CV
                        </button>
                      )}
                      {psy.credentialDocs?.diploma && (
                        <button
                          onClick={() => openLatestCredentialDocument(psy._id, 'diploma')}
                          className="h-9 rounded-2xl bg-indigo-500/90 px-3 text-xs font-semibold text-white hover:bg-indigo-500 transition"
                        >
                          View Diploma
                        </button>
                      )}
                      {psy.credentialDocs?.introVideo && (
                        <button
                          onClick={() => loadLatestCredentialPreview(psy._id, 'introVideo')}
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

                {Object.keys(assetUrls).some((k) => k.startsWith(`introVideo:${psy._id}:`)) && (
                  <div className="mt-4 rounded-3xl border border-white/10 bg-slate-950/30 p-4">
                    <p className="text-sm font-semibold text-white/80">Introduction Video</p>
                    <video
                      src={assetUrls[Object.keys(assetUrls).find((k) => k.startsWith(`introVideo:${psy._id}:`))]}
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
