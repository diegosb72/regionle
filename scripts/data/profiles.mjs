// Makes the sheets of the countries that the gallery of flags shows (src/screens/FlagProfile.tsx): one for
// every country of the game that has a flag.
//
//   npm run data:fetch -- countries-said   what Wikidata and Wikipedia say of each country, into .cache/src
//   npm run data:fetch -- countries-texts  how Wikipedia begins to tell of each and of its flag, into .cache/src
//   npm run data:fetch -- photos           the photographs, into .cache/src/photos (see photos-pinned.mjs)
//   npm run data:fetch -- arms             the coats of arms, into .cache/src/arms (see arms-pinned.mjs)
//   npm run data:profiles                  the sheets and their pictures
//   npm run data:profiles -- --review      the same, and what whoever corrects the sources should look at
//
// (`--sheets`, `--brought`, `--arms`, `--said`, `--texts`, `--fixes`, `--heads`, `--gallery`, `--release`, `--times`,
// `--data` and `--photos` name other folders and files to read from and write to: tests use invented countries.
// The uploaded gallery is used in the normal build, or explicitly with `--release` in a fixture, not implicitly
// when `--data` points at a different world.)
//
// A sheet is made of four things, each laid over the one before:
//
//   1. What Wikidata and Wikipedia say of the country and of its flag (profiles-said.mjs reads it from
//      .cache/src/countries-said.json, which the workflow "Traer datos" brought: scripts/data/outside.mjs,
//      source `countries`): what it is called in full, its motto, its anthem, since when its flag is flown,
//      its proportions and its colours. Every country has this, as far as the sources say it.
//   2. scripts/data/profiles-fixes.json: what was corrected by hand after reading it (profiles-fixes.md
//      tells why). No program writes that file, so bringing the sources again undoes nothing.
//      A few territories have sourced, bilingual summaries here (`about`, `flag.text`/`parts`, `sources`):
//      these replace Wikipedia excerpts, not the photographs or historical flag timelines.
//      A territory that the game draws with the flag of its country (Réunion with that of France, Svalbard
//      with that of Norway) is told there whose flag it is (`flag.of`), and says of it what that country says.
//   3. scripts/data/profiles-times.json, where someone has researched its history: the flags of each period
//      and what happened then, in both languages, without replacing the photograph or the Wikipedia texts.
//      The year a flag is displayed with may differ from Wikidata's range when that range is wrong: `past`
//      identifies the image in the game's flags, `pastFile` distinguishes two with the same catalogue
//      years, and `from`/`to` are the checked years shown to the reader.
//      scripts/data/profiles-gallery.json can add captioned Commons photographs after a chosen head without
//      writing a full sheet or changing that photograph. The same list is fetched by outside.mjs.
//      scripts/data/release-gallery.json adds reviewed 640-px WebP photographs from the owner's archive
//      after every existing selection; each file and its Commons licence is pinned and checked, not
//      regenerated from an uploaded country JSON.
//   4. scripts/data/profiles/<country>.json, where there is one: what is written of the country by hand, in
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
// Each sheet shows the coat of arms of its country too — or its emblem, or its seal —, small: the file
// Wikidata shows the country with (P94), unless profiles-fixes.json says another or none (`arms`), as the
// workflow brought it (source `arms`: .cache/src/arms). A territory that the game draws with the flag of its
// country shows none: the ones such territories are given are seldom official.
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
//     the first ten figures of the SHA-1 of its original, and each coat of arms, made to fit in a small
//     box. A picture no sheet shows any more is removed.
//
// The pictures are not part of what the game stores to work without a connection (scripts/pwa/build.mjs):
// each is fetched when its sheet is opened, and kept from then on.

