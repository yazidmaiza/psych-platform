import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:5000';

const getHeaders = () => ({
  'Authorization': 'Bearer ' + localStorage.getItem('token'),
  'Content-Type': 'application/json'
});

export default function AdminPanel() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (localStorage.getItem('role') !== 'admin') {
      navigate('/login');
      return;
    }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, usersRes, verifyRes] = await Promise.all([
        fetch(API + '/api/admin/stats', { headers: getHeaders() }),
        fetch(API + '/api/admin/users', { headers: getHeaders() }),
        fetch(API + '/api/verification/pending', { headers: getHeaders() })
      ]);
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      const verifyData = await verifyRes.json();
      setStats(statsData);
      setUsers(Array.isArray(usersData) ? usersData : []);
      setPendingVerifications(Array.isArray(verifyData) ? verifyData : []);
    } catch (err) {
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      const res = await fetch(API + '/api/admin/users/' + id, {
        method: 'DELETE',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message);
      setMessage('User deleted');
      setUsers(users.filter(u => u._id !== id));
    } catch (err) {
      setError('Failed to delete user');
    }
  };

  const updateRole = async (id, role) => {
    try {
      const res = await fetch(API + '/api/admin/users/' + id + '/role', {
        method: 'PUT',
        headers: getHeaders(),
        body: JSON.stringify({ role })
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message);
      setMessage('Role updated');
      setUsers(users.map(u => u._id === id ? { ...u, role: data.role } : u));
    } catch (err) {
      setError('Failed to update role');
    }
  };

  const approvePsy = async (id) => {
    try {
      const res = await fetch(API + '/api/verification/' + id + '/approve', {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message);
      setMessage('Psychologist approved');
      setPendingVerifications(pendingVerifications.filter(p => p._id !== id));
    } catch (err) {
      setError('Failed to approve');
    }
  };

  const rejectPsy = async (id) => {
    try {
      const res = await fetch(API + '/api/verification/' + id + '/reject', {
        method: 'PUT',
        headers: getHeaders()
      });
      const data = await res.json();
      if (!res.ok) return setError(data.message);
      setMessage('Psychologist rejected');
      setPendingVerifications(pendingVerifications.filter(p => p._id !== id));
    } catch (err) {
      setError('Failed to reject');
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 30, fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 8 }}>Admin Panel</h1>
      <button onClick={() => { localStorage.clear(); navigate('/login'); }}
        style={{ float: 'right', padding: '6px 14px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
        Logout
      </button>

      {error && <p style={{ color: 'red', marginBottom: 12 }}>{error}</p>}
      {message && <p style={{ color: 'green', marginBottom: 12 }}>{message}</p>}

      {/* Stats */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
          {[
            { label: 'Total Users', value: stats.totalUsers },
            { label: 'Patients', value: stats.totalPatients },
            { label: 'Psychologists', value: stats.totalPsychologists },
            { label: 'Total Sessions', value: stats.totalSessions },
            { label: 'Active Sessions', value: stats.activeSessions },
            { label: 'Completed Sessions', value: stats.completedSessions }
          ].map(s => (
            <div key={s.label} style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 'bold', color: '#2D6A9F' }}>{s.value}</div>
              <div style={{ fontSize: 13, color: '#718096', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Users Table */}
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Users</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: '#f7fafc', textAlign: 'left' }}>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Email</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Role</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Created</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u._id} style={{ borderBottom: '1px solid #e2e8f0' }}>
              <td style={{ padding: '10px 12px' }}>{u.email}</td>
              <td style={{ padding: '10px 12px' }}>
                <select
                  value={u.role}
                  onChange={e => updateRole(u._id, e.target.value)}
                  disabled={u.role === 'admin'}
                  style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #cbd5e0' }}
                >
                  <option value="patient">patient</option>
                  <option value="psychologist">psychologist</option>
                  <option value="admin">admin</option>
                </select>
              </td>
              <td style={{ padding: '10px 12px', color: '#718096' }}>
                {new Date(u.createdAt).toLocaleDateString()}
              </td>
              <td style={{ padding: '10px 12px' }}>
                {u.role !== 'admin' && (
                  <button
                    onClick={() => deleteUser(u._id)}
                    style={{ padding: '4px 10px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Pending Verifications */}
      <h2 style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12, marginTop: 32 }}>
        🔍 Pending Verifications
      </h2>

      {pendingVerifications.length === 0 && (
        <p style={{ color: '#718096', fontSize: 14 }}>No pending verifications.</p>
      )}

      {pendingVerifications.map(psy => (
        <div key={psy._id} style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ fontWeight: 'bold', fontSize: 15 }}>{psy.firstName} {psy.lastName}</p>
              <p style={{ color: '#718096', fontSize: 13 }}>{psy.userId?.email}</p>
              <p style={{ color: '#718096', fontSize: 13 }}>📍 {psy.city}</p>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                {psy.cvUrl && (
                  <a
                    href={'http://localhost:5000/uploads/' + psy.cvUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '4px 10px', background: '#2D6A9F', color: '#fff', borderRadius: 4, fontSize: 12, textDecoration: 'none' }}
                  >
                    📄 View CV
                  </a>
                )}
                {psy.diplomaUrl && (
                  <a
                    href={'http://localhost:5000/uploads/' + psy.diplomaUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '4px 10px', background: '#2D6A9F', color: '#fff', borderRadius: 4, fontSize: 12, textDecoration: 'none' }}
                  >
                    🎓 View Diploma
                  </a>
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => approvePsy(psy._id)}
                style={{ padding: '6px 14px', background: '#38a169', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                ✅ Approve
              </button>
              <button
                onClick={() => rejectPsy(psy._id)}
                style={{ padding: '6px 14px', background: '#e53e3e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                ❌ Reject
              </button>
            </div>
          </div>

          {psy.aiVerificationSummary && (
            <div style={{ marginTop: 12, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12 }}>
              <p style={{ fontSize: 12, fontWeight: 'bold', color: '#4a5568', marginBottom: 6 }}>🤖 AI Analysis</p>
              <p style={{ fontSize: 13, color: '#4a5568', whiteSpace: 'pre-wrap' }}>{psy.aiVerificationSummary}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}