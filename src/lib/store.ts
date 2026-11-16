/** Persistent app state: selections, options, favourites and learning progress (localStorage). */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { TESTS, emptyRec, streakOf, type DailyRec } from '../daily/spec';
import type { CityPick } from './extra';
import type { Lang } from './i18n';
import { today } from './text';
import type { Mode, Res, Section } from './types';

export type Length = 'all' | 10 | 20 | 50 | 'endless';
export type Theme = 'auto' | 'light' | 'dark';
/** How a question-by-question game is paced: a set of questions, against the clock, or until the lives run out. */
export type Format = 'normal' | 'timed' | 'lives';

export interface Opts {
  /** How names are answered: four options or typing. */
  answer: 'choice' | 'type';
  length: Length;
  /** Autocomplete while typing. */
  suggest: boolean;
  /** What "pin it" shows for countries. */
  pinBy: 'name' | 'capital' | 'flag';
  metric: 'pop' | 'area';
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
}

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

export const DEFAULT_OPTS: Opts = { answer: 'type', length: 'all', suggest: false, pinBy: 'name', metric: 'pop', blind: false, labels: true, cityPick: 'top', cityCount: 25, wiki: true, format: 'normal' };

/** `stats` and `where` without anything about the given ids ("loc:x", "name:x"… and the map x was learnt on). */
export function dropAnswers(stats: Record<string, Stat>, where: Record<string, string>, ids: readonly string[]): { stats: Record<string, Stat>; where: Record<string, string> } {
  const gone = new Set(ids);
  // A key is "skill:id", and an id can hold a colon itself ("r:volga"): the skill is what comes before the first.
  const keep = <T,>(o: Record<string, T>, idOf: (k: string) => string) => Object.fromEntries(Object.entries(o).filter(([k]) => !gone.has(idOf(k))));
  return { stats: keep(stats, (k) => k.slice(k.indexOf(':') + 1)), where: keep(where, (k) => k) };
}

/** Lifetime tallies; the list of sessions only keeps the latest ones. */
export type Totals = Record<string, number>;

interface State {
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
  sessions: SessionRec[];
  best: Record<string, number>;
  /** Results of the daily challenge by day. */
  daily: Record<string, DailyRec>;
  /** Interface language; null until chosen: the browser's language decides. */
  lang: Lang | null;
  /** Name put on the challenges sent to others. */
  nick: string;
  /** Custom lists, and the one in use in each section. */
  lists: CustomList[];
  listOn: Partial<Record<Section, string>>;
  /** Achievements earned: id → when. */
  badges: Record<string, number>;
  /** g games · q answers · ok first-time right · warn right with help · ms time · and one-off counters (lessons, regionle1, near…). */
  tot: Totals;
  /** Colours that can be told apart with colour blindness. */
  cb: boolean;

  setCb(cb: boolean): void;
  saveList(list: CustomList): void;
  removeList(id: string): void;
  setListOn(section: Section, id: string | null): void;
  /** Marks achievements as earned now. */
  earn(ids: string[]): void;
  /** Adds to lifetime tallies. */
  bump(patch: Totals): void;
  setTheme(theme: Theme): void;
  setLang(lang: Lang): void;
  setNick(nick: string): void;
  /** Stores the points of one test of a day; closes the day when it was the last one. */
  setDaily(date: string, test: number, points: number, figure: number): void;
  setSel(section: Section, ids: string[]): void;
  setLevel(country: string, level: string): void;
  setMode(section: Section, mode: Mode): void;
  setOpts(patch: Partial<Opts>): void;
  addFav(fav: Fav): void;
  removeFav(section: Section, name: string): void;
  start(cfg: Omit<GameConfig, 'nonce'>): void;
  /** Forgets the game in course. */
  leave(): void;
  record(skill: Skill, id: string, res: Res, origin?: string): void;
  /** Drops what is known about some answers: questions that are no longer asked must not stay due. */
  forget(skill: Skill, ids: string[]): void;
  /** Drops everything known about things that are no longer in the data, whatever the skill. */
  drop(ids: string[]): void;
  addSession(rec: SessionRec): void;
  /** Stores a record; returns true when it beats the previous one. */
  setBest(key: string, value: number, lowerWins?: boolean): boolean;
  resetProgress(): void;
  importData(data: unknown): boolean;
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
      sessions: [],
      best: {},
      daily: {},
      lang: null,
      nick: '',
      lists: [],
      listOn: {},
      badges: {},
      tot: {},
      cb: false,

