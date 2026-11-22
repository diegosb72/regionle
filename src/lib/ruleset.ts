/**
 * «Reglas a medida»: the player sets how the question games are played. Four rules, each of the format it
 * belongs to: in a game at ease, and in one of two players, the tries a question takes and whether hints
 * can be asked for; against the clock, how long it lasts; in a survival, how many lives there are. An exam
 * has no rule to change: it is one try and no hints, or it is not an exam.
 *
 * Here: which rules count in a game, which ones it is played by, how they are told, and the name its
 * records and its ghost are kept under (a record of two minutes is not one of a minute).
 */
import { L } from './i18n';
import { CLOCKS, FORMAT_MODES, LIVES, TRIES, USUAL_RULES, formatOfGame } from './rules';
import type { Format, GameConfig, Opts } from './store';
import type { Mode } from './types';

export interface Rules {
  /** Tries a question takes where it is answered on the map or by typing; among four options there is one. */
  tries: number;
  /** Whether hints can be asked for. */
  hints: boolean;
  /** Seconds a time attack lasts. */
  clock: number;
  /** Lives a survival starts with. */
  lives: number;
}
export type Rule = keyof Rules;

type Ruled = Partial<Pick<Opts, Rule>>;

const among = (choices: readonly number[], value: unknown, usual: number): number => (choices.includes(value as number) ? (value as number) : usual);

/**
 * The rules some options ask for: what is not something a rule can be is the usual one. (A game kept from
 * before the rules could be set has none written, and neither has one made by hand.)
 */
export function rulesOf(opts: Ruled | null | undefined): Rules {
  return {
    tries: among(TRIES, opts?.tries, USUAL_RULES.tries),
    hints: typeof opts?.hints === 'boolean' ? opts.hints : USUAL_RULES.hints,
    clock: among(CLOCKS, opts?.clock, USUAL_RULES.clock),
    lives: among(LIVES, opts?.lives, USUAL_RULES.lives),
  };
}

/** The games answered on the map: there a question takes as many tries as the rules give. */
export const CLICKED: readonly Mode[] = ['pin', 'puzzle', 'listen'];

/**
 * The rules that count in a game: those of its format, and the tries only where a question can take more
 * than one. Among four options there is one try; several are taken on the map, by typing and in a mix,
 * which asks in both ways.
 */
export function rulesIn(format: Format, mode: Mode, answer: Opts['answer'] | undefined): readonly Rule[] {
  if (format === 'timed') return ['clock'];
  if (format === 'lives') return ['lives'];
  if (format === 'exam') return [];
  return CLICKED.includes(mode) || mode === 'mix' || answer === 'type' ? ['tries', 'hints'] : ['hints'];
}

type Game = Pick<GameConfig, 'mode' | 'review' | 'challenge' | 'only' | 'list' | 'step'> & { opts: Ruled & Partial<Pick<Opts, 'answer' | 'format'>> };

/**
 * The rules a game is played by: the ones its options ask for where they count, in the format it is played
 * in, and the usual ones in everything else. They are the player's own choice for the games the player sets
 * up: a review and a step of the day are played by the usual ones, as they always were; and the games that
 * are not of questions have no rules to set.
 */
export function rulesOfGame(game: Game): Rules {
  if (!FORMAT_MODES.includes(game.mode) || game.review || game.step) return { ...USUAL_RULES };
  const asked = rulesOf(game.opts);
  const counts = rulesIn(formatOfGame(game), game.mode, game.opts.answer);
  return {
    tries: counts.includes('tries') ? asked.tries : USUAL_RULES.tries,
    hints: counts.includes('hints') ? asked.hints : USUAL_RULES.hints,
    clock: counts.includes('clock') ? asked.clock : USUAL_RULES.clock,
    lives: counts.includes('lives') ? asked.lives : USUAL_RULES.lives,
  };
}

/** Whether some rule is not the usual one. */
export const customRules = (rules: Rules): boolean => rules.tries !== USUAL_RULES.tries || rules.hints !== USUAL_RULES.hints || rules.clock !== USUAL_RULES.clock || rules.lives !== USUAL_RULES.lives;

/** How long a time attack lasts, in words: "30 segundos", "un minuto", "2 minutos". */
export function clockText(seconds: number): string {
  if (seconds === 60) return L('un minuto', 'a minute');
  if (seconds < 60) return L(`${seconds} segundos`, `${seconds} seconds`);
  return L(`${seconds / 60} minutos`, `${seconds / 60} minutes`);
}

/** …and as short as a button takes it: "30 s", "1 min". */
export const clockShort = (seconds: number): string => (seconds < 60 ? `${seconds} s` : `${seconds / 60} min`);

export const triesText = (n: number): string => L(`${n} ${n === 1 ? 'intento' : 'intentos'}`, `${n} ${n === 1 ? 'try' : 'tries'}`);
export const livesText = (n: number): string => L(`${n} ${n === 1 ? 'vida' : 'vidas'}`, `${n} ${n === 1 ? 'life' : 'lives'}`);

/**
 * The rules of a game that are not the usual ones, in a few words: "1 intento, sin pistas", "2 minutos",
 * "5 vidas". Nothing when they all are.
 */
export function rulesText(rules: Rules): string {
  const said: string[] = [];
  if (rules.tries !== USUAL_RULES.tries) said.push(triesText(rules.tries));
  if (!rules.hints) said.push(L('sin pistas', 'no hints'));
  if (rules.clock !== USUAL_RULES.clock) said.push(clockText(rules.clock));
  if (rules.lives !== USUAL_RULES.lives) said.push(livesText(rules.lives));
  return said.join(', ');
}

/**
 * The name the records of a paced format are kept under: the one they always had for the usual rule
 * ("timed", "lives"), and one of its own for each of the others ("timed120", "lives5"), which is no record
 * of the same thing. (The badges count the usual ones and the harder ones, 30 seconds and one life: lib/badges.ts.)
 */
export function recordName(format: 'timed' | 'lives', rules: Rules): string {
  const rule = format === 'timed' ? 'clock' : 'lives';
  return rules[rule] === USUAL_RULES[rule] ? format : `${format}${rules[rule]}`;
}

/**
 * The rules as they go into the name the ghost of a game is kept under (lib/ghost.ts): nothing for the
 * usual ones, so that the ghosts from before the rules could be set are still found.
 */
export function rulesMark(rules: Rules): string {
  return [rules.tries !== USUAL_RULES.tries ? `t${rules.tries}` : '', rules.hints ? '' : 'h0', rules.clock !== USUAL_RULES.clock ? `c${rules.clock}` : '', rules.lives !== USUAL_RULES.lives ? `l${rules.lives}` : ''].join('');
}
