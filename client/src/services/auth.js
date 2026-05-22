import { api } from './api';

// Get current logged in user info from localStorage
const DEVICE_ID_KEY = 'deviceId';

export const getDeviceId = () => {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
        const randomPart = Math.random().toString(36).slice(2);
        deviceId = `device_${Date.now()}_${randomPart}`;
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
};

export const storeAuth = ({ accessToken, refreshToken, user }) => {
    if (accessToken) localStorage.setItem('token', accessToken);
    if (refreshToken) localStorage.setItem('refreshToken', refreshToken);
    if (user?.role) localStorage.setItem('role', user.role);
    if (user?.id) localStorage.setItem('userId', user.id);
    if (typeof user?.fullName === 'string') localStorage.setItem('userName', user.fullName);
    if (typeof user?.isVerified !== 'undefined') {
        localStorage.setItem('isVerified', String(user.isVerified));
    }
};

export const getUser = () => ({
    userId: localStorage.getItem('userId'),
    role: localStorage.getItem('role'),
    token: localStorage.getItem('token'),
    refreshToken: localStorage.getItem('refreshToken'),
    isVerified: localStorage.getItem('isVerified') === 'true'
});

// Check if user is logged in
export const isLoggedIn = () => !!localStorage.getItem('token');

// Logout
export const logout = async () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('role');

    if (token && role === 'patient') {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3500);

            await fetch('http://localhost:5000/api/chatbot/logout-summary', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({}),
                keepalive: true,
                signal: controller.signal
            });

            clearTimeout(timeout);
        } catch (err) {
            // ignore logout summary errors
        }
    }

    if (token) {
        try {
            await fetch('http://localhost:5000/api/auth/logout', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
        } catch (err) {
            // ignore logout errors
        }
    }

    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('isVerified');
    localStorage.removeItem('userName');
    window.location.href = '/login';
};

// Axios auth header
export const authHeader = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
    }
});

export const refreshSession = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (!refreshToken) return null;

    const res = await fetch('http://localhost:5000/api/auth/refresh', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            refreshToken,
            deviceId: getDeviceId()
        })
    });

    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.message || 'Refresh failed');
    }

    storeAuth({
        accessToken: data.accessToken || data.token,
        refreshToken: data.refreshToken,
        user: data.user
    });

    return data;
};

export const authService = {
    login: async (email, password) => {
        const data = await api.post('/api/auth/login', { email, password });
        storeAuth({
            accessToken: data.accessToken || data.token,
            refreshToken: data.refreshToken,
            user: data.user
        });
        if (data?.user) {
            localStorage.setItem('user', JSON.stringify(data.user));
        }
        return data;
    },

    register: async (userData) => {
        return api.post('/api/auth/register', userData);
    },

    logout,

    getCurrentUser: () => {
        try {
            return JSON.parse(localStorage.getItem('user'));
        } catch {
            return null;
        }
    },

    getRole: () => localStorage.getItem('role'),
    isAuthenticated: () => !!localStorage.getItem('token'),

    verifyEmail: async (token) => {
        return api.get(`/api/auth/verify-email?token=${encodeURIComponent(token)}`);
    },

    resendVerification: async (email) => {
        return api.post('/api/auth/resend-verification', { email });
    }
};

export default authService;
