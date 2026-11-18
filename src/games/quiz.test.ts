import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../lib/text';
import { silhouette } from '../lib/geo';
import type { AnyGeo, Item } from '../lib/types';
import {
  FLAG_BLUR,
  TURN_MIN,
  answersItself,
  askOf,
  asksFor,
  belongsItself,
  capitalsNeedTyping,
  cardAskOf,
  cardable,
  gradeOf,
  initQuiz,
  quizReducer,
  scoreOf,
  turnOf,
  type Ask,
  type QuizAction,
  type QuizState,
} from './quiz';

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

  it('lets a miss say that it has nowhere on the map to be shown', () => {
    // A medley waits on the map after the questions answered on it, and not after the others.
    let s = initQuiz(['a', 'b', 'c', 'd'], 'all', true, mulberry32(2));
    s = run(s, { type: 'giveup', reveal: false });
    expect(s.phase).toBe('done');
    s = run(s, { type: 'next' }, { type: 'wrong', max: 1, reveal: true });
    expect(s.phase).toBe('reveal');
    s = run(s, { type: 'next' }, { type: 'wrong', max: 1, reveal: false });
    expect(s.phase).toBe('done');
    s = run(s, { type: 'next' }, { type: 'wrong', max: 1 });
    expect(s.phase).toBe('reveal');
    // Where the game never waits, a miss cannot ask for it.
    let quiet = initQuiz(['a', 'b'], 'all', false, mulberry32(2));
    quiet = run(quiet, { type: 'giveup', reveal: true });
    expect(quiet.phase).toBe('done');
    // A card is its own verdict: "nearly" is a right answer with help, and the next card comes at once.
    let cards = initQuiz(['a', 'b', 'c'], 'all', false, mulberry32(5));
    const first = cards.cur!;
    cards = run(cards, { type: 'hint' }, { type: 'right' }, { type: 'next' });
    expect(cards.results[first]).toBe('warn');
    expect(cards.phase).toBe('ask');
    const second = cards.cur!;
    cards = run(cards, { type: 'giveup', reveal: false }, { type: 'next' }, { type: 'right' }, { type: 'next' });
    expect([cards.ok, cards.warn, cards.bad]).toEqual([1, 1, 1]);
    // …and what was not known comes back at the end.
    expect(cards.round).toBe(2);
    expect(cards.cur).toBe(second);
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

type Piece = Pick<Item, 'shape' | 'capital' | 'name' | 'country'>;
const piece = (p: Partial<Piece> & { fl?: string } = {}): Piece => ({ shape: 'area', name: 'Burgos', ...p, country: { fl: p.fl } as Item['country'] });

describe('the medley', () => {
  const fair = { capitals: true, loose: false };

  it('asks of each piece what can be asked of it on its map', () => {
    // A province: pointed at, named, placed, known by its shape; and its capital, when it has to be known.
    expect(asksFor(piece({ name: 'Vizcaya', capital: ['Bilbao'], fl: 'es' }), 'regions', fair)).toEqual(['pin', 'identify', 'puzzle', 'outline', 'capital']);
    expect(asksFor(piece({ name: 'Burgos', capital: ['Burgos'], fl: 'es' }), 'regions', fair)).toEqual(['pin', 'identify', 'puzzle', 'outline']);
    expect(asksFor(piece({ name: 'Ceuta' }), 'regions', fair)).toEqual(['pin', 'identify', 'puzzle', 'outline']);
    // A country has a flag as well; one drawn as a dot has no shape to speak of.
    expect(asksFor(piece({ name: 'Francia', capital: ['París'], fl: 'fr' }), 'countries', fair)).toEqual(['pin', 'identify', 'puzzle', 'outline', 'capital', 'flag']);
    expect(asksFor(piece({ name: 'Mónaco', capital: ['Mónaco'], fl: 'mc', shape: 'point' }), 'countries', fair)).toEqual(['pin', 'identify', 'flag']);
    // A city and a river are pointed at and named, and that is all.
    expect(asksFor(piece({ name: 'Sevilla', shape: 'point', fl: 'es' }), 'cities', fair)).toEqual(['pin', 'identify']);
    expect(asksFor(piece({ name: 'Ebro', shape: 'line', fl: 'es' }), 'physical', fair)).toEqual(['pin', 'identify']);
    expect(asksFor(piece({ name: 'Meseta Central', shape: 'area' }), 'physical', fair)).toEqual(['pin', 'identify']);
  });

  it('leaves the capitals out where four options would not be fair, and the ones a likeness gives away', () => {
    const bilbao = piece({ name: 'Vizcaya', capital: ['Bilbao'] });
    expect(asksFor(bilbao, 'regions', { capitals: false, loose: false })).not.toContain('capital');
    // Brasilia among four options is read off "Brasil"; typed, it still has to be known.
    const brazil = piece({ name: 'Brasil', capital: ['Brasilia'], fl: 'br' });
    expect(asksFor(brazil, 'countries', { capitals: true, loose: true })).not.toContain('capital');
    expect(asksFor(brazil, 'countries', { capitals: true, loose: false })).toContain('capital');
    // "Ciudad de México" answers itself either way.
    const mexico = piece({ name: 'México', capital: ['Ciudad de México'], fl: 'mx' });
    expect(asksFor(mexico, 'countries', { capitals: true, loose: false })).not.toContain('capital');
  });

  it('draws the way of each piece by lot, the same for the same game', () => {
    const asks: Ask[] = ['pin', 'identify', 'puzzle', 'outline', 'capital', 'flag'];
    const ids = Array.from({ length: 600 }, (_, i) => `ES:${i}`);
    const dealt = ids.map((id) => askOf(77, id, asks));
    // The same piece of the same game is always asked the same way: in the round of misses, and for whoever opens its link.
    expect(ids.map((id) => askOf(77, id, asks))).toEqual(dealt);
    // Another game deals otherwise.
    expect(ids.map((id) => askOf(78, id, asks))).not.toEqual(dealt);
    // Every way comes up, and none takes over: each is near its sixth of the pieces.
    for (const ask of asks) {
      const share = dealt.filter((a) => a === ask).length / ids.length;
      expect(share, ask).toBeGreaterThan(0.1);
      expect(share, ask).toBeLessThan(0.24);
    }
    // Only among the ways the piece has; with none, it is pointed at.
    expect(new Set(ids.map((id) => askOf(77, id, ['pin', 'identify'])))).toEqual(new Set(['pin', 'identify']));
    expect(askOf(77, 'x', ['flag'])).toBe('flag');
    expect(askOf(77, 'x', [])).toBe('pin');
    // Big seeds, as the ones of a link are.
    expect(asks).toContain(askOf(2_147_483_646, 'FR', asks));
  });
});

describe('a turned outline', () => {
  it('is turned by whole degrees, never left nearly upright, and the same for the same piece of the same game', () => {
    const turns = Array.from({ length: 500 }, (_, i) => turnOf(31, `ES:${i}`));
    for (const t of turns) {
      expect(Number.isInteger(t)).toBe(true);
      expect(t).toBeGreaterThanOrEqual(TURN_MIN);
      expect(t).toBeLessThanOrEqual(360 - TURN_MIN);
    }
    expect(Array.from({ length: 500 }, (_, i) => turnOf(31, `ES:${i}`))).toEqual(turns);
    expect(Array.from({ length: 500 }, (_, i) => turnOf(32, `ES:${i}`))).not.toEqual(turns);
    // All round the dial: upside down as well as on its side.
    expect(Math.min(...turns)).toBeLessThan(TURN_MIN + 15);
    expect(Math.max(...turns)).toBeGreaterThan(360 - TURN_MIN - 15);
    expect(turns.filter((t) => t > 135 && t < 225).length).toBeGreaterThan(60);
    // Not the lot that deals the ways of the medley: the two must not go hand in hand.
    expect(turnOf(31, 'ES:1')).not.toBe(turnOf(31, 'ES:2'));
  });

  it('is the same shape, turned clockwise and fitted to its square', () => {
    // A tall box, twice as high as wide, with a notch at its north-east corner to tell which way it lies.
    const box: AnyGeo = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 2],
            [0.6, 2],
            [0.6, 1.6],
            [1, 1.6],
            [1, 0],
            [0, 0],
          ],
        ],
      },
    } as AnyGeo;
    const boundsOf = (d: string) => {
      const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const xs = nums.filter((_, i) => i % 2 === 0);
      const ys = nums.filter((_, i) => i % 2 === 1);
      return { w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys), x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    };
    const upright = boundsOf(silhouette(box, 400));
    // Upright it is tall: it fills the height of the square, less the margin.
    expect(upright.h).toBeCloseTo(400 * 0.84, 0);
    expect(upright.w).toBeLessThan(upright.h * 0.55);
    // Nothing given, nothing turned.
    expect(silhouette(box, 400, 0.08, 0)).toBe(silhouette(box, 400));
    // A quarter turn lays it on its side, and it is fitted again: now it fills the width.
    const side = boundsOf(silhouette(box, 400, 0.08, 90));
    expect(side.w).toBeCloseTo(400 * 0.84, 0);
    expect(side.h).toBeLessThan(side.w * 0.55);
    // Whatever the turn, it stays inside the square.
    for (const turn of [50, 137, 180, 222, 310]) {
      const b = boundsOf(silhouette(box, 400, 0.08, turn));
      expect(b.x0, `${turn}`).toBeGreaterThanOrEqual(400 * 0.08 - 0.5);
      expect(b.x1, `${turn}`).toBeLessThanOrEqual(400 * 0.92 + 0.5);
      expect(b.y0, `${turn}`).toBeGreaterThanOrEqual(400 * 0.08 - 0.5);
      expect(b.y1, `${turn}`).toBeLessThanOrEqual(400 * 0.92 + 0.5);
    }
    // Clockwise: after a quarter turn, what pointed north points east. The notch was at the top right; it is now at the bottom right.
    const notch = (d: string) => {
      const b = boundsOf(d);
      // The corner of its box that the shape keeps farthest from is the one the notch was cut from.
      const nums = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
      const pts = nums.reduce<[number, number][]>((acc, v, i) => (i % 2 ? (acc[acc.length - 1].push(v), acc) : (acc.push([v] as unknown as [number, number]), acc)), []);
      const near = (cx: number, cy: number) => Math.min(...pts.map(([x, y]) => Math.hypot(x - cx, y - cy)));
      const corners: Record<string, number> = { topLeft: near(b.x0, b.y0), topRight: near(b.x1, b.y0), bottomRight: near(b.x1, b.y1), bottomLeft: near(b.x0, b.y1) };
      return Object.entries(corners).sort((a, c) => c[1] - a[1])[0][0];
    };
    expect(notch(silhouette(box, 400))).toBe('topRight');
    expect(notch(silhouette(box, 400, 0.08, 90))).toBe('bottomRight');
    expect(notch(silhouette(box, 400, 0.08, 180))).toBe('bottomLeft');
    expect(notch(silhouette(box, 400, 0.08, 270))).toBe('topLeft');
  });
});

