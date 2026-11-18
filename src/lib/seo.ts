/**
 * What the page says about itself to search engines and to whoever shares its link: the title, the
 * description and the picture of the card, in both languages. The build writes them into the HTML
 * (`vite.config.ts`) and the game reads them from here, so that they are written once.
 *
 * Plain data and text: this file is also read by Node when the site is built, so nothing of the browser
 * may be used.
 */
export type SeoLang = 'es' | 'en';
/** The screens that have a page of their own, each by the address it has in the game (what follows `#/`). */
export type ScreenId = 'regiones' | 'paises' | 'ciudades' | 'fisica' | 'poblaciones' | 'reto' | 'acerca';
/** The page of one screen in one language: `regiones.html`, `regions.html`. */
export interface ScreenPage {
  screen: ScreenId;
  lang: SeoLang;
}
/**
 * A page of the site: the first one, which follows the language of whoever opens it; the page of one
 * language; or the page of one screen in one language.
 */
export type SeoPage = 'index' | SeoLang | ScreenPage;

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
  /** How that message ends on the page of a screen, after its description. */
  needsScripts: string;
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
    needsScripts: 'Es una pantalla de Regionle ∞, que necesita JavaScript para funcionar.',
  },
  en: {
    title: 'Regionle ∞ — Learn the regions of the world',
    description: 'Regionle ∞: a geography game with no limits to learn the countries of the world and their regions, capitals, flags, cities, rivers, seas and mountains.',
    cardTitle: 'Regionle ∞ — The map of the world, piece by piece',
    imageAlt: 'Regionle ∞: the map of the world, piece by piece. A world map with some countries coloured in.',
    locale: 'en_GB',
    genre: ['Geography', 'Education'],
    noscript: 'Regionle ∞ is a geography game to learn the countries of the world and their regions, capitals, flags, cities, rivers, seas and mountains. It needs JavaScript to work.',
    needsScripts: 'It is a screen of Regionle ∞, which needs JavaScript to work.',
  },
};

export const SEO_LANGS: readonly SeoLang[] = ['es', 'en'];

/** The page of each language, next to the first one: `es.html` is the game in Spanish whatever the browser asks for. */
export const LANG_PAGE: Record<SeoLang, string> = { es: 'es.html', en: 'en.html' };

export interface ScreenText {
  /** The name of its page, without `.html`: a word of the language, which the game also takes after `#/`. */
  file: string;
  /** How its title starts, and what it is called in the trail of pages. */
  name: string;
  description: string;
}

/**
 * The screens with a page of their own, which opens the game on them: what comes after `#` never reaches a
 * server, so without these pages a search engine, or whoever is sent a link, only ever sees the first page.
 * The game reads the name and the description of each screen from here as well (`pageMeta.ts`), so that the
 * page says the same before and after the game starts.
 */
