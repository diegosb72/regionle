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

/** Lower-case, accent-free, punctuation-free letters with single spaces. */
function fold(s: string): string {
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
const GENERIC_HEADS = GENERIC.split('|').map((w) => w.replace(/ /g, ''));
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
}

export type Verdict =
  | { res: 'yes' }
  | { res: 'other'; id: string }
  | { res: 'no' }
  /** The abbreviation of the right answer, given while letters of its name are in sight. */
  | { res: 'short' }
  /** Initials that could be several things on the map, and so name none of them. */
  | { res: 'vague' };

export interface MatchOpts {
  /** Only names written out count. For when letters of the answer are in sight: they would spell its abbreviation. */
  whole?: boolean;
}

/** Words that only join the others in a name: an abbreviation counts them or passes over them. */
const LINK = new Set(
  (
    'de del la las los el lo y e i o u a al en ' + // Spanish, Catalan, Galician
    'do da dos das os as em no na ' + // Portuguese
    'du des le les et sur sous au aux ' + // French
    'di della delle dei degli nella sulla dalla ' + // Italian
    'und von van der den het op aan am an im in ob bei ' + // German, Dutch
    'og och ' + // Scandinavian
    'of the and upon on under nad' // English, and the Slavic "na" and "nad"
  ).split(' '),
);

/** "d'Azur", "L'Aquila", "nell'Emilia": the elided word, written out. */
const ELIDED: Record<string, string> = { d: 'de', l: 'le', dell: 'della', nell: 'nella', sull: 'sulla', dall: 'dalla' };

/** Shortest and longest abbreviation worth the name. */
const SHORT_MIN = 2;
const SHORT_MAX = 5;

/** A word of a name, as its initials see it. */
interface Word {
  text: string;
  /** It only joins the others: "de", "y", "of the". */
  link: boolean;
}

/** "II", "XIV": a number, and no more an initial than "12" is. */
const ROMAN = /^(?=[IVX]{2,}$)X{0,3}(IX|IV|V?I{0,3})$/;

/**
 * The words of a name, with its elisions undone: "Val-d'Oise" is "val", "de", "oise". An abbreviation
 * inside a name is read letter by letter: "DR Congo" is "d", "r", "congo". Null when a number is among
 * them ("Región 12", "Édéa II"): a number is not an initial.
 */
