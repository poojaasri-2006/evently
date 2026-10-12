import { apiFetch } from '../utils/api.js';
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../components/Card';
import { LoadingState } from '../components/LoadingState';
import { Search, Star, MapPin, Users, ArrowRight } from 'lucide-react';

export const FindVendors = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [vendorsRes, categoriesRes] = await Promise.all([
          apiFetch('http://localhost:5000/api/vendors'),
          apiFetch('http://localhost:5000/api/vendors/categories')
        ]);
        if (!vendorsRes.ok || !categoriesRes.ok) throw new Error('Failed to load vendors');
        const vendorsData = await vendorsRes.json();
        const categoriesData = await categoriesRes.json();
        setVendors(vendorsData);
        setCategories(categoriesData);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const getRating = (vendor) => {
    if (!vendor.reviews || vendor.reviews.length === 0) return null;
    const sum = vendor.reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / vendor.reviews.length;
  };

  const getStartingPrice = (vendor) => {
    const prices = [
      ...(vendor.packages || []).map((p) => p.price),
      ...(vendor.services || []).map((s) => s.price).filter(price => price !== null && price !== undefined)
    ];
    return prices.length ? Math.min(...prices) : null;
  };

  const filtered = vendors.filter((vendor) => {
    const matchesSearch =
      !search.trim() ||
      vendor.businessName?.toLowerCase().includes(search.toLowerCase()) ||
      vendor.description?.toLowerCase().includes(search.toLowerCase()) ||
      vendor.city?.toLowerCase().includes(search.toLowerCase()) ||
      vendor.state?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory =
      !selectedCategory ||
      vendor.categoryId === selectedCategory ||
      vendor.services?.some((s) => s.categoryId === selectedCategory) ||
      vendor.packages?.some((p) => p.categoryId === selectedCategory);
    return matchesSearch && matchesCategory;
  });

  if (loading) return <LoadingState />;
  if (error) return <Card><p role="alert">{error}</p><button onClick={() => window.location.reload()}>Try again</button></Card>;

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <h1 style={{ fontSize: 'clamp(1.75rem, 4vw, 2.5rem)', fontWeight: 700, marginBottom: '0.5rem' }}>
          Find the perfect vendors
        </h1>
        <p style={{ fontSize: '1.05rem' }}>
          Browse {vendors.length} vendors across {categories.length} categories — no account needed.
        </p>
      </div>

      {/* Search */}
      <div className="search" style={{ maxWidth: '560px', margin: '0 auto 1.5rem' }}>
        <Search size={18} className="search-icon" />
        <input
          className="input"
          placeholder="Search by name, city, or service..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '2rem' }}>
          <button
            className="chip"
            onClick={() => setSelectedCategory('')}
            style={{
              cursor: 'pointer',
              border: 'none',
              fontFamily: 'var(--font-family)',
              backgroundColor: !selectedCategory ? 'var(--primary-rose)' : 'var(--primary-rose-tint)',
              color: !selectedCategory ? '#fff' : 'var(--primary-rose-dark)'
            }}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className="chip"
              onClick={() => setSelectedCategory(cat.id === selectedCategory ? '' : cat.id)}
              style={{
                cursor: 'pointer',
                border: 'none',
                fontFamily: 'var(--font-family)',
                backgroundColor: selectedCategory === cat.id ? 'var(--primary-rose)' : 'var(--primary-rose-tint)',
                color: selectedCategory === cat.id ? '#fff' : 'var(--primary-rose-dark)'
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Results */}
      {filtered.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filtered.map((vendor) => {
            const rating = getRating(vendor);
            const startingPrice = getStartingPrice(vendor);
            return (
              <Link to={`/vendor/${vendor.id}`} key={vendor.id} style={{ textDecoration: 'none' }}>
                <Card
                  style={{
                    padding: 0,
                    overflow: 'hidden',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    cursor: 'pointer'
                  }}
                  className="stat-card"
                >
                  <div
                    style={{
                      height: '120px',
                      background: 'linear-gradient(135deg, var(--primary-rose) 0%, var(--primary-rose-dark) 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <span style={{ fontFamily: "'Great Vibes', cursive", fontSize: '3rem', color: 'rgba(255,255,255,0.9)' }}>
                      {vendor.businessName?.charAt(0) || 'V'}
                    </span>
                  </div>
                  <div style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                      <div style={{ minWidth: 0 }}>
                        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.1rem' }}>{vendor.businessName}</h3>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {vendor.category?.name || 'Vendor'}
                        </div>
                      </div>
                      {rating !== null && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                          <Star size={15} color="#f59e0b" fill="#f59e0b" />
                          {rating.toFixed(1)}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {(vendor.city || vendor.state) && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={14} /> {[vendor.city, vendor.state].filter(Boolean).join(', ')}
                        </span>
                      )}
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={14} /> {vendor.services?.length || 0} services
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-soft)' }}>
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                        {startingPrice !== null ? (
                          <>Starting at <strong style={{ color: 'var(--primary-rose-dark)' }}>₹{startingPrice.toLocaleString('en-IN')}</strong></>
                        ) : (
                          'Custom pricing'
                        )}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--primary-rose)', fontWeight: 500, fontSize: '0.9rem' }}>
                        View <ArrowRight size={15} />
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card style={{ padding: '3rem', textAlign: 'center' }}>
          <Search size={48} style={{ color: 'var(--surface-soft)', marginBottom: '1rem' }} />
          <h3>No vendors found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Try a different search or category.
          </p>
        </Card>
      )}
    </div>
  );
};
