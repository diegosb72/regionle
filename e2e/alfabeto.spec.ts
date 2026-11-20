/**
 * The alphabet: a country for each letter that begins a name, each with a clue. Which country a clue is
 * about is worked out here from the data of the game and the words of the clue, not from the game: every
 * clue has to be true of one country of its letter, and of one only.
 */
import fs from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, seed, start, type } from './helpers';

type Lang = 'es' | 'en';
interface Named {
  es: string;
  en?: string;
}
interface Fact {
  id: string;
  n: Named;
  cl: string;
  ct: string;
  sr: string;
  ll?: number;
  ar: number;
  pop?: number;
  nb?: string[];
  fl?: string;
  cap?: Named;
}
const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as { countries: Fact[]; continents: Record<string, Named>; subregions: Record<string, Named> };
const byId = new Map(index.countries.map((c) => [c.id, c]));
const STATES = index.countries.filter((c) => c.cl === 'un');
const world = STATES.map((c) => c.id);

const said = (n: Named, lang: Lang): string => (lang === 'en' ? (n.en ?? n.es) : n.es);
const fold = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const initial = (c: Fact, lang: Lang): string => fold(said(c.n, lang)).charAt(0).toUpperCase();
const nb = (c: Fact): string[] => c.nb ?? [];
const touch = (a: Fact, b: Fact): boolean => nb(a).includes(b.id) || nb(b).includes(a.id);
/** Countries of which either of two continents can be said, and the landlocked ones on the Caspian: a clue is taken to be true of them. */
const TWO = new Set(['RU', 'TR', 'KZ', 'AZ', 'GE', 'AM', 'CY', 'EG', 'ID']);
const CASPIAN = new Set(['AZ', 'KZ', 'TM']);

