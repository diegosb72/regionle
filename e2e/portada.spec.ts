import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { PIN_SPAIN, open, seed } from './helpers';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };

test.describe('the first page and the addresses of the game', () => {
  test('opens in Spanish, with one main heading, the five sections and the flags', async ({ page }) => {
    await seed(page);
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle('Regionle ∞ — Aprende las regiones del mundo');
    await expect(page.locator('h1')).toHaveCount(1);
    for (const path of ['regiones', 'paises', 'ciudades', 'fisica', 'poblaciones', 'banderas']) await expect(page.locator(`nav.nav a[href="#/${path}"]`)).toBeVisible();
    await expect(page.locator('.sections a.scard')).toHaveCount(6);
    await expect(page.locator('.welcome')).toHaveCount(0);
  });

  test('welcomes whoever has never played, until they put the welcome away', async ({ page }) => {
    await open(page);
    const welcome = page.locator('.welcome');
    await expect(welcome).toBeVisible();
    await expect(welcome.getByRole('heading', { level: 2 })).toHaveText('Así se juega, en tres pasos');
    await welcome.getByRole('button', { name: 'Ya sé cómo va' }).click();
    await expect(welcome).toHaveCount(0);
    await page.reload();
    await expect(page.locator('.hero-title')).toBeVisible();
    await expect(welcome).toHaveCount(0);
  });

  test('gives each screen its own title, and the keyboard its start', async ({ page }) => {
    await seed(page);
    await open(page, '/regiones');
    await expect(page).toHaveTitle(/^Regiones.* — Regionle ∞$/);
    await open(page, '/acerca');
    await expect(page).toHaveTitle('Acerca de — Regionle ∞');
    await expect(page.locator('main')).toContainText(`Versión ${pkg.version}`);
    // A new screen takes the focus, so that the keyboard and a screen reader start from it.
    await expect(page.locator('main#contenido')).toBeFocused();
  });

  test('takes an old address to the one in use', async ({ page }) => {
    await seed(page);
    await open(page, '/fisico');
    await expect(page).toHaveURL(/#\/fisica$/);
    await expect(page.locator('.notfound')).toHaveCount(0);
  });

  test('says so when an address is nothing in the game', async ({ page }) => {
    await seed(page);
    await open(page, '/nada/de/nada');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Esa dirección no existe');
    await expect(page).toHaveTitle('Dirección desconocida — Regionle ∞');
    await page.getByRole('link', { name: 'Ir al inicio' }).click();
    await expect(page.locator('.hero-title')).toBeVisible();
  });

  test('says so when the code of the games does not come, with the page to load again, and does not go on asking for it', async ({ page }) => {
    // The download is cut every time. A browser that asks again for a file that failed used to be asked for
    // it without end, and the message to wait never gave way to this one.
    let asked = 0;
    await page.route('**/assets/Play-*.js', (route) => {
      asked += 1;
      return route.abort();
    });
    await seed(page, { game: PIN_SPAIN, helpAuto: false });
    await page.goto('./#/jugar');
    await expect.poll(() => asked, { message: 'the code of the games is asked for' }).toBeGreaterThan(0);
    /** What the page says, so that a failure here tells what was there instead. */
    const said = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    await expect.poll(said, { timeout: 30_000 }).toContain('Esta parte del juego no ha llegado a cargarse');
    const crash = page.locator('.crash');
    await expect(crash).toContainText('Suele ser la conexión, o que hay una versión nueva del juego. Recarga la página y vuelve a intentarlo.');
    await expect(crash).toContainText('Tu progreso está a salvo');
    await expect(crash.getByRole('button', { name: 'Recargar la página' })).toBeVisible();
    // Trying again what did not come asks for nothing new: that button is for a mistake of the game.
    await expect(crash.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
    // The screen asked for it once; the fetch ahead of time of the other screens may ask once more.
    await page.waitForTimeout(2000);
    expect(asked).toBeLessThan(5);

    // The start is a way out, and the page loaded again brings the game when its code comes.
    await crash.getByRole('link', { name: 'Ir al inicio' }).click();
    await expect(page.locator('.hero-title')).toBeVisible();
    await page.unroute('**/assets/Play-*.js');
    await page.goto('./#/jugar');
    await page.reload();
    await expect(page.locator('.q')).toContainText('Te quedan 3 intentos', { timeout: 30_000 });
  });

  test('says so when a game breaks, with the ways out of it together at the top', async ({ page }) => {
    // The code of the games arrives broken: it fails as it starts.
    let asked = 0;
    await page.route('**/assets/Play-*.js', (route) => {
      asked += 1;
      return route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("roto a propósito");' });
    });
    await seed(page, { game: PIN_SPAIN, helpAuto: false });
    await page.goto('./#/jugar');
    await expect.poll(() => asked, { message: 'the code of the games is asked for' }).toBeGreaterThan(0);
    /** What the page says, so that a failure here tells what was there instead. */
    const said = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
    await expect.poll(said, { timeout: 30_000 }).toContain('Algo ha fallado');
    const crash = page.locator('.crash');
    await expect(crash).toContainText('Tu progreso está a salvo');
    await expect(crash.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    // A game fills the window: the notice does not spread down it, and its button is not as tall as what is left over.
    const reload = crash.getByRole('button', { name: 'Recargar la página' });
    expect(await reload.evaluate((el) => el.getBoundingClientRect().height)).toBeLessThan(60);
    // The start of the game is one of the ways out.
    await crash.getByRole('link', { name: 'Ir al inicio' }).click();
    await expect(page.locator('.hero-title')).toBeVisible();
  });
});

test.describe('the page of each language', () => {
  test('en.html speaks English to whoever has not chosen a language', async ({ page }) => {
    await seed(page);
    await page.goto('./en.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle('Regionle ∞ — Learn the regions of the world');
    await expect(page.locator('nav.nav a[href="#/regiones"]')).toHaveText(/Regions/);
  });

  test('the language chosen in the game wins over the one of the page', async ({ page }) => {
    await seed(page, { lang: 'es' });
    await page.goto('./en.html');
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('nav.nav a[href="#/regiones"]')).toHaveText(/Regiones/);
  });

  test('says who it is to search engines and social networks', async ({ page, request }) => {
    for (const [file, lang] of [['', 'es'], ['es.html', 'es'], ['en.html', 'en']] as const) {
      const html = await (await request.get(`./${file}`)).text();
      expect(html).toContain(`<html lang="${lang}">`);
      expect(html).toMatch(/<link rel="canonical" href="https:\/\/[^"]+" \/>/);
      expect(html).toMatch(new RegExp(`<meta property="og:image" content="https://[^"]+/social-${lang}\\.png" />`));
      expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
      expect(html).toContain('<script type="application/ld+json">');
      expect(html.match(/hreflang="/g)).toHaveLength(3);
    }
    for (const file of ['social-es.png', 'social-en.png', 'sitemap.xml', 'robots.txt']) expect((await request.get(`./${file}`)).status(), file).toBe(200);
    await seed(page);
    await page.goto('./');
    // What the page links to from its head is really there.
    const image = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(image).toMatch(/social-es\.png$/);
  });
});
