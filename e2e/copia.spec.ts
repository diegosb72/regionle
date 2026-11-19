/**
 * The backup of the Progress page: a copy says what it holds before it replaces what there is, brings the
 * preferences along if wanted, and the page reminds of the next one when a lot has been answered since.
 */
import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';
import { OPTS, open, seed } from './helpers';

const DAY = 86_400_000;
const IDS = ['AN', 'AR', 'AS', 'CB', 'CL', 'CM', 'CT', 'EX'].map((x) => `ES-${x}`);
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1') ?? '{}').state as Record<string, unknown>);

/** A player with eight answers and 412 questions behind them. */
function player(now: number, extra: Record<string, unknown> = {}) {
  const stats: Record<string, number[]> = {};
  const where: Record<string, string> = {};
  for (const id of IDS) {
    stats[`loc:${id}`] = [3, 3, 3, now - DAY];
    where[id] = 'r|ES|g1';
  }
  return {
    stats,
    where,
    opts: OPTS,
    sessions: [{ t: now - DAY, section: 'regions', mode: 'pin', label: 'España', total: 10, ok: 8, warn: 1, bad: 1, ms: 60_000 }],
    tot: { g: 31, q: 412, ok: 300, warn: 20, ms: 3_000_000 },
    days: { '2026-11-17': [1, 10, 8, 60_000, 1] },
    ...extra,
  };
}

/** A copy made a month ago by someone with three answers, who plays in miles on the blue map. */
function copy(now: number, prefs: Record<string, unknown> | null = { theme: 'dark', miles: true, palette: 'ocean', reviewPace: 'short', reviewSize: 20, nick: 'Ana', opts: { answer: 'choice', pinBy: 'nonsense' } }) {
  const stats: Record<string, number[]> = {};
  for (const id of IDS.slice(0, 3)) stats[`loc:${id}`] = [2, 2, 2, now - 31 * DAY];
  return {
    app: 'regionle',
    version: prefs ? 4 : 3,
    exported: new Date(now - 30 * DAY).toISOString(),
    stats,
    where: { 'ES-AN': 'r|ES|g1', 'ES-AR': 'r|ES|g1', 'ES-AS': 'r|ES|g1' },
    sessions: [],
    tot: { g: 12, q: 150, ok: 100, warn: 5, ms: 900_000 },
    days: { '2026-10-17': [1, 10, 8, 60_000, 1] },
    notes: { 'ES-AN': 'La del sur' },
    ...(prefs ? { prefs } : {}),
  };
}
const fileOf = (name: string, data: unknown) => ({ name, mimeType: 'application/json', buffer: Buffer.from(typeof data === 'string' ? data : JSON.stringify(data)) });
const block = (page: Page) => page.locator('.backup-block');
const choose = (page: Page, name: string, data: unknown) => block(page).locator('input[type=file]').setInputFiles(fileOf(name, data));
const sum = (page: Page, row: string) => block(page).locator('.backup-sum tbody tr', { hasText: row }).locator('td');

