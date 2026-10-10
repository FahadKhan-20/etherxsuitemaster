// Shows EtherX Meet push notifications (join requests, meeting reminders) and opens the meeting on tap.
self.addEventListener('push', (event) => {
  let message = {};
  try { message = event.data ? event.data.json() : {}; } catch { message = { title: event.data?.text() }; }
  event.waitUntil(self.registration.showNotification(message.title || 'EtherX Meet', {
    body: message.body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    tag: message.tag,
    data: { url: message.url || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = tabs.find((tab) => tab.url === url) || tabs.find((tab) => new URL(tab.url).origin === self.location.origin);
    if (open) { await open.focus(); if (open.url !== url && 'navigate' in open) await open.navigate(url); return; }
    await self.clients.openWindow(url);
  })());
});
