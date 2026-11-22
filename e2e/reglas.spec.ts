/**
 * «Reglas a medida»: the player sets how the question games are played. Where the rules are set and what is
 * said of them, what each one does in a game (the tries of a question, the hints, how long the clock runs,
 * how many lives there are), where they do not reach (a review), and how they travel in a challenge and in a
 * game inside another page.
 *
 * The map is the United Kingdom by its four nations: a game is four questions.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed } from './helpers';

const UK = { section: 'regions', countries: ['GB'], mode: 'pin', levels: { GB: 'g1' } };
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

const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`);
const how = (page: Page) => page.locator('.q .q-how');
const actions = (page: Page) => page.locator('.q-actions button');
const next = (page: Page) => page.getByRole('button', { name: /^(Siguiente|Next)/ });
const title = (page: Page) => page.locator('.results-title');
const startbar = (page: Page) => page.locator('.startbar-info b');
const tries = (page: Page) => page.getByRole('radiogroup', { name: 'Intentos por pregunta' });
const clock = (page: Page) => page.getByRole('radiogroup', { name: 'Duración de la contrarreloj' });
const lives = (page: Page) => page.getByRole('radiogroup', { name: 'Vidas de la supervivencia' });
const format = (page: Page) => page.getByRole('radiogroup', { name: 'Formato de la partida' });
const hints = (page: Page) => page.locator('.options').getByRole('checkbox', { name: /^Pistas/ });
const flipHints = (page: Page) => page.locator('.options label.toggle').filter({ hasText: /^Pistas/ }).click();
const custom = (page: Page) => page.locator('.options .rules-custom');
/** What the browser keeps, as it is written. */
const state = (page: Page): Promise<Record<string, unknown>> => page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1') ?? '{"state":{}}') as { state: Record<string, unknown> }).state);
const optsKept = async (page: Page): Promise<Record<string, unknown>> => (await state(page)).opts as Record<string, unknown>;
const best = async (page: Page): Promise<Record<string, number>> => (await state(page)).best as Record<string, number>;

/** The setup of «Señalar» on the United Kingdom, with the options given. */
async function setup(page: Page, opts: Record<string, unknown> = {}, more: Record<string, unknown> = {}): Promise<void> {
  await seed(page, { sel: { regions: ['GB'] }, levels: { GB: 'g1' }, mode: { regions: 'pin' }, opts: { ...OPTS, length: 'all', ...opts }, ...more });
  await open(page, '/regiones');
  await expect(page.locator('.options')).toBeVisible();
}

/** A game on the four nations with the options given, ready for its first question; `kept` is what else the browser holds. */
async function begin(page: Page, opts: Record<string, unknown> = {}, more: Record<string, unknown> = {}, kept: Record<string, unknown> = {}): Promise<void> {
  await seed(page, { ...kept, game: { nonce: 1, ...UK, ...more, opts: { ...OPTS, length: 'all', ...opts } } });
  await page.goto('./#/jugar');
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
  await expect(page.locator('.q .q-prompt')).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
}

/** The piece the question on screen asks for. */
async function asked(page: Page): Promise<string> {
  const name = ((await page.locator('.q-name').textContent()) ?? '').trim();
  expect(ID[name], `the piece called ${name}`).toBeTruthy();
  return ID[name];
}

/**
 * A piece that is a wrong answer to the question about `id`: one that is still to be asked. (A click on a
 * piece that is already settled is no answer at all: the game says so and waits.)
 */
async function wrongOf(page: Page, id: string): Promise<string> {
  const open = await page.locator('.map-svg .m-items [data-id]:not([class*="st-"])').evaluateAll((els) => els.map((el) => el.getAttribute('data-id')!));
  const other = open.find((x) => x !== id);
  expect(other, `a piece still to be asked other than ${id}`).toBeTruthy();
  return other!;
}

