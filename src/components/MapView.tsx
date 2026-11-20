import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { Expand, Maximize, Minus, Plus, Shrink } from 'lucide-react';
import { forwardRef, memo, useCallback, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { GeoPermissibleObjects } from 'd3-geo';
import type { MultiLineString } from 'geojson';
import { fmtLat, fmtLon, gridLines } from '../lib/coords';
import { useFullscreen } from '../lib/fullscreen';
import { NOMINAL, coarsePath, countPoints, graticule, landBox, makeView, spotInFrame } from '../lib/geo';
import { L } from '../lib/i18n';
import { ARROWS, inOrder, moveFrom, movesOf, nearestTo, type Moves } from '../lib/mapKeys';
import { TEXT_SCALE, labelScale } from '../lib/reading';
import { useStore } from '../lib/store';
import { cx } from '../lib/text';
import type { AnyGeo, Deck, Item, LL } from '../lib/types';

/** Look of an item on the map. */
/** How a piece is painted. `h1` to `h6` are the colours of a map painted by hand (lib/hand.ts), which come with that tool (games/hand.css). */
export type Paint = 'ok' | 'warn' | 'bad' | 'target' | 'from' | 'to' | 'sel' | 'near' | 'dim' | 'due' | 'stop' | 'shut' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface MapHandle {
  /**
   * Brings items into view, zooming in when they are too small to see. With `passing`, the view that is
   * left behind is remembered, so that `restore` can go back to it. `apart` is how many pixels several
   * things must take up between them to be left as they are (36 unless said): two names need more room
   * than two shapes. They are then brought that far apart and half as much again, and no closer.
   * `legible` is something that must stay readable with all of that in view: where it would be drawn
   * smaller than `px` pixels across, the map comes closer, around it, and leaves the rest half out.
   */
  focus(ids: string[], opts?: FocusOpts): void;
  /** Back to the whole deck. */
  reset(): void;
  /** Back to where the player was before a passing `focus`; nothing when they have moved the map since. */
  restore(): void;
  /** Whether a place is on the map: in sight when the whole of it is. */
  shows(ll: LL): boolean;
}

interface Props {
  deck: Deck;
  paint?: Readonly<Record<string, Paint | undefined>>;
  /** Items react to the pointer and report clicks: a click, or Enter with the keyboard cursor on one, is an answer. */
  pickable?: boolean;
  /**
   * The pieces look like something to click although no answer is being asked: the game takes a click
   * for something else (on the answer it has just shown, to go on). The keyboard is not involved.
   */
  pressable?: boolean;
  onPick?: (id: string) => void;
  /** Names drawn when there is room for them. */
  labels?: ReadonlySet<string> | 'all';
  /** Names always drawn. */
  pinned?: ReadonlySet<string>;
  /** Text shown when the pointer rests on an item; nothing when it returns a falsy value. */
  tip?: (id: string) => string | null | undefined;
  /** Hides the borders of unpainted items. */
  blind?: boolean;
  /** Dashed connections, e.g. sea crossings. */
  links?: [LL, LL][];
  flash?: { id: string; kind: 'bad' | 'ok'; n: number } | null;
  /** A click anywhere on the map reports where it fell, instead of what it fell on. */
  onPoint?: (ll: LL) => void;
  /**
   * When given, the only dots, lines and surfaces of the deck that are drawn: the rest stay off the map
   * (placing cities, rivers or seas blind). Not for maps whose pieces are the land itself: those are left
   * without borders with `blind`.
   */
  only?: ReadonlySet<string>;
  /**
   * Pins that are not items: where the player clicked; `heat-0` to `heat-4`, how warm that click was; `spot`,
   * the place that was asked for; `ask`, a place the question is about.
   */
  marks?: { ll: LL; kind: MarkKind }[];
  /** Lines drawn over the pieces, thick enough to stand out. */
  traces?: Trace[];
  /**
   * A grid of parallels and meridians over the map, this many degrees apart, each with its latitude or
   * its longitude written where it meets an edge of what is in view: parallels on the left, meridians at
   * the top or at the bottom.
   */
  grid?: number;
}

export type MarkKind = 'guess' | 'spot' | 'ask' | 'heat-0' | 'heat-1' | 'heat-2' | 'heat-3' | 'heat-4';

export interface FocusOpts {
  force?: boolean;
  fill?: number;
  instant?: boolean;
  passing?: boolean;
  apart?: number;
  legible?: { points: LL[]; px: number };
}

/** A line drawn over the map that is not one of its pieces: the border between two of them. */
export interface Trace {
  geo: MultiLineString;
  /** How it is painted: as what is being asked, or as the answer turned out. */
  st?: 'ask' | Paint;
}

interface Shape {
  id: string;
  name: string;
  /** A surface, a line (rivers) or a dot (cities). */
  kind: Item['shape'];
  /** Kind of physical feature, which decides its colours. */
  cls?: string;
  /** Drawn under the land. */
  under?: boolean;
  /** Path data: the light version on heavy maps, the full one otherwise. */
  d: string;
  /** Exact bounds, known only on heavy maps, where they decide which shapes get their full detail. */
  bb: [number, number, number, number] | null;
  x: number;
  y: number;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Larger side of the bounding box, in view units. */
  size: number;
  /** Larger side of the biggest single piece of land: what the eye actually finds in an archipelago. */
  land: number;
}

/** Items smaller than this on screen get a ring so that they can be seen and clicked. */
const RING_BELOW = 13;
const RING_R = 10;
/** Rings and names are reconsidered this many times per doubling of the zoom. */
const STEPS = 4;
/** Size on screen from which a single item counts as seen and the map stops moving towards it. */
const SEEN = 14;
/** Highlighted items whose biggest piece is smaller than this get a halo around them. */
const HALO_BELOW = 30;
const HALO_GONE = 46;

/** Size in view units of the biggest polygon of a multi-part shape: the larger side of its box. */
function biggestPiece(geo: AnyGeo, project: (p: LL) => [number, number] | null): number | null {
  const box = landBox(geo, project);
  return box ? Math.max(box[0], box[1], 0.02) : null;
}

/** Prefix that keeps the ids of national outlines apart from those of the shapes. */
const OUTLINE = '~';
/** Maps with more points than this are drawn in a light version until the player zooms in. */
const HEAVY = 60_000;
/** Size on screen, in pixels, of the grid the light version is rounded to when the map is seen whole. */
const LIGHT_GRID = 0.4;

function build(deck: Deck) {
  const view = makeView(deck.frame);
  const { path, projection } = view;
  const geos = new Map(deck.items.map((it) => [it.id, it.geo]));
  // Only maps made of surfaces have a light version: lines and dots are few and cheap.
  const heavy = deck.items.every((it) => it.shape === 'area') && countPoints(deck.items.map((it) => it.geo)) > HEAVY;
  // The grid is fixed in map units; the window gives a fair idea of how large a unit will be drawn.
  const scale = typeof window === 'undefined' ? 1 : Math.max(window.innerWidth, window.innerHeight, 600) / NOMINAL;
  const grid = LIGHT_GRID / scale;
  const light = heavy ? coarsePath(projection, grid) : null;
  const shapes: Shape[] = [];
  /** A dot stands for this much of the map when something has to be brought into view. */
  const DOT = NOMINAL * 0.02;
  for (const it of deck.items) {
    if (it.shape === 'point') {
      const c = projection(it.lp);
      if (c) shapes.push({ id: it.id, name: it.name, kind: 'point', cls: it.cat, d: '', bb: null, x: c[0], y: c[1], x0: c[0] - DOT, y0: c[1] - DOT, x1: c[0] + DOT, y1: c[1] + DOT, size: DOT * 2, land: DOT * 2 });
      continue;
    }
    let d: string;
    let bb: Shape['bb'] = null;
    if (light) {
      d = light.draw(it.geo);
      bb = light.bounds();
      if (!bb) continue;
    } else {
      d = path(it.geo) || '';
      if (!d) continue;
    }
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of it.fp) {
      const q = projection(p);
      if (!q) continue;
      if (q[0] < x0) x0 = q[0];
      if (q[0] > x1) x1 = q[0];
      if (q[1] < y0) y0 = q[1];
      if (q[1] > y1) y1 = q[1];
    }
    let c = projection(it.lp) ?? [(x0 + x1) / 2, (y0 + y1) / 2];
    if (!Number.isFinite(x0)) {
      x0 = x1 = c[0];
      y0 = y1 = c[1];
    }
    // A feature much bigger than the map (an ocean beside a continent, a plain of half Europe on the map of one
    // country) has its name far away: it is written on the part that is in sight.
    if (it.kind === 'feature' && (c[0] < view.box[0] || c[0] > view.box[2] || c[1] < view.box[1] || c[1] > view.box[3])) c = spotInFrame(it.geo, projection, view.box) ?? c;
    const size = Math.max(x1 - x0, y1 - y0, 0.02);
    shapes.push({ id: it.id, name: it.name, kind: it.shape, cls: it.cat, under: it.under, d, bb, x: c[0], y: c[1], x0, y0, x1, y1, size, land: Math.min(size, biggestPiece(it.geo, projection) ?? size) });
  }
  // One path per country, never one for all: the browser paints in tiles and skips whatever lies
  // outside each tile, which it cannot do with a single path that spans the planet.
  const outlines: { id: string; d: string; bb: Shape['bb'] }[] = [];
  const lines = new Map<string, GeoPermissibleObjects>();
  for (const o of deck.outline) {
    const d = light ? light.draw(o.geo) : path(o.geo) || '';
    const bb = light ? light.bounds() : null;
    if (!d && !bb) continue;
    outlines.push({ id: OUTLINE + o.id, d, bb });
    lines.set(OUTLINE + o.id, o.geo);
  }
  const ctx: string[] = [];
  for (const c of deck.context) {
    const d = path(c);
    if (d) ctx.push(d);
  }
  const base: string[] = [];
  for (const c of deck.base ?? []) {
    const d = path(c);
    if (d) base.push(d);
  }
  const full = new Map<string, string>();
  return {
    view,
    shapes,
    /** What is drawn as a path, under the land (seas) and over it. */
    under: shapes.filter((s) => s.under),
    over: shapes.filter((s) => !s.under && s.kind !== 'point'),
    byId: new Map(shapes.map((s) => [s.id, s])),
    ctx,
    base,
    outlines,
    /** Zoom from which the light version starts to look blocky, or 0 when the map is not heavy. */
    detailK: light ? 0.9 / grid : 0,
    /** Full path data of a shape or an outline, worked out the first time it is asked for. */
    fullOf(id: string): string {
      let d = full.get(id);
      if (d == null) {
        const geo = geos.get(id) ?? lines.get(id);
        d = (geo && path(geo)) || '';
        full.set(id, d);
      }
      return d;
    },
    extras: deck.extras.map((e) => ({ id: e.id, name: e.name, d: path(e.geo) || '' })),
    sphere: path({ type: 'Sphere' }) || '',
    grat: path(graticule()) || '',
    minSize: shapes.reduce((m, s) => Math.min(m, s.size), Infinity),
  };
}

