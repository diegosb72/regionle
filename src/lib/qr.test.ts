import { createHash } from 'node:crypto';
import jsQR from 'jsqr';
import { describe, expect, it } from 'vitest';
import { QR_QUIET, qrCapacity, qrOf, qrPath, qrPenalty, type Qr, type QrLevel } from './qr';

const digest = (m: Uint8Array): string => createHash('sha256').update(m).digest('hex').slice(0, 16);
const rows = (q: Qr): string[] => Array.from({ length: q.size }, (_, y) => Array.from(q.modules.slice(y * q.size, (y + 1) * q.size), (v) => (v ? '#' : '.')).join(''));
const at = (q: Qr, x: number, y: number): number => q.modules[y * q.size + x];

/** The level and the mask as the code itself says them, next to its first corner; null when its own check fails. */
function formatOf(q: Qr): { level: number; mask: number } | null {
  const where: [number, number][] = [];
  for (let i = 0; i <= 5; i++) where.push([8, i]);
  where.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) where.push([14 - i, 8]);
  let bits = 0;
  where.forEach(([x, y], i) => (bits |= at(q, x, y) << i));
  bits ^= 0x5412;
  let rem = bits >>> 10;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return (rem & 0x3ff) === (bits & 0x3ff) ? { level: bits >>> 13, mask: (bits >>> 10) & 7 } : null;
}

/** What a reader that is not the game's makes of the code, drawn as a picture with its margin. */
function read(q: Qr, scale = 4): string | null {
  const side = (q.size + QR_QUIET * 2) * scale;
  const px = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < q.size; y++)
    for (let x = 0; x < q.size; x++)
      if (at(q, x, y))
        for (let dy = 0; dy < scale; dy++)
          for (let dx = 0; dx < scale; dx++) {
            const i = (((y + QR_QUIET) * scale + dy) * side + (x + QR_QUIET) * scale + dx) * 4;
            px[i] = px[i + 1] = px[i + 2] = 0;
          }
  return jsQR(px, side, side)?.data ?? null;
}

