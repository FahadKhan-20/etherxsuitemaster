import apiClient from './apiClient';

// Turns this browser's push notifications (join requests, meeting reminders) on or off.
const toKey = (base64) => {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
};

export const pushSupported = () => typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

/** iPhones only allow web push for sites added to the Home Screen. */
export const needsHomeScreen = () => /iPhone|iPad|iPod/.test(navigator.userAgent) && !window.matchMedia('(display-mode: standalone)').matches;

export async function pushEnabled() {
  if (!pushSupported()) return false;
  const registration = await navigator.serviceWorker.getRegistration('/');
  return !!(await registration?.pushManager.getSubscription());
}

export async function enablePush() {
  const { data } = await apiClient.get('/api/push/key');
  if (!data.publicKey) throw new Error('Notifications are not set up on the server yet.');
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your browser settings.');
  const registration = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;
  const subscription = (await registration.pushManager.getSubscription())
    || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(data.publicKey) });
  await apiClient.post('/api/push/subscribe', { subscription: subscription.toJSON() });
}

export async function disablePush() {
  const registration = await navigator.serviceWorker.getRegistration('/');
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await apiClient.post('/api/push/unsubscribe', { endpoint: subscription.endpoint }).catch(() => {});
  await subscription.unsubscribe();
}
