// Builds the flags of the section «Banderas» that do not come with flag-icons, from what the workflow
// "Traer datos" keeps in the branch `datos`: those of the divisions of the maps, of the capitals and of the
// other cities, those that the countries flew before, those of what the lists name (countries that are no
// more, organisations, peoples) and the signals.
//
//   npm run data:flags                    from the commit of the branch that flags-datos.mjs pins
//   npm run data:flags -- --from folder   from a folder that holds a copy of the branch
//   npm run data:flags -- --report file   and leave in a file what was decided of each flag
//
// What it reads: the data file of each source of flags (flags/regions.json, capitals.json, cities.json,
// countries.json, listed.json and signals.json: which flag each thing flies or flew, and what Commons says
// of its file), the files themselves (flags/files), the data of the game (the names of the divisions, of
// the cities and of the countries) and the lists of the repository (scripts/data/flags-lists.json, which
// scripts/data/flags-lists.mjs writes, and scripts/data/flags-signals.json): the names and the years of
// what is not in the maps.
//
// What it writes:
//
//   docs/flags/commons/          each flag, under the first ten digits of the SHA-1 of what it holds: a name
//                                that changes when the file does, so that a copy kept by a browser is never stale
//   public/data/flags.json       which flag each thing has, with its name, its shape and, where it has them, its years
//   public/data/flag-credits.json  who made each file and on what terms it is given, which is owed to them
//   scripts/data/flags-pictures.txt  the drawings with words in them, for the workflow to bring as pictures
//
// The flags are written straight into the folder that is published, and are nowhere else in the repository:
// they are thousands of files and tens of megabytes, and a copy in public/ would be the same weight again in
// every clone. The build leaves them where they are and the development server reads them from there
// (vite.config.ts, commonsFlags). `--out folder` writes everything under one folder instead, for a trial.
//
// Which flags go in: every one that Wikidata gives as flown today, less those whose file says by its name
// that it is not that (a proposal, a logo, a seal, a flag of other years), those that Commons has in a
// category that says the same (proposed, made up), those whose licence is not free or is not said, those
// that Commons no longer has, the flag of a country given to one of its divisions, and the flag of a
// department or of a province given to the city it is called after (see `LARGER`). For what Wikidata
// gives no flag of, the one that the box of facts of its page of Wikipedia shows, where that was looked at
// and the file is what it should be (see `unseen`). Of a flag of other times only that somebody flew it is
// asked, in 1700 or later: not a proposal, not an invention, not what it is thought to have been like. The
// few decisions that no rule makes are in FLAGS_BY_HAND, each with its reason.
//
// How each file is made ready is in flag-image.mjs: a drawing stays a drawing wherever it can.

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { LIGHT_FROM, PICTURE, SVG_MAX, lighten, picture, traits, unsafe } from './flag-image.mjs';
import { ROOT, branch } from './flags-datos.mjs';
import { mentions, plain, todayTitles } from './flags-names.mjs';

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const DATA = path.resolve(ROOT, value('data') ?? 'public/data');
/** Where the flags are written, and where the two files that tell of them are. */
const OUT_FLAGS = path.resolve(ROOT, value('out') ? path.join(value('out'), 'flags/commons') : 'docs/flags/commons');
const OUT_DATA = path.resolve(ROOT, value('out') ? path.join(value('out'), 'data') : 'public/data');
const CACHE = path.resolve(ROOT, value('cache') ?? '.cache/flags-made');
const PICTURES = path.resolve(ROOT, value('pictures') ?? 'scripts/data/flags-pictures.txt');
/** The lists of what flies a flag and is not in the maps, with the names and the years of each; and the signals. */
const LISTS_FILE = path.resolve(ROOT, value('lists') ?? 'scripts/data/flags-lists.json');
const SIGNALS_FILE = path.resolve(ROOT, value('signals') ?? 'scripts/data/flags-signals.json');
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
  /\b(hypothetical|proposed|proposal|proposé|proposée|propuesta|proposta|fictional|fictitious|unofficial|logo|logotype|gonfalone|gonfalon|emblem|emblema|seal|sello|coat of arms|escudo|brasão|brasao|blason|armoiries|wappen|stemma)\b|\b(old|former|historical|obsolete|antiga|antigua|antiguo|antic|ancien|ancienne|vecchia|vecchio)\b|\b(until|before|hasta|antes de)\s+(1[5-9]|20)\d{2}\b/i;
