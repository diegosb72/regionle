/**
 * Figure games: higher or lower, rank five, exact figure and which one. They are played with the figures
 * of anything that has one (the people of a country or a city, the size of a region or a lake, the height
 * of a peak) and, to put five places in order, with where they lie.
 */
import { ArrowDown, ArrowRight, ArrowUp, Check, Flag as FlagIcon, Lightbulb, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag, Seg } from '../components/ui';
import { challenger, comparable, dealFive, metricOf, metricsIn, type Fig, type Metric, type MetricId } from '../lib/figures';
import { L } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { useStore, type GameConfig } from '../lib/store';
import { Matcher, cx, judgeAmount, listed, nf, parseNumber, pick, shortNote, shuffle } from '../lib/text';
import type { Deck, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, useElapsed, type ResultRow } from './common';

export interface FigProps {
  /** The things the game is played with, each with its figure. */
  figs: Fig[];
  cfg: GameConfig;
  /** What they are, said under the name of the game: "12 países", "España · 25 ciudades". */
  what: string;
  /** The map they are on, when the game shows it (putting places in order). */
  deck?: Deck;
  onExit(): void;
  onAgain(patch?: Partial<GameConfig>): void;
}

/** Number of questions: every thing once, a fixed number, or no end. */
function questionsOf(length: GameConfig['opts']['length'], available: number): number {
  return length === 'endless' ? Infinity : length === 'all' ? available : Math.min(length, available);
}

/** The figures a list of things is about, said in a row: "altitud y superficie". */
const nounsOf = (figs: readonly Fig[]): string => listed(metricsIn(figs).map((id) => metricOf(id).noun), L('y', 'and'));

function Frame({ title, figs, what, onExit, hud, progress, stage, children }: { title: string; figs: Fig[]; what: string; onExit(): void; hud?: ReactNode; progress?: number; stage?: ReactNode; children: ReactNode }) {
  return <GameShell title={title} subtitle={`${what} · ${nounsOf(figs)}`} onExit={onExit} hud={hud} progress={progress} stage={stage} panel={<div className="pop">{children}</div>} />;
}

/** What a thing is, under its name, where its flag does not say it: "ciudad · Francia", "pico". */
const kindLine = (f: Fig): string | null => (f.item.kind === 'country' ? null : f.sub ? `${f.type} · ${f.sub}` : f.type);

function FigCard({ f, value, state, children }: { f: Fig; value?: string; state?: 'right' | 'wrong'; children?: ReactNode }) {
  const kind = kindLine(f);
  return (
    <div className={cx('pcard', state)}>
      {f.fl ? <Flag code={f.fl} size="xl" /> : f.item.cat ? <i className={`kdot kdot-${f.item.cat} pcard-kind`} aria-hidden="true" /> : null}
      <h3>{f.name}</h3>
      {kind && <p className="pcard-sub">{kind}</p>}
      {value != null && <p className="pcard-value">{value}</p>}
      {children}
    </div>
  );
}

/** The flag of a thing in a line of text, or the dot of its kind. */
const Mark = ({ f, size = 'sm' }: { f: Fig; size?: 'sm' | 'lg' }) => (f.fl ? <Flag code={f.fl} size={size} /> : f.item.cat ? <i className={`kdot kdot-${f.item.cat}`} aria-hidden="true" /> : null);

function useSession(cfg: GameConfig, label: string) {
  const addSession = useStore((s) => s.addSession);
  return (count: { ok: number; warn: number; bad: number }, ms: number, note?: string) => {
    const total = count.ok + count.warn + count.bad;
    if (total) addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label, total, ...count, ms, note });
  };
}

/** What a game is filed under among the games played: the countries have no map to name. */
const labelOf = (cfg: GameConfig, what: string, title: string, figs: readonly Fig[]): string => (cfg.section === 'pops' ? `${title} · ${nounsOf(figs)}` : `${what} · ${nounsOf(figs)}`);

// ---------------------------------------------------------------------------
// Higher or lower
// ---------------------------------------------------------------------------

