/**
 * Type-ins: which short forms each thing in the game answers to when its name is typed. The rule gives
 * every name of several words its initials and the data adds a few by hand; on top of that come what the
 * game ships with (`typeins.default.json`) and what the player chooses in the settings.
 *
 * A thing goes by its id ("US-NH", "ES", "cj64n2v", "r:volga"); the name of its capital, by `capKey` of it.
 */
import { MAX_PATTERN, key, looksLikePattern, patternOf, shortFormsOf, type Answerable, type ShortEdit } from './text';
import shipped from './typeins.default.json';
import { MAX_FORMS, chosenTypeins, cleanTypeins, entry, formKey, isObject, tidyForm, type TypeinChoice, type TypeinFile, type TypeinSettings, type Typeins } from './typeinPrefs';

export { MAX_FORMS, MAX_LENGTH, cleanTypeins, formKey, setTypeins, tidyForm, type TypeinFile, type TypeinSettings, type Typeins } from './typeinPrefs';
export { MAX_PATTERN };

const SHIPPED_FILE: Record<string, unknown> = isObject(shipped) ? shipped : {};
/** What the game ships with. It is read like a file exported from the settings, so that one can take its place. */
export const SHIPPED: Typeins = cleanTypeins(isObject(SHIPPED_FILE.edits) ? SHIPPED_FILE.edits : SHIPPED_FILE);
export const SHIPPED_AUTO: boolean = typeof SHIPPED_FILE.auto === 'boolean' ? SHIPPED_FILE.auto : true;

const has = (list: readonly string[] | undefined, k: string): boolean => !!list?.some((x) => formKey(x) === k);
const without = (list: readonly string[] | undefined, k: string): string[] => (list ?? []).filter((x) => formKey(x) !== k);

/**
 * The settings in a file: one exported from the settings screen, a backup of the progress (it carries
 * them too), or the choices alone. Null when the file is something else. What the game ships with anyway
 * is left out: only what differs from it is a choice of the player's.
 */
export function readTypeinFile(x: unknown): { edits: Typeins; auto?: boolean } | null {
  if (!isObject(x)) return null;
  let raw: unknown;
  let auto: unknown;
  if (x.kind === 'typeins' || isObject(x.edits)) {
    raw = x.edits;
    auto = x.auto;
  } else if ('stats' in x || 'sessions' in x || 'app' in x) {
    if (!isObject(x.typeins)) return null;
    raw = x.typeins;
    // A backup keeps "never chosen" as null: as the game ships.
    auto = typeof x.typeinAuto === 'boolean' ? x.typeinAuto : SHIPPED_AUTO;
  } else {
    raw = x;
    if (!Object.keys(cleanTypeins(raw)).length) return null;
  }
  const edits: Typeins = {};
  for (const [id, e] of Object.entries(cleanTypeins(raw))) {
    const s = SHIPPED[id];
    const add = (e.add ?? []).filter((a) => !has(s?.add, formKey(a)));
    const off = (e.off ?? []).filter((k) => !has(s?.off, k));
    const rule = e.rule !== false || s?.rule === false;
    if (add.length || off.length || !rule) edits[id] = entry(add, off, rule);
  }
  return { edits, ...(typeof auto === 'boolean' ? { auto } : {}) };
}

let seen: TypeinChoice | null = null;
let mine: TypeinSettings = { auto: SHIPPED_AUTO, edits: {} };

/** The settings in force: the player's choices (`typeinPrefs.ts`), with "as the game ships" spelt out. */
export function getTypeins(): TypeinSettings {
  const chosen = chosenTypeins();
  if (chosen !== seen) {
    seen = chosen;
    mine = { auto: chosen.auto ?? SHIPPED_AUTO, edits: chosen.edits };
  }
  return mine;
}

/** The key of the capital of a thing: its name is one more thing to type, with short forms of its own. */
export const capKey = (id: string): string => `cap:${id}`;

/**
 * The say on one thing once the player's choices are laid over what ships: what the matcher takes.
 * Undefined when nothing is said about it.
 */
export function editOf(id: string, settings: TypeinSettings = getTypeins()): ShortEdit | undefined {
  const s = SHIPPED[id];
  const u = settings.edits[id];
  const rule = ruleOf(id, settings);
  if (!s && !u) return rule ? undefined : { rule: false };
  // What the player adds comes back even if the game ships without it, and the other way round.
  const off = [...(s?.off ?? []).filter((k) => !has(u?.add, k)), ...(u?.off ?? [])];
  const add = [...(s?.add ?? []).filter((a) => !has(u?.off, formKey(a))), ...(u?.add ?? [])];
  return entry(add, off, rule);
}

/**
 * Whether a thing gets the initials of its names unasked: where the settings give them at all, and unless
 * the game ships it with a list of its own (`rule: false`), which then says all there is to say.
 */
export function ruleOf(id: string, settings: TypeinSettings = getTypeins()): boolean {
  return settings.auto && SHIPPED[id]?.rule !== false && settings.edits[id]?.rule !== false;
}

/** Whether a short form of a thing is in force: for whoever gives it as an example. */
export function inForce(id: string, form: string, settings: TypeinSettings = getTypeins()): boolean {
  const k = formKey(form);
  const e = editOf(id, settings);
  if (has(e?.add, k)) return true;
  return e?.rule !== false && !has(e?.off, k);
}

