// Writes down the figures The World Factbook gives of each country: how long people live there, what each
// of them makes in a year, how old they are, how many live in towns, how many children a woman has, how
// long the coast is and how high the highest point stands.
//
//   npm run data:figures
//   npm run data:figures -- --data dir --src dir --report file
//
// It runs after `data:build`, which says what countries the game has, and reads the pages that `data:fetch`
// brings: scripts/data/factbook-pages.mjs says which page is of which country.
//
// The book is written to be read by people: "83 years (2024 est.)", "Mount McKinley 6,190 m (highest point
// in North America)". Each figure is read with a pattern that says how it is written, and what is written
// any other way gives no figure: better not to ask about a country than to ask with a number read wrong.
// The same goes for a figure that is out of what such a figure can be, and for one that is not of the
// country alone ("58.9 km (for entire island)"). What was left out, and why, goes in the report.
//
// What it writes is public/data/figures.json, a file of its own that the game fetches only when a game is
// about one of these figures:
//
//   · `c`: by country, the figures read of it, each under the name the game has for it. Only the ones that
//     are more than nothing: a country without a coast has no coast to be asked about. And under `y`, the
//     year of each of its figures that is not of the year most countries have theirs of;
//   · `y`: that year, for each figure that is of a year.
//
// The countries are the ones the games of figures are played with: those that have people (two islands
// where nobody lives are left out, as they are of those games).
//
// The report is .cache/figures.txt.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PAGES } from './factbook-pages.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const value = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const DATA = path.resolve(ROOT, value('data') ?? 'public/data');
const SRC = path.resolve(ROOT, value('src') ?? '.cache/src');
const REPORT = path.resolve(ROOT, value('report') ?? '.cache/figures.txt');

/** The internet code a page says its country has, where it is not the code the game knows the country by. */
const NET_CODE = { GB: 'uk' };

const read = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
/** "1,952.7" */
const number = (text) => Number(text.replace(/,/g, ''));
/** A text of the book without its marks: the pages are kept as the web shows them. */
const plain = (text) =>
  text
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

/** What a page keeps under some headings, whatever blanks the headings have around them. */
function under(page, headings) {
  let node = page;
  for (const h of headings) {
    if (node == null || typeof node !== 'object') return undefined;
    const key = Object.keys(node).find((k) => k.trim() === h);
    node = key == null ? undefined : node[key];
  }
  return node;
}

/** The text under some headings; nothing when the page does not have it or says it is not known ("NA"). */
function textOf(page, headings) {
  const node = under(page, headings);
  const text = typeof node === 'string' ? node : typeof node?.text === 'string' ? node.text : null;
  if (text == null) return null;
  const said = plain(text);
  return said === '' || said === 'NA' ? null : said;
}

const figure = (n, year) => ({ value: n, ...(year ? { year: Number(year) } : {}) });
const unread = (why) => ({ why });

/** A figure of a year: "83 years (2024 est.)", read with a pattern that takes the number and then the year. */
const dated = (headings, pattern) => (page) => {
  const text = textOf(page, headings);
  if (text == null) return null;
  const m = pattern.exec(text);
  return m ? figure(number(m[1]), m[2]) : unread(`"${text}"`);
};

/** The dollars nearly every page counts in: what a dollar bought in that year, wherever it is spent. */
const DOLLARS = 2021;

/**
 * What each person makes in a year: the page gives the last years, each under a heading of its own, and a
 * note says what dollars they are counted in. A few pages count in others ("data in 2015 dollars", "data are
 * in current dollars") or do not say, and theirs cannot be set against the rest.
 */
function income(page) {
  const node = under(page, ['Economy', 'Real GDP per capita']);
  if (node == null || typeof node !== 'object') return null;
  const note = textOf(node, ['note']) ?? '';
  if (!new RegExp(`^note: data in ${DOLLARS} dollars\\b`).test(note)) return unread(note ? `"${note}": not in the dollars of the rest` : 'it does not say in what dollars');
  const years = Object.keys(node)
    .map((k) => /^Real GDP per capita (\d{4})$/.exec(k.trim())?.[1])
    .filter(Boolean)
    .sort();
  const last = years[years.length - 1];
  if (!last) return null;
  const text = textOf(node, [`Real GDP per capita ${last}`]);
  if (text == null) return null;
  const m = /^\$([\d,]+) \((\d{4}) est\.\)$/.exec(text);
  if (!m) return unread(`"${text}"`);
  return m[2] === last ? figure(number(m[1]), last) : unread(`"${text}" under the heading of ${last}`);
}

/**
 * How long the coast is: "4,964 km", "0 km (landlocked)", "2,234 km (mainland on Red Sea 1,151 km; islands
 * in Red Sea 1,083 km)". What comes in brackets may say that the figure is of something else: "58.9 km (for
 * entire island)", of an island two countries share.
 */
