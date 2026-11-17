/** A selection in words: "España · provincias", "Ríos · Europa". Used wherever a map arrives from outside the menus. */
import type { CityPick } from './extra';
import { kindNoun, parsePhys } from './phys';
import { levelOf, type World } from './world';
import { L, levelNoun, nm } from './i18n';
import { plural } from './text';
import type { Country, Section } from './types';

const capitalise = (s: string): string => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

export interface MapSpec {
  section: Section;
  countries: string[];
  levels: Record<string, string>;
  cityPick?: CityPick;
  cityCount?: number;
}

/** The countries of a selection that exist in the atlas; empty for physical maps, which are made of tokens. */
export function countriesOf(spec: MapSpec, world: World): Country[] {
  return spec.section === 'physical' ? [] : spec.countries.map((id) => world.byId.get(id)).filter((c): c is Country => !!c);
}

export function describeMap(spec: MapSpec, world: World): string {
  if (spec.section === 'physical') {
    const phys = parsePhys(spec.countries);
    const where = phys.places.length ? phys.places.map((p) => (world.index.continents[p] ? nm(world.index.continents[p]) : p)).join(', ') : L('todo el mundo', 'the whole world');
    return `${phys.kinds.map((k) => capitalise(kindNoun(k).many)).join(', ')} · ${where}`;
  }
  const countries = countriesOf(spec, world);
  const place = countries.length === 1 ? nm(countries[0].n) : countries.length <= 3 ? countries.map((x) => nm(x.n)).join(', ') : plural(countries.length, L('país', 'country'), L('países', 'countries'));
  if (spec.section === 'regions') {
    const nouns = new Set(countries.map((x) => levelNoun(levelOf(x, spec.levels)).many));
    return `${place} · ${nouns.size === 1 ? [...nouns][0] : L('regiones', 'regions')}`;
  }
  if (spec.section === 'cities') {
    const pick = spec.cityPick ?? 'top';
    return `${place} · ${pick === 'caps' ? L('capitales de país', 'national capitals') : pick === 'regcaps' ? L('capitales de región', 'regional capitals') : L(`las ${spec.cityCount ?? 25} ciudades más pobladas`, `the ${spec.cityCount ?? 25} largest cities`)}`;
  }
  return place;
}
