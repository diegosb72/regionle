/**
 * What a physical map is made of, in words and as a selection. Kept apart from the building of the maps
 * (`extra.ts`), which brings the data with it: this much is read from the first page too.
 */
import { L } from './i18n';

export const PHYS_KINDS = ['river', 'lake', 'sea', 'range', 'peak', 'desert', 'island'] as const;
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
    case 'peak':
      return { one: L('pico', 'peak'), many: L('picos y volcanes', 'peaks and volcanoes'), fem: false };
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
}

export function parsePhys(tokens: string[]): PhysSpec {
  const kinds = PHYS_KINDS.filter((k) => tokens.includes(k));
  const places = PHYS_PLACES.filter((p) => p !== 'W' && tokens.includes(p));
  return { kinds: kinds.length ? [...kinds] : ['river'], places: [...places], all: tokens.includes('all') };
}

export function physTokens(spec: PhysSpec): string[] {
  return [...spec.kinds, ...spec.places, ...(spec.all ? ['all'] : [])];
}
