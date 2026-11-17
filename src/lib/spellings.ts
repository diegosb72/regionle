/**
 * What a pattern takes, written out. The list the game ships with says most of what a region answers to
 * with patterns ("r:^GALI[CZ]I?A"), which are for the game to read: the settings show the spellings
 * instead ("GALICIA", "GALICA", "GALIZIA", "GALIZA"), and this is where they come from.
 */
import { norm, patternFinds, patternOf, patternTakes, typedWords } from './text';

export interface Spellings {
  /**
   * The spellings the pattern takes whole, as they are compared: capitals and digits run together, with
   * "…" where any letters will do. First the ones a person would write: what the pattern takes of each
   * name of the thing, and of what is left of the name when words are dropped ("MANCHA", "LAMANCHA",
   * "CASTILLALAMANCHA"), name by name and from the shortest. Then the rest, the nearest to those first
   * ("YLAMANCHA" before "ANDMANCHA").
   */
  forms: string[];
  /** True when the pattern takes more than were listed: it is loose enough to take hundreds. */
  more: boolean;
}

/** More letters than this to choose from at one place are "any letter". */
const WIDE = 12;
/** How many spellings are carried from one part of a pattern to the next, the shortest: a loose one takes thousands. */
const KEEP = 240;
/** A name of more words than this gives its runs of words rather than every choice among them. */
const WORDS = 7;
/** The spellings made of a name that the others are set against. */
const NEAR = 12;
/** A spelling this far from all of those is as far as any other. */
const FAR = 4;
/** Where a letter that stands for any letter is kept while the spellings are made: one sign each. */
const ANY = 0xe000;
const ANY_RUN = /[\ue000-\uf8ff]+/g;
const ANY_ONE = /[\ue000-\uf8ff]/g;

type Node =
  | { t: 'lit'; c: string }
  /** One of a few letters: "[CZ]". */
  | { t: 'set'; chars: string[] }
  /** One of so many that they are not told apart: ".", "[A-Z]". `sample` is one of them. */
  | { t: 'any'; sample: string; at?: number }
  | { t: 'seq'; parts: Node[] }
  | { t: 'alt'; opts: Node[] }
  | { t: 'rep'; of: Node; min: number; max: number };

/** Thrown at a sign whose spellings cannot be listed: "\d", "[^A]", "(?=". */
class Unlistable extends Error {}

/** What is typed reaches a pattern as these and nothing else. */
const typable = (c: string): boolean => /^[a-z0-9]$/.test(c);
const NOTHING: Node = { t: 'alt', opts: [] };

