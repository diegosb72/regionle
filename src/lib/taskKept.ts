/**
 * What homework (lib/task.ts) leaves in the browser, under a name of its own and apart from the progress:
 * the name typed for the last assignment done here, how many times each one was started under each name,
 * and the receipts that were made or opened here. On the device of whoever sets assignments those are the receipts of a
 * class, to be seen together; on the device of whoever does them, their own, so that one that was not sent
 * in time is not lost. None of it goes into a copy of the progress: a receipt is a link, and whoever was
 * sent it still has it.
 */
import { decodeReceipt, pupilName, type Receipt } from './task';
import { hashStr } from './text';

export const TASKS_KEY = 'regionle:tasks';

/** How many assignments are counted (each one under each name), and how many receipts are kept: the oldest give way. */
export const TASKS_MAX = 200;
export const RECEIPTS_MAX = 400;

interface Kept {
  name: string;
  /** Times each assignment was started under each name, by the short name of the two (`keyOf`); the latest started, last. */
  n: Record<string, number>;
  /** The receipts made or opened here, as their addresses write them; the latest, last. */
  got: string[];
  /** The mark of the last game of an assignment that ended here (`finish`); 0 when none has. */
  done: number;
}

const EMPTY: Kept = { name: '', n: {}, got: [], done: 0 };

/** Whatever was kept, made into what is kept: anything that is not what it should be is dropped. */
export function cleanKept(raw: unknown): Kept {
  if (!raw || typeof raw !== 'object') return EMPTY;
  const k = raw as Partial<Record<keyof Kept, unknown>>;
  const n: Record<string, number> = {};
  if (k.n && typeof k.n === 'object') {
    for (const [key, times] of Object.entries(k.n as Record<string, unknown>).slice(-TASKS_MAX)) {
      if (/^[a-z0-9]{1,8}$/.test(key) && typeof times === 'number' && Number.isInteger(times) && times > 0 && times < 10000) n[key] = times;
    }
  }
  const got = Array.isArray(k.got) ? [...new Set(k.got.filter((code): code is string => typeof code === 'string' && !!decodeReceipt(code)?.sound))].slice(-RECEIPTS_MAX) : [];
  return { name: typeof k.name === 'string' ? pupilName(k.name) : '', n, got, done: typeof k.done === 'number' && Number.isFinite(k.done) && k.done > 0 ? k.done : 0 };
}

function read(): Kept {
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    return raw ? cleanKept(JSON.parse(raw)) : EMPTY;
  } catch {
    // No storage, or something in it that cannot be read: nothing is kept.
    return EMPTY;
  }
}

function write(next: Kept): void {
  try {
    if (next.name || next.got.length || next.done || Object.keys(next.n).length) localStorage.setItem(TASKS_KEY, JSON.stringify(next));
    else localStorage.removeItem(TASKS_KEY);
  } catch {
    // No room, or no storage: it lasts as long as the page does.
  }
}

/** A name as it is counted under: however it is written, "ANA  garcia" is Ana García. */
const sameName = (name: string): string =>
  pupilName(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/**
 * The short name an assignment is counted under, for whoever does it under `name`. The count is of each
 * name and not of the device: on a computer that a class shares, the first attempt of the second to sit
 * down is not the second attempt.
 */
export const keyOf = (task: string, name = ''): string => hashStr(`${task}\n${sameName(name)}`).toString(36);

/** The name typed for the last assignment done here. */
export const keptName = (): string => read().name;

export function keepName(name: string): void {
  write({ ...read(), name: pupilName(name) });
}

/** How many times an assignment was started here under a name. */
export const attemptsOf = (task: string, name = ''): number => read().n[keyOf(task, name)] ?? 0;

/** The games counted since the page was opened: each one is counted once, however many times it is told of. */
const counted = new Set<number>();

/**
 * A game of an assignment is on screen: `nonce` is the mark of that game. Returns which time this is that
 * the assignment was started here under that name. A game is counted when it starts, not when it ends, so
 * that one left half-way is an attempt too; opening the page again starts it again, and is counted again.
 */
export function started(task: string, nonce: number, name = ''): number {
  const kept = read();
  const key = keyOf(task, name);
  const before = kept.n[key] ?? 0;
  if (counted.has(nonce) && before > 0) return before;
  counted.add(nonce);
  const { [key]: _, ...rest } = kept.n;
  const entries = Object.entries(rest).slice(-(TASKS_MAX - 1));
  write({ ...kept, n: { ...Object.fromEntries(entries), [key]: before + 1 } });
  return before + 1;
}

/** The receipt that each game that ended since the page was opened has left here. */
const ended = new Map<number, string>();

/** For the tests: what was counted since the page was opened is forgotten. */
export function forgetCounted(): void {
  counted.clear();
  ended.clear();
}

/** A receipt that was opened here is kept, if what it says is what the game wrote. Returns whether it is kept. */
export function keepReceipt(code: string): boolean {
  if (!decodeReceipt(code)?.sound) return false;
  const kept = read();
  write({ ...kept, got: [...kept.got.filter((c) => c !== code), code].slice(-RECEIPTS_MAX) });
  return true;
}

/**
 * A game of an assignment has ended, and this is its receipt: it is kept with the rest, and the game is
 * written down as ended. Its results are not kept anywhere: if the page is opened again on that game (a
 * phone does it when it comes back from the chat the receipt was sent in), the game would start anew as
 * one more attempt, and its receipt would be gone with the screen that showed it. `doneWith` tells that
 * game apart, and the receipt is with its assignment.
 *
 * It is told as soon as the result is drawn, and not a moment later: whoever starts again at once has
 * that attempt kept all the same. And it may be told again, should the receipt come to say something else
 * (the clock of a game can tick once more after its last answer): a game leaves one receipt, the last it said.
 */
export function finish(nonce: number, code: string): void {
  const kept = read();
  if (!decodeReceipt(code)?.sound) return write({ ...kept, done: nonce });
  const before = ended.get(nonce);
  ended.set(nonce, code);
  write({ ...kept, got: [...kept.got.filter((c) => c !== code && c !== before), code].slice(-RECEIPTS_MAX), done: nonce });
}

/** Whether the game with this mark is the last one of an assignment that ended here. */
export const doneWith = (nonce: number): boolean => read().done === nonce;

export interface KeptReceipt {
  code: string;
  receipt: Receipt;
}

/**
 * The receipts kept here: those of one assignment, or all of them. In the order of a class list: by name,
 * and under each name from its first attempt to its last.
 */
export function receiptsKept(task?: string): KeptReceipt[] {
  const list: KeptReceipt[] = [];
  for (const code of read().got) {
    const receipt = decodeReceipt(code)?.receipt;
    if (receipt && (task == null || receipt.task === task)) list.push({ code, receipt });
  }
  return list.sort((a, b) => a.receipt.name.localeCompare(b.receipt.name, undefined, { sensitivity: 'base' }) || a.receipt.at - b.receipt.at || a.receipt.n - b.receipt.n);
}

/** The assignments some receipts are of: the one with the latest receipt first. */
export function tasksOf(list: readonly KeptReceipt[]): string[] {
  const latest = new Map<string, number>();
  for (const { receipt } of list) latest.set(receipt.task, Math.max(latest.get(receipt.task) ?? 0, receipt.at));
  return [...latest].sort((a, b) => b[1] - a[1]).map(([task]) => task);
}

/** The receipts of an assignment are dropped; every receipt, when none is named. */
export function forgetReceipts(task?: string): void {
  const kept = read();
  write({ ...kept, got: task == null ? [] : kept.got.filter((code) => decodeReceipt(code)?.receipt.task !== task) });
}
