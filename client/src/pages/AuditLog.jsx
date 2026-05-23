import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';
import PlatformLogo from '../components/branding/PlatformLogo';
import ThemeToggleButton from '../components/branding/ThemeToggleButton';
import { logout } from '../services/auth';

const EMPTY_FILTERS = {
  search: '',
  severity: 'all',
  outcome: 'all',
  action: '',
  actorUserId: '',
  targetType: '',
  targetId: '',
  correlationId: '',
  dateFrom: '',
  dateTo: ''
};

const SEVERITY_COLORS = {
  debug: 'bg-white/10 text-white/70 border-white/10',
  info: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  warn: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  error: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  security: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30'
};

const OUTCOME_COLORS = {
  success: 'text-emerald-400',
  failure: 'text-rose-400'
};

const getEventDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value) => {
  const date = getEventDate(value);
  return date ? date.toLocaleString() : '—';
};

const buildQuery = (filters, page, limit) => {
  const params = new URLSearchParams();
  params.set('page', String(page || 1));
  params.set('limit', String(limit || 25));

  if (filters.search) params.set('search', filters.search);
  if (filters.action) params.set('action', filters.action);
  if (filters.outcome && filters.outcome !== 'all') params.set('outcome', filters.outcome);
  if (filters.severity && filters.severity !== 'all') params.set('severity', filters.severity);
  if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.targetId) params.set('targetId', filters.targetId);
  if (filters.correlationId) params.set('correlationId', filters.correlationId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);

  return params.toString();
};

const getEventTitle = (event) => {
  const action = String(event?.action || 'AUDIT_EVENT').replace(/_/g, ' ');
  return action.charAt(0).toUpperCase() + action.slice(1).toLowerCase();
};