import { createHash } from 'node:crypto';
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
/** What was brought of the coats of arms: what Commons says of each (arms.json) and a picture of each. */
const ARMS = path.resolve(ROOT, value('arms') ?? '.cache/src/arms');
/** What Wikidata and Wikipedia say of each country, as it was brought, and what was corrected of it by hand. */
const SAID = path.resolve(ROOT, value('said') ?? '.cache/src/countries-said.json');
const FIXES = path.resolve(ROOT, value('fixes') ?? 'scripts/data/profiles-fixes.json');
/** The photograph chosen for the head of the sheet of each country nobody has written of, with what is seen in it. */
const HEADS = path.resolve(ROOT, value('heads') ?? 'scripts/data/profiles-heads.json');
/** Further Commons photographs, with bilingual captions, without replacing the one chosen for the head. */
const GALLERY = path.resolve(ROOT, value('gallery') ?? 'scripts/data/profiles-gallery.json');
/** Reviewed, credited and hash-pinned photos from the owner's archive, layered after every existing gallery. */
const RELEASE = path.resolve(ROOT, value('release') ?? 'scripts/data/release-gallery.json');
/** An invented world with `--data` does not silently receive the real-world release gallery. */
const USE_RELEASE = !args.includes('--data') || args.includes('--release');
/** Historical timelines written for the game without replacing the rest of each country's sheet. */
const TIMES = path.resolve(ROOT, value('times') ?? 'scripts/data/profiles-times.json');
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
/** The side of the box a coat of arms is made to fit in, in px: twice that of the box the sheet shows it in. */
export const ARMS_BOX = 264;
/**
 * How its picture is kept. What is not drawn stays see-through, so that the sheet decides what is behind it;
 * how see-through each point is weighs more than its colours in a drawing this small, and is kept less finely.
 */
const ARMS_WEBP = { quality: 82, alphaQuality: 70, effort: 4 };
/**
 * The terms a coat of arms may be given on: those of a photograph, and the one Commons calls «Attribution»,
 * by which whoever holds the rights lets anybody use the drawing for anything as long as they are named.
 */
const ARMS_FREE = /^(CC0|CC BY(-SA)? \d|Public domain|Attribution$)/;
/** The longest name that is taken from Commons for whoever drew one, in characters: it goes under a small picture. */
const ARMS_BY = 40;
/** What such a thing is called when it is not a coat of arms, by a word of how its file is called. */
const ARMS_KINDS = [
  ['emblem', /embl[eè]m|國徽|badge/i],
  ['seal', /\b(seal|sello|sceau)\b|kamon/i],
];
/** How much of what is seen is kept when a picture is made lighter: past this, a sky starts to show bands. */
const QUALITY = 78;
/** The least that is kept of a picture that comes out too heavy; and how heavy a picture may be, in bytes, by its width. */
const QUALITY_LEAST = 48;
export const HEAVY = (width) => (width > 1280 ? 420_000 : 300_000);
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
  // A work whose author has to be named has one to name. A site requested in the credit must be a safe link,
  // shown with the explicit credit from the sheet rather than an unverified link in Commons metadata.
  if (!by && file.attribution) fail(id, `«${title}» has to be attributed and Commons names nobody: say who made it (by)`);
  if (one.byUrl !== undefined) {
    if (typeof one.byUrl !== 'string' || !one.by?.trim()) fail(id, `«${title}» needs a named author (by) to link a credit site (byUrl)`);
    const url = URL.canParse(one.byUrl) ? new URL(one.byUrl) : null;
    if (url?.protocol !== 'https:' || url.username || url.password || !url.hostname) fail(id, `«${title}» has no safe https credit site (byUrl)`);
  }
  const text = said(id, `the photograph «${title}»`, one);
  const name = file.sha1.slice(0, 10);
  const { width, height } = await sharp(from).metadata();
  const sizes = widths.filter((w) => w <= width);
  if (!sizes.length) sizes.push(width);
  for (const w of sizes) {
    const dest = `${name}-${w}.webp`;
    if (!made.has(dest)) {
      // A picture is named after what it is made from and how wide it is: one that is there is that one, and is not made again.
      if (!fs.existsSync(path.join(PICTURES, dest))) {
        // Fine foliage and water may still be too heavy at the lowest quality. Smooth only as much of
        // that detail as is needed, then try the qualities again; never silently ship an oversized image.
        let picture;
        for (const soften of [0, 0.6, 0.8, 1, 1.3, 1.6]) {
          for (let quality = QUALITY; quality >= QUALITY_LEAST; quality -= 6) {
            const image = sharp(from).resize({ width: w });
            picture = await (soften ? image.blur(soften) : image).webp({ quality, effort: 6 }).toBuffer();
            if (picture.length <= HEAVY(w)) break;
          }
          if (picture.length <= HEAVY(w)) break;
        }
        if (picture.length > HEAVY(w)) fail(id, `«${title}» is too heavy to show at ${w} px (${picture.length} bytes)`);
        fs.writeFileSync(path.join(PICTURES, dest), picture);
      }
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
    ...(one.byUrl ? { byUrl: one.byUrl } : {}),
    licence: file.licence,
    ...(file.licenceUrl ? { licenceUrl: file.licenceUrl.replace(/^http:/, 'https:') } : {}),
    ...text,
    ...(focus ? { focus } : {}),
  };
}