/** A wrong click on the map. */
async function miss(page: Page): Promise<void> {
  const id = await asked(page);
  await piece(page, await wrongOf(page, id)).click();
}

/** The right click on the map; the next question, or the result, is there when it comes back. */
async function hit(page: Page): Promise<void> {
  const name = page.locator('.q-name');
  const now = ((await name.textContent()) ?? '').trim();
  await piece(page, await asked(page)).click();
  await expect(page.locator('.results-title').or(name.filter({ hasNotText: now }))).toBeVisible();
}

test.describe('the rules, where a game is set up', () => {
  test('are the usual ones until they are changed: three tries, and hints', async ({ page }) => {
    await setup(page);
    await expect(tries(page).getByRole('radio')).toHaveText(['1 intento', '2 intentos', '3 intentos']);
    await expect(tries(page).getByRole('radio', { checked: true })).toHaveText('3 intentos');
    await expect(hints(page)).toBeChecked();
    await expect(custom(page)).toHaveCount(0);
    await expect(startbar(page)).toHaveText('Señalar');
    // Neither a clock nor lives in a game at ease.
    await expect(clock(page)).toHaveCount(0);
    await expect(lives(page)).toHaveCount(0);
  });

  test('are said when they are not the usual ones, are kept, and have a way back', async ({ page }) => {
    await setup(page);
    await tries(page).getByRole('radio', { name: '1 intento' }).click();
    await flipHints(page);
    await expect(hints(page)).not.toBeChecked();
    await expect(custom(page)).toHaveText('Reglas a medida: 1 intento, sin pistas. Volver a las de siempre');
    await expect(startbar(page)).toHaveText('Señalar · 1 intento, sin pistas');
    await expect.poll(() => optsKept(page)).toMatchObject({ tries: 1, hints: false });

    // They stay as they were left.
    await page.reload();
    await expect(tries(page).getByRole('radio', { checked: true })).toHaveText('1 intento');
    await expect(hints(page)).not.toBeChecked();
    await expect(custom(page)).toBeVisible();

    await custom(page).getByRole('button', { name: 'Volver a las de siempre' }).click();
    await expect(tries(page).getByRole('radio', { checked: true })).toHaveText('3 intentos');
    await expect(hints(page)).toBeChecked();
    await expect(custom(page)).toHaveCount(0);
    await expect(startbar(page)).toHaveText('Señalar');
    await expect.poll(() => optsKept(page)).toMatchObject({ tries: 3, hints: true });
  });

  test('are those of the format chosen: a length for the clock, a number of lives, nothing for an exam', async ({ page }) => {
    await setup(page, { tries: 1, hints: false });
    await format(page).getByRole('radio', { name: 'Contrarreloj' }).click();
    await expect(tries(page)).toHaveCount(0);
    await expect(hints(page)).toHaveCount(0);
    await expect(clock(page).getByRole('radio')).toHaveText(['30 s', '1 min', '2 min', '5 min']);
    await expect(clock(page).getByRole('radio', { checked: true })).toHaveText('1 min');
    // The tries and the hints of a game at ease are of no account against the clock: nothing of them is said.
    await expect(custom(page)).toHaveCount(0);
    await expect(startbar(page)).toHaveText('Señalar · contrarreloj');
    await expect(page.locator('.options .opt-hint').filter({ hasText: 'un intento por pregunta' })).toHaveText('Un minuto, un intento por pregunta y sin pistas. Se guarda tu récord en cada mapa, uno por cada duración.');

    await clock(page).getByRole('radio', { name: '2 min' }).click();
    await expect(custom(page)).toHaveText('Reglas a medida: 2 minutos. Volver a las de siempre');
    await expect(startbar(page)).toHaveText('Señalar · contrarreloj · 2 minutos');
    await expect(page.locator('.options .opt-hint').filter({ hasText: 'un intento por pregunta' })).toContainText('2 minutos, un intento por pregunta y sin pistas.');

    await format(page).getByRole('radio', { name: 'Supervivencia' }).click();
    await expect(clock(page)).toHaveCount(0);
    await expect(lives(page).getByRole('radio')).toHaveText(['1 vida', '3 vidas', '5 vidas']);
    await expect(lives(page).getByRole('radio', { checked: true })).toHaveText('3 vidas');
    await expect(startbar(page)).toHaveText('Señalar · supervivencia');
    await lives(page).getByRole('radio', { name: '1 vida' }).click();
    await expect(custom(page)).toHaveText('Reglas a medida: 1 vida. Volver a las de siempre');
    await expect(page.locator('.options .opt-hint').filter({ hasText: 'Un intento por pregunta' })).toContainText('1 vida: el primer fallo termina la partida.');
    // The way back is for the rule in sight: the length of the clock stays as it was left.
    await custom(page).getByRole('button', { name: 'Volver a las de siempre' }).click();
    await expect(lives(page).getByRole('radio', { checked: true })).toHaveText('3 vidas');
    await expect.poll(() => optsKept(page)).toMatchObject({ lives: 3, clock: 120, tries: 1, hints: false });

    await format(page).getByRole('radio', { name: 'Examen' }).click();
    await expect(page.locator('.options .opt-label').filter({ hasText: 'Reglas' })).toHaveCount(0);
    await expect(startbar(page)).toHaveText('Señalar · examen');

    await format(page).getByRole('radio', { name: 'Dos jugadores' }).click();
    await expect(tries(page).getByRole('radio', { checked: true })).toHaveText('1 intento');
    await expect(startbar(page)).toHaveText('Señalar · dos jugadores · 1 intento, sin pistas');
  });

  test('offer the tries only where a question can take more than one', async ({ page }) => {
    await seed(page, { sel: { countries: ['ES', 'FR', 'PT', 'IT', 'DE'] }, mode: { countries: 'flag' }, opts: { ...OPTS, answer: 'choice', tries: 1 } });
    await open(page, '/paises');
    await expect(format(page)).toBeVisible();
    // Among four options there is one try whatever the rules say: there is nothing to set, and nothing to tell.
    await expect(tries(page)).toHaveCount(0);
    await expect(hints(page)).toBeChecked();
    await expect(custom(page)).toHaveCount(0);
    await expect(startbar(page)).toHaveText('Banderas');
    await page.getByRole('radiogroup', { name: 'Forma de responder' }).getByRole('radio', { name: 'Escribir' }).click();
    await expect(tries(page).getByRole('radio', { checked: true })).toHaveText('1 intento');
    await expect(startbar(page)).toHaveText('Banderas · 1 intento');
  });

  test('are not offered in a game that is not of questions', async ({ page }) => {
    await setup(page, { tries: 1, hints: false }, { mode: { regions: 'nameall' } });
    await expect(page.locator('.options')).toBeVisible();
    await expect(page.locator('.options .opt-label').filter({ hasText: 'Reglas' })).toHaveCount(0);
    await expect(startbar(page)).toHaveText('Rellenar el mapa');
  });

  test('are told by «Cómo se juega» when they are not the usual ones', async ({ page }) => {
    await setup(page, { tries: 2, hints: false });
    await page.locator('.help-open').click();
    const panel = page.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(panel.locator('.help-rules')).toHaveText('Reglas a medida: 2 intentos, sin pistas. Donde lo que sigue diga otra cosa, valen estas.');
    await panel.getByRole('button', { name: 'Entendido' }).click();
    await expect(panel).toHaveCount(0);
    await custom(page).getByRole('button', { name: 'Volver a las de siempre' }).click();
    await page.locator('.help-open').click();
    await expect(panel.locator('.help-steps')).toBeVisible();
    await expect(panel.locator('.help-rules')).toHaveCount(0);
  });

  test('are set up in English too', async ({ page }) => {
    await setup(page, {}, { lang: 'en' });
    const rule = page.getByRole('radiogroup', { name: 'Tries per question' });
    await expect(rule.getByRole('radio')).toHaveText(['1 try', '2 tries', '3 tries']);
    await rule.getByRole('radio', { name: '1 try' }).click();
    await page.locator('.options label.toggle').filter({ hasText: /^Hints/ }).click();
    await expect(custom(page)).toHaveText('Custom rules: 1 try, no hints. Back to the usual ones');
    await expect(startbar(page)).toHaveText('Pin it · 1 try, no hints');
    await page.getByRole('radiogroup', { name: 'Format of the game' }).getByRole('radio', { name: 'Time attack' }).click();
    await page.getByRole('radiogroup', { name: 'Length of the time attack' }).getByRole('radio', { name: '5 min' }).click();
    await expect(custom(page)).toHaveText('Custom rules: 5 minutes. Back to the usual ones');
    await page.getByRole('radiogroup', { name: 'Format of the game' }).getByRole('radio', { name: 'Survival' }).click();
    await page.getByRole('radiogroup', { name: 'Lives of the survival' }).getByRole('radio', { name: '5 lives' }).click();
    await expect(startbar(page)).toHaveText('Pin it · survival · 5 lives');
  });

  test('fit a narrow screen @movil', async ({ page }) => {
    await setup(page, { tries: 1, hints: false });
    await custom(page).scrollIntoViewIfNeeded();
    await expect(custom(page)).toBeVisible();
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(wide).toBeLessThanOrEqual(0);
    for (const box of [tries(page), custom(page)]) {
      const b = (await box.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    }
  });
});

test.describe('the tries of a question', () => {
  test('are one when one is asked for: the first miss settles it', async ({ page }) => {
    await begin(page, { tries: 1 });
    await expect(how(page)).toContainText('Solo hay un intento.');
    const id = await asked(page);
    await miss(page);
    await expect(page.locator('.verdict')).toContainText('Era aquí:');
    await expect(how(page)).toContainText('que parpadea para seguir');
    // The game goes on from the piece that blinks, and what was missed is on record as a miss.
    await piece(page, id).click();
    await expect(page.locator('.hud-main')).toHaveText('2 / 4');
    await expect(how(page)).toContainText('Solo hay un intento.');
  });

  test('are two when two are asked for', async ({ page }) => {
    await begin(page, { tries: 2 });
    await expect(how(page)).toContainText('Te quedan 2 intentos.');
    await miss(page);
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(how(page)).toContainText('Te queda 1 intento.');
    await expect(page.locator('.q-note')).toContainText('Eso es');
    await miss(page);
    await expect(page.locator('.verdict')).toContainText('Era aquí:');
  });

  test('count a right answer on the second try as one with help', async ({ page }) => {
    await begin(page, { tries: 2 });
    await miss(page);
    await piece(page, await asked(page)).click();
    await expect(page.locator('.verdict')).toContainText('Bien, con ayuda:');
  });

  test('are the usual three when the options say nothing of them, or something that cannot be', async ({ page }) => {
    await begin(page, { tries: 7, hints: 'x' });
    await expect(how(page)).toContainText('Te quedan 3 intentos.');
    await expect(actions(page)).toHaveText(['Pista', 'Otra pista', 'No lo sé', 'Terminar']);
  });

  test('are as many when the answer is typed', async ({ page }) => {
    await begin(page, { tries: 2, answer: 'type' }, { mode: 'identify' });
    await page.locator('.answer-input').fill('Atlántida');
    await page.keyboard.press('Enter');
    await expect(page.locator('.q-note')).toContainText('Te queda 1 intento.');
    await page.locator('.answer-input').fill('Atlántida');
    await page.keyboard.press('Enter');
    await expect(page.locator('.verdict')).toContainText('Era');
  });
});

test.describe('a game without hints', () => {
  test('has no hint to ask for, on the map', async ({ page }) => {
    await begin(page, { hints: false });
    await expect(actions(page)).toHaveText(['No lo sé', 'Terminar']);
    await expect(page.locator('.q-more-btn')).toHaveCount(0);
    // The tries are the usual ones: each rule is its own.
    await expect(how(page)).toContainText('Te quedan 3 intentos.');
    // A miss still says which piece was clicked: that is the answer to a try, not a hint.
    await miss(page);
    await expect(page.locator('.q-note')).toContainText('Eso es');
    await expect(actions(page)).toHaveText(['No lo sé', 'Terminar']);
  });

  test('has none when the answer is typed or picked', async ({ page }) => {
    await begin(page, { hints: false, answer: 'type' }, { mode: 'identify' });
    await expect(page.locator('.answer-input')).toBeVisible();
    await expect(actions(page)).toHaveText(['No lo sé', 'Terminar']);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(title(page)).toBeVisible();
  });

  test('has them all when they are not taken away', async ({ page }) => {
    await begin(page, { hints: true, tries: 1 });
    await expect(actions(page)).toHaveText(['Pista', 'Otra pista', 'No lo sé', 'Terminar']);
    await page.getByRole('button', { name: 'Pista', exact: true }).click();
    await piece(page, await asked(page)).click();
    await expect(page.locator('.verdict')).toContainText('Bien, con ayuda:');
  });

  test('says so in «Cómo se juega», over the game', async ({ page }) => {
    await begin(page, { hints: false, tries: 1 });
    await page.locator('.play-help').click();
    const panel = page.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(panel.locator('.help-rules')).toContainText('Reglas a medida: 1 intento, sin pistas.');
  });
});

test.describe('the length of a time attack', () => {
  test('is the one asked for: half a minute, with a record of its own', async ({ page }) => {
    await page.clock.install();
    await begin(page, { format: 'timed', clock: 30 }, {});
    await expect(page.locator('.hud-clock')).toHaveText('0:30');
    await hit(page);
    await page.clock.fastForward(20_000);
    await expect(title(page)).toHaveCount(0);
    await page.clock.fastForward(11_000);
    await expect(title(page)).toHaveText('1 acierto en 30 segundos');
    await expect(page.locator('.results-note')).toHaveText('Nuevo récord de contrarreloj de 30 segundos en este mapa.');
    const kept = await best(page);
    expect(Object.keys(kept).filter((k) => k.startsWith('timed'))).toEqual(['timed30:pin:r:GB.g1']);
    expect(kept['timed30:pin:r:GB.g1']).toBe(1);
  });

  test('is a minute when nothing else is asked for, and its record keeps the name it always had', async ({ page }) => {
    await page.clock.install();
    await begin(page, { format: 'timed' });
    await expect(page.locator('.hud-clock')).toHaveText('1:00');
    await hit(page);
    await hit(page);
    await page.clock.fastForward(45_000);
    await expect(title(page)).toHaveCount(0);
    await page.clock.fastForward(16_000);
    await expect(title(page)).toHaveText('2 aciertos en un minuto');
    await expect(page.locator('.results-note')).toHaveText('Nuevo récord de contrarreloj en este mapa.');
    expect(await best(page)).toMatchObject({ 'timed:pin:r:GB.g1': 2 });
  });

  test('is two minutes when two are asked for, and the record of one minute is not touched', async ({ page }) => {
    await page.clock.install();
    await begin(page, { format: 'timed', clock: 120 }, {}, { best: { 'timed:pin:r:GB.g1': 9 } });
    await expect(page.locator('.hud-clock')).toHaveText('2:00');
    await hit(page);
    await page.clock.fastForward(61_000);
    await expect(title(page)).toHaveCount(0);
    await page.clock.fastForward(60_000);
    await expect(title(page)).toHaveText('1 acierto en 2 minutos');
    await expect(page.locator('.results-note')).toHaveText('Nuevo récord de contrarreloj de 2 minutos en este mapa.');
    expect(await best(page)).toMatchObject({ 'timed:pin:r:GB.g1': 9, 'timed120:pin:r:GB.g1': 1 });
  });
});

test.describe('the lives of a survival', () => {
  test('are one when one is asked for: the first miss ends the game', async ({ page }) => {
    await begin(page, { format: 'lives', lives: 1 });
    await expect(page.locator('.hud-lives')).toHaveAccessibleName('Vidas: 1 de 1');
    await expect(page.locator('.hud-lives svg')).toHaveCount(1);
    await hit(page);
    await miss(page);
    await expect(page.locator('.verdict')).toContainText('Te has quedado sin vidas.');
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(title(page)).toHaveText('1 acierto');
    await expect(page.locator('.results-note')).toHaveText('Nuevo récord de supervivencia de 1 vida en este mapa.');
    const kept = await best(page);
    expect(Object.keys(kept).filter((k) => k.startsWith('lives'))).toEqual(['lives1:pin:r:GB.g1']);
  });

  test('are five when five are asked for', async ({ page }) => {
    await begin(page, { format: 'lives', lives: 5 });
    await expect(page.locator('.hud-lives')).toHaveAccessibleName('Vidas: 5 de 5');
    await expect(page.locator('.hud-lives svg')).toHaveCount(5);
    for (let i = 0; i < 4; i++) {
      await miss(page);
      await expect(page.locator('.hud-lives')).toHaveAccessibleName(`Vidas: ${4 - i} de 5`);
      await expect(page.locator('.verdict')).not.toContainText('Te has quedado sin vidas.');
      await next(page).click();
    }
    await miss(page);
    await expect(page.locator('.hud-lives')).toHaveAccessibleName('Vidas: 0 de 5');
    await expect(page.locator('.verdict')).toContainText('Te has quedado sin vidas.');
  });

  test('are the usual three when nothing else is asked for, with the record under the name it always had', async ({ page }) => {
    await begin(page, { format: 'lives', tries: 1, hints: false, clock: 30 });
    await expect(page.locator('.hud-lives')).toHaveAccessibleName('Vidas: 3 de 3');
    await hit(page);
    for (let i = 0; i < 3; i++) {
      await miss(page);
      if (i < 2) await next(page).click();
    }
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-note')).toHaveText('Nuevo récord de supervivencia en este mapa.');
    expect(await best(page)).toMatchObject({ 'lives:pin:r:GB.g1': 1 });
  });
});

test.describe('where the rules do not reach', () => {
  test('a review is played by the usual ones, whatever the options say', async ({ page }) => {
    await begin(page, { tries: 1, hints: false }, { review: true });
    await expect(how(page)).toContainText('Te quedan 3 intentos.');
    await expect(actions(page).first()).toHaveText('Pista');
  });

  test('an exam is one try and no hints, whatever the options say', async ({ page }) => {
    await begin(page, { format: 'exam', tries: 3, hints: true });
    await expect(how(page)).toContainText('El primer clic es tu respuesta.');
    await expect(actions(page)).toHaveText(['Dejar en blanco', 'Entregar']);
  });
});

test.describe('the rules, where a game travels', () => {
  /** A challenge as the link carries it: the four nations, pinned, with what `o` says of the options. */
  const duel = (o: unknown[]): string => `./#/duelo/${Buffer.from(JSON.stringify({ s: 'regions', m: 'pin', c: 'GB', l: { GB: 'g1' }, k: 5, o, v: 2, f: 'Ana', r: [75, 20_000] })).toString('base64url')}`;

  test('a challenge is played by the rules it was sent with, whatever the receiver has set', async ({ page }) => {
    await seed(page, { opts: { ...OPTS, tries: 3, hints: true } });
    await page.goto(duel(['type', 'all', 'name', 'top', 25, 0, 'plain', 1, 0]));
    await expect(page.locator('.duel-page h1')).toHaveText('Ana te reta');
    // What is being accepted is said, the rules with it.
    await expect(page.locator('.duel-what')).toContainText('todas las preguntas · escribiendo · 1 intento, sin pistas');
    await page.getByRole('button', { name: 'Aceptar el reto' }).click();
    await expect(how(page)).toContainText('Solo hay un intento.', { timeout: 30_000 });
    await expect(actions(page)).toHaveText(['No lo sé', 'Terminar']);
    // The receiver's own rules are as they were.
    expect(await optsKept(page)).toMatchObject({ tries: 3, hints: true });
  });

  test('a challenge that says nothing of the rules is played by the usual ones, whatever the receiver has set', async ({ page }) => {
    await seed(page, { opts: { ...OPTS, tries: 1, hints: false } });
    await page.goto(duel(['type', 'all', 'name', 'top', 25]));
    await expect(page.locator('.duel-what')).not.toContainText('intento');
    await page.getByRole('button', { name: 'Aceptar el reto' }).click();
    await expect(how(page)).toContainText('Te quedan 3 intentos.', { timeout: 30_000 });
    await expect(actions(page)).toHaveText(['Pista', 'Otra pista', 'No lo sé', 'Terminar']);
    expect(await optsKept(page)).toMatchObject({ tries: 1, hints: false });
  });

  test('the challenge a game sends carries its rules', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await begin(page, { tries: 1, hints: false });
    for (let i = 0; i < 4; i++) await hit(page);
    await expect(title(page)).toBeVisible();
    await page.getByRole('button', { name: 'Retar a alguien' }).click();
    await expect(page.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    const code = /#\/duelo\/([A-Za-z0-9_-]+)/.exec(copied)![1];
    const wire = JSON.parse(Buffer.from(code, 'base64url').toString('utf8')) as { o: unknown[] };
    expect(wire.o.slice(5)).toEqual([0, 'plain', 1, 0]);
  });

  /** A game inside another page, started from its card: the rules are shown first to a visitor who has never played. */
  async function embedded(page: Page, baseURL: string | undefined, rest: string) {
    await page.goto(`${baseURL}es.html#/incrustar/${rest}`);
    await page.locator('.embed-box').getByRole('button', { name: 'Empezar' }).click();
    const panel = page.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(panel).toBeVisible({ timeout: 30_000 });
    return panel;
  }

  test('a game inside another page is played by the rules its address carries', async ({ page, baseURL }) => {
    const panel = await embedded(page, baseURL, 'regiones/GB:g1/pin/length=all;tries=1;hints=0');
    // «Cómo se juega» tells the usual rules: these are said on top of it.
    await expect(panel.locator('.help-rules')).toContainText('Reglas a medida: 1 intento, sin pistas.');
    await panel.getByRole('button', { name: 'Empezar' }).click();
    await expect(how(page)).toContainText('Solo hay un intento.', { timeout: 30_000 });
    await expect(actions(page)).toHaveText(['No lo sé', 'Terminar']);
  });

  test('a game inside another page lasts what its address says', async ({ page, baseURL }) => {
    const panel = await embedded(page, baseURL, 'regiones/GB:g1/pin/format=lives;lives=5');
    await expect(panel.locator('.help-rules')).toContainText('Reglas a medida: 5 vidas.');
    await panel.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.hud-lives')).toHaveAccessibleName('Vidas: 5 de 5', { timeout: 30_000 });
  });

  test('a game inside another page with the usual rules says nothing of them', async ({ page, baseURL }) => {
    const panel = await embedded(page, baseURL, 'regiones/GB:g1/pin/length=all');
    await expect(panel.locator('.help-steps')).toBeVisible();
    await expect(panel.locator('.help-rules')).toHaveCount(0);
    await panel.getByRole('button', { name: 'Empezar' }).click();
    await expect(how(page)).toContainText('Te quedan 3 intentos.', { timeout: 30_000 });
  });
});
