/** Homework with a receipt: the address of an assignment, the receipt of whoever did it, and what each of them says. */
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { gradeOf, scoreOf } from '../games/quiz';
import { toBase64Url } from './challenge';
import { loadIndex, setLoader, type World } from './data';
import { embedGame, embedPath } from './embed';
import { setLang } from './i18n';
import { encodeList } from './lists';
import { RECEIPT_PATH, TASK_PATH, routeOf } from './routes';
import { FORMAT_MODES } from './rules';
import { DEFAULT_OPTS, type CustomList, type Format, type Opts } from './store';
import {
  TASK_NAME_MAX,
  TASK_TITLE_MAX,
  answered,
  canTask,
  checkOf,
  decodeReceipt,
  encodeReceipt,
  gameLine,
  headline,
  outcomeOf,
  parseTask,
  pupilName,
  receiptCaveat,
  receiptDetail,
  receiptLine,
  receiptOf,
  receiptUrl,
  receiptWhen,
  receiptsTable,
  taskPath,
  taskTitle,
  taskUrl,
  type Receipt,
} from './task';
import type { Mode } from './types';

const opts = (patch: Partial<Opts> = {}): Opts => ({ ...DEFAULT_OPTS, ...patch });
const SPAIN = { section: 'regions' as const, link: { ids: ['ES'], levels: { ES: 'f' }, mode: 'pin' } };
const HARD = opts({ tries: 1, hints: false });
/** Ten in the morning of the 15th of November of 2026, where the tests run, in minutes since 1970. */
const AT = Math.floor(new Date(2026, 10, 15, 10, 5).getTime() / 60000);
const receipt = (patch: Partial<Receipt> = {}): Receipt => ({ task: 'Tema%204/regiones/ES:f/pin/tries=1;hints=0', name: 'Ana García', ok: 9, warn: 1, bad: 2, total: 12, secs: 125, at: AT, n: 2, ...patch });

beforeEach(() => setLang('es'));

describe('what can be set as homework', () => {
  it('are the games of questions, whose rules can be chosen', () => {
    for (const mode of FORMAT_MODES) expect(canTask(mode), mode).toBe(true);
    for (const mode of ['explore', 'learn', 'travel', 'print', 'edit', 'nameall', 'cards', 'regionle', 'connect'] as Mode[]) expect(canTask(mode), mode).toBe(false);
  });
});

describe('the title of an assignment and the name of whoever does it', () => {
  it('are a line each: no breaks, single spaces, no more than their length', () => {
    expect(taskTitle('  Tema 4:\n las   comunidades\t ')).toBe('Tema 4: las comunidades');
    expect(pupilName('  Ana \n García  ')).toBe('Ana García');
    expect(taskTitle('x'.repeat(200))).toHaveLength(TASK_TITLE_MAX);
    expect(pupilName('x'.repeat(200))).toHaveLength(TASK_NAME_MAX);
    expect(taskTitle('   ')).toBe('');
    expect(pupilName('   ')).toBe('');
  });

  it('are cut by letters, not by halves of one, and never end in a space', () => {
    expect(pupilName(`${'a'.repeat(TASK_NAME_MAX - 1)}😀😀`)).toBe(`${'a'.repeat(TASK_NAME_MAX - 1)}😀`);
    expect(pupilName(`${'a'.repeat(TASK_NAME_MAX - 1)} bc`)).toBe('a'.repeat(TASK_NAME_MAX - 1));
  });

  it('take the mark of no title for no title', () => {
    expect(taskTitle('-')).toBe('');
    expect(taskTitle(' - ')).toBe('');
    expect(taskTitle('- a')).toBe('- a');
  });
});

