importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

if (workbox) {
  console.log(`Yay! Workbox is loaded 🎉`);

  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  // Cache static assets (CSS, JS, Fonts, Images)
  workbox.routing.registerRoute(
    ({ request }) =>
      request.destination === 'style' ||
      request.destination === 'script' ||
      request.destination === 'worker' ||
      request.destination === 'font' ||
      request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'aninex-assets',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Background Sync for offline mutations
  const bgSyncPlugin = new workbox.backgroundSync.BackgroundSyncPlugin('sync-mutations', {
    maxRetentionTime: 24 * 60, // Retry for max of 24 Hours
  });

  // Supabase REST calls (GET) - NetworkFirst with cache fallback
  workbox.routing.registerRoute(
    ({ url }) => url.hostname.includes('supabase.co') || url.hostname.includes('onrender.com') || url.pathname.startsWith('/api'),
    new workbox.strategies.NetworkFirst({
      cacheName: 'aninex-api',
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 50,
          maxAgeSeconds: 24 * 60 * 60, // 1 Day
        }),
      ],
    }),
    'GET'
  );

  // Intercept POST/PUT/DELETE for background sync (fallback)
  workbox.routing.registerRoute(
    ({ url }) => url.hostname.includes('supabase.co') || url.hostname.includes('onrender.com') || url.pathname.startsWith('/api'),
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'POST'
  );
  workbox.routing.registerRoute(
    ({ url }) => url.hostname.includes('supabase.co') || url.hostname.includes('onrender.com') || url.pathname.startsWith('/api'),
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'PUT'
  );
  workbox.routing.registerRoute(
    ({ url }) => url.hostname.includes('supabase.co') || url.hostname.includes('onrender.com') || url.pathname.startsWith('/api'),
    new workbox.strategies.NetworkOnly({
      plugins: [bgSyncPlugin],
    }),
    'DELETE'
  );

  // Fallback for navigation requests (SPA)
  workbox.routing.registerRoute(
    ({ request }) => request.mode === 'navigate',
    new workbox.strategies.NetworkFirst({
      cacheName: 'aninex-pages',
    })
  );

} else {
  console.log(`Boo! Workbox didn't load 😬`);
}
