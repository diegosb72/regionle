/**
 * The hints a question can be given besides the one each game always had (a letter, the search narrowed,
 * the map shown, the name written): what the game knows of the piece, said a fact at a time. The player
 * chooses which; any of them makes the answer one given with help.
 *
 * They are told in the third person: the same facts a piece gives about itself in "¿Quién soy?"
 * (lib/riddle.ts), from which the wording of sizes and places is taken.
 */
import { courseDeg, pointName, pointOf, saidDist } from './bearings';
import { distanceKm } from './geo';
import { L, nm } from './i18n';
import type { Places } from './sets';
import { joiner, letterCount, listed, nf, norm } from './text';
import type { Deck, Item, LL } from './types';

/**
 * count: how many letters the answer has · size: its place by size on the map · where: the side of the
 * map it lies on · part: what it is part of · near: what it borders, or the nearest thing · capital: its
 * capital · flag: its flag · half: two of the four options, gone · name: what it is called.
 */
export type HintKind = 'count' | 'size' | 'where' | 'part' | 'near' | 'capital' | 'flag' | 'half' | 'name';

/** From the one that says least to the one that says most: the order of the menu. */
export const HINT_KINDS: readonly HintKind[] = ['count', 'size', 'where', 'part', 'near', 'capital', 'flag', 'half', 'name'];

/** How the question in hand is asked: all a hint needs to know to say something and not the answer. */
export interface HintAsk {
  /** What is asked for: the piece on the map, its name, its capital, what it belongs to, or one thing said of it (lib/facts.ts). */
  wants: 'place' | 'name' | 'capital' | 'parent' | 'fact';
  /** How it is answered: typed, among four options, or with a click on the map. */
  by: 'type' | 'pick' | 'click';
  /** What the question shows of the piece. */
  shows: { name: boolean; place: boolean; capital: boolean; flag: boolean };
}

/** A hint as it is shown: a sentence, and the flag it speaks of when it is one. */
export interface Hint {
  kind: HintKind;
  text: string;
  flag?: string;
}

export function hintLabel(kind: HintKind): string {
  switch (kind) {
    case 'count':
      return L('Cuántas letras', 'How many letters');
    case 'size':
      return L('Su tamaño', 'Its size');
    case 'where':
      return L('Dónde cae', 'Where it lies');
    case 'part':
      return L('A qué pertenece', 'What it is part of');
    case 'near':
      return L('Qué tiene cerca', 'What is near it');
    case 'capital':
      return L('Su capital', 'Its capital');
    case 'flag':
      return L('Su bandera', 'Its flag');
    case 'half':
      return L('Quitar dos opciones', 'Remove two options');
    default:
      return L('Su nombre', 'Its name');
  }
}

/** Does one name say the other? "Comunidad de Madrid" says Madrid, and "Comunidad Valenciana" all but says Valencia. */
export function givesAway(a: string, b: string): boolean {
  const x = norm(a);
  const y = norm(b);
  if (x.length < 4 || y.length < 4) return false;
  if (x.includes(y) || y.includes(x)) return true;
  // A word that begins another: "valenciana" and "valencia".
  const words = (s: string) => s.split(' ').filter((w) => w.length >= 5);
  return words(x).some((p) => words(y).some((q) => p.startsWith(q) || q.startsWith(p)));
}

/** Does the name of a part of the world say a country in it? A long word of the one inside the other: "africa" in "Sudáfrica". */
export function saysCountry(part: string, country: string): boolean {
  const whole = norm(country);
  return givesAway(part, country) || norm(part).split(' ').some((w) => w.length >= 6 && whole.includes(w));
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
  return L(`${fem ? 'la' : 'el'} ${ordinal(rank, fem)}`, `the ${ordinal(rank, fem)}`);
}

/** Whether an answer is a number: a dialling code, whose blanks are digits and not letters. */
export const isDigits = (answer: string): boolean => /^[+\d\s]*\d[+\d\s]*$/.test(answer);

