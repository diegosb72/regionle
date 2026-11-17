import fs from 'node:fs';
import { expect, test } from '@playwright/test';
import { open, seed } from './helpers';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as { version: string };

test.describe('the first page and the addresses of the game', () => {
  test('opens in Spanish, with one main heading and the five sections', async ({ page }) => {
    await seed(page);
    await open(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page).toHaveTitle('Regionle ∞ — Aprende las regiones del mundo');
    await expect(page.locator('h1')).toHaveCount(1);
    for (const path of ['regiones', 'paises', 'ciudades', 'fisica', 'poblaciones']) await expect(page.locator(`nav.nav a[href="#/${path}"]`)).toBeVisible();
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
