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
console.log(localStorage.getItem('role'))
console.log(localStorage.getItem('token'))
console.log(localStorage.getItem('userId'))
export default ProtectedRoute;