/**
 * The cards of a bingo (lib/bingo.ts), as their address shows them. `#/bingo/7/…` is a card for a player to
 * mark on a phone; `#/bingo/-/…` gives whoever opens it a card of their own; `#/bingo/1-30/…` is a sheet of
 * cards to print and cut out; and `#/bingo` on its own says how it is played.
 */
import { ArrowLeft, ArrowRight, Eraser, Printer, Shuffle } from 'lucide-react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from 'react';
import { BingoCard } from '../components/BingoCard';
import { Spinner } from '../components/ui';
import {
  BINGO_MIN,
  CARD_MAX,
  PER_PAGE,
  SHEET_MAX,
  bingoGame,
  bingoPath,
  callOf,
  cardOf,
  judgeMarks,
  lineName,
  ownCard,
  parseBingo,
  poolOf,
  sizeFor,
  type Bingo as BingoData,
} from '../lib/bingo';
import { keepMarks, keepOwn, marksOf, ownOf } from '../lib/bingoKept';
import { deckFor } from '../lib/decks';
import { L } from '../lib/i18n';
import { go, settle } from '../lib/router';
import { BINGO_PATH, PATHS } from '../lib/routes';
import { cx, listed } from '../lib/text';
import type { Deck } from '../lib/types';
import type { World } from '../lib/world';

