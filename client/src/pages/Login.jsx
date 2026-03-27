import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Login() {
    const [form, setForm] = useState({ email: '', password: '' });
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async () => {
        try {
            const res = await axios.post('http://localhost:5000/api/auth/login', form);
            const { token, user } = res.data;

            // Store in localStorage
            localStorage.setItem('token', token);
            localStorage.setItem('role', user.role);
            localStorage.setItem('userId', user.id);

            // Redirect based on role
            if (user.role === 'admin') {
                navigate('/admin');
            } else if (user.role === 'psychologist') {
                navigate('/psychologist/dashboard');
            } else if (user.role === 'patient') {
                navigate('/patient/dashboard');
            }else{
                navigate('/');
            }
        } catch (err) {
            setError('Invalid email or password');
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow p-8 w-full max-w-md">

                <h1 className="text-2xl font-bold text-gray-800 mb-2">Welcome back 👋</h1>
                <p className="text-gray-500 text-sm mb-6">Login to your account</p>

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

                    <button
                        className="bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition"
                        onClick={handleLogin}
                    >
                        Login
                    </button>

                    <p className="text-center text-sm text-gray-500">
                        Don't have an account?{' '}
                        <span
                            className="text-blue-600 font-semibold cursor-pointer hover:underline"
                            onClick={() => navigate('/register')}
                        >
                            Register
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
}

export default Login;