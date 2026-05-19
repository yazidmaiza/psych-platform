import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const STAGE_LABELS = [
  { en: 'Concern',  ar: 'القلق',    fr: 'Préoccupation', subtitle: "What's been on your mind" },
  { en: 'Feelings', ar: 'المشاعر',  fr: 'Émotions',      subtitle: 'How this has been making you feel' },
  { en: 'History',  ar: 'التاريخ',  fr: 'Historique',    subtitle: 'Whether this is new or familiar' },
  { en: 'Impact',   ar: 'الأثر',    fr: 'Impact',         subtitle: 'How this is affecting your daily life' },
  { en: 'Closing',  ar: 'الخاتمة', fr: 'Clôture',        subtitle: 'Anything else you want to share' }
];

const CRISIS_RESOURCES = {
  en: '🆘 If you are in immediate danger, please call emergency services (190) or a crisis line immediately.',
  ar: '🆘 إذا كنت في خطر فوري، اتصل بالطوارئ (190) أو بخط مساعدة الأزمات على الفور.',
  fr: "🆘 Si vous êtes en danger immédiat, appelez les services d'urgence (190) ou une ligne d'assistance immédiatement."
};

// Detect patient language from recent user messages.
// Uses Arabic Unicode block for Arabic/Darija, and French keyword heuristic.
// Falls back to 'en'.
const detectPatientLang = (messages = []) => {
  const userText = messages
    .filter(m => m.role === 'user')
    .slice(-4)
    .map(m => m.content)
    .join(' ');
  if (/[\u0600-\u06FF\u0750-\u077F]/.test(userText)) return 'ar';
  if (/\b(je|vous|merci|suis|être|pas|mon|ma|bonjour|oui|non)\b/i.test(userText)) return 'fr';
  return 'en';
};

const isRTL = (text) => /[\u0600-\u06FF\u0750-\u077F]/.test(text);

