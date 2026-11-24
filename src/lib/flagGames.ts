/**
 * The games of the section «Banderas»: what each is, how a game is said in an address, the questions of a
 * game and how they count. They are played with the flags of a set (lib/flagSets.ts) and nothing else:
 * there is no map, so they are no modes of a section with one.
 *
 *   ¿De dónde es?         a flag, and its name among four or typed
 *   ¿Cuál es su bandera?  a name, and its flag among four
 *   Parejas               cards face down, a flag and a name for each: turned two at a time (lib/pairs.ts)
 *   Poco a poco           a flag uncovered piece by piece: the sooner it is named, the more it is worth
 *   El intruso            four flags, three of a group and one from outside it (lib/flagOdd.ts)
 *   Escalada              a flag and its name among two, then three… up to eight: three misses end the climb
 *   Casi iguales          a name, and its flag among the three that look most like it
 *   Antes y ahora         a flag that a country flew before, and the country among four (lib/flagPast.ts)
 *   ¿De qué país es?      the flag of a region, and its country among four (lib/flagLand.ts)
 *
 * The texts are long: nothing that comes with the first page may import this file (lib/modes.ts has the
 * names, which the first page says).
 */
import { Copy, EqualApproximately, Flag, Grid2x2X, Grid3x3, History, LayoutGrid, MapPinned, TrendingUp, type LucideIcon } from 'lucide-react';
import { ALIKE_CLOSE, ALIKE_OTHERS, closeness, rivalsOf, type Near } from './flagAlike';
import { LAND_MIN, landAsked, landOptions, type LandFile } from './flagLand';
import { oddCount, oddRound, type OddPool } from './flagOdd';
import { PAST_MIN, pastAsked, pastOptions, type PastFile } from './flagPast';
import { apart, beside, flagSetOf, flagSetText, type DeckCard, type FlagSet } from './flagSets';
import type { ModeHelp } from './help';
import { L } from './i18n';
import { Matcher } from './matcher';
import { FLAG_GAME_IDS, flagGameName } from './modes';
import { FLAGS_PATH, FLAG_GAMES_PATH, FLAG_PLAY_PATH } from './routes';
import { PAIRS_MIN, PAIR_SIZES, PAIR_SIZE_DEFAULT, type PairSize } from './rules';
import { shuffle, type Rng } from './text';
import type { FlagGame, Index, Res } from './types';

export const FLAG_GAMES = FLAG_GAME_IDS;

export interface FlagGameDef {
  id: FlagGame;
  name: string;
  /** What it is, in a sentence. */
  desc: string;
  icon: LucideIcon;
  /** 1 easy … 3 hard. */
  level: 1 | 2 | 3;
  /** Its answer is a name, which can be typed instead of chosen. */
  typed: boolean;
}

/** Those that have a namesake among the games of the countries («Parejas», «El intruso») wear its icon. */
const ICON: Record<FlagGame, LucideIcon> = {
  'flag-whose': Flag,
  'flag-pick': LayoutGrid,
  'flag-pairs': Copy,
  'flag-reveal': Grid3x3,
  'flag-odd': Grid2x2X,
  'flag-climb': TrendingUp,
  'flag-alike': EqualApproximately,
  'flag-past': History,
  'flag-land': MapPinned,
};
const LEVEL: Record<FlagGame, 1 | 2 | 3> = { 'flag-whose': 1, 'flag-pick': 1, 'flag-pairs': 1, 'flag-reveal': 2, 'flag-odd': 2, 'flag-climb': 2, 'flag-alike': 3, 'flag-past': 3, 'flag-land': 3 };
/** The games whose answer is a name. */
const TYPED: readonly FlagGame[] = ['flag-whose', 'flag-reveal'];

function descOf(game: FlagGame): string {
  switch (game) {
    case 'flag-whose':
      return L('Sale una bandera y dices de dónde es: eliges entre cuatro nombres o lo escribes.', 'A flag comes up and you say whose it is: choose among four names, or type it.');
    case 'flag-pick':
      return L('Sale un nombre y eliges su bandera entre cuatro.', 'A name comes up and you choose its flag among four.');
    case 'flag-alike':
      return L('Sale un nombre y cuatro banderas que se parecen entre sí: solo una es la suya.', 'A name comes up with four flags that look alike: only one is its own.');
    case 'flag-pairs':
      return L('Cartas boca abajo: levantas una bandera y un nombre, y juntas cada bandera con el suyo.', 'Cards face down: you turn over a flag and a name, and put each flag with its own.');
    case 'flag-odd':
      return L('Cuatro banderas: tres son del grupo que se dice y una no. Encuentra la intrusa.', 'Four flags: three are of the group that is named and one is not. Find the odd one out.');
    case 'flag-past':
      return L('Sale una bandera que un país tuvo antes, con sus años, y eliges qué país la tuvo.', 'A flag that a country flew before comes up, with its years, and you choose which country flew it.');
    case 'flag-climb':
      return L('Empiezas eligiendo entre dos nombres y cada tres aciertos hay uno más. Tres fallos y se acaba: ¿hasta dónde subes?', 'You begin by choosing between two names, and every three right answers there is one more. Three misses end it: how high can you climb?');
    case 'flag-land':
      return L('Sale la bandera de una región, sin su nombre, y eliges de qué país es.', 'The flag of a region comes up, without its name, and you choose which country it is of.');
    default:
      return L('La bandera se destapa pieza a pieza: cuanto antes digas de dónde es, más puntos.', 'The flag is uncovered piece by piece: the sooner you say whose it is, the more points.');
  }
}

