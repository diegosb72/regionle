/**
 * The player's side of the type-ins: what the settings keep, how it is read from a file or from what was
 * saved, and the choices in force. Nothing here needs the list the game ships with, which is heavy: this
 * is all the saved state takes, and `typeins.ts` lays these choices over that list wherever a name is typed.
 */
import { MAX_PATTERN, key, looksLikePattern, patternOf, type ShortEdit } from './text';

/**
 * The choices for each thing that has any, by id: what is added, what is taken away, and `rule: false`
 * where the initials of its names are not to be taken unasked.
 */
export type Typeins = Record<string, ShortEdit>;

/** The settings: the choices, and whether names of several words get their initials unasked. */
export interface TypeinSettings {
  auto: boolean;
  edits: Typeins;
}

/** A file with the settings: what the screen exports, and what the game ships with. */
export interface TypeinFile {
  app: 'regionle';
  kind: 'typeins';
  version: 1;
  auto: boolean;
  edits: Typeins;
}

/** Most short forms one thing can be given, and the longest. */
export const MAX_FORMS = 24;
export const MAX_LENGTH = 40;

export const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * A short form as it is kept: one line, single spaces, no longer than it may be. A pattern is kept as
 * `patternOf` writes it; one that cannot be read comes back as it was typed, for whoever asks to say so.
 */
export function tidyForm(text: string): string {
  if (looksLikePattern(text)) return patternOf(text) ?? text.replace(/\s+/g, '').slice(0, MAX_PATTERN + 2);
  return text.replace(/\s+/g, ' ').trim().slice(0, MAX_LENGTH).trim();
}

/**
 * What tells one short form from another: its letters, whatever their case and the dots between them, or
 * the whole of its text when it is a pattern. Empty for what is neither.
 */
export function formKey(text: string): string {
  return looksLikePattern(text) ? (patternOf(text) ?? '') : key(text);
}

function cleanList(x: unknown, keep: (s: string) => string): string[] {
  if (!Array.isArray(x)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of x) {
    if (typeof raw !== 'string') continue;
    const s = tidyForm(raw);
    const k = formKey(s);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(keep(s));
    if (out.length >= MAX_FORMS) break;
  }
  return out;
}

export const entry = (add: string[], off: string[], rule = true): ShortEdit => ({ ...(add.length ? { add } : {}), ...(off.length ? { off } : {}), ...(rule ? {} : { rule: false }) });

/** Choices read from a file or from what was saved, with anything that is not one left out. */
export function cleanTypeins(x: unknown): Typeins {
  const out: Typeins = {};
  if (!isObject(x)) return out;
  for (const [id, v] of Object.entries(x)) {
    if (!id || id.length > 80 || !isObject(v)) continue;
    const add = cleanList(v.add, (s) => s);
    // Something cannot be both added and taken away: what is added stays.
    const off = cleanList(v.off, formKey).filter((k) => !add.some((a) => formKey(a) === k));
    const rule = v.rule !== false;
    if (add.length || off.length || !rule) out[id] = entry(add, off, rule);
  }
  return out;
}

/**
 * The choices in force are module state, as the language is: decks are built in many places, and each
 * thing takes the choices that stand when it is built. `auto` null: as the game ships.
 */
export interface TypeinChoice {
  auto: boolean | null;
  edits: Typeins;
}

let chosen: TypeinChoice = { auto: null, edits: {} };

/** `auto` null or missing: as the game ships. */
export function setTypeins(next: { auto?: boolean | null; edits?: Typeins }): void {
  chosen = { auto: next.auto ?? null, edits: next.edits ?? {} };
}

/** The choices as they were set: a new object every time they change, the same one until then. */
export function chosenTypeins(): TypeinChoice {
  return chosen;
}
