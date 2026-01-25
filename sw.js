// ===== SERVICE WORKER BÁSICO =====
const CACHE_NAME = 'davini-vinhos-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/mobile-first.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/carrinho.js',
  '/js/config.js',
  '/js/mobile.js',
  '/images/favicon.svg'
];

// Instalar Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cache aberto');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

// Ativar Service Worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Removendo cache antigo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch - Estratégia: Network First com fallback seguro de cache
self.addEventListener('fetch', (event) => {
  // Apenas cachear GET requests
  if (event.request.method !== 'GET') return;

  // Não interceptar API
  if (event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Não interceptar requests de terceiros (CDNs, imagens externas)
  try {
    const reqUrl = new URL(event.request.url);
    const origin = reqUrl.origin;
    if (origin !== self.location.origin) {
      event.respondWith(fetch(event.request));
      return;
    }
  } catch (_) {
    // Se URL inválida, segue fluxo padrão
  }

  event.respondWith((async () => {
    try {
      const networkResponse = await fetch(event.request);
      // Cache apenas respostas válidas
      if (networkResponse && networkResponse.status === 200) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkResponse.clone());
      }
      return networkResponse;
    } catch (err) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      // Fallback explícito para evitar "Failed to convert value to 'Response'"
      return new Response('Offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

// Background Sync (para pedidos offline)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-pedidos') {
    event.waitUntil(syncPedidos());
  }
});

async function syncPedidos() {
  // Implementar sincronização de pedidos offline
  console.log('🔄 Sincronizando pedidos...');
}
