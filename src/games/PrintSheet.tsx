/**
 * The map of a game without its names, laid out on paper: each piece with a number and a line to write its
 * name on, or with nothing at all, and the answers on another sheet for whoever marks it.
 */
import { Printer } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Toggle } from '../components/ui';
import { coarsePath, landBox, makeView, spotInFrame, type View } from '../lib/geo';
import { L } from '../lib/i18n';
import { isWater } from '../lib/phys';
import { PAGE, circleOf, dotRadius, farGroups, frameOf, landPlaces, layoutOf, placeInsets, placeNumbers, readingOrder, type InsetAsk, type Numbered, type SheetLayout, type Spot } from '../lib/sheet';
import { cx, nf } from '../lib/text';
import type { Deck, Item, LL } from '../lib/types';
import { GameShell, type GameProps } from './common';

/** Margin of the paper, in millimetres: the one `@page` asks for, and the one the sheet on screen is drawn with. */
const MARGIN = 12;
/** Millimetres to pixels, as CSS has them. */
const PX = 96 / 25.4;
const TITLE_MAX = 80;
/** Letters of a title that fit across the sheet at full size. */
const TITLE_BIG = 50;

type Box = [number, number, number, number];

/** A map as it is printed, in the units of its own projection: the main one, or a box with far pieces. */
interface Drawn {
  /** What is printed of it: x0, y0, x1, y1. */
  box: Box;
  /** Map units to a radian at its centre: what says how big it is next to another. */
  scale: number;
  /** The edge of the world, which only a map of all of it has in sight. */
  sphere: string;
  ctx: string[];
  base: string[];
  /** Surfaces: regions, countries, lakes, seas… */
  areas: { id: string; d: string; cat?: string; under?: boolean }[];
  lines: { id: string; d: string }[];
  dots: { id: string; x: number; y: number; cat?: string }[];
  outlines: string[];
  extras: string[];
  spots: Map<string, Spot>;
  /** The room each piece takes: where no box may be put. */
  rooms: Box[];
}

/** One view of the map: the pieces given, on the land and among the neighbours that fall in its frame. */
function draw(deck: Deck, view: View, items: readonly Item[], pad: number): Drawn {
  const { path, projection } = view;
  const box = frameOf(view.box, view.limits, pad);
  // Paper shows a twentieth of a millimetre at best: outlines are rounded to that, and what a coast of a
  // thousand points weighs in the print queue is saved.
  const light = coarsePath(projection, Math.max(box[2] - box[0], box[3] - box[1]) / 3600);
  const inside = (q: readonly number[]) => q[0] >= box[0] && q[0] <= box[2] && q[1] >= box[1] && q[1] <= box[3];
  const out: Drawn = { box, scale: projection.scale(), sphere: path({ type: 'Sphere' }) || '', ctx: [], base: [], areas: [], lines: [], dots: [], outlines: [], extras: [], spots: new Map(), rooms: [] };
  for (const it of items) {
    const c = projection(it.lp);
    if (it.shape === 'point') {
      if (!c) continue;
      out.dots.push({ id: it.id, x: c[0], y: c[1], cat: it.cat });
      out.spots.set(it.id, { id: it.id, kind: 'point', x: c[0], y: c[1], w: 0, h: 0 });
      out.rooms.push([c[0], c[1], c[0], c[1]]);
      continue;
    }
    const d = light.draw(it.geo);
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
    const framed = Number.isFinite(x0);
    let at = c ?? (framed ? [(x0 + x1) / 2, (y0 + y1) / 2] : null);
    if (!at) continue;
    // Its middle is off the sheet: a sea or a plain much bigger than the map has its number on the part of
    // it that is printed, where it has the most of itself around.
    if (!inside(at) && it.kind === 'feature') at = spotInFrame(it.geo, projection, box) ?? at;
    if (!inside(at)) {
      // Russia on the usual map of Europe: the number goes into the part that is printed, half way between
      // the edge points in sight and the nearest place to its middle.
      const seen = it.fp.map((q) => projection(q)).filter((q): q is [number, number] => !!q && inside(q));
      if (seen.length) {
        const mx = seen.reduce((sum, q) => sum + q[0], 0) / seen.length;
        const my = seen.reduce((sum, q) => sum + q[1], 0) / seen.length;
        at = [(mx + Math.min(Math.max(at[0], box[0]), box[2])) / 2, (my + Math.min(Math.max(at[1], box[1]), box[3])) / 2];
      }
    }
    const whole: [number, number] = framed ? [x1 - x0, y1 - y0] : [0, 0];
    // An archipelago is as big as its biggest island: that is where its number has to fit.
    const land = landBox(it.geo, projection);
    if (it.shape === 'line') {
      if (d) out.lines.push({ id: it.id, d });
    } else if (d) out.areas.push({ id: it.id, d, cat: it.cat, under: it.under });
    out.spots.set(it.id, { id: it.id, kind: it.shape, x: at[0], y: at[1], w: land ? Math.min(land[0], whole[0]) : whole[0], h: land ? Math.min(land[1], whole[1]) : whole[1] });
    // A sea is no obstacle to a box: there is nothing but water to cover.
    if (framed && !it.under) out.rooms.push([x0, y0, x1, y1]);
  }
  for (const o of deck.outline) {
    const d = light.draw(o.geo);
    if (d) out.outlines.push(d);
  }
  for (const e of deck.extras) {
    const d = light.draw(e.geo);
    if (d) out.extras.push(d);
  }
  for (const c of deck.context) {
    const d = path(c);
    if (d) out.ctx.push(d);
  }
  for (const c of deck.base ?? []) {
    const d = path(c);
    if (d) out.base.push(d);
  }
  return out;
}

