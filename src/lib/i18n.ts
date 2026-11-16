/** Interface language. Texts are written inline in both languages: `L('Hola', 'Hello')`. */
import type { Capital, Level, Named } from './types';

export type Lang = 'es' | 'en';

let lang: Lang = 'es';

export function getLang(): Lang {
  return lang;
}

/** Changes the language; the caller remounts the interface so that every text is read again. */
export function setLang(next: Lang): void {
  lang = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

/** The text for the current language. */
export function L(es: string, en: string): string {
  return lang === 'en' ? en : es;
}

/** Name of a country or place in the current language. */
export function nm(n: Named): string {
  return lang === 'en' ? (n.en ?? n.es) : n.es;
}

export function capName(c: Capital): string {
  return lang === 'en' ? c.en : c.es;
}

/** Day and month spelled out: "16 de noviembre" · "16 November". */
export function fmtDay(date: string, withYear = false): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', ...(withYear ? { year: 'numeric' } : {}) }).format(dt);
}

export function fmtWeekday(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  return new Intl.DateTimeFormat(lang === 'en' ? 'en-GB' : 'es-ES', { weekday: 'long' }).format(new Date(y, m - 1, d));
}

/** "provinces" → "province": the English singular of a level, which the data only has in the plural. */
export function singularEn(plural: string): string {
  const words = plural.split(' ');
  const last = words[words.length - 1];
  const one = /ies$/.test(last) ? last.replace(/ies$/, 'y') : /(ch|sh|ss|x)es$/.test(last) ? last.replace(/es$/, '') : last.replace(/s$/, '');
  return [...words.slice(0, -1), one].join(' ');
}

/** How the divisions of a level are called, one and many. */
export function levelNoun(l: Level): { one: string; many: string } {
  return lang === 'en' ? { one: singularEn(l.en), many: l.en } : { one: l.sg, many: l.es };
}

/** The browser's language when the player has not chosen one: Spanish unless it asks for English first. */
export function browserLang(): Lang {
  if (typeof navigator === 'undefined') return 'es';
  for (const tag of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const two = String(tag || '').slice(0, 2).toLowerCase();
    if (two === 'es') return 'es';
    if (two === 'en') return 'en';
  }
  return 'es';
}

/** Whole numbers with the separators of the language. */
export function fmtInt(n: number): string {
  return new Intl.NumberFormat(lang === 'en' ? 'en-GB' : 'es-ES', { useGrouping: 'always' } as Intl.NumberFormatOptions).format(Math.round(n));
}
