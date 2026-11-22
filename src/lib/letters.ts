/**
 * The letters the word games are played with: the alphabet of each language, and which of its letters
 * stands for each character of a name. Shared by the hangman (lib/hangman.ts) and the word search
 * (lib/wordsearch.ts).
 */
import type { Lang } from './i18n';
import { fold } from './text';

const AZ = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** The letters there are: the alphabet of the language. The Spanish one has the Ñ, after the N. */
export const lettersOf = (lang: Lang): string[] => [...(lang === 'es' ? AZ.replace('N', 'NÑ') : AZ)];

/**
 * The letter that stands for a character: its own without its accent («Á» is an A, «ü» a U, «ł» an L).
 * The Ñ is a letter of its own in Spanish, and an N in English. Nothing for what no single letter of the
 * alphabet stands for (a hyphen, a figure, «ß»).
 */
export function letterOf(ch: string, lang: Lang): string {
  if (lang === 'es' && (ch === 'ñ' || ch === 'Ñ')) return 'Ñ';
  const plain = fold(ch);
  return /^[a-z]$/.test(plain) ? plain.toUpperCase() : '';
}
