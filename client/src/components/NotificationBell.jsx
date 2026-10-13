import { API_ORIGIN } from '../utils/config.js';
import { apiFetch } from '../utils/api.js';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
export const NotificationBell = () => {
  const { token, user } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const res = await apiFetch(`${API_ORIGIN}/api/notifications/unread-count`, { headers: { Authorization: 'Bearer ' + token } });
        if (res.ok) { const data = await res.json(); if (active) setCount(data.count); }
      } catch { /* The next refresh retries transient failures. */ }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    window.addEventListener('notifications-updated', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('notifications-updated', refresh); };
  }, [token]);
  return <Link to={user?.role === 'VENDOR' ? '/vendor/notifications' : '/organizer/notifications'} aria-label={count ? 'Notifications, ' + count + ' unread' : 'Notifications'} style={{ color: 'var(--text-secondary)', position: 'relative' }}>
    <Bell size={24} />{count > 0 && <span style={{ position: 'absolute', top: -8, right: -10, borderRadius: 12, padding: '2px 5px', background: 'var(--primary-rose)', color: '#fff', fontSize: 11 }}>{count}</span>}
  </Link>;
};
