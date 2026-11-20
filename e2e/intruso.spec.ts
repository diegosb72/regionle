/**
 * The odd one out: four countries, three of which share what the question says. The right answer of each
 * question is worked out here from the data of the game, not from the game: every question has to have one.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { open, seed, start } from './helpers';

interface Fact {
  id: string;
  n: { es: string };
  cl: string;
  ct: string;
  ll?: number;
  ar: number;
  pop?: number;
  nb?: string[];
}
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Fact[] };
const STATES = index.countries.filter((c) => c.cl === 'un');
const byName = new Map(index.countries.map((c) => [c.n.es, c]));
const touch = (a: Fact, b: Fact): boolean => !!a.nb?.includes(b.id) || !!b.nb?.includes(a.id);

/** Which of the four is not like the other three, by what the question says: there has to be exactly one. */
function oddOf(text: string, names: string[]): string {
  const four = names.map((name) => byName.get(name)!);
  const than = /que (.+)\. ¿Cuál no\?$/.exec(text)?.[1];
  const ref = than ? byName.get(than)! : null;
  const is: (c: Fact) => boolean = text.includes('no tienen salida al mar')
    ? (c) => !c.ll
    : text.includes('tienen salida al mar')
      ? (c) => c.ll === 1
      : text.includes('mismo continente')
        ? (c) => four.filter((o) => o.ct === c.ct).length === 1
        : text.includes('limitan con un mismo país')
          ? (c) => index.countries.some((hub) => !four.includes(hub) && !touch(hub, c) && four.every((o) => o === c || touch(hub, o)))
          : text.includes('no tienen frontera terrestre')
            ? (c) => (c.nb ?? []).length > 0
            : text.includes('tienen frontera terrestre')
              ? (c) => (c.nb ?? []).length === 0
              : text.includes('más grandes que')
                ? (c) => c.ar < ref!.ar
                : text.includes('más pequeños que')
                  ? (c) => c.ar > ref!.ar
                  : text.includes('más habitantes que')
                    ? (c) => c.pop! < ref!.pop!
                    : text.includes('menos habitantes que')
                      ? (c) => c.pop! > ref!.pop!
                      : () => false;
  const odd = four.filter(is);
  expect(odd.map((c) => c.n.es), `${text} ${names.join(' · ')}`).toHaveLength(1);
  return odd[0].n.es;
}

const asked = (page: Page) => page.locator('.tf-text');
const four = (page: Page) => page.locator('.odd-btn');
const names = (page: Page) => page.locator('.odd-btn .odd-name').allTextContents();
const game = (countries: string[], length: number | 'endless' = 10) => ({ section: 'pops', mode: 'oddone', countries, opts: { length } });

