import { apiFetch } from '../utils/api.js';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './Button';
import { Input } from './Input';
export const EventRequirements = ({ eventId, requirements, onChange }) => {
  const { token } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async (method, id, body) => {
    setBusy(true); setError('');
    try {
      const res = await apiFetch('http://localhost:5000/api/events/' + eventId + '/requirements' + (id ? '/' + id : ''), { method, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Unable to save requirement');
      onChange(method === 'DELETE' ? requirements.filter(r => r.id !== id) : id ? requirements.map(r => r.id === id ? data : r) : [...requirements, data]);
      return true;
    } catch (err) { setError(err.message); return false; } finally { setBusy(false); }
  };
  return <div>{error && <p role="alert">{error}</p>}
    <form onSubmit={async e => { e.preventDefault(); if (await save(editing ? 'PATCH' : 'POST', editing, { title, category })) { setTitle(''); setCategory(''); setEditing(null); } }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
      <Input aria-label="Requirement title" placeholder="Requirement title" value={title} onChange={e => setTitle(e.target.value)} required maxLength={200} />
      <Input aria-label="Requirement category" placeholder="Category (optional)" value={category} onChange={e => setCategory(e.target.value)} />
      <Button type="submit" disabled={busy}>{editing ? 'Save Requirement' : 'Add Requirement'}</Button>
      {editing && <Button type="button" onClick={() => { setEditing(null); setTitle(''); setCategory(''); }}>Cancel</Button>}
    </form>
    {requirements.length === 0 && <p>No requirements added yet.</p>}
    {requirements.map(r => <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}><span style={{ flex: 1 }}>{r.title} {r.category && '(' + r.category + ')'}</span>
      <Button disabled={busy} onClick={() => save('PATCH', r.id, { status: r.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED' })}>{r.status === 'COMPLETED' ? 'Reopen' : 'Mark Complete'}</Button>
      <Button disabled={busy} onClick={() => { setEditing(r.id); setTitle(r.title); setCategory(r.category || ''); }}>Edit</Button>
      <Button disabled={busy} onClick={() => { if (window.confirm('Delete this requirement?')) save('DELETE', r.id); }}>Delete</Button>
    </div>)}
  </div>;
};
