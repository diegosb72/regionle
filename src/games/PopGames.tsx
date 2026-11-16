/** Figure games on population or area: higher or lower, rank five, exact figure and which country. */
import { ArrowDown, ArrowRight, ArrowUp, Check, Flag as FlagIcon, Lightbulb, X } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { Flag, Seg } from '../components/ui';
import { countryItem } from '../lib/data';
import { useStore, type GameConfig } from '../lib/store';
import { Matcher, cx, fmtArea, fmtPop, fmtShort, judgeAmount, nf, parseNumber, pick, sample, shuffle } from '../lib/text';
import type { Country, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, useElapsed, type ResultRow } from './common';

export interface PopProps {
  countries: Country[];
  cfg: GameConfig;
  onExit(): void;
  onAgain(patch?: Partial<GameConfig>): void;
}

interface Metric {
  id: 'pop' | 'area';
  of(c: Country): number;
  full(v: number): string;
  short(v: number): string;
  noun: string;
  more: string;
  less: string;
  units: { label: string; factor: number }[];
  defaultUnit: number;
}

const METRICS: Record<'pop' | 'area', Metric> = {
  pop: {
    id: 'pop',
    of: (c) => c.pop ?? 0,
    full: fmtPop,
    short: (v) => fmtShort(v),
    noun: 'población',
    more: 'Más habitantes',
    less: 'Menos habitantes',
    units: [
      { label: 'miles', factor: 1e3 },
      { label: 'millones', factor: 1e6 },
    ],
    defaultUnit: 1e6,
  },
  area: {
    id: 'area',
    of: (c) => c.ar,
    full: fmtArea,
    short: (v) => `${fmtShort(v)} km²`,
    noun: 'superficie',
    more: 'Más grande',
    less: 'Más pequeño',
    units: [
      { label: 'km²', factor: 1 },
      { label: 'miles de km²', factor: 1e3 },
      { label: 'millones de km²', factor: 1e6 },
    ],
    defaultUnit: 1e3,
  },
};

/** Number of questions: every country once, a fixed number, or no end. */
function questionsOf(length: GameConfig['opts']['length'], available: number): number {
  return length === 'endless' ? Infinity : length === 'all' ? available : Math.min(length, available);
}

function Frame({ title, cfg, countries, onExit, hud, progress, children }: { title: string; cfg: GameConfig; countries: Country[]; onExit(): void; hud?: ReactNode; progress?: number; children: ReactNode }) {
  return (
    <GameShell
      title={title}
      subtitle={`${nf(countries.length)} países · ${METRICS[cfg.opts.metric].noun}`}
      onExit={onExit}
      hud={hud}
      progress={progress}
      panel={<div className="pop">{children}</div>}
    />
  );
}

function CountryCard({ c, value, state, children }: { c: Country; value?: string; state?: 'right' | 'wrong'; children?: ReactNode }) {
  return (
    <div className={cx('pcard', state)}>
      <Flag code={c.fl} size="xl" />
      <h3>{c.n.es}</h3>
      {value != null && <p className="pcard-value">{value}</p>}
      {children}
    </div>
  );
}

function useSession(cfg: GameConfig, label: string) {
  const addSession = useStore((s) => s.addSession);
  return (count: { ok: number; warn: number; bad: number }, ms: number, note?: string) => {
    const total = count.ok + count.warn + count.bad;
    if (total) addSession({ t: Date.now(), section: 'pops', mode: cfg.mode, label, total, ...count, ms, note });
  };
}

// ---------------------------------------------------------------------------
// Higher or lower
// ---------------------------------------------------------------------------

function challenger(list: Country[], m: Metric, current: Country, streak: number, recent: string[]): Country {
  const base = m.of(current);
  const [lo, hi] = streak < 3 ? [1.4, Infinity] : streak < 8 ? [1.12, 15] : [1.03, 4];
  const free = list.filter((c) => c.id !== current.id && !recent.includes(c.id));
  const fit = free.filter((c) => {
    const r = Math.max(m.of(c) / base, base / m.of(c));
    return r >= lo && r <= hi;
  });
  return pick(fit.length ? fit : free.length ? free : list.filter((c) => c.id !== current.id));
}

