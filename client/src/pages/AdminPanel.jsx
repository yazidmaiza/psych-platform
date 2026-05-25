import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, toAbsoluteUrl, BASE_URL } from '../services/api';
import { logout } from '../services/auth';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import GlassPanel from '../components/dashboard/GlassPanel';

const API_QUEUE_LIMIT = 8;
const QUEUE_FILTERS_KEY = 'admin_review_queue_filters_v2';

const ROLE_OPTIONS = [
  { value: 'all', label: 'All roles' },
  { value: 'patient', label: 'Patients' },
  { value: 'psychologist', label: 'Psychologists' },
  { value: 'admin', label: 'Admins' }
];

const QUEUE_STATUS_OPTIONS = [
  { value: 'Submitted', label: 'Submitted' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Draft', label: 'Draft' }
];

const COMPLETENESS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'complete', label: 'Complete' },
  { value: 'docs_only', label: 'Docs only' },
  { value: 'incomplete', label: 'Incomplete' }
];

const STAT_TONES = {
  totalUsers: 'from-indigo-500/20 to-cyan-500/10',
  totalPatients: 'from-emerald-500/20 to-emerald-500/10',
  totalPsychologists: 'from-fuchsia-500/20 to-fuchsia-500/10',
  totalSessions: 'from-amber-500/20 to-amber-500/10',
  activeSessions: 'from-sky-500/20 to-sky-500/10',
  completedSessions: 'from-rose-500/20 to-rose-500/10'
};

const DOC_LABELS = {
  cv: 'CV',
  diploma: 'Diploma',
  idFront: 'ID Front',
  idBack: 'ID Back',
  introVideo: 'Intro Video'
};

const getQueueFiltersFromStorage = () => {
  const fallback = {
    status: 'Submitted',
    rejected: null,
    completeness: '',
    dateFrom: '',
    dateTo: '',
    sortBy: 'submittedAt',
    order: 'desc',
    search: ''
  };

  try {
    const raw = localStorage.getItem(QUEUE_FILTERS_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      status: parsed?.status || fallback.status,
      rejected: typeof parsed?.rejected === 'boolean' ? parsed.rejected : null,
      completeness: parsed?.completeness || fallback.completeness,
      dateFrom: parsed?.dateFrom || fallback.dateFrom,
      dateTo: parsed?.dateTo || fallback.dateTo,
      sortBy: parsed?.sortBy || fallback.sortBy,
      order: parsed?.order || fallback.order,
      search: parsed?.search || fallback.search
    };
  } catch {
    return fallback;
  }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

const getPersonName = (person = {}) => {
  const parts = [person.firstName, person.lastName].map((part) => String(part || '').trim()).filter(Boolean);
  if (parts.length > 0) return parts.join(' ');
  if (person.fullName) return String(person.fullName).trim();
  if (person.email) return String(person.email).split('@')[0];
  return 'Unknown user';
};

const getInitials = (name) => {
  const cleaned = String(name || '').trim();
  if (!cleaned) return '??';
  const pieces = cleaned.split(/\s+/).filter(Boolean).slice(0, 2);
  return pieces.map((piece) => piece[0]).join('').toUpperCase();
};

const getRoleTone = (role) => {
  if (role === 'admin') return 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/25';
  if (role === 'psychologist') return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25';
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
};

const getStatusTone = (status) => {
  const normalized = String(status || '').toLowerCase();
  if (normalized === 'approved') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (normalized === 'rejected') return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
  if (normalized === 'submitted') return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/25';
  if (normalized === 'draft') return 'bg-white/10 text-white/60 border-white/10';
  return 'bg-white/10 text-white/60 border-white/10';
};

const getCompletenessTone = (value) => {
  if (value === 'complete') return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25';
  if (value === 'docs_only') return 'bg-amber-500/15 text-amber-300 border-amber-500/25';
  if (value === 'incomplete') return 'bg-rose-500/15 text-rose-300 border-rose-500/25';
  return 'bg-white/10 text-white/60 border-white/10';
};

const safeArray = (value) => (Array.isArray(value) ? value : []);

const formatRelativeTime = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours} hr ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
};

// removed unused `toPercentRating` helper

const toStarString = (rating = 0) => {
  const normalized = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return '★★★★★'.slice(0, normalized) + '☆☆☆☆☆'.slice(0, 5 - normalized);
};

const getAccuracyTone = (value) => {
  if (value === 'accurate') return 'border-emerald-500/25 bg-emerald-500/15 text-emerald-200';
  if (value === 'partially_accurate') return 'border-amber-500/25 bg-amber-500/15 text-amber-200';
  if (value === 'inaccurate') return 'border-rose-500/25 bg-rose-500/15 text-rose-200';
  return 'border-white/10 bg-white/5 text-white/60';
};

const buildQueueParams = (page, limit, filters) => {
  const params = new URLSearchParams();
  params.set('page', String(page || 1));
  params.set('limit', String(limit || API_QUEUE_LIMIT));
  if (filters?.status) params.set('status', filters.status);
  if (typeof filters?.rejected === 'boolean') params.set('rejected', String(filters.rejected));
  if (filters?.completeness) params.set('completeness', filters.completeness);
  if (filters?.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.set('dateTo', filters.dateTo);
  if (filters?.sortBy) params.set('sortBy', filters.sortBy);
  if (filters?.order) params.set('order', filters.order);
  if (filters?.search) params.set('search', filters.search);
  return params.toString();
};

const getApplicationDocs = (application) => {
  const docs = application?.credentialDocs || {};
  return [
    ['cv', docs.cv],
    ['diploma', docs.diploma],
    ['introVideo', docs.introVideo]
  ].filter(([, doc]) => Boolean(doc && doc._id));
};

const getMimeHint = (doc) => {
  const mimeType = String(doc?.mimeType || '').toLowerCase();
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'pdf';
  return 'file';
};

const StatCard = ({ label, value, hint, tone }) => (
  <GlassPanel className="p-5">
    <div className={`rounded-3xl border border-white/10 bg-gradient-to-br ${tone} p-4`}>
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-white/60">{hint}</div>}
    </div>
  </GlassPanel>
);

const PreviewPane = ({ preview }) => {
  if (!preview?.doc) {
    return (
      <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
        Select a document to preview it here.
      </div>
    );
  }

  if (preview.loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[1.5rem] border border-white/10 bg-white/5 text-sm text-white/60">
        Loading preview…
      </div>
    );
  }

  if (preview.error) {
    return (
      <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
        {preview.error}
      </div>
    );
  }

  const kind = getMimeHint(preview.doc);

  if (kind === 'image') {
    return <img src={preview.url} alt={preview.doc.originalName || preview.doc.type} className="max-h-[70vh] w-full rounded-[1.5rem] bg-black/20 object-contain" />;
  }

  if (kind === 'video') {
    return <video src={preview.url} controls className="max-h-[70vh] w-full rounded-[1.5rem] bg-black/30" />;
  }

  return <iframe title={preview.doc.originalName || preview.doc.type} src={preview.url} className="h-[70vh] w-full rounded-[1.5rem] border border-white/10 bg-white/5" />;
};

