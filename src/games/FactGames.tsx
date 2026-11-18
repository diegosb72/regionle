/**
 * Games about what is known of the countries chosen, with no map: statements that are true or false, and
 * the first ten by a figure, typed from memory.
 */
import { ArrowRight, Check, Flag as FlagIcon, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { Flag } from '../components/ui';
import { metricOf, topOf, topSize, type Fig } from '../lib/figures';
import { L } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { TRUE_FALSE_ROUND } from '../lib/pace';
import { makeStatement, type Statement, type StatementWorld } from '../lib/statements';
import { useStore, type GameConfig } from '../lib/store';
import { Matcher, cx, nf, shortNote } from '../lib/text';
import type { Country, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, answered, useElapsed, type ResultRow } from './common';

// ---------------------------------------------------------------------------
// True or false
// ---------------------------------------------------------------------------

export function TrueFalseGame({ countries, world, cfg, onExit }: { countries: Country[]; world: StatementWorld; cfg: GameConfig; onExit(): void }) {
  const title = modeNameIn(cfg.section, 'truefalse');
  const what = `${nf(countries.length)} ${L('países', 'countries')}`;
  const total = cfg.opts.length === 'endless' ? Infinity : cfg.opts.length === 'all' ? TRUE_FALSE_ROUND : cfg.opts.length;
  /** Statements already made in this game: none comes up twice while there are others to make. */
  const seen = useRef(new Set<string>());
  const draw = (): Statement | null => {
    let st = makeStatement(countries, world, Math.random, seen.current);
    if (!st) {
      // Everything has been said: the round starts over.
      seen.current.clear();
      st = makeStatement(countries, world, Math.random, seen.current);
    }
    if (st) seen.current.add(st.key);
    return st;
  };
  const [st, setSt] = useState<Statement | null>(draw);
  const [said, setSaid] = useState<boolean | null>(null);
  const [log, setLog] = useState<{ st: Statement; ok: boolean }[]>([]);
  const [ended, setEnded] = useState(false);
  const addSession = useStore((s) => s.addSession);
  const ms = useElapsed(!ended);
  const hits = log.filter((l) => l.ok).length;
  let streak = 0;
  for (let i = log.length - 1; i >= 0 && log[i].ok; i--) streak++;
  const byId = world.byId;

  const finish = (all = log) => {
    const ok = all.filter((l) => l.ok).length;
    if (all.length) addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: what, total: all.length, ok, warn: 0, bad: all.length - ok, ms });
    setEnded(true);
  };

  const answer = (value: boolean) => {
    if (!st || said != null || ended) return;
    setSaid(value);
    setLog((l) => [...l, { st, ok: value === st.truth }]);
  };

  const next = () => {
    if (said == null) return;
    if (log.length >= total) return finish();
    const fresh = draw();
    if (!fresh) return finish();
    setSt(fresh);
    setSaid(null);
  };

  // A right answer moves on by itself; a wrong one waits to be read.
  useEffect(() => {
    if (said == null || !st || said !== st.truth || ended) return;
    const t = setTimeout(next, 1500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [said, st, ended]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      const k = e.key.toLowerCase();
      if (said == null && (k === 'v' || k === 't')) answer(true);
      else if (said == null && k === 'f') answer(false);
      else if (said != null && (e.key === 'Enter' || e.key === ' ') && !(e.target instanceof Element && e.target.closest('button, a'))) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (ended || !st) {
    const misses = log.filter((l) => !l.ok);
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        panel={
          <div className="pop">
            <Results
              title={!log.length ? L('Sin preguntas', 'No questions') : misses.length === 0 ? L('¡Todas bien!', 'All of them right!') : L('Partida terminada', 'Game over')}
              rows={[]}
              counts={{ ok: hits, warn: 0, bad: log.length - hits }}
              ms={ms}
              onAgain={() => {
                seen.current.clear();
                setLog([]);
                setSaid(null);
                setSt(draw());
                setEnded(false);
              }}
              onExit={onExit}
            >
              {misses.length > 0 && (
                <section className="tf-review">
                  <h3>{L('Para repasar', 'To review')}</h3>
                  <ul>
                    {misses.map(({ st: m }) => (
                      <li key={m.key}>
                        <p className="tf-said">
                          <span className={cx('tf-tag', m.truth ? 'true' : 'false')}>{m.truth ? L('Verdadero', 'True') : L('Falso', 'False')}</span> {m.text}
                        </p>
                        <p className="tf-why">{m.why}</p>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </Results>
          </div>
        }
      />
    );
  }

  const right = said != null && said === st.truth;
  const asked = log.length + (said == null ? 1 : 0);
  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={Number.isFinite(total) ? log.length / total : undefined}
      hud={<Hud ms={ms} streak={streak} progress={Number.isFinite(total) ? `${Math.min(asked, total)} / ${total}` : `${asked}`} />}
      panel={
        <div className="pop tf">
          <p className="kicker center">{L('¿Verdadero o falso?', 'True or false?')}</p>
          <div className="tf-flags" aria-hidden="true">
            {st.ids.map((id) => (
              <Flag key={id} code={byId.get(id)?.fl} size="lg" />
            ))}
          </div>
          <h2 className="q-ask center tf-text">{st.text}</h2>
          <div className="tf-buttons">
            <button type="button" className={cx('btn tf-btn tf-true', said === true && 'picked', said != null && st.truth && 'right', said === true && !st.truth && 'wrong')} disabled={said != null} onClick={() => answer(true)}>
              <Check size={18} aria-hidden="true" />
              {L('Verdadero', 'True')}
              <kbd>{L('V', 'T')}</kbd>
            </button>
            <button type="button" className={cx('btn tf-btn tf-false', said === false && 'picked', said != null && !st.truth && 'right', said === false && st.truth && 'wrong')} disabled={said != null} onClick={() => answer(false)}>
              <X size={18} aria-hidden="true" />
              {L('Falso', 'False')}
              <kbd>F</kbd>
            </button>
          </div>
          {said != null && (
            <Verdict res={right ? 'ok' : 'bad'} title={right ? L('¡Correcto!', 'Correct!') : st.truth ? L('Era verdadero.', 'It was true.') : L('Era falso.', 'It was false.')}>
              <p className="tf-why">{st.why}</p>
            </Verdict>
          )}
          <div className="q-actions center">
            {said != null && (
              <button type="button" className="btn btn-primary" onClick={next} autoFocus={!right}>
                {log.length >= total ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => finish()}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// The top ten
// ---------------------------------------------------------------------------

/** Wrong names allowed before the list is shown. */
export const TOP_STRIKES = 5;

export function TopTenGame({ figs, what, cfg, onExit, onAgain }: { figs: Fig[]; what: string; cfg: GameConfig; onExit(): void; onAgain(patch?: Partial<GameConfig>): void }) {
  const m = metricOf(figs[0].metric);
  const size = topSize(figs.length);
  const top = useMemo(() => topOf(figs, size), [figs, size]);
  /** Where each thing of the list stands, the first one at 1. */
  const rank = useMemo(() => new Map([...figs].sort((a, b) => b.value - a.value).map((f, i) => [f.id, i + 1])), [figs]);
  const matcher = useMemo(() => new Matcher(figs.map((f) => f.answers)), [figs]);
  const byId = useMemo(() => new Map(figs.map((f) => [f.id, f])), [figs]);
  const title = L(`Los ${size} primeros`, `The top ${size}`);
  const [found, setFound] = useState<string[]>([]);
  const [wrong, setWrong] = useState<Fig[]>([]);
  const [over, setOver] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const addSession = useStore((s) => s.addSession);
  const done = over || found.length === size || wrong.length >= TOP_STRIKES;
  const ms = useElapsed(!done);
  const foundSet = useMemo(() => new Set(found), [found]);
  const countries = cfg.section === 'pops';

  useEffect(() => {
    if (!done || (!found.length && !wrong.length)) return;
    addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: `${what} · ${m.noun}`, total: size, ok: found.length, warn: 0, bad: size - found.length, ms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done]);

  const onSubmit = (text: string) => {
    if (done) return;
    const id = matcher.find(text)[0];
    const f = id ? byId.get(id) : undefined;
    if (!f) {
      setShake((n) => n + 1);
      setNote(matcher.vague(text) ? shortNote('vague', text) : countries ? L('Ese país no está en tu selección.', 'That country is not in your selection.') : L('Eso no está en este mapa.', 'That is not on this map.'));
      return;
    }
    if (foundSet.has(f.id) || wrong.some((w) => w.id === f.id)) {
      setShake((n) => n + 1);
      setNote(L(`${f.name}: ya lo has dicho.`, `${f.name}: you have already said it.`));
      return;
    }
    setClear((n) => n + 1);
    const at = rank.get(f.id) ?? 0;
    if (at <= size) {
      setFound((l) => [...l, f.id]);
      setNote(null);
      answered('ok');
    } else {
      setWrong((l) => [...l, f]);
      setShake((n) => n + 1);
      setNote(L(`${f.name} no está entre los ${size} primeros: es el n.º ${at}.`, `${f.name} is not in the top ${size}: it is no. ${at}.`));
      answered(wrong.length + 1 >= TOP_STRIKES ? 'bad' : 'try');
    }
  };

  const suggest =
    cfg.opts.suggest && !done
      ? (text: string): Suggestion[] =>
          matcher
            .suggest(text, 6)
            .map((id) => byId.get(id)!)
            .map((x) => ({ id: x.id, label: x.name, sub: x.sub, icon: x.fl ? <Flag code={x.fl} size="sm" /> : undefined }))
      : undefined;

  const slots = (
    <ol className={cx('top-list', done && 'done')}>
      {top.map((f, i) => {
        const got = foundSet.has(f.id);
        return (
          <li key={f.id} className={cx(got ? 'got' : done ? 'missed' : 'open')}>
            <span className="top-n">{i + 1}</span>
            {got || done ? (
              <>
                {f.fl && <Flag code={f.fl} size="sm" />}
                <b>{f.name}</b>
                <span className="top-value">{m.short(f.value)}</span>
              </>
            ) : (
              <span className="top-blank" aria-label={L('Sin adivinar', 'Not guessed yet')} />
            )}
          </li>
        );
      })}
    </ol>
  );

  if (done) {
    const rows: ResultRow[] = top.map((f, i) => ({ item: f.item, res: (foundSet.has(f.id) ? 'ok' : 'bad') as Res, note: `${i + 1}.º · ${m.short(f.value)}` }));
    return (
      <GameShell
        title={title}
        subtitle={`${what} · ${m.noun}`}
        onExit={onExit}
        hud={<Hud ms={ms} progress={`${found.length} / ${size}`} />}
        panel={
          <div className="pop">
            <Results
              title={found.length === size ? L('¡Los tienes todos!', 'You got them all!') : wrong.length >= TOP_STRIKES ? L(`Cinco fallos: ${found.length} de ${size}`, `Five misses: ${found.length} of ${size}`) : L(`Te han faltado ${size - found.length}`, `You missed ${size - found.length}`)}
              rows={rows}
              ms={ms}
              focus={false}
              onAgain={() => onAgain()}
              onExit={onExit}
            >
              {slots}
            </Results>
          </div>
        }
      />
    );
  }

  return (
    <GameShell
      title={title}
      subtitle={`${what} · ${m.noun}`}
      onExit={onExit}
      progress={found.length / Math.max(1, size)}
      hud={
        <>
          <span className="hud-chip hud-main">{`${found.length} / ${size}`}</span>
          <span className="hud-chip hud-strikes" title={L('Fallos', 'Misses')} aria-label={L(`Fallos: ${wrong.length} de ${TOP_STRIKES}`, `Misses: ${wrong.length} of ${TOP_STRIKES}`)}>
            {Array.from({ length: TOP_STRIKES }, (_, i) => (
              <X key={i} size={13} strokeWidth={3} className={i < wrong.length ? 'on' : undefined} aria-hidden="true" />
            ))}
          </span>
        </>
      }
      panel={
        <div className="pop">
          <p className="kicker center">{L('De memoria', 'From memory')}</p>
          <h2 className="q-ask center">{L(`Los ${size} primeros, ${m.order}`, `The top ${size}, ${m.order}`)}</h2>
          <AnswerInput
            label={countries ? L('País', 'Country') : L('Nombre', 'Name')}
            placeholder={countries ? L('Escribe un país…', 'Type a country…') : L('Escribe un nombre…', 'Type a name…')}
            onSubmit={onSubmit}
            suggest={suggest}
            shake={shake}
            clear={clear}
          />
          <p className="q-note" role="status">
            {note ?? L(`En cualquier orden: cada acierto se coloca en su puesto. Con ${TOP_STRIKES} fallos se acaba.`, `In any order: each right one goes to its place. ${TOP_STRIKES} misses end the game.`)}
          </p>
          {slots}
          {wrong.length > 0 && (
            <ul className="top-wrong" aria-label={L('No están entre los primeros', 'Not in the top')}>
              {wrong.map((f) => (
                <li key={f.id}>
                  {f.name} <small>{L(`n.º ${rank.get(f.id)}`, `no. ${rank.get(f.id)}`)}</small>
                </li>
              ))}
            </ul>
          )}
          <div className="q-actions center">
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setOver(true)}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Me rindo', 'I give up')}
            </button>
          </div>
        </div>
      }
    />
  );
}