export const flagGameDef = (id: FlagGame): FlagGameDef => ({ id, name: flagGameName(id), desc: descOf(id), icon: ICON[id], level: LEVEL[id], typed: TYPED.includes(id) });

/** How many questions a game has: ten, twenty or one for each flag of the set. */
export type FlagLength = 10 | 20 | 'all';
export const FLAG_LENGTHS: readonly FlagLength[] = [10, 20, 'all'];
/** «Parejas» has no questions: what is chosen is how many pairs are dealt (lib/rules.ts, as in the «Parejas» of the countries). */
export { PAIR_SIZES, type PairSize };
/** How long a game of each kind can be, and how long it is when nothing says. */
/** «Escalada» is as long as it lasts: it has every flag of the set to ask, and nothing to choose. */
const CLIMB_LENGTHS: readonly FlagLength[] = ['all'];
export const lengthsOf = (game: FlagGame): readonly (FlagLength | PairSize)[] => (game === 'flag-pairs' ? PAIR_SIZES : game === 'flag-climb' ? CLIMB_LENGTHS : FLAG_LENGTHS);
export const lengthOf = (game: FlagGame): FlagLength | PairSize => (game === 'flag-pairs' ? PAIR_SIZE_DEFAULT : game === 'flag-climb' ? 'all' : 10);
/** How a name is given: chosen among four, or typed. */
export type FlagAnswer = 'choice' | 'type';

/** A game as it is started: which one, with which flags and how. */
export interface FlagPlay {
  game: FlagGame;
  set: FlagSet;
  /** How many questions or, in «Parejas», how many pairs: one of `lengthsOf` the game. */
  length: FlagLength | PairSize;
  answer: FlagAnswer;
}

/** The word each game goes by in an address: the same in every language, so that links keep working. */
const GAME_WORD: Record<FlagGame, string> = {
  'flag-whose': 'de-donde',
  'flag-pick': 'cual-es',
  'flag-pairs': 'parejas',
  'flag-reveal': 'poco-a-poco',
  'flag-odd': 'el-intruso',
  'flag-climb': 'escalada',
  'flag-alike': 'casi-iguales',
  'flag-past': 'antes-y-ahora',
  'flag-land': 'de-que-pais',
};
const WORD_GAME = Object.fromEntries(Object.entries(GAME_WORD).map(([game, word]) => [word, game])) as Record<string, FlagGame>;
const ALL_WORD = 'todas';
const TYPE_WORD = 'escrita';

/** A game as an address says it after `banderas/jugar/`: `de-donde/regiones-ES/10`, `poco-a-poco/paises-EU/todas/escrita`, `escalada/paises` (which has no length to say). */
export function flagPlayText(play: FlagPlay): string {
  const parts = [GAME_WORD[play.game], flagSetText(play.set)];
  if (lengthsOf(play.game).length > 1) parts.push(play.length === 'all' ? ALL_WORD : String(play.length));
  if (play.answer === 'type' && TYPED.includes(play.game)) parts.push(TYPE_WORD);
  return parts.join('/');
}

/**
 * The game that such a text says; null when it names no game or no flags. What it leaves unsaid, or says
 * wrong, is as a game opens: ten questions (or eight pairs), chosen among four.
 */
export function flagPlayOf(text: string): FlagPlay | null {
  const [word = '', flags = '', count = '', how = ''] = text.split('/');
  const game = WORD_GAME[word.toLowerCase()];
  const set = flagSetOf(flags);
  if (!game || !set) return null;
  const said = count.toLowerCase() === ALL_WORD ? 'all' : /^\d+$/.test(count) ? Number(count) : 0;
  const length = lengthsOf(game).find((one) => one === said) ?? lengthOf(game);
  return { game, set, length, answer: how.toLowerCase() === TYPE_WORD && TYPED.includes(game) ? 'type' : 'choice' };
}

