/**
 * The games of the section «Banderas» (lib/flagGames.ts): how a game is said in an address, the questions
 * of a game with the flags the site is built with, how a typed name is judged and what a game adds up to.
 */
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { groupAt, nearCards, type AlikeFile, type AlikeKind } from './flagAlike';
import {
  ALIKE_MIN,
  ALIKE_POOL_MIN,
  FLAG_GAMES,
  FLAG_LENGTHS,
  FLAG_OPTIONS,
  PAIR_SIZES,
  REVEAL,
  REVEAL_PIECES,
  REVEAL_START,
  alikeCount,
  alikePool,
  flagBestKey,
  flagGameDef,
  flagGameHelp,
  flagGamesPath,
  flagMatcher,
  flagPlayOf,
  flagPlayPath,
  flagPlayText,
  flagScore,
  judgeTyped,
  lengthOf,
  lengthsOf,
  pairCards,
  questionCount,
  revealPoints,
  revealRes,
  roundOf,
  type FlagAnswered,
  type FlagPlay,
} from './flagGames';
import { alikePlace, deckOf, flagSetText, sameMap, setMenu, twins, type DeckCard, type FlagSet, type SameFile } from './flagSets';
import type { FlagsFile } from './flags';
import { setLang } from './i18n';
import { FLAG_GAME_IDS, flagGameName, playedName } from './modes';
import { flagsScreen, routeOf } from './routes';
import { mergeSaved, useStore } from './store';
import { mulberry32 } from './text';
import type { FlagGame, Index } from './types';

const json = <T>(file: string): T => JSON.parse(fs.readFileSync(path.join(process.cwd(), file), 'utf8')) as T;
const FLAGS = json<FlagsFile>('public/data/flags.json');
const INDEX = json<Index>('public/data/index.json');
const SAME = sameMap(json<SameFile>('public/data/alike/same.json'));
const ALIKE = Object.fromEntries((['countries', 'regions', 'cities', 'others'] as const).map((kind) => [kind, json<AlikeFile>(`public/data/alike/${kind}.json`)])) as Record<AlikeKind, AlikeFile>;
const deck = (set: FlagSet) => deckOf(set, INDEX, FLAGS, SAME);
const nearOf = (set: FlagSet) => {
  const place = alikePlace(set);
  return nearCards(groupAt(ALIKE[place.file], place), deck(set));
};
const play = (game: FlagGame, set: FlagSet, more: Partial<FlagPlay> = {}): FlagPlay => ({ game, set, length: 10, answer: 'choice', ...more });
/** The games that ask the cards of a set, one after another, with nothing but those cards (and, «Casi iguales», what looks like each). */
const ASKED: readonly FlagGame[] = ['flag-whose', 'flag-pick', 'flag-alike', 'flag-reveal'];
const WORLD: FlagSet = { kind: 'countries' };
const EUROPE: FlagSet = { kind: 'countries', continent: 'EU' };
const SPAIN: FlagSet = { kind: 'regions', country: 'ES' };

afterEach(() => setLang('es'));

