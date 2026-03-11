import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function PatientDetail() {
    const [data, setData] = useState({ messages: [], notes: [] });
    const [emotions, setEmotions] = useState([]);
    const [newNote, setNewNote] = useState('');
    const { psychologistId, patientId } = useParams();
    const [history, setHistory] = useState([]);
    const [sessionId, setSessionId] = useState(null);
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            const res = await api.get(`/api/dashboard/patient/${patientId}`);
            setData(res);

            const emotionRes = await api.get(`/api/dashboard/emotions/${patientId}`);
            setEmotions(emotionRes);

            const historyRes = await api.get(`/api/dashboard/history/${patientId}`);
            setHistory(historyRes);
            const sessionRes = await api.get(`/api/sessions/patient/${patientId}`);
            if (sessionRes && sessionRes.length > 0) {
                const completed = sessionRes.find(s => s.status === 'completed');
                if (completed) setSessionId(completed._id);
            }
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchData();
    }, [psychologistId, patientId]);

    const addNote = async () => {
        if (!newNote.trim()) return;
        try {
            await api.post('/api/dashboard/notes', {
                patientId,
                content: newNote
            });
            setNewNote('');
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

    const downloadPDF = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch(
            'http://localhost:5000/api/sessions/' + sessionId + '/report/pdf',
            { headers: { Authorization: 'Bearer ' + token } }
        );
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'report-' + sessionId + '.pdf';
        a.click();
        window.URL.revokeObjectURL(url);
    };
    console.log('patientId in PatientDetail:', patientId);
    console.log('userId from localStorage:', localStorage.getItem('userId'));
    console.log('patientId:', patientId, typeof patientId);
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">Patient Detail</h1>
                    <button
                        onClick={() => navigate(`/conversation/${patientId}`)}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                    >
                        💬 Open Chat
                    </button>
                    {sessionId && (
                        <button
                            onClick={downloadPDF}
                            className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition"
                        >
                            📄 Download Report
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">

                {/* Conversation */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">💬 Conversation</h2>
                    <div className="h-64 overflow-y-auto flex flex-col gap-3">
                        {data.messages.length === 0 && (
                            <p className="text-center text-gray-400 mt-10">No messages yet.</p>
                        )}
                        {data.messages.map(msg => (
                            <div
                                key={msg._id}
                                className={`flex ${msg.senderId === patientId ? 'justify-start' : 'justify-end'}`}
                            >
                                <div className={`px-4 py-3 rounded-2xl max-w-[70%] ${msg.senderId === patientId
                                    ? 'bg-gray-100 text-gray-800'
                                    : 'bg-blue-600 text-white'
                                    }`}>
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-xs mt-1 ${msg.senderId === patientId ? 'text-gray-400' : 'text-blue-200'}`}>
                                        {new Date(msg.createdAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Emotional Indicators */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">📊 Emotional Indicators</h2>

                    {emotions.length === 0 && (
                        <p className="text-center text-gray-400">No emotional data yet.</p>
                    )}

                    {emotions.slice(0, 1).map(indicator => (
                        <div key={indicator._id} className="flex flex-col gap-4">

                            {/* Anxiety */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">😰 Anxiety</span>
                                    <span className="text-gray-500">{indicator.scores.anxiety}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div
                                        className="bg-red-400 h-3 rounded-full transition-all"
                                        style={{ width: `${indicator.scores.anxiety}%` }}
                                    />
                                </div>
                            </div>

                            {/* Sadness */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">😔 Sadness</span>
                                    <span className="text-gray-500">{indicator.scores.sadness}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div
                                        className="bg-blue-400 h-3 rounded-full transition-all"
                                        style={{ width: `${indicator.scores.sadness}%` }}
                                    />
                                </div>
                            </div>

                            {/* Anger */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">😤 Anger</span>
                                    <span className="text-gray-500">{indicator.scores.anger}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div
                                        className="bg-orange-400 h-3 rounded-full transition-all"
                                        style={{ width: `${indicator.scores.anger}%` }}
                                    />
                                </div>
                            </div>

                            {/* Positivity */}
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">😊 Positivity</span>
                                    <span className="text-gray-500">{indicator.scores.positivity}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div
                                        className="bg-green-400 h-3 rounded-full transition-all"
                                        style={{ width: `${indicator.scores.positivity}%` }}
                                    />
                                </div>
                            </div>

                        </div>
                    ))}
                </div>

                {/* Private Notes */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">🔒 Private Notes</h2>

                    <div className="flex gap-3 mb-4">
                        <input
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-yellow-300"
                            placeholder="Add a private note..."
                            value={newNote}
                            onChange={e => setNewNote(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addNote()}
                        />
                        <button
                            className="bg-yellow-400 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-yellow-500 transition"
                            onClick={addNote}
                        >
                            Add Note
                        </button>
                    </div>

                    <div className="flex flex-col gap-3">
                        {data.notes.length === 0 && (
                            <p className="text-center text-gray-400">No notes yet.</p>
                        )}
                        {data.notes.map(note => (
                            <div
                                key={note._id}
                                className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3"
                            >
                                <p className="text-sm text-gray-700">{note.content}</p>
                                <p className="text-xs text-gray-400 mt-1">
                                    {new Date(note.createdAt).toLocaleDateString()}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}

export default PatientDetail;