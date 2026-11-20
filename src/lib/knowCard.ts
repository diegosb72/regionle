/**
 * "My map of the world": the map of what the player knows (Progress), as a picture to save or to send. It is
 * drawn on a canvas in the player's own browser, like the picture of a result (shareCard.ts), whose frame,
 * colours and typefaces it shares. Nothing is asked of any server and nothing is sent anywhere.
 */
import { makeView } from './geo';
import type { Grade } from './review';
import { CARD_COLOURS as C, CARD_MARGIN as M, CARD_SANS as SANS, CARD_SERIF as SERIF, CARD_SIZE, drawable, fit, paintBrand, pictureBlob, roundedPath, type Pen } from './shareCard';
import type { Deck } from './types';

/** The grades in the order they are told: what is known first, what has not been seen last. */
export const KNOW_GRADES: readonly Grade[] = ['known', 'learning', 'due', 'new'];

export interface KnowCardInfo {
  /** "Lo que ya me sé" · "Lo que ya me sé · Capitales": written in capitals. */
  kicker: string;
  /** "Mi mapa del mundo" · "España · provincias" */
  title: string;
  /** How many pieces of the map there are of each grade. */
  counts: Record<Grade, number>;
  /** What follows the number of the known ones: "de 198 países". */
  of: string;
  /** Each grade as the legend says it: "sabidos", "aprendiendo", "toca repasar", "sin ver". */
  names: Record<Grade, string>;
  /** The day the picture is of: "20 de noviembre de 2026". */
  day: string;
  /** The address of the game, as it is read: "diegosb72.github.io/regionle". */
  site: string;
  /** The colours of those who do not tell green from red, as the game paints the map for them. */
  cb?: boolean;
}

export interface KnowPiece {
  id: string;
  d: string;
  grade: Grade;
  /** Where it is, and how large: the larger side of its box. Too small to be seen, it gets a ring there. */
  x: number;
  y: number;
  size: number;
}

/** The map as it is drawn: its pieces and the box they take up, in the units of the map. */
export interface KnowArt {
  pieces: KnowPiece[];
  /** The rest of the land, which is never asked: drawn muted, so that the map is whole. */
  around: string[];
  box: [number, number, number, number];
  /**
   * Whether the whole planet is shown. The land around is then cut at the box of the pieces: what lies
   * beyond it is Antarctica, of which only a sliver would show at the foot of the picture.
   */
  whole: boolean;
}

// The colours of the map in the light theme (src/styles.css): a piece that is due, and the land that is not asked.
const DUE = '#f19a55';
const AROUND = '#ebe4d5';
const AROUND_LINE = '#d5cbb7';
// And those of the palette for colour blindness.
const CB = { known: '#74b9ea', learning: '#f0e442', due: '#cc79a7' };

/** The colour of a piece by how well it is known, as the map of the game paints it. */
export function gradeFill(grade: Grade, cb = false): string {
  if (grade === 'known') return cb ? CB.known : C.mapOk;
  if (grade === 'learning') return cb ? CB.learning : C.mapWarn;
  if (grade === 'due') return cb ? CB.due : DUE;
  return C.land;
}

/**
 * The map of a deck as the game frames it, each piece with its grade. A piece is measured as the game
 * measures it (MapView): by the points its own frame is made of, which leave its far-off islands out.
 */
