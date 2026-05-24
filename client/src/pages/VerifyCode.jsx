import React, { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function VerifyCode() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const inputs = useRef([]);

    const handleChange = (index, value) => {
        if (!/^\d*$/.test(value)) return;
        const newCode = [...code];
        newCode[index] = value.slice(-1);
        setCode(newCode);
        if (value && index < 5) inputs.current[index + 1].focus();
    };

    const handleKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !code[index] && index > 0) {
            inputs.current[index - 1].focus();
        }
    };

    const handleVerify = async () => {
        const fullCode = code.join('');
        if (fullCode.length < 6) return setError('Please enter the full 6-digit code.');
        setLoading(true);
        setError('');
        try {
            await api.post('/api/sessions/' + sessionId + '/verify-code', { code: fullCode });
            navigate('/session/' + sessionId);
        } catch (err) {
            setError('Invalid or expired code. Please check your email.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute -top-24 left-1/2 h-72 w-[560px] -translate-x-1/2 rounded-full bg-[color:var(--accent-12)] blur-3xl" />
                <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-[color:var(--accent-08)] blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
                <button
                    onClick={() => navigate(-1)}
                    className="mb-6 inline-flex items-center gap-2 rounded-full border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-2 text-sm font-semibold text-[color:var(--app-fg)] shadow-sm transition hover:brightness-110"
                >
                    <span className="material-symbols-outlined text-base">arrow_back</span>
                    Back
                </button>

                <div className="rounded-3xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] p-6 shadow-[0_14px_40px_rgba(2,6,23,0.16)] backdrop-blur xl:p-8">
                    <div className="mb-6">
                        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">Session Security</div>
                        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[color:var(--app-fg)]">Enter Access Code</h1>
                        <p className="mt-2 text-sm text-[color:var(--muted)]">Use the 6-digit code sent to your email to enter the session.</p>
                    </div>

                    {error && (
                        <div className="mb-5 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                            {error}
                        </div>
                    )}

                    <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--app-bg)] p-5">
                        <h2 className="mb-4 text-center text-base font-semibold text-[color:var(--app-fg)]">Verification code</h2>

                        <div className="mb-5 flex justify-center gap-2 sm:gap-3">
                            {code.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={el => inputs.current[index] = el}
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={1}
                                    value={digit}
                                    onChange={e => handleChange(index, e.target.value)}
                                    onKeyDown={e => handleKeyDown(index, e)}
                                    className="h-14 w-11 rounded-xl border-2 border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-center text-2xl font-semibold text-[color:var(--app-fg)] outline-none transition focus:border-sky-500"
                                />
                            ))}
                        </div>

                        <p className="text-center text-xs text-[color:var(--muted)]">Did not receive the code? Check spam or promotions folders.</p>
                    </div>

                    <button
                        onClick={handleVerify}
                        disabled={loading || code.join('').length < 6}
                        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-sky-600 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <span className="material-symbols-outlined text-base">verified_user</span>
                        {loading ? 'Verifying code...' : 'Verify and Enter Session'}
                    </button>
                </div>
            </div>
        </div>
    );
}
