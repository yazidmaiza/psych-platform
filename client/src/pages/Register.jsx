import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';

const RoleCard = ({ active, label, description, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      'rounded-3xl border p-4 text-left transition',
      active
        ? 'border-[color:var(--accent-25)] bg-[color:var(--accent-12)]'
        : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] hover:brightness-110'
    ].join(' ')}
  >
    <div className="text-sm font-semibold text-[color:var(--app-fg)]">{label}</div>
    <div className="mt-1 text-xs text-[color:var(--muted)]">{description}</div>
  </button>
);

export default function Register() {
  const [form, setForm] = useState({ email: '', password: '', role: 'patient' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    const password = form.password.trim();
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    return form.email.trim().length > 0 && hasMinLength && hasNumber && !loading;
  }, [form.email, form.password, loading]);

  const handleRegister = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/register', form);
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('role', res.data.user.role);
      localStorage.setItem('userId', res.data.user.id);

      if (form.role === 'psychologist') navigate('/setup');
      else navigate('/patient/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      subtitle="Start booking sessions or set up your psychologist profile."
      onBack={() => navigate('/')}
      backLabel="Home"
      footer={
        <div className="flex items-center justify-between gap-3 text-sm">
          <div className="text-[color:var(--muted)]">Already have an account?</div>
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--app-fg)] hover:brightness-110 transition"
          >
            Login
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
            placeholder="Minimum 8 characters + number"
            className="h-11 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-sm text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
          />
          <div className="text-xs text-[color:var(--muted)]">Use at least 8 characters and include a number.</div>
        </label>

        <div className="mt-2">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Account type</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <RoleCard
              active={form.role === 'patient'}
              label="Patient"
              description="Book consultations and chat securely."
              onClick={() => setForm({ ...form, role: 'patient' })}
            />
            <RoleCard
              active={form.role === 'psychologist'}
              label="Psychologist"
              description="Set availability, manage patients, and run sessions."
              onClick={() => setForm({ ...form, role: 'psychologist' })}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleRegister}
          disabled={!canSubmit}
          className="mt-2 h-11 rounded-2xl bg-[color:var(--accent-90)] px-4 text-sm font-semibold text-white shadow hover:brightness-110 transition disabled:opacity-50"
        >
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </div>
    </AuthShell>
  );
}
