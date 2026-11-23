/**
 * "¿Quién soy?": a piece of the map speaks about itself, one clue at a time, from what could be many of
 * them to what could hardly be another. The clues are made of what the game already knows of each piece.
 */
import { courseDeg, pointName, pointOf, saidDist } from './bearings';
import { distanceKm } from './geo';
import { L, capName, nm } from './i18n';
import type { Places } from './sets';
import { fmtArea, fmtPop, nf, norm, type Rng } from './text';
import type { Deck, Item, LL, Res } from './types';

export type Clue =
  /** A sentence; `show` is a piece the clue names, which the map lights up. */
  | { id: string; kind: 'text'; text: string; show?: string }
  /** A sentence and the flag it speaks of. */
  | { id: 'flag'; kind: 'flag'; text: string; code: string }
  /** A sentence and the outline of the piece itself. */
  | { id: 'shape'; kind: 'shape'; text: string };

/** A riddle solved with this many clues or fewer, and no wrong name, is right; with more, right with help. */
export const CLUES_OK = 3;
/** What the first clue is worth: one point less with each clue, and never less than one. */
export const RIDDLE_POINTS = 6;

/** Points for a riddle solved with `used` clues in sight. */
export const riddlePoints = (used: number): number => Math.max(1, RIDDLE_POINTS - Math.max(1, used) + 1);

/** How a riddle went: solved or not, with how many clues in sight and whether a wrong name was given. */
export function judgeRiddle(solved: boolean, used: number, wrong: number): Res {
  if (!solved) return 'bad';
  return used <= CLUES_OK && wrong === 0 ? 'ok' : 'warn';
}

/** "3.ª" · "3.º" · "3rd" */
function ordinal(n: number, fem: boolean): string {
  const en = n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return L(`${nf(n)}.${fem ? 'ª' : 'º'}`, `${nf(n)}${en}`);
}

/** Its place in a list sorted from the largest: "la mayor", "la 3.ª", "la menor". */
function placeIn(rank: number, total: number, fem: boolean, most: [string, string], least: [string, string]): string {
  if (rank === 1) return L(`${fem ? 'la' : 'el'} ${most[0]}`, `the ${most[1]}`);
  if (rank === total) return L(`${fem ? 'la' : 'el'} ${least[0]}`, `the ${least[1]}`);
  return L(`${fem ? 'la' : 'el'} ${ordinal(rank, fem)}`, ordinal(rank, fem));
}

/** Does one name say the other? "Comunidad de Madrid" says Madrid, and "Comunidad Valenciana" all but says Valencia. */
function givesAway(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  return x.length >= 4 && y.length >= 4 && (x.includes(y) || y.includes(x));
}

/** Letters of a name, without spaces, hyphens or dots. */
const letters = (name: string): string[] => [...name].filter((ch) => /\p{L}/u.test(ch));

function initialClue(item: Item): Clue {
  const ls = letters(item.name);
  const words = item.name.split(/[\s-]+/).filter((w) => /\p{L}/u.test(w)).length;
  const first = (ls[0] ?? '').toUpperCase();
  return {
    id: 'initial',
    kind: 'text',
    text: L(
      `Mi nombre empieza por «${first}» y tiene ${nf(ls.length)} letras${words > 1 ? `, en ${nf(words)} palabras` : ''}.`,
      `My name starts with “${first}” and has ${nf(ls.length)} letters${words > 1 ? `, in ${nf(words)} words` : ''}.`,
    ),
  };
}

/**
 * Where on the map: towards one of its sides, or about its middle. The middle is that of its pieces, not
 * of its frame: a few islands far away stretch the frame and move nothing else. Nothing on a map that
 * goes round the world.
 */
