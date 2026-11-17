import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { buildDeck, setLoader } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import { makeView } from './geo';
import { ARROWS, inOrder, moveFrom, movesOf, nearestTo, reachable, type Spot } from './mapKeys';
import type { Deck } from './types';

const grid = (cols: number, rows: number): Spot[] => Array.from({ length: cols * rows }, (_, i) => ({ id: `${i % cols},${Math.floor(i / cols)}`, x: (i % cols) * 10, y: Math.floor(i / cols) * 10 }));
const { ArrowLeft: LEFT, ArrowRight: RIGHT, ArrowUp: UP, ArrowDown: DOWN } = ARROWS;

describe('the keyboard cursor on a grid', () => {
  const spots = grid(4, 3);
  const moves = movesOf(spots);

  it('moves one step in the direction of the arrow', () => {
    expect(moveFrom(moves, '1,1', RIGHT)).toBe('2,1');
    expect(moveFrom(moves, '1,1', LEFT)).toBe('0,1');
    expect(moveFrom(moves, '1,1', UP)).toBe('1,0');
    expect(moveFrom(moves, '1,1', DOWN)).toBe('1,2');
  });

  it('stops at the edge', () => {
    expect(moveFrom(moves, '3,1', RIGHT)).toBeNull();
    expect(moveFrom(moves, '0,0', UP)).toBeNull();
    expect(moveFrom(moves, '0,0', LEFT)).toBeNull();
    expect(moveFrom(moves, 'nowhere', LEFT)).toBeNull();
  });

  it('prefers what lies straight ahead to what is nearer but to the side', () => {
    const from = { id: 'a', x: 0, y: 0 };
    const ahead = { id: 'b', x: 12, y: 0 };
    const aside = { id: 'c', x: 6, y: 7 };
    expect(moveFrom(movesOf([from, ahead, aside]), 'a', RIGHT)).toBe('b');
    // With nothing ahead, what is far to the side is still better than not moving.
    expect(moveFrom(movesOf([from, { id: 'd', x: 1, y: 30 }]), 'a', RIGHT)).toBe('d');
  });

  it('lets in a piece that every other one would walk past', () => {
    // Four pieces in a tight square and a fifth just off its middle: from each corner, another corner comes first.
    const square: Spot[] = [
      { id: 'nw', x: 0, y: 0 },
      { id: 'ne', x: 10, y: 0 },
      { id: 'sw', x: 0, y: 10 },
      { id: 'se', x: 10, y: 10 },
      { id: 'mid', x: 5.2, y: 5.1 },
    ];
    const moves = movesOf(square);
    for (const s of square) expect([...reachable(moves, s.id)].sort()).toEqual(['mid', 'ne', 'nw', 'se', 'sw']);
  });

  it('goes through them one by one from west to east', () => {
    expect(inOrder(spots).map((s) => s.id).slice(0, 4)).toEqual(['0,0', '0,1', '0,2', '1,0']);
    expect(nearestTo(21, 9, spots)?.id).toBe('2,1');
    expect(nearestTo(0, 0, [])).toBeNull();
    expect(movesOf([]).ids).toEqual([]);
  });
});

describe('the keyboard cursor on the maps of the game', () => {
  let all: string[] = [];
  beforeAll(() => {
    const dir = path.join(__dirname, '../../public/data');
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(dir, p), 'utf8')));
    const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8')) as { countries: { id: string; cl: string }[] };
    all = index.countries.filter((c) => c.cl !== 'other').map((c) => c.id);
  });

  /** The points the map draws its pieces at, as `MapView` works them out. */
  const spotsOf = (deck: Deck): Spot[] => {
    const { projection } = makeView(deck.frame);
    return deck.items.flatMap((it) => {
      const c = projection(it.lp);
      return c ? [{ id: it.id, x: c[0], y: c[1] }] : [];
    });
  };

  const maps: [string, () => Promise<Deck>][] = [
    ['the provinces of Spain', () => buildDeck({ scope: 'regions', countries: ['ES'], levels: { ES: 'f' } })],
    ['the states of the United States', () => buildDeck({ scope: 'regions', countries: ['US'] })],
    ['the regions of France, Italy and Germany together', () => buildDeck({ scope: 'regions', countries: ['FR', 'IT', 'DE'] })],
    ['the regions of Russia', () => buildDeck({ scope: 'regions', countries: ['RU'] })],
    ['the islands of Indonesia and the Philippines', () => buildDeck({ scope: 'regions', countries: ['ID', 'PH'] })],
    ['the countries of the world', () => buildDeck({ scope: 'countries', countries: all })],
    ['the cities of Spain, France and Portugal', () => buildCityDeck(['ES', 'FR', 'PT'], 'top', 60)],
    ['the rivers, peaks, seas and ranges of the world', () => buildPhysicalDeck(['river', 'peak', 'sea', 'range', 'all'])],
  ];

  for (const [name, make] of maps) {
    it(`reaches ${name} with the arrows alone, from wherever it starts`, async () => {
      const spots = spotsOf(await make());
      expect(spots.length).toBeGreaterThan(10);
      const moves = movesOf(spots);
      for (const start of [spots[0], spots[spots.length - 1], spots[Math.floor(spots.length / 2)]]) {
        const got = reachable(moves, start.id);
        expect(spots.filter((s) => !got.has(s.id)).map((s) => s.id), `from ${start.id}`).toEqual([]);
      }
      // An arrow never leads backwards: what it reaches lies on its side of where it started.
      const at = new Map(spots.map((s) => [s.id, s]));
      for (const s of spots) {
        const right = moveFrom(moves, s.id, RIGHT);
        const down = moveFrom(moves, s.id, DOWN);
        if (right) expect(at.get(right)!.x).toBeGreaterThan(s.x);
        if (down) expect(at.get(down)!.y).toBeGreaterThan(s.y);
      }
    });
  }

  it('reaches every region of the world at once, and works it out in good time', async () => {
    const spots = spotsOf(await buildDeck({ scope: 'regions', countries: all }));
    expect(spots.length).toBeGreaterThan(3000);
    const t0 = performance.now();
    const moves = movesOf(spots);
    const ms = performance.now() - t0;
    const got = reachable(moves, spots[0].id);
    expect(spots.length - got.size).toBe(0);
    // About a quarter of a second on a desktop; the limit only catches a rule that has stopped scaling.
    expect(ms).toBeLessThan(5000);
  }, 120000);
});
