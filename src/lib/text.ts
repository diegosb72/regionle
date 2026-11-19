/**
 * Text helpers: how names are compared, number formatting and seeded randomness. What judges a typed answer
 * (the short forms and the `Matcher`) lives in lib/matcher.ts, which only the games ask for.
 */
import { L, getLang } from './i18n';
import { area, areaUnit, dist, distUnit } from './units';

const FOLD: Record<string, string> = {
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  ı: 'i',
  þ: 'th',
  ə: 'a',
  ħ: 'h',
};

/** Lower-case, accent-free, punctuation-free letters with single spaces. */
export function fold(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ßæœøđðłıþəħ]/g, (c) => FOLD[c])
    .replace(/&/g, ' y ')
    .replace(/['’‘`´ʻʼʿʾ.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Lower-case, accent-free, punctuation-free form with single spaces. */
export function norm(s: string): string {
  return fold(s).replace(/\bst\b/g, 'saint');
}

/** Comparison key: normalised, without a leading article and without spaces. */
export function key(s: string): string {
  return norm(s)
    .replace(/^(el|la|los|las|the|l) (?=.)/, '')
    .replace(/ /g, '');
}

const GENERIC =
  'provincia|region|estado|departamento|comunidad autonoma|comunidad foral|comunidad|principado|condado|distrito|prefectura|canton|municipio|republica|oblast|krai|territorio|gobernacion|voivodato|emirato|isla|islas|ciudad autonoma|ciudad|province|state|county|department';
const GENERIC_PREFIX = new RegExp(`^(${GENERIC}) (de la |de los |de las |del |de |do |da |of )?(?=.)`);
/** The same words run together, as `key` leaves what is typed. */
export const GENERIC_HEADS = GENERIC.split('|').map((w) => w.replace(/ /g, ''));
const GENERIC_SUFFIX =
  / (province|state|county|region|oblast|krai|prefecture|district|department|canton|voivodeship|governorate|island|islands)$/;

/** Key of the input once a generic word such as "provincia de" is removed, or '' when nothing changes. */
export function looseKey(s: string): string {
  const n = norm(s);
  const stripped = n.replace(GENERIC_PREFIX, '').replace(GENERIC_SUFFIX, '');
  return stripped !== n ? key(stripped) : '';
}

/** Optimal string alignment distance, cut off at `max` (returns `max + 1` beyond it). */
export function editDistance(a: string, b: string, max: number): number {
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;
  if (a === b) return 0;
  let prev2: number[] = [];
  let prev: number[] = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    let best = i;
    for (let j = 1; j <= lb; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) {
        v = Math.min(v, prev2[j - 2] + 1);
      }
      cur[j] = v;
      if (v < best) best = v;
    }
    if (best > max) return max + 1;
    prev2 = prev;
    prev = cur;
  }
  return prev[lb] > max ? max + 1 : prev[lb];
}

/** How many typos a word of this length may contain. */
export function tolerance(len: number): number {
  return len < 5 ? 0 : len < 9 ? 1 : 2;
}

export interface Answerable {
  id: string;
  answers: string[];
  /**
   * Its names proper in each language there is, the one on show first. Where that one has several words,
   * the initials of each are accepted too; a name of one word has none, whatever it is called elsewhere.
   * None are given for what is named after its kind ("Lago Superior"): those initials would say nothing.
   */
  proper?: string[];
  /** What has been chosen for it in the settings: see `ShortEdit`. */
  short?: ShortEdit;
  /**
   * The country a region is in. Short forms are a matter of each country ("North", "NH", "PEI"): on a map
   * of several, those of a piece are judged among the pieces of its own country. See `Matcher`.
   */
  within?: string;
}

/**
 * The say of the settings on the short forms of one thing: those it answers to besides the ones the rule
 * and the data give it, and those of the rule and the data that it does not answer to.
 */
export interface ShortEdit {
  /**
   * As they were written: "Mass", "MA". They are short forms like any other: not taken while letters are in
   * sight. One that begins with "r:" or "c:" is a pattern rather than a spelling: see `patternOf`.
   */
  add?: string[];
  /** Compared without case, dots or spaces: "ri", "R.I."; a pattern, by its text. */
  off?: string[];
  /** False to give it no initials at all, but for those among `add`. */
  rule?: boolean;
}

/** Longest pattern that is kept. */
export const MAX_PATTERN = 160;

/**
 * A pattern among the short forms of a thing, the way the quizzes of JetPunk write them: "r:" and a regular
 * expression ("r:^S[OU]KHUM" takes "Sukhumi" and "Sokhumi"), or "c:" and letters that only have to be found
 * somewhere ("c:CAPITAL"). It is tried on what was typed with its letters and digits run together, capitals
 * and accents aside. Returns it as it is kept, or null when the text is no pattern or cannot be read.
 */
