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
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5">
                    <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-semibold hover:underline">
                        Back
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <h1 className="text-3xl font-bold text-blue-700 mb-2">Enter Access Code</h1>
                <p className="text-gray-500 mb-8">Check your email for the 6-digit code and enter it below.</p>

                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <div className="bg-white rounded-2xl shadow p-8 mb-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-6 text-center">Enter your code</h2>

                    <div className="flex justify-center gap-3 mb-6">
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
                                className="w-12 h-14 text-center text-2xl font-bold border-2 border-gray-200 rounded-xl focus:outline-none focus:border-blue-600 transition"
                            />
                        ))}
                    </div>

                    <p className="text-center text-sm text-gray-400">Didn't receive the code? Check your spam folder.</p>
                </div>

                <button
                    onClick={handleVerify}
                    disabled={loading || code.join('').length < 6}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {loading ? 'Verifying...' : 'Verify and enter session'}
                </button>
            </div>
        </div>
    );
}
