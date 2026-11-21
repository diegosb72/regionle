/**
 * «Dos jugadores» (lib/duo.ts) as it is seen: the scoreboard under the header of a game, whose turn the
 * question is, and the result. Fetched when a game of two starts (lib/duoLazy.ts).
 */
import { RotateCcw, Settings2, Trophy } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Flag } from '../components/ui';
import { NAME_MAX, POINTS, defaultName, duoRule, keepNames, leader, namesKept, otherOf, pointsOf, tally, verdictOf, whoOf, type Names, type Score, type Who } from '../lib/duo';
import { L, nm } from '../lib/i18n';
import { cx } from '../lib/text';
import type { Res } from '../lib/types';
import type { ResultRow } from './common';
import './duo.css';

const BOTH = [0, 1] as const;

/** How an answer went, in a word or two. */
const wentAs = (res: Res): string => (res === 'ok' ? L('a la primera', 'first time') : res === 'warn' ? L('con ayuda', 'with help') : L('fallo', 'missed'));

/** On the setup: what the two are called. Kept in this browser as it is written, and nowhere else. */
export function DuoNames() {
  const [names, setNames] = useState(namesKept);
  const set = (who: Who, text: string) => {
    const next: Names = who === 0 ? [text, names[1]] : [names[0], text];
    setNames(next);
    keepNames(next);
  };
  return (
    <div className="duo-names" role="group" aria-label={L('Quién juega', 'Who is playing')}>
      {BOTH.map((who) => (
        <label key={who} className={`p${who}`}>
          <span>
            <i className="duo-dot" aria-hidden="true" />
            {defaultName(who)}
          </span>
          <input type="text" value={names[who]} maxLength={NAME_MAX} placeholder={L('Nombre (opcional)', 'Name (optional)')} autoComplete="off" enterKeyHint="done" onChange={(e) => set(who, e.target.value)} />
        </label>
      ))}
    </div>
  );
}

/** The scoreboard under the header: each player with the points so far, and the one whose turn it is marked. */
export function DuoBoard({ names, score, turn }: { names: Names; score: Score; turn: Who | null }) {
  return (
    <div className="duo-board" role="group" aria-label={L('Marcador', 'Scoreboard')}>
      {BOTH.map((who) => {
        const on = turn === who;
        return (
          <p key={who} className={cx('duo-seat', `p${who}`, on && 'on')} aria-current={on ? 'true' : undefined}>
            <i className="duo-dot" aria-hidden="true" />
            <b className="duo-name">{names[who]}</b>
            {on && <span className="sr-only">{L('(le toca)', '(to play)')}</span>}
            <span className="duo-pts">
              {score.of[who].pts}
              <span className="sr-only"> {score.of[who].pts === 1 ? L('punto', 'point') : L('puntos', 'points')}</span>
            </span>
          </p>
        );
      })}
    </div>
  );
}

/** Over the question: whose it is. Said aloud too, each time it changes hands. */
export function DuoTurn({ names, who }: { names: Names; who: Who }) {
  return (
    <p className={cx('duo-turn', `p${who}`)} role="status">
      <i className="duo-dot" aria-hidden="true" />
      <span>
        {L('Turno de ', '')}
        <b>{names[who]}</b>
        {L('', '’s turn')}
      </span>
    </p>
  );
}

/** Under the verdict of an answer: what it adds, and who comes next. */
export function DuoGain({ names, who, res, last }: { names: Names; who: Who; res: Res; last: boolean }) {
  const pts = POINTS[res];
  const next = names[otherOf(who)];
  return (
    <p className="q-how duo-gain">
      {pts ? L(`${names[who]} suma ${pointsOf(pts)}.`, `${names[who]} scores ${pointsOf(pts)}.`) : L(`${names[who]} no suma.`, `${names[who]} scores nothing.`)}
      {!last && ` ${L(`Ahora le toca a ${next}.`, `${next} plays next.`)}`}
    </p>
  );
}

/**
 * The result of a game of two: who wins, what each got and how each of their answers went. `rows` come in
 * the order they were asked; `done` is false for a game that was ended before its last question.
 */
