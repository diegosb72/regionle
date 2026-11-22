/** What a game can be played as. Kept apart from the menus, which bring their icons: the saved state asks too. */
import type { Format, GameConfig } from './store';
import type { Mode, Section } from './types';

/** Games that can also be played against the clock or until the lives run out. */
export const FORMAT_MODES: readonly Mode[] = ['pin', 'identify', 'outline', 'puzzle', 'capital', 'flag', 'parent', 'mix', 'listen'];

/**
 * The format a game is played in: the one its options ask for, where there are formats to choose from. A
 * review, a challenge received and the repeat of what was missed are always a plain set of questions; and so
 * is a step of the session of the day that asks for two players: it is one player's, and nobody sat down to a
 * game of two there.
 */
export function formatOfGame(game: Pick<GameConfig, 'mode' | 'review' | 'challenge' | 'only' | 'list' | 'step'> & { opts: { format?: Format } }): Format {
  if (!FORMAT_MODES.includes(game.mode) || game.review || game.challenge || (game.only && !game.list)) return 'normal';
  const wanted = game.opts.format ?? 'normal';
  return wanted === 'duo' && game.step ? 'normal' : wanted;
}

/**
 * A game of two players who answer by turns (lib/duo.ts) is dealt in pairs of questions: one more would be a
 * turn that only one of them had.
 */
export const evenOf = (n: number): number => (n > 0 ? n - (n % 2) : 0);

/**
 * «Reglas a medida» (lib/ruleset.ts): what can be changed of how the question games are played. The tries a
 * question takes where it is answered on the map or by typing, the seconds a time attack lasts and the lives
 * a survival starts with: what each of them can be.
 */
export const TRIES = [1, 2, 3] as const;
export const CLOCKS = [30, 60, 120, 300] as const;
export const LIVES = [1, 3, 5] as const;
/** The rules the game always had, and the ones it has until something else is chosen. */
export const USUAL_RULES = { tries: 3, hints: true, clock: 60, lives: 3 } as const;

/**
 * What sits in the menus without being a game of one player: it is not counted among them, and leaves
 * nothing in the progress. The bingo is played by a group, and nobody answers anything on this screen.
 */
export const NOT_GAMES: readonly Mode[] = ['print', 'bingo', 'edit'];
/** The fewest pieces a map needs for a bingo: what its smallest card asks (lib/bingo.ts). Here, for the menus to say so without the code of the bingo. */
export const BINGO_MIN = 12;

/** Games that ask as many questions as the player chooses under "Preguntas". */
export const LENGTH_MODES: readonly Mode[] = ['pin', 'identify', 'outline', 'regionle', 'puzzle', 'neighbours', 'capital', 'flag', 'blind', 'hotcold', 'bearing', 'coords', 'group', 'whoami', 'border', 'exact', 'which', 'rank', 'compass', 'parent', 'truefalse', 'oddone', 'cards', 'mix', 'listen'];

/**
 * Games whose questions are made up as the game goes, from what is known of the countries chosen: there are
 * as many as are asked for, whatever the countries, and the figure chosen for the other games is not theirs.
 */
export const MADE_UP_MODES: readonly Mode[] = ['truefalse', 'oddone'];

/** Games played with the figure of each thing: how many people, how large, how high. */
export const FIGURE_MODES: readonly Mode[] = ['hilo', 'rank', 'exact', 'which', 'topten'];

/** Games that deal rounds of five instead of asking one thing after another. */
export const ROUND_MODES: readonly Mode[] = ['rank', 'compass'];

/** Things a list needs for its "top" to be worth asking: with fewer, it would be the whole list. */
export const TOP_MIN = 6;

/** Countries "the odd one out" takes: four are shown, and a size is measured against one more. */
export const ODD_MIN = 5;

/** What the two cards of a pair are: the flag of a country and its name, or its capital and the country. */
export type PairOf = 'flag' | 'capital';
export const PAIR_OFS: readonly PairOf[] = ['flag', 'capital'];
/** How many pairs are dealt: twice as many cards. */
export const PAIR_SIZES = [6, 8, 10, 12] as const;
export type PairSize = (typeof PAIR_SIZES)[number];
export const PAIR_SIZE_DEFAULT: PairSize = 8;
/** Countries "pairs" takes: with fewer than three pairs there is nothing to remember. */
export const PAIRS_MIN = 3;

/**
 * The rule a route may have to keep: a piece that is closed and has to be gone around, a third piece to call
 * at, or land borders only, without the short sea crossings.
 */
export const ROUTE_RULES = ['none', 'avoid', 'via', 'land'] as const;
export type RouteRule = (typeof ROUTE_RULES)[number];
export const isRouteRule = (x: unknown): x is RouteRule => (ROUTE_RULES as readonly unknown[]).includes(x);

/**
 * What is not put inside another page (lib/embed.ts): the sheet to print, the making of a list, and the
 * bingo, whose cards have addresses of their own (lib/bingo.ts).
 */
export const NOT_EMBEDDED: readonly Mode[] = ['print', 'bingo', 'edit'];
export const embeddable = (mode: Mode): boolean => !NOT_EMBEDDED.includes(mode);

/** A board of "connections": four groups of four countries, and so sixteen is the fewest it takes. */
export const CONNECT_GROUPS = 4;
export const CONNECT_GROUP_SIZE = 4;
export const CONNECT_MIN = CONNECT_GROUPS * CONNECT_GROUP_SIZE;
/** From this many countries on, there are boards enough: fewer may give the same one time and again. */
export const CONNECT_WIDE = 40;

/** Games that can show their outlines turned: the ones that draw one, where the pieces have a shape. */
export const turnsOutlines = (section: Section, mode: Mode): boolean => mode === 'outline' || mode === 'regionle' || (mode === 'mix' && (section === 'regions' || section === 'countries'));

/**
 * Games that show a flag to be told whose it is, and so can show it the hard way: only countries have
 * flags to ask about. "Pin it" and the flashcards do it when they are set to ask by the flag.
 */
export const asksByFlag = (section: Section, mode: Mode, by: { pinBy?: string; cardAsk?: string } = {}): boolean =>
  section === 'countries' && (mode === 'flag' || mode === 'mix' || (mode === 'pin' && by.pinBy === 'flag') || (mode === 'cards' && by.cardAsk === 'flag'));

/** How close a city has to be placed blind for it to be told as a feat, in kilometres. */
export const NEAR_KM = 10;
