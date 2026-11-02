const CACHE = "entre-nos-shell-v3";
const ASSETS = [
  "./",
  "./index.html",
  "./assets/styles.css",
  "./assets/layout.css",
  "./assets/login.css",
  "./assets/auth-config.js",
  "./assets/auth.js",
  "./assets/app.js",
  "./assets/catalog.js",
  "./assets/utils.js",
  "./assets/media.js",
  "./assets/icon.svg",
  "./manifest.webmanifest",
];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((k) =>
        Promise.all(
          k
            .filter((x) => x.startsWith("entre-nos-shell-") && x !== CACHE)
            .map((x) => caches.delete(x)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (
    e.request.method !== "GET" ||
    new URL(e.request.url).origin !== self.location.origin
  )
    return;
  e.respondWith(
    fetch(e.request)
      .then((r) => {
        if (r.ok) {
          const copy = r.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copy));
        }
        return r;
      })
      .catch(() => caches.match(e.request)),
  );
});