export function patternOf(form: string): string | null {
  const m = /^\s*([rc])\s*:(.*)$/is.exec(form);
  if (!m) return null;
  const body = m[1].toLowerCase() === 'c' ? fold(m[2]).replace(/ /g, '').toUpperCase() : m[2].replace(/\s+/g, '');
  if (!body || body.length > MAX_PATTERN) return null;
  const text = `${m[1].toLowerCase()}:${body}`;
  return compile(text) ? text : null;
}

/** True for what is written as a pattern, readable or not: "r:^A(", "c:". */
export function looksLikePattern(form: string): boolean {
  return /^\s*[rc]\s*:/i.test(form);
}

export interface Compiled {
  /** Found in the text, wherever the expression says: what JetPunk asks. */
  loose: RegExp;
  /** Takes the text whole, to its last letter. */
  full: RegExp;
}

const compiled = new Map<string, Compiled | null>();

export function compile(text: string): Compiled | null {
  let c = compiled.get(text);
  if (c !== undefined) return c;
  const body = text[0] === 'c' ? text.slice(2).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : text.slice(2);
  try {
    // No "u" flag: the expressions are written loosely ("]" on its own), as the browser of their author took them.
    c = { loose: new RegExp(body, 'i'), full: new RegExp(`^(?:${body})$`, 'i') };
  } catch {
    c = null;
  }
  compiled.set(text, c);
  return c;
}

/**
 * Whether a pattern takes these letters whole, to the last one: what the games ask of something typed
 * before they take it without waiting for Enter. `letters` are the letters and digits of what was typed,
 * run together and in lower case.
 */
export function patternTakes(pattern: string, letters: string): boolean {
  return !!letters && !!compile(pattern)?.full.test(letters);
}

/**
 * The part of these letters that a pattern is found in, the way JetPunk looks for it: "sanktgall" in
 * "sanktgallen" for "^(SANKT|ST)GAL[EL]". Null when it is not there.
 */
export function patternFinds(pattern: string, letters: string): string | null {
  const m = letters ? compile(pattern)?.loose.exec(letters) : null;
  return m?.[0] || null;
}

