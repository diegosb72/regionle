/** Question-by-question games: pin on the map, jigsaw, identify, outline, capitals and flags. */
import { ArrowRight, Flag as FlagIcon, Lightbulb, MapPin } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { ChallengeBox } from '../components/ChallengeBox';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { silhouette } from '../lib/geo';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore, type Skill } from '../lib/store';
import { Matcher, cx, mulberry32, sample, shuffle } from '../lib/text';
import type { Item, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, nearest, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import { initQuiz, quizReducer, scoreOf } from './quiz';

type QuizMode = 'pin' | 'puzzle' | 'identify' | 'outline' | 'capital' | 'flag';

const SKILL: Record<QuizMode, Skill> = { pin: 'loc', puzzle: 'loc', identify: 'name', outline: 'name', capital: 'cap', flag: 'flag' };

/** "Te _ _ _ _" */
function letterHint(answer: string, shown: number): string {
  let left = shown;
  return [...answer].map((ch) => (/[\s\-'’.,()]/.test(ch) ? ch : left-- > 0 ? ch : '_')).join(' ');
}

export function QuizGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const mode = cfg.mode as QuizMode;
  const { opts } = cfg;
  /** Games answered by clicking on the map. */
  const clicky = mode === 'pin' || mode === 'puzzle';
  const pinBy = mode === 'pin' && deck.scope === 'countries' ? opts.pinBy : 'name';
  const typed = !clicky && opts.answer === 'type';
  const needsCapital = mode === 'capital' || pinBy === 'capital';
  const needsFlag = mode === 'flag' || pinBy === 'flag';
  const seed = useMemo(() => seedOf(cfg), [cfg]);

  /** Items that can be asked or offered as wrong options in this mode. */
  const usable = useMemo(
    () => deck.items.filter((it) => (!needsCapital || it.capital?.length) && (!needsFlag || it.country.fl) && (mode !== 'puzzle' || it.shape === 'area')),
    [deck, needsCapital, needsFlag, mode],
  );
  const pool = useMemo(() => (cfg.only ? usable.filter((it) => cfg.only!.includes(it.id)) : usable), [usable, cfg.only]);

  const [s, dispatch] = useReducer(quizReducer, null, () =>
    initQuiz(
      // Sorted first: the same seed must give the same questions whatever order the map was built in.
      pool.map((it) => it.id).sort(),
      cfg.only ? 'all' : opts.length,
      clicky,
      mulberry32(seed),
    ),
  );
  const item = s.cur ? (deck.byId.get(s.cur) ?? null) : null;
  const ended = s.phase === 'end';
  const ms = useElapsed(!ended);
  const map = useRef<MapHandle>(null);
  const record = useStore((st) => st.record);
  const addSession = useStore((st) => st.addSession);

  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [showMap, setShowMap] = useState(false);
  /** Pin hint: the only items still in play; the rest are dimmed. */
  const [narrow, setNarrow] = useState<Set<string> | null>(null);

  const names = useMemo(() => new Matcher(deck.items), [deck]);
  const capitals = useMemo(() => new Matcher(usable.filter((it) => it.capital?.length).map((it) => ({ id: it.id, answers: it.capital! }))), [usable]);
  const matcher = mode === 'capital' ? capitals : names;
  const answerOf = (it: Item) => (mode === 'capital' ? it.capital![0] : it.name);
  const maxTries = clicky || typed ? 3 : 1;
  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const one = deck.noun.one;
  /** "la provincia" · "the province" */
  const theOne = L(`${fem ? 'la' : 'el'} ${one}`, `the ${one}`);
  const left = (n: number) => L(`Te quedan ${n} ${n === 1 ? 'intento' : 'intentos'}.`, `${n} ${n === 1 ? 'try' : 'tries'} left.`);

  // Four options: the right one and three of its nearest neighbours.
  const choices = useMemo(() => {
    if (!item || typed || clicky) return [];
    const label = answerOf(item);
    const others = nearest(
      item,
      usable.filter((o) => answerOf(o) !== label),
      9,
    );
    const rng = mulberry32(seed + s.n * 7919);
    return shuffle([item, ...sample(others, 3, rng)], rng);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n]);

  // A first-time right answer moves on by itself.
  useEffect(() => {
    if (s.phase !== 'done' || s.last !== 'ok') return;
    const t = setTimeout(() => dispatch({ type: 'next' }), mode === 'pin' ? 650 : 1100);
    return () => clearTimeout(t);
  }, [s.phase, s.last, s.n, mode]);

  useEffect(() => {
    if (!ended || !s.asked) return;
    addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: deck.title, total: s.asked, ok: s.ok, warn: s.warn, bad: s.bad, ms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const settled = (res: Res, it: Item) => {
    if (s.round === 1) record(SKILL[mode], it.id, res, originOf(it, cfg));
    setFlash({ id: it.id, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    if (!clicky || res === 'bad') map.current?.focus([it.id]);
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

  const next = () => dispatch({ type: 'next' });

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
    const v = matcher.check(text, item.id);
    if (v.res === 'yes') return right();
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
    if (!item || s.phase !== 'ask') return;
    dispatch({ type: 'hint' });
    if (clicky) {
      // Narrow the search: the answer and a few of its nearest neighbours stay lit.
      const open = usable.filter((it) => !s.marks[it.id] || hidden.has(it.id));
      const keep = [item, ...nearest(item, open, Math.min(4, Math.max(1, Math.floor(open.length / 3))))].map((it) => it.id);
      setNarrow(new Set(keep));
      map.current?.focus(keep, { fill: 0.6 });
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
    const set = new Set<string>(s.round === 2 || s.endless ? s.queue : []);
    if (s.cur && s.phase === 'ask') set.add(s.cur);
    return set;
  }, [s.queue, s.cur, s.phase, s.round, s.endless]);

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
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={rows.length ? (s.bad === 0 && s.warn === 0 ? L('¡Pleno!', 'Full marks!') : s.bad === 0 ? L('¡Muy bien!', 'Well done!') : L('Partida terminada', 'Game over')) : L('Sin preguntas', 'No questions')}
            deck={deck}
            rows={rows}
            ms={ms}
            stats={[{ label: L('Mejor racha', 'Best streak'), value: s.bestStreak }]}
            onAgain={() => onAgain({ only: cfg.only, challenge: undefined })}
            onReview={(ids) => onAgain({ only: ids, challenge: undefined })}
            onExit={onExit}
          >
            {rows.length > 0 && s.asked >= s.total && <ChallengeBox cfg={cfg} score={score} ms={ms} what={`${deck.title} · ${title}`} />}
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
          <h2 className="q-name">{item.name}</h2>
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
          {s.hints > 0 && mode !== 'outline' && <p className="q-letters">{letterHint(answer, s.hints)}</p>}
          {s.hints > 1 && mode === 'outline' && <p className="q-letters">{letterHint(answer, s.hints - 1)}</p>}
        </>
      )}

      {asking && note && (
        <p className="q-note" role="status">
          {note}
          {typed && ` ${left(maxTries - s.tries)}`}
        </p>
      )}

      {!asking && s.last && (
        <Verdict res={s.last} title={verdictTitle} item={item} wiki={opts.wiki}>
          {s.phase === 'reveal' && <p className="q-how">{L(`Haz clic en ${theOne} que parpadea para seguir.`, `Click the blinking ${one} to go on.`)}</p>}
        </Verdict>
      )}

      <div className="q-actions">
        {asking ? (
          <>
            {(clicky || typed || mode === 'outline') && (
              <button type="button" className="btn btn-sm" onClick={hint} disabled={clicky ? s.hints > 0 : mode === 'outline' && !typed ? showMap : s.hints >= [...answer].length - 1}>
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
            {L('Siguiente', 'Next')}
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
      progress={Number.isFinite(s.total) ? s.asked / s.total : undefined}
      hud={<Hud ms={ms} streak={s.streak} progress={s.round === 2 ? L('Repaso', 'Review') : Number.isFinite(s.total) ? `${turn} / ${s.total}` : `${turn} · ${L('vuelta', 'lap')} ${s.lap}`} />}
      panel={panel}
      stage={stage}
    />
  );
}
