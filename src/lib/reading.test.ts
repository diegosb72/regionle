import { afterEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { PREF_KEYS, cleanPrefs, prefsOf } from './backup';
import { setLang } from './i18n';
import { CONTRAST_QUERY, DYSLEXIA_WIDTH, TEXT_SCALE, TEXT_SIZES, TEXT_SIZE_DEFAULT, applyReading, isTextSize, labelScale, textSizeName } from './reading';
import { mergeSaved, useStore } from './store';

const ROOT = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8');
/** Every stylesheet of the game, by its path. */
const sheets = (dir = 'src'): string[] => fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? sheets(`${dir}/${e.name}`) : e.name.endsWith('.css') ? [`${dir}/${e.name}`] : []));
const css = read('src/styles.css');
/** The colours a block of the stylesheet sets, by the name of each. */
function block(selector: string): Record<string, string> {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, selector).toBeGreaterThan(-1);
  const body = css.slice(at, css.indexOf('}', at));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+):\s*(#[0-9a-f]{6})\s*;/g)].map((m) => [m[1], m[2]]));
}
/** How far apart two colours are, as the accessibility guidelines count it: from 1 (the same) to 21 (black on white). */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

afterEach(() => {
  setLang('es');
  const s = useStore.getState();
  s.setTextSize(TEXT_SIZE_DEFAULT);
  s.setContrast(false);
  s.setDyslexia(false);
});

