/**
 * A map painted by hand (hand.ts), as a picture to save or to send: the map with each piece in the colour
 * the player gave it, and a legend that says what each colour stands for and how many pieces have it. It is
 * drawn in the player's own browser, with the frame of the other pictures of the game (shareCard.ts) and
 * the map as the picture of what is known draws it (knowCard.ts).
 */
import { HAND_COLOURS, handColour, type HandRow } from './hand';
import { knowArt, paintArt, type KnowArt } from './knowCard';
import { CARD_COLOURS as C, CARD_MARGIN as M, CARD_SANS as SANS, CARD_SERIF as SERIF, CARD_SIZE, drawable, fit, paintBrand, pictureBlob, roundedPath, type Pen } from './shareCard';
import type { Deck } from './types';

export interface HandCardInfo {
  /** "Pintado a mano": written in capitals. */
  kicker: string;
  /** The map: "Países de Europa" · "España · provincias". */
  title: string;
  /** The colours in use, in the order of the palette. */
  rows: HandRow[];
  /** Each colour as the legend calls it when the player has not said what it stands for: "Naranja". */
  names: string[];
  /** The day the picture is of: "20 de noviembre de 2026". */
  day: string;
  /** The address of the game, as it is read: "diegosb72.github.io/regionle". */
  site: string;
}

/** The legend: two columns, each colour in use in its turn; three rows at most. */
export const HAND_LEGEND = { pitch: 46, gap: 32, square: 26, above: 40 };
/** The rows the legend of so many colours takes. */
export const legendRows = (colours: number): number => Math.max(1, Math.ceil(Math.min(colours, HAND_COLOURS.length) / 2));
/**
 * Where the map goes on the picture: under the title, and down to where the legend starts. The fewer rows
 * the legend takes, the taller the map: it is what the picture is of.
 */
export function handFrame(colours: number): { x: number; y: number; w: number; h: number } {
  return { x: M, y: 266, w: CARD_SIZE - 2 * M, h: 520 + (3 - legendRows(colours)) * HAND_LEGEND.pitch };
}

/** The colour of a piece of the picture: the one it was painted with, or that of the land. */
export const handFill = (colour: number | undefined): string => handColour(colour)?.hex ?? C.land;

/** Draws the picture. Everything it needs has been fetched before: it does not wait for anything. */
export function paintHandCard(pen: Pen, info: HandCardInfo, extras: { art?: KnowArt | null; path?: (d: string) => Path2D; fills?: Record<string, number> } = {}): void {
  const S = CARD_SIZE;
  const width = S - 2 * M;
  pen.fillStyle = C.bg;
  pen.fillRect(0, 0, S, S);
  paintBrand(pen);

  pen.textAlign = 'left';
  pen.textBaseline = 'alphabetic';
  pen.fillStyle = C.accentInk;
  const kicker = fit(pen, info.kicker.toUpperCase(), (px) => `700 ${px}px ${SANS}`, width, 26, 18, 1);
  pen.fillText(kicker.lines[0] ?? '', M, 182);
  pen.fillStyle = C.ink;
  const title = fit(pen, info.title, (px) => `520 ${px}px ${SERIF}`, width, 58, 30, 1);
  pen.fillText(title.lines[0] ?? '', M, 244);

  // The map: the sea, and on it the land with what has been painted. A speck gets its ring only when it is
  // painted: the rings of all the others would say nothing, and there are dozens of them on a map of the world.
  const frame = handFrame(info.rows.length);
  const { x, y, w, h } = frame;
  const fills = extras.fills ?? {};
  pen.save();
  roundedPath(pen, x, y, w, h, 28);
  pen.fillStyle = C.sea;
  pen.fill();
  pen.clip();
  if (extras.art && extras.path && extras.art.pieces.length)
    paintArt(
      pen,
      extras.art,
      extras.path,
      (p) => handFill(fills[p.id]),
      (p) => (handColour(fills[p.id]) ? 0 : -1),
      frame,
    );
  pen.restore();

  // The legend: a square of each colour in use, how many pieces have it and what it stands for.
  const { pitch, gap, square, above } = HAND_LEGEND;
  const top = y + h + above;
  const column = (width - gap) / 2;
  pen.textBaseline = 'middle';
  info.rows.slice(0, HAND_COLOURS.length).forEach((row, i) => {
    const lx = M + (i % 2) * (column + gap);
    const mid = top + Math.floor(i / 2) * pitch;
    roundedPath(pen, lx, mid - square / 2, square, square, 6);
    pen.fillStyle = handFill(row.colour);
    pen.fill();
    pen.strokeStyle = C.border;
    pen.lineWidth = 1.5;
    pen.stroke();
    const count = String(row.count);
    pen.fillStyle = C.ink;
    pen.font = `700 26px ${SANS}`;
    pen.fillText(count, lx + square + 12, mid + 1);
    const after = lx + square + 12 + pen.measureText(count).width + 10;
    pen.fillStyle = C.ink2;
    const label = fit(pen, row.label || info.names[row.colour - 1] || '', (px) => `500 ${px}px ${SANS}`, lx + column - after, 26, 16, 1);
    pen.fillText(label.lines[0] ?? '', after, mid + 1);
  });

  // Below: where to play, and the day.
  const foot = S - M;
  pen.textBaseline = 'alphabetic';
  pen.fillStyle = C.line;
  pen.fillRect(M, foot - 52, width, 2);
  pen.fillStyle = C.brand;
  pen.font = `650 28px ${SANS}`;
  pen.fillText(info.site, M, foot - 6);
  pen.textAlign = 'right';
  pen.fillStyle = C.ink2;
  pen.font = `500 26px ${SANS}`;
  pen.fillText(info.day, S - M, foot - 6);
  pen.textAlign = 'left';
}

/** The picture as a PNG file. With no map to draw there is no picture: the map is what it is of. */
export async function handCardBlob(info: HandCardInfo, deck: Deck, fills: Record<string, number>): Promise<Blob> {
  if (typeof Path2D !== 'function' || !drawable(deck)) throw new Error('map');
  const art = knowArt(deck, new Map());
  return pictureBlob((pen) => paintHandCard(pen, info, { art, path: (d) => new Path2D(d), fills }));
}
