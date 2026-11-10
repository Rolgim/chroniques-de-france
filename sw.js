/* Service worker : met l'application en cache pour un usage hors ligne.
   Incrémenter VERSION à chaque mise en ligne pour forcer la mise à jour. */
const VERSION = "chroniques-v1";
const FICHIERS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "css/style.css",
  "js/app.js",
  "js/data/00-core.js",
  "js/data/01-origines.js",
  "js/data/02-rois.js",
  "js/data/03-revolutions.js",
  "js/data/04-contemporain.js",
  "icons/icon.svg",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/maskable-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FICHIERS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Cache d'abord, puis rafraîchissement en arrière-plan. */
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const enCache = await cache.match(req, { ignoreSearch: true });
      const reseau = fetch(req)
        .then((rep) => { if (rep.ok) cache.put(req, rep.clone()); return rep; })
        .catch(() => enCache || cache.match("index.html"));
      return enCache || reseau;
    })
  );
});