export function DuoResults({
  names,
  rows,
  first,
  done,
  several,
  onAgain,
  onExit,
}: {
  names: Names;
  rows: ResultRow[];
  first: Who;
  done: boolean;
  /** The map mixes several countries: each piece says which one it is of. */
  several: boolean;
  onAgain(): void;
  onExit(): void;
}) {
  const score = tally(
    rows.map((r) => r.res),
    first,
    true,
  );
  const lead = done ? leader(score) : null;
  const { title, note } = verdictOf(names, score, done);
  /** The answer that does not count: the other player did not get that turn. */
  const extra = score.left ? rows[rows.length - 1] : null;
  // The keyboard goes to the button that plays again, as in every result, but nothing is scrolled to bring it
  // into view: on a short screen that would push who won out of sight.
  const again = useRef<HTMLButtonElement>(null);
  useEffect(() => again.current?.focus({ preventScroll: true }), []);
  const counted = extra ? rows.slice(0, -1) : rows;
  return (
    <div className="results duo-results">
      <p className="kicker">{L('Resultado', 'Result')}</p>
      <h2 className="results-title">{title}</h2>
      <p className="results-note">{note}</p>
      <div className="duo-final">
        {BOTH.map((who) => {
          const t = score.of[who];
          return (
            <section key={who} className={cx('duo-card', `p${who}`, lead === who && 'won')} aria-label={names[who]}>
              <h3>
                <i className="duo-dot" aria-hidden="true" />
                <span className="duo-name">{names[who]}</span>
                {lead === who && <Trophy size={16} aria-label={L('Gana', 'Winner')} />}
              </h3>
              <p className="duo-total">
                <strong>{t.pts}</strong> {t.pts === 1 ? L('punto', 'point') : L('puntos', 'points')}
              </p>
              <dl>
                <div>
                  <dt>{L('A la primera', 'First time')}</dt>
                  <dd className="c-ok">{t.ok}</dd>
                </div>
                <div>
                  <dt>{L('Con ayuda', 'With help')}</dt>
                  <dd className="c-warn">{t.warn}</dd>
                </div>
                <div>
                  <dt>{L('Fallos', 'Misses')}</dt>
                  <dd className="c-bad">{t.bad}</dd>
                </div>
              </dl>
            </section>
          );
        })}
      </div>
      <div className="results-actions">
        <button type="button" className="btn btn-primary" onClick={onAgain} ref={again}>
          <RotateCcw size={16} aria-hidden="true" />
          {L('Otra vez', 'Again')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onExit}>
          <Settings2 size={16} aria-hidden="true" />
          {L('Cambiar de juego', 'Change game')}
        </button>
      </div>
      <p className="duo-how">
        {duoRule()} {L(`En la siguiente empieza ${names[otherOf(first)]}.`, `${names[otherOf(first)]} starts the next one.`)}{' '}
        {L('Lo que se juega a dos no cuenta para el progreso de nadie.', 'What is played by two counts towards nobody’s progress.')}
      </p>
      {extra && (
        <p className="duo-how duo-extra">
          {L(
            `La última respuesta de ${names[whoOf(rows.length - 1, first)]} (${extra.item.name}) no cuenta: ${names[whoOf(rows.length, first)]} no llegó a tener ese turno.`,
            `The last answer of ${names[whoOf(rows.length - 1, first)]} (${extra.item.name}) does not count: ${names[whoOf(rows.length, first)]} did not get that turn.`,
          )}
        </p>
      )}
      {counted.length > 0 &&
        BOTH.map((who) => {
          const mine = counted.filter((_, i) => whoOf(i, first) === who);
          return (
            <details key={who} className={cx('results-group', 'duo-list', `p${who}`)} open>
              <summary>
                <i className="duo-dot" aria-hidden="true" />
                {names[who]} <small>{pointsOf(score.of[who].pts)}</small>
              </summary>
              <ul>
                {mine.map(({ item, res, note: said }) => (
                  <li key={item.id} className={`r-${res}`}>
                    <div className="row-name">
                      <span className="duo-mark" title={wentAs(res)} aria-hidden="true" />
                      {(item.kind === 'country' || several) && <Flag code={item.country.fl} size="sm" />}
                      <b>{item.name}</b>
                      {said ? <small>{said}</small> : (item.kind === 'unit' || item.kind === 'city') && (item.parent || several) ? <small>{item.parent ?? nm(item.country.n)}</small> : null}
                      <span className="duo-got">
                        <span className="sr-only">{wentAs(res)}: </span>
                        {POINTS[res] ? `+${POINTS[res]}` : '0'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          );
        })}
    </div>
  );
}
