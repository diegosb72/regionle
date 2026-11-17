import { useEffect, useState } from 'react';
import { canonicalPath, pageLang, siteRoot } from './routes';

/** What the address bar says after `#/`, as it was typed. */
function typed(): string {
  return window.location.hash.replace(/^#\/?/, '').split('?')[0];
}

/**
 * The address the game is at. One written another way ("#/fisico", "#/Regiones/") is put right in the bar
 * as well, without a new entry in the history, so that what is copied from there is the real one.
 */
function current(): string {
  const raw = typed();
  const path = canonicalPath(raw);
  if (path !== raw) {
    try {
      window.history.replaceState(window.history.state, '', `#/${path}`);
    } catch {
      // A page that may not touch its history (some embedded views): the address stays as typed.
    }
  }
  return path;
}

/** Hash routing: works from any folder and needs no server configuration. */
export function useRoute(): string {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onChange = () => setRoute(current());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function go(path: string): void {
  window.location.hash = `#/${path}`;
  window.scrollTo(0, 0);
}

/**
 * `en.html` and `es.html` are the game in one language for whoever has not chosen any. Once the player
 * chooses, the choice is what counts, so the address goes back to the page that follows it.
 */
export function leaveLangPage(): void {
  if (!pageLang(window.location.pathname)) return;
  try {
    window.history.replaceState(window.history.state, '', `${siteRoot()}${window.location.hash}`);
  } catch {
    // Nothing is lost: the chosen language wins on any page.
  }
}