/** A reviewed photo from the release is already a WebP. Verify its pinned bytes instead of fetching the
 * uploaded profile or trusting a path or licence from the ZIP at build time. Existing heads are untouched. */
async function uploadedPhotograph(id, one, made) {
  const fields = ['file', 'w', 'h', 'sizes', 'title', 'by', 'byUrl', 'licence', 'licenceUrl', 'es', 'en', 'focus', 'sha256'];
  if (!one || typeof one !== 'object' || Object.keys(one).some((key) => !fields.includes(key))) fail(id, 'the uploaded gallery has an unexpected photograph field');
  if (!/^[a-f0-9]{10}$/.test(one.file ?? '') || !/^[a-f0-9]{64}$/.test(one.sha256 ?? '')) fail(id, 'an uploaded photo has no pinned image and checksum');
  if (!Number.isInteger(one.w) || !Number.isInteger(one.h) || one.w < 640 || one.h < 1 || JSON.stringify(one.sizes) !== '[640]') fail(id, `«${one.title}» has unexpected uploaded image dimensions`);
  if (typeof one.title !== 'string' || !/\.(jpe?g|png|tiff?)$/i.test(one.title)) fail(id, 'an uploaded photo has no Commons title');
  if (!FREE.test(one.licence ?? '')) fail(id, `«${one.title}» has no known free licence`);
  if ((one.licence ?? '').startsWith('CC') && (!URL.canParse(one.licenceUrl ?? '') || new URL(one.licenceUrl).hostname !== 'creativecommons.org' || new URL(one.licenceUrl).protocol !== 'https:')) fail(id, `«${one.title}» has no safe licence URL`);
  if (one.by !== undefined && (typeof one.by !== 'string' || !one.by.trim() || one.by.length > 60)) fail(id, `«${one.title}» has no short, named author`);
  if (/^CC BY/.test(one.licence) && !one.by) fail(id, `«${one.title}» requires a named author`);
  if (one.byUrl !== undefined) {
    const url = typeof one.byUrl === 'string' && URL.canParse(one.byUrl) ? new URL(one.byUrl) : null;
    if (!one.by || url?.protocol !== 'https:' || url.username || url.password || !url.hostname) fail(id, `«${one.title}» has no safe https credit site (byUrl)`);
  }
  said(id, `the uploaded photograph «${one.title}»`, one);
  if (one.focus !== undefined && (!Array.isArray(one.focus) || one.focus.length !== 2 || one.focus.some((n) => !Number.isFinite(n) || n < 0 || n > 100))) fail(id, `«${one.title}» has an invalid focus`);
  const name = `${one.file}-640.webp`;
  const imagePath = path.join(PICTURES, name);
  if (!fs.existsSync(imagePath)) fail(id, `the pinned uploaded photo is missing: ${name}`);
  const bytes = fs.readFileSync(imagePath);
  if (bytes.length < 2_000 || bytes.length > HEAVY(640) || bytes.subarray(8, 12).toString('latin1') !== 'WEBP' || createHash('sha256').update(bytes).digest('hex') !== one.sha256) fail(id, `the uploaded photo does not match its pinned image: ${name}`);
  const shape = await sharp(bytes).metadata();
  if (shape.format !== 'webp' || shape.width !== 640 || !shape.height || Math.abs(shape.height - Math.round(640 * one.h / one.w)) > 2) fail(id, `the uploaded photo is not a 640 px WebP with its declared proportions: ${name}`);
  made.add(name);
  const { sha256: _checksum, ...photo } = one;
  return photo;
}

/** What tells that Commons says something other than a name where it says who made a file, or more than fits under it. */
const UNTIDY = /…|^(?:unknown|anonymous|various|see\b|desconocido|unbekannt|inconnu|n\/a)|\b(?:unknown author|file history|see below|e\.g\.|uploader|UTC|own work|based on|derivative|collection)\b|version|Bot\b|\bSVG\b(?!-)|https?:|www\.|\.(?:svg|png|jpe?g)\b|[:[\]]/i;