function HiLo({ countries, cfg, onExit }: PopProps) {
  const m = METRICS[cfg.opts.metric];
  const [a, setA] = useState(() => pick(countries));
  const [b, setB] = useState(() => challenger(countries, m, a, 0, []));
  const [phase, setPhase] = useState<'ask' | 'show' | 'over'>('ask');
  const [guess, setGuess] = useState<'more' | 'less' | null>(null);
  const [log, setLog] = useState<{ a: Country; b: Country; ok: boolean }[]>([]);
  const [record, setRecord] = useState<{ best: number; isNew: boolean } | null>(null);
  const ms = useElapsed(phase !== 'over');
  const save = useSession(cfg, `Mayor o menor · ${m.noun}`);
  const streak = log.filter((l) => l.ok).length;
  const right = guess != null && (m.of(b) === m.of(a) || (guess === 'more') === m.of(b) > m.of(a));

  const answer = (g: 'more' | 'less') => {
    if (phase !== 'ask') return;
    setGuess(g);
    setPhase('show');
    const ok = m.of(b) === m.of(a) || (g === 'more') === m.of(b) > m.of(a);
    setLog((l) => [...l, { a, b, ok }]);
  };

  useEffect(() => {
    if (phase !== 'show') return;
    const t = setTimeout(
      () => {
        if (right) {
          const recent = log.slice(-10).flatMap((l) => [l.a.id, l.b.id]);
          setA(b);
          setB(challenger(countries, m, b, streak, recent));
          setGuess(null);
          setPhase('ask');
        } else {
          const st = useStore.getState();
          const prev = st.best[`hilo:${m.id}`] ?? 0;
          const isNew = st.setBest(`hilo:${m.id}`, streak) && streak > 0;
          setRecord({ best: Math.max(prev, streak), isNew });
          save({ ok: streak, warn: 0, bad: 1 }, ms, `Racha de ${streak}`);
          setPhase('over');
        }
      },
      right ? 1300 : 1900,
    );
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') answer('more');
      else if (e.key === 'ArrowDown') answer('less');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const again = () => {
    const first = pick(countries);
    setA(first);
    setB(challenger(countries, m, first, 0, []));
    setLog([]);
    setGuess(null);
    setRecord(null);
    setPhase('ask');
  };

  if (phase === 'over') {
    const miss = log[log.length - 1];
    return (
      <Frame title="Mayor o menor" cfg={cfg} countries={countries} onExit={onExit} hud={<Hud ms={ms} />}>
        <div className="results">
          <p className="kicker">Fin de la racha</p>
          <h2 className="results-title">
            {streak === 0 ? 'A la primera, no' : `${streak} ${streak === 1 ? 'acierto seguido' : 'aciertos seguidos'}`}
          </h2>
          <p className="results-note">
            {record?.isNew ? '¡Nuevo récord! ' : record ? `Tu récord: ${record.best}. ` : ''}
            {miss && (
              <>
                {miss.b.n.es} tiene {m.full(m.of(miss.b))}; {miss.a.n.es}, {m.full(m.of(miss.a))}.
              </>
            )}
          </p>
          <div className="results-actions">
            <button type="button" className="btn btn-primary" onClick={again} autoFocus>
              Otra racha
            </button>
            <button type="button" className="btn btn-ghost" onClick={onExit}>
              Cambiar de juego
            </button>
          </div>
          <ol className="hl-log">
            {log.map((l, i) => (
              <li key={i} className={l.ok ? 'hit' : 'miss'}>
                <Flag code={l.a.fl} size="sm" /> {l.a.n.es} <small>{m.short(m.of(l.a))}</small>
                <span className="vs">{m.of(l.b) > m.of(l.a) ? '<' : '>'}</span>
                <Flag code={l.b.fl} size="sm" /> {l.b.n.es} <small>{m.short(m.of(l.b))}</small>
              </li>
            ))}
          </ol>
        </div>
      </Frame>
    );
  }

  return (
    <Frame title="Mayor o menor" cfg={cfg} countries={countries} onExit={onExit} hud={<Hud ms={ms} streak={streak} progress={`Racha ${streak}`} />}>
      <p className="kicker center">¿Más o menos {m.id === 'pop' ? 'habitantes' : 'superficie'}?</p>
      <div className="hl">
        <CountryCard c={a} value={m.full(m.of(a))} />
        <div className="hl-vs" aria-hidden="true">
          vs
        </div>
        <CountryCard c={b} value={phase === 'show' ? m.full(m.of(b)) : '¿ ?'} state={phase === 'show' ? (right ? 'right' : 'wrong') : undefined}>
          <div className="hl-buttons">
            <button type="button" className={cx('btn', guess === 'more' && 'picked')} disabled={phase !== 'ask'} onClick={() => answer('more')}>
              <ArrowUp size={16} aria-hidden="true" />
              {m.more}
            </button>
            <button type="button" className={cx('btn', guess === 'less' && 'picked')} disabled={phase !== 'ask'} onClick={() => answer('less')}>
              <ArrowDown size={16} aria-hidden="true" />
              {m.less}
            </button>
          </div>
        </CountryCard>
      </div>
      <p className="hint-line">
        ¿{b.n.es} tiene {m.id === 'pop' ? 'más o menos habitantes' : 'más o menos superficie'} que {a.n.es}? También con las flechas ↑ ↓ del teclado.
      </p>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Rank five
// ---------------------------------------------------------------------------

function RankFive({ countries, cfg, onExit }: PopProps) {
  const m = METRICS[cfg.opts.metric];
  const size = Math.min(5, countries.length);
  const rounds = cfg.opts.length === 'endless' ? Infinity : cfg.opts.length === 'all' ? 10 : cfg.opts.length;
  const deal = () => sample(countries, size);
  const [five, setFive] = useState(deal);
  const [order, setOrder] = useState<string[]>([]);
  const [phase, setPhase] = useState<'ask' | 'show' | 'end'>('ask');
  const [count, setCount] = useState({ ok: 0, warn: 0, bad: 0 });
  const [points, setPoints] = useState(0);
  const round = count.ok + count.warn + count.bad;
  const ms = useElapsed(phase !== 'end');
  const save = useSession(cfg, `Ordena cinco · ${m.noun}`);
  const correct = useMemo(() => [...five].sort((x, y) => m.of(y) - m.of(x)), [five, m]);

  const toggle = (id: string) => {
    if (phase !== 'ask') return;
    setOrder((o) => (o.includes(id) ? o.filter((x) => x !== id) : [...o, id]));
  };

  const check = () => {
    const hits = correct.filter((c, i) => order[i] === c.id).length;
    const res: Res = hits === size ? 'ok' : hits >= size - 2 ? 'warn' : 'bad';
    setPoints((p) => p + hits);
    setCount((c) => ({ ...c, [res]: c[res] + 1 }));
    setPhase('show');
  };

  const next = () => {
    if (round >= rounds) return finish();
    setFive(deal());
    setOrder([]);
    setPhase('ask');
  };

  const finish = () => {
    save(count, ms, `${points} posiciones acertadas`);
    setPhase('end');
  };

  if (phase === 'end') {
    return (
      <Frame title="Ordena cinco" cfg={cfg} countries={countries} onExit={onExit} hud={<Hud ms={ms} />}>
        <Results
          title={count.bad === 0 && count.warn === 0 && round > 0 ? '¡Todo en su sitio!' : 'Partida terminada'}
          rows={[]}
          counts={count}
          ms={ms}
          stats={[{ label: 'Posiciones', value: `${points} de ${round * size}` }]}
          onAgain={() => {
            setCount({ ok: 0, warn: 0, bad: 0 });
            setPoints(0);
            setFive(deal());
            setOrder([]);
            setPhase('ask');
          }}
          onExit={onExit}
        />
      </Frame>
    );
  }

  const shown = phase === 'show' ? correct : five;
  return (
    <Frame
      title="Ordena cinco"
      cfg={cfg}
      countries={countries}
      onExit={onExit}
      progress={Number.isFinite(rounds) ? round / rounds : undefined}
      hud={<Hud ms={ms} progress={Number.isFinite(rounds) ? `${Math.min(round + (phase === 'ask' ? 1 : 0), rounds)} / ${rounds}` : `Ronda ${round + (phase === 'ask' ? 1 : 0)}`} />}
    >
      <p className="kicker center">De mayor a menor {m.noun}</p>
      <h2 className="q-ask center">{phase === 'ask' ? 'Toca los países en orden, empezando por el mayor' : 'Este es el orden correcto'}</h2>
      <ol className={cx('rank', phase === 'show' && 'shown')}>
        {shown.map((c, i) => {
          const at = order.indexOf(c.id);
          const hit = phase === 'show' && order[i] === c.id;
          return (
            <li key={c.id}>
              <button type="button" className={cx('rank-card', at >= 0 && phase === 'ask' && 'picked', phase === 'show' && (hit ? 'right' : 'wrong'))} onClick={() => toggle(c.id)} disabled={phase !== 'ask'}>
                <span className="rank-n">{phase === 'show' ? i + 1 : at >= 0 ? at + 1 : ''}</span>
                <Flag code={c.fl} size="lg" />
                <span className="rank-name">{c.n.es}</span>
                {phase === 'show' && (
                  <span className="rank-value">
                    {m.short(m.of(c))}
                    <small>{hit ? 'bien' : `pusiste ${at + 1}.º`}</small>
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
      <div className="q-actions center">
        {phase === 'ask' ? (
          <>
            <button type="button" className="btn btn-primary" disabled={order.length < size} onClick={check}>
              Comprobar
            </button>
            <button type="button" className="btn btn-sm" disabled={!order.length} onClick={() => setOrder([])}>
              Borrar orden
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>
            {round >= rounds ? 'Ver resultado' : 'Otros cinco'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={finish}>
          <FlagIcon size={15} aria-hidden="true" />
          Terminar
        </button>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Exact figure
// ---------------------------------------------------------------------------

function magnitudeHint(v: number, m: Metric): string {
  const lo = Math.pow(10, Math.floor(Math.log10(v)));
  const step = v / lo < 2 ? [1, 2] : v / lo < 5 ? [2, 5] : [5, 10];
  return `Entre ${m.short(lo * step[0])} y ${m.short(lo * step[1])}.`;
}

function Exact({ countries, cfg, onExit }: PopProps) {
  const m = METRICS[cfg.opts.metric];
  const total = questionsOf(cfg.opts.length, countries.length);
  const [queue, setQueue] = useState(() => shuffle(countries));
  const [at, setAt] = useState(0);
  const [text, setText] = useState('');
  const [unit, setUnit] = useState(m.defaultUnit);
  const [hinted, setHinted] = useState(false);
  const [shown, setShown] = useState<{ res: Res; guess: number; error: number } | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [ended, setEnded] = useState(false);
  const ms = useElapsed(!ended);
  const save = useSession(cfg, `Cifra exacta · ${m.noun}`);
  const c = queue[at % queue.length];
  const real = m.of(c);
  const parsed = parseNumber(text);
  const guess = parsed != null ? parsed * unit : null;

  const finish = (list = rows) => {
    const count = { ok: 0, warn: 0, bad: 0 };
    for (const r of list) count[r.res]++;
    save(count, ms);
    setEnded(true);
  };

  const submit = () => {
    if (guess == null || guess <= 0 || shown) return;
    const j = judgeAmount(guess, real);
    const res: Res = j.res === 'ok' && hinted ? 'warn' : j.res;
    setShown({ res, guess, error: j.error });
    setRows((r) => [...r, { item: countryItem(c), res, note: `${m.short(real)} · dijiste ${m.short(guess)}` }]);
  };

  const next = () => {
    if (rows.length >= total) return finish();
    if ((at + 1) % queue.length === 0) setQueue(shuffle(countries));
    setAt((n) => n + 1);
    setText('');
    setHinted(false);
    setShown(null);
  };

  if (ended) {
    return (
      <Frame title="Cifra exacta" cfg={cfg} countries={countries} onExit={onExit} hud={<Hud ms={ms} />}>
        <Results
          title="Partida terminada"
          note="Acierto: a menos de un 10 % de la cifra real. Cerca: a menos de un 30 %."
          rows={rows}
          ms={ms}
          onAgain={() => {
            setQueue(shuffle(countries));
            setAt(0);
            setRows([]);
            setText('');
            setShown(null);
            setHinted(false);
            setEnded(false);
          }}
          onExit={onExit}
        />
      </Frame>
    );
  }

  const pct = shown ? Math.round(Math.abs(shown.error) * 100) : 0;
  return (
    <Frame
      title="Cifra exacta"
      cfg={cfg}
      countries={countries}
      onExit={onExit}
      progress={Number.isFinite(total) ? rows.length / total : undefined}
      hud={<Hud ms={ms} progress={Number.isFinite(total) ? `${Math.min(rows.length + (shown ? 0 : 1), total)} / ${total}` : `${rows.length + (shown ? 0 : 1)}`} />}
    >
      <p className="kicker center">{m.id === 'pop' ? '¿Cuántos habitantes tiene?' : '¿Qué superficie tiene?'}</p>
      <CountryCard c={c} value={shown ? m.full(real) : undefined} state={shown ? (shown.res === 'bad' ? 'wrong' : 'right') : undefined} />
      {!shown ? (
        <form
          className="amount"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="amount-row">
            <input
              className="answer-input"
              inputMode="decimal"
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Cifra"
              aria-label="Cifra"
              autoComplete="off"
              key={c.id}
            />
            <Seg<number> small label="Unidad" value={unit} onChange={setUnit} options={m.units.map((u) => ({ value: u.factor, label: u.label }))} />
          </div>
          <p className="q-note" role="status">
            {text && guess == null ? 'Escribe solo la cifra, por ejemplo 47,5.' : guess != null ? `= ${m.full(guess)}` : hinted ? magnitudeHint(real, m) : 'Usa la coma para los decimales.'}
            {hinted && guess != null ? ` · ${magnitudeHint(real, m)}` : ''}
          </p>
          <div className="q-actions center">
            <button type="submit" className="btn btn-primary" disabled={guess == null || guess <= 0}>
              Comprobar
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setHinted(true)} disabled={hinted}>
              <Lightbulb size={15} aria-hidden="true" />
              Pista
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => finish()}>
              <FlagIcon size={15} aria-hidden="true" />
              Terminar
            </button>
          </div>
        </form>
      ) : (
        <>
          <Verdict
            res={shown.res}
            item={countryItem(c)}
            title={
              shown.res === 'bad' ? (
                <>
                  Dijiste {m.short(shown.guess)}: te has quedado {shown.error < 0 ? 'corto' : 'largo'} un {nf(pct)} %
                </>
              ) : (
                <>
                  {shown.res === 'ok' ? '¡Muy cerca!' : 'Cerca.'} Dijiste {m.short(shown.guess)} ({shown.error < 0 ? '-' : '+'}
                  {nf(pct)} %)
                </>
              )
            }
          />
          <div className="q-actions center">
            <button type="button" className="btn btn-primary" onClick={next} autoFocus>
              {rows.length >= total ? 'Ver resultado' : 'Siguiente'}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Which country
// ---------------------------------------------------------------------------

const MAX_GUESSES = 6;

function Which({ countries, cfg, onExit }: PopProps) {
  const m = METRICS[cfg.opts.metric];
  const total = questionsOf(cfg.opts.length, countries.length);
  const matcher = useMemo(() => new Matcher(countries.map((c) => ({ id: c.id, answers: [c.n.es, c.n.en ?? '', ...(c.al ?? [])] }))), [countries]);
  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const [queue, setQueue] = useState(() => shuffle(countries));
  const [at, setAt] = useState(0);
  const [guesses, setGuesses] = useState<Country[]>([]);
  const [done, setDone] = useState<Res | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [ended, setEnded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const ms = useElapsed(!ended);
  const save = useSession(cfg, `¿Qué país? · ${m.noun}`);
  const c = queue[at % queue.length];
  const real = m.of(c);

  const settle = (res: Res, n: number) => {
    setDone(res);
    setNote(null);
    setRows((r) => [...r, { item: countryItem(c), res, note: res === 'bad' ? m.short(real) : `${m.short(real)} · ${n} ${n === 1 ? 'intento' : 'intentos'}` }]);
  };

  const onSubmit = (text: string) => {
    if (done) return;
    const id = matcher.find(text)[0];
    const g = id ? byId.get(id) : undefined;
    if (!g) {
      setShake((n) => n + 1);
      setNote('Ese país no está en tu selección.');
      return;
    }
    if (guesses.some((x) => x.id === g.id)) {
      setShake((n) => n + 1);
      setNote(`${g.n.es} ya lo has probado.`);
      return;
    }
    const list = [...guesses, g];
    setGuesses(list);
    setClear((n) => n + 1);
    setNote(null);
    if (g.id === c.id) settle(list.length === 1 ? 'ok' : 'warn', list.length);
    else if (list.length >= MAX_GUESSES) settle('bad', list.length);
  };

  const finish = (list = rows) => {
    const count = { ok: 0, warn: 0, bad: 0 };
    for (const r of list) count[r.res]++;
    save(count, ms);
    setEnded(true);
  };

  const next = () => {
    if (rows.length >= total) return finish();
    if ((at + 1) % queue.length === 0) setQueue(shuffle(countries));
    setAt((n) => n + 1);
    setGuesses([]);
    setDone(null);
    setClear((n) => n + 1);
  };

  const suggest = (text: string): Suggestion[] =>
    matcher
      .suggest(text, 6)
      .map((id) => byId.get(id)!)
      .map((x) => ({ id: x.id, label: x.n.es, icon: <Flag code={x.fl} size="sm" /> }));

  if (ended) {
    return (
      <Frame title="¿Qué país?" cfg={cfg} countries={countries} onExit={onExit} hud={<Hud ms={ms} />}>
        <Results
          title="Partida terminada"
          rows={rows}
          ms={ms}
          onAgain={() => {
            setQueue(shuffle(countries));
            setAt(0);
            setRows([]);
            setGuesses([]);
            setDone(null);
            setEnded(false);
          }}
          onExit={onExit}
        />
      </Frame>
    );
  }

  return (
    <Frame
      title="¿Qué país?"
      cfg={cfg}
      countries={countries}
      onExit={onExit}
      progress={Number.isFinite(total) ? rows.length / total : undefined}
      hud={<Hud ms={ms} progress={Number.isFinite(total) ? `${Math.min(rows.length + (done ? 0 : 1), total)} / ${total}` : `${rows.length + (done ? 0 : 1)}`} />}
    >
      <p className="kicker center">{m.id === 'pop' ? '¿Qué país tiene esta población?' : '¿Qué país tiene esta superficie?'}</p>
      <p className="bigfig">{m.full(real)}</p>
      {!done && (
        <>
          <AnswerInput label="País" placeholder="Escribe un país de tu selección…" onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
          <p className="q-note" role="status">
            {note ?? `Cada intento te dice si te pasas o te quedas corto. Te quedan ${MAX_GUESSES - guesses.length}.`}
          </p>
        </>
      )}
      {guesses.length > 0 && (
        <ul className="which-log">
          {guesses.map((g) => {
            const v = m.of(g);
            const hit = g.id === c.id;
            return (
              <li key={g.id} className={hit ? 'hit' : undefined}>
                <Flag code={g.fl} size="sm" />
                <b>{g.n.es}</b>
                <span>{m.short(v)}</span>
                {hit ? (
                  <Check size={16} aria-label="correcto" />
                ) : v > real ? (
                  <em>
                    <ArrowDown size={14} aria-hidden="true" /> busca uno {m.id === 'pop' ? 'menos poblado' : 'más pequeño'}
                  </em>
                ) : (
                  <em>
                    <ArrowUp size={14} aria-hidden="true" /> busca uno {m.id === 'pop' ? 'más poblado' : 'más grande'}
                  </em>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {done && (
        <Verdict res={done} item={countryItem(c)} title={done === 'bad' ? <>Era <b>{c.n.es}</b></> : done === 'ok' ? <>¡A la primera! <b>{c.n.es}</b></> : <>Correcto: <b>{c.n.es}</b></>} />
      )}
      <div className="q-actions center">
        {done ? (
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>
            {rows.length >= total ? 'Ver resultado' : 'Siguiente'}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => settle('bad', guesses.length)}>
            <X size={15} aria-hidden="true" />
            No lo sé
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => finish()}>
          <FlagIcon size={15} aria-hidden="true" />
          Terminar
        </button>
      </div>
    </Frame>
  );
}

export function PopGame(props: PopProps) {
  switch (props.cfg.mode) {
    case 'rank':
      return <RankFive {...props} />;
    case 'exact':
      return <Exact {...props} />;
    case 'which':
      return <Which {...props} />;
    default:
      return <HiLo {...props} />;
  }
}
