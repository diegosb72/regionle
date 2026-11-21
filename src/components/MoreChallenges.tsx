/**
 * More challenges on the first page, under the one of the day and what there is to study today: the challenge
 * of the week (lib/weekly.ts) and the ones of the day of a continent or a country (lib/zones.ts). Each is a
 * game like any other, started from here; what is kept of them is what this card shows.
 */
// Only icons the first page already carries: another one would make it fetch the rest of them.
import { CalendarDays, Check, Flame, Map as MapIcon, Play, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { L, fmtDay, getLang, nm } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { go } from '../lib/router';
import { PLAY_PATH } from '../lib/routes';
import { useStore } from '../lib/store';
import { fmtTime, nf, today } from '../lib/text';
import type { Country, Index } from '../lib/types';
import { daysLeft, themeOf, weekEnd, weekGame, weekOf, weekQuestions, weekTotals, type WeekTheme } from '../lib/weekly';
import type { World } from '../lib/world';
import { ZONE_PARTS, countryZone, partZone, zoneCountries, zoneDone, zoneGame, zoneRun, zonesShown } from '../lib/zones';
import { Flag } from './ui';
import './more.css';

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

export function MoreChallenges({ world }: { world: World }) {
  const date = today();
  return (
    <section className="more" aria-label={L('Más retos', 'More challenges')}>
      <Week world={world} date={date} />
      <Zones world={world} date={date} />
    </section>
  );
}
