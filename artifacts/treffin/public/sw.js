// Treffin installed-app service worker.
const STATIC_CACHE = "treffin-static-v5";
const DYNAMIC_CACHE = "treffin-dynamic-v5";
const CACHE_PREFIX = "treffin-";
const MAX_DYNAMIC_ENTRIES = 100;
const APP_ROOT = new URL("./", self.registration.scope);
const BUILD_MANIFEST_URL = new URL("asset-manifest.json", APP_ROOT);
const ASSET_PATH = new URL("assets/", APP_ROOT).pathname;

const appUrl = (path = "") => new URL(String(path).replace(/^\/+/, ""), APP_ROOT).href;
const CORE_FILES = [
  appUrl(),
  appUrl("manifest.json"),
  appUrl("pwa-icon-192.png"),
  appUrl("pwa-icon-512.png"),
  appUrl("pwa-maskable-512.png"),
];

async function precacheApplication() {
  const cache = await caches.open(STATIC_CACHE);
  await Promise.allSettled(CORE_FILES.map((url) => cache.add(url)));

  // Vite emits this build manifest. Cache every entry, CSS file, image, and
  // lazy route chunk so a first installed-app launch also works offline.
  try {
    const response = await fetch(BUILD_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) return;
    const manifest = await response.json();
    const files = new Set();
    Object.values(manifest).forEach((entry) => {
      if (!entry || typeof entry !== "object") return;
      [entry.file, ...(entry.css ?? []), ...(entry.assets ?? [])]
        .filter((file) => typeof file === "string")
        .forEach((file) => files.add(appUrl(file)));
    });
    await Promise.allSettled([...files].map((url) => cache.add(url)));
  } catch {
    // Core shell caching still provides a readable offline fallback.
  }
}

async function trimCache(name, maximum) {
  const cache = await caches.open(name);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - maximum)).map((key) => cache.delete(key)));
}

self.addEventListener("install", (event) => {
  event.waitUntil(precacheApplication().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const obsolete = keys.filter((key) => key.startsWith(CACHE_PREFIX) && key !== STATIC_CACHE && key !== DYNAMIC_CACHE);
    await Promise.all(obsolete.map((key) => caches.delete(key)));
    await self.clients.claim();

    // Do not show an "update ready" banner on a device's first installation.
    if (obsolete.length > 0) {
      const windows = await self.clients.matchAll({ type: "window" });
      windows.forEach((client) => client.postMessage({ type: "SW_UPDATED" }));
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (url.pathname.startsWith(`${APP_ROOT.pathname}api/`)) {
    event.respondWith(fetch(request).catch(() => new Response(
      JSON.stringify({ error: "You are offline" }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )));
    return;
  }

  if (url.pathname.startsWith(ASSET_PATH)) {
    event.respondWith(caches.match(request, { ignoreVary: true }).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(STATIC_CACHE);
        await cache.put(request, response.clone());
      }
      return response;
    }));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, response.clone());
        await trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
      }
      return response;
    }).catch(async () => {
      return await caches.match(request, { ignoreVary: true })
        ?? await caches.match(appUrl(), { ignoreVary: true })
        ?? new Response(
          "<!doctype html><meta name=viewport content='width=device-width'><title>Treffin offline</title><p>Treffin is offline. Please reconnect and try again.</p>",
          { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
        );
    }));
    return;
  }

  event.respondWith(caches.match(request, { ignoreVary: true }).then(async (cached) => {
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(DYNAMIC_CACHE);
        await cache.put(request, response.clone());
        await trimCache(DYNAMIC_CACHE, MAX_DYNAMIC_ENTRIES);
      }
      return response;
    } catch {
      return new Response("", { status: 503 });
    }
  }));
});

function safeNotificationUrl(value) {
  try {
    const target = new URL(typeof value === "string" ? value : "", APP_ROOT);
    if (target.origin !== self.location.origin || !target.pathname.startsWith(APP_ROOT.pathname)) {
      return appUrl();
    }
    return target.href;
  } catch {
    return appUrl();
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data = { body: event.data.text() };
    }
  }

  const tag = typeof data.tag === "string" && data.tag
    ? data.tag
    : `treffin-${Date.now()}`;
  event.waitUntil(self.registration.showNotification(
    typeof data.title === "string" ? data.title : "Treffin",
    {
      body: typeof data.body === "string" ? data.body : "You have a new notification.",
      icon: appUrl("pwa-icon-192.png"),
      badge: appUrl("pwa-icon-192.png"),
      tag,
      renotify: true,
      data: { url: safeNotificationUrl(data.url) },
    },
  ));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = safeNotificationUrl(event.notification.data?.url);
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => client.url === target) ?? windows[0];
    if (existing) {
      try {
        await existing.navigate(target);
        return await existing.focus();
      } catch {
        // Fall through and open a fresh app window.
      }
    }
    return self.clients.openWindow(target);
  })());
});