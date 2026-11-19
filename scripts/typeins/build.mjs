// Writes what the game ships with for type-ins, `src/lib/typeins.default.json`, from the answers of a
// JetPunk quiz (`jetpunk.txt`), a few matches made by hand (`match.json`) and a few changes to what the
// list says (`extra.json`), which is all about regions; and, for countries, cities and capitals, from a
// short list written by hand (`lugares.json`).
//
//   node scripts/typeins/build.mjs          writes the file and `informe.md`
//   node scripts/typeins/build.mjs --check  fails if the file is not what would be written
//
// Each answer of the quiz is matched to the pieces of the game that go by its name in its country, or by
// its code where the names are close. A piece that is matched gets the type-ins of the answer, and no
// initials unasked (`rule: false`): what the list says is all there is to say about it.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DATA = path.join(ROOT, 'public/data');
const OUT = path.join(ROOT, 'src/lib/typeins.default.json');
const REPORT = path.join(HERE, 'informe.md');
const SOURCE_URL = 'https://www.jetpunk.com/user-quizzes/309965/all-first-level-subdivisions-of-the-world-with-a-map';

// ---------------------------------------------------------------------------
// Text, the way the game folds it (src/lib/text.ts)
// ---------------------------------------------------------------------------

const FOLD = { ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o', đ: 'd', ð: 'd', ł: 'l', ı: 'i', þ: 'th', ə: 'a', ħ: 'h' };
const fold = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[ßæœøđðłıþəħ]/g, (c) => FOLD[c])
    .replace(/&/g, ' y ')
    .replace(/['’‘`´ʻʼʿʾ.]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
/** Letters and digits run together, in capitals: what a pattern is tried on. */
const flat = (s) => fold(s).replace(/ /g, '').toUpperCase();
/** The key the game compares spellings by: no leading article, "st" read as "saint". */
const key = (s) =>
  fold(s)
    .replace(/\bst\b/g, 'saint')
    .replace(/^(el|la|los|las|the|l) (?=.)/, '')
    .replace(/ /g, '');

function editDistance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// ---------------------------------------------------------------------------
// The answers of the quiz
// ---------------------------------------------------------------------------

/** Where the quiz files what the game keeps under another country, or under none. */
const COUNTRY = {
  Abkhazia: ['GE'],
  'Cape Verde': ['CV'],
  'Czech Republic': ['CZ'],
  'Democratic Republic of the Congo': ['CD'],
  'East Timor': ['TL'],
  'Federated States of Micronesia': ['FM'],
  'Ivory Coast': ['CI'],
  Kosovo: ['XK'],
  'Northern Cyprus': ['CY'],
  Puntland: ['SO'],
  'Republic of the Congo': ['CG'],
  Russia: ['RU', 'UA'],
  'Sahrawi Republic': ['EH'],
  Somaliland: ['SO'],
  'South Ossetia': ['GE'],
  'Transnistria (Pridnestrovie)': ['MD'],
  'Wa State': ['MM'],
  // Lands of their own in the game, each with its pieces.
  Australia: ['AU', 'CX', 'CC', 'NF'],
  China: ['CN', 'HK', 'MO'],
  Finland: ['FI', 'AX'],
  France: ['FR', 'PF', 'BL', 'MF', 'PM', 'WF', 'GF', 'GP', 'MQ', 'YT', 'RE', 'NC'],
  Netherlands: ['NL', 'BQ'],
  'New Zealand': ['NZ', 'TK'],
  Norway: ['NO', 'SJ'],
  'United Kingdom': ['GB', 'GG', 'IM', 'JE', 'AI', 'BM', 'VG', 'KY', 'FK', 'GI', 'MS', 'PN', 'SH', 'TC'],
  'United States': ['US', 'AS', 'GU', 'MP', 'PR', 'VI'],
};

/** A pattern as the game keeps it, or null when it cannot be read. */
function pattern(t) {
  const body = t.slice(2);
  try {
    return t[0] === 'c' ? { text: `c:${flat(body)}`, re: new RegExp(flat(body).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } : { text: `r:${body}`, re: new RegExp(body, 'i') };
  } catch {
    return null;
  }
}

function readSource() {
  const rows = [];
  let country = '';
  const bad = [];
  for (const line of fs.readFileSync(path.join(HERE, 'jetpunk.txt'), 'utf8').split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    if (line.startsWith('@')) {
      country = line.slice(1).trim();
      continue;
    }
    const [code, name, ...typeins] = line.split(';');
    if (!code || !name || typeins.some((t) => !t)) bad.push(line);
    const forms = typeins.map((t) => (/^[rc]:/.test(t) ? pattern(t) : { text: t }));
    if (forms.some((f) => !f)) bad.push(line);
    rows.push({ country, code, name, forms: forms.filter(Boolean) });
  }
  if (bad.length) throw new Error(`jetpunk.txt: ${bad.length} lines cannot be read:\n${bad.join('\n')}`);
  return rows;
}

/** Whether the quiz would take this text for the answer: a spelling begun, or a pattern set off. */
function takes(row, text) {
  if (!row.forms.length) return text.startsWith(flat(row.name));
  return row.forms.some((f) => (f.re ? f.re.test(text) : text.startsWith(f.text)));
}

// ---------------------------------------------------------------------------
// The pieces of the game
// ---------------------------------------------------------------------------

function readPieces() {
  const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
  const byCountry = new Map();
  const byId = new Map();
  const names = new Map();
  for (const c of index.countries) {
    names.set(c.id, c.n.en ?? c.n.es);
    const file = path.join(DATA, 'r', `${c.id}.json`);
    if (!fs.existsSync(file)) continue;
    const topo = JSON.parse(fs.readFileSync(file, 'utf8'));
    const list = [];
    for (const [level, object] of Object.entries(topo.objects)) {
      for (const g of object.geometries) {
        const p = g.properties ?? {};
        const proper = [p.n?.es, p.n?.en, p.n?.lo].filter(Boolean);
        // "E:East" marks a name for one language only: the mark is not part of it.
        const all = [...proper, ...(p.al ?? []).map((a) => a.replace(/^[A-Z]:/, ''))];
        let piece = byId.get(g.id);
        // The same piece may stand at two levels of a country (Scotland among nations and among regions).
        if (!piece) byId.set(g.id, (piece = { id: g.id, country: c.id, levels: [], name: proper[0] ?? g.id, proper, all, flats: new Set(), keys: new Set() }));
        piece.levels.push(level);
        for (const n of all) {
          // The game takes each side of a double name on its own ("Tunapuna/Piarco"), and a name without
          // what it carries in brackets.
          for (const part of n.includes('/') ? [n, ...n.split('/')] : [n]) {
            const bare = part.replace(/\s*\([^)]*\)\s*/g, ' ');
            for (const x of bare !== part ? [part, bare] : [part]) {
              if (!key(x)) continue;
              piece.flats.add(flat(x));
              piece.keys.add(key(x));
            }
          }
        }
        if (!list.includes(piece)) list.push(piece);
      }
    }
    byCountry.set(c.id, list);
  }
  return { index, byCountry, byId, names };
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** Answers given a piece by hand, or none (null), where the rules below would get it wrong. */
const FORCE = Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(HERE, 'match.json'), 'utf8'))).filter(([code]) => !code.startsWith('//')));

