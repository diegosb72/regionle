/**
 * Connections: sixteen of the countries chosen that go four by four, each four with something in common —
 * a part of the world, the sea, a neighbour, an organisation, a language, a size, a letter — that is not
 * said: finding it is the game. Made from what the game already knows of the countries and from the lists
 * kept in lib/groups.ts. Nothing is drawn here.
 *
 * A board has one answer: there is one way only of sharing its sixteen countries out among its four links,
 * four to each, and none of them is a country of which a link could be argued either way.
 */
import { ARAB_LEAGUE, BRICS, EU, EUROZONE, G20, MEDITERRANEAN, NATO, PORTUGUESE, SCHENGEN, SPANISH, USSR, YUGOSLAVIA } from './groups';
import { L, nm } from './i18n';
import { CONNECT_GROUPS, CONNECT_GROUP_SIZE, CONNECT_MIN } from './rules';
import { APART, CASPIAN, TWO_CONTINENTS, stateBorders, type StatementWorld } from './statements';
import { initialOf, shuffle, type Rng } from './text';
import type { Country, Named } from './types';

/** What a link is about: a board takes its four from four of these where it can. */
export type LinkKind = 'place' | 'sea' | 'org' | 'past' | 'tongue' | 'size' | 'nb' | 'lone' | 'initial';
export const LINK_KINDS: readonly LinkKind[] = ['place', 'sea', 'org', 'past', 'tongue', 'size', 'nb', 'lone', 'initial'];

/**
 * How likely each kind is, for each link it has to give (by the square root of how many: a hundred countries to
 * border are not a hundred times a sea): where a country lies and what it borders, more than a letter.
 */
const WEIGHT: Record<LinkKind, number> = { place: 1, sea: 1, org: 0.8, size: 0.6, nb: 0.5, past: 0.45, tongue: 0.45, initial: 0.25, lone: 0.25 };
/** A kind that is already on the board is this much less likely to give another link, and never a third. */
const AGAIN = 0.15;

/** Countries in a group, and groups on a board. */
export const GROUP_SIZE = CONNECT_GROUP_SIZE;
export const GROUPS = CONNECT_GROUPS;
/** Countries a board is made of: the fewest that can be chosen. */
export const CONNECT_TILES = CONNECT_MIN;
/** Wrong guesses a board allows: the fourth ends the game. */
export const CONNECT_MISSES = 4;
/**
 * Countries of a board that would also fit a group other than their own, at most: they are what makes a
 * board more than four lists, and too many of them make it a chore. Where the countries chosen are few and
 * much alike no board has so few, and more are let in: there is still one answer.
 */
export const CONNECT_SPARE = 3;
const SPARE_MORE = 6;
/** A link that holds more than this share of the countries chosen says little about any of them. */
const MOST = 2 / 3;

/** Figures a size is told by. A country within a quarter of one of them is on neither side. */
export const SMALL_KM2 = 1000;
export const LARGE_KM2 = 1_000_000;
export const MANY_PEOPLE = 100_000_000;
export const FEW_PEOPLE = 1_000_000;

export interface LinkWorld extends StatementWorld {
  subregions: Readonly<Record<string, Named>>;
}

/** Something countries can have in common. */
export interface Link {
  /** "sr:AF-W", "landlocked", "nb:BR", "eu", "initial:M". */
  id: string;
  kind: LinkKind;
  /** What the group is called once it is found: «África Occidental», «Limitan con Brasil». */
  title: string;
  /** The countries chosen it is true of, beyond argument. */
  members: ReadonlySet<string>;
  /** The countries chosen of which it can be argued either way: they are never on a board with this link. */
  doubt: ReadonlySet<string>;
}

export interface ConnGroup {
  link: Link;
  /** Its four countries. */
  ids: string[];
}

export interface ConnBoard {
  groups: ConnGroup[];
  /** The sixteen countries, in the order they are laid out. */
  tiles: string[];
  /** Everything the game knows that countries of the selection can share: what a wrong guess is read against. */
  links: Link[];
}

const borders = (c: Country): string[] => c.nb ?? [];
const touch = (a: Country, b: Country): boolean => borders(a).includes(b.id) || borders(b).includes(a.id);

