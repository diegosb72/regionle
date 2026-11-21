/**
 * More challenges on the first page, under the one of the day and what there is to study today: the challenge
 * of the week (lib/weekly.ts), the ones of the day of a continent or a country (lib/zones.ts) and those of
 * the special days of the year (lib/occasions.ts). Each is a game like any other, started from here; what is
 * kept of them is what this card shows.
 */
// Only icons the first page already carries: another one would make it fetch the rest of them.
import { CalendarClock, CalendarDays, Check, Flame, Map as MapIcon, Play, RefreshCw, RotateCcw, Star } from 'lucide-react';
import { Suspense, useState } from 'react';
import { L, fmtDay, getLang, nm } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { daysTo, editionOn, occasionDate, occasionDone, occasionEnd, occasionGame, occasionName, occasionNext, occasionQuestions, occasionWhat, occasionsOpen, type Edition, type Occasion } from '../lib/occasions';
import { go } from '../lib/router';
import { PLAY_PATH } from '../lib/routes';
import { useStore } from '../lib/store';
import { fmtTime, nf, today } from '../lib/text';
import type { Country, Index } from '../lib/types';
import { daysLeft, themeOf, weekEnd, weekGame, weekOf, weekQuestions, weekTotals, type WeekTheme } from '../lib/weekly';
import type { World } from '../lib/world';
import { ZONE_PARTS, countryZone, partZone, zoneCountries, zoneDone, zoneGame, zoneRun, zonesShown } from '../lib/zones';
import { ErrorBoundary } from './ErrorBoundary';
import { lazyScreen } from './lazy';
import { Flag } from './ui';
import './more.css';

/**
 * The calendar of the special days, fetched the first time it is opened. One that did not come is asked for
 * again the next time, which brings it only in a browser that fetches twice a file that failed (see `Dates`).
 */
const OccasionCalendar = lazyScreen(() => import('./OccasionCalendar').then((m) => m.OccasionCalendar));

/** "Banderas · Mundo", "Popurrí · Europa": the way of asking and where. */
export const themeName = (theme: WeekTheme, index: Index): string => `${modeNameIn('countries', theme.mode)} · ${theme.part ? nm(index.continents[theme.part]) : L('Mundo', 'World')}`;

/** "del 16 al 22 de noviembre", "del 30 de noviembre al 6 de diciembre". */
export function weekSpan(week: string): string {
  const end = weekEnd(week);
  const first = Number(week.slice(8));
  return week.slice(0, 7) === end.slice(0, 7) ? L(`del ${first} al ${fmtDay(end)}`, `${first}–${fmtDay(end)}`) : L(`del ${fmtDay(week)} al ${fmtDay(end)}`, `${fmtDay(week)} – ${fmtDay(end)}`);
}

const percent = (score: number): string => L(`${nf(score)} %`, `${nf(score)}%`);

