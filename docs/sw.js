/*
 * Regionle ∞ — service worker.
 *
 * This is the source. `scripts/pwa/build.mjs` copies it into the build folder as `sw.js`, filling in
 * the version and the list of files of the application itself. Do not edit the generated copy.
 *
 *  · The application (pages, scripts, styles, fonts, icons, the world map) is stored when the worker is
 *    installed and served from that copy: it opens without a connection, and a new version only takes
 *    over when the player accepts it. The scripts of every screen are stored then too, although each
 *    one is only run when its screen is first opened.
 *  · The page of a screen (regiones.html, regions.html…) is the page of its language with another head,
 *    which only search engines read: it is not stored, and a visit to it gets the page of its language,
 *    where the game opens that screen by the address it was asked for.
 *  · The maps of each country and the other data files are asked to the network first, so that they
 *    are always the current ones, and kept: without a connection, the copy is used.
 *  · Flags never change: the copy is used whenever there is one.
 */
const VERSION = "3ad12078d88c";
/** Files of the application, relative to the folder the site is served from. */
const SHELL = ["assets/About-DsNiZzla.js","assets/Daily-BCRIH3bM.js","assets/Duel-DcxIkWTk.js","assets/GoalCard-fWXgNMWg.js","assets/KeyHelp--v1mOWMX.js","assets/ListLink-DuHpRseK.js","assets/MapView-VO4nz_TN.js","assets/Play-DxYA-aN_.js","assets/Progress-C5hW-t__.js","assets/Settings-CnJ0Nd_6.js","assets/Setup-Dd1vrKF4.js","assets/Travel-D3C7repf.js","assets/challenge-CScjXNNM.js","assets/data-CUV92jDN.js","assets/decks-CcuFwRGi.js","assets/dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2","assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2","assets/extra-MRxELLVQ.js","assets/fraunces-latin-ext-opsz-normal-CJcjJNj7.woff2","assets/fraunces-latin-ext-wght-italic-BfTTTDIL.woff2","assets/fraunces-latin-opsz-normal-DihXLNYH.woff2","assets/fraunces-latin-wght-italic-Py8at3oI.woff2","assets/fraunces-vietnamese-opsz-normal-Czevyj-6.woff2","assets/fraunces-vietnamese-wght-italic-BicUS2cM.woff2","assets/goalNames-CYxJaa-3.js","assets/icons-pfuccm0B.js","assets/index-BkX1le8H.css","assets/index-CgBwKbvd.js","assets/lists-o5Es5wBF.js","assets/map-BkweuMRg.js","assets/modes-DBmHhvgM.js","assets/pace-CVHgt-eo.js","assets/quiz-igNweRNp.js","assets/react-CenYa1ns.js","assets/rolldown-runtime-WkwZ5CU-.js","assets/router-BxoUTDO6.js","assets/store-D1sARBKk.js","assets/typeinList-CeoXbexC.js","assets/ui-ByA4oJJP.js","data/index.json","data/world.json","en.html","es.html","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest","offline.json"];
/** The ones whose name does not change with their content: fetched past the browser's own cache. */
const FRESH = ["en.html","es.html","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest","offline.json"];

const SHELL_CACHE = `regionle-shell-${VERSION}`;
/** Shared with the page, which fills it when the player downloads everything. */
const DATA_CACHE = 'regionle-data';
const scope = new URL(self.registration.scope);
/** How long a slow network is waited for when there is a copy at hand. */
const PATIENCE = 2500;
/**
 * The page that answers a visit to each page of the site, as it is asked for with and without its
 * extension: that of its language. The rest of the visits get the first page.
 */
const PAGES = {"en":"en.html","en.html":"en.html","es":"es.html","es.html":"es.html","about":"en.html","about.html":"en.html","acerca":"es.html","acerca.html":"es.html","cifras":"es.html","cifras.html":"es.html","cities":"en.html","cities.html":"en.html","ciudades":"es.html","ciudades.html":"es.html","countries":"en.html","countries.html":"en.html","daily":"en.html","daily.html":"en.html","figures":"en.html","figures.html":"en.html","fisica":"es.html","fisica.html":"es.html","paises":"es.html","paises.html":"es.html","physical":"en.html","physical.html":"en.html","regiones":"es.html","regiones.html":"es.html","regions":"en.html","regions.html":"en.html","reto":"es.html","reto.html":"es.html"};

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.all(
        SHELL.map(async (path) => {
          const url = new URL(path, scope);
          const res = await fetch(new Request(url, { cache: FRESH.includes(path) ? 'reload' : 'default' }));
          if (!res.ok) throw new Error(`${path}: ${res.status}`);
          await cache.put(url, res);
        }),
      );
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys()) {
        if (name.startsWith('regionle-shell-') && name !== SHELL_CACHE) await caches.delete(name);
      }
      await self.clients.claim();
    })(),
  );
});

// The page asks for this when the player accepts the new version.
self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});

/**
 * How a copy is looked for: by its address alone. What comes after a "?" does not count, and neither does
 * what the server says the answer varies with (some add "Vary: Origin" to everything): these are plain
 * files, the same for whoever asks. Without it, a file asked for from the page's head (a preload names
 * its origin) would not find the copy that was stored when the worker was installed.
 */
const ANY = { ignoreSearch: true, ignoreVary: true };

async function fromShell(url, request) {
  const cache = await caches.open(SHELL_CACHE);
  return (await cache.match(url, ANY)) ?? fetch(request);
}

async function networkFirst(event) {
  const { request } = event;
  const cache = await caches.open(DATA_CACHE);
  const copy = (await cache.match(request, ANY)) ?? (await caches.match(request, ANY));
  const fresh = fetch(request).then((res) => {
    if (res.ok) event.waitUntil(cache.put(request, res.clone()));
    return res;
  });
  if (!copy) return fresh;
  const late = new Promise((resolve) => setTimeout(() => resolve(null), PATIENCE));
  try {
    const res = await Promise.race([fresh, late]);
    if (res && res.ok) return res;
  } catch {
    // No connection: the copy will do.
  }
  event.waitUntil(fresh.catch(() => undefined));
  return copy;
}

async function cacheFirst(event) {
  const { request } = event;
  const cache = await caches.open(DATA_CACHE);
  const copy = await cache.match(request, ANY);
  if (copy) return copy;
  const res = await fetch(request);
  if (res.ok) event.waitUntil(cache.put(request, res.clone()));
  return res;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // Wikipedia and anything else outside the site is none of the worker's business.
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const path = url.pathname.slice(scope.pathname.length);
  // A visit to the game: any address that is opened in the browser and is not a file of the site
  // (sitemap.xml, a picture, a data file: those are answered as what they are).
  const visit = request.mode === 'navigate' && !/\.(?!html?$)[a-z0-9]+$/i.test(path);
  if (visit || path === '' || path === 'index.html') {
    const page = SHELL.includes(PAGES[path]) ? PAGES[path] : 'index.html';
    event.respondWith(fromShell(new URL(page, scope), request));
  } else if (path.startsWith('data/')) event.respondWith(networkFirst(event));
  else if (path.startsWith('flags/')) event.respondWith(cacheFirst(event));
  else if (SHELL.includes(path)) event.respondWith(fromShell(url, request));
});
