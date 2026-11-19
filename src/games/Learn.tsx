/**
 * Learn: lessons of a few new pieces. Each lesson shows them one by one, asks where they are, asks what
 * they are called and ends by mixing them with pieces learnt before. What is asked lands in the same
 * tallies as every other game, so the spaced review takes over from there.
 */
import { ArrowLeft, ArrowRight, Check, Flag as FlagIcon, GraduationCap, Lightbulb, MapPin } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AnswerInput } from '../components/AnswerInput';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { PieceNote } from '../components/Note';
import { SpeakButton } from '../components/Speak';
import { Flag } from '../components/ui';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore } from '../lib/store';
import { Matcher, shortNote } from '../lib/matcher';
import { cx, hintMax, letterHint, nf, sample, shuffle } from '../lib/text';
import type { Item, Res } from '../lib/types';
import { GameShell, Hud, ItemFacts, Verdict, answered, nearest, originOf, showsCountry, useElapsed, type GameProps } from './common';
import { isIntroduced, lessonQueue, pickLesson, type Q } from './lesson';

const TRIES = 2;

export function LearnGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  const pool = useMemo(() => deck.items.filter((it) => !cfg.only || cfg.only.includes(it.id)), [deck, cfg.only]);
  const matcher = useMemo(() => new Matcher(deck.items), [deck]);
  const record = useStore((s) => s.record);
  const mixUp = useStore((s) => s.mixUp);
  const addSession = useStore((s) => s.addSession);
  const bump = useStore((s) => s.bump);
  const map = useRef<MapHandle>(null);

  const lessonAfter = (have: string[]): string[] => {
    const haveSet = new Set(have);
    return pickLesson(
      pool.filter((it) => !haveSet.has(it.id)),
      have.map((id) => deck.byId.get(id)).filter((it): it is Item => !!it),
      deck.scope,
    ).map((it) => it.id);
  };
  /** What the session starts from: the pieces already introduced, and the first lesson. */
  const [initial] = useState(() => {
    const stats = useStore.getState().stats;
    const have = pool.filter((it) => isIntroduced(stats, it.id)).map((it) => it.id);
    return { have, fresh: lessonAfter(have) };
  });
  /** Pieces the lessons can build on: introduced before this session or in its earlier lessons. */
  const [known, setKnown] = useState<string[]>(initial.have);
  /** Started over on a map that was already complete. */
  const [restarted, setRestarted] = useState(false);
  const [lesson, setLesson] = useState(initial.fresh.length ? 1 : 0);
  const [phase, setPhase] = useState<'intro' | 'quiz' | 'summary' | 'complete'>(initial.fresh.length ? 'intro' : 'complete');
  const [fresh, setFresh] = useState<string[]>(initial.fresh);
  const [introAt, setIntroAt] = useState(0);
  const [queue, setQueue] = useState<Q[]>([]);
  const [cur, setCur] = useState<Q | null>(null);
  const [asked, setAsked] = useState(0);
  const [planned, setPlanned] = useState(1);
  const [tries, setTries] = useState(0);
  const [letters, setLetters] = useState(0);
  const [verdict, setVerdict] = useState<Res | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [shake, setShake] = useState(0);
  const [clear, setClear] = useState(0);
  const [flash, setFlash] = useState<{ id: string; kind: 'bad' | 'ok'; n: number } | null>(null);
  const [tally, setTally] = useState({ ok: 0, warn: 0, bad: 0 });
  const [lessons, setLessons] = useState(0);
  const running = phase === 'intro' || phase === 'quiz';
  const ms = useElapsed(running);
  const lessonMs = useRef(0);

  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const one = deck.noun.one;
  const theOne = L(`${fem ? 'la' : 'el'} ${one}`, `the ${one}`);
  const title = MODE_NAME.learn;
  const knownSet = useMemo(() => new Set(known), [known]);
  const freshSet = useMemo(() => new Set(fresh), [fresh]);
  const item = cur ? (deck.byId.get(cur.id) ?? null) : null;
  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) {
    const w = window as unknown as { __ask?: string; __learn?: unknown };
    w.__ask = phase === 'quiz' && !verdict ? cur?.id : undefined;
    w.__learn = { phase, fresh, kind: cur?.kind, known: known.length };
  }

  const begin = (have: string[]) => {
    const next = lessonAfter(have);
    if (!next.length) {
      setPhase('complete');
      return;
    }
    setFresh(next);
    setIntroAt(0);
    setLesson(lesson + 1);
    setTally({ ok: 0, warn: 0, bad: 0 });
    setCur(null);
    setVerdict(null);
    setPhase('intro');
    lessonMs.current = ms;
  };

  // The map follows the piece being shown.
  useEffect(() => {
    if (phase === 'intro' && fresh[introAt]) map.current?.focus([fresh[introAt]], { fill: 0.35, force: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, introAt, fresh]);
  useEffect(() => {
    if (phase !== 'quiz' || !cur) return;
    if (cur.kind === 'name') map.current?.focus([cur.id]);
    // Everything that can be the answer has to be in sight; the map only moves when it is not.
    else map.current?.focus([...fresh, ...known], { fill: 0.85 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, cur]);

  const startQuiz = () => {
    const q = lessonQueue(fresh, known);
    setPlanned(q.length);
    setAsked(0);
    setQueue(q.slice(1));
    ask(q[0]);
    setPhase('quiz');
  };

  const ask = (q: Q) => {
    setCur(q);
    setTries(0);
    setLetters(0);
    setVerdict(null);
    setPicked(null);
    setNote(null);
    setClear((n) => n + 1);
  };

  const finishLesson = () => {
    const have = [...known, ...fresh.filter((id) => !knownSet.has(id))];
    setKnown(have);
    setLessons((n) => n + 1);
    setCur(null);
    setPhase('summary');
    const t = tally;
    addSession({ t: Date.now(), section: cfg.section, mode: 'learn', label: cfg.list ? `${deck.title} · ${cfg.list}` : deck.title, total: t.ok + t.warn + t.bad, ...t, ms: Math.max(0, ms - lessonMs.current) });
    bump({ lessons: 1 });
    map.current?.focus(fresh, { fill: 0.75, force: true });
  };

  const advance = () => {
    if (!queue.length) return finishLesson();
    ask(queue[0]);
    setQueue(queue.slice(1));
  };

  const settle = (res: Res) => {
    if (!cur || !item || verdict) return;
    setVerdict(res);
    setNote(null);
    setAsked((n) => n + 1);
    setTally((t) => ({ ...t, [res]: t[res] + 1 }));
    record(cur.kind === 'pin' ? 'loc' : 'name', item.id, res, originOf(item, cfg));
    setFlash({ id: item.id, kind: res === 'bad' ? 'bad' : 'ok', n: Date.now() });
    if (res === 'bad') {
      // What was missed comes back a few questions later: a lesson ends with everything answered right.
      const q = queue.slice();
      q.splice(Math.min(q.length, 2), 0, { ...cur });
      setQueue(q);
      setPlanned((n) => n + 1);
      map.current?.focus([item.id]);
    }
  };

  // A first-time right answer moves on by itself.
  useEffect(() => {
    if (verdict !== 'ok') return;
    const t = setTimeout(advance, 750);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verdict, cur]);

  const right = () => settle(tries === 0 && letters === 0 ? 'ok' : 'warn');
  const wrong = (message: string | null, blink?: string) => {
    if (tries + 1 >= TRIES) return settle('bad');
    setTries(tries + 1);
    setNote(message);
    setShake((n) => n + 1);
    answered('try');
    if (blink) setFlash({ id: blink, kind: 'bad', n: Date.now() });
  };

  /** Pieces in play: the ones of this lesson and the ones learnt before. */
  const live = (id: string) => freshSet.has(id) || knownSet.has(id);

  const onPick = (id: string) => {
    if (phase !== 'quiz' || !cur || !item || verdict || cur.kind !== 'pin') return;
    if (id === item.id) return right();
    const other = deck.byId.get(id);
    if (!other) return;
    if (!live(id)) return setNote(L(`${fem ? 'Esa' : 'Ese'} todavía no ${fem ? 'la' : 'lo'} hemos visto: busca entre ${fem ? 'las' : 'los'} que ya conoces.`, 'We have not seen that one yet: look among the ones you know.'));
    // One taken for another is written down, as in the games: the progress shows the pairs to tell apart.
    mixUp('loc', item.id, id);
    wrong(L(`Eso es ${other.name}. Te queda un intento.`, `That is ${other.name}. One try left.`), id);
  };

  const typed = !!cur && cur.kind === 'name' && !cur.easy && opts.answer === 'type';

  const onSubmit = (text: string) => {
    if (!item || verdict) return;
    // Letters of the answer in sight would spell its abbreviation out: the name has to be written.
    const v = matcher.check(text, item.id, { whole: letters > 0 });
    if (v.res === 'yes') return right();
    if (v.res === 'short' || v.res === 'vague') {
      setShake((n) => n + 1);
      setNote(shortNote(v.res, text));
      return;
    }
    if (v.res === 'other') mixUp('name', item.id, v.id);
    wrong(v.res === 'other' ? L(`No es ${deck.byId.get(v.id)!.name}. Te queda un intento.`, `It is not ${deck.byId.get(v.id)!.name}. One try left.`) : L('No es correcto. Te queda un intento.', 'That is not right. One try left.'));
  };

  // Four options: the right one and three of the nearest pieces already in play.
  const choices = useMemo(() => {
    if (!item || !cur || cur.kind !== 'name' || typed) return [];
    const others = deck.items.filter((o) => o.id !== item.id && o.name !== item.name);
    // On a physical map the kind can be seen (a river is a line, a peak a triangle): the
    // wrong options are of the same kind, or a peak among three rivers would answer itself.
    const alike = item.cat ? others.filter((o) => o.cat === item.cat) : others;
    const pool = alike.length >= 3 ? alike : others;
    let cands = pool.filter((o) => live(o.id));
    // Too few in play yet: the rest are borrowed from what is still to be taught.
    if (cands.length < 3) cands = [...cands, ...nearest(item, pool.filter((o) => !live(o.id)), 3 - cands.length)];
    return shuffle([item, ...sample(nearest(item, cands, 6), 3)]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur]);

  const onChoice = (id: string) => {
    if (!item || verdict) return;
    if (id === item.id) return right();
    setPicked(id);
    mixUp('name', item.id, id);
    // With four options a second go would be a guess between three: one try.
    settle('bad');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea, summary')) return;
      if (phase === 'quiz' && cur?.kind === 'name' && !typed && !verdict && /^[1-4]$/.test(e.key)) {
        const c = choices[Number(e.key) - 1];
        if (c) onChoice(c.id);
        return;
      }
      if (e.key !== 'Enter' && e.key !== ' ') return;
      if (phase === 'quiz' && verdict) {
        e.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    if (phase === 'complete') return p;
    // What has not been through a lesson yet stays in the background.
    for (const it of deck.items) if (!freshSet.has(it.id) && !knownSet.has(it.id)) p[it.id] = 'dim';
    if (phase === 'intro') {
      fresh.forEach((id, i) => {
        if (i < introAt) p[id] = 'near';
        else if (i > introAt) p[id] = 'dim';
      });
      if (fresh[introAt]) p[fresh[introAt]] = 'target';
    } else if (phase === 'summary') {
      for (const id of fresh) p[id] = 'ok';
    } else if (cur) {
      if (verdict) p[cur.id] = verdict === 'bad' ? 'target' : verdict;
      else if (cur.kind === 'name') p[cur.id] = 'target';
    }
    return p;
  }, [phase, deck, fresh, freshSet, knownSet, introAt, cur, verdict]);

  const pinned = useMemo(() => {
    if (phase === 'intro') return new Set(fresh.slice(0, introAt + 1));
    if (phase === 'summary') return new Set(fresh);
    if (phase === 'quiz' && cur && verdict) return new Set([cur.id]);
    return undefined;
  }, [phase, fresh, introAt, cur, verdict]);

  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      pinned={pinned}
      labels={phase === 'complete' ? 'all' : undefined}
      flash={flash}
      pickable={phase === 'quiz' && cur?.kind === 'pin' && !verdict}
      onPick={onPick}
      tip={(id) => (phase === 'complete' || (phase !== 'quiz' && live(id)) ? deck.byId.get(id)?.name : null)}
    />
  );

  const total = pool.length;
  const learnt = Math.min(total, known.length);
  const hud = <Hud ms={ms} progress={`${nf(learnt)} / ${nf(total)}`} />;
  const subtitle = cfg.list ? `${deck.title} · ${cfg.list}` : deck.title;

  if (phase === 'complete') {
    return (
      <GameShell
        title={title}
        subtitle={subtitle}
        onExit={onExit}
        hud={hud}
        stage={stage}
        panel={
          <div className="q learn">
            <div className="q-prompt">
              <p className="kicker">
                <GraduationCap size={15} aria-hidden="true" /> {L('Lecciones', 'Lessons')}
              </p>
              <h2 className="q-ask">{lessons || restarted ? L('¡Mapa completo!', 'Map complete!') : L('Este mapa ya lo has visto entero', 'You have already been through this whole map')}</h2>
              <p className="q-sub">
                {L(
                  `Ya has pasado por ${fem ? 'las' : 'los'} ${nf(total)} ${deck.noun.many}. El repaso de la portada te ${fem ? 'las' : 'los'} irá trayendo de vuelta antes de que se te olviden.`,
                  `You have been through all ${nf(total)} ${deck.noun.many}. The review on the home page will bring them back before you forget them.`,
                )}
              </p>
            </div>
            <div className="q-actions">
              <button type="button" className="btn btn-primary" onClick={() => onAgain({ mode: 'pin', only: cfg.only, list: cfg.list })} autoFocus>
                {L('Ponerme a prueba', 'Test myself')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setRestarted(true);
                  setKnown([]);
                  begin([]);
                }}
              >
                {L('Repetir las lecciones', 'Do the lessons again')}
              </button>
            </div>
          </div>
        }
      />
    );
  }

  if (phase === 'summary') {
    const left = total - learnt;
    return (
      <GameShell
        title={title}
        subtitle={subtitle}
        onExit={onExit}
        hud={hud}
        progress={1}
        stage={stage}
        panel={
          <div className="q learn">
            <div className="q-prompt">
              <p className="kicker">
                <GraduationCap size={15} aria-hidden="true" /> {L(`Lección ${lesson}`, `Lesson ${lesson}`)}
              </p>
              <h2 className="q-ask">{L('¡Lección completada!', 'Lesson complete!')}</h2>
            </div>
            <ul className="learn-list">
              {fresh.map((id) => {
                const it = deck.byId.get(id)!;
                return (
                  <li key={id}>
                    <Check size={15} aria-hidden="true" />
                    {several && <Flag code={it.country.fl} size="sm" />}
                    <b>{it.name}</b>
                  </li>
                );
              })}
            </ul>
            <div className="learn-meter" role="img" aria-label={L(`${learnt} de ${total}`, `${learnt} of ${total}`)}>
              <i style={{ width: `${Math.round((learnt / Math.max(1, total)) * 100)}%` }} />
            </div>
            <p className="q-note">
              {left > 0
                ? L(`Llevas ${nf(learnt)} de ${nf(total)} ${deck.noun.many}. ${tally.bad ? 'Lo que has fallado ha vuelto a salir hasta que lo has acertado.' : 'Sin un solo fallo.'}`, `You have ${nf(learnt)} of ${nf(total)} ${deck.noun.many}. ${tally.bad ? 'What you missed came back until you got it right.' : 'Not a single miss.'}`)
                : L(`Con esta lección has visto ${fem ? 'las' : 'los'} ${nf(total)} ${deck.noun.many} del mapa.`, `With this lesson you have seen all ${nf(total)} ${deck.noun.many} on the map.`)}
            </p>
            <div className="q-actions">
              <button type="button" className="btn btn-primary" onClick={() => begin(known)} autoFocus>
                {left > 0 ? L('Siguiente lección', 'Next lesson') : L('Terminar', 'Finish')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              {left > 0 && (
                <button type="button" className="btn btn-sm btn-ghost q-end" onClick={onExit}>
                  <FlagIcon size={15} aria-hidden="true" />
                  {L('Dejarlo aquí', 'Stop here')}
                </button>
              )}
            </div>
          </div>
        }
      />
    );
  }

  if (phase === 'intro') {
    const it = deck.byId.get(fresh[introAt]);
    const lastOne = introAt >= fresh.length - 1;
    return (
      <GameShell
        title={title}
        subtitle={subtitle}
        onExit={onExit}
        hud={hud}
        progress={0}
        stage={stage}
        panel={
          <div className="q learn">
            <div className="q-prompt">
              <p className="kicker">
                <GraduationCap size={15} aria-hidden="true" /> {L(`Lección ${lesson} · ${fem ? 'nueva' : 'nuevo'} ${introAt + 1} de ${fresh.length}`, `Lesson ${lesson} · new one ${introAt + 1} of ${fresh.length}`)}
              </p>
              {it && (
                <>
                  <h2 className="q-name">
                    {(it.kind === 'country' || several) && <Flag code={it.country.fl} size="md" />} {it.name} <SpeakButton text={it.name} />
                  </h2>
                  <ItemFacts item={it} />
                  <PieceNote key={it.id} id={it.id} />
                </>
              )}
            </div>
            <p className="q-how">{L('Fíjate en dónde está y en qué tiene alrededor. Luego te lo preguntamos.', 'Look at where it is and at what lies around it. You will be asked about it next.')}</p>
            <ol className="learn-steps" aria-hidden="true">
              {fresh.map((id, i) => (
                <li key={id} className={cx(i < introAt && 'done', i === introAt && 'on')} />
              ))}
            </ol>
            <div className="q-actions">
              {introAt > 0 && (
                <button type="button" className="btn btn-sm" onClick={() => setIntroAt(introAt - 1)}>
                  <ArrowLeft size={15} aria-hidden="true" />
                  {L('Anterior', 'Previous')}
                </button>
              )}
              <button type="button" className="btn btn-primary" onClick={lastOne ? startQuiz : () => setIntroAt(introAt + 1)} autoFocus key={introAt}>
                {lastOne ? L('Empezar a practicar', 'Start practising') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
              <button type="button" className="btn btn-sm btn-ghost q-end" onClick={onExit}>
                <FlagIcon size={15} aria-hidden="true" />
                {L('Salir', 'Exit')}
              </button>
            </div>
          </div>
        }
      />
    );
  }

  const asking = !verdict;
  return (
    <GameShell
      title={title}
      subtitle={subtitle}
      onExit={onExit}
      hud={hud}
      progress={asked / Math.max(1, planned)}
      stage={stage}
      panel={
        <div className="q learn">
          {item && cur && (
            <div className="q-prompt">
              {cur.kind === 'pin' ? (
                <>
                  <p className="kicker">{L(`Lección ${lesson} · señala en el mapa`, `Lesson ${lesson} · find it on the map`)}</p>
                  <h2 className="q-name">{item.name}</h2>
                  {several && (
                    <p className="q-sub">
                      <Flag code={item.country.fl} size="sm" /> {L(`${item.type} de ${nm(item.country.n)}`, `${item.type} in ${nm(item.country.n)}`)}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <p className="kicker">{L(`Lección ${lesson} · identifica`, `Lesson ${lesson} · identify`)}</p>
                  <h2 className="q-ask">{L(`¿Qué ${one} está ${fem ? 'resaltada' : 'resaltado'} en el mapa?`, `Which ${one} is highlighted on the map?`)}</h2>
                </>
              )}
            </div>
          )}

          {asking && cur?.kind === 'pin' && (
            <p className="q-how">
              <MapPin size={15} aria-hidden="true" /> {note ?? L(`Haz clic en ${theOne}. Tienes dos intentos.`, `Click ${theOne}. You have two tries.`)}
            </p>
          )}

          {cur?.kind === 'name' && !typed && (
            <div className="choices">
              {choices.map((c, i) => (
                <button key={c.id} type="button" className={cx('choice', !asking && c.id === item?.id && 'right', !asking && c.id === picked && 'wrong')} disabled={!asking} onClick={() => onChoice(c.id)}>
                  <kbd>{i + 1}</kbd>
                  <span>{c.name}</span>
                </button>
              ))}
            </div>
          )}

          {typed && asking && item && (
            <>
              <AnswerInput label={L('Tu respuesta', 'Your answer')} placeholder={L(`Escribe ${theOne}…`, `Type ${theOne}…`)} onSubmit={onSubmit} shake={shake} clear={clear} />
              {letters > 0 && <p className="q-letters">{letterHint(item.name, letters)}</p>}
              {note && (
                <p className="q-note" role="status">
                  {note}
                </p>
              )}
            </>
          )}

          {!asking && verdict && item && (
            <Verdict
              res={verdict}
              item={verdict === 'ok' ? null : item}
              title={
                verdict === 'ok' ? (
                  <>
                    {L('¡Correcto!', 'Correct!')} {cur?.kind === 'name' && <b>{item.name}</b>}
                  </>
                ) : verdict === 'warn' ? (
                  <>
                    {L('Bien, a la segunda:', 'Right, second go:')} <b>{item.name}</b>
                  </>
                ) : cur?.kind === 'pin' ? (
                  <>
                    {L('Era aquí:', 'It was here:')} <b>{item.name}</b>
                  </>
                ) : (
                  <>
                    {L('Era', 'It was')} <b>{item.name}</b>
                  </>
                )
              }
            >
              {verdict === 'bad' && <p className="q-how">{L('Volverá a salir dentro de un momento.', 'It will come back in a moment.')}</p>}
            </Verdict>
          )}

          <div className="q-actions">
            {asking ? (
              <>
                {typed && item && (
                  <button type="button" className="btn btn-sm" onClick={() => setLetters((n) => Math.min(hintMax(item.name), n + 1))} disabled={letters >= hintMax(item.name)}>
                    <Lightbulb size={15} aria-hidden="true" />
                    {L('Una letra', 'A letter')}
                  </button>
                )}
                <button type="button" className="btn btn-sm" onClick={() => settle('bad')}>
                  {L('No lo sé', "I don't know")}
                </button>
              </>
            ) : (
              <button type="button" className="btn btn-primary" onClick={advance} autoFocus={verdict !== 'ok'}>
                {L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost q-end" onClick={onExit}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Salir', 'Exit')}
            </button>
          </div>
        </div>
      }
    />
  );
}
