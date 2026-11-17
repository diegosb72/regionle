/**
 * Everything that can be typed in the game, as the settings list it: each thing with its id, its names and
 * the map it is played on, which is what decides whether a short form says one thing only.
 */
import { buildDeck, countryAnswers, countryItem, eligible, loadIndex } from './data';
import { PHYS_KINDS, buildCityDeck, buildPhysicalDeck, kindNoun, loadCapitals, loadCities, type PhysKind } from './extra';
import { L, getLang, levelNoun, nm } from './i18n';
import { Matcher, codeOf, key, shortFormsOf, type Answerable } from './text';
import { capKey, capitalAnswers, chipsOf, editOf, type Chip, type TypeinSettings } from './typeins';
import type { Country, Item } from './types';

export const TYPEIN_TABS = ['countries', 'regions', 'cities', 'capitals', 'physical'] as const;
export type TypeinTab = (typeof TYPEIN_TABS)[number];

/** Address of each list, after that of the settings: the words the sections go by. */
export const TAB_PATH: Record<TypeinTab, string> = { countries: 'paises', regions: 'regiones', cities: 'ciudades', capitals: 'capitales', physical: 'fisica' };

/** Address of the settings. What follows it names a list and, where lists go by country, the country. */
export const SETTINGS_PATH = 'configuracion';

/** Where the settings open on a list: for links from the rest of the game. */
export function settingsLink(tab: TypeinTab, scope = ''): string {
  return `#/${SETTINGS_PATH}/${TAB_PATH[tab]}${scope ? `/${scope}` : ''}`;
}

/**
 * The examples of initials given where a game offers typing: the id each is kept under and which one it is,
 * so that whoever gives the example can tell whether it still stands.
 */
export const SAMPLES = {
  regions: { id: 'US-NY', key: 'ny' },
  regionCapitals: { id: capKey('US-UT'), key: 'slc' },
  countries: { id: 'NZ', key: 'nz' },
  countryCapitals: { id: capKey('AR'), key: 'ba' },
  cities: { id: 'cj64n2v', key: 'ny' },
} as const;

/** Lists that are kept country by country. Capitals have one more: those of the countries themselves, under ''. */
export const SCOPED: readonly TypeinTab[] = ['regions', 'cities', 'capitals'];

export interface TypeinRow {
  /** The id its choices are kept under: that of the thing, or `capKey` of it for the name of its capital. */
  id: string;
  /** The thing as the games match it. Its `short` is not to be trusted here: the settings change under it. */
  item: Answerable;
  name: string;
  /** What it is, or what it is the capital of. */
  note?: string;
  /** The other names it answers to, written out: they are names, not short forms. */
  also: string[];
}

export interface TypeinGroup {
  key: string;
  title: string;
  rows: TypeinRow[];
  /** False where the ids are not those of what is named (capitals): see `Matcher`. */
  codes: boolean;
}

const cap = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

function byName<T extends { name: string }>(rows: T[]): T[] {
  const collator = new Intl.Collator(getLang() === 'en' ? 'en' : 'es', { sensitivity: 'base', numeric: true });
  return rows.sort((a, b) => collator.compare(a.name, b.name));
}

function rowOf(id: string, item: Answerable, name: string, note?: string): TypeinRow {
  const short = new Set(shortFormsOf(item).map((f) => f.key));
  const seen = new Set([key(name)]);
  const also: string[] = [];
  for (const raw of item.answers) {
    const k = raw ? key(raw) : '';
    if (!k || seen.has(k) || short.has(k)) continue;
    seen.add(k);
    also.push(raw);
  }
  return { id, item, name, note, also };
}

const pieceRow = (it: Item, note?: string): TypeinRow => rowOf(it.id, it, it.name, note);

function capitalRow(it: Item): TypeinRow | null {
  const a = capitalAnswers(it);
  return a ? rowOf(capKey(it.id), a, it.capital![0], it.name) : null;
}

const playable = (c: Country): boolean => c.cl !== 'other';

/** The countries a list is kept by, in the order of their names. */
export async function typeinScopes(tab: TypeinTab): Promise<Country[]> {
  const { index } = await loadIndex();
  let list: Country[] = [];
  if (tab === 'regions') list = index.countries.filter((c) => eligible('regions', c));
  else if (tab === 'cities') {
    const file = await loadCities();
    list = index.countries.filter((c) => playable(c) && !!file.c[c.id]?.length);
  } else if (tab === 'capitals') {
    const file = await loadCapitals();
    list = index.countries.filter((c) => eligible('regions', c) && Object.values(file.rc[c.id] ?? {}).some((level) => Object.keys(level).length > 0));
  }
  return byName(list.map((c) => ({ c, name: nm(c.n) }))).map((x) => x.c);
}

/**
 * One list of the settings: the things of a kind, in groups that are each a map of the game. `scope` is a
 * country where the list is kept by country; '' with capitals stands for those of the countries.
 */
