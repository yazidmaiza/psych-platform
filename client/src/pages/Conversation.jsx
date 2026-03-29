import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getUser } from '../services/auth';
import { api } from '../services/api';
import { socket } from '../services/socket';

function Conversation() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [sessionId, setSessionId] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const { otherUserId } = useParams();
  const navigate = useNavigate();
  const messagesContainerRef = useRef(null);
  const recorderRef = useRef(null);

  const { userId, role } = getUser();
  const roomId = [userId, otherUserId].sort().join('_');

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const speakMessage = (text) => {
    if (!text || isMuted) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const data = await api.get(`/api/messages/${otherUserId}`);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        setMessages([]);
      }
    };

    const fetchSession = async () => {
      try {
        const data = await api.get(`/api/sessions/patient/${otherUserId}`);
        if (Array.isArray(data) && data.length > 0) {
          const active = data.find(s => s.status === 'active') || data[data.length - 1];
          setSessionId(active._id);
        }
      } catch (err) {
        console.error(err);
      }
    };

    socket.emit('join_room', roomId);
    fetchMessages();
    fetchSession();

    socket.on('receive_message', (data) => {
      if (data.message?.senderId !== userId) {
        setMessages(prev => {
          if (prev.some(m => m._id === data.message._id)) return prev;
          return [...prev, data.message];
        });
        speakMessage(data.message.content);
      }
    });

    return () => {
      socket.off('receive_message');
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const sendMessage = async (content) => {
    const text = content || newMessage;
    if (!text.trim()) return;
    if (!content) setNewMessage('');

    try {
      const savedMessage = await api.post('/api/messages', {
        receiverId: otherUserId,
        receiverModel: role === 'psychologist' ? 'User' : 'Psychologist',
        content: text
      });

      setMessages(prev => {
        if (prev.some(m => m._id === savedMessage._id)) return prev;
        return [...prev, savedMessage];
      });

      socket.emit('send_message', { roomId, message: savedMessage });
    } catch (err) {
      console.error(err);
      if (!content) setNewMessage(text);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', blob, 'voice.webm');
        const token = localStorage.getItem('token');

        try {
          const res = await fetch(`http://localhost:5000/api/sessions/${sessionId}/voice`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}` },
            body: formData
          });
          const data = await res.json();
          if (data.text) sendMessage(data.text);
        } catch (err) {
          console.error('Voice transcription failed:', err);
        }

        stream.getTracks().forEach(track => track.stop());
        setIsRecording(false);
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setTimeout(() => {
        if (recorderRef.current?.state === 'recording') {
          recorderRef.current.stop();
        }
      }, 5000);
    } catch (err) {
      console.error('Microphone access denied:', err);
      alert('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
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
            Back
          </button>
          <h1 className="text-xl font-bold text-gray-800">Conversation</h1>
          <span className="text-xs text-green-500 font-semibold">Live</span>
          <button
            onClick={() => {
              setIsMuted(!isMuted);
              window.speechSynthesis.cancel();
            }}
            className="ml-auto text-xs font-semibold px-3 py-1 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition"
          >
            {isMuted ? 'Muted' : 'Sound on'}
          </button>
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
            <p className="text-center text-gray-400 mt-20">No messages yet. Say hello!</p>
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
          {sessionId && (
            <button
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${isRecording
                ? 'bg-red-500 text-white hover:bg-red-600 animate-pulse'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              onClick={isRecording ? stopRecording : startRecording}
            >
              {isRecording ? 'Stop' : 'Record'}
            </button>
          )}
          <button
            className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
            onClick={() => sendMessage()}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

export default Conversation;
