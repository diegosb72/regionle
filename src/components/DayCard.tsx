/**
 * The session of the day (lib/dayPlan.ts) on the first page: a strip over the review of the day with the
 * steps of today in order, ticked as they are done, and one button that starts the first one left.
 */
import { ArrowRight, Check, ListChecks } from 'lucide-react';
import { nextStep, stepConfig, type PlanStep } from '../lib/dayPlan';
import { describeMap } from '../lib/describe';
import { L } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { nf } from '../lib/text';
import type { World } from '../lib/world';
import { groupPlace } from './ReviewCard';
import { stepName, stepSaid, usePlan } from './SessionNext';
import './dayPlan.css';

/** How many steps, in words: there are three at most. */
const count = (n: number): string => [L('Ningún', 'No'), L('Un', 'One'), L('Dos', 'Two'), L('Tres', 'Three')][n] ?? String(n);

/** "primero A, luego B y, para acabar, C": the order of the steps, said. */
function orderSaid(plan: PlanStep[]): string {
  const [a, b, c] = plan.map((s) => stepSaid(s.step));
  if (c) return L(`Primero ${a}, luego ${b} y, para acabar, ${c}.`, `First ${a}, then ${b} and, to finish, ${c}.`);
  return b ? L(`Primero ${a} y luego ${b}.`, `First ${a} and then ${b}.`) : '';
}

/** The map a step is played on: "España · provincias · Señalar". */
function stepMap(s: PlanStep, world: World): string {
  if (s.group) return `${groupPlace(s.group, world).text} · ${MODE_NAME[s.group.mode]}`;
  if (s.map) return describeMap({ section: s.map.section, countries: s.map.countries, levels: s.map.levels, cityPick: s.map.o.cityPick, cityCount: s.map.o.cityCount }, world);
  return '';
}

/**
 * One step alone is what the review of the day, under it, already offers: a session is two things to do or
 * more. Once one of them has been done, it stays for the day whatever is left.
 */
export function DayCard({ world }: { world: World }) {
  const plan = usePlan();
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);
  if (plan.length < 2 && !plan.some((s) => s.done)) return null;
  const next = nextStep(plan);
  const left = plan.filter((s) => !s.done).length;
  const play = (s: PlanStep) => {
    const cfg = stepConfig(s, opts);
    if (!cfg) return;
    start(cfg);
    go('jugar');
  };
  const title = L('Sesión de hoy', "Today's session");
  const heading = !next
    ? L('Completada', 'Done')
    : left === plan.length
      ? L(`${count(left)} pasos para hoy`, `${count(left)} steps for today`)
      : L(left === 1 ? 'Te queda un paso' : `Te quedan ${count(left).toLowerCase()} pasos`, left === 1 ? 'One step to go' : `${count(left)} steps to go`);

  return (
    <section className={next ? 'day-plan' : 'day-plan day-over'} aria-label={title}>
      <div className="day-head">
        <p className="kicker">
          <ListChecks size={15} aria-hidden="true" /> {title}
        </p>
        <h2>
          {!next && <Check size={18} aria-hidden="true" />}
          {heading}
        </h2>
      </div>
      <ol className="day-steps">
        {plan.map((s, i) => {
          const map = stepMap(s, world);
          const said = `${L('Paso', 'Step')} ${i + 1}: ${stepName(s.step)}`;
          return (
            <li key={s.step}>
              {s.done ? (
                <span className="day-step done">
                  <i aria-hidden="true">
                    <Check size={14} />
                  </i>
                  <span>{stepName(s.step)}</span>
                  <span className="sr-only"> ({L('hecho', 'done')})</span>
                </span>
              ) : (
                <button type="button" className="day-step" onClick={() => play(s)} title={`${L('Hacer solo este paso', 'Do just this step')}: ${map}`} aria-label={`${said}${s.n ? `, ${nf(s.n)} ${L(s.n === 1 ? 'respuesta' : 'respuestas', s.n === 1 ? 'answer' : 'answers')}` : ''}. ${map}`}>
                  <i aria-hidden="true">{i + 1}</i>
                  <span aria-hidden="true">{stepName(s.step)}</span>
                  {s.n > 0 && <b aria-hidden="true">{nf(s.n)}</b>}
                </button>
              )}
            </li>
          );
        })}
      </ol>
      {next ? (
        <button type="button" className="btn btn-primary day-go" onClick={() => play(next)} title={orderSaid(plan) || undefined}>
          {left === plan.length ? L('Empezar la sesión', 'Start the session') : L('Seguir la sesión', 'Go on with the session')}
          <ArrowRight size={17} aria-hidden="true" />
        </button>
      ) : (
        <p className="day-note">{L('Mañana habrá otra.', 'There will be another one tomorrow.')}</p>
      )}
    </section>
  );
}
