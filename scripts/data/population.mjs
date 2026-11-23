// Puts in each division of the maps how many people live in it.
//
//   npm run data:population
//   npm run data:population -- --data dir --src dir --report file
//
// It runs after `data:build`, on what that wrote, and needs two sources that `data:fetch` brings:
//
//   · wikidata-region-population.json: the figure Wikidata has for each division, which the workflow
//     "Traer datos" keeps in the branch `datos` of this repository (scripts/data/outside.mjs says how each
//     was found);
//   · population.csv: how many people each country had each year (World Bank).
//
// Wikidata's figures are not taken on trust. Some are of something else than the division (the city a
// province is called after, a province that has since been merged with its neighbours), and some are
// simply wrong: every district of Portugal carries the people of its capital. So the divisions of a
// country get their figures only when the figures hold together:
//
//   · every division that is asked about has one that can be of it: a whole number of people, of an entity
//     that does not say it is in another country and is not far smaller than the division;
//   · and together they add up to what the country had in the year they are of, give or take a tenth.
//
// A country that does not pass gets none: a game about figures cannot be played with some that are right
// and some that are not, nor name the ten largest of a list with holes in it.
//
// What it writes into public/data: in r/<ISO>.json, `pop` (people) and `py` (the year, when Wikidata gives
// one) on each division, and on each group of divisions the sum of its members with the oldest of their
// years; in index.json, `rp` on each country whose divisions carry them: the year most of them are of.
// What was read and what was decided about each country is left in .cache/population.txt.

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
const REPORT = path.resolve(ROOT, value('report') ?? '.cache/population.txt');

/** How far the sum of the divisions may be from the figure of the country. */
const TOLERANCE = 0.1;
/** An entity with less than this share of the area of a division is something else: the city a province is called after. */
const TINY = 0.3;
/** Unless it is a thousandth of it: 1.234 written where 1234 was meant, which Wikidata has here and there. */
const SLIP = [0.0008, 0.00125];
/**
 * Divisions whose figure in Wikidata counts the people of others that the map draws apart: the oblast of
 * Tyumen is given with its two autonomous districts. Theirs are taken away from it.
 */
const NESTED = { 'RU-TYU': ['RU-KHM', 'RU-YAN'] };
/** The code the World Bank files a country under, where it is not the one the maps have. */
const WB_CODE = { XK: 'XKX', PS: 'PSE', SS: 'SSD' };

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const nf = (n) => Math.round(n).toLocaleString('en');

/* ------------------------------------------------------------------ the sources */

const source = path.join(SRC, 'wikidata-region-population.json');
const series = path.join(SRC, 'population.csv');
for (const file of [source, series]) {
  if (!fs.existsSync(file)) {
    console.error(`Falta ${path.relative(ROOT, file)}: se trae con «npm run data:fetch».`);
    process.exit(1);
  }
}
const found = read(source).items ?? {};

/** Country code → year → people. */
const worldBank = new Map();
for (const line of fs.readFileSync(series, 'utf8').split(/\r?\n/).slice(1)) {
  const cells = line.split(',');
  // The name of a country can carry commas; the three cells after it cannot.
  const [code, year, people] = cells.slice(-3);
  if (!code || !(Number(people) > 0)) continue;
  if (!worldBank.has(code)) worldBank.set(code, new Map());
  worldBank.get(code).set(Number(year), Number(people));
}

/** How many people a country had in a year: of the World Bank's years, the nearest; without them, what the maps say it has. */
function national(country, year) {
  const years = worldBank.get(WB_CODE[country.id] ?? country.a3);
  if (!years) return country.pop > 0 ? country.pop : null;
  const known = [...years.keys()];
  const at = Math.min(Math.max(year, Math.min(...known)), Math.max(...known));
  return years.get(at) ?? years.get(known.reduce((a, b) => (Math.abs(b - at) < Math.abs(a - at) ? b : a)));
}

/* ------------------------------------------------------------------ what can be of a division */

/** The figure of a division, when what Wikidata has can be of it: { pop, year } or the reason why not. */
function figureOf(id, area) {
  const item = found[id];
  if (!item) return { why: 'sin cifra' };
  if (item.abroad) return { why: 'entidad de otro país' };
  const [people, day] = item.pop?.[0] ?? [];
  // Nobody living there is a figure, and one that no game of figures can be played with.
  if (people === 0) return { why: 'cifra de cero habitantes' };
  if (!Number.isInteger(people) || people < 0) return { why: 'cifra que no es un número de personas' };
  // What the maps name, as against what was looked for by code or by name, came with no check of its size.
  const share = !item.by && item.km2 > 0 && area > 0 ? item.km2 / area : null;
  if (share != null && share < TINY && !(share >= SLIP[0] && share <= SLIP[1])) return { why: 'entidad mucho menor que la división' };
  const year = /^\d{4}/.test(day ?? '') ? Number(day.slice(0, 4)) : null;
  return { pop: people, year };
}

const median = (list) => [...list].sort((a, b) => a - b)[Math.floor((list.length - 1) / 2)];

