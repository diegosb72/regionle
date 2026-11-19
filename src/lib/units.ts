/**
 * The unit distances are told in: kilometres, or miles for whoever asks for them in the settings.
 * Everything is worked out and kept in kilometres (answers, records, what counts as right); only what is
 * shown, and what is offered to choose from, is put in the unit of the player.
 *
 * Module state read by every text when it is drawn, like the language: it is set before anything renders,
 * and the screen is drawn again when it changes.
 */
import { L } from './i18n';

export type Units = 'km' | 'mi';

let units: Units = 'km';

export function getUnits(): Units {
  return units;
}

export function setUnits(next: Units): void {
  units = next;
}

/** The international mile, in kilometres. */
export const KM_PER_MILE = 1.609344;
/** A square mile, in km². */
export const KM2_PER_SQ_MILE = KM_PER_MILE * KM_PER_MILE;

/** Kilometres as a number in the unit of the player. */
export const dist = (km: number): number => (units === 'mi' ? km / KM_PER_MILE : km);

/** "km" · "mi" */
export const distUnit = (): string => units;

/** "kilómetros" · "millas" */
export const distWord = (): string => (units === 'mi' ? L('millas', 'miles') : L('kilómetros', 'kilometres'));

/** How many km² the unit surfaces are told in is: 1, or what a square mile holds. */
export const areaScale = (): number => (units === 'mi' ? KM2_PER_SQ_MILE : 1);

/** km² as a number in the unit of the player. */
export const area = (km2: number): number => km2 / areaScale();

/** "km²" · "mi²" ("sq mi" in English). */
export const areaUnit = (): string => (units === 'mi' ? L('mi²', 'sq mi') : 'km²');
