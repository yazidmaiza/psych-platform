import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const initialEmail = params.get('email') || '';
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    setEmail(initialEmail);
  }, [initialEmail]);

  const handleVerify = async () => {
    if (!email.trim() || !code.trim()) return;
    setLoading(true);
    setStatus('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/verify-email', {
        email,
        code
      });

      setStatus(res.data?.message || 'Email verified successfully.');
      localStorage.setItem('isVerified', 'true');

      const role = localStorage.getItem('role');
      const token = localStorage.getItem('token');
      if (!token) {
        setTimeout(() => navigate('/login'), 800);
        return;
      }

      setTimeout(() => {
        if (role === 'psychologist') navigate('/setup');
        else navigate('/patient/dashboard');
      }, 600);
    } catch (err) {
      setStatus(err.response?.data?.message || 'Verification failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setStatus('');
    try {
      const res = await axios.post('http://localhost:5000/api/auth/verify-email/resend', { email });
      setStatus(res.data?.message || 'Verification email sent.');
    } catch (err) {
      setStatus(err.response?.data?.message || 'Failed to resend verification email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Verify your email"
      subtitle="Enter the verification code sent to your email."
      onBack={() => navigate('/login')}
      backLabel="Back to login"
    >
      {status && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          {status}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <div className="text-sm text-white/60">
          Check your inbox for a 6-digit code.
        </div>

        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Verification code</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            inputMode="numeric"
            placeholder="123456"
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

        <button
          type="button"
          onClick={handleVerify}
          disabled={!email.trim() || !code.trim() || loading}
          className="mt-2 h-11 rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
        >
          {loading ? 'Verifying...' : 'Verify code'}
        </button>

        <button
          type="button"
          onClick={handleResend}
          disabled={!email || loading}
          className="mt-2 h-11 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Resend verification email'}
        </button>
      </div>
    </AuthShell>
  );
}
