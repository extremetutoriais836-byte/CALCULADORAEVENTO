/* Service worker: rede primeiro, cache como reserva (funciona se a internet cair no evento). */
const CACHE = "pdb-checkin-v3";
const ASSETS = [
  "./",
  "index.html",
  "style.css",
  "app.js",
  "xlsx.full.min.js",
  "logo-papo-de-business.png",
  "favicon.png",
  "orbitron-latin-500-normal.woff2",
  "orbitron-latin-700-normal.woff2",
  "orbitron-latin-800-normal.woff2",
  "orbitron-latin-900-normal.woff2",
  "montserrat-latin-400-normal.woff2",
  "montserrat-latin-500-normal.woff2",
  "montserrat-latin-600-normal.woff2",
  "montserrat-latin-700-normal.woff2"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match("index.html")))
  );
});