test.describe('a backup', () => {
  test('says what it holds next to what there is, and replaces nothing until told to', async ({ page }) => {
    const now = Date.now();
    await seed(page, player(now));
    await open(page, '/progreso');
    await choose(page, 'regionle-progreso.json', copy(now));

    const panel = block(page).locator('.backup-in');
    await expect(panel.locator('.backup-in-head')).toContainText('regionle-progreso.json');
    await expect(panel.locator('.backup-in-head')).toContainText(/copia del \d+ de \w+ de \d{4}/);
    await expect(sum(page, 'Respuestas guardadas')).toHaveText(['3', '8']);
    await expect(sum(page, 'Aprendidas')).toHaveText(['3', '8']);
    await expect(sum(page, 'Partidas')).toHaveText(['12', '31']);
    await expect(sum(page, 'Apuntes')).toHaveText(['1', '0']);
    // There is more here than in the copy: said in so many words.
    await expect(panel.locator('.backup-warn')).toHaveText('Aquí hay más que en la copia. Importarla sustituye lo que hay aquí: lo que no esté en ella se pierde.');
    // Nothing has changed yet.
    expect(Object.keys((await kept(page)).stats as object)).toHaveLength(8);

    await panel.getByRole('button', { name: 'Cancelar' }).click();
    await expect(panel).toHaveCount(0);
    expect(Object.keys((await kept(page)).stats as object)).toHaveLength(8);
    expect((await kept(page)).miles).toBe(false);
  });

  test('is brought in with its preferences, and the page says so', async ({ page }) => {
    const now = Date.now();
    await seed(page, player(now));
    await open(page, '/progreso');
    await choose(page, 'copia.json', copy(now));
    const panel = block(page).locator('.backup-in');
    await expect(panel.getByRole('checkbox', { name: /Traer también las preferencias de la copia/ })).toBeChecked();
    await panel.getByRole('button', { name: 'Sustituir lo que hay aquí' }).click();

    // The copy plays in miles, and the screen is mounted afresh for that: what it had to say is still said.
    await expect(block(page).locator('.q-note')).toHaveText(/^Copia importada: 3 respuestas, como estaban el \d+ de \w+ de \d{4}\.$/);
    await expect(block(page).locator('.q-note')).toBeInViewport();
    await expect(panel).toHaveCount(0);
    const state = await kept(page);
    expect(Object.keys(state.stats as object).sort()).toEqual(['loc:ES-AN', 'loc:ES-AR', 'loc:ES-AS']);
    expect(state.notes).toEqual({ 'ES-AN': 'La del sur' });
    expect(state).toMatchObject({ theme: 'dark', miles: true, palette: 'ocean', reviewPace: 'short', reviewSize: 20, nick: 'Ana' });
    // An option is taken only if it is something that option can be.
    expect(state.opts).toMatchObject({ answer: 'choice', pinBy: 'name' });
    await expect(page.locator('html')).toHaveAttribute('data-map', 'ocean');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    // What is here is the file: the last copy is the one that was read, made when it says.
    await expect(block(page).locator('.backup-last')).toHaveText(/^Última copia: \d+ de \w+ de \d{4} \(hace 30 días\)\.$/);
  });

  test('can leave the preferences of this browser as they are', async ({ page }) => {
    const now = Date.now();
    await seed(page, player(now, { palette: 'slate' }));
    await open(page, '/progreso');
    await choose(page, 'copia.json', copy(now));
    const panel = block(page).locator('.backup-in');
    await panel.locator('.backup-prefs').click();
    await expect(panel.getByRole('checkbox')).not.toBeChecked();
    await panel.getByRole('button', { name: 'Sustituir lo que hay aquí' }).click();
    await expect(block(page).locator('.q-note')).toContainText('Copia importada: 3 respuestas');
    const state = await kept(page);
    expect(Object.keys(state.stats as object)).toHaveLength(3);
    expect(state).toMatchObject({ miles: false, palette: 'slate', reviewPace: 'normal', reviewSize: 30 });
  });

  test('from before the preferences travelled says that it brings none', async ({ page }) => {
    const now = Date.now();
    await seed(page, player(now, { miles: true }));
    await open(page, '/progreso');
    await choose(page, 'vieja.json', copy(now, null));
    const panel = block(page).locator('.backup-in');
    await expect(panel.getByRole('checkbox')).toHaveCount(0);
    await expect(panel.locator('.backup-note').first()).toHaveText('Esta copia es de una versión anterior y no trae preferencias: las de aquí se quedan como están.');
    await panel.getByRole('button', { name: 'Sustituir lo que hay aquí' }).click();
    await expect(block(page).locator('.q-note')).toContainText('Copia importada');
    expect((await kept(page)).miles).toBe(true);
  });

  test('that is not one is turned away, and so is a file that cannot be read', async ({ page }) => {
    await seed(page, player(Date.now()));
    await open(page, '/progreso');
    await choose(page, 'otra-cosa.json', { hello: 'world' });
    await expect(block(page).locator('.q-note')).toHaveText('Ese archivo no es una copia de Regionle.');
    await expect(block(page).locator('.backup-in')).toHaveCount(0);
    await choose(page, 'roto.json', '{ "stats": ');
    await expect(block(page).locator('.q-note')).toHaveText('No se ha podido leer el archivo.');
    expect(Object.keys((await kept(page)).stats as object)).toHaveLength(8);
  });

  test('is saved with the preferences in it, and the page notes when', async ({ page }) => {
    const now = Date.now();
    await seed(page, player(now, { palette: 'ocean', miles: true, reviewPace: 'long' }));
    await open(page, '/progreso');
    await expect(block(page).locator('.backup-last')).toHaveText('Aún no has guardado ninguna copia.');
    const saving = page.waitForEvent('download');
    await block(page).getByRole('button', { name: 'Exportar' }).click();
    const file = await saving;
    expect(file.suggestedFilename()).toMatch(/^regionle-progreso-\d{4}-\d{2}-\d{2}\.json$/);
    const saved = JSON.parse(fs.readFileSync((await file.path())!, 'utf8'));
    expect(saved).toMatchObject({ app: 'regionle', version: 4, prefs: { palette: 'ocean', miles: true, reviewPace: 'long', reviewSize: 30, theme: 'auto' } });
    expect(Object.keys(saved.stats)).toHaveLength(8);
    // The language is the browser's business, and what was last chosen in each section is not a preference.
    expect(Object.keys(saved.prefs).sort()).toEqual(['cb', 'contrast', 'dayGoal', 'dyslexia', 'haptic', 'helpAuto', 'hotkeys', 'iconBadge', 'miles', 'nick', 'opts', 'palette', 'reviewPace', 'reviewSize', 'sound', 'textSize', 'theme']);
    await expect(block(page).locator('.backup-last')).toHaveText(/^Última copia: \d+ de \w+ de \d{4} \(hoy\)\.$/);
    expect(((await kept(page)).backup as { q: number }).q).toBe(412);
  });
});

