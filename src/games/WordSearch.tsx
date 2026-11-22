/**
 * «Sopa de letras»: the names of the pieces that the map lights up are hidden in a square of letters, and
 * the player marks each one from its first letter to its last: dragging over it, pressing its two ends, or
 * with the arrows and Enter. The map does not say what the pieces are called: finding a name writes it on
 * its piece. The rules are in lib/wordsearch.ts. A game in a file of its own, fetched when it is played.
 */
import { ArrowLeft, ArrowRight, Check, Eye, Flag as FlagIcon, List, Map as MapIcon, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { seedOf } from '../lib/challenge';
import { L, getLang } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { cx, nf } from '../lib/text';
import type { Res } from '../lib/types';
import { WS_SIDE, cellsOf, lineOf, snapTo, spelled, wsBoard, wsDeal, wsMatch, wsPool, wsRes, type Cell } from '../lib/wordsearch';
import { GameShell, Hud, Results, Verdict, answered, useElapsed, type GameProps, type ResultRow } from './common';
import './wordsearch.css';

/** A name of the square in hand that has been settled: found between two cells, or shown where it was. */
interface Mark {
  id: string;
  res: Res;
  a: Cell;
  b: Cell;
}

interface Played {
  id: string;
  res: Res;
}

const same = (a: Cell | null, b: Cell | null): boolean => !!a && !!b && a.r === b.r && a.c === b.c;

/** How thick a mark is, in cells. */
const BAR = 0.78;

/** A mark over the letters from one cell to another: a bar with round ends, in the units of the square (a cell is 1 × 1). */
function Bar({ a, b, kind }: { a: Cell; b: Cell; kind: string }) {
  const x = a.c + 0.5;
  const y = a.r + 0.5;
  const dx = b.c - a.c;
  const dy = b.r - a.r;
  const turn = (Math.atan2(dy, dx) * 180) / Math.PI;
  return <rect className={`ws-bar ${kind}`} x={x - BAR / 2} y={y - BAR / 2} width={Math.hypot(dx, dy) + BAR} height={BAR} rx={BAR / 2} transform={`rotate(${turn.toFixed(2)} ${x} ${y})`} />;
}

/**
 * A phone, upright or lying down, or a tablet held upright: a screen where the map is not beside the square,
 * and the square would leave it a strip too small to tell ten pieces apart. There the two take turns, each
 * with the whole screen (the same rule is in wordsearch.css).
 */
const PHONE = '(max-width: 860px), (max-width: 1000px) and (max-height: 500px)';

/** Whether the screen is one of those now. */
function usePhone(): boolean {
  const [phone, setPhone] = useState(() => typeof matchMedia === 'function' && matchMedia(PHONE).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const mq = matchMedia(PHONE);
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return phone;
}

export function WordSearchGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const lang = getLang();
  const seed = seedOf(cfg);
  const pool = useMemo(() => wsPool(deck.items, cfg.only, lang), [deck, cfg.only, lang]);
  const boards = useMemo(() => wsDeal(pool.words, cfg.opts.length, seed, !!cfg.only), [pool, cfg.opts.length, cfg.only, seed]);
  const total = useMemo(() => boards.reduce((n, b) => n + b.length, 0), [boards]);

  /** The square in hand. */
  const [at, setAt] = useState(0);
  /** The names of it that have been found, in the order they were. */
  const [marks, setMarks] = useState<Mark[]>([]);
  /** The list of names has been asked for: what is found from then on is found with help. */
  const [listed, setListed] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  /** Every name that has been settled, of this square and of the ones before. */
  const [results, setResults] = useState<Played[]>([]);
  /** What the last thing the player did came to, said under the square. */
  const [said, setSaid] = useState<{ text: string; bad?: boolean } | null>(null);
  /** The first letter of a mark made in two steps: a cell pressed, waiting for the other end. */
  const [anchor, setAnchor] = useState<Cell | null>(null);
  /** The cell the keyboard is on. */
  const [cur, setCur] = useState<Cell>({ r: 0, c: 0 });
  /** A mark that is being dragged. */
  const [drag, setDrag] = useState<{ from: Cell; to: Cell } | null>(null);
  /** The last mark that was no name: it shows for a moment where it was made. */
  const [miss, setMiss] = useState<{ a: Cell; b: Cell; n: number } | null>(null);
  const [flash, setFlash] = useState<{ id: string; kind: 'ok'; n: number } | null>(null);
  const [stopped, setStopped] = useState(false);
  /** On a phone: the map has the screen, and the square is out of sight. */
  const [onMap, setOnMap] = useState(false);
  const phone = usePhone();
  const map = useRef<MapHandle>(null);
  const grid = useRef<HTMLDivElement>(null);
  const toMap = useRef<HTMLButtonElement>(null);
  /** The drag in hand as the pointer events see it: they come faster than the screen is drawn. */
  const dragging = useRef<{ pointer: number; from: Cell; to: Cell } | null>(null);
  const addSession = useStore((s) => s.addSession);

  const ended = stopped || at >= boards.length;
  const ms = useElapsed(!ended);
  // Each square has a seed of its own, made from that of the game: the same game is the same squares.
  const board = useMemo(() => (at < boards.length ? wsBoard(boards[at], (seed ^ Math.imul(at + 1, 0x9e3779b1)) >>> 0) : null), [boards, at, seed]);
  const side = board?.side ?? WS_SIDE;
  const found = useMemo(() => new Set(marks.map((m) => m.id)), [marks]);
  const left = board ? board.placed.length - marks.length : 0;
  /** The square in hand is over: every name was found, or the player gave it up. */
  const done = !!board && !ended && (gaveUp || left === 0);
  const last = at + 1 >= boards.length;
  const title = MODE_NAME.wordsearch;
  const what = cfg.list ? `${deck.title} · ${cfg.list}` : deck.title;
  const nameOf = (id: string): string => deck.byId.get(id)?.name ?? id;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ws?: unknown }).__ws = board;

  // Each square starts on the whole map: its pieces may be anywhere on it.
  useEffect(() => {
    if (!board) return;
    map.current?.reset();
    setOnMap(false);
    // The button that brought the square here is gone: the letters take the focus it had, so that the
    // keyboard goes on from them. Not on the first square, which nobody pressed a button for.
    if (at > 0) grid.current?.querySelector<HTMLElement>('[data-r="0"][data-c="0"]')?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);

  useEffect(() => {
    if (!ended || !results.length) return;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: what,
      total: results.length,
      ok: results.filter((r) => r.res === 'ok').length,
      warn: results.filter((r) => r.res === 'warn').length,
      bad: results.filter((r) => r.res === 'bad').length,
      ms,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  /** A line of cells has been marked: a name, one that was found already, or nothing. */
  const mark = (cells: Cell[]) => {
    if (!board || done) return;
    setAnchor(null);
    const a = cells[0];
    const b = cells[cells.length - 1];
    const hit = wsMatch(board, found, cells);
    if (!hit) {
      const text = spelled(board.rows, cells);
      setMiss((m) => ({ a, b, n: (m?.n ?? 0) + 1 }));
      setSaid({ text: L(`«${text}» no es ninguno de los nombres.`, `“${text}” is none of the names.`), bad: true });
      // A mark that is no name is heard, and takes nothing off.
      answered('try');
      return;
    }
    setMiss(null);
    const name = nameOf(hit.id);
    if (hit.again) {
      setSaid({ text: L(`${name}: ese ya lo tenías.`, `${name}: you had that one already.`) });
      return;
    }
    const res = wsRes(true, listed);
    const rest = left - 1;
    setMarks((m) => [...m, { id: hit.id, res, a, b }]);
    setResults((r) => [...r, { id: hit.id, res }]);
    setFlash((f) => ({ id: hit.id, kind: 'ok', n: (f?.n ?? 0) + 1 }));
    setSaid({ text: rest > 0 ? L(`¡${name}! ${rest === 1 ? 'Queda 1' : `Quedan ${nf(rest)}`}.`, `${name}! ${nf(rest)} to go.`) : L(`¡${name}!`, `${name}!`) });
    // The last name brings the verdict of the square, which sounds by itself: one sound, not two at once.
    if (rest > 0) answered(res);
  };

  /** A cell has been pressed, with a finger or with Enter: the first letter of a mark, or its last. */
  const press = (cell: Cell) => {
    if (!board || done) return;
    const letter = board.rows[cell.r][cell.c];
    if (!anchor) {
      setAnchor(cell);
      setMiss(null);
      setSaid({ text: L(`Primera letra: ${letter}. Marca ahora la última.`, `First letter: ${letter}. Now mark the last one.`) });
      return;
    }
    if (same(anchor, cell)) {
      setAnchor(null);
      setSaid({ text: L('Marca anulada.', 'Mark cancelled.') });
      return;
    }
    const line = lineOf(anchor, cell);
    if (!line) {
      // Two cells that are not in line are no mark: the second one starts another.
      setAnchor(cell);
      setSaid({ text: L(`Esas dos letras no están en línea. Primera letra: ${letter}.`, `Those two letters are not in line. First letter: ${letter}.`), bad: true });
      return;
    }
    mark(line);
  };

  /** The cell under a point of the screen: the nearest one, when the point is off the square. */
  const cellAt = (x: number, y: number): Cell | null => {
    const box = grid.current?.getBoundingClientRect();
    if (!box || !box.width || !box.height) return null;
    const inside = (n: number): number => Math.min(side - 1, Math.max(0, Math.floor(n * side)));
    return { r: inside((y - box.top) / box.height), c: inside((x - box.left) / box.width) };
  };

  const onDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!board || done || dragging.current || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const from = cellAt(e.clientX, e.clientY);
    if (!from) return;
    // The square keeps the pointer while it is down: a mark may leave it and come back.
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragging.current = { pointer: e.pointerId, from, to: from };
    setDrag({ from, to: from });
    setCur(from);
  };
  const onMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragging.current;
    if (!d || d.pointer !== e.pointerId) return;
    const under = cellAt(e.clientX, e.clientY);
    if (!under) return;
    const to = snapTo(d.from, under, side);
    if (same(to, d.to)) return;
    d.to = to;
    setDrag({ from: d.from, to });
  };
  const onUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragging.current;
    if (!d || d.pointer !== e.pointerId) return;
    dragging.current = null;
    setDrag(null);
    // Let go where it was pressed: a cell pressed. Anywhere else: a mark from one to the other.
    if (same(d.from, d.to)) press(d.from);
    else mark(lineOf(d.from, d.to)!);
  };
  const onCancel = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (dragging.current?.pointer !== e.pointerId) return;
    dragging.current = null;
    setDrag(null);
  };

  const moveTo = (to: Cell) => {
    setCur(to);
    grid.current?.querySelector<HTMLElement>(`[data-r="${to.r}"][data-c="${to.c}"]`)?.focus();
  };
  const onKey = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!board || done || e.ctrlKey || e.metaKey || e.altKey) return;
    const step = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number] | undefined>)[e.key];
    const inside = (n: number): number => Math.min(side - 1, Math.max(0, n));
    if (step) {
      e.preventDefault();
      moveTo({ r: inside(cur.r + step[0]), c: inside(cur.c + step[1]) });
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      moveTo({ r: cur.r, c: e.key === 'Home' ? 0 : side - 1 });
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (!e.repeat) press(cur);
    } else if (e.key === 'Escape' && anchor) {
      e.preventDefault();
      setAnchor(null);
      setSaid({ text: L('Marca anulada.', 'Mark cancelled.') });
    }
  };

  const showNames = () => {
    if (!board || done || listed) return;
    setListed(true);
    setSaid({ text: L('Ahí tienes los nombres. Los que encuentres desde ahora cuentan como «con ayuda».', 'There are the names. The ones you find from now on count as “with help”.') });
  };

  const giveUp = () => {
    if (!board || done) return;
    const missed = board.placed.filter((p) => !found.has(p.id));
    setGaveUp(true);
    setAnchor(null);
    setMiss(null);
    setResults((r) => [...r, ...missed.map((p) => ({ id: p.id, res: 'bad' as Res }))]);
  };

  const next = () => {
    setAt((n) => n + 1);
    setMarks([]);
    setListed(false);
    setGaveUp(false);
    setSaid(null);
    setAnchor(null);
    setMiss(null);
    setCur({ r: 0, c: 0 });
  };

  useEffect(() => {
    if (!done) return;
    const onEnter = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey || (e.key !== 'Enter' && e.key !== ' ')) return;
      const on = e.target instanceof Element ? e.target : null;
      if (on?.closest('button, a, summary, input, textarea, select, [role="application"]') || document.querySelector('dialog[open]')) return;
      e.preventDefault();
      if (last) setStopped(true);
      else next();
    };
    window.addEventListener('keydown', onEnter);
    return () => window.removeEventListener('keydown', onEnter);
  });

  const settled = useMemo(() => new Map(results.map((r) => [r.id, r.res])), [results]);
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    // What is to be found is lit and does not beat: ten pieces beating at once would be all that is seen.
    if (board && !ended) for (const w of board.placed) p[w.id] = 'to';
    for (const [id, res] of settled) p[id] = res;
    return p;
  }, [settled, board, ended]);
  /** A name that has been found is written on its piece, and the ones that were not when the square is over. */
  const pinned = useMemo(() => new Set(board && !ended ? board.placed.filter((p) => settled.has(p.id)).map((p) => p.id) : []), [board, ended, settled]);
  /** The map of a phone is in sight: the square is not. */
  const mapUp = phone && onMap && !ended;
  const wasUp = useRef(false);
  useEffect(() => {
    // A phone has no room for the whole map and ten pieces that can be told apart: it comes as close as they let it.
    if (mapUp && board) map.current?.focus(board.placed.map((p) => p.id), { force: true, fill: 0.85, instant: true });
    // The button that gave the screen back went with the map: the one that had brought it takes the focus.
    if (!mapUp && wasUp.current) toMap.current?.focus({ preventScroll: true });
    wasUp.current = mapUp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapUp]);

  const stage = (
    <>
      <MapView
        ref={map}
        deck={deck}
        paint={paint}
        labels={ended ? 'all' : undefined}
        pinned={pinned}
        flash={flash}
        // No names while there are some to find, but those of the pieces that have been settled.
        tip={(id) => (ended || settled.has(id) ? deck.byId.get(id)?.name : null)}
      />
      {mapUp && (
        // The class is what puts the map over the square (wordsearch.css).
        <button type="button" className="btn btn-primary ws-back ws-big" onClick={() => setOnMap(false)} autoFocus>
          <ArrowLeft size={16} aria-hidden="true" />
          {L('Volver a la sopa', 'Back to the grid')}
        </button>
      )}
    </>
  );

  if (ended) {
    const rows: ResultRow[] = results.map((r) => ({
      item: deck.byId.get(r.id)!,
      res: r.res,
      note: r.res === 'bad' ? L('sin encontrar', 'not found') : r.res === 'warn' ? L('con la lista de nombres', 'with the list of names') : undefined,
    }));
    // A game of a list or of the whole map is short of the names that do not fit, and so is one of so many
    // names when the ones that fit are fewer: it says which were left out.
    const asked = cfg.only || typeof cfg.opts.length !== 'number' ? Infinity : cfg.opts.length;
    const out = total < asked ? pool.left.map(nameOf) : [];
    const outNames = out.length > 4 ? `${out.slice(0, 3).join(', ')}${L(` y ${nf(out.length - 3)} más`, ` and ${nf(out.length - 3)} more`)}` : out.join(', ');
    const outNote = out.length
      ? L(
          `${out.length === 1 ? 'No cabe en la sopa y se queda fuera' : 'No caben en la sopa y se quedan fuera'}: ${outNames}. Entran los nombres de 3 a ${nf(side)} letras.`,
          `${out.length === 1 ? 'Does not fit the grid and is left out' : 'Do not fit the grid and are left out'}: ${outNames}. Names of 3 to ${nf(side)} letters go in.`,
        )
      : '';
    const played = Math.min(boards.length, at + 1);
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            // «All of them» is said of the whole game: one that was left half way found what it found.
            title={!boards.length ? L('Sin nombres', 'No names') : rows.length === total && rows.every((r) => r.res === 'ok') ? L('¡Todos, y sin mirar la lista!', 'All of them, and without the list!') : L('Partida terminada', 'Game over')}
            note={
              !boards.length ? (
                L(`En este mapa no hay ningún nombre que quepa en la sopa: entran los de 3 a ${nf(side)} letras.`, `No name on this map fits the grid: names of 3 to ${nf(side)} letters go in.`)
              ) : rows.length ? (
                <>
                  {L(
                    'A la primera: el nombre encontrado solo con el mapa. Con ayuda: con la lista de nombres a la vista. Marcar donde no hay nada no resta.',
                    'First time: the name found with the map alone. With help: with the list of names in sight. Marking where there is nothing takes nothing off.',
                  )}
                  {outNote && <span className="ws-out"> {outNote}</span>}
                </>
              ) : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={rows.length && boards.length > 1 ? [{ label: L('Sopas', 'Grids'), value: `${nf(played)} ${L('de', 'of')} ${nf(boards.length)}` }] : undefined}
            again={boards.length > 0}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const b = board!;
  const count = b.placed.length;
  const { one, many, fem } = deck.noun;
  const intro = L(
    count === 1
      ? `Busca el nombre ${fem ? 'de la' : 'del'} ${one} ${fem ? 'iluminada' : 'iluminado'} en el mapa. Arrastra de la primera letra a la última.`
      : `Busca los nombres de ${fem ? 'las' : 'los'} ${nf(count)} ${many} ${fem ? 'iluminadas' : 'iluminados'} en el mapa. Arrastra de la primera letra a la última.`,
    count === 1 ? `Find the name of the ${one} lit up on the map. Drag from the first letter to the last.` : `Find the names of the ${nf(count)} ${many} lit up on the map. Drag from the first letter to the last.`,
  );
  /** The line that is being drawn: a drag, or the keyboard on its way from the first letter. */
  const live = done ? null : drag && !same(drag.from, drag.to) ? lineOf(drag.from, drag.to) : !drag && anchor && !same(anchor, cur) ? lineOf(anchor, cur) : null;
  const liveKeys = new Set((live ?? []).map(({ r, c }) => `${r},${c}`));
  /** Where the names that were not found are, once the square is given up. */
  const shown = gaveUp ? b.placed.filter((p) => !found.has(p.id)).map((p) => ({ id: p.id, cells: cellsOf(p) })) : [];
  const helped = marks.filter((m) => m.res === 'warn').length;
  const boardRes: Res = gaveUp ? 'bad' : helped ? 'warn' : 'ok';
  /** The names under the square: the ones found, in the order they were; with the list in sight, all of them, by name. */
  const collator = new Intl.Collator(lang);
  const names: { id: string; res: Res | null }[] =
    listed || done
      ? b.placed.map((p) => ({ id: p.id, res: settled.get(p.id) ?? null })).sort((x, y) => collator.compare(nameOf(x.id), nameOf(y.id)))
      : marks.map((m) => ({ id: m.id, res: m.res }));
  const room = { '--side': side } as CSSProperties;
  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={total ? results.length / total : 0}
      hud={<Hud ms={ms} progress={`${nf(results.length)} / ${nf(total)}`} />}
      stage={stage}
      panel={
        <div className="q ws">
          <div className="ws-head">
            <p className="kicker">{boards.length > 1 ? L(`Sopa ${nf(at + 1)} de ${nf(boards.length)}`, `Grid ${nf(at + 1)} of ${nf(boards.length)}`) : L('¿Cómo se llaman?', 'What are they called?')}</p>
            <p className="ws-count">
              {L('Llevas', 'Found')} <b>{nf(marks.length)}</b> {L('de', 'of')} {nf(count)}
            </p>
          </div>
          {phone && (
            <button type="button" className="btn btn-sm ws-tomap" ref={toMap} onClick={() => setOnMap(true)}>
              <MapIcon size={15} aria-hidden="true" />
              {L('Ver el mapa', 'See the map')}
            </button>
          )}
          <div className="ws-box">
            <div
              key={at}
              ref={grid}
              className={cx('ws-grid', done && 'over')}
              style={room}
              role="grid"
              aria-label={L(`Sopa de letras de ${nf(side)} por ${nf(side)}`, `Word search grid, ${nf(side)} by ${nf(side)}`)}
              aria-readonly="true"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onCancel}
              onKeyDown={onKey}
            >
              <svg className="ws-marks" viewBox={`0 0 ${side} ${side}`} preserveAspectRatio="none" aria-hidden="true">
                {marks.map((m, i) => (
                  <Bar key={m.id} a={m.a} b={m.b} kind={cx(m.res, i === marks.length - 1 && !gaveUp && 'fresh')} />
                ))}
                {shown.map((s) => (
                  <Bar key={s.id} a={s.cells[0]} b={s.cells[s.cells.length - 1]} kind="bad" />
                ))}
                {miss && !live && !done && <Bar key={`miss${miss.n}`} a={miss.a} b={miss.b} kind="miss" />}
                {live && <Bar a={live[0]} b={live[live.length - 1]} kind="live" />}
                {!done && anchor && !live && <Bar a={anchor} b={anchor} kind="anchor" />}
                {!done && drag && !live && <Bar a={drag.from} b={drag.from} kind="anchor" />}
              </svg>
              {b.rows.map((row, r) => (
                <div key={r} className="ws-row" role="row">
                  {[...row].map((ch, c) => (
                    <span
                      key={c}
                      className="ws-cell"
                      role="gridcell"
                      data-r={r}
                      data-c={c}
                      // One cell is in the order of the Tab key: the one the arrows left off at.
                      tabIndex={!done && cur.r === r && cur.c === c ? 0 : -1}
                      aria-selected={liveKeys.has(`${r},${c}`) || same(anchor, { r, c }) || undefined}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {!done && (
            <p className={cx('q-note ws-said', said?.bad && !live && 'ws-no')} role="status">
              {live ? <span className="ws-spell">{spelled(b.rows, live)}</span> : (said?.text ?? intro)}
            </p>
          )}
          {done && (
            <Verdict
              res={boardRes}
              title={
                gaveUp
                  ? L(left === 1 ? 'Te ha faltado 1 nombre' : `Te han faltado ${nf(left)} nombres`, left === 1 ? '1 name was left' : `${nf(left)} names were left`)
                  : L(count === 1 ? '¡Nombre encontrado!' : '¡Sopa completa!', count === 1 ? 'Name found!' : 'Grid complete!')
              }
              lead={
                <p className="facts">
                  {gaveUp
                    ? L(`${left === 1 ? 'Está' : 'Están'} en la sopa con línea discontinua, y en el mapa con su nombre.`, `${left === 1 ? 'It is' : 'They are'} in the grid with a dashed line, and on the map with ${left === 1 ? 'its name' : 'their names'}.`)
                    : helped === 0
                      ? L(count === 1 ? 'Solo con el mapa.' : `Los ${nf(count)}, solo con el mapa.`, count === 1 ? 'With the map alone.' : `All ${nf(count)}, with the map alone.`)
                      : helped === count
                        ? L('Con la lista de nombres a la vista.', 'With the list of names in sight.')
                        : L(`${nf(count - helped)} solo con el mapa y ${nf(helped)} con la lista de nombres a la vista.`, `${nf(count - helped)} with the map alone and ${nf(helped)} with the list of names in sight.`)}
                </p>
              }
            />
          )}
          <div className="q-actions">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente sopa', 'Next grid')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={showNames} disabled={listed}>
                  <List size={15} aria-hidden="true" />
                  {L('Ver los nombres', 'Show the names')}
                </button>
                <button type="button" className="btn btn-sm" onClick={giveUp}>
                  <Eye size={15} aria-hidden="true" />
                  {L('Me rindo', 'I give up')}
                </button>
              </>
            )}
            {!(done && last) && (
              <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => setStopped(true)}>
                <FlagIcon size={15} aria-hidden="true" />
                {L('Terminar', 'Finish')}
              </button>
            )}
          </div>
          {names.length > 0 && (
            <ul className="ws-names" aria-label={listed || done ? L('Los nombres de esta sopa', 'The names of this grid') : L('Nombres encontrados', 'Names found')}>
              {names.map(({ id, res }) => (
                <li key={id} className={cx('ws-name', res)}>
                  {res === 'bad' ? <X size={13} strokeWidth={3} aria-hidden="true" /> : res ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : null}
                  {nameOf(id)}
                  {res && <span className="sr-only"> ({res === 'bad' ? L('sin encontrar', 'not found') : res === 'warn' ? L('encontrado con la lista', 'found with the list') : L('encontrado', 'found')})</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    />
  );
}
