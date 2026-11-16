/** Achievements and levels on screen: the notice when one is earned, the board in Progress and the chip on the home page. */
import {
  Award,
  Building2,
  CalendarCheck,
  Crosshair,
  Earth,
  Flag,
  Flame,
  Footprints,
  Globe,
  GraduationCap,
  Hash,
  Heart,
  Landmark,
  ListChecks,
  Map as MapIcon,
  Medal,
  MountainSnow,
  PaintBucket,
  Shapes,
  Star,
  Target,
  Timer,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { BADGE_GROUPS, POINTS, badgesOf, groupName, isEarned, levelOfPoints, pointsOf, type Badge } from '../lib/badges';
import type { World } from '../lib/data';
import { L, getLang } from '../lib/i18n';
import { useStore } from '../lib/store';
import { cx, nf } from '../lib/text';

const ICONS: Record<string, LucideIcon> = {
  world: Earth,
  detail: MapIcon,
  regions100: Shapes,
  regions500: Shapes,
  caps50: Landmark,
  flags50: Flag,
  cities100: Building2,
  phys50: MountainSnow,
  nb25: Waypoints,
  first: Footprints,
  g25: CalendarCheck,
  g100: Medal,
  q1000: Hash,
  perfect: Star,
  streak3: Flame,
  streak7: Flame,
  streak30: Flame,
  lessons10: GraduationCap,
  regionle1: Target,
  fill: PaintBucket,
  near: Crosshair,
  timed20: Timer,
  lives30: Heart,
  list: ListChecks,
};
const iconOf = (id: string): LucideIcon => ICONS[id] ?? (id.startsWith('ct-') ? Globe : Award);

/** Every achievement with its progress, read from the store. */
export function useBadges(world: World): Badge[] {
  const stats = useStore((s) => s.stats);
  const where = useStore((s) => s.where);
  const sessions = useStore((s) => s.sessions);
  const best = useStore((s) => s.best);
  const tot = useStore((s) => s.tot);
  const lists = useStore((s) => s.lists);
  return useMemo(() => badgesOf({ stats, where, sessions, best, tot, lists, index: world.index }), [stats, where, sessions, best, tot, lists, world]);
}

/**
 * Keeps the list of earned achievements up to date and says so when a new one comes in. Mounted once,
 * for the whole app: an achievement can be earned in any game.
 */
export function BadgeWatcher({ world }: { world: World }) {
  const badges = useBadges(world);
  const earned = useStore((s) => s.badges);
  const earn = useStore((s) => s.earn);
  const [notice, setNotice] = useState<Badge[]>([]);
  const timer = useRef(0);

  useEffect(() => {
    const fresh = badges.filter((b) => isEarned(b) && !earned[b.id]);
    if (!fresh.length) return;
    earn(fresh.map((b) => b.id));
    setNotice(fresh);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setNotice([]), 7000);
  }, [badges, earned, earn]);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!notice.length) return null;
  const Icon = notice.length === 1 ? iconOf(notice[0].id) : Award;
  return (
    <a className="toast" href="#/progreso" role="status" onClick={() => setNotice([])}>
      <span className="toast-icon">
        <Icon size={20} aria-hidden="true" />
      </span>
      <span>
        <b>{notice.length === 1 ? L('Logro conseguido', 'Achievement earned') : L(`${notice.length} logros conseguidos`, `${notice.length} achievements earned`)}</b>
        <span>
          {notice
            .slice(0, 3)
            .map((b) => b.name)
            .join(' · ')}
          {notice.length > 3 ? L(` y ${notice.length - 3} más`, ` and ${notice.length - 3} more`) : ''}
        </span>
      </span>
    </a>
  );
}

function useLevel(world: World) {
  const badges = useBadges(world);
  const tot = useStore((s) => s.tot);
  const earned = badges.filter(isEarned).length;
  return { badges, earned, level: levelOfPoints(pointsOf(tot, earned)) };
}

/** One line for the home page: the level and how many achievements are in. */
export function LevelChip({ world }: { world: World }) {
  const { badges, earned, level } = useLevel(world);
  return (
    <a className="level-chip" href="#/progreso">
      <span className="level-n">{level.n}</span>
      <span>
        <b>{level.name}</b>
        <small>
          {L(`${nf(level.points)} puntos`, `${nf(level.points)} points`)} · {L(`${earned} de ${badges.length} logros`, `${earned} of ${badges.length} achievements`)}
        </small>
      </span>
    </a>
  );
}

/** The level and the board of achievements, for the Progress page. */
export function BadgeBoard({ world }: { world: World }) {
  const { badges, earned, level } = useLevel(world);
  const dates = useStore((s) => s.badges);
  const locale = getLang() === 'en' ? 'en-GB' : 'es-ES';
  const day = (t: number) => new Date(t).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  return (
    <section className="block">
      <h2>{L('Nivel y logros', 'Level and achievements')}</h2>
      <div className="level">
        <span className="level-n" aria-hidden="true">
          {level.n}
        </span>
        <div className="level-main">
          <p className="level-name">
            <small>{L(`Nivel ${level.n}`, `Level ${level.n}`)}</small>
            <b>{level.name}</b>
          </p>
          <div className="bar" role="img" aria-label={level.next == null ? L('Nivel máximo', 'Top level') : L(`${nf(level.points)} de ${nf(level.next)} puntos`, `${nf(level.points)} of ${nf(level.next)} points`)}>
            <i style={{ width: `${Math.round(level.part * 100)}%` }} />
          </div>
          <small>
            {level.next == null
              ? L(`${nf(level.points)} puntos: has llegado al último nivel.`, `${nf(level.points)} points: you have reached the top level.`)
              : L(`${nf(level.points)} puntos · faltan ${nf(level.next - level.points)} para el nivel ${level.n + 1}`, `${nf(level.points)} points · ${nf(level.next - level.points)} to go for level ${level.n + 1}`)}
          </small>
        </div>
      </div>
      <p className="tip-line">
        {L(
          `Cada acierto a la primera da ${POINTS.ok} puntos; cada acierto con ayuda, ${POINTS.warn}; cada logro, ${POINTS.badge}. Llevas ${earned} de ${badges.length} logros.`,
          `Each first-time right answer gives ${POINTS.ok} points; each right answer with help, ${POINTS.warn}; each achievement, ${POINTS.badge}. You have ${earned} of ${badges.length} achievements.`,
        )}
      </p>
      {BADGE_GROUPS.map((g) => (
        <div key={g} className="badge-group">
          <h3>{groupName(g)}</h3>
          <ul className="badges">
            {badges
              .filter((b) => b.group === g)
              .map((b) => {
                const Icon = iconOf(b.id);
                const on = isEarned(b);
                return (
                  <li key={b.id} className={cx('badge', on && 'on')}>
                    <span className="badge-icon">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div>
                      <b>{b.name}</b>
                      <p>{b.desc}</p>
                      {on ? (
                        <small className="badge-when">{dates[b.id] ? L(`Conseguido el ${day(dates[b.id])}`, `Earned on ${day(dates[b.id])}`) : L('Conseguido', 'Earned')}</small>
                      ) : b.goal > 1 ? (
                        <div className="badge-bar" role="img" aria-label={L(`${nf(b.done)} de ${nf(b.goal)}`, `${nf(b.done)} of ${nf(b.goal)}`)}>
                          <i style={{ width: `${Math.round((b.done / b.goal) * 100)}%` }} />
                          <small>
                            {nf(b.done)} / {nf(b.goal)}
                          </small>
                        </div>
                      ) : null}
                    </div>
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </section>
  );
}