/**
 * Who made something, as Commons tells it, in the few words that fit under it: the names, one after
 * another where it tells which part each had. None where Commons names nobody, tells it at length, or
 * tells something else in its place (how the file was made, where its history is).
 */
export function maker(artist, most = 60) {
  const text = String(artist ?? '')
    .replace(/\bi?\s*The source code of this SVG is [^.]*\./gi, ' ')
    .replace(/\bThis (?:W3C-(?:un)?specified |W3C-invalid )?(?:vector image|file|image) (?:was|is) (?:created|made) with [^.]*\.?/gi, ' ')
    .replace(/\(\s*(?:talk|talk\s*·\s*contribs|contribs)\s*\)/gi, ' ')
    .replace(/\b(?:[a-z]{2,3}:)?User:/gi, '')
    .replace(/\bThe original uploader was\s+/gi, '')
    .replace(/\s+at (?:the )?[A-Z][a-z]+ Wikipedia\b/g, '')
    .replace(/\b(?:Original|Vector|Upload|First version|Second version|Autor of SVG image|Author)\s*:/gi, ',')
    .replace(/,?\s*\b(?:with some elements by|including elements from|modified by|vectori[sz]ed by|vectored by|redrawn to SVG by|extracted by|original(?: design)? by|originally)\s+/gi, ', ')
    .replace(/\s+([,;.)])/g, '$1')
    .replace(/\(\s+/g, '(')
    .replace(/\s+/g, ' ')
    .replace(/(?:,\s*)+/g, ', ')
    .replace(/^[\s,;:.·-]+|[\s,;:.·-]+$/g, '')
    .trim();
  return !text || text.length > most || UNTIDY.test(text) ? '' : text;
}

/**
 * The coat of arms of a country as the sheet shows it — or its emblem, or its seal: its picture, made here
 * to fit in a small box with what is around it cut off, and whose the drawing is. `must` says that somebody
 * chose this file by hand: one that cannot be shown then stops the script; otherwise the sheet goes
 * without, and `why` is told what was wrong with it.
 */
async function emblem(id, one, commons, made, must, why) {
  const refuse = (what) => {
    if (must) fail(id, what);
    why(what);
    return null;
  };
  const title = typeof one?.file === 'string' ? one.file.trim() : '';
  if (!title) fail(id, 'its coat of arms names no file');
  if (one.kind !== undefined && !['arms', 'emblem', 'seal'].includes(one.kind)) fail(id, `its coat of arms is said to be a «${one.kind}», which is none of arms, emblem and seal`);
  const file = commons.files?.[title];
  if (!file || file.missing) return refuse(`Commons was not asked about «${title}», or has no such file: ask for the source «arms» (scripts/data/pedido.txt) and pin what comes (scripts/data/arms-pinned.mjs)`);
  if (!file.picture) return refuse(`the picture of «${title}» was not brought`);
  if (!ARMS_FREE.test(file.licence ?? '')) return refuse(`«${title}» is given on terms that are not known to be free: ${file.licence || 'none said'}`);
  const from = path.join(ARMS, path.basename(file.picture));
  if (!fs.existsSync(from)) return refuse(`the picture of «${title}» is not among what was brought: pin it (scripts/data/arms-pinned.mjs) and run «npm run data:fetch -- arms»`);
  const by = (typeof one.by === 'string' && one.by.trim()) || maker(file.artist, ARMS_BY);
  // A work whose author has to be named has one to name, in words that fit under it.
  if (!by && (file.attribution || file.licence === 'Attribution')) return refuse(`«${title}» has to be attributed and Commons does not say to whom in a few words (${file.artist || 'nobody'}): say who made it (arms.by)`);
  // What is around the drawing is cut off, so that every coat of arms fills its box; one that is all of one colour is left as it is.
  let [drawing, shape] = [sharp(from), null];
  try {
    const cut = await sharp(from).trim().toBuffer({ resolveWithObject: true });
    [drawing, shape] = [sharp(cut.data), cut.info];
  } catch {
    shape = await sharp(from).metadata();
  }
  const scale = Math.min(1, ARMS_BOX / shape.width, ARMS_BOX / shape.height);
  const [w, h] = [Math.max(1, Math.round(shape.width * scale)), Math.max(1, Math.round(shape.height * scale))];
  const name = file.sha1.slice(0, 10);
  const dest = `${name}-${w}.webp`;
  if (!made.has(dest)) {
    if (!fs.existsSync(path.join(PICTURES, dest))) await drawing.resize(w, h, { fit: 'fill' }).webp(ARMS_WEBP).toFile(path.join(PICTURES, dest));
    made.add(dest);
  }
  const kind = one.kind ?? ARMS_KINDS.find(([, words]) => words.test(title))?.[0] ?? 'arms';
  return {
    file: name,
    w,
    h,
    title,
    ...(by ? { by } : {}),
    licence: file.licence,
    ...(file.licenceUrl ? { licenceUrl: file.licenceUrl.replace(/^http:/, 'https:') } : {}),
    ...(kind !== 'arms' ? { kind } : {}),
  };
}

