/**
 * The screen that calls a bingo (lib/bingo.ts): the one a whole class looks at. Before the first piece, how
 * the game is played and the cards to hand out; from then on, the piece that has come out, the button for
 * the next one, and the box where a card is checked by its number.
 */
import { Check, Copy, Eye, Printer, RotateCcw, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { BingoCard } from '../components/BingoCard';
import { MapView, type MapHandle, type Paint } from '../components/MapView';
import { QrButton } from '../components/QrButton';
import { Flag, Seg } from '../components/ui';
import {
  BINGO_MIN,
  BINGO_SIZE_DEFAULT,
  CARD_MAX,
  SHEET_DEFAULT,
  SHEET_MAX,
  bingoKey,
  bingoPath,
  bingoUrl,
  callOf,
  callable,
  cardOf,
  drawNext,
  gapsOf,
  howName,
  howsOf,
  judge,
  mapPathOf,
  poolOf,
  sizeFor,
  sizesOf,
  sourceOf,
  verdictText,
  type BingoHow,
  type BingoSize,
} from '../lib/bingo';
import { drawOf, keepDraw, lastSet } from '../lib/bingoKept';
import { silhouette } from '../lib/geo';
import { L } from '../lib/i18n';
import { MODE_NAME } from '../lib/modes';
import { cx, nf } from '../lib/text';
import { GameShell, type GameProps } from './common';

/** What each way of calling the pieces asks of the players, said to whoever sets the game up. */
function howHint(how: BingoHow): string {
  switch (how) {
    case 'flag':
      return L('Sale la bandera de cada país, sin su nombre ni su sitio en el mapa.', 'The flag of each country comes up, without its name or its place on the map.');
    case 'capital':
      return L('Sale el nombre de la capital: hay que saber de dónde lo es.', 'The name of the capital comes up: the players have to know what it is the capital of.');
    case 'outline':
      return L('Sale la silueta de cada pieza, sola, sin el mapa alrededor.', 'The outline of each piece comes up, alone, without the map around it.');
    case 'name':
      return L('Sale el nombre, y la pieza se ilumina en el mapa: no hay que saber nada, solo encontrarlo en el cartón. Para empezar, o para los más pequeños.', 'The name comes up, and the piece lights up on the map: nothing to know, only to find it on the card. To begin with, or for the youngest.');
    default:
      return L('Cada pieza se ilumina en el mapa, sin su nombre: hay que reconocerla por dónde está.', 'Each piece lights up on the map, without its name: the players have to tell it by where it is.');
  }
}

export function BingoGame({ deck, cfg, onExit }: GameProps) {
  const source = useMemo(() => sourceOf(cfg), [cfg]);
  /** The map, as the address of its cards writes it: the game is kept under it. */
  const where = useMemo(() => mapPathOf(source), [source]);
  /** What the game is of, as its cards say it: the name of the list where it has one, the map otherwise. */
  const what = cfg.list ?? deck.title;
  /** The pieces of the game: the cards are dealt from them, and they are what comes out. */
  const pool = useMemo(() => poolOf(deck.items, cfg.only), [deck, cfg.only]);
  const ids = useMemo(() => pool.map((it) => it.id), [pool]);
  const hows = useMemo(() => howsOf(pool), [pool]);
  /** How this screen opens: with the game that was left half way on this map, or set up as the last one was. */
  const [first] = useState(() => {
    const game = drawOf(where);
    const set = game ?? lastSet();
    return { how: set && hows.includes(set.how) ? set.how : 'map', size: set?.size ?? BINGO_SIZE_DEFAULT, out: game?.out ?? [], shown: game?.shown ?? false };
  });
  const [how, setHow] = useState<BingoHow>(first.how);
  const [wanted, setWanted] = useState<BingoSize>(first.size);
  const size = sizeFor(ids.length, wanted);
  const [out, setOut] = useState<string[]>(() => {
    const all = new Set(ids);
    return first.out.filter((id) => all.has(id));
  });
  /** Whether the name of the piece that has come out has been asked for. */
  const [shown, setShown] = useState(first.shown);
  /** The number typed in the box of the checks, the card that was checked last, and whether what was typed is no number of a card. */
  const [typed, setTyped] = useState('');
  const [checked, setChecked] = useState<number | null>(null);
  const [wrong, setWrong] = useState(false);
  const [sheets, setSheets] = useState(String(SHEET_DEFAULT));
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [asking, setAsking] = useState(false);
  const map = useRef<MapHandle>(null);
  const main = useRef<HTMLButtonElement>(null);
  const saidBox = useRef<HTMLDivElement>(null);

  const playing = out.length > 0;
  const cur = playing ? (deck.byId.get(out[out.length - 1]) ?? null) : null;
  /** How the piece in hand is called: the way that was chosen, or by its name where it cannot be called that way. */
  const way: BingoHow = cur && !callable(cur, how) ? 'name' : how;
  /** Its name is in sight: it is how it was called, or it has been asked for. */
  const named = way === 'name' || shown;
  /** It is seen on the map: from the start where that is how it is called, and once its name is in sight. */
  const lit = way === 'map' || named;

  useEffect(() => {
    if (size) keepDraw(where, { how, size, out, shown });
  }, [where, how, size, out, shown]);

  const curId = cur?.id;
  // Each piece comes up on the whole map, however small it is: where it lies among the others is what tells
  // it, and a map that came close to it would show a class a stretch of coast and nothing else.
  useEffect(() => {
    map.current?.reset();
  }, [curId]);

  const key = size ? bingoKey(size, source) : '';
  const url = bingoUrl('-', key);
  // Other cards are another link: what was said of the last one no longer holds.
  useEffect(() => setCopied('idle'), [url]);

  const paint = useMemo(() => {
    const p: Record<string, Paint> = {};
    for (const id of out) p[id] = 'ok';
    if (curId) {
      if (lit) p[curId] = 'target';
      // Called by its flag, its capital or its outline, it is not given away by a colour.
      else delete p[curId];
    }
    return p;
  }, [out, curId, lit]);
  const pinned = useMemo(() => (curId && named ? new Set([curId]) : undefined), [curId, named]);
  const outline = useMemo(() => (way === 'outline' && cur && !named ? silhouette(cur.geo, 400, 0.08) : ''), [way, cur, named]);
  const verdict = useMemo(() => {
    if (checked == null || !size) return null;
    const card = cardOf(ids, size, checked);
    return { card, v: judge(card, new Set(out), size) };
  }, [checked, ids, size, out]);

  // Handy when debugging from the browser console; removed from production builds.
  if (import.meta.env.DEV) (window as unknown as { __ask?: string }).__ask = curId;

  const title = MODE_NAME.bingo;
  const many = deck.noun.many;

  if (!size) {
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        panel={
          <div className="q">
            <div className="q-prompt">
              <p className="kicker">{L('Vaya', 'Oops')}</p>
              <h2 className="q-ask">{L('Pocas piezas para un bingo', 'Too few pieces for a bingo')}</h2>
            </div>
            <p className="q-note">
              {L(
                `El cartón más pequeño tiene 9 nombres, y para que no sean todos iguales hacen falta al menos ${BINGO_MIN} piezas. Aquí hay ${nf(ids.length)}: elige un mapa con más, o una lista más larga.`,
                `The smallest card has 9 names, and at least ${BINGO_MIN} pieces are needed for the cards not to be all alike. There are ${nf(ids.length)} here: choose a map with more, or a longer list.`,
              )}
            </p>
            <div className="q-actions">
              <button type="button" className="btn" onClick={onExit}>
                {L('Volver', 'Back')}
              </button>
            </div>
          </div>
        }
      />
    );
  }

  const left = ids.length - out.length;
  const draw = () => {
    const next = drawNext(ids, out);
    if (!next) return;
    setOut([...out, next]);
    setShown(false);
    setChecked(null);
    setAsking(false);
    // The button that draws is the one in hand all through the game, also after the first piece, which another
    // button drew; and what has come out is read from its top, wherever the panel had been taken to.
    requestAnimationFrame(() => {
      main.current?.focus({ preventScroll: true });
      main.current?.closest('.panel')?.scrollTo?.({ top: 0 });
    });
  };
  const again = () => {
    setOut([]);
    setShown(false);
    setChecked(null);
    setTyped('');
    setWrong(false);
    setAsking(false);
  };
  const check = (e: FormEvent) => {
    e.preventDefault();
    const n = /^\d{1,5}$/.test(typed.trim()) ? Number(typed) : 0;
    setWrong(n < 1 || n > CARD_MAX);
    setChecked(n >= 1 && n <= CARD_MAX ? n : null);
    // What it says is brought into sight: on a phone the panel is short, and it would stay under its edge.
    requestAnimationFrame(() => saidBox.current?.scrollIntoView?.({ block: 'nearest' }));
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('copied');
    } catch {
      setCopied('failed');
    }
  };
  /** How many cards go to paper: what the box says, within what a sheet takes. */
  const count = Math.min(SHEET_MAX, Math.max(1, Math.floor(Number(sheets)) || SHEET_DEFAULT));

  const stage = (
    <>
      <MapView ref={map} deck={deck} paint={paint} pinned={pinned} tip={(id) => (out.includes(id) && (id !== curId || named) ? deck.byId.get(id)?.name : null)} />
      {outline && (
        <div className="outline-stage">
          <svg viewBox="0 0 400 400" role="img" aria-label={L('Silueta de la pieza que ha salido', 'Outline of the piece that has come out')}>
            <path d={outline} />
          </svg>
        </div>
      )}
    </>
  );

  /** The cards of this game: the link for the phones, and the sheet for the printer. */
  const deal = (
    <section className="bingo-deal" aria-labelledby="bingo-deal">
      <h3 id="bingo-deal">{playing ? L('Los cartones de esta partida', 'The cards of this game') : L('Reparte los cartones', 'Hand out the cards')}</h3>
      <div className="bingo-way">
        <p>
          <b>{L('En el móvil.', 'On a phone.')}</b> {L('Cada cual abre este enlace, o apunta al código QR, y recibe un cartón distinto, con su número.', 'Each one opens this link, or points at the QR code, and gets a different card, with its number.')}
        </p>
        <div className="bingo-btns">
          <button type="button" className="btn btn-sm" onClick={copy}>
            {copied === 'copied' ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
            {copied === 'copied' ? L('Enlace copiado', 'Link copied') : L('Copiar el enlace', 'Copy the link')}
          </button>
          <QrButton small url={url} what={`Bingo: ${what}`} />
        </div>
        {copied === 'failed' && (
          <textarea className="duel-link" readOnly rows={2} value={url} aria-label={L('Enlace de los cartones', 'Link to the cards')} onFocus={(e) => e.currentTarget.select()} />
        )}
      </div>
      <div className="bingo-way">
        <p>
          <b>{L('En papel.', 'On paper.')}</b> {L('Seis cartones por hoja, numerados desde el 1, para recortar.', 'Six cards to a sheet, numbered from 1, to cut out.')}
        </p>
        <div className="bingo-btns">
          <label className="bingo-count">
            <span>{L('Cuántos', 'How many')}</span>
            <input type="number" inputMode="numeric" min={1} max={SHEET_MAX} value={sheets} onChange={(e) => setSheets(e.target.value)} />
          </label>
          <a className="btn btn-sm" href={`#/${bingoPath(`1-${count}`, key)}`} target="_blank" rel="noopener">
            <Printer size={15} aria-hidden="true" />
            {L('Imprimir cartones', 'Print cards')}
          </a>
        </div>
      </div>
      <p className="bingo-small">
        {playing
          ? L('Valen para todas las partidas de este mapa, salgan como salgan las piezas: no hace falta repartirlos otra vez.', 'They are good for every game on this map, however the pieces come up: there is no need to hand them out again.')
          : L('Los cartones son de este mapa y de este tamaño: si cambias el tamaño, son otros. Valen para todas las partidas, salgan como salgan las piezas.', 'The cards are of this map and of this size: change the size, and they are others. They are good for every game, however the pieces come up.')}
      </p>
    </section>
  );

  /** The choice of how the pieces come up: before the first one, and at any moment after it. */
  const gaps = gapsOf(pool, how);
  const ways = (
    <div className="opt">
      <span className="opt-label">{L('Cómo salen las piezas', 'How the pieces come up')}</span>
      <Seg<BingoHow> small label={L('Cómo salen las piezas', 'How the pieces come up')} value={how} onChange={setHow} options={hows.map((h) => ({ value: h, label: howName(h) }))} />
      <small className="opt-hint">
        {howHint(how)}
        {gaps > 0 && ` ${L(gaps === 1 ? 'Hay 1 pieza que no puede salir así: sale por su nombre.' : `Hay ${gaps} piezas que no pueden salir así: salen por su nombre.`, gaps === 1 ? '1 piece cannot come up this way: it comes up by its name.' : `${gaps} pieces cannot come up this way: they come up by their names.`)}`}
      </small>
    </div>
  );

  if (!playing) {
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        stage={stage}
        panel={
          <div className="q bingo">
            <div className="q-prompt">
              <p className="kicker">{L('Para jugar en grupo', 'To play in a group')}</p>
              <h2 className="q-ask">{L('Prepara la partida', 'Set up the game')}</h2>
              <p className="q-sub">
                {L(
                  'Esta pantalla va sacando piezas del mapa, una a una. Cada jugador marca en su cartón las que tenga; quien complete una línea o el cartón entero lo canta, y aquí se comprueba con el número de su cartón.',
                  'This screen calls pieces of the map, one by one. Each player marks on a card the ones they have; whoever completes a line or the whole card calls it, and it is checked here with the number of the card.',
                )}
              </p>
            </div>

            <div className="options">
              {ways}
              <div className="opt">
                <span className="opt-label">{L('Tamaño del cartón', 'Size of the card')}</span>
                <Seg<BingoSize> small label={L('Tamaño del cartón', 'Size of the card')} value={size} onChange={setWanted} options={sizesOf(ids.length).map((s) => ({ value: s, label: `${s} × ${s}` }))} />
                <small className="opt-hint">
                  {L(`Cada cartón lleva ${size * size} de ${ids.length === 1 ? 'la' : `${deck.noun.fem ? 'las' : 'los'} ${nf(ids.length)}`} ${many} que pueden salir.`, `Each card has ${size * size} of the ${nf(ids.length)} ${many} that can come up.`)}
                </small>
              </div>
            </div>

            {deal}

            <div className="q-actions bingo-start">
              <button type="button" className="btn btn-primary" onClick={draw}>
                {L('Sacar la primera', 'Draw the first one')}
              </button>
            </div>
          </div>
        }
      />
    );
  }
  if (!cur) return null;

  const fem = deck.noun.fem;
  const one = deck.noun.one;
  /** What has come out, as the class is given it. */
  const call =
    way === 'flag' ? (
      <>
        <span className="q-flagbox">
          <Flag code={cur.country.fl} size="xl" className="q-flag" />
        </span>
        <p className="q-sub">{L('Quien tenga el país de esta bandera, lo marca.', 'Whoever has the country of this flag marks it.')}</p>
      </>
    ) : way === 'capital' ? (
      <>
        <p className="bingo-lead">{L('Su capital es', 'Its capital is')}</p>
        <h2 className="q-name">{cur.capital?.[0]}</h2>
      </>
    ) : way === 'outline' ? (
      <h2 className="q-ask">
        {L(`${fem ? 'La' : 'El'} ${one} que tiene esta silueta`, `The ${one} with this outline`)}
        <small>{L('Quien tenga su nombre, lo marca.', 'Whoever has its name marks it.')}</small>
      </h2>
    ) : way === 'name' ? (
      <h2 className="q-name">{cur.name}</h2>
    ) : (
      <h2 className="q-ask">
        {L(`${fem ? 'La' : 'El'} ${one} que está ${fem ? 'iluminada' : 'iluminado'} en el mapa`, `The ${one} lit up on the map`)}
        <small>{L('Quien tenga su nombre, lo marca.', 'Whoever has its name marks it.')}</small>
      </h2>
    );
  const said = verdict ? callOf(verdict.v) : 'none';

  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={out.length / ids.length}
      stage={stage}
      panel={
        <div className="q bingo">
          <div className="q-prompt">
            <p className="kicker">{L(`Pieza ${out.length} de ${ids.length}`, `Piece ${out.length} of ${ids.length}`)}</p>
            {call}
          </div>
          {way !== 'name' && (
            <p className="bingo-name" role="status">
              {shown ? cur.name : ''}
            </p>
          )}

          <div className="q-actions">
            <button ref={main} type="button" className="btn btn-primary" onClick={draw} disabled={left === 0}>
              {left === 0 ? L('Han salido todas', 'They have all come up') : L('Sacar otra', 'Draw another')}
            </button>
            {!named && (
              <button type="button" className="btn" onClick={() => setShown(true)}>
                <Eye size={16} aria-hidden="true" />
                {L('Ver el nombre', 'Show the name')}
              </button>
            )}
          </div>

          <form className="bingo-check" onSubmit={check} noValidate>
            <label htmlFor="bingo-n">{L('¿Alguien canta línea o bingo? Escribe el número de su cartón', 'Someone calls a line or bingo? Type the number of their card')}</label>
            <div className="bingo-btns">
              <input id="bingo-n" type="text" inputMode="numeric" autoComplete="off" maxLength={5} value={typed} placeholder={L('N.º', 'No.')} aria-invalid={wrong || undefined} aria-describedby="bingo-said" onChange={(e) => setTyped(e.target.value)} />
              <button type="submit" className="btn btn-sm">
                <Search size={15} aria-hidden="true" />
                {L('Comprobar', 'Check')}
              </button>
            </div>
          </form>
          <div id="bingo-said" ref={saidBox} className={cx('bingo-said', verdict && `is-${said}`)} role="status">
            {wrong && <p>{L(`El número de un cartón va del 1 al ${CARD_MAX}.`, `The number of a card goes from 1 to ${CARD_MAX}.`)}</p>}
            {verdict && checked != null && (
              <>
                <strong>{said === 'bingo' ? L('¡Bingo!', 'Bingo!') : said === 'line' ? L('¡Línea!', 'Line!') : L('Todavía no', 'Not yet')}</strong>
                <p>{verdictText(verdict.v, size, checked)}</p>
                <BingoCard
                  names={verdict.card.map((id) => deck.byId.get(id)?.name ?? id)}
                  size={size}
                  label={L(`Cartón ${checked}: marcado, lo que ha salido`, `Card ${checked}: marked, what has come up`)}
                  marked={verdict.v.marked}
                  lines={verdict.v.lines}
                />
                <p className="bingo-small">{L('¿No es su cartón? Entonces el número no es ese, o su cartón es de otro mapa o de otro tamaño.', 'Not their card? Then that is not the number, or the card is of another map or another size.')}</p>
              </>
            )}
          </div>

          <details className="bingo-out">
            <summary>{L(out.length === 1 ? 'Ha salido 1: ver cuál' : `Han salido ${out.length}: ver cuáles`, out.length === 1 ? '1 has come up: see which' : `${out.length} have come up: see which`)}</summary>
            <ol reversed>
              {[...out].reverse().map((id, i) => (
                // The one in hand is not named here before its name is asked for.
                <li key={id}>{i === 0 && !named ? '…' : (deck.byId.get(id)?.name ?? id)}</li>
              ))}
            </ol>
          </details>

          <details className="bingo-more">
            <summary>{L('Cómo salen, cartones y partida nueva', 'How they come up, cards and a new game')}</summary>
            {ways}
            {deal}
            <div className="bingo-btns">
              {asking ? (
                <span className="confirm">
                  {L('¿Empezar otra partida? Se borra lo que ha salido.', 'Start another game? What has come up is cleared.')}
                  <button type="button" className="btn btn-sm btn-danger" onClick={again}>
                    {L('Sí, empezar', 'Yes, start')}
                  </button>
                  <button type="button" className="btn btn-sm" onClick={() => setAsking(false)}>
                    No
                  </button>
                </span>
              ) : (
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setAsking(true)}>
                  <RotateCcw size={15} aria-hidden="true" />
                  {L('Empezar de nuevo', 'Start again')}
                </button>
              )}
            </div>
          </details>
        </div>
      }
    />
  );
}