export async function typeinGroups(tab: TypeinTab, scope = ''): Promise<TypeinGroup[]> {
  const { index, byId } = await loadIndex();
  if (tab === 'countries' || (tab === 'capitals' && !scope)) {
    const countries = index.countries.filter(playable);
    if (tab === 'countries')
      return [
        {
          key: 'c',
          title: L('Países y territorios', 'Countries and territories'),
          rows: byName(countries.map((c) => rowOf(c.id, countryAnswers(c), nm(c.n), c.cl === 'dep' ? L('territorio', 'territory') : undefined))),
          codes: true,
        },
      ];
    const rows = countries.map((c) => capitalRow(countryItem(c))).filter((r): r is TypeinRow => !!r);
    return [{ key: 'cc', title: L('Capitales de país', 'Capitals of countries'), rows: byName(rows), codes: false }];
  }
  if (tab === 'physical') {
    const deck = await buildPhysicalDeck([...PHYS_KINDS, 'all']);
    return PHYS_KINDS.map((kind: PhysKind) => ({
      key: `p:${kind}`,
      title: cap(kindNoun(kind).many),
      rows: byName(deck.items.filter((it) => it.cat === kind).map((it) => pieceRow(it))),
      codes: true,
    })).filter((g) => g.rows.length);
  }
  const country = byId.get(scope);
  if (!country || !playable(country)) return [];
  if (tab === 'cities') {
    const deck = await buildCityDeck([country.id], 'top', Number.MAX_SAFE_INTEGER);
    return [{ key: `t:${country.id}`, title: L(`Ciudades de ${nm(country.n)}`, `Cities of ${nm(country.n)}`), rows: byName(deck.items.map((it) => pieceRow(it, it.cap === 3 ? L('capital', 'capital') : undefined))), codes: true }];
  }
  const out: TypeinGroup[] = [];
  // The level the country is played at unless another is chosen comes first.
  for (const level of [...country.lv].sort((a, b) => Number(b.k === country.dl) - Number(a.k === country.dl))) {
    const deck = await buildDeck({ scope: 'regions', countries: [country.id], levels: { [country.id]: level.k } });
    const many = cap(levelNoun(level).many);
    if (tab === 'regions') out.push({ key: `r:${country.id}.${level.k}`, title: many, rows: byName(deck.items.map((it) => pieceRow(it, it.parent))), codes: true });
    else {
      const rows = deck.items.map(capitalRow).filter((r): r is TypeinRow => !!r);
      if (rows.length) out.push({ key: `rc:${country.id}.${level.k}`, title: L(`Capitales · ${many}`, `Capitals · ${many}`), rows: byName(rows), codes: false });
    }
  }
  return out;
}

/**
 * The list a thing is found in. Its id says what kind of thing it is, and nearly always its country; the
 * lists are asked, because the islands of the Dutch Caribbean go by Dutch ids ("NL-BQ1") in a list of their own.
 */
export async function locateTypein(id: string): Promise<{ tab: TypeinTab; scope: string } | null> {
  const capital = id.startsWith('cap:');
  const of = capital ? id.slice(4) : id;
  if (!capital && id.includes(':')) return { tab: 'physical', scope: '' };
  if (/^[A-Z]{2}$/.test(of)) return { tab: capital ? 'capitals' : 'countries', scope: '' };
  if (/^[A-Z]{2}[-~]/.test(of)) {
    const tab: TypeinTab = capital ? 'capitals' : 'regions';
    const scopes = new Set((await typeinScopes(tab)).map((c) => c.id));
    for (const scope of new Set([of.slice(0, 2), of.slice(3, 5).toUpperCase()])) {
      if (!scopes.has(scope)) continue;
      if ((await typeinGroups(tab, scope)).some((g) => g.rows.some((r) => r.id === id))) return { tab, scope };
    }
    return null;
  }
  if (capital) return null;
  const file = await loadCities();
  for (const [country, list] of Object.entries(file.c)) if (list.some((rec) => rec.i === id)) return { tab: 'cities', scope: country };
  return null;
}

/** A short form of a row as it fares on the map of its group. */
export interface ChipView extends Chip {
  /**
   * Set when it is in force and yet is not this thing's alone on the map: the other things it could be
   * there, by name. Empty when they cannot be told.
   */
  clash?: string[];
  /** With `clash`: whether it is taken for this thing all the same (a spelling that two things share is taken for both). */
  taken?: boolean;
}

/**
 * The short forms of every row of a group, each with what it comes to on the map the group makes: the
 * matcher of the games is asked, so that the settings say what the games will do.
 */
export function chipViews(group: TypeinGroup, settings: TypeinSettings): Map<string, ChipView[]> {
  const chips = new Map(group.rows.map((r) => [r.id, chipsOf(r.item, r.id, settings)]));
  const matcher = new Matcher(
    group.rows.map((r) => ({ ...r.item, short: editOf(r.id, settings) })),
    { codes: group.codes },
  );
  /** Who has each short form in force. */
  const holders = new Map<string, TypeinRow[]>();
  for (const r of group.rows) {
    for (const c of chips.get(r.id)!) if (c.on) holders.set(c.key, [...(holders.get(c.key) ?? []), r]);
  }
  const names = new Map(group.rows.map((r) => [r.item.id, r.name]));
  const out = new Map<string, ChipView[]>();
  for (const r of group.rows) {
    out.set(
      r.id,
      chips.get(r.id)!.map((c): ChipView => {
        // What a pattern takes cannot be listed, and neither can what else it might be.
        if (!c.on || c.pattern) return c;
        const ids = matcher.lookup(c.text);
        if (ids.length === 1 && ids[0] === r.item.id) return c;
        const others = new Set<string>();
        for (const id of ids) if (id !== r.item.id) others.add(names.get(id) ?? id);
        for (const x of holders.get(c.key) ?? []) if (x !== r) others.add(x.name);
        // Initials that are the code of another piece of the map are not taken for a name either.
        if (group.codes && !ids.length) for (const x of group.rows) if (x !== r && codeOf(x.item.id) === c.key) others.add(x.name);
        return { ...c, clash: [...others], taken: ids.includes(r.item.id) };
      }),
    );
  }
  return out;
}
