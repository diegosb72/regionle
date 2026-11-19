/**
 * A QR code for an address of the game, worked out in the player's own browser: nothing is asked of any
 * service and nothing is sent anywhere.
 *
 * It does what a link needs and no more: the text goes in as bytes (UTF-8, so any text can be written), at
 * one of the two lighter levels of error correction, in any of the forty sizes of the standard
 * (ISO/IEC 18004), from 21 to 177 modules a side. The smallest size that holds the text is used.
 */

/** How much of the code can be lost and still be read: about 7 % (L) or 15 % (M). */
export type QrLevel = 'L' | 'M';

export interface Qr {
  /** Modules a side, without the white margin: 21 for version 1 and four more for each version after it. */
  size: number;
  version: number;
  level: QrLevel;
  /** Which of the eight masks the modules of data are turned with. */
  mask: number;
  /** One byte for each module, row by row: 1 is dark. */
  modules: Uint8Array;
}

export const QR_VERSIONS = 40;
/** The white margin a reader needs around the code, in modules. */
export const QR_QUIET = 4;

// For each version, from 1 to 40: the bytes of error correction of each block, and how many blocks there are.
const ECC: Record<QrLevel, readonly number[]> = {
  L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
};
const BLOCKS: Record<QrLevel, readonly number[]> = {
  L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
};
/** The two bits that name the level in the format information. */
const LEVEL_BITS: Record<QrLevel, number> = { L: 1, M: 0 };

/** Modules that carry data or error correction: what is left of the square once the fixed patterns are in. */
function rawModules(ver: number): number {
  let n = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const align = Math.floor(ver / 7) + 2;
    n -= (25 * align - 10) * align - 55;
    if (ver >= 7) n -= 36;
  }
  return n;
}

/** Bytes of data (text and its header) that a version holds at a level. */
function dataBytes(ver: number, level: QrLevel): number {
  return Math.floor(rawModules(ver) / 8) - ECC[level][ver - 1] * BLOCKS[level][ver - 1];
}

/** Bits that say how many bytes follow: one byte up to version 9, two from version 10. */
const countBits = (ver: number): number => (ver < 10 ? 8 : 16);

/** Bytes of text that a version holds at a level: 14 for the smallest at M, 2331 for the largest. */
export function qrCapacity(ver: number, level: QrLevel = 'M'): number {
  return Math.floor((dataBytes(ver, level) * 8 - 4 - countBits(ver)) / 8);
}

// ---------------------------------------------------------------- Reed–Solomon over GF(2^8), modulo 0x11D

function mul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** The polynomial a block is divided by to get its `degree` bytes of error correction. */
function divisor(degree: number): number[] {
  const out = new Array<number>(degree).fill(0);
  out[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      out[j] = mul(out[j], root);
      if (j + 1 < degree) out[j] ^= out[j + 1];
    }
    root = mul(root, 2);
  }
  return out;
}

function remainder(data: readonly number[], div: readonly number[]): number[] {
  const out = div.map(() => 0);
  for (const byte of data) {
    const factor = byte ^ (out.shift() as number);
    out.push(0);
    div.forEach((c, i) => (out[i] ^= mul(c, factor)));
  }
  return out;
}

/** The bytes of the code in the order they are laid on it: the text, padded, cut in blocks, each with its error correction. */
function codewords(bytes: Uint8Array, ver: number, level: QrLevel): number[] {
  const room = dataBytes(ver, level);
  const bits: number[] = [];
  const put = (value: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((value >>> i) & 1);
  };
  put(0b0100, 4); // What follows is bytes.
  put(bytes.length, countBits(ver));
  for (const b of bytes) put(b, 8);
  put(0, Math.min(4, room * 8 - bits.length)); // The end of the text, where there is room to say it.
  put(0, (8 - (bits.length % 8)) % 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  // What is left of the room is filled with two bytes that take turns.
  for (let pad = 0xec; data.length < room; pad ^= 0xec ^ 0x11) data.push(pad);

  const blocks = BLOCKS[level][ver - 1];
  const eccLen = ECC[level][ver - 1];
  const raw = Math.floor(rawModules(ver) / 8);
  // When the bytes do not divide evenly, the first blocks are one byte shorter than the last ones.
  const short = blocks - (raw % blocks);
  const shortLen = Math.floor(raw / blocks);
  const div = divisor(eccLen);
  const parts: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < short ? 0 : 1));
    k += dat.length;
    const ecc = remainder(dat, div);
    // A place kept in a short block, so that every block is as long: it is skipped below.
    if (i < short) dat.push(0);
    parts.push(dat.concat(ecc));
  }
  // The blocks are woven together, a byte of each in turn: a stain on the code spoils a little of each.
  const out: number[] = [];
  for (let i = 0; i < parts[0].length; i++) {
    parts.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= short) out.push(block[i]);
    });
  }
  return out;
}

// ---------------------------------------------------------------- the square

interface Grid {
  size: number;
  dark: Uint8Array;
  /** Modules of the fixed patterns, which hold no data and are not masked. */
  fixed: Uint8Array;
}

/** Where the centres of the small squares that help a reader with a large code are, along either side. */
function alignment(ver: number): number[] {
  if (ver === 1) return [];
  const n = Math.floor(ver / 7) + 2;
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
  const out = [6];
  for (let pos = ver * 4 + 10; out.length < n; pos -= step) out.splice(1, 0, pos);
  return out;
}

