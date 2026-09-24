const CACHE_NAME = "sistema-reunioes-v1";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.json",
    "./icone-app-192.png",
    "./icone-app-512.png",
    "./Logo Catedral CG.png",
    "./Logo Universal.png"
];

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FILES_TO_CACHE))
            .then(() => self.skipWaiting())
    );

});


self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(cacheNames => {

            return Promise.all(

                cacheNames
                    .filter(cacheName => cacheName !== CACHE_NAME)
                    .map(cacheName => caches.delete(cacheName))

            );

        }).then(() => self.clients.claim())

    );

});


self.addEventListener("fetch", event => {

    event.respondWith(

        fetch(event.request)
            .then(response => {

                const responseClone = response.clone();

                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseClone);
                });

                return response;

            })
            .catch(() => {

                return caches.match(event.request);

            })

    );

});