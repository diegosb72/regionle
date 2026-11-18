/** Decks that are not made of countries or their divisions: cities, and continents, rivers, lakes, seas, ranges, peaks, deserts and islands. */
import { belongsToCountry, commonPlace, divisionsOf, frameForCountries, frameForLand, loadFile, loadIndex, loadWorldGeo, properNames } from './data';
import { sightFor } from './geo';
import { L, nm } from './i18n';
import { PHYS_KINDS, isWater, kindNoun, parsePhys, physMatches, physTokens, typeNoun, type PhysSpec, type PhysType } from './phys';
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

/**
 * `must` lists cities the map has to hold whatever the choice: the ones a review is about. `belongs` asks
 * for what each city is part of: its country on a map of several, its region on a map of one (which takes
 * the file of the regions of that country).
 */
export async function buildCityDeck(ids: string[], pick: CityPick, count: number, must?: string[], belongs = false): Promise<Deck> {
  const [{ index, byId }, world, file] = await Promise.all([loadIndex(), loadWorldGeo(), loadCities()]);
  const chosen = [...new Set(ids)].map((id) => byId.get(id)).filter((c): c is Country => !!c && c.cl !== 'other' && !!file.c[c.id]);
  const sel = new Set(chosen.map((c) => c.id));
  const context: Geo[] = [];
  const base: Geo[] = [];
  for (const [id, g] of world) (sel.has(id) ? base : context).push(g);

  const picked = pickCities(file, chosen, pick, count, must);
  const several = chosen.length > 1;
  const divisions = belongs && !several && chosen[0] ? await divisionsOf(chosen[0]).catch(() => null) : null;
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
    belongs: !belongs ? undefined : several ? belongsToCountry(country) : rec.u ? divisions?.get(rec.u) : undefined,
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
export { PHYS_COUNTRY_MIN, PHYS_KINDS, PHYS_PLACES, countryToken, isWater, kindNoun, parsePhys, physCountries, physMatches, physTokens, pickOf, typeNoun, type PhysKind, type PhysSpec, type PhysType } from './phys';


interface PhysRec {
  i: string;
  k: PhysType;
  n: Named;
  al?: string[];
  ct: string[];
  /** 1 = the ones met at school · 2 = the rest · 3 = only on the map of its own country */
  r: 1 | 2 | 3;
  /** One of the best known on the map of its country. */
  h?: 1;
  /** The countries it is asked in. */
  co?: string[];
  /** 'res' for a reservoir among the lakes. */
  t?: string;
  wd?: string;
  ar?: number;
  /** Peaks: metres above sea level. */
  el?: number;
  lp: LL;
  fp: LL[];
  /** 'L' lines or 'A' rings, each a flat list: the first point and then the steps, in thousandths of a degree. Peaks have none: they are the point `lp`. */
  g?: ['L' | 'A', number[][]];
  /**
   * An ocean with its seas, in rings like those of `g`: for the maps that ask no sea, where the Caribbean has
   * to answer to an ocean. On a map of seas each stretch of water is one piece, and the ocean is the open one.
   */
  gw?: ['A', number[][]];
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

function geometryOf(rec: PhysRec, scale: number, whole = false): AnyGeo['geometry'] {
  const g = (whole && rec.gw) || rec.g;
  if (!g) return { type: 'Point', coordinates: rec.lp };
  const parts = g[1].map((flat) => decode(flat, scale));
  if (g[0] === 'L') return { type: 'MultiLineString', coordinates: parts };
  return { type: 'MultiPolygon', coordinates: parts.map((ring) => [ring]) };
}

/** How many features a selection holds, without building anything. */
export function countPhys(file: PhysFile, spec: PhysSpec): number {
  return file.f.filter((f) => physMatches(f, spec)).length;
}

/**
 * Seas first and rivers last: what is drawn later lies on top and gets the click. A continent lies under
 * everything that stands on it, a peninsula under its plains, and a plain under the ranges that cross it.
 */
const ORDER: Record<PhysType, number> = { ocean: 0, sea: 0, continent: 0.5, desert: 1, peninsula: 1.2, plain: 1.5, range: 2, island: 3, lake: 4, river: 5, peak: 6, cape: 7, fall: 7 };

/**
 * The selection that a set of features fits in: their kinds, their continents (the world if they are many),
 * everything if any is little known. With `country`, on the map of that country: what is only asked there
 * would be a speck on a continent.
 */
function specAround(file: PhysFile, ids: string[], country?: string): PhysSpec {
  const recs = file.f.filter((f) => ids.includes(f.i));
  // A continent is only asked on the map of the world, and there the oceans come with it; without one, with the seas.
  const whole = recs.some((f) => f.k === 'continent');
  const kinds = PHYS_KINDS.filter((k) => recs.some((f) => (f.k === 'ocean' ? k === (whole ? 'continent' : 'sea') : f.k === k)));
  if (whole) return { kinds, places: [], all: recs.some((f) => f.r === 2) };
  // Features of one country alone, with any that no continent shows: the map of that country, though nobody said so.
  const shared = country ?? (recs.some((f) => f.r === 3) ? recs[0]?.co?.find((c) => recs.every((f) => f.co?.includes(c))) : undefined);
  if (shared) return { kinds, places: [], all: recs.some((f) => f.r !== 1 && !f.h), country: shared };
  const places = [...new Set(recs.map((f) => f.ct[0]))];
  return { kinds, places: places.length > 2 ? [] : places, all: recs.some((f) => f.r === 2) };
}

/**
 * With `must`, the map is drawn around those features and the tokens are ignored (a review); with
 * `keep`, the map is the one the tokens ask for and those features are added to it (a custom list).
 */
export async function buildPhysicalDeck(tokens: string[], must?: string[], keep = false): Promise<Deck> {
  const [{ index, byId }, world, file] = await Promise.all([loadIndex(), loadWorldGeo(), loadPhysical()]);
  const asked = parsePhys(tokens);
  const around = must?.length && !keep ? specAround(file, must, asked.country) : null;
  const spec = around?.kinds.length ? around : asked;
  const land = spec.country ? byId.get(spec.country) : undefined;
  const continent = (id: string): Country => ({ id: `@${id}`, a3: '', n: index.continents[id] ?? { es: id }, ct: id, sr: '', cl: 'other', ar: 0, lp: [0, 0], fp: [], lv: [], dl: 'f' });
  const pseudo = new Map<string, Country>();
  const home = (rec: PhysRec): Country => {
    const id = rec.ct.find((c) => spec.places.includes(c)) ?? rec.ct[0];
    // On the map of a country every feature is of that country, by name: it has no flag to show here.
    if (!pseudo.has(id)) pseudo.set(id, land ? { ...continent(id), id: `@in:${land.id}`, n: land.n } : continent(id));
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
  const recs = file.f.filter((f) => physMatches(f, spec) || must?.includes(f.i)).sort((a, b) => ORDER[a.k] - ORDER[b.k] || (b.ar ?? size(b)) - (a.ar ?? size(a)));
  // With no sea to ask, an ocean takes its seas in: every stretch of salt water answers to one of the five.
  const whole = !recs.some((rec) => rec.k === 'sea');
  const items: Item[] = recs.map((rec) => ({
    id: rec.i,
    kind: 'feature',
    shape: !rec.g ? 'point' : rec.g[0] === 'L' ? 'line' : 'area',
    cat: rec.k,
    under: isWater(rec.k),
    name: nm(rec.n),
    en: rec.n.en ?? rec.n.es,
    answers: [rec.n.es, rec.n.en ?? '', ...(rec.al ?? [])],
    // No initials here: "Lago", "Mar" or "Golfo" is the kind of thing, and "LS" would say no more than "S".
    proper: [],
    // …but those the player gives it in the settings.
    short: editOf(rec.i),
    country: home(rec),
    type: rec.t === 'res' ? L('embalse', 'reservoir') : typeNoun(rec.k),
    geo: { type: 'Feature', id: rec.i, properties: {}, geometry: geometryOf(rec, file.scale, whole) } as AnyGeo,
    lp: rec.lp,
    fp: rec.fp,
    area: rec.ar ?? 0,
    elev: rec.el,
    nb: [],
    sl: [],
    wd: rec.wd,
  }));

  // A frame is made of land. A sea that only touches a far corner of it is brought in as far as it takes to see it.
  const waters = items.filter((it) => isWater(it.cat)).map((it) => ({ geo: it.geo, at: it.lp }));
  const inSight = (frame: LL[]): LL[] => [...frame, ...sightFor(frame, waters)];

  const single = spec.kinds.length === 1 ? kindNoun(spec.kinds[0]) : null;
  const many = single?.many ?? L('geografía física', 'physical geography');
  const noun = single ?? { one: L('elemento', 'feature'), many: L('elementos', 'features'), fem: false };
  const title = (where: string) => `${many[0].toUpperCase()}${many.slice(1)} · ${where}`;
  const common = { key: `p:${physTokens(spec).join(',')}`, scope: 'physical' as const, items, byId: new Map(items.map((it) => [it.id, it])), extras: [], outline: [], countries: [], noun };

  if (land) {
    // One country: its land stands out from the rest, and sets the frame with whatever of it lies in sight.
    const base: Geo[] = [];
    const context: Geo[] = [];
    for (const [id, g] of world) (id === land.id ? base : context).push(g);
    // What is asked has to be in sight, but only as far as the country reaches and a little more: the Rhine is
    // not followed to the sea on the map of France, nor the Atlantic to its far shore on any.
    const g = world.get(land.id)?.geometry;
    const rings = !g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((poly) => poly[0]);
    let w = Infinity;
    let e = -Infinity;
    let s = Infinity;
    let n = -Infinity;
    for (const ring of rings)
      for (const p of ring) {
        w = Math.min(w, p[0]);
        e = Math.max(e, p[0]);
        s = Math.min(s, p[1]);
        n = Math.max(n, p[1]);
      }
    const pad = Math.max(e - w, n - s) * 0.12;
    const near = (p: LL) => p[0] >= w - pad && p[0] <= e + pad && p[1] >= s - pad && p[1] <= n + pad;
    const sight = items.flatMap((it) => (isWater(it.cat) ? [it.lp] : it.fp)).filter(near);
    return { ...common, context, base, frame: inSight(frameForLand([land], world, sight)), title: title(nm(land.n)) };
  }

  // The frame is the continents asked about, not the features: the Atlantic would otherwise open the map of Europe to both poles.
  const lands = index.countries.filter((c) => c.cl === 'un' && (!spec.places.length || spec.places.includes(c.ct)));
  const where = !spec.places.length ? L('Mundo', 'World') : spec.places.map((p) => (index.continents[p] ? nm(index.continents[p]) : p)).join(', ');
  return {
    ...common,
    context: [],
    base: [...world.values()],
    // …but what is asked has to be in sight: the Ural or the rivers of Siberia lie outside the countries of their
    // continent, and on the map of the world no country brings in Antarctica or what is asked of it.
    frame: inSight([...(spec.places.length ? frameForCountries(lands) : lands.flatMap((c) => c.fp)), ...items.filter((it) => !isWater(it.cat)).flatMap((it) => it.fp)]),
    title: title(where),
  };
}
