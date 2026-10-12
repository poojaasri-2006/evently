import { apiFetch, apiFetchFresh } from '../../utils/api.js';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { LoadingState } from '../../components/LoadingState';
import { IndianRupee, Plus, Trash2, PieChart } from 'lucide-react';

export const Budget = () => {
  const { token } = useAuth();
  const budgetRequest = useRef(0);
  const { showToast } = useToast();
  
  const [events, setEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [budget, setBudget] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Form states
  const [totalBudgetInput, setTotalBudgetInput] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemDesc, setNewItemDesc] = useState('');

  // Fetch events on mount
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const res = await apiFetch('http://localhost:5000/api/events', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to fetch events');
        const data = await res.json();
        setEvents(data);
        if (data.length > 0) {
          setSelectedEventId(data[0].id);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchEvents();
  }, [token]);

  // Fetch budget when selectedEventId changes
  const fetchBudget = async () => {
    if (!selectedEventId) return;
    const request = ++budgetRequest.current;
    try {
      setLoading(true);
      setError(null);
      const res = await apiFetchFresh(`http://localhost:5000/api/events/${selectedEventId}/budget`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch budget');
      const data = await res.json();
      if (request !== budgetRequest.current) return;
      setBudget(data);
      setTotalBudgetInput(data.totalBudget?.toString() || '0');
    } catch (err) {
      if (request === budgetRequest.current) setError(err.message);
    } finally {
      if (request === budgetRequest.current) setLoading(false);
    }
  };

  useEffect(() => {
    fetchBudget();
    return () => { budgetRequest.current++; };
    // eslint-disable-next-line
  }, [selectedEventId, token]);

  const handleUpdateTotal = async () => {
    try {
      const val = parseFloat(totalBudgetInput);
      if (isNaN(val) || val < 0) return alert('Invalid amount');
      
      const res = await apiFetch(`http://localhost:5000/api/events/${selectedEventId}/budget`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ totalBudget: val })
      });
      if (!res.ok) throw new Error('Failed to update total budget');
      showToast('Budget updated');
      fetchBudget();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddItem = async (e) => {
    e.preventDefault();
    try {
      const amt = parseFloat(newItemAmount);
      if (isNaN(amt) || amt < 0) return alert('Invalid amount');
      if (!newItemCategory.trim()) return alert('Category is required');

      const res = await apiFetch(`http://localhost:5000/api/events/${selectedEventId}/budget/items`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          category: newItemCategory,
          amount: amt,
          description: newItemDesc
        })
      });
      if (!res.ok) throw new Error('Failed to add budget item');
      
      setNewItemCategory('');
      setNewItemAmount('');
      setNewItemDesc('');
      showToast('Budget item added');
      fetchBudget();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return;
    try {
      const res = await apiFetch(`http://localhost:5000/api/events/${selectedEventId}/budget/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete item');
      showToast('Budget item removed', 'info');
      fetchBudget();
    } catch (err) {
      alert(err.message);
    }
  };

  // Calculations
  const { totalAllocated, remaining } = useMemo(() => {
    if (!budget) return { totalAllocated: 0, remaining: 0 };
    const items = budget.items || [];
    const alloc = budget.totalAllocated ??
      (items.reduce((sum, item) => sum + (item.amount || 0), 0) + (budget.confirmedBookingTotal || 0));
    const rem = (budget.totalBudget || 0) - alloc;
    return { totalAllocated: alloc, remaining: rem };
  }, [budget]);

  const percentageUsed = budget?.totalBudget ? Math.min(100, Math.max(0, (totalAllocated / budget.totalBudget) * 100)) : 0;

  if (loading && !events.length) return <LoadingState />;
  
  if (events.length === 0) {
    return (
      <Card style={{ padding: '4rem 2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <PieChart size={48} style={{ color: 'var(--surface-soft)', marginBottom: '1rem' }} />
        <h2 style={{ color: 'var(--text-primary)' }}>No Events Found</h2>
        <p style={{ color: 'var(--text-secondary)' }}>You need to create an event first before you can manage a budget.</p>
      </Card>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '2rem' }}>
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', marginBottom: '0.25rem' }}>Budget Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track and allocate spending for your events.</p>
        </div>
        
        <div style={{ minWidth: '250px' }}>
          <label style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Select Event</label>
          <select 
            value={selectedEventId} 
            onChange={(e) => setSelectedEventId(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 1rem', 
              border: '1px solid var(--surface-soft)', 
              borderRadius: 'var(--radius-md)',
              outline: 'none',
              backgroundColor: '#fff',
              fontFamily: 'inherit'
            }}
          >
            {events.map(ev => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <Card style={{ padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--primary-rose-dark)' }}>{error}</p>
          <Button variant="primary" onClick={fetchBudget}>Try Again</Button>
        </Card>
      ) : loading && events.length ? (
        <LoadingState />
      ) : budget ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
            <Card style={{ padding: '1.5rem', borderTop: '4px solid var(--primary-rose)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Total Budget</p>
                <IndianRupee size={20} color="var(--primary-rose)" />
              </div>
              <h2 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>₹{(budget.totalBudget || 0).toLocaleString('en-IN')}</h2>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="number"
                  min="0"
                  value={totalBudgetInput}
                  onChange={(e) => setTotalBudgetInput(e.target.value)}
                  style={{ flex: 1, padding: '0.5rem', border: '1px solid var(--surface-soft)', borderRadius: 'var(--radius-md)' }}
                />
                <Button variant="primary" onClick={handleUpdateTotal}>Update</Button>
              </div>
            </Card>

            <Card style={{ padding: '1.5rem', borderTop: '4px solid #6366f1' }}>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Allocated &amp; Booked</p>
              <h2 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)' }}>₹{totalAllocated.toLocaleString('en-IN')}</h2>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Confirmed bookings: ₹{(budget.confirmedBookingTotal || 0).toLocaleString('en-IN')}
              </p>
              
              <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--surface-soft)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ height: '100%', backgroundColor: '#6366f1', width: `${percentageUsed}%` }}></div>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                {percentageUsed.toFixed(1)}% of total budget
              </p>
            </Card>

            <Card style={{ padding: '1.5rem', borderTop: `4px solid ${remaining < 0 ? '#ef4444' : '#10b981'}` }}>
              <p style={{ color: 'var(--text-secondary)', margin: '0 0 0.5rem 0' }}>Remaining Budget</p>
              <h2 style={{ margin: 0, color: remaining < 0 ? '#ef4444' : 'var(--text-primary)' }}>
                ₹{remaining.toLocaleString('en-IN')}
              </h2>
            </Card>
          </div>
          {budget.overBudget && (
            <p role="alert" style={{ color: '#b91c1c', marginTop: '-1rem' }}>
              This event is over budget by ₹{Math.abs(remaining).toLocaleString('en-IN')}.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
            <Card style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Budget Items</h3>
              
              {budget.items && budget.items.length > 0 ? (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--surface-soft)' }}>
                        <th style={{ padding: '0.75rem 0', color: 'var(--text-secondary)', fontWeight: '500' }}>Category</th>
                        <th style={{ padding: '0.75rem 0', color: 'var(--text-secondary)', fontWeight: '500' }}>Description</th>
                        <th style={{ padding: '0.75rem 0', color: 'var(--text-secondary)', fontWeight: '500', textAlign: 'right' }}>Amount</th>
                        <th style={{ padding: '0.75rem 0', color: 'var(--text-secondary)', fontWeight: '500', textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budget.items.map((item) => (
                        <tr key={item.id} style={{ borderBottom: '1px solid var(--surface-soft)' }}>
                          <td style={{ padding: '1rem 0', fontWeight: '500' }}>{item.category}</td>
                          <td style={{ padding: '1rem 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{item.description || '-'}</td>
                          <td style={{ padding: '1rem 0', textAlign: 'right', fontWeight: '500' }}>₹{item.amount.toLocaleString('en-IN')}</td>
                          <td style={{ padding: '1rem 0', textAlign: 'right' }}>
                            <button 
                              onClick={() => handleDeleteItem(item.id)}
                              style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.25rem' }}
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  No items allocated yet. Add one below.
                </div>
              )}
            </Card>

            <Card style={{ padding: '1.5rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Plus size={20} /> Add Budget Item
              </h3>
              
              <form onSubmit={handleAddItem} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Category</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Venue, Catering"
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--surface-soft)', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Description</label>
                  <input 
                    type="text" 
                    placeholder="Optional details"
                    value={newItemDesc}
                    onChange={(e) => setNewItemDesc(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--surface-soft)', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.9rem', marginBottom: '0.25rem', color: 'var(--text-secondary)' }}>Allocated Amount (₹)</label>
                  <input 
                    type="number" 
                    min="0"
                    step="0.01"
                    required 
                    placeholder="0.00"
                    value={newItemAmount}
                    onChange={(e) => setNewItemAmount(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', border: '1px solid var(--surface-soft)', borderRadius: 'var(--radius-md)' }}
                  />
                </div>
                <div>
                  <Button variant="primary" style={{ width: '100%', padding: '0.75rem' }} type="submit">
                    Add Item
                  </Button>
                </div>
              </form>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  );
};
