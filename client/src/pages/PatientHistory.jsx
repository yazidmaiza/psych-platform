import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../services/api';

const SESSION_TYPE_LABELS = {
  preparation: 'First consultation preparation',
  followup: 'Follow-up session',
  free: 'Free expression'
};

const emotionLabel = (emotion) => {
  if (emotion === 'anxiety') return 'Anxiety';
  if (emotion === 'sadness') return 'Sadness';
  if (emotion === 'anger') return 'Anger';
  if (emotion === 'positivity') return 'Positivity';
  return emotion;
};

export default function PatientHistory() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [summaries, setSummaries] = useState({});
  const [emotions, setEmotions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const sessionData = await api.get('/api/sessions/patient/' + patientId);
        setSessions(Array.isArray(sessionData) ? sessionData : []);

        const summaryMap = {};
        await Promise.all(
          (sessionData || [])
            .filter(s => s.status === 'completed')
            .map(async s => {
              try {
                const summary = await api.get('/api/chatbot/summary?patientId=' + patientId);
                summaryMap[s._id] = summary;
              } catch {}
            })
        );
        setSummaries(summaryMap);

        const emotionData = await api.get('/api/dashboard/emotions/' + patientId);
        setEmotions(Array.isArray(emotionData) ? emotionData : []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [patientId]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center text-gray-400">Loading...</div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-6 py-5 flex items-center gap-4">
          <button onClick={() => navigate('/dashboard')} className="text-blue-600 text-sm font-semibold hover:underline">
            {'<- Back to Dashboard'}
          </button>
          <h1 className="text-xl font-bold text-gray-800">Patient History</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 grid grid-cols-1 gap-6">
        {emotions.length > 0 && (
          <div className="bg-white rounded-2xl shadow p-6">
            <h2 className="text-lg font-bold text-gray-700 mb-4">Emotional Indicators</h2>
            {emotions.slice(0, 1).map(indicator => (
              <div key={indicator._id} className="flex flex-col gap-4">
                {Object.entries(indicator.scores || {}).map(([emotion, score]) => (
                  <div key={emotion}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold text-gray-700">
                        {emotionLabel(emotion)}
                      </span>
                      <span className="text-gray-500">{score}%</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-3">
                      <div
                        className={`h-3 rounded-full transition-all ${emotion === 'anxiety' ? 'bg-red-400' :
                          emotion === 'sadness' ? 'bg-blue-400' :
                            emotion === 'anger' ? 'bg-orange-400' : 'bg-green-400'
                          }`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        <h2 className="text-lg font-bold text-gray-700">AI Pre-Interview Sessions</h2>

        {sessions.length === 0 && (
          <div className="bg-white rounded-2xl shadow p-10 text-center text-gray-400">
            No chatbot sessions yet.
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
                <span className="text-xs text-gray-400">
                  {new Date(session.createdAt).toLocaleDateString()}
                </span>
              </div>

              {summary ? (
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

                  <div>
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Clinical Summary</p>
                    <p className="text-sm text-gray-700 leading-relaxed">{summary.rawSummary}</p>
                  </div>

                  <button
                    onClick={async () => {
                      const token = localStorage.getItem('token');
                      const res = await fetch('http://localhost:5000/api/sessions/' + session._id + '/report/pdf', {
                        headers: { Authorization: 'Bearer ' + token }
                      });
                      const blob = await res.blob();
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'report-' + session._id + '.pdf';
                      a.click();
                      window.URL.revokeObjectURL(url);
                    }}
                    className="bg-green-500 text-white px-5 py-2 rounded-xl text-sm font-semibold hover:bg-green-600 transition"
                  >
                    Download PDF Report
                  </button>

                  {!session.isRated && (
                    <button
                      onClick={() => navigate('/rate/' + session.psychologistId)}
                      className="w-full bg-purple-600 text-white py-2 rounded-xl text-sm font-semibold hover:bg-purple-700 transition mt-2"
                    >
                      End Relationship & Rate Psychologist
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-4">No summary available yet.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

