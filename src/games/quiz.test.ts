import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../lib/text';
import { initQuiz, quizReducer, scoreOf, type QuizAction, type QuizState } from './quiz';

const run = (s: QuizState, ...actions: QuizAction[]) => actions.reduce(quizReducer, s);

describe('quiz state machine', () => {
  it('asks every item once and then reviews the misses', () => {
    let s = initQuiz(['a', 'b', 'c'], 'all', false, mulberry32(1));
    expect(s.total).toBe(3);
    const first = s.cur!;
    s = run(s, { type: 'right' });
    expect(s.phase).toBe('done');
    expect(s.results[first]).toBe('ok');
    s = run(s, { type: 'next' });
    const second = s.cur!;
    s = run(s, { type: 'wrong', max: 2 });
    expect(s.phase).toBe('ask');
    s = run(s, { type: 'wrong', max: 2 });
    expect(s.results[second]).toBe('bad');
    s = run(s, { type: 'next' }, { type: 'hint' }, { type: 'right' });
    expect(s.last).toBe('warn');
    expect([s.ok, s.warn, s.bad]).toEqual([1, 1, 1]);
    s = run(s, { type: 'next' });
    expect(s.round).toBe(2);
    expect(s.cur).toBe(second);
    s = run(s, { type: 'right' });
    expect(s.marks[second]).toBe('warn');
    expect(s.results[second]).toBe('bad');
    expect(s.asked).toBe(3);
    s = run(s, { type: 'next' });
    expect(s.phase).toBe('end');
    expect(scoreOf(s.ok, s.warn, s.asked)).toBe(50);
  });

  it('waits on the map after a miss when asked to reveal', () => {
    let s = initQuiz(['a', 'b'], 'all', true, mulberry32(2));
    s = run(s, { type: 'giveup' });
    expect(s.phase).toBe('reveal');
    s = run(s, { type: 'next' });
    expect(s.phase).toBe('ask');
  });

  it('limits the number of questions', () => {
    const s = initQuiz(['a', 'b', 'c', 'd', 'e'], 2, false, mulberry32(3));
    expect(s.total).toBe(2);
    expect(s.queue).toHaveLength(1);
  });

  it('never ends in endless mode and brings misses back soon', () => {
    let s = initQuiz(['a', 'b', 'c', 'd', 'e', 'f'], 'endless', false, mulberry32(4));
    const missed = s.cur!;
    s = run(s, { type: 'giveup' });
    expect(s.queue.slice(0, 4)).toContain(missed);
    for (let i = 0; i < 40; i++) s = run(s, { type: 'next', rng: mulberry32(i) }, { type: 'right' });
    expect(s.phase).toBe('done');
    expect(s.lap).toBeGreaterThan(3);
    expect(s.asked).toBe(41);
  });
});
