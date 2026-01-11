/**
 * Service Worker for Rodopi Dent PWA
 * Handles caching strategies and offline functionality
 */

const CACHE_VERSION = 'v1.0.0';
const STATIC_CACHE = `rodopi-static-${CACHE_VERSION}`;
const DYNAMIC_CACHE = `rodopi-dynamic-${CACHE_VERSION}`;
const OFFLINE_QUEUE_NAME = 'rodopi-offline-queue';

// Files to cache immediately on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/config.js',
  './js/utils.js',
  './js/api.js',
  './js/auth.js',
  './js/offline.js',
  './js/router.js',
  './js/components/calendar.js',
  './js/components/booking.js',
  './js/components/admin-calendar.js',
  './js/components/admin-finance.js',
  './js/components/admin-settings.js',
  './js/components/modal.js',
  './js/app.js',
  './assets/icons/icon-192x192.png',
  './assets/icons/icon-512x512.png'
];

// API endpoints that should use NetworkFirst strategy
const API_PATTERNS = [
  /\/webhook\//,
  /googleapis\.com/
];

/**
 * Install event - cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Install complete');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Install failed:', error);
      })
  );
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => {
              return name.startsWith('rodopi-') && 
                     name !== STATIC_CACHE && 
                     name !== DYNAMIC_CACHE;
            })
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Activate complete');
        return self.clients.claim();
      })
  );
});

/**
 * Fetch event - handle requests with appropriate caching strategy
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests for caching (but handle offline queue separately)
  if (request.method !== 'GET') {
    event.respondWith(handleNonGetRequest(request));
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Determine caching strategy based on request type
  if (isApiRequest(url)) {
    // API requests: Network First with cache fallback
    event.respondWith(networkFirst(request));
  } else if (isStaticAsset(url)) {
    // Static assets: Cache First
    event.respondWith(cacheFirst(request));
  } else {
    // Default: Stale While Revalidate
    event.respondWith(staleWhileRevalidate(request));
  }
});

/**
 * Check if request is an API call
 */
function isApiRequest(url) {
  return API_PATTERNS.some(pattern => pattern.test(url.href));
}

/**
 * Check if request is a static asset
 */
function isStaticAsset(url) {
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Cache First Strategy
 * Good for static assets that don't change often
 */
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] CacheFirst failed:', error);
    return new Response('Offline', { status: 503 });
  }
}

/**
 * Network First Strategy
 * Good for API requests where fresh data is important
 */
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url);
    
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // Return offline response for API requests
    return new Response(
      JSON.stringify({ 
        error: 'offline', 
        message: 'Няма връзка с интернет' 
      }),
      { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Stale While Revalidate Strategy
 * Returns cached version immediately, then updates cache in background
 */
async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((networkResponse) => {
      if (networkResponse.ok) {
        cache.put(request, networkResponse.clone());
      }
      return networkResponse;
    })
    .catch((error) => {
      console.log('[SW] SWR fetch failed:', error);
      return cachedResponse;
    });

  return cachedResponse || fetchPromise;
}

/**
 * Handle non-GET requests (POST, PUT, DELETE)
 * Queue them if offline for later sync
 */
async function handleNonGetRequest(request) {
  try {
    const response = await fetch(request.clone());
    return response;
  } catch (error) {
    // Store in offline queue for later sync
    console.log('[SW] Queueing offline request:', request.url);
    
    // Notify clients about offline queue
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'OFFLINE_QUEUE_UPDATED',
        url: request.url
      });
    });

    return new Response(
      JSON.stringify({ 
        error: 'queued',
        message: 'Заявката е запазена и ще бъде изпратена при връзка'
      }),
      { 
        status: 202,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

/**
 * Background Sync event
 * Process queued requests when connection is restored
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);
  
  if (event.tag === 'rodopi-sync') {
    event.waitUntil(processOfflineQueue());
  }
});

/**
 * Process offline queue
 */
async function processOfflineQueue() {
  // This will be implemented with IndexedDB in offline.js
  // The SW just triggers the sync
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'PROCESS_OFFLINE_QUEUE'
    });
  });
}

/**
 * Push notification event (for future SMS/notification features)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  
  const options = {
    body: data.body || 'Ново известие от Родопи Дент',
    icon: './assets/icons/icon-192x192.png',
    badge: './assets/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || './'
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Родопи Дент', options)
  );
});

/**
 * Notification click event
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const urlToOpen = event.notification.data?.url || './';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Focus existing window if available
        for (const client of clientList) {
          if (client.url.includes('rodopi') && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

/**
 * Message event - handle messages from main app
 */
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'GET_VERSION') {
    event.source.postMessage({
      type: 'VERSION',
      version: CACHE_VERSION
    });
  }

  if (event.data.type === 'CLEAR_CACHE') {
    caches.keys().then((cacheNames) => {
      cacheNames.forEach((cacheName) => {
        if (cacheName.startsWith('rodopi-')) {
          caches.delete(cacheName);
        }
      });
    });
  }
});

console.log('[SW] Service Worker loaded, version:', CACHE_VERSION);
