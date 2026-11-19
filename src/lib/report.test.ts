import { afterEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { REPO, reportBody, reportFacts, reportTitle, reportUrl } from './report';

const LEON = { id: 'ES-LE', name: 'León', kind: 'unit' as const, type: 'provincia', country: { id: 'ES' } as never };
const SPAIN = { section: 'regions' as const, mode: 'capital' as const, countries: ['ES'], levels: { ES: 'p' } };

afterEach(() => setLang('es'));

describe('a report of a mistake', () => {
  it('opens an issue in the repository with the piece in its title', () => {
    const url = new URL(reportUrl({ item: LEON, game: SPAIN, version: '1.18.0' }));
    expect(url.origin + url.pathname).toBe(`${REPO}/issues/new`);
    expect(url.searchParams.get('title')).toBe('Error en los datos: León (ES-LE)');
    const body = url.searchParams.get('body')!;
    // Room to write first, and what the game knows under a rule.
    expect(body.startsWith('**Qué está mal**')).toBe(true);
    expect(body.split('\n---\n')[1].split('\n')).toEqual(['Pieza: León · `ES-LE` · provincia (ES)', 'Mapa: `regions` · ES · ES:p', 'Juego: `capital`', 'Versión: 1.18.0 · idioma: es']);
  });

  it('says what it knows and no more', () => {
    expect(reportFacts({ version: '1.18.0' })).toEqual(['Versión: 1.18.0 · idioma: es']);
    expect(reportTitle()).toBe('Error en el juego: ');
    expect(reportFacts({ item: { id: 'FR', name: 'Francia', kind: 'country', type: 'país', country: { id: 'FR' } as never }, version: '1.18.0' })[0]).toBe('Pieza: Francia · `FR` · país');
    // A river is said by what it is, not by "accidente".
    expect(reportFacts({ item: { id: 'r-ebro', name: 'Ebro', kind: 'feature', type: 'accidente', cat: 'river', country: { id: 'ES' } as never }, version: '1' })[0]).toBe('Pieza: Ebro · `r-ebro` · river (ES)');
    expect(reportBody({ version: '1.18.0' })).not.toContain('Pieza');
  });

  it('keeps the address short on a map of many countries', () => {
    const many = Array.from({ length: 190 }, (_, i) => `C${i}`);
    const levels = Object.fromEntries(many.map((id) => [id, 'g1']));
    const url = reportUrl({ item: LEON, game: { section: 'regions', mode: 'pin', countries: many, levels }, version: '1.18.0' });
    expect(url.length).toBeLessThan(1500);
    expect(decodeURIComponent(url)).toContain('C0 C1 C2 C3 C4 C5 C6 C7 C8 C9 C10 C11 … (190)');
  });

  it('is written in the language of the player, with the same ids', () => {
    setLang('en');
    const url = new URL(reportUrl({ item: { ...LEON, type: 'province' }, game: SPAIN, version: '1.18.0' }));
    expect(url.searchParams.get('title')).toBe('Mistake in the data: León (ES-LE)');
    expect(url.searchParams.get('body')).toContain('**What is wrong**');
    expect(url.searchParams.get('body')).toContain('Piece: León · `ES-LE` · province (ES)');
    expect(url.searchParams.get('body')).toContain('Version: 1.18.0 · language: en');
  });
});