test.describe('the odd one out', () => {
  test('shows four countries, takes the answer from the keyboard and says why', async ({ page }) => {
    await start(page, game(STATES.map((c) => c.id)));
    await expect(page.locator('.play-title')).toContainText('El intruso');
    await expect(asked(page)).toHaveText(/^Tres de estos países .+\. ¿Cuál (no|sí)\?$/);
    await expect(four(page)).toHaveCount(4);
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');

    // A wrong one first: the game says which it was, and why, and waits to be read.
    const first = (await asked(page).textContent())!;
    let shown = await names(page);
    let odd = oddOf(first, shown);
    const wrong = shown.findIndex((name) => name !== odd);
    await page.keyboard.press(String(wrong + 1));
    const verdict = page.locator('.verdict');
    await expect(verdict).toHaveClass(/verdict-bad/);
    await expect(verdict).toContainText(`Era ${odd}.`);
    // The reason names the four of them.
    for (const name of shown) await expect(verdict.locator('.tf-why')).toContainText(name);
    await expect(four(page).nth(wrong)).toHaveClass(/wrong/);
    await expect(four(page).nth(shown.indexOf(odd))).toHaveClass(/right/);
    for (let i = 0; i < 4; i++) await expect(four(page).nth(i)).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page.locator('.hud-main')).toHaveText('2 / 10');
    await expect(verdict).toHaveCount(0);

    // And the right one: it moves on by itself once there has been time to read why.
    shown = await names(page);
    odd = oddOf((await asked(page).textContent())!, shown);
    await page.keyboard.press(String(shown.indexOf(odd) + 1));
    await expect(verdict).toHaveClass(/verdict-ok/);
    await expect(verdict).toContainText('¡Correcto!');
    await expect(verdict.locator('.tf-why')).toContainText(odd);
    await expect(page.locator('.hud-main')).toHaveText('3 / 10', { timeout: 6000 });
  });

  test('has one answer to every question, whatever it asks about', async ({ page }) => {
    await start(page, game(STATES.map((c) => c.id), 50));
    const kinds = new Set<string>();
    for (let i = 0; i < 50; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 50`);
      const text = (await asked(page).textContent())!;
      kinds.add(text.replace(/que .+\./, 'que X.'));
      const shown = await names(page);
      expect(new Set(shown).size, shown.join(' · ')).toBe(4);
      await four(page).nth(shown.indexOf(oddOf(text, shown))).click();
      await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
      await page.getByRole('button', { name: i === 49 ? 'Ver resultado' : 'Siguiente' }).click();
    }
    await expect(page.locator('.results h2')).toHaveText('¡Todas bien!');
    await expect(page.locator('.results')).toContainText('50 de 50');
    await expect(page.locator('.tf-review')).toHaveCount(0);
    // Fifty questions about the whole world ask about more than one thing.
    expect(kinds.size).toBeGreaterThan(5);
  });

  test('ends when asked to, with what was missed to read again', async ({ page }) => {
    await start(page, game(STATES.filter((c) => c.ct === 'EU').map((c) => c.id)));
    const missed: { odd: string; chose: string; text: string }[] = [];
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 10`);
      const text = (await asked(page).textContent())!;
      const shown = await names(page);
      const odd = oddOf(text, shown);
      // The first and the third are missed; the second is not.
      const chose = i === 1 ? odd : shown.find((name) => name !== odd)!;
      if (chose !== odd) missed.push({ odd, chose, text });
      await four(page).nth(shown.indexOf(chose)).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    await expect(page.locator('.hud-main')).toHaveText('4 / 10');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results h2')).toHaveText('Partida terminada');
    await expect(page.locator('.results')).toContainText('1 de 3');
    const review = page.locator('.tf-review li');
    await expect(review).toHaveCount(2);
    for (const [i, m] of missed.entries()) {
      await expect(review.nth(i).locator('.tf-said')).toHaveText(m.text);
      await expect(review.nth(i).locator('.tf-why')).toContainText(`Era ${m.odd}; elegiste ${m.chose}.`);
    }

    // Another game starts from the first question, with other countries or another question.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(four(page)).toHaveCount(4);
  });

  test('is in the menu of the figures, with its number of questions, and takes five countries', async ({ page }) => {
    await seed(page, { mode: { pops: 'oddone' }, sel: { pops: ['ES', 'FR', 'PT', 'IT'] } });
    await open(page, '/poblaciones');
    await expect(page.locator('.mode.on')).toContainText('El intruso');
    const lengths = page.getByRole('radiogroup', { name: 'Número de preguntas' });
    // Ten, twenty, fifty or no end; twenty where nothing has been chosen.
    await expect(lengths.getByRole('radio')).toHaveText(['10', '20', '50', '']);
    await expect(lengths.getByRole('radio', { checked: true })).toHaveText('20');
    // The figure the other games of the section are played with is not asked for: the questions are about them all.
    await expect(page.getByRole('radiogroup', { name: 'Cifra' })).toHaveCount(0);

    // Four are shown and a size is measured against one more: with four countries there is no game.
    await expect(page.locator('.problem')).toHaveText('Elige al menos 5 países.');
    await expect(page.getByRole('button', { name: 'Empezar', exact: true })).toBeDisabled();
  });

  test('says so when the countries chosen are too much alike to ask anything', async ({ page }) => {
    // Five islands of the Caribbean of much the same size and people: one continent, all with a coast, none
    // with a border, and no three of them clearly larger or smaller than another. (If the figures of the data
    // change and a question comes up, another five are needed here.)
    await start(page, game(['AG', 'BB', 'DM', 'GD', 'VC']));
    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('Sin preguntas');
    await expect(end.locator('.results-note')).toHaveText('Con estos países no sale ninguna pregunta: elige más, o más distintos entre sí.');
    // The same again would be the same nothing.
    await expect(page.getByRole('button', { name: 'Otra vez' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cambiar de juego' })).toBeVisible();
  });
});
