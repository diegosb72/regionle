// Which flags look alike: for each flag of the section «Banderas», the ones most like it among those it is
// played with, and the ones that cannot be told from it at all. It is what the games of the section set
// beside a flag when the question is meant to be hard («Casi iguales»), and what keeps two pictures that
// are the same from being offered as two answers.
//
//   npm run data:flag-alike                     from public/data and the flags of docs/flags/commons
//   npm run data:flag-alike -- --report file    and leave in a file what was found, by name, to be looked at
//
// What it reads: the list of flags (public/data/flags.json, which scripts/data/flags.mjs writes), the list
// of countries (public/data/index.json) and the pictures themselves: those of the countries from
// flag-icons, the rest from docs/flags/commons. Run it after `npm run data:flags`, whenever that one
// changes a flag: a test (src/lib/flagAlike.test.ts) says so when the two are out of step.
//
// What it writes: public/data/alike/<kind>.json, one file for each kind of flag, so that a game fetches
// only what its flags need:
//
//   countries.json   the flags of the States among themselves, those of each continent, and those of the
//                    territories
//   regions.json     those of the divisions, each among those of its country and, where the map of a
//                    country has flags at more than one level, among those of its level
//   cities.json      those of the capitals among themselves, and those of the cities of each country
//   others.json      the countries that are no more, the organisations, the peoples and the signals of the sea
//   same.json        the pictures that are the same as another, whatever their kind: what every game reads,
//                    while the files above are only for the games that ask about flags that look alike
//   past.json        for each flag that a country flew before, the countries whose flag of today is most
//                    like it, and the other countries that flew it too: what «Antes y ahora» sets beside
//                    the country that is asked, and what it never does
//   lands.json       for each flag of a division, the other countries that fly it, or one as good as it, as
//                    their own flag or as that of one of their divisions: what «¿De qué país es?» never
//                    sets beside the country that is asked
//
// Each group is one of the sets of flags a game is played with (src/lib/flagSets.ts): the neighbours of a
// flag are looked for among the flags it will be set beside, and nowhere else. A flag is in several groups
// (Spain's Aragon, among the regions of Spain and among its communities) and has other neighbours in each.
//
// How two flags are compared: each is drawn small, four by three whatever its shape, and turned into a
// grid of sixteen by twelve colours (in CIELAB, where the distance between two colours is about how
// different they look) and into how much of it is of each of ten colours with a name. Two flags are alike
// when their grids are (`drawn`), when they are once one of them is seen in a mirror (`flipped`: Ireland
// and Ivory Coast), or when they are made of the same colours in the same amounts (`palette`: Russia and
// Slovenia less the shield); the score is the least of the three, each with its handicap. It is a rough
// measure and it is meant to be: it finds the flags a person would mix up at a glance, and nothing is
// lost when it is wrong, since a flag that is not that much like another only makes a question easier.
//
// Two pictures are the same when no cell of their grids differs to speak of: a territory drawn with the
// flag of its country, a city that flies that of its province. Those are never neighbours of each other:
// they are listed apart (`same`), and the game never sets them side by side.

import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** The grid a flag is compared as: so many cells across and down. */
export const GRID = { w: 16, h: 12 };
/** Each cell is the mean of so many dots across and down. */
const DOTS = 4;
/** How many neighbours are kept of each flag: a question shows three, and some are lost to a name that is said twice. */
export const KEEP = 6;
/**
 * …and of the flag of a country, whose groups are few and are the ones most played. Among the territories
 * some neighbours are flags that are never asked (those of a territory drawn with the flag of its
 * country): there have to be enough left.
 */
