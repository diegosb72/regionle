/** The five tests of the daily challenge. Each one reports its points when the player moves on. */
import { ArrowDown, ArrowRight, ArrowUp, Check, MapPin, X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { GameShell, Verdict } from '../games/common';
import { countryAnswers, countryItem } from '../lib/data';
import { capitalAnswers } from '../lib/typeins';
import { distanceKm } from '../lib/geo';
import { L, capName, nm } from '../lib/i18n';
import { Matcher, shortNote } from '../lib/matcher';
import { cx, fmtArea, fmtPop, nf, type Answerable } from '../lib/text';
import { dist, distUnit } from '../lib/units';
import type { Country, Deck, Res } from '../lib/types';
import { testName } from './Card';
import { HARD_CLUE_AT, guessesOf, pinTriesOf } from './hard';
import { GUESSES, TESTS, bearing, compass, ladder, spanOf, type QuickQuestion } from './spec';

/** Where the test sits in the day. */
export interface Step {
  index: number;
  /** Points won in the tests already played. */
  points: number;
  onExit(): void;
}

export interface TestProps {
  step: Step;
  /** Points won and a figure for the summary (attempts used, hits…), reported the moment the test is decided. */
  onScore(points: number, figure: number): void;
  /** The player moves on. */
  onDone(): void;
}

/** Reports a result once: a test that has been decided cannot be played again by leaving and coming back. */
function useScore(decided: boolean, points: number, figure: number, onScore: (points: number, figure: number) => void) {
  const sent = useRef(false);
  useEffect(() => {
    if (!decided || sent.current) return;
    sent.current = true;
    onScore(points, figure);
  });
}

export { testName };

export const shellTitle = () => L('Reto del día', 'Daily challenge');
export const shellSubtitle = (i: number) => `${L('Prueba', 'Test')} ${i + 1} ${L('de', 'of')} ${TESTS} · ${testName(i)}`;
export const nextLabel = (i: number) => (i === TESTS - 1 ? L('Ver resultado', 'See the result') : L('Siguiente prueba', 'Next test'));

export function PointsChip({ points }: { points: number }) {
  return (
    <span className="hud-chip hud-main" title={L('Puntos del reto', 'Challenge points')}>
      {points} {L('pts', 'pts')}
    </span>
  );
}

/** `gained` are the points of the test in hand, once it is over. */
function Shell({ step, panel, stage, gained = 0 }: { step: Step; panel: ReactNode; stage?: ReactNode; gained?: number }) {
  return (
    <GameShell
      title={shellTitle()}
      subtitle={shellSubtitle(step.index)}
      onExit={step.onExit}
      progress={(step.index + (gained ? 1 : 0)) / TESTS}
      hud={<PointsChip points={step.points + gained} />}
      panel={panel}
      stage={stage}
    />
  );
}

function NextButton({ step, onClick }: { step: Step; onClick(): void }) {
  return (
    <button type="button" className="btn btn-primary" onClick={onClick} autoFocus>
      {nextLabel(step.index)}
      <ArrowRight size={16} aria-hidden="true" />
    </button>
  );
}

const tries = (n: number) => (n === 1 ? L('intento', 'try') : L('intentos', 'tries'));
const COMPASS = () => [L('norte', 'north'), L('noreste', 'north-east'), L('este', 'east'), L('sureste', 'south-east'), L('sur', 'south'), L('suroeste', 'south-west'), L('oeste', 'west'), L('noroeste', 'north-west')];

// ---------------------------------------------------------------------------
// 1 · Regionle: the mystery region
// ---------------------------------------------------------------------------

/** `turned` is the outline as the hard way shows it while it is being guessed: not north up. */
export function RegionleTest({ deck, target, shape, turned, hard = false, step, onScore, onDone }: TestProps & { deck: Deck; target: string; shape: string; turned?: string; hard?: boolean }) {
  const most = guessesOf(hard);
  const item = deck.byId.get(target)!;
  const country = deck.countries[0];
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);
  const span = useMemo(() => spanOf(deck.items, distanceKm), [deck]);
  const [guesses, setGuesses] = useState<string[]>([]);
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play');
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const map = useRef<MapHandle>(null);
  const over = state !== 'play';
  const fem = deck.noun.fem;

  const clue = (id: string) => {
    const g = deck.byId.get(id)!;
    const km = distanceKm(g.lp, item.lp);
    return { km, deg: bearing(g.lp, item.lp), near: Math.max(0, Math.min(99, Math.round((1 - km / span) * 100))) };
  };

  const onSubmit = (text: string) => {
    if (over) return;
    const id = matcher.find(text)[0];
    const g = id ? deck.byId.get(id) : undefined;
    if (!g) {
      setShake((n) => n + 1);
      setNote(matcher.vague(text) ? shortNote('vague', text) : L(`No coincide con ${fem ? 'ninguna' : 'ningún'} ${deck.noun.one} de ${nm(country.n)}.`, `That matches nothing in ${nm(country.n)}.`));
      return;
    }
    if (guesses.includes(g.id)) {
      setShake((n) => n + 1);
      setNote(L(`${g.name} ya ${fem ? 'la' : 'lo'} has probado.`, `You have already tried ${g.name}.`));
      return;
    }
    const list = [...guesses, g.id];
    setGuesses(list);
    setClear((n) => n + 1);
    setNote(null);
    setFlash({ id: g.id, kind: g.id === target ? 'ok' : 'bad', n: Date.now() });
    if (g.id === target) setState('won');
    else if (list.length >= most) setState('lost');
  };

  useEffect(() => {
    if (over) map.current?.focus([target], { fill: 0.5 });
  }, [over, target]);

  const suggest = (text: string): Suggestion[] =>
    matcher
      .suggest(text, 8)
      .filter((id) => !guesses.includes(id))
      .map((id) => ({ id, label: deck.byId.get(id)!.name }));

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const id of guesses) if (id !== target) p[id] = distanceKm(deck.byId.get(id)!.lp, item.lp) / span <= 0.25 ? 'warn' : 'bad';
    if (state === 'won') p[target] = 'ok';
    if (state === 'lost') p[target] = 'target';
    return p;
  }, [guesses, state, target, deck, item, span]);
  const pinned = useMemo(() => new Set(over ? [...guesses, target] : guesses), [guesses, over, target]);
  const points = ladder(guesses.length, state === 'won');
  useScore(over, points, state === 'won' ? guesses.length : 0, onScore);
  const names = COMPASS();

  const panel = (
    <div className="q">
      <div className="q-prompt">
        <p className="kicker">Regionle</p>
        <h2 className="q-ask">
          {L(`¿Qué ${deck.noun.one} de ${nm(country.n)} es ${fem ? 'esta' : 'este'}?`, `Which part of ${nm(country.n)} is this?`)}
        </h2>
      </div>
      <div className="d-shape">
        <svg viewBox="0 0 400 400" role="img" aria-label={L('Silueta que hay que reconocer', 'Outline to recognise')}>
          <path d={!over && turned ? turned : shape} />
        </svg>
      </div>

      {!over && (
        <>
          <AnswerInput label={L('Tu respuesta', 'Your answer')} placeholder={L(`Escribe ${fem ? 'una' : 'un'} ${deck.noun.one}…`, 'Type a name…')} onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
          <p className="q-note" role="status">
            {note ??
              (guesses.length
                ? L(`${most - guesses.length === 1 ? 'Te queda' : 'Te quedan'} ${most - guesses.length} ${tries(most - guesses.length)}.`, `${most - guesses.length} ${tries(most - guesses.length)} left.`)
                : L(
                    `Tienes ${most} intentos. Cada fallo te dice a qué distancia y hacia dónde está.${turned ? ' La silueta está girada: el norte no queda arriba.' : ''}`,
                    `You have ${most} tries. Each miss tells you how far away it is and in which direction.${turned ? ' The outline is turned: north is not at the top.' : ''}`,
                  ))}
          </p>
        </>
      )}

      {guesses.length > 0 && (
        <ol className="d-guesses">
          {guesses.map((id) => {
            const g = deck.byId.get(id)!;
            if (id === target)
              return (
                <li key={id} className="hit">
                  <b>{g.name}</b>
                  <Check size={16} aria-label={L('correcto', 'correct')} />
                </li>
              );
            const c = clue(id);
            return (
              <li key={id}>
                <b>{g.name}</b>
                <span>
                  {nf(Math.max(1, Math.round(dist(c.km))))} {distUnit()}
                </span>
                <span className="d-dir" title={L(`hacia el ${names[compass(c.deg)]}`, `to the ${names[compass(c.deg)]}`)}>
                  <ArrowUp size={16} strokeWidth={2.6} style={{ transform: `rotate(${Math.round(c.deg)}deg)` }} aria-hidden="true" />
                  <i>{names[compass(c.deg)]}</i>
                </span>
                <em>{c.near} %</em>
              </li>
            );
          })}
        </ol>
      )}

      {over && (
        <Verdict
          res={state === 'won' ? (guesses.length === 1 ? 'ok' : 'warn') : 'bad'}
          item={item}
          title={
            state === 'won' ? (
              <>
                {guesses.length === 1 ? L('¡A la primera!', 'First try!') : L(`Correcto, en ${guesses.length} ${tries(guesses.length)}:`, `Right, in ${guesses.length} ${tries(guesses.length)}:`)} <b>{item.name}</b>
              </>
            ) : (
              <>
                {L('Era', 'It was')} <b>{item.name}</b>
              </>
            )
          }
        >
          <p className="d-points">
            +{points} {L('puntos', 'points')}
          </p>
        </Verdict>
      )}

      <div className="q-actions">
        {over ? (
          <NextButton step={step} onClick={onDone} />
        ) : (
          <button type="button" className="btn btn-sm" onClick={() => setState('lost')}>
            <X size={15} aria-hidden="true" />
            {L('No lo sé', "I don't know")}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <Shell
      step={step}
      gained={over ? points : 0}
      panel={panel}
      stage={
        <MapView
          ref={map}
          deck={deck}
          paint={paint}
          pinned={pinned}
          labels={over ? 'all' : undefined}
          blind={!over}
          flash={flash}
          tip={(id) => (over || guesses.includes(id) ? deck.byId.get(id)?.name : null)}
        />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 2 · Point at five regions
// ---------------------------------------------------------------------------

export function PinFive({ deck, targets, hard = false, step, onScore, onDone }: TestProps & { deck: Deck; targets: string[]; hard?: boolean }) {
  const [at, setAt] = useState(0);
  const [missed, setMissed] = useState(0);
  const [marks, setMarks] = useState<Record<string, Res>>({});
  const [phase, setPhase] = useState<'ask' | 'shown' | 'end'>('ask');
  const [note, setNote] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const map = useRef<MapHandle>(null);
  const cur = targets[Math.min(at, targets.length - 1)];
  const item = deck.byId.get(cur)!;
  const fem = deck.noun.fem;
  const TRIES = pinTriesOf(hard);

  const advance = () => {
    setNote(null);
    setMissed(0);
    // Where the map went to show the last answer, it comes back: the next one may be at the other end.
    map.current?.restore();
    if (at + 1 >= targets.length) setPhase('end');
    else {
      setAt(at + 1);
      setPhase('ask');
    }
  };

  const settle = (res: Res) => {
    setMarks((m) => ({ ...m, [cur]: res }));
    setFlash({ id: cur, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    setNote(null);
    setPhase('shown');
    if (res === 'bad') map.current?.focus([cur], { passing: true });
  };

  // A hit moves on by itself; a miss waits for the player to look at where it was.
  useEffect(() => {
    if (phase !== 'shown' || marks[cur] === 'bad') return;
    const t = setTimeout(advance, 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur]);

  const onPick = (id: string) => {
    if (phase !== 'ask') return;
    if (id === cur) return settle(missed === 0 ? 'ok' : 'warn');
    const other = deck.byId.get(id);
    if (!other) return;
    if (marks[id]) {
      setNote(L(`${other.name} ya está ${fem ? 'resuelta' : 'resuelto'}.`, `${other.name} is already solved.`));
      return;
    }
    setFlash({ id, kind: 'bad', n: Date.now() });
    if (missed + 1 >= TRIES) settle('bad');
    else {
      setMissed(missed + 1);
      setNote(L(`Eso es ${other.name}. Te queda un intento.`, `That is ${other.name}. One try left.`));
    }
  };

  const paint = useMemo(() => {
    const p: Record<string, Paint> = { ...marks };
    if (phase === 'shown' && marks[cur] === 'bad') p[cur] = 'target';
    return p;
  }, [marks, phase, cur]);
  const pinned = useMemo(() => new Set(Object.keys(marks)), [marks]);
  const count = { ok: 0, warn: 0, bad: 0 };
  for (const r of Object.values(marks)) count[r]++;
  const points = count.ok * 4 + count.warn * 2;
  useScore(phase === 'end', points, count.ok, onScore);

  const panel = (
    <div className="q">
      {phase === 'end' ? (
        <>
          <div className="q-prompt">
            <p className="kicker">{testName(1)}</p>
            <h2 className="q-ask">{L(`${count.ok} de ${targets.length} a la primera`, `${count.ok} of ${targets.length} at the first try`)}</h2>
          </div>
          <ul className="d-marks">
            {targets.map((id) => (
              <li key={id} className={`t-${marks[id]}`}>
                <span className="dot" />
                {deck.byId.get(id)!.name}
              </li>
            ))}
          </ul>
          <p className="d-points">
            +{points} {L('puntos', 'points')}
          </p>
          <div className="q-actions">
            <NextButton step={step} onClick={onDone} />
          </div>
        </>
      ) : (
        <>
          <div className="q-prompt">
            <p className="kicker">
              {L('Señala en el mapa', 'Find it on the map')} · {at + 1} / {targets.length}
            </p>
            <h2 className="q-name">{item.name}</h2>
          </div>
          {phase === 'ask' ? (
            <p className="q-how">
              <MapPin size={15} aria-hidden="true" />{' '}
              {note ??
                L(`Haz clic en ${fem ? 'la' : 'el'} ${deck.noun.one}. Tienes ${TRIES === 1 ? 'un solo intento' : 'dos intentos'}.`, `Click it on the map. You have ${TRIES === 1 ? 'one try only' : 'two tries'}.`)}
            </p>
          ) : marks[cur] === 'bad' ? (
            <>
              <Verdict res="bad" item={item} title={<>{L('Era aquí:', 'It was here:')} <b>{item.name}</b></>} />
              <div className="q-actions">
                <button type="button" className="btn btn-primary" onClick={advance} autoFocus>
                  {at + 1 >= targets.length ? L('Ver puntos', 'See the points') : L('Siguiente', 'Next')}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
              </div>
            </>
          ) : (
            <p className="q-how c-ok">
              <Check size={15} aria-hidden="true" /> {marks[cur] === 'ok' ? L('¡Correcto!', 'Correct!') : L('Correcto, a la segunda.', 'Correct, second try.')}
            </p>
          )}
        </>
      )}
    </div>
  );

  return (
    <Shell
      step={step}
      gained={phase === 'end' ? points : 0}
      panel={panel}
      stage={
        <MapView
          ref={map}
          deck={deck}
          paint={paint}
          pickable={phase === 'ask'}
          onPick={onPick}
          pinned={pinned}
          labels={phase === 'end' ? 'all' : undefined}
          flash={flash}
          tip={(id) => (phase === 'end' || marks[id] ? deck.byId.get(id)?.name : null)}
        />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 4 · Which country has this population?
// ---------------------------------------------------------------------------

export function WhichTest({ target, countries, continent, hard = false, step, onScore, onDone }: TestProps & { target: Country; countries: Country[]; continent: string; hard?: boolean }) {
  const list = useMemo(() => countries.filter((c) => (c.pop ?? 0) > 0), [countries]);
  const matcher = useMemo(() => new Matcher(list.map(countryAnswers)), [list]);
  const byId = useMemo(() => new Map(list.map((c) => [c.id, c])), [list]);
  const [guesses, setGuesses] = useState<Country[]>([]);
  const [state, setState] = useState<'play' | 'won' | 'lost'>('play');
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const over = state !== 'play';
  const real = target.pop!;

  const onSubmit = (text: string) => {
    if (over) return;
    const id = matcher.find(text)[0];
    const g = id ? byId.get(id) : undefined;
    if (!g) {
      setShake((n) => n + 1);
      setNote(matcher.vague(text) ? shortNote('vague', text) : L('No reconozco ese país.', 'I do not know that country.'));
      return;
    }
    if (guesses.some((x) => x.id === g.id)) {
      setShake((n) => n + 1);
      setNote(L(`${nm(g.n)} ya lo has probado.`, `You have already tried ${nm(g.n)}.`));
      return;
    }
    const next = [...guesses, g];
    setGuesses(next);
    setClear((n) => n + 1);
    setNote(null);
    if (g.id === target.id) setState('won');
    else if (next.length >= GUESSES) setState('lost');
  };

  const suggest = (text: string): Suggestion[] =>
    matcher
      .suggest(text, 6)
      .map((id) => byId.get(id)!)
      .map((c) => ({ id: c.id, label: nm(c.n), icon: <Flag code={c.fl} size="sm" /> }));

  const points = ladder(guesses.length, state === 'won');
  useScore(over, points, state === 'won' ? guesses.length : 0, onScore);

  return (
    <Shell
      step={step}
      gained={over ? points : 0}
      panel={
        <div className="pop d-which">
          <p className="kicker center">{L('¿Qué país tiene esta población?', 'Which country has this population?')}</p>
          <p className="bigfig">{fmtPop(real)}</p>
          {hard ? (
            // The hard way: nothing but the figure at first, and the continent after three misses.
            <p className="d-clues">
              {guesses.length >= HARD_CLUE_AT || over ? (
                <>
                  {L('Está en', 'It is in')} <b>{continent}</b>.
                </>
              ) : (
                L('Sin más pistas que la cifra.', 'No clue but the figure.')
              )}
            </p>
          ) : (
            <p className="d-clues">
              {L('Está en', 'It is in')} <b>{continent}</b>
              {guesses.length >= 3 || over ? (
                <>
                  {' '}
                  {L('y mide', 'and covers')} <b>{fmtArea(target.ar)}</b>
                </>
              ) : null}
              .
            </p>
          )}
          {!over && (
            <>
              <AnswerInput label={L('País', 'Country')} placeholder={L('Escribe un país…', 'Type a country…')} onSubmit={onSubmit} suggest={suggest} shake={shake} clear={clear} />
              <p className="q-note" role="status">
                {note ??
                  L(
                    `Cada intento te dice si te pasas o te quedas corto. ${GUESSES - guesses.length === 1 ? 'Te queda' : 'Te quedan'} ${GUESSES - guesses.length}${guesses.length < 3 ? `; al tercer fallo ${hard ? 'sabrás en qué continente está' : 'verás su superficie'}` : ''}.`,
                    `Each try tells you whether you are over or under. ${GUESSES - guesses.length} left${guesses.length < 3 ? `; after three misses you will ${hard ? 'be told its continent' : 'see its area'}` : ''}.`,
                  )}
              </p>
            </>
          )}
          {guesses.length > 0 && (
            <ul className="which-log">
              {guesses.map((g) => {
                const hit = g.id === target.id;
                return (
                  <li key={g.id} className={hit ? 'hit' : undefined}>
                    <Flag code={g.fl} size="sm" />
                    <b>{nm(g.n)}</b>
                    <span>{fmtPop(g.pop!)}</span>
                    {hit ? (
                      <Check size={16} aria-label={L('correcto', 'correct')} />
                    ) : g.pop! > real ? (
                      <em>
                        <ArrowDown size={14} aria-hidden="true" /> {L('busca uno menos poblado', 'look for a smaller one')}
                      </em>
                    ) : (
                      <em>
                        <ArrowUp size={14} aria-hidden="true" /> {L('busca uno más poblado', 'look for a bigger one')}
                      </em>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          {over && (
            <Verdict
              res={state === 'won' ? (guesses.length === 1 ? 'ok' : 'warn') : 'bad'}
              item={countryItem(target)}
              title={
                state === 'won' ? (
                  <>
                    {guesses.length === 1 ? L('¡A la primera!', 'First try!') : L(`Correcto, en ${guesses.length} ${tries(guesses.length)}:`, `Right, in ${guesses.length} ${tries(guesses.length)}:`)} <b>{nm(target.n)}</b>
                  </>
                ) : (
                  <>
                    {L('Era', 'It was')} <b>{nm(target.n)}</b>
                  </>
                )
              }
            >
              <p className="d-points">
                +{points} {L('puntos', 'points')}
              </p>
            </Verdict>
          )}
          <div className="q-actions center">
            {over ? (
              <NextButton step={step} onClick={onDone} />
            ) : (
              <button type="button" className="btn btn-sm" onClick={() => setState('lost')}>
                <X size={15} aria-hidden="true" />
                {L('No lo sé', "I don't know")}
              </button>
            )}
          </div>
        </div>
      }
    />
  );
}

// ---------------------------------------------------------------------------
// 5 · Five quick questions: flags and capitals
// ---------------------------------------------------------------------------

export function QuickFive({ questions, byId, step, onScore, onDone }: TestProps & { questions: QuickQuestion[]; byId: Map<string, Country> }) {
  const [at, setAt] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const ended = at >= questions.length;
  const q = questions[Math.min(at, questions.length - 1)];
  const c = byId.get(q.id)!;
  const hits = marks.filter(Boolean).length;
  const points = hits * 4;
  useScore(ended, points, hits, onScore);

  const answer = (id: string) => {
    if (picked || ended) return;
    setPicked(id);
    setMarks((m) => [...m, id === q.id]);
  };

  useEffect(() => {
    if (!picked) return;
    const t = setTimeout(
      () => {
        setPicked(null);
        setAt((n) => n + 1);
      },
      picked === q.id ? 800 : 1700,
    );
    return () => clearTimeout(t);
  }, [picked, q.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || picked || !/^[1-4]$/.test(e.key)) return;
      const id = q.options[Number(e.key) - 1];
      if (id) answer(id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const label = (id: string) => {
    const o = byId.get(id)!;
    return q.kind === 'capital' ? capName(o.cap!) : nm(o.n);
  };

  return (
    <Shell
      step={step}
      gained={ended ? points : 0}
      panel={
        <div className="pop d-quick">
          {ended ? (
            <>
              <p className="kicker center">{testName(4)}</p>
              <p className="bigfig">
                {hits} {L('de', 'of')} {questions.length}
              </p>
              <ul className="d-marks center">
                {questions.map((x, i) => {
                  const o = byId.get(x.id)!;
                  return (
                    <li key={x.id} className={marks[i] ? 't-ok' : 't-bad'}>
                      <span className="dot" />
                      <Flag code={o.fl} size="sm" /> {nm(o.n)}
                      {x.kind === 'capital' ? ` · ${capName(o.cap!)}` : ''}
                    </li>
                  );
                })}
              </ul>
              <p className="d-points center">
                +{points} {L('puntos', 'points')}
              </p>
              <div className="q-actions center">
                <NextButton step={step} onClick={onDone} />
              </div>
            </>
          ) : (
            <>
              <p className="kicker center">
                {q.kind === 'flag' ? L('¿De qué país es esta bandera?', 'Which country does this flag belong to?') : L('¿Cuál es la capital de…?', 'What is the capital of…?')} · {at + 1} / {questions.length}
              </p>
              {q.kind === 'flag' ? (
                <div className="d-flag">
                  <Flag code={c.fl} size="xl" />
                </div>
              ) : (
                <h2 className="d-country">
                  <Flag code={c.fl} size="md" /> {nm(c.n)}
                </h2>
              )}
              <div className="choices d-choices">
                {q.options.map((id, i) => (
                  <button key={id} type="button" className={cx('choice', picked && id === q.id && 'right', picked === id && id !== q.id && 'wrong')} disabled={!!picked} onClick={() => answer(id)}>
                    <kbd>{i + 1}</kbd>
                    <span>{label(id)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      }
    />
  );
}

/**
 * The same five questions the hard way: the answer is typed, with nothing to choose from. One try at each;
 * a slip of the finger is forgiven as in any typed answer, and letters that could be several things are
 * asked again instead of counted as a miss.
 */
export function QuickTyped({ questions, byId, countries, step, onScore, onDone }: TestProps & { questions: QuickQuestion[]; byId: Map<string, Country>; countries: Country[] }) {
  const names = useMemo(() => new Matcher(countries.map(countryAnswers)), [countries]);
  const capitals = useMemo(
    () =>
      new Matcher(
        countries.map((c) => capitalAnswers(countryItem(c))).filter((a): a is Answerable => !!a),
        { codes: false },
      ),
    [countries],
  );
  const [at, setAt] = useState(0);
  /** How the question in hand turned out, once it is answered. */
  const [shown, setShown] = useState<boolean | null>(null);
  const [marks, setMarks] = useState<boolean[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const ended = at >= questions.length;
  const q = questions[Math.min(at, questions.length - 1)];
  const c = byId.get(q.id)!;
  const hits = marks.filter(Boolean).length;
  const points = hits * 4;
  useScore(ended, points, hits, onScore);
  const right = q.kind === 'capital' ? capName(c.cap!) : nm(c.n);

  const settle = (hit: boolean) => {
    if (shown != null || ended) return;
    setShown(hit);
    setMarks((m) => [...m, hit]);
    setNote(null);
  };
  const advance = () => {
    setShown(null);
    setClear((n) => n + 1);
    setAt((n) => n + 1);
  };
  const onSubmit = (text: string) => {
    if (shown != null || ended) return;
    const verdict = (q.kind === 'capital' ? capitals : names).check(text, q.id);
    if (verdict.res === 'vague') {
      setShake((n) => n + 1);
      setNote(shortNote('vague', text));
      return;
    }
    settle(verdict.res === 'yes' || verdict.res === 'short');
  };

  // A hit moves on by itself; a miss waits for the player to read what it was.
  useEffect(() => {
    if (shown !== true) return;
    const t = setTimeout(advance, 800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, at]);

  return (
    <Shell
      step={step}
      gained={ended ? points : 0}
      panel={
        <div className="pop d-quick d-typed">
          {ended ? (
            <>
              <p className="kicker center">{testName(4)}</p>
              <p className="bigfig">
                {hits} {L('de', 'of')} {questions.length}
              </p>
              <ul className="d-marks center">
                {questions.map((x, i) => {
                  const o = byId.get(x.id)!;
                  return (
                    <li key={x.id} className={marks[i] ? 't-ok' : 't-bad'}>
                      <span className="dot" />
                      <Flag code={o.fl} size="sm" /> {nm(o.n)}
                      {x.kind === 'capital' ? ` · ${capName(o.cap!)}` : ''}
                    </li>
                  );
                })}
              </ul>
              <p className="d-points center">
                +{points} {L('puntos', 'points')}
              </p>
              <div className="q-actions center">
                <NextButton step={step} onClick={onDone} />
              </div>
            </>
          ) : (
            <>
              <p className="kicker center">
                {q.kind === 'flag' ? L('¿De qué país es esta bandera?', 'Which country does this flag belong to?') : L('¿Cuál es la capital de…?', 'What is the capital of…?')} · {at + 1} / {questions.length}
              </p>
              {q.kind === 'flag' ? (
                <div className="d-flag">
                  <Flag code={c.fl} size="xl" />
                </div>
              ) : (
                <h2 className="d-country">
                  <Flag code={c.fl} size="md" /> {nm(c.n)}
                </h2>
              )}
              {shown == null ? (
                <>
                  <AnswerInput
                    key={at}
                    label={q.kind === 'flag' ? L('País', 'Country') : L('Capital', 'Capital')}
                    placeholder={q.kind === 'flag' ? L('Escribe el país…', 'Type the country…') : L('Escribe la capital…', 'Type the capital…')}
                    onSubmit={onSubmit}
                    shake={shake}
                    clear={clear}
                    autoFocus
                  />
                  <p className="q-note" role="status">
                    {note ?? L('Un solo intento: escribe la respuesta y pulsa Intro.', 'One try only: type the answer and press Enter.')}
                  </p>
                  <div className="q-actions center">
                    <button type="button" className="btn btn-sm" onClick={() => settle(false)}>
                      <X size={15} aria-hidden="true" />
                      {L('No lo sé', "I don't know")}
                    </button>
                  </div>
                </>
              ) : shown ? (
                <p className="q-how c-ok d-typed-said" role="status">
                  <Check size={15} aria-hidden="true" /> {L('¡Correcto!', 'Correct!')} <b>{right}</b>
                </p>
              ) : (
                <>
                  <p className="q-how c-bad d-typed-said" role="status">
                    <X size={15} aria-hidden="true" /> {L('Era', 'It was')} <b>{right}</b>
                  </p>
                  <div className="q-actions center">
                    <button type="button" className="btn btn-primary" onClick={advance} autoFocus>
                      {at + 1 >= questions.length ? L('Ver puntos', 'See the points') : L('Siguiente', 'Next')}
                      <ArrowRight size={16} aria-hidden="true" />
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      }
    />
  );
}
