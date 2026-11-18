/**
 * Placing blind: the map shows nothing of what is asked. The player clicks where a city, a region, a
 * country or a river is, and the answer is judged by how far off it falls (see lib/blind.ts).
 *
 * "Hot and cold" is the same game with several clicks: each miss says how warm it was, and whether it
 * was nearer than the one before, until the thing is found or the clicks run out.
 */
import { ArrowRight, Crosshair, Flag as FlagIcon, Thermometer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type MarkKind, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { HOT_TRIES, heatOf, hotResult, judge, kmOff, marksFor, partAt, trendOf, type Heat } from '../lib/blind';
import { seedOf } from '../lib/challenge';
import { tolerances } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { cx, mulberry32, nf, shuffle } from '../lib/text';
import type { Item, LL, Part, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import './blind.css';

/** One click of a search: where it fell, how far off and how warm that is. */
interface Click {
  ll: LL;
  km: number;
  heat: Heat;
}

/** How one thing went: `km` is how far the click (the best one, in a search) fell; null when none was made. */
interface Outcome {
  res: Res;
  km: number | null;
  clicks: number;
}

const heatName = (heat: Heat): string =>
  [L('Helado', 'Freezing'), L('Frío', 'Cold'), L('Templado', 'Warm'), L('Caliente', 'Hot'), L('¡Te quemas!', 'Burning!')][heat];

export function BlindGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  /** Hot and cold: several clicks for each thing, with a word on how warm each was. */
  const hot = cfg.mode === 'hotcold';
  const pool = useMemo(() => deck.items.filter((it) => !cfg.only || cfg.only.includes(it.id)), [deck, cfg.only]);
  const order = useMemo(() => {
    const list = shuffle(pool.map((it) => it.id).sort(), mulberry32(seedOf(cfg)));
    return typeof opts.length === 'number' && !cfg.only ? list.slice(0, opts.length) : list;
  }, [pool, cfg, opts.length]);
  /**
   * Regions and countries are the land of their map: they stay drawn, without the borders between them.
   * Cities, rivers and seas lie on a map of their own and are simply left out until they are answered.
   */
  const land = useMemo(() => deck.items.some((it) => it.kind === 'unit' || it.kind === 'country'), [deck]);
  /** A map of dots alone: cities, or peaks. */
  const dotsOnly = useMemo(() => deck.items.every((it) => it.shape === 'point'), [deck]);
  /**
   * How close counts, by the size of the map. Among dots, that is how far apart they lie. A surface is
   * named somewhere in its middle, which for a sea can be far out of the map: there, what the map frames.
   */
  const limit = useMemo(() => tolerances(dotsOnly || deck.frame.length < 2 ? deck.items.map((it) => it.lp) : deck.frame), [deck, dotsOnly]);

  const [at, setAt] = useState(0);
  const [clicks, setClicks] = useState<Click[]>([]);
  const [done, setDone] = useState<Res | null>(null);
  /** The sea inside the one asked that the click fell in: the Balearic Sea, when it was the Mediterranean. */
  const [via, setVia] = useState<Part | null>(null);
  const [results, setResults] = useState<Record<string, Outcome>>({});
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
  const marks = useMemo(() => (item ? marksFor(item, limit) : null), [item, limit]);
  const several = showsCountry(deck);
  const title = MODE_NAME[cfg.mode];
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = item?.id;

  /** The thing in hand is settled: right, nearly right or wrong. */
  const settle = (it: Item, res: Res, km: number | null, n: number) => {
    setDone(res);
    setResults((r) => ({ ...r, [it.id]: { res, km, clicks: n } }));
    record('loc', it.id, res, originOf(it, cfg));
    if (it.kind === 'city' && km != null && km <= 10) bump({ near: 1 });
    setFlash({ id: it.id, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBestRun((b) => Math.max(b, run));
    // The answer has to be in sight, wherever the player was looking.
    setTimeout(() => map.current?.focus([it.id], { passing: true }), 30);
  };

  /** A click on the map: the answer, or one more try of a search. */
  const point = (it: Item, where: LL) => {
    const m = marksFor(it, limit);
    const km = kmOff(it, where);
    const all = [...clicks, { ll: where, km, heat: heatOf(km, limit) }];
    setClicks(all);
    setVia(km === 0 ? partAt(it, where) : null);
    if (!hot) return settle(it, judge(km, m), km, 1);
    const found = km <= m.ok;
    if (found || all.length >= HOT_TRIES) settle(it, hotResult(found, all.length), Math.min(...all.map((c) => c.km)), all.length);
  };

  const giveUp = (it: Item) => settle(it, 'bad', clicks.length ? Math.min(...clicks.map((c) => c.km)) : null, clicks.length);

  const next = () => {
    setAt((n) => n + 1);
    setClicks([]);
    setDone(null);
    setVia(null);
    // Back to the view the player had: the next one may be at the other end of the map.
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
    // The record is the mean error of a whole game with everything placed. A search has no error to speak of.
    if (!hot && !cfg.only && list.length === order.length && list.every((r) => r.km != null)) {
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

  /** What has been answered, and the thing in hand once it is: all that may be seen and named. */
  const known = useMemo(() => {
    const set = new Set(Object.keys(results));
    if (item && done) set.add(item.id);
    return set;
  }, [results, item, done]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const [id, r] of Object.entries(results)) p[id] = r.res;
    if (item && done === 'bad') p[item.id] = 'target';
    return p;
  }, [results, item, done]);

  const labels = useMemo(() => (ended ? ('all' as const) : opts.labels ? new Set(Object.keys(results)) : undefined), [ended, opts.labels, results]);
  const pinned = useMemo(() => (item && done ? new Set([item.id]) : undefined), [item, done]);
  const pins = useMemo(() => {
    if (ended || !clicks.length) return undefined;
    // In a search every click stays, coloured by how warm it was; the one that found it is a plain cross.
    return clicks.map((c, i) => ({ ll: c.ll, kind: (hot && !(done && done !== 'bad' && i === clicks.length - 1) ? `heat-${c.heat}` : 'guess') as MarkKind }));
  }, [clicks, ended, hot, done]);
  // The line from the click to a dot. A surface or a river is measured to its nearest edge, which the eye finds by itself.
  const links = useMemo<[LL, LL][] | undefined>(
    () => (!hot && clicks.length && item && done && !ended && item.shape === 'point' ? [[clicks[0].ll, item.lp]] : undefined),
    [hot, clicks, item, done, ended],
  );

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      blind={land && !ended}
      only={land || ended ? undefined : known}
      labels={labels}
      pinned={pinned}
      marks={pins}
      links={links}
      flash={flash}
      onPoint={item && !done ? (ll) => point(item, ll) : undefined}
      tip={(id) => (ended || known.has(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
    const rows: ResultRow[] = Object.entries(results).map(([id, r]) => {
      const it = deck.byId.get(id)!;
      const note = hot
        ? r.res === 'bad'
          ? L('sin encontrar', 'not found')
          : r.clicks <= 1
            ? L('a la primera', 'first click')
            : L(`en ${r.clicks} intentos`, `in ${r.clicks} clicks`)
        : r.km == null
          ? L('sin situar', 'not placed')
          : r.km === 0 && it.shape === 'area'
            ? L('dentro', 'inside')
            : `${nf(Math.round(r.km))} km`;
      return { item: it, res: r.res, note };
    });
    const placed = Object.values(results).filter((r) => r.km != null);
    const mean = placed.length ? Math.round(placed.reduce((n, r) => n + r.km!, 0) / placed.length) : null;
    const found = rows.filter((r) => r.res !== 'bad').length;
    const heading = !rows.length
      ? L('Sin preguntas', 'No questions')
      : hot
        ? L(`Has encontrado ${found} de ${rows.length}`, `You found ${found} of ${rows.length}`)
        : mean != null
          ? L(`Error medio: ${nf(mean)} km`, `Mean error: ${nf(mean)} km`)
          : L('Partida terminada', 'Game over');
    const rule = hot
      ? L(`Encontrar algo con el primer clic cuenta como acierto; con más clics, como acierto con ayuda. Hay ${HOT_TRIES} para cada cosa.`, `Finding something with the first click counts as right; with more clicks, as right with help. There are ${HOT_TRIES} for each thing.`)
      : dotsOnly
        ? L(`A la primera: a menos de ${nf(limit.ok)} km. Con ayuda: a menos de ${nf(limit.warn)} km.`, `First time: within ${nf(limit.ok)} km. With help: within ${nf(limit.warn)} km.`)
        : L(
            `Cuenta como acierto un clic dentro de la pieza. Un río, o algo demasiado pequeño para acertarle en este mapa, a menos de ${nf(Math.max(5, Math.round(limit.ok / 3)))} km.`,
            `A click inside the piece counts as right. A river, or something too small to hit on this map, within ${nf(Math.max(5, Math.round(limit.ok / 3)))} km.`,
          );
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
                ? undefined
                : mark === 'new'
                  ? L('Nuevo récord en este mapa.', 'New record on this map.')
                  : typeof mark === 'number'
                    ? L(`Tu récord en este mapa: ${nf(mark)} km de error medio.`, `Your record on this map: a mean error of ${nf(mark)} km.`)
                    : rule
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

  const out = item && done ? results[item.id] : null;
  const km = out?.km ?? null;
  const last = at + 1 >= order.length;
  const left = HOT_TRIES - clicks.length;
  const lastClick = clicks[clicks.length - 1];
  const trend = lastClick ? trendOf(lastClick.km, clicks[clicks.length - 2]?.km) : 0;
  /** How far, said for what the thing is: a dot is "N km away", a surface "N km from its edge". */
  const away = (n: number): string => {
    const d = nf(Math.round(n));
    if (item!.shape === 'area') return L(`a ${d} km de su borde`, `${d} km from its edge`);
    if (item!.shape === 'line') return L(`a ${d} km de su curso`, `${d} km from its course`);
    return L(`a ${d} km`, `${d} km away`);
  };
  /**
   * A click inside a sea that is part of the one asked is right, and worth a word. The part is named unless
   * this game still has to ask where it is.
   */
  const aside =
    !via || !done || done === 'bad' ? null : order.includes(via.id) && !results[via.id] ? (
      <p className="facts verdict-part">{L('Esa parte tiene además nombre propio.', 'That part also has a name of its own.')}</p>
    ) : (
      <p className="facts verdict-part">
        {L('Esa parte tiene nombre propio:', 'That part has a name of its own:')} <b>{via.name}</b>.
      </p>
    );
  const how = !marks
    ? ''
    : hot
      ? L(
          `Haz clic donde creas que está. Si no aciertas, te decimos si vas caliente o frío. Tienes ${HOT_TRIES} intentos.`,
          `Click where you think it is. If you miss, you are told whether you are hot or cold. You have ${HOT_TRIES} tries.`,
        )
      : item!.shape === 'point'
        ? L(
            `Haz clic donde creas que está. Cuenta como acierto a menos de ${nf(marks.ok)} km. Puedes acercar el mapa para afinar.`,
            `Click where you think it is. Within ${nf(marks.ok)} km counts as right. You can zoom in to be more precise.`,
          )
        : item!.shape === 'line'
          ? L(
              `Haz clic sobre su curso. Cuenta como acierto a menos de ${nf(marks.ok)} km. Puedes acercar el mapa para afinar.`,
              `Click on its course. Within ${nf(marks.ok)} km counts as right. You can zoom in to be more precise.`,
            )
          : marks.ok > 0
            ? L(
                `Haz clic donde creas que está. Ocupa tan poco en este mapa que cuenta como acierto a menos de ${nf(marks.ok)} km.`,
                `Click where you think it is. It takes up so little of this map that within ${nf(marks.ok)} km counts as right.`,
              )
            : L('Haz clic dentro de donde creas que está. Puedes acercar el mapa para afinar.', 'Click inside where you think it is. You can zoom in to be more precise.');

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
            <p className="kicker">{hot ? L('Busca en el mapa', 'Find it on the map') : L('Sitúa en el mapa', 'Place it on the map')}</p>
            <h2 className="q-name">{item!.name}</h2>
            {several && (
              <p className="q-sub">
                <Flag code={item!.country.fl} size="sm" /> {nm(item!.country.n)}
              </p>
            )}
          </div>
          {!done && !lastClick && (
            <p className="q-how">
              {hot ? <Thermometer size={15} aria-hidden="true" /> : <Crosshair size={15} aria-hidden="true" />} {how}
            </p>
          )}
          {!done && hot && lastClick && (
            <div className={cx('heat', `heat-${lastClick.heat}`)} role="status">
              <p className="heat-now">
                <Thermometer size={18} aria-hidden="true" />
                <b>{heatName(lastClick.heat)}</b>
                {trend !== 0 && <span>{trend > 0 ? L('más cerca que antes', 'closer than before') : L('más lejos que antes', 'farther than before')}</span>}
              </p>
              <ol className="heat-trail" aria-label={L('Tus intentos', 'Your tries')}>
                {clicks.map((c, i) => (
                  <li key={i} className={`heat-${c.heat}`} title={heatName(c.heat)}>
                    <span className="sr-only">{heatName(c.heat)}</span>
                  </li>
                ))}
                {Array.from({ length: left }, (_, i) => (
                  <li key={`left-${i}`} className="heat-left" aria-hidden="true" />
                ))}
              </ol>
              <p className="heat-left-text">{L(left === 1 ? 'Te queda 1 intento.' : `Te quedan ${left} intentos.`, left === 1 ? 'You have 1 try left.' : `You have ${left} tries left.`)}</p>
            </div>
          )}
          {done && (
            <Verdict
              res={done}
              item={item}
              wiki={opts.wiki}
              lead={aside}
              title={
                hot ? (
                  done === 'bad' ? (
                    <>
                      {L('Estaba aquí:', 'It was here:')} <b>{item!.name}</b>
                    </>
                  ) : (
                    <>
                      {L('¡Ahí está!', 'There it is!')} <b>{out!.clicks <= 1 ? L('A la primera', 'First click') : L(`En ${out!.clicks} intentos`, `In ${out!.clicks} clicks`)}</b>
                    </>
                  )
                ) : km == null ? (
                  <>
                    {L('Estaba aquí:', 'It was here:')} <b>{item!.name}</b>
                  </>
                ) : km === 0 && item!.shape === 'area' ? (
                  <>{L('¡Dentro!', 'Inside!')}</>
                ) : (
                  <>
                    {done === 'ok' ? L('¡En el sitio!', 'Spot on!') : done === 'warn' ? L('Cerca:', 'Close:') : L('Lejos:', 'Far off:')} <b>{away(km)}</b>
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
              <button type="button" className="btn btn-sm" onClick={() => giveUp(item!)}>
                {hot && lastClick ? L('Me rindo', 'I give up') : L('No lo sé', "I don't know")}
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