describe('the games of the flags', () => {
  it('are seven, each with its name, what it is and how hard, in both languages, the easy ones first', () => {
    expect(FLAG_GAMES).toEqual(['flag-whose', 'flag-pick', 'flag-pairs', 'flag-reveal', 'flag-odd', 'flag-alike', 'flag-past']);
    expect(FLAG_GAMES).toBe(FLAG_GAME_IDS);
    expect(FLAG_GAMES.map((id) => flagGameDef(id).name)).toEqual(['¿De dónde es?', '¿Cuál es su bandera?', 'Parejas', 'Poco a poco', 'El intruso', 'Casi iguales', 'Antes y ahora']);
    expect(FLAG_GAMES.map((id) => flagGameDef(id).level)).toEqual([1, 1, 1, 2, 2, 3, 3]);
    // The games whose answer is the name of the flag on screen can be typed.
    expect(FLAG_GAMES.filter((id) => flagGameDef(id).typed)).toEqual(['flag-whose', 'flag-reveal']);
    const es = FLAG_GAMES.map((id) => flagGameDef(id).desc);
    setLang('en');
    expect(FLAG_GAMES.map((id) => flagGameDef(id).name)).toEqual(['Whose flag?', 'Which flag?', 'Pairs', 'Bit by bit', 'Odd one out', 'Look-alikes', 'Then and now']);
    const en = FLAG_GAMES.map((id) => flagGameDef(id).desc);
    for (const text of [...es, ...en]) expect(text.length).toBeGreaterThan(30);
    expect(new Set([...es, ...en]).size).toBe(14);
    // Each with an icon of its own.
    expect(new Set(FLAG_GAMES.map((id) => flagGameDef(id).icon)).size).toBe(FLAG_GAMES.length);
  });

  it('are named where a game played is listed, like the modes of a map', () => {
    expect(flagGameName('flag-alike')).toBe('Casi iguales');
    expect(playedName('flags', 'flag-reveal')).toBe('Poco a poco');
    // A mode of a map keeps its own name, and a game this version does not know goes by nothing.
    expect(playedName('countries', 'flag')).toBe('Banderas');
    expect(playedName('flags', 'nada' as FlagGame)).toBe('');
    setLang('en');
    expect(playedName('flags', 'flag-whose')).toBe('Whose flag?');
  });

  it('say how they are played, each in its own words and in both languages', () => {
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      const texts = new Set<string>();
      for (const id of FLAG_GAMES) {
        const help = flagGameHelp(id);
        expect(help.steps.length, id).toBeGreaterThanOrEqual(3);
        expect(help.score, id).toBeTruthy();
        expect(help.tip, id).toBeTruthy();
        for (const step of help.steps) expect(step.length).toBeGreaterThan(20);
        texts.add(help.steps[0]);
      }
      expect(texts.size).toBe(FLAG_GAMES.length);
    }
    setLang('es');
    // What is typed is said only where it can be typed, and the points only where there are points.
    expect(flagGameHelp('flag-whose').aid).toContain('No lo sé');
    expect(flagGameHelp('flag-pick').aid).toBeUndefined();
    expect(flagGameHelp('flag-reveal').score).toContain(`${REVEAL_PIECES} si aciertas con una sola pieza quitada`);
    expect(flagGameHelp('flag-reveal').steps[0]).toContain(`${REVEAL_PIECES} piezas`);
    // The names are those the game says: «Rumania», as the list of countries has it.
    expect(flagGameHelp('flag-pick').tip).toContain('Chad y Rumania');
    expect(INDEX.countries.find((c) => c.id === 'RO')!.n.es).toBe('Rumania');
  });
});

