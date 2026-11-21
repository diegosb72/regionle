/** Pure state machine of the question-by-question games (pin, identify, outline, capitals, flags). */
import type { CardAsk } from '../lib/store';
import { hashStr, mulberry32, nameWithin, namesEcho, namesOverlap, shuffle, type Rng } from '../lib/text';
import type { Deck, Item, Res } from '../lib/types';

/**
 * A place whose capital is in its name answers itself. So does one whose capital also goes by the name of
 * the place (Hlotse is "Leribe" too): any accepted spelling that is made of words of the question could be
 * typed straight back. When the answer is picked (among four options, or on the map) instead of typed, a
 * likeness in the name shown is enough to give it away: `loose` leaves those out as well.
 */
export function answersItself(it: { name: string; capital?: string[] }, loose: boolean): boolean {
  const names = it.capital;
  if (!names?.length) return false;
  return namesOverlap(names[0], it.name) || names.some((cap) => nameWithin(cap, it.name)) || (loose && namesEcho(names[0], it.name));
}

/**
 * The same for what a piece belongs to: the province of Madrid is in the Community of Madrid, León in
 * Castilla y León and Mexico City in Mexico. Asking it would teach nothing.
 */
export function belongsItself(it: { name: string; belongs?: { name: string; answers: string[] } }, loose: boolean): boolean {
  return !!it.belongs && answersItself({ name: it.name, capital: [it.belongs.name, ...it.belongs.answers] }, loose);
}

/**
 * Four options take three wrong capitals that have to be known. Where a map has fewer (the rest are named
 * after their own region and are ruled out at a glance, which leaves the answer standing alone), the
 * capitals can only be asked typed.
 */
export function capitalsNeedTyping(items: readonly { name: string; capital?: string[] }[]): boolean {
  return items.filter((it) => it.capital?.length && !answersItself(it, true)).length < 4;
}

/** A way of asking about a piece: each is a game of its own, and the medley deals them by turns. */
export type Ask = 'pin' | 'identify' | 'puzzle' | 'outline' | 'capital' | 'flag';

/**
 * The ways a piece can be asked about in a medley. Any piece can be pointed at and named; an outline and
 * a jigsaw piece take a surface on a map of regions or countries; a capital, one that has to be known; a
 * flag, a country. `capitals` is false where the map has too few capitals for four options to be fair.
 */
export function asksFor(it: Pick<Item, 'shape' | 'capital' | 'name' | 'country'>, scope: Deck['scope'], rules: { capitals: boolean; loose: boolean }): Ask[] {
  const asks: Ask[] = ['pin', 'identify'];
  if ((scope === 'regions' || scope === 'countries') && it.shape === 'area') asks.push('puzzle', 'outline');
  if (rules.capitals && it.capital?.length && !answersItself(it, rules.loose)) asks.push('capital');
  if (scope === 'countries' && it.country.fl) asks.push('flag');
  return asks;
}

/**
 * The way one piece is asked about in a game: drawn by lot from the seed of the game and the piece, so
 * that it is the same when the piece comes back in the round of misses, and for whoever plays the same
 * game from a link.
 */
export function askOf(seed: number, id: string, asks: readonly Ask[]): Ask {
  return asks[Math.floor(mulberry32((seed ^ hashStr(id)) >>> 0)() * asks.length)] ?? 'pin';
}

/** Degrees either way of upright that still read as upright: a turned outline is never left within them. */
export const TURN_MIN = 50;

/**
 * How far the outline of a piece is turned, in whole degrees clockwise: anything but nearly upright, and
 * the same for the same piece of the same game.
 */
export function turnOf(seed: number, id: string): number {
  return TURN_MIN + Math.floor(mulberry32((seed ^ hashStr(`turn:${id}`)) >>> 0)() * (360 - 2 * TURN_MIN + 1));
}

/** An out-of-focus flag comes a little clearer with each try: how many pixels it is blurred by at each. */
export const FLAG_BLUR = [12, 7, 4];

/** Can a flashcard ask this of a piece? Its name and its place, always; its capital, when it has to be known; its flag, when it has one. */
export function cardable(it: Pick<Item, 'capital' | 'name' | 'country'>, ask: CardAsk): boolean {
  if (ask === 'capital') return !!it.capital?.length && !answersItself(it, false);
  if (ask === 'flag') return !!it.country.fl;
  return true;
}

/**
 * What the flashcards of a map ask for: what the player chose, where the map has it. Flags are asked of
 * countries alone, and capitals where some piece has one worth asking; anything else falls back on the name.
 */
