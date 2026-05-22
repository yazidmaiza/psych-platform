import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    return email.trim().length > 0 && !loading;
  }, [email, loading]);

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setStatus('');
    try {
      await axios.post('http://localhost:5000/api/auth/password/forgot', { email });
      setStatus('If the email exists, a reset code has been sent.');
      setTimeout(() => navigate(`/reset-password?email=${encodeURIComponent(email)}`), 600);
    } catch (err) {
      setStatus(err.response?.data?.message || 'Unable to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We will email you a reset code."
      onBack={() => navigate('/login')}
      backLabel="Back to login"
    >
      {status && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
          {status}
        </div>
      )}

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">Email</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="mt-2 h-11 rounded-2xl bg-indigo-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition disabled:opacity-50"
        >
          {loading ? 'Sending...' : 'Send reset code'}
        </button>
      </div>
    </AuthShell>
  );
}
