// Service Worker Version (អ្នកអាចប្តូរលេខនេះនៅពេលអ្នកផ្លាស់ប្តូរឯកសារ)
const CACHE_NAME = 'integral-calculator-cache-v1';

// បញ្ជីឯកសារទាំងអស់ដែលត្រូវរក្សាទុក (Cache)
const urlsToCache = [
  '/', // ទំព័រដើម
  '/index.html',
  '/manifest.json',
  '/pwa-register.js',
  
  // រូបតំណាង PWA (ត្រូវតែមាន)
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  
  // ⚠️ ត្រូវតែបន្ថែមឯកសារ CSS និង JavaScript សំខាន់ៗផ្សេងទៀតរបស់អ្នកនៅទីនេះ
  // ឧទាហរណ៍៖ '/css/style.css', '/js/main.js'
];

// ដំណើរការនៅពេលដំឡើង (Install Event)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting(); 
});

// ដំណើរការនៅពេលទាញយកទិន្នន័យ (Fetch Event)
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
    )
  );
});

// ដំណើរការនៅពេល Active (Activate Event) - លុប cache ចាស់ៗ
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
