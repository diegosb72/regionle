/**
 * The odd one out: four of the countries chosen, three of which share what the question says. A game with
 * no map, like "true or false", in a file of its own that is fetched when it is played.
 */
import { ArrowRight, Flag as FlagIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Flag } from '../components/ui';
import { L, nm } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { makeOddOne, type OddOne } from '../lib/oddone';
import { TRUE_FALSE_ROUND } from '../lib/pace';
import type { StatementWorld } from '../lib/statements';
import { useStore, type GameConfig } from '../lib/store';
import { cx, nf } from '../lib/text';
import type { Country } from '../lib/types';
import { GameShell, Hud, Results, Verdict, useElapsed } from './common';
import './oddOne.css';

/** A right answer leaves this long to read why before the next question comes: it tells what the three share. */
const READ_MS = 2200;

export function OddOneGame({ countries, world, cfg, onExit }: { countries: Country[]; world: StatementWorld; cfg: GameConfig; onExit(): void }) {
  const title = modeNameIn(cfg.section, 'oddone');
  const what = `${nf(countries.length)} ${L('países', 'countries')}`;
  const total = cfg.opts.length === 'endless' ? Infinity : cfg.opts.length === 'all' ? TRUE_FALSE_ROUND : cfg.opts.length;
  /** Questions already asked in this game: none comes up twice while there are others to ask. */
  const seen = useRef(new Set<string>());
  const draw = (): OddOne | null => {
    let q = makeOddOne(countries, world, Math.random, seen.current);
    if (!q && seen.current.size) {
      // Everything has been asked: the round starts over.
      seen.current.clear();
      q = makeOddOne(countries, world, Math.random, seen.current);
    }
    if (q) seen.current.add(q.key);
    return q;
  };
  const [q, setQ] = useState<OddOne | null>(draw);
  const [picked, setPicked] = useState<string | null>(null);
  const [log, setLog] = useState<{ q: OddOne; picked: string; ok: boolean }[]>([]);
  const [ended, setEnded] = useState(false);
  const addSession = useStore((s) => s.addSession);
  const ms = useElapsed(!ended);
  const hits = log.filter((l) => l.ok).length;
  let streak = 0;
  for (let i = log.length - 1; i >= 0 && log[i].ok; i--) streak++;
  const name = (id: string): string => {
    const c = world.byId.get(id);
    return c ? nm(c.n) : id;
  };

  const finish = (all = log) => {
    const ok = all.filter((l) => l.ok).length;
    if (all.length) addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: what, total: all.length, ok, warn: 0, bad: all.length - ok, ms });
    setEnded(true);
  };

  const answer = (id: string) => {
    if (!q || picked != null || ended) return;
    setPicked(id);
    setLog((l) => [...l, { q, picked: id, ok: id === q.odd }]);
  };

  const next = () => {
    if (picked == null) return;
    if (log.length >= total) return finish();
    const fresh = draw();
    if (!fresh) return finish();
    setQ(fresh);
    setPicked(null);
  };

  // A right answer moves on by itself; a wrong one waits to be read.
  useEffect(() => {
    if (picked == null || !q || picked !== q.odd || ended) return;
    const t = setTimeout(next, READ_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked, q, ended]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !q || ended) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select')) return;
      if (picked == null && /^[1-4]$/.test(e.key)) answer(q.ids[Number(e.key) - 1]);
      else if (picked != null && (e.key === 'Enter' || e.key === ' ') && !(e.target instanceof Element && e.target.closest('button, a'))) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (ended || !q) {
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
              // Countries too much alike (all on one continent, all with a coast, all of a size) leave nothing to ask.
              note={!q && !log.length ? L('Con estos países no sale ninguna pregunta: elige más, o más distintos entre sí.', 'These countries leave nothing to ask: choose more of them, or less alike.') : undefined}
              again={q != null}
              onAgain={() => {
                seen.current.clear();
                setLog([]);
                setPicked(null);
                setQ(draw());
                setEnded(false);
              }}
              onExit={onExit}
            >
              {misses.length > 0 && (
                <section className="tf-review">
                  <h3>{L('Para repasar', 'To review')}</h3>
                  <ul>
                    {misses.map(({ q: m, picked: chose }) => (
                      <li key={m.key}>
                        <p className="tf-said">{m.text}</p>
                        <p className="tf-why">
                          <b>{L(`Era ${name(m.odd)}`, `It was ${name(m.odd)}`)}</b>
                          {L(`; elegiste ${name(chose)}.`, `; you chose ${name(chose)}.`)} {m.why}
                        </p>
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

  const right = picked != null && picked === q.odd;
  const asked = log.length + (picked == null ? 1 : 0);
  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={Number.isFinite(total) ? log.length / total : undefined}
      hud={<Hud ms={ms} streak={streak} progress={Number.isFinite(total) ? `${Math.min(asked, total)} / ${total}` : `${asked}`} />}
      panel={
        <div className="pop tf odd">
          <p className="kicker center">{L('¿Cuál es el intruso?', 'Which is the odd one out?')}</p>
          <h2 className="q-ask center tf-text">{q.text}</h2>
          <div className="odd-grid" role="group" aria-label={L('Los cuatro países', 'The four countries')}>
            {q.ids.map((id, i) => (
              <button
                key={id}
                type="button"
                className={cx('btn tf-btn odd-btn', picked === id && 'picked', picked != null && id === q.odd && 'right', picked === id && id !== q.odd && 'wrong')}
                disabled={picked != null}
                onClick={() => answer(id)}
              >
                <kbd aria-hidden="true">{i + 1}</kbd>
                <Flag code={world.byId.get(id)?.fl} size="lg" />
                <span className="odd-name">{name(id)}</span>
              </button>
            ))}
          </div>
          {picked != null && (
            <Verdict res={right ? 'ok' : 'bad'} title={right ? L('¡Correcto!', 'Correct!') : L(`Era ${name(q.odd)}.`, `It was ${name(q.odd)}.`)}>
              <p className="tf-why">{q.why}</p>
            </Verdict>
          )}
          <div className="q-actions center">
            {picked != null && (
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
