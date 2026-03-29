import React from 'react';
import { Navigate } from 'react-router-dom';
import { isLoggedIn } from '../services/auth';

function ProtectedRoute({ children, role }) {
    if (!isLoggedIn()) {
        return <Navigate to="/login" />;
    }

    const userRole = localStorage.getItem('role');
    if (role && userRole !== role) {
        return <Navigate to="/" />;
    }

    return children;

}
export default ProtectedRoute;
