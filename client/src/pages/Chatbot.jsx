import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Chatbot() {
    const { sessionId } = useParams();
    const navigate = useNavigate();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
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



    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };



    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5">
                    <h1 className="text-xl font-bold text-blue-700">🧠 AI Assistant</h1>
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