/** `#/bingo` on its own: how a bingo is played. The game is started where every other one is, and nothing else says so. */
function BingoHow() {
  return (
    <div className="duel-page">
      <p className="kicker">{L('Para jugar en grupo', 'To play in a group')}</p>
      <h1>{L('Bingo de mapas', 'Map bingo')}</h1>
      <p className="lead">{L('Una pantalla saca las piezas de un mapa y cada jugador las marca en su cartón. Para una clase, o para una tarde en casa.', 'One screen calls the pieces of a map and each player marks them on a card. For a class, or for an afternoon at home.')}</p>
      <ol className="how-steps">
        <li>
          <b>{L('Elige el mapa y, entre los juegos, «Bingo».', 'Choose the map and, among the games, “Bingo”.')}</b>{' '}
          {L(
            `Sirve cualquiera que tenga al menos ${BINGO_MIN} piezas: las provincias de un país, los países de un continente, sus ciudades, sus ríos, o una lista tuya.`,
            `Any map with at least ${BINGO_MIN} pieces will do: the provinces of a country, the countries of a continent, its cities, its rivers, or a list of yours.`,
          )}
        </li>
        <li>
          <b>{L('Decide cómo salen las piezas y reparte los cartones.', 'Decide how the pieces come up and hand out the cards.')}</b>{' '}
          {L(
            'Iluminadas en el mapa, o por su bandera, su capital, su silueta o su nombre. Los cartones, de 3, 4 o 5 nombres de lado, van impresos o en el móvil de cada cual, con un enlace o un código QR; todos son distintos y llevan un número.',
            'Lit up on the map, or by their flag, their capital, their outline or their name. The cards, 3, 4 or 5 names across, are printed or on each one’s phone, with a link or a QR code; they are all different and each has a number.',
          )}
        </li>
        <li>
          <b>{L('Ve sacando piezas.', 'Call the pieces.')}</b>{' '}
          {L('Quien tenga en su cartón el nombre de la que sale, lo marca. Puedes enseñar el nombre de cada una, o no.', 'Whoever has on their card the name of the one that comes up marks it. You can show the name of each one, or not.')}
        </li>
        <li>
          <b>{L('Comprueba a quien cante línea o bingo.', 'Check whoever calls a line or bingo.')}</b>{' '}
          {L(
            'Una línea es una fila, una columna o una diagonal entera; el bingo, el cartón completo. Escribe el número de su cartón y la pantalla dice si es verdad.',
            'A line is a whole row, column or diagonal; bingo, the full card. Type the number of their card and the screen says whether it is true.',
          )}
        </li>
      </ol>
      <p className="duel-rules">{L('No hay cuentas ni servidor: los cartones salen del mapa y de su número, y lo que va saliendo se queda en la pantalla que lo saca.', 'There are no accounts and no server: the cards come from the map and from their number, and what comes up stays on the screen that calls it.')}</p>
      <div className="duel-actions">
        <a className="btn btn-primary btn-lg" href={`#/${PATHS.regions}`}>
          {L('Elegir el mapa', 'Choose the map')}
          <ArrowRight size={18} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
}

/** A link that names no card that can be shown: said, with the way out. */
function Broken({ title, text, retry }: { title: string; text: string; retry?(): void }) {
  return (
    <div className="duel-page">
      <p className="kicker">Bingo</p>
      <h1>{title}</h1>
      <p className="lead">{text}</p>
      <div className="duel-actions">
        {retry && (
          <button type="button" className="btn btn-primary" onClick={retry}>
            {L('Reintentar', 'Retry')}
          </button>
        )}
        <a className={cx('btn', !retry && 'btn-primary')} href={`#/${BINGO_PATH}`}>
          <ArrowLeft size={16} aria-hidden="true" />
          {L('Cómo se juega al bingo', 'How bingo is played')}
        </a>
      </div>
    </div>
  );
}

interface CardProps {
  bingo: BingoData;
  /** The pieces the cards are dealt from, in their order, and the name of each. */
  ids: readonly string[];
  nameOf(id: string): string;
  title: string;
}

/** One card, for a player to mark as the pieces come up. */
function OneCard({ n, bingo, ids, nameOf, title }: CardProps & { n: number }) {
  const { size } = bingo;
  const path = bingoPath(n, bingo.key);
  const card = useMemo(() => cardOf(ids, size, n), [ids, size, n]);
  const [marks, setMarks] = useState<number[]>(() => marksOf(path).filter((cell) => cell < size * size));
  const toggle = (cell: number) => {
    const next = marks.includes(cell) ? marks.filter((c) => c !== cell) : [...marks, cell];
    setMarks(next);
    keepMarks(path, next);
  };
  const clear = () => {
    setMarks([]);
    keepMarks(path, []);
  };
  /** Another card for this device: another number, which is the one it has from now on. */
  const another = () => {
    let next = ownCard();
    while (next === n) next = ownCard();
    keepOwn(bingo.key, next);
    go(bingoPath(next, bingo.key));
  };
  const v = judgeMarks(
    card.map((_, cell) => marks.includes(cell)),
    size,
  );
  const call = callOf(v);
  const lines = listed(
    v.lines.map((i) => lineName(size, i)),
    L('y', 'and'),
  );

  return (
    <div className="duel-page bingo-page">
      <p className="kicker">Bingo · {title}</p>
      <h1>{L(`Cartón ${n}`, `Card ${n}`)}</h1>
      <p className="lead">{L('Irán saliendo piezas del mapa en la pantalla de quien dirige la partida: si tienes aquí el nombre de una, márcalo.', 'Pieces of the map will come up on the screen of whoever runs the game: if you have the name of one here, mark it.')}</p>
      <BingoCard names={card.map(nameOf)} size={size} label={L(`Cartón ${n}`, `Card ${n}`)} marked={v.marked} lines={v.lines} onMark={toggle} />
      <p className={cx('bingo-status', `is-${call}`)} role="status">
        {call === 'bingo' ? (
          <>
            <b>{L('¡Bingo!', 'Bingo!')}</b> {L(`Cántalo y di tu número: el ${n}.`, `Call it and say your number: ${n}.`)}
          </>
        ) : call === 'line' ? (
          <>
            <b>{L('¡Línea!', 'Line!')}</b> {L(`Tienes ${lines}. Cántala y di tu número: el ${n}.`, `You have ${lines}. Call it and say your number: ${n}.`)}
          </>
        ) : (
          L(
            marks.length ? `Llevas ${marks.length} de ${size * size}. Una fila, una columna o una diagonal entera es línea.` : 'Toca un nombre para marcarlo, y otra vez para quitarle la marca.',
            marks.length ? `${marks.length} of ${size * size} so far. A whole row, column or diagonal is a line.` : 'Tap a name to mark it, and again to take the mark away.',
          )
        )}
      </p>
      <div className="duel-actions">
        <button type="button" className="btn" onClick={clear} disabled={!marks.length}>
          <Eraser size={16} aria-hidden="true" />
          {L('Borrar las marcas', 'Clear the marks')}
        </button>
        <button type="button" className="btn btn-ghost" onClick={another}>
          <Shuffle size={16} aria-hidden="true" />
          {L('Otro cartón', 'Another card')}
        </button>
      </div>
      <p className="duel-rules">
        {L(
          'El cartón no sabe lo que ha salido: lo marcas tú, y quien dirige la partida lo comprueba con tu número. Vale para todas las partidas de este mapa; para la siguiente, borra las marcas.',
          'The card does not know what has come up: you mark it, and whoever runs the game checks it with your number. It is good for every game on this map; for the next one, clear the marks.',
        )}
      </p>
    </div>
  );
}

/** Millimetres of the paper as pixels of the screen, and the width of a sheet with its margins. */
const PX = 96 / 25.4;
const PAPER_W = 186 + 12 * 2;

/** A sheet of cards to print and cut out: six to a page, each with its number. */
function Sheet({ from, to, bingo, ids, nameOf, title }: CardProps & { from: number; to: number }) {
  const { size } = bingo;
  const wrap = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(1);
  const [count, setCount] = useState(String(to - from + 1));
  const pages = useMemo(() => {
    const all = Array.from({ length: to - from + 1 }, (_, i) => from + i);
    return Array.from({ length: Math.ceil(all.length / PER_PAGE) }, (_, p) => all.slice(p * PER_PAGE, (p + 1) * PER_PAGE));
  }, [from, to]);

  // The sheet is drawn at its real size and shrunk to the room there is: what is seen is what comes out.
  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const measure = () => setFit(Math.min(1, el.clientWidth / (PAPER_W * PX)));
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // The page takes the name of the sheet: it is what a browser offers to call the PDF.
  useEffect(() => {
    const before = document.title;
    document.title = L(`Bingo — ${title} — cartones ${from} a ${to}`, `Bingo — ${title} — cards ${from} to ${to}`);
    return () => {
      document.title = before;
    };
  }, [title, from, to]);
  // Nothing but the cards goes to the printer (see the print rules in bingo.css).
  useEffect(() => {
    document.documentElement.classList.add('bingo-print');
    return () => document.documentElement.classList.remove('bingo-print');
  }, []);

  const change = (e: FormEvent) => {
    e.preventDefault();
    const n = Math.min(SHEET_MAX, Math.max(1, Math.floor(Number(count)) || 0));
    if (n) go(bingoPath(`${from}-${Math.min(CARD_MAX, from + n - 1)}`, bingo.key));
  };
  /** The cards that follow these, as many again, up to the last number a card can have. */
  const next = to + 1;
  const nextTo = Math.min(CARD_MAX, to + (to - from + 1));
  const sheets = pages.length;

  return (
    <div className="bingo-sheet">
      <div className="duel-page bingo-tools">
        <p className="kicker">Bingo · {title}</p>
        <h1>{from === to ? L(`Cartón ${from}`, `Card ${from}`) : L(`Cartones del ${from} al ${to}`, `Cards ${from} to ${to}`)}</h1>
        <p className="lead">
          {L(
            `De ${size} × ${size}, ${PER_PAGE} por hoja: ${sheets === 1 ? '1 hoja' : `${sheets} hojas`}. Se recortan por las líneas de puntos y valen para todas las partidas de este mapa, salgan como salgan las piezas.`,
            `${size} × ${size}, ${PER_PAGE} to a sheet: ${sheets === 1 ? '1 sheet' : `${sheets} sheets`}. They are cut out along the dotted lines and are good for every game on this map, however the pieces come up.`,
          )}
        </p>
        <div className="duel-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => window.print()}>
            <Printer size={18} aria-hidden="true" />
            {L('Imprimir', 'Print')}
          </button>
          <form onSubmit={change}>
            <label className="bingo-count">
              <span>{L('Cuántos', 'How many')}</span>
              <input type="number" inputMode="numeric" min={1} max={SHEET_MAX} value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <button type="submit" className="btn btn-sm">
              {L('Cambiar', 'Change')}
            </button>
          </form>
          {next <= CARD_MAX && (
            <a className="btn btn-ghost" href={`#/${bingoPath(`${next}-${nextTo}`, bingo.key)}`}>
              {L(`Los siguientes: del ${next} al ${nextTo}`, `The next ones: ${next} to ${nextTo}`)}
            </a>
          )}
        </div>
        <p className="duel-rules">{L('En el cuadro de impresión puedes guardarlos como PDF. Como mucho, 60 cartones cada vez.', 'In the print dialog you can save them as a PDF. Up to 60 cards at a time.')}</p>
      </div>
      <div className="bingo-papers" ref={wrap} style={{ '--fit': fit } as CSSProperties}>
        {/* The margins of the paper: the cards are worked out for what is left inside them. */}
        <style>{'@page { size: portrait; margin: 12mm; }'}</style>
        {pages.map((page) => (
          <article key={page[0]} className="bingo-paper">
            {page.map((n) => (
              <section key={n} className="bingo-slip">
                <header>
                  <b>{title}</b>
                  <span>{L(`Cartón ${n}`, `Card ${n}`)}</span>
                </header>
                <BingoCard names={cardOf(ids, size, n).map(nameOf)} size={size} label={L(`Cartón ${n}`, `Card ${n}`)} />
                <footer>Regionle ∞ · Bingo</footer>
              </section>
            ))}
          </article>
        ))}
      </div>
    </div>
  );
}

export function Bingo({ rest, world }: { rest: string; world: World }) {
  const bingo = useMemo(() => (rest ? parseBingo(rest) : null), [rest]);
  const game = useMemo(() => (bingo ? bingoGame(bingo.what, world) : null), [bingo, world]);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const own = bingo?.who.kind === 'own';

  // A card for whoever opens the address: this device gives itself a number, the same one every time it
  // comes back, and the address becomes that of its card.
  useLayoutEffect(() => {
    if (!bingo || !own || !game) return;
    let n = ownOf(bingo.key);
    if (n == null) {
      n = ownCard();
      keepOwn(bingo.key, n);
    }
    settle(bingoPath(n, bingo.key));
  }, [bingo, own, game]);

  useEffect(() => {
    if (!game || own) return;
    let alive = true;
    setFailed(false);
    deckFor({ ...game.cfg, nonce: 0 })
      .then((d) => alive && setDeck(d))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [game, own, attempt]);

  const pool = useMemo(() => (deck && game ? poolOf(deck.items, game.cfg.only) : null), [deck, game]);
  const ids = useMemo(() => pool?.map((it) => it.id) ?? [], [pool]);

  if (!rest) return <BingoHow />;
  if (!bingo || !game) {
    return <Broken title={L('Este enlace no lleva a ningún cartón', 'This link leads to no card')} text={L('Le falta algo, o nombra un mapa que el juego no tiene. Pide el enlace otra vez a quien dirige la partida.', 'Something is missing from it, or it names a map the game does not have. Ask whoever runs the game for the link again.')} />;
  }
  if (failed) {
    return <Broken title={L('No se ha podido cargar el mapa', 'The map could not be loaded')} text={L('Comprueba la conexión y vuelve a intentarlo.', 'Check your connection and try again.')} retry={() => setAttempt((n) => n + 1)} />;
  }
  if (!deck || !pool || own) return <Spinner label={L('Repartiendo el cartón…', 'Dealing the card…')} />;
  if (sizeFor(ids.length, bingo.size) !== bingo.size) {
    return (
      <Broken
        title={L('Este mapa no da para estos cartones', 'This map cannot give these cards')}
        text={L('Tiene muy pocas piezas para un cartón de este tamaño. Pide el enlace otra vez a quien dirige la partida.', 'It has too few pieces for a card of this size. Ask whoever runs the game for the link again.')}
      />
    );
  }
  const props: CardProps = { bingo, ids, nameOf: (id) => deck.byId.get(id)?.name ?? id, title: game.title };
  return bingo.who.kind === 'sheet' ? <Sheet from={bingo.who.from} to={bingo.who.to} {...props} /> : bingo.who.kind === 'card' ? <OneCard n={bingo.who.n} {...props} /> : null;
}
