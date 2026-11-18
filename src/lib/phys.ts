/**
 * What a physical map is made of, in words and as a selection. Kept apart from the building of the maps
 * (`extra.ts`), which brings the data with it: this much is read from the first page too.
 */
import { L } from './i18n';

export const PHYS_KINDS = ['river', 'lake', 'sea', 'range', 'plain', 'peak', 'cape', 'desert', 'island'] as const;
export type PhysKind = (typeof PHYS_KINDS)[number];
/** Continents a physical deck can be limited to; `W` is the whole world. */
export const PHYS_PLACES = ['W', 'EU', 'AS', 'AF', 'AM', 'OC'] as const;

export function kindNoun(kind: PhysKind): { one: string; many: string; fem: boolean } {
  const es = L('es', 'en') === 'es';
  switch (kind) {
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
    case 'peak':
      return { one: L('pico', 'peak'), many: L('picos y volcanes', 'peaks and volcanoes'), fem: false };
    case 'cape':
      return { one: L('cabo', 'cape'), many: L('cabos', 'capes'), fem: false };
    case 'desert':
      return { one: L('desierto', 'desert'), many: L('desiertos', 'deserts'), fem: false };
    default:
      return { one: L('isla', 'island'), many: L('islas', 'islands'), fem: es };
  }
}

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
  k: PhysKind;
  ct: readonly string[];
  /** 1 = met at school · 2 = the rest · 3 = only on the map of its own country */
  r: 1 | 2 | 3;
  /** One of the best known on the map of its country, whatever it is on a continent's. */
  h?: 1;
  /** The countries it is asked in. */
  co?: readonly string[];
}

/** Is a feature part of a selection? */
export function physMatches(f: PhysPick, spec: PhysSpec): boolean {
  if (!spec.kinds.includes(f.k)) return false;
  if (spec.country) return !!f.co?.includes(spec.country) && (spec.all || f.r === 1 || f.h === 1);
  return f.r !== 3 && (spec.all || f.r === 1) && (!spec.places.length || f.ct.some((c) => spec.places.includes(c)));
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
