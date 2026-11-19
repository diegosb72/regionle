/** Turns a selection of countries into a playable deck. The files themselves are fetched in `world.ts`. */
import type { MultiLineString } from 'geojson';
import { feature, mesh } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { L, capName, getLang, levelNoun, nm } from './i18n';
import type { Answerable } from './text';
import { editOf } from './typeins';
import type { Belongs, Country, Deck, Extra, Geo, Item, LL, Level } from './types';
import { commonPlace, fetchFile, fineCount, isFeminine, levelOf, loadFile, loadIndex, loadWorldGeo, once } from './world';

export { commonPlace, eligible, fineCount, isFeminine, levelOf, loadFile, loadIndex, loadWorldGeo, setLoader, type World } from './world';

interface UnitProps {
  n: { es: string; en?: string; lo?: string };
  al?: string[];
  t?: string;
  q?: 0;
  wd?: string;
  lp: LL;
  fp: LL[];
  ar: number;
  nb?: string[];
  sl?: string[];
  g?: string[];
  m?: string[];
}

interface RegionFile {
  topo: Topology;
  /** Properties of every finest-level unit. */
  fine: Map<string, UnitProps>;
  groupName: Map<string, UnitProps['n']>;
  /** Properties of every unit of the coarser levels. */
  groups: Map<string, UnitProps>;
  levels: Map<string, Geo[]>;
  outline?: MultiLineString;
}

function loadRegion(id: string): Promise<RegionFile> {
  return once(`r/${id}`, async () => {
    const topo = (await fetchFile(`r/${id}.json`)) as Topology;
    const fine = new Map<string, UnitProps>();
    const groupName = new Map<string, UnitProps['n']>();
    const groups = new Map<string, UnitProps>();
    for (const [k, obj] of Object.entries(topo.objects)) {
      for (const g of (obj as GeometryCollection).geometries) {
        const p = g.properties as unknown as UnitProps;
        if (k === 'f') fine.set(String(g.id), p);
        else {
          groupName.set(String(g.id), p.n);
          groups.set(String(g.id), p);
        }
      }
    }
    return { topo, fine, groupName, groups, levels: new Map() };
  });
}

function levelFeatures(file: RegionFile, k: string): Geo[] {
  let list = file.levels.get(k);
  if (!list) {
    const fc = feature(file.topo, file.topo.objects[k] as GeometryCollection) as unknown as { features: Geo[] };
    list = fc.features;
    file.levels.set(k, list);
  }
  return list;
}

/**
 * The national border: every line of the finest level that has a subdivision on one side only. Taken
 * from the same file as the subdivisions, it lies exactly on their edges at any zoom.
 */
function outlineOf(file: RegionFile): MultiLineString {
  return (file.outline ??= mesh(file.topo, file.topo.objects.f as GeometryCollection, (a, b) => a === b));
}

async function mapLimit<T, R>(list: T[], limit: number, fn: (item: T) => Promise<R>, tick?: (done: number) => void): Promise<R[]> {
  const out = new Array<R>(list.length);
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, list.length) }, async () => {
      while (next < list.length) {
        const i = next++;
        out[i] = await fn(list[i]);
        tick?.(++done);
      }
    }),
  );
  return out;
}

// ---------------------------------------------------------------------------
// Selection helpers
// ---------------------------------------------------------------------------

/** Europe is framed without Siberia or the Arctic so that the usual map of the continent appears. */
const EUROPE_BOX = { w: -27, e: 50, s: 33, n: 72.5 };

export function frameForCountries(chosen: Country[]): LL[] {
  const europe = chosen.length > 1 && chosen.every((c) => c.ct === 'EU');
  const out: LL[] = [];
  for (const c of chosen) {
    const pts = europe ? c.fp.filter((p) => p[0] >= EUROPE_BOX.w && p[0] <= EUROPE_BOX.e && p[1] >= EUROPE_BOX.s && p[1] <= EUROPE_BOX.n) : c.fp;
    out.push(...pts);
  }
  return out.length ? out : chosen.flatMap((c) => c.fp);
}

/**
 * Frame for a map of cities: the real outline of the land they stand on, and the cities themselves.
 * The hulls kept in the index are meant for maps of many countries and fall short of the coast by tens
 * of kilometres, which shows when a single country fills the screen.
 */
