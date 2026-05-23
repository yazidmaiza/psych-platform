import React, { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

export default function ResetPassword() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const initialEmail = params.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    const trimmed = password.trim();
    return trimmed.length >= 8 && /\d/.test(trimmed) && email.trim() && code.trim() && confirmPassword.trim() && !loading;
  }, [password, confirmPassword, email, code, loading]);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;

    if (password !== confirmPassword) {
      setStatus(t('passwordsDoNotMatch') || 'Passwords do not match.');
      return;
    }

    setLoading(true);
    setStatus('');
    try {
      await api.post('/api/auth/password/reset', { email, code, password });
      setStatus(t('passwordUpdated') || 'Password updated. You can log in now.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setStatus(err.message || t('requestFailed') || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] flex items-center justify-center p-6">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <GlassPanel className="p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white mb-2">{t('resetPassword') || 'Reset password'}</h1>
          <p className="text-sm text-white/60 mb-6">
            {t('resetPasswordSubtitle') || 'Use the code from your email to set a new password.'}
          </p>

          {status && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
              {status}
            </div>
          )}

          <form onSubmit={handleReset} className="mt-4 grid gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{t('email') || 'Email'}</span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{t('resetCode') || 'Reset code'}</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
                placeholder={t('reset Code') || '123456'}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{t('newPassword') || 'New password'}</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('New password') || 'Minimum 8 characters + number'}
                  className="h-11 w-full rounded-2xl border border-white/10 bg-white/5 px-4 pr-12 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              <p className="text-xs text-white/40">{t('passwordRequirements') || 'At least 8 characters and one number.'}</p>
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">{t('confirmPassword') || 'Confirm password'}</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('confirm new password') || 'Re-enter your password'}
                className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
                required
              />
            </label>

            <button
              type="submit"
              disabled={!canSubmit}
              className="mt-2 h-11 rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
            >
              {loading ? (t('updating') || 'Updating...') : (t('update Password') || 'Update password')}
            </button>
          </form>
        </GlassPanel>
      </div>
    </div>
  );
}
