// Makes the sheets of the countries that the gallery of flags shows (src/screens/FlagProfile.tsx): one for
// every country of the game that has a flag.
//
//   npm run data:fetch -- countries-said   what Wikidata and Wikipedia say of each country, into .cache/src
//   npm run data:fetch -- countries-texts  how Wikipedia begins to tell of each and of its flag, into .cache/src
//   npm run data:fetch -- photos           the photographs, into .cache/src/photos (see photos-pinned.mjs)
//   npm run data:profiles                  the sheets and their pictures
//   npm run data:profiles -- --review      the same, and what whoever corrects the sources should look at
//
// (`--sheets`, `--brought`, `--said`, `--texts`, `--fixes`, `--heads`, `--data` and `--photos` name other folders and
// files to read from and write to: the tests run it on countries made up for the occasion.)
//
// A sheet is made of three things, each laid over the one before:
//
//   1. What Wikidata and Wikipedia say of the country and of its flag (profiles-said.mjs reads it from
//      .cache/src/countries-said.json, which the workflow "Traer datos" brought: scripts/data/outside.mjs,
//      source `countries`): what it is called in full, its motto, its anthem, since when its flag is flown,
//      its proportions and its colours. Every country has this, as far as the sources say it.
//   2. scripts/data/profiles-fixes.json: what was corrected by hand after reading it (profiles-fixes.md
//      tells why). No program writes that file, so bringing the sources again undoes nothing.
//      A territory that the game draws with the flag of its country (Réunion with that of France, Svalbard
//      with that of Norway) is told there whose flag it is (`flag.of`), and says of it what that country says.
//   3. scripts/data/profiles/<country>.json, where there is one: what is written of the country by hand, in
//      the two languages of the game — what it is, what its flag means, what it was at the time of each of
//      the flags it flew — and the photographs it is shown with, each a file of Wikimedia Commons named by
//      its title, with its caption. What it says is what the sheet says; the rest stays as it was read.
//
// Where nobody has written of a country, its sheet tells how Wikipedia begins to tell of it and of its flag:
// the opening of the page the sheet leads to (`read`, `readFlag`) in each language of the game, cut after as
// many whole sentences as fit (profiles-text.mjs reads it from .cache/src/countries-texts.json, which the
// same workflow brought: source `texts`). The words are Wikipedia's, under CC BY-SA 4.0, and the sheet says
// so. Whoever has read one and knows better where it should end, or that it should not be shown, says it in
// profiles-fixes.json (`leads`).
//
// And two more are read:
//
//   · .cache/src/photos: what Commons says of each of those files (who made it and on what terms it is
//     given: photos.json) and the picture of it that Wikimedia draws, 1920 px wide. The workflow "Traer
//     datos" brings them (source `photos`);
//   · public/data/index.json, flags.json and facts.json: which countries the game has, the flags it has of
//     each of their times, and which languages are official in each.
//
// What comes out:
//
//   · public/data/profiles/<country>.json: the sheet as the game reads it, with the author and the licence
//     of each photograph beside its caption. Nobody types those: they are what Commons says, unless the
//     sheet names the author because Commons tells it in more words than a caption can carry;
//   · public/photos/<name>-<width>.webp: each photograph at the widths the sheet shows it at, named after
//     the first ten figures of the SHA-1 of its original. A photograph no sheet shows any more is removed.
//
// The pictures are not part of what the game stores to work without a connection (scripts/pwa/build.mjs):
// each is fetched when its sheet is opened, and kept from then on.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { saidOf, tongueCodes } from './profiles-said.mjs';
import { leadOf } from './profiles-text.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
/** What is written of each country by hand. */
const SHEETS = path.resolve(ROOT, value('sheets') ?? 'scripts/data/profiles');
/** What was brought from Commons. */
const BROUGHT = path.resolve(ROOT, value('brought') ?? '.cache/src/photos');
/** What Wikidata and Wikipedia say of each country, as it was brought, and what was corrected of it by hand. */
const SAID = path.resolve(ROOT, value('said') ?? '.cache/src/countries-said.json');
const FIXES = path.resolve(ROOT, value('fixes') ?? 'scripts/data/profiles-fixes.json');
/** The photograph chosen for the head of the sheet of each country nobody has written of, with what is seen in it. */
const HEADS = path.resolve(ROOT, value('heads') ?? 'scripts/data/profiles-heads.json');
/** How Wikipedia begins to tell of each country and of its flag, as it was brought. */
const TEXTS = path.resolve(ROOT, value('texts') ?? '.cache/src/countries-texts.json');
/** The data of the game: read, and where the sheets are written (under `profiles`). */
const DATA = path.resolve(ROOT, value('data') ?? 'public/data');
const OUT = path.join(DATA, 'profiles');
/** Where the pictures are written. */
const PICTURES = path.resolve(ROOT, value('photos') ?? 'public/photos');

