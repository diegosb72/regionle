/**
 * What a diploma says: what was completed, in which game, how it went and when. Apart from its sheet, so
 * that it can be told without a screen. The name on it is not here: it is written when the diploma is
 * made and is kept nowhere.
 */
import { L } from '../lib/i18n';
import { SECTIONS, formatName, modeNameIn } from '../lib/modes';
import { FORMAT_MODES } from '../lib/rules';
import type { Format, GameConfig } from '../lib/store';
import { fmtTime, nf } from '../lib/text';
import { scoreOf } from './quiz';
import type { Tally } from './resultCard';

/** The score, out of a hundred, from which a game earns a diploma: half of it right. */
export const DIPLOMA_FROM = 50;
/** The longest name a diploma takes: a full name with both surnames fits. */
export const DIPLOMA_NAME_MAX = 60;

/** A game that asks only what was missed, or what is due today, has not gone through its map. */
const partial = (game: GameConfig): boolean => !!game.review || (!!game.only && !game.list);

/** Whether the result of a game earns a diploma. */
export function earnsDiploma(game: GameConfig | null | undefined, count: Tally): boolean {
  const total = count.ok + count.warn + count.bad;
  return !!game && !partial(game) && total > 0 && scoreOf(count.ok, count.warn, total) >= DIPLOMA_FROM;
}

/** How a game was played, where that can be chosen: against the clock, with lives, as an exam. */
export const formatOf = (game: GameConfig): Format => (FORMAT_MODES.includes(game.mode) && !game.challenge && !partial(game) ? (game.opts.format ?? 'normal') : 'normal');

export interface DiplomaText {
  heading: string;
  /** "Este diploma acredita que", over the name. */
  lead: string;
  /** "ha completado", under it. */
  did: string;
  /** The map: "España · comunidades autónomas". With no map to name, the game. */
  where: string;
  /** The game: "Regiones · Señalar", and how it was played when that was not the usual way. */
  what: string;
  /** "97 %", for the seal. */
  score: string;
  /** "18 de 19 a la primera", and after it what else there is to say: the answers with help, the time. */
  result: string[];
  day: string;
  /** What is written under the lines of the date and of the signature. */
  dated: string;
  sign: string;
  site: string;
}

/** `map` is the title of the map that was played, if the game has one; `day` the day, written out. */
export function diplomaOf(game: GameConfig, map: string | undefined, count: Tally, ms: number | undefined, day: string, site: string): DiplomaText {
  const total = count.ok + count.warn + count.bad;
  const section = SECTIONS[game.section].name;
  const mode = modeNameIn(game.section, game.mode);
  const format = formatOf(game);
  const how = format === 'normal' ? [] : [formatName(format)];
  const result = [L(`${nf(count.ok)} de ${nf(total)} a la primera`, `${nf(count.ok)} of ${nf(total)} right first time`)];
  if (count.warn > 0) result.push(L(`${nf(count.warn)} con ayuda`, `${nf(count.warn)} with help`));
  if (ms != null) result.push(L(`en ${fmtTime(ms)}`, `in ${fmtTime(ms)}`));
  return {
    heading: L('Diploma', 'Diploma'),
    lead: L('Este diploma acredita que', 'This is to certify that'),
    did: L('ha completado', 'has completed'),
    where: map || mode,
    what: (map ? [section, mode, ...how] : [section, ...how]).join(' · '),
    score: `${nf(scoreOf(count.ok, count.warn, total))} %`,
    result,
    day,
    dated: L('Fecha', 'Date'),
    sign: L('Firma', 'Signature'),
    site,
  };
}

/** The name as the diploma takes it: no spaces at the ends, none doubled, and no longer than it has room for. */
export const diplomaName = (typed: string): string => typed.replace(/\s+/g, ' ').trim().slice(0, DIPLOMA_NAME_MAX).trim();

/** How much a line of the diploma has to shrink to fit: 0 not at all, 1 a little, 2 a lot. */
export const tightness = (text: string, room: number): 0 | 1 | 2 => (text.length > room * 1.5 ? 2 : text.length > room ? 1 : 0);
