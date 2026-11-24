// Writes the lists of what flies a flag and is not in the maps (scripts/data/flags-lists.json): the
// countries that are no more, the organisations and the peoples, each by its Wikidata id, with its names
// and, for what is no more, the years it lasted between.
//
//   npm run data:flag-lists                    from the commit of the branch `datos` that flags-datos.mjs pins
//   npm run data:flag-lists -- --from folder   from a folder that holds a copy of the branch
//   npm run data:flag-lists -- --report file   and leave in a file what was decided of each thing
//
// What it reads: flags/candidates.json, which the workflow "Traer datos" brings (`flags-candidates`):
// everything in Wikidata that has a flag and that many Wikipedias write about, with what it is, its years
// and its flags. And the data of the game: a list names nothing that the maps already have.
//
// What the lists are for: the workflow brings the flags of what they name (`flags-listed`), and
// scripts/data/flags.mjs shows them under the names they give.
//
// Which things go in:
//
//   · What is no more (`historical`): what Wikidata says is a country of other times (HISTORICAL), that
//     ended in 1700 or later (before that, the flags that are drawn today are what somebody thinks they
//     were like) and whose flag is not one that a country of today flies: a period of the history of a
//     country that flew the flag it still flies is that country, and not another. Of several that would be
//     shown by the same flag, the best known. The exceptions are by hand, each with its reason (GONE).
//   · The organisations and the peoples: those that are named by hand (ORGANISATIONS, PEOPLES), which are
//     few and no rule tells from the rest. A people whose flag is that of its country or of its region is
//     not one of them: that flag is already in the game.

import fs from 'node:fs';
import path from 'node:path';
import { ROOT, branch } from './flags-datos.mjs';
import { todayTitles } from './flags-names.mjs';

const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const json = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const OUT = path.resolve(ROOT, value('out') ?? 'scripts/data/flags-lists.json');
const DATA = path.resolve(ROOT, 'public/data');

/** What Wikidata calls a country of other times, by the id of the class. */
const HISTORICAL = {
  Q3024240: 'historical country',
  Q99541706: 'historical unrecognized state',
  Q236036: 'republic of the Soviet Union',
};
/** What is not a country that was, whatever else it is said to be: an empire across the seas is the country that had it. */
const NOT_A_COUNTRY = { Q1790360: 'colonial empire' };
/** The first year that what is no more may have ended in. */
const SINCE = 1700;

/**
 * What is no more, by hand. `out`: left out, though the rules would take it. `keep`: taken, though a rule
 * would leave it out. Each with its reason.
 */
const GONE = {
  keep: {
    Q33946: 'Checoslovaquia: su bandera es la que conservó Chequia, y es por la que se la conoce',
  },
  out: {
    Q80702: 'El Imperio español: sus banderas son las de España, que están entre las que España tuvo',
    Q130654: 'El Imperio neerlandés: la bandera de los Países Bajos',
    Q329618: 'El Imperio colonial alemán: Wikidata le da una bandera que se propuso en 1914 y no llegó a izarse',
    Q153665: 'El África del Sudoeste Alemana: una bandera que se propuso en 1914 y no llegó a izarse',
    Q153963: 'El África Oriental Alemana: como la del Sudoeste',
    Q668294: 'Kamerun: como la del Sudoeste',
    Q600093: 'La España de los Austrias: un estandarte real, y un periodo de España',
    Q13426199: 'La República de China de 1912 a 1971: es Taiwán, que el juego ya tiene',
    Q215443: 'El Imperio sueco: la bandera de Suecia',
    Q186096: 'El Zarato ruso: de sus banderas solo se sabe la de un barco',
    Q215530: 'El Reino de Irlanda: Wikidata le da el aspa de san Patricio, que no fue su bandera',
    Q796583: 'El Reino del Congo: una bandera según un misionero del siglo XVII',
    Q729768: 'El Reino zulú: una bandera conjeturada',
    Q627449: 'La dinastía hotaki: una bandera negra lisa',
    Q696241: 'El Kanato de Kokand: un paño blanco, del que no se sabe más',
    Q838931: 'El Reino de Italia del Sacro Imperio: una cruz, no una bandera suya',
    Q175211: 'El Reino de Germania: un estandarte del siglo XIV',
    Q157070: 'El Condado de Flandes: la bandera que Flandes tiene hoy',
    Q214102: 'La Unión de la guerra de Secesión: es Estados Unidos',
    Q8680: 'El Imperio británico: su bandera es la del Reino Unido',
    Q179997: 'Las Trece Colonias: la enseña roja británica, que no era suya',
    Q170604: 'Nueva Francia: el estandarte real de Francia, que no era suyo',
    Q213510: 'El Congo Belga: Wikidata le da la bandera del Estado Libre del Congo, que ya está',
    Q153136: 'La monarquía de los Habsburgo: no tuvo una bandera, sino las de sus reinos',
    Q2429253: 'Estado Islámico: una organización armada',
    Q427941: 'El Emirato Islámico de Afganistán de 1996: la bandera de los talibanes es la que Afganistán tiene hoy',
    Q696251: 'La ocupación de Japón: un periodo, no un país',
    Q156111: 'El Gobierno General de Polonia: la bandera de la Alemania nazi',
    Q58738: 'La República Soviética de Baviera: una bandera roja lisa',
  },
};