const ShapePath = memo(function ShapePath({ id, d, st, cls }: { id: string; d: string; st?: string; cls?: string }) {
  return <path d={d} data-id={id} className={cx(cls && `k-${cls}`, st && `st-${st}`) || undefined} />;
});

/** A river: the line that is seen and, over it, a much wider one that takes the pointer. */
const LinePath = memo(function LinePath({ id, d, st, cls }: { id: string; d: string; st?: string; cls?: string }) {
  return (
    <g className="m-line">
      <path d={d} data-id={id} className={cx('ln', cls && `k-${cls}`, st && `st-${st}`)} />
      <path d={d} data-id={id} className="ln-hit" />
    </g>
  );
});

const OutlinePath = memo(function OutlinePath({ d }: { d: string }) {
  return <path className="m-outline" d={d} />;
});

/** Sea and graticule: drawn once per map. */
const Backdrop = memo(function Backdrop({ sphere, grat }: { sphere: string; grat: string }) {
  return (
    <>
      <path className="m-sphere" d={sphere} />
      <path className="m-grat" d={grat} />
    </>
  );
});

/** The rest of the world, muted, and the land that the items lie on: drawn once per map. */
const Land = memo(function Land({ ctx, base }: { ctx: string[]; base: string[] }) {
  return (
    <>
      <g className="m-ctx">
        {ctx.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      {base.length > 0 && (
        <g className="m-base">
          {base.map((d, i) => (
            <path key={i} d={d} />
          ))}
        </g>
      )}
    </>
  );
});

type PaintMap = Readonly<Record<string, Paint | undefined>>;

/**
 * Which small items get a ring at zoom `k`. A ring helps to find a speck that stands alone; where
 * dozens of specks pile up (the regions of Europe seen from a world map) rings would only bury the
 * map, so crowds get none until the player zooms in and they come apart. Items the game is pointing
 * at always keep theirs.
 */
function pickRings(shapes: Shape[], k: number, paint: PaintMap | undefined): Shape[] {
  const small = shapes.filter((s) => s.kind === 'area' && s.size * k < RING_BELOW);
  if (small.length < 4) return small;
  const cell = RING_R * 2.4;
  const grid = new Map<string, Shape[]>();
  const cellOf = (s: Shape): [number, number] => [Math.floor((s.x * k) / cell), Math.floor((s.y * k) / cell)];
  for (const s of small) {
    const [cx, cy] = cellOf(s);
    const key = `${cx},${cy}`;
    const list = grid.get(key);
    if (list) list.push(s);
    else grid.set(key, [s]);
  }
  return small.filter((s) => {
    const st = paint?.[s.id];
    if (st && st !== 'dim') return true;
    const [cx, cy] = cellOf(s);
    let near = 0;
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++) {
        const list = grid.get(`${cx + dx},${cy + dy}`);
        if (!list) continue;
        for (const o of list) {
          if (o === s) continue;
          if (Math.hypot((o.x - s.x) * k, (o.y - s.y) * k) < cell && ++near >= 3) return false;
        }
      }
    return true;
  });
}

interface OverlayHandle {
  zoomed(k: number): void;
}

interface OverlayProps {
  shapes: Shape[];
  paint?: PaintMap;
  labels?: ReadonlySet<string> | 'all';
  pinned?: ReadonlySet<string>;
  only?: ReadonlySet<string>;
  marks?: { x: number; y: number; kind: string }[];
  /** Keyboard: the item the cursor is on, and what may be said of it. */
  cursor?: Shape | null;
  cursorText?: string | null;
  /** Keyboard: the cross that marks a spot. */
  cross?: readonly [number, number] | null;
}

/**
 * Rings and names: the only parts of the map that keep their size on screen. They live in their own
 * component so that zooming a map of thousands of shapes re-renders nothing else, and only what is
 * visible at the current zoom is in the document at all.
 */
