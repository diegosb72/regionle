/** Persistent app state: selections, options, favourites and learning progress (localStorage). */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { NAME_MAX, TESTS, cleanRivals, emptyRec, streakOf, withJokers, withRival, type DailyRec, type Rival } from '../daily/spec';
import { DAY_GOAL_DEFAULT, cleanDays, dailyWork, daysFrom, isDayGoal, studyStreak, withDay, type Days } from './days';
import type { CityPick } from './extra';
import { GOALS_MAX, cleanGoals, goalWithout, sameGoal, withMark, type Goal } from './goals';
import type { Lang } from './i18n';
import { cleanMix, dropMix, withMix, type Mix } from './mix';
import { cleanNotes, dropNotes, withNote, type Notes } from './notes';
import { PALETTE_DEFAULT, isPalette, type Palette } from './palette';
import { RECENT_MAX, isRecent, recentConfig, recentOf, withRecent, type Recent } from './recent';
import { PACE_DEFAULT, REVIEW_MAX, isPace, isReviewSize, setReviewPrefs, type Pace } from './review';
import { today } from './text';
import { cleanTypeins, setTypeins as applyTypeins, type Typeins } from './typeinPrefs';
import type { Mode, Res, Section } from './types';
import { setUnits } from './units';

/**
 * The flags of the album (see lib/album.ts): id of the country → when its flag was learnt. A flag that
 * has gone in stays, even if it is missed afterwards: the answers say what is known now, the album what
 * has been learnt at some time.
 */
export type FlagAlbum = Record<string, number>;

/**
 * Room for every country and territory there is, and no more: what is stored cannot grow without end.
 * Up here, before the store is made: what is kept in the browser is read while it is being made, and a
 * constant further down would not exist yet.
 */
export const ALBUM_MAX = 400;

/** The album with the flags that `stats` has learnt and were not in it; the same album when there is none. */
export function withFlags(album: FlagAlbum, stats: Record<string, Stat>): FlagAlbum {
  let out = album;
  let room = ALBUM_MAX - Object.keys(album).length;
  for (const [key, stat] of Object.entries(stats)) {
    if (room <= 0) break;
    if (!key.startsWith('flag:') || !isLearnt(stat)) continue;
    const id = key.slice(5);
    if (out[id]) continue;
    if (out === album) out = { ...album };
    out[id] = stat[3] || 1;
    room--;
  }
  return out;
}

/** What a stored album may hold: ids with the time they went in. */
export function cleanAlbum(raw: unknown): FlagAlbum {
  const out: FlagAlbum = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  let n = 0;
  for (const [id, at] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= ALBUM_MAX) break;
    if (!id || id.length > 12 || typeof at !== 'number' || !Number.isFinite(at) || at <= 0) continue;
    out[id] = at;
    n++;
  }
  return out;
}

export type Length = 'all' | 10 | 20 | 50 | 'endless';
export type Theme = 'auto' | 'light' | 'dark';
/** How a question-by-question game is paced: a set of questions, against the clock, or until the lives run out. */
/** How a game of questions is played: at ease, against the clock, until the lives run out, or as an exam. */
export type Format = 'normal' | 'timed' | 'lives' | 'exam';

export interface Opts {
  /** How names are answered: four options or typing. */
  answer: 'choice' | 'type';
  length: Length;
  /** Autocomplete while typing. */
  suggest: boolean;
  /** What "pin it" shows for countries. */
  pinBy: 'name' | 'capital' | 'flag';
  /** The figure the number games of the countries are about. */
  metric: 'pop' | 'area' | 'density';
  /** Which way five places are put in order: from north to south, or from west to east. */
  axis: 'ns' | 'we';
  /** Seconds to fill the map in; 0 for no limit. */
  countdown: number;
  /** Route game without internal borders. */
  blind: boolean;
  /** Keep the names of solved items on the map. */
  labels: boolean;
  /** Cities section: which ones are played, and how many when it is the most populous. */
  cityPick: CityPick;
  cityCount: number;
  /** Show what Wikipedia says about an answer that was missed. */
  wiki: boolean;
  format: Format;
  /** Outlines drawn turned, without north at the top: harder to recognise. */
  turned: boolean;
  /** How a flag is shown while it is asked about: as it is, without its colours, or out of focus. */
  flagLook: FlagLook;
  /** What a flashcard asks for: the name of what the map shows, where it is, its capital, or whose flag it is. */
  cardAsk: CardAsk;
  /** What "distances and bearings" asks: which way, how far, or one and the other in turn. */
  bearingAsk: BearingAsk;
  /** What "coordinates" asks: to mark the point that some coordinates name, or to read the coordinates of a marked point. */
  coordsAsk: CoordsAsk;
}