      setCb: (cb) => set({ cb }),
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
      setNick: (nick) => set({ nick: nick.slice(0, 24) }),
      setDaily: (date, test, points, figure) =>
        set((s) => {
          const prev = s.daily[date] ?? emptyRec();
          if (test < 0 || test >= TESTS || prev.p[test] != null) return {};
          const rec: DailyRec = { ...prev, p: prev.p.slice(), k: prev.k.slice() };
          rec.p[test] = points;
          rec.k[test] = figure;
          if (rec.p.every((x) => x != null) && !rec.t) {
            rec.t = Date.now();
            if (date !== today()) rec.late = 1;
          }
          const daily = { ...s.daily, [date]: rec };
          const streak = streakOf(daily, today());
          return { daily, best: streak > (s.best['daily:streak'] ?? 0) ? { ...s.best, 'daily:streak': streak } : s.best };
        }),
      setSel: (section, ids) => set((s) => ({ sel: { ...s.sel, [section]: [...new Set(ids)] } })),
      setLevel: (country, level) => set((s) => ({ levels: { ...s.levels, [country]: level } })),
      setMode: (section, mode) => set((s) => ({ mode: { ...s.mode, [section]: mode } })),
      setOpts: (patch) => set((s) => ({ opts: { ...s.opts, ...patch } })),
      addFav: (fav) => set((s) => ({ favs: [...s.favs.filter((f) => !(f.section === fav.section && f.name === fav.name)), fav] })),
      removeFav: (section, name) => set((s) => ({ favs: s.favs.filter((f) => !(f.section === section && f.name === name)) })),
      start: (cfg) => set((s) => ({ game: { ...cfg, nonce: Math.max(Date.now(), (s.game?.nonce ?? 0) + 1) } })),
      leave: () => set({ game: null }),
      record: (skill, id, res, origin) =>
        set((s) => {
          const k = `${skill}:${id}`;
          const [seen, ok, run] = s.stats[k] ?? [0, 0, 0, 0];
          const stats: Record<string, Stat> = { ...s.stats, [k]: [seen + 1, ok + (res === 'ok' ? 1 : 0), res === 'ok' ? run + 1 : 0, Date.now()] };
          return origin && s.where[id] !== origin ? { stats, where: { ...s.where, [id]: origin } } : { stats };
        }),
      forget: (skill, ids) =>
        set((s) => {
          const stats = { ...s.stats };
          for (const id of ids) delete stats[`${skill}:${id}`];
          return { stats };
        }),
      drop: (ids) => set((s) => dropAnswers(s.stats, s.where, ids)),
      addSession: (rec) =>
        set((s) => ({
          sessions: [rec, ...s.sessions].slice(0, 80),
          tot: { ...s.tot, g: (s.tot.g ?? 0) + 1, q: (s.tot.q ?? 0) + rec.total, ok: (s.tot.ok ?? 0) + rec.ok, warn: (s.tot.warn ?? 0) + rec.warn, ms: (s.tot.ms ?? 0) + rec.ms },
        })),
      setBest: (key, value, lowerWins = false) => {
        const prev = get().best[key];
        const better = prev == null || (lowerWins ? value < prev : value > prev);
        if (better) set((s) => ({ best: { ...s.best, [key]: value } }));
        return better;
      },
      resetProgress: () => set({ stats: {}, where: {}, sessions: [], best: {}, daily: {}, badges: {}, tot: {} }),
      importData: (data) => {
        if (!data || typeof data !== 'object') return false;
        const d = data as Partial<State>;
        if (typeof d.stats !== 'object' || !Array.isArray(d.sessions)) return false;
        set({
          stats: d.stats ?? {},
          where: d.where && typeof d.where === 'object' ? d.where : {},
          sessions: d.sessions ?? [],
          best: d.best ?? {},
          favs: Array.isArray(d.favs) ? d.favs : get().favs,
          daily: d.daily && typeof d.daily === 'object' ? d.daily : get().daily,
          lists: Array.isArray(d.lists) ? d.lists.filter(isList) : get().lists,
          badges: d.badges && typeof d.badges === 'object' ? d.badges : {},
          tot: d.tot && typeof d.tot === 'object' ? d.tot : totalsOf(d.sessions ?? []),
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
        sessions: s.sessions,
        best: s.best,
        daily: s.daily,
        lang: s.lang,
        nick: s.nick,
        lists: s.lists,
        listOn: s.listOn,
        badges: s.badges,
        tot: s.tot,
        cb: s.cb,
      }),
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          sel: { ...current.sel, ...p.sel },
          mode: { ...current.mode, ...p.mode },
          opts: { ...current.opts, ...p.opts },
          // Players from before the tallies existed start from what their latest sessions add up to.
          tot: p.tot && Object.keys(p.tot).length ? p.tot : totalsOf(p.sessions ?? []),
        };
      },
    },
  ),
);

/**
 * Brings what an older version saved up to date. Version 2 made typing the usual way to answer: the
 * choice kept from before is moved once, and the player can change it back.
 */
export function migrateSaved(saved: unknown, version: number): Record<string, unknown> {
  const p = { ...((saved ?? {}) as Record<string, unknown>) };
  if (version < 2 && p.opts && typeof p.opts === 'object') p.opts = { ...(p.opts as object), answer: 'type' };
  return p;
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
