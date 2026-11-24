/**
 * The two games of the section «Banderas» that came with 1.46.0: «Escalada», a climb of flags whose names
 * are chosen among more and more and which three misses end, and «¿De qué país es?», the flag of a region
 * and the country it is of. What comes up is drawn by lot: the tests read on the screen which flag is
 * there, and know from the lists the site is built with whose it is.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { open, seed } from './helpers';

interface Land {
  id: string;
  fl?: string;
  cl: string;
  ct: string;
  pop?: number;
  n: { es: string; en?: string };
}
type RegionRow = [id: string, level: number, es: string, en: string, file: string, ratio: number, small?: string];
const INDEX = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Land[] };
const FLAGS = JSON.parse(fs.readFileSync('public/data/flags.json', 'utf8')) as { regions: Record<string, RegionRow[]> };
const ALIKE = JSON.parse(fs.readFileSync('public/data/alike/countries.json', 'utf8')) as { groups: Record<string, { pics: string[]; near: number[][] }> };
const LANDS = JSON.parse(fs.readFileSync('public/data/alike/lands.json', 'utf8')) as { also: Record<string, string[]> };

const STATES = INDEX.countries.filter((c) => c.fl && ['un', 'obs', 'partial'].includes(c.cl));
const EUROPE = STATES.filter((c) => c.ct === 'EU');
/** The countries that have flags of regions: the ones «¿De qué país es?» asks, and offers. */
const WITH_REGIONS = STATES.filter((c) => FLAGS.regions[c.id]?.length);
const byCode = new Map(INDEX.countries.filter((c) => c.fl).map((c) => [c.fl!, c]));
const byName = new Map(STATES.map((c) => [c.n.es, c]));

const fileOf = (src: string | null): string => (src ?? '').split('/').pop() ?? '';
const codeOf = (src: string | null): string => fileOf(src).replace(/\.svg$/, '');
const hud = (page: Page) => page.locator('.hud-main');
const lives = (page: Page) => page.locator('.hud-lives');
const verdict = (page: Page) => page.locator('.verdict');
const names = (page: Page) => page.locator('.fq-choices .choice');
const kept = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> }).state);

/** What a question of «Escalada» shows with the countries: whose the flag is, and the countries whose names it is set among. */
async function climbShown(page: Page): Promise<{ land: Land; options: Land[]; at: number }> {
  const land = byCode.get(codeOf(await page.locator('.fq-flag img').getAttribute('src')));
  expect(land).toBeTruthy();
  const options: Land[] = [];
  for (const text of await names(page).locator('span').allTextContents()) {
    expect(byName.get(text), text).toBeTruthy();
    options.push(byName.get(text)!);
  }
  const at = options.indexOf(land!);
  expect(at, land!.n.es).toBeGreaterThanOrEqual(0);
  return { land: land!, options, at };
}

/** Answers the flag on screen of a climb, right or wrong, and goes on to the next; says what was shown. */
async function climbStep(page: Page, right: boolean, go = true): Promise<{ land: Land; options: Land[]; at: number }> {
  const shown = await climbShown(page);
  await names(page)
    .nth(right ? shown.at : (shown.at + 1) % shown.options.length)
    .click();
  await expect(verdict(page)).toHaveClass(right ? /verdict-ok/ : /verdict-bad/);
  if (go) await page.keyboard.press('Enter');
  return shown;
}

/** What a question of «¿De qué país es?» shows: the flag of a region, the four countries, which of them it is of and the names it goes by there. */
async function landShown(page: Page, lang: 'es' | 'en' = 'es'): Promise<{ file: string; options: Land[]; land: Land; at: number; regions: string[] }> {
  const file = fileOf(await page.locator('.fq-flag img').getAttribute('src'));
  const options: Land[] = [];
  for (const option of await names(page).all()) {
    // Each country comes with its flag, beside its name.
    const land = byCode.get(codeOf(await option.locator('img').getAttribute('src')));
    expect(land, file).toBeTruthy();
    await expect(option.locator('span').last()).toHaveText(land!.n[lang] ?? land!.n.es);
    options.push(land!);
  }
  // A flag may be that of divisions of two countries: only one of them is ever among the four.
  const owners = options.filter((c) => FLAGS.regions[c.id]?.some((row) => row[4] === file));
  expect(owners, file).toHaveLength(1);
  const land = owners[0];
  const regions = FLAGS.regions[land.id].filter((row) => row[4] === file).map((row) => (lang === 'en' && row[3] ? row[3] : row[2]));
  return { file, options, land, at: options.indexOf(land), regions };
}

