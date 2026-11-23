/**
 * Distances and bearings: the map shows nothing of the two places a question is about. Which way does one
 * lie from the other, among the eight points of the compass? How far apart are they, among four distances?
 * Once answered, both come up on the map with the line between them (see lib/bearings.ts).
 */
import { ArrowRight, Flag as FlagIcon, Navigation, Ruler } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { HALF_WORLD, dealLegs, distanceOptions, judgePoint, pointName, pointOf, pointShort, saidDist, type Point } from '../lib/bearings';
import { seedOf } from '../lib/challenge';
import { spanKm } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { usePaused } from '../lib/pause';
import { useStore } from '../lib/store';
import { cx, mulberry32, nf, shuffle } from '../lib/text';
import { dist, distUnit } from '../lib/units';
import type { LL, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import './bearings.css';

/** The eight points as they lie on a compass, row by row; the middle is where one stands. */
const ROSE: (Point | null)[] = [7, 0, 1, 6, null, 2, 5, 4, 3];
/** The keys of a numeric keypad, which lie the same way: 8 is north and 3 south-east. */
const KEYPAD: Record<string, Point> = { '8': 0, '9': 1, '6': 2, '3': 3, '2': 4, '1': 5, '4': 6, '7': 7 };
const KEY_OF = Object.fromEntries(Object.entries(KEYPAD).map(([key, p]) => [p, key])) as Record<Point, string>;

export function BearingGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  const ask = opts.bearingAsk ?? 'both';
  /** Regions and countries are the land of their map and stay drawn, without borders; cities are left out of it. */
  const land = useMemo(() => deck.items.some((it) => it.kind === 'unit' || it.kind === 'country'), [deck]);
  const game = useMemo(() => {
    const seed = seedOf(cfg);
    const pool = deck.items.filter((it) => !cfg.only || cfg.only.includes(it.id));
    const all = shuffle(pool.map((it) => it.id).sort(), mulberry32(seed));
    const order = typeof opts.length === 'number' && !cfg.only ? all.slice(0, opts.length) : all;
    const rand = mulberry32(seed + 1);
    const span = spanKm(deck.items.map((it) => it.lp));
    // Two places closer than this are hardly apart on that map: six parts in a hundred of what it spans.
    const minKm = Math.max(30, Math.min(1000, span * 0.06));
    const legs = dealLegs(deck.items, order, ask, minKm, rand);
    // No distance on offer is much longer than the longest one on the map.
    const maxKm = Math.min(HALF_WORLD, span * 1.3);
    // The four distances are offered in the unit of the player, as round figures of it.
    return { legs, choices: legs.map((leg) => (leg.ask === 'dist' ? distanceOptions(dist(leg.km), rand, dist(maxKm)) : null)) };
  }, [deck, cfg, opts.length, ask]);
  const { legs } = game;

  const [at, setAt] = useState(0);
  /** What was answered: one of the eight points, or one of the four distances. */
  const [picked, setPicked] = useState<number | null>(null);
  const [results, setResults] = useState<Res[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBestRun] = useState(0);
  const [stopped, setStopped] = useState(false);
  const map = useRef<MapHandle>(null);
  const addSession = useStore((s) => s.addSession);

  const ended = stopped || at >= legs.length;
  const ms = useElapsed(!ended);
  const leg = !ended ? legs[at] : null;
  const from = leg ? deck.byId.get(leg.from)! : null;
  const to = leg ? deck.byId.get(leg.to)! : null;
  const choice = leg ? game.choices[at] : null;
  const done = picked != null ? (results[at] ?? null) : null;
  const several = showsCountry(deck);
  const title = MODE_NAME[cfg.mode];

  const answer = (n: number) => {
    if (!leg || picked != null) return;
    const res: Res = leg.ask === 'dir' ? judgePoint(leg.deg, n as Point) : n === choice!.right ? 'ok' : 'bad';
    setPicked(n);
    setResults((r) => [...r.slice(0, at), res]);
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBestRun((b) => Math.max(b, run));
    // Both ends of the question have to be in sight, wherever the player was looking, and far enough apart
    // on the screen for their two names to be read: some seven pixels a letter, half of each name.
    const letters = deck.byId.get(leg.from)!.name.length + deck.byId.get(leg.to)!.name.length;
    setTimeout(() => map.current?.focus([leg.from, leg.to], { passing: true, apart: 10 + 3.5 * letters }), 30);
  };

  const next = () => {
    setAt((n) => n + 1);
    setPicked(null);
    map.current?.restore();
  };

  // A right answer moves on by itself, once the map has shown it: not while the clock is stopped, with a
  // note half written or the rules open.
  const waiting = usePaused();
  useEffect(() => {
    if (done !== 'ok' || waiting) return;
    const t = setTimeout(next, 2200);
    return () => clearTimeout(t);
  }, [done, at, waiting]);

  useEffect(() => {
    if (!ended || !results.length) return;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: cfg.list ? `${deck.title} · ${cfg.list}` : deck.title,
      total: results.length,
      ok: results.filter((r) => r === 'ok').length,
      warn: results.filter((r) => r === 'warn').length,
      bad: results.filter((r) => r === 'bad').length,
      ms,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (picked != null) {
        if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof Element && e.target.closest('button, a, summary'))) {
          e.preventDefault();
          next();
        }
        return;
      }
      if (!leg) return;
      if (leg.ask === 'dir' && e.key in KEYPAD) answer(KEYPAD[e.key]);
      else if (leg.ask === 'dist' && e.key >= '1' && e.key <= '4') answer(Number(e.key) - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** What may be seen and named: the two ends of a question once it is answered; at the end, everything asked. */
  const shown = useMemo(() => new Set(leg && picked != null ? [leg.from, leg.to] : []), [leg, picked]);
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (ended) legs.forEach((l, i) => results[i] && (p[l.to] = results[i]));
    else if (leg && done) {
      p[leg.from] = 'from';
      p[leg.to] = done;
    }
    return p;
  }, [ended, legs, results, leg, done]);
  const links = useMemo<[LL, LL][] | undefined>(() => (from && to && picked != null ? [[from.lp, to.lp]] : undefined), [from, to, picked]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      blind={land && !ended}
      only={land || ended ? undefined : shown}
      labels={ended ? 'all' : undefined}
      pinned={shown.size ? shown : undefined}
      links={links}
      tip={(id) => (ended || shown.has(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
    const rows: ResultRow[] = legs.slice(0, results.length).map((l, i) => {
      const origin = deck.byId.get(l.from)!.name;
      return {
        item: deck.byId.get(l.to)!,
        res: results[i],
        note: `${l.ask === 'dir' ? pointName(pointOf(l.deg)) : saidDist(l.km)} · ${L('desde', 'from')} ${origin}`,
      };
    });
    const heading = !rows.length ? L('Sin preguntas', 'No questions') : rows.every((r) => r.res === 'ok') ? L('¡Todas bien!', 'All of them right!') : L('Partida terminada', 'Game over');
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={heading}
            note={
              !rows.length
                ? deck.items.length < 2
                  ? L('Hacen falta al menos dos sitios en el mapa.', 'It takes at least two places on the map.')
                  : undefined
                : legs.slice(0, results.length).some((l) => l.ask === 'dir')
                  ? L(
                      'En los rumbos, el punto de al lado cuenta como acierto con ayuda cuando el sitio cae hacia ese lado.',
                      'For bearings, the point beside the right one counts as right with help when the place leans that way.',
                    )
                  : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={[{ label: L('Mejor racha', 'Best streak'), value: best }]}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const last = at + 1 >= legs.length;
  const point = pointOf(leg!.deg);
  const far = saidDist(leg!.km);
  /** Whose each place is, where the map mixes countries. */
  const whose = (it: NonNullable<typeof to>) => (
    <>
      <Flag code={it.country.fl} size="sm" /> {nm(it.country.n)}
    </>
  );
  /** From one to the other, with an arrow that is drawn: the typeface of the texts has none. */
  const way = (
    <>
      {from!.name} <ArrowRight size={14} className="bearing-to" aria-label={L('a', 'to')} /> {to!.name}
    </>
  );

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={at / legs.length}
      hud={<Hud ms={ms} streak={streak} progress={`${at + 1} / ${legs.length}`} />}
      stage={stage}
      panel={
        <div className="q bearing">
          {/* Each name stands by itself, as in the other games: a sentence would need "la", "el" or "las" before many of them. */}
          <div className="q-prompt">
            <p className="kicker">{leg!.ask === 'dir' ? L('¿Hacia dónde queda?', 'Which way is it?') : L('¿A qué distancia está?', 'How far is it?')}</p>
            <h2 className="q-name">{to!.name}</h2>
            {several && <p className="q-sub">{whose(to!)}</p>}
            <p className="bearing-from">
              <span>{L('Desde', 'From')}</span> <b>{from!.name}</b>
              {several && <small>{whose(from!)}</small>}
            </p>
          </div>
          {/* Kept once answered: the buttons under it must not move away from the pointer. */}
          {(land || leg!.ask === 'dist') && (
            <p className="q-how">
              {leg!.ask === 'dir' ? <Navigation size={15} aria-hidden="true" /> : <Ruler size={15} aria-hidden="true" />}{' '}
              {leg!.ask === 'dir' ? L('De centro a centro.', 'From centre to centre.') : land ? L('En línea recta, de centro a centro.', 'As the crow flies, from centre to centre.') : L('En línea recta.', 'As the crow flies.')}
            </p>
          )}

          {leg!.ask === 'dir' ? (
            <div className="rose" role="group" aria-label={L('Los ocho rumbos', 'The eight bearings')}>
              {ROSE.map((p) =>
                p == null ? (
                  <span key="mid" className="rose-mid" aria-hidden="true">
                    <small>{L('desde', 'from')}</small>
                    <b>{from!.name}</b>
                  </span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={cx('rose-btn', picked != null && p === point && 'right', picked === p && done === 'warn' && 'near', picked === p && done === 'bad' && 'wrong')}
                    disabled={picked != null}
                    aria-label={pointName(p)}
                    title={pointName(p)}
                    onClick={() => answer(p)}
                  >
                    <kbd aria-hidden="true">{KEY_OF[p]}</kbd>
                    <b>{pointShort(p)}</b>
                    <small>{pointName(p)}</small>
                  </button>
                ),
              )}
            </div>
          ) : (
            <div className="choices bearing-km">
              {choice!.options.map((n, i) => (
                <button key={i} type="button" className={cx('choice', picked != null && i === choice!.right && 'right', picked === i && i !== choice!.right && 'wrong')} disabled={picked != null} onClick={() => answer(i)}>
                  <kbd>{i + 1}</kbd>
                  <span>
                    {nf(n)} {distUnit()}
                  </span>
                </button>
              ))}
            </div>
          )}

          {done && (
            <Verdict
              res={done}
              item={to}
              wiki={opts.wiki}
              title={
                leg!.ask === 'dir' ? (
                  <>
                    {done === 'ok' ? L('¡Eso es! Al', 'That is it! To the') : done === 'warn' ? L('Casi: queda al', 'Close: it lies to the') : L('Queda al', 'It lies to the')} <b>{pointName(point)}</b>
                  </>
                ) : (
                  <>
                    {done === 'ok' ? L('¡Eso es!', 'That is it!') : L('Son', 'It is')} <b>{far}</b>
                  </>
                )
              }
              lead={
                <p className="facts bearing-line">
                  {/* Two lines, in fact: the course is the one a map shows, the distance that of the shortest way. */}
                  {way}: {L(`al ${pointName(point)} (${Math.round(leg!.deg)}°), a unos ${far} en línea recta.`, `to the ${pointName(point)} (${Math.round(leg!.deg)}°), about ${far} as the crow flies.`)}
                </p>
              }
            />
          )}
          <div className="q-actions">
            {picked != null && (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus={done !== 'ok'}>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
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
