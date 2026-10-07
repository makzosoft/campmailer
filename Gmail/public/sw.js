/* CampMailer service worker: keeps the app opening fast (and offline), and shows push notifications. */
const VERSION = 'cm-v7';
const SHELL = ['/', '/manifest.webmanifest', '/brand/icon.svg', '/brand/icon-192.png', '/vendor/read-excel-file.min.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/join/') || url.pathname === '/sw.js') return;   // always live
  if (req.mode === 'navigate') {                                   // the page: newest first, saved copy when offline
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('/', copy)); return res; }).catch(() => caches.match('/')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {                    // pictures and libraries: instant, refreshed in the background
    const net = fetch(req).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});

self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (x) { d = { title: 'CampMailer', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'CampMailer', {
    body: d.body || '', tag: d.tag || undefined, renotify: false,
    icon: '/brand/icon-192.png', badge: '/brand/badge-96.png', vibrate: [70, 40, 70],
    data: { url: d.url || '/' }
  }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    for (const c of list) if ('focus' in c) { c.postMessage({ type: 'open', url }); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
self.addEventListener('pushsubscriptionchange', e => {
  e.waitUntil(self.clients.matchAll({ includeUncontrolled: true }).then(list => list.forEach(c => c.postMessage({ type: 'resubscribe' }))));
});
