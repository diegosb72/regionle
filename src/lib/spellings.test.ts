// What a pattern takes, written out: the settings show it instead of the pattern, so it has to be what the
// game takes. The second half is the list the game ships with on the data of the game, nothing mocked.

import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { setLoader } from './data';
import { spellingsOf } from './spellings';
import { Matcher } from './matcher';
import { patternTakes } from './text';
import { chipViews, typeinGroups, typeinScopes, type ChipView, type TypeinGroup } from './typeinList';
import { SHIPPED, editOf, switchForm, type TypeinSettings } from './typeins';

const forms = (pattern: string, names: string[] = []) => spellingsOf(pattern, names)?.forms;

describe('the spellings of a pattern', () => {
  it('are the ways of writing Galicia, and not the pattern', () => {
    expect(spellingsOf('r:^GALI[CZ]I?A', ['Galicia', 'Galiza'])).toEqual({ forms: ['GALICIA', 'GALIZA', 'GALICA', 'GALIZIA'], more: false });
    // Without its names they are the same ones, the shortest first.
    expect(forms('r:^GALI[CZ]I?A')).toEqual(['GALICA', 'GALIZA', 'GALICIA', 'GALIZIA']);
  });

  it('read each sign of a pattern the way the game does', () => {
    expect(forms('r:^C(EU|UE)TA')).toEqual(['CEUTA', 'CUETA']);
    expect(forms('r:^(LA)?RIOJA')).toEqual(['RIOJA', 'LARIOJA']);
    expect(forms('r:^(?:A|B)C')).toEqual(['AC', 'BC']);
    expect(forms('r:^A|B')).toEqual(['A', 'B']);
    expect(forms('r:^A$')).toEqual(['A']);
    expect(forms('r:^A[0-9]')).toEqual(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8', 'A9']);
    expect(forms('r:^(A|B)(C|D)?E')).toEqual(['AE', 'BE', 'ACE', 'ADE', 'BCE', 'BDE']);
    expect(forms('r:^A{3}')).toEqual(['AAA']);
    expect(forms('r:^[CK]AMPONGSP([EOU]{2})')).toHaveLength(18);
    // The letters of a "c:" pattern are what has to be there.
    expect(spellingsOf('c:ohio')).toEqual({ forms: ['OHIO'], more: false });
    expect(forms('C: Oh Io')).toEqual(['OHIO']);
    // A letter nobody can type takes nothing: what is typed reaches a pattern without accents.
    expect(forms('r:^CAOB[AẰ]NG')).toEqual(['CAOBANG']);
  });

  it('write a letter that may be repeated once and twice, and one that may be missing, also not at all', () => {
    expect(forms('r:HIG+INS')).toEqual(['HIGINS', 'HIGGINS']);
    expect(forms('r:^AB*C')).toEqual(['AC', 'ABC', 'ABBC']);
    expect(forms('r:^AB{2,3}C')).toEqual(['ABBC', 'ABBBC']);
    expect(spellingsOf('r:^AB{2,9}C')).toEqual({ forms: ['ABBC', 'ABBBC', 'ABBBBC'], more: true });
  });

  it('say where any letters will do, rather than list them', () => {
    expect(forms('r:^A.C')).toEqual(['A…C']);
    expect(forms('r:^A.*C')).toEqual(['AC', 'A…C']);
    expect(forms('r:^BA[HJ]A[A-Z]*SUR', ['Baja California Sur'])).toEqual(['BAJASUR', 'BAJACALIFORNIASUR', 'BAHASUR', 'BAJA…SUR', 'BAHA…SUR']);
  });

  it('begin with what a person would write of the names of the thing', () => {
    const mancha = forms('r:^(CASTIL+[AE])?(Y|AND)?(LA)?MANCHA', ['Castilla-La Mancha', 'Castile-La Mancha'])!;
    expect(mancha).toHaveLength(30);
    expect(mancha.slice(0, 6)).toEqual(['MANCHA', 'LAMANCHA', 'CASTILLAMANCHA', 'CASTILLALAMANCHA', 'CASTILEMANCHA', 'CASTILELAMANCHA']);
    // Left to the pattern, what nobody writes comes first.
    expect(forms('r:^(CASTIL+[AE])?(Y|AND)?(LA)?MANCHA')!.slice(0, 2)).toEqual(['MANCHA', 'YMANCHA']);
    // The name on show decides which of two comes first.
    expect(forms('r:^SHA+NXI', ['Shaanxi'])).toEqual(['SHAANXI', 'SHANXI']);
    expect(forms('r:^SHA+NXI', ['Shanxi'])).toEqual(['SHANXI', 'SHAANXI']);
    expect(forms('r:HIG+INS', ["O'Higgins"])).toEqual(['HIGGINS', 'HIGINS']);
  });

  it('stop where the pattern stops, before the name does', () => {
    expect(forms('r:^RA[SK]', ['Ras al-Jaima', 'Ras al-Khaimah'])).toEqual(['RAS', 'RAK']);
    expect(forms('r:^(SAINT|SANKT|ST|SAN)GAL[EL]', ['San Galo', 'St. Gallen', 'Sankt Gallen'])).toEqual(['STGALL', 'SAINTGALL', 'SANKTGALL', 'STGALE', 'SAINTGALE', 'SANKTGALE', 'SANGALL', 'SANGALE']);
  });

  it('are cut short when they are too many, and say so', () => {
    const loose = spellingsOf('r:^[AEIOU]+[BCDFG]+[AEIOU]+[BCDFG]+')!;
    expect(loose.more).toBe(true);
    expect(loose.forms).toHaveLength(240);
    expect(loose.forms[0]).toBe('ABAB');
    for (const f of loose.forms) expect(patternTakes('r:^[AEIOU]+[BCDFG]+[AEIOU]+[BCDFG]+', f.toLowerCase()), f).toBe(true);
    // What takes for ever in an expression takes no time here.
    const t0 = performance.now();
    expect(spellingsOf('r:^(A|B|C|D|E|F)(A|B|C|D|E|F)?(A|B|C|D|E|F)?(A|B|C|D|E|F)?(A|B|C|D|E|F)?(A|B|C|D|E|F)?(A|B|C|D|E|F)?')!.more).toBe(true);
    expect(performance.now() - t0).toBeLessThan(500);
  });

  it('are not given for what is no pattern, nor for signs they cannot be read from', () => {
    expect(spellingsOf('GAL')).toBeNull();
    expect(spellingsOf('r:')).toBeNull();
    expect(spellingsOf('r:^(AB')).toBeNull();
    expect(spellingsOf('r:^X\\d+')).toBeNull();
    expect(spellingsOf('r:^[^A]B')).toBeNull();
    expect(spellingsOf('r:^(?=A)AB')).toBeNull();
    // A pattern that nothing typed can meet has no spellings either.
    expect(spellingsOf('r:^$')).toBeNull();
    expect(spellingsOf('r:^A-B')).toBeNull();
  });
});

describe('the patterns the game ships with, as the settings show them', () => {
  const ROOT = process.cwd();
  const settings: TypeinSettings = { auto: true, edits: {} };
  /** Every list of regions, with what each row shows. */
  const lists: { group: TypeinGroup; views: Map<string, ChipView[]> }[] = [];

  beforeAll(async () => {
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data', p), 'utf8')));
    for (const c of await typeinScopes('regions')) for (const group of await typeinGroups('regions', c.id)) lists.push({ group, views: chipViews(group, settings) });
  }, 120000);

  const chipsOf = (id: string): ChipView[] => lists.find((l) => l.views.has(id))!.views.get(id)!;

  it('are all spelt out: no row is left with a pattern to read', () => {
    let patterns = 0;
    let cut = 0;
    for (const { group, views } of lists) {
      for (const r of group.rows) {
        for (const c of views.get(r.id)!) {
          if (!c.pattern) {
            expect(c.spelt, `${r.id}: ${c.text}`).toBeUndefined();
            continue;
          }
          patterns++;
          expect(c.spelt, `${r.id}: ${c.text}`).toBeDefined();
          const { forms: list, more } = c.spelt!;
          if (more) cut++;
          expect(list.length, `${r.id}: ${c.text}`).toBeGreaterThan(0);
          expect(list.length, `${r.id}: ${c.text}`).toBeLessThanOrEqual(260);
          expect(new Set(list).size, `${r.id}: ${c.text}`).toBe(list.length);
          for (const f of list) {
            // Capitals and digits, as the other short forms are shown, and "…" for any letters.
            expect(f, `${r.id}: ${c.text}`).toMatch(/^[A-Z0-9…]+$/);
            // Each one is taken by its pattern, to the last letter.
            expect(patternTakes(c.text, f.toLowerCase().replace(/…/g, 'xyz')), `${r.id}: ${c.text} does not take ${f}`).toBe(true);
          }
        }
      }
    }
    // Every pattern of the list is on some row. Two things with one pattern are two rows.
    const shipped = Object.values(SHIPPED).reduce((n, e) => n + (e.add ?? []).filter((a) => /^[rc]:/.test(a)).length, 0);
    expect(shipped).toBeGreaterThan(2000);
    expect(patterns).toBeGreaterThan(2000);
    expect(patterns).toBeGreaterThanOrEqual(shipped - 10);
    // Few are so loose that they are cut short.
    expect(cut).toBeLessThan(patterns / 10);
  });

  // Every pattern against every name it could show: three seconds on a quiet machine, and more on a busy one.
  it('show only what the game takes for the thing on its map', { timeout: 30_000 }, () => {
    let shown = 0;
    let lost = 0;
    for (const { group, views } of lists) {
      const matcher = new Matcher(
        group.rows.map((r) => ({ ...r.item, short: editOf(r.id, settings) })),
        { codes: group.codes },
      );
      for (const r of group.rows) {
        for (const c of views.get(r.id)!) {
          if (!c.spelt) continue;
          lost += c.lost?.length ?? 0;
          expect(c.clash, `${r.id}: ${c.text}`).toBeUndefined();
          for (const f of c.spelt.forms) {
            if (f.includes('…')) continue;
            shown++;
            expect(matcher.lookup(f), `${r.id}: ${f}`).toContain(r.item.id);
          }
          // What is left out is something else there, by name.
          for (const f of c.lost ?? []) expect(matcher.lookup(f), `${r.id}: ${f}`).not.toContain(r.item.id);
        }
      }
    }
    expect(shown).toBeGreaterThan(50000);
    // A handful in the whole list: "SHANXI" for Shaanxi, "RIBNICA" for Ribnica na Pohorju.
    expect(lost).toBeGreaterThan(10);
    expect(lost).toBeLessThan(60);
  });

  it('show Galicia, the two Castiles and the rest of Spain by their spellings', () => {
    const spelt = (id: string) => chipsOf(id).find((c) => c.pattern)!.spelt!;
    expect(spelt('ES-GA')).toEqual({ forms: ['GALICIA', 'GALIZA', 'GALICA', 'GALIZIA'], more: false });
    expect(spelt('ES-CM').forms.slice(0, 4)).toEqual(['MANCHA', 'LAMANCHA', 'CASTILLAMANCHA', 'CASTILLALAMANCHA']);
    expect(spelt('ES-CM').forms).toHaveLength(30);
    expect(spelt('ES-CL').forms.slice(0, 4)).toEqual(['LEON', 'YLEON', 'CASTILLALEON', 'CASTILLAYLEON']);
    expect(spelt('ES-RI').forms).toEqual(['RIOJA', 'LARIOJA']);
    expect(spelt('ES-CE').forms).toEqual(['CEUTA', 'CUETA']);
    // A spelling among the short forms is still a spelling.
    expect(chipsOf('ES-CE').find((c) => c.key === 'sabtah')).toMatchObject({ text: 'SABTAH', on: true });
    expect(chipsOf('ES-CE').find((c) => c.key === 'sabtah')!.spelt).toBeUndefined();
  });

  it('leave out the spelling that is another thing on the map, with the pattern on or off', () => {
    const china = lists.find((l) => l.views.has('CN-SN'))!;
    const shaanxi = china.views.get('CN-SN')!.find((c) => c.pattern)!;
    const shanxi = china.views.get('CN-SX')!.find((c) => c.pattern)!;
    // The two provinces come with one pattern: each shows the spelling that is its own.
    expect(shaanxi.text).toBe(shanxi.text);
    expect(shaanxi).toMatchObject({ on: true, spelt: { forms: ['SHAANXI'], more: false }, lost: ['SHANXI'] });
    expect(shanxi).toMatchObject({ on: true, spelt: { forms: ['SHANXI'], more: false }, lost: ['SHAANXI'] });

    const off: TypeinSettings = { auto: true, edits: switchForm({}, 'CN-SN', shaanxi, false) };
    const after = chipViews(china.group, off).get('CN-SN')!.find((c) => c.pattern)!;
    expect(after).toMatchObject({ on: false, spelt: { forms: ['SHAANXI'], more: false }, lost: ['SHANXI'] });
  });

  it('say so when all a pattern takes is something else there', () => {
    const spain = lists.find((l) => l.views.has('ES-GA'))!;
    // A pattern for Galicia that takes the name of Aragon, and nothing else.
    const mine = chipViews(spain.group, { auto: true, edits: { 'ES-GA': { add: ['r:^ARAGON'] } } })
      .get('ES-GA')!
      .find((c) => c.from === 'own')!;
    expect(mine).toMatchObject({ on: true, spelt: { forms: ['ARAGON'], more: false }, lost: ['ARAGON'], clash: ['Aragón'], taken: false });
    // And nothing of the sort while a pattern keeps a spelling: "La Rioja" given to Aragon leaves "Rioja" to La Rioja.
    const rioja = chipViews(spain.group, { auto: true, edits: { 'ES-AR': { add: ['LARIOJA'] } } })
      .get('ES-RI')!
      .find((c) => c.pattern)!;
    expect(rioja).toMatchObject({ on: true, spelt: { forms: ['RIOJA'], more: false }, lost: ['LARIOJA'] });
    expect(rioja.clash).toBeUndefined();
  });

  it('spell out a pattern that the player adds, and leave as written one that cannot be', () => {
    const spain = lists.find((l) => l.views.has('ES-GA'))!;
    const views = chipViews(spain.group, { auto: true, edits: { 'ES-GA': { add: ['r:^GALL?EGOS?', 'r:^X\\d+'] } } }).get('ES-GA')!;
    const mine = views.filter((c) => c.from === 'own');
    expect(mine.map((c) => c.text)).toEqual(['r:^GALL?EGOS?', 'r:^X\\d+']);
    expect(mine[0].spelt).toEqual({ forms: ['GALEGO', 'GALEGOS', 'GALLEGO', 'GALLEGOS'], more: false });
    expect(mine[1].spelt).toBeUndefined();
  });

  it('take no longer than a tap should', () => {
    // The longest list is Slovenia's. The first time the spellings are made; after that they are kept.
    const slovenia = lists.filter((l) => l.group.rows.some((r) => r.id.startsWith('SI-')));
    expect(slovenia.length).toBeGreaterThan(0);
    const t0 = performance.now();
    for (const { group } of slovenia) chipViews(group, settings);
    expect(performance.now() - t0).toBeLessThan(400);
  });
});
