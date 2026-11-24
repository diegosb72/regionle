/**
 * The games of the section «Banderas» that came after the first four: «Antes y ahora», «El intruso» and
 * «Parejas», each played through, and how they are chosen. What comes up is drawn by lot: the tests read
 * on the screen which flags are there, and know from the lists the site is built with whose each is.
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
type PastRow = [file: string, ratio: number, from: number, to: number, small?: string];
const INDEX = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Land[]; continents: Record<string, { es: string; en: string }> };
const FLAGS = JSON.parse(fs.readFileSync('public/data/flags.json', 'utf8')) as { regions: Record<string, [string, number, string, string, string, number, string?][]>; past: Record<string, PastRow[]> };
const PAST = JSON.parse(fs.readFileSync('public/data/alike/past.json', 'utf8')) as { also: Record<string, string[]> };

const STATES = INDEX.countries.filter((c) => c.fl && ['un', 'obs', 'partial'].includes(c.cl));
const EUROPE = STATES.filter((c) => c.ct === 'EU');
const byId = new Map(INDEX.countries.map((c) => [c.id, c]));
const byCode = new Map(INDEX.countries.filter((c) => c.fl).map((c) => [c.fl!, c]));
const byName = new Map(STATES.map((c) => [c.n.es, c]));
/** The countries of Europe that flew another flag before the one they fly. */
const CHANGED = EUROPE.filter((c) => FLAGS.past[c.id]?.length);
/** The other continent of the countries that lie on two: they are no flag from outside there either. */
const OTHER: Record<string, string> = { RU: 'AS', TR: 'EU', KZ: 'EU', AZ: 'EU', GE: 'EU', AM: 'EU', CY: 'AS', EG: 'AS', ID: 'OC' };

const fileOf = (src: string | null): string => (src ?? '').split('/').pop() ?? '';
const codeOf = (src: string | null): string => fileOf(src).replace(/\.svg$/, '');
const hud = (page: Page) => page.locator('.hud-main');
const verdict = (page: Page) => page.locator('.verdict');
const names = (page: Page) => page.locator('.fq-choices .choice');
const flags = (page: Page) => page.locator('.fq-opts .fq-opt');
const cards = (page: Page) => page.locator('.pair-board .pair-card');
const kept = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!) as { state: Record<string, unknown> }).state);
const drawn = (img: Locator) => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0);

/** The years of a flag as they are written under it, and as a sentence says them. */
const years = ([, , from, to]: PastRow): string => (from && to ? (from === to ? String(from) : `${from}–${to}`) : to ? `hasta ${to}` : `desde ${from}`);
const flew = ([, , from, to]: PastRow): string => (from && to ? (from === to ? `en ${from}` : `de ${from} a ${to}`) : to ? `hasta ${to}` : `desde ${from}`);

/** What a question of «Antes y ahora» shows: the flag of another time, the four countries, and which of them flew it. */
async function pastShown(page: Page, lang: 'es' | 'en' = 'es'): Promise<{ file: string; options: Land[]; land: Land; row: PastRow; at: number }> {
  const file = fileOf(await page.locator('.fq-flag img').getAttribute('src'));
  const options: Land[] = [];
  for (const option of await names(page).all()) {
    // Each country comes with the flag it flies today, beside its name.
    const land = byCode.get(codeOf(await option.locator('img').getAttribute('src')));
    expect(land, file).toBeTruthy();
    await expect(option.locator('span').last()).toHaveText(land!.n[lang] ?? land!.n.es);
    options.push(land!);
  }
  // A flag may have been of more than one country: only one of them is ever among the four.
  const owners = options.filter((c) => FLAGS.past[c.id]?.some((row) => row[0] === file));
  expect(owners, file).toHaveLength(1);
  const land = owners[0];
  return { file, options, land, row: FLAGS.past[land.id].find((row) => row[0] === file)!, at: options.indexOf(land) };
}

