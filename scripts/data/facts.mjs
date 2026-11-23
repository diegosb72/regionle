// Writes down four things about each country that are not figures: the currency it pays with, the languages
// that are official in it, its internet domain and its dialling code.
//
//   npm run data:facts
//   npm run data:facts -- --data dir --src dir --static file --report file
//
// It runs after `data:build`, which says what countries the game has, and reads two sources:
//
//   · GeoNames (scripts/data/static/geonames-countries.json, the extract the build already takes the area
//     and the capital of each country from): the domain, the dialling code and the currency;
//   · Unicode CLDR, which `data:fetch` brings: which currencies are legal tender in each country and since
//     when, which languages are official in it and how many of its people speak each, and what every
//     currency and every language is called in Spanish and in English.
//
// The currency is the one CLDR gives as legal tender on the day below; GeoNames, which is older, is only
// asked which one comes first where a country has two (the balboa before the dollar in Panama). Where the
// two sources name different currencies the report says so (Bulgaria took the euro in 2026).
//
// What it writes is public/data/facts.json, a file of its own that the game fetches only where one of these
// is asked about or shown:
//
//   · `c`: by country, what it has of the four. `m`: the codes of its currencies, its own first; `l`: the
//     languages that are official in the whole of it, the most spoken first; `r`: those that are official
//     in part of it, or for some of its people; `s`: others that a tenth of its people or more speak and
//     are the first language of some country; `d`: its domain; `p`: its dialling codes, nearly always one. The game shows
//     `l` and nothing else as the languages of a country: `r` and `s` are only there so that none of them
//     is held against whoever types it, nor offered as a wrong answer;
//   · `l`: what each of those languages is called, in Spanish and in English, and after the two names the
//     others it is known by, which are taken when it is typed ("castellano", "farsi");
//   · `m`: the same of each currency, with two more names before those others: what it is called without
//     saying whose it is ("peso" for "peso mexicano", "dollar" for "US dollar"), in Spanish and in English.
//     It is what is shown among four options, where the whole name would give the country away.
//
// Which languages are official is the least settled of the four. What CLDR says of the whole of each
// country was set against what The World Factbook says of each member of the United Nations (the book as
// it stood in September 2026), both ways: the languages given here as official that the book does not call
// so, and the ones the book calls official that were not here. They agree in most countries, and the rest
// were read one by one. Where CLDR was wrong it is mended by hand below, each time with the words of the
// book. The languages of part of a country are as CLDR has them, and nobody has gone through them: that
// is why they are not shown. Sign languages, which a few countries have made official, are not counted.
//
// The countries are the ones the game asks about: all but those it only draws. The report is .cache/facts.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DATA = path.resolve(ROOT, value('data') ?? 'public/data');
const SRC = path.resolve(ROOT, value('src') ?? '.cache/src');
const STATIC = path.resolve(ROOT, value('static') ?? 'scripts/data/static/geonames-countries.json');
const REPORT = path.resolve(ROOT, value('report') ?? '.cache/facts.txt');

/**
 * The day the currencies are those of. CLDR says from when to when each was legal tender, and a date that
 * moved with the calendar would make two runs of the same sources differ: it is moved by hand, with the
 * edition of CLDR.
 */
const AS_OF = '2026-11-23';

/**
 * What neither source has, by hand. Kosovo has had the code 383 since 2017, and GeoNames still gives it
 * none. The names of languages are given as [Spanish, English], and `null` leaves the one CLDR has: the
 * Comorian of each island, the Hindi of Fiji and Montenegrin have none in CLDR; and in English it calls
 * three languages by the name of their country or by their own ("Nauru", "Tuvalu", "Kalaallisut").
 */
const BY_HAND = {
  dial: { XK: ['383'] },
  language: {
    zdj: ['comorense', 'Comorian'],
    hif: ['hindi de Fiyi', null],
    cnr: ['montenegrino', 'Montenegrin'],
    na: [null, 'Nauruan'],
    tvl: [null, 'Tuvaluan'],
    kl: [null, 'Greenlandic'],
    // "Seselwa Creole French": the book and nearly everybody call it Seychellois Creole.
    crs: [null, 'Seychellois Creole'],
    // CLDR names the Tamazight of the Central Atlas, one of several: what is official in Morocco and in
    // Algeria is Tamazight, with no more to it.
    tzm: ['tamazight', 'Tamazight'],
  },
  /**
   * What a currency is called without saying whose it is, where the rule (`shortName`) does not find it:
   * CLDR calls the currency of Zimbabwe "Zimbabwean gold", and everybody, by its initials.
   */
  short: { ZWG: ['ZiG', 'ZiG'] },
};