const Overlay = memo(
  forwardRef<OverlayHandle, OverlayProps>(function Overlay({ shapes, paint, labels, pinned, only, marks, cursor, cursorText, cross }, ref) {
    const gRef = useRef<SVGGElement>(null);
    const stepRef = useRef<number | null>(null);
    const [step, setStep] = useState<number | null>(null);

    useImperativeHandle(
      ref,
      () => ({
        zoomed(k) {
          gRef.current?.style.setProperty('--ik', String(1 / k));
          const next = Math.floor(Math.log2(k) * STEPS);
          if (next !== stepRef.current) {
            stepRef.current = next;
            setStep(next);
          }
        },
      }),
      [],
    );

    const k = step == null ? 0 : 2 ** (step / STEPS);
    // A larger letter, or the typeface for dyslexia, and each name takes more room: fewer of them fit.
    const textSize = useStore((st) => st.textSize);
    const dyslexia = useStore((st) => st.dyslexia);
    const tall = TEXT_SCALE[textSize];
    const wide = labelScale({ textSize, dyslexia });
    const rings = useMemo(() => (k ? pickRings(only ? shapes.filter((s) => only.has(s.id)) : shapes, k, paint) : []), [shapes, k, paint, only]);

    const dots = useMemo(() => shapes.filter((s) => s.kind === 'point' && (!only || only.has(s.id))), [shapes, only]);
    const named = useMemo(() => {
      if (!labels && !pinned?.size) return [];
      const out: { s: Shape; min: number; pin: boolean }[] = [];
      for (const s of shapes) {
        const pin = !!pinned?.has(s.id);
        if (!pin && !(labels === 'all' || labels?.has(s.id))) continue;
        if (only && !only.has(s.id)) continue;
        // A dot has no room of its own: whether its name fits depends on what lies around it, and is settled below.
        const room = s.kind === 'point' ? Infinity : Math.max(s.x1 - s.x0, (s.y1 - s.y0) * 0.6, 0.02);
        out.push({ s, pin, min: pin ? 0 : ((s.name.length * 6.3 * wide + 8) * 0.9) / room });
      }
      return out;
    }, [shapes, labels, pinned, only, wide]);
    /** Maps of dots, and physical maps that mix kinds lying on top of one another (a river crossing a desert): names can collide. */
    const crowded = useMemo(() => shapes.some((s) => s.kind !== 'area' || !!s.cls), [shapes]);
    const shown = useMemo(() => {
      if (!k) return [];
      const fit = named.filter((l) => l.min <= k);
      if (!crowded || !fit.length) return fit;
      // Pinned names first, then those of the bigger features; a name that would sit on another, or on a dot, waits for more zoom.
      const placed: [number, number, number][] = [];
      return [...fit]
        .sort((a, b) => Number(b.pin) - Number(a.pin) || a.min - b.min)
        .filter((l) => {
          const half = (l.s.name.length * 6.3 * wide + 10) / 2;
          const x = l.s.x * k;
          const y = l.s.y * k - (l.s.kind === 'point' ? 12 * tall : 0);
          if (!l.pin) {
            if (placed.some((q) => Math.abs(q[0] - x) < q[2] + half && Math.abs(q[1] - y) < 15 * tall)) return false;
            if (l.s.kind === 'point' && dots.some((d) => d !== l.s && Math.abs(d.x * k - x) < half + 6 && Math.abs(d.y * k - y) < 13 * tall)) return false;
          }
          placed.push([x, y, half]);
          return true;
        });
    }, [named, k, crowded, dots, wide, tall]);

    const cursorSmall = !!cursor && (cursor.kind === 'point' || cursor.size * k < 26);

    return (
      <g ref={gRef}>
        <g className="m-rings">
          {rings.map((s) => (
            <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
              <circle r={RING_R} data-id={s.id} className={cx('m-ring', paint?.[s.id] && `st-${paint[s.id]}`)} />
            </g>
          ))}
        </g>
        {dots.length > 0 && (
          <g className="m-dots">
            {dots.map((s) => (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
                {s.cls === 'peak' ? (
                  <path d="M0 -6.4 6.2 4.6H-6.2Z" data-id={s.id} className={cx('m-dot', 'k-peak', paint?.[s.id] && `st-${paint[s.id]}`)} />
                ) : s.cls === 'cape' ? (
                  <path d="M0 -6 6 0 0 6 -6 0Z" data-id={s.id} className={cx('m-dot', 'k-cape', paint?.[s.id] && `st-${paint[s.id]}`)} />
                ) : s.cls === 'fall' ? (
                  <path d="M0 -7C2.6 -3.4 5 -0.6 5 2a5 5 0 0 1-10 0C-5 -0.6 -2.6 -3.4 0 -7Z" data-id={s.id} className={cx('m-dot', 'k-fall', paint?.[s.id] && `st-${paint[s.id]}`)} />
                ) : (
                  <circle r={4.6} data-id={s.id} className={cx('m-dot', paint?.[s.id] && `st-${paint[s.id]}`)} />
                )}
                <circle r={13} data-id={s.id} className="m-dot-hit" />
              </g>
            ))}
          </g>
        )}
        {marks && marks.length > 0 && (
          <g className="m-marks">
            {marks.map((m, i) => (
              <g key={i} transform={`translate(${m.x} ${m.y})`}>
                <g className={`m-mark m-mark-${m.kind}`}>
                  <circle r={9} className="m-mark-ring" />
                  <path d="M-5 -5 5 5M5 -5-5 5" />
                </g>
              </g>
            ))}
          </g>
        )}
        <g className="m-labels">
          {shown.map(({ s, pin }) =>
            // The name under the keyboard cursor is written by the cursor itself.
            cursorText && s.id === cursor?.id ? null : (
              <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
                <text className={cx('m-lbl', pin && 'm-lbl-pin')} y={s.kind === 'point' ? -12 * tall : undefined}>
                  {s.name}
                </text>
              </g>
            ),
          )}
        </g>
        {cursor && (
          <g transform={`translate(${cursor.x} ${cursor.y})`} className="m-cur-at">
            {/* A dot, or a piece too small for its outline to be seen, gets a ring around it. */}
            {cursorSmall && <circle r={cursor.kind === 'point' ? 11 : RING_R + 5} className="m-cur-ring" />}
            {cursorText && (
              <text className="m-lbl m-lbl-pin m-lbl-cur" y={cursorSmall ? -(cursor.kind === 'point' ? 11 + 11 * tall : RING_R + 5 + 11 * tall) : undefined}>
                {cursorText}
              </text>
            )}
          </g>
        )}
        {cross && (
          <g transform={`translate(${cross[0]} ${cross[1]})`}>
            <g className="m-cross">
              <circle r={12} />
              <path d="M-22 0H-5M5 0H22M0 -22V-5M0 5V22" />
            </g>
          </g>
        )}
      </g>
    );
  }),
);

/** A line of the grid as it is drawn, and the points it goes through, to find where it leaves the view. */
interface GridShape {
  kind: 'lat' | 'lon';
  at: number;
  d: string;
  pts: [number, number][];
}

/** What is in view, in the units of the map, and the zoom it is seen at. */
interface InView {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  k: number;
}

interface GridHandle {
  /** The map has moved or changed size: `k` is the zoom it is now seen at. */
  moved(k: number): void;
}

/**
 * Where a line drawn through `pts` crosses the edge `value` of the view along `axis` (0: a vertical edge,
 * 1: a horizontal one), within the view on the other axis. Walked from the far end when `back` is set.
 */
function crossing(pts: [number, number][], axis: 0 | 1, value: number, lo: number, hi: number, back: boolean): [number, number] | null {
  const other = axis === 0 ? 1 : 0;
  for (let n = 0; n + 1 < pts.length; n++) {
    const i = back ? pts.length - 2 - n : n;
    const a = pts[i];
    const b = pts[i + 1];
    if ((a[axis] - value) * (b[axis] - value) > 0 || a[axis] === b[axis]) continue;
    // Two points a world apart are the two ends of a line cut by the edge of the map, not a stretch of it.
    if (Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) > NOMINAL / 3) continue;
    const f = (value - a[axis]) / (b[axis] - a[axis]);
    const o = a[other] + (b[other] - a[other]) * f;
    if (o < lo || o > hi) continue;
    return axis === 0 ? [value, o] : [o, value];
  }
  return null;
}

/** Of every how many lines one is named, when there is no room for all: always multiples of a round number of degrees. */
const GRID_EVERY: Record<string, number[]> = { 1: [1, 2, 5, 10], 2: [1, 2, 5, 10], 5: [1, 2, 4, 6, 12], 15: [1, 2, 3, 6], 3: [1, 2, 3, 6] };

