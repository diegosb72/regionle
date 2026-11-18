import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../lib/text';
import { answersItself, belongsItself, capitalsNeedTyping, gradeOf, initQuiz, quizReducer, scoreOf, type QuizAction, type QuizState } from './quiz';

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

describe('an exam', () => {
  const exam = (pool: string[], length: number | 'all' | 'endless' = 'all') => initQuiz(pool, length, true, mulberry32(3), true);

  it('takes each answer without a word and asks the next one', () => {
    let s = exam(['a', 'b', 'c']);
    const first = s.cur;
    s = run(s, { type: 'wrong', max: 1 });
    // No pause to look at the answer, right or wrong: the next question is already there.
    expect(s.phase).toBe('ask');
    expect(s.cur).not.toBe(first);
    expect(s.results[first!]).toBe('bad');
    expect(s.asked).toBe(1);
    s = run(s, { type: 'right' });
    expect(s.phase).toBe('ask');
    expect(s.asked).toBe(2);
  });

  it('ends with the last answer, without asking again what was missed', () => {
    let s = exam(['a', 'b', 'c']);
    s = run(s, { type: 'wrong', max: 1 }, { type: 'giveup' }, { type: 'right' });
    expect(s.phase).toBe('end');
    expect(s.round).toBe(1);
    expect(s.again).toEqual([]);
    expect([s.ok, s.warn, s.bad]).toEqual([1, 0, 2]);
    expect(Object.keys(s.results)).toHaveLength(3);
  });

  it('never waits on the map after a miss, and has an end whatever was asked for', () => {
    const s = exam(['a', 'b', 'c', 'd'], 'endless');
    expect(s.reveal).toBe(false);
    expect(s.endless).toBe(false);
    expect(s.total).toBe(4);
    expect(exam(['a', 'b', 'c', 'd'], 2).total).toBe(2);
  });

  it('is marked out of ten, and what was not answered counts as wrong', () => {
    expect(gradeOf(15, 20)).toBe(7.5);
    expect(gradeOf(19, 19)).toBe(10);
    expect(gradeOf(1, 3)).toBe(3.3);
    expect(gradeOf(0, 10)).toBe(0);
    expect(gradeOf(0, 0)).toBe(0);
    // Handed in after four of ten, all right: a four.
    expect(gradeOf(4, 10)).toBe(4);
  });

  it('leaves the other games as they were', () => {
    let s = initQuiz(['a', 'b'], 'all', false, mulberry32(3));
    expect(s.exam).toBe(false);
    s = run(s, { type: 'wrong', max: 1 });
    expect(s.phase).toBe('done');
    expect(s.again).toHaveLength(1);
  });
});

