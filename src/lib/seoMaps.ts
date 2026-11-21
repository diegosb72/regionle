/**
 * The pages of the maps of the countries (`mapa-es-espana.html`, `map-es-spain.html`): which countries have
 * one, what each is called and what it says of its map. Worked out from the list of countries the game
 * reads, by the build when it writes the pages (`vite.config.ts`) and by the game when it is on one of them
 * (`screens/Setup.tsx`), so that both say the same.
 *
 * Kept apart from `seo.ts`, which travels with the first screen: this is only read where a map is chosen.
 * Plain data and text, read by Node as well: nothing of the browser may be used.
 */
import { MAP_WORD, SEO_LANGS, mapPageNamed, type MapPage, type SeoLang } from './seo';

/** A name as an address carries it: small letters and figures, no accents, and a hyphen for anything else. */
export function slugOf(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** What is known of a country when its page is written: its code, its name and the levels its map can be played at. */
export interface MapSource {
  id: string;
  n: { es: string; en?: string };
  /** What kind of territory it is: one that is "other" is not a country to choose (lib/world.ts). */
  cl?: string;
  /** From the coarsest to the finest: how many pieces, and what they are called. */
  lv: readonly { n: number; es: string; en: string }[];
}

/** Several things in a row: with commas and a last "y", or apart with semicolons when one of them has an "y" of its own. */
function row(parts: readonly string[], and: string): string {
  if (parts.length < 2) return parts.join('');
  if (parts.some((p) => p.includes(` ${and} `))) return parts.join('; ');
  return `${parts.slice(0, -1).join(', ')} ${and} ${parts[parts.length - 1]}`;
}

/**
 * The pages of the maps: two for each country that can be chosen among the regions, which are those whose
 * map has two pieces or more at its finest (`eligible` in lib/world.ts: a page for a map the game would not
 * open would be a page about nothing). A page is called after the finest pieces of its map, which are what
 * it opens the game on, and tells how many there are at each level.
 */
export function mapPagesOf(countries: readonly MapSource[]): MapPage[] {
  const pages: MapPage[] = [];
  const taken = new Set<string>();
  for (const c of countries) {
    const finest = c.lv[c.lv.length - 1];
    if (c.cl === 'other' || !finest || finest.n < 2 || !/^[A-Z][A-Z0-9]$/.test(c.id)) continue;
    // A level of one piece is no map to tell of: the map is that of its finer levels.
    const levels = c.lv.filter((l) => l.n >= 2);
    const name: Record<SeoLang, string> = { es: c.n.es, en: c.n.en ?? c.n.es };
    const files = { es: `${MAP_WORD.es}-${c.id.toLowerCase()}-${slugOf(name.es)}`, en: `${MAP_WORD.en}-${c.id.toLowerCase()}-${slugOf(name.en)}` };
    for (const lang of SEO_LANGS) {
      // Two countries of one name would be one page: better no site than a page that hides another.
      if (taken.has(files[lang]) || !mapPageNamed(files[lang])) throw new Error(`seo: no hay un nombre de página para el mapa de ${c.id} (${files[lang]})`);
      taken.add(files[lang]);
    }
    pages.push(
      {
        map: c.id,
        lang: 'es',
        files,
        name: `${name.es}: ${finest.es} en el mapa`,
        description: `${name.es} en el mapa: ${row(levels.map((l) => `${l.n} ${l.es}`), 'y')}. Juega a señalar, identificar, reconocer siluetas y montar el puzle, gratis y sin registro, hasta saberte el mapa entero.`,
      },
      {
        map: c.id,
        lang: 'en',
        files,
        name: `${name.en}: ${finest.en} on the map`,
        description: `${name.en} on the map: ${row(levels.map((l) => `${l.n} ${l.en}`), 'and')}. Pin, identify, tell outlines apart and piece the jigsaw together, free and with no sign-up, until you know the whole map.`,
      },
    );
  }
  return pages;
}