export const SCREENS: Record<ScreenId, Record<SeoLang, ScreenText>> = {
  regiones: {
    es: {
      file: 'regiones',
      name: 'Regiones, provincias y estados',
      description: 'Aprende las provincias, estados y regiones de casi todos los países, juntas en un mismo mapa: señalar, identificar, rellenar el mapa, siluetas, vecinos y rutas.',
    },
    en: {
      file: 'regions',
      name: 'Regions, provinces and states',
      description: 'Learn the provinces, states and regions of almost every country, together on one map: pin them, identify them, fill in the map, outlines, neighbours and routes.',
    },
  },
  paises: {
    es: {
      file: 'paises',
      name: 'Países, capitales y banderas',
      description: 'Sitúa, nombra y reconoce en el mapa los países del mundo, o solo los que te interesen: capitales, banderas, siluetas, vecinos y rutas de un país a otro.',
    },
    en: {
      file: 'countries',
      name: 'Countries, capitals and flags',
      description: 'Place, name and recognise the countries of the world on the map, or just the ones you care about: capitals, flags, outlines, neighbours and routes.',
    },
  },
  ciudades: {
    es: {
      file: 'ciudades',
      name: 'Ciudades y capitales',
      description: 'Las ciudades más pobladas y las capitales de los países que elijas, punto a punto: señálalas, sitúalas a ciegas, ordénalas de norte a sur o por habitantes.',
    },
    en: {
      file: 'cities',
      name: 'Cities and capitals',
      description: 'The largest cities and the capitals of the countries you choose, dot by dot: pin them, place them blind, sort them from north to south or by people.',
    },
  },
  fisica: {
    es: {
      file: 'fisica',
      name: 'Ríos, mares y montañas',
      description: 'Aprende en el mapa los ríos, mares, cordilleras, picos, cabos e islas del mundo, de un continente o de un país, con la geografía física de España al detalle.',
    },
    en: {
      file: 'physical',
      name: 'Rivers, seas and mountains',
      description: 'Learn on the map the rivers, seas, mountain ranges, peaks, capes and islands of the world, of one continent or of one country, with Spain in full detail.',
    },
  },
  poblaciones: {
    es: {
      file: 'cifras',
      name: 'Población y superficie',
      description: 'Juega con la población, la superficie y la densidad de los países: mayor o menor, ordena cinco, cifra exacta, los diez primeros y verdadero o falso.',
    },
    en: {
      file: 'figures',
      name: 'Population and area',
      description: 'Play with the population, area and density of countries: higher or lower, sort five, the exact figure, the top ten and true or false.',
    },
  },
  reto: {
    es: {
      file: 'reto',
      name: 'Reto del día',
      description: 'El reto del día de Regionle ∞: un país y cinco pruebas, las mismas para todo el mundo, con puntos, racha y resultado para compartir.',
    },
    en: {
      file: 'daily',
      name: 'Daily challenge',
      description: 'The daily challenge of Regionle ∞: one country and five tests, the same for everyone, with points, a streak and a result to share.',
    },
  },
  acerca: {
    es: {
      file: 'acerca',
      name: 'Acerca de',
      description: 'Acerca de Regionle ∞: novedades de cada versión, atajos de teclado, qué datos se guardan y dónde, y fuentes y licencias.',
    },
    en: {
      file: 'about',
      name: 'About',
      description: 'About Regionle ∞: what each version brought, keyboard shortcuts, what data is kept and where, and sources and licences.',
    },
  },
};

export const SCREEN_IDS = Object.keys(SCREENS) as ScreenId[];

/** Every page of the site, the first one first. */
export const SITE_PAGES: readonly SeoPage[] = ['index', ...SEO_LANGS, ...SCREEN_IDS.flatMap((screen) => SEO_LANGS.map((lang): ScreenPage => ({ screen, lang })))];

const isScreen = (page: SeoPage): page is ScreenPage => typeof page === 'object';

/** The picture of the card, 1200 × 630 (`npm run social` draws them). */
export const SOCIAL_IMAGE: Record<SeoLang, string> = { es: 'social-es.png', en: 'social-en.png' };
export const SOCIAL_SIZE: readonly [number, number] = [1200, 630];

/** Title of a screen other than the first: its name, then that of the game. */
export function pageTitle(name: string): string {
  return `${name} — ${SITE_NAME}`;
}

/** The language a page is written in before the game starts: the first page is written in Spanish. */
export const pageLangOf = (page: SeoPage): SeoLang => (page === 'index' ? 'es' : isScreen(page) ? page.lang : page);

