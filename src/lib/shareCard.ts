/**
 * A result as a picture to send, that of a daily challenge or of any game: drawn on a canvas in the
 * player's own browser, from what is already on the screen. Nothing is asked of any server and nothing is
 * sent anywhere.
 */
import { makeView } from './geo';
import { siteRoot } from './routes';
import type { Deck, Res } from './types';

/** Square: it is shown whole in chats and in social networks alike. */
export const CARD_SIZE = 1080;

export interface CardRow {
  name: string;
  /** How much of its bar is filled: 0 to 20, the points of a test, unless `of` says what it is out of. */
  points: number;
  of?: number;
  /** The colour of the bar when it does not follow from the points: the answers right, helped or missed of a game. */
  tone?: Res;
  /** What is written at the end of the line instead of the points: "1:32". */
  text?: string;
  /** False for a line with a figure and nothing to measure it against. */
  bar?: boolean;
}

export interface CardInfo {
  /** "Reto del 17 de noviembre de 2026" · "Regiones · Señalar" */
  kicker: string;
  /** The name in large letters: the country of the day, or the map a game was played on. */
  country: string;
  total: number;
  /** What follows the figure in small letters: "/ 100" unless said ("%"). */
  unit?: string;
  /** "¡Muy bien!" */
  verdict: string;
  rows: CardRow[];
  /** "3 días seguidos", or the day of a game; nothing when there is nothing to say. */
  streak: string | null;
  /** The address of the game, as it is read: "diegosb72.github.io/regionle". */
  site: string;
}

/**
 * A map: its pieces as paths, and the box they are drawn in. `tones`, one for each path, paints each piece
 * by how its answer went; a piece with none keeps the colour of the land.
 */
export interface CardArt {
  paths: string[];
  box: [number, number, number, number];
  tones?: (Res | undefined)[];
}

/** What the drawing needs from a canvas; a test can stand in for it. */
export type Pen = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'lineJoin'
  | 'lineCap'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'fillRect'
  | 'fillText'
  | 'measureText'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'arcTo'
  | 'bezierCurveTo'
  | 'closePath'
  | 'fill'
  | 'stroke'
  | 'save'
  | 'restore'
  | 'translate'
  | 'scale'
  | 'clip'
  | 'drawImage'
>;

export interface CardExtras {
  flag?: CanvasImageSource | null;
  art?: CardArt | null;
  /** Makes a path of the canvas from the `d` of an SVG path. */
  path?: (d: string) => Path2D;
}

// The colours of the light theme (src/styles.css): the picture is the same whatever theme the player uses.
const C = {
  bg: '#f4efe6',
  track: '#e6decd',
  line: '#dcd3c2',
  ink: '#1b2a2d',
  ink2: '#47575a',
  ink3: '#647170',
  brand: '#0f5c63',
  accent: '#e2572b',
  accentInk: '#ad3810',
  ok: '#2e8b57',
  warn: '#d6951a',
  bad: '#cf4527',
  sea: '#d8e6e3',
  land: '#fdf6e3',
  // A piece of a map by how its answer went, as the game paints it.
  mapOk: '#8fd1a9',
  mapWarn: '#f3cf6f',
  mapBad: '#f0957c',
  border: '#5c8b8f',
  cream: '#f6e7c8',
  mint: '#9fd3cd',
};
const SERIF = "'Fraunces Variable', 'Iowan Old Style', Georgia, serif";
const SANS = "'DM Sans Variable', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";
/** The typefaces the picture is written in: asked for before drawing, so that it is never drawn in another one. */
export const CARD_FONTS = [`520 64px ${SERIF}`, `italic 440 44px ${SERIF}`, `600 30px ${SANS}`, `700 30px ${SANS}`];

const M = 64;

/** The colour of a test, as on the summary: well, so-so or badly. */
export const rowColour = (points: number): string => (points >= 16 ? C.ok : points >= 8 ? C.warn : C.bad);
/** The colour of a kind of answer: right at once, with help, missed. */
export const toneColour = (tone: Res): string => (tone === 'ok' ? C.ok : tone === 'warn' ? C.warn : C.bad);
const pieceColour = (tone: Res | undefined): string => (tone === 'ok' ? C.mapOk : tone === 'warn' ? C.mapWarn : tone === 'bad' ? C.mapBad : C.land);

/** The address of the game as it is read out: "diegosb72.github.io/regionle". */
export function siteLabel(href?: string): string {
  return siteRoot(href)
    .replace(/^[a-z]+:\/\/(www\.)?/i, '')
    .replace(/\/(index\.html)?$/, '');
}

