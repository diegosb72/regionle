/**
 * The card of the daily challenge on the home page. It lives apart from the challenge itself so that the
 * first screen does not bring the map and the five tests with it.
 */
import { CalendarDays, Check, Flame, Play } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Flag } from '../components/ui';
import { L, fmtDay, fmtWeekday, nm } from '../lib/i18n';
import { go } from '../lib/router';
import { DAILY_PATH } from '../lib/routes';
import { useStore } from '../lib/store';
import { cx, today } from '../lib/text';
import { isFeminine, levelOf, type World } from '../lib/world';
import { TESTS, countryOfDay, dailyPool, dayNumber, doneCount, streakOf, totalOf } from './spec';

/** The name of each test, in the order they are played. */
export const testName = (i: number): string =>
  [L('Regionle', 'Regionle'), L('Señalar', 'Pin it'), L('Ruta', 'Route'), L('¿Qué país?', 'Which country?'), L('Banderas y capitales', 'Flags and capitals')][i];

/** Time left until the next challenge, as text; it is read again every twenty seconds. */
export function useCountdown(): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(t);
  }, []);
  const end = new Date(now);
  end.setHours(24, 0, 0, 0);
  const mins = Math.max(0, Math.round((end.getTime() - now) / 60000));
  return `${Math.floor(mins / 60)} h ${String(mins % 60).padStart(2, '0')} min`;
}

export function DailyCard({ world }: { world: World }) {
  const daily = useStore((s) => s.daily);
  const bestStreak = useStore((s) => s.best['daily:streak'] ?? 0);
  const date = today();
  const pool = useMemo(() => dailyPool(world.index), [world]);
  const country = countryOfDay(pool, dayNumber(date));
  const rec = daily[date];
  const done = doneCount(rec);
  const streak = streakOf(daily, date);
  const level = levelOf(country);
  const fem = isFeminine(level.sg);
  const left = useCountdown();
  return (
    <section className="d-card" aria-labelledby="d-card-title">
      <div className="d-card-main">
        <p className="kicker">
          {L('Reto del día', 'Daily challenge')} · {fmtWeekday(date)}, {fmtDay(date)}
        </p>
        <h2 id="d-card-title">
          <Flag code={country.fl} size="lg" />
          <span>
            {L('Hoy toca', 'Today:')} <em>{nm(country.n)}</em>
          </span>
        </h2>
        <p className="d-card-text">
          {L(
            `Cinco pruebas cortas, las mismas para todo el mundo: adivina ${fem ? 'una' : 'uno'} de sus ${level.n} ${level.es} por la silueta, señala ${fem ? 'otras' : 'otros'} cinco en el mapa, une dos países, acierta un país por su población y responde a cinco banderas y capitales.`,
            `Five short tests, the same for everybody: guess one of its ${level.n} ${level.en} from its outline, find five more on the map, join two countries, guess a country from its population and answer five flags and capitals.`,
          )}
        </p>
        <ol className="d-steps" aria-label={L('Pruebas de hoy', "Today's tests")}>
          {Array.from({ length: TESTS }, (_, i) => {
            const p = rec?.p[i];
            return (
              <li key={i} className={cx(p != null && 'done')}>
                <i>{p != null ? <Check size={13} strokeWidth={3} aria-hidden="true" /> : i + 1}</i>
                {testName(i)}
                {p != null && <b>{p}</b>}
              </li>
            );
          })}
        </ol>
      </div>
      <div className="d-card-side">
        {rec?.t ? (
          <p className="d-card-score">
            <strong>{totalOf(rec)}</strong>
            <span>/ 100</span>
          </p>
        ) : null}
        <button type="button" className="btn btn-accent btn-lg" onClick={() => go(DAILY_PATH)}>
          {rec?.t ? <CalendarDays size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          {rec?.t ? L('Ver mi resultado', 'See my result') : done ? L(`Seguir: prueba ${done + 1} de ${TESTS}`, `Continue: test ${done + 1} of ${TESTS}`) : L('Jugar el reto de hoy', "Play today's challenge")}
        </button>
        <p className="d-card-meta">
          <span className={cx('d-streak', streak > 0 && 'on')} title={L(`Tu mejor racha: ${bestStreak}`, `Your best streak: ${bestStreak}`)}>
            <Flame size={15} aria-hidden="true" />
            {streak === 0 ? L('Empieza hoy tu racha', 'Start your streak today') : streak === 1 ? L('1 día seguido', '1 day in a row') : L(`${streak} días seguidos`, `${streak} days in a row`)}
          </span>
          {rec?.t ? <span>{L(`Nuevo reto en ${left}`, `Next challenge in ${left}`)}</span> : null}
        </p>
      </div>
    </section>
  );
}
