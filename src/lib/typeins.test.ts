// Type-ins: the short forms each thing answers to, as the game ships them and as the settings change them.

import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildDeck, countryAnswers, loadIndex, setLoader } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import { setLang } from './i18n';
import { useStore } from './store';
import { Matcher, shortFormsOf } from './matcher';
import { type Answerable, type ShortEdit } from './text';
import { SAMPLES, SETTINGS_PATH, TYPEIN_TABS, chipViews, locateTypein, settingsLink, typeinGroups, typeinScopes, type TypeinGroup } from './typeinList';
import {
  MAX_FORMS,
  SHIPPED,
  SHIPPED_AUTO,
  addForm,
  capKey,
  capitalAnswers,
  chipsOf,
  cleanTypeins,
  editOf,
  getTypeins,
  readTypeinFile,
  resetForms,
  setTypeins,
  switchForm,
  typeinFile,
  type Typeins,
} from './typeins';

// The game as it shipped before it came with a list for its regions: nothing but RI switched off. These
// tests are about the rule and about the settings; what the list does is told in shippedList.test.ts.
vi.mock('./typeins.default.json', () => ({ default: { app: 'regionle', kind: 'typeins', version: 1, auto: true, edits: { 'US-RI': { off: ['ri'] } } } }));

/** Something with these names, the first of them the one on show, and what the settings say of it. */
const named = (id: string, short: ShortEdit | undefined, ...names: string[]): Answerable => ({ id, answers: names, proper: names, short });
const AUTO = { auto: true, edits: {} };

afterEach(() => {
  setTypeins({});
  useStore.setState({ typeins: {}, typeinAuto: null });
});