/** Uses the euro without being of the euro area, by agreement or on its own. */
const EURO_USERS: readonly string[] = ['AD', 'MC', 'SM', 'VA', 'ME', 'XK'];
/** Has no border control with the Schengen area without having signed it. */
const OPEN_TO_SCHENGEN: readonly string[] = ['MC', 'SM', 'VA'];

/** Every link the countries of a list could be grouped by: the ones at least four of them share, and not nearly all. */
export function linksOf(list: readonly Country[], world: LinkWorld): Link[] {
  const out: Link[] = [];
  const most = Math.floor(list.length * MOST);
  const add = (id: string, kind: LinkKind, title: string, has: (c: Country) => boolean, doubt: (c: Country) => boolean = () => false): void => {
    const members = new Set<string>();
    const doubts = new Set<string>();
    for (const c of list) {
      if (doubt(c)) doubts.add(c.id);
      else if (has(c)) members.add(c.id);
    }
    if (members.size >= GROUP_SIZE && members.size <= most) out.push({ id, kind, title, members, doubt: doubts });
  };
  const listed = (id: string, kind: LinkKind, title: string, ids: readonly string[], doubt: readonly string[] = []): void =>
    add(
      id,
      kind,
      title,
      (c) => ids.includes(c.id),
      (c) => doubt.includes(c.id),
    );

  // Where it lies. Of a country on two continents either could be said: it is on no board that has one of these.
  const two = (c: Country): boolean => TWO_CONTINENTS.has(c.id);
  for (const [code, name] of Object.entries(world.continents)) add(`ct:${code}`, 'place', nm(name), (c) => c.ct === code, two);
  for (const [code, name] of Object.entries(world.subregions)) add(`sr:${code}`, 'place', nm(name), (c) => c.sr === code, two);

  // The sea. The shores of the Caspian are a coast to some and not to others.
  add(
    'landlocked',
    'sea',
    L('Sin salida al mar', 'Landlocked'),
    (c) => !!c.ll,
    (c) => CASPIAN.has(c.id),
  );
  // A border with a base or a colony is nobody's idea of a neighbour: a country that has only those is on neither side.
  add(
    'island',
    'sea',
    L('Sin fronteras terrestres', 'No land borders'),
    (c) => borders(c).length === 0,
    (c) => borders(c).length > 0 && stateBorders(c, world).length === 0,
  );
  listed('mediterranean', 'sea', L('Con costa en el Mediterráneo', 'With a coast on the Mediterranean'), MEDITERRANEAN, ['GI']);

  // What it belongs to. A guest of the G20, a country invited to the BRICS and the ones that use the euro or
  // keep no border with the Schengen area without being members are left out of those boards.
  listed('eu', 'org', L('Unión Europea', 'European Union'), EU);
  listed('nato', 'org', L('OTAN', 'NATO'), NATO);
  listed('schengen', 'org', L('Espacio Schengen', 'Schengen Area'), SCHENGEN, OPEN_TO_SCHENGEN);
  listed('euro', 'org', L('Eurozona', 'Euro area'), EUROZONE, EURO_USERS);
  listed('g20', 'org', 'G20', G20, ['ES']);
  listed('brics', 'org', 'BRICS', BRICS, ['SA']);
  listed('arab', 'org', L('Liga Árabe', 'Arab League'), ARAB_LEAGUE);
  listed('ussr', 'past', L('Antigua URSS', 'Former USSR'), USSR);
  listed('yugoslavia', 'past', L('Antigua Yugoslavia', 'Former Yugoslavia'), YUGOSLAVIA);
  listed('spanish', 'tongue', L('Con el español como lengua oficial', 'With Spanish as an official language'), SPANISH);
  listed('portuguese', 'tongue', L('Con el portugués como lengua oficial', 'With Portuguese as an official language'), PORTUGUESE, ['MO']);

  // How large. Clearly on one side of the figure, by a quarter: closer than that is a matter of which year.
  const near = (v: number, mark: number): boolean => v > mark / APART && v < mark * APART;
  const people = (c: Country): number => c.pop ?? 0;
  add(
    'small',
    'size',
    L(`Menos de ${SMALL_KM2} km²`, `Smaller than ${SMALL_KM2} km²`),
    (c) => c.ar > 0 && c.ar < SMALL_KM2,
    (c) => near(c.ar, SMALL_KM2),
  );
  add(
    'large',
    'size',
    L('Más de un millón de km²', 'Larger than a million km²'),
    (c) => c.ar > LARGE_KM2,
    (c) => near(c.ar, LARGE_KM2),
  );
  add(
    'crowd',
    'size',
    L('Más de 100 millones de habitantes', 'More than 100 million people'),
    (c) => people(c) > MANY_PEOPLE,
    (c) => near(people(c), MANY_PEOPLE),
  );
  add(
    'few',
    'size',
    L('Menos de un millón de habitantes', 'Fewer than a million people'),
    (c) => people(c) > 0 && people(c) < FEW_PEOPLE,
    (c) => near(people(c), FEW_PEOPLE),
  );

  // What it borders. The country itself is not there, nor one that only touches a territory of it (France and
  // Brazil, by the Guianas), or whose own territory does (the United Kingdom and Spain, by Gibraltar).
  const all = [...world.byId.values()];
  const lands = new Map<string, Country[]>();
  for (const t of all) if (t.sov) lands.set(t.sov, [...(lands.get(t.sov) ?? []), t]);
  for (const hub of all) {
    if (hub.cl !== 'un') continue;
    if (list.filter((c) => c.id !== hub.id && touch(c, hub)).length < GROUP_SIZE) continue;
    const mine = lands.get(hub.id) ?? [];
    add(
      `nb:${hub.id}`,
      'nb',
      L(`Limitan con ${nm(hub.n)}`, `They border ${nm(hub.n)}`),
      (c) => touch(c, hub),
      (c) => c.id === hub.id || (!touch(c, hub) && (mine.some((t) => touch(c, t)) || (lands.get(c.id) ?? []).some((t) => touch(t, hub)))),
    );
  }
  // One neighbour and no more, whether territories are counted or not.
  add(
    'lone',
    'lone',
    L('Limitan con un solo país', 'They border one country only'),
    (c) => borders(c).length === 1 && stateBorders(c, world).length === 1,
    (c) => borders(c).length !== stateBorders(c, world).length && (borders(c).length === 1 || stateBorders(c, world).length === 1),
  );

  // The letter its name begins with, in the language of the game.
  const letters = new Set(list.map((c) => initialOf(nm(c.n))).filter(Boolean));
  for (const letter of [...letters].sort()) add(`initial:${letter}`, 'initial', L(`Empiezan por ${letter}`, `They begin with ${letter}`), (c) => initialOf(nm(c.n)) === letter);

  return out;
}