/** The address of a game, as `go` takes it. */
export const flagPlayPath = (play: FlagPlay): string => `${FLAGS_PATH}/${FLAG_PLAY_PATH}/${flagPlayText(play)}`;
/** The address of the screen where the games are chosen, with some flags already chosen there. */
export const flagGamesPath = (set?: FlagSet): string => (set ? `${FLAGS_PATH}/${FLAG_GAMES_PATH}/${flagSetText(set)}` : FLAGS_PATH);

/** Where the best mark of a game is kept (store `best`): each game with each set, each length and each way of answering has its own. */
export const flagBestKey = (play: FlagPlay): string => `flag:${flagPlayText(play)}`;

/** «Poco a poco»: the pieces that cover a flag, so many across and down. */
export const REVEAL = { cols: 4, rows: 3 };
export const REVEAL_PIECES = REVEAL.cols * REVEAL.rows;
/** …and how many are off when the question comes up. */
export const REVEAL_START = 1;
/** What a flag is worth when it is named with so many pieces off: one more than the pieces still on. */
export const revealPoints = (shown: number): number => Math.max(1, REVEAL_PIECES - Math.max(REVEAL_START, shown) + 1);
/** Named with half the flag or less in sight, it is right first time; with more, right with help. */
export const revealRes = (shown: number): Res => (shown <= REVEAL_PIECES / 2 ? 'ok' : 'warn');

/** One question of a game. */
export interface FlagQuestion {
  /** The flag it is about: the one that is asked or, in «El intruso», the one from outside. */
  card: DeckCard;
  /** What there is to choose from, the right one among them, in the order it is shown; nothing when the answer is typed. */
  options: DeckCard[];
  /** The key of the option that is right: the card itself or, in «Antes y ahora», the country that flew it. */
  right: string;
  /** «Poco a poco»: the order its pieces come off in. */
  order: number[];
  /** «El intruso»: what the other three are of, and what the one from outside is of. */
  odd?: { group: string; tag: string };
  /** «Escalada»: the keys of the options that are not the right one, the first to be shown first: how many of them are depends on how high the game is (`climbShown`). */
  rivals?: string[];
}

/** What a game needs besides the cards of its set, each game its own. */
export interface FlagExtra {
  /** «Antes y ahora»: the flags of other times of the countries of the set (lib/flagPast.ts, `pastCards`), what is written of them and the group of the set there. */
  past?: { cards: ReadonlyMap<string, readonly DeckCard[]>; data: PastFile | null; place: string };
  /** «El intruso»: the groups of the set and the flags from outside (lib/flagOdd.ts, `oddPool`). */
  odd?: Pick<OddPool, 'groups'> & Partial<OddPool>;
  /** «¿De qué país es?»: the flags of the regions of the countries of the set (lib/flagLand.ts, `landCards`), what is written of them and the continent of each country. */
  land?: { cards: ReadonlyMap<string, readonly DeckCard[]>; data: LandFile | null; where: ReadonlyMap<string, string> };
  /** «Escalada»: how well known each flag is, by the key of its card, where that is known: the better known come first. */
  climb?: { known: ReadonlyMap<string, number> };
}

/** How many answers a question offers. */
export const FLAG_OPTIONS = ALIKE_OTHERS + 1;
/** «Casi iguales» asks at least so many flags where the set has them, however few are truly alike: as many as its longest game of a fixed length. */
export const ALIKE_POOL_MIN = 20;
/** …and is no game with fewer than these to ask. */
export const ALIKE_MIN = 4;

/**
 * The flags «Casi iguales» asks about: those with enough flags that look like them, the most alike first.
 * `close` says how many of them are mixed up at a glance; the rest are only the nearest there is.
 */
export function alikePool(deck: readonly DeckCard[], near: ReadonlyMap<string, readonly Near[]>): { cards: DeckCard[]; close: number } {
  const ranked = deck
    .map((card, i) => ({ card, i, how: closeness(rivalsOf(card, near.get(card.key) ?? [])) }))
    .filter((r) => Number.isFinite(r.how))
    .sort((a, b) => a.how - b.how || a.i - b.i);
  return { cards: ranked.map((r) => r.card), close: ranked.filter((r) => r.how <= ALIKE_CLOSE).length };
}

/**
 * How many flags a game of «Casi iguales» chooses its questions among: the truly alike, or the nearest
 * score of them where they are fewer. None when there are too few for a game.
 */
export function alikeCount(pool: { cards: readonly DeckCard[]; close: number }): number {
  const n = Math.min(pool.cards.length, Math.max(pool.close, ALIKE_POOL_MIN));
  return n < ALIKE_MIN ? 0 : n;
}

/** «Escalada»: the misses that end a climb. */
export const CLIMB_LIVES = 3;
/** …the names a flag comes with at the foot, how many right answers add another, and the most there ever are. */
export const CLIMB_FIRST = 2;
export const CLIMB_STEP = 3;
export const CLIMB_MOST = 8;
/** …and the question from which the names set beside the right one are those of the flags most like it (the tenth), where it is known which they are. */
export const CLIMB_ALIKE_FROM = 9;

