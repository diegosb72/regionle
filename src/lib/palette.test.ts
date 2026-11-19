import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { setLang } from './i18n';
import { PALETTES, PALETTE_DEFAULT, applyPalette, isPalette, paletteHint, paletteName } from './palette';
import { mergeSaved, useStore } from './store';

afterEach(() => {
  setLang('es');
  useStore.getState().setPalette(PALETTE_DEFAULT);
});

describe('the palettes of the map', () => {
  it('are the usual one and two more, each with its name and what it is like in both languages', () => {
    expect(PALETTES).toEqual(['paper', 'ocean', 'slate']);
    expect(PALETTES.map(paletteName)).toEqual(['Papel', 'Océano', 'Pizarra']);
    for (const p of PALETTES) expect(paletteHint(p)).toMatch(/\.$/);
    setLang('en');
    expect(PALETTES.map(paletteName)).toEqual(['Paper', 'Ocean', 'Slate']);
    expect(new Set(PALETTES.map(paletteHint)).size).toBe(3);
  });

  it('tells a palette from anything else that may have been kept', () => {
    expect(isPalette('ocean')).toBe(true);
    expect(isPalette('paper')).toBe(true);
    expect(isPalette('sepia')).toBe(false);
    expect(isPalette(undefined)).toBe(false);
    expect(isPalette(1)).toBe(false);
  });

  it('is put on the page as an attribute, and the usual one as none', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyPalette('ocean', root);
    expect(root.dataset.map).toBe('ocean');
    applyPalette('slate', root);
    expect(root.dataset.map).toBe('slate');
    applyPalette('paper', root);
    expect('map' in root.dataset).toBe(false);
  });

  it('is kept with the rest of the settings, and anything unknown falls back to the usual one', () => {
    const now = useStore.getState();
    expect(now.palette).toBe('paper');
    expect(mergeSaved({}, now).palette).toBe('paper');
    expect(mergeSaved({ palette: 'slate' }, now).palette).toBe('slate');
    expect(mergeSaved({ palette: 'neon' }, now).palette).toBe('paper');
    now.setPalette('ocean');
    expect(useStore.getState().palette).toBe('ocean');
    now.setPalette('neon' as never);
    expect(useStore.getState().palette).toBe('paper');
  });

  it('has its colours in the stylesheet, light and dark, and a sample for the settings', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'src/styles.css'), 'utf8');
    for (const p of PALETTES) {
      expect(css).toContain(`.pal-${p} {`);
      expect(css).toContain(`:root[data-theme='dark'] .pal-${p} {`);
      if (p === PALETTE_DEFAULT) continue;
      for (const selector of [`:root[data-map='${p}'] {`, `:root[data-map='${p}'][data-theme='dark'] {`]) {
        const at = css.indexOf(selector);
        expect(at, selector).toBeGreaterThan(-1);
        const block = css.slice(at, css.indexOf('}', at));
        // Everything the map is drawn with, and nothing that an answer is marked with.
        for (const name of ['--sea', '--grat', '--land-ctx', '--land-ctx-line', '--land', '--land-hover', '--border', '--outline', '--lbl-halo']) expect(block, `${selector} ${name}`).toContain(`${name}:`);
        expect(block).not.toMatch(/--(m-)?(ok|warn|bad)/);
      }
    }
  });
});
