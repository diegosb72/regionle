/**
 * What the page says about itself to search engines and to whoever shares its link: the title, the
 * description and the picture of the card, in both languages. The build writes them into the HTML
 * (`vite.config.ts`) and the game reads them from here, so that they are written once.
 *
 * Plain data and text: this file is also read by Node when the site is built, so nothing of the browser
 * may be used.
 */
export type SeoLang = 'es' | 'en';
/** The first page, which follows the language of whoever opens it, or the page of one language. */
export type SeoPage = 'index' | SeoLang;

export interface SeoText {
  /** `<title>` of the first page. */
  title: string;
  description: string;
  /** What a card on a social network says under the picture. */
  cardTitle: string;
  /** What the picture shows, for whoever cannot see it. */
  imageAlt: string;
  /** Open Graph locale. */
  locale: string;
  genre: string[];
  /** Shown instead of the game when the browser runs no scripts. */
  noscript: string;
}

export const SITE_NAME = 'Regionle ∞';

export const SEO: Record<SeoLang, SeoText> = {
  es: {
    title: 'Regionle ∞ — Aprende las regiones del mundo',
    description: 'Regionle ∞: juego de geografía sin límites para aprender los países del mundo y sus regiones, capitales, banderas, ciudades, ríos, mares y montañas.',
    cardTitle: 'Regionle ∞ — El mapa del mundo, pieza a pieza',
    imageAlt: 'Regionle ∞: el mapa del mundo, pieza a pieza. Un mapamundi con algunos países coloreados.',
    locale: 'es_ES',
    genre: ['Geografía', 'Educación'],
    noscript: 'Regionle ∞ es un juego de geografía para aprender los países del mundo y sus regiones, capitales, banderas, ciudades, ríos, mares y montañas. Necesita JavaScript para funcionar.',
  },
  en: {
    title: 'Regionle ∞ — Learn the regions of the world',
    description: 'Regionle ∞: a geography game with no limits to learn the countries of the world and their regions, capitals, flags, cities, rivers, seas and mountains.',
    cardTitle: 'Regionle ∞ — The map of the world, piece by piece',
    imageAlt: 'Regionle ∞: the map of the world, piece by piece. A world map with some countries coloured in.',
    locale: 'en_GB',
    genre: ['Geography', 'Education'],
    noscript: 'Regionle ∞ is a geography game to learn the countries of the world and their regions, capitals, flags, cities, rivers, seas and mountains. It needs JavaScript to work.',
  },
};

export const SEO_LANGS: readonly SeoLang[] = ['es', 'en'];

/** The page of each language, next to the first one: `es.html` is the game in Spanish whatever the browser asks for. */
export const LANG_PAGE: Record<SeoLang, string> = { es: 'es.html', en: 'en.html' };

/** The picture of the card, 1200 × 630 (`npm run social` draws them). */
export const SOCIAL_IMAGE: Record<SeoLang, string> = { es: 'social-es.png', en: 'social-en.png' };
export const SOCIAL_SIZE: readonly [number, number] = [1200, 630];

/** Title of a screen other than the first: its name, then that of the game. */
export function pageTitle(name: string): string {
  return `${name} — ${SITE_NAME}`;
}

/** The language a page is written in before the game starts: the first page is written in Spanish. */
export const pageLangOf = (page: SeoPage): SeoLang => (page === 'index' ? 'es' : page);

/** Where the site is published, ending in a slash; null when it has not been said (`homepage` in package.json). */
export function siteUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!/^https?:\/\//.test(url)) return null;
  return url.endsWith('/') ? url : `${url}/`;
}

/** Address of a page: the first one is the folder itself. */
export function pageUrl(site: string, page: SeoPage): string {
  return page === 'index' ? site : `${site}${LANG_PAGE[page]}`;
}

const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** What a search engine is told the game is (schema.org). */
export function jsonLd(page: SeoPage, site: string, version: string): Record<string, unknown> {
  const lang = pageLangOf(page);
  const t = SEO[lang];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE_NAME,
    url: pageUrl(site, page),
    description: t.description,
    inLanguage: page === 'index' ? [...SEO_LANGS] : lang,
    applicationCategory: 'EducationalApplication',
    genre: t.genre,
    operatingSystem: 'Any',
    browserRequirements: 'Requires JavaScript',
    softwareVersion: version,
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    image: `${site}${SOCIAL_IMAGE[lang]}`,
  };
}