export function frameForLand(chosen: Country[], world: Map<string, Geo>, cities: LL[]): LL[] {
  const europe = chosen.length > 1 && chosen.every((c) => c.ct === 'EU');
  const inBox = (p: number[]) => p[0] >= EUROPE_BOX.w && p[0] <= EUROPE_BOX.e && p[1] >= EUROPE_BOX.s && p[1] <= EUROPE_BOX.n;
  const out: LL[] = [];
  for (const c of chosen) {
    const g = world.get(c.id)?.geometry;
    const rings = !g ? [] : g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((poly) => poly[0]);
    const boxes = rings.map((ring) => {
      let w = Infinity;
      let e = -Infinity;
      let s = Infinity;
      let n = -Infinity;
      for (const p of ring) {
        if (p[0] < w) w = p[0];
        if (p[0] > e) e = p[0];
        if (p[1] < s) s = p[1];
        if (p[1] > n) n = p[1];
      }
      return { w, e, s, n, size: (e - w) * (n - s) };
    });
    const top = Math.max(0, ...boxes.map((b) => b.size));
    let added = false;
    rings.forEach((ring, i) => {
      const b = boxes[i];
      // The main landmass, and any island one of the cities stands on.
      if (b.size < top && !cities.some((p) => p[0] >= b.w && p[0] <= b.e && p[1] >= b.s && p[1] <= b.n)) return;
      const pts = europe ? ring.filter(inBox) : ring;
      if (!pts.length) return;
      // Sixteen points around its edge are enough to frame it, and weigh the same whatever the detail of the coast.
      const squash = Math.cos((((b.s + b.n) / 2) * Math.PI) / 180);
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * 2 * Math.PI;
        const dx = Math.cos(a) * squash;
        const dy = Math.sin(a);
        let best = pts[0];
        let score = -Infinity;
        for (const p of pts) {
          const v = p[0] * dx + p[1] * dy;
          if (v > score) {
            score = v;
            best = p;
          }
        }
        out.push([best[0], best[1]]);
      }
      added = true;
    });
    if (!added) out.push(...(europe ? c.fp.filter(inBox) : c.fp));
  }
  out.push(...cities);
  return out.length ? out : chosen.flatMap((c) => c.fp);
}

/** A division as what its pieces belong to: its names, as an answer. */
function belongsTo(id: string, p: UnitProps, type: string): Belongs {
  return { id, name: nm(p.n), type, answers: [p.n.es, p.n.en ?? '', p.n.lo ?? '', ...(p.al ?? [])].filter(Boolean), proper: properNames(p.n), short: editOf(id) };
}

/** A country as what its cities belong to. */
export function belongsToCountry(c: Country): Belongs {
  return { id: c.id, name: nm(c.n), type: L('país', 'country'), answers: [c.n.es, c.n.en ?? '', ...(c.al ?? [])].filter(Boolean), proper: properNames(c.n), short: editOf(c.id), fl: c.fl };
}

/**
 * The division each finest unit of a country is in, at the level the country is usually played at: the
 * community of a Spanish province, and the state itself where the states are that level. It is what a
 * city of that country belongs to.
 */
export async function divisionsOf(c: Country): Promise<Map<string, Belongs>> {
  const out = new Map<string, Belongs>();
  if (fineCount(c) < 2) return out;
  const file = await loadRegion(c.id);
  const coarse = c.lv.filter((l) => l.k !== 'f');
  const at = coarse.findIndex((l) => l.k === c.dl);
  const fine = c.lv.find((l) => l.k === 'f') ?? c.lv[c.lv.length - 1];
  for (const [id, p] of file.fine) {
    if (p.q === 0) continue;
    const gid = at >= 0 ? p.g?.[at] : undefined;
    const group = gid ? file.groups.get(gid) : undefined;
    out.set(id, gid && group ? belongsTo(gid, group, levelNoun(coarse[at]).one) : belongsTo(id, p, levelNoun(fine).one));
  }
  return out;
}

/** Names of the capital of a country: the one shown first, then every spelling accepted. */
function capitalNames(c: Country): string[] | undefined {
  return c.cap ? [...new Set([capName(c.cap), c.cap.es, c.cap.en, ...(c.cap.al ?? [])].filter(Boolean))] : undefined;
}

