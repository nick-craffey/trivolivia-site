'use strict';
// Only static app files belong here. The app separately validates and persists
// the authoritative UTC edition; API requests never enter this cache.
const CACHE = 'trivolivia-app-dd940513d129fac0214c39d9e09b90e37839f166b3eac890642ea4972ce4324a';
const FILES = [".last_build_id","assets/AssetManifest.bin","assets/AssetManifest.bin.json","assets/FontManifest.json","assets/NOTICES","assets/assets/mascots/olivia_caring.webp","assets/assets/mascots/olivia_celebrating.webp","assets/assets/mascots/olivia_coaching.webp","assets/assets/mascots/olivia_daily.webp","assets/assets/mascots/olivia_discovering.webp","assets/assets/mascots/olivia_encouraging.webp","assets/assets/mascots/olivia_ready.webp","assets/assets/mascots/olivia_studying.webp","assets/assets/mascots/olivia_thinking.webp","assets/assets/olivia_avatar.png","assets/assets/olivia_hello.png","assets/content/card_bank_v2/launch_cards.json","assets/content/hidden_threads.json","assets/content/sample_daily_five.json","assets/fonts/MaterialIcons-Regular.otf","assets/shaders/ink_sparkle.frag","assets/shaders/stretch_effect.frag","assets/site/daily-news/2026-08-28.json","assets/site/daily-news/2026-08-29.json","assets/site/daily-news/2026-08-30.json","assets/site/daily-news/2026-08-31.json","assets/site/daily-news/2026-09-01.json","assets/site/daily-news/2026-09-02.json","assets/site/daily-news/2026-09-03.json","assets/site/daily-news/2026-09-04.json","assets/site/daily-news/2026-09-05.json","assets/site/daily-news/2026-09-06.json","assets/site/daily-news/2026-09-07.json","assets/site/daily-news/2026-09-08.json","assets/site/daily-news/2026-09-09.json","assets/site/daily-news/2026-09-10.json","assets/site/daily-news/2026-09-11.json","assets/site/daily-news/2026-09-12.json","assets/site/topic-packs/skateboarding.json","canvaskit/canvaskit.js","canvaskit/canvaskit.wasm","canvaskit/chromium/canvaskit.js","canvaskit/chromium/canvaskit.wasm","favicon.png","flutter.js","flutter_bootstrap.js","icons/Icon-192.png","icons/Icon-512.png","icons/Icon-maskable-192.png","icons/Icon-maskable-512.png","index.html","main.dart.js","manifest.json","version.json"].map(path => new URL(path, self.registration.scope).href);
const INDEX = new URL('index.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(FILES.map(url => new Request(url, {cache: 'reload'})));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('trivolivia-app-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return;
  const url = new URL(request.url);
  url.search = '';
  const key = request.mode === 'navigate' ? INDEX : url.href;
  if (!FILES.includes(key)) return;
  event.respondWith((async () => {
    // Network first keeps a returning player current after a deployment.
    // Immutable build caches provide a coherent fallback during an outage.
    try {
      const response = await fetch(request, {cache: 'no-cache'});
      if (response.ok) return response;
    } catch (_) { /* Use the installed app when offline. */ }
    return (await caches.open(CACHE)).match(key);
  })());
});
