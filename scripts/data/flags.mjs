// Builds the flags of the section «Banderas» that do not come with flag-icons: those of the divisions of
// the maps and of the capitals, from what the workflow "Traer datos" keeps in the branch `datos`.
//
//   npm run data:flags                    from the commit of the branch that is pinned below
//   npm run data:flags -- --from folder   from a folder that holds a copy of the branch
//   npm run data:flags -- --report file   and leave in a file what was decided of each flag
//
// What it reads: flags/regions.json and flags/capitals.json (which flag each Wikidata entity flies, and what
// Commons says of its file), the files themselves (flags/files) and the data of the game (the names of
// the divisions and of the capitals).
//
// What it writes:
//
//   docs/flags/commons/          each flag, under the first ten digits of the SHA-1 of what it holds: a name
//                                that changes when the file does, so that a copy kept by a browser is never stale
//   public/data/flags.json       which flag each division and each capital has, with its name and its shape
//   public/data/flag-credits.json  who made each file and on what terms it is given, which is owed to them
//   scripts/data/flags-pictures.txt  the drawings with words in them, for the workflow to bring as pictures
//
// The flags are written straight into the folder that is published, and are nowhere else in the repository:
// they are thousands of files and tens of megabytes, and a copy in public/ would be the same weight again in
// every clone. The build leaves them where they are and the development server reads them from there
// (vite.config.ts, commonsFlags). `--out folder` writes everything under one folder instead, for a trial.
//
// Which flags go in: every one that Wikidata gives as flown today, less those whose file says by its name
// that it is not that (a proposal, a logo, a flag of other years), those that Commons has in a category that
// says the same (historical, proposed, made up), those whose licence is not free or is not said, and those
// that Commons no longer has. The few decisions that no rule makes are in FLAGS_BY_HAND, each with its reason.
//
// How each file is made ready is in flag-image.mjs: a drawing stays a drawing wherever it can.

import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LIGHT_FROM, PICTURE, SVG_MAX, lighten, picture, traits, unsafe } from './flag-image.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

/** The commit of the branch `datos` that the flags are built from. */
const DATOS = { repo: 'diegosb72/regionle', commit: 'efe6d752dee47fd4b18ba5b2ad298b5423e17ec8' };
const DATA = path.resolve(ROOT, value('data') ?? 'public/data');
/** Where the flags are written, and where the two files that tell of them are. */
const OUT_FLAGS = path.resolve(ROOT, value('out') ? path.join(value('out'), 'flags/commons') : 'docs/flags/commons');
const OUT_DATA = path.resolve(ROOT, value('out') ? path.join(value('out'), 'data') : 'public/data');
const CACHE = path.resolve(ROOT, value('cache') ?? '.cache/flags-made');
const PICTURES = path.resolve(ROOT, value('pictures') ?? 'scripts/data/flags-pictures.txt');
/** Changes when what is made of a file does: what was made before is then made again. */
const MADE = `4:${PICTURE}`;

/* ------------------------------------------------------------------ what is decided by rule and by hand */

/**
 * What the name of a file says when it is not the flag that flies: a proposal, a flag nobody adopted, a
 * logo or a banner that hangs from a crossbar, or a flag of other years («old» in the languages the files
 * are named in, «until 2024», «Before 2019»). What a name says in brackets about how it is drawn («with
 * coat of arms») is not read.
 */
const NOT_THE_FLAG =
  /\b(hypothetical|proposed|proposal|fictional|fictitious|unofficial|logo|logotype|gonfalone|gonfalon)\b|\b(old|former|historical|obsolete|antiga|antigua|antiguo|antic|ancien|ancienne|vecchia|vecchio)\b|\b(until|before|hasta|antes de)\s+(1[5-9]|20)\d{2}\b/i;
