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
        <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
            <button onClick={() => navigate('/dashboard')}>← Back to Dashboard</button>
            <h1>Patient Detail</h1>

            {/* Messages */}
            <h2>💬 Conversation</h2>
            <div style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '15px',
                height: '250px',
                overflowY: 'scroll',
                marginBottom: '20px'
            }}>
                {data.messages.length === 0 && <p style={{ color: '#999' }}>No messages yet.</p>}
                {data.messages.map(msg => (
                    <div key={msg._id} style={{
                        display: 'flex',
                        justifyContent: msg.senderId === patientId ? 'flex-start' : 'flex-end',
                        marginBottom: '10px'
                    }}>
                        <div style={{
                            background: msg.senderId === patientId ? '#f1f1f1' : '#007bff',
                            color: msg.senderId === patientId ? 'black' : 'white',
                            padding: '10px 15px',
                            borderRadius: '18px',
                            maxWidth: '70%'
                        }}>
                            <p style={{ margin: 0 }}>{msg.content}</p>
                            <small style={{ opacity: 0.7 }}>
                                {new Date(msg.createdAt).toLocaleTimeString()}
                            </small>
                        </div>
                    </div>
                ))}
            </div>

            {/* Private Notes */}
            <h2>🔒 Private Notes</h2>
            <div style={{ marginBottom: '15px' }}>
                {data.notes.length === 0 && <p style={{ color: '#999' }}>No notes yet.</p>}
                {data.notes.map(note => (
                    <div key={note._id} style={{
                        background: '#fffbe6',
                        border: '1px solid #ffe58f',
                        borderRadius: '8px',
                        padding: '10px 15px',
                        marginBottom: '10px'
                    }}>
                        <p style={{ margin: 0 }}>{note.content}</p>
                        <small style={{ color: '#999' }}>{new Date(note.createdAt).toLocaleDateString()}</small>
                    </div>
                ))}
            </div>

            {/* Add Note */}
            <div style={{ display: 'flex', gap: '10px' }}>
                <input
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                    placeholder="Add a private note..."
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addNote()}
                />
                <button
                    style={{ padding: '10px 20px', background: '#faad14', color: 'white', borderRadius: '8px', border: 'none' }}
                    onClick={addNote}
                >
                    Add Note
                </button>
            </div>
        </div>
    );
}

export default PatientDetail;