describe('a game in an address', () => {
  it('is its word, its flags and how many, and how the name is given when it is typed', () => {
    expect(flagPlayText(play('flag-whose', SPAIN))).toBe('de-donde/regiones-ES/10');
    expect(flagPlayText(play('flag-pick', WORLD, { length: 20 }))).toBe('cual-es/paises/20');
    expect(flagPlayText(play('flag-alike', EUROPE, { length: 'all' }))).toBe('casi-iguales/paises-EU/todas');
    expect(flagPlayText(play('flag-reveal', { kind: 'capitals' }, { answer: 'type' }))).toBe('poco-a-poco/capitales/10/escrita');
    // A game that is not answered with a name has no way of typing it.
    expect(flagPlayText(play('flag-pick', WORLD, { answer: 'type' }))).toBe('cual-es/paises/10');
    expect(flagPlayPath(play('flag-whose', SPAIN))).toBe('banderas/jugar/de-donde/regiones-ES/10');
    expect(flagGamesPath()).toBe('banderas');
    expect(flagGamesPath(SPAIN)).toBe('banderas/juegos/regiones-ES');
    expect(flagBestKey(play('flag-whose', SPAIN, { answer: 'type' }))).toBe('flag:de-donde/regiones-ES/10/escrita');
    // The three that came later, each with its word; «Parejas» says how many pairs.
    expect(flagPlayText(play('flag-past', EUROPE, { length: 'all' }))).toBe('antes-y-ahora/paises-EU/todas');
    expect(flagPlayText(play('flag-odd', SPAIN, { length: 20 }))).toBe('el-intruso/regiones-ES/20');
    expect(flagPlayText(play('flag-pairs', WORLD, { length: 12 }))).toBe('parejas/paises/12');
    expect(flagBestKey(play('flag-pairs', WORLD, { length: 8 }))).toBe('flag:parejas/paises/8');
  });

  it('is as long as its game can be: ten, twenty or all the questions, or six to twelve pairs', () => {
    for (const game of FLAG_GAMES) {
      expect(lengthsOf(game), game).toEqual(game === 'flag-pairs' ? [6, 8, 10, 12] : [10, 20, 'all']);
      expect(lengthOf(game), game).toBe(game === 'flag-pairs' ? 8 : 10);
      expect(lengthsOf(game)).toContain(lengthOf(game));
    }
    expect(PAIR_SIZES).toEqual([6, 8, 10, 12]);
    // What an address says that its game has not is as nothing said.
    expect(flagPlayOf('parejas/paises')).toEqual(play('flag-pairs', WORLD, { length: 8 }));
    expect(flagPlayOf('parejas/paises/10')).toEqual(play('flag-pairs', WORLD, { length: 10 }));
    expect(flagPlayOf('parejas/paises/6')).toEqual(play('flag-pairs', WORLD, { length: 6 }));
    for (const count of ['20', 'todas', '7', '0', 'x']) expect(flagPlayOf(`parejas/paises/${count}`), count).toEqual(play('flag-pairs', WORLD, { length: 8 }));
    for (const count of ['8', '12', '6', '010', '1e1']) expect(flagPlayOf(`de-donde/paises/${count}`), count).toEqual(play('flag-whose', WORLD));
    // None of the three is answered by typing.
    expect(flagPlayOf('antes-y-ahora/paises/20/escrita')).toEqual(play('flag-past', WORLD, { length: 20 }));
  });

  it('reads back as the same game, whichever it is', () => {
    const sets: FlagSet[] = [WORLD, EUROPE, { kind: 'territories' }, SPAIN, { kind: 'regions', country: 'ES', level: 0 }, { kind: 'capitals' }, { kind: 'cities', country: 'JP' }, { kind: 'gone' }, { kind: 'organisations' }, { kind: 'peoples' }, { kind: 'signals' }];
    for (const game of FLAG_GAMES) {
      for (const set of sets) {
        for (const length of lengthsOf(game)) {
          for (const answer of flagGameDef(game).typed ? (['choice', 'type'] as const) : (['choice'] as const)) {
            const one = play(game, set, { length, answer });
            expect(flagPlayOf(flagPlayText(one)), flagPlayText(one)).toEqual(one);
          }
        }
      }
    }
  });

  it('opens as a game does when it leaves something unsaid, and is nothing when it names no game or no flags', () => {
    expect(flagPlayOf('de-donde/paises')).toEqual(play('flag-whose', WORLD));
    expect(flagPlayOf('De-Donde/Paises-eu/TODAS/Escrita')).toEqual(play('flag-whose', EUROPE, { length: 'all', answer: 'type' }));
    expect(flagPlayOf('de-donde/paises/50')).toEqual(play('flag-whose', WORLD));
    expect(flagPlayOf('cual-es/paises/20/escrita')).toEqual(play('flag-pick', WORLD, { length: 20 }));
    for (const text of ['', 'de-donde', 'de-donde/nada', 'nada/paises/10', 'de-donde/regiones/10', 'paises', 'jugar/de-donde/paises']) expect(flagPlayOf(text), text).toBeNull();
  });

  it('is told from the chooser and from the gallery by the first word after `banderas`', () => {
    expect(flagsScreen('')).toBe('games');
    expect(flagsScreen('juegos')).toBe('games');
    expect(flagsScreen('juegos/regiones-ES')).toBe('games');
    expect(flagsScreen('Games/paises')).toBe('games');
    expect(flagsScreen('jugar/de-donde/paises/10')).toBe('play');
    expect(flagsScreen('Play/de-donde/paises')).toBe('play');
    for (const rest of ['paises', 'regiones/ES', 'ciudades', 'historicas', 'otras', 'capitales', 'nada']) expect(flagsScreen(rest), rest).toBe('gallery');
    expect(routeOf('banderas/jugar/de-donde/paises/10')).toEqual({ kind: 'flags', rest: 'jugar/de-donde/paises/10' });
    expect(routeOf('banderas')).toEqual({ kind: 'flags', rest: '' });
  });
});

describe('«Poco a poco»', () => {
  it('covers a flag with twelve pieces and starts with one off', () => {
    expect(REVEAL).toEqual({ cols: 4, rows: 3 });
    expect(REVEAL_PIECES).toBe(12);
    expect(REVEAL_START).toBe(1);
  });

  it('is worth one more than the pieces still on: twelve at first, one with the whole flag in sight', () => {
    expect(Array.from({ length: REVEAL_PIECES }, (_, i) => revealPoints(i + 1))).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
    // Never more than at the start, never nothing.
    expect(revealPoints(0)).toBe(12);
    expect(revealPoints(40)).toBe(1);
  });

  it('counts as right first time with half the flag or less in sight, and as right with help with more', () => {
    expect([1, 3, 6].map(revealRes)).toEqual(['ok', 'ok', 'ok']);
    expect([7, 9, 12].map(revealRes)).toEqual(['warn', 'warn', 'warn']);
  });
});

