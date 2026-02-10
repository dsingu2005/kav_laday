// Service Worker for caching audio tracks
const CACHE_NAME = 'kav-laday-audio-v1';

// Listen for fetch events and cache audio files
self.addEventListener('fetch', (e) => {
    const url = new URL(e.request.url);
    
    // Only cache Dropbox audio URLs
    if (url.hostname === 'www.dropbox.com' && e.request.url.includes('.mp3')) {
        e.respondWith(
            caches.open(CACHE_NAME).then((cache) => {
                return cache.match(e.request).then((response) => {
                    if (response) {
                        console.log('Serving from cache:', e.request.url);
                        return response;
                    }
                    
                    // Fetch from network and cache it
                    return fetch(e.request).then((response) => {
                        if (response && response.status === 200) {
                            console.log('Caching audio:', e.request.url);
                            cache.put(e.request, response.clone());
                        }
                        return response;
                    }).catch(() => {
                        console.warn('Fetch failed, returning cached or error:', e.request.url);
                        return cache.match(e.request);
                    });
                });
            })
        );
    }
});

// Clean up old caches
self.addEventListener('activate', (e) => {
    e.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
