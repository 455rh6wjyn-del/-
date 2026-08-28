const CACHE_NAME = 'coffee-note-v11';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // cache: 'reload' 로 받아야 브라우저 HTTP 캐시에 남은 옛 파일을
    // 그대로 담지 않는다.
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((u) => new Request(u, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // 자금수요조사(/fund-survey/), 네일다이어리(/nail-diary/) 앱은 캐시하지 않는다.
  // 이 서비스워커의 범위가 사이트 전체라, 캐시 우선으로 응답하면
  // 새로 배포한 뒤에도 옛 빌드가 남아 빈 화면이 뜰 수 있다.
  const url = new URL(event.request.url);
  if (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/fund-survey') || url.pathname.startsWith('/nail-diary'))
  )
    return;
  // 페이지 자체(HTML)는 네트워크를 먼저 본다. 캐시를 먼저 돌려주면
  // 새로 배포한 뒤에도 한 번 더 새로고침해야 갱신돼서 헷갈린다.
  // 오프라인일 때만 캐시로 떨어진다.
  const isPage =
    event.request.mode === 'navigate' ||
    (url.origin === self.location.origin && url.pathname.endsWith('/index.html'));
  if (isPage) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
        )
    );
    return;
  }
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
