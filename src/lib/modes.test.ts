import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { GROUP_NAME, MODES, MODE_GROUPS, MODE_NAME, SECTION_IDS, modeNameIn } from './modes';
import { TYPICAL_S } from './pace';
import { FIGURE_MODES, FORMAT_MODES, LENGTH_MODES, NOT_GAMES, ROUND_MODES } from './rules';
import type { Mode } from './types';

beforeEach(() => setLang('es'));

const ids = (section: (typeof SECTION_IDS)[number]): Mode[] => MODES[section].map((m) => m.id);

describe('the games of each section', () => {
  it('are these, in the order of the menu', () => {
    expect(ids('regions')).toEqual(['explore', 'learn', 'print', 'pin', 'identify', 'nameall', 'puzzle', 'outline', 'regionle', 'neighbours', 'travel', 'parent', 'compass', 'capital', 'hilo', 'rank', 'exact', 'which', 'topten']);
    expect(ids('countries')).toEqual(['explore', 'learn', 'print', 'pin', 'identify', 'nameall', 'puzzle', 'outline', 'regionle', 'neighbours', 'travel', 'compass', 'capital', 'flag']);
    expect(ids('cities')).toEqual(['explore', 'learn', 'print', 'pin', 'blind', 'identify', 'nameall', 'parent', 'compass', 'hilo', 'rank', 'exact', 'which', 'topten']);
    expect(ids('physical')).toEqual(['explore', 'learn', 'print', 'pin', 'identify', 'nameall', 'hilo', 'rank', 'exact', 'which', 'topten']);
    expect(ids('pops')).toEqual(['hilo', 'rank', 'exact', 'which', 'topten', 'truefalse']);
  });

  it('appear once each, with a name, a line about it, an icon and a level', () => {
    for (const section of SECTION_IDS) {
      const list = MODES[section];
      expect(new Set(list.map((m) => m.id)).size, section).toBe(list.length);
      for (const m of list) {
        expect(m.name.length, `${section}/${m.id}`).toBeGreaterThan(2);
        expect(m.desc.length, `${section}/${m.id}`).toBeGreaterThan(20);
        expect(m.icon, `${section}/${m.id}`).toBeTruthy();
        // What is not a game has no difficulty to speak of.
        expect(NOT_GAMES.includes(m.id) ? [0] : [1, 2, 3], `${section}/${m.id}`).toContain(m.level);
        expect(MODE_GROUPS, `${section}/${m.id}`).toContain(m.group);
      }
    }
  });

  it('are named in both languages, and differently', () => {
    for (const section of SECTION_IDS) {
      const es = MODES[section].map((m) => [m.name, m.desc]);
      setLang('en');
      const en = MODES[section].map((m) => [m.name, m.desc]);
      setLang('es');
      es.forEach(([name, desc], i) => {
        expect(en[i][1], `${section}: ${name}`).not.toBe(desc);
        expect(en[i][1].length, `${section}: ${name}`).toBeGreaterThan(20);
      });
    }
  });

  it('come under headings that keep each kind together', () => {
    for (const section of SECTION_IDS) {
      // The modes of a heading are in a row in the list: the menu takes them as they come.
      const groups = MODES[section].map((m) => m.group);
      const firstSeen = groups.filter((g, i) => groups.indexOf(g) === i);
      expect(groups.join(), section).toBe(firstSeen.flatMap((g) => groups.filter((x) => x === g)).join());
    }
    expect(MODE_GROUPS.map((g) => GROUP_NAME[g])).toEqual(['Para estudiar', 'En el mapa', 'Por la forma', 'Vecinos y posición', 'Datos', 'Cifras']);
    setLang('en');
    expect(GROUP_NAME.figures).toBe('Figures');
  });

  it('put every figure game under "Cifras" and nothing else there', () => {
    for (const section of SECTION_IDS) {
      for (const m of MODES[section]) expect(m.group === 'figures', `${section}/${m.id}`).toBe(FIGURE_MODES.includes(m.id));
    }
  });
});

describe('what a game is called', () => {
  it('follows the section where the same game asks for a different thing', () => {
    expect(modeNameIn('regions', 'which')).toBe('¿Qué región?');
    expect(modeNameIn('cities', 'which')).toBe('¿Qué ciudad?');
    expect(modeNameIn('physical', 'which')).toBe('¿Cuál es?');
    expect(modeNameIn('pops', 'which')).toBe('¿Qué país?');
  });

  it('is the name of the catalogue for a game the section does not have', () => {
    expect(modeNameIn('physical', 'flag')).toBe(MODE_NAME.flag);
    expect(modeNameIn('pops', 'edit')).toBe(MODE_NAME.edit);
  });

  it('names the new ones', () => {
    expect(MODE_NAME.compass).toBe('Norte–sur');
    expect(MODE_NAME.parent).toBe('¿A qué pertenece?');
    expect(MODE_NAME.truefalse).toBe('Verdadero o falso');
    expect(MODE_NAME.topten).toBe('Los diez primeros');
    expect(MODE_NAME.print).toBe('Mapa mudo');
    setLang('en');
    expect(MODE_NAME.print).toBe('Blank map');
    expect(MODE_NAME.compass).toBe('North–south');
    expect(MODE_NAME.parent).toBe('Where does it belong?');
    expect(MODE_NAME.truefalse).toBe('True or false');
    expect(MODE_NAME.topten).toBe('The top ten');
  });
});

describe('the rules the menus go by', () => {
  const every = new Set(SECTION_IDS.flatMap((s) => ids(s)));

  it('speak only of games that exist', () => {
    for (const list of [FORMAT_MODES, LENGTH_MODES, FIGURE_MODES, ROUND_MODES]) for (const id of list) expect(every.has(id), id).toBe(true);
    for (const id of Object.keys(TYPICAL_S)) expect(every.has(id as Mode), id).toBe(true);
  });

  it('let the number of questions be chosen in every game of rounds, and in true or false', () => {
    for (const id of [...ROUND_MODES, 'truefalse', 'parent'] as Mode[]) expect(LENGTH_MODES, id).toContain(id);
    // Lists typed from memory have the length of the list.
    for (const id of ['nameall', 'topten', 'hilo'] as Mode[]) expect(LENGTH_MODES, id).not.toContain(id);
  });

  it('keep the sheet to print out of everything a game has', () => {
    // Where the map is drawn there is a sheet of it; a section of figures alone has none.
    for (const section of SECTION_IDS) expect(ids(section).includes('print'), section).toBe(section !== 'pops');
    for (const section of SECTION_IDS) for (const m of MODES[section]) if (m.id === 'print') expect(m.group, section).toBe('study');
    for (const list of [FORMAT_MODES, LENGTH_MODES, FIGURE_MODES, ROUND_MODES]) expect(list, 'print').not.toContain('print');
    expect(TYPICAL_S.print).toBeUndefined();
    expect(NOT_GAMES).toEqual(['print', 'edit']);
  });

  it('give a typical pace to every game with a number of questions', () => {
    for (const id of LENGTH_MODES) expect(TYPICAL_S[id], id).toBeGreaterThan(0);
  });
});
