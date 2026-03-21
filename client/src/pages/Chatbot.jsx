import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Chatbot() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [ending, setEnding] = useState(false);
    const [sessionEnded, setSessionEnded] = useState(false);
    const [summary, setSummary] = useState(null);
    const bottomRef = useRef(null);

    useEffect(() => {
        // Welcome message
        setMessages([{
            role: 'assistant',
            content: 'Hello! I am your AI assistant. I am here to help you prepare for your session. How are you feeling today? / مرحباً! أنا مساعدك الذكي. أنا هنا لمساعدتك في التحضير لجلستك. كيف حالك اليوم؟ / Bonjour! Je suis votre assistant IA. Je suis ici pour vous aider à préparer votre séance. Comment vous sentez-vous aujourd\'hui?'
        }]);
    }, []);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async (text) => {
        const messageText = text || input.trim();
        if (!messageText || loading) return;
        setInput('');
        setLoading(true);

        const userMessage = { role: 'user', content: messageText };
        setMessages(prev => [...prev, userMessage]);

        try {
            const data = await api.post('/api/chatbot/' + sessionId + '/chatbot', {
                message: messageText
            });
            setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
        } catch (err) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, something went wrong. Please try again.'
            }]);
        } finally {
            setLoading(false);
        }
    };

    const endSession = async () => {
        if (!window.confirm('Are you sure you want to end the session? A summary will be generated.')) return;
        setEnding(true);
        try {
            const data = await api.post('/api/chatbot/' + sessionId + '/chatbot/end', {});
            setSummary(data.summary);
            setSessionEnded(true);
        } catch (err) {
            alert('Failed to end session. Please try again.');
        } finally {
            setEnding(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (sessionEnded && summary) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="bg-white shadow-sm">
                    <div className="max-w-4xl mx-auto px-6 py-5">
                        <h1 className="text-xl font-bold text-blue-700">Session Complete</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">

                    <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
                        <div className="text-4xl mb-2">✅</div>
                        <h2 className="text-lg font-bold text-green-700">Your session has been completed</h2>
                        <p className="text-green-600 text-sm mt-1">A summary has been sent to your psychologist.</p>
                    </div>

                    <div className="bg-white rounded-2xl shadow p-6">
                        <h2 className="text-lg font-bold text-gray-700 mb-4">📊 Session Summary</h2>

                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Dominant Emotion</p>
                                <p className="text-gray-800 font-bold capitalize">{summary.emotionalIndicators?.dominantEmotion}</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Urgency Score</p>
                                <p className="text-gray-800 font-bold">{summary.emotionalIndicators?.urgencyScore} / 5</p>
                            </div>
                            <div className="bg-gray-50 rounded-xl p-4 text-center">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Sentiment</p>
                                <p className="text-gray-800 font-bold capitalize">{summary.emotionalIndicators?.sentimentTrend}</p>
                            </div>
                        </div>

                        <div className="mb-4">
                            <p className="text-sm font-semibold text-gray-600 mb-2">Key Themes</p>
                            <div className="flex flex-wrap gap-2">
                                {summary.keyThemes?.map((theme, i) => (
                                    <span key={i} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                                        {theme}
                                    </span>
                                ))}
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-semibold text-gray-600 mb-2">Clinical Summary</p>
                            <p className="text-gray-700 text-sm leading-relaxed">{summary.rawSummary}</p>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate('/')}
                        className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                    >
                        Back to Home
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center justify-between">
                    <h1 className="text-xl font-bold text-blue-700">🧠 AI Assistant</h1>
                    <button
                        onClick={endSession}
                        disabled={ending}
                        className="bg-red-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-red-600 transition disabled:opacity-50"
                    >
                        {ending ? 'Ending...' : 'End Session'}
                    </button>
                </div>
            </div>

            <div className="flex-1 max-w-4xl w-full mx-auto px-6 py-6 flex flex-col">
                <div className="flex-1 bg-white rounded-2xl shadow p-6 mb-4 overflow-y-auto" style={{ maxHeight: '60vh' }}>
                    <div className="flex flex-col gap-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`px-4 py-3 rounded-2xl max-w-[75%] ${msg.role === 'user'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    <p className="text-sm leading-relaxed">{msg.content}</p>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-gray-100 text-gray-500 px-4 py-3 rounded-2xl text-sm">
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={bottomRef} />
                    </div>
                </div>

                <div className="bg-white rounded-2xl shadow p-4 flex gap-3 items-end">
                    <textarea
                        className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                        placeholder="Type your message..."
                        rows={2}
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                    />
                    <button
                        onClick={() => sendMessage()}
                        disabled={loading || !input.trim()}
                        className="bg-blue-600 text-white px-5 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition disabled:opacity-50"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}