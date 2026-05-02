import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';

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
      const res = await axios.post('http://localhost:5000/api/auth/login', form);
      const { token, user } = res.data;

      localStorage.setItem('token', token);
      localStorage.setItem('role', user.role);
      localStorage.setItem('userId', user.id);

      if (user.role === 'admin') navigate('/admin');
      else if (user.role === 'psychologist') navigate('/psychologist/dashboard');
      else if (user.role === 'patient') navigate('/patient/dashboard');
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
      backLabel="Home"
      footer={
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="text-[color:var(--muted)]">No account yet?</div>
          <button
            type="button"
            onClick={() => navigate('/register')}
            className="rounded-2xl bg-[color:var(--accent-90)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110 transition"
          >
            Create account
          </button>
        </div>
      }
    >
      {error && (
        <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
          {error}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Email</span>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="h-11 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-sm text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Password</span>
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            placeholder="********"
            className="h-11 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-sm text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
          />
        </label>

        <button
          type="button"
          onClick={handleLogin}
          disabled={!canSubmit}
          className="mt-2 h-11 rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
        >
          {loading ? 'Logging in...' : 'Login'}
        </button>
      </div>
    </AuthShell>
  );
}
