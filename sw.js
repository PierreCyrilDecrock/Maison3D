/* Service worker de Maison 3D : toute l'application est mise en cache à l'installation (fonctionne hors ligne).
   Le numéro de version est calculé à partir du contenu des fichiers : un fichier modifié = nouvelle version. */
const VERSION = '8595e833b8';
const CACHE = 'maison3d-' + VERSION;
const FONTS = 'maison3d-polices';
const PRECACHE = [
 "./",
 "core.js",
 "editor2d.js",
 "furniture-garage.js",
 "furniture-home.js",
 "furniture-kit.js",
 "furniture-models.js",
 "furniture.js",
 "generator.js",
 "icons/apple-touch-icon.png",
 "icons/icon-192.png",
 "icons/icon-512.png",
 "icons/icon.svg",
 "icons/maskable-192.png",
 "icons/maskable-512.png",
 "index.html",
 "manifest.webmanifest",
 "pwa.js",
 "store.js",
 "styles.css",
 "tests.js",
 "ui.js",
 "vendor/lz-string.min.js",
 "vendor/three/LICENSE",
 "vendor/three/build/three.module.js",
 "vendor/three/examples/jsm/controls/OrbitControls.js",
 "vendor/three/examples/jsm/exporters/GLTFExporter.js",
 "vendor/three/examples/jsm/geometries/RoundedBoxGeometry.js",
 "vendor/three/examples/jsm/utils/TextureUtils.js",
 "viewer3d.js"
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
  // Pas de skipWaiting automatique : la nouvelle version attend que l'utilisateur la demande (bandeau) ou que l'application soit fermée.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('maison3d-') && key !== CACHE && key !== FONTS) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Polices Google : mises en cache au premier passage, l'interface a des polices de secours sinon.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith((async () => {
      const cache = await caches.open(FONTS);
      const hit = await cache.match(req);
      const refresh = fetch(req).then((res) => { if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()); return res; }).catch(() => null);
      return hit || (await refresh) || Response.error();
    })());
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    } catch (err) {
      if (req.mode === 'navigate') return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      throw err;
    }
  })());
});
