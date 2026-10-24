// VaultDocAI service worker. It makes the site installable as an app and shows a friendly page
// when there's no internet. It never stores your files, documents or account data: everything
// else (pages, Firebase, file downloads) always comes straight from the network.
const CACHE = "vaultdoc-offline-v2";
const OFFLINE_URL = "/offline.html";
const OFFLINE_FILES = [OFFLINE_URL, "/icons/icon-192.png"]; // the offline page and its picture

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(OFFLINE_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Page loads: try the network, and if it fails, show the offline page.
// The offline page's own picture: the network, or the saved copy when offline. Nothing else is touched.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  } else if (request.method === "GET" && OFFLINE_FILES.includes(new URL(request.url).pathname)) {
    event.respondWith(fetch(request).catch(() => caches.match(request.url)));
  }
});
