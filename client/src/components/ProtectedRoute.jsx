import React from 'react';
import { Navigate } from 'react-router-dom';
import { isLoggedIn } from '../services/auth';

function ProtectedRoute({ children, role, allowUnverified = false }) {
    if (!isLoggedIn()) {
        return <Navigate to="/login" />;
    }

    const isVerified = localStorage.getItem('isVerified');
    if (!allowUnverified && isVerified === 'false') {
        const email = localStorage.getItem('email') || '';
        return <Navigate to={email ? `/verify-email?email=${encodeURIComponent(email)}` : '/verify-email'} />;
    }

    const userRole = localStorage.getItem('role');
    if (role && userRole !== role) {
        return <Navigate to="/" />;
    }

    return children;

}
export default ProtectedRoute;
