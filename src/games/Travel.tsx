/** Route: join two items through the fewest neighbours, naming every step. */
import { ArrowRight, Flag as FlagIcon, Lightbulb, Shuffle, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag, StudyLinks } from '../components/ui';
import { deckGraph, seaLinks } from '../lib/data';
import { bfs, onShortest, pickRoute, shortestPath, type Route } from '../lib/geo';
import { useStore } from '../lib/store';
import { Matcher, cx, hashStr, mulberry32, pick, plural } from '../lib/text';
import type { Item } from '../lib/types';
import { GameShell, Hud, useElapsed, type GameProps } from './common';

interface Guess {
  id: string;
  tone: 'ok' | 'warn' | 'bad';
  hint?: boolean;
}

export function TravelGame({ deck, cfg, onExit }: GameProps) {
  const graph = useMemo(() => deckGraph(deck), [deck]);
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);
  const links = useMemo(() => seaLinks(deck), [deck]);
  const [route, setRoute] = useState<Route | null>(() => pickRoute(graph, cfg.daily ? mulberry32(hashStr(`${cfg.daily}|${deck.key}`)) : Math.random));
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play');
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [played, setPlayed] = useState(0);
  const map = useRef<MapHandle>(null);
  const ms = useElapsed(state === 'play' && !!route);
  const addSession = useStore((s) => s.addSession);

  const from = route ? deck.byId.get(route.from)! : null;
  const to = route ? deck.byId.get(route.to)! : null;
  const needed = route ? route.steps - 1 : 0;
  const dist = useMemo(() => (route ? { a: bfs(graph, route.from), b: bfs(graph, route.to) } : null), [graph, route]);
  const best = useMemo(() => (route ? (shortestPath(graph, route.from, route.to) ?? []) : []), [graph, route]);
  const guessed = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses]);

  useEffect(() => {
    if (route) map.current?.focus([route.from, route.to], { force: true, fill: 0.55 });
  }, [route]);

  const toneOf = (id: string): Guess['tone'] => {
    if (!route || !dist) return 'bad';
    const detour = (dist.a.get(id) ?? Infinity) + (dist.b.get(id) ?? Infinity) - route.steps;
    return detour <= 0 ? 'ok' : detour <= 2 ? 'warn' : 'bad';
  };

  const finish = (result: 'won' | 'lost', list: Guess[]) => {
    setState(result);
    setNote(null);
    const n = { ok: 0, warn: 0, bad: 0 };
    for (const g of list) n[g.hint ? 'warn' : g.tone]++;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: 'travel',
      label: deck.title,
      total: Math.max(1, list.length),
      ...n,
      bad: n.bad + (result === 'lost' && !list.length ? 1 : 0),
      ms,
      note: `de ${from?.name} a ${to?.name}`,
    });
    if (best.length) map.current?.focus(best, { force: true, fill: 0.7 });
  };

  const add = (ids: string[], hint = false) => {
    if (!route) return;
    const list = [...guesses, ...ids.map((id) => ({ id, tone: toneOf(id), hint }))];
    setGuesses(list);
    setClear((n) => n + 1);
    setFlash({ id: ids[0], kind: toneOf(ids[0]) === 'bad' ? 'bad' : 'ok', n: Date.now() });
    const allowed = new Set([route.from, route.to, ...list.map((g) => g.id)]);
    if (bfs(graph, route.from, allowed).has(route.to)) finish('won', list);
    else {
      const tone = toneOf(ids[0]);
      setNote(hint ? null : tone === 'ok' ? 'Va por el camino más corto.' : tone === 'warn' ? 'Cerca, pero da un pequeño rodeo.' : 'Queda lejos de la ruta.');
    }
  };

  const onSubmit = (text: string) => {
    if (!route || state !== 'play') return;
    const ids = matcher.find(text);
    if (!ids.length) {
      setShake((n) => n + 1);
      setNote('No coincide con nada de este mapa.');
      return;
    }
    const fresh = ids.filter((id) => id !== route.from && id !== route.to && !guessed.has(id));
    if (!fresh.length) {
      setShake((n) => n + 1);
      setNote(`${deck.byId.get(ids[0])!.name} ya está en el mapa.`);
      return;
    }
    add(fresh.slice(0, 1));
  };

  const hint = () => {
    if (!route || state !== 'play') return;
    const options = [...onShortest(graph, route.from, route.to)].filter((id) => !guessed.has(id));
    if (options.length) add([pick(options)], true);
  };

  const another = () => {
    setRoute(pickRoute(graph, Math.random));
    setGuesses([]);
    setState('play');
    setNote(null);
    setPlayed((n) => n + 1);
    setClear((n) => n + 1);
  };

  const over = state !== 'play';
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (over) for (const id of best) if (!guessed.has(id)) p[id] = 'near';
    for (const g of guesses) p[g.id] = g.tone;
    if (route) {
      p[route.from] = 'from';
      p[route.to] = 'to';
    }
    return p;
  }, [guesses, route, over, best, guessed]);

  const pinned = useMemo(() => new Set(route ? [route.from, route.to, ...guesses.map((g) => g.id), ...(over ? best : [])] : []), [route, guesses, over, best]);

  const suggest = useMemo(() => {
    if (!cfg.opts.suggest) return undefined;
    return (text: string): Suggestion[] =>
      matcher
        .suggest(text, 6)
        .map((id) => deck.byId.get(id))
        .filter((it): it is Item => !!it)
        .map((it) => ({ id: it.id, label: it.name, sub: deck.countries.length > 1 && it.kind === 'unit' ? it.country.n.es : undefined }));
  }, [cfg.opts.suggest, matcher, deck]);

  const title = 'Ruta';
  if (!route || !from || !to) {
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        panel={
          <div className="q">
            <div className="q-prompt">
              <p className="kicker">Ruta</p>
              <h2 className="q-ask">Este mapa no da para un viaje</h2>
            </div>
            <p className="q-note">Hacen falta al menos tres {deck.noun.many} que se toquen entre sí. Añade más países o elige un nivel con más divisiones.</p>
            <div className="q-actions">
              <button type="button" className="btn btn-primary" onClick={onExit}>
                Cambiar la selección
              </button>
            </div>
          </div>
        }
        stage={<MapView deck={deck} labels="all" tip={(id) => deck.byId.get(id)?.name} />}
      />
    );
  }

  const extra = guesses.length - needed;
  const stars = state === 'lost' ? 0 : extra <= 0 ? 3 : extra <= 2 ? 2 : 1;
  const End = ({ item }: { item: Item }) => (
    <span className="end">
      {deck.countries.length > 1 && <Flag code={item.country.fl} size="sm" />}
      {item.name}
    </span>
  );

  return (
    <GameShell
      title={cfg.daily && played === 0 ? 'Ruta del día' : title}
      subtitle={deck.title}
      onExit={onExit}
      hud={<Hud ms={ms} progress={`${guesses.length} ${guesses.length === 1 ? 'intento' : 'intentos'}`} />}
      stage={
        <MapView
          ref={map}
          deck={deck}
          paint={paint}
          pinned={pinned}
          blind={cfg.opts.blind && !over}
          links={links}
          flash={flash}
          tip={(id) => (over || pinned.has(id) ? deck.byId.get(id)?.name : null)}
        />
      }
      panel={
        <div className="q">
          <div className="q-prompt">
            <p className="kicker">{cfg.daily && played === 0 ? `Ruta del día · ${cfg.daily.split('-').reverse().join('/')}` : 'El camino más corto'}</p>
            <h2 className="q-route">
              <End item={from} />
              <ArrowRight size={20} aria-hidden="true" />
              <End item={to} />
            </h2>
            <p className="q-sub">
              {needed === 0 ? 'Se tocan.' : `La ruta más corta pasa por ${plural(needed, deck.noun.one, deck.noun.many)}.`} Las líneas de puntos son travesías cortas por mar.
            </p>
          </div>

          {!over && (
            <>
              <AnswerInput label={`Nombre de ${deck.noun.fem ? 'una' : 'un'} ${deck.noun.one}`} placeholder="Siguiente paso del camino…" onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
              <p className="q-note" role="status">
                {note ?? 'El orden no importa: gana quien une los dos extremos.'}
              </p>
            </>
          )}

          {over && (
            <div className={cx('verdict', state === 'won' ? (stars === 3 ? 'verdict-ok' : 'verdict-warn') : 'verdict-bad')} role="status">
              <div className="verdict-head">
                <span className="stars" aria-label={`${stars} de 3 estrellas`}>
                  {[1, 2, 3].map((i) => (
                    <Star key={i} size={18} className={i <= stars ? 'on' : undefined} aria-hidden="true" />
                  ))}
                </span>
                <span>{state === 'lost' ? 'Esta era una ruta posible' : stars === 3 ? '¡Ruta perfecta!' : 'Ruta completada'}</span>
              </div>
              <p className="facts">
                {state === 'won' ? `Has usado ${plural(guesses.length, deck.noun.one, deck.noun.many)}; el mínimo era ${needed}.` : null}
              </p>
              <ol className="path">
                {best.map((id) => {
                  const it = deck.byId.get(id)!;
                  return (
                    <li key={id} className={id === route.from || id === route.to ? 'edge' : guessed.has(id) ? 'hit' : 'miss'}>
                      <b>{it.name}</b>
                      {id !== route.from && id !== route.to && !guessed.has(id) && <StudyLinks item={it} />}
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {guesses.length > 0 && (
            <ul className="guesses">
              {guesses.map((g) => (
                <li key={g.id} className={`t-${g.tone}`} title={g.tone === 'ok' ? 'En una ruta más corta' : g.tone === 'warn' ? 'Cerca de la ruta' : 'Lejos de la ruta'}>
                  <span className="dot" />
                  {deck.byId.get(g.id)!.name}
                  {g.hint && <Lightbulb size={12} aria-label="pista" />}
                </li>
              ))}
            </ul>
          )}

          <div className="q-actions">
            {over ? (
              <button type="button" className="btn btn-primary" onClick={another} autoFocus>
                <Shuffle size={16} aria-hidden="true" />
                Otra ruta
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={hint}>
                  <Lightbulb size={15} aria-hidden="true" />
                  Pista
                </button>
                <button type="button" className="btn btn-sm" onClick={another}>
                  <Shuffle size={15} aria-hidden="true" />
                  Otra ruta
                </button>
                <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => finish('lost', guesses)}>
                  <FlagIcon size={15} aria-hidden="true" />
                  Me rindo
                </button>
              </>
            )}
          </div>
          <ul className="legend">
            <li className="t-ok">
              <span className="dot" />
              en la ruta más corta
            </li>
            <li className="t-warn">
              <span className="dot" />
              cerca
            </li>
            <li className="t-bad">
              <span className="dot" />
              lejos
            </li>
          </ul>
        </div>
      }
    />
  );
}
