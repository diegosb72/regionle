/** What a game can be played as. Kept apart from the menus, which bring their icons: the saved state asks too. */
import type { Mode, Section } from './types';

/** Games that can also be played against the clock or until the lives run out. */
export const FORMAT_MODES: readonly Mode[] = ['pin', 'identify', 'outline', 'puzzle', 'capital', 'flag', 'parent', 'mix', 'listen'];

/** What sits in the menus without being a game: it is not counted among them, and leaves nothing in the progress. */
export const NOT_GAMES: readonly Mode[] = ['print', 'edit'];

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