function rounded(pen: Pen, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  pen.beginPath();
  pen.moveTo(x + k, y);
  pen.arcTo(x + w, y, x + w, y + h, k);
  pen.arcTo(x + w, y + h, x, y + h, k);
  pen.arcTo(x, y + h, x, y, k);
  pen.arcTo(x, y, x + w, y, k);
  pen.closePath();
}

/** Breaks a text into lines no wider than `width`, at its spaces. */
export function wrap(pen: Pick<Pen, 'measureText'>, text: string, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const longer = line ? `${line} ${word}` : word;
    if (line && pen.measureText(longer).width > width) {
      lines.push(line);
      line = word;
    } else line = longer;
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The largest size, between `max` and `min`, at which the text fits in `width` on at most `rows` lines;
 * at the smallest one it is given as it falls, whatever lines it takes.
 */
export function fit(pen: Pick<Pen, 'measureText' | 'font'>, text: string, font: (px: number) => string, width: number, max: number, min: number, rows: number): { px: number; lines: string[] } {
  for (let px = max; px > min; px -= 2) {
    pen.font = font(px);
    const lines = wrap(pen, text, width);
    if (lines.length <= rows && lines.every((l) => pen.measureText(l).width <= width)) return { px, lines };
  }
  pen.font = font(min);
  return { px: min, lines: wrap(pen, text, width) };
}

/**
 * The map of a deck as the game frames it, drawn as large as it can be: the box is the one of the game
 * (which leaves far-off islands out of the first view), tightened to what the pieces really take up.
 * `tones` says how the answer about each piece went, for the picture of a game.
 */
export function artOf(deck: Deck, tones?: Record<string, Res>): CardArt {
  const view = makeView(deck.frame);
  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity];
  const paths: string[] = [];
  const painted: (Res | undefined)[] = [];
  for (const it of deck.items) {
    const [[a, b], [c, d]] = view.path.bounds(it.geo);
    if (a < x0) x0 = a;
    if (b < y0) y0 = b;
    if (c > x1) x1 = c;
    if (d > y1) y1 = d;
    const path = view.path(it.geo);
    if (!path) continue;
    paths.push(path);
    painted.push(tones?.[it.id]);
  }
  const tight: CardArt['box'] = [Math.max(x0, view.box[0]), Math.max(y0, view.box[1]), Math.min(x1, view.box[2]), Math.min(y1, view.box[3])];
  const sound = tight.every(Number.isFinite) && tight[2] - tight[0] > 1 && tight[3] - tight[1] > 1;
  return { paths, box: sound ? tight : view.box, ...(tones ? { tones: painted } : {}) };
}

/** Whether a deck is a map of surfaces, which is what a picture can show: a map of dots or of lines alone says little. */
export const drawable = (deck: Deck): boolean => deck.items.length > 0 && deck.items.every((it) => it.shape === 'area');

function brand(pen: Pen): void {
  const s = 68;
  pen.save();
  pen.translate(M, M - 6);
  pen.scale(s / 32, s / 32);
  pen.fillStyle = C.brand;
  rounded(pen, 0, 0, 32, 32, 8);
  pen.fill();
  const tile = (colour: string, pts: number[][]) => {
    pen.fillStyle = colour;
    pen.beginPath();
    pts.forEach(([x, y], i) => (i ? pen.lineTo(x, y) : pen.moveTo(x, y)));
    pen.closePath();
    pen.fill();
  };
  // The four tiles of the logo (index.html).
  tile(C.cream, [[7, 9.5], [15, 7], [15, 15.5], [7, 18]]);
  tile(C.accent, [[17, 7], [25, 9.5], [25, 17], [17, 15.5]]);
  tile(C.mint, [[7, 20.5], [15, 18], [15, 25], [7, 23.5]]);
  tile(C.cream, [[17, 18], [25, 19.5], [25, 23.5], [17, 25]]);
  pen.restore();

  pen.fillStyle = C.ink;
  pen.textAlign = 'left';
  pen.textBaseline = 'alphabetic';
  pen.font = `620 50px ${SERIF}`;
  const name = 'Regionle';
  const x = M + s + 18;
  pen.fillText(name, x, M + 45);
  // The ∞ of the name, drawn: not every typeface has a good one.
  const ix = x + pen.measureText(name).width + 16;
  const k = 2.1;
  pen.save();
  pen.translate(ix, M + 3);
  pen.scale(k, k);
  pen.strokeStyle = C.accent;
  pen.lineWidth = 2.6;
  pen.lineCap = 'round';
  pen.lineJoin = 'round';
  pen.beginPath();
  // Two loops that cross in the middle of a 24 × 24 box.
  pen.moveTo(12, 12);
  pen.bezierCurveTo(9.6, 8.6, 8.2, 8, 6, 8);
  pen.bezierCurveTo(0.7, 8, 0.7, 16, 6, 16);
  pen.bezierCurveTo(8.2, 16, 9.6, 15.4, 12, 12);
  pen.bezierCurveTo(14.4, 8.6, 15.8, 8, 18, 8);
  pen.bezierCurveTo(23.3, 8, 23.3, 16, 18, 16);
  pen.bezierCurveTo(15.8, 16, 14.4, 15.4, 12, 12);
  pen.stroke();
  pen.restore();
}