/** A box of far pieces: its map, and where on the main one it is put (in the units of the main one). */
interface Inset {
  g: Drawn;
  rect: Box;
}

interface Plan {
  main: Drawn;
  insets: Inset[];
}

/** The biggest share of the main map a box may take, across and down. */
const INSET_W = 0.45;
const INSET_H = 0.34;

/**
 * The sheet of a map: the view the game opens with, in outlines. What lies far from the rest (the Canary
 * Islands, Alaska) goes in boxes, as on a school map, so that the rest is not printed the size of a stamp.
 */
function plan(deck: Deck): Plan {
  /** The physical map of one country: its land is the base, and the rest of the world lies around it. */
  const land = deck.scope === 'physical' && deck.base?.length === 1 && deck.context.length > 0;
  const boxed = deck.scope === 'regions' || deck.scope === 'cities' || land;
  let groups: Item[][] = [];
  /** The points each group is framed by; the main map keeps the rest. */
  let frames: LL[][] = [];
  let mainFrame = deck.frame;
  if (boxed && deck.scope === 'regions') {
    const far = farGroups(deck.items.map((it) => ({ id: it.id, lp: it.lp, fp: it.fp, area: it.area })));
    groups = far.map((ids) => ids.map((id) => deck.byId.get(id)!));
    frames = groups.map((g) => g.flatMap((it) => it.fp));
    const gone = new Set(far.flat());
    if (gone.size) mainFrame = deck.items.filter((it) => !gone.has(it.id)).flatMap((it) => it.fp);
  } else if (boxed) {
    // Cities reach nowhere: what lies apart is the land they stand on.
    const rings = (deck.base ?? []).flatMap((f) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates[0]] : f.geometry.coordinates.map((poly) => poly[0])));
    // On the physical map of a country, a river, a peak or a cape stands on its land as a city does; a sea
    // stands on none, and stays on the main map with whatever else lies off the country.
    const within = (p: LL) => rings.some((ring) => ring.some((q) => q[0] <= p[0]) && ring.some((q) => q[0] >= p[0]) && ring.some((q) => q[1] <= p[1]) && ring.some((q) => q[1] >= p[1]));
    const standing = land ? deck.items.filter((it) => !isWater(it.cat) && within(it.lp)) : deck.items;
    const { places, landOf, boxOf } = landPlaces(rings, standing);
    const far = farGroups(places);
    const groupOf = new Map(far.flatMap((lands, i) => lands.map((land) => [land, i] as const)));
    groups = far.map(() => []);
    for (const it of deck.items) {
      const k = groupOf.get(landOf.get(it.id) ?? '');
      if (k != null) groups[k].push(it);
    }
    frames = far.map((lands, i) => [...lands.flatMap((land) => places.find((p) => p.id === land)!.fp), ...groups[i].map((it) => it.lp)]);
    if (far.length) {
      // The frame of the game holds the islands that go to a box: without them it is the frame of the rest.
      const away = far.flat().map((land) => boxOf.get(land)!);
      const m = 0.05;
      const kept = deck.frame.filter((p) => !away.some((b) => p[0] >= b[0] - m && p[0] <= b[2] + m && p[1] >= b[1] - m && p[1] <= b[3] + m));
      if (kept.length) mainFrame = kept;
    }
  }
  const far = new Set(groups.flat().map((it) => it.id));
  const mainView = makeView(mainFrame);
  const main = draw(
    deck,
    mainView,
    deck.items.filter((it) => !far.has(it.id)),
    0.05,
  );
  if (!groups.length) return { main, insets: [] };

  const mainW = main.box[2] - main.box[0];
  const mainH = main.box[3] - main.box[1];
  const centre: [number, number] = [(main.box[0] + main.box[2]) / 2, (main.box[1] + main.box[3]) / 2];
  const maps = groups.map((g, i) => draw(deck, makeView(frames[i]), g, 0.12));
  const asks: InsetAsk[] = maps.map((g, i) => {
    // At the scale of the main map where it fits, so that sizes can be compared; smaller where it does not.
    const k = main.scale / g.scale;
    const w = (g.box[2] - g.box[0]) * k;
    const h = (g.box[3] - g.box[1]) * k;
    const f = Math.min(1, (mainW * INSET_W) / w, (mainH * INSET_H) / h);
    // Which way it really lies: on the map where the main view reaches it, by its coordinates where it does not.
    const where = circleOf(frames[i]).centre;
    const at = mainView.projection(where);
    const here = circleOf(mainFrame).centre;
    const dx = at ? at[0] - centre[0] : where[0] - here[0];
    const dy = at ? at[1] - centre[1] : here[1] - where[1];
    return { w: w * f, h: h * f, dx, dy };
  });
  const placed = placeInsets(main.box, main.rooms, asks);
  main.box = placed.frame;
  return { main, insets: maps.map((g, i) => ({ g, rect: placed.boxes[i] })) };
}

