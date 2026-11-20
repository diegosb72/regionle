/**
 * A map painted by hand: in Explore, the player picks a colour and paints pieces with it — where they have
 * been, how they group them, whatever they like — and says, if they wish, what each colour stands for.
 * Each map has its own painting, kept in this browser (and in the backup), and it can be saved as a picture
 * (handCard.ts).
 */
import { HAND_PIECES_MAX, isHandColour, typedLabel, type HandMap } from './handKept';
import { L } from './i18n';

export * from './handKept';

/**
 * The colours to paint with. They are those of Okabe and Ito, which people who do not tell green from red
 * tell apart too: there is no second palette for them.
 */
export const HAND_COLOURS: readonly { hex: string; es: string; en: string }[] = [
  { hex: '#e69f00', es: 'naranja', en: 'orange' },
  { hex: '#56b4e9', es: 'azul claro', en: 'light blue' },
  { hex: '#009e73', es: 'verde', en: 'green' },
  { hex: '#f0e442', es: 'amarillo', en: 'yellow' },
  { hex: '#0072b2', es: 'azul', en: 'blue' },
  { hex: '#cc79a7', es: 'rosa', en: 'pink' },
];
/** What paints with nothing: it takes the colour off a piece. */
export const ERASER = 0;

/** A colour by its number, from 1; null for anything else. */
export const handColour = (n: unknown): { hex: string; es: string; en: string } | null => (isHandColour(n) ? HAND_COLOURS[n - 1] : null);
/** "naranja" · "orange" */
export const handColourName = (n: number): string => {
  const c = handColour(n);
  return c ? L(c.es, c.en) : '';
};

/**
 * The painting after the brush has touched a piece: the piece takes the colour of the brush, or loses its
 * own if it was that one already (a second touch undoes the first). The eraser takes whatever colour it has.
 * The same painting when nothing changes; null when there is no room for one more piece.
 */
export function brushed(map: HandMap | undefined, id: string, brush: number, now: number): HandMap | null {
  const was = map ?? { f: {}, l: {}, t: now };
  const has = was.f[id];
  if (!id || (brush !== ERASER && !handColour(brush))) return was;
  if (brush === ERASER || has === brush) {
    if (has == null) return was;
    const f = { ...was.f };
    delete f[id];
    return { ...was, f, t: now };
  }
  if (has == null && Object.keys(was.f).length >= HAND_PIECES_MAX) return null;
  return { ...was, f: { ...was.f, [id]: brush }, t: now };
}

/** The painting with what a colour stands for set to `text`; an empty text takes it away. */
export function labelled(map: HandMap | undefined, colour: number, text: string, now: number): HandMap {
  const was = map ?? { f: {}, l: {}, t: now };
  if (!handColour(colour)) return was;
  const label = typedLabel(text);
  if ((was.l[colour] ?? '') === label) return was;
  const l = { ...was.l };
  if (label) l[colour] = label;
  else delete l[colour];
  return { ...was, l, t: now };
}

export interface HandRow {
  colour: number;
  /** What the player says it stands for; empty when they have not said. */
  label: string;
  /** Pieces of the map painted with it. */
  count: number;
}

/**
 * The legend of a painting on a map: the colours in use on it, in the order of the palette, each with what
 * it stands for and how many pieces of the map have it. `has` says whether a piece is of the map: a painting
 * may hold pieces that the map no longer has.
 */
export function handLegend(map: HandMap | undefined, has: (id: string) => boolean): HandRow[] {
  if (!map) return [];
  const counts = new Map<number, number>();
  for (const [id, colour] of Object.entries(map.f)) if (has(id) && handColour(colour)) counts.set(colour, (counts.get(colour) ?? 0) + 1);
  return HAND_COLOURS.map((_, i) => i + 1)
    .filter((colour) => counts.has(colour))
    .map((colour) => ({ colour, label: (map.l[colour] ?? '').trim(), count: counts.get(colour)! }));
}