function Week({ world, date }: { world: World; date: string }) {
  const weekly = useStore((s) => s.weekly);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  const week = weekOf(date);
  const rec = weekly[week];
  const left = daysLeft(date);
  const { played, best } = weekTotals(weekly);
  const play = () => {
    // The week is read when the game starts: the page may have been open since Sunday.
    start(weekGame(weekOf(today()), world.index, opts));
    go(PLAY_PATH);
  };
  return (
    <div className="more-part">
      <p className="kicker">
        <CalendarDays size={15} aria-hidden="true" /> {L('Reto de la semana', 'Weekly challenge')} · {weekSpan(week)}
      </p>
      <h2 className="more-title">{themeName(themeOf(week), world.index)}</h2>
      <p className="more-text">
        {rec ? (
          <>
            <b className="more-score">{percent(rec.s)}</b>{' '}
            {L(`${nf(rec.ok)} de ${nf(rec.n)} a la primera, en ${fmtTime(rec.ms)}. El lunes hay reto nuevo.`, `${nf(rec.ok)} of ${nf(rec.n)} right first time, in ${fmtTime(rec.ms)}. A new challenge comes on Monday.`)}
          </>
        ) : (
          L(
            `Una partida larga, la misma para todo el mundo: ${nf(weekQuestions(week, world.index))} preguntas seguidas. Cuenta la primera vez que la terminas.`,
            `One long game, the same for everybody: ${nf(weekQuestions(week, world.index))} questions in a row. The first time you finish it is the one that counts.`,
          )
        )}
      </p>
      <div className="more-go">
        <button type="button" className={rec ? 'btn btn-sm' : 'btn btn-primary'} onClick={play}>
          {rec ? <RotateCcw size={15} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {rec ? L('Jugarlo otra vez', 'Play it again') : L('Jugar el reto de la semana', 'Play the weekly challenge')}
        </button>
        <span className="more-meta">
          {rec
            ? played > 1
              ? L(`Tu mejor semana: ${percent(best)} · ${nf(played)} semanas jugadas`, `Your best week: ${percent(best)} · ${nf(played)} weeks played`)
              : L('Otra vez ya no cuenta: es para practicar.', 'Again no longer counts: it is for practice.')
            : left === 1
              ? L('Último día', 'Last day')
              : L(`Quedan ${left} días`, `${left} days left`)}
        </span>
      </div>
    </div>
  );
}

function Zones({ world, date }: { world: World; date: string }) {
  const zones = useStore((s) => s.zones);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  /**
   * The country chosen in the list of the rest. Choosing does nothing by itself: with the keyboard a list is
   * walked through option by option, and each would start a game. The button next to it does.
   */
  const [choice, setChoice] = useState('');

  const byName = (a: Country, b: Country) => nm(a.n).localeCompare(nm(b.n), getLang());
  const all = zoneCountries(world.index);
  const shown = zonesShown(zones, date);
  const mine = shown.flatMap((id) => all.find((c) => countryZone(c.id) === id) ?? []).sort(byName);
  const rest = all.filter((c) => !shown.includes(countryZone(c.id)));
  const chosen = rest.find((c) => countryZone(c.id) === choice);

  const play = (id: string) => {
    // The day is read when the game starts: the page may have been open since yesterday.
    const game = zoneGame(id, today(), world.index, opts);
    if (!game) return;
    start(game);
    go(PLAY_PATH);
  };
  const chip = (id: string, name: string, flag?: string) => {
    const rec = zones[id];
    const done = zoneDone(rec, date);
    const run = zoneRun(rec, date);
    const days = run > 1 ? L(` Llevas ${nf(run)} días seguidos.`, ` ${nf(run)} days in a row.`) : '';
    const label = done
      ? L(`Reto del día de ${name}: hecho, ${percent(rec.s)}.${days} Jugarlo otra vez ya no cuenta.`, `Daily challenge of ${name}: done, ${percent(rec.s)}.${days} Playing it again no longer counts.`)
      : L(`Jugar el reto del día de ${name}.${days}`, `Play the daily challenge of ${name}.${days}`);
    return (
      <li key={id}>
        <button type="button" className={done ? 'chip more-chip more-done' : 'chip more-chip'} data-zone={id} onClick={() => play(id)} aria-label={label} title={label}>
          <span className="more-name">
            {done ? <Check size={14} aria-hidden="true" /> : <Play size={12} aria-hidden="true" />}
            {flag && <Flag code={flag} size="sm" />}
            <span>{name}</span>
          </span>
          {/* The score and the days in a row go together: on a narrow screen, under a long name. */}
          {(done || run > 1) && (
            <span className="more-tail">
              {done && <b>{percent(rec.s)}</b>}
              {run > 1 && (
                <small>
                  <Flame size={12} aria-hidden="true" />
                  {nf(run)}
                </small>
              )}
            </span>
          )}
        </button>
      </li>
    );
  };

  return (
    <div className="more-part">
      <h2 className="kicker">
        <MapIcon size={15} aria-hidden="true" /> {L('Retos del día por continente o país', 'Daily challenges by continent or country')}
      </h2>
      <p className="more-text">
        {L(
          'Diez preguntas cada día, las mismas para todo el mundo: de los países de un continente o de las regiones de un país.',
          'Ten questions every day, the same for everybody: on the countries of a continent or the regions of a country.',
        )}
      </p>
      <ul className="more-chips">
        {ZONE_PARTS.map((part) => chip(partZone(part), nm(world.index.continents[part])))}
        {mine.map((c) => chip(countryZone(c.id), nm(c.n), c.fl))}
        <li className="select more-other">
          <select aria-label={L('Otro país', 'Another country')} value={chosen ? choice : ''} onChange={(e) => setChoice(e.target.value)}>
            <option value="">{L('Otro país…', 'Another country…')}</option>
            {[...ZONE_PARTS, 'AN'].map((part) => {
              const here = rest.filter((c) => c.ct === part).sort(byName);
              if (!here.length) return null;
              return (
                <optgroup key={part} label={nm(world.index.continents[part])}>
                  {here.map((c) => (
                    <option key={c.id} value={countryZone(c.id)}>
                      {nm(c.n)}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!chosen}
            onClick={() => chosen && play(choice)}
            aria-label={chosen ? L(`Jugar el reto del día de ${nm(chosen.n)}`, `Play the daily challenge of ${nm(chosen.n)}`) : undefined}
          >
            <Play size={13} aria-hidden="true" />
            {L('Jugar', 'Play')}
          </button>
        </li>
      </ul>
    </div>
  );
}

/** The flag of the country an occasion is the national day of; nothing for an international day. */
export const occasionFlag = (o: Occasion, index: Index): string | undefined => {
  const { ask } = o;
  return ask.section === 'regions' ? index.countries.find((c) => c.id === ask.country)?.fl : undefined;
};

/** "27 preguntas" */
export const questions = (n: number): string => L(`${nf(n)} preguntas`, `${nf(n)} questions`);

/**
 * The special days: the challenges that are open today, each with its button, or else the next one to come;
 * and the calendar of the whole year, where any of them can be played for practice.
 */
function Dates({ world, date, open }: { world: World; date: string; open: Edition[] }) {
  const kept = useStore((s) => s.occasions);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  /** The calendar: 0 while it is shut, and the number of the time it was opened otherwise, so that each time starts with no failure left from the one before. */
  const [calendar, setCalendar] = useState(0);
  const next = occasionNext(date);
  /** With several open at once, each button is a small one: the card would be all buttons otherwise. */
  const several = open.length > 1;
  const play = (o: Occasion) => {
    // The day is read when the game starts: the page may have been open since before the challenge closed,
    // and then what is left of it is the game for practice.
    start(occasionGame(o, editionOn(o, today()), world.index, opts));
    go(PLAY_PATH);
  };
  return (
    <div className="more-dates">
      <div className="more-dates-head">
        <h2 className="kicker">
          <Star size={15} aria-hidden="true" /> {L('Fechas señaladas', 'Special days')}
        </h2>
        <button type="button" className="btn btn-sm" onClick={() => setCalendar((n) => n + 1)} aria-haspopup="dialog">
          <CalendarDays size={15} aria-hidden="true" />
          {L('Ver el calendario', 'See the calendar')}
        </button>
      </div>
      {open.length > 0 ? (
        <ul className="more-days">
          {open.map(({ o, year }) => {
            const rec = kept[o.id];
            const done = occasionDone(rec, year);
            const end = occasionEnd(o, year);
            const day = occasionDate(o, year);
            const flag = occasionFlag(o, world.index);
            return (
              <li key={o.id} className="more-day" data-occasion={o.id}>
                <div className="more-day-what">
                  <h3 className="more-day-name">
                    {flag && <Flag code={flag} size="sm" />}
                    <span>{occasionName(o)}</span>
                  </h3>
                  <p className="more-text">
                    {done ? (
                      <>
                        <b className="more-score">{percent(rec.s)}</b>{' '}
                        {L(`${nf(rec.ok)} de ${nf(rec.n)} a la primera, en ${fmtTime(rec.ms)}. ${occasionWhat(o)}.`, `${nf(rec.ok)} of ${nf(rec.n)} right first time, in ${fmtTime(rec.ms)}. ${occasionWhat(o)}.`)}
                      </>
                    ) : (
                      L(`${occasionWhat(o)}: ${questions(occasionQuestions(o, world.index))}, las mismas para todo el mundo.`, `${occasionWhat(o)}: ${questions(occasionQuestions(o, world.index))}, the same for everybody.`)
                    )}
                  </p>
                </div>
                <div className="more-go">
                  <button type="button" className={done ? 'btn btn-sm' : several ? 'btn btn-primary btn-sm' : 'btn btn-primary'} onClick={() => play(o)} aria-label={done ? L(`Jugar otra vez: ${occasionName(o)}`, `Play again: ${occasionName(o)}`) : L(`Jugar: ${occasionName(o)}`, `Play: ${occasionName(o)}`)}>
                    {done ? <RotateCcw size={15} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
                    {done ? L('Jugarlo otra vez', 'Play it again') : L('Jugar', 'Play')}
                  </button>
                  <span className="more-meta">
                    {day === date ? L('Hoy', 'Today') : fmtDay(day)}
                    {' · '}
                    {done ? L('Otra vez ya no cuenta', 'Again no longer counts') : end === date ? L('Último día', 'Last day') : L(`Abierto hasta el ${fmtDay(end)}`, `Open until ${fmtDay(end)}`)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        next && (
          <p className="more-text more-next">
            <CalendarClock size={16} aria-hidden="true" />
            <span>
              {L('Próxima: ', 'Next: ')}
              <b>{occasionName(next.o)}</b>
              {L(`, el ${fmtDay(occasionDate(next.o, next.year))} (${until(daysTo(date, occasionDate(next.o, next.year)))}). `, `, on ${fmtDay(occasionDate(next.o, next.year))} (${until(daysTo(date, occasionDate(next.o, next.year)))}). `)}
              {L(`${occasionWhat(next.o)}: el reto se abre ese día y dura una semana.`, `${occasionWhat(next.o)}: the challenge opens that day and lasts a week.`)}
            </span>
          </p>
        )
      )}
      {calendar > 0 && (
        // If its code does not come, the card is still there, and it says so. Asking again is of no use in a
        // browser that remembers that a file failed to come and does not ask for it twice (Chrome does): the
        // way to have it is to load the page again, where a new version of the game, if that was it, comes too.
        <ErrorBoundary
          key={calendar}
          fallback={() => (
            <div className="more-failed" role="alert">
              <p className="more-meta">
                {L(
                  'No se ha podido abrir el calendario. Suele ser la conexión, o que hay una versión nueva del juego: recarga la página y vuelve a intentarlo.',
                  'The calendar could not be opened. It is usually the connection, or a new version of the game: reload the page and try again.',
                )}
              </p>
              <button type="button" className="btn btn-sm" onClick={() => window.location.reload()}>
                <RefreshCw size={14} aria-hidden="true" />
                {L('Recargar la página', 'Reload the page')}
              </button>
            </div>
          )}
        >
          <Suspense fallback={null}>
            <OccasionCalendar world={world} onClose={() => setCalendar(0)} />
          </Suspense>
        </ErrorBoundary>
      )}
    </div>
  );
}

/** "mañana", "dentro de 15 días" */
const until = (days: number): string => (days === 1 ? L('mañana', 'tomorrow') : L(`dentro de ${nf(days)} días`, `in ${nf(days)} days`));

export function MoreChallenges({ world }: { world: World }) {
  const date = today();
  // A special day that is open goes first, while it lasts; the rest of the year the next one is told at the foot.
  const open = occasionsOpen(date);
  const dates = <Dates world={world} date={date} open={open} />;
  return (
    <section className="more" aria-label={L('Más retos', 'More challenges')}>
      {open.length > 0 && dates}
      <Week world={world} date={date} />
      <Zones world={world} date={date} />
      {open.length === 0 && dates}
    </section>
  );
}