export default function Chatbot() {
  const navigate = useNavigate();
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState('');
  const [loading, setLoading]             = useState(false);
  const [resetLoading, setResetLoading]   = useState(false);
  const [stage, setStage]                 = useState(1);
  const [stageSubtitle, setStageSubtitle] = useState('');
  const [isComplete, setIsComplete]       = useState(false);
  const [initLoading, setInitLoading]     = useState(true);
  const [showSafety, setShowSafety]       = useState(false);
  const [crisisHold, setCrisisHold]       = useState(false);
  const [patientLang, setPatientLang]     = useState('en'); // detected from messages
  const [noSessionBooked, setNoSessionBooked] = useState(false);

  // ── Stage transition animation ─────────────────────────────────────────
  // When stageTransition: true comes back from the API, we briefly flash
  // the progress bar to draw the patient's eye to the stage change.
  const [transitioning, setTransitioning] = useState(false);

  const bottomRef   = useRef(null);
  const textareaRef = useRef(null);
  const liveRef     = useRef(null);

  // ---------- session init ----------
  const initSession = useCallback(async () => {
    setInitLoading(true);
    try {
      let history = [];
      try {
        const histData = await api.get('/api/chatbot/messages');
        if (Array.isArray(histData) && histData.length > 0) {
          history = histData.map(m => ({ role: m.role, content: m.content }));
        }
      } catch { /* ignore */ }

      const initData = await api.get('/api/chat/init');
      setStage(initData.stage || 1);
      setStageSubtitle(initData.stageSubtitle || STAGE_LABELS[(initData.stage || 1) - 1]?.subtitle || '');
      setIsComplete(initData.isComplete || false);

      if (initData.crisisHold) {
        setCrisisHold(true);
        setShowSafety(true);
      }

      if (history.length > 0) {
        setMessages(history);
      } else {
        const welcomeText = initData.openingQuestionEn || "I'm glad you're here. Tell me what's on your mind today.";
        setMessages([{ role: 'assistant', content: welcomeText }]);
      }
    } catch (err) {
      if (err.response?.status === 403) {
        setNoSessionBooked(true);
        const errMsg = err.response?.data?.message || 'You must book a session with a psychologist to access the chatbot.';
        setMessages([{ role: 'assistant', content: errMsg }]);
      } else {
        setMessages([{ role: 'assistant', content: "I'm glad you're here. Tell me what's on your mind today." }]);
      }
    } finally {
      setInitLoading(false);
    }
  }, []);

  useEffect(() => { initSession(); }, [initSession]);

  // ---------- logout summary ----------
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role  = localStorage.getItem('role');
    if (!token || role !== 'patient') return;

    let sent = false;
    const sendLogoutSummary = async () => {
      if (sent) return;
      sent = true;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        await fetch('http://localhost:5000/api/chatbot/logout-summary', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          keepalive: true,
          signal: controller.signal
        });
        clearTimeout(timeout);
      } catch { /* ignore */ }
    };

    window.addEventListener('beforeunload', sendLogoutSummary);
    return () => {
      window.removeEventListener('beforeunload', sendLogoutSummary);
      sendLogoutSummary();
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ---------- send ----------
  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || isComplete || crisisHold) return;

    setInput('');
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: text }]);

    try {
      const data = await api.post('/api/chat', { message: text });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);

      // Detect language from latest user message for safety resources
      setPatientLang(prev => {
        const updated = [...messages, { role: 'user', content: text }, { role: 'assistant', content: data.reply }];
        return detectPatientLang(updated);
      });

      // ── Update stage + subtitle ──────────────────────────────────────
      const newStage = data.stage || stage;
      if (newStage !== stage) {
        setStage(newStage);
        setStageSubtitle(data.stageSubtitle || STAGE_LABELS[newStage - 1]?.subtitle || '');
      }
      setIsComplete(data.isComplete || false);

      // ── Stage transition animation ───────────────────────────────────
      // Brief highlight on the progress bar so patient notices the stage
      // change without it being jarring. Clears after 1.5s.
      if (data.stageTransition) {
        setTransitioning(true);
        setTimeout(() => setTransitioning(false), 1500);
      }

      if (data.crisisHold) {
        setCrisisHold(true);
        setShowSafety(true);
      }
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: e.message || 'Something went wrong. Please try again.' }
      ]);
    } finally {
      setLoading(false);
      if (!crisisHold) setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  // ---------- reset ----------
  const resetConversation = async () => {
    if (resetLoading) return;
    const confirmed = window.confirm('Reset the conversation for testing? This clears the current chat, summary, and intake progress.');
    if (!confirmed) return;

    setResetLoading(true);
    setLoading(false);
    setInput('');
    setCrisisHold(false);
    setShowSafety(false);
    setTransitioning(false);

    try {
      await api.post('/api/chatbot/reset');
      await initSession();
    } catch (e) {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: e.message || 'Failed to reset the conversation.' }
      ]);
    } finally {
      setResetLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const progressPct   = Math.min(100, ((stage - 1) / 4) * 100);
  const currentLabel  = STAGE_LABELS[stage - 1];
  const progressLabel = isComplete
    ? 'Intake session complete'
    : `Stage ${stage} of 5: ${currentLabel?.en}`;

  return (
    <div className="intake-root">
      <div className="intake-ambient" aria-hidden="true">
        <div className="ambient-orb ambient-orb-top" />
        <div className="ambient-orb ambient-orb-bottom" />
      </div>

      {/* SR live region */}
      <div
        ref={liveRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Chat conversation"
        className="sr-only"
      >
        {messages.length > 0 && messages[messages.length - 1].role === 'assistant'
          ? messages[messages.length - 1].content
          : null}
        {loading ? 'Assistant is typing…' : null}
      </div>

      {/* Crisis hold SR announcement */}
      {crisisHold && (
        <div role="alert" aria-live="assertive" aria-atomic="true" className="sr-only">
          Your session has been paused for your safety. Your psychologist has been urgently notified. Please call 190 if you need immediate support.
        </div>
      )}

      <div className="intake-layout">
        {/* ── Header ── */}
        <header className="intake-header">
          <div className="header-inner">
            <div className="header-brand">
              <div className="header-icon" aria-hidden="true">🧠</div>
              <div>
                <div className="header-title" id="chatbot-title">
                  {crisisHold ? 'Session Paused' : 'Intake Session'}
                </div>
                <div className="header-sub">Confidential & Secure</div>
              </div>
            </div>
            <div className="header-actions">
              <button
                className="btn-ghost"
                onClick={resetConversation}
                disabled={resetLoading || initLoading || loading}
                aria-disabled={resetLoading || initLoading || loading}
                aria-label="Reset conversation"
              >
                {resetLoading ? 'Resetting…' : 'Reset'}
              </button>
              <button
                className="btn-ghost"
                onClick={() => setShowSafety(s => !s)}
                aria-pressed={showSafety}
                aria-label={showSafety ? 'Hide safety resources' : 'Show safety resources'}
              >
                🆘
              </button>
              <button className="btn-ghost" onClick={() => navigate('/history')} aria-label="Go back to history">
                ← Back
              </button>
            </div>
          </div>

          {showSafety && (
            <div className="safety-banner" role="alert" aria-live="assertive" aria-atomic="true">
              {CRISIS_RESOURCES[patientLang] || CRISIS_RESOURCES.en}
            </div>
          )}

          {/* Stage progress — hidden during crisis hold and if no session is booked */}
          {!crisisHold && !noSessionBooked && (
            <div className="stage-progress">
              <div className="stage-steps" role="list" aria-label="Intake stages">
                {STAGE_LABELS.map((label, i) => {
                  const stepNum  = i + 1;
                  const isDone   = isComplete ? true : stepNum < stage;
                  const isActive = !isComplete && stepNum === stage;
                  return (
                    <div
                      key={stepNum}
                      className={`stage-step ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                      role="listitem"
                    >
                      <div
                        className="step-circle"
                        aria-current={isActive ? 'step' : undefined}
                        aria-label={`${label.en}${isDone ? ', completed' : isActive ? ', current stage' : ', not yet reached'}`}
                      >
                        {isDone ? '✓' : stepNum}
                      </div>
                      <span className="step-label" aria-hidden="true">{label.en}</span>
                      {i < 4 && <div className={`step-connector ${isDone ? 'done' : ''}`} aria-hidden="true" />}
                    </div>
                  );
                })}
              </div>

              {/*
                ── Stage subtitle ────────────────────────────────────────
                Plain-language description of what this stage is exploring.
                Changes when stage advances. Helps patient understand purpose
                without clinical jargon.
              */}
              {!isComplete && (currentLabel?.subtitle || stageSubtitle) && (
                <p
                  className="stage-subtitle"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {stageSubtitle || currentLabel?.subtitle}
                </p>
              )}

              <div
                className={`progress-bar-track ${transitioning ? 'transitioning' : ''}`}
                role="progressbar"
                aria-valuenow={isComplete ? 100 : progressPct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuetext={progressLabel}
                aria-label="Session progress"
              >
                <div
                  className="progress-bar-fill"
                  style={{ width: isComplete ? '100%' : `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </header>

        {/* ── Main chat area ── */}
        <main className="intake-main" aria-labelledby="chatbot-title" aria-busy={initLoading}>
          {initLoading ? (
            <div className="init-loader" aria-label="Loading your session, please wait">
              <div className="loader-dots" aria-hidden="true"><div /><div /><div /></div>
              <span>Loading your session...</span>
            </div>
          ) : (
            <div className="messages-container" role="presentation">
              {messages.map((m, idx) => {
                const rtl = isRTL(m.content);
                return (
                  <div key={idx} className={`message-row ${m.role === 'user' ? 'user-row' : 'bot-row'}`}>
                    {m.role === 'assistant' && <div className="bot-avatar" aria-hidden="true">🧠</div>}
                    <div
                      className={`message-bubble ${m.role === 'user' ? 'user-bubble' : 'bot-bubble'}`}
                      dir={rtl ? 'rtl' : 'ltr'}
                      lang={rtl ? 'ar' : undefined}
                    >
                      {m.content}
                    </div>
                  </div>
                );
              })}

              {loading && (
                <div className="message-row bot-row" aria-hidden="true">
                  <div className="bot-avatar">🧠</div>
                  <div className="message-bubble bot-bubble typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          {isComplete && !crisisHold && (
            <div className="complete-banner" role="status" aria-live="polite" aria-atomic="true">
              <div className="complete-icon" aria-hidden="true">✅</div>
              <div className="complete-text">
                <strong>Intake Session Complete</strong>
                <p>Your responses have been securely shared with your psychologist to prepare for your session.</p>
              </div>
              <button className="btn-primary" onClick={() => navigate('/history')} aria-label="View your intake summary">
                View Summary
              </button>
            </div>
          )}

          {noSessionBooked && (
            <div className="complete-banner" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(99, 102, 241, 0.1))' }}>
              <div className="complete-icon" aria-hidden="true">🔒</div>
              <div className="complete-text">
                <strong style={{ color: '#fca5a5' }}>Booking Required</strong>
                <p>You must book a session with a psychologist to access the preconsultation chatbot.</p>
              </div>
              <button className="btn-primary" onClick={() => navigate('/patient/dashboard')} aria-label="Book a Session">
                Book a Session
              </button>
            </div>
          )}
        </main>

        {/* ── Crisis holding screen ── */}
        {crisisHold && (
          <footer className="crisis-hold-footer" aria-label="Session paused for safety">
            <div className="crisis-hold-inner">
              <div className="crisis-hold-icon" aria-hidden="true">🛑</div>
              <div className="crisis-hold-body">
                <strong className="crisis-hold-title">Your session has been paused</strong>
                <p className="crisis-hold-desc">
                  Your psychologist has been urgently notified and will reach out to you as soon as possible. You are not alone.
                </p>
                <a href="tel:190" className="crisis-phone-link" aria-label="Call emergency services at 190">
                  📞 Call 190 — Emergency Services
                </a>
              </div>
            </div>
          </footer>
        )}

        {/* ── Normal input area ── */}
        {!isComplete && !crisisHold && !noSessionBooked && (
          <footer className="intake-footer">
            <div className="input-area">
              <label htmlFor="chat-input" className="sr-only">Your message</label>
              <textarea
                id="chat-input"
                ref={textareaRef}
                rows={2}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Share what's on your mind…"
                disabled={loading || initLoading}
                aria-disabled={loading || initLoading}
                aria-describedby="input-hint"
                className="intake-textarea"
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim() || initLoading}
                aria-disabled={loading || !input.trim() || initLoading}
                aria-label={loading ? 'Sending message…' : 'Send message'}
                className="send-btn"
              >
                {loading ? <span className="send-spinner" aria-hidden="true" /> : <span aria-hidden="true">↑</span>}
              </button>
            </div>
            <p className="input-hint" id="input-hint">Press Enter to send · Shift+Enter for new line</p>
          </footer>
        )}
      </div>

      <style>{`
        .sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0;
          margin: -1px; overflow: hidden; clip: rect(0,0,0,0);
          white-space: nowrap; border: 0;
        }
        .btn-ghost:focus-visible, .btn-primary:focus-visible,
        .send-btn:focus-visible, .intake-textarea:focus-visible,
        .crisis-phone-link:focus-visible {
          outline: 2px solid #6366f1; outline-offset: 3px;
        }
        .intake-root {
          min-height: 100vh; background: var(--app-bg); color: var(--app-fg);
          font-family: 'Inter', -apple-system, sans-serif;
          position: relative; display: flex; flex-direction: column;
        }
        .intake-ambient { position: fixed; inset: 0; pointer-events: none; z-index: 0; }
        .ambient-orb { position: absolute; border-radius: 50%; filter: blur(80px); opacity: 0.18; }
        .ambient-orb-top {
          top: -80px; left: 50%; transform: translateX(-50%);
          width: 600px; height: 300px;
          background: radial-gradient(ellipse, var(--accent) 0%, rgba(139,92,246,1) 100%);
        }
        .ambient-orb-bottom {
          bottom: -100px; right: -100px; width: 400px; height: 400px;
          background: radial-gradient(ellipse, #ec4899 0%, var(--accent) 100%);
        }
        .intake-layout {
          position: relative; z-index: 1; display: flex; flex-direction: column;
          min-height: 100vh; max-width: 780px; margin: 0 auto; width: 100%;
        }
        .intake-header {
          position: sticky; top: 0; z-index: 40;
          background: color-mix(in srgb, var(--app-bg) 85%, transparent);
          backdrop-filter: blur(20px);
          border-bottom: 1px solid var(--panel-border); padding: 0 1rem;
        }
        .header-inner {
          display: flex; align-items: center;
          justify-content: space-between; padding: 1rem 0;
        }
        .header-brand { display: flex; align-items: center; gap: 0.75rem; }
        .header-icon {
          font-size: 1.5rem; width: 2.5rem; height: 2.5rem;
          background: linear-gradient(135deg, var(--accent), #8b5cf6);
          border-radius: 0.75rem; display: flex; align-items: center; justify-content: center;
        }
        .header-title { font-size: 1rem; font-weight: 700; letter-spacing: -0.02em; }
        .header-sub { font-size: 0.7rem; color: var(--muted); margin-top: 1px; }
        .header-actions { display: flex; gap: 0.5rem; }
        .btn-ghost {
          background: var(--panel-bg); border: 1px solid var(--panel-border);
          color: color-mix(in srgb, var(--app-fg) 75%, transparent);
          padding: 0.4rem 0.9rem; border-radius: 9999px;
          font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
        }
        .btn-ghost:hover:not(:disabled) { filter: brightness(1.08); color: var(--app-fg); }
        .btn-ghost:disabled, .btn-ghost[aria-disabled="true"] { opacity: 0.45; cursor: not-allowed; }
        .safety-banner {
          background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3);
          border-radius: 0.75rem; padding: 0.6rem 1rem;
          font-size: 0.78rem; color: #fca5a5; margin-bottom: 0.75rem; line-height: 1.5;
        }
        .stage-progress { padding: 0.75rem 0 1rem; }
        .stage-steps {
          display: flex; align-items: center; justify-content: center;
          gap: 0; margin-bottom: 0.35rem;
        }
        .stage-step {
          display: flex; flex-direction: column; align-items: center;
          gap: 0.25rem; position: relative; flex: 1;
        }
        .step-circle {
          width: 2rem; height: 2rem; border-radius: 50%;
          border: 2px solid rgba(255,255,255,0.15);
          background: rgba(255,255,255,0.05);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.35);
          transition: all 0.3s ease; z-index: 2;
        }
        .stage-step.active .step-circle {
          border-color: #6366f1;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          color: #fff; box-shadow: 0 0 16px rgba(99,102,241,0.5);
        }
        .stage-step.done .step-circle {
          border-color: #10b981;
          background: linear-gradient(135deg, #10b981, #059669); color: #fff;
        }
        .step-label {
          font-size: 0.62rem; font-weight: 600; color: rgba(255,255,255,0.35);
          text-align: center; letter-spacing: 0.02em;
        }
        .stage-step.active .step-label { color: #a5b4fc; }
        .stage-step.done .step-label { color: #6ee7b7; }
        .step-connector {
          position: absolute; top: 1rem; left: 50%;
          width: 100%; height: 2px; background: rgba(255,255,255,0.1); z-index: 1;
        }
        .step-connector.done { background: linear-gradient(90deg, #10b981, rgba(16,185,129,0.3)); }

        /* ── Stage subtitle ────────────────────────────────────────────
           Plain-language description beneath the stage steps.
           Transitions smoothly when stage changes.
        */
        .stage-subtitle {
          font-size: 0.72rem;
          color: rgba(255,255,255,0.45);
          text-align: center;
          margin: 0 0 0.5rem;
          font-style: italic;
          letter-spacing: 0.01em;
          transition: opacity 0.4s ease;
        }

        .progress-bar-track {
          height: 3px; background: rgba(255,255,255,0.08);
          border-radius: 9999px; overflow: hidden; margin: 0 0.5rem;
          transition: box-shadow 0.3s ease;
        }
        /* Brief glow when stage transitions */
        .progress-bar-track.transitioning {
          box-shadow: 0 0 8px 2px rgba(99,102,241,0.6);
        }
        .progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899);
          border-radius: 9999px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .intake-main {
          flex: 1; overflow-y: auto; padding: 1.25rem 1rem;
          display: flex; flex-direction: column;
        }
        .init-loader {
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 1rem; height: 200px;
          color: rgba(255,255,255,0.4); font-size: 0.85rem;
        }
        .loader-dots { display: flex; gap: 0.4rem; }
        .loader-dots div {
          width: 8px; height: 8px; border-radius: 50%; background: #6366f1;
          animation: bounce 1.2s ease-in-out infinite;
        }
        .loader-dots div:nth-child(2) { animation-delay: 0.15s; }
        .loader-dots div:nth-child(3) { animation-delay: 0.3s; }
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .messages-container { display: flex; flex-direction: column; gap: 1rem; }
        .message-row {
          display: flex; align-items: flex-end; gap: 0.6rem;
          animation: fadeSlideIn 0.25s ease;
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .user-row { flex-direction: row-reverse; }
        .bot-avatar {
          width: 2rem; height: 2rem; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.9rem; flex-shrink: 0;
        }
        .message-bubble {
          max-width: 72%; padding: 0.75rem 1rem; border-radius: 1.25rem;
          font-size: 0.9rem; line-height: 1.6; white-space: pre-wrap; word-break: break-word;
        }
        .message-bubble[dir="rtl"] { text-align: right; }
        .bot-bubble {
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.1);
          color: rgba(255,255,255,0.9); border-bottom-left-radius: 0.25rem;
        }
        .user-bubble {
          background: linear-gradient(135deg, #6366f1, #7c3aed); color: #fff;
          border-bottom-right-radius: 0.25rem;
          box-shadow: 0 4px 16px rgba(99,102,241,0.25);
        }
        .typing-indicator {
          display: flex; align-items: center; gap: 4px;
          padding: 0.75rem 1rem; min-height: 2.5rem;
        }
        .typing-indicator span {
          width: 7px; height: 7px; border-radius: 50%;
          background: rgba(255,255,255,0.4);
          animation: typingBounce 1.2s ease-in-out infinite;
        }
        .typing-indicator span:nth-child(2) { animation-delay: 0.15s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.3s; }
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        .complete-banner {
          display: flex; align-items: center; gap: 1rem;
          background: linear-gradient(135deg, rgba(16,185,129,0.15), rgba(99,102,241,0.1));
          border: 1px solid rgba(16,185,129,0.3);
          border-radius: 1.25rem; padding: 1.25rem; margin-top: 1.5rem; flex-wrap: wrap;
        }
        .complete-icon { font-size: 2rem; flex-shrink: 0; }
        .complete-text { flex: 1; min-width: 180px; }
        .complete-text strong {
          display: block; font-size: 1rem; font-weight: 700;
          color: #6ee7b7; margin-bottom: 0.25rem;
        }
        .complete-text p {
          font-size: 0.82rem; color: rgba(255,255,255,0.55); line-height: 1.5; margin: 0;
        }
        .btn-primary {
          background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; border: none;
          padding: 0.6rem 1.2rem; border-radius: 9999px; font-size: 0.82rem; font-weight: 700;
          cursor: pointer; transition: all 0.15s; white-space: nowrap; flex-shrink: 0;
        }
        .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.4); }
        .crisis-hold-footer {
          background: rgba(239,68,68,0.08); border-top: 1px solid rgba(239,68,68,0.3);
          backdrop-filter: blur(20px); padding: 1.25rem 1rem;
        }
        .crisis-hold-inner {
          display: flex; align-items: flex-start; gap: 1rem;
          max-width: 600px; margin: 0 auto;
        }
        .crisis-hold-icon { font-size: 1.5rem; flex-shrink: 0; margin-top: 2px; }
        .crisis-hold-body { flex: 1; }
        .crisis-hold-title {
          display: block; font-size: 0.95rem; font-weight: 700;
          color: #fca5a5; margin-bottom: 0.35rem;
        }
        .crisis-hold-desc {
          font-size: 0.82rem; color: rgba(255,255,255,0.65); line-height: 1.6; margin: 0 0 0.75rem;
        }
        .crisis-phone-link {
          display: inline-flex; align-items: center; gap: 0.4rem;
          background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4);
          color: #fca5a5; padding: 0.5rem 1rem; border-radius: 9999px;
          font-size: 0.82rem; font-weight: 700; text-decoration: none; transition: all 0.15s;
        }
        .crisis-phone-link:hover { background: rgba(239,68,68,0.3); color: #fff; }
        .intake-footer {
          background: rgba(10,15,30,0.85); backdrop-filter: blur(20px);
          border-top: 1px solid rgba(255,255,255,0.07); padding: 0.875rem 1rem;
        }
        .input-area { display: flex; align-items: flex-end; gap: 0.5rem; }
        .intake-textarea {
          flex: 1; background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12); border-radius: 1.1rem;
          color: #fff; font-size: 0.9rem; padding: 0.75rem 1rem;
          resize: none; outline: none; font-family: inherit;
          transition: border-color 0.15s; min-height: 48px;
        }
        .intake-textarea::placeholder { color: rgba(255,255,255,0.3); }
        .intake-textarea:focus {
          border-color: rgba(99,102,241,0.5); box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }
        .intake-textarea:disabled { opacity: 0.45; cursor: not-allowed; }
        .send-btn {
          width: 48px; height: 48px; border-radius: 50%;
          background: linear-gradient(135deg, #6366f1, #8b5cf6);
          border: none; color: #fff; font-size: 1.2rem; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; transition: all 0.15s;
          box-shadow: 0 4px 14px rgba(99,102,241,0.4);
        }
        .send-btn:disabled, .send-btn[aria-disabled="true"] {
          opacity: 0.4; cursor: not-allowed; box-shadow: none;
        }
        .send-btn:not(:disabled):hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(99,102,241,0.55); }
        .send-spinner {
          width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.3);
          border-top-color: #fff; border-radius: 50%; animation: spin 0.6s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .input-hint {
          font-size: 0.68rem; color: rgba(255,255,255,0.2); margin-top: 0.4rem; text-align: center;
        }
        @media (prefers-reduced-motion: reduce) {
          .progress-bar-fill { transition: none; }
          .progress-bar-track.transitioning { box-shadow: none; }
          .stage-subtitle { transition: none; }
          .message-row { animation: none; }
          .loader-dots div { animation: none; opacity: 1; transform: none; }
          .typing-indicator span { animation: none; opacity: 0.6; }
          .send-spinner { animation: none; border-top-color: #fff; opacity: 0.7; }
        }
        @media (forced-colors: active) {
          .step-circle, .btn-ghost, .btn-primary, .send-btn { forced-color-adjust: none; }
          .intake-textarea:focus { outline: 2px solid Highlight; }
          .crisis-hold-footer { border-top: 2px solid ButtonText; }
        }
      `}</style>
    </div>
  );
}