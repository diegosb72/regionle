/**
 * The route game with a rule to keep: a piece that is closed and has to be gone around, a third piece to call
 * at, or land borders only. Which route comes up is the game's choice: each test reads it from the page and
 * checks it against the borders in the data, worked out here on its own.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start, type } from './helpers';

interface Fact {
  id: string;
  cl: string;
  n: { es: string; en?: string };
  nb?: string[];
  sl?: string[];
}
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Fact[] };
const byId = new Map(index.countries.map((c) => [c.id, c]));
/** The countries of the map of the world. */
const WORLD = index.countries.filter((c) => ['un', 'obs', 'partial'].includes(c.cl)).map((c) => c.id);
const es = (id: string): string => byId.get(id)!.n.es;
const en = (id: string): string => byId.get(id)!.n.en ?? es(id);
const idOf = new Map(index.countries.map((c) => [c.n.es, c.id]));

type Graph = Map<string, string[]>;
/** The borders between some countries: by land and, unless told otherwise, by their short sea crossings too. */
function graphOf(ids: readonly string[], sea = true): Graph {
  const set = new Set(ids);
  return new Map(ids.map((id) => [id, [...(byId.get(id)!.nb ?? []), ...(sea ? (byId.get(id)!.sl ?? []) : [])].filter((nx) => set.has(nx))]));
}
/** Steps from one country to each of the others, never going through `closed`. */
function steps(graph: Graph, from: string, closed?: string): Map<string, number> {
  const dist = new Map([[from, 0]]);
  const queue = [from];
  for (let i = 0; i < queue.length; i++)
    for (const nx of graph.get(queue[i]) ?? []) {
      if (dist.has(nx) || nx === closed) continue;
      dist.set(nx, dist.get(queue[i])! + 1);
      queue.push(nx);
    }
  return dist;
}

/** A shortest way from one country to another, both included, never through `closed`; null when there is none. */
function wayOf(graph: Graph, from: string, to: string, closed?: string): string[] | null {
  const prev = new Map<string, string | null>([[from, null]]);
  const queue = [from];
  for (let i = 0; i < queue.length && !prev.has(to); i++)
    for (const nx of graph.get(queue[i]) ?? []) {
      if (prev.has(nx) || nx === closed) continue;
      prev.set(nx, queue[i]);
      queue.push(nx);
    }
  if (!prev.has(to)) return null;
  const way: string[] = [];
  for (let id: string | null = to; id; id = prev.get(id) ?? null) way.unshift(id);
  return way;
}
/** Whether some countries hang together, going only through themselves. */
function together(graph: Graph, ids: readonly string[]): boolean {
  const set = new Set(ids);
  const seen = new Set([ids[0]]);
  const queue = [ids[0]];
  for (let i = 0; i < queue.length; i++)
    for (const nx of graph.get(queue[i]) ?? [])
      if (set.has(nx) && !seen.has(nx)) {
        seen.add(nx);
        queue.push(nx);
      }
  return seen.size === set.size;
}

const route = (rule: string, countries: readonly string[] = WORLD, opts: Record<string, unknown> = {}) => ({ section: 'countries', mode: 'travel', countries, opts: { routeRule: rule, ...opts } });
const kicker = (page: Page) => page.locator('.q .kicker');
const sub = (page: Page) => page.locator('.q-sub');
const note = (page: Page) => page.locator('.q-note[role="status"]');
const guesses = (page: Page) => page.locator('.guesses li');
const painted = (page: Page, st: string) => page.locator(`.map-svg .m-items path.st-${st}`);
/** The id of the only piece painted one way; null when none is. */
async function idOfPaint(page: Page, st: string): Promise<string | null> {
  const found = painted(page, st);
  return (await found.count()) ? found.first().getAttribute('data-id') : null;
}
/** The route on screen, as the map paints it. */
async function shown(page: Page): Promise<{ from: string; to: string; stop: string | null; shut: string | null }> {
  await expect(painted(page, 'from')).toHaveCount(1, { timeout: 30_000 });
  return { from: (await idOfPaint(page, 'from'))!, to: (await idOfPaint(page, 'to'))!, stop: await idOfPaint(page, 'stop'), shut: await idOfPaint(page, 'shut') };
}
const countries = (n: number): string => (n === 1 ? '1 país' : `${n} países`);
/** Asks for hints until the route is made: as many as pieces the best answer has. */
async function hintThrough(page: Page, needed: number): Promise<void> {
  for (let i = 0; i < needed; i++) {
    await expect(page.locator('.verdict')).toHaveCount(0);
    await page.getByRole('button', { name: 'Pista' }).click();
    await expect(guesses(page)).toHaveCount(i + 1);
  }
  await expect(page.locator('.verdict')).toBeVisible();
}
/** The best answer the game lists once the route is over, as ids, in the order it is travelled. */
const listed = async (page: Page): Promise<string[]> => (await page.locator('.path li b').allTextContents()).map((name) => idOf.get(name) ?? `?${name}`);

