/** Persistent app state: selections, options, favourites and learning progress (localStorage). */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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

/** What is being learnt about an item: where it is, its name, its capital, its flag. */
export type Skill = 'loc' | 'name' | 'cap' | 'flag';
/** [times seen, times right first time, current run of right answers, last time seen] */
export type Stat = [number, number, number, number];

const EUROPE =
  'AD AL AT BA BE BG BY CH CY CZ DE DK EE ES FI FR GB GR HR HU IE IS IT LI LT LU LV MC MD ME MK MT NL NO PL PT RO RS RU SE SI SK SM UA'.split(' ');
const G20 = 'AR AU BR CA CN DE ES FR GB ID IN IT JP KR MX RU SA TR US ZA'.split(' ');

export const DEFAULT_OPTS: Opts = { answer: 'choice', length: 'all', suggest: false, pinBy: 'name', metric: 'pop', blind: false, labels: true };

interface State {
  theme: Theme;
  sel: Record<Section, string[]>;
  levels: Record<string, string>;
  mode: Record<Section, Mode>;
  opts: Opts;
  favs: Fav[];
  game: GameConfig | null;
  stats: Record<string, Stat>;
  sessions: SessionRec[];
  best: Record<string, number>;

  setTheme(theme: Theme): void;
  setSel(section: Section, ids: string[]): void;
  setLevel(country: string, level: string): void;
  setMode(section: Section, mode: Mode): void;
  setOpts(patch: Partial<Opts>): void;
  addFav(fav: Fav): void;
  removeFav(section: Section, name: string): void;
  start(cfg: Omit<GameConfig, 'nonce'>): void;
  /** Forgets the game in course. */
  leave(): void;
  record(skill: Skill, id: string, res: Res): void;
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
      sel: { regions: ['ES'], countries: EUROPE, pops: G20 },
      levels: {},
      mode: { regions: 'pin', countries: 'pin', pops: 'hilo' },
      opts: DEFAULT_OPTS,
      favs: [],
      game: null,
      stats: {},
      sessions: [],
      best: {},

      setTheme: (theme) => set({ theme }),
      setSel: (section, ids) => set((s) => ({ sel: { ...s.sel, [section]: [...new Set(ids)] } })),
      setLevel: (country, level) => set((s) => ({ levels: { ...s.levels, [country]: level } })),
      setMode: (section, mode) => set((s) => ({ mode: { ...s.mode, [section]: mode } })),
      setOpts: (patch) => set((s) => ({ opts: { ...s.opts, ...patch } })),
      addFav: (fav) => set((s) => ({ favs: [...s.favs.filter((f) => !(f.section === fav.section && f.name === fav.name)), fav] })),
      removeFav: (section, name) => set((s) => ({ favs: s.favs.filter((f) => !(f.section === section && f.name === name)) })),
      start: (cfg) => set((s) => ({ game: { ...cfg, nonce: Math.max(Date.now(), (s.game?.nonce ?? 0) + 1) } })),
      leave: () => set({ game: null }),
      record: (skill, id, res) =>
        set((s) => {
          const k = `${skill}:${id}`;
          const [seen, ok, run] = s.stats[k] ?? [0, 0, 0, 0];
          return { stats: { ...s.stats, [k]: [seen + 1, ok + (res === 'ok' ? 1 : 0), res === 'ok' ? run + 1 : 0, Date.now()] } };
        }),
      addSession: (rec) => set((s) => ({ sessions: [rec, ...s.sessions].slice(0, 80) })),
      setBest: (key, value, lowerWins = false) => {
        const prev = get().best[key];
        const better = prev == null || (lowerWins ? value < prev : value > prev);
        if (better) set((s) => ({ best: { ...s.best, [key]: value } }));
        return better;
      },
      resetProgress: () => set({ stats: {}, sessions: [], best: {} }),
      importData: (data) => {
        if (!data || typeof data !== 'object') return false;
        const d = data as Partial<State>;
        if (typeof d.stats !== 'object' || !Array.isArray(d.sessions)) return false;
        set({ stats: d.stats ?? {}, sessions: d.sessions ?? [], best: d.best ?? {}, favs: Array.isArray(d.favs) ? d.favs : get().favs });
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
        sessions: s.sessions,
        best: s.best,
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
