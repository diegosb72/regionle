/**
 * The figures of the daily challenge, under its result: how many were finished, the average, how the totals
 * are spread and which of the five tests goes best. All of it is read from the results kept in the browser.
 */
import { useMemo } from 'react';
import { L, fmtDay } from '../lib/i18n';
import { useStore } from '../lib/store';
import { cx, nf, today } from '../lib/text';
import { testName } from './Card';
import { totalOf } from './spec';
import { BANDS, RECENT, bandLabel, bandOf, dailyStats, extremes } from './stats';

/** Whether there is anything to show: a challenge finished. */
export const useHasStats = (): boolean => useStore((s) => Object.values(s.daily).some((rec) => !!rec?.t));

/** `current` is the day on screen: its band is the one marked in the chart. */
export function DailyStatsBlock({ current }: { current?: string }) {
  const daily = useStore((s) => s.daily);
  const kept = useStore((s) => s.best['daily:streak'] ?? 0);
  const now = today();
  const s = useMemo(() => dailyStats(daily, now), [daily, now]);
  if (!s.played) return null;
  const mine = current && daily[current]?.t ? bandOf(totalOf(daily[current])) : -1;
  const most = Math.max(1, ...s.bands);
  const ends = extremes(s.tests, s.played);
  const longest = Math.max(s.longest, kept);
  const times = (n: number): string => L(n === 1 ? '1 vez' : `${nf(n)} veces`, n === 1 ? 'once' : n === 2 ? 'twice' : `${nf(n)} times`);
  const tiles: [string, string, string?][] = [
    [L('Retos terminados', 'Challenges finished'), nf(s.played)],
    [L('Media', 'Average'), nf(s.mean, 1), L('de 100', 'of 100')],
    [L('Mejor resultado', 'Best result'), nf(s.best?.total ?? 0), s.best ? fmtDay(s.best.date) : undefined],
    [L('Racha', 'Streak'), nf(s.streak), L(s.streak === 1 ? 'día' : 'días', s.streak === 1 ? 'day' : 'days')],
    [L('Mejor racha', 'Best streak'), nf(longest), L(longest === 1 ? 'día' : 'días', longest === 1 ? 'day' : 'days')],
  ];
  return (
    <div className="d-stats">
      <dl className="d-tiles">
        {tiles.map(([name, figure, note]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>
              <b>{figure}</b>
              {note && <span>{note}</span>}
            </dd>
          </div>
        ))}
      </dl>

      <h4>{L('Cómo se reparten tus puntos', 'How your points are spread')}</h4>
      <ol className="d-dist">
        {Array.from({ length: BANDS }, (_, i) => BANDS - 1 - i).map((band) => (
          <li key={band} className={cx(band === mine && 'on')} aria-label={`${bandLabel(band)} ${L('puntos', 'points')}: ${times(s.bands[band])}`}>
            <span aria-hidden="true">{bandLabel(band)}</span>
            <i aria-hidden="true">
              {/* A band with one result among many still shows a sliver; an empty one, nothing. */}
              <i style={{ width: s.bands[band] ? `${Math.max(2, (s.bands[band] / most) * 100)}%` : 0 }} />
            </i>
            <b aria-hidden="true">{nf(s.bands[band])}</b>
          </li>
        ))}
      </ol>

      <h4>{L('Media de cada prueba', 'Average of each test')}</h4>
      <ol className="d-rows d-means">
        {s.tests.map((t, i) => (
          <li key={i} className={cx(ends?.best === i && 'best', ends?.worst === i && 'worst')}>
            <span className="d-row-name">{testName(i)}</span>
            <span className="d-row-what">
              {ends?.best === i ? L('la que mejor se te da', 'your best') : ends?.worst === i ? L('la que más te cuesta', 'your hardest') : t.full ? L(`20 puntos ${times(t.full)}`, `20 points ${times(t.full)}`) : ''}
            </span>
            <span className="d-row-bar" aria-hidden="true">
              <i style={{ width: `${(t.mean / 20) * 100}%` }} className={t.mean >= 16 ? 'hi' : t.mean >= 8 ? 'mid' : 'lo'} />
            </span>
            <b>{nf(t.mean, 1)}</b>
          </li>
        ))}
      </ol>

      <p className="d-hint">
        {s.recent != null &&
          L(`En los últimos ${RECENT} retos, ${nf(s.recent, 1)} puntos de media. `, `Over the last ${RECENT} challenges, ${nf(s.recent, 1)} points on average. `)}
        {s.late > 0
          ? L(
              `Cuentan los retos terminados, también ${s.late === 1 ? 'el que jugaste' : `los ${nf(s.late)} que jugaste`} después de su día.`,
              `Every finished challenge counts, ${s.late === 1 ? 'the one' : `the ${nf(s.late)}`} you played after ${s.late === 1 ? 'its' : 'their'} day too.`,
            )
          : L('Cuentan los retos terminados; los que se dejan a medias, no.', 'Finished challenges count; those left halfway do not.')}
        {s.hard > 0 && L(` ${s.hard === 1 ? 'Uno lo jugaste' : `${nf(s.hard)} los jugaste`} en difícil.`, ` You played ${s.hard === 1 ? 'one' : nf(s.hard)} the hard way.`)}
        {s.held > 0 && L(` ${s.held === 1 ? 'Un día lo cubrió' : `${nf(s.held)} días los cubrió`} un comodín.`, ` A wildcard held ${s.held === 1 ? 'one day' : `${nf(s.held)} days`}.`)}
      </p>
    </div>
  );
}
