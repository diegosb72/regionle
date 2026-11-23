/**
 * Homework with a receipt. Whoever teaches chooses a map, a game and its rules, and gets a link:
 *
 *   #/tarea/<title>/<section>/<map>[/<game>[/<cities>]][/<options>]
 *   #/tarea/<title>/lista/<code>[/<game>][/<options>]
 *
 * What follows the title is the game as the address of a box in another page writes it (embed.ts), with
 * the options of whoever set it: every pupil plays the same game by the same rules. The pupil types a
 * name, plays, and at the end gets a receipt, which is another link:
 *
 *   #/justificante/<what it says>.<check figure>
 *
 * It carries the assignment, the name, how it went and when, and a figure worked out from all of that.
 * The game has no server: nobody keeps the results, they travel inside the link. The check figure gives
 * away a link that was cut short or touched up by hand. It is no proof against whoever reads this file,
 * and the game says so wherever a receipt is read.
 */
import { gradeOf, scoreOf } from '../games/quiz';
import { fromBase64Url, toBase64Url } from './challenge';
import { embedPath, parseEmbed, type EmbedSource, type EmbedWhat } from './embed';
import { L, fmtDay } from './i18n';
import { factName, formatName, modeNameIn } from './modes';
import { EMBED_PATH, RECEIPT_PATH, TASK_PATH, linkTo } from './routes';
import { FORMAT_MODES, asksByFlag, factOf, formatOfGame, turnsOutlines } from './rules';
import { CLICKED, clockText, livesText, rulesOfGame, rulesText } from './ruleset';
import type { Format, GameConfig, Opts } from './store';
import { fmtTime, hashStr, nf, today } from './text';
import type { Mode } from './types';

export const TASK_TITLE_MAX = 60;
export const TASK_NAME_MAX = 40;

/** What an address has where the title would be, when the assignment has none. */
const NO_TITLE = '-';

/** A line of text as it is kept: no line breaks, single spaces, no more than so many characters. */
const oneLine = (text: string, max: number): string => [...text.replace(/\s+/g, ' ').trim()].slice(0, max).join('').trim();

/** The title of an assignment as it travels: «Tema 4: las comunidades». */
export const taskTitle = (text: string): string => {
  const title = oneLine(text, TASK_TITLE_MAX);
  return title === NO_TITLE ? '' : title;
};

/** The name of whoever does an assignment, as the receipt carries it. */
export const pupilName = (text: string): string => oneLine(text, TASK_NAME_MAX);

/**
 * The games that can be set: those that ask one thing after another and end with a tally, whose rules
 * can be chosen (lib/ruleset.ts). Of the rest, the game does not know how to say how they went in a line.
 */
export const canTask = (mode: Mode): boolean => FORMAT_MODES.includes(mode);

/** What follows `tarea/` in the address of an assignment: its title, and its game as a box in another page writes it. */
export function taskPath(title: string, source: EmbedSource, opts: Opts): string {
  const game = embedPath(source, opts).slice(EMBED_PATH.length + 1);
  return `${encodeURIComponent(taskTitle(title)) || NO_TITLE}/${game}`;
}

/** The whole address of an assignment, to be sent to a class. */
export const taskUrl = (path: string, href?: string): string => linkTo(`${TASK_PATH}/${path}`, href);

export interface Task {
  title: string;
  /** The game, read as the address of a box in another page is: `embedGame` makes it a game on the atlas. */
  what: EmbedWhat;
  /**
   * What follows `tarea/`, as the game writes it: the name an assignment goes by, in the receipts and where
   * its attempts are counted. A link that reached a pupil written another way is the same assignment.
   */
  path: string;
}

