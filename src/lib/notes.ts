/**
 * The player's own notes: a line about a piece, written by whoever is learning it ("the one shaped like a
 * boot"). They are kept by the id of the piece and shown wherever the piece is: its card in Explore, a
 * lesson, the back of a flashcard and the verdict after an answer.
 */
export type Notes = Record<string, string>;

/** Characters of a note at most: a line to remember by, not an essay. */
export const NOTE_MAX = 240;
/** Notes kept at most. */
export const NOTES_MAX = 2000;

/** A note as it is kept: on one line, without spaces at its ends and no longer than allowed. */
export const tidyNote = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, NOTE_MAX).trim();

/**
 * The notes with that of `id` set to `text`; an empty text takes it away. Null when it would be a new note
 * and there is no room for one more.
 */
export function withNote(notes: Notes, id: string, text: string): Notes | null {
  if (!id) return notes;
  const note = tidyNote(text);
  if (!note) {
    if (!(id in notes)) return notes;
    const rest = { ...notes };
    delete rest[id];
    return rest;
  }
  if (notes[id] === note) return notes;
  if (!(id in notes) && Object.keys(notes).length >= NOTES_MAX) return null;
  return { ...notes, [id]: note };
}

/** The notes without those of some pieces: the ones that are no longer in the game. */
export function dropNotes(notes: Notes, ids: readonly string[]): Notes {
  if (!ids.some((id) => id in notes)) return notes;
  const rest = { ...notes };
  for (const id of ids) delete rest[id];
  return rest;
}

/** What is read from storage or from a backup, with anything that is not a note left out. */
export function cleanNotes(value: unknown): Notes {
  const out: Notes = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  let n = 0;
  for (const [id, text] of Object.entries(value as Record<string, unknown>)) {
    if (!id || typeof text !== 'string') continue;
    const note = tidyNote(text);
    if (!note) continue;
    out[id] = note;
    if (++n >= NOTES_MAX) break;
  }
  return out;
}