/** The organisations: those of States, of today and of other times. */
const ORGANISATIONS = [
  'Q1065', // United Nations
  'Q458', // European Union
  'Q7184', // NATO
  'Q7809', // UNESCO
  'Q7817', // World Health Organization
  'Q740308', // UNICEF
  'Q41984', // International Atomic Energy Agency
  'Q54129', // International Labour Organization
  'Q125761', // International Civil Aviation Organization
  'Q170424', // World Meteorological Organization
  'Q17495', // Universal Postal Union
  'Q201054', // International Maritime Organization
  'Q7159', // African Union
  'Q7172', // Arab League
  'Q7785', // Commonwealth of Nations
  'Q7795', // OPEC
  'Q7779', // Commonwealth of Independent States
  'Q13116', // Benelux
  'Q81299', // OSCE
  'Q123759', // Organization of American States
  'Q4264', // Mercosur
  'Q4230', // Union of South American Nations
  'Q471690', // Andean Community
  'Q205995', // Caribbean Community
  'Q134102', // Organisation internationale de la Francophonie
  'Q182500', // Community of Portuguese Language Countries
  'Q4173083', // Eurasian Economic Union
  'Q318693', // Collective Security Treaty Organization
  'Q146165', // Nordic Council
  'Q217172', // Gulf Cooperation Council
  'Q596850', // Organization of Turkic States
  'Q337456', // East African Community
  'Q816706', // Southern African Development Community
  'Q370862', // Arab Maghreb Union
  'Q294278', // Organisation of African, Caribbean and Pacific States
  'Q215613', // Unrepresented Nations and Peoples Organization
  'Q190353', // Sovereign Military Order of Malta
  'Q190028', // Central American Integration System
  'Q319014', // Central European Free Trade Agreement
  'Q166110', // Union State of Russia and Belarus
  // Those that are no more.
  'Q38130', // League of Nations
  'Q41644', // Warsaw Pact
  'Q191582', // COMECON
  'Q191703', // Organisation of African Unity
  'Q277252', // SEATO
  'Q379850', // CENTO
  'Q189946', // Western European Union
  'Q161549', // European Coal and Steel Community
];

/** The peoples with a flag of their own, and the States that few others take to be one. */
const PEOPLES = [
  // States without general recognition that the maps do not have.
  'Q31354462', // Abkhazia
  'Q23427', // South Ossetia
  'Q23681', // Northern Cyprus
  'Q907112', // Transnistria
  'Q34754', // Somaliland
  // Peoples.
  'Q8060', // Romani
  'Q12223', // Kurds
  'Q46118', // Uyghurs
  'Q45315', // Berbers
  'Q48199', // Sámi
  'Q6122670', // Māori
  'Q12060728', // Aboriginal Australians
  'Q101828', // Ainu
  'Q117458', // Crimean Tatars
  'Q377085', // Assyrians
  'Q163943', // Druze
  'Q178484', // Mapuche
  'Q109402', // Aymara
  'Q464529', // Rohingya
  'Q68518', // Iroquois
  'Q108266', // Navajo
  'Q105405', // Cherokee
  'Q324516', // Choctaw
  'Q457341', // Asante
  'Q146521', // Sorbs
  'Q140420', // Rusyns
  'Q147239', // Kashubians
  'Q690126', // Livonians
  'Q147540', // Székelys
  'Q207353', // Acadia
  'Q104285', // Occitania
];

