import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useParams } from 'react-router-dom';

function Conversation() {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const { userId, otherUserId } = useParams();
    const bottomRef = useRef(null);

    // Temporary fake current user until auth is ready
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
        // Poll every 5 seconds for new messages
        const interval = setInterval(fetchMessages, 5000);
        return () => clearInterval(interval);
    }, [userId, otherUserId]);

    // Auto scroll to bottom
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
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
            <h2>Conversation</h2>

            {/* Messages */}
            <div style={{
                border: '1px solid #ccc',
                borderRadius: '8px',
                padding: '15px',
                height: '400px',
                overflowY: 'scroll',
                marginBottom: '15px'
            }}>
                {messages.length === 0 && <p style={{ color: '#999' }}>No messages yet. Say hello! 👋</p>}
                {messages.map(msg => (
                    <div key={msg._id} style={{
                        display: 'flex',
                        justifyContent: msg.senderId === currentUser.id ? 'flex-end' : 'flex-start',
                        marginBottom: '10px'
                    }}>
                        <div style={{
                            background: msg.senderId === currentUser.id ? '#007bff' : '#f1f1f1',
                            color: msg.senderId === currentUser.id ? 'white' : 'black',
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
                <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{ display: 'flex', gap: '10px' }}>
                <input
                    style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #ccc' }}
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendMessage()}
                />
                <button
                    style={{ padding: '10px 20px', background: '#007bff', color: 'white', borderRadius: '8px', border: 'none' }}
                    onClick={sendMessage}
                >
                    Send
                </button>
            </div>
        </div>
    );
}

export default Conversation;