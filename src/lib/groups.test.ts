import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ARAB_LEAGUE, BRICS, EU, EUROZONE, G20, MEDITERRANEAN, MICRO_KM2, MORE_SHORTCUTS, NATO, PORTUGUESE, SCHENGEN, SHORTCUTS, SPANISH, USSR, YUGOSLAVIA } from './groups';
import { setLang } from './i18n';
import type { Country, Index } from './types';

const index = JSON.parse(fs.readFileSync(path.join(__dirname, '../../public/data/index.json'), 'utf8')) as Index;
const byId = new Map(index.countries.map((c) => [c.id, c]));
const pool = index.countries.filter((c) => c.cl !== 'other');
const pick = (id: string): string[] => [...SHORTCUTS, ...MORE_SHORTCUTS].find((s) => s.id === id)!.pick(pool);
const names = (ids: string[]) => ids.map((id) => byId.get(id)?.n.es ?? id).sort();

describe('groups of countries', () => {
  const LISTS: [string, string[], number][] = [
    ['EU', EU, 27],
    ['SPANISH', SPANISH, 21],
    ['G20', G20, 19],
    ['NATO', NATO, 32],
    ['SCHENGEN', SCHENGEN, 29],
    ['EUROZONE', EUROZONE, 21],
    ['BRICS', BRICS, 10],
    ['ARAB_LEAGUE', ARAB_LEAGUE, 22],
    ['USSR', USSR, 15],
    ['YUGOSLAVIA', YUGOSLAVIA, 7],
    ['PORTUGUESE', PORTUGUESE, 9],
    ['MEDITERRANEAN', MEDITERRANEAN, 22],
  ];

  it('are made of countries the game has, each once', () => {
    for (const [name, list, size] of LISTS) {
      expect(list.length, name).toBe(size);
      expect(new Set(list).size, name).toBe(size);
      for (const id of list) expect(byId.has(id), `${name}: ${id}`).toBe(true);
    }
  });

  it('hold together: who is in the euro or in Schengen, and who is not', () => {
    // The euro is the currency of members of the Union only.
    for (const id of EUROZONE) expect(EU, id).toContain(id);
    expect(EU.filter((id) => !EUROZONE.includes(id)).sort()).toEqual(['CZ', 'DK', 'HU', 'PL', 'RO', 'SE']);
    // Schengen: the Union without Ireland and Cyprus, and four countries from outside it.
    expect(EU.filter((id) => !SCHENGEN.includes(id)).sort()).toEqual(['CY', 'IE']);
    expect(SCHENGEN.filter((id) => !EU.includes(id)).sort()).toEqual(['CH', 'IS', 'LI', 'NO']);
    // The Baltic states were in the USSR and are in NATO; no other republic is.
    expect(USSR.filter((id) => NATO.includes(id)).sort()).toEqual(['EE', 'LT', 'LV']);
    expect(YUGOSLAVIA.filter((id) => EU.includes(id)).sort()).toEqual(['HR', 'SI']);
  });

  it('choose by a rule where there is one', () => {
    const micro = pick('micro');
    expect(micro).toHaveLength(24);
    for (const id of micro) expect(byId.get(id)!.ar).toBeLessThan(MICRO_KM2);
    for (const id of ['VA', 'MC', 'SM', 'LI', 'AD', 'MT', 'SG']) expect(micro).toContain(id);
    expect(micro).not.toContain('LU');

    const alone = pick('noborders');
    for (const id of ['JP', 'IS', 'CU', 'NZ', 'MG']) expect(alone).toContain(id);
    for (const id of ['GB', 'IE', 'ID', 'HT', 'ES']) expect(alone).not.toContain(id);
    for (const id of alone) expect(byId.get(id)!.nb ?? []).toEqual([]);

    const dry = pick('landlocked');
    for (const id of ['BO', 'PY', 'CH', 'AT', 'MN', 'NP']) expect(dry).toContain(id);
    for (const id of ['ES', 'FR', 'BR']) expect(dry).not.toContain(id);

    expect(names(pick('pop10'))).toEqual(names(['IN', 'CN', 'US', 'ID', 'PK', 'NG', 'BR', 'BD', 'RU', 'ET']));
    expect(names(pick('area10'))).toEqual(names(['RU', 'CA', 'CN', 'US', 'BR', 'AU', 'IN', 'AR', 'KZ', 'DZ']));
    expect(pick('area10low')).toHaveLength(10);
    expect(pick('area10low')).toContain('MC');
    // The Vatican is an observer, not a member: a ranking of states is made with members.
    expect(pick('area10low')).not.toContain('VA');
    expect(pick('pop10low')).toContain('TV');
  });

  it('only choose what the section can play with', () => {
    const small: Country[] = pool.filter((c) => c.ct === 'EU');
    expect(pick('world').length).toBeGreaterThan(190);
    const world = SHORTCUTS.find((s) => s.id === 'world')!;
    for (const id of world.pick(small)) expect(byId.get(id)!.ct).toBe('EU');
    for (const id of world.pick(pool)) expect(byId.get(id)!.cl).not.toBe('dep');
  });

  it('have a name in each language, and an id of their own', () => {
    const all = [...SHORTCUTS, ...MORE_SHORTCUTS];
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
    for (const lang of ['es', 'en'] as const) {
      setLang(lang);
      const said = all.map((s) => s.name());
      expect(new Set(said).size, lang).toBe(all.length);
      for (const text of said) expect(text.length).toBeGreaterThan(2);
    }
    setLang('es');
    expect(all.map((s) => s.name())).toContain('OTAN');
    setLang('en');
    expect(all.map((s) => s.name())).toContain('NATO');
    setLang('es');
  });
});
