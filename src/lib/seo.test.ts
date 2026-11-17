import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { LANG_PAGE, SEO, SEO_LANGS, SOCIAL_IMAGE, jsonLd, localise, pageUrl, robots, seoHead, siteUrl, sitemap } from './seo';

const ROOT = path.join(__dirname, '../..');
const SITE = 'https://example.org/juego/';
const source = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

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

  it('lists its three pages for search engines', () => {
    const xml = sitemap(SITE, '2026-11-17');
    expect(xml.match(/<url>/g)).toHaveLength(3);
    for (const loc of [SITE, `${SITE}${LANG_PAGE.es}`, `${SITE}${LANG_PAGE.en}`]) expect(xml).toContain(`<loc>${loc}</loc>`);
    expect(xml.match(/hreflang="x-default"/g)).toHaveLength(3);
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