/** The flag of a time of the country, as the game has it: one it flew before, that of what it was then, or the one it flies. */
function flown(id, time, flags) {
  if ([time.now, time.gone, time.past].filter((one) => one !== undefined).length !== 1) fail(id, 'a time must name exactly one flag: «now», «gone» or «past»');
  if (time.pastFile !== undefined && (!Array.isArray(time.past) || typeof time.pastFile !== 'string' || !time.pastFile)) fail(id, 'a past flag file can only identify a past flag');
  if (time.now === true) return { now: true };
  if (typeof time.gone === 'string') {
    if (!flags.gone.some((row) => row[0] === time.gone)) fail(id, `the game has no flag of «${time.gone}», which is no more`);
    return { gone: time.gone };
  }
  if (Array.isArray(time.past) && time.past.length === 2 && time.past.every(Number.isInteger)) {
    const [from, to] = time.past;
    if ((flags.past?.[id] ?? []).filter((row) => row[2] === from && row[3] === to && (time.pastFile === undefined || row[0] === time.pastFile)).length !== 1) fail(id, `the game has no unique flag that the country flew from ${from} to ${to}${time.pastFile ? ` with file ${time.pastFile}` : ''}`);
    return { past: [from, to], ...(time.pastFile ? { pastFile: time.pastFile } : {}) };
  }
  return fail(id, 'a time names no flag: «now», «gone» or «past»');
}

/**
 * The historical periods of a country. `past` finds the drawing in the game's catalogue; it may carry
 * unchecked Wikidata years. The years here, which are shown on the sheet, can instead be checked against
 * the sources beside the hand-written timeline (and `when` can explain a discontinuous period).
 */