describe('the questions of a game', () => {
  const world = deck(WORLD);

  it('are as many as asked for, each of another flag, with four answers and the right one among them', () => {
    for (const game of ASKED) {
      for (const [set, length] of [[WORLD, 10], [EUROPE, 20], [SPAIN, 10], [{ kind: 'capitals' }, 20], [{ kind: 'signals' }, 10]] as [FlagSet, 10 | 20][]) {
        const cards = deck(set);
        const round = roundOf(play(game, set, { length }), cards, mulberry32(7), nearOf(set));
        const where = `${game} ${flagSetText(set)}`;
        expect(round, where).toHaveLength(length);
        expect(new Set(round.map((q) => q.card.key)).size, where).toBe(length);
        for (const q of round) {
          expect(cards).toContain(q.card);
          expect(q.options, where).toHaveLength(FLAG_OPTIONS);
          expect(q.options.filter((o) => o.key === q.card.key), where).toHaveLength(1);
          // The right answer is the card itself.
          expect(q.right, where).toBe(q.card.key);
          expect(q.odd, where).toBeUndefined();
          expect(new Set(q.options.map((o) => o.key)).size, where).toBe(FLAG_OPTIONS);
          // The pieces of «Poco a poco» come off in an order of their own; the other games have none.
          if (game === 'flag-reveal') expect([...q.order].sort((a, b) => a - b)).toEqual(Array.from({ length: REVEAL_PIECES }, (_, i) => i));
          else expect(q.order).toEqual([]);
        }
      }
    }
    expect(FLAG_OPTIONS).toBe(4);
  });

  it('are the same for the same luck, and others for another', () => {
    const keys = (seed: number) => roundOf(play('flag-whose', WORLD), world, mulberry32(seed)).map((q) => `${q.card.key}:${q.options.map((o) => o.id).join('')}`);
    expect(keys(3)).toEqual(keys(3));
    expect(keys(3)).not.toEqual(keys(4));
    // The right answer is not always in the same place.
    const places = new Set(roundOf(play('flag-pick', WORLD, { length: 'all' }), world, mulberry32(1)).map((q) => q.options.findIndex((o) => o.key === q.card.key)));
    expect([...places].sort()).toEqual([0, 1, 2, 3]);
  });

  it('are one for each flag with «Todas», and none has answers to choose when the name is typed', () => {
    const all = roundOf(play('flag-whose', EUROPE, { length: 'all' }), deck(EUROPE), mulberry32(2));
    expect(all.map((q) => q.card.id).sort()).toEqual(deck(EUROPE).map((c) => c.id).sort());
    const typed = roundOf(play('flag-reveal', EUROPE, { answer: 'type' }), deck(EUROPE), mulberry32(2));
    expect(typed).toHaveLength(10);
    for (const q of typed) {
      expect(q.options).toEqual([]);
      expect(q.order).toHaveLength(REVEAL_PIECES);
    }
    // A game that cannot be typed has its four flags whatever the address says.
    expect(roundOf(play('flag-pick', EUROPE, { answer: 'type' }), deck(EUROPE), mulberry32(2))[0].options).toHaveLength(4);
    // A set smaller than the game: as many questions as flags.
    const few = deck({ kind: 'regions', country: 'AE' });
    expect(few.length).toBeLessThan(10);
    expect(roundOf(play('flag-whose', { kind: 'regions', country: 'AE' }), few, mulberry32(2))).toHaveLength(few.length);
  });

  it('never set side by side two flags that are the same picture or go by the same name', () => {
    // Chad and Romania, Indonesia and Monaco; the emirates of Ajman and Dubai; the city of Kiev and its province.
    const sets: FlagSet[] = [WORLD, EUROPE, { kind: 'regions', country: 'AE' }, { kind: 'regions', country: 'UA' }, { kind: 'regions', country: 'CO' }, { kind: 'cities', country: 'CO' }, { kind: 'gone' }, SPAIN];
    let questions = 0;
    for (const set of sets) {
      const cards = deck(set);
      const near = nearOf(set);
      for (const game of ASKED) {
        for (let seed = 1; seed <= 12; seed++) {
          for (const q of roundOf(play(game, set, { length: 'all' }), cards, mulberry32(seed), near)) {
            questions++;
            for (let i = 0; i < q.options.length; i++) for (let j = i + 1; j < q.options.length; j++) expect(twins(q.options[i], q.options[j]), `${game} ${flagSetText(set)}: ${q.options[i].name} / ${q.options[j].name}`).toBe(false);
          }
        }
      }
    }
    expect(questions).toBeGreaterThan(10000);
    // Both of a pair are asked all the same: each is a flag of the set.
    const asked = roundOf(play('flag-whose', WORLD, { length: 'all' }), world, mulberry32(1)).map((q) => q.card.id);
    expect(asked).toEqual(expect.arrayContaining(['TD', 'RO', 'ID', 'MC']));
  });

  it('are only of the flags that were missed when a game goes over them, with answers from the whole set', () => {
    const only = new Set(['country:ES', 'country:PT', 'country:AD']);
    const round = roundOf(play('flag-whose', EUROPE), deck(EUROPE), mulberry32(5), new Map(), only);
    expect(round.map((q) => q.card.key).sort()).toEqual([...only].sort());
    for (const q of round) expect(q.options).toHaveLength(4);
    expect(round.some((q) => q.options.some((o) => !only.has(o.key)))).toBe(true);
    // More misses than the game is long: all of them.
    const many = new Set(deck(EUROPE).slice(0, 15).map((c) => c.key));
    expect(roundOf(play('flag-whose', EUROPE), deck(EUROPE), mulberry32(5), new Map(), many)).toHaveLength(15);
    // In «Casi iguales» a flag gone over is still set beside those most like it.
    const alike = roundOf(play('flag-alike', WORLD), world, mulberry32(5), nearOf(WORLD), new Set(['country:RO']));
    expect(alike).toHaveLength(1);
    expect(alike[0].options.map((o) => o.id).sort()).toEqual(['AD', 'BE', 'MD', 'RO']);
  });
});