describe('the size of the letter', () => {
  it('is the usual one and two larger, each with its name in both languages', () => {
    expect(TEXT_SIZES).toEqual(['m', 'l', 'xl']);
    expect(TEXT_SIZE_DEFAULT).toBe('m');
    expect(TEXT_SIZES.map(textSizeName)).toEqual(['Normal', 'Grande', 'Muy grande']);
    setLang('en');
    expect(TEXT_SIZES.map(textSizeName)).toEqual(['Normal', 'Large', 'Very large']);
    expect(TEXT_SCALE.m).toBe(1);
    expect(TEXT_SCALE.l).toBeGreaterThan(1);
    expect(TEXT_SCALE.xl).toBeGreaterThan(TEXT_SCALE.l);
  });

  it('tells a size from anything else that may have been kept', () => {
    expect(isTextSize('xl')).toBe(true);
    expect(isTextSize('m')).toBe(true);
    expect(isTextSize('xxl')).toBe(false);
    expect(isTextSize(1.3)).toBe(false);
    expect(isTextSize(undefined)).toBe(false);
  });

  it('is the same number here and in the stylesheet', () => {
    for (const size of TEXT_SIZES) {
      if (size === TEXT_SIZE_DEFAULT) continue;
      expect(css).toContain(`:root[data-text='${size}'] {\n  --fs: ${TEXT_SCALE[size]};\n}`);
    }
    // The usual size is the one the stylesheet starts from.
    expect(css).toMatch(/\n {2}--fs: 1;\n/);
  });

  it('multiplies every size written in the stylesheets, and none of what is printed', () => {
    const bare: string[] = [];
    for (const file of sheets()) {
      // The diploma is paper: its sizes are parts of its sheet.
      if (file.endsWith('/diploma.css')) continue;
      let text = read(file).replace(/\/\*[\s\S]*?\*\//g, '');
      // What is inside "@media print" is paper too.
      for (let at = text.indexOf('@media print'); at > -1; at = text.indexOf('@media print')) {
        let depth = 0;
        let end = text.indexOf('{', at);
        do {
          if (text[end] === '{') depth++;
          else if (text[end] === '}') depth--;
          end++;
        } while (depth && end < text.length);
        text = text.slice(0, at) + text.slice(end);
      }
      for (const m of text.matchAll(/(?<![\w-])(font-size|font)\s*:\s*([^;{}]+)/g)) {
        if (/\dpx/.test(m[2]) && !m[2].includes('var(--fs)')) bare.push(`${file}: ${m[0].trim()}`);
      }
    }
    expect(bare).toEqual([]);
  });

  it('makes the names on the map count on more room', () => {
    expect(labelScale({ textSize: 'm', dyslexia: false })).toBe(1);
    expect(labelScale({ textSize: 'xl', dyslexia: false })).toBe(TEXT_SCALE.xl);
    expect(labelScale({ textSize: 'm', dyslexia: true })).toBe(DYSLEXIA_WIDTH);
    expect(labelScale({ textSize: 'l', dyslexia: true })).toBeCloseTo(TEXT_SCALE.l * DYSLEXIA_WIDTH, 6);
    expect(DYSLEXIA_WIDTH).toBeGreaterThan(1);
  });
});

describe('how the game is read', () => {
  it('is put on the page as attributes, and the usual way as none', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyReading({ textSize: 'xl', contrast: true, dyslexia: true }, false, root);
    expect(root.dataset).toEqual({ text: 'xl', contrast: 'more', font: 'dyslexia' });
    applyReading({ textSize: 'l', contrast: false, dyslexia: true }, false, root);
    expect(root.dataset).toEqual({ text: 'l', font: 'dyslexia' });
    applyReading({ textSize: 'm', contrast: false, dyslexia: false }, false, root);
    expect(root.dataset).toEqual({});
  });

  it('gives more contrast to a device that asks for it, whatever is chosen here', () => {
    const root = { dataset: {} as Record<string, string> } as unknown as HTMLElement;
    applyReading({ textSize: 'm', contrast: false, dyslexia: false }, true, root);
    expect(root.dataset).toEqual({ contrast: 'more' });
    applyReading({ textSize: 'm', contrast: false, dyslexia: false }, false, root);
    expect(root.dataset).toEqual({});
    expect(CONTRAST_QUERY).toBe('(prefers-contrast: more)');
  });

  it('is kept with the rest of the settings, and anything unknown falls back to the usual way', () => {
    const now = useStore.getState();
    expect([now.textSize, now.contrast, now.dyslexia]).toEqual(['m', false, false]);
    expect(mergeSaved({}, now)).toMatchObject({ textSize: 'm', contrast: false, dyslexia: false });
    expect(mergeSaved({ textSize: 'xl', contrast: true, dyslexia: true }, now)).toMatchObject({ textSize: 'xl', contrast: true, dyslexia: true });
    expect(mergeSaved({ textSize: 'huge', contrast: 'yes', dyslexia: 1 } as never, now)).toMatchObject({ textSize: 'm', contrast: false, dyslexia: false });
    now.setTextSize('l');
    now.setContrast(true);
    now.setDyslexia(true);
    expect(useStore.getState()).toMatchObject({ textSize: 'l', contrast: true, dyslexia: true });
    now.setTextSize('huge' as never);
    expect(useStore.getState().textSize).toBe('m');
  });

  it('stays when the progress is cleared: it is how the player reads, not what they have played', () => {
    const now = useStore.getState();
    now.setTextSize('xl');
    now.setContrast(true);
    now.setDyslexia(true);
    now.resetProgress();
    expect(useStore.getState()).toMatchObject({ textSize: 'xl', contrast: true, dyslexia: true });
  });

  it('travels in a backup, checked as everything else in it', () => {
    for (const key of ['textSize', 'contrast', 'dyslexia'] as const) expect(PREF_KEYS).toContain(key);
    const mine = prefsOf(useStore.getState());
    expect(mine).toMatchObject({ textSize: 'm', contrast: false, dyslexia: false });
    expect(cleanPrefs({ ...mine, textSize: 'l', contrast: true, dyslexia: true }, mine)).toMatchObject({ textSize: 'l', contrast: true, dyslexia: true });
    // A copy from before these settings, or one that has been tampered with, leaves them as they are here.
    const here = { ...mine, textSize: 'xl' as const, contrast: true, dyslexia: true };
    expect(cleanPrefs({ theme: 'dark' }, here)).toMatchObject({ theme: 'dark', textSize: 'xl', contrast: true, dyslexia: true });
    expect(cleanPrefs({ textSize: 'enorme', contrast: 'sí', dyslexia: null }, here)).toMatchObject({ textSize: 'xl', contrast: true, dyslexia: true });
  });

  it('is on the page before the first paint: the page knows the same sizes and the same names', () => {
    const html = read('index.html');
    const listed = /\/\^\(([a-z|]+)\)\$\/\.test\(saved\.textSize\)/.exec(html)?.[1].split('|');
    expect(listed).toEqual(TEXT_SIZES.filter((t) => t !== TEXT_SIZE_DEFAULT));
    expect(html).toContain('document.documentElement.dataset.text = saved.textSize');
    expect(html).toContain(`saved.contrast === true || matchMedia('${CONTRAST_QUERY}').matches) document.documentElement.dataset.contrast = 'more'`);
    expect(html).toContain("saved.dyslexia === true) document.documentElement.dataset.font = 'dyslexia'");
  });
});