/** Where the site is published, ending in a slash; null when it has not been said (`homepage` in package.json). */
export function siteUrl(raw: string | null | undefined): string | null {
  const url = (raw ?? '').trim();
  if (!/^https?:\/\//.test(url)) return null;
  return url.endsWith('/') ? url : `${url}/`;
}

/** The file a page is written to. */
export function pageFile(page: SeoPage): string {
  if (page === 'index') return 'index.html';
  return isScreen(page) ? `${SCREENS[page.screen][page.lang].file}.html` : LANG_PAGE[page];
}

/** Address of a page: the first one is the folder itself. */
export function pageUrl(site: string, page: SeoPage): string {
  return page === 'index' ? site : `${site}${pageFile(page)}`;
}

/** The page that goes by a name, with or without its `.html` ("en", "regions.html"); null when none does. */
export function pageNamed(name: string): SeoLang | ScreenPage | null {
  const word = name.replace(/\.html$/, '');
  for (const lang of SEO_LANGS) if (LANG_PAGE[lang] === `${word}.html`) return lang;
  for (const screen of SCREEN_IDS) for (const lang of SEO_LANGS) if (SCREENS[screen][lang].file === word) return { screen, lang };
  return null;
}

/** What a page says of itself: the first page and those of a language speak of the game; that of a screen, of the screen. */
export function pageText(page: SeoPage): { title: string; description: string; cardTitle: string; noscript: string } {
  const t = SEO[pageLangOf(page)];
  if (!isScreen(page)) return { title: t.title, description: t.description, cardTitle: t.cardTitle, noscript: t.noscript };
  const screen = SCREENS[page.screen][page.lang];
  const title = pageTitle(screen.name);
  return { title, description: screen.description, cardTitle: title, noscript: `${screen.description} ${t.needsScripts}` };
}

/**
 * The same page for each language, and the one for a reader of neither: the first page, which follows the
 * browser, or the Spanish page of a screen, Spanish being what the game speaks when it has to choose.
 */
export function alternates(site: string, page: SeoPage): { lang: string; url: string }[] {
  const of = (lang: SeoLang): string => pageUrl(site, isScreen(page) ? { screen: page.screen, lang } : lang);
  return [...SEO_LANGS.map((lang) => ({ lang: lang as string, url: of(lang) })), { lang: 'x-default', url: isScreen(page) ? of('es') : site }];
}

const esc = (text: string): string => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * What a search engine is told a page is (schema.org): the game itself, or one of its screens, with the way
 * back to the game.
 */
export function jsonLd(page: SeoPage, site: string, version: string): Record<string, unknown> {
  const lang = pageLangOf(page);
  const t = SEO[lang];
  const image = `${site}${SOCIAL_IMAGE[lang]}`;
  if (isScreen(page)) {
    const screen = SCREENS[page.screen][page.lang];
    const url = pageUrl(site, page);
    const home = pageUrl(site, lang);
    return {
      '@context': 'https://schema.org',
      '@type': page.screen === 'acerca' ? 'AboutPage' : 'WebPage',
      name: pageTitle(screen.name),
      url,
      description: screen.description,
      inLanguage: lang,
      isPartOf: { '@type': 'WebApplication', name: SITE_NAME, url: home, applicationCategory: 'EducationalApplication', operatingSystem: 'Any', softwareVersion: version },
      breadcrumb: {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: SITE_NAME, item: home },
          { '@type': 'ListItem', position: 2, name: screen.name, item: url },
        ],
      },
      image,
    };
  }
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
    image,
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
  const own = pageText(page);
  const lines = [`<title>${esc(own.title)}</title>`, `<meta name="description" content="${esc(own.description)}" />`, `<meta name="application-name" content="${esc(SITE_NAME)}" />`];
  if (site) {
    const url = pageUrl(site, page);
    const image = `${site}${SOCIAL_IMAGE[lang]}`;
    lines.push(
      `<link rel="canonical" href="${esc(url)}" />`,
      ...alternates(site, page).map((a) => `<link rel="alternate" hreflang="${a.lang}" href="${esc(a.url)}" />`),
      `<meta property="og:type" content="website" />`,
      `<meta property="og:site_name" content="${esc(SITE_NAME)}" />`,
      `<meta property="og:title" content="${esc(own.cardTitle)}" />`,
      `<meta property="og:description" content="${esc(own.description)}" />`,
      `<meta property="og:url" content="${esc(url)}" />`,
      `<meta property="og:locale" content="${t.locale}" />`,
      `<meta property="og:locale:alternate" content="${SEO[other].locale}" />`,
      `<meta property="og:image" content="${esc(image)}" />`,
      `<meta property="og:image:type" content="image/png" />`,
      `<meta property="og:image:width" content="${SOCIAL_SIZE[0]}" />`,
      `<meta property="og:image:height" content="${SOCIAL_SIZE[1]}" />`,
      `<meta property="og:image:alt" content="${esc(t.imageAlt)}" />`,
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${esc(own.cardTitle)}" />`,
      `<meta name="twitter:description" content="${esc(own.description)}" />`,
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
  out = between(out, 'noscript', esc(pageText(page).noscript));
  return out;
}

/** The pages a search engine should know: every one there is, each with its versions in other languages. */
export function sitemap(site: string, lastmod: string): string {
  const urls = SITE_PAGES.map((page) => {
    const links = alternates(site, page)
      .map((a) => `    <xhtml:link rel="alternate" hreflang="${a.lang}" href="${esc(a.url)}" />`)
      .join('\n');
    return `  <url>\n    <loc>${esc(pageUrl(site, page))}</loc>\n    <lastmod>${lastmod}</lastmod>\n${links}\n  </url>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

export function robots(site: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${site}sitemap.xml\n`;
}
