const CACHE = "entre-nos-shell-v4";
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
  "./assets/mood-view.js",
  "./assets/mood.css",
  "./assets/stickers/cat-apaixonado.svg",
  "./assets/stickers/cat-saudade.svg",
  "./assets/stickers/cat-feliz.svg",
  "./assets/stickers/cat-carente.svg",
  "./assets/stickers/cat-cansado.svg",
  "./assets/stickers/cat-bravo.svg",
  "./assets/stickers/cat-ansioso.svg",
  "./assets/stickers/cat-tranquilo.svg",
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