/**
 * In how many ways some countries can be shared out among some links, as many to each as the size of a group
 * and each country to a link it is true of; it stops counting at `stop`. A board is one where it is one.
 */
export function waysToShare(ids: readonly string[], links: readonly Link[], stop = 2): number {
  const room = links.map(() => GROUP_SIZE);
  // The ones with the fewest places to go first: what cannot be done shows at once.
  const fits = ids.map((id) => links.map((link, k) => (link.members.has(id) ? k : -1)).filter((k) => k >= 0)).sort((a, b) => a.length - b.length);
  let ways = 0;
  const place = (i: number): void => {
    if (ways >= stop) return;
    if (i === fits.length) {
      ways++;
      return;
    }
    for (const k of fits[i]) {
      if (!room[k]) continue;
      room[k]--;
      place(i + 1);
      room[k]++;
    }
  };
  place(0);
  return ways;
}

/** One of a list by lot, each as likely as its weight. */
function weighted<T>(list: readonly T[], weight: (x: T) => number, rng: Rng): T {
  const total = list.reduce((sum, x) => sum + weight(x), 0);
  let at = rng() * total;
  for (const x of list) {
    at -= weight(x);
    if (at <= 0) return x;
  }
  return list[list.length - 1];
}

/** Four links for a board: of four kinds more often than not, of three at times, and no link twice. */
function fourLinks(links: readonly Link[], rng: Rng): Link[] | null {
  const byKind = new Map<LinkKind, Link[]>();
  for (const link of links) byKind.set(link.kind, [...(byKind.get(link.kind) ?? []), link]);
  const picked: Link[] = [];
  const kinds = [...byKind.keys()];
  const used = (kind: LinkKind): number => picked.filter((p) => p.kind === kind).length;
  while (picked.length < GROUPS) {
    const few = kinds.length < GROUPS;
    // No kind three times, unless the countries chosen leave no other way.
    const open = kinds.filter((kind) => byKind.get(kind)!.length > used(kind) && (few || used(kind) < 2));
    if (!open.length) return null;
    const kind = weighted(open, (k) => WEIGHT[k] * Math.sqrt(byKind.get(k)!.length) * AGAIN ** used(k), rng);
    const left = byKind.get(kind)!.filter((link) => !picked.includes(link));
    picked.push(left[Math.floor(rng() * left.length)]);
  }
  return picked;
}

