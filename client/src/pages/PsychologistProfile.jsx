import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';

const StarRating = ({ rating, total }) => {
  const stars = [1, 2, 3, 4, 5];
  return (
    <div className="flex items-center gap-1 mt-1">
      {stars.map(star => (
        <span
          key={star}
          className={`text-sm ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}`}
        >
          *
        </span>
      ))}
      <span className="text-xs text-gray-500 ml-1">
        {rating > 0 ? `${rating.toFixed(1)} (${total} reviews)` : 'No ratings yet'}
      </span>
    </div>
  );
};

function PsychologistProfile() {
  const [psy, setPsy] = useState(null);
  const [hasBooked, setHasBooked] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [hasOpenSession, setHasOpenSession] = useState(false);
  const [hasRated, setHasRated] = useState(false);
  const { id } = useParams();
  const navigate = useNavigate();
  const myUserId = localStorage.getItem('userId');

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await api.get(`/api/psychologists/${id}`);
        setPsy(data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchProfile();
  }, [id]);

  useEffect(() => {
    const fetchEligibility = async () => {
      if (!psy || !myUserId) return;
      const psychologistUserId = String(psy.userId?._id || psy.userId || '');

      try {
        const sessions = await api.get('/api/sessions/patient/' + myUserId);
        const relevant = (Array.isArray(sessions) ? sessions : []).filter(
          s => String(s.psychologistId) === psychologistUserId && s.status !== 'canceled'
        );
        setHasBooked(relevant.length > 0);
        setHasCompleted(relevant.some(s => s.status === 'completed'));
        setHasOpenSession(relevant.some(s => !['completed', 'canceled'].includes(s.status)));
      } catch (err) {
        console.error(err);
      }

      try {
        const ratingCheck = await api.get('/api/ratings/check/' + psy._id);
        setHasRated(!!ratingCheck?.hasRated);
      } catch {
        setHasRated(false);
      }
    };

    fetchEligibility();
  }, [psy, myUserId]);

  if (!psy) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-400 text-lg">
        Loading...
      </div>
    );
  }

  const psychologistUserId = psy.userId?._id || psy.userId;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-3xl mx-auto px-6 py-5">
          <button
            onClick={() => navigate(-1)}
            className="text-blue-600 text-sm font-semibold hover:underline"
          >
            {'<- Back'}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-white rounded-2xl shadow p-8 mb-6">
          <div className="flex items-center gap-6 mb-6">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-3xl font-bold text-blue-600">
              {psy?.firstName?.[0]}{psy?.lastName?.[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{psy.firstName} {psy.lastName}</h1>
              <p className="text-gray-500 text-sm mt-1">{psy.city || 'N/A'}</p>
              <StarRating rating={psy.averageRating || 0} total={psy.totalRatings || 0} />
            </div>
          </div>

          <p className="text-gray-600 mb-6">{psy.bio || 'No bio available.'}</p>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Languages</p>
              <p className="text-gray-700 text-sm">
                {Array.isArray(psy.languages) ? psy.languages.join(', ') : psy.languages || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Specializations</p>
              <p className="text-gray-700 text-sm">
                {Array.isArray(psy.specializations) ? psy.specializations.join(', ') : psy.specializations || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Availability</p>
              <p className="text-gray-700 text-sm">
                {Array.isArray(psy.availability) ? psy.availability.join(', ') : psy.availability || 'N/A'}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Session Price</p>
              <p className="text-gray-700 text-sm font-bold">
                {psy.sessionPrice ? `${psy.sessionPrice} TND` : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        {psy.location && psy.location.coordinates && (
          <div className="bg-white rounded-2xl shadow p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Office Location</h2>
            <div className="h-64 w-full rounded-xl overflow-hidden relative z-0 border border-gray-100">
              <MapContainer center={[psy.location.coordinates[1], psy.location.coordinates[0]]} zoom={14} className="h-full w-full">
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                <Marker position={[psy.location.coordinates[1], psy.location.coordinates[0]]}></Marker>
              </MapContainer>
            </div>
          </div>
        )}

        {!hasBooked && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-sm text-blue-700 mb-6">
            You need to book a consultation to message or rate this psychologist.
          </div>
        )}

        {hasOpenSession && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700 mb-6">
            You already have an open session with this psychologist. Finish it before booking another.
          </div>
        )}

        <div className="flex gap-4 flex-wrap">
          {!hasOpenSession && (
            <button
              className="flex-1 bg-green-500 text-white py-3 rounded-xl font-semibold hover:bg-green-600 transition min-w-[220px]"
              onClick={() => navigate(`/calendar/${psychologistUserId}`)}
            >
              Request a Session
            </button>
          )}

          <button
            className={`flex-1 py-3 rounded-xl font-semibold transition min-w-[220px] ${hasBooked ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            disabled={!hasBooked}
            onClick={() => navigate(`/conversation/${psychologistUserId}`)}
            title={!hasBooked ? 'Book a consultation first' : ''}
          >
            Send a Message
          </button>

          <button
            className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-semibold hover:bg-purple-700 transition min-w-[220px]"
            onClick={() => navigate(`/calendar/${psychologistUserId}`)}
          >
            View Availability
          </button>

          {hasBooked && hasCompleted && !hasRated && (
            <button
              className="flex-1 bg-yellow-400 text-white py-3 rounded-xl font-semibold hover:bg-yellow-500 transition min-w-[220px]"
              onClick={() => navigate(`/rate/${psy._id}`)}
            >
              Rate Psychologist
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PsychologistProfile;
