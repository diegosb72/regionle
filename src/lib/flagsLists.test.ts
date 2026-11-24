/**
 * scripts/data/flags-lists.mjs, which writes the lists of what flies a flag and is not in the maps, run on
 * candidates made up here: which countries of other times it takes and which it leaves, and by which flag
 * it foresees each will be shown. And what scripts/data/flags-names.mjs reads in the name of a file.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @ts-expect-error a script of the build, written without types
import { mentions, plain, todayTitles } from '../../scripts/data/flags-names.mjs';

const ROOT = path.join(__dirname, '../..');
const SCRIPT = path.join(ROOT, 'scripts/data/flags-lists.mjs');
const json = <T>(file: string): T => JSON.parse(fs.readFileSync(file, 'utf8')) as T;

interface Flag {
  file: string;
  rank?: 'preferred' | 'deprecated';
  from?: string;
  to?: string;
}
interface Candidate {
  links: number;
  es?: string;
  en?: string;
  is?: string[];
  from?: number;
  to?: number;
  game?: string;
  flags?: Flag[];
}
interface Listed {
  es: string;
  en: string;
  from?: number;
  to?: number;
  links?: number;
}
type Lists = Record<'historical' | 'organisations' | 'peoples', Record<string, Listed>>;
interface Report {
  historical: { id: string; flag: string | null }[];
  leftOut: { id: string; why: string }[];
}

const GONE = 'Q3024240';
/** A country of other times that nothing speaks against: it ended in 1990 and has a flag of its own. */
const gone = (more: Partial<Candidate> = {}): Candidate => ({ links: 60, es: 'un país', en: 'A country', is: [GONE], from: 1920, to: 1990, flags: [{ file: 'Flag of a Country.svg' }], ...more });

let dir = '';
let lists: Lists;
let report: Report;

/** The ids that the script names by hand: an organisation or a people that is not among the candidates has to be named there. */
const byHand = [...fs.readFileSync(SCRIPT, 'utf8').matchAll(/^ {2}'(Q\d+)', \/\/ (.+)$/gm)].map((m) => [m[1], m[2]] as const);

beforeAll(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flag-lists-'));
  fs.mkdirSync(path.join(dir, 'flags'));
  const items: Record<string, Candidate> = {
    ...Object.fromEntries(byHand.map(([id, name]) => [id, { links: 100, es: name.toLowerCase(), en: name, flags: [{ file: `Flag of ${name}.svg` }] }])),
    Q900001: gone({ links: 90, es: 'república de antes', en: 'Republic of Before' }),
    Q900002: gone({ to: 1650, flags: [{ file: 'Flag of an Old Kingdom.svg' }] }),
    Q900003: gone({ flags: [{ file: 'Flag of France.svg' }] }),
    Q900004: gone({ links: 100, flags: [{ file: 'Shared flag.svg' }] }),
    Q900005: gone({ links: 50, flags: [{ file: 'Shared flag.svg' }] }),
    Q900006: gone({ is: [GONE, 'Q1790360'], flags: [{ file: 'Flag of an Empire overseas.svg' }] }),
    // The one that Wikidata prefers, though it says when it stopped flying and another does not.
    Q900007: gone({ flags: [{ file: 'Undated.svg', from: '1989-01-01' }, { file: 'Preferred.svg', rank: 'preferred', from: '1950-01-01', to: '1989-01-01' }] }),
    // The one it flew until it ended, before one that nobody dated.
    Q900008: gone({ flags: [{ file: 'Nobody dated it.svg' }, { file: 'Early.svg', to: '1950-01-01' }, { file: 'Until the end.svg', from: '1950-01-01', to: '1991-01-15' }] }),
    // With none that flew until the end, the one that is not said to have stopped; and with none of those, the last that was.
    Q900009: gone({ flags: [{ file: 'First.svg', to: '1930-01-01' }, { file: 'The last, undated.svg' }] }),
    Q900010: gone({ flags: [{ file: 'Older.svg', to: '1930-01-01' }, { file: 'Later.svg', to: '1960-01-01' }, { file: 'Withdrawn.svg', rank: 'deprecated', to: '1990-01-01' }] }),
    Q900011: gone({ game: 'country' }),
    Q900012: gone({ to: undefined, flags: [{ file: 'Flag with no end.svg' }] }),
    Q900013: gone({ flags: [] }),
    Q900014: { links: 80, es: 'una ciudad', en: 'A city', is: ['Q515'], to: 1990, flags: [{ file: 'Flag of a City.svg' }] },
  };
  fs.writeFileSync(path.join(dir, 'flags', 'candidates.json'), JSON.stringify({ items, classes: { [GONE]: 'historical country' } }));
  execFileSync(process.execPath, [SCRIPT, '--from', dir, '--out', path.join(dir, 'lists.json'), '--report', path.join(dir, 'report.json')], { stdio: 'pipe' });
  lists = json<Lists>(path.join(dir, 'lists.json'));
  report = json<Report>(path.join(dir, 'report.json'));
});

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe('the countries that are no more', () => {
  const why = (id: string) => report.leftOut.find((one) => one.id === id)?.why;
  const flag = (id: string) => report.historical.find((one) => one.id === id)?.flag;

  it('are those that Wikidata says were countries, ended in 1700 or later and have a flag of their own', () => {
    expect(Object.keys(lists.historical)).toEqual(['Q900004', 'Q900001', 'Q900007', 'Q900008', 'Q900009', 'Q900010']);
    expect(lists.historical.Q900001).toEqual({ es: 'República de antes', en: 'Republic of Before', from: 1920, to: 1990, links: 90 });
    expect(why('Q900002')).toBe('too old');
    expect(why('Q900003')).toBe('a flag of today');
    expect(why('Q900006')).toBe('not a country');
    expect(why('Q900012')).toBe('no end');
    expect(why('Q900013')).toBe('no flag');
    // What the game already has, and what is not a country, is not even told.
    expect(why('Q900011')).toBeUndefined();
    expect(why('Q900014')).toBeUndefined();
  });

  it('are named once for each flag: of two that the same one would show, the best known', () => {
    expect(lists.historical.Q900004).toBeDefined();
    expect(why('Q900005')).toBe('the same flag as Q900004');
  });

  it('are foreseen by the flag they flew last: the preferred, the one that lasted to the end, one nobody dated, the last', () => {
    expect(flag('Q900007')).toBe('Preferred.svg');
    expect(flag('Q900008')).toBe('Until the end.svg');
    expect(flag('Q900009')).toBe('The last, undated.svg');
    expect(flag('Q900010')).toBe('Later.svg');
  });

  it('come the best known first, so that the list is the same each time it is written', () => {
    const links = Object.values(lists.historical).map((one) => one.links ?? 0);
    expect(links).toEqual([...links].sort((a, b) => b - a));
  });
});

