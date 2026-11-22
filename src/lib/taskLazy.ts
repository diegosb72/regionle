/**
 * The way in to what a game set as homework draws at its end (games/TaskReceipt.tsx): the receipt for
 * whoever set it. It is fetched when such a game starts, and the game goes on without it if it does not come.
 */
import { useEffect, useState } from 'react';

export type TaskCode = typeof import('../games/TaskReceipt');

let code: TaskCode | null = null;
let coming: Promise<TaskCode | null> | null = null;

/** Fetches it, once. Null when it does not come. */
export function taskCode(): Promise<TaskCode | null> {
  return (coming ??= import('../games/TaskReceipt').then(
    (m) => (code = m),
    () => {
      coming = null;
      return null;
    },
  ));
}

/** That code once it is here, asked for when it is `wanted`: null until then, and if it does not come. */
export function useTaskCode(wanted: boolean): TaskCode | null {
  const [got, setGot] = useState(code);
  useEffect(() => {
    if (!wanted || got) return undefined;
    let on = true;
    void taskCode().then((m) => {
      if (on && m) setGot(m);
    });
    return () => {
      on = false;
    };
  }, [wanted, got]);
  return got;
}
