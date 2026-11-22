/**
 * The challenges of the special days of the year: the international days that have to do with the map (water,
 * the Earth, the oceans, the mountains…) and the national days of some countries. Each is a game about what
 * its day is about, and opens on that day for a week. Like the challenge of the week (lib/weekly.ts), it is
 * put in order by a seed, here made from the day and the year, so it is the same for everyone; the rest of
 * the year the same game can be played for practice, with questions of its own and nothing written down.
 * What is kept of them is in lib/datedKept.ts.
 */
import { USUAL_RULES } from './rules';
import { addDays, dayNumber } from '../daily/spec';
import type { OccasionRec } from './datedKept';
import { ARAB_LEAGUE, EU, SPANISH } from './groups';
import { L } from './i18n';
import type { GameConfig, Length, Opts } from './store';
import { hashStr } from './text';
import type { Index, Mode } from './types';
import { weekCountries } from './weekly';

/** How many days a challenge stays open, its own day included. */
export const OCCASION_DAYS = 7;

/**
 * What a day asks. Countries: a way of asking and the ones it is asked of, which the index says. Regions:
 * every piece of one country at one of its levels, in a medley. Physical: a medley of what a selection of
 * the physical map holds, as its words say it ("river", "all"); `pieces` is how many that is, which only the
 * file of the physical map knows and the first page does not carry (a test keeps it true).
 */
export type OccasionAsk =
  | { section: 'countries'; mode: Mode; of(index: Index): string[]; length: Length }
  | { section: 'regions'; country: string; level: string }
  | { section: 'physical'; tokens: readonly string[]; pieces: number; length: Length };

export interface Occasion {
  /** The name it is kept by. */
  id: string;
  /** Its month and day: "05-09". */
  md: string;
  /** What the day is called, and what its challenge is about, in Spanish and in English. */
  name: readonly [string, string];
  what: readonly [string, string];
  ask: OccasionAsk;
}

/** The challenge of an occasion in a year. */
export interface Edition {
  o: Occasion;
  year: number;
}

/** How many countries the day of the population asks about: the most populous ones. */
export const POPULOUS = 30;

const part =
  (code: string | null, mode: Mode = 'mix') =>
  (index: Index): string[] =>
    weekCountries({ mode, part: code }, index);
const listed =
  (ids: readonly string[]) =>
  (index: Index): string[] =>
    index.countries
      .filter((c) => ids.includes(c.id))
      .map((c) => c.id)
      .sort();
const members = (index: Index): string[] =>
  index.countries
    .filter((c) => c.cl === 'un')
    .map((c) => c.id)
    .sort();
const populous = (index: Index): string[] =>
  index.countries
    .filter((c) => c.cl === 'un' && (c.pop ?? 0) > 0)
    .sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0) || (a.id < b.id ? -1 : 1))
    .slice(0, POPULOUS)
    .map((c) => c.id)
    .sort();

const countries = (of: (index: Index) => string[], mode: Mode = 'mix', length: Length = 'all'): OccasionAsk => ({ section: 'countries', mode, of, length });
const regions = (country: string, level = 'f'): OccasionAsk => ({ section: 'regions', country, level });
const physical = (tokens: string, pieces: number, length: Length = 20): OccasionAsk => ({ section: 'physical', tokens: tokens.split(' '), pieces, length });

/**
 * The days, in the order of the year. International days go by the name the United Nations gives them, or by
 * the one they are known by; national days are those of countries whose regions make a map of their own.
 * No day depends on the moon or on the day of the week: each is the same date every year.
 */
