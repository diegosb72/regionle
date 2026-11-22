/**
 * The letters the word games are played with: the alphabet of each language, and which of its letters
 * stands for each character of a name. Shared by the hangman (lib/hangman.ts), the word search
 * (lib/wordsearch.ts) and the crossword (lib/crossword.ts).
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

/**
 * A name as it is written in a grid of letters: its letters alone, in capitals and without accents, with no
 * spaces, hyphens or apostrophes («La Coruña» is LACORUÑA; in English, ACORUNA). Nothing for a name that
 * cannot be written so: one with a figure, or with a letter no letter of the alphabet stands for.
 */
export function gridWord(name: string, lang: Lang): string {
  let word = '';
  for (const ch of name.normalize('NFC')) {
    if (/\p{N}/u.test(ch)) return '';
    if (!/\p{L}/u.test(ch)) continue;
    const letter = letterOf(ch, lang);
    if (!letter) return '';
    word += letter;
  }
  return word;
}
