import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function PaymentConfirm() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [nowTick, setNowTick] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    setSessionLoading(true);
    api.get('/api/sessions/' + sessionId)
      .then((data) => {
        if (!alive) return;
        setSession(data || null);
      })
      .catch(() => {
        if (!alive) return;
        setSession(null);
      })
      .finally(() => {
        if (!alive) return;
        setSessionLoading(false);
      });
    return () => { alive = false; };
  }, [sessionId]);

  const canPay = useMemo(() => {
    if (!session) return true;
    if (String(session.status || '') !== 'pending_payment') return false;
    if (!session.paymentDueAt) return true;
    const dueAt = new Date(session.paymentDueAt);
    if (Number.isNaN(dueAt.getTime())) return true;
    return dueAt.getTime() > nowTick;
  }, [nowTick, session]);

  const dueMeta = useMemo(() => {
    if (!session?.paymentDueAt) return null;
    const dueAt = new Date(session.paymentDueAt);
    if (Number.isNaN(dueAt.getTime())) return null;
    return { dueAtMs: dueAt.getTime(), dueAt };
  }, [session?.paymentDueAt]);

  useEffect(() => {
    if (!dueMeta) return;
    const interval = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [dueMeta]);

  const handlePayment = async () => {
    setLoading(true);
    setError('');
    try {
      await api.post('/api/sessions/' + sessionId + '/payment', {});
      navigate('/verify/' + sessionId);
    } catch (err) {
      setError(err?.message || 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-[color:var(--accent-12)] blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-[color:var(--accent-08)] blur-3xl" />
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <button
          onClick={() => navigate(-1)}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
        >
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back
        </button>

        <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 shadow-[0_14px_40px_rgba(2,6,23,0.16)] backdrop-blur xl:p-8">
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Secure Checkout</div>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--app-fg)]">Confirm Payment</h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">Complete payment to receive your 6-digit session access code by email.</p>
          </div>

          {error && (
            <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--app-bg)] p-5">
            <h2 className="mb-4 text-base font-semibold text-[color:var(--app-fg)]">Order Summary</h2>

            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[color:var(--muted)]">Session ID</span>
                <span className="rounded-lg border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-2.5 py-1 font-mono text-xs text-[color:var(--app-fg)]">
                  {sessionId}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-[color:var(--muted)]">Pre-consultation package</span>
                <span className="font-semibold text-[color:var(--app-fg)]">1 session</span>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-[color:var(--panel-border)] pt-3">
                <span className="font-semibold text-[color:var(--app-fg)]">Status</span>
                {sessionLoading ? (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    Loading...
                  </span>
                ) : String(session?.status || '') === 'pending_payment' ? (
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
                    Ready to pay (24h)
                  </span>
                ) : String(session?.status || '') === 'requested' ? (
                  <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-100">
                    Awaiting psychologist
                  </span>
                ) : String(session?.status || '') === 'canceled' ? (
                  <span className="rounded-full border border-rose-500/20 bg-rose-500/10 px-3 py-1 text-xs font-semibold text-rose-100">
                    Canceled
                  </span>
                ) : (
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
                    {String(session?.status || 'unknown')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {String(session?.status || '') === 'requested' ? (
            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              This booking request must be accepted by the psychologist before payment is enabled.
              <button
                type="button"
                onClick={() => navigate('/patient/dashboard')}
                className="ml-3 rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15 transition"
              >
                Go to dashboard
              </button>
            </div>
          ) : dueMeta && dueMeta.dueAtMs <= nowTick ? (
            <div className="mt-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              Payment window expired. This booking will be canceled automatically.
              <button
                type="button"
                onClick={() => navigate('/patient/dashboard')}
                className="ml-3 rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15 transition"
              >
                Go to dashboard
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-sky-500/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
              After payment confirmation, your access code is sent immediately to your email inbox.
            </div>
          )}

          <button
            onClick={handlePayment}
            disabled={loading || !canPay}
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">credit_card</span>
            {loading ? 'Processing payment...' : 'Confirm Payment & Get Code'}
          </button>
        </div>
      </div>
    </div>
  );
}