/**
 * Other names a currency or a language is typed by, in either language: they are taken as answers and
 * shown nowhere. Only the ones somebody is likely to type and that are too far from the names CLDR gives
 * for a slip of the finger to cover.
 */
const ALSO_CALLED = {
  currency: {
    CNY: ['renminbi', 'yuan chino'],
    GBP: ['pound sterling', 'sterling'],
    HUF: ['florín', 'florín húngaro'],
    ILS: ['shéquel', 'sheqel', 'nuevo shéquel'],
    PEN: ['nuevo sol'],
    XAF: ['franco CFA', 'CFA franc', 'CFA'],
    XOF: ['franco CFA', 'CFA franc', 'CFA'],
    ZWG: ['oro', 'gold', 'Zimbabwe Gold'],
  },
  language: {
    am: ['amhárico'],
    az: ['azerí', 'Azeri'],
    bn: ['Bengali'],
    crs: ['criollo', 'Creole', 'seselwa'],
    dv: ['dhivehi', 'maldivo', 'Maldivian'],
    es: ['castellano', 'Castilian'],
    fa: ['farsi', 'darí', 'Dari'],
    fil: ['tagalo', 'Tagalog'],
    fj: ['iTaukei'],
    ga: ['gaélico', 'gaélico irlandés', 'Gaelic'],
    gil: ['kiribatiano', 'Kiribati'],
    ht: ['criollo', 'Creole', 'kreyòl'],
    id: ['bahasa indonesia'],
    kl: ['kalaallisut'],
    km: ['camboyano', 'Cambodian'],
    lo: ['laosiano', 'Laotian'],
    ms: ['malasio', 'Malaysian'],
    nd: ['ndebele'],
    nl: ['holandés', 'flamenco', 'Flemish'],
    no: ['bokmål', 'nynorsk'],
    ny: ['chichewa', 'chewa'],
    oc: ['aranés', 'Aranese'],
    ps: ['pastú', 'pastó', 'pashtu'],
    ro: ['moldavo', 'Moldovan'],
    si: ['singalés', 'Sinhalese'],
    ss: ['swazi', 'siswati'],
    st: ['sesotho', 'sesoto', 'sotho'],
    sw: ['kiswahili'],
    tet: ['tetun'],
    tn: ['setswana', 'tsuana'],
    tzm: ['bereber', 'Berber', 'amazig', 'Amazigh'],
    zh: ['mandarín', 'chino mandarín', 'Mandarin', 'Mandarin Chinese'],
  },
};

/**
 * Languages CLDR gives as official in a country where they are not, with what The World Factbook says of
 * each. They stay among the ones spoken there.
 */