/** How many names a flag comes with when so many have been got right. */
export const climbChoices = (height: number): number => Math.min(CLIMB_MOST, CLIMB_FIRST + Math.floor(Math.max(0, height) / CLIMB_STEP));

/** What a question of «Escalada» offers at a height: the right one and the first of its rivals, in the order the question has them. */
export function climbShown(q: FlagQuestion, height: number): DeckCard[] {
  const keep = new Set((q.rivals ?? []).slice(0, climbChoices(height) - 1));
  return q.options.filter((option) => option.key === q.right || keep.has(option.key));
}

/**
 * The order the flags of a climb come in: by lot, and where it is known how well known each is (`known`,
 * by the key of the card: the heavier, the sooner), the better known before the rest more often than not.
 */
export function climbOrder(deck: readonly DeckCard[], known: ReadonlyMap<string, number> | undefined, rng: Rng = Math.random): DeckCard[] {
  if (!known?.size) return shuffle(deck, rng);
  return deck
    .map((card) => ({ card, at: -Math.log(1 - rng()) / Math.max(known.get(card.key) ?? 1, 1e-9) }))
    .sort((a, b) => a.at - b.at)
    .map((one) => one.card);
}

/** The fewest people a country is taken to have when its flags are weighed: the smallest are not left for the very end every time. */
const CLIMB_FEW = 10_000;

/**
 * How well known each flag of a deck is taken to be, for the order of a climb: that of a country and that
 * of a capital, by the people of the country (the square root of them: India comes before Tuvalu far more
 * often than not, and not always). The other flags have nothing to be weighed by: a deck that has any of
 * them is not weighed at all, and comes by lot.
 */
export function climbKnown(deck: readonly DeckCard[], index: Index): Map<string, number> {
  const out = new Map<string, number>();
  if (deck.some((card) => card.kind !== 'country' && card.kind !== 'capital')) return out;
  const people = new Map(index.countries.map((c) => [c.id, c.pop ?? 0]));
  for (const card of deck) out.set(card.key, Math.sqrt(Math.max(people.get(card.country) ?? 0, CLIMB_FEW)));
  return out;
}

/** The cards of a game of «Parejas»: so many of the set, by lot, no two of them the same picture or of the same name. */
export const pairCards = (deck: readonly DeckCard[], pairs: number, rng: Rng = Math.random): DeckCard[] => apart(shuffle(deck, rng), pairs);

/**
 * How many questions a game will have, with the flags there are; in «Parejas», how many pairs. None when
 * the game cannot be played with them: flags that are not alike, countries that never changed theirs.
 */
export function questionCount(play: FlagPlay, deck: readonly DeckCard[], near?: ReadonlyMap<string, readonly Near[]>, extra: FlagExtra = {}): number {
  if (play.game === 'flag-pairs') {
    const pairs = Math.min(typeof play.length === 'number' ? play.length : PAIR_SIZE_DEFAULT, apart(deck).length);
    return pairs < PAIRS_MIN ? 0 : pairs;
  }
  let all = deck.length;
  if (play.game === 'flag-alike') all = alikeCount(alikePool(deck, near ?? new Map()));
  else if (play.game === 'flag-past') all = (extra.past?.cards.size ?? 0) < PAST_MIN ? 0 : extra.past!.cards.size;
  else if (play.game === 'flag-odd') all = extra.odd ? oddCount(extra.odd) : 0;
  else if (play.game === 'flag-land') all = (extra.land?.cards.size ?? 0) < LAND_MIN ? 0 : extra.land!.cards.size;
  return play.length === 'all' ? all : Math.min(play.length, all);
}

/**
 * The questions of a game. `near` is what «Casi iguales» needs (lib/flagAlike.ts, `nearCards`), and what
 * «El intruso» takes its flag from outside by, where it has it; `only`, the keys of the cards to ask when
 * a game is only of some (those that were missed): what is set beside them still comes from the whole set.
 * `extra` is what «Antes y ahora», «El intruso» and «¿De qué país es?» are asked with, and what «Escalada»
 * orders its flags by. «Parejas» has no questions: `pairCards`.
 */
