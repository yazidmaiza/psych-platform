import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../services/api';

export const useChatbotThread = () => {
  const [messages, setMessages] = useState([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const data = await api.get('/api/chatbot/messages');
      if (Array.isArray(data) && data.length > 0) {
        setMessages(data.map((m) => ({ ...m, role: m.role })));
        return;
      }
      setMessages([
        { id: 'welcome', role: 'assistant', content: "Hi. Tell me what's on your mind today.", createdAt: Date.now() }
      ]);
    } catch (e) {
      setError(e.message || 'Failed to load chatbot history');
      setMessages([
        { id: 'welcome', role: 'assistant', content: "Hi. Tell me what's on your mind today.", createdAt: Date.now() }
      ]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = useCallback(async (text) => {
    const messageText = (text || '').trim();
    if (!messageText) return;

    const optimistic = { id: 'u-' + Date.now(), role: 'user', content: messageText, createdAt: Date.now() };
    setMessages((prev) => [...prev, optimistic]);
    setTyping(true);
    setError(null);

    try {
      const data = await api.post('/api/chatbot/chatbot', { message: messageText });
      setMessages((prev) => [
        ...prev,
        { id: 'a-' + Date.now(), role: 'assistant', content: data.reply, createdAt: Date.now() }
      ]);
    } catch (e) {
      setError(e.message || 'Failed to send message');
      setMessages((prev) => [
        ...prev,
        { id: 'err-' + Date.now(), role: 'assistant', content: 'Sorry, something went wrong. Please try again.', createdAt: Date.now() }
      ]);
    } finally {
      setTyping(false);
    }
  }, []);

  const uiMessages = useMemo(() => messages.map((m) => ({
    id: m._id || m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt
  })), [messages]);

  return { messages: uiMessages, typing, error, reload: load, send };
};
