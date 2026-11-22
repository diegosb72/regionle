/**
 * Where a map and a game are set as homework (lib/task.ts): what is set, in words, a title to give it, and
 * the link for the class, to be copied or shown as a QR code.
 */
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { embedGame, type EmbedSource } from '../lib/embed';
import { L } from '../lib/i18n';
import { SECTIONS } from '../lib/modes';
import { RECEIPT_PATH } from '../lib/routes';
import type { Opts } from '../lib/store';
import { TASK_TITLE_MAX, gameLine, parseTask, receiptCaveat, taskPath, taskTitle, taskUrl } from '../lib/task';
import type { World } from '../lib/world';
import '../screens/task.css';
import { Dialog } from './Dialog';
import { QrButton } from './QrButton';
import './embed.css';

export function TaskDialog({ source, opts, world, onClose }: { source: EmbedSource; opts: Opts; world: World; onClose(): void }) {
  const [title, setTitle] = useState('');
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const path = useMemo(() => taskPath(title, source, opts), [title, source, opts]);
  const url = taskUrl(path);
  /** The game as whoever opens the link gets it: read back from the link itself, so that what is said here is what is set. */
  const game = useMemo(() => {
    const task = parseTask(path);
    return task ? embedGame(task.what, world) : null;
  }, [path, world]);
  // Another title is another link: what was said of the last one no longer holds.
  useEffect(() => setState('idle'), [url]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('failed');
    }
  };
  const named = taskTitle(title);

  return (
    <Dialog title={L('Poner de tarea', 'Set as homework')} className="embed-dialog" onClose={onClose}>
      {game && (
        <>
          <p className="embed-what">{game.title}</p>
          <p className="task-what">
            {SECTIONS[game.cfg.section].name} · {gameLine(game.cfg)}
          </p>
        </>
      )}
      <p className="embed-how">
        {L(
          'Quien abra el enlace escribe su nombre y juega esto mismo, con estas reglas. Al acabar recibe un justificante para mandártelo: un enlace, o un código QR, con su nombre, el resultado, la fecha y qué intento fue.',
          'Whoever opens the link types a name and plays this very game, by these rules. At the end they get a receipt to send you: a link, or a QR code, with their name, the result, the date and which attempt it was.',
        )}
      </p>
      <div className="task-title">
        <label htmlFor="task-title">{L('Título (opcional)', 'Title (optional)')}</label>
        <input
          id="task-title"
          type="text"
          value={title}
          maxLength={TASK_TITLE_MAX}
          placeholder={L('Tema 4: las comunidades autónomas', 'Unit 4: the regions of Spain')}
          aria-describedby="task-title-how"
          onChange={(e) => setTitle(e.target.value)}
        />
        <small id="task-title-how">{L('Lo ve quien hace la tarea, y sale en su justificante.', 'Whoever does the homework sees it, and it is on their receipt.')}</small>
      </div>
      <textarea className="duel-link" readOnly rows={3} value={url} aria-label={L('Enlace de la tarea', 'Link to the homework')} onFocus={(e) => e.currentTarget.select()} />
      <div className="embed-actions">
        <button type="button" className="btn btn-primary btn-sm" onClick={copy}>
          {state === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {state === 'copied' ? L('Enlace copiado', 'Link copied') : L('Copiar el enlace', 'Copy the link')}
        </button>
        <QrButton small url={url} what={named ? L(`Tarea: ${named}`, `Homework: ${named}`) : L('Tarea', 'Homework')} />
        <a className="btn btn-sm" href={url} target="_blank" rel="noopener">
          <ExternalLink size={15} aria-hidden="true" />
          {L('Ver cómo queda', 'See how it looks')}
        </a>
      </div>
      <p className="embed-note" role="status">
        {state === 'copied' && L('Copiado: mándalo a tu clase por donde quieras.', 'Copied: send it to your class any way you like.')}
        {state === 'failed' && L('El navegador no ha dejado copiarlo: selecciona el enlace y cópialo a mano.', 'The browser would not copy it: select the link and copy it by hand.')}
      </p>
      <ul className="embed-notes">
        <li>{L('El enlace lleva el juego tal como lo tienes puesto ahora, con sus reglas: si cambias algo, saca otro.', 'The link carries the game just as you have it set now, with its rules: if you change anything, get another.')}</li>
        <li>{L('Cada vez que alguien la empieza es un intento, y el justificante dice cuál es. La ficha de Wikipedia la decide cada cual.', 'Each time someone starts it is an attempt, and the receipt says which one. The Wikipedia card is for each one to decide.')}</li>
        <li>
          {L('Los justificantes que abras en este dispositivo se juntan, tarea por tarea, en ', 'The receipts you open on this device come together, homework by homework, in ')}
          <a href={`#/${RECEIPT_PATH}`}>{L('«Justificantes abiertos aquí»', '“Receipts opened here”')}</a>.
        </li>
        <li>{receiptCaveat()}</li>
      </ul>
    </Dialog>
  );
}
