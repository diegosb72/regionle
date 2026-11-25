import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, seed } from './helpers';

/**
 * The sheet of a country, which the gallery of flags opens when the flag of a country is touched
 * (screens/FlagProfile.tsx). Every country with a flag has one: with what the game knows of it and what
 * Wikidata and Wikipedia say of it and of its flag, with how Wikipedia begins to tell of both and, where
 * one has been chosen for it, with a photograph at its head; and, where somebody has written of it (for now,
 * of Brazil alone), with its texts, its times and its photographs instead. One sheet leads to another.
 */

interface Photo {
  file: string;
  sizes: number[];
  title: string;
  by?: string;
  licence: string;
  licenceUrl?: string;
  es: string;
  en: string;
}
/** The sheet the site is built with: what is on screen is read against it. */
const SHEET = JSON.parse(fs.readFileSync('public/data/profiles/BR.json', 'utf8')) as {
  about: { es: string[]; en: string[] };
  flag: { parts: { es: [string, string]; en: [string, string] }[] };
  times: { from: number; to?: number; now?: true; name: { es: string; en: string }; picture?: Photo }[];
  photos: Photo[];
};
const FLAGS = JSON.parse(fs.readFileSync('public/data/flags.json', 'utf8')) as {
  regions: Record<string, unknown[]>;
  capitals: [string, string, ...unknown[]][];
  cities: Record<string, unknown[]>;
  past: Record<string, [string, number, number, number, string?][]>;
  gone: [string, string, string, string, number, number, number, string?][];
};
/** What a sheet nobody has written of tells in words: how Wikipedia begins to tell of the country and of its flag, by language. */
type Lead = { es?: string[]; en?: string[] };
const sheetFile = (id: string) =>
  JSON.parse(fs.readFileSync(`public/data/profiles/${id}.json`, 'utf8')) as { lead?: Lead; flag?: { lead?: Lead }; read?: { es?: string; en?: string }; readFlag?: { es?: string; en?: string }; photos?: (Photo & { focus?: [number, number] })[] };
