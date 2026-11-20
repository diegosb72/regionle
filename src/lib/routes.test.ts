import { describe, expect, it } from 'vitest';
import { PATHS, canonicalPath, langPage, linkTo, pageLang, pageScreen, routeOf, screenPage, siteRoot } from './routes';
import { SCREENS, SCREEN_IDS, SEO_LANGS } from './seo';

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
    // Without a code, the screen that says what a duel or a list is and how one is sent.
    expect(routeOf('duelo', now)).toEqual({ kind: 'duel', code: '' });
    expect(routeOf('lista', now)).toEqual({ kind: 'list', code: '' });
    // A game for a box in another page: what follows is read where it is played (`embed.ts`).
    expect(routeOf('incrustar/regiones/ES:p/pin', now)).toEqual({ kind: 'embed', rest: 'regiones/ES:p/pin' });
    expect(routeOf('incrustar', now)).toEqual({ kind: 'embed', rest: '' });
    expect(routeOf(canonicalPath('embed/regions/ES'), now)).toEqual({ kind: 'embed', rest: 'regions/ES' });
    expect(routeOf(canonicalPath('Incrustar/lista/AbC-_9/pin/answer=choice;length=20'), now)).toEqual({ kind: 'embed', rest: 'lista/AbC-_9/pin/answer=choice;length=20' });
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
    for (const path of ['nada', 'regiones/españa', 'regiones/es', 'jugar/ya', 'progreso/x', 'contenido']) expect(routeOf(path, now)).toEqual({ kind: 'unknown', path });
    // A section followed by a country is a link to that map (`maplink.ts`).
    expect(routeOf('regiones/ES', now)).toEqual({ kind: 'section', section: 'regions', link: { ids: ['ES'], levels: {} } });
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

  it('reads the language and the screen of the page of a screen from its name', () => {
    expect(pageLang('/regionle/regions.html')).toBe('en');
    expect(pageLang('/regionle/regiones.html')).toBe('es');
    expect(pageLang('/regionle/figures')).toBe('en');
    expect(pageScreen('/regionle/regions.html')).toBe('regiones');
    expect(pageScreen('/regionle/cifras.html')).toBe('poblaciones');
    expect(pageScreen('/regionle/daily')).toBe('reto');
    expect(pageScreen('/about.html')).toBe('acerca');
    // The page of a language, the first page and anything else are the page of no screen.
    for (const path of ['/regionle/en.html', '/regionle/es', '/regionle/', '/regionle/index.html', '/regions/', '/regionle/regions.htm', '/regionle/poblaciones.html', '/regionle/Regions.html']) expect(pageScreen(path), path).toBeNull();
    expect(pageLang('/regionle/poblaciones.html')).toBeNull();
  });

  it('has, for every screen with a page, an address the game knows and a name it takes after the hash too', () => {
    const now = '2026-11-17';
    for (const screen of SCREEN_IDS) {
      expect(routeOf(screen, now).kind, screen).not.toBe('unknown');
      for (const lang of SEO_LANGS) {
        const { file } = SCREENS[screen][lang];
        // "#/regions" opens what "regions.html" does.
        expect(canonicalPath(file), file).toBe(screen);
        expect(screenPage(screen, lang)).toBe(`${file}.html`);
        expect(pageScreen(`/regionle/${screenPage(screen, lang)}`)).toBe(screen);
        expect(pageLang(`/regionle/${screenPage(screen, lang)}`)).toBe(lang);
      }
    }
    // Every section has its page.
    for (const path of Object.values(PATHS)) expect(SCREEN_IDS).toContain(path);
    expect([langPage('es'), langPage('en')]).toEqual(['es.html', 'en.html']);
  });

  it('sends links without the page of a language, a query or a hash', () => {
    expect(siteRoot('https://diegosb72.github.io/regionle/')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('https://diegosb72.github.io/regionle/#/reto')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('https://diegosb72.github.io/regionle/en.html#/reto')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('https://diegosb72.github.io/regionle/es?utm=1#/x')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('http://localhost:5173/index.html?x=1#/x')).toBe('http://localhost:5173/index.html');
    expect(siteRoot('')).toBe('');
    expect(linkTo('reto/2026-11-17', 'https://diegosb72.github.io/regionle/en.html#/reto')).toBe('https://diegosb72.github.io/regionle/#/reto/2026-11-17');
    // Nor the page of a screen.
    expect(siteRoot('https://diegosb72.github.io/regionle/regions.html')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('https://diegosb72.github.io/regionle/cifras?x=1#/reto')).toBe('https://diegosb72.github.io/regionle/');
    expect(siteRoot('http://localhost:5173/daily.html')).toBe('http://localhost:5173/');
    expect(linkTo('duelo/Ab9', 'https://diegosb72.github.io/regionle/regiones.html')).toBe('https://diegosb72.github.io/regionle/#/duelo/Ab9');
    // What is not a page of the site stays.
    expect(siteRoot('https://example.org/juego/queen.html#/x')).toBe('https://example.org/juego/queen.html');
  });
});