function whereClue(item: Item, deck: Deck): Clue | null {
  const lons = deck.items.map((it) => it.lp[0]);
  if (Math.max(...lons) - Math.min(...lons) > 180 || deck.items.length < 4) return null;
  const centre: LL = [lons.reduce((a, b) => a + b, 0) / lons.length, deck.items.reduce((a, it) => a + it.lp[1], 0) / deck.items.length];
  const spread = deck.items.reduce((a, it) => a + distanceKm(centre, it.lp), 0) / deck.items.length;
  if (!(spread > 0)) return null;
  if (distanceKm(centre, item.lp) < spread * 0.4) return { id: 'where', kind: 'text', text: L('Estoy por el centro del mapa.', 'I am about the middle of the map.') };
  const point = pointName(pointOf(courseDeg(centre, item.lp)));
  return { id: 'where', kind: 'text', text: L(`Estoy hacia el ${point} del mapa.`, `I am towards the ${point} of the map.`) };
}

/** One of the pieces that border it, by lot: the map lights it up. */
function neighbourClue(item: Item, deck: Deck, rand: Rng): Clue | null {
  const pool = item.nb.filter((id) => deck.byId.has(id)).sort();
  if (!pool.length) return null;
  const other = deck.byId.get(pool[Math.floor(rand() * pool.length)])!;
  const fem = deck.noun.fem;
  return { id: 'neighbour', kind: 'text', text: L(`${fem ? 'Una de mis vecinas' : 'Uno de mis vecinos'} es ${other.name}.`, `One of my neighbours is ${other.name}.`), show: other.id };
}

/** "Estoy en Europa del Sur": the part of the world, with the article the few names that need one take. */
function partClue(item: Item, deck: Deck, places?: Places): Clue | null {
  if (!places) return null;
  const c = item.country;
  const parts = new Set(deck.items.map((it) => it.country.sr));
  // Where the whole map is one part of the world, the part says nothing; "Australia y Nueva Zelanda" says too much.
  const sub = parts.size > 1 && c.sr !== 'OC-A' ? places.subregions[c.sr] : undefined;
  const name = sub ?? (new Set(deck.items.map((it) => it.country.ct)).size > 1 ? places.continents[c.ct] : undefined);
  if (!name) return null;
  // "El Caribe", "el Sudeste Asiático"; "the Caribbean", "the Americas".
  const el = !!sub && (c.sr === 'AM-K' || c.sr === 'AS-SE');
  const the = sub ? c.sr === 'AM-K' : c.ct === 'AM';
  return { id: 'part', kind: 'text', text: L(`Estoy en ${el ? 'el ' : ''}${nm(name)}.`, `I am in ${the ? 'the ' : ''}${nm(name)}.`) };
}

function countryClues(item: Item, deck: Deck, places: Places | undefined, rand: Rng): (Clue | null)[] {
  const c = item.country;
  const borders = c.nb?.length ?? 0;
  const size: Clue = {
    id: 'size',
    kind: 'text',
    text: c.pop ? L(`Tengo ${fmtPop(c.pop)} y mido ${fmtArea(c.ar)}.`, `I have ${fmtPop(c.pop)} and cover ${fmtArea(c.ar)}.`) : L(`Mido ${fmtArea(c.ar)}.`, `I cover ${fmtArea(c.ar)}.`),
  };
  const sea: Clue = {
    id: 'borders',
    kind: 'text',
    text: !borders
      ? L('No tengo fronteras por tierra: me rodea el mar.', 'I have no land borders: the sea is all around me.')
      : c.ll
        ? L(`No tengo salida al mar y limito con ${nf(borders)} ${borders === 1 ? 'país' : 'países'}.`, `I am landlocked and border ${nf(borders)} ${borders === 1 ? 'country' : 'countries'}.`)
        : L(`Tengo costa y limito con ${nf(borders)} ${borders === 1 ? 'país' : 'países'}.`, `I have a coast and border ${nf(borders)} ${borders === 1 ? 'country' : 'countries'}.`),
  };
  const cap = c.cap ? capName(c.cap) : '';
  const capital: Clue | null = cap && norm(cap) !== norm(item.name) ? { id: 'capital', kind: 'text', text: L(`Mi capital empieza por «${letters(cap)[0]?.toUpperCase()}».`, `My capital starts with “${letters(cap)[0]?.toUpperCase()}”.`) } : null;
  const flag: Clue | null = c.fl ? { id: 'flag', kind: 'flag', text: L('Esta es mi bandera.', 'This is my flag.'), code: c.fl } : null;
  const facts = factClues(item, deck);
  return [size, partClue(item, deck, places), sea, ...facts.wide, neighbourClue(item, deck, rand), capital, ...facts.narrow, flag, initialClue(item)];
}

