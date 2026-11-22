/**
 * Whether the screen is one where the map is not beside what the game is played on, and would be left a
 * strip too small to tell its pieces apart: a phone, upright or lying down, or a tablet held upright. There
 * the word search and the crossword take turns with the map, each with the whole screen. The same rule is
 * in their style sheets (wordsearch.css, crossword.css).
 */
import { useEffect, useState } from 'react';

export const PHONE = '(max-width: 860px), (max-width: 1000px) and (max-height: 500px)';

/** Whether a rule about the screen holds now. */
export function useMedia(query: string): boolean {
  const [holds, setHolds] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(query);
    const on = () => setHolds(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return holds;
}

/** Whether the screen is one of those now. */
export const usePhone = (): boolean => useMedia(PHONE);
