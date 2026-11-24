/**
 * The games of the section «Banderas»: what each is, how a game is said in an address, the questions of a
 * game and how they count. They are played with the flags of a set (lib/flagSets.ts) and nothing else:
 * there is no map, so they are no modes of a section with one.
 *
 *   ¿De dónde es?         a flag, and its name among four or typed
 *   ¿Cuál es su bandera?  a name, and its flag among four
 *   Casi iguales          a name, and its flag among the three that look most like it
 *   Poco a poco           a flag uncovered piece by piece: the sooner it is named, the more it is worth
 *
 * The texts are long: nothing that comes with the first page may import this file (lib/modes.ts has the
 * names, which the first page says).
 */
import { Copy, Flag, Grid3x3, LayoutGrid, type LucideIcon } from 'lucide-react';
import { ALIKE_CLOSE, ALIKE_OTHERS, closeness, rivalsOf, type Near } from './flagAlike';
import { flagSetOf, flagSetText, twins, type DeckCard, type FlagSet } from './flagSets';
import type { ModeHelp } from './help';
import { L } from './i18n';
import { Matcher } from './matcher';
import { FLAG_GAME_IDS, flagGameName } from './modes';
import { FLAGS_PATH, FLAG_GAMES_PATH, FLAG_PLAY_PATH } from './routes';
import { shuffle, type Rng } from './text';
import type { FlagGame, Res } from './types';

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

const ICON: Record<FlagGame, LucideIcon> = { 'flag-whose': Flag, 'flag-pick': LayoutGrid, 'flag-alike': Copy, 'flag-reveal': Grid3x3 };
const LEVEL: Record<FlagGame, 1 | 2 | 3> = { 'flag-whose': 1, 'flag-pick': 1, 'flag-alike': 3, 'flag-reveal': 2 };
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
    default:
      return L('La bandera se destapa pieza a pieza: cuanto antes digas de dónde es, más puntos.', 'The flag is uncovered piece by piece: the sooner you say whose it is, the more points.');
  }
}

export const flagGameDef = (id: FlagGame): FlagGameDef => ({ id, name: flagGameName(id), desc: descOf(id), icon: ICON[id], level: LEVEL[id], typed: TYPED.includes(id) });

/** How many questions a game has: ten, twenty or one for each flag of the set. */
export type FlagLength = 10 | 20 | 'all';
export const FLAG_LENGTHS: readonly FlagLength[] = [10, 20, 'all'];
/** How a name is given: chosen among four, or typed. */
export type FlagAnswer = 'choice' | 'type';

/** A game as it is started: which one, with which flags and how. */
export interface FlagPlay {
  game: FlagGame;
  set: FlagSet;
  length: FlagLength;
  answer: FlagAnswer;
}

/** The word each game goes by in an address: the same in every language, so that links keep working. */
const GAME_WORD: Record<FlagGame, string> = { 'flag-whose': 'de-donde', 'flag-pick': 'cual-es', 'flag-alike': 'casi-iguales', 'flag-reveal': 'poco-a-poco' };
const WORD_GAME = Object.fromEntries(Object.entries(GAME_WORD).map(([game, word]) => [word, game])) as Record<string, FlagGame>;
const ALL_WORD = 'todas';
const TYPE_WORD = 'escrita';

/** A game as an address says it after `banderas/jugar/`: `de-donde/regiones-ES/10`, `poco-a-poco/paises-EU/todas/escrita`. */
export function flagPlayText(play: FlagPlay): string {
  const parts = [GAME_WORD[play.game], flagSetText(play.set), play.length === 'all' ? ALL_WORD : String(play.length)];
  if (play.answer === 'type' && TYPED.includes(play.game)) parts.push(TYPE_WORD);
  return parts.join('/');
}

/**
 * The game that such a text says; null when it names no game or no flags. What it leaves unsaid, or says
 * wrong, is as a game opens: ten questions, chosen among four.
 */
export function flagPlayOf(text: string): FlagPlay | null {
  const [word = '', flags = '', count = '', how = ''] = text.split('/');
  const game = WORD_GAME[word.toLowerCase()];
  const set = flagSetOf(flags);
  if (!game || !set) return null;
  const length: FlagLength = count.toLowerCase() === ALL_WORD ? 'all' : count === '20' ? 20 : 10;
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
  /** The flag it is about. */
  card: DeckCard;
  /** What there is to choose from, the right one among them, in the order it is shown; nothing when the answer is typed. */
  options: DeckCard[];
  /** «Poco a poco»: the order its pieces come off in. */
  order: number[];
}

/** How many answers a question offers. */
export const FLAG_OPTIONS = ALIKE_OTHERS + 1;
/** «Casi iguales» asks at least so many flags where the set has them, however few are truly alike: as many as its longest game of a fixed length. */
export const ALIKE_POOL_MIN = 20;
/** …and is no game with fewer than these to ask. */
export const ALIKE_MIN = 4;

/** Some cards to set beside one, taken in the order given: none that cannot share a question with it or with another of them. */
function beside(card: DeckCard, from: readonly DeckCard[], n: number, had: readonly DeckCard[] = []): DeckCard[] {
  const out: DeckCard[] = [...had];
  for (const other of from) {
    if (out.length >= n) break;
    if (other.key === card.key || twins(card, other) || out.some((o) => o.key === other.key || twins(o, other))) continue;
    out.push(other);
  }
  return out;
}

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

/** How many questions a game will have, with the flags there are. */
export function questionCount(play: FlagPlay, deck: readonly DeckCard[], near?: ReadonlyMap<string, readonly Near[]>): number {
  const all = play.game === 'flag-alike' ? alikeCount(alikePool(deck, near ?? new Map())) : deck.length;
  return play.length === 'all' ? all : Math.min(play.length, all);
}

/**
 * The questions of a game. `near` is what «Casi iguales» needs (lib/flagAlike.ts, `nearCards`); `only`,
 * the keys of the cards to ask when a game is only of some (those that were missed): what is set beside
 * them still comes from the whole set.
 */
export function roundOf(play: FlagPlay, deck: readonly DeckCard[], rng: Rng = Math.random, near: ReadonlyMap<string, readonly Near[]> = new Map(), only?: ReadonlySet<string>): FlagQuestion[] {
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
    return { card, options, order: play.game === 'flag-reveal' ? shuffle(pieces, rng) : [] };
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