/**
 * How wide each photograph is kept, in px, by where the sheet shows it: the one at its head, which is as
 * wide as the sheet and is drawn with two dots to one on many screens; the ones of its gallery, two abreast;
 * and the one of a time, beside a paragraph. The browser takes the narrowest that fills its box. The one
 * chosen for the head of a sheet nobody has written (`chosen`) is not kept at its widest: there are some
 * two hundred and fifty of them, and each width of each is carried by the repository twice.
 */
export const WIDTHS = { head: [640, 1280, 1920], photo: [640, 1280], time: [640], chosen: [640, 1280] };
/**
 * How long what a sheet shows of the opening of a page of Wikipedia may be, in characters: of that of the
 * country, which is read first, and of that of its flag, which is read beside the flag.
 */
export const LEAD_MAX = { about: 640, flag: 480 };
/** How much of what is seen is kept when a picture is made lighter: past this, a sky starts to show bands. */
const QUALITY = 78;
/** The terms a photograph may be given on to be shown here: none that forbids reusing it or changing its size. */
const FREE = /^(CC0|CC BY(-SA)? \d|Public domain)/;
const LANGS = ['es', 'en'];
/** What is said of a flag that is true of it wherever it is flown: a territory that flies that of its country says the same. */
const FLAG_FACTS = ['adopted', 'changed', 'ratio', 'colours', 'by'];

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const fail = (id, what) => {
  throw new Error(`${id}: ${what}`);
};

/** A text in the two languages, each with something to say. */
function said(id, what, text) {
  for (const lang of LANGS) if (typeof text?.[lang] !== 'string' || !text[lang].trim()) fail(id, `${what} has no text in «${lang}»`);
  return { es: text.es.trim(), en: text.en.trim() };
}

/** Paragraphs in the two languages: as many in one as in the other. */
function paragraphs(id, what, text) {
  for (const lang of LANGS) if (!Array.isArray(text?.[lang]) || !text[lang].length || text[lang].some((p) => typeof p !== 'string' || !p.trim())) fail(id, `${what} has no paragraphs in «${lang}»`);
  if (text.es.length !== text.en.length) fail(id, `${what} has ${text.es.length} paragraphs in Spanish and ${text.en.length} in English`);
  return { es: text.es.map((p) => p.trim()), en: text.en.map((p) => p.trim()) };
}

/**
 * A photograph as the sheet shows it: its pictures, made here, and what is said under it. `widths` are
 * those of where it is shown; none wider than what was brought is made.
 */
