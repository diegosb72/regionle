/**
 * What is said of each country besides its figures: the currency it pays with, its official languages, its
 * internet domain and its dialling code (public/data/facts.json, fetched only where it is needed). A game of
 * the countries asks one of them of each country; "pin it" can show a domain or a dialling code for the
 * country to be found; the card of "explore" has the four, and "who am I?" speaks of two.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start, type } from './helpers';

interface Rec {
  m?: string[];
  l?: string[];
  d?: string;
  p?: string[];
}
const file = JSON.parse(fs.readFileSync('public/data/facts.json', 'utf8')) as { c: Record<string, Rec>; m: Record<string, string[]>; l: Record<string, string[]> };
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: { id: string; n: { es: string; en: string } }[] };
const idOf = (name: string): string => index.countries.find((c) => c.n.es === name || c.n.en === name)!.id;
const nameOf = (id: string): string => index.countries.find((c) => c.id === id)!.n.es;
/** What a question gives for an answer: the currency by its plain name, the first of the languages, the domain, the first code. */
const coin = (id: string): string => file.m[file.c[id].m![0]][2];
const tongue = (id: string): string => file.l[file.c[id].l![0]][0];
const domain = (id: string): string => file.c[id].d!;
const dial = (id: string): string => `+${file.c[id].p![0]}`;

const GAME = { section: 'countries', mode: 'fact' };
const which = (page: Page) => page.getByRole('radiogroup', { name: 'Qué dato se pregunta' });
const shown = (page: Page) => page.getByRole('radiogroup', { name: 'Qué se muestra' });
/** What is said under a choice of the setup screen. */
const hintOf = (page: Page, group: ReturnType<typeof which>) => page.locator('.opt', { has: group }).locator('.opt-hint');
const kicker = (page: Page) => page.locator('.q-prompt > .kicker');
const subtitle = (page: Page) => page.locator('.play-title span');
const hud = (page: Page) => page.locator('.hud-main');
const verdict = (page: Page) => page.locator('.verdict-head');
const note = (page: Page) => page.locator('.q-note');
const piece = (page: Page, id: string) => page.locator(`.map-svg [data-id="${id}"]`).first();
/** The country a question is about. */
const asked = async (page: Page): Promise<string> => idOf(((await page.locator('.q-name').textContent()) ?? '').trim());
const next = (page: Page) => page.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ }).click();
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { opts: Record<string, unknown>; best: Record<string, unknown> });