export type FlagLook = 'plain' | 'grey' | 'blur';
export type CardAsk = 'name' | 'where' | 'capital' | 'flag';
export type BearingAsk = 'both' | 'dir' | 'dist';
export type CoordsAsk = 'mark' | 'read';

export interface GameConfig {
  section: Section;
  mode: Mode;
  countries: string[];
  levels: Record<string, string>;
  opts: Opts;
  /** Restrict the questions to these items (review of mistakes). */
  only?: string[];
  /** Day of a daily puzzle ("2026-11-15"). */
  daily?: string;
  /** Part of today's review: the map is widened around what is due and the results offer the next one. */
  review?: boolean;
  /** Name of the custom list the game is restricted to (its items are in `only`). */
  list?: string;
  /** The list being edited, in the editor of custom lists. */
  listId?: string;
  /**
   * A game received by link: the questions are fixed and the sender's result is shown at the end.
   * `legacy` marks a link made before capitals named after their place stopped being asked: it is
   * played with the questions its sender had.
   */
  challenge?: { seed: number; from?: string; score?: number; ms?: number; legacy?: boolean };
  /**
   * A medley of its misses: the lot the ways of asking were dealt with in the game they come from, so that
   * each piece is asked again the way it was missed.
   */
  lot?: number;
  /** Changes on every start so that an identical configuration still restarts the game. */
  nonce: number;
}

export interface Fav {
  name: string;
  section: Section;
  ids: string[];
  levels?: Record<string, string>;
}

/** A list of pieces chosen one by one: "the twelve for Thursday's exam". */
export interface CustomList {
  id: string;
  name: string;
  section: Section;
  /** The map it is played on: countries (or the tokens of a physical map) and their levels. */
  countries: string[];
  levels: Record<string, string>;
  /** Cities: which ones the map holds besides the chosen ones. */
  cityPick?: CityPick;
  cityCount?: number;
  ids: string[];
}

export interface SessionRec {
  t: number;
  section: Section;
  mode: Mode;
  label: string;
  total: number;
  ok: number;
  warn: number;
  bad: number;
  ms: number;
  note?: string;
}

/** What is being learnt about an item: where it is, its name, its capital, its flag, its neighbours. */
export type Skill = 'loc' | 'name' | 'cap' | 'flag' | 'nb';
/** [times seen, times right first time, current run of right answers, last time seen] */
export type Stat = [number, number, number, number];

const EUROPE =
  'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA'.split(' ');
const G20 = 'AR AU BR CA CN DE ES FR GB ID IN IT JP KR MX RU SA TR US ZA'.split(' ');

export const DEFAULT_OPTS: Opts = {
  answer: 'type',
  length: 'all',
  suggest: false,
  pinBy: 'name',
  metric: 'pop',
  axis: 'ns',
  countdown: 0,
  blind: false,
  labels: true,
  cityPick: 'top',
  cityCount: 25,
  wiki: true,
  format: 'normal',
  turned: false,
  flagLook: 'plain',
  cardAsk: 'name',
  bearingAsk: 'both',
  coordsAsk: 'mark',
};

/** `stats` and `where` without anything about the given ids ("loc:x", "name:x"… and the map x was learnt on). */
export function dropAnswers(stats: Record<string, Stat>, where: Record<string, string>, ids: readonly string[]): { stats: Record<string, Stat>; where: Record<string, string> } {
  const gone = new Set(ids);
  // A key is "skill:id", and an id can hold a colon itself ("r:volga"): the skill is what comes before the first.
  const keep = <T,>(o: Record<string, T>, idOf: (k: string) => string) => Object.fromEntries(Object.entries(o).filter(([k]) => !gone.has(idOf(k))));
  return { stats: keep(stats, (k) => k.slice(k.indexOf(':') + 1)), where: keep(where, (k) => k) };
}

/** Lifetime tallies; the list of sessions only keeps the latest ones. */
export type Totals = Record<string, number>;

/**
 * The last backup: when it was made (0 when none is known of), and the moment and the count of answers the
 * reminder of the next one counts from, which move too when the reminder is put off.
 */
export interface BackupMark {
  at: number;
  from: number;
  q: number;
}
const NO_BACKUP: BackupMark = { at: 0, from: 0, q: 0 };

