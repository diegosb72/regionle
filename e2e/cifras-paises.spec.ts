/**
 * The figures of the countries that come from The World Factbook: how long people live, what each one
 * makes, the median age, the share of people in towns, the children of a woman, the coast and the highest
 * point. They are in a file of their own (public/data/figures.json), fetched only where they are needed.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start, type } from './helpers';

type BookFig = 'life' | 'gdp' | 'age' | 'urban' | 'fert' | 'coast' | 'high';
const book = JSON.parse(fs.readFileSync('public/data/figures.json', 'utf8')) as { y: Partial<Record<BookFig, number>>; c: Record<string, Partial<Record<BookFig, number>>> };
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: { id: string; cl: string; pop?: number; n: { es: string } }[] };
const idOf = (name: string): string => index.countries.find((c) => c.n.es === name)!.id;
const nameOf = (id: string): string => index.countries.find((c) => c.id === id)!.n.es;
/** Every country the games of figures are played with: the ones with people. */
const WORLD = index.countries.filter((c) => c.cl !== 'other' && (c.pop ?? 0) > 0).map((c) => c.id);

const figure = (page: Page) => page.getByRole('radiogroup', { name: 'Cifra' });
const kicker = (page: Page) => page.locator('.kicker').first();
const hint = (page: Page) => page.locator('.opt-hint', { hasText: 'The World Factbook' });
/** A number as it is typed and said in Spanish. */
const es = (n: number): string => String(Math.round(n * 100) / 100).replace('.', ',');
const TEN = ['Población', 'Superficie', 'Densidad', 'Esperanza de vida', 'PIB por habitante', 'Edad mediana', 'Población urbana', 'Hijos por mujer', 'Costa', 'Punto más alto'];

