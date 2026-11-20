/**
 * The lessons of "Aprender", to the taste of whoever takes them: how many new pieces each one brings and
 * the order they come in.
 */
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start } from './helpers';

const COMMUNITIES = { section: 'regions', mode: 'learn', countries: ['ES'], levels: { ES: 'g1' } };
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state as { opts: Record<string, unknown> });
const kicker = (page: Page) => page.locator('.q-prompt .kicker');
const option = (page: Page, label: string) => page.locator('.options .opt', { has: page.locator('.opt-label', { hasText: new RegExp(`^${label}$`) }) });

/** The names of the new pieces of the lesson on screen, in the order they are shown. */
async function shown(page: Page, count: number): Promise<string[]> {
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    await expect(kicker(page)).toContainText(`${i + 1} de ${count}`);
    names.push(((await page.locator('.q-name').textContent()) ?? '').trim());
    if (i < count - 1) await page.getByRole('button', { name: 'Siguiente' }).click();
  }
  return names;
}

test.describe('lessons to the taste of the player', () => {
  test('bring five new pieces, corner by corner of the map, unless told otherwise', async ({ page }) => {
    await start(page, { ...COMMUNITIES, opts: OPTS });
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 5');
    // The largest piece of the map, and the ones around it.
    const names = await shown(page, 5);
    expect(names[0]).toBe('Castilla y León');
    expect(names).toContain('Comunidad de Madrid');
    await expect(page.getByRole('button', { name: 'Empezar a practicar' })).toBeVisible();
  });

  test('are as long as asked and in the order asked, and the choice is kept', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, mode: { regions: 'learn' } });
    await open(page, '/regiones');
    const size = option(page, 'Piezas por lección');
    const order = option(page, 'Orden');
    await expect(size.getByRole('radio', { name: '5', exact: true })).toBeChecked();
    await expect(size.locator('.opt-hint')).toContainText('unas 16 preguntas');
    await expect(order.getByRole('radio')).toHaveText(['Por zonas', 'Por tamaño', 'Alfabético']);
    await expect(order.getByRole('radio', { name: 'Por zonas' })).toBeChecked();

    await size.getByRole('radio', { name: '3', exact: true }).click();
    await expect(size.locator('.opt-hint')).toContainText('unas 12 preguntas');
    await order.getByRole('radio', { name: 'Alfabético' }).click();
    await expect(order.locator('.opt-hint')).toContainText('Por sus nombres');
    expect((await kept(page)).opts).toMatchObject({ lessonSize: 3, lessonOrder: 'abc' });

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 3', { timeout: 30_000 });
    expect(await shown(page, 3)).toEqual(['Andalucía', 'Aragón', 'Asturias']);
    // The questions of a lesson of three: where each is, what each is called, and the three again.
    await page.getByRole('button', { name: 'Empezar a practicar' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · señala en el mapa');
  });

  test('come from the largest to the smallest when asked by size', async ({ page }) => {
    await start(page, { ...COMMUNITIES, opts: { ...OPTS, lessonSize: 3, lessonOrder: 'size' } });
    expect(await shown(page, 3)).toEqual(['Castilla y León', 'Andalucía', 'Castilla-La Mancha']);
    // Eight at a time, the map of nineteen takes three lessons.
    await restart(page, { ...COMMUNITIES, opts: { ...OPTS, lessonSize: 8, lessonOrder: 'size' } });
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 8');
  });

  test('offer each map the orders it has: cities by their people, and no size for rivers and peaks', async ({ page }) => {
    await seed(page, { sel: { cities: ['ES'], physical: ['river', 'EU'] }, mode: { cities: 'learn', physical: 'learn' } });
    await open(page, '/ciudades');
    const order = option(page, 'Orden');
    await expect(order.getByRole('radio')).toHaveText(['Por zonas', 'Por habitantes', 'Alfabético']);
    // Cities come by size unless told otherwise.
    await expect(order.getByRole('radio', { name: 'Por habitantes' })).toBeChecked();
    await expect(order.locator('.opt-hint')).toHaveText('Primero las ciudades con más habitantes.');
    await order.getByRole('radio', { name: 'Por zonas' }).click();
    expect((await kept(page)).opts.lessonOrder).toBe('near');

    await open(page, '/fisica');
    await expect(option(page, 'Orden').getByRole('radio')).toHaveText(['Por zonas', 'Alfabético']);
    await expect(option(page, 'Orden').getByRole('radio', { name: 'Por zonas' })).toBeChecked();
    // A game that is not made of lessons has neither option.
    await page.getByRole('button', { name: 'Señalar' }).click();
    await expect(option(page, 'Piezas por lección')).toHaveCount(0);
    await expect(option(page, 'Orden')).toHaveCount(0);
  });
});

