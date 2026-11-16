// Checks on the generated map data in public/data: the app trusts these files blindly.

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { geoArea } from 'd3-geo';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import { describe, expect, it } from 'vitest';

const DATA = resolve(__dirname, '../../public/data');
const read = <T>(file: string): T => JSON.parse(readFileSync(resolve(DATA, file), 'utf8')) as T;

interface IndexCountry {
  id: string;
  cl: string;
  n: { es: string };
  cap?: { es: string };
  pop?: number;
  fl?: string;
  nb?: string[];
  sl?: string[];
  lv: { k: string; n: number }[];
  dl: string;
}
const index = read<{ countries: IndexCountry[] }>('index.json');
const byId = new Map(index.countries.map((c) => [c.id, c]));

const features = (topology: Topology, name: string) => {
  const fc = feature(topology, topology.objects[name] as GeometryCollection<{ q?: 0; nb?: string[]; sl?: string[]; g?: string[]; m?: string[] }>);
  return fc.features;
};

describe('index.json', () => {
  it('lists the 193 members of the United Nations, each with a name, a flag and people', () => {
    const un = index.countries.filter((c) => c.cl === 'un');
    expect(un).toHaveLength(193);
    for (const c of un) {
      expect(c.n.es, c.id).toBeTruthy();
      expect(c.fl, c.id).toBeTruthy();
      expect(c.pop, c.id).toBeGreaterThan(0);
      expect(c.cap?.es, c.id).toBeTruthy();
    }
  });

  it('has unique ids and symmetric neighbours', () => {
    expect(byId.size).toBe(index.countries.length);
    for (const c of index.countries) {
      for (const key of ['nb', 'sl'] as const) {
        for (const other of c[key] ?? []) {
          expect(byId.get(other)?.[key], `${c.id} → ${other}`).toContain(c.id);
        }
      }
    }
  });

  it('has one subdivision file per country and nothing else', () => {
    const files = readdirSync(resolve(DATA, 'r'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(files).toEqual([...byId.keys()].sort());
  });
});

describe('shapes', () => {
  // A ring wound the wrong way means "the whole globe except this" to d3, and paints the map solid.
  const HALF_GLOBE = 2 * Math.PI;

  it('world.json draws every country the right way round', () => {
    const world = features(read<Topology>('world.json'), 'c');
    expect(world.map((f) => String(f.id)).sort()).toEqual([...byId.keys()].sort());
    for (const f of world) expect(geoArea(f), String(f.id)).toBeLessThan(HALF_GLOBE);
  });

  it('every subdivision file matches the index and has no inside-out shape', () => {
    const problems: string[] = [];
    for (const c of index.countries) {
      const topology = read<Topology>(`r/${c.id}.json`);
      expect(Object.keys(topology.objects).sort(), c.id).toEqual(c.lv.map((l) => l.k).sort());
      expect(
        c.lv.map((l) => l.k),
        c.id,
      ).toContain(c.dl);
      for (const level of c.lv) {
        const list = features(topology, level.k);
        const ids = new Set(list.map((f) => String(f.id)));
        if (ids.size !== list.length) problems.push(`${c.id}/${level.k}: repeated ids`);
        const asked = list.filter((f) => f.properties.q !== 0);
        if (asked.length !== level.n) problems.push(`${c.id}/${level.k}: index says ${level.n}, file has ${asked.length}`);
        for (const f of list) {
          if (!(geoArea(f) < HALF_GLOBE)) problems.push(`${f.id}: inside out`);
          if (!(geoArea(f) > 0)) problems.push(`${f.id}: no area`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('groups name members that exist, and members point back at their groups', () => {
    const problems: string[] = [];
    for (const c of index.countries) {
      if (c.lv.length < 2) continue;
      const topology = read<Topology>(`r/${c.id}.json`);
      const fine = new Map(features(topology, 'f').map((f) => [String(f.id), f]));
      for (const level of c.lv) {
        if (level.k === 'f') continue;
        for (const grp of features(topology, level.k)) {
          for (const m of grp.properties.m ?? []) {
            const unit = fine.get(m);
            if (!unit) problems.push(`${grp.id}: unknown member ${m}`);
            else if (!unit.properties.g?.includes(String(grp.id))) problems.push(`${m} does not point back at ${grp.id}`);
          }
        }
      }
    }
    expect(problems).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Cities and physical geography (scripts/data/physical.mjs)
// ---------------------------------------------------------------------------

interface PhysRec {
  i: string;
  k: string;
  n: { es: string; en?: string };
  ct: string[];
  r: number;
  lp: [number, number];
  fp: [number, number][];
  g: ['L' | 'A', number[][]];
}
interface CityRec {
  i: string;
  n: { es: string; en?: string };
  ll: [number, number];
  p: number;
  k?: number;
  u?: string;
  wd?: string;
}

describe('physical.json', () => {
  const file = read<{ scale: number; f: PhysRec[] }>('physical.json');
  const KINDS = ['river', 'lake', 'sea', 'range', 'desert', 'island'];
  const PLACES = ['EU', 'AS', 'AF', 'AM', 'OC', 'AN'];
  const byKind = (k: string) => file.f.filter((f) => f.k === k);
  /** Undoes the storage: the first point and then the steps, in whole fractions of a degree. */
  const decode = (flat: number[]): [number, number][] => {
    const out: [number, number][] = [];
    let x = 0;
    let y = 0;
    for (let i = 0; i + 1 < flat.length; i += 2) {
      x += flat[i];
      y += flat[i + 1];
      out.push([x / file.scale, y / file.scale]);
    }
    return out;
  };

  it('names every feature in both languages, under an id of its own', () => {
    expect(new Set(file.f.map((f) => f.i)).size).toBe(file.f.length);
    for (const f of file.f) {
      expect(f.n.es, f.i).toBeTruthy();
      expect(f.n.en, f.i).toBeTruthy();
      expect(KINDS, f.i).toContain(f.k);
      expect([1, 2], f.i).toContain(f.r);
      expect(f.ct.length, f.i).toBeGreaterThan(0);
      for (const c of f.ct) expect(PLACES, f.i).toContain(c);
    }
  });

  it('has enough of each kind, and enough of the well-known ones for a first game', () => {
    for (const [kind, all, known] of [
      ['river', 150, 40],
      ['lake', 60, 20],
      ['sea', 90, 35],
      ['range', 50, 18],
      ['desert', 15, 6],
      ['island', 35, 18],
    ] as const) {
      expect(byKind(kind).length, kind).toBeGreaterThanOrEqual(all);
      expect(byKind(kind).filter((f) => f.r === 1).length, kind).toBeGreaterThanOrEqual(known);
    }
    for (const id of ['r:danube', 'r:nile', 'r:amazon', 'r:ebro', 's:atlantic-ocean', 's:mediterranean-sea', 'd:sahara', 'i:greenland', 'r:alps', 'r:andes', 'l:lake-victoria'])
      expect(file.f.some((f) => f.i === id), id).toBe(true);
  });

  it('draws rivers as lines and everything else as surfaces, inside the globe', () => {
    const problems: string[] = [];
    for (const f of file.f) {
      const [shape, parts] = f.g;
      if (shape !== (f.k === 'river' ? 'L' : 'A')) problems.push(`${f.i}: drawn as ${shape}`);
      if (!parts.length) problems.push(`${f.i}: nothing to draw`);
      let w = Infinity;
      let e = -Infinity;
      let s = Infinity;
      let n = -Infinity;
      for (const flat of parts) {
        if (flat.length % 2) problems.push(`${f.i}: odd list`);
        if (flat.length < (shape === 'L' ? 4 : 8)) problems.push(`${f.i}: a part with ${flat.length / 2} points`);
        if (!flat.every(Number.isInteger)) problems.push(`${f.i}: fractions`);
        const pts = decode(flat);
        for (const [x, y] of pts) {
          if (!(x >= -180 && x <= 180 && y >= -90 && y <= 90)) problems.push(`${f.i}: off the globe at ${x},${y}`);
          w = Math.min(w, x);
          e = Math.max(e, x);
          s = Math.min(s, y);
          n = Math.max(n, y);
        }
        if (shape === 'A') {
          const [a, b] = [pts[0], pts[pts.length - 1]];
          if (a[0] !== b[0] || a[1] !== b[1]) problems.push(`${f.i}: open ring`);
        }
      }
      // The point its name hangs from, and the points that frame it, lie on the feature.
      const inBox = (p: [number, number]) => p[0] >= w - 0.6 && p[0] <= e + 0.6 && p[1] >= s - 0.6 && p[1] <= n + 0.6;
      if (!inBox(f.lp)) problems.push(`${f.i}: label away from it`);
      if (!f.fp.length || !f.fp.every(inBox)) problems.push(`${f.i}: frame away from it`);
    }
    expect(problems).toEqual([]);
  });

  it('winds every surface the right way round', () => {
    // As with countries: a ring wound backwards means "the whole globe but this".
    for (const f of file.f) {
      if (f.g[0] !== 'A') continue;
      const geo = { type: 'MultiPolygon' as const, coordinates: f.g[1].map((flat) => [decode(flat)]) };
      // The Pacific covers a third of the planet: nothing gets near the whole of it.
      expect(geoArea(geo), f.i).toBeLessThan(0.75 * 4 * Math.PI);
      expect(geoArea(geo), f.i).toBeGreaterThan(0);
    }
  });
});

describe('cities.json', () => {
  const file = read<{ c: Record<string, CityRec[]> }>('cities.json');
  const all = Object.values(file.c).flat();

  it('lists cities of countries that exist, each under an id of its own', () => {
    for (const id of Object.keys(file.c)) expect(byId.has(id), id).toBe(true);
    expect(new Set(all.map((c) => c.i)).size).toBe(all.length);
    expect(all.length).toBeGreaterThan(4000);
    for (const c of all) {
      expect(c.n.es, c.i).toBeTruthy();
      expect(c.ll[0], c.i).toBeGreaterThanOrEqual(-180);
      expect(c.ll[0], c.i).toBeLessThanOrEqual(180);
      expect(Math.abs(c.ll[1]), c.i).toBeLessThanOrEqual(90);
      expect(c.p, c.i).toBeGreaterThanOrEqual(0);
      expect([undefined, 1, 2, 3], c.i).toContain(c.k);
    }
  });

  it('never gives two cities of a country the same name or the same identity', () => {
    // The source lists a few places twice and lends a few the names of a bigger neighbour: the build puts it right.
    const problems: string[] = [];
    for (const [id, list] of Object.entries(file.c)) {
      for (const lang of ['es', 'en'] as const) {
        const seen = new Set<string>();
        for (const c of list) {
          const name = (c.n[lang] ?? c.n.es).toLowerCase();
          if (seen.has(name)) problems.push(`${id}: two cities called ${name}`);
          seen.add(name);
        }
      }
      const ids = list.map((c) => c.wd).filter(Boolean);
      if (new Set(ids).size !== ids.length) problems.push(`${id}: the same Wikidata id twice`);
    }
    expect(problems).toEqual([]);
  });

  it('sorts each country by population, the largest first', () => {
    for (const [id, list] of Object.entries(file.c)) for (let i = 1; i < list.length; i++) expect(list[i].p, `${id} #${i}`).toBeLessThanOrEqual(list[i - 1].p);
  });

  it('marks one capital in every member of the United Nations that has one', () => {
    // Nauru has no official capital, and no city on the map.
    const without = index.countries.filter((c) => c.cl === 'un' && (file.c[c.id] ?? []).filter((x) => x.k === 3).length !== 1).map((c) => c.id);
    expect(without).toEqual(['NR']);
    expect(file.c.ES.find((c) => c.k === 3)?.n.es).toBe('Madrid');
    expect(file.c.ES.slice(0, 2).map((c) => c.n.es)).toEqual(['Madrid', 'Barcelona']);
  });

  it('places every city in a region of its own country', () => {
    const problems: string[] = [];
    for (const [id, list] of Object.entries(file.c)) {
      const units = new Set(features(read<Topology>(`r/${id}.json`), 'f').map((f) => String(f.id)));
      for (const c of list) if (c.u && !units.has(c.u)) problems.push(`${c.n.es} (${id}): unknown region ${c.u}`);
    }
    expect(problems).toEqual([]);
  });
});

describe('capitals.json', () => {
  const file = read<{ rc: Record<string, Record<string, Record<string, string[]>>> }>('capitals.json');

  it('names capitals of regions that exist, at levels that exist', () => {
    const problems: string[] = [];
    for (const [id, levels] of Object.entries(file.rc)) {
      const country = byId.get(id);
      if (!country) {
        problems.push(`${id}: unknown country`);
        continue;
      }
      const topology = read<Topology>(`r/${id}.json`);
      for (const [level, units] of Object.entries(levels)) {
        if (!country.lv.some((l) => l.k === level)) {
          problems.push(`${id}/${level}: unknown level`);
          continue;
        }
        const known = new Set(features(topology, level).map((f) => String(f.id)));
        for (const [unit, names] of Object.entries(units)) {
          if (!known.has(unit)) problems.push(`${id}/${level}: unknown region ${unit}`);
          if (!names.length || names.some((n) => !n.trim())) problems.push(`${unit}: empty name`);
        }
      }
    }
    expect(problems).toEqual([]);
  });

  it('knows the capitals of every Spanish province and autonomous community', () => {
    expect(Object.keys(file.rc.ES.f)).toHaveLength(52);
    expect(Object.keys(file.rc.ES.g1)).toHaveLength(19);
    expect(file.rc.ES.g1['ES-GA'][0]).toBe('Santiago de Compostela');
    expect(file.rc.ES.g1['ES-AN'][0]).toBe('Sevilla');
    expect(file.rc.ES.f['ES-M'][0]).toBe('Madrid');
  });
});
