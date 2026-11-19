/** Goals with a date, on the first page: how each one stands and what there is to do for it today. */
import { ArrowRight, CalendarDays, Check, Target, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { GOAL_SKILL_NAME } from '../lib/goalNames';
import { addDays, goalGame, goalState, isDay, nextStep, type Goal, type GoalState, type GoalStep } from '../lib/goals';
import { L, fmtDay, fmtWeekday } from '../lib/i18n';
import { reviewMax } from '../lib/review';
import { go } from '../lib/router';
import { useReviewPrefs, useStore } from '../lib/store';
import { cx, nf, today } from '../lib/text';

/** "Para el jueves, 26 de noviembre: quedan 8 días." */
function whenLine(goal: Goal, s: GoalState): string {
  const day = `${fmtWeekday(goal.date)}, ${fmtDay(goal.date)}`;
  if (s.phase === 'over') return L(`Era para el ${day}.`, `It was for ${day}.`);
  if (s.phase === 'today') return L('Es hoy.', 'It is today.');
  return L(`Para el ${day}: ${s.daysLeft === 1 ? 'es mañana' : `quedan ${s.daysLeft} días`}.`, `For ${day}: ${s.daysLeft === 1 ? 'that is tomorrow' : `${s.daysLeft} days to go`}.`);
}

/** What there is to do today, or how it ended. */
function planLine(s: GoalState): string {
  const due = s.pending.length;
  if (s.phase === 'over') return s.done ? L('Llegaste con todo sabido.', 'You got there knowing it all.') : L(`Llegaste a ${nf(s.known)} de ${nf(s.total)}.`, `You got to ${nf(s.known)} of ${nf(s.total)}.`);
  if (s.phase === 'today') {
    if (!due && !s.fresh.length) return L('Todo repasado. Suerte.', 'All gone over. Good luck.');
    const unseen = s.fresh.length ? L(`${nf(s.fresh.length)} sin ver`, `${nf(s.fresh.length)} not seen yet`) : '';
    const again = due ? L(`${nf(due)} por repasar`, `${nf(due)} to go over`) : '';
    return `${L('Último repaso', 'Last look')}: ${[again, unseen].filter(Boolean).join(L(' y ', ' and '))}.`;
  }
  if (s.done && !due) return L('Ya te lo sabes todo. Lo que toque repasar irá saliendo aquí, para que llegue fresco.', 'You know it all. Whatever falls due will show here, so that it is fresh on the day.');
  const fresh = s.newLeft ? L(`${nf(s.newLeft)} por aprender`, `${nf(s.newLeft)} to learn`) : '';
  const again = due ? L(`${nf(due)} por repasar`, `${nf(due)} to review`) : '';
  if (fresh || again) return `${L('Hoy', 'Today')}: ${[fresh, again].filter(Boolean).join(L(' y ', ' and '))}.`;
  return `${L('Hecho por hoy.', 'Done for today.')}${s.perDay ? ` ${L(`Mañana, ${nf(s.perDay)} por aprender.`, `Tomorrow, ${nf(s.perDay)} to learn.`)}` : ''}`;
}

function GoalItem({ goal, now }: { goal: Goal; now: number }) {
  const stats = useStore((s) => s.stats);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  const removeGoal = useStore((s) => s.removeGoal);
  const setGoalDate = useStore((s) => s.setGoalDate);
  const prefs = useReviewPrefs();
  // What is due follows the pace of the reviews: worked out again when it changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const s = useMemo(() => goalState(goal, stats, now), [goal, stats, now, prefs]);
  const [confirm, setConfirm] = useState(false);
  const [dating, setDating] = useState(false);
  const [date, setDate] = useState(goal.date);
  const step = nextStep(s);
  const play = (which: GoalStep) => {
    start(goalGame(goal, s, opts, which));
    go('jugar');
  };
  const tomorrow = addDays(today(new Date(now)), 1);
  const line = L(`${nf(s.known)} de ${nf(s.total)}`, `${nf(s.known)} of ${nf(s.total)}`);
  const due = Math.min(s.pending.length, reviewMax());

  return (
    <li className={cx('goal', s.phase === 'over' && 'goal-over', s.done && 'goal-done')}>
      <div className="goal-main">
        <h3>
          {goal.name} <small>· {GOAL_SKILL_NAME()[goal.skill]}</small>
        </h3>
        <div className="goal-bar">
          <div className="bar" role="img" aria-label={L(`Te sabes ${line}`, `You know ${line}`)}>
            <i style={{ width: `${s.total ? (s.known / s.total) * 100 : 0}%` }} />
          </div>
          <b>{line}</b>
        </div>
        <p className="goal-plan">
          {s.done && <Check size={16} aria-hidden="true" />} <span>{whenLine(goal, s)}</span> <strong>{planLine(s)}</strong>
        </p>
      </div>
      <div className="goal-actions">
        {step === 'review' && (
          <button type="button" className="btn btn-primary" onClick={() => play('review')}>
            {L(due === 1 ? 'Repasar 1' : `Repasar ${nf(due)}`, `Review ${nf(due)}`)}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        {step === 'learn' && (
          <button type="button" className="btn btn-primary" onClick={() => play('learn')}>
            {s.seen ? L('Seguir aprendiendo', 'Keep learning') : L('Empezar', 'Start')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        )}
        {/* Nothing more is due today: whoever wants to can take from tomorrow. */}
        {!step && s.phase === 'ahead' && s.fresh.length > 0 && (
          <button type="button" className="btn" onClick={() => play('learn')}>
            {L('Adelantar', 'Get ahead')}
          </button>
        )}
        {s.phase !== 'over' && (
          <button type="button" className="btn" onClick={() => play('exam')} title={L('Todas las piezas, un intento por pregunta y nota al entregar', 'Every piece, one try per question and a mark when handed in')}>
            {L('Examen de prueba', 'Mock exam')}
          </button>
        )}
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDating((v) => !v)} aria-expanded={dating}>
          <CalendarDays size={15} aria-hidden="true" />
          {L('Cambiar la fecha', 'Change the date')}
        </button>
        <button type="button" className={cx('btn btn-sm btn-ghost', confirm && 'danger')} onClick={() => (confirm ? removeGoal(goal.id) : setConfirm(true))} onBlur={() => setConfirm(false)}>
          <Trash2 size={15} aria-hidden="true" />
          {confirm ? L('¿Seguro? Quitar', 'Sure? Remove') : L('Quitar', 'Remove')}
        </button>
      </div>
      {dating && (
        <form
          className="goal-date"
          onSubmit={(e) => {
            e.preventDefault();
            if (!isDay(date) || date < tomorrow) return;
            setGoalDate(goal.id, date);
            setDating(false);
          }}
        >
          <label className="field">
            <span>{L('Fecha nueva', 'New date')}</span>
            <input type="date" value={date} min={tomorrow} max={addDays(tomorrow, 365)} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn-sm" disabled={!isDay(date) || date < tomorrow}>
            {L('Guardar', 'Save')}
          </button>
        </form>
      )}
    </li>
  );
}

export function GoalCards() {
  const goals = useStore((s) => s.goals);
  const markGoals = useStore((s) => s.markGoals);
  // One moment for the whole card: what is due does not change while it is being looked at.
  const now = useMemo(() => Date.now(), [goals]);
  const day = today(new Date(now));
  // The share of a day is worked out from where the day began: noted the first time the goals are seen in it.
  useEffect(() => {
    if (goals.length) markGoals();
  }, [goals, markGoals]);
  if (!goals.length) return null;
  return (
    <section className="goals" aria-labelledby="goals-h">
      <p className="kicker" id="goals-h">
        <Target size={15} aria-hidden="true" /> {L(goals.length === 1 ? 'Objetivo con fecha' : 'Objetivos con fecha', goals.length === 1 ? 'Goal with a date' : 'Goals with a date')}
      </p>
      <ul>
        {/* The one that comes first, first; those whose day has passed, last. */}
        {[...goals]
          .sort((a, b) => Number(a.date < day) - Number(b.date < day) || (a.date < b.date ? -1 : a.date > b.date ? 1 : a.made - b.made))
          .map((g) => (
            <GoalItem key={g.id} goal={g} now={now} />
          ))}
      </ul>
    </section>
  );
}
