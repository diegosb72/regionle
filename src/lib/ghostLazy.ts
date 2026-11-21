/**
 * The way in to the ghosts («Contra tu fantasma», lib/ghost.ts): what the game of questions and the setup
 * carry of them, which is next to nothing. Which games have a ghost, whether any is kept, and how the code
 * that does the rest (games/Ghost.tsx) is fetched when it is first needed.
 */
import { useEffect, useState } from 'react';
import { FORMAT_MODES } from './rules';
import type { GameConfig } from './store';

/** Where the ghosts are kept in the browser: apart from the rest, which is written again with every answer. */
export const GHOSTS_KEY = 'regionle:ghosts';

/**
 * The games a ghost is kept of: those that ask one thing after another (games/QuizGame.tsx), played at
 * ease and with an end. A custom list is one of them, asked whole. Not a review, a step of the session of
 * the day or a round of what was missed, which are about what is due and not about a map; not a challenge,
 * which has its own rival or its own date; and not an exam, a minute against the clock or three lives,
 * which keep a mark of their own.
 */
export function ghostable(cfg: Omit<GameConfig, 'nonce'>): boolean {
  if (cfg.section === 'pops' || !FORMAT_MODES.includes(cfg.mode)) return false;
  if (cfg.review || cfg.daily || cfg.step || cfg.challenge || cfg.weekly || cfg.zone || cfg.occasion) return false;
  if ((cfg.opts.format ?? 'normal') !== 'normal') return false;
  return cfg.list ? !!cfg.only?.length : !cfg.only && cfg.opts.length !== 'endless';
}

/** Whether any ghost is kept here: asked by whoever would fetch the code only to show one. */
export function anyGhost(): boolean {
  try {
    return localStorage.getItem(GHOSTS_KEY) != null;
  } catch {
    return false;
  }
}

export type GhostCode = typeof import('../games/Ghost');

let code: GhostCode | null = null;
let coming: Promise<GhostCode | null> | null = null;

/** Fetches the code of the ghosts, once. Null when it does not come: the game goes on without them. */
export function ghostCode(): Promise<GhostCode | null> {
  return (coming ??= import('../games/Ghost').then(
    (m) => (code = m),
    () => {
      coming = null;
      return null;
    },
  ));
}

/** The code of the ghosts once it is here, asked for when it is `wanted`: null until then, and if it does not come. */
export function useGhostCode(wanted: boolean): GhostCode | null {
  const [got, setGot] = useState(code);
  useEffect(() => {
    if (!wanted || got) return undefined;
    let on = true;
    void ghostCode().then((m) => {
      if (on && m) setGot(m);
    });
    return () => {
      on = false;
    };
  }, [wanted, got]);
  return got;
}
