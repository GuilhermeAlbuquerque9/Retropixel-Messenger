const CACHE_NAME = "rpm-v2";

const CACHE_FILES = [
    "./",
    "./index.html",
    "./app.html",
    "./sobre.html",
    "./configuracoes.html",
    "./termos.html",
    "./offline.html",

    "./style.css",
    "./app.js",
    "./firebase.js",
    "./manifest.json",

    "./assets/RPM_logo.png",
    "./assets/icon-192.png",
    "./assets/icon-512.png",

    "./assets/click.wav",
    "./assets/aeroclick.wav",
    "./assets/nudge.wav"
];

/* ========================= */
/* INSTALAÇÃO */
/* ========================= */

self.addEventListener("install", event => {

    self.skipWaiting();

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CACHE_FILES))
    );

});

/* ========================= */
/* ATIVAÇÃO */
/* ========================= */

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys => {

            return Promise.all(

                keys.map(key => {

                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }

                })

            );

        }).then(() => self.clients.claim())

    );

});

/* ========================= */
/* FETCH */
/* ========================= */

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") return;

    event.respondWith(

        fetch(event.request)

            .then(response => {

                // Atualiza o cache automaticamente
                const clone = response.clone();

                caches.open(CACHE_NAME)
                    .then(cache => cache.put(event.request, clone));

                return response;

            })

            .catch(async () => {

                const cached = await caches.match(event.request);

                if (cached) return cached;

                if (event.request.mode === "navigate") {
                    return caches.match("./offline.html");
                }

                return new Response("", {
                    status: 404
                });

            })

    );

});