/** What a stored mark may be: three figures that are not negative. */
export function cleanBackupMark(raw: unknown): BackupMark {
  const m = raw as Partial<BackupMark> | null;
  const n = (x: unknown): number => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);
  return m && typeof m === 'object' ? { at: n(m.at), from: n(m.from), q: n(m.q) } : NO_BACKUP;
}

export interface State {
  theme: Theme;
  sel: Record<Section, string[]>;
  levels: Record<string, string>;
  mode: Record<Section, Mode>;
  opts: Opts;
  favs: Fav[];
  game: GameConfig | null;
  stats: Record<string, Stat>;
  /**
   * Where each item that has been asked comes from ("r|ES|g1", "c", "t|ES", "p"): what the review
   * needs to draw its map again.
   */
  where: Record<string, string>;
  /** What has been taken for what: asked about one piece, the answer was another (see lib/mix.ts). */
  mix: Mix;
  sessions: SessionRec[];
  /** The maps played lately, the last one first: what the first page offers to play again. */
  recent: Recent[];
  best: Record<string, number>;
  /** Results of the daily challenge by day. */
  daily: Record<string, DailyRec>;
  /** Results of the daily challenge that others sent by link, by day: to set beside one's own. */
  rivals: Record<string, Rival[]>;
  /** Interface language; null until chosen: the browser's language decides. */
  lang: Lang | null;
  /** Name put on the challenges sent to others. */
  nick: string;
  /** Custom lists, and the one in use in each section. */
  lists: CustomList[];
  listOn: Partial<Record<Section, string>>;
  /** What was done each day: the calendar of activity, the days in a row and the daily goal (see lib/days.ts). */
  days: Days;
  /** Answers a day to aim at; 0 when the player wants no goal. */
  dayGoal: number;
  /** Goals with a date: a map to be known by a day (see lib/goals.ts). */
  goals: Goal[];
  /** The player's own notes about a piece, by its id (see lib/notes.ts). */
  notes: Notes;
  /** The flags learnt at some time, which stay in the album (see `FlagAlbum`). */
  album: FlagAlbum;
  /** Achievements earned: id → when. */
  badges: Record<string, number>;
  /** g games · q answers · ok first-time right · warn right with help · ms time · and one-off counters (lessons, regionle1, near…). */
  tot: Totals;
  /** Colours that can be told apart with colour blindness. */
  cb: boolean;
  /** The welcome for first-time players has been put away. */
  welcomed: boolean;
  /** One-key shortcuts (1 to 5, R, P, T, ?) work; turned off by whoever they get in the way of. */
  hotkeys: boolean;
  /** A sound for each answer, right or wrong. Off until asked for. */
  sound: boolean;
  /** A short buzz of the phone for each answer. Off until asked for. */
  haptic: boolean;
  /** The number of waiting reviews on the icon of the installed game. On unless turned off. */
  iconBadge: boolean;
  /** Distances in miles and surfaces in square miles, instead of kilometres. Off until asked for. */
  miles: boolean;
  /** The colours the maps are drawn in. */
  palette: Palette;
  /** How far apart the reviews are set, and how many questions one review game asks at most. */
  reviewPace: Pace;
  reviewSize: number;
  backup: BackupMark;
  /** Short forms chosen in the settings for each thing, by id: those added to it and those taken from it. */
  typeins: Typeins;
  /** Whether names of several words get their initials unasked; null until chosen: as the game ships. */
  typeinAuto: boolean | null;

