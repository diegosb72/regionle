// The physical map of Spain is drawn from the Atlas Nacional de España (CartoBase ANE, CC BY 4.0
// ign.es) at 1:3 000 000: rivers, reservoirs and the heights of the land. Natural Earth, which the
// rest of the physical maps come from, knows five rivers and four ranges in the whole country.
//
// Three things are worked out here, all from those layers:
//   · a river as one line: the atlas cuts it wherever a reservoir stands in its way, and the gap is
//     bridged along the water of that reservoir;
//   · a range or a plain as an outline: the land above (or below) a height inside a rough box;
//   · a reservoir as it is drawn.
//
// What is asked for, and under which name, is decided in physical-config.mjs.

import path from 'node:path';
import { readShapefile } from './shp.mjs';

const KM = 111.2;
const dist = (a, b) => Math.hypot((a[0] - b[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180), a[1] - b[1]) * KM;

const inRing = (p, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// ---------------------------------------------------------------------------
// Heights
// ---------------------------------------------------------------------------

/** The grid the heights are laid on: cells of a hundredth of a degree, about a kilometre. */
const GRID = { w: -9.7, s: 35.5, e: 4.7, n: 44.1, step: 0.01 };
const COLS = Math.round((GRID.e - GRID.w) / GRID.step);
const ROWS = Math.round((GRID.n - GRID.s) / GRID.step);
const SEA = -1;

/**
 * The atlas gives the land in bands of height (0 to 200 m, 200 to 400, 400 to 700, 700 to 1000, 1000 to
 * 1500…), each one an area. Laid on a grid, every cell holds the foot of its band, or `SEA`.
 */
function heightGrid(bands) {
  const grid = new Int16Array(COLS * ROWS).fill(SEA);
  for (const f of bands) {
    const foot = f.properties.val_inf;
    if (!(foot >= 0)) continue;
    const rings = f.geometry.type === 'Polygon' ? f.geometry.coordinates : f.geometry.coordinates.flat();
    /** row → where the outline of the band crosses the middle of that row */
    const hits = new Map();
    for (const ring of rings)
      for (let i = 0; i < ring.length - 1; i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[i + 1];
        if (ay === by) continue;
        const lo = Math.min(ay, by);
        const hi = Math.max(ay, by);
        const from = Math.max(0, Math.ceil((lo - GRID.s) / GRID.step - 0.5));
        const to = Math.min(ROWS - 1, Math.ceil((hi - GRID.s) / GRID.step - 0.5) - 1);
        for (let r = from; r <= to; r++) {
          const y = GRID.s + (r + 0.5) * GRID.step;
          if (!hits.has(r)) hits.set(r, []);
          hits.get(r).push(ax + ((y - ay) * (bx - ax)) / (by - ay));
        }
      }
    for (const [r, xs] of hits) {
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const from = Math.max(0, Math.ceil((xs[k] - GRID.w) / GRID.step - 0.5));
        const to = Math.min(COLS - 1, Math.ceil((xs[k + 1] - GRID.w) / GRID.step - 0.5) - 1);
        for (let c = from; c <= to; c++) grid[r * COLS + c] = foot;
      }
    }
  }
  return grid;
}

/** Grows (or shrinks, with `to` 0) what is marked by `radius` cells all round. */
function spread(mask, cols, rows, radius, to) {
  if (radius <= 0) return mask;
  const out = mask.slice();
  const reach = [];
  for (let dy = -radius; dy <= radius; dy++) for (let dx = -radius; dx <= radius; dx++) if (dx * dx + dy * dy <= radius * radius + 1) reach.push([dx, dy]);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      if (mask[r * cols + c] !== to) continue;
      for (const [dx, dy] of reach) {
        const x = c + dx;
        const y = r + dy;
        if (x >= 0 && x < cols && y >= 0 && y < rows) out[y * cols + x] = to;
      }
    }
  return out;
}

/** The pieces of a mask that hang together, the biggest first: each one a list of cells. */
function pieces(mask, cols, rows) {
  const seen = new Uint8Array(mask.length);
  const out = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    const cells = [start];
    seen[start] = 1;
    for (let k = 0; k < cells.length; k++) {
      const at = cells[k];
      const c = at % cols;
      const r = (at - c) / cols;
      for (const [x, y] of [[c + 1, r], [c - 1, r], [c, r + 1], [c, r - 1]]) {
        if (x < 0 || x >= cols || y < 0 || y >= rows) continue;
        const next = y * cols + x;
        if (mask[next] && !seen[next]) {
          seen[next] = 1;
          cells.push(next);
        }
      }
    }
    out.push(cells);
  }
  return out.sort((a, b) => b.length - a.length);
}

