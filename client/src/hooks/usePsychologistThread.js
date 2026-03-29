import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { getUser } from '../services/auth';

export const usePsychologistThread = ({ otherUserId, enabled }) => {
  const { userId, role } = getUser();
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState(null);

  const roomId = useMemo(() => {
    if (!userId || !otherUserId) return null;
    return [userId, otherUserId].sort().join('_');
  }, [userId, otherUserId]);

  const load = useCallback(async () => {
    if (!otherUserId) return;
    setError(null);
    try {
      const data = await api.get('/api/messages/' + otherUserId);
      setMessages(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load messages');
      setMessages([]);
    }
  }, [otherUserId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!roomId) return;
    socket.emit('join_room', roomId);

    const onReceive = (data) => {
      const incoming = data?.message;
      if (!incoming) return;
      if (String(incoming.senderId) === String(userId)) return;

      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(incoming._id))) return prev;
        return [...prev, incoming];
      });

      if (enabled) {
        setTyping(true);
        window.setTimeout(() => setTyping(false), 1200);
      }
    };

    socket.on('receive_message', onReceive);
    return () => socket.off('receive_message', onReceive);
  }, [enabled, roomId, userId]);

  const send = useCallback(async (text) => {
    const messageText = (text || '').trim();
    if (!messageText || !otherUserId) return;
    if (!enabled) return;

    setError(null);
    try {
      const saved = await api.post('/api/messages', {
        receiverId: otherUserId,
        receiverModel: role === 'psychologist' ? 'User' : 'Psychologist',
        content: messageText
      });

      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(saved._id))) return prev;
        return [...prev, saved];
      });

      if (roomId) socket.emit('send_message', { roomId, message: saved });
    } catch (e) {
      setError(e.message || 'Failed to send message');
      throw e;
    }
  }, [enabled, otherUserId, role, roomId]);

  const uiMessages = useMemo(() => (Array.isArray(messages) ? messages : []).map((m) => ({
    _id: m._id,
    senderId: m.senderId,
    content: m.content,
    createdAt: m.createdAt
  })), [messages]);

  return { userId, messages: uiMessages, typing, error, reload: load, send };
};