export const KEEP_COUNTRIES = 12;
/** The fewest flags a level of a map has to have to be a group of its own: what a game needs (FLAG_SET_MIN in src/lib/flagSets.ts). */
export const LEVEL_MIN = 4;
/** What a State is here: a member of the United Nations, an observer, or one that is recognised in part. */
const STATES = ['un', 'obs', 'partial'];
/** A neighbour further than this is none: the two have nothing to be mixed up by. */
export const FAR = 60;
/**
 * Two pictures are the same when their grids are this close: on the whole (`mean`) and in the cell where
 * they differ most (`peak`). The same drawing saved twice, or drawn by two hands from the same model, is
 * well within; two blue flags that differ in the seal at their centre are not, because of that one cell.
 */
export const SAME = { mean: 3, peak: 14 };
/** How many countries are kept beside each flag of another time: a question shows three, and some are not in the set that is played. */
export const KEEP_PAST = 8;
/**
 * A flag of another time that is this close, on the whole, to one that another country flies or flew is as
 * good as that one: the red, white and black of the Arab republics with two stars or with three, the blue
 * ensign with the badge of one colony or of the next. That country is never set beside it as a wrong
 * answer: nobody could be told they were wrong to choose it.
 */
export const ALSO = 3;
/**
 * Two flags of which no cell differs by more than this are one design in two shades: the white and red of
 * Thuringia and that of Poland, the blue and yellow of Lower Austria and that of Ukraine. To the eye that
 * meets one of them alone they are the same flag.
 */
export const SHADE = 30;

const lin = (c) => {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const curve = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
/** A colour of the screen in CIELAB. */
export function lab(r, g, b) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const x = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047;
  const y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
  const z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  return [116 * curve(y) - 16, 500 * (curve(x) - curve(y)), 200 * (curve(y) - curve(z))];
}

/** The colours a person would name in a flag. */
const NAMED = [
  [255, 255, 255],
  [0, 0, 0],
  [206, 17, 38],
  [255, 130, 0],
  [252, 209, 22],
  [0, 122, 61],
  [108, 172, 228],
  [0, 40, 140],
  [122, 20, 50],
  [120, 72, 30],
].map((c) => lab(...c));

/** How wide and how high a flag is drawn to be compared. */
export const DRAWN = { w: GRID.w * DOTS, h: GRID.h * DOTS };

/**
 * What a flag looks like, from its dots (red, green and blue of each, `DRAWN.w` across and `DRAWN.h` down):
 * the colour of each cell of its grid, and how much of it is of each named colour.
 */
export function lookOf(data) {
  const { w, h } = GRID;
  const px = new Float32Array(w * h * 3);
  const pal = new Float32Array(NAMED.length);
  const each = 1 / (DOTS * DOTS);
  const dots = DRAWN.w * DRAWN.h;
  for (let y = 0; y < DRAWN.h; y++) {
    for (let x = 0; x < DRAWN.w; x++) {
      const i = (y * DRAWN.w + x) * 3;
      const c = lab(data[i], data[i + 1], data[i + 2]);
      let best = 0;
      let least = Infinity;
      for (let k = 0; k < NAMED.length; k++) {
        const d = (c[0] - NAMED[k][0]) ** 2 + (c[1] - NAMED[k][1]) ** 2 + (c[2] - NAMED[k][2]) ** 2;
        if (d < least) {
          least = d;
          best = k;
        }
      }
      pal[best] += 1 / dots;
      const j = (Math.floor(y / DOTS) * w + Math.floor(x / DOTS)) * 3;
      px[j] += c[0] * each;
      px[j + 1] += c[1] * each;
      px[j + 2] += c[2] * each;
    }
  }
  return { px, pal };
}

/** How far apart two grids are, cell by cell: on the whole and where they differ most. `fx` and `fy` see the second in a mirror. */
function cells(a, b, fx = false, fy = false) {
  const { w, h } = GRID;
  let sum = 0;
  let peak = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      const j = ((fy ? h - 1 - y : y) * w + (fx ? w - 1 - x : x)) * 3;
      const d = Math.hypot(a[i] - b[j], a[i + 1] - b[j + 1], a[i + 2] - b[j + 2]);
      sum += d;
      if (d > peak) peak = d;
    }
  }
  return { mean: sum / (w * h), peak };
}

