/**
 * «Ahorcado» (hangman): the name of a piece of the map is hidden, and the player tries letters. A letter
 * that is in the name shows wherever it is; one that is not puts out a point of the compass rose, and with
 * the eighth the name is lost. Here: what each letter uncovers, how a round stands and how it is marked.
 *
 * Nothing here knows of the screen: the game is drawn in games/Hangman.tsx.
 */
import type { Lang } from './i18n';
import { fold, mulberry32, shuffle } from './text';
import type { Res } from './types';

/** Letters that are not in the name before it is lost: as many as the rose has points. */
export const HANG_MISSES = 8;

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The letters there are to try: the alphabet of the language. The Spanish one has the Ñ, after the N. */
export const lettersOf = (lang: Lang): string[] => [...(lang === 'es' ? AZ.replace('N', 'NÑ') : AZ)];

/**
 * The letter that uncovers a character: its own without its accent («Á» is uncovered by the A, «ü» by the
 * U, «ł» by the L). The Ñ is a letter of its own in Spanish, and an N in English. Nothing for what no
 * single letter of the alphabet stands for (a hyphen, a figure, «ß»): that is in sight from the start.
 */
export function letterOf(ch: string, lang: Lang): string {
  if (lang === 'es' && (ch === 'ñ' || ch === 'Ñ')) return 'Ñ';
  const plain = fold(ch);
  return /^[a-z]$/.test(plain) ? plain.toUpperCase() : '';
}

export interface HangCell {
  /** The character, as the name writes it. */
  ch: string;
  /** The letter that uncovers it; none when it is in sight from the start. */
  letter: string;
}

/** A name as it is laid out: its words, and the cells of each. Spaces part the words and are no cell. */
export function wordsOf(name: string, lang: Lang): HangCell[][] {
  return name
    .normalize('NFC')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => [...word].map((ch) => ({ ch, letter: letterOf(ch, lang) })));
}

/**
 * A word in the stretches it may be written in: it is cut after each hyphen, which is where a long one
 * («Mecklemburgo-Pomerania») can go on in the next line without looking like two words.
 */
export function partsOf(word: readonly HangCell[]): HangCell[][] {
  const parts: HangCell[][] = [[]];
  for (const cell of word) {
    parts[parts.length - 1].push(cell);
    if (cell.ch === '-') parts.push([]);
  }
  return parts.filter((part) => part.length > 0);
}

/** The cells of the longest stretch of a name: what the size it is written at has to make room for. */
export const widestOf = (words: readonly (readonly HangCell[])[]): number => Math.max(1, ...words.flatMap((word) => partsOf(word).map((part) => part.length)));

/** The letters a name hides, each one once, in the order they come in it. */
export function hiddenOf(name: string, lang: Lang): string[] {
  return [
    ...new Set(
      wordsOf(name, lang)
        .flat()
        .map((c) => c.letter)
        .filter(Boolean),
    ),
  ];
}

/** A name can be played when it hides some letter: one made of figures alone leaves nothing to guess. */
export const hangable = (name: string, lang: Lang): boolean => hiddenOf(name, lang).length > 0;

export interface HangState {
  /** The letters tried that are in the name and those that are not, in the order they were tried. */
  hits: string[];
  misses: string[];
  /** Cells of the name still covered. */
  left: number;
  solved: boolean;
  lost: boolean;
}

/**
 * How a round stands after some letters. They are taken in order, and the round is over with the last
 * letter of the name or with the eighth that is not in it: what comes after that is not looked at, and
 * neither is a letter tried twice or something that is no letter of the alphabet.
 */
export function standing(name: string, tried: readonly string[], lang: Lang): HangState {
  const cells = wordsOf(name, lang).flat();
  const hidden = new Set(cells.map((c) => c.letter).filter(Boolean));
  const alphabet = lettersOf(lang);
  const hits: string[] = [];
  const misses: string[] = [];
  for (const letter of tried) {
    if (hits.length === hidden.size || misses.length >= HANG_MISSES) break;
    if (!alphabet.includes(letter) || hits.includes(letter) || misses.includes(letter)) continue;
    (hidden.has(letter) ? hits : misses).push(letter);
  }
  const solved = hits.length === hidden.size;
  return { hits, misses, left: cells.filter((c) => c.letter && !hits.includes(c.letter)).length, solved, lost: !solved && misses.length >= HANG_MISSES };
}

/**
 * A letter is tried: the letters tried from now on, and how many cells this one uncovers (none when it is
 * not in the name). Null when it cannot be tried: the round is over, it was tried before, or it is no
 * letter of the alphabet.
 */
export function tryLetter(name: string, tried: readonly string[], letter: string, lang: Lang): { tried: string[]; found: number } | null {
  const now = standing(name, tried, lang);
  if (now.solved || now.lost || !lettersOf(lang).includes(letter) || now.hits.includes(letter) || now.misses.includes(letter)) return null;
  return {
    tried: [...tried, letter],
    found: wordsOf(name, lang)
      .flat()
      .filter((c) => c.letter === letter).length,
  };
}

/** The letter a key of the keyboard tries; none for a key that types no letter of the alphabet («Enter», «F1», a figure). */
export const keyLetter = (key: string, lang: Lang): string => ([...key].length === 1 ? letterOf(key, lang) : '');

/**
 * How a round is marked: right first time when the name is found with the letters alone, with help when
 * the map was asked to show the piece, and to review when it is not found. The letters missed on the way
 * take nothing off: they only bring the end nearer.
 */
export const hangRes = (solved: boolean, hinted: boolean): Res => (solved ? (hinted ? 'warn' : 'ok') : 'bad');

/** The name as it stands, to be heard: each word letter by letter, with `blank` for a cell still covered. */
export function spokenOf(name: string, tried: readonly string[], lang: Lang, blank: string): string {
  const { hits } = standing(name, tried, lang);
  return wordsOf(name, lang)
    .map((word) => word.map((c) => (!c.letter || hits.includes(c.letter) ? c.ch.toUpperCase() : blank)).join(' '))
    .join(', ');
}

/** The pieces a game is played with: those of the list when there is one, and of them the ones whose name hides something. */
export function hangPool<T extends { id: string; name: string }>(items: readonly T[], only: readonly string[] | undefined, lang: Lang): T[] {
  const list = only ? new Set(only) : null;
  return items.filter((it) => (!list || list.has(it.id)) && hangable(it.name, lang));
}

/**
 * The names of a game in the order they come: as many as were asked for, by lot, or all of them when the
 * game is of a list or of the whole map. The same ones in the same order for the same seed, whatever the
 * order the pieces are given in.
 */
export function hangOrder(ids: readonly string[], length: number | string, seed: number, whole: boolean): string[] {
  const list = shuffle([...ids].sort(), mulberry32(seed));
  return typeof length === 'number' && !whole ? list.slice(0, length) : list;
}
