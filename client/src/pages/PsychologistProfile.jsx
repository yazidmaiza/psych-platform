import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';

function PsychologistProfile() {
    const [psy, setPsy] = useState(null);
    const { id } = useParams();
    const navigate = useNavigate();

    const handleRequestSession = async () => {
        try {
            await axios.post(`http://localhost:5000/api/psychologists/${id}/request-session`, {
                patientId: '507f1f77bcf86cd799439011' // temporary fake ID until auth is ready
            });
            alert('Session request sent successfully! ✅');
        } catch (err) {
            alert('Something went wrong ❌');
            console.error(err);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res = await axios.get(`http://localhost:5000/api/psychologists/${id}`);
                setPsy(res.data);
            } catch (err) {
                console.error(err);
            }
        };
        fetchProfile();
    }, [id]);

    if (!psy) return <p>Loading...</p>;

    return (
        <div style={{ padding: '20px' }}>
            <button onClick={() => navigate('/')}>← Back to list</button>

            <h1>{psy.firstName} {psy.lastName}</h1>
            <p>📍 {psy.city}</p>
            <p>🗣 Languages: {psy.languages.join(', ')}</p>
            <p>🧠 Specializations: {psy.specializations.join(', ')}</p>
            <p>💰 Session price: {psy.sessionPrice} TND</p>
            <p>📅 Availability: {psy.availability.join(', ')}</p>
            <p>📝 {psy.bio}</p>

            <button
                style={{ marginTop: '20px', padding: '10px 20px', background: 'green', color: 'white' }}
                onClick={handleRequestSession}
            >
                Request a Session
            </button>
            <button
                style={{ marginTop: '10px', padding: '10px 20px', background: '#007bff', color: 'white', borderRadius: '8px', border: 'none' }}
                onClick={() => navigate(`/conversation/507f1f77bcf86cd799439011/${id}`)}
            >
                💬 Send a Message
            </button>
        </div>
    );
}

export default PsychologistProfile;