interface GridName {
  key: string;
  x: number;
  y: number;
  text: string;
  /** Where the name is written from the point: over a parallel, and below the top edge or above the bottom one for a meridian. */
  dy: number;
}

/**
 * The names of the lines of a grid: each parallel where it comes in from the left of what is in view, each
 * meridian where it meets the top or the bottom, whichever has them farther apart (they close in towards the
 * poles). Where the lines are too close for every name, only some are written: the multiples of a round
 * number, so that the rest can be counted.
 */
function gridLabels(lines: GridShape[], step: number, win: InView): GridName[] {
  const { x0, y0, x1, y1, k } = win;
  const px = (n: number) => n / k;
  const inside = (p: [number, number] | undefined): p is [number, number] => !!p && p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1;
  const digits = step < 1 ? 1 : 0;
  type Found = { l: GridShape; x: number; y: number };
  const left: Found[] = [];
  const top: Found[] = [];
  const bottom: Found[] = [];
  /** The end of a line that is in view: its point farthest to the left, to the top or to the bottom. */
  const end = (pts: [number, number][], axis: 0 | 1, sign: 1 | -1): [number, number] | null => {
    let best: [number, number] | null = null;
    for (const p of pts) if (inside(p) && (!best || (p[axis] - best[axis]) * sign < 0)) best = p;
    return best;
  };
  for (const l of lines) {
    if (!l.pts.length) continue;
    if (l.kind === 'lat') {
      // A line that starts inside the view (at the edge of the world) is named where it starts.
      const at = crossing(l.pts, 0, x0 + px(6), y0, y1, false) ?? end(l.pts, 0, 1);
      // The corners are left alone: a name cut short says nothing.
      if (at && at[1] > y0 + px(26) && at[1] < y1 - px(22)) left.push({ l, x: at[0], y: at[1] });
      continue;
    }
    const up = crossing(l.pts, 1, y0 + px(6), x0, x1, true) ?? end(l.pts, 1, 1);
    if (up && up[0] > x0 + px(48) && up[0] < x1 - px(44)) top.push({ l, x: up[0], y: up[1] });
    const down = crossing(l.pts, 1, y1 - px(6), x0, x1, false) ?? end(l.pts, 1, -1);
    // The buttons of the map take the corner on the right.
    if (down && down[0] > x0 + px(48) && down[0] < x1 - px(96)) bottom.push({ l, x: down[0], y: down[1] });
  }
  /** The least room, in pixels, between two lines that follow one another. */
  const room = (list: Found[], axis: 'x' | 'y') => {
    list.sort((a, b) => a[axis] - b[axis]);
    let gap = Infinity;
    for (let i = 1; i < list.length; i++) gap = Math.min(gap, (list[i][axis] - list[i - 1][axis]) * k);
    return gap;
  };
  const lead = String(step).replace(/[0.]/g, '');
  const stride = (gap: number, need: number) => {
    const all = GRID_EVERY[lead] ?? GRID_EVERY[1];
    return all.find((n) => gap * n >= need) ?? all[all.length - 1];
  };
  const out: GridName[] = [];
  const write = (list: Found[], every: number, dy: number) => {
    for (const f of list) {
      if (Math.round(f.l.at / step) % every !== 0) continue;
      out.push({ key: `${f.l.kind}${f.l.at}`, x: f.x, y: f.y, text: f.l.kind === 'lat' ? fmtLat(f.l.at, digits) : fmtLon(f.l.at, digits), dy });
    }
  };
  // A name is some fifteen pixels tall and, with its letter, fifty wide.
  write(left, stride(room(left, 'y'), 17), -4);
  const above = room(top, 'x');
  const below = room(bottom, 'x');
  const onTop = top.length > 1 && (bottom.length < 2 || above >= below * 0.9);
  if (onTop || !bottom.length) write(top, stride(above, 54), 11);
  else write(bottom, stride(below, 54), -5);
  return out;
}

/**
 * The grid of parallels and meridians, and their names. The lines move and grow with the map; the names are
 * written again, at the edges of what is then in view, once the map has stopped moving.
 */
const Grid = memo(
  forwardRef<GridHandle, { lines: GridShape[]; step: number; view(): InView | null }>(function Grid({ lines, step, view }, ref) {
    const gRef = useRef<SVGGElement>(null);
    const timer = useRef(0);
    const [win, setWin] = useState<InView | null>(null);
    useImperativeHandle(
      ref,
      () => ({
        moved(k) {
          gRef.current?.style.setProperty('--ik', String(1 / k));
          // What is in view is asked for when the names are written, not on every step of a move.
          window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setWin(view()), 90);
        },
      }),
      [view],
    );
    useEffect(() => () => window.clearTimeout(timer.current), []);
    const names = useMemo(() => (win ? gridLabels(lines, step, win) : []), [lines, step, win]);
    return (
      <g ref={gRef} className="m-grid">
        {lines.map((l) => (
          <path key={`${l.kind}${l.at}`} className={l.at === 0 ? 'm-grid-line zero' : 'm-grid-line'} d={l.d} />
        ))}
        {names.map((n) => (
          <g key={n.key} transform={`translate(${n.x} ${n.y})`}>
            <text className="m-grid-lbl" x={4} y={n.dy}>
              {n.text}
            </text>
          </g>
        ))}
      </g>
    );
  }),
);