describe('what the settings say to the matcher', () => {
  it('takes away the initials that are switched off, and those alone', () => {
    const m = new Matcher([named('a', { off: ['ri'] }, 'Rhode Island'), named('b', { off: ['R.I.'] }, 'Río Ibáñez'), named('c', undefined, 'New Hampshire'), named('d', { off: ['zz'] }, 'New Jersey')]);
    expect(m.lookup('ri')).toEqual([]);
    expect(m.lookup('R.I.')).toEqual([]);
    expect(m.lookup('rhode island')).toEqual(['a']);
    expect(m.lookup('nh')).toEqual(['c']);
    expect(m.lookup('nj')).toEqual(['d']);
    // One that is off is no longer shared with anything: the other has it to itself.
    const two = new Matcher([named('a', { off: ['mg'] }, 'Mato Grosso'), named('b', undefined, 'Minas Gerais')]);
    expect(two.lookup('mg')).toEqual(['b']);
    expect(two.vague('mg')).toBe(false);
  });

  it('takes away an abbreviation written in the data', () => {
    const us = (short?: ShortEdit): Answerable => ({ id: 'US', answers: ['Estados Unidos', 'United States', 'EEUU', 'EE UU', 'USA', 'US'], proper: ['Estados Unidos', 'United States'], short });
    const all = new Matcher([us()]);
    expect(['eeuu', 'ee. uu.', 'usa', 'us', 'eu'].map((x) => all.lookup(x).length)).toEqual([1, 1, 1, 1, 1]);
    const some = new Matcher([us({ off: ['eeuu', 'us'] })]);
    expect(['eeuu', 'ee. uu.', 'usa', 'us', 'eu'].map((x) => some.lookup(x).length)).toEqual([0, 0, 1, 0, 1]);
    // A name written out is not a short form, and is not theirs to take away.
    expect(new Matcher([us({ off: ['unitedstates', 'estadosunidos'] })]).lookup('united states')).toEqual(['US']);
  });

  it('adds what is asked, as a short form like any other', () => {
    const m = new Matcher([named('US-MA', { add: ['MA', 'Mass'] }, 'Massachusetts'), named('US-ME', undefined, 'Maine'), named('US-TX', undefined, 'Texas')]);
    expect(m.lookup('ma')).toEqual(['US-MA']);
    expect(m.lookup('M.A.')).toEqual(['US-MA']);
    expect(m.lookup('mass')).toEqual(['US-MA']);
    expect(m.lookup('tx')).toEqual([]);
    expect(m.check('ma', 'US-MA')).toEqual({ res: 'yes' });
    expect(m.check('ma', 'US-ME')).toEqual({ res: 'other', id: 'US-MA' });
    // With letters of the name in sight neither counts, and neither costs a try.
    expect(m.lookup('ma', { whole: true })).toEqual([]);
    expect(m.check('ma', 'US-MA', { whole: true })).toEqual({ res: 'short' });
    expect(m.check('mass', 'US-MA', { whole: true })).toEqual({ res: 'short' });
    expect(m.check('massachusetts', 'US-MA', { whole: true })).toEqual({ res: 'yes' });
    expect(m.abbreviates('mass')).toBe(true);
    expect(m.abbreviations()).toEqual([
      ['ma', 'US-MA'],
      ['mass', 'US-MA'],
    ]);
  });

  it('takes what is added even where initials would name nothing', () => {
    // "MG" is two states of Brazil, and "MA" is the code of another piece of the map…
    const plain = new Matcher([named('BR-MT', undefined, 'Mato Grosso'), named('BR-MG', undefined, 'Minas Gerais'), named('BR-MA', undefined, 'Maranhão'), named('BR-XX', undefined, 'Monte Alegre')]);
    expect(plain.lookup('mg')).toEqual([]);
    expect(plain.vague('mg')).toBe(true);
    expect(plain.lookup('ma')).toEqual([]);
    // …until the player says whose they are.
    const chosen = new Matcher([named('BR-MT', undefined, 'Mato Grosso'), named('BR-MG', { add: ['MG'] }, 'Minas Gerais'), named('BR-MA', undefined, 'Maranhão'), named('BR-XX', { add: ['MA'] }, 'Monte Alegre')]);
    expect(chosen.lookup('mg')).toEqual(['BR-MG']);
    expect(chosen.vague('mg')).toBe(false);
    expect(chosen.lookup('ma')).toEqual(['BR-XX']);
    // Given to two things, it is taken for both.
    const both = new Matcher([named('a', { add: ['X1'] }, 'Uno'), named('b', { add: ['x1'] }, 'Otro')]);
    expect(both.lookup('x1')).toEqual(['a', 'b']);
  });

  it('gives no initials where the rule is switched off, but for those added', () => {
    const m = new Matcher([named('a', { rule: false }, 'New Hampshire'), named('b', { rule: false, add: ['NJ'] }, 'New Jersey'), named('c', { rule: false }, 'Estados Unidos', 'EEUU')]);
    expect(m.lookup('nh')).toEqual([]);
    expect(m.lookup('nj')).toEqual(['b']);
    // What the data writes is not the rule's.
    expect(m.lookup('eeuu')).toEqual(['c']);
    expect(m.lookup('eu')).toEqual([]);
  });

  it('waits for Enter while what was typed could go on, even to a name of the same thing', () => {
    const m = new Matcher([named('US-MA', { add: ['MA', 'Mass', 'BST'] }, 'Massachusetts'), named('US-ME', undefined, 'Maine'), named('US-MD', undefined, 'Maryland'), named('US', undefined, 'Estados Unidos', 'USA', 'US')]);
    const open = new Set(['US-MA', 'US-ME', 'US-MD', 'US']);
    // "ma" could be on its way to Maine; "mass", to Massachusetts itself: taken at once, the rest of the
    // name would be left in the field. The same with what the data writes: "us" and "usa".
    expect(m.typed('ma', open)).toEqual({ ids: ['US-MA'], wait: true });
    expect(m.typed('mass', open)).toEqual({ ids: ['US-MA'], wait: true });
    expect(m.typed('us', open)).toEqual({ ids: ['US'], wait: true });
    // Nothing goes on from these: they are taken as they are typed.
    expect(m.typed('usa', open)).toEqual({ ids: ['US'], wait: false });
    expect(m.typed('bst', open)).toEqual({ ids: ['US-MA'], wait: false });
    expect(m.typed('massachusetts', open)).toEqual({ ids: ['US-MA'], wait: false });
  });

  it('lists the short forms of a thing whatever the settings say', () => {
    expect(shortFormsOf(named('a', { off: ['nh'], rule: false }, 'Nuevo Hampshire', 'New Hampshire'))).toEqual([{ key: 'nh', text: 'NH', from: 'initials' }]);
    expect(shortFormsOf(named('a', undefined, 'Massachusetts'))).toEqual([]);
    expect(shortFormsOf({ id: 'US', answers: ['Estados Unidos', 'United States', 'EEUU', 'EE UU', 'USA', 'US'], proper: ['Estados Unidos', 'United States'] })).toEqual([
      { key: 'eu', text: 'EU', from: 'initials' },
      { key: 'eeuu', text: 'EEUU', from: 'data' },
      { key: 'usa', text: 'USA', from: 'data' },
      { key: 'us', text: 'US', from: 'data' },
    ]);
    // Named after its kind, or of one word on show: no initials.
    expect(shortFormsOf({ id: 'l', answers: ['Lago Superior', 'Lake Superior'], proper: [] })).toEqual([]);
    expect(shortFormsOf({ id: 'k', answers: ['Komi', 'Komi Republic'], proper: ['Komi', 'Komi Republic'] })).toEqual([]);
    expect(shortFormsOf({ id: 'x', answers: ['Nueva York'] })).toEqual([]);
  });
});

