import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function CreateSession() {
    const { psychologistId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.post('/api/sessions', {
                psychologistId
            });
            navigate('/payment/' + data.sessionId);
        } catch (err) {
            setError('Failed to create session. Please try again.');
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
                <h1 className="text-3xl font-bold text-blue-700 mb-2">Book a Session</h1>
                <p className="text-gray-500 mb-8">
                    Your first chatbot session is a pre-consultation intake. After your first session is completed, future sessions automatically switch to follow-up.
                </p>

                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <button
                    onClick={handleCreate}
                    disabled={loading}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Continue to payment'}
                </button>
            </div>
        </div>
    );
}