/** A language or a currency that this many countries of the map have is a wide clue; one of fewer comes close to naming the country. */
export const FACT_WIDE = 5;

/**
 * What a country speaks and what it pays with, where that has come with the map (lib/facts.ts). Each goes
 * where it belongs between the widest clue and the narrowest: Spanish or the dollar, which many countries of
 * the map have, come before a neighbour is named; Danish or the yen, which are of one country or of a
 * handful, wait until the capital has been hinted at, just before the flag. Not the one its own name gives
 * away: "mi idioma oficial es el francés" would be the answer.
 */
function factClues(item: Item, deck: Deck): { wide: Clue[]; narrow: Clue[] } {
  const out = { wide: [] as Clue[], narrow: [] as Clue[] };
  const facts = deck.facts;
  if (!facts) return out;
  const map = deck.items.map((it) => it.id);
  for (const kind of ['language', 'currency'] as const) {
    const said = facts.asked(kind, [item.id]).length ? facts.said(kind, item.id) : '';
    if (!said) continue;
    const alone = facts.all(kind, item.id) === said;
    const text =
      kind === 'language'
        ? alone
          ? L(`Mi idioma oficial es el ${said}.`, `My official language is ${said}.`)
          : L(`Uno de mis idiomas oficiales es el ${said}.`, `One of my official languages is ${said}.`)
        : alone
          ? L(`Mi moneda se llama ${said}.`, `My currency is called the ${said}.`)
          : L(`Una de mis monedas se llama ${said}.`, `One of my currencies is called the ${said}.`);
    (facts.sharedBy(kind, item.id, map) >= FACT_WIDE ? out.wide : out.narrow).push({ id: kind, kind: 'text', text });
  }
  return out;
}

function regionClues(item: Item, deck: Deck, rand: Rng): (Clue | null)[] {
  const fem = deck.noun.fem;
  const many = deck.noun.many;
  const bySize = [...deck.items].filter((it) => it.shape === 'area').sort((a, b) => b.area - a.area);
  const rank = bySize.findIndex((it) => it.id === item.id) + 1;
  const size: Clue = {
    id: 'size',
    kind: 'text',
    text: L(
      `Mido ${fmtArea(item.area)}: por tamaño soy ${placeIn(rank, bySize.length, fem, ['mayor', 'largest'], ['menor', 'smallest'])} de ${fem ? 'las' : 'los'} ${nf(bySize.length)} de este mapa.`,
      `I cover ${fmtArea(item.area)}: by size I am ${placeIn(rank, bySize.length, fem, ['mayor', 'largest'], ['menor', 'smallest'])} of the ${nf(bySize.length)} on this map.`,
    ),
  };
  const n = item.nb.filter((id) => deck.byId.has(id)).length;
  const borders: Clue = {
    id: 'borders',
    kind: 'text',
    text: n
      ? L(`Limito por tierra con ${nf(n)} de ${fem ? 'las' : 'los'} ${many} de este mapa.`, `I share a land border with ${nf(n)} of the ${many} on this map.`)
      : L(`No limito por tierra con ${fem ? 'ninguna' : 'ninguno'} de ${fem ? 'las' : 'los'} ${many} de este mapa.`, `I share a land border with none of the ${many} on this map.`),
  };
  // What it is part of, unless that is itself by another name or by the same one.
  const group = item.belongs;
  const mates = group ? deck.items.filter((it) => it.belongs?.id === group.id).length : 0;
  const parent: Clue | null =
    group && mates > 1 && !givesAway(group.name, item.name)
      ? { id: 'parent', kind: 'text', text: L(`Mi ${group.type} es ${group.name}.`, `My ${group.type} is ${group.name}.`) }
      : deck.countries.length > 1
        ? { id: 'parent', kind: 'text', text: L(`Mi país es ${nm(item.country.n)}.`, `My country is ${nm(item.country.n)}.`) }
        : null;
  const shape: Clue | null = item.shape === 'area' ? { id: 'shape', kind: 'shape', text: L('Esta es mi silueta.', 'This is my outline.') } : null;
  return [size, whereClue(item, deck), borders, parent, neighbourClue(item, deck, rand), shape, initialClue(item)];
}

