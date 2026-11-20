/**
 * Connections: sixteen countries that go four by four, and what each four have in common is not said. The
 * boards here are played with sixteen countries chosen to go one way only (four of each of four parts of the
 * world, and nothing else the rest could be grouped around: src/lib/connect.test.ts says so of them), so
 * that which country goes with which is known from the data of the game, not from the game.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start } from './helpers';

interface Fact {
  id: string;
  n: { es: string; en?: string };
  cl: string;
  ct: string;
  ll?: number;
  cap?: { es: string; en: string };
}
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Fact[] };
const byId = new Map(index.countries.map((c) => [c.id, c]));
const nameOf = (id: string): string => byId.get(id)!.n.es;

/** Four countries of Western Africa, four of South America, four of Eastern Europe and four of South-Eastern Asia. */
const BY_REGION = 'ML SN GH BJ BO CL UY EC MD UA PL RO LA VN TH MY'.split(' ');
const AFRICA = ['ML', 'SN', 'GH', 'BJ'];
const AMERICA = ['BO', 'CL', 'UY', 'EC'];
const EUROPE = ['MD', 'UA', 'PL', 'RO'];
const ASIA = ['LA', 'VN', 'TH', 'MY'];
const GROUPS = [AFRICA, AMERICA, EUROPE, ASIA];
/** What each of those groups may be called: its part of the world, its continent or, the South Americans, their language. */
const TITLES = new Map<string[], string[]>([
  [AFRICA, ['África Occidental', 'África']],
  [AMERICA, ['América del Sur', 'América', 'Con el español como lengua oficial']],
  [EUROPE, ['Europa del Este', 'Europa']],
  [ASIA, ['Sudeste Asiático', 'Asia']],
]);
/** One from each group, and the four with no coast. */
const LANDLOCKED = ['ML', 'BO', 'MD', 'LA'];
/** The names of a group as the game writes them: in the order of the alphabet, with "y" before the last. */
const listed = (ids: string[], more: (id: string) => string = () => ''): string => {
  const names = [...ids].sort((a, b) => nameOf(a).localeCompare(nameOf(b), 'es')).map((id) => nameOf(id) + more(id));
  return `${names.slice(0, -1).join(', ')} y ${names[names.length - 1]}`;
};

const tiles = (page: Page) => page.locator('.conn-tile');
/** A name as a tile writes it: whole, or with a place to be cut in a long word, which is a letter nobody sees. */
const written = (name: string): RegExp => new RegExp(`^${[...name].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\u00ad?')}$`);
const tile = (page: Page, id: string) => tiles(page).filter({ hasText: written(nameOf(id)) });
const inHand = (page: Page) => page.locator('.conn-tile[aria-pressed="true"]');
const said = (page: Page) => page.locator('.conn-said');
const hud = (page: Page) => page.locator('.hud-main');
const lives = (page: Page) => page.locator('.conn-lives');
const found = (page: Page) => page.locator('.conn-wrap .conn-group');
const checkButton = (page: Page) => page.getByRole('button', { name: /^Comprobar/ });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const game = (countries: string[]) => ({ section: 'pops', mode: 'connect', countries });
const kept = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!).state.sessions ?? []) as { mode: string; label: string; total: number; ok: number; warn: number; bad: number }[]);
const START = 'Elige cuatro países que tengan algo en común y comprueba.';

async function pick(page: Page, ids: string[]): Promise<void> {
  for (const id of ids) await tile(page, id).click();
}
/** Puts back whatever is in hand. */
async function drop(page: Page): Promise<void> {
  for (let n = await inHand(page).count(); n > 0; n--) {
    await inHand(page).first().click();
    await expect(inHand(page)).toHaveCount(n - 1);
  }
}
async function guess(page: Page, ids: string[]): Promise<void> {
  await drop(page);
  await pick(page, ids);
  await expect(inHand(page)).toHaveCount(4);
  await checkButton(page).click();
}