export default function AuditLog() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedLoading, setSelectedLoading] = useState(false);

  const loadEvents = async (nextPage = page, nextFilters = filters) => {
    setLoading(true);
    setError('');

    try {
      const data = await api.get(`/api/audit-events?${buildQuery(nextFilters, nextPage, limit)}`);
      setItems(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
      setLimit(Number(data?.limit || limit));
      setPage(Number(data?.page || nextPage));
    } catch (err) {
      setItems([]);
      setTotal(0);
      setError(err.message || 'Failed to load audit events');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadEvents(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const openEvent = async (eventId) => {
    if (!eventId) return;
    setSelectedLoading(true);
    setSelectedEvent(null);

    try {
      const data = await api.get(`/api/audit-events/${eventId}`);
      setSelectedEvent(data || null);
    } catch (err) {
      setError(err.message || 'Failed to load audit event');
    } finally {
      setSelectedLoading(false);
    }
  };

  const summary = useMemo(() => {
    const pageWarnings = items.filter((event) => String(event.severity || '').toLowerCase() === 'warn').length;
    const pageFailures = items.filter((event) => String(event.outcome || '').toLowerCase() === 'failure').length;
    return {
      pageWarnings,
      pageFailures,
      activeFilters: Object.values(filters).filter(Boolean).length
    };
  }, [filters, items]);

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
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-white/50">
                Audit trail
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Audit Log</h1>
              <p className="mt-1 max-w-2xl text-sm text-white/60">
                Review the backend audit feed, narrow the timeline, and inspect event payloads.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ThemeToggleButton />
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 transition hover:bg-white/10"
            >
              Admin panel
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

        <main className="flex-1 pb-4">
          <div className="mx-auto w-full max-w-7xl space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <GlassPanel className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Total events</div>
                <div className="mt-2 text-2xl font-semibold">{total}</div>
              </GlassPanel>
              <GlassPanel className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Warnings on page</div>
                <div className="mt-2 text-2xl font-semibold text-amber-300">{summary.pageWarnings}</div>
              </GlassPanel>
              <GlassPanel className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Failures on page</div>
                <div className="mt-2 text-2xl font-semibold text-rose-300">{summary.pageFailures}</div>
              </GlassPanel>
              <GlassPanel className="p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-white/45">Active filters</div>
                <div className="mt-2 text-2xl font-semibold text-indigo-200">{summary.activeFilters}</div>
              </GlassPanel>
            </div>

            <GlassPanel className="p-5">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <div className="text-xs font-semibold text-white/60">Search</div>
                  <input
                    className="glass-input"
                    placeholder="message, path, action, targetId…"
                    value={filters.search}
                    onChange={(e) => updateFilter('search', e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Severity</div>
                  <select
                    className="glass-input"
                    value={filters.severity}
                    onChange={(e) => updateFilter('severity', e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="security">security</option>
                    <option value="error">error</option>
                    <option value="warn">warn</option>
                    <option value="info">info</option>
                    <option value="debug">debug</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Outcome</div>
                  <select
                    className="glass-input"
                    value={filters.outcome}
                    onChange={(e) => updateFilter('outcome', e.target.value)}
                  >
                    <option value="all">All</option>
                    <option value="success">success</option>
                    <option value="failure">failure</option>
                  </select>
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Date from</div>
                  <input
                    className="glass-input"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Date to</div>
                  <input
                    className="glass-input"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e) => updateFilter('dateTo', e.target.value)}
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-6">
                <div>
                  <div className="text-xs font-semibold text-white/60">Action</div>
                  <input
                    className="glass-input"
                    value={filters.action}
                    onChange={(e) => updateFilter('action', e.target.value)}
                    placeholder="e.g. PSYCHOLOGIST_REJECT"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Actor</div>
                  <input
                    className="glass-input"
                    value={filters.actorUserId}
                    onChange={(e) => updateFilter('actorUserId', e.target.value)}
                    placeholder="actor user id"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Target type</div>
                  <input
                    className="glass-input"
                    value={filters.targetType}
                    onChange={(e) => updateFilter('targetType', e.target.value)}
                    placeholder="target type"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Target id</div>
                  <input
                    className="glass-input"
                    value={filters.targetId}
                    onChange={(e) => updateFilter('targetId', e.target.value)}
                    placeholder="target id"
                  />
                </div>
                <div>
                  <div className="text-xs font-semibold text-white/60">Correlation id</div>
                  <input
                    className="glass-input"
                    value={filters.correlationId}
                    onChange={(e) => updateFilter('correlationId', e.target.value)}
                    placeholder="correlation id"
                  />
                </div>
                <div className="md:col-span-2 flex items-end gap-2">
                  <button
                    type="button"
                    onClick={() => loadEvents(1, filters)}
                    className="glass-button-secondary w-full"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="glass-button-secondary w-full"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
                <div>
                  Showing {items.length} events <span className="text-white/30">·</span> Total: {total}
                  {summary.activeFilters > 0 && <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{summary.activeFilters} filters active</span>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const next = Math.max(1, page - 1);
                      setPage(next);
                      loadEvents(next, filters);
                    }}
                    disabled={page === 1 || loading}
                    className="h-9 rounded-xl bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => {
                      const maxPage = Math.max(1, Math.ceil((total || 0) / (limit || 25)));
                      const next = Math.min(maxPage, page + 1);
                      setPage(next);
                      loadEvents(next, filters);
                    }}
                    disabled={loading || page >= Math.max(1, Math.ceil((total || 0) / (limit || 25)))}
                    className="h-9 rounded-xl bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </GlassPanel>

            {error && (
              <div className="rounded-[1.5rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                {error}
              </div>
            )}

            <div className="grid gap-3">
              {loading ? (
                <GlassPanel className="p-8 text-sm text-white/60">Loading audit events…</GlassPanel>
              ) : (
                items.map((event) => (
                  <GlassPanel key={event._id} className="p-5">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <div className="text-sm font-semibold text-white">{getEventTitle(event)}</div>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${OUTCOME_COLORS[String(event.outcome || '').toLowerCase()] || 'text-white/70'}`}>
                            {event.outcome || 'unknown'}
                          </span>
                          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${SEVERITY_COLORS[String(event.severity || '').toLowerCase()] || 'bg-white/10 text-white/70 border-white/10'}`}>
                            {event.severity || 'unknown'}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-white/50 break-all">
                          {formatDate(event.createdAt)} <span className="text-white/30">·</span> {event.requestMethod || '—'} {event.requestPath || '—'}
                        </div>
                        <div className="mt-2 text-xs text-white/70 whitespace-pre-wrap">
                          {event.message || 'No message provided.'}
                        </div>
                        <div className="mt-2 text-[11px] text-white/50 break-all">
                          actor: {String(event.actorUserId || '—')} ({event.actorRole || '—'}) <span className="text-white/30">·</span> target: {event.targetType || '—'} {event.targetId || ''}
                        </div>
                        {event.correlationId && <div className="mt-1 text-[11px] text-white/40 break-all">corr: {event.correlationId}</div>}
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => openEvent(event._id)}
                          className="h-10 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white transition hover:bg-indigo-500"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </GlassPanel>
                ))
              )}

              {!loading && items.length === 0 && (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
                  No audit events match the current filters.
                </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {selectedLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-8 backdrop-blur-sm">
          <GlassPanel className="w-full max-w-xl p-6 text-sm text-white/70">Loading event details…</GlassPanel>
        </div>
      )}

      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
          <GlassPanel className="w-full max-w-3xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.25em] text-white/45">Audit event</div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {getEventTitle(selectedEvent)}
                </h3>
                <p className="mt-1 text-sm text-white/55">
                  {selectedEvent.createdAt ? formatDate(selectedEvent.createdAt) : '—'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="text-2xl text-white/45 transition hover:text-white"
              >
                ×
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.15em] text-white/45">Actor</div>
                <div className="mt-1 text-sm font-semibold text-white">{selectedEvent.actorUserId || '—'}</div>
                <div className="mt-1 text-xs text-white/55">{selectedEvent.actorRole || '—'}</div>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-4">
                <div className="text-xs uppercase tracking-[0.15em] text-white/45">Target</div>
                <div className="mt-1 text-sm font-semibold text-white">
                  {selectedEvent.targetType || '—'} {selectedEvent.targetId || ''}
                </div>
                <div className="mt-1 text-xs text-white/55">Correlation: {selectedEvent.correlationId || '—'}</div>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/20 p-4">
              <div className="text-xs uppercase tracking-[0.15em] text-white/45">Raw payload</div>
              <pre className="mt-3 max-h-[55vh] overflow-auto whitespace-pre-wrap break-words text-xs text-white/70">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </div>
          </GlassPanel>
        </div>
      )}
    </div>
  );
}
