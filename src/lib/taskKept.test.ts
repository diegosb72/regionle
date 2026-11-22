// @vitest-environment jsdom
/** What homework leaves in the browser: the name, the starts of each assignment, the receipts, and the game that ended. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setLang } from './i18n';
import { encodeReceipt, type Receipt } from './task';
import {
  RECEIPTS_MAX,
  TASKS_KEY,
  TASKS_MAX,
  attemptsOf,
  cleanKept,
  doneWith,
  finish,
  forgetCounted,
  forgetReceipts,
  keepName,
  keepReceipt,
  keptName,
  keyOf,
  receiptsKept,
  started,
  tasksOf,
} from './taskKept';

const A = 'Tema%204/regiones/ES:f/pin';
const B = '-/paises/ES+FR+PT/flag/answer=choice';
const receipt = (patch: Partial<Receipt> = {}): Receipt => ({ task: A, name: 'Ana', ok: 9, warn: 1, bad: 2, total: 12, secs: 125, at: 29_000_000, n: 1, ...patch });
const code = (patch: Partial<Receipt> = {}): string => encodeReceipt(receipt(patch));
const stored = (): { name: string; n: Record<string, number>; got: string[]; done: number } | null => JSON.parse(localStorage.getItem(TASKS_KEY) ?? 'null');
const store = (kept: unknown): void => localStorage.setItem(TASKS_KEY, typeof kept === 'string' ? kept : JSON.stringify(kept));

beforeEach(() => {
  setLang('es');
  localStorage.clear();
  forgetCounted();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the name of whoever does assignments here', () => {
  it('is none until one is typed, and then the last one', () => {
    expect(keptName()).toBe('');
    keepName('  Ana   García ');
    expect(keptName()).toBe('Ana García');
    keepName('Bruno');
    expect(keptName()).toBe('Bruno');
    expect(stored()).toEqual({ name: 'Bruno', n: {}, got: [], done: 0 });
  });

  it('leaves nothing behind when it is taken away and nothing else is kept', () => {
    keepName('Ana');
    keepName(' ');
    expect(localStorage.getItem(TASKS_KEY)).toBeNull();
  });
});

describe('the times an assignment was started', () => {
  it('are counted one by one, each assignment on its own', () => {
    expect(attemptsOf(A)).toBe(0);
    expect(started(A, 1)).toBe(1);
    expect(started(A, 2)).toBe(2);
    expect(started(B, 3)).toBe(1);
    expect(started(A, 4)).toBe(3);
    expect(attemptsOf(A)).toBe(3);
    expect(attemptsOf(B)).toBe(1);
    expect(stored()?.n).toEqual({ [keyOf(B)]: 1, [keyOf(A)]: 3 });
  });

  it('count a game once, however many times it is told of', () => {
    expect(started(A, 7)).toBe(1);
    expect(started(A, 7)).toBe(1);
    expect(started(A, 7)).toBe(1);
    expect(attemptsOf(A)).toBe(1);
  });

  it('count the same game again when the page is opened again on it: it is started anew', () => {
    expect(started(A, 7)).toBe(1);
    forgetCounted();
    expect(started(A, 7)).toBe(2);
  });

  it('count from one again if what was kept is gone', () => {
    expect(started(A, 7)).toBe(1);
    localStorage.clear();
    expect(started(A, 7)).toBe(1);
  });

  it('are kept for the latest assignments, and the oldest give way', () => {
    for (let i = 0; i < TASKS_MAX + 5; i++) started(`t${i}/regiones/ES/pin`, i);
    expect(Object.keys(stored()!.n)).toHaveLength(TASKS_MAX);
    expect(attemptsOf('t0/regiones/ES/pin')).toBe(0);
    expect(attemptsOf('t4/regiones/ES/pin')).toBe(0);
    expect(attemptsOf('t5/regiones/ES/pin')).toBe(1);
    expect(attemptsOf(`t${TASKS_MAX + 4}/regiones/ES/pin`)).toBe(1);
    // One that is started again is the latest: it does not give way next.
    started('t5/regiones/ES/pin', 1000);
    started('new/regiones/ES/pin', 1001);
    expect(attemptsOf('t5/regiones/ES/pin')).toBe(2);
    expect(attemptsOf('t6/regiones/ES/pin')).toBe(0);
  });

  it('give way by when they were last started, not by when they were first', () => {
    started('first/regiones/ES/pin', 1);
    started('second/regiones/ES/pin', 2);
    // The first one is started again: it is now the latest.
    started('first/regiones/ES/pin', 3);
    expect(Object.keys(stored()!.n)).toEqual([keyOf('second/regiones/ES/pin'), keyOf('first/regiones/ES/pin')]);
    for (let i = 0; i < TASKS_MAX - 1; i++) started(`t${i}/regiones/ES/pin`, 10 + i);
    expect(attemptsOf('second/regiones/ES/pin')).toBe(0);
    expect(attemptsOf('first/regiones/ES/pin')).toBe(2);
  });

  it('are counted under each name: on a device that several share, each one starts at the first', () => {
    expect(started(A, 1, 'Ana García')).toBe(1);
    expect(started(A, 2, 'Ana García')).toBe(2);
    expect(started(A, 3, 'Bruno')).toBe(1);
    // The same name, however it is written.
    expect(started(A, 4, '  ANA   garcia ')).toBe(3);
    expect(attemptsOf(A, 'ana garcía')).toBe(3);
    expect(attemptsOf(A, 'Bruno')).toBe(1);
    expect(attemptsOf(A, 'Carla')).toBe(0);
    expect(attemptsOf(A)).toBe(0);
    // Another assignment is another count, under the same name.
    expect(started(B, 5, 'Ana García')).toBe(1);
    // A name in letters that have no accents to lose is counted as it is.
    expect(started(A, 6, 'Мария')).toBe(1);
    expect(started(A, 7, '张伟')).toBe(1);
    expect(started(A, 8, 'мария')).toBe(2);
    expect(keyOf(A, 'Ana García')).toBe(keyOf(A, 'ana garcia'));
    expect(keyOf(A, 'Ana García')).not.toBe(keyOf(A, 'Ana Garcés'));
    expect(keyOf(A, 'Ana García')).toMatch(/^[a-z0-9]{1,8}$/);
  });

  it('go under a short name that tells one assignment from another', () => {
    expect(keyOf(A)).toMatch(/^[a-z0-9]{1,8}$/);
    expect(keyOf(A)).not.toBe(keyOf(B));
    expect(keyOf(A)).toBe(keyOf(A));
  });
});

describe('the receipts kept here', () => {
  it('are the ones that hold: one that was changed is not kept', () => {
    expect(keepReceipt(code())).toBe(true);
    const [payload, check] = code({ ok: 12, warn: 0, bad: 0 }).split('.');
    expect(keepReceipt(`${payload}.${check}x`)).toBe(false);
    expect(keepReceipt(payload)).toBe(false);
    expect(keepReceipt('nonsense')).toBe(false);
    expect(receiptsKept().map((k) => k.code)).toEqual([code()]);
  });

  it('are kept once each, the latest last', () => {
    keepReceipt(code());
    keepReceipt(code({ name: 'Bruno' }));
    keepReceipt(code());
    expect(stored()?.got).toEqual([code({ name: 'Bruno' }), code()]);
  });

  it('are given as the list of a class: by name, and each name from its first attempt to its last', () => {
    keepReceipt(code({ name: 'Zoe' }));
    keepReceipt(code({ name: 'ana', n: 2, at: 29_000_500 }));
    keepReceipt(code({ name: 'Bruno' }));
    keepReceipt(code({ name: 'Ana', n: 1, at: 29_000_100 }));
    keepReceipt(code({ name: 'Álvaro' }));
    expect(receiptsKept().map((k) => `${k.receipt.name} ${k.receipt.n}`)).toEqual(['Álvaro 1', 'Ana 1', 'ana 2', 'Bruno 1', 'Zoe 1']);
    // Under a name, by when each was made: an attempt counted on another device may bear a lower number and be later.
    keepReceipt(code({ name: 'Bruno', n: 1, at: 29_000_700 }));
    keepReceipt(code({ name: 'Bruno', n: 4, at: 29_000_200 }));
    expect(receiptsKept().filter((k) => k.receipt.name === 'Bruno').map((k) => k.receipt.at)).toEqual([29_000_000, 29_000_200, 29_000_700]);
    // Two receipts of the same minute: the earlier attempt first.
    keepReceipt(code({ name: 'Zoe', n: 3 }));
    keepReceipt(code({ name: 'Zoe', n: 2 }));
    expect(receiptsKept().filter((k) => k.receipt.name === 'Zoe').map((k) => k.receipt.n)).toEqual([1, 2, 3]);
  });

  it('are given by assignment, and dropped by assignment', () => {
    keepReceipt(code());
    keepReceipt(code({ task: B, name: 'Bruno' }));
    keepReceipt(code({ name: 'Carla' }));
    expect(receiptsKept(A).map((k) => k.receipt.name)).toEqual(['Ana', 'Carla']);
    expect(receiptsKept(B).map((k) => k.receipt.name)).toEqual(['Bruno']);
    expect(receiptsKept('other')).toEqual([]);
    forgetReceipts(A);
    expect(receiptsKept().map((k) => k.receipt.name)).toEqual(['Bruno']);
    forgetReceipts();
    expect(receiptsKept()).toEqual([]);
  });

  it('say which assignments they are of: the one with the latest receipt first', () => {
    expect(tasksOf([])).toEqual([]);
    keepReceipt(code({ at: 29_000_100 }));
    keepReceipt(code({ task: B, name: 'Bruno', at: 29_000_300 }));
    expect(tasksOf(receiptsKept())).toEqual([B, A]);
    keepReceipt(code({ name: 'Carla', at: 29_000_900 }));
    expect(tasksOf(receiptsKept())).toEqual([A, B]);
    // By the latest receipt of each, wherever it stands in the list: the last name of the class may have handed it in first.
    keepReceipt(code({ name: 'Zoe', at: 29_000_050 }));
    expect(receiptsKept(A).at(-1)!.receipt.name).toBe('Zoe');
    expect(tasksOf(receiptsKept())).toEqual([A, B]);
    keepReceipt(code({ task: B, name: 'Zacarías', at: 29_000_950 }));
    keepReceipt(code({ task: B, name: 'Zuriñe', at: 29_000_010 }));
    expect(tasksOf(receiptsKept())).toEqual([B, A]);
  });

  it('leave the name and the starts alone when they are dropped', () => {
    keepName('Ana');
    started(A, 1);
    keepReceipt(code());
    forgetReceipts();
    expect(stored()).toEqual({ name: 'Ana', n: { [keyOf(A)]: 1 }, got: [], done: 0 });
  });

  it('are no more than so many when they are read, whatever was written: the latest are the ones kept', () => {
    const got = Array.from({ length: RECEIPTS_MAX + 3 }, (_, i) => code({ n: i + 1 }));
    const n = Object.fromEntries(Array.from({ length: TASKS_MAX + 2 }, (_, i) => [keyOf(`t${i}/regiones/ES/pin`), 1]));
    const kept = cleanKept({ name: 'Ana', n, got, done: 0 });
    expect(kept.got).toHaveLength(RECEIPTS_MAX);
    expect(kept.got[0]).toBe(got[3]);
    expect(kept.got.at(-1)).toBe(got.at(-1));
    expect(Object.keys(kept.n)).toHaveLength(TASKS_MAX);
    expect(Object.keys(kept.n)[0]).toBe(keyOf('t2/regiones/ES/pin'));
  });

  it('are no more than so many: the oldest give way', () => {
    store({ name: '', n: {}, got: Array.from({ length: RECEIPTS_MAX }, (_, i) => code({ n: i + 1 })) });
    keepReceipt(code({ name: 'Nueva' }));
    const got = stored()!.got;
    expect(got).toHaveLength(RECEIPTS_MAX);
    expect(got[0]).toBe(code({ n: 2 }));
    expect(got.at(-1)).toBe(code({ name: 'Nueva' }));
  });
});

describe('a game of an assignment that ended', () => {
  it('leaves its receipt with the rest, and is told apart from any other game', () => {
    expect(doneWith(77)).toBe(false);
    finish(77, code());
    expect(doneWith(77)).toBe(true);
    expect(doneWith(78)).toBe(false);
    expect(receiptsKept(A).map((k) => k.code)).toEqual([code()]);
    // The next one that ends takes its place: only the last game can be opened again.
    finish(78, code({ n: 2 }));
    expect(doneWith(77)).toBe(false);
    expect(doneWith(78)).toBe(true);
    expect(receiptsKept(A)).toHaveLength(2);
  });

  it('is written down even if its receipt is not one to keep', () => {
    finish(5, 'nonsense');
    expect(doneWith(5)).toBe(true);
    expect(receiptsKept()).toEqual([]);
  });
});

describe('what is found in the browser', () => {
  it('is nothing when there is nothing, or when it cannot be read', () => {
    expect(keptName()).toBe('');
    store('{not json');
    expect(keptName()).toBe('');
    expect(attemptsOf(A)).toBe(0);
    expect(receiptsKept()).toEqual([]);
    for (const raw of [null, 7, 'x', []]) expect(cleanKept(raw)).toEqual({ name: '', n: {}, got: [], done: 0 });
  });

  it('is taken piece by piece: what is not what it should be is dropped', () => {
    const kept = cleanKept({
      name: '  Ana \n García ',
      n: { [keyOf(A)]: 3, 'not a key!': 2, abc: 0, abd: 1.5, abe: '4', abf: 10000, abg: 9999 },
      got: [code(), 'nonsense', code(), 7, `${code({ name: 'Bruno' }).split('.')[0]}.zzz`, code({ name: 'Carla' })],
      done: 1234,
      more: 'x',
    });
    expect(kept).toEqual({ name: 'Ana García', n: { [keyOf(A)]: 3, abg: 9999 }, got: [code(), code({ name: 'Carla' })], done: 1234 });
    expect(cleanKept({ name: 7, n: [], got: 'x', done: -1 })).toEqual({ name: '', n: {}, got: [], done: 0 });
    expect(cleanKept({ done: Number.NaN }).done).toBe(0);
  });

  it('goes on in memory of nothing when the browser keeps nothing', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('no storage');
    });
    expect(keptName()).toBe('');
    expect(() => keepName('Ana')).not.toThrow();
    expect(started(A, 1)).toBe(1);
    expect(keepReceipt(code())).toBe(true);
    expect(receiptsKept()).toEqual([]);
    expect(() => finish(1, code())).not.toThrow();
    expect(doneWith(1)).toBe(false);
  });
});
