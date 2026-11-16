/** Outbound links to places where the thing just asked can be studied. */
import type { Country, Item } from './types';

export interface StudyLink {
  kind: 'wiki' | 'map' | 'video' | 'data' | 'list';
  label: string;
  title: string;
  href: string;
}

const q = encodeURIComponent;

function wikipedia(wd: string | undefined, query: string): string {
  // The Wikidata redirect opens the Spanish article and falls back to the English one.
  return wd ? `https://www.wikidata.org/wiki/Special:GoToLinkedPage/eswiki,enwiki/${wd}` : `https://es.wikipedia.org/w/index.php?search=${q(query)}`;
}

function osmZoom(areaKm2: number): number {
  const z = Math.round(9.5 - Math.log2(Math.sqrt(Math.max(areaKm2, 0.5)) / 60));
  return Math.max(3, Math.min(14, z));
}

export function linksFor(item: Item): StudyLink[] {
  const place = item.kind === 'country' ? item.name : `${item.name}, ${item.country.n.es}`;
  const [lon, lat] = item.lp;
  const z = osmZoom(item.area);
  const links: StudyLink[] = [
    { kind: 'wiki', label: 'Wikipedia', title: `Artículo de ${item.name} en Wikipedia`, href: wikipedia(item.wd, place) },
    {
      kind: 'map',
      label: 'Mapa',
      title: `${item.name} en OpenStreetMap`,
      href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${z}/${lat}/${lon}`,
    },
    {
      kind: 'video',
      label: 'Vídeos',
      title: `Vídeos sobre ${item.name}`,
      href: `https://www.youtube.com/results?search_query=${q(`${place} geografía`)}`,
    },
  ];
  if (item.wd) links.push({ kind: 'data', label: 'Datos', title: `${item.name} en Wikidata`, href: `https://www.wikidata.org/wiki/${item.wd}` });
  return links;
}

/** Reading about how a country is divided. */
export function divisionsLink(c: Country): StudyLink {
  return {
    kind: 'list',
    label: `Organización territorial de ${c.n.es}`,
    title: `Buscar en Wikipedia cómo se divide ${c.n.es}`,
    href: `https://es.wikipedia.org/w/index.php?search=${q(`Organización territorial de ${c.n.es}`)}`,
  };
}