function wordsOf(name: string): Word[] | null {
  if (/\d/.test(name)) return null;
  // An elision comes before a vowel or a mute h; the apostrophe of "L'viv" is a soft sign and stays.
  const open = name
    .replace(/\./g, '. ')
    .replace(/&/g, ' y ')
    .replace(/(^|[^\p{L}])(d|l|dell|nell|sull|dall)['’](\p{L})/giu, (m, pre: string, w: string, next: string) => (/[aeiouhy]/.test(norm(next)) ? `${pre}${ELIDED[w.toLowerCase()]} ${next}` : m));
  const out: Word[] = [];
  // Cut where `norm` cuts: apostrophes belong to their word.
  for (const raw of open.split(/[^\p{L}\p{M}'’‘`´ʻʼʿʾ]+/u)) {
    if (!raw) continue;
    if (ROMAN.test(raw)) return null;
    // A capital on its own is an initial already ("D. C."), not the "e" or the "y" between two names.
    if (/^\p{Lu}{1,4}$/u.test(raw)) for (const ch of norm(raw).replace(/ /g, '')) out.push({ text: ch, link: false });
    else for (const w of norm(raw).split(' ')) if (w) out.push({ text: w, link: LINK.has(w) });
  }
  return out;
}

/**
 * The abbreviations a name of several words spells out with its initials: "British Columbia" gives "bc",
 * "Prince Edward Island" gives "pei". Linking words are passed over or counted, one by one or each run of
 * them as one: "Tierra del Fuego" is "tf" and "tdf", "Pays de la Loire" is "pl", "pdll" and "pdl".
 *
 * A name of one word has none, and that is the point: "NH" is what New Hampshire says, while "MA" for
 * Massachusetts is a code to be learnt by heart.
 */
export function initialsOf(name: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (s.length >= SHORT_MIN && s.length <= SHORT_MAX && !out.includes(s)) out.push(s);
  };
  for (const part of name.replace(/\([^)]*\)/g, ' ').split('/')) {
    const words = wordsOf(part);
    if (!words || words.length < 2) continue;
    // The last word is one of the name's own ("Carolina del Sur"), and "sur" joins two only when it stands
    // between them: "Boulogne-sur-Mer", but "Georgias del Sur y Sandwich del Sur".
    const link = words.map((w, i) => w.link && i < words.length - 1 && !(w.text === 'sur' && (i === 0 || words[i - 1].link)));
    const letters = (keep: (i: number) => boolean) =>
      words
        .filter((_, i) => keep(i))
        .map((w) => w.text[0])
        .join('');
    // "La Rioja" has one word of its own: its initials are those of both.
    if (link.filter((l) => !l).length >= 2) add(letters((i) => !link[i]));
    add(letters(() => true));
    add(letters((i) => !link[i] || !link[i - 1]));
  }
  return out;
}

/** True for a name of several words, the only kind that has initials: "Nueva York", not "Massachusetts". */
function severalWords(name: string): boolean {
  return name
    .replace(/\([^)]*\)/g, ' ')
    .split('/')
    .some((part) => (wordsOf(part)?.length ?? 0) >= 2);
}

/** A spelling that is an abbreviation itself: "EEUU", "CDMX", "NWT", "CyL". */
function isAbbreviation(raw: string): boolean {
  const s = raw.replace(/[\s.]/g, '');
  if (s.length < SHORT_MIN || s.length > SHORT_MAX || !/^\p{L}+$/u.test(s)) return false;
  const capitals = [...s].filter((ch) => ch !== ch.toLowerCase()).length;
  // All in capitals, or capitals with single small letters between them.
  return capitals === s.length || (s.length >= 3 && capitals >= 2 && s[0] !== s[0].toLowerCase() && !/\p{Ll}\p{Ll}/u.test(s));
}

/**
 * The official code of a piece: "mg" for "BR-MG", "es" for "ES". It is not an answer (nobody has to know
 * that Massachusetts is "MA"), but initials that are the code of something else are not taken for a name.
 */
function codeOf(id: string): string {
  const m = /^(?:[A-Z]{2}-)?([A-Z]{2,3})$/.exec(id);
  return m ? m[1].toLowerCase() : '';
}

/**
 * What was typed, letter by letter, the way an abbreviation is read: "P.E.I.", "p e i" and "PEI" are one.
 * An "&" is read as "y" and as nothing: "J&K".
 */
function lettersOf(input: string): string[] {
  const all = fold(input).replace(/ /g, '');
  return input.includes('&') ? [all, fold(input.replace(/&/g, ' ')).replace(/ /g, '')] : [all];
}

/** Why an abbreviation was not taken, in words that name nothing on the map. */
export function shortNote(res: 'short' | 'vague', text: string): string {
  const typed = text.trim().toUpperCase();
  return res === 'short'
    ? L('Con letras del nombre a la vista, las siglas no valen: escríbelo entero.', 'With letters of the name in sight, initials do not count: type it in full.')
    : L(`«${typed}» puede ser más de un nombre de este mapa: escríbelo entero.`, `"${typed}" could be more than one name on this map: type it in full.`);
}

/** Looks typed answers up in a set of things with several accepted spellings each. */
export class Matcher {
  private exact = new Map<string, string[]>();
  private keys: [string, string][] = [];
  /** Initials that one thing alone on the map spells out: its abbreviation. */
  private short = new Map<string, string>();
  /** Initials that could be several things: more than one spells them out, or they are the code of another. */
  private shared = new Set<string>();
  /** Accepted spellings that are abbreviations themselves ("EEUU", "CDMX"). */
  private caps = new Set<string>();
  /** Names with the article that `key` drops, run together: "larioja". */
  private heads: string[] = [];

  /**
   * `codes: false` when the ids are not those of what is named (the capitals of the countries, under the
   * ids of the countries): the code of Bosnia says nothing about "BA" for Buenos Aires.
   */
  constructor(items: Answerable[], opts: { codes?: boolean } = {}) {
    /** Spellings that are the name of something written out: never an abbreviation, however short ("Po", "Uri"). */
    const named = new Set<string>();
    for (const it of items) {
      const seen = new Set<string>();
      for (const raw of it.answers) {
        if (!raw) continue;
        // The name on show is a name whatever it looks like ("F.C.T."); any other such spelling is short for it.
        const abbreviation = !!it.proper && raw !== it.proper[0] && isAbbreviation(raw);
        for (const part of raw.includes('/') ? [raw, ...raw.split('/')] : [raw]) {
          const variants = [key(part)];
          const bare = part.replace(/\s*\([^)]*\)\s*/g, ' ');
          if (bare !== part) variants.push(key(bare));
          const head = norm(part).replace(/ /g, '');
          if (head !== variants[0]) this.heads.push(head);
          for (const k of variants) {
            if (!k) continue;
            if (abbreviation) this.caps.add(k);
            else named.add(k);
            if (seen.has(k)) continue;
            seen.add(k);
            this.keys.push([k, it.id]);
            const list = this.exact.get(k);
            if (list) list.push(it.id);
            else this.exact.set(k, [it.id]);
          }
        }
      }
    }
    for (const k of named) this.caps.delete(k);

    // Initials stand for a name where they stand for nothing else on the map.
    const coded = new Map<string, string[]>();
    for (const it of opts.codes === false ? [] : items) {
      const code = codeOf(it.id);
      if (code) coded.set(code, [...(coded.get(code) ?? []), it.id]);
    }
    const spelt = new Map<string, Set<string>>();
    for (const it of items) {
      const names = it.proper ?? [];
      // The name the player reads decides. One word has no initials: "Komi" is no "KR" for being the
      // "Komi Republic" in English, any more than Massachusetts is "MA".
      if (!names.length || !severalWords(names[0])) continue;
      for (const name of names)
        for (const k of initialsOf(name)) {
          // A spelling of something, its own or another's, stays what it is.
          if (this.exact.has(k)) continue;
          const ids = spelt.get(k);
          if (ids) ids.add(it.id);
          else spelt.set(k, new Set([it.id]));
        }
    }
    for (const [k, ids] of spelt) {
      const [only] = ids;
      // Initials have to speak for themselves. They do not where two names spell them, even if the code of
      // one settles it ("MG" is Minas Gerais and not Mato Grosso, to those who have learnt it); nor where
      // they are the code of something else ("ES" for El Salvador on a map with Spain on it).
      if (ids.size === 1 && (coded.get(k) ?? []).every((id) => id === only)) this.short.set(k, only);
      else this.shared.add(k);
    }
  }

  /** The one thing the input abbreviates with its initials. */
  private shortFor(input: string): string | undefined {
    for (const k of lettersOf(input)) {
      const id = this.short.get(k);
      if (id) return id;
    }
    return undefined;
  }

  /** Ids whose accepted spellings equal the input (accents, case and punctuation ignored), written out or not. */
  private named(input: string): string[] | undefined {
    const k = key(input);
    const hit = this.exact.get(k);
    if (hit) return hit;
    const loose = looseKey(input);
    return (loose && this.exact.get(loose)) || undefined;
  }

  /**
   * Ids whose accepted spellings equal the input (accents, case and punctuation ignored), or the one thing
   * the input abbreviates.
   */
  lookup(input: string, opts: MatchOpts = {}): string[] {
    const k = key(input);
    if (!k) return [];
    if (opts.whole && this.caps.has(k)) return [];
    const hit = this.named(input);
    if (hit) return hit;
    const id = opts.whole ? undefined : this.shortFor(input);
    return id ? [id] : [];
  }

  /** Every abbreviation taken on this map, with the thing it stands for: initials, and spellings such as "EEUU". */
  abbreviations(): [string, string][] {
    const out: [string, string][] = [...this.short];
    for (const k of this.caps) for (const id of this.exact.get(k) ?? []) out.push([k, id]);
    return out;
  }

  /** True when the input is taken as an abbreviation: initials, or a spelling such as "EEUU". */
  abbreviates(input: string): boolean {
    const k = key(input);
    if (!k) return false;
    if (this.caps.has(k)) return true;
    return !this.named(input) && !!this.shortFor(input);
  }

  /** True when the input is initials that could be several things on the map, and so the name of none of them. */
  vague(input: string): boolean {
    if (!key(input) || this.lookup(input).length) return false;
    return lettersOf(input).some((k) => this.shared.has(k));
  }

  /**
   * True when what was typed may be the beginning of something rather than all of an answer: a name of the
   * map goes on from there, found or not, or a word such as "provincia" does, or a longer abbreviation
   * ("bc" on the way to "bcs").
   */
  begins(input: string): boolean {
    const tries = [...new Set([key(input), ...lettersOf(input)])].filter(Boolean);
    const goesOn = (cand: string) => tries.some((k) => cand.length > k.length && cand.startsWith(k));
    for (const [cand] of this.keys) if (goesOn(cand)) return true;
    for (const cand of this.short.keys()) if (goesOn(cand)) return true;
    for (const cand of this.shared) if (goesOn(cand)) return true;
    return this.heads.some(goesOn) || GENERIC_HEADS.some(goesOn);
  }

  /** Ids nearest to the input within the typo tolerance (empty when the input is too far from everything). */
  near(input: string, opts: MatchOpts = {}): string[] {
    const k = key(input);
    const max = tolerance(k.length);
    if (!k || max === 0) return [];
    let best = max + 1;
    let ids: string[] = [];
    for (const [cand, id] of this.keys) {
      if (Math.abs(cand.length - k.length) > max) continue;
      if (opts.whole && this.caps.has(cand)) continue;
      const d = editDistance(k, cand, Math.min(max, best));
      if (d < best) {
        best = d;
        ids = [id];
      } else if (d === best && d <= max && !ids.includes(id)) ids.push(id);
    }
    return best <= max ? ids : [];
  }

  /** Exact matches, or the nearest ones when nothing matches exactly. */
  find(input: string, opts: MatchOpts = {}): string[] {
    const exact = this.lookup(input, opts);
    return exact.length ? exact : this.near(input, opts);
  }

  /** Is the input an acceptable answer for `target`? Reports which other item it names when it is not. */
  check(input: string, target: string, opts: MatchOpts = {}): Verdict {
    const exact = this.lookup(input, opts);
    if (exact.includes(target)) return { res: 'yes' };
    if (exact.length) return { res: 'other', id: exact[0] };
    // Right, but for being an abbreviation: said so, and not held against the player.
    if (opts.whole && this.lookup(input).includes(target)) return { res: 'short' };
    const near = this.near(input, opts);
    if (near.includes(target)) return { res: 'yes' };
    if (near.length) return { res: 'other', id: near[0] };
    return this.vague(input) ? { res: 'vague' } : { res: 'no' };
  }

  /** True when the input is the beginning of a longer spelling of one of `ids`. */
  isPrefixOf(input: string, ids: ReadonlySet<string>): boolean {
    const k = key(input);
    if (!k) return false;
    for (const [cand, id] of this.keys) if (cand.length > k.length && ids.has(id) && cand.startsWith(k)) return true;
    return false;
  }

  /**
   * For a game that takes answers as they are typed: which of the `open` things the text so far names, and
   * whether they have to wait for Enter because the player may be on the way to something else.
   *
   * A name waits while it is the beginning of another open name ("Guinea"). An abbreviation is a couple of
   * letters, and so are the first letters of most names: it waits whenever a name of the map, open or not,
   * could be starting with it ("ne" on the way to "Newfoundland"), and is taken at once otherwise ("bc").
   */
  typed(input: string, open: ReadonlySet<string>): { ids: string[]; wait: boolean } {
    const ids = this.lookup(input).filter((id) => open.has(id));
    if (!ids.length) return { ids, wait: false };
    const others = new Set([...open].filter((id) => !ids.includes(id)));
    return { ids, wait: this.isPrefixOf(input, others) || (this.abbreviates(input) && this.begins(input)) };
  }

  /** Items whose spellings start with (or contain) the input, best first: for autocompletion. */
  suggest(input: string, limit = 6): string[] {
    const k = key(input);
    if (!k) return [];
    // What the input abbreviates comes first: it is what Enter would take.
    const short = this.named(input) ? undefined : this.shortFor(input);
    const starts: string[] = short ? [short] : [];
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