/** Years that ended («(1976-1997)», «2010-2021»), unless the name goes on to years that have not («1994-2008, 2018-»). */
const ENDED = /\b(1[5-9]|20)\d{2}\s*[-–—]\s*(1[5-9]|20)\d{2}\b/;
const GOES_ON = /\b(1[5-9]|20)\d{2}\s*[-–—]\s*(\)|present\b|presente\b|actualidad\b)/i;
const doubtful = (title) => {
  const name = title.replace(/\((with|con|mit|avec)\b[^)]*\)/gi, '');
  return NOT_THE_FLAG.test(name) || (ENDED.test(name) && !GOES_ON.test(name));
};
/**
 * What the name of a file says when the flag is that of something larger than a city: a department, a
 * province, a state, a governorate. Wikidata and Wikipedia give many a city the flag of the division that
 * is called after it, or that it is the seat of, and that flag is the division's. What a name says in
 * brackets or after a comma is where the place is («Flag of Sochi (Krasnodar krai)», «Flag of Villa María,
 * Córdoba Province») and is not read. A canton and a municipality are not in the list: in Ecuador, in Costa
 * Rica and in Venezuela they are the town hall of the city.
 */
const LARGER = /\b(departments?|departamento|departement|provinces?|provincia|state|estado|governorate|govenorate|governadorat|gobernacion|county|region|emirate|wilaya)\b/;
const ofSomethingLarger = (title) => LARGER.test(plain(String(title).replace(/\.[a-z]+$/i, '').replace(/\([^)]*\)/g, ' ').replace(/,.*$/, '')));
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
/**
 * What says of a flag of other times that nobody flew it: a proposal, an invention, or what somebody now
 * thinks it was like. That it is of other times is what it is wanted for.
 */
const NEVER_FLOWN = /\b(hypothetical|proposed|proposal|fictional|fictitious|fantasy|reconstruction|reconstructed|attributed|conjectural|conjectured)\b/i;
const NEVER_FLOWN_MARK = /\b(proposed|fictional|fictitious|hypothetical|fantasy)\s+flags?\b|^proposals\s+for\b.*\bflags?\b|\bflag\s+proposals\b/i;
/** A name that says the file is one of several ways of drawing the flag: another way is taken when there is one. */
const VARIANT = /\b(variant|alternate|alternative)\b/i;

/**
 * The licences a file may have: public domain, or one that lets it be shown and changed by saying whose it
 * is and on what terms. The GPL and the LGPL are of those: a drawing is its own source, and the list of
 * credits names the licence of each file and links to it.
 */
const FREE = /^(public domain|pd\b|cc0|cc by(-sa)? \d|cc-by|copyrighted free use|attribution\b|fal\b|free art|ogl\b|open government|l?gpl\b|gnu (lesser )?general public)/i;

