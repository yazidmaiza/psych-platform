import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';
import { socket } from '../services/socket';
import { getUser } from '../services/auth';

export const usePsychologistThread = ({ otherUserId, enabled }) => {
  const { userId, role } = getUser();
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState(null);
  const [otherOnline, setOtherOnline] = useState(false);

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

    const onPresence = (payload) => {
      if (!payload?.roomId || payload.roomId !== roomId) return;
      if (payload.socketId === socket.id) return;
      setOtherOnline(Boolean(payload.online));
    };

    const onRead = (payload) => {
      if (!payload?.roomId || payload.roomId !== roomId) return;
      // Best-effort: mark messages sent by me as read in local UI.
      setMessages((prev) => prev.map((m) => {
        if (String(m.senderId) === String(userId)) return { ...m, isRead: true };
        return m;
      }));
    };

    socket.on('receive_message', onReceive);
    socket.on('presence', onPresence);
    socket.on('messages_read', onRead);
    return () => socket.off('receive_message', onReceive);
  }, [enabled, roomId, userId]);

  useEffect(() => {
    if (!otherUserId) return;
    // Mark messages as read when opening the thread (best-effort).
    api.put(`/api/messages/read/${otherUserId}`, {}).catch(() => {});
    if (roomId) socket.emit('messages_read', { roomId, readerId: userId });
  }, [otherUserId, roomId, userId]);

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

  const sendVoice = useCallback(async ({ sessionId, blob, mimeType = 'audio/webm' }) => {
    if (!enabled) return;
    if (!sessionId) throw new Error('Missing sessionId');
    if (!blob) throw new Error('Missing audio blob');

    setError(null);
    const formData = new FormData();
    formData.append('audio', blob, 'voice.webm');
    try {
      const saved = await api.postForm(`/api/sessions/${sessionId}/voice-message`, formData);

      setMessages((prev) => {
        if (prev.some((m) => String(m._id) === String(saved._id))) return prev;
        return [...prev, saved];
      });

      if (roomId) socket.emit('send_message', { roomId, message: saved });
      return saved;
    } catch (e) {
      setError(e.message || 'Failed to send voice message');
      throw e;
    }
  }, [enabled, roomId]);

  const uiMessages = useMemo(() => (Array.isArray(messages) ? messages : []).map((m) => ({
    _id: m._id,
    senderId: m.senderId,
    kind: m.kind || 'text',
    content: m.content,
    voice: m.voice || null,
    isRead: Boolean(m.isRead),
    createdAt: m.createdAt
  })), [messages]);

  return { userId, otherOnline, messages: uiMessages, typing, error, reload: load, send, sendVoice };
};