describe('«Casi iguales»', () => {
  const world = deck(WORLD);
  const near = nearOf(WORLD);

  it('asks the flags that have three like them, the most alike first', () => {
    const pool = alikePool(world, near);
    expect(pool.cards).toHaveLength(world.length);
    expect(pool.close).toBeGreaterThan(50);
    expect(pool.close).toBeLessThan(100);
    // The first ones are the pairs everybody mixes up.
    expect(pool.cards.slice(0, 30).map((c) => c.id)).toEqual(expect.arrayContaining(['ID', 'MC', 'PL', 'IE', 'CI']));
    // A flag with nothing like it is not asked: with no neighbours known, none is.
    expect(alikePool(world, new Map())).toEqual({ cards: [], close: 0 });
  });

  it('sets beside each flag the three most like it', () => {
    for (let seed = 1; seed <= 5; seed++) {
      const round = roundOf(play('flag-alike', WORLD, { length: 'all' }), world, mulberry32(seed), near);
      expect(round).toHaveLength(alikePool(world, near).close);
      const romania = round.find((q) => q.card.id === 'RO');
      if (romania) expect(romania.options.map((o) => o.id).sort()).toEqual(['AD', 'BE', 'MD', 'RO']);
      const ireland = round.find((q) => q.card.id === 'IE');
      if (ireland) expect(ireland.options.map((o) => o.id)).toEqual(expect.arrayContaining(['CI', 'IT']));
    }
  });

  it('chooses its questions among the truly alike, or among the nearest score where those are fewer', () => {
    const card = (i: number): DeckCard => ({ key: `k${i}`, kind: 'region', id: `k${i}`, country: 'XX', name: `k${i}`, src: '', small: '', ratio: 1.5, look: `k${i}`, said: `k${i}`, answers: [] });
    const pool = (n: number, close: number) => ({ cards: Array.from({ length: n }, (_, i) => card(i)), close });
    expect(alikeCount(pool(198, 70))).toBe(70);
    expect(alikeCount(pool(46, 10))).toBe(ALIKE_POOL_MIN);
    expect(alikeCount(pool(13, 0))).toBe(13);
    // Too few for a game: none.
    expect(alikeCount(pool(ALIKE_MIN, 0))).toBe(ALIKE_MIN);
    expect(alikeCount(pool(ALIKE_MIN - 1, 2))).toBe(0);
    expect(alikeCount(pool(0, 0))).toBe(0);
    // «Todas» is never fewer than a game of twenty.
    expect(ALIKE_POOL_MIN).toBe(Math.max(...FLAG_LENGTHS.filter((l): l is 10 | 20 => l !== 'all')));
  });

  it('says how many questions each game will have with the flags of each set', () => {
    expect(questionCount(play('flag-whose', WORLD), world)).toBe(10);
    expect(questionCount(play('flag-whose', WORLD, { length: 20 }), world)).toBe(20);
    expect(questionCount(play('flag-whose', WORLD, { length: 'all' }), world)).toBe(world.length);
    expect(questionCount(play('flag-pick', { kind: 'regions', country: 'AE' }, { length: 20 }), deck({ kind: 'regions', country: 'AE' }))).toBe(deck({ kind: 'regions', country: 'AE' }).length);
    expect(questionCount(play('flag-alike', WORLD, { length: 'all' }), world, near)).toBe(alikePool(world, near).close);
    expect(questionCount(play('flag-alike', WORLD), world, near)).toBe(10);
    // Without the look-alikes there is nothing to ask.
    expect(questionCount(play('flag-alike', WORLD), world)).toBe(0);
    // «Todas» is the longest game of each set, and what is said is what is asked.
    const menu = setMenu(INDEX, FLAGS, SAME);
    const sets = [...menu.countries, menu.territories, ...menu.regions, ...menu.regions.flatMap((c) => c.levels), menu.capitals, ...menu.cities, menu.gone, menu.organisations, menu.peoples, menu.signals].filter((c) => !!c).map((c) => c!.set);
    let none = 0;
    for (const set of sets) {
      const cards = deck(set);
      const around = nearOf(set);
      const counts = FLAG_LENGTHS.map((length) => questionCount(play('flag-alike', set, { length }), cards, around));
      expect(counts[0], flagSetText(set)).toBeLessThanOrEqual(counts[1]);
      expect(counts[1], flagSetText(set)).toBeLessThanOrEqual(counts[2]);
      if (counts[2] === 0) none++;
      else expect(counts[2], flagSetText(set)).toBeGreaterThanOrEqual(ALIKE_MIN);
      FLAG_LENGTHS.forEach((length, i) => expect(roundOf(play('flag-alike', set, { length }), cards, mulberry32(1), around), flagSetText(set)).toHaveLength(counts[i]));
    }
    // Some sets have no flags alike enough: the game is not offered with them. Most have.
    expect(none).toBeGreaterThan(0);
    expect(none).toBeLessThan(sets.length / 4);
    // The ones most played have a whole game.
    for (const set of [WORLD, EUROPE, { kind: 'countries', continent: 'AF' }, { kind: 'territories' }, SPAIN, { kind: 'regions', country: 'ES', level: 1 }, { kind: 'capitals' }, { kind: 'gone' }] as FlagSet[]) {
      expect(questionCount(play('flag-alike', set), deck(set), nearOf(set)), flagSetText(set)).toBe(10);
    }
  });
});

