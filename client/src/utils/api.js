import { API_ORIGIN, URL_BASE } from './config.js';
const cache = new Map();
const pending = new Map();
const listeners = new Set();
const FRESH_AGE = 30000;
const RETAIN_AGE = 300000;
let generation = 0;
export const subscribeApiUpdates = listener => { listeners.add(listener); return () => listeners.delete(listener); };
const publish = entry => { for (const listener of listeners) listener({ path: new URL(entry.url, URL_BASE).pathname, authorization: entry.authorization }); };
export const clearApiCache = () => { generation++; cache.clear(); pending.clear(); };
export const markApiCacheStale = () => { for (const entry of cache.values()) { entry.freshUntil = 0; publish(entry); } };
const forCaller = (promise, signal) => {
  if (!signal) return promise.then(response => response.clone());
  if (signal.aborted) return Promise.reject(new DOMException('Request aborted', 'AbortError'));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Request aborted', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
    promise.then(response => { if (!signal.aborted) resolve(response.clone()); }, reject)
      .finally(() => signal.removeEventListener('abort', abort));
  });
};
const requestData = (input, options, key, headers, saved) => {
  if (!pending.has(key)) {
    const version = generation;
    const { signal: _signal, fresh: _fresh, ...sharedOptions } = options;
    const request = fetch(input, sharedOptions).then(async response => {
      if (response.ok && version === generation) {
        const signature = await response.clone().text();
        if (version === generation) {
          if (cache.size >= 100 && !cache.has(key)) cache.delete(cache.keys().next().value);
          const entry = { response: response.clone(), signature, freshUntil: Date.now() + FRESH_AGE, retainUntil: Date.now() + RETAIN_AGE, url: typeof input === 'string' ? input : input.url, authorization: headers.get('authorization') || '' };
          cache.set(key, entry);
          if (saved && saved.signature !== signature) publish(entry);
        }
      } else if ((response.status === 401 || response.status === 403 || response.status === 404) && version === generation && saved) {
        cache.delete(key); publish(saved);
      }
      return response;
    }).finally(() => { if (pending.get(key) === request) pending.delete(key); });
    pending.set(key, request);
  }
  return pending.get(key);
};
export const apiFetch = (input, options = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  const method = (options.method || input.method || 'GET').toUpperCase();
  const headers = new Headers(options.headers || input.headers);
  if (method !== 'GET') {
    // Chat and read receipts do not invalidate unrelated event/vendor modules.
    const area = url.match(/\/api\/(messages|notifications)(\/|$)/)?.[1];
    const invalidate = area ? () => {
      generation++;
      pending.clear();
      for (const [key, entry] of cache) if (new URL(entry.url, URL_BASE).pathname.startsWith('/api/' + area)) cache.delete(key);
    } : clearApiCache;
    invalidate();
    return fetch(input, options).finally(invalidate);
  }
  if (/\/api\/auth(\/|$)/.test(url) || options.cache === 'no-store') return fetch(input, options);
  const key = url + '|' + [...headers.entries()].sort().map(([k,v]) => k + ':' + v).join('|');
  const saved = cache.get(key);
  if (!options.fresh && saved && saved.retainUntil > Date.now()) {
    if (saved.freshUntil <= Date.now() || /\/api\/(messages|notifications)(\/|$)/.test(url)) void requestData(input, options, key, headers, saved).catch(() => {});
    return forCaller(Promise.resolve(saved.response), options.signal);
  }
  return forCaller(requestData(input, options, key, headers, saved), options.signal);
};
// Edit forms always request current server values instead of showing an older snapshot.
export const apiFetchFresh = (input, options = {}) => apiFetch(input, { ...options, fresh: true });
export const prefetchModule = (route, token) => {
  const organizer = { messages: ['messages/conversations'], notifications: ['notifications'], dashboard: ['events','inquiries','bookings','vendors'], events: ['events'], vendors: ['vendors','vendors/categories','shortlist','events'], shortlist: ['shortlist','events'], compare: ['shortlist'], requests: ['inquiries'], quotes: ['quotes'], bookings: ['bookings','quotes'], budget: ['events'], profile: ['profile'], settings: ['profile/notification-preferences'] };
  const vendor = { messages: ['messages/conversations'], notifications: ['notifications'], dashboard: ['vendor-dashboard'], profile: ['profile','vendors/categories'], services: ['vendor/services','vendors/categories'], packages: ['vendor/packages','vendor/services','vendors/categories'], availability: ['vendor/availability'], requests: ['vendor/requests'], quotes: ['quotes','vendor/requests','vendor/packages','vendor/services'], bookings: ['vendor/bookings'], reviews: ['profile'], earnings: ['vendor-dashboard'], settings: ['profile/notification-preferences'] };
  const parts = route.split('/').filter(Boolean);
  const endpoints = (parts[0] === 'organizer' ? organizer : vendor)[parts[1]] || [];
  for (const endpoint of endpoints) void apiFetch(`${API_ORIGIN}/api/` + endpoint, { headers: { Authorization: 'Bearer ' + token } }).catch(() => {});
};

export const warmModules = (role, token) => {
  if (!token || typeof window === 'undefined') return () => {};
  const endpoints = role === 'ORGANIZER' ? ['messages/conversations','notifications','events','vendors','shortlist','quotes','bookings','inquiries','profile','vendors/categories'] : ['messages/conversations','notifications','vendor/services','vendor/packages','vendor/bookings','vendor/requests','quotes','vendor/availability','profile','vendors/categories','vendor-dashboard'];
  let cancelled = false;
  let index = 0;
  const worker = async () => {
    while (!cancelled && index < endpoints.length) {
      const endpoint = endpoints[index++];
      try { await apiFetch(`${API_ORIGIN}/api/` + endpoint, { headers: { Authorization: 'Bearer ' + token } }); } catch { /* A module retries when opened. */ }
    }
  };
  const timer = window.setTimeout(() => { void worker(); void worker(); }, 750);
  return () => { cancelled = true; window.clearTimeout(timer); };
};
if (typeof window !== 'undefined') {
  window.addEventListener('focus', markApiCacheStale);
  window.addEventListener('api-data-invalidated', markApiCacheStale);
}
