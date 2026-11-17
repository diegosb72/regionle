/**
 * Neighbours: one piece is shown on a map without inner borders and the player types every piece that
 * shares a land border with it. Nothing on the map gives the answer away: the neighbours are drawn as
 * they are named.
 */
import { ArrowRight, Eye, Flag as FlagIcon, Keyboard, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { countryAnswers, loadIndex } from '../lib/data';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, hintMax, letterHint, mulberry32, shortNote, shuffle } from '../lib/text';
import type { Item, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';

/** Wrong names allowed before the answer is shown. */
const MISSES = 3;

export function NeighboursGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  const order = useMemo(() => {
    const pool = deck.items.filter((it) => it.nb.length > 0 && (!cfg.only || cfg.only.includes(it.id))).map((it) => it.id);
    const list = shuffle(pool.sort(), mulberry32(seedOf(cfg)));
    return typeof opts.length === 'number' && !cfg.only ? list.slice(0, opts.length) : list;
  }, [deck, cfg, opts.length]);

  const [at, setAt] = useState(0);
  const [found, setFound] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [done, setDone] = useState<Res | null>(null);
  const [results, setResults] = useState<Record<string, Res>>({});
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [stopped, setStopped] = useState(false);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  /** The neighbour a hint is spelling out, and how many of its letters are shown. */
  const [hint, setHint] = useState<{ id: string; shown: number } | null>(null);
  const [helped, setHelped] = useState(false);
  /** Countries of the world that are not on this map: named so that the player knows why they do not count. */
  const [outside, setOutside] = useState<{ matcher: Matcher; names: Map<string, string> } | null>(null);
  const map = useRef<MapHandle>(null);
  const record = useStore((s) => s.record);
  const addSession = useStore((s) => s.addSession);
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);

  const ended = stopped || at >= order.length;
  const ms = useElapsed(!ended);
  const item = !ended ? deck.byId.get(order[at])! : null;
  const several = showsCountry(deck);
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = item?.id;
  const fem = deck.noun.fem;
  const many = deck.noun.many;

  useEffect(() => {
    if (deck.scope !== 'countries') return;
    let alive = true;
    loadIndex().then(
      ({ index }) => {
        if (!alive) return;
        const others = index.countries.filter((c) => c.cl !== 'other' && !deck.byId.has(c.id));
        setOutside({ matcher: new Matcher(others.map(countryAnswers)), names: new Map(others.map((c) => [c.id, nm(c.n)])) });
      },
      () => undefined,
    );
    return () => {
      alive = false;
    };
  }, [deck]);

  // The map travels to each question. The zoom depends on the piece alone, so that the frame gives nothing away…
  useEffect(() => {
    if (item) map.current?.focus([item.id], { fill: 0.3, force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  // …and once the answer is out, every neighbour is brought into view.
  useEffect(() => {
    if (item && done) map.current?.focus([item.id, ...item.nb], { fill: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const settle = (res: Res) => {
    if (!item || done) return;
    setDone(res);
    setNote(null);
    setResults((r) => ({ ...r, [item.id]: res }));
    record('nb', item.id, res, originOf(item, cfg));
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBest((b) => Math.max(b, run));
  };

  const accept = (id: string) => {
    if (!item) return;
    const list = [...found, id];
    setFound(list);
    setNote(null);
    setClear((n) => n + 1);
    setFlash({ id, kind: 'ok', n: Date.now() });
    if (hint?.id === id) setHint(null);
    if (list.length === item.nb.length) settle(misses === 0 && !helped ? 'ok' : 'warn');
  };

  const missing = (it: Item) => it.nb.filter((id) => !found.includes(id));

  /**
   * Every name is sent with Enter and judged. Taking a neighbour as soon as its name is complete would
   * answer "is this one a neighbour?" for free: the names that stay in the box are the ones that are not.
   */
  const onSubmit = (text: string) => {
    if (!item || done) return;
    const ids = matcher.find(text);
    const hit = ids.find((id) => item.nb.includes(id) && !found.includes(id));
    // The hint spells a neighbour out letter by letter, and its initials with it: that one is written in full.
    const spelt = !!hit && hint?.id === hit && matcher.abbreviates(text);
    if (hit && !spelt) return accept(hit);
    setShake((n) => n + 1);
    if (spelt) return setNote(shortNote('short', text));
    if (!ids.length) {
      if (matcher.vague(text)) return setNote(shortNote('vague', text));
      const far = outside?.matcher.find(text)[0];
      setNote(
        far
          ? L(`${outside!.names.get(far)} no está en este mapa: solo cuentan ${fem ? 'las' : 'los'} ${many} elegidos.`, `${outside!.names.get(far)} is not on this map: only the chosen ${many} count.`)
          : L('No coincide con nada de este mapa.', 'It matches nothing on this map.'),
      );
      return;
    }
    const other = deck.byId.get(ids[0])!;
    if (other.id === item.id) return setNote(L(`${other.name} es ${fem ? 'la' : 'el'} que te preguntamos.`, `${other.name} is the one being asked.`));
    if (found.includes(other.id)) return setNote(L(`${other.name}: ya ${fem ? 'la' : 'lo'} tienes.`, `${other.name}: you already have it.`));
    // A short sea crossing is a fair guess: it is explained, not punished.
    if (item.sl.includes(other.id)) return setNote(L(`${other.name} está al otro lado del mar: solo cuentan las fronteras por tierra.`, `${other.name} lies across the sea: only land borders count.`));
    const n = misses + 1;
    setMisses(n);
    if (n >= MISSES) settle('bad');
    else setNote(L(`${other.name} no limita con ${item.name}.`, `${other.name} does not border ${item.name}.`));
  };

  const giveHint = () => {
    if (!item || done) return;
    const left = missing(item);
    if (!left.length) return;
    setHelped(true);
    setNote(null);
    const id = hint && left.includes(hint.id) ? hint.id : left[Math.floor(Math.random() * left.length)];
    const name = deck.byId.get(id)!.name;
    setHint({ id, shown: Math.min(hintMax(name), hint?.id === id ? hint.shown + 1 : 1) });
  };

  const next = () => {
    setAt((n) => n + 1);
    setFound([]);
    setMisses(0);
    setDone(null);
    setNote(null);
    setHint(null);
    setHelped(false);
    setClear((n) => n + 1);
  };

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

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (!item) {
      for (const [id, res] of Object.entries(results)) p[id] = res;
      return p;
    }
    p[item.id] = 'sel';
    for (const id of found) p[id] = 'ok';
    if (done) for (const id of item.nb) if (!found.includes(id)) p[id] = 'target';
    return p;
  }, [item, found, done, results]);

  const labels = useMemo(() => (ended ? ('all' as const) : new Set(done && item ? item.nb : found)), [ended, done, item, found]);
  const pinned = useMemo(() => (item ? new Set([item.id]) : undefined), [item]);
  const suggest = useMemo(() => {
    if (!opts.suggest) return undefined;
    return (text: string): Suggestion[] =>
      matcher
        .suggest(text, 6)
        .map((id) => deck.byId.get(id))
        .filter((it): it is Item => !!it)
        .map((it) => ({ id: it.id, label: it.name, sub: several ? nm(it.country.n) : undefined }));
  }, [opts.suggest, matcher, deck, several]);

  const title = MODE_NAME.neighbours;
  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      labels={labels}
      pinned={pinned}
      flash={flash}
      // No inner borders while the question is open: seeing which pieces touch would answer it.
      blind={!ended && !done}
      tip={(id) => (ended || done || found.includes(id) || id === item?.id ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
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
            title={rows.length ? (rows.every((r) => r.res === 'ok') ? L('¡Pleno!', 'Full marks!') : L('Partida terminada', 'Game over')) : L('Sin preguntas', 'No questions')}
            note={order.length ? undefined : L(`En este mapa ${fem ? 'ninguna' : 'ninguno'} de ${fem ? 'las' : 'los'} ${many} limita por tierra con ${fem ? 'otra' : 'otro'}.`, `On this map none of the ${many} shares a land border with another.`)}
            deck={deck}
            rows={rows}
            ms={ms}
            stats={[{ label: L('Mejor racha', 'Best streak'), value: best }]}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const total = item!.nb.length;
  const left = missing(item!).map((id) => deck.byId.get(id)?.name ?? id);
  /** Neighbours that the map does not hold: the question is about the chosen countries only. */
  const beyond = deck.scope === 'countries' && (item!.country.nb?.length ?? 0) > total;
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
            <p className="kicker">{L(`¿Con qué ${many} limita?`, `Which ${many} border it?`)}</p>
            <h2 className="q-name">{item!.name}</h2>
            {several && (
              <p className="q-sub">
                <Flag code={item!.country.fl} size="sm" /> {L(`${item!.type} de ${nm(item!.country.n)}`, `${item!.type} in ${nm(item!.country.n)}`)}
              </p>
            )}
          </div>
          <div className="nb-count" role="status">
            <strong>
              {found.length} / {total}
            </strong>
            <span>{L(total === 1 ? 'vecino escrito' : 'vecinos escritos', total === 1 ? 'neighbour named' : 'neighbours named')}</span>
            <span className="nb-lives" aria-label={L(`Fallos: ${misses} de ${MISSES}`, `Misses: ${misses} of ${MISSES}`)}>
              {Array.from({ length: MISSES }, (_, i) => (
                <i key={i} className={i < misses ? 'off' : undefined} />
              ))}
            </span>
          </div>
          {!done && (
            <>
              <AnswerInput
                label={L(`Nombre de ${fem ? 'una' : 'un'} ${deck.noun.one} vecin${fem ? 'a' : 'o'}`, `Name of a neighbouring ${deck.noun.one}`)}
                placeholder={L('Escribe un vecino…', 'Type a neighbour…')}
                onSubmit={onSubmit}
                suggest={suggest}
                shake={shake}
                clear={clear}
              />
              {hint && <p className="q-letters">{letterHint(deck.byId.get(hint.id)!.name, hint.shown)}</p>}
              <p className="q-note" role="status">
                {note ?? (
                  <>
                    <Keyboard size={15} aria-hidden="true" />{' '}
                    {L('Escríbelos uno a uno, en cualquier orden, y pulsa Intro tras cada uno. Solo cuentan las fronteras por tierra; al tercer fallo se muestra la respuesta.', 'Type them one by one, in any order, and press Enter after each. Only land borders count; the third miss shows the answer.')}
                    {beyond ? ` ${L(`Solo cuentan los ${many} de este mapa.`, `Only the ${many} on this map count.`)}` : ''}
                  </>
                )}
              </p>
              {found.length > 0 && (
                <ul className="found">
                  {found.map((id) => (
                    <li key={id}>{deck.byId.get(id)!.name}</li>
                  ))}
                </ul>
              )}
            </>
          )}
          {done && (
            <Verdict
              res={done}
              title={
                done === 'ok'
                  ? L('¡Todos, sin fallos!', 'All of them, no misses!')
                  : done === 'warn'
                    ? misses
                      ? L(`Todos, con ${misses} ${misses === 1 ? 'fallo' : 'fallos'}`, `All of them, with ${misses} ${misses === 1 ? 'miss' : 'misses'}`)
                      : L('Todos, con pista', 'All of them, with a hint')
                    : left.length
                      ? L(`Faltaban ${left.length}`, `${left.length} were missing`)
                      : L('Demasiados fallos', 'Too many misses')
              }
              item={item}
              wiki={cfg.opts.wiki}
            >
              <p className="q-how">
                {L('Limita con:', 'It borders:')} <b>{item!.nb.map((id) => deck.byId.get(id)?.name ?? id).join(', ')}</b>
                {left.length > 0 && left.length < total ? ` · ${L('en naranja, los que faltaban', 'in orange, the ones that were missing')}` : ''}
              </p>
            </Verdict>
          )}
          <div className="q-actions">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={next} autoFocus>
                {L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={giveHint}>
                  <Lightbulb size={15} aria-hidden="true" />
                  {hint ? L('Otra letra', 'Another letter') : L('Pista', 'Hint')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => settle('bad')}>
                  <Eye size={15} aria-hidden="true" />
                  {L('Ver la respuesta', 'Show the answer')}
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
