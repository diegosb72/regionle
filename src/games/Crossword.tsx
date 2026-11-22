/**
 * «Crucigrama»: the names of some pieces of the map cross each other in a grid, and the map is the list of
 * clues: each word has a number, and its piece carries that number. A word is written with the keyboard or
 * with the letters on the screen; written rightly, it stays and its name comes up on the map. The rules are
 * in lib/crossword.ts. A game in a file of its own, fetched when it is played.
 */
import { ArrowLeft, ArrowRight, Delete, Eye, Flag as FlagIcon, Keyboard, Lightbulb, Map as MapIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { seedOf } from '../lib/challenge';
import { CW_COLS, CW_MIN, cellsOf, cwCells, cwDeal, cwFull, cwKey, cwPool, cwRes, cwRight, cwStep, partsOf, wordAt, type Cell, type CwPlaced } from '../lib/crossword';
import { L, getLang } from '../lib/i18n';
import { letterOf, lettersOf } from '../lib/letters';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { cx, nf } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, answered, useElapsed, type GameProps, type ResultRow } from './common';
import { useMedia, usePhone } from './phone';
import './crossword.css';

/** A word that has been settled, and how: with a letter that was asked for, or after it was written wrongly. */
interface Played {
  id: string;
  res: Res;
  asked: boolean;
  missed: boolean;
}

/** The rows of letters to write with, as a keyboard lays them. */
const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

const NONE: ReadonlySet<never> = new Set();

/** A window too short for a heading over the grid: a small laptop, a tablet lying down. */
const SHORT = '(max-height: 800px)';

