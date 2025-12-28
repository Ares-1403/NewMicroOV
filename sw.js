// static/sw.js
const CACHE_NAME = 'microov-v1';

self.addEventListener('install', (event) => {
  console.log('MicroOV SW instalado');
  // Fuerza al Service Worker a activarse sin esperar
  self.skipWaiting(); 
});

self.addEventListener('activate', (event) => {
  console.log('MicroOV SW activado');
  // Permite que el SW tome control de la página inmediatamente
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});