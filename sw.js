// ═══════════════════════════════════════════════════════
// PROMPT FORGE — Service Worker
// Bump CACHE_VERSION when you deploy changes
// ═══════════════════════════════════════════════════════
const CACHE_VERSION = "v3";
const CACHE_NAME = `prompt-forge-${CACHE_VERSION}`;
const FONT_CACHE = `prompt-forge-fonts-${CACHE_VERSION}`;

// Core app shell — cached on install, served offline
const PRECACHE_URLS = [
  "/prompt/",
  "/prompt/index.html",
  "/prompt/manifest.json",
  "https://maximumreality.github.io/prompt/prompt-forge-favicon.PNG",
];

// ───────────────────────────────────────────────────────
// INSTALL — precache app shell, skip waiting so new SW
// activates immediately without user needing to close tab
// ───────────────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// ───────────────────────────────────────────────────────
// ACTIVATE — delete all old caches from previous versions
// so stale assets don't linger after a deploy
// ───────────────────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith("prompt-forge-") && key !== CACHE_NAME && key !== FONT_CACHE)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// ───────────────────────────────────────────────────────
// FETCH — three strategies depending on request type
// ───────────────────────────────────────────────────────
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // 1. GOOGLE FONTS — stale-while-revalidate
  //    Serve cached version instantly, update in background
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(staleWhileRevalidate(event.request, FONT_CACHE));
    return;
  }

  // 2. PUTER SDK & other external scripts — network-first
  //    Try network, fall back to cache if offline
  if (url.hostname !== "maximumreality.github.io" && url.hostname !== self.location.hostname) {
    event.respondWith(networkFirst(event.request, CACHE_NAME));
    return;
  }

  // 3. OWN ASSETS (app shell, favicon, etc.) — cache-first
  //    Serve from cache instantly, fall back to network
  event.respondWith(cacheFirst(event.request, CACHE_NAME));
});

// ═══════════════════════════════════════════════════════
// STRATEGIES
// ═══════════════════════════════════════════════════════

// Cache-first: great for app shell assets that rarely change
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("Offline — Prompt Forge unavailable", {
      status: 503,
      headers: { "Content-Type": "text/plain" }
    });
  }
}

// Network-first: good for external APIs / SDKs that update
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || new Response("Offline", { status: 503 });
  }
}

// Stale-while-revalidate: serve cache instantly, refresh in background
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || await networkFetch;
}
