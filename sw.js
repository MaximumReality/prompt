const CACHE_NAME = "prompt-forge-v1";

const urlsToCache = [
  "/prompt/",
  "/prompt/index.html",
  "https://maximumreality.github.io/prompt/prompt-forge-favicon.PNG"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(response => {
      return response || fetch(e.request);
    })
  );
});