/** What a question of «El intruso» shows with the countries: the continent that is named, the four of the flags, and which is from outside. */
async function oddShown(page: Page): Promise<{ group: string; lands: Land[]; at: number }> {
  const said = (await page.locator('.fq-name').textContent()) ?? '';
  const group = Object.entries(INDEX.continents).find(([, name]) => said === `Países de ${name.es}`)?.[0];
  expect(group, said).toBeTruthy();
  const lands: Land[] = [];
  for (const img of await flags(page).locator('img').all()) lands.push(byCode.get(codeOf(await img.getAttribute('src')))!);
  expect(lands.filter(Boolean)).toHaveLength(4);
  const out = lands.filter((c) => c.ct !== group);
  expect(out, `${said}: ${lands.map((c) => c.n.es).join(', ')}`).toHaveLength(1);
  // One that lies on that continent too is not from outside it.
  expect(OTHER[out[0].id]).not.toBe(group);
  return { group: group!, lands, at: lands.indexOf(out[0]) };
}

/** The cards of a table of «Parejas» as they lie: each a flag or a name, and of which country (what is under a card is drawn, out of sight). */
async function table(page: Page): Promise<{ flag: boolean; land: Land }[]> {
  const out: { flag: boolean; land: Land }[] = [];
  for (const card of await cards(page).all()) {
    const flag = ((await card.getAttribute('class')) ?? '').includes('half-a');
    const land = flag ? byCode.get(codeOf(await card.locator('.pair-face img').getAttribute('src'))) : byName.get(((await card.locator('.pair-text').textContent()) ?? '').replace(/\u00ad/g, ''));
    expect(land).toBeTruthy();
    out.push({ flag, land: land! });
  }
  return out;
}

