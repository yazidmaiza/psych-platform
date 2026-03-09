import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
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
        <Route path="/conversation/:userId/:otherUserId" element={<Conversation />} />
        <Route path="/" element={<PsychologistList />} />
        <Route path="/psychologist/:id" element={<PsychologistProfile />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/patient/:psychologistId/:patientId" element={<PatientDetail />} />
        <Route path="/history/:patientId" element={<PatientHistory />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;