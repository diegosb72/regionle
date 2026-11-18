/** Setting a goal with a date from the map that is chosen: what is to be known of it, and by when. */
import { ArrowRight, Check, Target } from 'lucide-react';
import { useState } from 'react';
import { answersItself } from '../games/quiz';
import { deckFor } from '../lib/decks';
import { GOAL_SKILL_NAME } from '../lib/goalNames';
import { GOALS_MAX, GOAL_IDS_MAX, addDays, goalSkills, isDay, newGoalId, type Goal, type GoalSkill } from '../lib/goals';
import { L, fmtDay, fmtWeekday } from '../lib/i18n';
import { go } from '../lib/router';
import { useStore, type GameConfig } from '../lib/store';
import { nf, today } from '../lib/text';
import type { Deck, Mode, Section } from '../lib/types';
import { Seg } from './ui';

/** The skill a game practises, where it is one a goal can be about. */
const SKILL_OF: Partial<Record<Mode, GoalSkill>> = { pin: 'loc', puzzle: 'loc', blind: 'loc', identify: 'name', outline: 'name', nameall: 'name', capital: 'cap', flag: 'flag' };

/** The pieces of a map that can be asked about for a skill: a capital named after its place is not. */
export function goalIds(deck: Deck, skill: GoalSkill, only?: readonly string[]): string[] {
  const keep = only ? new Set(only) : null;
  return deck.items.filter((it) => (!keep || keep.has(it.id)) && (skill !== 'cap' || (!!it.capital?.length && !answersItself(it, true))) && (skill !== 'flag' || !!it.country.fl)).map((it) => it.id);
}

export function GoalBar({ section, mode, config, disabled }: { section: Section; mode: Mode; /** The map chosen now, as a game: null when there is none to play. */ config: Omit<GameConfig, 'nonce'> | null; disabled?: boolean }) {
  const saveGoal = useStore((s) => s.saveGoal);
  const count = useStore((s) => s.goals.length);
  const skills = goalSkills(section);
  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState<GoalSkill>(() => (SKILL_OF[mode] && skills.includes(SKILL_OF[mode]!) ? SKILL_OF[mode]! : 'loc'));
  const tomorrow = addDays(today(), 1);
  const [date, setDate] = useState(() => addDays(today(), 7));
  const [state, setState] = useState<'idle' | 'busy' | 'failed'>('idle');
  const [problem, setProblem] = useState<string | null>(null);
  const [made, setMade] = useState<Goal | null>(null);
  if (!skills.length) return null;

  const valid = isDay(date) && date >= tomorrow;
  const submit = async () => {
    if (!config || !valid || state === 'busy') return;
    setState('busy');
    setProblem(null);
    try {
      const deck = await deckFor({ ...config, nonce: 0 });
      const ids = goalIds(deck, skill, config.list ? config.only : undefined);
      if (ids.length < 2) {
        setProblem(skill === 'cap' ? L('En ese mapa no hay capitales que preguntar.', 'There are no capitals to ask about on that map.') : L('En ese mapa no hay nada que preguntar.', 'There is nothing to ask about on that map.'));
        setState('idle');
        return;
      }
      if (ids.length > GOAL_IDS_MAX) {
        setProblem(L(`Son ${nf(ids.length)} piezas: un objetivo admite hasta ${nf(GOAL_IDS_MAX)}. Elige un mapa más pequeño.`, `That is ${nf(ids.length)} pieces: a goal takes up to ${nf(GOAL_IDS_MAX)}. Choose a smaller map.`));
        setState('idle');
        return;
      }
      const goal: Goal = {
        id: newGoalId(),
        name: config.list ?? deck.title,
        section,
        countries: config.countries,
        levels: config.levels,
        ...(section === 'cities' ? { cityPick: config.opts.cityPick, cityCount: config.opts.cityCount } : {}),
        ids,
        skill,
        date,
        made: Date.now(),
      };
      saveGoal(goal);
      setMade(goal);
      setState('idle');
      setOpen(false);
    } catch {
      setState('failed');
    }
  };

  return (
    <div className="goalbar">
      <div className="listbar">
        <span className="listbar-label">
          <Target size={15} aria-hidden="true" /> {L('Objetivo con fecha', 'Goal with a date')}
        </span>
        <button type="button" className="chip chip-add" onClick={() => setOpen((v) => !v)} aria-expanded={open} disabled={disabled || !config}>
          {L('Poner fecha', 'Set a date')}
        </button>
        {made ? (
          <span className="listbar-hint goalbar-made" role="status">
            <Check size={14} aria-hidden="true" /> {L(`Objetivo fijado para el ${fmtWeekday(made.date)}, ${fmtDay(made.date)}: ${nf(made.ids.length)} piezas.`, `Goal set for ${fmtWeekday(made.date)}, ${fmtDay(made.date)}: ${nf(made.ids.length)} pieces.`)}{' '}
            <button type="button" className="link" onClick={() => go('')}>
              {L('Verlo en la portada', 'See it on the first page')}
              <ArrowRight size={13} aria-hidden="true" />
            </button>
          </span>
        ) : (
          !open && <span className="listbar-hint">{L('¿examen a la vista? Cada día te diremos cuánto toca', 'an exam coming? Each day you will be told how much to do')}</span>
        )}
      </div>
      {open && (
        <form
          className="goal-form"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="goal-form-row">
            <span className="opt-label" id="goal-skill">
              {L('Qué quieres saber', 'What you want to know')}
            </span>
            <Seg<GoalSkill> small label={L('Qué quieres saber', 'What you want to know')} value={skill} onChange={setSkill} options={skills.map((k) => ({ value: k, label: GOAL_SKILL_NAME()[k] }))} />
          </div>
          <label className="field">
            <span>{L('Para cuándo', 'By when')}</span>
            <input type="date" value={date} min={tomorrow} max={addDays(tomorrow, 365)} onChange={(e) => setDate(e.target.value)} required />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={!valid || state === 'busy'}>
            {state === 'busy' ? L('Preparando…', 'Preparing…') : L('Fijar el objetivo', 'Set the goal')}
          </button>
          <p className="opt-hint" role="status">
            {problem ??
              (state === 'failed'
                ? L('No se ha podido cargar ese mapa. Prueba otra vez con conexión.', 'That map could not be loaded. Try again with a connection.')
                : count >= GOALS_MAX
                  ? L(`Ya tienes ${GOALS_MAX} objetivos: este ocupará el lugar del más antiguo.`, `You already have ${GOALS_MAX} goals: this one will take the place of the oldest.`)
                  : L('El mapa elegido ahora, repartido entre los días que quedan. En la portada verás cada día cuánto hay que aprender y cuánto repasar.', 'The map chosen now, shared out among the days that are left. The first page will show each day how much there is to learn and to review.'))}
          </p>
        </form>
      )}
    </div>
  );
}
