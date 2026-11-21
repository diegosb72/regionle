import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { LANG_PAGE, SCREENS, SCREEN_IDS, SEO, SEO_LANGS, SITE_PAGES, SOCIAL_IMAGE, alternates, jsonLd, localise, pageFile, pageLangOf, pageNamed, pageText, pageUrl, robots, seoHead, siteUrl, sitemap, type MapPage, type ScreenPage } from './seo';
import { mapPagesOf } from './seoMaps';

const ROOT = path.join(__dirname, '../..');
const SITE = 'https://example.org/juego/';
const source = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
/** The pages of the map of one country, as the build makes them (seoMaps.ts). */
const MAPS: MapPage[] = mapPagesOf([
  { id: 'ES', n: { es: 'España', en: 'Spain' }, lv: [{ n: 19, es: 'comunidades autónomas', en: 'autonomous communities' }, { n: 52, es: 'provincias', en: 'provinces' }] },
  { id: 'GB', n: { es: 'Reino Unido', en: 'United Kingdom' }, lv: [{ n: 4, es: 'naciones', en: 'nations' }] },
]);

describe('what the page says of itself', () => {
  it('has a title and a description of a fair length in each language', () => {
    for (const lang of SEO_LANGS) {
      const t = SEO[lang];
      expect(t.title.length, t.title).toBeLessThanOrEqual(60);
      expect(t.cardTitle.length, t.cardTitle).toBeLessThanOrEqual(70);
      expect(t.description.length, t.description).toBeGreaterThanOrEqual(70);
      expect(t.description.length, t.description).toBeLessThanOrEqual(160);
      expect(t.imageAlt.length).toBeGreaterThan(20);
    }
    expect(SEO.es.title).not.toBe(SEO.en.title);
  });

  it('takes the address of the site with or without its last slash, and nothing that is not one', () => {
    expect(siteUrl('https://example.org/juego')).toBe(SITE);
    expect(siteUrl(' https://example.org/juego/ ')).toBe(SITE);
    expect(siteUrl('')).toBeNull();
    expect(siteUrl(undefined)).toBeNull();
    expect(siteUrl('example.org')).toBeNull();
    expect(pageUrl(SITE, 'index')).toBe(SITE);
    expect(pageUrl(SITE, 'en')).toBe(`${SITE}en.html`);
  });

  it('writes the card, the canonical address and the other languages with whole addresses', () => {
    for (const page of ['index', 'es', 'en'] as const) {
      const head = seoHead(page, SITE, '9.9.9');
      const lang = page === 'en' ? 'en' : 'es';
      expect(head).toContain(`<title>${SEO[lang].title}</title>`);
      expect(head).toContain(`<link rel="canonical" href="${pageUrl(SITE, page)}" />`);
      expect(head).toContain(`<link rel="alternate" hreflang="es" href="${SITE}es.html" />`);
      expect(head).toContain(`<link rel="alternate" hreflang="en" href="${SITE}en.html" />`);
      expect(head).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE}" />`);
      expect(head).toContain(`<meta property="og:image" content="${SITE}${SOCIAL_IMAGE[lang]}" />`);
      expect(head).toContain(`<meta property="og:url" content="${pageUrl(SITE, page)}" />`);
      expect(head).toContain('<meta name="twitter:card" content="summary_large_image" />');
      // Every address in it is a whole one.
      for (const m of head.matchAll(/(?:href|content)="([^"]*\.(?:html|png))"/g)) expect(m[1]).toMatch(/^https:\/\//);
      const data = JSON.parse(/<script type="application\/ld\+json">(.*)<\/script>/.exec(head)![1]) as Record<string, unknown>;
      expect(data).toEqual(jsonLd(page, SITE, '9.9.9'));
      expect(data['@type']).toBe('WebApplication');
      expect(data.url).toBe(pageUrl(SITE, page));
      expect(data.softwareVersion).toBe('9.9.9');
    }
  });

  it('gives each screen a page in each language, with a name of its own and something of its own to say', () => {
    expect(SITE_PAGES).toHaveLength(3 + SCREEN_IDS.length * SEO_LANGS.length);
    const files = SITE_PAGES.map(pageFile);
    expect(new Set(files).size).toBe(files.length);
    expect(files.slice(0, 3)).toEqual(['index.html', 'es.html', 'en.html']);
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const page of SITE_PAGES) {
      const t = pageText(page);
      expect(t.title.length, t.title).toBeLessThanOrEqual(60);
      expect(t.description.length, t.description).toBeGreaterThanOrEqual(70);
      expect(t.description.length, t.description).toBeLessThanOrEqual(160);
      expect(t.noscript).toContain('JavaScript');
      if (page !== 'index') {
        titles.add(t.title);
        descriptions.add(t.description);
      }
    }
    // No two pages say the same of themselves.
    expect(titles.size).toBe(SITE_PAGES.length - 1);
    expect(descriptions.size).toBe(SITE_PAGES.length - 1);
    for (const screen of SCREEN_IDS) {
      for (const lang of SEO_LANGS) {
        const { file, name } = SCREENS[screen][lang];
        // A plain word, which is what the page before the game starts and the worker that keeps the site tell a page by.
        expect(file, file).toMatch(/^[a-z]+$/);
        expect(pageText({ screen, lang }).title).toBe(`${name} — Regionle ∞`);
        expect(pageText({ screen, lang }).noscript.startsWith(SCREENS[screen][lang].description)).toBe(true);
      }
    }
  });

  it('knows a page by its name, with or without its extension', () => {
    expect(pageNamed('en')).toBe('en');
    expect(pageNamed('es.html')).toBe('es');
    expect(pageNamed('regions')).toEqual({ screen: 'regiones', lang: 'en' });
    expect(pageNamed('regiones.html')).toEqual({ screen: 'regiones', lang: 'es' });
    expect(pageNamed('cifras')).toEqual({ screen: 'poblaciones', lang: 'es' });
    expect(pageNamed('figures.html')).toEqual({ screen: 'poblaciones', lang: 'en' });
    // The address the screen has in the game is not the name of its page when the two differ.
    expect(pageNamed('poblaciones')).toBeNull();
    for (const name of ['', 'index', 'index.html', 'queen', 'en.htm', 'EN', 'regions.html.html', 'toString', 'constructor']) expect(pageNamed(name), name).toBeNull();
    for (const page of SITE_PAGES) if (page !== 'index') expect(pageNamed(pageFile(page))).toEqual(page);
  });

  it('writes the page of a screen with its own address, its other language and the way back to the game', () => {
    for (const screen of SCREEN_IDS) {
      for (const lang of SEO_LANGS) {
        const page: ScreenPage = { screen, lang };
        const other = lang === 'es' ? 'en' : 'es';
        const url = `${SITE}${SCREENS[screen][lang].file}.html`;
        const t = pageText(page);
        expect(pageUrl(SITE, page)).toBe(url);
        expect(pageLangOf(page)).toBe(lang);
        const head = seoHead(page, SITE, '9.9.9');
        expect(head).toContain(`<title>${t.title}</title>`);
        expect(head).toContain(`<meta name="description" content="${t.description}" />`);
        expect(head).toContain(`<link rel="canonical" href="${url}" />`);
        expect(head).toContain(`<link rel="alternate" hreflang="${lang}" href="${url}" />`);
        expect(head).toContain(`<link rel="alternate" hreflang="${other}" href="${SITE}${SCREENS[screen][other].file}.html" />`);
        // For a reader of neither language, the Spanish one: what the game speaks when it has to choose.
        expect(head).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE}${SCREENS[screen].es.file}.html" />`);
        expect(head.match(/hreflang="/g)).toHaveLength(3);
        expect(head).toContain(`<meta property="og:title" content="${t.title}" />`);
        expect(head).toContain(`<meta property="og:url" content="${url}" />`);
        expect(head).toContain(`<meta property="og:image" content="${SITE}${SOCIAL_IMAGE[lang]}" />`);
        expect(head).not.toContain(SEO[lang].title);
        const data = JSON.parse(/<script type="application\/ld\+json">(.*)<\/script>/.exec(head)![1]) as { '@type': string; url: string; name: string; inLanguage: string; isPartOf: Record<string, string>; breadcrumb: { itemListElement: { position: number; name: string; item: string }[] } };
        expect(data).toEqual(jsonLd(page, SITE, '9.9.9'));
        expect(data['@type']).toBe(screen === 'acerca' ? 'AboutPage' : 'WebPage');
        expect([data.url, data.name, data.inLanguage]).toEqual([url, t.title, lang]);
        expect(data.isPartOf).toMatchObject({ '@type': 'WebApplication', url: `${SITE}${LANG_PAGE[lang]}`, softwareVersion: '9.9.9' });
        expect(data.breadcrumb.itemListElement.map((i) => [i.position, i.name, i.item])).toEqual([
          [1, 'Regionle ∞', `${SITE}${LANG_PAGE[lang]}`],
          [2, SCREENS[screen][lang].name, url],
        ]);
      }
    }
    expect(alternates(SITE, 'en')).toEqual([
      { lang: 'es', url: `${SITE}es.html` },
      { lang: 'en', url: `${SITE}en.html` },
      { lang: 'x-default', url: SITE },
    ]);
  });

  it('writes the page of a map with its own address, its other language and the way back through the regions', () => {
    for (const page of MAPS) {
      const lang = page.lang;
      const other = lang === 'es' ? 'en' : 'es';
      const url = `${SITE}${page.files[lang]}.html`;
      const t = pageText(page);
      expect(pageFile(page)).toBe(`${page.files[lang]}.html`);
      expect(pageUrl(SITE, page)).toBe(url);
      expect(pageLangOf(page)).toBe(lang);
      expect(t).toEqual({ title: `${page.name} — Regionle ∞`, description: page.description, cardTitle: `${page.name} — Regionle ∞`, noscript: `${page.description} ${SEO[lang].needsScripts}` });
      const head = seoHead(page, SITE, '9.9.9');
      expect(head).toContain(`<title>${t.title}</title>`);
      expect(head).toContain(`<meta name="description" content="${t.description}" />`);
      expect(head).toContain(`<link rel="canonical" href="${url}" />`);
      expect(head).toContain(`<link rel="alternate" hreflang="${lang}" href="${url}" />`);
      expect(head).toContain(`<link rel="alternate" hreflang="${other}" href="${SITE}${page.files[other]}.html" />`);
      expect(head).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE}${page.files.es}.html" />`);
      expect(head.match(/hreflang="/g)).toHaveLength(3);
      expect(head).toContain(`<meta property="og:title" content="${t.title}" />`);
      expect(head).toContain(`<meta property="og:url" content="${url}" />`);
      expect(head).toContain(`<meta property="og:locale" content="${SEO[lang].locale}" />`);
      expect(head).not.toContain(SEO[lang].title);
      const data = JSON.parse(/<script type="application\/ld\+json">(.*)<\/script>/.exec(head)![1]) as { '@type': string; url: string; name: string; description: string; inLanguage: string; isPartOf: Record<string, string>; breadcrumb: { itemListElement: { '@type': string; position: number; name: string; item: string }[] } };
      expect(data).toEqual(jsonLd(page, SITE, '9.9.9'));
      expect(data['@type']).toBe('WebPage');
      expect([data.url, data.name, data.description, data.inLanguage]).toEqual([url, t.title, page.description, lang]);
      expect(data.isPartOf).toMatchObject({ '@type': 'WebApplication', url: `${SITE}${LANG_PAGE[lang]}`, softwareVersion: '9.9.9' });
      // The game, the screen of the regions, the map: each step with its own address in that language.
      expect(data.breadcrumb.itemListElement.map((i) => [i['@type'], i.position, i.name, i.item])).toEqual([
        ['ListItem', 1, 'Regionle ∞', `${SITE}${LANG_PAGE[lang]}`],
        ['ListItem', 2, SCREENS.regiones[lang].name, `${SITE}${SCREENS.regiones[lang].file}.html`],
        ['ListItem', 3, page.name, url],
      ]);
    }
    expect(MAPS.map((p) => pageFile(p))).toEqual(['mapa-es-espana.html', 'map-es-spain.html', 'mapa-gb-reino-unido.html', 'map-gb-united-kingdom.html']);
    expect(alternates(SITE, MAPS[1])).toEqual([
      { lang: 'es', url: `${SITE}mapa-es-espana.html` },
      { lang: 'en', url: `${SITE}map-es-spain.html` },
      { lang: 'x-default', url: `${SITE}mapa-es-espana.html` },
    ]);
    // The page of a map is not one of the pages a name alone gives: those are the ones the site always has.
    expect(pageNamed('mapa-es-espana')).toBeNull();
    expect(pageNamed('map-es-spain.html')).toBeNull();
  });

  it('writes only the title and the description when the address of the site is not known', () => {
    const head = seoHead('en', null, '1.0.0');
    expect(head).toContain(SEO.en.title);
    expect(head).not.toMatch(/canonical|og:|twitter:|ld\+json|hreflang/);
  });

  it('escapes what could break out of an attribute or of the script', () => {
    const before = SEO.en.description;
    SEO.en.description = 'A "quoted" <b>claim</b> & </script><script>alert(1)</script>';
    try {
      const head = seoHead('en', SITE, '1.0.0');
      expect(head).toContain('content="A &quot;quoted&quot; &lt;b&gt;claim&lt;/b&gt; &amp; &lt;/script&gt;');
      expect(head.match(/<\/script>/g)).toHaveLength(1);
      expect(JSON.parse(/<script type="application\/ld\+json">(.*)<\/script>/.exec(head)![1]).description).toBe(SEO.en.description);
    } finally {
      SEO.en.description = before;
    }
  });
});

