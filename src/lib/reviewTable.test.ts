import { describe, expect, it } from 'vitest';
import type { Named } from './answerNames';
import { toCsv } from './csv';
import { allGroups } from './review';
import { reviewTable, type TableText } from './reviewTable';
import type { Stat } from './store';

const DAY = 86_400_000;
const NOW = new Date(2026, 10, 17, 12, 0, 0).getTime();

const TEXT: TableText = {
  header: ['Nombre', 'Capital', 'Mapa', 'Qué', 'Estado', 'Veces', 'A la primera', 'Racha', 'Última vez', 'Próximo repaso', 'Id'],
  place: (g) => (g.section === 'regions' ? `${g.country} ${g.level}` : g.section),
  skill: (s) => ({ loc: 'Situar', name: 'Nombrar', cap: 'Capitales', flag: 'Banderas', nb: 'Vecinos' })[s],
  grade: (g) => g,
};

describe('the review as a table', () => {
  const stats: Record<string, Stat> = {
    // Right twice running, two days ago: known, and back tomorrow, three days after.
    'loc:ES-ZA': [4, 2, 2, NOW - 2 * DAY],
    // Missed yesterday: due since ten minutes after.
    'loc:ES-M': [1, 0, 0, NOW - DAY],
    'cap:ES-AS': [2, 1, 1, NOW - 2 * DAY],
    'flag:FR': [3, 3, 3, NOW - 10 * DAY],
  };
  const where = { 'ES-ZA': 'r|ES|g2', 'ES-M': 'r|ES|g2', 'ES-AS': 'r|ES|g1', FR: 'c' };
  const groups = allGroups(stats, where);
  const names = new Map<string, Map<string, Named>>([
    ['regions:loc:ES:g2', new Map([['ES-ZA', { name: 'Zamora', capital: 'Zamora' }], ['ES-M', { name: 'Madrid' }]])],
    ['regions:cap:ES:g1', new Map([['ES-AS', { name: 'Asturias', capital: 'Oviedo' }]])],
  ]);
  const table = reviewTable(groups, stats, names, TEXT, NOW);

  it('has a row for each answer under the header', () => {
    expect(table[0]).toEqual(TEXT.header);
    expect(table).toHaveLength(1 + 4);
    expect(table.every((row) => row.length === TEXT.header.length)).toBe(true);
  });

  it('says what each one is called, on which map, how well it is known and when it comes back', () => {
    const row = (id: string) => table.find((r) => r[10] === id);
    expect(row('ES-ZA')).toEqual(['Zamora', '', 'ES g2', 'Situar', 'known', 4, 2, 2, '2026-11-15', '2026-11-18', 'ES-ZA']);
    expect(row('ES-M')).toEqual(['Madrid', '', 'ES g2', 'Situar', 'learning', 1, 0, 0, '2026-11-16', '2026-11-16', 'ES-M']);
  });

  it('gives the capital only where the capital is what was asked', () => {
    expect(table.find((r) => r[10] === 'ES-AS')!.slice(0, 4)).toEqual(['Asturias', 'Oviedo', 'ES g1', 'Capitales']);
    expect(table.find((r) => r[10] === 'ES-ZA')![1]).toBe('');
  });

  it('puts the id where the map could not be read', () => {
    expect(table.find((r) => r[10] === 'FR')!.slice(0, 5)).toEqual(['FR', '', 'countries', 'Banderas', 'due']);
  });

  it('is written as a file a spreadsheet opens', () => {
    const lines = toCsv(table, ';').split('\r\n');
    expect(lines[0]).toBe('\uFEFFNombre;Capital;Mapa;Qué;Estado;Veces;A la primera;Racha;Última vez;Próximo repaso;Id');
    expect(lines).toContain('Asturias;Oviedo;ES g1;Capitales;learning;2;1;1;2026-11-15;2026-11-16;ES-AS');
  });
});
