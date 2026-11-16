/** Text helpers: answer matching, number formatting and seeded randomness. */
import { L, getLang } from './i18n';

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

/** Lower-case, accent-free, punctuation-free form with single spaces. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ßæœøđðłıþəħ]/g, (c) => FOLD[c])
    .replace(/&/g, ' y ')
    .replace(/['’‘`´ʻʼʿʾ.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\bst\b/g, 'saint');
}

/** Comparison key: normalised, without a leading article and without spaces. */
export function key(s: string): string {
  return norm(s)
    .replace(/^(el|la|los|las|the|l) (?=.)/, '')
    .replace(/ /g, '');
}

const GENERIC_PREFIX =
  /^(provincia|region|estado|departamento|comunidad autonoma|comunidad foral|comunidad|principado|condado|distrito|prefectura|canton|municipio|republica|oblast|krai|territorio|gobernacion|voivodato|emirato|isla|islas|ciudad autonoma|ciudad|province|state|county|department) (de la |de los |de las |del |de |do |da |of )?(?=.)/;
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
}

export type Verdict = { res: 'yes' } | { res: 'other'; id: string } | { res: 'no' };

/** Looks typed answers up in a set of things with several accepted spellings each. */
export class Matcher {
  private exact = new Map<string, string[]>();
  private keys: [string, string][] = [];

  constructor(items: Answerable[]) {
    for (const it of items) {
      const seen = new Set<string>();
      for (const raw of it.answers) {
        if (!raw) continue;
        for (const part of raw.includes('/') ? [raw, ...raw.split('/')] : [raw]) {
          const variants = [key(part)];
          const bare = part.replace(/\s*\([^)]*\)\s*/g, ' ');
          if (bare !== part) variants.push(key(bare));
          for (const k of variants) {
            if (!k || seen.has(k)) continue;
            seen.add(k);
            this.keys.push([k, it.id]);
            const list = this.exact.get(k);
            if (list) list.push(it.id);
            else this.exact.set(k, [it.id]);
          }
        }
      }
    }
  }

  /** Ids whose accepted spellings equal the input (accents, case and punctuation ignored). */
  lookup(input: string): string[] {
    const k = key(input);
    if (!k) return [];
    const hit = this.exact.get(k);
    if (hit) return hit;
    const loose = looseKey(input);
    return (loose && this.exact.get(loose)) || [];
  }

  /** Ids nearest to the input within the typo tolerance (empty when the input is too far from everything). */
  near(input: string): string[] {
    const k = key(input);
    const max = tolerance(k.length);
    if (!k || max === 0) return [];
    let best = max + 1;
    let ids: string[] = [];
    for (const [cand, id] of this.keys) {
      if (Math.abs(cand.length - k.length) > max) continue;
      const d = editDistance(k, cand, Math.min(max, best));
      if (d < best) {
        best = d;
        ids = [id];
      } else if (d === best && d <= max && !ids.includes(id)) ids.push(id);
    }
    return best <= max ? ids : [];
  }

  /** Exact matches, or the nearest ones when nothing matches exactly. */
  find(input: string): string[] {
    const exact = this.lookup(input);
    return exact.length ? exact : this.near(input);
  }

  /** Is the input an acceptable answer for `target`? Reports which other item it names when it is not. */
  check(input: string, target: string): Verdict {
    const exact = this.lookup(input);
    if (exact.includes(target)) return { res: 'yes' };
    if (exact.length) return { res: 'other', id: exact[0] };
    const near = this.near(input);
    if (near.includes(target)) return { res: 'yes' };
    if (near.length) return { res: 'other', id: near[0] };
    return { res: 'no' };
  }

  /** True when the input is the beginning of a longer spelling of one of `ids`. */
  isPrefixOf(input: string, ids: ReadonlySet<string>): boolean {
    const k = key(input);
    if (!k) return false;
    for (const [cand, id] of this.keys) if (cand.length > k.length && ids.has(id) && cand.startsWith(k)) return true;
    return false;
  }

  /** Items whose spellings start with (or contain) the input, best first: for autocompletion. */
  suggest(input: string, limit = 6): string[] {
    const k = key(input);
    if (!k) return [];
    const starts: string[] = [];
    const inside: string[] = [];
    for (const [cand, id] of this.keys) {
      const at = cand.indexOf(k);
      if (at === 0) {
        if (!starts.includes(id)) starts.push(id);
      } else if (at > 0 && k.length >= 3 && !inside.includes(id)) inside.push(id);
    }
    return [...starts, ...inside.filter((id) => !starts.includes(id))].slice(0, limit);
  }
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

/** Compact form for tight spaces: "49,4 M", "94,2 mil". */
export function fmtShort(n: number): string {
  if (n >= 999_500) {
    const m = n / 1e6;
    return `${nf(m, m >= 100 ? 0 : m >= 10 ? 1 : 2)} M`;
  }
  if (n >= 10_000) return `${nf(n / 1e3, n >= 100_000 ? 0 : 1)} ${L('mil', 'k')}`;
  return nf(Math.round(n));
}

export function fmtPop(n: number): string {
  return `${fmtBig(n)} ${L(n >= 999_500 ? 'de habitantes' : 'habitantes', 'people')}`;
}

export function fmtArea(km2: number): string {
  if (km2 >= 999_500) return `${fmtBig(km2)} ${L('de km²', 'km²')}`;
  return `${nf(km2, km2 < 100 ? 2 : 0)} km²`;
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