test.describe('a route with a rule to keep', () => {
  test('closes a piece of the shortest way, which has to be gone around', async ({ page }) => {
    await start(page, route('avoid'));
    const { from, to, stop, shut } = await shown(page);
    expect(stop).toBeNull();
    expect(shut).not.toBeNull();
    await expect(kicker(page)).toHaveText('Ruta con un cierre');
    await expect(page.locator('.q-route .end')).toHaveText([es(from), es(to)]);

    // The closed piece is on a shortest way between the two ends, and the way round is as long as the game says.
    const all = graphOf(WORLD);
    const a = steps(all, from);
    const b = steps(all, to);
    expect(a.get(shut!)! + b.get(shut!)!).toBe(a.get(to));
    const around = steps(all, from, shut!).get(to)!;
    expect(around).toBeGreaterThanOrEqual(a.get(to)!);
    expect(around - a.get(to)!).toBeLessThanOrEqual(3);
    await expect(sub(page)).toHaveText(`Sin pasar por ${es(shut!)}, la ruta más corta pasa por ${countries(around - 1)}. Las líneas de puntos son travesías cortas por mar.`);

    // It is drawn as a lattice, with its name, and the legend says what that is.
    await expect(painted(page, 'shut')).toHaveCSS('fill', /url\(.*#m-shut.*\)/);
    await expect(note(page)).toHaveText('El orden no importa: gana quien une los dos extremos.');
    await expect(page.locator('.legend li')).toHaveText(['en la ruta más corta', 'cerca', 'lejos', 'cerrado']);

    // Naming it is no step: it is said, and it is not counted.
    await type(page, es(shut!));
    await expect(note(page)).toHaveText(`Por ${es(shut!)} no se puede pasar: busca otro camino.`);
    await expect(guesses(page)).toHaveCount(0);
    await expect(page.locator('.play-top')).toContainText('0 intentos');
    await expect(painted(page, 'shut')).toHaveCount(1);

    await hintThrough(page, around - 1);
    await expect(page.locator('.verdict-head')).toContainText('¡Ruta perfecta!');
    await expect(page.locator('.verdict .facts')).toHaveText(`Has usado ${countries(around - 1)}; el mínimo era ${around - 1}.`);
    // The answer goes from one end to the other by countries that touch, and never through the closed one.
    const way = await listed(page);
    expect(way[0]).toBe(from);
    expect(way[way.length - 1]).toBe(to);
    expect(way).toHaveLength(around + 1);
    expect(way).not.toContain(shut);
    for (let i = 1; i < way.length; i++) expect(all.get(way[i - 1]), `${way[i - 1]} → ${way[i]}`).toContain(way[i]);
    // The closed piece is still shown as what it was.
    await expect(painted(page, 'shut')).toHaveCount(1);
  });

  test('calls at a third piece that is out of the way', async ({ page }) => {
    await start(page, route('via'));
    const { from, to, stop, shut } = await shown(page);
    expect(shut).toBeNull();
    expect(stop).not.toBeNull();
    await expect(kicker(page)).toHaveText('Ruta con una parada');
    // The stop is told between the two ends.
    await expect(page.locator('.q-route .end')).toHaveText([es(from), es(stop!), es(to)]);

    // It is off every shortest way, and the smallest set of countries that joins the three is as large as the game says.
    const all = graphOf(WORLD);
    const [a, m, b] = [steps(all, from), steps(all, stop!), steps(all, to)];
    expect(a.get(stop!)! + b.get(stop!)!).toBeGreaterThan(a.get(to)!);
    let tree = Infinity;
    for (const id of WORLD) if (a.has(id) && m.has(id) && b.has(id)) tree = Math.min(tree, a.get(id)! + m.get(id)! + b.get(id)!);
    const needed = tree - 2;
    expect(needed).toBeGreaterThanOrEqual(a.get(to)! - 1);
    expect(needed - (a.get(to)! - 1)).toBeLessThanOrEqual(3);
    await expect(sub(page)).toHaveText(
      `Hay que parar en ${es(stop!)}: la ruta más corta pasa por ${needed === 1 ? 'otro país' : `otros ${needed} países`}. Las líneas de puntos son travesías cortas por mar.`,
    );
    await expect(page.locator('.legend li')).toHaveText(['en la ruta más corta', 'cerca', 'lejos', 'parada']);
    await expect(note(page)).toHaveText('El orden no importa: gana quien une los dos extremos y la parada.');
    // It has a colour of its own, which is neither that of the start nor that of the end.
    const fill = (st: string) => painted(page, st).first().evaluate((el) => getComputedStyle(el).fill);
    expect(new Set([await fill('from'), await fill('to'), await fill('stop')]).size).toBe(3);

    // The stop is given: naming it adds nothing.
    await type(page, es(stop!));
    await expect(note(page)).toHaveText(`${es(stop!)} ya está en el mapa.`);
    await expect(guesses(page)).toHaveCount(0);

    await hintThrough(page, needed);
    await expect(page.locator('.verdict-head')).toContainText('¡Ruta perfecta!');
    // The answer is travelled from one end to the other, calling at the stop: it may come back by where it went.
    const way = await listed(page);
    expect(way[0]).toBe(from);
    expect(way[way.length - 1]).toBe(to);
    expect(way).toContain(stop);
    for (let i = 1; i < way.length; i++) expect(all.get(way[i - 1]), `${way[i - 1]} → ${way[i]}`).toContain(way[i]);
    expect(new Set(way).size - 3).toBe(needed);
    await expect(page.locator('.path li.stop b')).toHaveText(es(stop!));
  });

  test('by land only does without the sea crossings, and does not draw them', async ({ page }) => {
    await start(page, route('land'));
    const { from, to, stop, shut } = await shown(page);
    expect([stop, shut]).toEqual([null, null]);
    await expect(kicker(page)).toHaveText('Ruta solo por tierra');
    const land = steps(graphOf(WORLD, false), from).get(to)!;
    const sea = steps(graphOf(WORLD), from).get(to)!;
    // A crossing would bring the two closer: that is why they were picked.
    expect(land).toBeGreaterThan(sea);
    await expect(sub(page)).toHaveText(`Solo por tierra, sin travesías por mar: la ruta más corta pasa por ${countries(land - 1)}.`);
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(0);
    await expect(page.locator('.legend li')).toHaveText(['en la ruta más corta', 'cerca', 'lejos']);

    await hintThrough(page, land - 1);
    await expect(page.locator('.verdict-head')).toContainText('¡Ruta perfecta!');
    const way = await listed(page);
    expect(way).toHaveLength(land + 1);
    const byLand = graphOf(WORLD, false);
    for (let i = 1; i < way.length; i++) expect(byLand.get(way[i - 1]), `${way[i - 1]} → ${way[i]}`).toContain(way[i]);

    // Another route keeps the rule; the plain game on the same map draws its crossings.
    await page.getByRole('button', { name: 'Otra ruta' }).click();
    await expect(kicker(page)).toHaveText('Ruta solo por tierra');
    await expect(guesses(page)).toHaveCount(0);
    await restart(page, route('none'));
    await expect(kicker(page)).toHaveText('El camino más corto');
    await expect(page.locator('.map-svg .m-links line').first()).toBeAttached();
    await expect(sub(page)).toContainText('Las líneas de puntos son travesías cortas por mar.');
  });

  test('what is typed joins the route only as the rule lets it', async ({ page }) => {
    const all = graphOf(WORLD);
    const verdict = page.locator('.verdict');
    let taken = 0;
    /**
     * Types some countries one by one, until the route is made or they run out. Every one is taken as a step.
     * (What was typed before may join with them sooner than the way they were taken from would: the game
     * says when.)
     */
    const typeAll = async (list: readonly string[]): Promise<void> => {
      for (const id of list) {
        if (await verdict.count()) return;
        await type(page, es(id));
        await expect(guesses(page)).toHaveCount(++taken);
        await expect(guesses(page).last()).toContainText(es(id));
      }
    };
    /** The route is made, with as many countries as were typed; never with fewer than the game said it takes. */
    const made = async (least: number): Promise<void> => {
      await expect(verdict).toBeVisible();
      expect(taken).toBeGreaterThanOrEqual(least);
      await expect(page.locator('.verdict .facts')).toHaveText(`Has usado ${countries(taken)}; el mínimo era ${least}.`);
      await expect(page.locator('.verdict-head')).toContainText(taken === least ? '¡Ruta perfecta!' : 'Ruta completada');
      await expect(page.locator('.verdict .stars .on')).toHaveCount(taken === least ? 3 : taken - least <= 2 ? 2 : 1);
    };

    // A closure: the shortest way goes through the closed country, and without it its other countries join nothing.
    await start(page, route('avoid'));
    const closed = await shown(page);
    const through = [...wayOf(all, closed.from, closed.shut!)!, ...wayOf(all, closed.shut!, closed.to)!.slice(1)];
    expect(through).toHaveLength(steps(all, closed.from).get(closed.to)! + 1);
    await typeAll(through.slice(1, -1).filter((id) => id !== closed.shut));
    expect(taken).toBe(through.length - 3);
    await type(page, es(closed.shut!));
    await expect(note(page)).toHaveText(`Por ${es(closed.shut!)} no se puede pasar: busca otro camino.`);
    await expect(guesses(page)).toHaveCount(taken);
    await expect(verdict).toHaveCount(0);
    await expect(page.locator('.play-top')).toContainText(`${taken} ${taken === 1 ? 'intento' : 'intentos'}`);
    // The way round does.
    const round = wayOf(all, closed.from, closed.to, closed.shut!)!;
    await typeAll(round.slice(1, -1).filter((id) => !through.includes(id)));
    await made(round.length - 2);

    // A stop: joining the two ends is not the route while the stop hangs loose.
    await restart(page, route('via'));
    taken = 0;
    let via = await shown(page);
    let plain = wayOf(all, via.from, via.to)!;
    for (let i = 0; i < 12 && together(all, [...plain, via.stop!]); i++) {
      // Hardly ever: a stop that touches the shortest way, which is given only when the game finds no other.
      await page.getByRole('button', { name: 'Otra ruta' }).click();
      via = await shown(page);
      plain = wayOf(all, via.from, via.to)!;
    }
    expect(together(all, [...plain, via.stop!])).toBe(false);
    const least = Number(/pasa por (?:otros (\d+) países|otro país)/.exec((await sub(page).textContent()) ?? '')?.[1] ?? 1);
    await typeAll(plain.slice(1, -1));
    expect(taken).toBe(plain.length - 2);
    await expect(verdict).toHaveCount(0);
    // From the stop to the nearest country of what is joined already.
    const fromStop = steps(all, via.stop!);
    const near = [...plain].sort((x, y) => fromStop.get(x)! - fromStop.get(y)!)[0];
    const spur = wayOf(all, via.stop!, near)!.slice(1, -1);
    await typeAll(spur.slice(0, -1));
    await expect(verdict).toHaveCount(0);
    await typeAll(spur.slice(-1));
    await made(least);

    // By land only: the way that takes a sea crossing joins nothing.
    await restart(page, route('land'));
    taken = 0;
    const land = await shown(page);
    const bySea = wayOf(all, land.from, land.to)!;
    const byLand = wayOf(graphOf(WORLD, false), land.from, land.to)!;
    expect(bySea.length).toBeLessThan(byLand.length);
    await typeAll(bySea.slice(1, -1));
    expect(taken).toBe(bySea.length - 2);
    await expect(verdict).toHaveCount(0);
    await typeAll(byLand.slice(1, -1).filter((id) => !bySea.includes(id)));
    await made(byLand.length - 2);
  });

  test('the route of a day is the same for everyone: it takes no rule', async ({ page }) => {
    const DAY = '2026-11-15';
    await start(page, { ...route('avoid'), daily: DAY });
    const first = await shown(page);
    await expect(kicker(page)).toHaveText(/^Ruta del día · 15 de noviembre/);
    expect([first.stop, first.shut]).toEqual([null, null]);
    await expect(page.locator('.route-plain')).toHaveCount(0);
    await expect(page.locator('.legend li')).toHaveCount(3);
    // With another rule asked for, and with none, the same two ends.
    await restart(page, { ...route('via'), daily: DAY });
    expect(await shown(page)).toEqual(first);
    await restart(page, { ...route('none'), daily: DAY });
    expect(await shown(page)).toEqual(first);
  });

  test('plays a plain route, and says so, where the map has none of the kind', async ({ page }) => {
    // Portugal hangs from Spain, and Spain from France: closing either cuts the map in two.
    const IBERIA = ['PT', 'ES', 'FR', 'AD'];
    await start(page, route('avoid', IBERIA));
    await shown(page);
    await expect(kicker(page)).toHaveText('El camino más corto');
    await expect(page.locator('.route-plain')).toHaveText('Este mapa no da para una ruta con un cierre: esta va sin condición.');
    await expect(painted(page, 'shut')).toHaveCount(0);
    // This map has no sea crossing, and so no dotted lines to speak of.
    await expect(page.locator('.map-svg .m-links line')).toHaveCount(0);
    await expect(sub(page)).toHaveText(/^(Se tocan|La ruta más corta pasa por 1 país)\.$/);
    await expect(page.locator('.legend li')).toHaveText(['en la ruta más corta', 'cerca', 'lejos']);

    // Nor is there a crossing to do without.
    await restart(page, route('land', IBERIA));
    await shown(page);
    await expect(kicker(page)).toHaveText('El camino más corto');
    await expect(page.locator('.route-plain')).toHaveText('Este mapa no da para una ruta solo por tierra: esta va sin condición.');

    // Without a rule nothing is said.
    await restart(page, route('none', IBERIA));
    await shown(page);
    await expect(page.locator('.route-plain')).toHaveCount(0);
  });

  test('is chosen before starting, only for the route game, and kept with the game played', async ({ page }) => {
    await seed(page, {});
    await open(page, '/paises/ES+FR+PT+IT+DE+CH+AT/travel');
    const rules = page.getByRole('radiogroup', { name: 'Condición de la ruta' });
    await expect(rules.getByRole('radio')).toHaveText(['Ninguna', 'Un cierre', 'Una parada', 'Solo por tierra']);
    await expect(rules.getByRole('radio', { name: 'Ninguna' })).toBeChecked();
    const hint = page.locator('.opt', { has: rules }).locator('.opt-hint');
    await expect(hint).toHaveText('El camino más corto entre dos piezas, sin más.');
    await rules.getByRole('radio', { name: 'Una parada' }).click();
    await expect(hint).toHaveText('Además de unir los dos extremos, la ruta tiene que llegar a una tercera pieza que queda a desmano.');
    await rules.getByRole('radio', { name: 'Solo por tierra' }).click();
    await expect(hint).toHaveText('Las travesías cortas por mar no valen: solo cuentan las fronteras por tierra. Hace falta un mapa con travesías, como el del mundo.');
    await rules.getByRole('radio', { name: 'Un cierre' }).click();
    await expect(hint).toHaveText('Una pieza del camino más corto está cerrada: hay que rodearla.');
    await expect(rules.getByRole('radio', { name: 'Un cierre' })).toBeChecked();

    await page.getByRole('button', { name: 'Empezar' }).click();
    const { shut } = await shown(page);
    await expect(kicker(page)).toHaveText('Ruta con un cierre');
    expect(shut).not.toBeNull();
    // On this map the closed country leaves a way as short as the one through it: it only narrows the choice.
    const needed = Number(/pasa por (\d+) país/.exec((await sub(page).textContent()) ?? '')?.[1]);
    await hintThrough(page, needed);

    // The first page offers it again as the game it was, and it is played again with its rule.
    await open(page, '/');
    const again = page.locator('.recent-list li button').first();
    await expect(again.locator('.recent-what')).toHaveText('Países · Ruta · con un cierre');
    await again.click();
    await shown(page);
    await expect(kicker(page)).toHaveText('Ruta con un cierre');

    // Another game has no such thing to choose.
    await open(page, '/paises/ES+FR+PT+IT+DE+CH+AT/pin');
    await expect(page.locator('.opt-label').first()).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Condición de la ruta' })).toHaveCount(0);
  });

  test('speaks English with whoever plays in English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { levels: {}, nonce: 1, ...route('via'), opts: { ...OPTS, routeRule: 'via' } } });
    await page.goto('./#/jugar');
    const via = await shown(page);
    await expect(kicker(page)).toHaveText('Route with a stop');
    await expect(sub(page)).toHaveText(new RegExp(`^You have to call at ${en(via.stop!).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}: the shortest route goes through (one other country|\\d+ other countries)\\. Dotted lines are short sea crossings\\.$`));
    await expect(page.locator('.legend li')).toHaveText(['on the shortest route', 'close', 'far', 'stop']);
    await type(page, en(via.stop!));
    await expect(note(page)).toHaveText(`${en(via.stop!)} is already on the map.`);

    await restart(page, route('avoid'));
    const closed = await shown(page);
    await expect(kicker(page)).toHaveText('Route with a closure');
    await expect(sub(page)).toContainText(`Without going through ${en(closed.shut!)}, the shortest route goes through `);
    await expect(page.locator('.legend li').last()).toHaveText('closed');
    await type(page, en(closed.shut!));
    await expect(note(page)).toHaveText(`There is no way through ${en(closed.shut!)}: look for another.`);

    await restart(page, route('land'));
    await shown(page);
    await expect(kicker(page)).toHaveText('Route by land only');
    await expect(sub(page)).toHaveText(/^By land only, without sea crossings: the shortest route goes through \d+ countr(y|ies)\.$/);

    await restart(page, route('avoid', ['PT', 'ES', 'FR', 'AD']));
    await shown(page);
    await expect(page.locator('.route-plain')).toHaveText('This map has no route with a closure: this one has no condition.');
  });

  test('fits a phone: three ends and what is said of them are no wider than the screen @movil', async ({ page }) => {
    // The narrowest phone, with the largest letter and the widest typeface.
    await page.setViewportSize({ width: 320, height: 640 });
    await seed(page, { textSize: 'xl', dyslexia: true, game: { levels: {}, nonce: 1, ...route('via'), opts: { ...OPTS, routeRule: 'via' } } });
    await page.goto('./#/jugar');
    await shown(page);
    await expect(page.locator('.q-route .end')).toHaveCount(3);
    const fits = () =>
      page.evaluate(() => {
        const screen = document.documentElement.clientWidth;
        const within = (el: Element) => {
          const r = el.getBoundingClientRect();
          return r.left >= 0 && r.right <= screen + 0.5 && r.width > 0;
        };
        return { wide: document.documentElement.scrollWidth - screen, inside: [...document.querySelectorAll('.q-route .end, .q-sub, .legend li, .q-actions .btn, .answer-input')].every(within) };
      });
    expect(await fits()).toEqual({ wide: 0, inside: true });
    // With the answer on show too, which lists every step there and back.
    await page.getByRole('button', { name: 'Me rindo' }).click();
    await expect(page.locator('.verdict')).toBeVisible();
    expect(await fits()).toEqual({ wide: 0, inside: true });
    expect(await page.evaluate(() => [...document.querySelectorAll('.path li')].every((li) => li.getBoundingClientRect().right <= document.documentElement.clientWidth + 0.5))).toBe(true);
  });
});
