/**
 * The colours the maps are drawn in. Only the map changes: sea, land, borders and the halo of the names;
 * the colours of a right or a wrong answer stay what they are (those are the colour-blind setting).
 * Each palette has its light and its dark side, in styles.css under `:root[data-map='…']`.
 */
import { L } from './i18n';

export const PALETTES = ['paper', 'ocean', 'slate'] as const;
export type Palette = (typeof PALETTES)[number];

/** The one the game ships with: warm paper and a pale sea. It needs no attribute on the page. */
export const PALETTE_DEFAULT: Palette = 'paper';

export const isPalette = (x: unknown): x is Palette => typeof x === 'string' && (PALETTES as readonly string[]).includes(x);

export function paletteName(p: Palette): string {
  if (p === 'ocean') return L('Océano', 'Ocean');
  if (p === 'slate') return L('Pizarra', 'Slate');
  return L('Papel', 'Paper');
}

/** What each one looks like, for whoever cannot see the sample next to its name. */
export function paletteHint(p: Palette): string {
  if (p === 'ocean') return L('Mar azul y tierra clara, como en un atlas.', 'Blue sea and pale land, as in an atlas.');
  if (p === 'slate') return L('Grises neutros, sin tinte.', 'Neutral greys, with no tint.');
  return L('Papel cálido y mar verdoso: la de siempre.', 'Warm paper and a greenish sea: the usual one.');
}

/** Puts the palette on the page, where the styles read it. */
export function applyPalette(p: Palette, root: HTMLElement = document.documentElement): void {
  if (p === PALETTE_DEFAULT) delete root.dataset.map;
  else root.dataset.map = p;
}