/** The countries as the game has them: what each is called, and how its finest divisions are. */
const COUNTRIES = (JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: { id: string; n: { es: string; en?: string }; fl?: string; lv: { k: string; n: number }[] }[] }).countries;
const commons = (title: string): string => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace(/ /g, '_'))}`;
/** A country for whose sheet no photograph has been chosen yet: the first there is, as long as there is one. */
const BARE = COUNTRIES.find((c) => c.fl && c.id !== 'AQ' && fs.existsSync(`public/data/profiles/${c.id}.json`) && !sheetFile(c.id).photos)!;

/** Whether an image has arrived and is a picture. */
const drawn = (img: Locator): Promise<boolean> => img.evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0);
const sheetOf = (page: Page): Locator => page.locator('dialog.fp-dlg');
/** Opens the sheet by its address and waits for what is written of the country. */
async function openSheet(page: Page, route = '/banderas/paises/BR'): Promise<Locator> {
  await open(page, route);
  const sheet = sheetOf(page);
  await expect(sheet.locator('article.fp')).toBeVisible();
  return sheet;
}

test.describe('the sheet of a country, in the gallery of flags', () => {
  test('opens from the flag of Brazil, over the gallery, with what the country is and a photograph at its head', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/paises');
    await page.locator('.fg-tile').filter({ hasText: /^Brasil$/ }).click();
    const sheet = sheetOf(page);
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Brasil');
    await expect(page).toHaveURL(/#\/banderas\/paises\/BR$/);
    // It is the gallery that is behind it, and nothing of the panel a flag opens by itself.
    await expect(page.getByRole('heading', { level: 1, includeHidden: true })).toHaveText('Galería de banderas');
    await expect(page.locator('dialog.fg-dlg')).toHaveCount(0);

    await expect(sheet.locator('.fp-id .kicker')).toHaveText('América del Sur');
    await expect(sheet.locator('.fp-official')).toHaveText('República Federativa de Brasil');
    await expect(sheet.locator('.fp-local')).toHaveText('República Federativa do Brasil');
    await expect(sheet.locator('.fp-local')).toHaveAttribute('lang', 'pt');
    await expect(sheet.locator('.fp-flag')).toHaveAttribute('alt', 'Bandera de Brasil');
    await expect(sheet.locator('.fp-flag')).toHaveAttribute('src', /flags\/br\.svg$/);
    await expect(sheet.locator('.fp-about p')).toHaveText(SHEET.about.es);

    // The photograph at its head: asked for at once, from the site itself, with what is seen in it and whose it is.
    const head = SHEET.photos[0];
    const hero = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(hero)).toBe(true);
    expect(await hero.getAttribute('loading')).toBeNull();
    expect(await hero.evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(new RegExp(`/photos/${head.file}-\\d+\\.webp$`));
    const caption = sheet.locator('.fp-hero figcaption');
    await expect(caption).toContainText(head.es);
    await expect(caption.locator('.fp-credit')).toContainText(`${head.by} · ${head.licence} · Wikimedia Commons`);
    await expect(caption.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(head.title));
    await expect(caption.getByRole('link', { name: head.licence })).toHaveAttribute('href', head.licenceUrl!);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('gives the figures the game has of the country, its place in the world, where it is and its neighbours', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page);
    const glance = sheet.locator('.fp-glance');
    await expect(glance.getByRole('heading', { level: 3 })).toHaveText('De un vistazo');
    await expect(glance.locator('.fp-facts dt')).toHaveText([
      'Capital',
      'Población',
      'Superficie',
      'Moneda',
      'Idioma oficial',
      'Dominio de internet',
      'Prefijo telefónico',
      'Esperanza de vida',
      'PIB por habitante',
      'Edad mediana',
      'Población urbana',
      'Fecundidad',
      'Longitud de costa',
      'Altitud máxima',
      'Lema',
      'Himno',
    ]);
    await expect(glance.locator('.fp-facts dd')).toHaveText([
      'Brasilia',
      /^213 millones de habitantes\s+2025 · 7\.º del mundo$/,
      /^8,51 millones de km²\s+5\.º del mundo$/,
      'real brasileño',
      'portugués',
      '.br',
      '+55',
      /^76,3 años\s+2024$/,
      /^19\.600 \$\s+2024$/,
      /^35,4 años\s+2025$/,
      /^87,8 %\s+2023$/,
      /^1,73 hijos por mujer\s+2025$/,
      '7491 km',
      '2994 m',
      /^«Ordem e Progresso»\s+\(Orden y progreso\)$/,
      'Himno nacional del Brasil',
    ]);
    // The motto is said in its language, for whoever hears the sheet read.
    await expect(glance.locator('.fp-facts dd span[lang]')).toHaveAttribute('lang', 'pt');

    // Where it is: the globe, the land of the others and its own, which is no speck.
    const globe = glance.locator('.fp-where svg');
    await expect(globe).toHaveAttribute('aria-label', 'Dónde está Brasil en el mundo');
    await expect(globe.locator('path')).toHaveCount(3);
    const own = (await globe.locator('path.fp-own').boundingBox())!;
    const all = (await globe.boundingBox())!;
    expect(own.width).toBeGreaterThan(all.width * 0.15);
    expect(own.x).toBeGreaterThan(all.x);
    expect(own.x + own.width).toBeLessThan(all.x + all.width);
    await expect(glance.locator('.fp-where figcaption')).toHaveText('América del Sur');

    await expect(glance.locator('.label')).toHaveText('Limita con 10 países y territorios');
    // By their name, and not by their code (PE, PY).
    await expect(glance.locator('.fp-nb li')).toHaveText(['Argentina', 'Bolivia', 'Colombia', 'Guayana Francesa', 'Guyana', 'Paraguay', 'Perú', 'Surinam', 'Uruguay', 'Venezuela']);
    await expect(glance.locator('.fp-nb li img').first()).toHaveAttribute('src', /flags\/ar\.svg$/);
    // Each leads to its own sheet.
    await expect(glance.locator('.fp-nb li a')).toHaveCount(10);
    await expect(glance.locator('.fp-nb li a').first()).toHaveAttribute('href', '#/banderas/paises/AR');
  });

  test('says what the flag means, part by part, and when it was adopted', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page);
    const flag = sheet.locator('.fp-flagsec');
    await expect(flag.getByRole('heading', { level: 3 })).toHaveText('La bandera');
    await expect(flag.locator('.fp-flag-big')).toHaveAttribute('src', /flags\/br\.svg$/);
    await expect(flag.locator('.fp-flag-in p').first()).toContainText('Se adoptó el 19 de noviembre de 1889');
    await expect(flag.locator('.fp-flag-facts dt')).toHaveText(['Adoptada', 'Como es hoy, desde', 'Proporción', 'La llaman', 'La idearon']);
    await expect(flag.locator('.fp-flag-facts dd')).toHaveText(['19 de noviembre de 1889', '11 de mayo de 1992', /^7:10\s+de alto por ancho/, '«Auriverde», la de oro y verde', /^Raimundo Teixeira Mendes, con /]);
    await expect(flag.locator('.fp-parts dt')).toHaveText(SHEET.flag.parts.map((part) => part.es[0]));
    await expect(flag.locator('.fp-parts dd')).toHaveText(SHEET.flag.parts.map((part) => part.es[1]));
    await expect(flag.locator('.fp-parts dt')).toHaveText(['El verde y el amarillo', 'El cielo de Río', '27 estrellas', '«Ordem e Progresso»']);
  });

  test('tells its flags through time, each with what the country was then, and the one of today last', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page);
    const times = sheet.locator('.fp-times');
    await expect(times.getByRole('heading', { level: 3 })).toHaveText('Sus banderas en el tiempo');
    const stops = times.locator('ol > li');
    await expect(stops).toHaveCount(6);
    await expect(times.locator('.fp-when')).toHaveText(['1822–1889', '15–19 de noviembre de 1889', '1889–1960', '1960–1968', '1968–1992', 'Desde 1992']);
    await expect(times.getByRole('heading', { level: 4 })).toHaveText(['Imperio del Brasil', 'Bandera provisional de la república', '21 estrellas', '22 estrellas', '23 estrellas', '27 estrellas']);
    await expect(stops.nth(0).locator('.fp-time-text')).toContainText('El 7 de septiembre de 1822');
    await expect(stops.nth(3).locator('.fp-time-text')).toContainText('la capital pasó a Brasilia');

    // Each with the flag the game has of that time: that of the Empire, the four the republic flew before, and the one it flies.
    const empire = FLAGS.gone.find((row) => row[0] === 'Q217230')!;
    const files = [empire[7] ?? empire[3], ...FLAGS.past.BR.map((row) => row[4] ?? row[0])];
    for (const [i, file] of files.entries()) {
      const img = stops.nth(i).locator('.fp-time-flag img');
      await img.scrollIntoViewIfNeeded();
      await expect(img).toHaveAttribute('src', new RegExp(`flags/commons/${file}$`));
      await expect.poll(() => drawn(img)).toBe(true);
    }
    await expect(stops.nth(0).locator('.fp-time-flag img')).toHaveAttribute('alt', 'Bandera de Brasil: Imperio del Brasil (1822–1889)');
    await expect(stops.nth(5).locator('.fp-time-flag img')).toHaveAttribute('src', /flags\/br\.svg$/);
    await expect(stops.nth(5)).toHaveClass(/fp-now/);
    await expect(times.locator('li.fp-now')).toHaveCount(1);

    // Two of them with a painting of the day: the independence and the republic, both long in the public domain.
    const pictures = times.locator('.fp-time-pic');
    await expect(pictures).toHaveCount(2);
    for (const [i, at] of [0, 1].entries()) {
      const said = SHEET.times[at].picture!;
      const img = pictures.nth(i).locator('img');
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => drawn(img)).toBe(true);
      await expect(pictures.nth(i).locator('figcaption')).toContainText(said.es);
      await expect(pictures.nth(i).locator('.fp-credit')).toContainText(`${said.by} · Dominio público · Wikimedia Commons`);
      await expect(pictures.nth(i).getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(said.title));
    }
    await expect(stops.nth(0).locator('.fp-time-pic')).toHaveCount(1);
    await expect(stops.nth(2).locator('.fp-time-pic')).toHaveCount(0);
  });

  test('shows photographs of the country, each with what is seen, who took it and on what terms', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page);
    const photos = sheet.locator('.fp-photos');
    await expect(photos.getByRole('heading', { level: 3 })).toHaveText('Brasil en imágenes');
    const figures = photos.locator('.fp-masonry figure');
    const said = SHEET.photos.slice(1);
    expect(said.length).toBeGreaterThanOrEqual(6);
    await expect(figures).toHaveCount(said.length);
    for (const [i, photo] of said.entries()) {
      const figure = figures.nth(i);
      const img = figure.locator('img');
      // Asked for when it comes into sight, and from the site itself: nothing is fetched from Commons.
      await expect(img).toHaveAttribute('loading', 'lazy');
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => drawn(img), photo.title).toBe(true);
      expect(await img.evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(new RegExp(`/photos/${photo.file}-(${photo.sizes.join('|')})\\.webp$`));
      await expect(figure.locator('figcaption')).toContainText(photo.es);
      await expect(figure.locator('.fp-credit')).toContainText(`${photo.by} · ${photo.licence} · Wikimedia Commons`);
      await expect(figure.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(photo.title));
      await expect(figure.getByRole('link', { name: photo.licence })).toHaveAttribute('href', photo.licenceUrl!);
    }
    // In the shape each has: the tall one of the dunes is taller than it is wide, the others are not.
    const shapes = await figures.locator('img').evaluateAll((imgs) => imgs.map((img) => img.getBoundingClientRect().width / img.getBoundingClientRect().height));
    expect(shapes.filter((ratio) => ratio < 1)).toHaveLength(1);
    // Two abreast.
    const lefts = await figures.evaluateAll((list) => list.map((figure) => Math.round(figure.getBoundingClientRect().left)));
    expect(new Set(lefts).size).toBe(2);

    // Under it all, where the figures, the text and the photographs come from, and where to read more or say that something is wrong.
    const foot = sheet.locator('.fp-foot');
    await expect(foot).toContainText('The World Factbook');
    await expect(foot).toContainText('Las fotografías son de Wikimedia Commons, reducidas de tamaño');
    await expect(foot.getByRole('link', { name: 'Leer más sobre Brasil en Wikipedia' })).toHaveAttribute('href', 'https://es.wikipedia.org/wiki/Brasil');
    const report = (await foot.getByRole('link', { name: 'Avisar de un error en esta ficha' }).getAttribute('href'))!;
    expect(report).toContain('/issues/new?');
    expect(new URL(report).searchParams.get('title')).toBe('Error en los datos: Brasil (BR)');
    expect(new URL(report).searchParams.get('body')).toContain('ficha del país');
  });

  test('leads to the flags of its states and of its cities, and to the games with them', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page);
    const own = sheet.locator('.fp-own');
    await expect(own.getByRole('heading', { level: 3 })).toHaveText('Las banderas de Brasil');
    const states = FLAGS.regions.BR.length;
    const towns = FLAGS.capitals.filter((row) => row[1] === 'BR').length + FLAGS.cities.BR.length;
    expect([states, towns]).toEqual([27, 64]);
    await expect(own.locator('.label')).toHaveText('Las de sus 27 estados');
    await expect(own.locator('.fp-strip li')).toHaveCount(states);
    await expect(own.locator('.fp-strip li').first()).toHaveAttribute('title', 'Acre');
    await expect(own.locator('.fp-links a')).toHaveText(['Ver las de sus estados', `Ver las de ${towns} ciudades`, 'Jugar con las de sus estados']);
    await expect(own.getByRole('link', { name: `Ver las de ${towns} ciudades` })).toHaveAttribute('href', '#/banderas/ciudades/BR');
    await expect(own.getByRole('link', { name: 'Jugar con las de sus estados' })).toHaveAttribute('href', '#/banderas/juegos/regiones-BR');

    // A link leaves the sheet for that page of the section, read from its top.
    await own.getByRole('link', { name: 'Ver las de sus estados' }).click();
    await expect(page).toHaveURL(/#\/banderas\/regiones\/BR$/);
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('.fg-pick select')).toHaveValue('BR');
    await expect(page.locator('.fg-tile')).toHaveCount(states);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);

    await openSheet(page);
    await sheet.getByRole('link', { name: 'Jugar con las de sus estados' }).click();
    await expect(page).toHaveURL(/#\/banderas\/juegos\/regiones-BR$/);
    await expect(sheet).toHaveCount(0);
    await expect(page.locator('.fgm-set-name')).toContainText('Regiones de Brasil');
  });

  test('closes with Escape, with its button and by going back, and leaves the gallery where it was', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/paises');
    const tile = page.locator('.fg-tile').filter({ hasText: /^Brasil$/ });
    await tile.scrollIntoViewIfNeeded();
    const at = await page.evaluate(() => window.scrollY);
    expect(at).toBeGreaterThan(500);
    const sheet = sheetOf(page);

    await tile.click();
    await expect(sheet.locator('article.fp')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    // Where it was, with the keyboard on the flag the sheet was opened from.
    expect(await page.evaluate(() => window.scrollY)).toBe(at);
    await expect(tile).toBeFocused();

    await tile.click();
    await expect(sheet.locator('article.fp')).toBeVisible();
    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    expect(await page.evaluate(() => window.scrollY)).toBe(at);

    // Going back closes it: the sheet is one step of the way, and the gallery the one before.
    await tile.click();
    await expect(sheet.locator('article.fp')).toBeVisible();
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    expect(await page.evaluate(() => window.scrollY)).toBe(at);
    // …and closing it left nothing behind to go back to: one more step back leaves the gallery.
    await page.goForward();
    await expect(sheet.locator('article.fp')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    await expect(page.locator('.fg-tile')).toHaveCount(249);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('opens by its address, and only what is a country with a flag has one', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/BR');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Brasil');
    await expect(page.getByRole('radio', { name: /^Países/, includeHidden: true })).toHaveAttribute('aria-checked', 'true');
    // Closed, the address is that of the page of the gallery it is over.
    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    await expect(page.locator('.fg-tile')).toHaveCount(249);

    // In the words of the other language, and with the code written small.
    await openSheet(page, '/banderas/countries/br');
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);

    // What the game draws that has no flag (a glacier nobody owns), and what is no country: the address is the gallery.
    expect(COUNTRIES.filter((country) => !country.fl).map((country) => country.id)).toEqual(['X1', 'X2']);
    for (const none of ['X1', 'ZZ', 'brasil']) {
      await open(page, `/banderas/paises/${none}`);
      await expect(page.locator('.fg-tile')).toHaveCount(249);
      await expect(page.locator('dialog')).toHaveCount(0);
    }

    // The flags of Brazil on the other pages are flags like any other: its states, and the ones it flew before.
    await open(page, '/banderas/regiones/BR');
    await page.locator('.fg-tile').filter({ hasText: /^Bahía$|^Bahia$/ }).click();
    await expect(page.locator('dialog.fg-dlg')).toBeVisible();
    await expect(sheet).toHaveCount(0);
  });

  test('is found by looking for the country by its name', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/paises');
    await page.getByRole('searchbox', { name: 'Buscar una bandera por su nombre' }).fill('brasil');
    await expect(page.locator('.fg-tile')).toHaveText(['Brasil']);
    await page.locator('.fg-tile').click();
    await expect(sheetOf(page).locator('.fp-official')).toHaveText('República Federativa de Brasil');
    await page.keyboard.press('Escape');
    // What was typed is still there, and so is the flag it found.
    await expect(page.getByRole('searchbox', { name: 'Buscar una bandera por su nombre' })).toHaveValue('brasil');
    await expect(page.locator('.fg-tile')).toHaveText(['Brasil']);
  });

  test('is in English where the game is', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, '/banderas/paises');
    await page.locator('.fg-tile').filter({ hasText: /^Brazil$/ }).click();
    const sheet = sheetOf(page);
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Brazil');
    await expect(sheet.locator('.fp-id .kicker')).toHaveText('South America');
    await expect(sheet.locator('.fp-official')).toHaveText('Federative Republic of Brazil');
    await expect(sheet.locator('.fp-flag')).toHaveAttribute('alt', 'Flag of Brazil');
    await expect(sheet.locator('.fp-about p')).toHaveText(SHEET.about.en);
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['At a glance', 'The flag', 'Its flags through time', 'Brazil in pictures', 'The flags of Brazil']);
    await expect(sheet.locator('.fp-glance .fp-facts dd').nth(1)).toHaveText(/^213 million people\s+2025 · 7th in the world$/);
    await expect(sheet.locator('.fp-glance .fp-facts dd').nth(2)).toHaveText(/^8\.51 million km²\s+5th in the world$/);
    await expect(sheet.locator('.fp-glance .label')).toHaveText('Borders 10 countries and territories');
    await expect(sheet.locator('.fp-glance .fp-facts dt').last()).toHaveText('Anthem');
    await expect(sheet.locator('.fp-glance .fp-facts dd').last()).toHaveText('Brazilian National Anthem');
    await expect(sheet.locator('.fp-glance .fp-facts dd').nth(-2)).toHaveText(/^«Ordem e Progresso»\s+\(Order and Progress\)$/);
    await expect(sheet.locator('.fp-flag-facts dd').first()).toHaveText('19 November 1889');
    await expect(sheet.locator('.fp-parts dt')).toHaveText(SHEET.flag.parts.map((part) => part.en[0]));
    await expect(sheet.locator('.fp-when')).toHaveText(['1822–1889', '15–19 November 1889', '1889–1960', '1960–1968', '1968–1992', 'Since 1992']);
    await expect(sheet.locator('.fp-times h4').first()).toHaveText('Empire of Brazil');
    await expect(sheet.locator('.fp-time-pic .fp-credit').first()).toContainText('Public domain');
    await expect(sheet.locator('.fp-hero figcaption')).toContainText(SHEET.photos[0].en);
    await expect(sheet.locator('.fp-masonry figcaption').first()).toContainText(SHEET.photos[1].en);
    await expect(sheet.locator('.fp-own .label')).toHaveText('Those of its 27 states');
    await expect(sheet.locator('.fp-links a')).toHaveText(['See those of its states', 'See those of 64 cities', 'Play with those of its states']);
    await expect(sheet.locator('.fp-foot').getByRole('link', { name: 'Read more about Brazil on Wikipedia' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Brazil');
    await expect(sheet.getByRole('button', { name: 'Close' })).toBeVisible();
    // Nothing of it is left in the other language.
    await expect(sheet.locator('article.fp')).not.toContainText(/Capital\s*Brasilia\b|habitantes|Limita con|Desde 1992|Dominio público/);
  });

  test('says so when what is written of the country does not come, and tries again', async ({ page }) => {
    await seed(page);
    let fail = true;
    await page.route('**/data/profiles/BR.json', (route) => (fail ? route.abort() : route.continue()));
    await open(page, '/banderas/paises/BR');
    const sheet = sheetOf(page);
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Brasil');
    await expect(sheet.getByRole('alert')).toContainText('No se ha podido cargar la ficha de Brasil.');
    await expect(sheet.locator('article.fp')).toHaveCount(0);
    fail = false;
    await sheet.getByRole('button', { name: 'Reintentar' }).click();
    await expect(sheet.locator('.fp-official')).toHaveText('República Federativa de Brasil');
    await expect(sheet.getByRole('alert')).toHaveCount(0);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('is shown without what it can do without when that does not come: the figures, the facts, the flags, the map', async ({ page }) => {
    await seed(page);
    for (const file of ['figures.json', 'facts.json', 'flags.json', 'world.json']) await page.route(`**/data/${file}`, (route) => route.abort());
    await open(page, '/banderas/paises/BR');
    const sheet = sheetOf(page);
    await expect(sheet.locator('.fp-official')).toHaveText('República Federativa de Brasil');
    // What the first page of the game already knows of the country is there; the rest is left out, and nothing breaks.
    await expect(sheet.locator('.fp-glance .fp-facts dt')).toHaveText(['Capital', 'Población', 'Superficie', 'Lema', 'Himno']);
    await expect(sheet.locator('.fp-where')).toHaveCount(0);
    await expect(sheet.locator('.fp-nb li')).toHaveCount(10);
    await expect(sheet.locator('.fp-parts dt')).toHaveCount(SHEET.flag.parts.length);
    // Its times are told, without the flags that did not come.
    await expect(sheet.locator('.fp-times ol > li')).toHaveCount(6);
    await expect(sheet.locator('.fp-time-flag img')).toHaveCount(0);
    await expect(sheet.locator('.fp-masonry figure')).toHaveCount(SHEET.photos.length - 1);
    await expect(sheet.locator('.fp-own')).toHaveCount(0);
    await expect(sheet.locator('.fp-foot')).toBeVisible();
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('stores none of its photographs beforehand: each is for whoever opens the sheet', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/paises');
    const kept = await page.evaluate(async () => {
      const [offline, worker] = await Promise.all([fetch('./offline.json').then((r) => r.json() as Promise<{ files: string[] }>), fetch('./sw.js').then((r) => r.text())]);
      return { pack: offline.files, shell: /const SHELL = (\[.*?\]);/s.exec(worker)?.[1] ?? '', rule: worker.includes("path.startsWith('photos/')") };
    });
    // What is written of the country is part of what «download everything» fetches; its photographs are not, nor are they stored with the game.
    expect(kept.pack).toContain('data/profiles/BR.json');
    expect(kept.pack.filter((file) => file.startsWith('photos/'))).toEqual([]);
    expect(kept.shell.length).toBeGreaterThan(100);
    expect(kept.shell).not.toContain('photos/');
    // …and the worker keeps each one once it has been shown.
    expect(kept.rule).toBe(true);
    // The gallery has asked for none of them.
    const asked: string[] = [];
    page.on('request', (request) => asked.push(request.url()));
    await page.reload();
    await expect(page.locator('.fg-tile')).toHaveCount(249);
    expect(asked.filter((url) => /\/photos\/|data\/profiles\//.test(url))).toEqual([]);
  });

  test('fills a phone, in one column, with nothing wider than the screen @movil', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/paises');
    await page.locator('.fg-tile').filter({ hasText: /^Brasil$/ }).click();
    const sheet = sheetOf(page);
    await expect(sheet.locator('article.fp')).toBeVisible();
    const screen = page.viewportSize()!;
    const box = (await sheet.boundingBox())!;
    expect([Math.round(box.x), Math.round(box.width)]).toEqual([0, screen.width]);
    expect(Math.round(box.height)).toBeGreaterThanOrEqual(screen.height - 2);
    // The photograph at its head is as wide as the screen, and the flag stands over its foot.
    const hero = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(hero)).toBe(true);
    const photo = (await hero.boundingBox())!;
    expect(Math.round(photo.width)).toBe(screen.width);
    const flag = (await sheet.locator('.fp-flag').boundingBox())!;
    expect(flag.y).toBeLessThan(photo.y + photo.height);
    expect(flag.y + flag.height).toBeGreaterThan(photo.y + photo.height);
    // Nothing of the sheet is wider than it: it is read down, never across.
    const scroller = sheet.locator('.dlg-box');
    expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    expect(await scroller.evaluate((el) => el.scrollHeight > el.clientHeight * 3)).toBe(true);
    const wide = await sheet.locator('article.fp *').evaluateAll((all, width) => all.filter((el) => el.getBoundingClientRect().right > width + 0.5).map((el) => el.className || el.tagName), screen.width);
    expect(wide).toEqual([]);
    // The figures two abreast; the parts of the flag and the photographs, one under another.
    const facts = await sheet.locator('.fp-glance .fp-facts > div').evaluateAll((rows) => rows.slice(0, 4).map((row) => Math.round(row.getBoundingClientRect().left)));
    expect(new Set(facts).size).toBe(2);
    for (const list of ['.fp-parts > div', '.fp-masonry figure']) {
      const lefts = await sheet.locator(list).evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
      expect(new Set(lefts).size, list).toBe(1);
    }
    // The painting of a time goes under what is said of it, beside the line of the years.
    const time = sheet.locator('.fp-times li.fp-with-pic').first();
    const [text, picture] = [(await time.locator('.fp-time-text').boundingBox())!, (await time.locator('.fp-time-pic').boundingBox())!];
    expect(picture.y).toBeGreaterThanOrEqual(text.y + text.height);
    expect(Math.round(picture.x)).toBe(Math.round(text.x));
    // It closes with its button, which stays in sight however far down one has read.
    await scroller.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect(sheet.locator('.fp-foot')).toBeInViewport();
    const close = sheet.getByRole('button', { name: 'Cerrar' });
    await expect(close).toBeInViewport();
    await close.click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
  });
});

test.describe('the sheet of a country nobody has written of yet', () => {
  /** A figure of the sheet, by its name. */
  const fact = (sheet: Locator, name: string): Locator => sheet.locator('.fp-facts > div').filter({ has: sheet.page().locator('dt', { hasText: new RegExp(`^${name}$`) }) }).locator('dd');
  const title = (sheet: Locator): Locator => sheet.getByRole('heading', { level: 2 });

  test('opens from its flag, with what Wikidata and Wikipedia say of it and the photograph chosen for it, or a band of its flag where one will be', async ({ page }) => {
    await seed(page);
    await open(page, '/banderas/paises');
    await page.locator('.fg-tile').filter({ hasText: /^España$/ }).click();
    const sheet = sheetOf(page);
    await expect(title(sheet)).toHaveText('España');
    await expect(page).toHaveURL(/#\/banderas\/paises\/ES$/);
    await expect(page.locator('dialog.fg-dlg')).toHaveCount(0);

    await expect(sheet.locator('.fp-id .kicker')).toHaveText('Europa del Sur');
    await expect(sheet.locator('.fp-official')).toHaveText('Reino de España');
    // What it calls itself is what was just said: it is not said twice.
    await expect(sheet.locator('.fp-local')).toHaveCount(0);
    await expect(sheet.locator('.fp-flag')).toHaveAttribute('alt', 'Bandera de España');

    // At its head, the photograph that was chosen for it: as wide as the sheet, twice as wide as tall, with what is seen in it and whose it is.
    const head = sheetFile('ES').photos![0];
    expect(sheetFile('ES').photos).toHaveLength(1);
    await expect(sheet.locator('.fp-band')).toHaveCount(0);
    const hero = sheet.locator('.fp-hero img');
    expect(head.sizes).toEqual([640, 1280]);
    await expect.poll(() => drawn(hero)).toBe(true);
    // Asked for at once, from the site itself, at one of the widths it is kept at.
    expect(await hero.getAttribute('loading')).toBeNull();
    expect(await hero.evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(new RegExp(`/photos/${head.file}-(640|1280)\\.webp$`));
    const [picture, flag, box] = [(await hero.boundingBox())!, (await sheet.locator('.fp-flag').boundingBox())!, (await sheet.locator('.dlg-box').boundingBox())!];
    expect(Math.round(picture.width)).toBe(Math.round(box.width));
    expect(picture.width / picture.height).toBeGreaterThan(1.9);
    expect(flag.y).toBeLessThan(picture.y + picture.height);
    expect(flag.y + flag.height).toBeGreaterThan(picture.y + picture.height);
    const caption = sheet.locator('.fp-hero figcaption');
    await expect(caption).toContainText('La Alhambra de Granada');
    await expect(caption).toContainText(head.es);
    await expect(caption.locator('.fp-credit')).toContainText(`${head.by} · ${head.licence} · Wikimedia Commons`);
    await expect(caption.locator('.fp-credit a').first()).toHaveAttribute('href', head.licenceUrl!);
    await expect(caption.locator('.fp-credit a').first()).toHaveAttribute('rel', /license/);
    await expect(caption.locator('.fp-credit a').last()).toHaveAttribute('href', commons(head.title));

    // Nothing is said that nobody wrote: no parts of the flag, no times, no photographs, and no text but Wikipedia's.
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['De un vistazo', 'La bandera', 'Sus banderas en el tiempo', 'Las banderas de España']);
    for (const none of ['.fp-about:not(.fp-lead)', '.fp-parts', '.fp-photos', '.fp-times', '.fp-flag-in > div > p']) await expect(sheet.locator(none), none).toHaveCount(0);

    // Its figures, as in every sheet; after them its motto, in its language and with what it means, and its anthem.
    await expect(fact(sheet, 'Capital')).toHaveText('Madrid');
    await expect(sheet.locator('.fp-glance .fp-facts dt').nth(-2)).toHaveText('Lema');
    await expect(fact(sheet, 'Lema')).toHaveText(/^«Plus ultra»\s+\(Más allá\)$/);
    await expect(fact(sheet, 'Lema').locator('span[lang]')).toHaveAttribute('lang', 'la');
    await expect(sheet.locator('.fp-glance .fp-facts dt').last()).toHaveText('Himno');
    await expect(fact(sheet, 'Himno')).toHaveText('Marcha Real');

    // Of its flag: when it was adopted and since when it is as it is, its proportions and its colours; and where to read of it.
    const flagSec = sheet.locator('.fp-flagsec');
    await expect(flagSec.locator('.fp-flag-big')).toHaveAttribute('src', /flags\/es\.svg$/);
    await expect(flagSec.locator('.fp-flag-facts dt')).toHaveText(['Adoptada', 'Como es hoy, desde', 'Proporción', 'Colores']);
    await expect(flagSec.locator('.fp-flag-facts dd')).toHaveText(['28 de mayo de 1785', '5 de octubre de 1981', /^2:3\s+de alto por ancho/, 'rojo, amarillo']);
    const more = flagSec.locator('.fp-from a').last();
    await expect(more).toHaveText('Seguir leyendo');
    await expect(more).toHaveAttribute('href', 'https://es.wikipedia.org/wiki/Bandera_de_Espa%C3%B1a');
    await expect(more).toHaveAttribute('target', '_blank');

    // Under it all, whose each thing is: its one photograph, and nothing of a text written for the game.
    const foot = sheet.locator('.fp-foot');
    await expect(foot).toContainText('The World Factbook');
    await expect(foot).toContainText('El nombre oficial, el lema, el himno y los datos de la bandera son los que dan Wikidata y Wikipedia.');
    await expect(foot).toContainText('El dibujo de la bandera es de la colección flag-icons.');
    await expect(foot).toContainText('El texto es el comienzo de los artículos de Wikipedia, abreviado, con licencia CC BY-SA 4.0.');
    await expect(foot).toContainText('La fotografía es de Wikimedia Commons, reducida de tamaño; bajo ella van su autor y su licencia.');
    await expect(foot).not.toContainText(/fotografías|escrito para el juego/);
    await expect(foot.getByRole('link', { name: 'Leer más sobre España en Wikipedia' })).toHaveAttribute('href', 'https://es.wikipedia.org/wiki/Espa%C3%B1a');
    const report = (await foot.getByRole('link', { name: 'Avisar de un error en esta ficha' }).getAttribute('href'))!;
    expect(new URL(report).searchParams.get('title')).toBe('Error en los datos: España (ES)');
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('tells how Wikipedia begins to tell of the country and of its flag, each with whose words they are and where they go on', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/ES');
    const told = sheetFile('ES');
    expect(told.lead!.es!.length).toBeGreaterThan(0);
    expect(told.flag!.lead!.es!.length).toBeGreaterThan(0);

    // Of the country, under its name and before its figures: the words of Wikipedia, as the sheet was given them.
    const about = sheet.locator('section.fp-about.fp-lead');
    await expect(about.locator('p:not(.fp-from)')).toHaveText(told.lead!.es!);
    await expect(about.locator('p:not(.fp-from)').first()).toHaveText(/^España, .* es un país /);
    const [text, glance] = [(await about.boundingBox())!, (await sheet.locator('.fp-glance').boundingBox())!];
    expect(text.y + text.height).toBeLessThanOrEqual(glance.y + 1);
    // Under them, whose they are, that they were shortened, on what terms they are given, and where they go on.
    const from = about.locator('.fp-from');
    await expect(from).toHaveText(/^De Wikipedia, abreviado · CC BY-SA 4\.0 · Seguir leyendo$/);
    await expect(from.locator('a')).toHaveCount(2);
    await expect(from.locator('a').first()).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/deed.es');
    await expect(from.locator('a').first()).toHaveAttribute('rel', /license/);
    await expect(from.locator('a').last()).toHaveAttribute('href', told.read!.es!);
    await expect(from.locator('a').last()).toHaveAttribute('target', '_blank');
    await expect(from.locator('a').last()).toHaveAttribute('rel', /noopener/);
    // Heard apart from the text, as in a list of links, each of the two says where it leads and what of.
    await expect(about.getByRole('link', { name: 'Seguir leyendo sobre España en Wikipedia', exact: true })).toHaveAttribute('href', told.read!.es!);
    await expect(sheet.locator('.fp-flagsec').getByRole('link', { name: 'Seguir leyendo sobre la bandera de España en Wikipedia', exact: true })).toHaveAttribute('href', told.readFlag!.es!);

    // Of the flag, beside it and before what is known of it: the same, from its own page.
    const flagSec = sheet.locator('.fp-flagsec');
    await expect(flagSec.locator('.fp-lead p:not(.fp-from)')).toHaveText(told.flag!.lead!.es!);
    await expect(flagSec.locator('.fp-lead p:not(.fp-from)').first()).toHaveText(/^La bandera de España /);
    await expect(flagSec.locator('.fp-from')).toHaveText(/^De Wikipedia, abreviado · CC BY-SA 4\.0 · Seguir leyendo$/);
    await expect(flagSec.locator('.fp-from a').last()).toHaveAttribute('href', told.readFlag!.es!);
    const [words, facts] = [(await flagSec.locator('.fp-lead').boundingBox())!, (await flagSec.locator('.fp-flag-facts').boundingBox())!];
    expect(words.y + words.height).toBeLessThanOrEqual(facts.y + 1);
    // Where to read of the flag is said once: by the text that comes from there.
    await expect(flagSec.locator('.fp-more')).toHaveCount(0);
    // Nothing of what plain text leaves behind is on screen.
    await expect(sheet.locator('.fp-lead').first()).not.toContainText(/\[\d+\]|\(\s*\)|\u200b/);

    // A sheet somebody wrote tells what was written, and nothing of Wikipedia's.
    await openSheet(page, '/banderas/paises/BR');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Brasil');
    await expect(sheet.locator('.fp-about p')).toHaveText(SHEET.about.es);
    await expect(sheet.locator('.fp-lead, .fp-from')).toHaveCount(0);
    await expect(sheet.locator('.fp-foot')).toContainText('El texto está escrito para el juego');
    await expect(sheet.locator('.fp-foot')).not.toContainText('comienzo de los artículos');

    // A flag whose page begins with another flag tells nothing of it, and says where to read of it instead.
    await openSheet(page, '/banderas/paises/AQ');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Antártida');
    expect(sheetFile('AQ').flag?.lead?.es).toBeUndefined();
    await expect(sheet.locator('section.fp-about.fp-lead p:not(.fp-from)')).toHaveText(sheetFile('AQ').lead!.es!);
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveText('Leer sobre la bandera de Antártida en Wikipedia');
    await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveAttribute('href', 'https://es.wikipedia.org/wiki/Bandera_de_la_Ant%C3%A1rtida');
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('shows the flags the game has of its past, each with its years, and the one of today last', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/ES');
    const flown = sheet.locator('.fp-flown');
    await expect(flown.getByRole('heading', { level: 3 })).toHaveText('Sus banderas en el tiempo');
    const stops = flown.locator('ol > li');
    expect(FLAGS.past.ES).toHaveLength(7);
    await expect(stops).toHaveCount(8);
    // The oldest first.
    await expect(flown.locator('.fp-when')).toHaveText(['1701–1760', '1760–1843', '1843–1931', '1931–1939', '1939–1945', '1945–1977', '1977–1981', 'Hoy']);
    const first = stops.first().locator('img');
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute('src', /flags\/commons\//);
    await expect(first).toHaveAttribute('alt', 'Bandera de España (1701–1760)');
    await expect.poll(() => drawn(first)).toBe(true);
    await expect(flown.locator('li.fp-now')).toHaveCount(1);
    await expect(stops.last()).toHaveClass(/fp-now/);
    await expect(stops.last().locator('img')).toHaveAttribute('src', /flags\/es\.svg$/);
    await expect(stops.last().locator('img')).toHaveAttribute('alt', 'Bandera de España, hoy');
    // And says where they come from, and that they may not be all.
    await expect(flown.locator('.fp-note')).toHaveText('Son las banderas anteriores que recoge Wikidata, con los años en que ondeó cada una; puede faltar alguna.');

    // Its own flags: of how many of its provinces the game has one, and those of its cities.
    const own = sheet.locator('.fp-own');
    const provinces = (FLAGS.regions.ES as [string, number][]).filter((row) => row[1] === 0).length;
    const all = COUNTRIES.find((country) => country.id === 'ES')!.lv.find((level) => level.k === 'f')!.n;
    expect([provinces, all]).toEqual([43, 52]);
    await expect(own.locator('.label')).toHaveText('Las de 43 de sus 52 provincias');
    await expect(own.locator('.fp-strip li')).toHaveCount(provinces);
    const towns = FLAGS.capitals.filter((row) => row[1] === 'ES').length + FLAGS.cities.ES.length;
    await expect(own.locator('.fp-links a')).toHaveText(['Ver las de sus provincias', `Ver las de ${towns} ciudades`, 'Jugar con las de sus provincias']);

    // A country the game has no earlier flag of tells nothing of them; one with a single town with a flag names what it is.
    expect(FLAGS.past.GI ?? []).toHaveLength(0);
    await openSheet(page, '/banderas/paises/GI');
    await expect(title(sheet)).toHaveText('Gibraltar');
    await expect(sheet.locator('.fp-flown, .fp-times')).toHaveCount(0);
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['De un vistazo', 'La bandera', 'Las banderas de Gibraltar']);
    await expect(sheet.locator('.fp-own .fp-links a')).toHaveText(['Ver la de su capital']);
    await expect(sheet.locator('.fp-glance .label')).toHaveText('Limita con un país');
  });

  test('leads to the sheets of its neighbours, back one at a time, and closes them all at once onto the gallery', async ({ page }) => {
    await seed(page);
    // From another screen, to see what going back from the gallery leaves.
    await open(page, '/acerca');
    await page.evaluate(() => {
      window.location.hash = '#/banderas/paises';
    });
    await expect(page.locator('.fg-tile')).toHaveCount(249);
    const tile = page.locator('.fg-tile').filter({ hasText: /^España$/ });
    await tile.scrollIntoViewIfNeeded();
    const at = await page.evaluate(() => window.scrollY);
    await tile.click();
    const sheet = sheetOf(page);
    const scroller = sheet.locator('.dlg-box');
    await expect(title(sheet)).toHaveText('España');
    const neighbours = sheet.locator('.fp-nb li a');
    await expect(sheet.locator('.fp-glance .label')).toHaveText('Limita con 5 países y territorios');
    await expect(neighbours).toHaveText(['Andorra', 'Francia', 'Gibraltar', 'Marruecos', 'Portugal']);
    await expect(neighbours.last()).toHaveAttribute('href', '#/banderas/paises/PT');
    await expect(neighbours.last().locator('img')).toHaveAttribute('src', /flags\/pt\.svg$/);

    // One opens over the other, in the same panel: read from its top, with the keyboard on its name.
    await scroller.evaluate((el) => el.scrollTo(0, 300));
    await neighbours.last().click();
    await expect(title(sheet)).toHaveText('Portugal');
    await expect(page).toHaveURL(/#\/banderas\/paises\/PT$/);
    await expect(sheet.locator('.fp-official')).toHaveText('República Portuguesa');
    await expect(page.locator('dialog')).toHaveCount(1);
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
    await expect(title(sheet)).toBeFocused();
    // Nothing of the sheet before is left in it.
    await expect(sheet.locator('article.fp')).not.toContainText(/Marcha Real|Plus ultra|Madrid/);
    await expect(sheet.locator('.fp-glance .label')).toHaveText('Limita con un país');
    await expect(neighbours).toHaveText(['España']);

    // And on: back to Spain, from there to France.
    await neighbours.click();
    await expect(title(sheet)).toHaveText('España');
    await neighbours.filter({ hasText: /^Francia$/ }).click();
    await expect(title(sheet)).toHaveText('Francia');
    await expect(sheet.locator('.fp-official')).toHaveText('República Francesa');
    await expect(sheet.locator('.fp-local')).toHaveText('République française');
    await expect(page).toHaveURL(/#\/banderas\/paises\/FR$/);

    // Going back undoes one step at a time, and forth does it again.
    await page.goBack();
    await expect(title(sheet)).toHaveText('España');
    await expect(page).toHaveURL(/#\/banderas\/paises\/ES$/);
    await page.goBack();
    await expect(title(sheet)).toHaveText('Portugal');
    await page.goForward();
    await page.goForward();
    await expect(title(sheet)).toHaveText('Francia');
    await expect(sheet.locator('.fp-official')).toHaveText('República Francesa');

    // Closing leaves the gallery, where it was, however many sheets were opened…
    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    await expect(page.locator('.fg-tile')).toHaveCount(249);
    expect(await page.evaluate(() => window.scrollY)).toBe(at);
    // …and nothing behind it to go back to: one more step back leaves the gallery for where one came from.
    await page.goBack();
    await expect(page).toHaveURL(/#\/acerca$/);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('opened by its address, has the gallery put under it once another is opened from it', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/ES');
    await sheet.locator('.fp-nb li a').filter({ hasText: /^Portugal$/ }).click();
    await expect(title(sheet)).toHaveText('Portugal');
    // Back is the sheet that was opened first, still over the gallery.
    await page.goBack();
    await expect(title(sheet)).toHaveText('España');
    await expect(page).toHaveURL(/#\/banderas\/paises\/ES$/);
    await page.goForward();
    await expect(title(sheet)).toHaveText('Portugal');
    // Closed from the second, it is the gallery that is left, and not the first sheet.
    await page.keyboard.press('Escape');
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    await expect(page.locator('.fg-tile')).toHaveCount(249);

    // And step by step: two back from the second sheet is the gallery too.
    await openSheet(page, '/banderas/paises/PT');
    await sheet.locator('.fp-nb li a').click();
    await expect(title(sheet)).toHaveText('España');
    await page.goBack();
    await expect(title(sheet)).toHaveText('Portugal');
    await page.goBack();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('leaves a link to another sheet to the browser when it is asked to open it somewhere else', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/ES');
    const link = sheet.locator('.fp-nb li a').filter({ hasText: /^Portugal$/ });
    // It is a link with an address, so the browser can open it in another tab or copy it.
    await expect(link).toHaveAttribute('href', '#/banderas/paises/PT');
    // Whether the game took each click for itself, seen after it has had its say. The browser is then kept
    // from opening anything: what it does with a link is its own business, and not what is looked at here.
    await page.evaluate(() => {
      const taken: boolean[] = [];
      (window as unknown as { taken: boolean[] }).taken = taken;
      document.addEventListener('click', (event) => {
        taken.push(event.defaultPrevented);
        event.preventDefault();
      });
    });
    const taken = (): Promise<boolean[]> => page.evaluate(() => (window as unknown as { taken: boolean[] }).taken);
    await link.click({ modifiers: ['ControlOrMeta'] });
    await link.click({ modifiers: ['Shift'] });
    expect(await taken()).toEqual([false, false]);
    await expect(title(sheet)).toHaveText('España');
    await expect(page).toHaveURL(/#\/banderas\/paises\/ES$/);
    // A plain click is the game's: the sheet opens here.
    await link.click();
    await expect(title(sheet)).toHaveText('Portugal');
    expect(await taken()).toEqual([false, false, true]);
  });

  test('says of a territory whose it is, and of one that flies the flag of its country, whose flag that is', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/GI');
    // The country it depends on comes first, and leads to its sheet.
    await expect(sheet.locator('.fp-glance .fp-facts dt').first()).toHaveText('Depende de');
    const owner = sheet.locator('.fp-glance .fp-owner a');
    await expect(owner).toHaveText('Reino Unido');
    await expect(owner).toHaveAttribute('href', '#/banderas/paises/GB');
    await expect(owner.locator('img')).toHaveAttribute('src', /flags\/gb\.svg$/);
    // Its own anthem before the one it shares; a flag of its own, with nothing of whose it is.
    await expect(fact(sheet, 'Himno')).toHaveText('Himno de Gibraltar · God Save the King');
    await expect(sheet.locator('.fp-flag-facts dt')).toHaveText(['Adoptada', 'Proporción', 'Colores']);
    await owner.click();
    await expect(title(sheet)).toHaveText('Reino Unido');
    await expect(sheet.locator('.fp-official')).toHaveText('Reino Unido de Gran Bretaña e Irlanda del Norte');
    await expect(sheet.locator('.fp-local')).toHaveText('United Kingdom of Great Britain and Northern Ireland');
    await expect(sheet.locator('.fp-local')).toHaveAttribute('lang', 'en');
    await expect(sheet.locator('.fp-glance .fp-owner')).toHaveCount(0);

    // Réunion has no flag of its own: the one shown is that of France, and what is said of it is said of that one.
    await openSheet(page, '/banderas/paises/RE');
    await expect(title(sheet)).toHaveText('Reunión');
    await expect(sheet.locator('.fp-flag-big')).toHaveAttribute('src', /flags\/re\.svg$/);
    await expect(sheet.locator('.fp-glance .fp-owner a')).toHaveText('Francia');
    const flagFacts = sheet.locator('.fp-flag-facts');
    await expect(flagFacts.locator('dt')).toHaveText(['Es la de', 'Adoptada', 'Proporción', 'Colores', 'Diseño de']);
    await expect(flagFacts.locator('dd')).toHaveText(['Francia', '15 de febrero de 1794', /^2:3\s+de alto por ancho/, 'rojo, azul, blanco', 'Jacques-Louis David']);
    // What is told of it is how the page of the flag of France begins, and it is there that it goes on.
    await expect(sheet.locator('.fp-flagsec .fp-lead p:not(.fp-from)')).toHaveText(sheetFile('FR').flag!.lead!.es!);
    await expect(sheet.locator('.fp-flagsec .fp-lead p:not(.fp-from)').first()).toHaveText(/^La bandera de Francia /);
    const more = sheet.locator('.fp-flagsec .fp-from a').last();
    await expect(more).toHaveText('Seguir leyendo');
    await expect(more).toHaveAttribute('href', 'https://es.wikipedia.org/wiki/Bandera_de_Francia');
    await expect(more).toHaveAccessibleName('Seguir leyendo sobre la bandera de Francia en Wikipedia');
    // Of the territory, what its own page begins with.
    await expect(sheet.locator('section.fp-about.fp-lead p:not(.fp-from)').first()).toHaveText(/^Reunión /);
    // Of the territory itself, its own page.
    await expect(sheet.locator('.fp-foot').getByRole('link', { name: 'Leer más sobre Reunión en Wikipedia' })).toHaveAttribute('href', 'https://es.wikipedia.org/wiki/Reuni%C3%B3n_(Francia)');
    // Whose flag it is leads to the sheet of that country, which says the same of it.
    await flagFacts.locator('.fp-owner a').click();
    await expect(title(sheet)).toHaveText('Francia');
    await expect(flagFacts.locator('dt')).toHaveText(['Adoptada', 'Proporción', 'Colores', 'Diseño de']);
    await expect(flagFacts.locator('dd')).toHaveText(['15 de febrero de 1794', /^2:3\s+de alto por ancho/, 'rojo, azul, blanco', 'Jacques-Louis David']);
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('rings on the globe a country too small to be seen there, and no other', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/VA');
    const globe = sheet.locator('.fp-where svg');
    await expect(globe).toHaveAttribute('aria-label', 'Dónde está Ciudad del Vaticano en el mundo');
    await expect(globe.locator('.fp-ring')).toHaveCount(1);
    const [ring, all] = [(await globe.locator('.fp-ring').boundingBox())!, (await globe.boundingBox())!];
    // In Europe: in the upper half of a globe that is turned to it, and well inside it.
    expect(ring.x).toBeGreaterThan(all.x);
    expect(ring.x + ring.width).toBeLessThan(all.x + all.width);
    expect(ring.y).toBeGreaterThan(all.y);
    expect(ring.y + ring.height).toBeLessThan(all.y + all.height);
    expect(ring.width).toBeGreaterThan(12);
    await expect(sheet.locator('.fp-official')).toHaveText('Estado de la Ciudad del Vaticano');
    await expect(sheet.locator('.fp-local')).toHaveText('Stato della Città del Vaticano');
    await expect(sheet.locator('.fp-local')).toHaveAttribute('lang', 'it');
    // It has no motto: none is said.
    await expect(sheet.locator('.fp-glance .fp-facts dt').filter({ hasText: /^Lema$/ })).toHaveCount(0);
    await expect(fact(sheet, 'Himno')).toHaveText('Inno e Marcia Pontificale');

    // Italy, its only neighbour, is seen as it is.
    await sheet.locator('.fp-nb li a').click();
    await expect(title(sheet)).toHaveText('Italia');
    await expect(sheet.locator('.fp-where svg')).toHaveAttribute('aria-label', 'Dónde está Italia en el mundo');
    await expect(sheet.locator('.fp-where svg .fp-ring')).toHaveCount(0);
  });

  test('is in English where the game is', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await open(page, '/banderas/paises');
    await page.locator('.fg-tile').filter({ hasText: /^Spain$/ }).click();
    const sheet = sheetOf(page);
    await expect(title(sheet)).toHaveText('Spain');
    await expect(sheet.locator('.fp-official')).toHaveText('Kingdom of Spain');
    // What it calls itself is now another thing than what it is called here, and is said in its language.
    await expect(sheet.locator('.fp-local')).toHaveText('Reino de España');
    await expect(sheet.locator('.fp-local')).toHaveAttribute('lang', 'es');
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['At a glance', 'The flag', 'Its flags through time', 'The flags of Spain']);
    await expect(fact(sheet, 'Motto')).toHaveText(/^«Plus ultra»\s+\(Further Beyond\)$/);
    await expect(fact(sheet, 'Anthem')).toHaveText('Marcha Real');
    await expect(sheet.locator('.fp-glance .label')).toHaveText('Borders 5 countries and territories');
    await expect(sheet.locator('.fp-nb li a')).toHaveText(['Andorra', 'France', 'Gibraltar', 'Morocco', 'Portugal']);
    await expect(sheet.locator('.fp-flag-facts dt')).toHaveText(['Adopted', 'As it is today, since', 'Proportions', 'Colours']);
    await expect(sheet.locator('.fp-flag-facts dd')).toHaveText(['28 May 1785', '5 October 1981', /^2:3\s+height to width/, 'red, yellow']);
    // The words of Wikipedia are those of its page in English, and so is where they go on.
    await expect(sheet.locator('section.fp-about.fp-lead p:not(.fp-from)')).toHaveText(sheetFile('ES').lead!.en!);
    await expect(sheet.locator('section.fp-about.fp-lead p:not(.fp-from)').first()).toHaveText(/^Spain, officially the Kingdom of Spain, is a country /);
    await expect(sheet.locator('section.fp-about .fp-from')).toHaveText(/^From Wikipedia, abridged · CC BY-SA 4\.0 · Read on$/);
    await expect(sheet.locator('section.fp-about .fp-from a').first()).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0/');
    await expect(sheet.locator('section.fp-about .fp-from a').last()).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Spain');
    await expect(sheet.locator('.fp-flagsec .fp-lead p:not(.fp-from)')).toHaveText(sheetFile('ES').flag!.lead!.en!);
    await expect(sheet.locator('.fp-flagsec .fp-from a').last()).toHaveText('Read on');
    await expect(sheet.locator('.fp-flagsec .fp-from a').last()).toHaveAccessibleName('Read on about the flag of Spain on Wikipedia');
    await expect(sheet.locator('section.fp-about .fp-from a').last()).toHaveAccessibleName('Read on about Spain on Wikipedia');
    await expect(sheet.locator('.fp-flagsec .fp-from a').last()).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Flag_of_Spain');
    await expect(sheet.locator('.fp-foot')).toContainText('The text is the opening of the articles of Wikipedia, abridged, under the CC BY-SA 4.0 licence.');
    await expect(sheet.locator('.fp-flown .fp-when').last()).toHaveText('Today');
    await expect(sheet.locator('.fp-flown li img').first()).toHaveAttribute('alt', 'Flag of Spain (1701–1760)');
    await expect(sheet.locator('.fp-flown .fp-note')).toHaveText('These are the earlier flags that Wikidata records, with the years each was flown; some may be missing.');
    await expect(sheet.locator('.fp-own .label')).toHaveText('Those of 43 of its 52 provinces');
    await expect(sheet.locator('.fp-foot')).toContainText('The official name, the motto, the anthem and the facts of the flag are those that Wikidata and Wikipedia give.');
    await expect(sheet.locator('.fp-foot')).toContainText('The drawing of the flag is from the flag-icons collection.');
    await expect(sheet.locator('.fp-foot').getByRole('link', { name: 'Read more about Spain on Wikipedia' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Spain');

    // A territory, and one that flies the flag of its country.
    await openSheet(page, '/banderas/paises/RE');
    await expect(sheet.locator('.fp-glance .fp-facts dt').first()).toHaveText('Depends on');
    await expect(sheet.locator('.fp-flag-facts dt')).toHaveText(['It is that of', 'Adopted', 'Proportions', 'Colours', 'Designed by']);
    await expect(sheet.locator('.fp-flag-facts .fp-owner a')).toHaveText('France');
    await expect(sheet.locator('.fp-flagsec .fp-lead p:not(.fp-from)').first()).toHaveText(/^The national flag of France /);
    await expect(sheet.locator('.fp-flagsec .fp-from a').last()).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Flag_of_France');
    // Nothing of it is left in the other language.
    await expect(sheet.locator('article.fp')).not.toContainText(/Depende de|Adoptada|Es la de|Limita con|habitantes|Francia/);
  });

  test('is shown whatever the country is: one with no neighbours, no capital, no flag of its own or nothing said of it', async ({ page }) => {
    await seed(page);
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(String(error)));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    const sheet = sheetOf(page);
    // The largest and the smallest, the ones of many flags, the ones nobody rules, the ones others rule, the ones not all recognise.
    for (const id of ['US', 'RU', 'AQ', 'PS', 'EH', 'TW', 'XK', 'NC', 'SJ', 'BV', 'TF', 'NP', 'CH', 'KI', 'FJ', 'MC']) {
      const name = COUNTRIES.find((country) => country.id === id)!.n.es;
      await open(page, `/banderas/paises/${id}`);
      await expect(title(sheet), id).toHaveText(name);
      await expect(sheet.locator('article.fp'), id).toBeVisible();
      await expect(sheet.locator('.fp-id .fp-official').first(), id).not.toBeEmpty();
      await expect(sheet.getByRole('heading', { level: 3 }).first(), id).toHaveText('De un vistazo');
      await expect(sheet.locator('.fp-flag-big'), id).toHaveAttribute('src', new RegExp(`flags/${COUNTRIES.find((country) => country.id === id)!.fl}\\.svg$`));
      await expect(sheet.locator('.fp-foot'), id).toContainText('The World Factbook');
      await expect(page.locator('.crash'), id).toHaveCount(0);
    }
    expect(errors).toEqual([]);
    // The one with the most flags behind it shows them all, and the one of today.
    await open(page, '/banderas/paises/US');
    await expect(sheet.locator('.fp-flown ol > li')).toHaveCount(FLAGS.past.US.length + 1);
    await expect(sheet.locator('.fp-flag-facts dd').first()).toHaveText('14 de junio de 1777');
    // A land with no flag of its own and nobody who lives there says whose it is, and little else.
    await open(page, '/banderas/paises/BV');
    await expect(sheet.locator('.fp-official')).toHaveText('Isla Bouvet');
    await expect(sheet.locator('.fp-glance .fp-owner a')).toHaveText('Noruega');
    await expect(sheet.locator('.fp-flag-facts .fp-owner a')).toHaveText('Noruega');
    await expect(sheet.locator('.fp-nb')).toHaveCount(0);
    // One for which no photograph has been chosen yet: where it will be, the colours of its flag, and the flag standing over their foot.
    await open(page, `/banderas/paises/${BARE.id}`);
    await expect(title(sheet)).toHaveText(BARE.n.es);
    await expect(sheet.locator('.fp-hero')).toHaveCount(0);
    const band = sheet.locator('.fp-band');
    await expect(band).toHaveAttribute('aria-hidden', 'true');
    await expect(band.locator('img')).toHaveAttribute('src', new RegExp(`flags/${BARE.fl}\\.svg#svgView\\(preserveAspectRatio\\(none\\)\\)$`));
    await expect.poll(() => drawn(band.locator('img'))).toBe(true);
    const [strip, over, wide] = [(await band.boundingBox())!, (await sheet.locator('.fp-flag').boundingBox())!, (await sheet.locator('.dlg-box').boundingBox())!];
    expect(Math.round(strip.width)).toBe(Math.round(wide.width));
    expect(over.y).toBeLessThan(strip.y + strip.height);
    expect(over.y + over.height).toBeGreaterThan(strip.y + strip.height);
    await expect(sheet.locator('.fp-foot')).not.toContainText(/fotografía/);

    // And one with no flag that is official says so.
    await open(page, '/banderas/paises/AQ');
    await expect(sheet.locator('.fp-flag-facts dt')).toHaveText(['Colores', 'Diseño de']);
    await expect(sheet.locator('.fp-flag-facts dd').last()).toContainText('la Antártida no tiene bandera oficial');
  });

  test('fills a phone with nothing wider than the screen, its photograph or the band of its flag from side to side @movil', async ({ page }) => {
    await seed(page);
    // One with no photograph yet: the band is as wide as the screen, and the flag stands over its foot.
    const sheet = await openSheet(page, `/banderas/paises/${BARE.id}`);
    const screen = page.viewportSize()!;
    const band = (await sheet.locator('.fp-band').boundingBox())!;
    expect([Math.round(band.x), Math.round(band.width)]).toEqual([0, screen.width]);
    const over = (await sheet.locator('.fp-flag').boundingBox())!;
    expect(over.y).toBeLessThan(band.y + band.height);
    expect(over.y + over.height).toBeGreaterThan(band.y + band.height);
    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expect(sheet).toHaveCount(0);

    await open(page, '/banderas/paises');
    await page.locator('.fg-tile').filter({ hasText: /^España$/ }).click();
    await expect(sheet.locator('article.fp')).toBeVisible();
    const box = (await sheet.boundingBox())!;
    expect([Math.round(box.x), Math.round(box.width)]).toEqual([0, screen.width]);
    // Its photograph is as wide as the screen and taller than on a wide one, and the flag stands over its foot.
    const hero = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(hero)).toBe(true);
    const picture = (await hero.boundingBox())!;
    expect([Math.round(picture.x), Math.round(picture.width)]).toEqual([0, screen.width]);
    expect(Math.round((picture.width / picture.height) * 10)).toBe(15);
    // On a screen this narrow, the lightest picture is the one that is asked for... or the next: never more than fills it.
    expect(await hero.evaluate((img: HTMLImageElement) => img.currentSrc)).toMatch(/-(640|1280)\.webp$/);
    const flag = (await sheet.locator('.fp-flag').boundingBox())!;
    expect(flag.y).toBeLessThan(picture.y + picture.height);
    expect(flag.y + flag.height).toBeGreaterThan(picture.y + picture.height);
    // Nothing of the sheet is wider than it.
    const scroller = sheet.locator('.dlg-box');
    expect(await scroller.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    const wide = await sheet.locator('article.fp *').evaluateAll(
      (all, width) => all.filter((el) => !el.closest('.fp-band') && el.getBoundingClientRect().right > width + 0.5).map((el) => el.className || el.tagName),
      screen.width,
    );
    expect(wide).toEqual([]);
    // The figures two abreast; the flags of other times, several in a row; the neighbours, as many as fit.
    const facts = await sheet.locator('.fp-glance .fp-facts > div').evaluateAll((rows) => rows.slice(0, 4).map((row) => Math.round(row.getBoundingClientRect().left)));
    expect(new Set(facts).size).toBe(2);
    const flown = await sheet.locator('.fp-flown ol > li').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
    expect(new Set(flown).size).toBeGreaterThanOrEqual(2);
    const pills = await sheet.locator('.fp-nb li').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().top)));
    expect(new Set(pills).size).toBeGreaterThanOrEqual(2);
    // A neighbour is large enough to be touched, and opens its sheet.
    const neighbour = sheet.locator('.fp-nb li a').last();
    expect((await neighbour.boundingBox())!.height).toBeGreaterThanOrEqual(28);
    await neighbour.click();
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Portugal');
    expect(await scroller.evaluate((el) => el.scrollTop)).toBe(0);
    // It closes onto the gallery from there.
    await sheet.getByRole('button', { name: 'Cerrar' }).click();
    await expect(sheet).toHaveCount(0);
    await expect(page).toHaveURL(/#\/banderas\/paises$/);
  });
});
