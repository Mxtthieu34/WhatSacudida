// sw.js - Notificaciones y cache offline de Sacudida
const CACHE_NAME = 'sacudida-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then(g => g || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const network = fetch(request)
        .then(response => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { body: event.data.text() }; }

  const options = {
    body: data.body || '',
    icon: data.icon || './icon.svg',
    badge: data.badge || './icon.svg',
    tag: data.tag || 'sacudida-notif',
    renotify: true,
    data: { url: data.url || './', type: data.type, callId: data.callId },
    requireInteraction: data.type === 'call'
  };
  if (data.type === 'call') {
    options.actions = [{ action: 'open', title: '📞 Abrir para responder' }];
  }
  event.waitUntil(self.registration.showNotification(data.title || 'Sacudida', options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const d = event.notification.data || {};
  const targetUrl = typeof d === 'string' ? d : (d.url || './');

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url && 'focus' in client) {
          return client.focus().then(() => {
            if ('navigate' in client && targetUrl) return client.navigate(targetUrl);
          });
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});