import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function PsychologistProfile() {
    const [psy, setPsy] = useState(null);
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const data = await api.get(`/api/psychologists/${id}`);
                setPsy(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchProfile();
    }, [id]);

    const handleRequestSession = () => {
        navigate(`/session/create/${psy.userId?._id || psy.userId}`);
    };

    if (!psy) return (
        <div className="min-h-screen flex items-center justify-center text-gray-400 text-lg">
            Loading...
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-3xl mx-auto px-6 py-5">
                    <button
                        onClick={() => navigate('/')}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        ← Back to list
                    </button>
                </div>
            </div>

            <div className="max-w-3xl mx-auto px-6 py-8">
                <div className="bg-white rounded-2xl shadow p-8 mb-6">
                    <div className="flex items-center gap-6 mb-6">
                        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600">
                            {psy?.firstName?.[0]}{psy?.lastName?.[0]}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{psy.firstName} {psy.lastName}</h1>
                            <p className="text-gray-500 text-sm mt-1">📍 {psy.city || 'N/A'}</p>
                            <p className="text-gray-500 text-sm mt-1">
                                ⭐ {psy.averageRating > 0 ? psy.averageRating.toFixed(1) + ' / 5' : 'No ratings yet'}
                                {psy.totalRatings > 0 && ` (${psy.totalRatings} reviews)`}
                            </p>
                        </div>
                    </div>

                    <p className="text-gray-600 mb-6">{psy.bio || 'No bio available.'}</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Languages</p>
                            <p className="text-gray-700 text-sm">
                                {Array.isArray(psy.languages) ? psy.languages.join(', ') : psy.languages || 'N/A'}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Specializations</p>
                            <p className="text-gray-700 text-sm">
                                {Array.isArray(psy.specializations) ? psy.specializations.join(', ') : psy.specializations || 'N/A'}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Availability</p>
                            <p className="text-gray-700 text-sm">
                                {Array.isArray(psy.availability) ? psy.availability.join(', ') : psy.availability || 'N/A'}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Session Price</p>
                            <p className="text-gray-700 text-sm font-bold">
                                {psy.sessionPrice ? `${psy.sessionPrice} TND` : 'N/A'}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex gap-4">
                    <button
                        className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition"
                        onClick={handleRequestSession}
                    >
                        📅 Request a Session
                    </button>
                    <button
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                        onClick={() => navigate(`/conversation/${psy.userId?._id || psy.userId}`)}
                    >
                        💬 Send a Message
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PsychologistProfile;