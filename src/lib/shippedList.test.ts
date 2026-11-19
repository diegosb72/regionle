// The list the game ships with: the type-ins of a JetPunk quiz for the regions it covers, a short list
// written by hand for countries, cities and capitals, and the game as it plays with them. Nothing is mocked
// here: this is the file of the game and the data of the game.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, loadIndex, setLoader } from './data';
import { buildCityDeck } from './extra';
import { Matcher } from './matcher';
import { looksLikePattern, patternOf, type Answerable } from './text';
import { SAMPLES, chipViews, typeinGroups } from './typeinList';
import { SHIPPED, SHIPPED_AUTO, capitalAnswers, chipsOf, editOf, formKey, getTypeins, inForce, readTypeinFile, ruleOf, switchForm, typeinFile } from './typeins';
import type { Deck } from './types';

const ROOT = process.cwd();

beforeAll(() => {
  setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data', p), 'utf8')));
});

const regions = (country: string, level = 'f') => buildDeck({ scope: 'regions', countries: [country], levels: { [country]: level } });
const matcher = async (country: string, level = 'f') => new Matcher((await regions(country, level)).items);

describe('the file the game ships with', () => {
  it('is the one the script writes from the list', () => {
    expect(execFileSync('node', ['scripts/typeins/build.mjs', '--check'], { cwd: ROOT, encoding: 'utf8' })).toContain('up to date');
  });

  it('speaks only of pieces of the game, in forms the game can read', async () => {
    const { index } = await loadIndex();
    const ids = new Set<string>();
    for (const c of index.countries) {
      const file = path.join(ROOT, 'public/data/r', `${c.id}.json`);
      if (!fs.existsSync(file)) continue;
      const topo = JSON.parse(fs.readFileSync(file, 'utf8')) as { objects: Record<string, { geometries: { id: string }[] }> };
      for (const o of Object.values(topo.objects)) for (const g of o.geometries) ids.add(g.id);
    }
    // …and of countries, of cities, and of capitals: those of the countries and those of the regions.
    const regionIds = new Set(ids);
    const cities = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/cities.json'), 'utf8')) as { c: Record<string, { i: string }[]> };
    const capitals = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/capitals.json'), 'utf8')) as { rc: Record<string, Record<string, Record<string, string[]>>> };
    for (const c of index.countries) {
      ids.add(c.id);
      if (c.cap) ids.add(`cap:${c.id}`);
    }
    for (const list of Object.values(cities.c)) for (const x of list) ids.add(x.i);
    for (const levels of Object.values(capitals.rc)) for (const table of Object.values(levels)) for (const unit of Object.keys(table)) ids.add(`cap:${unit}`);
    let patterns = 0;
    let spellings = 0;
    let plain = 0;
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/lib/typeins.default.json'), 'utf8')) as { edits: Record<string, { add?: string[]; off?: string[]; rule?: boolean }> };
    // Nothing in the file is dropped or rewritten on the way in.
    expect(SHIPPED).toEqual(raw.edits);
    expect(SHIPPED_AUTO).toBe(true);
    for (const [id, e] of Object.entries(SHIPPED)) {
      expect(ids.has(id), id).toBe(true);
      expect(e.off, id).toBeUndefined();
      // Only a region of the list goes without the initials of its name: what is written by hand for the
      // rest is added to them.
      if (!regionIds.has(id)) expect(e.rule, id).toBeUndefined();
      if (e.rule === false) plain++;
      const seen = new Set<string>();
      for (const form of e.add ?? []) {
        const k = formKey(form);
        expect(k, `${id}: ${form}`).not.toBe('');
        expect(seen.has(k), `${id}: ${form} twice`).toBe(false);
        seen.add(k);
        if (looksLikePattern(form)) {
          patterns++;
          expect(patternOf(form), `${id}: ${form}`).toBe(form);
          // No repeated group that repeats inside, the shape that makes an expression take for ever.
          expect(/\([^()]*[+*][^()]*\)[+*{]|\([^()]*\|[^()]*\)[+*{]/.test(form), `${id}: ${form}`).toBe(false);
        } else spellings++;
      }
    }
    expect(Object.keys(SHIPPED).length).toBeGreaterThan(2000);
    expect(patterns).toBeGreaterThan(2000);
    expect(spellings).toBeGreaterThan(350);
    expect(plain).toBeGreaterThan(1000);
    // A file of the settings, like any other: it reads back as nothing chosen.
    expect(typeinFile(getTypeins()).edits).toEqual(SHIPPED);
    expect(readTypeinFile(typeinFile(getTypeins()))).toEqual({ edits: {}, auto: true });
  });

  it('gives every piece a list that takes its own names, and no spelling that is a name already', async () => {
    const { index } = await loadIndex();
    let pieces = 0;
    for (const c of index.countries)
      for (const lv of c.lv) {
        let deck: Deck;
        try {
          deck = await buildDeck({ scope: 'regions', countries: [c.id], levels: { [c.id]: lv.k } });
        } catch {
          continue;
        }
        const m = new Matcher(deck.items);
        for (const it of deck.items) {
          const e = SHIPPED[it.id];
          if (!e) continue;
          pieces++;
          expect(it.short, it.id).toEqual(editOf(it.id));
          // Its names are still its names, whatever the patterns of its neighbours take.
          for (const name of it.answers.filter(Boolean)) expect(m.lookup(name), `${c.id} ${lv.k}: ${name}`).toContain(it.id);
          const bare = new Matcher([{ ...it, short: undefined }]);
          for (const form of e.add ?? []) {
            if (looksLikePattern(form)) continue;
            // The initials that the list keeps apart ("NH"): the rule would give them, and here it does not.
            if (bare.abbreviates(form)) continue;
            expect(bare.lookup(form), `${it.id}: ${form} is one of its names`).toEqual([]);
            expect(m.lookup(form), `${it.id}: ${form}`).toContain(it.id);
          }
        }
      }
    expect(pieces).toBeGreaterThan(2000);
  }, 60_000);

  it('lets the name of a piece name the pieces called so, and no other but the few the list means', async () => {
    const { index } = await loadIndex();
    const also = new Set<string>();
    for (const c of index.countries)
      for (const lv of c.lv) {
        let deck: Deck;
        try {
          deck = await buildDeck({ scope: 'regions', countries: [c.id], levels: { [c.id]: lv.k } });
        } catch {
          continue;
        }
        const m = new Matcher(deck.items);
        const plain = new Matcher(deck.items.map((x) => ({ ...x, short: undefined })));
        for (const it of deck.items)
          for (const name of it.answers.filter(Boolean)) {
            const was = new Set(plain.lookup(name));
            for (const id of m.lookup(name)) if (!was.has(id)) also.add(`${name} (${it.id}) → ${id}`);
          }
      }
    // The author of the list has each of these answer to the name of the other, on purpose: the capital and
    // the province around it, the city and its oblast, a town once called like the next one.
    expect([...also].sort()).toEqual(['Distrito Nacional (DO-01) → DO-32', 'Moskva (RU-MOW) → RU-MOS', 'Santo Domingo (DO-32) → DO-01', 'Videm (SI-135) → SI-116']);
  }, 60_000);
});

describe('the game as it ships', () => {
  it('takes NH and NJ in the United States, and not RI, nor the initials nobody uses', async () => {
    const m = await matcher('US');
    for (const [k, id] of Object.entries({ nh: 'US-NH', nj: 'US-NJ', nm: 'US-NM', ny: 'US-NY', nc: 'US-NC', sc: 'US-SC', nd: 'US-ND', sd: 'US-SD', wv: 'US-WV', dc: 'US-DC', 'N.H.': 'US-NH' })) expect(m.lookup(k), k).toEqual([id]);
    // Rhode Island by its name alone, as asked; a name of one word, never by a code.
    for (const k of ['ri', 'ma', 'tx', 'ca', 'fl', 'pa']) expect(m.lookup(k), k).toEqual([]);
    // What the rule spelt out of the Spanish names, and of "Washington D. C.".
    for (const k of ['cn', 'cdn', 'cs', 'cds', 'dn', 'ddn', 'ds', 'dds', 'vo', 'wdc', 'doc']) {
      expect(m.lookup(k), k).toEqual([]);
      expect(m.vague(k), k).toBe(false);
    }
    expect(m.lookup('district of columbea')).toEqual(['US-DC']);
    expect(m.lookup('nuevo hampshire')).toEqual(['US-NH']);
    expect(m.lookup('rhode island')).toEqual(['US-RI']);
    expect(m.check('nh', 'US-NH', { whole: true })).toEqual({ res: 'short' });
    // In the settings RI shows switched off, and is the player's to switch on.
    const deck = await regions('US');
    const chips = (id: string) => chipsOf(deck.byId.get(id)!, id).map((c) => `${c.text}:${c.from}:${c.on ? 'on' : 'off'}`);
    expect(chips('US-RI')).toEqual(['RI:initials:off']);
    expect(chips('US-NH')).toEqual(['NH:initials:on']);
    expect(chips('US-NC')).toEqual(['CN:initials:off', 'CDN:initials:off', 'NC:initials:on']);
    expect(chips('US-MA')).toEqual([]);
    const edits = switchForm({}, 'US-RI', chipsOf(deck.byId.get('US-RI')!, 'US-RI')[0], true);
    expect(edits).toEqual({ 'US-RI': { add: ['RI'] } });
    expect(new Matcher([{ ...deck.byId.get('US-RI')!, short: editOf('US-RI', { auto: true, edits }) }]).lookup('ri')).toEqual(['US-RI']);
  });

  it('takes in Canada and Australia what the list says', async () => {
    const ca = await matcher('CA');
    for (const [k, id] of Object.entries({
      bc: 'CA-BC',
      pei: 'CA-PE',
      ipe: 'CA-PE',
      newfoundland: 'CA-NL',
      labrador: 'CA-NL',
      'terre-neuve': 'CA-NL',
      'nouvelle écosse': 'CA-NS',
      'nouveau brunswick': 'CA-NB',
      'île du prince édouard': 'CA-PE',
      'colombie britannique': 'CA-BC',
      // Written among its names in the data, not by the rule.
      nwt: 'CA-NT',
    }))
      expect(ca.lookup(k), k).toEqual([id]);
    expect(ca.find('the northwest')).toEqual(['CA-NT']);
    for (const k of ['nb', 'nl', 'ns', 'nt', 'cb', 'tl', 'tyl', 'ne', 'tn', 'idpe']) expect(ca.lookup(k), k).toEqual([]);
    const au = await matcher('AU');
    for (const [k, id] of Object.entries({ act: 'AU-ACT', canberra: 'AU-ACT', capital: 'AU-ACT', south: 'AU-SA', west: 'AU-WA', north: 'AU-NT', 'the north': 'AU-NT' })) expect(au.lookup(k), k).toEqual([id]);
    for (const k of ['nsw', 'nt', 'sa', 'wa', 'am', 'ao', 'tca']) expect(au.lookup(k), k).toEqual([]);
    expect(au.lookup('new south wales')).toEqual(['AU-NSW']);
    expect(au.lookup('australia meridional')).toEqual(['AU-SA']);
    // Taken as it is typed where nothing could be going on from it, and with Enter where a name does.
    const open = new Set((await regions('AU')).items.map((it) => it.id));
    expect(au.typed('capital', open)).toEqual({ ids: ['AU-ACT'], wait: false });
    expect(au.typed('south', open)).toEqual({ ids: ['AU-SA'], wait: true });
    expect(au.typed('west', open)).toEqual({ ids: ['AU-WA'], wait: true });
  });

  it('takes the names Spain goes by, and no initials of the communities', async () => {
    const es = await matcher('ES', 'g1');
    for (const [k, id] of Object.entries({
      mancha: 'ES-CM',
      'la mancha': 'ES-CM',
      'castilla la mancha': 'ES-CM',
      leon: 'ES-CL',
      'castilla y leon': 'ES-CL',
      'castile and leon': 'ES-CL',
      vasco: 'ES-PV',
      'pais vasco': 'ES-PV',
      euskadi: 'ES-PV',
      'basque country': 'ES-PV',
      rioja: 'ES-RI',
      catalunya: 'ES-CT',
      catalonia: 'ES-CT',
      galiza: 'ES-GA',
      balears: 'ES-IB',
      baleares: 'ES-IB',
      'las islas baleares': 'ES-IB',
      canarias: 'ES-CN',
      'canary islands': 'ES-CN',
      estremadura: 'ES-EX',
      nafarroa: 'ES-NC',
      navarra: 'ES-NC',
      valencia: 'ES-VC',
      aragó: 'ES-AR',
      madrid: 'ES-MD',
    }))
      expect(es.lookup(k), k).toEqual([id]);
    for (const k of ['cyl', 'cl', 'clm', 'lr', 'ib', 'pv', 'cv', 'rm', 'cdm']) expect(es.lookup(k), k).toEqual([]);
    expect(es.check('mancha', 'ES-CM')).toEqual({ res: 'yes' });
    expect(es.check('mancha', 'ES-CM', { whole: true })).toEqual({ res: 'short' });
    expect(es.check('castilla-la mancha', 'ES-CM', { whole: true })).toEqual({ res: 'yes' });
    expect(es.check('leon', 'ES-CM')).toEqual({ res: 'other', id: 'ES-CL' });
    const open = new Set((await regions('ES', 'g1')).items.map((it) => it.id));
    expect(es.typed('mancha', open)).toEqual({ ids: ['ES-CM'], wait: false });
    // "Vascongadas" goes on from it: with Enter, or by going on.
    expect(es.typed('vasco', open)).toEqual({ ids: ['ES-PV'], wait: true });
    expect(es.typed('leon', open)).toEqual({ ids: ['ES-CL'], wait: false });
    expect(es.typed('castilla', open)).toEqual({ ids: [], wait: false });
    // The provinces that go by the name of their community take the same.
    const provinces = await matcher('ES');
    expect(provinces.lookup('rioja')).toEqual(['ES-LO']);
    expect(provinces.lookup('balears')).toEqual(['ES-PM']);
  });

  it('leaves as it was what the list does not speak of', async () => {
    // A province no answer of the list is called after keeps the initials of its name.
    const provinces = await matcher('ES');
    expect(SHIPPED['ES-GC']).toBeUndefined();
    expect(ruleOf('ES-GC')).toBe(true);
    expect(provinces.lookup('lp')).toEqual(['ES-GC']);
    expect(provinces.lookup('sct')).toEqual(['ES-TF']);
    // Countries, cities and capitals keep the initials of their names, whatever is written for some of them.
    const { index } = await loadIndex();
    const world = new Matcher((await buildDeck({ scope: 'countries', countries: index.countries.filter((c) => c.cl === 'un').map((c) => c.id) })).items);
    for (const [k, id] of Object.entries({ nz: 'NZ', uk: 'GB', eeuu: 'US', png: 'PG', rd: 'DO' })) expect(world.lookup(k), k).toEqual([id]);
    const cities = new Matcher((await buildCityDeck(['US'], 'top', 50)).items);
    expect(cities.lookup('ny')).toHaveLength(1);
    expect(cities.lookup('la')).toHaveLength(1);
    const states = await regions('US');
    const capitals = new Matcher(
      states.items.map((it) => capitalAnswers(it)).filter((a): a is Answerable => !!a),
      { codes: false },
    );
    expect(capitals.lookup('slc')).toEqual(['US-UT']);
    // The examples given where a game offers typing still stand.
    for (const [what, s] of Object.entries(SAMPLES)) expect(inForce(s.id, s.key), what).toBe(true);
  });

  it('takes for countries, cities and capitals the short forms in everyday use that no initials spell', async () => {
    const { index } = await loadIndex();
    const world = new Matcher((await buildDeck({ scope: 'countries', countries: index.countries.filter((c) => c.cl === 'un').map((c) => c.id) })).items);
    for (const [k, id] of Object.entries({ eua: 'US', rsa: 'ZA', ksa: 'SA', bih: 'BA', norcorea: 'KP', surcorea: 'KR', timor: 'TL', rfa: 'DE' })) expect(world.lookup(k), k).toEqual([id]);
    // They are added to what the rule gives: the country keeps the initials of its name.
    expect(SHIPPED.US).toEqual({ add: ['EUA'] });
    expect(ruleOf('US')).toBe(true);

    const us = await buildCityDeck(['US'], 'top', 100);
    const named = (deck: Deck, text: string, items = deck.items) => new Matcher(items).lookup(text).map((id) => deck.byId.get(id)!.name);
    // «SF» was nothing: they are the initials of Sioux Falls as well, and initials that two cities spell
    // name neither. Written down for San Francisco, they are San Francisco.
    expect(named(us, 'sf', us.items.map((it) => ({ ...it, short: undefined })))).toEqual([]);
    expect(named(us, 'sf')).toEqual(['San Francisco']);
    expect(named(us, 'dc')).toEqual(['Washington D. C.']);
    expect(named(us, 'philly')).toEqual(['Filadelfia']);
    const es = await buildCityDeck(['ES'], 'top', 100);
    for (const [k, city] of Object.entries({ bcn: 'Barcelona', barna: 'Barcelona', zgz: 'Zaragoza', donosti: 'San Sebastián', gasteiz: 'Vitoria', lpgc: 'Las Palmas de Gran Canaria' })) expect(named(es, k), k).toEqual([city]);
    expect(named(await buildCityDeck(['MX'], 'top', 100), 'cdmx')).toEqual(['Ciudad de México']);
    expect(named(await buildCityDeck(['MY'], 'top', 100), 'kl')).toEqual(['Kuala Lumpur']);

    // A city hands them on to the capital it is: that of its country and that of each region.
    const capitalsOf = (deck: Deck) => new Matcher(deck.items.map((it) => capitalAnswers(it)).filter((a): a is Answerable => !!a), { codes: false });
    const nations = capitalsOf(await buildDeck({ scope: 'countries', countries: ['US', 'AR', 'MX', 'TH', 'GB'] }));
    for (const [k, id] of Object.entries({ dc: 'US', bsas: 'AR', df: 'MX', bkk: 'TH', ldn: 'GB' })) expect(nations.lookup(k), k).toEqual([id]);
    const communities = capitalsOf(await regions('ES', 'g1'));
    expect(communities.lookup('bcn')).toEqual(['ES-CT']);
    expect(communities.lookup('zgz')).toEqual(['ES-AR']);
    expect(capitalsOf(await regions('ES')).lookup('bcn')).toEqual(['ES-B']);
    // Where the capital went by the form already, it is one of its names and nothing is added: «CDMX».
    expect(SHIPPED['cap:MX']).toEqual({ add: ['DF'] });

    // In the settings each is a form like any other of the game, there to be switched off.
    const barcelona = es.items.find((it) => it.name === 'Barcelona')!;
    expect(chipsOf(barcelona, barcelona.id).map((c) => `${c.text}:${c.from}:${c.on ? 'on' : 'off'}`)).toEqual(['BCN:data:on', 'Barna:data:on']);
    const edits = switchForm({}, barcelona.id, chipsOf(barcelona, barcelona.id)[0], false);
    expect(edits).toEqual({ [barcelona.id]: { off: ['bcn'] } });
    expect(new Matcher([{ ...barcelona, short: editOf(barcelona.id, { auto: true, edits }) }]).lookup('bcn')).toEqual([]);
    expect(new Matcher([{ ...barcelona, short: editOf(barcelona.id, { auto: true, edits }) }]).lookup('barna')).toEqual([barcelona.id]);
  });

  it('shows the list in the settings, each form to be switched off', async () => {
    const [groups] = [await typeinGroups('regions', 'AU')];
    const group = groups[0];
    const view = chipViews(group, getTypeins());
    const chips = (id: string) => view.get(id)!.map((c) => `${c.text}:${c.from}:${c.on ? 'on' : 'off'}${c.pattern ? ':pattern' : ''}${c.clash ? ':clash' : ''}`);
    expect(chips('AU-ACT')).toEqual(['TCA:initials:off', 'TDLCA:initials:off', 'TDCA:initials:off', 'ACT:data:on', 'r:CAPITAL:data:on:pattern']);
    expect(chips('AU-NSW')).toEqual(['NGS:initials:off', 'NGDS:initials:off', 'NSW:initials:off']);
    expect(chips('AU-SA')).toEqual(['AM:initials:off', 'SA:initials:off', 'SOUTH:data:on']);
    expect(chips('AU-NT')).toEqual(['TN:initials:off', 'TDN:initials:off', 'NT:initials:off', 'r:^(THE)?NORTH:data:on:pattern']);
    expect(chips('AU-QLD')).toEqual([]);
    // Switched off there, the pattern is gone from the game.
    const row = group.rows.find((r) => r.id === 'AU-NT')!;
    const edits = switchForm({}, 'AU-NT', view.get('AU-NT')!.find((c) => c.pattern)!, false);
    expect(edits).toEqual({ 'AU-NT': { off: ['r:^(THE)?NORTH'] } });
    expect(new Matcher([{ ...row.item, short: editOf('AU-NT', { auto: true, edits }) }]).lookup('north')).toEqual([]);
    expect(new Matcher([{ ...row.item, short: editOf('AU-NT') }]).lookup('north')).toEqual(['AU-NT']);
  });
});
