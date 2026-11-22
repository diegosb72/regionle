/**
 * Homework with a receipt (lib/task.ts), as its two addresses show it. `#/tarea/…` is the assignment as
 * whoever does it gets it: what it is, a box for the name, and the button that starts it; with nothing
 * after it, how one is set. `#/justificante/…` is a receipt as whoever set the assignment reads it: who,
 * what, how it went and when, whether its check figure holds, and the other receipts of the same
 * assignment that were opened on this device, together.
 */
import { ArrowLeft, ArrowRight, Check, ClipboardCheck, Copy, Play, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { QrButton } from '../components/QrButton';
import { Flag } from '../components/ui';
import { embedGame, type EmbedGame } from '../lib/embed';
import { L } from '../lib/i18n';
import { MODE_NAME, SECTIONS } from '../lib/modes';
import { go } from '../lib/router';
import { PATHS, PLAY_PATH, RECEIPT_PATH, TASK_PATH } from '../lib/routes';
import { FORMAT_MODES, formatOfGame } from '../lib/rules';
import { useStore, type Format } from '../lib/store';
import {
  TASK_NAME_MAX,
  answered,
  canTask,
  decodeReceipt,
  gameLine,
  headline,
  outcomeOf,
  parseTask,
  pupilName,
  receiptCaveat,
  receiptUrl,
  receiptWhen,
  receiptsTable,
  type Task as TaskData,
} from '../lib/task';
import { attemptsOf, forgetReceipts, keepName, keepReceipt, keptName, receiptsKept, tasksOf, type KeptReceipt } from '../lib/taskKept';
import { cx, fmtTime, listed, nf } from '../lib/text';
import type { Country } from '../lib/types';
import type { World } from '../lib/world';
import './task.css';

/**
 * The game of an assignment on the atlas of today; null when its address names no game that can be set.
 * A game the address does not name is not swapped for another: what is done has to be what was set.
 */
function gameOf(task: TaskData | null, world: World): EmbedGame | null {
  if (!task) return null;
  const game = embedGame(task.what, world);
  const asked = task.what.kind === 'list' ? task.what.mode : task.what.link.mode;
  return game && game.def.id === asked && canTask(game.def.id) ? game : null;
}

/** The flags of the countries a game is played with. A physical map has none. */
function flagsOf(game: EmbedGame, world: World): Country[] {
  return game.cfg.section === 'physical' ? [] : game.cfg.countries.map((id) => world.byId.get(id)).filter((c): c is Country => !!c);
}

/** What an assignment is: its map, and its game in words. */
function TaskWhat({ game, world }: { game: EmbedGame; world: World }) {
  const flags = flagsOf(game, world);
  return (
    <div className="duel-what">
      {flags.length > 0 && (
        <span className="duel-flags" aria-hidden="true">
          {flags.slice(0, 8).map((c) => (
            <Flag key={c.id} code={c.fl} size="md" />
          ))}
        </span>
      )}
      <strong>{game.title}</strong>
      <span>
        {SECTIONS[game.cfg.section].name} · {gameLine(game.cfg)}
      </span>
    </div>
  );
}

/** `#/tarea` on its own: how an assignment is set. The button that makes one is where a game is chosen, and nothing else says so. */
function TaskHow() {
  const modes = listed(FORMAT_MODES.map((id) => MODE_NAME[id]), L('y', 'and'));
  return (
    <div className="duel-page">
      <p className="kicker">
        <ClipboardCheck size={15} aria-hidden="true" /> {L('Tareas con justificante', 'Homework with a receipt')}
      </p>
      <h1>{L('Pon una tarea de mapas', 'Set map homework')}</h1>
      <p className="lead">{L('Sin cuentas ni plataformas: la tarea va en un enlace, y lo que hizo cada cual vuelve en otro.', 'No accounts and no platforms: the homework goes in a link, and what each one did comes back in another.')}</p>
      <ol className="how-steps">
        <li>
          <b>{L('Elige el mapa, el juego y sus reglas.', 'Choose the map, the game and its rules.')}</b>{' '}
          {L(
            `Sirven los juegos de preguntas (${modes}), a su aire, contrarreloj, en supervivencia o como examen; y también con una lista tuya.`,
            `The question games will do (${modes}), at ease, against the clock, as a survival or as an exam; and with a list of yours too.`,
          )}
        </li>
        <li>
          <b>{L('Pulsa «Poner de tarea»', 'Press “Set as homework”')}</b>{' '}
          {L('junto al enlace del mapa, dale un título si quieres y manda el enlace a tu clase, o proyecta su código QR.', 'next to the link to the map, give it a title if you like and send the link to your class, or put its QR code on the board.')}
        </li>
        <li>
          <b>{L('Cada cual escribe su nombre y juega', 'Each one types a name and plays')}</b>{' '}
          {L(
            'lo que elegiste, con tus reglas. Al acabar recibe un justificante: un enlace, o un código QR, con su nombre, el resultado, la fecha y qué intento fue.',
            'what you chose, by your rules. At the end they get a receipt: a link, or a QR code, with their name, the result, the date and which attempt it was.',
          )}
        </li>
        <li>
          <b>{L('Abre los justificantes que te manden.', 'Open the receipts you are sent.')}</b>{' '}
          {L(
            'Cada uno dice cómo fue, y los de una misma tarea se juntan en una tabla que puedes copiar a una hoja de cálculo.',
            'Each says how it went, and those of the same homework come together in a table that you can copy into a spreadsheet.',
          )}
        </li>
      </ol>
      <p className="duel-rules">{receiptCaveat()}</p>
      <div className="duel-actions">
        <a className="btn btn-primary btn-lg" href={`#/${PATHS.regions}`}>
          {L('Elegir a qué jugar', 'Choose what to play')}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
        <a className="btn btn-ghost" href={`#/${RECEIPT_PATH}`}>
          {L('Justificantes abiertos aquí', 'Receipts opened here')}
        </a>
      </div>
    </div>
  );
}

/** A link that names nothing that can be shown: said, with the way out. */
function Broken({ kicker, title, text }: { kicker: string; title: string; text: string }) {
  return (
    <div className="duel-page">
      <p className="kicker">{kicker}</p>
      <h1>{title}</h1>
      <p className="lead">{text}</p>
      <a className="btn btn-primary" href="#/">
        <ArrowLeft size={16} aria-hidden="true" />
        {L('Ir al inicio', 'Go to the home page')}
      </a>
    </div>
  );
}

export function Task({ rest, world }: { rest: string; world: World }) {
  const wiki = useStore((s) => s.opts.wiki);
  const start = useStore((s) => s.start);
  const task = useMemo(() => parseTask(rest), [rest]);
  const game = useMemo(() => gameOf(task, world), [task, world]);
  const [name, setName] = useState(keptName);
  /** The button was pressed with no name in the box. */
  const [nameless, setNameless] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  /** The receipts of this assignment that were made or opened on this device. */
  const [kept, setKept] = useState(() => (task ? receiptsKept(task.path) : []));

  if (!rest) return <TaskHow />;
  if (!task || !game) {
    return (
      <Broken
        kicker={L('Tarea', 'Homework')}
        title={L('Este enlace no funciona', 'This link does not work')}
        text={L('Puede que se haya cortado al copiarlo. Pide a quien te puso la tarea que te lo mande otra vez.', 'It may have been cut when it was copied. Ask whoever set the homework to send it again.')}
      />
    );
  }

  /** Under the name in the box: the count is of each one, on a device that several may share. */
  const times = attemptsOf(task.path, name);
  const begin = (e: FormEvent) => {
    e.preventDefault();
    const who = pupilName(name);
    if (!who) {
      setNameless(true);
      field.current?.focus();
      return;
    }
    keepName(who);
    // The game is the one that was set, for everyone alike. The card of Wikipedia asks another site: that is for each one to say.
    start({ ...game.cfg, opts: { ...game.cfg.opts, wiki }, task: { path: task.path, name: who } });
    go(PLAY_PATH);
  };

  return (
    <form className="duel-page" onSubmit={begin} noValidate>
      <p className="kicker">
        <ClipboardCheck size={15} aria-hidden="true" /> {L('Tarea', 'Homework')}
      </p>
      <h1>{task.title || L('Tarea de mapas', 'Map homework')}</h1>
      <TaskWhat game={game} world={world} />
      <p className="lead">
        {L(
          'Al acabar, el juego te da un justificante con tu nombre, el resultado y la fecha: un enlace, o un código QR, para quien te la ha puesto.',
          'At the end the game gives you a receipt with your name, the result and the date: a link, or a QR code, for whoever set it.',
        )}
      </p>
      <div className="task-name">
        <label htmlFor="task-name">{L('Tu nombre', 'Your name')}</label>
        <input
          ref={field}
          id="task-name"
          type="text"
          value={name}
          maxLength={TASK_NAME_MAX}
          autoComplete="name"
          aria-invalid={nameless && !pupilName(name)}
          aria-describedby="task-name-how"
          onChange={(e) => setName(e.target.value)}
        />
        <small id="task-name-how">{L('Como te conozca quien te la ha puesto. Va dentro del justificante, y a ningún otro sitio.', 'As whoever set it knows you. It goes inside the receipt, and nowhere else.')}</small>
      </div>
      {nameless && !pupilName(name) && (
        <p className="task-problem" role="alert">
          {L('Escribe tu nombre: sin él, el justificante no dice de quién es.', 'Type your name: without it, the receipt does not say whose it is.')}
        </p>
      )}
      <div className="duel-actions">
        <button type="submit" className="btn btn-primary btn-lg">
          <Play size={18} aria-hidden="true" />
          {L('Empezar la tarea', 'Start the homework')}
        </button>
        <a className="btn btn-ghost" href="#/">
          {L('Ahora no', 'Not now')}
        </a>
      </div>
      <p className="duel-rules">
        {times > 0
          ? L(
              `Con ese nombre, en este dispositivo la has empezado ${nf(times)} ${times === 1 ? 'vez' : 'veces'}. Puedes hacerla cuantas quieras: cada justificante dice qué intento es.`,
              `Under that name you have started it ${times === 1 ? 'once' : `${nf(times)} times`} on this device. You can do it as often as you like: each receipt says which attempt it is.`,
            )
          : L('Puedes hacerla cuantas veces quieras: cada vez que la empiezas es un intento, y el justificante dice cuál es.', 'You can do it as often as you like: each time you start it is an attempt, and the receipt says which one.')}
      </p>
      {kept.length > 0 && (
        <section className="receipt-class" aria-label={L('Justificantes de esta tarea', 'Receipts of this homework')}>
          <h2>{L('Justificantes de esta tarea', 'Receipts of this homework')}</h2>
          <p className="task-what">
            {L(
              'Los que se han hecho o abierto en este dispositivo. Pulsa un nombre para ver el justificante y mandarlo.',
              'Those that were made or opened on this device. Press a name to see the receipt and send it.',
            )}
          </p>
          <ClassTable
            list={kept}
            format={formatOfGame(game.cfg)}
            onForget={() => {
              forgetReceipts(task.path);
              setKept([]);
            }}
          />
        </section>
      )}
    </form>
  );
}

/** The receipts of one assignment that are kept on this device, as the list of a class. */
function ClassTable({ list, format, now, onForget }: { list: KeptReceipt[]; format: Format; now?: string; onForget(): void }) {
  const [copied, setCopied] = useState(false);
  const [shown, setShown] = useState(false);
  const table = receiptsTable(list.map((k) => k.receipt), format);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(table);
      setCopied(true);
    } catch {
      setShown(true);
    }
  };
  return (
    <>
      <div className="receipt-scroll">
        <table className="receipt-table">
          <thead>
            <tr>
              <th scope="col">{L('Nombre', 'Name')}</th>
              <th scope="col">{L('Resultado', 'Result')}</th>
              <th scope="col">{L('Respondidas', 'Answered')}</th>
              <th scope="col">{L('Tiempo', 'Time')}</th>
              <th scope="col">{L('Fecha', 'Date')}</th>
              <th scope="col">{L('Intento', 'Attempt')}</th>
            </tr>
          </thead>
          <tbody>
            {list.map(({ code, receipt }) => (
              <tr key={code} className={cx(code === now && 'now')}>
                <th scope="row">
                  <a href={`#/${RECEIPT_PATH}/${code}`}>{receipt.name}</a>
                </th>
                <td>{headline(receipt, format)}</td>
                <td>{answered(receipt)}</td>
                <td>{fmtTime(receipt.secs * 1000)}</td>
                <td>{receiptWhen(receipt.at)}</td>
                <td>{nf(receipt.n)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="duel-actions">
        <button type="button" className="btn btn-sm" onClick={copy}>
          {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {copied ? L('Tabla copiada', 'Table copied') : L('Copiar la tabla', 'Copy the table')}
        </button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onForget}>
          <Trash2 size={15} aria-hidden="true" />
          {L('Borrar estos justificantes', 'Delete these receipts')}
        </button>
      </div>
      {shown && <textarea className="duel-link" readOnly rows={Math.min(8, list.length + 1)} value={table} aria-label={L('La tabla, para copiarla', 'The table, to be copied')} onFocus={(e) => e.currentTarget.select()} />}
      <span className="sr-only" role="status">
        {copied ? L('Tabla copiada', 'Table copied') : ''}
      </span>
    </>
  );
}

/** `#/justificante` on its own: every receipt opened on this device, assignment by assignment. */
function ReceiptBook({ world }: { world: World }) {
  const [all, setAll] = useState(() => receiptsKept());
  /** The assignments there are receipts of: the one with the latest receipt first. */
  const tasks = useMemo(() => tasksOf(all), [all]);
  return (
    <div className="duel-page">
      <p className="kicker">
        <ClipboardCheck size={15} aria-hidden="true" /> {L('Justificantes', 'Receipts')}
      </p>
      <h1>{L('Justificantes abiertos aquí', 'Receipts opened here')}</h1>
      {tasks.length === 0 ? (
        <p className="lead">
          {L(
            'Todavía ninguno. Cada justificante que abras en este dispositivo se apunta aquí, junto a los demás de su tarea.',
            'None yet. Each receipt you open on this device is noted here, with the others of its homework.',
          )}
        </p>
      ) : (
        <p className="lead">{L('Se guardan en este dispositivo, y solo en él, hasta que los borres.', 'They are kept on this device, and nowhere else, until you delete them.')}</p>
      )}
      {tasks.map((path) => {
        const task = parseTask(path);
        const game = gameOf(task, world);
        const list = all.filter((k) => k.receipt.task === path);
        return (
          <section key={path} className="receipt-class">
            <h2>{task?.title || game?.title || L('Tarea', 'Homework')}</h2>
            {game && (
              <p className="task-what">
                {task?.title ? `${game.title} · ` : ''}
                {gameLine(game.cfg)} · <a href={`#/${TASK_PATH}/${path}`}>{L('Ver la tarea', 'See the homework')}</a>
              </p>
            )}
            <ClassTable
              list={list}
              format={game ? formatOfGame(game.cfg) : 'normal'}
              onForget={() => {
                forgetReceipts(path);
                setAll(receiptsKept());
              }}
            />
          </section>
        );
      })}
      <div className="duel-actions">
        <a className="btn" href={`#/${TASK_PATH}`}>
          {L('Cómo se pone una tarea', 'How homework is set')}
        </a>
      </div>
    </div>
  );
}

export function Receipt({ code, world }: { code: string; world: World }) {
  const read = useMemo(() => (code ? decodeReceipt(code) : null), [code]);
  const task = useMemo(() => (read ? parseTask(read.receipt.task) : null), [read]);
  const game = useMemo(() => gameOf(task, world), [task, world]);
  /** The receipts of the same assignment that are kept here: this one among them, once it is. */
  const [list, setList] = useState<KeptReceipt[]>([]);
  const [state, setState] = useState<'idle' | 'copied' | 'shown'>('idle');
  useEffect(() => {
    if (!read) return;
    // Only what the game wrote is kept: a receipt that does not hold is shown, and goes no further.
    if (read.sound) keepReceipt(code);
    setList(receiptsKept(read.receipt.task));
  }, [code, read]);

  if (!code) return <ReceiptBook world={world} />;
  if (!read) {
    return (
      <Broken
        kicker={L('Justificante', 'Receipt')}
        title={L('Este justificante no se puede leer', 'This receipt cannot be read')}
        text={L('Puede que el enlace se haya cortado al copiarlo. Pide que te lo manden otra vez.', 'The link may have been cut when it was copied. Ask for it to be sent again.')}
      />
    );
  }

  const { receipt, sound } = read;
  const format: Format = game ? formatOfGame(game.cfg) : 'normal';
  const outcome = outcomeOf(receipt);
  const blank = receipt.total > 0 ? receipt.total - outcome.asked : 0;
  const rows: [string, string][] = [
    [L('Respondidas', 'Answered'), `${answered(receipt)}${outcome.short ? L(' · sin terminar', ' · not finished') : ''}`],
    [L('A la primera', 'First time'), nf(receipt.ok)],
    ...(format === 'exam' ? [] : ([[L('Con ayuda', 'With help'), nf(receipt.warn)]] as [string, string][])),
    [L('Fallos', 'Misses'), `${nf(receipt.bad)}${blank > 0 ? L(` · ${nf(blank)} sin responder`, ` · ${nf(blank)} not answered`) : ''}`],
    [L('Tiempo', 'Time'), fmtTime(receipt.secs * 1000)],
    [L('Fecha', 'Date'), receiptWhen(receipt.at)],
    [L('Intento', 'Attempt'), L(`${nf(receipt.n)}.º en su dispositivo`, `No. ${nf(receipt.n)} on their device`)],
  ];
  const others = list.length > 1 || (list.length === 1 && list[0].code !== code);
  const url = receiptUrl(code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setState('copied');
    } catch {
      setState('shown');
    }
  };

  return (
    <div className="duel-page">
      <p className="kicker">
        <ClipboardCheck size={15} aria-hidden="true" /> {L('Justificante de tarea', 'Homework receipt')}
      </p>
      <h1>{receipt.name}</h1>
      {game ? (
        <>
          {task?.title && <p className="lead">{L(`«${task.title}»`, `“${task.title}”`)}</p>}
          <TaskWhat game={game} world={world} />
        </>
      ) : (
        <p className="task-problem" role="status">
          {L(
            'Este juego no reconoce la tarea de este justificante: puede que el enlace venga de otra versión. Las cifras son las que trae.',
            'This game does not recognise the homework of this receipt: the link may come from another version. The figures are the ones it carries.',
          )}
        </p>
      )}
      <dl className="receipt-sheet">
        <div className="receipt-big">
          <dt>{L('Resultado', 'Result')}</dt>
          <dd>{headline(receipt, format)}</dd>
        </div>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      <p className={cx('receipt-seal', !sound && 'broken')} role={sound ? undefined : 'alert'}>
        {sound ? <ShieldCheck size={18} aria-hidden="true" /> : <ShieldAlert size={18} aria-hidden="true" />}
        <span>
          {sound
            ? L('La cifra de control cuadra: el enlace dice lo que el juego escribió al acabar la partida.', 'The check figure holds: the link says what the game wrote when the game ended.')
            : L(
                'La cifra de control no cuadra: este enlace se ha cortado o lo han retocado. No lo des por bueno, y pide que te lo manden otra vez.',
                'The check figure does not hold: this link was cut, or it was touched up. Do not take it as good, and ask for it to be sent again.',
              )}
        </span>
      </p>
      <div className="duel-actions">
        <button type="button" className="btn btn-sm" onClick={copy}>
          {state === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
          {state === 'copied' ? L('Enlace copiado', 'Link copied') : L('Copiar el enlace', 'Copy the link')}
        </button>
        <QrButton small url={url} what={L(`Justificante de ${receipt.name}`, `Receipt of ${receipt.name}`)} />
        <span className="sr-only" role="status">
          {state === 'copied' ? L('Enlace copiado', 'Link copied') : ''}
        </span>
      </div>
      {state === 'shown' && <textarea className="duel-link" readOnly rows={3} value={url} aria-label={L('Enlace del justificante', 'Link of the receipt')} onFocus={(e) => e.currentTarget.select()} />}
      <p className="duel-rules">{receiptCaveat()}</p>
      <section className="receipt-class" aria-label={L('Justificantes de esta tarea', 'Receipts of this homework')}>
        <h2>{L('Los de esta tarea', 'Those of this homework')}</h2>
        {others ? (
          <>
            <p className="task-what">
              {L(
                'Los justificantes de esta misma tarea que has abierto en este dispositivo. Se guardan aquí, y solo aquí, hasta que los borres.',
                'The receipts of this same homework that you have opened on this device. They are kept here, and nowhere else, until you delete them.',
              )}
            </p>
            <ClassTable
              list={list}
              format={format}
              now={code}
              onForget={() => {
                forgetReceipts(receipt.task);
                setList([]);
              }}
            />
          </>
        ) : (
          <p className="task-what">
            {L(
              'Según abras en este dispositivo los demás justificantes de esta tarea, se irán juntando aquí en una tabla.',
              'As you open the other receipts of this homework on this device, they will come together here in a table.',
            )}
          </p>
        )}
      </section>
      <div className="duel-actions">
        {game && task && (
          <a className="btn" href={`#/${TASK_PATH}/${task.path}`}>
            {L('Ver la tarea', 'See the homework')}
          </a>
        )}
        <a className="btn btn-ghost" href={`#/${RECEIPT_PATH}`}>
          {L('Todos los justificantes', 'All the receipts')}
        </a>
      </div>
    </div>
  );
}
