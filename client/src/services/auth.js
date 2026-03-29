// Get current logged in user info from localStorage
export const getUser = () => ({
    userId: localStorage.getItem('userId'),
    role: localStorage.getItem('role'),
    token: localStorage.getItem('token'),
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

    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    window.location.href = '/login';
};

// Axios auth header
export const authHeader = () => ({
    headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
    }
});
