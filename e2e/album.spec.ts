import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start, type } from './helpers';

// The clock of these tests is set by hand, and so is where it is read: their days are Madrid's, whatever
// E2E_ZONE says (playwright.config.ts).
test.use({ timezoneId: 'Europe/Madrid' });

/** Noon of Wednesday 18 November 2026 in Madrid, where the browser of these tests is. */
const NOW = new Date('2026-11-18T12:00:00+01:00');
const DAY = 24 * 3_600_000;
const YESTERDAY = NOW.getTime() - DAY;

/** Right first time twice in a row: learnt. */
const LEARNT = [2, 2, 2, YESTERDAY];
const st = (seen: number, ok: number, run: number): number[] => [seen, ok, run, YESTERDAY];
const flags = (ids: readonly string[]): Record<string, number[]> => Object.fromEntries(ids.map((id) => [`flag:${id}`, LEARNT]));

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: { id: string; ct: string; cl: string }[] };
/** The member states of the UN of a continent. */
const members = (continent: string): string[] => index.countries.filter((c) => c.cl === 'un' && c.ct === continent).map((c) => c.id);

const PLAYED = {
  sessions: [{ t: YESTERDAY, section: 'countries', mode: 'flag', label: 'Europa', total: 10, ok: 6, warn: 1, bad: 3, ms: 60_000 }],
  tot: { g: 1, q: 10, ok: 6, warn: 1, ms: 60_000 },
  opts: OPTS,
};

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { game: { section: string; mode: string; only?: string[]; review?: boolean } });
const albumPage = (page: Page, name: string) => page.locator('.album-page', { has: page.getByRole('heading', { name: new RegExp(`^${name}`) }) });

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(NOW);
});