test.describe('where «Escalada» and «¿De qué país es?» are chosen', () => {
  test('offers «Escalada» with any flags, with nothing to set: it lasts as long as its lives', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/juegos/paises-EU');
    // The nine games, the easy ones first.
    await expect(page.locator('.modes .mode')).toHaveText([/^¿De dónde es\?/, /^¿Cuál es su bandera\?/, /^Parejas/, /^Poco a poco/, /^El intruso/, /^Escalada/, /^Casi iguales/, /^Antes y ahora/, /^¿De qué país es\?/]);
    await page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: '20' }).click();
    await page.getByRole('button', { name: /^Escalada/ }).click();
    await expect(page.locator('.mode-about')).toContainText('Medio. Empiezas eligiendo entre dos nombres y cada tres aciertos hay uno más. Tres fallos y se acaba: ¿hasta dónde subes?');
    await expect(page.locator('.mode-facts')).toHaveText(`3 vidas, hasta ${EUROPE.length} banderas`);
    // Neither how many questions nor how they are answered.
    await expect(page.getByRole('radiogroup', { name: 'Cuántas preguntas' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Cómo se responde' })).toHaveCount(0);
    await expect(page.locator('.opt-hint')).toHaveText('No hay nada que elegir: la escalada dura hasta que te quedas sin vidas, o hasta que se acaban las banderas.');
    await expect(page.locator('.startbar-info')).toContainText('Escalada');
    expect((await kept(page)).flagLast).toBe('escalada/paises-EU');
    // With the regions of a country too, and the cities, and the signals.
    await page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Regiones' }).click();
    await expect(page.locator('.mode-facts')).toContainText('3 vidas, hasta ');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    await page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Países' }).click();
    await page.getByRole('button', { name: /^Europa/ }).click();
    // The other games are as long as they were left.
    await page.getByRole('button', { name: /^¿De dónde es\?/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: /^Escalada/ }).click();
    // What was left is what the section opens with; and its address says no length.
    await open(page, '/banderas');
    await expect(page.getByRole('button', { name: /^Escalada/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.fgm-set-name')).toHaveText(`Países de Europa · ${EUROPE.length} banderas`);
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/#\/banderas\/jugar\/escalada\/paises-EU$/);
    await expect(page.locator('.play-title')).toContainText('Escalada');
    await expect(hud(page)).toHaveText('0');
    await expect(lives(page)).toHaveAttribute('aria-label', 'Vidas: 3 de 3');
    await expect(names(page)).toHaveCount(2);
    // After a game the chooser still asks ten or twenty questions of the others: «Todas» was the climb’s, not theirs.
    await open(page, '/banderas');
    await page.getByRole('button', { name: /^¿Cuál es su bandera\?/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: '10' })).toHaveAttribute('aria-checked', 'true');
  });

  test('offers «¿De qué país es?» with countries that have flags of regions, and says why not with the rest', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/juegos/paises-EU');
    await page.getByRole('button', { name: /^¿De qué país es\?/ }).click();
    await expect(page.locator('.mode-about')).toContainText('Difícil. Sale la bandera de una región, sin su nombre, y eliges de qué país es.');
    await expect(page.locator('.mode-facts')).toHaveText('10 preguntas');
    await expect(page.locator('.opt-hint')).toHaveText('Una bandera por cada país que tiene banderas de regiones: en cada partida puede salir una distinta.');
    // It is not answered by typing; and with «Todas» it asks the countries that have such flags, not every one.
    await expect(page.getByRole('radiogroup', { name: 'Cómo se responde' })).toHaveCount(0);
    const europe = WITH_REGIONS.filter((c) => c.ct === 'EU').length;
    await page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: 'Todas' }).click();
    await expect(page.locator('.mode-facts')).toHaveText(`${europe} preguntas`);
    expect(europe).toBeGreaterThan(30);
    expect(europe).toBeLessThan(EUROPE.length);
    expect((await kept(page)).flagLast).toBe('de-que-pais/paises-EU/todas');
    // Eight countries of Oceania have them: eight questions, however many are asked for.
    await page.getByRole('button', { name: /^Oceanía/ }).click();
    await expect(page.locator('.mode-facts')).toHaveText(`${WITH_REGIONS.filter((c) => c.ct === 'OC').length} preguntas`);
    await page.getByRole('button', { name: /^Todo el mundo/ }).click();
    await expect(page.locator('.mode-facts')).toHaveText(`${WITH_REGIONS.length} preguntas`);
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    // What is not countries has no country to be asked.
    await page.getByRole('button', { name: /^Territorios/ }).click();
    await expect(page.locator('.startbar-info .problem')).toHaveText('«¿De qué país es?» se juega con países: elige los del mundo o los de un continente.');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    await expect(page.locator('.opt-hint')).toHaveCount(0);
    await page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Regiones' }).click();
    await expect(page.locator('.startbar-info .problem')).toHaveText('«¿De qué país es?» se juega con países: elige los del mundo o los de un continente.');
    await page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Países' }).click();
    await page.getByRole('button', { name: /^Europa/ }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/#\/banderas\/jugar\/de-que-pais\/paises-EU\/todas$/);
    await expect(hud(page)).toHaveText(`1 / ${europe}`);
    // The address of a game that cannot be says so too, with the way back.
    await open(page, '/banderas/jugar/de-que-pais/regiones-ES/10');
    await expect(page.getByRole('alert')).toContainText('Este juego es de países');
    await page.getByRole('button', { name: 'Elegir otro juego de banderas' }).click();
    await expect(page).toHaveURL(/#\/banderas$/);
  });

  test('says how each of the two is played', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    const panel = page.getByRole('dialog', { name: 'Cómo se juega' });
    for (const [game, text] of [
      ['Escalada', 'Cada fallo cuesta una vida, y tienes 3: con el último se acaba la escalada.'],
      ['¿De qué país es?', 'nunca uno que tenga esa misma bandera'],
    ]) {
      await page.getByRole('button', { name: new RegExp(`^${game.replace('?', '\\?')}`) }).click();
      await page.locator('.mode-about').getByRole('button', { name: 'Cómo se juega' }).click();
      await expect(panel.getByRole('heading', { level: 3 })).toHaveText(game);
      await expect(panel).toContainText(text);
      await panel.getByRole('button', { name: 'Entendido' }).click();
      await expect(panel).toHaveCount(0);
    }
  });

});

