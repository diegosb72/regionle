/** What the player knows of a piece, on its card: how each kind of question has gone, when it comes back and what it is taken for. */
import { useMemo } from 'react';
import { dayGap, historyOf, mixedWith, type SkillHistory } from '../lib/history';
import { L } from '../lib/i18n';
import { useStore, type Skill } from '../lib/store';
import { cx, nf } from '../lib/text';
import './note.css';

// Said without a gender: a piece is a country, a region, a river or a city.
const skillName = (skill: Skill): string =>
  skill === 'loc' ? L('En el mapa', 'On the map') : skill === 'name' ? L('Su nombre', 'Its name') : skill === 'cap' ? L('Su capital', 'Its capital') : skill === 'flag' ? L('Su bandera', 'Its flag') : L('Sus vecinos', 'Its neighbours');

const gradeName = (h: SkillHistory): string => (h.grade === 'known' ? L('Lo sabes', 'You know it') : h.grade === 'due' ? L('Toca repaso', 'Due for review') : L('Aprendiendo', 'Learning'));

/** "hoy", "ayer", "hace 5 días". */
const ago = (days: number): string => (days <= 0 ? L('hoy', 'today') : days === 1 ? L('ayer', 'yesterday') : L(`hace ${nf(days)} días`, `${nf(days)} days ago`));

/** When it comes back: later today, tomorrow or in so many days. Nothing where it is due: its label says so. */
function back(h: SkillHistory, now: number): string {
  if (h.grade === 'due') return '';
  const days = h.due <= now ? 0 : dayGap(now, h.due);
  return days <= 0 ? L(' · vuelve hoy', ' · back today') : days === 1 ? L(' · vuelve mañana', ' · back tomorrow') : L(` · vuelve en ${nf(days)} días`, ` · back in ${nf(days)} days`);
}

/**
 * `nameOf` gives the name of another piece of the same map, for the ones this one is mixed up with; a
 * piece that is not on this map is left out.
 */
export function PieceHistory({ id, nameOf }: { id: string; nameOf: (id: string) => string | undefined }) {
  const stats = useStore((s) => s.stats);
  const mix = useStore((s) => s.mix);
  const now = Date.now();
  const rows = useMemo(() => historyOf(stats, id, Date.now()), [stats, id]);
  const mixed = useMemo(
    () =>
      mixedWith(mix, stats, id)
        .map((m) => ({ ...m, name: nameOf(m.other) }))
        .filter((m): m is typeof m & { name: string } => !!m.name),
    [mix, stats, id, nameOf],
  );

  return (
    <div className="history">
      <p className="label">{L('Tu historial', 'Your history')}</p>
      {rows.length ? (
        <ul className="history-list">
          {rows.map((h) => (
            <li key={h.skill} data-skill={h.skill}>
              <b>{skillName(h.skill)}</b>
              <span className={cx('history-grade', `g-${h.grade}`)}>{gradeName(h)}</span>
              <small>
                {L(
                  `${h.seen === 1 ? '1 vez' : `${nf(h.seen)} veces`}, ${nf(h.right)} a la primera · la última vez, ${ago(dayGap(h.last, now))}${back(h, now)}`,
                  `${h.seen === 1 ? 'Once' : `${nf(h.seen)} times`}, ${nf(h.right)} right first time · last asked ${ago(dayGap(h.last, now))}${back(h, now)}`,
                )}
              </small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="note-hint">{L('Todavía no ha salido en ninguna pregunta.', 'It has not come up in a question yet.')}</p>
      )}
      {mixed.length > 0 && (
        <p className="history-mix">
          {L('Se te confunde con', 'You mix it up with')}{' '}
          {mixed.slice(0, 4).map((m, i) => (
            <span key={`${m.skill}:${m.other}`}>
              {i > 0 && (i === Math.min(mixed.length, 4) - 1 ? L(' y ', ' and ') : ', ')}
              <b>{m.name}</b> <small>({m.times === 1 ? L('1 vez', 'once') : L(`${nf(m.times)} veces`, `${nf(m.times)} times`)})</small>
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
