/** Route: join two items through the fewest neighbours, naming every step. */
import { ArrowRight, Flag as FlagIcon, Lightbulb, Shuffle, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag, StudyLinks } from '../components/ui';
import { deckGraph, seaLinks } from '../lib/data';
import { bfs, cheapestPath, pickRoute, shortestPath, type Route } from '../lib/geo';
import { L, fmtDay } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, cx, hashStr, mulberry32, pick, plural, shortNote } from '../lib/text';
import type { Item } from '../lib/types';
import { GameShell, Hud, useElapsed, type GameProps } from './common';

interface Guess {
  id: string;
  tone: 'ok' | 'warn' | 'bad';
  hint?: boolean;
}

/** Lets another screen (the daily challenge) host the game: its own heading and what happens afterwards. */
export interface TravelEmbed {
  title: string;
  subtitle: string;
  progress?: number;
  hud?: ReactNode;
  nextLabel: string;
  /** Guesses over the minimum (hints count one each) and whether the player gave up; reported once, when the route ends. */
  onScore(extra: number, lost: boolean): void;
  /** The player moves on. */
  onDone(): void;
  /** Shown under the verdict. */
  points(extra: number, lost: boolean): ReactNode;
}

export function TravelGame({ deck, cfg, onExit, embed }: GameProps & { embed?: TravelEmbed }) {
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
    if (best.length) map.current?.focus(best, { force: true, fill: 0.7 });
    if (embed) return;
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
      setNote(hint ? null : tone === 'ok' ? L('Va por el camino más corto.', 'It is on the shortest way.') : tone === 'warn' ? L('Cerca, pero da un pequeño rodeo.', 'Close, but a small detour.') : L('Queda lejos de la ruta.', 'It is far from the route.'));
    }
  };

  const onSubmit = (text: string) => {
    if (!route || state !== 'play') return;
    const ids = matcher.find(text);
    if (!ids.length) {
      setShake((n) => n + 1);
      setNote(matcher.vague(text) ? shortNote('vague', text) : L('No coincide con nada de este mapa.', 'It matches nothing on this map.'));
      return;
    }
    const fresh = ids.filter((id) => id !== route.from && id !== route.to && !guessed.has(id));
    if (!fresh.length) {
      setShake((n) => n + 1);
      setNote(L(`${deck.byId.get(ids[0])!.name} ya está en el mapa.`, `${deck.byId.get(ids[0])!.name} is already on the map.`));
      return;
    }
    add(fresh.slice(0, 1));
  };

  const hint = () => {
    if (!route || state !== 'play') return;
    // What is still missing on the way that makes the most of what has been found already.
    const way = cheapestPath(graph, route.from, route.to, guessed) ?? [];
    const options = way.filter((id) => id !== route.from && id !== route.to && !guessed.has(id));
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

  const extra = guesses.length - needed;
  /** For the daily challenge a hint costs as much as a wasted guess. */
  const cost = Math.max(0, extra) + guesses.filter((g) => g.hint).length;
  const reported = useRef(false);
  useEffect(() => {
    if (!embed || !route || state === 'play' || reported.current) return;
    reported.current = true;
    embed.onScore(cost, state === 'lost');
  });

  const title = MODE_NAME.travel;
  const fem = deck.noun.fem;
  if (!route || !from || !to) {
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        panel={
          <div className="q">
            <div className="q-prompt">
              <p className="kicker">{title}</p>
              <h2 className="q-ask">{L('Este mapa no da para un viaje', 'This map is too small for a journey')}</h2>
            </div>
            <p className="q-note">
              {L(
                `Hacen falta al menos tres ${deck.noun.many} que se toquen entre sí. Añade más países o elige un nivel con más divisiones.`,
                `At least three ${deck.noun.many} that touch each other are needed. Add more countries or choose a level with more divisions.`,
              )}
            </p>
            <div className="q-actions">
              <button type="button" className="btn btn-primary" onClick={onExit}>
                {L('Cambiar la selección', 'Change the selection')}
              </button>
            </div>
          </div>
        }
        stage={<MapView deck={deck} labels="all" tip={(id) => deck.byId.get(id)?.name} />}
      />
    );
  }

  const stars = state === 'lost' ? 0 : extra <= 0 ? 3 : extra <= 2 ? 2 : 1;
  const End = ({ item }: { item: Item }) => (
    <span className="end">
      {deck.countries.length > 1 && <Flag code={item.country.fl} size="sm" />}
      {item.name}
    </span>
  );

  return (
    <GameShell
      title={embed?.title ?? (cfg.daily && played === 0 ? L('Ruta del día', 'Route of the day') : title)}
      subtitle={embed?.subtitle ?? deck.title}
      onExit={onExit}
      progress={embed?.progress}
      hud={
        <>
          {embed?.hud}
          <Hud ms={embed ? undefined : ms} progress={embed ? undefined : `${guesses.length} ${L(guesses.length === 1 ? 'intento' : 'intentos', guesses.length === 1 ? 'guess' : 'guesses')}`} />
        </>
      }
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
            <p className="kicker">{embed ? L('Une los dos países', 'Join the two countries') : cfg.daily && played === 0 ? `${L('Ruta del día', 'Route of the day')} · ${fmtDay(cfg.daily)}` : L('El camino más corto', 'The shortest way')}</p>
            <h2 className="q-route">
              <End item={from} />
              <ArrowRight size={20} aria-hidden="true" />
              <End item={to} />
            </h2>
            <p className="q-sub">
              {needed === 0 ? L('Se tocan.', 'They touch.') : L(`La ruta más corta pasa por ${plural(needed, deck.noun.one, deck.noun.many)}.`, `The shortest route goes through ${plural(needed, deck.noun.one, deck.noun.many)}.`)}{' '}
              {L('Las líneas de puntos son travesías cortas por mar.', 'Dotted lines are short sea crossings.')}
            </p>
          </div>

          {!over && (
            <>
              <AnswerInput label={L(`Nombre de ${fem ? 'una' : 'un'} ${deck.noun.one}`, `Name of a ${deck.noun.one}`)} placeholder={L('Siguiente paso del camino…', 'Next step of the way…')} onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
              <p className="q-note" role="status">
                {note ?? L('El orden no importa: gana quien une los dos extremos.', 'The order does not matter: you win by joining both ends.')}
              </p>
            </>
          )}

          {over && (
            <div className={cx('verdict', state === 'won' ? (stars === 3 ? 'verdict-ok' : 'verdict-warn') : 'verdict-bad')} role="status">
              <div className="verdict-head">
                <span className="stars" aria-label={L(`${stars} de 3 estrellas`, `${stars} of 3 stars`)}>
                  {[1, 2, 3].map((i) => (
                    <Star key={i} size={18} className={i <= stars ? 'on' : undefined} aria-hidden="true" />
                  ))}
                </span>
                <span>{state === 'lost' ? L('Esta era una ruta posible', 'This was one possible route') : stars === 3 ? L('¡Ruta perfecta!', 'A perfect route!') : L('Ruta completada', 'Route completed')}</span>
              </div>
              <p className="facts">
                {state === 'won' ? L(`Has usado ${plural(guesses.length, deck.noun.one, deck.noun.many)}; el mínimo era ${needed}.`, `You used ${plural(guesses.length, deck.noun.one, deck.noun.many)}; the minimum was ${needed}.`) : null}
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
              {embed?.points(cost, state === 'lost')}
            </div>
          )}

          {guesses.length > 0 && (
            <ul className="guesses">
              {guesses.map((g) => (
                <li key={g.id} className={`t-${g.tone}`} title={g.tone === 'ok' ? L('En una ruta más corta', 'On a shortest route') : g.tone === 'warn' ? L('Cerca de la ruta', 'Close to the route') : L('Lejos de la ruta', 'Far from the route')}>
                  <span className="dot" />
                  {deck.byId.get(g.id)!.name}
                  {g.hint && <Lightbulb size={12} aria-label={L('pista', 'hint')} />}
                </li>
              ))}
            </ul>
          )}

          <div className="q-actions">
            {over ? (
              embed ? (
                <button type="button" className="btn btn-primary" onClick={embed.onDone} autoFocus>
                  {embed.nextLabel}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              ) : (
                <button type="button" className="btn btn-primary" onClick={another} autoFocus>
                  <Shuffle size={16} aria-hidden="true" />
                  {L('Otra ruta', 'Another route')}
                </button>
              )
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={hint}>
                  <Lightbulb size={15} aria-hidden="true" />
                  {L('Pista', 'Hint')}
                </button>
                {!embed && (
                  <button type="button" className="btn btn-sm" onClick={another}>
                    <Shuffle size={15} aria-hidden="true" />
                    {L('Otra ruta', 'Another route')}
                  </button>
                )}
                <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => finish('lost', guesses)}>
                  <FlagIcon size={15} aria-hidden="true" />
                  {L('Me rindo', 'I give up')}
                </button>
              </>
            )}
          </div>
          <ul className="legend">
            <li className="t-ok">
              <span className="dot" />
              {L('en la ruta más corta', 'on the shortest route')}
            </li>
            <li className="t-warn">
              <span className="dot" />
              {L('cerca', 'close')}
            </li>
            <li className="t-bad">
              <span className="dot" />
              {L('lejos', 'far')}
            </li>
          </ul>
        </div>
      }
    />
  );
}
