/** The spaced review as a table, one row for each answer: what a spreadsheet or Anki is given. */
import type { Named } from './answerNames';
import { csvDay } from './csv';
import { dueAt, gradeOf, type Grade, type ReviewGroup } from './review';
import type { Skill, Stat } from './store';

/** The words of the table, which are the caller's: they go in the language of the game. */
export interface TableText {
  /** Name, capital, map, skill, state, times asked, right first time, run, last time, next review, id. */
  header: readonly string[];
  place(group: ReviewGroup): string;
  skill(skill: Skill): string;
  grade(grade: Grade): string;
}

/**
 * A row for each answer of the groups, under the header. The name is the one read from the map; where the
 * map could not be read, the id stands for it. The capital is given only where it is what was asked.
 */
export function reviewTable(groups: readonly ReviewGroup[], stats: Record<string, Stat>, names: ReadonlyMap<string, ReadonlyMap<string, Named>>, text: TableText, now: number): (string | number)[][] {
  const rows: (string | number)[][] = [[...text.header]];
  for (const g of groups) {
    const place = text.place(g);
    const skill = text.skill(g.skill);
    const known = names.get(g.key);
    for (const id of g.ids) {
      const stat = stats[`${g.skill}:${id}`];
      if (!stat) continue;
      const named = known?.get(id);
      rows.push([named?.name ?? id, g.skill === 'cap' ? (named?.capital ?? '') : '', place, skill, text.grade(gradeOf(stat, now)), stat[0], stat[1], stat[2], csvDay(stat[3]), csvDay(dueAt(stat)), id]);
    }
  }
  return rows;
}
