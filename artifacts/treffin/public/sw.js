// Treffin service worker
// v3: network-first navigation fixes blank-page-after-install bug where stale
// cached HTML referenced old (now-404) hashed JS files after a new deploy.

const STATIC_CACHE  = "treffin-static-v4";
const DYNAMIC_CACHE = "treffin-dynamic-v4";

// Minimal shell pre-cached on install
const PRECACHE = ["/", "/manifest.json", "/treffin-mark.png"];

// ── Install ──────────────────────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, DYNAMIC_CACHE]);
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(async () => {
        // Tell every open tab a new version is live
        const clients = await self.clients.matchAll({ type: "window" });
        clients.forEach((c) => c.postMessage({ type: "SW_UPDATED" }));
      })
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin GET requests
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  // ① API — network-only, offline JSON error (never cache API responses)
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ error: "You are offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        })
      )
    );
    return;
  }

  // ② Hashed static assets (/assets/…) — cache-first (content-hashed, immutable)
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(request).then((hit) => {
        if (hit) return hit;
        return fetch(request).then(async (res) => {
          if (res.ok) {
            const responseForCache = res.clone();
            const cache = await caches.open(STATIC_CACHE);
            await cache.put(request, responseForCache);
          }
          return res;
        });
      })
    );
    return;
  }

  // ③ HTML navigation — network-first so a new deploy's HTML always loads.
  //    Falls back to the cached shell when offline to avoid the blank-page bug.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (res) => {
          if (res.ok) {
            const responseForCache = res.clone();
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put(request, responseForCache);
          }
          return res;
        })
        .catch(async () => {
          const hit = await caches.match(request) ?? await caches.match("/");
          return hit ?? new Response(
            "<!doctype html><title>Offline</title><p>Please reconnect to the internet.</p>",
            { status: 503, headers: { "Content-Type": "text/html" } }
          );
        })
    );
    return;
  }

  // ④ Everything else (images, fonts, etc.) — cache-first with network fallback
  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then(async (res) => {
          if (res.ok) {
            const responseForCache = res.clone();
            const cache = await caches.open(DYNAMIC_CACHE);
            await cache.put(request, responseForCache);
          }
          return res;
        })
        .catch(() => new Response("", { status: 503 }));
    })
  );
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Treffin", {
      body: data.body ?? "You have a new notification.",
      icon: "/treffin-mark.png",
      badge: "/treffin-mark.png",
      tag: data.tag ?? "treffin",
      renotify: true,
      data: { url: data.url ?? "/" },
    })
  );
});

// ── Notification click ────────────────────────────────────────────────────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => "focus" in c);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