describe('more contrast', () => {
  const light = { ...block(':root'), ...block(":root[data-contrast='more']") };
  const dark = { ...block(':root'), ...block(":root[data-theme='dark']"), ...block(":root[data-contrast='more'][data-theme='dark']") };

  it('sets the same colours in the light theme and in the dark one: the dark one leaves nothing of the light', () => {
    const a = Object.keys(block(":root[data-contrast='more']")).sort();
    const b = Object.keys(block(":root[data-contrast='more'][data-theme='dark']")).sort();
    expect(b).toEqual(a);
    expect(a.length).toBeGreaterThan(25);
    // With the colours for the colour-blind, the same three in both themes.
    expect(Object.keys(block(":root[data-cb][data-contrast='more'][data-theme='dark']")).sort()).toEqual(Object.keys(block(":root[data-cb][data-contrast='more']")).sort());
  });

  it('comes after the palettes of the map and the colours for the colour-blind, whose colours it changes', () => {
    const at = css.indexOf("\n:root[data-contrast='more'] {");
    expect(at).toBeGreaterThan(css.lastIndexOf("\n:root[data-map='"));
    expect(at).toBeGreaterThan(css.indexOf('\n:root[data-cb] {'));
    expect(css.indexOf("\n:root[data-cb][data-contrast='more'] {")).toBeGreaterThan(at);
  });

  it('writes every ink at seven to one or more against what it is written on', () => {
    for (const [name, theme] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      for (const ink of ['--ink', '--ink-2', '--ink-3']) for (const paper of ['--bg', '--bg-2', '--card']) expect(contrast(theme[ink], theme[paper]), `${name}: ${ink} on ${paper}`).toBeGreaterThanOrEqual(7);
      for (const ink of ['--brand', '--accent-ink', '--ok-ink', '--warn-ink', '--bad-ink']) for (const paper of ['--bg', '--card']) expect(contrast(theme[ink], theme[paper]), `${name}: ${ink} on ${paper}`).toBeGreaterThanOrEqual(7);
      for (const [ink, paper] of [
        ['--ok-ink', '--ok-soft'],
        ['--warn-ink', '--warn-soft'],
        ['--bad-ink', '--bad-soft'],
        ['--accent-ink', '--accent-soft'],
        ['--brand', '--brand-soft'],
        ['--on-brand', '--brand'],
      ])
        expect(contrast(theme[ink], theme[paper]), `${name}: ${ink} on ${paper}`).toBeGreaterThanOrEqual(7);
      // What is written on a button or on a mark of colour: large or heavy letters, at least six to one.
      for (const [ink, paper] of [
        ['--on-accent', '--accent'],
        ['--on-mark', '--ok'],
        ['--on-mark', '--bad'],
      ])
        expect(contrast(theme[ink], theme[paper]), `${name}: ${ink} on ${paper}`).toBeGreaterThanOrEqual(6);
    }
  });

  it('draws lines that can be seen: three to one the faint ones, five and a half the edges of what is pressed', () => {
    for (const [name, theme] of [
      ['light', light],
      ['dark', dark],
    ] as const) {
      for (const paper of ['--bg', '--card']) {
        expect(contrast(theme['--line'], theme[paper]), `${name}: --line on ${paper}`).toBeGreaterThanOrEqual(2.8);
        expect(contrast(theme['--line-2'], theme[paper]), `${name}: --line-2 on ${paper}`).toBeGreaterThanOrEqual(5.5);
      }
      expect(contrast(theme['--border'], theme['--land']), `${name}: borders of the map`).toBeGreaterThanOrEqual(5.5);
    }
  });

  it('keeps blue, yellow and vermilion for the colour-blind, each darker on light and lighter on dark', () => {
    const cbLight = { ...light, ...block(":root[data-cb][data-contrast='more']") };
    const cbDark = { ...dark, ...block(":root[data-cb][data-contrast='more'][data-theme='dark']") };
    for (const [name, theme] of [
      ['light', cbLight],
      ['dark', cbDark],
    ] as const) {
      for (const ink of ['--ok-ink', '--warn-ink', '--bad-ink']) expect(contrast(theme[ink], theme['--bg']), `${name}: ${ink}`).toBeGreaterThanOrEqual(7);
      for (const [ink, paper] of [
        ['--ok-ink', '--ok-soft'],
        ['--warn-ink', '--warn-soft'],
        ['--bad-ink', '--bad-soft'],
      ])
        expect(contrast(theme[ink], theme[paper]), `${name}: ${ink} on ${paper}`).toBeGreaterThanOrEqual(7);
    }
    // Blue is still blue: more blue than red or green in it.
    const blue = cbLight['--ok'];
    expect(parseInt(blue.slice(5, 7), 16)).toBeGreaterThan(parseInt(blue.slice(1, 3), 16));
    expect(parseInt(blue.slice(5, 7), 16)).toBeGreaterThan(parseInt(blue.slice(3, 5), 16));
  });
});

