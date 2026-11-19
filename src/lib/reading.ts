/**
 * How the game is read: the size of its letters, the contrast of its colours and the typeface of its texts.
 * Each choice is an attribute on the page, which the stylesheet reads (the end of styles.css):
 *
 *  · `data-text="l"` or `"xl"`: a larger letter. Every size in the stylesheets is multiplied by `--fs`.
 *  · `data-contrast="more"`: darker inks and lines that can be seen. Also when the device itself asks for
 *    more contrast, whatever the player has chosen here.
 *  · `data-font="dyslexia"`: Lexend for every text, with more room between letters and between words,
 *    and nothing in italics.
 *
 * What is printed (the blank map, the diploma) keeps its own letter: it is laid out for its paper.
 */
import { L } from './i18n';

export const TEXT_SIZES = ['m', 'l', 'xl'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];

/** The size the game ships with. It needs no attribute on the page. */
export const TEXT_SIZE_DEFAULT: TextSize = 'm';

/** How many times its usual size the letter is. The stylesheet says the same under `:root[data-text='…']`. */
export const TEXT_SCALE: Record<TextSize, number> = { m: 1, l: 1.15, xl: 1.3 };

export const isTextSize = (x: unknown): x is TextSize => typeof x === 'string' && (TEXT_SIZES as readonly string[]).includes(x);

export function textSizeName(t: TextSize): string {
  if (t === 'l') return L('Grande', 'Large');
  if (t === 'xl') return L('Muy grande', 'Very large');
  return L('Normal', 'Normal');
}

/** What the player has chosen. */
export interface Reading {
  textSize: TextSize;
  contrast: boolean;
  dyslexia: boolean;
}

/** What a device says when it asks for more contrast (a setting of the system, in most of them). */
export const CONTRAST_QUERY = '(prefers-contrast: more)';

/** Puts the choices on the page, where the styles read them. `device`: the device itself asks for more contrast. */
export function applyReading(r: Reading, device = false, root: HTMLElement = document.documentElement): void {
  if (r.textSize === TEXT_SIZE_DEFAULT) delete root.dataset.text;
  else root.dataset.text = r.textSize;
  if (r.contrast || device) root.dataset.contrast = 'more';
  else delete root.dataset.contrast;
  if (r.dyslexia) root.dataset.font = 'dyslexia';
  else delete root.dataset.font;
}

/** How much wider a name is in the typeface for dyslexia, with the room it leaves between letters. */
export const DYSLEXIA_WIDTH = 1.15;

/**
 * How many times its usual size a name written on the map is: the map counts on it when it decides which
 * names fit in their piece and which would sit on top of another.
 */
export function labelScale(r: Pick<Reading, 'textSize' | 'dyslexia'>): number {
  return TEXT_SCALE[r.textSize] * (r.dyslexia ? DYSLEXIA_WIDTH : 1);
}
