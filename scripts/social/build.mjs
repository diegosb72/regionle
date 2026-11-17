/**
 * Draws the picture that goes with a link to the game on social networks and in chats:
 * public/social-es.png and public/social-en.png, 1200 × 630.
 *
 *   npm run social
 *
 * The map is the game's own (public/data/world.json), and so are its typefaces and colours. The page is
 * put together here and photographed with the Chromium that Playwright drives: install it once with
 * `npx playwright install chromium`, or point CHROME_PATH at a Chromium that is already there.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { geoEqualEarth, geoPath } from 'd3-geo';
import { chromium } from '@playwright/test';
import { feature } from 'topojson-client';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (file) => fs.readFileSync(path.join(root, file));
const W = 1200;
const H = 630;

const TEXT = {
  es: { size: 82, top: 'El mapa del mundo,', bottom: 'pieza a pieza.', line: ['Regiones, países, capitales, banderas,', 'ciudades, ríos, mares y montañas.'], tag: 'Juego de geografía · gratis y sin registro' },
  en: { size: 74, top: 'The map of the world,', bottom: 'piece by piece.', line: ['Regions, countries, capitals, flags,', 'cities, rivers, seas and mountains.'], tag: 'Geography game · free, no sign-up' },
};

// The colours of the game (src/styles.css): a map half way through a game.
const SEA = '#d8e6e3';
const LAND = '#fdf6e3';
const LINE = '#5c8b8f';
const PAINT = {
  ok: ['#8fd1a9', ['FR', 'DE', 'PT', 'MA', 'BR', 'AR', 'CA', 'ZA', 'JP', 'AU', 'SE', 'TR', 'KZ', 'ET', 'CO', 'ID', 'PL', 'SA']],
  warn: ['#f3cf6f', ['IT', 'MX', 'EG', 'IN', 'NO', 'PE', 'TZ', 'MN', 'UA']],
  bad: ['#f0957c', ['DZ', 'IR', 'VE', 'TH', 'CD', 'FI']],
  target: ['#f2793f', ['ES']],
};

const topo = JSON.parse(read('public/data/world.json'));
const countries = feature(topo, topo.objects.c).features.filter((f) => f.id !== 'AQ');
// The world, drawn large enough to bleed off the right edge: the left third belongs to the words.
const projection = geoEqualEarth()
  .rotate([-28, 0])
  .fitExtent(
    [
      [250, 36],
      [1500, 640],
    ],
    { type: 'Sphere' },
  );
const draw = geoPath(projection).digits(1);
const fillOf = new Map(Object.values(PAINT).flatMap(([colour, ids]) => ids.map((id) => [id, colour])));
const shapes = countries.map((f) => `<path d="${draw(f)}" fill="${fillOf.get(String(f.id)) ?? LAND}"/>`).join('');
const spain = countries.find((f) => f.id === 'ES');
const [sx, sy] = draw.centroid(spain);

const font = (file) => read(`node_modules/@fontsource-variable/${file}`).toString('base64');
const fonts = `
  @font-face { font-family: Fraunces; font-style: normal; font-weight: 100 900; src: url(data:font/woff2;base64,${font('fraunces/files/fraunces-latin-opsz-normal.woff2')}) format('woff2'); }
  @font-face { font-family: Fraunces; font-style: italic; font-weight: 100 900; src: url(data:font/woff2;base64,${font('fraunces/files/fraunces-latin-wght-italic.woff2')}) format('woff2'); }
  @font-face { font-family: 'DM Sans'; font-style: normal; font-weight: 100 1000; src: url(data:font/woff2;base64,${font('dm-sans/files/dm-sans-latin-wght-normal.woff2')}) format('woff2'); }`;

const page = (t) => `<!doctype html>
<html><head><meta charset="utf-8"><style>${fonts}
  * { box-sizing: border-box; margin: 0; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; background: ${SEA}; font-family: 'DM Sans', sans-serif; color: #1b2a2d; }
  svg.map { position: absolute; inset: 0; }
  svg.map path { stroke: ${LINE}; stroke-width: 0.8; stroke-linejoin: round; }
  .fade { position: absolute; inset: 0; background: linear-gradient(90deg, #f4efe6 0, #f4efe6 37%, rgba(244, 239, 230, 0.86) 49%, rgba(244, 239, 230, 0) 68%); }
  .words { position: absolute; left: 64px; top: 58px; width: 640px; }
  .brand { display: flex; align-items: center; gap: 16px; font: 620 44px/1 Fraunces, serif; letter-spacing: -0.02em; }
  .brand svg.inf { color: #e2572b; margin-top: 6px; }
  h1 { margin-top: 86px; font: 520 ${t.size}px/0.98 Fraunces, serif; letter-spacing: -0.035em; white-space: nowrap; }
  h1 em { display: block; font-style: italic; font-weight: 420; color: #ad3810; }
  p.line { margin-top: 34px; font-size: 27px; line-height: 1.38; color: #44575a; white-space: nowrap; }
  p.tag { position: absolute; left: 64px; bottom: 50px; padding: 11px 20px; border-radius: 999px; background: #0f5c63; color: #f4fbfa; font-size: 21px; font-weight: 600; letter-spacing: 0.01em; }
</style></head><body>
  <svg class="map" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    ${shapes}
    <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="34" fill="none" stroke="#f2793f" stroke-width="4" stroke-dasharray="9 8"/>
  </svg>
  <div class="fade"></div>
  <div class="words">
    <div class="brand">
      <svg width="62" height="62" viewBox="0 0 32 32"><rect width="32" height="32" rx="8" fill="#0f5c63"/><path fill="#f6e7c8" d="M7 9.5 15 7v8.5L7 18z"/><path fill="#e2572b" d="M17 7l8 2.5V17l-8-1.5z"/><path fill="#9fd3cd" d="M7 20.5l8-2.5v7l-8-1.5z"/><path fill="#f6e7c8" d="M17 18l8 1.5v4L17 25z"/></svg>
      <span>Regionle</span>
      <svg class="inf" width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16c5 0 7-8 12-8a4 4 0 0 1 0 8c-5 0-7-8-12-8a4 4 0 1 0 0 8"/></svg>
    </div>
    <h1>${t.top}<em>${t.bottom}</em></h1>
    <p class="line">${t.line.join('<br>')}</p>
  </div>
  <p class="tag">${t.tag}</p>
</body></html>`;

const own = process.env.CHROME_PATH;
const browser = await chromium.launch(own ? { executablePath: own, args: ['--no-sandbox', '--disable-gpu'] } : {});
try {
  const tab = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  for (const [lang, t] of Object.entries(TEXT)) {
    await tab.setContent(page(t), { waitUntil: 'load' });
    await tab.evaluate(() => document.fonts.ready);
    const file = `public/social-${lang}.png`;
    await tab.screenshot({ path: path.join(root, file), clip: { x: 0, y: 0, width: W, height: H } });
    console.log(`${file} · ${Math.round(fs.statSync(path.join(root, file)).size / 1024)} kB`);
  }
} finally {
  await browser.close();
}
