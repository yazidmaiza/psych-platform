import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getUser } from '../services/auth';
import { api, toAbsoluteUrl } from '../services/api';
import { socket } from '../services/socket';
import GlassPanel from '../components/dashboard/GlassPanel';

const fmtTime = (d) => {
  try {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
};

const fmtDay = (d) => {
  try {
    return new Date(d).toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

const sameDay = (a, b) => {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate();
};

function Conversation({ otherUserId: otherUserIdProp, embedded = false, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [participant, setParticipant] = useState(null);
  const [sessionId, setSessionId] = useState(null);
  const [hasActiveSession, setHasActiveSession] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [loading, setLoading] = useState(true);
  const [sendBusy, setSendBusy] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [newMessagesHint, setNewMessagesHint] = useState(false);
  const [voiceAccessUrls, setVoiceAccessUrls] = useState({});
  const [voiceUrlLoading, setVoiceUrlLoading] = useState({});
  const { otherUserId: otherUserIdParam } = useParams();
  const otherUserId = otherUserIdProp || otherUserIdParam;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const messagesContainerRef = useRef(null);
  const recorderRef = useRef(null);
  const composerRef = useRef(null);

  const { userId, role } = getUser();
  const roomId = otherUserId ? [userId, otherUserId].sort().join('_') : null;
  const participantName = useMemo(() => {
    const firstName = participant?.firstName || '';
    const lastName = participant?.lastName || '';
    const name = [firstName, lastName].filter(Boolean).join(' ').trim();
    return name || t('conversation') || 'Conversation';
  }, [participant?.firstName, participant?.lastName, t]);
  const participantInitials = useMemo(() => {
    const first = participant?.firstName?.[0] || '';
    const last = participant?.lastName?.[0] || '';
    return `${first}${last}`.toUpperCase() || 'P';
  }, [participant?.firstName, participant?.lastName]);
  const participantPhoto = useMemo(() => toAbsoluteUrl(participant?.photo || ''), [participant?.photo]);

  useEffect(() => {
    if (!embedded) return;
    const t = setTimeout(() => composerRef.current?.focus?.(), 50);
    return () => clearTimeout(t);
  }, [embedded, otherUserId]);

  const isNearBottom = () => {
    if (messagesContainerRef.current) {
      const el = messagesContainerRef.current;
      const threshold = 48;
      return el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    }
    return true;
  };

  const scrollToBottom = (behavior = 'auto') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTo({ top: messagesContainerRef.current.scrollHeight, behavior });
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
    if (!otherUserId) return undefined;
    const fetchParticipant = async () => {
      try {
        const data = await api.get('/api/psychologists/by-user/' + otherUserId);
        setParticipant(data || null);
      } catch {
        setParticipant(null);
      }
    };

    const fetchMessages = async () => {
      try {
        setLoading(true);
        setFetchError('');
        const data = await api.get(`/api/messages/${otherUserId}`);
        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        setMessages([]);
        setFetchError('Failed to load messages.');
      } finally {
        setLoading(false);
      }
    };

    const fetchSession = async () => {
      try {
        const data = await api.get(`/api/sessions/patient/${otherUserId}`);
        if (Array.isArray(data) && data.length > 0) {
          const active = data.find((s) => String(s.status) === 'active');
          setHasActiveSession(Boolean(active?._id));
          setSessionId(active?._id || null);
        } else {
          setHasActiveSession(false);
          setSessionId(null);
        }
      } catch (err) {
        console.error(err);
        setHasActiveSession(false);
        setSessionId(null);
      }
    };

    if (roomId) socket.emit('join_room', roomId);
  fetchParticipant();
    fetchMessages();
    fetchSession();

    socket.on('receive_message', (data) => {
      if (data.message?.senderId !== userId) {
        const shouldAutoScroll = isNearBottom();
        setMessages((prev) => {
          if (prev.some((m) => String(m._id) === String(data.message._id))) return prev;
          return [...prev, data.message];
        });
        if (shouldAutoScroll) scrollToBottom('smooth');
        else setNewMessagesHint(true);
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
    if (loading) return;
    if (isNearBottom()) scrollToBottom();
  }, [loading, messages]);

  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = '0px';
    const next = Math.min(140, el.scrollHeight);
    el.style.height = `${next}px`;
  }, [newMessage]);

  useEffect(() => {
    if (!messagesContainerRef.current) return undefined;
    const el = messagesContainerRef.current;
    const onScroll = () => {
      if (isNearBottom()) setNewMessagesHint(false);
    };
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const renderedMessages = useMemo(() => {
    const list = Array.isArray(messages) ? messages : [];
    return list
      .slice()
      .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
  }, [messages]);

  const ensureVoiceAccessUrl = useCallback(async (messageId) => {
    if (!messageId) return '';
    if (voiceAccessUrls[messageId]) return voiceAccessUrls[messageId];
    if (voiceUrlLoading[messageId]) return '';
    try {
      setVoiceUrlLoading((prev) => ({ ...prev, [messageId]: true }));
      const res = await api.get(`/api/messages/${messageId}/voice-access-url`);
      const abs = toAbsoluteUrl(res?.url || '');
      if (!abs) throw new Error('Invalid voice URL');
      setVoiceAccessUrls((prev) => ({ ...prev, [messageId]: abs }));
      return abs;
    } catch (e) {
      console.error(e);
      return '';
    } finally {
      setVoiceUrlLoading((prev) => ({ ...prev, [messageId]: false }));
    }
  }, [voiceAccessUrls, voiceUrlLoading]);

  const sendMessage = async (content) => {
    const text = content || newMessage;
    if (!text.trim()) return;
    if (!otherUserId) return;
    if (sendBusy) return;
    if (!content) setNewMessage('');

    const shouldAutoScroll = isNearBottom();
    const tempId = `tmp_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const optimistic = {
      _id: tempId,
      senderId: userId,
      receiverId: otherUserId,
      content: text,
      createdAt: new Date().toISOString(),
      __local: { status: 'sending' }
    };

    setMessages((prev) => [...prev, optimistic]);
    if (shouldAutoScroll) scrollToBottom('smooth');
    setSendBusy(true);

    try {
      const savedMessage = await api.post('/api/messages', {
        receiverId: otherUserId,
        receiverModel: role === 'psychologist' ? 'User' : 'Psychologist',
        content: text
      });

      setMessages((prev) =>
        prev
          .filter((m) => String(m._id) !== String(tempId))
          .concat(prev.some((m) => String(m._id) === String(savedMessage._id)) ? [] : [savedMessage])
      );

      socket.emit('send_message', { roomId, message: savedMessage });
      composerRef.current?.focus?.();
    } catch (err) {
      console.error(err);
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(tempId) ? { ...m, __local: { status: 'failed' } } : m))
      );
      if (!content) setNewMessage(text);
    } finally {
      setSendBusy(false);
    }
  };

  const startRecording = async () => {
    try {
      if (!hasActiveSession || !sessionId) {
        alert('Voice messages require an active session.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = e => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'voice.webm');
          const saved = await api.postForm(`/api/sessions/${sessionId}/voice-message`, formData);

          setMessages((prev) => {
            if (prev.some((m) => String(m._id) === String(saved._id))) return prev;
            return [...prev, saved];
          });
          socket.emit('send_message', { roomId, message: saved });
          scrollToBottom('smooth');
        } catch (err) {
          console.error('Voice message upload failed:', err);
          alert('Voice message failed to send.');
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
    <div className={[embedded ? 'h-full bg-[var(--app-bg)]' : 'min-h-screen bg-[var(--app-bg)]', 'flex flex-col text-[var(--app-fg)]'].join(' ')}>
      {!embedded && (
        <div className="border-b border-white/10 bg-[var(--app-bg-70)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-4 sm:px-6">
            <button
              onClick={() => navigate(-1)}
              className="text-sm font-semibold text-white/70 hover:text-white"
            >
              {t('back') || 'Back'}
            </button>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {participantPhoto ? (
                    <img src={participantPhoto} alt={participantName} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-white/50">{participantInitials}</span>
                  )}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--app-bg)] bg-emerald-500" />
              </div>
              <div>
                <h1 className="text-sm font-semibold text-white">{participantName}</h1>
                <p className="text-xs text-white/60">{t('online') || 'Live chat'}</p>
              </div>
            </div>
            <button
              onClick={() => {
                setIsMuted(!isMuted);
                window.speechSynthesis.cancel();
              }}
              className="ml-auto rounded-full bg-white/5 px-3 py-1 text-xs font-semibold text-white/70 transition hover:bg-white/10"
            >
              {isMuted ? (t('muted') || 'Muted') : (t('soundOn') || 'Sound on')}
            </button>
          </div>
        </div>
      )}

      <div
        className={[
          embedded ? 'h-full px-4 py-4' : 'max-w-4xl w-full mx-auto px-4 sm:px-6 py-6',
          'flex flex-col'
        ].join(' ')}
        style={embedded ? undefined : { height: 'calc(100vh - 80px)' }}
      >
        <div
          ref={messagesContainerRef}
          className={[
            'flex-1 rounded-3xl p-4 sm:p-5 overflow-y-auto mb-4 border border-white/10',
            embedded ? 'bg-white/5' : 'bg-white/5 shadow-[0_20px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl'
          ].join(' ')}
        >
          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className={`flex ${idx % 2 ? 'justify-end' : 'justify-start'}`}>
                  <div className="h-14 w-[70%] max-w-[420px] rounded-2xl bg-white/10 animate-pulse" />
                </div>
              ))}
            </div>
          )}

          {!loading && fetchError && (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-50">
              {fetchError}
            </div>
          )}

          {!loading && !fetchError && renderedMessages.length === 0 && (
            <p className="mt-20 text-center text-white/40">{t('noMessagesYet') || 'No messages yet. Say hello!'}</p>
          )}

          {!loading && renderedMessages.map((msg, index) => {
            const mine = msg.senderId === userId;
            const showDay = index === 0 || !sameDay(renderedMessages[index - 1]?.createdAt, msg.createdAt);
            const localStatus = msg.__local?.status;

            return (
              <React.Fragment key={msg._id || index}>
                {showDay && (
                  <div className="my-4 flex items-center justify-center">
                    <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-semibold text-gray-500">
                      {fmtDay(msg.createdAt)}
                    </span>
                  </div>
                )}

                <div className={`flex mb-3 ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={[
                      'px-4 py-3 rounded-2xl max-w-[80%] sm:max-w-[70%] border',
                      mine ? 'bg-indigo-600/90 text-white border-indigo-400/20' : 'bg-white/5 text-white border-white/10',
                      localStatus === 'failed' ? 'ring-2 ring-rose-300' : ''
                    ].join(' ')}
                  >
                    {msg.kind === 'voice' ? (
                      <div className="min-w-[240px]">
                        {voiceAccessUrls[msg._id] ? (
                          <audio controls preload="metadata" className="w-full">
                            <source src={voiceAccessUrls[msg._id]} type={msg.voice?.mimeType || 'audio/webm'} />
                          </audio>
                        ) : (
                          <button
                            type="button"
                            onClick={() => ensureVoiceAccessUrl(msg._id)}
                            className={[
                              'w-full rounded-xl px-3 py-2 text-xs font-semibold transition',
                              mine ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-white/10 text-white hover:bg-white/15',
                              voiceUrlLoading[msg._id] ? 'opacity-70 cursor-wait' : ''
                            ].join(' ')}
                            disabled={voiceUrlLoading[msg._id]}
                            title="Load voice message"
                          >
                            {voiceUrlLoading[msg._id] ? 'Loading audio…' : 'Play voice message'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                    )}

                    <div className={`mt-1 flex items-center gap-2 text-xs ${mine ? 'text-blue-200' : 'text-white/40'}`}>
                      <span>{fmtTime(msg.createdAt)}</span>
                      {mine && localStatus === 'sending' && <span className="opacity-80">Sending...</span>}
                      {mine && localStatus === 'failed' && (
                        <>
                          <span className="text-rose-200">Failed</span>
                          <button
                            type="button"
                            className="underline underline-offset-2"
                            onClick={() => sendMessage(msg.content)}
                          >
                            Retry
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </React.Fragment>
            );
          })}
        </div>

        {newMessagesHint && (
          <div className="mb-3 flex justify-center">
            <button
              type="button"
              onClick={() => scrollToBottom('smooth')}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 shadow-sm hover:bg-white/10"
            >
              {t('newMessages') || 'New messages ↓'}
            </button>
          </div>
        )}

      <GlassPanel className={[
          'rounded-3xl px-4 py-3 flex gap-3 items-center border border-white/10',
          embedded ? 'bg-white/5' : 'bg-white/5 backdrop-blur-xl'
        ].join(' ')}>
          <textarea
            ref={composerRef}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm leading-relaxed text-white placeholder:text-white/35 focus:outline-none"
            placeholder={t('typeMessage') || 'Type a message...'}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          {hasActiveSession && sessionId && (
            <button
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${isRecording
                  ? 'bg-rose-500 text-white hover:bg-rose-600 animate-pulse'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              onClick={isRecording ? stopRecording : startRecording}
            >
                {isRecording ? (t('stop') || 'Stop') : (t('record') || 'Record')}
            </button>
          )}
          {embedded && (
            <button
              type="button"
              onClick={() => {
                setIsMuted(!isMuted);
                window.speechSynthesis.cancel();
              }}
              className="hidden sm:inline-flex px-3 py-2 rounded-xl text-xs font-semibold bg-white/5 text-white/70 hover:bg-white/10 transition"
              title={isMuted ? 'Enable text-to-speech' : 'Mute text-to-speech'}
            >
              {isMuted ? (t('muted') || 'Muted') : (t('soundOn') || 'Sound on')}
            </button>
          )}
          <button
            className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-indigo-700 transition disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => sendMessage()}
            disabled={sendBusy || !String(newMessage || '').trim()}
          >
            {sendBusy ? (t('sending') || 'Sending...') : (t('send') || 'Send')}
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}

export default Conversation;
