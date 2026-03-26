import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { api } from '../services/api';
import { getUser } from '../services/auth';

const socket = io('http://localhost:5000');

export default function SessionPage() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const { userId } = getUser();

    // Tab state
    const [activeTab, setActiveTab] = useState('message'); // 'message' | 'ai'

    // Session info
    const [session, setSession] = useState(null);
    const [sessionEnded, setSessionEnded] = useState(false);

    // ── Messaging state ──────────────────────────────────────────────────────
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const msgBottomRef = useRef(null);

    // ── AI chatbot state ─────────────────────────────────────────────────────
    const [aiMessages, setAiMessages] = useState([]);
    const [aiInput, setAiInput] = useState('');
    const [aiLoading, setAiLoading] = useState(false);
    const aiBottomRef = useRef(null);

    // ────────────────────────────────────────────────────────────────────────
    // Fetch session info (to get psychologistId)
    // ────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const fetchSession = async () => {
            try {
                // Get all sessions for this patient and find the one matching sessionId
                const data = await api.get(`/api/sessions/patient/${userId}`);
                const found = Array.isArray(data) ? data.find(s => s._id === sessionId) : null;
                if (found) setSession(found);
            } catch (err) {
                console.error('Failed to fetch session:', err);
            }
        };
        fetchSession();
    }, [sessionId, userId]);

    // ────────────────────────────────────────────────────────────────────────
    // Poll for session status (detect when psychologist ends it)
    // ────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        const poll = setInterval(async () => {
            try {
                const data = await api.get(`/api/sessions/patient/${userId}`);
                const found = Array.isArray(data) ? data.find(s => s._id === sessionId) : null;
                if (found?.status === 'completed') {
                    setSessionEnded(true);
                    clearInterval(poll);
                }
            } catch (_) {}
        }, 5000);
        return () => clearInterval(poll);
    }, [sessionId, userId]);

    // ────────────────────────────────────────────────────────────────────────
    // Socket.io real messaging
    // ────────────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!session?.psychologistId) return;
        const psychologistId = session.psychologistId._id || session.psychologistId;
        const roomId = [userId, psychologistId].sort().join('_');

        // Load history
        api.get(`/api/messages/${psychologistId}`)
            .then(data => setMessages(Array.isArray(data) ? data : []))
            .catch(() => setMessages([]));

        socket.emit('join_room', roomId);

        const handleReceive = (data) => {
            if (data.message?.senderId !== userId) {
                setMessages(prev => {
                    if (prev.some(m => m._id === data.message._id)) return prev;
                    return [...prev, data.message];
                });
            }
        };

        socket.on('receive_message', handleReceive);
        return () => socket.off('receive_message', handleReceive);
    }, [session, userId]);

    // Auto-scroll
    useEffect(() => {
        msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);
    useEffect(() => {
        aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [aiMessages]);

    // AI welcome message
    useEffect(() => {
        setAiMessages([{
            role: 'assistant',
            content: "Hello! I'm your AI pre-interview assistant. I'm here to help you prepare for your session with your psychologist. How are you feeling today?"
        }]);
    }, []);

    // ────────────────────────────────────────────────────────────────────────
    // Send real message to psychologist
    // ────────────────────────────────────────────────────────────────────────
    const sendMessage = async () => {
        if (!newMessage.trim() || !session) return;
        const psychologistId = session.psychologistId._id || session.psychologistId;
        const roomId = [userId, psychologistId].sort().join('_');
        const text = newMessage.trim();
        setNewMessage('');
        try {
            const saved = await api.post('/api/messages', {
                receiverId: psychologistId,
                receiverModel: 'Psychologist',
                content: text
            });
            setMessages(prev => {
                if (prev.some(m => m._id === saved._id)) return prev;
                return [...prev, saved];
            });
            socket.emit('send_message', { roomId, message: saved });
        } catch (err) {
            console.error('Failed to send message:', err);
            setNewMessage(text);
        }
    };

    // ────────────────────────────────────────────────────────────────────────
    // Send AI message
    // ────────────────────────────────────────────────────────────────────────
    const sendAiMessage = async () => {
        const text = aiInput.trim();
        if (!text || aiLoading) return;
        setAiInput('');
        setAiLoading(true);
        setAiMessages(prev => [...prev, { role: 'user', content: text }]);
        try {
            const data = await api.post(`/api/chatbot/${sessionId}/chatbot`, { message: text });
            setAiMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch {
            setAiMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, something went wrong. Please try again.'
            }]);
        } finally {
            setAiLoading(false);
        }
    };

    // ────────────────────────────────────────────────────────────────────────
    // Session ended screen
    // ────────────────────────────────────────────────────────────────────────
    if (sessionEnded) {
        const psychologistId = session?.psychologistId?._id || session?.psychologistId;
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-6">
                <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
                    <div className="text-5xl mb-4">✅</div>
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">Session Completed</h1>
                    <p className="text-gray-500 text-sm mb-6">
                        Your psychologist has ended the session. Thank you for your time!
                    </p>
                    {psychologistId && (
                        <button
                            onClick={() => navigate(`/rate/${psychologistId}`)}
                            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition mb-3"
                        >
                            ⭐ Rate Your Psychologist
                        </button>
                    )}
                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    // ────────────────────────────────────────────────────────────────────────
    // Main session layout
    // ────────────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Header */}
            <div className="bg-white shadow-sm flex-shrink-0">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-gray-800">🧠 Your Session</h1>
                        <p className="text-xs text-green-500 font-semibold">● Active</p>
                    </div>
                    {/* Tabs */}
                    <div className="flex gap-2">
                        <button
                            onClick={() => setActiveTab('message')}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                                activeTab === 'message'
                                    ? 'bg-blue-600 text-white shadow'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            💬 Message
                        </button>
                        <button
                            onClick={() => setActiveTab('ai')}
                            className={`px-5 py-2 rounded-xl text-sm font-semibold transition ${
                                activeTab === 'ai'
                                    ? 'bg-purple-600 text-white shadow'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            🤖 AI Assistant
                        </button>
                    </div>
                </div>
            </div>

            {/* ── MESSAGING TAB ─────────────────────────────────────────── */}
            {activeTab === 'message' && (
                <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-6 flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
                    <div className="mb-3">
                        <p className="text-sm text-gray-500">
                            Send a message directly to your psychologist. They will see it on their dashboard.
                        </p>
                    </div>
                    {/* Messages */}
                    <div className="flex-1 bg-white rounded-2xl shadow p-5 overflow-y-auto mb-4">
                        {messages.length === 0 && (
                            <p className="text-center text-gray-400 mt-20 text-sm">
                                No messages yet. Say hello! 👋
                            </p>
                        )}
                        {messages.map((msg, i) => (
                            <div
                                key={msg._id || i}
                                className={`flex mb-3 ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
                            >
                                <div className={`px-4 py-3 rounded-2xl max-w-[72%] ${
                                    msg.senderId === userId
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-800'
                                }`}>
                                    <p className="text-sm">{msg.content}</p>
                                    <p className={`text-xs mt-1 ${msg.senderId === userId ? 'text-blue-200' : 'text-gray-400'}`}>
                                        {new Date(msg.createdAt).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                        <div ref={msgBottomRef} />
                    </div>
                    {/* Input */}
                    <div className="bg-white rounded-2xl shadow px-4 py-3 flex gap-3 items-center flex-shrink-0">
                        <input
                            className="flex-1 text-sm focus:outline-none"
                            placeholder="Type a message to your psychologist..."
                            value={newMessage}
                            onChange={e => setNewMessage(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && sendMessage()}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={!newMessage.trim()}
                            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                        >
                            Send →
                        </button>
                    </div>
                </div>
            )}

            {/* ── AI ASSISTANT TAB ──────────────────────────────────────── */}
            {activeTab === 'ai' && (
                <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-6 flex flex-col" style={{ height: 'calc(100vh - 80px)' }}>
                    <div className="mb-3">
                        <p className="text-sm text-gray-500">
                            Chat with the AI assistant to prepare for your session. Your responses help your psychologist understand you better.
                        </p>
                    </div>
                    {/* AI Messages */}
                    <div className="flex-1 bg-white rounded-2xl shadow p-6 overflow-y-auto mb-4">
                        <div className="flex flex-col gap-4">
                            {aiMessages.map((msg, i) => (
                                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    <div className={`px-4 py-3 rounded-2xl max-w-[75%] ${
                                        msg.role === 'user'
                                            ? 'bg-purple-600 text-white'
                                            : 'bg-gray-100 text-gray-800'
                                    }`}>
                                        <p className="text-sm leading-relaxed">{msg.content}</p>
                                    </div>
                                </div>
                            ))}
                            {aiLoading && (
                                <div className="flex justify-start">
                                    <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl text-sm">
                                        Thinking...
                                    </div>
                                </div>
                            )}
                            <div ref={aiBottomRef} />
                        </div>
                    </div>
                    {/* AI Input */}
                    <div className="bg-white rounded-2xl shadow p-4 flex gap-3 items-end flex-shrink-0">
                        <textarea
                            className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                            placeholder="Type your message..."
                            rows={2}
                            value={aiInput}
                            onChange={e => setAiInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendAiMessage();
                                }
                            }}
                        />
                        <button
                            onClick={sendAiMessage}
                            disabled={aiLoading || !aiInput.trim()}
                            className="bg-purple-600 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-purple-700 transition disabled:opacity-50"
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