function cityClues(item: Item, deck: Deck): (Clue | null)[] {
  const byPop = [...deck.items].filter((it) => (it.pop ?? 0) > 0).sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0));
  const rank = byPop.findIndex((it) => it.id === item.id) + 1;
  const size: Clue | null =
    item.pop && rank
      ? {
          id: 'size',
          kind: 'text',
          text: L(
            `Tengo ${fmtPop(item.pop)} en mi área urbana: soy ${placeIn(rank, byPop.length, true, ['más poblada', 'largest'], ['menos poblada', 'smallest'])} de las ${nf(byPop.length)} de este mapa.`,
            `I have ${fmtPop(item.pop)} in my urban area: I am ${placeIn(rank, byPop.length, true, ['más poblada', 'largest'], ['menos poblada', 'smallest'])} of the ${nf(byPop.length)} on this map.`,
          ),
        }
      : null;
  const country: Clue | null = deck.countries.length > 1 ? { id: 'country', kind: 'text', text: L(`Mi país es ${nm(item.country.n)}.`, `My country is ${nm(item.country.n)}.`) } : null;
  // Whether it is a capital, where the map has both kinds.
  const kinds = new Set(deck.items.map((it) => it.cap ?? 0));
  const status: Clue | null =
    kinds.size > 1
      ? {
          id: 'status',
          kind: 'text',
          text:
            item.cap === 3
              ? L('Soy la capital de mi país.', 'I am the capital of my country.')
              : item.cap === 2
                ? L('Soy una de las capitales de mi país.', 'I am one of the capitals of my country.')
                : item.cap === 1
                  ? L('Soy capital de una región, no de mi país.', 'I am the capital of a region, not of my country.')
                  : L('No soy capital de mi país ni de una región.', 'I am the capital neither of my country nor of a region.'),
        }
      : null;
  const group = item.belongs && item.belongs.id !== item.country.id ? item.belongs : null;
  const region: Clue | null = group && !givesAway(group.name, item.name) ? { id: 'parent', kind: 'text', text: L(`Mi ${group.type} es ${group.name}.`, `My ${group.type} is ${group.name}.`) } : null;
  // How far and which way from the largest city of the map, or from the second one for the largest.
  const from = byPop.find((it) => it.id !== item.id);
  const near: Clue | null = from
    ? {
        id: 'near',
        kind: 'text',
        text: L(
          `Estoy a unos ${saidDist(distanceKm(from.lp, item.lp))} al ${pointName(pointOf(courseDeg(from.lp, item.lp)))} de ${from.name}.`,
          `I am about ${saidDist(distanceKm(from.lp, item.lp))} ${pointName(pointOf(courseDeg(from.lp, item.lp)))} of ${from.name}.`,
        ),
        show: from.id,
      }
    : null;
  return [size, country, whereClue(item, deck), status, region, near, initialClue(item)];
}

/**
 * The clues of a piece, from the widest to the narrowest. Rivers and ranges have none: the game knows
 * too little of them to tell one from another.
 */
export function cluesFor(item: Item, deck: Deck, places: Places | undefined, rand: Rng): Clue[] {
  const list = item.kind === 'country' ? countryClues(item, deck, places, rand) : item.kind === 'unit' ? regionClues(item, deck, rand) : item.kind === 'city' ? cityClues(item, deck) : [];
  return list.filter((c): c is Clue => !!c);
}
