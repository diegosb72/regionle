/**
 * What a physical map is made of, in words and as a selection. Kept apart from the building of the maps
 * (`extra.ts`), which brings the data with it: this much is read from the first page too.
 */
import { L } from './i18n';

/** What a map can be made of: the kinds that are chosen, in the order they are offered. */
export const PHYS_KINDS = ['continent', 'river', 'lake', 'sea', 'range', 'plain', 'peninsula', 'peak', 'cape', 'desert', 'island', 'fall'] as const;
export type PhysKind = (typeof PHYS_KINDS)[number];
/**
 * What a feature is: one of those kinds, or an ocean. The five oceans are not chosen on their own: they come
 * with the seas, as they always did, and with the continents on a map of the world.
 */
export type PhysType = PhysKind | 'ocean';
/** Continents a physical deck can be limited to; `W` is the whole world. */
export const PHYS_PLACES = ['W', 'EU', 'AS', 'AF', 'AM', 'OC'] as const;

/** The words for a kind that is chosen: `many` is the name of the choice, oceans and all. */
export function kindNoun(kind: PhysKind): { one: string; many: string; fem: boolean } {
  const es = L('es', 'en') === 'es';
  switch (kind) {
    case 'continent':
      return { one: L('continente u océano', 'continent or ocean'), many: L('continentes y océanos', 'continents and oceans'), fem: false };
    case 'river':
      return { one: L('río', 'river'), many: L('ríos', 'rivers'), fem: false };
    case 'lake':
      return { one: L('lago', 'lake'), many: L('lagos', 'lakes'), fem: false };
    case 'sea':
      return { one: L('mar', 'sea'), many: L('mares y océanos', 'seas and oceans'), fem: false };
    case 'range':
      return { one: L('cordillera', 'mountain range'), many: L('cordilleras', 'mountain ranges'), fem: es };
    case 'plain':
      return { one: L('meseta o llanura', 'plateau or plain'), many: L('mesetas y llanuras', 'plateaus and plains'), fem: es };
    case 'peninsula':
      return { one: L('península', 'peninsula'), many: L('penínsulas', 'peninsulas'), fem: es };
    case 'peak':
      return { one: L('pico', 'peak'), many: L('picos y volcanes', 'peaks and volcanoes'), fem: false };
    case 'cape':
      return { one: L('cabo', 'cape'), many: L('cabos', 'capes'), fem: false };
    case 'desert':
      return { one: L('desierto', 'desert'), many: L('desiertos', 'deserts'), fem: false };
    case 'fall':
      return { one: L('catarata', 'waterfall'), many: L('cataratas', 'waterfalls'), fem: es };
    default:
      return { one: L('isla', 'island'), many: L('islas', 'islands'), fem: es };
  }
}

/** What one feature is called: an ocean is an ocean, whichever choice brought it, and a continent only a continent. */
export const typeNoun = (type: PhysType): string => (type === 'ocean' ? L('océano', 'ocean') : type === 'continent' ? L('continente', 'continent') : kindNoun(type).one);
/** Seas and oceans are water: drawn under the land, and no measure of how far a map has to reach. */
export const isWater = (type: string | undefined): boolean => type === 'sea' || type === 'ocean';

/** Selection of a physical deck, kept in the same list of ids as the countries of the other sections. */
export interface PhysSpec {
  kinds: PhysKind[];
  /** Continent codes; empty for the whole world. */
  places: string[];
  /** Everything, or only the best known. */
  all: boolean;
  /** One country instead of continents: its own map, with what a continent has no room for. */
  country?: string;
}

/** A country among the tokens: `in:ES`. A bare code would not do, for AF, AS and AM are continents here. */
const IN = /^in:([A-Z]{2})$/;
export const countryToken = (id: string): string => `in:${id}`;

export function parsePhys(tokens: string[]): PhysSpec {
  const kinds = PHYS_KINDS.filter((k) => tokens.includes(k));
  const country = tokens.map((t) => IN.exec(t)?.[1]).find(Boolean);
  const places = country ? [] : PHYS_PLACES.filter((p) => p !== 'W' && tokens.includes(p));
  return { kinds: kinds.length ? [...kinds] : ['river'], places: [...places], all: tokens.includes('all'), ...(country ? { country } : {}) };
}

export function physTokens(spec: PhysSpec): string[] {
  return [...spec.kinds, ...(spec.country ? [countryToken(spec.country)] : spec.places), ...(spec.all ? ['all'] : [])];
}

/** What the file of physical features says of each one, as far as choosing goes. */
export interface PhysPick {
  k: PhysType;
  ct: readonly string[];
  /** 1 = met at school · 2 = the rest · 3 = only on the map of its own country */
  r: 1 | 2 | 3;
  /** One of the best known on the map of its country, whatever it is on a continent's. */
  h?: 1;
  /** The countries it is asked in. */
  co?: readonly string[];
}

/**
 * The choice that brings a feature into a selection, if any does: its own kind, but for the continents, which
 * are only asked on the map of the whole world, and the oceans, which come with them there and with the seas
 * anywhere.
 */
export function pickOf(f: Pick<PhysPick, 'k'>, spec: PhysSpec): PhysKind | undefined {
  const world = !spec.country && !spec.places.length;
  if (f.k === 'continent') return world && spec.kinds.includes('continent') ? 'continent' : undefined;
  if (f.k === 'ocean') return world && spec.kinds.includes('continent') ? 'continent' : spec.kinds.includes('sea') ? 'sea' : undefined;
  return spec.kinds.includes(f.k) ? f.k : undefined;
}

/** Is a feature part of a selection? */
export function physMatches(f: PhysPick, spec: PhysSpec): boolean {
  if (!pickOf(f, spec)) return false;
  if (spec.country) return !!f.co?.includes(spec.country) && (spec.all || f.r === 1 || f.h === 1);
  return f.r !== 3 && (spec.all || f.r === 1) && (!spec.places.length || f.ct.some((c) => spec.places.includes(c)));
}

/**
 * The choices that bring something into a selection, in their order: a map is called by what is on it, and a
 * choice kept from another place (the continents on the map of Europe, the deserts there) brings nothing.
 */
export function kindsIn(features: readonly PhysPick[], spec: PhysSpec): PhysKind[] {
  const found = new Set<PhysKind>();
  for (const f of features) if (physMatches(f, spec)) found.add(pickOf(f, spec)!);
  return PHYS_KINDS.filter((k) => found.has(k));
}

/** A country gets a map of its own from this many features up: fewer would be no game. */
export const PHYS_COUNTRY_MIN = 6;

/** How many features each country has to ask about, for those with enough. */
export function physCountries(features: readonly PhysPick[]): Map<string, number> {
  const count = new Map<string, number>();
  for (const f of features) for (const c of f.co ?? []) count.set(c, (count.get(c) ?? 0) + 1);
  for (const [id, n] of count) if (n < PHYS_COUNTRY_MIN) count.delete(id);
  return count;
}