  setCb(cb: boolean): void;
  setDayGoal(goal: number): void;
  setWelcomed(): void;
  setHotkeys(on: boolean): void;
  setSound(on: boolean): void;
  setHaptic(on: boolean): void;
  setIconBadge(on: boolean): void;
  setMiles(on: boolean): void;
  setPalette(palette: Palette): void;
  setReviewPace(pace: Pace): void;
  setReviewSize(size: number): void;
  setTypeins(typeins: Typeins): void;
  setTypeinAuto(auto: boolean | null): void;
  saveList(list: CustomList): void;
  removeList(id: string): void;
  setListOn(section: Section, id: string | null): void;
  /** Sets a goal; one about the same pieces and skill is replaced, and the oldest goes when there are too many. */
  saveGoal(goal: Goal): void;
  removeGoal(id: string): void;
  setGoalDate(id: string, date: string): void;
  /** Notes, once a day, how much of each goal had been seen when the day began. */
  markGoals(): void;
  /** Writes the note of a piece; an empty one takes it away. False when there is no room for a new one. */
  setNote(id: string, text: string): boolean;
  /** Marks achievements as earned now. */
  earn(ids: string[]): void;
  /** Adds to lifetime tallies. */
  bump(patch: Totals): void;
  setTheme(theme: Theme): void;
  setLang(lang: Lang): void;
  setNick(nick: string): void;
  /**
   * Stores the points of one test of a day; closes the day when it was the last one. `hard` says which way
   * it is being played, and counts only with the first test that is scored: a day is played one way.
   */
  setDaily(date: string, test: number, points: number, figure: number, hard?: boolean): void;
  /** Keeps the result somebody sent of the challenge of a day. */
  addRival(date: string, rival: Rival): void;
  /** Takes one of them away: the one at that place of the day's list. */
  dropRival(date: string, index: number): void;
  setSel(section: Section, ids: string[]): void;
  setLevel(country: string, level: string): void;
  setMode(section: Section, mode: Mode): void;
  setOpts(patch: Partial<Opts>): void;
  addFav(fav: Fav): void;
  removeFav(section: Section, name: string): void;
  start(cfg: Omit<GameConfig, 'nonce'>): void;
  /** Starts a map played before again, and leaves the menus of its section as they were for it. */
  resume(recent: Recent): void;
  /** Forgets the game in course. */
  leave(): void;
  record(skill: Skill, id: string, res: Res, origin?: string): void;
  /** Writes down that `given` was the answer to a question about `asked`. */
  mixUp(skill: Skill, asked: string, given: string): void;
  /** Drops what is known about some answers: questions that are no longer asked must not stay due. */
  forget(skill: Skill, ids: string[]): void;
  /** Drops everything known about things that are no longer in the data, whatever the skill. */
  drop(ids: string[]): void;
  addSession(rec: SessionRec): void;
  /** Stores a record; returns true when it beats the previous one. */
  setBest(key: string, value: number, lowerWins?: boolean): boolean;
  resetProgress(): void;
  /**
   * Replaces the progress with that of a copy; false when it is not one. `prefs` are the preferences to bring
   * along, already checked (see `cleanPrefs` in lib/backup.ts); `now` is when, for the reminder of the next copy.
   */
  importData(data: unknown, prefs?: Partial<State> | null, now?: number): boolean;
  /** A copy has just been saved: the reminder counts from here. */
  markBackup(now: number): void;
  /** The reminder of a copy is put off: it counts from here, and the date of the last copy stays. */
  snoozeBackup(now: number): void;
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      theme: 'auto',
      sel: { regions: ['ES'], countries: EUROPE, pops: G20, cities: ['ES'], physical: ['river', 'EU'] },
      levels: {},
      mode: { regions: 'pin', countries: 'pin', pops: 'hilo', cities: 'pin', physical: 'pin' },
      opts: DEFAULT_OPTS,
      favs: [],
      game: null,
      stats: {},
      where: {},
      mix: {},
      sessions: [],
      recent: [],
      best: {},
      daily: {},
      rivals: {},
      days: {},
      dayGoal: DAY_GOAL_DEFAULT,
      lang: null,
      nick: '',
      lists: [],
      listOn: {},
      goals: [],
      notes: {},
      album: {},
      badges: {},
      tot: {},
      cb: false,
      welcomed: false,
      hotkeys: true,
      sound: false,
      haptic: false,
      iconBadge: true,
      miles: false,
      palette: PALETTE_DEFAULT,
      reviewPace: PACE_DEFAULT,
      reviewSize: REVIEW_MAX,
      backup: NO_BACKUP,
      typeins: {},
      typeinAuto: null,