/** The countries of a letter that a clue is true of. */
function fits(letter: string, text: string, flag: string, chosen: Fact[], lang: Lang): Fact[] {
  const mates = chosen.filter((c) => initial(c, lang) === letter);
  const es = lang === 'es';
  if (flag) return mates.filter((c) => c.fl === flag);
  let m = (es ? /^Su capital es (.+)\.$/ : /^Its capital is (.+)\.$/).exec(text);
  if (m) return mates.filter((c) => c.cap && said(c.cap, lang) === m![1]);
  m = (es ? /^(Solo limita con|Limita con) (.+?)(, y con nadie más|, entre otros)?\.$/ : /^(It borders only|It borders) (.+?)(, and nobody else|, among others)?\.$/).exec(text);
  if (m) {
    const whole = /Solo|only/.test(m[1]) || /nadie|nobody/.test(m[3] ?? '');
    // The names that are in the list, the longest first: some hold an "y" of their own.
    let rest = m[2];
    const near: Fact[] = [];
    for (const c of [...index.countries].sort((a, b) => said(b.n, lang).length - said(a.n, lang).length)) {
      if (!rest.includes(said(c.n, lang))) continue;
      near.push(c);
      rest = rest.replace(said(c.n, lang), '#');
    }
    expect(rest.replace(/\b(y|e|and)\b/g, ''), text).toMatch(/^[#, ]+$/);
    return mates.filter((c) => near.every((n) => n.id !== c.id && touch(c, n)) && (!whole || nb(c).length === near.length));
  }
  m = (es ? /^Está en (?:el )?(.+?)(?: y (no tiene salida al mar|no tiene fronteras terrestres|tiene costa))?\.$/ : /^It is in (?:the )?(.+?)(?: and (is landlocked|has no land borders|has a coast))?\.$/).exec(text);
  if (m) {
    const keys = [...Object.entries(index.subregions), ...Object.entries(index.continents)].filter(([k, v]) => said(v, lang) === m![1] || (!es && k === 'AM' && m![1] === 'Americas')).map(([k]) => k);
    expect(keys.length, text).toBeGreaterThan(0);
    const tail = m[2] ?? '';
    return mates.filter((c) => {
      const there = TWO.has(c.id) || keys.includes(c.sr) || keys.includes(c.ct);
      const sea = !tail || CASPIAN.has(c.id) || (/salida|landlocked/.test(tail) ? !!c.ll : /fronteras|land borders/.test(tail) ? !c.ll && nb(c).length === 0 : !c.ll);
      return there && sea;
    });
  }
  m = (es ? /^Es el más (poblado|grande) de los que empiezan por (.)\.$/ : /^It (has the most people|is the largest) of those that begin with (.)\.$/).exec(text);
  expect(m, `a clue that is not understood: ${text}`).toBeTruthy();
  expect(m![2]).toBe(letter);
  const of = (c: Fact): number => (/poblado|people/.test(m![1]) ? (c.pop ?? 0) : c.ar);
  // By far, or it would be a matter of opinion: a quarter more than the next.
  const [top, next] = [...mates].sort((a, b) => of(b) - of(a));
  expect(of(top) / of(next), text).toBeGreaterThanOrEqual(1.25);
  return [top];
}

const strip = (page: Page) => page.locator('.alpha-strip li');
const letterOf = (page: Page) => page.locator('.alpha-with b');
const clue = (page: Page) => page.locator('.alpha-clue');
const note = (page: Page) => page.locator('.alpha > .q-note');
const hud = (page: Page) => page.locator('.hud-main');
const field = (page: Page) => page.locator('.answer-input');
const verdict = (page: Page) => page.locator('.verdict');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const game = (countries: string[], opts: Record<string, unknown> = {}) => ({ section: 'pops', mode: 'alphabet', countries, opts });
const kept = (page: Page) => page.evaluate(() => (JSON.parse(localStorage.getItem('regionle:v1')!).state.sessions ?? []) as { mode: string; label: string; total: number; ok: number; warn: number; bad: number }[]);

interface Asked {
  letter: string;
  text: string;
  /** What is asked for, and the other countries of the letter. */
  answer: Fact;
  mates: Fact[];
}

/** The letter in hand and its clue, with the one country of the letter the clue is true of. */
async function asked(page: Page, ids: string[], lang: Lang = 'es'): Promise<Asked> {
  await expect(clue(page)).toBeVisible();
  const letter = (await letterOf(page).textContent()) ?? '';
  const text = (await clue(page).textContent()) ?? '';
  const img = page.locator('.alpha-flag');
  const flag = (await img.count()) ? (/flags\/([a-z-]+)\.svg/.exec((await img.getAttribute('src')) ?? '')?.[1] ?? '') : '';
  const chosen = ids.map((id) => byId.get(id)!);
  const found = fits(letter, text, flag, chosen, lang);
  expect(found.map((c) => said(c.n, lang)), `${letter}: ${text} ${flag}`).toHaveLength(1);
  return { letter, text, answer: found[0], mates: chosen.filter((c) => initial(c, lang) === letter && c.id !== found[0].id) };
}

/** The letters of the strip, each with what has become of it: "A+" right, "B-" wrong, "C*" in hand. */
const marks = (page: Page) =>
  strip(page).evaluateAll((all) => all.map((li) => `${li.firstElementChild!.textContent}${li.classList.contains('is-ok') ? '+' : li.classList.contains('is-bad') ? '-' : ''}${li.classList.contains('now') ? '*' : ''}`).join(' '));
/** Waits for the strip to stand as said. */
const stands = (page: Page, as: string) => expect.poll(() => marks(page)).toBe(as);

test.describe('the alphabet', () => {
  test('asks a country for each letter, with a clue that is true of one of its letter only, from A to Z', async ({ page }) => {
    await start(page, game(world));
    await expect(page.locator('.play-title')).toContainText('Alfabeto');
    // The countries of the world begin with twenty-three letters in Spanish: none with Q, W or X.
    await expect(strip(page).locator('span[aria-hidden]')).toHaveText('ABCDEFGHIJKLMNOPRSTUVYZ'.split(''));
    await expect(hud(page)).toHaveText('0 / 23');
    await expect(letterOf(page)).toHaveText('A');
    await expect(strip(page).first()).toHaveAttribute('aria-current', 'step');
    await expect(strip(page).first().locator('.sr-only')).toHaveText('A: la que toca');
    await expect(strip(page).nth(1).locator('.sr-only')).toHaveText('B: pendiente');
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveAccessibleName('País que empieza por A');
    await expect(note(page)).toHaveText('Un intento por letra. Si dudas, pasa: la letra vuelve después.');

    // A right answer moves on by itself: the next letter is there to be typed at once.
    const first = await asked(page, world);
    await type(page, first.answer.n.es);
    await expect(letterOf(page)).toHaveText('B');
    await expect(verdict(page)).toHaveCount(0);
    await expect(note(page)).toHaveText(`¡Correcto! A · ${first.answer.n.es}.`);
    await expect(hud(page)).toHaveText('1 / 23');
    await expect(strip(page).first()).toHaveClass(/\bis-ok\b/);
    await expect(strip(page).first().locator('.sr-only')).toHaveText('A: acertada');
    await expect(field(page)).toBeFocused();
    await expect(field(page)).toHaveValue('');

    const kinds = new Set<string>();
    for (const letter of 'BCDEFGHIJKLMNOPRSTUVYZ') {
      await expect(letterOf(page)).toHaveText(letter);
      const q = await asked(page, world);
      kinds.add(/capital/.test(q.text) ? 'capital' : /bandera/.test(q.text) ? 'flag' : /imita/.test(q.text) ? 'borders' : /^Está/.test(q.text) ? 'place' : 'rank');
      // The name without its accents, in small letters: it is taken all the same.
      await type(page, fold(q.answer.n.es));
    }
    // More than one kind of clue in a game: it is not a list of capitals.
    expect(kinds.size).toBeGreaterThanOrEqual(3);

    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('¡De la A a la Z!');
    await expect(end.locator('.donut')).toContainText('23 de 23');
    await expect(end.locator('.results-group')).toHaveCount(1);
    await expect(end.locator('.results-group summary')).toContainText('A la primera');
    // The Enter that sent the last name does not start another game.
    await expect(button(page, 'Otra vez')).not.toBeFocused();
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ mode: 'alphabet', label: '193 países', total: 23, ok: 23, warn: 0, bad: 0 });
  });

  test('counts as a miss another country of the letter, and not a slip: a country of another letter, or of none', async ({ page }) => {
    // E: España and Estonia. F: Finlandia and Francia. P: Portugal.
    const ids = ['ES', 'EE', 'FR', 'FI', 'PT'];
    await start(page, game(ids));
    await expect(strip(page).locator('span[aria-hidden]')).toHaveText(['E', 'F', 'P']);
    const e = await asked(page, ids);
    expect(e.letter).toBe('E');
    expect(e.mates).toHaveLength(1);

    await type(page, 'Francia');
    await expect(note(page)).toHaveText('Francia no empieza por E.');
    // What was typed stays, selected: typing replaces it.
    await expect(field(page)).toHaveValue('Francia');
    await type(page, 'Japón');
    await expect(note(page)).toHaveText('Ese país no está en tu selección.');
    await type(page, 'zzzz');
    await expect(note(page)).toHaveText('Ese país no está en tu selección.');
    await expect(verdict(page)).toHaveCount(0);
    await expect(hud(page)).toHaveText('0 / 3');
    await stands(page, 'E* F P');

    // The other country of the letter is an answer, and the wrong one.
    await type(page, e.mates[0].n.es);
    await expect(verdict(page).locator('.verdict-head')).toContainText(`Era ${e.answer.n.es}`);
    await expect(verdict(page)).toContainText(`Has escrito ${e.mates[0].n.es}.`);
    await expect(field(page)).toHaveCount(0);
    await expect(hud(page)).toHaveText('1 / 3');
    await stands(page, 'E-* F P');
    await expect(strip(page).first().locator('.sr-only')).toHaveText('E: fallada');
    // The clue is still there to be read against the answer.
    await expect(clue(page)).toHaveText(e.text);
    await expect(button(page, 'Siguiente')).toBeFocused();
    await page.keyboard.press('Enter');

    // "I don't know" gives the letter up.
    const f = await asked(page, ids);
    expect(f.letter).toBe('F');
    await expect(note(page)).toHaveText('Un intento por letra. Si dudas, pasa: la letra vuelve después.');
    await button(page, 'No lo sé').click();
    await expect(verdict(page).locator('.verdict-head')).toContainText(`Era ${f.answer.n.es}`);
    await expect(verdict(page)).not.toContainText('Has escrito');
    await stands(page, 'E- F-* P');
    await button(page, 'Siguiente').click();

    // The last letter cannot be passed: there is no other to go to.
    await expect(letterOf(page)).toHaveText('P');
    await expect(note(page)).toHaveText('Un intento, y es la última letra.');
    await expect(button(page, 'Paso')).toBeDisabled();
    await type(page, 'paso');
    await expect(note(page)).toHaveText('Es la última letra: ya no se puede pasar.');
    await expect(letterOf(page)).toHaveText('P');
    await type(page, 'portugal');

    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('Alfabeto terminado');
    await expect(end.locator('.donut')).toContainText('1 de 3');
    // What was missed, with the letter and the clue it was asked by.
    const review = end.locator('.results-group.g-bad li');
    await expect(review).toHaveCount(2);
    await expect(review.first().locator('.row-name')).toContainText(e.answer.n.es);
    await expect(review.first().locator('.row-name small')).toHaveText(`E · ${/bandera/.test(e.text) ? 'por su bandera' : e.text}`);
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ mode: 'alphabet', label: '5 países', total: 3, ok: 1, warn: 0, bad: 2 });
    // The Enter that sent the last name lands on nothing.
    await page.keyboard.press('Enter');
    await expect(end.locator('h2')).toHaveText('Alfabeto terminado');
  });

  test('lets a letter be passed, with the button or by typing so, and brings it round again', async ({ page }) => {
    // One country for each letter: A, E, F, I, P.
    const ids = ['DE', 'ES', 'FR', 'IT', 'PT'];
    const name: Record<string, string> = { A: 'Alemania', E: 'España', F: 'Francia', I: 'Italia', P: 'Portugal' };
    await start(page, game(ids));
    await stands(page, 'A* E F I P');
    expect((await asked(page, ids)).answer.n.es).toBe('Alemania');

    await button(page, 'Paso').click();
    await stands(page, 'A E* F I P');
    await expect(hud(page)).toHaveText('0 / 5');
    // The field is there to go on typing.
    await expect(field(page)).toBeFocused();
    await type(page, 'Paso');
    await stands(page, 'A E F* I P');
    await expect(field(page)).toHaveValue('');
    expect((await asked(page, ids)).answer.n.es).toBe('Francia');
    await type(page, 'Francia');
    await expect(note(page)).toHaveText('¡Correcto! F · Francia.');
    await type(page, 'paso');
    // What was said of the letter before is said no more.
    await expect(note(page)).toHaveText('Un intento por letra. Si dudas, pasa: la letra vuelve después.');
    await type(page, name.P);
    // After the last letter, the first of those that were left.
    await stands(page, 'A* E F+ I P+');
    await expect(hud(page)).toHaveText('2 / 5');
    // Round and round, over the ones that are answered.
    await type(page, 'paso');
    await type(page, 'paso');
    await stands(page, 'A E F+ I* P+');
    await type(page, 'paso');
    await stands(page, 'A* E F+ I P+');
    await type(page, name.A);
    await type(page, name.E);
    await stands(page, 'A+ E+ F+ I* P+');
    await expect(button(page, 'Paso')).toBeDisabled();
    await type(page, name.I);
    await expect(page.locator('.results h2')).toHaveText('¡De la A a la Z!');
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ total: 5, ok: 5, bad: 0 });
  });

  test('empties the field in the same breath as it takes what was typed, however fast the next key comes', async ({ page }) => {
    await start(page, game(world));
    await expect(letterOf(page)).toHaveText('A');
    await field(page).click();
    // Twelve letters passed one after another without a pause: each word is typed over nothing, and what the
    // field holds is read at once, without waiting for it.
    for (const next of 'BCDEFGHIJKLM') {
      await page.keyboard.type('paso');
      await page.keyboard.press('Enter');
      expect(await field(page).inputValue(), `on the way to ${next}`).toBe('');
      expect(await letterOf(page).textContent()).toBe(next);
    }
    await expect(hud(page)).toHaveText('0 / 23');
  });

  test('ends when asked to, without counting the letters that were left', async ({ page }) => {
    const ids = ['DE', 'ES', 'FR', 'IT', 'PT'];
    await start(page, game(ids));
    await type(page, 'Alemania');
    await button(page, 'Terminar').click();
    const end = page.locator('.results');
    await expect(end.locator('h2')).toHaveText('Partida terminada');
    await expect(end.locator('.results-note')).toHaveText('Sin responder: E, F, I, P.');
    await expect(end.locator('.donut')).toContainText('1 de 1');
    await expect.poll(async () => (await kept(page))[0]).toMatchObject({ mode: 'alphabet', total: 1, ok: 1, bad: 0 });

    // Another game starts from the A, with nothing answered.
    await button(page, 'Otra vez').click();
    await stands(page, 'A* E F I P');
    await expect(hud(page)).toHaveText('0 / 5');
    await expect(field(page)).toBeFocused();
    // Ended with nothing answered, a game leaves nothing behind.
    await button(page, 'Terminar').click();
    await expect(end.locator('.results-note')).toHaveText('Sin responder: A, E, F, I, P.');
    expect(await kept(page)).toHaveLength(1);
  });

  test('offers only the countries of the letter, where suggestions are on', async ({ page }) => {
    const ids = ['ES', 'EE', 'FR', 'FI', 'PT'];
    await start(page, game(ids, { suggest: true }));
    const e = await asked(page, ids);
    const options = page.locator('.answer-list li');
    await field(page).fill('e');
    await expect(options).toHaveText(['España', 'Estonia']);
    // Without their flags: one of them may be the clue.
    await expect(options.locator('img')).toHaveCount(0);
    // Finlandia has an "e" too, and Francia: neither begins with it.
    await field(page).fill('f');
    await expect(options).toHaveCount(0);
    await field(page).fill('es');
    await options.filter({ hasText: e.answer.n.es }).click();
    await expect(letterOf(page)).toHaveText('F');
    await expect(note(page)).toHaveText(`¡Correcto! E · ${e.answer.n.es}.`);
    // In the order of the alphabet, which is not the one the game keeps them in.
    await field(page).fill('f');
    await expect(options).toHaveText(['Finlandia', 'Francia']);
  });

  test('is played in English with the letters of the names in English', async ({ page }) => {
    await seed(page, { lang: 'en', game: { levels: {}, nonce: 1, ...game(world), opts: OPTS } });
    await page.goto('./#/jugar');
    await expect(page.locator('.play-title')).toContainText('Alphabet');
    // Qatar begins with a Q; Germany is under the G, and Spain under the S.
    await expect(strip(page).locator('span[aria-hidden]')).toHaveText('ABCDEFGHIJKLMNOPQRSTUVYZ'.split(''));
    await expect(hud(page)).toHaveText('0 / 24');
    await expect(field(page)).toHaveAccessibleName('Country that begins with A');
    await expect(note(page)).toHaveText('One try for each letter. If in doubt, pass: the letter comes round again later.');
    for (const letter of 'ABDEFGHIJKLMNOPQRSTUVYZ') {
      await expect(letterOf(page)).toHaveText(letter);
      const q = await asked(page, world, 'en');
      // "Pass" is typed in English, and in Spanish too: the B and the C are left for later.
      if (letter === 'B') {
        await type(page, 'pass');
        await expect(letterOf(page)).toHaveText('C');
        await type(page, 'paso');
        continue;
      }
      // (A name that is the same in both languages is kept once.)
      await type(page, said(q.answer.n, 'en'));
      if (letter === 'A') await expect(note(page)).toHaveText(`Correct! A · ${said(q.answer.n, 'en')}.`);
    }
    // The two that were passed come round.
    for (const letter of 'BC') {
      await expect(letterOf(page)).toHaveText(letter);
      await type(page, said((await asked(page, world, 'en')).answer.n, 'en'));
    }
    await expect(page.locator('.results h2')).toHaveText('From A to Z!');
    await expect(page.locator('.results .donut')).toContainText('24 of 24');
  });

  test('is in the menu of the figures, with as many letters as the countries chosen begin with', async ({ page }) => {
    await seed(page, { mode: { pops: 'alphabet' }, sel: { pops: world } });
    await open(page, '/poblaciones');
    await expect(page.locator('.mode.on')).toContainText('Alfabeto');
    await expect(page.locator('.mode-about')).toContainText('Medio.');
    await expect(page.locator('.mode-facts li').first()).toContainText('23 letras');
    // Neither the figure of the other games of the section nor a number of questions is asked for.
    await expect(page.getByRole('radiogroup', { name: 'Cifra' })).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Número de preguntas' })).toHaveCount(0);
    await expect(page.locator('label.toggle', { hasText: 'Sugerencias al escribir' })).toBeVisible();
    await button(page, 'Empezar').click();
    await expect(hud(page)).toHaveText('0 / 23');
  });

  test('says how many letters two countries give, and needs two', async ({ page }) => {
    await seed(page, { mode: { pops: 'alphabet' }, sel: { pops: ['ES', 'EE', 'FR'] } });
    await open(page, '/poblaciones');
    await expect(page.locator('.mode-facts li').first()).toContainText('2 letras');
    await expect(button(page, 'Empezar')).toBeEnabled();
    await button(page, 'Empezar').click();
    await expect(strip(page).locator('span[aria-hidden]')).toHaveText(['E', 'F']);
  });

  test('fits a phone, with its letters in lines of about the same length @movil', async ({ page }) => {
    await start(page, game(world));
    await expect(strip(page)).toHaveCount(23);
    await page.evaluate(() => document.fonts.ready);
    const drawn = () =>
      page.evaluate(() => {
        const wide = innerWidth;
        const out: string[] = [];
        for (const el of document.querySelectorAll('.alpha-strip li, .alpha-with, .alpha-clue, .alpha-flag, .answer, .answer-send, .alpha > .q-note, .q-actions .btn')) {
          const r = el.getBoundingClientRect();
          if (r.left < -0.5 || r.right > wide + 0.5) out.push(`${el.className || el.tagName} ${Math.round(r.left)}–${Math.round(r.right)}`);
        }
        const rows = new Map<number, number>();
        for (const li of document.querySelectorAll('.alpha-strip li')) {
          const top = Math.round(li.getBoundingClientRect().top);
          rows.set(top, (rows.get(top) ?? 0) + 1);
        }
        return { out, rows: [...rows.values()] };
      });
    const phone = await drawn();
    expect(phone.out).toEqual([]);
    expect(phone.rows.length).toBeGreaterThan(1);
    // No line with a letter or two left over.
    expect(Math.min(...phone.rows)).toBeGreaterThanOrEqual(Math.max(...phone.rows) - 2);

    // The narrowest screen, the largest letter and the widest typeface: the field and its button stay on the screen.
    await page.setViewportSize({ width: 320, height: 700 });
    await page.evaluate(async () => {
      document.documentElement.dataset.text = 'xl';
      document.documentElement.dataset.font = 'dyslexia';
      await document.fonts.ready;
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    });
    const narrow = await drawn();
    expect(narrow.out).toEqual([]);
    expect(Math.min(...narrow.rows)).toBeGreaterThanOrEqual(Math.max(...narrow.rows) - 2);
  });
});
