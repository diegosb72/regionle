/**
 * Four things said of each country that are not figures: the currency it pays with, the languages that are
 * official in it, its internet domain and its dialling code (public/data/facts.json, written by
 * scripts/data/facts.mjs). They come in a file of their own, and so does this code: both are fetched only
 * by the games that ask about them or show them (lib/decks.ts), so that nobody else pays for them.
 */
import { L, nm } from './i18n';
import { Matcher } from './matcher';
import { listed, norm } from './text';
import type { Country, FactKind, FactVerdict, Facts } from './types';
import { loadFile, loadIndex, once } from './world';

/** What the file says of one country: only what it has. */
export interface FactRec {
  /** The codes of its currencies, its own first. */
  m?: string[];
  /** The languages that are official in the whole of it, the most spoken first. */
  l?: string[];
  /** Those that are official in part of it: never shown, but right when typed and never a wrong option. */
  r?: string[];
  /** Others that many of its people speak and are the first language of some country: never a wrong option either. */
  s?: string[];
  /** Its internet domain, with its dot. */
  d?: string;
  /** Its dialling codes: digits, with a space where they are said in two groups ("1 809"). */
  p?: string[];
}

export interface FactsFile {
  c: Record<string, FactRec>;
  /** Each currency: its name in Spanish and in English, what it is called for short in each, and the other names it is typed by. */
  m: Record<string, string[]>;
  /** Each language: its name in Spanish and in English, and the other names it is typed by. */
  l: Record<string, string[]>;
}

/** Words that say nothing of which country a name is of. */
const IDLE = new Set(['de', 'del', 'la', 'las', 'los', 'the', 'and']);
const wordsOf = (text: string): string[] => norm(text).split(' ').filter((w) => w.length >= 3 && !IDLE.has(w));

