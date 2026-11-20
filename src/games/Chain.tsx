/**
 * A chain of neighbours: the game gives a piece, the player names one that borders it, then one that
 * borders that one, and so on without going through any piece twice. The map shows no inner borders:
 * it is drawn as the chain grows. It ends in a dead end, at the third wrong name or when the player stops.
 */
import { Flag as FlagIcon, Keyboard, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { CHAIN_MISSES, longChain, reach, startOf, waysOn } from '../lib/chain';
import { seedOf } from '../lib/challenge';
import { countryAnswers, deckGraph, loadIndex } from '../lib/data';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, shortNote } from '../lib/matcher';
import { hintMax, letterHint, listed as listedWith, mulberry32, nf } from '../lib/text';
import type { Item } from '../lib/types';
import { GameShell, Hud, Results, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import './chain.css';

type End = 'all' | 'stuck' | 'out' | 'stopped';

/** "A, B y C", as a sentence lists them. */
const listed = (names: string[]): string => listedWith(names, L('y', 'and'));

export function ChainGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  /** Land borders only, as in "Vecinos": a sea crossing is not a border. */
  const graph = useMemo(() => deckGraph(deck, false), [deck]);
  const start = useMemo(() => startOf(graph, mulberry32(seedOf(cfg))), [graph, cfg]);
  /** A long chain from the same start, to have something to compare with at the end. */
  const model = useMemo(() => (start ? longChain(graph, start, mulberry32(seedOf(cfg) + 1)) : []), [graph, start, cfg]);
  const within = useMemo(() => (start ? reach(graph, start).size : 0), [graph, start]);
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);

  const [chain, setChain] = useState<string[]>(() => (start ? [start] : []));
  /** Links that were spelt out by a hint. */
  const [helped, setHelped] = useState<string[]>([]);
  /** Names that did not border the piece the chain stood on. */
  const [wrong, setWrong] = useState<{ id: string; from: string }[]>([]);
  const [end, setEnd] = useState<End | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [hint, setHint] = useState<{ id: string; shown: number } | null>(null);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  /** The record of the map before this chain, and whether this one beats it. */
  const [mark, setMark] = useState<{ before: number | null; beaten: boolean } | null>(null);
  /** Countries of the world that are not on this map: named so that the player knows why they do not count. */
  const [outside, setOutside] = useState<{ matcher: Matcher; names: Map<string, string> } | null>(null);
  const map = useRef<MapHandle>(null);
  const addSession = useStore((s) => s.addSession);
  const setBest = useStore((s) => s.setBest);

  const ms = useElapsed(!end && !!start);
  const last = chain.length ? deck.byId.get(chain[chain.length - 1])! : null;
  const open = useMemo(() => waysOn(graph, chain), [graph, chain]);
  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const many = deck.noun.many;
  const title = MODE_NAME.chain;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = end ? undefined : last?.id;

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

  // The map follows the chain. The zoom depends on the piece alone, so that the frame gives nothing away…
  useEffect(() => {
    if (last && !end) map.current?.focus([last.id], { fill: 0.3, force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chain.length]);
  // …and once it is over, the whole chain is brought into view, with where it could have gone on.
  useEffect(() => {
    if (end) map.current?.focus([...chain, ...open], { fill: 0.85, force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  useEffect(() => {
    if (!end) return;
    const links = chain.length - 1;
    const key = `chain:${deck.key}`;
    const before = useStore.getState().best[key] ?? null;
    // A chain that never left its start is no chain to keep.
    setMark({ before, beaten: links > 0 && setBest(key, chain.length) });
    if (links + wrong.length === 0) return;
    const warn = helped.length;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: deck.title,
      total: links + wrong.length,
      ok: links - warn,
      warn,
      bad: wrong.length,
      ms,
      note: `cadena de ${chain.length} desde ${deck.byId.get(chain[0])?.name}`,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end]);

  const accept = (id: string) => {
    const next = [...chain, id];
    if (hint?.id === id) setHelped((h) => [...h, id]);
    setChain(next);
    setHint(null);
    setNote(null);
    setClear((n) => n + 1);
    setFlash({ id, kind: 'ok', n: Date.now() });
    if (next.length >= within) setEnd('all');
    else if (!waysOn(graph, next).length) setEnd('stuck');
  };

  /** Every name is sent with Enter and judged: one taken as soon as it is complete would say for free that it is a neighbour. */
  const onSubmit = (text: string) => {
    if (!last || end) return;
    const ids = matcher.find(text);
    const hit = ids.find((id) => open.includes(id));
    // The hint spells a way on letter by letter, and its initials with it: that one is written in full.
    const spelt = !!hit && hint?.id === hit && matcher.abbreviates(text, hit);
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
    if (other.id === last.id) return setNote(L(`En ${other.name} está ahora la cadena.`, `${other.name} is where the chain stands now.`));
    if (chain.includes(other.id)) return setNote(L(`${other.name} ya está en la cadena: no se pasa dos veces por el mismo sitio.`, `${other.name} is in the chain already: nowhere is gone through twice.`));
    // A short sea crossing is a fair guess: it is explained, not punished.
    if (last.sl.includes(other.id)) return setNote(L(`${other.name} está al otro lado del mar: solo cuentan las fronteras por tierra.`, `${other.name} lies across the sea: only land borders count.`));
    const list = [...wrong, { id: other.id, from: last.id }];
    setWrong(list);
    const left = CHAIN_MISSES - list.length;
    if (left <= 0) return setEnd('out');
    setNote(L(`${other.name} no limita con ${last.name}. Te ${left === 1 ? 'queda 1 fallo' : `quedan ${left} fallos`}.`, `${other.name} does not border ${last.name}. You have ${left} ${left === 1 ? 'miss' : 'misses'} left.`));
  };

  const giveHint = () => {
    if (!last || end || !open.length) return;
    setNote(null);
    const id = hint && open.includes(hint.id) ? hint.id : open[Math.floor(Math.random() * open.length)];
    const name = deck.byId.get(id)!.name;
    setHint({ id, shown: Math.min(hintMax(name), hint?.id === id ? hint.shown + 1 : 1) });
  };

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    // Where the chain could have gone on, once it is over.
    if (end) for (const id of open) p[id] = 'target';
    for (const id of chain) p[id] = helped.includes(id) ? 'warn' : 'ok';
    if (last) p[last.id] = end ? 'from' : 'sel';
    return p;
  }, [chain, helped, last, end, open]);
  const labels = useMemo(() => new Set(end ? [...chain, ...open] : chain), [chain, end, open]);
  const pinned = useMemo(() => (last ? new Set([last.id]) : undefined), [last]);
  const suggest = useMemo(() => {
    if (!opts.suggest) return undefined;
    return (text: string): Suggestion[] =>
      matcher
        .suggest(text, 6)
        .map((id) => deck.byId.get(id))
        .filter((it): it is Item => !!it)
        .map((it) => ({ id: it.id, label: it.name, sub: several ? nm(it.country.n) : undefined }));
  }, [opts.suggest, matcher, deck, several]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      labels={labels}
      pinned={pinned}
      flash={flash}
      // No inner borders while the chain grows: seeing which pieces touch would be the answer.
      blind={!end}
      tip={(id) => (end || chain.includes(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (!start || !last) {
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        stage={<MapView deck={deck} labels="all" tip={(id) => deck.byId.get(id)?.name} />}
        panel={
          <div className="q">
            <div className="q-prompt">
              <p className="kicker">{title}</p>
              <h2 className="q-ask">{L('En este mapa nada se toca', 'Nothing touches on this map')}</h2>
            </div>
            <p className="q-note">
              {L(
                `Hacen falta ${many} que limiten por tierra entre sí. Añade más países o elige un nivel con más divisiones.`,
                `It takes ${many} that share a land border. Add more countries or choose a level with more divisions.`,
              )}
            </p>
            <div className="q-actions">
              <button type="button" className="btn btn-primary" onClick={onExit}>
                {L('Cambiar la selección', 'Change the selection')}
              </button>
            </div>
          </div>
        }
      />
    );
  }

  const first = deck.byId.get(chain[0])!;
  const size = chain.length;

  if (end) {
    const rows: ResultRow[] = chain.slice(1).map((id, i) => ({
      item: deck.byId.get(id)!,
      res: helped.includes(id) ? 'warn' : 'ok',
      note: L(`${nf(i + 2)}.º · desde ${deck.byId.get(chain[i])!.name}`, `No. ${nf(i + 2)} · from ${deck.byId.get(chain[i])!.name}`),
    }));
    // A name given wrongly from two places is one row that says both.
    const missed = new Map<string, string[]>();
    for (const w of wrong) missed.set(w.id, [...(missed.get(w.id) ?? []), deck.byId.get(w.from)!.name]);
    for (const [id, from] of missed) rows.push({ item: deck.byId.get(id)!, res: 'bad', note: L(`no limita con ${listed([...new Set(from)])}`, `does not border ${listed([...new Set(from)])}`) });
    const ways = open.map((id) => deck.byId.get(id)!.name);
    const heading = end === 'all' ? L('¡El mapa entero!', 'The whole map!') : end === 'stuck' ? L('Sin salida', 'Dead end') : end === 'out' ? L('Tres fallos', 'Three misses') : L('Te has plantado', 'You stopped');
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
              <>
                {size > 1
                  ? L(`Cadena de ${nf(size)}, de ${first.name} a ${last.name}.`, `A chain of ${nf(size)}, from ${first.name} to ${last.name}.`)
                  : L(`La cadena no ha salido de ${first.name}.`, `The chain never left ${first.name}.`)}{' '}
                {end === 'all'
                  ? L(`No queda por tierra ${fem ? 'ninguna' : 'ninguno'} por ${fem ? 'la' : 'el'} que no hayas pasado.`, `There is none left by land that you have not been through.`)
                  : end === 'stuck'
                    ? L(`${last.name} no limita con nada por donde no hayas pasado.`, `${last.name} borders nothing you have not been through.`)
                    : L(`Desde ${last.name} se podía seguir por ${listed(ways)}.`, `From ${last.name} it could go on to ${listed(ways)}.`)}{' '}
                {end !== 'all' &&
                  (model.length > size
                    ? L(`Desde ${first.name} hemos encontrado una de ${nf(model.length)}.`, `From ${first.name} we found one of ${nf(model.length)}.`)
                    : L(`Desde ${first.name} no hemos encontrado ninguna más larga.`, `From ${first.name} we found none longer.`))}
              </>
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={[
              { label: L('Cadena', 'Chain'), value: nf(size) },
              {
                label: L('Récord del mapa', 'Record of the map'),
                value: mark?.beaten ? (
                  <>
                    {nf(size)} <small className="c-ok">{L('¡nuevo!', 'new!')}</small>
                  </>
                ) : mark?.before != null ? (
                  nf(mark.before)
                ) : (
                  '—'
                ),
              },
            ]}
            againLabel={L('Otra cadena', 'Another chain')}
            onAgain={() => onAgain()}
            onExit={onExit}
          />
        }
      />
    );
  }

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={(size - 1) / Math.max(1, within - 1)}
      hud={<Hud ms={ms} progress={`${size} / ${within}`} />}
      stage={stage}
      panel={
        <div className="q chain">
          <div className="q-prompt">
            <p className="kicker">{size === 1 ? L('La cadena empieza en', 'The chain starts in') : L('La cadena va por', 'The chain has reached')}</p>
            <h2 className="q-name">{last.name}</h2>
            {several && (
              <p className="q-sub">
                <Flag code={last.country.fl} size="sm" /> {L(`${last.type} de ${nm(last.country.n)}`, `${last.type} in ${nm(last.country.n)}`)}
              </p>
            )}
          </div>
          <div className="nb-count" role="status">
            <strong>{open.length}</strong>
            <span>{L(open.length === 1 ? 'salida desde aquí' : 'salidas desde aquí', open.length === 1 ? 'way on from here' : 'ways on from here')}</span>
            <span className="nb-lives" aria-label={L(`Fallos: ${wrong.length} de ${CHAIN_MISSES}`, `Misses: ${wrong.length} of ${CHAIN_MISSES}`)}>
              {Array.from({ length: CHAIN_MISSES }, (_, i) => (
                <i key={i} className={i < wrong.length ? 'off' : undefined} />
              ))}
            </span>
          </div>
          <AnswerInput
            label={L(`Nombre de ${fem ? 'una' : 'un'} ${deck.noun.one} vecin${fem ? 'a' : 'o'}`, `Name of a neighbouring ${deck.noun.one}`)}
            placeholder={L('Siguiente eslabón…', 'Next link…')}
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
                {L(
                  `Escribe ${fem ? 'una' : 'un'} ${deck.noun.one} que limite por tierra con ${last.name} y por ${fem ? 'la' : 'el'} que no hayas pasado, y pulsa Intro. El mapa no enseña las fronteras: se dibuja con tu cadena.`,
                  `Type a ${deck.noun.one} that shares a land border with ${last.name} and that you have not been through, and press Enter. The map shows no borders: your chain draws it.`,
                )}
              </>
            )}
          </p>
          <div className="q-actions">
            <button type="button" className="btn btn-sm" onClick={giveHint}>
              <Lightbulb size={15} aria-hidden="true" />
              {hint ? L('Otra letra', 'Another letter') : L('Pista', 'Hint')}
            </button>
            <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => setEnd('stopped')}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Me planto', 'I stop here')}
            </button>
          </div>
          {/* The newest first: it is the one that matters, and a long chain would push it out of sight. */}
          <ol className="found chain-links" reversed aria-label={L('La cadena hasta ahora', 'The chain so far')}>
            {chain
              .map((id, i) => (
                <li key={id} className={id === last.id ? 'now' : undefined}>
                  <small>{i + 1}</small>
                  {deck.byId.get(id)!.name}
                  {helped.includes(id) && <Lightbulb size={12} aria-label={L('con pista', 'with a hint')} />}
                </li>
              ))
              .reverse()}
          </ol>
        </div>
      }
    />
  );
}
