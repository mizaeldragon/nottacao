// Service worker simples (stale-while-revalidate) para tornar o app instalável e rápido.
// Subir a versão descarta o cache antigo — necessário quando muda CSS/HTML
// (sem isso, na primeira visita depois do deploy o app volta com a cara velha).
const CACHE = 'borracharia-v2';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Só GET, mesma origem e fora da API (a API precisa estar sempre fresca)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api')) {
    return;
  }
  e.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(e.request);
      const network = fetch(e.request)
        .then((res) => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
