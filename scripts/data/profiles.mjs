// Makes the sheets of the countries that the gallery of flags shows (src/screens/FlagProfile.tsx).
//
//   npm run data:fetch -- photos     the photographs, into .cache/src/photos (see photos-pinned.mjs)
//   npm run data:profiles            the sheets and their pictures
//
// (`--sheets`, `--brought`, `--data` and `--photos` name other folders to read from and write to: the tests
// run it on a country made up for the occasion.)
//
// What goes in:
//
//   · scripts/data/profiles/<country>.json: what is written of the country by hand, in the two languages of
//     the game — what it is, what its flag means, what it was at the time of each of the flags it flew — and
//     the photographs it is shown with, each a file of Wikimedia Commons named by its title, with its caption;
//   · .cache/src/photos: what Commons says of each of those files (who made it and on what terms it is
//     given: photos.json) and the picture of it that Wikimedia draws, 1920 px wide. The workflow "Traer
//     datos" brings them (scripts/data/outside.mjs, source `photos`);
//   · public/data/index.json and flags.json: the country has to be one of the game, and each of its times
//     one of the flags the game has.
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
/** The data of the game: read, and where the sheets are written (under `profiles`). */
const DATA = path.resolve(ROOT, value('data') ?? 'public/data');
const OUT = path.join(DATA, 'profiles');
/** Where the pictures are written. */
const PICTURES = path.resolve(ROOT, value('photos') ?? 'public/photos');

/**
 * How wide each photograph is kept, in px, by where the sheet shows it: the one at its head, which is as
 * wide as the sheet and is drawn with two dots to one on many screens; the ones of its gallery, two abreast;
 * and the one of a time, beside a paragraph. The browser takes the narrowest that fills its box.
 */
export const WIDTHS = { head: [640, 1280, 1920], photo: [640, 1280], time: [640] };
/** How much of what is seen is kept when a picture is made lighter: past this, a sky starts to show bands. */
const QUALITY = 78;
/** The terms a photograph may be given on to be shown here: none that forbids reusing it or changing its size. */
const FREE = /^(CC0|CC BY(-SA)? \d|Public domain)/;
const LANGS = ['es', 'en'];

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
      await sharp(from).resize({ width: w }).webp({ quality: QUALITY, effort: 6 }).toFile(path.join(PICTURES, dest));
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

async function sheet(file, commons, index, flags, made) {
  const id = path.basename(file, '.json');
  const src = read(file);
  if (src.id !== id) fail(id, `the file says it is of «${src.id}»`);
  if (!index.countries.some((c) => c.id === id)) fail(id, 'the game has no such country');
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
    v: 1,
    id,
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

const kB = (bytes) => `${Math.round(bytes / 1024)} kB`;

async function main() {
  const index = read(path.join(DATA, 'index.json'));
  const flags = read(path.join(DATA, 'flags.json'));
  const about = path.join(BROUGHT, 'photos.json');
  if (!fs.existsSync(about)) throw new Error(`What Commons says of the photographs is not in ${path.relative(ROOT, BROUGHT) || BROUGHT}: run «npm run data:fetch -- photos»`);
  const commons = read(about);
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PICTURES, { recursive: true });

  const made = new Set();
  const written = new Set();
  for (const name of fs.readdirSync(SHEETS).filter((f) => f.endsWith('.json')).sort()) {
    const one = await sheet(path.join(SHEETS, name), commons, index, flags, made);
    const text = JSON.stringify(one);
    fs.writeFileSync(path.join(OUT, name), text);
    written.add(name);
    const mine = [...one.photos, ...one.times.flatMap((time) => (time.picture ? [time.picture] : []))];
    const bytes = mine.flatMap((p) => p.sizes.map((w) => fs.statSync(path.join(PICTURES, `${p.file}-${w}.webp`)).size)).reduce((a, b) => a + b, 0);
    console.log(`  ${name}: ${kB(text.length)}; ${one.times.length} tiempos; ${mine.length} fotografías en ${mine.reduce((n, p) => n + p.sizes.length, 0)} imágenes, ${kB(bytes)}`);
  }
  // What no sheet shows any more is not kept.
  for (const name of fs.readdirSync(OUT)) if (!written.has(name)) fs.rmSync(path.join(OUT, name));
  for (const name of fs.readdirSync(PICTURES)) if (!made.has(name)) fs.rmSync(path.join(PICTURES, name));
  console.log(`${written.size} fichas en ${path.relative(ROOT, OUT) || OUT}, ${made.size} imágenes en ${path.relative(ROOT, PICTURES) || PICTURES}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
