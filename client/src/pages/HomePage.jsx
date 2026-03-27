import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

function HomePage() {
  const [psychologists, setPsychologists] = useState([]);
  const [filters, setFilters] = useState({ city: '', language: '', specialization: '' });
  const navigate = useNavigate();

  const fetchPsychologists = async () => {
    try {
      let url = '/api/psychologists?';
      if (filters.city) url += `city=${filters.city}&`;
      if (filters.language) url += `language=${filters.language}&`;
      if (filters.specialization) url += `specialization=${filters.specialization}&`;

      const data = await api.get(url);
      setPsychologists(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchPsychologists();
  }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              🧠 Psych Platform
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90">
              Professional psychological support when you need it most
            </p>
            <div className="flex gap-4 justify-center">
              <button
                onClick={() => navigate('/login')}
                className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition"
              >
                Login
              </button>
              <button
                onClick={() => navigate('/register')}
                className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-xl font-semibold hover:bg-white hover:text-blue-600 transition"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center text-gray-800 mb-12">
          Why Choose Psych Platform?
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="text-4xl mb-4">🔒</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Confidential & Secure</h3>
            <p className="text-gray-600">Your privacy is our priority. All sessions are encrypted and confidential.</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">🤖</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">AI-Powered Intake</h3>
            <p className="text-gray-600">Start with our intelligent chatbot to prepare for your consultation.</p>
          </div>
          <div className="text-center">
            <div className="text-4xl mb-4">👥</div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Certified Professionals</h3>
            <p className="text-gray-600">Work with experienced, licensed psychologists specialized in your needs.</p>
          </div>
        </div>
      </div>

      {/* Psychologists Section */}
      <div className="bg-white py-16">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center text-gray-800 mb-4">
            Meet Our Psychologists
          </h2>
          <p className="text-center text-gray-600 mb-12">
            Browse our network of certified professionals
          </p>

          {/* Filters */}
          <div className="flex flex-wrap gap-4 justify-center mb-8">
            <input
              type="text"
              placeholder="Filter by city..."
              className="border border-gray-300 rounded-lg px-4 py-2"
              value={filters.city}
              onChange={e => setFilters({ ...filters, city: e.target.value })}
            />
            <input
              type="text"
              placeholder="Filter by language..."
              className="border border-gray-300 rounded-lg px-4 py-2"
              value={filters.language}
              onChange={e => setFilters({ ...filters, language: e.target.value })}
            />
            <input
              type="text"
              placeholder="Filter by specialization..."
              className="border border-gray-300 rounded-lg px-4 py-2"
              value={filters.specialization}
              onChange={e => setFilters({ ...filters, specialization: e.target.value })}
            />
          </div>

          {/* Psychologist List */}
          {psychologists.length === 0 ? (
            <p className="text-center text-gray-400 text-lg">No psychologists found.</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {psychologists.map(psy => (
                <div key={psy._id} className="bg-gray-50 rounded-2xl p-6 hover:shadow-lg transition">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center text-2xl font-bold text-blue-600">
                      {psy.firstName?.[0]}{psy.lastName?.[0]}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-800">
                        {psy.firstName} {psy.lastName}
                      </h3>
                      <p className="text-gray-500 text-sm">📍 {psy.city || 'Location not specified'}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">⭐</span>
                      {psy.averageRating > 0 ? `${psy.averageRating.toFixed(1)} / 5` : 'No ratings yet'}
                      {psy.totalRatings > 0 && ` (${psy.totalRatings} reviews)`}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">🗣</span>
                      {Array.isArray(psy.languages) ? psy.languages.join(', ') : psy.languages || 'Not specified'}
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <span className="mr-2">🧠</span>
                      {Array.isArray(psy.specializations) ? psy.specializations.slice(0, 3).join(', ') : psy.specializations || 'Not specified'}
                      {Array.isArray(psy.specializations) && psy.specializations.length > 3 && '...'}
                    </div>
                  </div>

                  <button
                    onClick={() => navigate(`/psychologist/${psy._id}`)}
                    className="w-full bg-blue-600 text-white py-2 rounded-xl font-semibold hover:bg-blue-700 transition"
                  >
                    View Profile →
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-16">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Start Your Journey?</h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands who have found support through our platform
          </p>
          <button
            onClick={() => navigate('/register')}
            className="bg-white text-blue-600 px-8 py-3 rounded-xl font-semibold hover:bg-gray-100 transition"
          >
            Get Started Now
          </button>
        </div>
      </div>
    </div>
  );
}

export default HomePage;