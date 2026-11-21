/**
 * What is kept of the challenges with a date other than the one of the day: the challenge of the week
 * (lib/weekly.ts), the ones of the day of a continent or a country (lib/zones.ts) and those of the special
 * days of the year (lib/occasions.ts). Only what the saved state needs is here, which is what the first page
 * carries; what each challenge asks is in its own file.
 */
import { addDays, isDate } from '../daily/spec';

/** How many weeks are kept, of how many zones their last day, and of how many special days their last year. */
export const WEEKS_KEPT = 60;
export const ZONES_KEPT = 40;
export const OCCASIONS_KEPT = 80;

/** How a week went, the first time it was played to the end. */
export interface WeekRec {
  /** The score, 0 to 100, as every game gives it. */
  s: number;
  /** Right at the first go, and how many were asked. */
  ok: number;
  n: number;
  ms: number;
  /** When it was finished. */
  t: number;
}

/** The last day the challenge of a zone was played to the end, and the days in a row it had been by then. */
export interface ZoneRec {
  /** That day ("2026-11-20"), its score, the answers right at the first go, how many were asked, and the time. */
  d: string;
  s: number;
  ok: number;
  n: number;
  ms: number;
  run: number;
}

/** The last year the challenge of a special day was played to the end, and how it went. */
export interface OccasionRec {
  /** That year, its score, the answers right at the first go, how many were asked, the time, and when it was finished. */
  y: number;
  s: number;
  ok: number;
  n: number;
  ms: number;
  t: number;
}

/** What a game gives of itself when it ends: the score, what was right at the first go, of how many, and the time. */
export type DatedResult = Pick<WeekRec, 's' | 'ok' | 'n' | 'ms'>;

/** A week is kept by its Monday. */
export function isWeek(s: unknown): s is string {
  if (typeof s !== 'string' || !isDate(s)) return false;
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 1;
}

/** A zone is a continent ("p:EU") or a country ("c:ES"). */
export const isZone = (s: unknown): s is string => typeof s === 'string' && /^(?:p:[A-Z]{2}|c:[A-Z][A-Z0-9])$/.test(s);

/** A special day goes by a short name of its own ("europe"), and each of its challenges by a year. */
export const isOccasion = (s: unknown): s is string => typeof s === 'string' && /^[a-z][a-z0-9]{1,19}$/.test(s);
export const isYear = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 2000 && v <= 9999;

const whole = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

function resultOf(raw: unknown): DatedResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const x = raw as Record<string, unknown>;
  if (!whole(x.s) || !whole(x.ok) || !whole(x.n) || !whole(x.ms)) return null;
  if (x.s > 100 || x.n < 1 || x.ok > x.n) return null;
  return { s: Math.round(x.s), ok: Math.round(x.ok), n: Math.round(x.n), ms: Math.round(x.ms) };
}

/** What storage or a backup holds, with only what is a week and its result, and the latest weeks of those. */
export function cleanWeekly(raw: unknown): Record<string, WeekRec> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const good: [string, WeekRec][] = [];
  for (const [week, rec] of Object.entries(raw as Record<string, unknown>)) {
    const r = resultOf(rec);
    const t = (rec as { t?: unknown } | null)?.t;
    if (isWeek(week) && r && whole(t)) good.push([week, { ...r, t: Math.round(t) }]);
  }
  good.sort((a, b) => (a[0] < b[0] ? 1 : -1));
  return Object.fromEntries(good.slice(0, WEEKS_KEPT));
}

/** A week with its result written down, unless it had one: the first time is the one that counts. */
export function withWeek(weekly: Record<string, WeekRec>, week: string, result: DatedResult, t: number): Record<string, WeekRec> {
  const r = resultOf(result);
  if (!isWeek(week) || weekly[week] || !r || !whole(t)) return weekly;
  return cleanWeekly({ ...weekly, [week]: { ...r, t } });
}

/** What storage or a backup holds, with only what is a zone and its last day, and the zones played latest. */
export function cleanZones(raw: unknown): Record<string, ZoneRec> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const good: [string, ZoneRec][] = [];
  for (const [zone, rec] of Object.entries(raw as Record<string, unknown>)) {
    const r = resultOf(rec);
    const { d, run } = (rec ?? {}) as { d?: unknown; run?: unknown };
    if (isZone(zone) && r && typeof d === 'string' && isDate(d) && whole(run) && run >= 1) good.push([zone, { d, ...r, run: Math.round(run) }]);
  }
  // The latest first; among those of one day, by name, so that the same ones are kept whatever order they came in.
  good.sort((a, b) => (a[1].d !== b[1].d ? (a[1].d < b[1].d ? 1 : -1) : a[0] < b[0] ? -1 : 1));
  return Object.fromEntries(good.slice(0, ZONES_KEPT));
}

/**
 * The challenge of a day of a zone, written down: the first time that day is the one that counts, and a day
 * before the last one kept comes too late. The days in a row go on when the last one was the day before.
 */
export function withZone(zones: Record<string, ZoneRec>, zone: string, date: string, result: DatedResult): Record<string, ZoneRec> {
  const r = resultOf(result);
  const last = zones[zone];
  if (!isZone(zone) || !isDate(date) || !r || (last && last.d >= date)) return zones;
  return cleanZones({ ...zones, [zone]: { d: date, ...r, run: last && last.d === addDays(date, -1) ? last.run + 1 : 1 } });
}

/** What storage or a backup holds, with only what is a special day and its last year, and the ones played latest. */
export function cleanOccasions(raw: unknown): Record<string, OccasionRec> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const good: [string, OccasionRec][] = [];
  for (const [id, rec] of Object.entries(raw as Record<string, unknown>)) {
    const r = resultOf(rec);
    const { y, t } = (rec ?? {}) as { y?: unknown; t?: unknown };
    if (isOccasion(id) && r && isYear(y) && whole(t)) good.push([id, { y, ...r, t: Math.round(t) }]);
  }
  // The latest first; among those of one moment, by name, so that the same ones are kept whatever order they came in.
  good.sort((a, b) => b[1].t - a[1].t || (a[0] < b[0] ? -1 : 1));
  return Object.fromEntries(good.slice(0, OCCASIONS_KEPT));
}

/**
 * The challenge of a special day in a year, written down: the first time that year is the one that counts,
 * and a year before the last one kept comes too late.
 */
export function withOccasion(occasions: Record<string, OccasionRec>, id: string, year: number, result: DatedResult, t: number): Record<string, OccasionRec> {
  const r = resultOf(result);
  const last = occasions[id];
  if (!isOccasion(id) || !isYear(year) || !r || !whole(t) || (last && last.y >= year)) return occasions;
  return cleanOccasions({ ...occasions, [id]: { y: year, ...r, t } });
}
