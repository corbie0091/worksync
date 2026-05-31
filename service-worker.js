/**
 * WorkSync Service Worker
 * ?„ëµ: Cache First (?•ì  ?ì‚°) + Network First (API ?”ì²­)
 * iOS Safari PWA ?„ë²½ ?€?? */

'use strict';

/* ?€?€ ë²„ì „ ê´€ë¦??€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
const APP_VERSION = 'v~0,4dt:~4,2dt:~6,2dt:~8,4';
const CACHE_STATIC  = `worksync-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `worksync-dynamic-${APP_VERSION}`;
const CACHE_OFFLINE = `worksync-offline-${APP_VERSION}`;

/* ?€?€ ?¬ì „ ìºì‹œ???•ì  ?ì‚° ëª©ë¡ ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
const STATIC_ASSETS = [
  './',
  './index.html',
  './login.html',
  './worker.html',
  './admin.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

/* ?€?€ ?¤í”„?¼ì¸ fallback HTML ?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€?€ */
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="theme-color" content="#0a0f1e"/>
  <title>?¤í”„?¼ì¸ ??WorkSync</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{
      min-height:100dvh;display:flex;flex-direction:column;
      align-items:center;justify-content:center;gap:1.5rem;
      background:#080d1a;color:#f1f5f9;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
      padding:2rem;text-align:center;
    }
    .icon{font-size:3rem}
    h1{font-size:1.5rem;font-weight:700;letter-spacing:-0.02em}
    p{color:#94a3b8;font-size:0.95rem;max-width:280px;line-height:1.6}
    button{
      padding:0.875rem 1.75rem;
      background:linear-gradient(135deg,#63b3ed,#38bdf8);
      border:none;border-radius:12px;
      color:#fff;font-size:1rem;font-weight:600;cursor:pointer;
      margin-top:0.5rem;
    }
  </style>
</head>
<body>
  <div class="icon">?“¡</div>
  <h1>?¤í”„?¼ì¸ ?íƒœ</h1>
  <p>?¸í„°???°ê²°???•ì¸?˜ê³  ?¤ì‹œ ?œë„?´ì£¼?¸ìš”.<br/>ì¶œí‡´ê·?ê¸°ë¡?€ ?°ê²° ???•ìƒ ì²˜ë¦¬?©ë‹ˆ??</p>
  <button onclick="location.reload()">?¤ì‹œ ?œë„</button>
</body>
</html>`;

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
   INSTALL ???•ì  ?ì‚° ?¬ì „ ìºì‹œ
?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
self.addEventListener('install', (event) => {
  console.info(`[SW ${APP_VERSION}] install`);
  event.waitUntil(
    (async () => {
      /* ?•ì  ìºì‹œ */
      const staticCache  = await caches.open(CACHE_STATIC);
      const offlineCache = await caches.open(CACHE_OFFLINE);

      await offlineCache.put(
        new Request('./offline.html'),
        new Response(OFFLINE_HTML, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })
      );

      try {
        await staticCache.addAll(STATIC_ASSETS);
      } catch (e) {
        console.warn('[SW] ?¼ë? ?•ì  ?ì‚° ìºì‹± ?¤íŒ¨ (ê°œë°œ ?˜ê²½?ì„œ???•ìƒ):', e.message);
        // ê°œë°œ ?˜ê²½?ì„œ ?¼ë? ?„ì´ì½˜ì´ ?†ì–´??SW ?¤ì¹˜??ê³„ì†
        for (const url of STATIC_ASSETS) {
          try { await staticCache.add(url); } catch (_) {}
        }
      }

      /* ì¦‰ì‹œ ?œì„±??(?€ê¸??†ì´) */
      await self.skipWaiting();
    })()
  );
});

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
   ACTIVATE ??êµ¬ë²„??ìºì‹œ ?•ë¦¬
?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
self.addEventListener('activate', (event) => {
  console.info(`[SW ${APP_VERSION}] activate`);
  event.waitUntil(
    (async () => {
      const validCaches = new Set([CACHE_STATIC, CACHE_DYNAMIC, CACHE_OFFLINE]);
      const allCaches   = await caches.keys();

      await Promise.all(
        allCaches
          .filter((name) => !validCaches.has(name) && name.startsWith('worksync-'))
          .map((name)  => {
            console.info('[SW] êµ¬ë²„??ìºì‹œ ?? œ:', name);
            return caches.delete(name);
          })
      );

      /* ëª¨ë“  ?´ë¼?´ì–¸??ì¦‰ì‹œ ?œì–´ */
      await self.clients.claim();
    })()
  );
});

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
   FETCH ???”ì²­ ?¸í„°?‰íŠ¸ ë°?ìºì‹± ?„ëµ
?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* ?€?€ 1. non-GET ?”ì²­?€ ë¬´ì¡°ê±??¤íŠ¸?Œí¬ ?µê³¼ ?€?€ */
  if (request.method !== 'GET') return;

  /* ?€?€ 2. Chrome ?•ì¥ / blob / data URL ë¬´ì‹œ ?€?€ */
  if (!url.protocol.startsWith('http')) return;

  /* ?€?€ 3. Supabase API ??Network First + ?¤í”„?¼ì¸ fallback ?€?€ */
  if (url.hostname.endsWith('.supabase.co') || url.pathname.includes('/supabase/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  /* ?€?€ 4. Google Fonts ??Stale While Revalidate ?€?€ */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, CACHE_DYNAMIC));
    return;
  }

  /* ?€?€ 5. CDN ?¤í¬ë¦½íŠ¸ (supabase-js ?? ??Cache First ?€?€ */
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('.cdn.')) {
    event.respondWith(cacheFirstStrategy(request, CACHE_DYNAMIC));
    return;
  }

    /* ?€?€ 6. HTML ??Network First (??ƒ ìµœì‹  ë²„ì „) ?€?€ */
  if (url.origin === self.location.origin && request.destination === 'document') {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  /* ?€?€ 7. CSS/JS/?´ë?ì§€ ??Cache First ?€?€ */
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstStrategy(request, CACHE_STATIC));
    return;
  }

  /* ?€?€ 7. ?˜ë¨¸ì§€ ??Network First ?€?€ */
  event.respondWith(networkFirstStrategy(request));
});

/* ?€?€ Cache First ?€?€ */
async function cacheFirstStrategy(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (e) {
    return offlineFallback(request);
  }
}

/* ?€?€ Network First ?€?€ */
async function networkFirstStrategy(request) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(8000) });
    if (response.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch (e) {
    const cache  = await caches.open(CACHE_DYNAMIC);
    const cached = await cache.match(request);
    if (cached) return cached;
    return offlineFallback(request);
  }
}

/* ?€?€ Stale While Revalidate ?€?€ */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);

  return cached || fetchPromise || offlineFallback(request);
}

/* ?€?€ ?¤í”„?¼ì¸ fallback ?€?€ */
async function offlineFallback(request) {
  const url    = new URL(request.url);
  const isHTML = request.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('.html') ||
                 url.pathname === '/';

  if (isHTML) {
    const offlineCache = await caches.open(CACHE_OFFLINE);
    const offline = await offlineCache.match('./offline.html');
    if (offline) return offline;

    return new Response(OFFLINE_HTML, {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return new Response(JSON.stringify({ error: 'offline', message: '?¤í”„?¼ì¸ ?íƒœ?…ë‹ˆ??' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
   MESSAGE ???´ë¼?´ì–¸??ë©”ì‹œì§€ ?˜ì‹ 
?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
self.addEventListener('message', (event) => {
  if (!event.data) return;

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'GET_VERSION':
      event.ports?.[0]?.postMessage({ version: APP_VERSION });
      break;

    case 'CLEAR_CACHE':
      caches.keys().then((keys) =>
        Promise.all(keys.filter(k => k.startsWith('worksync-')).map(k => caches.delete(k)))
      ).then(() => {
        event.ports?.[0]?.postMessage({ ok: true });
      });
      break;

    default:
      break;
  }
});

/* ?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•
   PUSH ???¸ì‹œ ?Œë¦¼ (? íƒ?? ?œë²„?ì„œ VAPID ???„ìš”)
?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â•?â• */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try { payload = event.data.json(); }
  catch { payload = { title: 'WorkSync', body: event.data.text() }; }

  const options = {
    body:    payload.body    || '',
    icon:    './icons/icon-192.png',
    badge:   './icons/icon-72.png',
    tag:     payload.tag     || 'worksync-notification',
    data:    payload.data    || {},
    vibrate: [100, 50, 100],
    requireInteraction: payload.requireInteraction || false,
    actions: payload.actions || [],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || 'WorkSync', options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './index.html';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

console.info(`[WorkSync SW ${APP_VERSION}] ë¡œë“œ ?„ë£Œ`);
