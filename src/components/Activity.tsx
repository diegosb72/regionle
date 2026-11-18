/**
 * What was done each day, on the Progress page: the days in a row, the daily target, the calendar of the
 * last year, how the weeks went and what each month and each year add up to.
 */
import { Check, Flame, Target } from 'lucide-react';
import { useMemo, useState, type MouseEvent, type PointerEvent } from 'react';
import { DAYS_MAX, DAY_GOALS, longestStreak, studyStreak, type DayRec, type Days } from '../lib/days';
import { calendarOf, learntOver, monthsOf, scaleFor, weeksOf, yearsOf, type Span } from '../lib/dayview';
import { daysBetween } from '../lib/goals';
import { L, getLang } from '../lib/i18n';
import { learntIn, useStore } from '../lib/store';
import { cx, nf, today } from '../lib/text';
import { Seg } from './ui';
import './activity.css';

/** Weeks on the calendar: a year. Narrow screens show the latest ones (see `.cal-week` in `activity.css`). */
const WEEKS = 53;
/** Weeks on the chart: half a year. */
const CHART_WEEKS = 26;

const locale = () => (getLang() === 'en' ? 'en-GB' : 'es-ES');
/** A day written "2026-11-18", as a date at noon of Greenwich: the same day wherever it is read. */
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`);
const fmtDay = (day: string, opts: Intl.DateTimeFormatOptions) => dateOf(day).toLocaleDateString(locale(), { timeZone: 'UTC', ...opts });
const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
/** The day `n` days after another, written the same way. */
const fmtIso = (day: string, n: number) => new Date(dateOf(day).getTime() + n * 864e5).toISOString().slice(0, 10);

/** "3 h 12 min", "45 min", "menos de 1 min". */
export function fmtSpan(ms: number): string {
  const min = Math.round(ms / 60_000);
  if (min < 1) return ms > 0 ? L('menos de 1 min', 'under 1 min') : '0 min';
  const h = Math.floor(min / 60);
  return h ? `${nf(h)} h ${min % 60} min` : `${min} min`;
}

const answersText = (n: number) => L(`${nf(n)} ${n === 1 ? 'respuesta' : 'respuestas'}`, `${nf(n)} ${n === 1 ? 'answer' : 'answers'}`);
const gamesText = (n: number) => L(`${nf(n)} ${n === 1 ? 'partida' : 'partidas'}`, `${nf(n)} ${n === 1 ? 'game' : 'games'}`);
const daysText = (n: number) => L(`${nf(n)} ${n === 1 ? 'día' : 'días'}`, `${nf(n)} ${n === 1 ? 'day' : 'days'}`);
/** The share right first time, as a whole per cent; a dash where nothing was answered. */
const share = (ok: number, answers: number) => (answers > 0 ? `${Math.round((ok / answers) * 100)} %` : '—');

/** What was done on a day, in a sentence. */
function dayText(day: string, rec: DayRec | undefined): string {
  const when = capital(fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  if (!rec) return L(`${when}: nada.`, `${when}: nothing.`);
  const [g, q, ok, ms, met] = rec;
  return L(
    `${when}: ${answersText(q)} en ${gamesText(g)}, ${nf(ok)} a la primera${ms > 0 ? `, ${fmtSpan(ms)}` : ''}.${met ? ' Meta cumplida.' : ''}`,
    `${when}: ${answersText(q)} in ${gamesText(g)}, ${nf(ok)} right first time${ms > 0 ? `, ${fmtSpan(ms)}` : ''}.${met ? ' Target met.' : ''}`,
  );
}

// ------------------------------------------------- streak, target and calendar

export function ActivityBlock() {
  const days = useStore((s) => s.days);
  const written = useStore((s) => s.best['study:streak'] ?? 0);
  const goal = useStore((s) => s.dayGoal);
  const setDayGoal = useStore((s) => s.setDayGoal);
  const now = today();
  const [picked, setPicked] = useState<string | null>(null);

  const streak = studyStreak(days, now);
  const kept = useMemo(() => longestStreak(days), [days]);
  // The longest run is written down as it grows; the days kept say it for whoever played before it was.
  const longest = Math.max(written, kept);
  const played = Object.keys(days).length;
  const done = days[now]?.[1] ?? 0;
  const cal = useMemo(() => calendarOf(days, now, WEEKS), [days, now]);
  const inYear = useMemo(() => cal.flat().filter((d) => d.rec).length, [cal]);

  /** The day under the pointer, or the one tapped. */
  const pick = (e: PointerEvent<HTMLElement> | MouseEvent<HTMLElement>) => {
    const day = (e.target as HTMLElement).dataset?.day;
    if (day) setPicked(day);
  };

  return (
    <section className="block activity">
      <h2>{L('Actividad', 'Activity')}</h2>
      <dl className="tiles act-tiles">
        <div>
          <dt>{L('Días seguidos', 'Days in a row')}</dt>
          <dd>
            <Flame size={22} aria-hidden="true" className={cx('act-flame', streak > 0 && 'on')} /> {nf(streak)}
          </dd>
        </div>
        <div>
          <dt>{L('Mejor racha', 'Longest run')}</dt>
          <dd>{nf(longest)}</dd>
        </div>
        <div>
          <dt>{L('Días jugados', 'Days played')}</dt>
          <dd>{nf(played)}</dd>
        </div>
        <div>
          <dt>{L('Respuestas hoy', 'Answers today')}</dt>
          <dd>{nf(done)}</dd>
        </div>
      </dl>
      <p className="tip-line">
        {days[now]
          ? L(streak > 1 ? `Hoy ya cuenta: llevas ${streak} días seguidos jugando.` : 'Hoy ya cuenta: mañana serán dos días seguidos.', streak > 1 ? `Today already counts: ${streak} days in a row.` : 'Today already counts: tomorrow makes two in a row.')
          : streak > 0
            ? L(`Hoy todavía no has jugado: una partida mantiene la racha de ${daysText(streak)}.`, `You have not played today yet: one game keeps the run of ${daysText(streak)} going.`)
            : L('Hoy todavía no has jugado: una partida empieza una racha.', 'You have not played today yet: one game starts a run.')}{' '}
        {L('Cuenta cada día en el que terminas una partida o el reto del día.', 'Every day on which you finish a game or the daily challenge counts.')}
      </p>

      <div className="act-goal">
        <div className="act-goal-set">
          <span className="opt-label">
            <Target size={15} aria-hidden="true" /> {L('Meta diaria', 'Daily target')}
          </span>
          <Seg
            small
            label={L('Respuestas al día', 'Answers a day')}
            value={goal}
            onChange={setDayGoal}
            options={DAY_GOALS.map((n) => ({ value: n as number, label: n === 0 ? L('Sin meta', 'None') : String(n) }))}
          />
          {goal > 0 && <span className="act-goal-unit">{L('respuestas al día', 'answers a day')}</span>}
        </div>
        {goal > 0 && (
          <div className="act-goal-now">
            <div className="bar" role="img" aria-label={L(`${nf(done)} de ${nf(goal)} respuestas hoy`, `${nf(done)} of ${nf(goal)} answers today`)}>
              <i style={{ width: `${Math.min(100, Math.round((done / goal) * 100))}%` }} />
            </div>
            <p className={cx('act-goal-text', done >= goal && 'met')}>
              {done >= goal ? (
                <>
                  <Check size={15} aria-hidden="true" /> {L(`Meta de hoy cumplida: ${answersText(done)}.`, `Today’s target met: ${answersText(done)}.`)}
                </>
              ) : (
                L(`Hoy llevas ${nf(done)} de ${nf(goal)}: te ${goal - done === 1 ? 'falta' : 'faltan'} ${nf(goal - done)}.`, `${nf(done)} of ${nf(goal)} today: ${nf(goal - done)} to go.`)
              )}
            </p>
          </div>
        )}
        <p className="tip-line">
          {L(
            'Cuentan las preguntas de las partidas que terminas, acertadas o no, y las del reto del día. Un día que cumplió su meta la conserva aunque luego la cambies.',
            'The questions of the games you finish count, right or wrong, and those of the daily challenge. A day that met its target keeps it even if you change the target later.',
          )}
        </p>
      </div>

      <div className="cal-wrap">
        <div
          className="cal"
          role="img"
          aria-label={L(`Calendario de actividad: ${daysText(inYear)} con partidas en el último año.`, `Calendar of activity: ${daysText(inYear)} with games in the last year.`)}
          onPointerOver={pick}
          onClick={pick}
        >
          <div className="cal-rows" aria-hidden="true">
            <span />
            {[0, 1, 2, 3, 4, 5, 6].map((d) => (
              // A Monday of any week, for the letter of each row: 2024-01-01 was one.
              <span key={d}>{d % 2 === 0 ? fmtDay(`2024-01-0${d + 1}`, { weekday: 'narrow' }).toUpperCase() : ''}</span>
            ))}
          </div>
          {cal.map((week) => {
            // The column of the week in which a month begins says which.
            const first = week.find((d) => d.day.endsWith('-01'));
            return (
              <div key={week[0].day} className="cal-week">
                <span className="cal-month">{first ? fmtDay(first.day, { month: 'short' }).replace('.', '') : ''}</span>
                {week.map((d) => (
                  <i key={d.day} data-day={d.future ? undefined : d.day} className={cx('cal-day', `lv-${d.level}`, d.future && 'cal-future', d.rec?.[4] ? 'cal-met' : '', d.day === now && 'cal-today', d.day === picked && 'cal-on')} />
                ))}
              </div>
            );
          })}
        </div>
      </div>
      <p className="cal-foot">
        <span className="cal-legend" aria-hidden="true">
          {L('Menos', 'Less')}
          {[0, 1, 2, 3, 4].map((lv) => (
            <i key={lv} className={`cal-day lv-${lv}`} />
          ))}
          {L('Más', 'More')}
        </span>
        {goal > 0 || cal.flat().some((d) => d.rec?.[4]) ? (
          <span className="cal-legend" aria-hidden="true">
            <i className="cal-day lv-3 cal-met" /> {L('meta cumplida', 'target met')}
          </span>
        ) : null}
      </p>
      <p className="cal-detail" aria-live="polite">
        {picked ? dayText(picked, days[picked]) : L('Pasa el cursor por un día, o tócalo, para ver lo que hiciste.', 'Hover over a day, or tap it, to see what you did.')}
      </p>
    </section>
  );
}

// --------------------------------------------------------------- how it goes

/** The weeks of the chart, in bars: how much was answered, and how much of it right first time. */
function WeekChart({ days, now }: { days: Days; now: string }) {
  const weeks = useMemo(() => weeksOf(days, now, CHART_WEEKS), [days, now]);
  const { top, step } = scaleFor(Math.max(...weeks.map((w) => w.answers)));
  const lines = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const total = weeks.reduce((n, w) => n + w.answers, 0);
  const ok = weeks.reduce((n, w) => n + w.ok, 0);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked == null ? null : weeks[picked];
  const weekName = (from: string) => fmtDay(from, { day: 'numeric', month: 'long' });

  return (
    <figure className="chart">
      <figcaption>
        <b>{L('Respuestas por semana', 'Answers by week')}</b>
        <span className="chart-key" aria-hidden="true">
          <i className="key-ok" /> {L('a la primera', 'right first time')} <i className="key-all" /> {L('el resto', 'the rest')}
        </span>
      </figcaption>
      <div
        className="chart-box"
        role="img"
        aria-label={L(
          `Respuestas por semana en las últimas ${CHART_WEEKS} semanas: ${answersText(total)}, ${share(ok, total)} a la primera.`,
          `Answers by week over the last ${CHART_WEEKS} weeks: ${answersText(total)}, ${share(ok, total)} right first time.`,
        )}
      >
        <div className="chart-lines" aria-hidden="true">
          {lines.map((v) => (
            <span key={v} style={{ bottom: `${(v / top) * 100}%` }}>
              {nf(v)}
            </span>
          ))}
        </div>
        <div
          className="chart-bars"
          onPointerOver={(e) => {
            const i = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')?.dataset.i;
            if (i != null) setPicked(Number(i));
          }}
          onClick={(e) => {
            const i = (e.target as HTMLElement).closest<HTMLElement>('[data-i]')?.dataset.i;
            if (i != null) setPicked(Number(i));
          }}
        >
          {weeks.map((w, i) => (
            <div key={w.from} data-i={i} className={cx('chart-col', i === picked && 'on')}>
              <i className="bar-all" style={{ height: `${(w.answers / top) * 100}%` }}>
                <i className="bar-ok" style={{ height: w.answers ? `${(w.ok / w.answers) * 100}%` : 0 }} />
              </i>
            </div>
          ))}
        </div>
        <div className="chart-x" aria-hidden="true">
          {weeks.map((w) => {
            // The week in which a month begins is marked with its name.
            const first = [0, 1, 2, 3, 4, 5, 6].map((d) => fmtIso(w.from, d)).find((d) => d.endsWith('-01'));
            return <span key={w.from}>{first ? fmtDay(first, { month: 'short' }).replace('.', '') : ''}</span>;
          })}
        </div>
      </div>
      <p className="chart-detail" aria-live="polite">
        {shown
          ? L(
              `Semana del ${weekName(shown.from)}: ${answersText(shown.answers)}${shown.answers ? `, ${share(shown.ok, shown.answers)} a la primera, en ${daysText(shown.days)}` : ''}.`,
              `Week of ${weekName(shown.from)}: ${answersText(shown.answers)}${shown.answers ? `, ${share(shown.ok, shown.answers)} right first time, on ${daysText(shown.days)}` : ''}.`,
            )
          : L(`En ${CHART_WEEKS} semanas: ${answersText(total)}, ${share(ok, total)} a la primera.`, `In ${CHART_WEEKS} weeks: ${answersText(total)}, ${share(ok, total)} right first time.`)}
      </p>
    </figure>
  );
}

/**
 * How many answers are learnt, day by day since it is written down: a line that goes up in steps, up to
 * what is learnt right now.
 */
function LearntChart({ days, now, learnt }: { days: Days; now: string; learnt: number }) {
  const points = useMemo(() => learntOver(days, { day: now, learnt }), [days, now, learnt]);
  const first = points[0];
  const last = points[points.length - 1];
  const span = Math.max(1, daysBetween(first.day, now));
  const { top, step } = scaleFor(Math.max(...points.map((p) => p.learnt)));
  const lines = Array.from({ length: top / step + 1 }, (_, i) => i * step);
  const x = (day: string) => (daysBetween(first.day, day) / span) * 100;
  const y = (v: number) => 100 - (v / top) * 100;
  // What was learnt holds until the next day it is written down, and to today after the last one.
  let path = `M0 ${y(first.learnt)}`;
  for (const p of points.slice(1)) path += ` H${x(p.day).toFixed(2)} V${y(p.learnt).toFixed(2)}`;
  path += ' H100';
  const gained = last.learnt - first.learnt;

  return (
    <figure className="chart">
      <figcaption>
        <b>{L('Respuestas aprendidas', 'Answers learnt')}</b>
      </figcaption>
      {points.length < 2 ? (
        <p className="tip-line">
          {L(
            `Hoy tienes ${nf(last.learnt)} ${last.learnt === 1 ? 'respuesta aprendida' : 'respuestas aprendidas'}. La cifra se apunta cada día que juegas, y la gráfica se dibuja en cuanto hay un día anterior con el que comparar.`,
            `You have ${nf(last.learnt)} ${last.learnt === 1 ? 'answer' : 'answers'} learnt today. The figure is written down every day you play, and the chart is drawn as soon as there is an earlier day to compare with.`,
          )}
        </p>
      ) : (
        <>
          <div
            className="chart-box chart-line"
            role="img"
            aria-label={L(
              `Respuestas aprendidas: de ${nf(first.learnt)} el ${fmtDay(first.day, { day: 'numeric', month: 'long', year: 'numeric' })} a ${nf(last.learnt)} hoy.`,
              `Answers learnt: from ${nf(first.learnt)} on ${fmtDay(first.day, { day: 'numeric', month: 'long', year: 'numeric' })} to ${nf(last.learnt)} today.`,
            )}
          >
            <div className="chart-lines" aria-hidden="true">
              {lines.map((v) => (
                <span key={v} style={{ bottom: `${(v / top) * 100}%` }}>
                  {nf(v)}
                </span>
              ))}
            </div>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
              <path className="line-area" d={`${path} V100 H0 Z`} />
              <path className="line-stroke" d={path} />
            </svg>
            <div className="chart-x chart-ends" aria-hidden="true">
              <span>{fmtDay(first.day, { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              <span>{L('hoy', 'today')}</span>
            </div>
          </div>
          <p className="chart-detail">
            {L(
              `De ${nf(first.learnt)} a ${nf(last.learnt)} en ${daysText(span)}: ${gained >= 0 ? `${nf(gained)} más` : `${nf(-gained)} menos`}. Una respuesta aprendida que fallas deja de contar hasta que la aciertas otras dos veces seguidas.`,
              `From ${nf(first.learnt)} to ${nf(last.learnt)} in ${daysText(span)}: ${gained >= 0 ? `${nf(gained)} more` : `${nf(-gained)} fewer`}. A learnt answer that you miss stops counting until you get it right twice running again.`,
            )}
          </p>
        </>
      )}
    </figure>
  );
}

export function EvolutionBlock() {
  const days = useStore((s) => s.days);
  const stats = useStore((s) => s.stats);
  const learnt = useMemo(() => learntIn(stats), [stats]);
  const now = today();
  if (!Object.keys(days).length) return null;
  return (
    <section className="block evolution">
      <h2>{L('Evolución', 'How it is going')}</h2>
      <div className="charts">
        <WeekChart days={days} now={now} />
        <LearntChart days={days} now={now} learnt={learnt} />
      </div>
    </section>
  );
}

// ------------------------------------------------------- each month and year

/** Months listed before "show more". */
const MONTHS_SHOWN = 6;

/** A summary in a sentence: what a month or a year added up to. */
function summary(what: string, s: Span): string {
  if (!s.days) return L(`${what}: todavía nada.`, `${what}: nothing yet.`);
  const top = s.top ? fmtDay(s.top.day, { weekday: 'long', day: 'numeric', month: 'long' }) : '';
  return L(
    `${what}: ${daysText(s.days)} de juego, ${gamesText(s.games)} y ${answersText(s.answers)}, ${share(s.ok, s.answers)} a la primera, en ${fmtSpan(s.ms)}.${s.top && s.days > 1 ? ` El día más completo, el ${top}: ${answersText(s.top.answers)}.` : ''}`,
    `${what}: ${daysText(s.days)} of play, ${gamesText(s.games)} and ${answersText(s.answers)}, ${share(s.ok, s.answers)} right first time, in ${fmtSpan(s.ms)}.${s.top && s.days > 1 ? ` The fullest day, ${top}: ${answersText(s.top.answers)}.` : ''}`,
  );
}

export function MonthsBlock() {
  const days = useStore((s) => s.days);
  const now = today();
  const months = useMemo(() => monthsOf(days, now), [days, now]);
  const years = useMemo(() => yearsOf(days, now), [days, now]);
  const [all, setAll] = useState(false);
  if (!Object.keys(days).length) return null;
  const monthName = (month: string, year = false) => capital(fmtDay(`${month}-01`, year ? { month: 'long', year: 'numeric' } : { month: 'long' }));
  const shown = all ? months : months.slice(0, MONTHS_SHOWN);
  const row = (s: Span) => (
    <>
      <td>{s.days ? nf(s.days) : '—'}</td>
      <td className="wide-only">{s.days ? nf(s.games) : '—'}</td>
      <td>{s.days ? nf(s.answers) : '—'}</td>
      <td>{share(s.ok, s.answers)}</td>
      <td className="wide-only">{s.days ? fmtSpan(s.ms) : '—'}</td>
      <td className="wide-only">{s.met ? nf(s.met) : '—'}</td>
    </>
  );

  return (
    <section className="block months">
      <h2>{L('Mes a mes', 'Month by month')}</h2>
      <p className="months-now">{summary(L('Este mes', 'This month'), months[0])}</p>
      <p className="months-now">{summary(L(`En ${years[0].year}`, `In ${years[0].year}`), years[0])}</p>
      <div className="table-wrap">
        <table className="sessions months-table">
          <thead>
            <tr>
              <th scope="col">{L('Mes', 'Month')}</th>
              <th scope="col">{L('Días', 'Days')}</th>
              <th scope="col" className="wide-only">
                {L('Partidas', 'Games')}
              </th>
              <th scope="col">{L('Respuestas', 'Answers')}</th>
              <th scope="col">{L('A la primera', 'First time')}</th>
              <th scope="col" className="wide-only">
                {L('Tiempo', 'Time')}
              </th>
              <th scope="col" className="wide-only">
                {L('Metas', 'Targets')}
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((m, i) => {
              const year = m.month.slice(0, 4);
              // Each year is headed by what it adds up to.
              const heads = i === 0 || shown[i - 1].month.slice(0, 4) !== year;
              const whole = years.find((y) => y.year === year);
              return [
                heads && whole ? (
                  <tr key={year} className="months-year">
                    <th scope="row">{year}</th>
                    {row(whole)}
                  </tr>
                ) : null,
                <tr key={m.month} className={cx(!m.days && 'months-none')}>
                  <th scope="row">{monthName(m.month)}</th>
                  {row(m)}
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
      {months.length > MONTHS_SHOWN && (
        <button type="button" className="btn btn-sm btn-ghost months-more" onClick={() => setAll((v) => !v)} aria-expanded={all}>
          {all ? L('Ver solo los últimos meses', 'Show the latest months only') : L(`Ver los ${months.length} meses`, `Show all ${months.length} months`)}
        </button>
      )}
      <p className="tip-line">
        {L(
          `Se guardan los últimos ${DAYS_MAX} días de juego, en este navegador; la copia de seguridad los lleva consigo.`,
          `The last ${DAYS_MAX} days of play are kept, in this browser; the backup carries them along.`,
        )}
      </p>
    </section>
  );
}
