import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '../services/api';
import GlassPanel from '../components/dashboard/GlassPanel';

const RATING_QUESTIONS = [
    { id: 1, text: 'punctualityAndProfessionalism' },
    { id: 2, text: 'attentiveness' },
    { id: 3, text: 'safetyAndComfort' },
    { id: 4, text: 'clearExplanations' },
    { id: 5, text: 'empathyAndUnderstanding' },
    { id: 6, text: 'productivityOfSession' },
    { id: 7, text: 'wouldRecommend' },
    { id: 8, text: 'boundaryRespect' },
    { id: 9, text: 'overallSatisfaction' },
    { id: 10, text: 'wouldBookAgain' },
];


export default function RateConsultation() {
    const { psychologistId } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [ratings, setRatings] = useState({});
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);
    const [psy, setPsy] = useState(null);
    const [psyLoading, setPsyLoading] = useState(true);
    const [psyError, setPsyError] = useState('');

    useEffect(() => {
        let mounted = true;
        const fetchPsy = async () => {
            if (!psychologistId) {
                if (mounted) {
                    setPsy(null);
                    setPsyLoading(false);
                    setPsyError('');
                }
                return;
            }

            if (mounted) {
                setPsyLoading(true);
                setPsyError('');
            }

            try {
                const data = await api.get('/api/psychologists/' + psychologistId);
                if (mounted) setPsy(data || null);
            } catch (e) {
                try {
                    const byUser = await api.get('/api/psychologists/by-user/' + psychologistId);
                    if (mounted) setPsy(byUser || null);
                } catch (fallbackError) {
                    if (mounted) {
                        setPsy(null);
                        setPsyError('Unable to load psychologist details.');
                    }
                }
            } finally {
                if (mounted) setPsyLoading(false);
            }
        };

        fetchPsy();
        return () => {
            mounted = false;
        };
    }, [psychologistId]);

    const handleRate = (questionId, value) => {
        setRatings((prev) => ({ ...prev, [questionId]: value }));
    };

    const allRated = RATING_QUESTIONS.every((q) => ratings[q.id] !== undefined);
    const averageRating = allRated
        ? (Object.values(ratings).reduce((a, b) => a + b, 0) / RATING_QUESTIONS.length).toFixed(1)
        : '0.0';

    const handleSubmit = async () => {
        if (!allRated) return;
        setLoading(true);
        try {
            await api.post('/api/ratings', {
                psychologistId,
                answers: ratings,
                comment,
            });
            setSubmitted(true);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const displayName = [psy?.firstName, psy?.lastName].filter(Boolean).join(' ').trim();
    const initials = displayName ? displayName[0] : 'P';

    if (submitted) {
        return (
            <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)] flex items-center justify-center p-6">
                <GlassPanel className="w-full max-w-md p-8 text-center">
                    <div className="text-5xl mb-4">🎉</div>
                    <h2 className="text-2xl font-semibold text-white mb-2">{t('thankYou')}</h2>
                    <p className="text-white/60 mb-6">{t('ratingSubmitted')}</p>
                    <div className="text-4xl font-bold text-fuchsia-400 mb-2">{averageRating}</div>
                    <p className="text-sm text-white/40 mb-6">{t('averageRating')}</p>
                    <button onClick={() => navigate('/patient/sessions')} className="glass-button w-full">
                        {t('backToSessions')}
                    </button>
                </GlassPanel>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--app-bg)] text-[var(--app-fg)]">
            <div className="pointer-events-none fixed inset-0">
                <div className="absolute -top-24 left-1/2 h-72 w-[540px] -translate-x-1/2 rounded-full bg-indigo-500/20 blur-3xl" />
                <div className="absolute -bottom-24 right-[-120px] h-80 w-80 rounded-full bg-fuchsia-500/15 blur-3xl" />
            </div>

            <div className="relative mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
                <div className="flex items-center gap-4 mb-8">
                    <div className="h-16 w-16 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
                        {!psyLoading && psy?.photo ? (
                            <img src={psy.photo} alt={displayName || 'Psychologist'} className="h-full w-full object-cover" />
                        ) : (
                            <div className="text-white/50">{psyLoading ? '...' : initials}</div>
                        )}
                    </div>
                    <div>
                        <h1 className="text-xl font-semibold text-white">{t('rateYourSession')}</h1>
                        <p className="text-sm text-white/60">
                            {psyLoading ? t('loading') : displayName || t('psychologist')}
                        </p>
                        {psyError && <p className="mt-1 text-xs text-rose-300">{psyError}</p>}
                    </div>
                </div>

                <GlassPanel className="p-5 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-white/60">{t('overallScore')}</p>
                            <p className="text-3xl font-semibold text-white mt-1">{averageRating}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-white/60">{t('questionsAnswered')}</p>
                            <p className="text-lg font-semibold text-white mt-1">
                                {Object.keys(ratings).length} / {RATING_QUESTIONS.length}
                            </p>
                        </div>
                    </div>
                </GlassPanel>

                <div className="space-y-4">
                    {RATING_QUESTIONS.map((q, index) => (
                        <GlassPanel key={q.id} className="p-5">
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    <span className="text-xs text-white/40 font-semibold">{index + 1}</span>
                                    <p className="text-sm text-white mt-1">{t(q.text)}</p>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                            key={star}
                                            onClick={() => handleRate(q.id, star)}
                                            className={`h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold transition ${
                                                (ratings[q.id] || 0) >= star
                                                    ? 'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/30'
                                                    : 'bg-white/5 text-white/30 border border-white/10 hover:bg-white/10'
                                            }`}
                                        >
                                            {star}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </GlassPanel>
                    ))}
                </div>

                <GlassPanel className="p-5 mt-4">
                    <label className="form-label">{t('additionalComments')}</label>
                    <textarea
                        className="glass-input w-full min-h-[120px] resize-none"
                        placeholder={t('commentPlaceholder')}
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                    />
                </GlassPanel>

                <div className="mt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={!allRated || loading}
                        className="glass-button w-full disabled:opacity-50"
                    >
                        {loading ? t('submitting') : t('submitRating')}
                    </button>
                    {!allRated && <p className="text-center text-xs text-white/40 mt-3">{t('pleaseRateAll')}</p>}
                </div>
            </div>
        </div>
    );
}