async function photograph(id, one, commons, widths, made) {
  const title = typeof one?.file === 'string' ? one.file.trim() : '';
  if (!title) fail(id, 'a photograph names no file');
  const file = commons.files?.[title];
  if (!file || file.missing) fail(id, `Commons was not asked about «${title}», or has no such file: name it in the sheet, ask for the source «photos» (scripts/data/pedido.txt) and pin what comes (scripts/data/photos-pinned.mjs)`);
  if (!file.picture) fail(id, `the picture of «${title}» was not brought`);
  if (!FREE.test(file.licence ?? '')) fail(id, `«${title}» is given on terms that are not known to be free: ${file.licence || 'none said'}`);
  const from = path.join(BROUGHT, path.basename(file.picture));
  if (!fs.existsSync(from)) fail(id, `the picture of «${title}» is not among what was brought: pin it (scripts/data/photos-pinned.mjs) and run «npm run data:fetch -- photos»`);
  const by = (typeof one.by === 'string' && one.by.trim()) || file.artist || '';
  // A work whose author has to be named has one to name.
  if (!by && file.attribution) fail(id, `«${title}» has to be attributed and Commons names nobody: say who made it (by)`);
  const text = said(id, `the photograph «${title}»`, one);
  const name = file.sha1.slice(0, 10);
  const { width, height } = await sharp(from).metadata();
  const sizes = widths.filter((w) => w <= width);
  if (!sizes.length) sizes.push(width);
  for (const w of sizes) {
    const dest = `${name}-${w}.webp`;
    if (!made.has(dest)) {
      // A picture is named after what it is made from and how wide it is: one that is there is that one, and is not made again.
      if (!fs.existsSync(path.join(PICTURES, dest))) await sharp(from).resize({ width: w }).webp({ quality: QUALITY, effort: 6 }).toFile(path.join(PICTURES, dest));
      made.add(dest);
    }
  }
  const focus = Array.isArray(one.focus) && one.focus.length === 2 && one.focus.every((n) => Number.isFinite(n) && n >= 0 && n <= 100) ? one.focus : null;
  return {
    file: name,
    w: width,
    h: height,
    sizes,
    title,
    ...(by ? { by } : {}),
    licence: file.licence,
    ...(file.licenceUrl ? { licenceUrl: file.licenceUrl.replace(/^http:/, 'https:') } : {}),
    ...text,
    ...(focus ? { focus } : {}),
  };
}

/** The flag of a time of the country, as the game has it: one it flew before, that of what it was then, or the one it flies. */
function flown(id, time, flags) {
  if (time.now === true) return { now: true };
  if (typeof time.gone === 'string') {
    if (!flags.gone.some((row) => row[0] === time.gone)) fail(id, `the game has no flag of «${time.gone}», which is no more`);
    return { gone: time.gone };
  }
  if (Array.isArray(time.past) && time.past.length === 2) {
    const [from, to] = time.past;
    if (!(flags.past?.[id] ?? []).some((row) => row[2] === from && row[3] === to)) fail(id, `the game has no flag that the country flew from ${from} to ${to}`);
    return { past: [from, to] };
  }
  return fail(id, 'a time names no flag: «now», «gone» or «past»');
}

