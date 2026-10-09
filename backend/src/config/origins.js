// Browser origins allowed to call the API and open meeting sockets.
// Configured origins always pass; development also accepts localhost and private-network (LAN) addresses.
const PRIVATE_HOST = /^(localhost|127(\.\d{1,3}){3}|10(\.\d{1,3}){3}|192\.168(\.\d{1,3}){2}|172\.(1[6-9]|2\d|3[01])(\.\d{1,3}){2})$/;

const configuredOrigins = () => [process.env.CLIENT_URL, process.env.CLIENT_URL_LAN, process.env.FRONTEND_URL]
  .flatMap(value => String(value || '').split(','))
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin requests and non-browser clients send no Origin
  if (configuredOrigins().includes(origin)) return true;
  if (process.env.NODE_ENV === 'production') return false;
  try {
    const { protocol, hostname } = new URL(origin);
    return (protocol === 'http:' || protocol === 'https:') && PRIVATE_HOST.test(hostname);
  } catch {
    return false;
  }
}

// Shape expected by both the cors package and socket.io's cors option.
const corsOrigin = (origin, callback) => callback(null, isAllowedOrigin(origin));

module.exports = { isAllowedOrigin, corsOrigin, configuredOrigins };