      setCb: (cb) => set({ cb }),
      setDayGoal: (goal) => set({ dayGoal: isDayGoal(goal) ? goal : DAY_GOAL_DEFAULT }),
      setNote: (id, text) => {
        const notes = withNote(get().notes, id, text);
        if (!notes) return false;
        if (notes !== get().notes) set({ notes });
        return true;
      },
      setWelcomed: () => set({ welcomed: true }),
      setHotkeys: (hotkeys) => set({ hotkeys }),
      setSound: (sound) => set({ sound }),
      setHaptic: (haptic) => set({ haptic }),
      setIconBadge: (iconBadge) => set({ iconBadge }),
      setMiles: (miles) => set({ miles }),
      setPalette: (palette) => set({ palette: isPalette(palette) ? palette : PALETTE_DEFAULT }),
      setReviewPace: (pace) => set({ reviewPace: isPace(pace) ? pace : PACE_DEFAULT }),
      setReviewSize: (size) => set({ reviewSize: isReviewSize(size) ? size : REVIEW_MAX }),
      setTypeins: (typeins) => set({ typeins }),
      setTypeinAuto: (typeinAuto) => set({ typeinAuto }),
      saveList: (list) => set((s) => ({ lists: [...s.lists.filter((l) => l.id !== list.id), list] })),
      removeList: (id) =>
        set((s) => ({
          lists: s.lists.filter((l) => l.id !== id),
          listOn: Object.fromEntries(Object.entries(s.listOn).filter(([, v]) => v !== id)),
        })),
      setListOn: (section, id) =>
        set((s) => {
          const listOn = { ...s.listOn };
          if (id) listOn[section] = id;
          else delete listOn[section];
          return { listOn };
        }),
      saveGoal: (goal) => set((s) => ({ goals: [...s.goals.filter((g) => g.id !== goal.id && !sameGoal(g, goal)), withMark(goal, s.stats, Date.now())].slice(-GOALS_MAX) })),
      removeGoal: (id) => set((s) => ({ goals: s.goals.filter((g) => g.id !== id) })),
      setGoalDate: (id, date) => set((s) => ({ goals: s.goals.map((g) => (g.id === id ? { ...g, date } : g)) })),
      markGoals: () =>
        set((s) => {
          const now = Date.now();
          const goals = s.goals.map((g) => withMark(g, s.stats, now));
          return goals.some((g, i) => g !== s.goals[i]) ? { goals } : {};
        }),
      earn: (ids) =>
        set((s) => {
          const fresh = ids.filter((id) => !s.badges[id]);
          if (!fresh.length) return {};
          const now = Date.now();
          return { badges: { ...s.badges, ...Object.fromEntries(fresh.map((id) => [id, now])) } };
        }),
      bump: (patch) =>
        set((s) => {
          const tot = { ...s.tot };
          for (const [k, v] of Object.entries(patch)) tot[k] = (tot[k] ?? 0) + v;
          return { tot };
        }),
      setTheme: (theme) => set({ theme }),
      setLang: (lang) => set({ lang }),
      setNick: (nick) => set({ nick: nick.slice(0, NAME_MAX) }),
      addRival: (date, rival) => set((s) => ({ rivals: withRival(s.rivals, date, rival) })),
      dropRival: (date, index) => set((s) => ({ rivals: cleanRivals({ ...s.rivals, [date]: (s.rivals[date] ?? []).filter((_, i) => i !== index) }) })),
      setDaily: (date, test, points, figure, hard = false) =>
        set((s) => {
          const prev = s.daily[date] ?? emptyRec();
          if (test < 0 || test >= TESTS || prev.p[test] != null) return {};
          const rec: DailyRec = { ...prev, p: prev.p.slice(), k: prev.k.slice() };
          if (hard && prev.p.every((x) => x == null)) rec.h = 1;
          rec.p[test] = points;
          rec.k[test] = figure;
          let days = s.days;
          let daily = { ...s.daily, [date]: rec };
          if (rec.p.every((x) => x != null) && !rec.t) {
            rec.t = Date.now();
            if (date !== today()) rec.late = 1;
            // Finished on its day after a day or two with nothing: the wildcards in hand stand in for them.
            else daily = withJokers(daily, s.daily, date);
            // The challenge is work of the day it was finished on, whatever day of the calendar it was.
            days = withDay(days, rec.t, dailyWork(rec.p), s.dayGoal, learntIn(s.stats));
          }
          const best = { ...s.best };
          const streak = streakOf(daily, today());
          if (streak > (best['daily:streak'] ?? 0)) best['daily:streak'] = streak;
          const run = studyStreak(days, today());
          if (run > (best['study:streak'] ?? 0)) best['study:streak'] = run;
          return { daily, days, best };
        }),
      setSel: (section, ids) => set((s) => ({ sel: { ...s.sel, [section]: [...new Set(ids)] } })),
      setLevel: (country, level) => set((s) => ({ levels: { ...s.levels, [country]: level } })),
      setMode: (section, mode) => set((s) => ({ mode: { ...s.mode, [section]: mode } })),
      setOpts: (patch) => set((s) => ({ opts: { ...s.opts, ...patch } })),
      addFav: (fav) => set((s) => ({ favs: [...s.favs.filter((f) => !(f.section === fav.section && f.name === fav.name)), fav] })),
      removeFav: (section, name) => set((s) => ({ favs: s.favs.filter((f) => !(f.section === section && f.name === name)) })),
      start: (cfg) => set((s) => ({ game: { ...cfg, nonce: Math.max(Date.now(), (s.game?.nonce ?? 0) + 1) } })),
      resume: (r) =>
        set((s) => {
          const cfg = recentConfig(r, s.opts);
          // It was not played on a list: one in use in that section would hide the map that comes back.
          const listOn = { ...s.listOn };
          delete listOn[r.section];
          return {
            listOn,
            sel: { ...s.sel, [r.section]: cfg.countries },
            levels: { ...s.levels, ...cfg.levels },
            mode: { ...s.mode, [r.section]: r.mode },
            opts: cfg.opts,
            game: { ...cfg, nonce: Math.max(Date.now(), (s.game?.nonce ?? 0) + 1) },
          };
        }),
      leave: () => set({ game: null }),
      record: (skill, id, res, origin) =>
        set((s) => {
          const k = `${skill}:${id}`;
          const [seen, ok, run] = s.stats[k] ?? [0, 0, 0, 0];
          const now = Date.now();
          const stats: Record<string, Stat> = { ...s.stats, [k]: [seen + 1, ok + (res === 'ok' ? 1 : 0), res === 'ok' ? run + 1 : 0, now] };
          // A flag that has just been learnt goes into the album, and stays there.
          const album = skill === 'flag' && !s.album[id] && isLearnt(stats[k]) && Object.keys(s.album).length < ALBUM_MAX ? { ...s.album, [id]: now } : s.album;
          return origin && s.where[id] !== origin ? { stats, album, where: { ...s.where, [id]: origin } } : { stats, album };
        }),
      mixUp: (skill, asked, given) => set((s) => ({ mix: withMix(s.mix, s.stats, skill, asked, given, Date.now()) })),
      forget: (skill, ids) =>
        set((s) => {
          const stats = { ...s.stats };
          for (const id of ids) delete stats[`${skill}:${id}`];
          return { stats };
        }),
      drop: (ids) =>
        set((s) => {
          const gone = new Set(ids);
          const goals = s.goals.map((g) => goalWithout(g, gone));
          return {
            ...dropAnswers(s.stats, s.where, ids),
            mix: dropMix(s.mix, ids),
            notes: dropNotes(s.notes, ids),
            ...(goals.some((g, i) => g !== s.goals[i]) ? { goals: goals.filter((g): g is Goal => !!g) } : {}),
          };
        }),
      addSession: (rec) =>
        set((s) => {
          const days = withDay(s.days, rec.t, rec, s.dayGoal, learntIn(s.stats));
          // The longest run of days is kept apart: the days themselves are not kept for ever.
          const run = studyStreak(days, today(new Date(rec.t)));
          return {
            sessions: [rec, ...s.sessions].slice(0, 80),
            recent: withRecentOf(s.recent, s.game, rec),
            days,
            ...(run > (s.best['study:streak'] ?? 0) ? { best: { ...s.best, 'study:streak': run } } : {}),
            tot: { ...s.tot, g: (s.tot.g ?? 0) + 1, q: (s.tot.q ?? 0) + rec.total, ok: (s.tot.ok ?? 0) + rec.ok, warn: (s.tot.warn ?? 0) + rec.warn, ms: (s.tot.ms ?? 0) + rec.ms },
          };
        }),
      setBest: (key, value, lowerWins = false) => {
        const prev = get().best[key];
        const better = prev == null || (lowerWins ? value < prev : value > prev);
        if (better) set((s) => ({ best: { ...s.best, [key]: value } }));
        return better;
      },
      resetProgress: () => set({ stats: {}, where: {}, mix: {}, sessions: [], recent: [], best: {}, daily: {}, rivals: {}, days: {}, badges: {}, tot: {}, album: {}, backup: NO_BACKUP }),
      markBackup: (now) => set((s) => ({ backup: { at: now, from: now, q: s.tot.q ?? 0 } })),
      snoozeBackup: (now) => set((s) => ({ backup: { at: s.backup.at, from: now, q: s.tot.q ?? 0 } })),
      importData: (data, prefs, now = Date.now()) => {
        if (!data || typeof data !== 'object') return false;
        const d = data as Partial<State>;
        if (typeof d.stats !== 'object' || !Array.isArray(d.sessions)) return false;
        const hasTypeins = !!d.typeins && typeof d.typeins === 'object';
        const tot = d.tot && typeof d.tot === 'object' ? d.tot : totalsOf(d.sessions ?? []);
        // What is here now is what the file holds: the last copy is the file, made when it says.
        const exported = Date.parse(String((d as { exported?: unknown }).exported));
        set({
          ...(prefs ?? {}),
          backup: { at: Number.isFinite(exported) && exported > 0 ? exported : now, from: now, q: tot.q ?? 0 },
          stats: d.stats ?? {},
          where: d.where && typeof d.where === 'object' ? d.where : {},
          mix: cleanMix(d.mix),
          sessions: d.sessions ?? [],
          // A copy from before the maps played lately were kept says nothing about them: they stay.
          recent: Array.isArray(d.recent) ? d.recent.filter(isRecent).slice(0, RECENT_MAX) : get().recent,
          best: d.best ?? {},
          favs: Array.isArray(d.favs) ? d.favs : get().favs,
          daily: d.daily && typeof d.daily === 'object' ? d.daily : get().daily,
          // A copy from before the calendar brings what its sessions and its daily challenges add up to.
          days: d.days && typeof d.days === 'object' ? cleanDays(d.days) : daysFrom(d.sessions ?? [], d.daily && typeof d.daily === 'object' ? d.daily : {}),
          lists: Array.isArray(d.lists) ? d.lists.filter(isList) : get().lists,
          // A copy from before there were goals says nothing about them: they stay.
          goals: Array.isArray(d.goals) ? cleanGoals(d.goals) : get().goals,
          // Nor does one from before there were notes: what has been written stays.
          notes: d.notes && typeof d.notes === 'object' ? cleanNotes(d.notes) : get().notes,
          // The album of the copy, and the flags its answers have learnt: one from before the album has those.
          album: withFlags(cleanAlbum(d.album), d.stats ?? {}),
          badges: d.badges && typeof d.badges === 'object' ? d.badges : {},
          tot,
          // Backups from before the settings existed say nothing about them: they stay as they are. One
          // that has them brings both, and its "never chosen" is as the game ships.
          typeins: hasTypeins ? cleanTypeins(d.typeins) : get().typeins,
          typeinAuto: hasTypeins ? (typeof d.typeinAuto === 'boolean' ? d.typeinAuto : null) : get().typeinAuto,
        });
        return true;
      },
    }),
    {
      name: 'regionle:v1',
      version: 2,
      migrate: (saved, version) => migrateSaved(saved, version) as unknown as State,
      partialize: (s) => ({
        theme: s.theme,
        sel: s.sel,
        levels: s.levels,
        mode: s.mode,
        opts: s.opts,
        favs: s.favs,
        game: s.game,
        stats: s.stats,
        where: s.where,
        mix: s.mix,
        sessions: s.sessions,
        recent: s.recent,
        best: s.best,
        daily: s.daily,
        rivals: s.rivals,
        days: s.days,
        dayGoal: s.dayGoal,
        lang: s.lang,
        nick: s.nick,
        lists: s.lists,
        listOn: s.listOn,
        goals: s.goals,
        notes: s.notes,
        album: s.album,
        badges: s.badges,
        tot: s.tot,
        cb: s.cb,
        welcomed: s.welcomed,
        hotkeys: s.hotkeys,
        sound: s.sound,
        haptic: s.haptic,
        iconBadge: s.iconBadge,
        miles: s.miles,
        palette: s.palette,
        reviewPace: s.reviewPace,
        reviewSize: s.reviewSize,
        backup: s.backup,
        typeins: s.typeins,
        typeinAuto: s.typeinAuto,
      }),
      merge: (saved, current) => mergeSaved(saved, current),
    },
  ),
);

