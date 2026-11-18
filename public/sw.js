/**
 * Port Vehicle Tracking System (Peri Tracker) - Progressive Web Application Service Worker
 * Version: v1.0.0
 */

const CACHE_VERSION = "peri-v1.0.0";
const STATIC_CACHE_NAME = `peri-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE_NAME = `peri-dynamic-${CACHE_VERSION}`;

// Pre-cached core static assets for offline functionality
const PRECACHE_ASSETS = [
  "/",
  "/offline",
  "/manifest.webmanifest",
  "/icons/icon-192.svg",
  "/icons/icon-512.svg",
];

// Install Event: Cache essential shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate Event: Safe cache invalidation of previous versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== STATIC_CACHE_NAME && key !== DYNAMIC_CACHE_NAME) {
            console.log("[Service Worker] Removing stale cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch Event: Implement cautious caching strategies
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Never intercept or cache non-GET requests (e.g. POST /api/gps/location)
  if (request.method !== "GET") {
    return;
  }

  // 2. Never intercept Socket.IO polling or WebSockets
  if (url.pathname.startsWith("/socket.io/")) {
    return;
  }

  // 3. Never cache live vehicle locations or live fleet updates as stale data
  if (
    url.pathname.startsWith("/api/vehicles") ||
    url.pathname.startsWith("/api/gps/") ||
    url.pathname.startsWith("/api/duty/") ||
    url.pathname.startsWith("/api/auth/")
  ) {
    // Network-only for live operational data
    event.respondWith(
      fetch(request).catch(() => {
        // Return structured offline response if network unreachable
        return new Response(
          JSON.stringify({ offline: true, error: "Network connection offline" }),
          {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
    return;
  }

  // 4. Cache-First Strategy for static immutable assets (JS, CSS, fonts, SVG icons)
  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Network-First with Offline Fallback for HTML page navigation
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          return response;
        })
        .catch(() => {
          return caches.match("/offline").then((offlinePage) => {
            return offlinePage || caches.match("/");
          });
        })
    );
    return;
  }

  // Default network fetch
  event.respondWith(fetch(request));
});