test.describe('the map of a lesson', () => {
  test('has every new piece in sight when the questions start, however fast the cards were gone through', async ({ page }) => {
    await start(page, { ...COMMUNITIES, opts: { ...OPTS, lessonSize: 3, lessonOrder: 'abc' } });
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 3');
    // Straight through the cards: the map has hardly set off for the last of them when the questions come.
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Siguiente' }).click();
    await page.getByRole('button', { name: 'Empezar a practicar' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · señala en el mapa');
    // Andalucía, Aragón and Asturias: whichever is asked, it is there to be pointed at once the map stops.
    const inSight = () =>
      page.evaluate(() => {
        const box = document.querySelector('.map-svg')!.getBoundingClientRect();
        return ['ES-AN', 'ES-AR', 'ES-AS'].every((id) => {
          const r = document.querySelector(`.map-svg [data-id="${id}"]`)!.getBoundingClientRect();
          return r.left >= box.left && r.top >= box.top && r.right <= box.right && r.bottom <= box.bottom;
        });
      });
    await expect.poll(inSight).toBe(true);
    // And it stays so: the move that was under way does not carry the map off afterwards.
    await page.waitForTimeout(900);
    expect(await inSight()).toBe(true);
  });
});

/** Eight communities of the north and the middle of Spain: more than a lesson, and few enough to be asked whole. */
const EIGHT: Record<string, string> = {
  'ES-GA': 'Galicia',
  'ES-AS': 'Asturias',
  'ES-CB': 'Cantabria',
  'ES-PV': 'País Vasco',
  'ES-NC': 'Navarra',
  'ES-RI': 'La Rioja',
  'ES-AR': 'Aragón',
  'ES-CL': 'Castilla y León',
};
const idOf = (name: string): string => Object.keys(EIGHT).find((id) => EIGHT[id] === name)!;
const offer = (page: Page) => page.getByRole('button', { name: 'Haz la prueba de nivel' });
const stats = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state.stats as Record<string, number[]>);

/**
 * Takes the placement test on screen to its end as someone who knows `known` and nothing else: what they
 * know they place and name, and of the rest they say that they do not know it. Returns what was asked.
 */
async function sit(page: Page, known: string[]): Promise<string[]> {
  const asked: string[] = [];
  for (let i = 0; i < 40; i++) {
    const text = (await kicker(page).textContent()) ?? '';
    if (!text.includes('Prueba de nivel ·')) break;
    const naming = text.includes('identifica');
    const id = naming ? (await page.locator('.map-svg path[data-id].st-target').first().getAttribute('data-id'))! : idOf(((await page.locator('.q-name').textContent()) ?? '').trim());
    asked.push(`${naming ? 'name' : 'pin'}:${id}`);
    if (!known.includes(id)) {
      await page.getByRole('button', { name: 'No lo sé' }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
    } else if (naming) {
      await page.locator('.answer-input').fill(EIGHT[id]);
      await page.keyboard.press('Enter');
    } else await page.locator(`.map-svg [data-id="${id}"]`).click();
    // A right answer moves on by itself: once what it said is gone, the next question is on screen, or the end.
    await expect(page.locator('.verdict')).toHaveCount(0);
  }
  return asked;
}

test.describe('the placement test of the lessons', () => {
  test('asks each piece once, where it is and what it is called, and the lessons skip what was got right', async ({ page }) => {
    await start(page, { ...COMMUNITIES, only: Object.keys(EIGHT), opts: { ...OPTS, lessonOrder: 'abc' } });
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 5');
    await expect(page.locator('.learn-level')).toHaveText('¿Ya te sabes parte de este mapa? Haz la prueba de nivel: las lecciones se saltarán lo que aciertes.');
    await offer(page).click();
    await expect(kicker(page)).toHaveText('Prueba de nivel · señala en el mapa');
    await expect(page.locator('.q-how')).toContainText('Un solo intento: lo que no sepas se queda para las lecciones.');
    // No names on the map to read the answer from, and every piece of it can be pointed at.
    await expect(page.locator('.map-svg .m-lbl')).toHaveCount(0);

    const known = ['ES-GA', 'ES-AS', 'ES-CB', 'ES-PV', 'ES-CL'];
    const asked = await sit(page, known);
    // Where each of the eight is, and what the five that were placed are called: no more, and none twice.
    expect(asked.filter((q) => q.startsWith('pin:')).sort()).toEqual(Object.keys(EIGHT).map((id) => `pin:${id}`).sort());
    expect(asked.filter((q) => q.startsWith('name:')).sort()).toEqual(known.map((id) => `name:${id}`).sort());
    // What a piece is called is not asked with its name still on screen.
    for (const id of known) expect(asked.indexOf(`name:${id}`) - asked.indexOf(`pin:${id}`)).toBeGreaterThan(1);

    await expect(kicker(page)).toHaveText('Prueba de nivel');
    await expect(page.locator('.q-ask')).toHaveText('Ya te sabes 5 de las 8 comunidades autónomas');
    await expect(page.locator('.q-note')).toHaveText('En el mapa, en verde, lo que ya sabes situar y nombrar. Las lecciones se lo saltan y siguen con las 3 que faltan.');
    await expect(page.locator('.hud-main')).toHaveText('5 / 8');
    await expect(page.locator('.map-svg path[data-id].st-ok')).toHaveCount(5);
    // What was got right is written down as any other answer; what was not known is not a miss.
    const kept = await stats(page);
    expect(Object.keys(kept).sort()).toEqual(known.flatMap((id) => [`loc:${id}`, `name:${id}`]).sort());
    expect(Object.values(kept).every((s) => s[0] === 1 && s[1] === 1)).toBe(true);

    // The lessons go on with the three that are left, and are still the first lesson.
    await page.getByRole('button', { name: 'Empezar las lecciones' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 3');
    expect(await shown(page, 3)).toEqual(['Aragón', 'La Rioja', 'Navarra']);
    // Taken once: it is not offered again.
    await expect(offer(page)).toHaveCount(0);
    // Another day, the lessons start from what the test left known.
    await page.reload();
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 3', { timeout: 30_000 });
    await expect(page.locator('.hud-main')).toHaveText('5 / 8');
  });

  test('gives one try and no hints, and can be left half way', async ({ page }) => {
    await start(page, { ...COMMUNITIES, only: Object.keys(EIGHT), opts: OPTS });
    await offer(page).click();
    const first = idOf(((await page.locator('.q-name').textContent()) ?? '').trim());
    const other = Object.keys(EIGHT).find((id) => id !== first)!;
    // A piece taken for another: no second try, and it is shown where it was.
    await page.locator(`.map-svg [data-id="${other}"]`).click();
    await expect(page.locator('.verdict')).toContainText(`Era aquí: ${EIGHT[first]}`);
    await expect(page.locator('.verdict')).toContainText('Se queda para las lecciones.');
    await page.getByRole('button', { name: 'Siguiente' }).click();
    // Placed right, the next one comes by itself; nothing is known until it has been named too.
    const second = idOf(((await page.locator('.q-name').textContent()) ?? '').trim());
    await page.locator(`.map-svg [data-id="${second}"]`).click();
    await expect(page.locator('.verdict')).toHaveCount(0);
    await expect(page.locator('.hud-main')).toHaveText('0 / 8');
    await expect(page.getByRole('button', { name: 'Una letra' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Salir', exact: true })).toHaveCount(1);

    await page.getByRole('button', { name: 'Terminar la prueba' }).click();
    await expect(page.locator('.q-ask')).toHaveText('Este mapa es nuevo para ti');
    await expect(page.locator('.q-note')).toHaveText('Las lecciones empiezan por el principio, unas pocas piezas cada vez.');
    // Nothing held against the piece that was missed: only the one that was placed is written down.
    expect(Object.keys(await stats(page))).toEqual([`loc:${second}`]);
    await page.getByRole('button', { name: 'Empezar las lecciones' }).click();
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 5');
  });

  test('is for a map with more than a lesson left, and goes straight to the end when all of it is known', async ({ page }) => {
    // Five pieces are one lesson: there is nothing to skip.
    await start(page, { ...COMMUNITIES, only: Object.keys(EIGHT).slice(0, 5), opts: OPTS });
    await expect(kicker(page)).toHaveText('Lección 1 · nueva 1 de 5');
    await expect(offer(page)).toHaveCount(0);

    // Six, lessons of three: whoever knows them all has no lesson to take.
    await restart(page, { ...COMMUNITIES, only: Object.keys(EIGHT).slice(0, 6), opts: { ...OPTS, lessonSize: 3 } });
    await offer(page).click();
    await sit(page, Object.keys(EIGHT));
    await expect(page.locator('.q-ask')).toHaveText('Te sabes el mapa entero');
    await expect(page.getByRole('button', { name: 'Ponerme a prueba' })).toBeVisible();
    await expect(page.locator('.hud-main')).toHaveText('6 / 6');
  });

  test('is told in English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { nonce: 1, ...COMMUNITIES, only: Object.keys(EIGHT), opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.learn-level')).toHaveText('Do you already know part of this map? Take the placement test: the lessons will skip what you get right.', { timeout: 30_000 });
    await page.getByRole('button', { name: 'Take the placement test' }).click();
    await expect(kicker(page)).toHaveText('Placement test · find it on the map');
    await expect(page.locator('.q-how')).toContainText('One try: what you do not know is left for the lessons.');
    await page.getByRole('button', { name: 'End the test' }).click();
    await expect(page.locator('.q-ask')).toHaveText('This map is new to you');
    await expect(page.getByRole('button', { name: 'Start the lessons' })).toBeVisible();
  });
});
