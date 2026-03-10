import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PsychologistList from './pages/PsychologistList';
import PsychologistProfile from './pages/PsychologistProfile';
import Conversation from './pages/Conversation';
import Dashboard from './pages/Dashboard';
import PatientDetail from './pages/PatientDetail';
import PatientHistory from './pages/PatientHistory';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/conversation/:otherUserId" element={<Conversation />} />
        <Route path="/" element={<PsychologistList />} />
        <Route path="/psychologist/:id" element={<PsychologistProfile />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patient/:psychologistId/:patientId" element={<PatientDetail />} />
        <Route path="/history/:patientId" element={<PatientHistory />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;