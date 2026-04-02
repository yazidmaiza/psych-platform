import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

import HomePage from './pages/HomePage';
import PublicPsychologistProfile from './pages/PublicPsychologistProfile';
import Login from './pages/Login';
import Register from './pages/Register';
import AssistantBot from './components/AssistantBot';
// Patient pages
import PsychologistList from './pages/PsychologistList';
import PsychologistProfile from './pages/PsychologistProfile';
import CreateSession from './pages/CreateSession';
import PaymentConfirm from './pages/PaymentConfirm';
import VerifyCode from './pages/VerifyCode';
import Chatbot from './pages/Chatbot';
import SessionPage from './pages/SessionPage';
import RateConsultation from './pages/RateConsultation';
import MySessionHistory from './pages/MySessionHistory';
import Notifications from './pages/Notifications';

// Shared pages
import Conversation from './pages/Conversation';
import Statistics from './pages/Statistics';

// Psychologist pages
import Dashboard from './pages/Dashboard';
import EditProfile from './pages/EditProfile';
import PsychologistSetup from './pages/PsychologistSetup';
import PatientDetail from './pages/PatientDetail';
import PatientHistory from './pages/PatientHistory';
import CalendarPage from './pages/Calendar';

// Admin
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<HomePage />} />
        <Route path="/p/psychologist/:id" element={<PublicPsychologistProfile />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Patient routes */}
        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute role="patient">
              <PsychologistList />
            </ProtectedRoute>
          }
        />
        <Route
          path="/psychologist/:id"
          element={
            <ProtectedRoute role="patient">
              <PsychologistProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/create/:psychologistId"
          element={
            <ProtectedRoute role="patient">
              <CreateSession />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment/:sessionId"
          element={
            <ProtectedRoute role="patient">
              <PaymentConfirm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/verify/:sessionId"
          element={
            <ProtectedRoute role="patient">
              <VerifyCode />
            </ProtectedRoute>
          }
        />
        <Route
          path="/chatbot/:sessionId"
          element={
            <ProtectedRoute role="patient">
              <Chatbot />
            </ProtectedRoute>
          }
        />
        <Route
          path="/session/:sessionId"
          element={
            <ProtectedRoute role="patient">
              <SessionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-sessions"
          element={
            <ProtectedRoute role="patient">
              <MySessionHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute role="patient">
              <MySessionHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/rate/:psychologistId"
          element={
            <ProtectedRoute role="patient">
              <RateConsultation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />

        {/* Shared routes */}
        <Route
          path="/conversation/:otherUserId"
          element={
            <ProtectedRoute>
              <Conversation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/statistics"
          element={
            <ProtectedRoute>
              <Statistics />
            </ProtectedRoute>
          }
        />

        {/* Psychologist routes */}
        <Route
          path="/setup"
          element={
            <ProtectedRoute role="psychologist">
              <PsychologistSetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <ProtectedRoute role="psychologist">
              <EditProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/psychologist/dashboard"
          element={
            <ProtectedRoute role="psychologist">
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/patient/:patientId"
          element={
            <ProtectedRoute role="psychologist">
              <PatientDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/history/:patientId"
          element={
            <ProtectedRoute role="psychologist">
              <PatientHistory />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendar/:psychologistId"
          element={
            <ProtectedRoute>
              <CalendarPage />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute role="admin">
              <AdminPanel />
            </ProtectedRoute>
          }
        />
      </Routes>
      <AssistantBot />
    </BrowserRouter>
  );
}

export default App;

