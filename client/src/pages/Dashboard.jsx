import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function Dashboard() {
    const [patients, setPatients] = useState([]);

    // Temporary fake psychologist ID until auth is ready
    const psychologistId = '69ada9db3fbea70230edbf57';
    const navigate = useNavigate();

    useEffect(() => {
        const fetchPatients = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/dashboard/patients/${psychologistId}`);
                setPatients(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchPatients();
    }, []);

    return (
        <div style={{ padding: '20px' }}>
            <h1>🏥 Psychologist Dashboard</h1>
            <h2>Your Patients</h2>

            {patients.length === 0 && (
                <p style={{ color: '#999' }}>No patients yet.</p>
            )}

            {patients.map(request => (
                <div key={request._id} style={{
                    border: '1px solid #ccc',
                    borderRadius: '8px',
                    padding: '15px',
                    marginBottom: '10px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <p><strong>Patient ID:</strong> {request.patientId}</p>
                        <p><strong>Status:</strong> {request.status}</p>
                        <p><strong>Requested at:</strong> {new Date(request.createdAt).toLocaleDateString()}</p>
                    </div>
                    <button
                        style={{ padding: '10px 20px', background: '#007bff', color: 'white', borderRadius: '8px', border: 'none' }}
                        onClick={() => navigate(`/patient/${psychologistId}/${request.patientId}`)}
                    >
                        View Details
                    </button>
                </div>
            ))}
        </div>
    );
}

export default Dashboard;