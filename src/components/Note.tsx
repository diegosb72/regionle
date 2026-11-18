/** The player's own note about a piece: read wherever the piece is shown, and written there too. */
import { NotebookPen, Pencil } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { L } from '../lib/i18n';
import { NOTE_MAX, tidyNote } from '../lib/notes';
import { useStore } from '../lib/store';
import './note.css';

const PLACEHOLDER = () => L('Un truco para acordarte: a qué se parece, qué tiene al lado…', 'A trick to remember it by: what it looks like, what is next to it…');
const NO_ROOM = () => L('No caben más apuntes: borra alguno para escribir este.', 'There is no room for more notes: delete one to write this one.');

/** What is typed in a note stays in it: the keys of the game (Enter for the next question, the numbers) are not for it. */
const keepKeys = (e: KeyboardEvent) => e.stopPropagation();

/**
 * `open` keeps the box to write in always there: the card of a piece in Explore, where there is time. It
 * is saved when the box is left. Without it the note is a line, with a button to write it or change it:
 * after an answer, in a lesson, on the back of a flashcard.
 */
export function PieceNote({ id, open = false }: { id: string; open?: boolean }) {
  const note = useStore((s) => s.notes[id] ?? '');
  const setNote = useStore((s) => s.setNote);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const [full, setFull] = useState(false);
  /** The edit button gets the focus back once the note is written, and only then. */
  const [back, setBack] = useState(false);
  const field = useId();
  // What is being written, for the moment the card is put away without leaving the box first.
  const latest = useRef({ id, draft, note });
  latest.current = { id, draft, note };

  const save = (text: string): boolean => {
    const ok = setNote(id, text);
    setFull(!ok);
    return ok;
  };

  useEffect(() => {
    if (!open) return;
    return () => {
      const { id: at, draft: text, note: kept } = latest.current;
      if (tidyNote(text) !== kept) useStore.getState().setNote(at, text);
    };
  }, [open]);

  if (open) {
    return (
      <div className="note-open" onKeyDown={keepKeys}>
        <label className="label" htmlFor={field}>
          {L('Tus apuntes', 'Your notes')}
        </label>
        <textarea
          id={field}
          rows={2}
          maxLength={NOTE_MAX}
          value={draft}
          placeholder={PLACEHOLDER()}
          onChange={(e) => {
            setDraft(e.target.value);
            setFull(false);
          }}
          onBlur={() => {
            if (save(draft)) setDraft(tidyNote(draft));
          }}
        />
        {full ? (
          <p className="note-hint" role="alert">
            {NO_ROOM()}
          </p>
        ) : (
          <p className="note-hint">{L('Solo los ves tú: se guardan en este navegador y salen cuando te pregunten por esta pieza.', 'Only you see them: they are kept in this browser and show when this piece is asked about.')}</p>
        )}
      </div>
    );
  }

  const begin = () => {
    setDraft(note);
    setFull(false);
    setEditing(true);
  };
  const done = (e?: FormEvent) => {
    e?.preventDefault();
    if (!save(draft)) return;
    setEditing(false);
    setBack(true);
  };
  const cancel = () => {
    setEditing(false);
    setFull(false);
    setBack(true);
  };

  if (editing) {
    return (
      <form
        className="note-form"
        onSubmit={done}
        onKeyDown={(e) => {
          keepKeys(e);
          // A note is one line: Enter writes it down, Escape leaves it as it was.
          if (e.key === 'Enter' && !e.shiftKey) done(e);
          else if (e.key === 'Escape') cancel();
        }}
      >
        <label className="sr-only" htmlFor={field}>
          {L('Tu apunte', 'Your note')}
        </label>
        <textarea id={field} rows={2} maxLength={NOTE_MAX} value={draft} placeholder={PLACEHOLDER()} onChange={(e) => setDraft(e.target.value)} autoFocus />
        <div className="note-actions">
          <button type="submit" className="btn btn-sm btn-primary">
            {L('Guardar', 'Save')}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={cancel}>
            {L('Cancelar', 'Cancel')}
          </button>
          {full && <span role="alert">{NO_ROOM()}</span>}
        </div>
      </form>
    );
  }

  if (!note) {
    return (
      <button type="button" className="note-add" onClick={begin} autoFocus={back}>
        <NotebookPen size={15} aria-hidden="true" /> {L('Añadir un apunte', 'Add a note')}
      </button>
    );
  }
  return (
    <p className="note">
      <NotebookPen size={15} aria-hidden="true" />
      <span>
        <b>{L('Tu apunte', 'Your note')}:</b> {note}
      </span>
      <button type="button" className="note-edit" onClick={begin} aria-label={L('Cambiar el apunte', 'Change the note')} title={L('Cambiar el apunte', 'Change the note')} autoFocus={back}>
        <Pencil size={14} aria-hidden="true" />
      </button>
    </p>
  );
}