/** Names by hand, where Wikidata has none in a language or has one that is not right. */
const NAMES = {
  Q48199: { es: 'Samis', en: 'Sámi' },
  Q8060: { es: 'Pueblo gitano' },
  Q6122670: { es: 'Maoríes' },
  Q12060728: { es: 'Aborígenes australianos' },
  Q101828: { es: 'Ainus' },
  Q178484: { es: 'Mapuches' },
  Q109402: { es: 'Aimaras', en: 'Aymara' },
  Q464529: { es: 'Rohinyás' },
  Q68518: { es: 'Iroqueses' },
  Q108266: { es: 'Navajos' },
  Q105405: { es: 'Cheroquis' },
  Q324516: { es: 'Choctaws' },
  Q457341: { es: 'Asantes' },
  Q377085: { es: 'Asirios' },
  Q147540: { es: 'Sículos' },
  Q140420: { es: 'Rusinos' },
  Q207353: { es: 'Acadia', en: 'Acadia' },
  Q23427: { es: 'Osetia del Sur' },
  Q31354462: { es: 'Abjasia', en: 'Abkhazia' },
  Q7184: { es: 'OTAN', en: 'NATO' },
  Q1065: { es: 'Naciones Unidas' },
  Q740308: { es: 'UNICEF' },
  Q294278: { es: 'Organización de Estados de África, el Caribe y el Pacífico' },
  Q7795: { es: 'OPEP', en: 'OPEC' },
  Q81299: { es: 'OSCE', en: 'OSCE' },
  Q191582: { es: 'COMECON', en: 'COMECON' },
  // Those that Wikidata gives no flag of, and so are not among the candidates: their names are those it gives them.
  Q190028: { es: 'Sistema de la Integración Centroamericana', en: 'Central American Integration System' },
  Q319014: { es: 'Acuerdo Centroeuropeo de Libre Cambio (CEFTA)', en: 'Central European Free Trade Agreement (CEFTA)' },
  Q166110: { es: 'Unión de Rusia y Bielorrusia', en: 'Union State of Russia and Belarus' },
};

/* ------------------------------------------------------------------ what there is to choose from */

const FROM = await branch(value('from'));
const { items: ITEMS = {}, classes: CLASSES = {} } = json(path.join(FROM, 'flags', 'candidates.json'));
const INDEX = json(path.join(DATA, 'index.json'));

/**
 * The flags of a thing as scripts/data/outside.mjs tells them (`flags-listed`): those it flies (`live`: the
 * ones that name no day on which they stopped being flown, the preferred ones alone when there are any; of
 * those, the one that started last, a drawing before a photograph, and by name) and those it stopped flying
 * (`past`, the last first).
 */
function told(item) {
  const all = (item.flags ?? []).filter((f) => f.rank !== 'deprecated');
  const undated = all.filter((f) => !f.to);
  const live = undated.some((f) => f.rank === 'preferred') ? undated.filter((f) => f.rank === 'preferred') : undated;
  const since = (f) => (f.from && f.from !== '?' ? f.from : '');
  const svg = (f) => Number(/\.svg$/i.test(f.file));
  live.sort((a, b) => since(b).localeCompare(since(a)) || svg(b) - svg(a) || a.file.localeCompare(b.file));
  const day = (f) => (f.to === '?' ? '' : f.to);
  return { live, past: all.filter((f) => f.to).sort((a, b) => day(b).localeCompare(day(a)) || a.file.localeCompare(b.file)) };
}
/** The flag that something that goes on is shown by: the one it flies or, with none, the last it stopped flying. */
function flagOf(item) {
  const { live, past } = told(item);
  return (live[0] ?? past[0])?.file ?? null;
}
/**
 * The flag that something that is no more is shown by, as scripts/data/flags.mjs chooses it: the one that
 * Wikidata prefers; then the one it flew until it ended (the year it ended in, or the one before); then one
 * that is not said to have stopped flying; then the last that was.
 */
function lastFlagOf(item) {
  const { live, past } = told(item);
  const preferred = [...live, ...past].find((f) => f.rank === 'preferred');
  const untilTheEnd = item.to === undefined ? null : past.find((f) => /^\d{4}-/.test(f.to) && Number(f.to.slice(0, 4)) >= item.to - 1);
  return (preferred ?? untilTheEnd ?? live[0] ?? past[0])?.file ?? null;
}

/** The names that the flag of a country of today goes by in Commons (flags-names.mjs). */
const TODAY = todayTitles(INDEX);
/** The flags that the game already shows of a division or of a capital, by their names in Commons. */
const SHOWN = new Set(fs.existsSync(path.join(DATA, 'flag-credits.json')) ? Object.values(json(path.join(DATA, 'flag-credits.json')).files ?? {}).map((credit) => String(credit[0]).toLowerCase()) : []);
const flown = (title) => TODAY.has(String(title).toLowerCase()) || SHOWN.has(String(title).toLowerCase());

