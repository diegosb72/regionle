/**
 * A game sent by link. The link carries what was played (section, mode, selection, the options that
 * change the questions) and the seed that puts them in order, so that whoever opens it gets exactly the
 * same questions; it can also carry the sender's result, to compare at the end.
 */
import type { CityPick } from './extra';
import type { GameConfig, Length, Opts } from './store';
import type { Mode, Section } from './types';

export interface Challenge {
  section: Section;
  mode: Mode;
  countries: string[];
  levels: Record<string, string>;
  opts: Partial<Opts>;
  seed: number;
  /** Sender's name, score (0–100) and time. */
  from?: string;
  score?: number;
  ms?: number;
  /** Made by a version that still asked for capitals named after their place. */
  legacy?: boolean;
}

/** Version of the rules that decide what is asked. Links without it come from before version 2. */
const RULES = 2;

const SECTIONS: Section[] = ['regions', 'countries', 'cities', 'physical'];
/** Games that ask one thing after another and end with a score: the ones that can be compared. */
export const CHALLENGE_MODES: Mode[] = ['pin', 'identify', 'outline', 'puzzle', 'capital', 'flag'];

interface Wire {
  s: string;
  m: string;
  /** The selection in one string, to keep the link short: country codes run together, physical tokens joined by dots. */
  c: string;
  l?: Record<string, string>;
  o?: [string, string | number, string, string, number];
  k: number;
  f?: string;
  r?: [number, number];
  v?: number;
}

export const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const fromBase64Url = (code: string): string => {
  const pad = code.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '==='.slice((pad.length + 3) % 4));
  return new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)));
};

/** Seed of a game: the one it was sent with, or one of its own. */
export function seedOf(cfg: GameConfig): number {
  return cfg.challenge?.seed ?? Math.abs(Math.floor(cfg.nonce)) % 2_147_483_647;
}

export function canChallenge(cfg: GameConfig): boolean {
  return SECTIONS.includes(cfg.section) && CHALLENGE_MODES.includes(cfg.mode) && !cfg.only && !cfg.daily && cfg.opts.length !== 'endless';
}

export function encodeChallenge(cfg: GameConfig, result?: { score: number; ms: number }, from?: string): string {
  const { opts } = cfg;
  const wire: Wire = {
    s: cfg.section,
    m: cfg.mode,
    c: cfg.section === 'physical' || cfg.countries.some((id) => id.length !== 2) ? cfg.countries.join('.') : cfg.countries.join(''),
    k: seedOf(cfg),
    o: [opts.answer, opts.length, opts.pinBy, opts.cityPick, opts.cityCount],
  };
  const levels = Object.fromEntries(Object.entries(cfg.levels).filter(([id]) => cfg.countries.includes(id)));
  if (Object.keys(levels).length) wire.l = levels;
  // A challenge that is passed on keeps the rules it was made with.
  if (!cfg.challenge?.legacy) wire.v = RULES;
  const name = from?.trim().slice(0, 24);
  if (name) wire.f = name;
  if (result) wire.r = [Math.round(result.score), Math.round(result.ms)];
  return toBase64Url(JSON.stringify(wire));
}

const isStr = (x: unknown): x is string => typeof x === 'string';

export function decodeChallenge(code: string): Challenge | null {
  let wire: Wire;
  try {
    wire = JSON.parse(fromBase64Url(code)) as Wire;
  } catch {
    return null;
  }
  if (!wire || typeof wire !== 'object') return null;
  if (!SECTIONS.includes(wire.s as Section) || !CHALLENGE_MODES.includes(wire.m as Mode)) return null;
  if (!isStr(wire.c) || !wire.c || wire.c.length > 1200) return null;
  const countries = wire.c.includes('.') || wire.s === 'physical' ? wire.c.split('.') : (wire.c.match(/.{1,2}/g) ?? []);
  if (!countries.length || countries.length > 300 || !countries.every((id) => /^[A-Za-z0-9]{1,8}$/.test(id))) return null;
  if (!Number.isFinite(wire.k)) return null;
  const opts: Partial<Opts> = {};
  if (Array.isArray(wire.o)) {
    const [answer, length, pinBy, cityPick, cityCount] = wire.o;
    if (answer === 'choice' || answer === 'type') opts.answer = answer;
    if (length === 'all' || length === 10 || length === 20 || length === 50) opts.length = length as Length;
    if (pinBy === 'name' || pinBy === 'capital' || pinBy === 'flag') opts.pinBy = pinBy;
    if (cityPick === 'top' || cityPick === 'caps' || cityPick === 'regcaps') opts.cityPick = cityPick as CityPick;
    if (typeof cityCount === 'number' && cityCount > 0 && cityCount <= 200) opts.cityCount = cityCount;
  }
  const levels: Record<string, string> = {};
  if (wire.l && typeof wire.l === 'object') for (const [id, lv] of Object.entries(wire.l)) if (isStr(lv) && /^[a-z0-9]{1,3}$/.test(lv)) levels[id] = lv;
  const out: Challenge = { section: wire.s as Section, mode: wire.m as Mode, countries, levels, opts, seed: Math.floor(wire.k) };
  if (!(typeof wire.v === 'number' && wire.v >= RULES)) out.legacy = true;
  if (isStr(wire.f) && wire.f.trim()) out.from = wire.f.trim().slice(0, 24);
  if (Array.isArray(wire.r) && Number.isFinite(wire.r[0]) && Number.isFinite(wire.r[1])) {
    out.score = Math.max(0, Math.min(100, Math.round(wire.r[0])));
    out.ms = Math.max(0, Math.round(wire.r[1]));
  }
  return out;
}

/** Address of a challenge, under whatever folder the site is served from. */
export function challengeUrl(code: string): string {
  const base = typeof location === 'undefined' ? '' : location.href.split('#')[0];
  return `${base}#/duelo/${code}`;
}