/** Capitals of the regions of each country, by level; an empty table when the file cannot be had. */
type RegionCapitals = Record<string, Record<string, Record<string, string[]>>>;
function loadRegionCapitals(): Promise<RegionCapitals> {
  return loadFile<{ rc: RegionCapitals }>('capitals.json').then(
    (f) => f.rc ?? {},
    () => ({}),
  );
}

export interface DeckSpec {
  scope: 'regions' | 'countries';
  countries: string[];
  levels?: Record<string, string>;
}

export function deckKey(spec: DeckSpec): string {
  const ids = [...new Set(spec.countries)].sort();
  if (spec.scope === 'countries') return `c:${ids.join(',')}`;
  return `r:${ids.map((id) => (spec.levels?.[id] ? `${id}.${spec.levels[id]}` : id)).join(',')}`;
}

export async function buildDeck(spec: DeckSpec, onProgress?: (done: number, total: number) => void): Promise<Deck> {
  const [{ index, byId }, world] = await Promise.all([loadIndex(), loadWorldGeo()]);
  const chosen = [...new Set(spec.countries)].map((id) => byId.get(id)).filter((c): c is Country => !!c && c.cl !== 'other');
  const sel = new Set(chosen.map((c) => c.id));
  const context: Geo[] = [];
  for (const [id, g] of world) if (!sel.has(id)) context.push(g);

  if (spec.scope === 'countries') {
    const items: Item[] = [];
    for (const c of chosen) {
      const geo = world.get(c.id);
      if (!geo) continue;
      items.push({
        id: c.id,
        kind: 'country',
        shape: 'area',
        name: nm(c.n),
        en: c.n.en ?? c.n.es,
        answers: [c.n.es, c.n.en ?? '', ...(c.al ?? [])],
        proper: properNames(c.n),
        short: editOf(c.id),
        capital: capitalNames(c),
        country: c,
        type: c.cl === 'dep' ? L('territorio', 'territory') : L('país', 'country'),
        geo,
        lp: c.lp,
        fp: c.fp,
        area: c.ar,
        nb: (c.nb ?? []).filter((id) => sel.has(id)),
        sl: (c.sl ?? []).filter((id) => sel.has(id)),
        wd: c.wd,
      });
    }
    const place = commonPlace(chosen, index, 'countries');
    return {
      key: deckKey(spec),
      scope: 'countries',
      items,
      byId: new Map(items.map((it) => [it.id, it])),
      extras: [],
      context,
      outline: [],
      frame: frameForCountries(chosen),
      countries: chosen,
      title: chosen.length === 1 ? nm(chosen[0].n) : place ? `${place} · ${items.length} ${L('países', 'countries')}` : `${items.length} ${L('países', 'countries')}`,
      noun: { one: L('país', 'country'), many: L('países', 'countries'), fem: false },
    };
  }

  const [files, capitals] = await Promise.all([mapLimit(chosen, 8, (c) => loadRegion(c.id), (done) => onProgress?.(done, chosen.length)), loadRegionCapitals()]);
  const items: Item[] = [];
  const extras: Extra[] = [];
  /** Finest unit id → id of the deck item that contains it. */
  const owner = new Map<string, string>();
  const sources = new Map<string, { file: RegionFile; units: string[] }>();
  const labels = new Set<string>();
  let anyLevel = null as Level | null;

  chosen.forEach((c, i) => {
    const file = files[i];
    const level = levelOf(c, spec.levels);
    anyLevel = level;
    const noun = levelNoun(level);
    labels.add(noun.one);
    for (const geo of levelFeatures(file, level.k)) {
      const p = geo.properties as unknown as UnitProps;
      const id = String(geo.id);
      if (p.q === 0) {
        extras.push({ id, name: nm(p.n), geo });
        continue;
      }
      const units = level.k === 'f' ? [id] : (p.m ?? []);
      for (const u of units) owner.set(u, id);
      sources.set(id, { file, units });
      const parentId = level.k === 'f' ? p.g?.[p.g.length - 1] : undefined;
      const parentProps = parentId ? file.groups.get(parentId) : undefined;
      // The group it is in is one of the level just above the finest.
      const parentLevel = c.lv.length > 1 ? c.lv[c.lv.length - 2] : undefined;
      items.push({
        id,
        kind: 'unit',
        shape: 'area',
        name: nm(p.n),
        en: p.n.en ?? p.n.es,
        lo: p.n.lo,
        answers: [p.n.es, p.n.en ?? '', p.n.lo ?? '', ...(p.al ?? [])],
        proper: properNames(p.n),
        short: editOf(id),
        within: c.id,
        capital: capitals[c.id]?.[level.k]?.[id],
        country: c,
        // The data names odd units ("ciudad autónoma") in Spanish only.
        type: (getLang() === 'es') ? (p.t ?? noun.one) : noun.one,
        parent: parentId && file.groupName.has(parentId) ? nm(file.groupName.get(parentId)!) : undefined,
        belongs: parentId && parentProps && parentLevel ? belongsTo(parentId, parentProps, levelNoun(parentLevel).one) : undefined,
        geo,
        lp: p.lp,
        fp: p.fp,
        area: p.ar,
        nb: [],
        sl: [],
        wd: p.wd,
      });
    }
  });

  for (const it of items) {
    const src = sources.get(it.id)!;
    const nb = new Set<string>();
    const sl = new Set<string>();
    for (const u of src.units) {
      const p = src.file.fine.get(u);
      if (!p) continue;
      for (const n of p.nb ?? []) {
        const o = owner.get(n);
        if (o && o !== it.id) nb.add(o);
      }
      for (const n of p.sl ?? []) {
        const o = owner.get(n);
        if (o && o !== it.id) sl.add(o);
      }
    }
    it.nb = [...nb];
    it.sl = [...sl].filter((id) => !nb.has(id));
  }

  const single = chosen.length === 1 ? levelOf(chosen[0], spec.levels) : null;
  const shared: Level | null = labels.size === 1 ? anyLevel : null;
  const named = single ?? shared;
  const one = named ? levelNoun(named).one : L('región', 'region');
  const many = named ? levelNoun(named).many : L('regiones', 'regions');
  const place = commonPlace(chosen, index, 'regions');
  return {
    key: deckKey(spec),
    scope: 'regions',
    items,
    byId: new Map(items.map((it) => [it.id, it])),
    extras,
    context,
    outline: chosen.map((c, i) => ({ id: c.id, geo: outlineOf(files[i]) })),
    frame: items.flatMap((it) => it.fp),
    countries: chosen,
    title: single ? `${nm(chosen[0].n)} · ${many}` : `${place ?? `${chosen.length} ${L('países', 'countries')}`} · ${items.length} ${many}`,
    noun: { one, many, fem: isFeminine(one) },
  };
}