async function timesOf(id, source, flags, commons, made) {
  if (!Array.isArray(source) || source.length < 2) fail(id, 'a historical timeline needs at least one earlier flag and the flag of today');
  const times = [];
  const thisYear = new Date().getUTCFullYear();
  for (const [i, time] of source.entries()) {
    if (!time || !Number.isInteger(time.from) || time.from < 1 || time.from > thisYear || (time.to !== undefined && (!Number.isInteger(time.to) || time.to < time.from || time.to > thisYear))) fail(id, `time ${i + 1} has no valid years`);
    if (i && time.from < source[i - 1].from) fail(id, `time ${i + 1} is before the one above it`);
    const flag = flown(id, time, flags);
    if (flag.now && time.to !== undefined) fail(id, 'the flag of today cannot have an ending year');
    if (!flag.now && time.to === undefined) fail(id, `time ${i + 1} has no ending year`);
    times.push({
      ...flag,
      from: time.from,
      ...(time.to !== undefined ? { to: time.to } : {}),
      ...(time.when ? { when: said(id, `the days of time ${i + 1}`, time.when) } : {}),
      name: said(id, `the name of time ${i + 1}`, time.name),
      text: said(id, `time ${i + 1}`, time.text),
      ...(time.picture ? { picture: await photograph(id, time.picture, commons, WIDTHS.time, made) } : {}),
    });
  }
  if (times.filter((time) => time.now).length !== 1 || !times[times.length - 1].now) fail(id, 'the last of the times, and only that one, is the flag of today');
  return times;
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
  const times = await timesOf(id, src.times, flags, commons, made);
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
  // Authored summaries in the corrections must meet the same bilingual standard as a complete hand-written sheet.
  if (one.about !== undefined) paragraphs(id, 'what is said of the country', one.about);
  if (flag.text !== undefined) paragraphs(id, 'what is said of the flag', flag.text);
  if (flag.parts !== undefined) {
    if (!Array.isArray(flag.parts)) fail(id, 'the parts of the flag are not a list');
    for (const [i, part] of flag.parts.entries()) {
      if (!LANGS.every((lang) => Array.isArray(part?.[lang]) && part[lang].length === 2 && part[lang].every(isText))) fail(id, `part ${i + 1} of the flag has no name and text in both languages`);
    }
  }
  if (one.sources !== undefined) {
    if (!one.sources || typeof one.sources !== 'object' || Array.isArray(one.sources) || !Object.keys(one.sources).length) fail(id, 'its text sources are not grouped by section');
    for (const [section, sources] of Object.entries(one.sources)) {
      if (!['about', 'flag'].includes(section) || !(section === 'about' ? one.about : flag.text) || !Array.isArray(sources) || !sources.length) fail(id, `its text sources for «${section}» have no matching text or links`);
      for (const source of sources) {
        const url = typeof source?.url === 'string' && URL.canParse(source.url) ? new URL(source.url) : null;
        if (!source || Object.keys(source).some((key) => !['title', 'url'].includes(key)) || !source.title || !LANGS.every((lang) => isText(source.title[lang])) || Object.keys(source.title).some((lang) => !LANGS.includes(lang)) || url?.protocol !== 'https:' || url.username || url.password || !url.hostname)
          fail(id, `its text source for «${section}» needs a safe https address and a title in both languages`);
      }
    }
  }
  if (flag.adopted !== undefined && !isDay(flag.adopted)) fail(id, `the day its flag was adopted on is not a day or a year: ${flag.adopted}`);
  if (flag.changed !== undefined && (!isDay(flag.changed) || !flag.adopted || flag.changed.slice(0, 4) < flag.adopted.slice(0, 4))) fail(id, `its flag is said to be as it is since ${flag.changed}, which is not a day after the one it was adopted on`);
  if (flag.ratio !== undefined && !/^\d+(\.\d+)?:\d+(\.\d+)?$/.test(flag.ratio)) fail(id, `the proportions of its flag are not two numbers: ${flag.ratio}`);
  if (flag.colours !== undefined && !(LANGS.every((lang) => Array.isArray(flag.colours[lang]) && flag.colours[lang].length >= 2 && flag.colours[lang].every(isText)) && flag.colours.es.length === flag.colours.en.length))
    fail(id, 'the colours of its flag are not named in both languages');
  if (flag.by !== undefined && !inSome(flag.by)) fail(id, 'who designed its flag is not a text in a language of the game');
  // The exceptional country SVG replaces the flag-icons version throughout the site. Its provenance is
  // explained and credited in the sheet, including where another national flag is still in use.
  if (flag.drawing !== undefined) {
    const { file, title, by, licence, note } = flag.drawing;
    if (file !== `${id.toLowerCase()}.svg` || !fs.existsSync(path.join(ROOT, 'scripts/data/flag-overrides', file)) || !isText(title) || !title.endsWith('.svg') || !isText(by) || !ARMS_FREE.test(licence ?? '') || !flag.ratio || !note || !LANGS.every((lang) => isText(note[lang])))
      fail(id, 'the country flag replacement needs a local SVG, its Commons provenance, a ratio and an explanation in both languages');
  }
  if (one.lead !== undefined && !isLead(one.lead, one.read)) fail(id, 'what Wikipedia begins to tell of it is not paragraphs in a language of the game, each with its page (read)');
  if (flag.lead !== undefined && !isLead(flag.lead, one.readFlag)) fail(id, 'what Wikipedia begins to tell of its flag is not paragraphs in a language of the game, each with its page (readFlag)');
  if (one.arms !== undefined) {
    const { file, w, h, title, licence, kind } = one.arms;
    if (!/^[0-9a-f]{10}$/.test(file ?? '') || !(w > 0 && h > 0 && w <= ARMS_BOX && h <= ARMS_BOX) || !isText(title) || !ARMS_FREE.test(licence ?? '') || (kind !== undefined && !['emblem', 'seal'].includes(kind)))
      fail(id, 'its coat of arms is not a picture that fits its box, with its title and the free terms it is given on');
  }
  if (one.timeSource !== undefined) {
    const url = URL.canParse(one.timeSource) ? new URL(one.timeSource) : null;
    if (url?.protocol !== 'https:' || url.username || url.password || !url.hostname || !one.times?.length) fail(id, 'its timeline has no safe https source');
  }
  if (one.timeNote !== undefined && (!one.timeSource || !inSome(one.timeNote) || !LANGS.every((lang) => isText(one.timeNote[lang])))) fail(id, 'the note on its timeline is not said in both languages');
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
  const { _: _gallery, ...gallery } = fs.existsSync(GALLERY) ? read(GALLERY) : {};
  if (args.includes('--release') && !fs.existsSync(RELEASE)) throw new Error(`The reviewed release gallery is missing: ${RELEASE}`);
  const uploaded = USE_RELEASE && fs.existsSync(RELEASE) ? read(RELEASE).countries : {};
  if (!uploaded || typeof uploaded !== 'object' || Array.isArray(uploaded)) throw new Error('The reviewed release gallery has no country lists');
  const { _: _timeline, ...timelines } = fs.existsSync(TIMES) ? read(TIMES) : {};
  if (!fs.existsSync(path.join(ARMS, 'arms.json'))) throw new Error(`What was brought of the coats of arms is not in ${path.relative(ROOT, ARMS) || ARMS}: run «npm run data:fetch -- arms»`);
  const emblems = read(path.join(ARMS, 'arms.json'));
  const about = path.join(BROUGHT, 'photos.json');
  const commons = fs.existsSync(about) ? read(about) : null;
  const review = args.includes('--review');
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(PICTURES, { recursive: true });

  const lands = index.countries.filter((c) => c.fl);
  for (const [id, fix] of Object.entries(fixes)) {
    if (!lands.some((c) => c.id === id)) throw new Error(`${path.basename(FIXES)} corrects «${id}», which is no country of the game with a flag`);
    if (fix?.about && !fix.sources?.about?.length) fail(id, 'an authored account of the country needs its sources');
    if (fix?.flag?.text && !fix.sources?.flag?.length) fail(id, 'an authored account of the flag needs its sources');
  }
  const written = fs.existsSync(SHEETS) ? fs.readdirSync(SHEETS).filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json')) : [];
  for (const id of written) if (!lands.some((c) => c.id === id)) fail(id, 'the game has no such country with a flag');
  for (const id of Object.keys(heads)) if (!lands.some((c) => c.id === id)) throw new Error(`${path.basename(HEADS)} chooses a photograph for «${id}», which is no country of the game with a flag`);
  for (const [id, photos] of Object.entries(gallery)) {
    if (!heads[id] || written.includes(id)) fail(id, 'a gallery needs a chosen head, not a full hand-written sheet');
    if (!Array.isArray(photos) || !photos.length) fail(id, 'a gallery needs photographs');
    const files = [heads[id].file?.trim(), ...photos.map((p) => (typeof p?.file === 'string' ? p.file.trim() : ''))];
    if (files.some((file) => !file) || new Set(files).size !== files.length) fail(id, 'a gallery must not repeat its head or another photograph');
  }
  for (const [id, photos] of Object.entries(uploaded)) {
    if (!lands.some((c) => c.id === id)) fail(id, 'the uploaded gallery names no country of the game with a flag');
    if (!Array.isArray(photos) || !photos.length) fail(id, 'the uploaded gallery needs photographs');
    if (new Set(photos.map((p) => p?.title)).size !== photos.length) fail(id, 'the uploaded gallery repeats a title');
  }
  for (const id of Object.keys(timelines)) {
    if (!lands.some((c) => c.id === id)) fail(id, 'a timeline was written for what is no country of the game with a flag');
    if (written.includes(id)) fail(id, 'a timeline was written twice: once on its own and once in its full hand-written sheet');
  }

  const codes = tongueCodes(facts);
  const made = new Set();
  /** What each sheet says, by its country; and the sheets as they are written, by the name of the file of each. */
  const sheets = new Map();
  const out = new Map();
  const count = { official: 0, motto: 0, anthem: 0, adopted: 0, ratio: 0, lead: 0, flagLead: 0, head: 0, arms: 0, timeline: 0 };
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
    // Its coat of arms is the one Wikidata names — the first by name, should it name several —, unless somebody says another, or none.
    const arms = emblems.items?.[id]?.files?.[0];
    let one = laid(arms ? { ...given, arms: { file: arms } } : given, fix) ?? {};
    if (written.includes(id)) {
      const mine = await sheet(path.join(SHEETS, `${id}.json`), commons, index, flags, made);
      // Whoever wrote of the flag told its colours in words: the list of them is not said twice.
      const { colours: _told, ...read } = one.flag ?? {};
      one = { ...one, ...mine, flag: { ...read, ...mine.flag } };
      const pictures = [...mine.photos, ...mine.times.flatMap((time) => (time.picture ? [time.picture] : []))];
      const weight = pictures.flatMap((p) => p.sizes.map((w) => fs.statSync(path.join(PICTURES, `${p.file}-${w}.webp`)).size)).reduce((a, b) => a + b, 0);
      console.log(`  ${id}: escrita a mano; ${mine.times.length} tiempos; ${pictures.length} fotografías en ${pictures.reduce((n, p) => n + p.sizes.length, 0)} imágenes, ${kB(weight)}`);
    } else {
      if (heads[id]) {
        // Nobody has written of it: at its head, the photograph that was chosen for it.
        one = { ...one, photos: [await photograph(id, heads[id], commons, WIDTHS.chosen, made)] };
        count.head++;
      }
      if (gallery[id]) {
        // These are only additions: the first photo, its caption and its original WebP stay untouched.
        for (const photo of gallery[id]) one.photos.push(await photograph(id, photo, commons, WIDTHS.photo, made));
      }
      if (timelines[id]) {
        // A historical account is independent of the chosen head, the Wikipedia texts and the rest of its facts.
        const { times, source, note } = timelines[id];
        if (typeof source !== 'string') fail(id, 'its timeline has no source');
        one.times = await timesOf(id, times, flags, commons, made);
        one.timeSource = source;
        if (note !== undefined) one.timeNote = said(id, 'the note on its timeline', note);
        count.timeline++;
      }
    }
    if (uploaded[id]) {
      if (!Array.isArray(one.photos) || !one.photos.length || one.photos.length + uploaded[id].length > 8) fail(id, 'uploaded photos would replace or overfill its existing gallery');
      const titles = new Set(one.photos.map((photo) => photo.title));
      const names = new Set(one.photos.map((photo) => photo.file));
      for (const photo of uploaded[id]) {
        if (titles.has(photo.title) || names.has(photo.file)) fail(id, `«${photo.title}» would repeat or replace an existing photograph`);
        one.photos.push(await uploadedPhotograph(id, photo, made));
        titles.add(photo.title);
        names.add(photo.file);
      }
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
    // Nor is a coat of arms shown for it: those that such territories are given are seldom official.
    if (one.arms && fixes[id]?.arms !== undefined) fail(id, 'somebody chose a coat of arms for it, and it is drawn with the flag of another country: it shows none');
    delete one.arms;
  }
  /** Why each country that Wikidata names a coat of arms for is left without one. */
  const without = [];
  for (const [id, one] of sheets) {
    if (!one.arms) continue;
    const shown = await emblem(id, one.arms, emblems, made, typeof fixes[id]?.arms?.file === 'string', (what) => without.push(`${id}: ${what}`));
    if (shown) one.arms = shown;
    else delete one.arms;
  }
  if (review && without.length) console.log(`  Sin escudo, aunque Wikidata lo nombra:\n${without.map((line) => `    ${line}`).join('\n')}`);
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
    if (one.arms) count.arms++;
  }
  // Every sheet could be made: only now is any written, so that one that could not leaves them all as they were.
  for (const [name, text] of out) fs.writeFileSync(path.join(OUT, name), text);
  // What no sheet shows any more is not kept.
  for (const name of fs.readdirSync(OUT)) if (!out.has(name)) fs.rmSync(path.join(OUT, name));
  for (const name of fs.readdirSync(PICTURES)) if (!made.has(name)) fs.rmSync(path.join(PICTURES, name));
  console.log(
    `${out.size} fichas en ${path.relative(ROOT, OUT) || OUT} (${kB(bytes)}): ${written.length} escritas a mano; nombre oficial en ${count.official}, lema en ${count.motto}, himno en ${count.anthem}, ` +
      `fecha de la bandera en ${count.adopted}, proporción en ${count.ratio}; texto de Wikipedia del país en ${count.lead} y de la bandera en ${count.flagLead}; fotografía de cabecera elegida en ${count.head}; cronología escrita en ${count.timeline}; escudo en ${count.arms}${without.length ? ` (${without.length} que Wikidata nombra no se pueden enseñar)` : ''}; ${Object.keys(fixes).length} países con correcciones a mano. ${made.size} imágenes en ${path.relative(ROOT, PICTURES) || PICTURES}`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
