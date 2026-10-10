const LOCAL_URL = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/i;
const LOCAL_HOST = /^(localhost|127\.0\.0\.1)$/i;

/**
 * Origin of the backend API and signaling server. A configured http://localhost:5000 only works in
 * a browser on this computer; a phone opening the dev server over the LAN (http://192.168.x.x:3000)
 * must use the page's own origin, which Vite proxies to the backend (/api, /socket.io).
 */
export function apiBase(configured = import.meta.env.VITE_API_BASE_URL) {
  const page = window.location;
  if (!configured || (LOCAL_URL.test(configured) && !LOCAL_HOST.test(page.hostname))) return page.origin;
  return configured.replace(/\/$/, '');
}
