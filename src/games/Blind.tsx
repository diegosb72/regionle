/**
 * Placing blind: the map shows no dots. The player clicks where a city is and the answer is judged by
 * how many kilometres off it falls.
 */
import { ArrowRight, Crosshair, Flag as FlagIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { distanceKm, tolerances } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { mulberry32, nf, shuffle } from '../lib/text';
import type { Item, LL, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';

export function BlindGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  const pool = useMemo(() => deck.items.filter((it) => !cfg.only || cfg.only.includes(it.id)), [deck, cfg.only]);
  const order = useMemo(() => {
    const list = shuffle(pool.map((it) => it.id).sort(), mulberry32(seedOf(cfg)));
    return typeof opts.length === 'number' && !cfg.only ? list.slice(0, opts.length) : list;
  }, [pool, cfg, opts.length]);
  const limit = useMemo(() => tolerances(deck.items.map((it) => it.lp)), [deck]);

  const [at, setAt] = useState(0);
  const [guess, setGuess] = useState<LL | null>(null);
  const [done, setDone] = useState<Res | null>(null);
  const [results, setResults] = useState<Record<string, { res: Res; km: number | null }>>({});
  const [streak, setStreak] = useState(0);
  const [best, setBestRun] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [mark, setMark] = useState<'new' | number | null>(null);
  const map = useRef<MapHandle>(null);
  const record = useStore((s) => s.record);
  const addSession = useStore((s) => s.addSession);
  const setBest = useStore((s) => s.setBest);
  const bump = useStore((s) => s.bump);

  const ended = stopped || at >= order.length;
  const ms = useElapsed(!ended);
  const item = !ended ? deck.byId.get(order[at])! : null;
  const several = showsCountry(deck);
  const title = MODE_NAME.blind;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = item?.id;

  const settle = (it: Item, where: LL | null) => {
    const km = where ? distanceKm(where, it.lp) : null;
    const res: Res = km == null ? 'bad' : km <= limit.ok ? 'ok' : km <= limit.warn ? 'warn' : 'bad';
    setGuess(where);
    setDone(res);
    setResults((r) => ({ ...r, [it.id]: { res, km } }));
    record('loc', it.id, res, originOf(it, cfg));
    if (km != null && km <= 10) bump({ near: 1 });
    setFlash({ id: it.id, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBestRun((b) => Math.max(b, run));
    // The answer has to be in sight, wherever the player was looking.
    setTimeout(() => map.current?.focus([it.id], { passing: true }), 30);
  };

  const next = () => {
    setAt((n) => n + 1);
    setGuess(null);
    setDone(null);
    // Back to the view the player had: the next city may be at the other end of the map.
    map.current?.restore();
  };

  // A bull's-eye moves on by itself.
  useEffect(() => {
    if (done !== 'ok') return;
    const t = setTimeout(next, 1300);
    return () => clearTimeout(t);
  }, [done, at]);

  useEffect(() => {
    if (!ended) return;
    const list = Object.values(results);
    if (!list.length) return;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: cfg.list ? `${deck.title} · ${cfg.list}` : deck.title,
      total: list.length,
      ok: list.filter((r) => r.res === 'ok').length,
      warn: list.filter((r) => r.res === 'warn').length,
      bad: list.filter((r) => r.res === 'bad').length,
      ms,
    });
    // The record is the mean error of a whole game with every city placed.
    if (!cfg.only && list.length === order.length && list.every((r) => r.km != null)) {
      const mean = Math.round(list.reduce((n, r) => n + r.km!, 0) / list.length);
      const key = `blind:${deck.key}|${order.length}`;
      const prev = useStore.getState().best[key];
      setMark(setBest(key, mean, true) ? 'new' : (prev ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea, summary')) return;
      if ((e.key === 'Enter' || e.key === ' ') && done && !ended) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Dots on the map: the cities already placed and, once answered, the one in hand. */
  const dots = useMemo(() => {
    if (ended) return undefined;
    const set = new Set(Object.keys(results));
    if (item && done) set.add(item.id);
    return set;
  }, [ended, results, item, done]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const [id, r] of Object.entries(results)) p[id] = r.res;
    if (item && done === 'bad') p[item.id] = 'target';
    return p;
  }, [results, item, done]);

  const labels = useMemo(() => (ended ? ('all' as const) : opts.labels ? new Set(Object.keys(results)) : undefined), [ended, opts.labels, results]);
  const pinned = useMemo(() => (item && done ? new Set([item.id]) : undefined), [item, done]);
  const marks = useMemo(() => (guess && !ended ? [{ ll: guess, kind: 'guess' as const }] : undefined), [guess, ended]);
  const links = useMemo<[LL, LL][] | undefined>(() => (guess && item && done && !ended ? [[guess, item.lp]] : undefined), [guess, item, done, ended]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      dots={dots}
      labels={labels}
      pinned={pinned}
      marks={marks}
      links={links}
      flash={flash}
      onPoint={item && !done ? (ll) => settle(item, ll) : undefined}
      tip={(id) => deck.byId.get(id)?.name}
    />
  );

  if (ended) {
    const rows: ResultRow[] = Object.entries(results).map(([id, r]) => ({ item: deck.byId.get(id)!, res: r.res, note: r.km == null ? L('sin situar', 'not placed') : `${nf(Math.round(r.km))} km` }));
    const placed = Object.values(results).filter((r) => r.km != null);
    const mean = placed.length ? Math.round(placed.reduce((n, r) => n + r.km!, 0) / placed.length) : null;
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={rows.length ? (mean != null ? L(`Error medio: ${nf(mean)} km`, `Mean error: ${nf(mean)} km`) : L('Partida terminada', 'Game over')) : L('Sin preguntas', 'No questions')}
            note={
              !rows.length
                ? undefined
                : mark === 'new'
                  ? L('Nuevo récord en este mapa.', 'New record on this map.')
                  : typeof mark === 'number'
                    ? L(`Tu récord en este mapa: ${nf(mark)} km de error medio.`, `Your record on this map: a mean error of ${nf(mark)} km.`)
                    : L(`A la primera: a menos de ${nf(limit.ok)} km. Con ayuda: a menos de ${nf(limit.warn)} km.`, `First time: within ${nf(limit.ok)} km. With help: within ${nf(limit.warn)} km.`)
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

  const km = item && done ? results[item.id]?.km : null;
  const last = at + 1 >= order.length;
  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={at / order.length}
      hud={<Hud ms={ms} streak={streak} progress={`${at + 1} / ${order.length}`} />}
      stage={stage}
      panel={
        <div className="q">
          <div className="q-prompt">
            <p className="kicker">{L('Sitúa en el mapa', 'Place it on the map')}</p>
            <h2 className="q-name">{item!.name}</h2>
            {several && (
              <p className="q-sub">
                <Flag code={item!.country.fl} size="sm" /> {nm(item!.country.n)}
              </p>
            )}
          </div>
          {!done && (
            <p className="q-how">
              <Crosshair size={15} aria-hidden="true" />{' '}
              {L(
                `Haz clic donde creas que está. Cuenta como acierto a menos de ${nf(limit.ok)} km. Puedes acercar el mapa para afinar.`,
                `Click where you think it is. Within ${nf(limit.ok)} km counts as right. You can zoom in to be more precise.`,
              )}
            </p>
          )}
          {done && (
            <Verdict
              res={done}
              item={item}
              wiki={opts.wiki}
              title={
                km == null ? (
                  <>
                    {L('Estaba aquí:', 'It was here:')} <b>{item!.name}</b>
                  </>
                ) : (
                  <>
                    {done === 'ok' ? L('¡En el sitio!', 'Spot on!') : done === 'warn' ? L('Cerca:', 'Close:') : L('Lejos:', 'Far off:')} <b>{L(`a ${nf(Math.round(km))} km`, `${nf(Math.round(km))} km away`)}</b>
                  </>
                )
              }
            />
          )}
          <div className="q-actions">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus={done !== 'ok'}>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => settle(item!, null)}>
                {L('No lo sé', "I don't know")}
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