describe('the organisations and the peoples', () => {
  it('are those that the script names by hand, under their names, the Spanish one with a capital letter', () => {
    expect(byHand.length).toBeGreaterThan(70);
    expect([...Object.keys(lists.organisations), ...Object.keys(lists.peoples)]).toEqual(byHand.map(([id]) => id));
    for (const one of [...Object.values(lists.organisations), ...Object.values(lists.peoples)]) {
      expect(one.es.length).toBeGreaterThan(0);
      expect(one.es.charAt(0)).toBe(one.es.charAt(0).toLocaleUpperCase('es'));
    }
    // A name given by hand comes before the one Wikidata has.
    expect(lists.peoples.Q48199).toMatchObject({ es: 'Samis', en: 'Sámi' });
  });
});

describe('the lists of the repository', () => {
  const kept = json<Lists>(path.join(ROOT, 'scripts/data/flags-lists.json'));

  it('name things by their Wikidata id, each in one list, with a name in both languages', () => {
    const ids = Object.values(kept).flatMap((list) => Object.keys(list));
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^Q\d+$/);
    for (const [id, one] of Object.values(kept).flatMap((list) => Object.entries(list))) {
      expect(one.es.trim().length, id).toBeGreaterThan(1);
      expect(one.en.trim().length, id).toBeGreaterThan(1);
    }
    expect(Object.keys(kept.organisations).concat(Object.keys(kept.peoples))).toEqual(byHand.map(([id]) => id));
  });

  it('say of what is no more when it lasted, and none of it ended before 1700', () => {
    expect(Object.keys(kept.historical).length).toBeGreaterThan(150);
    for (const [id, one] of Object.entries(kept.historical)) {
      expect(one.to, id).toBeGreaterThanOrEqual(1700);
      expect(one.to, id).toBeLessThanOrEqual(new Date().getFullYear());
      if (one.from) expect(one.from, id).toBeLessThanOrEqual(one.to!);
    }
    expect(kept.historical.Q15180).toMatchObject({ es: 'Unión Soviética', en: 'Soviet Union', from: 1922, to: 1991 });
  });
});

describe('what the name of a file tells', () => {
  it('is read without its marks, its capitals or its signs', () => {
    expect(plain('Drapel Județul Argeș.svg')).toBe('drapel judetul arges svg');
    expect(plain('  Flag_of-São  Tomé ')).toBe('flag of sao tome');
  });

  it('names what it is the flag of, by a word of its names', () => {
    expect(mentions('Drapel Județul Argeș.png', ['Argeș'])).toBe(true);
    expect(mentions('Flag-of-bistrita-nasaud-county.png', ['Bistrița-Năsăud'])).toBe(true);
    expect(mentions('Bandeira São Tomé.svg', ['Santo Tomé', 'São Tomé'])).toBe(true);
    // A word that begins as the name does.
    expect(mentions('Steagul Argeșului.svg', ['Argeș'])).toBe(true);
    // A name of three letters, as a word of its own and not inside another.
    expect(mentions('Flag of Bar, Montenegro.svg', ['Bar'])).toBe(true);
    expect(mentions('Flag of Barbados.svg', ['Bar'])).toBe(false);
  });

  it('does not name it when it is the flag of something else, or when all they share is a common word', () => {
    expect(mentions('Flag of Algeria.svg', ['Tiaret'])).toBe(false);
    expect(mentions('POL Legnica flag.svg', ['Tizi Ouzou'])).toBe(false);
    expect(mentions('Flag of South West State of Somalia.svg', ['Bakool'])).toBe(false);
    expect(mentions('Flag of Somoto.svg', ['Madriz'])).toBe(false);
    expect(mentions('Flag of the Central Province.svg', ['Provincia Oriental', 'Eastern Province'])).toBe(false);
    expect(mentions('Flag of San Marino.svg', ['San José'])).toBe(false);
  });

  it('knows the flag of a country of today by the name of the country', () => {
    const today = todayTitles({ countries: [{ n: { es: 'Francia', en: 'France' } }, { n: { es: 'Países Bajos', en: 'Netherlands' }, al: ['Holland'] }, { n: { es: 'Andorra' } }] }) as Set<string>;
    for (const title of ['flag of france.svg', 'flag of the netherlands.svg', 'flag of holland.svg', 'flag of andorra.svg', 'flag of the czech republic.svg']) expect(today.has(title), title).toBe(true);
    expect(today.has('flag of france (1794–1815).svg')).toBe(false);
    expect(today.has('flag of francia.svg')).toBe(false);
  });
});
