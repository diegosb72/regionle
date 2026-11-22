/**
 * «Tarea con justificante»: whoever teaches sets a map and a game as homework and gets a link; whoever opens
 * it types a name, plays that game by those rules, and gets a receipt at the end: another link, with the
 * name, how it went and when. Here: where an assignment is made, what whoever does it sees and gets, and
 * what whoever set it reads.
 *
 * The map is the United Kingdom by its four nations: a game is four questions.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed } from './helpers';

/** The nations by the name they are asked with, in either language. */
const ID: Record<string, string> = {
  Inglaterra: 'GB-ENG',
  England: 'GB-ENG',
  Escocia: 'GB-SCT',
  Scotland: 'GB-SCT',
  Gales: 'GB-WLS',
  Wales: 'GB-WLS',
  'Irlanda del Norte': 'GB-NIR',
  'Northern Ireland': 'GB-NIR',
};

/** An assignment, as its address names it: the four nations pinned, one try and no hints, under a title. */
const TASK = 'Tema%204%3A%20Reino%20Unido/regiones/GB:g1/pin/tries=1;hints=0';

const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);
const next = (page: Page) => page.getByRole('button', { name: /^(Siguiente|Next)/ });
const title = (page: Page) => page.locator('.results-title');
const box = (page: Page) => page.locator('.receipt');
const sheet = (page: Page, label: string) => page.locator('.receipt-sheet > div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${label}$`) }) }).locator('dd');
const seal = (page: Page) => page.locator('.receipt-seal');
const rows = (page: Page) => page.locator('.receipt-table tbody tr');
/** What homework keeps in the browser, as it is written. */
const kept = (page: Page): Promise<{ name: string; n: Record<string, number>; got: string[]; done: number } | null> => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:tasks') ?? 'null'));

/** What a receipt says, written as the game writes it (lib/task.ts). */
function receiptCode(r: { task?: string; name: string; ok: number; warn?: number; bad: number; total?: number; secs?: number; at?: number; n?: number }, check?: string): string {
  const payload = Buffer.from(JSON.stringify([1, r.task ?? TASK, r.name, r.ok, r.warn ?? 0, r.bad, r.total ?? 4, r.secs ?? 20, r.at ?? 29_900_000, r.n ?? 1])).toString('base64url');
  const text = `regionle justificante 1 ${payload}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return `${payload}.${check ?? (h >>> 0).toString(36)}`;
}

/** …and read back from the link the game gives. */
function receiptOf(href: string) {
  const [, payload, check] = /#\/justificante\/([A-Za-z0-9_-]+)\.([a-z0-9]+)$/.exec(href)!;
  const [version, task, name, ok, warn, bad, total, secs, at, n] = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as [number, string, string, number, number, number, number, number, number, number];
  return { version, task, name, ok, warn, bad, total, secs, at, n, sound: receiptCode({ task, name, ok, warn, bad, total, secs, at, n }) === `${payload}.${check}` };
}

/** The page of an assignment. */
async function assignment(page: Page, path = TASK, state: Record<string, unknown> = {}): Promise<void> {
  await seed(page, state);
  await page.goto(`./#/tarea/${path}`);
  await expect(page.locator('.duel-page h1')).toBeVisible();
}

/** The game of an assignment, started under a name and ready for its first question. */
async function begin(page: Page, name = 'Ana García', path = TASK, state: Record<string, unknown> = {}): Promise<void> {
  await assignment(page, path, state);
  await page.getByLabel('Tu nombre').fill(name);
  await page.getByRole('button', { name: 'Empezar la tarea' }).click();
  await ready(page);
}

async function ready(page: Page): Promise<void> {
  await expect(page.locator('.q .q-prompt')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
}

/** The piece the question on screen asks for. */
async function asked(page: Page): Promise<string> {
  const name = ((await page.locator('.q-name').textContent()) ?? '').trim();
  expect(ID[name], `the piece called ${name}`).toBeTruthy();
  return ID[name];
}

/** The right click on the map; the next question, or the result, is there when it comes back. */
async function hit(page: Page): Promise<void> {
  const name = page.locator('.q-name');
  const now = ((await name.textContent()) ?? '').trim();
  await piece(page, await asked(page)).click();
  await expect(title(page).or(name.filter({ hasNotText: now }))).toBeVisible();
}

/** A wrong click on the map: on a piece that is still to be asked, which is the only kind that is an answer. */
async function miss(page: Page): Promise<void> {
  const id = await asked(page);
  const open = await page.locator('.map-svg .m-items [data-id]:not([class*="st-"])').evaluateAll((els) => els.map((el) => el.getAttribute('data-id')!));
  const other = open.find((x) => x !== id);
  expect(other, `a piece still to be asked other than ${id}`).toBeTruthy();
  await piece(page, other!).click();
}

/** Right answers until the result is on screen: the questions that are left, and the round of what was missed. */
async function toEnd(page: Page): Promise<void> {
  for (let i = 0; i < 10 && !(await title(page).isVisible()); i++) await hit(page);
  await expect(title(page)).toBeVisible();
}

/** The receipt the game has on screen, read from its link. */
async function given(page: Page) {
  await expect(box(page)).toBeVisible();
  const href = await box(page).getByRole('link', { name: 'Verlo' }).getAttribute('href');
  return { href: href!, ...receiptOf(href!) };
}

test.describe('where a game is set up', () => {
  /** The setup of «Señalar» on the United Kingdom, with the options given. */
  async function setup(page: Page, opts: Record<string, unknown> = {}, more: Record<string, unknown> = {}): Promise<void> {
    await seed(page, { sel: { regions: ['GB'] }, levels: { GB: 'g1' }, mode: { regions: 'pin' }, opts: { ...OPTS, length: 'all', ...opts }, ...more });
    await open(page, '/regiones');
    await expect(page.locator('.options')).toBeVisible();
  }
  const button = (page: Page) => page.getByRole('button', { name: 'Poner de tarea' });
  const panel = (page: Page) => page.getByRole('dialog', { name: 'Poner de tarea' });
  const link = (page: Page) => panel(page).getByRole('textbox', { name: 'Enlace de la tarea' });

  test('the map and the game chosen are set as homework, with their rules and a title', async ({ page, baseURL, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setup(page, { tries: 1, hints: false });
    await expect(page.locator('.maplink .opt-hint')).toContainText('«Poner de tarea» da un enlace para una clase');
    await button(page).click();
    // What is set is said in words, as whoever gets the link will read it.
    await expect(panel(page).locator('.embed-what')).toHaveText('Reino Unido · naciones');
    await expect(panel(page).locator('.task-what')).toHaveText('Regiones · Señalar · todas las preguntas · 1 intento, sin pistas');
    await expect(link(page)).toHaveValue(`${baseURL}#/tarea/-/regiones/GB:g1/pin/tries=1;hints=0`);

    await panel(page).getByLabel('Título (opcional)').fill('  Tema 4: Reino   Unido ');
    await expect(link(page)).toHaveValue(`${baseURL}#/tarea/${TASK}`);
    await expect(panel(page).getByRole('link', { name: 'Ver cómo queda' })).toHaveAttribute('href', `${baseURL}#/tarea/${TASK}`);
    // What a receipt is worth is said where the assignment is made.
    await expect(panel(page)).toContainText('no es a prueba de trampas');

    await panel(page).getByRole('button', { name: 'Copiar el enlace' }).click();
    await expect(panel(page).getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`${baseURL}#/tarea/${TASK}`);
    // Another title is another link: the one copied is no longer this one.
    await panel(page).getByLabel('Título (opcional)').fill('Tema 5');
    await expect(panel(page).getByRole('button', { name: 'Copiar el enlace' })).toBeVisible();
    await expect(link(page)).toHaveValue(`${baseURL}#/tarea/Tema%205/regiones/GB:g1/pin/tries=1;hints=0`);
  });

  test('the link is that of the format chosen: an exam, a clock of two minutes, five lives', async ({ page, baseURL }) => {
    await setup(page, { format: 'exam' });
    await button(page).click();
    await expect(panel(page).locator('.task-what')).toHaveText('Regiones · Señalar · Examen · todas las preguntas');
    await expect(link(page)).toHaveValue(`${baseURL}#/tarea/-/regiones/GB:g1/pin/format=exam`);
    await page.keyboard.press('Escape');

    const format = page.getByRole('radiogroup', { name: 'Formato de la partida' });
    await format.getByRole('radio', { name: 'Contrarreloj' }).click();
    await page.getByRole('radiogroup', { name: 'Duración de la contrarreloj' }).getByRole('radio', { name: '2 min' }).click();
    await button(page).click();
    await expect(panel(page).locator('.task-what')).toHaveText('Regiones · Señalar · Contrarreloj · 2 minutos');
    await expect(link(page)).toHaveValue(`${baseURL}#/tarea/-/regiones/GB:g1/pin/format=timed;clock=120`);
    await page.keyboard.press('Escape');

    await format.getByRole('radio', { name: 'Supervivencia' }).click();
    await page.getByRole('radiogroup', { name: 'Vidas de la supervivencia' }).getByRole('radio', { name: '5 vidas' }).click();
    await button(page).click();
    await expect(panel(page).locator('.task-what')).toHaveText('Regiones · Señalar · Supervivencia · 5 vidas');
    await expect(link(page)).toHaveValue(`${baseURL}#/tarea/-/regiones/GB:g1/pin/format=lives;lives=5`);
  });

  test('only the games of questions that one player does can be set', async ({ page }) => {
    await setup(page);
    await expect(button(page)).toBeVisible();
    // A game of two is of two: there is nobody to give the receipt to.
    await page.getByRole('radiogroup', { name: 'Formato de la partida' }).getByRole('radio', { name: 'Dos jugadores' }).click();
    await expect(button(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Copiar enlace a este mapa' })).toBeVisible();
    // A map to explore asks nothing, and a game that is not of questions has no tally to send.
    for (const mode of ['explore', 'nameall', 'cards']) {
      await open(page, `/regiones/GB:g1/${mode}`);
      await expect(page.getByRole('button', { name: 'Copiar enlace a este mapa' })).toBeVisible();
      await expect(button(page), mode).toHaveCount(0);
    }
  });

  test('a custom list is set as homework too, with the game chosen', async ({ page, baseURL }) => {
    const list = { id: 'l1', name: 'Las del jueves', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-M', 'ES-B', 'ES-V'] };
    await seed(page, { lists: [list], listOn: { regions: 'l1' }, mode: { regions: 'identify' }, opts: { ...OPTS, answer: 'choice', length: 'all' } });
    await open(page, '/regiones');
    await page.locator('.listcard').getByRole('button', { name: 'Poner de tarea' }).click();
    await expect(panel(page).locator('.embed-what')).toHaveText('Las del jueves');
    await expect(panel(page).locator('.task-what')).toHaveText('Regiones · Identificar · todas las preguntas');
    const address = await link(page).inputValue();
    expect(address).toMatch(new RegExp(`^${baseURL}#/tarea/-/lista/[A-Za-z0-9_-]+/identify/answer=choice$`));

    // Whoever opens it gets the list, and only its three pieces are asked about.
    await page.goto(address);
    await expect(page.locator('.duel-page h1')).toHaveText('Tarea de mapas');
    await expect(page.locator('.duel-what strong')).toHaveText('Las del jueves');
    await page.getByLabel('Tu nombre').fill('Ana');
    await page.getByRole('button', { name: 'Empezar la tarea' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 3', { timeout: 30_000 });
  });

  test('the first page says that homework can be set, and how', async ({ page }) => {
    await seed(page);
    await open(page, '/');
    await page.getByRole('link', { name: 'Cómo se pone una tarea' }).click();
    await expect(page.locator('.duel-page h1')).toHaveText('Pon una tarea de mapas');
    await expect(page.locator('.how-steps > li')).toHaveCount(4);
    await expect(page.locator('.how-steps')).toContainText('Pulsa «Poner de tarea»');
    await expect(page.locator('.duel-rules')).toContainText('no es a prueba de trampas');
    await expect(page).toHaveTitle(/Tareas con justificante/);
    await page.getByRole('link', { name: 'Elegir a qué jugar' }).click();
    await expect(page).toHaveURL(/#\/regiones$/);
  });
});

test.describe('an assignment, for whoever does it', () => {
  test('says what it is and asks for a name before anything else', async ({ page }) => {
    await assignment(page);
    await expect(page.locator('.duel-page h1')).toHaveText('Tema 4: Reino Unido');
    await expect(page.locator('.duel-what strong')).toHaveText('Reino Unido · naciones');
    await expect(page.locator('.duel-what > span:last-child')).toHaveText('Regiones · Señalar · todas las preguntas · 1 intento, sin pistas');
    await expect(page).toHaveTitle(/Tarea/);

    await page.getByRole('button', { name: 'Empezar la tarea' }).click();
    await expect(page.getByRole('alert')).toHaveText('Escribe tu nombre: sin él, el justificante no dice de quién es.');
    await expect(page.getByLabel('Tu nombre')).toBeFocused();
    await expect(page.getByLabel('Tu nombre')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/#\/tarea\//);
    // Spaces are no name.
    await page.getByLabel('Tu nombre').fill('   ');
    await page.getByLabel('Tu nombre').press('Enter');
    await expect(page).toHaveURL(/#\/tarea\//);

    await page.getByLabel('Tu nombre').fill('Ana García');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByLabel('Tu nombre').press('Enter');
    await ready(page);
    await expect(page).toHaveURL(/#\/jugar$/);
  });

  test('is played by the rules it was set with, whatever the player has chosen for their own games', async ({ page }) => {
    await begin(page, 'Ana García', TASK, { opts: { ...OPTS, tries: 3, hints: true, length: 10, format: 'timed' } });
    await expect(page.locator('.hud-main')).toHaveText('1 / 4');
    await expect(page.locator('.hud-clock')).toHaveCount(0);
    await expect(page.locator('.q .q-how')).toContainText('Solo hay un intento.');
    await expect(page.locator('.q-actions button')).toHaveText(['No lo sé', 'Terminar']);
    // The player's own choices are as they were.
    const own = await page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: { opts: Record<string, unknown> } }).state.opts);
    expect(own).toMatchObject({ tries: 3, hints: true, length: 10, format: 'timed' });
  });

  test('ends with a receipt: the name, how it went, when, and which attempt it was', async ({ page }) => {
    await begin(page);
    await hit(page);
    await hit(page);
    await miss(page);
    await next(page).click();
    await toEnd(page);
    await expect(title(page)).toHaveText('Partida terminada');

    await expect(box(page).locator('.receipt-main b')).toHaveText('Ana García');
    await expect(box(page).locator('.receipt-main span')).toHaveText('75\u00a0%');
    await expect(box(page).locator('.receipt-line')).toContainText('«Tema 4: Reino Unido» · respondidas 4 de 4 · ');
    await expect(box(page).locator('.receipt-line')).toContainText(' · intento 1');
    await expect(box(page).locator('.receipt-short')).toHaveCount(0);
    // What there is to do next is to send it: the keyboard is there, and not on the button that starts again.
    await expect(box(page).getByRole('button', { name: 'Copiar el justificante' })).toBeFocused();

    const receipt = await given(page);
    expect(receipt).toMatchObject({ version: 1, task: TASK, name: 'Ana García', ok: 3, warn: 0, bad: 1, total: 4, n: 1, sound: true });
    expect(Math.abs(receipt.at - Math.floor(Date.now() / 60000))).toBeLessThanOrEqual(1);
    // It is kept on the device it was made on, in case it is not sent at once; and the name, for the next one.
    await expect.poll(async () => (await kept(page))?.got.length).toBe(1);
    expect(await kept(page)).toMatchObject({ name: 'Ana García', got: [receipt.href.split('/justificante/')[1]] });
    // Homework is not a challenge to send to a friend, and it leaves no ghost to race.
    await expect(page.getByRole('button', { name: 'Retar a alguien' })).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Tu fantasma' })).toHaveCount(0);
    await expect(page.locator('.ghost-head')).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('regionle:ghosts'))).toBeNull();
  });

  test('copies the receipt as a line that says it and its link', async ({ page, context, baseURL }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await begin(page);
    await toEnd(page);
    const receipt = await given(page);
    await box(page).getByRole('button', { name: 'Copiar el justificante' }).click();
    await expect(box(page).getByRole('button', { name: 'Justificante copiado' })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const [line, url] = copied.split('\n');
    expect(line).toMatch(/^Justificante de Ana García, «Tema 4: Reino Unido»: 100\u00a0% \(respondidas 4 de 4, en \d+:\d\d\)\.$/);
    expect(url).toBe(receipt.href);
    expect(url.startsWith(`${baseURL}#/justificante/`)).toBe(true);
  });

  test('counts against it what was left unanswered, and says so before it is sent', async ({ page }) => {
    await begin(page);
    await hit(page);
    await page.getByRole('button', { name: 'Terminar' }).click();
    // The game speaks of the one question answered; the receipt, of the assignment.
    await expect(title(page)).toBeVisible();
    await expect(box(page).locator('.receipt-main span')).toHaveText('25\u00a0%');
    await expect(box(page).locator('.receipt-line')).toContainText('respondidas 1 de 4');
    await expect(box(page).locator('.receipt-short')).toHaveText('La has terminado antes de acabar: en el justificante, las 3 que no has respondido cuentan como falladas. Con «Otra vez» la haces entera.');
    expect(await given(page)).toMatchObject({ ok: 1, warn: 0, bad: 0, total: 4, sound: true });
  });

  test('gives no receipt for a game left with nothing answered, which is an attempt all the same', async ({ page }) => {
    await begin(page);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(title(page)).toBeVisible();
    await expect(box(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await ready(page);
    await toEnd(page);
    expect(await given(page)).toMatchObject({ ok: 4, n: 2 });
  });

  test('counts each time it is started: again is the second attempt, and the page says how many there were', async ({ page }) => {
    await begin(page);
    await toEnd(page);
    expect(await given(page)).toMatchObject({ n: 1, ok: 4 });
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await ready(page);
    await miss(page);
    await next(page).click();
    await toEnd(page);
    await expect(box(page).locator('.receipt-line')).toContainText(' · intento 2');
    expect(await given(page)).toMatchObject({ n: 2, ok: 3, bad: 1, sound: true });

    await page.goto(`./#/tarea/${TASK}`);
    // The name is there from the last time, and the count is the one under it.
    await expect(page.getByLabel('Tu nombre')).toHaveValue('Ana García');
    await expect(page.locator('.duel-rules')).toContainText('Con ese nombre, en este dispositivo la has empezado 2 veces.');
    // The count is of each name: whoever sits down next at the same computer starts at the first.
    await page.getByLabel('Tu nombre').fill('Bruno');
    await expect(page.locator('.duel-rules')).toHaveText('Puedes hacerla cuantas veces quieras: cada vez que la empiezas es un intento, y el justificante dice cuál es.');
    await page.getByLabel('Tu nombre').fill('ana garcia');
    await expect(page.locator('.duel-rules')).toContainText('la has empezado 2 veces.');
    // Both receipts are with their assignment, the first attempt first.
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toContainText('100\u00a0%');
    await expect(rows(page).nth(1)).toContainText('75\u00a0%');

    await page.getByLabel('Tu nombre').fill('Bruno');
    await page.getByRole('button', { name: 'Empezar la tarea' }).click();
    await ready(page);
    await toEnd(page);
    expect(await given(page)).toMatchObject({ name: 'Bruno', n: 1 });
  });

  test('keeps the receipt of a game that is started again the very moment it ends', async ({ page }) => {
    await begin(page);
    // «Otra vez» is pressed as the receipt is drawn. Nobody is that quick; a machine that tries the game out
    // can be, and so can a finger that was already on its way down.
    await page.evaluate(() => {
      const watch = new MutationObserver(() => {
        const again = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === 'Otra vez');
        if (!again || !document.querySelector('.receipt')) return;
        watch.disconnect();
        again.click();
      });
      watch.observe(document.body, { childList: true, subtree: true });
    });
    for (let i = 0; i < 3; i++) await hit(page);
    await piece(page, await asked(page)).click();
    // The second game is on: it is the second attempt, and the first one is kept with all it said.
    await expect.poll(async () => Object.values((await kept(page))?.n ?? {})).toEqual([2]);
    await expect(title(page)).toHaveCount(0);
    expect((await kept(page))?.got.map((code) => receiptOf(`#/justificante/${code}`))).toMatchObject([{ name: 'Ana García', n: 1, ok: 4, bad: 0, sound: true }]);
    await ready(page);
    await miss(page);
    await next(page).click();
    await toEnd(page);
    expect(await given(page)).toMatchObject({ n: 2, ok: 3, bad: 1 });

    await page.goto(`./#/tarea/${TASK}`);
    await expect(rows(page)).toHaveCount(2);
    await expect(rows(page).nth(0)).toContainText('100\u00a0%');
    await expect(rows(page).nth(1)).toContainText('75\u00a0%');
  });

  test('counts a game left half-way and opened again as one more attempt', async ({ page }) => {
    await begin(page);
    await hit(page);
    await page.reload();
    await ready(page);
    await expect(page.locator('.hud-main')).toHaveText('1 / 4');
    await toEnd(page);
    expect(await given(page)).toMatchObject({ n: 2, ok: 4 });
  });

  test('is not played anew when the page is opened again on a game that had ended: its receipt is with the assignment', async ({ page }) => {
    await begin(page);
    await toEnd(page);
    const receipt = await given(page);
    await expect.poll(async () => (await kept(page))?.done).toBeGreaterThan(0);
    // A phone that comes back from the chat the receipt was sent in often loads the page again.
    await page.reload();
    await expect(page).toHaveURL((url) => url.hash === `#/tarea/${TASK}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Tema 4: Reino Unido');
    await expect(page.locator('.duel-rules')).toContainText('la has empezado 1 vez.');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).getByRole('link', { name: 'Ana García' })).toHaveAttribute('href', `#/justificante/${receipt.href.split('/justificante/')[1]}`);
    // Its receipt is one click away, to be sent.
    await rows(page).getByRole('link', { name: 'Ana García' }).click();
    await expect(page.locator('.duel-page h1')).toHaveText('Ana García');
    await expect(seal(page)).toContainText('La cifra de control cuadra');
  });

  test('gives no receipt for the round of what was missed, which is not the assignment', async ({ page }) => {
    await begin(page);
    await miss(page);
    await next(page).click();
    await toEnd(page);
    await expect(box(page)).toBeVisible();
    await page.getByRole('button', { name: 'Repasar 1 fallo' }).click();
    await ready(page);
    await toEnd(page);
    await expect(box(page)).toHaveCount(0);
    // …and it is not one more attempt.
    expect(Object.values((await kept(page))!.n)).toEqual([1]);
  });

  test('set as an exam gives a mark out of ten, with what was left blank against it', async ({ page }) => {
    await begin(page, 'Bruno', 'Examen/regiones/GB:g1/pin/format=exam');
    await hit(page);
    await hit(page);
    await miss(page);
    await expect(page.locator('.hud-main')).toHaveText('4 / 4');
    await hit(page);
    await expect(title(page)).toHaveText('Nota: 7,5');
    await expect(box(page).locator('.receipt-main span')).toHaveText('Nota: 7,5');
    const receipt = await given(page);
    expect(receipt).toMatchObject({ name: 'Bruno', ok: 3, warn: 0, bad: 1, total: 4, sound: true });

    await page.goto(receipt.href);
    await expect(page.locator('.duel-what > span:last-child')).toHaveText('Regiones · Señalar · Examen · todas las preguntas');
    await expect(sheet(page, 'Resultado')).toHaveText('Nota: 7,5');
    // An exam has no answers with help.
    await expect(sheet(page, 'Con ayuda')).toHaveCount(0);
  });

  test('set against the clock gives the right answers there was time for', async ({ page }) => {
    await page.clock.install();
    await begin(page, 'Carla', '-/regiones/GB:g1/pin/format=timed;clock=30');
    await expect(page.locator('.hud-clock')).toHaveText('0:30');
    await hit(page);
    await hit(page);
    await page.clock.fastForward(31_000);
    await expect(title(page)).toHaveText('2 aciertos en 30 segundos');
    await expect(box(page).locator('.receipt-main span')).toHaveText('2 aciertos');
    // No title: the receipt goes by the name alone.
    await expect(box(page).locator('.receipt-line')).toContainText(/^respondidas 2 · /);
    const receipt = await given(page);
    expect(receipt).toMatchObject({ name: 'Carla', ok: 2, bad: 0, total: 0, secs: 30, sound: true });

    await page.goto(receipt.href);
    await expect(page.locator('.duel-what > span:last-child')).toHaveText('Regiones · Señalar · Contrarreloj · 30 segundos');
    await expect(sheet(page, 'Resultado')).toHaveText('2 aciertos');
    await expect(sheet(page, 'Respondidas')).toHaveText('2');
    await expect(sheet(page, 'Tiempo')).toHaveText('0:30');
  });

  test('says when its link names nothing that can be set', async ({ page }) => {
    await seed(page);
    for (const path of ['Tema', 'Tema/regiones', 'Tema/regiones/ZZ/pin', 'Tema/regiones/GB:g1/explore', 'Tema/regiones/GB:g1/nameall', 'Tema/regiones/GB:g1']) {
      await page.goto(`./#/tarea/${path}`);
      await expect(page.locator('.duel-page h1'), path).toHaveText('Este enlace no funciona');
      await expect(page.getByRole('button', { name: 'Empezar la tarea' })).toHaveCount(0);
    }
  });

  test('is in English for whoever plays in English', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto(`./#/tarea/${TASK}`);
    await expect(page.locator('.duel-what > span:last-child')).toHaveText('Regions · Pin it · every question · 1 try, no hints');
    await page.getByRole('button', { name: 'Start the homework' }).click();
    await expect(page.getByRole('alert')).toHaveText('Type your name: without it, the receipt does not say whose it is.');
    await page.getByLabel('Your name').fill('Ann');
    await page.getByRole('button', { name: 'Start the homework' }).click();
    await ready(page);
    await toEnd(page);
    await expect(box(page).locator('.receipt-line')).toContainText('“Tema 4: Reino Unido” · 4 of 4 answered · ');
    await expect(box(page).locator('.receipt-line')).toContainText(' · attempt 1');
    const href = await box(page).getByRole('link', { name: 'See it' }).getAttribute('href');
    await page.goto(href!);
    await expect(page.locator('.duel-page h1')).toHaveText('Ann');
    await expect(sheet(page, 'Result')).toHaveText('100\u00a0%');
    await expect(sheet(page, 'Attempt')).toHaveText('No. 1 on their device');
    await expect(seal(page)).toHaveText('The check figure holds: the link says what the game wrote when the game ended.');
    await expect(page.locator('.duel-rules')).toContainText('not cheat-proof');
  });

  test('fits a narrow screen, from the name to the receipt @movil', async ({ page }) => {
    const fits = async (what: string) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), what).toBeLessThanOrEqual(0);
    await assignment(page);
    await fits('the assignment');
    await page.getByLabel('Tu nombre').fill('Ana García Fernández de Córdoba');
    await page.getByRole('button', { name: 'Empezar la tarea' }).click();
    await ready(page);
    await toEnd(page);
    await expect(box(page).getByRole('button', { name: 'Copiar el justificante' })).toBeInViewport();
    await fits('the result');
    const inside = await box(page).evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(inside, 'the receipt inside its box').toBe(true);
    const receipt = await given(page);
    await page.goto(receipt.href);
    await expect(page.locator('.duel-page h1')).toHaveText('Ana García Fernández de Córdoba');
    await fits('the receipt');
  });
});

test.describe('a receipt, for whoever set the assignment', () => {
  const ANA = { name: 'Ana García', ok: 3, bad: 1, secs: 125, n: 2, at: 29_900_000 };

  test('says who, what, how it went and when, and that it is what the game wrote', async ({ page }) => {
    await seed(page);
    await page.goto(`./#/justificante/${receiptCode(ANA)}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Ana García');
    await expect(page.locator('.duel-page .lead')).toHaveText('«Tema 4: Reino Unido»');
    await expect(page.locator('.duel-what strong')).toHaveText('Reino Unido · naciones');
    await expect(page.locator('.duel-what > span:last-child')).toHaveText('Regiones · Señalar · todas las preguntas · 1 intento, sin pistas');
    await expect(sheet(page, 'Resultado')).toHaveText('75\u00a0%');
    await expect(sheet(page, 'Respondidas')).toHaveText('4 de 4');
    await expect(sheet(page, 'A la primera')).toHaveText('3');
    await expect(sheet(page, 'Con ayuda')).toHaveText('0');
    await expect(sheet(page, 'Fallos')).toHaveText('1');
    await expect(sheet(page, 'Tiempo')).toHaveText('2:05');
    await expect(sheet(page, 'Intento')).toHaveText('2.º en su dispositivo');
    // The date is told in the time of whoever reads it.
    const when = await page.evaluate((at) => {
      const d = new Date(at * 60000);
      return `${new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }).format(d)}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }, ANA.at);
    await expect(sheet(page, 'Fecha')).toHaveText(when);
    await expect(seal(page)).toHaveText('La cifra de control cuadra: el enlace dice lo que el juego escribió al acabar la partida.');
    await expect(seal(page)).not.toHaveClass(/broken/);
    // What it is worth is said where it is read.
    await expect(page.locator('.duel-rules')).toContainText('no es a prueba de trampas: quien sepa programar puede fabricar un justificante');
    await expect(page).toHaveTitle(/Justificante de tarea/);
    await expect(page.getByRole('link', { name: 'Ver la tarea' })).toHaveAttribute('href', `#/tarea/${TASK}`);
  });

  test('says what was left unanswered of an assignment that was not finished', async ({ page }) => {
    await seed(page);
    await page.goto(`./#/justificante/${receiptCode({ name: 'Bruno', ok: 1, bad: 0 })}`);
    await expect(sheet(page, 'Resultado')).toHaveText('25\u00a0%');
    await expect(sheet(page, 'Respondidas')).toHaveText('1 de 4 · sin terminar');
    await expect(sheet(page, 'Fallos')).toHaveText('0 · 3 sin responder');
  });

  test('gives away a link that was touched up, and does not keep it', async ({ page }) => {
    await seed(page);
    // Four right where there were three, under the check figure of the real one.
    const real = receiptCode(ANA);
    const forged = receiptCode({ ...ANA, ok: 4, bad: 0 }, real.split('.')[1]);
    await page.goto(`./#/justificante/${forged}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Ana García');
    await expect(sheet(page, 'Resultado')).toHaveText('100\u00a0%');
    await expect(seal(page)).toHaveClass(/broken/);
    await expect(page.getByRole('alert')).toHaveText('La cifra de control no cuadra: este enlace se ha cortado o lo han retocado. No lo des por bueno, y pide que te lo manden otra vez.');
    await expect(rows(page)).toHaveCount(0);
    expect((await kept(page))?.got ?? []).toEqual([]);

    // Without its check figure it does not hold either; and what is not a receipt at all is said to be none.
    await page.goto(`./#/justificante/${real.split('.')[0]}`);
    await expect(seal(page)).toHaveClass(/broken/);
    await page.goto('./#/justificante/nada-de-nada');
    await expect(page.locator('.duel-page h1')).toHaveText('Este justificante no se puede leer');
    await page.goto(`./#/justificante/${real.slice(0, 40)}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Este justificante no se puede leer');
  });

  test('gathers the receipts of the same assignment in a table, as they are opened', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await seed(page);
    await page.goto(`./#/justificante/${receiptCode(ANA)}`);
    await expect(page.locator('.receipt-class')).toContainText('Según abras en este dispositivo los demás justificantes de esta tarea');
    await expect(rows(page)).toHaveCount(0);

    await page.goto(`./#/justificante/${receiptCode({ name: 'Zoe', ok: 4, bad: 0, secs: 31 })}`);
    await expect(rows(page)).toHaveCount(2);
    await page.goto(`./#/justificante/${receiptCode({ name: 'Bruno', ok: 2, bad: 2, secs: 60, at: 29_900_100 })}`);
    await page.goto(`./#/justificante/${receiptCode({ ...ANA, ok: 4, bad: 0, n: 3, at: 29_900_500 })}`);
    // One of another assignment is not of this class.
    await page.goto(`./#/justificante/${receiptCode({ task: '-/regiones/GB:g1/pin', name: 'Otro', ok: 4, bad: 0 })}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Otro');
    await expect(rows(page)).toHaveCount(0);

    await page.goto(`./#/justificante/${receiptCode({ name: 'Bruno', ok: 2, bad: 2, secs: 60, at: 29_900_100 })}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Bruno');
    // By name, and each name from its first attempt to its last.
    await expect(rows(page).locator('th')).toHaveText(['Ana García', 'Ana García', 'Bruno', 'Zoe']);
    await expect(rows(page).locator('td:nth-child(2)')).toHaveText(['75\u00a0%', '100\u00a0%', '50\u00a0%', '100\u00a0%']);
    await expect(rows(page).locator('td:last-child')).toHaveText(['2', '3', '1', '1']);
    // The one that is open is marked among the others.
    await expect(page.locator('.receipt-table tr.now th')).toHaveText('Bruno');

    await page.getByRole('button', { name: 'Copiar la tabla' }).click();
    await expect(page.getByRole('button', { name: 'Tabla copiada' })).toBeVisible();
    const table = (await page.evaluate(() => navigator.clipboard.readText())).split('\n').map((line) => line.split('\t'));
    expect(table[0]).toEqual(['Nombre', 'Puntuación (%)', 'Respondidas', 'Preguntas', 'A la primera', 'Con ayuda', 'Fallos', 'Tiempo', 'Fecha', 'Intento']);
    expect(table.slice(1).map((row) => [row[0], row[1], row[2], row[3], row[4], row[6], row[7], row[9]])).toEqual([
      ['Ana García', '75', '4', '4', '3', '1', '2:05', '2'],
      ['Ana García', '100', '4', '4', '4', '0', '2:05', '3'],
      ['Bruno', '50', '4', '4', '2', '2', '1:00', '1'],
      ['Zoe', '100', '4', '4', '4', '0', '0:31', '1'],
    ]);

    // Each name is the way to its receipt.
    await rows(page).getByRole('link', { name: 'Zoe' }).click();
    await expect(page.locator('.duel-page h1')).toHaveText('Zoe');
    await expect(page.locator('.receipt-table tr.now th')).toHaveText('Zoe');
  });

  test('keeps the receipts opened on the device, assignment by assignment, until they are deleted', async ({ page }) => {
    await seed(page);
    await page.goto('./#/justificante');
    await expect(page.locator('.duel-page h1')).toHaveText('Justificantes abiertos aquí');
    await expect(page.locator('.duel-page .lead')).toContainText('Todavía ninguno.');

    await page.goto(`./#/justificante/${receiptCode(ANA)}`);
    await expect(seal(page)).toBeVisible();
    await page.goto(`./#/justificante/${receiptCode({ name: 'Zoe', ok: 4, bad: 0 })}`);
    await expect(rows(page)).toHaveCount(2);
    await page.goto(`./#/justificante/${receiptCode({ task: '-/regiones/GB:g1/pin/format=exam', name: 'Otro', ok: 3, bad: 1, at: 29_900_900 })}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Otro');
    await page.getByRole('link', { name: 'Todos los justificantes' }).click();

    const classes = page.locator('.duel-page > .receipt-class');
    await expect(classes).toHaveCount(2);
    // The assignment with the latest receipt first; one without a title goes by its map.
    await expect(classes.locator('h2')).toHaveText(['Reino Unido · naciones', 'Tema 4: Reino Unido']);
    await expect(classes.nth(0).locator('.task-what')).toContainText('Señalar · Examen · todas las preguntas');
    await expect(classes.nth(0).locator('tbody td:nth-child(2)')).toHaveText(['Nota: 7,5']);
    await expect(classes.nth(1).locator('tbody th')).toHaveText(['Ana García', 'Zoe']);
    // They are still there another day.
    await page.reload();
    await expect(classes).toHaveCount(2);

    await classes.nth(1).getByRole('button', { name: 'Borrar estos justificantes' }).click();
    await expect(classes).toHaveCount(1);
    await expect(classes.locator('h2')).toHaveText(['Reino Unido · naciones']);
    expect((await kept(page))!.got).toHaveLength(1);
    await classes.nth(0).getByRole('button', { name: 'Borrar estos justificantes' }).click();
    await expect(classes).toHaveCount(0);
    await expect(page.locator('.duel-page .lead')).toContainText('Todavía ninguno.');
    expect(await kept(page)).toBeNull();
  });

  test('is read even when its assignment is one this game does not know', async ({ page }) => {
    await seed(page);
    await page.goto(`./#/justificante/${receiptCode({ task: 'Vieja/regiones/ZZ/pin', name: 'Ana', ok: 3, bad: 1 })}`);
    await expect(page.locator('.duel-page h1')).toHaveText('Ana');
    await expect(page.locator('.task-problem')).toContainText('Este juego no reconoce la tarea de este justificante');
    await expect(sheet(page, 'Resultado')).toHaveText('75\u00a0%');
    await expect(page.getByRole('link', { name: 'Ver la tarea' })).toHaveCount(0);
  });
});
