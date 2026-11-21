/**
 * A game with a date: the challenge of a week (lib/weekly.ts), that of a day of a continent or a country
 * (lib/zones.ts) or that of a special day of the year (lib/occasions.ts). Here, what the game that plays one
 * needs: what it is called, how its result goes on record, and what the results say about it.
 */
import type { DatedResult } from './datedKept';
import { L, nm } from './i18n';
import type { Places } from './sets';
import { useStore, type GameConfig } from './store';
import { editionOn, occasionGame, occasionName, occasionOf } from './occasions';
import { nf } from './text';
import type { Deck, Index } from './types';
import { themeOf, weekGame, weekOf } from './weekly';
import { zoneGame } from './zones';

/**
 * How a game with a date went on record: 'new' when this game is its result; 'short' when it was left
 * before its end, which leaves it to be played; 'old' when a later day of its zone, or a later year of its
 * special day, is already kept; and the score it already had when it had one.
 */
export type Kept = 'new' | 'short' | 'old' | number;

const partName = (part: string, places?: Places): string => (places?.continents[part] ? nm(places.continents[part]) : part);

/** "Reto de la semana · Mundo", "Reto del día · España", "Día de Europa": what the game is called while it is played. Null when it has no date. */
export function datedName(cfg: GameConfig, deck: Deck, places?: Places): string | null {
  if (cfg.occasion) {
    const o = occasionOf(cfg.occasion.id);
    return o ? occasionName(o) : L('Fecha señalada', 'Special day');
  }
  if (cfg.weekly) {
    const { part } = themeOf(cfg.weekly);
    return `${L('Reto de la semana', 'Weekly challenge')} · ${part ? partName(part, places) : L('Mundo', 'World')}`;
  }
  if (!cfg.zone) return null;
  const { id } = cfg.zone;
  const country = deck.items[0]?.country;
  return `${L('Reto del día', 'Daily challenge')} · ${id.startsWith('p:') || !country ? partName(id.slice(2), places) : nm(country.n)}`;
}

/**
 * What a game with a date becomes when it is started on a day (`date`) that is no longer its own: the
 * challenge of that week, or of that day in the same zone; and that of a special day whose week is over, the
 * same game for practice. Null when it has no date, when its date is that one, or when its zone has no
 * challenge any more.
 *
 * A game stays in the browser after its day, at the address of the game: a phone brings back the page that
 * was open, and so does the button that goes back. Played as it was, it would go on record for the day before
 * while the first page went on waiting for the one of today.
 */
export function editionNow(cfg: GameConfig, index: Index, date: string): Omit<GameConfig, 'nonce'> | null {
  if (cfg.occasion) {
    const o = occasionOf(cfg.occasion.id);
    const year = o ? editionOn(o, date) : null;
    if (o && year === cfg.occasion.year) return null;
    if (o) return occasionGame(o, year, index, cfg.opts);
    // A day this version knows nothing about: the game it left, as a game like any other.
    const { occasion: _occasion, challenge: _challenge, nonce: _nonce, ...plain } = cfg;
    return plain;
  }
  if (cfg.weekly) return cfg.weekly === weekOf(date) ? null : weekGame(weekOf(date), index, cfg.opts);
  if (cfg.zone) return cfg.zone.date === date ? null : zoneGame(cfg.zone.id, date, index, cfg.opts);
  return null;
}

/**
 * Writes down the result of a game with a date the first time it is played to the end (`whole`), and says
 * how it went. Null when the game has no date, or the result could not be kept.
 */
export function keepDated(cfg: GameConfig, whole: boolean, result: DatedResult): Kept | null {
  const st = useStore.getState();
  if (cfg.occasion) {
    const { id, year } = cfg.occasion;
    const last = st.occasions[id];
    if (last && last.y >= year) return last.y === year ? last.s : 'old';
    if (!whole) return 'short';
    return st.setOccasion(id, year, result) ? 'new' : null;
  }
  if (cfg.weekly) {
    const had = st.weekly[cfg.weekly];
    if (had) return had.s;
    if (!whole) return 'short';
    return st.setWeekly(cfg.weekly, result) ? 'new' : null;
  }
  if (!cfg.zone) return null;
  const { id, date } = cfg.zone;
  const last = st.zones[id];
  if (last && last.d >= date) return last.d === date ? last.s : 'old';
  if (!whole) return 'short';
  return st.setZone(id, date, result) ? 'new' : null;
}

/** What the results say about a game with a date, which goes by its name (`datedName`): "Reto del día · Europa". */
export function datedNote(what: string, cfg: GameConfig, kept: Kept, score: number): string {
  if (kept === 'short') return L(`${what}: lo has dejado antes del final y no se apunta. Puedes empezarlo otra vez.`, `${what}: you left it before the end, so nothing goes on record. You can start it again.`);
  if (kept === 'old' && cfg.occasion) return L(`${what}: era de un año anterior al último que tienes apuntado, así que no cuenta.`, `${what}: it was of a year before the last one you have on record, so it does not count.`);
  if (kept === 'old') return L(`${what}: era de un día anterior al último que tienes apuntado, así que no cuenta.`, `${what}: it was of a day before the last one you have on record, so it does not count.`);
  if (kept !== 'new') return L(`${what}: ya tenías apuntado un ${nf(kept)} %. Cuenta la primera vez que se termina.`, `${what}: you already had ${nf(kept)}% on record. The first time it is finished is the one that counts.`);
  const run = cfg.zone ? (useStore.getState().zones[cfg.zone.id]?.run ?? 0) : 0;
  return (
    L(`${what}: queda apuntado tu ${nf(score)} %.`, `${what}: your ${nf(score)}% is on record.`) +
    (run > 1 ? L(` Llevas ${nf(run)} días seguidos.`, ` That makes ${nf(run)} days in a row.`) : '')
  );
}