test.describe('where the later games of the flags are chosen', () => {
  test('offers «Antes y ahora» with countries that have changed their flag, and says why not with the rest', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/juegos/paises-EU');
    await page.getByRole('button', { name: /^Antes y ahora/ }).click();
    await expect(page.locator('.mode-about')).toContainText('Difícil. Sale una bandera que un país tuvo antes, con sus años, y eliges qué país la tuvo.');
    await expect(page.locator('.mode-facts')).toHaveText('10 preguntas');
    await expect(page.locator('.opt-hint')).toHaveText('Una bandera por cada país que ha tenido otra: en cada partida puede salir una distinta.');
    // It is not answered by typing; and with «Todas» it asks the countries that flew another flag, not every one.
    await expect(page.getByRole('radiogroup', { name: 'Cómo se responde' })).toHaveCount(0);
    await page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: 'Todas' }).click();
    await expect(page.locator('.mode-facts')).toHaveText(`${CHANGED.length} preguntas`);
    expect(CHANGED.length).toBeGreaterThan(20);
    expect(CHANGED.length).toBeLessThan(EUROPE.length);
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    // One country of Oceania changed its flag: no game.
    await page.getByRole('button', { name: /^Oceanía/ }).click();
    await expect(page.locator('.startbar-info .problem')).toHaveText('De estos países, menos de 4 han tenido otra bandera: elige otros, u otro juego.');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    // What is not countries has no flags of other times to ask.
    await page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Regiones' }).click();
    await expect(page.locator('.startbar-info .problem')).toHaveText('«Antes y ahora» se juega con países: elige los del mundo, los de un continente o los territorios.');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    await page.getByRole('radiogroup', { name: 'Qué banderas' }).getByRole('radio', { name: 'Países' }).click();
    await page.getByRole('button', { name: /^Territorios/ }).click();
    await expect(page.locator('.mode-facts')).toHaveText('6 preguntas');
    await page.getByRole('button', { name: /^Europa/ }).click();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/#\/banderas\/jugar\/antes-y-ahora\/paises-EU\/todas$/);
    await expect(hud(page)).toHaveText(`1 / ${CHANGED.length}`);
    // The addresses of the games that cannot be say so too, with the way back.
    await open(page, '/banderas/jugar/antes-y-ahora/regiones-ES/10');
    await expect(page.getByRole('alert')).toContainText('Este juego es de países');
    await open(page, '/banderas/jugar/antes-y-ahora/paises-OC/10');
    await expect(page.getByRole('alert')).toContainText('Pocas banderas de otros tiempos');
    await page.getByRole('button', { name: 'Elegir otro juego de banderas' }).click();
    await expect(page).toHaveURL(/#\/banderas$/);
  });

  test('asks how many pairs «Parejas» deals, and keeps that apart from how long the other games are', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/juegos/paises-EU');
    await page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: '20' }).click();
    await page.getByRole('button', { name: /^Parejas/ }).click();
    await expect(page.locator('.mode-about')).toContainText('Fácil. Cartas boca abajo');
    // Pairs, not questions: eight as it opens.
    await expect(page.getByRole('radiogroup', { name: 'Cuántas preguntas' })).toHaveCount(0);
    const sizes = page.getByRole('radiogroup', { name: 'Cuántas parejas' });
    await expect(sizes.getByRole('radio')).toHaveText(['6', '8', '10', '12']);
    await expect(sizes.getByRole('radio', { name: '8', exact: true })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.mode-facts')).toHaveText('8 parejas, 16 cartas');
    await sizes.getByRole('radio', { name: '12' }).click();
    await expect(page.locator('.mode-facts')).toHaveText('12 parejas, 24 cartas');
    expect((await kept(page)).flagLast).toBe('parejas/paises-EU/12');
    // The other games are as long as they were left; and the pairs, as many, when it is chosen again.
    await page.getByRole('button', { name: /^El intruso/ }).click();
    await expect(page.getByRole('radiogroup', { name: 'Cuántas preguntas' }).getByRole('radio', { name: '20' })).toHaveAttribute('aria-checked', 'true');
    await expect(page.locator('.mode-about')).toContainText('Medio. Cuatro banderas: tres son del grupo que se dice y una no.');
    await expect(page.locator('.mode-facts')).toHaveText('20 preguntas');
    expect((await kept(page)).flagLast).toBe('el-intruso/paises-EU/20');
    await page.getByRole('button', { name: /^Parejas/ }).click();
    await expect(sizes.getByRole('radio', { name: '12' })).toHaveAttribute('aria-checked', 'true');
    // Six emirates whose flags are four pictures: four pairs, however many are asked for.
    await open(page, '/banderas/juegos/regiones-AE');
    await expect(page.locator('.mode-facts')).toHaveText('4 parejas, 8 cartas');
    await expect(page.locator('.opt-hint')).toHaveText('De estas banderas solo salen 4 parejas.');
    // What was left is what the section opens with, the pairs too.
    await page.reload();
    await expect(page.getByRole('button', { name: /^Parejas/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(sizes.getByRole('radio', { name: '12' })).toHaveAttribute('aria-checked', 'true');
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page).toHaveURL(/#\/banderas\/jugar\/parejas\/regiones-AE\/12$/);
    await expect(cards(page)).toHaveCount(8);
  });

  test('says how each of the three is played', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas');
    const panel = page.getByRole('dialog', { name: 'Cómo se juega' });
    for (const [game, text] of [
      ['Parejas', 'Solo cuenta como fallo el intento que te podías haber ahorrado'],
      ['El intruso', 'tres son de ese grupo y una no'],
      ['Antes y ahora', 'Nunca sale como opción un país que también tuvo esa misma bandera'],
    ]) {
      await page.getByRole('button', { name: new RegExp(`^${game}`) }).click();
      await page.locator('.mode-about').getByRole('button', { name: 'Cómo se juega' }).click();
      await expect(panel.getByRole('heading', { level: 3 })).toHaveText(game);
      await expect(panel).toContainText(text);
      await panel.getByRole('button', { name: 'Entendido' }).click();
      await expect(panel).toHaveCount(0);
    }
  });
});

