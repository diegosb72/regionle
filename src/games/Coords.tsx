/**
 * "Coordenadas": a latitude and a longitude are given and the player marks the point on a map that has
 * its parallels and meridians drawn. What is asked is where the pieces of the map are — each city, the
 * middle of each region or country —, so that every answer ends by saying what was there. The click is
 * judged by how far it falls, as in placing blind.
 *
 * The other way round (`opts.coordsAsk === 'read'`) the map marks the point and its coordinates are
 * chosen out of four, the wrong ones being the slips that reading a grid invites. See lib/coords.ts.
 */
import { ArrowRight, Flag as FlagIcon, Grid3x3 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type MarkKind, type Paint } from '../components/MapView';
import { seedOf } from '../lib/challenge';
import { coordDigits, coordOf, coordOptions, extentOf, fmtCoord, fmtDeg, gridStep, sayCoord } from '../lib/coords';
import { distanceKm, tolerances } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { cx, mulberry32, nf, shuffle } from '../lib/text';
import type { LL, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import './coords.css';

/**
 * How one point went. Marking: `km` is how far the click fell; null when none was made. Reading: `said`
 * is the coordinates that were chosen, `km` how far those are from the point, and `seen` whether they
 * are on this map at all.
 */
interface Outcome {
  res: Res;
  km: number | null;
  said?: LL;
  seen?: boolean;
}

export function CoordsGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  /** The map marks the point and the player reads its coordinates, instead of marking the point for them. */
  const reading = opts.coordsAsk === 'read';
  /** Degrees between the lines drawn on this map. */
  const step = useMemo(() => gridStep(deck.frame), [deck]);
  /** How close counts, by the size of the map, and how fine the coordinates are given for that. */
  const limit = useMemo(() => tolerances(deck.frame.length < 2 ? deck.items.map((it) => it.lp) : deck.frame), [deck]);
  const coarse = coordDigits(limit.ok);
  /** Whether a point lies between the ends of what this map is about. */
  const within = useMemo(() => {
    const { south, north, west, east } = extentOf(deck.frame);
    return ([lon, lat]: LL) => lat >= south && lat <= north && [lon - 360, lon, lon + 360].some((x) => x >= west && x <= east);
  }, [deck]);
  /**
   * The points asked: one inside each piece, by coordinates as round as they can be (`coordOf`). A piece
   * with no such point is not asked, nor one whose point falls off the map (Russia on a map of Europe).
   */
  const order = useMemo(() => {
    const ids = shuffle(
      deck.items
        .filter((it) => !cfg.only || cfg.only.includes(it.id))
        .map((it) => it.id)
        .sort(),
      mulberry32(seedOf(cfg)),
    );
    const seen = new Set<string>();
    const out: { id: string; ll: LL; digits: 0 | 1 }[] = [];
    for (const id of ids) {
      if (typeof opts.length === 'number' && !cfg.only && out.length >= opts.length) break;
      const at = coordOf(deck.byId.get(id)!, coarse);
      if (!at || seen.has(at.ll.join('|')) || !within(at.ll)) continue;
      seen.add(at.ll.join('|'));
      out.push({ id, ...at });
    }
    return out;
  }, [deck, cfg, opts.length, coarse, within]);
  /** A map of dots alone: cities. They are left out until they are answered, or they would be the answer. */
  const dotsOnly = useMemo(() => deck.items.every((it) => it.shape === 'point'), [deck]);

  const [at, setAt] = useState(0);
  const [click, setClick] = useState<LL | null>(null);
  const [done, setDone] = useState<Res | null>(null);
  const [results, setResults] = useState<Record<string, Outcome>>({});
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [stopped, setStopped] = useState(false);
  const map = useRef<MapHandle>(null);
  const addSession = useStore((s) => s.addSession);

  const ended = stopped || at >= order.length;
  const ms = useElapsed(!ended);
  const ask = !ended ? order[at] : null;
  const item = ask ? deck.byId.get(ask.id)! : null;
  const several = showsCountry(deck);
  const title = MODE_NAME.coords;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = ask?.id;
  /** The coordinates to choose from when the point is the one that is given: the same ones for the same game. */
  const options = useMemo(() => (reading && ask ? coordOptions(ask.ll, step, ask.digits, mulberry32(seedOf(cfg) + 97 * (at + 1)), within) : []), [reading, ask, step, cfg, at, within]);

  const settle = (res: Res, km: number | null, said?: LL) => {
    if (!ask || done) return;
    setDone(res);
    // Coordinates that were read wrong get a cross where they are, when that is somewhere on this map.
    const seen = said ? map.current?.shows(said) : undefined;
    setResults((r) => ({ ...r, [ask.id]: { res, km, said, seen } }));
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBest((b) => Math.max(b, run));
    // The answer has to be in sight, wherever the player was looking. A point that was read already is.
    if (!reading) setTimeout(() => map.current?.focus([ask.id], { passing: true }), 30);
  };

  /** One of the four coordinates is the answer. */
  const choose = (said: LL) => {
    if (!ask || done) return;
    const right = said[0] === ask.ll[0] && said[1] === ask.ll[1];
    settle(right ? 'ok' : 'bad', right ? 0 : distanceKm(said, ask.ll), said);
  };

  /** A click on the map is the answer. */
  const point = (where: LL) => {
    if (!ask || done) return;
    const km = distanceKm(where, ask.ll);
    setClick(where);
    settle(km <= limit.ok ? 'ok' : km <= limit.warn ? 'warn' : 'bad', km);
  };

  const next = () => {
    setAt((n) => n + 1);
    setClick(null);
    setDone(null);
    // Back to the view the player had: the next point may be at the other end of the map. A point that is
    // to be read has to be in sight, so the whole map comes back for it.
    if (reading) map.current?.reset();
    else map.current?.restore();
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, select, textarea')) return;
      if (done) {
        // On a button, Enter is that button's.
        if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof Element && e.target.closest('button, a, summary'))) {
          e.preventDefault();
          next();
        }
        return;
      }
      if (reading && e.key >= '1' && e.key <= String(options.length)) choose(options[Number(e.key) - 1]);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** What has been answered, and the piece in hand once it is: all that may be seen and named. */
  const known = useMemo(() => {
    const set = new Set(Object.keys(results));
    if (ask && done) set.add(ask.id);
    return set;
  }, [results, ask, done]);
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (ended) for (const [id, r] of Object.entries(results)) p[id] = r.res;
    else if (ask && done) p[ask.id] = done === 'bad' ? 'target' : done;
    return p;
  }, [results, ask, done, ended]);
  // A city is named over its dot. A surface is named in the panel: on the map its name would cover the point.
  const pinned = useMemo(() => (ask && done && dotsOnly ? new Set([ask.id]) : undefined), [ask, done, dotsOnly]);
  /** Where the player's answer falls: the click, or the coordinates chosen by mistake when they are on this map. */
  const said = ask && done ? results[ask.id]?.said : undefined;
  const guess = click ?? (said && done === 'bad' && results[ask!.id]?.seen ? said : null);
  const marks = useMemo(() => {
    if (!ask) return undefined;
    // A point that is to be read is marked from the start.
    if (!done) return reading ? [{ ll: ask.ll, kind: 'ask' as MarkKind }] : undefined;
    const list: { ll: LL; kind: MarkKind }[] = [{ ll: ask.ll, kind: 'spot' }];
    if (guess) list.push({ ll: guess, kind: 'guess' });
    return list;
  }, [ask, done, guess, reading]);
  const links = useMemo<[LL, LL][] | undefined>(() => (ask && done && guess ? [[guess, ask.ll]] : undefined), [ask, done, guess]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      grid={step}
      only={dotsOnly && !ended ? known : undefined}
      labels={ended ? 'all' : undefined}
      pinned={pinned}
      marks={marks}
      links={links}
      onPoint={ask && !done && !reading ? point : undefined}
      // No names while a point is open, but that of the piece that was there.
      tip={(id) => (ended || (done && id === ask?.id) ? deck.byId.get(id)?.name : null)}
    />
  );

  const rule = L(
    `A la primera: a menos de ${nf(limit.ok)} km del punto. Con ayuda: a menos de ${nf(limit.warn)} km.`,
    `First time: within ${nf(limit.ok)} km of the point. With help: within ${nf(limit.warn)} km.`,
  );

  if (ended) {
    const asked = order.filter((o) => results[o.id]);
    const rows: ResultRow[] = asked.map((o) => {
      const r = results[o.id];
      const coord = fmtCoord(o.ll, o.digits);
      // A point that was read wrong is kept with what was read instead.
      const how = reading ? (r.res === 'ok' ? '' : r.said ? L(` · no ${fmtCoord(r.said, o.digits)}`, ` · not ${fmtCoord(r.said, o.digits)}`) : L(' · sin responder', ' · not answered')) : ` · ${r.km == null ? L('sin marcar', 'not marked') : `${nf(Math.round(r.km))} km`}`;
      return { item: deck.byId.get(o.id)!, res: r.res, note: coord + how };
    });
    const placed = reading ? [] : asked.map((o) => results[o.id].km).filter((km): km is number => km != null);
    const mean = placed.length ? Math.round(placed.reduce((n, km) => n + km, 0) / placed.length) : null;
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={!rows.length ? L('Sin preguntas', 'No questions') : mean != null ? L(`Error medio: ${nf(mean)} km`, `Mean error: ${nf(mean)} km`) : L('Partida terminada', 'Game over')}
            note={
              !order.length
                ? L(
                    'Aquí no hay coordenadas que preguntar: estas piezas son demasiado pequeñas para señalarlas con décimas de grado, o quedan fuera del mapa.',
                    'There are no coordinates to ask here: these pieces are too small to be pointed at with tenths of a degree, or lie off the map.',
                  )
                : rows.length && !reading
                  ? rule
                  : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={rows.length ? [{ label: L('Mejor racha', 'Best streak'), value: best }] : undefined}
            again={order.length > 0}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const out = results[ask!.id];
  const km = out?.km ?? null;
  const last = at + 1 >= order.length;
  const [lon, lat] = ask!.ll;
  const digits = ask!.digits;
  /** The coordinates in words: which line each one is counted from, and which way. */
  const inWords = [
    lat === 0 ? L('en el ecuador', 'on the equator') : L(`${fmtDeg(lat, digits)} al ${lat > 0 ? 'norte' : 'sur'} del ecuador`, `${fmtDeg(lat, digits)} ${lat > 0 ? 'north' : 'south'} of the equator`),
    lon === 0
      ? L('en el meridiano de Greenwich', 'on the Greenwich meridian')
      : Math.abs(lon) === 180
        ? L('en el meridiano opuesto al de Greenwich', 'on the meridian opposite Greenwich')
        : L(`${fmtDeg(lon, digits)} al ${lon > 0 ? 'este' : 'oeste'} de Greenwich`, `${fmtDeg(lon, digits)} ${lon > 0 ? 'east' : 'west'} of Greenwich`),
  ];
  const where = several && item!.kind !== 'country' ? `${item!.name} (${nm(item!.country.n)})` : item!.name;
  const lines = L(`de ${nf(step, 1)}° en ${nf(step, 1)}°`, `${nf(step, 1)}° apart`);

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={at / order.length}
      hud={<Hud ms={ms} streak={streak} progress={`${at + 1} / ${order.length}`} />}
      stage={stage}
      panel={
        <div className="q coords">
          {reading ? (
            <>
              <div className="q-prompt">
                <p className="kicker">{L('Lee en el mapa', 'Read on the map')}</p>
                <h2 className="q-name coords-read">{L('¿Qué coordenadas tiene el punto marcado?', 'What are the coordinates of the marked point?')}</h2>
              </div>
              {!done && (
                <p className="q-how">
                  <Grid3x3 size={15} aria-hidden="true" />{' '}
                  {L(
                    `Mira entre qué líneas cae: van ${lines} y llevan su valor en el borde del mapa. Primero la latitud, luego la longitud.`,
                    `See which lines it falls between: they are ${lines}, with their value at the edge of the map. Latitude first, then longitude.`,
                  )}
                </p>
              )}
              <div className="choices coords-choices">
                {options.map((o, i) => {
                  const right = o[0] === lon && o[1] === lat;
                  return (
                    <button
                      key={o.join('|')}
                      type="button"
                      className={cx('choice', done && right && 'right', done && !right && said === o && 'wrong')}
                      disabled={!!done}
                      aria-label={sayCoord(o, digits)}
                      onClick={() => choose(o)}
                    >
                      <kbd>{i + 1}</kbd>
                      <span>{fmtCoord(o, digits)}</span>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="q-prompt">
                <p className="kicker">{L('Marca en el mapa', 'Mark on the map')}</p>
                <h2 className="q-name coords-ask" aria-label={sayCoord(ask!.ll, digits)}>
                  {fmtCoord(ask!.ll, digits)}
                </h2>
                <p className="q-sub coords-words">
                  {inWords[0]} · {inWords[1]}
                </p>
              </div>
              {!done && (
                <p className="q-how">
                  <Grid3x3 size={15} aria-hidden="true" />{' '}
                  {L(
                    `Haz clic en ese punto. Las líneas del mapa van ${lines}. Cuenta como acierto a menos de ${nf(limit.ok)} km; puedes acercar el mapa para afinar.`,
                    `Click on that point. The lines of the map are ${lines}. Within ${nf(limit.ok)} km counts as right; you can zoom in to be more precise.`,
                  )}
                </p>
              )}
            </>
          )}
          {done && reading && (
            <Verdict
              res={done}
              title={done === 'ok' ? L('¡Eso es!', 'That is it!') : said ? L('No eran esas', 'Not those') : L('Eran estas', 'It was these')}
              lead={
                <>
                  <p className="facts coords-answer">
                    {inWords[0]} · {inWords[1]}. {L('En ese punto:', 'At that point:')} <b>{where}</b>.
                  </p>
                  {done !== 'ok' && said && km != null && (
                    <p className="facts coords-said">
                      {L(
                        `Las que elegiste, ${fmtCoord(said, digits)}, quedan a ${nf(Math.round(km))} km de ahí${guess ? ': donde está la cruz' : ', fuera de este mapa'}.`,
                        `The ones you chose, ${fmtCoord(said, digits)}, are ${nf(Math.round(km))} km from there${guess ? ': where the cross is' : ', off this map'}.`,
                      )}
                    </p>
                  )}
                </>
              }
            />
          )}
          {done && !reading && (
            <Verdict
              res={done}
              title={
                km == null ? (
                  L('Era aquí', 'It was here')
                ) : (
                  <>
                    {done === 'ok' ? L('¡En el sitio!', 'Spot on!') : done === 'warn' ? L('Cerca:', 'Close:') : L('Lejos:', 'Far off:')} <b>{L(`a ${nf(Math.round(km))} km`, `${nf(Math.round(km))} km away`)}</b>
                  </>
                )
              }
              lead={
                <p className="facts coords-answer">
                  {L('En ese punto:', 'At that point:')} <b>{where}</b>.
                </p>
              }
            />
          )}
          <div className="q-actions">
            {done ? (
              // Marking, the focus stays where it was: on the map, for those who mark with the keys, where Enter goes
              // on too. Reading, the button takes it, which also brings it into sight under a long answer on a phone.
              <button key="next" type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus={reading}>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button key="skip" type="button" className="btn btn-sm" onClick={() => settle('bad', null)}>
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