/** What is written of a country by hand, as the sheet tells it: its texts, its times and its photographs, with their pictures made. */
async function sheet(file, commons, index, flags, made) {
  const id = path.basename(file, '.json');
  const src = read(file);
  if (src.id !== id) fail(id, `the file says it is of «${src.id}»`);
  if (!index.countries.some((c) => c.id === id)) fail(id, 'the game has no such country');
  if (!commons) fail(id, `what Commons says of the photographs is not in ${path.relative(ROOT, BROUGHT) || BROUGHT}: run «npm run data:fetch -- photos»`);
  if (!Array.isArray(src.photos) || !src.photos.length) fail(id, 'the sheet has no photographs');
  if (!Array.isArray(src.times) || !src.times.length) fail(id, 'the sheet has no times');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(src.flag?.adopted ?? '')) fail(id, 'the flag has no day it was adopted on');
  if (src.flag.changed !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(src.flag.changed)) fail(id, 'the day the flag was last changed is not a day');
  if (!/^\d+:\d+$/.test(src.flag.ratio ?? '')) fail(id, 'the flag has no proportions');
  const local = typeof src.local === 'string' ? src.local.trim() : '';
  // A name in another language says which, so that whoever has the page read aloud hears it as it is said.
  if (local && !/^[a-z]{2,3}$/.test(src.localLang ?? '')) fail(id, 'the name in its own language does not say which language that is (localLang)');

  const parts = (src.flag.parts ?? []).map((part, i) => {
    for (const lang of LANGS) if (!Array.isArray(part?.[lang]) || part[lang].length !== 2 || part[lang].some((p) => typeof p !== 'string' || !p.trim())) fail(id, `part ${i + 1} of the flag has no name and text in «${lang}»`);
    return { es: part.es.map((p) => p.trim()), en: part.en.map((p) => p.trim()) };
  });
  const times = [];
  for (const [i, time] of src.times.entries()) {
    if (!Number.isInteger(time.from) || (time.to !== undefined && (!Number.isInteger(time.to) || time.to < time.from))) fail(id, `time ${i + 1} has no years`);
    if (i && time.from < src.times[i - 1].from) fail(id, `time ${i + 1} is before the one above it`);
    times.push({
      ...flown(id, time, flags),
      from: time.from,
      ...(time.to !== undefined ? { to: time.to } : {}),
      ...(time.when ? { when: said(id, `the days of time ${i + 1}`, time.when) } : {}),
      name: said(id, `the name of time ${i + 1}`, time.name),
      text: said(id, `time ${i + 1}`, time.text),
      ...(time.picture ? { picture: await photograph(id, time.picture, commons, WIDTHS.time, made) } : {}),
    });
  }
  if (times.filter((time) => time.now).length !== 1 || !times[times.length - 1].now) fail(id, 'the last of the times, and only that one, is the flag of today');
  const photos = [];
  for (const [i, one] of src.photos.entries()) photos.push(await photograph(id, one, commons, i ? WIDTHS.photo : WIDTHS.head, made));

  return {
    official: said(id, 'the official name', src.official),
    ...(local ? { local, localLang: src.localLang } : {}),
    about: paragraphs(id, 'what is said of the country', src.about),
    flag: {
      adopted: src.flag.adopted,
      ...(src.flag.changed ? { changed: src.flag.changed } : {}),
      ratio: src.flag.ratio,
      ...(src.flag.called ? { called: said(id, 'what the flag is called', src.flag.called) } : {}),
      ...(src.flag.by ? { by: said(id, 'who made the flag', src.flag.by) } : {}),
      text: paragraphs(id, 'what is said of the flag', src.flag.text),
      parts,
    },
    times,
    photos,
    read: said(id, 'where to read more', src.read),
  };
}

/** One thing laid over another: what the one above says replaces what is under it, and `null` takes it away. */
export function laid(under, over) {
  if (over === null) return undefined;
  if (typeof over !== 'object' || Array.isArray(over) || typeof under !== 'object' || under === null || Array.isArray(under)) return over;
  const out = { ...under };
  for (const [key, value] of Object.entries(over)) {
    const mine = laid(out[key], value);
    if (mine === undefined) delete out[key];
    else out[key] = mine;
  }
  return out;
}

/** A day that there was, or a year alone: «1960-02-30» is neither, though a clock would take it for the first of March. */
const isDay = (text) => {
  if (typeof text !== 'string') return false;
  if (/^\d{4}$/.test(text)) return true;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!m) return false;
  const day = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return day.getUTCMonth() === Number(m[2]) - 1 && day.getUTCDate() === Number(m[3]);
};
const isText = (text) => typeof text === 'string' && text.trim() === text && text.length > 0;
/** A text in one language of the game, or in both: none empty, none in any other. */
const inSome = (text) => !!text && typeof text === 'object' && Object.keys(text).length > 0 && Object.entries(text).every(([lang, words]) => LANGS.includes(lang) && isText(words));

