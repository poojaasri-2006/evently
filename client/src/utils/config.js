const env = import.meta.env || {};
// Vite's production build uses the same origin as the website by default.
export const API_ORIGIN = (env.VITE_API_URL ?? (env.DEV ? 'http://localhost:5000' : '')).replace(/\/+$/, '');
export const URL_BASE = API_ORIGIN || globalThis.location?.origin || 'http://localhost:5000';
export const SOCKET_ORIGIN = URL_BASE;
export const SOCKET_PATH = env.VITE_SOCKET_PATH || (env.DEV ? '/socket.io' : '/api/socket.io');