/**
 * The part of `<head>` that changes with the page: title, description and, when the address of the site
 * is known, where the page lives, its versions in other languages, the card for social networks and
 * what the game is. Addresses have to be whole ones there, which is why they need the site.
 */
export function seoHead(page: SeoPage, site: string | null, version: string): string {
  const lang = pageLangOf(page);
  const other: SeoLang = lang === 'es' ? 'en' : 'es';
  const t = SEO[lang];
  const lines = [`<title>${esc(t.title)}</title>`, `<meta name="description" content="${esc(t.description)}" />`, `<meta name="application-name" content="${esc(SITE_NAME)}" />`];
  if (site) {
    const url = pageUrl(site, page);
    const image = `${site}${SOCIAL_IMAGE[lang]}`;
    lines.push(
      `<link rel="canonical" href="${esc(url)}" />`,
      ...SEO_LANGS.map((l) => `<link rel="alternate" hreflang="${l}" href="${esc(pageUrl(site, l))}" />`),
      `<link rel="alternate" hreflang="x-default" href="${esc(site)}" />`,
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
      `<meta property="og:title" content="${esc(t.cardTitle)}" />`,
      `<meta property="og:description" content="${esc(t.description)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:locale" content="${t.locale}" />`,
      `<meta property="og:locale:alternate" content="${SEO[other].locale}" />`,
      `<meta property="og:image" content="${esc(image)}" />`,
      `<meta property="og:image:type" content="image/png" />`,
      `<meta property="og:image:width" content="${SOCIAL_SIZE[0]}" />`,
      `<meta property="og:image:height" content="${SOCIAL_SIZE[1]}" />`,
      `<meta property="og:image:alt" content="${esc(t.imageAlt)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(t.cardTitle)}" />`,
      `<meta name="twitter:description" content="${esc(t.description)}" />`,
      `<meta name="twitter:image" content="${esc(image)}" />`,
      `<meta name="twitter:image:alt" content="${esc(t.imageAlt)}" />`,
      // "<" is written as an escape so that nothing in the text can close the script.
      `<script type="application/ld+json">${JSON.stringify(jsonLd(page, site, version)).replace(/</g, '\\u003c')}</script>`,
    );
  }
  return lines.join('\n    ');
}

const between = (html: string, mark: string, text: string): string => {
  const open = `<!--${mark}-->`;
  const close = `<!--/${mark}-->`;
  const a = html.indexOf(open);
  const b = html.indexOf(close);
  if (a < 0 || b < a) throw new Error(`index.html: falta la marca ${open} … ${close}`);
  return `${html.slice(0, a + open.length)}${text}${html.slice(b)}`;
};

/** The built page, rewritten for one page of the site: its language, its head and its message without scripts. */
export function localise(html: string, page: SeoPage, site: string | null, version: string): string {
  const lang = pageLangOf(page);
  if (!/<html lang="[a-z-]*"/.test(html)) throw new Error('index.html: falta <html lang="…">');
  let out = html.replace(/<html lang="[a-z-]*"/, `<html lang="${lang}"`);
  out = between(out, 'seo', `\n    ${seoHead(page, site, version)}\n    `);
  out = between(out, 'noscript', esc(SEO[lang].noscript));
  return out;
}

/** The pages a search engine should know: the three there are, each with its versions in other languages. */
export function sitemap(site: string, lastmod: string): string {
  const pages: SeoPage[] = ['index', ...SEO_LANGS];
  const links = [...SEO_LANGS.map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${esc(pageUrl(site, l))}" />`), `    <xhtml:link rel="alternate" hreflang="x-default" href="${esc(site)}" />`].join('\n');
  const urls = pages.map((p) => `  <url>\n    <loc>${esc(pageUrl(site, p))}</loc>\n    <lastmod>${lastmod}</lastmod>\n${links}\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function robots(site: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`;
}