test.describe('the flag album', () => {
  test('counts what is learnt, continent by continent, and opens to show each flag in its place', async ({ page }) => {
    await seed(page, {
      ...PLAYED,
      // Germany has been right once and Italy was learnt and missed since: neither is in. Knowing where Portugal is does not bring its flag.
      stats: { ...flags(['ES', 'FR', 'JP', 'GL']), 'flag:DE': st(1, 1, 1), 'flag:IT': st(5, 3, 0), 'loc:PT': LEARNT },
    });
    await open(page, '/progreso');
    const album = page.locator('.album');
    await expect(album.getByRole('heading', { level: 2 })).toHaveText('Álbum de banderas');
    await expect(album.locator('.tip-line')).toContainText('Llevas 3 de las 193 banderas de los países del mundo.');
    const counts = album.locator('.album-pages li');
    await expect(counts).toHaveText([/^Europa\s*2 \/ 44$/, /^Asia\s*1 \/ 46$/, /^África\s*0 \/ 54$/, /^América\s*0 \/ 35$/, /^Oceanía\s*0 \/ 14$/, /^Otros territorios\s*1 \/ 56$/]);
    await expect(counts.first().getByRole('img')).toHaveAttribute('aria-label', 'Europa: 2 de 44 banderas');

    // Closed until it is asked for: more than two hundred flags are not drawn for whoever came for something else.
    const opener = album.getByRole('button', { name: 'Abrir el álbum' });
    await expect(opener).toHaveAttribute('aria-expanded', 'false');
    await expect(album.locator('.album-grid')).toHaveCount(0);
    await opener.click();
    await expect(album.getByRole('button', { name: 'Cerrar el álbum' })).toHaveAttribute('aria-expanded', 'true');
    await expect(album.locator('.album-page')).toHaveCount(6);

    const europe = albumPage(page, 'Europa');
    await expect(europe.getByRole('heading')).toHaveText(/^Europa\s*2 de 44$/);
    await expect(europe.locator('.album-grid li')).toHaveCount(44);
    // By name: Albania, Alemania, Andorra…
    await expect(europe.locator('.album-grid li').nth(1)).toHaveText('Alemania (falta)');
    const got = europe.locator('.album-grid li.got');
    await expect(got).toHaveText(['España', 'Francia']);
    await expect(got.first().locator('img')).toHaveAttribute('src', /flags\/es\.svg$/);
    // A place still empty shows no flag: the album does not give away what is to be learnt.
    await expect(europe.locator('.album-grid li[data-id="DE"] img')).toHaveCount(0);
    await expect(europe.locator('.album-grid li[data-id="DE"] .album-slot')).toBeVisible();
    await expect(albumPage(page, 'Otros territorios').locator('.album-grid li.got')).toHaveText(['Groenlandia']);

    await album.getByRole('button', { name: 'Cerrar el álbum' }).click();
    await expect(album.locator('.album-book')).toBeHidden();
  });

  test('starts a game with the flags a page lacks, and says when a page is complete', async ({ page }) => {
    const america = members('AM');
    const lacking = america.slice(0, 2);
    await seed(page, { ...PLAYED, stats: { ...flags(['ES', 'FR']), ...flags(members('OC')), ...flags(america.slice(2)) } });
    await open(page, '/progreso');
    await page.getByRole('button', { name: 'Abrir el álbum' }).click();

    const oceania = albumPage(page, 'Oceanía');
    await expect(oceania.locator('.album-full')).toHaveText('Página completa');
    await expect(oceania.getByRole('button')).toHaveCount(0);
    await expect(oceania.locator('.album-grid li.got')).toHaveCount(14);
    await expect(albumPage(page, 'Europa').getByRole('button')).toHaveText('Jugar 20 de las que faltan');
    const few = albumPage(page, 'América').getByRole('button');
    await expect(few).toHaveText('Jugar las 2 que faltan');

    await few.click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(page.locator('.play-title strong')).toHaveText('Banderas', { timeout: 30_000 });
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    const game = (await kept(page)).game;
    expect([game.section, game.mode]).toEqual(['countries', 'flag']);
    expect([...(game.only ?? [])].sort()).toEqual([...lacking].sort());

    // A page that lacks many is played twenty at a time, none of them one that is already in.
    await open(page, '/progreso');
    await page.getByRole('button', { name: 'Abrir el álbum' }).click();
    await albumPage(page, 'Europa').getByRole('button').click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 20', { timeout: 30_000 });
    const only = (await kept(page)).game.only ?? [];
    expect(new Set(only).size).toBe(20);
    expect(only.filter((id) => id === 'ES' || id === 'FR')).toEqual([]);
    expect(only.every((id) => members('EU').includes(id))).toBe(true);
  });

  test('takes a flag in once it is learnt in a game, and keeps it when it is missed later', async ({ page }) => {
    const game = { section: 'countries', mode: 'flag', countries: ['FR', 'IT'], only: ['FR'], opts: { answer: 'type' } };
    // Right once already: the second in a row is what makes it learnt.
    await seed(page, { ...PLAYED, stats: { 'flag:FR': st(1, 1, 1) }, where: { FR: 'c' }, game: { levels: {}, nonce: 1, ...game, opts: { ...OPTS, ...game.opts } } });
    await open(page, '/progreso');
    await expect(page.locator('.album .tip-line')).toContainText('Llevas 0 de las 193 banderas');

    await start(page, game);
    await expect(page.locator('.q-flagbox img')).toHaveAttribute('src', /flags\/fr\.svg$/);
    await type(page, 'Francia');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);

    await open(page, '/progreso');
    await expect(page.locator('.album .tip-line')).toContainText('Llevas 1 de las 193 banderas');
    await expect(page.locator('.album .tip-line')).toContainText('y ya no sale, aunque luego la falles.');
    await page.getByRole('button', { name: 'Abrir el álbum' }).click();
    await expect(albumPage(page, 'Europa').locator('.album-grid li.got')).toHaveText(['Francia']);

    // Missed the next time: the answer is to be learnt again, the flag stays where it is.
    await restart(page, game);
    for (const wrong of ['Italia', 'Bélgica', 'Alemania']) await type(page, wrong);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { stats: Record<string, number[]>; album: Record<string, number> });
    expect(state.stats['flag:FR'].slice(0, 3)).toEqual([3, 2, 0]);
    expect(Object.keys(state.album)).toEqual(['FR']);
    await open(page, '/progreso');
    await expect(page.locator('.album .tip-line')).toContainText('Llevas 1 de las 193 banderas');
    await page.getByRole('button', { name: 'Abrir el álbum' }).click();
    await expect(albumPage(page, 'Europa').locator('.album-grid li.got')).toHaveText(['Francia']);
  });

  test('is in English for whoever plays in English', async ({ page }) => {
    await seed(page, { ...PLAYED, lang: 'en', stats: flags(['ES', 'DE']) });
    await open(page, '/progreso');
    const album = page.locator('.album');
    await expect(album.getByRole('heading', { level: 2 })).toHaveText('Flag album');
    await expect(album.locator('.tip-line')).toContainText('You have 2 of the 193 flags of the countries of the world.');
    await album.getByRole('button', { name: 'Open the album' }).click();
    const europe = albumPage(page, 'Europe');
    await expect(europe.getByRole('heading')).toHaveText(/^Europe\s*2 of 44$/);
    await expect(europe.locator('.album-grid li.got')).toHaveText(['Germany', 'Spain']);
    await expect(europe.locator('.album-grid li').first()).toHaveText('Albania (missing)');
    await expect(europe.getByRole('button')).toHaveText('Play 20 of the missing');
    await expect(albumPage(page, 'Other territories').locator('.album-grid li')).toHaveCount(56);
  });
});