function match(rows, game) {
  const countryIds = new Map();
  const byName = new Map();
  for (const c of game.index.countries) {
    for (const n of [c.n.en, c.n.es, ...(c.al ?? [])]) if (n) byName.set(flat(n), c.id);
  }
  const unknownCountries = new Set();
  const poolOf = (row) => {
    let ids = countryIds.get(row.country);
    if (!ids) {
      ids = COUNTRY[row.country] ?? [byName.get(flat(row.country))].filter(Boolean);
      if (!ids.length) unknownCountries.add(row.country);
      countryIds.set(row.country, ids);
    }
    return ids.flatMap((id) => game.byCountry.get(id) ?? []);
  };

  const out = [];
  for (const row of rows) {
    const pool = poolOf(row);
    const name = flat(row.name.replace(/\s*\([^)]*\)\s*/g, ' '));
    const id = row.code.replace(/[_–]/g, '-');
    if (row.code in FORCE) {
      const ids = [FORCE[row.code]].flat().filter(Boolean);
      const pieces = ids.map((x) => game.byId.get(x));
      if (pieces.some((p) => !p)) throw new Error(`match.json: ${row.code} points to a piece that is not in the game: ${ids.join(', ')}`);
      out.push({ row, pieces, how: pieces.length ? 'hand' : 'none' });
      continue;
    }
    const same = pool.filter((p) => p.flats.has(name));
    if (same.length) {
      out.push({ row, pieces: same, how: 'name' });
      continue;
    }
    const coded = pool.find((p) => p.id === id) ?? game.byId.get(id);
    if (coded) {
      const names = [...coded.flats];
      const close = names.some((n) => editDistance(n, name) <= Math.max(1, Math.floor(Math.min(n.length, name.length) / 4)) || (name.length >= 4 && (n.includes(name) || name.includes(n)) && n.length >= 4));
      if (names.some((n) => takes(row, n)) || close) {
        out.push({ row, pieces: [coded], how: 'code' });
        continue;
      }
      out.push({ row, pieces: [], how: 'none', doubt: `mismo código, otro nombre: ${coded.name}` });
      continue;
    }
    // No name and no code: the type-ins of the answer may still take the name of one piece, and one only.
    const taken = pool.filter((p) => [...p.flats].some((n) => takes(row, n)));
    out.push({ row, pieces: [], how: 'none', ...(taken.length ? { doubt: `¿${taken.map((p) => `${p.name} (${p.id})`).join(', ')}?` } : {}) });
  }
  if (unknownCountries.size) throw new Error(`Countries of the quiz that are not told apart: ${[...unknownCountries].join(', ')}`);
  return out;
}

