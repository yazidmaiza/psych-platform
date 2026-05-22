import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import { getDeviceId, storeAuth } from '../services/auth';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    return form.email.trim().length > 0 && form.password.trim().length > 0 && !loading;
  }, [form.email, form.password, loading]);

  const handleLogin = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/login', {
        ...form,
        deviceId: getDeviceId()
      });

      storeAuth({
        accessToken: res.data.accessToken || res.data.token,
        refreshToken: res.data.refreshToken,
        user: res.data.user
      });

      if (res.data.user.role === 'admin') {
        navigate('/admin');
        return;
      }
      if (res.data.requiresEmailVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
        return;
      }
      if (res.data.user.role === 'psychologist') navigate('/psychologist/dashboard');
      else if (res.data.user.role === 'patient') navigate('/patient/dashboard');
      else setError('Invalid role');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      subtitle="Log in to manage bookings, sessions, notifications, and your secure chat."
      onBack={() => navigate('/')}
      backLabel="Return to Homepage"
      footer={
        <div className="flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="text-[color:var(--muted)]">No account yet?</div>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="inline-flex items-center justify-center rounded-full bg-[color:var(--accent-90)] px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-[color:var(--accent-20)] transition hover:brightness-110"
          >
            Create account
          </button>
        </div>
      }
    >
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--accent-12)] text-[color:var(--app-fg)] shadow-lg shadow-[color:var(--accent-20)]">
          <span className="text-xl font-semibold">✦</span>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">Psych Platform</p>
        <p className="mt-3 text-sm leading-6 text-[color:var(--muted)] sm:text-base">
          Welcome back. Please sign in to continue.
        </p>
      </div>

      {error && (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-4">
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Email</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]">✉</span>
            <input
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@example.com"
              className="h-12 w-full rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] pl-10 pr-4 text-sm text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
            />
          </div>
        </label>

        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Password</span>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--muted)]">⟡</span>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="h-12 w-full rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] pl-10 pr-4 text-sm text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
            />
          </div>
        </label>

        <button
          type="button"
          onClick={() => navigate('/forgot-password')}
          className="text-left text-xs font-medium text-[color:var(--muted)] transition hover:text-[color:var(--app-fg)]"
        >
          Forgot your password?
        </button>

        <button
          type="button"
          onClick={handleLogin}
          disabled={!canSubmit}
          className="mt-2 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-[color:var(--accent)] px-5 text-sm font-semibold text-white shadow-lg shadow-[color:var(--accent-20)] transition hover:brightness-110 disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
          {!loading && <span className="text-[18px] leading-none">→</span>}
        </button>
      </div>
    </AuthShell>
  );
}