/** Every way of taking four of some links, where they are few enough for that; a good many of them by lot where they are not. */
function everyFour(links: readonly Link[], rng: Rng): Link[][] {
  const n = links.length;
  const out: Link[][] = [];
  if ((n * (n - 1) * (n - 2) * (n - 3)) / 24 > EVERY) {
    for (let i = 0; i < EVERY; i++) out.push(shuffle(links, rng).slice(0, GROUPS));
    return out;
  }
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let c = b + 1; c < n; c++) for (let d = c + 1; d < n; d++) out.push([links[a], links[b], links[c], links[d]]);
  return shuffle(out, rng);
}

/** Tries at a board with four links drawn by lot, half of them for one with few countries that fit two groups. */
const TRIES = 600;
/** Fours of links that are gone through one by one when those tries have given nothing, and draws of countries for each. */
const EVERY = 2500;
const DRAWS = 6;

/**
 * A board for the countries chosen, or null where they give none: sixteen of them and the four links they
 * are shared out by. Among the countries of a link, the ones most people can place are a little more likely.
 */
export function makeBoard(list: readonly Country[], world: LinkWorld, rng: Rng = Math.random): ConnBoard | null {
  if (list.length < CONNECT_TILES) return null;
  const links = linksOf(list, world);
  if (links.length < GROUPS) return null;
  const byId = new Map(list.map((c) => [c.id, c]));
  const known = (id: string): number => Math.max(byId.get(id)?.pop ?? 0, 10_000) ** 0.2;

  /** Four countries for each of four links, or null where this draw gives no board with one answer and so few to spare. */
  const deal = (four: readonly Link[], spareMax: number): ConnBoard | null => {
    const out = new Set(four.flatMap((link) => [...link.doubt]));
    const taken = new Set<string>();
    const groups = new Map<Link, string[]>();
    // The link with the fewest countries chooses first: the others have more to choose from.
    for (const link of shuffle(four, rng).sort((a, b) => a.members.size - b.members.size)) {
      const free = [...link.members].filter((id) => !out.has(id) && !taken.has(id));
      if (free.length < GROUP_SIZE) return null;
      const ids: string[] = [];
      while (ids.length < GROUP_SIZE) {
        // One that fits another of the four is a quarter as likely: a board has a few of them, not many.
        const id = weighted(
          free.filter((x) => !ids.includes(x)),
          (x) => known(x) * (four.some((other) => other !== link && other.members.has(x)) ? 0.25 : 1),
          rng,
        );
        ids.push(id);
        taken.add(id);
      }
      groups.set(link, ids);
    }
    const ids = [...taken];
    const spare = ids.reduce((n, id) => n + four.filter((link) => link.members.has(id)).length - 1, 0);
    if (spare > spareMax || waysToShare(ids, four) !== 1) return null;
    return { groups: four.map((link) => ({ link, ids: groups.get(link)! })), tiles: shuffle(ids, rng), links };
  };

  // By lot, of four kinds where it can be: what nearly every selection gives at the first try or the second.
  for (let i = 0; i < TRIES; i++) {
    const four = fourLinks(links, rng);
    if (!four) break;
    const board = deal(four, i < TRIES / 2 ? CONNECT_SPARE : SPARE_MORE);
    if (board) return board;
  }
  // Few countries, or countries much alike, leave few links and fewer boards: every four of them, one by one.
  for (const four of everyFour(links, rng)) {
    for (let k = 0; k < DRAWS; k++) {
      const board = deal(four, SPARE_MORE);
      if (board) return board;
    }
  }
  return null;
}

