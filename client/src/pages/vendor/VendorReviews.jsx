import { useApiRevision } from '../../utils/useApiRevision';
import { apiFetch } from '../../utils/api.js';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/Card';
import { LoadingState } from '../../components/LoadingState';
import { Button } from '../../components/Button';
import { Star, MessageSquare } from 'lucide-react';

const StarRating = ({ rating, size = 16 }) => (
  <div style={{ display: 'inline-flex', gap: '2px' }}>
    {[1, 2, 3, 4, 5].map((star) => (
      <Star
        key={star}
        size={size}
        color={star <= rating ? '#f59e0b' : 'var(--surface-soft)'}
        fill={star <= rating ? '#f59e0b' : 'none'}
      />
    ))}
  </div>
);

export const VendorReviews = () => {
  const { token } = useAuth();
  const apiRevision = useApiRevision(["profile","vendors"], token);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [reviews, setReviews] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Get own profile to find the vendor profile id
        const profileRes = await apiFetch('http://localhost:5000/api/profile', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!profileRes.ok) throw new Error('Failed to load profile');
        const profile = await profileRes.json();

        if (!profile.vendorProfile) {
          setError('You need a vendor profile to view reviews.');
          setLoading(false);
          return;
        }

        // 2. Get vendor details with reviews
        const vendorRes = await apiFetch(`http://localhost:5000/api/vendors/${profile.vendorProfile.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!vendorRes.ok) throw new Error('Failed to load reviews');
        const data = await vendorRes.json();

        setVendor(data);
        setError(null);
        setReviews((data.reviews || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, apiRevision]);

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <Card style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'var(--primary-rose-dark)' }}>{error}</p>
      </Card>
    );
  }

  const average = reviews.length
    ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
    : 0;

  const distribution = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: reviews.filter((r) => r.rating === star).length
  }));

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Reviews</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          What clients are saying about {vendor?.businessName || 'your business'}.
        </p>
      </div>

      {/* Summary Card */}
      <Card style={{ padding: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2.5rem', alignItems: 'center' }}>
          <div style={{ textAlign: 'center', minWidth: '140px' }}>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
              {average.toFixed(1)}
            </div>
            <StarRating rating={Math.round(average)} size={20} />
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
              {reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
            </div>
          </div>

          <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {distribution.map(({ star, count }) => (
              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ width: '12px', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>{star}</span>
                <Star size={14} color="#f59e0b" fill="#f59e0b" />
                <div className="progress" style={{ flex: 1 }}>
                  <div
                    className="progress-bar"
                    style={{
                      width: `${reviews.length ? (count / reviews.length) * 100 : 0}%`,
                      backgroundColor: '#f59e0b'
                    }}
                  />
                </div>
                <span style={{ width: '24px', fontSize: '0.85rem', color: 'var(--text-secondary)', textAlign: 'right' }}>{count}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {reviews.map((review) => (
            <Card key={review.id} style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <StarRating rating={review.rating} />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {review.createdAt ? new Date(review.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                </span>
              </div>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {review.comment || 'No comment provided.'}
              </p>
            </Card>
          ))}
        </div>
      ) : (
        <Card style={{ padding: '3rem', textAlign: 'center' }}>
          <MessageSquare size={48} style={{ color: 'var(--surface-soft)', marginBottom: '1rem' }} />
          <h3>No reviews yet</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Reviews from past bookings will appear here.
          </p>
        </Card>
      )}
    </div>
  );
};
