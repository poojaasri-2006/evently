import { API_ORIGIN } from '../../utils/config.js';
import { useApiRevision } from '../../utils/useApiRevision';
import { apiFetch } from '../../utils/api.js';
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { LoadingState } from '../../components/LoadingState';
import { Calendar, MapPin, IndianRupee, FileText, ArrowLeft, Building2 } from 'lucide-react';

export const BookingDetails = () => {
  const { id } = useParams();
  const { token } = useAuth();
  const apiRevision = useApiRevision(["bookings"], token);
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBooking = async () => {
    try {
      if (apiRevision === 0) setLoading(true);
      setError(null);
      const res = await apiFetch(`${API_ORIGIN}/api/bookings/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication expired or unauthorized. Please log in again.');
      }
      
      if (res.status === 404) {
        throw new Error('Booking not found.');
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to fetch booking details');
      }
      
      const data = await res.json();
      setBooking(data);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unable to load booking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBooking();
  }, [id, token, apiRevision]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <Card>
          <h2 style={{ color: 'var(--primary-rose-dark)', marginBottom: '1rem' }}>Oops!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>{error}</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <Link to="/organizer/bookings" style={{ textDecoration: 'none' }}>
              <Button variant="outline">Back to Bookings</Button>
            </Link>
            <Button variant="primary" onClick={fetchBooking}>Try Again</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!booking) return null;

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '2rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <Link to="/organizer/bookings" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-rose)', fontWeight: '500', marginBottom: '1rem' }}>
          <ArrowLeft size={18} />
          Back to Bookings
        </Link>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>Booking Details</h1>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              Created on {new Date(booking.createdAt).toLocaleDateString()}
            </p>
          </div>
          <Badge variant={
            booking.status === 'CONFIRMED' ? 'success' : 
            booking.status === 'COMPLETED' ? 'info' : 
            'default'
          } style={{ fontSize: '1rem', padding: '0.5rem 1rem' }}>
            {booking.status}
          </Badge>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
        
        {/* Vendor Details */}
        <Card style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-rose-dark)' }}>
            <Building2 size={20} />
            Vendor Information
          </h3>
          
          {booking.vendor ? (
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{booking.vendor.businessName}</h4>
              {booking.vendor.description && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  {booking.vendor.description}
                </p>
              )}
              {booking.vendor.phone && (
                <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem' }}><strong>Phone:</strong> {booking.vendor.phone}</p>
              )}
              {booking.vendor.website && (
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                  <strong>Website:</strong> <a href={booking.vendor.website} target="_blank" rel="noreferrer" style={{ color: 'var(--primary-rose)' }}>{booking.vendor.website}</a>
                </p>
              )}
              <Link to={`/organizer/vendors/${booking.vendor.id}`} style={{ textDecoration: 'none' }}>
                <Button variant="outline" style={{ width: '100%' }}>View Full Profile</Button>
              </Link>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Vendor details are not available for this booking.</p>
          )}
        </Card>

        {/* Event Details */}
        <Card style={{ padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-rose-dark)' }}>
            <Calendar size={20} />
            Event Information
          </h3>
          
          {booking.event ? (
            <div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem' }}>{booking.event.title}</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '0.5rem', fontSize: '0.95rem' }}>
                <Calendar size={16} />
                <span>{booking.event.date ? new Date(booking.event.date).toLocaleDateString() : 'Date TBD'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.95rem' }}>
                <MapPin size={16} />
                <span>{booking.event.location || 'Location TBD'}</span>
              </div>
              <Link to={`/organizer/events/${booking.event.id}`} style={{ textDecoration: 'none' }}>
                <Button variant="outline" style={{ width: '100%' }}>View Event Details</Button>
              </Link>
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>Event details are not available.</p>
          )}
        </Card>

      </div>

      {/* Quote Details */}
      <Card style={{ padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary-rose-dark)' }}>
          <FileText size={20} />
          Quote Summary
        </h3>
        
        {booking.quote ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--surface-soft)', marginBottom: '1rem' }}>
              <span style={{ fontWeight: '600' }}>Agreed Total Amount</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                ₹{booking.quote.totalAmount.toLocaleString('en-IN')}
              </span>
            </div>
            
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem' }}>Quote Details & Terms</h4>
            <div style={{ 
              backgroundColor: 'var(--surface-soft)', 
              padding: '1rem', 
              borderRadius: 'var(--radius-md)',
              whiteSpace: 'pre-wrap',
              fontSize: '0.95rem',
              color: 'var(--text-secondary)'
            }}>
              {booking.quote.details}
            </div>
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)' }}>No quote information is attached to this booking.</p>
        )}
      </Card>

    </div>
  );
};