/** The outline of a piece, along the sides of its cells, with the piece on the left: its outer ring. */
function outline(cells, cols) {
  const inside = new Set(cells);
  /** corner → the sides that start there */
  const sides = new Map();
  const add = (x1, y1, x2, y2) => {
    const k = `${x1},${y1}`;
    if (!sides.has(k)) sides.set(k, []);
    sides.get(k).push([x2, y2]);
  };
  for (const at of cells) {
    const c = at % cols;
    const r = (at - c) / cols;
    if (!inside.has(at - cols)) add(c, r, c + 1, r);
    if (c + 1 >= cols || !inside.has(at + 1)) add(c + 1, r, c + 1, r + 1);
    if (!inside.has(at + cols)) add(c + 1, r + 1, c, r + 1);
    if (c === 0 || !inside.has(at - 1)) add(c, r + 1, c, r);
  }
  let best = [];
  let bestArea = 0;
  for (const [start, list] of sides) {
    while (list.length) {
      const [sx, sy] = start.split(',').map(Number);
      const ring = [[sx, sy]];
      let next = list.pop();
      for (;;) {
        ring.push(next);
        if (next[0] === sx && next[1] === sy) break;
        const more = sides.get(`${next[0]},${next[1]}`);
        if (!more?.length) break;
        next = more.pop();
      }
      let area = 0;
      for (let i = 0; i < ring.length - 1; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
      if (Math.abs(area) > bestArea) {
        bestArea = Math.abs(area);
        best = ring;
      }
    }
  }
  return best;
}

/** Corners cut twice over: the steps of the grid become a curve. */
function smooth(ring, times = 2) {
  let pts = ring.slice(0, -1);
  for (let t = 0; t < times; t++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    pts = out;
  }
  return [...pts, pts[0]];
}

/** Douglas–Peucker on a closed ring, cut at its two farthest corners. */
function thin(ring, tol) {
  const line = (pts) => {
    if (pts.length <= 2) return pts;
    const [ax, ay] = pts[0];
    const [bx, by] = pts[pts.length - 1];
    const len = Math.hypot(bx - ax, by - ay) || 1e-12;
    let worst = 0;
    let at = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = Math.abs((bx - ax) * (ay - pts[i][1]) - (ax - pts[i][0]) * (by - ay)) / len;
      if (d > worst) {
        worst = d;
        at = i;
      }
    }
    return worst > tol ? [...line(pts.slice(0, at + 1)).slice(0, -1), ...line(pts.slice(at))] : [pts[0], pts[pts.length - 1]];
  };
  let far = 1;
  for (let i = 1; i < ring.length - 1; i++) if (Math.hypot(ring[i][0] - ring[0][0], ring[i][1] - ring[0][1]) > Math.hypot(ring[far][0] - ring[0][0], ring[far][1] - ring[0][1])) far = i;
  return [...line(ring.slice(0, far + 1)).slice(0, -1), ...line(ring.slice(far))];
}

