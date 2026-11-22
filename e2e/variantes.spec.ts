import { expect, test, type Page } from '@playwright/test';
import { OPTS, open, restart, seed, start, type } from './helpers';

/** The eight the games about countries are played with here. */
const EIGHT = ['ES', 'FR', 'DE', 'IT', 'PT', 'NL', 'BE', 'PL'];
const COMMUNITIES = { section: 'regions', countries: ['ES'], levels: { ES: 'g1' } };
const NAMES: Record<string, string> = { 'ES-AN': 'Andalucía', 'ES-CL': 'Castilla y León' };
const idOf = (name: string): string => Object.keys(NAMES).find((id) => NAMES[id] === name)!;

/** What the game has kept in the browser. */
const kept = (page: Page) => page.evaluate(() => JSON.parse(localStorage.getItem('regionle:v1')!).state as { stats: Record<string, number[]>; sessions: { mode: string; total: number; ok: number; warn: number; bad: number }[] });

/** The piece lit on the map as the one a question is about. */
const lit = (page: Page) => page.locator('.map-svg path.st-target[data-id]');

test.describe('flashcards', () => {
  test('a card is turned over and the player says whether they knew it', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'cards', only: Object.keys(NAMES) });
    await expect(page.locator('.play-title strong')).toHaveText('Tarjetas');
    const card = page.locator('.fcard');
    await expect(card.locator('.kicker').first()).toHaveText('¿Cómo se llama?');
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    // The card asks about what the map lights up, and nothing names it yet.
    await expect(lit(page)).toHaveCount(1, { timeout: 30_000 });
    const first = (await lit(page).getAttribute('data-id'))!;
    const second = Object.keys(NAMES).find((id) => id !== first)!;
    await expect(page.locator('.play-body')).not.toContainText(NAMES[first]);
    await expect(page.locator('.fcard-grades')).toHaveCount(0);

    // The space bar turns it over: the answer, what there is to know about it, and three things to say.
    await page.keyboard.press('Space');
    await expect(card.locator('.fcard-answer')).toContainText(NAMES[first]);
    await expect(card.locator('.fcard-back .facts')).toContainText('Comunidad autónoma');
    await expect(page.locator('.map-svg text.m-lbl')).toHaveText([NAMES[first]]);
    await expect(page.locator('.fcard-grades button')).toHaveText([/No lo sabía/, /Casi/, /Lo sabía/]);
    await expect(page.getByRole('button', { name: 'Ver la respuesta' })).toHaveCount(0);

    // "I knew it" is the key 3. The next card comes face up: its answer is not there to be seen.
    await page.keyboard.press('3');
    await expect(page.locator('.hud-main')).toHaveText('2 / 2');
    await expect(card.locator('.fcard-back')).toHaveCount(0);
    await expect(lit(page)).toHaveAttribute('data-id', second);
    await expect(page.locator('.map-svg [data-id="' + first + '"]')).toHaveClass(/st-ok/);
    await expect(page.locator('.play-body')).not.toContainText(NAMES[second]);

    // "I did not know" is the key 1: the card comes back at the end.
    await page.getByRole('button', { name: 'Ver la respuesta' }).click();
    await expect(card.locator('.fcard-answer')).toContainText(NAMES[second]);
    await page.keyboard.press('1');
    await expect(page.locator('.q-round')).toHaveText('Las que no sabías · queda 1');
    await expect(lit(page)).toHaveAttribute('data-id', second);
    await page.keyboard.press('Enter');
    await page.getByRole('button', { name: /Lo sabía/ }).click();

    const results = page.locator('.results');
    await expect(results.locator('.results-title')).toHaveText('Tarjetas terminadas');
    await expect(results).toContainText('1 de 2');
    await expect(results.locator('.g-bad li')).toHaveText([new RegExp(NAMES[second])]);
    await expect(results.locator('.g-ok li')).toHaveText([new RegExp(NAMES[first])]);
    // What was said goes to the review, as the answers of any other game: the first time each card came up.
    const state = await kept(page);
    expect(state.stats[`name:${first}`].slice(0, 3)).toEqual([1, 1, 1]);
    expect(state.stats[`name:${second}`].slice(0, 3)).toEqual([1, 0, 0]);
    expect(state.sessions[0]).toMatchObject({ mode: 'cards', total: 2, ok: 1, warn: 0, bad: 1 });
  });

  test('have their keys in the list of keys, which keeps what is pressed in it to itself', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'cards', only: Object.keys(NAMES) });
    await expect(lit(page)).toHaveCount(1, { timeout: 30_000 });
    await page.keyboard.press('Space');
    await expect(page.locator('.fcard-grades button')).toHaveCount(3);
    await page.keyboard.press('?');
    const help = page.locator('dialog.keys-dialog');
    await expect(help).toBeVisible();
    await expect(help).toContainText('En «Tarjetas», Espacio (o Intro) da la vuelta a la tarjeta; después, 1, 2 y 3 dicen «No lo sabía», «Casi» y «Lo sabía».');
    // A 3 pressed while reading the list says nothing of the card behind it.
    await page.keyboard.press('3');
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
    await page.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await expect(page.locator('.fcard-grades button')).toHaveCount(3);
    await page.keyboard.press('3');
    await expect(page.locator('.hud-main')).toHaveText('2 / 2');
  });

  test('ask where a piece is, and the map answers', async ({ page }) => {
    await start(page, { ...COMMUNITIES, mode: 'cards', only: ['ES-AN'], opts: { cardAsk: 'where' } });
    const card = page.locator('.fcard');
    await expect(card.locator('.kicker').first()).toHaveText('¿Dónde está?');
    await expect(card.locator('.q-name')).toContainText('Andalucía');
    await expect(page.locator('.map-svg [data-id="ES-AN"]')).toBeVisible({ timeout: 30_000 });
    // Nothing on the map says where until the card is turned over.
    await expect(lit(page)).toHaveCount(0);
    await page.getByRole('button', { name: 'Ver la respuesta' }).click();
    await expect(lit(page)).toHaveAttribute('data-id', 'ES-AN');
    await expect(card.locator('.fcard-back')).toContainText('Está aquí');

    // "Nearly" is the key 2, and counts as an answer that needed help.
    await page.keyboard.press('2');
    await expect(page.locator('.results-stats')).toContainText('Con ayuda1');
    expect((await kept(page)).stats['loc:ES-AN'].slice(0, 2)).toEqual([1, 0]);
  });

  test('are offered again on the first page, each pack by what it asks', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'cards', countries: ['ES', 'FR'], opts: { cardAsk: 'where', length: 'all' } });
    await expect(page.locator('.map-svg [data-id="FR"]')).toBeVisible({ timeout: 30_000 });
    for (let i = 0; i < 2; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 2`);
      await page.keyboard.press('Space');
      await page.keyboard.press('3');
    }
    // Both known: the pack says so.
    await expect(page.locator('.results-title')).toHaveText('¡Te las sabes todas!');
    await open(page, '/');
    const again = page.locator('.recent-list li').first();
    await expect(again.locator('.recent-what')).toHaveText('Países · Tarjetas · ¿Dónde está?');
    // The pack that is started from there asks the same thing, whatever the setup is left at.
    await again.getByRole('button').click();
    await expect(page.locator('.fcard .kicker').first()).toHaveText('¿Dónde está?');
    await expect(page.locator('.hud-main')).toHaveText('1 / 2');
  });

  test('ask for a capital, or show a flag the hard way', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'cards', countries: EIGHT, only: ['FR'], opts: { cardAsk: 'capital' } });
    const card = page.locator('.fcard');
    await expect(card.locator('.kicker').first()).toHaveText('¿Cuál es la capital de…?');
    await expect(card.locator('.q-name')).toContainText('Francia');
    await expect(card).not.toContainText('París');
    await page.keyboard.press('Space');
    await expect(card.locator('.fcard-answer')).toContainText('París');

    await restart(page, { section: 'countries', mode: 'cards', countries: EIGHT, only: ['FR'], opts: { cardAsk: 'flag', flagLook: 'grey' } });
    await expect(card.locator('.kicker').first()).toHaveText('¿De qué país es esta bandera?');
    const flag = card.locator('.q-flagbox');
    await expect(flag.locator('img')).toHaveAttribute('src', /flags\/fr\.svg$/);
    // In grey until it is turned over; then as it is, with its name.
    await expect(flag).toHaveClass(/look-grey/);
    expect(await flag.locator('img').evaluate((el) => getComputedStyle(el).filter)).toContain('grayscale(1)');
    await expect(card).not.toContainText('Francia');
    await page.getByRole('button', { name: 'Ver la respuesta' }).click();
    await expect(flag).not.toHaveClass(/look-/);
    await expect(card.locator('.fcard-answer')).toContainText('Francia');
  });

  test('are offered with what each section can ask', async ({ page }) => {
    await seed(page, { sel: { countries: EIGHT, regions: ['ES'], physical: ['river'] }, levels: { ES: 'f' }, mode: { countries: 'cards', regions: 'cards', physical: 'cards' } });
    const asks = page.getByRole('radiogroup', { name: 'Qué pregunta cada tarjeta' });
    await open(page, '/paises');
    await expect(page.locator('.mode.on')).toContainText('Tarjetas');
    await expect(asks.getByRole('radio')).toHaveText(['¿Cómo se llama?', '¿Dónde está?', '¿Su capital?', '¿Qué bandera es?']);
    await expect(asks.getByRole('radio', { checked: true })).toHaveText('¿Cómo se llama?');
    // A pack of cards has an end.
    await expect(page.getByRole('radiogroup', { name: 'Número de preguntas' }).getByRole('radio')).toHaveText(['Todo', '10', '20', '50']);
    // The look of the flags is asked about when the cards show flags.
    const looks = page.getByRole('radiogroup', { name: 'Cómo se ven las banderas' });
    await expect(looks).toHaveCount(0);
    await asks.getByRole('radio', { name: '¿Qué bandera es?' }).click();
    await expect(looks.getByRole('radio')).toHaveText(['Tal cual', 'En gris', 'Desenfocadas']);

    // Provinces have capitals and no flags of their own; rivers have neither, and the choice kept from the countries falls back on the name.
    await open(page, '/regiones');
    await expect(asks.getByRole('radio')).toHaveText(['¿Cómo se llama?', '¿Dónde está?', '¿Su capital?']);
    await expect(asks.getByRole('radio', { checked: true })).toHaveText('¿Cómo se llama?');
    await open(page, '/fisica');
    await expect(asks.getByRole('radio')).toHaveText(['¿Cómo se llama?', '¿Dónde está?']);
  });

  test('fit a small phone: the answer and the three things to say are in sight without a scroll @movil', async ({ page }) => {
    // A short screen: the panel has half of it, and the back of a card is longer than that.
    await page.setViewportSize({ width: 360, height: 640 });
    await start(page, { section: 'countries', mode: 'cards', countries: EIGHT, only: ['FR', 'IT'], opts: { cardAsk: 'flag' } });
    await expect(page.locator('.q-flagbox img')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Ver la respuesta' }).tap();
    const grades = page.locator('.fcard-grades button');
    await expect(grades).toHaveCount(3);
    /** Is the middle of an element what a finger would touch there? Not if it is scrolled away or under something else. */
    const inSight = (selector: string) =>
      page.evaluate((sel) => {
        return [...document.querySelectorAll(sel)].map((el) => {
          const r = el.getBoundingClientRect();
          const at = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return !!at && el.contains(at);
        });
      }, selector);
    await expect.poll(() => inSight('.fcard-grades button')).toEqual([true, true, true]);
    await expect.poll(() => inSight('.fcard-answer')).toEqual([true]);
    // Each button is big enough for a thumb, and nothing runs off the side.
    for (const box of await grades.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; height: number }))) {
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(360);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await grades.last().tap();
    await expect(page.locator('.hud-main')).toHaveText('2 / 2');
    // The next card starts from its top, face up.
    await expect(page.locator('.fcard-back')).toHaveCount(0);
    await expect.poll(() => inSight('.fcard .kicker')).toEqual([true]);
  });
});

/** A voice that says nothing and writes down what it was asked to say. */
async function quietVoice(page: Page): Promise<() => Promise<string[]>> {
  await page.addInitScript(() => {
    const w = window as unknown as { __said: string[] };
    w.__said = [];
    window.speechSynthesis.speak = (u: SpeechSynthesisUtterance) => void w.__said.push(u.text);
    window.speechSynthesis.cancel = () => {};
  });
  return () => page.evaluate(() => (window as unknown as { __said: string[] }).__said);
}

/** A browser that cannot speak. */
const noVoice = (page: Page) => page.addInitScript(() => Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: undefined, configurable: true }));

test.describe('listen and pin', () => {
  test('says the name instead of writing it, as many times as it is asked to', async ({ page }) => {
    const said = await quietVoice(page);
    await start(page, { ...COMMUNITIES, mode: 'listen', only: Object.keys(NAMES) });
    await expect(page.locator('.play-title strong')).toHaveText('Oye y señala');
    await expect(page.locator('.q-prompt .kicker')).toHaveText('Escucha y señala en el mapa');
    await expect(page.locator('.map-svg [data-id="ES-AN"]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(said).toHaveLength(1);
    const first = (await said())[0];
    expect(Object.values(NAMES)).toContain(first);
    // The name is nowhere to be read: not on the panel, not in what the loudspeaker says of itself.
    await expect(page.locator('.play-body')).not.toContainText(first);
    await expect(page.locator(`[aria-label*="${first}"], [title*="${first}"]`)).toHaveCount(0);

    await page.getByRole('button', { name: 'Oír otra vez' }).click();
    await expect.poll(said).toEqual([first, first]);

    // Pointed at right, it is written at last; the next one is said as it comes.
    await page.locator(`.map-svg [data-id="${idOf(first)}"]`).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
    await expect(page.locator('.q-name')).toContainText(first);
    await expect.poll(said).toHaveLength(3);
    const second = (await said())[2];
    expect(second).not.toBe(first);
    await expect(page.locator('.play-body')).not.toContainText(second);

    // The hint writes the name, and the answer then counts as one that needed help.
    await page.getByRole('button', { name: 'Ver el nombre' }).click();
    await expect(page.locator('.q-name')).toContainText(second);
    await expect(page.getByRole('button', { name: 'Ver el nombre' })).toBeDisabled();
    await page.locator(`.map-svg [data-id="${idOf(second)}"]`).click();
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    expect((await kept(page)).stats[`loc:${idOf(first)}`].slice(0, 2)).toEqual([1, 1]);
  });

  test('is not offered to play where the browser has no voice, and reads the name if it is played all the same', async ({ page }) => {
    await noVoice(page);
    await seed(page, { sel: { regions: ['ES'] }, mode: { regions: 'listen' } });
    await open(page, '/regiones');
    await expect(page.locator('.mode.on')).toContainText('Oye y señala');
    await expect(page.locator('.startbar')).toContainText('Este navegador no tiene voz');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeDisabled();

    await restart(page, { ...COMMUNITIES, mode: 'listen', only: ['ES-AN'] });
    await expect(page.locator('.q-name')).toContainText('Andalucía');
    await expect(page.locator('.q-prompt')).toContainText('Este navegador no tiene voz');
    // Without a voice the hint is the one of "pin it": it narrows the search.
    await expect(page.getByRole('button', { name: 'Pista', exact: true })).toBeVisible();
  });

  test('is sat as an exam: every name is said, none is written until the paper is handed in', async ({ page }) => {
    const said = await quietVoice(page);
    // On a list of two: a list is sat as an exam like any map (a round of only what was missed is not).
    await start(page, { ...COMMUNITIES, mode: 'listen', only: Object.keys(NAMES), list: 'Las dos', opts: { format: 'exam' } });
    await expect(page.locator('.map-svg [data-id="ES-AN"]')).toBeVisible({ timeout: 30_000 });
    await expect.poll(said).toHaveLength(1);
    const first = (await said())[0];
    // An exam gives no hints: the name cannot be asked for in writing, only heard again.
    await expect(page.getByRole('button', { name: 'Ver el nombre' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Oír otra vez' })).toBeVisible();
    // The first is answered wrong, on purpose: nothing says so, and nothing is written.
    const other = Object.values(NAMES).find((name) => name !== first)!;
    await page.locator(`.map-svg [data-id="${idOf(other)}"]`).click();
    await expect(page.locator('.q')).toContainText('Respuesta anotada');
    await expect.poll(said).toHaveLength(2);
    expect((await said())[1]).toBe(other);
    for (const name of Object.values(NAMES)) await expect(page.locator('.play-body')).not.toContainText(name);
    await expect(page.locator('.verdict')).toHaveCount(0);
    // The second is answered right.
    await page.locator(`.map-svg [data-id="${idOf(other)}"]`).click();
    // Handed in, the paper is corrected with the names in writing.
    const results = page.locator('.results');
    await expect(results).toContainText('Nota: 5');
    await expect(results).toContainText(first);
    await expect(results).toContainText(other);
  });

  test('says where its voice comes from in the setup', async ({ page }) => {
    await seed(page, { sel: { regions: ['ES'] }, mode: { regions: 'listen' } });
    await open(page, '/regiones');
    await expect(page.locator('.setup-side')).toContainText('Los nombres los dice la voz de tu dispositivo');
    await expect(page.getByRole('button', { name: 'Empezar' })).toBeEnabled();
    // It is "pin it" in every other way: against the clock, with lives, as an exam, by two players.
    await expect(page.getByRole('radiogroup', { name: 'Formato de la partida' }).getByRole('radio')).toHaveCount(5);
  });
});

/** The way a question of the medley is asked, by what its heading says. */
const WAYS: Record<string, string> = {
  'Señala en el mapa': 'Señalar',
  Identifica: 'Identificar',
  Puzle: 'Puzle',
  Silueta: 'Silueta',
  '¿Cuál es la capital de…?': 'Capitales',
  '¿De qué país es esta bandera?': 'Banderas',
};
const CAPITALS: Record<string, string> = { Madrid: 'España', París: 'Francia', Berlín: 'Alemania', Roma: 'Italia', Lisboa: 'Portugal', Ámsterdam: 'Países Bajos', Bruselas: 'Bélgica', Varsovia: 'Polonia' };

/** The way of the question on screen, and after giving it up, which country it was about. */
async function giveUp(page: Page): Promise<[country: string, way: string]> {
  const way = WAYS[(await page.locator('.q-prompt > .kicker').textContent())!];
  await page.getByRole('button', { name: 'No lo sé' }).click();
  const answer = (await page.locator('.verdict-head b').textContent())!;
  return [CAPITALS[answer] ?? answer, way];
}

test.describe('the medley', () => {
  test('asks each piece in a way of its own, says which in the results and asks the misses again the same way', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'mix', countries: EIGHT, opts: { answer: 'choice', length: 'all' } });
    await expect(page.locator('.play-title strong')).toHaveText('Popurrí');
    await expect(page.locator('.map-svg [data-id="PL"]')).toBeVisible({ timeout: 30_000 });

    const dealt = new Map<string, string>();
    for (let i = 0; i < EIGHT.length; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 8`);
      const heading = (await page.locator('.q-prompt > .kicker').textContent())!;
      expect(Object.keys(WAYS), heading).toContain(heading);
      // What each way needs is on screen: a map to click, four options, a flag, a piece.
      if (heading === 'Señala en el mapa' || heading === 'Puzle') await expect(page.locator('.choices')).toHaveCount(0);
      else await expect(page.locator('.choice')).toHaveCount(4);
      if (heading === 'Puzle') await expect(page.locator('.piece svg path')).toBeVisible();
      if (heading === '¿De qué país es esta bandera?') await expect(page.locator('.q-flagbox img')).toBeVisible();
      if (heading === 'Identifica' || heading === '¿Cuál es la capital de…?') await expect(lit(page)).toHaveCount(1);

      const name = await page.locator('.q-name').textContent({ timeout: 500 }).catch(() => null);
      if (heading === 'Señala en el mapa' && name?.includes('Polonia')) {
        // One of them is answered right, to have some misses and not only misses.
        await page.locator('.map-svg [data-id="PL"]').click();
        await expect(page.locator('.verdict')).toHaveClass(/verdict-ok/);
        dealt.set('Polonia', 'Señalar');
        // A right answer moves on by itself.
        continue;
      }
      const [country, way] = await giveUp(page);
      dealt.set(country, way);
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    // Eight countries, each asked once, and not all the same way.
    expect([...dealt.keys()].sort()).toEqual(Object.values(CAPITALS).sort());
    expect(new Set(dealt.values()).size).toBeGreaterThanOrEqual(4);
    expect(dealt.get('Polonia')).toBe('Señalar');

    // The round of misses asks each one the way it was asked.
    await expect(page.locator('.q-round')).toHaveText('Repaso de fallos · quedan 7');
    const [again, sameWay] = await giveUp(page);
    expect(sameWay).toBe(dealt.get(again));
    await page.getByRole('button', { name: 'Terminar' }).click();

    // The results say how each was asked about.
    const results = page.locator('.results');
    await expect(results).toContainText('1 de 8');
    for (const [country, way] of dealt) await expect(results.locator('li', { hasText: country }).first().locator('.row-name small')).toContainText(way);

    // …and so does another game with the misses alone, though it is a new game with an order of its own.
    await results.getByRole('button', { name: 'Repasar 7 fallos' }).click();
    await expect(page.locator('.hud-main')).toHaveText('1 / 7');
    for (let i = 0; i < 7; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 7`);
      const [country, way] = await giveUp(page);
      expect(way, country).toBe(dealt.get(country));
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
  });

  test('deals only what the map can ask: cities are pinned or named', async ({ page }) => {
    await start(page, { section: 'cities', mode: 'mix', countries: ['ES'], opts: { answer: 'choice', length: 10, cityPick: 'top', cityCount: 10 } });
    await expect(page.locator('.map-svg .m-dot').first()).toBeVisible({ timeout: 30_000 });
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 10`);
      seen.add((await page.locator('.q-prompt > .kicker').textContent())!);
      await page.getByRole('button', { name: 'No lo sé' }).click();
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    expect([...seen].sort()).toEqual(['Identifica', 'Señala en el mapa']);
  });

  test('travels in a challenge link: the same pieces asked the same way, with the looks of whoever sent it', async ({ page, browser }) => {
    // The link is copied: kept here instead, to open it as someone else.
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: { writeText: (text: string) => ((window as unknown as { copied: string }).copied = text) && Promise.resolve() },
      });
    });
    await start(page, { section: 'countries', mode: 'mix', countries: EIGHT, opts: { answer: 'choice', length: 'all', turned: true, flagLook: 'grey' } });
    await expect(page.locator('.map-svg [data-id="PL"]')).toBeVisible({ timeout: 30_000 });
    const sent: [string, string][] = [];
    for (let i = 0; i < EIGHT.length; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 8`);
      sent.push(await giveUp(page));
      await page.getByRole('button', { name: 'Siguiente' }).click();
    }
    await expect(page.locator('.q-round')).toContainText('Repaso de fallos');
    await page.getByRole('button', { name: 'Terminar' }).click();
    await page.locator('.duel-send input').fill('Ana');
    await page.getByRole('button', { name: 'Retar a alguien' }).click();
    await expect(page.getByRole('button', { name: 'Enlace copiado' })).toBeVisible();
    const copied = await page.evaluate(() => (window as unknown as { copied: string }).copied);
    const link = /https?:\S+$/.exec(copied)![0];
    expect(copied).toContain('Ana te reta en Regionle ∞');
    expect(link).toContain('#/duelo/');

    // Someone else, in a browser of their own, who plays plain: no turned outlines, flags as they are, typing.
    const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'es-ES' });
    const other = await context.newPage();
    await seed(other, { opts: { ...OPTS, answer: 'type', turned: false, flagLook: 'plain' } });
    await other.goto(link);
    await expect(other.locator('.duel-page h1')).toHaveText('Ana te reta');
    // What is being accepted is said, the hard looks with it.
    await expect(other.locator('.duel-what')).toContainText('Países · Popurrí · todas las preguntas · siluetas giradas · banderas en gris');
    await other.getByRole('button', { name: 'Aceptar el reto' }).click();
    await expect(other.locator('.map-svg [data-id="PL"]')).toBeVisible({ timeout: 30_000 });
    const got: [string, string][] = [];
    for (let i = 0; i < EIGHT.length; i++) {
      await expect(other.locator('.hud-main')).toHaveText(`${i + 1} / 8`);
      const heading = (await other.locator('.q-prompt > .kicker').textContent())!;
      // The sender's way of answering and the sender's looks, not the receiver's.
      if (heading !== 'Señala en el mapa' && heading !== 'Puzle') await expect(other.locator('.choice')).toHaveCount(4);
      if (heading === '¿De qué país es esta bandera?') await expect(other.locator('.q-flagbox')).toHaveClass(/look-grey/);
      if (heading === 'Silueta') await expect(other.locator('.q-prompt')).toContainText('Está girada');
      got.push(await giveUp(other));
      await other.getByRole('button', { name: 'Siguiente' }).click();
    }
    expect(got).toEqual(sent);
    // Every way that shows a look was dealt, or the looks above were never seen: at least the flags were.
    expect(sent.map(([, way]) => way)).toContain('Banderas');
    await context.close();
  });

  test('is sat as an exam: nothing is said of an answer, and the correction says how each piece was asked', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'mix', countries: EIGHT, opts: { answer: 'choice', length: 'all', format: 'exam' } });
    await expect(page.locator('.map-svg [data-id="PL"]')).toBeVisible({ timeout: 30_000 });
    const asked: string[] = [];
    for (let i = 0; i < 3; i++) {
      await expect(page.locator('.hud-main')).toHaveText(`${i + 1} / 8`);
      const heading = (await page.locator('.q-prompt > .kicker').textContent())!;
      asked.push(WAYS[heading]);
      // No hints, and no "I don't know" that would show the answer: a question is left blank.
      await expect(page.getByRole('button', { name: 'No lo sé' })).toHaveCount(0);
      await page.getByRole('button', { name: 'Dejar en blanco' }).click();
      await expect(page.locator('.verdict')).toHaveCount(0);
      await expect(page.locator('.map-svg .st-bad, .map-svg .st-ok')).toHaveCount(0);
    }
    await expect(page.locator('.hud-main')).toHaveText('4 / 8');
    await page.getByRole('button', { name: 'Entregar' }).click();
    const results = page.locator('.results');
    await expect(results.locator('h2, h1').first()).toContainText('Nota: 0');
    await expect(results).toContainText('Entregaste con 5 preguntas sin responder');
    // The three that were seen are listed with the way each was asked.
    const ways = await results.locator('.row-name small').allTextContents();
    expect(ways).toHaveLength(3);
    for (const [i, text] of ways.entries()) {
      expect(text, text).toContain('en blanco');
      expect(asked, text).toContain(text.split(' · ')[0]);
      expect(text.split(' · ')[0]).toBe(asked[i]);
    }
    // A mark is one's own: an exam is not sent as a challenge.
    await expect(page.locator('.duel')).toHaveCount(0);
  });

  test('has its settings: how to answer, the looks, the format', async ({ page }) => {
    await seed(page, { sel: { countries: EIGHT, physical: ['river'] }, mode: { countries: 'mix', physical: 'mix' } });
    await open(page, '/paises');
    await expect(page.locator('.mode.on')).toContainText('Popurrí');
    await expect(page.getByRole('radiogroup', { name: 'Forma de responder' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Formato de la partida' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Cómo se ven las banderas' })).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /Siluetas giradas/ })).toBeVisible();
    // Among rivers there are no outlines to turn and no flags to look at.
    await open(page, '/fisica');
    await expect(page.locator('.mode.on')).toContainText('Popurrí');
    await expect(page.getByRole('radiogroup', { name: 'Forma de responder' })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: 'Cómo se ven las banderas' })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /Siluetas giradas/ })).toHaveCount(0);
  });
});

/** Width and height of a path as it is drawn. */
const sizeOf = (page: Page, selector: string) => page.locator(selector).evaluate((el) => (({ width, height }) => ({ width, height }))((el as SVGGraphicsElement).getBBox()));

test.describe('the hard looks', () => {
  test('turn the outlines, in the outline game and in Regionle', async ({ page }) => {
    // Sweden: twice as tall as it is wide, and no islands far away to make its outline anything else.
    const sweden = { section: 'countries', mode: 'outline', countries: ['SE', 'NO', 'FI', 'DK'], only: ['SE'] };
    await start(page, sweden);
    const path = page.locator('.outline-stage path');
    await expect(path).toBeVisible({ timeout: 30_000 });
    const upright = (await path.getAttribute('d'))!;
    const tall = await sizeOf(page, '.outline-stage path');
    expect(tall.height).toBeGreaterThan(tall.width * 1.6);
    expect(tall.height).toBeCloseTo(400 * 0.84, 0);
    await expect(page.locator('.q-ask')).not.toContainText('girada');

    await restart(page, { ...sweden, opts: { turned: true } });
    await expect(path).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.q-ask')).toContainText('Está girada: el norte no queda arriba.');
    const turned = (await path.getAttribute('d'))!;
    expect(turned).not.toBe(upright);
    // Turned, it no longer stands as tall; and the whole of it is still inside its square.
    const box = await sizeOf(page, '.outline-stage path');
    expect(box.height / box.width).toBeLessThan((tall.height / tall.width) * 0.9);
    expect(Math.max(box.width, box.height)).toBeLessThanOrEqual(400 * 0.84 + 1);
    // The same game turns it the same way every time it is opened.
    await page.reload();
    await expect(path).toBeVisible({ timeout: 30_000 });
    expect(await path.getAttribute('d')).toBe(turned);
    // The hint brings the map, and with it the north.
    await page.getByRole('button', { name: 'Ver en el mapa' }).click();
    await expect(page.locator('.outline-stage')).toHaveCount(0);
    await expect(page.locator('.q-ask')).not.toContainText('girada');

    // Regionle: turned while it is guessed, the same way, and as it lies once the round is settled.
    await restart(page, { ...sweden, mode: 'regionle', opts: { turned: true, length: 'all' } });
    const shape = page.locator('.d-shape path');
    await expect(shape).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.q-ask')).toContainText('Está girada');
    expect(await shape.getAttribute('d')).toBe(turned);
    await page.getByRole('button', { name: 'No lo sé' }).click();
    await expect(page.locator('.verdict')).toContainText('Suecia');
    await expect(shape).toHaveAttribute('d', upright);
    await expect(page.locator('.q-ask')).not.toContainText('girada');
  });

  test('take the focus off a flag, and give some back with each try', async ({ page }) => {
    await start(page, { section: 'countries', mode: 'flag', countries: EIGHT, only: ['FR'], opts: { flagLook: 'blur', answer: 'type' } });
    const flag = page.locator('.q-flagbox');
    await expect(flag.locator('img')).toHaveAttribute('src', /flags\/fr\.svg$/);
    await expect(flag).toHaveClass(/look-blur/);
    const blur = () => flag.locator('img').evaluate((el) => getComputedStyle(el).filter);
    expect(await blur()).toBe('blur(12px)');
    await type(page, 'Italia');
    await expect.poll(blur).toBe('blur(7px)');
    await type(page, 'Bélgica');
    await expect.poll(blur).toBe('blur(4px)');
    // Answered, it is seen as it is.
    await type(page, 'Francia');
    await expect(page.locator('.verdict')).toHaveClass(/verdict-warn/);
    await expect(flag).not.toHaveClass(/look-/);
    await expect.poll(blur).toBe('none');
  });

  test('are chosen where they apply: flags in grey, outlines turned', async ({ page }) => {
    await seed(page, { sel: { countries: EIGHT }, mode: { countries: 'flag' } });
    await open(page, '/paises');
    const looks = page.getByRole('radiogroup', { name: 'Cómo se ven las banderas' });
    await expect(looks.getByRole('radio', { checked: true })).toHaveText('Tal cual');
    await looks.getByRole('radio', { name: 'En gris' }).click();
    await expect(page.locator('.setup-side')).toContainText('Sin colores, una bandera se reconoce por su dibujo');
    // "Pin it" shows flags when asked to, and then they have a look too.
    await page.locator('.mode', { hasText: 'Señalar' }).click();
    await expect(looks).toHaveCount(0);
    await page.getByRole('radiogroup', { name: 'Qué se muestra' }).getByRole('radio', { name: 'La bandera' }).click();
    await expect(looks.getByRole('radio', { checked: true })).toHaveText('En gris');

    const turn = page.getByRole('checkbox', { name: /Siluetas giradas/ });
    await expect(turn).toHaveCount(0);
    await page.locator('.mode', { hasText: 'Silueta' }).click();
    await expect(turn).not.toBeChecked();
    await page.locator('.toggle', { hasText: 'Siluetas giradas' }).click();
    await expect(turn).toBeChecked();
    // The choice is the same in Regionle, which is played with outlines as well.
    await page.locator('.mode', { hasText: 'Regionle' }).click();
    await expect(turn).toBeChecked();
    await page.getByRole('button', { name: 'Empezar' }).click();
    await expect(page.locator('.q-ask')).toContainText('Está girada');
  });
});
