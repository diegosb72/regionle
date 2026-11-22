import { useEffect, useState } from 'react';
import { EMBED_PATH, PATHS, canonicalPath, langPage, pageLang, pageMap, pageScreen, screenPage, siteRoot } from './routes';

/** Writes another address in the bar for where the game already is: no new entry in the history, nothing loaded. */
function rewrite(address: string): void {
  try {
    window.history.replaceState(window.history.state, '', address);
  } catch {
    // A page that may not touch its history (some embedded views): the address stays as it was.
  }
}

/**
 * The address the game is at. It is what the bar says after `#/`; with nothing there, on the page of a
 * screen (`regiones.html`), it is that screen.
 *
 * One written another way ("#/fisico", "#/Regiones/") is put right in the bar as well, so that what is
 * copied from there is the real one. And the page of a screen stands for that screen alone: once the game
 * moves on from it, the address becomes that of the game in the language of the page (`es.html#/paises`),
 * since `regiones.html#/paises` would name two screens.
 *
 * The page of a map (`mapa-es-espana.html`) is its map on the screen of the regions. Once that map is the
 * one chosen, the game is on that screen as on any day (`#/regiones`), and the page stays in the bar for as
 * long as it is: it is still what the page is about.
 */
function current(): string {
  const { hash, pathname } = window.location;
  const map = pageMap(pathname);
  const own = map ?? pageScreen(pathname);
  if (own != null && hash.length < 2) return own;
  const raw = hash.replace(/^#\/?/, '').split('?')[0];
  const path = canonicalPath(raw);
  if (own != null && !(map && path === PATHS.regions)) rewrite(`${siteRoot()}${langPage(pageLang(pathname) ?? 'es')}#/${path}`);
  else if (path !== raw) rewrite(`#/${path}`);
  return path;
}

/** Whether the game has been opened alone, to be shown in a box of another page (lib/embed.ts). */
export function atEmbed(): boolean {
  return current().split('/')[0] === EMBED_PATH;
}

/** Hash routing: works from any folder and needs no server configuration. */
export function useRoute(): string {
  const [route, setRoute] = useState(current);
  useEffect(() => {
    const onChange = () => setRoute(current());
    window.addEventListener('hashchange', onChange);
    // Going back to the page of a screen changes the page of the address, and not always what follows "#".
    window.addEventListener('popstate', onChange);
    return () => {
      window.removeEventListener('hashchange', onChange);
      window.removeEventListener('popstate', onChange);
    };
  }, []);
  return route;
}

export function go(path: string): void {
  window.location.hash = `#/${path}`;
  window.scrollTo(0, 0);
}

/**
 * The address of where the game already is, written anew, and the game told about it: a link that has been
 * followed and applied gives way to the plain address of its screen, with no new entry in the history.
 */
export function settle(path: string): void {
  rewrite(`#/${path}`);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

/**
 * The address follows the language the game speaks.
 *
 * The page of a screen gives way to the page of the same screen in that language (`regions.html` to
 * `regiones.html`), so that what is copied from the bar opens as it is seen. `en.html` and `es.html` are
 * the game in one language for whoever has not chosen any: once the player chooses (`chosen`), the choice
 * is what counts, and the address goes back to the page that follows it.
 */
export function followLang(lang: 'es' | 'en', chosen = false): void {
  const { hash, pathname } = window.location;
  const at = pageLang(pathname);
  if (!at) return;
  const screen = pageScreen(pathname);
  const map = pageMap(pathname);
  if (screen != null) {
    if (at !== lang) rewrite(`${siteRoot()}${screenPage(screen, lang)}${hash}`);
  } else if (map != null) {
    // The page of a map is written in one language, and what it is called in the other is not known here:
    // in another language the game goes on at its own address, with that map.
    if (at !== lang) rewrite(`${siteRoot()}${hash.length > 1 ? hash : `#/${map}`}`);
  } else if (chosen) rewrite(`${siteRoot()}${hash}`);
}

/**
 * For a link written as the page of a screen (`href="regiones.html"`, which a search engine can follow and
 * which opens in a new tab as it is): a plain click moves inside the game instead, without loading it again.
 */
export function inGame(path: string): (e: { defaultPrevented: boolean; button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; preventDefault(): void }) => void {
  return (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    go(path);
  };
}
