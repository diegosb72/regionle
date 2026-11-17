import { describe, expect, it } from 'vitest';
import { PATHS, canonicalPath, linkTo, pageLang, routeOf, siteRoot } from './routes';

describe('addresses', () => {
  it('leaves the addresses of the game as they are', () => {
    for (const path of ['', 'regiones', 'paises', 'ciudades', 'fisica', 'poblaciones', 'jugar', 'reto', 'reto/2026-11-10', 'progreso', 'configuracion', 'configuracion/regiones/US', 'acerca']) {
      expect(canonicalPath(path)).toBe(path);
    }
  });

  it('sends other ways of writing a section to its address', () => {
    // The two that the audit typed: the section is called "Cifras" and lives at "poblaciones".
    expect(canonicalPath('fisico')).toBe('fisica');
    expect(canonicalPath('figuras')).toBe('poblaciones');
    expect(canonicalPath('cifras')).toBe('poblaciones');
    expect(canonicalPath('regions')).toBe('regiones');
    expect(canonicalPath('countries')).toBe('paises');
    expect(canonicalPath('settings/regiones/US')).toBe('configuracion/regiones/US');
    expect(canonicalPath('about')).toBe('acerca');
    expect(canonicalPath('inicio')).toBe('');
  });

  it('takes capitals, accents and slashes at the ends', () => {
    expect(canonicalPath('/Regiones/')).toBe('regiones');
    expect(canonicalPath('Países')).toBe('paises');
    expect(canonicalPath('pa%C3%ADses')).toBe('paises');
    expect(canonicalPath('F%C3%ADsica/')).toBe('fisica');
    expect(canonicalPath('regiones?x=1')).toBe('regiones');
    expect(canonicalPath('%E0%A4%A')).toBe('%E0%A4%A');
  });

  it('keeps the code of a duel or a list letter by letter', () => {
    expect(canonicalPath('duelo/AbC-dEf_9')).toBe('duelo/AbC-dEf_9');
    expect(canonicalPath('Duel/AbC-dEf_9/')).toBe('duelo/AbC-dEf_9');
    expect(canonicalPath('lista/Zz/')).toBe('lista/Zz');
  });
});

describe('screens', () => {
  const now = '2026-11-17';

  it('knows every screen', () => {
    expect(routeOf('', now)).toEqual({ kind: 'home' });
    for (const [section, path] of Object.entries(PATHS)) expect(routeOf(path, now)).toEqual({ kind: 'section', section });
    expect(routeOf('jugar', now)).toEqual({ kind: 'play' });
    expect(routeOf('progreso', now)).toEqual({ kind: 'progress' });
    expect(routeOf('acerca', now)).toEqual({ kind: 'about' });
    expect(routeOf('configuracion', now)).toEqual({ kind: 'settings', path: '' });
    expect(routeOf('configuracion/regiones/US', now)).toEqual({ kind: 'settings', path: 'regiones/US' });
    expect(routeOf('duelo/abc', now)).toEqual({ kind: 'duel', code: 'abc' });
    expect(routeOf('lista/abc/def', now)).toEqual({ kind: 'list', code: 'abc/def' });
  });

  it('opens the challenge of a past day, and today instead of a day that is not one', () => {
    expect(routeOf('reto', now)).toEqual({ kind: 'daily', date: now });
    expect(routeOf('reto/2026-11-10', now)).toEqual({ kind: 'daily', date: '2026-11-10' });
    expect(routeOf('reto/2026-11-18', now)).toEqual({ kind: 'daily', date: now });
    expect(routeOf('reto/2025-12-31', now)).toEqual({ kind: 'daily', date: now });
    expect(routeOf('reto/2026-02-30', now)).toEqual({ kind: 'daily', date: now });
    expect(routeOf('reto/ayer', now)).toEqual({ kind: 'daily', date: now });
  });

  it('says so when an address is nothing', () => {
    for (const path of ['nada', 'regiones/ES', 'jugar/ya', 'duelo', 'lista', 'progreso/x']) expect(routeOf(path, now)).toEqual({ kind: 'unknown', path });
    // What the audit typed is not unknown once it has been put right.
    expect(routeOf(canonicalPath('fisico'), now)).toEqual({ kind: 'section', section: 'physical' });
    expect(routeOf(canonicalPath('figuras'), now)).toEqual({ kind: 'section', section: 'pops' });
  });
});

describe('links', () => {
  it('reads the language of a page from its name', () => {
    expect(pageLang('/regionle/en.html')).toBe('en');
    expect(pageLang('/regionle/es.html')).toBe('es');
    expect(pageLang('/regionle/en')).toBe('en');
    expect(pageLang('/regionle/')).toBeNull();
    expect(pageLang('/regionle/index.html')).toBeNull();
    expect(pageLang('/en/')).toBeNull();
    expect(pageLang('/regionle/queen.html')).toBeNull();
  });

  it('sends links without the page of a language, a query or a hash', () => {
    expect(siteRoot('https://diegosb72.github.io/regionle/')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('https://diegosb72.github.io/regionle/#/reto')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('https://diegosb72.github.io/regionle/en.html#/reto')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('https://diegosb72.github.io/regionle/es?utm=1#/x')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('http://localhost:5173/index.html?x=1#/x')).toBe('http://localhost:5173/index.html');
    expect(siteRoot('')).toBe('');
    expect(linkTo('reto/2026-11-17', 'https://diegosb72.github.io/regionle/en.html#/reto')).toBe('https://diegosb72.github.io/regionle/#/reto/2026-11-17');
  });
});