test.describe('the reminder of a backup', () => {
  const due = (page: Page) => page.locator('.backup-due');

  test('comes up when a lot has been answered and none was ever made, and saving one puts it away', async ({ page }) => {
    await seed(page, player(Date.now()));
    await open(page, '/progreso');
    await expect(due(page)).toContainText('Llevas 412 respuestas sin copia de seguridad.');
    const saving = page.waitForEvent('download');
    await due(page).getByRole('button', { name: 'Guardar una copia' }).click();
    await saving;
    await expect(due(page)).toHaveCount(0);
  });

  test('counts from the last copy, and can be put off', async ({ page }) => {
    const now = Date.now();
    await seed(page, player(now, { backup: { at: now - 21 * DAY, from: now - 21 * DAY, q: 40 } }));
    await open(page, '/progreso');
    await expect(due(page)).toContainText('Llevas 372 respuestas desde tu última copia de seguridad (hace 21 días).');
    await due(page).getByRole('button', { name: 'Ahora no' }).click();
    await expect(due(page)).toHaveCount(0);
    // Put off, not made: the date of the last copy stays.
    const mark = (await kept(page)).backup as { at: number; q: number };
    expect(mark.q).toBe(412);
    expect(Math.round((now - mark.at) / DAY)).toBe(21);
    await page.reload();
    await expect(page.locator('.backup-block')).toBeVisible();
    await expect(due(page)).toHaveCount(0);
  });

  test('keeps quiet when little has been answered or the last copy is recent', async ({ page }) => {
    const now = Date.now();
    await seed(page, player(now, { backup: { at: now - 2 * DAY, from: now - 2 * DAY, q: 10 } }));
    await open(page, '/progreso');
    await expect(page.locator('.backup-block')).toBeVisible();
    await expect(due(page)).toHaveCount(0);
  });

  test('is not for someone who has just started', async ({ page }) => {
    await seed(page, { ...player(Date.now()), tot: { g: 3, q: 40, ok: 30, warn: 2, ms: 300_000 } });
    await open(page, '/progreso');
    await expect(page.locator('.backup-block')).toBeVisible();
    await expect(due(page)).toHaveCount(0);
  });
});

test.describe('sending a backup', () => {
  test('is offered where the browser hands files to other apps, and the copy goes as a file', async ({ page }) => {
    await page.addInitScript(() => {
      const sent: { name: string; type: string; size: number }[] = [];
      (window as unknown as { __sent: typeof sent }).__sent = sent;
      // A phone that shares text files and not JSON ones.
      Object.defineProperty(navigator, 'canShare', { value: (d: { files?: File[] }) => !!d.files?.every((f) => f.type === 'text/plain'), configurable: true });
      Object.defineProperty(navigator, 'share', { value: async (d: { files: File[] }) => void sent.push(...d.files.map((f) => ({ name: f.name, type: f.type, size: f.size }))), configurable: true });
    });
    await seed(page, player(Date.now()));
    await open(page, '/progreso');
    await block(page).getByRole('button', { name: 'Enviar' }).click();
    await expect(block(page).locator('.q-note')).toHaveText('Copia enviada.');
    const sent = await page.evaluate(() => (window as unknown as { __sent: { name: string; type: string; size: number }[] }).__sent);
    expect(sent).toHaveLength(1);
    expect(sent[0].name).toMatch(/^regionle-progreso-\d{4}-\d{2}-\d{2}\.txt$/);
    expect(sent[0].type).toBe('text/plain');
    expect(sent[0].size).toBeGreaterThan(200);
    await expect(block(page).locator('.backup-last')).toContainText('(hoy)');
  });

  test('is not offered where it does not', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
    await seed(page, player(Date.now()));
    await open(page, '/progreso');
    await expect(block(page).getByRole('button', { name: 'Exportar' })).toBeVisible();
    await expect(block(page).getByRole('button', { name: 'Enviar' })).toHaveCount(0);
  });
});
