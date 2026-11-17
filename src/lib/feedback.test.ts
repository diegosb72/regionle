import { afterEach, describe, expect, it, vi } from 'vitest';
import { PULSES, TONES, feedbackFor, lengthOf, signal } from './feedback';

describe('what an answer sounds and feels like', () => {
  it('is nothing unless it has been asked for', () => {
    expect(feedbackFor('ok', { sound: false, haptic: false })).toEqual({ notes: [], pulse: [] });
    expect(feedbackFor('bad', { sound: true, haptic: false })).toEqual({ notes: TONES.bad, pulse: [] });
    expect(feedbackFor('bad', { sound: false, haptic: true })).toEqual({ notes: [], pulse: PULSES.bad });
  });

  it('goes up for a right answer and down for a miss, and is one note in between', () => {
    expect(TONES.ok).toHaveLength(2);
    expect(TONES.ok[1].f).toBeGreaterThan(TONES.ok[0].f);
    expect(TONES.warn).toHaveLength(1);
    expect(TONES.bad).toHaveLength(2);
    expect(TONES.bad[1].f).toBeLessThan(TONES.bad[0].f);
    // A miss is lower than anything a right answer plays.
    expect(Math.max(...TONES.bad.map((n) => n.f))).toBeLessThan(Math.min(...TONES.ok.map((n) => n.f), ...TONES.warn.map((n) => n.f)));
  });

  it('is one low note for a wrong try that leaves the question open: the first of the two of a miss', () => {
    expect(TONES.try).toHaveLength(1);
    expect(TONES.try[0].f).toBe(TONES.bad[0].f);
    expect(PULSES.try).toHaveLength(1);
  });

  it('is over well before the next question of a game against the clock', () => {
    for (const res of ['ok', 'warn', 'bad', 'try'] as const) expect(lengthOf(TONES[res])).toBeLessThan(0.42);
    expect(lengthOf([])).toBe(0);
  });

  it('buzzes longer for a miss than for a right answer, and never for long', () => {
    const total = (p: readonly number[]) => p.reduce((a, b) => a + b, 0);
    expect(total(PULSES.ok)).toBeLessThan(total(PULSES.warn));
    expect(total(PULSES.warn)).toBeLessThan(total(PULSES.bad));
    expect(total(PULSES.bad)).toBeLessThanOrEqual(200);
    // On, off, on: an odd number of steps, so that it ends on a buzz and not on a wait.
    for (const res of ['ok', 'warn', 'bad', 'try'] as const) expect(PULSES[res].length % 2).toBe(1);
    expect(total(PULSES.try)).toBeLessThan(total(PULSES.bad));
  });
});

describe('signalling an answer', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('does nothing with both preferences off', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    expect(signal('bad', { sound: false, haptic: false }, 1_000_000)).toBe(false);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('buzzes with the pattern of the answer, and once for two calls in the same instant', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    expect(signal('bad', { sound: false, haptic: true }, 2_000_000)).toBe(true);
    expect(vibrate).toHaveBeenCalledWith([...PULSES.bad]);
    expect(signal('bad', { sound: false, haptic: true }, 2_000_020)).toBe(false);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(signal('ok', { sound: false, haptic: true }, 2_000_500)).toBe(true);
    expect(vibrate).toHaveBeenLastCalledWith([...PULSES.ok]);
  });

  it('plays nothing and breaks nothing where there is no sound to make', () => {
    vi.stubGlobal('navigator', {});
    expect(signal('ok', { sound: true, haptic: true }, 3_000_000)).toBe(true);
  });
});