const NOT_OFFICIAL = {
  DZ: ['fr'], // "Arabic (official), French (lingua franca), Tamazight (official)"
  IL: ['ar'], // "Hebrew (official), Arabic (special status under Israeli law)"
  MA: ['fr'], // "French (often the language of business, government, and diplomacy)"
  ME: ['sr'], // "Serbian 42.9%, Montenegrin (official) 37%"
  MG: ['en'], // "Malagasy (official) 99.9%, French (official) 23.6%, English 8.2%"
  ML: ['fr'], // "Bambara (official), French 17.2%"
  NG: ['yo'], // "English (official), Hausa, Yoruba, Igbo (Ibo), Fulani"
  SN: ['wo'], // "French (official), Wolof, Pulaar, Jola, Mandinka, Serer, Soninke"
  TN: ['fr'], // "despite having no official status, French plays a major role in the country"
  UA: ['ru'], // "Ukrainian (official) 67.5%, Russian (regional language) 29.6%"
};
/** …and the official languages CLDR does not give as such, again with what the book says. */
const OFFICIAL = {
  BO: ['gn'], // "Spanish (official) 68.1%, Quechua (official) 17%, Aymara (official) 10.8%, Guarani (official) 0.7%"
  DZ: ['tzm'], // "Arabic (official), French (lingua franca), Tamazight (official)"
  ME: ['cnr'], // "Montenegrin (official) 37%"
  ML: ['bm'], // "Bambara (official), French 17.2%"
  PE: ['ay'], // "Spanish (official) 82.9%, Quechua (official) 13.6%, Aymara (official) 1.6%"
  RW: ['sw'], // "Kinyarwanda (official, universal Bantu vernacular), French (official), English (official), Swahili/Kiswahili (official…)"
  SC: ['crs'], // "Seychellois Creole (official) 89.1%, English (official) 5.1%, French (official) 0.7%"
  // "isiZulu or Zulu (official) 25.3%, isiXhosa or Xhosa (official) 14.8%, Afrikaans (official) 12.2%…": the
  // eleven are official in the whole of South Africa, and CLDR gives ten of them as official in part of it.
  ZA: ['zu', 'xh', 'af', 'nso', 'tn', 'st', 'ts', 'ss', 've', 'nr'],
};
/** …and the ones that are official in part of a country, or for some of its people, and CLDR does not have as such. */
const REGIONAL = {
  ET: ['om', 'so', 'ti', 'aa'], // "Oromo (official regional working language) 33.8%, Amharic (official national language) 29.3%, Somali…, Tigrigna…, Afar…"
  PT: ['mwl'], // "Portuguese (official), Mirandese (official, but locally used)"
};
/**
 * The language that comes first where it is not the most spoken of the official ones: Kazakh is the state
 * language of Kazakhstan, where more people speak Russian, which is official too.
 */
const FIRST = { KZ: 'kk' };

/**
 * Languages CLDR counts apart that are one language to whoever is asked which is official: the two written
 * forms of Norwegian, the German spoken in Switzerland, the Comorian of each island.
 */
const SAME_LANGUAGE = { nb: 'no', nn: 'no', gsw: 'de', wni: 'zdj' };

/**
 * The share of its people, in hundredths, that have to speak a language for it to count as spoken in a
 * country without being official there: CLDR lists the Kazakh of seven in a million people of Turkey.
 */
const SPOKEN_MIN = 10;

