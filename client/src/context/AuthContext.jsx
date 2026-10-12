import { apiFetch, clearApiCache } from '../utils/api.js';
import { createContext, useContext, useState, useEffect } from 'react';
const AuthContext = createContext(null);
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('evently_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!token) {
      localStorage.removeItem('evently_token'); localStorage.removeItem('evently_user');
      setUser(null); setAuthError(''); setLoading(false);
      return () => controller.abort();
    }
    localStorage.setItem('evently_token', token);
    setLoading(true); setAuthError('');
    const fetchUser = async () => {
      try {
        const response = await apiFetch('http://localhost:5000/api/auth/me', { headers: { Authorization: 'Bearer ' + token }, signal: controller.signal });
        if (response.status === 401 || response.status === 404) { setToken(null); return; }
        if (!response.ok) throw new Error('Unable to verify your session. Please try again.');
        const data = await response.json();
        if (!controller.signal.aborted) { setUser(data); localStorage.setItem('evently_user', JSON.stringify(data)); }
      } catch (error) {
        if (!controller.signal.aborted) setAuthError(error.message || 'Unable to verify your session.');
      } finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void fetchUser();
    return () => controller.abort();
  }, [token, retry]);
  const login = async (email, password) => {
    const response = await apiFetch('http://localhost:5000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
    const data = await response.json();
    if (!response.ok) return { success: false, message: data.message };
    setAuthError(''); setToken(data.token); setUser(data.user);
    localStorage.setItem('evently_user', JSON.stringify(data.user));
    return { success: true, user: data.user };
  };
  const refreshUser = async () => {
    const response = await apiFetch('http://localhost:5000/api/auth/me', { headers: { Authorization: 'Bearer ' + token } });
    if (!response.ok) throw new Error('Unable to refresh your profile.');
    const data = await response.json();
    setUser(data); localStorage.setItem('evently_user', JSON.stringify(data));
  };
  const logout = () => { clearApiCache(); localStorage.removeItem('evently_token'); localStorage.removeItem('evently_user'); setToken(null); setUser(null); };
  return <AuthContext.Provider value={{ user, token, loading, authError, retrySession: () => setRetry(value => value + 1), login, logout, refreshUser, setToken }}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
