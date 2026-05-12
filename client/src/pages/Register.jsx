import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';
import { getDeviceId, storeAuth } from '../services/auth';

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
  const [form, setForm] = useState({
    email: '',
    password: '',
    fullName: '',
    telephone: '',
    birthDate: '',
    rePassword: '',
    role: 'patient'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    const password = form.password.trim();
    const hasMinLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const allFieldsFilled =
      form.fullName.trim().length > 0 &&
      form.birthDate.trim().length > 0 &&
      form.telephone.trim().length > 0 &&
      form.email.trim().length > 0 &&
      form.password.trim().length > 0 &&
      form.rePassword.trim().length > 0;
    const passwordsMatch = form.password === form.rePassword;
    return allFieldsFilled && hasMinLength && hasNumber && passwordsMatch && !loading;
  }, [form.fullName, form.birthDate, form.telephone, form.email, form.password, form.rePassword, loading]);

  const handleRegister = async () => {
    if (!canSubmit) {
      if (form.password !== form.rePassword) {
        setError('Passwords do not match');
      } else if (
        !form.fullName.trim() ||
        !form.birthDate.trim() ||
        !form.telephone.trim() ||
        !form.email.trim() ||
        !form.password.trim() ||
        !form.rePassword.trim()
      ) {
        setError('Please fill in all fields');
      } else if (form.password.length < 8 || !/\d/.test(form.password)) {
        setError('Password must be at least 8 characters and include a number');
      }
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/register', {
        ...form,
        deviceId: getDeviceId()
      });

      storeAuth({
        accessToken: res.data.accessToken || res.data.token,
        refreshToken: res.data.refreshToken,
        user: res.data.user
      });

      if (res.data.requiresEmailVerification) {
        navigate(`/verify-email?email=${encodeURIComponent(form.email)}`);
        return;
      }

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
        {/* Full Name */}
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Full Name</span>
          <input
            value={form.fullName || ''}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            placeholder="John Doe"
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

        {/* Birth Date */}
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Birth Date</span>
          <input
            type="date"
            value={form.birthDate || ''}
            onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

        {/* Telephone Number */}
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Telephone Number</span>
          <input
            type="tel"
            value={form.telephone || ''}
            onChange={(e) => setForm({ ...form, telephone: e.target.value })}
            placeholder="123-456-7890"
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

        {/* Email */}
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--muted)]">Email</span>
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            placeholder="you@example.com"
            className="h-11 rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 text-sm text-[color:var(--app-fg)] outline-none placeholder:text-[color:var(--muted)] focus:border-[color:var(--accent-50)] focus:ring-2 focus:ring-[color:var(--accent-20)]"
          />
        </label>

        {/* Password */}
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

        {/* Re-enter Password */}
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Re-enter Password</span>
          <input
            type="password"
            value={form.rePassword || ''}
            onChange={(e) => setForm({ ...form, rePassword: e.target.value })}
            placeholder="********"
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

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
