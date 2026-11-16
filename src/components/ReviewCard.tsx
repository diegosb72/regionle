/** Today's review: what was learnt comes back when it is about to be forgotten. */
import { ArrowRight, CalendarClock, Check } from 'lucide-react';
import { useMemo } from 'react';
import type { World } from '../lib/data';
import { L, levelNoun, nm } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { dueCount, dueGroups, forecast, reviewConfig, type ReviewGroup } from '../lib/review';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { nf } from '../lib/text';
import { Flag } from './ui';

/** What a group is about: "España · provincias". */
function groupPlace(g: ReviewGroup, world: World): { flag?: string; text: string } {
  const c = g.country ? world.byId.get(g.country) : undefined;
  if (g.section === 'regions') {
    if (!c) return { text: L('Regiones', 'Regions') };
    const level = c.lv.find((l) => l.k === g.level) ?? c.lv.find((l) => l.k === c.dl) ?? c.lv[0];
    return { flag: c.fl, text: level ? `${nm(c.n)} · ${levelNoun(level).many}` : nm(c.n) };
  }
  if (g.section === 'countries') return { text: L('Países', 'Countries') };
  if (g.section === 'cities') {
    if (g.pick === 'caps') return { text: L('Capitales de país', 'National capitals') };
    const what = g.pick === 'regcaps' ? L('capitales de región', 'regional capitals') : L('ciudades', 'cities');
    return { flag: c?.fl, text: c ? `${nm(c.n)} · ${what}` : what };
  }
  return { text: L('Ríos, mares y montañas', 'Rivers, seas and mountains') };
}

function useDue() {
  const stats = useStore((s) => s.stats);
  const where = useStore((s) => s.where);
  return useMemo(() => {
    const now = Date.now();
    const groups = dueGroups(stats, where, now);
    return { groups, due: dueCount(groups), ahead: forecast(stats, now, 7), any: Object.keys(stats).length > 0 };
  }, [stats, where]);
}

export function ReviewCard({ world }: { world: World }) {
  const { groups, due, ahead, any } = useDue();
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  if (!any) return null;

  const play = (g: ReviewGroup) => {
    start(reviewConfig(g, opts));
    go('jugar');
  };
  const week = ahead.reduce((n, x) => n + x, 0);
  const shown = groups.slice(0, 5);

  return (
    <section className={due ? 'review' : 'review review-idle'} aria-label={L('Repaso de hoy', "Today's review")}>
      <div className="review-main">
        <p className="kicker">
          <CalendarClock size={15} aria-hidden="true" /> {L('Repaso de hoy', "Today's review")}
        </p>
        {due ? (
          <>
            <h2>
              <b>{nf(due)}</b> {L(due === 1 ? 'respuesta por repasar' : 'respuestas por repasar', due === 1 ? 'answer to review' : 'answers to review')}
            </h2>
            <p className="review-text">
              {L(
                'Lo que aprendiste vuelve justo antes de que se te olvide: al día siguiente, a los tres días, a la semana, al mes… Cada acierto lo aleja; cada fallo lo trae de vuelta.',
                'What you learnt comes back just before you forget it: the next day, three days later, a week, a month… Each right answer pushes it away; each miss brings it back.',
              )}
            </p>
          </>
        ) : (
          <>
            <h2>
              <Check size={22} aria-hidden="true" /> {L('Todo al día', 'All caught up')}
            </h2>
            <p className="review-text">
              {week
                ? L(
                    `Nada que repasar ahora. ${ahead[1] ? `Mañana ${ahead[1] === 1 ? 'vuelve 1 respuesta' : `vuelven ${nf(ahead[1])} respuestas`}; en` : 'En'} los próximos siete días, ${nf(week)}.`,
                    `Nothing to review now. ${ahead[1] ? `Tomorrow ${ahead[1] === 1 ? '1 answer comes' : `${nf(ahead[1])} answers come`} back; over` : 'Over'} the next seven days, ${nf(week)}.`,
                  )
                : L('Nada que repasar esta semana. Juega algo nuevo y volverá cuando toque.', 'Nothing to review this week. Play something new and it will come back in due time.')}
            </p>
          </>
        )}
      </div>
      {due > 0 && (
        <>
          <ul className="review-list">
            {shown.map((g) => {
              const place = groupPlace(g, world);
              return (
                <li key={g.key}>
                  <button type="button" onClick={() => play(g)} title={L('Repasar solo esto', 'Review just this')}>
                    {place.flag && <Flag code={place.flag} size="sm" />}
                    <span>
                      {place.text} <small>· {MODE_NAME[g.mode]}</small>
                    </span>
                    <b>{nf(g.ids.length)}</b>
                  </button>
                </li>
              );
            })}
            {groups.length > shown.length && <li className="review-more">{L(`y ${groups.length - shown.length} mapas más`, `and ${groups.length - shown.length} more maps`)}</li>}
          </ul>
          <button type="button" className="btn btn-primary btn-lg review-go" onClick={() => play(groups[0])}>
            {L('Empezar el repaso', 'Start the review')}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
        </>
      )}
    </section>
  );
}

/** At the end of a review game: what is left for today, one click away. */
export function ReviewNext() {
  const { groups, due } = useDue();
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  return (
    <div className="review-next" role="status">
      {due ? (
        <>
          <p>
            <b>{nf(due)}</b> {L(due === 1 ? 'respuesta más por repasar hoy' : 'respuestas más por repasar hoy', due === 1 ? 'more answer to review today' : 'more answers to review today')}
            {groups.length > 1 ? L(`, en ${groups.length} mapas.`, `, on ${groups.length} maps.`) : '.'}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => start(reviewConfig(groups[0], opts))} autoFocus>
            {L('Siguiente repaso', 'Next review')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </>
      ) : (
        <p>
          <Check size={16} aria-hidden="true" /> <b>{L('Repaso de hoy terminado.', "Today's review is done.")}</b> {L('Lo que has fallado volverá dentro de un rato.', 'What you missed will come back in a while.')}
        </p>
      )}
    </div>
  );
}
