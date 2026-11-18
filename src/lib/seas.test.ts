import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { PART_OF, seaParts } from './seas';

const file = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data/physical.json'), 'utf8')) as { f: { i: string; k: string; g?: [string, number[][]] }[] };
const byId = new Map(file.f.map((f) => [f.i, f]));

describe('the seas that are part of another', () => {
  it('are all seas of the map, drawn as surfaces', () => {
    for (const [part, whole] of Object.entries(PART_OF)) {
      expect(byId.get(part)?.k, part).toBe('sea');
      expect(['sea', 'ocean'], whole).toContain(byId.get(whole)?.k);
      expect(byId.get(part)?.g?.[0], part).toBe('A');
      expect(byId.get(whole)?.g?.[0], whole).toBe('A');
    }
  });

  it('never lead back to themselves', () => {
    for (const part of Object.keys(PART_OF)) {
      const seen = new Set([part]);
      for (let at = PART_OF[part]; at; at = PART_OF[at]) {
        expect(seen.has(at), `${part} → ${at}`).toBe(false);
        seen.add(at);
      }
    }
  });

  it('bring the parts of the parts too', () => {
    const med = seaParts('s:mediterranean-sea');
    expect(med).toContain('s:balearic-sea');
    expect(med).toContain('s:gulf-of-valencia');
    expect(med).toContain('s:sea-of-crete');
    // The nearest first.
    expect(med.indexOf('s:balearic-sea')).toBeLessThan(med.indexOf('s:gulf-of-valencia'));
    expect(new Set(med).size).toBe(med.length);
    expect(seaParts('s:atlantic-ocean')).toEqual(expect.arrayContaining(['s:bay-of-biscay', 's:cantabrian-sea', 's:gulf-of-cadiz']));
    expect(seaParts('s:balearic-sea')).toEqual(['s:gulf-of-valencia']);
  });

  it('leave alone what lies behind a strait', () => {
    expect(seaParts('s:mediterranean-sea')).not.toContain('s:black-sea');
    expect(seaParts('s:mediterranean-sea')).not.toContain('s:strait-of-gibraltar');
    expect(seaParts('s:atlantic-ocean')).not.toContain('s:mediterranean-sea');
    expect(seaParts('s:atlantic-ocean')).not.toContain('s:north-sea');
    expect(seaParts('s:black-sea')).toEqual([]);
    expect(seaParts('r:ebro')).toEqual([]);
  });
});