/** Years that ended («(1976-1997)», «2010-2021»), unless the name goes on to years that have not («1994-2008, 2018-»). */
const ENDED = /\b(1[5-9]|20)\d{2}\s*[-–—]\s*(1[5-9]|20)\d{2}\b/;
const GOES_ON = /\b(1[5-9]|20)\d{2}\s*[-–—]\s*(\)|present\b|presente\b|actualidad\b)/i;
const doubtful = (title) => {
  const name = title.replace(/\((with|con|mit|avec)\b[^)]*\)/gi, '');
  return NOT_THE_FLAG.test(name) || (ENDED.test(name) && !GOES_ON.test(name));
};
/**
 * The categories of Commons that settle it. Of those the fetch tells of (`marks`), only the ones that say
 * of the file that nobody flies it: a proposal, an invention, a flag of before some year. Not «Historical
 * flags of…»: many a flag that flies is one of other times (Mendoza's is that of the Army of the Andes;
 * Tucumán's, the one Belgrano raised at Macha). Nor «Flags of former…», which speaks of the thing and not
 * of its flag: the states of Australia are former colonies, and the map of Latvia is that of the
 * municipalities it had until 2021. Nor «Special or fictional flags», which holds both kinds.
 */
const NOT_FLOWN = /\b(proposed|fictional|fictitious|hypothetical|fantasy)\s+flags?\b|^proposals\s+for\b.*\bflags?\b|\bflag\s+proposals\b|\b(before|until)\s+(1[5-9]|20)\d{2}\b/i;
const settles = (mark) => NOT_FLOWN.test(mark) && !/\bspecial or fictional\b/i.test(mark);
/** A name that says the file is one of several ways of drawing the flag: another way is taken when there is one. */
const VARIANT = /\b(variant|alternate|alternative)\b/i;

/** The licences a file may have: public domain, or one that lets it be shown and changed by saying whose it is. */
const FREE = /^(public domain|pd\b|cc0|cc by(-sa)? \d|cc-by|copyrighted free use|attribution\b|fal\b|free art|ogl\b|open government)/i;

