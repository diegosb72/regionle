/** Decks that are not made of countries or their divisions: cities, and rivers, lakes, seas, ranges, peaks, deserts and islands. */
import { commonPlace, frameForCountries, frameForLand, loadFile, loadIndex, loadWorldGeo, properNames } from './data';
import { L, nm } from './i18n';
import { PHYS_KINDS, kindNoun, parsePhys, physTokens, type PhysKind, type PhysSpec } from './phys';
import { editOf } from './typeins';
import type { AnyGeo, Country, Deck, Geo, Item, LL, Named } from './types';

// ---------------------------------------------------------------------------
// Cities
// ---------------------------------------------------------------------------

interface CityRec {
  i: string;
  n: Named;
  ll: LL;
  /** Inhabitants of the urban area. */
  p: number;
  /** 3 capital of the country · 2 its second capital · 1 capital of a region */
  k?: number;
  /** Finest division it stands in. */
  u?: string;
  wd?: string;
  al?: string[];
}
interface CitiesFile {
  c: Record<string, CityRec[]>;
}
interface CapitalsFile {
  /** country → level → division → names of its capital (the first one is shown, all are accepted). */
  rc: Record<string, Record<string, Record<string, string[]>>>;
}

export const loadCities = (): Promise<CitiesFile> => loadFile<CitiesFile>('cities.json');
export const loadCapitals = (): Promise<CapitalsFile> => loadFile<CapitalsFile>('capitals.json');

/** Which cities of the chosen countries are played. */
export type CityPick = 'top' | 'caps' | 'regcaps';
export const CITY_COUNTS = [10, 25, 50, 100] as const;

/** Countries with enough cities on the map for a game of their own. */
export function cityCount(file: CitiesFile, id: string): number {
  return file.c[id]?.length ?? 0;
}

function pickCities(file: CitiesFile, chosen: Country[], pick: CityPick, count: number, must?: string[]): { rec: CityRec; country: Country }[] {
  const all = chosen.flatMap((country) => (file.c[country.id] ?? []).map((rec) => ({ rec, country })));
  const list = pick === 'caps' ? all.filter((x) => x.rec.k === 3) : pick === 'regcaps' ? all.filter((x) => (x.rec.k ?? 0) >= 1) : all.sort((a, b) => b.rec.p - a.rec.p).slice(0, count);
  if (must?.length) {
    const have = new Set(list.map((x) => x.rec.i));
    for (const x of all) if (must.includes(x.rec.i) && !have.has(x.rec.i)) list.push(x);
  }
  return list;
}

/** `must` lists cities the map has to hold whatever the choice: the ones a review is about. */
export async function buildCityDeck(ids: string[], pick: CityPick, count: number, must?: string[]): Promise<Deck> {
  const [{ index, byId }, world, file] = await Promise.all([loadIndex(), loadWorldGeo(), loadCities()]);
  const chosen = [...new Set(ids)].map((id) => byId.get(id)).filter((c): c is Country => !!c && c.cl !== 'other' && !!file.c[c.id]);
  const sel = new Set(chosen.map((c) => c.id));
  const context: Geo[] = [];
  const base: Geo[] = [];
  for (const [id, g] of world) (sel.has(id) ? base : context).push(g);

  const picked = pickCities(file, chosen, pick, count, must);
  const several = chosen.length > 1;
  const items: Item[] = picked.map(({ rec, country }) => ({
    id: rec.i,
    kind: 'city',
    shape: 'point',
    name: nm(rec.n),
    en: rec.n.en ?? rec.n.es,
    answers: [rec.n.es, rec.n.en ?? '', ...(rec.al ?? [])],
    proper: properNames(rec.n),
    short: editOf(rec.i),
    country,
    type: rec.k === 3 ? L('capital', 'capital') : L('ciudad', 'city'),
    geo: { type: 'Feature', id: rec.i, properties: {}, geometry: { type: 'Point', coordinates: rec.ll } },
    lp: rec.ll,
    fp: [rec.ll],
    area: 0,
    nb: [],
    sl: [],
    wd: rec.wd,
    pop: rec.p,
    cap: rec.k ?? 0,
  }));
  const place = commonPlace(chosen, index, 'countries') ?? (several ? L(`${chosen.length} países`, `${chosen.length} countries`) : chosen[0] ? nm(chosen[0].n) : '');
  const what =
    pick === 'caps' ? L('capitales', 'capitals') : pick === 'regcaps' ? L('capitales de región', 'regional capitals') : L(`las ${items.length} ciudades más pobladas`, `the ${items.length} largest cities`);
  return {
    key: `t:${[...sel].sort().join(',')}|${pick}|${count}`,
    scope: 'cities',
    items,
    byId: new Map(items.map((it) => [it.id, it])),
    extras: [],
    context,
    base,
    outline: [],
    // The land the cities stand on sets the frame: the whole country, plus any island with a city on it.
    frame: frameForLand(chosen, world, items.map((it) => it.lp)),
    countries: chosen,
    title: `${place} · ${what}`,
    noun: pick === 'top' ? { one: L('ciudad', 'city'), many: L('ciudades', 'cities'), fem: L('f', '') === 'f' } : { one: L('capital', 'capital'), many: L('capitales', 'capitals'), fem: L('f', '') === 'f' },
  };
}

