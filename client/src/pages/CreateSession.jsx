import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SESSION_TYPES = [
    {
        value: 'preparation',
        label: '🧠 First Consultation Preparation',
        description: 'Prepare for your first session with a guided AI interview about your main concerns.'
    },
    {
        value: 'followup',
        label: '🔄 Follow-up Session',
        description: 'Check in between sessions — track your progress and new challenges.'
    },
    {
        value: 'free',
        label: '💬 Free Expression',
        description: 'Express yourself freely. No structure, just a safe space to talk.'
    }
];

export default function CreateSession() {
    const { psychologistId } = useParams();
    const navigate = useNavigate();
    const [selected, setSelected] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleCreate = async () => {
        if (!selected) return setError('Please select a session type.');
        setLoading(true);
        setError('');
        try {
            const data = await api.post('/api/sessions', {
                psychologistId,
                sessionType: selected
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
                        ← Back
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <h1 className="text-3xl font-bold text-blue-700 mb-2">Book a Session</h1>
                <p className="text-gray-500 mb-8">Choose the type of session that fits your needs.</p>

                {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

                <div className="grid grid-cols-1 gap-4 mb-8">
                    {SESSION_TYPES.map(type => (
                        <div
                            key={type.value}
                            onClick={() => setSelected(type.value)}
                            className={`bg-white rounded-2xl shadow p-6 cursor-pointer border-2 transition ${selected === type.value ? 'border-blue-600' : 'border-transparent'
                                }`}
                        >
                            <div className="flex items-start gap-4">
                                <div className={`w-5 h-5 rounded-full border-2 mt-1 flex-shrink-0 ${selected === type.value ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                                    }`} />
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">{type.label}</h3>
                                    <p className="text-gray-500 text-sm mt-1">{type.description}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    onClick={handleCreate}
                    disabled={loading || !selected}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {loading ? 'Creating...' : 'Continue to Payment →'}
                </button>
            </div>
        </div>
    );
}