/** Names in a row, the last one after a word: "Regiones, Países o Física". */
export function listed(names: readonly string[], last: string): string {
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} ${last} ${names[names.length - 1]}` : names.join('');
}

// ---------------------------------------------------------------------------
// Numbers
// ---------------------------------------------------------------------------

const formatters = new Map<string, Intl.NumberFormat>();
/** Number with at most `digits` decimals, written the way of the interface language ("1.417,5" · "1,417.5"). */
export function nf(n: number, digits = 0): string {
  const lang = getLang();
  let f = formatters.get(`${lang}${digits}`);
  if (!f) {
    f = new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', { maximumFractionDigits: digits });
    formatters.set(`${lang}${digits}`, f);
  }
  return f.format(n);
}

/** Rounds to `sig` significant figures. */
export function sig(n: number, digits: number): number {
  if (!n) return 0;
  const p = Math.pow(10, digits - 1 - Math.floor(Math.log10(Math.abs(n))));
  return Math.round(n * p) / p;
}

/** "49,4 millones", "1.417 millones", "94.200", "825". */
export function fmtBig(n: number): string {
  if (n >= 999_500) {
    const m = n / 1e6;
    const txt = nf(m, m >= 100 ? 0 : m >= 10 ? 1 : 2);
    return `${txt} ${L(txt === '1' ? 'millón' : 'millones', 'million')}`;
  }
  return nf(n >= 1000 ? sig(n, 3) : Math.round(n));
}

/** Compact form for tight spaces: "49,4 M", "94,2 mil" ("94.2k" in English). */
export function fmtShort(n: number): string {
  if (n >= 999_500) {
    const m = n / 1e6;
    return `${nf(m, m >= 100 ? 0 : m >= 10 ? 1 : 2)} M`;
  }
  if (n >= 10_000) {
    const k = nf(n / 1e3, n >= 100_000 ? 0 : 1);
    return L(`${k} mil`, `${k}k`);
  }
  return nf(Math.round(n));
}

export function fmtPop(n: number): string {
  return `${fmtBig(n)} ${L(n >= 999_500 ? 'de habitantes' : 'habitantes', 'people')}`;
}

/** A surface in the unit of the player: "505.990 km²" · "195.364 mi²" ("195,364 sq mi"). */
export function fmtArea(km2: number): string {
  const v = area(km2);
  const unit = areaUnit();
  if (v >= 999_500) return `${fmtBig(v)} ${L(`de ${unit}`, unit)}`;
  return `${nf(v, v < 100 ? 2 : 0)} ${unit}`;
}

/** A distance in the unit of the player: "441 km" · "274 mi". Whole, unless decimals are asked for. */
export function fmtDist(km: number, digits = 0): string {
  return `${nf(dist(km), digits)} ${distUnit()}`;
}

/** "1:05", "12:40", "1:02:03". */
export function fmtTime(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/**
 * Reads a number the way a Spanish speaker types it: the comma is the decimal mark, and a point
 * followed by exactly three digits separates thousands ("1.400" is 1400, "1.4" and "1,4" are 1.4).
 */
export function parseNumber(text: string): number | null {
  let t = text.trim().replace(/[\s\u00a0\u202f']/g, '');
  if (!t || !/^[0-9.,]+$/.test(t)) return null;
  // In English the two marks swap roles: read it as its mirror image.
  if (getLang() === 'en') t = t.replace(/[.,]/g, (ch) => (ch === '.' ? ',' : '.'));
  const commas = (t.match(/,/g) || []).length;
  const points = (t.match(/\./g) || []).length;
  if (commas > 1 && points === 0) t = t.replace(/,/g, '');
  else if (commas > 1) return null;
  else {
    if (points > 1 || (points === 1 && commas === 1) || /^\d{1,3}\.\d{3}$/.test(t)) t = t.replace(/\./g, '');
    t = t.replace(',', '.');
  }
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Judges a numeric guess by its relative error: within 10 % is right, within 30 % is close. */
export function judgeAmount(guess: number, real: number): { res: 'ok' | 'warn' | 'bad'; error: number } {
  if (!(real > 0) || !(guess > 0)) return { res: 'bad', error: real > 0 ? -1 : 0 };
  const error = (guess - real) / real;
  const off = Math.abs(error);
  return { res: off <= 0.1 ? 'ok' : off <= 0.3 ? 'warn' : 'bad', error };
}

// ---------------------------------------------------------------------------
// Randomness
// ---------------------------------------------------------------------------

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffle<T>(list: readonly T[], rng: Rng = Math.random): T[] {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function sample<T>(list: readonly T[], n: number, rng: Rng = Math.random): T[] {
  return shuffle(list, rng).slice(0, n);
}

export function pick<T>(list: readonly T[], rng: Rng = Math.random): T {
  return list[Math.floor(rng() * list.length)];
}

const FILLER = new Set(['de', 'del', 'la', 'las', 'el', 'los', 'y', 'e', 'the', 'of', 'and', 'city', 'ciudad', 'do', 'da', 'dos', 'di', 'd', 'l']);

/**
 * Do two names give each other away? True when the words of one are all among the words of the other
 * ("Madrid" and "Comunidad de Madrid", "Guatemala" and "Ciudad de Guatemala"): asking for the capital
 * of a place that is named after it teaches nothing.
 */
export function namesOverlap(a: string, b: string): boolean {
  return nameWithin(a, b) || nameWithin(b, a);
}

/** Are the words of `inner` all among those of `outer`? ("Leribe" in "Leribe", "Madrid" in "Comunidad de Madrid".) */
export function nameWithin(inner: string, outer: string): boolean {
  const words = (s: string) => new Set(norm(s).split(' ').filter((w) => w && !FILLER.has(w)));
  const x = words(inner);
  const y = words(outer);
  if (!x.size || !y.size) return false;
  for (const w of x) if (!y.has(w)) return false;
  return true;
}

/**
 * Does one name ring in the other? Looser than `namesOverlap`: one shared word is enough, and so is a word
 * that begins another ("Valencia" in "Comunidad Valenciana", "Canaria" in "Canarias", "Brasil" in
 * "Brasilia"). Typing such a capital still takes knowing it; picking it out among four options does not.
 */
export function namesEcho(a: string, b: string): boolean {
  const words = (s: string) => norm(s).split(' ').filter((w) => w.length >= 4 && !FILLER.has(w));
  const x = words(a);
  const y = words(b);
  return x.some((p) => y.some((q) => p.startsWith(q) || q.startsWith(p)));
}

/** Characters a hint always shows: they are not letters to guess. */
const SEPARATOR = /[\s\-'’.,()]/;

/** "Te _ _ _ _": the first `shown` letters of an answer, the rest as blanks. */
export function letterHint(answer: string, shown: number): string {
  let left = shown;
  return [...answer].map((ch) => (SEPARATOR.test(ch) ? ch : left-- > 0 ? ch : '_')).join(' ');
}

/** Most letters a hint can show: the last one is always left for the player. */
export function hintMax(answer: string): number {
  return Math.max(0, [...answer].filter((ch) => !SEPARATOR.test(ch)).length - 1);
}

/** Local calendar day as "2026-11-15". */
export function today(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

/** "1 región", "3 regiones". */
export function plural(n: number, one: string, many: string): string {
  return `${nf(n)} ${n === 1 ? one : many}`;
}