test.describe('the game of the facts of the countries: where it is chosen', () => {
  test('is one of the games of the countries, asks one of four things and keeps the one chosen', async ({ page }) => {
    await seed(page, { mode: { countries: 'fact' } });
    await open(page, '/paises');
    await expect(page.locator('.mode-about')).toContainText('De cada país, un dato: su moneda, su idioma oficial, su dominio de internet o su prefijo telefónico.');
    await expect(which(page).getByRole('radio')).toHaveText(['Moneda', 'Idioma', 'Dominio', 'Prefijo']);
    await expect(which(page).getByRole('radio', { name: 'Moneda' })).toBeChecked();
    // Europe, as the countries open: no currency of it is named after its country.
    await expect(hintOf(page, which(page))).toHaveText('La moneda de cada país, por su nombre a secas: «dólar», «franco», «peso».');
    await expect(page.locator('.mode-facts')).toContainText('44 preguntas');

    await which(page).getByRole('radio', { name: 'Dominio' }).click();
    await expect(hintOf(page, which(page))).toHaveText('El dominio de internet de cada país: «.es», «.fr».');
    await expect(page.locator('.setup')).toContainText('Con su punto o sin él: «.es» y «es» valen lo mismo.');
    await which(page).getByRole('radio', { name: 'Prefijo' }).click();
    await expect(hintOf(page, which(page))).toHaveText('El prefijo telefónico de cada país: «+34», «+33».');
    await expect(page.locator('.setup')).toContainText('Con el signo más o sin él: «+34» y «34» valen lo mismo.');

    // The French of France would answer itself: it is said how many countries are left to ask.
    await which(page).getByRole('radio', { name: 'Idioma' }).click();
    await expect(hintOf(page, which(page))).toHaveText(
      'El idioma oficial de cada país. Donde hay varios, escribiendo vale cualquiera. Se pregunta de 16 de los 44 países: de los demás lo dice ya su nombre, o no lo tenemos.',
    );
    await expect(page.locator('.mode-facts')).toContainText('16 preguntas');

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('¿Qué idioma es oficial en…?', { timeout: 30_000 });
    await expect(page.locator('.play-title')).toContainText('Datos del país');
    await expect(subtitle(page)).toHaveText('Europa · 44 países · idioma');
    await expect(hud(page)).toHaveText('1 / 16');
    // None of the sixteen is named after its language.
    const id = await asked(page);
    expect(nameOf(id).slice(0, 3).toLowerCase()).not.toBe(tongue(id).slice(0, 3));

    await open(page, '/paises');
    await expect(which(page).getByRole('radio', { name: 'Idioma' })).toBeChecked();
    expect((await kept(page)).opts.fact).toBe('language');
  });

  test('does not start where the countries chosen leave nothing to ask', async ({ page }) => {
    // French, Spanish and German: each said by the name of its country.
    await seed(page, { mode: { countries: 'fact' }, sel: { countries: ['FR', 'ES', 'DE'] }, opts: { ...OPTS, fact: 'language' } });
    await open(page, '/paises');
    await expect(page.locator('.startbar .problem')).toHaveText('Con estos países no queda nada que preguntar de ese dato: lo dice ya el nombre de cada uno, lo comparten o no lo tienen. Elige más países u otro dato.');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    // Their currency can be asked: it is the same, but it is not in their names.
    await which(page).getByRole('radio', { name: 'Moneda' }).click();
    await expect(page.locator('.startbar .problem')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
  });

  test('says so too when such a game comes from a link', async ({ page }) => {
    await start(page, { ...GAME, countries: ['FR', 'ES', 'DE'], opts: { fact: 'language', length: 'all' } });
    await expect(page.locator('main')).toContainText('Aquí no hay nada que preguntar');
    await expect(page.locator('main')).toContainText('Prueba con más países o con otro dato.');
  });
});

test.describe('the game of the facts of the countries: four options', () => {
  test('offers four different answers, the right one among them, and never another thing that is true of the country', async ({ page }) => {
    const ten = ['PA', 'UZ', 'KG', 'GB', 'JP', 'CH', 'US', 'MX', 'CO', 'CR'];
    await start(page, { ...GAME, countries: ten, opts: { fact: 'currency', answer: 'choice', length: 'all' } });
    await expect(kicker(page)).toHaveText('¿Qué moneda se usa en…?');
    for (let n = 1; n <= ten.length; n++) {
      await expect(hud(page)).toHaveText(`${n} / 10`);
      const id = await asked(page);
      const options = await page.locator('.choice span').allTextContents();
      expect(options, nameOf(id)).toHaveLength(4);
      expect(new Set(options).size, nameOf(id)).toBe(4);
      expect(options, nameOf(id)).toContain(coin(id));
      // Panama pays with the balboa and with the dollar: the dollar is not offered against the balboa.
      if (id === 'PA') expect(options).not.toContain('dólar');
      // Whoever types «som» for the sum of Uzbekistan is right: the som of Kyrgyzstan cannot stand beside it.
      if (id === 'UZ') expect(options).not.toContain('som');
      if (n % 2) {
        await page.locator('.choice', { hasText: coin(id) }).click();
        // Once the question is settled, everything the country has is said.
        await expect(verdict(page)).toHaveText(id === 'PA' ? '¡Correcto! balboa y dólar' : `¡Correcto! ${coin(id)}`);
      } else {
        await page.locator('.choice').filter({ hasNotText: coin(id) }).first().click();
        await expect(verdict(page)).toHaveText(id === 'PA' ? 'Era balboa y dólar' : `Era ${coin(id)}`);
      }
      await next(page);
    }
    // What was missed comes back at the end, as in any other game.
    await expect(page.locator('.q-round')).toHaveText('Repaso de fallos · quedan 5');
  });

  test('names a language by the first of the country, and tells them all afterwards', async ({ page }) => {
    await start(page, { ...GAME, countries: ['BE', 'CH', 'AT', 'IE', 'CY', 'LU', 'MX', 'BR'], opts: { fact: 'language', answer: 'choice', length: 'all' } });
    const all: Record<string, string> = { BE: 'neerlandés, francés y alemán', CH: 'alemán, francés e italiano', AT: 'alemán', IE: 'inglés e irlandés', CY: 'griego y turco', LU: 'francés, luxemburgués y alemán', MX: 'español', BR: 'portugués' };
    for (let n = 1; n <= 8; n++) {
      await expect(hud(page)).toHaveText(`${n} / 8`);
      const id = await asked(page);
      const options = await page.locator('.choice span').allTextContents();
      expect(new Set(options).size, nameOf(id)).toBe(4);
      expect(options, nameOf(id)).toContain(tongue(id));
      // No other language of the country is among the wrong ones: nor French in Belgium, nor German in Luxembourg.
      for (const other of (file.c[id].l ?? []).slice(1)) expect(options, nameOf(id)).not.toContain(file.l[other][0]);
      await page.locator('.choice', { hasText: tongue(id) }).click();
      await expect(verdict(page)).toHaveText(`¡Correcto! ${all[id]}`);
      await next(page);
    }
    await expect(page.locator('.results-title')).toHaveText('¡Pleno!');
  });

  test('offers four domains or four dialling codes, each of a country of the map', async ({ page }) => {
    const six = ['ES', 'PT', 'FR', 'IT', 'DE', 'GB'];
    await start(page, { ...GAME, countries: six, opts: { fact: 'domain', answer: 'choice', length: 'all' } });
    await expect(kicker(page)).toHaveText('¿Cuál es el dominio de internet de…?');
    for (let n = 1; n <= 2; n++) {
      await expect(hud(page)).toHaveText(`${n} / 6`);
      const id = await asked(page);
      const options = await page.locator('.choice span').allTextContents();
      expect(new Set(options).size, nameOf(id)).toBe(4);
      expect(options, nameOf(id)).toContain(domain(id));
      for (const option of options) expect(six.map(domain), option).toContain(option);
      await page.locator('.choice', { hasText: domain(id) }).click();
      await expect(verdict(page)).toHaveText(`¡Correcto! ${domain(id)}`);
      await next(page);
    }

    await restart(page, { ...GAME, countries: six, opts: { fact: 'dial', answer: 'choice', length: 'all' } });
    await expect(kicker(page)).toHaveText('¿Cuál es el prefijo telefónico de…?');
    const id = await asked(page);
    const options = await page.locator('.choice span').allTextContents();
    expect(new Set(options).size, nameOf(id)).toBe(4);
    expect(options, nameOf(id)).toContain(dial(id));
    for (const option of options) expect(six.map(dial), option).toContain(option);
    await page.locator('.choice').filter({ hasNotText: dial(id) }).first().click();
    await expect(verdict(page)).toHaveText(`Era ${dial(id)}`);
  });

  test('asks the answer typed where the map does not give four to choose from', async ({ page }) => {
    // English, English and Spanish.
    await start(page, { ...GAME, countries: ['US', 'CA', 'MX'], opts: { fact: 'language', answer: 'choice', length: 'all' } });
    await expect(page.locator('.choice')).toHaveCount(0);
    await expect(page.locator('.answer-input')).toBeVisible();
    await expect(note(page)).toHaveText('Aquí la respuesta se escribe: este mapa no da cuatro respuestas distintas entre las que elegir.');

    // Four different languages, but one of them is spoken in the country asked: French cannot be offered as
    // wrong of Algeria, and that leaves two.
    await restart(page, { ...GAME, countries: ['DZ', 'MA', 'TN', 'FR', 'ES', 'PT'], opts: { fact: 'language', answer: 'choice', length: 'all' } });
    await expect(hud(page)).toHaveText('1 / 3');
    await expect(page.locator('.choice')).toHaveCount(0);
    await expect(note(page)).toContainText('Aquí la respuesta se escribe');
    // With Italian there are three wrong ones again.
    await restart(page, { ...GAME, countries: ['DZ', 'MA', 'TN', 'FR', 'ES', 'PT', 'IT'], opts: { fact: 'language', answer: 'choice', length: 'all' } });
    await expect(page.locator('.choice')).toHaveCount(4);
    expect(await page.locator('.choice span').allTextContents()).not.toContain('francés');
  });
});

test.describe('the game of the facts of the countries: typed', () => {
  test('takes a currency by its plain name, its whole name, more than one of it, its code and its name in English', async ({ page }) => {
    const right: Record<string, string> = { GB: 'libra esterlina', JP: 'JPY', CH: 'francos', MX: 'Mexican peso', UZ: 'som', PA: 'dólares' };
    await start(page, { ...GAME, countries: Object.keys(right), opts: { fact: 'currency', answer: 'type', length: 'all' } });
    for (let n = 1; n <= 6; n++) {
      await expect(hud(page)).toHaveText(`${n} / 6`);
      const id = await asked(page);
      await type(page, right[id]);
      await expect(verdict(page)).toHaveText(id === 'PA' ? '¡Correcto! balboa y dólar' : `¡Correcto! ${coin(id)}`);
      await next(page);
    }
    await expect(page.locator('.results-title')).toHaveText('¡Pleno!');
  });

  test('says what a wrong answer was taken for, and gives three tries', async ({ page }) => {
    // The yen, the dinar, the peso and the pound.
    await start(page, { ...GAME, countries: ['JP', 'DZ', 'DO', 'GB'], opts: { fact: 'currency', answer: 'type', length: 'all' } });
    await expect(hud(page)).toHaveText('1 / 4');
    await type(page, 'euros');
    await expect(note(page)).toHaveText('La moneda no es «euro». Te quedan 2 intentos.');
    // Something that is no currency at all.
    await type(page, 'tugrik raro');
    await expect(note(page)).toHaveText('No es correcto. Te queda 1 intento.');
    const id = await asked(page);
    await type(page, 'rupia');
    await expect(verdict(page)).toHaveText(`Era ${coin(id)}`);

    // A language that is spoken in the country without being official there is told apart from any other.
    await restart(page, { ...GAME, countries: ['DZ', 'MA'], opts: { fact: 'language', answer: 'type', length: 'all' } });
    await expect(hud(page)).toHaveText('1 / 2');
    const where = nameOf(await asked(page));
    await type(page, 'ruso');
    await expect(note(page)).toHaveText('No es el ruso. Te quedan 2 intentos.');
    await type(page, 'frances');
    await expect(note(page)).toHaveText(`El francés se habla en ${where}, pero no es oficial. Te queda 1 intento.`);
    // Any of its official languages is right, by any of its names.
    await type(page, 'bereber');
    await expect(verdict(page)).toHaveText('Bien, con ayuda: árabe y tamazight');

    // One that is official in part of the country is right too, though it is never the answer shown.
    await restart(page, { ...GAME, countries: ['CH', 'AT'], opts: { fact: 'language', answer: 'type', length: 'all' } });
    for (let n = 1; n <= 2; n++) {
      await expect(hud(page)).toHaveText(`${n} / 2`);
      if ((await asked(page)) === 'CH') {
        await type(page, 'romanche');
        await expect(verdict(page)).toHaveText('¡Correcto! alemán, francés e italiano');
      } else {
        await type(page, 'aleman');
        await expect(verdict(page)).toHaveText('¡Correcto! alemán');
      }
      await next(page);
    }
  });

  test('takes a domain with its dot or without it, and says whose another one is', async ({ page }) => {
    await start(page, { ...GAME, countries: ['ES', 'PT', 'CH', 'DE'], opts: { fact: 'domain', answer: 'type', length: 'all' } });
    await expect(kicker(page)).toHaveText('¿Cuál es el dominio de internet de…?');
    for (let n = 1; n <= 4; n++) {
      await expect(hud(page)).toHaveText(`${n} / 4`);
      const id = await asked(page);
      const other = id === 'PT' ? 'ES' : 'PT';
      await type(page, domain(other).slice(1).toUpperCase());
      await expect(note(page)).toHaveText(`«${domain(other)}» es el dominio de ${nameOf(other)}. Te quedan 2 intentos.`);
      // One that is of no country of the map.
      await type(page, '.xx');
      await expect(note(page)).toHaveText('No es correcto. Te queda 1 intento.');
      await type(page, n % 2 ? domain(id) : domain(id).slice(1).toUpperCase());
      await expect(verdict(page)).toHaveText(`Bien, con ayuda: ${domain(id)}`);
      await next(page);
    }
  });

  test('takes a dialling code with its plus, with two zeros or bare, and speaks of digits in its hints', async ({ page }) => {
    await start(page, { ...GAME, countries: ['ES', 'PT', 'FR', 'DO'], opts: { fact: 'dial', answer: 'type', length: 'all' } });
    await expect(kicker(page)).toHaveText('¿Cuál es el prefijo telefónico de…?');
    await expect(page.locator('.q-actions button')).toHaveText(['Una cifra', 'Cuántas cifras', 'No lo sé', 'Terminar']);
    const typedAs: Record<string, string> = { ES: '0034', PT: '+351', FR: '33', DO: '1-829' };
    for (let n = 1; n <= 4; n++) {
      await expect(hud(page)).toHaveText(`${n} / 4`);
      const id = await asked(page);
      if (n === 1) {
        await page.getByRole('button', { name: 'Cuántas cifras' }).click();
        const digits = dial(id).replace(/\D/g, '').length;
        await expect(page.locator('.q')).toContainText(`Tiene ${digits} cifras.`);
        // The plus is given: what is left to write are the digits.
        if (id !== 'DO') await expect(page.locator('.q-letters')).toHaveText(`+ ${Array(digits).fill('_').join(' ')}`);
      }
      const other = id === 'FR' ? 'ES' : 'FR';
      await type(page, dial(other));
      await expect(note(page)).toContainText(`«${dial(other)}» es el prefijo de ${nameOf(other)}.`);
      await type(page, typedAs[id]);
      // The Dominican Republic has two: either is right, and both are told.
      await expect(verdict(page)).toHaveText(id === 'DO' ? 'Bien, con ayuda: +1 809 y +1 829' : `Bien, con ayuda: ${dial(id)}`);
      await next(page);
    }
  });

  test('offers the names of the currencies while one is typed, each once', async ({ page }) => {
    await start(page, { ...GAME, countries: ['CH', 'JP'], opts: { fact: 'currency', answer: 'type', length: 'all', suggest: true } });
    await page.locator('.answer-input').fill('fra');
    // Seven francs in the world, and one name for them all.
    await expect(page.getByRole('option')).toHaveText(['franco']);
    await page.locator('.answer-input').fill('din');
    await expect(page.getByRole('option')).toHaveText(['dinar']);
    await page.locator('.answer-input').fill('ye');
    await expect(page.getByRole('option', { name: 'yen', exact: true })).toBeVisible();
  });

  test('is marked in an exam with what was answered, by its name', async ({ page }) => {
    await start(page, { ...GAME, countries: ['PA', 'GB', 'JP', 'CH'], opts: { fact: 'currency', answer: 'type', length: 'all', format: 'exam' } });
    const given: Record<string, string> = { PA: 'dólares', GB: 'libra esterlina', JP: 'euros', CH: 'tugrik raro' };
    for (let n = 1; n <= 4; n++) {
      await expect(hud(page)).toHaveText(`${n} / 4`);
      await type(page, given[await asked(page)]);
    }
    await expect(page.locator('.results-title')).toHaveText('Nota: 5');
    const rows = page.locator('.results-group li .row-name');
    await expect(rows.filter({ hasText: 'Japón' })).toHaveText('Japónyen · respondiste «euro»');
    await expect(rows.filter({ hasText: 'Suiza' })).toHaveText('Suizafranco · respondiste «tugrik raro»');
    // The right ones are listed with what each has.
    await expect(rows.filter({ hasText: 'Panamá' })).toHaveText('Panamábalboa');
    await expect(rows.filter({ hasText: 'Reino Unido' })).toHaveText('Reino Unidolibra');
  });
});

test.describe('the game of the facts of the countries: what it leaves behind', () => {
  test('is told apart by its fact among the games played, and is offered again with it', async ({ page }) => {
    await start(page, { ...GAME, countries: ['GB', 'JP'], opts: { fact: 'currency', answer: 'type', length: 'all' } });
    await expect(subtitle(page)).toHaveText('2 países · moneda');
    for (let n = 1; n <= 2; n++) {
      await expect(hud(page)).toHaveText(`${n} / 2`);
      await type(page, coin(await asked(page)));
      await next(page);
    }
    await expect(page.locator('.results-title')).toHaveText('¡Pleno!');

    await open(page, '/progreso');
    const last = page.locator('.block', { hasText: 'Últimas partidas' }).locator('tbody tr').first();
    await expect(last).toContainText('Datos del país');
    await expect(last).toContainText('2 países · moneda');

    await open(page);
    const again = page.locator('.recent-list li').first();
    await expect(again.locator('.recent-what')).toHaveText('Países · Datos del país · moneda');
    await expect(again.locator('.recent-go')).toHaveText('Jugar otra vez');
    await again.getByRole('button').click();
    await expect(kicker(page)).toHaveText('¿Qué moneda se usa en…?', { timeout: 30_000 });
  });

  test('travels in a challenge link with its fact, whatever the receiver had chosen', async ({ page, browser }) => {
    // The link is copied: kept here instead, to open it as someone else.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (text: string) => ((window as unknown as { copied: string }).copied = text) && Promise.resolve() },
      });
    });
    const five = ['DZ', 'AT', 'MX', 'BR', 'IE'];
    await start(page, { ...GAME, countries: five, opts: { fact: 'language', answer: 'type', length: 'all' } });
    const sent: string[] = [];
    for (let n = 1; n <= five.length; n++) {
      await expect(hud(page)).toHaveText(`${n} / 5`);
      const id = await asked(page);
      sent.push(id);
      await type(page, tongue(id));
      await next(page);
    }
    await page.locator('.duel-send input').fill('Ana');
    await page.getByRole('button', { name: 'Retar a alguien' }).click();
    await expect(page.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied);
    expect(copied).toContain('Ana te reta en Regionle ∞: 5 países · Datos del país · idioma.');
    const link = /https?:\S+$/.exec(copied)![0];

    // Someone else, who had the game set to dialling codes among four options.
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES' });
    const other = await context.newPage();
    await seed(other, { opts: { ...OPTS, answer: 'choice', fact: 'dial' } });
    await other.goto(link);
    await expect(other.locator('.duel-page h1')).toHaveText('Ana te reta');
    await expect(other.locator('.duel-what')).toContainText('Países · Datos del país · idioma · todas las preguntas · escribiendo');
    await other.getByRole('button', { name: 'Aceptar el reto' }).click();
    await expect(kicker(other)).toHaveText('¿Qué idioma es oficial en…?', { timeout: 30_000 });
    const got: string[] = [];
    for (let n = 1; n <= five.length; n++) {
      await expect(hud(other)).toHaveText(`${n} / 5`);
      got.push(await asked(other));
      await other.getByRole('button', { name: 'No lo sé' }).click();
      await other.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ }).click();
    }
    expect(got).toEqual(sent);
    await context.close();
  });

  test('is played in English with the names of English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { ...GAME, countries: ['DZ', 'ZA'], levels: {}, nonce: 1, opts: { ...OPTS, fact: 'language', answer: 'type', length: 'all' } } });
    await page.goto('./#/jugar');
    await expect(kicker(page)).toHaveText('Which language is official in…?', { timeout: 30_000 });
    await expect(subtitle(page)).toHaveText('2 countries · language');
    for (let n = 1; n <= 2; n++) {
      await expect(hud(page)).toHaveText(`${n} / 2`);
      const id = await asked(page);
      if (id === 'DZ') {
        await type(page, 'french');
        await expect(note(page)).toHaveText('French is spoken in Algeria, but it is not official. 2 tries left.');
        await type(page, 'arabic');
        await expect(verdict(page)).toHaveText('Right, with help: Arabic and Tamazight');
      } else {
        // The name in Spanish is taken as well.
        await type(page, 'zulú');
        await expect(verdict(page)).toHaveText('Correct! English, Zulu, Xhosa, Afrikaans, Northern Sotho, Tswana, Southern Sotho, Tsonga, Swati, Venda and South Ndebele');
      }
      await page.getByRole('button', { name: 'Next' }).click();
    }
  });
});