export const OCCASIONS: readonly Occasion[] = [
  { id: 'newyear', md: '01-01', name: ['Año Nuevo', 'New Year’s Day'], what: ['Los países de Oceanía, los primeros en estrenar el año', 'The countries of Oceania, the first to see the new year'], ask: countries(part('OC')) },
  { id: 'wetlands', md: '02-02', name: ['Día Mundial de los Humedales', 'World Wetlands Day'], what: ['Los grandes lagos del mundo', 'The great lakes of the world'], ask: physical('lake', 27, 'all') },
  { id: 'ireland', md: '03-17', name: ['Día de San Patricio', 'Saint Patrick’s Day'], what: ['Los condados de Irlanda', 'The counties of Ireland'], ask: regions('IE') },
  { id: 'water', md: '03-22', name: ['Día Mundial del Agua', 'World Water Day'], what: ['Los grandes ríos del mundo', 'The great rivers of the world'], ask: physical('river', 53) },
  { id: 'earth', md: '04-22', name: ['Día de la Tierra', 'Earth Day'], what: ['Continentes, océanos, cordilleras y desiertos', 'Continents, oceans, mountain ranges and deserts'], ask: physical('continent range desert', 40) },
  { id: 'spanish', md: '04-23', name: ['Día del Idioma Español', 'Spanish Language Day'], what: ['Los países donde el español es lengua oficial', 'The countries where Spanish is an official language'], ask: countries(listed(SPANISH)) },
  { id: 'europe', md: '05-09', name: ['Día de Europa', 'Europe Day'], what: ['Los países de la Unión Europea', 'The countries of the European Union'], ask: countries(listed(EU)) },
  { id: 'africa', md: '05-25', name: ['Día de África', 'Africa Day'], what: ['Todos los países de África', 'Every country of Africa'], ask: countries(part('AF')) },
  { id: 'italy', md: '06-02', name: ['Fiesta de la República de Italia', 'Italy’s Republic Day'], what: ['Las regiones de Italia', 'The regions of Italy'], ask: regions('IT', 'g1') },
  { id: 'oceans', md: '06-08', name: ['Día Mundial de los Océanos', 'World Oceans Day'], what: ['Océanos y mares del mundo', 'Oceans and seas of the world'], ask: physical('sea', 43) },
  { id: 'portugal', md: '06-10', name: ['Día de Portugal', 'Portugal Day'], what: ['Los distritos y regiones autónomas de Portugal', 'The districts and autonomous regions of Portugal'], ask: regions('PT') },
  { id: 'deserts', md: '06-17', name: ['Día contra la Desertificación y la Sequía', 'Desertification and Drought Day'], what: ['Los desiertos del mundo', 'The deserts of the world'], ask: physical('desert all', 19, 'all') },
  { id: 'canada', md: '07-01', name: ['Día de Canadá', 'Canada Day'], what: ['Las provincias y territorios de Canadá', 'The provinces and territories of Canada'], ask: regions('CA') },
  { id: 'usa', md: '07-04', name: ['Día de la Independencia de Estados Unidos', 'Independence Day in the United States'], what: ['Los estados de Estados Unidos', 'The states of the United States'], ask: regions('US') },
  { id: 'argentina', md: '07-09', name: ['Día de la Independencia de Argentina', 'Argentina’s Independence Day'], what: ['Las provincias de Argentina', 'The provinces of Argentina'], ask: regions('AR') },
  { id: 'population', md: '07-11', name: ['Día Mundial de la Población', 'World Population Day'], what: ['Los treinta países más poblados', 'The thirty most populous countries'], ask: countries(populous) },
  { id: 'france', md: '07-14', name: ['Fiesta nacional de Francia', 'Bastille Day'], what: ['Las regiones de Francia', 'The regions of France'], ask: regions('FR', 'g1') },
  { id: 'colombia', md: '07-20', name: ['Día de la Independencia de Colombia', 'Colombia’s Independence Day'], what: ['Los departamentos de Colombia', 'The departments of Colombia'], ask: regions('CO') },
  { id: 'peru', md: '07-28', name: ['Día de la Independencia de Perú', 'Peru’s Independence Day'], what: ['Los departamentos de Perú', 'The departments of Peru'], ask: regions('PE') },
  { id: 'india', md: '08-15', name: ['Día de la Independencia de la India', 'India’s Independence Day'], what: ['Los estados y territorios de la India', 'The states and territories of India'], ask: regions('IN') },
  { id: 'brazil', md: '09-07', name: ['Día de la Independencia de Brasil', 'Brazil’s Independence Day'], what: ['Los estados de Brasil', 'The states of Brazil'], ask: regions('BR') },
  { id: 'mexico', md: '09-16', name: ['Día de la Independencia de México', 'Mexico’s Independence Day'], what: ['Los estados de México', 'The states of Mexico'], ask: regions('MX') },
  { id: 'chile', md: '09-18', name: ['Fiestas Patrias de Chile', 'Chile’s National Day'], what: ['Las regiones de Chile', 'The regions of Chile'], ask: regions('CL') },
  { id: 'china', md: '10-01', name: ['Día Nacional de China', 'China’s National Day'], what: ['Las provincias de China', 'The provinces of China'], ask: regions('CN') },
  { id: 'germany', md: '10-03', name: ['Día de la Unidad Alemana', 'German Unity Day'], what: ['Los estados federados de Alemania', 'The federal states of Germany'], ask: regions('DE') },
  { id: 'spain', md: '10-12', name: ['Fiesta Nacional de España', 'Spain’s National Day'], what: ['Las provincias de España', 'The provinces of Spain'], ask: regions('ES') },
  { id: 'un', md: '10-24', name: ['Día de las Naciones Unidas', 'United Nations Day'], what: ['Las banderas de los países miembros', 'The flags of the member states'], ask: countries(members, 'flag', 20) },
  { id: 'cities', md: '10-31', name: ['Día Mundial de las Ciudades', 'World Cities Day'], what: ['Las capitales del mundo', 'The capitals of the world'], ask: countries(part(null, 'capital'), 'capital', 20) },
  { id: 'poland', md: '11-11', name: ['Día de la Independencia de Polonia', 'Poland’s Independence Day'], what: ['Los voivodatos de Polonia', 'The voivodeships of Poland'], ask: regions('PL') },
  { id: 'constitution', md: '12-06', name: ['Día de la Constitución Española', 'Spain’s Constitution Day'], what: ['Las comunidades y ciudades autónomas de España', 'The autonomous communities and cities of Spain'], ask: regions('ES', 'g1') },
  { id: 'mountains', md: '12-11', name: ['Día Internacional de las Montañas', 'International Mountain Day'], what: ['Cordilleras y picos del mundo', 'Mountain ranges and peaks of the world'], ask: physical('range peak', 49) },
  { id: 'arabic', md: '12-18', name: ['Día Mundial de la Lengua Árabe', 'World Arabic Language Day'], what: ['Los países de la Liga Árabe', 'The countries of the Arab League'], ask: countries(listed(ARAB_LEAGUE)) },
];