function HiLo({ figs, cfg, what, onExit }: FigProps) {
  const title = modeNameIn(cfg.section, 'hilo');
  /** Only what has something to be compared with. */
  const list = useMemo(() => comparable(figs), [figs]);
  const [a, setA] = useState(() => pick(list));
  const [b, setB] = useState(() => challenger(list, a, 0, []));
  const m = metricOf(a.metric);
  const [phase, setPhase] = useState<'ask' | 'show' | 'over'>('ask');
  const [guess, setGuess] = useState<'more' | 'less' | null>(null);
  const [log, setLog] = useState<{ a: Fig; b: Fig; ok: boolean }[]>([]);
  const [record, setRecord] = useState<{ best: number; isNew: boolean } | null>(null);
  const ms = useElapsed(phase !== 'over');
  const save = useSession(cfg, labelOf(cfg, what, title, figs));
  const streak = log.filter((l) => l.ok).length;
  const right = guess != null && (b.value === a.value || (guess === 'more') === b.value > a.value);
  /** The record of each figure is its own; the countries keep the key they always had. */
  const bestKey = cfg.section === 'pops' ? `hilo:${m.id}` : `hilo:${m.id}:${cfg.section}`;

  const answer = (g: 'more' | 'less') => {
    if (phase !== 'ask') return;
    setGuess(g);
    setPhase('show');
    const ok = b.value === a.value || (g === 'more') === b.value > a.value;
    setLog((l) => [...l, { a, b, ok }]);
  };

  useEffect(() => {
    if (phase !== 'show') return;
    const t = setTimeout(
      () => {
        if (right) {
          const recent = log.slice(-10).flatMap((l) => [l.a.id, l.b.id]);
          setA(b);
          setB(challenger(list, b, streak, recent));
          setGuess(null);
          setPhase('ask');
        } else {
          const st = useStore.getState();
          const prev = st.best[bestKey] ?? 0;
          const isNew = streak > 0 && st.setBest(bestKey, streak);
          setRecord({ best: Math.max(prev, streak), isNew });
          save({ ok: streak, warn: 0, bad: 1 }, ms, L(`Racha de ${streak}`, `Streak of ${streak}`));
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
    const first = pick(list);
    setA(first);
    setB(challenger(list, first, 0, []));
    setLog([]);
    setGuess(null);
    setRecord(null);
    setPhase('ask');
  };

  if (phase === 'over') {
    const miss = log[log.length - 1];
    return (
      <Frame title={title} figs={figs} what={what} onExit={onExit} hud={<Hud ms={ms} />}>
        <div className="results">
          <p className="kicker">{L('Fin de la racha', 'End of the streak')}</p>
          <h2 className="results-title">
            {streak === 0 ? L('A la primera, no', 'Not at the first go') : L(`${streak} ${streak === 1 ? 'acierto seguido' : 'aciertos seguidos'}`, `${streak} right in a row`)}
          </h2>
          <p className="results-note">
            {record?.isNew ? L('¡Nuevo récord! ', 'New record! ') : record ? L(`Tu récord: ${record.best}. `, `Your record: ${record.best}. `) : ''}
            {miss && `${miss.b.name}: ${m.full(miss.b.value)}. ${miss.a.name}: ${m.full(miss.a.value)}.`}
          </p>
          <div className="results-actions">
            <button type="button" className="btn btn-primary" onClick={again} autoFocus>
              {L('Otra racha', 'Another streak')}
            </button>
            <button type="button" className="btn btn-ghost" onClick={onExit}>
              {L('Cambiar de juego', 'Change game')}
            </button>
          </div>
          <ol className="hl-log">
            {log.map((l, i) => (
              <li key={i} className={l.ok ? 'hit' : 'miss'}>
                <Mark f={l.a} /> {l.a.name} <small>{m.short(l.a.value)}</small>
                <span className="vs">{l.b.value > l.a.value ? '<' : '>'}</span>
                <Mark f={l.b} /> {l.b.name} <small>{m.short(l.b.value)}</small>
              </li>
            ))}
          </ol>
        </div>
      </Frame>
    );
  }

  return (
    <Frame title={title} figs={figs} what={what} onExit={onExit} hud={<Hud ms={ms} streak={streak} progress={`${L('Racha', 'Streak')} ${streak}`} />}>
      <p className="kicker center">{m.ask}</p>
      <div className="hl">
        <FigCard f={a} value={m.full(a.value)} />
        <div className="hl-vs" aria-hidden="true">
          vs
        </div>
        <FigCard f={b} value={phase === 'show' ? m.full(b.value) : L('¿ ?', '?')} state={phase === 'show' ? (right ? 'right' : 'wrong') : undefined}>
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
        </FigCard>
      </div>
      <p className="hint-line">
        {m.compare(b.name, a.name)} {L('También con las flechas ↑ ↓ del teclado.', 'The ↑ ↓ arrow keys work too.')}
      </p>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Rank five
// ---------------------------------------------------------------------------

function RankFive({ figs, cfg, what, deck, onExit }: FigProps) {
  const title = modeNameIn(cfg.section, cfg.mode);
  const rounds = cfg.opts.length === 'endless' ? Infinity : cfg.opts.length === 'all' ? 10 : cfg.opts.length;
  const [five, setFive] = useState(() => dealFive(figs));
  const size = five.length;
  const m = metricOf(five[0].metric);
  const [order, setOrder] = useState<string[]>([]);
  const [phase, setPhase] = useState<'ask' | 'show' | 'end'>('ask');
  const [count, setCount] = useState({ ok: 0, warn: 0, bad: 0 });
  const [points, setPoints] = useState(0);
  const round = count.ok + count.warn + count.bad;
  const ms = useElapsed(phase !== 'end');
  const save = useSession(cfg, labelOf(cfg, what, title, figs));
  const correct = useMemo(() => [...five].sort((x, y) => y.value - x.value), [five]);
  const map = useRef<MapHandle>(null);

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
    map.current?.focus(
      five.map((f) => f.id),
      { passing: true },
    );
  };

  const deal = () => {
    setFive(dealFive(figs));
    setOrder([]);
    setPhase('ask');
    map.current?.restore();
  };

  const finish = () => {
    save(count, ms, L(`${points} posiciones acertadas`, `${points} positions right`));
    setPhase('end');
  };

  const next = () => (round >= rounds ? finish() : deal());

  // The map says where the five were once the order is checked: until then it names nothing.
  const shown = phase !== 'ask';
  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (shown) correct.forEach((c, i) => (p[c.id] = order[i] === c.id ? 'ok' : 'bad'));
    return p;
  }, [shown, correct, order]);
  const pinned = useMemo(() => (shown ? new Set(five.map((f) => f.id)) : undefined), [shown, five]);
  const stage = deck ? <MapView ref={map} deck={deck} paint={paint} pinned={pinned} tip={(id) => (shown && pinned?.has(id) ? deck.byId.get(id)?.name : null)} /> : undefined;

  if (phase === 'end') {
    return (
      <Frame title={title} figs={figs} what={what} onExit={onExit} hud={<Hud ms={ms} />} stage={stage}>
        <Results
          title={count.bad === 0 && count.warn === 0 && round > 0 ? L('¡Todo en su sitio!', 'Everything in its place!') : L('Partida terminada', 'Game over')}
          rows={[]}
          counts={count}
          ms={ms}
          stats={[{ label: L('Posiciones', 'Positions'), value: `${points} ${L('de', 'of')} ${round * 5}` }]}
          onAgain={() => {
            setCount({ ok: 0, warn: 0, bad: 0 });
            setPoints(0);
            deal();
          }}
          onExit={onExit}
        />
      </Frame>
    );
  }

  const cards = phase === 'show' ? correct : five;
  return (
    <Frame
      title={title}
      figs={figs}
      what={what}
      onExit={onExit}
      stage={stage}
      progress={Number.isFinite(rounds) ? round / rounds : undefined}
      hud={<Hud ms={ms} progress={Number.isFinite(rounds) ? `${Math.min(round + (phase === 'ask' ? 1 : 0), rounds)} / ${rounds}` : `${L('Ronda', 'Round')} ${round + (phase === 'ask' ? 1 : 0)}`} />}
    >
      <p className="kicker center">{m.noun}</p>
      <h2 className="q-ask center">{phase === 'ask' ? L(`Toca en orden, ${m.order}`, `Tap in order, ${m.order}`) : L('Este es el orden correcto', 'This is the right order')}</h2>
      <ol className={cx('rank', phase === 'show' && 'shown')}>
        {cards.map((c, i) => {
          const at = order.indexOf(c.id);
          const hit = phase === 'show' && order[i] === c.id;
          return (
            <li key={c.id}>
              <button type="button" className={cx('rank-card', at >= 0 && phase === 'ask' && 'picked', phase === 'show' && (hit ? 'right' : 'wrong'))} onClick={() => toggle(c.id)} disabled={phase !== 'ask'}>
                <span className="rank-n">{phase === 'show' ? i + 1 : at >= 0 ? at + 1 : ''}</span>
                <Mark f={c} size="lg" />
                <span className="rank-name">
                  {c.name}
                  {c.sub && <small>{c.sub}</small>}
                </span>
                {phase === 'show' && (
                  <span className="rank-value">
                    {m.short(c.value)}
                    <small>{hit ? L('bien', 'right') : L(`pusiste ${at + 1}.º`, `you put no. ${at + 1}`)}</small>
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
              {L('Comprobar', 'Check')}
            </button>
            <button type="button" className="btn btn-sm" disabled={!order.length} onClick={() => setOrder([])}>
              {L('Borrar orden', 'Clear order')}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>
            {round >= rounds ? L('Ver resultado', 'See the result') : L('Otros cinco', 'Another five')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={finish}>
          <FlagIcon size={15} aria-hidden="true" />
          {L('Terminar', 'Finish')}
        </button>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Exact figure
// ---------------------------------------------------------------------------

function magnitudeHint(v: number, m: Metric): string {
  // Round figures of what is shown: in square miles when that is how surfaces are told.
  const per = m.per ?? 1;
  const n = v / per;
  const lo = Math.pow(10, Math.floor(Math.log10(n)));
  const step = n / lo < 2 ? [1, 2] : n / lo < 5 ? [2, 5] : [5, 10];
  return L(`Entre ${m.short(lo * step[0] * per)} y ${m.short(lo * step[1] * per)}.`, `Between ${m.short(lo * step[0] * per)} and ${m.short(lo * step[1] * per)}.`);
}

function Exact({ figs, cfg, what, onExit }: FigProps) {
  const title = modeNameIn(cfg.section, 'exact');
  const total = questionsOf(cfg.opts.length, figs.length);
  const [queue, setQueue] = useState(() => shuffle(figs));
  const [at, setAt] = useState(0);
  const [text, setText] = useState('');
  /** The unit chosen for each figure: a map of peaks and lakes asks in metres and in km². */
  const [units, setUnits] = useState<Partial<Record<MetricId, number>>>({});
  const [hinted, setHinted] = useState(false);
  const [shown, setShown] = useState<{ res: Res; guess: number; error: number } | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [ended, setEnded] = useState(false);
  const ms = useElapsed(!ended);
  const save = useSession(cfg, labelOf(cfg, what, title, figs));
  const c = queue[at % queue.length];
  const m = metricOf(c.metric);
  const unit = units[m.id] ?? m.defaultUnit;
  const real = c.value;
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
    setRows((r) => [...r, { item: c.item, res, note: `${m.short(real)} · ${L('dijiste', 'you said')} ${m.short(guess)}` }]);
  };

  const next = () => {
    if (rows.length >= total) return finish();
    if ((at + 1) % queue.length === 0) setQueue(shuffle(figs));
    setAt((n) => n + 1);
    setText('');
    setHinted(false);
    setShown(null);
  };

  if (ended) {
    return (
      <Frame title={title} figs={figs} what={what} onExit={onExit} hud={<Hud ms={ms} />}>
        <Results
          title={L('Partida terminada', 'Game over')}
          note={L('Acierto: a menos de un 10 % de la cifra real. Cerca: a menos de un 30 %.', 'Right: within 10% of the real figure. Close: within 30%.')}
          rows={rows}
          ms={ms}
          onAgain={() => {
            setQueue(shuffle(figs));
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
      title={title}
      figs={figs}
      what={what}
      onExit={onExit}
      progress={Number.isFinite(total) ? rows.length / total : undefined}
      hud={<Hud ms={ms} progress={Number.isFinite(total) ? `${Math.min(rows.length + (shown ? 0 : 1), total)} / ${total}` : `${rows.length + (shown ? 0 : 1)}`} />}
    >
      <p className="kicker center">{m.exactAsk}</p>
      <FigCard f={c} value={shown ? m.full(real) : undefined} state={shown ? (shown.res === 'bad' ? 'wrong' : 'right') : undefined} />
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
              placeholder={L('Cifra', 'Figure')}
              aria-label={L('Cifra', 'Figure')}
              autoComplete="off"
              key={c.id}
            />
            {m.units.length > 1 ? (
              <Seg<number> small label={L('Unidad', 'Unit')} value={unit} onChange={(u) => setUnits((all) => ({ ...all, [m.id]: u }))} options={m.units.map((u) => ({ value: u.factor, label: u.label }))} />
            ) : (
              <span className="amount-unit">{m.units[0].label}</span>
            )}
          </div>
          <p className="q-note" role="status">
            {text && guess == null ? L('Escribe solo la cifra, por ejemplo 47,5.', 'Type just the figure, for example 47.5.') : guess != null ? `= ${m.full(guess)}` : hinted ? magnitudeHint(real, m) : L('Usa la coma para los decimales.', 'Use a point for decimals.')}
            {hinted && guess != null ? ` · ${magnitudeHint(real, m)}` : ''}
          </p>
          <div className="q-actions center">
            <button type="submit" className="btn btn-primary" disabled={guess == null || guess <= 0}>
              {L('Comprobar', 'Check')}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setHinted(true)} disabled={hinted}>
              <Lightbulb size={15} aria-hidden="true" />
              {L('Pista', 'Hint')}
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => finish()}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </form>
      ) : (
        <>
          <Verdict
            res={shown.res}
            item={c.item}
            title={
              shown.res === 'bad' ? (
                L(`Dijiste ${m.short(shown.guess)}: te has quedado ${shown.error < 0 ? 'corto' : 'largo'} un ${nf(pct)} %`, `You said ${m.short(shown.guess)}: ${nf(pct)}% too ${shown.error < 0 ? 'low' : 'high'}`)
              ) : (
                `${shown.res === 'ok' ? L('¡Muy cerca!', 'Very close!') : L('Cerca.', 'Close.')} ${L('Dijiste', 'You said')} ${m.short(shown.guess)} (${shown.error < 0 ? '-' : '+'}${nf(pct)} %)`
              )
            }
          />
          <div className="q-actions center">
            <button type="button" className="btn btn-primary" onClick={next} autoFocus>
              {rows.length >= total ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
              <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>
        </>
      )}
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// Which one
// ---------------------------------------------------------------------------

const MAX_GUESSES = 6;

function Which({ figs, cfg, what, onExit }: FigProps) {
  const title = modeNameIn(cfg.section, 'which');
  /** A figure that nothing else on the list has cannot be searched for among the rest. */
  const list = useMemo(() => comparable(figs), [figs]);
  const countries = cfg.section === 'pops';
  const total = questionsOf(cfg.opts.length, list.length);
  const matcher = useMemo(() => new Matcher(list.map((f) => f.answers)), [list]);
  const byId = useMemo(() => new Map(list.map((f) => [f.id, f])), [list]);
  const [queue, setQueue] = useState(() => shuffle(list));
  const [at, setAt] = useState(0);
  const [guesses, setGuesses] = useState<Fig[]>([]);
  const [done, setDone] = useState<Res | null>(null);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [ended, setEnded] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const ms = useElapsed(!ended);
  const save = useSession(cfg, labelOf(cfg, what, title, figs));
  const c = queue[at % queue.length];
  const m = metricOf(c.metric);
  const real = c.value;

  const settle = (res: Res, n: number) => {
    setDone(res);
    setNote(null);
    setRows((r) => [...r, { item: c.item, res, note: res === 'bad' ? m.short(real) : `${m.short(real)} · ${n} ${L(n === 1 ? 'intento' : 'intentos', n === 1 ? 'guess' : 'guesses')}` }]);
  };

  const onSubmit = (text: string) => {
    if (done) return;
    const id = matcher.find(text)[0];
    const g = id ? byId.get(id) : undefined;
    if (!g) {
      setShake((n) => n + 1);
      setNote(matcher.vague(text) ? shortNote('vague', text) : countries ? L('Ese país no está en tu selección.', 'That country is not in your selection.') : L('Eso no está en este mapa.', 'That is not on this map.'));
      return;
    }
    if (g.metric !== c.metric) {
      // A lake has no height to be compared with that of a peak.
      setShake((n) => n + 1);
      setNote(L(`${g.name} no vale aquí: lo que se busca se mide por su ${m.noun}.`, `${g.name} does not count here: what is looked for is known by its ${m.noun}.`));
      return;
    }
    if (guesses.some((x) => x.id === g.id)) {
      setShake((n) => n + 1);
      setNote(L(`${g.name} ya lo has probado.`, `You have already tried ${g.name}.`));
      return;
    }
    const tried = [...guesses, g];
    setGuesses(tried);
    setClear((n) => n + 1);
    setNote(null);
    if (g.id === c.id) settle(tried.length === 1 ? 'ok' : 'warn', tried.length);
    else if (tried.length >= MAX_GUESSES) settle('bad', tried.length);
  };

  const finish = (all = rows) => {
    const count = { ok: 0, warn: 0, bad: 0 };
    for (const r of all) count[r.res]++;
    save(count, ms);
    setEnded(true);
  };

  const next = () => {
    if (rows.length >= total) return finish();
    if ((at + 1) % queue.length === 0) setQueue(shuffle(list));
    setAt((n) => n + 1);
    setGuesses([]);
    setDone(null);
    setClear((n) => n + 1);
  };

  const suggest = (text: string): Suggestion[] =>
    matcher
      .suggest(text, 6)
      .map((id) => byId.get(id)!)
      .map((x) => ({ id: x.id, label: x.name, sub: x.sub, icon: x.fl ? <Flag code={x.fl} size="sm" /> : undefined }));

  if (ended) {
    return (
      <Frame title={title} figs={figs} what={what} onExit={onExit} hud={<Hud ms={ms} />}>
        <Results
          title={L('Partida terminada', 'Game over')}
          rows={rows}
          ms={ms}
          onAgain={() => {
            setQueue(shuffle(list));
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
      title={title}
      figs={figs}
      what={what}
      onExit={onExit}
      progress={Number.isFinite(total) ? rows.length / total : undefined}
      hud={<Hud ms={ms} progress={Number.isFinite(total) ? `${Math.min(rows.length + (done ? 0 : 1), total)} / ${total}` : `${rows.length + (done ? 0 : 1)}`} />}
    >
      <p className="kicker center">{L(`¿Qué ${c.type} tiene esta ${m.noun}?`, `Which ${c.type} has this ${m.noun}?`)}</p>
      <p className="bigfig">{m.full(real)}</p>
      {!done && (
        <>
          <AnswerInput
            label={c.type.charAt(0).toUpperCase() + c.type.slice(1)}
            placeholder={countries ? L('Escribe un país de tu selección…', 'Type a country from your selection…') : L('Escribe un nombre de este mapa…', 'Type a name from this map…')}
            onSubmit={onSubmit}
            suggest={suggest}
            shake={shake}
            clear={clear}
          />
          <p className="q-note" role="status">
            {note ?? L(`Cada intento te dice si te pasas o te quedas corto. ${MAX_GUESSES - guesses.length === 1 ? 'Te queda' : 'Te quedan'} ${MAX_GUESSES - guesses.length}.`, `Each guess tells you whether you are too high or too low. ${MAX_GUESSES - guesses.length} left.`)}
          </p>
        </>
      )}
      {guesses.length > 0 && (
        <ul className="which-log">
          {guesses.map((g) => {
            const v = g.value;
            const hit = g.id === c.id;
            return (
              <li key={g.id} className={hit ? 'hit' : undefined}>
                <Mark f={g} />
                <b>{g.name}</b>
                <span>{m.short(v)}</span>
                {hit ? (
                  <Check size={16} aria-label={L('correcto', 'correct')} />
                ) : v > real ? (
                  <em>
                    <ArrowDown size={14} aria-hidden="true" /> {m.down}
                  </em>
                ) : (
                  <em>
                    <ArrowUp size={14} aria-hidden="true" /> {m.up}
                  </em>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {done && <Verdict res={done} item={c.item} title={<>{done === 'bad' ? L('Era', 'It was') : done === 'ok' ? L('¡A la primera!', 'First time!') : L('Correcto:', 'Correct:')} <b>{c.name}</b></>} />}
      <div className="q-actions center">
        {done ? (
          <button type="button" className="btn btn-primary" onClick={next} autoFocus>
            {rows.length >= total ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => settle('bad', guesses.length)}>
            <X size={15} aria-hidden="true" />
            {L('No lo sé', "I don't know")}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => finish()}>
          <FlagIcon size={15} aria-hidden="true" />
          {L('Terminar', 'Finish')}
        </button>
      </div>
    </Frame>
  );
}

export function FigGame(props: FigProps) {
  switch (props.cfg.mode) {
    case 'rank':
    case 'compass':
      return <RankFive {...props} />;
    case 'exact':
      return <Exact {...props} />;
    case 'which':
      return <Which {...props} />;
    default:
      return <HiLo {...props} />;
  }
}
