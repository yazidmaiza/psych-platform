import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function PaymentConfirm() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handlePayment = async () => {
        setLoading(true);
        setError('');
        try {
            await api.post('/api/sessions/' + sessionId + '/payment', {});
            navigate('/verify/' + sessionId);
        } catch (err) {
            setError('Payment failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5">
                    <button onClick={() => navigate(-1)} className="text-blue-600 text-sm font-semibold hover:underline">
                        ← Back
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <h1 className="text-3xl font-bold text-blue-700 mb-2">Payment</h1>
                <p className="text-gray-500 mb-8">Confirm your payment to receive your session access code by email.</p>

                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <div className="bg-white rounded-2xl shadow p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">💳 Order Summary</h2>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Session ID</span>
                        <span className="font-mono text-xs text-gray-400">{sessionId}</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>AI Pre-Interview Session</span>
                        <span className="font-semibold text-gray-800">1 session</span>
                    </div>
                    <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between">
                        <span className="font-bold text-gray-800">Total</span>
                        <span className="font-bold text-blue-600 text-lg">Paid ✓</span>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700">
                    📧 After confirming, a 6-digit access code will be sent to your email address.
                </div>

                <button
                    onClick={handlePayment}
                    disabled={loading}
                    className="w-full bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition disabled:opacity-50"
                >
                    {loading ? 'Processing...' : '✅ Confirm Payment & Get Code'}
                </button>
            </div>
        </div>
    );
}