describe('the pages of the site', () => {
  it('rewrites the page for each language: its language, its head and its message without scripts', () => {
    const en = localise(source, 'en', SITE, '1.2.3');
    expect(en).toContain('<html lang="en">');
    expect(en).toContain(`<title>${SEO.en.title}</title>`);
    expect(en).toContain(SEO.en.noscript);
    expect(en).not.toContain(SEO.es.title);
    expect(en).not.toContain(SEO.es.noscript);
    // What is not between the marks is left as it was.
    expect(en).toContain('<div id="root">');
    expect(en).toContain('<script type="module" src="/src/main.tsx"></script>');
    // Written again for another language, nothing of the first one is left.
    expect(localise(en, 'es', SITE, '1.2.3')).toBe(localise(source, 'es', SITE, '1.2.3'));
    expect(localise(source, 'index', SITE, '1.2.3')).toContain('<html lang="es">');
    // The page of a screen: the language, the head and the message of that screen.
    const cities = localise(source, { screen: 'ciudades', lang: 'en' }, SITE, '1.2.3');
    expect(cities).toContain('<html lang="en">');
    expect(cities).toContain('<title>Cities and capitals — Regionle ∞</title>');
    expect(cities).toContain(`<!--noscript-->${SCREENS.ciudades.en.description} ${SEO.en.needsScripts}<!--/noscript-->`);
    expect(cities).not.toContain(SEO.en.noscript);
    expect(localise(cities, 'es', SITE, '1.2.3')).toBe(localise(source, 'es', SITE, '1.2.3'));
  });

  it('says so when the page has lost its marks', () => {
    expect(() => localise(source.replace('<!--/seo-->', ''), 'en', SITE, '1')).toThrow(/seo/);
    expect(() => localise(source.replace('<!--noscript-->', ''), 'en', SITE, '1')).toThrow(/noscript/);
    expect(() => localise(source.replace('<html lang="es">', '<html>'), 'en', SITE, '1')).toThrow(/lang/);
  });

  it('is written in Spanish in the source, with the same words the game uses', () => {
    expect(source).toContain(`<title>${SEO.es.title}</title>`);
    expect(source).toContain(`content="${SEO.es.description}"`);
    expect(source).toContain(SEO.es.noscript);
  });

  it('rewrites the page for the map of a country as for any other page', () => {
    const page = MAPS[1];
    const html = localise(source, page, SITE, '1.2.3');
    expect(html).toContain('<html lang="en">');
    expect(html).toContain('<title>Spain: provinces on the map — Regionle ∞</title>');
    expect(html).toContain(`<link rel="canonical" href="${SITE}map-es-spain.html" />`);
    expect(html).toContain(`<!--noscript-->${page.description} ${SEO.en.needsScripts}<!--/noscript-->`);
    expect(html).not.toContain(SEO.es.noscript);
    // What is not between the marks is as it was: the page is the game.
    expect(html.split('<!--/seo-->')[1].split('<!--noscript-->')[0]).toBe(source.split('<!--/seo-->')[1].split('<!--noscript-->')[0]);
  });

  it('lists the pages of the maps for search engines after the others, each with its other language', () => {
    const xml = sitemap(SITE, '2026-11-17', MAPS);
    expect(xml.match(/<url>/g)).toHaveLength(SITE_PAGES.length + MAPS.length);
    for (const page of MAPS) expect(xml).toContain(`<loc>${SITE}${pageFile(page)}</loc>`);
    expect(xml.indexOf(`<loc>${SITE}mapa-es-espana.html</loc>`)).toBeGreaterThan(xml.indexOf(`<loc>${SITE}about.html</loc>`));
    expect(xml).toContain(`<loc>${SITE}map-es-spain.html</loc>\n    <lastmod>2026-11-17</lastmod>\n    <xhtml:link rel="alternate" hreflang="es" href="${SITE}mapa-es-espana.html" />\n    <xhtml:link rel="alternate" hreflang="en" href="${SITE}map-es-spain.html" />\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE}mapa-es-espana.html" />`);
    const listed = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    for (const m of xml.matchAll(/hreflang="[a-z-]+" href="([^"]+)"/g)) expect(listed.has(m[1]), m[1]).toBe(true);
    // Without them, the list is the one of the pages the site always has.
    expect(sitemap(SITE, '2026-11-17', [])).toBe(sitemap(SITE, '2026-11-17'));
    expect(sitemap(SITE, '2026-11-17')).not.toContain('mapa-');
  });

  it('lists every page for search engines, each with its other languages', () => {
    const xml = sitemap(SITE, '2026-11-17');
    expect(xml.match(/<url>/g)).toHaveLength(SITE_PAGES.length);
    for (const page of SITE_PAGES) expect(xml).toContain(`<loc>${pageUrl(SITE, page)}</loc>`);
    for (const loc of [SITE, `${SITE}${LANG_PAGE.es}`, `${SITE}${LANG_PAGE.en}`, `${SITE}regiones.html`, `${SITE}figures.html`, `${SITE}reto.html`, `${SITE}about.html`]) expect(xml).toContain(`<loc>${loc}</loc>`);
    expect(xml.match(/hreflang="x-default"/g)).toHaveLength(SITE_PAGES.length);
    // Every address named as another language of a page is a page of the list itself.
    const listed = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
    for (const m of xml.matchAll(/hreflang="[a-z-]+" href="([^"]+)"/g)) expect(listed.has(m[1]), m[1]).toBe(true);
    expect(xml.match(/<lastmod>2026-11-17<\/lastmod>/g)).toHaveLength(SITE_PAGES.length);
    expect(xml).toContain('<lastmod>2026-11-17</lastmod>');
    expect(robots(SITE)).toContain(`Sitemap: ${SITE}sitemap.xml`);
    expect(robots(SITE)).toMatch(/^User-agent: \*\nAllow: \/\n/);
  });

  it('has the picture of each card, of the size it says', () => {
    for (const lang of SEO_LANGS) {
      const png = fs.readFileSync(path.join(ROOT, 'public', SOCIAL_IMAGE[lang]));
      expect(png.subarray(1, 4).toString()).toBe('PNG');
      expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
      // Social networks drop pictures that are too heavy.
      expect(png.length).toBeLessThan(600_000);
    }
  });
});

