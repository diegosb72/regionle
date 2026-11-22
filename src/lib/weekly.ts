/**
 * The challenge of the week: one long game, the same for everyone, from Monday to Sunday. What it asks
 * follows from the week alone: the themes come round in turn, and the questions of a week are put in order
 * by a seed made from the date of its Monday, as those of a game sent by link are (lib/challenge.ts).
 * What is kept of it is in lib/datedKept.ts.
 */
import { USUAL_RULES } from './rules';
import { capitalGivenAway } from '../daily/spec';
import type { WeekRec } from './datedKept';
import type { GameConfig, Opts } from './store';
import { hashStr } from './text';
import type { Index, Mode } from './types';

/** How many questions the challenge has, where the map of the week has that many pieces. */
export const WEEK_LENGTH = 50;

/** The Monday of the week the themes start with: the week of the first day of 2026. */
const FIRST = '2025-12-29';
const DAY = 86_400_000;

function utc(date: string): number {
  const [y, m, d] = date.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

/** How many days after its Monday a day ("2026-11-20") is: 0 on Monday, 6 on Sunday. */
const into = (date: string): number => (new Date(utc(date)).getUTCDay() + 6) % 7;

/** The Monday of the week a day is in, which is the name its week is kept by. */
export function weekOf(date: string): string {
  return new Date(utc(date) - into(date) * DAY).toISOString().slice(0, 10);
}

/** The last day of a week, its Sunday. */
export const weekEnd = (week: string): string => new Date(utc(week) + 6 * DAY).toISOString().slice(0, 10);

/** The days of its week that a day has left, itself included: 7 on Monday, 1 on Sunday. */
export const daysLeft = (date: string): number => 7 - into(date);

/** Weeks gone by since the first one; those before it count back from it. */
export const weekNumber = (week: string): number => Math.round((utc(week) - utc(FIRST)) / (7 * DAY));

/** What a week asks: a way of asking and the countries it is asked of, the world (null) or a continent. */
export interface WeekTheme {
  mode: Mode;
  part: string | null;
}

/** The themes, in the order they come round: never the same way of asking nor the same place two weeks running. */
export const WEEK_THEMES: readonly WeekTheme[] = [
  { mode: 'flag', part: null },
  { mode: 'mix', part: 'EU' },
  { mode: 'capital', part: null },
  { mode: 'pin', part: 'AF' },
  { mode: 'outline', part: null },
  { mode: 'mix', part: 'AS' },
  { mode: 'pin', part: null },
  { mode: 'mix', part: 'AM' },
  { mode: 'identify', part: null },
  { mode: 'flag', part: 'EU' },
  { mode: 'mix', part: null },
  { mode: 'identify', part: 'AF' },
];

export function themeOf(week: string): WeekTheme {
  const n = WEEK_THEMES.length;
  return WEEK_THEMES[((weekNumber(week) % n) + n) % n];
}

/**
 * The countries a theme is asked of: the sovereign ones of the world, or of its continent. Asked by their
 * capitals, those whose capital is in their name are left out, judged in both languages as the challenge of
 * the day does: among four options they would answer themselves, the game would drop them according to the
 * language, and a week has to ask everyone the same.
 */
export function weekCountries(theme: WeekTheme, index: Index): string[] {
  return index.countries
    .filter((c) => (c.cl === 'un' || c.cl === 'obs' || c.cl === 'partial') && (theme.part == null || c.ct === theme.part) && (theme.mode !== 'capital' || (!!c.cap && !capitalGivenAway(c))))
    .map((c) => c.id)
    .sort();
}

/** How many questions a week has: fifty, or every country of its theme where there are fewer. */
export const weekQuestions = (week: string, index: Index): number => Math.min(WEEK_LENGTH, weekCountries(themeOf(week), index).length);

/** The seed that puts the questions of a week in order. */
export const weekSeed = (week: string): number => hashStr(`regionle|week|${week}`) % 2_147_483_647;

/**
 * The game of a week. What changes the questions is the same for everyone (four options, names on the map
 * to point at, outlines and flags as they are); the rest is as each player likes it. In a medley the pieces
 * and their order are the same in both languages, but a piece or two may be asked another way: whether a
 * capital can be asked depends on how the names read.
 */
export function weekGame(week: string, index: Index, opts: Opts): Omit<GameConfig, 'nonce'> {
  const theme = themeOf(week);
  return {
    section: 'countries',
    mode: theme.mode,
    countries: weekCountries(theme, index),
    levels: {},
    opts: { ...opts, answer: 'choice', length: WEEK_LENGTH, pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal', ...USUAL_RULES },
    challenge: { seed: weekSeed(week) },
    weekly: week,
  };
}

/** The best score of the weeks played, and how many they are. */
export function weekTotals(weekly: Record<string, WeekRec>): { played: number; best: number } {
  const all = Object.values(weekly);
  return { played: all.length, best: all.reduce((top, r) => Math.max(top, r.s), 0) };
}
