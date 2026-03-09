import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function Conversation() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const { userId, otherUserId } = useParams();
    const navigate = useNavigate();
    const bottomRef = useRef(null);

    const currentUser = {
        id: '507f1f77bcf86cd799439011',
        model: 'User'
    };

    const fetchMessages = async () => {
        try {
            const res = await axios.get(`http://localhost:5000/api/messages/${userId}/${otherUserId}`);
            setMessages(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [userId, otherUserId]);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const sendMessage = async () => {
        if (!newMessage.trim()) return;
        try {
            await axios.post('http://localhost:5000/api/messages', {
                senderId: currentUser.id,
                senderModel: currentUser.model,
                receiverId: otherUserId,
                receiverModel: 'Psychologist',
                content: newMessage
            });
            setNewMessage('');
            fetchMessages();
        } catch (err) {
            console.error(err);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        ←
                    </button>
                    <h1 className="text-xl font-bold text-gray-800">💬 Conversation</h1>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col h-[80vh]">
                {/* Messages */}
                <div className="flex-1 bg-white rounded-2xl shadow p-5 overflow-y-auto mb-4">
                    {messages.length === 0 && (
                        <p className="text-center text-gray-400 mt-20">No messages yet. Say hello! 👋</p>
                    )}
                    {messages.map(msg => (
                        <div
                            key={msg._id}
                            className={`flex mb-3 ${msg.senderId === currentUser.id ? 'justify-end' : 'justify-start'}`}
                        >
                            <div className={`px-4 py-3 rounded-2xl max-w-[70%] ${msg.senderId === currentUser.id
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                <p className="text-sm">{msg.content}</p>
                                <p className={`text-xs mt-1 ${msg.senderId === currentUser.id ? 'text-blue-200' : 'text-gray-400'}`}>
                                    {new Date(msg.createdAt).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))}
                    <div ref={bottomRef} />
                </div>

                {/* Input */}
                <div className="bg-white rounded-2xl shadow px-4 py-3 flex gap-3 items-center">
                    <input
                        className="flex-1 text-sm focus:outline-none"
                        placeholder="Type a message..."
                        value={newMessage}
                        onChange={e => setNewMessage(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && sendMessage()}
                    />
                    <button
                        className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                        onClick={sendMessage}
                    >
                        Send →
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Conversation;