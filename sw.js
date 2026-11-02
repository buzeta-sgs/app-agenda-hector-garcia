// Permite instalar el panel como app (ícono en la barra de tareas o el celular). No guarda nada en caché: siempre carga la versión publicada.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