test.describe('«Escalada»', () => {
  test('begins with two names and adds one for every three flags got right', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/escalada/paises');
    await expect(page.locator('.play-title')).toContainText('Escalada');
    await expect(page.locator('.play-title')).toContainText('Países del mundo');
    await expect(page.locator('.kicker')).toHaveText('¿De dónde es esta bandera?');
    await expect(lives(page).locator('svg.on')).toHaveCount(3);
    const asked = new Set<string>();
    for (let height = 0; height < 12; height++) {
      await expect(hud(page)).toHaveText(String(height));
      await expect(names(page)).toHaveCount(2 + Math.floor(height / 3));
      const shown = await climbShown(page);
      expect(new Set(shown.options.map((c) => c.id)).size).toBe(shown.options.length);
      asked.add(shown.land.id);
      if (height >= 9) {
        // From the tenth flag on, the names are those of the flags most like it.
        const group = ALIKE.groups.states;
        const near = group.near[group.pics.indexOf(shown.land.id)].filter((_, k) => k % 2 === 0).map((place) => group.pics[place]);
        for (const option of shown.options) if (option.id !== shown.land.id) expect(near, `${shown.land.n.es}: ${option.n.es}`).toContain(option.id);
      }
      // By its number on the keyboard, or by pressing it.
      if (height % 2) await page.keyboard.press(String(shown.at + 1));
      else await names(page).nth(shown.at).click();
      await expect(verdict(page)).toHaveClass(/verdict-ok/);
      await expect(verdict(page)).toContainText('¡Correcto!');
      await expect(names(page).nth(shown.at)).toHaveClass(/right/);
      // The names that were there stay there once it is answered, though the game is now a rung higher.
      await expect(names(page)).toHaveCount(shown.options.length);
      await expect(hud(page)).toHaveText(String(height + 1));
      await page.keyboard.press('Enter');
    }
    // No flag twice, and no life lost.
    expect(asked.size).toBe(12);
    await expect(lives(page)).toHaveAttribute('aria-label', 'Vidas: 3 de 3');
    // The flags of the countries are those the rest of the game knows: what is got right here counts there.
    const stats = (await kept(page)).stats as Record<string, number[]>;
    for (const id of asked) expect(stats[`flag:${id}`]?.[0], id).toBe(1);
  });

  test('ends with the third miss, says how high it got and keeps the best height', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/escalada/paises-EU');
    for (let i = 0; i < 4; i++) await climbStep(page, true);
    await expect(hud(page)).toHaveText('4');
    // A miss costs a life and no height; the flag it was taken for is shown.
    const first = await climbStep(page, false, false);
    await expect(verdict(page)).toContainText(`Era ${first.land.n.es}.`);
    await expect(verdict(page).locator('.fq-mix img')).toHaveCount(1);
    await expect(lives(page)).toHaveAttribute('aria-label', 'Vidas: 2 de 3');
    await expect(lives(page).locator('svg.on')).toHaveCount(2);
    await expect(hud(page)).toHaveText('4');
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();
    await page.keyboard.press('Enter');
    // …and no name is taken away for it: three still.
    await expect(names(page)).toHaveCount(3);
    await climbStep(page, true);
    await climbStep(page, false);
    await expect(lives(page)).toHaveAttribute('aria-label', 'Vidas: 1 de 3');
    await climbStep(page, true);
    await expect(hud(page)).toHaveText('6');
    await expect(names(page)).toHaveCount(4);
    const last = await climbStep(page, false, false);
    await expect(lives(page)).toHaveAttribute('aria-label', 'Vidas: 0 de 3');
    await expect(verdict(page)).toContainText('Era tu última vida: la escalada acaba en 6 peldaños.');
    await expect(page.getByRole('button', { name: 'Siguiente' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-title')).toHaveText('Te quedaste sin vidas');
    await expect(page.locator('.results-note')).toHaveText('Subiste 6 peldaños: al final elegías entre 4 nombres.');
    await expect(page.locator('.results-stats')).toContainText('Altura6');
    await expect(page.locator('.results-stats')).toContainText('Fallos3');
    await expect(page.locator('.fq-mark')).toHaveText('6 peldaños');
    await expect(page.locator('details.g-bad li')).toHaveCount(3);
    await expect(page.locator('details.g-bad li').first()).toContainText(first.land.n.es);
    await expect(page.locator('details.g-bad')).toContainText(last.land.n.es);
    let state = await kept(page);
    expect((state.best as Record<string, number>)['flag:escalada/paises-EU']).toBe(6);
    const sessions = state.sessions as { section: string; mode: string; label: string; total: number; ok: number; bad: number }[];
    expect(sessions[0]).toMatchObject({ section: 'flags', mode: 'flag-climb', label: 'Países de Europa', total: 9, ok: 6, bad: 3 });
    // The misses, alone: three flags, a climb of its own that sets no mark.
    await page.getByRole('button', { name: 'Repasar 3 fallos' }).click();
    await expect(hud(page)).toHaveText('0');
    await expect(lives(page)).toHaveAttribute('aria-label', 'Vidas: 3 de 3');
    const again = new Set<string>();
    for (let i = 0; i < 3; i++) again.add((await climbStep(page, true, i < 2)).land.id);
    expect(again.has(first.land.id) && again.has(last.land.id)).toBe(true);
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-title')).toHaveText('¡Ninguna fallada!');
    await expect(page.locator('.results-note').first()).toHaveText('Solo las banderas que fallaste en la partida anterior.');
    await expect(page.locator('.fq-mark')).toHaveCount(0);
    // A climb left behind is as high as it got: it beats the mark when it got higher, and not when it did not.
    await page.getByRole('button', { name: 'Jugar con todas' }).click();
    for (let i = 0; i < 7; i++) await climbStep(page, true);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('¡Ninguna fallada!');
    await expect(page.locator('.results-note')).toHaveText('Subiste 7 peldaños: al final elegías entre 4 nombres.');
    await expect(page.locator('.fq-mark')).toHaveText('¡Nueva! Antes, 6');
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await climbStep(page, true);
    await climbStep(page, false);
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-note')).toHaveText('Subiste 1 peldaño: al final elegías entre 2 nombres.');
    await expect(page.locator('.fq-mark')).toHaveText('7 peldaños');
    state = await kept(page);
    expect((state.best as Record<string, number>)['flag:escalada/paises-EU']).toBe(7);
    // The chooser and the progress say the mark as what it is: rungs.
    await page.getByRole('button', { name: 'Cambiar de juego' }).click();
    await expect(page.locator('.mode-facts')).toContainText('Tu marca: 7 peldaños');
    await open(page, '/progreso');
    await expect(page.locator('.g-game').first()).toHaveText('Escalada');
    const record = page.locator('.records li').filter({ hasText: 'Escalada' });
    await expect(record).toContainText('Escalada · Países de Europa');
    await expect(record).not.toContainText('todas');
    await expect(record.locator('span')).toHaveText('7 peldaños');
  });

  test('is over when the flags run out, with whatever lives are left', async ({ page }) => {
    await seed(page);
    // Seven emirates whose flags are four pictures… the regions of a small country: every flag once, and the top.
    await open(page, '/banderas/jugar/escalada/regiones-AE');
    const total = new Set(FLAGS.regions.AE.map((row) => row[4])).size;
    await expect(hud(page)).toHaveText('0');
    let done = 0;
    for (; done < 20; done++) {
      const file = fileOf(await page.locator('.fq-flag img').getAttribute('src'));
      const mine = FLAGS.regions.AE.filter((row) => row[4] === file).map((row) => row[2]);
      expect(mine.length, file).toBeGreaterThan(0);
      // Never two names of the same flag among those to choose from.
      const texts = await names(page).locator('span').allTextContents();
      expect(texts.filter((text) => mine.includes(text)), texts.join(', ')).toHaveLength(1);
      expect(texts.length).toBeLessThanOrEqual(total);
      await names(page)
        .nth(texts.findIndex((text) => mine.includes(text)))
        .click();
      await expect(verdict(page)).toHaveClass(/verdict-ok/);
      if (await page.getByRole('button', { name: 'Ver resultado' }).count()) break;
      await page.keyboard.press('Enter');
    }
    expect(done + 1).toBeLessThanOrEqual(FLAGS.regions.AE.length);
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results-title')).toHaveText('¡Has llegado arriba!');
    await expect(page.locator('.results-stats')).toContainText(`Altura${done + 1}`);
    await expect(page.locator('.results-stats')).toContainText('Fallos0');
  });

  test('is played in English too', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, '/banderas/jugar/escalada/paises-OC');
    await expect(page.locator('.play-title')).toContainText('Climb');
    await expect(page.locator('.kicker')).toHaveText('Whose flag is this?');
    await expect(lives(page)).toHaveAttribute('aria-label', 'Lives: 3 of 3');
    const byEnglish = new Map(STATES.map((c) => [c.n.en ?? c.n.es, c]));
    const step = async (right: boolean) => {
      const land = byCode.get(codeOf(await page.locator('.fq-flag img').getAttribute('src')))!;
      const texts = await names(page).locator('span').allTextContents();
      for (const text of texts) expect(byEnglish.get(text), text).toBeTruthy();
      const at = texts.indexOf(land.n.en ?? land.n.es);
      await names(page)
        .nth(right ? at : (at + 1) % texts.length)
        .click();
      await expect(verdict(page)).toHaveClass(right ? /verdict-ok/ : /verdict-bad/);
      return land;
    };
    await step(true);
    await page.keyboard.press('Enter');
    await step(false);
    await page.keyboard.press('Enter');
    await step(false);
    await page.keyboard.press('Enter');
    const last = await step(false);
    await expect(lives(page)).toHaveAttribute('aria-label', 'Lives: 0 of 3');
    await expect(verdict(page)).toContainText(`It was ${last.n.en ?? last.n.es}.`);
    await expect(verdict(page)).toContainText('That was your last life: the climb ends at 1 rung.');
    await page.getByRole('button', { name: 'See the result' }).click();
    await expect(page.locator('.results-title')).toHaveText('Out of lives');
    await expect(page.locator('.results-note')).toHaveText('You climbed 1 rung: at the end you were choosing among 2 names.');
    await expect(page.locator('.fq-mark')).toHaveText('1 rung');
    await expect(page.getByRole('button', { name: 'Review 3 misses' })).toBeVisible();
  });

  test('keeps eight names and the flag in sight on a phone @movil', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/escalada/paises');
    for (let i = 0; i < 18; i++) await climbStep(page, true);
    await expect(hud(page)).toHaveText('18');
    await expect(names(page)).toHaveCount(8);
    const view = page.viewportSize()!;
    const boxes = await names(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ left: Math.round(r.left), top: r.top, bottom: r.bottom, right: r.right })));
    // Two abreast, none past the edge, and the last of them above the bottom of the window with the flag still there.
    expect(new Set(boxes.map((b) => b.left)).size).toBe(2);
    for (const box of boxes) {
      expect(box.right).toBeLessThanOrEqual(view.width);
      expect(box.bottom).toBeLessThanOrEqual(view.height);
    }
    const flag = await page.locator('.fq-flag').boundingBox();
    expect(flag!.y).toBeGreaterThanOrEqual(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    // The height and the lives are in the bar, in sight.
    await expect(hud(page)).toBeInViewport();
    await expect(lives(page)).toBeInViewport();
  });
});

