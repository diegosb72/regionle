import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start } from './helpers';

const COMMUNITIES = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' } };
/** Two countries a world apart: each is asked about from the other, and there is no doubt which way it lies. */
const FAR = { section: 'countries', countries: ['PT', 'JP'] };

const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { sessions: { mode: string; total: number; ok: number; warn: number; bad: number; label: string }[]; stats: Record<string, unknown> });
const rose = (page: Page, name: string) => page.locator('.rose').getByRole('button', { name, exact: true });
const labels = (page: Page) => page.locator('.map-svg .m-lbl');

test.describe('distances and bearings', () => {
  test('asks which way a place lies from another with nothing on the map, and shows both once answered', async ({ page }) => {
    await start(page, { ...FAR, mode: 'bearing', opts: { bearingAsk: 'dir' } });
    await expect(page.locator('.play-title strong')).toHaveText('Distancias y rumbos');
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    await expect(page.locator('.kicker')).toHaveText('¿Hacia dónde queda?');
    const asked = ((await page.locator('.q-name').textContent()) ?? '').trim();
    expect(['Portugal', 'Japón']).toContain(asked);
    const from = asked === 'Japón' ? 'Portugal' : 'Japón';
    await expect(page.locator('.bearing-from')).toHaveText(`Desde ${from}`);
    await expect(page.locator('.q-how')).toContainText('De centro a centro.');
    // The eight points, laid out as on a compass, around the place one looks from.
    await expect(page.locator('.rose .rose-btn')).toHaveCount(8);
    await expect(page.locator('.rose .rose-btn b')).toHaveText(['NO', 'N', 'NE', 'O', 'E', 'SO', 'S', 'SE']);
    await expect(page.locator('.rose-mid')).toContainText(from);
    // Nothing on the map says where either is.
    await expect(page.locator('.map-svg')).toHaveClass(/blind/);
    await expect(labels(page)).toHaveCount(0);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(0);
    await page.locator('.map-svg [data-id="JP"]').first().hover();
    await expect(page.locator('.map-tip')).toHaveText('');

    // Japan is east of Portugal, and Portugal west of Japan.
    await rose(page, asked === 'Japón' ? 'este' : 'oeste').click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict')).toContainText(asked === 'Japón' ? '¡Eso es! Al este' : '¡Eso es! Al oeste');
    await expect(page.locator('.verdict .bearing-line')).toHaveText(new RegExp(`^${from} .*${asked}: al (este|oeste) \\(\\d+°\\), a unos [\\d.]+ km en línea recta\\.$`));
    await expect(rose(page, asked === 'Japón' ? 'este' : 'oeste')).toHaveClass(/right/);
    await expect(page.locator('.rose .rose-btn').first()).toBeDisabled();
    // Now the map shows both, named, and the line from one to the other.
    await expect(labels(page)).toHaveCount(2);
    expect((await labels(page).allTextContents()).sort()).toEqual(['Japón', 'Portugal']);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(1);
    await expect(page.locator(`.map-svg [data-id="${asked === 'Japón' ? 'JP' : 'PT'}"]`).first()).toHaveClass(/st-ok/);
    await expect(page.locator(`.map-svg [data-id="${asked === 'Japón' ? 'PT' : 'JP'}"]`).first()).toHaveClass(/st-from/);

    // A right answer moves on by itself; the map is blank again for the next one.
    await expect(page.locator('.hud-main')).toHaveText('2 / 2', { timeout: 6000 });
    await expect(page.locator('.q-name')).toHaveText(from);
    await expect(labels(page)).toHaveCount(0);
    // The opposite way is wrong: it says where it lies and waits to be read.
    await rose(page, asked === 'Japón' ? 'este' : 'oeste').click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict')).toContainText(asked === 'Japón' ? 'Queda al oeste' : 'Queda al este');
    await expect(rose(page, asked === 'Japón' ? 'este' : 'oeste')).toHaveClass(/wrong/);
    await expect(rose(page, asked === 'Japón' ? 'oeste' : 'este')).toHaveClass(/right/);
    await page.getByRole('button', { name: 'Ver resultado' }).click();

    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results')).toContainText('1 de 2');
    await expect(page.locator('.results-group.g-ok .row-name')).toContainText(`${asked}${asked === 'Japón' ? 'este' : 'oeste'} · desde ${from}`);
    await expect(page.locator('.results-group.g-bad .row-name')).toContainText(`${from}${asked === 'Japón' ? 'oeste' : 'este'} · desde ${asked}`);
    const state = await kept(page);
    expect(state.sessions.at(-1)).toMatchObject({ mode: 'bearing', total: 2, ok: 1, warn: 0, bad: 1 });

    // The one that was missed can be asked again by itself.
    await page.locator('.results').getByRole('button', { name: 'Repasar 1 fallo' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    await expect(page.locator('.q-name')).toHaveText(from);
  });

  test('asks how far, among four distances in order, and takes the keys', async ({ page }) => {
    await start(page, { ...FAR, mode: 'bearing', opts: { bearingAsk: 'dist' } });
    await expect(page.locator('.kicker')).toHaveText('¿A qué distancia está?');
    await expect(page.locator('.q-how')).toContainText('En línea recta, de centro a centro.');
    await expect(page.locator('.rose')).toHaveCount(0);
    const options = page.locator('.bearing-km .choice span');
    await expect(options).toHaveCount(4);
    const km = (await options.allTextContents()).map((t) => Number(t.replace(/\D/g, '')));
    expect([...km].sort((a, b) => a - b)).toEqual(km);
    expect(new Set(km).size).toBe(4);
    // From Portugal to Japan there are some 11,000 km, and no option goes past half the way round the world.
    expect(km.some((n) => n > 10_000 && n < 12_000)).toBe(true);
    expect(Math.max(...km)).toBeLessThanOrEqual(20_000);
    const right = km.findIndex((n) => n > 10_000 && n < 12_000);

    // The keys 1 to 4 choose among them.
    await page.keyboard.press(String(right + 1));
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.verdict')).toContainText('¡Eso es!');
    await expect(page.locator('.bearing-km .choice').nth(right)).toHaveClass(/right/);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(1);
    await expect(page.locator('.hud-main')).toHaveText('2 / 2', { timeout: 6000 });

    // The second one, wrong: the true one is marked, and Enter moves on.
    const again = (await options.allTextContents()).map((t) => Number(t.replace(/\D/g, '')));
    const truth = again.findIndex((n) => n > 10_000 && n < 12_000);
    const miss = truth === 0 ? 1 : 0;
    await page.keyboard.press(String(miss + 1));
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict')).toContainText(/Son [\d.]+ km/);
    await expect(page.locator('.bearing-km .choice').nth(miss)).toHaveClass(/wrong/);
    await expect(page.locator('.bearing-km .choice').nth(truth)).toHaveClass(/right/);
    await page.keyboard.press('Enter');
    await expect(page.locator('.results-title')).toHaveText('Partida terminada');
    await expect(page.locator('.results-group.g-bad .row-name small')).toHaveText(/^[\d.]+ km · desde (Portugal|Japón)$/);
    // Only distances were asked: nothing to explain about bearings.
    await expect(page.locator('.results')).not.toContainText('En los rumbos');
  });

  test('takes turns between the two, and chooses a bearing with the keys of a numeric keypad', async ({ page }) => {
    await start(page, { ...FAR, mode: 'bearing' });
    await expect(page.locator('.kicker')).toHaveText('¿Hacia dónde queda?');
    const asked = ((await page.locator('.q-name').textContent()) ?? '').trim();
    // 6 is east and 4 is west, as they lie on the keypad.
    await page.keyboard.press(asked === 'Japón' ? '6' : '4');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.hud-main')).toHaveText('2 / 2', { timeout: 6000 });
    await expect(page.locator('.kicker')).toHaveText('¿A qué distancia está?');
    await expect(page.locator('.bearing-km .choice')).toHaveCount(4);
  });

  test('counts the point beside the right one as close when the place leans that way', async ({ page }) => {
    // From any other community, Galicia lies between west and north; the opposite side is always wrong.
    await start(page, { ...COMMUNITIES, mode: 'bearing', only: ['ES-GA'], opts: { bearingAsk: 'dir' } });
    await expect(page.locator('.q-name')).toHaveText('Galicia');
    await expect(page.locator('.hud-main')).toHaveText('1 / 1');
    const from = ((await page.locator('.bearing-from b').textContent()) ?? '').trim();
    expect(from).not.toBe('Galicia');
    expect(from.length).toBeGreaterThan(3);
    await rose(page, 'sureste').click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-bad/);
    await expect(page.locator('.verdict')).toContainText(/Queda al (norte|noroeste|oeste)/);
    await expect(page.locator('.rose .rose-btn.right')).toHaveCount(1);
    await expect(page.locator('.rose .rose-btn.wrong')).toHaveCount(1);
    await expect(page.locator('.map-svg [data-id="ES-GA"]')).toHaveClass(/st-bad/);
    await expect(labels(page)).toHaveCount(2);
    expect((await labels(page).allTextContents()).sort()).toEqual(['Galicia', from].sort());
    await page.getByRole('button', { name: 'Ver resultado' }).click();
    await expect(page.locator('.results')).toContainText('En los rumbos, el punto de al lado cuenta como acierto con ayuda cuando el sitio cae hacia ese lado.');
    await expect(page.locator('.results-group.g-bad .row-name small')).toHaveText(new RegExp(`^(norte|noroeste|oeste) · desde ${from}$`));
  });

  test('leaves the cities off the map until the answer, and says whose each is on a map of several countries', async ({ page }) => {
    await start(page, { section: 'cities', countries: ['ES', 'IT'], mode: 'bearing', opts: { cityPick: 'top', cityCount: 20, length: 10, bearingAsk: 'dir' } });
    await expect(page.locator('.hud-main')).toHaveText('1 / 10');
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(0);
    // Nothing to say about centres where the places are dots.
    await expect(page.locator('.q-how')).toHaveCount(0);
    await expect(page.locator('.q-prompt .q-sub')).toHaveText(/España|Italia/);
    await expect(page.locator('.bearing-from small')).toHaveText(/España|Italia/);
    await rose(page, 'norte').click();
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.locator('.map-svg .m-dot')).toHaveCount(2);
    await expect(labels(page)).toHaveCount(2);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(1);
  });

  test('is offered where the pieces have a place, with the choice of what to ask', async ({ page }) => {
    await seed(page);
    const mode = () => page.getByRole('group', { name: 'Vecinos y posición' }).getByRole('button', { name: /^Distancias y rumbos/ });
    for (const [route, about] of [
      ['/paises', 'Se mide de centro a centro.'],
      ['/ciudades', 'De ciudad a ciudad, en línea recta.'],
      ['/regiones', 'Se mide de centro a centro.'],
    ]) {
      await open(page, route);
      await mode().click();
      await expect(page.locator('.mode-about'), route).toContainText('¿hacia dónde queda un sitio desde otro, y a cuántos kilómetros?');
      await expect(page.locator('.mode-about'), route).toContainText(about);
    }
    // Rivers and ranges have no centre to measure from.
    await open(page, '/fisica');
    await expect(page.getByRole('button', { name: /^Distancias y rumbos/ })).toHaveCount(0);

    await open(page, '/regiones');
    await mode().click();
    const ask = page.getByRole('radiogroup', { name: 'Qué se pregunta' });
    await expect(ask.getByRole('radio')).toHaveText(['Las dos cosas', 'Rumbo', 'Distancia']);
    await expect(ask.getByRole('radio', { name: 'Las dos cosas' })).toBeChecked();
    await ask.getByRole('radio', { name: 'Distancia' }).click();
    await expect(page.locator('.opt-hint', { hasText: 'A cuántos kilómetros está cada sitio de otro' })).toBeVisible();
    await page.getByRole('button', { name: /Empezar/ }).click();
    await expect(page.locator('.play-title strong')).toHaveText('Distancias y rumbos');
    await expect(page.locator('.kicker')).toHaveText('¿A qué distancia está?');
    await expect(page.locator('.bearing-km .choice')).toHaveCount(4);
    const state = await page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { game: { mode: string; opts: { bearingAsk: string } } });
    expect(state.game).toMatchObject({ mode: 'bearing', opts: { bearingAsk: 'dist' } });
  });

  test('speaks English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { levels: {}, nonce: 1, ...FAR, mode: 'bearing', opts: { ...OPTS, bearingAsk: 'dir' } } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-loading')).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator('.play-title strong')).toHaveText('Distances and bearings');
    await expect(page.locator('.kicker')).toHaveText('Which way is it?');
    const asked = ((await page.locator('.q-name').textContent()) ?? '').trim();
    expect(['Portugal', 'Japan']).toContain(asked);
    await expect(page.locator('.bearing-from')).toHaveText(`From ${asked === 'Japan' ? 'Portugal' : 'Japan'}`);
    await expect(page.locator('.rose .rose-btn b')).toHaveText(['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE']);
    await rose(page, asked === 'Japan' ? 'west' : 'east').click();
    await expect(page.locator('.verdict')).toContainText(asked === 'Japan' ? 'It lies to the east' : 'It lies to the west');
    await expect(page.locator('.verdict .bearing-line')).toHaveText(/: to the (east|west) \(\d+°\), about [\d,]+ km as the crow flies\.$/);
  });
});

test.describe('distances and bearings on a phone @movil', () => {
  test('shows the whole compass in the panel, above the map, without a scroll', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'bearing', opts: { bearingAsk: 'dir' } });
    await expect(page.locator('.rose .rose-btn')).toHaveCount(8);
    const map = (await page.locator('.map-svg').boundingBox())!;
    for (const name of ['noroeste', 'sur', 'sureste']) {
      const box = (await rose(page, name).boundingBox())!;
      expect(box.y, name).toBeGreaterThan(0);
      expect(box.y + box.height, name).toBeLessThanOrEqual(map.y + 1);
      // Big enough for a finger.
      expect(box.height, name).toBeGreaterThanOrEqual(44);
    }
    await rose(page, 'sur').tap();
    await expect(page.locator('.verdict')).toBeVisible();
    await expect(page.locator('.q-actions .btn-primary')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