/** How many letters two words begin alike for. */
function alike(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Does the name of a country give away what is said of it? It does where a word of the one begins like a
 * word of the other for `min` letters or more: "francés" and "Francia", "ruso" and "Rusia", "boliviano" and
 * "Bolivia". Asking it would teach nothing, as with a capital named after its country.
 */
export function givenAway(said: string, name: string, min: number): boolean {
  const mine = wordsOf(name);
  return wordsOf(said).some((p) => mine.some((q) => alike(p, q) >= min));
}

/**
 * The letters it takes: three for a language, which is nearly always named after its people ("ruso",
 * "checo", "lao"); four for a currency, which seldom is (the "libra" owes nothing to "Líbano").
 */
const AWAY: Partial<Record<FactKind, number>> = { language: 3, currency: 4 };

/** "dólares", "pesos", "pounds": what whoever is asked what a country pays with may well type. */
export function pluralOf(word: string, spanish: boolean): string {
  if (/s$/i.test(word)) return word;
  if (!spanish || /[aeiouáéó]$/i.test(word)) return `${word}s`;
  return /z$/i.test(word) ? `${word.slice(0, -1)}ces` : `${word}es`;
}

/** What is typed for a domain or a dialling code, as it is compared: "ES" and ".es" are one, and so are "+34", "0034" and "34". */
const typedAs = (kind: FactKind, text: string): string => (kind === 'domain' ? text.trim().toLowerCase().replace(/^\.+/, '') : /^[\s\d+().-]+$/.test(text) ? text.replace(/\D/g, '').replace(/^0+/, '') : '');

class Book implements Facts {
  private matchers: Partial<Record<FactKind, Matcher>> = {};
  private held = new Map<string, Set<string>>();

  constructor(
    private file: FactsFile,
    private countries: ReadonlyMap<string, Country>,
  ) {}

  private name(id: string): string {
    const c = this.countries.get(id);
    return c ? nm(c.n) : id;
  }

  /** What a currency or a language is called where it stands for an answer: a currency, without saying whose it is. */
  private label(kind: FactKind, code: string): string {
    const names = (kind === 'currency' ? this.file.m : this.file.l)[code];
    return !names ? code : kind === 'currency' ? L(names[2], names[3]) : L(names[0], names[1]);
  }

  /** What a country has of something, each as the file has it: the codes of its currencies or of its languages, its domain, its dialling codes. */
  private values(kind: FactKind, id: string): string[] {
    const rec = this.file.c[id];
    if (!rec) return [];
    return kind === 'currency' ? (rec.m ?? []) : kind === 'language' ? (rec.l ?? []) : kind === 'domain' ? (rec.d ? [rec.d] : []) : (rec.p ?? []);
  }

  /** …and each as it is shown. */
  private shown(kind: FactKind, id: string): string[] {
    const list = this.values(kind, id).map((v) => (kind === 'dial' ? `+${v}` : kind === 'domain' ? v : this.label(kind, v)));
    // Two currencies of one name are one answer: the two dollars of a country that had them would be "dólar".
    return [...new Set(list)];
  }

  said(kind: FactKind, id: string): string {
    return this.shown(kind, id)[0] ?? '';
  }

  all(kind: FactKind, id: string): string {
    return listed(this.shown(kind, id), L('y', 'and'));
  }

  /**
   * Every name by which a currency or a language is true of a country, as names are compared: in either
   * language, since whoever types "som" for the "sum" of Uzbekistan is right, and so the "som" of Kyrgyzstan
   * cannot stand beside it as a wrong answer. The languages include those that are official in part of the
   * country and those many of its people speak.
   */
  private names(kind: 'currency' | 'language', id: string): Set<string> {
    const key = `${kind}:${id}`;
    let set = this.held.get(key);
    if (!set) {
      const rec = this.file.c[id];
      const codes = kind === 'currency' ? (rec?.m ?? []) : [...(rec?.l ?? []), ...(rec?.r ?? []), ...(rec?.s ?? [])];
      const all = kind === 'currency' ? this.file.m : this.file.l;
      set = new Set(codes.flatMap((code) => (all[code] ?? []).map(norm)));
      this.held.set(key, set);
    }
    return set;
  }

  holds(kind: FactKind, id: string, said: string): boolean {
    if (kind === 'domain' || kind === 'dial') return this.shown(kind, id).includes(said);
    return this.names(kind, id).has(norm(said));
  }

  choosable(kind: FactKind, ids: readonly string[]): boolean {
    const answers = [...new Set(ids.map((id) => this.said(kind, id)).filter(Boolean))];
    if (answers.length < 4) return false;
    // Three of them have to be wrong of each country that is asked: what is true of it too is no option.
    return this.asked(kind, ids).every((id) => {
      let wrong = 0;
      for (const said of answers) if (!this.holds(kind, id, said) && ++wrong >= 3) return true;
      return false;
    });
  }

  asked(kind: FactKind, ids: readonly string[], shown = false): string[] {
    const have = ids.filter((id) => this.values(kind, id).length > 0);
    if (shown) {
      // The fact is given and the country is to be found: it has to be of one country alone among these.
      const times = new Map<string, number>();
      for (const id of have) for (const v of this.values(kind, id)) times.set(v, (times.get(v) ?? 0) + 1);
      return have.filter((id) => this.values(kind, id).every((v) => times.get(v) === 1));
    }
    const min = AWAY[kind];
    return min ? have.filter((id) => !givenAway(this.said(kind, id), this.name(id), min)) : have;
  }

  /** What looks typed answers up among the currencies or the languages of the world, built the first time it is needed. */
  private matcher(kind: 'currency' | 'language'): Matcher {
    return (this.matchers[kind] ??= new Matcher(
      Object.entries(kind === 'currency' ? this.file.m : this.file.l).map(([code, names]) => ({
        id: code,
        // A currency answers to its code too, and to more than one of it: "EUR", "dólares".
        answers: kind === 'currency' ? [...names, pluralOf(names[2], true), pluralOf(names[3], false), code] : names,
      })),
      // The codes are those of the currencies and of the languages: they say nothing of the initials of anything.
      { codes: false },
    ));
  }

  check(kind: FactKind, id: string, text: string, among: readonly string[]): FactVerdict {
    if (kind === 'domain' || kind === 'dial') {
      const bare = (v: string) => (kind === 'domain' ? v.slice(1) : v.replace(/ /g, ''));
      const typed = typedAs(kind, text);
      if (typed && this.values(kind, id).some((v) => bare(v) === typed)) return { right: true };
      // Somebody else's: said, with whose it is, when that country is on the map.
      const owner = typed ? among.find((o) => o !== id && this.values(kind, o).some((v) => bare(v) === typed)) : undefined;
      if (!owner) return { right: false };
      const meant = this.shown(kind, owner).find((s) => s.replace(/[ +.]/g, '') === typed) ?? this.said(kind, owner);
      const whose = this.name(owner);
      return {
        right: false,
        meant,
        note: kind === 'domain' ? L(`«${meant}» es el dominio de ${whose}.`, `“${meant}” is the domain of ${whose}.`) : L(`«${meant}» es el prefijo de ${whose}.`, `“${meant}” is the dialling code of ${whose}.`),
      };
    }
    const rec = this.file.c[id];
    // Any language that is official in the country is right, also one that is so in part of it.
    const targets = kind === 'currency' ? (rec?.m ?? []) : [...(rec?.l ?? []), ...(rec?.r ?? [])];
    const matcher = this.matcher(kind);
    let other: string | undefined;
    for (const target of targets) {
      const v = matcher.check(text, target);
      if (v.res === 'yes') return { right: true };
      if (v.res === 'other') other ??= v.id;
    }
    if (!other) return { right: false };
    const meant = this.label(kind, other);
    if (kind === 'currency') return { right: false, meant, note: L(`La moneda no es «${meant}».`, `The currency is not “${meant}”.`) };
    const here = this.name(id);
    return {
      right: false,
      meant,
      note: rec?.s?.includes(other) ? L(`El ${meant} se habla en ${here}, pero no es oficial.`, `${meant} is spoken in ${here}, but it is not official.`) : L(`No es el ${meant}.`, `It is not ${meant}.`),
    };
  }

  suggest(kind: FactKind, text: string): string[] {
    if (kind !== 'currency' && kind !== 'language') return [];
    // Many currencies share a name: each name is offered once.
    return [...new Set(this.matcher(kind).suggest(text, 24).map((code) => this.label(kind, code)))].slice(0, 6);
  }

  ask(kind: FactKind, shown = false): string {
    if (shown) {
      if (kind === 'domain') return L('Señala el país de este dominio de internet', 'Pin the country of this internet domain');
      if (kind === 'dial') return L('Señala el país de este prefijo telefónico', 'Pin the country of this dialling code');
      return kind === 'currency' ? L('Señala el país que tiene esta moneda', 'Pin the country that has this currency') : L('Señala el país donde es oficial', 'Pin the country where this is official');
    }
    if (kind === 'currency') return L('¿Qué moneda se usa en…?', 'Which currency is used in…?');
    if (kind === 'language') return L('¿Qué idioma es oficial en…?', 'Which language is official in…?');
    return kind === 'domain' ? L('¿Cuál es el dominio de internet de…?', 'What is the internet domain of…?') : L('¿Cuál es el prefijo telefónico de…?', 'What is the dialling code of…?');
  }

  card(id: string): [name: string, value: string][] {
    const rec = this.file.c[id];
    if (!rec) return [];
    const and = L('y', 'and');
    const rows: [string, string][] = [];
    // In full here, where there is nothing to give away: "dólar estadounidense".
    if (rec.m?.length) rows.push([L('Moneda', 'Currency'), listed(rec.m.map((code) => L(this.file.m[code][0], this.file.m[code][1])), and)]);
    if (rec.l?.length) rows.push([rec.l.length > 1 ? L('Idiomas oficiales', 'Official languages') : L('Idioma oficial', 'Official language'), this.all('language', id)]);
    if (rec.d) rows.push([L('Dominio de internet', 'Internet domain'), rec.d]);
    if (rec.p?.length) rows.push([L('Prefijo telefónico', 'Dialling code'), this.all('dial', id)]);
    return rows;
  }
}

/** Those four things as the games ask about them, from the file they come in and the countries of the game. */
export function factsOf(file: FactsFile, countries: ReadonlyMap<string, Country>): Facts {
  return new Book(file, countries);
}

/** The same, fetched: once for everybody who asks. */
export function loadFacts(): Promise<Facts> {
  return once('facts', async () => {
    const [file, world] = await Promise.all([loadFile<FactsFile>('facts.json'), loadIndex()]);
    return factsOf(file, world.byId);
  });
}