// The short forms in force are read wherever a deck is built: they follow the store from the first moment.
const followTypeins = (s: State) => applyTypeins({ auto: s.typeinAuto, edits: s.typeins });
followTypeins(useStore.getState());
useStore.subscribe((s, prev) => {
  if (s.typeins !== prev.typeins || s.typeinAuto !== prev.typeinAuto) followTypeins(s);
});

// And so is the unit distances are told in, by every text that tells one.
setUnits(useStore.getState().miles ? 'mi' : 'km');
useStore.subscribe((s, prev) => {
  if (s.miles !== prev.miles) setUnits(s.miles ? 'mi' : 'km');
});

// And the pace and the size of the reviews, by every count of what is due.
const followReview = (s: State) => setReviewPrefs({ pace: s.reviewPace, size: s.reviewSize });
followReview(useStore.getState());
useStore.subscribe((s, prev) => {
  if (s.reviewPace !== prev.reviewPace || s.reviewSize !== prev.reviewSize) followReview(s);
});

/**
 * The pace and the size of the reviews as one word: for a screen to count again what is due when either
 * changes (a dependency of its memos), since the counts read them from where the store keeps them.
 */
export const useReviewPrefs = (): string => useStore((s) => `${s.reviewPace}:${s.reviewSize}`);

/**
 * What was saved, laid over the game as it starts: what an older version did not keep is filled in, and
 * what cannot be trusted is cleaned.
 */
