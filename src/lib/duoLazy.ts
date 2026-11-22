/**
 * The way in to what a game of two players draws (games/Duo.tsx): the scoreboard, whose turn it is and the
 * result. It is fetched when such a game starts, and the game goes on without it if it does not come.
 */
import { useEffect, useState } from 'react';

export type DuoCode = typeof import('../games/Duo');

let code: DuoCode | null = null;
let coming: Promise<DuoCode | null> | null = null;

/** Fetches what a game of two draws, once. Null when it does not come. */
export function duoCode(): Promise<DuoCode | null> {
  return (coming ??= import('../games/Duo').then(
    (m) => (code = m),
    () => {
      coming = null;
      return null;
    },
  ));
}

/** That code once it is here, asked for when it is `wanted`: null until then, and if it does not come. */
export function useDuoCode(wanted: boolean): DuoCode | null {
  const [got, setGot] = useState(code);
  useEffect(() => {
    if (!wanted || got) return undefined;
    let on = true;
    void duoCode().then((m) => {
      if (on && m) setGot(m);
    });
    return () => {
      on = false;
    };
  }, [wanted, got]);
  return got;
}
