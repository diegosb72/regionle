import { expect, test } from '@playwright/test';
import { open, play, seed } from './helpers';

test.describe('with the keyboard and a screen reader', () => {
  test('"Saltar al contenido" moves to the content and leaves the screen where it was', async ({ page }) => {
    await seed(page);
    await open(page, '/regiones');
    await page.locator('body').focus();
    await page.keyboard.press('Tab');
    const skip = page.locator('a.skip');
    await expect(skip).toBeFocused();
    await expect(skip).toHaveText('Saltar al contenido');
    await page.keyboard.press('Enter');
    await expect(page.locator('main#contenido')).toBeFocused();
    // What follows "#" is the address of the screen: the link must not be taken for one.
    await expect(page).toHaveURL(/#\/regiones$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Regiones, provincias y estados');
    await expect(page.locator('.notfound')).toHaveCount(0);
  });
});

test.describe('the loudspeaker next to a name', () => {
  /** A voice that never speaks: it keeps what it is asked to say and ends each thing when the test says. */
  const fakeVoice = () => {
    type Said = { text: string; lang: string; over?: boolean; onend?: (e: Event) => void; onerror?: (e: Event) => void };
    const said: Said[] = [];
    const voice = {
      stops: 0,
      getVoices: () => [],
      speak(u: Said) {
        said.push(u);
      },
      cancel() {
        voice.stops++;
        const u = said.find((x) => !x.over);
        if (!u) return;
        u.over = true;
        // As browsers do: whatever was cut short is told so a moment later.
        setTimeout(() => u.onerror?.(new Event('error')), 30);
      },
    };
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: voice });
    Object.assign(window, {
      said,
      endVoice: () => {
        const u = said.find((x) => !x.over);
        if (u) {
          u.over = true;
          u.onend?.(new Event('end'));
        }
      },
    });
  };
  const said = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { said: { text: string; lang: string }[] }).said.map((u) => [u.text, u.lang]));
  const endVoice = (page: import('@playwright/test').Page) => page.evaluate(() => (window as unknown as { endVoice(): void }).endVoice());

  test('says that it is sounding, stops when it is pressed again and goes off when the voice ends', async ({ page }) => {
    await page.addInitScript(fakeVoice);
    await play(page);
    const name = ((await page.locator('.q-name').first().evaluate((el) => el.childNodes[0].textContent)) ?? '').trim();
    const button = page.locator('.q .speak');
    await expect(button).toHaveAttribute('aria-label', `Escuchar «${name}»`);
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(button).toHaveAttribute('title', 'Sonando: pulsa para parar');
    expect(await said(page)).toEqual([[name, 'es-ES']]);
    await endVoice(page);
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    await expect(button).toHaveAttribute('title', 'Escuchar el nombre');

    // Pressed while it sounds, it stops instead of starting over.
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await button.click();
    await expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(await said(page)).toHaveLength(2);
    expect(await page.evaluate(() => (window.speechSynthesis as unknown as { stops: number }).stops)).toBeGreaterThan(1);

    // Stopped and started at once: the late end of the first does not switch the second off.
    await button.click();
    await button.click();
    await button.click();
    await page.waitForTimeout(150);
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await endVoice(page);
    await expect(button).toHaveAttribute('aria-pressed', 'false');

    // With the keyboard, as any button.
    await button.focus();
    await page.keyboard.press('Space');
    await expect(button).toHaveAttribute('aria-pressed', 'true');
    await page.keyboard.press('Enter');
    await expect(button).toHaveAttribute('aria-pressed', 'false');
  });

  test('is not there where the browser has no voice', async ({ page }) => {
    // As in a browser without the Web Speech API: neither the voice nor what it is asked to say exists.
    await page.addInitScript(() => {
      const w = window as unknown as { speechSynthesis?: unknown; SpeechSynthesisUtterance?: unknown };
      delete w.speechSynthesis;
      delete w.SpeechSynthesisUtterance;
    });
    await play(page);
    expect(await page.evaluate(() => 'speechSynthesis' in window || 'SpeechSynthesisUtterance' in window)).toBe(false);
    await expect(page.locator('.q-name').first()).toBeVisible();
    await expect(page.locator('.q .speak')).toHaveCount(0);
  });
});

test.describe('the codes of the pieces', () => {
  test('are explained where they are shown: ISO 3166-2, and one for each level', async ({ page }) => {
    await seed(page);
    await open(page, '/configuracion/regiones/ES');
    const note = page.locator('.ti-codes');
    await expect(note).toContainText('ISO 3166-2');
    await expect(note).toContainText('Asturias es ES-AS como comunidad autónoma y ES-O como provincia');
    // Both codes are on the list, each under its level.
    const groups = page.locator('.ti-group');
    await expect(groups.filter({ hasText: 'Comunidades autónomas' }).locator('.ti-list')).toContainText('ES-AS');
    await page.getByRole('searchbox', { name: 'Buscar pieza' }).fill('Asturias');
    await expect(page.locator('.ti-list')).toHaveCount(2);
    await expect(page.locator('.ti-list').nth(0)).toContainText('ES-AS');
    await expect(page.locator('.ti-list').nth(1)).toContainText('ES-O');
  });
});