export function loadSpain(src) {
  const read = (name) => readShapefile(path.join(src, name));
  const riverRows = read('se89_3_hidro_rio_l_x');
  const waters = read('se89_3_hidro_rio_a_x').map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const all = polys.flat(2);
    return { name: f.properties.rotulo, kind: f.properties.t_rio, polys, box: [Math.min(...all.map((p) => p[0])), Math.min(...all.map((p) => p[1])), Math.max(...all.map((p) => p[0])), Math.max(...all.map((p) => p[1]))] };
  });

  const byRiver = new Map();
  for (const f of riverRows) {
    const id = f.properties.id_rio;
    if (!byRiver.has(id)) byRiver.set(id, []);
    byRiver.get(id).push(f.geometry.coordinates);
  }

  /**
   * The stretches of a river put end to end. `ids` are the codes the atlas knows it by (one in Spain,
   * another one for its Portuguese course). Returns the lines and what had to be done to join them.
   */
  function river(ids) {
    let chains = ids.flatMap((id) => byRiver.get(id) ?? []).map((line) => line.slice());
    const notes = { pieces: chains.length, joined: 0, gaps: [] };
    if (!chains.length) return { lines: [], notes };
    const same = (a, b) => Math.abs(a[0] - b[0]) < 2e-5 && Math.abs(a[1] - b[1]) < 2e-5;
    const ends = (c) => [c[0], c[c.length - 1]];
    /** Joins two chains at the given ends. */
    const join = (i, ei, j, ej) => {
      const a = ei === 1 ? chains[i] : chains[i].slice().reverse();
      const b = ej === 0 ? chains[j] : chains[j].slice().reverse();
      const merged = same(a[a.length - 1], b[0]) ? [...a, ...b.slice(1)] : [...a, ...b];
      chains = chains.filter((_, k) => k !== i && k !== j);
      chains.push(merged);
    };
    // Stretches that share an end.
    for (let again = true; again; ) {
      again = false;
      outer: for (let i = 0; i < chains.length; i++)
        for (let j = i + 1; j < chains.length; j++)
          for (const ei of [0, 1])
            for (const ej of [0, 1])
              if (same(ends(chains[i])[ei], ends(chains[j])[ej])) {
                join(i, ei, j, ej);
                again = true;
                break outer;
              }
    }
    // A stretch that stops a little short of the next one (the atlas leaves a few such gaps): the nearest ends first.
    for (;;) {
      let pick = null;
      for (let i = 0; i < chains.length; i++)
        for (let j = i + 1; j < chains.length; j++)
          for (const ei of [0, 1])
            for (const ej of [0, 1]) {
              const d = dist(ends(chains[i])[ei], ends(chains[j])[ej]);
              if (!pick || d < pick.d) pick = { i, ei, j, ej, d };
            }
      if (!pick) break;
      if (pick.d > 5) {
        notes.gaps.push(Math.round(pick.d));
        break;
      }
      join(pick.i, pick.ei, pick.j, pick.ej);
      notes.joined++;
    }
    return { lines: chains, notes };
  }

  /** A reservoir or a lagoon by the name the atlas gives it: its outer rings. */
  const water = (name) => waters.filter((w) => w.name === name).flatMap((w) => w.polys.map((rings) => rings[0]));

  let grid = null;
  /**
   * The land between two heights inside a box drawn by hand, as outlines: `min` and `max` are feet of
   * bands (the land from `min` up to, but not counting, `max`). `also` lists more boxes with heights of
   * their own, for a range that is lower at one end. `close` fills the valleys narrower than twice that
   * many kilometres and `open` then drops the spurs thinner than that; what is left in pieces smaller
   * than `keep` times the biggest is dropped too.
   */
  function relief({ within, min = 0, max = Infinity, also = [], close = 6, open = 2, keep = 0.2 }) {
    grid ??= heightGrid(read('se89_3_orog_hipso_a_x'));
    const parts = [{ within, min, max }, ...also].map((part) => ({ min: part.min ?? 0, max: part.max ?? Infinity, box: [...part.within, part.within[0]] }));
    const xs = parts.flatMap((part) => part.box.map((p) => p[0]));
    const ys = parts.flatMap((part) => part.box.map((p) => p[1]));
    const pad = close + 2;
    const c0 = Math.max(0, Math.floor((Math.min(...xs) - GRID.w) / GRID.step) - pad);
    const c1 = Math.min(COLS, Math.ceil((Math.max(...xs) - GRID.w) / GRID.step) + pad);
    const r0 = Math.max(0, Math.floor((Math.min(...ys) - GRID.s) / GRID.step) - pad);
    const r1 = Math.min(ROWS, Math.ceil((Math.max(...ys) - GRID.s) / GRID.step) + pad);
    const cols = c1 - c0;
    const rows = r1 - r0;
    let mask = new Uint8Array(cols * rows);
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        const h = grid[(r + r0) * COLS + c + c0];
        if (h === SEA) continue;
        const at = [GRID.w + (c + c0 + 0.5) * GRID.step, GRID.s + (r + r0 + 0.5) * GRID.step];
        if (parts.some((part) => h >= part.min && h < part.max && inRing(at, part.box))) mask[r * cols + c] = 1;
      }
    mask = spread(spread(mask, cols, rows, close, 1), cols, rows, close, 0);
    mask = spread(spread(mask, cols, rows, open, 0), cols, rows, open, 1);
    // A hollow in the middle is part of the thing: only what the outside reaches is left out.
    const outside = pieces(mask.map((v) => 1 - v), cols, rows).filter((cells) => cells.some((at) => at % cols === 0 || at % cols === cols - 1 || at < cols || at >= cols * (rows - 1)));
    const filled = new Uint8Array(cols * rows).fill(1);
    for (const cells of outside) for (const at of cells) filled[at] = 0;
    const all = pieces(filled, cols, rows);
    if (!all.length) return [];
    return all
      .filter((cells) => cells.length >= all[0].length * keep)
      .map((cells) => smooth(thin(outline(cells, cols), 1.6)).map(([x, y]) => [GRID.w + (x + c0) * GRID.step, GRID.s + (y + r0) * GRID.step]));
  }

  return { river, water, waters, relief, riverIds: [...byRiver.keys()] };
}
