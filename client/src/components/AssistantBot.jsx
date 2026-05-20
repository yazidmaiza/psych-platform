import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

const SUGGESTED_QUESTIONS = [
  "How do I book a session?",
  "How does the AI chatbot work?",
  "How do I rate my psychologist?",
  "How does payment work?",
  "How do I become a psychologist on the platform?"
];

export default function AssistantBot() {
  const [isOpen, setIsOpen]             = useState(false);
  const [messages, setMessages]         = useState([{
    role: 'assistant',
    content: "Hi! I'm your PsychPlatform assistant. How can I help you today?"
  }]);
  const [input, setInput]               = useState('');
  const [loading, setLoading]           = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);
  const toggleRef   = useRef(null);   // toggle button — focus returns here on close
  const dialogRef   = useRef(null);   // dialog root — used for focus trap

  const location = useLocation();

  // ── Auto-scroll ─────────────────────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Focus management ────────────────────────────────────────────────
  // When the dialog opens, move focus to the input.
  // When it closes, return focus to the toggle button.
  useEffect(() => {
    if (isOpen) {
      // Small delay lets the dialog finish rendering before we steal focus
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      toggleRef.current?.focus();
    }
  }, [isOpen]);

  // ── Focus trap ──────────────────────────────────────────────────────
  // Tab / Shift+Tab cycles only within the dialog while it is open.
  // Escape closes the dialog.
  const handleDialogKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      setIsOpen(false);
      return;
    }
    if (e.key !== 'Tab') return;

    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = dialog.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, []);

  // ── Send message ─────────────────────────────────────────────────────
  const sendMessage = async (text) => {
    const messageText = text || input.trim();
    if (!messageText || loading) return;

    setInput('');
    setShowSuggestions(false);
    setLoading(true);
    setMessages(prev => [...prev, { role: 'user', content: messageText }]);

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('http://localhost:5000/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({ message: messageText, page: location.pathname })
      });

      const data = await res.json();
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply || 'Sorry, I could not process your request.'
      }]);
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const resetChat = () => {
    setMessages([{
      role: 'assistant',
      content: "Hi! I'm your PsychPlatform assistant. How can I help you today?"
    }]);
    setShowSuggestions(true);
    setInput('');
  };

  return (
    <>
      {/*
        ── Toggle button ──────────────────────────────────────────────
        aria-expanded: SR announces "collapsed / expanded" state.
        aria-haspopup="dialog": SR announces that activating opens a dialog.
        aria-label changes with state so the announced action is always clear.
        ref: focus returns here when dialog closes.
      */}
      <button
        ref={toggleRef}
        onClick={() => setIsOpen(prev => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={isOpen ? 'Close platform assistant' : 'Open platform assistant'}
        aria-controls="assistant-dialog"
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition flex items-center justify-center text-2xl z-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-300"
      >
        {/* aria-hidden: the label on the button is sufficient */}
        <span aria-hidden="true">{isOpen ? '✕' : '🧠'}</span>
      </button>

      {/*
        ── Chat dialog ────────────────────────────────────────────────
        role="dialog": tells SRs this is a modal dialog.
        aria-modal="true": tells SRs to ignore content outside (virtual cursor).
        aria-labelledby: SR reads the header title as the dialog name.
        onKeyDown: handles focus trap + Escape.
      */}
      {isOpen && (
        <div
          id="assistant-dialog"
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="assistant-dialog-title"
          onKeyDown={handleDialogKeyDown}
          className="fixed bottom-24 right-6 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
          style={{ height: '500px' }}
        >
          {/* ── Header ─────────────────────────────────────────────── */}
          <div className="bg-blue-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Decorative avatar — aria-hidden */}
              <div
                className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm"
                aria-hidden="true"
              >
                🧠
              </div>
              <div>
                {/*
                  id="assistant-dialog-title": referenced by aria-labelledby
                  above so the dialog is named "Platform Assistant".
                */}
                <p
                  id="assistant-dialog-title"
                  className="text-white font-semibold text-sm"
                >
                  Platform Assistant
                </p>
                <div className="flex items-center gap-1">
                  {/* Decorative status dot */}
                  <div className="w-1.5 h-1.5 bg-green-400 rounded-full" aria-hidden="true" />
                  <p className="text-blue-100 text-xs">Online</p>
                </div>
              </div>
            </div>
            <button
              onClick={resetChat}
              aria-label="Reset conversation"
              className="text-blue-200 hover:text-white text-xs transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:rounded"
            >
              Reset
            </button>
          </div>

          {/*
            ── Messages area ──────────────────────────────────────────
            role="log" + aria-live="polite" + aria-label:
            - "log" is semantically correct for chat (implies polite + additions).
            - "polite" means new messages are announced after the SR finishes
              its current job — appropriate for a non-urgent help bot.
            - aria-label gives the region a name for landmark navigation.

            The hidden status region below handles the typing announcement
            separately so it doesn't compete with message content.
          */}
          <div
            role="log"
            aria-live="polite"
            aria-relevant="additions"
            aria-label="Conversation with Platform Assistant"
            className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 bg-gray-50"
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  /* Decorative avatar — aria-hidden */
                  <div
                    className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs mr-2 flex-shrink-0 mt-1"
                    aria-hidden="true"
                  >
                    🧠
                  </div>
                )}
                <div className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm rounded-bl-sm'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {/*
              Typing indicator is aria-hidden here — the separate
              aria-live="polite" status region below announces it once
              cleanly, without the SR trying to read bouncing dots.
            */}
            {loading && (
              <div className="flex justify-start" aria-hidden="true">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-xs mr-2 flex-shrink-0">
                  🧠
                </div>
                <div className="bg-white shadow-sm px-3 py-2 rounded-2xl rounded-bl-sm">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            {/* Suggested questions */}
            {showSuggestions && messages.length === 1 && (
              <div className="flex flex-col gap-2 mt-2" role="group" aria-label="Suggested questions">
                <p className="text-xs text-gray-400 text-center" aria-hidden="true">
                  Suggested questions
                </p>
                {SUGGESTED_QUESTIONS.map((q, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(q)}
                    aria-label={`Ask: ${q}`}
                    className="text-left text-xs bg-white border border-gray-200 text-gray-600 px-3 py-2 rounded-xl hover:bg-blue-50 hover:border-blue-300 hover:text-blue-600 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 focus-visible:rounded-xl"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/*
            ── Hidden SR-only status region ───────────────────────────
            Announces "Assistant is typing…" when loading starts.
            Visually hidden but fully accessible.
            Kept outside the role="log" to avoid double-announcing messages.
          */}
          <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {loading ? 'Assistant is typing…' : ''}
          </div>

          {/* ── Input area ─────────────────────────────────────────── */}
          <div className="bg-white border-t border-gray-100 px-3 py-3 flex gap-2 items-center">
            {/*
              Explicit <label> for the input — placeholder text alone is
              not reliably announced by all SR/browser combinations.
              The label is visually hidden via sr-only.
            */}
            <label htmlFor="assistant-input" className="sr-only">
              Message the Platform Assistant
            </label>
            <input
              id="assistant-input"
              ref={inputRef}
              className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
              placeholder="Ask me anything..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              disabled={loading}
              aria-disabled={loading}
              autoComplete="off"
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              aria-disabled={loading || !input.trim()}
              aria-label={loading ? 'Sending…' : 'Send message'}
              className="bg-blue-600 text-white p-2 rounded-xl hover:bg-blue-700 transition disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-300"
            >
              {/* aria-hidden: label is on the button */}
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      )}

      <style>{`
        /* Screen-reader-only utility */
        .sr-only {
          position: absolute;
          width: 1px;
          height: 1px;
          padding: 0;
          margin: -1px;
          overflow: hidden;
          clip: rect(0, 0, 0, 0);
          white-space: nowrap;
          border: 0;
        }

        /* Respect reduced-motion preference — disable bounce on typing dots */
        @media (prefers-reduced-motion: reduce) {
          .animate-bounce {
            animation: none !important;
            opacity: 0.6;
          }
        }

        /* High-contrast mode */
        @media (forced-colors: active) {
          #assistant-dialog {
            border: 2px solid ButtonText;
          }
        }
      `}</style>
    </>
  );
}