test.describe('"pin it" by a domain or a dialling code', () => {
  test('is offered beside the name, the capital and the flag, and says which countries it cannot ask', async ({ page }) => {
    await seed(page, { mode: { countries: 'pin' }, sel: { countries: ['US', 'CA', 'MX', 'DE', 'AT'] } });
    await open(page, '/paises');
    await expect(shown(page).getByRole('radio')).toHaveText(['El nombre', 'La capital', 'La bandera', 'El dominio', 'El prefijo']);
    await expect(hintOf(page, shown(page))).toHaveCount(0);

    await shown(page).getByRole('radio', { name: 'El dominio' }).click();
    await expect(hintOf(page, shown(page))).toHaveText('Te damos un dominio de internet («.de») y señalas de qué país es.');
    await expect(page.locator('.mode-facts')).toContainText('5 preguntas');
    // Canada and the United States share their code: neither can be found by it.
    await shown(page).getByRole('radio', { name: 'El prefijo' }).click();
    await expect(hintOf(page, shown(page))).toHaveText(
      'Te damos un prefijo telefónico («+49») y señalas de qué país es. Se pregunta por 3 de los 5 países: los demás lo comparten con otro del mapa, o no lo tienen.',
    );
    await expect(page.locator('.mode-facts')).toContainText('3 preguntas');

    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(kicker(page)).toHaveText('Señala el país de este prefijo telefónico', { timeout: 30_000 });
    const seen: string[] = [];
    for (let n = 1; n <= 3; n++) {
      await expect(hud(page)).toHaveText(`${n} / 3`);
      const code = ((await page.locator('.q-name').textContent()) ?? '').trim();
      seen.push(code);
      const id = ['MX', 'DE', 'AT'].find((c) => dial(c) === code)!;
      if (n === 1) {
        // A wrong country is told with its own code: that is what there is to learn.
        const wrong = id === 'DE' ? 'AT' : 'DE';
        await piece(page, wrong).dispatchEvent('click');
        await expect(note(page)).toContainText(`Eso es ${nameOf(wrong)} (${dial(wrong)}).`);
      }
      await piece(page, id).dispatchEvent('click');
      await expect(verdict(page)).toContainText(n === 1 ? 'Bien, con ayuda:' : '¡Correcto!');
      await next(page);
    }
    expect(seen.sort()).toEqual(['+43', '+49', '+52']);
    expect((await kept(page)).opts.pinBy).toBe('dial');
  });

  test('offers the name of the country among its hints, since the question does not write it', async ({ page }) => {
    const map = ['ES', 'PT', 'FR', 'IT'];
    await start(page, { section: 'countries', mode: 'pin', countries: map, opts: { pinBy: 'dial', length: 'all' } });
    await expect(kicker(page)).toHaveText('Señala el país de este prefijo telefónico');
    const code = ((await page.locator('.q-name').textContent()) ?? '').trim();
    const id = map.find((c) => dial(c) === code)!;
    await page.getByRole('button', { name: 'Otra pista' }).click();
    const menu = page.locator('.q-more');
    // Its capital and its name are there to be asked for: the question shows neither.
    await expect(menu.getByRole('button', { name: 'Su capital' })).toBeVisible();
    await menu.getByRole('button', { name: 'Su nombre' }).click();
    await expect(page.locator('.q-hints li')).toHaveText([`Se llama ${nameOf(id)}.`]);
    await piece(page, id).dispatchEvent('click');
    await expect(verdict(page)).toContainText('Bien, con ayuda:');
  });

  test('shows the domain and takes the country it is of', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'pin', countries: ['ES', 'PT', 'FR', 'IT'], opts: { pinBy: 'domain', length: 'all' } });
    await expect(kicker(page)).toHaveText('Señala el país de este dominio de internet');
    for (let n = 1; n <= 4; n++) {
      await expect(hud(page)).toHaveText(`${n} / 4`);
      const said = ((await page.locator('.q-name').textContent()) ?? '').trim();
      const id = ['ES', 'PT', 'FR', 'IT'].find((c) => domain(c) === said)!;
      await piece(page, id).dispatchEvent('click');
      await expect(verdict(page)).toHaveText('¡Correcto!');
      await next(page);
    }
    await expect(page.locator('.results-title')).toHaveText('¡Pleno!');
  });
});

