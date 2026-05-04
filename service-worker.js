// ============================================================
// SERVICE WORKER — Central Uber Concreserv
// Versão: 1.1.0  ← bumped para forçar atualização nos clientes
// ============================================================

const CACHE_NAME = 'concreserv-v2'; // ← versão nova apaga o cache antigo

const ASSETS_TO_CACHE = [
  '/concreserv-uber/',
  '/concreserv-uber/index.html',
  '/concreserv-uber/manifest.json',
  '/concreserv-uber/icons/icon-192.png',
  '/concreserv-uber/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Cacheando assets v2...');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

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
    ).then(() => {
      // Recarrega todas as abas abertas para pegar os novos assets
      return self.clients.matchAll({ type: 'window' }).then(clients => {
        clients.forEach(client => client.navigate(client.url));
      });
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/') ||
      event.request.url.includes('supabase') ||
      event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.ok && event.request.destination === 'document') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      if (event.request.destination === 'document') {
        return caches.match('/concreserv-uber/index.html');
      }
    })
  );
});

self.addEventListener('push', event => {
  let data = {
    title: 'Central Concreserv',
    body: 'Você tem uma atualização.',
    icon: '/concreserv-uber/icons/icon-192.png',
    badge: '/concreserv-uber/icons/icon-192.png',
    tag: 'concreserv-update',
    url: '/concreserv-uber/',
  };

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
      tag: data.tag,
      renotify: true,
      requireInteraction: false,
      data: { url: data.url },
      actions: [
        { action: 'open', title: 'Ver corrida' },
        { action: 'close', title: 'Fechar' },
      ],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;
  const targetUrl = event.notification.data?.url || '/concreserv-uber/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes('concreserv-uber') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