// ---------------------------------------------------------------------------
// What ships
// ---------------------------------------------------------------------------

/**
 * True for a name of several words, the only kind the rule of the game gives initials to. It errs on the
 * side of saying so: a piece of one word that is told to take no initials loses nothing.
 */
const severalWords = (name) =>
  name
    .normalize('NFC')
    .replace(/\([^)]*\)/g, ' ')
    .split('/')
    .some((part) => /[\p{L}\p{N}][^\p{L}\p{M}\p{N}]+[\p{L}\p{N}]/u.test(part));

function build() {
  const rows = readSource();
  const game = readPieces();
  const matched = match(rows, game);
  const extra = JSON.parse(fs.readFileSync(path.join(HERE, 'extra.json'), 'utf8'));

  /** id → { piece, forms } */
  const byPiece = new Map();
  for (const m of matched) {
    for (const piece of m.pieces) {
      let e = byPiece.get(piece.id);
      if (!e) byPiece.set(piece.id, (e = { piece, forms: [], rows: [] }));
      e.rows.push(m.row);
      for (const f of m.row.forms) {
        // A spelling that is one of its names already says nothing new.
        if (!f.re && piece.keys.has(key(f.text))) continue;
        if (!e.forms.includes(f.text)) e.forms.push(f.text);
      }
    }
  }
  const edits = {};
  for (const id of [...byPiece.keys()].sort()) {
    const { piece, forms } = byPiece.get(id);
    const drop = extra[id]?.drop ?? [];
    for (const x of drop) if (!forms.includes(x)) throw new Error(`extra.json: ${id} has no "${x}" to drop`);
    const add = forms.filter((x) => !drop.includes(x));
    for (const x of extra[id]?.add ?? []) if (!add.includes(x)) add.push(x);
    const rule = !piece.proper.some(severalWords);
    if (add.length || !rule) edits[id] = { ...(add.length ? { add } : {}), ...(rule ? {} : { rule: false }) };
  }
  for (const id of Object.keys(extra)) {
    if (id.startsWith('//')) continue;
    if (!byPiece.has(id)) throw new Error(`extra.json: ${id} is not a piece that the list covers`);
  }
  // Countries, cities and capitals come after the regions, each kind in the order of its ids.
  const other = places(game);
  for (const id of Object.keys(other.edits).sort()) {
    if (edits[id]) throw new Error(`lugares.json: ${id} is a piece of the list of regions`);
    edits[id] = other.edits[id];
  }
  return { rows, game, matched, byPiece, edits, extra, places: other.rows, regions: byPiece.size };
}

// ---------------------------------------------------------------------------
// Countries, cities and capitals
// ---------------------------------------------------------------------------

/**
 * What ships for what the quiz does not cover (`lugares.json`): the short forms in everyday use that the
 * initials of a name do not spell («EUA», «BCN», «CDMX»), and the initials that the rule leaves aside
 * because two cities of one map share them («SF» is San Francisco, whatever Sioux Falls says). They are
 * added to what the rule gives: the piece keeps its initials.
 *
 * A city is written once and hands its forms on to the capital it is: that of its country (`cap:US`) and
 * that of every region whose capital it is (`cap:ES-CT`, `cap:ES-B`). Where a capital already has one of
 * them among its names, that one is left out without a word.
 */