function coast(page) {
  const text = textOf(page, ['Geography', 'Coastline']);
  if (text == null) return null;
  const m = /^([\d,.]+) km(?: \((.*)\))?$/.exec(text);
  if (!m) return unread(`"${text}"`);
  const aside = m[2];
  if (aside && !/^(doubly )?landlocked$/.test(aside) && !/^excludes /.test(aside) && !/\d km\b/.test(aside)) return unread(`"${text}": not of the country alone`);
  return figure(number(m[1]));
}

/**
 * How high the highest point stands: the height closes what is said of it, whatever is said in brackets and
 * before any note ("Aoraki/Mount Cook 3,724 m; note - the mountain's height was 3,764 m until…"). A few
 * pages forget the unit ("Mont Blanc 4,810"): a number at the end is a height where no other is given.
 */
function highest(page) {
  const text = textOf(page, ['Geography', 'Elevation', 'highest point']);
  if (text == null) return null;
  const head = text
    .replace(/\([^()]*\)/g, ' ')
    .replace(/note\s*[-:].*$/, '')
    .split(';')[0]
    .replace(/\s+/g, ' ')
    .trim();
  const m = /(?:^| )(\d[\d,]*) m$/.exec(head) ?? (/\d m\b/.test(head) ? null : /(?:^| )(\d[\d,]*)$/.exec(head));
  return m ? figure(number(m[1])) : unread(`"${text}"`);
}

/**
 * The figures, by the name the game has for each. `range`: what such a figure can be; one out of it was
 * read wrong or written wrong. `join`: what the figure of a country is when the book has it in two pages
 * (Palestine: the Gaza Strip and the West Bank): the one both pages give, their sum, or the larger.
 */
const FIGURES = {
  life: { read: dated(['People and Society', 'Life expectancy at birth', 'total population'], /^([\d.]+) years \((\d{4}) est\.\)$/), range: [40, 95], join: 'same' },
  gdp: { read: income, range: [300, 250_000], join: 'same' },
  age: { read: dated(['People and Society', 'Median age', 'total'], /^([\d.]+) years \((\d{4}) est\.\)$/), range: [10, 65], join: 'same' },
  urban: { read: dated(['People and Society', 'Urbanization', 'urban population'], /^([\d.]+)% of total population \((\d{4})\)$/), range: [0, 100], join: 'same' },
  fert: { read: dated(['People and Society', 'Total fertility rate'], /^([\d.]+) children born\/woman \((\d{4}) est\.\)$/), range: [0.5, 9], join: 'same' },
  coast: { read: coast, range: [0, 250_000], join: 'sum' },
  high: { read: highest, range: [1, 8_849], join: 'max' },
};

/**
 * What a page says apart from its headline figure, read by hand. Each is given with the words of the page
 * it comes from: if a later edition of the book no longer has them, the run stops and it is read again.
 *
 * France is drawn without its five overseas departments, which are countries of their own in the game, and
 * the page counts their coast in France's: that of "metropolitan France" is in a note. The highest point of
 * the page of the Netherlands is on Saba, which is drawn with the Caribbean Netherlands: the note names the
 * highest of the Netherlands in Europe. And the coast of Malta is given without that of Gozo.
 */
const BY_HAND = {
  FR: { coast: { value: 3427, where: ['Geography', 'Coastline', 'note'], says: 'metropolitan France: 3,427 km' } },
  NL: { high: { value: 322, where: ['Geography', 'Elevation', 'note'], says: 'the highest point on continental Netherlands is Vaalserberg at 322 m' } },
  MT: { coast: { value: 252.8, where: ['Geography', 'Coastline'], says: '196.8 km (excludes 56 km for the island of Gozo)' } },
};

/** Is this the page of that country? By the internet code it says the country has, or by its name where the list gives one. */
function isOf(page, iso, name) {
  if (name) return textOf(page, ['Government', 'Country name', 'conventional short form']) === name;
  const code = `.${NET_CODE[iso] ?? iso.toLowerCase()}`;
  return (textOf(page, ['Communications', 'Internet country code']) ?? '').split(/[\s;,]+/).includes(code);
}

/** One figure of a country from what each of its pages gives. */
function joined(id, parts) {
  const { range, join } = FIGURES[id];
  const bad = parts.find((p) => p?.why);
  if (bad) return bad;
  if (parts.some((p) => p == null)) return parts.length > 1 && parts.some((p) => p != null) ? unread('one of its pages does not give it') : null;
  for (const p of parts) if (!(p.value >= range[0] && p.value <= range[1])) return unread(`${p.value}: out of what it can be`);
  if (parts.length === 1) return parts[0];
  if (join === 'sum') return figure(parts.reduce((n, p) => n + p.value, 0));
  if (join === 'max') return figure(Math.max(...parts.map((p) => p.value)));
  const [first] = parts;
  return parts.every((p) => p.value === first.value && p.year === first.year) ? first : unread(`its pages differ: ${parts.map((p) => p.value).join(' and ')}`);
}