describe('the language of the page before the game starts', () => {
  const inline = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((code) => code.includes('documentElement.lang'))!;
  /** Runs the script of the page as a browser would, and says which language and theme it leaves. */
  const run = (opts: { saved?: unknown; raw?: string; path?: string; languages?: string[]; dark?: boolean }) => {
    const html = { lang: 'es', dataset: {} as Record<string, string> };
    const stored = opts.raw ?? (opts.saved === undefined ? null : JSON.stringify({ state: opts.saved, version: 1 }));
    vm.runInNewContext(inline, {
      document: { documentElement: html },
      localStorage: { getItem: () => stored },
      location: { pathname: opts.path ?? '/regionle/' },
      navigator: { languages: opts.languages ?? ['es-ES'], language: (opts.languages ?? ['es-ES'])[0] },
      matchMedia: () => ({ matches: !!opts.dark }),
    });
    return html;
  };

  it('is the one the player chose, whatever the page and the browser', () => {
    expect(run({ saved: { lang: 'en' }, path: '/regionle/es.html', languages: ['es-ES'] }).lang).toBe('en');
    expect(run({ saved: { lang: 'es' }, path: '/regionle/en.html', languages: ['en-GB'] }).lang).toBe('es');
  });

  it('is the one of the page for whoever has not chosen', () => {
    expect(run({ path: '/regionle/en.html', languages: ['es-ES'] }).lang).toBe('en');
    expect(run({ path: '/regionle/en', languages: ['es-ES'] }).lang).toBe('en');
    expect(run({ saved: { lang: null }, path: '/regionle/es.html', languages: ['en-US'] }).lang).toBe('es');
  });

  it('is the one of the page of a screen too, for every page there is', () => {
    for (const page of SITE_PAGES) {
      if (page === 'index') continue;
      const file = pageFile(page);
      const other = pageLangOf(page) === 'es' ? 'en-GB' : 'es-ES';
      // With and without the extension, as GitHub Pages serves them, and against what the browser asks for.
      expect(run({ path: `/regionle/${file}`, languages: [other] }).lang, file).toBe(pageLangOf(page));
      expect(run({ path: `/regionle/${file.replace('.html', '')}`, languages: [other] }).lang, file).toBe(pageLangOf(page));
      expect(run({ saved: { lang: other.slice(0, 2) }, path: `/regionle/${file}` }).lang, file).toBe(other.slice(0, 2));
    }
    // A folder or a file that only looks like one of them is not one.
    expect(run({ path: '/regions/', languages: ['es-ES'] }).lang).toBe('es');
    expect(run({ path: '/regionle/myregions.html', languages: ['es-ES'] }).lang).toBe('es');
    expect(run({ path: '/regionle/regions.htm', languages: ['es-ES'] }).lang).toBe('es');
    expect(run({ path: '/regionle/poblaciones.html', languages: ['en-GB'] }).lang).toBe('en');
  });

  it('is the one of the page of a map too, by the word its name starts with', () => {
    for (const page of MAPS) {
      const file = pageFile(page);
      const other = page.lang === 'es' ? 'en-GB' : 'es-ES';
      expect(run({ path: `/regionle/${file}`, languages: [other] }).lang, file).toBe(page.lang);
      expect(run({ path: `/regionle/${file.replace('.html', '')}`, languages: [other] }).lang, file).toBe(page.lang);
      // The choice of the player counts for more than the page.
      expect(run({ saved: { lang: other.slice(0, 2) }, path: `/regionle/${file}` }).lang, file).toBe(other.slice(0, 2));
    }
    expect(run({ path: '/regionle/map-x1-northern-cyprus.html', languages: ['es-ES'] }).lang).toBe('en');
    // A name that only looks like that of the page of a map is not one: the browser decides.
    expect(run({ path: '/regionle/map-spain.html', languages: ['es-ES'] }).lang).toBe('es');
    expect(run({ path: '/regionle/mapa-espana.html', languages: ['en-GB'] }).lang).toBe('en');
    expect(run({ path: '/regionle/mapas-es-espana.html', languages: ['en-GB'] }).lang).toBe('en');
    expect(run({ path: '/regionle/xmap-es-spain.html', languages: ['es-ES'] }).lang).toBe('es');
    expect(run({ path: '/regionle/map-ES-spain.html', languages: ['es-ES'] }).lang).toBe('es');
    expect(run({ path: '/map-es-spain/', languages: ['es-ES'] }).lang).toBe('es');
  });

  it('is the first of the browser that the game speaks, and Spanish when it speaks none', () => {
    expect(run({ languages: ['en-US', 'es'] }).lang).toBe('en');
    expect(run({ languages: ['fr-FR', 'en'] }).lang).toBe('en');
    expect(run({ languages: ['ca', 'es-ES', 'en'] }).lang).toBe('es');
    expect(run({ languages: ['de-DE'] }).lang).toBe('es');
    expect(run({ path: '/regionle/index.html', languages: ['en'] }).lang).toBe('en');
  });

  it('sets the theme too, and is not upset by what it finds saved', () => {
    expect(run({ dark: true }).dataset.theme).toBe('dark');
    expect(run({ saved: { theme: 'light' }, dark: true }).dataset.theme).toBe('light');
    expect(run({ raw: '{not json', languages: ['en'] }).lang).toBe('es');
    expect(run({ raw: 'null', languages: ['en'] }).lang).toBe('es');
  });
});