test.describe('the menu of the figures of the countries', () => {
  test('offers ten of them, says where the new ones come from and keeps the one chosen', async ({ page }) => {
    await seed(page, { mode: { pops: 'hilo' } });
    await open(page, '/poblaciones');
    await expect(figure(page).getByRole('radio')).toHaveText(TEN);
    await expect(figure(page).getByRole('radio', { name: 'Población', exact: true })).toBeChecked();
    // Nothing is said of the book while the figure is one the game always had.
    await expect(hint(page)).toHaveCount(0);

    await figure(page).getByRole('radio', { name: 'Esperanza de vida' }).click();
    await expect(hint(page)).toHaveText(`Los años que se espera que viva quien nace ahora. Cifras de The World Factbook, de ${book.y.life}: cada una dice su año.`);
    await figure(page).getByRole('radio', { name: 'PIB por habitante' }).click();
    await expect(hint(page)).toContainText('en dólares de 2021, a igual poder de compra');
    // A mountain is of no year.
    await figure(page).getByRole('radio', { name: 'Punto más alto' }).click();
    await expect(hint(page)).toHaveText('La altitud del punto más alto del país. Cifras de The World Factbook.');

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('¿Llega más alto o más bajo?');
    await expect(page.locator('.pcard-value').first()).toHaveText(/^[\d.]+ m$/);
    await open(page, '/poblaciones');
    await expect(figure(page).getByRole('radio', { name: 'Punto más alto' })).toBeChecked();
  });

  test('says how many of the countries chosen have the figure, and plays with those', async ({ page }) => {
    // Two of the four have no sea.
    await seed(page, { mode: { pops: 'hilo' }, sel: { pops: ['ES', 'FR', 'CH', 'AT'] }, opts: { metric: 'coast' } });
    await open(page, '/poblaciones');
    await expect(hint(page)).toContainText('Cuanto más de cerca se mide, más larga sale');
    await expect(hint(page)).toContainText('La tienen 2 de los 4 países elegidos: se juega con esos.');
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('¿Más o menos costa?');
    await expect(page.locator('.play-title span')).toHaveText('2 países · longitud de costa');
    expect((await page.locator('.pcard h3').allInnerTexts()).sort()).toEqual(['España', 'Francia']);
    await expect(page.locator('.pcard-value').first()).toHaveText(/^[\d.]+ km de costa$/);
  });

  test('says nothing of how many have it when all of them do', async ({ page }) => {
    await seed(page, { mode: { pops: 'hilo' }, sel: { pops: ['ES', 'FR', 'PT'] }, opts: { metric: 'coast' } });
    await open(page, '/poblaciones');
    await expect(hint(page)).toHaveText('Lo que mide la costa. Cuanto más de cerca se mide, más larga sale, y no todos los países la miden igual. Cifras de The World Factbook.');
  });

  test('does not start a game that too few of the countries chosen could play, and says why', async ({ page }) => {
    await seed(page, { mode: { pops: 'hilo' }, sel: { pops: ['CH', 'BO', 'AT', 'ES'] }, opts: { metric: 'coast' } });
    await open(page, '/poblaciones');
    await expect(page.locator('.startbar')).toContainText('De los países elegidos, solo uno tiene esa cifra, y este juego pide dos: elige más países u otra cifra.');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    // What is played with is not said of a game that cannot be played.
    await expect(hint(page)).not.toContainText('se juega con');
    // All four have a highest point.
    await figure(page).getByRole('radio', { name: 'Punto más alto' }).click();
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    await expect(page.locator('.startbar')).not.toContainText('elige más países');
  });

  test('says nothing of figures in a game that is not about one', async ({ page }) => {
    await seed(page, { mode: { pops: 'truefalse' }, opts: { metric: 'life' } });
    await open(page, '/poblaciones');
    await expect(figure(page)).toHaveCount(0);
    await expect(hint(page)).toHaveCount(0);
  });

  test('offers them in English as well', async ({ page }) => {
    await seed(page, { lang: 'en', mode: { pops: 'exact' }, opts: { metric: 'fert' } });
    await open(page, '/poblaciones');
    await expect(page.getByRole('radiogroup', { name: 'Figure' }).getByRole('radio')).toHaveText(['Population', 'Area', 'Density', 'Life expectancy', 'GDP per head', 'Median age', 'Urban population', 'Children per woman', 'Coast', 'Highest point']);
    await expect(hint(page)).toHaveText(`The children a woman has in her life, on average. Figures from The World Factbook, of ${book.y.fert}: each says its year.`);
    await page.getByRole('button', { name: 'Start' }).click();
    await expect(kicker(page)).toHaveText(`How many children does a woman have, on average? (in ${book.y.fert})`);
  });

  test('fits the ten on a phone without the page scrolling sideways @movil', async ({ page }) => {
    await seed(page, { mode: { pops: 'exact' }, opts: { metric: 'gdp' } });
    await open(page, '/poblaciones');
    await expect(figure(page).getByRole('radio')).toHaveCount(10);
    await figure(page).scrollIntoViewIfNeeded();
    const wide = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(wide[0]).toBeLessThanOrEqual(wide[1]);
    const box = (await figure(page).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(wide[1]);
  });
});

test.describe('the file of the figures', () => {
  test('is not fetched until the figures are opened', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/data/figures.json')) asked.push(r.url());
    });
    await seed(page, { mode: { pops: 'hilo' } });
    await open(page, '/');
    await open(page, '/paises');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeVisible();
    expect(asked).toEqual([]);
    await open(page, '/poblaciones');
    await expect.poll(() => asked.length).toBe(1);
  });

  test('is not fetched by a game about the people of the countries', async ({ page }) => {
    const asked: string[] = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/data/figures.json')) asked.push(r.url());
    });
    await start(page, { section: 'pops', mode: 'hilo', countries: ['ES', 'FR', 'PT'], opts: { metric: 'pop' } });
    await expect(kicker(page)).toHaveText('¿Más o menos habitantes?');
    expect(asked).toEqual([]);
  });

  test('is waited for by a game about one of its figures, which offers to try again when it does not come', async ({ page }) => {
    let down = true;
    await page.route('**/data/figures.json', (route) => (down ? route.abort() : route.continue()));
    await start(page, { section: 'pops', mode: 'exact', countries: ['JP', 'ES', 'NG'], opts: { metric: 'life', length: 10 } });
    await expect(page.getByRole('heading', { name: 'No se han podido cargar las cifras' })).toBeVisible();
    await expect(page.locator('.kicker', { hasText: 'esperanza de vida' })).toHaveCount(0);
    down = false;
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(kicker(page)).toHaveText(`¿Cuál es su esperanza de vida? (en ${book.y.life})`);
  });
});

