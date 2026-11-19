/**
 * "Fronteras": a border lights up on a map without names and the player says which two pieces it lies
 * between, choosing among four borders or typing the two names. See lib/borders.ts for where the borders
 * come from and which ones are asked.
 */
import { ArrowRight, Eye, Flag as FlagIcon, Keyboard, Lightbulb } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint, type Trace } from '../components/MapView';
import { LinkPill } from '../components/ui';
import { askable, borderOptions, borderPoints, bordersOf, isBorderId, type Border } from '../lib/borders';
import { seedOf } from '../lib/challenge';
import { L, getLang, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, cx, hintMax, letterHint, mulberry32, shortNote, shuffle } from '../lib/text';
import type { Item, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import './borders.css';

/** Wrong names allowed, when typing, before the answer is shown. */
const MISSES = 3;
/** Pixels across that a border is given on screen, at the least, while it is asked. */
const LEGIBLE = 44;

export function BorderGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  const typing = opts.answer === 'type';
  const all = useMemo(() => bordersOf(deck.items).filter(askable), [deck]);
  const game = useMemo(() => {
    const seed = seedOf(cfg);
    // A repeat names the borders that were missed; a custom list, the pieces: there, the borders among them.
    const named = cfg.only?.filter(isBorderId);
    const pieces = cfg.only && !named?.length ? new Set(cfg.only) : null;
    const pool = named?.length ? all.filter((b) => named.includes(b.id)) : pieces ? all.filter((b) => pieces.has(b.a) && pieces.has(b.b)) : all;
    const list = shuffle([...pool], mulberry32(seed));
    const order = typeof opts.length === 'number' && !cfg.only ? list.slice(0, opts.length) : list;
    const rand = mulberry32(seed + 1);
    return { order, options: order.map((b) => borderOptions(b, all, rand)) };
  }, [all, cfg, opts.length]);
  const { order } = game;

  const [at, setAt] = useState(0);
  /** Choosing: the border that was picked. */
  const [picked, setPicked] = useState<string | null>(null);
  /** Typing: the sides named so far, the wrong names given, and the side a hint is spelling out. */
  const [found, setFound] = useState<string[]>([]);
  const [misses, setMisses] = useState(0);
  const [hint, setHint] = useState<{ id: string; shown: number } | null>(null);
  const [helped, setHelped] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [done, setDone] = useState<Res | null>(null);
  const [results, setResults] = useState<Res[]>([]);
  const [streak, setStreak] = useState(0);
  const [best, setBest] = useState(0);
  const [stopped, setStopped] = useState(false);
  const map = useRef<MapHandle>(null);
  const addSession = useStore((s) => s.addSession);
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);

  const ended = stopped || at >= order.length;
  const ms = useElapsed(!ended);
  const border = !ended ? order[at] : null;
  const sides = useMemo(() => (border ? sidesOf(border) : null), [border]);
  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const many = deck.noun.many;
  const title = MODE_NAME.border;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = border?.id;

  /** The two pieces of a border, in the order of their names: the same order wherever they are written. */
  function sidesOf(b: Border): [Item, Item] {
    const x = deck.byId.get(b.a)!;
    const y = deck.byId.get(b.b)!;
    return x.name.localeCompare(y.name, getLang()) <= 0 ? [x, y] : [y, x];
  }
  const pair = (b: Border) => sidesOf(b).map((it) => it.name).join(' – ');

  // The map goes to each border: its two sides whole, or closer when the border would be too short to make out.
  useEffect(() => {
    if (border) map.current?.focus([border.a, border.b], { fill: 0.85, force: true, legible: { points: borderPoints(border), px: LEGIBLE } });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [at]);
  // Once answered, both sides have to be in sight whole, with their names: a large one is named far from its borders.
  useEffect(() => {
    if (border && done) map.current?.focus([border.a, border.b], { fill: 0.85 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  // At the end, the whole map again, with every name.
  useEffect(() => {
    if (ended) map.current?.reset();
  }, [ended]);

  useEffect(() => {
    if (!ended || !results.length) return;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: cfg.list ? `${deck.title} · ${cfg.list}` : deck.title,
      total: results.length,
      ok: results.filter((r) => r === 'ok').length,
      warn: results.filter((r) => r === 'warn').length,
      bad: results.filter((r) => r === 'bad').length,
      ms,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const settle = (res: Res) => {
    if (!border || done) return;
    setDone(res);
    setNote(null);
    setResults((r) => [...r, res]);
    const run = res === 'ok' ? streak + 1 : 0;
    setStreak(run);
    setBest((b) => Math.max(b, run));
  };

  const choose = (id: string) => {
    if (!border || done) return;
    setPicked(id);
    settle(id === border.id ? 'ok' : 'bad');
  };

  /** Every name is sent with Enter and judged: one taken as soon as it is complete would say for free that it is a side. */
  const onSubmit = (text: string) => {
    if (!border || done) return;
    const ids = matcher.find(text);
    const hit = ids.find((id) => (id === border.a || id === border.b) && !found.includes(id));
    // The hint spells a side out letter by letter, and its initials with it: that one is written in full.
    const spelt = !!hit && hint?.id === hit && matcher.abbreviates(text, hit);
    if (hit && !spelt) {
      const list = [...found, hit];
      setFound(list);
      setNote(null);
      setClear((n) => n + 1);
      if (hint?.id === hit) setHint(null);
      if (list.length === 2) settle(misses === 0 && !helped ? 'ok' : 'warn');
      return;
    }
    setShake((n) => n + 1);
    if (spelt) return setNote(shortNote('short', text));
    if (!ids.length) return setNote(matcher.vague(text) ? shortNote('vague', text) : L('No coincide con nada de este mapa.', 'It matches nothing on this map.'));
    const other = deck.byId.get(ids[0])!;
    if (found.includes(other.id)) return setNote(L(`${other.name}: ya ${fem ? 'la' : 'lo'} tienes.`, `${other.name}: you already have it.`));
    const n = misses + 1;
    setMisses(n);
    setClear((c) => c + 1);
    if (n >= MISSES) settle('bad');
    else setNote(L(`${other.name} no está a ningún lado de esta frontera.`, `${other.name} is on neither side of this border.`));
  };

  const giveHint = () => {
    if (!border || done) return;
    const left = [border.a, border.b].filter((id) => !found.includes(id));
    if (!left.length) return;
    setHelped(true);
    setNote(null);
    const id = hint && left.includes(hint.id) ? hint.id : left[Math.floor(Math.random() * left.length)];
    const name = deck.byId.get(id)!.name;
    setHint({ id, shown: Math.min(hintMax(name), hint?.id === id ? hint.shown + 1 : 1) });
  };

  const next = () => {
    setAt((n) => n + 1);
    setPicked(null);
    setFound([]);
    setMisses(0);
    setHint(null);
    setHelped(false);
    setDone(null);
    setNote(null);
    setClear((n) => n + 1);
  };

  const options = border ? game.options[at] : [];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (done) {
        if ((e.key === 'Enter' || e.key === ' ') && !(e.target instanceof Element && e.target.closest('button, a, summary'))) {
          e.preventDefault();
          next();
        }
        return;
      }
      if (!typing && e.key >= '1' && e.key <= String(options.length)) choose(options[Number(e.key) - 1].id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** What may be named: both sides once the border is settled, and a side as soon as it is typed. */
  const known = useMemo(() => new Set(border ? (done ? [border.a, border.b] : found) : []), [border, done, found]);
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (!border) return p;
    for (const id of found) p[id] = 'ok';
    if (done) for (const id of [border.a, border.b]) if (!found.includes(id)) p[id] = done === 'ok' ? 'ok' : 'target';
    return p;
  }, [border, found, done]);
  const traces = useMemo<Trace[] | undefined>(() => (border ? [{ geo: border.geo, st: done ?? 'ask' }] : undefined), [border, done]);
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
      pinned={known.size ? known : undefined}
      traces={traces}
      // No names while a border is open, but those of the sides already given.
      tip={(id) => (ended || known.has(id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
    const asked = order.slice(0, results.length);
    const rows: ResultRow[] = asked.map((b, i) => {
      const [x, y] = sidesOf(b);
      // Written as the options are: «Albania – Montenegro».
      return { item: x, res: results[i], note: `– ${y.name}` };
    });
    const missed = asked.filter((_, i) => results[i] !== 'ok').map((b) => b.id);
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={!rows.length ? L('Sin preguntas', 'No questions') : rows.every((r) => r.res === 'ok') ? L('¡Todas las fronteras!', 'Every border!') : L('Partida terminada', 'Game over')}
            note={
              !order.length
                ? cfg.only
                  ? L(`Entre ${fem ? 'las' : 'los'} ${many} de esta lista no hay fronteras que preguntar.`, `There are no borders to ask among the ${many} on this list.`)
                  : L(
                      `En este mapa no hay fronteras que preguntar: hacen falta ${many} que se toquen. En un mapa de varios países solo cuentan las fronteras de dentro de cada uno.`,
                      `There are no borders to ask on this map: it takes ${many} that touch. On a map of several countries only the borders inside each one count.`,
                    )
                : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={rows.length ? [{ label: L('Mejor racha', 'Best streak'), value: best }] : undefined}
            again={order.length > 0}
            onAgain={() => onAgain({ only: cfg.list ? cfg.only : undefined, list: cfg.list })}
            // The repeat is of the borders that were missed, not of their pieces.
            onReview={() => onAgain({ only: missed, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }

  const [first, second] = sides!;
  const last = at + 1 >= order.length;
  /** Where to read about a border between two countries: they have articles of their own. */
  const article =
    deck.scope === 'countries'
      ? L(`Frontera entre ${first.name} y ${second.name}`, `${first.en}–${second.en} border`)
      : null;

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={at / order.length}
      hud={<Hud ms={ms} streak={streak} progress={`${at + 1} / ${order.length}`} />}
      stage={stage}
      panel={
        <div className="q border">
          <div className="q-prompt">
            <p className="kicker">{L('La frontera marcada', 'The border marked')}</p>
            <h2 className="q-ask">{L(`¿Qué dos ${many} separa?`, `Which two ${many} does it lie between?`)}</h2>
          </div>

          {typing ? (
            <>
              <div className="border-sides" role="status" aria-label={L('Lados dados', 'Sides given')}>
                {[0, 1].map((i) => {
                  const id = done ? [first.id, second.id][i] : found[i];
                  const it = id ? deck.byId.get(id)! : null;
                  return (
                    <span key={i} className={cx('border-side', it && (found.includes(it.id) ? 'got' : 'shown'))}>
                      {it ? it.name : '?'}
                    </span>
                  );
                })}
                <span className="nb-lives" aria-label={L(`Fallos: ${misses} de ${MISSES}`, `Misses: ${misses} of ${MISSES}`)}>
                  {Array.from({ length: MISSES }, (_, i) => (
                    <i key={i} className={i < misses ? 'off' : undefined} />
                  ))}
                </span>
              </div>
              {!done && (
                <>
                  <AnswerInput
                    label={L(`Nombre de ${fem ? 'una' : 'uno'} de ${fem ? 'las' : 'los'} dos ${many}`, `Name of one of the two ${many}`)}
                    placeholder={found.length ? L('Y al otro lado…', 'And on the other side…') : L('A un lado…', 'On one side…')}
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
                        {L('Escribe los dos nombres, uno a uno y en cualquier orden, y pulsa Intro tras cada uno. Al tercer fallo se muestra la respuesta.', 'Type the two names, one at a time and in any order, and press Enter after each. The third miss shows the answer.')}
                      </>
                    )}
                  </p>
                </>
              )}
            </>
          ) : (
            <div className="choices border-choices">
              {options.map((o, i) => (
                <button key={o.id} type="button" className={cx('choice', done && o.id === border!.id && 'right', picked === o.id && o.id !== border!.id && 'wrong')} disabled={!!done} onClick={() => choose(o.id)}>
                  <kbd>{i + 1}</kbd>
                  <span>{pair(o)}</span>
                </button>
              ))}
            </div>
          )}

          {done && (
            <Verdict
              res={done}
              title={
                done === 'ok' ? (
                  L('¡Eso es!', 'That is it!')
                ) : done === 'warn' ? (
                  misses ? (
                    L(`${fem ? 'Las' : 'Los'} dos, con ${misses} ${misses === 1 ? 'fallo' : 'fallos'}`, `Both, with ${misses} ${misses === 1 ? 'miss' : 'misses'}`)
                  ) : (
                    L(`${fem ? 'Las' : 'Los'} dos, con pista`, 'Both, with a hint')
                  )
                ) : !typing ? (
                  L('No era esa', 'Not that one')
                ) : misses >= MISSES ? (
                  L('Tres fallos', 'Three misses')
                ) : (
                  L('La respuesta', 'The answer')
                )
              }
              lead={
                <p className="facts border-answer">
                  {L('Es la frontera entre', 'It is the border between')} <b>{first.name}</b> {L('y', 'and')} <b>{second.name}</b>.
                </p>
              }
            >
              {article && (
                <div className="links">
                  <LinkPill
                    link={{
                      kind: 'wiki',
                      label: 'Wikipedia',
                      title: L(`Buscar «${article}» en Wikipedia`, `Search Wikipedia for “${article}”`),
                      href: `https://${getLang()}.wikipedia.org/w/index.php?search=${encodeURIComponent(article)}`,
                    }}
                  />
                </div>
              )}
            </Verdict>
          )}

          <div className="q-actions">
            {done ? (
              <button type="button" className="btn btn-primary" onClick={last ? () => setStopped(true) : next} autoFocus>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            ) : typing ? (
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
            ) : null}
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