/**
 * How far apart two flags look. `drawn`, as they are; `peak`, where they differ most; `flipped`, the
 * closest they get with one of them in a mirror; `palette`, how much of one is of a colour that the other
 * has less of (0 to 1); and `score`, the one figure the rest add up to: the lower, the more alike.
 */
export function apartLooks(a, b) {
  const as = cells(a.px, b.px);
  const flipped = Math.min(cells(a.px, b.px, true, false).mean, cells(a.px, b.px, false, true).mean, cells(a.px, b.px, true, true).mean);
  let palette = 0;
  for (let k = 0; k < a.pal.length; k++) palette += Math.abs(a.pal[k] - b.pal[k]);
  palette /= 2;
  // As drawn counts in full; in a mirror, a little less; the same colours in another order, less still.
  const score = Math.min(as.mean, flipped + 4, 10 + 60 * palette + 0.25 * as.mean);
  return { drawn: as.mean, peak: as.peak, flipped, palette, score };
}

/**
 * Whether two flags are within `max` of each other on the whole, as they are drawn: what
 * `apartLooks(a, b).drawn <= max` says, given up as soon as the sum is past what it may come to. Thousands
 * of flags are set against thousands with it, and nearly every pair is told apart by its first cells.
 */
export function within(a, b, max) {
  const cellsIn = GRID.w * GRID.h;
  // A hair more than the sum may come to: what is this near the line is settled by the division, as it is there.
  const most = max * cellsIn * 1.000001;
  let sum = 0;
  for (let i = 0; i < cellsIn * 3; i += 3) {
    sum += Math.hypot(a.px[i] - b.px[i], a.px[i + 1] - b.px[i + 1], a.px[i + 2] - b.px[i + 2]);
    if (sum > most) return false;
  }
  return sum / cellsIn <= max;
}

/** Whether two flags are one design in two shades: no cell of theirs differs by more than `SHADE`. */
export function shades(a, b) {
  for (let i = 0; i < GRID.w * GRID.h * 3; i += 3) if (Math.hypot(a.px[i] - b.px[i], a.px[i + 1] - b.px[i + 1], a.px[i + 2] - b.px[i + 2]) > SHADE) return false;
  return true;
}

/** Whether two looks are those of the same picture. */
export const sameLook = (a, b) => {
  const { mean, peak } = cells(a.px, b.px);
  return mean <= SAME.mean && peak <= SAME.peak;
};

/**
 * The flags of a group, each with the others that are most like it. `pics` are their names, each once;
 * `looks`, what each looks like. What comes out: the names in the same order, the groups of those that are
 * the same picture (by their place in the list) and, for each, its nearest neighbours as pairs of place and
 * score, the nearest first and no more than `keep` of them. Those that are the same picture as an earlier
 * one have no neighbours of their own: theirs are those of that one.
 */
export function alikeIn(pics, looks, keep = KEEP) {
  const n = pics.length;
  const look = pics.map((name) => looks.get(name));
  // The first of each group of pictures that are the same stands for the rest.
  const head = pics.map((_, i) => i);
  for (let i = 0; i < n; i++) {
    if (head[i] !== i) continue;
    for (let j = i + 1; j < n; j++) if (head[j] === j && sameLook(look[i], look[j])) head[j] = i;
  }
  const same = [];
  for (let i = 0; i < n; i++) {
    if (head[i] !== i) continue;
    const twins = [];
    for (let j = i + 1; j < n; j++) if (head[j] === i) twins.push(j);
    if (twins.length) same.push([i, ...twins]);
  }
  const heads = head.filter((h, i) => h === i);
  const score = new Map();
  for (let a = 0; a < heads.length; a++) {
    for (let b = a + 1; b < heads.length; b++) {
      const s = apartLooks(look[heads[a]], look[heads[b]]).score;
      if (s <= FAR) {
        (score.get(heads[a]) ?? score.set(heads[a], []).get(heads[a])).push([heads[b], s]);
        (score.get(heads[b]) ?? score.set(heads[b], []).get(heads[b])).push([heads[a], s]);
      }
    }
  }
  const near = pics.map((_, i) =>
    head[i] !== i
      ? []
      : (score.get(i) ?? [])
          .sort((x, y) => x[1] - y[1] || x[0] - y[0])
          .slice(0, keep)
          .flatMap(([j, s]) => [j, Math.round(s)]),
  );
  return { pics, same, near };
}

