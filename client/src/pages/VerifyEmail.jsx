import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import { getDeviceId, storeAuth } from '../services/auth';
import GlassPanel from '../components/GlassPanel';
import PlatformLogo from '../components/branding/PlatformLogo';

export default function VerifyEmail() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const initialEmail = useMemo(() => {
    return location.state?.email || params.get('email') || '';
  }, [location.state, params]);

  const mode = location.state?.mode || params.get('mode') || 'verify_email'; // verify_email | register
  const pendingId = location.state?.pendingId || params.get('pendingId') || '';

  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle'); // idle | verifying | success | error
  const [message, setMessage] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);

  const tr = (key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  useEffect(() => {
    if (countdown <= 0) return undefined;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) clearInterval(timer);
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleVerify = async () => {
    if (!email.trim() || !code.trim() || loading) return;
    setLoading(true);
    setStatus('verifying');
    setMessage('');
    try {
      if (mode === 'register') {
        const data = await api.post('/api/auth/register/confirm', { pendingId, email, code, deviceId: getDeviceId() });
        storeAuth({
          accessToken: data.accessToken || data.token,
          refreshToken: data.refreshToken,
          user: data.user
        });
        if (data?.user) localStorage.setItem('user', JSON.stringify(data.user));
        setStatus('success');
        setMessage(t('emailVerified'));
        localStorage.setItem('isVerified', 'true');

        setTimeout(() => {
          if (data.user?.role === 'psychologist') navigate('/psychologist/dashboard');
          else navigate('/patient/dashboard');
        }, 900);
      } else {
        const data = await api.post('/api/auth/verify-email', { email, code });
        setStatus('success');
        setMessage(data?.message || t('emailVerified'));
        localStorage.setItem('isVerified', 'true');

        setTimeout(() => {
          const role = localStorage.getItem('role');
          const token = localStorage.getItem('token');
          if (!token) {
            navigate('/login');
            return;
          }
          if (role === 'psychologist') navigate('/psychologist/dashboard');
          else navigate('/patient/dashboard');
        }, 1600);
      }
    } catch (err) {
      setStatus('error');
      setMessage(err?.message || t('verificationFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email.trim() || countdown > 0 || loading) return;
    setLoading(true);
    setMessage('');
    try {
      const data = mode === 'register'
        ? await api.post(`/api/auth/register/pending/${pendingId}/resend`, {})
        : await api.post('/api/auth/verify-email/resend', { email });
      setCountdown(60);
      setStatus('idle');
      setMessage(data?.message || t('verificationSent'));
    } catch (err) {
      setStatus('error');
      setMessage(err?.message || t('resendFailed'));
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
            <p className="text-xs text-white/60">{t('verifyEmail')}</p>
          </div>
        </div>

        <GlassPanel className="p-8 text-center">
          {status === 'verifying' && (
            <div className="py-8">
              <div className="loading-spinner mx-auto mb-4" />
              <p className="text-white font-semibold">{t('verifyingEmail')}</p>
              <p className="text-sm text-white/60 mt-2">{t('pleaseWait')}</p>
            </div>
          )}

          {status === 'success' && (
            <div className="py-8">
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-semibold text-white mb-2">{t('emailVerified')}</h2>
              <p className="text-white/60">{t('redirecting')}</p>
            </div>
          )}

          {(status === 'idle' || status === 'error') && (
            <div className="space-y-6">
              <div className="text-5xl mb-4">📧</div>
              <div>
                <h2 className="text-lg font-semibold text-white mb-2">{t('checkYourEmail')}</h2>
                <p className="text-sm text-white/60">{t('verificationSent')}</p>
              </div>

              {message && (
                <div
                  className={[
                    'rounded-2xl px-4 py-3 text-sm border',
                    status === 'error' ? 'border-rose-500/20 bg-rose-500/10 text-rose-50' : 'border-white/10 bg-white/5 text-white/70',
                  ].join(' ')}
                >
                  {message}
                </div>
              )}

              <div className="space-y-3 text-left">
                <div>
                  <label className="form-label">{t('email')}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('enterEmail')}
                    className="glass-input w-full"
                  />
                </div>

                <div>
                  <label className="form-label">{t('verificationCode')}</label>
                  <input
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    inputMode="numeric"
                    placeholder={tr('enterCode', 'Enter verification code (e.g. 123456)')}
                    className="glass-input w-full"
                  />
                </div>

                <button onClick={handleVerify} disabled={!email.trim() || !code.trim() || loading} className="glass-button w-full disabled:opacity-50">
                  {loading ? t('verifyingEmail') : t('verify')}
                </button>

                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || !email.trim() || loading}
                  className="glass-button-secondary w-full disabled:opacity-50"
                >
                  {countdown > 0 ? t('resendIn', { seconds: countdown }) : t('resendVerification')}
                </button>
              </div>

              <Link to="/login" className="text-sm text-indigo-400 hover:text-indigo-300 font-semibold">
                {t('backToLogin')}
              </Link>
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}

