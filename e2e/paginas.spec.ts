import { expect, test, type Page } from '@playwright/test';
import { seed } from './helpers';

/** The page of each screen in each language: its file, its language and the heading of the screen it opens. */
const PAGES = [
  ['regiones.html', 'es', 'Regiones, provincias y estados'],
  ['regions.html', 'en', 'Regions, provinces and states'],
  ['paises.html', 'es', 'Países, capitales y banderas'],
  ['countries.html', 'en', 'Countries, capitals and flags'],
  ['ciudades.html', 'es', 'Ciudades y capitales'],
  ['cities.html', 'en', 'Cities and capitals'],
  ['fisica.html', 'es', 'Ríos, mares y montañas'],
  ['physical.html', 'en', 'Rivers, seas and mountains'],
  ['cifras.html', 'es', 'Población y superficie'],
  ['figures.html', 'en', 'Population and area'],
  ['reto.html', 'es', 'Reto del día'],
  ['daily.html', 'en', 'Daily challenge'],
  ['acerca.html', 'es', 'Acerca de'],
  ['about.html', 'en', 'About'],
] as const;

/** The last part of the address and what follows it: "regiones.html", "es.html#/paises". */
const address = (page: Page): string => {
  const url = new URL(page.url());
  return `${url.pathname.split('/').pop() ?? ''}${url.hash}`;
};

const shown = async (page: Page): Promise<void> => {
  await expect(page.locator('main#contenido')).toBeVisible();
  await expect(page.locator('#root .spinner')).toHaveCount(0);
};