/** The properties of a piece with its figure after its area, or without one. */
function withFigure(props, figure) {
  const out = {};
  for (const [key, val] of Object.entries(props)) {
    if (key === 'pop' || key === 'py') continue;
    out[key] = val;
    if (key === 'ar' && figure) {
      out.pop = figure.pop;
      if (figure.year) out.py = figure.year;
    }
  }
  // A piece with no area would still carry its figure.
  if (figure && out.pop == null) {
    out.pop = figure.pop;
    if (figure.year) out.py = figure.year;
  }
  return out;
}

/* ------------------------------------------------------------------ country by country */

const indexFile = path.join(DATA, 'index.json');
const indexText = fs.readFileSync(indexFile, 'utf8');
const index = JSON.parse(indexText);
const lines = [];
const tally = { countries: 0, with: 0, short: 0, off: 0, divisions: 0, figures: 0, files: 0 };

for (const country of index.countries) {
  const file = path.join(DATA, 'r', `${country.id}.json`);
  delete country.rp;
  if (!fs.existsSync(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const topo = JSON.parse(text);
  const fine = topo.objects?.f?.geometries ?? [];
  /** What is asked about: a piece that is drawn and never asked (a military base) needs no figure. */
  const asked = fine.filter((g) => g.properties?.q !== 0);

  const figures = new Map();
  const why = new Map();
  const missing = [];
  // A map of one piece is its country, whose figure the game already has.
  if (fine.length > 1) {
    tally.countries++;
    tally.divisions += asked.length;
    for (const g of fine) {
      const figure = figureOf(String(g.id), g.properties?.ar);
      if (figure.pop) figures.set(String(g.id), figure);
      else why.set(String(g.id), figure.why);
    }
    for (const [id, inside] of Object.entries(NESTED)) {
      if (!figures.has(id)) continue;
      const rest = figures.get(id).pop - inside.reduce((sum, part) => sum + (figures.get(part)?.pop ?? NaN), 0);
      if (rest > 0) {
        figures.set(id, { ...figures.get(id), pop: rest });
      } else {
        figures.delete(id);
        why.set(id, 'cuenta lo de otras divisiones, que no tienen cifra');
      }
    }
    for (const g of asked) if (!figures.has(String(g.id))) missing.push(`${g.id} ${g.properties?.n?.es ?? ''} (${why.get(String(g.id))})`);
  }

  let verdict = '';
  let use = false;
  if (fine.length > 1) {
    const years = [...figures.values()].map((f) => f.year).filter(Boolean);
    // Figures with no date are set against the country as the maps have it.
    const year = years.length ? median(years) : (country.py ?? null);
    const sum = [...figures.values()].reduce((s, f) => s + f.pop, 0);
    const whole = year ? national(country, year) : null;
    const ratio = whole ? sum / whole : null;
    if (missing.length) {
      tally.short++;
      verdict = `faltan ${missing.length} de ${asked.length}: ${missing.slice(0, 4).join('; ')}${missing.length > 4 ? '…' : ''}`;
    } else if (ratio == null || Math.abs(sum - whole) > TOLERANCE * whole) {
      tally.off++;
      verdict = whole ? `no cuadra: sus divisiones suman ${nf(sum)} y el país tenía ${nf(whole)} en ${year} (${ratio.toFixed(2)})` : 'no hay con qué comparar: no se sabe cuánta gente tenía el país';
    } else {
      use = true;
      tally.with++;
      tally.figures += asked.length;
      country.rp = year;
      verdict = `sí: suman ${nf(sum)} de ${nf(whole)} en ${year} (${ratio.toFixed(2)})${years.length ? `, cifras de ${Math.min(...years)} a ${Math.max(...years)}` : ', cifras sin fecha'}`;
    }
    lines.push(`${country.id} ${(country.n?.es ?? '').padEnd(34)} ${String(asked.length).padStart(4)} ${verdict}`);
  }

  for (const [level, object] of Object.entries(topo.objects ?? {})) {
    for (const g of object.geometries ?? []) {
      const members = level !== 'f' && Array.isArray(g.properties?.m) ? g.properties.m : null;
      let figure = null;
      if (use && members) {
        const parts = members.map((id) => figures.get(String(id)));
        if (parts.length && parts.every(Boolean)) {
          // The sum is as old as the oldest of what it adds up.
          const dated = parts.every((f) => f.year);
          figure = { pop: parts.reduce((s, f) => s + f.pop, 0), year: dated ? Math.min(...parts.map((f) => f.year)) : null };
        }
      } else if (use) {
        figure = figures.get(String(g.id)) ?? null;
      }
      if (g.properties) g.properties = withFigure(g.properties, figure);
    }
  }
  const next = JSON.stringify(topo);
  if (next !== text) {
    fs.writeFileSync(file, next);
    tally.files++;
  }
}

const nextIndex = JSON.stringify(index);
if (nextIndex !== indexText) fs.writeFileSync(indexFile, nextIndex);

const summary = `Población de las divisiones: ${tally.with} de ${tally.countries} países (${tally.figures} de ${tally.divisions} divisiones); a ${tally.short} les faltan cifras y en ${tally.off} no cuadran con la del país. Archivos cambiados: ${tally.files}${nextIndex !== indexText ? ' y el índice' : ''}.`;
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${summary}\n\n${lines.join('\n')}\n`);
console.log(summary);
console.log(`El detalle, país por país, está en ${path.relative(ROOT, REPORT).startsWith('..') ? REPORT : path.relative(ROOT, REPORT)}.`);
