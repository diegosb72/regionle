import { select } from 'd3-selection';
import 'd3-transition';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import { Maximize, Minus, Plus } from 'lucide-react';
import { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { GeoPermissibleObjects } from 'd3-geo';
import { NOMINAL, coarsePath, countPoints, graticule, makeView } from '../lib/geo';
import { cx } from '../lib/text';
import type { Deck, Geo, LL } from '../lib/types';

/** Look of an item on the map. */
export type Paint = 'ok' | 'warn' | 'bad' | 'target' | 'from' | 'to' | 'sel' | 'near' | 'dim';

export interface MapHandle {
  /** Brings items into view, zooming in when they are too small to see. */
  focus(ids: string[], opts?: { force?: boolean; fill?: number; instant?: boolean }): void;
  /** Back to the whole deck. */
  reset(): void;
}

interface Props {
  deck: Deck;
  paint?: Readonly<Record<string, Paint | undefined>>;
  /** Items react to the pointer and report clicks. */
  pickable?: boolean;
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
}

interface Shape {
  id: string;
  name: string;
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

/** Size in view units of the biggest polygon of a multi-part shape, from the corners of its lon/lat box. */
function biggestPiece(geo: Geo, project: (p: LL) => [number, number] | null): number | null {
  if (geo.geometry.type !== 'MultiPolygon' || geo.geometry.coordinates.length < 2) return null;
  let best: [number, number, number, number] | null = null;
  let bestArea = -1;
  for (const poly of geo.geometry.coordinates) {
    let w = Infinity;
    let e = -Infinity;
    let south = Infinity;
    let north = -Infinity;
    for (const pt of poly[0]) {
      if (pt[0] < w) w = pt[0];
      if (pt[0] > e) e = pt[0];
      if (pt[1] < south) south = pt[1];
      if (pt[1] > north) north = pt[1];
    }
    const area = (e - w) * Math.cos((((south + north) / 2) * Math.PI) / 180) * (north - south);
    if (area > bestArea) {
      bestArea = area;
      best = [w, south, e, north];
    }
  }
  if (!best) return null;
  const [w, south, e, north] = best;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const corner of [
    [w, south],
    [e, south],
    [w, north],
    [e, north],
  ] as LL[]) {
    const q = project(corner);
    if (!q) continue;
    if (q[0] < x0) x0 = q[0];
    if (q[0] > x1) x1 = q[0];
    if (q[1] < y0) y0 = q[1];
    if (q[1] > y1) y1 = q[1];
  }
  return Number.isFinite(x0) ? Math.max(x1 - x0, y1 - y0, 0.02) : null;
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
  const heavy = countPoints(deck.items.map((it) => it.geo)) > HEAVY;
  // The grid is fixed in map units; the window gives a fair idea of how large a unit will be drawn.
  const scale = typeof window === 'undefined' ? 1 : Math.max(window.innerWidth, window.innerHeight, 600) / NOMINAL;
  const grid = LIGHT_GRID / scale;
  const light = heavy ? coarsePath(projection, grid) : null;
  const shapes: Shape[] = [];
  for (const it of deck.items) {
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
    const c = projection(it.lp) ?? [(x0 + x1) / 2, (y0 + y1) / 2];
    if (!Number.isFinite(x0)) {
      x0 = x1 = c[0];
      y0 = y1 = c[1];
    }
    const size = Math.max(x1 - x0, y1 - y0, 0.02);
    shapes.push({ id: it.id, name: it.name, d, bb, x: c[0], y: c[1], x0, y0, x1, y1, size, land: Math.min(size, biggestPiece(it.geo, projection) ?? size) });
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
  const full = new Map<string, string>();
  return {
    view,
    shapes,
    byId: new Map(shapes.map((s) => [s.id, s])),
    ctx,
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

const ShapePath = memo(function ShapePath({ id, d, st }: { id: string; d: string; st?: string }) {
  return <path d={d} data-id={id} className={st ? `st-${st}` : undefined} />;
});

const OutlinePath = memo(function OutlinePath({ d }: { d: string }) {
  return <path className="m-outline" d={d} />;
});

/** Sea, graticule and the rest of the world: drawn once per map. */
const Backdrop = memo(function Backdrop({ sphere, grat, ctx }: { sphere: string; grat: string; ctx: string[] }) {
  return (
    <>
      <path className="m-sphere" d={sphere} />
      <path className="m-grat" d={grat} />
      <g className="m-ctx">
        {ctx.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
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
  const small = shapes.filter((s) => s.size * k < RING_BELOW);
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
}

/**
 * Rings and names: the only parts of the map that keep their size on screen. They live in their own
 * component so that zooming a map of thousands of shapes re-renders nothing else, and only what is
 * visible at the current zoom is in the document at all.
 */
const Overlay = memo(
  forwardRef<OverlayHandle, OverlayProps>(function Overlay({ shapes, paint, labels, pinned }, ref) {
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
    const rings = useMemo(() => (k ? pickRings(shapes, k, paint) : []), [shapes, k, paint]);

    const named = useMemo(() => {
      if (!labels && !pinned?.size) return [];
      const out: { s: Shape; min: number; pin: boolean }[] = [];
      for (const s of shapes) {
        const pin = !!pinned?.has(s.id);
        if (!pin && !(labels === 'all' || labels?.has(s.id))) continue;
        const room = Math.max(s.x1 - s.x0, (s.y1 - s.y0) * 0.6, 0.02);
        out.push({ s, pin, min: pin ? 0 : ((s.name.length * 6.3 + 8) * 0.9) / room });
      }
      return out;
    }, [shapes, labels, pinned]);
    const shown = useMemo(() => named.filter((l) => l.min <= k), [named, k]);

    return (
      <g ref={gRef}>
        <g className="m-rings">
          {rings.map((s) => (
            <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
              <circle r={RING_R} data-id={s.id} className={cx('m-ring', paint?.[s.id] && `st-${paint[s.id]}`)} />
            </g>
          ))}
        </g>
        <g className="m-labels">
          {shown.map(({ s, pin }) => (
            <g key={s.id} transform={`translate(${s.x} ${s.y})`}>
              <text className={cx('m-lbl', pin && 'm-lbl-pin')}>{s.name}</text>
            </g>
          ))}
        </g>
      </g>
    );
  }),
);

export const MapView = forwardRef<MapHandle, Props>(function MapView({ deck, paint, pickable, onPick, labels, pinned, tip, blind, links, flash }, ref) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const rootRef = useRef<SVGGElement>(null);
  const overlayRef = useRef<OverlayHandle>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const tRef = useRef<ZoomTransform>(zoomIdentity);
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
      const root = rootRef.current;
      if (!root) return;
      root.setAttribute('transform', t.toString());
      overlayRef.current?.zoomed(t.k);
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
      .on('zoom', (ev: { transform: ZoomTransform }) => apply(ev.transform));
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
      sel.on('.zoom', null);
    };
  }, [g]);

  useImperativeHandle(
    ref,
    () => ({
      focus(ids, opts = {}) {
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
        const t = tRef.current;
        const bw = Math.max(x1 - x0, 0.02);
        const bh = Math.max(y1 - y0, 0.02);
        const one = ids.length === 1 ? g.byId.get(ids[0]) : undefined;
        const inside = x0 * t.k + t.x > 16 && y0 * t.k + t.y > 16 && x1 * t.k + t.x < w - 16 && y1 * t.k + t.y < h - 16;
        // An archipelago can span a wide box and still be a few specks: judge it by its biggest island.
        const seen = one ? one.land * t.k >= SEEN : Math.max(bw, bh) * t.k >= 36;
        if (!opts.force && inside && seen) return;
        const whole = Math.min(w / bw, h / bh);
        // Asked to fill the view: do so. Otherwise come just close enough to make the thing out, so that
        // as much as possible of what surrounds it stays on screen.
        let k = opts.fill != null ? Math.min(whole * opts.fill, fit.k * 60) : one ? (SEEN + 4) / one.land : whole * 0.5;
        k = Math.min(k, whole * 0.85, z.scaleExtent()[1]);
        const target = k < fit.k * 1.3 ? fit : zoomIdentity.translate(w / 2 - (k * (x0 + x1)) / 2, h / 2 - (k * (y0 + y1)) / 2).scale(k);
        select(svg)
          .transition()
          .duration(opts.instant ? 0 : 650)
          .call(z.transform, target);
      },
      reset() {
        const svg = svgRef.current;
        const z = zoomRef.current;
        const lay = layoutRef.current;
        if (svg && z && lay) select(svg).transition().duration(450).call(z.transform, lay.fit);
      },
    }),
    [g],
  );

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
    const out: { s: Shape; st: Paint; r: number }[] = [];
    for (const id in paint) {
      const st = paint[id];
      if (st !== 'target' && st !== 'from' && st !== 'to' && st !== 'sel') continue;
      const s = g.byId.get(id);
      if (s && s.size * fitK >= RING_BELOW && s.land * fitK < HALO_BELOW) out.push({ s, st, r: Math.max(s.size * 0.62, 18 / fitK) });
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

  const idAt = (target: EventTarget | null, attr: string) => (target instanceof Element ? (target.closest(`[${attr}]`)?.getAttribute(attr) ?? null) : null);

  const zoomBy = (factor: number) => {
    const svg = svgRef.current;
    const z = zoomRef.current;
    if (svg && z) select(svg).transition().duration(220).call(z.scaleBy, factor);
  };

  return (
    <div className="map" ref={wrapRef}>
      <svg
        ref={svgRef}
        className={cx('map-svg', pickable && 'pickable', blind && 'blind', deck.outline.length > 12 && 'dense')}
        role="img"
        aria-label={`Mapa: ${deck.title}`}
        onClick={(e) => {
          const id = idAt(e.target, 'data-id');
          if (id && onPick) onPick(id);
        }}
        onPointerMove={(e) => {
          const el = tipRef.current;
          if (!el || e.pointerType !== 'mouse' || e.buttons) return;
          const id = idAt(e.target, 'data-id');
          const extra = id ? null : idAt(e.target, 'data-x');
          const text = id ? tipFn.current?.(id) : extra ? `${g.extras.find((x) => x.id === extra)?.name ?? ''} · no se pregunta` : null;
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
        }}
      >
        <defs>
          <pattern id="m-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" className="m-hatch-bg" />
            <line x1="0" y1="0" x2="0" y2="6" className="m-hatch-line" />
          </pattern>
        </defs>
        <g ref={rootRef}>
          <Backdrop sphere={g.sphere} grat={g.grat} ctx={g.ctx} />
          <g className="m-items">
            {g.shapes.map((s) => (
              <ShapePath key={s.id} id={s.id} d={detail?.has(s.id) ? g.fullOf(s.id) : s.d} st={paint?.[s.id]} />
            ))}
          </g>
          {g.extras.map((e) => (
            <path key={e.id} className="m-extra" d={e.d} data-x={e.id} />
          ))}
          {g.outlines.map((o) => (
            <OutlinePath key={o.id} d={detail?.has(o.id) ? g.fullOf(o.id) : o.d} />
          ))}
          {linkLines.length > 0 && (
            <g className="m-links">
              {linkLines.map(([x1, y1, x2, y2], i) => (
                <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
              ))}
            </g>
          )}
          <g className="m-halos">
            {halos.map(({ s, st, r }) => (
              <g key={s.id} transform={`translate(${(s.x0 + s.x1) / 2} ${(s.y0 + s.y1) / 2})`} data-halo={s.land}>
                <circle r={r} className={`m-halo st-${st}`} />
              </g>
            ))}
          </g>
          <Overlay ref={overlayRef} shapes={g.shapes} paint={paint} labels={labels} pinned={pinned} />
        </g>
      </svg>
      <div className="map-tip" ref={tipRef} aria-hidden="true" />
      <div className="map-ctl">
        <button type="button" onClick={() => zoomBy(1.7)} aria-label="Acercar" title="Acercar">
          <Plus size={18} />
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.7)} aria-label="Alejar" title="Alejar">
          <Minus size={18} />
        </button>
        <button
          type="button"
          onClick={() => {
            const svg = svgRef.current;
            const z = zoomRef.current;
            const lay = layoutRef.current;
            if (svg && z && lay) select(svg).transition().duration(450).call(z.transform, lay.fit);
          }}
          aria-label="Ver todo"
          title="Ver todo"
        >
          <Maximize size={16} />
        </button>
      </div>
    </div>
  );
});