function places(game) {
  const file = JSON.parse(fs.readFileSync(path.join(HERE, 'lugares.json'), 'utf8'));
  const cities = JSON.parse(fs.readFileSync(path.join(DATA, 'cities.json'), 'utf8')).c;
  const capitals = JSON.parse(fs.readFileSync(path.join(DATA, 'capitals.json'), 'utf8')).rc;
  const countries = new Map(game.index.countries.map((c) => [c.id, c]));
  const edits = {};
  const rows = [];
  /** Adds forms to a thing; `mine` when the list names it, and so everything in it has to be news. */
  const put = (id, names, forms, mine, what) => {
    const have = new Set(names.filter(Boolean).map(key));
    const add = [];
    for (const f of forms) {
      if (typeof f !== 'string' || !key(f)) throw new Error(`lugares.json: ${what} has a form that cannot be read`);
      if (have.has(key(f))) {
        if (mine) throw new Error(`lugares.json: «${f}» is one of the names of ${what} already`);
        continue;
      }
      if (add.some((x) => key(x) === key(f))) throw new Error(`lugares.json: «${f}» twice for ${what}`);
      add.push(f);
    }
    if (!add.length) return [];
    const before = edits[id]?.add ?? [];
    const fresh = add.filter((f) => !before.some((x) => key(x) === key(f)));
    if (fresh.length) edits[id] = { add: [...before, ...fresh] };
    return fresh;
  };
  for (const [id, forms] of Object.entries(file.countries ?? {})) {
    const c = countries.get(id);
    if (!c) throw new Error(`lugares.json: there is no country ${id}`);
    put(id, [c.n.es, c.n.en, ...(c.al ?? [])], forms, true, `${c.n.es} (${id})`);
    rows.push({ kind: 'country', id, name: c.n.es, forms });
  }
  for (const [country, list] of Object.entries(file.cities ?? {})) {
    const c = countries.get(country);
    if (!c) throw new Error(`lugares.json: there is no country ${country}`);
    for (const [name, forms] of Object.entries(list)) {
      const hits = (cities[country] ?? []).filter((x) => [x.n.es, x.n.en, ...(x.al ?? [])].some((n) => n && key(n) === key(name)));
      if (hits.length !== 1) throw new Error(`lugares.json: ${hits.length} cities of ${country} go by «${name}»`);
      const city = hits[0];
      const own = [city.n.es, city.n.en, ...(city.al ?? [])];
      put(city.i, own, forms, true, `${city.n.es} (${country})`);
      const row = { kind: 'city', id: city.i, name: city.n.es, country: c.n.es, forms, capitalOf: [] };
      // The capital of its country…
      if (city.k === 3 && c.cap) {
        const fresh = put(`cap:${country}`, [c.cap.es, c.cap.en, ...(c.cap.al ?? [])], forms, false, '');
        if (fresh.length) row.capitalOf.push({ id: `cap:${country}`, name: c.n.es, forms: fresh });
      }
      // …and of the regions that have it for one, at any level.
      const mine = new Set([city.n.es, city.n.en].filter(Boolean).map(key));
      for (const table of Object.values(capitals[country] ?? {})) {
        for (const [unit, names] of Object.entries(table)) {
          if (!names.some((n) => mine.has(key(n)))) continue;
          const fresh = put(`cap:${unit}`, names, forms, false, '');
          if (fresh.length) row.capitalOf.push({ id: `cap:${unit}`, name: game.byId.get(unit)?.name ?? unit, forms: fresh });
        }
      }
      rows.push(row);
    }
  }
  return { edits, rows };
}

function fileText(edits) {
  const lines = Object.entries(edits).map(([id, e]) => `    ${JSON.stringify(id)}: ${JSON.stringify(e)}`);
  return `{
  "app": "regionle",
  "kind": "typeins",
  "version": 1,
  "auto": true,
  "note": "Escrito por scripts/typeins/build.mjs a partir de scripts/typeins/jetpunk.txt y extra.json (regiones) y de lugares.json (países, ciudades y capitales): los cambios, allí.",
  "edits": {
${lines.join(',\n')}
  }
}
`;
}

