/**
 * The figures the number games are played with: how many people live in a country or a city, how large a
 * country, a region, a lake or an island is, how high a peak stands, how far north or west a place lies.
 * Kept apart from the screens so that every game says them the same way.
 */
import { L, getLang, nm } from './i18n';
import { metricNoun, metricOrder, type MetricId } from './metricNames';
import { REGION_FIGS, TOP_MIN, peopled, type RegionFig } from './rules';
import { fmtArea, fmtPop, fmtShort, nf, pick, sample, type Answerable, type Rng } from './text';
import { area, areaScale, areaUnit, getUnits } from './units';
import type { Country, Deck, Item } from './types';

export type { MetricId, RegionFig };
export { REGION_FIGS, TOP_MIN, peopled };

export interface Metric {
  id: MetricId;
  /** "población" */
  noun: string;
  /** The figure in full ("47,4 millones de habitantes") and in a tight space ("47,4 M"). */
  full(v: number): string;
  short(v: number): string;
  /** The two answers of "higher or lower". */
  more: string;
  less: string;
  /** "¿Más o menos habitantes?" */
  ask: string;
  /** "¿B tiene más o menos habitantes que A?" */
  compare(b: string, a: string): string;
  /** "¿Cuántos habitantes tiene?" */
  exactAsk: string;
  /** What a guess that falls short, or goes too far, is told to look for. */
  up: string;
  down: string;
  /** How five of them are put in order: "de más a menos habitantes". */
  order: string;
  units: { label: string; factor: number }[];
  defaultUnit: number;
  /**
   * How many of what the figure is kept in make one of what it is shown in, where they differ: the km² of a
   * square mile. A round figure is round in what is shown.
   */
  per?: number;
}

const one = (v: number) => nf(v, v < 10 ? 1 : 0);

