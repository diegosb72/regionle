/**
 * Flashcards: a card for each piece. The player thinks of the answer, turns the card over and says whether
 * they knew it; nothing is typed and nothing is clicked on the map. What was not known comes back at the end.
 */
import { Check, Eye, Flag as FlagIcon, Minus, X } from 'lucide-react';
import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { SpeakButton } from '../components/Speak';
import { PieceNote } from '../components/Note';
import { Flag, StudyLinks } from '../components/ui';
import { seedOf } from '../lib/challenge';
import { L, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { useStore, type CardAsk, type Skill } from '../lib/store';
import { cx, mulberry32 } from '../lib/text';
import type { Res } from '../lib/types';
import { GameShell, Hud, ItemFacts, Results, originOf, showsCountry, useElapsed, type GameProps, type ResultRow } from './common';
import { FLAG_BLUR, cardAskOf, cardable, initQuiz, quizReducer } from './quiz';

/** What each kind of card teaches, for the review: the same as the game that asks the same thing. */
const SKILL: Record<CardAsk, Skill> = { name: 'name', where: 'loc', capital: 'cap', flag: 'flag' };

/** What the player says of a card, from worst to best: the keys 1, 2 and 3. */
const GRADES: readonly Res[] = ['bad', 'warn', 'ok'];

export function CardsGame({ deck, cfg, onExit, onAgain }: GameProps) {
  const { opts } = cfg;
  const seed = useMemo(() => seedOf(cfg), [cfg]);
  /** What the cards ask for: the choice of the player, where this map has it. */
  const ask = useMemo(() => cardAskOf(opts.cardAsk, deck), [opts.cardAsk, deck]);
  const pool = useMemo(() => deck.items.filter((it) => cardable(it, ask) && (!cfg.only || cfg.only.includes(it.id))), [deck, ask, cfg.only]);
  const [s, dispatch] = useReducer(quizReducer, null, () =>
    initQuiz(
      // Sorted first: the same seed must give the same cards whatever order the map was built in.
      pool.map((it) => it.id).sort(),
      // A pack of cards has an end: what was not known comes back once, and that is all.
      cfg.only || opts.length === 'endless' ? 'all' : opts.length,
      false,
      mulberry32(seed),
    ),
  );
  /**
   * The card that has been turned over, by its number: the next one is face up from the moment it comes,
   * with no frame in between where its answer could be seen.
   */
  const [turnedAt, setTurnedAt] = useState(-1);
  const turned = turnedAt === s.n;
  const item = s.cur ? (deck.byId.get(s.cur) ?? null) : null;
  const ended = s.phase === 'end';
  const ms = useElapsed(!ended);
  const map = useRef<MapHandle>(null);
  /** The answer on the other side of the card: where the panel is short it is brought into sight when the card is turned. */
  const back = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const record = useStore((st) => st.record);
  const addSession = useStore((st) => st.addSession);
  const bump = useStore((st) => st.bump);
  const several = showsCountry(deck);
  const fem = deck.noun.fem;
  const one = deck.noun.one;
  /** The map shows the piece from the start when the card asks about what is on it. */
  const lit = ask === 'name' || ask === 'capital';

  // A new card: read from its top, and the map where the card needs it.
  useEffect(() => {
    card.current?.closest('.panel')?.scrollTo?.({ top: 0 });
    if (!s.cur) return;
    // Naming what the map shows needs a close look; where the map is the answer, it starts whole.
    if (lit) map.current?.focus([s.cur]);
    else map.current?.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.n]);

  // On a phone the panel is short and the three answers keep to its bottom edge: the answer must not be left under them.
  useEffect(() => {
    if (turned) back.current?.scrollIntoView?.({ block: 'nearest' });
  }, [turned]);

  useEffect(() => {
    if (!ended || !s.asked) return;
    addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: cfg.list ? `${deck.title} · ${cfg.list}` : deck.title, total: s.asked, ok: s.ok, warn: s.warn, bad: s.bad, ms });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ended]);

  const turn = () => {
    if (!item || turned || ended) return;
    setTurnedAt(s.n);
    // The answer is a place: the map goes to it.
    if (!lit) map.current?.focus([item.id], { passing: true });
  };

  /** The player's own verdict on the card in hand, and on to the next one. */
  const grade = (res: Res) => {
    if (!item || !turned || s.phase !== 'ask') return;
    // What is kept for the review is the first time a card comes up, as in the games that mark the answers.
    if (s.round === 1) {
      record(SKILL[ask], item.id, res, originOf(item, cfg));
      // Cards gone through, for the achievement: the ones that come back are the same cards.
      bump({ cards: 1 });
    }
    if (res === 'warn') dispatch({ type: 'hint' });
    dispatch(res === 'bad' ? { type: 'giveup', reveal: false } : { type: 'right' });
    dispatch({ type: 'next' });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (ended || e.ctrlKey || e.metaKey || e.altKey) return;
      if (turned && /^[1-3]$/.test(e.key)) {
        e.preventDefault();
        return grade(GRADES[Number(e.key) - 1]);
      }
      // On a button, Enter and the space bar press that button.
      if (e.target instanceof Element && e.target.closest('button, input, a, select, textarea, summary')) return;
      if (!turned && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        turn();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Cards that will come up again must not be given away by a colour or a name. */
  const waiting = useMemo(() => new Set(ended ? [] : [...s.queue, ...(s.cur ? [s.cur] : [])]), [s.queue, s.cur, ended]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const [id, res] of Object.entries(s.marks)) if (!waiting.has(id)) p[id] = res;
    if (item && !ended && (lit || turned)) p[item.id] = 'target';
    return p;
  }, [s.marks, waiting, item, ended, lit, turned]);
  const pinned = useMemo(() => (item && !ended && turned ? new Set([item.id]) : undefined), [item, ended, turned]);

  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = ended ? undefined : item?.id;

  const title = MODE_NAME.cards;
  const stage = (
    <MapView
      ref={map}
      deck={deck}
      paint={paint}
      labels={ended ? 'all' : undefined}
      pinned={pinned}
      tip={(id) => (ended || (s.marks[id] && !waiting.has(id)) || (turned && id === item?.id) ? deck.byId.get(id)?.name : null)}
    />
  );

  if (ended) {
    const rows: ResultRow[] = Object.entries(s.results).map(([id, res]) => ({ item: deck.byId.get(id)!, res, note: ask === 'capital' ? deck.byId.get(id)!.capital?.[0] : undefined }));
    return (
      <GameShell
        title={title}
        subtitle={deck.title}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        stage={stage}
        panel={
          <Results
            title={!rows.length ? L('Sin tarjetas', 'No cards') : s.bad === 0 && s.warn === 0 ? L('¡Te las sabes todas!', 'You know them all!') : L('Tarjetas terminadas', 'Cards done')}
            note={rows.length ? L('Aquí la nota te la pones tú: «Lo sabía» cuenta como a la primera, «Casi» como con ayuda y «No lo sabía» queda para repasar.', 'Here you mark yourself: “I knew it” counts as first time, “Nearly” as with help, and “I did not know” is left to review.') : undefined}
            deck={deck}
            rows={rows}
            ms={ms}
            onAgain={() => onAgain({ only: cfg.only, list: cfg.list })}
            onReview={(ids) => onAgain({ only: ids, list: undefined })}
            onExit={onExit}
          />
        }
      />
    );
  }
  if (!item) return null;

  const c = item.country;
  /** The flag of a card is seen the way the player asked for until the card is turned over. */
  const look = turned ? 'plain' : (opts.flagLook ?? 'plain');
  const front =
    ask === 'name' ? (
      <>
        <p className="kicker">{L('¿Cómo se llama?', 'What is it called?')}</p>
        <h2 className="q-ask">
          {L(`${fem ? 'La' : 'El'} ${one} que está ${fem ? 'resaltada' : 'resaltado'} en el mapa`, `The ${one} highlighted on the map`)}
          {several && <small> {L(`Está en ${nm(c.n)}.`, `It is in ${nm(c.n)}.`)}</small>}
        </h2>
      </>
    ) : ask === 'flag' ? (
      <>
        <p className="kicker">{L('¿De qué país es esta bandera?', 'Which country does this flag belong to?')}</p>
        <span className={cx('q-flagbox', look !== 'plain' && `look-${look}`)} style={look === 'blur' ? ({ '--flag-blur': `${FLAG_BLUR[0]}px` } as CSSProperties) : undefined}>
          <Flag code={c.fl} size="xl" className="q-flag" />
        </span>
      </>
    ) : (
      <>
        <p className="kicker">{ask === 'capital' ? L('¿Cuál es la capital de…?', 'What is the capital of…?') : L('¿Dónde está?', 'Where is it?')}</p>
        <h2 className="q-name">
          {ask === 'capital' && (item.kind === 'country' || several) && <Flag code={c.fl} size="md" />} {item.name} <SpeakButton key={item.id} text={item.name} />
        </h2>
        {ask === 'where' && several && (
          <p className="q-sub">
            <Flag code={c.fl} size="sm" /> {L(`${item.type} de ${nm(c.n)}`, `${item.type} in ${nm(c.n)}`)}
          </p>
        )}
      </>
    );
  /** What the other side of the card says, and what is read aloud with it. */
  const answer = ask === 'capital' ? item.capital![0] : item.name;
  const left = s.queue.length + 1;

  return (
    <GameShell
      title={title}
      subtitle={deck.title}
      onExit={onExit}
      progress={Number.isFinite(s.total) ? s.asked / s.total : undefined}
      hud={<Hud ms={ms} progress={s.round === 2 ? L('Repaso', 'Review') : `${s.asked + 1} / ${s.total}`} />}
      stage={stage}
      panel={
        <div className="q">
          {s.round === 2 && <p className="q-round">{L(`Las que no sabías · ${left === 1 ? 'queda' : 'quedan'} ${left}`, `The ones you did not know · ${left} left`)}</p>}
          <div className={cx('fcard', turned && 'is-turned')} ref={card}>
            <div className="q-prompt">{front}</div>
            {turned && (
              <div className="fcard-back" role="status" aria-live="polite">
                <div className="fcard-said" ref={back}>
                  <p className="kicker">{ask === 'where' ? L('Está aquí', 'It is here') : L('Respuesta', 'Answer')}</p>
                  {ask === 'where' ? (
                    <p className="fcard-where">{L('El mapa te lo enseña: es la pieza resaltada.', 'The map shows you: it is the highlighted piece.')}</p>
                  ) : (
                    <h3 className="fcard-answer">
                      {ask === 'flag' && <Flag code={c.fl} size="md" />} {answer} <SpeakButton key={item.id} text={answer} />
                    </h3>
                  )}
                </div>
                <ItemFacts item={item} />
                <PieceNote key={item.id} id={item.id} />
                <StudyLinks item={item} />
              </div>
            )}
          </div>

          {turned ? (
            <div className="fcard-grades" role="group" aria-label={L('¿Lo sabías?', 'Did you know it?')}>
              <button type="button" className="fcard-grade g-bad" onClick={() => grade('bad')}>
                <kbd>1</kbd>
                <X size={16} aria-hidden="true" />
                <span>{L('No lo sabía', 'I did not know')}</span>
              </button>
              <button type="button" className="fcard-grade g-warn" onClick={() => grade('warn')}>
                <kbd>2</kbd>
                <Minus size={16} aria-hidden="true" />
                <span>{L('Casi', 'Nearly')}</span>
              </button>
              <button type="button" className="fcard-grade g-ok" onClick={() => grade('ok')}>
                <kbd>3</kbd>
                <Check size={16} aria-hidden="true" />
                <span>{L('Lo sabía', 'I knew it')}</span>
              </button>
            </div>
          ) : (
            <p className="q-how">{L('Piensa la respuesta antes de darle la vuelta. Nadie te corrige: luego dices tú si la sabías.', 'Think of the answer before you turn it over. Nobody marks you: you then say whether you knew it.')}</p>
          )}

          <div className="q-actions">
            {!turned && (
              <button key={s.n} type="button" className="btn btn-primary" onClick={turn} autoFocus>
                <Eye size={16} aria-hidden="true" />
                {L('Ver la respuesta', 'Show the answer')}
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost q-end" onClick={() => dispatch({ type: 'finish' })}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </div>
      }
    />
  );
}