test.describe('«Antes y ahora»', () => {
  test('shows a flag of another time with its years, and four countries with their flags of today', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/antes-y-ahora/paises-EU/10');
    await expect(page.locator('.play-title')).toContainText('Antes y ahora');
    await expect(page.locator('.play-title')).toContainText('Países de Europa');
    await expect(page.locator('.kicker')).toHaveText('¿Qué país tuvo esta bandera?');
    await expect(hud(page)).toHaveText('1 / 10');
    await expect(names(page)).toHaveCount(4);
    const first = await pastShown(page);
    await expect(page.locator('.fq-when')).toHaveText(years(first.row));
    // Four countries of Europe, no two with the same flag of today, and none that flew this flag too.
    expect(new Set(first.options.map((c) => c.id)).size).toBe(4);
    for (const option of first.options) {
      expect(option.ct).toBe('EU');
      expect(PAST.also[`${first.land.id}:${first.file}`] ?? []).not.toContain(option.id);
    }
    await expect.poll(() => drawn(page.locator('.fq-flag img'))).toBe(true);
    for (const img of await names(page).locator('img').all()) await expect.poll(() => drawn(img)).toBe(true);
    // Right: the country, and when it flew the flag.
    await names(page).nth(first.at).click();
    await expect(verdict(page)).toHaveClass(/verdict-ok/);
    await expect(verdict(page)).toContainText('¡Correcto!');
    await expect(verdict(page)).toContainText(`${first.land.n.es} la tuvo ${flew(first.row)}.`);
    await expect(names(page).nth(first.at)).toHaveClass(/right/);
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10');
    // Wrong, with the keys: whose it was, with the right one marked among the four.
    const second = await pastShown(page);
    expect(second.land.id).not.toBe(first.land.id);
    const other = (second.at + 1) % 4;
    await page.keyboard.press(String(other + 1));
    await expect(verdict(page)).toHaveClass(/verdict-bad/);
    await expect(verdict(page)).toContainText(`Fue la bandera de ${second.land.n.es}.`);
    await expect(verdict(page)).toContainText(`La tuvo ${flew(second.row)}.`);
    await expect(names(page).nth(second.at)).toHaveClass(/right/);
    await expect(names(page).nth(other)).toHaveClass(/wrong/);
    // Whose flag it was is not what the rest of the game keeps of the flags of the countries.
    expect(Object.keys((await kept(page)).stats as object)).toEqual([]);
  });

  test('asks one flag of each country, ends with the mark and goes over the flags that were missed', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/antes-y-ahora/paises-EU/10');
    const asked: { land: Land; row: PastRow; file: string }[] = [];
    const missed: string[] = [];
    for (let i = 0; i < 10; i++) {
      await expect(hud(page)).toHaveText(`${i + 1} / 10`);
      const q = await pastShown(page);
      asked.push(q);
      // The third and the seventh are missed.
      const wrong = i === 2 || i === 6;
      if (wrong) missed.push(q.file);
      await names(page).nth(wrong ? (q.at + 1) % 4 : q.at).click();
      await expect(verdict(page)).toBeVisible();
      await page.keyboard.press('Enter');
    }
    // Ten countries, each once.
    expect(new Set(asked.map((q) => q.land.id)).size).toBe(10);
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.donut')).toContainText('80 %');
    await expect(page.locator('.fq-mark')).toHaveText('80 %');
    const bad = page.locator('details.g-bad');
    await expect(bad.locator('li')).toHaveCount(2);
    // Each with its country, its years and what it was taken for.
    for (const q of asked.filter((x) => missed.includes(x.file))) {
      const row = bad.locator('li').filter({ has: page.locator(`img[src$="${q.row[4] ?? q.file}"]`) });
      await expect(row).toContainText(q.land.n.es);
      await expect(row).toContainText(years(q.row));
      await expect(row).toContainText('Dijiste');
    }
    const state = await kept(page);
    expect((state.best as Record<string, number>)['flag:antes-y-ahora/paises-EU/10']).toBe(80);
    expect((state.sessions as { section: string; mode: string; label: string; total: number; ok: number; bad: number }[])[0]).toMatchObject({ section: 'flags', mode: 'flag-past', label: 'Países de Europa', total: 10, ok: 8, bad: 2 });
    // The misses alone: those two flags, no others.
    await page.getByRole('button', { name: 'Repasar 2 fallos' }).click();
    await expect(hud(page)).toHaveText('1 / 2');
    const again: string[] = [];
    for (let i = 0; i < 2; i++) {
      const q = await pastShown(page);
      again.push(q.file);
      await names(page).nth(q.at).click();
      await page.keyboard.press('Enter');
    }
    expect(again.sort()).toEqual([...missed].sort());
    await expect(page.locator('.results-title')).toHaveText('¡Ninguna fallada!');
    await expect(page.locator('.results-note')).toHaveText('Solo las banderas que fallaste en la partida anterior.');
    // It is in what has been played, and its mark among the records.
    await open(page, '/progreso');
    await expect(page.locator('.g-game').first()).toHaveText('Antes y ahora');
    const record = page.locator('.records li').filter({ hasText: 'Antes y ahora' });
    await expect(record).toContainText('Antes y ahora · Países de Europa · 10 preguntas');
    await expect(record.locator('span')).toHaveText('80 %');
  });

  test('waits for what is written of the flags, and says so when it does not come', async ({ page }) => {
    await seed(page);
    let fail = true;
    await page.route('**/data/alike/past.json', (route) => (fail ? route.abort() : route.continue()));
    await open(page, '/banderas/jugar/antes-y-ahora/paises/10');
    await expect(page.getByRole('alert')).toContainText('No se han podido cargar las banderas');
    fail = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(hud(page)).toHaveText('1 / 10');
    await expect(names(page)).toHaveCount(4);
  });

  test('is played in English, and fits a phone with the flag and the four countries in sight @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, '/banderas/jugar/antes-y-ahora/paises/10');
    await expect(page.locator('.kicker')).toHaveText('Which country flew this flag?');
    await expect(names(page)).toHaveCount(4);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const height = page.viewportSize()!.height;
    for (const option of await names(page).all()) {
      const box = (await option.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    // The names are in English here.
    const q = await pastShown(page, 'en');
    await names(page).nth(q.at).click();
    await expect(verdict(page)).toContainText('Correct!');
    await expect(verdict(page)).toContainText(/ flew it (from \d+ to \d+|in \d+|until \d+)\.$/);
    await expect(page.getByRole('button', { name: 'Next' })).toBeInViewport();
  });
});