/** As many letters as blanks the game writes for the answer (text.ts), and the words they come in. */
function countHint(answer: string): Hint {
  const n = letterCount(answer);
  const words = answer.split(/[\s-]+/).filter((w) => letterCount(w) > 0).length;
  // A dialling code has digits, said in groups: "+1 809".
  if (isDigits(answer)) return { kind: 'count', text: L(`Tiene ${nf(n)} ${n === 1 ? 'cifra' : 'cifras'}${words > 1 ? `, en ${nf(words)} grupos` : ''}.`, `It has ${nf(n)} ${n === 1 ? 'digit' : 'digits'}${words > 1 ? `, in ${nf(words)} groups` : ''}.`) };
  return {
    kind: 'count',
    text: L(`Tiene ${nf(n)} ${n === 1 ? 'letra' : 'letras'}${words > 1 ? `, en ${nf(words)} palabras` : ''}.`, `It has ${nf(n)} ${n === 1 ? 'letter' : 'letters'}${words > 1 ? `, in ${nf(words)} words` : ''}.`),
  };
}

/** By size among the surfaces of the map, or by people among its cities. Nothing for a river or a peak. */
function sizeHint(item: Item, deck: Deck): Hint | null {
  const fem = deck.noun.fem;
  if (item.kind === 'city') {
    const list = deck.items.filter((it) => (it.pop ?? 0) > 0).sort((a, b) => (b.pop ?? 0) - (a.pop ?? 0));
    const rank = list.findIndex((it) => it.id === item.id) + 1;
    if (!rank || list.length < 3) return null;
    const place = placeIn(rank, list.length, true, ['más poblada', 'largest'], ['menos poblada', 'smallest']);
    return { kind: 'size', text: L(`Por habitantes es ${place} de las ${nf(list.length)} del mapa.`, `By population it is ${place} of the ${nf(list.length)} on the map.`) };
  }
  if ((item.kind !== 'unit' && item.kind !== 'country') || item.shape !== 'area') return null;
  const list = deck.items.filter((it) => it.shape === 'area' && it.area > 0).sort((a, b) => b.area - a.area);
  const rank = list.findIndex((it) => it.id === item.id) + 1;
  if (!rank || list.length < 3) return null;
  const place = placeIn(rank, list.length, fem, ['mayor', 'largest'], ['menor', 'smallest']);
  return { kind: 'size', text: L(`Por tamaño es ${place} de ${fem ? 'las' : 'los'} ${nf(list.length)} del mapa.`, `By size it is ${place} of the ${nf(list.length)} on the map.`) };
}

/**
 * Where on the map: towards one of its sides, or about its middle. The middle is that of its pieces, not
 * of its frame. Nothing on a map that goes round the world, where "the east" says little.
 */
function whereHint(item: Item, deck: Deck): Hint | null {
  const lons = deck.items.map((it) => it.lp[0]);
  if (deck.items.length < 4 || Math.max(...lons) - Math.min(...lons) > 180) return null;
  const centre: LL = [lons.reduce((a, b) => a + b, 0) / lons.length, deck.items.reduce((a, it) => a + it.lp[1], 0) / deck.items.length];
  const spread = deck.items.reduce((a, it) => a + distanceKm(centre, it.lp), 0) / deck.items.length;
  if (!(spread > 0)) return null;
  // A piece named after where it lies ("Norte", "Centro", "North West", "Eastern") would be told its own name.
  const named = norm(item.name).split(' ');
  if (distanceKm(centre, item.lp) < spread * 0.4) {
    if (named.some((w) => /^(centr|center|middle|medi[oa]$)/.test(w))) return null;
    return { kind: 'where', text: L('Está por el centro del mapa.', 'It is about the middle of the map.') };
  }
  const p = pointOf(courseDeg(centre, item.lp));
  // "Sureste" says "Este" as well: a point between two is made of both.
  const made = p % 2 ? [p === 1 || p === 7 ? 0 : 4, p === 1 || p === 3 ? 2 : 6] : [];
  const said = [p, ...made].flatMap((q) => norm(pointName(q as typeof p)).split(' '));
  if (named.some((w) => said.some((q) => w === q || (q.length >= 4 && w.startsWith(q))))) return null;
  const point = pointName(p);
  return { kind: 'where', text: L(`Está hacia el ${point} del mapa.`, `It is towards the ${point} of the map.`) };
}