function makeMetric(id: MetricId): Metric {
  switch (id) {
    case 'pop':
      return {
        id,
        noun: metricNoun(id),
        full: fmtPop,
        short: (v) => fmtShort(v),
        more: L('Más habitantes', 'More people'),
        less: L('Menos habitantes', 'Fewer people'),
        ask: L('¿Más o menos habitantes?', 'More or fewer people?'),
        compare: (b, a) => L(`¿${b} tiene más o menos habitantes que ${a}?`, `Does ${b} have more or fewer people than ${a}?`),
        exactAsk: L('¿Cuántos habitantes tiene?', 'How many people live there?'),
        up: L('busca más habitantes', 'look for more people'),
        down: L('busca menos habitantes', 'look for fewer people'),
        order: metricOrder(id),
        units: [
          { label: L('miles', 'thousand'), factor: 1e3 },
          { label: L('millones', 'million'), factor: 1e6 },
        ],
        defaultUnit: 1e6,
      };
    case 'area':
      return {
        id,
        noun: metricNoun(id),
        full: fmtArea,
        short: (v) => {
          const n = area(v);
          return `${n < 10_000 ? nf(n, n < 100 ? 1 : 0) : fmtShort(n)} ${areaUnit()}`;
        },
        more: L('Más superficie', 'Larger'),
        less: L('Menos superficie', 'Smaller'),
        ask: L('¿Más o menos superficie?', 'Larger or smaller?'),
        compare: (b, a) => L(`¿${b} tiene más o menos superficie que ${a}?`, `Is ${b} larger or smaller than ${a}?`),
        exactAsk: L('¿Qué superficie tiene?', 'How large is it?'),
        up: L('busca más superficie', 'look for a larger one'),
        down: L('busca menos superficie', 'look for a smaller one'),
        order: metricOrder(id),
        // A figure is kept in km² whatever it is typed in: the factor of a unit says how many it holds.
        units: [
          { label: areaUnit(), factor: areaScale() },
          { label: L(`miles de ${areaUnit()}`, `thousand ${areaUnit()}`), factor: 1e3 * areaScale() },
          { label: L(`millones de ${areaUnit()}`, `million ${areaUnit()}`), factor: 1e6 * areaScale() },
        ],
        defaultUnit: 1e3 * areaScale(),
        per: areaScale(),
      };
    case 'density':
      return {
        id,
        noun: metricNoun(id),
        // Kept per km²: a square mile holds some two and a half times as many.
        full: (v) => `${one(v * areaScale())} ${L(`habitantes por ${areaUnit()}`, `people per ${areaUnit()}`)}`,
        short: (v) => `${one(v * areaScale())} ${L(`hab./${areaUnit()}`, `per ${areaUnit()}`)}`,
        more: L('Más densidad', 'Denser'),
        less: L('Menos densidad', 'Less dense'),
        ask: L('¿Más o menos densidad de población?', 'More or less densely populated?'),
        compare: (b, a) => L(`¿${b} tiene más o menos habitantes por ${areaUnit()} que ${a}?`, `Does ${b} have more or fewer people per ${areaUnit()} than ${a}?`),
        exactAsk: L(`¿Cuántos habitantes tiene por ${areaUnit()}?`, `How many people per ${areaUnit()} does it have?`),
        up: L('busca más densidad', 'look for a denser one'),
        down: L('busca menos densidad', 'look for a less dense one'),
        order: metricOrder(id),
        units: [{ label: L(`hab./${areaUnit()}`, `per ${areaUnit()}`), factor: 1 / areaScale() }],
        defaultUnit: 1 / areaScale(),
        per: 1 / areaScale(),
      };
    case 'elev':
      return {
        id,
        noun: metricNoun(id),
        full: (v) => L(`${nf(v)} m de altitud`, `${nf(v)} m high`),
        short: (v) => `${nf(v)} m`,
        more: L('Más altitud', 'Higher'),
        less: L('Menos altitud', 'Lower'),
        ask: L('¿Más o menos altitud?', 'Higher or lower?'),
        compare: (b, a) => L(`¿${b} tiene más o menos altitud que ${a}?`, `Is ${b} higher or lower than ${a}?`),
        exactAsk: L('¿Qué altitud tiene?', 'How high is it?'),
        up: L('busca más altitud', 'look for a higher one'),
        down: L('busca menos altitud', 'look for a lower one'),
        order: metricOrder(id),
        units: [{ label: 'm', factor: 1 }],
        defaultUnit: 1,
      };
    case 'lat': {
      const say = (v: number) => `${nf(Math.abs(v), 1)}° ${v >= 0 ? 'N' : 'S'}`;
      return {
        id,
        noun: metricNoun(id),
        full: say,
        short: say,
        more: L('Más al norte', 'Further north'),
        less: L('Más al sur', 'Further south'),
        ask: L('¿Más al norte o más al sur?', 'Further north or further south?'),
        compare: (b, a) => L(`¿${b} está más al norte o más al sur que ${a}?`, `Is ${b} further north or further south than ${a}?`),
        exactAsk: L('¿A qué latitud está?', 'What latitude is it at?'),
        up: L('busca más al norte', 'look further north'),
        down: L('busca más al sur', 'look further south'),
        order: metricOrder(id),
        units: [{ label: '°', factor: 1 }],
        defaultUnit: 1,
      };
    }
    case 'lon': {
      // Kept with its sign turned, so that the largest figure is the one furthest west, like the rest.
      const say = (v: number) => `${nf(Math.abs(v), 1)}° ${-v >= 0 ? 'E' : L('O', 'W')}`;
      return {
        id,
        noun: metricNoun(id),
        full: say,
        short: say,
        more: L('Más al oeste', 'Further west'),
        less: L('Más al este', 'Further east'),
        ask: L('¿Más al oeste o más al este?', 'Further west or further east?'),
        compare: (b, a) => L(`¿${b} está más al oeste o más al este que ${a}?`, `Is ${b} further west or further east than ${a}?`),
        exactAsk: L('¿A qué longitud está?', 'What longitude is it at?'),
        up: L('busca más al oeste', 'look further west'),
        down: L('busca más al este', 'look further east'),
        order: metricOrder(id),
        units: [{ label: '°', factor: 1 }],
        defaultUnit: 1,
      };
    }
  }
}

const metrics = new Map<string, Metric>();
/** A figure with its words in the language of the interface and its units those of the player; the same object every time. */
export function metricOf(id: MetricId): Metric {
  const k = `${getLang()}:${getUnits()}:${id}`;
  let m = metrics.get(k);
  if (!m) {
    m = makeMetric(id);
    metrics.set(k, m);
  }
  return m;
}

/** A figure in full, with the year it is of where that is told: "1,99 millones de habitantes (2024)". */
export const fullOf = (f: Fig, m: Metric = metricOf(f.metric)): string => (f.year ? `${m.full(f.value)} (${f.year})` : m.full(f.value));

