import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Crash, isLoadError } from './ErrorBoundary';

/** The address the game is at: what follows `#` says whether it is alone in a box of another page. */
const at = (hash: string) => vi.stubGlobal('window', { location: { hash, pathname: '/', href: `https://example.org/${hash}` } });
const shown = (error: Error): string => renderToStaticMarkup(createElement(Crash, { error, onRetry: () => undefined }));

/** A part of the game that did not arrive, as Chromium says it; and a mistake of the game. */
const lost = new TypeError('Failed to fetch dynamically imported module: https://example.org/assets/Play-abc.js');
const broken = new Error('boom');

describe('what is shown when a screen breaks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('tells a part that did not arrive from a mistake of the game, as each browser words it', () => {
    expect(isLoadError(lost)).toBe(true);
    expect(isLoadError(new TypeError('error loading dynamically imported module: https://example.org/assets/Play-abc.js'))).toBe(true);
    expect(isLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isLoadError(new Error('Unable to preload CSS for /assets/Play-abc.css'))).toBe(true);
    expect(isLoadError(broken)).toBe(false);
  });

  it('offers, in the whole of the game, to reload the page and the way to the start, and says the progress is safe', () => {
    at('#/jugar');
    const late = shown(lost);
    expect(late).toContain('Esta parte del juego no ha llegado a cargarse');
    expect(late).toContain('Recarga la página y vuelve a intentarlo.');
    expect(late).toContain('Tu progreso está a salvo');
    expect(late).toContain('Recargar la página');
    expect(late).toContain('href="#/"');
    // Trying again what did not arrive asks for nothing new: only a mistake of the game is tried again.
    expect(late).not.toContain('Reintentar');
    const wrong = shown(broken);
    expect(wrong).toContain('Algo ha fallado');
    expect(wrong).toContain('recargar la página o ir al inicio');
    expect(wrong).toContain('Reintentar');
    expect(wrong).toContain('href="#/"');
  });

  it('offers, in a box of another page, to load the box again: no start to go to, no page of its own, no progress to speak of', () => {
    at('#/incrustar/regiones/ES:f/pin');
    for (const error of [lost, broken]) {
      const html = shown(error);
      expect(html).toContain('Volver a cargar');
      expect(html).not.toContain('href="#/"');
      expect(html).not.toContain('inicio');
      expect(html).not.toContain('progreso');
      expect(html).not.toContain('la página');
    }
    expect(shown(lost)).toContain('Esta parte del juego no ha llegado a cargarse');
    expect(shown(lost)).toContain('Vuelve a cargarlo y prueba otra vez.');
    expect(shown(lost)).not.toContain('Reintentar');
    expect(shown(broken)).toContain('Puedes volver a intentarlo o cargarlo de nuevo.');
    expect(shown(broken)).toContain('Reintentar');
  });
});
