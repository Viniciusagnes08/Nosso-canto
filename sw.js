// Retire the old offline cache. Login and imported personal data are network-only.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys())
        if (key.startsWith("entre-nos-shell-")) await caches.delete(key);
      await self.clients.claim();
      await self.registration.unregister();
    })(),
  ),
);
