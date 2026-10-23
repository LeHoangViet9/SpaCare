/* No page/API caching: never retain authenticated workspace responses offline. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data;
  try { data = event.data.json(); } catch { return; }
  event.waitUntil(self.registration.showNotification(data.title || 'SpaCare', {
    body: data.body, tag: data.tag || 'spacare', icon: '/icons/spacare-192.png',
    data: { url: data.url },
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/workspace', self.location.origin);
  if (url.origin !== self.location.origin || !url.pathname.startsWith('/workspace')) return;
  event.waitUntil(self.clients.openWindow(url.href));
});
