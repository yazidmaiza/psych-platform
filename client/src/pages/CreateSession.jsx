import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

const SESSION_TYPES = [
    { id: 'prep', label: 'preparationSession', desc: 'preparationDesc' },
    { id: 'followup', label: 'followUpSession', desc: 'followUpDesc' },
    { id: 'crisis', label: 'crisisSession', desc: 'crisisDesc' },
];

export default function CreateSession() {
    const { psychologistId } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [selectedType, setSelectedType] = useState('followup');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [psychologist, setPsychologist] = useState(null);
    const [psyLoading, setPsyLoading] = useState(true);

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

    const selectedSession = useMemo(
        () => SESSION_TYPES.find((s) => s.id === selectedType) || SESSION_TYPES[1],
        [selectedType]
    );

    const getSessionPrice = (typeId) => {
        const base = Number(psychologist?.sessionPrice || psychologist?.hourlyRate || 120);
        if (typeId === 'prep') return 0;
        if (typeId === 'crisis') return base + 30;
        return base;
    };

    const handleCreate = async () => {
        setLoading(true);
        setError('');
        try {
            const data = await api.post('/api/sessions', {
                psychologistId,
                type: selectedType,
            });
            const sessionId = data?.sessionId || data?._id || data?.data?.sessionId || data?.data?._id;
            if (!sessionId) throw new Error(t('bookingFailed'));
            navigate('/payment/' + sessionId);
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
                                src={psychologist.photo}
                                alt={`${psychologist.firstName || ''} ${psychologist.lastName || ''}`}
                                className="h-full w-full object-cover"
                            />
                        ) : (
                            <div className="text-white/50">{psyLoading ? '...' : (psychologist?.firstName?.[0] || 'P')}</div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-white">{t('bookSessionWith')}</h1>
                        <p className="text-sm text-white/60">
                            {psyLoading
                                ? t('loading')
                                : (psychologist ? `${psychologist.firstName || ''} ${psychologist.lastName || ''}` : t('psychologist'))}
                        </p>
                        <div className="flex gap-1.5 mt-1">
                            {(psychologist?.specializations || []).slice(0, 3).map((spec) => (
                                <span key={spec} className="text-xs text-white/40">{spec}</span>
                            ))}
                        </div>
                    </div>
                </div>

                <h2 className="text-lg font-semibold text-white mb-4">{t('selectSessionType')}</h2>
                <div className="space-y-3 mb-8">
                    {SESSION_TYPES.map((type) => {
                        const price = getSessionPrice(type.id);
                        return (
                            <GlassPanel
                                key={type.id}
                                className={`p-5 cursor-pointer transition ${
                                    selectedType === type.id
                                        ? 'border-indigo-500/50 bg-indigo-500/5'
                                        : ''
                                }`}
                                onClick={() => setSelectedType(type.id)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                                            selectedType === type.id
                                                ? 'border-indigo-500 bg-indigo-500'
                                                : 'border-white/20'
                                        }`}>
                                            {selectedType === type.id && <span className="text-white text-xs">✓</span>}
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-white">{t(type.label)}</h3>
                                            <p className="text-sm text-white/60 mt-1">{t(type.desc)}</p>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-lg font-semibold text-white">
                                            {price === 0 ? t('free') : `$${price}`}
                                        </p>
                                        <p className="text-xs text-white/40">{price === 0 ? '' : t('perSession')}</p>
                                    </div>
                                </div>
                            </GlassPanel>
                        );
                    })}
                </div>

                <GlassPanel className="p-5 mb-8">
                    <h3 className="font-semibold text-white mb-2">{t('whatToExpect')}</h3>
                    <ul className="space-y-2 text-sm text-white/60">
                        <li className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            {t('expectation1')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            {t('expectation2')}
                        </li>
                        <li className="flex items-start gap-2">
                            <span className="text-indigo-400 mt-0.5">•</span>
                            {t('expectation3')}
                        </li>
                    </ul>
                </GlassPanel>

                {error && (
                    <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-50 mb-4">
                        {error}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-white/60">{t('total')}</p>
                        <p className="text-2xl font-semibold text-white">
                            {getSessionPrice(selectedSession.id) === 0 ? t('free') : `$${getSessionPrice(selectedSession.id)}`}
                        </p>
                    </div>
                    <button
                        onClick={handleCreate}
                        disabled={loading}
                        className="glass-button disabled:opacity-50"
                    >
                        {loading ? t('processing') : t('proceedToPayment')}
                    </button>
        </div>
            </div>
        </div>
    );
}