export function knowArt(deck: Deck, grades: ReadonlyMap<string, Grade>): KnowArt {
  const view = makeView(deck.frame);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const pieces: KnowPiece[] = [];
  for (const it of deck.items) {
    const d = view.path(it.geo);
    if (!d) continue;
    const [[a, b], [c, e]] = view.path.bounds(it.geo);
    if (a < x0) x0 = a;
    if (b < y0) y0 = b;
    if (c > x1) x1 = c;
    if (e > y1) y1 = e;
    let [px0, py0, px1, py1] = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of it.fp) {
      const q = view.projection(p);
      if (!q) continue;
      if (q[0] < px0) px0 = q[0];
      if (q[0] > px1) px1 = q[0];
      if (q[1] < py0) py0 = q[1];
      if (q[1] > py1) py1 = q[1];
    }
    const at = view.projection(it.lp) ?? [(px0 + px1) / 2, (py0 + py1) / 2];
    pieces.push({ id: it.id, d, grade: grades.get(it.id) ?? 'new', x: at[0], y: at[1], size: Number.isFinite(px0) ? Math.max(px1 - px0, py1 - py0, 0.02) : 0.02 });
  }
  const tight: KnowArt['box'] = [Math.max(x0, view.box[0]), Math.max(y0, view.box[1]), Math.min(x1, view.box[2]), Math.min(y1, view.box[3])];
  const sound = tight.every(Number.isFinite) && tight[2] - tight[0] > 1 && tight[3] - tight[1] > 1;
  const around: string[] = [];
  for (const geo of deck.context) {
    const d = view.path(geo);
    if (d) around.push(d);
  }
  return { pieces, around, box: sound ? tight : view.box, whole: view.world };
}

/** Where the map goes on the picture. */
export const KNOW_MAP = { x: M, y: 266, w: CARD_SIZE - 2 * M, h: 452 };
/** A piece smaller than this on the picture gets a ring, as on the screen; and how large the ring is. */
export const KNOW_RING_BELOW = 13;
export const KNOW_RING = 8;

/** How high the ring of a speck lies among the others: what has not been seen at the bottom, what is known on top. */
const RANK: Record<Grade, number> = { new: 0, learning: 1, due: 2, known: 3 };

/**
 * Draws a map in a frame of the picture: the land around, muted; each piece in the colour `fill` gives it;
 * and a ring of that colour on each piece too small to be seen, those of higher `rank` over the others (a
 * piece ranked below zero gets no ring). The map of what is known and a map painted by hand (handCard.ts)
 * are drawn alike.
 */
export function paintArt(pen: Pen, art: KnowArt, make: (d: string) => Path2D, fill: (piece: KnowPiece) => string, rank: (piece: KnowPiece) => number, frame: { x: number; y: number; w: number; h: number } = KNOW_MAP): void {
  const { x, y, w, h } = frame;
  const [x0, y0, x1, y1] = art.box;
  const pad = 22;
  const k = Math.min((w - 2 * pad) / Math.max(1, x1 - x0), (h - 2 * pad) / Math.max(1, y1 - y0));
  const ox = x + w / 2 - ((x0 + x1) / 2) * k;
  const oy = y + h / 2 - ((y0 + y1) / 2) * k;
  pen.save();
  pen.translate(ox, oy);
  pen.scale(k, k);
  pen.lineJoin = 'round';
  pen.fillStyle = AROUND;
  pen.strokeStyle = AROUND_LINE;
  pen.lineWidth = 1.2 / k;
  pen.save();
  if (art.whole) {
    pen.beginPath();
    pen.moveTo(x0, y0);
    pen.lineTo(x1, y0);
    pen.lineTo(x1, y1);
    pen.lineTo(x0, y1);
    pen.closePath();
    pen.clip();
  }
  for (const d of art.around) {
    const p = make(d);
    pen.fill(p);
    pen.stroke(p);
  }
  pen.restore();
  pen.strokeStyle = C.border;
  pen.lineWidth = 1.4 / k;
  for (const piece of art.pieces) {
    const p = make(piece.d);
    pen.fillStyle = fill(piece);
    pen.fill(p);
    pen.stroke(p);
  }
  pen.restore();
  // The specks, each with its ring: the lowest first, so that the others lie on top of them.
  const small = art.pieces.filter((p) => rank(p) >= 0 && p.size * k < KNOW_RING_BELOW && Number.isFinite(p.x) && Number.isFinite(p.y)).sort((a, b) => rank(a) - rank(b));
  pen.strokeStyle = C.border;
  pen.lineWidth = 1.6;
  for (const p of small) {
    roundedPath(pen, ox + p.x * k - KNOW_RING, oy + p.y * k - KNOW_RING, 2 * KNOW_RING, 2 * KNOW_RING, KNOW_RING);
    pen.fillStyle = fill(p);
    pen.fill();
    pen.stroke();
  }
}