/** The level and the mask, written twice next to the corners with their own error correction. */
function writeFormat(g: Grid, level: QrLevel, mask: number): void {
  const { size } = g;
  const set = (x: number, y: number, on: number) => {
    g.dark[y * size + x] = on;
    g.fixed[y * size + x] = 1;
  };
  const data = (LEVEL_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const bit = (i: number) => (bits >>> i) & 1;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6));
  set(8, 8, bit(7));
  set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, 1); // A module that is always dark.
}

/** The square of a version with everything that does not depend on the text. */
function frame(ver: number, level: QrLevel): Grid {
  const size = ver * 4 + 17;
  const g: Grid = { size, dark: new Uint8Array(size * size), fixed: new Uint8Array(size * size) };
  const set = (x: number, y: number, on: boolean) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    g.dark[y * size + x] = on ? 1 : 0;
    g.fixed[y * size + x] = 1;
  };
  // The two dotted lines that tell a reader how wide a module is.
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0);
    set(i, 6, i % 2 === 0);
  }
  // The three large squares of the corners, each with its white border.
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ]) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(cx + dx, cy + dy, d !== 2 && d !== 4);
      }
    }
  }
  // The small squares, everywhere but on the three corners above.
  const at = alignment(ver);
  const last = at.length - 1;
  at.forEach((cx, i) =>
    at.forEach((cy, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }),
  );
  // The place of the format is kept now; what it says depends on the mask.
  writeFormat(g, level, 0);
  // From version 7 the code says its version too, twice, with its own error correction.
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const on = ((bits >>> i) & 1) === 1;
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      set(a, b, on);
      set(b, a, on);
    }
  }
  return g;
}

/** Lays the bytes on the square: two columns at a time from the right, up one pair and down the next. */
function place(g: Grid, data: readonly number[]): void {
  const { size, dark, fixed } = g;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // The column of the dotted line is not used.
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const up = ((right + 1) & 2) === 0;
        const y = up ? size - 1 - vert : vert;
        const at = y * size + x;
        if (fixed[at] || i >= data.length * 8) continue;
        dark[at] = (data[i >>> 3] >>> (7 - (i & 7))) & 1;
        i++;
      }
    }
  }
}

/** The eight ways of turning modules over so that the code is easier to read: each says which ones. */
const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

/**
 * How hard a square is to read, as the standard counts it: long runs of one colour, blocks of one colour,
 * anything that looks like the squares of the corners, and too much of one colour. The lower, the better.
 */
export function qrPenalty(size: number, dark: Uint8Array): number {
  let total = 0;
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < size; a++) {
      let run = 0;
      let colour = -1;
      let seen = 0;
      for (let b = 0; b < size; b++) {
        const c = pass === 0 ? dark[a * size + b] : dark[b * size + a];
        if (c === colour) {
          run++;
          if (run === 5) total += 3;
          else if (run > 5) total++;
        } else {
          colour = c;
          run = 1;
        }
        // The last eleven modules: dark, light, three dark, light, dark, with four light ones on one side.
        seen = ((seen << 1) | c) & 0x7ff;
        if (b >= 10 && (seen === 0b10111010000 || seen === 0b00001011101)) total += 40;
      }
    }
  }
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = dark[y * size + x];
      if (c === dark[y * size + x + 1] && c === dark[(y + 1) * size + x] && c === dark[(y + 1) * size + x + 1]) total += 3;
    }
  }
  let ink = 0;
  for (const c of dark) ink += c;
  const all = size * size;
  total += Math.max(0, Math.ceil(Math.abs(ink * 20 - all * 10) / all) - 1) * 10;
  return total;
}

/**
 * The QR code of a text. `mask` and `version` are for the tests: left out, the code takes the smallest
 * version that holds the text and the mask that reads best. A text that does not fit in the largest
 * version (2331 bytes at M) is an error.
 */
export function qrOf(text: string, opts: { level?: QrLevel; mask?: number; version?: number } = {}): Qr {
  const level = opts.level ?? 'M';
  const bytes = new TextEncoder().encode(text);
  let version = Math.max(1, opts.version ?? 1);
  while (version <= QR_VERSIONS && qrCapacity(version, level) < bytes.length) version++;
  if (version > QR_VERSIONS) throw new RangeError('qr: the text does not fit in a code');
  const base = frame(version, level);
  place(base, codewords(bytes, version, level));
  const { size } = base;
  let best: Qr | null = null;
  let least = Infinity;
  for (let mask = 0; mask < MASKS.length; mask++) {
    if (opts.mask != null && opts.mask !== mask) continue;
    const g: Grid = { size, dark: base.dark.slice(), fixed: base.fixed };
    const turn = MASKS[mask];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!g.fixed[y * size + x] && turn(x, y)) g.dark[y * size + x] ^= 1;
    writeFormat(g, level, mask);
    const cost = qrPenalty(size, g.dark);
    if (cost < least) {
      least = cost;
      best = { size, version, level, mask, modules: g.dark };
    }
  }
  if (!best) throw new RangeError('qr: no such mask');
  return best;
}

/**
 * The dark modules as the `d` of an SVG path, each run of them in a row as one rectangle, in a square of
 * `size + 2 × quiet` units a side: the margin is part of the drawing.
 */
export function qrPath(qr: Qr, quiet: number = QR_QUIET): string {
  const { size, modules } = qr;
  let d = '';
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!modules[y * size + x]) continue;
      let end = x;
      while (end + 1 < size && modules[y * size + end + 1]) end++;
      const len = end - x + 1;
      d += `M${x + quiet} ${y + quiet}h${len}v1h-${len}z`;
      x = end;
    }
  }
  return d;
}