test.describe('the facts of a country where they are only shown', () => {
  test('are on its card in "explore": the currency by its whole name, every official language', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'explore', countries: ['PA', 'BE', 'XK', 'ES'] });
    const card = page.locator('.datalist');
    const row = (name: string) => card.locator('div').filter({ has: page.locator('dt', { hasText: new RegExp(`^${name}$`) }) }).locator('dd');
    await piece(page, 'PA').dispatchEvent('click');
    await expect(card).toContainText('Moneda');
    await expect(row('Moneda')).toHaveText('balboa panameño y dólar estadounidense');
    await expect(row('Idioma oficial')).toHaveText('español');
    await expect(row('Dominio de internet')).toHaveText('.pa');
    await expect(row('Prefijo telefónico')).toHaveText('+507');

    await piece(page, 'BE').dispatchEvent('click');
    await expect(row('Idiomas oficiales')).toHaveText('neerlandés, francés y alemán');
    await expect(row('Moneda')).toHaveText('euro');

    // Kosovo has no domain of its own: the line is not there.
    await piece(page, 'XK').dispatchEvent('click');
    await expect(row('Prefijo telefónico')).toHaveText('+383');
    await expect(card).not.toContainText('Dominio de internet');
  });

  test('are two of the clues of "who am I?", unless the name of the country gives them away', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'whoami', countries: ['FR', 'CH', 'PA', 'BR'], opts: { length: 'all' } });
    const clues = page.locator('.clues');
    const said: Record<string, string[]> = {
      // French would say France: only its currency is told.
      FR: ['Mi moneda se llama euro.'],
      CH: ['Uno de mis idiomas oficiales es el alemán.', 'Mi moneda se llama franco.'],
      PA: ['Mi idioma oficial es el español.', 'Una de mis monedas se llama balboa.'],
      BR: ['Mi idioma oficial es el portugués.', 'Mi moneda se llama real.'],
    };
    const capital: Record<string, string> = { P: 'FR', B: 'CH', C: 'PA' };
    for (let n = 1; n <= 4; n++) {
      await expect(page.locator('.q')).toContainText('Pista 1 de');
      // Every clue up to the flag: after it there is only how the name begins.
      for (let i = 0; i < 12 && !/Esta es mi bandera/.test(await clues.innerText()); i++) await page.getByRole('button', { name: 'Otra pista' }).click();
      const text = await clues.innerText();
      const letter = /Mi capital empieza por «(.)»/.exec(text)![1];
      // Bern and Brasilia begin alike: the franc tells them apart.
      const id = letter === 'B' ? (text.includes('franco') ? 'CH' : 'BR') : capital[letter];
      for (const line of said[id]) expect(text, id).toContain(line);
      if (id === 'FR') expect(text).not.toContain('idioma');
      // On a map of four countries none of this is of many: it is told late, between the capital and the flag.
      const at = (line: string) => text.indexOf(line);
      for (const line of said[id]) {
        expect(at(line), `${id}: ${line}`).toBeGreaterThan(at('Mi capital empieza por'));
        expect(at(line), `${id}: ${line}`).toBeLessThan(at('Esta es mi bandera'));
      }
      await type(page, nameOf(id));
      await page.getByRole('button', { name: /^(Siguiente|Ver resultado)$/ }).click();
    }
  });
});