test.describe('connections', () => {
  test('lays sixteen countries on the table and takes the fours that go together, each with what they share', async ({ page }) => {
    await start(page, game(BY_REGION));
    await expect(page.locator('.play-title')).toContainText('Conexiones');
    await expect(tiles(page)).toHaveCount(16);
    expect((await tiles(page).allTextContents()).sort()).toEqual(BY_REGION.map(nameOf).sort());
    await expect(hud(page)).toHaveText('0 / 4');
    await expect(said(page)).toHaveText(START);
    await expect(lives(page)).toHaveAccessibleName('Fallos: 0 de 4');
    await expect(found(page)).toHaveCount(0);
    // Nothing is checked with fewer than four in hand. (A button that says it is not to be pressed and can
    // still be reached: it is pressed here as somebody who does not see that would.)
    await expect(checkButton(page)).toHaveAttribute('aria-disabled', 'true');
    await expect(checkButton(page)).toContainText('0 / 4');
    await pick(page, AFRICA.slice(0, 3));
    await expect(checkButton(page)).toContainText('3 / 4');
    await checkButton(page).click({ force: true });
    await expect(said(page)).toHaveText(START);
    await expect(lives(page)).toHaveAccessibleName('Fallos: 0 de 4');
    await expect(tile(page, 'ML')).toHaveAttribute('aria-pressed', 'true');
    await expect(tile(page, 'BJ')).toHaveAttribute('aria-pressed', 'false');
    await tile(page, 'BJ').click();
    await expect(checkButton(page)).not.toHaveAttribute('aria-disabled', 'true');
    await expect(checkButton(page)).toContainText('4 / 4');
    // With four in hand the other twelve wait: a fifth is not taken.
    await expect(page.locator('.conn-tile[aria-disabled="true"]')).toHaveCount(12);
    await tile(page, 'BO').click({ force: true });
    await expect(tile(page, 'BO')).toHaveAttribute('aria-pressed', 'false');
    await expect(inHand(page)).toHaveCount(4);

    await checkButton(page).click();
    await expect(found(page)).toHaveCount(1);
    const title = (await found(page).first().locator('b').textContent())!;
    expect(TITLES.get(AFRICA)).toContain(title);
    await expect(said(page)).toHaveText(`¡Grupo! ${title}.`);
    await expect(found(page).first().locator('span')).toHaveText(listed(AFRICA));
    // The four are off the table, and nothing is left in hand.
    await expect(tiles(page)).toHaveCount(12);
    await expect(inHand(page)).toHaveCount(0);
    await expect(hud(page)).toHaveText('1 / 4');
    await expect(lives(page)).toHaveAccessibleName('Fallos: 0 de 4');

    for (const [i, four] of [AMERICA, EUROPE].entries()) {
      await guess(page, four);
      await expect(found(page)).toHaveCount(i + 2);
      expect(TITLES.get(four)).toContain(await found(page).nth(i + 1).locator('b').textContent());
      await expect(found(page).nth(i + 1).locator('span')).toHaveText(listed(four));
      // Each group of its colour, in the order they were found.
      await expect(found(page).nth(i + 1)).toHaveClass(new RegExp(`\\bn${i + 1}\\b`));
    }
    await expect(tiles(page)).toHaveCount(4);
    // (After the last group the result takes the place of the table: what it says is looked at there.)
    await guess(page, ASIA);

    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('¡Los cuatro grupos, a la primera!');
    await expect(end.locator('.donut')).toContainText('4 de 4');
    await expect(end.locator('.results-stats')).toContainText('Intentos fallidos0');
    const all = end.locator('.conn-all .conn-group');
    await expect(all).toHaveCount(4);
    await expect(all.locator('small')).toHaveText(['a la primera', 'a la primera', 'a la primera', 'a la primera']);
    await expect(all.locator('span')).toHaveText(GROUPS.map((four) => listed(four)));
    for (let i = 0; i < 4; i++) await expect(all.nth(i)).toHaveClass(new RegExp(`\\bn${i}\\b`));
    // The sixteen countries, each with what its group shares.
    await expect(end.locator('.results-group.g-ok li')).toHaveCount(16);
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ mode: 'connect', label: '16 países', total: 4, ok: 4, warn: 0, bad: 0 });
  });

  test('says when three of the four go together, counts each wrong four once and ends at the fourth miss', async ({ page }) => {
    await start(page, game(BY_REGION));
    await guess(page, [...AFRICA.slice(0, 3), 'BO']);
    await expect(said(page)).toHaveText('Casi: tres de los cuatro van juntos. Te quedan 3 intentos.');
    await expect(lives(page)).toHaveAccessibleName('Fallos: 1 de 4');
    await expect(lives(page).locator('i.gone')).toHaveCount(1);
    // What was wrong stays in hand: one can be changed for another.
    await expect(inHand(page)).toHaveCount(4);
    await expect(tiles(page)).toHaveCount(16);
    // The same four again are not a second miss.
    await checkButton(page).click();
    await expect(said(page)).toHaveText('Esos cuatro ya los habías probado.');
    await expect(lives(page)).toHaveAccessibleName('Fallos: 1 de 4');

    await guess(page, ['ML', 'SN', 'BO', 'CL']);
    await expect(said(page)).toHaveText('No son un grupo. Te quedan 2 intentos.');
    // A group found after a miss is not found first time; the one after it is.
    await guess(page, AFRICA);
    await expect(found(page)).toHaveCount(1);
    await guess(page, AMERICA);
    await expect(found(page)).toHaveCount(2);
    await expect(lives(page)).toHaveAccessibleName('Fallos: 2 de 4');

    await guess(page, [...EUROPE.slice(0, 3), 'LA']);
    await expect(said(page)).toHaveText('Casi: tres de los cuatro van juntos. Te queda 1 intento.');
    await expect(lives(page)).toHaveAccessibleName('Fallos: 3 de 4');
    // (After the last miss the result takes the place of the table: what it says is looked at there.)
    await guess(page, [...EUROPE.slice(0, 2), 'LA', 'VN']);

    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('Sin más intentos');
    await expect(end.locator('.donut')).toContainText('1 de 4');
    await expect(end.locator('.results-stats')).toContainText('Intentos fallidos4');
    // The two that were found, and the two that were left, with what they shared.
    const all = end.locator('.conn-all .conn-group');
    await expect(all.locator('small')).toHaveText(['tras un fallo', 'a la primera', 'sin encontrar', 'sin encontrar']);
    await expect(all.nth(1)).toHaveClass(/\bn1\b/);
    await expect(all.nth(2)).toHaveClass(/\bleft\b/);
    await expect(all.nth(3)).toHaveClass(/\bleft\b/);
    const left = await all.locator('span').allTextContents();
    expect(left.slice(0, 2)).toEqual([listed(AFRICA), listed(AMERICA)]);
    expect(left.slice(2).sort()).toEqual([listed(EUROPE), listed(ASIA)].sort());
    for (const b of await all.locator('b').allTextContents()) expect([...TITLES.values()].flat()).toContain(b);
    // The countries of the groups that were left are there to be gone over.
    await expect(end.locator('.results-group.g-bad li')).toHaveCount(8);
    await expect(end.locator('.results-group.g-warn li')).toHaveCount(4);
    await expect(end.locator('.results-group.g-ok li')).toHaveCount(4);
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ mode: 'connect', total: 4, ok: 1, warn: 1, bad: 2 });
  });

  test('leaves the last wrong guess in sight, with nothing more to press, before the result takes its place', async ({ page }) => {
    // The clock of the page is held here, so that the moment in between can be looked at for as long as it takes.
    await page.clock.install();
    await start(page, game(BY_REGION));
    await guess(page, [...AFRICA.slice(0, 3), 'BO']);
    await guess(page, [...AFRICA.slice(0, 3), 'CL']);
    await guess(page, [...AFRICA.slice(0, 3), 'UY']);
    await expect(lives(page)).toHaveAccessibleName('Fallos: 3 de 4');
    await page.clock.pauseAt(await page.evaluate(() => Date.now() + 5000));
    await guess(page, [...AFRICA.slice(0, 3), 'EC']);
    await expect(said(page)).toHaveText('Casi: tres de los cuatro van juntos. Se acabaron los intentos.');
    await expect(lives(page)).toHaveAccessibleName('Fallos: 4 de 4');
    await expect(lives(page).locator('i.gone')).toHaveCount(4);
    await expect(tiles(page)).toHaveCount(16);
    await expect(page.locator('.conn-tile[aria-disabled="true"]')).toHaveCount(16);
    await expect(checkButton(page)).toHaveAttribute('aria-disabled', 'true');
    for (const name of ['Barajar', 'Pista', 'Terminar']) await expect(button(page, name)).toBeDisabled();
    await expect(page.locator('.results')).toHaveCount(0);
    // A second and a bit later, the result.
    await page.clock.runFor(1500);
    await expect(page.locator('.results h2')).toHaveText('Sin más intentos');
    await expect(page.locator('.results .conn-all .conn-group small')).toHaveText(['sin encontrar', 'sin encontrar', 'sin encontrar', 'sin encontrar']);
    await expect(page.locator('.results .donut')).toContainText('0 de 4');
  });

  test('does not count as a miss four countries that share something else, and says what it is', async ({ page }) => {
    await start(page, game(BY_REGION));
    // One from each group, and none of the four has a coast.
    for (const id of LANDLOCKED) expect(byId.get(id)!.ll, id).toBe(1);
    expect(BY_REGION.filter((id) => byId.get(id)!.ll)).toEqual(LANDLOCKED);
    await guess(page, LANDLOCKED);
    await expect(said(page)).toHaveText('Los cuatro tienen algo en común, «Sin salida al mar», pero no es ninguno de los cuatro grupos. No cuenta como fallo.');
    await expect(lives(page)).toHaveAccessibleName('Fallos: 0 de 4');
    await expect(found(page)).toHaveCount(0);
    await expect(tiles(page)).toHaveCount(16);
    // And the group found after it is found first time.
    for (const four of GROUPS) await guess(page, four);
    await expect(page.locator('.results h2')).toHaveText('¡Los cuatro grupos, a la primera!');
  });

  test('tells what a group shares for the asking, and that group is found with help', async ({ page }) => {
    await start(page, game(BY_REGION));
    await button(page, 'Pista').click();
    const hints = page.locator('.conn-told li');
    await expect(hints).toHaveCount(1);
    const told = (await hints.first().locator('b').textContent())!;
    await expect(hints.first()).toHaveText(`Uno de los grupos: ${told}`);
    await expect(said(page)).toHaveText(`Pista: uno de los grupos es «${told}».`);
    await expect(lives(page)).toHaveAccessibleName('Fallos: 0 de 4');
    const which = GROUPS.find((four) => TITLES.get(four)!.includes(told))!;
    expect(which, told).toBeTruthy();

    // Another group first: it is found first time, and the hint is still there.
    const other = GROUPS.find((four) => four !== which)!;
    await guess(page, other);
    await expect(found(page)).toHaveCount(1);
    await expect(hints).toHaveCount(1);
    // The group of the hint: its hint goes, and it is there with its name.
    await guess(page, which);
    await expect(found(page)).toHaveCount(2);
    await expect(hints).toHaveCount(0);
    await expect(found(page).nth(1).locator('b')).toHaveText(told);
    // A hint for each of the two that are left, and then there is no more to tell.
    await button(page, 'Pista').click();
    await expect(hints).toHaveCount(1);
    await button(page, 'Pista').click();
    await expect(hints).toHaveCount(2);
    await expect(button(page, 'Pista')).toBeDisabled();
    for (const four of GROUPS.filter((g) => g !== which && g !== other)) await guess(page, four);

    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('¡Tablero resuelto!');
    await expect(end.locator('.conn-all .conn-group small')).toHaveText(['a la primera', 'con pista', 'con pista', 'con pista']);
    await expect(end.locator('.donut')).toContainText('1 de 4');
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ mode: 'connect', total: 4, ok: 1, warn: 3, bad: 0 });
  });

  test('says which capital it is where the capitals are what a group shares', async ({ page }) => {
    // Berlin, Bogotá, Bamako and Baghdad: one country of each continent, with nothing else in common, among twelve
    // that go by their part of the world (src/lib/connect.test.ts).
    const B = ['DE', 'CO', 'ML', 'IQ'];
    const REST = [
      ['FJ', 'PG', 'SB', 'VU'],
      ['JM', 'HT', 'DO', 'BS'],
      ['KE', 'UG', 'RW', 'TZ'],
    ];
    for (const id of B) expect(byId.get(id)!.cap!.es, id).toMatch(/^B/);
    await start(page, game([...B, ...REST.flat()]));
    await expect(tiles(page)).toHaveCount(16);
    await guess(page, B);
    await expect(found(page)).toHaveCount(1);
    await expect(found(page).first().locator('b')).toHaveText('Su capital empieza por B');
    await expect(found(page).first().locator('span')).toHaveText('Alemania (Berlín), Colombia (Bogotá), Irak (Bagdad) y Malí (Bamako)');
    await expect(said(page)).toHaveText('¡Grupo! Su capital empieza por B.');
    for (const four of REST) await guess(page, four);
    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('¡Los cuatro grupos, a la primera!');
    await expect(end.locator('.conn-all .conn-group span').first()).toHaveText('Alemania (Berlín), Colombia (Bogotá), Irak (Bagdad) y Malí (Bamako)');
    // In the list of the countries, each with its capital.
    await expect(end.locator('.results-group.g-ok li', { hasText: 'Alemania' })).toContainText('Su capital empieza por B: Berlín');
    await expect(end.locator('.results-group.g-ok li', { hasText: 'Malí' })).toContainText('Su capital empieza por B: Bamako');
  });

  test('ends when asked to, without counting the groups that were left, and deals another board', async ({ page }) => {
    await start(page, game(BY_REGION));
    await guess(page, ASIA);
    await expect(found(page)).toHaveCount(1);
    await button(page, 'Terminar').click();
    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('Partida terminada');
    await expect(end.locator('.results-note')).toHaveText('Quedaban 3 grupos por encontrar.');
    await expect(end.locator('.donut')).toContainText('1 de 1');
    await expect(end.locator('.conn-all .conn-group small')).toHaveText(['a la primera', 'sin encontrar', 'sin encontrar', 'sin encontrar']);
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ mode: 'connect', total: 1, ok: 1, warn: 0, bad: 0 });

    await button(page, 'Otra vez').click();
    await expect(tiles(page)).toHaveCount(16);
    await expect(hud(page)).toHaveText('0 / 4');
    await expect(found(page)).toHaveCount(0);
    await expect(said(page)).toHaveText(START);
    await expect(lives(page)).toHaveAccessibleName('Fallos: 0 de 4');
    // Ended with nothing found, a game leaves nothing behind.
    await guess(page, [...AFRICA.slice(0, 3), 'BO']);
    await expect(lives(page)).toHaveAccessibleName('Fallos: 1 de 4');
    await button(page, 'Terminar').click();
    await expect(end.locator('.results-note')).toHaveText('Quedaban 4 grupos por encontrar.');
    await expect(end.locator('.results-stats')).toContainText('Intentos fallidos1');
    expect(await kept(page)).toHaveLength(1);
  });

  test('shuffles the countries on the table, and is played from the keyboard', async ({ page }) => {
    await start(page, game(BY_REGION));
    await expect(tiles(page)).toHaveCount(16);
    const before = await tiles(page).allTextContents();
    await tile(page, 'ML').click();
    // (Sixteen countries can lie in more ways than a shuffle will ever repeat; a few, in case.)
    await expect(async () => {
      await button(page, 'Barajar').click();
      expect(await tiles(page).allTextContents()).not.toEqual(before);
    }).toPass();
    expect((await tiles(page).allTextContents()).sort()).toEqual([...before].sort());
    // What was in hand stays in hand.
    await expect(tile(page, 'ML')).toHaveAttribute('aria-pressed', 'true');
    await tile(page, 'ML').click();
    await expect(inHand(page)).toHaveCount(0);

    // The arrows go from country to country as they lie: four in a row on a wide screen.
    const order = await tiles(page).allTextContents();
    await tiles(page).first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(tiles(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(tiles(page).nth(5)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tiles(page).nth(4)).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(tiles(page).nth(0)).toBeFocused();
    // Nowhere to go from the first one upwards, or to the left.
    await page.keyboard.press('ArrowUp');
    await expect(tiles(page).nth(0)).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(tiles(page).nth(0)).toBeFocused();
    await page.keyboard.press('End');
    await expect(tiles(page).nth(15)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(tiles(page).nth(15)).toBeFocused();
    await page.keyboard.press('Home');
    await expect(tiles(page).nth(0)).toBeFocused();
    // Space and Enter take a country and put it back.
    await page.keyboard.press('Space');
    await expect(tiles(page).first()).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(tiles(page).first()).toHaveAttribute('aria-pressed', 'false');
    // A whole group, without the mouse.
    for (const id of EUROPE) {
      await tiles(page).nth(order.indexOf(nameOf(id))).focus();
      await page.keyboard.press('Enter');
    }
    await expect(inHand(page)).toHaveCount(4);
    await checkButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(found(page)).toHaveCount(1);
    await expect(found(page).first().locator('span')).toHaveText(listed(EUROPE));
    // The button that was pressed keeps the focus: the next four are checked from it.
    await expect(checkButton(page)).toBeFocused();
  });

  test('is in the menu of the figures, and says there when the countries chosen give no board, or always the same', async ({ page }) => {
    await seed(page, { mode: { pops: 'connect' }, sel: { pops: ['ES', 'FR', 'PT'] } });
    await open(page, '/poblaciones');
    await expect(page.locator('.mode.on')).toContainText('Conexiones');
    await expect(page.locator('.mode-about')).toContainText('Difícil.');
    await expect(page.locator('.problem')).toHaveText('Elige al menos 16 países.');
    await expect(button(page, 'Empezar')).toBeDisabled();
    // Neither the figure of the other games of the section nor a number of questions is asked for.
    await expect(page.getByRole('radiogroup', { name: 'Cifra' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Número de preguntas' })).toHaveCount(0);

    const repeats = page.locator('.mode-facts li', { hasText: 'Con estos países el tablero se repite: elige más' });
    // The world: boards without end.
    await button(page, 'Mundo').click();
    await expect(page.locator('.mode-facts li').first()).toContainText('4 grupos');
    await expect(page.locator('.problem')).toHaveCount(0);
    await expect(button(page, 'Empezar')).toBeEnabled();
    await expect(repeats).toHaveCount(0);
    // The countries where Spanish is spoken: twenty, nearly all in two parts of the Americas.
    await button(page, 'Hispanohablantes').click();
    await expect(repeats).toBeVisible();
    await expect(page.locator('.problem')).toHaveCount(0);
    await expect(button(page, 'Empezar')).toBeEnabled();
    // The G20: nineteen that are all large, all crowded and all members of something.
    await button(page, 'G20').click();
    await expect(page.locator('.problem')).toHaveText('Con estos países no sale ningún tablero: elige más, o más variados.');
    await expect(button(page, 'Empezar')).toBeDisabled();
    await expect(repeats).toHaveCount(0);

    await button(page, 'Mundo').click();
    await expect(page.locator('.problem')).toHaveCount(0);
    await button(page, 'Empezar').click();
    await expect(tiles(page)).toHaveCount(16);
    await expect(hud(page)).toHaveText('0 / 4');
    // Sixteen countries of the world, each one once.
    const names = await tiles(page).allTextContents();
    expect(new Set(names).size).toBe(16);
  });

  test('says so in the game too when the countries chosen give no board', async ({ page }) => {
    // The fourteen states of Oceania, Spain and Japan: all sixteen would have to be on the board, and Spain
    // has nothing in common with four of the others (src/lib/connect.test.ts).
    const oceania = index.countries.filter((c) => c.cl === 'un' && c.ct === 'OC').map((c) => c.id);
    expect(oceania).toHaveLength(14);
    await start(page, game([...oceania, 'ES', 'JP']));
    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('Sin tablero');
    await expect(end.locator('.results-note')).toHaveText('Con estos países no sale ningún tablero: elige más, o más variados.');
    await expect(button(page, 'Otra vez')).toHaveCount(0);
    await expect(button(page, 'Cambiar de juego')).toBeVisible();
    expect(await kept(page)).toHaveLength(0);
    // And with fewer than sixteen, the game does not start.
    await restart(page, game([...oceania, 'ES']));
    await expect(page.getByText('Este juego necesita al menos 16 países.')).toBeVisible();
  });

  test('is played in English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { levels: {}, nonce: 1, ...game(BY_REGION), opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-title')).toContainText('Connections');
    await expect(tiles(page)).toHaveCount(16);
    await expect(said(page)).toHaveText('Pick four countries that have something in common, and check.');
    const en = (id: string) => byId.get(id)!.n.en ?? byId.get(id)!.n.es;
    const press = async (ids: string[]) => {
      await drop(page);
      for (const id of ids) await tiles(page).filter({ hasText: written(en(id)) }).click();
      await expect(inHand(page)).toHaveCount(4);
      await page.getByRole('button', { name: /^Check/ }).click();
    };
    await press(LANDLOCKED);
    await expect(said(page)).toHaveText('The four have something in common, “Landlocked”, but it is none of the four groups. It is no miss.');
    await press([...AFRICA.slice(0, 3), 'BO']);
    await expect(said(page)).toHaveText('Nearly: three of the four go together. You have 3 guesses left.');
    await expect(lives(page)).toHaveAccessibleName('Misses: 1 of 4');
    await press(AFRICA);
    await expect(found(page)).toHaveCount(1);
    const title = (await found(page).first().locator('b').textContent())!;
    expect(['Western Africa', 'Africa']).toContain(title);
    await expect(said(page)).toHaveText(`A group! ${title}.`);
    await expect(found(page).first().locator('span')).toHaveText('Benin, Ghana, Mali and Senegal');
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.locator('.conn-told li')).toContainText('One of the groups:');
    // Which of the three that are left the hint is of is the game's to say.
    const told = (await page.locator('.conn-told li b').textContent())!;
    const TOLD = [
      ['South America', 'Americas', 'With Spanish as an official language'],
      ['Eastern Europe', 'Europe'],
      ['South-Eastern Asia', 'Asia'],
    ];
    const which = TOLD.findIndex((titles) => titles.includes(told));
    expect(which, told).toBeGreaterThanOrEqual(0);
    await expect(said(page)).toHaveText(`Hint: one of the groups is “${told}”.`);
    for (const four of [AMERICA, EUROPE, ASIA]) await press(four);
    await expect(page.locator('.results h2')).toHaveText('Board solved!');
    await expect(page.locator('.results .conn-all .conn-group small')).toHaveText(['after a miss', ...[0, 1, 2].map((i) => (i === which ? 'with a hint' : 'first time'))]);
    await expect(page.locator('.results .results-stats')).toContainText('Wrong guesses1');
  });

  // The countries with the longest names there are, sixteen that go four by four in one way: what a tile has the least room for.
  const LONG = 'CF CD GQ ST VC KN AG TT TM KG UZ TJ BA MK LI LU'.split(' ');
  for (const dyslexia of [false, true]) {
    test(`cuts no name where it should not, however narrow the screen and large the letter${dyslexia ? ', in the typeface for dyslexia' : ''}`, async ({ page }) => {
      await seed(page, { dyslexia, game: { levels: {}, nonce: 1, ...game(LONG), opts: OPTS } });
      await page.goto('./#/jugar');
      await expect(tiles(page)).toHaveCount(16);
      await page.evaluate(() => document.fonts.ready);
      const texts = (await page.locator('.conn-text').allTextContents()).map((t) => t.replaceAll('\u00ad', '·'));
      // The longest words have a place to be cut, with a hyphen; the rest are written whole.
      expect(texts).toContain('República Centroafri·cana');
      expect(texts).toContain('Liechtenstein');
      expect(texts).toContain('San Vicente y las Granadinas');
      expect(texts).toContain('República Democrática del Congo');

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
          const drawn = await page.evaluate(async (size) => {
            if (size === 'm') delete document.documentElement.dataset.text;
            else document.documentElement.dataset.text = size;
            await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
            const cut: string[] = [];
            const spilt: string[] = [];
            let smallest = Infinity;
            for (const el of document.querySelectorAll<HTMLElement>('.conn-tile .conn-text')) {
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
              const box = el.closest('.conn-tile')!.getBoundingClientRect();
              const own = el.getBoundingClientRect();
              if (own.left < box.left - 0.5 || own.right > box.right + 0.5 || own.top < box.top - 0.5 || own.bottom > box.bottom + 0.5) spilt.push(text.data);
              smallest = Math.min(smallest, parseFloat(getComputedStyle(el).fontSize));
            }
            const all = [...document.querySelectorAll('.conn-tile')].map((b) => b.getBoundingClientRect());
            const check = [...document.querySelectorAll('button')].find((b) => b.textContent!.startsWith('Comprobar'))!.getBoundingClientRect();
            return {
              cut,
              spilt,
              smallest,
              columns: new Set(all.map((r) => Math.round(r.left))).size,
              widths: new Set(all.map((r) => Math.round(r.width))).size,
              flags: [...document.querySelectorAll('.conn-tile .flag')].filter((f) => f.getBoundingClientRect().width > 0).length,
              wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
              // The button that checks a guess is on the screen, however far down the table goes.
              inSight: check.top >= 0 && check.bottom <= innerHeight + 0.5 && check.left >= 0 && check.right <= innerWidth + 0.5,
            };
          }, letter);
          const where = `${width} px, letter ${letter}`;
          expect(drawn.cut, where).toEqual([]);
          expect(drawn.spilt, where).toEqual([]);
          expect(drawn.wide, where).toBeLessThanOrEqual(0);
          expect(drawn.widths, where).toBe(1);
          // Smaller where a long word has no room for more, and still a letter that can be read.
          expect(drawn.smallest, where).toBeGreaterThanOrEqual(10);
          // Four in a row where there is room for them, and two on a phone.
          expect(drawn.columns, where).toBe(width >= 768 ? 4 : 2);
          // Where a tile has room for little more than a word, the flags make way for the names.
          expect([0, 16], where).toContain(drawn.flags);
          if (width >= 390 && letter === 'm') expect(drawn.flags, where).toBe(16);
          if (width === 320 && letter !== 'm') expect(drawn.flags, where).toBe(0);
          expect(drawn.inSight, where).toBe(true);
        }
      }
    });
  }

  test('keeps what was said and the button that checks in sight on a phone, while the table is scrolled @movil', async ({ page }) => {
    // A short screen: eight rows of two do not fit on it.
    await page.setViewportSize({ width: 390, height: 600 });
    await start(page, game(LONG));
    await expect(tiles(page)).toHaveCount(16);
    await page.evaluate(() => document.fonts.ready);
    const sight = () =>
      page.evaluate(() => {
        const within = (el: Element | null | undefined) => {
          const r = el!.getBoundingClientRect();
          return r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5;
        };
        const tiles = [...document.querySelectorAll('.conn-tile')];
        return {
          said: within(document.querySelector('.conn-said')),
          check: within([...document.querySelectorAll('button')].find((b) => b.textContent!.startsWith('Comprobar'))),
          first: within(tiles[0]),
          last: within(tiles[tiles.length - 1]),
          wide: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          columns: new Set(tiles.map((t) => Math.round(t.getBoundingClientRect().left))).size,
        };
      });
    // At the top: the first countries, and not the last ones; what was said and the button, at the foot of the screen.
    expect(await sight()).toEqual({ said: true, check: true, first: true, last: false, wide: 0, columns: 2 });
    // Down to the last country, which is taken with a finger: the first is gone, and the foot is still there.
    await tiles(page).last().tap();
    await expect(tiles(page).last()).toHaveAttribute('aria-pressed', 'true');
    expect(await sight()).toMatchObject({ said: true, check: true, first: false });
    await expect(checkButton(page)).toContainText('1 / 4');
    // Three more, wherever they lie, and the four are checked from where one is.
    for (const t of (await tiles(page).all()).slice(0, 3)) await t.tap();
    await expect(inHand(page)).toHaveCount(4);
    await checkButton(page).tap();
    await expect(said(page)).not.toHaveText(START);
  });
});