export function CrosswordGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const lang = getLang();
  const seed = seedOf(cfg);
  const pool = useMemo(() => cwPool(deck.items, cfg.only, lang), [deck, cfg.only, lang]);
  const boards = useMemo(() => cwDeal(pool.words, cfg.opts.length, seed, !!cfg.only), [pool, cfg.opts.length, cfg.only, seed]);
  const total = useMemo(() => boards.reduce((n, b) => n + b.placed.length, 0), [boards]);
  const alphabet = useMemo(() => new Set(lettersOf(lang)), [lang]);

  /** The crossword in hand. */
  const [at, setAt] = useState(0);
  /** The letters in its cells, by the place of each. */
  const [written, setWritten] = useState<Record<string, string>>({});
  /** The cells whose letter was asked for. */
  const [given, setGiven] = useState<ReadonlySet<string>>(NONE);
  /** The words of it that are settled, by their place in the crossword. */
  const [solved, setSolved] = useState<Record<number, Res>>({});
  /** The words that were written wrongly at some time, and the ones a letter was asked for. */
  const [missed, setMissed] = useState<ReadonlySet<number>>(NONE);
  const [helped, setHelped] = useState<ReadonlySet<number>>(NONE);
  const [gaveUp, setGaveUp] = useState(false);
  /** Every word that has been settled, of this crossword and of the ones before. */
  const [results, setResults] = useState<Played[]>([]);
  /** How many letters have been asked for in the whole game. */
  const [asked, setAsked] = useState(0);
  /** What the last thing the player did came to. */
  const [said, setSaid] = useState<{ text: string; bad?: boolean } | null>(null);
  /** The word that is being written, and which of its cells the next letter goes in. */
  const [sel, setSel] = useState(0);
  const [pos, setPos] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'ok'; n: number } | null>(null);
  const [stopped, setStopped] = useState(false);
  /** On a phone: the map has the screen, and the crossword is out of sight. */
  const [onMap, setOnMap] = useState(false);
  /** The letters on the screen: always there where the pointer is a finger, and elsewhere when they are asked for. */
  const touch = useMedia('(pointer: coarse)');
  const [keysOn, setKeysOn] = useState(false);
  const phone = usePhone();
  /** Where the room is short the grid has it: no heading over it, and one line for what is said. */
  const compact = useMedia(SHORT) || phone;
  const map = useRef<MapHandle>(null);
  const grid = useRef<HTMLDivElement>(null);
  const toMap = useRef<HTMLButtonElement>(null);
  const addSession = useStore((s) => s.addSession);

  const ended = stopped || at >= boards.length;
  const ms = useElapsed(!ended);
  const board = at < boards.length ? boards[at] : null;
  const cells = useMemo(() => (board ? cwCells(board) : new Map()), [board]);
  const count = board?.placed.length ?? 0;
  const left = board ? board.placed.filter((_, i) => solved[i] == null).length : 0;
  /** The crossword in hand is over: every word is written, or the player gave it up. */
  const done = !!board && !ended && (gaveUp || left === 0);
  const last = at + 1 >= boards.length;
  const title = MODE_NAME.crossword;
  const what = cfg.list ? `${deck.title} · ${cfg.list}` : deck.title;
  const nameOf = (id: string): string => deck.byId.get(id)?.name ?? id;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __cw?: unknown }).__cw = board;

  /** The cells that take no more letters: those of the words that are settled, and the ones that were given. */
  const locked = useMemo(() => {
    const keys = new Set(given);
    board?.placed.forEach((p, i) => {
      if (solved[i] != null) for (const { r, c } of cellsOf(p)) keys.add(cwKey(r, c));
    });
    return keys;
  }, [board, solved, given]);
  const word: CwPlaced | null = board?.placed[sel] ?? null;
  const wordCells = useMemo(() => (word ? cellsOf(word) : []), [word]);
  const cur: Cell | null = wordCells[pos] ?? null;

  // Each crossword starts on the whole map: its pieces may be anywhere on it.
  useEffect(() => {
    if (!board) return;
    map.current?.reset();
    setOnMap(false);
    // The button that brought the crossword here is gone: its first cell takes the focus it had, so that
    // the keyboard goes on from there. Not on the first crossword, which nobody pressed a button for.
    if (at > 0) grid.current?.querySelector<HTMLElement>('.cw-cell.at')?.focus({ preventScroll: true });
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

  // The cell that is written in keeps the focus of the grid, and stays in sight where the grid is taller than the screen.
  useEffect(() => {
    if (!board || done || !cur) return;
    const el = grid.current?.querySelector<HTMLElement>(`[data-r="${cur.r}"][data-c="${cur.c}"]`);
    if (!el) return;
    const on = document.activeElement;
    if (on && on !== el && grid.current?.contains(on)) el.focus({ preventScroll: true });
    el.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, pos, at]);

  /** The first cell of a word that can still be written in; its first one when none can. */
  const firstOpen = (index: number, shut: ReadonlySet<string> = locked): number => {
    const at0 = cellsOf(board!.placed[index]).findIndex(({ r, c }) => !shut.has(cwKey(r, c)));
    return Math.max(0, at0);
  };

  /** The word after one, or before it, among those that are not settled; the same one when there is no other. */
  const otherWord = (from: number, back: boolean, settled: Readonly<Record<number, Res>> = solved): number => {
    for (let step = 1; step <= count; step++) {
      const index = (((from + (back ? -step : step)) % count) + count) % count;
      if (settled[index] == null) return index;
    }
    return from;
  };

  /**
   * A letter has gone into a cell, written or given: the words that go through it are looked at. One that is
   * full and right is settled; one that is full and wrong is told so, and no longer counts as right first time.
   */
  const settle = (next: Record<string, string>, key: string, index: number, gift?: { given: ReadonlySet<string>; helped: ReadonlySet<number> }) => {
    const b = board!;
    const cell = cells.get(key)!;
    const aided = gift?.helped ?? helped;
    const nowSolved: Record<number, Res> = {};
    const nowMissed = new Set(missed);
    let wrong = -1;
    for (const w of [cell.across, cell.down]) {
      if (w < 0 || solved[w] != null) continue;
      const p = b.placed[w];
      if (!cwFull(p, next)) continue;
      if (cwRight(p, next)) nowSolved[w] = cwRes(true, !aided.has(w) && !missed.has(w));
      else {
        nowMissed.add(w);
        wrong = w;
      }
    }
    const allSolved = { ...solved, ...nowSolved };
    const fresh = Object.keys(nowSolved).map(Number);
    setWritten(next);
    if (gift) {
      setGiven(gift.given);
      setHelped(gift.helped);
    }
    if (nowMissed.size !== missed.size) setMissed(nowMissed);
    const shut = new Set(gift?.given ?? given);
    b.placed.forEach((p, i) => {
      if (allSolved[i] != null) for (const { r, c } of cellsOf(p)) shut.add(cwKey(r, c));
    });
    if (fresh.length) {
      setSolved(allSolved);
      setResults((r) => [...r, ...fresh.map((w) => ({ id: b.placed[w].id, res: nowSolved[w], asked: aided.has(w), missed: missed.has(w) }))]);
      // The word that was being written, when it is one of them: it is the one the player was after.
      const main = fresh.includes(sel) ? sel : fresh[0];
      const rest = b.placed.length - Object.keys(allSolved).length;
      const names = fresh.map((w) => nameOf(b.placed[w].id));
      const shout = names.length > 1 ? L(`¡${names.join(' y ')}!`, `${names.join(' and ')}!`) : L(`¡${names[0]}!`, `${names[0]}!`);
      setSaid({ text: rest > 0 ? `${shout} ${L(rest === 1 ? 'Queda 1.' : `Quedan ${nf(rest)}.`, `${nf(rest)} to go.`)}` : shout });
      setFlash((f) => ({ id: b.placed[main].id, kind: 'ok', n: (f?.n ?? 0) + 1 }));
      // The last word brings the verdict of the crossword, which sounds by itself: one sound, not two at once.
      if (rest > 0) answered(nowSolved[main]);
    } else if (wrong >= 0) {
      const p = b.placed[wrong];
      const text = cellsOf(p)
        .map(({ r, c }) => next[cwKey(r, c)] ?? '')
        .join('');
      setSaid({ text: L(`La palabra ${nf(p.n)} no es ${text}. Revisa sus letras.`, `Word ${nf(p.n)} is not ${text}. Check its letters.`), bad: true });
      answered('try');
    } else if (gift) {
      const two = cell.across >= 0 && cell.down >= 0 && solved[cell.across] == null && solved[cell.down] == null;
      setSaid({
        text: L(
          `Ahí va una letra: la ${cell.ch}. ${two ? 'Las dos palabras que la llevan cuentan' : 'Esa palabra cuenta'} ya como «con ayuda».`,
          `Here is a letter: ${cell.ch}. ${two ? 'The two words it is in now count' : 'That word now counts'} as “with help”.`,
        ),
      });
    } else if (said) setSaid(null);
    // Where the writing goes on: along the word, or in the next word when this one is done.
    if (allSolved[sel] != null) {
      const to = otherWord(sel, false, allSolved);
      if (to !== sel) {
        setSel(to);
        setPos(firstOpen(to, shut));
      }
    } else setPos(cwStep(b.placed[sel], index, false, ({ r, c }) => !shut.has(cwKey(r, c))));
  };

  /** The cell of the word in hand that a letter goes in: the one that is chosen, or the next one that is open. −1 when none is. */
  const target = (): number => {
    if (!word || !cur) return -1;
    const open = ({ r, c }: Cell): boolean => !locked.has(cwKey(r, c));
    if (open(cur)) return pos;
    const on = cwStep(word, pos, false, open);
    if (on !== pos) return on;
    const back = cwStep(word, pos, true, open);
    return back !== pos ? back : -1;
  };

  /** A letter is written, with a key or with a button. */
  const write = (letter: string) => {
    if (!board || done) return;
    const index = target();
    if (index < 0) return;
    const { r, c } = wordCells[index];
    const key = cwKey(r, c);
    settle({ ...written, [key]: letter }, key, index);
  };

  /** A letter is taken out: the one in the cell that is chosen or, with the key that goes back, the one before. */
  const erase = (back: boolean) => {
    if (!board || done || !word || !cur) return;
    const open = ({ r, c }: Cell): boolean => !locked.has(cwKey(r, c));
    let index = pos;
    if (!(open(cur) && written[cwKey(cur.r, cur.c)])) {
      if (!back) return;
      index = cwStep(word, pos, true, open);
      if (index === pos) return;
    }
    const { r, c } = wordCells[index];
    const next = { ...written };
    delete next[cwKey(r, c)];
    setWritten(next);
    setPos(index);
    if (said) setSaid(null);
  };

  /** The letter of a cell is asked for: the words that go through it no longer count as right first time. */
  const give = () => {
    if (!board || done) return;
    const index = target();
    if (index < 0) return;
    const { r, c } = wordCells[index];
    const key = cwKey(r, c);
    const cell = cells.get(key)!;
    const aided = new Set(helped);
    for (const w of [cell.across, cell.down]) if (w >= 0 && solved[w] == null) aided.add(w);
    setAsked((n) => n + 1);
    settle({ ...written, [key]: cell.ch }, key, index, { given: new Set(given).add(key), helped: aided });
  };

  /**
   * A cell is chosen, with the pointer. Chosen again, it turns to the other word that goes through it.
   * Otherwise it stands for a word that is still to be written: the one that starts in it, when it carries
   * a number, for that is how a word of the map is looked for; or the one that goes the way of the word in hand.
   */
  const choose = (r: number, c: number) => {
    if (!board || done) return;
    const cell = cells.get(cwKey(r, c));
    if (!cell) return;
    const again = !!cur && cur.r === r && cur.c === c;
    const open = (w: number): boolean => w >= 0 && solved[w] == null;
    // Words are numbered in the order they are laid in: the one with number n is the n-th.
    const starts = cell.n - 1;
    const down = again ? !word!.down : open(starts) ? board.placed[starts].down : open(cell.across) !== open(cell.down) ? open(cell.down) : (word?.down ?? false);
    const index = wordAt(cell, down);
    const p = board.placed[index];
    setSel(index);
    setPos(p.down ? r - p.r : c - p.c);
  };

  /** The arrows: to the next cell that way, over the gaps, and to the word that goes that way through it. */
  const move = (dr: number, dc: number) => {
    if (!board || !cur) return;
    let r = cur.r + dr;
    let c = cur.c + dc;
    while (r >= 0 && r < board.rows && c >= 0 && c < board.cols && !cells.has(cwKey(r, c))) {
      r += dr;
      c += dc;
    }
    const cell = cells.get(cwKey(r, c));
    if (!cell) return;
    // Along the word in hand, the word stays; out of it, the one that goes the way of the arrow.
    const index = (word!.down ? cell.down : cell.across) === sel ? sel : wordAt(cell, dr !== 0);
    const p = board.placed[index];
    setSel(index);
    setPos(p.down ? r - p.r : c - p.c);
  };

  const giveUp = () => {
    if (!board || done) return;
    const b = board;
    const missing = b.placed.map((_, i) => i).filter((i) => solved[i] == null);
    const next = { ...written };
    for (const [key, cell] of cells) next[key] = cell.ch;
    setWritten(next);
    setSolved({ ...solved, ...Object.fromEntries(missing.map((i) => [i, 'bad' as Res])) });
    setResults((r) => [...r, ...missing.map((i) => ({ id: b.placed[i].id, res: 'bad' as Res, asked: helped.has(i), missed: missed.has(i) }))]);
    setGaveUp(true);
  };

  const next = () => {
    setAt((n) => n + 1);
    setWritten({});
    setGiven(NONE);
    setSolved({});
    setMissed(NONE);
    setHelped(NONE);
    setGaveUp(false);
    setSaid(null);
    setSel(0);
    setPos(0);
  };

  /** The map of a phone is in sight: the crossword is not. */
  const mapUp = phone && onMap && !ended;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || e.defaultPrevented || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const on = e.target instanceof Element ? e.target : null;
      // Not while something is being typed somewhere, nor under a panel that is open over the game.
      if (on?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
      if (done) {
        if ((e.key === 'Enter' || e.key === ' ') && !e.repeat && !on?.closest('button, a, summary, [role="application"]')) {
          e.preventDefault();
          if (last) setStopped(true);
          else next();
        }
        return;
      }
      if (mapUp) return;
      // A letter is a letter wherever the focus is, and so is the key that takes one back.
      const letter = [...e.key].length === 1 ? letterOf(e.key, lang) : '';
      if (letter && alphabet.has(letter)) {
        e.preventDefault();
        if (!e.repeat) write(letter);
        return;
      }
      if (e.key === 'Backspace') {
        e.preventDefault();
        erase(true);
        return;
      }
      // The rest are the keys of the grid: elsewhere they are those of a button, or of the map.
      if (!on || !grid.current?.contains(on)) return;
      const step = ({ ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<string, [number, number] | undefined>)[e.key];
      if (step) {
        e.preventDefault();
        move(step[0], step[1]);
      } else if (e.key === 'Delete') {
        e.preventDefault();
        erase(false);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        setPos(e.key === 'Home' ? 0 : wordCells.length - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (e.repeat) return;
        const to = otherWord(sel, e.shiftKey);
        setSel(to);
        setPos(firstOpen(to));
      } else if (e.key === ' ') {
        e.preventDefault();
        if (!e.repeat && cur) choose(cur.r, cur.c);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const settled = useMemo(() => new Map(results.map((r) => [r.id, r.res])), [results]);
  /** The number of each word that is still to be written, by its piece: what the map writes on it. */
  const tags = useMemo(() => new Map(board && !ended ? board.placed.filter((p) => !settled.has(p.id)).map((p) => [p.id, nf(p.n)]) : []), [board, ended, settled]);
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (board && !ended) for (const w of board.placed) p[w.id] = w === word ? 'target' : 'sel';
    for (const [id, res] of settled) p[id] = res;
    return p;
  }, [settled, board, ended, word]);
  /** Every piece of the crossword carries something: its number while its word is to be written, and its name afterwards. */
  const pinned = useMemo(() => new Set(board && !ended ? board.placed.map((p) => p.id) : []), [board, ended]);
  const wasUp = useRef(false);
  useEffect(() => {
    // A phone has no room for the whole map and ten pieces that can be told apart: it comes as close as they let it.
    if (mapUp && board) map.current?.focus(board.placed.map((p) => p.id), { force: true, fill: 0.85, instant: true });
    // The button that gave the screen back went with the map: the one that had brought it takes the focus.
    if (!mapUp && wasUp.current) toMap.current?.focus({ preventScroll: true });
    wasUp.current = mapUp;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapUp]);

  /** A piece of the map is pressed: its word is the one to write. */
  const pick = (id: string) => {
    if (!board || done) return;
    const index = board.placed.findIndex((p) => p.id === id);
    if (index < 0) return;
    setSel(index);
    setPos(firstOpen(index));
  };

  const stage = (
    <>
      <MapView
        ref={map}
        deck={deck}
        paint={paint}
        labels={ended ? 'all' : undefined}
        pinned={pinned}
        tags={tags}
        flash={flash}
        pressable={!ended && !done}
        onPick={pick}
        // No names while there are some to write, but those of the pieces that have been settled.
        tip={(id) => (ended || settled.has(id) ? deck.byId.get(id)?.name : tags.has(id) ? L(`Palabra ${tags.get(id)}`, `Word ${tags.get(id)}`) : null)}
      />
      {mapUp && (
        // The class is what puts the map over the crossword (crossword.css).
        <button type="button" className="btn btn-primary cw-back cw-big" onClick={() => setOnMap(false)} autoFocus>
          <ArrowLeft size={16} aria-hidden="true" />
          {L('Volver al crucigrama', 'Back to the crossword')}
        </button>
      )}
    </>
  );

  if (ended) {
    const rows: ResultRow[] = results.map((r) => ({
      item: deck.byId.get(r.id)!,
      res: r.res,
      note:
        r.res === 'bad'
          ? L('sin escribir', 'not written')
          : r.res === 'warn'
            ? r.asked && r.missed
              ? L('con letras pedidas, y después de escribirla mal', 'with letters given, and after writing it wrongly')
              : r.asked
                ? L('con letras pedidas', 'with letters given')
                : L('después de escribirla mal', 'after writing it wrongly')
            : undefined,
    }));
    // A game of a list or of the whole map is short of the names that do not fit, and so is one of so many
    // names when the ones that fit are fewer: it says which were left out.
    const want = cfg.only || typeof cfg.opts.length !== 'number' ? Infinity : cfg.opts.length;
    const out = total < want ? pool.left.map(nameOf) : [];
    const outNames = out.length > 4 ? `${out.slice(0, 3).join(', ')}${L(` y ${nf(out.length - 3)} más`, ` and ${nf(out.length - 3)} more`)}` : out.join(', ');
    const outNote = out.length
      ? L(
          `${out.length === 1 ? 'No cabe en el crucigrama y se queda fuera' : 'No caben en el crucigrama y se quedan fuera'}: ${outNames}. Entran los nombres de ${nf(CW_MIN)} a ${nf(CW_COLS)} letras.`,
          `${out.length === 1 ? 'Does not fit the crossword and is left out' : 'Do not fit the crossword and are left out'}: ${outNames}. Names of ${nf(CW_MIN)} to ${nf(CW_COLS)} letters go in.`,
        )
      : '';
    const played = Math.min(boards.length, at + 1);
    const stats = [
      ...(boards.length > 1 ? [{ label: L('Crucigramas', 'Crosswords'), value: `${nf(played)} ${L('de', 'of')} ${nf(boards.length)}` }] : []),
      ...(asked > 0 ? [{ label: L('Letras pedidas', 'Letters given'), value: nf(asked) }] : []),
    ];
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            // «All of them» is said of the whole game: one that was left half way wrote what it wrote.
            title={!boards.length ? L('Sin nombres', 'No names') : rows.length === total && rows.every((r) => r.res === 'ok') ? L('¡Todas, y sin ayuda!', 'All of them, and without help!') : L('Partida terminada', 'Game over')}
            note={
              !boards.length ? (
                L(`En este mapa no hay ningún nombre que quepa en un crucigrama: entran los de ${nf(CW_MIN)} a ${nf(CW_COLS)} letras.`, `No name on this map fits a crossword: names of ${nf(CW_MIN)} to ${nf(CW_COLS)} letters go in.`)
              ) : rows.length ? (
                <>
                  {L(
                    'A la primera: la palabra bien escrita sin pedir letras y sin haberla completado mal antes. Con ayuda: la que sale después de eso.',
                    'First time: the word written rightly without asking for letters and without having completed it wrongly before. With help: one that comes out after that.',
                  )}
                  {outNote && <span className="cw-out"> {outNote}</span>}
                </>
              ) : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={rows.length && stats.length ? stats : undefined}
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
  const w = word!;
  const { one, many, fem } = deck.noun;
  const unwritten = b.placed.filter((_, i) => solved[i] === 'bad').length;
  const several = boards.length > 1;
  const nth = L(`Crucigrama ${nf(at + 1)} de ${nf(boards.length)}`, `Crossword ${nf(at + 1)} of ${nf(boards.length)}`);
  // With no heading over the grid, which crossword this is goes before what the numbers are, said in a few words.
  const intro = compact
    ? `${several ? `${nth}. ` : ''}${L(`Cada número es ${fem ? 'una' : 'un'} ${one} del mapa.`, `The numbers are ${many} on the map.`)}`
    : L(
        `Cada palabra es el nombre ${fem ? 'de la' : 'del'} ${one} que lleva su número en el mapa. Elige una casilla y escribe.`,
        `Each word is the name of the ${one} that carries its number on the map. Choose a cell and write.`,
      );
  const tally = (
    <p className="cw-count">
      {L('Llevas', 'Written')} <b>{nf(count - left - unwritten)}</b> {L('de', 'of')} {nf(count)}
    </p>
  );
  const parts = partsOf(nameOf(w.id));
  const inWord = new Set(wordCells.map(({ r, c }) => cwKey(r, c)));
  /** The cells of the words that are full and wrong, while they stay so. */
  const off = new Set<string>();
  b.placed.forEach((p, i) => {
    if (solved[i] == null && cwFull(p, written) && !cwRight(p, written)) for (const { r, c } of cellsOf(p)) off.add(cwKey(r, c));
  });
  /** How a cell that is settled is painted: by the best of the words that go through it. */
  const resOf = (cell: { across: number; down: number }): Res | null => {
    const found = [cell.across, cell.down].filter((i) => i >= 0 && solved[i] != null).map((i) => solved[i]);
    return found.includes('ok') ? 'ok' : found.includes('warn') ? 'warn' : found.includes('bad') ? 'bad' : null;
  };
  const withHelp = b.placed.filter((_, i) => solved[i] === 'warn').length;
  const boardRes: Res = gaveUp ? 'bad' : withHelp ? 'warn' : 'ok';
  const showKeys = !done && (touch || keysOn);
  const room = { '--cols': b.cols, '--rows': b.rows } as CSSProperties;
  const letters = (n: number): string => L(n === 1 ? '1 letra' : `${nf(n)} letras`, n === 1 ? '1 letter' : `${nf(n)} letters`);
  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={total ? results.length / total : 0}
      hud={<Hud ms={ms} progress={`${nf(results.length)} / ${nf(total)}`} />}
      stage={stage}
      panel={
        <div className={cx('q cw', showKeys && 'keys', compact && 'compact')}>
          <div className="cw-top">
            {!compact && (
              <div className="cw-head">
                <p className="kicker">{several ? nth : L('¿Cómo se llaman?', 'What are they called?')}</p>
                {tally}
              </div>
            )}
            {(!done || compact) && (
              <div className="cw-bar">
                {done ? (
                  // The word in hand is no more: with no heading, how the crossword went takes its place.
                  tally
                ) : (
                  <p className="cw-clue" aria-live="polite">
                    <b className="cw-num">{nf(w.n)}</b>
                    <span>
                      {w.down ? L('vertical', 'down') : L('horizontal', 'across')} · {letters(w.word.length)}
                      {parts.length > 1 && ` (${parts.map((n) => nf(n)).join(' + ')})`}
                    </span>
                  </p>
                )}
                {phone && (
                  <button type="button" className="btn btn-sm cw-tomap" ref={toMap} onClick={() => setOnMap(true)}>
                    <MapIcon size={15} aria-hidden="true" />
                    {L('Ver el mapa', 'See the map')}
                  </button>
                )}
              </div>
            )}
            {done ? (
              // Where the word in hand and what was said of it were: the grid under it stays where it is.
              <Verdict
                res={boardRes}
                title={
                  gaveUp
                    ? L(unwritten === 1 ? 'Te ha faltado 1 palabra' : `Te han faltado ${nf(unwritten)} palabras`, unwritten === 1 ? '1 word was left' : `${nf(unwritten)} words were left`)
                    : L(count === 1 ? '¡Palabra escrita!' : '¡Crucigrama completo!', count === 1 ? 'Word written!' : 'Crossword complete!')
                }
                lead={
                  <p className="facts">
                    {gaveUp
                      ? L(
                          `${unwritten === 1 ? 'Está escrita' : 'Están escritas'} en el crucigrama, y en el mapa con su nombre.`,
                          `${unwritten === 1 ? 'It is' : 'They are'} written in the crossword, and on the map with ${unwritten === 1 ? 'its name' : 'their names'}.`,
                        )
                      : withHelp === 0
                        ? L(count === 1 ? 'A la primera.' : `Las ${nf(count)}, a la primera.`, count === 1 ? 'First time.' : `All ${nf(count)}, first time.`)
                        : withHelp === count
                          ? L(count === 1 ? 'Con ayuda.' : 'Todas con ayuda.', count === 1 ? 'With help.' : 'All of them with help.')
                          : L(`${nf(count - withHelp)} a la primera y ${nf(withHelp)} con ayuda.`, `${nf(count - withHelp)} first time and ${nf(withHelp)} with help.`)}
                  </p>
                }
              />
            ) : (
              <p className={cx('q-note cw-said', said?.bad && 'cw-no')} role="status">
                {said?.text ?? intro}
              </p>
            )}
          </div>
          <div className="cw-box" style={room}>
            <div key={at} ref={grid} className={cx('cw-grid', done && 'over')} role="grid" aria-label={L(`Crucigrama de ${nf(b.rows)} filas y ${nf(b.cols)} columnas`, `Crossword of ${nf(b.rows)} rows and ${nf(b.cols)} columns`)}>
              {Array.from({ length: b.rows }, (_, r) => (
                <div key={r} className="cw-row" role="row">
                  {Array.from({ length: b.cols }, (_, c) => {
                    const key = cwKey(r, c);
                    const cell = cells.get(key);
                    if (!cell) return <span key={c} className="cw-gap" role="presentation" />;
                    const res = resOf(cell);
                    const here = !done && !!cur && cur.r === r && cur.c === c;
                    const ch = written[key] ?? '';
                    const mine = inWord.has(key);
                    // What the cell is, for whoever hears the crossword: its word and its place in it, and its letter.
                    const index = mine ? sel : wordAt(cell, false);
                    const p = b.placed[index];
                    const nth = (p.down ? r - p.r : c - p.c) + 1;
                    const label = `${nf(p.n)} ${p.down ? L('vertical', 'down') : L('horizontal', 'across')}, ${L(`letra ${nf(nth)} de ${nf(p.word.length)}`, `letter ${nf(nth)} of ${nf(p.word.length)}`)}: ${ch || L('vacía', 'empty')}`;
                    return (
                      <span
                        key={c}
                        className={cx('cw-cell', !done && mine && 'in', here && 'at', res, !res && given.has(key) && 'given', !res && off.has(key) && 'off')}
                        role="gridcell"
                        data-r={r}
                        data-c={c}
                        // One cell is in the order of the Tab key: the one that is written in.
                        tabIndex={here ? 0 : -1}
                        aria-label={label}
                        aria-selected={here || undefined}
                        onClick={() => choose(r, c)}
                      >
                        {cell.n > 0 && (
                          <i className="cw-n" aria-hidden="true">
                            {nf(cell.n)}
                          </i>
                        )}
                        <b className="cw-ch" aria-hidden="true">
                          {ch}
                        </b>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="cw-foot">
            {showKeys && (
              <div className="cw-keys" role="group" aria-label={L('Letras', 'Letters')}>
                {KEY_ROWS.map((row, i) => (
                  <div key={row} className="cw-krow">
                    {[...(i === 1 && alphabet.has('Ñ') ? `${row}Ñ` : row)].map((letter) => (
                      // The cell that is written in keeps the focus: a button of these takes none.
                      <button key={letter} type="button" className="cw-key" tabIndex={-1} onPointerDown={(e) => e.preventDefault()} onClick={() => write(letter)}>
                        {letter}
                      </button>
                    ))}
                    {i === 2 && (
                      <button type="button" className="cw-key cw-del" tabIndex={-1} aria-label={L('Borrar', 'Erase')} onPointerDown={(e) => e.preventDefault()} onClick={() => erase(true)}>
                        <Delete size={18} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="q-actions">
              {done ? (
                <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus>
                  {last ? L('Ver resultado', 'See the result') : L('Siguiente crucigrama', 'Next crossword')}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-sm" onClick={give}>
                    <Lightbulb size={15} aria-hidden="true" />
                    {L('Dar una letra', 'Give a letter')}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={giveUp}>
                    <Eye size={15} aria-hidden="true" />
                    {L('Me rindo', 'I give up')}
                  </button>
                  {!touch && (
                    <button type="button" className="btn btn-sm cw-kb" aria-pressed={keysOn} title={L('Letras en pantalla', 'Letters on the screen')} aria-label={L('Letras en pantalla', 'Letters on the screen')} onClick={() => setKeysOn((on) => !on)}>
                      <Keyboard size={16} aria-hidden="true" />
                    </button>
                  )}
                </>
              )}
              {!(done && last) && (
                <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => setStopped(true)}>
                  <FlagIcon size={15} aria-hidden="true" />
                  {L('Terminar', 'Finish')}
                </button>
              )}
            </div>
          </div>
        </div>
      }
    />
  );
}
