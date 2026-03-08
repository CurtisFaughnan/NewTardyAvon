const CACHE_NAME = "lanyard-shell-v11";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./brownsburg-high-lanyards.html",
  "./brownsburg-high-tardies.html",
  "./styles.css?v=20260308i",
  "./app.js?v=20260308i",
  "./manifest.webmanifest?v=20260308i",
  "./manifest-brownsburg-high-lanyards.webmanifest?v=20260308i",
  "./manifest-brownsburg-high-tardies.webmanifest?v=20260308i",
  "./assets/Avon_Crest.png",
  "./assets/Brownsburg_Bulldog.webp",
  "./vendor/html5-qrcode.min.js?v=20260308i"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(event.request.url);
  const isNavigation = event.request.mode === "navigate";
  const isShellAsset = requestUrl.origin === self.location.origin && (requestUrl.pathname.endsWith("/") || requestUrl.pathname.endsWith("/index.html"));

  if (isNavigation || isShellAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy)).catch(() => {});
          return response;
        })
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
