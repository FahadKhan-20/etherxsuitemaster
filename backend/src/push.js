// Web Push to users' phones and desktops (works while EtherX Meet is closed). Needs VAPID_PUBLIC_KEY,
// VAPID_PRIVATE_KEY and VAPID_SUBJECT; without them sending is skipped.
const { isConnected, isId } = require('./config/db');

let configured = null;
function webPush() {
  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return null;
  if (!configured) {
    configured = require('web-push');
    configured.setVapidDetails(VAPID_SUBJECT || 'mailto:support@etherxmeet.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  }
  return configured;
}

const publicKey = () => process.env.VAPID_PUBLIC_KEY || null;

/** Sends { title, body, url, tag } to every device of these users; drops subscriptions the browser revoked. */
async function notifyUsers(userIds, message) {
  const push = webPush();
  const ids = [...new Set(userIds.map(String))].filter(isId);
  if (!push || !ids.length || !isConnected()) return 0;
  const PushSubscription = require('./models/PushSubscription');
  const subscriptions = await PushSubscription.forUsers(ids);
  const payload = JSON.stringify(message);
  const results = await Promise.all(subscriptions.map(async sub => {
    try {
      await push.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload, { TTL: 300 });
      return 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) await PushSubscription.remove(sub.endpoint).catch(() => {});
      else console.error('Push failed:', error.statusCode || '', error.body || error.message);
      return 0;
    }
  }));
  return results.reduce((a, b) => a + b, 0);
}

module.exports = { notifyUsers, publicKey };
