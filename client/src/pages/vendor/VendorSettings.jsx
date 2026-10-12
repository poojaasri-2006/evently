import { apiFetchFresh as apiFetch } from '../../utils/api.js';
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { LoadingState } from '../../components/LoadingState';
import { Bell, Lock } from 'lucide-react';
import { DeleteAccount } from '../../components/DeleteAccount';

const PREF_LABELS = [
  { key: 'eventUpdates', label: 'Event updates', description: 'Changes to your events and requirements' },
  { key: 'vendorActivity', label: 'Vendor activity', description: 'New vendor signups and profile changes' },
  { key: 'quotesAndBookings', label: 'Quotes & bookings', description: 'Quotes submitted and booking confirmations' },
  { key: 'generalSystem', label: 'General system', description: 'Product announcements and tips' }
];

export const VendorSettings = () => {
  const { token } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [prefs, setPrefs] = useState({
    eventUpdates: true,
    vendorActivity: true,
    quotesAndBookings: true,
    generalSystem: true
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdError, setPwdError] = useState(null);
  const [savingPwd, setSavingPwd] = useState(false);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await apiFetch('http://localhost:5000/api/profile/notification-preferences', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setPrefs({
            eventUpdates: data.eventUpdates ?? true,
            vendorActivity: data.vendorActivity ?? true,
            quotesAndBookings: data.quotesAndBookings ?? true,
            generalSystem: data.generalSystem ?? true
          });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [token]);

  const handleSavePrefs = async () => {
    setSavingPrefs(true);
    try {
      const res = await apiFetch('http://localhost:5000/api/profile/notification-preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(prefs)
      });
      if (!res.ok) throw new Error('Failed to save preferences');
      showToast('Notification preferences saved');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setSavingPrefs(false);
    }
  };

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    setPwdError(null);
    if (newPassword !== confirmPassword) {
      return setPwdError('New passwords do not match');
    }
    if (newPassword.length < 6) {
      return setPwdError('New password must be at least 6 characters');
    }
    setSavingPwd(true);
    try {
      const res = await apiFetch('http://localhost:5000/api/profile/password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ currentPassword, newPassword })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update password');
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password updated successfully');
    } catch (err) {
      setPwdError(err.message);
    } finally {
      setSavingPwd(false);
    }
  };

  if (loading) return <LoadingState />;

  const sectionHeader = (Icon, title, subtitle) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
      <div style={{ width: '40px', height: '40px', borderRadius: '12px', backgroundColor: 'var(--primary-rose-tint)', color: 'var(--primary-rose)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={20} />
      </div>
      <div>
        <h2 style={{ margin: 0, fontSize: '1.15rem' }}>{title}</h2>
        <p style={{ margin: 0, fontSize: '0.85rem' }}>{subtitle}</p>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: '700px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <div>
        <h1 style={{ marginBottom: '0.25rem' }}>Settings</h1>
        <p style={{ color: 'var(--text-secondary)' }}>Manage your account preferences.</p>
      </div>

      {/* Notifications */}
      <Card style={{ padding: '2rem' }}>
        {sectionHeader(Bell, 'Notifications', 'Choose what you want to hear about')}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {PREF_LABELS.map(({ key, label, description }) => (
            <label
              key={key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '1rem',
                padding: '1rem 0',
                borderBottom: '1px solid var(--surface-soft)',
                cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{label}</div>
                <div style={{ fontSize: '0.85rem' }}>{description}</div>
              </div>
              <input
                type="checkbox"
                checked={prefs[key]}
                onChange={(e) => setPrefs({ ...prefs, [key]: e.target.checked })}
                style={{ width: '20px', height: '20px', accentColor: 'var(--primary-rose)', cursor: 'pointer' }}
              />
            </label>
          ))}
        </div>
        <Button variant="primary" onClick={handleSavePrefs} disabled={savingPrefs} style={{ marginTop: '1.5rem' }}>
          {savingPrefs ? 'Saving...' : 'Save Preferences'}
        </Button>
      </Card>

      {/* Password */}
      <Card style={{ padding: '2rem' }}>
        {sectionHeader(Lock, 'Change Password', 'Keep your account secure')}
        {pwdError && (
          <div style={{ backgroundColor: 'var(--primary-rose-tint)', color: 'var(--primary-rose-dark)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-normal)', marginBottom: '1rem', fontSize: '0.9rem' }}>
            {pwdError}
          </div>
        )}
        <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Current Password</label>
            <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>New Password</label>
            <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 500, marginBottom: '0.5rem' }}>Confirm New Password</label>
            <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
          </div>
          <Button type="submit" variant="primary" disabled={savingPwd}>
            {savingPwd ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Card>
      <DeleteAccount />
    </div>
  );
};
