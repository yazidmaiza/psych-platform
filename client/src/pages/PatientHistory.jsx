import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function PatientHistory() {
    const [history, setHistory] = useState([]);
    const { patientId } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/dashboard/history/${patientId}`);
                setHistory(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchHistory();
    }, [patientId]);

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">📋 Patient History</h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {history.length === 0 && (
                    <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
                        No sessions yet.
                    </div>
                )}

                <div className="flex flex-col gap-6">
                    {history.map(session => (
                        <div key={session._id} className="bg-white rounded-2xl shadow p-6">
                            <div className="flex justify-between items-center mb-4">
                                <span className={`text-xs font-semibold px-3 py-1 rounded-full ${session.sessionType === 'Préparation à une consultation'
                                        ? 'bg-blue-100 text-blue-700'
                                        : session.sessionType === 'Suivi entre séances'
                                            ? 'bg-purple-100 text-purple-700'
                                            : 'bg-green-100 text-green-700'
                                    }`}>
                                    {session.sessionType}
                                </span>
                                <span className="text-xs text-gray-400">
                                    📅 {new Date(session.sessionDate).toLocaleDateString()}
                                </span>
                            </div>

                            <div className="bg-gray-50 rounded-xl p-4 mb-4">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Summary</p>
                                <p className="text-sm text-gray-700">{session.summary || 'No summary available.'}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(session.emotionalScores).map(([emotion, score]) => (
                                    <div key={emotion}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-gray-600">
                                                {emotion === 'anxiety' ? '😰' : emotion === 'sadness' ? '😔' : emotion === 'anger' ? '😤' : '😊'} {emotion}
                                            </span>
                                            <span className="text-gray-400">{score}%</span>
                                        </div>
                                        <div className="w-full bg-gray-100 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all ${emotion === 'anxiety' ? 'bg-red-400' :
                                                        emotion === 'sadness' ? 'bg-blue-400' :
                                                            emotion === 'anger' ? 'bg-orange-400' : 'bg-green-400'
                                                    }`}
                                                style={{ width: `${score}%` }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PatientHistory;