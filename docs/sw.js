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
 *  · The number on the icon (how many reviews are waiting) is kept right with the game closed, where the
 *    browser wakes the worker for it: the page leaves here the count from each moment on (`appBadge.ts`).
 */
const VERSION = "fb2a0aaeda35";
/** Files of the application, relative to the folder the site is served from. */
const SHELL = ["assets/About-BLjqI3-w.js","assets/Alphabet-BdxESTCh.css","assets/Alphabet-De5odb2I.js","assets/Badges-DfymMHQR.js","assets/Bearings-5biq_FXC.js","assets/Bearings-BIwfIK5k.css","assets/Bingo-Cgv2IC9W.js","assets/Bingo-DRTD4T_O.js","assets/Blind-BKVODURH.css","assets/Blind-TtAjgIXz.js","assets/Borders-BrUWnTx4.css","assets/Borders-CfLAb4Al.js","assets/Chain-COjDfX6Q.js","assets/Chain-N9U04Eb8.css","assets/Connect-cf1BhgyV.js","assets/Connect-w1CdOZj7.css","assets/Coords-49DGxMg2.js","assets/Coords-C8hrtuhR.css","assets/Daily-2ldIASQT.css","assets/Daily-DOjgXvU8.js","assets/DayCard-BtkwN-RE.css","assets/DayCard-CxG2OHDQ.js","assets/Dialog-0AXjXeun.js","assets/Dialog-B721ulj4.css","assets/DiplomaDialog-CX6eW_PR.js","assets/DiplomaDialog-Dji0_OS5.css","assets/Duel-7lfxdnb4.js","assets/Duo-DgwbG0al.css","assets/Duo-NLPmH5VO.js","assets/Embed-CbnMHJIY.css","assets/Embed-DRm8DWUN.js","assets/EmbedDialog-xsRRvCBI.js","assets/Ghost-BtZpAI4V.js","assets/Ghost-aqhI_1il.css","assets/GoalCard-BFRBH3fu.js","assets/Groups-B7mnV8bu.js","assets/HelpDialog-BGkamfA-.css","assets/HelpDialog-hLcd3CXl.js","assets/KeyHelp-K2bfzkXL.js","assets/ListLink-DE8HnZAf.js","assets/MoreChallenges-B1LHK1_r.js","assets/MoreChallenges-BABMao_-.css","assets/OccasionCalendar-CN5JS1ty.css","assets/OccasionCalendar-CWurchTe.js","assets/OddOne-BVy57W8M.css","assets/OddOne-DWcwWbmg.js","assets/Pairs-CA1nGEQ7.css","assets/Pairs-DrkPVVma.js","assets/Play-COW_vmw1.css","assets/Play-WBzn1dCE.js","assets/Progress-999Zb3nO.js","assets/Progress-D_Nmg5Cn.css","assets/QrButton-By1e3YHO.js","assets/QrDialog-2dCOhxiM.css","assets/QrDialog-DG0leUEC.js","assets/QrPicture-Dtnqfvz0.js","assets/ResultPicture-BGXgzgDO.js","assets/SessionNext-BlU5cebc.js","assets/Settings-G1Gn44A0.js","assets/Setup-Cc5XUw9F.js","assets/SharePicture-BDg855K2.js","assets/SharePicture-DXxtahQ3.css","assets/Speak-Bv5IeCMt.js","assets/Task-B6YUwJDZ.js","assets/TaskDialog-ByTCkLcK.js","assets/TaskReceipt-CxJABbh4.js","assets/Travel-CLU00nug.js","assets/Travel-ul8eRI4T.css","assets/WhoAmI-CFJqeenx.css","assets/WhoAmI-DWZFCq7Z.js","assets/backup-C3SEy4NW.js","assets/bearings-DthGVBI7.js","assets/bingoKept-O70zLKVy.js","assets/bingoKept-k2eJ8fVx.css","assets/challenge-B-QI_uQ4.js","assets/connect-IvFcCBcz.js","assets/data-DLJvfQeF.js","assets/decks-CTr0pzBh.js","assets/dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2","assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2","assets/duoLazy-DwKrgBLl.js","assets/embed-Ckj1XazZ.js","assets/embed-D_aF2sdq.css","assets/extra-DjPXWbpQ.js","assets/fraunces-latin-ext-opsz-normal-CJcjJNj7.woff2","assets/fraunces-latin-ext-wght-italic-BfTTTDIL.woff2","assets/fraunces-latin-opsz-normal-DihXLNYH.woff2","assets/fraunces-latin-wght-italic-Py8at3oI.woff2","assets/fraunces-vietnamese-opsz-normal-Czevyj-6.woff2","assets/fraunces-vietnamese-wght-italic-BicUS2cM.woff2","assets/ghostKept-CMCsr0K6.js","assets/ghostLazy-sd0GYgp4.js","assets/goalNames-DMCdDGtd.js","assets/groups-DLA3iqVp.js","assets/icons-C_aH9CBJ.js","assets/icons-more-CpweXZYI.js","assets/index-CzXL7ac6.css","assets/index-D6kvd9_z.js","assets/knowCard-mg3h29_B.js","assets/lesson-DRQZaMMI.js","assets/lexend-latin-ext-wght-normal-B6JQhE1e.woff2","assets/lexend-latin-wght-normal-ci0D1wrL.woff2","assets/lexend-vietnamese-wght-normal-RvljkFvg.woff2","assets/lists-DX7RP-BR.js","assets/map-CRwvB8RK.js","assets/pairs-B5vjcleL.js","assets/quiz-AI1_hzxI.js","assets/react-azO-dF6c.js","assets/rolldown-runtime-WkwZ5CU-.js","assets/rules-OWwqh0lK.js","assets/ruleset-BShTVo14.js","assets/statements-DT8tYjCw.js","assets/store-BUQo0jA3.js","assets/task-CIlPJe_C.css","assets/task-DE2IxCqD.js","assets/taskKept-CdJzcVEu.js","assets/text-Bhm2OnvE.js","assets/typeinList-s7hmQL0g.js","assets/useWidest-C6Zk6Wi_.js","assets/zones-DSwqZrA7.js","data/index.json","data/world.json","en.html","es.html","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest","offline.json"];
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
/**
 * The pages of the maps (`mapa-es-espana.html`, `map-es-spain.html`) are too many to be listed one by one:
 * each is known by the word its name starts with, and is answered with the page of its language as well.
 */
