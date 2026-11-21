import fs from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { answersItself } from '../games/quiz';
import { countryItem } from './data';
import { setLang } from './i18n';
import { DEFAULT_OPTS } from './store';
import type { Index } from './types';
import { WEEK_LENGTH, WEEK_THEMES, daysLeft, themeOf, weekCountries, weekEnd, weekGame, weekNumber, weekOf, weekQuestions, weekSeed, weekTotals } from './weekly';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;
/** The Monday `k` weeks after that of 16 November 2026. */
const monday = (k: number): string => new Date(Date.UTC(2026, 10, 16) + k * 7 * 86_400_000).toISOString().slice(0, 10);

afterEach(() => setLang('es'));

describe('the week a day is in', () => {
  it('is named by its Monday, from that Monday to its Sunday', () => {
    for (const day of ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']) expect(weekOf(day), day).toBe('2026-11-16');
    expect(weekOf('2026-11-15')).toBe('2026-11-09');
    expect(weekOf('2026-11-23')).toBe('2026-11-23');
    expect(weekEnd('2026-11-16')).toBe('2026-11-22');
  });

  it('goes across the end of a month and of a year', () => {
    expect(weekOf('2026-12-03')).toBe('2026-11-30');
    expect(weekEnd('2026-11-30')).toBe('2026-12-06');
    expect(weekOf('2027-01-01')).toBe('2026-12-28');
    expect(weekOf('2026-01-01')).toBe('2025-12-29');
    // A leap day.
    expect(weekOf('2028-02-29')).toBe('2028-02-28');
    expect(weekOf('2028-03-01')).toBe('2028-02-28');
  });

  it('says how many of its days are left, the day itself among them', () => {
    expect(['2026-11-16', '2026-11-18', '2026-11-20', '2026-11-22'].map(daysLeft)).toEqual([7, 5, 3, 1]);
  });

  it('counts the weeks from the one of the first day of 2026', () => {
    expect(weekNumber('2025-12-29')).toBe(0);
    expect(weekNumber('2026-01-05')).toBe(1);
    expect(weekNumber('2026-11-16')).toBe(46);
    expect(weekNumber('2025-12-22')).toBe(-1);
  });
});

describe('what a week asks', () => {
  it('comes round in turn: every theme once before the first one is back, also for the weeks before the first', () => {
    const lap = WEEK_THEMES.map((_, k) => themeOf(monday(k)));
    expect(new Set(lap).size).toBe(WEEK_THEMES.length);
    expect(themeOf(monday(WEEK_THEMES.length))).toBe(lap[0]);
    expect(themeOf('2025-12-29')).toBe(WEEK_THEMES[0]);
    expect(themeOf('2025-12-22')).toBe(WEEK_THEMES[WEEK_THEMES.length - 1]);
  });

  it('is never like the week before: neither the way of asking nor the place is the same twice running', () => {
    WEEK_THEMES.forEach((theme, i) => {
      const next = WEEK_THEMES[(i + 1) % WEEK_THEMES.length];
      expect(next.mode === theme.mode, `${i}`).toBe(false);
      expect(next.part === theme.part, `${i}`).toBe(false);
    });
  });

  it('is asked of the sovereign countries of the world or of a continent, with enough of them for a long game', () => {
    expect(weekCountries({ mode: 'flag', part: null }, index)).toHaveLength(198);
    expect(weekCountries({ mode: 'mix', part: 'EU' }, index)).toHaveLength(46);
    for (const theme of WEEK_THEMES) {
      const ids = weekCountries(theme, index);
      expect(ids.length, `${theme.mode} ${theme.part}`).toBeGreaterThanOrEqual(35);
      expect(ids).toEqual([...ids].sort());
      expect(new Set(ids).size).toBe(ids.length);
      if (theme.part) expect(ids.every((id) => index.countries.find((c) => c.id === id)!.ct === theme.part)).toBe(true);
    }
  });

  it('leaves out of the capitals the ones in the name of their country, so that the game drops none: in both languages the same are asked', () => {
    const ids = weekCountries({ mode: 'capital', part: null }, index);
    expect(ids).not.toContain('LU');
    expect(ids).not.toContain('MX');
    // Brasilia gives Brasil away in Spanish; in English it would pass. Out for everyone.
    expect(ids).not.toContain('BR');
    expect(ids).toContain('FR');
    expect(ids.length).toBeGreaterThanOrEqual(150);
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      // What the game leaves out among four options (QuizGame: `answersItself(it, true)`).
      const dropped = ids.filter((id) => {
        const item = countryItem(index.countries.find((c) => c.id === id)!);
        return !item.capital?.length || answersItself(item, true);
      });
      expect(dropped, lang).toEqual([]);
    }
  });

  it('says how many questions it has: fifty, or every country of its theme where they are fewer', () => {
    for (let k = 0; k < WEEK_THEMES.length; k++) {
      const week = monday(k);
      expect(weekQuestions(week, index), week).toBe(Math.min(WEEK_LENGTH, weekCountries(themeOf(week), index).length));
    }
    expect(weekQuestions('2025-12-29', index)).toBe(50);
    // Europe, the week after: all its countries, which are fewer than fifty.
    expect(themeOf('2026-01-05')).toEqual({ mode: 'mix', part: 'EU' });
    expect(weekQuestions('2026-01-05', index)).toBe(46);
  });

  it('puts its questions in order with a seed of its own, the same for everyone', () => {
    const seeds = Array.from({ length: 60 }, (_, k) => weekSeed(monday(k)));
    expect(new Set(seeds).size).toBe(60);
    expect(weekSeed('2026-11-16')).toBe(weekSeed('2026-11-16'));
    for (const seed of seeds) {
      expect(Number.isInteger(seed)).toBe(true);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(2_147_483_647);
    }
  });

  it('is a game with what changes the questions settled, whatever the player has set, and the rest as they like it', () => {
    const mine = { ...DEFAULT_OPTS, answer: 'type' as const, length: 10 as const, pinBy: 'flag' as const, turned: true, flagLook: 'grey' as const, format: 'lives' as const, labels: false, wiki: true };
    const game = weekGame('2025-12-29', index, mine);
    expect(game).toMatchObject({ section: 'countries', mode: 'flag', levels: {}, weekly: '2025-12-29', challenge: { seed: weekSeed('2025-12-29') } });
    expect(game.countries).toHaveLength(198);
    expect(game.opts).toMatchObject({ answer: 'choice', length: WEEK_LENGTH, pinBy: 'name', turned: false, flagLook: 'plain', format: 'normal' });
    expect(game.opts).toMatchObject({ labels: false, wiki: true });
    // Two players with different tastes get the same game.
    const other = weekGame('2025-12-29', index, DEFAULT_OPTS);
    expect([other.mode, other.countries, other.challenge]).toEqual([game.mode, game.countries, game.challenge]);
    // It is the challenge of a week, and of no zone.
    expect(game.zone).toBeUndefined();
  });

  it('adds up how many weeks were played and the best of them', () => {
    const rec = (s: number) => ({ s, ok: 40, n: 50, ms: 1000, t: 1 });
    expect(weekTotals({})).toEqual({ played: 0, best: 0 });
    expect(weekTotals({ '2026-11-16': rec(86), '2026-11-09': rec(92), '2026-11-02': rec(40) })).toEqual({ played: 3, best: 92 });
  });
});