describe('«Parejas»', () => {
  it('deals so many flags of the set, by lot, no two of them the same picture or of the same name', () => {
    const world = deck(WORLD);
    for (const pairs of PAIR_SIZES) {
      const dealt = pairCards(world, pairs, mulberry32(pairs));
      expect(dealt).toHaveLength(pairs);
      expect(new Set(dealt.map((c) => c.key)).size).toBe(pairs);
      for (const card of dealt) expect(world).toContain(card);
    }
    // Another table for another luck, the same for the same.
    const keys = (seed: number) => pairCards(world, 8, mulberry32(seed)).map((c) => c.id);
    expect(keys(1)).toEqual(keys(1));
    expect(keys(1)).not.toEqual(keys(2));
    // Chad and Romania, Indonesia and Monaco; Ajman and Dubai; the two Kievs: never both on a table.
    for (const set of [WORLD, EUROPE, { kind: 'regions', country: 'AE' }, { kind: 'regions', country: 'UA' }, { kind: 'regions', country: 'CO' }, { kind: 'gone' }] as FlagSet[]) {
      const cards = deck(set);
      for (let seed = 1; seed <= 40; seed++) {
        const dealt = pairCards(cards, 12, mulberry32(seed));
        for (let i = 0; i < dealt.length; i++) for (let j = i + 1; j < dealt.length; j++) expect(twins(dealt[i], dealt[j]), `${flagSetText(set)}: ${dealt[i].name} / ${dealt[j].name}`).toBe(false);
      }
    }
  });

  it('has as many pairs as asked for where the set has them, and is no game with fewer than three', () => {
    const world = deck(WORLD);
    for (const pairs of PAIR_SIZES) expect(questionCount(play('flag-pairs', WORLD, { length: pairs }), world)).toBe(pairs);
    // Six emirates that are four pictures: four pairs, however many are asked for.
    const emirates: FlagSet = { kind: 'regions', country: 'AE' };
    for (const pairs of PAIR_SIZES) {
      expect(questionCount(play('flag-pairs', emirates, { length: pairs }), deck(emirates))).toBe(4);
      expect(pairCards(deck(emirates), pairs, mulberry32(pairs))).toHaveLength(4);
    }
    expect(questionCount(play('flag-pairs', emirates, { length: 8 }), deck(emirates).slice(0, 2))).toBe(0);
    // Every set there is to choose has a table.
    const menu = setMenu(INDEX, FLAGS, SAME);
    const sets = [...menu.countries, menu.territories, ...menu.regions, ...menu.regions.flatMap((c) => c.levels), menu.capitals, ...menu.cities, menu.gone, menu.organisations, menu.peoples, menu.signals].filter((c) => !!c).map((c) => c!.set);
    for (const set of sets) {
      const cards = deck(set);
      const said = questionCount(play('flag-pairs', set, { length: 12 }), cards);
      expect(said, flagSetText(set)).toBeGreaterThanOrEqual(3);
      expect(said, flagSetText(set)).toBeLessThanOrEqual(12);
      // What is dealt is never more than what is said; fewer only where names and pictures are tangled.
      expect(pairCards(cards, 12, mulberry32(3)).length, flagSetText(set)).toBeLessThanOrEqual(said);
      expect(pairCards(cards, 12, mulberry32(3)).length, flagSetText(set)).toBeGreaterThanOrEqual(Math.min(3, said));
    }
    // It has no questions: its cards are dealt, not asked.
    expect(roundOf(play('flag-pairs', WORLD, { length: 8 }), world, mulberry32(1))).toEqual([]);
  });
});