test.describe('the games of figures, by a figure of The World Factbook', () => {
  test('ask for the exact figure of its year, hint at a range of ten years and judge by years, not by shares', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'exact', countries: ['JP', 'ES', 'NG'], opts: { metric: 'life', length: 10 } });
    await expect(kicker(page)).toHaveText(`¿Cuál es su esperanza de vida? (en ${book.y.life})`);
    await expect(page.locator('.play-title span')).toHaveText('3 países · esperanza de vida');
    await expect(page.locator('.amount-unit')).toHaveText('años');
    // A year and a half over, four years under and ten under: right, close and a miss, whatever the country.
    // A tenth of the figure, which is what the people of a country are judged by, would be eight years.
    const tries: [number, (said: string) => string][] = [
      [1.5, (said) => `¡Muy cerca! Dijiste ${said} (+1,5 años)`],
      [-4, (said) => `Cerca. Dijiste ${said} (-4 años)`],
      [-10, (said) => `Dijiste ${said}: te has quedado corto por 10 años`],
    ];
    for (const [off, verdict] of tries) {
      const real = book.c[idOf(await page.locator('.pcard h3').innerText())].life!;
      // The hint is a range of ten years. (Not asked for where the guess is right: with a hint it would only be close.)
      if (off < 0) {
        await page.getByRole('button', { name: 'Pista' }).click();
        const low = Math.ceil(real / 10) * 10 - 10;
        await expect(page.locator('.q-note')).toHaveText(`Entre ${low} y ${low + 10} años.`);
      }
      await page.getByLabel('Cifra', { exact: true }).fill(es(real + off));
      await page.getByRole('button', { name: 'Comprobar' }).click();
      await expect(page.locator('.verdict-head')).toHaveText(verdict(`${es(real + off)} años`));
      await expect(page.locator('.pcard-value')).toHaveText(`${es(real)} años (${book.y.life})`);
      await page.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ }).click();
    }
    await expect(page.locator('.results')).toContainText('Acierto: a menos de 2 años de la cifra real. Cerca: a menos de 5 años.');
  });

  test('judge by shares what does not lie close together: what each person makes, to a tenth', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'exact', countries: ['ES', 'FR'], opts: { metric: 'gdp', length: 10 } });
    await expect(kicker(page)).toHaveText(`¿Cuál es su PIB por habitante? (en ${book.y.gdp})`);
    // It is typed in thousands of dollars, or one by one.
    await expect(page.getByRole('radiogroup', { name: 'Unidad' }).getByRole('radio')).toHaveText(['$', 'miles de $']);
    await expect(page.getByRole('radiogroup', { name: 'Unidad' }).getByRole('radio', { name: 'miles de $' })).toBeChecked();
    const real = book.c[idOf(await page.locator('.pcard h3').innerText())].gdp!;
    await page.getByLabel('Cifra', { exact: true }).fill(es(Math.round(real * 1.08) / 1000));
    await page.getByRole('button', { name: 'Comprobar' }).click();
    await expect(page.locator('.verdict-head')).toContainText('¡Muy cerca!');
    await expect(page.locator('.pcard-value')).toHaveText(new RegExp(`^${real.toLocaleString('de-DE')} \\$ \\(${book.y.gdp}\\)$`));
    await page.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ }).click();
    await page.getByRole('button', { name: 'Terminar' }).click();
    await expect(page.locator('.results')).toContainText('Acierto: a menos de un 10 % de la cifra real. Cerca: a menos de un 30 %.');
  });

  test('take for right, in «¿Qué país?», any country with the very figure asked about', async ({ page }) => {
    // All the people of the three live in towns.
    expect([book.c.SG.urban, book.c.MC.urban, book.c.NR.urban]).toEqual([100, 100, 100]);
    await start(page, { section: 'pops', mode: 'which', countries: ['SG', 'MC', 'NR'], opts: { metric: 'urban', length: 10 } });
    await expect(kicker(page)).toHaveText('¿Qué país tiene esta población urbana?');
    const said: string[] = [];
    // Each of the three is asked about once, and Singapore is the answer given to all.
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.bigfig')).toHaveText(`100 % (${book.y.urban})`);
      await type(page, 'Singapur');
      said.push(await page.locator('.verdict-head').innerText());
      await page.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ }).click();
    }
    expect(said.sort()).toEqual(['¡A la primera! Singapur', '¡A la primera! Singapur, que tiene la misma cifra que Mónaco', '¡A la primera! Singapur, que tiene la misma cifra que Nauru']);
    await expect(page.locator('.results')).toContainText('3 de 3');
  });

  test('say which way to look, in «¿Qué país?», in the words of the figure', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'which', countries: ['JP', 'NG'], opts: { metric: 'gdp', length: 10 } });
    await expect(kicker(page)).toHaveText('¿Qué país tiene este PIB por habitante?');
    const rich = (await page.locator('.bigfig').innerText()).startsWith(book.c.JP.gdp!.toLocaleString('de-DE'));
    await type(page, rich ? 'Nigeria' : 'Japón');
    await expect(page.locator('.which-log li')).toContainText(rich ? 'busca más PIB por habitante' : 'busca menos PIB por habitante');
  });

  test('give a place among the first, in «Los diez primeros», to any of those level at the end of the list', async ({ page }) => {
    // Spain and Italy live as long, and only one of them fits among the first three of these six.
    const life = (id: string) => book.c[id].life!;
    expect(life('ES')).toBe(life('IT'));
    expect(life('JP') > life('ES') && life('CH') > life('ES') && life('BR') < life('ES') && life('NG') < life('BR')).toBe(true);
    await start(page, { section: 'pops', mode: 'topten', countries: ['JP', 'CH', 'ES', 'IT', 'BR', 'NG'], opts: { metric: 'life' } });
    await expect(page.locator('.q-ask')).toHaveText('Los 3 primeros, de mayor a menor esperanza de vida');
    // Whichever of the two is named takes the place.
    await type(page, 'Italia');
    await expect(page.locator('.top-list li').nth(2)).toHaveText(`3Italia${es(life('IT'))} años`);
    // The other is no miss: it is as far up as the one that got the place.
    await type(page, 'España');
    await expect(page.locator('.q-note')).toHaveText('España empata con los últimos de la lista, que ya has dicho: no cuenta como fallo.');
    await expect(page.locator('.top-wrong li')).toHaveCount(0);
    // A real miss is told its place, and is counted.
    await type(page, 'Brasil');
    await expect(page.locator('.q-note')).toHaveText('Brasil no está entre los 3 primeros: es el n.º 5.');
    await expect(page.locator('.top-wrong li')).toHaveText(['Brasil n.º 5']);
    await type(page, 'Japón');
    await type(page, 'Suiza');
    await expect(page.locator('.top-list li.got b')).toHaveText(['Japón', 'Suiza', 'Italia']);
  });

  test('fill the list of «Los diez primeros» with any ten of the countries that are level for it', async ({ page }) => {
    // More than ten countries have all their people in towns.
    const full = WORLD.filter((id) => book.c[id]?.urban === 100);
    expect(full.length).toBeGreaterThan(10);
    await start(page, { section: 'pops', mode: 'topten', countries: WORLD, opts: { metric: 'urban' } });
    await expect(page.locator('.q-ask')).toHaveText('Los 10 primeros, de más a menos población urbana');
    // The last ten, with the ones the list did not hold at first.
    for (const id of full.slice(-10)) await type(page, nameOf(id));
    await expect(page.locator('.top-list li.got')).toHaveCount(10);
    // In whatever order the places were taken.
    expect((await page.locator('.top-list li.got b').allInnerTexts()).sort()).toEqual(full.slice(-10).map(nameOf).sort());
    await expect(page.locator('.top-wrong li')).toHaveCount(0);
  });

  test('keep a record of «Mayor o menor» for each figure, and name the figure among the games played lately', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'hilo', countries: ['JP', 'NG'], opts: { metric: 'life' } });
    await expect(kicker(page)).toHaveText('¿Más o menos esperanza de vida?');
    const first = await page.locator('.pcard h3').first().innerText();
    await expect(page.locator('.pcard-value').first()).toHaveText(`${es(book.c[idOf(first)].life!)} años (${book.y.life})`);
    // People live longer in Japan: right once…
    const answer = page.getByRole('button', { name: first === 'Japón' ? 'Menos esperanza de vida' : 'Más esperanza de vida' });
    await answer.click();
    // …and, once the two have changed places, the same answer is wrong.
    await expect(page.locator('.pcard h3').first()).not.toHaveText(first);
    await answer.click();
    await expect(page.locator('.results')).toBeVisible();
    await open(page, '/progreso');
    await expect(page.locator('.records li', { hasText: 'Mayor o menor' })).toHaveText(/^Mayor o menor · esperanza de vida\s*racha de 1$/);
    await open(page, '/');
    await expect(page.locator('.recent-list li').first()).toContainText('esperanza de vida');
  });

  test('put five in order by the figure', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'rank', countries: ['JP', 'NG', 'BR', 'IN', 'ES', 'US', 'TD', 'DE'], opts: { metric: 'age' } });
    await expect(kicker(page)).toHaveText('edad mediana');
    await expect(page.locator('.q-ask')).toHaveText('Toca en orden, de mayor a menor edad mediana');
  });

  test('say a coast in miles to whoever counts in miles', async ({ page }) => {
    await seed(page, { miles: true, game: { section: 'pops', mode: 'exact', countries: ['ES', 'FR'], levels: {}, nonce: 1, opts: { ...OPTS, metric: 'coast', length: 10 } } });
    await open(page, '/jugar');
    await expect(kicker(page)).toHaveText('¿Cuánto mide su costa?');
    await expect(page.getByRole('radiogroup', { name: 'Unidad' }).getByRole('radio')).toHaveText(['mi', 'miles de mi']);
    const real = book.c[idOf(await page.locator('.pcard h3').innerText())].coast!;
    await page.getByLabel('Cifra', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Comprobar' }).click();
    await expect(page.locator('.pcard-value')).toHaveText(`${Math.round(real / 1.609344)} mi de costa`);
  });

  test('cannot be played by a figure that too few of the countries have', async ({ page }) => {
    await start(page, { section: 'pops', mode: 'hilo', countries: ['CH', 'BO', 'AT', 'ES'], opts: { metric: 'coast' } });
    await expect(page.getByRole('heading', { name: 'Faltan países' })).toBeVisible();
    await expect(page.locator('main')).toContainText('Este juego necesita al menos dos países con datos.');
  });
});