describe('the address of an assignment', () => {
  it('is its title and then its game, as a box in another page writes it', () => {
    expect(taskPath('Tema 4: España', SPAIN, HARD)).toBe('Tema%204%3A%20Espa%C3%B1a/regiones/ES:f/pin/tries=1;hints=0');
    expect(taskPath('Tema 4: España', SPAIN, HARD).split('/').slice(1).join('/')).toBe(embedPath(SPAIN, HARD).replace(/^incrustar\//, ''));
    // Without a title, a mark where it would be: what follows is still the game.
    expect(taskPath('', SPAIN, opts())).toBe('-/regiones/ES:f/pin');
    expect(taskPath('  ', SPAIN, opts())).toBe('-/regiones/ES:f/pin');
    // A slash in the title does not cut the address in another place.
    expect(taskPath('1/2', SPAIN, opts())).toBe('1%2F2/regiones/ES:f/pin');
  });

  it('carries the game as it is set: its format, its rules and how it is answered', () => {
    expect(taskPath('', SPAIN, opts({ format: 'timed', clock: 120 }))).toBe('-/regiones/ES:f/pin/format=timed;clock=120');
    expect(taskPath('', SPAIN, opts({ format: 'lives', lives: 1 }))).toBe('-/regiones/ES:f/pin/format=lives;lives=1');
    expect(taskPath('', { ...SPAIN, link: { ...SPAIN.link, mode: 'capital' } }, opts({ answer: 'choice', length: 10, format: 'exam' }))).toBe('-/regiones/ES:f/capital/answer=choice;length=10;format=exam');
    // Homework is done by one: a game of two is set as the plain game it is for each of them.
    expect(taskPath('', SPAIN, opts({ format: 'duo' }))).toBe('-/regiones/ES:f/pin');
    // The card of Wikipedia is for whoever plays to say.
    expect(taskPath('', SPAIN, opts({ wiki: false }))).toBe('-/regiones/ES:f/pin');
  });

  it('is written whole from where the game lives, whatever page it was made on', () => {
    expect(taskUrl('-/regiones/ES:f/pin', 'https://diegosb72.github.io/regionle/regiones.html#/regiones')).toBe('https://diegosb72.github.io/regionle/#/tarea/-/regiones/ES:f/pin');
    expect(TASK_PATH).toBe('tarea');
  });

  it('is read back: the title, the game and its options', () => {
    const task = parseTask(taskPath('Tema 4: España', SPAIN, HARD))!;
    expect(task.title).toBe('Tema 4: España');
    expect(task.what).toMatchObject({ kind: 'map', section: 'regions', link: { ids: ['ES'], levels: { ES: 'f' }, mode: 'pin' } });
    expect(task.what.opts).toMatchObject({ tries: 1, hints: false, format: 'normal' });
    expect(parseTask('-/regiones/ES:f/pin')!.title).toBe('');
    expect(parseTask('1%2F2/regiones/ES:f/pin')!.title).toBe('1/2');
  });

  it('is the same assignment however its link was written on the way', () => {
    const made = taskPath('Tema 4: España', SPAIN, HARD);
    expect(parseTask(made)!.path).toBe(made);
    // A chat that writes the title out, or a hand that writes the section its own way.
    expect(parseTask('Tema 4: España/regiones/ES:f/pin/tries=1;hints=0')!.path).toBe(made);
    expect(parseTask('Tema%204%3A%20Espa%C3%B1a/Regiones/ES:f/pin/hints=0;tries=1')!.path).toBe(made);
    // What is how a game opens is not written: an address that writes it names the same game.
    expect(parseTask('-/regiones/ES:f/pin/tries=3;hints=1')!.path).toBe('-/regiones/ES:f/pin');
    // A title that is not well written is taken as it comes.
    expect(parseTask('100%/regiones/ES:f/pin')!.title).toBe('100%');
    expect(parseTask('100%/regiones/ES:f/pin')!.path).toBe('100%25/regiones/ES:f/pin');
  });

  it('is nothing without a game after the title', () => {
    for (const bad of ['', 'Tema', 'Tema/', '/regiones/ES:f/pin', 'Tema/nada/ES', 'Tema/regiones']) expect(parseTask(bad), bad).toBeNull();
  });

  it('is an address of the game, which opens the assignment', () => {
    const made = taskPath('Tema 4', SPAIN, HARD);
    expect(routeOf(`${TASK_PATH}/${made}`)).toEqual({ kind: 'task', rest: made });
    expect(routeOf(TASK_PATH)).toEqual({ kind: 'task', rest: '' });
  });

  it('takes a list of pieces too, with its game', () => {
    const list: CustomList = { id: 'l1', name: 'Las del jueves', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-M', 'ES-B', 'ES-V'] };
    const code = encodeList(list);
    const made = taskPath('Examen', { list: code, mode: 'identify' }, opts({ answer: 'choice' }));
    expect(made).toBe(`Examen/lista/${code}/identify/answer=choice`);
    const task = parseTask(made)!;
    expect(task.what).toMatchObject({ kind: 'list', code, mode: 'identify' });
    expect(task.path).toBe(made);
  });
});

describe('a game that is set, in words', () => {
  let world: World;
  beforeAll(async () => {
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
    world = await loadIndex();
  });
  /** The game of an address, as whoever opens it gets it. */
  const said = (source: Parameters<typeof taskPath>[1], o: Opts): string => gameLine(embedGame(parseTask(taskPath('', source, o))!.what, world)!.cfg);
  const game = (mode: string) => ({ ...SPAIN, link: { ...SPAIN.link, mode } });

  it('says the game, how many questions and the rules that are not the usual ones', () => {
    expect(said(SPAIN, opts())).toBe('Señalar · todas las preguntas');
    expect(said(SPAIN, HARD)).toBe('Señalar · todas las preguntas · 1 intento, sin pistas');
    expect(said(SPAIN, opts({ length: 10 }))).toBe('Señalar · 10 preguntas');
    expect(said(SPAIN, opts({ length: 'endless' }))).toBe('Señalar · sin fin');
  });

  it('says how it is answered where it is answered by typing, and not where it is answered on the map', () => {
    expect(said(game('capital'), opts({ answer: 'type' }))).toBe('Capitales · todas las preguntas · escribiendo');
    expect(said(game('capital'), opts({ answer: 'choice' }))).toBe('Capitales · todas las preguntas');
    expect(said(SPAIN, opts({ answer: 'type' }))).toBe('Señalar · todas las preguntas');
  });

  it('says the format, and of a paced one what it lasts instead of its questions', () => {
    expect(said(SPAIN, opts({ format: 'timed' }))).toBe('Señalar · Contrarreloj · un minuto');
    expect(said(SPAIN, opts({ format: 'timed', clock: 120 }))).toBe('Señalar · Contrarreloj · 2 minutos');
    expect(said(SPAIN, opts({ format: 'lives' }))).toBe('Señalar · Supervivencia · 3 vidas');
    expect(said(SPAIN, opts({ format: 'lives', lives: 1 }))).toBe('Señalar · Supervivencia · 1 vida');
    expect(said(SPAIN, opts({ format: 'exam', length: 20 }))).toBe('Señalar · Examen · 20 preguntas');
    // The rules of a game at ease are not those of an exam: it has none to tell.
    expect(said(SPAIN, opts({ format: 'exam', tries: 1, hints: false }))).toBe('Señalar · Examen · todas las preguntas');
  });

  it('says the hard looks where the game has them', () => {
    expect(said(game('outline'), opts({ turned: true, answer: 'choice' }))).toBe('Silueta · todas las preguntas · siluetas giradas');
    expect(said(SPAIN, opts({ turned: true }))).toBe('Señalar · todas las preguntas');
    expect(said({ section: 'countries', link: { ids: ['ES', 'FR', 'PT', 'IT'], levels: {}, mode: 'flag' } }, opts({ flagLook: 'grey', answer: 'choice' }))).toBe('Banderas · todas las preguntas · banderas en gris');
  });

  it('says what the game of the facts asks for', () => {
    const facts = { section: 'countries' as const, link: { ids: ['ES', 'FR', 'PT', 'IT'], levels: {}, mode: 'fact' } };
    expect(said(facts, opts({ answer: 'choice' }))).toBe('Datos del país · moneda · todas las preguntas');
    expect(said(facts, opts({ fact: 'language', answer: 'type' }))).toBe('Datos del país · idioma · todas las preguntas · escribiendo');
    expect(said(facts, opts({ fact: 'dial', format: 'exam', length: 10, answer: 'type' }))).toBe('Datos del país · prefijo · Examen · 10 preguntas · escribiendo');
    // Another game says nothing of it, whatever was chosen for this one.
    expect(said({ ...facts, link: { ...facts.link, mode: 'capital' } }, opts({ fact: 'dial', answer: 'choice' }))).toBe('Capitales · todas las preguntas');
    setLang('en');
    expect(said(facts, opts({ fact: 'domain', answer: 'choice' }))).toBe('Country facts · domain · every question');
  });

  it('is said in English too', () => {
    setLang('en');
    expect(said(SPAIN, HARD)).toBe('Pin it · every question · 1 try, no hints');
    expect(said(game('capital'), opts({ format: 'timed', clock: 30 }))).toBe('Capitals · Time attack · 30 seconds · typing');
    expect(said(game('capital'), opts({ length: 10 }))).toBe('Capitals · 10 questions · typing');
  });
});

describe('a receipt', () => {
  it('is made of how a game went: its tally, its whole seconds and the minute it ended in', () => {
    const now = new Date(2026, 10, 15, 10, 5, 59).getTime();
    expect(receiptOf('t/regiones/ES/pin', ' Ana  García ', { ok: 9, warn: 1, bad: 2, total: 12, ms: 125_999 }, 2, now)).toEqual({ task: 't/regiones/ES/pin', name: 'Ana García', ok: 9, warn: 1, bad: 2, total: 12, secs: 125, at: AT, n: 2 });
  });

  it('is read back as it was written', () => {
    for (const r of [receipt(), receipt({ name: 'Zoë Ñandú 😀', total: 0, n: 1 }), receipt({ ok: 0, warn: 0, bad: 0, secs: 0 }), receipt({ task: `x/lista/${'A'.repeat(900)}/pin` })]) {
      expect(decodeReceipt(encodeReceipt(r))).toEqual({ receipt: r, sound: true });
    }
  });

  it('is written the same from one version to the next: one that was sent last term still holds', () => {
    const sent = 'WzEsIlRlbWElMjA0L3JlZ2lvbmVzL0VTOmYvcGluL3RyaWVzPTE7aGludHM9MCIsIkFuYSBHYXJjw61hIiw5LDEsMiwxMiwxMjUsMjk3MjAxMDUsMl0.mka8u9';
    const r = receipt({ at: 29_720_105 });
    expect(encodeReceipt(r)).toBe(sent);
    expect(decodeReceipt(sent)).toEqual({ receipt: r, sound: true });
    expect(checkOf('abc')).toBe('hngjrw');
  });

  it('is an address of the game, written with letters that any link takes', () => {
    const code = encodeReceipt(receipt());
    expect(code).toMatch(/^[A-Za-z0-9_-]+\.[a-z0-9]+$/);
    expect(routeOf(`${RECEIPT_PATH}/${code}`)).toEqual({ kind: 'receipt', code });
    expect(routeOf(RECEIPT_PATH)).toEqual({ kind: 'receipt', code: '' });
    expect(receiptUrl(code, 'https://diegosb72.github.io/regionle/en.html#/play')).toBe(`https://diegosb72.github.io/regionle/#/justificante/${code}`);
  });

  it('does not hold once any of what it says is changed', () => {
    const code = encodeReceipt(receipt());
    const [, check] = code.split('.');
    const forged = (patch: Partial<Receipt>) => `${encodeReceipt(receipt(patch)).split('.')[0]}.${check}`;
    for (const patch of [{ ok: 10, bad: 1 }, { name: 'Ana Garcia' }, { n: 1 }, { secs: 60 }, { at: AT + 1 }, { total: 13 }, { warn: 0, ok: 10 }, { task: 'Tema%204/regiones/ES:f/pin' }] as Partial<Receipt>[]) {
      const read = decodeReceipt(forged(patch));
      expect(read?.sound, JSON.stringify(patch)).toBe(false);
      // What it says is still read: whoever looks at it sees what was claimed.
      expect(read?.receipt).toEqual(receipt(patch));
    }
  });

  it('does not hold without its check figure, or with another', () => {
    const code = encodeReceipt(receipt());
    const [payload, check] = code.split('.');
    expect(decodeReceipt(payload)?.sound).toBe(false);
    expect(decodeReceipt(`${payload}.`)?.sound).toBe(false);
    expect(decodeReceipt(`${payload}.${check}0`)?.sound).toBe(false);
    expect(decodeReceipt(`${payload}.${check.slice(0, -1)}`)?.sound).toBe(false);
    expect(check).toBe(checkOf(payload));
    expect(checkOf(payload)).not.toBe(checkOf(`${payload}A`));
  });

  it('cannot be read when it was cut, or when it is not one', () => {
    const code = encodeReceipt(receipt());
    for (const bad of ['', '.', 'abc', code.slice(0, 30), code.slice(10), `${code.split('.')[0].slice(0, -7)}.${code.split('.')[1]}`]) expect(decodeReceipt(bad), bad).toBeNull();
  });

  it('cannot be read when a figure in it is not one a game gives', () => {
    const raw = (list: unknown[]) => {
      const payload = toBase64Url(JSON.stringify(list));
      return decodeReceipt(`${payload}.${checkOf(payload)}`);
    };
    const good = [1, 'T/regiones/ES/pin', 'Ana', 9, 1, 2, 12, 125, AT, 2];
    expect(raw(good)?.sound).toBe(true);
    const cases: [number, unknown][] = [
      [0, 2],
      [1, ''],
      [1, 7],
      [2, ''],
      [2, ' Ana '],
      [2, 'x'.repeat(TASK_NAME_MAX + 1)],
      [3, -1],
      [3, 1.5],
      [3, '9'],
      [3, 10000],
      [4, null],
      [5, 20],
      [6, -1],
      [7, -5],
      [7, 400000],
      [8, 0],
      [8, 2 ** 32],
      [9, 0],
      [9, 10000],
    ];
    for (const [i, value] of cases) expect(raw(good.map((x, j) => (j === i ? value : x))), `${i}: ${String(value)}`).toBeNull();
    expect(raw(good.slice(0, 9))).toBeNull();
    expect(raw([...good, 1])).toBeNull();
    expect(raw({ ...good } as unknown as unknown[])).toBeNull();
    // More answers than questions is nothing a game ends with; with no set number of questions, any tally is.
    expect(raw(good.map((x, j) => (j === 6 ? 11 : x)))).toBeNull();
    expect(raw(good.map((x, j) => (j === 6 ? 0 : x)))?.sound).toBe(true);
    // Each figure has a ceiling of its own, also where there is no set number of questions to hold it.
    const open = good.map((x, j) => (j === 6 ? 0 : x));
    for (const i of [3, 4, 5]) {
      expect(raw(open.map((x, j) => (j === i ? 9999 : x)))?.sound, `${i}: 9999`).toBe(true);
      expect(raw(open.map((x, j) => (j === i ? 10000 : x))), `${i}: 10000`).toBeNull();
    }
    expect(raw(good.map((x, j) => (j === 6 ? 10000 : x)))).toBeNull();
    // …and so has the address of the assignment.
    expect(raw(good.map((x, j) => (j === 1 ? `t/${'x'.repeat(3998)}` : x)))?.sound).toBe(true);
    expect(raw(good.map((x, j) => (j === 1 ? `t/${'x'.repeat(3999)}` : x)))).toBeNull();
  });
});

describe('how an assignment went', () => {
  it('is counted over every question the game had', () => {
    expect(outcomeOf(receipt())).toEqual({ asked: 12, short: false, score: scoreOf(9, 1, 12), grade: gradeOf(9, 12), hits: 10 });
    expect(outcomeOf(receipt()).score).toBe(79);
    expect(outcomeOf(receipt()).grade).toBe(7.5);
  });

  it('counts what was not answered against it, when it was left before its end', () => {
    const left = outcomeOf(receipt({ ok: 1, warn: 0, bad: 0, total: 50 }));
    expect(left).toEqual({ asked: 1, short: true, score: 2, grade: 0.2, hits: 1 });
    // The game told whoever left it of the one question answered: the receipt is of the assignment.
    expect(scoreOf(1, 0, 1)).toBe(100);
  });

  it('is counted over what was answered where the game has no set number of questions', () => {
    expect(outcomeOf(receipt({ ok: 14, warn: 2, bad: 4, total: 0 }))).toEqual({ asked: 20, short: false, score: 75, grade: 7, hits: 16 });
    expect(outcomeOf(receipt({ ok: 0, warn: 0, bad: 0, total: 0 }))).toEqual({ asked: 0, short: false, score: 0, grade: 0, hits: 0 });
  });

  it('is headed by what its format is counted by', () => {
    // None is not one: «0 aciertos».
    expect(headline(receipt({ ok: 0, warn: 0, bad: 3, total: 0 }), 'timed')).toBe('0 aciertos');
    expect(receiptDetail(receipt({ total: 0, bad: 0 }), 'lives')).toBe('0 fallos, en 2:05');
    expect(headline(receipt(), 'normal')).toBe('79\u00a0%');
    expect(headline(receipt(), 'duo')).toBe('79\u00a0%');
    expect(headline(receipt(), 'exam')).toBe('Nota: 7,5');
    expect(headline(receipt({ total: 0 }), 'timed')).toBe('10 aciertos');
    expect(headline(receipt({ ok: 1, warn: 0, total: 0 }), 'lives')).toBe('1 acierto');
    setLang('en');
    expect(headline(receipt(), 'exam')).toBe('Mark: 7.5 out of 10');
    expect(headline(receipt({ total: 0 }), 'timed')).toBe('10 right');
  });

  it('says how many were answered, of how many', () => {
    expect(answered(receipt())).toBe('12 de 12');
    expect(answered(receipt({ ok: 1, warn: 0, bad: 0 }))).toBe('1 de 12');
    expect(answered(receipt({ total: 0 }))).toBe('12');
    setLang('en');
    expect(answered(receipt())).toBe('12 of 12');
  });

  it('is told in a line', () => {
    expect(receiptLine(receipt(), 'normal')).toBe('79\u00a0% (respondidas 12 de 12, en 2:05)');
    expect(receiptLine(receipt({ ok: 1, warn: 0, bad: 0 }), 'normal')).toBe('8\u00a0% (respondidas 1 de 12, sin terminar, en 2:05)');
    expect(receiptLine(receipt(), 'exam')).toBe('Nota: 7,5 (respondidas 12 de 12, en 2:05)');
    expect(receiptLine(receipt({ total: 0, secs: 60 }), 'timed')).toBe('10 aciertos (2 fallos, en 1:00)');
    expect(receiptDetail(receipt({ total: 0, bad: 1 }), 'lives')).toBe('1 fallo, en 2:05');
    setLang('en');
    expect(receiptLine(receipt({ ok: 1, warn: 0, bad: 0 }), 'normal')).toBe('8\u00a0% (1 of 12 answered, not finished, in 2:05)');
    expect(receiptLine(receipt({ total: 0, bad: 1 }), 'lives')).toBe('10 right (1 miss, in 2:05)');
  });

  it('says when, in the time of whoever reads it', () => {
    expect(receiptWhen(AT)).toBe('15 de noviembre de 2026, 10:05');
    expect(receiptWhen(AT + 14 * 60)).toBe('16 de noviembre de 2026, 00:05');
    setLang('en');
    expect(receiptWhen(AT)).toBe('15 November 2026, 10:05');
  });

  it('says what a receipt is worth in both languages', () => {
    expect(receiptCaveat()).toContain('no es a prueba de trampas');
    setLang('en');
    expect(receiptCaveat()).toContain('not cheat-proof');
  });
});

describe('the receipts of a class as a table', () => {
  const list = [receipt(), receipt({ name: 'Bruno', ok: 12, warn: 0, bad: 0, n: 1, secs: 61, at: AT + 60 })];
  const cells = (text: string) => text.split('\n').map((line) => line.split('\t'));

  it('is a line each under the names of its columns, with tabs between', () => {
    const table = cells(receiptsTable(list, 'normal'));
    expect(table).toEqual([
      ['Nombre', 'Puntuación (%)', 'Respondidas', 'Preguntas', 'A la primera', 'Con ayuda', 'Fallos', 'Tiempo', 'Fecha', 'Intento'],
      ['Ana García', '79', '12', '12', '9', '1', '2', '2:05', '2026-11-15 10:05', '2'],
      ['Bruno', '100', '12', '12', '12', '0', '0', '1:01', '2026-11-15 11:05', '1'],
    ]);
  });

  it('gives the result its format is counted by', () => {
    const formats: [Format, string, string][] = [
      ['exam', 'Nota', '7,5'],
      ['timed', 'Aciertos', '10'],
      ['lives', 'Aciertos', '10'],
    ];
    for (const [format, head, value] of formats) {
      const table = cells(receiptsTable([receipt()], format));
      expect(table[0][1], format).toBe(head);
      expect(table[1][1], format).toBe(value);
    }
    // No set number of questions: the box is left empty.
    expect(cells(receiptsTable([receipt({ total: 0 })], 'timed'))[1][3]).toBe('');
    // One left early: what was answered is one figure, and what there was to answer, another.
    expect(cells(receiptsTable([receipt({ ok: 3, warn: 0, bad: 1 })], 'normal'))[1].slice(1, 4)).toEqual(['25', '4', '12']);
  });

  it('is headed in English too, and is only its heading when there is nobody', () => {
    setLang('en');
    expect(receiptsTable([], 'normal')).toBe('Name\tScore (%)\tAnswered\tQuestions\tFirst time\tWith help\tMisses\tTime\tDate\tAttempt');
    expect(cells(receiptsTable([receipt()], 'exam'))[1][1]).toBe('7.5');
  });

  it('does not let a name be taken for a formula by the spreadsheet', () => {
    for (const name of ['=SUM(A1)', '+1', '-1', '@x']) expect(cells(receiptsTable([receipt({ name })], 'normal'))[1][0]).toBe(`'${name}`);
    expect(cells(receiptsTable([receipt({ name: 'Ana=1' })], 'normal'))[1][0]).toBe('Ana=1');
  });
});
