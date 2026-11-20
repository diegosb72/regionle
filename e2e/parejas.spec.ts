/**
 * Pairs: cards face down, two for each country, turned two at a time. Which card goes with which is worked
 * out here from the data of the game: what a card hides is on the page, though not in sight.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start } from './helpers';

interface Fact {
  id: string;
  n: { es: string };
  cl: string;
  ct: string;
  fl?: string;
  cap?: { es: string };
}
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Fact[] };
const STATES = index.countries.filter((c) => c.cl === 'un');
const byFlag = new Map(STATES.map((c) => [c.fl, c]));
const byName = new Map(STATES.map((c) => [c.n.es, c]));
const byCapital = new Map(STATES.map((c) => [c.cap!.es, c]));

interface Card {
  i: number;
  face: string;
  country: Fact;
}

const cards = (page: Page) => page.locator('.pair-card');
const said = (page: Page) => page.locator('.pair-said');
const game = (countries: string[], opts: Record<string, unknown> = {}) => ({ section: 'pops', mode: 'pairs', countries, opts });
const world = STATES.map((c) => c.id);

/** The cards on the table, each with the country it is one half of. */
async function table(page: Page): Promise<Card[]> {
  await expect(cards(page).first()).toBeVisible();
  const raw = await cards(page).evaluateAll((all) =>
    all.map((b) => ({
      face: [...b.classList].find((c) => c.startsWith('of-'))!.slice(3),
      // A long word carries a soft hyphen, where it may be cut: it is not part of the name.
      text: (b.querySelector('.pair-text')?.textContent ?? '').replaceAll('\u00ad', ''),
      flag: /flags\/([a-z-]+)\.svg/.exec(b.querySelector('.pair-img')?.getAttribute('src') ?? '')?.[1] ?? '',
    })),
  );
  return raw.map((c, i) => {
    const country = c.face === 'flag' ? byFlag.get(c.flag) : c.face === 'capital' ? byCapital.get(c.text) : byName.get(c.text);
    expect(country, `card ${i + 1}: ${c.face} ${c.text}${c.flag}`).toBeTruthy();
    return { i, face: c.face, country: country! };
  });
}
/** The first halves (flags, capitals) and, for each card, its other half. */
const firsts = (all: Card[]): Card[] => all.filter((c) => c.face === 'flag' || c.face === 'capital');
const half = (all: Card[], card: Card): Card => all.find((c) => c.i !== card.i && c.country.id === card.country.id)!;
const turn = (page: Page, card: Card) => cards(page).nth(card.i).click();