function map(pen: Pen, art: CardArt, make: (d: string) => Path2D, x: number, y: number, size: number): void {
  pen.save();
  rounded(pen, x, y, size, size, 28);
  pen.fillStyle = C.sea;
  pen.fill();
  pen.clip();
  const [x0, y0, x1, y1] = art.box;
  const pad = 34;
  const k = Math.min((size - 2 * pad) / Math.max(1, x1 - x0), (size - 2 * pad) / Math.max(1, y1 - y0));
  pen.translate(x + size / 2 - ((x0 + x1) / 2) * k, y + size / 2 - ((y0 + y1) / 2) * k);
  pen.scale(k, k);
  pen.strokeStyle = C.border;
  pen.lineWidth = 1.6 / k;
  pen.lineJoin = 'round';
  art.paths.forEach((d, i) => {
    const p = make(d);
    pen.fillStyle = pieceColour(art.tones?.[i]);
    pen.fill(p);
    pen.stroke(p);
  });
  pen.restore();
}

/** Draws the picture. Everything it needs has been fetched before: it does not wait for anything. */
export function paintCard(pen: Pen, info: CardInfo, extras: CardExtras = {}): void {
  const S = CARD_SIZE;
  pen.fillStyle = C.bg;
  pen.fillRect(0, 0, S, S);
  brand(pen);

  // The map on the right; the words take the whole width when there is none.
  const art = extras.art && extras.path && extras.art.paths.length ? extras.art : null;
  const MAP = 404;
  const top = 176;
  if (art) map(pen, art, extras.path!, S - M - MAP, top, MAP);
  const width = art ? S - 2 * M - MAP - 36 : S - 2 * M;

  pen.textAlign = 'left';
  pen.textBaseline = 'alphabetic';
  pen.fillStyle = C.accentInk;
  const kicker = fit(pen, info.kicker.toUpperCase(), (px) => `700 ${px}px ${SANS}`, width, 26, 18, 1);
  pen.fillText(kicker.lines[0] ?? '', M, top + 30);

  // The flag and the name of the country, which can be a long one.
  let y = top + 74;
  if (extras.flag) {
    const [fw, fh] = [84, 63];
    pen.save();
    rounded(pen, M, y, fw, fh, 8);
    pen.clip();
    // Most country icons are 4:3. The Afghan replacement is 2:1: fit it into the white plate
    // rather than stretching the shahada to the proportions of the other icons.
    const img = extras.flag as HTMLImageElement;
    const ratio = img.naturalWidth > 0 && img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : fw / fh;
    const w = Math.min(fw, fh * ratio);
    const h = w / ratio;
    pen.fillStyle = '#fff';
    pen.fillRect(M, y, fw, fh);
    pen.drawImage(extras.flag, M + (fw - w) / 2, y + (fh - h) / 2, w, h);
    pen.restore();
    pen.strokeStyle = C.line;
    pen.lineWidth = 2;
    rounded(pen, M, y, fw, fh, 8);
    pen.stroke();
    y += fh + 22;
  }
  pen.fillStyle = C.ink;
  const name = fit(pen, info.country, (px) => `520 ${px}px ${SERIF}`, width, 68, 38, 2);
  for (const line of name.lines) {
    y += name.px * 1.06;
    pen.fillText(line, M, y);
  }

  // The points, large; what they are out of, small.
  pen.fillStyle = C.brand;
  pen.font = `540 168px ${SERIF}`;
  const total = String(info.total);
  const base = Math.max(y + 168, top + MAP - 46);
  pen.fillText(total, M - 6, base);
  const after = M - 6 + pen.measureText(total).width + 18;
  pen.fillStyle = C.ink3;
  pen.font = `440 46px ${SERIF}`;
  pen.fillText(info.unit ?? '/ 100', after, base);
  pen.fillStyle = C.accentInk;
  const verdict = fit(pen, info.verdict, (px) => `italic 440 ${px}px ${SERIF}`, width, 44, 30, 1);
  pen.fillText(verdict.lines[0] ?? '', M, base + 62);

  // One line for each test, or for each kind of answer: its name, a bar and its figure.
  const foot = S - M;
  const rowsTop = base + 108;
  const step = Math.min(64, (foot - 64 - rowsTop) / Math.max(1, info.rows.length));
  const barX = M + 440;
  const barW = S - M - 84 - barX;
  info.rows.forEach((row, i) => {
    const mid = rowsTop + step * i + step / 2;
    pen.textBaseline = 'middle';
    pen.textAlign = 'left';
    pen.fillStyle = C.ink;
    const label = fit(pen, row.name, (px) => `600 ${px}px ${SANS}`, 420, 30, 20, 1);
    pen.fillText(label.lines[0] ?? '', M, mid);
    if (row.bar !== false) {
      pen.fillStyle = C.track;
      rounded(pen, barX, mid - 10, barW, 20, 10);
      pen.fill();
      const part = Math.max(0, Math.min(1, row.points / Math.max(1, row.of ?? 20)));
      if (part > 0) {
        pen.fillStyle = row.tone ? toneColour(row.tone) : rowColour(row.points);
        rounded(pen, barX, mid - 10, Math.max(20, barW * part), 20, 10);
        pen.fill();
      }
    }
    pen.textAlign = 'right';
    pen.fillStyle = C.ink;
    pen.font = `700 30px ${SANS}`;
    pen.fillText(row.text ?? String(row.points), S - M, mid);
  });

  // Below: where to play and, when there is one, the streak.
  pen.textBaseline = 'alphabetic';
  pen.fillStyle = C.line;
  pen.fillRect(M, foot - 52, S - 2 * M, 2);
  pen.textAlign = 'left';
  pen.fillStyle = C.brand;
  pen.font = `650 28px ${SANS}`;
  pen.fillText(info.site, M, foot - 6);
  if (info.streak) {
    pen.textAlign = 'right';
    pen.fillStyle = C.ink2;
    pen.font = `500 26px ${SANS}`;
    pen.fillText(info.streak, S - M, foot - 6);
  }
  pen.textAlign = 'left';
}