test.describe('the game of the facts of the countries: against the clock, with lives and for two', () => {
  const FIVE = ['ES', 'FR', 'DE', 'IT', 'PT'];
  const title = (page: Page) => page.locator('.results-title');
  /** Types the right answer; the next question, or the result, is there when it comes back. */
  const hit = async (page: Page, answer: (id: string) => string): Promise<void> => {
    const name = page.locator('.q-name');
    const now = ((await name.textContent()) ?? '').trim();
    await type(page, answer(await asked(page)));
    await expect(title(page).or(name.filter({ hasNotText: now }))).toBeVisible();
  };

  test('is played against the clock, with a record for each fact', async ({ page }) => {
    await page.clock.install();
    await start(page, { ...GAME, countries: FIVE, opts: { fact: 'domain', answer: 'type', format: 'timed' } });
    await expect(page.locator('.hud-clock')).toHaveText('1:00');
    await expect(kicker(page)).toHaveText('¿Cuál es el dominio de internet de…?');
    await hit(page, domain);
    await hit(page, domain);
    await page.clock.fastForward(61_000);
    await expect(title(page)).toHaveText('2 aciertos en un minuto');
    await expect(page.locator('.results-note')).toHaveText('Nuevo récord de contrarreloj en este mapa.');
    // The record is that of the domains of this map: the dialling codes have theirs.
    const timed = Object.keys((await kept(page)).best).filter((k) => k.startsWith('timed'));
    expect(timed).toHaveLength(1);
    expect(timed[0]).toMatch(/^timed:fact-domain:/);
  });

  test('is a survival too: a wrong answer costs a life', async ({ page }) => {
    await start(page, { ...GAME, countries: FIVE, opts: { fact: 'dial', answer: 'type', format: 'lives', lives: 1 } });
    await expect(page.locator('.hud-lives')).toHaveAccessibleName('Vidas: 1 de 1');
    await hit(page, dial);
    await type(page, '+999');
    await expect(page.locator('.verdict')).toContainText('Te has quedado sin vidas.');
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(title(page)).toHaveText('1 acierto');
    const lives = Object.keys((await kept(page)).best).filter((k) => k.startsWith('lives'));
    expect(lives).toHaveLength(1);
    expect(lives[0]).toMatch(/^lives1:fact-dial:/);
  });

  test('is played by two, a question each', async ({ page }) => {
    await start(page, { ...GAME, countries: FIVE, opts: { fact: 'domain', answer: 'type', format: 'duo', length: 'all' } });
    // Five countries: four questions, two for each.
    await expect(hud(page)).toHaveText('1 / 4', { timeout: 30_000 });
    await expect(page.locator('.q .duo-turn')).toHaveText('Turno de Jugador 1');
    await type(page, domain(await asked(page)));
    // Right at once: two points, and the turn passes by itself.
    await expect(hud(page)).toHaveText('2 / 4');
    await expect(page.locator('.q .duo-turn')).toHaveText('Turno de Jugador 2');
    const points = (await page.locator('.play-under .duo-board .duo-pts').allTextContents()).map((t) => Number.parseInt(t, 10));
    expect(points).toEqual([2, 0]);
  });
});

