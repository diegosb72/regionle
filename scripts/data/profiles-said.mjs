// What Wikidata and Wikipedia say of a country and of its flag, as a sheet of the game tells it
// (scripts/data/profiles.mjs): what the country is called in full, in the two languages of the game and in
// its own; its motto with what it means; its anthem; and of its flag, the day it was adopted, when it came to
// be as it is, its proportions, its colours and who designed it.
//
// It reads what the workflow "Traer datos" brought (scripts/data/outside.mjs, source `countries`): the
// statements of Wikidata and the box of facts that each page of the two Wikipedias opens with. Neither is
// taken at its word:
//
//   · a name comes from the box of the Wikipedia of its language, which is where it is written as that
//     language says it; Wikidata gives it only where the box does not;
//   · a motto comes from the box of the Spanish Wikipedia, with the translation it gives. What Wikidata
//     calls the motto of a country is as often the slogan of its tourist board;
//   · the day a flag was adopted is the one Wikidata gives when a box names it too, or its year; when the
//     two do not agree, the day both boxes give; and none when nothing agrees;
//   · its proportions are those Wikidata and a box agree on. Wikidata writes them as width to height, the
//     boxes and a sheet as height to width.
//
// Whatever could not be read cleanly is left out: a sheet says less rather than something garbled. What
// was left out, and what the sources disagree on, is told in `notes`, to be read by whoever corrects them
// (scripts/data/profiles-fixes.json).

import { boxFields, calledIn, daysAt, daysIn, plain, tidy } from './wikitext.mjs';

/** The languages a motto is said to be in, as the Spanish Wikipedia names them and the game does not. */
const SAID_IN = {
  latín: 'la',
  sánscrito: 'sa',
  'javanés antiguo': 'kaw',
  setsuana: 'tn',
  sesoto: 'st',
  suazi: 'ss',
  kiñaruanda: 'rw',
  gilbertés: 'gil',
  marshalés: 'mh',
  azerí: 'az',
  jemer: 'km',
  montenegrino: 'cnr',
  'criollo haitiano': 'ht',
  'criollo dominiqués': 'acf',
  bereber: 'ber',
  'noruego bokmål': 'nb',
  noruego: 'nb',
  filipino: 'fil',
  tokelauano: 'tkl',
  tuvaluano: 'tvl',
  bislama: 'bi',
  sango: 'sg',
  suajili: 'sw',
  tigriña: 'ti',
  turcomano: 'tk',
  uzbeko: 'uz',
  tahitiano: 'ty',
  tongano: 'to',
  fiyiano: 'fj',
  samoano: 'sm',
  luxemburgués: 'lb',
  kirundi: 'rn',
  malgache: 'mg',
  amhárico: 'am',
  castellano: 'es',
  ǀxam: 'xam',
};

/**
 * The colours of a flag as a sheet names them, by what Wikidata calls them in English: [Spanish, English],
 * in the order they are told. Shades that only one flag has are told by the colour they are a shade of, and
 * the gold of heraldry is the yellow that everybody sees.
 */
const COLOURS = [
  ['red', 'rojo', 'red'],
  ['old glory red', 'rojo', 'red'],
  ['dark red', 'rojo oscuro', 'dark red'],
  ['crimson', 'carmesí', 'crimson'],
  ['carmine', 'carmín', 'carmine'],
  ['vermilion', 'bermellón', 'vermilion'],
  ['maroon', 'granate', 'maroon'],
  ['orange', 'naranja', 'orange'],
  ['yellow', 'amarillo', 'yellow'],
  ['gold', 'amarillo', 'yellow'],
  ['green', 'verde', 'green'],
  ['saudi green', 'verde', 'green'],
  ['light green', 'verde claro', 'light green'],
  ['emerald', 'verde esmeralda', 'emerald green'],
  ['turquoise', 'turquesa', 'turquoise'],
  ['turquoise blue', 'azul turquesa', 'turquoise blue'],
  ['aquamarine', 'aguamarina', 'aquamarine'],
  ['cyan', 'cian', 'cyan'],
  ['sky blue', 'celeste', 'sky blue'],
  ['light blue', 'azul claro', 'light blue'],
  ['cerulean', 'azul cerúleo', 'cerulean blue'],
  ['azure', 'azul', 'blue'],
  ['blue', 'azul', 'blue'],
  ['israel blue', 'azul', 'blue'],
  ['medium blue', 'azul', 'blue'],
  ['old glory blue', 'azul', 'blue'],
  ['royal blue', 'azul real', 'royal blue'],
  ['cobalt blue', 'azul cobalto', 'cobalt blue'],
  ['ultramarine', 'azul ultramar', 'ultramarine'],
  ['dark blue', 'azul oscuro', 'dark blue'],
  ['navy blue', 'azul marino', 'navy blue'],
  ['brown', 'marrón', 'brown'],
  ['dark brown', 'marrón oscuro', 'dark brown'],
  ['copper', 'cobre', 'copper'],
  ['grey', 'gris', 'grey'],
  ['white', 'blanco', 'white'],
  ['black', 'negro', 'black'],
];

