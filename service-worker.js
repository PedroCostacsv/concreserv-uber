// ============================================================
// SERVICE WORKER — Central Uber Concreserv
// Versão: 1.0.0
// ============================================================
// Responsabilidades:
//   1. Cache de assets para funcionamento offline
//   2. Receber notificações push do backend
//   3. Abrir o app ao clicar na notificação
// ============================================================

const CACHE_NAME = 'concreserv-v1';

// Assets que serão cacheados para uso offline
const ASSETS_TO_CACHE = [
  '/concreserv-uber/',
  '/concreserv-uber/index.html',
  '/concreserv-uber/manifest.json',
  '/concreserv-uber/icons/icon-192.png',
  '/concreserv-uber/icons/icon-512.png',
];

// ── Instalação: cacheia os assets essenciais ──────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando assets...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Ativa imediatamente sem esperar o reload
  self.skipWaiting();
});

// ── Ativação: limpa caches antigos ───────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log('[SW] Removendo cache antigo:', key);
            return caches.delete(key);
          })
      )
    )
  );
  // Assume controle de todas as abas abertas imediatamente
  self.clients.claim();
});

// ── Fetch: serve do cache, com fallback na rede ───────────────
self.addEventListener('fetch', event => {
  // Ignora requisições da API — sempre vai na rede
  if (event.request.url.includes('/api/') ||
      event.request.url.includes('supabase') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cacheia páginas HTML para uso offline
        if (response.ok && event.request.destination === 'document') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback: serve o index.html cacheado
      if (event.request.destination === 'document') {
        return caches.match('/concreserv-uber/index.html');
      }
    })
  );
});

// ── Push: recebe notificação do backend ───────────────────────
self.addEventListener('push', event => {
  let data = {
    title: 'Central Concreserv',
    body: 'Você tem uma atualização.',
    icon: '/concreserv-uber/icons/icon-192.png',
    badge: '/concreserv-uber/icons/icon-192.png',
    tag: 'concreserv-update',
    url: '/concreserv-uber/',
  };

  // O backend envia um JSON com { title, body, url, tag }
  if (event.data) {
    try {
      const payload = event.data.json();
      data = { ...data, ...payload };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,           // agrupa notificações do mesmo tipo
      renotify: true,          // vibra mesmo se já existe uma com a mesma tag
      requireInteraction: false,
      data: { url: data.url },
      // Ações opcionais (aparecem embaixo da notificação no Android)
      actions: [
        { action: 'open', title: 'Ver corrida' },
        { action: 'close', title: 'Fechar' },
      ],
    })
  );
});

// ── Clique na notificação: abre o app ────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/concreserv-uber/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Se o app já está aberto, foca nele
      for (const client of clientList) {
        if (client.url.includes('concreserv-uber') && 'focus' in client) {
          return client.focus();
        }
      }
      // Caso contrário, abre uma nova aba
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
