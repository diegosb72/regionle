/** Pure state machine of the question-by-question games (pin, identify, outline, capitals, flags). */
import { shuffle, type Rng } from '../lib/text';
import type { Res } from '../lib/types';

export interface QuizState {
  pool: string[];
  queue: string[];
  cur: string | null;
  /** Serial number of the current question: changes every time something is asked, even the same item again. */
  n: number;
  /** Wrong attempts and hints used on the current question. */
  tries: number;
  hints: number;
  /** ask → (reveal →) done → next question … → end */
  phase: 'ask' | 'reveal' | 'done' | 'end';
  last: Res | null;
  /** Result of each item the first time it was asked. */
  results: Record<string, Res>;
  /** Colours on the map in the current lap. */
  marks: Record<string, Res>;
  /** Missed items waiting for the review round. */
  again: string[];
  round: 1 | 2;
  asked: number;
  total: number;
  endless: boolean;
  /** Show where the item was after a miss and wait for the player (pin mode). */
  reveal: boolean;
  streak: number;
  bestStreak: number;
  ok: number;
  warn: number;
  bad: number;
  lap: number;
}

export type QuizAction =
  | { type: 'right' }
  | { type: 'wrong'; max: number }
  | { type: 'hint' }
  | { type: 'giveup' }
  | { type: 'next'; rng?: Rng }
  | { type: 'finish' };

export function initQuiz(pool: string[], length: number | 'all' | 'endless', reveal: boolean, rng: Rng = Math.random): QuizState {
  const endless = length === 'endless';
  const n = typeof length === 'number' ? Math.min(length, pool.length) : pool.length;
  const queue = shuffle(pool, rng).slice(0, n);
  const cur = queue.shift() ?? null;
  return {
    pool,
    queue,
    cur,
    n: 0,
    tries: 0,
    hints: 0,
    phase: cur ? 'ask' : 'end',
    last: null,
    results: {},
    marks: {},
    again: [],
    round: 1,
    asked: 0,
    total: endless ? Infinity : n,
    endless,
    reveal,
    streak: 0,
    bestStreak: 0,
    ok: 0,
    warn: 0,
    bad: 0,
    lap: 1,
  };
}

function settle(s: QuizState, res: Res): QuizState {
  const id = s.cur!;
  const next: QuizState = { ...s, last: res, phase: res === 'bad' && s.reveal ? 'reveal' : 'done' };
  if (s.round === 2) {
    // The review round only repaints the map: the score is the first attempt.
    next.marks = { ...s.marks, [id]: res === 'bad' ? 'bad' : 'warn' };
    return next;
  }
  next.results = { ...s.results, [id]: res };
  next.marks = { ...s.marks, [id]: res };
  next.asked = s.asked + 1;
  next[res] = s[res] + 1;
  next.streak = res === 'ok' ? s.streak + 1 : 0;
  next.bestStreak = Math.max(s.bestStreak, next.streak);
  if (res === 'bad') {
    if (s.endless) {
      // Spaced repetition: a missed item comes back a few questions later.
      const queue = s.queue.slice();
      queue.splice(Math.min(queue.length, 3), 0, id);
      next.queue = queue;
    } else next.again = [...s.again, id];
  }
  return next;
}

export function quizReducer(s: QuizState, a: QuizAction): QuizState {
  switch (a.type) {
    case 'right':
      return s.phase === 'ask' && s.cur ? settle(s, s.tries === 0 && s.hints === 0 ? 'ok' : 'warn') : s;
    case 'wrong':
      if (s.phase !== 'ask' || !s.cur) return s;
      return s.tries + 1 >= a.max ? settle({ ...s, tries: s.tries + 1 }, 'bad') : { ...s, tries: s.tries + 1 };
    case 'hint':
      return s.phase === 'ask' ? { ...s, hints: s.hints + 1 } : s;
    case 'giveup':
      return s.phase === 'ask' && s.cur ? settle(s, 'bad') : s;
    case 'finish':
      return { ...s, phase: 'end' };
    case 'next': {
      if (s.phase === 'ask' || s.phase === 'end') return s;
      const fresh = { tries: 0, hints: 0, last: null, phase: 'ask' as const, n: s.n + 1 };
      if (s.queue.length) return { ...s, ...fresh, cur: s.queue[0], queue: s.queue.slice(1) };
      if (s.endless) {
        // New lap: clean map, the items missed last time first.
        const order = shuffle(s.pool, a.rng);
        order.sort((x, y) => Number(s.marks[y] === 'bad') - Number(s.marks[x] === 'bad'));
        const queue = order[0] === s.cur && order.length > 1 ? [...order.slice(1), order[0]] : order;
        return { ...s, ...fresh, cur: queue[0], queue: queue.slice(1), marks: {}, lap: s.lap + 1 };
      }
      if (s.round === 1 && s.again.length) return { ...s, ...fresh, round: 2, cur: s.again[0], queue: s.again.slice(1), again: [] };
      return { ...s, phase: 'end' };
    }
  }
}

/** Share of the score: full credit for first-time answers, half for answers that needed help. */
export function scoreOf(ok: number, warn: number, total: number): number {
  return total ? Math.round(((ok + warn * 0.5) / total) * 100) : 0;
}