/**
 * The groups the flags are compared in, by kind: each a list of pictures, once each and in the order of
 * the data. A country is named by its id (its flag comes with the game); every other flag, by its file.
 *
 * They are the sets a game is played with (src/lib/flagSets.ts, `alikePlace` says which group is whose):
 *
 *   countries   `states`, a continent (`EU`) and `territories`
 *   regions     a country (`ES`) and, where its map has flags enough at more than one level, each level (`ES-1`)
 *   cities      `capitals`, and a country (`ES`): its capital and its other cities
 *   others      `gone`, `organisations`, `peoples` and `signals` (those of the sea: the ones that are played)
 */
export function groupsOf(index, flags) {
  const once = (names) => [...new Set(names)];
  const capitals = flags.capitals ?? [];
  const cities = flags.cities ?? {};
  const townsOf = (country) => once([...capitals.filter((row) => row[1] === country).map((row) => row[4]), ...(cities[country] ?? []).map((row) => row[3])]);
  const lands = once([...capitals.map((row) => row[1]), ...Object.keys(cities)]).sort();

  const drawn = index.countries.filter((c) => c.fl);
  const states = drawn.filter((c) => STATES.includes(c.cl));
  const countries = { states: states.map((c) => c.id) };
  for (const continent of Object.keys(index.continents ?? {})) {
    const there = states.filter((c) => c.ct === continent).map((c) => c.id);
    if (there.length) countries[continent] = there;
  }
  countries.territories = drawn.filter((c) => c.cl === 'dep').map((c) => c.id);

  const regions = {};
  for (const country of Object.keys(flags.regions).sort()) {
    const rows = flags.regions[country];
    regions[country] = once(rows.map((row) => row[4]));
    const levels = once(rows.map((row) => row[1]))
      .sort((a, b) => b - a)
      .map((level) => [level, once(rows.filter((row) => row[1] === level).map((row) => row[4]))])
      .filter(([, pics]) => pics.length >= LEVEL_MIN);
    // One level alone is the whole of the country, or all of it that can be played.
    if (levels.length > 1) for (const [level, pics] of levels) regions[`${country}-${level}`] = pics;
  }

  return {
    countries,
    regions,
    cities: { capitals: once(capitals.map((row) => row[4])), ...Object.fromEntries(lands.map((country) => [country, townsOf(country)])) },
    others: {
      gone: once((flags.gone ?? []).map((row) => row[3])),
      organisations: once((flags.organisations ?? []).map((row) => row[3])),
      peoples: once((flags.peoples ?? []).map((row) => row[3])),
      signals: once((flags.signals ?? []).filter((row) => row[1] === 'sea').map((row) => row[4])),
    },
  };
}

/**
 * The flags that are of no country, all together: the countries that are no more, the organisations, the
 * peoples and every signal. No game is played with them all, but «El intruso» sets a flag of one of these
 * kinds beside three of another: the pictures that are the same across them have to be known, so that the
 * one from outside is never the picture of one from inside.
 */
export function strayOf(flags) {
  return [...new Set([...(flags.gone ?? []).map((row) => row[3]), ...[...(flags.organisations ?? []), ...(flags.peoples ?? [])].map((row) => row[3]), ...(flags.signals ?? []).map((row) => row[4])])];
}

