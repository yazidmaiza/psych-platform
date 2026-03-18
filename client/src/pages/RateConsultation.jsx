import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const QUESTIONS = [
    'Was the psychologist punctual and professional?',
    'Did the psychologist listen to you attentively?',
    'Did you feel comfortable and safe during the session?',
    'Did the psychologist explain things clearly?',
    'Did the psychologist show empathy and understanding?',
    'Did you feel the session was productive?',
    'Would you recommend this psychologist to others?',
    'Did the psychologist respect your boundaries?',
    'How satisfied are you with the overall consultation?',
    'Would you book another session with this psychologist?'
];

export default function RateConsultation() {
    const { psychologistId } = useParams();
    const navigate = useNavigate();
    const [answers, setAnswers] = useState(Array(10).fill(0));
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [psy, setPsy] = useState(null);

    useEffect(() => {
        const fetchPsy = async () => {
            try {
                const data = await api.get('/api/psychologists/' + psychologistId);
                setPsy(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchPsy();
    }, [psychologistId]);

    const setAnswer = (index, value) => {
        const newAnswers = [...answers];
        newAnswers[index] = value;
        setAnswers(newAnswers);
    };

    const handleSubmit = async () => {
        if (answers.some(a => a === 0)) {
            return setError('Please answer all 10 questions.');
        }
        setLoading(true);
        setError('');
        try {
            await api.post('/api/ratings', {
                psychologistId,
                answers,
                comment
            });
            navigate('/history');
        } catch (err) {
            setError(err.message || 'Failed to submit rating.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
                    <button onClick={() => navigate('/history')} className="text-blue-600 text-sm font-semibold hover:underline">
                        ← Back
                    </button>
                    <h1 className="text-xl font-bold text-blue-700">⭐ Rate Your Consultation</h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">

                {psy && (
                    <div className="bg-white rounded-2xl shadow p-6 flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-2xl font-bold text-blue-600">
                            {psy.firstName?.[0]}{psy.lastName?.[0]}
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-gray-800">{psy.firstName} {psy.lastName}</h2>
                            <p className="text-gray-500 text-sm">📍 {psy.city}</p>
                        </div>
                    </div>
                )}

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-6">Please rate your experience (1 = Poor, 5 = Excellent)</h2>

                    <div className="flex flex-col gap-6">
                        {QUESTIONS.map((question, index) => (
                            <div key={index}>
                                <p className="text-sm font-semibold text-gray-700 mb-3">
                                    {index + 1}. {question}
                                </p>
                                <div className="flex gap-3">
                                    {[1, 2, 3, 4, 5].map(value => (
                                        <button
                                            key={value}
                                            onClick={() => setAnswer(index, value)}
                                            className={`w-10 h-10 rounded-full text-sm font-bold border-2 transition ${answers[index] === value
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                                                }`}
                                        >
                                            {value}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-3">💬 Additional Comments (optional)</h2>
                    <textarea
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                        rows={3}
                        placeholder="Share your experience..."
                        value={comment}
                        onChange={e => setComment(e.target.value)}
                    />
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={loading || answers.some(a => a === 0)}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                >
                    {loading ? 'Submitting...' : 'Submit Rating →'}
                </button>
            </div>
        </div>
    );
}