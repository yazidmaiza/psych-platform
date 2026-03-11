import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { logout } from '../services/auth';

function Dashboard() {
    const [patients, setPatients] = useState([]);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const data = await api.get('/api/dashboard/patients');
                setPatients(data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchPatients();
    }, []);

    const getStatusColor = (status) => {
        if (status === 'accepted') return 'bg-green-100 text-green-700';
        if (status === 'rejected') return 'bg-red-100 text-red-700';
        return 'bg-yellow-100 text-yellow-700';
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="bg-white shadow-sm">
                <div className="max-w-4xl mx-auto px-6 py-5">
                    <h1 className="text-3xl font-bold text-blue-700">🏥 Dashboard</h1>
                    <p className="text-gray-500 mt-1">Manage your patients and sessions</p>
                    <button
                        onClick={logout}
                        className="text-red-500 text-sm font-semibold hover:underline"
                    >
                        Logout
                    </button>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-8">
                <h2 className="text-xl font-bold text-gray-700 mb-4">Your Patients</h2>

                {patients.length === 0 && (
                    <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
                        No patients yet.
                    </div>
                )}

                <div className="grid gap-4">
                    {patients.map(request => (
                        <div
                            key={request._id}
                            className="bg-white rounded-2xl shadow p-6 flex justify-between items-center hover:shadow-md transition"
                        >
                            <div>
                                <p className="text-gray-800 font-semibold">Patient ID: {request.patientId}</p>
                                <p className="text-gray-500 text-sm mt-1">
                                    📅 Requested: {new Date(request.createdAt).toLocaleDateString()}
                                </p>
                                <span className={`text-xs font-semibold px-3 py-1 rounded-full mt-2 inline-block ${getStatusColor(request.status)}`}>
                                    {request.status}
                                </span>
                            </div>
                            <div className="flex flex-col gap-2">
                                <button
                                    className="bg-blue-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition"
                                    onClick={() => navigate(`/patient/${request.patientId?.toString()}`)}
                                >
                                    💬 Session & Notes
                                </button>
                                <button
                                    className="bg-purple-600 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition"
                                    onClick={() => navigate(`/history/${request.patientId}`)}
                                >
                                    📋 Patient History
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Dashboard;