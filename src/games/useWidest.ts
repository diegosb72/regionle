/**
 * How wide a name is at the widest piece of it that cannot be cut, in letters of its own size: what is
 * written with it takes a size that fits that piece in one line. The cards of "pairs" and the countries of
 * "connections" are written so.
 */
import { useEffect, useLayoutEffect, useState, type RefObject } from 'react';
import { unbroken } from '../lib/pairs';

/** The size the probe is written in: large, so that the measure is fine. */
const PROBE_PX = 100;

/**
 * The widths of some texts, measured on the page in the typeface they are written with (that of `probe`, a
 * class that also takes the probe out of sight), and again if that typeface arrives after them.
 */
export function useWidest(texts: readonly string[], host: RefObject<HTMLElement | null>, probe: string): ReadonlyMap<string, number> {
  const [widths, setWidths] = useState<ReadonlyMap<string, number>>(new Map());
  const [typeface, setTypeface] = useState(0);
  const all = texts.join('\n');
  useLayoutEffect(() => {
    const at = host.current;
    if (!at) return;
    const span = document.createElement('span');
    span.className = probe;
    span.style.fontSize = `${PROBE_PX}px`;
    at.appendChild(span);
    const out = new Map<string, number>();
    for (const text of new Set(all.split('\n'))) {
      let widest = 0;
      for (const piece of unbroken(text)) {
        span.textContent = piece;
        widest = Math.max(widest, span.getBoundingClientRect().width / PROBE_PX);
      }
      out.set(text, widest);
    }
    span.remove();
    setWidths(out);
  }, [all, typeface, host, probe]);
  useEffect(() => {
    const fonts = document.fonts;
    if (!fonts) return;
    let on = true;
    const again = () => on && setTypeface((n) => n + 1);
    void fonts.ready.then(again);
    fonts.addEventListener?.('loadingdone', again);
    return () => {
      on = false;
      fonts.removeEventListener?.('loadingdone', again);
    };
  }, []);
  return widths;
}

/** Before anything is measured: no letter of the typeface is wider than this on average, in a word. */
export const guessWidth = (text: string): number => Math.max(...unbroken(text).map((piece) => piece.length), 1) * 0.8;