describe('the choices of the player over what the game ships', () => {
  const RI = named('US-RI', undefined, 'Rhode Island');
  const NH = named('US-NH', undefined, 'Nuevo Hampshire', 'New Hampshire');
  const MA = named('US-MA', undefined, 'Massachusetts');

  it('ships with RI switched off for Rhode Island, and the rule on', () => {
    expect(SHIPPED['US-RI']).toEqual({ off: ['ri'] });
    expect(SHIPPED_AUTO).toBe(true);
    expect(editOf('US-RI', AUTO)).toEqual({ off: ['ri'] });
    expect(editOf('US-NH', AUTO)).toBeUndefined();
    expect(chipsOf(RI, 'US-RI', AUTO)).toEqual([{ key: 'ri', text: 'RI', from: 'initials', usual: false, on: false }]);
    expect(chipsOf(NH, 'US-NH', AUTO)).toEqual([{ key: 'nh', text: 'NH', from: 'initials', usual: true, on: true }]);
    expect(chipsOf(MA, 'US-MA', AUTO)).toEqual([]);
  });

  it('writes down only what differs from the way things come', () => {
    let edits: Typeins = {};
    const chip = (it: Answerable, text: string) => chipsOf(it, it.id, { auto: true, edits }).find((c) => c.text === text)!;
    // Off, and on again: nothing is left to say.
    edits = switchForm(edits, 'US-NH', chip(NH, 'NH'), false);
    expect(edits).toEqual({ 'US-NH': { off: ['nh'] } });
    expect(chip(NH, 'NH').on).toBe(false);
    expect(editOf('US-NH', { auto: true, edits })).toEqual({ off: ['nh'] });
    edits = switchForm(edits, 'US-NH', chip(NH, 'NH'), true);
    expect(edits).toEqual({});
    // What ships switched off is switched on by adding it, and the matcher is no longer told to drop it.
    edits = switchForm(edits, 'US-RI', chip(RI, 'RI'), true);
    expect(edits).toEqual({ 'US-RI': { add: ['RI'] } });
    expect(chip(RI, 'RI')).toMatchObject({ on: true, usual: false, from: 'initials' });
    expect(editOf('US-RI', { auto: true, edits })).toEqual({ add: ['RI'] });
    edits = switchForm(edits, 'US-RI', chip(RI, 'RI'), false);
    expect(edits).toEqual({});
  });

  it('adds short forms, and says why when it does not', () => {
    const ok = (r: ReturnType<typeof addForm>): Typeins => {
      if ('error' in r) throw new Error(r.error);
      return r.edits;
    };
    let edits = ok(addForm({}, 'US-MA', ' ma ', MA, AUTO));
    // A few small letters are a code and are kept in capitals; anything else, as written.
    expect(edits).toEqual({ 'US-MA': { add: ['MA'] } });
    edits = ok(addForm(edits, 'US-MA', 'Mass', MA, AUTO));
    edits = ok(addForm(edits, 'US-MA', 'bay  state', MA, AUTO));
    expect(edits).toEqual({ 'US-MA': { add: ['MA', 'Mass', 'bay state'] } });
    expect(chipsOf(MA, 'US-MA', { auto: true, edits }).map((c) => `${c.text}:${c.from}:${c.on}`)).toEqual(['MA:own:true', 'Mass:own:true', 'bay state:own:true']);
    expect(addForm(edits, 'US-MA', 'm.a.', MA, AUTO)).toEqual({ error: 'have' });
    expect(addForm(edits, 'US-MA', 'massachusetts', MA, AUTO)).toEqual({ error: 'name' });
    expect(addForm(edits, 'US-NH', 'New Hampshire', NH, AUTO)).toEqual({ error: 'name' });
    expect(addForm(edits, 'US-MA', ' … ', MA, AUTO)).toEqual({ error: 'empty' });
    expect(addForm(edits, 'US-NH', 'NH', NH, AUTO)).toEqual({ error: 'have' });
    // One that is there but off is switched on, whoever switched it off.
    expect(ok(addForm({ 'US-NH': { off: ['nh'] } }, 'US-NH', 'n.h.', NH, AUTO))).toEqual({});
    expect(ok(addForm({}, 'US-RI', 'ri', RI, AUTO))).toEqual({ 'US-RI': { add: ['RI'] } });
    // One added by hand goes with a tap.
    const own = chipsOf(MA, 'US-MA', { auto: true, edits }).find((c) => c.text === 'Mass')!;
    expect(switchForm(edits, 'US-MA', own, false)).toEqual({ 'US-MA': { add: ['MA', 'bay state'] } });
    // There is a limit to how many.
    let many: Typeins = {};
    for (let i = 0; i < MAX_FORMS; i++) many = ok(addForm(many, 'US-MA', `M${i}`, MA, AUTO));
    expect(addForm(many, 'US-MA', 'one more', MA, AUTO)).toEqual({ error: 'full' });
    expect(resetForms({ ...edits, 'US-NH': { off: ['nh'] } }, ['US-MA'])).toEqual({ 'US-NH': { off: ['nh'] } });
  });

  it('switches the rule off for everything, and lets each one back in by hand', () => {
    const off = { auto: false, edits: {} as Typeins };
    expect(editOf('US-NH', off)).toEqual({ rule: false });
    expect(editOf('US-RI', off)).toEqual({ off: ['ri'], rule: false });
    expect(chipsOf(NH, 'US-NH', off)).toEqual([{ key: 'nh', text: 'NH', from: 'initials', usual: false, on: false }]);
    // What the data writes does not go with the rule.
    const us: Answerable = { id: 'US', answers: ['Estados Unidos', 'EEUU'], proper: ['Estados Unidos'] };
    expect(chipsOf(us, 'US', off).map((c) => `${c.text}:${c.on}`)).toEqual(['EU:false', 'EEUU:true']);
    const edits = switchForm({}, 'US-NH', chipsOf(NH, 'US-NH', off)[0], true);
    expect(edits).toEqual({ 'US-NH': { add: ['NH'] } });
    expect(editOf('US-NH', { auto: false, edits })).toEqual({ add: ['NH'], rule: false });
    expect(chipsOf(NH, 'US-NH', { auto: false, edits })[0]).toMatchObject({ on: true, from: 'initials' });
    // With the rule back on it is on twice over, and switching it off still does.
    const chip = chipsOf(NH, 'US-NH', { auto: true, edits })[0];
    expect(chip).toMatchObject({ on: true, usual: true });
    expect(switchForm(edits, 'US-NH', chip, false)).toEqual({ 'US-NH': { off: ['nh'] } });
  });

  it('keeps the name of a capital apart from the thing it is the capital of', () => {
    expect(capKey('US-UT')).toBe('cap:US-UT');
    expect(capitalAnswers({ id: 'US-TX' })).toBeNull();
    const settings = { auto: true, edits: { 'cap:US-UT': { off: ['slc'] }, 'US-UT': { add: ['UT'] } } };
    const utah = capitalAnswers({ id: 'US-UT', capital: ['Salt Lake City'] }, settings)!;
    expect(utah).toEqual({ id: 'US-UT', answers: ['Salt Lake City'], proper: ['Salt Lake City'], short: { off: ['slc'] } });
    const m = new Matcher([utah], { codes: false });
    expect(m.lookup('slc')).toEqual([]);
    expect(m.lookup('ut')).toEqual([]);
    expect(m.lookup('salt lake city')).toEqual(['US-UT']);
  });

  it('reads choices from a file and leaves out what is not one', () => {
    expect(
      cleanTypeins({
        'US-MA': { add: ['MA', ' ma ', 'Mass', 7, '', '¿?'], off: ['M.A.', 'XX', 'x x'] },
        'US-NH': { off: ['NH'] },
        'US-TX': { add: [], off: [] },
        'US-AK': 'ak',
        'US-AL': null,
        '': { add: ['x'] },
      }),
    ).toEqual({ 'US-MA': { add: ['MA', 'Mass'], off: ['xx'] }, 'US-NH': { off: ['nh'] } });
    expect(cleanTypeins(null)).toEqual({});
    expect(cleanTypeins(['US-MA'])).toEqual({});
    const long = cleanTypeins({ a: { add: ['x'.repeat(200), ...Array.from({ length: 60 }, (_, i) => `f${i}`)] } });
    expect(long.a.add).toHaveLength(MAX_FORMS);
    expect(long.a.add![0]).toHaveLength(40);
  });

  it('tells a file of settings from anything else', () => {
    const edits = { 'US-MA': { add: ['MA'] } };
    expect(readTypeinFile({ app: 'regionle', kind: 'typeins', version: 1, auto: false, edits })).toEqual({ edits, auto: false });
    expect(readTypeinFile({ kind: 'typeins', edits: {} })).toEqual({ edits: {} });
    // A backup of the progress carries them; one from before they existed does not.
    expect(readTypeinFile({ app: 'regionle', version: 3, stats: {}, sessions: [], typeins: edits, typeinAuto: true })).toEqual({ edits, auto: true });
    // In a backup "never chosen" is null: as the game ships, whatever stands where it is read.
    expect(readTypeinFile({ app: 'regionle', version: 3, stats: {}, sessions: [], typeins: edits, typeinAuto: null })).toEqual({ edits, auto: true });
    expect(readTypeinFile({ app: 'regionle', version: 3, stats: {}, sessions: [], typeins: {}, typeinAuto: false })).toEqual({ edits: {}, auto: false });
    expect(readTypeinFile({ app: 'regionle', version: 3, stats: {}, sessions: [] })).toBeNull();
    // The choices alone.
    expect(readTypeinFile(edits)).toEqual({ edits });
    for (const junk of [null, 7, 'x', [], {}, { a: 1 }, { 'US-MA': { add: [] } }]) expect(readTypeinFile(junk), JSON.stringify(junk)).toBeNull();
  });

  it('exports what ships together with the choices, and reads its own file back', () => {
    const settings = { auto: false, edits: { 'US-MA': { add: ['MA'] }, 'US-NH': { off: ['nh'] } } };
    const file = typeinFile(settings);
    expect(file).toEqual({ app: 'regionle', kind: 'typeins', version: 1, auto: false, edits: { 'US-MA': { add: ['MA'] }, 'US-NH': { off: ['nh'] }, 'US-RI': { off: ['ri'] } } });
    // Read where the game ships with the same, only the choices are the player's.
    expect(readTypeinFile(JSON.parse(JSON.stringify(file)))).toEqual({ edits: settings.edits, auto: false });
    // Switching on what ships switched off is a choice too, and the file says it.
    const back = typeinFile({ auto: true, edits: { 'US-RI': { add: ['RI'] } } });
    expect(back.edits).toEqual({ 'US-RI': { add: ['RI'] } });
    expect(readTypeinFile(back)).toEqual({ edits: { 'US-RI': { add: ['RI'] } }, auto: true });
    expect(typeinFile(AUTO).edits).toEqual(SHIPPED);
  });
});