/** What a guess of four is. */
export type Guess =
  /** One of the groups: which. */
  | { res: 'group'; index: number }
  /** Not a group, though the four do share something the game knows of: it is said, and it is no miss. */
  | { res: 'other'; title: string }
  /** Three of the four go together. */
  | { res: 'near' }
  | { res: 'no' };

export function judgeGuess(board: ConnBoard, picked: readonly string[]): Guess {
  const index = board.groups.findIndex((g) => g.ids.length === picked.length && g.ids.every((id) => picked.includes(id)));
  if (index >= 0) return { res: 'group', index };
  // What the four share that is none of the groups: the link that fewest countries have, which says the most.
  const theirs = new Set(board.groups.map((g) => g.link.id));
  const shared = board.links.filter((link) => !theirs.has(link.id) && picked.every((id) => link.members.has(id))).sort((a, b) => a.members.size - b.members.size || (a.id < b.id ? -1 : 1));
  if (picked.length === GROUP_SIZE && shared.length) return { res: 'other', title: shared[0].title };
  return board.groups.some((g) => g.ids.filter((id) => picked.includes(id)).length === GROUP_SIZE - 1) ? { res: 'near' } : { res: 'no' };
}

/** A board being played. */
export interface ConnGame {
  board: ConnBoard;
  /** The countries still on the table, in the order they lie. */
  tiles: string[];
  /** The groups found, in the order they were found: where each is on the board. */
  found: number[];
  /** How each group found was found: with no wrong guess since the one before and without being told, or not. */
  res: Record<number, 'ok' | 'warn'>;
  /** The groups whose link has been told, for the asking. */
  told: number[];
  /** Wrong guesses so far. */
  misses: number;
  /** There has been a wrong guess since the last group was found. */
  slipped: boolean;
  /** The wrong guesses, each as its four countries in order: the same four are a miss once. */
  tried: string[];
}

export const newGame = (board: ConnBoard): ConnGame => ({ board, tiles: [...board.tiles], found: [], res: {}, told: [], misses: 0, slipped: false, tried: [] });

/** Every group found, or no guesses left. */
export const gameOver = (game: ConnGame): boolean => game.found.length === game.board.groups.length || game.misses >= CONNECT_MISSES;

/** What was said of a guess: what it is, or that the same four had been tried before. */
export type Said = Guess | { res: 'again' };

/** A guess of four of the countries on the table: the game after it, and what it was. */
export function guessFour(game: ConnGame, picked: readonly string[]): { game: ConnGame; said: Said } {
  if (gameOver(game) || picked.length !== GROUP_SIZE || !picked.every((id) => game.tiles.includes(id))) return { game, said: { res: 'no' } };
  const said = judgeGuess(game.board, picked);
  if (said.res === 'group') {
    const told = game.told.includes(said.index);
    return {
      game: { ...game, tiles: game.tiles.filter((id) => !picked.includes(id)), found: [...game.found, said.index], res: { ...game.res, [said.index]: game.slipped || told ? 'warn' : 'ok' }, slipped: false },
      said,
    };
  }
  if (said.res === 'other') return { game, said };
  const key = [...picked].sort().join(' ');
  if (game.tried.includes(key)) return { game, said: { res: 'again' } };
  return { game: { ...game, misses: game.misses + 1, slipped: true, tried: [...game.tried, key] }, said };
}

/** Tells what one of the groups still to be found has in common: the game after it, and which group it was (-1 when none is left to tell). */
export function tellLink(game: ConnGame): { game: ConnGame; index: number } {
  const index = game.board.groups.findIndex((_, i) => !game.found.includes(i) && !game.told.includes(i));
  if (index < 0 || gameOver(game)) return { game, index: -1 };
  return { game: { ...game, told: [...game.told, index] }, index };
}

/**
 * How the game went, group by group: found first time, found after a wrong guess or a hint, or not found.
 * The groups left when the player ends the game early are not counted; the ones left when the guesses run
 * out are misses.
 */
export function gameTally(game: ConnGame): { ok: number; warn: number; bad: number } {
  const ok = game.found.filter((i) => game.res[i] === 'ok').length;
  const warn = game.found.length - ok;
  return { ok, warn, bad: game.misses >= CONNECT_MISSES ? game.board.groups.length - game.found.length : 0 };
}
