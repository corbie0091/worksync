/**
 * WorkSync Service Worker
 * 전략: Cache First (정적 자산) + Network First (API 요청)
 * iOS Safari PWA 완벽 대응
 */

'use strict';

/* ── 버전 관리 ─────────────────────────────────────────────────────── */
const APP_VERSION = 'v1.0.0';
const CACHE_STATIC  = `worksync-static-${APP_VERSION}`;
const CACHE_DYNAMIC = `worksync-dynamic-${APP_VERSION}`;
const CACHE_OFFLINE = `worksync-offline-${APP_VERSION}`;

/* ── 사전 캐시할 정적 자산 목록 ─────────────────────────────────────── */
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

/* ── 오프라인 fallback HTML ─────────────────────────────────────────── */
const OFFLINE_HTML = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
  <meta name="theme-color" content="#0a0f1e"/>
  <title>오프라인 — WorkSync</title>
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
  <div class="icon">📡</div>
  <h1>오프라인 상태</h1>
  <p>인터넷 연결을 확인하고 다시 시도해주세요.<br/>출퇴근 기록은 연결 후 정상 처리됩니다.</p>
  <button onclick="location.reload()">다시 시도</button>
</body>
</html>`;

/* ══════════════════════════════════════════════════════════════════════
   INSTALL — 정적 자산 사전 캐시
══════════════════════════════════════════════════════════════════════ */
self.addEventListener('install', (event) => {
  console.info(`[SW ${APP_VERSION}] install`);
  event.waitUntil(
    (async () => {
      /* 정적 캐시 */
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
        console.warn('[SW] 일부 정적 자산 캐싱 실패 (개발 환경에서는 정상):', e.message);
        // 개발 환경에서 일부 아이콘이 없어도 SW 설치는 계속
        for (const url of STATIC_ASSETS) {
          try { await staticCache.add(url); } catch (_) {}
        }
      }

      /* 즉시 활성화 (대기 없이) */
      await self.skipWaiting();
    })()
  );
});

/* ══════════════════════════════════════════════════════════════════════
   ACTIVATE — 구버전 캐시 정리
══════════════════════════════════════════════════════════════════════ */
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
            console.info('[SW] 구버전 캐시 삭제:', name);
            return caches.delete(name);
          })
      );

      /* 모든 클라이언트 즉시 제어 */
      await self.clients.claim();
    })()
  );
});

/* ══════════════════════════════════════════════════════════════════════
   FETCH — 요청 인터셉트 및 캐싱 전략
══════════════════════════════════════════════════════════════════════ */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  /* ── 1. non-GET 요청은 무조건 네트워크 통과 ── */
  if (request.method !== 'GET') return;

  /* ── 2. Chrome 확장 / blob / data URL 무시 ── */
  if (!url.protocol.startsWith('http')) return;

  /* ── 3. Supabase API → Network First + 오프라인 fallback ── */
  if (url.hostname.endsWith('.supabase.co') || url.pathname.includes('/supabase/')) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  /* ── 4. Google Fonts → Stale While Revalidate ── */
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(staleWhileRevalidate(request, CACHE_DYNAMIC));
    return;
  }

  /* ── 5. CDN 스크립트 (supabase-js 등) → Cache First ── */
  if (url.hostname === 'cdn.jsdelivr.net' || url.hostname.endsWith('.cdn.')) {
    event.respondWith(cacheFirstStrategy(request, CACHE_DYNAMIC));
    return;
  }

  /* ── 6. 앱 정적 자산 → Cache First ── */
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirstStrategy(request, CACHE_STATIC));
    return;
  }

  /* ── 7. 나머지 → Network First ── */
  event.respondWith(networkFirstStrategy(request));
});

/* ── Cache First ── */
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

/* ── Network First ── */
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

/* ── Stale While Revalidate ── */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request).then((response) => {
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);

  return cached || fetchPromise || offlineFallback(request);
}

/* ── 오프라인 fallback ── */
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

  return new Response(JSON.stringify({ error: 'offline', message: '오프라인 상태입니다.' }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ══════════════════════════════════════════════════════════════════════
   MESSAGE — 클라이언트 메시지 수신
══════════════════════════════════════════════════════════════════════ */
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

/* ══════════════════════════════════════════════════════════════════════
   PUSH — 푸시 알림 (선택적, 서버에서 VAPID 키 필요)
══════════════════════════════════════════════════════════════════════ */
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

console.info(`[WorkSync SW ${APP_VERSION}] 로드 완료`);
