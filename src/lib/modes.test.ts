import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { GROUP_NAME, MODES, MODE_GROUPS, MODE_NAME, SECTION_IDS, cardAskName, modeNameIn } from './modes';
import { TYPICAL_S } from './pace';
import { FIGURE_MODES, FORMAT_MODES, LENGTH_MODES, NOT_GAMES, ROUND_MODES, asksByFlag, turnsOutlines } from './rules';
import type { Mode } from './types';

beforeEach(() => setLang('es'));

const ids = (section: (typeof SECTION_IDS)[number]): Mode[] => MODES[section].map((m) => m.id);

describe('the games of each section', () => {
  it('are these, in the order of the menu', () => {
    expect(ids('regions')).toEqual(['explore', 'learn', 'cards', 'print', 'pin', 'listen', 'blind', 'hotcold', 'identify', 'nameall', 'puzzle', 'group', 'mix', 'outline', 'regionle', 'neighbours', 'border', 'chain', 'travel', 'parent', 'compass', 'bearing', 'coords', 'capital', 'whoami', 'hilo', 'rank', 'exact', 'which', 'topten']);
    expect(ids('countries')).toEqual(['explore', 'learn', 'cards', 'print', 'pin', 'listen', 'blind', 'hotcold', 'identify', 'nameall', 'puzzle', 'group', 'mix', 'outline', 'regionle', 'neighbours', 'border', 'chain', 'travel', 'compass', 'bearing', 'coords', 'capital', 'flag', 'whoami']);
    expect(ids('cities')).toEqual(['explore', 'learn', 'cards', 'print', 'pin', 'listen', 'blind', 'hotcold', 'identify', 'nameall', 'group', 'mix', 'parent', 'compass', 'bearing', 'coords', 'whoami', 'hilo', 'rank', 'exact', 'which', 'topten']);
    expect(ids('physical')).toEqual(['explore', 'learn', 'cards', 'print', 'pin', 'listen', 'blind', 'hotcold', 'identify', 'nameall', 'mix', 'hilo', 'rank', 'exact', 'which', 'topten']);
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
    expect(MODE_NAME.cards).toBe('Tarjetas');
    expect(MODE_NAME.mix).toBe('Popurrí');
    expect(MODE_NAME.listen).toBe('Oye y señala');
    // What the cards ask is said as the question it is, the same in the setup and on the first page.
    expect((['name', 'where', 'capital', 'flag'] as const).map(cardAskName)).toEqual(['¿Cómo se llama?', '¿Dónde está?', '¿Su capital?', '¿Qué bandera es?']);
    setLang('en');
    expect((['name', 'where', 'capital', 'flag'] as const).map(cardAskName)).toEqual(['What is it called?', 'Where is it?', 'Its capital?', 'Which flag is it?']);
    expect(MODE_NAME.print).toBe('Blank map');
    expect(MODE_NAME.cards).toBe('Flashcards');
    expect(MODE_NAME.mix).toBe('Medley');
    expect(MODE_NAME.listen).toBe('Listen and pin');
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

  it('place the three new ones: cards to study with, the medley and the game by ear on the map', () => {
    for (const section of ['regions', 'countries', 'cities', 'physical'] as const) {
      const by = new Map(MODES[section].map((m) => [m.id, m]));
      expect(by.get('cards')!.group, section).toBe('study');
      expect(by.get('mix')!.group, section).toBe('map');
      expect(by.get('listen')!.group, section).toBe('map');
      // By ear comes right after "pin it", which it is a way of playing.
      expect(ids(section).indexOf('listen'), section).toBe(ids(section).indexOf('pin') + 1);
    }
    // The section of figures has no map to play them on.
    for (const id of ['cards', 'mix', 'listen'] as Mode[]) expect(ids('pops'), id).not.toContain(id);
    // The medley is said for what each section can ask: a flag only of a country, a shape only where there are shapes.
    const said = (section: (typeof SECTION_IDS)[number]) => MODES[section].find((m) => m.id === 'mix')!.desc;
    expect(said('countries')).toContain('bandera');
    expect(said('regions')).toContain('silueta');
    expect(said('regions')).not.toContain('bandera');
    expect(said('cities')).not.toContain('silueta');
    expect(said('physical')).toBe(said('cities'));
    // The medley and the game by ear can be played against the clock, with lives or as an exam; cards cannot: nobody marks them.
    expect(FORMAT_MODES).toContain('mix');
    expect(FORMAT_MODES).toContain('listen');
    expect(FORMAT_MODES).not.toContain('cards');
    for (const id of ['cards', 'mix', 'listen'] as Mode[]) expect(LENGTH_MODES, id).toContain(id);
  });

  it('say where the hard looks apply: outlines where one is drawn, flags where a country is told by its flag', () => {
    // An outline is drawn by the two games of outlines, and by the medley where pieces have a shape.
    for (const section of SECTION_IDS) {
      expect(turnsOutlines(section, 'outline'), section).toBe(true);
      expect(turnsOutlines(section, 'regionle'), section).toBe(true);
      expect(turnsOutlines(section, 'mix'), section).toBe(section === 'regions' || section === 'countries');
      for (const id of ['pin', 'puzzle', 'identify', 'flag', 'cards', 'listen'] as Mode[]) expect(turnsOutlines(section, id), `${section} ${id}`).toBe(false);
    }
    // A flag is asked about only of a country.
    expect(asksByFlag('countries', 'flag')).toBe(true);
    expect(asksByFlag('countries', 'mix')).toBe(true);
    for (const section of ['regions', 'cities', 'physical', 'pops'] as const) for (const id of ['flag', 'mix', 'pin', 'cards'] as Mode[]) expect(asksByFlag(section, id, { pinBy: 'flag', cardAsk: 'flag' }), `${section} ${id}`).toBe(false);
    // "Pin it" and the cards show one when they are set to ask by it, and not otherwise.
    expect(asksByFlag('countries', 'pin')).toBe(false);
    expect(asksByFlag('countries', 'pin', { pinBy: 'capital' })).toBe(false);
    expect(asksByFlag('countries', 'pin', { pinBy: 'flag' })).toBe(true);
    expect(asksByFlag('countries', 'cards', { cardAsk: 'where' })).toBe(false);
    expect(asksByFlag('countries', 'cards', { cardAsk: 'flag' })).toBe(true);
    // Each setting is its own game's: what the cards ask says nothing about "pin it".
    expect(asksByFlag('countries', 'pin', { cardAsk: 'flag' })).toBe(false);
    expect(asksByFlag('countries', 'cards', { pinBy: 'flag' })).toBe(false);
    // By ear there is a name to hear, and nothing to look at.
    expect(asksByFlag('countries', 'listen', { pinBy: 'flag', cardAsk: 'flag' })).toBe(false);
    expect(asksByFlag('countries', 'identify', { pinBy: 'flag', cardAsk: 'flag' })).toBe(false);
  });
});
