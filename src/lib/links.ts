/** Outbound links to places where the thing just asked can be studied. */
import { L, getLang, nm } from './i18n';
import type { Country, Item } from './types';

export interface StudyLink {
  kind: 'wiki' | 'map' | 'video' | 'data' | 'list';
  label: string;
  title: string;
  href: string;
}

const q = encodeURIComponent;

/** A name that already says what the thing is: "Lago Ladoga", "Embalse de Alcántara", "Mar Muerto". */
const SAYS_KIND = /^(lago|laguna|lagunas|embalse|albufera|mar|gran lago|lake|loch|lough|reservoir|sea)\b|\b(lake|reservoir|sea)$/i;

/** How an item is looked up by name: "Sevilla, España", "río Ebro". */
export function placeQuery(item: Item): string {
  if (item.kind === 'country') return item.name;
  const name = item.name.replace(/\s*\(.*\)$/, '');
  if (item.kind === 'feature') {
    // A river or a lake goes with its kind in front, or "Ebro" would be the valley and "Como" the city.
    const what = item.cat === 'river' || (item.cat === 'lake' && !SAYS_KIND.test(name)) ? `${item.type} ${name}` : name;
    // On the map of a country it goes with the country too: "Sistema Central" alone could be anybody's.
    return item.country.id.startsWith('@in:') ? `${what}, ${nm(item.country.n)}` : what;
  }
  return `${name}, ${nm(item.country.n)}`;
}

function wikipedia(wd: string | undefined, query: string): string {
  // The Wikidata redirect opens the article in the language of the interface and falls back to the other one.
  const sites = getLang() === 'en' ? 'enwiki,eswiki' : 'eswiki,enwiki';
  return wd ? `https://www.wikidata.org/wiki/Special:GoToLinkedPage/${sites}/${wd}` : `https://${getLang()}.wikipedia.org/w/index.php?search=${q(query)}`;
}

function osmZoom(item: Item): number {
  if (item.kind === 'city') return 11;
  if (item.shape === 'line') return 6;
  const z = Math.round(9.5 - Math.log2(Math.sqrt(Math.max(item.area, 0.5)) / 60));
  return Math.max(3, Math.min(14, z));
}

export function linksFor(item: Item): StudyLink[] {
  const place = placeQuery(item);
  const [lon, lat] = item.lp;
  const z = osmZoom(item);
  const links: StudyLink[] = [
    { kind: 'wiki', label: 'Wikipedia', title: L(`Artículo de ${item.name} en Wikipedia`, `Wikipedia article on ${item.name}`), href: wikipedia(item.wd, place) },
    {
      kind: 'map',
      label: L('Mapa', 'Map'),
      title: L(`${item.name} en OpenStreetMap`, `${item.name} on OpenStreetMap`),
      href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${z}/${lat}/${lon}`,
    },
    {
      kind: 'video',
      label: L('Vídeos', 'Videos'),
      title: L(`Vídeos sobre ${item.name}`, `Videos about ${item.name}`),
      href: `https://www.youtube.com/results?search_query=${q(`${place} ${L('geografía', 'geography')}`)}`,
    },
  ];
  if (item.wd) links.push({ kind: 'data', label: L('Datos', 'Data'), title: L(`${item.name} en Wikidata`, `${item.name} on Wikidata`), href: `https://www.wikidata.org/wiki/${item.wd}` });
  return links;
}

/** Reading about how a country is divided. */
export function divisionsLink(c: Country): StudyLink {
  const name = nm(c.n);
  const query = L(`Organización territorial de ${name}`, `Administrative divisions of ${name}`);
  return {
    kind: 'list',
    label: query,
    title: L(`Buscar en Wikipedia cómo se divide ${name}`, `Search Wikipedia for how ${name} is divided`),
    href: `https://${getLang()}.wikipedia.org/w/index.php?search=${q(query)}`,
  };
}