const capital = (name) => (name ? name.charAt(0).toLocaleUpperCase('es') + name.slice(1) : '');
/** The names of a thing: those given by hand before those of Wikidata, the Spanish one with a capital letter. */
const names = (id) => {
  const item = ITEMS[id] ?? {};
  const es = NAMES[id]?.es ?? item.es ?? NAMES[id]?.en ?? item.en ?? '';
  const en = NAMES[id]?.en ?? item.en ?? es;
  return { es: capital(es), en: capital(en) };
};

/* ------------------------------------------------------------------ what is no more */

const decided = [];
const taken = [];
for (const [id, item] of Object.entries(ITEMS)) {
  if (item.game) continue;
  const is = item.is ?? [];
  if (!is.some((k) => HISTORICAL[k]) && !GONE.keep[id]) continue;
  const flag = lastFlagOf(item);
  const about = { id, ...names(id), from: item.from ?? 0, to: item.to ?? 0, links: item.links, flag };
  const why = GONE.keep[id]
    ? null
    : GONE.out[id]
      ? 'hand'
      : is.some((k) => NOT_A_COUNTRY[k])
        ? 'not a country'
        : !flag
          ? 'no flag'
          : item.to === undefined
            ? 'no end'
            : item.to < SINCE
              ? 'too old'
              : item.to > new Date().getFullYear()
                ? 'not ended'
                : flown(flag)
                  ? 'a flag of today'
                  : null;
  if (why) decided.push({ ...about, why });
  else taken.push(about);
}
// Of several that the same flag would show, the one that most pages tell of; and by id, so that the list is the same each time.
taken.sort((a, b) => b.links - a.links || a.id.localeCompare(b.id, 'en', { numeric: true }));
const historical = {};
const byFlag = new Map();
for (const one of taken) {
  const first = byFlag.get(one.flag);
  if (first && !GONE.keep[one.id]) {
    decided.push({ ...one, why: `the same flag as ${first.id}` });
    continue;
  }
  if (!first) byFlag.set(one.flag, one);
  historical[one.id] = { es: one.es, en: one.en, from: one.from, to: one.to, links: one.links };
}

/* ------------------------------------------------------------------ those that are named */

const named = (ids, what) => {
  const list = {};
  for (const id of ids) {
    const { es, en } = names(id);
    if (!es) throw new Error(`${what}: ${id} has no name. Give it one in NAMES.`);
    list[id] = { es, en, ...(ITEMS[id]?.links ? { links: ITEMS[id].links } : {}) };
  }
  return list;
};
const organisations = named(ORGANISATIONS, 'organisations');
const peoples = named(PEOPLES, 'peoples');
for (const id of [...ORGANISATIONS, ...PEOPLES]) if (historical[id]) throw new Error(`${id} is in two lists`);

/* ------------------------------------------------------------------ what is written */

/** A list with one thing to a line: a thing that changes is a line that changes. */
const lines = (list) => `{\n${Object.entries(list).map(([id, one]) => `${JSON.stringify(id)}: ${JSON.stringify(one)}`).join(',\n')}\n}`;
fs.writeFileSync(OUT, `{\n"historical": ${lines(historical)},\n"organisations": ${lines(organisations)},\n"peoples": ${lines(peoples)}\n}\n`);

const count = (list, of) => {
  const n = {};
  for (const one of list) n[of(one)] = (n[of(one)] ?? 0) + 1;
  return n;
};
console.log(`Listas: ${Object.keys(historical).length} países y territorios que ya no existen, ${Object.keys(organisations).length} organizaciones, ${Object.keys(peoples).length} pueblos.`);
console.log(`  Fuera, de lo que ya no existe: ${JSON.stringify(count(decided, (one) => (one.why.startsWith('the same flag') ? 'the same flag as another' : one.why)))}.`);
const missing = [...ORGANISATIONS, ...PEOPLES].filter((id) => !ITEMS[id]);
if (missing.length) console.log(`  Sin bandera en Wikidata, y por tanto a mano (scripts/data/flags-hand.json): ${missing.join(', ')}.`);
const report = value('report');
if (report) {
  const said = (list, flag) => Object.keys(list).map((id) => ({ id, ...list[id], flag: ITEMS[id] ? flag(ITEMS[id]) : null, flags: ITEMS[id]?.flags ?? [] }));
  fs.writeFileSync(path.resolve(ROOT, report), JSON.stringify({ historical: said(historical, lastFlagOf), organisations: said(organisations, flagOf), peoples: said(peoples, flagOf), leftOut: decided }, null, 1));
}