const MAPS = {"map":"en.html","mapa":"es.html"};
/** The name of the page of a map, with or without its extension: that word, the code of a country and its name. */
const MAP = /^([a-z]+)-[a-z][a-z0-9]-[a-z0-9]+(?:-[a-z0-9]+)*(?:\.html)?$/;

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
  // The count of waiting reviews from each moment on, or null when the player wants no number on the icon.
  if (event.data && event.data.type === 'badge') event.waitUntil(keepBadge(event.data.schedule).catch(() => undefined));
});

/** What the page last said the icon should count, kept where it outlives the worker. */
const BADGE_CACHE = 'regionle-badge';
const BADGE_KEY = new URL('badge-schedule', scope).href;

async function keepBadge(schedule) {
  const cache = await caches.open(BADGE_CACHE);
  if (Array.isArray(schedule)) await cache.put(BADGE_KEY, new Response(JSON.stringify(schedule), { headers: { 'Content-Type': 'application/json' } }));
  else await cache.delete(BADGE_KEY);
}

/** Puts on the icon the count that the schedule gives for this moment. */
async function refreshBadge() {
  if (!self.navigator.setAppBadge) return;
  const cache = await caches.open(BADGE_CACHE);
  const kept = await cache.match(BADGE_KEY);
  if (!kept) return;
  let count = null;
  for (const [at, n] of await kept.json()) {
    if (at > Date.now()) break;
    count = n;
  }
  if (count == null) return;
  if (count > 0) await self.navigator.setAppBadge(count);
  else await self.navigator.clearAppBadge();
}

// The browser wakes the worker now and then for this, where the game is installed and it does such things.
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'badge') event.waitUntil(refreshBadge().catch(() => undefined));
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
    const answer = PAGES[path] ?? MAPS[MAP.exec(path)?.[1] ?? ''];
    const page = SHELL.includes(answer) ? answer : 'index.html';
    event.respondWith(fromShell(new URL(page, scope), request));
  } else if (path.startsWith('data/')) event.respondWith(networkFirst(event));
  else if (path.startsWith('flags/')) event.respondWith(cacheFirst(event));
  else if (SHELL.includes(path)) event.respondWith(fromShell(url, request));
});