/** The type-ins that two pieces on one map of the game have alike: what is typed fills both. */
function sharedForms(game, edits) {
  const out = [];
  for (const [country, pieces] of game.byCountry) {
    const byForm = new Map();
    for (const piece of pieces)
      for (const level of piece.levels)
        for (const form of edits[piece.id]?.add ?? []) {
          const k = `${level} ${form}`;
          byForm.set(k, [...(byForm.get(k) ?? []), piece]);
        }
    const seen = new Set();
    for (const [k, list] of byForm) {
      const form = k.slice(k.indexOf(' ') + 1);
      const ids = list.map((p) => p.id).join(' ');
      if (list.length < 2 || seen.has(`${form} ${ids}`)) continue;
      seen.add(`${form} ${ids}`);
      out.push({ country: game.names.get(country) ?? country, form, pieces: list });
    }
  }
  return out;
}

function report({ rows, game, matched, byPiece, edits: all, extra, places: byHand }) {
  // The figures of the list are those of its pieces: what is written by hand for the rest has its own section.
  const edits = Object.fromEntries(Object.entries(all).filter(([id]) => byPiece.has(id)));
  const total = rows.length;
  const hit = matched.filter((m) => m.pieces.length);
  const withForms = rows.filter((r) => r.forms.length);
  const lost = matched.filter((m) => !m.pieces.length && m.row.forms.length);
  const forms = Object.values(edits).reduce((n, e) => n + (e.add?.length ?? 0), 0);
  const patterns = Object.values(edits).reduce((n, e) => n + (e.add ?? []).filter((a) => /^[rc]:/.test(a)).length, 0);
  const plain = Object.values(edits).filter((e) => e.rule === false).length;
  const byCountry = new Map();
  for (const m of matched) {
    let c = byCountry.get(m.row.country);
    if (!c) byCountry.set(m.row.country, (c = { rows: 0, hit: 0, miss: [] }));
    c.rows++;
    if (m.pieces.length) c.hit++;
    else c.miss.push(m);
  }
  const out = [];
  out.push('# Type-ins de fábrica: qué ha entrado de la lista');
  out.push('');
  out.push(`Lo escribe \`scripts/typeins/build.mjs\` cada vez que genera \`src/lib/typeins.default.json\`. La lista es la del quiz de JetPunk [ALL First-Level Subdivisions of the World With a Map](${SOURCE_URL}), de Vicky.`);
  out.push('');
  out.push(`- Respuestas en la lista: **${total}** (${withForms.length} con type-ins propios).`);
  out.push(`- Casan con una pieza del juego: **${hit.length}**, que son ${byPiece.size} piezas distintas.`);
  out.push(`- Type-ins que entran: **${forms}** (${patterns} patrones y ${forms - patterns} escritos tal cual), en ${Object.values(edits).filter((e) => e.add?.length).length} piezas.`);
  out.push(`- Piezas de varias palabras que dejan de tener siglas automáticas: **${plain}**.`);
  out.push(`- Respuestas con type-ins que no casan con nada: **${lost.length}**.`);
  out.push('');
  out.push('Una respuesta casa con las piezas de su país que se llaman igual (en español, en inglés o en la lengua local), o con la que tiene su mismo código si el nombre se parece. Lo que no casa suele ser una división que el juego no tiene: el mapa del juego es el de Natural Earth, y el quiz va más al día y a veces a otro nivel.');
  out.push('');
  out.push('## Por país');
  out.push('');
  out.push('Solo los países donde algo no casa; la lista entera de lo que queda fuera está al final.');
  out.push('');
  out.push('| País en la lista | Respuestas | Casan | Sin casar |');
  out.push('| --- | ---: | ---: | --- |');
  for (const [country, c] of byCountry) {
    if (!c.miss.length) continue;
    const miss = c.miss.map((m) => m.row.name);
    const shown = miss.length > 12 ? `${miss.slice(0, 12).join(', ')}… (${miss.length})` : miss.join(', ');
    out.push(`| ${country} | ${c.rows} | ${c.hit} | ${shown} |`);
  }
  const doubts = matched.filter((m) => m.doubt);
  if (doubts.length) {
    out.push('');
    out.push('## Dudas');
    out.push('');
    out.push('Respuestas que no casan por el nombre, con la pieza a la que apuntaban su código o sus type-ins. Las que sí eran esa pieza están dadas a mano en `match.json`.');
    out.push('');
    for (const m of doubts) out.push(`- ${m.row.country} · ${m.row.name} (\`${m.row.code}\`): ${m.doubt}`);
  }
  const hand = matched.filter((m) => m.how === 'hand');
  if (hand.length) {
    out.push('');
    out.push('## Casadas a mano');
    out.push('');
    out.push('Están en `match.json`: la misma división con otro nombre, o la pieza que es de verdad la de la lista cuando dos del juego responden al mismo nombre.');
    out.push('');
    for (const m of hand) out.push(`- ${m.row.country} · ${m.row.name} (\`${m.row.code}\`) → ${m.pieces.map((p) => `${p.name} (\`${p.id}\`)`).join(', ')}`);
  }
  const changed = Object.entries(extra).filter(([id]) => !id.startsWith('//'));
  if (changed.length) {
    out.push('');
    out.push('## Cambiado a mano');
    out.push('');
    out.push('Está en `extra.json`: lo que el juego pone o quita sobre lo que dice la lista.');
    out.push('');
    for (const [id, e] of changed) {
      const what = [e.add?.length ? `se añade ${e.add.map((x) => `\`${x}\``).join(', ')}` : '', e.drop?.length ? `se quita ${e.drop.map((x) => `\`${x}\``).join(', ')}` : ''].filter(Boolean).join('; ');
      out.push(`- ${game.byId.get(id).name} (\`${id}\`): ${what}`);
    }
  }
  const twice = sharedForms(game, edits);
  if (twice.length) {
    out.push('');
    out.push('## Un mismo type-in para dos piezas del mismo mapa');
    out.push('');
    out.push('Así vienen en la lista, y así quedan: lo que se escribe rellena las dos. Con un patrón (`r:`), el nombre entero de una de ellas sigue siendo solo esa: «shanxi» es Shanxi y «shaanxi» es Shaanxi.');
    out.push('');
    for (const t of twice) out.push(`- ${t.country} · \`${t.form}\`: ${t.pieces.map((p) => `${p.name} (\`${p.id}\`)`).join(', ')}`);
  }
  if (byHand.length) {
    const tick = (forms) => forms.map((x) => `\`${x}\``).join(', ');
    const countries = byHand.filter((r) => r.kind === 'country');
    const cities = byHand.filter((r) => r.kind === 'city');
    const capitals = cities.reduce((n, r) => n + r.capitalOf.length, 0);
    out.push('');
    out.push('## Países, ciudades y capitales');
    out.push('');
    out.push(
      `No vienen de la lista, que es de regiones: están escritos a mano en \`lugares.json\`. Son las abreviaturas y los nombres cortos de uso corriente que las iniciales del nombre no dan, y las siglas que la regla deja sin valer porque en su mapa las deletrean dos ciudades. Se suman a las siglas automáticas, que estas piezas conservan. Son **${countries.length}** países y **${cities.length}** ciudades, que se las pasan a **${capitals}** capitales: una ciudad escrita aquí vale igual cuando se pregunta por ella como capital de su país o de una región.`,
    );
    out.push('');
    for (const r of countries) out.push(`- ${r.name} (\`${r.id}\`): ${tick(r.forms)}`);
    out.push('');
    for (const r of cities) {
      const as = r.capitalOf.map((c) => `${c.name} (\`${c.id}\`)${c.forms.length < r.forms.length ? `, solo ${tick(c.forms)}` : ''}`);
      out.push(`- ${r.name} (\`${r.id}\`, ${r.country}): ${tick(r.forms)}${as.length ? ` · también como capital de ${as.join('; ')}` : ''}`);
    }
  }
  out.push('');
  out.push('## Todo lo que no casa');
  out.push('');
  out.push('Con asterisco, las respuestas que traían type-ins propios.');
  out.push('');
  for (const [country, c] of byCountry) {
    if (!c.miss.length) continue;
    out.push(`- **${country}** (${c.miss.length}): ${c.miss.map((m) => `${m.row.name}${m.row.forms.length ? '\\*' : ''}`).join(', ')}`);
  }
  out.push('');
  return out.join('\n');
}

const result = build();
const text = fileText(result.edits);
if (process.argv.includes('--check')) {
  if (fs.readFileSync(OUT, 'utf8') !== text) {
    console.error('src/lib/typeins.default.json is not what scripts/typeins/build.mjs writes: run it.');
    process.exit(1);
  }
  console.log('typeins.default.json is up to date');
} else {
  fs.writeFileSync(OUT, text);
  fs.writeFileSync(REPORT, report(result));
  const hit = result.matched.filter((m) => m.pieces.length).length;
  console.log(`${result.rows.length} answers · ${hit} matched · ${Object.keys(result.edits).length} pieces written · ${(text.length / 1024).toFixed(0)} kB`);
}