export function roundOf(play: FlagPlay, deck: readonly DeckCard[], rng: Rng = Math.random, near: ReadonlyMap<string, readonly Near[]> = new Map(), only?: ReadonlySet<string>, extra: FlagExtra = {}): FlagQuestion[] {
  if (play.game === 'flag-pairs') return [];
  if (play.game === 'flag-past') {
    const past = extra.past;
    if (!past || (!only && past.cards.size < PAST_MIN)) return [];
    return pastAsked(past.cards, past.data, play.length, rng, only).flatMap((card) => {
      const options = pastOptions(card, deck, past.data, past.place, FLAG_OPTIONS, rng);
      const land = options.find((option) => option.id === card.id);
      return land && options.length > 1 ? [{ card, options, right: land.key, order: [] }] : [];
    });
  }
  if (play.game === 'flag-land') {
    const land = extra.land;
    if (!land || (!only && land.cards.size < LAND_MIN)) return [];
    return landAsked(land.cards, play.length, rng, only).flatMap((card) => {
      const options = landOptions(card, deck, land.cards, land.data, land.where, FLAG_OPTIONS, rng);
      const owner = options.find((option) => option.id === card.country);
      return owner && options.length > 1 ? [{ card, options, right: owner.key, order: [] }] : [];
    });
  }
  if (play.game === 'flag-climb') {
    // Every flag of the set, the better known first; each with the most names it can come with, of which the game shows as many as its height says.
    const asked = only ? shuffle(deck.filter((card) => only.has(card.key)), rng) : climbOrder(deck, extra.climb?.known, rng);
    return asked.map((card, i) => {
      const alike = i >= CLIMB_ALIKE_FROM ? (near.get(card.key) ?? []).map((one) => one.card) : [];
      const rivals = beside(card, [...alike, ...shuffle(deck, rng)], CLIMB_MOST - 1);
      return { card, options: shuffle([card, ...rivals], rng), right: card.key, order: [], rivals: rivals.map((rival) => rival.key) };
    });
  }
  if (play.game === 'flag-odd') {
    const pool = extra.odd;
    if (!pool?.out) return [];
    return oddRound({ groups: pool.groups, out: pool.out }, play.length, rng, near.size ? near : undefined, only).map(({ card, trio, group, tag }) => ({ card, options: shuffle([card, ...trio], rng), right: card.key, order: [], odd: { group, tag } }));
  }
  const alike = play.game === 'flag-alike';
  let asked: DeckCard[];
  if (only) asked = shuffle(deck.filter((card) => only.has(card.key)), rng);
  else if (alike) {
    const pool = alikePool(deck, near);
    asked = shuffle(pool.cards.slice(0, alikeCount(pool)), rng);
  } else asked = shuffle(deck, rng);
  if (!only && play.length !== 'all') asked = asked.slice(0, play.length);

  const typed = play.answer === 'type' && TYPED.includes(play.game);
  const pieces = Array.from({ length: REVEAL_PIECES }, (_, i) => i);
  return asked.map((card) => {
    let options: DeckCard[] = [];
    if (!typed) {
      // The look-alikes first, where the game is about them; then any flag of the set, so that there are four.
      const rivals = alike ? rivalsOf(card, near.get(card.key) ?? []).map((r) => r.card) : [];
      options = shuffle([card, ...beside(card, shuffle(deck, rng), FLAG_OPTIONS - 1, rivals)], rng);
    }
    return { card, options, right: card.key, order: play.game === 'flag-reveal' ? shuffle(pieces, rng) : [] };
  });
}

/** What reads the names typed in a game: every flag of the set answers to its names. */
export const flagMatcher = (deck: readonly DeckCard[]): Matcher => new Matcher(deck.map((card) => ({ id: card.key, answers: card.answers })), { codes: false });

/** What a typed answer is: right, the name of another flag of the set, or nothing the set knows. */
export type Typed = { res: 'right' } | { res: 'wrong'; given: DeckCard } | { res: 'unknown' };

/**
 * Judges a name typed for a flag. The name of another flag that is the same picture is right: what is on
 * screen is as much the one as the other. A name the set does not know is not an answer yet: the player
 * may have slipped, and is asked again.
 */
export function judgeTyped(matcher: Matcher, deck: readonly DeckCard[], card: DeckCard, text: string): Typed {
  const verdict = matcher.check(text, card.key);
  if (verdict.res === 'yes' || verdict.res === 'short') return { res: 'right' };
  if (verdict.res !== 'other') return { res: 'unknown' };
  const given = deck.find((c) => c.key === verdict.id);
  if (!given) return { res: 'unknown' };
  return given.look === card.look ? { res: 'right' } : { res: 'wrong', given };
}

/** What was answered to a question. */
export interface FlagAnswered {
  card: DeckCard;
  res: Res;
  /** The flag taken for it, when the answer was wrong. */
  given?: DeckCard;
  /** «El intruso»: what the flag is of, and the group it was set in. */
  note?: string;
  /** «Poco a poco»: what it was worth. */
  points: number;
}

/** What a game adds up to. */
export interface FlagScore {
  ok: number;
  warn: number;
  bad: number;
  total: number;
  /** «Poco a poco»: the points got, and the most there were to get. */
  points: number;
  max: number;
  /** The mark, 0–100: the share of answers right, or of points got in «Poco a poco». */
  pct: number;
}

