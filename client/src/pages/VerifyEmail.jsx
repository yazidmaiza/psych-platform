import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/auth/AuthShell';

export default function VerifyEmail() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const email = params.get('email') || '';
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const verify = async () => {
      if (!token) return;
      setLoading(true);
      try {
        const res = await axios.get(`http://localhost:5000/api/auth/verify-email?token=${token}`);
        console.log('DEBUG VerifyEmail: success response=', res.data);
        setStatus(res.data?.message || 'Email verified successfully.');
        localStorage.setItem('isVerified', 'true');
        // Redirect to appropriate dashboard after 2 seconds
        setTimeout(() => {
          const role = localStorage.getItem('role');
          if (role === 'admin') navigate('/admin');
          else if (role === 'psychologist') navigate('/psychologist/dashboard');
          else if (role === 'patient') navigate('/patient/dashboard');
          else navigate('/login');
        }, 2000);
      } catch (err) {
        console.error('DEBUG VerifyEmail: error=', err.response?.data || err.message);
        setStatus(err.response?.data?.message || 'Verification failed.');
      } finally {
        setLoading(false);
      }
    };

    verify();
  }, [token, navigate]);

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
      subtitle="Confirm your email to unlock the full platform."
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
          {token ? 'We are verifying your email now.' : 'Check your inbox for a verification link.'}
        </div>

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
