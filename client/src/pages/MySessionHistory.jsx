import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SESSION_TYPE_LABELS = {
  preparation: '🧠 First Consultation Preparation',
  followup: '🔄 Follow-up Session',
  free: '💬 Free Expression'
};

const STATUS_COLORS = {
  pending: 'bg-gray-100 text-gray-600',
  paid: 'bg-yellow-100 text-yellow-700',
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700'
};

export default function MySessionHistory() {
  const navigate = useNavigate();
  const userId = localStorage.getItem('userId');
  const [sessions, setSessions] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const sessionData = await api.get('/api/sessions/patient/' + userId);
        setSessions(sessionData);

        const summaryMap = {};
        await Promise.all(
          sessionData
            .filter(s => s.status === 'completed')
            .map(async s => {
              try {
                const summary = await api.get('/api/chatbot/' + s._id + '/summary');
                summaryMap[s._id] = summary;
              } catch {}
            })
        );
        setSummaries(summaryMap);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [userId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-blue-600 text-sm font-semibold hover:underline">
            ← Back
          </button>
          <h1 className="text-xl font-bold text-blue-700">📋 My Sessions</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">
        {sessions.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
            😶 No sessions yet. Book your first session to get started.
          </div>
        )}

        {sessions.map(session => {
          const summary = summaries[session._id];
          return (
            <div key={session._id} className="bg-white rounded-2xl shadow p-6">
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-bold text-gray-800">
                  {SESSION_TYPE_LABELS[session.sessionType] || session.sessionType}
                </span>
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATUS_COLORS[session.status]}`}>
                    {session.status}
                  </span>
                  <span className="text-xs text-gray-400">
                    📅 {new Date(session.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>

              {/* Action buttons based on status */}
              {session.status === 'pending' && (
                <button
                  onClick={() => navigate('/payment/' + session._id)}
                  className="w-full bg-green-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-green-600 transition mb-4"
                >
                  💳 Complete Payment →
                </button>
              )}

              {session.status === 'paid' && (
                <button
                  onClick={() => navigate('/verify/' + session._id)}
                  className="w-full bg-yellow-500 text-white py-2 rounded-xl text-sm font-semibold hover:bg-yellow-600 transition mb-4"
                >
                  🔐 Enter Access Code →
                </button>
              )}

              {session.status === 'active' && (
                <button
                  onClick={() => navigate('/session/' + session._id)}
                  className="w-full bg-blue-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-blue-700 transition mb-4"
                >
                  🔄 Continue Session →
                </button>
              )}

              {/* Summary for completed sessions */}
              {session.status === 'completed' && summary && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Emotion</p>
                      <p className="text-gray-800 font-bold capitalize text-sm">{summary.emotionalIndicators?.dominantEmotion}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Urgency</p>
                      <p className="text-gray-800 font-bold text-sm">{summary.emotionalIndicators?.urgencyScore} / 5</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-3 text-center">
                      <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Trend</p>
                      <p className="text-gray-800 font-bold capitalize text-sm">{summary.emotionalIndicators?.sentimentTrend}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Key Themes</p>
                    <div className="flex flex-wrap gap-2">
                      {summary.keyThemes?.map((theme, i) => (
                        <span key={i} className="bg-blue-100 text-blue-700 text-xs px-3 py-1 rounded-full font-semibold">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>

                  <p className="text-sm text-gray-700 leading-relaxed">{summary.rawSummary}</p>

                  {!session.isRated && (
                    <button
                      onClick={() => navigate('/rate/' + session.psychologistId)}
                      className="w-full bg-purple-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition"
                    >
                      ⭐ Rate Your Psychologist
                    </button>
                  )}
                </div>
              )}

              {session.status === 'completed' && !summary && (
                <p className="text-sm text-gray-400 text-center py-4">No AI summary available.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}