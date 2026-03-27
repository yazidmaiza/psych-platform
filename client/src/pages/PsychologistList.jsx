import React, { useState, useEffect } from 'react';
import { logout } from '../services/auth';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const StarRating = ({ rating, total }) => {
    const stars = [1, 2, 3, 4, 5];
    return (
        <div className="flex items-center gap-1 mt-1">
            {stars.map(star => (
                <span
                    key={star}
                    className={`text-sm ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
                >
                    ★
                </span>
            ))}
            <span className="text-xs text-gray-500 ml-1">
                {rating > 0 ? `${rating.toFixed(1)} (${total} reviews)` : 'No ratings yet'}
            </span>
        </div>
    );
};

function PsychologistList() {
    const [psychologists, setPsychologists] = useState([]);
    const [filters, setFilters] = useState({ city: '', language: '', specialization: '' });
    const navigate = useNavigate();

    const fetchPsychologists = async () => {
        try {
            let url = '/api/psychologists?';
            if (filters.city) url += `city=${filters.city}&`;
            if (filters.language) url += `language=${filters.language}&`;
            if (filters.specialization) url += `specialization=${filters.specialization}&`;

            const data = await api.get(url);
            setPsychologists(data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchPsychologists();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5">
                    <h1 className="text-3xl font-bold text-blue-700">📋 Patient Dashboard</h1>
                    <p className="text-gray-500 mt-1">Manage your sessions and find psychologists</p>
                    <div className="flex gap-4 mt-2">
                        <button
                            onClick={() => navigate('/')}
                            className="text-blue-600 text-sm font-semibold hover:underline"
                        >
                            ← Back to Home
                        </button>
                        <button
                            onClick={() => navigate('/my-sessions')}
                            className="text-blue-600 text-sm font-semibold hover:underline"
                        >
                            📋 My Sessions
                        </button>
                        <button
                            onClick={logout}
                            className="text-red-500 text-sm font-semibold hover:underline"
                        >
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Filters */}
                <div className="bg-white rounded-2xl shadow p-5 mb-8 flex flex-wrap gap-3">
                    <input
                        className="flex-1 min-w-[150px] border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="🏙 City"
                        value={filters.city}
                        onChange={e => setFilters({ ...filters, city: e.target.value })}
                    />
                    <input
                        className="flex-1 min-w-[150px] border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="🗣 Language"
                        value={filters.language}
                        onChange={e => setFilters({ ...filters, language: e.target.value })}
                    />
                    <input
                        className="flex-1 min-w-[150px] border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                        placeholder="🧠 Specialization"
                        value={filters.specialization}
                        onChange={e => setFilters({ ...filters, specialization: e.target.value })}
                    />
                    <button
                        className="bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                        onClick={fetchPsychologists}
                    >
                        Search
                    </button>
                </div>

                {/* List */}
                {psychologists.length === 0 && (
                    <p className="text-center text-gray-400 mt-20 text-lg">No psychologists found.</p>
                )}

                <div className="grid gap-5">
                    {psychologists.map(psy => (
                        <div key={psy._id} className="bg-white rounded-2xl shadow p-6 flex justify-between items-center hover:shadow-md transition">
                            <div>
                                <h2 className="text-xl font-bold text-gray-800">
                                    {psy.firstName} {psy.lastName}
                                </h2>
                                <p className="text-gray-500 text-sm mt-1">📍 {psy.city}</p>

                                <StarRating
                                    rating={psy.averageRating || 0}
                                    total={psy.totalRatings || 0}
                                />

                                <p className="text-gray-500 text-sm">
                                    🗣 {psy.languages?.join(', ')}
                                </p>
                                <p className="text-gray-500 text-sm">
                                    🧠 {psy.specializations?.join(', ')}
                                </p>

                                <div className="mt-2">
                                    <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full">
                                        💰 {psy.sessionPrice} TND
                                    </span>
                                </div>
                            </div>

                            <button
                                className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                                onClick={() => navigate(`/psychologist/${psy._id}`)}
                            >
                                View Profile →
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default PsychologistList;