import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, toAbsoluteUrl } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

export default function CreateSession() {
    const { psychologistId } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [selectedDuration, setSelectedDuration] = useState(60);
    const [selectedDayKey, setSelectedDayKey] = useState('');
    const [selectedWindowKey, setSelectedWindowKey] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [slotsError, setSlotsError] = useState('');
    const [psychologist, setPsychologist] = useState(null);
    const [psyLoading, setPsyLoading] = useState(true);
    const [slots, setSlots] = useState([]);
    const [slotsLoading, setSlotsLoading] = useState(true);

    useEffect(() => {
        let mounted = true;

        const fetchPsychologist = async () => {
            if (!psychologistId) {
                if (mounted) setPsyLoading(false);
                return;
            }

            if (mounted) {
                setPsyLoading(true);
            }

            try {
                const data = await api.get('/api/psychologists/' + psychologistId);
                if (mounted) {
                    setPsychologist(data || null);
                    setPsyLoading(false);
                }
                return;
            } catch {
                // fallback to by-user route for compatibility
            }

            try {
                const byUser = await api.get('/api/psychologists/by-user/' + psychologistId);
                if (mounted) setPsychologist(byUser || null);
            } catch {
                if (mounted) setPsychologist(null);
            } finally {
                if (mounted) setPsyLoading(false);
            }
        };

        fetchPsychologist();
        return () => {
            mounted = false;
        };
    }, [psychologistId]);

    useEffect(() => {
        let mounted = true;

        const fetchSlots = async () => {
            const slotOwnerId = psychologist?.userId?._id || psychologist?.userId || psychologistId;
            if (!slotOwnerId) {
                if (mounted) {
                    setSlots([]);
                    setSlotsLoading(false);
                    setSlotsError('');
                }
                return;
            }

            if (mounted) {
                setSlotsLoading(true);
                setSlotsError('');
            }

            try {
                const data = await api.get(`/api/calendar/slots/${slotOwnerId}`);
                if (mounted) {
                    setSlots(Array.isArray(data) ? data : []);
                }
            } catch {
                if (mounted) {
                    setSlots([]);
                    setSlotsError('Could not load availability slots right now.');
                }
            } finally {
                if (mounted) {
                    setSlotsLoading(false);
                }
            }
        };

        fetchSlots();
        return () => {
            mounted = false;
        };
    }, [psychologistId, psychologist]);

    const sessionPrice = useMemo(
        () => Number(psychologist?.sessionPrice || psychologist?.hourlyRate || 120),
        [psychologist]
    );

    const availableSlots = useMemo(() => {
        const now = Date.now();
        return (Array.isArray(slots) ? slots : [])
            .filter((slot) => slot?.start && !slot.isBooked && !slot.pendingSessionId && new Date(slot.start).getTime() >= now)
            .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    }, [slots]);

    const bookableWindows = useMemo(() => {
        const durationMs = selectedDuration * 60 * 1000;
        const stepMs = 30 * 60 * 1000;
        const now = Date.now();
        const windows = [];

        for (const slot of availableSlots) {
            const slotStartMs = new Date(slot.start).getTime();
            const slotEndMs = new Date(slot.end).getTime();

            for (let startMs = slotStartMs; startMs + durationMs <= slotEndMs; startMs += stepMs) {
                if (startMs < now) continue;
                const endMs = startMs + durationMs;
                const key = `${slot._id}_${startMs}_${selectedDuration}`;
                const startDate = new Date(startMs);
                const dayKey = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${String(startDate.getDate()).padStart(2, '0')}`;

                windows.push({
                    key,
                    slotId: slot._id,
                    startIso: new Date(startMs).toISOString(),
                    endIso: new Date(endMs).toISOString(),
                    dayKey,
                });
            }
        }

        return windows;
    }, [availableSlots, selectedDuration]);

    const selectedWindow = useMemo(
        () => bookableWindows.find((window) => window.key === selectedWindowKey) || null,
        [bookableWindows, selectedWindowKey]
    );

    useEffect(() => {
        setSelectedWindowKey('');
    }, [selectedDuration]);

    const dayOptions = useMemo(() => {
        const map = new Map();

        for (const window of bookableWindows) {
            if (!map.has(window.dayKey)) {
                map.set(window.dayKey, {
                    dayKey: window.dayKey,
                    date: new Date(window.startIso),
                    count: 0,
                });
            }
            map.get(window.dayKey).count += 1;
        }

        return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [bookableWindows]);

    useEffect(() => {
        if (!dayOptions.length) {
            setSelectedDayKey('');
            return;
        }

        const exists = dayOptions.some((d) => d.dayKey === selectedDayKey);
        if (!exists) {
            setSelectedDayKey(dayOptions[0].dayKey);
        }
    }, [dayOptions, selectedDayKey]);

    useEffect(() => {
        setSelectedWindowKey('');
    }, [selectedDayKey]);

    const visibleWindows = useMemo(
        () => bookableWindows.filter((window) => window.dayKey === selectedDayKey),
        [bookableWindows, selectedDayKey]
    );

    const handleCreate = async () => {
        if (!selectedWindow) {
            setError(t('selectAvailabilitySlot'));
            return;
        }

        setLoading(true);
        setError('');
        try {
            const data = await api.post(`/api/calendar/slots/${selectedWindow.slotId}/request`, {
                chosenStart: selectedWindow.startIso,
                chosenDuration: selectedDuration,
            });
            const sessionId = data?.sessionId || data?._id || data?.data?.sessionId || data?.data?._id;
            if (!sessionId) throw new Error(t('bookingFailed'));
            navigate('/patient/dashboard');
        } catch (e) {
            setError(e.message || t('bookingFailed'));
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-16 w-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                        {!psyLoading && psychologist?.photo ? (
                            <img
                                src={toAbsoluteUrl(psychologist.photo)}
                                alt={`${psychologist.firstName || ''} ${psychologist.lastName || ''}`}
                                className="h-full w-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        ) : (
                            <div className="text-[color:var(--muted)]">{psyLoading ? '...' : (psychologist?.firstName?.[0] || 'P')}</div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-[color:var(--app-fg)]">{t('bookSessionWith')}</h1>
                        <p className="text-sm text-[color:var(--muted)]">
                            {psyLoading
                                ? t('loading')
                                : (psychologist ? `${psychologist.firstName || ''} ${psychologist.lastName || ''}` : t('psychologist'))}
                        </p>
                        <div className="flex gap-1.5 mt-1">
                            {(psychologist?.specializations || []).slice(0, 3).map((spec) => (
                                <span key={spec} className="text-xs text-[color:var(--muted)]">{spec}</span>
                            ))}
                        </div>
                        <div className="mt-2 text-xs text-[color:var(--muted)]">
                            {psychologist?.availability
                                ? `Availability: ${psychologist.availability}`
                                : 'Availability not provided'}
                        </div>
                    </div>
                </div>

                <GlassPanel className="p-5 mb-8 border border-indigo-500/20 bg-indigo-500/5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h2 className="text-lg font-semibold text-[color:var(--app-fg)]">{t('singleOffer')}</h2>
                            <p className="mt-1 text-sm text-[color:var(--muted)]">{t('singleOfferDesc')}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="text-lg font-semibold text-[color:var(--app-fg)]">${sessionPrice}</p>
                            <p className="text-xs text-[color:var(--muted)]">{t('perSession')}</p>
                        </div>
                    </div>
                </GlassPanel>

                <GlassPanel className="p-5 mb-8">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h3 className="font-semibold text-[color:var(--app-fg)]">{t('selectAvailabilitySlot')}</h3>
                        <div className="text-xs text-[color:var(--muted)]">
                            {slotsLoading ? t('loading') : `${bookableWindows.length} option${bookableWindows.length === 1 ? '' : 's'}`}
                        </div>
                    </div>

                    <div className="mb-4 flex items-center gap-2">
                        <span className="text-xs text-[color:var(--muted)]">Duration</span>
                        <button
                            type="button"
                            onClick={() => setSelectedDuration(60)}
                            className={`rounded-full border px-3 py-1 text-xs ${selectedDuration === 60 ? 'border-indigo-500/60 bg-indigo-500/10 text-[color:var(--app-fg)]' : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--muted)]'}`}
                        >
                            {t('1hour')}
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedDuration(90)}
                            className={`rounded-full border px-3 py-1 text-xs ${selectedDuration === 90 ? 'border-indigo-500/60 bg-indigo-500/10 text-[color:var(--app-fg)]' : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--muted)]'}`}
                        >
                            {t('1h30min')}
                        </button>
                    </div>

                    {slotsError && (
                        <div className="mb-3 rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50">
                            {slotsError}
                        </div>
                    )}

                    {!slotsLoading && bookableWindows.length === 0 && (
                        <div className="rounded-2xl border border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] px-4 py-3 text-sm text-[color:var(--muted)]">
                            {t('noSlots')}
                        </div>
                    )}

                    {!slotsLoading && dayOptions.length > 0 && (
                        <div className="mb-4">
                            <div className="mb-2 text-xs text-[color:var(--muted)]">Choose a day</div>
                            <div className="flex flex-wrap gap-2">
                                {dayOptions.map((day) => {
                                    const isSelected = selectedDayKey === day.dayKey;
                                    return (
                                        <button
                                            key={day.dayKey}
                                            type="button"
                                            onClick={() => setSelectedDayKey(day.dayKey)}
                                            className={`rounded-full border px-3 py-1.5 text-xs transition ${
                                                isSelected
                                                    ? 'border-indigo-500/60 bg-indigo-500/10 text-[color:var(--app-fg)]'
                                                    : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--muted)] hover:brightness-110'
                                            }`}
                                        >
                                            {day.date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} ({day.count})
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        {visibleWindows.map((window) => {
                            const isSelected = selectedWindowKey === window.key;
                            const start = new Date(window.startIso);
                            const end = new Date(window.endIso);

                            return (
                                <button
                                    key={window.key}
                                    type="button"
                                    onClick={() => setSelectedWindowKey(window.key)}
                                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                                        isSelected
                                            ? 'border-indigo-500/60 bg-indigo-500/10 text-[color:var(--app-fg)]'
                                            : 'border-[color:var(--panel-border)] bg-[color:var(--panel-bg)] text-[color:var(--app-fg)] hover:brightness-110'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <div className="text-sm font-semibold">{start.toLocaleDateString()}</div>
                                            <div className="mt-1 text-xs text-[color:var(--muted)]">
                                                {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                        <div className={`h-5 w-5 rounded-full border flex items-center justify-center ${isSelected ? 'border-indigo-400 bg-indigo-500' : 'border-white/20'}`}>
                                            {isSelected && <span className="text-[10px] text-white">✓</span>}
                                        </div>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </GlassPanel>

                {error && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50 mb-4">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-[color:var(--muted)]">{t('total')}</p>
                        <p className="text-2xl font-semibold text-[color:var(--app-fg)]">
                                ${sessionPrice}
                        </p>
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={loading || slotsLoading || bookableWindows.length === 0}
                        className="glass-button disabled:opacity-50"
                    >
                        {loading ? t('processing') : t('proceedToPayment')}
                    </button>
        </div>
            </div>
        </div>
    );
}
