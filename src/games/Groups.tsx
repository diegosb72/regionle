/**
 * "Marca el grupo": the game names a set of pieces of the map (the provinces of a community, the
 * countries of the European Union, what borders a piece) and the player marks them on it, all of them
 * and nothing else, then asks for them to be checked. See lib/sets.ts for what the sets are.
 */
import { ArrowRight, Check, Eraser, Flag as FlagIcon, MousePointerClick } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { seedOf } from '../lib/challenge';
import { L } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { dealSets, judgeSet, setsOf, type Places, type SetVerdict } from '../lib/sets';
import { useStore } from '../lib/store';
import { mulberry32, nf } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, useElapsed, type GameProps, type ResultRow } from './common';

/** "A, B y C", as a sentence lists them. */
const listed = (names: string[]): string => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} ${L('y', 'and')} ${names[names.length - 1]}`);
/** Names beyond this many are counted, not listed: the map shows them all. */
const NAMED = 8;

export function GroupGame({ deck, cfg, onExit, onAgain, places }: GameProps & { places?: Places }) {
  const { opts } = cfg;
  const sets = useMemo(() => {
    const all = setsOf(deck, places);
    return dealSets(all, typeof opts.length === 'number' ? opts.length : all.length, mulberry32(seedOf(cfg)));
  }, [deck, places, cfg, opts.length]);

  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string[]>([]);
  const [verdict, setVerdict] = useState<SetVerdict | null>(null);
  const [results, setResults] = useState<Res[]>([]);
  /** What went wrong with each piece, for the list at the end: the sets it was missing from or did not belong to. */
  const [slips, setSlips] = useState<{ id: string; set: string; missed: boolean }[]>([]);
  const [marked, setMarked] = useState({ right: 0, of: 0 });
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [stopped, setStopped] = useState(false);
  const map = useRef<MapHandle>(null);
  const addSession = useStore((s) => s.addSession);

  const ended = stopped || at >= sets.length;
  const ms = useElapsed(!ended);
  const set = !ended ? sets[at] : null;
  const fem = deck.noun.fem;
  const title = MODE_NAME.group;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __set?: unknown }).__set = set;

  // A set told by a piece is looked for around it; any other, on the whole map.
  useEffect(() => {
    if (!set) return;
    if (set.anchor) map.current?.focus([set.anchor, ...set.members], { fill: 0.7, force: true });
    else map.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  // Once checked, everything the answer is about comes into view.
  useEffect(() => {
    if (set && verdict) map.current?.focus([...set.members, ...verdict.extra, ...(set.anchor ? [set.anchor] : [])], { fill: 0.8 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict]);

  useEffect(() => {
    if (!ended || !results.length) return;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: deck.title,
      total: results.length,
      ok: results.filter((r) => r === 'ok').length,
      warn: results.filter((r) => r === 'warn').length,
      bad: results.filter((r) => r === 'bad').length,
      ms,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const toggle = (id: string) => {
    if (!set || verdict || id === set.anchor) return;
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const check = () => {
    if (!set || verdict || !picked.length) return;
    const v = judgeSet(set.members, picked);
    setVerdict(v);
    setResults((r) => [...r, v.res]);
    setSlips((s) => [...s, ...v.missed.map((id) => ({ id, set: set.name, missed: true })), ...v.extra.map((id) => ({ id, set: set.name, missed: false }))]);
    setMarked((m) => ({ right: m.right + v.right.length, of: m.of + set.members.length }));
    const run = v.res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBest((b) => Math.max(b, run));
  };

  const next = () => {
    setAt((n) => n + 1);
    setPicked([]);
    setVerdict(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || e.ctrlKey || e.metaKey || e.altKey || e.key !== 'Enter') return;
      // On the map, Enter marks the piece under the cursor; on a button, it presses it.
      if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea, summary, .map-svg')) return;
      e.preventDefault();
      if (verdict) next();
      else check();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (!set) return p;
    if (verdict) {
      for (const id of verdict.right) p[id] = 'ok';
      // Yellow for what was missing and red for what was not in the set: two different slips, told apart at a glance.
      for (const id of verdict.missed) p[id] = 'warn';
      for (const id of verdict.extra) p[id] = 'bad';
    } else for (const id of picked) p[id] = 'sel';
    if (set.anchor) p[set.anchor] = 'from';
    return p;
  }, [set, verdict, picked]);
  const labels = useMemo(() => (ended ? ('all' as const) : new Set(set && verdict ? [...set.members, ...verdict.extra] : [])), [ended, set, verdict]);
  const pinned = useMemo(() => (set?.anchor ? new Set([set.anchor]) : undefined), [set]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      pickable={!!set && !verdict}
      onPick={toggle}
      labels={labels}
      pinned={pinned}
      // No names while a set is being marked: they would say which pieces are which.
      tip={(id) => (ended || verdict || id === set?.anchor ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
    // A piece that went wrong in several sets is one row that says them all.
    const byPiece = new Map<string, string[]>();
    for (const s of slips) byPiece.set(s.id, [...(byPiece.get(s.id) ?? []), s.missed ? L(`faltaba en ${s.set}`, `missing from ${s.set}`) : L(`sobraba en ${s.set}`, `not in ${s.set}`)]);
    const rows: ResultRow[] = [...byPiece].map(([id, notes]) => ({ item: deck.byId.get(id)!, res: 'bad' as const, note: [...new Set(notes)].join(' · ') }));
    const counts = { ok: results.filter((r) => r === 'ok').length, warn: results.filter((r) => r === 'warn').length, bad: results.filter((r) => r === 'bad').length };
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={!results.length ? L('Sin grupos', 'No groups') : counts.ok === results.length ? L('¡Todos los grupos!', 'Every group!') : L('Partida terminada', 'Game over')}
            note={
              !sets.length
                ? deck.scope === 'cities'
                  ? L('Aquí no hay grupos que marcar: elige varios países, o uno que tenga regiones en el juego.', 'There are no groups to mark here: choose several countries, or one that has regions in the game.')
                  : L('Aquí no hay grupos que marcar: elige un mapa con más piezas.', 'There are no groups to mark here: choose a map with more pieces.')
                : results.length
                  ? L(
                      'Cuenta cada grupo: bien, si lo marcas entero y sin nada de más; casi, si en uno de cuatro o más te equivocas en una de cada cinco piezas como mucho.',
                      'Each group counts: right, when all of it is marked and nothing else; close, when in one of four or more you slip on one piece in five at most.',
                    )
                  : undefined
            }
            deck={deck}
            rows={rows}
            counts={counts}
            ms={ms}
            stats={results.length ? [{ label: L('Piezas bien marcadas', 'Pieces marked right'), value: `${nf(marked.right)} ${L('de', 'of')} ${nf(marked.of)}` }, { label: L('Mejor racha', 'Best streak'), value: best }] : undefined}
            again={sets.length > 0}
            onAgain={() => onAgain()}
            onExit={onExit}
          />
        }
      />
    );
  }

  const size = set!.members.length;
  const names = (ids: string[]) => ids.map((id) => deck.byId.get(id)!.name);
  const tell = (ids: string[]) => (ids.length > NAMED ? `${listed(names(ids.slice(0, NAMED - 1)).concat(L(`${nf(ids.length - NAMED + 1)} más`, `${nf(ids.length - NAMED + 1)} more`)))}` : listed(names(ids)));
  const last = at + 1 >= sets.length;

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={at / sets.length}
      hud={<Hud ms={ms} streak={streak} progress={`${at + 1} / ${sets.length}`} />}
      stage={stage}
      panel={
        <div className="q group">
          {/* The name stands by itself: said in a sentence, many would need "el", "la" or "las" before them. */}
          <div className="q-prompt">
            <p className="kicker">{set!.lead}</p>
            <h2 className="q-name">{set!.name}</h2>
            {set!.sub && <p className="q-sub">{set!.sub}</p>}
          </div>
          <div className="nb-count" role="status">
            <strong>
              {verdict ? verdict.right.length : picked.length} / {size}
            </strong>
            <span>{verdict ? L(fem ? 'bien marcadas' : 'bien marcados', 'marked right') : L(fem ? 'marcadas' : 'marcados', 'marked')}</span>
          </div>
          {!verdict && (
            <p className="q-note">
              <MousePointerClick size={15} aria-hidden="true" />{' '}
              {L(
                `Toca en el mapa cada ${fem ? 'una' : 'uno'}; otro toque ${fem ? 'la' : 'lo'} desmarca. Cuando ${fem ? 'las' : 'los'} tengas, comprueba.`,
                'Tap each one on the map; another tap unmarks it. When you have them, check.',
              )}
              {set!.anchor ? ` ${L(`${set!.name} es ${fem ? 'la' : 'el'} que está en color.`, `${set!.name} is the one in colour.`)}` : ''}
            </p>
          )}
          {verdict && (
            <Verdict
              res={verdict.res}
              title={
                verdict.res === 'ok'
                  ? L(`¡${fem ? 'Todas' : 'Todos'}, y nada de más!`, 'All of them, and nothing else!')
                  : verdict.res === 'warn'
                    ? L('Casi', 'Close')
                    : verdict.right.length
                      ? L(`${nf(verdict.right.length)} de ${nf(size)}`, `${nf(verdict.right.length)} of ${nf(size)}`)
                      : L(`${fem ? 'Ninguna' : 'Ninguno'} de ${nf(size)}`, `None of ${nf(size)}`)
              }
            >
              {verdict.missed.length > 0 && (
                <p className="facts group-missed t-warn">
                  <span className="dot" aria-hidden="true" /> {L(verdict.missed.length === 1 ? 'Faltaba' : 'Faltaban', 'Missing')}: <b>{tell(verdict.missed)}</b>
                </p>
              )}
              {verdict.extra.length > 0 && (
                <p className="facts group-extra t-bad">
                  <span className="dot" aria-hidden="true" /> {L(verdict.extra.length === 1 ? 'Sobraba' : 'Sobraban', 'Not in it')}: <b>{tell(verdict.extra)}</b>
                </p>
              )}
              {verdict.res === 'ok' && size <= NAMED && (
                <p className="facts">
                  <b>{listed(names(set!.members))}</b>
                </p>
              )}
            </Verdict>
          )}
          <div className="q-actions">
            {verdict ? (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-primary" onClick={check} disabled={!picked.length}>
                  <Check size={16} aria-hidden="true" />
                  {L('Comprobar', 'Check')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => setPicked([])} disabled={!picked.length}>
                  <Eraser size={15} aria-hidden="true" />
                  {L('Borrar marcas', 'Clear marks')}
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