export const occasionOf = (id: string): Occasion | undefined => OCCASIONS.find((o) => o.id === id);

/** What a day is called, and what its challenge is about, in the language of the game. */
export const occasionName = (o: Pick<Occasion, 'name'>): string => L(o.name[0], o.name[1]);
export const occasionWhat = (o: Pick<Occasion, 'what'>): string => L(o.what[0], o.what[1]);

/** The day an occasion falls on in a year, and the last day its challenge is open. */
export const occasionDate = (o: Pick<Occasion, 'md'>, year: number): string => `${year}-${o.md}`;
export const occasionEnd = (o: Pick<Occasion, 'md'>, year: number): string => addDays(occasionDate(o, year), OCCASION_DAYS - 1);

/**
 * The year of the challenge of an occasion that is open on a day; null when the day is outside its week. One
 * that opened in the last days of December is still open in January: that one is of the year before.
 */
export function editionOn(o: Pick<Occasion, 'md'>, date: string): number | null {
  const year = Number(date.slice(0, 4));
  for (const y of [year, year - 1]) if (date >= occasionDate(o, y) && date <= occasionEnd(o, y)) return y;
  return null;
}

/** The challenges open on a day: the one that opened last comes first. */
export function occasionsOpen(date: string, all: readonly Occasion[] = OCCASIONS): Edition[] {
  const open: Edition[] = [];
  for (const o of all) {
    const year = editionOn(o, date);
    if (year != null) open.push({ o, year });
  }
  return open.sort((a, b) => {
    const [da, db] = [occasionDate(a.o, a.year), occasionDate(b.o, b.year)];
    return da !== db ? (da < db ? 1 : -1) : a.o.id < b.o.id ? -1 : 1;
  });
}

/** The first challenge to open after a day; null only where there is no occasion at all. */
export function occasionNext(date: string, all: readonly Occasion[] = OCCASIONS): Edition | null {
  const year = Number(date.slice(0, 4));
  let next: Edition | null = null;
  for (const o of all) {
    const y = occasionDate(o, year) > date ? year : year + 1;
    if (!next || occasionDate(o, y) < occasionDate(next.o, next.year)) next = { o, year: y };
  }
  return next;
}

/** How many days there are from a day to another: 1 from one to the next. */
export const daysTo = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

/** How many pieces the map of an occasion has, as far as the index of the countries can tell. */
function pieces(o: Occasion, index: Index): number {
  const { ask } = o;
  if (ask.section === 'countries') return ask.of(index).length;
  if (ask.section === 'physical') return ask.pieces;
  return index.countries.find((c) => c.id === ask.country)?.lv.find((l) => l.k === ask.level)?.n ?? 0;
}

const lengthOf = (o: Occasion): Length => (o.ask.section === 'regions' ? 'all' : o.ask.length);

/** How many questions the challenge of an occasion has: its whole map, or as many as it says where the map has more. */
export function occasionQuestions(o: Occasion, index: Index): number {
  const length = lengthOf(o);
  const all = pieces(o, index);
  return typeof length === 'number' ? Math.min(length, all) : all;
}

/** The seed that puts the questions of an occasion in order in a year. */
export const occasionSeed = (id: string, year: number): number => hashStr(`regionle|occasion|${id}|${year}`) % 2_147_483_647;

/**
 * The game of an occasion: its challenge of a year, or, with no year, the same game for practice, which is a
 * game like any other. As in the challenge of the week, what changes the questions is settled (four options,
 * names on the map to point at, outlines and flags as they are); the rest is as each player likes it.
 */
export function occasionGame(o: Occasion, year: number | null, index: Index, opts: Opts): Omit<GameConfig, 'nonce'> {
  const { ask } = o;
  const game: Omit<GameConfig, 'nonce'> = {
    section: ask.section,
    mode: ask.section === 'countries' ? ask.mode : 'mix',
    countries: ask.section === 'countries' ? ask.of(index) : ask.section === 'regions' ? [ask.country] : [...ask.tokens],
    levels: ask.section === 'regions' ? { [ask.country]: ask.level } : {},
    opts: { ...opts, answer: 'choice', length: lengthOf(o), pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal', ...USUAL_RULES },
  };
  return year == null ? game : { ...game, challenge: { seed: occasionSeed(o.id, year) }, occasion: { id: o.id, year } };
}

/** Whether the challenge of an occasion is done in a year. */
export const occasionDone = (rec: OccasionRec | undefined, year: number): rec is OccasionRec => rec?.y === year;

/** How many of the occasions of the calendar were played in a year. */
export const occasionsPlayed = (kept: Record<string, OccasionRec>, year: number): number => OCCASIONS.filter((o) => kept[o.id]?.y === year).length;
