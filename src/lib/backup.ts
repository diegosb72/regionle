/**
 * The backup: everything the game keeps in this browser, as a file another browser can read. What goes in
 * it, what a file adds up to (told before it replaces what there is), which preferences travel with it and
 * when a new copy is due.
 */
import { LESSON_ORDERS, LESSON_SIZES } from '../games/lesson';
import { DAY_GOAL_DEFAULT, isDayGoal } from './days';
import { CITY_COUNTS } from './extra';
import { isPalette } from './palette';
import { isTextSize } from './reading';
import { isPace, isReviewSize } from './review';
import { isLearnt, type BackupMark, type Opts, type State, type Stat, type Theme } from './store';

/** 4: the preferences travel too. A copy of an earlier version is read all the same. */
export const BACKUP_VERSION = 4;

/** What a player sets once and expects to find again: how the game looks, sounds, counts and asks. */
export const PREF_KEYS = ['theme', 'cb', 'sound', 'haptic', 'hotkeys', 'helpAuto', 'iconBadge', 'miles', 'palette', 'textSize', 'contrast', 'dyslexia', 'reviewPace', 'reviewSize', 'dayGoal', 'nick', 'opts'] as const;
export type Prefs = Pick<State, (typeof PREF_KEYS)[number]>;

export function prefsOf(s: Prefs): Prefs {
  return { theme: s.theme, cb: s.cb, sound: s.sound, haptic: s.haptic, hotkeys: s.hotkeys, helpAuto: s.helpAuto, iconBadge: s.iconBadge, miles: s.miles, palette: s.palette, textSize: s.textSize, contrast: s.contrast, dyslexia: s.dyslexia, reviewPace: s.reviewPace, reviewSize: s.reviewSize, dayGoal: s.dayGoal, nick: s.nick, opts: s.opts };
}

/** The file: the progress, what the player has made (selections, lists, goals, notes, short forms) and the preferences. */
export function backupOf(s: State, now: number) {
  return {
    app: 'regionle',
    version: BACKUP_VERSION,
    exported: new Date(now).toISOString(),
    stats: s.stats,
    where: s.where,
    mix: s.mix,
    sessions: s.sessions,
    recent: s.recent,
    best: s.best,
    favs: s.favs,
    daily: s.daily,
    days: s.days,
    lists: s.lists,
    goals: s.goals,
    notes: s.notes,
    album: s.album,
    badges: s.badges,
    tot: s.tot,
    typeins: s.typeins,
    typeinAuto: s.typeinAuto,
    prefs: prefsOf(s),
  };
}

/** "regionle-progreso-2026-11-19.json" */
export function backupName(word: string, now: number): string {
  return `regionle-${word}-${new Date(now).toISOString().slice(0, 10)}.json`;
}

const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const count = (x: unknown): number => (Array.isArray(x) ? x.length : isObject(x) ? Object.keys(x).length : 0);

/** What a copy, or the game as it stands, adds up to: enough to tell one from the other at a glance. */
export interface Summary {
  /** When the copy was made; null for the game itself, or a copy that does not say. */
  exported: number | null;
  /** Answers kept, and those of them that are learnt. */
  answers: number;
  learnt: number;
  games: number;
  /** Days with something done. */
  days: number;
  lists: number;
  notes: number;
  /** The copy brings preferences (those from before version 4 do not). */
  prefs: boolean;
}

/** What a file adds up to; null when it is not a copy of the game. */
export function summaryOf(data: unknown): Summary | null {
  if (!isObject(data) || !isObject(data.stats) || !Array.isArray(data.sessions)) return null;
  const stats = Object.values(data.stats).filter((st): st is Stat => Array.isArray(st) && typeof st[0] === 'number' && st[0] > 0);
  const tot = isObject(data.tot) ? data.tot : {};
  const exported = typeof data.exported === 'string' ? Date.parse(data.exported) : NaN;
  return {
    exported: Number.isFinite(exported) ? exported : null,
    answers: stats.length,
    learnt: stats.reduce((n, st) => n + (isLearnt(st) ? 1 : 0), 0),
    games: typeof tot.g === 'number' && tot.g >= 0 ? tot.g : data.sessions.length,
    days: count(data.days),
    lists: count(data.lists),
    notes: count(data.notes),
    prefs: isObject(data.prefs),
  };
}

