import { expect, test, type Page } from '@playwright/test';
import { open, seed, start } from './helpers';

const CONTINENTS = { section: 'physical', countries: ['continent'] };
type Spot = { x: number; y: number };

/** What a click reaches at each place of a grid laid over the map: the id of a piece, or nothing. */
interface Grid {
  ids: string[];
  rows: number[][];
  left: number;
  top: number;
  step: number;
}

async function scan(page: Page, step = 4): Promise<Grid> {
  return page.evaluate((step) => {
    const box = document.querySelector('.map-svg')!.getBoundingClientRect();
    const ids = [''];
    const index = new Map<string, number>([['', 0]]);
    const rows: number[][] = [];
    for (let y = box.top + 2; y < box.bottom; y += step) {
      const row: number[] = [];
      for (let x = box.left + 2; x < box.right; x += step) {
        const id = document.elementFromPoint(x, y)?.getAttribute('data-id') ?? '';
        if (!index.has(id)) {
          index.set(id, ids.length);
          ids.push(id);
        }
        row.push(index.get(id)!);
      }
      rows.push(row);
    }
    return { ids, rows, left: box.left + 2, top: box.top + 2, step };
  }, step);
}

const at = (grid: Grid, col: number, row: number): string => grid.ids[grid.rows[row]?.[col] ?? 0];
const spot = (grid: Grid, col: number, row: number): Spot => ({ x: grid.left + col * grid.step, y: grid.top + row * grid.step });

/** A place on screen where a click reaches a piece: the one with the most of the piece around it. */
function spotOn(grid: Grid, id: string): Spot | null {
  let best: { col: number; row: number; room: number } | null = null;
  grid.rows.forEach((cells, row) =>
    cells.forEach((_, col) => {
      if (at(grid, col, row) !== id) return;
      let room = 0;
      while (room < 60 && [at(grid, col - room - 1, row), at(grid, col + room + 1, row), at(grid, col, row - room - 1), at(grid, col, row + room + 1)].every((x) => x === id)) room++;
      if (!best || room > best.room) best = { col, row, room };
    }),
  );
  const found = best as { col: number; row: number } | null;
  return found && spot(grid, found.col, found.row);
}

const LANDS = ['c:europe', 'c:asia', 'c:africa', 'c:americas', 'c:oceania', 'c:antarctica'];

/**
 * A place in the Mediterranean on the map of the continents, found the way it is told at school: water with
 * Europe to the north, Africa to the south and land on both sides, as far from all of them as it gets.
 */
function betweenEuropeAndAfrica(grid: Grid, water: string): Spot | null {
  /** The first continent met from a place in one direction, and after how many steps. */
  const look = (col: number, row: number, dc: number, dr: number): { id: string; n: number } => {
    for (let n = 1; ; n++) {
      const c = col + n * dc;
      const r = row + n * dr;
      if (r < 0 || r >= grid.rows.length || c < 0 || c >= grid.rows[r].length) return { id: '', n };
      const id = at(grid, c, r);
      if (LANDS.includes(id)) return { id, n };
    }
  };
  let best: { col: number; row: number; room: number } | null = null;
  grid.rows.forEach((cells, row) =>
    cells.forEach((_, col) => {
      if (at(grid, col, row) !== water) return;
      const north = look(col, row, 0, -1);
      const south = look(col, row, 0, 1);
      const west = look(col, row, -1, 0);
      const east = look(col, row, 1, 0);
      if (north.id !== 'c:europe' || south.id !== 'c:africa') return;
      if (!['c:europe', 'c:africa'].includes(west.id) || !['c:europe', 'c:asia'].includes(east.id)) return;
      const room = Math.min(north.n, south.n, west.n, east.n);
      if (!best || room > best.room) best = { col, row, room };
    }),
  );
  const found = best as { col: number; row: number } | null;
  return found && spot(grid, found.col, found.row);
}

