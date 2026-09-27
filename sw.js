// Service worker: makes the page installable and usable offline.
// Bump VERSION whenever the cached files below change shape (old caches are deleted on activate).
const VERSION = "ite-v1";
const SHELL = [
    "./",
    "./index.html",
    "./icons.json",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/apple-touch-icon.png"
];

self.addEventListener("install", event => {
    event.waitUntil(
        caches.open(VERSION)
            // one missing file must not break installation
            .then(cache => Promise.all(SHELL.map(url => cache.add(url).catch(() => { }))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
    );
});

// Page: network first, so students always get the newest group links; the cached copy is the offline fallback
async function networkFirst(request) {
    const cache = await caches.open(VERSION);
    try {
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
    } catch (e) {
        return (await cache.match(request)) || (await cache.match("./index.html")) || Response.error();
    }
}

// Same-origin files: instant from cache, refreshed in the background
async function staleWhileRevalidate(request) {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    const fresh = fetch(request)
        .then(response => { if (response.ok) cache.put(request, response.clone()); return response; })
        .catch(() => cached);
    return cached || fresh;
}

// CDN files (pinned versions, fonts): cache first — they never change
async function cacheFirst(request) {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok || response.type === "opaque") cache.put(request, response.clone());
    return response;
}

self.addEventListener("fetch", event => {
    const { request } = event;
    if (request.method !== "GET") return;
    const url = new URL(request.url);

    // The visitor counter must always hit the server
    if (url.pathname.endsWith("counter.php")) return;

    if (request.mode === "navigate") {
        event.respondWith(networkFirst(request));
    } else if (url.origin === self.location.origin) {
        event.respondWith(staleWhileRevalidate(request));
    } else if (/(^|\.)(cdn\.jsdelivr\.net|fonts\.googleapis\.com|fonts\.gstatic\.com)$/.test(url.hostname)) {
        event.respondWith(cacheFirst(request));
    }
});
