import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { SECTIONS, SECTION_IDS } from './modes';
import { routeDescription, routeName, routeTitle } from './pageMeta';
import { PATHS, routeOf } from './routes';
import { SCREENS, SCREEN_IDS, SEO, SEO_LANGS, pageText } from './seo';

const NOW = '2026-11-17';

afterEach(() => setLang('es'));

describe('the title and the description of each screen', () => {
  it('are, on a screen with a page of its own, the ones that page is written with', () => {
    for (const lang of SEO_LANGS) {
      setLang(lang);
      for (const screen of SCREEN_IDS) {
        const route = routeOf(screen, NOW);
        const page = pageText({ screen, lang });
        expect(routeTitle(route, NOW), `${screen} ${lang}`).toBe(page.title);
        expect(routeDescription(route, NOW), `${screen} ${lang}`).toBe(page.description);
      }
    }
  });

  it('are the heading of each section, which the menus read from the same place', () => {
    for (const lang of SEO_LANGS) {
      setLang(lang);
      for (const section of SECTION_IDS) {
        expect(SECTIONS[section].title).toBe(SCREENS[PATHS[section]][lang].name);
        expect(routeName({ kind: 'section', section }, NOW)).toBe(SECTIONS[section].title);
      }
    }
  });

  it('are those of the game on the first page', () => {
    for (const lang of SEO_LANGS) {
      setLang(lang);
      expect(routeName({ kind: 'home' }, NOW)).toBeNull();
      expect(routeTitle({ kind: 'home' }, NOW)).toBe(SEO[lang].title);
      expect(routeDescription({ kind: 'home' }, NOW)).toBe(SEO[lang].description);
    }
  });

  it('name the day of a past challenge, which is described as the challenge is', () => {
    expect(routeTitle({ kind: 'daily', date: NOW }, NOW)).toBe('Reto del día — Regionle ∞');
    expect(routeTitle({ kind: 'daily', date: '2026-11-10' }, NOW)).toBe('Reto del 10 de noviembre de 2026 — Regionle ∞');
    expect(routeDescription({ kind: 'daily', date: '2026-11-10' }, NOW)).toBe(SCREENS.reto.es.description);
    setLang('en');
    expect(routeTitle({ kind: 'daily', date: NOW }, NOW)).toBe('Daily challenge — Regionle ∞');
    expect(routeTitle({ kind: 'daily', date: '2026-11-10' }, NOW)).toMatch(/^Challenge of .*10.* — Regionle ∞$/);
  });

  it('name the other screens, with the description of the game', () => {
    const names = (lang: 'es' | 'en') => {
      setLang(lang);
      return [routeOf('jugar', NOW), routeOf('progreso', NOW), routeOf('configuracion/regiones/ES', NOW), routeOf('duelo/abc', NOW), routeOf('duelo', NOW), routeOf('lista/abc', NOW), routeOf('lista', NOW), routeOf('nada', NOW)].map((r) => routeName(r, NOW));
    };
    expect(names('es')).toEqual(['Partida', 'Progreso', 'Configuración', 'Reto recibido', 'Retos entre dos', 'Lista recibida', 'Listas a medida', 'Dirección desconocida']);
    expect(names('en')).toEqual(['Game', 'Progress', 'Settings', 'Challenge received', 'Challenges for two', 'List received', 'Custom lists', 'Unknown address']);
    for (const path of ['jugar', 'progreso', 'configuracion', 'duelo/abc', 'lista', 'nada']) expect(routeDescription(routeOf(path, NOW), NOW), path).toBe(SEO.en.description);
  });
});