/** One thing with a figure: a country and its population, a peak and its height. */
export interface Fig {
  id: string;
  name: string;
  /** The flag shown next to it: its own for a country; its country's for a city or a region on a map of several. */
  fl?: string;
  /** What tells it from another of the same name on a map of several countries. */
  sub?: string;
  /** What it is, in one word: "país", "ciudad", "pico". */
  type: string;
  value: number;
  metric: MetricId;
  /** The year the figure is of, where it matters and the data say it: how many people a region has. */
  year?: number;
  /** For the card of facts and links shown with the answer. */
  item: Item;
  /** What it answers to when typed. */
  answers: Answerable;
}

/** What a country figure is worked out from; 0 when the data cannot tell. */
export function countryValue(c: Country, metric: MetricId): number {
  switch (metric) {
    case 'pop':
      return c.pop ?? 0;
    case 'area':
      return c.ar;
    case 'density':
      return c.pop && c.ar > 0 ? c.pop / c.ar : 0;
    case 'lat':
      return c.lp[1];
    case 'lon':
      return -c.lp[0];
    default:
      return 0;
  }
}

/** The figures of a list of countries; the ones the data has no figure for are left out. */
export function countryFigs(countries: readonly Country[], metric: MetricId, itemOf: (c: Country) => Item, answersOf: (c: Country) => Answerable): Fig[] {
  const type = L('país', 'country');
  return countries
    .map((c) => ({ c, value: countryValue(c, metric) }))
    .filter(({ value }) => metric === 'lat' || metric === 'lon' || value > 0)
    .map(({ c, value }) => ({ id: c.id, name: nm(c.n), fl: c.fl, type, value, metric, item: itemOf(c), answers: answersOf(c) }));
}

/** The figure each kind of thing on a map is known by: people for a city, metres for a peak, km² for the rest. */
export function figureOf(it: Item): { metric: MetricId; value: number } | null {
  if (it.kind === 'city') return it.pop && it.pop > 0 ? { metric: 'pop', value: it.pop } : null;
  if (it.kind === 'feature' && it.elev != null) return it.elev > 0 ? { metric: 'elev', value: it.elev } : null;
  // Lines (rivers) and whatever the data gives no size for have nothing to compare.
  return it.shape === 'area' && it.area > 0 ? { metric: 'area', value: it.area } : null;
}

const figOf = (it: Item, metric: MetricId, value: number, several: boolean, year?: number): Fig => ({
  id: it.id,
  name: it.name,
  // On a map of one country every flag would be the same one: it says nothing.
  fl: it.kind === 'country' || (several && it.kind !== 'feature') ? it.country.fl : undefined,
  sub: several && it.kind !== 'feature' && it.kind !== 'country' ? nm(it.country.n) : undefined,
  type: it.type,
  value,
  metric,
  ...(year ? { year } : {}),
  item: it,
  answers: it,
});

/**
 * The figure a map of regions is played with: the one asked for, where every region of the map has it, and
 * the area where some does not (a game kept from before the data changed, a link written by hand).
 */
export function regionFigOf(deck: Deck, wanted: RegionFig | undefined): RegionFig {
  if (deck.scope !== 'regions' || !wanted || wanted === 'area' || !REGION_FIGS.includes(wanted)) return 'area';
  return deck.items.length > 0 && deck.items.every((it) => (it.people ?? 0) > 0 && (wanted === 'pop' || it.area > 0)) ? wanted : 'area';
}

/** The figure of a region when the game is about its people. */
function peopleOf(it: Item, fig: RegionFig): { metric: MetricId; value: number } | null {
  if (!it.people || it.people <= 0) return null;
  if (fig === 'pop') return { metric: 'pop', value: it.people };
  return it.area > 0 ? { metric: 'density', value: it.people / it.area } : null;
}

/**
 * The figures of the things on a map: each with the one its kind is known by. The regions have a choice:
 * their area, which is what they are known by, or their people (`regions`), with the year they were counted.
 */
export function deckFigs(deck: Deck, regions: RegionFig = 'area'): Fig[] {
  const several = deck.countries.length > 1;
  return deck.items.flatMap((it) => {
    const people = regions !== 'area' && it.kind === 'unit';
    const f = people ? peopleOf(it, regions) : figureOf(it);
    return f ? [figOf(it, f.metric, f.value, several, people ? it.peopleYear : undefined)] : [];
  });
}

/** Where the things on a map lie, as figures to put in order: from north to south, or from west to east. */
export function positionFigs(deck: Deck, axis: 'lat' | 'lon'): Fig[] {
  const several = deck.countries.length > 1;
  return deck.items.filter((it) => it.shape !== 'line').map((it) => figOf(it, axis, axis === 'lat' ? it.lp[1] : -it.lp[0], several));
}

