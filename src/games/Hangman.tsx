/**
 * «Ahorcado»: the name of a piece of the map is hidden and the player tries letters, with the buttons or
 * with the keyboard. Each letter that is not in the name puts out a point of the compass rose, and with
 * the eighth the name is lost. The map says nothing until it is asked to, or until the round is over.
 * The rules are in lib/hangman.ts. A game in a file of its own, fetched when it is played.
 */
import { ArrowRight, Eye, Flag as FlagIcon, MapPinned } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { seedOf } from '../lib/challenge';
import { HANG_MISSES, hangOrder, hangPool, hangRes, keyLetter, lettersOf, partsOf, spokenOf, standing, tryLetter, widestOf, wordsOf } from '../lib/hangman';
import { L, getLang } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { cx, nf } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, answered, useElapsed, type GameProps, type ResultRow } from './common';
import './hangman.css';

/** The points of the rose, clockwise from the north; the ones between the four main ones are shorter. */
const POINTS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
  const at = (deg: number, r: number): string => {
    const a = (deg * Math.PI) / 180;
    return `${(r * Math.sin(a)).toFixed(1)} ${(-r * Math.cos(a)).toFixed(1)}`;
  };
  const deg = i * 45;
  const tip = at(deg, i % 2 ? 31 : 46);
  return { i, dark: `M0 0L${at(deg - 45, 11)}L${tip}Z`, light: `M0 0L${at(deg + 45, 11)}L${tip}Z` };
});
/** The order they are drawn in: the short ones under the long ones. */
const DRAWN = [...POINTS.filter((p) => p.i % 2), ...POINTS.filter((p) => !(p.i % 2))];

/**
 * The compass rose: it starts with its eight points lit, and each letter that is not in the name puts one
 * out, from the north-west round to the north, which is the last one to be lost.
 */
function Rose({ out }: { out: number }) {
  return (
    <svg className="hang-rose" viewBox="-50 -50 100 100" aria-hidden="true">
      <circle className="hang-ring" r="47.5" />
      {DRAWN.map((p) => (
        <g key={p.i} className={cx('hang-pt', p.i === 0 && 'north', (p.i === 0 ? out >= HANG_MISSES : p.i >= HANG_MISSES - out) && 'out')}>
          <path className="dark" d={p.dark} />
          <path className="light" d={p.light} />
        </g>
      ))}
      <circle className="hang-hub" r="3.2" />
    </svg>
  );
}

interface Played {
  id: string;
  res: Res;
  /** Letters tried that were not in the name. */
  misses: number;
  hinted: boolean;
}

