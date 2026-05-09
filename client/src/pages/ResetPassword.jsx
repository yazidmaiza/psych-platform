import React, { useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const canSubmit = useMemo(() => {
    const trimmed = password.trim();
    return trimmed.length >= 8 && /\d/.test(trimmed) && token && !loading;
  }, [password, token, loading]);

  const handleReset = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setStatus('');
    try {
      await axios.post('http://localhost:5000/api/auth/password/reset', { token, password });
      setStatus('Password updated. You can log in now.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setStatus(err.response?.data?.message || 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Use at least 8 characters and include a number."
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
          <span className="text-[11px] font-semibold uppercase tracking-wide text-white/50">New password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters + number"
            className="h-11 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
          />
        </label>

        <button
          type="button"
          onClick={handleReset}
          disabled={!canSubmit}
          className="mt-2 h-11 rounded-2xl bg-emerald-500/90 px-4 text-sm font-semibold text-white shadow hover:bg-emerald-500 transition disabled:opacity-50"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </div>
    </AuthShell>
  );
}