test.describe('continents and oceans', () => {
  test('are the first thing to choose, and only on the map of the whole world', async ({ page }) => {
    await seed(page, { sel: { physical: ['river'] }, mode: { physical: 'pin' } });
    await open(page, '/fisica');
    const kinds = page.locator('.phys .frow').first();
    const places = page.locator('.phys .frow').nth(1);
    const list = page.locator('.phys-list');
    await expect(places.getByRole('button', { name: 'Todo el mundo' })).toHaveAttribute('aria-pressed', 'true');
    const first = kinds.getByRole('button').first();
    await expect(first).toHaveText(/^Continentes y océanos\s*11$/);
    // What else there is to choose since: peninsulas, capes of the world and the four waterfalls of the source.
    await expect(kinds.getByRole('button', { name: /Penínsulas/ })).toContainText('15');
    await expect(kinds.getByRole('button', { name: /Cabos/ })).toContainText('12');
    await expect(kinds.getByRole('button', { name: /Cataratas/ })).toContainText('4');

    await first.click();
    await kinds.getByRole('button', { name: /Ríos/ }).click();
    // The six continents as they are counted at school in Spain, then the five oceans.
    await expect(list.locator('section')).toHaveCount(1);
    await expect(list.locator('section p')).toHaveText('África · América · Antártida · Asia · Europa · Oceanía · Océano Antártico · Océano Ártico · Océano Atlántico · Océano Índico · Océano Pacífico');
    await expect(page.locator('.startbar')).toContainText('Continentes y océanos · mundo · 11 continentes y océanos');

    // With the seas the oceans are not counted twice.
    await kinds.getByRole('button', { name: /Mares y océanos/ }).click();
    await expect(list.locator('section').first().locator('h3')).toContainText('11');
    await expect(list.locator('section').nth(1)).not.toContainText('Océano Atlántico');
    await expect(list.locator('section').nth(1)).toContainText('Mar Mediterráneo');
    await kinds.getByRole('button', { name: /Mares y océanos/ }).click();

    // A continent's own map has no continents to ask about: the choice says so and offers nothing to start.
    await places.getByRole('button', { name: 'Europa' }).click();
    await expect(first).toHaveText(/^Continentes y océanos\s*0$/);
    await expect(list).toContainText('No hay nada de eso ahí');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();
    // …and once let go there, it is no longer offered.
    await kinds.getByRole('button', { name: /Ríos/ }).click();
    await first.click();
    await expect(kinds.getByRole('button', { name: /Continentes y océanos/ })).toHaveCount(0);
    await expect(list).toContainText('Danubio');
  });

  test('draw eleven pieces, each continent with its tint, and tell the surface of each', async ({ page }) => {
    await start(page, { ...CONTINENTS, mode: 'explore' });
    await expect(page.locator('.play-title span')).toHaveText('Continentes y océanos · Mundo');
    const map = page.locator('.map-svg');
    await expect(map.locator('path.k-continent')).toHaveCount(6, { timeout: 30_000 });
    await expect(map.locator('path.k-ocean')).toHaveCount(5);
    // Each continent in a colour of its own: there is no telling them apart otherwise.
    const tints = await map.locator('path.k-continent').evaluateAll((els) => els.map((el) => getComputedStyle(el).fill));
    expect(new Set(tints).size).toBe(6);
    // Every name is written inside the picture.
    const frame = (await map.boundingBox())!;
    const labels = map.locator('text.m-lbl');
    await expect(labels).toHaveCount(11);
    for (const box of await labels.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number }))) {
      expect(box.left).toBeGreaterThanOrEqual(frame.x);
      expect(box.right).toBeLessThanOrEqual(frame.x + frame.width);
      expect(box.top).toBeGreaterThanOrEqual(frame.y);
      expect(box.bottom).toBeLessThanOrEqual(frame.y + frame.height);
    }

    await page.locator('.index').getByRole('button', { name: 'Asia', exact: true }).click();
    const card = page.locator('.card-item');
    await expect(card.locator('.kicker')).toHaveText(/continente/i);
    await expect(card.locator('.q-name')).toContainText('Asia');
    await expect(card.locator('.datalist')).toContainText('44,6 millones de km²');
    await page.locator('.index').getByRole('button', { name: 'Océano Pacífico' }).click();
    await expect(card.locator('.kicker')).toHaveText(/océano/i);
    await expect(card.locator('.datalist')).toContainText('169 millones de km²');
  });

  test('take the Mediterranean for the Atlantic: with no sea to ask, every sea answers for its ocean', async ({ page }) => {
    await start(page, { ...CONTINENTS, mode: 'pin', only: ['s:atlantic-ocean'] });
    await expect(page.locator('.q-name')).toHaveText(/Océano Atlántico/);
    await expect(page.locator('.map-svg path.k-ocean')).toHaveCount(5, { timeout: 30_000 });
    const sea = betweenEuropeAndAfrica(await scan(page, 3), 's:atlantic-ocean');
    expect(sea, 'no water between Europe and Africa answers for the Atlantic').not.toBeNull();
    await page.mouse.click(sea!.x, sea!.y);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
  });

  test('tell a continent from the one next to it', async ({ page }) => {
    await start(page, { ...CONTINENTS, mode: 'pin', only: ['c:europe'] });
    await expect(page.locator('.q-name')).toHaveText(/Europa/);
    await expect(page.locator('.map-svg path.k-continent')).toHaveCount(6, { timeout: 30_000 });
    const grid = await scan(page);
    const asia = spotOn(grid, 'c:asia')!;
    await page.mouse.click(asia.x, asia.y);
    await expect(page.locator('.q-note')).toHaveText('Eso es Asia.');
    // Right at the second try: settled, though not as known at once.
    const europe = spotOn(grid, 'c:europe')!;
    await page.mouse.click(europe.x, europe.y);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(page.locator('.verdict')).toContainText('9,95 millones de km²');
  });

  test('go on a blank map to print with eleven numbers', async ({ page }) => {
    await start(page, { ...CONTINENTS, mode: 'print' });
    const sheet = page.locator('.sheet[data-sheet="map"]');
    await expect(sheet).toBeVisible({ timeout: 30_000 });
    await expect(sheet.locator('.sheet-head h2')).toHaveText('Continentes y océanos · Mundo');
    const numbers = (await sheet.locator('.sheet-map .sm-num text').allTextContents()).map(Number).sort((a, b) => a - b);
    expect(numbers).toEqual(Array.from({ length: 11 }, (_, i) => i + 1));
    await expect(sheet.locator('.sheet-list li')).toHaveCount(11);
  });

  test('fit a phone @movil', async ({ page }) => {
    await seed(page, { sel: { physical: ['continent'] }, mode: { physical: 'pin' } });
    await open(page, '/fisica');
    await expect(page.locator('.phys-list')).toContainText('Oceanía');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.map-svg path.k-continent')).toHaveCount(6, { timeout: 30_000 });
    await expect(page.locator('.q-name')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('seas, peninsulas, capes and waterfalls', () => {
  test('with the seas on the map, the sea is the sea and the ocean is the open ocean', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'pin', countries: ['sea', 'EU'], only: ['s:atlantic-ocean'] });
    await expect(page.locator('.q-name')).toHaveText(/Océano Atlántico/);
    await expect(page.locator('.map-svg path[data-id="s:mediterranean-sea"]').first()).toBeVisible({ timeout: 30_000 });
    const sea = spotOn(await scan(page), 's:mediterranean-sea')!;
    await page.mouse.click(sea.x, sea.y);
    await expect(page.locator('.q-note')).toHaveText('Eso es Mar Mediterráneo.');
  });

  // The open Arctic begins north of Svalbard, past the edge of a map drawn by the countries of Europe; Asia by
  // its countries ends in Kazakhstan and Mongolia, far from the Bering Sea. Both were asked with nothing to click.
  for (const [where, place, id, name] of [
    ['Europe', 'EU', 's:arctic-ocean', 'Océano Ártico'],
    ['Asia', 'AS', 's:bering-sea', 'Mar de Bering'],
  ] as const)
    test(`what is asked is on screen: ${name} on the map of ${where}`, async ({ page }) => {
      await start(page, { section: 'physical', mode: 'pin', countries: ['sea', place], only: [id] });
      await expect(page.locator('.q-name')).toHaveText(new RegExp(name));
      await expect(page.locator(`.map-svg path[data-id="${id}"]`).first()).toBeAttached({ timeout: 30_000 });
      const water = spotOn(await scan(page), id);
      expect(water, `${name} cannot be reached on the map of ${where}`).not.toBeNull();
      await page.mouse.click(water!.x, water!.y);
      await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    });

  test('a peninsula is a tinted shape, a cape a diamond and a waterfall a drop', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'pin', countries: ['peninsula', 'cape', 'fall'], only: ['f:niagara-falls'] });
    await expect(page.locator('.play-title span')).toHaveText('Geografía física · Mundo');
    const map = page.locator('.map-svg');
    await expect(map.locator('path.k-peninsula')).toHaveCount(15, { timeout: 30_000 });
    await expect(map.locator('.m-dot.k-cape')).toHaveCount(12);
    await expect(map.locator('.m-dot.k-fall')).toHaveCount(4);
    await expect(page.locator('.q-name')).toHaveText(/Cataratas del Niágara/);
    const box = (await map.locator('.m-dot.k-fall[data-id="f:niagara-falls"]').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
  });

  test('the map of a country has its share of them, named on the part that is in sight', async ({ page }) => {
    await start(page, { section: 'physical', mode: 'explore', countries: ['plain', 'peninsula', 'in:FR', 'all'] });
    await expect(page.locator('.play-title span')).toContainText('Francia');
    const map = page.locator('.map-svg');
    await expect(map.locator('path[data-id="p:brittany"]')).toBeVisible({ timeout: 30_000 });
    await expect(map.locator('path[data-id="p:european-plain"]')).toBeAttached();
    await expect(map.locator('[data-id="p:iberian-peninsula"]')).toHaveCount(0);
    // The plain runs to the Urals; its name is written on France's corner of it.
    const frame = (await map.boundingBox())!;
    const label = (await map.locator('text.m-lbl', { hasText: 'Gran Llanura Europea' }).boundingBox())!;
    expect(label.x).toBeGreaterThanOrEqual(frame.x);
    expect(label.x + label.width).toBeLessThanOrEqual(frame.x + frame.width);
    expect(label.y).toBeGreaterThanOrEqual(frame.y);
    expect(label.y + label.height).toBeLessThanOrEqual(frame.y + frame.height);
  });
});