const THEMES: readonly Theme[] = ['auto', 'light', 'dark'];
/** What each option of a game can be; the rest are switches or figures. */
const OPT_CHOICES: { [K in keyof Opts]?: readonly Opts[K][] } = {
  answer: ['choice', 'type'],
  length: ['all', 10, 20, 50, 'endless'],
  pinBy: ['name', 'capital', 'flag'],
  metric: ['pop', 'area', 'density'],
  axis: ['ns', 'we'],
  cityPick: ['top', 'caps', 'regcaps'],
  cityCount: CITY_COUNTS,
  format: ['normal', 'timed', 'lives', 'exam'],
  flagLook: ['plain', 'grey', 'blur'],
  cardAsk: ['name', 'where', 'capital', 'flag'],
  bearingAsk: ['both', 'dir', 'dist'],
  coordsAsk: ['mark', 'read'],
  lessonSize: LESSON_SIZES,
  lessonOrder: LESSON_ORDERS,
};

/** The options of a copy laid over the ones in force: each is taken only if it is something that option can be. */
function cleanOpts(raw: unknown, current: Opts): Opts {
  if (!isObject(raw)) return current;
  const out: Record<string, unknown> = { ...current };
  for (const key of Object.keys(current) as (keyof Opts)[]) {
    const value = raw[key];
    const choices = OPT_CHOICES[key] as readonly unknown[] | undefined;
    if (choices) {
      if (choices.includes(value)) out[key] = value;
    } else if (typeof current[key] === 'boolean') {
      if (typeof value === 'boolean') out[key] = value;
    } else if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 3600) out[key] = Math.round(value);
  }
  return out as unknown as Opts;
}

/**
 * The preferences a copy brings, checked one by one: what is not something that preference can be stays as
 * it is here. Null when the copy brings none.
 */
export function cleanPrefs(raw: unknown, current: Prefs): Prefs | null {
  if (!isObject(raw)) return null;
  const flag = (key: 'cb' | 'sound' | 'haptic' | 'hotkeys' | 'helpAuto' | 'iconBadge' | 'miles' | 'contrast' | 'dyslexia'): boolean => (typeof raw[key] === 'boolean' ? (raw[key] as boolean) : current[key]);
  return {
    theme: THEMES.includes(raw.theme as Theme) ? (raw.theme as Theme) : current.theme,
    cb: flag('cb'),
    sound: flag('sound'),
    haptic: flag('haptic'),
    hotkeys: flag('hotkeys'),
    helpAuto: flag('helpAuto'),
    iconBadge: flag('iconBadge'),
    miles: flag('miles'),
    palette: isPalette(raw.palette) ? raw.palette : current.palette,
    textSize: isTextSize(raw.textSize) ? raw.textSize : current.textSize,
    contrast: flag('contrast'),
    dyslexia: flag('dyslexia'),
    reviewPace: isPace(raw.reviewPace) ? raw.reviewPace : current.reviewPace,
    reviewSize: isReviewSize(raw.reviewSize) ? raw.reviewSize : current.reviewSize,
    dayGoal: isDayGoal(raw.dayGoal) ? raw.dayGoal : (current.dayGoal ?? DAY_GOAL_DEFAULT),
    nick: typeof raw.nick === 'string' ? raw.nick.slice(0, 24) : current.nick,
    opts: cleanOpts(raw.opts, current.opts),
  };
}

const DAY = 86_400_000;
/** A new copy is due after this many answers, and not before this long: whichever comes last. */
export const BACKUP_EVERY_ANSWERS = 300;
export const BACKUP_EVERY_MS = 14 * DAY;

/** Answers given since the last copy, or since the reminder was last put off. */
export function sinceBackup(mark: BackupMark, answered: number): number {
  return Math.max(0, answered - mark.q);
}

/** Whether it is time to remind of a copy: enough has been answered, and enough time has gone by. */
export function backupDue(mark: BackupMark, answered: number, now: number): boolean {
  return sinceBackup(mark, answered) >= BACKUP_EVERY_ANSWERS && now - mark.from >= BACKUP_EVERY_MS;
}

type Sharer = { canShare?: (data: { files: File[] }) => boolean };

/**
 * The copy as a file the system can hand to another app (a drive, a mail, a chat), where the browser shares
 * files: on a phone, that is how a file gets anywhere. Null where it does not. Some browsers share text files
 * and not JSON ones: the same copy goes under a name they take, and is read back the same.
 */
export function shareFile(text: string, name: string, nav: Sharer | undefined = typeof navigator === 'undefined' ? undefined : (navigator as Sharer)): File | null {
  if (!nav || typeof nav.canShare !== 'function' || typeof File === 'undefined') return null;
  for (const [ext, type] of [
    ['json', 'application/json'],
    ['txt', 'text/plain'],
  ] as const) {
    try {
      const file = new File([text], name.replace(/\.json$/, `.${ext}`), { type });
      if (nav.canShare({ files: [file] })) return file;
    } catch {
      // Not this one.
    }
  }
  return null;
}
