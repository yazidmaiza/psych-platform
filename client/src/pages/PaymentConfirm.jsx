import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function PaymentConfirm() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [card, setCard] = useState({
        name: '',
        number: '',
        expiry: '',
        cvv: ''
    });

    const formatCardNumber = (value) => {
        return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
    };

    const formatExpiry = (value) => {
        return value.replace(/\D/g, '').slice(0, 4).replace(/(.{2})/, '$1/');
    };

    const handlePayment = async () => {
        if (!card.name || !card.number || !card.expiry || !card.cvv) {
            return setError('Please fill in all card details.');
        }
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
                <div className="max-w-xl mx-auto px-6 py-5">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        ← Back
                    </button>
                </div>
            </div>

            <div className="max-w-xl mx-auto px-6 py-8">
                <p className="text-xs font-semibold text-blue-600 uppercase tracking-widest mb-2">Secure Payment</p>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">Payment Details</h1>
                <p className="text-gray-500 mb-8">Your session access code will be sent to your email after payment.</p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-6">
                        ❌ {error}
                    </div>
                )}

                {/* Card visual */}
                <div className="bg-gradient-to-br from-blue-600 to-blue-800 rounded-2xl p-6 mb-6 text-white shadow-lg">
                    <div className="flex justify-between items-start mb-8">
                        <div>
                            <p className="text-blue-200 text-xs font-semibold uppercase tracking-wider">PsychPlatform</p>
                            <p className="text-white font-bold mt-1">Session Payment</p>
                        </div>
                        <div className="text-2xl">💳</div>
                    </div>
                    <p className="text-xl font-mono tracking-widest mb-4">
                        {card.number || '•••• •••• •••• ••••'}
                    </p>
                    <div className="flex justify-between items-end">
                        <div>
                            <p className="text-blue-200 text-xs uppercase">Card Holder</p>
                            <p className="font-semibold">{card.name || 'Your Name'}</p>
                        </div>
                        <div>
                            <p className="text-blue-200 text-xs uppercase">Expires</p>
                            <p className="font-semibold">{card.expiry || 'MM/YY'}</p>
                        </div>
                    </div>
                </div>

                {/* Card form */}
                <div className="bg-white rounded-2xl shadow p-6 mb-6 flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-2 block">Cardholder Name</label>
                        <input
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="Ahmed Ben Salah"
                            value={card.name}
                            onChange={e => setCard({ ...card, name: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-2 block">Card Number</label>
                        <input
                            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="1234 5678 9012 3456"
                            value={card.number}
                            onChange={e => setCard({ ...card, number: formatCardNumber(e.target.value) })}
                            maxLength={19}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-semibold text-gray-600 mb-2 block">Expiry Date</label>
                            <input
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="MM/YY"
                                value={card.expiry}
                                onChange={e => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                                maxLength={5}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-semibold text-gray-600 mb-2 block">CVV</label>
                            <input
                                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="•••"
                                value={card.cvv}
                                onChange={e => setCard({ ...card, cvv: e.target.value.replace(/\D/g, '').slice(0, 3) })}
                                maxLength={3}
                                type="password"
                            />
                        </div>
                    </div>
                </div>

                {/* Order summary */}
                <div className="bg-white rounded-2xl shadow p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">🧾 Order Summary</h2>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>AI Pre-Interview Session</span>
                        <span className="font-semibold text-gray-800">1 session</span>
                    </div>
                    <div className="flex justify-between text-sm text-gray-600 mb-2">
                        <span>Session ID</span>
                        <span className="font-mono text-xs text-gray-400">{sessionId?.slice(-8)}</span>
                    </div>
                    <div className="border-t border-gray-100 mt-4 pt-4 flex justify-between">
                        <span className="font-bold text-gray-800">Total</span>
                        <span className="font-bold text-blue-600 text-lg">50 TND</span>
                    </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6 text-sm text-blue-700 flex items-center gap-2">
                    🔒 Your payment is secured. A 6-digit access code will be sent to your email.
                </div>

                <button
                    onClick={handlePayment}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-4 rounded-2xl font-semibold hover:bg-blue-700 transition disabled:opacity-50 shadow-md shadow-blue-600/20"
                >
                    {loading ? 'Processing...' : '💳 Pay 50 TND →'}
                </button>
            </div>
        </div>
    );
}