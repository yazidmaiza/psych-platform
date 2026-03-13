import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Register() {
    const [form, setForm] = useState({ email: '', password: '', role: 'patient' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleRegister = async () => {
        try {
            const res = await axios.post('http://localhost:5000/api/auth/register', form);
            localStorage.setItem('token', res.data.token);
            localStorage.setItem('role', res.data.user.role);
            localStorage.setItem('userId', res.data.user.id);

            if (form.role === 'psychologist') {
                navigate('/setup');
            } else {
                navigate('/');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Registration failed');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">

                <h1 className="text-2xl font-bold text-gray-800 mb-2">Create an account 🧠</h1>
                <p className="text-gray-500 text-sm mb-6">Join the platform today</p>

                {error && (
                    <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl mb-4">
                        {error}
                    </div>
                )}

                <div className="flex flex-col gap-4">
                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">Email</label>
                        <input
                            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="your@email.com"
                            value={form.email}
                            onChange={e => setForm({ ...form, email: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">Password</label>
                        <input
                            type="password"
                            className="w-full border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                            placeholder="••••••••"
                            value={form.password}
                            onChange={e => setForm({ ...form, password: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="text-sm font-semibold text-gray-600 mb-1 block">I am a</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                className={`py-3 rounded-xl text-sm font-semibold border-2 transition ${form.role === 'patient'
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 text-gray-500 hover:border-blue-300'
                                    }`}
                                onClick={() => setForm({ ...form, role: 'patient' })}
                            >
                                🙋 Patient
                            </button>
                            <button
                                className={`py-3 rounded-xl text-sm font-semibold border-2 transition ${form.role === 'psychologist'
                                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                                    : 'border-gray-200 text-gray-500 hover:border-blue-300'
                                    }`}
                                onClick={() => setForm({ ...form, role: 'psychologist' })}
                            >
                                🧑‍⚕️ Psychologist
                            </button>
                        </div>
                    </div>

                    <button
                        className="bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                        onClick={handleRegister}
                    >
                        Create Account
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        Already have an account?{' '}
                        <span
                            className="text-blue-600 font-semibold cursor-pointer hover:underline"
                            onClick={() => navigate('/login')}
                        >
                            Login
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Register;