/** The title of a page of Wikipedia, from its address in the Wikipedia of a language. */
function titleIn(address, lang) {
  const start = `https://${lang}.wikipedia.org/wiki/`;
  if (typeof address !== 'string' || !address.startsWith(start)) return null;
  try {
    return decodeURIComponent(address.slice(start.length).split(/[?#]/)[0]).replace(/_/g, ' ').trim();
  } catch {
    return null;
  }
}

/**
 * How the pages that a sheet leads to begin, shortened: in each language of the game whose page was brought.
 * `cut` is what somebody who read them said of each language: `false`, that it is not shown; a number, how
 * many sentences of it are.
 */
function leadIn(links, pages, max, cut = {}) {
  const lead = {};
  for (const lang of LANGS) {
    const title = titleIn(links?.[lang], lang);
    const text = title ? pages[`${lang}:${title}`]?.text : undefined;
    if (!text || cut[lang] === false) continue;
    const mine = leadOf(text, { lang, max, ...(Number.isInteger(cut[lang]) ? { keep: cut[lang] } : {}) });
    if (mine) lead[lang] = mine;
  }
  return Object.keys(lead).length ? lead : null;
}
/** The paragraphs of a text of Wikipedia, in some language of the game: none empty, and each language with the page it is from. */
const isLead = (lead, links) => !!lead && typeof lead === 'object' && Object.keys(lead).length > 0 && Object.entries(lead).every(([lang, text]) => LANGS.includes(lang) && Array.isArray(text) && text.length > 0 && text.every(isText) && isText(links?.[lang]));

/** What the sources and the corrections left of a country, looked at before anybody sees it: a sheet says nothing that is not what it is said to be. */
function checked(id, one) {
  const flag = one.flag ?? {};
  if (one.official !== undefined && !inSome(one.official)) fail(id, 'its official name is not a text in a language of the game');
  if (one.local !== undefined && (!isText(one.local) || !/^[a-z]{2,3}$/.test(one.localLang ?? ''))) fail(id, 'the name in its own language is not a text, or does not say which language that is (localLang)');
  if (one.local === undefined && one.localLang !== undefined) fail(id, 'it names a language of its own and no name in it');
  if (one.motto !== undefined) {
    const { text, lang, ...means } = one.motto;
    if (!isText(text)) fail(id, 'its motto has no words');
    if (lang !== undefined && !/^[a-z]{2,3}$/.test(lang)) fail(id, 'the language of its motto is not the code of one');
    if (Object.keys(means).length && !inSome(means)) fail(id, 'what its motto means is not a text in a language of the game');
  }
  if (one.anthem !== undefined && !inSome(one.anthem)) fail(id, 'its anthem is not a text in a language of the game');
  if (flag.adopted !== undefined && !isDay(flag.adopted)) fail(id, `the day its flag was adopted on is not a day or a year: ${flag.adopted}`);
  if (flag.changed !== undefined && (!isDay(flag.changed) || !flag.adopted || flag.changed.slice(0, 4) < flag.adopted.slice(0, 4))) fail(id, `its flag is said to be as it is since ${flag.changed}, which is not a day after the one it was adopted on`);
  if (flag.ratio !== undefined && !/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(flag.ratio)) fail(id, `the proportions of its flag are not two numbers: ${flag.ratio}`);
  if (flag.colours !== undefined && !(LANGS.every((lang) => Array.isArray(flag.colours[lang]) && flag.colours[lang].length >= 2 && flag.colours[lang].every(isText)) && flag.colours.es.length === flag.colours.en.length))
    fail(id, 'the colours of its flag are not named in both languages');
  if (flag.by !== undefined && !inSome(flag.by)) fail(id, 'who designed its flag is not a text in a language of the game');
  if (one.lead !== undefined && !isLead(one.lead, one.read)) fail(id, 'what Wikipedia begins to tell of it is not paragraphs in a language of the game, each with its page (read)');
  if (flag.lead !== undefined && !isLead(flag.lead, one.readFlag)) fail(id, 'what Wikipedia begins to tell of its flag is not paragraphs in a language of the game, each with its page (readFlag)');
  for (const key of ['read', 'readFlag']) {
    if (one[key] === undefined) continue;
    if (!inSome(one[key]) || Object.entries(one[key]).some(([lang, url]) => !url.startsWith(`https://${lang}.wikipedia.org/wiki/`))) fail(id, `«${key}» is not a page of the Wikipedia of each language`);
  }
  return one;
}

const kB = (bytes) => `${Math.round(bytes / 1024)} kB`;

async function main() {
  const index = read(path.join(DATA, 'index.json'));
  const flags = read(path.join(DATA, 'flags.json'));
  const facts = fs.existsSync(path.join(DATA, 'facts.json')) ? read(path.join(DATA, 'facts.json')) : {};
  if (!fs.existsSync(SAID)) throw new Error(`What Wikidata and Wikipedia say of the countries is not in ${path.relative(ROOT, SAID) || SAID}: run «npm run data:fetch -- countries-said»`);
  const told = read(SAID);
  if (!fs.existsSync(TEXTS)) throw new Error(`How Wikipedia begins to tell of the countries is not in ${path.relative(ROOT, TEXTS) || TEXTS}: run «npm run data:fetch -- countries-texts»`);
  const pages = read(TEXTS).pages ?? {};
  const { _: _why, ...fixes } = fs.existsSync(FIXES) ? read(FIXES) : {};
  const { _: _what, ...heads } = fs.existsSync(HEADS) ? read(HEADS) : {};
  const about = path.join(BROUGHT, 'photos.json');
  const commons = fs.existsSync(about) ? read(about) : null;
  const review = args.includes('--review');
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PICTURES, { recursive: true });

  const lands = index.countries.filter((c) => c.fl);
  for (const id of Object.keys(fixes)) if (!lands.some((c) => c.id === id)) throw new Error(`${path.basename(FIXES)} corrects «${id}», which is no country of the game with a flag`);
  const written = fs.existsSync(SHEETS) ? fs.readdirSync(SHEETS).filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json')) : [];
  for (const id of written) if (!lands.some((c) => c.id === id)) fail(id, 'the game has no such country with a flag');
  for (const id of Object.keys(heads)) if (!lands.some((c) => c.id === id)) throw new Error(`${path.basename(HEADS)} chooses a photograph for «${id}», which is no country of the game with a flag`);

  const codes = tongueCodes(facts);
  const made = new Set();
  /** What each sheet says, by its country; and the sheets as they are written, by the name of the file of each. */
  const sheets = new Map();
  const out = new Map();
  const count = { official: 0, motto: 0, anthem: 0, adopted: 0, ratio: 0, lead: 0, flagLead: 0, head: 0 };
  /** What somebody who read the openings said of them, by country. */
  const cuts = new Map();
  let bytes = 0;
  for (const country of lands) {
    const { id } = country;
    const flown = (flags.past?.[id] ?? []).map((row) => [row[2], row[3]]);
    const { given, notes } = saidOf({ country, said: told, tongues: facts.c?.[id]?.l ?? [], codes, flown });
    if (review && notes.length) console.log(`  ${id}: ${notes.join(' · ')}${fixes[id] ? `  [corregido a mano: ${Object.keys(fixes[id]).join(', ')}]` : ''}`);
    // What is said of the openings of Wikipedia is not something the sheet says: it is kept for when they are cut.
    const { leads: cut, ...fix } = fixes[id] ?? {};
    if (cut) cuts.set(id, cut);
    let one = laid(given, fix) ?? {};
    if (written.includes(id)) {
      const mine = await sheet(path.join(SHEETS, `${id}.json`), commons, index, flags, made);
      // Whoever wrote of the flag told its colours in words: the list of them is not said twice.
      const { colours: _told, ...read } = one.flag ?? {};
      one = { ...one, ...mine, flag: { ...read, ...mine.flag } };
      const pictures = [...mine.photos, ...mine.times.flatMap((time) => (time.picture ? [time.picture] : []))];
      const weight = pictures.flatMap((p) => p.sizes.map((w) => fs.statSync(path.join(PICTURES, `${p.file}-${w}.webp`)).size)).reduce((a, b) => a + b, 0);
      console.log(`  ${id}: escrita a mano; ${mine.times.length} tiempos; ${pictures.length} fotografías en ${pictures.reduce((n, p) => n + p.sizes.length, 0)} imágenes, ${kB(weight)}`);
    } else if (heads[id]) {
      // Nobody has written of it: at its head, the photograph that was chosen for it.
      one = { ...one, photos: [await photograph(id, heads[id], commons, WIDTHS.chosen, made)] };
      count.head++;
    }
    sheets.set(id, one);
  }
  // A territory that the game draws with the flag of its country says whose it is, and of that flag what
  // the sheet of that country says: one thing said in one place.
  for (const [id, one] of sheets) {
    const of = one.flag?.of;
    if (of === undefined) continue;
    const theirs = sheets.get(of);
    if (!theirs || of === id) fail(id, `its flag is said to be that of «${of}», which is no other country of the game with a flag`);
    if (theirs.flag?.of !== undefined) fail(id, `its flag is said to be that of «${of}», whose flag is that of another`);
    if (written.includes(id)) fail(id, 'somebody wrote of its flag, which is said to be that of another country');
    one.flag = { of, ...Object.fromEntries(FLAG_FACTS.filter((key) => theirs.flag?.[key] !== undefined).map((key) => [key, theirs.flag[key]])) };
    if (theirs.readFlag) one.readFlag = theirs.readFlag;
    else delete one.readFlag;
  }
  // Where nobody has written of a country or of its flag, how Wikipedia begins to tell of them. Of a flag
  // that is that of another country, what was said of the openings of that country's flag holds.
  for (const [id, one] of sheets) {
    const lead = one.about ? null : leadIn(one.read, pages, LEAD_MAX.about, cuts.get(id)?.about);
    if (lead) one.lead = lead;
    const flagLead = one.flag?.text ? null : leadIn(one.readFlag, pages, LEAD_MAX.flag, cuts.get(one.flag?.of ?? id)?.flag);
    if (flagLead) one.flag = { ...(one.flag ?? {}), lead: flagLead };
  }
  for (const [id, one] of sheets) {
    if (one.flag && !Object.keys(one.flag).length) delete one.flag;
    const text = JSON.stringify({ v: 1, id, ...checked(id, one) });
    out.set(`${id}.json`, text);
    bytes += text.length;
    if (one.official) count.official++;
    if (one.motto) count.motto++;
    if (one.anthem) count.anthem++;
    if (one.flag?.adopted) count.adopted++;
    if (one.flag?.ratio) count.ratio++;
    if (one.lead) count.lead++;
    if (one.flag?.lead) count.flagLead++;
  }
  // Every sheet could be made: only now is any written, so that one that could not leaves them all as they were.
  for (const [name, text] of out) fs.writeFileSync(path.join(OUT, name), text);
  // What no sheet shows any more is not kept.
  for (const name of fs.readdirSync(OUT)) if (!out.has(name)) fs.rmSync(path.join(OUT, name));
  for (const name of fs.readdirSync(PICTURES)) if (!made.has(name)) fs.rmSync(path.join(PICTURES, name));
  console.log(
    `${out.size} fichas en ${path.relative(ROOT, OUT) || OUT} (${kB(bytes)}): ${written.length} escritas a mano; nombre oficial en ${count.official}, lema en ${count.motto}, himno en ${count.anthem}, ` +
      `fecha de la bandera en ${count.adopted}, proporción en ${count.ratio}; texto de Wikipedia del país en ${count.lead} y de la bandera en ${count.flagLead}; fotografía de cabecera elegida en ${count.head}; ${Object.keys(fixes).length} países con correcciones a mano. ${made.size} imágenes en ${path.relative(ROOT, PICTURES) || PICTURES}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