test.describe('the facts of the countries with a list of the player', () => {
  /** The map the list was made on, and the countries of it that the list asks about. */
  const NORTH = ['US', 'CA', 'MX', 'GT', 'BZ'];
  const list = (ids: string[], countries = NORTH) => ({ id: 'l1', name: 'Las del martes', section: 'countries', countries, levels: {}, ids });
  const begin = (page: Page) => page.locator('.startbar').getByRole('button', { name: 'Empezar' });

  test('"pin it" asks the countries of the list that share their code with no other of its map', async ({ page }) => {
    // Canada is not in the list, but it is on its map: the +1 of the United States could be either.
    await seed(page, { lists: [list(['US', 'MX', 'GT'])], listOn: { countries: 'l1' }, mode: { countries: 'pin' }, opts: { ...OPTS, pinBy: 'dial', length: 'all' } });
    await open(page, '/paises');
    await expect(hintOf(page, shown(page))).toHaveText(
      'Te damos un prefijo telefónico («+49») y señalas de qué país es. Se pregunta por 2 de los 3 países: los demás lo comparten con otro del mapa, o no lo tienen.',
    );
    await expect(page.locator('.mode-facts')).toContainText('2 preguntas');
    await begin(page).click();
    await expect(kicker(page)).toHaveText('Señala el país de este prefijo telefónico', { timeout: 30_000 });
    const seen: string[] = [];
    for (let n = 1; n <= 2; n++) {
      await expect(hud(page)).toHaveText(`${n} / 2`);
      const code = ((await page.locator('.q-name').textContent()) ?? '').trim();
      seen.push(code);
      await piece(page, ['MX', 'GT'].find((c) => dial(c) === code)!).dispatchEvent('click');
      await expect(verdict(page)).toHaveText('¡Correcto!');
      await next(page);
    }
    expect(seen.sort()).toEqual([dial('GT'), dial('MX')].sort());
  });

  test('does not start a list that leaves nothing to ask, and says why', async ({ page }) => {
    await seed(page, { lists: [list(['US', 'CA'])], listOn: { countries: 'l1' }, mode: { countries: 'pin' }, opts: { ...OPTS, pinBy: 'dial', length: 'all' } });
    await open(page, '/paises');
    await expect(page.locator('.startbar .problem')).toHaveText(
      'Con esta lista no queda nada que preguntar de ese dato: lo dice ya el nombre de cada país, lo comparten o no lo tienen. Elige otro dato o deja la lista.',
    );
    await expect(begin(page)).toBeDisabled();
    // Each has a domain of its own.
    await shown(page).getByRole('radio', { name: 'El dominio' }).click();
    await expect(page.locator('.startbar .problem')).toHaveCount(0);
    await expect(page.locator('.mode-facts')).toContainText('2 preguntas');
    await expect(begin(page)).toBeEnabled();
  });

  test('says so too when such a list comes as a game in course', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'pin', countries: NORTH, only: ['US', 'CA'], list: 'Las del martes', opts: { pinBy: 'dial', length: 'all' } });
    await expect(page.locator('main')).toContainText('Aquí no hay nada que preguntar');
  });

  test('is asked among four options when its own questions have three wrong answers each, whatever the rest of its map', async ({ page }) => {
    // The dollar is the other currency of Panama, which leaves it two wrong answers on this map: a list
    // without Panama is still played among four.
    const map = ['PA', 'US', 'MX', 'CR'];
    await start(page, { ...GAME, countries: map, only: ['US', 'MX', 'CR'], list: 'Sin Panamá', opts: { fact: 'currency', answer: 'choice', length: 'all' } });
    await expect(hud(page)).toHaveText('1 / 3');
    await expect(page.locator('.choice')).toHaveCount(4);
    // With Panama in the list the answer is typed.
    await restart(page, { ...GAME, countries: map, only: ['PA', 'MX'], list: 'Con Panamá', opts: { fact: 'currency', answer: 'choice', length: 'all' } });
    await expect(hud(page)).toHaveText('1 / 2');
    await expect(page.locator('.choice')).toHaveCount(0);
    await expect(note(page)).toContainText('Aquí la respuesta se escribe');
  });
});
