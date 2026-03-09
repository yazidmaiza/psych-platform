import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function PatientDetail() {
    const [data, setData] = useState({ messages: [], notes: [] });
    const [newNote, setNewNote] = useState('');
    const { psychologistId, patientId } = useParams();
    const navigate = useNavigate();

    const fetchData = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/dashboard/patient/${psychologistId}/${patientId}`);
            setData(res.data);
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
            await axios.post('http://localhost:5000/api/dashboard/notes', {
                psychologistId,
                patientId,
                content: newNote
            });
            setNewNote('');
            fetchData();
        } catch (err) {
            console.error(err);
        }
    };

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