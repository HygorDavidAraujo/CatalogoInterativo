// ===== SERVICE WORKER BÁSICO =====
const CACHE_NAME = 'davini-vinhos-v7';
const PUSH_STATE_CACHE = 'davini-push-dispositivo';
const urlsToCache = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/mobile-first.css',
  '/js/api.js',
  '/js/auth.js',
  '/js/carrinho.js',
  '/js/config.js',
  '/js/render-seguro.js',
  '/js/precos.js',
  '/js/ficha-vinho.js',
  '/js/destaque.js',
  '/js/pwa.js',
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
          if (cacheName !== CACHE_NAME && cacheName !== PUSH_STATE_CACHE) {
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

  // Retornos financeiros contêm referências de transação; nunca persistir em cache.
  if (new URL(event.request.url).pathname === '/pagamento-retorno.html') {
    event.respondWith(fetch(event.request));
    return;
  }

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

self.addEventListener('message', event => {
  if (event.data?.tipo !== 'PUSH_PREFERENCIA' || typeof event.data.ativo !== 'boolean') return;
  event.waitUntil((async () => {
    const cache = await caches.open(PUSH_STATE_CACHE);
    await cache.put('/__push_preferencia', new Response(JSON.stringify({ ativo: event.data.ativo })));
    if (!event.data.ativo) {
      const notificacoes = await self.registration.getNotifications?.() || [];
      notificacoes.forEach(notificacao => notificacao.close());
    }
  })());
});

async function pushAtivo() {
  const cache = await caches.open(PUSH_STATE_CACHE);
  const resposta = await cache.match('/__push_preferencia');
  return resposta ? (await resposta.json()).ativo === true : false;
}

self.addEventListener('push', event => {
  event.waitUntil((async () => {
    if (!await pushAtivo()) return;
    let dados = {};
    try { dados = event.data?.json() || {}; } catch (_) {}
    const id = Number(dados.pedidoId);
    const valido = Number.isInteger(id) && id > 0 && id <= 2147483647;
    await self.registration.showNotification('Novo pedido recebido', {
      body: 'Abra o painel para consultar os detalhes.', icon: '/images/favicon.svg',
      tag: valido ? `pedido-${id}` : 'novo-pedido',
      data: { url: valido ? `/admin.html?pedido=${id}#pedidos-recebidos` : '/admin.html#pedidos-recebidos' }
    });
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const ativo = await pushAtivo();
    const destino = new URL(ativo ? event.notification.data?.url || '/admin.html' : '/index.html', self.location.origin);
    if (destino.origin !== self.location.origin || !['/admin.html', '/index.html'].includes(destino.pathname)) return;
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const painel = janelas.find(janela => new URL(janela.url).pathname === '/admin.html');
    if (painel) { await painel.navigate(destino.href); return painel.focus(); }
    return self.clients.openWindow(destino.href);
  })());
});
