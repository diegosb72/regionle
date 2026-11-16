/** Question-by-question games: pin on the map, identify, outline, capitals and flags. */
import { ArrowRight, Flag as FlagIcon, Lightbulb, MapPin } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AnswerInput, type Suggestion } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { Flag } from '../components/ui';
import { silhouette } from '../lib/geo';
import { useStore, type Skill } from '../lib/store';
import { Matcher, cx, sample, shuffle } from '../lib/text';
import type { Item, Res } from '../lib/types';
import { GameShell, Hud, Results, Verdict, nearest, useElapsed, type GameProps, type ResultRow } from './common';
import { initQuiz, quizReducer } from './quiz';

type QuizMode = 'pin' | 'identify' | 'outline' | 'capital' | 'flag';

const TITLE: Record<QuizMode, string> = { pin: 'Señalar', identify: 'Identificar', outline: 'Silueta', capital: 'Capitales', flag: 'Banderas' };
const SKILL: Record<QuizMode, Skill> = { pin: 'loc', identify: 'name', outline: 'name', capital: 'cap', flag: 'flag' };

/** "Te _ _ _ _" */
function letterHint(answer: string, shown: number): string {
  let left = shown;
  return [...answer].map((ch) => (/[\s\-'’.,()]/.test(ch) ? ch : left-- > 0 ? ch : '_')).join(' ');
}

export function QuizGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const mode = cfg.mode as QuizMode;
  const { opts } = cfg;
  const pinBy = mode === 'pin' && deck.scope === 'countries' ? opts.pinBy : 'name';
  const typed = mode !== 'pin' && opts.answer === 'type';
  const needsCapital = mode === 'capital' || pinBy === 'capital';
  const needsFlag = mode === 'flag' || pinBy === 'flag';

  /** Items that can be asked or offered as wrong options in this mode. */
  const usable = useMemo(
    () => deck.items.filter((it) => (!needsCapital || it.country.cap) && (!needsFlag || it.country.fl)),
    [deck, needsCapital, needsFlag],
  );
  const pool = useMemo(() => (cfg.only ? usable.filter((it) => cfg.only!.includes(it.id)) : usable), [usable, cfg.only]);

  const [s, dispatch] = useReducer(quizReducer, null, () =>
    initQuiz(
      pool.map((it) => it.id),
      cfg.only ? 'all' : opts.length,
      mode === 'pin',
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
  const capitals = useMemo(
    () => new Matcher(usable.filter((it) => it.country.cap).map((it) => ({ id: it.id, answers: [it.country.cap!.es, it.country.cap!.en, ...(it.country.cap!.al ?? [])] }))),
    [usable],
  );
  const matcher = mode === 'capital' ? capitals : names;
  const answerOf = (it: Item) => (mode === 'capital' ? it.country.cap!.es : it.name);
  const maxTries = mode === 'pin' || typed ? 3 : 1;
  const several = deck.countries.length > 1 && deck.scope === 'regions';

  // Four options: the right one and three of its nearest neighbours.
  const choices = useMemo(() => {
    if (!item || typed || mode === 'pin') return [];
    const label = answerOf(item);
    const others = nearest(
      item,
      usable.filter((o) => answerOf(o) !== label),
      9,
    );
    return shuffle([item, ...sample(others, 3)]);
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

  const settled = (res: Res, id: string) => {
    if (s.round === 1) record(SKILL[mode], id, res);
    setFlash({ id, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    if (mode !== 'pin' || res === 'bad') map.current?.focus([id]);
  };

  const right = () => {
    if (!item || s.phase !== 'ask') return;
    dispatch({ type: 'right' });
    setNote(null);
    settled(s.tries === 0 && s.hints === 0 ? 'ok' : 'warn', item.id);
  };

  const wrong = (message: string | null, blink?: string) => {
    if (!item || s.phase !== 'ask') return;
    const failed = s.tries + 1 >= maxTries;
    dispatch({ type: 'wrong', max: maxTries });
    setNote(failed ? null : message);
    setShake((n) => n + 1);
    if (failed) settled('bad', item.id);
    else if (blink) setFlash({ id: blink, kind: 'bad', n: Date.now() });
  };

  const giveUp = () => {
    if (!item || s.phase !== 'ask') return;
    dispatch({ type: 'giveup' });
    setNote(null);
    settled('bad', item.id);
  };

  const next = () => dispatch({ type: 'next' });

  const onPick = (id: string) => {
    if (!item || mode !== 'pin') return;
    if (s.phase === 'reveal') {
      if (id === item.id) next();
      return;
    }
    if (s.phase !== 'ask') return;
    if (id === item.id) return right();
    const other = deck.byId.get(id);
    if (!other) return;
    if (s.marks[id] && !hidden.has(id)) {
      setNote(`${other.name} ya está ${deck.noun.fem ? 'resuelta' : 'resuelto'}.`);
      return;
    }
    if (narrow && !narrow.has(id)) {
      setNote(`${other.name} está ${deck.noun.fem ? 'descartada' : 'descartado'}: busca entre ${deck.noun.fem ? 'las iluminadas' : 'los iluminados'}.`);
      return;
    }
    wrong(`Eso es ${other.name}.`, id);
  };

  const onSubmit = (text: string) => {
    if (!item || s.phase !== 'ask') return;
    const v = matcher.check(text, item.id);
    if (v.res === 'yes') return right();
    if (v.res === 'other') {
      const other = deck.byId.get(v.id)!;
      if (mode === 'capital') wrong(`${other.country.cap!.es} es la capital de ${other.name}.`);
      else wrong(`No es ${other.name}.`, mode === 'identify' ? v.id : undefined);
    } else wrong('No es correcto.');
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
    if (mode === 'pin') {
      // Narrow the search: the answer and a few of its nearest neighbours stay lit.
      const open = deck.items.filter((it) => !s.marks[it.id] || hidden.has(it.id));
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

  const suggest = useMemo(() => {
    if (!typed || !opts.suggest) return undefined;
    return (text: string): Suggestion[] =>
      matcher
        .suggest(text, 6)
        .map((id) => deck.byId.get(id))
        .filter((it): it is Item => !!it)
        .map((it) => ({ id: it.id, label: answerOf(it), sub: mode === 'capital' ? undefined : several ? it.country.n.es : undefined }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed, opts.suggest, matcher, deck, mode, several]);

  // ------------------------------------------------------------------ render

  const stage = (
    <>
      <MapView
        ref={map}
        deck={deck}
        paint={paint}
        pickable={mode === 'pin' && !ended}
        onPick={onPick}
        labels={labels}
        pinned={pinned}
        flash={flash}
        tip={(id) => (ended || (s.marks[id] && !hidden.has(id)) ? deck.byId.get(id)?.name : null)}
      />
      {mode === 'outline' && item && !ended && s.phase === 'ask' && !showMap && (
        <div className="outline-stage">
          <svg viewBox="0 0 400 400" role="img" aria-label="Silueta que hay que reconocer">
            <path d={outlinePath} />
          </svg>
        </div>
      )}
    </>
  );

  if (ended) {
    const rows: ResultRow[] = Object.entries(s.results).map(([id, res]) => ({ item: deck.byId.get(id)!, res }));
    return (
      <GameShell
        title={TITLE[mode]}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={rows.length ? (s.bad === 0 && s.warn === 0 ? '¡Pleno!' : s.bad === 0 ? '¡Muy bien!' : 'Partida terminada') : 'Sin preguntas'}
            deck={deck}
            rows={rows}
            ms={ms}
            stats={[{ label: 'Mejor racha', value: s.bestStreak }]}
            onAgain={() => onAgain({ only: cfg.only })}
            onReview={(ids) => onAgain({ only: ids })}
            onExit={onExit}
          />
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
            <p className="kicker">Señala el país de esta bandera</p>
            <Flag code={c.fl} size="xl" className="q-flag" />
          </>
        );
      if (pinBy === 'capital')
        return (
          <>
            <p className="kicker">Señala el país cuya capital es</p>
            <h2 className="q-name">{c.cap!.es}</h2>
          </>
        );
      return (
        <>
          <p className="kicker">Señala en el mapa</p>
          <h2 className="q-name">{item.name}</h2>
          {several && (
            <p className="q-sub">
              <Flag code={c.fl} size="sm" /> {item.type} de {c.n.es}
            </p>
          )}
        </>
      );
    }
    if (mode === 'identify')
      return (
        <>
          <p className="kicker">Identifica</p>
          <h2 className="q-ask">
            ¿Qué {deck.noun.one} está {deck.noun.fem ? 'resaltada' : 'resaltado'} en el mapa?
          </h2>
        </>
      );
    if (mode === 'outline')
      return (
        <>
          <p className="kicker">Silueta</p>
          <h2 className="q-ask">
            ¿Qué {deck.noun.one} tiene esta forma?
            {several && s.hints > 0 && <small> Está en {c.n.es}.</small>}
          </h2>
        </>
      );
    if (mode === 'capital')
      return (
        <>
          <p className="kicker">¿Cuál es la capital de…?</p>
          <h2 className="q-name">
            <Flag code={c.fl} size="md" /> {item.name}
          </h2>
        </>
      );
    return (
      <>
        <p className="kicker">¿De qué país es esta bandera?</p>
        <Flag code={c.fl} size="xl" className="q-flag" />
      </>
    );
  })();

  const asking = s.phase === 'ask';
  const turn = asking ? s.asked + 1 : s.asked;
  const verdictTitle =
    s.last === 'ok' ? (
      mode === 'pin' ? '¡Correcto!' : <>¡Correcto! <b>{answer}</b></>
    ) : s.last === 'warn' ? (
      <>Bien, con ayuda: <b>{answer}</b></>
    ) : mode === 'pin' ? (
      <>
        Era aquí: <b>{item?.name}</b>
      </>
    ) : (
      <>
        Era <b>{answer}</b>
      </>
    );

  const panel = (
    <div className="q">
      {s.round === 2 && <p className="q-round">Repaso de fallos · quedan {s.queue.length + (asking ? 1 : 0)}</p>}
      <div className="q-prompt">{question}</div>

      {asking && mode === 'pin' && (
        <p className="q-how">
          <MapPin size={15} aria-hidden="true" /> Haz clic en {deck.noun.fem ? 'la' : 'el'} {deck.noun.one}. Te quedan {maxTries - s.tries} {maxTries - s.tries === 1 ? 'intento' : 'intentos'}.
        </p>
      )}

      {mode !== 'pin' && !typed && (
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
            label="Tu respuesta"
            placeholder={mode === 'capital' ? 'Escribe la capital…' : `Escribe ${deck.noun.fem ? 'la' : 'el'} ${deck.noun.one}…`}
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
          {typed && ` Te quedan ${maxTries - s.tries} ${maxTries - s.tries === 1 ? 'intento' : 'intentos'}.`}
        </p>
      )}

      {!asking && s.last && (
        <Verdict res={s.last} title={verdictTitle} item={item}>
          {s.phase === 'reveal' && <p className="q-how">Haz clic en {deck.noun.fem ? 'la' : 'el'} {deck.noun.one} que parpadea para seguir.</p>}
        </Verdict>
      )}

      <div className="q-actions">
        {asking ? (
          <>
            {(mode === 'pin' || typed || mode === 'outline') && (
              <button type="button" className="btn btn-sm" onClick={hint} disabled={mode === 'pin' ? s.hints > 0 : mode === 'outline' && !typed ? showMap : s.hints >= [...answer].length - 1}>
                <Lightbulb size={15} aria-hidden="true" />
                {mode === 'pin' ? 'Pista' : mode === 'outline' && (!showMap || !typed) ? 'Ver en el mapa' : 'Una letra'}
              </button>
            )}
            <button type="button" className="btn btn-sm" onClick={giveUp}>
              No lo sé
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={next} autoFocus={s.last !== 'ok'}>
            Siguiente
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => dispatch({ type: 'finish' })}>
          <FlagIcon size={15} aria-hidden="true" />
          Terminar
        </button>
      </div>
    </div>
  );

  return (
    <GameShell
      title={TITLE[mode]}
      subtitle={deck.title}
      onExit={onExit}
      progress={Number.isFinite(s.total) ? s.asked / s.total : undefined}
      hud={<Hud ms={ms} streak={s.streak} progress={s.round === 2 ? 'Repaso' : Number.isFinite(s.total) ? `${turn} / ${s.total}` : `${turn} · vuelta ${s.lap}`} />}
      panel={panel}
      stage={stage}
    />
  );
}
