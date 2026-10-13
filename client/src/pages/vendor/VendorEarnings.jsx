import { API_ORIGIN } from '../../utils/config.js';
import { formatAmount } from '../../utils/currency';
import { useApiRevision } from '../../utils/useApiRevision';
import { apiFetch } from '../../utils/api.js';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card } from '../../components/Card';
import { LoadingState } from '../../components/LoadingState';
import { StatCard } from '../../components/StatCard';
import { IndianRupee, CheckSquare, FileText, TrendingUp, CalendarDays } from 'lucide-react';

export const VendorEarnings = () => {
  const { token } = useAuth();
  const apiRevision = useApiRevision(["vendor-dashboard"], token);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await apiFetch(`${API_ORIGIN}/api/vendor-dashboard`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!res.ok) throw new Error('Failed to load earnings');
        const dashboardData = await res.json();
        setData(dashboardData);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, apiRevision]);

  if (loading) return <LoadingState />;

  if (error || !data) {
    return (
      <Card style={{ padding: '2rem', textAlign: 'center', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'var(--primary-rose-dark)', marginBottom: '1rem' }}>{error}</p>
      </Card>
    );
  }

  const { stats, earningsBookings } = data;
  const bookings = (earningsBookings || []).filter((b) => b.amount > 0);
  const average = bookings.length
    ? bookings.reduce((acc, b) => acc + b.amount, 0) / bookings.length
    : 0;

  // Monthly earnings for the bar chart (last 6 months)
  const monthlyMap = new Map();
  bookings.forEach((b) => {
    const d = b.createdAt ? new Date(b.createdAt) : new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthlyMap.set(key, (monthlyMap.get(key) || 0) + (b.amount || 0));
  });
  const monthly = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([key, total]) => {
      const [year, month] = key.split('-');
      return {
        key,
        label: new Date(Number(year), Number(month) - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }),
        total
      };
    });
  const maxMonthly = Math.max(...monthly.map((m) => m.total), 1);

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Earnings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Track your income from confirmed bookings.</p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.5rem' }}>
        <StatCard icon={IndianRupee} label="Total Earnings" value={`₹${(stats?.totalEarnings || 0).toLocaleString('en-IN')}`} subtext="from confirmed bookings" accent="var(--primary-rose)" />
        <StatCard icon={CheckSquare} label="Confirmed / Completed Bookings" value={bookings.length} subtext="with a quoted amount" accent="#10b981" />
        <StatCard icon={TrendingUp} label="Average Booking" value={formatAmount(average)} subtext="per confirmed booking" accent="#3b82f6" />
        <StatCard icon={FileText} label="Pending Quotes" value={stats?.pendingQuotesCount || 0} subtext="awaiting organizer decision" accent="#f59e0b" />
      </div>

      {/* Monthly Chart */}
      <Card style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Monthly Earnings</h2>
        {monthly.length > 0 ? (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.5rem', height: '180px', padding: '0 0.5rem' }}>
            {monthly.map((m) => (
              <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', height: '100%', justifyContent: 'flex-end' }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  ₹{m.total.toLocaleString('en-IN')}
                </div>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '60px',
                    height: `${Math.max(4, (m.total / maxMonthly) * 100)}%`,
                    background: 'linear-gradient(180deg, var(--primary-rose) 0%, var(--primary-rose-dark) 100%)',
                    borderRadius: '8px 8px 0 0',
                    transition: 'height 0.4s ease'
                  }}
                />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.label}</div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem 0' }}>
            Earnings will appear here once bookings are confirmed.
          </p>
        )}
      </Card>

      {/* Bookings List */}
      <Card style={{ padding: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem' }}>Booking History</h2>
        {bookings.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {bookings.map((booking) => (
              <div
                key={booking.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '1rem 0',
                  borderBottom: '1px solid var(--surface-soft)',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--primary-rose-tint)', color: 'var(--primary-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CalendarDays size={18} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{booking.eventName}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {booking.eventDate ? new Date(booking.eventDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                      {' • '}
                      {booking.status}
                    </div>
                  </div>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary-rose-dark)' }}>
                  ₹{(booking.amount || 0).toLocaleString('en-IN')}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '1.5rem 0' }}>
            No confirmed bookings yet.
          </p>
        )}
      </Card>
    </div>
  );
};