describe('the settings on the maps of the game', () => {
  beforeAll(() => {
    setLang('es');
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  });

  const states = () => buildDeck({ scope: 'regions', countries: ['US'], levels: { US: 'f' } });

  it('refuses RI on the map of the United States as the game ships', async () => {
    const m = new Matcher((await states()).items);
    expect(m.lookup('ri')).toEqual([]);
    expect(m.lookup('rhode island')).toEqual(['US-RI']);
    expect(m.lookup('nh')).toEqual(['US-NH']);
    expect(m.lookup('ma')).toEqual([]);
  });

  it('builds every deck with the choices that stand', async () => {
    setTypeins({ edits: { 'US-RI': { add: ['RI'] }, 'US-MA': { add: ['MA', 'Mass'] }, 'US-NH': { off: ['nh'] }, US: { off: ['usa'], add: ['Yanquilandia'] }, 'cap:US-UT': { off: ['slc'] }, 'r:nile': { add: ['NL'] } } });
    const deck = await states();
    const m = new Matcher(deck.items);
    expect(m.lookup('ri')).toEqual(['US-RI']);
    expect(m.lookup('ma')).toEqual(['US-MA']);
    expect(m.lookup('mass')).toEqual(['US-MA']);
    expect(m.lookup('nh')).toEqual([]);
    expect(m.lookup('nj')).toEqual(['US-NJ']);
    // The capitals of the same deck, under their own key.
    const capitals = new Matcher(
      deck.items.map((it) => capitalAnswers(it)).filter((a): a is Answerable => !!a),
      { codes: false },
    );
    expect(capitals.lookup('slc')).toEqual([]);
    expect(capitals.lookup('salt lake city')).toEqual(['US-UT']);
    expect(capitals.lookup('br')).toEqual(['US-LA']);
    // Countries, as pieces of a map and as answers elsewhere.
    const world = new Matcher((await buildDeck({ scope: 'countries', countries: ['US', 'MX', 'CA'] })).items);
    expect(world.lookup('usa')).toEqual([]);
    expect(world.lookup('eeuu')).toEqual(['US']);
    expect(world.lookup('yanquilandia')).toEqual(['US']);
    const { byId } = await loadIndex();
    expect(new Matcher([countryAnswers(byId.get('US')!)]).lookup('usa')).toEqual([]);
    // Physical geography has no initials of its own, and takes those it is given.
    const rivers = new Matcher((await buildPhysicalDeck(['river', 'AF'])).items);
    expect(rivers.lookup('nl')).toEqual(['r:nile']);
    // Cities.
    const cities = await buildCityDeck(['US'], 'top', 25);
    const ny = cities.items.find((it) => it.answers.includes('New York City'))!;
    expect(new Matcher(cities.items).lookup('nyc')).toEqual([ny.id]);
    setTypeins({ edits: { [ny.id]: { off: ['nyc'] } } });
    expect(new Matcher((await buildCityDeck(['US'], 'top', 25)).items).lookup('nyc')).toEqual([]);
  });

  it('gives no initials anywhere once the rule is off', async () => {
    setTypeins({ auto: false, edits: { 'US-NJ': { add: ['NJ'] } } });
    const m = new Matcher((await states()).items);
    // What the data writes (DC) stays, with what was added by hand.
    expect(m.abbreviations().map(([text]) => text).sort()).toEqual(['dc', 'nj']);
    expect(m.lookup('ny')).toEqual([]);
    expect(m.lookup('dc')).toEqual(['US-DC']);
  });

  it('follows the store', async () => {
    useStore.getState().setTypeins({ 'US-MA': { add: ['MA'] } });
    expect(getTypeins()).toEqual({ auto: true, edits: { 'US-MA': { add: ['MA'] } } });
    useStore.getState().setTypeinAuto(false);
    expect(getTypeins().auto).toBe(false);
    expect(
      new Matcher((await states()).items)
        .abbreviations()
        .map(([text, id]) => `${text} ${id}`)
        .sort(),
    ).toEqual(['dc US-DC', 'ma US-MA']);
    // A backup brings its own; one that says nothing leaves them alone.
    expect(useStore.getState().importData({ stats: {}, sessions: [] })).toBe(true);
    expect(getTypeins()).toEqual({ auto: false, edits: { 'US-MA': { add: ['MA'] } } });
    expect(useStore.getState().importData({ stats: {}, sessions: [], typeins: { 'US-TX': { add: ['TX', 3] }, junk: 1 }, typeinAuto: true })).toBe(true);
    expect(getTypeins()).toEqual({ auto: true, edits: { 'US-TX': { add: ['TX'] } } });
    // One in which nothing was ever chosen puts everything back as the game ships.
    useStore.getState().setTypeinAuto(false);
    expect(useStore.getState().importData({ stats: {}, sessions: [], typeins: {}, typeinAuto: null })).toBe(true);
    expect(useStore.getState().typeinAuto).toBeNull();
    expect(getTypeins()).toEqual({ auto: true, edits: {} });
    useStore.getState().setTypeins({ 'US-TX': { add: ['TX'] } });
    // Starting from scratch is about the progress, not about the settings.
    useStore.getState().resetProgress();
    expect(useStore.getState().typeins).toEqual({ 'US-TX': { add: ['TX'] } });
  });
});

