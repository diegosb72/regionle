import { describe, expect, it } from 'vitest';
import { clockPaused, pauseClock } from './pause';

describe('the clock of a game', () => {
  it('stays stopped while anyone holds it, and each hold is let go once', () => {
    expect(clockPaused()).toBe(false);
    const first = pauseClock();
    const second = pauseClock();
    expect(clockPaused()).toBe(true);
    first();
    expect(clockPaused()).toBe(true);
    // Letting go twice does not take the hold of somebody else.
    first();
    expect(clockPaused()).toBe(true);
    second();
    expect(clockPaused()).toBe(false);
    second();
    expect(clockPaused()).toBe(false);
  });
});