describe('the file the first screen waits for', () => {
  const inline = [...source.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1]).find((code) => code.includes('__regionleIndex'))!;

  it('is asked for by the page itself, before anything that could hold it back', () => {
    const asked: string[] = [];
    const window: { __regionleIndex?: Promise<unknown> } = {};
    vm.runInNewContext(inline, { window, fetch: (url: string) => (asked.push(url), Promise.resolve('answer')) });
    expect(asked).toEqual(['./data/index.json']);
    expect(window.__regionleIndex).toBeInstanceOf(Promise);
    // A style sheet before the script would make it wait for the sheet: nothing of the kind comes first.
    const before = source.slice(0, source.indexOf('__regionleIndex'));
    expect(before).not.toMatch(/rel="stylesheet"|<style|<script[^>]*src=/);
    expect(before).toContain('<head>');
    expect(before).not.toContain('<body>');
  });

  it('does not break the page where it cannot be asked for', async () => {
    const window: { __regionleIndex?: Promise<unknown> } = {};
    expect(() => vm.runInNewContext(inline, { window })).not.toThrow();
    expect(window.__regionleIndex).toBeUndefined();
    // A failure is left for the game to deal with: nothing is thrown into the console.
    const failing: { __regionleIndex?: Promise<unknown> } = {};
    vm.runInNewContext(inline, { window: failing, fetch: () => Promise.reject(new Error('offline')) });
    await expect(failing.__regionleIndex).rejects.toThrow('offline');
  });
});