test.describe('«El intruso»', () => {
  test('shows four flags and the name of a group: three are of it, and the one from outside is the answer', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/el-intruso/paises/10');
    await expect(page.locator('.play-title')).toContainText('El intruso');
    await expect(page.locator('.kicker')).toHaveText('¿Cuál no es de este grupo?');
    await expect(hud(page)).toHaveText('1 / 10');
    await expect(flags(page)).toHaveCount(4);
    // No flag says whose it is until the question is answered.
    await expect(page.locator('.fq-cap span')).toHaveText(['', '', '', '']);
    const first = await oddShown(page);
    await flags(page).nth(first.at).click();
    await expect(verdict(page)).toHaveClass(/verdict-ok/);
    await expect(verdict(page)).toContainText('¡Correcto!');
    const out = first.lands[first.at];
    const from = INDEX.continents[out.ct].es;
    await expect(verdict(page)).toContainText(`La de ${out.n.es}: ${from}.`);
    // Now each says whose it is; the one from outside, where it is from as well.
    await expect(page.locator('.fq-cap span')).toHaveText(first.lands.map((c, i) => (i === first.at ? `${c.n.es} · ${from}` : c.n.es)));
    await expect(flags(page).nth(first.at)).toHaveClass(/right/);
    await page.keyboard.press('Enter');
    await expect(hud(page)).toHaveText('2 / 10');
    // Wrong, with the keys: which it was, by its number.
    const second = await oddShown(page);
    const other = (second.at + 1) % 4;
    await page.keyboard.press(String(other + 1));
    await expect(verdict(page)).toHaveClass(/verdict-bad/);
    await expect(verdict(page)).toContainText(`Esa es la de ${second.lands[other].n.es}.`);
    await expect(verdict(page)).toContainText(`La intrusa era la número ${second.at + 1}: la de ${second.lands[second.at].n.es} (${INDEX.continents[second.lands[second.at].ct].es}).`);
    await expect(flags(page).nth(second.at)).toHaveClass(/right/);
    await expect(flags(page).nth(other)).toHaveClass(/wrong/);
    // Where a flag is from is not what the rest of the game keeps of the flags of the countries.
    expect(Object.keys((await kept(page)).stats as object)).toEqual([]);
    // To the end: the mark, and each flag from outside with the group it was set in.
    await page.keyboard.press('Enter');
    const groups = new Set([first.group, second.group]);
    for (let i = 2; i < 10; i++) {
      await expect(hud(page)).toHaveText(`${i + 1} / 10`);
      const q = await oddShown(page);
      groups.add(q.group);
      await page.keyboard.press(String(q.at + 1));
      await expect(verdict(page)).toHaveClass(/verdict-ok/);
      await page.keyboard.press('Enter');
    }
    // With the countries of the world, another continent in each question: more than one in ten.
    expect(groups.size).toBeGreaterThan(1);
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.donut')).toContainText('90 %');
    const miss = page.locator('details.g-bad li');
    await expect(miss).toHaveCount(1);
    await expect(miss).toContainText(second.lands[second.at].n.es);
    await expect(miss).toContainText(`${INDEX.continents[second.lands[second.at].ct].es} · la intrusa entre «Países de ${INDEX.continents[second.group].es}»`);
    await expect(miss).toContainText(`Elegiste la de ${second.lands[other].n.es}`);
    expect(((await kept(page)).best as Record<string, number>)['flag:el-intruso/paises/10']).toBe(90);
    // The miss alone: that flag again, beside three others.
    await page.getByRole('button', { name: 'Repasar 1 fallo' }).click();
    await expect(hud(page)).toHaveText('1 / 1');
    const again = await oddShown(page);
    expect(again.lands[again.at].id).toBe(second.lands[second.at].id);
  });

  test('takes the flag from outside from another country, with the regions of one', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/el-intruso/regiones-ES/10');
    await expect(page.locator('.fq-name')).toHaveText('Regiones de España');
    const spain = new Set(FLAGS.regions.ES.flatMap((r) => [r[4], r[6] ?? r[4]]));
    const whose = new Map<string, { name: string; land: string }>();
    for (const [country, rows] of Object.entries(FLAGS.regions)) for (const r of rows) for (const file of [r[4], r[6] ?? r[4]]) if (!whose.has(file) || country === 'ES') whose.set(file, { name: r[2], land: country });
    for (let i = 0; i < 3; i++) {
      await expect(hud(page)).toHaveText(`${i + 1} / 10`);
      const files: string[] = [];
      for (const img of await flags(page).locator('img').all()) files.push(fileOf(await img.getAttribute('src')));
      const out = files.filter((file) => !spain.has(file));
      expect(out, files.join(' ')).toHaveLength(1);
      const at = files.indexOf(out[0]);
      // Of a region of another country of Europe.
      const from = whose.get(out[0])!;
      expect(from.land).not.toBe('ES');
      expect(byId.get(from.land)!.ct).toBe('EU');
      await flags(page).nth(at).click();
      await expect(verdict(page)).toHaveClass(/verdict-ok/);
      await expect(page.locator('.fq-cap span').nth(at)).toHaveText(`${from.name} · ${byId.get(from.land)!.n.es}`);
      await page.keyboard.press('Enter');
    }
  });

  test('is played all the same when the look-alikes do not come, and fits a phone @movil', async ({ page }) => {
    await seed(page);
    await page.route('**/data/alike/countries.json', (route) => route.abort());
    await open(page, '/banderas/jugar/el-intruso/paises-EU/10');
    await expect(page.locator('.fq-name')).toHaveText('Países de Europa');
    await expect(flags(page)).toHaveCount(4);
    const lands: Land[] = [];
    for (const img of await flags(page).locator('img').all()) lands.push(byCode.get(codeOf(await img.getAttribute('src')))!);
    expect(lands.filter((c) => c.ct === 'EU')).toHaveLength(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    const height = page.viewportSize()!.height;
    for (const flag of await flags(page).all()) {
      const box = (await flag.boundingBox())!;
      expect(box.y + box.height).toBeLessThanOrEqual(height);
    }
    await flags(page).nth(lands.findIndex((c) => c.ct !== 'EU')).click();
    await expect(verdict(page)).toHaveClass(/verdict-ok/);
    await expect(page.getByRole('button', { name: 'Siguiente' })).toBeInViewport();
  });
});

