import { expect, test, type Page } from '@playwright/test';
import { open, seed } from './helpers';

/** The narrowest phones the game is drawn for, in CSS pixels. */
const WIDTHS = [360, 320];

const at = (day: string, hour = 12): number => new Date(`${day}T${String(hour).padStart(2, '0')}:00:00+01:00`).getTime();
/** A player with fourteen games behind, on maps with long names, and months with something done. */
const SESSIONS = Array.from({ length: 14 }, (_, i) => ({
  t: at('2026-11-18') - i * 7 * 3_600_000,
  section: i % 3 ? 'countries' : 'regions',
  mode: ['pin', 'identify', 'capital', 'flag', 'outline', 'border', 'coords', 'chain', 'whoami', 'group'][i % 10],
  label: i % 3 ? 'Europa · 44 países' : 'España · comunidades autónomas',
  total: 10 + i,
  ok: 6 + (i % 4),
  warn: 2,
  bad: 2 + i - (i % 4),
  ms: 60_000 + i * 4_000,
}));
const PLAYER = {
  sessions: SESSIONS,
  days: { '2026-11-18': [2, 25, 20, 120_000, 1, 28], '2026-11-17': [1, 12, 9, 50_000, 0, 20], '2026-10-30': [3, 64, 50, 300_000, 1] },
  tot: { g: 14, q: 250, ok: 120, warn: 28, ms: 1_200_000 },
};

/** What is drawn past the right edge of the screen, or in a box that has to be scrolled sideways to be seen. */
async function sticksOut(page: Page, within: string): Promise<string[]> {
  return page.evaluate((sel) => {
    const width = document.documentElement.clientWidth;
    const out: string[] = [];
    if (document.documentElement.scrollWidth > width) out.push(`the page is ${document.documentElement.scrollWidth}px wide`);
    for (const box of document.querySelectorAll<HTMLElement>(sel)) {
      if (box.scrollWidth > box.clientWidth + 1) out.push(`${box.className}: ${box.scrollWidth}px in ${box.clientWidth}px`);
      for (const el of box.querySelectorAll<HTMLElement>('*')) {
        const r = el.getBoundingClientRect();
        // What is hidden on purpose (the headings of a table that is drawn as a list) takes no room.
        if (r.width <= 1 || r.height <= 1) continue;
        if (r.right > width + 0.5 || r.left < -0.5) out.push(`${el.tagName} "${(el.textContent ?? '').trim().slice(0, 24)}" at ${Math.round(r.left)}–${Math.round(r.right)}`);
      }
    }
    return out;
  }, within);
}

test.describe('on a narrow phone', () => {
  for (const width of WIDTHS) {
    test(`the latest games and the months of Progress fit in ${width} px, with nothing to scroll sideways`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await page.clock.setFixedTime(new Date('2026-11-18T18:00:00+01:00'));
      await seed(page, PLAYER);
      await open(page, '/progreso');
      await expect(page.locator('.sessions.games tbody tr')).toHaveCount(14);
      expect(await sticksOut(page, '.table-wrap')).toEqual([]);

      // Each game is three lines: what was played and its score, the map, and when, how many first time and how long.
      const first = page.locator('.sessions.games tbody tr').first();
      const box = async (cls: string) => (await first.locator(cls).boundingBox())!;
      const [game, score, map, when, right, time] = [await box('.g-game'), await box('.g-score'), await box('.g-map'), await box('.g-when'), await box('.g-first'), await box('.g-time')];
      expect(Math.abs(game.y - score.y)).toBeLessThan(8);
      expect(score.x).toBeGreaterThan(game.x + game.width - 1);
      expect(map.y).toBeGreaterThan(game.y + game.height - 2);
      expect(when.y).toBeGreaterThan(map.y + map.height - 2);
      expect(Math.abs(when.y - right.y)).toBeLessThan(4);
      expect(Math.abs(when.y - time.y)).toBeLessThan(4);
      await expect(first.locator('.g-game')).toHaveText('Señalar');
      await expect(first.locator('.g-map')).toHaveText('España · comunidades autónomas');
      await expect(first.locator('.g-score')).toHaveText('70 %');
      await expect(first.locator('.g-first')).toHaveText('6 / 10');
      // The number that has lost its heading says what it is.
      expect(await first.locator('.g-first').evaluate((el) => getComputedStyle(el, '::after').content)).toContain('a la primera');
      await expect(first.locator('.g-time')).toHaveText('1:00');
      // It is still a table for whoever hears it: six headings and six cells in a row.
      await expect(page.getByRole('table').filter({ has: page.locator('.g-game') }).getByRole('columnheader')).toHaveText(['Cuándo', 'Juego', 'Mapa', 'A la primera', 'Puntos', 'Tiempo']);
      await expect(first.getByRole('cell')).toHaveCount(6);
      // The months keep the four columns that matter.
      await expect(page.locator('.months-table thead th:visible')).toHaveText(['Mes', 'Días', 'Respuestas', 'A la primera']);
    });

    test(`the continents of the selector are all in sight in ${width} px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 760 });
      await seed(page);
      for (const route of ['/regiones', '/paises', '/ciudades']) {
        await open(page, route);
        const tabs = page.locator('.picker-tabs [role="tab"]');
        await expect(tabs, route).toHaveText([/^Todo/, /^Europa/, /^Asia/, /^África/, /^América/, /^Oceanía/]);
        expect(await sticksOut(page, '.picker-tabs'), route).toEqual([]);
        // More than one line of them, and no line taller than a finger needs.
        const tops = new Set((await tabs.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))) as number[]);
        expect(tops.size, route).toBeGreaterThan(1);
        expect(tops.size, route).toBeLessThan(4);
      }
      // The last one is chosen without looking for it.
      await page.locator('.picker-tabs [role="tab"]', { hasText: 'Oceanía' }).click();
      await expect(page.locator('.picker-tabs [role="tab"]', { hasText: 'Oceanía' })).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('.picker').getByText('Australia', { exact: true }).first()).toBeVisible();
    });
  }

  test('a table of six columns is a table again where there is room', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-18T18:00:00+01:00'));
    await seed(page, PLAYER);
    await open(page, '/progreso');
    const first = page.locator('.sessions.games tbody tr').first();
    const tops = (await first.locator('td').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))) as number[];
    expect(new Set(tops).size).toBe(1);
    await expect(page.locator('.sessions.games thead th').first()).toBeVisible();
    expect(await first.locator('.g-first').evaluate((el) => getComputedStyle(el, '::after').content)).toBe('none');
    // And the continents are one line.
    await open(page, '/paises');
    const tabs = (await page.locator('.picker-tabs [role="tab"]').evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)))) as number[];
    expect(new Set(tabs).size).toBe(1);
  });
});