/** Draws the picture. Everything it needs has been fetched before: it does not wait for anything. */
export function paintKnowCard(pen: Pen, info: KnowCardInfo, extras: { art?: KnowArt | null; path?: (d: string) => Path2D } = {}): void {
  const S = CARD_SIZE;
  const width = S - 2 * M;
  const cb = !!info.cb;
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

  // The map: the sea, and on it whatever there is to draw.
  const { x, y, w, h } = KNOW_MAP;
  pen.save();
  roundedPath(pen, x, y, w, h, 28);
  pen.fillStyle = C.sea;
  pen.fill();
  pen.clip();
  if (extras.art && extras.path && extras.art.pieces.length) paintArt(pen, extras.art, extras.path, (p) => gradeFill(p.grade, cb), (p) => RANK[p.grade]);
  pen.restore();

  // How many are known, large; what they are out of, small.
  const base = 838;
  pen.fillStyle = C.brand;
  pen.font = `540 112px ${SERIF}`;
  const known = String(info.counts.known);
  pen.fillText(known, M - 4, base);
  const after = M - 4 + pen.measureText(known).width + 18;
  pen.fillStyle = C.ink3;
  const of = fit(pen, info.of, (px) => `440 ${px}px ${SERIF}`, S - M - after, 44, 22, 1);
  pen.fillText(of.lines[0] ?? '', after, base);

  // The same in a bar: each grade takes the share of it that is its share of the map.
  const total = KNOW_GRADES.reduce((n, g) => n + Math.max(0, info.counts[g]), 0);
  const [by, bh] = [862, 20];
  pen.save();
  roundedPath(pen, M, by, width, bh, bh / 2);
  pen.fillStyle = C.land;
  pen.fill();
  pen.clip();
  let bx = M;
  for (const g of KNOW_GRADES) {
    if (g === 'new' || total <= 0 || info.counts[g] <= 0) continue;
    const part = (width * info.counts[g]) / total;
    pen.fillStyle = gradeFill(g, cb);
    pen.fillRect(bx, by, part, bh);
    bx += part;
  }
  pen.restore();
  pen.strokeStyle = C.border;
  pen.lineWidth = 1.5;
  roundedPath(pen, M, by, width, bh, bh / 2);
  pen.stroke();

  // The legend: a square of each colour, how many there are and what they are, at the largest letter the four fit at.
  const [SW, GAP, BETWEEN] = [22, 10, 30];
  const bold = (px: number) => `700 ${px}px ${SANS}`;
  const plain = (px: number) => `500 ${px}px ${SANS}`;
  const measure = (font: string, text: string): number => {
    pen.font = font;
    return pen.measureText(text).width;
  };
  const span = (px: number): number => KNOW_GRADES.reduce((sum, g, i) => sum + (i ? BETWEEN : 0) + SW + GAP + measure(bold(px), String(info.counts[g])) + 8 + measure(plain(px), info.names[g]), 0);
  let px = 26;
  while (px > 16 && span(px) > width) px--;
  const mid = 922;
  let lx = M;
  pen.textBaseline = 'middle';
  for (const g of KNOW_GRADES) {
    roundedPath(pen, lx, mid - SW / 2, SW, SW, 6);
    pen.fillStyle = gradeFill(g, cb);
    pen.fill();
    pen.strokeStyle = C.border;
    pen.lineWidth = 1.5;
    pen.stroke();
    lx += SW + GAP;
    const n = String(info.counts[g]);
    pen.fillStyle = C.ink;
    pen.font = bold(px);
    pen.fillText(n, lx, mid + 1);
    lx += pen.measureText(n).width + 8;
    pen.fillStyle = C.ink2;
    pen.font = plain(px);
    pen.fillText(info.names[g], lx, mid + 1);
    lx += pen.measureText(info.names[g]).width + BETWEEN;
  }

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
export async function knowCardBlob(info: KnowCardInfo, deck: Deck, grades: ReadonlyMap<string, Grade>): Promise<Blob> {
  if (typeof Path2D !== 'function' || !drawable(deck)) throw new Error('map');
  const art = knowArt(deck, grades);
  return pictureBlob((pen) => paintKnowCard(pen, info, { art, path: (d) => new Path2D(d) }));
}
