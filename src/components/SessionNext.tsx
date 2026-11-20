/**
 * The session of the day (lib/dayPlan.ts) inside a game: where a game that was one of its steps ends, the
 * step is done and the next one is a click away. The card of the first page is `DayCard`.
 */
import { ArrowRight, Check } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { planOf, stepConfig, withStep, type PlanStep, type Step } from '../lib/dayPlan';
import { L } from '../lib/i18n';
import { useReviewPrefs, useStore } from '../lib/store';
import { today } from '../lib/text';

/**
 * The steps of today as things stand, worked out again whenever an answer or the pace of the review
 * changes. With `doing`, that step counts as done: it is, where its game ends, before it is written down.
 */
export function usePlan(doing?: Step): PlanStep[] {
  const stats = useStore((s) => s.stats);
  const where = useStore((s) => s.where);
  const recent = useStore((s) => s.recent);
  const kept = useStore((s) => s.dayPlan);
  const prefs = useReviewPrefs();
  return useMemo(() => {
    const day = today();
    return planOf(stats, where, recent, doing ? withStep(kept, day, doing) : kept, day, Date.now());
    // The pace says what is due: worked out again when it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats, where, recent, kept, doing, prefs]);
}

/** What a step is, as its name in a list. */
export const stepName = (step: Step): string => (step === 'review' ? L('Repasar lo que toca', 'Review what is due') : step === 'hard' ? L('Lo que más fallas', 'What you miss most') : L('Una lección nueva', 'A new lesson'));
/** The same in the middle of a sentence. */
export const stepSaid = (step: Step): string => (step === 'review' ? L('lo que toca repasar', 'what is due for review') : step === 'hard' ? L('lo que más fallas', 'what you miss most') : L('una lección nueva', 'a new lesson'));

/**
 * It is here, and not when the game is written down, that a step is done: a lesson ends on its summary,
 * not on the placement test that may come before it.
 */
export function SessionNext({ step }: { step: Step }) {
  const doStep = useStore((s) => s.doStep);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  const go = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    doStep(step);
  }, [doStep, step]);
  // The next step is what Enter does, whatever else the end of the game offers.
  useEffect(() => go.current?.focus(), []);
  const plan = usePlan(step);
  const next = plan.find((s) => !s.done);
  const done = plan.length - plan.filter((s) => !s.done).length;
  const title = L('Sesión de hoy', "Today's session");
  return (
    <div className="review-next day-next" role="status">
      {next ? (
        <>
          <p>
            <b>{title}:</b>{' '}
            {L(`${done === 1 ? 'hecho 1 paso' : `hechos ${done} pasos`} de ${plan.length}. Ahora, ${stepSaid(next.step)}.`, `${done} of ${plan.length} steps done. Now, ${stepSaid(next.step)}.`)}
          </p>
          <button
            ref={go}
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const cfg = stepConfig(next, opts);
              if (cfg) start(cfg);
            }}
          >
            {L('Siguiente paso', 'Next step')}
            <ArrowRight size={16} aria-hidden="true" />
          </button>
        </>
      ) : (
        <p>
          <Check size={16} aria-hidden="true" /> <b>{L('Sesión de hoy completada.', "Today's session is done.")}</b> {L('Mañana habrá otra.', 'There will be another one tomorrow.')}
        </p>
      )}
    </div>
  );
}
