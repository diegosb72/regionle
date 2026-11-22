/**
 * Bingo for a group: one screen calls the pieces of a map one by one (the «bombo»), and each player marks
 * the ones they have on a card of names, printed or on a phone. Whoever completes a line or the whole card
 * calls it, and the screen that calls is asked whether it is so, by the number of the card.
 *
 * Nothing goes through a server. A card is worked out from three things: the pieces of the map, the size of
 * the card and its number. Whoever has those three has the same card, so that the address of a card carries
 * them, and the screen that calls deals any card again from its number to check it against what has come out.
 *
 *   #/bingo/<who>/<size>/<section>/<map>           the cards of a map: `regiones/ES:p`
 *   #/bingo/<who>/<size>/ciudades/<map>/bingo/<cities>
 *   #/bingo/<who>/<size>/lista/<code>              the cards of a custom list
 *
 *   who   `7`, the card with that number; `1-30`, a sheet of cards to print; `-`, a card for whoever opens
 *         the address, which gives itself a number.
 *   size  the side of the card: 3, 4 or 5.
 *
 * What has come out is not in any address: it is drawn at random by the screen that calls, and kept there
 * (lib/bingoKept.ts). Nor is the way the pieces are called (lit on the map, by their flag, their capital,
 * their outline or their name): that is for the screen that calls to choose, and to change half way if it
 * likes. The cards of a map are the same for every game on it: a sheet printed once is good for as many
 * games as are wanted, however the pieces come up.
 */
import { embedGame, parseEmbed, type EmbedSource, type EmbedWhat } from './embed';
import { L } from './i18n';
import { encodeList } from './lists';
import { mapLinkRest } from './maplink';
import { BINGO_PATH, LIST_PATH, PATHS, linkTo } from './routes';
import { BINGO_MIN } from './rules';
import type { GameConfig } from './store';
import { hashStr, listed, mulberry32, sample, type Rng } from './text';
import type { Item } from './types';
import type { World } from './world';

/** The side of a card: three, four or five names across and down. */
export const BINGO_SIZES = [3, 4, 5] as const;
export type BingoSize = (typeof BINGO_SIZES)[number];
export const BINGO_SIZE_DEFAULT: BingoSize = 4;

/**
 * How a piece is called: lit on the map, by its flag, by its capital, by its outline, or by its very name
 * (with the map lit as well: nothing to recognise, for the youngest). A piece that cannot be called the way
 * that was chosen (a region with no capital in the data) is called by its name.
 */
export const BINGO_HOWS = ['map', 'flag', 'capital', 'outline', 'name'] as const;
export type BingoHow = (typeof BINGO_HOWS)[number];

/**
 * The numbers a card can have. Many more than players: the phones give themselves theirs without knowing
 * of each other, and among so many, two of a class of thirty land on the same one once in two hundred games.
 */
export const CARD_MAX = 99999;
/** A phone that gives itself a card takes a number from here up: the ones below are for the sheets, which start at 1. */
export const CARD_OWN = 1000;
/** Cards on a sheet to print: as many as are asked for, up to this many at a time. */
export const SHEET_MAX = 60;
export const SHEET_DEFAULT = 30;
/** Cards that fit a page of the sheet: two across and three down. */
export const PER_PAGE = 6;

/** A way of calling the pieces is offered where this share of them can be called that way; the rest come by their names. */
export const HOW_SHARE = 0.75;

/**
 * Pieces a card of a size asks of its map: a third more than it has cells. With fewer, every card would
 * hold nearly all of them and everybody would call at once.
 */
export const needOf = (size: number): number => Math.ceil((size * size * 4) / 3);
/** The fewest pieces a bingo can be played with: those of its smallest card. */
export { BINGO_MIN };

export const isSize = (x: unknown): x is BingoSize => (BINGO_SIZES as readonly unknown[]).includes(x);
export const isHow = (x: unknown): x is BingoHow => (BINGO_HOWS as readonly unknown[]).includes(x);