export function cardAskOf(wanted: CardAsk | undefined, deck: Pick<Deck, 'scope' | 'items'>): CardAsk {
  if (wanted === 'where') return 'where';
  if (wanted === 'flag' && deck.scope === 'countries' && deck.items.some((it) => cardable(it, 'flag'))) return 'flag';
  if (wanted === 'capital' && deck.items.some((it) => cardable(it, 'capital'))) return 'capital';
  return 'name';
}

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
  /** An exam: an answer is taken without a word and the next question comes; what is missed is not asked again. */
  exam: boolean;
  /** What is missed is not asked again at the end: an exam, and a game of two players, where each question is one turn. */
  once: boolean;
  streak: number;
  bestStreak: number;
  ok: number;
  warn: number;
  bad: number;
  lap: number;
}

/**
 * `reveal: false` on a miss settles it without the wait to be shown where the piece was: in a medley only
 * the questions answered on the map have somewhere to show.
 */
export type QuizAction =
  | { type: 'right' }
  | { type: 'wrong'; max: number; reveal?: boolean }
  | { type: 'hint' }
  | { type: 'giveup'; reveal?: boolean }
  | { type: 'next'; rng?: Rng }
  | { type: 'finish' };

export function initQuiz(pool: string[], length: number | 'all' | 'endless', reveal: boolean, rng: Rng = Math.random, exam = false, once = exam): QuizState {
  // An exam has an end: it is handed in.
  const endless = length === 'endless' && !exam;
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
    reveal: reveal && !exam,
    exam,
    once: once || exam,
    streak: 0,
    bestStreak: 0,
    ok: 0,
    warn: 0,
    bad: 0,
    lap: 1,
  };
}

function settle(s: QuizState, res: Res, reveal = true): QuizState {
  const id = s.cur!;
  const next: QuizState = { ...s, last: res, phase: res === 'bad' && s.reveal && reveal ? 'reveal' : 'done' };
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
    } else if (!s.once) next.again = [...s.again, id];
  }
  return next;
}

/** The question after one that is settled: the next in line, a new lap, the round of misses or the end. */
function advance(s: QuizState, rng?: Rng): QuizState {
  const fresh = { tries: 0, hints: 0, last: null, phase: 'ask' as const, n: s.n + 1 };
  if (s.queue.length) return { ...s, ...fresh, cur: s.queue[0], queue: s.queue.slice(1) };
  if (s.endless) {
    // New lap: clean map, the items missed last time first.
    const order = shuffle(s.pool, rng);
    order.sort((x, y) => Number(s.marks[y] === 'bad') - Number(s.marks[x] === 'bad'));
    const queue = order[0] === s.cur && order.length > 1 ? [...order.slice(1), order[0]] : order;
    return { ...s, ...fresh, cur: queue[0], queue: queue.slice(1), marks: {}, lap: s.lap + 1 };
  }
  if (s.round === 1 && s.again.length) return { ...s, ...fresh, round: 2, cur: s.again[0], queue: s.again.slice(1), again: [] };
  return { ...s, phase: 'end' };
}

/** A question settled: in an exam the next one comes at once, with nothing said about this one. */
const settled = (s: QuizState, res: Res, reveal?: boolean): QuizState => (s.exam ? advance(settle(s, res, reveal)) : settle(s, res, reveal));

export function quizReducer(s: QuizState, a: QuizAction): QuizState {
  switch (a.type) {
    case 'right':
      return s.phase === 'ask' && s.cur ? settled(s, s.tries === 0 && s.hints === 0 ? 'ok' : 'warn') : s;
    case 'wrong':
      if (s.phase !== 'ask' || !s.cur) return s;
      return s.tries + 1 >= a.max ? settled({ ...s, tries: s.tries + 1 }, 'bad', a.reveal) : { ...s, tries: s.tries + 1 };
    case 'hint':
      return s.phase === 'ask' ? { ...s, hints: s.hints + 1 } : s;
    case 'giveup':
      return s.phase === 'ask' && s.cur ? settled(s, 'bad', a.reveal) : s;
    case 'finish':
      return { ...s, phase: 'end' };
    case 'next':
      return s.phase === 'ask' || s.phase === 'end' ? s : advance(s, a.rng);
  }
}

/** The mark of an exam, out of ten and to one decimal: what was left unanswered counts as wrong. */
export function gradeOf(ok: number, total: number): number {
  return total ? Math.round((ok / total) * 100) / 10 : 0;
}

/** Share of the score: full credit for first-time answers, half for answers that needed help. */
export function scoreOf(ok: number, warn: number, total: number): number {
  return total ? Math.round(((ok + warn * 0.5) / total) * 100) : 0;
}
