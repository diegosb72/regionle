/** What a game can be played as. Kept apart from the menus, which bring their icons: the saved state asks too. */
import type { Mode } from './types';

/** Games that can also be played against the clock or until the lives run out. */
export const FORMAT_MODES: readonly Mode[] = ['pin', 'identify', 'outline', 'puzzle', 'capital', 'flag', 'parent'];

/** What sits in the menus without being a game: it is not counted among them, and leaves nothing in the progress. */
export const NOT_GAMES: readonly Mode[] = ['print', 'edit'];

/** Games that ask as many questions as the player chooses under "Preguntas". */
export const LENGTH_MODES: readonly Mode[] = ['pin', 'identify', 'outline', 'regionle', 'puzzle', 'neighbours', 'capital', 'flag', 'blind', 'exact', 'which', 'rank', 'compass', 'parent', 'truefalse'];

/** Games played with the figure of each thing: how many people, how large, how high. */
export const FIGURE_MODES: readonly Mode[] = ['hilo', 'rank', 'exact', 'which', 'topten'];

/** Games that deal rounds of five instead of asking one thing after another. */
export const ROUND_MODES: readonly Mode[] = ['rank', 'compass'];

/** Things a list needs for its "top" to be worth asking: with fewer, it would be the whole list. */
export const TOP_MIN = 6;
