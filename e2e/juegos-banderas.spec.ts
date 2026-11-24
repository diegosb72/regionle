/**
 * The games of the section «Banderas»: where they are chosen (`#/banderas`) and each of the four, played
 * through. What comes up in a game is drawn by lot: the tests read on the screen which flag or which name
 * is asked, and know from the lists the site is built with what the answer is.
 */
import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, seed } from './helpers';

interface Land {
  id: string;
  fl?: string;
  cl: string;
  ct: string;
  n: { es: string; en?: string };
}
const INDEX = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Land[] };
const FLAGS = JSON.parse(fs.readFileSync('public/data/flags.json', 'utf8')) as { regions: Record<string, [string, number, string, string, string, number, string?][]> };
const ALIKE = JSON.parse(fs.readFileSync('public/data/alike/countries.json', 'utf8')) as { groups: Record<string, { pics: string[]; same: number[][]; near: number[][] }> };
const SAME = JSON.parse(fs.readFileSync('public/data/alike/same.json', 'utf8')) as { same: string[][] };

const STATES = INDEX.countries.filter((c) => c.fl && ['un', 'obs', 'partial'].includes(c.cl));
const EUROPE = STATES.filter((c) => c.ct === 'EU');
const byCode = new Map(INDEX.countries.filter((c) => c.fl).map((c) => [c.fl!, c]));
const byName = new Map(STATES.map((c) => [c.n.es, c]));
/** The file a picture is in, from its address. */
const fileOf = (src: string | null): string => (src ?? '').split('/').pop() ?? '';
const codeOf = (src: string | null): string => fileOf(src).replace(/\.svg$/, '');
const hud = (page: Page) => page.locator('.hud-main');
const verdict = (page: Page) => page.locator('.verdict');
const names = (page: Page) => page.locator('.fq-choices .choice');
const flags = (page: Page) => page.locator('.fq-opts .fq-opt');
const kept = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> }).state);

/** The country whose flag is on screen, in the games that show one. */
async function shown(page: Page): Promise<Land> {
  const land = byCode.get(codeOf(await page.locator('.fq-flag img').getAttribute('src')));
  expect(land).toBeTruthy();
  return land!;
}