// ---------------------------------------------------------------------------
// Physical geography
// ---------------------------------------------------------------------------

// What a physical map is made of, in words and as a selection, is in `phys.ts`: the first page reads it too.
export { PHYS_KINDS, PHYS_PLACES, kindNoun, parsePhys, physTokens, type PhysKind, type PhysSpec } from './phys';


interface PhysRec {
  i: string;
  k: PhysKind;
  n: Named;
  al?: string[];
  ct: string[];
  /** 1 = the ones met at school · 2 = the rest */
  r: 1 | 2;
  wd?: string;
  ar?: number;
  /** Peaks: metres above sea level. */
  el?: number;
  lp: LL;
  fp: LL[];
  /** 'L' lines or 'A' rings, each a flat list: the first point and then the steps, in thousandths of a degree. Peaks have none: they are the point `lp`. */
  g?: ['L' | 'A', number[][]];
}
interface PhysFile {
  scale: number;
  f: PhysRec[];
}

export const loadPhysical = (): Promise<PhysFile> => loadFile<PhysFile>('physical.json');

function decode(flat: number[], scale: number): LL[] {
  const out: LL[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < flat.length; i += 2) {
    x += flat[i];
    y += flat[i + 1];
    out.push([x / scale, y / scale]);
  }
  return out;
}

function geometryOf(rec: PhysRec, scale: number): AnyGeo['geometry'] {
  if (!rec.g) return { type: 'Point', coordinates: rec.lp };
  const parts = rec.g[1].map((flat) => decode(flat, scale));
  if (rec.g[0] === 'L') return { type: 'MultiLineString', coordinates: parts };
  return { type: 'MultiPolygon', coordinates: parts.map((ring) => [ring]) };
}

/** How many features a selection holds, without building anything. */
export function countPhys(file: PhysFile, spec: PhysSpec): number {
  return file.f.filter((f) => matches(f, spec)).length;
}

const matches = (f: PhysRec, spec: PhysSpec): boolean =>
  spec.kinds.includes(f.k) && (spec.all || f.r === 1) && (!spec.places.length || f.ct.some((c) => spec.places.includes(c)));

/** Seas first and rivers last: what is drawn later lies on top and gets the click. */
const ORDER: Record<PhysKind, number> = { sea: 0, desert: 1, range: 2, island: 3, lake: 4, river: 5, peak: 6 };

/** The selection that a set of features fits in: their kinds, their continents (the world if they are many), everything if any is little known. */
function specAround(file: PhysFile, ids: string[]): PhysSpec {
  const recs = file.f.filter((f) => ids.includes(f.i));
  const places = [...new Set(recs.map((f) => f.ct[0]))];
  return { kinds: PHYS_KINDS.filter((k) => recs.some((f) => f.k === k)), places: places.length > 2 ? [] : places, all: recs.some((f) => f.r === 2) };
}

