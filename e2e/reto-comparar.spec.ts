/**
 * The daily challenge compared by link: the link of a result carries its points, and whoever opens it plays
 * the same challenge and sees both results side by side.
 */
import { expect, test, type Page } from '@playwright/test';
import { open, seed } from './helpers';

/** Noon of Wednesday 18 November 2026 in Madrid: the day every test here is played on. */
const NOW = new Date('2026-11-18T12:00:00+01:00');
const TODAY = '2026-11-18';
const PAST = '2026-11-12';
const done = (date: string, p = [20, 16, 13, 8, 4]) => ({ p, k: [1, 4, 2, 3, 1], t: Date.parse(`${date}T19:00:00+01:00`) });
/** 16 + 20 + 13 + 12 + 12 = 73 points, from "Ana"; and 20 + 8 + 7 + 12 + 8 = 55, from "Luis". */
const ANA = 'gkdcc.QW5h';
const LUIS = 'k87c8.THVpcw';
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { rivals: Record<string, { n: string; p: number[] }[]>; nick: string });
const rows = (page: Page) => page.locator('.d-vs tbody tr');
const cells = async (page: Page, n: number): Promise<string[]> => (await rows(page).nth(n).locator('th, td').allTextContents()).map((t) => t.trim());

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the link of a result of the daily challenge', () => {
  test('carries the points, and the name once one is given', async ({ page }) => {
    await seed(page, { daily: { [PAST]: done(PAST) } });
    await page.goto(`./#/reto/${PAST}`);
    const text = page.locator('.d-share textarea');
    await expect(text).toHaveValue(new RegExp(`#/reto/${PAST}/kgd84$`));
    await expect(page.locator('.d-share .duel-how')).toContainText('El enlace lleva tu resultado');
    await page.locator('.d-share-name input').fill('Ana');
    await expect(text).toHaveValue(new RegExp(`#/reto/${PAST}/kgd84\\.QW5h$`));
    // The name is the one the challenges by link use, and it is kept.
    expect((await kept(page)).nick).toBe('Ana');
    await page.reload();
    await expect(page.locator('.d-share-name input')).toHaveValue('Ana');
  });

  test('opened before playing, says what there is to beat and is kept for the end', async ({ page }) => {
    await seed(page, {});
    await page.goto(`./#/reto/${TODAY}/${ANA}`);
    await expect(page.locator('.d-vs-note')).toHaveText('Ana ha hecho 73 puntos en este reto. Juégalo y os comparáis al final.');
    // The address goes back to the day's own: what is copied from the bar is not somebody else's result.
    await expect(page).toHaveURL(new RegExp(`#/reto/${TODAY}$`));
    expect((await kept(page)).rivals).toEqual({ [TODAY]: [{ n: 'Ana', p: [16, 20, 13, 12, 12] }] });

    // A second link adds to it; the same one again changes nothing.
    await page.goto(`./#/reto/${TODAY}/${LUIS}`);
    await expect(page.locator('.d-vs-note')).toHaveText('Ana y Luis te han enviado su resultado de este reto: el mejor, 73 puntos. Juégalo y os comparáis al final.');
    await page.goto(`./#/reto/${TODAY}/${ANA}`);
    await expect(page).toHaveURL(new RegExp(`#/reto/${TODAY}$`));
    // They are named from the best result down, whatever order they came in.
    await expect(page.locator('.d-vs-note')).toContainText('Ana y Luis te han enviado');
    expect((await kept(page)).rivals[TODAY].map((r) => r.n)).toEqual(['Luis', 'Ana']);

    // It is still there on coming back from the first page.
    await open(page);
    await page.locator('.d-card a.btn, .d-card button').first().click();
    await expect(page.locator('.d-vs-note')).toContainText('73 puntos');
  });

  test('is compared when the challenge is finished: everybody in order, test by test', async ({ page }) => {
    // Four tests done; the last one is played here.
    await seed(page, { daily: { [TODAY]: { p: [20, 16, 13, 8, null], k: [1, 4, 2, 3, null] } }, rivals: { [TODAY]: [{ n: 'Ana', p: [16, 20, 13, 12, 12] }] } });
    await page.goto('./#/reto');
    await expect(page.locator('.d-vs-note')).toContainText('Ana ha hecho 73 puntos');
    await page.getByRole('button', { name: 'Seguir: prueba 5' }).click();
    for (let n = 1; n <= 5; n++) {
      await expect(page.locator('.d-quick .kicker')).toContainText(`${n} / 5`);
      await page.keyboard.press('1');
    }
    await page.getByRole('button', { name: 'Ver resultado' }).click();

    await expect(page.locator('.d-vs h3')).toHaveText('Cara a cara');
    await expect(rows(page)).toHaveCount(2);
    const total = Number(await page.locator('.d-total strong').textContent());
    // 57 points before the last test, which gives 20 at most: one's own row is the one with that total.
    const mine = await cells(page, total > 73 ? 0 : 1);
    expect(mine.slice(0, 6)).toEqual([`${total > 73 ? 1 : 2}Tú`, String(total), '20', '16', '13', '8']);
    await expect(page.locator('.d-vs-verdict')).toHaveText(total > 73 ? `¡Has ganado a Ana por ${total - 73} ${total - 73 === 1 ? 'punto' : 'puntos'}!` : `Gana Ana por ${73 - total} ${73 - total === 1 ? 'punto' : 'puntos'}`);
  });

  test('opened after playing, is compared at once, and a result can be taken away', async ({ page }) => {
    await seed(page, { daily: { [PAST]: done(PAST) } });
    await page.goto(`./#/reto/${PAST}/${ANA}`);
    await expect(page.locator('.d-vs-verdict')).toHaveText('Gana Ana por 12 puntos');
    await expect(page.locator('.d-vs')).toHaveClass(/\blost\b/);
    await expect(page.locator('.d-vs thead th')).toHaveText(['Quién', 'Total', '1', '2', '3', '4', '5']);
    expect(await cells(page, 0)).toEqual(['1Ana', '73', '16', '20', '13', '12', '12', '']);
    expect(await cells(page, 1)).toEqual(['2Tú', '61', '20', '16', '13', '8', '4', '']);
    await expect(rows(page).nth(1)).toHaveClass(/\bme\b/);
    // In bold, the best of each test; where both got the same, nobody.
    await expect(rows(page).nth(0).locator('td.is-top')).toHaveText(['20', '12', '12']);
    await expect(rows(page).nth(1).locator('td.is-top')).toHaveText(['20']);
    await expect(page.locator('.d-vs thead abbr').first()).toHaveAttribute('title', 'Regionle');
    await expect(page.locator('.d-vs .d-hint')).toHaveText('1 Regionle · 2 Señalar · 3 Ruta · 4 ¿Qué país? · 5 Banderas y capitales. En negrita, lo mejor de cada prueba.');

    // With a second result it is a table of three, and the line says one's place.
    await page.goto(`./#/reto/${PAST}/${LUIS}`);
    await expect(rows(page)).toHaveCount(3);
    await expect(page.locator('.d-vs-verdict')).toHaveText('Eres 2.º de 3, a 12 puntos de Ana');
    expect((await cells(page, 2)).slice(0, 2)).toEqual(['3Luis', '55']);

    // Taking Ana away leaves Luis, who is beaten.
    await page.getByRole('button', { name: 'Quitar a Ana' }).click();
    await expect(rows(page)).toHaveCount(2);
    await expect(page.locator('.d-vs-verdict')).toHaveText('¡Has ganado a Luis por 6 puntos!');
    await expect(page.locator('.d-vs')).toHaveClass(/\bwon\b/);
    expect((await kept(page)).rivals).toEqual({ [PAST]: [{ n: 'Luis', p: [20, 8, 7, 12, 8] }] });
    await page.getByRole('button', { name: 'Quitar a Luis' }).click();
    await expect(page.locator('.d-vs')).toHaveCount(0);
    expect((await kept(page)).rivals).toEqual({});
  });

  test('with the same points is a tie, and with no name is "your rival"', async ({ page }) => {
    await seed(page, { daily: { [PAST]: done(PAST) }, nick: 'Yo' });
    // The same points as one's own, with no name, from somebody who is not oneself (one's own link has one's name or none).
    await page.goto(`./#/reto/${PAST}/kgd84.QW5h`);
    await expect(page.locator('.d-vs-verdict')).toHaveText('¡Empate con Ana!');
    await expect(page.locator('.d-vs')).toHaveClass(/\btie\b/);
    await expect(rows(page).locator('td.is-top')).toHaveCount(0);
    await page.goto(`./#/reto/${PAST}/k0000`);
    await expect(rows(page)).toHaveCount(3);
    expect((await cells(page, 2)).slice(0, 2)).toEqual(['3Tu rival', '20']);
  });

  test('is not kept when it is one\'s own, nor when it cannot be read', async ({ page }) => {
    await seed(page, { daily: { [PAST]: done(PAST) }, nick: 'Ana' });
    // One's own link, opened where it was made.
    await page.goto(`./#/reto/${PAST}/kgd84.QW5h`);
    await expect(page.locator('.d-total strong')).toHaveText('61');
    await expect(page).toHaveURL(new RegExp(`#/reto/${PAST}$`));
    await expect(page.locator('.d-vs')).toHaveCount(0);
    await expect(page.locator('.d-vs-note')).toHaveCount(0);

    // A link cut short.
    await page.goto(`./#/reto/${PAST}/kgd8`);
    await expect(page.locator('.d-vs-note')).toHaveText('El enlace traía un resultado para comparar, pero ha llegado incompleto. Puedes jugar el reto igualmente.');
    await expect(page.locator('.d-vs')).toHaveCount(0);
    expect((await kept(page)).rivals ?? {}).toEqual({});
  });

  test("for a day that has not come here yet opens today's and says so", async ({ page }) => {
    await seed(page, {});
    await page.goto(`./#/reto/2026-11-19/${ANA}`);
    await expect(page.locator('.d-vs-note')).toHaveText('Te han enviado un resultado del reto del 19 de noviembre, que aquí todavía no ha empezado. Este es el de hoy: abre el enlace otra vez cuando llegue ese día.');
    await expect(page.locator('.kicker').first()).toContainText('Reto de hoy');
    await expect(page).toHaveURL(/#\/reto$/);
    expect((await kept(page)).rivals ?? {}).toEqual({});
  });

  test('is told in English', async ({ page }) => {
    await seed(page, { lang: 'en', daily: { [PAST]: done(PAST) } });
    await page.goto(`./#/reto/${PAST}/${ANA}`);
    await expect(page.locator('.d-vs h3')).toHaveText('Head to head');
    await expect(page.locator('.d-vs-verdict')).toHaveText('Ana wins by 12 points');
    expect((await cells(page, 1)).slice(0, 2)).toEqual(['2You', '61']);
    await page.goto(`./#/reto/${PAST}/${LUIS}`);
    await expect(page.locator('.d-vs-verdict')).toHaveText('You are 2nd of 3, 12 points behind Ana');
    await expect(page.locator('.d-share .duel-how')).toContainText('The link carries your result');
  });

  test('fits a phone with six in the table @movil', async ({ page }) => {
    const rivals = [
      { n: 'Ana', p: [16, 20, 13, 12, 12] },
      { n: 'Luis', p: [20, 8, 7, 12, 8] },
      { n: '', p: [20, 16, 13, 8, 4] },
      { n: 'María de los Ángeles F.', p: [12, 12, 10, 6, 8] },
      { n: '', p: [3, 4, 0, 0, 4] },
    ];
    await seed(page, { daily: { [PAST]: done(PAST) }, rivals: { [PAST]: rivals } });
    await page.goto(`./#/reto/${PAST}`);
    await expect(rows(page)).toHaveCount(6);
    await expect(page.locator('.d-vs-verdict')).toHaveText('Empatas en el 2.º de 6, a 12 puntos de Ana');
    await expect(rows(page).locator('th span')).toHaveText(['Ana', 'Tú', 'Rival 1', 'Luis', 'María de los Ángeles F.', 'Rival 2']);
    const width = await page.evaluate(() => document.documentElement.clientWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    // The table itself fits its box: nothing to scroll sideways.
    const scroll = await page.locator('.d-vs-scroll').evaluate((el) => [el.scrollWidth, el.clientWidth]);
    expect(scroll[0]).toBeLessThanOrEqual(scroll[1]);
    // The buttons that take a result away are big enough for a finger's tip.
    const box = (await page.getByRole('button', { name: 'Quitar a Ana' }).boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(24);
    expect(box.height).toBeGreaterThanOrEqual(24);
  });
});
