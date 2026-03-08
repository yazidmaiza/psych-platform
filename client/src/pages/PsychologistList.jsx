import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

function PsychologistList() {
    const [psychologists, setPsychologists] = useState([]);
    const [filters, setFilters] = useState({ city: '', language: '', specialization: '' });
    const navigate = useNavigate();

    const fetchPsychologists = async () => {
        try {
            const params = {};
            if (filters.city) params.city = filters.city;
            if (filters.language) params.language = filters.language;
            if (filters.specialization) params.specialization = filters.specialization;

            const res = await axios.get('http://localhost:5000/api/psychologists', { params });
            setPsychologists(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        fetchPsychologists();
    }, []);

    return (
        <div style={{ padding: '20px' }}>
            <h1>Find a Psychologist</h1>

            {/* Filters */}
            <div style={{ marginBottom: '20px' }}>
                <input
                    placeholder="City"
                    value={filters.city}
                    onChange={e => setFilters({ ...filters, city: e.target.value })}
                />
                <input
                    placeholder="Language"
                    value={filters.language}
                    onChange={e => setFilters({ ...filters, language: e.target.value })}
                />
                <input
                    placeholder="Specialization"
                    value={filters.specialization}
                    onChange={e => setFilters({ ...filters, specialization: e.target.value })}
                />
                <button onClick={fetchPsychologists}>Search</button>
            </div>

            {/* List */}
            {psychologists.map(psy => (
                <div key={psy._id} style={{ border: '1px solid #ccc', padding: '15px', marginBottom: '10px' }}>
                    <h2>{psy.firstName} {psy.lastName}</h2>
                    <p>📍 {psy.city}</p>
                    <p>🗣 {psy.languages.join(', ')}</p>
                    <p>🧠 {psy.specializations.join(', ')}</p>
                    <p>💰 {psy.sessionPrice} TND</p>
                    <button onClick={() => navigate(`/psychologist/${psy._id}`)}>
                        View Profile
                    </button>
                </div>
            ))}
        </div>
    );
}

export default PsychologistList;