/** Reads the expression of a pattern the way the browser does, as far as its spellings can be listed. */
function parse(src: string): Node {
  let i = 0;
  const fail = (): never => {
    throw new Unlistable();
  };

  const alt = (): Node => {
    const opts = [seq()];
    while (src[i] === '|') {
      i++;
      opts.push(seq());
    }
    return opts.length === 1 ? opts[0] : { t: 'alt', opts };
  };

  const seq = (): Node => {
    const parts: Node[] = [];
    while (i < src.length && src[i] !== '|' && src[i] !== ')') parts.push(counted(atom()));
    return { t: 'seq', parts };
  };

  const counted = (of: Node): Node => {
    const c = src[i];
    let min: number;
    let max: number;
    if (c === '?') [min, max] = [0, 1];
    else if (c === '+') [min, max] = [1, Infinity];
    else if (c === '*') [min, max] = [0, Infinity];
    else if (c === '{') {
      const m = /^\{(\d+)(?:(,)(\d*))?\}/.exec(src.slice(i));
      // A brace that counts nothing is a brace, and nobody types one.
      if (!m) return of;
      min = Number(m[1]);
      max = m[2] ? (m[3] ? Number(m[3]) : Infinity) : min;
      i += m[0].length - 1;
    } else return of;
    i++;
    // "+?" takes the same spellings as "+".
    if (src[i] === '?') i++;
    return { t: 'rep', of, min, max };
  };

  const atom = (): Node => {
    const c = src[i];
    if (c === '(') {
      i++;
      if (src[i] === '?') {
        if (src[i + 1] !== ':') fail();
        i += 2;
      }
      const inner = alt();
      if (src[i] !== ')') fail();
      i++;
      return inner;
    }
    if (c === '[') return among();
    if (c === '.') {
      i++;
      return { t: 'any', sample: 'a' };
    }
    // The spellings are those that the pattern takes whole, so its ends say nothing more.
    if (c === '^' || c === '$') {
      i++;
      return { t: 'seq', parts: [] };
    }
    if (c === '\\' || c === '*' || c === '+' || c === '?') fail();
    i++;
    const low = c.toLowerCase();
    return typable(low) ? { t: 'lit', c: low } : NOTHING;
  };

  const among = (): Node => {
    const end = src.indexOf(']', i + 1);
    if (end < 0) fail();
    const body = src.slice(i + 1, end);
    i = end + 1;
    if (body[0] === '^' || body.includes('\\')) fail();
    const chars = new Set<string>();
    for (let k = 0; k < body.length; k++) {
      if (body[k + 1] === '-' && k + 2 < body.length) {
        const from = body.charCodeAt(k);
        const to = body.charCodeAt(k + 2);
        if (to < from || to - from > 255) fail();
        for (let x = from; x <= to; x++) chars.add(String.fromCharCode(x).toLowerCase());
        k += 2;
      } else chars.add(body[k].toLowerCase());
    }
    const list = [...chars].filter(typable);
    if (!list.length) return NOTHING;
    return list.length > WIDE ? { t: 'any', sample: list.find((x) => x >= 'a') ?? list[0] } : { t: 'set', chars: list };
  };

  const root = alt();
  if (i < src.length) fail();
  return root;
}

/**
 * The spellings a pattern is made of, the shortest first, with a sign of `ANY` where any letter will do.
 * A letter that may come any number of times comes once and twice ("HIG+INS": "HIGINS", "HIGGINS"), and
 * one that may be left out, also not at all.
 */
function listed(root: Node): { raw: string[]; cut: boolean; samples: string[] } {
  const samples: string[] = [];
  let cut = false;

  /** No spelling twice, the shortest first and, among those of one length, in the order the pattern gives them. */
  const keep = (list: string[]): string[] => {
    const one = [...new Set(list)].sort((a, b) => a.length - b.length);
    if (one.length > KEEP) {
      cut = true;
      one.length = KEEP;
    }
    return one;
  };
  const times = (a: string[], b: string[]): string[] => {
    const out: string[] = [];
    for (const x of a) for (const y of b) out.push(x + y);
    return out;
  };

  const spell = (n: Node): string[] => {
    switch (n.t) {
      case 'lit':
        return [n.c];
      case 'set':
        return n.chars;
      case 'any':
        if (n.at === undefined) {
          n.at = samples.length;
          samples.push(n.sample);
        }
        return [String.fromCharCode(ANY + n.at)];
      case 'alt':
        return keep(n.opts.flatMap(spell));
      case 'seq': {
        let out = [''];
        for (const part of n.parts) {
          const next = spell(part);
          if (!next.length) return [];
          out = keep(times(out, next));
        }
        return out;
      }
      case 'rep': {
        const one = spell(n.of);
        // Any letters, any number of them: written once, as what it is.
        if (n.of.t === 'any') return n.min === 0 ? ['', one[0]] : n.min > 40 ? [] : [one[0].repeat(n.min)];
        const most = n.max === Infinity ? Math.max(n.min, 1) + 1 : Math.min(n.max, n.min + 2);
        if (n.max !== Infinity && most < n.max) cut = true;
        const out: string[] = [];
        let power = [''];
        for (let count = 0; count <= most && power.length; count++) {
          if (count >= n.min) out.push(...power);
          if (count < most) power = keep(times(power, one));
        }
        return keep(out);
      }
    }
  };

  return { raw: spell(root), cut, samples };
}

