// @vitest-environment jsdom
/**
 * Where the game is, read from the address in the bar: the page of a screen, the page of the map of a
 * country, and what follows `#`. And what the game writes back into the bar as it moves on.
 */
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { applyMeta } from './pageMeta';
import { followLang, go, settle, useRoute } from './router';
import { routeOf } from './routes';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let box: HTMLDivElement;
let root: Root;

/** A page that says where the game is. */
function Probe() {
  return createElement('p', null, `at:${useRoute()}`);
}
/** The address the browser is at: the page, and what follows it. */
const at = (): string => `${window.location.pathname.split('/').pop() ?? ''}${window.location.hash}`;
const route = (): string => (box.textContent ?? '').replace(/^at:/, '');
/** Opens an address as a visit does: the page is read from there. */
const open = (address: string) => {
  window.history.replaceState(null, '', `/regionle/${address}`);
  act(() => root.render(createElement(Probe, { key: address })));
};
/** Lets the browser tell the page that its address has changed. */
const told = async () => {
  await act(async () => void (await new Promise((done) => setTimeout(done, 0))));
};

beforeEach(() => {
  box = document.createElement('div');
  document.body.append(box);
  root = createRoot(box);
  window.scrollTo = () => undefined;
});

afterEach(() => {
  act(() => root.unmount());
  box.remove();
  window.history.replaceState(null, '', '/');
});

describe('the page of the map of a country', () => {
  it('is the regions of that country at their finest, and stays in the bar as it came', () => {
    open('mapa-es-espana.html');
    expect(route()).toBe('regiones/ES:f');
    expect(at()).toBe('mapa-es-espana.html');
    open('map-gb-united-kingdom.html');
    expect(route()).toBe('regiones/GB:f');
    expect(at()).toBe('map-gb-united-kingdom.html');
    // Without its extension too, as some servers give it.
    open('mapa-x1-chipre-del-norte');
    expect(route()).toBe('regiones/X1:f');
  });

  it('stays in the bar once its map is the one chosen and the game is on the regions as on any day', () => {
    open('mapa-es-espana.html');
    act(() => settle('regiones'));
    expect(route()).toBe('regiones');
    expect(at()).toBe('mapa-es-espana.html#/regiones');
    // Read again from there, it is still that screen on that page.
    open('mapa-es-espana.html#/regiones');
    expect(route()).toBe('regiones');
    expect(at()).toBe('mapa-es-espana.html#/regiones');
  });

  it('gives way to the address of the game, in the language of the page, when the game moves on to another screen', async () => {
    open('mapa-es-espana.html');
    act(() => settle('regiones'));
    act(() => go('paises'));
    await told();
    expect(route()).toBe('paises');
    expect(at()).toBe('es.html#/paises');

    open('map-es-spain.html');
    act(() => go('jugar'));
    await told();
    expect(route()).toBe('jugar');
    expect(at()).toBe('en.html#/jugar');
    // Another map of the regions is not the map of the page either.
    open('map-es-spain.html#/regiones/FR');
    expect(route()).toBe('regiones/FR');
    expect(at()).toBe('en.html#/regiones/FR');
  });

  it('is one page only: what follows the hash wins over it', () => {
    open('mapa-es-espana.html#/reto');
    expect(route()).toBe('reto');
    expect(at()).toBe('es.html#/reto');
    // An address written another way is put right as well.
    open('mapa-es-espana.html#/Regiones/');
    expect(route()).toBe('regiones');
    expect(at()).toBe('mapa-es-espana.html#/regiones');
  });

  it('gives way to the plain address of the game, with its map, for whoever plays in the other language', () => {
    open('mapa-es-espana.html');
    followLang('en');
    expect(at()).toBe('#/regiones/ES:f');
    expect(window.location.pathname).toBe('/regionle/');
    // Once its map is chosen, what follows the hash is what is kept.
    open('mapa-es-espana.html#/regiones');
    followLang('en', true);
    expect(at()).toBe('#/regiones');
    open('map-es-spain.html');
    followLang('es');
    expect(at()).toBe('#/regiones/ES:f');
  });

  it('stays as it is for whoever plays in its language, chosen or not', () => {
    open('mapa-es-espana.html');
    followLang('es');
    expect(at()).toBe('mapa-es-espana.html');
    followLang('es', true);
    expect(at()).toBe('mapa-es-espana.html');
    open('map-es-spain.html#/regiones');
    followLang('en', true);
    expect(at()).toBe('map-es-spain.html#/regiones');
  });

  it('keeps what it says of itself while the game is on the screen it opened, and no longer', () => {
    document.head.innerHTML = '<meta name="description" content="España en el mapa." />';
    document.title = 'España: provincias en el mapa — Regionle ∞';
    const said = () => [document.title, document.querySelector('meta[name="description"]')!.getAttribute('content')];
    open('mapa-es-espana.html');
    applyMeta(routeOf('regiones/ES:f'));
    expect(said()).toEqual(['España: provincias en el mapa — Regionle ∞', 'España en el mapa.']);
    act(() => settle('regiones'));
    applyMeta(routeOf('regiones'));
    expect(said()).toEqual(['España: provincias en el mapa — Regionle ∞', 'España en el mapa.']);
    // Another screen says what it is, also while the page of the map is still in the bar.
    applyMeta(routeOf('paises'));
    expect(said()[0]).toBe('Países, capitales y banderas — Regionle ∞');
    expect(said()[1]).toMatch(/^Sitúa, nombra y reconoce/);
    // And the regions say what they are on any page that is not that of a map.
    open('regiones.html');
    applyMeta(routeOf('regiones'));
    expect(said()[0]).toBe('Regiones, provincias y estados — Regionle ∞');
    open('es.html#/regiones');
    document.title = 'x';
    applyMeta(routeOf('regiones'));
    expect(said()[0]).toBe('Regiones, provincias y estados — Regionle ∞');
  });
});

describe('the page of a screen, as it was', () => {
  it('is that screen, and gives way to the page of its language when the game moves on', async () => {
    open('regiones.html');
    expect(route()).toBe('regiones');
    expect(at()).toBe('regiones.html');
    act(() => go('paises'));
    await told();
    expect(route()).toBe('paises');
    expect(at()).toBe('es.html#/paises');
    // Its own screen after the hash is one more address that names it, and moves on like the rest.
    open('regions.html#/regiones');
    expect(route()).toBe('regiones');
    expect(at()).toBe('en.html#/regiones');
  });

  it('follows the language: the page of the same screen in the other one', () => {
    open('regiones.html');
    followLang('en');
    expect(at()).toBe('regions.html');
    open('figures.html');
    followLang('es', true);
    expect(at()).toBe('cifras.html');
    // The page of a language gives way to the first page once a language is chosen, and not before.
    open('en.html#/reto');
    followLang('en');
    expect(at()).toBe('en.html#/reto');
    followLang('es', true);
    expect(at()).toBe('#/reto');
    // The first page has nothing to follow.
    open('#/reto');
    followLang('en', true);
    expect(at()).toBe('#/reto');
  });
});