test.describe('the page of each screen', () => {
  test('says what the screen is before the game starts: to search engines and to whoever is sent the link', async ({ request }) => {
    const descriptions = new Set<string>();
    for (const [file, lang, name] of PAGES) {
      const html = await (await request.get(`./${file}`)).text();
      expect(html, file).toContain(`<html lang="${lang}">`);
      expect(html, file).toContain(`<title>${name} — Regionle ∞</title>`);
      expect(html, file).toMatch(new RegExp(`<link rel="canonical" href="https://[^"]+/${file.replace('.', '\\.')}" />`));
      expect(html.match(/hreflang="/g), file).toHaveLength(3);
      expect(html, file).toContain(`<meta property="og:title" content="${name} — Regionle ∞" />`);
      expect(html, file).toMatch(new RegExp(`<meta property="og:image" content="https://[^"]+/social-${lang}\\.png" />`));
      const description = /<meta name="description" content="([^"]+)" \/>/.exec(html)?.[1] ?? '';
      expect(description.length, file).toBeGreaterThanOrEqual(70);
      expect(description.length, file).toBeLessThanOrEqual(160);
      descriptions.add(description);
      const data = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)![1]) as { url: string; breadcrumb: { itemListElement: unknown[] } };
      expect(data.url.endsWith(`/${file}`), file).toBe(true);
      expect(data.breadcrumb.itemListElement, file).toHaveLength(2);
      // Without scripts, the page still says what it is.
      expect(html, file).toMatch(/<!--noscript-->[^<]{80,}JavaScript[^<]*<!--\/noscript-->/);
    }
    // Each one says something of its own.
    expect(descriptions.size).toBe(PAGES.length);

    const xml = await (await request.get('./sitemap.xml')).text();
    expect(xml.match(/<url>/g)).toHaveLength(PAGES.length + 3);
    for (const [file] of PAGES) expect(xml, file).toMatch(new RegExp(`<loc>https://[^<]+/${file.replace('.', '\\.')}</loc>`));
  });

  test('opens the game on its screen, in its language, and keeps its address', async ({ page }) => {
    await seed(page);
    for (const [file, lang, name] of PAGES) {
      await page.goto(`./${file}`);
      await shown(page);
      await expect(page.locator('html'), file).toHaveAttribute('lang', lang);
      await expect(page, file).toHaveTitle(`${name} — Regionle ∞`);
      expect(address(page), file).toBe(file);
      // The description is still the one the page came with.
      const description = await page.locator('meta[name="description"]').getAttribute('content');
      expect(description?.length ?? 0, file).toBeGreaterThanOrEqual(70);
      if (!/^(reto|daily|acerca|about)\./.test(file)) await expect(page.getByRole('heading', { level: 1 }), file).toHaveText(name);
    }
    await page.goto('./acerca.html');
    await expect(page.locator('.about')).toBeVisible();
    await page.goto('./reto.html');
    await expect(page.getByRole('button', { name: /Empezar|Jugar|Seguir|Continuar/ }).first()).toBeVisible({ timeout: 30_000 });
  });

  test('gives way to the address of the game when the player moves on, and comes back with Back', async ({ page }) => {
    await seed(page);
    await page.goto('./regions.html');
    await shown(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regions, provinces and states');
    await expect(page.locator('nav.nav a[aria-current="page"]')).toHaveText('Regions');

    await page.locator('nav.nav a[href="#/ciudades"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cities and capitals');
    // "regions.html#/ciudades" would name two screens: it is the game in English, at the cities.
    expect(address(page)).toBe('en.html#/ciudades');
    await page.reload();
    await shown(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cities and capitals');

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regions, provinces and states');
    expect(address(page)).toBe('regions.html');
    await page.goForward();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cities and capitals');
    expect(address(page)).toBe('en.html#/ciudades');
  });

  test('is one screen only: what follows the hash wins over the page', async ({ page }) => {
    await seed(page);
    await page.goto('./regiones.html#/paises');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Países, capitales y banderas');
    expect(address(page)).toBe('es.html#/paises');
  });

  test('follows the language the player has chosen, and the one they choose', async ({ page }) => {
    await seed(page, { lang: 'es' });
    await page.goto('./regions.html');
    await shown(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regiones, provincias y estados');
    // What is copied from the bar opens as it is seen.
    expect(address(page)).toBe('regiones.html');

    await page.locator('.lang button[lang="en"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regions, provinces and states');
    expect(address(page)).toBe('regions.html');
    await page.locator('.lang button[lang="es"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regiones, provincias y estados');
    expect(address(page)).toBe('regiones.html');
  });

  test('is where the first page links to, and a click on the link stays inside the game', async ({ page }) => {
    await seed(page);
    await page.goto('./');
    await shown(page);
    const hrefs = await page.locator('.sections a.scard').evaluateAll((links) => links.map((a) => a.getAttribute('href')));
    expect(hrefs).toEqual(['regiones.html', 'paises.html', 'ciudades.html', 'fisica.html', 'cifras.html']);
    await expect(page.locator('.foot-about a').first()).toHaveAttribute('href', 'acerca.html');

    // Nothing is loaded again: what the page holds in memory is still there afterwards.
    await page.evaluate(() => ((window as unknown as { kept: number }).kept = 7));
    await page.locator('.sections a.scard').nth(1).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Países, capitales y banderas');
    expect(address(page)).toBe('#/paises');
    expect(await page.evaluate(() => (window as unknown as { kept?: number }).kept)).toBe(7);

    // In English, the links are the English pages.
    await page.locator('.lang button[lang="en"]').click();
    await page.locator('a.brand').click();
    await expect(page.locator('.sections a.scard').first()).toHaveAttribute('href', 'regions.html');
    await expect(page.locator('.foot-about a').first()).toHaveAttribute('href', 'about.html');
  });
});

test.describe('what is done with someone else', () => {
  test('is told on the first page, which leads to how a challenge is sent and how a list is made', async ({ page }) => {
    await seed(page);
    await page.goto('./');
    await shown(page);
    await page.getByRole('link', { name: 'Cómo funcionan los retos' }).click();
    await expect(page).toHaveURL(/#\/duelo$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Reta a quien quieras');
    await expect(page).toHaveTitle('Retos entre dos — Regionle ∞');
    await expect(page.locator('.how-steps > li')).toHaveCount(3);
    await expect(page.locator('.how-steps')).toContainText('«Retar a alguien»');
    await expect(page.locator('.how-steps')).toContainText('cualquier mapa de Regiones, Países, Ciudades o Física en los modos Señalar, Identificar, Silueta, Puzle, Capitales y Banderas');
    await page.getByRole('link', { name: 'Elegir a qué jugar' }).click();
    await expect(page).toHaveURL(/#\/regiones$/);

    await page.goto('./#/lista');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Solo las piezas que tú elijas');
    await expect(page).toHaveTitle('Listas a medida — Regionle ∞');
    await expect(page.locator('.how-steps')).toContainText('Hay listas en Regiones, Países, Ciudades y Física: «Nueva lista»');
    await expect(page.locator('.how-steps')).toContainText('«Compartir»');
    await expect(page.locator('.notfound')).toHaveCount(0);
  });

  test('a link that is broken still says so', async ({ page }) => {
    await seed(page);
    await page.goto('./#/duelo/esto-no-es-un-reto');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Este enlace no funciona');
    await page.goto('./#/lista/ni-esto-una-lista');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Este enlace no funciona');
  });
});