/**
 * What a person would write for a thing that goes by this name: the name, and what is left of it when
 * some of its words are dropped ("Castilla y León": "leon", "yleon", "castillaleon"…).
 */
function written(name: string): string[] {
  const out = new Set<string>();
  // "St. Gallen" is typed with "st" and with "saint".
  for (const words of [typedWords(name), norm(name).split(' ').filter(Boolean)]) {
    const n = words.length;
    if (n > WORDS) {
      for (let a = 0; a < n; a++) for (let b = a + 1; b <= n; b++) out.add(words.slice(a, b).join(''));
      continue;
    }
    for (let mask = 1; mask < 1 << n; mask++) {
      let s = '';
      for (let k = 0; k < n; k++) if (mask & (1 << k)) s += words[k];
      out.add(s);
    }
  }
  return [...out];
}

/** How many letters have to change, come or go to make one spelling of the other; `FAR` when more than a few. */
function apart(a: string, b: string): number {
  if (Math.abs(a.length - b.length) >= FAR) return FAR;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let least = i;
    for (let j = 1; j <= b.length; j++) {
      const d = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      row.push(d);
      if (d < least) least = d;
    }
    if (least >= FAR) return FAR;
    prev = row;
  }
  return Math.min(prev[b.length], FAR);
}

function work(text: string, names: readonly string[]): Spellings | null {
  let raw: string[];
  let cut = false;
  let samples: string[] = [];
  if (text[0] === 'c') raw = [text.slice(2).toLowerCase()];
  else {
    try {
      ({ raw, cut, samples } = listed(parse(text.slice(2))));
    } catch (e) {
      if (e instanceof Unlistable) return null;
      throw e;
    }
  }
  const show = (w: string): string => w.replace(ANY_RUN, '…').toUpperCase();
  const probe = (w: string): string => w.replace(ANY_ONE, (c) => samples[c.charCodeAt(0) - ANY]);

  // Nothing is shown that the pattern does not take, whatever was made of its signs here.
  const taken = new Set<string>();
  for (const w of raw) if (w && patternTakes(text, probe(w))) taken.add(show(w));

  // What it takes of each name comes first, in the order of the names: the one on show, then the others.
  const real: string[] = [];
  for (const name of names) {
    const got = new Set<string>();
    for (const w of written(name)) {
      // A pattern is done with a name before the name ends: "^RA[SK]" takes "ras" of "Ras al-Jaima".
      const part = patternFinds(text, w);
      if (part && patternTakes(text, part)) got.add(part.toUpperCase());
    }
    for (const f of [...got].sort((a, b) => a.length - b.length)) if (!real.includes(f)) real.push(f);
  }
  for (const r of real) taken.delete(r);

  let rest = [...taken];
  if (real.length && rest.length) {
    const near = real.slice(0, NEAR);
    const far = new Map(rest.map((f) => [f, Math.min(...near.map((r) => apart(f, r)))]));
    rest = rest.sort((a, b) => far.get(a)! - far.get(b)! || a.length - b.length);
  }
  const forms = [...real, ...rest];
  return forms.length ? { forms, more: cut } : null;
}

const known = new Map<string, Spellings | null>();

/**
 * The spellings that a pattern takes, for a thing that goes by `names`; null when the text is no pattern
 * or when what it takes cannot be listed (it is written with signs that this does not read).
 */
export function spellingsOf(pattern: string, names: readonly string[] = []): Spellings | null {
  const text = patternOf(pattern);
  if (!text) return null;
  const k = `${text}\n${names.join('\n')}`;
  let got = known.get(k);
  if (got === undefined) {
    got = work(text, names);
    known.set(k, got);
  }
  return got;
}