test.describe('«Parejas» de banderas', () => {
  test('deals a flag and a name for each, face down, and puts together the two that are turned when they match', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/parejas/paises-EU/6');
    await expect(page.locator('.play-title')).toContainText('Parejas');
    await expect(page.locator('.play-title')).toContainText('Países de Europa');
    await expect(page.locator('.kicker')).toHaveText('Cada bandera, con su nombre');
    await expect(hud(page)).toHaveText('0 / 6');
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator('.pair-card.half-a')).toHaveCount(6);
    await expect(page.locator('.pair-card.half-b')).toHaveCount(6);
    await expect(page.locator('.pair-card.up')).toHaveCount(0);
    await expect(page.locator('.pair-said')).toHaveText('Levanta una bandera y un nombre: si el nombre es el de esa bandera, son pareja.');
    const lie = await table(page);
    // Six countries of Europe, each twice: its flag and its name.
    expect(new Set(lie.map((c) => c.land.id)).size).toBe(6);
    for (const { land } of lie) expect(land.ct).toBe('EU');
    // Face down, a card says what it is and no more.
    await expect(cards(page).nth(0)).toHaveAttribute('aria-label', `Carta 1, ${lie[0].flag ? 'una bandera' : 'un nombre'}, boca abajo`);
    const flagAt = (id: string) => lie.findIndex((c) => c.flag && c.land.id === id);
    const nameAt = (id: string) => lie.findIndex((c) => !c.flag && c.land.id === id);
    const ids = [...new Set(lie.map((c) => c.land.id))];
    // A flag is turned: the other flags wait, the names do not.
    await cards(page).nth(flagAt(ids[0])).click();
    await expect(page.locator('.pair-card.up')).toHaveCount(1);
    await expect(page.locator('.pair-card.half-a.waits')).toHaveCount(5);
    await expect(page.locator('.pair-card.half-b.waits')).toHaveCount(0);
    await expect.poll(() => drawn(cards(page).nth(flagAt(ids[0])).locator('img'))).toBe(true);
    // Its name: a pair, which stays in sight.
    await cards(page).nth(nameAt(ids[0])).click();
    await expect(page.locator('.pair-said')).toHaveText(`¡Pareja! Es la bandera de ${byId.get(ids[0])!.n.es}.`);
    await expect(page.locator('.pair-card.found')).toHaveCount(2);
    await expect(hud(page)).toHaveText('1 / 6');
    await expect(page.locator('.pair-turns b')).toHaveText('1');
    await expect(cards(page).nth(nameAt(ids[0]))).toHaveAttribute('aria-label', `${byId.get(ids[0])!.n.es}, emparejada`);
    // Two that do not match, neither seen before: no pair and no miss. They go back with the next card.
    await cards(page).nth(flagAt(ids[1])).click();
    await cards(page).nth(nameAt(ids[2])).click();
    await expect(page.locator('.pair-said')).toHaveText('No son pareja.');
    await expect(page.locator('.pair-card.no')).toHaveCount(2);
    await expect(page.locator('.pair-turns b')).toHaveText('2');
    // The same flag with another name, when its own has not been seen: no miss either… but with the one that was, it is.
    await cards(page).nth(flagAt(ids[1])).click();
    await expect(page.locator('.pair-card.no')).toHaveCount(0);
    await cards(page).nth(nameAt(ids[2])).click();
    await expect(page.locator('.pair-said')).toHaveText('No son pareja, y la segunda ya la habías visto: cuenta como fallo.');
    // The rest, each with its own.
    for (const id of ids.slice(1)) {
      await cards(page).nth(flagAt(id)).click();
      await cards(page).nth(nameAt(id)).click();
      await expect(page.locator('.pair-said')).toHaveText(`¡Pareja! Es la bandera de ${byId.get(id)!.n.es}.`);
    }
    // The result: every pair, the one that took a turn too many, the turns and the mark.
    await expect(page.locator('.results-title')).toHaveText('¡Todas las parejas!');
    await expect(page.locator('.results-note')).toContainText('Una pareja te costó un intento de más');
    await expect(page.locator('.results-stats')).toContainText('Intentos8');
    await expect(page.locator('.fq-mark')).toHaveText('8 intentos');
    await expect(page.locator('details.g-bad li')).toHaveText([byId.get(ids[1])!.n.es]);
    await expect(page.locator('details.g-ok li')).toHaveCount(5);
    const state = await kept(page);
    expect((state.best as Record<string, number>)['flag:parejas/paises-EU/6']).toBe(8);
    expect((state.sessions as { section: string; mode: string; label: string; total: number; ok: number; bad: number }[])[0]).toMatchObject({ section: 'flags', mode: 'flag-pairs', label: 'Países de Europa', total: 6, ok: 5, bad: 1 });
  });

  test('keeps the table that took the fewest turns, and is played with the keyboard', async ({ page }) => {
    await seed(page, { best: { 'flag:parejas/paises-EU/6': 9 } });
    await open(page, '/banderas/jugar/parejas/paises-EU/6');
    await expect(cards(page)).toHaveCount(12);
    const lie = await table(page);
    const ids = [...new Set(lie.map((c) => c.land.id))];
    // The arrows take the first card and go from one to the next; Enter turns it over.
    await page.keyboard.press('ArrowRight');
    await expect(cards(page).nth(0)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(cards(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowDown');
    await expect(cards(page).nth(5)).toBeFocused();
    await page.keyboard.press('Home');
    await page.keyboard.press('Enter');
    await expect(cards(page).nth(0)).toHaveClass(/\bup\b/);
    // Its other half, with the mouse; and the rest, each with its own: six turns.
    const half = (id: string, flag: boolean) => lie.findIndex((c) => c.flag === flag && c.land.id === id);
    await cards(page).nth(half(lie[0].land.id, !lie[0].flag)).click();
    for (const id of ids.filter((x) => x !== lie[0].land.id)) {
      await cards(page).nth(half(id, true)).click();
      await cards(page).nth(half(id, false)).click();
    }
    await expect(page.locator('.results-title')).toHaveText('¡Todas a la primera!');
    await expect(page.locator('.fq-mark')).toHaveText('¡Nueva! Antes, 9 intentos');
    expect(((await kept(page)).best as Record<string, number>)['flag:parejas/paises-EU/6']).toBe(6);
    // Another table, left half-way: its pairs count, and the mark stays.
    await page.getByRole('button', { name: 'Otra vez' }).click();
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator('.pair-card.up')).toHaveCount(0);
    const next = await table(page);
    const one = next[0].land.id;
    await cards(page).nth(next.findIndex((c) => c.flag && c.land.id === one)).click();
    await cards(page).nth(next.findIndex((c) => !c.flag && c.land.id === one)).click();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('details.g-warn li')).toHaveCount(5);
    await expect(page.locator('.fq-mark')).toHaveCount(0);
    expect(((await kept(page)).best as Record<string, number>)['flag:parejas/paises-EU/6']).toBe(6);
    // The mark is said where the game is chosen, and among the records: turns, not a share.
    await page.getByRole('button', { name: 'Cambiar de juego' }).click();
    await expect(page.locator('.mode-facts')).toContainText('Tu marca: 6 intentos');
    await open(page, '/progreso');
    const record = page.locator('.records li').filter({ hasText: 'Parejas' });
    await expect(record).toContainText('Parejas · Países de Europa · 6 parejas');
    await expect(record.locator('span')).toHaveText('6 intentos');
  });

  test('tells a capital by its country and a country that is no more by its years, on the card of its name', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/jugar/parejas/capitales/6');
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator('.pair-card.half-b .fp-under')).toHaveCount(6);
    const land = (await page.locator('.pair-card.half-b .fp-under').first().textContent()) ?? '';
    expect(INDEX.countries.some((c) => c.n.es === land), land).toBe(true);
    await open(page, '/banderas/jugar/parejas/desaparecidos/6');
    await expect(cards(page)).toHaveCount(12);
    await expect(page.locator('.pair-card.half-b .fp-under').first()).toHaveText(/^(\d+–\d+|\d+|hasta \d+|desde \d+)$/);
    // A flag that does not come is said, with the way to ask for it again.
    let fail = true;
    await page.route('**/flags/commons/**', (route) => (fail ? route.abort() : route.continue()));
    await page.goto('./#/banderas/jugar/parejas/regiones-JP/6');
    await page.reload();
    const lost = page.locator('.fq-lost');
    await expect(lost).toContainText('No se han podido cargar todas las banderas.');
    fail = false;
    await lost.getByRole('button', { name: 'Reintentar' }).click();
    await expect(lost).toHaveCount(0);
    for (const img of await page.locator('.pair-card.half-a img').all()) await expect.poll(() => drawn(img)).toBe(true);
  });

  test('fits a phone with twelve pairs, and is played in English @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, '/banderas/jugar/parejas/paises/12');
    await expect(page.locator('.kicker')).toHaveText('Each flag with its name');
    await expect(cards(page)).toHaveCount(24);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    // Four to a row at least, every card on the screen and large enough for a finger.
    const boxes = await cards(page).evaluateAll((els) => els.map((el) => el.getBoundingClientRect()).map((r) => ({ top: Math.round(r.top), bottom: r.bottom, width: r.width, height: r.height })));
    expect(boxes.filter((b) => b.top === boxes[0].top).length).toBeGreaterThanOrEqual(4);
    for (const box of boxes) {
      expect(box.bottom).toBeLessThanOrEqual(page.viewportSize()!.height);
      expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    }
    await page.locator('.pair-card.half-a').first().click();
    await page.locator('.pair-card.half-b').first().click();
    await expect(page.locator('.pair-said')).toHaveText(/^(A pair! It is the flag of .+\.|Not a pair\.)$/);
    await expect(page.locator('.pair-turns')).toHaveText('Turns: 1');
  });
});
