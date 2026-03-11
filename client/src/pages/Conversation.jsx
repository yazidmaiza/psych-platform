import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser } from '../services/auth';
import { api } from '../services/api';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

function Conversation() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const { otherUserId } = useParams();
  const navigate = useNavigate();
  const messagesContainerRef = useRef(null);
  const { userId, role } = getUser();
  const roomId = [userId, otherUserId].sort().join('_');
  console.log('Conversation - userId:', userId, 'otherUserId:', otherUserId, 'roomId:', roomId);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    // Load existing messages once
    const fetchMessages = async () => {
      try {
        const data = await api.get(`/api/messages/${otherUserId}`);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        setMessages([]);
      }
    };

    socket.emit('join_room', roomId);
    fetchMessages();

    // Only add messages from the OTHER user
    socket.on('receive_message', (data) => {
      if (data.message?.senderId !== userId) {
        setMessages(prev => {
          if (prev.some(m => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
      }
    });

    return () => {
      socket.off('receive_message');
    };
  }, [otherUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async () => {
    if (!newMessage.trim()) return;
    const content = newMessage;
    setNewMessage('');

    try {
      const savedMessage = await api.post('/api/messages', {
        receiverId: otherUserId,
        receiverModel: role === 'psychologist' ? 'User' : 'Psychologist',
        content
      });

      // Add saved message (with real _id) to local state
      setMessages(prev => {
        if (prev.some(m => m._id === savedMessage._id)) return prev;
        return [...prev, savedMessage];
      });

      // Emit to other user
      socket.emit('send_message', { roomId, message: savedMessage });

    } catch (err) {
      console.error(err);
      setNewMessage(content); // restore message if failed
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-4">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 text-sm font-semibold hover:underline"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-gray-800">💬 Conversation</h1>
          <span className="text-xs text-green-500 font-semibold">● Live</span>
        </div>
      </div>

      <div
        className="max-w-3xl w-full mx-auto px-6 py-6 flex flex-col"
        style={{ height: 'calc(100vh - 80px)' }}
      >
        <div
          ref={messagesContainerRef}
          className="flex-1 bg-white rounded-2xl shadow p-5 overflow-y-auto mb-4"
        >
          {messages.length === 0 && (
            <p className="text-center text-gray-400 mt-20">No messages yet. Say hello! 👋</p>
          )}
          {messages.map((msg, index) => (
            <div
              key={msg._id || index}
              className={`flex mb-3 ${msg.senderId === userId ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`px-4 py-3 rounded-2xl max-w-[70%] ${msg.senderId === userId
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
        </div>

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