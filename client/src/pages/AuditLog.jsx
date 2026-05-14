import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

const FILTERS_KEY = 'admin_audit_filters_v1';

const toQuery = (filters, page, limit) => {
  const params = new URLSearchParams();
  params.set('page', String(page || 1));
  params.set('limit', String(limit || 50));
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.action) params.set('action', filters.action);
  if (filters.outcome) params.set('outcome', filters.outcome);
  if (filters.severity) params.set('severity', filters.severity);
  if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);
  if (filters.targetType) params.set('targetType', filters.targetType);
  if (filters.targetId) params.set('targetId', filters.targetId);
  if (filters.correlationId) params.set('correlationId', filters.correlationId);
  if (filters.search) params.set('search', filters.search);
  return params.toString();
};

export default function AuditLog() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState(() => {
    try {
      const raw = localStorage.getItem(FILTERS_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return {
        dateFrom: parsed?.dateFrom || '',
        dateTo: parsed?.dateTo || '',
        action: parsed?.action || '',
        outcome: parsed?.outcome || '',
        severity: parsed?.severity || '',
        actorUserId: parsed?.actorUserId || '',
        targetType: parsed?.targetType || '',
        targetId: parsed?.targetId || '',
        correlationId: parsed?.correlationId || '',
        search: parsed?.search || ''
      };
    } catch {
      return {
        dateFrom: '',
        dateTo: '',
        action: '',
        outcome: '',
        severity: '',
        actorUserId: '',
        targetType: '',
        targetId: '',
        correlationId: '',
        search: ''
      };
    }
  });
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [total, setTotal] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);

  const maxPage = useMemo(() => Math.max(1, Math.ceil((total || 0) / limit)), [limit, total]);

  useEffect(() => {
    try {
      localStorage.setItem(FILTERS_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);

  const load = async (nextPage = page, nextFilters = filters) => {
    setLoading(true);
    setError('');
    try {
      const query = toQuery(nextFilters, nextPage, limit);
      const data = await api.get(`/api/audit-events?${query}`);
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setPage(Number(data.page || nextPage));
    } catch (e) {
      setItems([]);
      setTotal(0);
      setError(e.message || 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEvent = async (id) => {
    try {
      const data = await api.get(`/api/audit-events/${id}`);
      setSelected(data || null);
    } catch (e) {
      setError(e.message || 'Failed to load audit event');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xl font-bold">Audit Log</div>
          <div className="mt-1 text-sm text-white/60">Security and state-transition events (paginated).</div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className="h-10 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
          >
            Back
          </button>
        </div>

        {error && (
          <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">{error}</div>
        )}

        <GlassPanel className="p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <div>
              <div className="text-xs font-semibold text-white/60">From</div>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters((p) => ({ ...p, dateFrom: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">To</div>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters((p) => ({ ...p, dateTo: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">Action</div>
              <input
                value={filters.action}
                onChange={(e) => setFilters((p) => ({ ...p, action: e.target.value }))}
                placeholder="e.g. PSYCHOLOGIST_REJECT"
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">Outcome</div>
              <select
                value={filters.outcome}
                onChange={(e) => setFilters((p) => ({ ...p, outcome: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              >
                <option value="">All</option>
                <option value="success">success</option>
                <option value="failure">failure</option>
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">Severity</div>
              <select
                value={filters.severity}
                onChange={(e) => setFilters((p) => ({ ...p, severity: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              >
                <option value="">All</option>
                <option value="security">security</option>
                <option value="error">error</option>
                <option value="warn">warn</option>
                <option value="info">info</option>
                <option value="debug">debug</option>
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button
                onClick={() => load(1, filters)}
                className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
              >
                Apply
              </button>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-6">
            <div className="md:col-span-2">
              <div className="text-xs font-semibold text-white/60">Search</div>
              <input
                value={filters.search}
                onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))}
                placeholder="message, path, action, targetId…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') load(1, filters);
                }}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">Actor UserId</div>
              <input
                value={filters.actorUserId}
                onChange={(e) => setFilters((p) => ({ ...p, actorUserId: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">Target Type</div>
              <input
                value={filters.targetType}
                onChange={(e) => setFilters((p) => ({ ...p, targetType: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">Target Id</div>
              <input
                value={filters.targetId}
                onChange={(e) => setFilters((p) => ({ ...p, targetId: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
            <div>
              <div className="text-xs font-semibold text-white/60">Correlation Id</div>
              <input
                value={filters.correlationId}
                onChange={(e) => setFilters((p) => ({ ...p, correlationId: e.target.value }))}
                className="mt-1 h-10 w-full rounded-2xl border border-white/10 bg-slate-950/40 px-3 text-sm text-white/80"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-white/60">
            <div>{loading ? 'Loading…' : `${items.length} shown`} <span className="text-white/30">·</span> Total: {total}</div>
            <div className="flex gap-2">
              <button
                onClick={() => load(Math.max(1, page - 1), filters)}
                disabled={page <= 1 || loading}
                className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-60"
              >
                Prev
              </button>
              <button
                onClick={() => load(Math.min(maxPage, page + 1), filters)}
                disabled={loading}
                className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-60"
              >
                Next
              </button>
            </div>
          </div>
        </GlassPanel>

        <div className="grid gap-3">
          {items.map((ev) => (
            <GlassPanel key={ev._id} className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white">
                    {ev.action} <span className="text-white/50">·</span> {ev.outcome} <span className="text-white/50">·</span> {ev.severity}
                  </div>
                  <div className="mt-1 text-xs text-white/50 break-all">
                    {ev.createdAt ? new Date(ev.createdAt).toLocaleString() : '—'} <span className="text-white/30">·</span> {ev.requestMethod} {ev.requestPath}
                  </div>
                  {ev.message && <div className="mt-2 text-xs text-white/70 whitespace-pre-wrap">{ev.message}</div>}
                  <div className="mt-2 text-[11px] text-white/50 break-all">
                    actor: {String(ev.actorUserId || '—')} ({ev.actorRole || '—'}) <span className="text-white/30">·</span> target: {ev.targetType || '—'} {ev.targetId || ''}
                  </div>
                  {ev.correlationId && <div className="mt-1 text-[11px] text-white/40 break-all">corr: {ev.correlationId}</div>}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => openEvent(ev._id)}
                    className="h-10 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white hover:bg-indigo-500 transition"
                  >
                    Details
                  </button>
                </div>
              </div>
            </GlassPanel>
          ))}
          {!loading && items.length === 0 && (
            <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-white/60">
              No audit events match the current filters.
            </div>
          )}
        </div>

        {selected && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
            <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-slate-950 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-bold">Audit event</div>
                  <div className="mt-1 text-xs text-white/50 break-all">{selected._id}</div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="h-9 rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Close
                </button>
              </div>
              <pre className="mt-4 max-h-[60vh] overflow-auto rounded-2xl bg-black/40 p-4 text-xs text-white/70 whitespace-pre-wrap">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
