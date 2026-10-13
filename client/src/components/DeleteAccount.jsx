import { API_ORIGIN } from '../utils/config.js';
import { apiFetch } from '../utils/api.js';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Card } from './Card';
import { Button } from './Button';
import { Input } from './Input';
export const DeleteAccount = () => {
  const { token, logout } = useAuth();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async e => {
    e.preventDefault();
    if (!window.confirm('Delete your account and its events, bookings, messages, and profile permanently?')) return;
    setBusy(true); setError('');
    try {
      const res = await apiFetch(`${API_ORIGIN}/api/profile/delete-account`, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to delete account');
      logout();
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  return <Card style={{ padding: '2rem' }}><h2>Delete Account</h2><p>This permanently removes your account and dependent records.</p><form onSubmit={submit}>{error && <p role="alert">{error}</p>}<label>Confirm with your password<Input type="password" value={password} onChange={e => setPassword(e.target.value)} required /></label><Button type="submit" disabled={busy}>{busy ? 'Deleting...' : 'Delete Account'}</Button></form></Card>;
};
