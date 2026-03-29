import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SessionTopBar from '../components/session/SessionTopBar';
import SessionTabs from '../components/session/SessionTabs';
import ChatBox from '../components/session/ChatBox';
import ConfirmDialog from '../components/session/ConfirmDialog';
import { logout } from '../services/auth';
import { api } from '../services/api';
import { useChatbotThread } from '../hooks/useChatbotThread';
import { usePsychologistThread } from '../hooks/usePsychologistThread';

const sessionTypeLabel = (t) => {
  if (t === 'preparation') return 'Preparation';
  if (t === 'followup') return 'Follow-up';
  if (t === 'free') return 'Free';
  return 'Session';
};

export default function SessionPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState(null);

  const [activeTab, setActiveTab] = useState('bot');
  const [botOpen, setBotOpen] = useState(true);
  const [psychologistOpen, setPsychologistOpen] = useState(true);

  const [confirmEndOpen, setConfirmEndOpen] = useState(false);
  const [ending, setEnding] = useState(false);

  const loadSession = useCallback(async () => {
    if (!sessionId) return;
    setLoadingSession(true);
    setSessionError(null);
    try {
      const data = await api.get('/api/sessions/' + sessionId);
      setSession(data);
    } catch (e) {
      setSession(null);
      setSessionError(e.message || 'Failed to load session');
    } finally {
      setLoadingSession(false);
    }
  }, [sessionId]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const psychologistUserId = useMemo(() => String(session?.psychologistId || ''), [session?.psychologistId]);
  const sessionStatus = session?.status;
  const psychologistDisabled = sessionStatus !== 'active';

  const bot = useChatbotThread({ sessionId });
  const psychologist = usePsychologistThread({
    otherUserId: psychologistUserId || null,
    enabled: !psychologistDisabled
  });

  useEffect(() => {
    if (activeTab === 'psychologist' && psychologistDisabled) setActiveTab('bot');
  }, [activeTab, psychologistDisabled]);

  useEffect(() => {
    if (!botOpen && activeTab === 'bot') setActiveTab(psychologistOpen ? 'psychologist' : 'bot');
    if (!psychologistOpen && activeTab === 'psychologist') setActiveTab(botOpen ? 'bot' : 'psychologist');
  }, [activeTab, botOpen, psychologistOpen]);

  const topStatusLabel = useMemo(() => {
    if (loadingSession) return 'Loading...';
    if (sessionError) return 'Session unavailable';
    if (psychologistDisabled) return 'Psychologist offline';
    return 'Live';
  }, [loadingSession, psychologistDisabled, sessionError]);

  const onCloseTab = useCallback((tab) => {
    if (tab === 'bot') setBotOpen(false);
    if (tab === 'psychologist') setPsychologistOpen(false);
  }, []);

  const onReopenTab = useCallback((tab) => {
    if (tab === 'bot') setBotOpen(true);
    if (tab === 'psychologist') setPsychologistOpen(true);
  }, []);

  const endSession = useCallback(async () => {
    setEnding(true);
    try {
      await api.post('/api/chatbot/' + sessionId + '/chatbot/end', {});
      navigate('/history');
    } catch (e) {
      alert(e.message || 'Failed to end session');
    } finally {
      setEnding(false);
      setConfirmEndOpen(false);
    }
  }, [navigate, sessionId]);

  const closeView = useCallback(() => {
    navigate('/history');
  }, [navigate]);

  const pageTitle = useMemo(() => {
    if (!session) return 'Session';
    return `${sessionTypeLabel(session.sessionType)} session`;
  }, [session]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
        <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900" />
      </div>

      <div className="relative">
        <SessionTopBar
          title={pageTitle}
          statusLabel={topStatusLabel}
          onLogout={logout}
          onEndSession={() => setConfirmEndOpen(true)}
          onCloseView={closeView}
        />

        <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6">
          <SessionTabs
            active={activeTab}
            botOpen={botOpen}
            psychologistOpen={psychologistOpen}
            psychologistDisabled={psychologistDisabled}
            onSelect={setActiveTab}
            onCloseTab={onCloseTab}
            onReopenTab={onReopenTab}
          />

          <div className="mt-4 grid gap-4">
            {sessionError && (
              <div className="rounded-3xl border border-rose-500/20 bg-rose-500/10 p-5 text-sm text-rose-50">
                {sessionError}
                <button
                  type="button"
                  onClick={loadSession}
                  className="ml-3 rounded-xl bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/15 transition"
                >
                  Retry
                </button>
              </div>
            )}

            <div className="h-[calc(100vh-220px)] min-h-[520px]">
              <div className="h-full transition-opacity duration-200">
                {activeTab === 'bot' && botOpen && (
                  <ChatBox
                    title="Chatbot"
                    subtitle="AI assistant for this session"
                    messages={bot.messages}
                    meId={null}
                    typing={bot.typing}
                    typingLabel="Assistant typing"
                    onSend={bot.send}
                    disabled={false}
                    placeholder="Message the AI assistant..."
                    sendLabel="Send"
                  />
                )}

                {activeTab === 'psychologist' && psychologistOpen && (
                  <ChatBox
                    title="Psychologist"
                    subtitle={psychologistDisabled ? 'Offline' : 'Secure live chat'}
                    messages={psychologist.messages}
                    meId={psychologist.userId}
                    typing={psychologist.typing}
                    typingLabel="Psychologist typing"
                    onSend={async (t) => {
                      try {
                        await psychologist.send(t);
                      } catch (e) {
                        alert(e.message || 'Failed to send message');
                      }
                    }}
                    disabled={psychologistDisabled}
                    disabledReason={psychologistDisabled ? 'Offline' : undefined}
                    placeholder={psychologistDisabled ? 'Psychologist is offline' : 'Message your psychologist...'}
                    sendLabel="Send"
                    onRequestEnable={() => navigate('/patient/dashboard')}
                  />
                )}

                {/* Fallback when tab closed */}
                {activeTab === 'bot' && !botOpen && (
                  <div className="grid h-full place-items-center rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
                    <div>
                      <div className="text-base font-semibold">Chatbot tab closed</div>
                      <button
                        type="button"
                        onClick={() => onReopenTab('bot')}
                        className="mt-4 rounded-xl bg-indigo-500/90 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition"
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                )}
                {activeTab === 'psychologist' && !psychologistOpen && (
                  <div className="grid h-full place-items-center rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
                    <div>
                      <div className="text-base font-semibold">Psychologist tab closed</div>
                      <button
                        type="button"
                        onClick={() => onReopenTab('psychologist')}
                        className="mt-4 rounded-xl bg-indigo-500/90 px-4 py-2 text-sm font-semibold hover:bg-indigo-500 transition"
                      >
                        Reopen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        <ConfirmDialog
          open={confirmEndOpen}
          title="End this session?"
          description="This will end the active session and generate an AI summary. You can still view your history later."
          confirmText="End session"
          cancelText="Cancel"
          variant="danger"
          busy={ending}
          onCancel={() => setConfirmEndOpen(false)}
          onConfirm={endSession}
        />
      </div>
    </div>
  );
}

