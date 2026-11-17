/**
 * The generated data files as they are fetched, and the few things said about a country that need nothing
 * else. This is all the first screen takes from the data: decks, with the names and the type-ins that
 * come with them, are built in `data.ts`, which the screens that play bring along.
 */
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { L } from './i18n';
import type { Country, Geo, Index, Level, Section } from './types';

type Loader = (path: string) => Promise<unknown>;

/**
 * The index is asked for by the page itself as soon as it opens (index.html), before this script has
 * arrived: that answer is taken, once. Null when there is none, or when it did not come out well.
 */
async function early(path: string): Promise<Response | null> {
  if (path !== 'index.json' || typeof window === 'undefined') return null;
  const page = window as { __regionleIndex?: Promise<Response> | null };
  const asked = page.__regionleIndex;
  page.__regionleIndex = null;
  try {
    const res = await asked;
    return res?.ok ? res : null;
  } catch {
    return null;
  }
}

let loader: Loader = async (path) => {
  const res = (await early(path)) ?? (await fetch(`${import.meta.env.BASE_URL}data/${path}`));
  if (!res.ok) throw new Error(L(`No se pudo cargar ${path} (${res.status})`, `Could not load ${path} (${res.status})`));
  return res.json();
};

const cache = new Map<string, Promise<unknown>>();

/** Replaces the way files are fetched (tests read them from disk). */
export function setLoader(fn: Loader): void {
  loader = fn;
  cache.clear();
}

/** A generated file as it comes, asked for again every time: `once` is what keeps them. */
export function fetchFile(path: string): Promise<unknown> {
  return loader(path);
}

/** A file fetched once and shared by whoever asks for it; a failure is not kept. */
export function once<T>(name: string, make: () => Promise<T>): Promise<T> {
  let p = cache.get(name) as Promise<T> | undefined;
  if (!p) {
    p = make();
    cache.set(name, p);
    p.catch(() => cache.delete(name));
  }
  return p;
}

/** Any other generated file, fetched once. */
export function loadFile<T>(path: string): Promise<T> {
  return once(path, () => loader(path) as Promise<T>);
}

export interface World {
  index: Index;
  byId: Map<string, Country>;
}

export function loadIndex(): Promise<World> {
  return once('index', async () => {
    const index = (await loader('index.json')) as Index;
    return { index, byId: new Map(index.countries.map((c) => [c.id, c])) };
  });
}

/** Country outlines keyed by id. */
export function loadWorldGeo(): Promise<Map<string, Geo>> {
  return once('world', async () => {
    const topo = (await loader('world.json')) as Topology;
    const fc = feature(topo, topo.objects.c as GeometryCollection) as unknown as { features: Geo[] };
    return new Map(fc.features.map((f) => [String(f.id), f]));
  });
}

/** Number of askable units at the finest level. */
export function fineCount(c: Country): number {
  return c.lv[c.lv.length - 1]?.n ?? 0;
}

/** Can the country be chosen in this section? */
export function eligible(section: Section, c: Country): boolean {
  if (c.cl === 'other') return false;
  if (section === 'regions') return fineCount(c) >= 2;
  if (section === 'pops') return c.pop != null && c.pop > 0;
  return true;
}

export function levelOf(c: Country, levels?: Record<string, string>): Level {
  const k = levels?.[c.id];
  return c.lv.find((l) => l.k === k) ?? c.lv.find((l) => l.k === c.dl) ?? c.lv[c.lv.length - 1];
}

const FEMININE = /(a|ión|dad)$/;
/** Spanish grammar only: in English nothing agrees in gender. */
export function isFeminine(noun: string): boolean {
  return getLangIsEs() && FEMININE.test(noun.split(' ')[0]);
}
const getLangIsEs = (): boolean => L('es', 'en') === 'es';
