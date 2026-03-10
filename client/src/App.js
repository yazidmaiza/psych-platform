import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './pages/Login';
import Register from './pages/Register';
import PsychologistList from './pages/PsychologistList';
import PsychologistProfile from './pages/PsychologistProfile';
import Conversation from './pages/Conversation';
import Dashboard from './pages/Dashboard';
import PatientDetail from './pages/PatientDetail';
import PatientHistory from './pages/PatientHistory';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Patient routes */}
        <Route path="/" element={
          <ProtectedRoute role="patient">
            <PsychologistList />
          </ProtectedRoute>
        } />
        <Route path="/psychologist/:id" element={
          <ProtectedRoute role="patient">
            <PsychologistProfile />
          </ProtectedRoute>
        } />
        <Route path="/conversation/:otherUserId" element={
          <ProtectedRoute>
            <Conversation />
          </ProtectedRoute>
        } />
        <Route path="/history/:patientId" element={
          <ProtectedRoute>
            <PatientHistory />
          </ProtectedRoute>
        } />

        {/* Psychologist routes */}
        <Route path="/dashboard" element={
          <ProtectedRoute role="psychologist">
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/patient/:patientId" element={
          <ProtectedRoute role="psychologist">
            <PatientDetail />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;