const index = read(path.join(DATA, 'index.json'));
const ids = Object.keys(FIGURES);
/** The countries the games of figures are played with (`eligible` in src/lib/world.ts): the ones with people. */
const asked = index.countries.filter((c) => c.cl !== 'other' && c.pop > 0);

const found = new Map();
const notes = [];
const pageless = [];
for (const c of asked) {
  const pages = PAGES[c.id];
  if (!pages) {
    pageless.push(c.id);
    continue;
  }
  const docs = pages.map(([file, , name]) => {
    const local = path.join(SRC, 'factbook', path.basename(file));
    if (!fs.existsSync(local)) throw new Error(`Falta la página de ${c.id} (${file}): ejecuta antes «npm run data:fetch»`);
    const page = read(local);
    if (!isOf(page, c.id, name)) throw new Error(`${file} no es la página de ${c.id}: revisa scripts/data/factbook-pages.mjs`);
    return page;
  });
  const figs = {};
  for (const id of ids) {
    const hand = BY_HAND[c.id]?.[id];
    let got;
    if (hand) {
      const said = textOf(docs[0], hand.where) ?? '';
      if (!said.includes(hand.says)) throw new Error(`La página de ${c.id} ya no dice «${hand.says}»: hay que volver a leerla (BY_HAND en scripts/data/figures.mjs)`);
      got = joined(id, [figure(hand.value)]);
      notes.push(`${c.id} ${id}: ${hand.value}, by hand, from "${hand.says}"`);
    } else {
      got = joined(
        id,
        docs.map((d) => FIGURES[id].read(d)),
      );
    }
    if (got?.why) notes.push(`${c.id} ${id}: not read · ${got.why}`);
    else if (got && got.value > 0) figs[id] = got;
  }
  found.set(c.id, figs);
}

/** The year most countries have a figure of; the earlier one when two years tie. */
const usual = {};
for (const id of ids) {
  const count = new Map();
  for (const figs of found.values()) if (figs[id]?.year) count.set(figs[id].year, (count.get(figs[id].year) ?? 0) + 1);
  const [top] = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  if (top) usual[id] = top[0];
}

/** What the game is given: the countries in the order the index has them, the figures in the order above. */
const out = { y: usual, c: {} };
for (const c of asked) {
  const figs = found.get(c.id);
  const have = ids.filter((id) => figs?.[id]);
  if (!have.length) continue;
  const years = have.filter((id) => figs[id].year && figs[id].year !== usual[id]).map((id) => [id, figs[id].year]);
  out.c[c.id] = { ...Object.fromEntries(have.map((id) => [id, figs[id].value])), ...(years.length ? { y: Object.fromEntries(years) } : {}) };
}

const file = path.join(DATA, 'figures.json');
const text = JSON.stringify(out);
if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== text) fs.writeFileSync(file, text);

const lines = ids.map((id) => {
  const have = asked.filter((c) => out.c[c.id]?.[id] != null);
  const others = new Map();
  for (const c of have) {
    const year = out.c[c.id].y?.[id];
    if (year) others.set(year, [...(others.get(year) ?? []), c.id]);
  }
  const odd = [...others.entries()].sort((a, b) => a[0] - b[0]).map(([y, list]) => `${y}: ${list.join(' ')}`);
  const values = have.map((c) => out.c[c.id][id]);
  const span = values.length ? `from ${Math.min(...values)} to ${Math.max(...values)}` : 'none';
  return `${id}: ${have.length} of ${asked.length} countries, ${span}${usual[id] ? `, of ${usual[id]}` : ''}${odd.length ? ` (${odd.join('; ')})` : ''}`;
});
const summary = `Figures of The World Factbook: ${asked.filter((c) => out.c[c.id]).length} of ${asked.length} countries have some · figures.json ${(text.length / 1024).toFixed(1)} kB`;
fs.mkdirSync(path.dirname(REPORT), { recursive: true });
fs.writeFileSync(REPORT, `${summary}\n\n${lines.join('\n')}\n\nWithout a page: ${pageless.join(' ') || 'none'}\n\n${notes.join('\n')}\n`);
console.log(summary);
for (const l of lines) console.log(`  ${l}`);
console.log(`  ${notes.length} notes in ${path.relative(ROOT, REPORT)}`);