describe('a name that is typed', () => {
  const world = deck(WORLD);
  const matcher = flagMatcher(world);
  const by = (id: string) => world.find((c) => c.id === id)!;
  const judge = (id: string, text: string) => judgeTyped(matcher, world, by(id), text);

  it('is right in either language, whatever its capitals and its accents, and by the other names of a country', () => {
    for (const text of ['España', 'espana', 'ESPAÑA', 'Spain', '  spain ']) expect(judge('ES', text), text).toEqual({ res: 'right' });
    expect(judge('US', 'Estados Unidos')).toEqual({ res: 'right' });
    expect(judge('US', 'United States')).toEqual({ res: 'right' });
    expect(judge('GB', 'Reino Unido')).toEqual({ res: 'right' });
    expect(judge('CI', 'Costa de Marfil')).toEqual({ res: 'right' });
    // A slip of a letter is forgiven, as everywhere in the game.
    expect(judge('PT', 'Portugl')).toEqual({ res: 'right' });
  });

  it('is wrong when it is the name of another flag of the set, which is then shown', () => {
    expect(judge('ES', 'Portugal')).toEqual({ res: 'wrong', given: by('PT') });
    expect(judge('IE', 'Italia')).toEqual({ res: 'wrong', given: by('IT') });
  });

  it('is right when it is the name of a flag that is the same picture', () => {
    expect(judge('TD', 'Rumania')).toEqual({ res: 'right' });
    expect(judge('RO', 'Chad')).toEqual({ res: 'right' });
    expect(judge('MC', 'Indonesia')).toEqual({ res: 'right' });
    // Ajman and Dubai fly the same flag.
    const emirates = deck({ kind: 'regions', country: 'AE' });
    const [ajman, dubai] = [emirates.find((c) => c.id === 'AE-AJ')!, emirates.find((c) => c.id === 'AE-DU')!];
    expect(judgeTyped(flagMatcher(emirates), emirates, ajman, dubai.name)).toEqual({ res: 'right' });
    expect(judgeTyped(flagMatcher(emirates), emirates, ajman, ajman.name)).toEqual({ res: 'right' });
  });

  it('is no answer yet when no flag of the set goes by it: the player may have slipped', () => {
    for (const text of ['xyzzy', 'Atlántida', '1234']) expect(judge('ES', text), text).toEqual({ res: 'unknown' });
    // The code of a country is not its name here: «ES» says nothing.
    expect(judge('ES', 'ES')).toEqual({ res: 'unknown' });
    // A flag that is not of the set is not known to it: Japan among those of Europe.
    const europe = deck(EUROPE);
    expect(judgeTyped(flagMatcher(europe), europe, europe.find((c) => c.id === 'ES')!, 'Japón')).toEqual({ res: 'unknown' });
  });

  it('takes the name of a region, and both names of one that is on two levels of its map', () => {
    const spain = deck(SPAIN);
    const m = flagMatcher(spain);
    const andalusia = spain.find((c) => c.id === 'ES-AN')!;
    expect(judgeTyped(m, spain, andalusia, 'andalucia')).toEqual({ res: 'right' });
    expect(judgeTyped(m, spain, andalusia, 'Andalusia')).toEqual({ res: 'right' });
    expect(judgeTyped(m, spain, andalusia, 'Aragón')).toEqual({ res: 'wrong', given: spain.find((c) => c.id === 'ES-AR') });
    const belgium = deck({ kind: 'regions', country: 'BE' });
    const brussels = belgium.find((c) => c.id === 'BE-BRU')!;
    for (const text of ['Bruselas', 'Brussels', 'Bruselas-Capital']) expect(judgeTyped(flagMatcher(belgium), belgium, brussels, text), text).toEqual({ res: 'right' });
  });
});