export function flagScore(game: FlagGame, answers: readonly FlagAnswered[]): FlagScore {
  const count = { ok: 0, warn: 0, bad: 0 };
  let points = 0;
  for (const a of answers) {
    count[a.res]++;
    points += a.points;
  }
  const total = answers.length;
  const max = game === 'flag-reveal' ? total * revealPoints(REVEAL_START) : total;
  const got = game === 'flag-reveal' ? points : count.ok + count.warn;
  return { ...count, total, points: got, max, pct: max ? Math.round((100 * got) / max) : 0 };
}

/** How each game is played, as «Cómo se juega» shows it. A button is quoted by what it says. */
export function flagGameHelp(game: FlagGame): ModeHelp {
  const marked = L('Se corrige al momento: si fallas, se marca cuál era. Pulsa «Siguiente» (o Intro) para seguir.', 'It is marked at once: if you miss, the right one is shown. Press “Next” (or Enter) to go on.');
  const end = L('Al acabar ves la nota, el tiempo y las banderas que fallaste, cada una con su nombre, y puedes repasar solo esas.', 'At the end you see the mark, the time and the flags you missed, each with its name, and you can go over those alone.');
  const one = L(
    'Hay un solo intento por bandera: cuenta como acierto o como fallo. Tu marca es el mejor porcentaje de aciertos, y cada juego la guarda aparte para cada grupo de banderas.',
    'There is one try for each flag: it counts as right or as a miss. Your record is the best share of right answers, and each game keeps one for each group of flags.',
  );
  const same = L(
    'Dos banderas que son el mismo dibujo (Chad y Rumania, Indonesia y Mónaco) nunca salen juntas entre las respuestas.',
    'Two flags that are the same picture (Chad and Romania, Indonesia and Monaco) never come up together among the answers.',
  );
  switch (game) {
    case 'flag-whose':
      return {
        steps: [
          L(
            'Sale una bandera. Di de dónde es: pulsa uno de los cuatro nombres (o su número, del 1 al 4) o, si elegiste «Escrita», escribe el nombre y pulsa Intro.',
            'A flag comes up. Say whose it is: press one of the four names (or its number, 1 to 4) or, if you chose “Typed”, type the name and press Enter.',
          ),
          marked,
          end,
        ],
        score: one,
        aid: L(
          'Al escribir no importan las mayúsculas ni las tildes, y vale el nombre en español o en inglés. Si lo que escribes no es el nombre de ninguna bandera del grupo, no cuenta como intento: puedes corregirlo. «No lo sé» da la respuesta y cuenta como fallo.',
          'When typing, capitals and accents do not matter, and the name is taken in Spanish or in English. If what you type is the name of no flag of the group, it is not counted as a try: you can mend it. “I don’t know” gives the answer and counts as a miss.',
        ),
        tip: `${same} ${L('Si la escribes, vale el nombre de cualquiera de las dos.', 'If you type it, the name of either is right.')}`,
      };
    case 'flag-pick':
      return {
        steps: [L('Sale un nombre y cuatro banderas. Pulsa la suya (o su número, del 1 al 4).', 'A name comes up with four flags. Press its own (or its number, 1 to 4).'), marked, end],
        score: one,
        tip: `${L('Si dudas entre dos, fíjate en el orden de las franjas y en el escudo: es lo que más se confunde.', 'If you are between two, look at the order of the stripes and at the arms: that is what gets mixed up most.')} ${same}`,
      };
    case 'flag-alike':
      return {
        steps: [
          L(
            'Sale un nombre y cuatro banderas que se parecen entre sí: la suya y las tres que más se le parecen del grupo. Pulsa la que es (o su número, del 1 al 4).',
            'A name comes up with four flags that look alike: its own and the three of the group most like it. Press the right one (or its number, 1 to 4).',
          ),
          marked,
          L(
            'Solo se preguntan las banderas que tienen con quién confundirse: con «Todas» salen todas las que lo tienen, no todas las del grupo.',
            'Only the flags that have something to be mixed up with are asked: “All” brings all that do, not every flag of the group.',
          ),
          end,
        ],
        score: one,
        tip: L(
          'Las que son exactamente el mismo dibujo nunca salen juntas: siempre hay una diferencia, aunque sea el tono, el escudo o el orden de los colores.',
          'Those that are exactly the same picture never come up together: there is always a difference, be it the shade, the arms or the order of the colours.',
        ),
      };
    case 'flag-pairs':
      return {
        steps: [
          L(
            'Las cartas están boca abajo, dos por bandera: la bandera y su nombre. El dorso dice cuál es cuál. Levanta una bandera y un nombre.',
            'The cards are face down, two for each flag: the flag and its name. The back says which is which. Turn over a flag and a name.',
          ),
          L(
            'Si el nombre es el de esa bandera, son pareja y se quedan a la vista. Si no, vuelven a su sitio al cabo de un momento, o en cuanto levantas otra.',
            'If the name is that of the flag, they are a pair and stay in sight. If not, they go back after a moment, or as soon as you turn over another.',
          ),
          L('Con el teclado, las flechas van de carta en carta, e Intro o la barra espaciadora la levantan.', 'With the keyboard, the arrows go from card to card, and Enter or the space bar turns it over.'),
          L('Al acabar ves los intentos, el tiempo y cada pareja.', 'At the end you see the turns, the time and each pair.'),
        ],
        score: L(
          'Solo cuenta como fallo el intento que te podías haber ahorrado: cuando ya habías visto dónde estaba la otra mitad de la primera carta, o cuando la juntas con una que ya conocías. Tu marca es la partida con menos intentos, y se guarda aparte para cada grupo de banderas y cada número de parejas.',
          'Only a turn you could have spared counts as a miss: when you had already seen where the other half of the first card was, or when you put it with one you already knew. Your record is the game with the fewest turns, kept apart for each group of flags and each number of pairs.',
        ),
        tip: L(
          'Levanta primero las cartas que no hayas visto: cada una que conoces es una pareja que ya no hay que buscar.',
          'Turn over the cards you have not seen first: each one you know is a pair you no longer have to look for.',
        ),
      };
    case 'flag-odd':
      return {
        steps: [
          L(
            'Salen cuatro banderas y el nombre de un grupo: tres son de ese grupo y una no. Pulsa la intrusa (o su número, del 1 al 4).',
            'Four flags come up with the name of a group: three are of that group and one is not. Press the odd one out (or its number, 1 to 4).',
          ),
          L(
            'Se corrige al momento, y cada bandera dice de quién es; la intrusa, además, de dónde viene. Pulsa «Siguiente» (o Intro) para seguir.',
            'It is marked at once, and each flag says whose it is; the odd one out, where it comes from as well. Press “Next” (or Enter) to go on.',
          ),
          end,
        ],
        score: L(
          'Hay un solo intento por pregunta: cuenta como acierto o como fallo. Tu marca es el mejor porcentaje de aciertos, y se guarda aparte para cada grupo de banderas.',
          'There is one try for each question: it counts as right or as a miss. Your record is the best share of right answers, kept apart for each group of flags.',
        ),
        tip: L(
          'Con los países del mundo el grupo es un continente distinto en cada pregunta, y la intrusa suele parecerse a una de las otras tres: fíjate en el nombre del grupo antes que en los colores.',
          'With the countries of the world the group is another continent in each question, and the odd one out often looks like one of the other three: mind the name of the group before the colours.',
        ),
      };
    case 'flag-climb':
      return {
        steps: [
          L(
            `Sale una bandera y dices de dónde es. Empiezas eligiendo entre ${CLIMB_FIRST} nombres, y cada ${CLIMB_STEP} aciertos hay uno más, hasta ${CLIMB_MOST}: pulsa el nombre (o su número).`,
            `A flag comes up and you say whose it is. You begin by choosing between ${CLIMB_FIRST} names, and every ${CLIMB_STEP} right answers there is one more, up to ${CLIMB_MOST}: press the name (or its number).`,
          ),
          L(
            `Cada acierto es un peldaño. Cada fallo cuesta una vida, y tienes ${CLIMB_LIVES}: con el último se acaba la escalada.`,
            `Each right answer is a rung. Each miss costs a life, and you have ${CLIMB_LIVES}: the last one ends the climb.`,
          ),
          L(
            'Cuanto más arriba, más difícil: hay más nombres entre los que elegir y, desde la décima bandera, son los de las banderas que más se le parecen. Con los países y las capitales, además, las de los países más poblados suelen salir antes.',
            'The higher, the harder: there are more names to choose from and, from the tenth flag on, they are those of the flags most like it. With the countries and the capitals, those of the most populous countries tend to come first as well.',
          ),
          L(
            'Se sube hasta que se acaban las vidas o las banderas. Al acabar ves la altura, el tiempo y las banderas que fallaste, cada una con su nombre.',
            'You climb until the lives or the flags run out. At the end you see how high you got, the time and the flags you missed, each with its name.',
          ),
        ],
        score: L(
          'Tu marca es la altura: los peldaños subidos, es decir, las banderas acertadas hasta quedarte sin vidas o pulsar «Terminar». Se guarda aparte para cada grupo de banderas.',
          'Your record is the height: the rungs climbed, that is, the flags you got right until the lives ran out or you pressed “Finish”. It is kept apart for each group of flags.',
        ),
        tip: L(
          'Las vidas no vuelven. Arriba, con ocho nombres de banderas parecidas, descarta primero las que conoces.',
          'Lives do not come back. Up there, with eight names of flags that look alike, rule out the ones you know first.',
        ),
      };
    case 'flag-land':
      return {
        steps: [
          L(
            'Sale la bandera de una región (una provincia, un estado, un cantón), sin su nombre. Debajo hay cuatro países, cada uno con su bandera: pulsa el país del que es esa región (o su número, del 1 al 4).',
            'The flag of a region (a province, a state, a canton) comes up, without its name. Below there are four countries, each with its flag: press the country that region is of (or its number, 1 to 4).',
          ),
          L(
            'Se corrige al momento, y se dice de qué región es la bandera. Pulsa «Siguiente» (o Intro) para seguir.',
            'It is marked at once, and you are told which region the flag is of. Press “Next” (or Enter) to go on.',
          ),
          L(
            'De cada país sale una sola de las banderas de sus regiones, por sorteo: en otra partida puede salir otra. Solo se pregunta por los países de los que el juego tiene banderas de regiones.',
            'Of each country only one of the flags of its regions comes up, by lot: another game may bring another. Only the countries the game has flags of regions for are asked.',
          ),
          end,
        ],
        score: L(
          'Hay un solo intento por bandera: cuenta como acierto o como fallo. Tu marca es el mejor porcentaje de aciertos, y se guarda aparte para cada grupo de países.',
          'There is one try for each flag: it counts as right or as a miss. Your record is the best share of right answers, kept apart for each group of countries.',
        ),
        tip: L(
          'Fíjate en el estilo antes que en los colores: las letras, el escudo, los símbolos. Los otros tres países son del mismo continente, donde los hay, y nunca uno que tenga esa misma bandera.',
          'Mind the style before the colours: the lettering, the arms, the symbols. The other three countries are of the same continent, where there are enough, and never one that flies that same flag.',
        ),
      };
    case 'flag-past':
      return {
        steps: [
          L(
            'Sale una bandera que un país de hoy tuvo antes, con los años en que ondeó. Debajo hay cuatro países, cada uno con su bandera de ahora: pulsa el que la tuvo (o su número, del 1 al 4).',
            'A flag that a country of today flew before comes up, with the years it flew. Below there are four countries, each with its flag of today: press the one that flew it (or its number, 1 to 4).',
          ),
          marked,
          L(
            'De cada país sale una sola de sus banderas anteriores, por sorteo: en otra partida puede salir otra. Solo se pregunta por los países que han cambiado de bandera.',
            'Of each country only one of its earlier flags comes up, by lot: another game may bring another. Only the countries that have changed their flag are asked.',
          ),
          end,
        ],
        score: L(
          'Hay un solo intento por bandera: cuenta como acierto o como fallo. Tu marca es el mejor porcentaje de aciertos, y se guarda aparte para cada grupo de países.',
          'There is one try for each flag: it counts as right or as a miss. Your record is the best share of right answers, kept apart for each group of countries.',
        ),
        tip: L(
          'Los otros tres países no están al azar: son los que hoy tienen la bandera más parecida a la antigua. Nunca sale como opción un país que también tuvo esa misma bandera.',
          'The other three countries are not there by chance: they are the ones whose flag of today is most like the old one. A country that flew that same flag too is never one of the options.',
        ),
      };
    default:
      return {
        steps: [
          L(
            `La bandera está tapada por ${REVEAL_PIECES} piezas y empieza con una sola quitada. Pulsa «Destapar» (o la barra espaciadora) para quitar otra.`,
            `The flag is covered by ${REVEAL_PIECES} pieces and starts with only one taken off. Press “Uncover” (or the space bar) to take off another.`,
          ),
          L(
            'Cuando sepas de dónde es, contesta: pulsa uno de los cuatro nombres (o su número) o, si elegiste «Escrita», escríbelo.',
            'When you know whose it is, answer: press one of the four names (or its number) or, if you chose “Typed”, type it.',
          ),
          L('Hay un solo intento: si fallas, esa bandera no da puntos. Pulsa «Siguiente» (o Intro) para seguir.', 'There is one try: if you miss, that flag gives no points. Press “Next” (or Enter) to go on.'),
          end,
        ],
        score: L(
          `Cada bandera vale tantos puntos como piezas le queden puestas, más uno: ${revealPoints(REVEAL_START)} si aciertas con una sola pieza quitada, uno si la destapas entera. Cuenta «a la primera» si aciertas con media bandera o menos a la vista, y «con ayuda» si necesitaste más. Tu marca es el mejor porcentaje de puntos.`,
          `Each flag is worth as many points as it has pieces left on, plus one: ${revealPoints(REVEAL_START)} if you get it with only one piece off, one if you uncover it all. It counts as “first time” if you get it with half the flag or less in sight, and as “with help” if you needed more. Your record is the best share of points.`,
        ),
        tip: L(
          'Una esquina dice poco y el centro dice mucho: si la primera pieza es un borde, destapa una o dos más antes de arriesgar.',
          'A corner says little and the centre says a lot: if the first piece is an edge, uncover one or two more before you risk it.',
        ),
      };
  }
}
