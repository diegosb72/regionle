/** Neighbours: one piece lights up and the player picks, on the map, every piece that shares a land border with it. */
import { ArrowRight, Eye, Flag as FlagIcon, MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { mulberry32, shuffle } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';

/** Wrong picks allowed before the answer is shown. */
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
  const map = useRef<MapHandle>(null);
  const record = useStore((s) => s.record);
  const addSession = useStore((s) => s.addSession);

  const ended = stopped || at >= order.length;
  const ms = useElapsed(!ended);
  const item = !ended ? deck.byId.get(order[at])! : null;
  const several = showsCountry(deck);
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = item?.id;
  const fem = deck.noun.fem;
  const many = deck.noun.many;

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
      label: deck.title,
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

  const onPick = (id: string) => {
    if (!item || done || id === item.id) return;
    const other = deck.byId.get(id);
    if (!other || found.includes(id)) return;
    if (item.nb.includes(id)) {
      const list = [...found, id];
      setFound(list);
      setNote(null);
      setFlash({ id, kind: 'ok', n: Date.now() });
      if (list.length === item.nb.length) settle(misses === 0 ? 'ok' : 'warn');
      return;
    }
    setFlash({ id, kind: 'bad', n: Date.now() });
    if (misses + 1 >= MISSES) {
      setMisses(misses + 1);
      settle('bad');
    } else {
      setMisses(misses + 1);
      setNote(
        item.sl.includes(id)
          ? L(`${other.name} está al otro lado del mar: solo cuentan las fronteras por tierra.`, `${other.name} lies across the sea: only land borders count.`)
          : L(`${other.name} no limita con ${item.name}.`, `${other.name} does not border ${item.name}.`),
      );
    }
  };

  const next = () => {
    setAt((n) => n + 1);
    setFound([]);
    setMisses(0);
    setDone(null);
    setNote(null);
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
  const title = MODE_NAME.neighbours;
  const stage = <MapView ref={map} deck={deck} paint={paint} pickable={!ended && !done} onPick={onPick} labels={labels} pinned={pinned} flash={flash} tip={(id) => (ended || done || found.includes(id) || id === item?.id ? deck.byId.get(id)?.name : null)} />;

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
            onAgain={() => onAgain({ only: cfg.only })}
            onReview={(ids) => onAgain({ only: ids })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const total = item!.nb.length;
  const missing = item!.nb.filter((id) => !found.includes(id)).map((id) => deck.byId.get(id)?.name ?? id);
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
            <span>{L(total === 1 ? 'vecino encontrado' : 'vecinos encontrados', total === 1 ? 'neighbour found' : 'neighbours found')}</span>
            <span className="nb-lives" aria-label={L(`Fallos: ${misses} de ${MISSES}`, `Misses: ${misses} of ${MISSES}`)}>
              {Array.from({ length: MISSES }, (_, i) => (
                <i key={i} className={i < misses ? 'off' : undefined} />
              ))}
            </span>
          </div>
          {!done && (
            <p className="q-how">
              <MapPin size={15} aria-hidden="true" /> {L('Haz clic en cada vecino. Solo cuentan las fronteras por tierra; al tercer fallo se muestra la respuesta.', 'Click each neighbour. Only land borders count; the third miss shows the answer.')}
            </p>
          )}
          {!done && note && (
            <p className="q-note" role="status">
              {note}
            </p>
          )}
          {done && (
            <Verdict
              res={done}
              title={
                done === 'ok'
                  ? L('¡Todos, sin fallos!', 'All of them, no misses!')
                  : done === 'warn'
                    ? L(`Todos, con ${misses} ${misses === 1 ? 'fallo' : 'fallos'}`, `All of them, with ${misses} ${misses === 1 ? 'miss' : 'misses'}`)
                    : missing.length
                      ? L(`Faltaban ${missing.length}`, `${missing.length} were missing`)
                      : L('Demasiados fallos', 'Too many misses')
              }
              item={item}
              wiki={cfg.opts.wiki}
            >
              {missing.length > 0 && (
                <p className="q-how">
                  {L('En naranja:', 'In orange:')} <b>{missing.join(', ')}</b>
                </p>
              )}
            </Verdict>
          )}
          <div className="q-actions">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={next} autoFocus>
                {L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => settle('bad')}>
                <Eye size={15} aria-hidden="true" />
                {L('Ver la respuesta', 'Show the answer')}
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
