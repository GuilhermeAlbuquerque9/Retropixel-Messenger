const CACHE = "rpm-v1";

const FILES = [

"/",
"/index.html",
"/app.html",
"/sobre.html",
"/configuracoes.html",
"/termos.html",

"/style.css",
"/app.js",
"/firebase.js",

"/assets/avatar.png",
"/assets/click.wav",
"/assets/aeroclick.wav",
"/assets/nudge.wav",

"/offline.html"

];

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE).then(cache => cache.addAll(FILES))

    );

});

self.addEventListener("fetch", event => {

    event.respondWith(

        caches.match(event.request).then(response => {

            return response || fetch(event.request).catch(() => {

                return caches.match("/offline.html");

            });

        })

    );

});
