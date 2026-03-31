import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

const StarRating = ({ rating = 0, total = 0 }) => {
  const stars = [1, 2, 3, 4, 5];
  const rounded = Math.round(Number(rating) || 0);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {stars.map((s) => (
          <span key={s} className={s <= rounded ? 'text-amber-300 text-sm' : 'text-white/20 text-sm'}>
            *
          </span>
        ))}
      </div>
      <span className="text-xs text-white/60">
        {Number(total) > 0 ? `${Number(rating || 0).toFixed(1)} (${total})` : 'No ratings yet'}
      </span>
    </div>
  );
};

export default function HomePage() {
  const navigate = useNavigate();
  const [psychologists, setPsychologists] = useState([]);
  const [filters, setFilters] = useState({ city: '', language: '', specialization: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchPsychologists = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const f = filtersRef.current;
      let url = '/api/psychologists?';
      if (f.city) url += `city=${encodeURIComponent(f.city)}&`;
      if (f.language) url += `language=${encodeURIComponent(f.language)}&`;
      if (f.specialization) url += `specialization=${encodeURIComponent(f.specialization)}&`;

      const data = await api.get(url);
      setPsychologists(Array.isArray(data) ? data : []);
    } catch (e) {
      setPsychologists([]);
      setError(e.message || 'Failed to load psychologists');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPsychologists();
  }, [fetchPsychologists]);

  const visible = useMemo(() => psychologists.slice(0, 9), [psychologists]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative">
        {/* Top nav */}
        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold tracking-tight">Psych Platform</div>
                <div className="mt-1 text-xs text-white/60">Book sessions with verified psychologists</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="rounded-2xl bg-indigo-500/90 px-3 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                >
                  Create account
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="mx-auto w-full max-w-7xl px-4 pt-10 pb-8 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                Private. Professional. On-demand.
              </div>
              <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight">
                Mental health support that feels modern and safe
              </h1>
              <p className="mt-4 max-w-xl text-sm sm:text-base text-white/60 leading-relaxed">
                Discover psychologists, book from confirmed availability, and run live sessions with secure chat plus AI assistance.
              </p>
              <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="h-11 rounded-2xl bg-emerald-500/90 px-5 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition"
                >
                  Get started
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/p/psychologist/' + (visible[0]?._id || ''))}
                  disabled={!visible[0]?._id}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/80 hover:bg-white/10 transition disabled:opacity-50"
                >
                  Explore a profile
                </button>
              </div>

              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {[
                  { k: 'Secure', v: 'Protected messaging and sessions' },
                  { k: 'Booking', v: 'Calendar-based confirmed slots' },
                  { k: 'Insights', v: 'Ratings, history, and summaries' }
                ].map((x) => (
                  <div key={x.k} className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur-xl">
                    <div className="text-sm font-semibold">{x.k}</div>
                    <div className="mt-1 text-xs text-white/60">{x.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <GlassPanel className="p-5">
              <div className="text-sm font-semibold">Find a psychologist</div>
              <div className="mt-1 text-xs text-white/60">Search by city, language, or specialization.</div>

              <div className="mt-4 grid gap-3">
                <input
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950/30 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="City"
                  value={filters.city}
                  onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                />
                <input
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950/30 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Language"
                  value={filters.language}
                  onChange={(e) => setFilters({ ...filters, language: e.target.value })}
                />
                <input
                  className="h-11 rounded-2xl border border-white/10 bg-slate-950/30 px-4 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="Specialization"
                  value={filters.specialization}
                  onChange={(e) => setFilters({ ...filters, specialization: e.target.value })}
                />
              </div>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => setFilters({ city: '', language: '', specialization: '' })}
                  className="h-11 flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={fetchPsychologists}
                  className="h-11 flex-1 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                >
                  Search
                </button>
              </div>

              {error && (
                <div className="mt-4 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                  {error}
                </div>
              )}
            </GlassPanel>
          </div>
        </section>

        {/* Psychologists grid */}
        <section className="mx-auto w-full max-w-7xl px-4 pb-12 sm:px-6">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight">Top psychologists</h2>
              <p className="mt-1 text-sm text-white/60">Browse verified profiles and ratings.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/register')}
              className="hidden sm:inline-flex h-10 items-center rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
            >
              Book a session
            </button>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading && Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="mt-3 h-3 w-1/2 rounded bg-white/10" />
                <div className="mt-5 h-9 w-full rounded-2xl bg-white/10" />
              </div>
            ))}

            {!loading && visible.map((psy) => {
              const initials = `${psy.firstName?.[0] || ''}${psy.lastName?.[0] || ''}`.toUpperCase() || 'P';
              return (
                <GlassPanel key={psy._id} className="p-5 transition hover:bg-white/10">
                  <div className="flex items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-sm font-bold">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold">
                        {psy.firstName} {psy.lastName}
                      </div>
                      <div className="mt-1 text-sm text-white/60">{psy.city || 'City not set'}</div>
                      <div className="mt-3">
                        <StarRating rating={psy.averageRating || 0} total={psy.totalRatings || 0} />
                      </div>
                      <div className="mt-3 text-sm text-white/70 truncate">
                        <span className="text-white/50">Languages:</span>{' '}
                        {Array.isArray(psy.languages) ? psy.languages.join(', ') : (psy.languages || 'Not set')}
                      </div>
                      <div className="mt-2 text-sm text-white/70 truncate">
                        <span className="text-white/50">Specializations:</span>{' '}
                        {Array.isArray(psy.specializations) ? psy.specializations.slice(0, 3).join(', ') : (psy.specializations || 'Not set')}
                        {Array.isArray(psy.specializations) && psy.specializations.length > 3 ? '...' : ''}
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/p/psychologist/${psy._id}`)}
                        className="mt-5 h-11 w-full rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition"
                      >
                        View profile
                      </button>
                    </div>
                  </div>
                </GlassPanel>
              );
            })}
          </div>

          {!loading && psychologists.length > visible.length && (
            <div className="mt-6 text-center text-sm text-white/60">
              Showing top {visible.length} of {psychologists.length}.
            </div>
          )}
        </section>

        {/* Footer CTA */}
        <footer className="border-t border-white/10 bg-slate-950/40 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-sm font-semibold">Ready to start?</div>
                <div className="mt-1 text-sm text-white/60">Create an account and book your first session.</div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="h-11 rounded-2xl border border-white/10 bg-white/5 px-5 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/register')}
                  className="h-11 rounded-2xl bg-emerald-500/90 px-5 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition"
                >
                  Create account
                </button>
              </div>
            </div>
            <div className="mt-8 text-xs text-white/40">
              Psych Platform. Secure psychology sessions with booking, messaging, and AI assistance.
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}