export default function AdminPanel() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [applications, setApplications] = useState([]);
  const [queuePage, setQueuePage] = useState(1);
  const [queueLimit, setQueueLimit] = useState(API_QUEUE_LIMIT);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queueLoading, setQueueLoading] = useState(false);

  const [feedbackAnalytics, setFeedbackAnalytics] = useState(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackError, setFeedbackError] = useState('');
  const [dismissLowConfidenceBanner, setDismissLowConfidenceBanner] = useState(false);
  const [knowledgeGaps, setKnowledgeGaps] = useState(null);
  const [gapsLoading, setGapsLoading] = useState(false);
  const [gapsError, setGapsError] = useState('');

  const [activeTab, setActiveTab] = useState('overview');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  const [queueFilters, setQueueFilters] = useState(() => getQueueFiltersFromStorage());

  const [selectedUser, setSelectedUser] = useState(null);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [userModalRole, setUserModalRole] = useState('patient');
  const [savingUserId, setSavingUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');

  const [selectedApplication, setSelectedApplication] = useState(null);
  const [applicationModalOpen, setApplicationModalOpen] = useState(false);
  const [applicationLoading, setApplicationLoading] = useState(false);
  const [selectedDocKey, setSelectedDocKey] = useState('');
  const [previewState, setPreviewState] = useState({ loading: false, error: '', url: '', doc: null });
  const [rejectReason, setRejectReason] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [faceChecks, setFaceChecks] = useState({});
  const [faceDiagnostics, setFaceDiagnostics] = useState(null);
  const loadDocumentPreview = useCallback(async (docKey, doc) => {
    if (!doc?._id) return;

    setSelectedDocKey(docKey);
    setPreviewState({ loading: true, error: '', url: '', doc });

    try {
      const data = await api.get(`/api/credential-documents/${doc._id}/access-url?ttlSeconds=300`);
      const previewUrl = toAbsoluteUrl(data?.url || '');
      setPreviewState({ loading: false, error: '', url: previewUrl, doc });
    } catch (err) {
      setPreviewState({ loading: false, error: err.message || 'Failed to load preview', url: '', doc });
    }
  }, []);

  const fetchQueueApplications = useCallback(async ({ page = 1, limit = queueLimit, filters = queueFilters } = {}) => {
    const data = await api.get(`/api/review-queue/applications?${buildQueueParams(page, limit, filters)}`);
    return data || { items: [], page, limit, total: 0 };
  }, [queueFilters, queueLimit]);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setFeedbackLoading(true);
    setFeedbackError('');

    try {
      const [statsData, usersData, queueData] = await Promise.all([
        api.get('/api/admin/stats'),
        api.get('/api/admin/users'),
        fetchQueueApplications({ page: 1, limit: API_QUEUE_LIMIT, filters: queueFilters })
      ]);

      setStats(statsData || null);
      setUsers(safeArray(usersData));
      setApplications(safeArray(queueData?.items));
      setQueuePage(queueData?.page || 1);
      setQueueLimit(queueData?.limit || API_QUEUE_LIMIT);
      setQueueTotal(queueData?.total || 0);

      try {
        const analyticsData = await api.get('/api/chatbot/analytics/feedback');
        setFeedbackAnalytics(analyticsData || null);
      } catch (analyticsErr) {
        setFeedbackAnalytics(null);
        setFeedbackError(analyticsErr.message || 'Failed to load chatbot analytics');
      }
    } catch (err) {
      setError(err.message || 'Failed to load admin dashboard');
    } finally {
      setLoading(false);
      setFeedbackLoading(false);
    }
  }, [fetchQueueApplications, queueFilters]);

  const refreshQueue = useCallback(async ({ page = queuePage, filters = queueFilters } = {}) => {
    setQueueLoading(true);
    setError('');
    try {
      const queueData = await fetchQueueApplications({ page, limit: queueLimit || API_QUEUE_LIMIT, filters });
      setApplications(safeArray(queueData?.items));
      setQueuePage(queueData?.page || page || 1);
      setQueueLimit(queueData?.limit || queueLimit || API_QUEUE_LIMIT);
      setQueueTotal(queueData?.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load review queue');
    } finally {
      setQueueLoading(false);
    }
  }, [fetchQueueApplications, queueFilters, queueLimit, queuePage]);

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
      navigate('/login');
      return;
    }

    refreshAll();
  }, [navigate, refreshAll]);

  useEffect(() => {
    try {
      localStorage.setItem(QUEUE_FILTERS_KEY, JSON.stringify(queueFilters));
    } catch {
      // ignore storage failures
    }
  }, [queueFilters]);

  useEffect(() => {
    if (!feedbackAnalytics) return;

    let cancelled = false;
    const loadKnowledgeGaps = async () => {
      setKnowledgeGaps({ gaps: [], covered: [], summary: { totalFlagged: 0, gapCount: 0, coveredCount: 0, checkedAt: '' } });
      setGapsLoading(true);
      setGapsError('');
      try {
        const data = await api.get('/api/chatbot/analytics/knowledge-gaps');
        if (!cancelled) setKnowledgeGaps(data || null);
      } catch (err) {
        if (!cancelled) {
          setKnowledgeGaps(null);
          setGapsError(err.message || 'Failed to load knowledge base gaps');
        }
      } finally {
        if (!cancelled) setGapsLoading(false);
      }
    };

    loadKnowledgeGaps();

    return () => {
      cancelled = true;
    };
  }, [feedbackAnalytics]);

  useEffect(() => {
    if (!selectedApplication) {
      setPreviewState({ loading: false, error: '', url: '', doc: null });
      setSelectedDocKey('');
      setRejectReason('');
      return;
    }

    const docs = getApplicationDocs(selectedApplication);
    const firstDocEntry = docs[0];
    setRejectReason(String(selectedApplication?.rejectionReason || ''));

    if (firstDocEntry) {
      const [docKey, doc] = firstDocEntry;
      setSelectedDocKey(docKey);
      loadDocumentPreview(docKey, doc);
      return;
    }

    setSelectedDocKey('');
    setPreviewState({ loading: false, error: '', url: '', doc: null });
  }, [loadDocumentPreview, selectedApplication]);

  const filteredUsers = useMemo(() => {
    const query = String(userSearch || '').trim().toLowerCase();
    return users.filter((user) => {
      const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter;
      const haystack = [user.firstName, user.lastName, user.fullName, user.email, user.role]
        .map((part) => String(part || '').toLowerCase()).join(' ');
      const matchesSearch = !query || haystack.includes(query);
      return matchesRole && matchesSearch;
    });
  }, [users, userRoleFilter, userSearch]);

  const overviewStats = useMemo(() => {
    if (!stats) return [];
    return [
      { key: 'totalUsers', label: 'Total users', value: stats.totalUsers || 0, hint: 'Registered accounts' },
      { key: 'totalPatients', label: 'Patients', value: stats.totalPatients || 0, hint: 'Patient accounts' },
      { key: 'totalPsychologists', label: 'Psychologists', value: stats.totalPsychologists || 0, hint: 'Professional accounts' },
      { key: 'totalSessions', label: 'Total sessions', value: stats.totalSessions || 0, hint: 'All time sessions' },
      { key: 'activeSessions', label: 'Active sessions', value: stats.activeSessions || 0, hint: 'Currently active' },
      { key: 'completedSessions', label: 'Completed', value: stats.completedSessions || 0, hint: 'Finished sessions' }
    ];
  }, [stats]);

  const queueStats = useMemo(() => {
    const counts = applications.reduce((acc, application) => {
      const status = String(application?.profileStatus || 'Submitted').toLowerCase();
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    return {
      submitted: counts.submitted || 0,
      approved: counts.approved || 0,
      rejected: counts.rejected || 0,
      draft: counts.draft || 0
    };
  }, [applications]);

  const chatbotQuality = useMemo(() => {
    if (!feedbackAnalytics) {
      return {
        totalSummaries: 0,
        totalWithFeedback: 0,
        feedbackCoveragePercent: 0,
        ratings: { average: 0, distribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 } },
        accuracy: { accurate: 0, partially_accurate: 0, inaccurate: 0, accuratePercent: 0 },
        confidence: {
          averageScore: 0,
          lowConfidenceCount: 0,
          lowConfidencePercent: 0,
          avgRatingWhenLowConfidence: 0,
          avgRatingWhenHighConfidence: 0
        },
        recentFeedback: []
      };
    }

    return feedbackAnalytics;
  }, [feedbackAnalytics]);

  const refreshKnowledgeGaps = useCallback(async () => {
    setKnowledgeGaps({ gaps: [], covered: [], summary: { totalFlagged: 0, gapCount: 0, coveredCount: 0, checkedAt: '' } });
    setGapsLoading(true);
    setGapsError('');
    try {
      const data = await api.get('/api/chatbot/analytics/knowledge-gaps');
      setKnowledgeGaps(data || null);
    } catch (err) {
      setKnowledgeGaps({ gaps: [], covered: [], summary: { totalFlagged: 0, gapCount: 0, coveredCount: 0, checkedAt: '' } });
      setKnowledgeGaps({ gaps: [], covered: [], summary: { totalFlagged: 0, gapCount: 0, coveredCount: 0, checkedAt: '' } });
      setGapsError(err.message || 'Failed to load knowledge base gaps');
    } finally {
      setGapsLoading(false);
    }
  }, []);

  const ratingDistribution = chatbotQuality.ratings?.distribution || { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
  const ratingCounts = [1, 2, 3, 4, 5].map((star) => ratingDistribution[String(star)] || 0);
  const ratingMaxCount = Math.max(0, ...ratingCounts);
  const showRatingDistribution = ratingMaxCount > 0;

  const openUserModal = (user) => {
    setSelectedUser(user);
    setUserModalRole(user?.role || 'patient');
    setUserModalOpen(true);
  };

  const saveUserRole = async () => {
    if (!selectedUser?._id) return;
    setSavingUserId(selectedUser._id);
    setError('');

    try {
      const updatedUser = await api.put(`/api/admin/users/${selectedUser._id}/role`, { role: userModalRole });
      setUsers((prev) => prev.map((user) => (user._id === selectedUser._id ? { ...user, ...updatedUser } : user)));
      setSelectedUser((prev) => (prev ? { ...prev, ...updatedUser } : prev));
      setMessage('User role updated');
      setUserModalOpen(false);
    } catch (err) {
      setError(err.message || 'Failed to update role');
    } finally {
      setSavingUserId('');
    }
  };

  const deleteUser = async (user) => {
    if (!user?._id || user.role === 'admin') return;
    const confirmed = window.confirm(`Delete ${getPersonName(user)}? This cannot be undone.`);
    if (!confirmed) return;

    setDeletingUserId(user._id);
    setError('');

    try {
      const response = await fetch(`${BASE_URL}/api/admin/users/${user._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.message || 'Failed to delete user');

      setUsers((prev) => prev.filter((current) => current._id !== user._id));
      setMessage('User deleted');
      await refreshAll();
    } catch (err) {
      setError(err.message || 'Failed to delete user');
    } finally {
      setDeletingUserId('');
    }
  };

  const loadApplicationDetails = async (application) => {
    if (!application?._id) return;
    setApplicationModalOpen(true);
    setApplicationLoading(true);
    setError('');
    setSelectedApplication(application);

    try {
      const detail = await api.get(`/api/review-queue/applications/${application._id}`);
      setSelectedApplication(detail);
    } catch (err) {
      setError(err.message || 'Failed to load application details');
    } finally {
      setApplicationLoading(false);
    }
  };


  const runFaceCheck = async () => {
    if (!selectedApplication?._id) return;
    const userId = selectedApplication.user?._id || selectedApplication.userId?._id || selectedApplication.userId || null;
    if (!userId) {
      setFaceChecks((prev) => ({
        ...prev,
        [selectedApplication._id]: { loading: false, result: { match: false, confidence: 0, error: 'Missing userId for this application' } }
      }));
      return;
    }

    setFaceChecks((prev) => ({ ...prev, [selectedApplication._id]: { loading: true, result: null } }));

    try {
      const result = await api.get(`/api/verification/face-check/${userId}`);
      setFaceChecks((prev) => ({ ...prev, [selectedApplication._id]: { loading: false, result } }));
    } catch (err) {
      setFaceChecks((prev) => ({
        ...prev,
        [selectedApplication._id]: { loading: false, result: { match: false, confidence: 0, error: err.message || 'Face check failed' } }
      }));
    }
  };

  const loadFaceDiagnostics = async () => {
    try {
      const result = await api.get('/api/verification/face-check-diagnostics');
      setFaceDiagnostics(result);
    } catch (err) {
      setFaceDiagnostics({ error: err.message || 'Failed to load diagnostics' });
    }
  };

  const actOnApplication = async (action) => {
    if (!selectedApplication?._id) return;
    if (action === 'reject' && !String(rejectReason || '').trim()) {
      setError('A rejection reason is required');
      return;
    }

    setActionLoading(action);
    setError('');

    try {
      const body = action === 'reject'
        ? { reason: String(rejectReason || '').trim(), details: { fields: [], documents: [] } }
        : {};

      await api.put(`/api/verification/${selectedApplication._id}/${action}`, body);
      setMessage(action === 'approve' ? 'Psychologist approved' : 'Psychologist rejected');
      setApplicationModalOpen(false);
      setSelectedApplication(null);
      setPreviewState({ loading: false, error: '', url: '', doc: null });
      await refreshQueue({ page: queuePage, filters: queueFilters });
    } catch (err) {
      setError(err.message || `Failed to ${action}`);
    } finally {
      setActionLoading('');
    }
  };

  const selectedApplicationDocs = useMemo(() => getApplicationDocs(selectedApplication), [selectedApplication]);

  useEffect(() => {
    if (!selectedApplication || !selectedDocKey) return;
    const doc = selectedApplication?.credentialDocs?.[selectedDocKey];
    if (doc?._id) {
      loadDocumentPreview(selectedDocKey, doc);
    }
  }, [loadDocumentPreview, selectedApplication, selectedDocKey]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[color:var(--app-bg)] text-[color:var(--app-fg)] flex items-center justify-center">
        <div className="text-sm font-semibold text-white/70">Loading admin dashboard…</div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[color:var(--app-bg)] text-[color:var(--app-fg)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 right-0 h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="absolute left-0 top-48 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 rounded-[2rem] border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]/80 px-5 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.15)] backdrop-blur xl:flex-row xl:items-center xl:justify-between">
          <div className="flex items-center gap-4">
            <PlatformLogo size={44} />
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Admin center</div>
              <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Admin Dashboard</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/60">
                Manage users, approve psychologist onboarding, and monitor platform health.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => navigate('/admin/audit')}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Audit log
            </button>
            <button
              type="button"
              onClick={() => refreshAll()}
              className="h-10 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => logout()}
              className="h-10 rounded-2xl bg-rose-500/90 px-4 text-sm font-semibold text-white transition hover:bg-rose-500"
            >
              Logout
            </button>
          </div>
        </header>

        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
          {[
            { id: 'overview', label: 'Overview' },
            { id: 'users', label: 'Users' },
            { id: 'verifications', label: 'Verifications' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${activeTab === tab.id
                ? 'border-[color:var(--accent-25)] bg-[color:var(--accent-10)] text-[color:var(--app-fg)]'
                : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)]/70 text-white/60 hover:bg-white/10 hover:text-white'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-4 rounded-[1.5rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-50">
            {message}
          </div>
        )}

        {chatbotQuality.confidence.lowConfidencePercent > 25 && !dismissLowConfidenceBanner && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-amber-500/25 bg-amber-500/15 px-4 py-3 text-sm text-amber-50">
            <span>⚠️ 25%+ of chatbot summaries are low-confidence. Review the RAG knowledge base and prompt configuration.</span>
            <button
              type="button"
              onClick={() => setDismissLowConfidenceBanner(true)}
              className="rounded-full border border-amber-500/30 bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {overviewStats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value.toLocaleString()}
                  hint={stat.hint}
                  tone={STAT_TONES[stat.key] || 'from-white/10 to-white/5'}
                />
              ))}
            </div>

            <GlassPanel className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Chatbot quality</div>
                  <h2 className="mt-2 text-xl font-semibold tracking-tight">Summary feedback analytics</h2>
                  <p className="mt-1 text-sm text-white/60">Aggregated psychologist ratings and accuracy flags for preconsultation summaries.</p>
                </div>
                {feedbackLoading && (
                  <span className="text-xs text-white/50">Loading...</span>
                )}
              </div>

              {feedbackError && !feedbackLoading ? (
                <div className="mt-4 rounded-[1.25rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                  {feedbackError}
                </div>
              ) : (
                <>
                  {feedbackLoading ? (
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {[1, 2, 3, 4].map((key) => (
                        <div key={key} className="h-20 rounded-[1.25rem] border border-white/10 bg-white/5 animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
                        <div className="space-y-4">
                        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="text-xs text-white/50">Average rating</div>
                          <div className="mt-1 text-3xl font-semibold">
                            {chatbotQuality.ratings.average.toFixed(1)} / 5
                          </div>
                          <div className="mt-1 text-xs text-white/60">
                            {chatbotQuality.totalWithFeedback} of {chatbotQuality.totalSummaries} summaries rated ({chatbotQuality.feedbackCoveragePercent.toFixed(1)}%)
                          </div>
                          {showRatingDistribution && (
                            <div className="mt-3 space-y-2">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const count = ratingDistribution[String(star)] || 0;
                                const fillPct = ratingMaxCount ? (count / ratingMaxCount) * 100 : 0;
                                const tone = star >= 4
                                  ? 'bg-emerald-400/70'
                                  : star === 3
                                    ? 'bg-amber-400/70'
                                    : 'bg-rose-400/70';

                                return (
                                  <div key={star} className="flex items-center gap-2 text-[11px] text-white/60">
                                    <span className="w-6 text-right">{star}★</span>
                                    <div className="h-1.5 flex-1 rounded-full bg-white/10">
                                      <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${fillPct}%` }} />
                                    </div>
                                    <span className="w-6 text-right text-white/45">{count || ''}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="text-xs text-white/50">Accuracy breakdown</div>
                          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                            <span className="rounded-full border border-emerald-500/25 bg-emerald-500/15 px-3 py-1 text-emerald-200">
                              Accurate: {chatbotQuality.accuracy.accurate}
                            </span>
                            <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-3 py-1 text-amber-200">
                              Partially accurate: {chatbotQuality.accuracy.partially_accurate}
                            </span>
                            <span className="rounded-full border border-rose-500/25 bg-rose-500/15 px-3 py-1 text-rose-200">
                              Inaccurate: {chatbotQuality.accuracy.inaccurate}
                            </span>
                          </div>
                          <div className="mt-3 text-xs text-white/60">
                            Accurate rate: {chatbotQuality.accuracy.accuratePercent.toFixed(1)}%
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="text-xs text-white/50">Confidence vs rating</div>
                          <div className="mt-2 text-sm text-white/80">
                            High-confidence summaries average {chatbotQuality.confidence.avgRatingWhenHighConfidence.toFixed(1)}★ vs {chatbotQuality.confidence.avgRatingWhenLowConfidence.toFixed(1)}★ for low-confidence
                          </div>
                        </div>
                        </div>

                        <div className="space-y-4">
                        <div className={`rounded-[1.5rem] border px-4 py-4 ${chatbotQuality.confidence.lowConfidencePercent > 25
                          ? 'border-rose-500/25 bg-rose-500/10'
                          : chatbotQuality.confidence.lowConfidencePercent > 10
                            ? 'border-amber-500/25 bg-amber-500/10'
                            : 'border-white/10 bg-white/5'
                          }`}
                        >
                          <div className="text-xs text-white/50">Low confidence flags</div>
                          <div className="mt-1 text-2xl font-semibold">
                            {chatbotQuality.confidence.lowConfidenceCount} summaries flagged ({chatbotQuality.confidence.lowConfidencePercent.toFixed(1)}%)
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="text-xs text-white/50">Recent feedback</div>
                          <div className="mt-3 space-y-2">
                            {chatbotQuality.recentFeedback.length === 0 && (
                              <div className="text-xs text-white/50">No feedback submitted yet.</div>
                            )}
                            {chatbotQuality.recentFeedback.map((entry) => (
                              <div key={`${entry.patientId}-${entry.submittedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-white/80">#{String(entry.patientId).slice(-6)}</span>
                                  <span className="text-white/70">{toStarString(entry.rating)}</span>
                                  <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getAccuracyTone(entry.accuracyFlag)}`}>
                                    {entry.accuracyFlag || 'unknown'}
                                  </span>
                                </div>
                                <span className="text-white/50">{formatRelativeTime(entry.submittedAt)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        </div>
                      </div>

                      {Array.isArray(chatbotQuality.topCorrectedEmotions) && (
                        <div className="mt-6">
                          <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Top corrected emotions</div>
                          <h3 className="mt-2 text-lg font-semibold tracking-tight">Emotions most often corrected</h3>
                          <p className="mt-1 text-sm text-white/60">
                            Emotions psychologists most often corrected from the AI's original assessment. High counts signal embedding gaps in the RAG knowledge base.
                          </p>

                          <div className="mt-4 space-y-3">
                            {chatbotQuality.topCorrectedEmotions.length === 0 && (
                              <div className="rounded-[1.25rem] border border-dashed border-white/10 bg-white/5 p-4 text-sm text-white/60">
                                No emotion corrections recorded yet.
                              </div>
                            )}

                            {chatbotQuality.topCorrectedEmotions.length > 0 && (() => {
                              const maxCount = Math.max(...chatbotQuality.topCorrectedEmotions.map((item) => item.count || 0));
                              return chatbotQuality.topCorrectedEmotions.map((item) => {
                                const count = item.count || 0;
                                const fillPct = maxCount ? (count / maxCount) * 100 : 0;
                                const label = String(item.emotion || '').replace(/\b\w/g, (c) => c.toUpperCase());

                                return (
                                  <div key={item.emotion} className="flex items-center gap-3 text-sm text-white/70">
                                    <span className="w-28 truncate text-xs font-semibold text-white/70">{label || 'Unknown'}</span>
                                    <div className="flex-1 h-2 rounded-full bg-white/10">
                                      <div className="h-2 rounded-full bg-amber-400/70" style={{ width: `${fillPct}%` }} />
                                    </div>
                                    <span className="w-10 text-right text-xs text-white/50">{count}</span>
                                  </div>
                                );
                              });
                            })()}
                          </div>
                        </div>
                      )}

                      {knowledgeGaps !== null && (
                        <div className="mt-6 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Knowledge base gaps</div>
                              <div className="mt-1 text-sm text-white/60">
                                {knowledgeGaps?.summary?.gapCount || 0} gaps detected · {knowledgeGaps?.summary?.coveredCount || 0} covered
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={refreshKnowledgeGaps}
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10"
                            >
                              Refresh
                            </button>
                          </div>

                          {gapsLoading ? (
                            <div className="mt-4 space-y-3">
                              {[1, 2, 3].map((item) => (
                                <div key={item} className="h-16 rounded-2xl border border-white/10 bg-white/5 animate-pulse" />
                              ))}
                            </div>
                          ) : (
                            <div className="mt-4 space-y-3">
                              {gapsError && (
                                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                                  {gapsError}
                                </div>
                              )}

                              {!(knowledgeGaps?.gaps || []).length && !(knowledgeGaps?.covered || []).length && !gapsError && (
                                <div className="rounded-2xl border border-dashed border-white/10 bg-white/5 px-3 py-3 text-sm text-white/60">
                                  No gaps detected
                                </div>
                              )}

                              {(knowledgeGaps?.gaps || []).map((item) => {
                                const emotionKey = String(item.emotion || '').toLowerCase();
                                const autoTriggered = Number(item.correctionCount || 0) >= 3;

                                return (
                                  <div key={emotionKey} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-white">{emotionKey.replace(/\b\w/g, (char) => char.toUpperCase())}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                                          <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-200">
                                            corrected {item.correctionCount}×
                                          </span>
                                          <span>best match {Number(item.topSimilarity || 0).toFixed(2)}</span>
                                          <span className={`rounded-full border px-2 py-0.5 font-semibold ${item.status === 'GAP' ? 'border-rose-500/25 bg-rose-500/15 text-rose-200' : 'border-emerald-500/25 bg-emerald-500/15 text-emerald-200'}`}>
                                            {item.status}
                                          </span>
                                        </div>
                                        {item.recommendation && (
                                          <div className="mt-2 text-xs text-white/55">{item.recommendation}</div>
                                        )}
                                        <div className={[
                                          'mt-2 text-xs font-semibold',
                                          autoTriggered ? 'text-emerald-300' : 'text-white/50'
                                        ].join(' ')}>
                                          {autoTriggered
                                            ? '✓ Auto-reseed triggered'
                                            : `Auto-reseed triggers at 3 corrections (${item.correctionCount}/3)`}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}

                              {(knowledgeGaps?.covered || []).map((item) => {
                                const emotionKey = String(item.emotion || '').toLowerCase();
                                return (
                                  <div key={emotionKey} className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                      <div>
                                        <div className="text-sm font-semibold text-white">{emotionKey.replace(/\b\w/g, (char) => char.toUpperCase())}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-white/60">
                                          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-200">COVERED</span>
                                          <span>best match {Number(item.topSimilarity || 0).toFixed(2)}</span>
                                          <span className="rounded-full border border-amber-500/25 bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-200">
                                            corrected {item.correctionCount}×
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}
            </GlassPanel>


            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <GlassPanel className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">Live queue</div>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">Onboarding reviews at a glance</h2>
                    <p className="mt-1 max-w-2xl text-sm text-white/60">
                      The latest queue snapshot is loaded from the backend and stays in sync with approvals, rejections, and filters.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:min-w-[260px]">
                    <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-xs text-white/50">Submitted</div>
                      <div className="mt-1 text-2xl font-semibold">{queueStats.submitted}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-xs text-white/50">Approved</div>
                      <div className="mt-1 text-2xl font-semibold">{queueStats.approved}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-xs text-white/50">Rejected</div>
                      <div className="mt-1 text-2xl font-semibold">{queueStats.rejected}</div>
                    </div>
                    <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="text-xs text-white/50">Page size</div>
                      <div className="mt-1 text-2xl font-semibold">{queueLimit}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  {(applications.slice(0, 4).length > 0 ? applications.slice(0, 4) : []).map((application) => (
                    <button
                      key={application._id}
                      type="button"
                      onClick={() => loadApplicationDetails(application)}
                      className="group rounded-[1.5rem] border border-white/10 bg-white/5 p-4 text-left transition hover:bg-white/10"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-semibold text-white">{application.firstName} {application.lastName}</div>
                          <div className="mt-1 text-xs text-white/55">{application.user?.email || 'No email'}</div>
                        </div>
                        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(application.profileStatus)}`}>
                          {application.profileStatus || 'Submitted'}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                        <span className={`rounded-full border px-2.5 py-1 font-semibold ${getCompletenessTone(application.completeness?.completenessLevel)}`}>
                          {application.completeness?.completenessLevel || 'unknown'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-white/70">
                          {application.city || 'No city'}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 font-semibold text-white/70">
                          {formatDate(application.submittedAt || application.createdAt)}
                        </span>
                      </div>
                    </button>
                  ))}
                  {applications.length === 0 && (
                    <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 p-6 text-sm text-white/60">
                      No queue items match the current filters.
                    </div>
                  )}
                </div>
              </GlassPanel>

              <GlassPanel className="p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/50">System snapshot</div>
                    <h2 className="mt-2 text-xl font-semibold tracking-tight">Operational notes</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => refreshQueue({ page: queuePage, filters: queueFilters })}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10"
                  >
                    Reload queue
                  </button>
                </div>

                <div className="mt-4 space-y-3 text-sm text-white/65">
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    Admin users are loaded from the backend and can be edited or deleted from the Users tab.
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    Verification reviews use signed document URLs, so the browser previews the actual uploaded file instead of mock data.
                  </div>
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    Review queue filters are persisted locally and are applied directly to the backend query.
                  </div>
                </div>
              </GlassPanel>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <div className="grid gap-3 lg:grid-cols-[1fr_220px_auto]">
                <input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users by name, email, or role"
                  className="glass-input h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-indigo-400/40"
                />

                <select
                  value={userRoleFilter}
                  onChange={(e) => setUserRoleFilter(e.target.value)}
                  className="glass-input h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400/40"
                >
                  {ROLE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => {
                    setUserSearch('');
                    setUserRoleFilter('all');
                  }}
                  className="h-12 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                >
                  Clear filters
                </button>
              </div>
            </GlassPanel>

            <GlassPanel className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-white/5 text-white/60">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em]">User</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em]">Email</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em]">Role</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em]">Verified</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em]">Joined</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-[0.15em]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredUsers.map((user) => {
                      const userName = getPersonName(user);
                      return (
                        <tr key={user._id} className="transition hover:bg-white/5">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sm font-semibold text-white">
                                {getInitials(userName)}
                              </div>
                              <div>
                                <div className="font-semibold text-white">{userName}</div>
                                <div className="mt-0.5 text-xs text-white/50">{user.lastLoginAt ? `Last login ${formatDateTime(user.lastLoginAt)}` : 'No login record'}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-white/65">{user.email}</td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getRoleTone(user.role)}`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${user.isVerified ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/5 text-white/55'}`}>
                              {user.isVerified ? 'Verified' : 'Not verified'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-white/60">{formatDate(user.createdAt)}</td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openUserModal(user)}
                                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                disabled={user.role === 'admin' || deletingUserId === user._id}
                                onClick={() => deleteUser(user)}
                                className="rounded-2xl bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {deletingUserId === user._id ? 'Deleting…' : 'Delete'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length === 0 && (
                <div className="border-t border-white/10 p-10 text-center text-sm text-white/60">
                  No users match your filters.
                </div>
              )}
            </GlassPanel>
          </div>
        )}

        {activeTab === 'verifications' && (
          <div className="space-y-4">
            <GlassPanel className="p-5">
              <div className="grid gap-3 xl:grid-cols-5">
                <div className="xl:col-span-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Status</div>
                  <select
                    value={queueFilters.status}
                    onChange={(e) => setQueueFilters((prev) => ({ ...prev, status: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400/40"
                  >
                    {QUEUE_STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="xl:col-span-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Rejected</div>
                  <select
                    value={queueFilters.rejected === null ? '' : String(queueFilters.rejected)}
                    onChange={(e) => setQueueFilters((prev) => ({ ...prev, rejected: e.target.value === '' ? null : e.target.value === 'true' }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400/40"
                  >
                    <option value="">All</option>
                    <option value="false">Not rejected</option>
                    <option value="true">Rejected</option>
                  </select>
                </div>

                <div className="xl:col-span-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Completeness</div>
                  <select
                    value={queueFilters.completeness}
                    onChange={(e) => setQueueFilters((prev) => ({ ...prev, completeness: e.target.value }))}
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400/40"
                  >
                    {COMPLETENESS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="xl:col-span-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Date range</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={queueFilters.dateFrom}
                      onChange={(e) => setQueueFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                      className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-400/40"
                    />
                    <input
                      type="date"
                      value={queueFilters.dateTo}
                      onChange={(e) => setQueueFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                      className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-indigo-400/40"
                    />
                  </div>
                </div>

                <div className="xl:col-span-1">
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Search</div>
                  <input
                    value={queueFilters.search}
                    onChange={(e) => setQueueFilters((prev) => ({ ...prev, search: e.target.value }))}
                    placeholder="Name, email, city"
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/35 focus:border-indigo-400/40"
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_220px_220px]">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/50">Sort</div>
                  <select
                    value={`${queueFilters.sortBy}:${queueFilters.order}`}
                    onChange={(e) => {
                      const [sortBy, order] = String(e.target.value).split(':');
                      setQueueFilters((prev) => ({ ...prev, sortBy, order }));
                    }}
                    className="mt-2 h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400/40"
                  >
                    <option value="submittedAt:desc">Submitted new to old</option>
                    <option value="submittedAt:asc">Submitted old to new</option>
                    <option value="createdAt:desc">Created new to old</option>
                    <option value="createdAt:asc">Created old to new</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      setQueuePage(1);
                      refreshQueue({ page: 1, filters: queueFilters });
                    }}
                    className="h-11 w-full rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
                  >
                    Apply filters
                  </button>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => {
                      const next = getQueueFiltersFromStorage();
                      setQueueFilters(next);
                      setQueuePage(1);
                      refreshQueue({ page: 1, filters: next });
                    }}
                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                  >
                    Reset filters
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/55">
                <div>
                  Page {queuePage} of {Math.max(1, Math.ceil((queueTotal || 0) / (queueLimit || API_QUEUE_LIMIT)))} · {queueTotal} applications
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = Math.max(1, queuePage - 1);
                      setQueuePage(next);
                      refreshQueue({ page: next, filters: queueFilters });
                    }}
                    disabled={queueLoading || queuePage <= 1}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const maxPage = Math.max(1, Math.ceil((queueTotal || 0) / (queueLimit || API_QUEUE_LIMIT)));
                      const next = Math.min(maxPage, queuePage + 1);
                      setQueuePage(next);
                      refreshQueue({ page: next, filters: queueFilters });
                    }}
                    disabled={queueLoading}
                    className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </GlassPanel>

            <div className="grid gap-4 xl:grid-cols-2">
              {applications.map((application) => {
                const docs = getApplicationDocs(application);
                return (
                  <GlassPanel key={application._id} className="p-5">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-lg font-semibold text-white">
                            {application.firstName} {application.lastName}
                          </h3>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(application.profileStatus)}`}>
                            {application.profileStatus || 'Submitted'}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCompletenessTone(application.completeness?.completenessLevel)}`}>
                            {application.completeness?.completenessLevel || 'unknown'}
                          </span>
                        </div>

                        <div className="mt-1 text-sm text-white/55">
                          {application.user?.email || 'No email'} · {application.city || 'No city'} · {formatDate(application.submittedAt || application.createdAt)}
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                          {docs.map(([docKey]) => (
                            <button
                              key={docKey}
                              type="button"
                              onClick={() => loadApplicationDetails(application)}
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/80 transition hover:bg-white/10"
                            >
                              {DOC_LABELS[docKey] || docKey}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() => loadApplicationDetails(application)}
                          className="h-10 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedApplication(application);
                            setApplicationModalOpen(true);
                            setRejectReason(String(application.rejectionReason || ''));
                          }}
                          className="h-10 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 text-sm font-semibold text-rose-300 transition hover:bg-rose-500/20"
                        >
                          Reject
                        </button>
                      </div>
                    </div>

                    {application.aiVerificationSummary && (
                      <details className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                        <summary className="cursor-pointer select-none text-sm font-semibold text-white/80">
                          AI verification summary
                        </summary>
                        <div className="mt-3 whitespace-pre-wrap text-sm text-white/65">
                          {application.aiVerificationSummary}
                        </div>
                      </details>
                    )}

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.15em] text-white/45">Profile</div>
                        <div className="mt-1 text-sm font-semibold text-white">{application.profileStatus || 'Submitted'}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.15em] text-white/45">Submitted</div>
                        <div className="mt-1 text-sm font-semibold text-white">{formatDateTime(application.submittedAt || application.createdAt)}</div>
                      </div>
                      <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-3">
                        <div className="text-[11px] uppercase tracking-[0.15em] text-white/45">Docs</div>
                        <div className="mt-1 text-sm font-semibold text-white">{docs.length} uploaded</div>
                      </div>
                    </div>
                  </GlassPanel>
                );
              })}
            </div>

            {applications.length === 0 && (
              <GlassPanel className="p-10 text-center text-sm text-white/60">
                No applications match the current filters.
              </GlassPanel>
            )}
          </div>
        )}

        {userModalOpen && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
            <GlassPanel className="w-full max-w-xl p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/45">Edit user</div>
                  <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">{getPersonName(selectedUser)}</h3>
                  <p className="mt-1 text-sm text-white/55">Change the user role and keep the backend in sync.</p>
                </div>
                <button type="button" onClick={() => setUserModalOpen(false)} className="text-2xl text-white/45 transition hover:text-white">
                  ×
                </button>
              </div>

              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.15em] text-white/45">Email</div>
                  <div className="mt-1 break-all text-sm font-semibold text-white">{selectedUser.email}</div>
                </div>
                <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                  <div className="text-xs uppercase tracking-[0.15em] text-white/45">Verified</div>
                  <div className="mt-1 text-sm font-semibold text-white">{selectedUser.isVerified ? 'Verified account' : 'Not verified'}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">Role</label>
                  <select
                    value={userModalRole}
                    onChange={(e) => setUserModalRole(e.target.value)}
                    className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none focus:border-indigo-400/40"
                  >
                    <option value="patient">patient</option>
                    <option value="psychologist">psychologist</option>
                    <option value="admin">admin</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">Created</label>
                  <div className="mt-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75">
                    {formatDateTime(selectedUser.createdAt)}
                  </div>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => setUserModalOpen(false)}
                  className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveUserRole}
                  disabled={savingUserId === selectedUser._id}
                  className="flex-1 rounded-2xl bg-indigo-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingUserId === selectedUser._id ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </GlassPanel>
          </div>
        )}

        {applicationModalOpen && selectedApplication && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/70 px-4 py-8 backdrop-blur-sm">
            <div className="mx-auto w-full max-w-7xl">
              <GlassPanel className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/45">Verification review</div>
                    <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                      {selectedApplication.firstName} {selectedApplication.lastName}
                    </h3>
                    <p className="mt-1 text-sm text-white/55">
                      {selectedApplication.user?.email || 'No email'} · {selectedApplication.city || 'No city'} · {formatDate(selectedApplication.submittedAt || selectedApplication.createdAt)}
                    </p>
                  </div>
                  <button type="button" onClick={() => setApplicationModalOpen(false)} className="text-2xl text-white/45 transition hover:text-white">
                    ×
                  </button>
                </div>

                {applicationLoading ? (
                  <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-10 text-center text-sm text-white/60">
                    Loading application details…
                  </div>
                ) : (
                  <div className="mt-6 grid gap-5 xl:grid-cols-[380px_1fr]">
                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getStatusTone(selectedApplication.profileStatus)}`}>
                            {selectedApplication.profileStatus || 'Submitted'}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${getCompletenessTone(selectedApplication.completeness?.completenessLevel)}`}>
                            {selectedApplication.completeness?.completenessLevel || 'unknown'}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 text-sm text-white/70">
                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.15em] text-white/45">Profile checklist</div>
                            <div className="mt-2 space-y-1">
                              {selectedApplication.completeness?.checklist ? Object.entries(selectedApplication.completeness.checklist).map(([key, value]) => (
                                <div key={key} className="flex items-center justify-between gap-4">
                                  <span>{DOC_LABELS[key] || key}</span>
                                  <span className={value ? 'text-emerald-300' : 'text-rose-300'}>{value ? 'Present' : 'Missing'}</span>
                                </div>
                              )) : <div className="text-white/55">No checklist available.</div>}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.15em] text-white/45">AI summary</div>
                            <div className="mt-2 whitespace-pre-wrap text-sm text-white/70">
                              {selectedApplication.aiVerificationSummary || 'No AI summary available.'}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.15em] text-white/45">Documents</div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {selectedApplicationDocs.map(([docKey, doc]) => (
                                <button
                                  key={docKey}
                                  type="button"
                                  onClick={() => loadDocumentPreview(docKey, doc)}
                                  className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition ${selectedDocKey === docKey ? 'border-[color:var(--accent-25)] bg-[color:var(--accent-10)] text-white' : 'border-white/10 bg-white/5 text-white/70 hover:bg-white/10'}`}
                                >
                                  {DOC_LABELS[docKey] || docKey}
                                </button>
                              ))}
                              {selectedApplicationDocs.length === 0 && <div className="text-sm text-white/55">No documents are attached.</div>}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={runFaceCheck}
                                className="rounded-2xl bg-indigo-500/90 px-3 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500"
                              >
                                Run face check
                              </button>
                              <button
                                type="button"
                                onClick={loadFaceDiagnostics}
                                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10"
                              >
                                Diagnostics
                              </button>
                            </div>

                            {faceChecks[selectedApplication._id]?.result && (
                              <div className="mt-3 text-sm text-white/70">
                                {faceChecks[selectedApplication._id].result.error ? (
                                  <div>Face check could not be completed: {faceChecks[selectedApplication._id].result.error}</div>
                                ) : faceChecks[selectedApplication._id].result.match ? (
                                  <div>Face match confirmed · confidence {faceChecks[selectedApplication._id].result.confidence}%</div>
                                ) : (
                                  <div>Face mismatch detected · confidence {faceChecks[selectedApplication._id].result.confidence}%</div>
                                )}
                              </div>
                            )}

                            {faceDiagnostics && (
                              <details className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                                <summary className="cursor-pointer select-none text-xs font-semibold text-white/70">Diagnostics output</summary>
                                <pre className="mt-2 whitespace-pre-wrap text-xs text-white/60">{JSON.stringify(faceDiagnostics, null, 2)}</pre>
                              </details>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-semibold text-white">Decision</div>
                        <p className="mt-1 text-sm text-white/55">
                          Approve when the profile is complete and the documents look valid. Reject with a clear reason when something needs correction.
                        </p>

                        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.15em] text-white/45">Rejection reason</label>
                        <textarea
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          rows={4}
                          placeholder="Enter a reason if you plan to reject this application"
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-indigo-400/40"
                        />

                        <div className="mt-4 flex gap-3">
                          <button
                            type="button"
                            onClick={() => actOnApplication('approve')}
                            disabled={actionLoading === 'approve'}
                            className="flex-1 rounded-2xl bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionLoading === 'approve' ? 'Approving…' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => actOnApplication('reject')}
                            disabled={actionLoading === 'reject'}
                            className="flex-1 rounded-2xl bg-rose-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-[1.5rem] border border-white/10 bg-black/10 p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.15em] text-white/45">Preview</div>
                            <div className="mt-1 text-sm text-white/60">
                              {selectedDocKey ? `${DOC_LABELS[selectedDocKey] || selectedDocKey} preview` : 'No document selected'}
                            </div>
                          </div>
                          {previewState.url && (
                            <a
                              href={previewState.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white/75 transition hover:bg-white/10"
                            >
                              Open in new tab
                            </a>
                          )}
                        </div>

                        <div className="mt-4">
                          <PreviewPane preview={previewState} />
                        </div>
                      </div>

                      <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                        <div className="text-sm font-semibold text-white">Application details</div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.15em] text-white/45">Applicant</div>
                            <div className="mt-1 text-sm font-semibold text-white">{selectedApplication.user?.email || 'No email'}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.15em] text-white/45">Submitted</div>
                            <div className="mt-1 text-sm font-semibold text-white">{formatDateTime(selectedApplication.submittedAt || selectedApplication.createdAt)}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.15em] text-white/45">Completeness</div>
                            <div className="mt-1 text-sm font-semibold text-white">
                              {selectedApplication.completeness?.completenessLevel || 'unknown'}
                            </div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.15em] text-white/45">Documents</div>
                            <div className="mt-1 text-sm font-semibold text-white">{selectedApplicationDocs.length}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </GlassPanel>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
