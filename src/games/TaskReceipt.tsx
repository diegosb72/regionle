/**
 * The end of a game that was set as homework (lib/task.ts): the receipt for whoever set it. A link, to be
 * copied or shown as a QR code, that carries the name, how it went and when.
 */
import { Check, ClipboardCheck, ExternalLink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { QrButton } from '../components/QrButton';
import { L } from '../lib/i18n';
import { settle } from '../lib/router';
import { TASK_PATH } from '../lib/routes';
import '../screens/task.css';
import type { Format } from '../lib/store';
import { answered, encodeReceipt, headline, outcomeOf, parseTask, receiptLine, receiptOf, receiptUrl, receiptWhen, type TaskTally } from '../lib/task';
import { doneWith, finish, started } from '../lib/taskKept';

/**
 * A game of an assignment comes on screen: it is counted as one more start of it. Unless it is a game that
 * had ended and the page was opened again on it: that one is not played anew, and whoever was on it is
 * taken to the assignment, where its receipt is.
 */
export function begin(task: { path: string; name: string }, nonce: number): void {
  if (doneWith(nonce)) settle(`${TASK_PATH}/${task.path}`);
  else started(task.path, nonce, task.name);
}

export function TaskReceipt({ task, nonce, tally, format }: { task: { path: string; name: string }; nonce: number; tally: TaskTally; format: Format }) {
  // The minute it says is the one the game ended in, however long it is looked at; and its attempt, the one this game was.
  const [made] = useState(() => ({ at: Date.now(), n: started(task.path, nonce, task.name) }));
  const receipt = receiptOf(task.path, task.name, tally, made.n, made.at);
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  const code = encodeReceipt(receipt);
  const url = receiptUrl(code);
  // Kept here too, once the clock of the game has said its last word: a receipt that was not sent in time is not lost.
  useEffect(() => {
    const timer = setTimeout(() => finish(nonce, code), 250);
    return () => clearTimeout(timer);
  }, [nonce, code]);
  const title = parseTask(task.path)?.title ?? '';
  const outcome = outcomeOf(receipt);
  const said = receiptLine(receipt, format);
  const text = L(`Justificante de ${receipt.name}${title ? `, «${title}»` : ''}: ${said}.`, `Receipt of ${receipt.name}${title ? `, “${title}”` : ''}: ${said}.`);

  const send = async () => {
    try {
      if (navigator.share && /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)) {
        await navigator.share({ text, url });
        return;
      }
    } catch {
      // The share sheet was closed: fall back to copying.
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setState('copied');
    } catch {
      setState('shown');
    }
  };

  return (
    <section className="duel receipt" aria-label={L('Justificante de la tarea', 'Homework receipt')}>
      <p className="kicker">
        <ClipboardCheck size={15} aria-hidden="true" /> {L('Justificante de la tarea', 'Homework receipt')}
      </p>
      <p className="receipt-main">
        <b>{receipt.name}</b>
        <span>{headline(receipt, format)}</span>
      </p>
      <p className="receipt-line">
        {title && `${L(`«${title}»`, `“${title}”`)} · `}
        {L(`respondidas ${answered(receipt)}`, `${answered(receipt)} answered`)} · {receiptWhen(receipt.at)} · {L(`intento ${receipt.n}`, `attempt ${receipt.n}`)}
      </p>
      {outcome.short && (
        <p className="receipt-short" role="status">
          {L(
            `La has terminado antes de acabar: en el justificante, las ${receipt.total - outcome.asked} que no has respondido cuentan como falladas. Con «Otra vez» la haces entera.`,
            `You ended it before its last question: on the receipt, the ${receipt.total - outcome.asked} you did not answer count as missed. “Again” lets you do all of it.`,
          )}
        </p>
      )}
      <div className="duel-send">
        {/* What there is to do when homework ends: the keyboard is left here, and not on the button that starts it again. */}
        <button type="button" className="btn btn-primary" onClick={send} autoFocus>
          {state === 'copied' ? <Check size={16} aria-hidden="true" /> : <ClipboardCheck size={16} aria-hidden="true" />}
          {state === 'copied' ? L('Justificante copiado', 'Receipt copied') : L('Copiar el justificante', 'Copy the receipt')}
        </button>
        <QrButton url={url} what={L(`Justificante de ${receipt.name}`, `Receipt of ${receipt.name}`)} />
        <a className="btn" href={url} target="_blank" rel="noopener">
          <ExternalLink size={16} aria-hidden="true" />
          {L('Verlo', 'See it')}
        </a>
      </div>
      <p className="duel-how">
        {L(
          'Mándale ese enlace a quien te puso la tarea, o enséñale el código QR. Dentro van tu nombre, el resultado y la fecha: no se guardan en ningún otro sitio.',
          'Send that link to whoever set the homework, or show them the QR code. Your name, the result and the date go inside it: they are kept nowhere else.',
        )}
      </p>
      {state === 'shown' && <textarea className="duel-link" readOnly rows={3} value={url} aria-label={L('Enlace del justificante', 'Link of the receipt')} onFocus={(e) => e.currentTarget.select()} />}
      <span className="sr-only" role="status">
        {state === 'copied' ? L('Justificante copiado', 'Receipt copied') : ''}
      </span>
    </section>
  );
}
