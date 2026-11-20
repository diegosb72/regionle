/**
 * Route: join two items through the fewest neighbours, naming every step. A route may have a rule to keep
 * (lib/journey.ts): a piece that is closed, a third piece to call at, or land borders only.
 */
import './journey.css';
import { ArrowRight, Flag as FlagIcon, Lightbulb, Shuffle, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag, StudyLinks } from '../components/ui';
import { deckGraph, seaLinks } from '../lib/data';
import { L, fmtDay } from '../lib/i18n';
import { bestWalk, detourOf, joined, missing, pickJourney, planOf, type Journey, type Ways } from '../lib/journey';
import { MODE_NAME, routeRuleName } from '../lib/modes';
import { isRouteRule, type RouteRule } from '../lib/rules';
import { useStore } from '../lib/store';
import { Matcher, shortNote } from '../lib/matcher';
import { cx, hashStr, mulberry32, pick, plural, type Rng } from '../lib/text';
import type { Item } from '../lib/types';
import { GameShell, Hud, useElapsed, useFlashSignal, type GameProps } from './common';

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
  /** No hints to ask for: the hard way of the daily challenge. */
  noHints?: boolean;
}

export function TravelGame({ deck, cfg, onExit, embed }: GameProps & { embed?: TravelEmbed }) {
  const ways = useMemo<Ways>(() => ({ all: deckGraph(deck), land: deckGraph(deck, false) }), [deck]);
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);
  const links = useMemo(() => seaLinks(deck), [deck]);
  /** The rule that was asked for. The route of the day and that of the daily challenge are the same for everyone: they have none. */
  const wanted: RouteRule = embed || cfg.daily || !isRouteRule(cfg.opts.routeRule) ? 'none' : cfg.opts.routeRule;
  /** A route that keeps the rule; where the map has none of the kind, a plain one. */
  const draw = (rng: Rng): Journey | null => pickJourney(ways, rng, wanted) ?? (wanted === 'none' ? null : pickJourney(ways, rng, 'none'));
  const [route, setRoute] = useState<Journey | null>(() => draw(cfg.daily ? mulberry32(hashStr(`${cfg.daily}|${deck.key}`)) : Math.random));
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play');
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  useFlashSignal(flash);
  const [played, setPlayed] = useState(0);
  const map = useRef<MapHandle>(null);
  const ms = useElapsed(state === 'play' && !!route);
  const addSession = useStore((s) => s.addSession);

  const from = route ? deck.byId.get(route.from)! : null;
  const to = route ? deck.byId.get(route.to)! : null;
  const needed = route ? route.needed : 0;
  const rule: RouteRule = route?.rule ?? 'none';
  /** The piece the route has to call at, and the one it cannot go through. */
  const stop = route?.rule === 'via' && route.mark ? (deck.byId.get(route.mark) ?? null) : null;
  const shut = route?.rule === 'avoid' && route.mark ? (deck.byId.get(route.mark) ?? null) : null;
  const plan = useMemo(() => (route ? planOf(ways, route) : null), [ways, route]);
  const best = useMemo(() => (plan ? bestWalk(plan) : []), [plan]);
  const guessed = useMemo(() => new Set(guesses.map((g) => g.id)), [guesses]);

  useEffect(() => {
    // The stop is an end of its own and has to be in sight. A closed piece lies between the two ends: fitting
    // the whole of a large one (Russia, between Lithuania and Norway) would leave the ends as two specks.
    if (route) map.current?.focus([route.from, route.to, ...(route.rule === 'via' && route.mark ? [route.mark] : [])], { force: true, fill: 0.55 });
  }, [route]);

  const toneOf = (id: string): Guess['tone'] => {
    if (!plan) return 'bad';
    const detour = detourOf(plan, id);
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
      note: `de ${from?.name} a ${to?.name}${shut ? ` sin pasar por ${shut.name}` : stop ? ` pasando por ${stop.name}` : rule === 'land' ? ' solo por tierra' : ''}`,
    });
  };

  const add = (ids: string[], hint = false) => {
    if (!route || !plan) return;
    const list = [...guesses, ...ids.map((id) => ({ id, tone: toneOf(id), hint }))];
    setGuesses(list);
    setClear((n) => n + 1);
    setFlash({ id: ids[0], kind: toneOf(ids[0]) === 'bad' ? 'bad' : 'ok', n: Date.now() });
    if (joined(plan, list.map((g) => g.id))) finish('won', list);
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
    const fresh = ids.filter((id) => id !== route.from && id !== route.to && id !== stop?.id && !guessed.has(id));
    if (!fresh.length) {
      setShake((n) => n + 1);
      setNote(L(`${deck.byId.get(ids[0])!.name} ya está en el mapa.`, `${deck.byId.get(ids[0])!.name} is already on the map.`));
      return;
    }
    // The closed piece is no step of any way: it is said, and it is not counted as a guess.
    const open = fresh.filter((id) => id !== shut?.id);
    if (!open.length) {
      setShake((n) => n + 1);
      setNote(L(`Por ${shut!.name} no se puede pasar: busca otro camino.`, `There is no way through ${shut!.name}: look for another.`));
      return;
    }
    add(open.slice(0, 1));
  };

  const hint = () => {
    if (!plan || state !== 'play') return;
    // What is still missing on the way that makes the most of what has been found already.
    const options = missing(plan, guessed);
    if (options.length) add([pick(options)], true);
  };

  const another = () => {
    setRoute(draw(Math.random));
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
      if (route.mark) p[route.mark] = route.rule === 'via' ? 'stop' : 'shut';
    }
    return p;
  }, [guesses, route, over, best, guessed]);

  const pinned = useMemo(() => new Set(route ? [route.from, route.to, ...(route.mark ? [route.mark] : []), ...guesses.map((g) => g.id), ...(over ? best : [])] : []), [route, guesses, over, best]);

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
  const pieces = plural(needed, deck.noun.one, deck.noun.many);
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
          // By land only, the crossings are no way through: they are not drawn.
          links={rule === 'land' ? undefined : links}
          flash={flash}
          tip={(id) => (over || pinned.has(id) ? deck.byId.get(id)?.name : null)}
        />
      }
      panel={
        <div className="q">
          <div className="q-prompt">
            <p className="kicker">
              {embed
                ? L('Une los dos países', 'Join the two countries')
                : cfg.daily && played === 0
                  ? `${L('Ruta del día', 'Route of the day')} · ${fmtDay(cfg.daily)}`
                  : rule === 'none'
                    ? L('El camino más corto', 'The shortest way')
                    : `${L('Ruta', 'Route')} ${routeRuleName(rule)}`}
            </p>
            <h2 className="q-route">
              <End item={from} />
              <ArrowRight size={20} aria-hidden="true" />
              {stop && (
                <>
                  <End item={stop} />
                  <ArrowRight size={20} aria-hidden="true" />
                </>
              )}
              <End item={to} />
            </h2>
            <p className="q-sub">
              {shut
                ? L(`Sin pasar por ${shut.name}, la ruta más corta pasa por ${pieces}.`, `Without going through ${shut.name}, the shortest route goes through ${pieces}.`)
                : stop
                  ? needed === 1
                    ? L(`Hay que parar en ${stop.name}: la ruta más corta pasa por ${fem ? 'otra' : 'otro'} ${deck.noun.one}.`, `You have to call at ${stop.name}: the shortest route goes through one other ${deck.noun.one}.`)
                    : L(
                        `Hay que parar en ${stop.name}: la ruta más corta pasa por ${fem ? 'otras' : 'otros'} ${needed} ${deck.noun.many}.`,
                        `You have to call at ${stop.name}: the shortest route goes through ${needed} other ${deck.noun.many}.`,
                      )
                  : rule === 'land'
                    ? L(`Solo por tierra, sin travesías por mar: la ruta más corta pasa por ${pieces}.`, `By land only, without sea crossings: the shortest route goes through ${pieces}.`)
                    : needed === 0
                      ? L('Se tocan.', 'They touch.')
                      : L(`La ruta más corta pasa por ${pieces}.`, `The shortest route goes through ${pieces}.`)}
              {/* Only where there are any to see: by land they are not drawn, and many a map has none. */}
              {rule !== 'land' && links.length > 0 && ` ${L('Las líneas de puntos son travesías cortas por mar.', 'Dotted lines are short sea crossings.')}`}
            </p>
            {wanted !== rule && (
              <p className="q-note route-plain">
                {L(`Este mapa no da para una ruta ${routeRuleName(wanted)}: esta va sin condición.`, `This map has no route ${routeRuleName(wanted)}: this one has no condition.`)}
              </p>
            )}
          </div>

          {!over && (
            <>
              <AnswerInput label={L(`Nombre de ${fem ? 'una' : 'un'} ${deck.noun.one}`, `Name of a ${deck.noun.one}`)} placeholder={L('Siguiente paso del camino…', 'Next step of the way…')} onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
              <p className="q-note" role="status">
                {note ??
                  (stop
                    ? L('El orden no importa: gana quien une los dos extremos y la parada.', 'The order does not matter: you win by joining both ends and the stop.')
                    : L('El orden no importa: gana quien une los dos extremos.', 'The order does not matter: you win by joining both ends.'))}
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
                {/* A route that calls somewhere out of the way comes back by where it went: those pieces are there twice. */}
                {best.map((id, i) => {
                  const it = deck.byId.get(id)!;
                  const given = id === route.from || id === route.to || id === stop?.id;
                  return (
                    <li key={i} className={id === stop?.id ? 'stop' : given ? 'edge' : guessed.has(id) ? 'hit' : 'miss'}>
                      <b>{it.name}</b>
                      {!given && !guessed.has(id) && best.indexOf(id) === i && <StudyLinks item={it} />}
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
                {!embed?.noHints && (
                  <button type="button" className="btn btn-sm" onClick={hint}>
                    <Lightbulb size={15} aria-hidden="true" />
                    {L('Pista', 'Hint')}
                  </button>
                )}
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
            {stop && (
              <li className="t-stop">
                <span className="dot" />
                {L('parada', 'stop')}
              </li>
            )}
            {shut && (
              <li className="t-shut">
                <span className="dot" />
                {L('cerrado', 'closed')}
              </li>
            )}
          </ul>
        </div>
      }
    />
  );
}