describe('a QR code', () => {
  // Each of these was, when it was written, the same module by module as the code two other encoders make
  // of the same text (with the same mask), and was read back by a reader. So were all forty versions.
  const CASES: [string, QrLevel, number, number, string][] = [
    ['Regionle', 'M', 1, 6, '82d2e3079f46f53e'],
    ['https://diegosb72.github.io/regionle/', 'M', 3, 3, 'a4fb759432a8a462'],
    ['https://diegosb72.github.io/regionle/#/regiones/ES:p+PT/capital', 'M', 5, 0, '927f7017a9c7323c'],
    ['https://diegosb72.github.io/regionle/#/reto/2026-11-18/kgd84x.QW5h', 'L', 4, 2, 'ceee79ec685e68e6'],
    ['Señalar · España: ¿lo superas? 你好', 'M', 3, 2, '42d2c98bda1f5079'],
    ['a'.repeat(213), 'M', 10, 1, '468f60ed6bdfcb47'],
    ['b'.repeat(214), 'M', 11, 2, '5506e954eb2483d8'],
    ['c'.repeat(1000), 'M', 26, 2, '9a77f5df2c1b2100'],
    ['d'.repeat(2331), 'M', 40, 2, '4832a707b34023c3'],
    ['e'.repeat(2953), 'L', 40, 1, '65e283dc82051fe2'],
  ];

  it.each(CASES)('of %s at %s is version %i with mask %i', (text, level, version, mask, sum) => {
    const q = qrOf(text, { level });
    expect([q.version, q.mask, q.size, q.level]).toEqual([version, mask, version * 4 + 17, level]);
    expect(q.modules.length).toBe(q.size * q.size);
    expect(digest(q.modules)).toBe(sum);
  });

  it('is read back by a reader, accents and all, with the mask it chooses and with each of the eight', () => {
    for (const [text, level] of CASES.slice(0, 8)) {
      expect(read(qrOf(text, { level })), text.slice(0, 40)).toBe(text);
    }
    const link = 'https://diegosb72.github.io/regionle/#/paises/ES+FR+PT/pin';
    for (let mask = 0; mask < 8; mask++) expect(read(qrOf(link, { mask }))).toBe(link);
    expect(read(qrOf(link, { level: 'L' }))).toBe(link);
  });

  it('is drawn module by module as the standard says', () => {
    expect(rows(qrOf('Regionle'))).toEqual([
      '#######.#####.#######',
      '#.....#.#..#..#.....#',
      '#.###.#.#.###.#.###.#',
      '#.###.#..#.##.#.###.#',
      '#.###.#.###.#.#.###.#',
      '#.....#...###.#.....#',
      '#######.#.#.#.#######',
      '..........###........',
      '#..########.##..#.###',
      '###.#....#..###..##..',
      '#####.#.#....##...###',
      '..#.##.#####....#.#.#',
      '###.###.#.#..##..#.##',
      '........#####...###.#',
      '#######.#.#.###.##...',
      '#.....#.#..###...##.#',
      '#.###.#.##.##.#.##...',
      '#.###.#.#..##....#...',
      '#.###.#..##...#.#.###',
      '#.....#..#...########',
      '#######.##.#.........',
    ]);
  });

  it('holds what the standard says each version holds', () => {
    const some = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 40];
    expect(some.map((v) => qrCapacity(v, 'M'))).toEqual([14, 26, 42, 62, 84, 106, 122, 152, 180, 213, 2331]);
    expect(some.map((v) => qrCapacity(v, 'L'))).toEqual([17, 32, 53, 78, 106, 134, 154, 192, 230, 271, 2953]);
    expect(qrCapacity(5)).toBe(84);
  });

  it('takes the smallest version the text fits in, counting bytes and not letters', () => {
    expect(qrOf('a'.repeat(14)).version).toBe(1);
    expect(qrOf('a'.repeat(15)).version).toBe(2);
    // "ñ" is two bytes: seven of them fit where fourteen letters do, eight do not.
    expect(qrOf('ñ'.repeat(7)).version).toBe(1);
    expect(qrOf('ñ'.repeat(8)).version).toBe(2);
    expect(qrOf('').version).toBe(1);
    expect(qrOf('a', { version: 6 }).version).toBe(6);
    // A version asked for that is too small is not kept to.
    expect(qrOf('a'.repeat(100), { version: 2 }).version).toBe(6);
  });

  it('refuses a text that does not fit in the largest code', () => {
    expect(() => qrOf('a'.repeat(2332))).toThrow(RangeError);
    expect(() => qrOf('a'.repeat(2954), { level: 'L' })).toThrow(RangeError);
    expect(() => qrOf('a', { mask: 8 })).toThrow(RangeError);
  });

  it('has its three corners, its dotted lines and its dark module in every size', () => {
    for (const text of ['x', 'a'.repeat(60), 'a'.repeat(400), 'a'.repeat(2000)]) {
      const q = qrOf(text);
      const n = q.size;
      for (const [cx, cy] of [
        [3, 3],
        [n - 4, 3],
        [3, n - 4],
      ]) {
        for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) expect(at(q, cx + dx, cy + dy)).toBe(Math.max(Math.abs(dx), Math.abs(dy)) === 2 ? 0 : 1);
      }
      for (let i = 8; i < n - 8; i++) {
        expect(at(q, i, 6)).toBe(i % 2 === 0 ? 1 : 0);
        expect(at(q, 6, i)).toBe(i % 2 === 0 ? 1 : 0);
      }
      expect(at(q, 8, n - 8)).toBe(1);
    }
  });

  it('says its level and its mask where a reader looks for them', () => {
    for (let mask = 0; mask < 8; mask++) {
      expect(formatOf(qrOf('https://diegosb72.github.io/regionle/', { mask }))).toEqual({ level: 0, mask });
      expect(formatOf(qrOf('https://diegosb72.github.io/regionle/', { mask, level: 'L' }))).toEqual({ level: 1, mask });
    }
  });

  it('keeps the mask that reads best of the eight', () => {
    const text = 'https://diegosb72.github.io/regionle/#/paises/ES+FR+PT/pin';
    const chosen = qrOf(text);
    const costs = [0, 1, 2, 3, 4, 5, 6, 7].map((mask) => {
      const q = qrOf(text, { mask });
      return qrPenalty(q.size, q.modules);
    });
    expect(costs[chosen.mask]).toBe(Math.min(...costs));
    expect(new Set(costs).size).toBeGreaterThan(1);
  });

  it('counts what makes a square hard to read', () => {
    // All of one colour: every row and every column is one long run, every block of four is of one colour,
    // and the whole of it is one colour.
    const white = new Uint8Array(21 * 21);
    const lines = 2 * 21 * (3 + 16);
    const blocks = 20 * 20 * 3;
    expect(qrPenalty(21, white)).toBe(lines + blocks + 90);
    // A chessboard has none of that.
    const chess = Uint8Array.from({ length: 21 * 21 }, (_, i) => i % 2);
    expect(qrPenalty(21, chess)).toBe(0);
    // What looks like a corner, with white next to it, in a row of an otherwise quiet board.
    const fake = chess.slice();
    [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0].forEach((v, i) => (fake[10 * 21 + i] = v));
    expect(qrPenalty(21, fake)).toBeGreaterThanOrEqual(40);
  });

  it('is the same code every time', () => {
    const text = 'https://diegosb72.github.io/regionle/#/ciudades/ES/pin/top25';
    expect(digest(qrOf(text).modules)).toBe(digest(qrOf(text).modules));
    expect(digest(qrOf(text).modules)).not.toBe(digest(qrOf(`${text}0`).modules));
  });
});

describe('the drawing of a QR code', () => {
  it('covers each dark module once and nothing else', () => {
    const q = qrOf('https://diegosb72.github.io/regionle/#/regiones/ES:p+PT/capital');
    const d = qrPath(q);
    const seen = new Uint8Array(q.size * q.size);
    const runs = [...d.matchAll(/M(\d+) (\d+)h(\d+)v1h-(\d+)z/g)];
    expect(runs.map((m) => m[0]).join('')).toBe(d);
    for (const m of runs) {
      const [x, y, len] = [Number(m[1]) - QR_QUIET, Number(m[2]) - QR_QUIET, Number(m[3])];
      expect(m[4]).toBe(m[3]);
      for (let i = 0; i < len; i++) {
        expect(seen[y * q.size + x + i]).toBe(0);
        seen[y * q.size + x + i] = 1;
      }
    }
    expect(Array.from(seen)).toEqual(Array.from(q.modules));
  });

  it('starts where it is told the margin ends', () => {
    const q = qrOf('Regionle');
    expect(qrPath(q, 0).startsWith('M0 0h7v1h-7z')).toBe(true);
    expect(qrPath(q).startsWith('M4 4h7v1h-7z')).toBe(true);
    expect(qrPath(q, 2).startsWith('M2 2h7v1h-7z')).toBe(true);
  });
});
