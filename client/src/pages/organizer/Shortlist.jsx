import { useApiRevision } from '../../utils/useApiRevision';
import { apiFetch } from '../../utils/api.js';
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { Search } from 'lucide-react';

export const Shortlist = () => {
  const { token } = useAuth();
  const apiRevision = useApiRevision(["shortlist","events"], token);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [shortlists, setShortlists] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [eventFilter, setEventFilter] = useState('All');
  
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchData = async () => {
    try {
      if (apiRevision === 0) setLoading(true);
      setError(null);
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [shortlistsRes, eventsRes] = await Promise.all([
        apiFetch('http://localhost:5000/api/shortlist', { headers }),
        apiFetch('http://localhost:5000/api/events', { headers })
      ]);

      if (!shortlistsRes.ok) throw new Error('Failed to fetch shortlist');
      
      const [shortlistsData, eventsData] = await Promise.all([
        shortlistsRes.json(),
        eventsRes.ok ? eventsRes.json() : []
      ]);

      setShortlists(shortlistsData);
      setEvents(eventsData);
    } catch (err) {
      console.error(err);
      setError('Unable to load your shortlist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token, apiRevision]);

  const handleRemove = async (id) => {
    if (!window.confirm('Are you sure you want to remove this vendor from your shortlist?')) return;
    
    setActionLoading(true);
    setActionError('');
    
    try {
      const res = await apiFetch(`http://localhost:5000/api/shortlist/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to remove shortlist item');
      }
      
      setShortlists(prev => prev.filter(s => s.id !== id));
      showToast('Vendor removed from shortlist', 'info');
    } catch (err) {
      console.error(err);
      setActionError('Unable to remove vendor. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const getVendorRating = (vendor) => {
    if (!vendor || !vendor.reviews || vendor.reviews.length === 0) return 0;
    const sum = vendor.reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / vendor.reviews.length;
  };

  const getStartingPrice = (vendor) => {
    if (!vendor) return null;
    const prices = [];
    if (vendor.packages && vendor.packages.length > 0) {
      prices.push(...vendor.packages.map(p => p.price));
    }
    if (vendor.services && vendor.services.length > 0) {
      prices.push(...vendor.services.filter(s => s.price !== null && s.price !== undefined).map(s => s.price));
    }
    return prices.length > 0 ? Math.min(...prices) : null;
  };

  const filteredShortlists = shortlists.filter(item => {
    const vendor = item.vendor;
    if (!vendor) return false;

    // Search
    const searchLower = searchQuery.toLowerCase();
    const matchesSearch = 
      vendor.businessName.toLowerCase().includes(searchLower) ||
      (vendor.category?.name || '').toLowerCase().includes(searchLower) ||
      (vendor.description || '').toLowerCase().includes(searchLower);
    
    // Event Filter
    const matchesEvent = eventFilter === 'All' || item.eventId === eventFilter;

    return matchesSearch && matchesEvent;
  });

  if (loading) return <LoadingState />;

  if (error) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--primary-rose-dark)', marginBottom: '1rem' }}>{error}</p>
        <Button variant="primary" onClick={fetchData}>Try Again</Button>
      </div>
    );
  }

  if (shortlists.length === 0) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', textAlign: 'center', padding: '4rem 2rem' }}>
        <h2 style={{ color: 'var(--text-primary)', marginBottom: '1rem' }}>Your shortlist is empty.</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>Explore the vendor marketplace and save vendors you like.</p>
        <Link to="/organizer/vendors">
          <Button variant="primary">Find Vendors</Button>
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>My Shortlist</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Keep track of the vendors you are considering for your events. ({shortlists.length} total)</p>
        
        {actionError && (
          <div style={{ color: 'var(--primary-rose-dark)', backgroundColor: 'var(--primary-rose-tint)', padding: '0.75rem', borderRadius: 'var(--radius-normal)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {actionError}
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 300px' }}>
            <Search style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} size={20} />
            <Input 
              placeholder="Search shortlisted vendors..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ paddingLeft: '3rem', width: '100%', backgroundColor: 'var(--card-white)' }}
            />
          </div>
          
          <select 
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="input"
            style={{ width: '250px', backgroundColor: 'var(--card-white)', appearance: 'none' }}
          >
            <option value="All">All Events</option>
            {events.map(e => (
              <option key={e.id} value={e.id}>{e.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      {filteredShortlists.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
          {filteredShortlists.map(item => {
            const vendor = item.vendor;
            const rating = getVendorRating(vendor);
            const startingPrice = getStartingPrice(vendor);
            const event = item.event;

            return (
              <Card key={item.id} style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                  <div style={{ width: '50px', height: '50px', borderRadius: '50%', backgroundColor: 'var(--primary-rose-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', color: 'var(--primary-rose-dark)', fontSize: '1.2rem' }}>
                    {vendor.businessName.charAt(0)}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-primary)' }}>{vendor.businessName}</h3>
                    <div style={{ fontSize: '0.85rem', color: 'var(--primary-rose)', fontWeight: '500' }}>
                      {vendor.category?.name || 'Vendor'}
                    </div>
                  </div>
                </div>
                
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>
                  {event && <div style={{ marginBottom: '0.75rem', paddingBottom: '0.75rem', borderBottom: '1px solid var(--surface-soft)' }}><strong>Event:</strong> {event.title}</div>}
                  {rating > 0 && <div style={{ marginBottom: '0.5rem' }}>⭐ {rating.toFixed(1)} Rating</div>}
                  {startingPrice !== null && <div style={{ marginBottom: '0.5rem' }}><strong>Starting at:</strong> ₹{startingPrice}</div>}
                  {vendor.description && vendor.description.includes('location:') ? (
                    <div style={{ marginBottom: '0.5rem' }}>📍 Location: {vendor.description.split('location:')[1].trim()}</div>
                  ) : null}
                  <p style={{ margin: '0.5rem 0 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {vendor.description || 'No description provided.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Button variant="outline" onClick={() => navigate(`/organizer/vendors/${vendor.id}`)} style={{ flex: 1 }}>
                    View Vendor
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => handleRemove(item.id)} 
                    disabled={actionLoading}
                    style={{ flex: 1, borderColor: 'var(--primary-rose)', color: 'var(--primary-rose-dark)' }}
                  >
                    Remove
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--card-white)', borderRadius: 'var(--radius-large)' }}>
          <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.5rem' }}>No matching vendors found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>Try changing your search or filters.</p>
        </div>
      )}

    </div>
  );
};