const read = (file) => {
  if (!fs.existsSync(file)) throw new Error(`Falta ${path.relative(ROOT, file)}: ejecuta antes «npm run data:fetch»`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const cldr = (name) => read(path.join(SRC, 'cldr', name));

const index = read(path.join(DATA, 'index.json'));
const geonames = read(STATIC).countries;
const tender = cldr('currencyData.json').supplemental.currencyData.region;
const territories = cldr('territoryInfo.json').supplemental.territoryInfo;
const currencyNames = { es: cldr('currencies-es.json').main.es.numbers.currencies, en: cldr('currencies-en.json').main.en.numbers.currencies };
const languageNames = { es: cldr('languages-es.json').main.es.localeDisplayNames.languages, en: cldr('languages-en.json').main.en.localeDisplayNames.languages };

const notes = [];

/**
 * The currencies that are legal tender in a country on the day above, the newest first, which is the order
 * CLDR has them in: not the ones it gives as never having been tender (the units of account of a few
 * countries), nor the ones that came later or were withdrawn before.
 */
function currenciesOf(id) {
  const out = [];
  for (const entry of tender[id] ?? []) {
    for (const [code, when] of Object.entries(entry)) {
      if (when._tender === 'false') continue;
      if (when._from && when._from > AS_OF) continue;
      if (when._to && when._to < AS_OF) continue;
      if (!out.includes(code)) out.push(code);
    }
  }
  return out;
}

/** The currencies of a country, its own first: the one GeoNames names, where it is one of them. */
function currency(id) {
  const now = currenciesOf(id);
  const said = geonames[id]?.currency || null;
  if (!now.length) {
    if (said) notes.push(`${id} currency: none · CLDR gives none in use, GeoNames says ${said}`);
    return [];
  }
  if (said && !now.includes(said)) notes.push(`${id} currency: ${now.join(' ')} · GeoNames says ${said}, which CLDR no longer gives as legal tender`);
  const list = said && now.includes(said) ? [said, ...now.filter((c) => c !== said)] : now;
  if (list.length > 1) notes.push(`${id} currency: ${list.join(' and ')} · both are legal tender`);
  return list;
}

/** What a language is called in the two languages of the game: by hand where CLDR does not say, or says it oddly. */
function languageName(lang) {
  const hand = BY_HAND.language[lang] ?? [null, null];
  return [hand[0] ?? languageNames.es[lang], hand[1] ?? languageNames.en[lang]];
}
const named = (lang) => languageName(lang).every(Boolean);

/** The language a code of CLDR stands for: without the script it is written in, and with its own kin. */
function languageOf(code) {
  const base = code.replace(/_.*$/, '');
  return SAME_LANGUAGE[base] ?? base;
}

/**
 * The languages of a country: `l`, those that are official in the whole of it, by law or in fact; `r`, those
 * that are official in a part of it or for a minority. Each list from the most spoken to the least, and by
 * its code where two are spoken by as many.
 */
function languages(id) {
  const spoken = territories[id]?.languagePopulation ?? {};
  /** The share of each language, and how official it is: 2 in the whole country, 1 in part of it, 0 not at all. */
  const found = new Map();
  for (const [code, info] of Object.entries(spoken)) {
    const status = info._officialStatus;
    const rank = status === 'official' || status === 'de_facto_official' ? 2 : status === 'official_regional' || status === 'official_minority' ? 1 : 0;
    const lang = languageOf(code);
    if (lang === 'und') continue;
    const share = Number(info._populationPercent) || 0;
    const before = found.get(lang);
    found.set(lang, { rank: Math.max(rank, before?.rank ?? 0), share: Math.max(share, before?.share ?? 0) });
  }
  // What is mended by hand: each line has to mend something, or it is a line that a later edition made idle.
  for (const lang of NOT_OFFICIAL[id] ?? []) {
    if (found.get(lang)?.rank !== 2) throw new Error(`CLDR ya no da el ${lang} por oficial en ${id}: sobra la corrección a mano (NOT_OFFICIAL en scripts/data/facts.mjs)`);
    found.get(lang).rank = 0;
    notes.push(`${id} language: ${lang} is not official, by hand`);
  }
  for (const lang of OFFICIAL[id] ?? []) {
    if (found.get(lang)?.rank === 2) throw new Error(`CLDR ya da el ${lang} por oficial en ${id}: sobra la corrección a mano (OFFICIAL en scripts/data/facts.mjs)`);
    found.set(lang, { rank: 2, share: found.get(lang)?.share ?? 0 });
    notes.push(`${id} language: ${lang} is official, by hand`);
  }
  for (const lang of REGIONAL[id] ?? []) {
    if (found.get(lang)?.rank) throw new Error(`CLDR ya da el ${lang} por oficial en ${id}, o en parte de él: sobra la corrección a mano (REGIONAL en scripts/data/facts.mjs)`);
    found.set(lang, { rank: 1, share: found.get(lang)?.share ?? 0 });
    notes.push(`${id} language: ${lang} is official in part of it, by hand`);
  }
  const sorted = (rank) =>
    [...found.entries()]
      .filter(([, f]) => f.rank === rank)
      .sort((a, b) => b[1].share - a[1].share || a[0].localeCompare(b[0]))
      .map(([lang]) => lang);
  let l = sorted(2);
  const first = FIRST[id];
  if (first) {
    if (!l.includes(first) || l[0] === first) throw new Error(`El ${first} ya va el primero en ${id}, o no es oficial allí: sobra la corrección a mano (FIRST en scripts/data/facts.mjs)`);
    l = [first, ...l.filter((lang) => lang !== first)];
    notes.push(`${id} language: ${first} first, by hand`);
  }
  // A language of part of a country that CLDR has no name for in one of the two languages cannot be written
  // by anybody, nor told from another: it is left out. One of the whole country without a name stops the run.
  const regional = sorted(1);
  const nameless = regional.filter((lang) => !named(lang));
  if (nameless.length) notes.push(`${id} language: ${nameless.join(' ')} left out · official in part of it, and without a name in Spanish or in English`);
  return { l, r: regional.filter(named), spoken: sorted(0).filter((lang) => found.get(lang).share >= SPOKEN_MIN) };
}

/** The dialling codes GeoNames gives: "34", "+1-268", "+1-809 and 1-829". Each as its digits, in groups. */
function dial(id) {
  const hand = BY_HAND.dial[id];
  const said = (geonames[id]?.phone ?? '').trim();
  if (hand) {
    if (said) throw new Error(`GeoNames ya da un prefijo de ${id} («${said}»): sobra el que está a mano (BY_HAND en scripts/data/facts.mjs)`);
    notes.push(`${id} dial: ${hand.join(' ')}, by hand`);
    return hand;
  }
  if (!said) return [];
  const codes = said.split(/\s+and\s+/).map((code) => code.replace(/^\+/, '').replace(/-/g, ' ').trim());
  for (const code of codes) if (!/^\d{1,4}( \d{1,4})?$/.test(code)) throw new Error(`El prefijo de ${id} no se entiende: «${said}»`);
  return codes;
}

/** The internet domain of a country: a dot and its letters. */
function domain(id) {
  const said = (geonames[id]?.tld ?? '').trim();
  if (!said) return null;
  if (!/^\.[a-z]{2,3}$/.test(said)) throw new Error(`El dominio de ${id} no se entiende: «${said}»`);
  return said;
}

/** The countries the game asks about (`eligible` in src/lib/world.ts): all but those it only draws. */
const asked = index.countries.filter((c) => c.cl !== 'other');

const out = { c: {}, m: {}, l: {} };
const used = { m: new Set(), l: new Set() };
const read4 = new Map(asked.map((c) => [c.id, { m: currency(c.id), ...languages(c.id), d: domain(c.id), p: dial(c.id) }]));
/** The languages a question can show as the answer: the first of some country. */
const shown = new Set([...read4.values()].flatMap((rec) => rec.l.slice(0, 1)));
for (const c of asked) {
  const { m, l, r, spoken, d, p } = read4.get(c.id);
  // Of the languages that are only spoken, the ones that could be offered as a wrong answer, which they are not.
  const s = spoken.filter((lang) => shown.has(lang));
  const rec = { ...(m.length ? { m } : {}), ...(l.length ? { l } : {}), ...(r.length ? { r } : {}), ...(s.length ? { s } : {}), ...(d ? { d } : {}), ...(p.length ? { p } : {}) };
  if (!Object.keys(rec).length) continue;
  out.c[c.id] = rec;
  for (const code of m) used.m.add(code);
  for (const code of [...l, ...r]) used.l.add(code);
}

/**
 * What a currency is called without saying whose it is. In Spanish the name opens with it ("peso mexicano",
 * "franco CFA de África Central", and "nuevo séquel israelí" after the word that says it is the new one);
 * in English it closes with it ("Mexican peso", "Israeli new shekel"), and in small letters ("Afghan Afghani").
 */
function shortName(code, es, en) {
  const hand = BY_HAND.short[code];
  const words = es.split(' ');
  const first = /^nuev[oa]$/.test(words[0]) ? words[1] : words[0];
  const last = en.split(' ').pop();
  const rule = [first, last.charAt(0).toLowerCase() + last.slice(1)];
  const same = (a, b) => a.toLowerCase() === b.toLowerCase();
  if (hand && same(hand[0], rule[0]) && same(hand[1], rule[1])) throw new Error(`La regla ya llama «${rule[0]}» a la moneda ${code}: sobra el nombre que está a mano (BY_HAND en scripts/data/facts.mjs)`);
  if (hand) notes.push(`currency ${code}: called "${hand[0]}" / "${hand[1]}" for short, by hand · the rule says "${rule[0]}" / "${rule[1]}"`);
  return hand ?? rule;
}

/** The other names something is typed by: none that is one of its names already, and each of them once. */
function alsoCalled(kind, code, names) {
  const have = new Set(names.map((n) => n.toLowerCase()));
  const more = ALSO_CALLED[kind][code] ?? [];
  for (const name of more) {
    if (have.has(name.toLowerCase())) throw new Error(`«${name}» ya es un nombre de ${code}: sobra en ALSO_CALLED (scripts/data/facts.mjs)`);
    have.add(name.toLowerCase());
  }
  return more;
}
/** Names given by hand to what no country here has: said, and no more, because a run on a few countries has them all. */
for (const kind of ['currency', 'language']) {
  const idle = Object.keys(ALSO_CALLED[kind]).filter((code) => !(kind === 'currency' ? used.m : used.l).has(code));
  if (idle.length) notes.push(`${kind}: other names are given by hand to ${idle.join(' ')}, which no country here has`);
}

/** What each currency is called: in Spanish as CLDR writes it; in English, the form it has inside a sentence ("US dollar"). */
for (const code of [...used.m].sort()) {
  const es = currencyNames.es[code]?.displayName;
  const en = currencyNames.en[code]?.['displayName-count-one'] ?? currencyNames.en[code]?.displayName;
  if (!es || !en || es === code || en === code) throw new Error(`CLDR no dice cómo se llama la moneda ${code} en ${!es || es === code ? 'español' : 'inglés'}`);
  const names = [es, en, ...shortName(code, es, en)];
  out.m[code] = [...names, ...alsoCalled('currency', code, names)];
}
/** What each language is called. */
for (const code of [...used.l].sort()) {
  const hand = BY_HAND.language[code];
  const [es, en] = languageName(code);
  if (!es || !en) throw new Error(`CLDR no dice cómo se llama el idioma ${code} en ${!es ? 'español' : 'inglés'}: hay que ponerle nombre a mano (BY_HAND en scripts/data/facts.mjs)`);
  if (hand && hand[0] === languageNames.es[code]) throw new Error(`CLDR ya llama «${hand[0]}» al idioma ${code}: sobra el nombre que está a mano (BY_HAND en scripts/data/facts.mjs)`);
  if (hand && hand[1] === languageNames.en[code]) throw new Error(`CLDR ya llama «${hand[1]}» al idioma ${code}: sobra el nombre que está a mano (BY_HAND en scripts/data/facts.mjs)`);
  out.l[code] = [es, en, ...alsoCalled('language', code, [es, en])];
  if (hand) notes.push(`language ${code}: called "${es}" / "${en}", by hand`);
}

const file = path.join(DATA, 'facts.json');
const text = JSON.stringify(out);
if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);

/** How many of the countries asked have each thing, and which of the members of the United Nations do not. */
const KEYS = { m: 'currency', l: 'language', d: 'domain', p: 'dial' };
const lines = Object.entries(KEYS).map(([key, name]) => {
  const have = asked.filter((c) => out.c[c.id]?.[key]);
  const lacking = asked.filter((c) => c.cl === 'un' && !out.c[c.id]?.[key]).map((c) => c.id);
  const values = new Set(have.flatMap((c) => (key === 'd' ? [out.c[c.id].d] : [out.c[c.id][key][0]])));
  return `${name}: ${have.length} of ${asked.length} countries, ${values.size} different${lacking.length ? ` · members of the UN without: ${lacking.join(' ')}` : ''}`;
});
/** What several countries share: a question that shows it has more than one answer. */
const shared = (key, of) => {
  const by = new Map();
  for (const c of asked) for (const v of of(out.c[c.id] ?? {})) by.set(v, [...(by.get(v) ?? []), c.id]);
  return [...by.entries()].filter(([, ids]) => ids.length > 1).map(([v, ids]) => `${key} ${v}: ${ids.join(' ')}`);
};
const twins = [...shared('domain', (rec) => (rec.d ? [rec.d] : [])), ...shared('dial', (rec) => rec.p ?? [])];
const lacking = asked.filter((c) => !out.c[c.id]).map((c) => c.id);
const summary = `Facts of the countries: ${Object.keys(out.c).length} of ${asked.length} have some · ${Object.keys(out.m).length} currencies, ${Object.keys(out.l).length} languages · facts.json ${(text.length / 1024).toFixed(1)} kB`;
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${summary}\n\n${lines.join('\n')}\n\nWith nothing: ${lacking.join(' ') || 'none'}\n\nShared by several:\n${twins.join('\n') || 'nothing'}\n\n${notes.join('\n')}\n`);
console.log(summary);
for (const l of lines) console.log(`  ${l}`);
console.log(`  ${notes.length} notes in ${path.relative(ROOT, REPORT)}`);
