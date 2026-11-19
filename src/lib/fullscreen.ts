/**
 * The game without the bars of the browser. It is the whole page that goes full screen, not a map by
 * itself: the question stays next to it. Asked of the browser, which may not grant it (an iPhone does
 * not, nor a page inside a frame that was not allowed to): then nothing offers it.
 */
import { useCallback, useEffect, useState } from 'react';

/** Safari before 16.4 has it under its own names. */
type Doc = Document & { webkitFullscreenEnabled?: boolean; webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => Promise<void> | void };
type Root = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };

const EVENTS = ['fullscreenchange', 'webkitfullscreenchange'] as const;

export function canFullscreen(doc: Doc = document): boolean {
  const root = doc.documentElement as Root;
  if (typeof root.requestFullscreen === 'function') return doc.fullscreenEnabled !== false;
  return typeof root.webkitRequestFullscreen === 'function' && doc.webkitFullscreenEnabled !== false;
}

export function isFullscreen(doc: Doc = document): boolean {
  return !!(doc.fullscreenElement ?? doc.webkitFullscreenElement);
}

/** In or out. What the browser refuses (it wants a click of the player behind it) is left as it was. */
export async function toggleFullscreen(doc: Doc = document): Promise<void> {
  const root = doc.documentElement as Root;
  try {
    if (isFullscreen(doc)) await (doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.());
    else await (root.requestFullscreen ? root.requestFullscreen() : root.webkitRequestFullscreen?.());
  } catch {
    // Refused: the page stays as it is, and the button with it.
  }
}

/** Whether the page can go full screen, whether it is, and the way in and out. It follows Esc and F11 too. */
export function useFullscreen(): { can: boolean; on: boolean; toggle(): void } {
  const [can] = useState(() => typeof document !== 'undefined' && canFullscreen());
  const [on, setOn] = useState(() => typeof document !== 'undefined' && isFullscreen());
  useEffect(() => {
    if (!can) return;
    const follow = () => setOn(isFullscreen());
    for (const name of EVENTS) document.addEventListener(name, follow);
    follow();
    return () => {
      for (const name of EVENTS) document.removeEventListener(name, follow);
    };
  }, [can]);
  const toggle = useCallback(() => void toggleFullscreen(), []);
  return { can, on, toggle };
}