describe('what a game adds up to', () => {
  const card = deck(EUROPE)[0];
  const said = (res: 'ok' | 'warn' | 'bad', points = 0): FlagAnswered => ({ card, res, points });

  it('is the share of right answers', () => {
    expect(flagScore('flag-whose', [said('ok'), said('ok'), said('bad'), said('ok')])).toEqual({ ok: 3, warn: 0, bad: 1, total: 4, points: 3, max: 4, pct: 75 });
    expect(flagScore('flag-alike', [said('bad'), said('bad')])).toMatchObject({ ok: 0, bad: 2, pct: 0 });
    expect(flagScore('flag-pick', [said('ok')])).toMatchObject({ pct: 100 });
    // A game with no answers has no mark, and is no error.
    expect(flagScore('flag-whose', [])).toEqual({ ok: 0, warn: 0, bad: 0, total: 0, points: 0, max: 0, pct: 0 });
  });

  it('is the share of the points there were to get in «Poco a poco»', () => {
    // Twelve for each flag: named at once, named with nine pieces off, and missed.
    const score = flagScore('flag-reveal', [said('ok', 12), said('warn', 4), said('bad', 0)]);
    expect(score).toEqual({ ok: 1, warn: 1, bad: 1, total: 3, points: 16, max: 36, pct: 44 });
    expect(flagScore('flag-reveal', [said('ok', 12), said('ok', 12)])).toMatchObject({ pct: 100 });
    // Every flag uncovered whole and named: all right with help, and a twelfth of the points.
    expect(flagScore('flag-reveal', [said('warn', 1), said('warn', 1)])).toMatchObject({ warn: 2, bad: 0, points: 2, max: 24, pct: 8 });
  });
});

describe('what is kept of the games of the flags', () => {
  afterEach(() => {
    useStore.getState().resetProgress();
    useStore.getState().setFlagLast('');
  });

  it('is the game that was last chosen, which is what the section opens with', () => {
    const s = useStore.getState();
    expect(s.flagLast).toBe('');
    s.setFlagLast('casi-iguales/paises-EU/20');
    expect(useStore.getState().flagLast).toBe('casi-iguales/paises-EU/20');
    expect(flagPlayOf(useStore.getState().flagLast)).toEqual(play('flag-alike', EUROPE, { length: 20 }));
    // Whatever is written there is no longer than an address can be.
    s.setFlagLast('x'.repeat(500));
    expect(useStore.getState().flagLast).toHaveLength(80);
    for (const game of FLAG_GAMES) expect(flagPlayText(play(game, { kind: 'regions', country: 'ES', level: 1 }, { length: 'all', answer: 'type' })).length).toBeLessThan(80);
  });

  it('is read from what the browser keeps, and is nothing when what is there is not a text', () => {
    const now = useStore.getState();
    expect(mergeSaved({}, now).flagLast).toBe('');
    expect(mergeSaved({ flagLast: 'de-donde/paises/10' }, now).flagLast).toBe('de-donde/paises/10');
    expect(mergeSaved({ flagLast: 7 } as never, now).flagLast).toBe('');
    expect(mergeSaved({ flagLast: 'y'.repeat(200) }, now).flagLast).toHaveLength(80);
    // A game that no longer exists opens the section as if nothing had been chosen.
    expect(flagPlayOf(mergeSaved({ flagLast: 'otro-juego/paises/10' }, now).flagLast)).toBeNull();
  });

  it('is each game played, which counts in the tallies and in the calendar like any other', () => {
    const s = useStore.getState();
    s.addSession({ t: Date.now(), section: 'flags', mode: 'flag-reveal', label: 'Países de Europa', total: 10, ok: 6, warn: 2, bad: 2, ms: 90_000 });
    const after = useStore.getState();
    expect(after.sessions[0]).toMatchObject({ section: 'flags', mode: 'flag-reveal', label: 'Países de Europa', total: 10 });
    expect(playedName(after.sessions[0].section, after.sessions[0].mode)).toBe('Poco a poco');
    expect(after.tot).toMatchObject({ g: 1, q: 10, ok: 6, warn: 2, ms: 90_000 });
    expect(Object.values(after.days)[0].slice(0, 3)).toEqual([1, 10, 6]);
    // It is no game of a map: nothing is added to the maps played lately.
    expect(after.recent).toEqual([]);
    // Its mark is kept under the game, the flags and the settings.
    expect(after.setBest(flagBestKey(play('flag-reveal', EUROPE)), 62)).toBe(true);
    expect(useStore.getState().setBest(flagBestKey(play('flag-reveal', EUROPE)), 40)).toBe(false);
    expect(useStore.getState().best['flag:poco-a-poco/paises-EU/10']).toBe(62);
    expect(useStore.getState().best[flagBestKey(play('flag-reveal', EUROPE, { answer: 'type' }))]).toBeUndefined();
  });
});
