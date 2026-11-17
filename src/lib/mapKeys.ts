/**
 * Moving over a map with the keyboard: which piece the cursor goes to when an arrow is pressed. Pieces
 * are taken by one point each (where their name would be written), in the units they are drawn in.
 */
export interface Spot {
  id: string;
  x: number;
  y: number;
}

/** The arrows, in the order their moves are kept in: left, right, up, down. */
export const ARROWS: Readonly<Record<string, number>> = { ArrowLeft: 0, ArrowRight: 1, ArrowUp: 2, ArrowDown: 3 };

/** The step of each arrow, with y growing downwards as on screen. */
const STEP: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** What lies to the side of the way counts this many times what lies along it: straight ahead comes first. */
const ASIDE = 2;
/** Beyond this slope a piece is more to the side than ahead, and is only taken when nothing else is. */
const CONE = 2.5;
const OFF_CONE = 1e9;

/**
 * How far out of the way a piece at (dx, dy) is for an arrow: the smaller, the more natural the move.
 * Infinity for what does not lie that way at all.
 */
function cost(dx: number, dy: number, arrow: number): number {
  const [sx, sy] = STEP[arrow];
  const along = dx * sx + dy * sy;
  if (along <= 1e-9) return Infinity;
  const aside = Math.abs(dx * sy - dy * sx);
  return along + aside * ASIDE + (aside > along * CONE ? OFF_CONE : 0);
}

/** Where each arrow leads from each piece: `to[i * 4 + arrow]` is the index of the piece, or -1 at the edge of the map. */
export interface Moves {
  ids: string[];
  at: Map<string, number>;
  to: Int32Array;
}

/**
 * The moves of a map. Each arrow leads to the nearest piece that way, straight ahead before sideways,
 * and stops only at the edge of the map. That rule alone can leave a piece out: one that, from every
 * side, has another piece standing in front of it. So the map is then walked from its westernmost
 * piece, and each piece that was not reached is put on the way of the arrow it disturbs the least.
 * The result: every piece can be reached from every other with the arrows alone.
 */
export function movesOf(spots: readonly Spot[]): Moves {
  const n = spots.length;
  const xs = new Float64Array(n);
  const ys = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    xs[i] = spots[i].x;
    ys[i] = spots[i].y;
  }
  const to = new Int32Array(n * 4).fill(-1);
  for (let i = 0; i < n; i++) {
    for (let arrow = 0; arrow < 4; arrow++) {
      let best = -1;
      let least = Infinity;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const c = cost(xs[j] - xs[i], ys[j] - ys[i], arrow);
        if (c < least) {
          least = c;
          best = j;
        }
      }
      to[i * 4 + arrow] = best;
    }
  }

  // From anywhere, the left arrow ends at the westernmost piece: what can be reached from there can be reached from anywhere.
  let west = 0;
  for (let i = 1; i < n; i++) if (xs[i] < xs[west] || (xs[i] === xs[west] && ys[i] < ys[west])) west = i;
  const seen = new Uint8Array(n);
  const walk = (): number => {
    seen.fill(0);
    if (!n) return 0;
    const stack = [west];
    seen[west] = 1;
    let count = 1;
    while (stack.length) {
      const i = stack.pop()!;
      for (let arrow = 0; arrow < 4; arrow++) {
        const j = to[i * 4 + arrow];
        if (j >= 0 && !seen[j]) {
          seen[j] = 1;
          count++;
          stack.push(j);
        }
      }
    }
    return count;
  };
  /** Moves already changed to let a piece in: they are not changed again, or two pieces could take the place from each other for ever. */
  const fixed = new Uint8Array(n * 4);
  for (let pass = 0; pass < 12 && walk() < n; pass++) {
    let changed = false;
    for (let b = 0; b < n; b++) {
      if (seen[b]) continue;
      let from = -1;
      let least = Infinity;
      for (let a = 0; a < n; a++) {
        if (!seen[a]) continue;
        for (let arrow = 0; arrow < 4; arrow++) {
          const slot = a * 4 + arrow;
          if (fixed[slot]) continue;
          const c = cost(xs[b] - xs[a], ys[b] - ys[a], arrow);
          if (c === Infinity) continue;
          const now = to[slot];
          // What the move gets worse by, and a little more when the piece it used to reach is not the next one on.
          const regret = c - (now < 0 ? c : cost(xs[now] - xs[a], ys[now] - ys[a], arrow)) + (now >= 0 && to[b * 4 + arrow] !== now ? c * 0.25 : 0);
          if (regret < least) {
            least = regret;
            from = slot;
          }
        }
      }
      if (from < 0) continue;
      to[from] = b;
      fixed[from] = 1;
      changed = true;
    }
    if (!changed) break;
  }

  const ids = spots.map((s) => s.id);
  return { ids, at: new Map(ids.map((id, i) => [id, i])), to };
}

/** The piece an arrow leads to, or null at the edge of the map. */
export function moveFrom(moves: Moves, id: string, arrow: number): string | null {
  const i = moves.at.get(id);
  if (i == null) return null;
  const j = moves.to[i * 4 + arrow];
  return j < 0 ? null : moves.ids[j];
}

/** The order in which the pieces are gone through one by one: from west to east, and from north to south where they tie. */
export function inOrder<T extends Spot>(spots: readonly T[]): T[] {
  return [...spots].sort((a, b) => a.x - b.x || a.y - b.y || (a.id < b.id ? -1 : 1));
}

/** The piece nearest to a point: where the cursor starts. */
export function nearestTo<T extends Spot>(x: number, y: number, spots: readonly T[]): T | null {
  let best: T | null = null;
  let dist = Infinity;
  for (const s of spots) {
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < dist) {
      dist = d;
      best = s;
    }
  }
  return best;
}

/** The pieces that the arrows alone reach from `start`, however many presses it takes. */
export function reachable(moves: Moves, start: string): Set<string> {
  const seen = new Set<string>([start]);
  const stack = [start];
  while (stack.length) {
    const id = stack.pop()!;
    for (let arrow = 0; arrow < 4; arrow++) {
      const next = moveFrom(moves, id, arrow);
      if (next && !seen.has(next)) {
        seen.add(next);
        stack.push(next);
      }
    }
  }
  return seen;
}
