import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

interface Round { user: string[]; agent: string[] }
interface EditorialPlan { _: string; pilot: Round; rounds: Round[] }

const root = process.cwd();
const plan = JSON.parse(fs.readFileSync(path.join(root, 'scripts/data/profiles-completion-batches.json'), 'utf8')) as EditorialPlan;

it('assigns each remaining country sheet exactly once: 124 to each person, with a joint pilot and seven paired rounds', () => {
  expect(plan._).toMatch(/no alimenta el generador/);
  expect(plan.rounds).toHaveLength(7);
  const assigned = { user: [...plan.pilot.user], agent: [...plan.pilot.agent] };
  for (const owner of ['user', 'agent'] as const) expect(plan.pilot[owner]).toHaveLength(5);
  for (const round of plan.rounds) {
    for (const owner of ['user', 'agent'] as const) {
      expect(round[owner]).toHaveLength(17);
      assigned[owner].push(...round[owner]);
    }
  }
  const all = [...assigned.user, ...assigned.agent];
  expect(assigned.user).toHaveLength(124);
  expect(assigned.agent).toHaveLength(124);
  expect(all.every((id) => /^[A-Z]{2}$/.test(id))).toBe(true);
  expect(new Set(all).size).toBe(248);
  expect(all).not.toContain('BR'); // Brazil already has its own complete hand-written sheet.
  const sheets = fs.readdirSync(path.join(root, 'public/data/profiles')).filter((file) => /^[A-Z]{2}\.json$/.test(file)).map((file) => file.slice(0, -5));
  expect([...all].sort()).toEqual(sheets.filter((id) => id !== 'BR').sort());
});

it('keeps the human-readable round lists in step with the machine-readable assignments', () => {
  const guide = fs.readFileSync(path.join(root, 'scripts/data/profiles-completion-plan.md'), 'utf8');
  const sections = guide.split(/\n### (?:P0|T[1-7]) · /).slice(1);
  expect(sections).toHaveLength(8);
  const codes = (section: string, person: string) => {
    const line = section.split('\n').find((row) => row.startsWith(`- **${person} (`)) ?? '';
    return [...line.matchAll(/`([A-Z]{2})`/g)].map((match) => match[1]);
  };
  for (const [index, round] of [plan.pilot, ...plan.rounds].entries()) {
    expect(codes(sections[index], 'Tú')).toEqual(round.user);
    expect(codes(sections[index], 'Yo')).toEqual(round.agent);
  }
});
