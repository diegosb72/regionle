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
