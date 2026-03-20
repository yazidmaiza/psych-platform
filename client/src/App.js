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
import AdminPanel from './pages/AdminPanel';
import CreateSession from './pages/CreateSession';
import PaymentConfirm from './pages/PaymentConfirm';
import Chatbot from './pages/Chatbot';
import VerifyCode from './pages/VerifyCode';
import EditProfile from './pages/EditProfile';
import PsychologistSetup from './pages/PsychologistSetup';
import Statistics from './pages/Statistics';
import RateConsultation from './pages/RateConsultation';
import CalendarPage from './pages/Calendar';

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
        <Route path="/rate/:psychologistId" element={
          <ProtectedRoute role="patient">
            <RateConsultation />
          </ProtectedRoute>
        } />
        <Route path="/psychologist/:id" element={
          <ProtectedRoute role="patient">
            <PsychologistProfile />
          </ProtectedRoute>
        } />
        <Route path="/session/create/:psychologistId" element={
          <ProtectedRoute role="patient">
            <CreateSession />
          </ProtectedRoute>
        } />

        <Route path="/payment/:sessionId" element={
          <ProtectedRoute role="patient">
            <PaymentConfirm />
          </ProtectedRoute>
        } />
        <Route path="/verify/:sessionId" element={
          <ProtectedRoute role="patient">
            <VerifyCode />
          </ProtectedRoute>
        } />
        <Route path="/chatbot/:sessionId" element={
          <ProtectedRoute role="patient">
            <Chatbot />
          </ProtectedRoute>
        } />

        {/* Shared routes */}
        <Route path="/conversation/:otherUserId" element={
          <ProtectedRoute>
            <Conversation />
          </ProtectedRoute>
        } />
        <Route path="/statistics" element={
          <ProtectedRoute>
            <Statistics />
          </ProtectedRoute>
        } />

        {/* Psychologist routes */}
        <Route path="/setup" element={
          <ProtectedRoute role="psychologist">
            <PsychologistSetup />
          </ProtectedRoute>
        } />

        <Route path="/profile/edit" element={
          <ProtectedRoute role="psychologist">
            <EditProfile />
          </ProtectedRoute>
        } />
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
        <Route path="/history/:patientId" element={
          <ProtectedRoute role="psychologist">
            <PatientHistory />
          </ProtectedRoute>
        } />
        <Route path="/calendar" element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        } />
        <Route path="/calendar/:psychologistId" element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        } />
        {/* Admin routes */}
        <Route path="/admin" element={
          <ProtectedRoute role="admin">
            <AdminPanel />
          </ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}

export default App;