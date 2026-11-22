import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { GUESSES } from '../daily/spec';
import { LESSON } from '../games/lesson';
import { HOT_TRIES } from './blind';
import { CHAIN_MISSES } from './chain';
import { CW_PER_BOARD } from './crossword';
import { helpOf, type ModeHelp } from './help';
import { setLang, type Lang } from './i18n';
import { MODES, SECTION_IDS } from './modes';
import { CLUES_OK, RIDDLE_POINTS } from './riddle';
import type { Mode, Section } from './types';
import { WS_PER_BOARD } from './wordsearch';

afterEach(() => setLang('es'));

/** Every game of every section, once for each. */
const games = (): [Section, Mode][] => SECTION_IDS.flatMap((section) => MODES[section].map((m): [Section, Mode] => [section, m.id]));

const textOf = (h: ModeHelp): string => [...h.steps, h.score, h.aid ?? '', h.tip ?? ''].join('\n');

/** Every string of the game, as it is written in its code: what a button can say. */
function sources(): string {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(file);
      else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && entry.name !== 'help.ts') out.push(fs.readFileSync(file, 'utf8'));
    }
  };
  walk(path.join(process.cwd(), 'src'));
  return out.join('\n').toLowerCase();
}

describe('how each game is played', () => {
  it('is told for every game of every section, in both languages', () => {
    const said: Record<Lang, Map<string, string>> = { es: new Map(), en: new Map() };
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      for (const [section, mode] of games()) {
        const help = helpOf(mode, section);
        expect(help, `${section} ${mode}`).not.toBeNull();
        expect(help!.steps.length, `${section} ${mode}`).toBeGreaterThanOrEqual(2);
        expect(help!.steps.length, `${section} ${mode}`).toBeLessThanOrEqual(4);
        for (const line of [...help!.steps, help!.score, ...(help!.aid ? [help!.aid] : []), ...(help!.tip ? [help!.tip] : [])]) {
          expect(line.length, `${section} ${mode}: ${line}`).toBeGreaterThan(12);
          expect(line, `${section} ${mode}`).not.toMatch(/undefined|null|NaN|\[object| {2}/);
          // A sentence, with its full stop.
          expect(line.trim(), `${section} ${mode}`).toMatch(/[.…!?»”)]$/);
        }
        said[lang].set(`${section} ${mode}`, textOf(help!));
      }
    }
    // Nothing left in the other language.
    for (const [key, text] of said.es) expect(said.en.get(key), key).not.toBe(text);
    expect(said.es.size).toBeGreaterThan(90);
  });

  it('has nothing to tell of what is not a game', () => {
    expect(helpOf('edit', 'regions')).toBeNull();
  });

  it('quotes the buttons by what they say', () => {
    const code = sources();
    const literal = (label: string): boolean => [`'${label}'`, `"${label}"`, `\`${label}\``].some((form) => code.includes(form.toLowerCase()));
    for (const [lang, quoted] of [
      ['es', /«([^»]+)»/g],
      ['en', /“([^”]+)”/g],
    ] as const) {
      setLang(lang);
      const labels = new Set<string>();
      for (const [section, mode] of games()) for (const m of textOf(helpOf(mode, section)!).matchAll(quoted)) labels.add(m[1]);
      expect(labels.size, lang).toBeGreaterThan(25);
      const unknown = [...labels].filter((label) => !literal(label));
      expect(unknown, `${lang}: quoted, and said by no button`).toEqual([]);
    }
  });

  it('counts the tries as the games do', () => {
    const word: Record<number, string> = { 2: 'dos', 3: 'tres', 5: 'cinco', 6: 'seis' };
    const es = (mode: Mode, section: Section = 'regions') => textOf(helpOf(mode, section)!);
    expect(es('hotcold')).toContain(`${word[HOT_TRIES]} clics`);
    expect(es('regionle')).toContain(`${word[GUESSES]} intentos`);
    expect(es('learn')).toContain(`piezas nuevas, una a una: ${word[LESSON]}, o las que elijas`);
    expect(es('chain')).toContain(`al tercer fallo`);
    expect(CHAIN_MISSES).toBe(3);
    expect(es('whoami')).toContain(`vale ${word[RIDDLE_POINTS]} puntos`);
    expect(es('whoami')).toContain(`con ${word[CLUES_OK]} pistas o menos`);
    expect(es('wordsearch')).toContain('hasta diez en cada sopa');
    expect(WS_PER_BOARD).toBe(10);
    expect(es('crossword')).toContain('Hasta diez palabras en cada crucigrama');
    expect(CW_PER_BOARD).toBe(10);
  });

  it('says what a section adds to a game', () => {
    // A country can be asked for by its capital or by its flag; a region, by its name alone.
    expect(helpOf('pin', 'countries')!.steps[0]).toContain('una bandera');
    expect(helpOf('pin', 'regions')!.steps[0]).not.toContain('una bandera');
    // Without a map the figures are those of countries.
    expect(helpOf('hilo', 'pops')!.steps[0]).toContain('un país');
    expect(helpOf('hilo', 'regions')!.steps[0]).toContain('una pieza');
  });
});