/** What no rule decides. Every entry says why. */
const FLAGS_BY_HAND = {
  /** Files that go in although their name, or a category they are in, raises a doubt. */
  keep: {
    'Flag of the Civil Freedom of Argentina (unofficial improved version).svg': 'la bandera de Jujuy es la de la Libertad Civil; lo «no oficial» es este dibujo de ella, no la bandera',
    'Flag of Karakalpakstan.svg': 'Karakalpakistán tiene bandera oficial desde 1992, y es esta; Commons la tiene, además, en «Proposed flags of Asia»',
    'Flag of Saulkrastu novads 2010-2021.png': 'el mapa de Letonia del juego es el de los 119 municipios que hubo hasta 2021, y esta es la bandera que tuvo este',
    'Flag of Talsi Municipality 2010-2021.png': 'como la de Saulkrasti',
  },
  /** Files that stay out although nothing in their name says so. */
  out: {
    'Provincia de Las Palmas - Bandera.svg': 'es una propuesta, y Commons lo dice («SVG proposed flags of provinces of Spain»); la provincia no tiene bandera',
    'Provincia de Santa Cruz de Tenerife - Bandera.svg': 'como la de Las Palmas',
  },
  /** The licence of a file whose page does not say it, and how it is known. */
  licence: {
    'Flag of Hiroshima Prefecture.svg': [
      'Public domain',
      'la página de Commons se quedó sin la línea de la licencia. La bandera la fija un aviso oficial de la prefectura (1968), y la ley japonesa de derechos de autor (art. 13) deja fuera esos avisos: Commons lo dice así de 45 de las otras 46 banderas de prefectura',
    ],
  },
};
/** Who made a file, as its page says it, with nothing of the page's own marks left in it. */
const who = (text) =>
  String(text ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
/** The licence a file is given on: what its page says or, where it says nothing, what is known by hand. */
const licenceOf = (title, file) => file.licence || FLAGS_BY_HAND.licence[title]?.[0] || '';

/* ------------------------------------------------------------------ the branch */

/** The folder that holds the branch at the pinned commit: downloaded once, and kept. */
async function branch() {
  const from = value('from');
  if (from) return path.resolve(ROOT, from);
  const dir = path.join(ROOT, '.cache', `datos-${DATOS.commit.slice(0, 12)}`);
  if (fs.existsSync(path.join(dir, 'flags'))) return dir;
  const url = `https://codeload.github.com/${DATOS.repo}/tar.gz/${DATOS.commit}`;
  console.log(`↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se ha podido bajar la rama datos: HTTP ${res.status}`);
  const packed = path.join(ROOT, '.cache', `datos-${DATOS.commit.slice(0, 12)}.tgz`);
  fs.mkdirSync(path.dirname(packed), { recursive: true });
  fs.writeFileSync(packed, Buffer.from(await res.arrayBuffer()));
  fs.mkdirSync(`${dir}.part`, { recursive: true });
  execFileSync('tar', ['-xzf', packed, '-C', `${dir}.part`, '--strip-components=1']);
  fs.renameSync(`${dir}.part`, dir);
  fs.rmSync(packed);
  return dir;
}

/* ------------------------------------------------------------------ what the game has */

const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/** The pieces of every level of the maps that have more than one at it: id, map, level (0 the finest) and names. */
function pieces() {
  const list = [];
  for (const file of fs.readdirSync(path.join(DATA, 'r')).filter((f) => f.endsWith('.json')).sort()) {
    const objects = json(path.join(DATA, 'r', file)).objects ?? {};
    for (const key of Object.keys(objects)) {
      const units = objects[key]?.geometries ?? [];
      if (units.length < 2) continue;
      const level = key === 'f' ? 0 : Number(key.slice(1)) || 1;
      for (const g of units) list.push({ id: String(g.id), map: file.slice(0, -5), level, es: g.properties?.n?.es ?? String(g.id), en: g.properties?.n?.en ?? '' });
    }
  }
  return list;
}

/** The capitals: the id of the city, its country and its names. */
function capitals() {
  const cities = json(path.join(DATA, 'cities.json')).c ?? {};
  return Object.keys(cities)
    .sort()
    .flatMap((map) => cities[map].filter((c) => c.k >= 2).map((c) => ({ id: String(c.i), map, es: c.n?.es ?? '', en: c.n?.en ?? '' })));
}

/* ------------------------------------------------------------------ which flag */

/** The file that stands for another: the drawing of a photograph. */
const standing = (title, files) => (files[title]?.drawn && files[files[title].drawn] && !files[files[title].drawn].missing ? files[title].drawn : title);

/**
 * The file of the flag of a thing, or why it has none. It is the first of the flags its entity flies today
 * that nothing speaks against, and one that does not say it is a variant before one that does; or, when
 * there is none or it is a photograph, that of the entity with its code where that one is better.
 *
 * What speaks against a file: that Commons no longer has it, its name, the categories Commons has it in
 * (`marks`: historical, proposed, made up) and its licence. It is asked of the file and of the drawing
 * that stands for it, which is the one that would be shown.
 */
function flagOf(item, files) {
  if (!item) return { why: 'none' };
  // A flag that was given by hand (scripts/data/flags-hand.json) was looked at: neither its name nor its categories are doubted.
  const trusted = (title) => !!FLAGS_BY_HAND.keep[title] || (item.by === 'hand' && title === item.file);
  const fit = (title) => {
    const file = files[title];
    if (!file || file.missing) return 'gone';
    const shown = standing(title, files);
    for (const name of new Set([title, shown])) {
      if (FLAGS_BY_HAND.out[name]) return 'hand';
      if (trusted(name)) continue;
      if (doubtful(name)) return 'name';
      if ((files[name].marks ?? []).some(settles)) return 'mark';
    }
    if (!FREE.test(licenceOf(shown, files[shown]))) return 'licence';
    return null;
  };
  const drawing = (title) => !!files[title] && (files[title].mime === 'image/svg+xml' || !!files[title].drawn);
  const today = [item.file, ...(item.also ?? [])];
  const good = today.filter((title) => !fit(title));
  const mine = good.find((title) => !VARIANT.test(title)) ?? good[0];
  const theirs = item.other?.file;
  if (theirs && !fit(theirs) && (!mine || (!drawing(mine) && drawing(theirs)) || (VARIANT.test(mine) && !VARIANT.test(theirs)))) return { title: theirs, by: 'other' };
  if (!mine) return { why: fit(item.file), title: item.file };
  return mine === item.file ? { title: mine } : { title: mine, by: 'also' };
}

/* ------------------------------------------------------------------ the files */

/** What is kept between runs of what was worked out of a file: the answer (`about`) and, when there is one, the file made. */
async function remembered(what, file, kind, work) {
  const key = createHash('sha1').update(`${MADE}:${what}:${file.sha1}`).digest('hex');
  const about = path.join(CACHE, `${key}.json`);
  if (fs.existsSync(about)) {
    const kept = json(about);
    return kept.failed ? kept : { ...kept, body: fs.readFileSync(path.join(CACHE, `${key}.${kind}`)) };
  }
  fs.mkdirSync(CACHE, { recursive: true });
  try {
    const { body, ...rest } = await work();
    fs.writeFileSync(path.join(CACHE, `${key}.${kind}`), body);
    fs.writeFileSync(about, JSON.stringify(rest));
    return { ...rest, body };
  } catch (err) {
    const failed = { failed: String(err?.message ?? err).slice(0, 200) };
    fs.writeFileSync(about, JSON.stringify(failed));
    return failed;
  }
}

/**
 * What is made of a file of the branch: a drawing, cleaned, or a picture. `how` says which way it went:
 * the precision a drawing was cleaned at, or why it is a picture (`photo`: it is one, or a drawing with one
 * inside; `words`; `heavy`: the original, or what was left of it once cleaned; `unsafe`: something that
 * should not be served was left in it). A drawing that is heavy and stays one comes with a picture of it
 * (`small`). What it costs most to work out (cleaning a drawing and drawing it twice, making a picture) is
 * kept between runs, whatever the limits of weight then are.
 */
async function ready(file, dir) {
  const read = (name) => fs.readFileSync(path.join(dir, name));
  /** The picture of the file: as Wikimedia draws it when that was brought (words are set there as Wikipedia shows them), drawn here otherwise. */
  const pictured = async (how) => {
    const [what, source, svg] = file.picture ? ['theirs', file.picture, false] : ['ours', file.kept, file.mime === 'image/svg+xml'];
    const made = await remembered(`picture:${what}`, file, 'webp', () => picture(read(source), { svg }));
    return made.failed ? null : { kind: 'webp', ...made, how, ...(how === 'words' && what === 'ours' ? { pending: true } : {}) };
  };
  if (!file.kept) return file.picture ? pictured('heavy') : null;
  if (file.mime !== 'image/svg+xml') return pictured('photo');
  const light = await remembered('light', file, 'svg', async () => {
    const raw = read(file.kept).toString('utf8');
    if (traits(raw).photo) return { body: Buffer.alloc(0), photo: true };
    const { text, how, checked } = await lighten(raw);
    const size = await sharp(Buffer.from(text), { limitInputPixels: false }).metadata();
    // Words that are still there once it is cleaned: an empty line of text that a program left is not words.
    return { body: Buffer.from(text), how, checked, w: size.width, h: size.height, words: traits(text).words, unsafe: unsafe(text) };
  });
  if (light.failed) return pictured('unsafe');
  const why = light.photo ? 'photo' : light.words ? 'words' : light.unsafe ? 'unsafe' : light.body.length > SVG_MAX ? 'heavy' : null;
  if (why) return (await pictured(why)) && { ...(await pictured(why)), cleaned: light.body.length };
  const made = { kind: 'svg', body: light.body, w: light.w, h: light.h, how: light.how, checked: light.checked };
  if (light.body.length <= LIGHT_FROM) return made;
  // Heavy, and still a drawing: a picture of it too, for where it is shown small.
  const small = await remembered('picture:ours', file, 'webp', () => picture(read(file.kept), { svg: true }));
  return small.failed ? made : { ...made, small: small.body };
}

/* ------------------------------------------------------------------ the run */

const FROM = await branch();
const SOURCES = ['regions', 'capitals'].map((name) => ({ name, ...json(path.join(FROM, 'flags', `${name}.json`)) }));
/** What Commons says of every file, whichever source named it. */
const FILES = Object.assign({}, ...SOURCES.map((s) => s.files));
const SUBJECTS = { regions: pieces(), capitals: capitals() };
/** What the categories of Commons say of a file and of the drawing that stands for it, each once. */
const marksOf = (title) => [...new Set([title, standing(title, FILES)].flatMap((name) => FILES[name]?.marks ?? []))];

const chosen = [];
const leftOut = [];
for (const source of SOURCES) {
  for (const subject of SUBJECTS[source.name]) {
    const pick = flagOf(source.items[subject.id], FILES);
    if (pick.why === 'none') continue;
    if (pick.why) leftOut.push({ group: source.name, id: subject.id, name: subject.es, title: pick.title, why: pick.why, ...(pick.why === 'mark' ? { marks: marksOf(pick.title) } : {}) });
    else chosen.push({ group: source.name, subject, asked: pick.title, title: standing(pick.title, FILES), by: pick.by });
  }
}
/** The files to make ready, each once: those that some thing flies and that the branch has. */
const titles = [...new Set(chosen.map((c) => c.title))].filter((title) => FILES[title].kept || FILES[title].picture).sort();

// A part of the work, in a process of its own: what it makes is left where the others will find it.
const part = value('part');
if (part) {
  const [i, n] = part.split('/').map(Number);
  for (const [at, title] of titles.entries()) if (at % n === i) await ready(FILES[title], FROM);
  process.exit(0);
}

const workers = Math.max(1, Math.min(Number(value('workers')) || os.cpus().length, 8));
if (titles.length > 8 && workers > 1) {
  console.log(`Preparando ${titles.length} archivos en ${workers} procesos…`);
  await Promise.all(
    Array.from({ length: workers }, (_, i) =>
      new Promise((done, fail) => {
        const child = spawn(process.execPath, [fileURLToPath(import.meta.url), ...args, '--part', `${i}/${workers}`], { stdio: 'inherit' });
        child.on('exit', (code) => (code === 0 ? done() : fail(new Error(`Un proceso ha terminado con ${code}`))));
      }),
    ),
  );
}

/** The name a file is served under: the first ten digits of the SHA-1 of what it holds. */
const named = (body, kind) => `${createHash('sha1').update(body).digest('hex').slice(0, 10)}.${kind}`;
const images = new Map();
for (const title of titles) {
  const image = await ready(FILES[title], FROM);
  if (image) images.set(title, { ...image, name: named(image.body, image.kind), ...(image.small ? { smallName: named(image.small, 'webp') } : {}) });
}

/* What the game reads. */
const ratio = (image) => Number((image.w / image.h).toFixed(2));
const byName = (a, b) => a.subject.map.localeCompare(b.subject.map) || (b.subject.level ?? 0) - (a.subject.level ?? 0) || a.subject.es.localeCompare(b.subject.es, 'es') || a.subject.id.localeCompare(b.subject.id);
const shown = chosen.filter((c) => images.has(c.title)).sort(byName);
for (const c of chosen) if (!images.has(c.title)) leftOut.push({ group: c.group, id: c.subject.id, name: c.subject.es, title: c.title, why: FILES[c.title].kept || FILES[c.title].picture ? 'unmade' : 'unbrought' });

/** What the list says of a flag after whose it is: its file, its shape and, for a heavy drawing, the picture that stands for it where it is small. */
const told = (c) => {
  const image = images.get(c.title);
  return [c.subject.es, c.subject.en === c.subject.es ? '' : c.subject.en, image.name, ratio(image), ...(image.smallName ? [image.smallName] : [])];
};
const regions = {};
for (const c of shown.filter((c) => c.group === 'regions')) (regions[c.subject.map] ??= []).push([c.subject.id, c.subject.level, ...told(c)]);
const cities = shown.filter((c) => c.group === 'capitals').map((c) => [c.subject.id, c.subject.map, ...told(c)]);
/** A list written with one entry to a line: a flag that changes is a line that changes. */
const lines = (items) => `[\n${items.map((item) => JSON.stringify(item)).join(',\n')}\n]`;
const catalogue = `{\n"v": 1,\n"regions": {\n${Object.keys(regions).sort().map((map) => `${JSON.stringify(map)}: ${lines(regions[map])}`).join(',\n')}\n},\n"capitals": ${lines(cities)}\n}\n`;

const licences = [];
const credits = {};
for (const title of [...images.keys()].sort()) {
  const [file, image] = [FILES[title], images.get(title)];
  const licence = JSON.stringify([licenceOf(title, file), file.licenceUrl ?? '']);
  if (!licences.includes(licence)) licences.push(licence);
  credits[image.name] = [title, who(file.artist), licences.indexOf(licence)];
}
const creditsText = `{\n"v": 1,\n"licences": [${licences.join(', ')}],\n"files": {\n${Object.keys(credits).sort().map((name) => `${JSON.stringify(name)}: ${JSON.stringify(credits[name])}`).join(',\n')}\n}\n}\n`;

fs.mkdirSync(OUT_FLAGS, { recursive: true });
const wanted = new Map();
for (const image of images.values()) {
  wanted.set(image.name, image.body);
  if (image.smallName) wanted.set(image.smallName, image.small);
}
for (const name of fs.readdirSync(OUT_FLAGS)) if (!wanted.has(name)) fs.rmSync(path.join(OUT_FLAGS, name), { recursive: true });
for (const [name, body] of wanted) {
  const dest = path.join(OUT_FLAGS, name);
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, body);
}
fs.mkdirSync(OUT_DATA, { recursive: true });
fs.writeFileSync(path.join(OUT_DATA, 'flags.json'), catalogue);
fs.writeFileSync(path.join(OUT_DATA, 'flag-credits.json'), creditsText);