/**
 * What it is part of: the group of a province, the country of a region or a city on a map of several, the
 * part of the world of a country. Nothing where that would be the answer by another name, or where the
 * whole map is in it.
 */
function partHint(item: Item, deck: Deck, places?: Places): Hint | null {
  const c = item.country;
  if (item.kind === 'country') {
    if (!places) return null;
    const parts = new Set(deck.items.map((it) => it.country.sr));
    // "Australia y Nueva Zelanda" says too much of either, "Micronesia" all of Micronesia and "África Central"
    // nearly all of the República Centroafricana: of those, the continent, which is the least that can be said.
    const part = parts.size > 1 ? places.subregions[c.sr] : undefined;
    const sub = part && !saysCountry(nm(part), item.name) ? part : undefined;
    const name = sub ?? (new Set(deck.items.map((it) => it.country.ct)).size > 1 ? places.continents[c.ct] : undefined);
    if (!name) return null;
    // "El Caribe", "el Sudeste Asiático"; "the Caribbean", "the Americas".
    const el = !!sub && (c.sr === 'AM-K' || c.sr === 'AS-SE');
    const the = sub ? c.sr === 'AM-K' : c.ct === 'AM';
    return { kind: 'part', text: L(`Está en ${el ? 'el ' : ''}${nm(name)}.`, `It is in ${the ? 'the ' : ''}${nm(name)}.`) };
  }
  if (item.kind === 'feature') return null;
  const group = item.belongs && item.belongs.id !== c.id ? item.belongs.name : item.parent;
  const mates = group ? deck.items.filter((it) => (it.belongs && it.belongs.id !== it.country.id ? it.belongs.name : it.parent) === group).length : 0;
  if (group && mates > 1 && mates < deck.items.length && !givesAway(group, item.name)) return { kind: 'part', text: L(`Pertenece a ${group}.`, `It is part of ${group}.`) };
  if (deck.countries.length > 1 && !givesAway(nm(c.n), item.name)) return { kind: 'part', text: L(`Está en ${nm(c.n)}.`, `It is in ${nm(c.n)}.`) };
  return null;
}

/** "y", or "e" before a name that begins with the sound of an i: «Francia e Italia», but «Chile y Hielo». */
const and = (next: string): string => joiner('y', next);

/** Most neighbours that are named: more would be a list to read, not a hint. */
export const NEAR_MAX = 3;

/**
 * What it has near: the pieces that border it, the first few by name (those that lie nearest, always the
 * same ones), or that it borders none; for a city or a peak, which have no borders, the nearest thing on
 * the map and how far it is.
 */
function nearHint(item: Item, deck: Deck): Hint | null {
  if (item.shape === 'area' && (item.kind === 'unit' || item.kind === 'country')) {
    const all = item.nb.map((id) => deck.byId.get(id)).filter((it): it is Item => !!it);
    const fem = deck.noun.fem;
    if (!all.length) {
      return {
        kind: 'near',
        text: L(`No limita por tierra con ${fem ? 'ninguna otra' : 'ningún otro'} del mapa.`, `It shares a land border with no other on the map.`),
      };
    }
    // A city and the province around it may go by one name ("Kiev" borders "Kiev"): told so, it would rule out
    // the answer. The namesake is counted and not named; where it is the only neighbour there is no hint.
    const own = norm(item.name);
    const others = all.filter((it) => norm(it.name) !== own).sort((a, b) => distanceKm(item.lp, a.lp) - distanceKm(item.lp, b.lp) || a.id.localeCompare(b.id));
    if (!others.length) return null;
    // One more is named rather than counted: "y 1 más" takes the room of a name and says less.
    const named = others.slice(0, others.length === all.length && all.length === NEAR_MAX + 1 ? NEAR_MAX + 1 : NEAR_MAX).map((it) => it.name);
    const rest = all.length - named.length;
    if (rest > 0) return { kind: 'near', text: L(`Limita con ${named.join(', ')} y ${nf(rest)} más.`, `It borders ${named.join(', ')} and ${nf(rest)} more.`) };
    return { kind: 'near', text: L(`Limita con ${listed(named, and(named[named.length - 1]))}.`, `It borders ${listed(named, 'and')}.`) };
  }
  if (item.shape !== 'point') return null;
  let best: Item | null = null;
  let km = Infinity;
  for (const it of deck.items) {
    if (it.id === item.id || it.shape !== 'point') continue;
    const d = distanceKm(item.lp, it.lp);
    if (d < km) [best, km] = [it, d];
  }
  if (!best) return null;
  const point = pointName(pointOf(courseDeg(best.lp, item.lp)));
  return { kind: 'near', text: L(`Está a unos ${saidDist(km)} al ${point} de ${best.name}.`, `It is about ${saidDist(km)} ${point} of ${best.name}.`) };
}