/** What is asked of a piece here: what it is, how it is drawn, and whether it has a capital and a flag. */
export type Piece = Pick<Item, 'id' | 'kind' | 'shape' | 'capital'> & { country: { fl?: string } };

/** Whether a piece can be called a given way: a flag is of a country, an outline of what has a surface. */
export function callable(item: Piece, how: BingoHow): boolean {
  if (how === 'flag') return item.kind === 'country' && !!item.country.fl;
  if (how === 'capital') return !!item.capital?.length;
  if (how === 'outline') return item.shape === 'area';
  return true;
}

/**
 * The pieces a bingo is played with: those of the map, or of the list where the game has one. In the order
 * of their ids, whatever order the map was built in and whatever the language: the cards are dealt from
 * this list, and have to be the same on every device.
 */
export function poolOf<T extends { id: string }>(items: readonly T[], only?: readonly string[]): T[] {
  const list = only ? new Set(only) : null;
  return items.filter((it) => !list || list.has(it.id)).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** How many of the pieces cannot be called a given way: those come by their names. */
export const gapsOf = (pool: readonly Piece[], how: BingoHow): number => pool.filter((it) => !callable(it, how)).length;

/** The ways the pieces of a bingo can be called: those that most of them can be called by. */
export function howsOf(pool: readonly Piece[]): BingoHow[] {
  return BINGO_HOWS.filter((how) => pool.length > 0 && pool.length - gapsOf(pool, how) >= pool.length * HOW_SHARE);
}

/** The sizes of card a map with that many pieces can have. */
export const sizesOf = (pieces: number): BingoSize[] => BINGO_SIZES.filter((size) => needOf(size) <= pieces);

/** The size a bingo is played with: the one wanted where the map has pieces for it, or else the largest it has pieces for. Null when it has pieces for none. */
export function sizeFor(pieces: number, wanted: number): BingoSize | null {
  const sizes = sizesOf(pieces);
  if (!sizes.length) return null;
  return sizes.find((s) => s === wanted) ?? sizes.filter((s) => s < wanted).pop() ?? sizes[0];
}

/**
 * The card with a number: which pieces it has, row after row. The same for the same pieces, size and
 * number, for ever: a card that was printed has to be the card its number deals. `pool` is the ids of
 * the pieces in their order (`poolOf`).
 */
export function cardOf(pool: readonly string[], size: number, n: number): string[] {
  return sample(pool, size * size, mulberry32(hashStr(`bingo ${n} ${size} ${pool.join(' ')}`)));
}

/** The lines of a card, each as the cells it is made of: its rows, its columns and its two diagonals. */
export function linesOf(size: number): number[][] {
  const across = Array.from({ length: size }, (_, i) => i);
  return [
    ...across.map((r) => across.map((c) => r * size + c)),
    ...across.map((c) => across.map((r) => r * size + c)),
    across.map((i) => i * size + i),
    across.map((i) => (size - 1 - i) * size + i),
  ];
}

/** What a line is called: "la fila 2", "la columna 3", or one of the two diagonals by which way it goes from the left. */
export function lineName(size: number, index: number): string {
  if (index < size) return L(`la fila ${index + 1}`, `row ${index + 1}`);
  if (index < size * 2) return L(`la columna ${index - size + 1}`, `column ${index - size + 1}`);
  return index === size * 2 ? L('la diagonal que baja', 'the diagonal going down') : L('la diagonal que sube', 'the diagonal going up');
}

export interface Verdict {
  /** Which cells are marked, row after row. */
  marked: boolean[];
  /** The lines that are complete, as their places in `linesOf`. */
  lines: number[];
  /** Whether every cell is marked. */
  full: boolean;
  /** Cells still to be marked. */
  left: number;
}

/** How a card stands with some cells marked. */
export function judgeMarks(marked: readonly boolean[], size: number): Verdict {
  const cells = Array.from({ length: size * size }, (_, i) => !!marked[i]);
  const lines = linesOf(size).flatMap((line, i) => (line.every((cell) => cells[cell]) ? [i] : []));
  const left = cells.filter((m) => !m).length;
  return { marked: cells, lines, full: left === 0, left };
}

/** How a card stands against what has come out: the truth of it, whatever its player has marked. */
export const judge = (card: readonly string[], out: ReadonlySet<string>, size: number): Verdict => judgeMarks(card.map((id) => out.has(id)), size);

/** What a verdict is, in one word: a full card, a line or more, or nothing to call yet. */
export const callOf = (v: Verdict): 'bingo' | 'line' | 'none' => (v.full ? 'bingo' : v.lines.length ? 'line' : 'none');

/** The verdict of a check, said to whoever asked: what the card has, and what it lacks. */
export function verdictText(v: Verdict, size: number, n: number): string {
  const cells = size * size;
  if (v.full) return L(`El cartón ${n} tiene sus ${cells} casillas.`, `Card ${n} has its ${cells} cells.`);
  const lacks = L(v.left === 1 ? 'Le falta 1 casilla para el bingo.' : `Le faltan ${v.left} casillas para el bingo.`, v.left === 1 ? 'It is 1 cell short of bingo.' : `It is ${v.left} cells short of bingo.`);
  if (v.lines.length) {
    const names = listed(
      v.lines.map((i) => lineName(size, i)),
      L('y', 'and'),
    );
    return `${L(v.lines.length === 1 ? `El cartón ${n} tiene completa ${names}.` : `El cartón ${n} tiene completas ${names}.`, `Card ${n} has ${names} complete.`)} ${lacks}`;
  }
  return L(`El cartón ${n} no tiene ninguna línea completa: lleva ${cells - v.left} de ${cells} casillas.`, `Card ${n} has no complete line: ${cells - v.left} of its ${cells} cells have come out.`);
}

/** The next piece out of the drum: any of those that have not come out, each as likely as the next. Null when all are out. */
export function drawNext(pool: readonly string[], out: readonly string[], rnd: Rng = Math.random): string | null {
  const gone = new Set(out);
  const left = pool.filter((id) => !gone.has(id));
  return left.length ? left[Math.floor(rnd() * left.length)] : null;
}

/** A number for the card of a phone that has none. */
export const ownCard = (rnd: Rng = Math.random): number => CARD_OWN + Math.floor(rnd() * (CARD_MAX - CARD_OWN + 1));

/** How wide a word is written, in letters of the usual width: an "m" or a capital takes more than one, an "i" or an "l" less. */
function inkOf(word: string): number {
  let ink = 0;
  for (const ch of word) ink += /[mwMWæœ]/.test(ch) ? 1.5 : /[ijlrtfIíìïî.,'’·]/.test(ch) ? 0.6 : ch !== ch.toLowerCase() ? 1.25 : 1;
  return ink;
}

/** How small a name has to be written to fit the cell of a card: 0 as it comes, up to 3 for the longest. */
export function tightOf(name: string): 0 | 1 | 2 | 3 {
  // A word is not cut where it can be helped: the widest one says how large the letters can be. Several
  // short words take lines instead, and the length of the whole name counts for that.
  const word = Math.max(...name.split(/[\s-]+/).map(inkOf));
  return word > 10.5 || name.length > 26 ? 3 : word > 9 || name.length > 18 ? 2 : word > 7.6 || name.length > 12 ? 1 : 0;
}

/** Whose cards an address is for: one card, a sheet of them, or a card for whoever opens it. */
export type Who = { kind: 'card'; n: number } | { kind: 'sheet'; from: number; to: number } | { kind: 'own' };

export interface Bingo {
  who: Who;
  size: BingoSize;
  what: EmbedWhat;
  /** What follows the number in the address: the bingo, whoever's card it is. */
  key: string;
}

const NUMBER = /^[1-9]\d{0,4}$/;

function parseWho(text: string): Who | null {
  if (text === '-') return { kind: 'own' };
  if (NUMBER.test(text)) return { kind: 'card', n: Number(text) };
  const [a, b, more] = text.split('-');
  if (more != null || !NUMBER.test(a ?? '') || !NUMBER.test(b ?? '')) return null;
  const from = Number(a);
  // A sheet is so many cards at most: one that asks for more is cut where it has to end.
  return Number(b) < from ? null : { kind: 'sheet', from, to: Math.min(Number(b), from + SHEET_MAX - 1) };
}

/** What follows `bingo/` in an address, read; null when it is not the address of a card. */
export function parseBingo(rest: string): Bingo | null {
  const [whose, side, ...map] = rest.split('/');
  const who = parseWho(whose ?? '');
  const size = /^\d$/.test(side ?? '') ? Number(side) : 0;
  if (!who || !isSize(size) || map.length < 2) return null;
  // The map is written as it is for a game inside another page; of the options of a game there are none here.
  if (map[map.length - 1].includes('=')) return null;
  const what = parseEmbed(map.join('/'));
  return what ? { who, size, what, key: `${size}/${map.join('/')}` } : null;
}

/** The map of a game as the address of its cards writes it: the list, where the game is played with one. */
export function sourceOf(cfg: Pick<GameConfig, 'section' | 'countries' | 'levels' | 'opts' | 'only' | 'list'>): EmbedSource {
  const cities = cfg.section === 'cities' ? { cityPick: cfg.opts.cityPick, cityCount: cfg.opts.cityCount } : {};
  if (cfg.list != null && cfg.only) return { list: encodeList({ id: '', name: cfg.list, section: cfg.section, countries: cfg.countries, levels: cfg.levels, ids: cfg.only, ...cities }) };
  return { section: cfg.section, link: { ids: cfg.countries, levels: cfg.section === 'regions' ? cfg.levels : {}, ...cities } };
}

/** The map of a bingo as its address writes it: `regiones/ES:f`, `lista/<code>`. A game is kept under it (lib/bingoKept.ts). */
export function mapPathOf(source: EmbedSource): string {
  if ('list' in source) return `${LIST_PATH}/${source.list}`;
  // Which cities a map has is written after its game: there, and only there, the game is named.
  return `${PATHS[source.section]}/${mapLinkRest(source.section, { ...source.link, mode: source.section === 'cities' ? 'bingo' : undefined })}`;
}

/** What follows the number in the address of the cards of a bingo. */
export const bingoKey = (size: BingoSize, source: EmbedSource): string => `${size}/${mapPathOf(source)}`;

/** What follows `#/` in the address of a card (`7`), of a sheet of them (`1-30`) or of a card for whoever opens it (`-`). */
export const bingoPath = (who: string | number, key: string): string => `${BINGO_PATH}/${who}/${key}`;

/** The whole address, to be sent or shown as a QR code. */
export const bingoUrl = (who: string | number, key: string, href?: string): string => linkTo(bingoPath(who, key), href);

/**
 * The map the cards of an address are dealt from, checked against what the atlas has; null when nothing is
 * left of it. It is the game the screen that calls was started with: the same map gives the same pieces.
 */
export function bingoGame(what: EmbedWhat, world: World): { cfg: Omit<GameConfig, 'nonce'>; title: string } | null {
  const game = embedGame(what, world);
  return game ? { cfg: { ...game.cfg, mode: 'bingo' }, title: game.title } : null;
}

/** How the pieces are called, as a choice says it. */
export function howName(how: BingoHow): string {
  switch (how) {
    case 'flag':
      return L('Bandera', 'Flag');
    case 'capital':
      return L('Capital', 'Capital');
    case 'outline':
      return L('Silueta', 'Outline');
    case 'name':
      return L('Nombre', 'Name');
    default:
      return L('En el mapa', 'On the map');
  }
}
