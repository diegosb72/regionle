import fs from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { open, seed } from './helpers';

/**
 * The sheet of a country, which the gallery of flags opens when the flag of a country is touched
 * (screens/FlagProfile.tsx). Every country with a flag has one: with what the game knows of it and what
 * Wikidata and Wikipedia say of it and of its flag, with how Wikipedia begins to tell of both and
 * a photograph at its head; some have a historical timeline, five polar territories have sourced accounts
 * instead of Wikipedia excerpts, selected African countries have additional photos, and Brazil has a
 * complete handwritten sheet. One sheet leads to another.
 */

interface Photo {
  file: string;
  sizes: number[];
  title: string;
  by?: string;
  byUrl?: string;
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
/** The coat of arms of a sheet: its picture, how large it is, and whose the drawing is. */
type Arms = { file: string; w: number; h: number; title: string; by?: string; licence: string; licenceUrl?: string; kind?: 'emblem' | 'seal' };
const sheetFile = (id: string) =>
  JSON.parse(fs.readFileSync(`public/data/profiles/${id}.json`, 'utf8')) as {
    lead?: Lead;
    about?: { es: string[]; en: string[] };
    sources?: { about?: { title: { es: string; en: string }; url: string }[]; flag?: { title: { es: string; en: string }; url: string }[] };
    flag?: { lead?: Lead; text?: { es: string[]; en: string[] }; parts?: { es: [string, string]; en: [string, string] }[]; of?: string; adopted?: string };
    read?: { es?: string; en?: string };
    readFlag?: { es?: string; en?: string };
    photos?: (Photo & { focus?: [number, number] })[];
    times?: { past?: [number, number]; pastFile?: string; gone?: string; now?: true; from: number; to?: number; when?: { es: string; en: string }; name: { es: string; en: string }; text: { es: string; en: string }; picture?: Photo }[];
    timeNote?: { es: string; en: string };
    timeSource?: string;
    arms?: Arms;
  };
/** The countries as the game has them: what each is called, and how its finest divisions are. */
const COUNTRIES = (JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: { id: string; n: { es: string; en?: string }; fl?: string; lv: { k: string; n: number }[] }[] }).countries;
const commons = (title: string): string => `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(title.replace(/ /g, '_'))}`;
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

  test('keeps Andorra’s chosen head and shows the reviewed release WebPs with captions and Commons credits', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/AD');
    const country = sheetFile('AD');
    const hero = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(hero)).toBe(true);
    expect(await hero.evaluate((el) => (el as HTMLImageElement).currentSrc)).toContain(`/photos/${country.photos![0].file}-`);
    const figures = sheet.locator('.fp-photos .fp-masonry figure');
    await expect(figures).toHaveCount(country.photos!.length - 1);
    const photo = country.photos![1];
    expect(photo.title).toBe('Building in Ordino. Andorra 216.jpg');
    expect(photo.sizes).toEqual([640]);
    const first = figures.first();
    const image = first.locator('img');
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => drawn(image)).toBe(true);
    expect(await image.evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(new RegExp(`/photos/${photo.file}-640\\.webp$`));
    await expect(first.locator('figcaption')).toContainText(photo.es);
    await expect(first.locator('.fp-credit')).toContainText(`${photo.by} · ${photo.licence} · Wikimedia Commons`);
    await expect(first.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(photo.title));
  });

  test('links a photographer’s requested credit and the image-specific licence, not the ZIP’s guess', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/VI');
    const photo = sheetFile('VI').photos!.find((p) => p.title === 'Charlotte Amalie Wade.jpg')!;
    expect(photo.licence).toBe('CC BY-SA 4.0');
    const figure = sheet.locator('.fp-photos figure').filter({ has: page.locator(`img[src*="${photo.file}"]`) });
    await figure.locator('img').scrollIntoViewIfNeeded();
    await expect.poll(() => drawn(figure.locator('img'))).toBe(true);
    await expect(figure.getByRole('link', { name: 'Matt H. Wade' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/User:MattWade/ImageAttribution');
    await expect(figure.getByRole('link', { name: 'CC BY-SA 4.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/4.0');
    await expect(figure.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(photo.title));
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

test.describe('the sheet of a country without a complete handwritten account', () => {
  /** A figure of the sheet, by its name. */
  const fact = (sheet: Locator, name: string): Locator => sheet.locator('.fp-facts > div').filter({ has: sheet.page().locator('dt', { hasText: new RegExp(`^${name}$`) }) }).locator('dd');
  const title = (sheet: Locator): Locator => sheet.getByRole('heading', { level: 2 });

  test('opens from its flag, with what Wikidata and Wikipedia say of it and its chosen head photograph', async ({ page }) => {
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

    // Its researched timeline is added; the country and flag texts remain Wikipedia's, and its photo remains the one chosen.
    await expect(sheet.getByRole('heading', { level: 3 })).toHaveText(['De un vistazo', 'La bandera', 'Sus banderas en el tiempo', 'Las banderas de España']);
    await expect(sheet.locator('.fp-times')).toHaveCount(1);
    for (const none of ['.fp-about:not(.fp-lead)', '.fp-parts', '.fp-photos', '.fp-flown', '.fp-flag-in > div > p']) await expect(sheet.locator(none), none).toHaveCount(0);

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

    // Under it all, whose each thing is: its one photograph, Wikipedia's texts and the independently written timeline.
    const foot = sheet.locator('.fp-foot');
    await expect(foot).toContainText('The World Factbook');
    await expect(foot).toContainText('El nombre oficial, el lema, el himno y los datos de la bandera son los que dan Wikidata y Wikipedia.');
    await expect(foot).toContainText('El dibujo de la bandera es de la colección flag-icons.');
    await expect(foot).toContainText('El texto es el comienzo de los artículos de Wikipedia, abreviado, con licencia CC BY-SA 4.0.');
    await expect(foot).toContainText('La cronología está escrita para el juego a partir de la fuente enlazada junto a ella.');
    await expect(foot).toContainText('La fotografía es de Wikimedia Commons, reducida de tamaño; bajo ella van su autor y su licencia.');
    await expect(foot).not.toContainText('Las fotografías son');
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

    // The Antarctic article opens with a different flag: the Bartram proposal is explained in authored,
    // separately sourced words, not passed off as a Wikipedia extract or as the Treaty emblem of 2002.
    await openSheet(page, '/banderas/paises/AQ');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('Antártida');
    await expect(sheet.locator('.fp-about p:not(.fp-sources)')).toHaveText(sheetFile('AQ').about!.es);
    await expect(sheet.locator('.fp-flagsec .fp-flag-in p').first()).toHaveText(sheetFile('AQ').flag!.text!.es[0]);
    await expect(sheet.locator('.fp-flagsec .fp-flag-in p').first()).toContainText('No es el emblema del Tratado Antártico');
    await expect(sheet.locator('.fp-about .fp-sources a').first()).toHaveAttribute('href', 'https://www.ats.aq/e/antarctictreaty.html');
    await expect(sheet.locator('.fp-flagsec .fp-sources a').first()).toHaveAttribute('href', 'https://www.crwflags.com/fotw/flags/aq!.html#gb');
    await expect(sheet.locator('.fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveAttribute('href', sheetFile('AQ').readFlag!.es!);
    await expect(sheet.locator('.fp-flagsec .fp-more a')).toContainText('Ver también el artículo de Wikipedia sobre las banderas de Antártida');
    await expect(sheet.locator('.fp-foot-links a').first()).toHaveAttribute('href', sheetFile('AQ').read!.es!);
    await expect(sheet.locator('.fp-foot')).not.toContainText('con lo que cuentan Wikipedia y The World Factbook');
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('shows five sourced polar accounts with verified photo galleries and unchanged chosen heads', async ({ page }) => {
    await seed(page);
    for (const id of ['AQ', 'BV', 'GS', 'HM', 'TF']) {
      const file = sheetFile(id);
      const sheet = await openSheet(page, `/banderas/paises/${id}`);
      await expect(sheet.getByRole('heading', { level: 2 })).toHaveText(COUNTRIES.find((c) => c.id === id)!.n.es);
      await expect(sheet.locator('.fp-about p:not(.fp-sources)')).toHaveText(file.about!.es);
      await expect(sheet.locator('.fp-about .fp-sources')).toContainText('Fuente');
      await expect(sheet.locator('.fp-about .fp-sources a')).toHaveCount(file.sources!.about!.length);
      await expect(sheet.locator('.fp-about .fp-sources a').first()).toHaveAttribute('href', file.sources!.about![0].url);
      await expect(sheet.locator('.fp-about.fp-lead, .fp-times, .fp-flown')).toHaveCount(0);
      await expect(sheet.locator('.fp-hero figcaption')).toContainText(file.photos![0].by!);
      await expect(sheet.locator('.fp-hero img')).toHaveAttribute('src', new RegExp(`photos/${file.photos![0].file}-640\\.webp$`));
      await expect.poll(() => drawn(sheet.locator('.fp-hero img'))).toBe(true);
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(2);
      for (const [i, photo] of file.photos!.slice(1).entries()) {
        const item = gallery.nth(i);
        await expect(item.locator('figcaption')).toContainText(photo.es);
        await expect(item.locator('figcaption')).toContainText(photo.by!);
        await expect(item.locator('img')).toHaveAttribute('src', new RegExp(`photos/${photo.file}-640\\.webp$`));
        await item.locator('img').scrollIntoViewIfNeeded();
        await expect.poll(() => drawn(item.locator('img'))).toBe(true);
        if (photo.licenceUrl) {
          await expect(item.locator(`a[href="${photo.licenceUrl}"]`)).toContainText(photo.licence);
        } else {
          await expect(item.locator('figcaption')).toContainText('Dominio público');
        }
        await expect(item.locator('a', { hasText: 'Wikimedia Commons' })).toHaveAttribute('href', `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.title.replace(/ /g, '_'))}`);
      }
      await expect(sheet.locator('.fp-foot')).toContainText('Los textos escritos para el juego se basan en las fuentes enlazadas');
      expect((await sheet.locator('article.fp').innerText())).not.toContain('Placeholder');
      if (file.flag?.text) {
        await expect(sheet.locator('.fp-flag-in p').first()).toHaveText(file.flag.text.es[0]);
        await expect(sheet.locator('.fp-flagsec .fp-sources a')).toHaveCount(file.sources!.flag!.length);
        await expect(sheet.locator('.fp-flagsec .fp-sources a').first()).toHaveAttribute('href', file.sources!.flag![0].url);
        await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveAttribute('href', file.readFlag!.es!);
        await expect(sheet.locator('.fp-parts dt')).toHaveText(file.flag.parts!.map((part) => part.es[0]));
        await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
      } else {
        await expect(sheet.locator('.fp-flagsec .fp-sources')).toHaveCount(0);
        await expect(sheet.locator('.fp-flagsec .fp-lead')).toBeVisible();
        await expect(sheet.locator('.fp-foot')).toContainText('La entradilla sobre la bandera es de Wikipedia');
        await expect(sheet.locator('.fp-foot')).not.toContainText('El texto es el comienzo de los artículos');
      }
      await expect(sheet.locator('.fp-side .fp-arms')).toHaveCount(['GS', 'TF'].includes(id) ? 1 : 0);
    }
    const sheet = sheetOf(page);
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('23 de febrero de 2007');
    await expect(sheet.locator('.fp-flag-in p').first()).toContainText('El decreto no fija proporciones');
    await expect(sheet.locator('.fp-parts dd').last()).toContainText('el decreto no establece ese significado');
    await openSheet(page, '/banderas/paises/GS');
    await expect(sheet.locator('.fp-parts dd').nth(1)).toContainText('no es fauna nativa');
    await expect(sheet.locator('.fp-flag-facts dt').filter({ hasText: 'Adoptada' })).toHaveCount(0);
    await openSheet(page, '/banderas/paises/AQ');
    await expect(sheet.locator('.fp-flag-facts dt').filter({ hasText: 'Adoptada' })).toHaveCount(0);
    await expect(sheet.locator('.fp-flag-in p').first()).toContainText('No es el emblema del Tratado Antártico');
    for (const [id, owner, adopted] of [['BV', 'Noruega', '13 de julio de 1821'], ['HM', 'Australia', '3 de septiembre de 1901']] as const) {
      await openSheet(page, `/banderas/paises/${id}`);
      await expect(sheet.locator('.fp-flag-facts .fp-owner a')).toHaveText(owner);
      await expect(sheet.locator('.fp-flag-facts dd').nth(1)).toContainText(adopted);
    }
  });

  test('reads the five sourced accounts and their citations in English', async ({ page }) => {
    await seed(page, { lang: 'en' });
    for (const id of ['AQ', 'BV', 'GS', 'HM', 'TF']) {
      const file = sheetFile(id);
      const sheet = await openSheet(page, `/flags/countries/${id}`);
      await expect(sheet.locator('.fp-about p:not(.fp-sources)')).toHaveText(file.about!.en);
      await expect(sheet.locator('.fp-about .fp-sources a').first()).toHaveText(file.sources!.about![0].title.en);
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(2);
      for (const [i, photo] of file.photos!.slice(1).entries()) {
        await expect(gallery.nth(i).locator('figcaption')).toContainText(photo.en);
        await expect(gallery.nth(i).locator('figcaption')).toContainText(photo.by!);
        await expect(gallery.nth(i).locator('a', { hasText: 'Wikimedia Commons' })).toHaveAttribute('href', `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(photo.title.replace(/ /g, '_'))}`);
      }
      if (file.flag?.text) {
        await expect(sheet.locator('.fp-flag-in p').first()).toHaveText(file.flag.text.en[0]);
        await expect(sheet.locator('.fp-flagsec .fp-sources a').first()).toHaveText(file.sources!.flag![0].title.en);
        await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveAttribute('href', file.readFlag!.en!);
        await expect(sheet.locator('.fp-parts dt')).toHaveText(file.flag.parts!.map((part) => part.en[0]));
      } else {
        await expect(sheet.locator('.fp-flag-facts .fp-owner a')).toHaveText(id === 'BV' ? 'Norway' : 'Australia');
        await expect(sheet.locator('.fp-foot')).toContainText('The flag introduction is from Wikipedia, abridged');
      }
      await expect(sheet.locator('.fp-foot')).not.toContainText('The text is written for the game, from what Wikipedia and The World Factbook tell.');
    }
  });

  test('keeps sourced accounts and citation links within a phone screen @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    for (const id of ['AQ', 'BV', 'GS', 'HM', 'TF']) {
      const sheet = await openSheet(page, `/flags/countries/${id}`);
      await sheet.locator('.fp-about .fp-sources a').first().scrollIntoViewIfNeeded();
      await expect(sheet.locator('.fp-about .fp-sources a').first()).toBeVisible();
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(2);
      for (const figure of await gallery.all()) {
        await figure.locator('img').scrollIntoViewIfNeeded();
        await expect.poll(() => drawn(figure.locator('img'))).toBe(true);
        await expect(figure.locator('figcaption')).toBeVisible();
      }
      if (sheetFile(id).sources?.flag) await sheet.locator('.fp-flagsec .fp-sources a').first().scrollIntoViewIfNeeded();
      expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth), id).toBeLessThanOrEqual(0);
    }
  });

  test('adds licensed Commons photos to Uganda, Kenya and Tanzania without changing their chosen heads', async ({ page }) => {
    await seed(page);
    const heads: Record<string, string> = {
      UG: 'Kasubi Tombs 20250815 1.jpg',
      KE: 'Three giraffes 01.jpg',
      TZ: 'Serengeti-Landscape-2012.JPG',
    };
    for (const id of ['UG', 'KE', 'TZ']) {
      const file = sheetFile(id);
      const sheet = await openSheet(page, `/banderas/paises/${id}`);
      expect(file.photos).toHaveLength(3);
      expect(file.photos![0].title).toBe(heads[id]);
      await expect(sheet.locator('.fp-hero figcaption')).toContainText(file.photos![0].es);
      await expect.poll(() => drawn(sheet.locator('.fp-hero img'))).toBe(true);
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(2);
      for (const [i, photo] of file.photos!.slice(1).entries()) {
        const figure = gallery.nth(i);
        await expect(figure.locator('figcaption')).toContainText(photo.es);
        await expect(figure.locator('.fp-credit')).toContainText(photo.by!);
        await expect(figure.locator(`a[href="${photo.licenceUrl}"]`)).toContainText(photo.licence);
        await expect(figure.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(photo.title));
        await expect(figure.locator('img')).toHaveAttribute('src', new RegExp(`photos/${photo.file}-640\\.webp$`));
        await figure.locator('img').scrollIntoViewIfNeeded();
        await expect.poll(() => drawn(figure.locator('img'))).toBe(true);
      }
    }
    const sheet = sheetOf(page);
    await expect(sheet.locator('.fp-times li')).toHaveCount(3); // Tanzania's existing, researched timeline survives.
    await openSheet(page, '/banderas/paises/UG');
    await expect(sheet.locator('.fp-flagsec .fp-flag-in p').first()).toHaveText(sheetFile('UG').flag!.text!.es[0]);
    await expect(sheet.locator('.fp-flagsec')).toContainText('9 de octubre de 1962');
    await expect(sheet.locator('.fp-flagsec')).not.toContainText('1969');
    await expect(sheet.locator('.fp-flagsec .fp-sources a').first()).toHaveAttribute('href', 'https://ulii.org/akn/ug/act/ord/1962/64');
    await expect(sheet.locator('.fp-parts dt')).toHaveText(sheetFile('UG').flag!.parts!.map((part) => part.es[0]));
    await expect(sheet.locator('.fp-times')).toHaveCount(0); // The 1962 catalogue proposal was not adopted.
  });

  test('credits the new East African galleries and Uganda’s sourced flag explanation in English', async ({ page }) => {
    await seed(page, { lang: 'en' });
    for (const id of ['UG', 'KE', 'TZ']) {
      const file = sheetFile(id);
      const sheet = await openSheet(page, `/flags/countries/${id}`);
      await expect(sheet.locator('.fp-hero figcaption')).toContainText(file.photos![0].en);
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(2);
      for (const [i, photo] of file.photos!.slice(1).entries()) {
        await expect(gallery.nth(i).locator('figcaption')).toContainText(photo.en);
        await expect(gallery.nth(i).locator('.fp-credit')).toContainText(photo.by!);
        await expect(gallery.nth(i).getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(photo.title));
      }
    }
    const sheet = await openSheet(page, '/flags/countries/UG');
    await expect(sheet.locator('.fp-flag-in p').first()).toHaveText(sheetFile('UG').flag!.text!.en[0]);
    await expect(sheet.locator('.fp-flagsec .fp-sources a').first()).toHaveText("Uganda's National Flag and Armorial Ensigns Act");
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-about.fp-lead')).toBeVisible(); // Only the flag's introduction was replaced.
  });

  test('loads the three new galleries on a phone without horizontal overflow @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    for (const id of ['UG', 'KE', 'TZ']) {
      const sheet = await openSheet(page, `/flags/countries/${id}`);
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(2);
      for (const figure of await gallery.all()) {
        await figure.locator('img').scrollIntoViewIfNeeded();
        await expect.poll(() => drawn(figure.locator('img'))).toBe(true);
        await expect(figure.locator('figcaption')).toBeVisible();
      }
      expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth), id).toBeLessThanOrEqual(0);
    }
  });

  test('shows five credited Commons photographs per gallery without replacing the heads or changing flag periods', async ({ page }) => {
    await seed(page);
    const heads = {
      RW: 'Kigali2018Cropped.jpg', BI: 'Bujumbura Burundi Lac Tanganyika 24.jpg',
      CD: 'Virunga 01.jpg', ZM: 'Cataratas Victoria, Zambia-Zimbabue, 2018-07-27, DD 05.jpg',
      AO: 'Quedas-Kalandula 07 queda LWS-2011-08 QD18 (cropped).jpg',
      NA: 'Dead Vlei, Sossusvlei, Namibia, 2018-08-06, DD 086.jpg',
    } as const;
    for (const id of ['RW', 'BI', 'CD', 'ZM', 'AO', 'NA'] as const) {
      const file = sheetFile(id);
      const sheet = await openSheet(page, `/banderas/paises/${id}`);
      expect(file.photos).toHaveLength(5);
      expect(file.photos![0].title).toBe(heads[id]);
      await expect(sheet.locator('.fp-hero figcaption')).toContainText(file.photos![0].es);
      await expect.poll(() => drawn(sheet.locator('.fp-hero img'))).toBe(true);
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(4);
      for (const [i, photo] of file.photos!.slice(1).entries()) {
        const figure = gallery.nth(i);
        await expect(figure.locator('figcaption')).toContainText(photo.es);
        await expect(figure.locator('.fp-credit')).toContainText(`${photo.by} · ${photo.licence} · Wikimedia Commons`);
        await expect(figure.getByRole('link', { name: photo.licence })).toHaveAttribute('href', photo.licenceUrl!);
        await expect(figure.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(photo.title));
        await expect(figure.locator('img')).toHaveAttribute('src', new RegExp(`photos/${photo.file}-640\\.webp$`));
        await figure.locator('img').scrollIntoViewIfNeeded();
        await expect.poll(() => drawn(figure.locator('img'))).toBe(true);
      }
      if (id === 'RW' || id === 'CD') await expect(sheet.locator('.fp-times li')).toHaveCount(id === 'RW' ? 3 : 6);
      else await expect(sheet.locator('.fp-times')).toHaveCount(0);
      await expect(page.locator('.crash')).toHaveCount(0);
    }
  });

  test('reads the six five-photo galleries in English on a phone without overflow @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    for (const id of ['RW', 'BI', 'CD', 'ZM', 'AO', 'NA']) {
      const file = sheetFile(id);
      const sheet = await openSheet(page, `/flags/countries/${id}`);
      await expect(sheet.locator('.fp-hero figcaption')).toContainText(file.photos![0].en);
      const gallery = sheet.locator('.fp-photos .fp-masonry figure');
      await expect(gallery).toHaveCount(4);
      for (const [i, photo] of file.photos!.slice(1).entries()) {
        const figure = gallery.nth(i);
        await figure.locator('img').scrollIntoViewIfNeeded();
        await expect.poll(() => drawn(figure.locator('img'))).toBe(true);
        await expect(figure.locator('figcaption')).toContainText(photo.en);
        await expect(figure.locator('.fp-credit')).toContainText(`${photo.by} · ${photo.licence} · Wikimedia Commons`);
        await expect(figure.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(photo.title));
      }
      expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth), id).toBeLessThanOrEqual(0);
    }
  });

  test('shows the coat of arms of the country under the globe, small, with what it is and whose the drawing is', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/ES');
    const spain = sheetFile('ES').arms!;
    const arms = sheet.locator('.fp-glance .fp-side .fp-arms');
    const picture = arms.locator('img');
    await expect.poll(() => drawn(picture)).toBe(true);
    await expect(picture).toHaveAttribute('src', new RegExp(`photos/${spain.file}-${spain.w}\\.webp$`));
    // What it is is said under it, once.
    await expect(picture).toHaveAttribute('alt', '');
    await expect(arms.locator('figcaption')).toHaveText(/^Escudo\s/);
    // In a box of 132 px, whatever its shape: as large as fits, and no larger.
    const box = (await picture.boundingBox())!;
    expect(Math.round(Math.max(box.width, box.height))).toBe(132);
    expect(Math.abs(box.width / box.height - spain.w / spain.h)).toBeLessThan(0.02);
    // Under the globe, in its column.
    const globe = (await sheet.locator('.fp-glance .fp-side .fp-where').boundingBox())!;
    expect(box.y).toBeGreaterThan(globe.y + globe.height);
    expect(Math.abs(box.x + box.width / 2 - (globe.x + globe.width / 2))).toBeLessThan(2);
    // Whose the drawing is, on what terms, and its page in Commons, which tells the rest.
    expect([spain.title, spain.licence, spain.by]).toEqual(['Escudo de España (mazonado).svg', 'Public domain', 'Gobierno de España, SanchoPanzaXXI']);
    await expect(arms.locator('.fp-credit')).toHaveText(/^Gobierno de España, SanchoPanzaXXI · Dominio público · Wikimedia Commons$/);
    await expect(arms.locator('.fp-credit a')).toHaveAttribute('href', commons(spain.title));
    await expect(sheet.locator('.fp-foot')).toContainText('El escudo es un dibujo de Wikimedia Commons, reducido de tamaño');

    // What is no coat of arms is called what it is; and whoever drew it is named, with the terms it is given on and where they are written.
    for (const [id, what] of [['JP', 'Sello'], ['IT', 'Emblema'], ['NI', 'Escudo']] as const) {
      await open(page, `/banderas/paises/${id}`);
      await expect(sheet.locator('article.fp')).toBeVisible();
      const one = sheetFile(id).arms!;
      expect(one.kind, id).toBe(what === 'Sello' ? 'seal' : what === 'Emblema' ? 'emblem' : undefined);
      await expect(arms.locator('figcaption')).toHaveText(new RegExp(`^${what}\\s`));
      await expect.poll(() => drawn(picture)).toBe(true);
      await expect(arms.locator('.fp-credit a').last()).toHaveAttribute('href', commons(one.title));
    }
    const japan = sheetFile('JP').arms!;
    const nicaragua = sheetFile('NI').arms!;
    expect([japan.licence, nicaragua.licence, nicaragua.by]).toEqual(['CC BY-SA 4.0', 'Attribution', 'C records']);
    // Still that of Nicaragua, the last that was opened: free for any use as long as its author is named, with no page that says so.
    await expect(arms.locator('.fp-credit')).toHaveText(/^C records · Uso libre con atribución · Wikimedia Commons$/);
    await expect(arms.locator('.fp-credit a')).toHaveCount(1);
    await open(page, '/banderas/paises/JP');
    await expect(arms.locator('.fp-credit')).toHaveText(new RegExp(`^${japan.by} · CC BY-SA 4\\.0 · Wikimedia Commons$`));
    await expect(arms.locator('.fp-credit a').first()).toHaveAttribute('href', japan.licenceUrl!);

    // A drawing nobody holds rights of, and of which Commons names nobody, says only that.
    const mexico = sheetFile('MX').arms!;
    expect([mexico.licence, mexico.by]).toEqual(['Public domain', undefined]);
    await open(page, '/banderas/paises/MX');
    await expect(arms.locator('.fp-credit')).toHaveText(/^Dominio público · Wikimedia Commons$/);
    await expect(arms.locator('.fp-credit a')).toHaveAttribute('href', commons(mexico.title));

    // The sheet somebody wrote by hand shows it too.
    await open(page, '/banderas/paises/BR');
    await expect(arms.locator('figcaption')).toHaveText(/^Escudo\s/);
    await expect.poll(() => drawn(picture)).toBe(true);
  });

  test('shows no coat of arms of a country that has none, nor of a territory that flies the flag of its country', async ({ page }) => {
    await seed(page);
    for (const id of ['TR', 'RE', 'AQ']) expect(sheetFile(id).arms, id).toBeUndefined();
    const sheet = await openSheet(page, '/banderas/paises/TR');
    // The globe is where it was, alone.
    await expect(sheet.locator('.fp-glance .fp-side .fp-where svg')).toBeVisible();
    await expect(sheet.locator('.fp-arms')).toHaveCount(0);
    await expect(sheet.locator('.fp-foot')).not.toContainText('El escudo');
    await open(page, '/banderas/paises/RE');
    await expect(title(sheet)).toHaveText('Reunión');
    await expect(sheet.locator('.fp-glance .fp-side .fp-where svg')).toBeVisible();
    await expect(sheet.locator('.fp-arms')).toHaveCount(0);
  });

  test('puts a light plate behind the coat of arms where the sheet is dark, and says in English what it is', async ({ page }) => {
    await seed(page, { theme: 'dark', lang: 'en' });
    // That of India is drawn in black lines, with nothing behind them.
    const sheet = await openSheet(page, '/flags/countries/IN');
    const arms = sheet.locator('.fp-arms');
    const picture = arms.locator('img');
    await expect.poll(() => drawn(picture)).toBe(true);
    const behind = await picture.evaluate((img) => {
      const style = getComputedStyle(img);
      return { colour: style.backgroundColor, padding: style.paddingTop, round: style.borderTopLeftRadius, sheet: getComputedStyle(img.closest('.dlg-box')!).backgroundColor };
    });
    expect(behind).toMatchObject({ colour: 'rgb(236, 233, 225)', padding: '10px', round: '14px' });
    expect(behind.sheet).not.toBe(behind.colour);
    await expect(arms.locator('figcaption')).toHaveText(/^Emblem\s/);
    await expect(arms.locator('.fp-credit')).toHaveText(/^Government of India · Public domain · Wikimedia Commons$/);
    await expect(sheet.locator('.fp-foot')).toContainText('The coat of arms is a drawing from Wikimedia Commons, made smaller');
    await open(page, '/flags/countries/ES');
    await expect(arms.locator('figcaption')).toHaveText(/^Coat of arms\s/);
    await open(page, '/flags/countries/JP');
    await expect(arms.locator('figcaption')).toHaveText(/^Seal\s/);
  });

  test('puts the coat of arms beside the globe on a phone, under the figures @movil', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/ES');
    const screen = page.viewportSize()!;
    const picture = sheet.locator('.fp-arms img');
    await picture.scrollIntoViewIfNeeded();
    await expect.poll(() => drawn(picture)).toBe(true);
    const [globe, arms, facts] = [(await sheet.locator('.fp-side .fp-where').boundingBox())!, (await sheet.locator('.fp-side .fp-arms').boundingBox())!, (await sheet.locator('.fp-glance .fp-facts').boundingBox())!];
    // Side by side, the globe first, both under the figures and inside the screen.
    expect(Math.abs(globe.y - arms.y)).toBeLessThan(2);
    expect(arms.x).toBeGreaterThan(globe.x + globe.width);
    expect(globe.y).toBeGreaterThanOrEqual(facts.y + facts.height);
    expect(globe.x).toBeGreaterThanOrEqual(0);
    expect(arms.x + arms.width).toBeLessThanOrEqual(screen.width);
    const box = (await picture.boundingBox())!;
    expect(Math.round(Math.max(box.width, box.height))).toBe(132);
    const scroller = sheet.locator('.dlg-box');
    expect(await scroller.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
  });

  test('shows the next fifty countries their own photograph, not a result from a place of the same name elsewhere', async ({ page }) => {
    await seed(page);
    for (const id of ['MG', 'LK', 'PS', 'SS', 'ZW']) {
      const photo = sheetFile(id).photos![0];
      const sheet = await openSheet(page, `/banderas/paises/${id}`);
      await expect(sheet.locator('.fp-band'), id).toHaveCount(0);
      const hero = sheet.locator('.fp-hero img');
      await expect.poll(() => drawn(hero), { message: id }).toBe(true);
      expect(await hero.evaluate((img: HTMLImageElement) => img.currentSrc), id).toMatch(new RegExp(`/photos/${photo.file}-(640|1280)\\.webp$`));
      const caption = sheet.locator('.fp-hero figcaption');
      await expect(caption, id).toContainText(photo.es);
      await expect(caption.locator('.fp-credit'), id).toContainText(`${photo.by} · ${photo.licence} · Wikimedia Commons`);
      await expect(caption.getByRole('link', { name: 'Wikimedia Commons' }), id).toHaveAttribute('href', commons(photo.title));
      await expect(page.locator('.crash'), id).toHaveCount(0);
    }
    // This picture of a Palestinian monastery requires the photographer's real name, not only his username.
    expect(sheetFile('PS').photos![0].by).toBe('Andrew Shiva / Wikipedia');
    expect(sheetFile('LK').photos![0].title).toBe('Sigiriya Rock fortress.jpg');
  });

  test('shows photographs of the last States with their actual subject, attribution and reframing', async ({ page }) => {
    await seed(page);
    for (const id of ['EH', 'ER', 'GA', 'MN', 'SZ', 'VC']) {
      const photo = sheetFile(id).photos![0];
      const sheet = await openSheet(page, `/banderas/paises/${id}`);
      await expect(sheet.locator('.fp-band'), id).toHaveCount(0);
      const hero = sheet.locator('.fp-hero img');
      await expect.poll(() => drawn(hero), { message: id }).toBe(true);
      const box = (await hero.boundingBox())!;
      expect(box.width / box.height, id).toBeGreaterThan(1.9);
      expect(await hero.evaluate((img: HTMLImageElement) => img.currentSrc), id).toMatch(new RegExp(`/photos/${photo.file}-(640|1280)\\.webp$`));
      const caption = sheet.locator('.fp-hero figcaption');
      await expect(caption, id).toContainText(photo.es);
      await expect(caption.locator('.fp-credit'), id).toContainText(`${photo.by} · ${photo.licence} · Wikimedia Commons · reducida a WebP y reencuadrada`);
      await expect(caption.getByRole('link', { name: 'Wikimedia Commons' }), id).toHaveAttribute('href', commons(photo.title));
      await expect(page.locator('.crash'), id).toHaveCount(0);
    }
    expect(sheetFile('ER').photos![0].title).toBe('Asmara, cinema impero, 07.JPG');
    expect(sheetFile('VC').photos![0].by).toBe('Iain Grant (Igbgrant)');
  });

  test('shows the territories’ verified photos, including requested author credits', async ({ page }) => {
    await seed(page);
    for (const id of ['AX', 'MO', 'MS', 'NF', 'TK', 'WF']) {
      const photo = sheetFile(id).photos![0];
      const sheet = await openSheet(page, `/banderas/paises/${id}`);
      await expect(sheet.locator('.fp-band'), id).toHaveCount(0);
      const hero = sheet.locator('.fp-hero img');
      await expect.poll(() => drawn(hero), { message: id }).toBe(true);
      const caption = sheet.locator('.fp-hero figcaption');
      await expect(caption, id).toContainText(photo.es);
      const licence = photo.licence === 'Public domain' ? 'Dominio público' : photo.licence;
      await expect(caption.locator('.fp-credit'), id).toContainText(`${photo.by} · ${licence} · Wikimedia Commons`);
      await expect(caption.getByRole('link', { name: 'Wikimedia Commons' }), id).toHaveAttribute('href', commons(photo.title));
      if (id === 'MO') {
        expect(photo.by).toBe('Diego Delso, delso.photo');
        expect(photo.byUrl).toBe('https://delso.photo/');
        await expect(caption.getByRole('link', { name: 'Diego Delso, delso.photo' })).toHaveAttribute('href', photo.byUrl!);
        await expect(caption.getByRole('link', { name: photo.licence })).toHaveAttribute('href', photo.licenceUrl!);
      }
      if (id === 'MS') expect(photo.by).toBe('Andrew Shiva / Wikipedia');
      await expect(page.locator('.crash'), id).toHaveCount(0);
    }
  });

  test('gives the last States a bilingual caption and alteration notice on a phone @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const photo = sheetFile('MN').photos![0];
    const sheet = await openSheet(page, '/flags/countries/MN');
    const hero = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(hero)).toBe(true);
    const box = (await hero.boundingBox())!;
    expect([Math.round(box.x), Math.round(box.width)]).toEqual([0, page.viewportSize()!.width]);
    expect(box.width / box.height).toBeGreaterThan(1.4);
    expect(box.width / box.height).toBeLessThan(1.6);
    await expect(sheet.locator('.fp-hero figcaption')).toContainText(photo.en);
    await expect(sheet.locator('.fp-hero .fp-credit')).toContainText('resized to WebP and reframed');
    expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('puts the new photograph across a phone with its English caption and credit @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/SS');
    await expect(sheet.getByRole('heading', { level: 2 })).toHaveText('South Sudan');
    const photo = sheetFile('SS').photos![0];
    const hero = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(hero)).toBe(true);
    const box = (await hero.boundingBox())!;
    expect([Math.round(box.x), Math.round(box.width)]).toEqual([0, page.viewportSize()!.width]);
    await expect(sheet.locator('.fp-hero figcaption')).toContainText(photo.en);
    await expect(sheet.locator('.fp-hero .fp-credit')).toContainText(`${photo.by} · ${photo.licence} · Wikimedia Commons`);
    expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('tells the history of Spain, correcting naval ensign years instead of repeating the catalogue captions', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/ES');
    const times = sheet.locator('.fp-times');
    await expect(times.getByRole('heading', { level: 3 })).toHaveText('Sus banderas en el tiempo');
    const stops = times.locator('ol > li');
    expect(FLAGS.past.ES).toHaveLength(7);
    await expect(stops).toHaveCount(9);
    await expect(times.locator('.fp-when')).toHaveText(['1701–1760', '1760–1785', '1785–1843', '1843–1931', '1931–1939', '1939–1945', '1945–1977', '1977–1981', 'Desde 1981']);
    await expect(times.locator('h4').first()).toHaveText('Pabellón naval de Felipe V');
    await expect(stops.nth(1).locator('.fp-time-text')).toContainText('Por eso el rey escogió en 1785 otra');
    await expect(stops.nth(4).locator('h4')).toHaveText('La tricolor de la Segunda República');
    await expect(stops.nth(7).locator('h4')).toHaveText('La bandera de la transición');
    for (const [i, time] of sheetFile('ES').times!.entries()) {
      const img = stops.nth(i).locator('.fp-time-flag img');
      const file = time.past && FLAGS.past.ES.find((row) => row[2] === time.past![0] && row[3] === time.past![1]);
      if (file) await expect(img).toHaveAttribute('src', new RegExp(`flags/commons/${file[4] ?? file[0]}$`));
      else await expect(img).toHaveAttribute('src', /flags\/es\.svg$/);
    }
    const first = stops.first().locator('img');
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute('alt', 'Bandera de España: Pabellón naval de Felipe V (1701–1760)');
    await expect.poll(() => drawn(first)).toBe(true);
    await expect(stops.nth(1).locator('img')).toHaveAttribute('alt', 'Bandera de España: El pabellón blanco de Carlos III (1760–1785)');
    await expect(times.locator('li.fp-now')).toHaveCount(1);
    await expect(stops.last()).toHaveClass(/fp-now/);
    await expect(stops.last().locator('img')).toHaveAttribute('alt', 'Bandera de España: La rojigualda con el escudo actual (Desde 1981)');
    await expect(times.locator('.fp-note')).toContainText('pabellones navales, no banderas nacionales');
    await expect(times.getByRole('link', { name: 'Consultar la fuente' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Flag_of_Spain');
    await expect(sheet.locator('.fp-flown')).toHaveCount(0);

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

  test('keeps the simple past-flags gallery where no history has been written', async ({ page }) => {
    await seed(page);
    // Tuvalu still lacks the 1995–1997 flag without a Union Jack, so it has no researched timeline yet.
    const sheet = await openSheet(page, '/banderas/paises/TV');
    const flown = sheet.locator('.fp-flown');
    await expect(sheet.locator('.fp-times')).toHaveCount(0);
    await expect(flown.locator('ol > li')).toHaveCount(FLAGS.past.TV.length + 1);
    await expect(flown.locator('.fp-when').last()).toHaveText('Hoy');
    await expect(flown.locator('.fp-note')).toHaveText('Son las banderas anteriores que recoge Wikidata, con los años en que ondeó cada una; puede faltar alguna.');
    await expect(flown.locator('li.fp-now img')).toHaveAttribute('src', /flags\/tv\.svg$/);
  });

  for (const [group, ids] of [
    ['first seven', ['BD', 'CA', 'CD', 'DE', 'FR', 'GB', 'IN']],
    ['next seven', ['IT', 'LY', 'MX', 'PT', 'RU', 'UA', 'ZA']],
    ['second batch of eight', ['CR', 'EC', 'ET', 'KR', 'NI', 'PY', 'RO', 'SV']],
    ['first five of the third batch', ['BG', 'BY', 'EG', 'IQ', 'KH']],
    ['last four of the third batch', ['MZ', 'SC', 'TM', 'US']],
    ['first seven of the fourth batch', ['AL', 'AT', 'BA', 'CY', 'GR', 'HR', 'HU']],
    ['last seven of the fourth batch', ['IR', 'LT', 'MN', 'NL', 'PH', 'PL', 'SA']],
    ['first six of the fifth batch', ['AG', 'AS', 'AZ', 'BH', 'BM', 'BS']],
    ['next six of the fifth batch', ['CK', 'DM', 'FK', 'GD', 'GH', 'HT']],
    ['last five of the fifth batch', ['IS', 'KG', 'MK', 'MR', 'MW']],
    ['first four of the sixth batch', ['BB', 'GA', 'GG', 'JE']],
    ['next four of the sixth batch', ['KM', 'KW', 'LC', 'LS']],
    ['last four of the sixth batch', ['MY', 'RW', 'TG', 'TN']],
    ['six of the seventh batch', ['GQ', 'HN', 'RS', 'SY', 'TW', 'VE']],
    ['four union-and-separation', ['CZ', 'SK', 'TZ', 'YE']],
  ] as const) {
    test(`shows the ${group} researched histories with the actual catalogue drawings and a source`, async ({ page }) => {
      await seed(page);
      const sheet = sheetOf(page);
      for (const id of ids) {
        const said = sheetFile(id);
        await openSheet(page, `/banderas/paises/${id}`);
        await expect(sheet.locator('.fp-times ol > li'), id).toHaveCount(said.times!.length);
        await expect(sheet.locator('.fp-flown'), id).toHaveCount(0);
        await expect(sheet.locator('.fp-hero img'), id).toHaveAttribute('src', /photos\//);
        await expect(sheet.locator('section.fp-about.fp-lead'), id).toBeVisible();
        await expect(sheet.locator('.fp-times h4').first(), id).toHaveText(said.times![0].name.es);
        await expect(sheet.locator('.fp-times li.fp-now'), id).toHaveCount(1);
        await expect(sheet.locator('.fp-times .fp-note'), id).toContainText(said.timeNote?.es ?? 'Una selección de enseñas históricas');
        await expect(sheet.locator('.fp-times').getByRole('link', { name: 'Consultar la fuente' }), id).toHaveAttribute('href', said.timeSource!);
        for (const [i, time] of said.times!.entries()) {
          const flag = sheet.locator('.fp-times li').nth(i).locator('.fp-time-flag img');
          const past = time.past ? FLAGS.past[id].find((row) => row[2] === time.past![0] && row[3] === time.past![1] && (!time.pastFile || row[0] === time.pastFile)) : undefined;
          const gone = time.gone ? FLAGS.gone.find((row) => row[0] === time.gone) : undefined;
          const file = past ? past[4] ?? past[0] : gone ? gone[7] ?? gone[3] : null;
          await expect(flag, `${id} ${i}`).toHaveAttribute('src', file ? new RegExp(`flags/commons/${file}$`) : new RegExp(`flags/${COUNTRIES.find((country) => country.id === id)!.fl}\\.svg$`));
        }
        await expect(page.locator('.crash'), id).toHaveCount(0);
      }
    });
  }

  test('explains coexisting predecessor flags and the federation in English with sourced, independently dated drawings', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/YE');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('.fp-when').first()).toHaveText('1927–1962'); // The catalogue begins the drawing in 1918.
    await expect(times.locator('.fp-when').nth(2)).toHaveText('1967–1990'); // Overlaps northern Yemen.
    const southYemen = times.locator('.fp-time-flag img').nth(2);
    await expect(southYemen).toHaveAttribute('src', /flags\/commons\/112810bb56\.svg$/);
    await southYemen.scrollIntoViewIfNeeded();
    await expect.poll(() => drawn(southYemen)).toBe(true);
    await expect(times.locator('.fp-note')).toContainText('coexisted from 1967');
    await expect(times.getByRole('link', { name: 'See the source' })).toHaveAttribute('href', 'https://www.crwflags.com/fotw/flags/ye-index.html');

    await openSheet(page, '/flags/countries/TZ');
    await expect(times.locator('.fp-when').nth(1)).toHaveText('10 December 1963–12 January 1964 · Zanzibar');
    const zanzibar = times.locator('.fp-time-flag img').nth(1);
    await expect(zanzibar).toHaveAttribute('src', /flags\/commons\/6c3a9f65bb\.svg$/);
    await zanzibar.scrollIntoViewIfNeeded();
    await expect.poll(() => drawn(zanzibar)).toBe(true);
    await expect(times.locator('.fp-when').last()).toHaveText('Since 30 June 1964 · union on 26 April');
    await expect(times.locator('.fp-note')).toContainText('the catalogue starts in 1856');

    await openSheet(page, '/flags/countries/CZ');
    await expect(times.locator('.fp-when').first()).toHaveText('1920–1939');
    await expect(times.locator('.fp-when').nth(1)).toHaveText('October 1939–May 1945 · protectorate under German occupation');
    const protectorate = times.locator('.fp-time-flag img').nth(1);
    await expect(protectorate).toHaveAttribute('src', /flags\/commons\/41cef6506e\.svg$/);
    await protectorate.scrollIntoViewIfNeeded();
    await expect.poll(() => drawn(protectorate)).toBe(true);
    await expect(times.locator('.fp-note')).toContainText('coexisted with the federal flag');

    await openSheet(page, '/flags/countries/SK');
    const wartimeSlovakia = times.locator('.fp-time-flag img').nth(1);
    await expect(wartimeSlovakia).toHaveAttribute('src', /flags\/commons\/fb36e4c94e\.svg$/);
    await wartimeSlovakia.scrollIntoViewIfNeeded();
    await expect.poll(() => drawn(wartimeSlovakia)).toBe(true);
    await expect(times.locator('.fp-when').last()).toHaveText('Since September 1992 · independent since January 1993');
    await expect(times.locator('.fp-note')).toContainText('state under Nazi German control');
    await expect(page.locator('.crash')).toHaveCount(0);
  });

  test('translates the narrated periods and their caveats, not only the country text', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/CA');
    await expect(sheet.locator('.fp-times h4')).toHaveText(['An ensign with provincial arms', "Canada's new coat of arms", 'The leaves turn red', 'A single maple leaf']);
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('not formally adopted national flags');
    await expect(sheet.locator('.fp-times').getByRole('link', { name: 'See the source' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Canadian_Red_Ensign');
    await openSheet(page, '/flags/countries/DE');
    await expect(sheet.locator('.fp-when').first()).toHaveText('1867–1918 and 1933–1935');
    await expect(sheet.locator('.fp-times .fp-time-text').nth(2)).toContainText('merchant ships');
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('not a national flag');
    await openSheet(page, '/flags/countries/LY');
    await expect(sheet.locator('.fp-times h4').last()).toHaveText('The 1951 flag returns');
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('did not restore the monarchy');
  });

  test('shows researched dates and distinct same-year flags in both languages', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/CR');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('ol > li')).toHaveCount(11);
    await expect(times.locator('.fp-when').nth(2)).toHaveText('4 March–2 November 1824');
    await expect(times.locator('.fp-when').nth(3)).toHaveText('2–22 November 1824');
    await expect(times.locator('li').nth(2).locator('img')).toHaveAttribute('src', /flags\/commons\/19d0666629\.svg$/);
    await expect(times.locator('li').nth(3).locator('img')).toHaveAttribute('src', /flags\/commons\/0987a89723\.svg$/);
    await expect(times.locator('.fp-when').last()).toHaveText('Civil flag since 1848; current state arms since 1998');
    await openSheet(page, '/flags/countries/NI');
    await expect(times.locator('.fp-when').nth(2)).toHaveText('1854–1856');
    await expect(times.locator('li').nth(3).locator('img')).toHaveAttribute('src', /flags\/commons\/c868c6d62e\.svg$/);
    await expect(times.locator('li').nth(5).locator('img')).toHaveAttribute('src', /flags\/commons\/c868c6d62e\.svg$/);
    await openSheet(page, '/flags/countries/RO');
    await expect(times.locator('.fp-when').nth(1)).toHaveText('January–March 1948');
    await openSheet(page, '/flags/countries/SV');
    await expect(times.locator('.fp-when').last()).toHaveText('1916–1921 and since 1922');
    await expect(times.locator('.fp-note')).toContainText('1912–1916');
    await expect(times.getByRole('link', { name: 'See the source' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Flag_of_El_Salvador');
  });

  test('dates the new histories independently of the flag catalogue and credits licensed drawings', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/IQ');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('.fp-when').first()).toHaveText('1924–1959');
    await expect(times.locator('.fp-note')).toContainText('A 2004 proposal that was never adopted is omitted');
    await openSheet(page, '/flags/countries/EG');
    await expect(times.locator('.fp-when').nth(4)).toHaveText('1958–1972');
    await expect(times.locator('.fp-when').last()).toHaveText('Since 1984');
    await openSheet(page, '/flags/countries/MZ');
    await expect(times.locator('.fp-when').nth(2)).toHaveText('April–1 May 1983');
    await expect(times.locator('.fp-when').last()).toHaveText('Since 1983');
    await openSheet(page, '/flags/countries/TM');
    await expect(times.locator('.fp-when').first()).toHaveText('1974–1992');
    await expect(times.locator('.fp-note')).toContainText('catalogue dates the Soviet drawing from 1925');
    await openSheet(page, '/flags/countries/KH');
    await expect(times.locator('li')).toHaveCount(6);
    await expect(times.locator('.fp-note')).toContainText('disputed provenance and is not shown');
    const un = times.locator('li').nth(4);
    await expect(un.locator('img')).toHaveAttribute('src', /flags\/commons\/2a344f84d8\.svg$/);
    await expect(un.locator('.fp-credit')).toContainText('Lexicon assumed');
    await expect(un.getByRole('link', { name: 'CC BY-SA 3.0' })).toHaveAttribute('href', 'https://creativecommons.org/licenses/by-sa/3.0/');
    await expect(un.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons('Flag of Cambodia (1992–1993).svg'));
  });

  test('checks the first hoisting and distinguishes national flags from union and colonial ensigns', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/CK');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('.fp-when')).toHaveText(['1974–1979', 'Since 1979']);
    await expect(times.locator('li').first().locator('img')).toHaveAttribute('src', /flags\/commons\/cca17cb41a\.svg$/);
    await expect(times.locator('li').first().locator('.fp-time-text')).toContainText('first raised on 24 January 1974');
    await expect(times.locator('.fp-note')).toContainText('catalogue and some lists date the green drawing from 1973');
    await expect(times.getByRole('link', { name: 'See the source' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Flag_of_the_Cook_Islands');

    await openSheet(page, '/flags/countries/AZ');
    await expect(times.locator('.fp-when')).toHaveText(['1991–2013', 'Since 2013']);
    await expect(times.locator('.fp-note')).toContainText('does not imply continuous use since 1918');
    await openSheet(page, '/flags/countries/DM');
    await expect(times.locator('.fp-when').first()).toHaveText('1965–1978');
    await expect(times.locator('.fp-when').nth(1)).toHaveText('1981–1988');
    await expect(times.locator('.fp-note')).toContainText('first independence flag (1978–1981)');
    await openSheet(page, '/flags/countries/GH');
    await expect(times.locator('ol > li')).toHaveCount(2);
    await expect(times.locator('.fp-when').last()).toHaveText('1957–1964 and since 1966');
    await expect(times.locator('.fp-note')).toContainText('Union of African States');
  });

  test('corrects adoption dates where sources and the catalogue disagree', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/AS');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('17 de abril de 1960');
    await expect(sheet.locator('.fp-times ol > li')).toHaveCount(3);
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('bandera de Estados Unidos');
    await openSheet(page, '/banderas/paises/BH');
    await expect(sheet.locator('.fp-times .fp-when').first()).toHaveText('Reconocida en 1933 · hasta 1972');
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('versiones rectas y dentadas');
    await openSheet(page, '/banderas/paises/MR');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('25 de octubre de 2017');
    await expect(sheet.locator('.fp-times .fp-when').last()).toHaveText('Desde 2017');
    await openSheet(page, '/banderas/paises/HT');
    await expect(sheet.locator('.fp-flag-facts dt').filter({ hasText: 'Adoptada' })).toHaveCount(0);
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('Britannica fecha su restitución el 25');
  });

  test('keeps maritime ensigns separate from national flags and shows gaps in the sixth batch', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/KW');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('.fp-when')).toHaveText(['1956–1961 · maritime ensign', 'Since 1961']);
    await expect(times.locator('.fp-note')).toContainText('did not replace the red flag with inscriptions flown on land');
    await expect(times.locator('li').first().locator('img')).toHaveAttribute('src', /flags\/commons\/dd9f13b523\.svg$/);
    await expect(times.locator('li').first().getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons('Maritime Ensign of Kuwait 1956-1961.svg'));

    await openSheet(page, '/flags/countries/LC');
    await expect(times.locator('.fp-when')).toHaveText(['1939–1967', '1979–2002', 'Since 2002']);
    await expect(times.locator('.fp-note')).toContainText('1967–1979 version is missing');
    await openSheet(page, '/flags/countries/KM');
    await expect(times.locator('.fp-when').first()).toHaveText('1996–2001');
    await expect(times.locator('.fp-note')).toContainText('catalogue ends the previous drawing in 2002');
    await openSheet(page, '/flags/countries/TG');
    await expect(times.locator('.fp-when').nth(1)).toHaveText('From sometime in 1958 until 1960');
    await expect(times.locator('.fp-note')).toContainText('stars\' exact position and colour');
    await expect(times.getByRole('link', { name: 'See the source' })).toHaveAttribute('href', 'https://www.crwflags.com/fotw/flags/tg-1957.html');
  });

  test('keeps legal dates, the wrong Syrian catalogue range and mainland ROC history distinct', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/SY');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('ol > li')).toHaveCount(6);
    await expect(times.locator('.fp-when').last()).toHaveText('De facto since December 2024; official since March 2025');
    await expect(times.locator('li').nth(1).locator('img')).toHaveAttribute('src', /flags\/commons\/6ee3d471b4\.svg$/);
    await expect(times.locator('li').nth(4).locator('img')).toHaveAttribute('src', /flags\/commons\/6ee3d471b4\.svg$/);
    await expect(times.locator('.fp-note')).toContainText('actually has TWO stars');
    await expect(times.locator('.fp-note')).toContainText('three-green-star flag are omitted');
    await openSheet(page, '/flags/countries/TW');
    await expect(times.locator('li')).toHaveCount(2);
    await expect(times.locator('.fp-when').last()).toHaveText('Republic of China since 1928; in Taiwan since 1945');
    await expect(times.locator('.fp-note')).toContainText('not a sequence of flags flown on the island');
    await openSheet(page, '/flags/countries/HN');
    await expect(times.locator('li')).toHaveCount(3);
    await expect(times.locator('.fp-note')).toContainText('not new adoptions of national flags');
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0); // Wikipedia's English navy-blue claim is not the statutory turquoise.
    await expect(times.locator('.fp-when').last()).toHaveText('Since 1949');
    await openSheet(page, '/flags/countries/VE');
    await expect(times.locator('.fp-when').first()).toHaveText('1811–1812');
    await expect(times.locator('.fp-when').nth(6)).toHaveText('1930–2006 · seven-star version');
    await expect(times.locator('.fp-note')).toContainText('not successive civil-to-state replacements');
    await openSheet(page, '/flags/countries/RS');
    await expect(times.locator('.fp-when').first()).toHaveText('1839–1882');
    await expect(times.locator('.fp-note')).toContainText('constituent republic');
    await openSheet(page, '/flags/countries/GQ');
    await expect(times.locator('.fp-when').first()).toHaveText('From 12 October 1968 · duration uncertain');
    await expect(times.locator('.fp-note')).toContainText('FOTW dates their introduction to 1973 and Britannica to 1978');
  });

  test('shows Afghanistan’s de facto flag in its sheet and games, with rival regimes and missing drawings explained in Spanish', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/AF');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('ol > li')).toHaveCount(17);
    await expect(times.locator('.fp-when').first()).toHaveText('1881–1901');
    await expect(times.locator('.fp-when').last()).toHaveText('Desde agosto de 2021 · gobierno de facto');
    await expect(times.locator('.fp-note')).toContainText('la verde y blanca de Herat es local');
    await expect(times.locator('.fp-note')).toContainText('la bandera roja de 1978–1980');
    await expect(times.locator('.fp-note')).toContainText('banderas simultáneas');
    await expect(times.getByRole('link', { name: 'Consultar la fuente' })).toHaveAttribute('href', 'https://www.crwflags.com/fotw/flags/af_his.html');
    const flag = sheet.locator('.fp-flagsec .fp-flag-big');
    await expect(flag).toHaveAttribute('src', /flags\/af\.svg$/);
    await expect(flag).toHaveCSS('aspect-ratio', '2 / 1');
    await expect.poll(() => drawn(flag)).toBe(true);
    expect(await flag.evaluate((el) => (el as HTMLImageElement).naturalWidth / (el as HTMLImageElement).naturalHeight)).toBe(2);
    await expect(sheet.locator('.fp-times li').last().locator('img')).toHaveAttribute('src', /flags\/af\.svg$/);
    await expect(sheet.locator('.fp-times li').nth(15).locator('img')).toHaveAttribute('src', /flags\/commons\//);
    await expect(sheet.locator('.fp-flagsec').getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons('Flag of the Taliban.svg'));
    await expect(sheet.locator('.fp-flagsec .fp-credit')).toContainText('Lexicon · Dominio público');
    await expect(sheet.locator('.fp-flagsec .fp-note')).toContainText('La ficha y los juegos muestran la enseña blanca');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('1997');
    await expect(sheet.locator('.fp-flag-facts dt').filter({ hasText: 'Como es hoy, desde' })).toHaveCount(0);
  });

  test('explains Afghanistan’s competing flags in English', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/AF');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('.fp-note')).toContainText('Rival governments and simultaneous flags');
    await expect(times.locator('.fp-when').nth(11)).toHaveText('December 1992–2001 · recognised government');
    await expect(times.locator('.fp-when').nth(12)).toHaveText('1996–1997 · in Taliban-controlled areas');
    await expect(sheet.locator('.fp-flagsec .fp-note')).toContainText('The sheet and games show the white flag');
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('tricolour remains in use in some international contexts');
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveAttribute('href', sheetFile('AF').readFlag!.en!);
    await expect(sheet.locator('.fp-foot')).toContainText('drawing in this sheet and the games is from Wikimedia Commons');
  });

  test('keeps the sixth and seventh batches’ disputed flag dates distinct from Wikipedia in Spanish', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/GQ');
    const times = sheet.locator('.fp-times');
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveAttribute('href', sheetFile('GQ').readFlag!.es!);
    await expect(times.locator('.fp-when').first()).toHaveText('Desde el 12 de octubre de 1968 · duración incierta');
    await openSheet(page, '/banderas/paises/SY');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('13 de marzo de 2025');
    await expect(times.locator('.fp-note')).toContainText('La imagen catalogada como 1963–1972 tiene en realidad DOS estrellas');
    await openSheet(page, '/banderas/paises/HN');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('16 de febrero de 1866');
    await expect(times.locator('.fp-time-text').last()).toContainText('no anuló el decreto');
    await openSheet(page, '/banderas/paises/VE');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('9 de marzo de 2006');
    await expect(times.locator('.fp-note')).toContainText('Los rangos técnicos del catálogo');
  });

  test('does not display disputed adoption days as verified flag facts or Wikipedia quotations', async ({ page }) => {
    await seed(page);
    const sheet = await openSheet(page, '/banderas/paises/JE');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('7 de abril de 1981');
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-flagsec .fp-more a')).toHaveAttribute('href', sheetFile('JE').readFlag!.es!);
    await expect(sheet.locator('.fp-times .fp-when').first()).toHaveText('Desde al menos la década de 1830 hasta 1981');
    await openSheet(page, '/banderas/paises/RW');
    await expect(sheet.locator('.fp-flag-facts dd').first()).toContainText('31 de diciembre de 2001');
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('El 25 de octubre de 2001 se votó');
    await openSheet(page, '/banderas/paises/TN');
    await expect(sheet.locator('.fp-flag-facts dt').filter({ hasText: 'Adoptada' })).toHaveCount(0);
    await expect(sheet.locator('.fp-flagsec .fp-lead')).toHaveCount(0);
    await expect(sheet.locator('.fp-times .fp-when').first()).toHaveText('Siglo XIX–1999 · versión anterior a la ley');
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('ese día no es su fecha de adopción');
  });

  test('shows the union and split histories without clipping their drawings or caveats on a phone @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = sheetOf(page);
    for (const [id, file, index] of [
      ['CZ', '41cef6506e', 1],
      ['SK', 'fb36e4c94e', 1],
      ['TZ', '6c3a9f65bb', 1],
      ['YE', '112810bb56', 2],
    ] as const) {
      await openSheet(page, `/flags/countries/${id}`);
      const flag = sheet.locator('.fp-times li').nth(index).locator('.fp-time-flag img');
      await flag.scrollIntoViewIfNeeded();
      await expect(flag, id).toHaveAttribute('src', new RegExp(`flags/commons/${file}\\.svg$`));
      await expect.poll(() => drawn(flag), id).toBe(true);
      await expect(sheet.locator('.fp-times .fp-note'), id).toContainText(id === 'TZ' || id === 'YE' ? 'coexisted' : 'federal flag');
      expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth), id).toBeLessThanOrEqual(0);
    }
  });

  test('shows both green autonomous Togo designs without overflowing a phone @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/TG');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('ol > li')).toHaveCount(3);
    for (const [i, file] of ['4365a390b0', '3b49a62eb6'].entries()) {
      const flag = times.locator('li').nth(i).locator('img');
      await flag.scrollIntoViewIfNeeded();
      await expect(flag).toHaveAttribute('src', new RegExp(`flags/commons/${file}\\.svg$`));
      await expect.poll(() => drawn(flag)).toBe(true);
    }
    expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('reads the restored Syrian flag and the Venezuelan selection on a phone @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/SY');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('li')).toHaveCount(6);
    const earlier = times.locator('li').nth(1).locator('img');
    await earlier.scrollIntoViewIfNeeded();
    await expect(earlier).toHaveAttribute('src', /flags\/commons\/6ee3d471b4\.svg$/);
    await expect.poll(() => drawn(earlier)).toBe(true);
    await expect(times.locator('.fp-note')).toContainText('actually has TWO stars');
    expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await openSheet(page, '/flags/countries/VE');
    await expect(times.locator('li')).toHaveCount(8);
    const first = times.locator('li').first().locator('img');
    await first.scrollIntoViewIfNeeded();
    await expect(first).toHaveAttribute('src', /flags\/commons\/062bf47947\.svg$/);
    await expect.poll(() => drawn(first)).toBe(true);
    expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  });

  test('keeps the interruption of the Falklands ensign legible on a phone @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/FK');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('ol > li')).toHaveCount(4);
    await expect(times.locator('.fp-when').nth(2)).toHaveText('1948–1999, except April–June 1982');
    await expect(times.locator('.fp-note')).toContainText('flag was banned and Argentina\'s flag flew');
    await times.locator('li').nth(2).scrollIntoViewIfNeeded();
    expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await expect(times.locator('li').nth(2).locator('img')).toHaveAttribute('src', /flags\/commons\/d8d55f666a\.svg$/);
    const earlyFlag = times.locator('li').first().locator('img');
    await earlyFlag.scrollIntoViewIfNeeded();
    await expect(earlyFlag).toHaveAttribute('src', /flags\/commons\/82bd716c30\.webp$/);
    await expect.poll(() => drawn(earlyFlag)).toBe(true);
  });

  test('shows Albanian and Greek period documents with their Commons credits, without replacing the chosen heads', async ({ page }) => {
    await seed(page);
    const sheet = sheetOf(page);
    for (const id of ['AL', 'GR']) {
      const source = sheetFile(id);
      const picture = source.times![0].picture!;
      await openSheet(page, `/banderas/paises/${id}`);
      await expect(sheet.locator('.fp-hero img')).toHaveAttribute('src', new RegExp(`photos/${source.photos![0].file}-640\\.webp$`));
      const times = sheet.locator('.fp-times');
      await expect(times.locator('.fp-time-pic')).toHaveCount(1);
      const figure = times.locator('li').first().locator('.fp-time-pic');
      const img = figure.locator('img');
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => drawn(img)).toBe(true);
      await expect(img).toHaveAttribute('src', new RegExp(`photos/${picture.file}-640\\.webp$`));
      await expect(img).toHaveAttribute('alt', '');
      await expect(figure.locator('figcaption')).toContainText(picture.es);
      await expect(figure.locator('.fp-credit')).toContainText(`${picture.by} · Dominio público · Wikimedia Commons`);
      await expect(figure.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons(picture.title));
      await expect(times.locator('.fp-note')).toContainText(id === 'AL' ? 'no se conserva una prueba definitiva' : 'manuscrito de 1823');
    }
  });

  test('explains the Greek manuscript and its limitations in English', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const greek = await openSheet(page, '/flags/countries/GR');
    await expect(greek.locator('.fp-times .fp-time-pic figcaption')).toContainText(sheetFile('GR').times![0].picture!.en);
    await expect(greek.locator('.fp-times .fp-time-pic .fp-credit')).toContainText('Public domain · Wikimedia Commons');
    await expect(greek.locator('.fp-times .fp-note')).toContainText('other flags, not the exact drawing');
  });

  test('keeps the required Commons attribution readable on a phone @movil', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/KH');
    const credit = sheet.locator('.fp-times li').nth(4).locator('.fp-credit');
    await expect(credit).toContainText('CC BY-SA 3.0 · Wikimedia Commons');
    await credit.scrollIntoViewIfNeeded();
    expect(await sheet.locator('.dlg-box').evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await expect(credit.getByRole('link', { name: 'Wikimedia Commons' })).toHaveAttribute('href', commons('Flag of Cambodia (1992–1993).svg'));
  });

  test('shows the restored Bulgarian tricolour and only a selection of US star counts', async ({ page }) => {
    await seed(page, { lang: 'en' });
    const sheet = await openSheet(page, '/flags/countries/BG');
    const times = sheet.locator('.fp-times');
    await expect(times.locator('.fp-when').last()).toHaveText('Since 1990');
    await expect(times.locator('li').nth(1).locator('.fp-credit')).toContainText('Scroch · CC BY-SA 4.0');
    await openSheet(page, '/flags/countries/US');
    await expect(times.locator('ol > li')).toHaveCount(6);
    await expect(sheet.locator('.fp-flown')).toHaveCount(0);
    await expect(times.locator('.fp-when').nth(3)).toHaveText('1861–1863');
    await expect(times.locator('.fp-when').last()).toHaveText('Since 1960');
    await expect(times.locator('.fp-note')).toContainText('49-star flag used from July 1959 to July 1960');
    await openSheet(page, '/flags/countries/BY');
    await expect(times.locator('.fp-when').nth(5)).toHaveText('1991–1995');
    await expect(times.locator('.fp-when').last()).toHaveText('Since 2012');
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
    await expect(sheet.locator('.fp-times .fp-when').first()).toHaveText('1701–1760');
    await expect(sheet.locator('.fp-times .fp-when').last()).toHaveText('Since 1981');
    await expect(sheet.locator('.fp-times h4').first()).toHaveText("Philip V's naval ensign");
    await expect(sheet.locator('.fp-times li img').first()).toHaveAttribute('alt', "Flag of Spain: Philip V's naval ensign (1701–1760)");
    await expect(sheet.locator('.fp-times li').nth(1).locator('.fp-time-text')).toContainText('The king therefore chose a red-and-yellow one');
    await expect(sheet.locator('.fp-times .fp-note')).toContainText('naval ensigns, not national flags');
    await expect(sheet.locator('.fp-times').getByRole('link', { name: 'See the source' })).toHaveAttribute('href', 'https://en.wikipedia.org/wiki/Flag_of_Spain');
    await expect(sheet.locator('.fp-foot')).toContainText('The timeline is written for the game from the source linked beside it.');
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
    // The country with the most catalogue flags now has a selected, narrated history rather than unchecked years.
    await open(page, '/banderas/paises/US');
    await expect(sheet.locator('.fp-times ol > li')).toHaveCount(sheetFile('US').times!.length);
    await expect(sheet.locator('.fp-flown')).toHaveCount(0);
    await expect(sheet.locator('.fp-flag-facts dd').first()).toHaveText('14 de junio de 1777');
    // A land with no flag of its own and nobody who lives there says whose it is, and little else.
    await open(page, '/banderas/paises/BV');
    await expect(sheet.locator('.fp-official')).toHaveText('Bouvetøya');
    await expect(sheet.locator('.fp-official')).toHaveAttribute('lang', 'nb');
    await expect(sheet.locator('.fp-glance .fp-owner a')).toHaveText('Noruega');
    await expect(sheet.locator('.fp-flag-facts .fp-owner a')).toHaveText('Noruega');
    await expect(sheet.locator('.fp-nb')).toHaveCount(0);
    // Even an uninhabited territory now has its own photograph instead of the colours of its flag.
    await expect(sheet.locator('.fp-band')).toHaveCount(0);
    const hero = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(hero)).toBe(true);
    const [picture, over, wide] = [(await hero.boundingBox())!, (await sheet.locator('.fp-flag').boundingBox())!, (await sheet.locator('.dlg-box').boundingBox())!];
    expect(Math.round(picture.width)).toBe(Math.round(wide.width));
    expect(over.y).toBeLessThan(picture.y + picture.height);
    expect(over.y + over.height).toBeGreaterThan(picture.y + picture.height);
    await expect(sheet.locator('.fp-foot')).toContainText('Las fotografías son de Wikimedia Commons');

    // And one with no flag that is official says so.
    await open(page, '/banderas/paises/AQ');
    await expect(sheet.locator('.fp-flag-facts dt')).toHaveText(['Colores', 'Diseño de']);
    await expect(sheet.locator('.fp-flag-facts dd').last()).toContainText('la Antártida no tiene bandera oficial');
  });

  test('fills a phone with nothing wider than the screen, with territorial and State photographs from side to side @movil', async ({ page }) => {
    await seed(page);
    // A territory without inhabitants has a photograph as wide as the screen, the flag over its foot.
    const sheet = await openSheet(page, '/banderas/paises/BV');
    const screen = page.viewportSize()!;
    await expect(sheet.locator('.fp-band')).toHaveCount(0);
    const territory = sheet.locator('.fp-hero img');
    await expect.poll(() => drawn(territory)).toBe(true);
    const pictureOfTerritory = (await territory.boundingBox())!;
    expect([Math.round(pictureOfTerritory.x), Math.round(pictureOfTerritory.width)]).toEqual([0, screen.width]);
    const over = (await sheet.locator('.fp-flag').boundingBox())!;
    expect(over.y).toBeLessThan(pictureOfTerritory.y + pictureOfTerritory.height);
    expect(over.y + over.height).toBeGreaterThan(pictureOfTerritory.y + pictureOfTerritory.height);
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
    // The figures two abreast; the narrated flags one below the other, with text beside them; neighbours wrap.
    const facts = await sheet.locator('.fp-glance .fp-facts > div').evaluateAll((rows) => rows.slice(0, 4).map((row) => Math.round(row.getBoundingClientRect().left)));
    expect(new Set(facts).size).toBe(2);
    await expect(sheet.locator('.fp-times ol > li')).toHaveCount(9);
    const stops = await sheet.locator('.fp-times ol > li').evaluateAll((items) => items.map((item) => Math.round(item.getBoundingClientRect().left)));
    expect(new Set(stops).size).toBe(1);
    const [oldFlag, oldText] = [(await sheet.locator('.fp-time-flag').first().boundingBox())!, (await sheet.locator('.fp-time-text').first().boundingBox())!];
    expect(oldText.x).toBeGreaterThanOrEqual(oldFlag.x + oldFlag.width);
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