/** What no rule decides. Every entry says why. */
const FLAGS_BY_HAND = {
  /** Files that go in although their name, or a category they are in, raises a doubt. */
  keep: {
    'Flag of the Civil Freedom of Argentina (unofficial improved version).svg': 'la bandera de Jujuy es la de la Libertad Civil; lo «no oficial» es este dibujo de ella, no la bandera',
    'Flag of Karakalpakstan.svg': 'Karakalpakistán tiene bandera oficial desde 1992, y es esta; Commons la tiene, además, en «Proposed flags of Asia»',
    'Flag of Saulkrastu novads 2010-2021.png': 'el mapa de Letonia del juego es el de los 119 municipios que hubo hasta 2021, y esta es la bandera que tuvo este',
    'Flag of Talsi Municipality 2010-2021.png': 'como la de Saulkrasti',
    'Flag of the Organization of African Unity (1970–2002); Flag of the African Union (2004–2010).svg': 'la Organización para la Unidad Africana acabó en 2002: su bandera es la de esos años',
    'Flag of Port Said Governorate.PNG': 'Puerto Saíd es una ciudad que es toda ella una gobernación: la bandera es de las dos',
  },
  /** Files that stay out although nothing in their name says so. */
  out: {
    'Provincia de Las Palmas - Bandera.svg': 'es una propuesta, y Commons lo dice («SVG proposed flags of provinces of Spain»); la provincia no tiene bandera',
    'Provincia de Santa Cruz de Tenerife - Bandera.svg': 'como la de Las Palmas',
  },
  /**
   * What Wikidata gives to a thing and is the flag of another, by the thing (a piece or a city of the maps)
   * and the file: the flag stays with whose it is. They were found by reading the names of the files that
   * do not name what they are given to, and each was then looked at; a name alone settles nothing («Bandera
   * del Municipio de Jalapa» is the flag of the department of Jalapa, as Commons files it and Wikipedia
   * shows it).
   */
  anothers: {
    'PA-EM': ['Flag of Chocó.svg', 'la comarca Emberá-Wounaan sale con la bandera del departamento colombiano del Chocó; Wikipedia no le enseña ninguna'],
    ...Object.fromEntries(
      [
        ['NI-BO', 'Flag of Boaco.svg'],
        ['NI-CA', 'Flag of Jinotepe.svg'],
        ['NI-CI', 'Flag of Chinandega.svg'],
        ['NI-CO', 'Flag of Juigalpa.svg'],
        ['NI-ES', 'Flag of Esteli.svg'],
        ['NI-GR', 'Flag of Granada, Nicaragua.svg'],
        ['NI-JI', 'Flag of Jinotega.svg'],
        ['NI-LE', 'Flag of Leon, Nicaragua.svg'],
        ['NI-MN', 'Flag of Managua.svg'],
        ['NI-MS', 'Flag of Masaya.svg'],
        ['NI-MT', 'Flag of Matagalpa.svg'],
        ['NI-RI', 'Flag of Rivas.svg'],
      ].map(([id, file]) => [id, [file, 'es la bandera de su cabecera, y así la describe Commons («Flag of Jinotepe, Carazo» es la del departamento de Carazo): los departamentos de Nicaragua no tienen gobierno propio, y Wikipedia y Wikidata les ponen la de la ciudad']]),
    ),
    cj646az: ['Claes Gerritszoon Compaen Flag.svg', 'Salinas (Ecuador): la bandera de un corsario holandés del siglo XVII'],
    cj64e77: ['Flag of La Rivera, Bolivia.svg', 'San Lorenzo (Ecuador): la de un pueblo de Bolivia'],
    cj64e73: ['Bandera de Aznalcóllar (Sevilla).svg', 'Valdez (Ecuador): la de un pueblo de Sevilla'],
    cj64clv: ['Flag of El Salvador, Misamis Oriental.png', 'Gingoog: la de otra ciudad de su provincia'],
    cj64bbl: ['Flag of Rygge.gif', 'Moss: la de Rygge, el municipio que se le unió en 2020'],
    cj64bh5: ['Flag of Sungei Ujong.svg', 'Seremban: la del antiguo Estado de Sungai Ujong, del que fue capital'],
    cj64bhf: ['Flag of Kemaman, Terengganu.svg', 'Chukai: la del distrito de Kemaman'],
    cj64lpz: ['Flag of Mangkunegaran.svg', 'Surakarta: la del principado de Mangkunegaran'],
    cj647pl: ['Flag of the Welsh colony in Patagonia.svg', 'Puerto Madryn: la de la colonia galesa de la Patagonia'],
    cj64863: ['Bandera Florida.png', 'Samaipata: la de la provincia Florida'],
    cj64l5d: ['Flag of Melekeok.svg', 'Ngerulmud es la sede del gobierno de Palaos, sin bandera: esta es la del estado de Melekeok, donde está'],
    cj64jg5: ['Colours of Cork.svg', 'Cork: los colores deportivos del condado'],
    cj64j45: ['Befändelt Märei-102.jpg', 'Luxemburgo: una fotografía del ayuntamiento con banderas'],
    cj64n2z: ['İstanbul Büyükşehir Belediyesi.svg', 'Estambul: el logotipo del ayuntamiento metropolitano'],
  },
  /**
   * What Wikipedia shows of what Wikidata gives no flag of (`by: wikipedia`: the flag in the box of facts of
   * its page) is taken where it was looked at, and there it is what it says: `maps` are the countries whose
   * divisions were seen flag by flag. In the rest, what the box shows is something else: the flag of the
   * city a province is called after (Bulgaria, Portugal), the colours of a sports team (Ireland), the seal of
   * a government on a white cloth (India, South Africa), a logo (France, Kazakhstan, Turkey) or a flag that
   * nobody can tell where it comes from (Nigeria, Guyana, Zambia). The capitals and the cities are taken
   * unless they are named in `out`: the box of a city shows the flag of the city.
   */
  wikipedia: {
    maps: ['AG', 'AL', 'CV', 'DO', 'EC', 'EG', 'FI', 'GB', 'GH', 'GT', 'HN', 'IT', 'LK', 'LV', 'MD', 'ME', 'MK', 'MU', 'MX', 'NC', 'PH', 'PW', 'RO', 'SE', 'SI', 'SV', 'TH', 'TL', 'TN', 'TW', 'VE'],
    /** Those whose file does not name them, and is theirs all the same. */
    named: {
      'GB-GLS': 'la bandera de Gloucestershire es la cruz del Severn, que es como se llama el archivo',
    },
    out: {
      'DO-01': 'el escudo del Ayuntamiento del Distrito Nacional con su nombre: un membrete, no una bandera',
      cj64my1: 'Santo Domingo: lo mismo que su Distrito Nacional',
      cj64mkf: 'Cayena: el logotipo del ayuntamiento',
      cj64m03: 'Saint-Denis: el logotipo del ayuntamiento',
      cj64n1x: 'Nueva Delhi: el logotipo de su ayuntamiento (NDMC)',
    },
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

/** The cities that `which` takes: the id of the city, its country and its names. */
function citiesThat(which) {
  const cities = json(path.join(DATA, 'cities.json')).c ?? {};
  return Object.keys(cities)
    .sort()
    .flatMap((map) => cities[map].filter(which).map((c) => ({ id: String(c.i), map, es: c.n?.es ?? '', en: c.n?.en ?? '' })));
}
/** The capitals of the countries (3 is the capital, 2 a second one), and the other cities. */
const capitals = () => citiesThat((c) => c.k >= 2);
const towns = () => citiesThat((c) => !(c.k >= 2));

/* ------------------------------------------------------------------ which flag */

/** The file that stands for another: the drawing of a photograph. */
const standing = (title, files) => (files[title]?.drawn && files[files[title].drawn] && !files[files[title].drawn].missing ? files[title].drawn : title);

/**
 * The file of the flag of a thing, or why it has none. It is the first of the flags its entity flies today
 * that nothing speaks against, and one that does not say it is a variant before one that does; or, when
 * there is none or it is a photograph, that of the entity with its code where that one is better.
 *
 * What speaks against a file: that Commons no longer has it, its name, the categories Commons has it in
 * (`marks`: historical, proposed, made up), its licence, that it is the flag of something larger when it is
 * asked for a city (`city`), and that it was seen to be another's (`another`: FLAGS_BY_HAND.anothers). It is asked of the file and of the drawing
 * that stands for it, which is the one that would be shown. Of the flag of something that is no more
 * (`old`), a name or a category that says it is of other times is no objection.
 */
function flagOf(item, files, { old = false, city = false, another = null } = {}) {
  if (!item) return { why: 'none' };
  // A flag that was given by hand (scripts/data/flags-hand.json) was looked at: neither its name nor its categories are doubted.
  const trusted = (title) => !!FLAGS_BY_HAND.keep[title] || (item.by === 'hand' && title === item.file);
  const fit = (title) => {
    const file = files[title];
    if (!file || file.missing) return 'gone';
    const shown = standing(title, files);
    for (const name of new Set([title, shown])) {
      if (FLAGS_BY_HAND.out[name] || name === another) return 'hand';
      if (trusted(name)) continue;
      // The flag of a department or of a province is not that of the city it is called after.
      if (city && ofSomethingLarger(name)) return 'larger';
      // Of the flag of something that is no more, only that it was flown is asked.
      if (old ? NEVER_FLOWN.test(name) : doubtful(name)) return 'name';
      if ((files[name].marks ?? []).some(old ? (mark) => NEVER_FLOWN_MARK.test(mark) && !/\bspecial or fictional\b/i.test(mark) : settles)) return 'mark';
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

/** Why a flag of other times is not fit to be shown, or nothing when it is: as `flagOf` asks of the flag of what is no more. */
const unfitOld = (title, files) => flagOf({ file: title }, files, { old: true }).why ?? null;

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

/** The copy of the branch `datos` that is read: the commit that flags-datos.mjs pins, or the folder that `--from` names. */
const FROM = await branch(value('from'));
/** What a source of the branch brought: nothing, for one that was never asked for. */
const brought = (name) => {
  const file = path.join(FROM, 'flags', `${name}.json`);
  return { name, items: {}, files: {}, ...(fs.existsSync(file) ? json(file) : {}) };
};
const SOURCES = ['regions', 'capitals', 'cities', 'countries', 'listed', 'signals'].map(brought);
const ITEMS = Object.fromEntries(SOURCES.map((s) => [s.name, s.items]));
/** What Commons says of every file, whichever source named it: of two that tell of the same one, the later, unless only the earlier brought it. */
const FILES = {};
for (const source of SOURCES) for (const [title, file] of Object.entries(source.files)) if (!FILES[title] || file.kept || file.picture || !(FILES[title].kept || FILES[title].picture)) FILES[title] = file;
/** What the categories of Commons say of a file and of the drawing that stands for it, each once. */
const marksOf = (title) => [...new Set([title, standing(title, FILES)].flatMap((name) => FILES[name]?.marks ?? []))];

/** The lists of the repository: what is no more, the organisations and the peoples, each by its Wikidata id with its names and its years; and the signals. */
const LISTS = fs.existsSync(LISTS_FILE) ? json(LISTS_FILE) : {};
const SIGNALS = fs.existsSync(SIGNALS_FILE) ? (json(SIGNALS_FILE).signals ?? {}) : {};
/** The year of a day («1931-04-14»), or 0 when it is not known. */
const yearOf = (day) => (/^\d{4}-/.test(String(day ?? '')) ? Number(String(day).slice(0, 4)) : 0);

/**
 * Every flag there is to show, with whose it is (`subject`), the file that was asked for and the one that
 * is shown (the drawing of a photograph), or why it is left out.
 */
const chosen = [];
const leftOut = [];
const take = (group, subject, pick) => {
  if (pick.why === 'none') return;
  if (pick.why) leftOut.push({ group, id: subject.id, name: subject.es, title: pick.title, why: pick.why, ...(pick.why === 'mark' ? { marks: marksOf(pick.title) } : {}) });
  else chosen.push({ group, subject, asked: pick.title, title: standing(pick.title, FILES), by: pick.by });
};

const INDEX = json(path.join(DATA, 'index.json'));
/** The names that the flag of a country of today goes by in Commons. */
const TODAY = todayTitles(INDEX);
const ofToday = (title) => TODAY.has(String(title).toLowerCase());
/** The first year that a flag of other times may have stopped flying in: before it, what is drawn today is what somebody thinks the flag was like. */
const SINCE = 1700;

/** «Flag» in the languages the files are named in: a file that Wikipedia shows as a flag and does not call one is often a photograph, a seal or a map. */
const FLAG_WORD = /flag|fahne|vlag|bander|bandeir|bandier|drapeau|drapel|steag|zastav|banner|pabellon|lippu|zaszlo|bayra|bendera|vexill/;

/**
 * Why the flag that Wikipedia shows of something is not taken, or nothing when it is. It is taken where it
 * was looked at (FLAGS_BY_HAND.wikipedia) and, there, when its file says it is a flag and names the thing
 * (the box of a place sometimes shows the flag of another: of its country, of the State it is in, of a
 * city) and is no flag of a country.
 */
function unseen(group, subject, item, title) {
  if (FLAGS_BY_HAND.wikipedia.out[subject.id]) return 'hand';
  if (group === 'regions' && !FLAGS_BY_HAND.wikipedia.maps.includes(subject.map)) return 'unseen';
  if (ofToday(title)) return 'country';
  if (!FLAG_WORD.test(plain(title))) return 'unsaid';
  const page = String(item.page ?? '').replace(/^[a-z-]+:/, '');
  if (!FLAGS_BY_HAND.wikipedia.named[subject.id] && !mentions(title, [subject.es, subject.en, page])) return 'unnamed';
  return null;
}

// Those of the maps: the divisions, the capitals and the other cities. Those that Wikipedia shows come
// after the rest: a flag that something else already flies is not taken from it (the two departments of
// Corsica are shown the flag of the island, which is that of the region).
const shownByWikipedia = [];
const ofTheMaps = (group, subjects) => {
  for (const subject of subjects) {
    const item = ITEMS[group][subject.id];
    const pick = flagOf(item, FILES, { city: group !== 'regions', another: FLAGS_BY_HAND.anothers[subject.id]?.[0] ?? null });
    // A division, or a city that is no capital, that is given the flag of a country has none of its own (Brčko flies that of Bosnia and Herzegovina): a capital may be its whole country (Singapore).
    if (!pick.why && group !== 'capitals' && ofToday(pick.title)) take(group, subject, { why: 'country', title: pick.title });
    else if (item?.by === 'wikipedia' && !pick.why) shownByWikipedia.push({ group, subject, item, pick });
    else take(group, subject, pick);
  }
};
ofTheMaps('regions', pieces());
ofTheMaps('capitals', capitals());
ofTheMaps('cities', towns());
{
  const flown = new Set(chosen.map((c) => c.title));
  for (const { group, subject, item, pick } of shownByWikipedia) {
    const why = unseen(group, subject, item, pick.title) ?? (flown.has(standing(pick.title, FILES)) ? 'same' : null);
    take(group, subject, why ? { why, title: pick.title } : pick);
  }
}

// Those that the countries of today flew before: each with the years it flew between, the oldest first.
for (const country of INDEX.countries ?? []) {
  const seen = new Set();
  const past = [...(ITEMS.countries[country.id]?.past ?? [])].sort((a, b) => (yearOf(a.from) || yearOf(a.to)) - (yearOf(b.from) || yearOf(b.to)) || yearOf(a.to) - yearOf(b.to) || a.file.localeCompare(b.file));
  for (const flag of past) {
    const subject = { id: `${country.id}:${flag.file}`, map: country.id, es: country.n?.es ?? country.id, en: country.n?.en ?? '', from: yearOf(flag.from), to: yearOf(flag.to) };
    // One that is the flag of today under the years of another time it flew in is not a flag of other times; nor is one of before 1700.
    const tooOld = subject.to ? subject.to < SINCE : subject.from > 0 && subject.from < SINCE;
    const why = ofToday(flag.file) ? 'today' : tooOld ? 'early' : unfitOld(flag.file, FILES);
    // The same drawing twice, under two names or in two statements, is one flag.
    const shown = why ? null : standing(flag.file, FILES);
    if (shown && seen.has(FILES[shown].sha1)) continue;
    if (shown) seen.add(FILES[shown].sha1);
    take('past', subject, why ? { why, title: flag.file } : { title: flag.file });
  }
}

/**
 * The flags of something that is no more, in the order they are tried in: the one given by hand; the one
 * that Wikidata prefers to the others; the one it flew until it ended (the year it ended in, or the one
 * before: a flag that is not said to have stopped flying is often one that nobody dated); one that is not
 * said to have stopped flying; and the rest, the last first. scripts/data/flags-lists.mjs foresees the same.
 */
function lastFlags(item, ended) {
  const past = item.past ?? [];
  const live = item.file ? [item.file, ...(item.also ?? [])] : [];
  return [
    ...new Set([
      ...(item.by === 'hand' || item.rank === 'preferred' ? live.slice(0, 1) : []),
      ...past.filter((flag) => flag.rank === 'preferred').map((flag) => flag.file),
      ...past.filter((flag) => ended && yearOf(flag.to) >= ended - 1).map((flag) => flag.file),
      ...live,
      ...past.map((flag) => flag.file),
    ]),
  ];
}

// Those of what the lists name. What is no more has the last flag it flew; the rest, the one they fly. Of
// two things that are no more and would be shown by the same flag, the one the list names first.
const lastFlown = new Set();
for (const [group, old] of [['gone', true], ['organisations', false], ['peoples', false]]) {
  for (const [id, said] of Object.entries(LISTS[group === 'gone' ? 'historical' : group] ?? {})) {
    const item = ITEMS.listed[id];
    const subject = { id, es: said.es || said.en || id, en: said.en ?? '', from: Number(said.from) || 0, to: Number(said.to) || 0 };
    if (!item) continue;
    if (old) {
      const tried = lastFlags(item, subject.to);
      const title = tried.find((name) => !flagOf({ file: name, by: item.by === 'hand' && name === item.file ? 'hand' : undefined }, FILES, { old }).why);
      if (!title) {
        if (tried.length) take(group, subject, { why: flagOf({ file: tried[0] }, FILES, { old }).why, title: tried[0] });
        continue;
      }
      const shown = FILES[standing(title, FILES)].sha1;
      if (lastFlown.has(shown)) leftOut.push({ group, id, name: subject.es, title, why: 'same' });
      else take(group, subject, { title, ...(title === item.file ? {} : { by: 'past' }) });
      lastFlown.add(shown);
      continue;
    }
    const today = flagOf(item.file ? item : null, FILES);
    if (!today.why) {
      take(group, subject, today);
      continue;
    }
    // None that it flies today, or none of those is fit: the last it flew that is.
    const last = (item.past ?? []).find((flag) => !unfitOld(flag.file, FILES));
    if (last) take(group, subject, { title: last.file, by: 'past' });
    else if (today.why !== 'none') take(group, subject, today);
    else if (item.past?.length) take(group, subject, { why: unfitOld(item.past[0].file, FILES), title: item.past[0].file });
  }
}

// The signals, which the list names file by file.
for (const [id, said] of Object.entries(SIGNALS)) {
  const item = ITEMS.signals[id];
  if (item) take('signals', { id, es: said.es, en: said.en ?? '', code: said.group ?? 'other', means: said.means }, flagOf(item, FILES));
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
const shown = chosen.filter((c) => images.has(c.title));
for (const c of chosen) if (!images.has(c.title)) leftOut.push({ group: c.group, id: c.subject.id, name: c.subject.es, title: c.title, why: FILES[c.title].kept || FILES[c.title].picture ? 'unmade' : 'unbrought' });
const of = (group) => shown.filter((c) => c.group === group);
const byName = (a, b) => a.subject.es.localeCompare(b.subject.es, 'es') || a.subject.id.localeCompare(b.subject.id);

/** What the list says of a flag: its file, its shape and, for a heavy drawing, the picture that stands for it where it is small. */
const drawn = (c) => {
  const image = images.get(c.title);
  return { file: image.name, ratio: ratio(image), small: image.smallName ? [image.smallName] : [] };
};
/** Its names: the English one only when it is another. */
const names = (c) => [c.subject.es, c.subject.en === c.subject.es ? '' : c.subject.en];
const regions = {};
for (const c of of('regions').sort((a, b) => a.subject.map.localeCompare(b.subject.map) || b.subject.level - a.subject.level || byName(a, b))) {
  const { file, ratio: r, small } = drawn(c);
  (regions[c.subject.map] ??= []).push([c.subject.id, c.subject.level, ...names(c), file, r, ...small]);
}
const row = (c, ...before) => {
  const { file, ratio: r, small } = drawn(c);
  return [...before, ...names(c), file, r];
};
const capitalRows = of('capitals')
  .sort((a, b) => a.subject.map.localeCompare(b.subject.map) || byName(a, b))
  .map((c) => [...row(c, c.subject.id, c.subject.map), ...drawn(c).small]);
/** The other cities, by country and by name. */
const cityRows = {};
for (const c of of('cities').sort(byName)) (cityRows[c.subject.map] ??= []).push([...row(c, c.subject.id), ...drawn(c).small]);
const past = {};
for (const c of of('past')) {
  const { file, ratio: r, small } = drawn(c);
  (past[c.subject.map] ??= []).push([file, r, c.subject.from, c.subject.to, ...small]);
}
const gone = of('gone').sort(byName).map((c) => [...row(c, c.subject.id), c.subject.from, c.subject.to, ...drawn(c).small]);
const listedRows = (group) => of(group).sort(byName).map((c) => [...row(c, c.subject.id), ...drawn(c).small]);
const signals = of('signals').map((c) => [...row(c, c.subject.id, c.subject.code), ...drawn(c).small]);
const means = Object.fromEntries(of('signals').filter((c) => c.subject.means?.es).map((c) => [c.subject.id, [c.subject.means.es, c.subject.means.en ?? '']]));

/** A list written with one entry to a line: a flag that changes is a line that changes. */
const lines = (items) => `[\n${items.map((item) => JSON.stringify(item)).join(',\n')}\n]`;
const byKey = (lists) => `{\n${Object.keys(lists).sort().map((key) => `${JSON.stringify(key)}: ${lines(lists[key])}`).join(',\n')}\n}`;
const catalogue = [
  '{',
  '"v": 2,',
  `"regions": ${byKey(regions)},`,
  `"capitals": ${lines(capitalRows)},`,
  `"cities": ${byKey(cityRows)},`,
  `"past": ${byKey(past)},`,
  `"gone": ${lines(gone)},`,
  `"organisations": ${lines(listedRows('organisations'))},`,
  `"peoples": ${lines(listedRows('peoples'))},`,
  `"signals": ${lines(signals)},`,
  `"means": {\n${Object.keys(means).map((id) => `${JSON.stringify(id)}: ${JSON.stringify(means[id])}`).join(',\n')}\n}`,
  '}',
  '',
].join('\n');

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
console.log(`Banderas: ${shown.length}, en ${wanted.size} archivos, ${mb([...wanted.values()].reduce((sum, body) => sum + body.length, 0))}.`);
console.log(`  De divisiones ${of('regions').length}, en ${Object.keys(regions).length} mapas; de capitales ${capitalRows.length}; de otras ciudades ${of('cities').length}, de ${Object.keys(cityRows).length} países; anteriores de los países ${of('past').length}, de ${Object.keys(past).length}; de lo que ya no existe ${gone.length}; de organizaciones ${of('organisations').length}; de pueblos ${of('peoples').length}; señales ${signals.length}.`);
console.log(`  Dibujos (SVG): ${drawings.length}, ${mb(bytes(drawings))}; ${small.length} de ellos, los de más de ${Math.round(LIGHT_FROM / 1000)} kB, con una imagen para las listas (${mb(small.reduce((sum, image) => sum + image.small.length, 0))}).`);
console.log(`  Imágenes (WebP): ${pictures.length}, ${mb(bytes(pictures))}: ${JSON.stringify(count(pictures, (image) => image.how))}.`);
console.log(`  Fuera: ${leftOut.length}: ${JSON.stringify(count(leftOut, (one) => `${one.group} ${one.why}`))}.`);
const pending = all.filter((image) => image.pending).length;
if (pending) console.log(`  ${pending} dibujos con texto esperan su imagen: están en ${path.relative(ROOT, PICTURES)}, y el flujo «Traer datos» la trae.`);
const report = value('report');
if (report) {
  fs.writeFileSync(
    path.resolve(ROOT, report),
    JSON.stringify(
      {
        shown: shown.map((c) => ({
          group: c.group,
          id: c.subject.id,
          map: c.subject.map,
          name: c.subject.es,
          ...(c.subject.from || c.subject.to ? { years: [c.subject.from, c.subject.to] } : {}),
          title: c.title,
          asked: c.asked,
          by: c.by ?? ITEMS[c.group]?.[c.subject.id]?.by,
          page: ITEMS[c.group]?.[c.subject.id]?.page,
          file: images.get(c.title).name,
          how: images.get(c.title).how,
          bytes: images.get(c.title).body.length,
          small: images.get(c.title).small?.length,
          cleaned: images.get(c.title).cleaned,
          w: images.get(c.title).w,
          h: images.get(c.title).h,
          raw: FILES[c.title].bytes,
        })),
        leftOut,
        // Shown, and in a category that speaks of other times or of a proposal without settling it: to be looked at.
        doubted: shown.filter((c) => marksOf(c.asked).length).map((c) => ({ group: c.group, id: c.subject.id, name: c.subject.es, title: c.title, marks: marksOf(c.asked) })),
      },
      null,
      1,
    ),
  );
}