/** Adjacency of a deck, by land only or including short sea crossings. */
export function deckGraph(deck: Deck, withSea = true): Map<string, string[]> {
  const g = new Map<string, string[]>();
  for (const it of deck.items) g.set(it.id, withSea ? [...it.nb, ...it.sl] : it.nb);
  return g;
}

/** Sea crossings between deck items, each pair once, as label-point pairs for drawing. */
export function seaLinks(deck: Deck): [LL, LL][] {
  const out: [LL, LL][] = [];
  for (const it of deck.items) {
    for (const id of it.sl) {
      const other = deck.byId.get(id);
      if (other && it.id < id) out.push([it.lp, other.lp]);
    }
  }
  return out;
}

/**
 * The names proper of something, the one on show first: initials are taken from them, and only where the
 * one on show has several words.
 */
export function properNames(n: { es: string; en?: string; lo?: string }): string[] {
  return [...new Set([nm(n), n.es, n.en ?? '', n.lo ?? ''].filter(Boolean))];
}

/** A country as something to be named by typing, where it is not a piece of the deck. */
export function countryAnswers(c: Country): Answerable {
  return { id: c.id, answers: [c.n.es, c.n.en ?? '', ...(c.al ?? [])], proper: properNames(c.n), short: editOf(c.id) };
}

/** A country as a quiz item without geometry: enough for results lists and study links. */
export function countryItem(c: Country): Item {
  return {
    id: c.id,
    kind: 'country',
    shape: 'area',
    name: nm(c.n),
    en: c.n.en ?? c.n.es,
    answers: [c.n.es, c.n.en ?? '', ...(c.al ?? [])],
    proper: properNames(c.n),
    short: editOf(c.id),
    capital: capitalNames(c),
    country: c,
    type: c.cl === 'dep' ? L('territorio', 'territory') : L('país', 'country'),
    geo: null as unknown as Geo,
    lp: c.lp,
    fp: c.fp,
    area: c.ar,
    nb: c.nb ?? [],
    sl: c.sl ?? [],
    wd: c.wd,
  };
}
