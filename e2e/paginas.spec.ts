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
  ['cifras.html', 'es', 'Los países en cifras'],
  ['figures.html', 'en', 'Countries in figures'],
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
    // The first page, the two of the languages and those of the screens; after them, those of the maps.
    const maps = xml.match(/<loc>[^<]+\/(?:mapa|map)-[a-z][a-z0-9]-[^<]+<\/loc>/g) ?? [];
    expect(xml.match(/<url>/g)).toHaveLength(PAGES.length + 3 + maps.length);
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

test.describe('the page of the map of a country', () => {
  /** The pages of two countries in the two languages: the file, its language, how its title starts, and what the game says is chosen. */
  const MAPS = [
    ['mapa-es-espana.html', 'es', 'España: provincias en el mapa', 'España · 52 provincias', 'map-es-spain.html'],
    ['map-es-spain.html', 'en', 'Spain: provinces on the map', 'Spain · 52 provinces', 'mapa-es-espana.html'],
    ['mapa-gb-reino-unido.html', 'es', 'Reino Unido: condados y distritos en el mapa', 'Reino Unido · 232 condados y distritos', 'map-gb-united-kingdom.html'],
    ['map-gb-united-kingdom.html', 'en', 'United Kingdom: counties and districts on the map', 'United Kingdom · 232 counties and districts', 'mapa-gb-reino-unido.html'],
  ] as const;
  const description = (page: Page) => page.locator('meta[name="description"]').getAttribute('content');

  test('says what the map is before the game starts, and is listed for search engines with its other language', async ({ request }) => {
    for (const [file, lang, name, , other] of MAPS) {
      const res = await request.get(`./${file}`);
      expect(res.status(), file).toBe(200);
      const html = await res.text();
      expect(html, file).toContain(`<html lang="${lang}">`);
      expect(html, file).toContain(`<title>${name} — Regionle ∞</title>`);
      expect(html, file).toMatch(new RegExp(`<link rel="canonical" href="https://[^"]+/${file.replace('.', '\\.')}" />`));
      expect(html.match(/hreflang="/g), file).toHaveLength(3);
      expect(html, file).toMatch(new RegExp(`<link rel="alternate" hreflang="${lang === 'es' ? 'en' : 'es'}" href="https://[^"]+/${other.replace('.', '\\.')}" />`));
      expect(html, file).toContain(`<meta property="og:title" content="${name} — Regionle ∞" />`);
      const said = /<meta name="description" content="([^"]+)" \/>/.exec(html)?.[1] ?? '';
      // How many pieces the map has, at each of its levels.
      expect(said, file).toMatch(lang === 'es' ? /^[^:]+ en el mapa: \d+ [^.]+\. Juega a / : /^[^:]+ on the map: \d+ [^.]+\. Pin, /);
      const data = JSON.parse(/<script type="application\/ld\+json">(.*?)<\/script>/.exec(html)![1]) as { url: string; breadcrumb: { itemListElement: { name: string; item: string }[] } };
      expect(data.url.endsWith(`/${file}`), file).toBe(true);
      // The game, the regions, the map.
      expect(data.breadcrumb.itemListElement.map((step) => step.item.split('/').pop()), file).toEqual([`${lang}.html`, lang === 'es' ? 'regiones.html' : 'regions.html', file]);
      expect(html, file).toMatch(/<!--noscript-->[^<]{80,}JavaScript[^<]*<!--\/noscript-->/);
      // The page is the game: the same scripts and styles as the first one.
      const first = await (await request.get('./')).text();
      expect(html.match(/<script type="module"[^>]*>/g), file).toEqual(first.match(/<script type="module"[^>]*>/g));
    }

    const xml = await (await request.get('./sitemap.xml')).text();
    const listed = [...xml.matchAll(/<loc>[^<]+\/((?:mapa|map)-[a-z][a-z0-9]-[^<]+)<\/loc>/g)].map((m) => m[1]);
    // Hundreds of them: two for each country with a map worth a game.
    expect(listed.length).toBeGreaterThan(400);
    expect(listed.filter((f) => f.startsWith('mapa-')).length).toBe(listed.length / 2);
    expect(new Set(listed).size).toBe(listed.length);
    for (const [file] of MAPS) expect(listed).toContain(file);
    // Each page that is listed is there: the first, the last and a handful in between.
    for (const file of [listed[0], listed[listed.length - 1], ...listed.filter((_, i) => i % 97 === 5)]) expect((await request.get(`./${file}`)).status(), file).toBe(200);
    // A country whose map is one piece has no page: there is no game in it.
    expect(listed.some((f) => /^mapa?-mc-/.test(f))).toBe(false);

    // The copy kept in the device does not carry their names, which are hundreds: it knows them by how they start.
    const worker = await (await request.get('./sw.js')).text();
    expect(worker).toContain('const MAPS = {"map":"en.html","mapa":"es.html"};');
    expect(worker).not.toContain('"mapa-es-espana');
    expect(worker).not.toContain('"map-es-spain');
    // The pages of the screens are still there by their names.
    expect(worker).toContain('"regiones.html":"es.html"');
    expect(worker).toContain('"regions":"en.html"');
  });

  test('opens the game on the regions of its country, at their finest, in its language', async ({ page }) => {
    await seed(page);
    for (const [file, lang, name, chosen] of MAPS) {
      const html = await (await page.request.get(`./${file}`)).text();
      const written = /<meta name="description" content="([^"]+)" \/>/.exec(html)![1].replace(/&amp;/g, '&');
      await page.goto(`./${file}`);
      await shown(page);
      await expect(page.locator('html'), file).toHaveAttribute('lang', lang);
      await expect(page.locator('.startbar'), file).toContainText(chosen);
      // It is the screen of the regions, with that map chosen and headed as the page is: what the page says of
      // itself is what is read on it once the game is there.
      await expect(page.locator('nav.nav a[aria-current="page"]'), file).toHaveText(lang === 'es' ? 'Regiones' : 'Regions');
      await expect(page.getByRole('heading', { level: 1 }), file).toHaveText(name);
      await expect(page.locator('.setup-head .lead'), file).toHaveText(written);
      await expect(page, file).toHaveTitle(`${name} — Regionle ∞`);
      expect(await description(page), file).toBe(written);
      // The page stays in the bar, with the screen the game is on after it.
      expect(address(page), file).toBe(`${file}#/regiones`);
    }
    // The game starts on that map.
    await page.locator('.startbar').getByRole('button', { name: 'Start' }).click();
    await expect(page.locator('.map-svg [data-id]').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.play-title')).toContainText('United Kingdom');
  });

  test('gives way to the address of the game when the player moves on, and is itself again with Back', async ({ page }) => {
    await seed(page);
    await page.goto('./mapa-es-espana.html');
    await shown(page);
    await expect(page.locator('.startbar')).toContainText('España · 52 provincias');
    const said = await description(page);

    await page.locator('nav.nav a[href="#/paises"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Países, capitales y banderas');
    expect(address(page)).toBe('es.html#/paises');
    await expect(page).toHaveTitle('Países, capitales y banderas — Regionle ∞');

    await page.goBack();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('España: provincias en el mapa');
    expect(address(page)).toBe('mapa-es-espana.html#/regiones');
    await expect(page).toHaveTitle('España: provincias en el mapa — Regionle ∞');
    expect(await description(page)).toBe(said);
    await expect(page.locator('.startbar')).toContainText('España · 52 provincias');

    // The screen is headed as the page while the map of the page is the one chosen, and no longer: with another
    // country chosen as well, it is the screen of the regions like any day.
    await page.locator('.picker-groups .cchip', { hasText: 'Portugal' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regiones, provincias y estados');
    await expect(page.locator('.setup-head .lead')).not.toContainText('52 provincias');
    // Nor with another country alone: the page is about its own map.
    await page.locator('.picker-groups .cchip', { hasText: 'España' }).click();
    await expect(page.locator('.startbar')).toContainText('Portugal · ');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regiones, provincias y estados');
    await page.locator('.picker-groups .cchip', { hasText: 'España' }).click();
    await page.locator('.picker-groups .cchip', { hasText: 'Portugal' }).click();
    await expect(page.locator('.startbar')).toContainText('España · 52 provincias');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('España: provincias en el mapa');

    // Read again where it is, it is the same screen of the same page.
    await page.reload();
    await shown(page);
    await expect(page).toHaveTitle('España: provincias en el mapa — Regionle ∞');
    expect(address(page)).toBe('mapa-es-espana.html#/regiones');
    await expect(page.locator('.startbar')).toContainText('España · 52 provincias');
    // What follows the hash wins over the page, as on the page of a screen.
    await page.goto('./mapa-es-espana.html#/ciudades');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ciudades y capitales');
    expect(address(page)).toBe('es.html#/ciudades');
  });

  test('says the same when it is the plain page of its language that answers for it, as the copy kept in the device does', async ({ page }) => {
    await seed(page);
    const real = await (await page.request.get('./mapa-fr-francia.html')).text();
    const title = /<title>([^<]+)<\/title>/.exec(real)![1];
    const written = /<meta name="description" content="([^"]+)" \/>/.exec(real)![1];
    expect(title).toMatch(/^Francia: .+ en el mapa — Regionle ∞$/);
    // The page of the language, under the address of the page of the map: all the game has is the name.
    const plain = await (await page.request.get('./es.html')).text();
    expect(plain).not.toContain('Francia');
    await page.route(/\/mapa-fr-francia\.html$/, (route) => route.fulfill({ contentType: 'text/html; charset=utf-8', body: plain }));
    await page.goto('./mapa-fr-francia.html');
    await shown(page);
    await expect(page.locator('.startbar')).toContainText('Francia · ');
    await expect(page).toHaveTitle(title);
    expect(await description(page)).toBe(written);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title.replace(' — Regionle ∞', ''));
    await expect(page.locator('.setup-head .lead')).toHaveText(written);
    expect(address(page)).toBe('mapa-fr-francia.html#/regiones');
  });

  test('gives way to the game in the language the player has chosen, with its map', async ({ page }) => {
    await seed(page, { lang: 'en' });
    await page.goto('./mapa-es-espana.html');
    await shown(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('.startbar')).toContainText('Spain · 52 provinces');
    // A page written in Spanish is not where a game in English lives: the address is the plain one of the game.
    expect(address(page)).toBe('#/regiones');
    await expect(page).toHaveTitle('Regions, provinces and states — Regionle ∞');

    // And the same when the language is chosen on the page itself.
    await page.locator('.lang button[lang="es"]').click();
    await page.goto('./map-gb-united-kingdom.html');
    await shown(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'es');
    await expect(page.locator('.startbar')).toContainText('Reino Unido · 232 condados y distritos');
    expect(address(page)).toBe('#/regiones');
    await page.locator('.lang button[lang="en"]').click();
    await page.goto('./map-gb-united-kingdom.html');
    await shown(page);
    await expect(page).toHaveTitle('United Kingdom: counties and districts on the map — Regionle ∞');
    expect(address(page)).toBe('map-gb-united-kingdom.html#/regiones');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('United Kingdom: counties and districts on the map');
    await page.locator('.lang button[lang="es"]').click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regiones, provincias y estados');
    expect(address(page)).toBe('#/regiones');
    await expect(page).toHaveTitle('Regiones, provincias y estados — Regionle ∞');
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
    await expect(page.locator('.how-steps')).toContainText('cualquier mapa de Regiones, Países, Ciudades o Física en los modos Señalar, Identificar, Silueta, Puzle, Capitales, Banderas, Datos del país y Popurrí');
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