describe('capitals that answer themselves', () => {
  const it_ = (name: string, ...capital: string[]) => ({ name, capital });

  it('are never asked, however the answer is given', () => {
    for (const x of [it_('Comunidad de Madrid', 'Madrid'), it_('Región de Murcia', 'Murcia'), it_('Ceuta', 'Ceuta'), it_('México', 'Ciudad de México', 'México'), it_('Territorio de Belfort', 'Belfort')]) {
      expect(answersItself(x, false), x.name).toBe(true);
      expect(answersItself(x, true), x.name).toBe(true);
    }
  });

  it('are not asked either when a second accepted spelling is the name of the place', () => {
    // Hlotse also goes by "Leribe", and Chbar Mon by the name of its province: typing the question back would be right.
    for (const x of [it_('Leribe', 'Hlotse', 'Leribe'), it_('Kompung Speu', 'Chbar Mon', 'Kampong Speu', 'Kompung Speu')]) {
      expect(answersItself(x, false), x.name).toBe(true);
      expect(answersItself(x, true), x.name).toBe(true);
    }
    // A spelling that only resembles the place does not count: it still has to be known.
    expect(answersItself(it_('Navarra', 'Pamplona', 'Iruña'), false)).toBe(false);
    // Nor does one that holds the name of the place among other words: "Marne" alone is not accepted.
    expect(answersItself(it_('Marne', 'Châlons-en-Champagne', 'Châlons', 'Châlons-sur-Marne'), false)).toBe(false);
  });

  it('can only be asked typed where three wrong options that have to be known cannot be found', () => {
    // Costa Rica: six provinces named after their capital, and Guanacaste.
    const cr = [it_('Alajuela', 'Alajuela'), it_('Cartago', 'Cartago'), it_('Heredia', 'Heredia'), it_('Limón', 'Limón'), it_('Puntarenas', 'Puntarenas'), it_('San José', 'San José'), it_('Guanacaste', 'Liberia')];
    expect(capitalsNeedTyping(cr)).toBe(true);
    const es = [it_('Andalucía', 'Sevilla'), it_('Aragón', 'Zaragoza'), it_('Galicia', 'Santiago de Compostela'), it_('Cataluña', 'Barcelona'), it_('Comunidad de Madrid', 'Madrid')];
    expect(capitalsNeedTyping(es)).toBe(false);
    // What has no capital in the data does not count as an option.
    expect(capitalsNeedTyping([...es.slice(0, 3), { name: 'Extremadura' }, { name: 'Asturias', capital: [] }])).toBe(true);
  });

  it('are asked when typed and left out when picked, if only a likeness gives them away', () => {
    for (const x of [it_('Comunidad Valenciana', 'Valencia', 'València'), it_('Canarias', 'Las Palmas de Gran Canaria', 'Santa Cruz de Tenerife'), it_('Brasil', 'Brasilia'), it_('Argelia', 'Argel')]) {
      expect(answersItself(x, false), x.name).toBe(false);
      expect(answersItself(x, true), x.name).toBe(true);
    }
  });

  it('are asked either way when they have to be known', () => {
    for (const x of [it_('Andalucía', 'Sevilla'), it_('Álava', 'Vitoria', 'Vitoria-Gasteiz'), it_('Galicia', 'Santiago de Compostela'), it_('Bocas del Ródano', 'Marsella'), it_('Francia', 'París')]) {
      expect(answersItself(x, false), x.name).toBe(false);
      expect(answersItself(x, true), x.name).toBe(false);
    }
    // Nothing to ask where the data has no capital.
    expect(answersItself({ name: 'Madrid' }, true)).toBe(false);
    expect(answersItself({ name: 'Madrid', capital: [] }, true)).toBe(false);
  });
});

describe('what a piece belongs to, when its own name says it', () => {
  const in_ = (name: string, group: string, ...answers: string[]) => ({ name, belongs: { name: group, answers: [group, ...answers] } });

  it('is not asked: the province of Madrid, León, the city of Mexico', () => {
    for (const x of [in_('Madrid', 'Comunidad de Madrid'), in_('Murcia', 'Región de Murcia'), in_('La Rioja', 'La Rioja'), in_('Ciudad de México', 'México', 'Mexico'), in_('Luxemburgo', 'Luxemburgo')]) {
      expect(belongsItself(x, false), x.name).toBe(true);
      expect(belongsItself(x, true), x.name).toBe(true);
    }
  });

  it('is asked typed and left out of four options where only a likeness gives it away', () => {
    for (const x of [in_('Valencia', 'Comunidad Valenciana'), in_('León', 'Castilla y León'), in_('Argel', 'Argelia')]) {
      expect(belongsItself(x, true), x.name).toBe(true);
    }
    expect(belongsItself(in_('Valencia', 'Comunidad Valenciana'), false)).toBe(false);
  });

  it('is asked where it has to be known', () => {
    for (const x of [in_('Teruel', 'Aragón'), in_('Sevilla', 'Andalucía'), in_('Lyon', 'Francia', 'France'), in_('Álava', 'País Vasco', 'Euskadi')]) {
      expect(belongsItself(x, false), x.name).toBe(false);
      expect(belongsItself(x, true), x.name).toBe(false);
    }
  });

  it('is never the case of what belongs to nothing', () => {
    expect(belongsItself({ name: 'Madrid' }, true)).toBe(false);
  });
});
