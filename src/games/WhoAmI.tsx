/**
 * "¿Quién soy?": a piece of the map speaks about itself, a clue at a time, and the player types its
 * name with as few clues as they can. A wrong name brings the next clue. See lib/riddle.ts for the clues.
 */
import { ArrowRight, Eye, Flag as FlagIcon, Keyboard, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { silhouette } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { CLUES_OK, cluesFor, judgeRiddle, riddlePoints, RIDDLE_POINTS, type Clue } from '../lib/riddle';
import type { Places } from '../lib/sets';
import { useStore } from '../lib/store';
import { Matcher, cx, mulberry32, nf, shortNote, shuffle } from '../lib/text';
import type { Item, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import './whoami.css';

/** One clue as it is read: its sentence, and the flag or the outline it speaks of. */
function ClueLine({ clue, item, n, fresh }: { clue: Clue; item: Item; n: number; fresh: boolean }) {
  const shape = useMemo(() => (clue.kind === 'shape' ? silhouette(item.geo, 120, 0.06) : ''), [clue.kind, item]);
  return (
    <li className={cx('clue', fresh && 'fresh')}>
      <span className="clue-n" aria-hidden="true">
        {n}
      </span>
      <span className="clue-text">{clue.text}</span>
      {clue.kind === 'flag' && <Flag code={clue.code} size="lg" className="clue-flag" />}
      {clue.kind === 'shape' && (
        <svg className="clue-shape" viewBox="0 0 120 120" role="img" aria-label={L('Su silueta', 'Its outline')}>
          <path d={shape} />
        </svg>
      )}
    </li>
  );
}

export function WhoAmIGame({ deck, cfg, onExit, onAgain, places }: GameProps & { places?: Places }) {
  const { opts } = cfg;
  const seed = seedOf(cfg);
  const order = useMemo(() => {
    const pool = deck.items.filter((it) => (!cfg.only || cfg.only.includes(it.id)) && cluesFor(it, deck, places, mulberry32(1)).length >= 2).map((it) => it.id);
    const list = shuffle(pool.sort(), mulberry32(seed));
    return typeof opts.length === 'number' && !cfg.only ? list.slice(0, opts.length) : list;
  }, [deck, cfg, places, seed, opts.length]);

  const [at, setAt] = useState(0);
  /** Clues in sight. */
  const [shown, setShown] = useState(1);
  /** Names given that were another piece. */
  const [wrong, setWrong] = useState<string[]>([]);
  const [done, setDone] = useState<Res | null>(null);
  const [results, setResults] = useState<{ id: string; res: Res; used: number; points: number }[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [stopped, setStopped] = useState(false);
  const map = useRef<MapHandle>(null);
  const answerBox = useRef<HTMLDivElement>(null);
  const addSession = useStore((s) => s.addSession);
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);

  // Each new clue pushes the box to type in further down: on a phone, out of the half of the screen the panel has.
  useEffect(() => {
    if (shown > 1) answerBox.current?.scrollIntoView({ block: 'nearest' });
  }, [shown]);

  const ended = stopped || at >= order.length;
  const ms = useElapsed(!ended);
  const item = !ended ? deck.byId.get(order[at])! : null;
  const clues = useMemo(() => (item ? cluesFor(item, deck, places, mulberry32(seed + at + 1)) : []), [item, deck, places, seed, at]);
  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const title = MODE_NAME.whoami;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = item?.id;

  // Each riddle starts on the whole map: where the last answer was says nothing about this one.
  useEffect(() => {
    if (item) map.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  useEffect(() => {
    if (item && done) map.current?.focus([item.id], { fill: 0.3 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  useEffect(() => {
    if (!ended || !results.length) return;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: cfg.list ? `${deck.title} · ${cfg.list}` : deck.title,
      total: results.length,
      ok: results.filter((r) => r.res === 'ok').length,
      warn: results.filter((r) => r.res === 'warn').length,
      bad: results.filter((r) => r.res === 'bad').length,
      ms,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const settle = (solved: boolean, used: number, misses: number) => {
    if (!item || done) return;
    const res = judgeRiddle(solved, used, misses);
    setDone(res);
    setNote(null);
    setResults((r) => [...r, { id: item.id, res, used, points: solved ? riddlePoints(used) : 0 }]);
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBest((b) => Math.max(b, run));
  };

  const more = () => {
    if (!item || done || shown >= clues.length) return;
    setShown((n) => n + 1);
    setNote(null);
  };

  const onSubmit = (text: string) => {
    if (!item || done) return;
    const ids = matcher.find(text);
    if (ids.includes(item.id)) return settle(true, shown, wrong.length);
    setShake((n) => n + 1);
    if (!ids.length) return setNote(matcher.vague(text) ? shortNote('vague', text) : L('No coincide con nada de este mapa.', 'It matches nothing on this map.'));
    const other = deck.byId.get(ids[0])!;
    if (wrong.includes(other.id)) return setNote(L(`${other.name}: ya has probado con ${fem ? 'esa' : 'ese'}.`, `${other.name}: you have tried that one already.`));
    const list = [...wrong, other.id];
    setWrong(list);
    setClear((n) => n + 1);
    // A wrong name brings the next clue; with every clue in sight, it is the end.
    if (shown >= clues.length) return settle(false, shown, list.length);
    setShown((n) => n + 1);
    setNote(L(`No soy ${other.name}. Ahí va otra pista.`, `I am not ${other.name}. Here is another clue.`));
  };

  const next = () => {
    setAt((n) => n + 1);
    setShown(1);
    setWrong([]);
    setDone(null);
    setNote(null);
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

  /** What the clues in sight name: a neighbour, the city it is measured from. */
  const named = useMemo(() => clues.slice(0, shown).flatMap((c) => (c.kind === 'text' && c.show ? [c.show] : [])), [clues, shown]);
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (!item) {
      for (const r of results) p[r.id] = r.res;
      return p;
    }
    for (const id of named) p[id] = 'near';
    if (done) p[item.id] = done;
    return p;
  }, [item, named, done, results]);
  const pinned = useMemo(() => new Set(item ? [...named, ...(done ? [item.id] : [])] : []), [item, named, done]);
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
      labels={ended ? 'all' : undefined}
      pinned={pinned}
      // No names while the riddle is open, but those the clues have said.
      tip={(id) => (ended || done || named.includes(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
    const rows: ResultRow[] = results.map((r) => ({
      item: deck.byId.get(r.id)!,
      res: r.res,
      note: r.points ? L(`con ${nf(r.used)} ${r.used === 1 ? 'pista' : 'pistas'} · ${nf(r.points)} ${r.points === 1 ? 'punto' : 'puntos'}`, `with ${nf(r.used)} ${r.used === 1 ? 'clue' : 'clues'} · ${nf(r.points)} ${r.points === 1 ? 'point' : 'points'}`) : L('sin adivinar', 'not guessed'),
    }));
    const points = results.reduce((a, r) => a + r.points, 0);
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={!rows.length ? L('Sin preguntas', 'No questions') : rows.every((r) => r.res === 'ok') ? L('¡Ni una se te resiste!', 'Not one got past you!') : L('Partida terminada', 'Game over')}
            note={
              !order.length
                ? L('De lo que hay en este mapa no sabemos lo bastante para dar pistas.', 'We do not know enough about what is on this map to give clues.')
                : rows.length
                  ? L(
                      `A la primera: con ${CLUES_OK} pistas o menos y sin dar un nombre equivocado. La primera pista vale ${RIDDLE_POINTS} puntos, y cada pista de más, uno menos.`,
                      `First time: with ${CLUES_OK} clues or fewer and no wrong name. The first clue is worth ${RIDDLE_POINTS} points, and each further clue one less.`,
                    )
                  : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={rows.length ? [{ label: L('Puntos', 'Points'), value: `${nf(points)} ${L('de', 'of')} ${nf(rows.length * RIDDLE_POINTS)}` }, { label: L('Mejor racha', 'Best streak'), value: best }] : undefined}
            again={order.length > 0}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const last = at + 1 >= order.length;
  const used = results[results.length - 1];
  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={at / order.length}
      hud={<Hud ms={ms} streak={streak} progress={`${at + 1} / ${order.length}`} />}
      stage={stage}
      panel={
        <div className="q whoami">
          <div className="q-prompt">
            <p className="kicker">{L(`¿Qué ${deck.noun.one} soy?`, `Which ${deck.noun.one} am I?`)}</p>
            <p className="whoami-count" role="status">
              {L(`Pista ${nf(Math.min(shown, clues.length))} de ${nf(clues.length)}`, `Clue ${nf(Math.min(shown, clues.length))} of ${nf(clues.length)}`)}
              {!done && <b>{L(` · vale ${nf(riddlePoints(shown))}`, ` · worth ${nf(riddlePoints(shown))}`)}</b>}
            </p>
          </div>
          <ol className="clues" aria-live="polite">
            {clues.slice(0, done ? clues.length : shown).map((c, i) => (
              <ClueLine key={c.id} clue={c} item={item!} n={i + 1} fresh={!done && i === shown - 1 && i > 0} />
            ))}
          </ol>
          {!done && (
            <div className="whoami-answer" ref={answerBox}>
              <AnswerInput label={L(`Nombre de ${fem ? 'la' : 'el'} ${deck.noun.one}`, `Name of the ${deck.noun.one}`)} placeholder={L('¿Quién soy?', 'Who am I?')} onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
              <p className="q-note" role="status">
                {note ?? (
                  <>
                    <Keyboard size={15} aria-hidden="true" />{' '}
                    {L('Escribe el nombre cuando creas saberlo. Un nombre equivocado trae la pista siguiente.', 'Type the name when you think you know it. A wrong name brings the next clue.')}
                  </>
                )}
              </p>
            </div>
          )}
          {done && (
            <Verdict
              res={done}
              item={item}
              wiki={opts.wiki}
              title={
                <>
                  {done === 'bad' ? L('Era', 'It was') : L('¡Eso es!', 'That is it!')} <b>{item!.name}</b>
                </>
              }
              lead={
                <p className="facts whoami-score">
                  {done === 'bad'
                    ? L('Sin puntos esta vez.', 'No points this time.')
                    : L(
                        `Con ${nf(used.used)} ${used.used === 1 ? 'pista' : 'pistas'}${wrong.length ? ` y ${nf(wrong.length)} ${wrong.length === 1 ? 'nombre equivocado' : 'nombres equivocados'}` : ''}: ${nf(used.points)} ${used.points === 1 ? 'punto' : 'puntos'}.`,
                        `With ${nf(used.used)} ${used.used === 1 ? 'clue' : 'clues'}${wrong.length ? ` and ${nf(wrong.length)} wrong ${wrong.length === 1 ? 'name' : 'names'}` : ''}: ${nf(used.points)} ${used.points === 1 ? 'point' : 'points'}.`,
                      )}
                </p>
              }
            />
          )}
          <div className="q-actions">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : (
              <>
                <button type="button" className="btn btn-sm" onClick={more} disabled={shown >= clues.length}>
                  <Lightbulb size={15} aria-hidden="true" />
                  {L('Otra pista', 'Another clue')}
                </button>
                <button type="button" className="btn btn-sm" onClick={() => settle(false, shown, wrong.length)}>
                  <Eye size={15} aria-hidden="true" />
                  {L('Me rindo', 'I give up')}
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