/** The figures a game can be about, the commonest first: a map of peaks and lakes has two. */
export function metricsIn(figs: readonly Fig[]): MetricId[] {
  const count = new Map<MetricId, number>();
  for (const f of figs) count.set(f.metric, (count.get(f.metric) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

/** How many the top of a list holds: ten, or half the list when it is short. */
export function topSize(count: number): number {
  return Math.max(0, Math.min(10, Math.floor(count / 2)));
}

/** The first `n` by their figure, the largest first; ties keep the order of the list. */
export function topOf(figs: readonly Fig[], n: number): Fig[] {
  return [...figs].sort((a, b) => b.value - a.value).slice(0, n);
}

/** What a place can gain or lose in people in a year, as a share: what two counts of different years may be apart for that alone. */
const DRIFT = 0.015;
/** The years that a count with no date is taken to be away from one that has it. */
const UNDATED = 10;

/**
 * How far apart two figures have to be, as a share of the larger, to be told apart. Counts of people of
 * different years need more: the older one has moved since, and the two could have changed places.
 */
function margin(a: Fig, b: Fig): number {
  if (a.year == null && b.year == null) return 0.02;
  const years = a.year != null && b.year != null ? Math.abs(a.year - b.year) : UNDATED;
  return Math.min(0.3, 0.02 + DRIFT * years);
}

/**
 * Two figures too close to call are not asked against each other: a difference smaller than this share of
 * the larger one cannot be known, only guessed. Positions are told apart by degrees instead.
 */
export function tooClose(a: Fig, b: Fig): boolean {
  if (a.metric === 'lat' || a.metric === 'lon') return Math.abs(a.value - b.value) < 0.5;
  const hi = Math.max(Math.abs(a.value), Math.abs(b.value));
  return hi > 0 && Math.abs(a.value - b.value) / hi < margin(a, b);
}

/** The things of a list that share their figure with at least another one: nothing else can be compared. */
export function comparable(figs: readonly Fig[]): Fig[] {
  const count = new Map<MetricId, number>();
  for (const f of figs) count.set(f.metric, (count.get(f.metric) ?? 0) + 1);
  return figs.filter((f) => (count.get(f.metric) ?? 0) >= 2);
}

/** How many things with a figure in common a game of figures needs. */
export const FIG_MIN = 2;

/** Can a game be played with these? It takes two things that share their figure. */
export const figPlayable = (figs: readonly Fig[]): boolean => comparable(figs).length >= FIG_MIN;

/**
 * "Higher or lower": the next one to compare. Of the same figure, not seen lately, and closer in size the
 * longer the streak: far apart at first, nearly alike after eight in a row.
 */
export function challenger(list: readonly Fig[], current: Fig, streak: number, recent: readonly string[], choose: (l: readonly Fig[]) => Fig = pick): Fig {
  const same = list.filter((f) => f.metric === current.metric && f.id !== current.id);
  const base = current.value;
  const [lo, hi] = streak < 3 ? [1.4, Infinity] : streak < 8 ? [1.12, 15] : [1.03, 4];
  // Counts of different years are not set against each other when the years alone could tell them apart.
  const apart = (f: Fig): boolean => (current.year == null && f.year == null) || !tooClose(current, f);
  const free = same.filter((f) => !recent.includes(f.id));
  const fit = free.filter((f) => {
    const r = Math.max(f.value / base, base / f.value);
    return r >= lo && r <= hi && apart(f);
  });
  const clear = free.filter(apart);
  return choose(fit.length ? fit : clear.length ? clear : free.length ? free : same);
}

/** Are two of them too close to tell which comes first? */
const clash = (list: readonly Fig[]): boolean => list.some((a, i) => list.slice(i + 1).some((b) => tooClose(a, b)));

/**
 * Five to put in order: all of one figure, drawn as often as it has things, and none so close to another
 * that the order could only be guessed (as long as the list has such five).
 */
export function dealFive(figs: readonly Fig[], rng: Rng = Math.random): Fig[] {
  const list = comparable(figs);
  if (!list.length) return [];
  const metric = pick(list, rng).metric;
  const group = list.filter((f) => f.metric === metric);
  const size = Math.min(5, group.length);
  let five = sample(group, size, rng);
  for (let i = 0; i < 24 && clash(five); i++) five = sample(group, size, rng);
  return five;
}
