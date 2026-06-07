import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && !loading;
  }, [email, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setLoading(true);
    setError('');
    try {
      await api.post('/api/auth/password/forgot', { email });
      setSubmitted(true);
      setTimeout(() => navigate(`/reset-password?email=${encodeURIComponent(email)}`), 700);
    } catch (err) {
      setError(err.message || t('requestFailed') || 'Unable to send reset email.');
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
          <div className="mb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-white">{t('forgotPassword') || 'Reset your password'}</h1>
            <p className="mt-2 text-sm text-white/60">{t('forgotPasswordSubtitle') || 'We will email you a reset code.'}</p>
          </div>

          {submitted ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📧</div>
              <h2 className="text-lg font-semibold text-white mb-2">{t('checkYourEmail') || 'Check your email'}</h2>
              <p className="text-sm text-white/60 mb-4">{t('resetCodeSent') || 'If the email exists, a reset code has been sent.'}</p>
              <Link to="/login" className="text-indigo-400 hover:text-indigo-300 text-sm font-semibold">
                {t('backToLogin') || 'Back to login'}
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                  {error}
                </div>
              )}

              <div className="grid gap-1">
                <label className="text-[11px] font-semibold uppercase tracking-wide text-white/50">
                  {t('email') || 'Email'}
                </label>
                <input
                  className="glass-input w-full"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('email') || 'you@example.com'}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!canSubmit}
                className="glass-button w-full disabled:opacity-50"
              >
                {loading ? (t('sending') || 'Sending...') : (t('sendResetCode') || 'Send reset code')}
              </button>

              <div className="text-center">
                <Link to="/login" className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold">
                  {t('rememberPassword') || 'Back to login'}
                </Link>
              </div>
            </form>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
