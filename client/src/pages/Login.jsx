import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import GlassPanel from '../components/GlassPanel';
import PlatformLogo from '../components/branding/PlatformLogo';
import { getDeviceId, storeAuth } from '../services/auth';

export default function Login() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [needs2fa, setNeeds2fa] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const tr = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  React.useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) clearInterval(timer);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setNeeds2fa(false);

    try {
      const data = await api.post('/api/auth/login', { email, password, deviceId: getDeviceId() });

      if (data?.requires2fa) {
        setNeeds2fa(true);
        setResendCooldown(60);
        return;
      }

      // Admin (or any future exception) returns tokens directly.
      storeAuth({
        accessToken: data.accessToken || data.token,
        refreshToken: data.refreshToken,
        user: data.user
      });
      if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user?.role === 'admin') navigate('/admin');
      else if (data.user?.role === 'psychologist') navigate('/psychologist/dashboard');
      else navigate('/patient/dashboard');
    } catch (err) {
      setError(err?.message || t('loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (!email.trim() || resendCooldown > 0) return;
    setLoading(true);
    setError('');
    try {
      // Re-run login to trigger a new 2FA code.
      await api.post('/api/auth/login', { email, password, deviceId: getDeviceId() });
      setNeeds2fa(true);
      setResendCooldown(60);
    } catch (err) {
      setError(err?.message || tr('resendFailed', 'Failed to resend code'));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!email.trim() || !verificationCode.trim() || loading) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.post('/api/auth/login/verify', { email, code: verificationCode.trim(), deviceId: getDeviceId() });
      storeAuth({
        accessToken: data.accessToken || data.token,
        refreshToken: data.refreshToken,
        user: data.user
      });
      if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));

      if (data.user?.role === 'psychologist') navigate('/psychologist/dashboard');
      else navigate('/patient/dashboard');
    } catch (err) {
      setError(err?.message || tr('verificationFailed', 'Verification failed'));
      setNeeds2fa(true);
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
        <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white mb-6 transition">
          <span>←</span> {t('backToHome')}
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <PlatformLogo size={40} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Psych Platform</h1>
            <p className="text-xs text-white/60">{t('loginSubtitle')}</p>
          </div>
        </div>

        <GlassPanel className="p-8">
          <h2 className="text-lg font-semibold text-white mb-6">{t('welcomeBack')}</h2>

          {error && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="form-label">{t('email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('emailPlaceholder')}
                className="glass-input w-full"
                required
              />
            </div>

            <div>
              <label className="form-label">{t('password')}</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  className="glass-input w-full pr-12"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-end gap-3">
                <div className="flex-1">
                  <label className="form-label">{tr('verificationCode', 'Verification code')}</label>
                  <input
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    placeholder={tr('enterCode', 'Enter code if requested')}
                    className="glass-input w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleResendCode}
                  disabled={loading || resendCooldown > 0 || !email.trim()}
                  className="glass-button-secondary h-11 px-4 disabled:opacity-50"
                >
                  {resendCooldown > 0 ? tr('resendIn', `Resend in ${resendCooldown}s`) : tr('sendCode', 'Send code')}
                </button>
              </div>
              {needs2fa ? (
                <button
                  type="button"
                  onClick={handleVerifyCode}
                  disabled={loading || !verificationCode.trim()}
                  className="glass-button w-full mt-3 disabled:opacity-50"
                >
                  {loading ? tr('verifyingEmail', 'Verifying…') : tr('verify', 'Verify code')}
                </button>
              ) : (
                <p className="text-xs text-white/40 mt-1">
                  {tr('verificationHint', 'We’ll send a login code to your email after you enter your password (admins are exempt).')}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-white/60 cursor-pointer">
                <input type="checkbox" className="rounded border-white/20 bg-white/5 text-indigo-500" />
                <span>{t('rememberMe')}</span>
              </label>
              <Link to="/forgot-password" className="text-indigo-400 hover:text-indigo-300 font-semibold">
                {t('forgotPassword')}
              </Link>
            </div>

            <button type="submit" disabled={loading} className="glass-button w-full disabled:opacity-50">
              {loading ? t('signingIn') : t('signIn')}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-white/60">
            {t('noAccount')}{' '}
            <Link to="/register" className="text-indigo-400 hover:text-indigo-300 font-semibold">
              {t('createAccount')}
            </Link>
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