export function mergeSaved(saved: unknown, current: State): State {
  const p = (saved ?? {}) as Partial<State>;
  return {
    ...current,
    ...p,
    sel: { ...current.sel, ...p.sel },
    mode: { ...current.mode, ...p.mode },
    opts: { ...current.opts, ...p.opts },
    recent: Array.isArray(p.recent) ? p.recent.filter(isRecent).slice(0, RECENT_MAX) : [],
    mix: cleanMix(p.mix),
    // Players from before the calendar start from what their latest sessions and daily challenges add up to.
    days: p.days && typeof p.days === 'object' ? cleanDays(p.days) : daysFrom(Array.isArray(p.sessions) ? p.sessions : [], p.daily && typeof p.daily === 'object' ? p.daily : {}),
    dayGoal: isDayGoal(p.dayGoal) ? p.dayGoal : DAY_GOAL_DEFAULT,
    rivals: cleanRivals(p.rivals),
    goals: cleanGoals(p.goals),
    notes: cleanNotes(p.notes),
    // Players from before the album start with the flags they have learnt.
    album: withFlags(cleanAlbum(p.album), p.stats && typeof p.stats === 'object' ? p.stats : {}),
    hotkeys: p.hotkeys !== false,
    sound: p.sound === true,
    haptic: p.haptic === true,
    iconBadge: p.iconBadge !== false,
    miles: p.miles === true,
    palette: isPalette(p.palette) ? p.palette : PALETTE_DEFAULT,
    reviewPace: isPace(p.reviewPace) ? p.reviewPace : PACE_DEFAULT,
    reviewSize: isReviewSize(p.reviewSize) ? p.reviewSize : REVIEW_MAX,
    backup: cleanBackupMark(p.backup),
    // Players from before the tallies existed start from what their latest sessions add up to.
    tot: p.tot && Object.keys(p.tot).length ? p.tot : totalsOf(p.sessions ?? []),
    typeins: cleanTypeins(p.typeins),
    typeinAuto: typeof p.typeinAuto === 'boolean' ? p.typeinAuto : null,
  };
}