/** A text as it is compared with another: no capitals, no accents, no signs. */
const bare = (text) =>
  String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
/** The first part of the code of a language: `zh` of `zh-hans`. */
const tongue = (code) => String(code).toLowerCase().split('-')[0];
/** A text without the quotes it is written between, nor the comma that was left at either end of it. */
const unquoted = (text) =>
  text
    .trim()
    .replace(/^[«"“”‘'‹,;:\s]+/, '')
    .replace(/[\s,;:]*[»"“”’'›]+\.?$/, '')
    .replace(/[\s,;:]+$/, '')
    .trim();
/** A name with its first letter as a name has it. */
const capital = (text) => (text ? text[0].toLocaleUpperCase('es') + text.slice(1) : text);
const first = (text) => text.split('\n')[0] ?? '';
/** A short text that came out clean: nothing left of how it was written, and no longer than a line of a sheet. */
const fit = (text, max = 120) => !!text && text.length <= max && tidy(text);

const WIKI = (lang, title) => `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_')).replace(/%2F/g, '/').replace(/%3A/g, ':').replace(/%2C/g, ',').replace(/%28/g, '(').replace(/%29/g, ')')}`;

/** A field of a box, by any of the names it has, as it is read. */
const field = (box, ...names) => {
  for (const name of names) {
    const value = box.fields.get(name);
    if (value) return value;
  }
  return '';
};

/** What a box says something is called in full: its first line, when it is a name and no more. */
function nameIn(box, names) {
  const text = first(plain(field(box, ...names)))
    .replace(/\s+(o|u|or)$/i, '')
    .replace(/[,;:]$/, '')
    .trim();
  return fit(text, 100) && !/\d|\(/.test(text) ? text : '';
}

/** The longest of what Wikidata gives in a language: where it gives a short name and a full one, the full one. */
function longest(values, lang) {
  const mine = (values ?? []).filter(([code]) => tongue(code) === lang).map(([, text]) => text.replace(/^(la|le|les|l’|l')\s*/i, (m) => (lang === 'fr' ? '' : m)));
  return mine.sort((a, b) => b.length - a.length)[0] ?? '';
}

/** The proportions a text gives first, as two numbers: «2:3», «7∶10», «10:19». */
function ratioIn(text) {
  const m = /(\d+(?:[.,]\d+)?)\s*[:∶：]\s*(\d+(?:[.,]\d+)?)/.exec(text);
  if (!m) return null;
  const [a, b] = [Number(m[1].replace(',', '.')), Number(m[2].replace(',', '.'))];
  return a > 0 && b > 0 ? [a, b] : null;
}
const gcd = (a, b) => (b ? gcd(b, a % b) : a);
/** Proportions as a sheet writes them: whole numbers where they are, as few decimals as say it where they are not. */
export function ratioText([a, b]) {
  // As many tens as its decimals need, and then the smallest whole numbers that say the same: 0.625:1 is 5:8.
  for (const by of [1, 10, 100, 1000]) {
    const [x, y] = [a * by, b * by];
    if (Math.abs(x - Math.round(x)) > 1e-9 || Math.abs(y - Math.round(y)) > 1e-9) continue;
    const d = gcd(Math.round(x), Math.round(y));
    if (Math.round(x) / d <= 400 && Math.round(y) / d <= 400) return `${Math.round(x) / d}:${Math.round(y) / d}`;
    break;
  }
  const round = (n) => String(Math.round(n * 1000) / 1000);
  return a <= b ? `1:${round(b / a)}` : `${round(a / b)}:1`;
}
const sameRatio = (p, q) => !!p && !!q && Math.abs(p[0] / p[1] - q[0] / q[1]) < 0.004;

/**
 * The motto of a country, as the box of the Spanish Wikipedia tells it: how it is said, in which language,
 * and what it means in Spanish; and what it means in English, where the box of the English one tells the
 * same motto.
 */
function mottoOf(es, en, item, tongues, codes) {
  const langs = [];
  const lines = plain(field(es, 'lema nacional', 'lema'), langs).split('\n').filter(Boolean);
  if (!lines.length || /^(ningun|no tiene|sin lema|no oficial|n\/a|[-—–]$)/i.test(lines[0])) return null;
  let text = lines[0];
  let means = '';
  let saidIn = '';
  // «Слобода или смрт (en macedonio: Libertad o muerte)», all in a line.
  const inline = /^(.+?)\s*\((?:en\s+)?([^:()]{2,40}):\s*(.+?)\)\.?$/i.exec(text);
  if (inline) [, text, saidIn, means] = inline;
  else
    for (const line of lines.slice(1)) {
      // «(en latín: «La virtud es más fuerte unida»)», «(inglés: 'Unidad')», «(«Él lo ha fundado»)».
      const m = /^\(?\s*(?:(?:en\s+)?([^:()«»"“”']{2,60}):)?\s*[«"“‘'‹](.+?)[»"”’'›]\.?\s*\)?\.?$/i.exec(line);
      if (!m) continue;
      [, saidIn = '', means] = m;
      break;
    }
  text = unquoted(text);
  means = unquoted(means);
  if (!fit(text)) return { unread: lines.join(' / ') };
  // Which language it is said in: the one the box names; failing that the one Wikidata gives the same words in.
  const name = bare(saidIn.split(/,| y | e /)[0] ?? '');
  const byName = name && name !== 'espanol' ? (codes.get(name) ?? '') : '';
  const sameWords = (item.motto ?? []).find(([, words]) => bare(words) === bare(text));
  const lang = byName || (sameWords ? tongue(sameWords[0]) : '') || (langs[0] ? tongue(langs[0]) : '') || (!means ? (tongues[0] ?? '') : '');
  const out = { text, ...(lang ? { lang } : {}) };
  if (lang === 'es') out.es = text;
  else if (fit(means)) out.es = means;
  // In English: the last thing the English box says between quotes that is not the motto itself.
  if (lang === 'en') out.en = text;
  else {
    const told = plain(`${field(en, 'national motto', 'motto')}\n${field(en, 'englishmotto')}`);
    if (bare(told).includes(bare(text))) {
      // What is said between quotes: an apostrophe inside a text does not end it.
      const quoted = [...told.matchAll(/"([^"\n]{3,120})"|“([^”\n]{3,120})”|(?<![\p{L}\p{N}])['‘]([^\n]{3,120}?)['’](?![\p{L}\p{N}])/gu)].map((m) => (m[1] ?? m[2] ?? m[3]).trim());
      const alone = first(plain(field(en, 'englishmotto'))).replace(/^\(|\)$/g, '');
      const meant = [unquoted(alone), ...quoted.reverse()].find((q) => q && bare(q) !== bare(text) && /^[\p{Script=Latin}\p{P}\p{Zs}\d]+$/u.test(q) && !bare(text).includes(bare(q)));
      if (meant && fit(meant)) out.en = meant;
    }
  }
  return out;
}

/** The first day that the boxes of both Wikipedias name; failing that, the first year that both name a day of. */
function agreedIn(days) {
  const day = days.en.find((d) => d.length > 4 && days.es.includes(d));
  if (day) return day;
  const year = days.en.map((d) => d.slice(0, 4)).find((y) => days.es.some((d) => d.slice(0, 4) === y));
  return year ?? null;
}

/** The day Wikidata gives, as a sheet writes it: the day when it is known to the day, the year when it is not. */
const dayGiven = ([day, precision]) => (precision >= 11 ? day : day.slice(0, 4));

/**
 * What is said of the flag: the day it was adopted and when it came to be as it is, its proportions, its
 * colours and who designed it. `flown` are the years of the flags the game has of the country before this one.
 */
function flagOf(flag, boxes, names, flown, notes) {
  const out = {};
  if (!flag) return out;
  const told = { en: boxFields(boxes[`en:${flag.pages?.en}`] ?? ''), es: boxFields(boxes[`es:${flag.pages?.es}`] ?? '') };
  const days = { en: daysIn(plain(field(told.en, 'adoption'))), es: daysIn(plain(field(told.es, 'adopción', 'adopcion'))) };
  const named = [...days.en, ...days.es];
  const year = (day) => day.slice(0, 4);
  const given = (flag.since ?? []).map(dayGiven);
  if (given.length === 1) {
    const [day] = given;
    // Where Wikidata knows the year alone and both boxes name the same day of it, that day.
    const sameDay = day.length === 4 ? days.en.find((d) => d.length > 4 && year(d) === day && days.es.includes(d)) : undefined;
    if (sameDay) out.adopted = sameDay;
    else if (named.includes(day) || (day.length > 4 && named.some((d) => d.length === 4 && d === year(day))) || (day.length === 4 && named.some((d) => year(d) === day))) out.adopted = day;
    else if (!named.length) {
      out.adopted = day;
      notes.push(`adopted ${day}: only Wikidata says it`);
    } else {
      // Wikidata and the boxes do not agree: the first day that both boxes give or, failing that, the year both name.
      const both = agreedIn(days);
      if (both) out.adopted = both;
      notes.push(`adopted: Wikidata ${day}, en [${days.en.join(' ')}], es [${days.es.join(' ')}] → ${both ?? 'none'}`);
    }
  } else if (named.length) {
    const both = agreedIn(days);
    if (both) out.adopted = both;
    notes.push(`adopted: Wikidata ${given.length ? given.join(', ') : 'nothing'}, en [${days.en.join(' ')}], es [${days.es.join(' ')}] → ${both ?? 'none'}`);
  }
  // When it came to be as it is. The game has the flags the country flew before: the year the last of them
  // was lowered is the year this one began, and the day of it is the one a box says the flag of today is
  // from or, failing that, the only day of that year that the boxes name. With no earlier flag in the game
  // nothing is said: the sheet would tell of a change and show none.
  const last = Math.max(0, ...flown.map(([, to]) => to).filter((to) => Number.isInteger(to)));
  if (out.adopted && last > Number(year(out.adopted))) {
    const today = (text, mark) => {
      const at = daysAt(text);
      // What is said of each day is what follows it, up to the next one.
      const marked = at.filter(([where, day], i) => day.length > 4 && mark.test(text.slice(where + day.length, Math.min(at[i + 1]?.[0] ?? text.length, where + day.length + 90))));
      return marked[marked.length - 1]?.[1] ?? '';
    };
    const said = [today(plain(field(told.en, 'adoption')), /\b(current|present)\b/i), today(plain(field(told.es, 'adopción', 'adopcion')), /\b(actual|vigente)\b|última modificación/i)].find((day) => day && Math.abs(Number(year(day)) - last) <= 1);
    const those = [...new Set(named.filter((d) => d.length > 4 && Number(year(d)) === last))];
    const changed = said || (those.length === 1 ? those[0] : '');
    if (changed && changed > out.adopted) out.changed = changed;
  }

  // Its proportions, height to width: what Wikidata says, turned over, when a box says the same.
  const wide = (flag.ratio ?? []).map((q) => ratioIn(names[q]?.en ?? names[q]?.es ?? '')).filter(Boolean).map(([w, h]) => [h, w]);
  const inBox = { en: ratioIn(plain(field(told.en, 'proportion'))), es: ratioIn(plain(field(told.es, 'proporción', 'proporcion'))) };
  const agreed = wide.find((r) => sameRatio(r, inBox.en) || sameRatio(r, inBox.es));
  if (agreed) out.ratio = ratioText(agreed);
  else if (sameRatio(inBox.en, inBox.es)) {
    out.ratio = ratioText(inBox.en);
    if (wide.length) notes.push(`ratio: Wikidata ${wide.map(ratioText).join(', ')}, both boxes ${out.ratio}`);
  } else if (wide.length === 1 && !inBox.en && !inBox.es) {
    out.ratio = ratioText(wide[0]);
    notes.push(`ratio ${out.ratio}: only Wikidata says it`);
  } else if (wide.length || inBox.en || inBox.es) notes.push(`ratio: Wikidata ${wide.map(ratioText).join(', ') || 'nothing'}, en ${inBox.en ? ratioText(inBox.en) : '—'}, es ${inBox.es ? ratioText(inBox.es) : '—'} → none`);

  const colours = [];
  for (const q of flag.colours ?? []) {
    const at = COLOURS.findIndex(([name]) => name === (names[q]?.en ?? '').toLowerCase());
    if (at < 0) notes.push(`colour ${q} (${names[q]?.en ?? '?'}) has no name here`);
    else colours.push(at);
  }
  const mine = [...new Set(colours)].sort((a, b) => a - b).map((at) => COLOURS[at]);
  const es = [...new Set(mine.map(([, name]) => name))];
  const en = [...new Set(mine.map(([, , name]) => name))];
  // A flag with an emblem of many colours is not told by a list of them.
  if (es.length > 1 && es.length <= 6 && es.length === en.length) out.colours = { es, en };

  // Who designed it: whoever Wikidata names or, failing that, whoever both boxes name alike. A box alone is
  // not believed: where the two differ, one tells a legend and the other a committee.
  const people = (flag.by ?? []).map((q) => names[q]).filter((n) => n?.es || n?.en);
  if (people.length) out.by = { es: people.map((n) => n.es ?? n.en).join(', '), en: people.map((n) => n.en ?? n.es).join(', ') };
  else {
    const person = (text) => (fit(text, 70) && !/\d|\(|unknown|desconocid|anónim|anonym/i.test(text) ? text : '');
    const en1 = person(plain(field(told.en, 'designer')).replace(/\n/g, ', '));
    const es1 = person(plain(field(told.es, 'diseñador', 'diseñadora')).replace(/\n/g, ', '));
    if (en1 && es1 && bare(en1) === bare(es1)) out.by = { es: es1, en: en1 };
  }
  return out;
}

/**
 * What the sources say of a country, as a sheet tells it, and what whoever corrects them should look at.
 *
 *   country  the country as the game has it (public/data/index.json)
 *   said     what was brought (countries/countries.json)
 *   tongues  the codes of its official languages, the most spoken first (public/data/facts.json)
 *   codes    the code of each language by its name in Spanish, as it is compared (`bare`)
 *   flown    the years of each flag the game has of it before the one it flies: [from, to]
 */
export function saidOf({ country, said, tongues = [], codes = new Map(), flown = [] }) {
  const notes = [];
  const out = {};
  const item = said.items?.[country.id];
  if (!item) return { given: out, notes: ['nothing was brought of it'] };
  const boxes = said.boxes ?? {};
  const es = boxFields(boxes[`es:${item.pages?.es}`] ?? '');
  const en = boxFields(boxes[`en:${item.pages?.en}`] ?? '');

  const official = {
    es: nameIn(es, ['nombre oficial', 'nombre completo']) || longest(item.official, 'es'),
    en: nameIn(en, ['conventional long name', 'official name']) || longest(item.official, 'en'),
  };
  for (const lang of ['es', 'en']) if (!fit(official[lang], 100)) delete official[lang];
  if (official.es || official.en) out.official = official;

  // What it calls itself, in the first of its official languages that anybody gives it in.
  const called = calledIn(field(en, 'native name'));
  for (const lang of tongues) {
    const mine = lang === 'es' || lang === 'en' ? (official[lang] ?? '') : (called.find(([code, text]) => tongue(code) === lang && fit(text) && !/[()]/.test(text))?.[1] ?? (longest(item.official, lang) || longest(item.native, lang)));
    if (!fit(mine)) continue;
    out.local = mine;
    out.localLang = lang;
    break;
  }

  const motto = mottoOf(es, en, item, tongues, codes);
  if (motto?.unread) notes.push(`motto not read: ${motto.unread.slice(0, 160)}`);
  else if (motto) out.motto = motto;

  // Its anthems: the one that is only its own before the one it shares with others (that of the Crown, that of its State).
  const sung = (q) => Object.values(said.items ?? {}).filter((other) => (other.anthem ?? []).includes(q)).length;
  const anthems = [...(item.anthem ?? [])]
    .sort((a, b) => sung(a) - sung(b))
    .map((q) => said.names?.[q])
    .filter((n) => n?.es || n?.en);
  if (anthems.length) out.anthem = { es: anthems.map((n) => capital(n.es ?? n.en)).join(' · '), en: anthems.map((n) => capital(n.en ?? n.es)).join(' · ') };

  // Its flag: where Wikidata names two, the one a Wikipedia has a page of.
  const flags = (item.flag ?? []).filter((q) => said.flags?.[q]);
  const flagId = flags.find((q) => said.flags[q].pages?.es || said.flags[q].pages?.en) ?? flags[0];
  if (flags.length > 1) notes.push(`${flags.length} flags in Wikidata: ${flags.join(', ')} → ${flagId}`);
  const flag = flagOf(said.flags?.[flagId], boxes, said.names ?? {}, flown, notes);
  if (Object.keys(flag).length) out.flag = flag;

  const read = {};
  for (const lang of ['es', 'en']) if (item.pages?.[lang]) read[lang] = WIKI(lang, item.pages[lang]);
  if (read.es || read.en) out.read = read;
  const readFlag = {};
  for (const lang of ['es', 'en']) if (said.flags?.[flagId]?.pages?.[lang]) readFlag[lang] = WIKI(lang, said.flags[flagId].pages[lang]);
  if (readFlag.es || readFlag.en) out.readFlag = readFlag;
  return { given: out, notes };
}

/** The code of each language by its name in Spanish: those the game names (facts.json) and those only a motto is said in. */
export function tongueCodes(facts) {
  const codes = new Map();
  for (const [code, names] of Object.entries(facts?.l ?? {})) for (const name of [names[0], names[2]]) if (name) codes.set(bare(name), code);
  for (const [name, code] of Object.entries(SAID_IN)) codes.set(bare(name), code);
  return codes;
}
