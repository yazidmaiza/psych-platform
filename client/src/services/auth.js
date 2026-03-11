// Get current logged in user info from localStorage
export const getUser = () => ({
    userId: localStorage.getItem('userId'),
    role: localStorage.getItem('role'),
    token: localStorage.getItem('token'),
});

// Check if user is logged in
export const isLoggedIn = () => !!localStorage.getItem('token');

// Logout
export const logout = () => {
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