/** The picture to compare a flag by: the light one of a heavy drawing where there is one, which is the same flag. */
export function lightOf(flags) {
  const light = new Map();
  const add = (file, small) => small && light.set(file, small);
  for (const row of Object.values(flags.regions).flat()) add(row[4], row[6]);
  for (const row of flags.capitals ?? []) add(row[4], row[6]);
  for (const row of Object.values(flags.cities ?? {}).flat()) add(row[3], row[5]);
  for (const row of Object.values(flags.past ?? {}).flat()) add(row[0], row[4]);
  for (const row of flags.gone ?? []) add(row[3], row[7]);
  for (const row of [...(flags.organisations ?? []), ...(flags.peoples ?? [])]) add(row[3], row[5]);
  for (const row of flags.signals ?? []) add(row[4], row[6]);
  return light;
}

/**
 * The flags that the countries flew before, in the groups «Antes y ahora» is played in: those of the
 * States, those of the States of each continent and those of the territories, each as its country and its
 * file, in the order of the data. A flag is in every group its country is in.
 */
export function pastGroupsOf(index, flags) {
  const past = flags.past ?? {};
  const of = (list) => list.flatMap((c) => (past[c.id] ?? []).map((row) => [c.id, row[0]]));
  const drawn = index.countries.filter((c) => c.fl);
  const states = drawn.filter((c) => STATES.includes(c.cl));
  const groups = { states: of(states) };
  for (const continent of Object.keys(index.continents ?? {})) {
    const there = of(states.filter((c) => c.ct === continent));
    if (there.length) groups[continent] = there;
  }
  groups.territories = of(drawn.filter((c) => c.cl === 'dep'));
  return Object.fromEntries(Object.entries(groups).filter(([, list]) => list.length));
}

/** What a flag of another time goes by in the file: its country and its file, since two countries may have flown the same one. */
export const pastKey = (country, file) => `${country}:${file}`;

/**
 * The other countries that flew a flag, or one as good as it: those with a flag, of today or of before,
 * within `ALSO` of it. `flown` are the looks of every flag of each country, that of today first. (The same
 * is asked of the flags of the divisions, with what each country flies today: its own and those of its
 * divisions.)
 */
export function alsoFlew(country, look, flown, close = (a, b) => within(a, b, ALSO)) {
  const out = [];
  for (const [other, looks] of flown) {
    if (other === country) continue;
    if (looks.some((theirs) => close(look, theirs))) out.push(other);
  }
  return out;
}

/**
 * Whether a flag of a division is as good as another flag that is flown today: within `ALSO` of it on the
 * whole, or the same design in another shade. More is let through here than among the flags of other
 * times, where the year tells two of them apart: what is asked is the country, and a country that has
 * that flag, near enough, is no wrong answer.
 */
export const fliesToo = (a, b) => within(a, b, ALSO) || shades(a, b);

/**
 * The flags of the divisions of the States, as «¿De qué país es?» asks them (src/lib/flagLand.ts): each as
 * its country and its file, once, in the order of the data.
 */
export function landFlagsOf(index, flags) {
  return index.countries
    .filter((c) => c.fl && STATES.includes(c.cl))
    .flatMap((c) => [...new Set((flags.regions[c.id] ?? []).map((row) => row[4]))].map((file) => [c.id, file]));
}

/**
 * What tells one list of those flags from another, in a few letters: what is written of them says which
 * list it was written for, and a test says so when the flags have changed since.
 */
export const landMark = (list) => createHash('sha1').update(list.map(([country, file]) => pastKey(country, file)).join('\n')).digest('hex').slice(0, 10);

/**
 * The countries to set beside a flag of another time: those of `members` whose flag of today is most like
 * it, as pairs of country and score, the nearest first and no more than `keep`. Never its own country, and
 * never one of `also`, which flew it too. Nothing is too far to be kept: a question needs three, whatever they are.
 */
