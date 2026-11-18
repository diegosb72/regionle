import { beforeEach, describe, expect, it } from 'vitest';
import { NOTES_MAX, NOTE_MAX, cleanNotes, dropNotes, tidyNote, withNote, type Notes } from './notes';
import { mergeSaved, useStore } from './store';

describe('a note about a piece', () => {
  it('is kept on one line, without spaces at its ends and no longer than allowed', () => {
    expect(tidyNote('  la de  la bota \n y la isla  ')).toBe('la de la bota y la isla');
    expect(tidyNote('   ')).toBe('');
    expect(tidyNote('x'.repeat(NOTE_MAX + 50))).toHaveLength(NOTE_MAX);
    // Cut at the limit, it does not end in a space.
    expect(tidyNote(`${'x'.repeat(NOTE_MAX - 1)} y más`)).toBe('x'.repeat(NOTE_MAX - 1));
  });

  it('is set, changed and taken away by its piece', () => {
    let notes: Notes = {};
    notes = withNote(notes, 'IT', ' La bota ')!;
    expect(notes).toEqual({ IT: 'La bota' });
    notes = withNote(notes, 'SI', 'La del mar, pequeña')!;
    notes = withNote(notes, 'IT', 'La bota que da una patada a Sicilia')!;
    expect(notes).toEqual({ IT: 'La bota que da una patada a Sicilia', SI: 'La del mar, pequeña' });
    // An empty one takes it away; taking away what is not there changes nothing.
    notes = withNote(notes, 'IT', '  ')!;
    expect(notes).toEqual({ SI: 'La del mar, pequeña' });
    expect(withNote(notes, 'FR', '')).toBe(notes);
    expect(withNote(notes, 'SI', 'La del mar,  pequeña ')).toBe(notes);
    expect(withNote(notes, '', 'nada')).toBe(notes);
  });

  it('has no room for a new one beyond the most that are kept, and still lets the old ones change', () => {
    const full: Notes = Object.fromEntries(Array.from({ length: NOTES_MAX }, (_, i) => [`id${i}`, 'x']));
    expect(withNote(full, 'one-more', 'y')).toBeNull();
    expect(withNote(full, 'id7', 'y')!.id7).toBe('y');
    expect(Object.keys(withNote(full, 'id7', '')!)).toHaveLength(NOTES_MAX - 1);
  });

  it('goes with its piece when the piece is no longer in the game', () => {
    const notes: Notes = { IT: 'La bota', SI: 'La del mar' };
    expect(dropNotes(notes, ['IT', 'XX'])).toEqual({ SI: 'La del mar' });
    expect(dropNotes(notes, ['XX'])).toBe(notes);
  });

  it('is read from storage only if it is a note', () => {
    expect(cleanNotes({ IT: ' La  bota ', SI: 7, FR: '', DE: null, ES: 'x'.repeat(NOTE_MAX + 9) })).toEqual({ IT: 'La bota', ES: 'x'.repeat(NOTE_MAX) });
    expect(cleanNotes(null)).toEqual({});
    expect(cleanNotes(['a'])).toEqual({});
    expect(cleanNotes('a')).toEqual({});
    const many = Object.fromEntries(Array.from({ length: NOTES_MAX + 20 }, (_, i) => [`id${i}`, 'x']));
    expect(Object.keys(cleanNotes(many))).toHaveLength(NOTES_MAX);
  });
});

describe('the notes of the player', () => {
  beforeEach(() => useStore.setState({ notes: {}, stats: {}, where: {}, mix: {}, goals: [] }));

  it('are written by the piece, and say whether there was room', () => {
    expect(useStore.getState().setNote('IT', ' La bota ')).toBe(true);
    expect(useStore.getState().notes).toEqual({ IT: 'La bota' });
    expect(useStore.getState().setNote('IT', '')).toBe(true);
    expect(useStore.getState().notes).toEqual({});
    useStore.setState({ notes: Object.fromEntries(Array.from({ length: NOTES_MAX }, (_, i) => [`id${i}`, 'x'])) });
    expect(useStore.getState().setNote('IT', 'La bota')).toBe(false);
    expect(useStore.getState().notes.IT).toBeUndefined();
  });

  it('stay when the progress is cleared: they are the player’s own writing, like the lists', () => {
    useStore.getState().setNote('IT', 'La bota');
    useStore.getState().record('loc', 'IT', 'ok');
    useStore.getState().resetProgress();
    expect(useStore.getState().stats).toEqual({});
    expect(useStore.getState().notes).toEqual({ IT: 'La bota' });
  });

  it('go when their piece is dropped from the game', () => {
    useStore.getState().setNote('IT', 'La bota');
    useStore.getState().setNote('SI', 'La del mar');
    useStore.getState().drop(['IT']);
    expect(useStore.getState().notes).toEqual({ SI: 'La del mar' });
  });

  it('come with a backup, and stay as they are when the backup is from before there were notes', () => {
    useStore.getState().setNote('IT', 'La bota');
    expect(useStore.getState().importData({ stats: {}, sessions: [] })).toBe(true);
    expect(useStore.getState().notes).toEqual({ IT: 'La bota' });
    expect(useStore.getState().importData({ stats: {}, sessions: [], notes: { SI: ' La del  mar ', XX: 3 } })).toBe(true);
    expect(useStore.getState().notes).toEqual({ SI: 'La del mar' });
  });

  it('are cleaned when they are read from storage', () => {
    const merged = mergeSaved({ notes: { IT: ' La  bota ', SI: 7 } }, useStore.getState());
    expect(merged.notes).toEqual({ IT: 'La bota' });
    expect(mergeSaved({}, useStore.getState()).notes).toEqual({});
  });
});
