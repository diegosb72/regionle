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
  /** A game received by link: the questions are fixed and the sender's result is shown at the end. */
  challenge?: { seed: number; from?: string; score?: number; ms?: number };
  /** Changes on every start so that an identical configuration still restarts the game. */
  nonce: number;
}

export interface Fav {
  name: string;
  section: Section;
  ids: string[];
  levels?: Record<string, string>;
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

export const DEFAULT_OPTS: Opts = { answer: 'choice', length: 'all', suggest: false, pinBy: 'name', metric: 'pop', blind: false, labels: true, cityPick: 'top', cityCount: 25, wiki: true };

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
      addSession: (rec) => set((s) => ({ sessions: [rec, ...s.sessions].slice(0, 80) })),
      setBest: (key, value, lowerWins = false) => {
        const prev = get().best[key];
        const better = prev == null || (lowerWins ? value < prev : value > prev);
        if (better) set((s) => ({ best: { ...s.best, [key]: value } }));
        return better;
      },
      resetProgress: () => set({ stats: {}, where: {}, sessions: [], best: {}, daily: {} }),
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
        });
        return true;
      },
    }),
    {
      name: 'regionle:v1',
      version: 1,
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
      }),
      merge: (saved, current) => {
        const p = (saved ?? {}) as Partial<State>;
        return {
          ...current,
          ...p,
          sel: { ...current.sel, ...p.sel },
          mode: { ...current.mode, ...p.mode },
          opts: { ...current.opts, ...p.opts },
        };
      },
    },
  ),
);

/** An item counts as learnt after two right answers in a row. */
export function isLearnt(stat: Stat | undefined): boolean {
  return !!stat && stat[2] >= 2;
}