test.describe('what is missed most, on the home page', () => {
  const slipping = {
    ...PLAYED,
    // Zamora and Guadalajara keep slipping, and so does the flag of Chad; Madrid is learnt.
    stats: { 'loc:ES-ZA': st(7, 2, 0), 'loc:ES-GU': st(4, 1, 1), 'loc:ES-M': st(6, 6, 6), 'flag:TD': st(5, 1, 0) },
    where: { 'ES-ZA': 'r|ES|f', 'ES-GU': 'r|ES|f', 'ES-M': 'r|ES|f', TD: 'c' },
  };

  test('is counted under the review, practised with one click and listed in Progress', async ({ page }) => {
    await seed(page, slipping);
    await open(page, '/');
    const hard = page.locator('.review .review-hard');
    await expect(hard.locator('p')).toHaveText('Lo que más fallas: 3 respuestas que has fallado dos veces o más y aún no te sabes, en 2 mapas. Ver cuáles');
    // The map with the most of them, one click away.
    const practise = hard.getByRole('button');
    await expect(practise).toHaveText(/^Practicar 2\s*España · provincias · Señalar$/);
    await practise.click();
    await expect(page).toHaveURL(/#\/jugar$/);
    await expect(page.locator('.play-title strong')).toHaveText('Señalar', { timeout: 30_000 });
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    expect([...((await kept(page)).game.only ?? [])].sort()).toEqual(['ES-GU', 'ES-ZA']);

    // Which ones they are is on the Progress page, which opens on that block.
    await open(page, '/');
    await hard.getByRole('link', { name: 'Ver cuáles' }).click();
    await expect(page).toHaveURL(/#\/progreso\?ver=fallos$/);
    const block = page.locator('.miss');
    await expect(block.getByRole('heading', { level: 2 })).toHaveText('Lo que más fallas');
    await expect(block.getByRole('heading', { level: 2 })).toBeInViewport();
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    await expect(block.locator('.miss-items li').first()).toHaveText(/^Zamora\s*5 de 7$/, { timeout: 30_000 });
  });

  test('says nothing when nothing keeps slipping, and counts a single answer as one', async ({ page }) => {
    await seed(page, { ...PLAYED, stats: { 'loc:ES-M': st(6, 6, 6), 'flag:TD': st(5, 1, 0) }, where: { 'ES-M': 'r|ES|f', TD: 'c' } });
    await open(page, '/');
    const hard = page.locator('.review .review-hard');
    await expect(hard.locator('p')).toHaveText('Lo que más fallas: 1 respuesta que has fallado dos veces o más y aún no te sabes. Ver cuáles');
    await expect(hard.getByRole('button')).toHaveText(/^Practicarla\s*Países · Banderas$/);

    // Two right answers in a row take it off the list, however many misses came before.
    await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('regionle:v1')!) as { state: { stats: Record<string, number[]> } };
      saved.state.stats['flag:TD'] = [7, 3, 2, saved.state.stats['flag:TD'][3]];
      localStorage.setItem('regionle:v1', JSON.stringify(saved));
    });
    await page.reload();
    await expect(page.locator('.review')).toBeVisible();
    await expect(page.locator('.review .review-hard')).toHaveCount(0);
  });
});
