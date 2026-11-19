/**
 * The daily challenge set beside somebody else's. The challenge is the same for everybody, so the link of a
 * day only has to carry the result of whoever sends it: five points and, if they wish, their name.
 *
 *   #/reto/2026-11-19/kgd84.QW5h      20, 16, 13, 8 and 4 points, from "Ana"
 *   #/reto/2026-11-19/kgd84x          the same points, played the hard way, with no name
 */
import { fromBase64Url, toBase64Url } from '../lib/challenge';
import { NAME_MAX, TESTS, type Rival } from './spec';

/** One sign for each test: its points, from 0 to 20. */
const SIGNS = '0123456789abcdefghijk';
/** After them, when the challenge was played the hard way. */
const HARD = 'x';

const clean = (name: string): string =>
  name
    // Nothing that is not shown, nor what could not be read: a name is a line of text.
    .replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069\ufffd]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)
    .trim();

/** What follows the date in the link of a result. */
export function encodeResult(points: readonly (number | null)[], name = '', hard = false): string {
  const code = Array.from({ length: TESTS }, (_, i) => SIGNS[Math.max(0, Math.min(20, Math.round(points[i] ?? 0)))]).join('') + (hard ? HARD : '');
  const who = clean(name);
  return who ? `${code}.${toBase64Url(who)}` : code;
}

/** The result a link carries; null when it is not one. */
export function decodeResult(code: string): Rival | null {
  const m = /^([0-9a-k]{5})(x?)(?:\.([A-Za-z0-9_-]{1,96}))?$/.exec(code);
  if (!m) return null;
  let n = '';
  if (m[3]) {
    try {
      n = clean(fromBase64Url(m[3]));
    } catch {
      // A name that cannot be read is no name: the points still stand.
    }
  }
  const p = [...m[1]].map((ch) => SIGNS.indexOf(ch));
  return m[2] ? { n, p, h: 1 } : { n, p };
}

export interface Row {
  /** The name to show; empty for one's own row, which the screen names. */
  name: string;
  me: boolean;
  /** Where it is in the day's list of results sent; -1 for one's own. */
  index: number;
  p: number[];
  total: number;
  /** 1 for the highest total; those level share their place. */
  place: number;
  /** Played the hard way. */
  hard: boolean;
}

const sum = (p: readonly number[]): number => p.reduce((a, b) => a + b, 0);

/**
 * Everybody in order, the highest total first. `mine` is one's own points (and `hard`, how they were won),
 * or null while the challenge is not finished. Results with no name are told apart by a number when there
 * are several. The points count the same however they were won: the hard way is marked, not weighed.
 */
export function ranking(mine: readonly (number | null)[] | null, rivals: readonly Rival[], unnamed: (n: number, of: number) => string, hard = false): Row[] {
  const anon = rivals.filter((r) => !r.n).length;
  let seen = 0;
  const rows: Row[] = rivals.map((r, index) => ({ name: r.n || unnamed(++seen, anon), me: false, index, p: r.p, total: sum(r.p), place: 0, hard: r.h === 1 }));
  if (mine) {
    const p = mine.map((x) => x ?? 0);
    rows.push({ name: '', me: true, index: -1, p, total: sum(p), place: 0, hard });
  }
  // Level on points: oneself first, then as they came.
  rows.sort((a, b) => b.total - a.total || Number(b.me) - Number(a.me) || a.index - b.index);
  for (const row of rows) row.place = 1 + rows.filter((r) => r.total > row.total).length;
  return rows;
}

/** The best points of each test among the rows; -1 where everybody got the same, which marks nobody. */
export function bestOf(rows: readonly Row[]): number[] {
  return Array.from({ length: TESTS }, (_, i) => {
    const points = rows.map((r) => r.p[i]);
    const top = Math.max(...points);
    return rows.length > 1 && points.some((x) => x !== top) ? top : -1;
  });
}
