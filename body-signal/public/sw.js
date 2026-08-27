/**
 * Body Signal 서비스워커.
 *
 * vite 가 파일 이름에 해시를 붙이므로 목록을 박아두지 않고 런타임에 캐시한다.
 *  - 페이지 이동: 네트워크 우선 → 실패하면 캐시된 index.html (오프라인에서도 앱이 뜬다)
 *  - assets/ 아래 해시 파일: 캐시 우선 (이름이 바뀌면 새로 받는다)
 *  - 그 밖의 같은 출처 파일 · 폰트 CDN: 캐시 우선 + 뒤에서 갱신
 */
const VERSION = "body-signal-v1";
const SHELL = `${VERSION}-shell`;
const RUNTIME = `${VERSION}-runtime`;

const SHELL_FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

const FONT_HOSTS = ["cdn.jsdelivr.net"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // 하나라도 실패하면 설치 전체가 실패하므로 각각 따로 넣는다.
      Promise.all(SHELL_FILES.map((f) => cache.add(f).catch(() => {})))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

const cacheFirst = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && (res.status === 200 || res.type === "opaque")) cache.put(request, res.clone());
  return res;
};

const staleWhileRevalidate = async (request, cacheName) => {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const fresh = fetch(request)
    .then((res) => {
      if (res && res.status === 200) cache.put(request, res.clone());
      return res;
    })
    .catch(() => hit);
  return hit || fresh;
};

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL);
        return (await cache.match("./index.html")) || (await cache.match("./")) || Response.error();
      })
    );
    return;
  }

  if (sameOrigin && url.pathname.includes("/assets/")) {
    event.respondWith(cacheFirst(request, RUNTIME));
    return;
  }

  if (sameOrigin) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME));
    return;
  }

  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request, RUNTIME));
  }
});
