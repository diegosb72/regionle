/** Question-by-question games: pin on the map, jigsaw, identify, outline, capitals and flags. */
import { ArrowRight, Flag as FlagIcon, Heart, Lightbulb, MapPin, Timer } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { ChallengeBox } from '../components/ChallengeBox';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { SpeakButton } from '../components/Speak';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { silhouette } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME, formatName } from '../lib/modes';
import { useStore, type Format, type Skill } from '../lib/store';
import { Matcher, cx, fmtTime, hintMax, letterHint, mulberry32, sample, shortNote, shuffle, type Answerable } from '../lib/text';
import { capitalAnswers } from '../lib/typeins';
import type { Item, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, nearest, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import { answersItself, capitalsNeedTyping, initQuiz, quizReducer, scoreOf } from './quiz';

type QuizMode = 'pin' | 'puzzle' | 'identify' | 'outline' | 'capital' | 'flag';

const SKILL: Record<QuizMode, Skill> = { pin: 'loc', puzzle: 'loc', identify: 'name', outline: 'name', capital: 'cap', flag: 'flag' };

/** Against the clock: how long a game lasts. */
export const TIME_LIMIT = 60_000;
/** Survival: misses allowed. */
export const LIVES = 3;

export function QuizGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const mode = cfg.mode as QuizMode;
  const { opts } = cfg;
  /** Games answered by clicking on the map. */
  const clicky = mode === 'pin' || mode === 'puzzle';
  const pinBy = mode === 'pin' && deck.scope === 'countries' ? opts.pinBy : 'name';
  const needsCapital = mode === 'capital' || pinBy === 'capital';
  const needsFlag = mode === 'flag' || pinBy === 'flag';
  const seed = useMemo(() => seedOf(cfg), [cfg]);
  // Reviews, challenges and the repeat of what was missed are always a plain set of questions.
  const format: Format = cfg.review || cfg.challenge || (cfg.only && !cfg.list) ? 'normal' : (opts.format ?? 'normal');
  const paced = format !== 'normal';

  /** Items that can be offered as wrong options in this mode. */
  const usable = useMemo(
    () => deck.items.filter((it) => (!needsCapital || it.capital?.length) && (!needsFlag || it.country.fl) && (mode !== 'puzzle' || it.shape === 'area')),
    [deck, needsCapital, needsFlag, mode],
  );
  /**
   * Four options are no good where the wrong ones would be capitals named after their own region: there
   * the answer is typed, whatever the settings say.
   */
  const mustType = mode === 'capital' && opts.answer !== 'type' && !cfg.challenge?.legacy && capitalsNeedTyping(usable);
  const typed = !clicky && (opts.answer === 'type' || mustType);
  /** Items that can be asked: a place named after its capital would answer itself. */
  const askable = useMemo(() => {
    // A link from before this rule is played with the questions its sender had.
    if (!needsCapital || cfg.challenge?.legacy) return usable;
    // A review brings back what is due, and nothing may be left waiting for ever: the likeness that would
    // give an answer away among four options is let through, and only what answers itself is dropped.
    if (cfg.review) return mode === 'capital' ? usable.filter((it) => !answersItself(it, false)) : usable;
    return usable.filter((it) => !answersItself(it, !typed));
  }, [usable, needsCapital, typed, mode, cfg.review, cfg.challenge]);
  /** Capitals that were due for review and are no longer asked: taken off the tallies, or they would be due for ever. */
  const retired = useMemo(
    () => (mode === 'capital' && cfg.review && cfg.only ? usable.filter((it) => cfg.only!.includes(it.id) && answersItself(it, false)).map((it) => it.id) : []),
    [usable, mode, cfg.review, cfg.only],
  );
  const pool = useMemo(() => (cfg.only ? askable.filter((it) => cfg.only!.includes(it.id)) : askable), [askable, cfg.only]);

  const [s, dispatch] = useReducer(quizReducer, null, () =>
    initQuiz(
      // Sorted first: the same seed must give the same questions whatever order the map was built in.
      pool.map((it) => it.id).sort(),
      paced ? 'endless' : cfg.only ? 'all' : opts.length,
      // Against the clock there is no time to be shown where each miss was.
      clicky && format !== 'timed',
      mulberry32(seed),
    ),
  );
  const item = s.cur ? (deck.byId.get(s.cur) ?? null) : null;
  const ended = s.phase === 'end';
  const ms = useElapsed(!ended);
  const map = useRef<MapHandle>(null);
  const record = useStore((st) => st.record);
  const forget = useStore((st) => st.forget);
  const addSession = useStore((st) => st.addSession);
  const setBest = useStore((st) => st.setBest);
  const timeLeft = Math.max(0, TIME_LIMIT - ms);
  const lives = Math.max(0, LIVES - s.bad);
  /** Out of lives: the answer in hand is the last one. */
  const spent = format === 'lives' && lives === 0;
  /** Best mark of this map in the paced formats: 'new' when just beaten, the old one otherwise. */
  const [mark, setMark] = useState<'new' | number | null>(null);

  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [showMap, setShowMap] = useState(false);
  /** Pin hint: the only items still in play; the rest are dimmed. */
  const [narrow, setNarrow] = useState<Set<string> | null>(null);

  const names = useMemo(() => new Matcher(deck.items), [deck]);
  // Capitals are listed under the id of their place, whose code is not theirs.
  const capitals = useMemo(() => new Matcher(usable.map((it) => capitalAnswers(it)).filter((a): a is Answerable => !!a), { codes: false }), [usable]);
  const matcher = mode === 'capital' ? capitals : names;
  /** How many letters of the answer the hints have put in sight (the first hint of an outline is the map). */
  const lettersShown = !typed ? 0 : mode === 'outline' ? Math.max(0, s.hints - 1) : s.hints;
  const answerOf = (it: Item) => (mode === 'capital' ? it.capital![0] : it.name);
  // A paced game moves fast: one go at each question.
  const maxTries = paced ? 1 : clicky || typed ? 3 : 1;
  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const one = deck.noun.one;
  /** "la provincia" · "the province" */
  const theOne = L(`${fem ? 'la' : 'el'} ${one}`, `the ${one}`);
  const left = (n: number) => L(`${n === 1 ? 'Te queda' : 'Te quedan'} ${n} ${n === 1 ? 'intento' : 'intentos'}.`, `${n} ${n === 1 ? 'try' : 'tries'} left.`);

  // Four options: the right one and three of its nearest neighbours.
  const choices = useMemo(() => {
    if (!item || typed || clicky) return [];
    const label = answerOf(item);
    let cands = usable.filter((o) => o.id !== item.id && answerOf(o) !== label);
    // A capital named after its own place ("Madrid") is ruled out at a glance, and three of those leave the
    // answer standing alone: the wrong options are capitals that have to be known.
    if (mode === 'capital') {
      const hard = cands.filter((o) => !answersItself(o, true));
      if (hard.length >= 3) cands = hard;
    }
    // On a physical map a sea is told apart from a river at a glance: the wrong options are of the same kind.
    if (item.cat) {
      const same = cands.filter((o) => o.cat === item.cat);
      if (same.length >= 3) cands = same;
    }
    // What is already solved is labelled on the map and could be ruled out without knowing anything.
    const open = cands.filter((o) => !s.marks[o.id]);
    if (open.length >= 3) cands = open;
    const rng = mulberry32(seed + s.n * 7919);
    return shuffle([item, ...sample(nearest(item, cands, 9), 3, rng)], rng);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n]);

  // New question: clean the per-question state and, when a region lights up, bring it into view.
  useEffect(() => {
    setNote(null);
    setPicked(null);
    setShowMap(false);
    setClear((n) => n + 1);
    setNarrow(null);
    // Naming what the map shows needs a close look; for a capital, knowing where the country is will do.
    if (s.cur && mode === 'identify') map.current?.focus([s.cur]);
    // Where the map went to show the last answer, it comes back: the next one may be at the other end.
    else if (clicky) map.current?.restore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n]);

  // A first-time right answer moves on by itself; against the clock, so does a miss, after a look at the answer.
  useEffect(() => {
    if (s.phase !== 'done' || spent) return;
    if (s.last !== 'ok' && format !== 'timed') return;
    const t = setTimeout(() => dispatch({ type: 'next' }), s.last !== 'ok' ? 1400 : format === 'timed' ? 420 : mode === 'pin' ? 650 : 1100);
    return () => clearTimeout(t);
  }, [s.phase, s.last, s.n, mode, format, spent]);

  useEffect(() => {
    if (retired.length) forget('cap', retired);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Time is up.
  useEffect(() => {
    if (format === 'timed' && !ended && ms >= TIME_LIMIT) dispatch({ type: 'finish' });
  }, [format, ended, ms]);

  useEffect(() => {
    if (!ended || !s.asked) return;
    const what = cfg.list ? `${deck.title} · ${cfg.list}` : deck.title;
    addSession({
      t: Date.now(),
      section: cfg.section,
      mode: cfg.mode,
      label: what,
      total: s.asked,
      ok: s.ok,
      warn: s.warn,
      bad: s.bad,
      ms,
      ...(paced ? { note: format } : {}),
    });
    if (paced && !cfg.list) {
      const key = `${format}:${mode}:${deck.key}`;
      const prev = useStore.getState().best[key];
      const hits = s.ok + s.warn;
      // A game without a single right answer sets no record.
      setMark(hits > 0 && setBest(key, hits) ? 'new' : (prev ?? null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const settled = (res: Res, it: Item) => {
    if (s.round === 1) record(SKILL[mode], it.id, res, originOf(it, cfg));
    setFlash({ id: it.id, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    if (!clicky || res === 'bad') map.current?.focus([it.id], { passing: clicky });
  };

  const right = () => {
    if (!item || s.phase !== 'ask') return;
    dispatch({ type: 'right' });
    setNote(null);
    settled(s.tries === 0 && s.hints === 0 ? 'ok' : 'warn', item);
  };

  const wrong = (message: string | null, blink?: string) => {
    if (!item || s.phase !== 'ask') return;
    const failed = s.tries + 1 >= maxTries;
    dispatch({ type: 'wrong', max: maxTries });
    setNote(failed ? null : message);
    setShake((n) => n + 1);
    if (failed) settled('bad', item);
    else if (blink) setFlash({ id: blink, kind: 'bad', n: Date.now() });
  };

  const giveUp = () => {
    if (!item || s.phase !== 'ask') return;
    dispatch({ type: 'giveup' });
    setNote(null);
    settled('bad', item);
  };

  const next = () => dispatch(spent ? { type: 'finish' } : { type: 'next' });

  const onPick = (id: string) => {
    if (!item || !clicky) return;
    if (s.phase === 'reveal') {
      if (id === item.id) next();
      return;
    }
    if (s.phase !== 'ask') return;
    if (id === item.id) return right();
    const other = deck.byId.get(id);
    if (!other) return;
    if (s.marks[id] && !hidden.has(id)) {
      setNote(L(`${other.name} ya está ${fem ? 'resuelta' : 'resuelto'}.`, `${other.name} is already solved.`));
      return;
    }
    if (narrow && !narrow.has(id)) {
      setNote(L(`${other.name} está ${fem ? 'descartada' : 'descartado'}: busca entre ${fem ? 'las iluminadas' : 'los iluminados'}.`, `${other.name} is ruled out: look among the lit ones.`));
      return;
    }
    wrong(L(`Eso es ${other.name}.`, `That is ${other.name}.`), id);
  };

  const onSubmit = (text: string) => {
    if (!item || s.phase !== 'ask') return;
    // Letters of the answer in sight would spell its abbreviation out: the name has to be written.
    const v = matcher.check(text, item.id, { whole: lettersShown > 0 });
    if (v.res === 'yes') return right();
    if (v.res === 'short' || v.res === 'vague') {
      // Not a wrong answer: an abbreviation that does not count here, and why.
      setShake((n) => n + 1);
      setNote(shortNote(v.res, text));
      return;
    }
    if (v.res === 'other') {
      const other = deck.byId.get(v.id)!;
      if (mode === 'capital') wrong(L(`${other.capital![0]} es la capital de ${other.name}.`, `${other.capital![0]} is the capital of ${other.name}.`));
      else wrong(L(`No es ${other.name}.`, `It is not ${other.name}.`), mode === 'identify' ? v.id : undefined);
    } else wrong(L('No es correcto.', 'That is not right.'));
  };

  const onChoice = (id: string) => {
    if (!item || s.phase !== 'ask') return;
    if (id === item.id) right();
    else {
      setPicked(id);
      wrong(null);
    }
  };

  const hint = () => {
    if (!item || s.phase !== 'ask' || paced) return;
    dispatch({ type: 'hint' });
    if (clicky) {
      // Narrow the search: the answer and a few of its nearest neighbours stay lit.
      const open = usable.filter((it) => !s.marks[it.id] || hidden.has(it.id));
      const keep = [item, ...nearest(item, open, Math.min(4, Math.max(1, Math.floor(open.length / 3))))].map((it) => it.id);
      setNarrow(new Set(keep));
      map.current?.focus(keep, { fill: 0.6, passing: true });
    } else if (mode === 'outline') setShowMap(true);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea, summary')) return;
      if ((e.key === 'Enter' || e.key === ' ') && (s.phase === 'done' || s.phase === 'reveal')) {
        e.preventDefault();
        next();
      } else if (!typed && s.phase === 'ask' && /^[1-4]$/.test(e.key)) {
        const c = choices[Number(e.key) - 1];
        if (c) onChoice(c.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Items still to be asked must not give themselves away with a colour, a label or a tooltip. */
  const hidden = useMemo(() => {
    // Once the game is over nothing is left to ask: the map shows how every piece went.
    if (ended) return new Set<string>();
    const set = new Set<string>(s.round === 2 || s.endless ? s.queue : []);
    if (s.cur && s.phase === 'ask') set.add(s.cur);
    return set;
  }, [s.queue, s.cur, s.phase, s.round, s.endless, ended]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const [id, res] of Object.entries(s.marks)) if (!hidden.has(id)) p[id] = res;
    if (item && !ended) {
      if (s.phase === 'reveal' || (s.phase === 'ask' && (mode === 'identify' || mode === 'capital' || (mode === 'outline' && showMap)))) p[item.id] = 'target';
      if (narrow && s.phase === 'ask') for (const it of deck.items) if (!narrow.has(it.id) && !p[it.id]) p[it.id] = 'dim';
    }
    return p;
  }, [s.marks, s.phase, hidden, item, ended, mode, showMap, narrow, deck]);

  const labels = useMemo(() => {
    if (ended) return 'all' as const;
    if (!opts.labels) return undefined;
    return new Set(Object.keys(s.marks).filter((id) => !hidden.has(id)));
  }, [ended, opts.labels, s.marks, hidden]);

  const pinned = useMemo(() => (item && !ended && s.phase !== 'ask' ? new Set([item.id]) : undefined), [item, ended, s.phase]);

  const outlinePath = useMemo(() => (mode === 'outline' && item ? silhouette(item.geo, 400) : ''), [mode, item]);
  /** The jigsaw piece, drawn smaller the smaller it is next to the biggest one: size is a clue too. */
  const piece = useMemo(() => {
    if (mode !== 'puzzle' || !item) return null;
    const biggest = usable.reduce((m, it) => Math.max(m, it.area), 0) || 1;
    // The scale is compressed, or the small pieces of a map with one giant would be specks.
    return { d: silhouette(item.geo, 240, 0.04), k: Math.max(0.45, Math.min(1, (item.area / biggest) ** 0.3 * 1.1)) };
  }, [mode, item, usable]);

  const suggest = useMemo(() => {
    if (!typed || !opts.suggest) return undefined;
    return (text: string): Suggestion[] =>
      matcher
        .suggest(text, 6)
        .map((id) => deck.byId.get(id))
        .filter((it): it is Item => !!it)
        .map((it) => ({ id: it.id, label: answerOf(it), sub: mode === 'capital' ? undefined : several ? nm(it.country.n) : undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, opts.suggest, matcher, deck, mode, several]);

  // ------------------------------------------------------------------ render

  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = ended ? undefined : item?.id;

  const title = MODE_NAME[mode];
  const stage = (
    <>
      <MapView
        ref={map}
        deck={deck}
        paint={paint}
        pickable={clicky && !ended}
        onPick={onPick}
        labels={labels}
        pinned={pinned}
        flash={flash}
        blind={mode === 'puzzle' && !ended}
        tip={(id) => (ended || (s.marks[id] && !hidden.has(id)) ? deck.byId.get(id)?.name : null)}
      />
      {mode === 'outline' && item && !ended && s.phase === 'ask' && !showMap && (
        <div className="outline-stage">
          <svg viewBox="0 0 400 400" role="img" aria-label={L('Silueta que hay que reconocer', 'Outline to recognise')}>
            <path d={outlinePath} />
          </svg>
        </div>
      )}
    </>
  );

  if (ended) {
    const rows: ResultRow[] = Object.entries(s.results).map(([id, res]) => ({ item: deck.byId.get(id)!, res }));
    const score = scoreOf(s.ok, s.warn, s.asked);
    const hits = s.ok + s.warn;
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={
              !rows.length
                ? L('Sin preguntas', 'No questions')
                : paced
                  ? L(`${hits} ${hits === 1 ? 'acierto' : 'aciertos'}${format === 'timed' ? ' en un minuto' : ''}`, `${hits} right${format === 'timed' ? ' in a minute' : ''}`)
                  : s.bad === 0 && s.warn === 0
                    ? L('¡Pleno!', 'Full marks!')
                    : s.bad === 0
                      ? L('¡Muy bien!', 'Well done!')
                      : L('Partida terminada', 'Game over')
            }
            note={
              !rows.length && retired.length
                ? L(
                    `Lo que tocaba repasar eran capitales que se llaman como su ${one}: ya no se preguntan, así que salen del repaso.`,
                    `What was due were capitals named after their ${one}: they are no longer asked, so they leave the review.`,
                  )
                : !paced || !rows.length
                ? undefined
                : mark === 'new'
                  ? L(`Nuevo récord de ${formatName(format).toLowerCase()} en este mapa.`, `New ${formatName(format).toLowerCase()} record on this map.`)
                  : typeof mark === 'number'
                    ? L(`Tu récord de ${formatName(format).toLowerCase()} en este mapa: ${mark}.`, `Your ${formatName(format).toLowerCase()} record on this map: ${mark}.`)
                    : undefined
            }
            deck={deck}
            rows={rows}
            ms={ms}
            stats={[{ label: L('Mejor racha', 'Best streak'), value: s.bestStreak }]}
            again={rows.length > 0 || !retired.length}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list, challenge: undefined })}
            onReview={(ids) => onAgain({ only: ids, list: undefined, challenge: undefined })}
            onExit={onExit}
          >
            {rows.length > 0 && !paced && s.asked >= s.total && <ChallengeBox cfg={cfg} score={score} ms={ms} what={`${deck.title} · ${title}`} />}
          </Results>
        }
      />
    );
  }

  const answer = item ? answerOf(item) : '';
  const question = (() => {
    if (!item) return null;
    const c = item.country;
    if (mode === 'pin') {
      if (pinBy === 'flag')
        return (
          <>
            <p className="kicker">{L('Señala el país de esta bandera', 'Pin the country of this flag')}</p>
            <Flag code={c.fl} size="xl" className="q-flag" />
          </>
        );
      if (pinBy === 'capital')
        return (
          <>
            <p className="kicker">{L('Señala el país cuya capital es', 'Pin the country whose capital is')}</p>
            <h2 className="q-name">{item.capital![0]}</h2>
          </>
        );
      return (
        <>
          <p className="kicker">{L('Señala en el mapa', 'Find it on the map')}</p>
          <h2 className="q-name">
            {/* Once answered, the verdict below brings its own loudspeaker. */}
            {item.name} {s.phase === 'ask' && <SpeakButton key={item.id} text={item.name} />}
          </h2>
          {several && (
            <p className="q-sub">
              <Flag code={c.fl} size="sm" /> {L(`${item.type} de ${nm(c.n)}`, `${item.type} in ${nm(c.n)}`)}
            </p>
          )}
        </>
      );
    }
    if (mode === 'puzzle')
      return (
        <>
          <p className="kicker">{L('Puzle', 'Jigsaw')}</p>
          <h2 className="q-ask">{s.phase === 'ask' ? L('¿Dónde va esta pieza?', 'Where does this piece go?') : item.name}</h2>
          {piece && (
            <div className="piece">
              <svg viewBox="0 0 240 240" role="img" aria-label={L('Pieza que hay que colocar', 'Piece to place')}>
                <g transform={`translate(120 120) scale(${piece.k.toFixed(3)}) translate(-120 -120)`}>
                  <path d={piece.d} />
                </g>
              </svg>
            </div>
          )}
          {several && s.hints > 0 && (
            <p className="q-sub">
              <Flag code={c.fl} size="sm" /> {L(`Es de ${nm(c.n)}`, `It belongs to ${nm(c.n)}`)}
            </p>
          )}
        </>
      );
    if (mode === 'identify')
      return (
        <>
          <p className="kicker">{L('Identifica', 'Identify')}</p>
          <h2 className="q-ask">{L(`¿Qué ${one} está ${fem ? 'resaltada' : 'resaltado'} en el mapa?`, `Which ${one} is highlighted on the map?`)}</h2>
        </>
      );
    if (mode === 'outline')
      return (
        <>
          <p className="kicker">{L('Silueta', 'Outline')}</p>
          <h2 className="q-ask">
            {L(`¿Qué ${one} tiene esta forma?`, `Which ${one} has this shape?`)}
            {several && s.hints > 0 && <small> {L(`Está en ${nm(c.n)}.`, `It is in ${nm(c.n)}.`)}</small>}
          </h2>
        </>
      );
    if (mode === 'capital')
      return (
        <>
          <p className="kicker">{L('¿Cuál es la capital de…?', 'What is the capital of…?')}</p>
          <h2 className="q-name">
            {(item.kind === 'country' || several) && <Flag code={c.fl} size="md" />} {item.name}
          </h2>
        </>
      );
    return (
      <>
        <p className="kicker">{L('¿De qué país es esta bandera?', 'Which country does this flag belong to?')}</p>
        <Flag code={c.fl} size="xl" className="q-flag" />
      </>
    );
  })();

  const asking = s.phase === 'ask';
  const turn = asking ? s.asked + 1 : s.asked;
  const verdictTitle =
    s.last === 'ok' ? (
      mode === 'pin' ? (
        L('¡Correcto!', 'Correct!')
      ) : (
        <>
          {mode === 'puzzle' ? L('¡Encaja!', 'It fits!') : L('¡Correcto!', 'Correct!')} <b>{answer}</b>
        </>
      )
    ) : s.last === 'warn' ? (
      <>
        {L('Bien, con ayuda:', 'Right, with help:')} <b>{answer}</b>
      </>
    ) : clicky ? (
      <>
        {L('Era aquí:', 'It was here:')} <b>{item?.name}</b>
      </>
    ) : (
      <>
        {L('Era', 'It was')} <b>{answer}</b>
      </>
    );

  const panel = (
    <div className="q">
      {s.round === 2 && <p className="q-round">{L(`Repaso de fallos · quedan ${s.queue.length + (asking ? 1 : 0)}`, `Reviewing misses · ${s.queue.length + (asking ? 1 : 0)} left`)}</p>}
      <div className="q-prompt">{question}</div>

      {asking && clicky && (
        <p className="q-how">
          <MapPin size={15} aria-hidden="true" /> {mode === 'puzzle' ? L('Haz clic en su sitio en el mapa.', 'Click where it goes on the map.') : L(`Haz clic en ${theOne}.`, `Click ${theOne}.`)} {left(maxTries - s.tries)}
        </p>
      )}

      {!clicky && !typed && (
        <div className="choices">
          {choices.map((c, i) => {
            const isRight = !asking && c.id === item?.id;
            const isWrong = !asking && c.id === picked;
            return (
              <button key={c.id} type="button" className={cx('choice', isRight && 'right', isWrong && 'wrong')} disabled={!asking} onClick={() => onChoice(c.id)}>
                <kbd>{i + 1}</kbd>
                <span>{answerOf(c)}</span>
              </button>
            );
          })}
        </div>
      )}

      {typed && asking && (
        <>
          <AnswerInput
            label={L('Tu respuesta', 'Your answer')}
            placeholder={mode === 'capital' ? L('Escribe la capital…', 'Type the capital…') : L(`Escribe ${theOne}…`, `Type ${theOne}…`)}
            onSubmit={onSubmit}
            suggest={suggest}
            shake={shake}
            clear={clear}
          />
          {mustType && s.asked === 0 && s.tries === 0 && s.hints === 0 && (
            <p className="q-note">
              {L(
                `Aquí la respuesta se escribe: entre cuatro opciones, las demás capitales se llaman como su ${one} y dejarían la buena a la vista.`,
                `Here the answer is typed: among four options, the other capitals are named after their ${one} and would leave the right one in plain sight.`,
              )}
            </p>
          )}
          {lettersShown > 0 && <p className="q-letters">{letterHint(answer, lettersShown)}</p>}
        </>
      )}

      {asking && note && (
        <p className="q-note" role="status">
          {note}
          {typed && ` ${left(maxTries - s.tries)}`}
        </p>
      )}

      {!asking && s.last && (
        <Verdict res={s.last} title={verdictTitle} item={item} wiki={opts.wiki && format !== 'timed'} say={answer}>
          {s.phase === 'reveal' && <p className="q-how">{L(`Haz clic en ${theOne} que parpadea para seguir.`, `Click the blinking ${one} to go on.`)}</p>}
          {spent && <p className="q-how">{L('Te has quedado sin vidas.', 'You are out of lives.')}</p>}
        </Verdict>
      )}

      <div className="q-actions">
        {asking ? (
          <>
            {(clicky || typed || mode === 'outline') && !paced && (
              <button type="button" className="btn btn-sm" onClick={hint} disabled={clicky ? s.hints > 0 : mode === 'outline' && !typed ? showMap : s.hints >= hintMax(answer)}>
                <Lightbulb size={15} aria-hidden="true" />
                {clicky ? L('Pista', 'Hint') : mode === 'outline' && (!showMap || !typed) ? L('Ver en el mapa', 'Show on the map') : L('Una letra', 'A letter')}
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={giveUp}>
              {L('No lo sé', "I don't know")}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next} autoFocus={s.last !== 'ok'}>
            {spent ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => dispatch({ type: 'finish' })}>
          <FlagIcon size={15} aria-hidden="true" />
          {L('Terminar', 'Finish')}
        </button>
      </div>
    </div>
  );

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={format === 'timed' ? ms / TIME_LIMIT : Number.isFinite(s.total) ? s.asked / s.total : undefined}
      hud={
        format === 'timed' ? (
          <>
            <span className="hud-chip hud-main" title={L('Aciertos', 'Right answers')}>
              {s.ok}
            </span>
            <span className={cx('hud-chip hud-clock', timeLeft <= 10_000 && 'low')} title={L('Tiempo que queda', 'Time left')} role="timer">
              <Timer size={14} aria-hidden="true" />
              {fmtTime(timeLeft + 999)}
            </span>
          </>
        ) : format === 'lives' ? (
          <>
            <span className="hud-chip hud-main" title={L('Aciertos', 'Right answers')}>
              {s.ok}
            </span>
            <span className="hud-chip hud-lives" aria-label={L(`Vidas: ${lives} de ${LIVES}`, `Lives: ${lives} of ${LIVES}`)} title={L('Vidas', 'Lives')}>
              {Array.from({ length: LIVES }, (_, i) => (
                <Heart key={i} size={14} className={i < lives ? 'on' : undefined} aria-hidden="true" />
              ))}
            </span>
          </>
        ) : (
          <Hud ms={ms} streak={s.streak} progress={s.round === 2 ? L('Repaso', 'Review') : Number.isFinite(s.total) ? `${turn} / ${s.total}` : `${turn} · ${L('vuelta', 'lap')} ${s.lap}`} />
        )
      }
      panel={panel}
      stage={stage}
    />
  );
}
