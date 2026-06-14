// Minimal service worker — enables "Add to Home Screen" on iOS Safari
// No caching: always fetches fresh data from the server
self.addEventListener('install',  () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());
self.addEventListener('fetch',    e  => e.respondWith(fetch(e.request)));
