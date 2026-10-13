import { API_ORIGIN } from '../../utils/config.js';
import { apiFetch } from '../../utils/api.js';
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { StatusBadge } from '../../components/StatusBadge';
import { ArrowLeft, CheckCircle, XCircle, FileText, CalendarDays, MapPin, MessageSquare } from 'lucide-react';

export const QuoteDetails = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [acting, setActing] = useState(false);
  const [quote, setQuote] = useState(null);

  useEffect(() => {
    const fetchQuote = async () => {
      try {
        const res = await apiFetch(`${API_ORIGIN}/api/quotes/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load quote');
        const data = await res.json();
        setQuote(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchQuote();
  }, [id, token]);

  const updateStatus = async (status) => {
    setActing(true);
    try {
      const res = await apiFetch(`${API_ORIGIN}/api/quotes/${id}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update quote');
      }
      const updated = await res.json();
      setQuote(current => ({ ...current, ...updated }));
      showToast(status === 'ACCEPTED' ? 'Quote accepted — booking confirmed!' : 'Quote rejected', status === 'ACCEPTED' ? 'success' : 'info');
    } catch (err) {
      setError(err.message);
    } finally {
      setActing(false);
    }
  };

  if (loading) return <LoadingState />;

  if (error || !quote) {
    return (
      <Card style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'var(--primary-rose-dark)', marginBottom: '1rem' }}>{error || 'Quote not found'}</p>
        <Button variant="primary" onClick={() => navigate('/organizer/quotes')}>Back to Quotes</Button>
      </Card>
    );
  }

  const vendor = quote.vendor || {};
  const event = quote.inquiry?.event || {};
  const isPending = quote.status === 'PENDING';

  const detailRow = (Icon, label, value) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', padding: '0.9rem 0', borderBottom: '1px solid var(--surface-soft)' }}>
      <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: 'var(--primary-rose-tint)', color: 'var(--primary-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon size={18} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{label}</div>
        <div style={{ fontWeight: 500, color: 'var(--text-primary)', wordBreak: 'break-word' }}>{value}</div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <Link to="/organizer/quotes" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary-rose)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Quotes
      </Link>

      <Card style={{ padding: '2rem', borderTop: '4px solid var(--primary-rose)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>
              Quote from {vendor.businessName || 'Vendor'}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Submitted {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <StatusBadge status={quote.status} />
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Amount</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 700, color: 'var(--primary-rose-dark)' }}>
                ₹{(quote.totalAmount || 0).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>

        {detailRow(FileText, 'Quote Details', quote.details || 'No details provided')}
        {detailRow(CalendarDays, 'Event', event.title || 'Unknown event')}
        {event.date && detailRow(MapPin, 'Event Date', new Date(event.date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }))}
        {event.location && detailRow(MapPin, 'Location', event.location)}
        {quote.inquiry?.message && detailRow(MessageSquare, 'Original Inquiry', quote.inquiry.message)}

        {isPending && (
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', flexWrap: 'wrap' }}>
            <Button
              variant="primary"
              onClick={() => updateStatus('ACCEPTED')}
              disabled={acting}
              style={{ flex: '1 1 200px' }}
            >
              <CheckCircle size={18} style={{ marginRight: '8px' }} />
              {acting ? 'Processing...' : 'Accept Quote'}
            </Button>
            <Button
              variant="outline"
              onClick={() => updateStatus('REJECTED')}
              disabled={acting}
              style={{ flex: '1 1 200px', color: '#b91c1c', borderColor: '#b91c1c' }}
            >
              <XCircle size={18} style={{ marginRight: '8px' }} />
              Reject Quote
            </Button>
          </div>
        )}

        {!isPending && (
          <div style={{ marginTop: '2rem', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            This quote has been {quote.status === 'ACCEPTED' ? 'accepted — a booking has been created.' : 'rejected.'}
          </div>
        )}
      </Card>
    </div>
  );
};
