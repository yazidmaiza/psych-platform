import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

export default function Chatbot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await api.get('/api/chatbot/messages');
        if (Array.isArray(data) && data.length > 0) {
          setMessages(data.map((m) => ({ role: m.role, content: m.content })));
          return;
        }
      } catch {
        // ignore; fall back to local welcome message
      }

      setMessages([
        {
          role: 'assistant',
          content: "Hi. Tell me what's on your mind today."
        }
      ]);
    };

    loadHistory();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text) => {
    const messageText = (text || input).trim();
    if (!messageText || loading) return;

    setInput('');
    setLoading(true);
    setMessages((prev) => [...prev, { role: 'user', content: messageText }]);

    try {
      const data = await api.post('/api/chatbot/chatbot', { message: messageText });
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: e.message || 'Sorry, something went wrong. Please try again.' }
      ]);
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
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative flex min-h-screen flex-col">
        <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/40 backdrop-blur-xl">
          <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-lg font-semibold tracking-tight">Chatbot</div>
                <div className="mt-1 text-xs text-white/60">AI assistant for your consultation</div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/history')}
                className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
              >
                Back
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-6 sm:px-6">
          <div className="flex-1 overflow-y-auto rounded-3xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
            <div className="flex flex-col gap-3">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={[
                    'max-w-[80%] rounded-3xl px-4 py-3 text-sm leading-relaxed',
                    m.role === 'user'
                      ? 'ml-auto bg-indigo-500/90 text-white'
                      : 'mr-auto border border-white/10 bg-slate-950/50 text-white/90'
                  ].join(' ')}
                >
                  {m.content}
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="mt-4 flex items-end gap-2">
            <textarea
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message the assistant..."
              className="min-h-[48px] w-full resize-none rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/40 outline-none focus:border-indigo-400/40 focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              type="button"
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="h-[48px] shrink-0 rounded-2xl bg-indigo-500/90 px-5 text-sm font-semibold text-white shadow hover:bg-indigo-500 transition disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}

