const STATIC_CACHE = "sika-static-v1";
const STATIC_ASSETS = [
  "/manifest.json",
  "/favicon.ico",
  "/apple-touch-icon.png",
  "/icon-192.png",
  "/icon-512.png",
];

function assetRequest(url) {
  return new Request(`${url.origin}${url.pathname}`, {
    cache: "no-store",
    credentials: "omit",
    redirect: "error",
  });
}

function canCache(response, requireImmutable = false) {
  const cacheControl = response.headers.get("cache-control") ?? "";
  return (
    response.ok &&
    response.type === "basic" &&
    !response.redirected &&
    (!requireImmutable || cacheControl.includes("immutable"))
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(async (cache) => {
      await Promise.all(
        STATIC_ASSETS.map(async (path) => {
          const request = assetRequest(new URL(path, self.location.origin));
          const response = await fetch(request);
          if (!canCache(response)) throw new Error(`Failed to cache ${path}`);
          await cache.put(request.url, response);
        }),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("sika-static-") && key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function offlineResponse() {
  return new Response(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="theme-color" content="#0B0B0D">
    <title>You're offline | Sika</title>
    <style>
      :root { color-scheme: dark; font-family: system-ui, sans-serif; }
      * { box-sizing: border-box; }
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #0B0B0D; color: #F5F4F0; }
      main { width: min(100%, 420px); }
      .mark { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; background: #2B6BF3; color: white; font-size: 24px; font-weight: 700; }
      h1 { margin: 28px 0 10px; font-size: clamp(2rem, 8vw, 3rem); line-height: 1; letter-spacing: -0.04em; }
      p { margin: 0; color: #A9A7A1; font-size: 1rem; line-height: 1.6; }
      button { margin-top: 28px; min-height: 44px; border: 0; border-radius: 12px; padding: 0 20px; background: #F5F4F0; color: #0B0B0D; font: inherit; font-weight: 650; cursor: pointer; }
      button:focus-visible { outline: 3px solid #73A0FF; outline-offset: 3px; }
    </style>
  </head>
  <body>
    <main>
      <div class="mark" aria-hidden="true">S</div>
      <h1>You're offline</h1>
      <p>Sika needs a connection to load your financial data. Reconnect, then try again.</p>
      <form method="get"><button type="submit">Try again</button></form>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

async function immutableAssetResponse(url) {
  const cache = await caches.open(STATIC_CACHE);
  const request = assetRequest(url);
  const cached = await cache.match(request.url);
  if (cached) return cached;

  const response = await fetch(request);
  if (canCache(response, true)) {
    try {
      await cache.put(request.url, response.clone());
    } catch {
      // A full or unavailable cache must not break a successful network response.
    }
  }
  return response;
}

async function publicAssetResponse(url) {
  const cache = await caches.open(STATIC_CACHE);
  const request = assetRequest(url);
  let response;

  try {
    response = await fetch(request);
  } catch (error) {
    const cached = await cache.match(request.url);
    if (cached) return cached;
    throw error;
  }

  if (canCache(response)) {
    try {
      await cache.put(request.url, response.clone());
    } catch {
      // Revalidation succeeded; stale cache state must not replace fresh content.
    }
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() => offlineResponse()),
    );
    return;
  }

  if (url.search) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(immutableAssetResponse(url));
    return;
  }

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(publicAssetResponse(url));
  }
});