export const MapView = forwardRef<MapHandle, Props>(function MapView({ deck, paint, pickable, pressable, onPick, labels, pinned, tip, blind, links, flash, onPoint, only, marks, traces, grid }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const overlayRef = useRef<OverlayHandle>(null);
  const gridRef = useRef<GridHandle>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tRef = useRef<ZoomTransform>(zoomIdentity);
  /** The view a passing `focus` moved away from. Forgotten as soon as the player moves the map. */
  const backRef = useRef<ZoomTransform | null>(null);
  /**
   * Where a move asked for by a game is taking the map, while it is on its way. What is in sight is judged
   * by it: asked for a view while still travelling to another, the map would otherwise take what it shows
   * on the way for where it is going to stop.
   */
  const goalRef = useRef<ZoomTransform | null>(null);
  const layoutRef = useRef<{ w: number; h: number; fit: ZoomTransform } | null>(null);
  const tipFn = useRef(tip);
  tipFn.current = tip;
  const [fitK, setFitK] = useState(0);
  /** On heavy maps: the shapes in view once the player has zoomed in, which are the ones drawn in full. */
  const [detailOf, setDetail] = useState<{ of: unknown; ids: ReadonlySet<string> } | null>(null);

  const g = useMemo(() => build(deck), [deck]);
  const detail = detailOf?.of === g ? detailOf.ids : null;

  /** Halos go away once the thing they point at is big enough to be seen without help. */
  const cull = () => {
    const root = rootRef.current;
    if (!root) return;
    const k = tRef.current.k;
    root.querySelectorAll<SVGGElement>('[data-halo]').forEach((el) => {
      el.style.display = Number(el.dataset.halo) * k > HALO_GONE ? 'none' : '';
    });
  };

  // Pan and zoom. Only the transform of the root group changes; on heavy maps the shapes that come
  // into view after zooming in also trade their light outline for the full one.
  useEffect(() => {
    const svg = svgRef.current!;
    const wrap = wrapRef.current!;
    let frame = 0;
    let refineTimer = 0;
    let refinedAt = 0;
    const refine = () => {
      refineTimer = 0;
      refinedAt = performance.now();
      const lay = layoutRef.current;
      if (!g.detailK || !lay) return;
      const t = tRef.current;
      let next: Set<string> | null = null;
      if (t.k >= g.detailK) {
        const mx = (lay.w * 0.25) / t.k;
        const my = (lay.h * 0.25) / t.k;
        const vx0 = -t.x / t.k - mx;
        const vy0 = -t.y / t.k - my;
        const vx1 = (lay.w - t.x) / t.k + mx;
        const vy1 = (lay.h - t.y) / t.k + my;
        next = new Set();
        for (const list of [g.shapes, g.outlines]) for (const s of list) if (s.bb && s.bb[2] >= vx0 && s.bb[0] <= vx1 && s.bb[3] >= vy0 && s.bb[1] <= vy1) next.add(s.id);
      }
      setDetail((cur) => {
        const ids = cur?.of === g ? cur.ids : null;
        if (!next) return ids ? null : cur;
        if (ids && ids.size === next.size) {
          let same = true;
          for (const id of next)
            if (!ids.has(id)) {
              same = false;
              break;
            }
          if (same) return cur;
        }
        return { of: g, ids: next };
      });
    };
    const apply = (t: ZoomTransform) => {
      tRef.current = t;
      // A move ends on the very view it was asked for.
      if (t === goalRef.current) goalRef.current = null;
      const root = rootRef.current;
      if (!root) return;
      root.setAttribute('transform', t.toString());
      // Textures are drawn in map units: undo the zoom, or the stripes would grow with it.
      svg.querySelectorAll<SVGPatternElement>('pattern[data-fixed]').forEach((el) => el.setAttribute('patternTransform', `scale(${1 / t.k}) rotate(${el.dataset.fixed})`));
      overlayRef.current?.zoomed(t.k);
      gridRef.current?.moved(t.k);
      if (tipRef.current) tipRef.current.style.opacity = '0';
      if (!frame) {
        frame = requestAnimationFrame(() => {
          frame = 0;
          cull();
        });
      }
      if (g.detailK && !refineTimer) refineTimer = window.setTimeout(refine, Math.max(0, 140 - (performance.now() - refinedAt)));
    };
    const z = d3zoom<SVGSVGElement, unknown>()
      .clickDistance(6)
      .on('zoom', (ev: { transform: ZoomTransform; sourceEvent?: unknown }) => {
        // A wheel, a drag or a pinch: the player has taken the view, and it is theirs to keep.
        if (ev.sourceEvent) backRef.current = goalRef.current = null;
        apply(ev.transform);
      });
    zoomRef.current = z;
    const sel = select(svg);
    sel.call(z).on('dblclick.zoom', null);

    const layout = () => {
      const w = wrap.clientWidth;
      const h = wrap.clientHeight;
      if (w < 20 || h < 20) return;
      // The observer also reports once on start, with nothing changed: touching the transform then
      // would cut short a move that a game has just asked for.
      if (layoutRef.current?.w === w && layoutRef.current.h === h) return;
      backRef.current = goalRef.current = null;
      const [x0, y0, x1, y1] = g.view.box;
      const pad = Math.min(56, Math.min(w, h) * 0.09);
      const k = Math.min((w - 2 * pad) / Math.max(x1 - x0, 1e-6), (h - 2 * pad) / Math.max(y1 - y0, 1e-6));
      const fit = zoomIdentity.translate((w - k * (x0 + x1)) / 2, (h - k * (y0 + y1)) / 2).scale(k);
      const [lx0, ly0, lx1, ly1] = g.view.limits;
      const slack = Math.max(lx1 - lx0, ly1 - ly0) * 0.15;
      z.extent([
        [0, 0],
        [w, h],
      ])
        .scaleExtent([k * 0.45, Math.max(k * 14, Math.min(k * 900, 44 / g.minSize))])
        .translateExtent([
          [lx0 - slack, ly0 - slack],
          [lx1 + slack, ly1 + slack],
        ]);
      const prev = layoutRef.current;
      if (!prev) sel.call(z.transform, fit);
      else {
        // Keep what the player was looking at when the container changes size.
        const t = tRef.current;
        const cx0 = (prev.w / 2 - t.x) / t.k;
        const cy0 = (prev.h / 2 - t.y) / t.k;
        const nk = t.k * (k / prev.fit.k);
        sel.call(z.transform, zoomIdentity.translate(w / 2 - nk * cx0, h / 2 - nk * cy0).scale(nk));
      }
      layoutRef.current = { w, h, fit };
      setFitK(k);
    };
    layoutRef.current = null;
    const ro = new ResizeObserver(layout);
    ro.observe(wrap);
    layout();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
      clearTimeout(refineTimer);
      sel.interrupt();
      goalRef.current = null;
      sel.on('.zoom', null);
    };
  }, [g]);

  /** Brings items into view, as `MapHandle.focus` says. */
  const bring = useCallback(
    (ids: string[], opts: FocusOpts = {}) => {
      const svg = svgRef.current;
      const z = zoomRef.current;
      const lay = layoutRef.current;
      if (!svg || !z || !lay) return;
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      for (const id of ids) {
        const s = g.byId.get(id);
        if (!s) continue;
        x0 = Math.min(x0, s.x0);
        y0 = Math.min(y0, s.y0);
        x1 = Math.max(x1, s.x1);
        y1 = Math.max(y1, s.y1);
      }
      if (!Number.isFinite(x0)) return;
      const { w, h, fit } = lay;
      // Where the map is, or where it is going when it is on its way somewhere.
      const t = goalRef.current ?? tRef.current;
      const bw = Math.max(x1 - x0, 0.02);
      const bh = Math.max(y1 - y0, 0.02);
      const one = ids.length === 1 ? g.byId.get(ids[0]) : undefined;
      const inside = x0 * t.k + t.x > 16 && y0 * t.k + t.y > 16 && x1 * t.k + t.x < w - 16 && y1 * t.k + t.y < h - 16;
      // An archipelago can span a wide box and still be a few specks: judge it by its biggest island.
      const seen = one ? one.land * t.k >= SEEN : Math.max(bw, bh) * t.k >= (opts.apart ?? 36);
      if (!opts.force && inside && seen) return;
      const whole = Math.min(w / bw, h / bh);
      // Asked to fill the view: do so. Otherwise come just close enough to make the thing out, so that
      // as much as possible of what surrounds it stays on screen.
      let k = opts.fill != null ? Math.min(whole * opts.fill, fit.k * 60) : one ? (SEEN + 4) / one.land : whole * 0.5;
      if (opts.apart != null && opts.fill == null && !one) k = Math.min(k, (opts.apart * 1.5) / Math.max(bw, bh));
      k = Math.min(k, whole * 0.85, z.scaleExtent()[1]);
      let cx = (x0 + x1) / 2;
      let cy = (y0 + y1) / 2;
      if (opts.legible) {
        let lx0 = Infinity;
        let ly0 = Infinity;
        let lx1 = -Infinity;
        let ly1 = -Infinity;
        for (const ll of opts.legible.points) {
          const q = g.view.projection(ll);
          if (!q) continue;
          lx0 = Math.min(lx0, q[0]);
          ly0 = Math.min(ly0, q[1]);
          lx1 = Math.max(lx1, q[0]);
          ly1 = Math.max(ly1, q[1]);
        }
        const need = Number.isFinite(lx0) ? Math.min(opts.legible.px / Math.max(lx1 - lx0, ly1 - ly0, 1e-6), z.scaleExtent()[1]) : 0;
        if (k < need) {
          k = need;
          cx = (lx0 + lx1) / 2;
          cy = (ly0 + ly1) / 2;
        }
      }
      const target = k < fit.k * 1.3 ? fit : zoomIdentity.translate(w / 2 - k * cx, h / 2 - k * cy).scale(k);
      if (opts.passing) backRef.current ??= t;
      else backRef.current = null;
      goalRef.current = target;
      select(svg)
        .transition()
        .duration(opts.instant ? 0 : 650)
        .call(z.transform, target);
    },
    [g],
  );

  const full = useFullscreen();
  const fullLabel = full.on ? L('Salir de pantalla completa', 'Leave full screen') : L('Pantalla completa', 'Full screen');
  const seeAll = useCallback(() => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    const lay = layoutRef.current;
    backRef.current = null;
    if (svg && z && lay) select(svg).transition().duration(450).call(z.transform, (goalRef.current = lay.fit));
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      focus: bring,
      reset: seeAll,
      restore() {
        const svg = svgRef.current;
        const z = zoomRef.current;
        const back = backRef.current;
        backRef.current = null;
        if (svg && z && back) select(svg).transition().duration(450).call(z.transform, (goalRef.current = back));
      },
      shows(ll) {
        const wrap = wrapRef.current;
        const lay = layoutRef.current;
        const q = g.view.projection(ll);
        if (!wrap || !lay || !q || !Number.isFinite(q[0]) || !Number.isFinite(q[1])) return false;
        const [x, y] = lay.fit.apply(q);
        return x >= 0 && x <= wrap.clientWidth && y >= 0 && y <= wrap.clientHeight;
      },
    }),
    [bring, seeAll, g],
  );

  // Handy when testing from the browser console: where a place falls on screen. Removed from production builds.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __mapXY?: (ll: LL) => [number, number] | null }).__mapXY = (ll) => {
      const svg = svgRef.current;
      const p = g.view.projection(ll);
      if (!svg || !p) return null;
      const t = tRef.current;
      const box = svg.getBoundingClientRect();
      return [box.left + p[0] * t.k + t.x, box.top + p[1] * t.k + t.y];
    };
  }, [g]);

  // Brief blink on an item (wrong click, right answer…).
  useEffect(() => {
    if (!flash) return;
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll(`[data-id="${CSS.escape(flash.id)}"]`);
    const cls = `fx-${flash.kind}`;
    els.forEach((el) => {
      el.classList.remove('fx-bad', 'fx-ok');
      // Restart the animation when the same item blinks twice in a row.
      void (el as SVGElement).getBoundingClientRect();
      el.classList.add(cls);
    });
    const timer = setTimeout(() => els.forEach((el) => el.classList.remove(cls)), 900);
    return () => clearTimeout(timer);
  }, [flash]);

  /** Circles drawn around highlighted items that would otherwise be hard to spot. */
  const halos = useMemo(() => {
    if (!paint || !fitK) return [];
    const out: { s: Shape; st: Paint; r: number; keep: boolean }[] = [];
    for (const id in paint) {
      const st = paint[id];
      if (st !== 'target' && st !== 'from' && st !== 'to' && st !== 'sel') continue;
      const s = g.byId.get(id);
      if (!s) continue;
      // A dot is always small: it keeps its halo at any zoom.
      if (s.kind === 'point') out.push({ s, st, r: 20 / fitK, keep: true });
      else if (s.size * fitK >= RING_BELOW && s.land * fitK < HALO_BELOW) out.push({ s, st, r: Math.max(s.size * 0.62, 18 / fitK), keep: false });
    }
    return out;
  }, [g, paint, fitK]);

  useLayoutEffect(cull);

  const linkLines = useMemo(() => {
    if (!links?.length) return [];
    const out: [number, number, number, number][] = [];
    for (const [a, b] of links) {
      const p = g.view.projection(a);
      const q = g.view.projection(b);
      if (p && q) out.push([p[0], p[1], q[0], q[1]]);
    }
    return out;
  }, [g, links]);

  const traceLines = useMemo(() => (traces ?? []).map((t) => ({ d: g.view.path(t.geo) || '', st: t.st ?? 'ask' })).filter((t) => t.d), [g, traces]);

  const gridShapes = useMemo<GridShape[] | null>(() => {
    if (!grid) return null;
    return gridLines(deck.frame, grid).map((l) => {
      const pts: [number, number][] = [];
      for (const ll of l.points) {
        const q = g.view.projection(ll);
        if (q && Number.isFinite(q[0]) && Number.isFinite(q[1])) pts.push([q[0], q[1]]);
      }
      return { kind: l.kind, at: l.at, d: g.view.path({ type: 'LineString', coordinates: l.points }) || '', pts };
    });
  }, [g, deck, grid]);
  /** What the map shows now, in its own units: where the names of the grid are written. */
  const gridView = useCallback((): InView | null => {
    const wrap = wrapRef.current;
    if (!wrap) return null;
    const t = tRef.current;
    return { x0: -t.x / t.k, y0: -t.y / t.k, x1: (wrap.clientWidth - t.x) / t.k, y1: (wrap.clientHeight - t.y) / t.k, k: t.k };
  }, []);
  // A grid that has just been put on the map is named for the view the map is in.
  useEffect(() => {
    if (gridShapes) gridRef.current?.moved(tRef.current.k);
  }, [gridShapes]);

  const markPoints = useMemo(() => {
    if (!marks?.length) return undefined;
    const out: { x: number; y: number; kind: string }[] = [];
    for (const m of marks) {
      const q = g.view.projection(m.ll);
      if (q) out.push({ x: q[0], y: q[1], kind: m.kind });
    }
    return out;
  }, [g, marks]);

  const hotRef = useRef<Element | null>(null);
  const rawId = (target: EventTarget | null, attr: string) => (target instanceof Element ? (target.closest(`[${attr}]`)?.getAttribute(attr) ?? null) : null);
  const dotShapes = useMemo(() => g.shapes.filter((s) => s.kind === 'point' && (!only || only.has(s.id))), [g, only]);
  /**
   * Item under the pointer. Dots lie close together and their click areas overlap: the one nearest to
   * the pointer is meant, not the one that happens to be drawn last.
   */
  const idAt = (e: { target: EventTarget | null; clientX: number; clientY: number }): string | null => {
    const id = rawId(e.target, 'data-id');
    const svg = svgRef.current;
    if (!id || !svg || !(e.target instanceof Element) || !e.target.matches('.m-dot, .m-dot-hit')) return id;
    const t = zoomTransform(svg);
    const box = svg.getBoundingClientRect();
    const x = (e.clientX - box.left - t.x) / t.k;
    const y = (e.clientY - box.top - t.y) / t.k;
    let best = id;
    let dist = Infinity;
    for (const s of dotShapes) {
      const d = Math.hypot(s.x - x, s.y - y);
      if (d < dist) {
        dist = d;
        best = s.id;
      }
    }
    return best;
  };

  /** Zooms about a point of the screen, or about the middle of the map. */
  const zoomBy = (factor: number, about?: [number, number] | null) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    backRef.current = goalRef.current = null;
    if (!svg || !z) return;
    const move = select(svg).transition().duration(220);
    if (about) move.call(z.scaleBy, factor, about);
    else move.call(z.scaleBy, factor);
  };

  // ------------------------------------------------------------------ keyboard
  // A map on which a piece is chosen, or a spot marked, can be worked without a pointer: the arrows move a
  // cursor from piece to piece (or a cross over the map), Enter does what a click would, and + − 0 zoom.
  /** The game is waiting for an answer on the map. */
  const asking = !!pickable || !!onPoint;
  /** Once a game has asked for an answer on the map, it stays in the tab order between questions. */
  const keyed = useRef(false);
  if (asking) keyed.current = true;
  const keyable = keyed.current;
  /** The keyboard was at work on the map when the focus left it. */
  const wasKeying = useRef(false);
  const hintId = useId();
  const [kb, setKb] = useState<{ of: unknown; id?: string; at?: readonly [number, number] } | null>(null);
  /** The keyboard is in use: the cursor is drawn. A pointer, or the focus going elsewhere, puts it away. */
  const [keying, setKeying] = useState(false);
  const cursor = kb?.of === g && kb.id ? g.byId.get(kb.id) : undefined;
  const cross = kb?.of === g ? kb.at : undefined;
  /** What the cursor can stand on: whatever a click can fall on. */
  const spots = useMemo(() => g.shapes.filter((s) => !only || only.has(s.id)), [g, only]);
  const navRef = useRef<{ of: Shape[]; moves: Moves; order: Shape[] } | null>(null);
  /** Worked out the first time a key asks for it: a map of thousands of pieces takes a moment. */
  const nav = () => {
    if (navRef.current?.of !== spots) navRef.current = { of: spots, moves: movesOf(spots), order: inOrder(spots) };
    return navRef.current;
  };
  /** Where a point of the map falls on screen; null when it is out of sight. */
  const onScreen = (x: number, y: number): [number, number] | null => {
    const lay = layoutRef.current;
    if (!lay) return null;
    const t = tRef.current;
    const sx = x * t.k + t.x;
    const sy = y * t.k + t.y;
    return sx >= 0 && sy >= 0 && sx <= lay.w && sy <= lay.h ? [sx, sy] : null;
  };
  /** The point of the map in the middle of the screen. */
  const middle = (): [number, number] => {
    const lay = layoutRef.current;
    const t = tRef.current;
    return lay ? [(lay.w / 2 - t.x) / t.k, (lay.h / 2 - t.y) / t.k] : [0, 0];
  };

  /**
   * Keeps the keyboard cursor in sight: the map slides when the piece is out of view. The zoom stays as
   * the player left it (a piece too small to make out gets a ring, and + brings it closer).
   */
  const follow = (s: Shape) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    const lay = layoutRef.current;
    if (!svg || !z || !lay) return;
    const t = tRef.current;
    const sx = s.x * t.k + t.x;
    const sy = s.y * t.k + t.y;
    const margin = Math.min(56, lay.w / 6, lay.h / 6);
    if (sx >= margin && sy >= margin && sx <= lay.w - margin && sy <= lay.h - margin) return;
    backRef.current = goalRef.current = null;
    select(svg).transition().duration(260).call(z.translateTo, s.x, s.y);
  };

  const moveCross = (arrow: number, px: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    const lay = layoutRef.current;
    if (!svg || !z || !lay) return;
    // The first key only brings the cross out, in the middle of what is on screen.
    if (!cross || !keying || !onScreen(cross[0], cross[1])) return setKb({ of: g, at: middle() });
    let t = tRef.current;
    let sx = cross[0] * t.k + t.x + (arrow === ARROWS.ArrowLeft ? -px : arrow === ARROWS.ArrowRight ? px : 0);
    let sy = cross[1] * t.k + t.y + (arrow === ARROWS.ArrowUp ? -px : arrow === ARROWS.ArrowDown ? px : 0);
    const x = (sx - t.x) / t.k;
    const y = (sy - t.y) / t.k;
    // Near the edge the map moves under the cross, as far as it can go.
    const margin = Math.min(48, lay.w / 5, lay.h / 5);
    const dx = sx < margin ? margin - sx : sx > lay.w - margin ? lay.w - margin - sx : 0;
    const dy = sy < margin ? margin - sy : sy > lay.h - margin ? lay.h - margin - sy : 0;
    if (dx || dy) {
      backRef.current = goalRef.current = null;
      select(svg).call(z.translateBy, dx / t.k, dy / t.k);
      t = tRef.current;
    }
    sx = Math.min(lay.w - 6, Math.max(6, x * t.k + t.x));
    sy = Math.min(lay.h - 6, Math.max(6, y * t.k + t.y));
    setKb({ of: g, at: [(sx - t.x) / t.k, (sy - t.y) / t.k] });
  };

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (!keyable || e.altKey || e.ctrlKey || e.metaKey) return;
    // A key the map uses goes no further: the games listen for Enter on the whole window, and the Enter
    // that answers must not also be the one that moves on to the next question.
    const take = () => {
      e.preventDefault();
      e.stopPropagation();
      if (!keying) setKeying(true);
    };
    const at = keying ? (cursor ? onScreen(cursor.x, cursor.y) : cross ? onScreen(cross[0], cross[1]) : null) : null;
    if (e.key === '+' || e.key === '=' || e.key === '-' || e.key === '_') {
      take();
      zoomBy(e.key === '+' || e.key === '=' ? 1.7 : 1 / 1.7, at);
      return;
    }
    if (e.key === '0') {
      take();
      seeAll();
      return;
    }
    const arrow = ARROWS[e.key];
    const enter = e.key === 'Enter' || e.key === ' ';
    if (onPoint) {
      if (arrow != null) {
        take();
        moveCross(arrow, e.shiftKey ? 4 : 28);
      } else if (enter && keying && cross) {
        take();
        const ll = g.view.projection.invert?.([cross[0], cross[1]]);
        if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) onPoint([ll[0], ll[1]]);
      }
      return;
    }
    if (!onPick) return;
    const paging = e.key === 'PageDown' || e.key === 'PageUp' || e.key === 'Home' || e.key === 'End';
    if (arrow != null || paging) {
      take();
      if (!spots.length) return;
      const { moves, order } = nav();
      let next: string | null | undefined;
      // The first key only brings the cursor out: where it was, or on the piece nearest the middle of the
      // screen among those that can be made out as the map stands.
      if (!cursor || (!keying && !onScreen(cursor.x, cursor.y))) {
        const k = tRef.current.k;
        const plain = spots.filter((s) => s.kind === 'point' || s.land * k >= SEEN);
        next = nearestTo(...middle(), plain.length ? plain : spots)?.id;
      } else if (!keying) next = cursor.id;
      else if (arrow != null) next = moveFrom(moves, cursor.id, arrow);
      else {
        const i = order.findIndex((s) => s.id === cursor.id);
        next = e.key === 'Home' ? order[0]?.id : e.key === 'End' ? order[order.length - 1]?.id : order[i + (e.key === 'PageDown' ? 1 : -1)]?.id;
      }
      const target = next ? g.byId.get(next) : undefined;
      if (!target) return;
      setKb({ of: g, id: target.id });
      follow(target);
      return;
    }
    // Enter is an answer only while the game is waiting for one; otherwise it goes on to the game ("next question").
    if (enter && pickable && keying && cursor) {
      take();
      onPick(cursor.id);
    }
  };

  // Between two questions the focus goes to the "next" button, which then goes away and leaves the focus
  // nowhere. When the next question opens, whoever was answering with the keyboard gets the map back.
  useEffect(() => {
    if (!asking || !wasKeying.current) return;
    const svg = svgRef.current;
    const lost = !document.activeElement || document.activeElement === document.body;
    if (!svg || !lost) return;
    svg.focus({ preventScroll: true });
    setKeying(true);
  }, [asking]);

  /** What the cursor says of where it is: the name when the game lets it be known, and its place in the count. */
  const cursorText = cursor ? (tipFn.current?.(cursor.id) ?? null) : null;
  let spoken = '';
  if (keying && cursor) {
    const order = navRef.current?.order ?? [];
    spoken = `${cursorText ?? L('Pieza', 'Piece')}, ${order.findIndex((s) => s.id === cursor.id) + 1} ${L('de', 'of')} ${order.length}`;
  } else if (keying && cross) {
    const ll = g.view.projection.invert?.([cross[0], cross[1]]);
    if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1]))
      spoken = `${L('Cruz en', 'Cross at')} ${Math.abs(ll[1]).toFixed(1)}° ${ll[1] >= 0 ? 'N' : 'S'}, ${Math.abs(ll[0]).toFixed(1)}° ${ll[0] >= 0 ? 'E' : L('O', 'W')}`;
  }
  const keysHint = onPoint
    ? L('Flechas: mover la cruz (con Mayús, más despacio) · Intro: marcar · + − 0: zoom', 'Arrows: move the cross (with Shift, slower) · Enter: mark · + − 0: zoom')
    : L('Flechas: de pieza en pieza · Intro: elegir · + − 0: zoom', 'Arrows: from piece to piece · Enter: choose · + − 0: zoom');

  return (
    <div className="map" ref={wrapRef}>
      <svg
        ref={svgRef}
        className={cx('map-svg', (pickable || pressable) && 'pickable', blind && 'blind', onPoint && 'pointable', deck.outline.length > 12 && 'dense')}
        role={keyable ? 'application' : 'img'}
        aria-roledescription={keyable ? L('mapa', 'map') : undefined}
        aria-label={L(`Mapa: ${deck.title}`, `Map: ${deck.title}`)}
        aria-describedby={keyable ? hintId : undefined}
        tabIndex={keyable ? 0 : undefined}
        onKeyDown={onKeyDown}
        onPointerDown={() => {
          wasKeying.current = false;
          if (keying) setKeying(false);
        }}
        onFocus={() => {
          wasKeying.current = false;
        }}
        onBlur={() => {
          wasKeying.current = keying;
          if (keying) setKeying(false);
        }}
        onClick={(e) => {
          if (onPoint) {
            const svg = svgRef.current;
            if (!svg) return;
            const t = tRef.current;
            const box = svg.getBoundingClientRect();
            const ll = g.view.projection.invert?.([(e.clientX - box.left - t.x) / t.k, (e.clientY - box.top - t.y) / t.k]);
            if (ll && Number.isFinite(ll[0]) && Number.isFinite(ll[1])) onPoint([ll[0], ll[1]]);
            return;
          }
          const id = idAt(e);
          if (id && onPick) onPick(id);
        }}
        onPointerMove={(e) => {
          const el = tipRef.current;
          if (!el || e.pointerType !== 'mouse' || e.buttons) return;
          const id = idAt(e);
          // The dot a click would take lights up: with overlapping click areas, `:hover` would point at the wrong one.
          const dot = id && e.target instanceof Element && e.target.matches('.m-dot, .m-dot-hit') ? svgRef.current?.querySelector(`.m-dot[data-id="${CSS.escape(id)}"]`) ?? null : null;
          if (dot !== hotRef.current) {
            hotRef.current?.classList.remove('hot');
            dot?.classList.add('hot');
            hotRef.current = dot;
          }
          const extra = id ? null : rawId(e.target, 'data-x');
          const text = id ? tipFn.current?.(id) : extra ? `${g.extras.find((x) => x.id === extra)?.name ?? ''} · ${L('no se pregunta', 'not asked')}` : null;
          if (!text) {
            el.style.opacity = '0';
            return;
          }
          const box = wrapRef.current!.getBoundingClientRect();
          el.textContent = text;
          el.style.opacity = '1';
          el.style.transform = `translate(${Math.min(e.clientX - box.left + 14, box.width - el.offsetWidth - 6)}px, ${Math.max(4, e.clientY - box.top - 34)}px)`;
        }}
        onPointerLeave={() => {
          if (tipRef.current) tipRef.current.style.opacity = '0';
          hotRef.current?.classList.remove('hot');
          hotRef.current = null;
        }}
      >
        <defs>
          <pattern id="m-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="m-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="m-hatch-line" />
          </pattern>
          {/* Textures of the colour-blind palette: stripes for a miss, dots for a right answer with help. They keep their size on screen. */}
          <pattern id="m-cb-bad" data-fixed="45" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="7" height="7" className="m-cb-bg-bad" />
            <line x1="0" y1="0" x2="0" y2="7" strokeWidth="2.4" className="m-cb-ink" />
          </pattern>
          <pattern id="m-cb-warn" data-fixed="0" width="7" height="7" patternUnits="userSpaceOnUse">
            <rect width="7" height="7" className="m-cb-bg-warn" />
            <circle cx="3.5" cy="3.5" r="1.3" stroke="none" className="m-cb-ink" />
          </pattern>
          {/* A piece that a route cannot go through (games/journey.css): a lattice, whatever the palette. */}
          <pattern id="m-shut" data-fixed="45" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="8" height="8" className="m-shut-bg" />
            <path d="M0 0V8M0 0H8" strokeWidth="2.2" className="m-shut-ink" />
          </pattern>
        </defs>
        <g ref={rootRef}>
          {/* A grid of its own takes the place of the faint one under the land: two would not be told apart. */}
          <Backdrop sphere={g.sphere} grat={grid ? '' : g.grat} />
          {g.under.length > 0 && (
            <g className="m-items m-under">
              {(only ? g.under.filter((s) => only.has(s.id)) : g.under).map((s) => (
                <ShapePath key={s.id} id={s.id} d={s.d} st={paint?.[s.id]} cls={s.cls} />
              ))}
            </g>
          )}
          <Land ctx={g.ctx} base={g.base} />
          <g className="m-items">
            {(only ? g.over.filter((s) => only.has(s.id)) : g.over).map((s) =>
              s.kind === 'line' ? (
                <LinePath key={s.id} id={s.id} d={s.d} st={paint?.[s.id]} cls={s.cls} />
              ) : (
                <ShapePath key={s.id} id={s.id} d={detail?.has(s.id) ? g.fullOf(s.id) : s.d} st={paint?.[s.id]} cls={s.cls} />
              ),
            )}
          </g>
          {g.extras.map((e) => (
            <path key={e.id} className="m-extra" d={e.d} data-x={e.id} />
          ))}
          {g.outlines.map((o) => (
            <OutlinePath key={o.id} d={detail?.has(o.id) ? g.fullOf(o.id) : o.d} />
          ))}
          {gridShapes && <Grid ref={gridRef} lines={gridShapes} step={grid!} view={gridView} />}
          {traceLines.length > 0 && (
            <g className="m-traces">
              {/* Each line twice: a wide pale one under it, so that it stands out over any colour. */}
              {traceLines.map((t, i) => (
                <path key={`c${i}`} className="m-trace-case" d={t.d} />
              ))}
              {traceLines.map((t, i) => (
                <path key={i} className={`m-trace st-${t.st}`} d={t.d} />
              ))}
            </g>
          )}
          {linkLines.length > 0 && (
            <g className="m-links">
              {linkLines.map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
              ))}
            </g>
          )}
          <g className="m-halos">
            {halos.map(({ s, st, r, keep }) => (
              <g key={s.id} transform={`translate(${(s.x0 + s.x1) / 2} ${(s.y0 + s.y1) / 2})`} data-halo={keep ? 0 : s.land}>
                <circle r={r} className={`m-halo st-${st}`} />
              </g>
            ))}
          </g>
          {keying && cursor && cursor.kind !== 'point' && (
            <g className={cx('m-cur', cursor.kind === 'line' && 'm-cur-ln')}>
              <path className="m-cur-halo" d={g.fullOf(cursor.id)} />
              <path className="m-cur-line" d={g.fullOf(cursor.id)} />
            </g>
          )}
          <Overlay
            ref={overlayRef}
            shapes={g.shapes}
            paint={paint}
            labels={labels}
            pinned={pinned}
            only={only}
            marks={markPoints}
            cursor={keying ? cursor : null}
            cursorText={keying ? cursorText : null}
            cross={keying && onPoint ? cross : null}
          />
        </g>
      </svg>
      {keyable && (
        <>
          {/* Shown while the map has the keyboard, and read out as its description. */}
          <p className="map-keys" id={hintId}>
            {keysHint}
          </p>
          <p className="sr-only" role="status">
            {spoken}
          </p>
        </>
      )}
      <div className="map-tip" ref={tipRef} aria-hidden="true" />
      <div className="map-ctl">
        <button type="button" onClick={() => zoomBy(1.7)} aria-label={L('Acercar', 'Zoom in')} title={L('Acercar', 'Zoom in')}>
          <Plus size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.7)} aria-label={L('Alejar', 'Zoom out')} title={L('Alejar', 'Zoom out')}>
          <Minus size={18} aria-hidden="true" />
        </button>
        <button type="button" onClick={seeAll} aria-label={L('Ver todo', 'See everything')} title={L('Ver todo', 'See everything')}>
          <Maximize size={16} aria-hidden="true" />
        </button>
        {/* The whole game, not the map alone: the question stays next to it. */}
        {full.can && (
          <button type="button" className="map-full" onClick={full.toggle} aria-pressed={full.on} aria-label={fullLabel} title={fullLabel}>
            {full.on ? <Shrink size={16} aria-hidden="true" /> : <Expand size={16} aria-hidden="true" />}
          </button>
        )}
      </div>
    </div>
  );
});
