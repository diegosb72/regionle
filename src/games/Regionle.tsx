/**
 * Regionle, the classic game, as many times as the player likes: a piece is shown by its outline alone
 * and has to be named in six tries; each wrong name tells how far away the answer is and in which direction.
 */
import { ArrowRight, ArrowUp, Check, Flag as FlagIcon, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { GUESSES, bearing, compass } from '../daily/spec';
import { distanceKm, silhouette, spanKm } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, cx, mulberry32, nf, shortNote, shuffle } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import { turnOf } from './quiz';

const tries = (n: number) => (n === 1 ? L('intento', 'try') : L('intentos', 'tries'));
const COMPASS = () => [L('norte', 'north'), L('noreste', 'north-east'), L('este', 'east'), L('sureste', 'south-east'), L('sur', 'south'), L('suroeste', 'south-west'), L('oeste', 'west'), L('noroeste', 'north-west')];

export function RegionleGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  const pool = useMemo(() => deck.items.filter((it) => it.shape === 'area' && (!cfg.only || cfg.only.includes(it.id))), [deck, cfg.only]);
  const order = useMemo(() => {
    const list = shuffle(pool.map((it) => it.id).sort(), mulberry32(seedOf(cfg)));
    return typeof opts.length === 'number' && !cfg.only ? list.slice(0, opts.length) : list;
  }, [pool, cfg, opts.length]);
  const endless = opts.length === 'endless' && !cfg.only;
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);
  const span = useMemo(() => spanKm(deck.items.map((it) => it.lp)), [deck]);

  const [at, setAt] = useState(0);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play');
  const [results, setResults] = useState<Record<string, Res>>({});
  const [streak, setStreak] = useState(0);
  const [best, setBestRun] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const map = useRef<MapHandle>(null);
  const record = useStore((s) => s.record);
  const addSession = useStore((s) => s.addSession);
  const setBest = useStore((s) => s.setBest);
  const bump = useStore((s) => s.bump);

  const ended = stopped || !order.length || (!endless && at >= order.length);
  const ms = useElapsed(!ended);
  const target = ended ? null : order[at % order.length];
  const item = target ? deck.byId.get(target)! : null;
  const over = state !== 'play';
  const fem = deck.noun.fem;
  const several = showsCountry(deck);
  const title = MODE_NAME.regionle;
  /** Turned outlines: north is not at the top until the round is settled, and then it is seen as it lies. */
  const turned = opts.turned && item && !over ? turnOf(seedOf(cfg), item.id) : 0;
  const shape = useMemo(() => (item ? silhouette(item.geo, 400, 0.08, turned) : ''), [item, turned]);
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = item?.id;

  const settle = (won: boolean, used: number) => {
    if (!item) return;
    const res: Res = !won ? 'bad' : used === 1 ? 'ok' : 'warn';
    setState(won ? 'won' : 'lost');
    setNote(null);
    setResults((r) => (r[item.id] ? r : { ...r, [item.id]: res }));
    record('name', item.id, res, originOf(item, cfg));
    if (won && used === 1) bump({ regionle1: 1 });
    const run = won ? streak + 1 : 0;
    setStreak(run);
    setBestRun((b) => Math.max(b, run));
  };

  const onSubmit = (text: string) => {
    if (over || !item) return;
    const id = matcher.find(text)[0];
    const g = id ? deck.byId.get(id) : undefined;
    if (!g) {
      setShake((n) => n + 1);
      setNote(matcher.vague(text) ? shortNote('vague', text) : L('No coincide con nada de este mapa.', 'It matches nothing on this map.'));
      return;
    }
    if (guesses.includes(g.id)) {
      setShake((n) => n + 1);
      setNote(L(`${g.name} ya ${fem ? 'la' : 'lo'} has probado.`, `You have already tried ${g.name}.`));
      return;
    }
    const list = [...guesses, g.id];
    setGuesses(list);
    setClear((n) => n + 1);
    setNote(null);
    setFlash({ id: g.id, kind: g.id === item.id ? 'ok' : 'bad', n: Date.now() });
    if (g.id === item.id) settle(true, list.length);
    else if (list.length >= GUESSES) settle(false, list.length);
  };

  const next = () => {
    setAt((n) => n + 1);
    setGuesses([]);
    setState('play');
    setNote(null);
    setClear((n) => n + 1);
    map.current?.reset();
  };

  useEffect(() => {
    if (over && target) map.current?.focus([target], { fill: 0.5 });
  }, [over, target]);

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
      ok: list.filter((r) => r === 'ok').length,
      warn: list.filter((r) => r === 'warn').length,
      bad: list.filter((r) => r === 'bad').length,
      ms,
    });
    if (best > 0 && !cfg.list) setBest(`regionle:${deck.key}`, best);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea, summary')) return;
      if ((e.key === 'Enter' || e.key === ' ') && over && !ended) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const suggest = useMemo(() => {
    if (!opts.suggest) return undefined;
    return (text: string): Suggestion[] =>
      matcher
        .suggest(text, 8)
        .filter((id) => !guesses.includes(id))
        .map((id) => deck.byId.get(id)!)
        .map((it) => ({ id: it.id, label: it.name, sub: several ? nm(it.country.n) : undefined }));
  }, [opts.suggest, matcher, deck, several, guesses]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (!item) {
      for (const [id, res] of Object.entries(results)) p[id] = res;
      return p;
    }
    for (const id of guesses) if (id !== item.id) p[id] = distanceKm(deck.byId.get(id)!.lp, item.lp) / span <= 0.25 ? 'warn' : 'bad';
    if (state === 'won') p[item.id] = 'ok';
    if (state === 'lost') p[item.id] = 'target';
    return p;
  }, [guesses, state, item, deck, span, results]);
  const pinned = useMemo(() => new Set(over && item ? [...guesses, item.id] : guesses), [guesses, over, item]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      pinned={ended ? undefined : pinned}
      labels={ended || over ? 'all' : undefined}
      // Until the round is settled the map has no inner borders: the outline in the panel is all there is to go on.
      blind={!ended && !over}
      flash={flash}
      tip={(id) => (ended || over || guesses.includes(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended || !item) {
    const rows: ResultRow[] = Object.entries(results).map(([id, res]) => ({ item: deck.byId.get(id)!, res }));
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={rows.length ? (rows.every((r) => r.res !== 'bad') ? L('¡Todas adivinadas!', 'All of them guessed!') : L('Partida terminada', 'Game over')) : L('Sin rondas', 'No rounds')}
            note={rows.length ? L('A la primera: adivinada al primer intento. Con ayuda: con las pistas de distancia.', 'First time: guessed at the first try. With help: with the distance clues.') : undefined}
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

  const names = COMPASS();
  const clue = (id: string) => {
    const g = deck.byId.get(id)!;
    const km = distanceKm(g.lp, item.lp);
    return { km, deg: bearing(g.lp, item.lp), near: Math.max(0, Math.min(99, Math.round((1 - km / span) * 100))) };
  };
  const rounds = endless ? null : order.length;
  const last = !endless && at + 1 >= order.length;

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={rounds ? (at + (over ? 1 : 0)) / rounds : undefined}
      hud={<Hud ms={ms} streak={streak} progress={rounds ? `${at + 1} / ${rounds}` : `${L('Ronda', 'Round')} ${at + 1}`} />}
      stage={stage}
      panel={
        <div className="q">
          <div className="q-prompt">
            <p className="kicker">Regionle</p>
            <h2 className="q-ask">
              {L(`¿Qué ${deck.noun.one} es ${fem ? 'esta' : 'este'}?`, `Which ${deck.noun.one} is this?`)}
              {opts.turned && !over && <small> {L('Está girada: el norte no queda arriba.', 'It is turned: north is not at the top.')}</small>}
            </h2>
            {several && (guesses.length >= 3 || over) && (
              <p className="q-sub">
                <Flag code={item.country.fl} size="sm" /> {L(`Está en ${nm(item.country.n)}`, `It is in ${nm(item.country.n)}`)}
              </p>
            )}
          </div>
          {/* The outline gives way as the list of tries grows, so that the answer box stays in sight. */}
          <div className={cx('d-shape', (over || guesses.length >= 3) && 'is-small')}>
            <svg viewBox="0 0 400 400" role="img" aria-label={L('Silueta que hay que reconocer', 'Outline to recognise')}>
              <path d={shape} />
            </svg>
          </div>

          {!over && (
            <>
              <AnswerInput label={L('Tu respuesta', 'Your answer')} placeholder={L(`Escribe ${fem ? 'una' : 'un'} ${deck.noun.one}…`, 'Type a name…')} onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
              <p className="q-note" role="status">
                {note ??
                  (guesses.length
                    ? L(`${GUESSES - guesses.length === 1 ? 'Te queda' : 'Te quedan'} ${GUESSES - guesses.length} ${tries(GUESSES - guesses.length)}.`, `${GUESSES - guesses.length} ${tries(GUESSES - guesses.length)} left.`)
                    : L(`Tienes ${GUESSES} intentos. Cada fallo te dice a qué distancia y hacia dónde está.`, `You have ${GUESSES} tries. Each miss tells you how far away it is and in which direction.`))}
              </p>
            </>
          )}

          {guesses.length > 0 && (
            <ol className="d-guesses">
              {guesses.map((id) => {
                const g = deck.byId.get(id)!;
                if (id === item.id)
                  return (
                    <li key={id} className="hit">
                      <b>{g.name}</b>
                      <Check size={16} aria-label={L('correcto', 'correct')} />
                    </li>
                  );
                const c = clue(id);
                return (
                  <li key={id}>
                    <b>{g.name}</b>
                    <span>{nf(Math.max(1, Math.round(c.km)))} km</span>
                    <span className="d-dir" title={L(`hacia el ${names[compass(c.deg)]}`, `to the ${names[compass(c.deg)]}`)}>
                      <ArrowUp size={16} strokeWidth={2.6} style={{ transform: `rotate(${Math.round(c.deg)}deg)` }} aria-hidden="true" />
                      <i>{names[compass(c.deg)]}</i>
                    </span>
                    <em>{c.near} %</em>
                  </li>
                );
              })}
            </ol>
          )}

          {over && (
            <Verdict
              res={state === 'won' ? (guesses.length === 1 ? 'ok' : 'warn') : 'bad'}
              item={item}
              wiki={opts.wiki}
              title={
                state === 'won' ? (
                  <>
                    {guesses.length === 1 ? L('¡A la primera!', 'First try!') : L(`Correcto, en ${guesses.length} ${tries(guesses.length)}:`, `Right, in ${guesses.length} ${tries(guesses.length)}:`)} <b>{item.name}</b>
                  </>
                ) : (
                  <>
                    {L('Era', 'It was')} <b>{item.name}</b>
                  </>
                )
              }
            />
          )}

          <div className="q-actions">
            {over ? (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus>
                {last ? L('Ver resultado', 'See the result') : L('Otra', 'Another one')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => settle(false, guesses.length)}>
                <X size={15} aria-hidden="true" />
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
