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
      const [statsRes, usersRes] = await Promise.all([
        fetch(API + '/api/admin/stats', { headers: getHeaders() }),
        fetch(API + '/api/admin/users', { headers: getHeaders() })
      ]);
      const statsData = await statsRes.json();
      const usersData = await usersRes.json();
      setStats(statsData);
      setUsers(usersData);
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
    </div>
  );
}