function decoded(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** What follows `tarea/` in an address, read; null when there is no game in it. */
export function parseTask(path: string): Task | null {
  const cut = path.indexOf('/');
  if (cut < 1) return null;
  const what = parseEmbed(path.slice(cut + 1));
  if (!what) return null;
  const title = taskTitle(decoded(path.slice(0, cut)));
  const source: EmbedSource = what.kind === 'list' ? { list: what.code, ...(what.mode ? { mode: what.mode } : {}) } : { section: what.section, link: what.link };
  return { title, what, path: taskPath(title, source, what.opts) };
}

/**
 * A game that is set, in words: «Señalar · todas las preguntas · 1 intento, sin pistas», «Capitales ·
 * Contrarreloj · 2 minutos». What decides how hard it is, and nothing else: whoever gets it knows what is
 * asked of them, and whoever reads its receipt, what was done.
 */
export function gameLine(cfg: Pick<GameConfig, 'section' | 'mode' | 'opts' | 'only' | 'list'>): string {
  const format = formatOfGame(cfg);
  const rules = rulesOfGame(cfg);
  const { length, answer, turned, flagLook, pinBy } = cfg.opts;
  /** What is asked of each country, where the game is about one thing said of them. */
  const fact = cfg.mode === 'fact' ? factOf(cfg.section, cfg.mode, cfg.opts) : null;
  return [
    modeNameIn(cfg.section, cfg.mode),
    fact ? factName(fact).toLowerCase() : '',
    format === 'normal' ? '' : formatName(format),
    format === 'timed' ? clockText(rules.clock) : format === 'lives' ? livesText(rules.lives) : length === 'endless' ? L('sin fin', 'endless') : length === 'all' ? L('todas las preguntas', 'every question') : L(`${length} preguntas`, `${length} questions`),
    answer === 'type' && !CLICKED.includes(cfg.mode) ? L('escribiendo', 'typing') : '',
    turned && turnsOutlines(cfg.section, cfg.mode) ? L('siluetas giradas', 'turned outlines') : '',
    asksByFlag(cfg.section, cfg.mode, { pinBy }) ? { plain: '', grey: L('banderas en gris', 'flags in grey'), blur: L('banderas desenfocadas', 'blurred flags') }[flagLook] : '',
    format === 'normal' ? rulesText(rules) : '',
  ]
    .filter(Boolean)
    .join(' · ');
}

/** What a receipt is worth, said wherever one is made or read: the game keeps nothing, and a check figure is not a lock. */
export const receiptCaveat = (): string =>
  L(
    'Regionle no tiene servidor: el resultado no se guarda en ningún sitio, viaja dentro del enlace. La cifra de control descubre un enlace cortado o retocado a mano, pero no es a prueba de trampas: quien sepa programar puede fabricar un justificante. Sirve para ver quién ha hecho la tarea, no para poner la nota de un examen.',
    'Regionle has no server: the result is kept nowhere, it travels inside the link. The check figure gives away a link that was cut or touched up by hand, but it is not cheat-proof: whoever can program can make a receipt up. It is good for seeing who did the homework, not for marking an exam.',
  );

/** How a game that was set went, as the game counts it. `total` is 0 where there is no set number of questions. */
export interface TaskTally {
  ok: number;
  warn: number;
  bad: number;
  total: number;
  ms: number;
}

export interface Receipt {
  /** The assignment: what follows `tarea/` in its address. */
  task: string;
  name: string;
  ok: number;
  warn: number;
  bad: number;
  /** The questions the game had; 0 where it has no set number (endless, against the clock, until the lives run out). */
  total: number;
  /** Seconds it took. */
  secs: number;
  /** When it ended, in minutes since 1970. */
  at: number;
  /** Which time this was that the assignment was started on the device it was done on. */
  n: number;
}

/** The receipt of a game that has just ended. */
export function receiptOf(task: string, name: string, tally: TaskTally, n: number, now: number = Date.now()): Receipt {
  return { task, name: pupilName(name), ok: tally.ok, warn: tally.warn, bad: tally.bad, total: tally.total, secs: Math.floor(tally.ms / 1000), at: Math.floor(now / 60000), n };
}

/** Bumped when what a receipt carries changes: one of another version is not read as if it were of this one. */
const VERSION = 1;

/** The check figure of what a receipt says. It is no secret: it gives away a slip or a retouch by hand, nothing more. */
export const checkOf = (payload: string): string => hashStr(`regionle justificante ${VERSION} ${payload}`).toString(36);

/** What follows `justificante/` in the address of a receipt. */
export function encodeReceipt(r: Receipt): string {
  const payload = toBase64Url(JSON.stringify([VERSION, r.task, r.name, r.ok, r.warn, r.bad, r.total, r.secs, r.at, r.n]));
  return `${payload}.${checkOf(payload)}`;
}

/** The whole address of a receipt, to be sent to whoever set the assignment. */
export const receiptUrl = (code: string, href?: string): string => linkTo(`${RECEIPT_PATH}/${code}`, href);

const whole = (x: unknown, min: number, max: number): x is number => typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/**
 * A receipt read from its address. Null when it cannot be read at all; `sound` says whether its check
 * figure is the one of what it says: where it is not, the link was cut or changed after the game made it.
 */
export function decodeReceipt(code: string): { receipt: Receipt; sound: boolean } | null {
  const dot = code.lastIndexOf('.');
  const payload = dot < 0 ? code : code.slice(0, dot);
  let raw: unknown;
  try {
    raw = JSON.parse(fromBase64Url(payload));
  } catch {
    return null;
  }
  if (!Array.isArray(raw) || raw[0] !== VERSION || raw.length !== 10) return null;
  const [, task, name, ok, warn, bad, total, secs, at, n] = raw as unknown[];
  if (typeof task !== 'string' || !task || task.length > 4000 || typeof name !== 'string' || !name || pupilName(name) !== name) return null;
  if (!whole(ok, 0, 9999) || !whole(warn, 0, 9999) || !whole(bad, 0, 9999) || !whole(total, 0, 9999)) return null;
  if (total > 0 && ok + warn + bad > total) return null;
  if (!whole(secs, 0, 360000) || !whole(at, 1, 2 ** 31) || !whole(n, 1, 9999)) return null;
  return { receipt: { task, name, ok, warn, bad, total, secs, at, n }, sound: dot > 0 && code.slice(dot + 1) === checkOf(payload) };
}

/** The figures of a receipt, as its format reads them. */
export interface Outcome {
  /** How many questions were answered. */
  asked: number;
  /** It was left before its last question: what was not answered counts against it. */
  short: boolean;
  /**
   * Share of the score, over every question the game had: an assignment left at its second question is not
   * one done in full, whatever the game told whoever left it.
   */
  score: number;
  /** The mark of an exam, out of ten: only what was right the first time counts, and what was left blank is wrong. */
  grade: number;
  /** Right answers, with help or without: what a time attack and a survival are counted by. */
  hits: number;
}

export function outcomeOf(r: Pick<Receipt, 'ok' | 'warn' | 'bad' | 'total'>): Outcome {
  const asked = r.ok + r.warn + r.bad;
  const over = r.total || asked;
  return { asked, short: r.total > 0 && asked < r.total, score: scoreOf(r.ok, r.warn, over), grade: gradeOf(r.ok, over), hits: r.ok + r.warn };
}

/** How it went, in the few words that head a receipt: «83 %», «Nota: 7,5», «12 aciertos». */
export function headline(r: Receipt, format: Format): string {
  const o = outcomeOf(r);
  if (format === 'exam') return L(`Nota: ${nf(o.grade, 1)}`, `Mark: ${nf(o.grade, 1)} out of 10`);
  if (format === 'timed' || format === 'lives') return L(`${nf(o.hits)} ${o.hits === 1 ? 'acierto' : 'aciertos'}`, `${nf(o.hits)} right`);
  return `${o.score}\u00a0%`;
}

/** How many questions were answered, of how many: «12 de 12», or «7» where the game has no set number. */
export function answered(r: Receipt): string {
  const o = outcomeOf(r);
  return r.total > 0 ? L(`${nf(o.asked)} de ${nf(r.total)}`, `${nf(o.asked)} of ${nf(r.total)}`) : nf(o.asked);
}

const two = (n: number): string => String(n).padStart(2, '0');

/** When a receipt was made, in the time of whoever reads it: «15 de noviembre de 2026, 18:32». */
export function receiptWhen(at: number): string {
  const date = new Date(at * 60000);
  return `${fmtDay(today(date), true)}, ${two(date.getHours())}:${two(date.getMinutes())}`;
}

/** What a receipt says after its headline: «respondidas 12 de 12, en 2:05», «3 fallos, en 1:00». */
export function receiptDetail(r: Receipt, format: Format): string {
  const time = fmtTime(r.secs * 1000);
  return [
    format === 'timed' || format === 'lives' ? L(`${nf(r.bad)} ${r.bad === 1 ? 'fallo' : 'fallos'}`, `${nf(r.bad)} ${r.bad === 1 ? 'miss' : 'misses'}`) : L(`respondidas ${answered(r)}`, `${answered(r)} answered`),
    ...(outcomeOf(r).short ? [L('sin terminar', 'not finished')] : []),
    L(`en ${time}`, `in ${time}`),
  ].join(', ');
}

/** A receipt in a line, for the message it is sent with and for the table of whoever set the assignment. */
export const receiptLine = (r: Receipt, format: Format): string => `${headline(r, format)} (${receiptDetail(r, format)})`;

/** A name that starts as a formula does is not taken for one by the spreadsheet it is pasted into. */
const cell = (text: string): string => (/^[=+\-@]/.test(text) ? `'${text}` : text);

/**
 * The receipts of a class as a table that a spreadsheet takes when it is pasted: a line each, tabs between
 * its figures. The result is a number, of the kind its format has: a share, a mark out of ten, right answers.
 */
export function receiptsTable(list: readonly Receipt[], format: Format): string {
  const paced = format === 'timed' || format === 'lives';
  const head = [
    L('Nombre', 'Name'),
    format === 'exam' ? L('Nota', 'Mark') : paced ? L('Aciertos', 'Right') : L('Puntuación (%)', 'Score (%)'),
    L('Respondidas', 'Answered'),
    L('Preguntas', 'Questions'),
    L('A la primera', 'First time'),
    L('Con ayuda', 'With help'),
    L('Fallos', 'Misses'),
    L('Tiempo', 'Time'),
    L('Fecha', 'Date'),
    L('Intento', 'Attempt'),
  ];
  const lines = list.map((r) => {
    const o = outcomeOf(r);
    const date = new Date(r.at * 60000);
    return [
      cell(r.name),
      format === 'exam' ? nf(o.grade, 1) : paced ? o.hits : o.score,
      o.asked,
      r.total || '',
      r.ok,
      r.warn,
      r.bad,
      fmtTime(r.secs * 1000),
      `${today(date)} ${two(date.getHours())}:${two(date.getMinutes())}`,
      r.n,
    ].join('\t');
  });
  return [head.join('\t'), ...lines].join('\n');
}
