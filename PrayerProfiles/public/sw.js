// Service worker — enables "Add to Home Screen" + Web Push reminders
// No fetch caching: always serves fresh data from the server
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch',    e  => e.respondWith(fetch(e.request)));

self.addEventListener('push', e => {
  let data = {};
  try { data = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(data.title || 'Prayer Profiles', {
    body:  data.body || 'You have a prayer reminder.',
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    data:  { url: data.url || '/' },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const client of list) {
      if ('focus' in client) {
        client.focus();
        if ('navigate' in client) return client.navigate(url);
        return;
      }
    }
    return clients.openWindow(url);
  }));
});
