/**
 * The calendar of the special days (lib/occasions.ts): every day of the year that has a challenge, with what
 * it asks, whether it is open and how it went; and a button for each, which plays the challenge while it is
 * open and the same game for practice the rest of the year.
 */
// Only icons the first page already carries: another one would make the calendar fetch the rest of them.
import { Check, Play, RotateCcw } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { L, fmtDay } from '../lib/i18n';
import { OCCASIONS, daysTo, editionOn, occasionDate, occasionDone, occasionEnd, occasionGame, occasionName, occasionNext, occasionQuestions, occasionWhat, occasionsPlayed, type Occasion } from '../lib/occasions';
import { go } from '../lib/router';
import { PLAY_PATH } from '../lib/routes';
import { useStore } from '../lib/store';
import { cx, nf, today } from '../lib/text';
import type { World } from '../lib/world';
import { Dialog } from './Dialog';
import { occasionFlag, questions } from './MoreChallenges';
import { Flag } from './ui';
import './dates.css';

const percent = (score: number): string => L(`${nf(score)} %`, `${nf(score)}%`);

export function OccasionCalendar({ world, onClose }: { world: World; onClose(): void }) {
  const kept = useStore((s) => s.occasions);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  const date = today();
  const year = Number(date.slice(0, 4));
  const next = occasionNext(date);
  const anyOpen = OCCASIONS.some((o) => editionOn(o, date) != null);
  const played = occasionsPlayed(kept, year);
  const list = useRef<HTMLOListElement>(null);

  // The calendar opens on what is on now: the first of the challenges that are open, in the order of the
  // year, or else the next one to come.
  useEffect(() => {
    list.current?.querySelector('.dates-now')?.scrollIntoView({ block: 'center' });
  }, []);

  const play = (o: Occasion) => {
    // Open, its challenge of this year; shut, the same game for practice. Read as it starts: the calendar
    // may have been open since before the day changed.
    start(occasionGame(o, editionOn(o, today()), world.index, opts));
    go(PLAY_PATH);
  };

  return (
    <Dialog title={L('Fechas señaladas', 'Special days')} className="dates-dialog" onClose={onClose}>
      <p className="dates-how">
        {L(
          'Cada fecha trae un reto, el mismo para todo el mundo: se abre ese día, dura una semana y cuenta la primera vez que lo terminas. El resto del año puedes practicarlo cuando quieras: las preguntas cambian y no se apunta nada.',
          'Each day brings a challenge, the same for everybody: it opens that day, lasts a week, and the first time you finish it is the one that counts. The rest of the year you can practise it whenever you like: the questions change and nothing goes on record.',
        )}
      </p>
      <p className="dates-sum">
        {played > 0
          ? L(`En ${year} has jugado ${nf(played)} de las ${nf(OCCASIONS.length)} fechas.`, `In ${year} you have played ${nf(played)} of the ${nf(OCCASIONS.length)} days.`)
          : L(`En ${year} aún no has jugado ninguna de las ${nf(OCCASIONS.length)} fechas.`, `In ${year} you have not played any of the ${nf(OCCASIONS.length)} days yet.`)}
      </p>
      <ol className="dates-list" ref={list}>
        {OCCASIONS.map((o) => {
          const openYear = editionOn(o, date);
          const rec = kept[o.id];
          const done = openYear != null && occasionDone(rec, openYear);
          const coming = !anyOpen && next?.o.id === o.id;
          const day = occasionDate(o, openYear ?? (next?.o.id === o.id ? next.year : year));
          const name = occasionName(o);
          const flag = occasionFlag(o, world.index);
          return (
            <li key={o.id} className={cx('dates-row', openYear != null && 'dates-open', (openYear != null || coming) && 'dates-now')} data-occasion={o.id}>
              <time className="dates-day" dateTime={day}>
                {fmtDay(day)}
              </time>
              <div className="dates-what">
                <span className="dates-name">
                  {flag && <Flag code={flag} size="sm" />}
                  <b>{name}</b>
                </span>
                <small>
                  {occasionWhat(o)} · {questions(occasionQuestions(o, world.index))}
                </small>
                {openYear != null ? (
                  done ? (
                    <span className="dates-tag dates-tag-done">
                      <Check size={13} aria-hidden="true" />
                      {L(`Hecho: ${percent(rec.s)}`, `Done: ${percent(rec.s)}`)}
                    </span>
                  ) : (
                    <span className="dates-tag dates-tag-open">{occasionEnd(o, openYear) === date ? L('Abierto: último día', 'Open: last day') : L(`Abierto hasta el ${fmtDay(occasionEnd(o, openYear))}`, `Open until ${fmtDay(occasionEnd(o, openYear))}`)}</span>
                  )
                ) : (
                  <>
                    {next?.o.id === o.id && (
                      <span className="dates-tag dates-tag-next">
                        {L('Próxima: ', 'Next: ')}
                        {daysTo(date, day) === 1 ? L('mañana', 'tomorrow') : L(`dentro de ${nf(daysTo(date, day))} días`, `in ${nf(daysTo(date, day))} days`)}
                      </span>
                    )}
                    {rec && <span className="dates-tag">{L(`${percent(rec.s)} en ${rec.y}`, `${percent(rec.s)} in ${rec.y}`)}</span>}
                  </>
                )}
              </div>
              <button
                type="button"
                className={openYear != null && !done ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                onClick={() => play(o)}
                aria-label={openYear == null ? L(`Practicar: ${name}`, `Practise: ${name}`) : done ? L(`Jugar otra vez: ${name}`, `Play again: ${name}`) : L(`Jugar: ${name}`, `Play: ${name}`)}
              >
                {openYear != null && done ? <RotateCcw size={14} aria-hidden="true" /> : <Play size={13} aria-hidden="true" />}
                {openYear == null ? L('Practicar', 'Practise') : done ? L('Otra vez', 'Again') : L('Jugar', 'Play')}
              </button>
            </li>
          );
        })}
      </ol>
    </Dialog>
  );
}