describe('the lists of the settings', () => {
  beforeAll(() => {
    setLang('es');
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
  });

  const row = (groups: TypeinGroup[], id: string) => groups.flatMap((g) => g.rows).find((r) => r.id === id)!;
  const shown = (group: TypeinGroup, id: string, settings = AUTO) =>
    chipViews(group, settings)
      .get(id)!
      .map((c) => `${c.text}${c.on ? '' : '-'}${c.clash ? `!${c.taken ? '+' : ''}${c.clash.join('/')}` : ''}`);

  it('lists the states of the United States with their ids, names and short forms', async () => {
    const groups = await typeinGroups('regions', 'US');
    // The level the country is played at comes first.
    expect(groups.map((g) => `${g.key} ${g.title} ${g.rows.length}`)).toEqual(['r:US.f Estados 51', 'r:US.g1 Regiones censales 4']);
    const [states] = groups;
    expect(states.rows[0]).toMatchObject({ id: 'US-AL', name: 'Alabama', note: 'Sur', also: [] });
    expect(row(groups, 'US-NH')).toMatchObject({ name: 'Nuevo Hampshire', also: ['New Hampshire'] });
    expect(shown(states, 'US-NH')).toEqual(['NH']);
    expect(shown(states, 'US-RI')).toEqual(['RI-']);
    expect(shown(states, 'US-MA')).toEqual([]);
    expect(shown(states, 'US-DC')).toEqual(['WDC', 'DOC', 'DC']);
    expect(shown(states, 'US-MA', { auto: true, edits: { 'US-MA': { add: ['MA'] } } })).toEqual(['MA']);
    expect(shown(states, 'US-NH', { auto: false, edits: {} })).toEqual(['NH-']);
  });

  it('says where a short form in force names nothing, and what else it could be', async () => {
    const [brazil] = await typeinGroups('regions', 'BR');
    expect(shown(brazil, 'BR-MG')).toEqual(['MG!Mato Grosso']);
    expect(shown(brazil, 'BR-MT')).toEqual(['MG!Minas Gerais']);
    expect(shown(brazil, 'BR-SP')).toEqual(['SP']);
    // Switched off for one, it is the other's; added to one, it is that one's and the other's is still in doubt.
    expect(shown(brazil, 'BR-MG', { auto: true, edits: { 'BR-MT': { off: ['mg'] } } })).toEqual(['MG']);
    const added = { auto: true, edits: { 'BR-MG': { add: ['MG'] } } };
    expect(shown(brazil, 'BR-MG', added)).toEqual(['MG']);
    expect(shown(brazil, 'BR-MT', added)).toEqual(['MG!Minas Gerais']);
    // Given to two by hand it counts for both, and says so.
    const twice = { auto: true, edits: { 'BR-SP': { add: ['XX'] }, 'BR-RJ': { add: ['XX'] } } };
    expect(shown(brazil, 'BR-SP', twice)).toEqual(['SP', 'XX!+Río de Janeiro']);
    // What is added by hand comes before the initials of another piece, and the other is told…
    const [states] = await typeinGroups('regions', 'US');
    const stolen = { auto: true, edits: { 'US-MA': { add: ['NH'] } } };
    expect(shown(states, 'US-MA', stolen)).toEqual(['NH']);
    expect(shown(states, 'US-NH', stolen)).toEqual(['NH!Massachusetts']);
    expect(new Matcher(states.rows.map((r) => ({ ...r.item, short: editOf(r.id, stolen) }))).lookup('nh')).toEqual(['US-MA']);
    // …and one that is the name of another piece counts for both, as two pieces of one name do.
    const named = { auto: true, edits: { 'US-DC': { add: ['Washington'] } } };
    expect(shown(states, 'US-DC', named)).toEqual(['WDC', 'DOC', 'DC', 'Washington!+Washington']);
    expect(new Matcher(states.rows.map((r) => ({ ...r.item, short: editOf(r.id, named) }))).lookup('washington').sort()).toEqual(['US-DC', 'US-WA']);
    // Initials that are the code of another country.
    const [countries] = await typeinGroups('countries');
    expect(countries.rows).toHaveLength(249);
    expect(shown(countries, 'SV')).toEqual(['ES!España']);
    expect(shown(countries, 'US')).toEqual(['EU', 'EEUU', 'USA', 'US']);
    expect(row([countries], 'US').also).toEqual(['United States', 'United States of America', 'Estados Unidos de América', 'América']);
  });

  it('lists capitals under their own keys, and cities and physical geography', async () => {
    const [world] = await typeinGroups('capitals');
    expect(world).toMatchObject({ key: 'cc', codes: false });
    expect(row([world], 'cap:AR')).toMatchObject({ name: 'Buenos Aires', note: 'Argentina' });
    // "BA" is Buenos Aires though it is the code of Bosnia: the ids here are not those of what is named.
    expect(shown(world, 'cap:AR')).toEqual(['BA']);
    const states = await typeinGroups('capitals', 'US');
    expect(states.map((g) => g.key)).toEqual(['rc:US.f']);
    expect(row(states, 'cap:US-UT')).toMatchObject({ name: 'Salt Lake City', note: 'Utah' });
    expect(shown(states[0], 'cap:US-UT')).toEqual(['SLC']);
    const [cities] = await typeinGroups('cities', 'US');
    expect(cities.rows).toHaveLength(96);
    expect(cities.rows.map((r) => r.name)).toContain('Nueva York');
    const physical = await typeinGroups('physical');
    expect(physical.map((g) => g.title)).toEqual(['Continentes', 'Ríos', 'Lagos', 'Mares y océanos', 'Cordilleras', 'Mesetas y llanuras', 'Penínsulas', 'Picos y volcanes', 'Cabos', 'Desiertos', 'Islas', 'Cataratas']);
    // The continents on their own, the oceans where they have always been: with the seas, and only there.
    expect(physical[0].rows.map((r) => r.name)).toEqual(['África', 'América', 'Antártida', 'Asia', 'Europa', 'Oceanía']);
    expect(physical[3].rows.map((r) => r.id)).toEqual(expect.arrayContaining(['s:atlantic-ocean', 's:pacific-ocean', 's:mediterranean-sea']));
    // What is only asked on the map of its country can be given a short form too.
    const rows = physical.flatMap((g) => g.rows.map((r) => r.id));
    for (const id of ['r:jarama', 'c:cape-gata', 'p:northern-meseta', 'r:central-system', 's:cantabrian-sea', 'i:la-gomera', 'c:europe', 'p:iberian-peninsula', 'p:european-plain', 'f:angel-falls', 'c:cape-horn'])
      expect(rows, id).toContain(id);
    expect(new Set(rows).size).toBe(rows.length);
    expect(physical.reduce((n, g) => n + g.rows.length, 0)).toBe(831);
    expect(row(physical, 'r:nile')).toMatchObject({ name: 'Nilo', also: ['Nile', 'Nilo Blanco', 'White Nile'] });
    expect(shown(physical.find((g) => g.key === 'p:river')!, 'r:nile', { auto: true, edits: { 'r:nile': { add: ['NL'] } } })).toEqual(['NL']);
    expect(await typeinGroups('regions', 'ZZ')).toEqual([]);
  });

  it('holds every id that can be typed in the game', async () => {
    const counts: Record<string, number> = {};
    for (const tab of TYPEIN_TABS) counts[tab] = (await typeinScopes(tab)).length;
    expect(counts).toEqual({ countries: 0, regions: 211, cities: 227, capitals: 122, physical: 0 });
    // Every division that is asked, at every level, is in the list of its country…
    const listed = new Set<string>();
    for (const c of await typeinScopes('regions')) for (const g of await typeinGroups('regions', c.id)) for (const r of g.rows) listed.add(r.id);
    const dir = path.join(process.cwd(), 'public/data/r');
    const asked = new Set<string>();
    const { byId } = await loadIndex();
    for (const f of fs.readdirSync(dir)) {
      const country = byId.get(f.slice(0, -5));
      if (!country || country.cl === 'other' || (country.lv[country.lv.length - 1]?.n ?? 0) < 2) continue;
      const topo = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as { objects: Record<string, { geometries: { id: string; properties: { q?: 0 } }[] }> };
      for (const level of country.lv) for (const g of topo.objects[level.k].geometries) if (g.properties.q !== 0) asked.add(String(g.id));
    }
    expect(asked.size).toBeGreaterThan(4000);
    expect([...asked].filter((id) => !listed.has(id))).toEqual([]);
    expect([...listed].filter((id) => !asked.has(id))).toEqual([]);
    // …and every city in that of its own.
    const cities = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/cities.json'), 'utf8')) as { c: Record<string, { i: string }[]> };
    let n = 0;
    for (const c of await typeinScopes('cities')) {
      const [group] = await typeinGroups('cities', c.id);
      expect(group.rows.map((r) => r.id).sort(), c.id).toEqual(cities.c[c.id].map((rec) => rec.i).sort());
      n += group.rows.length;
    }
    expect(n).toBe(4538);
  }, 60000);

  it('gives as examples initials that count', async () => {
    const lists: Record<keyof typeof SAMPLES, TypeinGroup[]> = {
      regions: await typeinGroups('regions', 'US'),
      regionCapitals: await typeinGroups('capitals', 'US'),
      countries: await typeinGroups('countries'),
      countryCapitals: await typeinGroups('capitals'),
      cities: await typeinGroups('cities', 'US'),
    };
    const names: Record<keyof typeof SAMPLES, string> = { regions: 'Nueva York', regionCapitals: 'Salt Lake City', countries: 'Nueva Zelanda', countryCapitals: 'Buenos Aires', cities: 'Nueva York' };
    for (const which of Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]) {
      const { id, key } = SAMPLES[which];
      const group = lists[which].find((g) => g.rows.some((r) => r.id === id));
      expect(group, which).toBeDefined();
      expect(row([group!], id).name, which).toBe(names[which]);
      const chip = chipViews(group!, AUTO)
        .get(id)!
        .find((c) => c.key === key);
      expect(chip, which).toMatchObject({ on: true, usual: true, from: 'initials' });
      expect(chip!.clash, which).toBeUndefined();
      // Switched off in the settings, it is the `off` that whoever gives the example looks for.
      expect(editOf(id, { auto: true, edits: switchForm({}, id, chip!, false) })?.off, which).toEqual([key]);
    }
  });

  it('finds the list a thing is in from its id', async () => {
    expect(await locateTypein('US-RI')).toEqual({ tab: 'regions', scope: 'US' });
    expect(await locateTypein('ES-CE')).toEqual({ tab: 'regions', scope: 'ES' });
    // The Dutch Caribbean goes by Dutch ids in a list of its own.
    expect(await locateTypein('NL-BQ1')).toEqual({ tab: 'regions', scope: 'BQ' });
    expect(await locateTypein('ES')).toEqual({ tab: 'countries', scope: '' });
    expect(await locateTypein('cap:ES')).toEqual({ tab: 'capitals', scope: '' });
    expect(await locateTypein('cap:US-UT')).toEqual({ tab: 'capitals', scope: 'US' });
    expect(await locateTypein('r:nile')).toEqual({ tab: 'physical', scope: '' });
    const [cities] = await typeinGroups('cities', 'ES');
    expect(await locateTypein(cities.rows[0].id)).toEqual({ tab: 'cities', scope: 'ES' });
    for (const gone of ['XX-NOPE', 'cap:XX-NOPE', 'zzzz']) expect(await locateTypein(gone), gone).toBeNull();
    expect(SETTINGS_PATH).toBe('configuracion');
    expect(settingsLink('regions', 'US')).toBe('#/configuracion/regiones/US');
    expect(settingsLink('capitals')).toBe('#/configuracion/capitales');
  });
});