/** Answers the question on screen: with its own name, or with another of the four. */
async function say(page: Page, right: boolean): Promise<Land> {
  const land = await shown(page);
  if (right) await page.getByRole('button', { name: land.n.es, exact: true }).click();
  else await names(page).filter({ hasNotText: new RegExp(`^\\d${land.n.es.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }).first().click();
  await expect(verdict(page)).toBeVisible();
  return land;
}

test.describe('where the games of the flags are chosen', () => {
  test('opens with the countries of the world and the first game, and says what is going to be played', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    await expect(page).toHaveTitle('Banderas del mundo — Regionle ∞');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Banderas del mundo');
    await expect(page.locator('nav.nav a[href="#/banderas"]')).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Países' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.chip.on')).toHaveText(`Todo el mundo ${STATES.length}`);
    await expect(page.locator('.fgm-set-name')).toHaveText(`Países del mundo · ${STATES.length} banderas`);
    // The four games, the first one chosen; what is typed is offered where the answer is a name.
    await expect(page.locator('.modes .mode')).toHaveText([/^¿De dónde es\?/, /^¿Cuál es su bandera\?/, /^Casi iguales/, /^Poco a poco/]);
    await expect(page.getByRole('button', { name: /^¿De dónde es\?/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.mode-about')).toContainText('Fácil. Sale una bandera y dices de dónde es');
    await expect(page.locator('.mode-facts')).toHaveText('10 preguntas');
    await expect(page.getByRole('radiogroup', { name: 'Cómo se responde' })).toBeVisible();
    await page.getByRole('button', { name: /^¿Cuál es su bandera\?/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Cómo se responde' })).toHaveCount(0);
    await expect(page.locator('.startbar-info')).toContainText('¿Cuál es su bandera?');
    // A continent, and as many questions as it has flags.
    await page.getByRole('button', { name: /^Europa/ }).click();
    await expect(page.locator('.fgm-set-name')).toHaveText(`Países de Europa · ${EUROPE.length} banderas`);
    await page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: 'Todas' }).click();
    await expect(page.locator('.mode-facts')).toHaveText(`${EUROPE.length} preguntas`);
    await expect(page.locator('.startbar-info')).toContainText(`Países de Europa · ${EUROPE.length} banderas`);
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/#\/banderas\/jugar\/cual-es\/paises-EU\/todas$/);
    await expect(hud(page)).toHaveText(`1 / ${EUROPE.length}`);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('offers the regions and the cities of a country, the capitals, and the flags without a country', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    const shelves = page.getByRole('radiogroup', { name: 'Qué banderas' });
    await shelves.getByRole('radio', { name: 'Regiones' }).click();
    // Those of the country of the language; a map with flags at two levels offers each by itself.
    await expect(page.locator('.fgm-pick select')).toHaveValue('ES');
    await expect(page.locator('.fgm-set-name')).toContainText('Regiones de España');
    const levels = page.getByRole('group', { name: 'Qué divisiones' });
    await expect(levels.getByRole('button')).toHaveText([/^Todas/, /^Comunidades autónomas 19$/, /^Provincias/]);
    await levels.getByRole('button', { name: /^Comunidades autónomas/ }).click();
    await expect(page.locator('.fgm-set-name')).toHaveText('Comunidades autónomas de España · 19 banderas');
    await page.locator('.fgm-pick select').selectOption('JP');
    await expect(page.locator('.fgm-set-name')).toHaveText(`Regiones de Japón · ${FLAGS.regions.JP.length} banderas`);
    await expect(levels).toHaveCount(0);
    await shelves.getByRole('radio', { name: 'Ciudades' }).click();
    await expect(page.locator('.fgm-set-name')).toContainText('Capitales del mundo');
    await page.locator('.fgm-pick select').selectOption('ES');
    await expect(page.locator('.fgm-set-name')).toContainText('Ciudades de España');
    await shelves.getByRole('radio', { name: 'Otras' }).click();
    await expect(page.locator('.chips .chip')).toHaveText([/^Países que ya no existen/, /^Organizaciones/, /^Pueblos/, /^Código de señales 40$/]);
    await page.getByRole('button', { name: /^Código de señales/ }).click();
    await expect(page.locator('.fgm-set-name')).toHaveText('Código internacional de señales · 40 banderas');
    // What is chosen can be seen with its names in the gallery.
    await expect(page.getByRole('link', { name: 'Verlas con su nombre en la galería' })).toHaveAttribute('href', '#/banderas/otras');
  });

  test('remembers what was chosen, and opens with the flags a link names', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    await page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Regiones' }).click();
    await page.locator('.fgm-pick select').selectOption('JP');
    await page.getByRole('button', { name: /^Poco a poco/ }).click();
    await page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: '20' }).click();
    await page.getByRole('radiogroup', { name: 'Cómo se responde' }).getByRole('radio', { name: 'Escrita' }).click();
    await expect(page.locator('.startbar-info')).toContainText('Poco a poco · escrita');
    expect((await kept(page)).flagLast).toBe('poco-a-poco/regiones-JP/20/escrita');
    await page.reload();
    await expect(page.locator('.fgm-set-name')).toContainText('Regiones de Japón');
    await expect(page.getByRole('button', { name: /^Poco a poco/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.getByRole('radiogroup', { name: 'Cómo se responde' }).getByRole('radio', { name: 'Escrita' })).toHaveAttribute('aria-checked', 'true');
    // A link with other flags: those, with the game and the settings that were left.
    await open(page, '/banderas/juegos/regiones-ES-1');
    await expect(page.locator('.fgm-set-name')).toHaveText('Comunidades autónomas de España · 19 banderas');
    await expect(page.getByRole('button', { name: /^Poco a poco/ })).toHaveAttribute('aria-pressed', 'true');
    // Flags there are none of: what was chosen stays.
    await open(page, '/banderas/juegos/regiones-CN');
    await expect(page.locator('.fgm-set-name')).toHaveText('Comunidades autónomas de España · 19 banderas');
    // A game that is opened by its address is what the section opens with afterwards.
    await open(page, '/banderas/jugar/cual-es/capitales/10');
    await expect(hud(page)).toHaveText('1 / 10');
    await open(page, '/banderas');
    await expect(page.locator('.fgm-set-name')).toContainText('Capitales del mundo');
    await expect(page.getByRole('button', { name: /^¿Cuál es su bandera\?/ })).toHaveAttribute('aria-pressed', 'true');
  });

  test('does not offer «Casi iguales» with flags that are not alike, and says how many it asks with those that are', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/juegos/paises-EU');
    await page.getByRole('button', { name: /^Casi iguales/ }).click();
    await expect(page.locator('.mode-about')).toContainText('Difícil.');
    await expect(page.locator('.mode-facts')).toHaveText('10 preguntas');
    await page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: 'Todas' }).click();
    // Not every flag of Europe: those that have others to be mixed up with.
    await expect(page.locator('.opt-hint')).toHaveText('Todas las que tienen con quién confundirse, no todas las del grupo.');
    await expect(page.locator('.mode-facts')).toHaveText('20 preguntas');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    // The seven of the regions of Belarus are like nothing but themselves.
    await open(page, '/banderas/juegos/regiones-BY');
    await expect(page.locator('.fgm-set-name')).toContainText('Regiones de Bielorrusia');
    await expect(page.locator('.startbar-info .problem')).toHaveText('Estas banderas no se parecen lo bastante entre sí: elige otras, u otro juego.');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    await page.getByRole('button', { name: /^¿De dónde es\?/ }).click();
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    // …and the address of that game says so, with the way back.
    await open(page, '/banderas/jugar/casi-iguales/regiones-BY/10');
    await expect(page.getByRole('alert')).toContainText('Estas banderas se parecen poco');
    await page.getByRole('button', { name: 'Elegir otro juego de banderas' }).click();
    await expect(page).toHaveURL(/#\/banderas$/);
  });

  test('says how each game is played, in the language of the page', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    await page.getByRole('button', { name: /^Casi iguales/ }).click();
    await page.locator('.mode-about').getByRole('button', { name: 'Cómo se juega' }).click();
    const panel = page.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(panel.getByRole('heading', { level: 3 })).toHaveText('Casi iguales');
    await expect(panel).toContainText('la suya y las tres que más se le parecen del grupo');
    await expect(panel).toContainText('Cómo cuenta');
    await panel.getByRole('button', { name: 'Entendido' }).click();
    await expect(panel).toHaveCount(0);
    await page.getByRole('group', { name: 'Idioma' }).getByRole('button', { name: 'EN' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flags of the world');
    await expect(page.locator('.modes .mode')).toHaveText([/^Whose flag\?/, /^Which flag\?/, /^Look-alikes/, /^Bit by bit/]);
    await expect(page.locator('.fgm-set-name')).toHaveText(`Countries of the world · ${STATES.length} flags`);
    await expect(page.locator('.mode-about')).toContainText('Hard. A name comes up with four flags that look alike');
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('.kicker')).toHaveText('Which is the flag of…?');
    await expect(page).toHaveTitle('Flags of the world — Regionle ∞');
  });

  test('is where the card of the first page leads, without loading the game again', async ({ page }) => {
    await seed(page);
    await open(page);
    const card = page.locator('.sections a.scard').nth(5);
    await expect(card.getByRole('heading', { level: 2 })).toHaveText('Banderas');
    await expect(card).toHaveAttribute('href', 'banderas.html');
    await expect(card.locator('.scard-modes li')).toHaveText(['¿De dónde es?', '¿Cuál es su bandera?', 'Casi iguales', 'Poco a poco', 'Galería']);
    await expect(card.locator('.scard-go')).toHaveText('Elegir juego');
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 7));
    await card.click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Banderas del mundo');
    expect(new URL(page.url()).hash).toBe('#/banderas');
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(7);
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible();
  });

  test('fits a phone, with the bar that starts the game in sight @movil', async ({ page }) => {
    await seed(page);
    for (const route of ['/banderas', '/banderas/juegos/regiones-ES', '/banderas/juegos/desaparecidos']) {
      await open(page, route);
      await expect(page.locator('.fgm-set-name')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), route).toBeLessThanOrEqual(0);
      await expect(page.getByRole('button', { name: 'Empezar' })).toBeInViewport();
    }
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(hud(page)).toHaveText('1 / 10');
  });
});

test.describe('«¿De dónde es?»', () => {
  test('shows a flag and four names, marks the answer at once and goes on with the keyboard', async ({ page }) => {
    await seed(page);
    /** The files of flags the page asks for, in the order it does. */
    const fetched: string[] = [];
    page.on('request', (request) => {
      if (/\/flags\/[\w-]+\.svg$/.test(request.url())) fetched.push(fileOf(request.url()));
    });
    await open(page, '/banderas/jugar/de-donde/paises-EU/10');
    // Nothing but the game: the bar of the sections is put away.
    await expect(page.locator('nav.nav')).toHaveCount(0);
    await expect(page.locator('.play-title')).toContainText('¿De dónde es?');
    await expect(page.locator('.play-title')).toContainText('Países de Europa');
    await expect(page.locator('.kicker')).toHaveText('¿De dónde es esta bandera?');
    await expect(hud(page)).toHaveText('1 / 10');
    await expect(names(page)).toHaveCount(4);
    // The flag of the next question is asked for while this one is on screen: it is there when its turn comes.
    await expect.poll(() => new Set(fetched).size).toBe(2);
    const ahead = fetched.filter((file) => file !== fetched[0]);
    const first = await shown(page);
    expect(`${first.fl}.svg`).toBe(fetched[0]);
    expect(first.ct).toBe('EU');
    await expect(names(page).filter({ hasText: first.n.es })).not.toHaveCount(0);
    // Right: said so, the name marked, and nothing else to press but what goes on.
    await say(page, true);
    await expect(verdict(page)).toContainText('¡Correcto!');
    await expect(page.locator('.choice.right')).toHaveText(new RegExp(`${first.n.es}$`));
    await expect(page.locator('.choice.wrong')).toHaveCount(0);
    for (const choice of await names(page).all()) await expect(choice).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10');
    await expect(verdict(page)).toHaveCount(0);
    // Wrong: what it was, and the flag of what was said, to tell them apart.
    const second = await shown(page);
    expect(ahead).toEqual([`${second.fl}.svg`]);
    await say(page, false);
    await expect(verdict(page)).toContainText(`Era ${second.n.es}.`);
    const taken = (await page.locator('.choice.wrong span').textContent())!;
    await expect(page.locator('.choice.right')).toHaveText(new RegExp(`${second.n.es}$`));
    await expect(verdict(page).locator('.fq-mix')).toContainText(`La de ${taken} es esta:`);
    expect(codeOf(await verdict(page).locator('.fq-mix img').getAttribute('src'))).toBe(byName.get(taken)!.fl);
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('3 / 10');
    // A number is its answer: the third name.
    const third = await shown(page);
    const picked = (await names(page).nth(2).locator('span').textContent())!;
    await page.keyboard.press('3');
    await expect(verdict(page)).toContainText(picked === third.n.es ? '¡Correcto!' : `Era ${third.n.es}.`);
    // Nothing is answered twice: another number changes nothing.
    await page.keyboard.press('1');
    await expect(hud(page)).toHaveText('3 / 10');
    await page.keyboard.press('Space');
    await expect(hud(page)).toHaveText('4 / 10');
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('ends with the mark, lists what was missed with what it was taken for, and goes over the misses alone', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/de-donde/paises-EU/10');
    let missed: Land | null = null;
    for (let i = 0; i < 10; i++) {
      await expect(hud(page)).toHaveText(`${i + 1} / 10`);
      const land = await say(page, i !== 3);
      if (i === 3) missed = land;
      await expect(page.getByRole('button', { name: i === 9 ? 'Ver resultado' : 'Siguiente' })).toBeVisible();
      await page.keyboard.press('Enter');
    }
    const results = page.locator('.results');
    await expect(results.locator('.results-title')).toHaveText('Partida terminada');
    await expect(results.locator('.donut')).toContainText('90 %');
    await expect(results.locator('.donut')).toContainText('9 de 10');
    await expect(results.locator('.results-stats')).toContainText('Aciertos9');
    await expect(results.locator('.results-stats')).toContainText('Fallos1');
    await expect(results.locator('.fq-mark')).toHaveText('90 %');
    // What was missed, open, with what it was taken for; what was right, shut.
    const review = results.locator('details.g-bad');
    await expect(review).toHaveAttribute('open', '');
    await expect(review.locator('summary')).toContainText('Para repasar 1');
    await expect(review.locator('.fq-list li')).toHaveCount(1);
    await expect(review.locator('.fq-list li b')).toHaveText(missed!.n.es);
    await expect(review.locator('.fq-took')).toContainText('Dijiste ');
    await expect(results.locator('details.g-ok summary')).toContainText('Aciertos 9');
    await expect(results.locator('details.g-ok')).not.toHaveAttribute('open', '');
    // It is a game like any other: in the progress, and its mark where the games are chosen.
    const state = await kept(page);
    expect((state.sessions as { section: string; mode: string; label: string; total: number; ok: number }[])[0]).toMatchObject({ section: 'flags', mode: 'flag-whose', label: 'Países de Europa', total: 10, ok: 9, bad: 1 });
    expect((state.best as Record<string, number>)['flag:de-donde/paises-EU/10']).toBe(90);
    // What is learnt here is learnt for the rest of the game: the flags of the countries are the same ones.
    expect(Object.keys(state.stats as object).filter((key) => key.startsWith('flag:'))).toHaveLength(10);

    // The miss alone: one question, of that flag.
    await results.getByRole('button', { name: 'Repasar 1 fallo' }).click();
    await expect(hud(page)).toHaveText('1 / 1');
    expect((await shown(page)).id).toBe(missed!.id);
    await say(page, true);
    await expect(page.getByRole('button', { name: 'Ver resultado' })).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(results.locator('.results-title')).toHaveText('¡Ninguna fallada!');
    await expect(results.locator('.results-note')).toHaveText('Solo las banderas que fallaste en la partida anterior.');
    // A round of misses sets no mark.
    await expect(results.locator('.fq-mark')).toHaveCount(0);
    expect(((await kept(page)).best as Record<string, number>)['flag:de-donde/paises-EU/10']).toBe(90);
    await results.getByRole('button', { name: 'Jugar con todas' }).click();
    await expect(hud(page)).toHaveText('1 / 10');

    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/#\/banderas$/);
    await expect(page.locator('.mode-facts')).toContainText('Tu marca: 90 %');
    await open(page, '/progreso');
    await expect(page.locator('.g-game').first()).toHaveText('¿De dónde es?');
    await expect(page.locator('.g-map').first()).toHaveText('Países de Europa · solo los fallos');
    // Its mark is one of the records, said in words: the game, the flags and how many questions.
    const record = page.locator('.records li').filter({ hasText: '¿De dónde es?' });
    await expect(record).toHaveCount(1);
    await expect(record).toContainText('¿De dónde es? · Países de Europa · 10 preguntas');
    await expect(record.locator('span')).toHaveText('90 %');
    await open(page);
    await expect(page.locator('main')).toContainText('¿De dónde es? · Países de Europa');
  });

  test('takes the name typed, in either language, and does not count a name that no flag of the group has', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/de-donde/paises-EU/10/escrita');
    const field = page.getByRole('textbox', { name: 'De dónde es la bandera' });
    await expect(field).toBeFocused();
    await expect(names(page)).toHaveCount(0);
    // A name of nothing: said, and the question is still open.
    await field.fill('zzzz');
    await page.keyboard.press('Enter');
    await expect(page.locator('.fq-stray')).toHaveText('Ninguna bandera de este grupo se llama así: no cuenta como intento.');
    await expect(verdict(page)).toHaveCount(0);
    // A flag that is not of the group is a name of nothing here.
    await field.fill('Japón');
    await page.keyboard.press('Enter');
    await expect(verdict(page)).toHaveCount(0);
    await expect(hud(page)).toHaveText('1 / 10');
    // Its name in English, without its capitals.
    const first = await shown(page);
    await field.fill((first.n.en ?? first.n.es).toLowerCase());
    await page.keyboard.press('Enter');
    await expect(verdict(page)).toContainText('¡Correcto!');
    await expect(page.locator('.fq-stray')).toHaveCount(0);
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10');
    await expect(field).toBeFocused();
    await expect(field).toHaveValue('');
    // The name of another flag of the group: a miss, with that flag beside.
    const second = await shown(page);
    const other = EUROPE.find((c) => c.id !== second.id && !['RO', 'MC', 'TD', 'ID'].includes(c.id) && !['RO', 'MC'].includes(second.id))!;
    await field.fill(other.n.es);
    await page.keyboard.press('Enter');
    await expect(verdict(page)).toContainText(`Era ${second.n.es}.`);
    await expect(verdict(page).locator('.fq-mix')).toContainText(`La de ${other.n.es} es esta:`);
    await page.keyboard.press('Enter');
    // «No lo sé» gives the answer and is a miss.
    const third = await shown(page);
    await page.getByRole('button', { name: 'No lo sé' }).click();
    await expect(verdict(page)).toContainText(`Era ${third.n.es}.`);
    await expect(verdict(page).locator('.fq-mix')).toHaveCount(0);
    // Ended before its time: what there was, and no mark.
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-note')).toHaveText('Terminaste antes de acabar: 3 de 10 preguntas.');
    await expect(page.locator('.results .donut')).toContainText('33 %');
    await expect(page.locator('.fq-mark')).toHaveCount(0);
    expect(((await kept(page)).best as Record<string, number>)['flag:de-donde/paises-EU/10/escrita']).toBeUndefined();
  });

  test('takes for right the name of a flag that is the same picture: Ajman for Dubai', async ({ page }) => {
    await seed(page);
    const emirates = FLAGS.regions.AE;
    const row = (id: string) => emirates.find((r) => r[0] === id)!;
    const [ajman, dubai] = [row('AE-AJ'), row('AE-DU')];
    expect(ajman && dubai).toBeTruthy();
    // Two files, and the same picture: the list of those says so.
    expect(ajman[4]).not.toBe(dubai[4]);
    expect(SAME.same.some((list) => list.includes(ajman[4]) && list.includes(dubai[4]))).toBe(true);
    await open(page, '/banderas/jugar/de-donde/regiones-AE/todas/escrita');
    const field = page.getByRole('textbox', { name: 'De dónde es la bandera' });
    await expect(hud(page)).toHaveText(`1 / ${emirates.length}`);
    for (let i = 0; i < emirates.length; i++) {
      const file = fileOf(await page.locator('.fq-flag img').getAttribute('src'));
      const mine = emirates.find((r) => r[4] === file || r[6] === file)!;
      expect(mine, file).toBeTruthy();
      // Each by the name of the other, where the flag is the same; the rest, by their own.
      await field.fill(mine === ajman ? dubai[2] : mine === dubai ? ajman[2] : mine[2]);
      await page.keyboard.press('Enter');
      await expect(verdict(page)).toContainText('¡Correcto!');
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('.results-title')).toHaveText('¡Ninguna fallada!');
    await expect(page.locator('.results .donut')).toContainText('100 %');
    // Both were asked: each is a flag of the group.
    await page.locator('.results details.g-ok summary').click();
    const asked = await page.locator('.results details.g-ok .fq-list li b').allTextContents();
    expect(asked).toEqual(expect.arrayContaining([ajman[2], dubai[2]]));
    expect(asked).toHaveLength(emirates.length);
  });
});

test.describe('«¿Cuál es su bandera?»', () => {
  test('shows a name and four flags, which say whose they are once the question is answered', async ({ page }) => {
    await seed(page);
    const spain = FLAGS.regions.ES;
    /** The files a name is drawn with: the picture itself, and the light one of a heavy drawing. */
    const filesOf = (name: string) => spain.filter((r) => r[2] === name).flatMap((r) => [r[4], r[6] ?? '']).filter(Boolean);
    const place = async (name: string) => {
      const srcs = await flags(page).locator('img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src') ?? ''));
      return srcs.findIndex((src) => filesOf(name).includes(src.split('/').pop()!));
    };
    await open(page, '/banderas/jugar/cual-es/regiones-ES/10');
    await expect(page.locator('.kicker')).toHaveText('¿Cuál es la bandera de…?');
    await expect(flags(page)).toHaveCount(4);
    // No flag says whose it is yet: a number each, and nothing else.
    await expect(page.locator('.fq-cap')).toHaveText(['1', '2', '3', '4']);
    await expect(flags(page).first()).toHaveAccessibleName('Bandera 1');
    for (const img of await flags(page).locator('img').all()) await expect.poll(() => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)).toBe(true);
    // Each as the gallery shows it small: a heavy drawing, by its picture.
    const light = new Set(spain.map((r) => r[6] ?? r[4]));
    for (const src of await flags(page).locator('img').evaluateAll((imgs) => imgs.map((img) => img.getAttribute('src') ?? ''))) expect(light.has(fileOf(src)), src).toBe(true);
    const first = (await page.locator('.fq-name').textContent())!;
    const at = await place(first);
    expect(at, first).toBeGreaterThanOrEqual(0);
    await flags(page).nth(at).click();
    await expect(verdict(page)).toContainText('¡Correcto!');
    await expect(flags(page).nth(at)).toHaveClass(/right/);
    // Now every one of the four has its name: the three that were not asked are learnt too.
    const said = await page.locator('.fq-cap span').allTextContents();
    expect(said[at]).toBe(first);
    expect(new Set(said).size).toBe(4);
    for (const name of said) expect(spain.some((r) => r[2] === name), name).toBe(true);
    await expect(flags(page).nth(at)).toHaveAccessibleName(first);
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10');
    // A wrong one: whose it is, and which was the right one.
    const second = (await page.locator('.fq-name').textContent())!;
    const good = await place(second);
    const bad = (good + 1) % 4;
    await page.keyboard.press(String(bad + 1));
    const whose = (await page.locator('.fq-cap span').allTextContents())[bad];
    await expect(verdict(page)).toContainText(`Esa es la de ${whose}.`);
    await expect(verdict(page)).toContainText(`La de ${second} es la número ${good + 1}.`);
    await expect(flags(page).nth(bad)).toHaveClass(/wrong/);
    await expect(flags(page).nth(good)).toHaveClass(/right/);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results details.g-bad .fq-took')).toHaveText(`Elegiste la de ${whose}`);
    // The flags of these are to be seen in the gallery, on their page.
    await page.getByRole('button', { name: 'Ver estas banderas' }).click();
    await expect(page).toHaveURL(/#\/banderas\/regiones\/ES$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Galería de banderas');
  });

  test('tells a capital by its country, and fits a phone with its four flags and what goes on in sight @movil', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/cual-es/capitales/10');
    // Under the name of the capital, whose it is: «Kingston» says little by itself.
    await expect(page.locator('.fq-name small')).not.toHaveText('');
    await expect(flags(page)).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const flag of await flags(page).all()) await expect(flag).toBeInViewport({ ratio: 1 });
    // Two by two.
    const tops = await flags(page).evaluateAll((list) => list.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(2);
    await flags(page).nth(1).tap();
    await expect(verdict(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeInViewport({ ratio: 1 });
    await page.getByRole('button', { name: 'Siguiente' }).tap();
    await expect(hud(page)).toHaveText('2 / 10');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  });
});

test.describe('«Casi iguales»', () => {
  /** What the game takes for one flag: Romania's is Chad's, Monaco's is Indonesia's. */
  const look = (id: string) => ({ RO: 'TD', MC: 'ID' })[id] ?? id;
  /** The three flags most like one among those of the States, as the list of look-alikes has them. */
  function rivals(id: string): string[] {
    const group = ALIKE.groups.states;
    const near = group.near[group.pics.indexOf(id)];
    const out: string[] = [];
    for (let k = 0; k < near.length && out.length < 3; k += 2) {
      const other = group.pics[near[k]];
      if (look(other) !== look(id) && !out.some((o) => look(o) === look(other))) out.push(other);
    }
    return out;
  }

  test('sets beside the flag that is asked the three that look most like it, and never two that are the same', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/casi-iguales/paises/20');
    await expect(page.locator('.play-title')).toContainText('Casi iguales');
    for (let i = 0; i < 20; i++) {
      await expect(hud(page)).toHaveText(`${i + 1} / 20`);
      const name = (await page.locator('.fq-name').textContent())!;
      const land = byName.get(name)!;
      expect(land, name).toBeTruthy();
      const codes = await flags(page).locator('img').evaluateAll((imgs) => imgs.map((img) => (img.getAttribute('src') ?? '').split('/').pop()!.replace('.svg', '')));
      const ids = codes.map((code) => byCode.get(code)!.id);
      expect([...ids].sort(), name).toEqual([land.id, ...rivals(land.id)].sort());
      expect(new Set(ids.map(look)).size, name).toBe(4);
      await flags(page).nth(ids.indexOf(land.id)).click();
      await expect(verdict(page)).toContainText('¡Correcto!');
      await page.keyboard.press('Enter');
    }
    await expect(page.locator('.results-title')).toHaveText('¡Ninguna fallada!');
    await expect(page.locator('.fq-mark')).toHaveText('100 %');
    expect(((await kept(page)).best as Record<string, number>)['flag:casi-iguales/paises/20']).toBe(100);
  });

  test('asks the flags of a continent among those of that continent', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/casi-iguales/paises-EU/todas');
    await expect(hud(page)).toHaveText('1 / 20');
    const codes = await flags(page).locator('img').evaluateAll((imgs) => imgs.map((img) => (img.getAttribute('src') ?? '').split('/').pop()!.replace('.svg', '')));
    for (const code of codes) expect(byCode.get(code)!.ct, code).toBe('EU');
    // Without the list of look-alikes there is no game, and it is said: with the way to try again.
    let fail = true;
    await page.route('**/data/alike/countries.json', (route) => (fail ? route.abort() : route.continue()));
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('No se han podido cargar las banderas');
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(hud(page)).toHaveText('1 / 20');
  });
});

test.describe('«Poco a poco»', () => {
  const pieces = (page: Page) => page.locator('.fq-cover i');
  const off = (page: Page) => page.locator('.fq-cover i.off');
  const worth = (page: Page) => page.locator('.fq-worth');

  test('uncovers the flag a piece at a time, and gives more points the sooner it is named', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/poco-a-poco/paises-EU/10');
    await expect(pieces(page)).toHaveCount(12);
    await expect(off(page)).toHaveCount(1);
    await expect(worth(page)).toHaveText('1 de 12 piezas · vale 12 puntos');
    await expect(hud(page)).toHaveText('1 / 10 · 0 pts');
    // The space bar is what uncovers: the keyboard starts on that button.
    const uncover = page.getByRole('button', { name: 'Destapar' });
    await expect(uncover).toBeFocused();
    await page.keyboard.press('Space');
    await expect(off(page)).toHaveCount(2);
    await expect(worth(page)).toHaveText('2 de 12 piezas · vale 11 puntos');
    await say(page, true);
    await expect(verdict(page)).toContainText('¡Correcto! 11 puntos.');
    // Once answered the whole flag is in sight, and there is nothing left to uncover.
    await expect(off(page)).toHaveCount(12);
    await expect(uncover).toBeDisabled();
    await expect(worth(page)).toHaveText('2 de 12 piezas destapadas');
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10 · 11 pts');
    await expect(off(page)).toHaveCount(1);
    // With more than half the flag in sight it is right with help.
    for (let i = 0; i < 6; i++) await uncover.click();
    await expect(off(page)).toHaveCount(7);
    await expect(worth(page)).toHaveText('7 de 12 piezas · vale 6 puntos');
    await say(page, true);
    await expect(verdict(page)).toContainText('¡Correcto! 6 puntos.');
    await expect(verdict(page)).toHaveClass(/verdict-warn/);
    await page.keyboard.press('Enter');
    // The whole of it uncovered: one point, and no more pieces to take off.
    for (let i = 0; i < 11; i++) await uncover.click();
    await expect(off(page)).toHaveCount(12);
    await expect(worth(page)).toHaveText('12 de 12 piezas · vale 1 punto');
    await expect(uncover).toBeDisabled();
    await say(page, true);
    await expect(verdict(page)).toContainText('¡Correcto! 1 punto.');
    await page.keyboard.press('Enter');
    // A miss gives nothing, however soon.
    await say(page, false);
    await expect(verdict(page)).toContainText('Era ');
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('5 / 10 · 18 pts');
    await page.getByRole('button', { name: 'Terminar' }).click();
    const results = page.locator('.results');
    await expect(results.locator('.donut')).toContainText('38 %');
    await expect(results.locator('.donut')).toContainText('18 / 48 pts');
    await expect(results.locator('.results-stats')).toContainText('A la primera1');
    await expect(results.locator('.results-stats')).toContainText('Con ayuda2');
    await expect(results.locator('.results-stats')).toContainText('Fallos1');
    await expect(results.locator('details.g-warn summary')).toContainText('Con ayuda 2');
    await expect(results.locator('details.g-ok .fq-list li')).toContainText('11 puntos');
    expect(((await kept(page)).sessions as { mode: string; ok: number; warn: number; bad: number }[])[0]).toMatchObject({ mode: 'flag-reveal', ok: 1, warn: 1 + 1, bad: 1 });
  });

  test('uncovers with the space bar while the name is being typed, as long as nothing has been written', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/poco-a-poco/paises-EU/10/escrita');
    const field = page.getByRole('textbox', { name: 'De dónde es la bandera' });
    await expect(field).toBeFocused();
    await expect(off(page)).toHaveCount(1);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await expect(off(page)).toHaveCount(3);
    await expect(field).toHaveValue('');
    // In a name a space is a space.
    await field.fill('Reino');
    await page.keyboard.press('Space');
    await expect(off(page)).toHaveCount(3);
    await expect(field).toHaveValue('Reino ');
    const land = await shown(page);
    await field.fill(land.n.es);
    await page.keyboard.press('Enter');
    await expect(verdict(page)).toContainText('¡Correcto! 10 puntos.');
  });

  test('fits a phone: the flag, what uncovers it and the four names in sight @movil', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/poco-a-poco/paises/10');
    await expect(pieces(page)).toHaveCount(12);
    await expect(page.locator('.fq-flag')).toBeInViewport({ ratio: 1 });
    await expect(page.getByRole('button', { name: 'Destapar' })).toBeInViewport({ ratio: 1 });
    for (const choice of await names(page).all()) await expect(choice).toBeInViewport({ ratio: 1 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByRole('button', { name: 'Destapar' }).tap();
    await expect(off(page)).toHaveCount(2);
  });
});

test.describe('a game of flags', () => {
  test('shows how it is played the first time it is opened, with its clock stopped, and whenever it is asked', async ({ page }) => {
    await seed(page, { helpAuto: true });
    await open(page, '/banderas/jugar/poco-a-poco/paises-EU/10');
    const panel = page.getByRole('dialog', { name: 'Cómo se juega' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('heading', { level: 3 })).toHaveText('Poco a poco');
    await expect(panel).toContainText('La bandera está tapada por 12 piezas');
    await expect(panel).toContainText('El tiempo de la partida está parado mientras lees.');
    await page.waitForTimeout(1300);
    await panel.getByRole('button', { name: 'Empezar' }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.locator('.hud-chip[title="Tiempo"]')).toHaveText('0:00');
    expect((await kept(page)).helpSeen).toContain('flag-reveal');
    // Not a second time by itself…
    await page.reload();
    await expect(page.locator('.fq-cover i')).toHaveCount(12);
    await expect(panel).toHaveCount(0);
    // …and at hand all the same.
    await page.getByRole('button', { name: 'Cómo se juega' }).first().click();
    await expect(panel).toBeVisible();
    // While it is open the keys of the game do nothing.
    await page.keyboard.press('1');
    await panel.getByRole('button', { name: 'Seguir jugando' }).click();
    await expect(page.locator('.verdict')).toHaveCount(0);
    // Another game has its own rules to show.
    await open(page, '/banderas/jugar/casi-iguales/paises/10');
    await expect(panel.getByRole('heading', { level: 3 })).toHaveText('Casi iguales');
  });

  test('says so when its address is that of no game, or names flags there are not enough of', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/otro-juego/paises/10');
    await expect(page.getByRole('alert')).toContainText('Ese juego no existe');
    await page.getByRole('button', { name: 'Elegir otro juego de banderas' }).click();
    await expect(page).toHaveURL(/#\/banderas$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Banderas del mundo');
    await open(page, '/banderas/jugar/de-donde/regiones-CN/10');
    await expect(page.getByRole('alert')).toContainText('Faltan banderas');
    await expect(page.getByRole('alert')).toContainText('al menos 4 banderas distintas');
    await open(page, '/banderas/jugar/de-donde/nada/10');
    await expect(page.getByRole('alert')).toContainText('Ese juego no existe');
    // What an address leaves unsaid is as a game opens; the other ways of writing it lead to the same place.
    await open(page, '/flags/play/de-donde/paises-eu');
    await expect(hud(page)).toHaveText('1 / 10');
    await expect(page.locator('.play-title')).toContainText('Países de Europa');
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('says so when the flags cannot be fetched, and tries again when asked', async ({ page }) => {
    await seed(page);
    let fail = true;
    await page.route('**/data/flags.json', (route) => (fail ? route.abort() : route.continue()));
    await open(page, '/banderas/jugar/de-donde/regiones-ES/10');
    await expect(page.getByRole('alert')).toContainText('No se han podido cargar las banderas');
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(hud(page)).toHaveText('1 / 10');
    // The flag that is asked is the drawing itself, however heavy: it is the one thing on the screen.
    const drawings = new Set(FLAGS.regions.ES.map((r) => r[4]));
    expect(drawings.has(fileOf(await page.locator('.fq-flag img').getAttribute('src')))).toBe(true);
    // The chooser too. (What was fetched is kept while the page is open: it is loaded again.)
    fail = true;
    await page.goto('./#/banderas');
    await page.reload();
    await expect(page.getByRole('alert')).toContainText('No se han podido cargar las banderas');
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.locator('.fgm-set-name')).toBeVisible();
  });

  test('says so when the flag of a question does not come, and asks for it again', async ({ page }) => {
    await seed(page);
    let fail = true;
    await page.route('**/flags/*.svg', (route) => (fail ? route.abort() : route.continue()));
    const drawn = (img: Locator) => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0);
    await open(page, '/banderas/jugar/de-donde/paises-EU/10');
    const lost = page.locator('.fq-lost');
    await expect(lost).toContainText('No se ha podido cargar la bandera.');
    // Nothing is held against the player: the question is as it was.
    await expect(verdict(page)).toHaveCount(0);
    await expect(hud(page)).toHaveText('1 / 10');
    fail = false;
    await lost.getByRole('button', { name: 'Reintentar' }).click();
    await expect(lost).toHaveCount(0);
    await expect.poll(() => drawn(page.locator('.fq-flag img'))).toBe(true);
    // The next one, which was asked for ahead and did not come either, is asked for again by itself.
    await say(page, true);
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10');
    await expect.poll(() => drawn(page.locator('.fq-flag img'))).toBe(true);
    await expect(lost).toHaveCount(0);
    // Where four flags are the answers, any of them that is missing is said.
    fail = true;
    await page.goto('./#/banderas/jugar/cual-es/paises-AS/10');
    await page.reload();
    await expect(lost).toContainText('No se han podido cargar todas las banderas.');
    fail = false;
    await lost.getByRole('button', { name: 'Reintentar' }).click();
    await expect(lost).toHaveCount(0);
    for (const img of await flags(page).locator('img').all()) await expect.poll(() => drawn(img)).toBe(true);
  });

  test('is played in English with the names in English', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, '/banderas/jugar/de-donde/paises-EU/10');
    await expect(page.locator('.play-title')).toContainText('Whose flag?');
    await expect(page.locator('.play-title')).toContainText('Countries of Europe');
    await expect(page.locator('.kicker')).toHaveText('Whose flag is this?');
    const land = await shown(page);
    await page.getByRole('button', { name: land.n.en ?? land.n.es, exact: true }).click();
    await expect(verdict(page)).toContainText('Correct!');
    await page.getByRole('button', { name: 'Next' }).click();
    const next = await shown(page);
    await names(page).filter({ hasNotText: next.n.en ?? next.n.es }).first().click();
    await expect(verdict(page)).toContainText(`It was ${next.n.en ?? next.n.es}.`);
    await page.getByRole('button', { name: 'Finish' }).click();
    await expect(page.locator('.results-title')).toHaveText('Game over');
    await expect(page.locator('.results')).toContainText('You ended it early: 2 of 10 questions.');
    await expect(page.getByRole('button', { name: 'Review 1 miss' })).toBeVisible();
    await expect(page.locator('.results details.g-bad .fq-took')).toContainText('You said ');
  });
});
