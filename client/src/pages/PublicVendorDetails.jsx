import { API_ORIGIN } from '../utils/config.js';
import { apiFetch } from '../utils/api.js';
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { LoadingState } from '../components/LoadingState';
import { Star, MapPin, Globe, Phone, Briefcase, Package, MessageSquare, ArrowLeft, Heart } from 'lucide-react';

export const PublicVendorDetails = () => {
  const { id } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendor, setVendor] = useState(null);

  useEffect(() => {
    const fetchVendor = async () => {
      try {
        const res = await apiFetch(`${API_ORIGIN}/api/vendors/${id}`);
        if (!res.ok) throw new Error('Vendor not found');
        const data = await res.json();
        setVendor(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchVendor();
  }, [id]);

  if (loading) return <LoadingState />;

  if (error || !vendor) {
    return (
      <Card style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '2rem auto' }}>
        <p style={{ color: 'var(--primary-rose-dark)', marginBottom: '1rem' }}>{error || 'Vendor not found'}</p>
        <Link to="/find-vendors"><Button variant="primary">Browse Vendors</Button></Link>
      </Card>
    );
  }

  const rating = vendor.reviews?.length
    ? vendor.reviews.reduce((acc, r) => acc + r.rating, 0) / vendor.reviews.length
    : null;

  const startingPrice = (() => {
    const prices = [
      ...(vendor.packages || []).map((p) => p.price),
      ...(vendor.services || []).map((s) => s.price).filter(price => price !== null && price !== undefined)
    ];
    return prices.length ? Math.min(...prices) : null;
  })();

  const formatPrice = (price, pricingType) => {
    if (price == null) return 'Custom pricing';
    switch (pricingType) {
      case 'HOURLY': return `₹${price.toLocaleString('en-IN')}/hour`;
      case 'PER_GUEST': return `₹${price.toLocaleString('en-IN')}/guest`;
      case 'CUSTOM': return 'Custom pricing';
      default: return `₹${price.toLocaleString('en-IN')}`;
    }
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <Link to="/find-vendors" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--primary-rose)', textDecoration: 'none', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
        <ArrowLeft size={16} /> Back to Vendors
      </Link>

      {/* Header Card */}
      <Card style={{ padding: '2.5rem', borderTop: '4px solid var(--primary-rose)', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center' }}>
          <div
            style={{
              width: '110px',
              height: '110px',
              borderRadius: '28px',
              background: vendor.imageUrl
                ? `url(${vendor.imageUrl}) center/cover`
                : 'linear-gradient(135deg, var(--primary-rose) 0%, var(--primary-rose-dark) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {!vendor.imageUrl && (
              <span style={{ fontFamily: "'Great Vibes', cursive", fontSize: '3.5rem', color: '#fff' }}>
                {vendor.businessName?.charAt(0) || 'V'}
              </span>
            )}
          </div>

          <div style={{ flex: '1 1 300px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <h1 style={{ margin: 0, fontSize: 'clamp(1.5rem, 3.5vw, 2rem)' }}>{vendor.businessName}</h1>
              {rating !== null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontWeight: 600, fontSize: '1.1rem' }}>
                  <Star size={18} color="#f59e0b" fill="#f59e0b" />
                  {rating.toFixed(1)}
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    ({vendor.reviews.length})
                  </span>
                </span>
              )}
            </div>
            <div style={{ color: 'var(--primary-rose-dark)', fontWeight: 500, marginTop: '0.25rem' }}>
              {vendor.category?.name || 'Vendor'}
            </div>
            <div style={{ display: 'flex', gap: '1.25rem', flexWrap: 'wrap', marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
              {(vendor.city || vendor.state) && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={15} /> {[vendor.city, vendor.state, vendor.postalCode].filter(Boolean).join(' ')}
                </span>
              )}
              {vendor.phone && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Phone size={15} /> {vendor.phone}
                </span>
              )}
              {vendor.website && (
                <a href={vendor.website} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '5px', color: 'var(--primary-rose)', textDecoration: 'none' }}>
                  <Globe size={15} /> Website
                </a>
              )}
              {startingPrice !== null && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Briefcase size={15} /> From ₹{startingPrice.toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <Link to="/register" style={{ textDecoration: 'none' }}>
              <Button variant="primary" style={{ padding: '0.85rem 1.75rem' }}>
                <Heart size={17} style={{ marginRight: '8px' }} /> Shortlist This Vendor
              </Button>
            </Link>
            <Link to="/login" style={{ textDecoration: 'none', textAlign: 'center' }}>
              <Button variant="outline" style={{ padding: '0.85rem 1.75rem' }}>
                Log in to inquire
              </Button>
            </Link>
          </div>
        </div>

        {vendor.description && (
          <p style={{ marginTop: '1.75rem', fontSize: '1.05rem', lineHeight: 1.7 }}>
            {vendor.description}
          </p>
        )}
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Services */}
        <Card style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={20} color="var(--primary-rose)" /> Services
          </h2>
          {vendor.services?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {vendor.services.map((service) => (
                <div key={service.id} style={{ padding: '1rem 0', borderBottom: '1px solid var(--surface-soft)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{service.name}</div>
                    <div style={{ fontWeight: 600, color: 'var(--primary-rose-dark)', whiteSpace: 'nowrap' }}>
                      {formatPrice(service.price, service.pricingType)}
                    </div>
                  </div>
                  {service.description && (
                    <div style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>{service.description}</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No services listed yet.</p>
          )}
        </Card>

        {/* Packages */}
        <Card style={{ padding: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Package size={20} color="var(--primary-rose)" /> Packages
          </h2>
          {vendor.packages?.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {vendor.packages.map((pkg) => (
                <div key={pkg.id} style={{ padding: '1.25rem', backgroundColor: 'var(--surface-soft)', borderRadius: 'var(--radius-normal)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{pkg.name}</div>
                    <div style={{ fontWeight: 700, color: 'var(--primary-rose-dark)' }}>
                      ₹{pkg.price.toLocaleString('en-IN')}
                    </div>
                  </div>
                  {pkg.description && (
                    <div style={{ fontSize: '0.9rem', marginTop: '0.35rem' }}>{pkg.description}</div>
                  )}
                  {pkg.services?.length > 0 && (
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                      Includes: {pkg.services.map((s) => s.name).join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--text-secondary)' }}>No packages listed yet.</p>
          )}
        </Card>
      </div>

      {/* Reviews */}
      <Card style={{ padding: '2rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MessageSquare size={20} color="var(--primary-rose)" /> Reviews
          {rating !== null && (
            <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
              — {rating.toFixed(1)} average from {vendor.reviews.length}
            </span>
          )}
        </h2>
        {vendor.reviews?.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {vendor.reviews
              .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
              .map((review) => (
                <div key={review.id} style={{ padding: '1.25rem', border: '1px solid var(--surface-soft)', borderRadius: 'var(--radius-normal)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <span style={{ display: 'inline-flex', gap: '2px' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} size={15} color={star <= review.rating ? '#f59e0b' : 'var(--surface-soft)'} fill={star <= review.rating ? '#f59e0b' : 'none'} />
                      ))}
                    </span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {review.createdAt ? new Date(review.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-primary)' }}>{review.comment || 'No comment provided.'}</p>
                </div>
              ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1rem 0' }}>
            No reviews yet — be the first to book this vendor.
          </p>
        )}
      </Card>
    </div>
  );
};
