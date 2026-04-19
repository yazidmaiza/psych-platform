import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const STAGE_LABELS = [
  { en: 'Concern', ar: 'القلق', fr: 'Préoccupation' },
  { en: 'Feelings', ar: 'المشاعر', fr: 'Émotions' },
  { en: 'History', ar: 'التاريخ', fr: 'Historique' },
  { en: 'Impact', ar: 'الأثر', fr: 'Impact' },
  { en: 'Closing', ar: 'الخاتمة', fr: 'Clôture' }
];

const CRISIS_RESOURCES = {
  en: '🆘 If you are in immediate danger, please call emergency services (190) or a crisis line immediately.',
  ar: '🆘 إذا كنت في خطر فوري، اتصل بالطوارئ (190) أو بخط مساعدة الأزمات على الفور.',
  fr: '🆘 Si vous êtes en danger immédiat, appelez les services d\'urgence (190) ou une ligne d\'assistance immédiatement.'
};

export default function Chatbot() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(1);
  const [isComplete, setIsComplete] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [showSafety, setShowSafety] = useState(false);
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  // Load session state & prime the intro message
  const initSession = useCallback(async () => {
    setInitLoading(true);
    try {
      // Try loading existing message history first
      let history = [];
      try {
        const histData = await api.get('/api/chatbot/messages');
        if (Array.isArray(histData) && histData.length > 0) {
          history = histData.map(m => ({ role: m.role, content: m.content }));
        }
      } catch {
        // ignore
      }

      // Fetch stage state
      const initData = await api.get('/api/chat/init');
      setStage(initData.stage || 1);
      setIsComplete(initData.isComplete || false);

      if (history.length > 0) {
        setMessages(history);
      } else {
        // Use the protocol's opening question as the welcome message
        const welcomeText = initData.openingQuestionEn || "I'm glad you're here. Tell me what's on your mind today.";
        setMessages([{ role: 'assistant', content: welcomeText }]);
      }
    } catch {
      setMessages([{ role: 'assistant', content: "I'm glad you're here. Tell me what's on your mind today." }]);
    } finally {
      setInitLoading(false);
    }
  }, []);

  useEffect(() => { initSession(); }, [initSession]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || isComplete) return;

    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      const data = await api.post('/api/chat', { message: text });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
      setStage(data.stage || stage);
      setIsComplete(data.isComplete || false);
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: e.message || 'Something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const progressPct = Math.min(100, ((stage - 1) / 4) * 100);

  return (
    <div className="intake-root">
      {/* Ambient background */}
      <div className="intake-ambient">
        <div className="ambient-orb ambient-orb-top" />
        <div className="ambient-orb ambient-orb-bottom" />
      </div>

      <div className="intake-layout">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="intake-header">
          <div className="header-inner">
            <div className="header-brand">
              <div className="header-icon">🧠</div>
              <div>
                <div className="header-title">Intake Session</div>
                <div className="header-sub">Confidential & Secure</div>
              </div>
            </div>
            <div className="header-actions">
              <button
                className="btn-ghost"
                onClick={() => setShowSafety(s => !s)}
                title="Safety resources"
              >
                🆘
              </button>
              <button className="btn-ghost" onClick={() => navigate('/history')}>
                ← Back
              </button>
            </div>
          </div>

          {/* Safety banner */}
          {showSafety && (
            <div className="safety-banner">
              {CRISIS_RESOURCES.en}
            </div>
          )}

          {/* 5-step progress indicator */}
          <div className="stage-progress">
            <div className="stage-steps">
              {STAGE_LABELS.map((label, i) => {
                const stepNum = i + 1;
                const isDone = isComplete ? true : stepNum < stage;
                const isActive = !isComplete && stepNum === stage;
                return (
                  <div key={stepNum} className={`stage-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}>
                    <div className="step-circle">
                      {isDone ? '✓' : stepNum}
                    </div>
                    <span className="step-label">{label.en}</span>
                    {i < 4 && <div className={`step-connector ${isDone ? 'done' : ''}`} />}
                  </div>
                );
              })}
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: isComplete ? '100%' : `${progressPct}%` }} />
            </div>
          </div>
        </header>

        {/* ── Main chat area ────────────────────────────────────────────── */}
        <main className="intake-main">
          {initLoading ? (
            <div className="init-loader">
              <div className="loader-dots">
                <div /><div /><div />
              </div>
              <span>Loading your session...</span>
            </div>
          ) : (
            <div className="messages-container">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`message-row ${m.role === 'user' ? 'user-row' : 'bot-row'}`}
                >
                  {m.role === 'assistant' && (
                    <div className="bot-avatar">🧠</div>
                  )}
                  <div className={`message-bubble ${m.role === 'user' ? 'user-bubble' : 'bot-bubble'}`}>
                    {m.content}
                  </div>
                </div>
              ))}

              {/* Typing indicator */}
              {loading && (
                <div className="message-row bot-row">
                  <div className="bot-avatar">🧠</div>
                  <div className="message-bubble bot-bubble typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          {/* ── Session complete banner ─────────────────────────────────── */}
          {isComplete && (
            <div className="complete-banner">
              <div className="complete-icon">✅</div>
              <div className="complete-text">
                <strong>Intake Session Complete</strong>
                <p>Your responses have been securely shared with your psychologist to prepare for your session.</p>
              </div>
              <button
                className="btn-primary"
                onClick={() => navigate('/history')}
              >
                View Summary
              </button>
            </div>
          )}
        </main>

        {/* ── Input area ────────────────────────────────────────────────── */}
        {!isComplete && (
          <footer className="intake-footer">
            <div className="input-area">
              <textarea
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Share what's on your mind…"
                disabled={loading || initLoading}
                className="intake-textarea"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim() || initLoading}
                className="send-btn"
              >
                {loading ? (
                  <span className="send-spinner" />
                ) : (
                  <span>↑</span>
                )}
              </button>
            </div>
            <p className="input-hint">Press Enter to send · Shift+Enter for new line</p>
          </footer>
        )}
      </div>

      <style>{`
        .intake-root {
          min-height: 100vh;
          background: #0a0f1e;
          color: #fff;
          font-family: 'Inter', -apple-system, sans-serif;
          position: relative;
          display: flex;
          flex-direction: column;
        }
        .intake-ambient {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 0;
        }
        .ambient-orb {
          position: absolute;
          border-radius: 50%;
          filter: blur(80px);
          opacity: 0.18;
        }
        .ambient-orb-top {
          top: -80px;
          left: 50%;
          transform: translateX(-50%);
          width: 600px;
          height: 300px;
          background: radial-gradient(ellipse, #6366f1 0%, #8b5cf6 100%);
        }
        .ambient-orb-bottom {
          bottom: -100px;
          right: -100px;
          width: 400px;
          height: 400px;
          background: radial-gradient(ellipse, #ec4899 0%, #8b5cf6 100%);
        }
        .intake-layout {
          position: relative;
          z-index: 1;
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          max-width: 780px;
          margin: 0 auto;
          width: 100%;
        }
        /* Header */
        .intake-header {
          position: sticky;
          top: 0;
          z-index: 40;
          background: rgba(10, 15, 30, 0.85);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid rgba(255,255,255,0.08);
          padding: 0 1rem;
        }
        .header-inner {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 0;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .header-icon {
          font-size: 1.5rem;
          width: 2.5rem;
          height: 2.5rem;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .header-title {
          font-size: 1rem;
          font-weight: 700;
          letter-spacing: -0.02em;
        }
        .header-sub {
          font-size: 0.7rem;
          color: rgba(255,255,255,0.45);
          margin-top: 1px;
        }
        .header-actions {
          display: flex;
          gap: 0.5rem;
        }
        .btn-ghost {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.7);
          padding: 0.4rem 0.9rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s;
        }
        .btn-ghost:hover {
          background: rgba(255,255,255,0.12);
          color: #fff;
        }
        .safety-banner {
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.3);
          border-radius: 0.75rem;
          padding: 0.6rem 1rem;
          font-size: 0.78rem;
          color: #fca5a5;
          margin-bottom: 0.75rem;
          line-height: 1.5;
        }
        /* Stage progress */
        .stage-progress {
          padding: 0.75rem 0 1rem;
        }
        .stage-steps {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          margin-bottom: 0.5rem;
        }
        .stage-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.25rem;
          position: relative;
          flex: 1;
        }
        .step-circle {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.7rem;
          font-weight: 700;
          color: rgba(255,255,255,0.35);
          transition: all 0.3s ease;
          z-index: 2;
        }
        .stage-step.active .step-circle {
          border-color: #6366f1;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          box-shadow: 0 0 16px rgba(99, 102, 241, 0.5);
        }
        .stage-step.done .step-circle {
          border-color: #10b981;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
        }
        .step-label {
          font-size: 0.62rem;
          font-weight: 600;
          color: rgba(255,255,255,0.35);
          text-align: center;
          letter-spacing: 0.02em;
        }
        .stage-step.active .step-label {
          color: #a5b4fc;
        }
        .stage-step.done .step-label {
          color: #6ee7b7;
        }
        .step-connector {
          position: absolute;
          top: 1rem;
          left: 50%;
          width: 100%;
          height: 2px;
          background: rgba(255,255,255,0.1);
          z-index: 1;
        }
        .step-connector.done {
          background: linear-gradient(90deg, #10b981, rgba(16, 185, 129, 0.3));
        }
        .progress-bar-track {
          height: 3px;
          background: rgba(255,255,255,0.08);
          border-radius: 9999px;
          overflow: hidden;
          margin: 0 0.5rem;
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
          border-radius: 9999px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        /* Main */
        .intake-main {
          flex: 1;
          overflow-y: auto;
          padding: 1.25rem 1rem;
          display: flex;
          flex-direction: column;
        }
        .init-loader {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          height: 200px;
          color: rgba(255,255,255,0.4);
          font-size: 0.85rem;
        }
        .loader-dots {
          display: flex;
          gap: 0.4rem;
        }
        .loader-dots div {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6366f1;
          animation: bounce 1.2s ease-in-out infinite;
        }
        .loader-dots div:nth-child(2) { animation-delay: 0.15s; }
        .loader-dots div:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .messages-container {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .message-row {
          display: flex;
          align-items: flex-end;
          gap: 0.6rem;
          animation: fadeSlideIn 0.25s ease;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .user-row {
          flex-direction: row-reverse;
        }
        .bot-avatar {
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.9rem;
          flex-shrink: 0;
        }
        .message-bubble {
          max-width: 72%;
          padding: 0.75rem 1rem;
          border-radius: 1.25rem;
          font-size: 0.9rem;
          line-height: 1.6;
          white-space: pre-wrap;
          word-break: break-word;
        }
        .bot-bubble {
          background: rgba(255,255,255,0.07);
          border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.9);
          border-bottom-left-radius: 0.25rem;
        }
        .user-bubble {
          background: linear-gradient(135deg, #6366f1, #7c3aed);
          color: #fff;
          border-bottom-right-radius: 0.25rem;
          box-shadow: 0 4px 16px rgba(99, 102, 241, 0.25);
        }
        /* Typing indicator */
        .typing-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 0.75rem 1rem;
          min-height: 2.5rem;
        }
        .typing-indicator span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: rgba(255,255,255,0.4);
          animation: typingBounce 1.2s ease-in-out infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        /* Complete banner */
        .complete-banner {
          display: flex;
          align-items: center;
          gap: 1rem;
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(99, 102, 241, 0.1));
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 1.25rem;
          padding: 1.25rem;
          margin-top: 1.5rem;
          flex-wrap: wrap;
        }
        .complete-icon {
          font-size: 2rem;
          flex-shrink: 0;
        }
        .complete-text {
          flex: 1;
          min-width: 180px;
        }
        .complete-text strong {
          display: block;
          font-size: 1rem;
          font-weight: 700;
          color: #6ee7b7;
          margin-bottom: 0.25rem;
        }
        .complete-text p {
          font-size: 0.82rem;
          color: rgba(255,255,255,0.55);
          line-height: 1.5;
          margin: 0;
        }
        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff;
          border: none;
          padding: 0.6rem 1.2rem;
          border-radius: 9999px;
          font-size: 0.82rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .btn-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.4);
        }
        /* Footer / input */
        .intake-footer {
          background: rgba(10, 15, 30, 0.85);
          backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.07);
          padding: 0.875rem 1rem;
        }
        .input-area {
          display: flex;
          align-items: flex-end;
          gap: 0.5rem;
        }
        .intake-textarea {
          flex: 1;
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 1.1rem;
          color: #fff;
          font-size: 0.9rem;
          padding: 0.75rem 1rem;
          resize: none;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s;
          min-height: 48px;
        }
        .intake-textarea::placeholder { color: rgba(255,255,255,0.3); }
        .intake-textarea:focus {
          border-color: rgba(99, 102, 241, 0.5);
          box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
        }
        .send-btn {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none;
          color: #fff;
          font-size: 1.2rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: all 0.15s;
          box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
        }
        .send-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }
        .send-btn:not(:disabled):hover {
          transform: scale(1.08);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.55);
        }
        .send-spinner {
          width: 18px;
          height: 18px;
          border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .input-hint {
          font-size: 0.68rem;
          color: rgba(255,255,255,0.2);
          margin-top: 0.4rem;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
