/**
 * «Dos jugadores»: two people share the device and answer by turns, one question each. What is theirs
 * here: whose turn a question is, what an answer is worth, how the points add up and who is ahead; and the
 * two names, which are kept in the browser apart from the rest and go nowhere else.
 */
import { L } from './i18n';
import type { Res } from './types';

/** Where the names of the two players are kept. */
export const DUO_KEY = 'regionle:duo';
/** The longest name a player can go by: two of them have to fit side by side on a narrow phone. */
export const NAME_MAX = 14;

/** A player: the one who opens the first game, or the other one. */
export type Who = 0 | 1;
export type Names = [string, string];

/** What an answer is worth: right at once, right with help or after a wrong try, and missed. */
export const POINTS: Record<Res, number> = { ok: 2, warn: 1, bad: 0 };

/** Whose turn the question with that number is, counting from 0, when `first` opens the game. */
export const whoOf = (i: number, first: Who = 0): Who => ((i + first) % 2) as Who;

/** The other player. */
export const otherOf = (who: Who): Who => (who === 0 ? 1 : 0);

/** What one player has got: the points, how each answer went and how many there were. */
export interface Tally {
  pts: number;
  ok: number;
  warn: number;
  bad: number;
  n: number;
}

export interface Score {
  of: [Tally, Tally];
  /** Whole rounds: questions that both have answered. */
  rounds: number;
  /** Answers left out because the other player did not get that turn (a game ended half-way through a round). */
  left: number;
}

/**
 * The score after those answers, given in the order they were asked. During a game every answer counts;
 * `whole` is how a game that was ended early is settled: by its whole rounds alone, so that nobody has
 * answered one question more than the other.
 */
export function tally(plays: readonly Res[], first: Who = 0, whole = false): Score {
  const of: [Tally, Tally] = [
    { pts: 0, ok: 0, warn: 0, bad: 0, n: 0 },
    { pts: 0, ok: 0, warn: 0, bad: 0, n: 0 },
  ];
  const rounds = Math.floor(plays.length / 2);
  const counted = whole ? rounds * 2 : plays.length;
  for (let i = 0; i < counted; i++) {
    const t = of[whoOf(i, first)];
    const res = plays[i];
    t.pts += POINTS[res];
    t[res]++;
    t.n++;
  }
  return { of, rounds, left: plays.length - counted };
}

/** Who is ahead: one of them, both alike, or nobody yet when nothing has been answered. */
export function leader(score: Score): Who | 'tie' | null {
  const [a, b] = score.of;
  if (!a.n && !b.n) return null;
  return a.pts === b.pts ? 'tie' : a.pts > b.pts ? 0 : 1;
}

/** A name as it is kept: on one line, its spaces put in order, and no longer than fits. */
export function cleanName(x: unknown): string {
  if (typeof x !== 'string') return '';
  // By letters and not by code units: a name is not cut through the middle of an emoji.
  return Array.from(x.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim())
    .slice(0, NAME_MAX)
    .join('')
    .trim();
}

/** The names kept in this browser: an empty one where none was given. */
export function namesKept(): Names {
  try {
    const kept: unknown = JSON.parse(localStorage.getItem(DUO_KEY) ?? 'null');
    if (Array.isArray(kept)) return [cleanName(kept[0]), cleanName(kept[1])];
  } catch {
    // Nothing kept that can be read: nobody has a name yet.
  }
  return ['', ''];
}

/** Keeps the two names, or nothing at all when neither has one. Returns them as they are kept. */
export function keepNames(names: readonly unknown[]): Names {
  const clean: Names = [cleanName(names[0]), cleanName(names[1])];
  try {
    if (clean[0] || clean[1]) localStorage.setItem(DUO_KEY, JSON.stringify(clean));
    else localStorage.removeItem(DUO_KEY);
  } catch {
    // A browser that keeps nothing: the names last as long as the page does.
  }
  return clean;
}

/** What a player without a name goes by. */
export const defaultName = (who: Who): string => L(`Jugador ${who + 1}`, `Player ${who + 1}`);

/**
 * What the two are called in the game: the name each gave, or «Jugador 1» and «Jugador 2». Two who gave
 * the same name are told apart by a number after it: a turn has to say whose it is.
 */
export function namesShown(names: Names): Names {
  const [a, b] = [names[0] || defaultName(0), names[1] || defaultName(1)];
  return a.toLocaleLowerCase() === b.toLocaleLowerCase() ? [`${a} 1`, `${b} 2`] : [a, b];
}

/** "1 punto", "2 puntos". */
export const pointsOf = (n: number): string => L(`${n} ${n === 1 ? 'punto' : 'puntos'}`, `${n} ${n === 1 ? 'point' : 'points'}`);

/**
 * What the result of a game says first: who wins, or that nobody does, and the points under it. `score` is
 * that of the whole rounds; a game that was ended early is not won by anybody, and says who was ahead.
 */
export function verdictOf(names: Names, score: Score, done: boolean): { title: string; note: string } {
  const [a, b] = score.of;
  const lead = leader(score);
  const hi = Math.max(a.pts, b.pts);
  const lo = Math.min(a.pts, b.pts);
  if (done && lead != null) {
    if (lead === 'tie') return { title: L('Empate', 'A tie'), note: L(`Los dos acabáis con ${pointsOf(hi)}.`, `You both end with ${pointsOf(hi)}.`) };
    return { title: L(`Gana ${names[lead]}`, `${names[lead]} wins`), note: L(`${pointsOf(hi)} a ${lo}.`, `${pointsOf(hi)} to ${lo}.`) };
  }
  const title = L('Partida sin terminar', 'Unfinished game');
  const rounds = L(`${score.rounds} ${score.rounds === 1 ? 'ronda' : 'rondas'}`, `${score.rounds} ${score.rounds === 1 ? 'round' : 'rounds'}`);
  if (lead == null) return { title, note: L('No se ha completado ninguna ronda.', 'No round was completed.') };
  if (lead === 'tie') return { title, note: L(`Ibais empatados a ${pointsOf(hi)} tras ${rounds}.`, `You were level on ${pointsOf(hi)} after ${rounds}.`) };
  return { title, note: L(`Iba ganando ${names[lead]}: ${pointsOf(hi)} a ${lo} tras ${rounds}.`, `${names[lead]} was ahead: ${pointsOf(hi)} to ${lo} after ${rounds}.`) };
}

/** The rule of a game of two, the same wherever it is told. */
export const duoRule = (): string =>
  L(
    'Una pregunta para cada uno, por turnos. Acertar a la primera vale 2 puntos; con pista o tras un fallo, 1. Gana quien sume más.',
    'One question each, by turns. A first-time right answer is worth 2 points; with a hint or after a wrong try, 1. The most points wins.',
  );