test.describe('pairs', () => {
  test('deals the cards face down, two for each country, and puts a flag with its name', async ({ page }) => {
    await start(page, game(world, { pairOf: 'flag', pairs: 6 }));
    await expect(page.locator('.play-title')).toContainText('Parejas');
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator('.pair-card.up')).toHaveCount(0);
    await expect(page.locator('.hud-main')).toHaveText('0 / 6');
    await expect(said(page)).toHaveText('Levanta una bandera y un nombre: si la bandera es de ese país, son pareja.');

    const all = await table(page);
    // Six countries, and of each its flag and its name; the back of a card says which of the two it is.
    expect(new Set(all.map((c) => c.country.id)).size).toBe(6);
    expect(all.filter((c) => c.face === 'flag')).toHaveLength(6);
    expect(all.filter((c) => c.face === 'name')).toHaveLength(6);
    const [flag, other] = firsts(all);
    await expect(cards(page).nth(flag.i)).toHaveAccessibleName(`Carta ${flag.i + 1}, una bandera, boca abajo`);
    await expect(cards(page).nth(half(all, flag).i)).toHaveAccessibleName(`Carta ${half(all, flag).i + 1}, un nombre, boca abajo`);
    // Nothing of what a card hides is in sight, or said.
    await expect(cards(page).nth(half(all, flag).i).locator('.pair-face')).toBeHidden();

    // With a flag up, the other flags wait: the second card is a name.
    await turn(page, flag);
    await expect(cards(page).nth(flag.i)).toHaveClass(/\bup\b/);
    await expect(cards(page).nth(flag.i).locator('.pair-img')).toBeVisible();
    await expect(page.locator('.pair-card.waits')).toHaveCount(5);
    await expect(cards(page).nth(other.i)).toHaveAttribute('aria-disabled', 'true');
    await cards(page).nth(other.i).click({ force: true });
    await expect(page.locator('.pair-card.up')).toHaveCount(1);

    // The name of another country: not a pair. The two are left in sight for a moment and go back by themselves.
    await turn(page, half(all, other));
    await expect(said(page)).toHaveText('No son pareja.');
    await expect(page.locator('.pair-card.up.no')).toHaveCount(2);
    await expect(cards(page).nth(half(all, other).i)).toHaveAccessibleName(other.country.n.es);
    await expect(page.locator('.pair-turns')).toHaveText('Intentos: 1');
    await expect(page.locator('.pair-card.up')).toHaveCount(0, { timeout: 5000 });

    // Its own name: a pair, which stays in sight.
    await turn(page, flag);
    await turn(page, half(all, flag));
    await expect(said(page)).toHaveText(`¡Pareja! Es la bandera de ${flag.country.n.es}.`);
    await expect(page.locator('.pair-card.found')).toHaveCount(2);
    await expect(cards(page).nth(flag.i)).toHaveAccessibleName(`Bandera de ${flag.country.n.es}, emparejada`);
    await expect(cards(page).nth(half(all, flag).i)).toHaveAccessibleName(`${flag.country.n.es}, emparejada`);
    await expect(page.locator('.hud-main')).toHaveText('1 / 6');
    await expect(page.locator('.pair-turns')).toHaveText('Intentos: 2');
    // A card that has its pair is not turned again.
    await cards(page).nth(flag.i).click({ force: true });
    await expect(page.locator('.pair-card.found')).toHaveCount(2);
    await expect(page.locator('.pair-card.up')).toHaveCount(2);
  });

  test('counts as a miss the turn that could be spared, and keeps the game with the fewest turns', async ({ page }) => {
    await start(page, game(world, { pairOf: 'flag', pairs: 6 }));
    const all = await table(page);
    const [a, b, ...rest] = firsts(all);
    // Two cards never seen: a look, not a miss.
    await turn(page, a);
    await turn(page, half(all, b));
    await expect(said(page)).toHaveText('No son pareja.');
    // The flag of the second, whose name has just been seen, with another name: that one counts.
    await turn(page, b);
    await turn(page, half(all, rest[0]));
    await expect(said(page)).toHaveText('No son pareja, y la otra mitad de la primera ya había salido: cuenta como fallo.');
    // A new flag with a name that was seen and was not its own: that one too.
    await turn(page, rest[1]);
    await turn(page, half(all, b));
    await expect(said(page)).toHaveText('No son pareja, y la segunda ya la habías visto: cuenta como fallo.');

    // The next card puts back the two that are up: no need to wait.
    for (const card of firsts(all)) {
      await turn(page, card);
      await turn(page, half(all, card));
    }
    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('¡Todas las parejas!', { timeout: 5000 });
    await expect(end).toContainText('4 de 6');
    await expect(end.locator('.results-note')).toHaveText('2 parejas te costaron un intento de más: ya habías visto dónde estaba su otra mitad, o la juntaste con una carta que ya conocías.');
    const stat = (label: string) => end.locator('.results-stats div', { hasText: label }).locator('dd');
    await expect(stat('A la primera')).toHaveText('4');
    await expect(stat('Fallos')).toHaveText('2');
    await expect(stat('Intentos')).toHaveText('9');
    await expect(stat('Récord')).toHaveText('¡Nuevo!');
    // The pairs, in the order they were found, and which of them took a turn too many.
    const list = end.locator('.pair-list li');
    await expect(list).toHaveCount(6);
    await expect(list.locator('b')).toHaveText(firsts(all).map((c) => c.country.n.es));
    await expect(list.filter({ hasText: 'con un intento de más' }).locator('b')).toHaveText([b.country.n.es, rest[1].country.n.es]);

    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { best: Record<string, number>; sessions: { mode: string; total: number; ok: number; bad: number }[] });
    expect(kept.best['pairs:flag:6']).toBe(9);
    expect(kept.sessions[0]).toMatchObject({ mode: 'pairs', total: 6, ok: 4, bad: 2 });

    // A better game beats it; the record is told among the others.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(page.locator('.pair-card.up')).toHaveCount(0);
    await expect(page.locator('.hud-main')).toHaveText('0 / 6');
    const again = await table(page);
    for (const card of firsts(again)) {
      await turn(page, card);
      await turn(page, half(again, card));
    }
    await expect(end.locator('h2')).toHaveText('¡Todas a la primera!', { timeout: 5000 });
    await expect(end.locator('.results-note')).toHaveCount(0);
    await expect(stat('Intentos')).toHaveText('6');
    await expect(stat('Récord')).toHaveText('¡Nuevo!');
    await open(page, '/progreso');
    await expect(page.locator('.records li', { hasText: 'Parejas' })).toHaveText('Parejas · banderas · 12 cartas6 intentos');
  });

  test('puts each capital with its country, and ends when asked to', async ({ page }) => {
    await start(page, game(world, { pairOf: 'capital', pairs: 8 }));
    await expect(cards(page)).toHaveCount(16);
    await expect(said(page)).toHaveText('Levanta una capital y un país: si la capital es de ese país, son pareja.');
    const all = await table(page);
    expect(all.filter((c) => c.face === 'capital')).toHaveLength(8);
    expect(all.filter((c) => c.face === 'country')).toHaveLength(8);
    const [a, b, c] = firsts(all);
    await expect(cards(page).nth(a.i)).toHaveAccessibleName(`Carta ${a.i + 1}, una capital, boca abajo`);
    await expect(cards(page).nth(half(all, a).i)).toHaveAccessibleName(`Carta ${half(all, a).i + 1}, un país, boca abajo`);
    await turn(page, a);
    await expect(cards(page).nth(a.i)).toHaveAccessibleName(`${a.country.cap!.es}, capital`);
    await expect(cards(page).nth(a.i).locator('.pair-kind')).toHaveText('capital');
    await turn(page, half(all, a));
    await expect(said(page)).toHaveText(`¡Pareja! ${a.country.cap!.es} es la capital de ${a.country.n.es}.`);
    // The country first and its capital after is the same pair.
    await turn(page, half(all, b));
    await turn(page, b);
    await expect(page.locator('.hud-main')).toHaveText('2 / 8');
    await turn(page, c);

    await page.getByRole('button', { name: 'Terminar' }).click();
    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('Partida terminada');
    await expect(end).toContainText('2 de 2');
    // What was found, with its capital, and what was left on the table.
    const list = end.locator('.pair-list li');
    await expect(list).toHaveCount(8);
    await expect(list.nth(0)).toContainText(`${a.country.n.es}capital: ${a.country.cap!.es}`);
    await expect(list.filter({ hasText: 'sin encontrar' })).toHaveCount(6);
    // A game left half way is no record.
    await expect(end.locator('.results-stats')).not.toContainText('Récord');
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.best['pairs:capital:8'])).toBeUndefined();
  });

  test('is played from the keyboard: the arrows go from card to card', async ({ page }) => {
    await start(page, game(world, { pairOf: 'flag', pairs: 6 }));
    const all = await table(page);
    // Twelve cards, four in a row on a wide screen.
    await page.keyboard.press('ArrowRight');
    await expect(cards(page).nth(0)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cards(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cards(page).nth(5)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowUp');
    await expect(cards(page).nth(0)).toBeFocused();
    // Nowhere to go past the edge.
    await page.keyboard.press('ArrowUp');
    await expect(cards(page).nth(0)).toBeFocused();
    await page.keyboard.press('End');
    await expect(cards(page).nth(11)).toBeFocused();
    await page.keyboard.press('Home');

    const first = all[0];
    const other = half(all, first);
    await page.keyboard.press('Enter');
    await expect(cards(page).nth(0)).toHaveClass(/\bup\b/);
    // To its other half, a card at a time, and Enter: the pair stays where the focus is.
    for (let i = 0; i < other.i; i++) await page.keyboard.press('ArrowRight');
    await expect(cards(page).nth(other.i)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('.pair-card.found')).toHaveCount(2);
    await expect(cards(page).nth(other.i)).toBeFocused();
  });

  test('is in the menu of the figures, with what the pairs are made of and how many are dealt', async ({ page }) => {
    await seed(page, { mode: { pops: 'pairs' }, sel: { pops: ['ES', 'FR'] } });
    await open(page, '/poblaciones');
    await expect(page.locator('.mode.on')).toContainText('Parejas');
    // With two countries there is nothing to remember.
    await expect(page.locator('.problem')).toHaveText('Elige al menos 3 países.');
    await expect(page.getByRole('button', { name: 'Empezar', exact: true })).toBeDisabled();
    // Neither the figure of the other games of the section nor a number of questions is asked for.
    await expect(page.getByRole('radiogroup', { name: 'Cifra' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Número de preguntas' })).toHaveCount(0);

    const of = page.getByRole('radiogroup', { name: 'De qué son las parejas' });
    await expect(of.getByRole('radio')).toHaveText(['Banderas', 'Capitales']);
    await expect(of.getByRole('radio', { checked: true })).toHaveText('Banderas');
    const size = page.getByRole('radiogroup', { name: 'Número de cartas' });
    await expect(size.getByRole('radio')).toHaveText(['12 cartas', '16', '20', '24']);
    await expect(size.getByRole('radio', { checked: true })).toHaveText('16');

    await of.getByRole('radio', { name: 'Capitales' }).click();
    await size.getByRole('radio', { name: '12 cartas' }).click();
    await expect(page.locator('.opt-hint', { hasText: 'Cada capital, con su país.' })).toBeVisible();
    const kept = await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state.opts as { pairOf: string; pairs: number });
    expect(kept).toMatchObject({ pairOf: 'capital', pairs: 6 });
  });

  test('deals as many pairs as there are countries where they are fewer than asked for', async ({ page }) => {
    await seed(page, { mode: { pops: 'pairs' }, sel: { pops: ['ES', 'FR', 'PT', 'IT'] }, opts: { ...OPTS, pairOf: 'capital', pairs: 12 } });
    await open(page, '/poblaciones');
    await expect(page.locator('.opt-hint', { hasText: 'Con 4 países salen 8 cartas.' })).toBeVisible();
    await page.getByRole('button', { name: 'Empezar', exact: true }).click();
    await expect(cards(page)).toHaveCount(8);
    await expect(page.locator('.hud-main')).toHaveText('0 / 4');
    const all = await table(page);
    expect(all.map((c) => c.country.id).sort()).toEqual(['ES', 'ES', 'FR', 'FR', 'IT', 'IT', 'PT', 'PT']);
  });

  // The countries with the longest names there are, and the ones with the longest capitals: what a card has the least room for.
  const LONG = ['CF', 'BA', 'VC', 'CD', 'LI', 'TM', 'LK', 'MG', 'CI', 'BN', 'KN', 'AG'];
  for (const dyslexia of [false, true]) {
    test(`cuts no name where it should not, however narrow the screen and large the letter${dyslexia ? ', in the typeface for dyslexia' : ''}`, async ({ page }) => {
      await seed(page, { dyslexia, game: { levels: {}, nonce: 1, ...game(LONG), opts: { ...OPTS, pairOf: 'capital', pairs: 12 } } });
      await page.goto('./#/jugar');
      await expect(cards(page)).toHaveCount(24);
      await page.evaluate(() => document.fonts.ready);
      const texts = (await page.locator('.pair-text').allTextContents()).map((t) => t.replaceAll('\u00ad', '·'));
      // The longest words have a place to be cut, with a hyphen; the rest are written whole.
      expect(texts).toContain('República Centroafri·cana');
      expect(texts).toContain('Sri Jayawarde·napura Kotte');
      expect(texts).toContain('Liechtenstein');
      expect(texts).toContain('San Vicente y las Granadinas');

      for (const [width, height] of [
        [320, 640],
        [360, 740],
        [390, 800],
        [430, 900],
        [768, 900],
        [1280, 800],
      ]) {
        await page.setViewportSize({ width, height });
        for (const letter of ['m', 'l', 'xl']) {
          // What a card hides takes its room from the start: the names are measured without turning a card.
          const drawn = await page.evaluate(async (size) => {
            if (size === 'm') delete document.documentElement.dataset.text;
            else document.documentElement.dataset.text = size;
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
            const cut: string[] = [];
            const spilt: string[] = [];
            let smallest = Infinity;
            for (const el of document.querySelectorAll<HTMLElement>('.pair-card .pair-text')) {
              const text = el.firstChild as Text;
              // A piece that is never cut: up to a space, to the end of a hyphen or to a soft one. On two lines, it has been.
              for (const piece of text.data.matchAll(/[^\s\u00ad-]+-?/g)) {
                const range = document.createRange();
                // (The hyphen that a soft one shows at the end of its line is reported with the letter that follows it:
                // what comes after a soft hyphen is looked at from its second letter.)
                range.setStart(text, text.data[piece.index - 1] === '\u00ad' ? piece.index + 1 : piece.index);
                range.setEnd(text, piece.index + piece[0].length);
                const lines = new Set([...range.getClientRects()].filter((r) => r.width > 0.5).map((r) => Math.round(r.top)));
                if (lines.size > 1) cut.push(piece[0]);
              }
              const card = el.closest('.pair-card')!.getBoundingClientRect();
              const box = el.getBoundingClientRect();
              if (box.left < card.left - 0.5 || box.right > card.right + 0.5 || box.top < card.top - 0.5 || box.bottom > card.bottom + 0.5) spilt.push(text.data);
              smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
            }
            const all = [...document.querySelectorAll('.pair-card')].map((b) => b.getBoundingClientRect());
            return {
              cut,
              spilt,
              smallest,
              columns: new Set(all.map((r) => Math.round(r.left))).size,
              // Every card is as large as every other: the table is a grid of equals.
              sizes: [...new Set(all.map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`))],
              wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
            };
          }, letter);
          const where = `${width} px, letter ${letter}`;
          expect(drawn.cut, where).toEqual([]);
          expect(drawn.spilt, where).toEqual([]);
          expect(drawn.wide, where).toBeLessThanOrEqual(0);
          expect(drawn.sizes, where).toHaveLength(1);
          // Small where there is no room for more, and still a letter that can be read.
          expect(drawn.smallest, where).toBeGreaterThanOrEqual(8);
          // Six in a row where there is room for it; on a phone, as many as fit and never fewer than two.
          if (width >= 1280) expect(drawn.columns, where).toBe(6);
          expect(drawn.columns, where).toBeGreaterThanOrEqual(2);
          if (width <= 430) expect(drawn.columns, where).toBeLessThanOrEqual(4);
        }
      }
    });
  }
});