test.describe('«¿De qué país es?»', () => {
  test('shows the flag of a region and four countries of its continent with their flags', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/de-que-pais/paises-EU/10');
    await expect(page.locator('.play-title')).toContainText('¿De qué país es?');
    await expect(page.locator('.play-title')).toContainText('Países de Europa');
    await expect(page.locator('.kicker')).toHaveText('¿De qué país es esta bandera regional?');
    await expect(hud(page)).toHaveText('1 / 10');
    await expect(names(page)).toHaveCount(4);
    const first = await landShown(page);
    // Four countries of Europe that have flags of regions, and none that flies this one too.
    expect(new Set(first.options.map((c) => c.id)).size).toBe(4);
    for (const option of first.options) {
      expect(option.ct).toBe('EU');
      expect(WITH_REGIONS).toContain(option);
      expect(LANDS.also[`${first.land.id}:${first.file}`] ?? []).not.toContain(option.id);
    }
    // The name of the region is not said until it is answered: the flag has no words of its own, and there is no verdict yet.
    await expect(page.locator('.fq-flag img')).toHaveAttribute('alt', '');
    await expect(verdict(page)).toHaveCount(0);
    // Right: the region it is the flag of.
    await names(page).nth(first.at).click();
    await expect(verdict(page)).toHaveClass(/verdict-ok/);
    await expect(verdict(page)).toContainText('¡Correcto!');
    await expect(verdict(page)).toContainText('Es la bandera de ');
    for (const region of first.regions) await expect(verdict(page)).toContainText(region);
    await expect(names(page).nth(first.at)).toHaveClass(/right/);
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10');
    // Wrong, with the keys: the country it is of, marked among the four.
    const second = await landShown(page);
    expect(second.land.id).not.toBe(first.land.id);
    const other = (second.at + 1) % 4;
    await page.keyboard.press(String(other + 1));
    await expect(verdict(page)).toHaveClass(/verdict-bad/);
    await expect(verdict(page)).toContainText(`Es de ${second.land.n.es}.`);
    for (const region of second.regions) await expect(verdict(page)).toContainText(region);
    await expect(names(page).nth(second.at)).toHaveClass(/right/);
    await expect(names(page).nth(other)).toHaveClass(/wrong/);
    // The flags of the four are there already: none is shown again below.
    await expect(verdict(page).locator('img')).toHaveCount(0);
  });

  test('asks one flag of each country, marks the game and goes over the misses', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/de-que-pais/paises-OC/todas');
    const total = WITH_REGIONS.filter((c) => c.ct === 'OC').length;
    const asked: { land: Land; file: string; regions: string[] }[] = [];
    for (let i = 0; i < total; i++) {
      await expect(hud(page)).toHaveText(`${i + 1} / ${total}`);
      const shown = await landShown(page);
      for (const option of shown.options) expect(option.ct).toBe('OC');
      asked.push(shown);
      // The first two are missed.
      await names(page)
        .nth(i < 2 ? (shown.at + 1) % 4 : shown.at)
        .click();
      await expect(verdict(page)).toHaveClass(i < 2 ? /verdict-bad/ : /verdict-ok/);
      await page.keyboard.press('Enter');
    }
    // Each country once.
    expect(new Set(asked.map((a) => a.land.id)).size).toBe(total);
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    const pct = Math.round((100 * (total - 2)) / total);
    await expect(page.locator('.fq-mark')).toHaveText(`${pct} %`);
    // What was missed: the region, the country it is of, and the country it was taken for.
    const rows = page.locator('details.g-bad li');
    await expect(rows).toHaveCount(2);
    for (const [i, miss] of asked.slice(0, 2).entries()) {
      for (const region of miss.regions) await expect(rows.nth(i)).toContainText(region);
      await expect(rows.nth(i)).toContainText(miss.land.n.es);
      await expect(rows.nth(i)).toContainText('Dijiste ');
    }
    const state = await kept(page);
    expect((state.best as Record<string, number>)['flag:de-que-pais/paises-OC/todas']).toBe(pct);
    const sessions = state.sessions as { section: string; mode: string; label: string; total: number; ok: number; bad: number }[];
    expect(sessions[0]).toMatchObject({ section: 'flags', mode: 'flag-land', label: 'Países de Oceanía', total, ok: total - 2, bad: 2 });
    // The flag asked is not that of a country: nothing is written of the flags of the countries.
    expect(Object.keys((state.stats as Record<string, unknown>) ?? {}).filter((key) => key.startsWith('flag:'))).toEqual([]);
    // The misses, alone: those two flags again.
    await page.getByRole('button', { name: 'Repasar 2 fallos' }).click();
    await expect(hud(page)).toHaveText('1 / 2');
    const again: string[] = [];
    for (let i = 0; i < 2; i++) {
      const shown = await landShown(page);
      again.push(shown.file);
      await names(page).nth(shown.at).click();
      await page.keyboard.press('Enter');
    }
    expect(again.sort()).toEqual(asked.slice(0, 2).map((a) => a.file).sort());
    await expect(page.locator('.results-title')).toHaveText('¡Ninguna fallada!');
    await expect(page.locator('.results-note')).toHaveText('Solo las banderas que fallaste en la partida anterior.');
  });

  test('never sets beside a flag a country that flies it too', async ({ page }) => {
    await seed(page);
    // The countries of the world with such flags, two games: each flag among four that cannot be told wrong.
    for (let game = 0; game < 2; game++) {
      await open(page, '/banderas/jugar/de-que-pais/paises/todas');
      for (let i = 0; i < 40; i++) {
        await expect(hud(page)).toHaveText(`${i + 1} / ${WITH_REGIONS.length}`);
        const shown = await landShown(page);
        const also = LANDS.also[`${shown.land.id}:${shown.file}`] ?? [];
        for (const option of shown.options) {
          expect(also, `${shown.land.n.es} ${shown.file}`).not.toContain(option.id);
          // Of its continent: every one has four countries with flags of regions.
          expect(option.ct, `${shown.land.n.es}: ${option.n.es}`).toBe(shown.land.ct);
        }
        await names(page).nth(shown.at).click();
        await page.keyboard.press('Enter');
      }
      await open(page, '/banderas');
    }
  });

  test('waits for what is written of those flags, and says so when it does not come', async ({ page }) => {
    await seed(page);
    let fail = true;
    await page.route('**/data/alike/lands.json', (route) => (fail ? route.abort() : route.continue()));
    await open(page, '/banderas/jugar/de-que-pais/paises-EU/10');
    await expect(page.getByRole('alert')).toContainText('No se han podido cargar las banderas');
    await expect(names(page)).toHaveCount(0);
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(hud(page)).toHaveText('1 / 10');
    await expect(names(page)).toHaveCount(4);
  });

  test('is played in English too', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, '/banderas/jugar/de-que-pais/paises-AM/10');
    await expect(page.locator('.play-title')).toContainText('Which country?');
    await expect(page.locator('.kicker')).toHaveText('Which country is this regional flag from?');
    const first = await landShown(page, 'en');
    await names(page)
      .nth((first.at + 1) % 4)
      .click();
    await expect(verdict(page)).toContainText(`It is from ${first.land.n.en ?? first.land.n.es}.`);
    await expect(verdict(page)).toContainText('It is the flag of ');
    for (const region of first.regions) await expect(verdict(page)).toContainText(region);
  });

  test('fits a phone, the four countries one under another @movil', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/de-que-pais/paises/10');
    await expect(names(page)).toHaveCount(4);
    const shown = await landShown(page);
    const view = page.viewportSize()!;
    const boxes = await names(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ left: Math.round(r.left), bottom: r.bottom, right: r.right })));
    expect(new Set(boxes.map((b) => b.left)).size).toBe(1);
    for (const box of boxes) {
      expect(box.right).toBeLessThanOrEqual(view.width);
      expect(box.bottom).toBeLessThanOrEqual(view.height);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await names(page).nth(shown.at).tap();
    await expect(verdict(page)).toHaveClass(/verdict-ok/);
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeVisible();
  });
});
