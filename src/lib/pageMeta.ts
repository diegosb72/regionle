/** Title and description of each screen: what the tab, the history and a search engine say of it. */
import { L, fmtDay, getLang } from './i18n';
import { SECTIONS } from './modes';
import type { Route } from './routes';
import { SEO, pageTitle } from './seo';
import { today } from './text';

/** The name of a screen, as its title starts. Null for the first page, which goes by the name of the game. */
export function routeName(route: Route, now: string = today()): string | null {
  switch (route.kind) {
    case 'home':
      return null;
    case 'section':
      return SECTIONS[route.section].title;
    case 'play':
      return L('Partida', 'Game');
    case 'daily':
      return route.date === now ? L('Reto del día', 'Daily challenge') : `${L('Reto del', 'Challenge of')} ${fmtDay(route.date, true)}`;
    case 'duel':
      return L('Reto recibido', 'Challenge received');
    case 'list':
      return L('Lista recibida', 'List received');
    case 'progress':
      return L('Progreso', 'Progress');
    case 'settings':
      return L('Configuración', 'Settings');
    case 'about':
      return L('Acerca de', 'About');
    default:
      return L('Dirección desconocida', 'Unknown address');
  }
}

export function routeTitle(route: Route, now?: string): string {
  const name = routeName(route, now);
  return name ? pageTitle(name) : SEO[getLang()].title;
}

export function routeDescription(route: Route): string {
  switch (route.kind) {
    case 'section':
      return `${SECTIONS[route.section].blurb} Regionle ∞.`;
    case 'daily':
      return L(
        'El reto del día de Regionle ∞: un país y cinco pruebas, las mismas para todo el mundo, con puntos, racha y resultado para compartir.',
        'The daily challenge of Regionle ∞: one country and five tests, the same for everyone, with points, a streak and a result to share.',
      );
    case 'about':
      return L(
        'Acerca de Regionle ∞: novedades de cada versión, atajos de teclado, qué datos se guardan y dónde, y fuentes y licencias.',
        'About Regionle ∞: what each version brought, keyboard shortcuts, what data is kept and where, and sources and licences.',
      );
    default:
      return SEO[getLang()].description;
  }
}

/** Writes them into the page. */
export function applyMeta(route: Route): void {
  if (typeof document === 'undefined') return;
  document.title = routeTitle(route);
  document.querySelector('meta[name="description"]')?.setAttribute('content', routeDescription(route));
}
