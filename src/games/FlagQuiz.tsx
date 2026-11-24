/**
 * The games of questions of the section «Banderas» (lib/flagGames.ts), which are one game asked eight ways:
 * a flag and its name among four or typed, a name and its flag among four (any four, or the three that
 * look most like it), a flag that is uncovered piece by piece, a flag of another time and the country that
 * flew it, the flag of a region and the country it is of, four flags of which one is from somewhere else,
 * and a climb of flags whose names are chosen among more and more, which three misses end. There is no
 * map: the whole window is the question. («Parejas» is no game of questions: games/FlagPairs.tsx.)
 *
 * One try for each flag, marked at once; what is missed is shown beside what it was taken for, and at the
 * end the misses can be played alone.
 *
 * Most of these flags are files that are fetched when they are first seen (lib/flags.ts): the flag that is
 * asked comes as the drawing it is, the four to choose from as the gallery shows them small, and what the
 * next question shows is asked for while this one is on screen. A picture that does not come is said, with
 * the way to ask for it again: a question cannot be answered without it.
 */
import { ArrowRight, Flag as FlagIcon, Heart, Images, RotateCcw, ScanEye, Settings2, TrendingUp } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type SyntheticEvent } from 'react';
import { AnswerInput } from '../components/AnswerInput';
import type { Near } from '../lib/flagAlike';
import {
  CLIMB_LIVES,
  REVEAL,
  REVEAL_PIECES,
  REVEAL_START,
  climbShown,
  flagBestKey,
  flagGameDef,
  flagMatcher,
  flagScore,
  judgeTyped,
  revealPoints,
  revealRes,
  roundOf,
  type FlagAnswered,
  type FlagExtra,
  type FlagPlay,
  type FlagQuestion,
} from '../lib/flagGames';
import type { DeckCard } from '../lib/flagSets';
import { yearsText } from '../lib/flags';
import { L, nm } from '../lib/i18n';
import { useStore } from '../lib/store';
import { cx, fmtTime, nf } from '../lib/text';
import type { Res } from '../lib/types';
import type { World } from '../lib/world';
import { Donut, GameShell, Hud, Verdict, useElapsed } from './common';
import './flagQuiz.css';

/** The shape of a flag, for the box it is drawn in. */
const shape = (ratio: number): CSSProperties => ({ '--r': String(ratio) }) as CSSProperties;

/** The pictures a question shows: the flag it asks, large, and the four it offers, as small as the gallery shows them. */
const picturesOf = (q: FlagQuestion, staged: boolean, flagged: boolean): string[] => [...(staged ? [q.card.src] : []), ...(flagged ? q.options.map((card) => card.small) : [])];

/** How many of some answers were not misses: in «Escalada», the rungs climbed. */
const rightOf = (answers: readonly FlagAnswered[]): number => answers.filter((a) => a.res !== 'bad').length;
const rungs = (n: number): string => L(n === 1 ? '1 peldaño' : `${nf(n)} peldaños`, n === 1 ? '1 rung' : `${nf(n)} rungs`);

/** When a flag of another time flew, as a sentence says it: «de 1931 a 1939», «hasta 1785», «en 1929»; nothing when it is not known. */
function flewText(years: readonly [number, number] | undefined): string {
  const [from, to] = years ?? [0, 0];
  if (from && to) return from === to ? L(`en ${from}`, `in ${from}`) : L(`de ${from} a ${to}`, `from ${from} to ${to}`);
  if (to) return L(`hasta ${to}`, `until ${to}`);
  return from ? L(`desde ${from}`, `from ${from}`) : '';
}

const resLabel = (res: Res): string => (res === 'bad' ? L('Para repasar', 'To review') : res === 'warn' ? L('Con ayuda', 'With help') : L('A la primera', 'First time'));

interface RoundProps {
  play: FlagPlay;
  deck: readonly DeckCard[];
  questions: readonly FlagQuestion[];
  /** What the flags are called together: «Regiones de España». */
  name: string;
  world: World;
  /** The game is of some flags only: those that were missed in the one before. */
  review: boolean;
  onExit(): void;
  /** The gallery, on the page of these flags. */
  onSee(): void;
  /** Another game: of the same flags, or of those whose keys are given. */
  onAgain(only?: ReadonlySet<string>): void;
}

