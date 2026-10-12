import { apiFetchFresh as apiFetch } from '../../utils/api.js';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { ArrowLeft } from 'lucide-react';

const toLocalDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
};

const STATUS_OPTIONS = ['DRAFT', 'PUBLISHED', 'COMPLETED', 'CANCELLED'];

export const EditEvent = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    date: '',
    location: '',
    status: 'DRAFT'
  });

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const res = await apiFetch(`http://localhost:5000/api/events/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load event');
        const event = await res.json();
        setForm({
          title: event.title || '',
          description: event.description || '',
          date: toLocalDateTime(event.date),
          location: event.location || '',
          status: event.status || 'DRAFT'
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, token]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setError('Event title is required');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`http://localhost:5000/api/events/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          date: form.date ? new Date(form.date).toISOString() : null,
          location: form.location.trim(),
          status: form.status
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update event');
      }
      showToast('Event updated successfully');
      navigate(`/organizer/events/${id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingState />;

  if (error && !form.title) {
    return (
      <Card style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'var(--primary-rose-dark)', marginBottom: '1rem' }}>{error}</p>
        <Button variant="primary" onClick={() => navigate(`/organizer/events/${id}`)}>Back to Event</Button>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto' }}>
      <Link to={`/organizer/events/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary-rose)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Event
      </Link>

      <Card style={{ padding: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Edit Event</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Update the details below and save your changes.</p>

        {error && (
          <div style={{ backgroundColor: 'var(--primary-rose-tint)', color: 'var(--primary-rose-dark)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-normal)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Event Title</label>
            <Input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Sarah & Mike's Wedding" />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Description</label>
            <textarea
              name="description"
              value={form.description}
              onChange={handleChange}
              rows={4}
              className="input"
              style={{ resize: 'vertical', borderRadius: 'var(--radius-normal)', padding: '1rem' }}
              placeholder="Venue details, theme, guest count, anything vendors should know..."
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Date & Time</label>
              <Input type="datetime-local" name="date" value={form.date} onChange={handleChange} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Location</label>
              <Input name="location" value={form.location} onChange={handleChange} placeholder="City, venue, or address" />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Status</label>
            <select name="status" value={form.status} onChange={handleChange} className="input" style={{ cursor: 'pointer' }}>
              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>)}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <Button type="submit" variant="primary" style={{ flex: 1 }} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(`/organizer/events/${id}`)}>Cancel</Button>
          </div>
        </form>
      </Card>
    </div>
  );
};
