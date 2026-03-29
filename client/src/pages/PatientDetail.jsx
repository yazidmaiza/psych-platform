import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function PatientDetail() {
    const [data, setData] = useState({ messages: [], notes: [] });
    const [emotions, setEmotions] = useState([]);
    const [newNote, setNewNote] = useState('');
    const { patientId } = useParams();
    const [sessionId, setSessionId] = useState(null);
    const [summary, setSummary] = useState(null);
    const navigate = useNavigate();
    const [documents, setDocuments] = useState([]);
    const [docFile, setDocFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState(null);
    const [question, setQuestion] = useState('');
    const [answer, setAnswer] = useState('');
    const [querying, setQuerying] = useState(false);
    const [activeSessionId, setActiveSessionId] = useState(null);
    const [endingSession, setEndingSession] = useState(false);


    const fetchDocuments = useCallback(async () => {
        try {
            const docs = await api.get('/api/documents/patient/' + patientId);
            setDocuments(Array.isArray(docs) ? docs : []);
        } catch (err) {
            console.error(err);
        }
    }, [patientId]);

    const fetchData = useCallback(async () => {
        try {
            const res = await api.get(`/api/dashboard/patient/${patientId}`);
            setData(res);

            const emotionRes = await api.get(`/api/dashboard/emotions/${patientId}`);
            setEmotions(Array.isArray(emotionRes) ? emotionRes : []);

            const sessionRes = await api.get(`/api/sessions/patient/${patientId}`);
            if (Array.isArray(sessionRes) && sessionRes.length > 0) {
                const active = sessionRes.find(s => s.status === 'active');
                setActiveSessionId(active ? active._id : null);

                const completed = sessionRes.find(s => s.status === 'completed');
                if (completed) {
                    setSessionId(completed._id);
                    try {
                        const summaryRes = await api.get(`/api/chatbot/${completed._id}/summary`);
                        setSummary(summaryRes);
                    } catch (err) {
                        setSummary(null);
                    }
                }
            }
        } catch (err) {
            console.error(err);
        }
    }, [patientId]);

    useEffect(() => {
        fetchData();
        fetchDocuments();
    }, [fetchData, fetchDocuments]);

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
            `http://localhost:5000/api/sessions/${sessionId}/report/pdf`,
            { headers: { Authorization: `Bearer ${token}` } }
        );
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `report-${sessionId}.pdf`;
        a.click();
        window.URL.revokeObjectURL(url);
    };
    const uploadDocument = async () => {
        if (!docFile) return;
        setUploading(true);
        try {
            const token = localStorage.getItem('token');
            const formData = new FormData();
            formData.append('document', docFile);
            formData.append('patientId', patientId);
            const res = await fetch('http://localhost:5000/api/documents/upload/' + patientId, {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token },
                body: formData
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);
            setDocFile(null);
            fetchDocuments();
        } catch (err) {
            console.error(err);
        } finally {
            setUploading(false);
        }
    };

    const queryDocument = async () => {
        if (!selectedDoc || !question.trim()) return;
        setQuerying(true);
        setAnswer('');
        try {
            const data = await api.post('/api/documents/query/' + selectedDoc, { question });
            setAnswer(data.answer);
        } catch (err) {
            console.error(err);
        } finally {
            setQuerying(false);
        }
    };


    const getSentimentColor = (trend) => {
        if (trend === 'improving') return 'text-green-600 bg-green-50';
        if (trend === 'declining') return 'text-red-600 bg-red-50';
        return 'text-yellow-600 bg-yellow-50';
    };

    const getUrgencyColor = (score) => {
        if (score >= 4) return 'text-red-600';
        if (score >= 3) return 'text-orange-500';
        return 'text-green-600';
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4 flex-wrap">
                    <button
                        onClick={() => navigate('/dashboard')}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        {'<- Back to Dashboard'}
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">Patient Detail</h1>
                    <button
                        onClick={() => navigate(`/conversation/${patientId}`)}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                    >
                        Open Chat
                    </button>
                    {activeSessionId && (
                        <button
                            onClick={async () => {
                                if (!window.confirm('End this session? The patient will be prompted to rate you.')) return;
                                setEndingSession(true);
                                try {
                                    await api.put(`/api/sessions/${activeSessionId}/end`, {});
                                    setActiveSessionId(null);
                                    fetchData();
                                } catch (err) {
                                    alert('Failed to end session. Please try again.');
                                } finally {
                                    setEndingSession(false);
                                }
                            }}
                            disabled={endingSession}
                            className="bg-red-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
                        >
                            {endingSession ? 'Ending...' : '⏹ End Session'}
                        </button>
                    )}
                    {sessionId && (
                        <button
                            onClick={downloadPDF}
                            className="bg-green-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-700 transition"
                        >
                            Download Report
                        </button>
                    )}
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">

                {/* AI Chatbot Summary */}
                {summary && (
                    <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">AI Session Summary</h2>
                        <div className="grid grid-cols-3 gap-4 mb-4">
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Dominant Emotion</p>
                                <p className="text-lg font-bold text-blue-600 capitalize">{summary.emotionalIndicators?.dominantEmotion || 'N/A'}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Urgency Score</p>
                                <p className={`text-lg font-bold ${getUrgencyColor(summary.emotionalIndicators?.urgencyScore)}`}>
                                    {summary.emotionalIndicators?.urgencyScore || 'N/A'} / 5
                                </p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Sentiment Trend</p>
                                <span className={`text-sm font-bold px-3 py-1 rounded-full capitalize ${getSentimentColor(summary.emotionalIndicators?.sentimentTrend)}`}>
                                    {summary.emotionalIndicators?.sentimentTrend || 'N/A'}
                                </span>
                            </div>
                        </div>

                        {summary.keyThemes?.length > 0 && (
                            <div className="mb-4">
                                <p className="text-sm font-semibold text-gray-600 mb-2">Key Themes</p>
                                <div className="flex flex-wrap gap-2">
                                    {summary.keyThemes.map((theme, i) => (
                                        <span key={i} className="bg-blue-50 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                                            {theme}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {summary.recommendations?.length > 0 && (
                            <div className="mt-4">
                                <p className="text-sm font-semibold text-gray-600 mb-2">Recommended Follow-up Questions</p>
                                <div className="flex flex-col gap-2">
                                    {summary.recommendations.map((rec, i) => (
                                        <div key={i} className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3">
                                            <p className="text-sm text-blue-700">{i + 1}. {rec}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {summary.rawSummary && (
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Clinical Summary</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{summary.rawSummary}</p>
                            </div>
                        )}
                    </div>
                )}

                {/* Conversation */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">Conversation</h2>
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
                    <h2 className="text-lg font-bold text-gray-700 mb-4">Emotional Indicators</h2>
                    {emotions.length === 0 && (
                        <p className="text-center text-gray-400">No emotional data yet.</p>
                    )}
                    {emotions.slice(0, 1).map(indicator => (
                        <div key={indicator._id} className="flex flex-col gap-4">
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">Anxiety</span>
                                    <span className="text-gray-500">{indicator.scores.anxiety}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div className="bg-red-400 h-3 rounded-full transition-all" style={{ width: `${indicator.scores.anxiety}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">Sadness</span>
                                    <span className="text-gray-500">{indicator.scores.sadness}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div className="bg-blue-400 h-3 rounded-full transition-all" style={{ width: `${indicator.scores.sadness}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">Anger</span>
                                    <span className="text-gray-500">{indicator.scores.anger}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div className="bg-orange-400 h-3 rounded-full transition-all" style={{ width: `${indicator.scores.anger}%` }} />
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between text-sm mb-1">
                                    <span className="font-semibold text-gray-700">Positivity</span>
                                    <span className="text-gray-500">{indicator.scores.positivity}%</span>
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-3">
                                    <div className="bg-green-400 h-3 rounded-full transition-all" style={{ width: `${indicator.scores.positivity}%` }} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Private Notes */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">Private Notes</h2>
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
                            <div key={note._id} className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3">
                                <p className="text-sm text-gray-700">{note.content}</p>
                                <p className="text-xs text-gray-400 mt-1">{new Date(note.createdAt).toLocaleDateString()}</p>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
            {/* Patient Documents + RAG */}
            <div className="bg-white rounded-2xl shadow p-6">
                <h2 className="text-lg font-bold text-gray-700 mb-4">Patient Documents</h2>

                {/* Upload */}
                <div className="flex gap-3 mb-6">
                    <input
                        type="file"
                        accept="application/pdf"
                        onChange={e => setDocFile(e.target.files[0])}
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm"
                    />
                    <button
                        onClick={uploadDocument}
                        disabled={uploading || !docFile}
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </button>
                </div>

                {/* Document List */}
                {documents.length === 0 && (
                    <p className="text-center text-gray-400 text-sm mb-4">No documents yet.</p>
                )}
                <div className="flex flex-col gap-2 mb-6">
                    {documents.map(doc => (
                        <div
                            key={doc._id}
                            onClick={() => { setSelectedDoc(doc._id); setAnswer(''); }}
                            className={`flex items-center justify-between px-4 py-3 rounded-xl border cursor-pointer transition ${selectedDoc === doc._id
                                ? 'border-blue-600 bg-blue-50'
                                : 'border-gray-200 hover:border-blue-300'
                                }`}
                        >
                            <div>
                                <p className="text-sm font-semibold text-gray-700">{doc.originalName}</p>
                                <p className="text-xs text-gray-400">{new Date(doc.createdAt).toLocaleDateString()}</p>
                            </div>
                            {selectedDoc === doc._id && (
                                <span className="text-xs text-blue-600 font-semibold">Selected</span>
                            )}
                        </div>
                    ))}
                </div>

                {/* RAG Query */}
                {selectedDoc && (
                    <div className="border-t border-gray-100 pt-4">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">Ask a question about this document</h3>
                        <div className="flex gap-3 mb-4">
                            <input
                                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                                placeholder="e.g. What are the main symptoms mentioned?"
                                value={question}
                                onChange={e => setQuestion(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && queryDocument()}
                            />
                            <button
                                onClick={queryDocument}
                                disabled={querying || !question.trim()}
                                className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                            >
                                {querying ? 'Thinking...' : 'Ask'}
                            </button>
                        </div>
                        {answer && (
                            <div className="bg-gray-50 rounded-xl p-4">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Answer</p>
                                <p className="text-sm text-gray-700 leading-relaxed">{answer}</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

        </div>
    );
}

export default PatientDetail;
