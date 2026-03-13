import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SESSION_TYPE_LABELS = {
    preparation: '🧠 First Consultation Preparation',
    followup: '🔄 Follow-up Session',
    free: '💬 Free Expression'
};

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-700',
    active: 'bg-blue-100 text-blue-700',
    completed: 'bg-green-100 text-green-700'
};

export default function SessionHistory() {
    const navigate = useNavigate();
    const [sessions, setSessions] = useState([]);
    const [summaries, setSummaries] = useState({});
    const [loading, setLoading] = useState(true);

    const userId = localStorage.getItem('userId');

    useEffect(() => {
        const fetchSessions = async () => {
            try {
                const data = await api.get('/api/sessions/patient/' + userId);
                setSessions(data);

                // Fetch summaries for completed sessions
                const summaryMap = {};
                await Promise.all(
                    data
                        .filter(s => s.status === 'completed')
                        .map(async s => {
                            try {
                                const summary = await api.get('/api/chatbot/' + s._id + '/summary');
                                summaryMap[s._id] = summary;
                            } catch {
                                // no summary yet
                            }
                        })
                );
                setSummaries(summaryMap);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchSessions();
    }, [userId]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="text-blue-600 text-sm font-semibold hover:underline">
                        ← Back
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">📋 My Sessions</h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {sessions.length === 0 && (
                    <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
                        😶 No sessions yet. Book your first session to get started.
                    </div>
                )}

                <div className="flex flex-col gap-6">
                    {sessions.map(session => {
                        const summary = summaries[session._id];
                        return (
                            <div key={session._id} className="bg-white rounded-2xl shadow p-6">

                                {/* Header */}
                                <div className="flex justify-between items-center mb-4">
                                    <span className="text-sm font-bold text-gray-800">
                                        {SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[session.status]}`}>
                                            {session.status}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            📅 {new Date(session.createdAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>

                                {/* Summary if completed */}
                                {summary ? (
                                    <div className="flex flex-col gap-4">
                                        <div className="grid grid-cols-3 gap-3">
                                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Emotion</p>
                                                <p className="text-gray-800 font-bold capitalize text-sm">{summary.emotionalIndicators?.dominantEmotion}</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Urgency</p>
                                                <p className="text-gray-800 font-bold text-sm">{summary.emotionalIndicators?.urgencyScore} / 5</p>
                                            </div>
                                            <div className="bg-gray-50 rounded-xl p-3 text-center">
                                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Trend</p>
                                                <p className="text-gray-800 font-bold capitalize text-sm">{summary.emotionalIndicators?.sentimentTrend}</p>
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Key Themes</p>
                                            <div className="flex flex-wrap gap-2">
                                                {summary.keyThemes?.map((theme, i) => (
                                                    <span key={i} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                                                        {theme}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Summary</p>
                                            <p className="text-sm text-gray-700 leading-relaxed">{summary.rawSummary}</p>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {session.status === 'pending' && (
                                            <p className="text-sm text-gray-400 text-center py-4">⏳ Payment pending</p>
                                        )}
                                        {session.status === 'active' && (
                                            <button
                                                onClick={() => navigate('/chatbot/' + session._id)}
                                                className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                                            >
                                                Continue Session →
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}