/** Its capital, unless the name of one is in the name of the other: that would be the answer. */
function capitalHint(item: Item): Hint | null {
  const cap = item.capital?.[0];
  if (!cap || givesAway(cap, item.name)) return null;
  return { kind: 'capital', text: L(`Su capital es ${cap}.`, `Its capital is ${cap}.`) };
}

/**
 * The kinds of hint a question admits, in the order of the menu. `half` and `count` are about how it is
 * answered; the rest are facts, and only those that are not what the question already shows, nor what it
 * asks for.
 */
export function hintKinds(item: Item, deck: Deck, ask: HintAsk, places?: Places): HintKind[] {
  const out: HintKind[] = [];
  if (ask.by === 'type') out.push('count');
  if (ask.by === 'pick') out.push('half');
  // What a piece belongs to, or its capital, is asked of a piece in full sight: there is nothing to add about it.
  if (ask.wants === 'place' || ask.wants === 'name') {
    if (sizeHint(item, deck)) out.push('size');
    if (!ask.shows.place && whereHint(item, deck)) out.push('where');
    if (partHint(item, deck, places)) out.push('part');
    if (nearHint(item, deck)) out.push('near');
    if (!ask.shows.capital && capitalHint(item)) out.push('capital');
    // A flag says nothing of where a country is, to whoever has its name: it is a hint to a name.
    if (!ask.shows.flag && ask.wants === 'name' && item.kind === 'country' && item.country.fl) out.push('flag');
    if (ask.wants === 'place' && !ask.shows.name) out.push('name');
  }
  return HINT_KINDS.filter((k) => out.includes(k));
}

/**
 * One hint about the piece asked: what it says. `answer` is what the question asks for, for the hint that
 * counts its letters. Null for `half`, which says nothing: it takes two options away.
 */
export function hintOf(kind: HintKind, item: Item, deck: Deck, answer: string, places?: Places): Hint | null {
  switch (kind) {
    case 'count':
      return countHint(answer);
    case 'size':
      return sizeHint(item, deck);
    case 'where':
      return whereHint(item, deck);
    case 'part':
      return partHint(item, deck, places);
    case 'near':
      return nearHint(item, deck);
    case 'capital':
      return capitalHint(item);
    case 'flag':
      return item.country.fl ? { kind: 'flag', text: L('Esta es su bandera:', 'This is its flag:'), flag: item.country.fl } : null;
    case 'name':
      return { kind: 'name', text: L(`Se llama ${item.name}.`, `It is called ${item.name}.`) };
    default:
      return null;
  }
}

/**
 * The two wrong options that go: by lot, and never the right one. With fewer than four options there is
 * nothing to take away.
 */
export function halve(options: readonly string[], right: string, rand: () => number): string[] {
  const wrong = options.filter((id) => id !== right);
  if (wrong.length < 3) return [];
  const keep = wrong[Math.floor(rand() * wrong.length)];
  return wrong.filter((id) => id !== keep);
}
