/**
 * The backup of the Progress page: saving a copy (to a file, or handed to another app where the browser
 * shares files), reading one back after seeing what it holds, and the reminder that a new one is due.
 */
import { Download, Save, Send, Trash2, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { backupDue, backupName, backupOf, cleanPrefs, shareFile, sinceBackup, summaryOf, type Summary } from '../lib/backup';
import { L, getLang } from '../lib/i18n';
import { isLearnt, useStore } from '../lib/store';
import { nf } from '../lib/text';

/** Hands a file made here over to the browser's downloads. */
export function download(text: string, name: string, type: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

const DAY = 86_400_000;
const dateOf = (t: number): string => new Date(t).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'long', year: 'numeric' });

/** "hoy", "ayer", "hace 12 días": how long ago a day was, counted in days of the calendar. */
function ago(t: number, now: number): string {
  const days = Math.round((new Date(now).setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / DAY);
  if (days <= 0) return L('hoy', 'today');
  if (days === 1) return L('ayer', 'yesterday');
  return L(`hace ${nf(days)} días`, `${nf(days)} days ago`);
}

const answersWord = (n: number): string => L(`${nf(n)} ${n === 1 ? 'respuesta' : 'respuestas'}`, `${nf(n)} ${n === 1 ? 'answer' : 'answers'}`);

/**
 * What the block says after a copy is read. It is kept apart from the screen: a copy that brings other
 * units has the screen mounted afresh, and what it had to say would go with it.
 */
let said: string | null = null;

/** Saves a copy and notes that it was made. Returns the text, for whoever wants to send it instead. */
function makeCopy(now: number): { text: string; name: string } {
  return { text: JSON.stringify(backupOf(useStore.getState(), now), null, 1), name: backupName(L('progreso', 'progress'), now) };
}

function saveCopy(): void {
  const now = Date.now();
  const { text, name } = makeCopy(now);
  download(text, name, 'application/json');
  useStore.getState().markBackup(now);
}

/**
 * At the top of the Progress page, only when a copy is due: a lot has been answered since the last one, and
 * all of it is kept in this browser alone.
 */
export function BackupDue() {
  const mark = useStore((s) => s.backup);
  const answered = useStore((s) => s.tot.q ?? 0);
  const snooze = useStore((s) => s.snoozeBackup);
  const now = Date.now();
  if (!backupDue(mark, answered, now)) return null;
  const since = sinceBackup(mark, answered);
  return (
    <div className="backup-due" role="status">
      <Save size={18} aria-hidden="true" />
      <p>
        <b>
          {mark.at
            ? L(`Llevas ${answersWord(since)} desde tu última copia de seguridad (${ago(mark.at, now)}).`, `${answersWord(since)} since your last backup (${ago(mark.at, now)}).`)
            : L(`Llevas ${answersWord(since)} sin copia de seguridad.`, `${answersWord(since)} and no backup.`)}
        </b>{' '}
        {L('Todo se guarda solo en este navegador: si se borran sus datos, se pierde.', 'Everything is kept in this browser alone: if its data is cleared, it is lost.')}
      </p>
      <button type="button" className="btn btn-sm btn-primary" onClick={saveCopy}>
        <Download size={15} aria-hidden="true" />
        {L('Guardar una copia', 'Save a backup')}
      </button>
      <button type="button" className="btn btn-sm btn-ghost" onClick={() => snooze(Date.now())}>
        {L('Ahora no', 'Not now')}
      </button>
    </div>
  );
}

/** A file that has been read and waits for a yes before it replaces what there is. */
interface Incoming {
  name: string;
  data: unknown;
  sum: Summary;
}

export function BackupBlock() {
  const stats = useStore((s) => s.stats);
  const tot = useStore((s) => s.tot);
  const mark = useStore((s) => s.backup);
  const resetProgress = useStore((s) => s.resetProgress);
  const importData = useStore((s) => s.importData);
  // Whether there is anything to save: progress, or something the player has made.
  const nothing = useStore((s) => !s.sessions.length && !Object.keys(s.stats).length && !Object.keys(s.days).length && !s.favs.length && !s.lists.length && !Object.keys(s.typeins).length && s.typeinAuto === null && !Object.keys(s.notes).length);
  const empty = useStore((s) => !s.sessions.length && !Object.keys(s.stats).length && !Object.keys(s.days).length);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(() => said);
  const [incoming, setIncoming] = useState<Incoming | null>(null);
  const [withPrefs, setWithPrefs] = useState(true);
  const file = useRef<HTMLInputElement>(null);
  // Asked once, with a file of nothing: whether the system takes a file from the browser at all.
  const canSend = useMemo(() => shareFile('{}', 'regionle.json') !== null, []);
  const now = Date.now();

  /** What is here now, in the same figures a copy is summed up in. */
  const here = useMemo<Summary>(() => {
    const list = Object.values(stats).filter((st) => st[0] > 0);
    const s = useStore.getState();
    return { exported: null, answers: list.length, learnt: list.reduce((n, st) => n + (isLearnt(st) ? 1 : 0), 0), games: tot.g ?? s.sessions.length, days: Object.keys(s.days).length, lists: s.lists.length, notes: Object.keys(s.notes).length, prefs: true };
  }, [stats, tot]);

  const say = (text: string | null) => {
    said = text;
    setMessage(text);
    // Long enough for a screen that is mounted afresh to read it; after that it is old news.
    if (text) window.setTimeout(() => (said = said === text ? null : said), 4000);
  };

  const send = async () => {
    const at = Date.now();
    const { text, name } = makeCopy(at);
    const f = shareFile(text, name);
    if (!f) return saveCopy();
    try {
      await navigator.share({ files: [f], title: L('Copia de seguridad de Regionle', 'Regionle backup') });
      useStore.getState().markBackup(at);
      say(L('Copia enviada.', 'Backup sent.'));
    } catch {
      // The player closed the sheet, or the system would not take it: nothing was saved.
    }
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setIncoming(null);
    try {
      const data: unknown = JSON.parse(await f.text());
      const sum = summaryOf(data);
      if (sum) {
        say(null);
        setWithPrefs(true);
        setIncoming({ name: f.name, data, sum });
      } else say(L('Ese archivo no es una copia de Regionle.', 'That file is not a Regionle backup.'));
    } catch {
      say(L('No se ha podido leer el archivo.', 'The file could not be read.'));
    }
    if (file.current) file.current.value = '';
  };

  const replace = () => {
    if (!incoming) return;
    const { data, sum } = incoming;
    const prefs = withPrefs && sum.prefs ? cleanPrefs((data as { prefs?: unknown }).prefs, useStore.getState()) : null;
    setIncoming(null);
    // Said before the copy goes in: one that brings other units mounts this screen afresh, and it reads it then.
    say(L(`Copia importada: ${answersWord(sum.answers)}${sum.exported ? `, como estaban el ${dateOf(sum.exported)}` : ''}.`, `Backup imported: ${answersWord(sum.answers)}${sum.exported ? `, as they stood on ${dateOf(sum.exported)}` : ''}.`));
    if (!importData(data, prefs)) say(L('Ese archivo no es una copia de Regionle.', 'That file is not a Regionle backup.'));
  };

  const rows: [string, keyof Summary][] = [
    [L('Respuestas guardadas', 'Answers kept'), 'answers'],
    [L('Aprendidas', 'Learnt'), 'learnt'],
    [L('Partidas', 'Games'), 'games'],
    [L('Días con actividad', 'Days with activity'), 'days'],
    [L('Listas', 'Lists'), 'lists'],
    [L('Apuntes', 'Notes'), 'notes'],
  ];
  // The copy has less than there is here: said in so many words, since what is not in it is lost.
  const loses = incoming ? here.answers > incoming.sum.answers || here.games > incoming.sum.games : false;

  return (
    <section className="block backup-block">
      <h2>{L('Copia de seguridad', 'Backup')}</h2>
      <p className="tip-line">
        {L(
          'Todo se guarda solo en este navegador. Una copia lleva tu progreso, tus selecciones guardadas, tus listas, tus apuntes, tus abreviaturas y tus preferencias a otro navegador, o lo deja a salvo por si acaso.',
          'Everything is kept in this browser alone. A backup takes your progress, your saved selections, your lists, your notes, your short forms and your preferences to another browser, or keeps them safe just in case.',
        )}
      </p>
      <p className="backup-last">
        {mark.at
          ? L(`Última copia: ${dateOf(mark.at)} (${ago(mark.at, now)}).`, `Last backup: ${dateOf(mark.at)} (${ago(mark.at, now)}).`)
          : nothing
            ? L('Aún no hay nada que guardar.', 'Nothing to back up yet.')
            : L('Aún no has guardado ninguna copia.', 'You have not saved a backup yet.')}
        {mark.at > 0 && sinceBackup(mark, tot.q ?? 0) > 0 && <> {L(`Desde entonces, ${answersWord(sinceBackup(mark, tot.q ?? 0))}.`, `Since then, ${answersWord(sinceBackup(mark, tot.q ?? 0))}.`)}</>}
      </p>
      <div className="backup">
        <button type="button" className="btn" onClick={saveCopy} disabled={nothing}>
          <Download size={16} aria-hidden="true" />
          {L('Exportar', 'Export')}
        </button>
        {canSend && (
          <button type="button" className="btn" onClick={() => void send()} disabled={nothing} title={L('Enviar la copia a otra aplicación: a un disco, por correo, por mensaje', 'Send the backup to another app: a drive, a mail, a message')}>
            <Send size={16} aria-hidden="true" />
            {L('Enviar', 'Send')}
          </button>
        )}
        <button type="button" className="btn" onClick={() => file.current?.click()}>
          <Upload size={16} aria-hidden="true" />
          {L('Importar', 'Import')}
        </button>
        <input ref={file} type="file" accept="application/json,.json,text/plain,.txt" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        {confirming ? (
          <span className="confirm">
            {L('¿Borrar todo el progreso?', 'Delete all progress?')}
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={() => {
                resetProgress();
                setConfirming(false);
                say(L('Progreso borrado.', 'Progress deleted.'));
              }}
            >
              {L('Sí, borrar', 'Yes, delete')}
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>
              No
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-ghost" onClick={() => setConfirming(true)} disabled={empty}>
            <Trash2 size={16} aria-hidden="true" />
            {L('Borrar progreso', 'Delete progress')}
          </button>
        )}
      </div>
      {incoming && (
        <div className="backup-in" role="group" aria-label={L('La copia que se va a importar', 'The backup about to be imported')}>
          <p className="backup-in-head">
            <b>{incoming.name}</b>
            {incoming.sum.exported ? <> · {L(`copia del ${dateOf(incoming.sum.exported)}`, `backup of ${dateOf(incoming.sum.exported)}`)}</> : null}
          </p>
          <table className="backup-sum">
            <thead>
              <tr>
                <td />
                <th scope="col">{L('En la copia', 'In the backup')}</th>
                <th scope="col">{L('Aquí ahora', 'Here now')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, key]) => (
                <tr key={key}>
                  <th scope="row">{label}</th>
                  <td>{nf(incoming.sum[key] as number)}</td>
                  <td>{nf(here[key] as number)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {incoming.sum.prefs ? (
            <label className="backup-prefs">
              <input type="checkbox" checked={withPrefs} onChange={(e) => setWithPrefs(e.target.checked)} />
              <span>{L('Traer también las preferencias de la copia: tema, colores, letra, unidades, sonidos, repaso y opciones de juego', 'Bring the preferences of the backup too: theme, colours, letter, units, sounds, review and game options')}</span>
            </label>
          ) : (
            <p className="backup-note">{L('Esta copia es de una versión anterior y no trae preferencias: las de aquí se quedan como están.', 'This backup is from an earlier version and brings no preferences: the ones here stay as they are.')}</p>
          )}
          <p className={loses ? 'backup-note backup-warn' : 'backup-note'}>
            {loses
              ? L('Aquí hay más que en la copia. Importarla sustituye lo que hay aquí: lo que no esté en ella se pierde.', 'There is more here than in the backup. Importing it replaces what is here: what is not in it is lost.')
              : L('Importarla sustituye lo que hay aquí; no lo suma.', 'Importing it replaces what is here; it does not add to it.')}
          </p>
          <div className="backup-in-go">
            <button type="button" className={loses ? 'btn btn-danger' : 'btn btn-primary'} onClick={replace}>
              {L('Sustituir lo que hay aquí', 'Replace what is here')}
            </button>
            <button type="button" className="btn" onClick={() => setIncoming(null)}>
              {L('Cancelar', 'Cancel')}
            </button>
          </div>
        </div>
      )}
      {message && (
        <p className="q-note" role="status">
          {message}
        </p>
      )}
    </section>
  );
}