/**
 * With `must`, the map is drawn around those features and the tokens are ignored (a review); with
 * `keep`, the map is the one the tokens ask for and those features are added to it (a custom list).
 */
export async function buildPhysicalDeck(tokens: string[], must?: string[], keep = false): Promise<Deck> {
  const [{ index }, world, file] = await Promise.all([loadIndex(), loadWorldGeo(), loadPhysical()]);
  const around = must?.length && !keep ? specAround(file, must) : null;
  const spec = around?.kinds.length ? around : parsePhys(tokens);
  const continent = (id: string): Country => ({ id: `@${id}`, a3: '', n: index.continents[id] ?? { es: id }, ct: id, sr: '', cl: 'other', ar: 0, lp: [0, 0], fp: [], lv: [], dl: 'f' });
  const pseudo = new Map<string, Country>();
  const home = (rec: PhysRec): Country => {
    const id = rec.ct.find((c) => spec.places.includes(c)) ?? rec.ct[0];
    if (!pseudo.has(id)) pseudo.set(id, continent(id));
    return pseudo.get(id)!;
  };
  const size = (rec: PhysRec): number => {
    let w = Infinity;
    let e = -Infinity;
    let s = Infinity;
    let n = -Infinity;
    for (const p of rec.fp) {
      w = Math.min(w, p[0]);
      e = Math.max(e, p[0]);
      s = Math.min(s, p[1]);
      n = Math.max(n, p[1]);
    }
    return (e - w) * (n - s);
  };
  const recs = file.f.filter((f) => matches(f, spec) || must?.includes(f.i)).sort((a, b) => ORDER[a.k] - ORDER[b.k] || (b.ar ?? size(b)) - (a.ar ?? size(a)));
  const items: Item[] = recs.map((rec) => ({
    id: rec.i,
    kind: 'feature',
    shape: !rec.g ? 'point' : rec.g[0] === 'L' ? 'line' : 'area',
    cat: rec.k,
    under: rec.k === 'sea',
    name: nm(rec.n),
    en: rec.n.en ?? rec.n.es,
    answers: [rec.n.es, rec.n.en ?? '', ...(rec.al ?? [])],
    // No initials here: "Lago", "Mar" or "Golfo" is the kind of thing, and "LS" would say no more than "S".
    proper: [],
    // …but those the player gives it in the settings.
    short: editOf(rec.i),
    country: home(rec),
    type: kindNoun(rec.k).one,
    geo: { type: 'Feature', id: rec.i, properties: {}, geometry: geometryOf(rec, file.scale) } as AnyGeo,
    lp: rec.lp,
    fp: rec.fp,
    area: rec.ar ?? 0,
    elev: rec.el,
    nb: [],
    sl: [],
    wd: rec.wd,
  }));

  // The frame is the continents asked about, not the features: the Atlantic would otherwise open the map of Europe to both poles.
  const lands = index.countries.filter((c) => c.cl === 'un' && (!spec.places.length || spec.places.includes(c.ct)));
  const single = spec.kinds.length === 1 ? kindNoun(spec.kinds[0]) : null;
  const where = !spec.places.length ? L('Mundo', 'World') : spec.places.map((p) => (index.continents[p] ? nm(index.continents[p]) : p)).join(', ');
  const many = single?.many ?? L('geografía física', 'physical geography');
  return {
    key: `p:${physTokens(spec).join(',')}`,
    scope: 'physical',
    items,
    byId: new Map(items.map((it) => [it.id, it])),
    extras: [],
    context: [],
    base: [...world.values()],
    outline: [],
    // …but what is asked has to be in sight: the Ural or the rivers of Siberia lie outside the countries of their continent.
    frame: spec.places.length ? [...frameForCountries(lands), ...items.filter((it) => it.cat !== 'sea').flatMap((it) => it.fp)] : lands.flatMap((c) => c.fp),
    countries: [],
    title: `${many[0].toUpperCase()}${many.slice(1)} · ${where}`,
    noun: single ?? { one: L('elemento', 'feature'), many: L('elementos', 'features'), fem: false },
  };
}