export function besidePast(country, look, members, today, also, keep = KEEP_PAST) {
  const barred = new Set([country, ...also]);
  return members
    .filter((id) => !barred.has(id) && today.has(id))
    .map((id, i) => ({ id, i, score: apartLooks(look, today.get(id)).score }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .slice(0, keep)
    .flatMap(({ id, score }) => [id, Math.round(score)]);
}

async function main() {
  const { default: sharp } = await import('sharp');
  const { drawn } = await import('./flag-image.mjs');
  const args = process.argv.slice(2);
  const value = (name) => {
    const i = args.indexOf(`--${name}`);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const DATA = path.resolve(ROOT, value('data') ?? 'public/data');
  const COMMONS = path.resolve(ROOT, value('flags') ?? 'docs/flags/commons');
  const ICONS = path.resolve(ROOT, 'node_modules/flag-icons/flags/4x3');
  const OUT = path.resolve(ROOT, value('out') ?? 'public/data/alike');
  const CACHE = path.resolve(ROOT, value('cache') ?? '.cache/flag-looks.json');
  const report = value('report');

  const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
  const flags = JSON.parse(fs.readFileSync(path.join(DATA, 'flags.json'), 'utf8'));
  const groups = groupsOf(index, flags);
  const light = lightOf(flags);
  const code = new Map(index.countries.filter((c) => c.fl).map((c) => [c.id, c.fl]));

  // What each picture looks like: kept from one run to the next under its name, which changes when the picture does.
  /** @type {Record<string, string>} */
  const kept = fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : {};
  const looks = new Map();
  const pack = (look) => Buffer.from(new Float32Array([...look.px, ...look.pal]).buffer).toString('base64');
  const unpack = (text) => {
    const all = new Float32Array(new Uint8Array(Buffer.from(text, 'base64')).buffer);
    return { px: all.slice(0, GRID.w * GRID.h * 3), pal: all.slice(GRID.w * GRID.h * 3) };
  };
  const dots = async (name) => {
    // A country: the flag that comes with the game. Anything else: its file, or the light picture of it.
    const file = code.has(name) ? path.join(ICONS, `${code.get(name)}.svg`) : path.join(COMMONS, light.get(name) ?? name);
    const key = code.has(name) ? `flag-icons:${code.get(name)}` : (light.get(name) ?? name);
    if (kept[key]) return unpack(kept[key]);
    const buf = fs.readFileSync(file);
    const data = file.endsWith('.svg')
      ? (await drawn(buf, DRAWN.w, DRAWN.h)).data
      : await sharp(buf, { limitInputPixels: false }).resize(DRAWN.w, DRAWN.h, { fit: 'fill' }).flatten({ background: '#fff' }).removeAlpha().raw().toBuffer();
    const look = lookOf(data);
    kept[key] = pack(look);
    return look;
  };
  const pastGroups = pastGroupsOf(index, flags);
  const pastFiles = Object.values(flags.past ?? {}).flatMap((rows) => rows.map((row) => row[0]));
  // Every flag of a country is looked at, whatever group it is in: one of another time is compared with them all.
  const stray = strayOf(flags);
  const names = [...new Set([...Object.values(groups).flatMap((kind) => Object.values(kind).flat()), ...index.countries.filter((c) => c.fl).map((c) => c.id), ...pastFiles, ...stray])];
  const started = Date.now();
  let done = 0;
  let next = 0;
  const failed = [];
  const worker = async () => {
    while (next < names.length) {
      const name = names[next++];
      try {
        looks.set(name, await dots(name));
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : err}`);
      }
      if (++done % 500 === 0) {
        console.log(`  ${done} de ${names.length} banderas miradas (${Math.round((Date.now() - started) / 1000)} s)`);
        fs.mkdirSync(path.dirname(CACHE), { recursive: true });
        fs.writeFileSync(CACHE, JSON.stringify(kept));
      }
    }
  };
  await Promise.all([...Array(4)].map(worker));
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(kept));
  if (failed.length) {
    console.error(`No se han podido mirar ${failed.length} banderas:\n  ${failed.slice(0, 20).join('\n  ')}`);
    process.exit(1);
  }

  fs.mkdirSync(OUT, { recursive: true });
  const found = {};
  let twins = 0;
  let total = 0;
  /** The pictures that are the same as another, each under the first of them: a capital is in two groups, and is one picture. */
  const first = new Map();
  for (const [kind, lists] of Object.entries(groups)) {
    const out = { v: 1, groups: {} };
    for (const [id, pics] of Object.entries(lists)) {
      // A flag alone has nothing to be like.
      if (pics.length < 2) continue;
      const group = alikeIn(pics, looks, kind === 'countries' ? KEEP_COUNTRIES : KEEP);
      out.groups[id] = group;
      total += pics.length;
      twins += group.same.reduce((sum, list) => sum + list.length - 1, 0);
      // Those of the countries are not written apart: which country flies the flag of which is a list of the game (SAME_FLAG).
      if (kind !== 'countries') {
        for (const list of group.same) {
          const head = list.map((i) => first.get(pics[i])).find(Boolean) ?? pics[list[0]];
          for (const i of list) first.set(pics[i], head);
        }
      }
    }
    found[kind] = out;
    const text = JSON.stringify(out);
    fs.writeFileSync(path.join(OUT, `${kind}.json`), text);
    console.log(`  ${kind}.json: ${Object.keys(out.groups).length} grupos, ${(text.length / 1024).toFixed(1)} kB`);
  }
  // …and those that are the same across the kinds that are of no country, which no group above holds together.
  for (const list of alikeIn(stray, looks, 0).same) {
    const head = list.map((i) => first.get(stray[i])).find(Boolean) ?? stray[list[0]];
    for (const i of list) if (!first.has(stray[i])) first.set(stray[i], head);
  }
  const same = [...new Set(first.values())].sort().map((head) => [head, ...[...first.keys()].filter((pic) => pic !== head && first.get(pic) === head).sort()]);
  fs.writeFileSync(path.join(OUT, 'same.json'), JSON.stringify({ v: 1, same }));
  console.log(`  same.json: ${same.length} dibujos que son de más de una bandera`);
  console.log(`Banderas parecidas: ${total} banderas en sus grupos; ${twins} son el mismo dibujo que otra de su grupo.`);

  // The flags of other times: beside each, the countries whose flag of today is most like it.
  const today = new Map(index.countries.filter((c) => c.fl).map((c) => [c.id, looks.get(c.id)]));
  const flown = new Map([...today].map(([id, look]) => [id, [look, ...(flags.past?.[id] ?? []).map((row) => looks.get(row[0]))]]));
  const past = { v: 1, groups: {}, own: {}, also: {} };
  const alsoOf = new Map();
  for (const [country, rows] of Object.entries(flags.past ?? {})) {
    if (!today.has(country)) continue;
    for (const row of rows) {
      const key = pastKey(country, row[0]);
      const also = alsoFlew(country, looks.get(row[0]), flown);
      alsoOf.set(key, also);
      if (also.length) past.also[key] = also;
      past.own[key] = Math.round(apartLooks(looks.get(row[0]), today.get(country)).score);
    }
  }
  for (const [id, list] of Object.entries(pastGroups)) {
    const members = id === 'territories' ? groups.countries.territories : (groups.countries[id] ?? []);
    past.groups[id] = Object.fromEntries(list.map(([country, file]) => [pastKey(country, file), besidePast(country, looks.get(file), members, today, alsoOf.get(pastKey(country, file)) ?? [])]));
  }
  const pastText = JSON.stringify(past);
  fs.writeFileSync(path.join(OUT, 'past.json'), pastText);
  console.log(`  past.json: ${Object.keys(past.own).length} banderas de otros tiempos en ${Object.keys(past.groups).length} grupos; ${Object.keys(past.also).length} las tuvo también otro país; ${(pastText.length / 1024).toFixed(1)} kB`);

  // The flags of the divisions, asked by their country: the other States that fly each, or one as good as
  // it, as their own flag or as that of one of their divisions. Nobody could be told they were wrong to
  // choose one of those, so they are never set beside the right one.
  const states = index.countries.filter((c) => c.fl && STATES.includes(c.cl)).map((c) => c.id);
  const flying = new Map(states.map((id) => [id, [today.get(id), ...[...new Set((flags.regions[id] ?? []).map((row) => row[4]))].map((file) => looks.get(file))]]));
  const landFlags = landFlagsOf(index, flags);
  const lands = { v: 1, n: landFlags.length, of: landMark(landFlags), also: {} };
  for (const [country, file] of landFlags) {
    const also = alsoFlew(country, looks.get(file), flying, fliesToo);
    if (also.length) lands.also[pastKey(country, file)] = also;
  }
  const landsText = JSON.stringify(lands);
  fs.writeFileSync(path.join(OUT, 'lands.json'), landsText);
  console.log(`  lands.json: ${landFlags.length} banderas de divisiones de ${new Set(landFlags.map(([country]) => country)).size} países; ${Object.keys(lands.also).length} las tiene también otro país; ${(landsText.length / 1024).toFixed(1)} kB`);

  if (report) {
    // By name, for a person to look at: who is each picture, what is the same as what, and the neighbours of each.
    const title = new Map(index.countries.map((c) => [c.id, c.n.es]));
    const call = (file, es) => title.set(file, title.has(file) && title.get(file) !== es ? `${title.get(file)} = ${es}` : es);
    for (const row of Object.values(flags.regions).flat()) call(row[4], row[2]);
    for (const row of flags.capitals ?? []) call(row[4], row[2]);
    for (const row of Object.values(flags.cities ?? {}).flat()) call(row[3], row[1]);
    for (const row of flags.gone ?? []) call(row[3], row[1]);
    for (const row of [...(flags.organisations ?? []), ...(flags.peoples ?? [])]) call(row[3], row[1]);
    for (const row of flags.signals ?? []) call(row[4], row[2]);
    const said = {};
    for (const [kind, out] of Object.entries(found)) {
      said[kind] = {};
      for (const [id, group] of Object.entries(out.groups)) {
        const name = (i) => title.get(group.pics[i]) ?? group.pics[i];
        said[kind][id] = {
          same: group.same.map((list) => list.map(name)),
          near: Object.fromEntries(group.pics.map((_, i) => [`${name(i)} [${group.pics[i]}]`, group.near[i].reduce((all, v, k) => (k % 2 ? all : [...all, `${name(v)} ${group.near[i][k + 1]}`]), [])])),
        };
      }
    }
    const land = (id) => index.countries.find((c) => c.id === id)?.n.es ?? id;
    const years = new Map(Object.entries(flags.past ?? {}).flatMap(([country, rows]) => rows.map((row) => [pastKey(country, row[0]), `${row[2] || '?'}–${row[3] || '?'}`])));
    const told = (key) => `${land(key.split(':')[0])} ${years.get(key)} [${key.split(':')[1]}]`;
    said.past = {
      also: Object.fromEntries(Object.entries(past.also).map(([key, ids]) => [told(key), ids.map(land)])),
      groups: Object.fromEntries(
        Object.entries(past.groups).map(([id, list]) => [id, Object.fromEntries(Object.entries(list).map(([key, near]) => [`${told(key)} · ${past.own[key]} de la de hoy`, near.reduce((all, v, k) => (k % 2 ? all : [...all, `${land(v)} ${near[k + 1]}`]), [])]))]),
      ),
    };
    said.lands = { also: Object.fromEntries(Object.entries(lands.also).map(([key, ids]) => [`${land(key.split(':')[0])} · ${title.get(key.split(':')[1]) ?? '?'} [${key.split(':')[1]}]`, ids.map(land)])) };
    fs.writeFileSync(path.resolve(ROOT, report), JSON.stringify(said, null, 1));
    console.log(`  Lo encontrado, por nombre, en ${report}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
