import type { GoalSkill } from './goals';
import { L } from './i18n';

/** What a goal is about, as it is said next to its name and in the form that sets it. */
export const GOAL_SKILL_NAME = (): Record<GoalSkill, string> => ({
  loc: L('Situar en el mapa', 'Placing on the map'),
  name: L('Nombrar', 'Naming'),
  cap: L('Capitales', 'Capitals'),
  flag: L('Banderas', 'Flags'),
});