/** A peak: a triangle standing on the place. */
const peak = (x: number, y: number, r: number) => `M${x},${y - r * 1.15}L${x + r},${y + r * 0.75}L${x - r},${y + r * 0.75}Z`;
/** A cape: a diamond on the tip of the land. */
const cape = (x: number, y: number, r: number) => `M${x},${y - r}L${x + r},${y}L${x},${y + r}L${x - r},${y}Z`;
/** A waterfall is a drop, as on the map of the game. */
const fall = (x: number, y: number, r: number) =>
  `M${x},${y - r * 1.4}C${x + r * 0.52},${y - r * 0.68} ${x + r},${y - r * 0.12} ${x + r},${y + r * 0.4}A${r},${r} 0 0 1 ${x - r},${y + r * 0.4}C${x - r},${y - r * 0.12} ${x - r * 0.52},${y - r * 0.68} ${x},${y - r * 1.4}Z`;

/**
 * What one view draws, from the bottom up; the numbers last, over everything. A map without numbers keeps
 * the rings: a speck with nothing around it would not be seen, and there is a name to write there too.
 */
function Layers({ g, placed, font, bare }: { g: Drawn; placed: Numbered[]; font: number; bare: boolean }) {
  const r = dotRadius(font);
  return (
    <>
      <path className="sm-sphere" d={g.sphere} />
      {/* Seas go under the land, as on the map of the game: their outline is cut clean by the coast. */}
      <g className="sm-under">
        {g.areas
          .filter((a) => a.under)
          .map((a) => (
            <path key={a.id} d={a.d} className={a.cat && `k-${a.cat}`} />
          ))}
      </g>
      <g className="sm-ctx">
        {g.ctx.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="sm-base">
        {g.base.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="sm-area">
        {g.areas
          .filter((a) => !a.under)
          .map((a) => (
            // A continent says which one it is: each is printed in its own grey.
            <path key={a.id} d={a.d} className={a.cat && `k-${a.cat}`} data-id={a.cat === 'continent' ? a.id : undefined} />
          ))}
      </g>
      <g className="sm-extra">
        {g.extras.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="sm-outline">
        {g.outlines.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
      <g className="sm-line">
        {g.lines.map((l) => (
          <path key={l.id} d={l.d} />
        ))}
      </g>
      <g className="sm-dot">
        {g.dots.map((d) =>
          d.cat === 'peak' ? (
            <path key={d.id} d={peak(d.x, d.y, r * 1.25)} />
          ) : d.cat === 'cape' ? (
            <path key={d.id} d={cape(d.x, d.y, r * 1.3)} />
          ) : d.cat === 'fall' ? (
            <path key={d.id} d={fall(d.x, d.y, r * 1.2)} />
          ) : (
            <circle key={d.id} cx={d.x} cy={d.y} r={r} />
          ),
        )}
      </g>
      <g className="sm-num" style={{ fontSize: font }}>
        {placed.map((p) => {
          const s = g.spots.get(p.id);
          return p.ring && s ? <circle key={p.id} className="sm-ring" cx={s.x} cy={s.y} r={p.ring} /> : null;
        })}
        {!bare &&
          placed.map((p) =>
            p.lead ? (
              <g key={p.id} className="sm-lead">
                <line x1={p.lead[0]} y1={p.lead[1]} x2={p.lead[2]} y2={p.lead[3]} />
                <circle cx={p.lead[0]} cy={p.lead[1]} r={font * 0.11} />
              </g>
            ) : null,
          )}
        {!bare &&
          placed.map((p) => (
            <text key={p.id} x={p.x} y={p.y} dy="0.36em" textAnchor="middle">
              {p.n}
            </text>
          ))}
      </g>
    </>
  );
}

/** Numbers of every view of a sheet, for digits of a given height on paper. */
interface Numbers {
  main: Numbered[];
  insets: Numbered[][];
  /** Every number with its piece, in order: the list under the map. */
  all: Numbered[];
}

/** Map units of the main view to a millimetre of paper. */
const unitOf = (p: Plan, l: SheetLayout) => (p.main.box[2] - p.main.box[0]) / l.mapW;
/** The same for a box: it is drawn at its own scale. */
const insetUnit = (p: Plan, l: SheetLayout, k: number) => ((p.insets[k].g.box[2] - p.insets[k].g.box[0]) / (p.insets[k].rect[2] - p.insets[k].rect[0])) * unitOf(p, l);

function number(p: Plan, l: SheetLayout, asked: ReadonlySet<string>): Numbers {
  const pick = (g: Drawn) => [...g.spots.values()].filter((s) => asked.has(s.id));
  // One count for the whole sheet, in the order it is read: a box is read where it is printed.
  const onSheet: Spot[] = pick(p.main);
  p.insets.forEach(({ g, rect }) => {
    const k = (rect[2] - rect[0]) / (g.box[2] - g.box[0]);
    for (const s of pick(g)) onSheet.push({ ...s, x: rect[0] + (s.x - g.box[0]) * k, y: rect[1] + (s.y - g.box[1]) * k });
  });
  const order = readingOrder(onSheet);
  const main = placeNumbers(pick(p.main), order, { font: l.digit * unitOf(p, l), box: p.main.box, avoid: p.insets.map((i) => i.rect) });
  const insets = p.insets.map(({ g }, k) => placeNumbers(pick(g), order, { font: l.digit * insetUnit(p, l, k), box: g.box }));
  return { main, insets, all: [...main, ...insets.flat()].sort((a, b) => a.n - b.n) };
}

function SheetMap({ p, layout, numbers, bare, label, scope }: { p: Plan; layout: SheetLayout; numbers: Numbers; bare: boolean; label: string; scope: Deck['scope'] }) {
  const [x0, y0, x1, y1] = p.main.box;
  const unit = unitOf(p, layout);
  // The line around the map is drawn a hair inside it: at the very edge the viewport would cut half of it away.
  const in0 = unit * 0.2;
  return (
    <svg className={`sheet-map of-${scope}`} viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} style={{ width: `${layout.mapW}mm`, height: `${layout.mapH}mm`, '--mm': unit } as CSSProperties} role="img" aria-label={label}>
      <Layers g={p.main} placed={numbers.main} font={layout.digit * unit} bare={bare} />
      {p.insets.map(({ g, rect }, k) => {
        const u = insetUnit(p, layout, k);
        const [gx, gy] = g.box;
        const gw = g.box[2] - gx;
        const gh = g.box[3] - gy;
        return (
          <g key={k}>
            {/* A map inside the map, with its own scale: a nested viewport cuts it at its edge. */}
            <svg className="sm-inset" x={rect[0]} y={rect[1]} width={rect[2] - rect[0]} height={rect[3] - rect[1]} viewBox={`${gx} ${gy} ${gw} ${gh}`} style={{ '--mm': u } as CSSProperties}>
              <rect className="sm-paper" x={gx} y={gy} width={gw} height={gh} />
              <Layers g={g} placed={numbers.insets[k]} font={layout.digit * u} bare={bare} />
            </svg>
            <rect className="sm-edge" x={rect[0]} y={rect[1]} width={rect[2] - rect[0]} height={rect[3] - rect[1]} />
          </g>
        );
      })}
      <rect className="sm-edge" x={x0 + in0} y={y0 + in0} width={x1 - x0 - in0 * 2} height={y1 - y0 - in0 * 2} />
    </svg>
  );
}

/** The map and its list, under it or beside it as the layout says. */
function SheetBody({ p, layout, numbers, bare, label, names, scope }: { p: Plan; layout: SheetLayout; numbers: Numbers; bare?: boolean; label: string; names?: ReadonlyMap<string, string>; scope: Deck['scope'] }) {
  return (
    <div className={cx('sheet-body', layout.side && 'side')}>
      <SheetMap p={p} layout={layout} numbers={numbers} bare={!!bare} label={label} scope={scope} />
      {!bare && (
        <ol className={cx('sheet-list', layout.split && 'split')} style={{ columnCount: layout.columns, '--row': `${layout.row}mm` } as CSSProperties}>
          {numbers.all.map((n) => (
            <li key={n.id}>
              <b>{n.n}</b>
              {names ? <span>{names.get(n.id)}</span> : <i />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export function PrintSheet({ deck, cfg, onExit }: GameProps) {
  const many = deck.noun.many;
  const preset = cfg.list ? `${deck.title} · ${cfg.list}` : deck.title;
  const [title, setTitle] = useState(preset);
  const [numbered, setNumbered] = useState(true);
  const [answers, setAnswers] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);

  const p = useMemo(() => plan(deck), [deck]);
  /** What gets a number: the whole map, or the pieces of the list it is printed for. */
  const asked = useMemo(() => {
    const only = cfg.only ? new Set(cfg.only) : null;
    const drawn = (id: string) => p.main.spots.has(id) || p.insets.some((i) => i.g.spots.has(id));
    return new Set(deck.items.filter((it) => drawn(it.id) && (!only || only.has(it.id))).map((it) => it.id));
  }, [deck, cfg.only, p]);
  const ratio = (p.main.box[2] - p.main.box[0]) / (p.main.box[3] - p.main.box[1]);
  /** The sheet to fill in: with numbers and its list, or the map with the page to itself. */
  const layout = useMemo(() => layoutOf(ratio, numbered ? asked.size : 0), [ratio, numbered, asked.size]);
  /** The answers always have numbers and names, and go the same way up as the sheet they are printed with. */
  const keyLayout = useMemo(() => (numbered ? layout : layoutOf(ratio, asked.size, layout.landscape)), [ratio, numbered, asked.size, layout]);
  // Each sheet is numbered for its own size: the digits are as tall on paper whatever the size of the map.
  const numbers = useMemo(() => number(p, layout, asked), [p, layout, asked]);
  const keyNumbers = useMemo(() => (keyLayout === layout ? numbers : number(p, keyLayout, asked)), [p, keyLayout, layout, numbers, asked]);
  const nameOf = useMemo(() => new Map(deck.items.map((it) => [it.id, it.name])), [deck]);

  const landscape = layout.landscape;
  const pageW = landscape ? PAGE.h : PAGE.w;

  // The sheet is drawn at its real size and shrunk to the room there is: what is seen is what comes out.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setFit(Math.min(1, (el.clientWidth - 24) / ((pageW + MARGIN * 2) * PX)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageW]);

  // The page takes the name of the sheet: it is what a browser offers to call the PDF.
  const heading = title.trim() || preset;
  // The title has one line, and the map under it is worked out for that: a long one is set smaller.
  const long = heading.length > TITLE_BIG;
  useEffect(() => {
    const before = document.title;
    document.title = `${heading} — ${L('mapa mudo', 'blank map')}`;
    return () => {
      document.title = before;
    };
  }, [heading]);
  // Nothing but the sheets goes to the printer (see the print rules in styles.css).
  useEffect(() => {
    document.documentElement.classList.add('sheet-on');
    return () => document.documentElement.classList.remove('sheet-on');
  }, []);

  const credit = L('Regionle ∞ · mapa de Natural Earth', 'Regionle ∞ · map from Natural Earth');
  const what = (n: number | null) => (n != null ? L(`Mapa de ${heading} con ${nf(n)} números`, `Map of ${heading} with ${nf(n)} numbers`) : L(`Mapa de ${heading} sin nombres`, `Map of ${heading} without names`));

  return (
    <GameShell
      title={L('Mapa mudo', 'Blank map')}
      subtitle={preset}
      onExit={onExit}
      // Always in sight: on a phone the options take the panel and the button under them is a scroll away.
      hud={
        <button type="button" className="btn btn-sm btn-primary sheet-print" onClick={() => window.print()} aria-label={L('Imprimir', 'Print')} title={L('Imprimir', 'Print')}>
          <Printer size={15} aria-hidden="true" />
          <span>{L('Imprimir', 'Print')}</span>
        </button>
      }
      panel={
        <div className="q sheet-tools">
          <div className="q-prompt">
            <p className="kicker">{L('Para imprimir', 'To print')}</p>
            <h2 className="q-ask">{L('El mapa, sin los nombres', 'The map, without the names')}</h2>
            <p className="q-sub">
              {L(
                `Para clase o para examinarte en papel: ${nf(asked.size)} ${many}${cfg.list ? ' de tu lista' : ''}, tal como salen en el juego.`,
                `For class or to test yourself on paper: ${nf(asked.size)} ${many}${cfg.list ? ' from your list' : ''}, as the game shows them.`,
              )}
              {p.insets.length > 0 && ` ${L('Lo que queda lejos va en un recuadro.', 'What lies far away goes in a box.')}`}
            </p>
          </div>

          <label className="field">
            <span>{L('Título de la hoja', 'Title of the sheet')}</span>
            <input type="text" value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} placeholder={preset} autoComplete="off" />
          </label>

          <div className="options">
            <Toggle
              checked={numbered}
              onChange={setNumbered}
              hint={L('Un número en cada pieza y, debajo, una línea para escribir su nombre. Sin números queda el mapa solo, para escribir o colorear encima.', 'A number on each piece and, below, a line to write its name on. Without numbers the map is left alone, to write or colour on.')}
            >
              {L('Números y líneas para los nombres', 'Numbers and lines for the names')}
            </Toggle>
            <Toggle checked={answers} onChange={setAnswers} hint={L('Otra hoja con los números y el nombre de cada uno, para corregir.', 'Another sheet with the numbers and the name of each, to mark it.')}>
              {L('Añadir las soluciones', 'Add the answers')}
            </Toggle>
          </div>

          <div className="q-actions">
            <button type="button" className="btn btn-primary" onClick={() => window.print()}>
              <Printer size={16} aria-hidden="true" />
              {L('Imprimir', 'Print')}
            </button>
          </div>
          <p className="q-note">
            {landscape
              ? L('La hoja va en horizontal. Si tu navegador no la gira solo, elígelo en el cuadro de impresión, donde también puedes guardarla como PDF.', 'The sheet is landscape. If your browser does not turn it by itself, choose it in the print dialog, where you can also save it as a PDF.')
              : L('En el cuadro de impresión puedes guardarla como PDF.', 'In the print dialog you can save it as a PDF.')}
          </p>
        </div>
      }
      stage={
        <div className="sheets" ref={wrap} style={{ '--fit': fit } as CSSProperties}>
          {/* The paper lies down for a map much wider than tall; the margins are the same either way. */}
          <style>{`@page { size: ${landscape ? 'landscape' : 'portrait'}; margin: ${MARGIN}mm; }`}</style>
          <article className={cx('sheet', landscape && 'sheet-wide')} style={{ width: `${pageW}mm` }} data-sheet="map">
            <header className="sheet-head">
              <h2 className={cx(long && 'long')}>{heading}</h2>
              <div className="sheet-sub">
                <p>{numbered ? L('Escribe el nombre que corresponde a cada número.', 'Write the name that goes with each number.') : ''}</p>
                <p className="sheet-fields">
                  <span>
                    {L('Nombre', 'Name')} <i />
                  </span>
                  <span>
                    {L('Fecha', 'Date')} <i className="short" />
                  </span>
                </p>
              </div>
            </header>
            <SheetBody p={p} layout={layout} numbers={numbers} bare={!numbered} label={what(numbered ? numbers.all.length : null)} scope={deck.scope} />
            <p className="sheet-foot">{credit}</p>
          </article>
          {answers && (
            <article className={cx('sheet sheet-key', landscape && 'sheet-wide')} style={{ width: `${pageW}mm` }} data-sheet="answers">
              <header className="sheet-head">
                <h2 className={cx(long && 'long')}>{heading}</h2>
                <div className="sheet-sub">
                  <p>{L('Soluciones', 'Answers')}</p>
                </div>
              </header>
              <SheetBody p={p} layout={keyLayout} numbers={keyNumbers} label={what(keyNumbers.all.length)} names={nameOf} scope={deck.scope} />
              <p className="sheet-foot">{credit}</p>
            </article>
          )}
        </div>
      }
    />
  );
}