/** The capital of something as a thing to type, under the id of what it is the capital of. */
export function capitalAnswers(it: { id: string; capital?: string[] }, settings: TypeinSettings = getTypeins()): Answerable | null {
  if (!it.capital?.length) return null;
  return { id: it.id, answers: it.capital, proper: it.capital, short: editOf(capKey(it.id), settings) };
}

/** One short form of a thing, as the settings show it. */
export interface Chip {
  key: string;
  text: string;
  /** Spelt by the initials of a name · written in the data or shipped with the game · added by the player. */
  from: 'initials' | 'data' | 'own';
  on: boolean;
  /** Whether it counts when the player has said nothing about it. */
  usual: boolean;
  /** A pattern rather than a spelling: `text` is for the game to read, and the settings show what it takes (`spellingsOf`). */
  pattern?: boolean;
}

/**
 * Every short form of a thing, in force or not: what the settings list for it. `id` is the one its choices
 * are kept under, which for a capital is not the id of the thing.
 */
export function chipsOf(it: Answerable, id: string, settings: TypeinSettings = getTypeins()): Chip[] {
  const s = SHIPPED[id];
  const u = settings.edits[id];
  const out: Chip[] = [];
  const rule = ruleOf(id, settings);
  const push = (k: string, text: string, from: Chip['from'], usual: boolean) => {
    if (!k || out.some((c) => c.key === k)) return;
    out.push({ key: k, text, from, usual, on: has(u?.add, k) || (usual && !has(u?.off, k)), ...(looksLikePattern(text) ? { pattern: true } : {}) });
  };
  // Initials that the game ships with all the same ("NH" where the rule is off) are as usual as any.
  for (const f of shortFormsOf(it)) push(f.key, f.text, f.from, has(s?.add, f.key) || (!has(s?.off, f.key) && (f.from === 'data' || rule)));
  for (const raw of s?.add ?? []) push(formKey(raw), raw, 'data', true);
  for (const raw of u?.add ?? []) push(formKey(raw), raw, 'own', false);
  return out;
}

function withEntry(edits: Typeins, id: string, add: string[], off: string[]): Typeins {
  const next = { ...edits };
  // A choice read from a file may say that the thing gets no initials unasked: that stays.
  const rule = edits[id]?.rule !== false;
  if (add.length || off.length || !rule) next[id] = entry(add, off, rule);
  else delete next[id];
  return next;
}

/** The player's choices after one short form of a thing is switched on or off. */
export function switchForm(edits: Typeins, id: string, chip: Chip, on: boolean): Typeins {
  const u = edits[id];
  const add = without(u?.add, chip.key);
  const off = without(u?.off, chip.key);
  // Only what differs from the way it comes is written down.
  if (on && !chip.usual) add.push(chip.text);
  if (!on && chip.usual) off.push(chip.key);
  return withEntry(edits, id, add, off);
}

/** Why a short form was not added: nothing to add · it is one of its names already · it has it · it has too many · a pattern that cannot be read. */
export type AddError = 'empty' | 'name' | 'have' | 'full' | 'pattern';

/**
 * The player's choices after a short form is added to a thing. One that it has but is switched off is
 * switched on instead.
 */
export function addForm(edits: Typeins, id: string, text: string, it: Answerable, settings: TypeinSettings = getTypeins()): { edits: Typeins } | { error: AddError } {
  const typed = tidyForm(text);
  const pattern = looksLikePattern(typed);
  if (pattern && !patternOf(typed)) return { error: typed.replace(/^\s*[rc]\s*:/i, '') ? 'pattern' : 'empty' };
  // A few letters typed without a thought for the Shift key are a code: "ma" is kept as "MA".
  const s = /^[\p{Ll}\d.]{1,5}$/u.test(typed) ? typed.toUpperCase() : typed;
  const k = formKey(s);
  if (!k) return { error: 'empty' };
  const known = chipsOf(it, id, { auto: settings.auto, edits }).find((c) => c.key === k);
  if (known) return known.on ? { error: 'have' } : { edits: switchForm(edits, id, known, true) };
  if (!pattern && it.answers.some((a) => a && key(a) === k)) return { error: 'name' };
  const u = edits[id];
  if ((u?.add?.length ?? 0) >= MAX_FORMS) return { error: 'full' };
  return { edits: withEntry(edits, id, [...(u?.add ?? []), s], u?.off ?? []) };
}

/** The player's choices without any about these things. */
export function resetForms(edits: Typeins, ids: readonly string[]): Typeins {
  const gone = new Set(ids);
  return Object.fromEntries(Object.entries(edits).filter(([id]) => !gone.has(id)));
}

/**
 * The settings as a file. It holds what ships with the game as well as the player's choices, so that it
 * says the same in any copy of the game, and can be the file the game ships with.
 */
export function typeinFile(settings: TypeinSettings = getTypeins()): TypeinFile {
  const edits: Typeins = {};
  for (const id of [...new Set([...Object.keys(SHIPPED), ...Object.keys(settings.edits)])].sort()) {
    const e = editOf(id, { auto: true, edits: settings.edits });
    if (e?.add?.length || e?.off?.length || e?.rule === false) edits[id] = entry(e.add ?? [], e.off ?? [], e.rule !== false);
  }
  return { app: 'regionle', kind: 'typeins', version: 1, auto: settings.auto, edits };
}