function Round({ play, deck, questions, name, world, review, onExit, onSee, onAgain }: RoundProps) {
  const def = flagGameDef(play.game);
  const reveal = play.game === 'flag-reveal';
  /** «Antes y ahora»: a flag of another time, and four countries with their flags of today. */
  const past = play.game === 'flag-past';
  /** «El intruso»: four flags, one of them from outside the group. */
  const odd = play.game === 'flag-odd';
  /** «¿De qué país es?»: the flag of a region, and four countries with their flags. */
  const region = play.game === 'flag-land';
  /** «Escalada»: more names to choose from the higher it gets, and three misses end it. */
  const climb = play.game === 'flag-climb';
  /** What is asked is a flag, shown large, and what answers it is a name. */
  const named = play.game === 'flag-whose' || reveal || past || region || climb;
  /** The names are those of countries, and each comes with its flag. */
  const flagged = past || region;
  const typed = named && def.typed && play.answer === 'type';
  const total = questions.length;

  const [at, setAt] = useState(0);
  const [log, setLog] = useState<FlagAnswered[]>([]);
  /** What was answered to the question on screen; null while it is open. */
  const [given, setGiven] = useState<FlagAnswered | null>(null);
  const [shown, setShown] = useState(REVEAL_START);
  const [ended, setEnded] = useState(total === 0);
  /** What the game left written down when it ended: whether its mark is the best so far, and the one it beat. */
  const [mark, setMark] = useState<{ best: boolean; before?: number } | null>(null);
  /** A name typed that no flag of the set has: said, and not held against the player. */
  const [stray, setStray] = useState(0);
  /** A picture of the question on screen has not come; and how many times they have been asked for again. */
  const [lost, setLost] = useState(false);
  const [fetched, setFetched] = useState(0);
  /** The pictures asked for ahead of their question, held while they come. */
  const ahead = useRef<HTMLImageElement[]>([]);
  const ms = useElapsed(!ended);
  const matcher = useMemo(() => (typed ? flagMatcher(deck) : null), [typed, deck]);
  const uncoverRef = useRef<HTMLButtonElement>(null);

  const q = questions[at];
  const score = flagScore(play.game, log);
  let streak = 0;
  for (let i = log.length - 1; i >= 0 && log[i].res !== 'bad'; i--) streak++;
  /** «Escalada»: the rungs climbed, the lives left, and whether the last of them is gone. */
  const height = rightOf(log);
  const lives = Math.max(0, CLIMB_LIVES - score.bad);
  const fallen = climb && lives === 0;
  /** What the question on screen is answered among: in «Escalada», as many names as the height it was met at says, whatever was answered since. */
  const options = !q ? [] : climb ? climbShown(q, rightOf(log.slice(0, at))) : q.options;

  const land = (card: DeckCard): string => {
    const c = world.byId.get(card.country);
    return c ? nm(c.n) : '';
  };
  /** What tells a flag from another of the same name: the country of a capital (or of a region, where the country is what was asked), the years of a country that is no more or of a flag of another time. */
  const under = (card: DeckCard): string => (card.kind === 'capital' || (region && card.kind === 'region') ? land(card) : card.kind === 'gone' || card.kind === 'past' ? yearsText(card.years) : '');

  const finish = (answers: readonly FlagAnswered[]) => {
    if (ended) return;
    setEnded(true);
    if (!answers.length) return;
    const st = useStore.getState();
    const end = flagScore(play.game, answers);
    st.addSession({ t: Date.now(), section: 'flags', mode: play.game, label: name, total: end.total, ok: end.ok, warn: end.warn, bad: end.bad, ms, ...(review ? { note: L('solo los fallos', 'misses only') } : {}) });
    // A mark is of a whole game: one that was cut short, or of the misses alone, sets none. A climb is whole
    // wherever it stops, and its mark is how high it got.
    if (!review && (climb || answers.length === total)) {
      const key = flagBestKey(play);
      const before = st.best[key];
      setMark({ best: st.setBest(key, climb ? rightOf(answers) : end.pct), before });
    }
  };

  const answer = (res: Res, taken?: DeckCard) => {
    if (!q || given || ended) return;
    const rec: FlagAnswered = {
      card: q.card,
      res,
      ...(taken ? { given: taken } : {}),
      ...(q.odd ? { note: L(`${q.odd.tag} · la intrusa entre «${q.odd.group}»`, `${q.odd.tag} · the odd one out among “${q.odd.group}”`) } : {}),
      points: reveal && res !== 'bad' ? revealPoints(shown) : 0,
    };
    setGiven(rec);
    setLog((l) => [...l, rec]);
    setStray(0);
    // The flags of the countries are the ones the rest of the game knows: what is learnt here counts there too.
    // (Not where what is asked is something else: where a flag is from, or whose it was.)
    if (q.card.kind === 'country' && !odd) {
      const st = useStore.getState();
      st.record('flag', q.card.id, res, 'c');
      if (taken && taken.kind === 'country' && taken.id !== q.card.id) st.mixUp('flag', q.card.id, taken.id);
    }
  };
  const choose = (card: DeckCard) => answer(card.key === q?.right ? (reveal ? revealRes(shown) : 'ok') : 'bad', card.key === q?.right ? undefined : card);
  const submit = (text: string) => {
    if (!q || !matcher || given || !text.trim()) return;
    const verdict = judgeTyped(matcher, deck, q.card, text);
    if (verdict.res === 'right') answer(reveal ? revealRes(shown) : 'ok');
    else if (verdict.res === 'wrong') answer('bad', verdict.given);
    else setStray((n) => n + 1);
  };
  const uncover = () => {
    if (reveal && !given && !ended) setShown((n) => Math.min(REVEAL_PIECES, n + 1));
  };
  const next = () => {
    if (!given) return;
    if (at + 1 >= total || fallen) return finish(log);
    setAt(at + 1);
    setGiven(null);
    setShown(REVEAL_START);
    setLost(false);
  };
  /** A picture that did not come is put out of sight: what a browser draws in its place says nothing. */
  const gone = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add('lost');
  /** …and, when the question cannot be answered without it, said. */
  const missing = (e: SyntheticEvent<HTMLImageElement>) => {
    gone(e);
    setLost(true);
  };
  /** They are asked for again: each is drawn anew, the ones that came from what the browser kept of them. */
  const fetchAgain = () => {
    setLost(false);
    setFetched((n) => n + 1);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat || !q || ended) return;
      const el = e.target instanceof Element ? e.target : null;
      if (el?.closest('dialog[open]')) return;
      const field = el?.closest('input, textarea, select');
      if (field) {
        // The space bar uncovers while nothing has been typed: no name begins with a space.
        if (reveal && !given && e.key === ' ' && field instanceof HTMLInputElement && !field.value) {
          e.preventDefault();
          uncover();
        }
        return;
      }
      const onButton = !!el?.closest('button, a');
      if (!given) {
        if (/^[1-9]$/.test(e.key) && options[Number(e.key) - 1]) choose(options[Number(e.key) - 1]);
        else if (reveal && e.key === ' ' && !onButton) {
          e.preventDefault();
          uncover();
        }
      } else if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Where the answers are chosen, the keyboard starts on what uncovers: the space bar is then its own key.
  useEffect(() => {
    if (reveal && !typed && !given) uncoverRef.current?.focus({ preventScroll: true });
  }, [at, reveal, typed, given]);

  // What the next question shows is asked for while this one is on screen: its flag is there when its turn comes.
  useEffect(() => {
    const coming = questions[at + 1];
    if (!coming || typeof Image === 'undefined') return;
    ahead.current = picturesOf(coming, named, !named || flagged).map((src) => {
      const img = new Image();
      img.decoding = 'async';
      img.src = src;
      return img;
    });
  }, [questions, at, named, flagged]);

  /** A flag as it is shown small. `asked`: it is one of those the question is answered by, and is missed if it does not come. */
  const picture = (card: DeckCard, asked = false) => (
    <img key={asked ? `${card.key} ${fetched}` : undefined} style={shape(card.ratio)} src={card.small} alt="" decoding="async" draggable={false} onError={asked ? missing : gone} />
  );

  if (ended || !q) {
    const misses = log.filter((a) => a.res === 'bad');
    const title = !log.length
      ? L('Sin preguntas', 'No questions')
      : fallen
        ? L('Te quedaste sin vidas', 'Out of lives')
        : climb && !review && log.length === total
          ? L('¡Has llegado arriba!', 'You reached the top!')
          : misses.length === 0
            ? L('¡Ninguna fallada!', 'None missed!')
            : L('Partida terminada', 'Game over');
    /** «Escalada»: how many names the last flag came with. */
    const reached = climb && log.length ? climbShown(questions[log.length - 1], rightOf(log.slice(0, -1))).length : 0;
    return (
      <GameShell
        title={def.name}
        subtitle={name}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        panel={
          <div className="pop fq">
            <div className="results">
              <p className="kicker">{L('Resultado', 'Result')}</p>
              <h2 className="results-title">{title}</h2>
              {review && <p className="results-note">{L('Solo las banderas que fallaste en la partida anterior.', 'Only the flags you missed in the game before.')}</p>}
              {!climb && !!log.length && log.length < total && <p className="results-note">{L(`Terminaste antes de acabar: ${nf(log.length)} de ${nf(total)} preguntas.`, `You ended it early: ${nf(log.length)} of ${nf(total)} questions.`)}</p>}
              {climb && !!log.length && (
                <p className="results-note">
                  {height === 0
                    ? L('No subiste ningún peldaño.', 'You climbed no rung.')
                    : L(`Subiste ${rungs(height)}: al final elegías entre ${reached} nombres.`, `You climbed ${rungs(height)}: at the end you were choosing among ${reached} names.`)}
                </p>
              )}
              <div className="results-score">
                {climb ? (
                  <Donut ok={score.ok} warn={0} bad={score.bad} label={nf(height)} caption={L(height === 1 ? 'peldaño' : 'peldaños', height === 1 ? 'rung' : 'rungs')} />
                ) : (
                  <Donut ok={score.ok} warn={score.warn} bad={score.bad} label={`${score.pct} %`} caption={reveal ? `${nf(score.points)} / ${nf(score.max)} ${L('pts', 'pts')}` : `${nf(score.ok)} ${L('de', 'of')} ${nf(score.total)}`} />
                )}
                <dl className="results-stats">
                  <div>
                    <dt>{climb ? L('Altura', 'Height') : reveal ? L('A la primera', 'First time') : L('Aciertos', 'Right')}</dt>
                    <dd className="c-ok">{nf(score.ok)}</dd>
                  </div>
                  {reveal && (
                    <div>
                      <dt>{L('Con ayuda', 'With help')}</dt>
                      <dd className="c-warn">{nf(score.warn)}</dd>
                    </div>
                  )}
                  <div>
                    <dt>{L('Fallos', 'Misses')}</dt>
                    <dd className="c-bad">{nf(score.bad)}</dd>
                  </div>
                  <div>
                    <dt>{L('Tiempo', 'Time')}</dt>
                    <dd>{fmtTime(ms)}</dd>
                  </div>
                  {mark && (
                    <div>
                      <dt>{L('Tu marca', 'Your record')}</dt>
                      <dd className="fq-mark">
                        {climb
                          ? mark.best
                            ? mark.before != null
                              ? L(`¡Nueva! Antes, ${nf(mark.before)}`, `New! Before, ${nf(mark.before)}`)
                              : rungs(height)
                            : rungs(mark.before ?? height)
                          : mark.best
                            ? mark.before != null
                              ? L(`¡Nueva! Antes, ${nf(mark.before)} %`, `New! Before, ${nf(mark.before)}%`)
                              : `${score.pct} %`
                            : `${nf(mark.before ?? score.pct)} %`}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="results-actions">
                {total > 0 && (
                  <button type="button" className="btn btn-primary" onClick={() => onAgain()} autoFocus>
                    <RotateCcw size={16} aria-hidden="true" />
                    {review ? L('Jugar con todas', 'Play with all of them') : L('Otra vez', 'Again')}
                  </button>
                )}
                {misses.length > 0 && (
                  <button type="button" className="btn" onClick={() => onAgain(new Set(misses.map((a) => a.card.key)))}>
                    {L(misses.length === 1 ? 'Repasar 1 fallo' : `Repasar ${nf(misses.length)} fallos`, misses.length === 1 ? 'Review 1 miss' : `Review ${nf(misses.length)} misses`)}
                  </button>
                )}
                <button type="button" className="btn btn-ghost" onClick={onExit}>
                  <Settings2 size={16} aria-hidden="true" />
                  {L('Cambiar de juego', 'Change game')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onSee}>
                  <Images size={16} aria-hidden="true" />
                  {L('Ver estas banderas', 'See these flags')}
                </button>
              </div>
              {(['bad', 'warn', 'ok'] as const).map((res) => {
                const list = log.filter((a) => a.res === res);
                if (!list.length) return null;
                return (
                  <details key={res} className={cx('results-group', `g-${res}`)} open={res === 'bad'}>
                    <summary>
                      <span className="dot" />
                      {reveal || res === 'bad' ? resLabel(res) : L('Aciertos', 'Right')} <small>{nf(list.length)}</small>
                    </summary>
                    <ul className="fq-list">
                      {list.map((a) => (
                        <li key={a.card.key}>
                          <span className="fq-thumb">{picture(a.card)}</span>
                          <span className="fq-row">
                            <b>{a.card.name}</b>
                            {under(a.card) && <small>{under(a.card)}</small>}
                            {a.note && <small>{a.note}</small>}
                            {a.given && (
                              <small className="fq-took">
                                {named ? L(`Dijiste ${a.given.name}`, `You said ${a.given.name}`) : L(`Elegiste la de ${a.given.name}`, `You chose that of ${a.given.name}`)}
                                <span className="fq-thumb fq-thumb-sm">{picture(a.given)}</span>
                              </small>
                            )}
                            {reveal && a.res !== 'bad' && <small>{L(a.points === 1 ? '1 punto' : `${a.points} puntos`, a.points === 1 ? '1 point' : `${a.points} points`)}</small>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </div>
        }
      />
    );
  }

  const right = !!given && given.res !== 'bad';
  const last = at + 1 >= total || fallen;
  const off = new Set(given ? q.order : q.order.slice(0, shown));
  const worth = revealPoints(shown);
  const kicker = past
    ? L('¿Qué país tuvo esta bandera?', 'Which country flew this flag?')
    : region
      ? L('¿De qué país es esta bandera regional?', 'Which country is this regional flag from?')
      : odd
      ? L('¿Cuál no es de este grupo?', 'Which one is not of this group?')
      : named
        ? L('¿De dónde es esta bandera?', 'Whose flag is this?')
        : L('¿Cuál es la bandera de…?', 'Which is the flag of…?');
  const place = q.options.findIndex((card) => card.key === q.right) + 1;
  /** «¿De qué país es?»: the country the flag is of. */
  const owner = q.options.find((card) => card.key === q.right);

  return (
    <GameShell
      title={def.name}
      subtitle={name}
      onExit={onExit}
      progress={total ? log.length / total : undefined}
      hud={
        climb ? (
          <>
            <span className="hud-chip hud-main" title={L('Altura: las banderas acertadas', 'Height: the flags got right')}>
              <TrendingUp size={14} aria-hidden="true" />
              {nf(height)}
            </span>
            <span className="hud-chip hud-lives" aria-label={L(`Vidas: ${lives} de ${CLIMB_LIVES}`, `Lives: ${lives} of ${CLIMB_LIVES}`)} title={L('Vidas', 'Lives')}>
              {Array.from({ length: CLIMB_LIVES }, (_, i) => (
                <Heart key={i} size={14} className={i < lives ? 'on' : undefined} aria-hidden="true" />
              ))}
            </span>
            <Hud ms={ms} />
          </>
        ) : (
          <Hud ms={ms} streak={streak} progress={reveal ? `${at + 1} / ${total} · ${L(`${nf(score.points)} pts`, `${nf(score.points)} pts`)}` : `${at + 1} / ${total}`} />
        )
      }
      panel={
        <div className={cx('pop fq', `fq-${play.game}`)}>
          <p className="kicker center">{kicker}</p>
          {named ? (
            <div className="fq-stage">
              <div className="fq-flag" style={shape(q.card.ratio)}>
                <img key={`${q.card.key} ${fetched}`} src={q.card.src} alt="" decoding="async" draggable={false} onError={missing} />
                {reveal && (
                  <span className="fq-cover" aria-hidden="true" style={{ gridTemplateColumns: `repeat(${REVEAL.cols}, 1fr)`, gridTemplateRows: `repeat(${REVEAL.rows}, 1fr)` }}>
                    {Array.from({ length: REVEAL_PIECES }, (_, i) => (
                      <i key={i} className={off.has(i) ? 'off' : undefined} />
                    ))}
                  </span>
                )}
              </div>
              {past && under(q.card) && <p className="fq-when">{under(q.card)}</p>}
              {reveal && (
                <div className="fq-uncover">
                  <button ref={uncoverRef} type="button" className="btn" onClick={uncover} disabled={!!given || shown >= REVEAL_PIECES}>
                    <ScanEye size={16} aria-hidden="true" />
                    {L('Destapar', 'Uncover')}
                  </button>
                  <span className="fq-worth" role="status">
                    {given
                      ? L(`${nf(shown)} de ${REVEAL_PIECES} piezas destapadas`, `${nf(shown)} of ${REVEAL_PIECES} pieces uncovered`)
                      : L(`${nf(shown)} de ${REVEAL_PIECES} piezas · vale ${worth === 1 ? '1 punto' : `${worth} puntos`}`, `${nf(shown)} of ${REVEAL_PIECES} pieces · worth ${worth === 1 ? '1 point' : `${worth} points`}`)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <h2 className="q-ask center fq-name">
              {q.odd ? q.odd.group : q.card.name}
              {!q.odd && under(q.card) && <small>{under(q.card)}</small>}
            </h2>
          )}

          {named && !typed && (
            <div className={cx('choices fq-choices', options.length > 4 && 'fq-many')} role="group" aria-label={climb ? L(`Las ${options.length} respuestas`, `The ${options.length} answers`) : L('Las cuatro respuestas', 'The four answers')}>
              {options.map((card, i) => (
                <button key={card.key} type="button" className={cx('choice', given && card.key === q.right && 'right', given?.given?.key === card.key && 'wrong')} disabled={!!given} onClick={() => choose(card)}>
                  <kbd aria-hidden="true">{i + 1}</kbd>
                  {flagged && <span className="fq-thumb fq-thumb-sm">{picture(card, true)}</span>}
                  <span>{card.name}</span>
                </button>
              ))}
            </div>
          )}
          {typed && !given && (
            <div className="fq-type">
              <AnswerInput placeholder={L('Escribe de dónde es…', 'Type whose it is…')} label={L('De dónde es la bandera', 'Whose flag it is')} onSubmit={submit} shake={stray} clear={at} />
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => answer('bad')}>
                {L('No lo sé', 'I don’t know')}
              </button>
              {stray > 0 && (
                <p className="fq-stray" role="status">
                  {L('Ninguna bandera de este grupo se llama así: no cuenta como intento.', 'No flag of this group goes by that name: it is not counted as a try.')}
                </p>
              )}
            </div>
          )}
          {!named && (
            <div className="fq-opts" role="group" aria-label={L('Las cuatro banderas', 'The four flags')}>
              {q.options.map((card, i) => (
                <button
                  key={card.key}
                  type="button"
                  className={cx('fq-opt', given && card.key === q.right && 'right', given?.given?.key === card.key && 'wrong')}
                  disabled={!!given}
                  onClick={() => choose(card)}
                  aria-label={given ? card.name : L(`Bandera ${i + 1}`, `Flag ${i + 1}`)}
                >
                  <span className="fq-opt-box">{picture(card, true)}</span>
                  <span className="fq-cap">
                    <kbd aria-hidden="true">{i + 1}</kbd>
                    {/* Once the question is settled every flag says whose it is: the three that were not asked are learnt too. */}
                    <span>{given ? (q.odd && card.key === q.right ? `${card.name} · ${q.odd.tag}` : card.name) : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {lost && (
            <p className="fq-lost" role="alert">
              <span>{named ? L('No se ha podido cargar la bandera. Comprueba la conexión.', 'The flag could not be loaded. Check your connection.') : L('No se han podido cargar todas las banderas. Comprueba la conexión.', 'Not every flag could be loaded. Check your connection.')}</span>
              <button type="button" className="btn btn-sm" onClick={fetchAgain}>
                {L('Reintentar', 'Retry')}
              </button>
            </p>
          )}

          {given && (
            <Verdict
              res={given.res}
              title={
                right
                  ? reveal
                    ? L(`¡Correcto! ${given.points === 1 ? '1 punto' : `${given.points} puntos`}.`, `Correct! ${given.points === 1 ? '1 point' : `${given.points} points`}.`)
                    : L('¡Correcto!', 'Correct!')
                  : past
                    ? L(`Fue la bandera de ${q.card.name}.`, `It was the flag of ${q.card.name}.`)
                    : region
                      ? L(`Es de ${owner?.name ?? land(q.card)}.`, `It is from ${owner?.name ?? land(q.card)}.`)
                      : named
                      ? L(`Era ${q.card.name}.`, `It was ${q.card.name}.`)
                      : given.given
                        ? L(`Esa es la de ${given.given.name}.`, `That one is the flag of ${given.given.name}.`)
                        : L('No era esa.', 'Not that one.')
              }
            >
              {named && !flagged && under(q.card) && <p className="fq-why">{`${q.card.name} · ${under(q.card)}`}</p>}
              {region && <p className="fq-why">{L(`Es la bandera de ${q.card.name}.`, `It is the flag of ${q.card.name}.`)}</p>}
              {fallen && <p className="fq-why">{L(`Era tu última vida: la escalada acaba en ${rungs(height)}.`, `That was your last life: the climb ends at ${rungs(height)}.`)}</p>}
              {past && flewText(q.card.years) && <p className="fq-why">{right ? L(`${q.card.name} la tuvo ${flewText(q.card.years)}.`, `${q.card.name} flew it ${flewText(q.card.years)}.`) : L(`La tuvo ${flewText(q.card.years)}.`, `It flew ${flewText(q.card.years)}.`)}</p>}
              {/* The flag of what was said, to tell the two apart; where the names are those of countries it is there already, beside its name. */}
              {named && !flagged && given.given && (
                <p className="fq-why fq-mix">
                  <span>{L(`La de ${given.given.name} es esta:`, `That of ${given.given.name} is this one:`)}</span>
                  <span className="fq-thumb">{picture(given.given)}</span>
                </p>
              )}
              {q.odd && right && <p className="fq-why">{L(`La de ${q.card.name}: ${q.odd.tag}.`, `That of ${q.card.name}: ${q.odd.tag}.`)}</p>}
              {q.odd && !right && place > 0 && <p className="fq-why">{L(`La intrusa era la número ${place}: la de ${q.card.name} (${q.odd.tag}).`, `The odd one out was number ${place}: that of ${q.card.name} (${q.odd.tag}).`)}</p>}
              {!named && !q.odd && !right && place > 0 && <p className="fq-why">{L(`La de ${q.card.name} es la número ${place}.`, `That of ${q.card.name} is number ${place}.`)}</p>}
            </Verdict>
          )}
          <div className="q-actions center">
            {given && (
              <button type="button" className="btn btn-primary" onClick={next} autoFocus>
                {last ? L('Ver resultado', 'See the result') : L('Siguiente', 'Next')}
                <ArrowRight size={16} aria-hidden="true" />
              </button>
            )}
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => finish(log)}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </div>
      }
    />
  );
}

/**
 * A game of flags: its questions are drawn here, and drawn again for each new game. `near` is what
 * «Casi iguales» sets beside each flag (lib/flagAlike.ts); the other games need none.
 */
export function FlagQuiz({
  play,
  deck,
  near,
  extra,
  name,
  world,
  onExit,
  onSee,
}: {
  play: FlagPlay;
  deck: readonly DeckCard[];
  near: ReadonlyMap<string, readonly Near[]>;
  /** What «Antes y ahora», «El intruso» and «¿De qué país es?» are asked with, and what «Escalada» orders its flags by (lib/flagGames.ts). */
  extra?: FlagExtra;
  name: string;
  world: World;
  onExit(): void;
  onSee(): void;
}) {
  const [game, setGame] = useState<{ n: number; only: ReadonlySet<string> | null }>({ n: 0, only: null });
  // Drawn once for each game: `n` is what tells one from the next.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const questions = useMemo(() => roundOf(play, deck, Math.random, near, game.only ?? undefined, extra), [play, deck, near, extra, game]);
  return <Round key={game.n} play={play} deck={deck} questions={questions} name={name} world={world} review={!!game.only} onExit={onExit} onSee={onSee} onAgain={(only) => setGame((g) => ({ n: g.n + 1, only: only ?? null }))} />;
}