/**
 * A flag as something a canvas can draw. Its file says how it is proportioned but not how large it is,
 * and some browsers do not draw such a picture: the size is written into it first.
 */
async function loadFlag(url: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    let svg = await res.text();
    const open = /<svg\b[^>]*>/.exec(svg)?.[0];
    if (!open) return null;
    if (!/\swidth=/.test(open)) svg = svg.replace(open, open.replace(/^<svg\b/, '<svg width="640" height="480"'));
    const src = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    try {
      const img = new Image();
      img.decoding = 'async';
      await new Promise<void>((done, fail) => {
        img.onload = () => done();
        img.onerror = () => fail(new Error('flag'));
        img.src = src;
      });
      return img;
    } finally {
      // The picture has been read by now: the address is not needed any more.
      setTimeout(() => URL.revokeObjectURL(src), 30_000);
    }
  } catch {
    return null;
  }
}

/**
 * What another picture of the same family is drawn with (the map of what is known: knowCard.ts): the colours,
 * the typefaces, the margin, the name of the game at the top and a box with round corners.
 */
export { C as CARD_COLOURS, M as CARD_MARGIN, SANS as CARD_SANS, SERIF as CARD_SERIF, brand as paintBrand, rounded as roundedPath };

/** A picture of the size of the card as a PNG file: drawn by `paint`, once the typefaces it is written in are here. */
export async function pictureBlob(paint: (pen: CanvasRenderingContext2D) => void): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CARD_SIZE;
  const pen = canvas.getContext('2d');
  if (!pen) throw new Error('canvas');
  if (document.fonts) await Promise.all(CARD_FONTS.map((f) => document.fonts.load(f).catch(() => [])));
  paint(pen);
  return new Promise<Blob>((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('canvas'))), 'image/png'));
}

/** The picture as a PNG file. The flag and the map are left out when they cannot be had. */
export async function cardBlob(info: CardInfo, opts: { flagUrl?: string; deck?: Deck | null; tones?: Record<string, Res> } = {}): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = CARD_SIZE;
  const pen = canvas.getContext('2d');
  if (!pen) throw new Error('canvas');
  const [flag] = await Promise.all([opts.flagUrl ? loadFlag(opts.flagUrl) : null, ...(document.fonts ? CARD_FONTS.map((f) => document.fonts.load(f).catch(() => [])) : [])]);
  let art: CardArt | null = null;
  try {
    art = opts.deck && typeof Path2D === 'function' && drawable(opts.deck) ? artOf(opts.deck, opts.tones) : null;
  } catch {
    art = null;
  }
  paintCard(pen, info, { flag, art, path: (d) => new Path2D(d) });
  return new Promise<Blob>((done, fail) => canvas.toBlob((blob) => (blob ? done(blob) : fail(new Error('canvas'))), 'image/png'));
}
