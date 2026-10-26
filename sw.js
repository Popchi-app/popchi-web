// Keeps Popchi's own files on the phone so it opens fast and works offline.
// Only this site's files are cached; nothing the person types is ever stored or sent.
const VERSION = 'popchi-v6';
const SHELL = ['./', 'index.html', 'app.css', 'credits.html', 'manifest.webmanifest',
  'js/app.js', 'js/engine.js', 'js/render.js', 'js/meaning.js', 'js/splitter.js', 'js/gif.js', 'js/season.js',
  'assets/poses.json', 'assets/props.json', 'assets/heads.json', 'assets/fonts/baloo2_xbold.ttf',
  'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // heavy files that never change in place (art, models, runtime, font, icons): saved copy first
  const heavy = /\/(assets\/(poses|props|models|fonts)|vendor|icons)\//.test(url.pathname);
  if (heavy) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(VERSION).then((c) => c.put(req, copy));
      }
      return res;
    })));
    return;
  }
  // pages, code and word lists: network first so updates show up, saved copy when offline
  e.respondWith(fetch(req).then((res) => {
    if (res.ok && res.type === 'basic') {
      const copy = res.clone();
      caches.open(VERSION).then((c) => c.put(req, copy));
    }
    return res;
  }).catch(() => caches.match(req).then((r) => r || (req.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
