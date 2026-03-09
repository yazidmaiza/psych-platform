import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function PsychologistProfile() {
    const [psy, setPsy] = useState(null);
    const { id } = useParams();
    const navigate = useNavigate();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/psychologists/${id}`);
                setPsy(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchProfile();
    }, [id]);

    const handleRequestSession = async () => {
        try {
            await axios.post(`http://localhost:5000/api/psychologists/${id}/request-session`, {
                patientId: '507f1f77bcf86cd799439011'
            });
            alert('Session request sent successfully! ✅');
        } catch (err) {
            alert('Something went wrong ❌');
        }
    };

    if (!psy) return (
        <div className="min-h-screen flex items-center justify-center text-gray-400 text-lg">
            Loading...
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
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
                {/* Profile Card */}
                <div className="bg-white rounded-2xl shadow p-8 mb-6">
                    <div className="flex items-center gap-6 mb-6">
                        <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600">
                            {psy.firstName[0]}{psy.lastName[0]}
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800">{psy.firstName} {psy.lastName}</h1>
                            <p className="text-gray-500 text-sm mt-1">📍 {psy.city}</p>
                        </div>
                    </div>

                    <p className="text-gray-600 mb-6">{psy.bio}</p>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Languages</p>
                            <p className="text-gray-700 text-sm">{psy.languages.join(', ')}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Specializations</p>
                            <p className="text-gray-700 text-sm">{psy.specializations.join(', ')}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Availability</p>
                            <p className="text-gray-700 text-sm">{psy.availability.join(', ')}</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4">
                            <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Session Price</p>
                            <p className="text-gray-700 text-sm font-bold">{psy.sessionPrice} TND</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4">
                    <button
                        className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition"
                        onClick={handleRequestSession}
                    >
                        📅 Request a Session
                    </button>
                    <button
                        className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                        onClick={() => navigate(`/conversation/507f1f77bcf86cd799439011/${id}`)}
                    >
                        💬 Send a Message
                    </button>
                </div>
            </div>
        </div>
    );
}

export default PsychologistProfile;