/* The drawings with words in them that have no picture yet: for the workflow to bring. */
const worded = Object.keys(FILES).filter((title) => FILES[title].words || images.get(title)?.how === 'words').sort();
const head = fs.existsSync(PICTURES) ? fs.readFileSync(PICTURES, 'utf8').split('\n').filter((line) => line.startsWith('#')).join('\n') : '';
if (!value('from') || value('pictures')) fs.writeFileSync(PICTURES, `${head}${head ? '\n' : ''}${worded.join('\n')}\n`);

/* What was done, for whoever runs it. */
const count = (list, of) => {
  const n = {};
  for (const one of list) n[of(one)] = (n[of(one)] ?? 0) + 1;
  return n;
};
const all = [...images.values()];
const bytes = (list) => list.reduce((sum, image) => sum + image.body.length, 0);
const mb = (n) => `${(n / 1e6).toFixed(1)} MB`;
const drawings = all.filter((image) => image.kind === 'svg');
const pictures = all.filter((image) => image.kind === 'webp');
const small = drawings.filter((image) => image.small);
console.log(`Banderas: ${shown.length} (${shown.filter((c) => c.group === 'regions').length} de divisiones, en ${Object.keys(regions).length} mapas; ${cities.length} de capitales), en ${wanted.size} archivos, ${mb([...wanted.values()].reduce((sum, body) => sum + body.length, 0))}.`);
console.log(`  Dibujos (SVG): ${drawings.length}, ${mb(bytes(drawings))}; ${small.length} de ellos, los de más de ${Math.round(LIGHT_FROM / 1000)} kB, con una imagen para las listas (${mb(small.reduce((sum, image) => sum + image.small.length, 0))}).`);
console.log(`  Imágenes (WebP): ${pictures.length}, ${mb(bytes(pictures))}: ${JSON.stringify(count(pictures, (image) => image.how))}.`);
console.log(`  Fuera: ${leftOut.length}: ${JSON.stringify(count(leftOut, (one) => one.why))}.`);
const pending = all.filter((image) => image.pending).length;
if (pending) console.log(`  ${pending} dibujos con texto esperan su imagen: están en ${path.relative(ROOT, PICTURES)}, y el flujo «Traer datos» la trae.`);
const report = value('report');
if (report) {
  fs.writeFileSync(
    path.resolve(ROOT, report),
    JSON.stringify(
      {
        shown: shown.map((c) => ({ group: c.group, id: c.subject.id, map: c.subject.map, name: c.subject.es, title: c.title, asked: c.asked, by: c.by, file: images.get(c.title).name, how: images.get(c.title).how, bytes: images.get(c.title).body.length, small: images.get(c.title).small?.length, cleaned: images.get(c.title).cleaned, w: images.get(c.title).w, h: images.get(c.title).h, raw: FILES[c.title].bytes })),
        leftOut,
        // Shown, and in a category that speaks of other times or of a proposal without settling it: to be looked at.
        doubted: shown.filter((c) => marksOf(c.asked).length).map((c) => ({ group: c.group, id: c.subject.id, name: c.subject.es, title: c.title, marks: marksOf(c.asked) })),
      },
      null,
      1,
    ),
  );
}
