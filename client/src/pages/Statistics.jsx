import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function Statistics() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await api.get('/api/admin/stats');
                setStats(data);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center text-gray-400 text-lg">
            Loading statistics...
        </div>
    );

    const completionRate = stats?.totalSessions > 0
        ? Math.round((stats.completedSessions / stats.totalSessions) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="text-blue-600 text-sm font-semibold hover:underline"
                    >
                        ←
                    </button>
                    <h1 className="text-3xl font-bold text-blue-700">📊 Platform Statistics</h1>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <p className="text-gray-500 mb-8">Anonymous platform-wide statistics. No personal data is shown.</p>

                {/* Main stats cards */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-white rounded-2xl shadow p-6 text-center">
                        <p className="text-4xl font-bold text-blue-600">{stats?.totalUsers || 0}</p>
                        <p className="text-gray-500 text-sm mt-2 font-semibold">👥 Total Users</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-6 text-center">
                        <p className="text-4xl font-bold text-green-600">{stats?.totalSessions || 0}</p>
                        <p className="text-gray-500 text-sm mt-2 font-semibold">🗓️ Total Sessions</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-6 text-center">
                        <p className="text-4xl font-bold text-purple-600">{stats?.totalPatients || 0}</p>
                        <p className="text-gray-500 text-sm mt-2 font-semibold">🧑‍⚕️ Total Patients</p>
                    </div>
                    <div className="bg-white rounded-2xl shadow p-6 text-center">
                        <p className="text-4xl font-bold text-yellow-500">{stats?.totalPsychologists || 0}</p>
                        <p className="text-gray-500 text-sm mt-2 font-semibold">👨‍⚕️ Total Psychologists</p>
                    </div>
                </div>

                {/* Session breakdown */}
                <div className="bg-white rounded-2xl shadow p-6 mb-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">🗓️ Session Breakdown</h2>
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        <div className="bg-yellow-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-yellow-600">
                                {(stats?.totalSessions || 0) - (stats?.activeSessions || 0) - (stats?.completedSessions || 0)}
                            </p>
                            <p className="text-xs text-gray-500 mt-1 font-semibold">⏳ Pending</p>
                        </div>
                        <div className="bg-blue-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-blue-600">{stats?.activeSessions || 0}</p>
                            <p className="text-xs text-gray-500 mt-1 font-semibold">⚡ Active</p>
                        </div>
                        <div className="bg-green-50 rounded-xl p-4 text-center">
                            <p className="text-2xl font-bold text-green-600">{stats?.completedSessions || 0}</p>
                            <p className="text-xs text-gray-500 mt-1 font-semibold">✅ Completed</p>
                        </div>
                    </div>

                    {/* Completion rate bar */}
                    <div>
                        <div className="flex justify-between text-sm mb-2">
                            <span className="font-semibold text-gray-700">Session Completion Rate</span>
                            <span className="text-gray-500">{completionRate}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-4">
                            <div
                                className="bg-green-500 h-4 rounded-full transition-all"
                                style={{ width: `${completionRate}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* User distribution */}
                <div className="bg-white rounded-2xl shadow p-6">
                    <h2 className="text-lg font-bold text-gray-700 mb-4">👥 User Distribution</h2>
                    <div className="flex flex-col gap-4">
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-semibold text-gray-700">🧑‍⚕️ Patients</span>
                                <span className="text-gray-500">
                                    {stats?.totalUsers > 0 ? Math.round((stats.totalPatients / stats.totalUsers) * 100) : 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div
                                    className="bg-purple-500 h-3 rounded-full transition-all"
                                    style={{ width: `${stats?.totalUsers > 0 ? (stats.totalPatients / stats.totalUsers) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        <div>
                            <div className="flex justify-between text-sm mb-2">
                                <span className="font-semibold text-gray-700">👨‍⚕️ Psychologists</span>
                                <span className="text-gray-500">
                                    {stats?.totalUsers > 0 ? Math.round((stats.totalPsychologists / stats.totalUsers) * 100) : 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-100 rounded-full h-3">
                                <div
                                    className="bg-yellow-500 h-3 rounded-full transition-all"
                                    style={{ width: `${stats?.totalUsers > 0 ? (stats.totalPsychologists / stats.totalUsers) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Statistics;