describe('the typeface for dyslexia', () => {
  it('is Lexend in place of both typefaces of the game, with more room between letters and words and no italics', () => {
    const at = css.indexOf("\n:root[data-font='dyslexia'] {");
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(at, css.indexOf('}', at));
    expect(body).toContain("--serif: 'Lexend Variable', var(--sans-usual);");
    expect(body).toContain("--sans: 'Lexend Variable', var(--sans-usual);");
    const spaced = css.slice(css.indexOf("\n:root[data-font='dyslexia'] :not(.sheet, .sheet *, .dip, .dip *) {"));
    const rule = spaced.slice(0, spaced.indexOf('}'));
    expect(rule).toMatch(/letter-spacing: 0\.0[3-9]em !important;/);
    expect(rule).toMatch(/word-spacing: 0\.\d+em !important;/);
    expect(rule).toContain('font-style: normal !important;');
  });

  it('comes with the game, and is only fetched by who turns it on', () => {
    expect(read('src/main.tsx')).toContain("import '@fontsource-variable/lexend/wght.css';");
    const pkg = JSON.parse(read('package.json')) as { dependencies: Record<string, string> };
    expect(pkg.dependencies['@fontsource-variable/lexend']).toBeTruthy();
    // Not among the typefaces asked for with the page: those are the two every visit needs.
    expect(read('vite.config.ts')).toMatch(/FIRST_FONTS = \/\^assets\\\/\(dm-sans-latin-wght-normal\|fraunces-latin-opsz-normal\)/);
  });

  it('leaves what is printed in the usual letter: the sheets are laid out for it', () => {
    const at = css.indexOf("\n:root[data-font='dyslexia'] :is(.sheet, .dip) {");
    expect(at).toBeGreaterThan(-1);
    const body = css.slice(at, css.indexOf('}', at));
    for (const line of ['--serif: var(--serif-usual);', '--sans: var(--sans-usual);', 'letter-spacing: normal;', 'word-spacing: normal;']) expect(body).toContain(line);
  });
});