export function HangmanGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const lang = getLang();
  const seed = seedOf(cfg);
  const order = useMemo(
    () =>
      hangOrder(
        hangPool(deck.items, cfg.only, lang).map((it) => it.id),
        cfg.opts.length,
        seed,
        !!cfg.only,
      ),
    [deck, cfg.only, cfg.opts.length, seed, lang],
  );
  const letters = useMemo(() => lettersOf(lang), [lang]);

  const [at, setAt] = useState(0);
  const [tried, setTried] = useState<string[]>([]);
  /** The map has been asked to show the piece. */
  const [hinted, setHinted] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const [results, setResults] = useState<Played[]>([]);
  /** What the last letter did, said under the letters. */
  const [said, setSaid] = useState<{ text: string; bad: boolean } | null>(null);
  /** The letter tried last, when it was in the name: its cells come up with a little jump. */
  const [fresh, setFresh] = useState('');
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [stopped, setStopped] = useState(false);
  const map = useRef<MapHandle>(null);
  const keys = useRef<HTMLDivElement>(null);
  const addSession = useStore((s) => s.addSession);

  const ended = stopped || at >= order.length;
  const ms = useElapsed(!ended);
  const item = !ended ? deck.byId.get(order[at])! : null;
  const state = useMemo(() => (item ? standing(item.name, tried, lang) : null), [item, tried, lang]);
  const words = useMemo(() => (item ? wordsOf(item.name, lang) : []), [item, lang]);
  /** How the round in hand was settled; null while it is open. */
  const done: Res | null = !state ? null : state.solved ? hangRes(true, hinted) : state.lost || gaveUp ? 'bad' : null;
  const title = MODE_NAME.hangman;
  const what = cfg.list ? `${deck.title} · ${cfg.list}` : deck.title;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = item?.id;

  // Each name starts on the whole map: where the last one was says nothing about this one.
  useEffect(() => {
    if (!item) return;
    map.current?.reset();
    // The button that brought the name here is gone: the letters take the focus it had, so that the keyboard
    // goes on from them. Not on the first name, which nobody pressed a button for.
    if (at > 0) keys.current?.focus({ preventScroll: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  // The piece is brought into view when the map shows it: once it is asked for, and when the round is over.
  const lit = !!item && (hinted || done != null);
  useEffect(() => {
    if (item && lit) map.current?.focus([item.id], { fill: 0.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lit]);

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

  /** The round in hand is over, and this is how. */
  const settle = (res: Res, misses: number) => {
    if (!item) return;
    setResults((r) => [...r, { id: item.id, res, misses, hinted }]);
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBest((b) => Math.max(b, run));
  };

  const guess = (letter: string) => {
    if (!item || done) return;
    const next = tryLetter(item.name, tried, letter, lang);
    if (!next) return;
    const after = standing(item.name, next.tried, lang);
    setTried(next.tried);
    setFresh(next.found ? letter : '');
    const missed = after.misses.length;
    if (next.found) {
      setSaid({
        text: L(`La ${letter} está${next.found === 1 ? '' : ` ${nf(next.found)} veces`}.`, `${letter} is in the name${next.found === 1 ? '' : ` ${nf(next.found)} times`}.`),
        bad: false,
      });
    } else {
      setSaid({
        text:
          missed === HANG_MISSES - 1
            ? L(`No hay ninguna ${letter}. Un fallo más y pierdes el norte.`, `There is no ${letter}. One more miss and you lose your bearings.`)
            : L(`No hay ninguna ${letter}.`, `There is no ${letter}.`),
        bad: true,
      });
    }
    if (after.solved) settle(hangRes(true, hinted), missed);
    else if (after.lost) settle('bad', missed);
    // A letter that is not there is heard, while the round goes on: its end has a sound of its own.
    else if (!next.found) answered('try');
  };

  const hint = () => {
    if (!item || done || hinted) return;
    setHinted(true);
    setSaid({ text: L('Mira el mapa: ahí está. Ya no cuenta como a la primera.', 'Look at the map: there it is. It no longer counts as first time.'), bad: false });
    // The button can be pressed once: the letters take the focus it had.
    keys.current?.focus({ preventScroll: true });
  };

  const giveUp = () => {
    if (!item || done || !state) return;
    setGaveUp(true);
    settle('bad', state.misses.length);
  };

  const next = () => {
    setAt((n) => n + 1);
    setTried([]);
    setHinted(false);
    setGaveUp(false);
    setSaid(null);
    setFresh('');
  };

  const last = at + 1 >= order.length;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      const on = e.target instanceof Element ? e.target : null;
      // Not while something is being typed somewhere, nor under a panel that is open over the game.
      if (on?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]') || document.querySelector('dialog[open]')) return;
      if (done) {
        if ((e.key === 'Enter' || e.key === ' ') && !on?.closest('button, a, summary, [role="application"]')) {
          e.preventDefault();
          if (last) setStopped(true);
          else next();
        }
        return;
      }
      const letter = keyLetter(e.key, lang);
      if (!letter) return;
      e.preventDefault();
      guess(letter);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const settled = useMemo(() => new Map(results.map((r) => [r.id, r.res])), [results]);
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const [id, res] of settled) p[id] = res;
    if (item && done) p[item.id] = done;
    else if (item && hinted) p[item.id] = 'target';
    return p;
  }, [settled, item, done, hinted]);
  const pinned = useMemo(() => new Set(item && done ? [item.id] : []), [item, done]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      labels={ended ? 'all' : undefined}
      pinned={pinned}
      // No names while there is one to guess, but those of the pieces that have been played.
      tip={(id) => (ended || settled.has(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
    const rows: ResultRow[] = results.map((r) => {
      const missed = r.misses ? L(`${nf(r.misses)} ${r.misses === 1 ? 'letra fallada' : 'letras falladas'}`, `${nf(r.misses)} wrong ${r.misses === 1 ? 'letter' : 'letters'}`) : L('sin fallar una letra', 'no wrong letters');
      return {
        item: deck.byId.get(r.id)!,
        res: r.res,
        note: r.res === 'bad' ? L('sin adivinar', 'not guessed') : r.res === 'warn' ? `${L('con el mapa', 'with the map')} · ${missed}` : missed,
      };
    });
    const wrong = results.reduce((a, r) => a + r.misses, 0);
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={!rows.length ? L('Sin nombres', 'No names') : rows.every((r) => r.res === 'ok') ? L('¡Ni una se te resiste!', 'Not one got past you!') : L('Partida terminada', 'Game over')}
            note={
              !order.length
                ? L('En este mapa no hay ningún nombre con letras que adivinar.', 'No name on this map has letters to guess.')
                : rows.length
                  ? L(
                      'A la primera: el nombre adivinado solo con las letras. Con ayuda: después de pedir el mapa. Las letras falladas no restan.',
                      'First time: the name guessed with the letters alone. With help: after asking for the map. Wrong letters take nothing off.',
                    )
                  : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={
              rows.length
                ? [
                    { label: L('Letras falladas', 'Wrong letters'), value: nf(wrong) },
                    { label: L('Mejor racha', 'Best streak'), value: best },
                  ]
                : undefined
            }
            again={order.length > 0}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const it = item!;
  const st = state!;
  const noun = (it.kind === 'feature' && it.type) || deck.noun.one;
  const missed = st.misses.length;
  /** The name is written as large as its longest stretch leaves room for (hangman.css). */
  const room = { '--n': widestOf(words) } as CSSProperties;
  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={at / order.length}
      hud={<Hud ms={ms} streak={streak} progress={`${at + 1} / ${order.length}`} />}
      stage={stage}
      panel={
        <div className="q hang">
          <div className="hang-top">
            <Rose out={missed} />
            <div className="q-prompt">
              <p className="kicker">{L(`¿Qué ${noun} es?`, `Which ${noun} is it?`)}</p>
              <p className={cx('hang-count', missed >= HANG_MISSES - 1 && 'low')}>
                {L('Fallos', 'Misses')}: <b>{nf(missed)}</b> {L('de', 'of')} {nf(HANG_MISSES)}
              </p>
            </div>
          </div>
          <p className="hang-word" style={room} role="img" aria-label={`${L('El nombre', 'The name')}: ${done ? it.name : spokenOf(it.name, tried, lang, L('hueco', 'blank'))}`}>
            {words.map((word, i) => (
              <span key={i} className="hang-w">
                {partsOf(word).map((part, k) => (
                  <span key={k} className="hang-p">
                    {part.map((c, j) => {
                      const found = !c.letter || st.hits.includes(c.letter);
                      return (
                        <span key={j} className={cx('hang-c', !c.letter && 'fixed', !found && (done ? 'late' : 'shut'), !!c.letter && c.letter === fresh && 'fresh')}>
                          {found || done ? c.ch : '\u00a0'}
                        </span>
                      );
                    })}
                  </span>
                ))}
              </span>
            ))}
          </p>
          {!done && (
            <>
              <div className="hang-keys" role="group" aria-label={L('Letras', 'Letters')} tabIndex={-1} ref={keys}>
                {letters.map((letter) => {
                  const hit = st.hits.includes(letter);
                  const miss = st.misses.includes(letter);
                  return (
                    <button
                      key={letter}
                      type="button"
                      className={cx('hang-key', hit && 'hit', miss && 'miss')}
                      // Not `disabled`: a letter that has just been tried would drop the focus of whoever plays with the Tab key.
                      aria-disabled={hit || miss}
                      aria-label={hit ? L(`${letter}: está`, `${letter}: it is there`) : miss ? L(`${letter}: no está`, `${letter}: not there`) : undefined}
                      onClick={() => guess(letter)}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
              <p className={cx('q-note', said?.bad && 'hang-no')} role="status">
                <span className="hang-said">
                  {said?.text ?? (
                    <>
                      {L('Prueba una letra.', 'Try a letter.')}
                      <span className="hang-desk"> {L('También vale el teclado.', 'The keyboard works too.')}</span>
                    </>
                  )}
                </span>
                {/* For whoever hears the game instead of seeing it: how the count and the name stand after that letter. */}
                {said && tried.length > 0 && (
                  <span className="sr-only">
                    {' '}
                    {L(`Fallos: ${nf(missed)} de ${nf(HANG_MISSES)}.`, `Misses: ${nf(missed)} of ${nf(HANG_MISSES)}.`)} {spokenOf(it.name, tried, lang, L('hueco', 'blank'))}.
                  </span>
                )}
              </p>
            </>
          )}
          {done && (
            <Verdict
              res={done}
              item={it}
              wiki={cfg.opts.wiki}
              title={
                <>
                  {done === 'bad' ? L('Era', 'It was') : L('¡Eso es!', 'That is it!')} <b>{it.name}</b>
                </>
              }
              lead={
                <p className="facts hang-how">
                  {done === 'bad'
                    ? st.lost
                      ? L('Has perdido el norte: ocho letras que no estaban.', 'You have lost your bearings: eight letters that were not there.')
                      : L('Te has rendido.', 'You gave up.')
                    : `${missed ? L(`Con ${nf(missed)} ${missed === 1 ? 'letra fallada' : 'letras falladas'}`, `With ${nf(missed)} wrong ${missed === 1 ? 'letter' : 'letters'}`) : L('Sin fallar una letra', 'With no wrong letters')}${hinted ? L(', y con el mapa', ', and with the map') : ''}.`}
                </p>
              }
            />
          )}
          <div className="q-actions">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={hint} disabled={hinted}>
                  <MapPinned size={15} aria-hidden="true" />
                  {L('Ver en el mapa', 'Show on the map')}
                </button>
                <button type="button" className="btn btn-sm" onClick={giveUp}>
                  <Eye size={15} aria-hidden="true" />
                  {L('Me rindo', 'I give up')}
                </button>
              </>
            )}
            <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => setStopped(true)}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </div>
      }
    />
  );
}