/**
 * Brings what an older version saved up to date. Version 2 made typing the usual way to answer: the
 * choice kept from before is moved once, and the player can change it back.
 */
export function migrateSaved(saved: unknown, version: number): Record<string, unknown> {
  const p = { ...((saved ?? {}) as Record<string, unknown>) };
  if (version < 2 && p.opts && typeof p.opts === 'object') p.opts = { ...(p.opts as object), answer: 'type' };
  return p;
}

/** How many answers are learnt: the figure each day writes down, for the chart of how it grows. */
export const learntIn = (stats: Record<string, Stat>): number => Object.values(stats).reduce((n, st) => n + (isLearnt(st) ? 1 : 0), 0);

/** The maps played lately once a game has ended: with it first when it is one to come back to. */
function withRecentOf(list: Recent[], game: GameConfig | null, rec: SessionRec): Recent[] {
  const r = game ? recentOf(game, rec) : null;
  return r ? withRecent(list, r) : list;
}

/** The lifetime tallies that a list of sessions adds up to. */
export function totalsOf(sessions: SessionRec[]): Totals {
  const tot: Totals = {};
  for (const r of sessions) {
    tot.g = (tot.g ?? 0) + 1;
    tot.q = (tot.q ?? 0) + (r.total || 0);
    tot.ok = (tot.ok ?? 0) + (r.ok || 0);
    tot.warn = (tot.warn ?? 0) + (r.warn || 0);
    tot.ms = (tot.ms ?? 0) + (r.ms || 0);
  }
  return tot;
}

function isList(x: unknown): x is CustomList {
  const l = x as Partial<CustomList> | null;
  return !!l && typeof l === 'object' && typeof l.id === 'string' && typeof l.name === 'string' && typeof l.section === 'string' && Array.isArray(l.countries) && Array.isArray(l.ids) && !!l.levels && typeof l.levels === 'object';
}

/** An item counts as learnt after two right answers in a row. */
export function isLearnt(stat: Stat | undefined): boolean {
  return !!stat && stat[2] >= 2;
}
