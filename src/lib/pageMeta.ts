/** Title and description of each screen: what the tab, the history and a search engine say of it. */
import { L, fmtDay, getLang } from './i18n';
import { ABOUT_PATH, DAILY_PATH, PATHS, type Route } from './routes';
import { SCREENS, SEO, pageTitle, type ScreenId } from './seo';
import { today } from './text';

/**
 * The screen of a route that has a page of its own (`regiones.html`), whose name and description are the
 * ones that page is written with; null for the rest. A past day's challenge is not the screen of today's.
 */
function screenOf(route: Route, now: string): ScreenId | null {
  if (route.kind === 'section') return PATHS[route.section];
  if (route.kind === 'daily') return route.date === now ? DAILY_PATH : null;
  return route.kind === 'about' ? ABOUT_PATH : null;
}

/** The name of a screen, as its title starts. Null for the first page, which goes by the name of the game. */
export function routeName(route: Route, now: string = today()): string | null {
  const screen = screenOf(route, now);
  if (screen) return SCREENS[screen][getLang()].name;
  switch (route.kind) {
    case 'home':
      return null;
    case 'play':
      return L('Partida', 'Game');
    case 'daily':
      return `${L('Reto del', 'Challenge of')} ${fmtDay(route.date, true)}`;
    case 'duel':
      return route.code ? L('Reto recibido', 'Challenge received') : L('Retos entre dos', 'Challenges for two');
    case 'list':
      return route.code ? L('Lista recibida', 'List received') : L('Listas a medida', 'Custom lists');
    case 'progress':
      return L('Progreso', 'Progress');
    case 'settings':
      return L('Configuración', 'Settings');
    default:
      return L('Dirección desconocida', 'Unknown address');
  }
}

export function routeTitle(route: Route, now?: string): string {
  const name = routeName(route, now);
  return name ? pageTitle(name) : SEO[getLang()].title;
}

export function routeDescription(route: Route, now: string = today()): string {
  // The challenge of any day is described as the challenge is.
  const screen = route.kind === 'daily' ? DAILY_PATH : screenOf(route, now);
  return screen ? SCREENS[screen][getLang()].description : SEO[getLang()].description;
}

/** Writes them into the page. */
export function applyMeta(route: Route): void {
  if (typeof document === 'undefined') return;
  document.title = routeTitle(route);
  document.querySelector('meta[name="description"]')?.setAttribute('content', routeDescription(route));
}
