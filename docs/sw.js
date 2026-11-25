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
 *  · Flags never change: the copy is used whenever there is one. The photographs of the sheets of the
 *    countries, each named after what it holds, are kept the same way once they have been shown.
 *  · The number on the icon (how many reviews are waiting) is kept right with the game closed, where the
 *    browser wakes the worker for it: the page leaves here the count from each moment on (`appBadge.ts`).
 */
const VERSION = "932d53d35ae3";
/** Files of the application, relative to the folder the site is served from. */
const SHELL = ["assets/About-C-fKNa6Y.js","assets/Alphabet-B1Yk0_b7.js","assets/Alphabet-BdxESTCh.css","assets/AnswerInput-Cgs7oxxH.js","assets/AnswerInput-DSk_9-KZ.css","assets/Badges-CA3GxV-K.js","assets/Bearings-BIwfIK5k.css","assets/Bearings-BjHYjM3d.js","assets/Bingo-CZTm5_d9.js","assets/Bingo-DZt22ZgX.js","assets/Blind-BKVODURH.css","assets/Blind-D1nGoGSh.js","assets/Borders-BrUWnTx4.css","assets/Borders-CMn-JP2L.js","assets/Chain-CJ2hidqY.js","assets/Chain-N9U04Eb8.css","assets/Connect-VPVujQ_P.js","assets/Connect-w1CdOZj7.css","assets/Coords-C8hrtuhR.css","assets/Coords-NF5KGl3k.js","assets/Crossword-B5f0P89k.js","assets/Crossword-BGL7x4vQ.css","assets/Daily-2ldIASQT.css","assets/Daily-Ch9q0ZeG.js","assets/DayCard-BtkwN-RE.css","assets/DayCard-Cq0MkPTV.js","assets/Dialog-B721ulj4.css","assets/Dialog-DnmB8ma6.js","assets/DiplomaDialog-CV5gi82K.js","assets/DiplomaDialog-Dji0_OS5.css","assets/Duel-CTjU4PPp.js","assets/Duo-C76vS1kE.js","assets/Duo-DgwbG0al.css","assets/Embed-CbnMHJIY.css","assets/Embed-N8YpB6nx.js","assets/EmbedDialog-C5ZspT_M.js","assets/FlagGames-CcFpSS7g.css","assets/FlagGames-CfXZHclC.js","assets/FlagPairs-DOXr2078.js","assets/FlagPairs-DyzJQUUN.css","assets/FlagPlay-B4J4_b2i.js","assets/FlagPlay-CpZFvE0l.css","assets/FlagProfile-B0ZSWUu1.css","assets/FlagProfile-DyayvGMb.js","assets/Flags-Cf9IiE-M.js","assets/Flags-DALkTFDq.css","assets/Ghost-CmIX6VVQ.js","assets/Ghost-aqhI_1il.css","assets/GoalCard-BKQJE5Fs.js","assets/Groups-BNyrHyZ2.js","assets/Hangman-B7b1B1_m.css","assets/Hangman-DVRPtI2n.js","assets/Help-CxHjFOPO.js","assets/HelpDialog-BGkamfA-.css","assets/HelpDialog-oYOHR6Ud.js","assets/KeyHelp-u7hqqO_d.js","assets/ListLink-DoYEVTDc.js","assets/MapView-7p9vQoFL.js","assets/MoreChallenges-BABMao_-.css","assets/MoreChallenges-CgrXdxti.js","assets/OccasionCalendar-CN5JS1ty.css","assets/OccasionCalendar-ckg7SS-L.js","assets/OddOne-BVy57W8M.css","assets/OddOne-Dmnijf3d.js","assets/Pairs-BSJV_QVJ.js","assets/Play-COW_vmw1.css","assets/Play-CxLvCOb_.js","assets/Progress-D_Nmg5Cn.css","assets/Progress-DyG4ZMpq.js","assets/QrButton-DY5hWhYu.js","assets/QrDialog-2dCOhxiM.css","assets/QrDialog-FXBGYl15.js","assets/QrPicture-Dtnqfvz0.js","assets/ResultPicture-Y1pQVQDH.js","assets/SessionNext-B5Dk1ni8.js","assets/Settings-ePNs-QRx.js","assets/Setup-DkWFjDzB.js","assets/SharePicture-DXxtahQ3.css","assets/SharePicture-ZbCj1ui5.js","assets/Speak-lBXCzB3v.js","assets/Task-POdFJo6A.js","assets/TaskDialog-C0sqmQbr.js","assets/TaskReceipt-09vL2pGr.js","assets/Travel-BUNU_29m.css","assets/Travel-CkVSt5Tv.js","assets/WhoAmI-CFJqeenx.css","assets/WhoAmI-D_gCDuNg.js","assets/WordSearch-D3aCbnbd.js","assets/WordSearch-D5GUrIVw.css","assets/backup-DRe8D-SZ.js","assets/bearings-DgdtWmqH.js","assets/bingoKept-CIp7wrHt.js","assets/bingoKept-k2eJ8fVx.css","assets/book-B6wc3JLg.js","assets/challenge-DkGXYM1P.js","assets/connect-DjXRilKF.js","assets/data-Bjr7lRdE.js","assets/decks-BAz-qTsh.js","assets/dm-sans-latin-ext-wght-normal-BOFOeGcA.woff2","assets/dm-sans-latin-wght-normal-Xz1IZZA0.woff2","assets/duoLazy-D479ZYRd.js","assets/embed-CtgYoU_7.js","assets/embed-D_aF2sdq.css","assets/extra-BaPVlXTY.js","assets/facts-C_38SATk.js","assets/figures-Bz7WuT5I.js","assets/flagGames-BvEqkerM.js","assets/flagSets-pAegDK7m.js","assets/fraunces-latin-ext-opsz-normal-CJcjJNj7.woff2","assets/fraunces-latin-ext-wght-italic-BfTTTDIL.woff2","assets/fraunces-latin-opsz-normal-DihXLNYH.woff2","assets/fraunces-latin-wght-italic-Py8at3oI.woff2","assets/fraunces-vietnamese-opsz-normal-Czevyj-6.woff2","assets/fraunces-vietnamese-wght-italic-BicUS2cM.woff2","assets/geo-B31Rvr7d.js","assets/ghostKept-8tvy1Kuk.js","assets/ghostLazy-B0cE2mTx.js","assets/goalNames-CqK-IxLR.js","assets/groups-OlRuCBdD.js","assets/icons-more-BSBr4bpZ.js","assets/icons-t6q8wNz-.js","assets/index-CjF1FQ1E.css","assets/index-DcIXMD96.js","assets/knowCard-DCIf_tpv.js","assets/lesson-B_pNY1v6.js","assets/letters-CyYY6LfA.js","assets/lexend-latin-ext-wght-normal-B6JQhE1e.woff2","assets/lexend-latin-wght-normal-ci0D1wrL.woff2","assets/lexend-vietnamese-wght-normal-RvljkFvg.woff2","assets/lists-IgeRW53v.js","assets/map-CN5b65Pc.js","assets/matcher-B9JLxLLc.js","assets/pairs-CA1nGEQ7.css","assets/pairs-cwgXY-A3.js","assets/phone-BFOqTFnC.js","assets/quiz-BdnYQaGQ.js","assets/react-azO-dF6c.js","assets/rolldown-runtime-WkwZ5CU-.js","assets/rules-CzfKjo2i.js","assets/ruleset-DGppJHFg.js","assets/shareCard-ME3Xfedk.js","assets/statements-5k_VoC8_.js","assets/store-D90bqmc4.js","assets/task-CIlPJe_C.css","assets/task-DB8WpkH2.js","assets/taskKept-D7FiDpYd.js","assets/text-Drhg6WFE.js","assets/typeinList-BYh4W8m2.js","assets/useWidest-D8eyEPaP.js","assets/zones-CkX-hkuT.js","data/index.json","data/world.json","en.html","es.html","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon.svg","icons/maskable-512.png","index.html","manifest.webmanifest","offline.json"];
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
const PAGES = {"en":"en.html","en.html":"en.html","es":"es.html","es.html":"es.html","about":"en.html","about.html":"en.html","acerca":"es.html","acerca.html":"es.html","banderas":"es.html","banderas.html":"es.html","cifras":"es.html","cifras.html":"es.html","cities":"en.html","cities.html":"en.html","ciudades":"es.html","ciudades.html":"es.html","countries":"en.html","countries.html":"en.html","daily":"en.html","daily.html":"en.html","figures":"en.html","figures.html":"en.html","fisica":"es.html","fisica.html":"es.html","flags":"en.html","flags.html":"en.html","paises":"es.html","paises.html":"es.html","physical":"en.html","physical.html":"en.html","regiones":"es.html","regiones.html":"es.html","regions":"en.html","regions.html":"en.html","reto":"es.html","reto.html":"es.html"};
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
  else if (path.startsWith('flags/') || path.startsWith('photos/')) event.respondWith(cacheFirst(event));
  else if (SHELL.includes(path)) event.respondWith(fromShell(url, request));
});