describe('what a flashcard asks for', () => {
  const spain = piece({ name: 'España', capital: ['Madrid'], fl: 'es' });
  const monaco = piece({ name: 'Mónaco', capital: ['Mónaco'], fl: 'mc' });
  const burgos = piece({ name: 'Burgos', capital: ['Burgos'] });
  const vizcaya = piece({ name: 'Vizcaya', capital: ['Bilbao'] });
  const ebro = piece({ name: 'Ebro', shape: 'line' });

  it('is its name or its place for any piece, its capital when it has to be known, its flag when it has one', () => {
    for (const it of [spain, monaco, burgos, vizcaya, ebro]) {
      expect(cardable(it, 'name')).toBe(true);
      expect(cardable(it, 'where')).toBe(true);
    }
    expect(cardable(spain, 'capital')).toBe(true);
    expect(cardable(vizcaya, 'capital')).toBe(true);
    // A capital named after its place would be read off the card.
    expect(cardable(monaco, 'capital')).toBe(false);
    expect(cardable(burgos, 'capital')).toBe(false);
    expect(cardable(ebro, 'capital')).toBe(false);
    expect(cardable(spain, 'flag')).toBe(true);
    expect(cardable(ebro, 'flag')).toBe(false);
  });

  it('is what the player chose where the map has it, and the name where it has not', () => {
    const countries = { scope: 'countries' as const, items: [spain, monaco] as Item[] };
    const provinces = { scope: 'regions' as const, items: [burgos, vizcaya] as Item[] };
    const selfNamed = { scope: 'regions' as const, items: [burgos] as Item[] };
    const rivers = { scope: 'physical' as const, items: [ebro] as Item[] };
    for (const deck of [countries, provinces, selfNamed, rivers]) {
      expect(cardAskOf(undefined, deck)).toBe('name');
      expect(cardAskOf('name', deck)).toBe('name');
      expect(cardAskOf('where', deck)).toBe('where');
    }
    expect(cardAskOf('flag', countries)).toBe('flag');
    expect(cardAskOf('capital', countries)).toBe('capital');
    expect(cardAskOf('capital', provinces)).toBe('capital');
    // Provinces have a country's flag on them, but it is not theirs to be asked about.
    expect(cardAskOf('flag', provinces)).toBe('name');
    // Where every capital is named after its place there is nothing to ask; nor have rivers any.
    expect(cardAskOf('capital', selfNamed)).toBe('name');
    expect(cardAskOf('capital', rivers)).toBe('name');
    expect(cardAskOf('flag', rivers)).toBe('name');
  });

  it('shows an out-of-focus flag clearer with each try', () => {
    expect(FLAG_BLUR.length).toBe(3);
    expect([...FLAG_BLUR].sort((a, b) => b - a)).toEqual(FLAG_BLUR);
    expect(FLAG_BLUR[FLAG_BLUR.length - 1]).toBeGreaterThan(0);
  });
});
