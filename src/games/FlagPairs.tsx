/**
 * «Parejas» of the section «Banderas»: a table of cards face down, two for each flag of a few of the set
 * (the flag and its name), turned two at a time. What a turn does and when it is a miss is what it is in
 * the «Parejas» of the countries (lib/pairs.ts); the table is drawn with its styles. The flags are those of
 * any set, so a card may show a flag of any shape, and a name may need what tells it from another: the
 * country of a capital, the years of a country that is no more.
 */
import { Flag as FlagIcon, Images, RotateCcw, Settings2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from 'react';
import { flagBestKey, flagGameDef, pairCards, type FlagPlay } from '../lib/flagGames';
import type { DeckCard } from '../lib/flagSets';
import { yearsText } from '../lib/flags';
import { L, nm } from '../lib/i18n';
import { canTurn, hidePair, pairCount, pairTally, pairsDone, softened, startPairs, turnCard, type PairCard, type PairGame } from '../lib/pairs';
import { PAIR_SIZE_DEFAULT } from '../lib/rules';
import { useStore } from '../lib/store';
import { cx, fmtTime, nf, shuffle } from '../lib/text';
import type { World } from '../lib/world';
import { Donut, GameShell, Hud, useElapsed } from './common';
import { guessWidth, useWidest } from './useWidest';
import './pairs.css';
import './flagPairs.css';

/** How long two cards that do not match stay in sight, unless another is turned first. */
export const LOOK_MS = 1500;
/** The last pair is left in sight this long before the result takes its place. */
const END_MS = 900;

/** What was said about the last turn. */
type Said = { pair: string } | { no: 'new' | 'half' | 'seen' } | null;

/** How many cards go in a row where there is room for them: a table as square as the cards allow. */
const columnsFor = (cards: number): number => (cards <= 6 ? 3 : cards <= 16 ? 4 : cards <= 20 ? 5 : 6);

/** A table: the flags that were dealt, by their key, and the cards on it. A card is of a flag by its key (`country`, as the cards of the countries say it). */
interface Table {
  flags: ReadonlyMap<string, DeckCard>;
  game: PairGame;
}

function deal(deck: readonly DeckCard[], pairs: number): Table {
  const dealt = pairCards(deck, pairs);
  const cards = shuffle(
    dealt.flatMap((card): PairCard[] => [
      { country: card.key, face: 'flag' },
      { country: card.key, face: 'name' },
    ]),
  );
  return { flags: new Map(dealt.map((card) => [card.key, card])), game: startPairs(cards) };
}

export function FlagPairs({ play, deck, name, world, onExit, onSee }: { play: FlagPlay; deck: readonly DeckCard[]; name: string; world: World; onExit(): void; onSee(): void }) {
  const def = flagGameDef(play.game);
  const size = typeof play.length === 'number' ? play.length : PAIR_SIZE_DEFAULT;
  const [table, setTable] = useState<Table>(() => deal(deck, size));
  const { flags, game } = table;
  const setGame = (to: PairGame | ((g: PairGame) => PairGame)) => setTable((t) => ({ ...t, game: typeof to === 'function' ? to(t.game) : to }));
  const [said, setSaid] = useState<Said>(null);
  const [ended, setEnded] = useState(false);
  /** The fewest turns of a table like this one before this game, and whether this game beat them. */
  const [mark, setMark] = useState<{ before: number | null; beaten: boolean } | null>(null);
  /** A flag has not come; and how many times they have been asked for again. */
  const [lost, setLost] = useState(false);
  const [fetched, setFetched] = useState(0);
  const ms = useElapsed(!ended);
  const pairs = pairCount(game);
  const done = pairsDone(game);

  const flag = (key: string): DeckCard | undefined => flags.get(key);
  const title = (key: string): string => flag(key)?.name ?? '';
  /** What tells a flag from another of the same name: the country of a capital, the years of a country that is no more. */
  const under = (key: string): string => {
    const card = flag(key);
    if (!card) return '';
    if (card.kind === 'capital') {
      const c = world.byId.get(card.country);
      return c ? nm(c.n) : '';
    }
    return card.kind === 'gone' ? yearsText(card.years) : '';
  };

  const finish = () => {
    if (ended) return;
    const { ok, bad } = pairTally(game);
    const st = useStore.getState();
    if (ok + bad > 0) st.addSession({ t: Date.now(), section: 'flags', mode: play.game, label: name, total: ok + bad, ok, warn: 0, bad, ms });
    // A mark is of a table that was finished: the fewest turns it took.
    if (done) {
      const key = flagBestKey(play);
      const before = st.best[key] ?? null;
      setMark({ before, beaten: st.setBest(key, game.turns, true) });
    }
    setEnded(true);
  };

  const turn = (i: number) => {
    if (ended || done || !canTurn(game, i)) return;
    const next = turnCard(game, i);
    setGame(next);
    if (next.found.length > game.found.length) setSaid({ pair: next.found[next.found.length - 1] });
    else if (next.up.length === 2) {
      // Why the turn counts, where it does: the other half of the first card was known, or the second card was.
      const first = next.up[0];
      const half = game.cards.findIndex((c, k) => k !== first && c.country === game.cards[first].country);
      setSaid({ no: game.seen.includes(half) ? 'half' : game.seen.includes(i) ? 'seen' : 'new' });
    } else setSaid(null);
  };

  // Two that do not match go back by themselves once they have been looked at.
  useEffect(() => {
    if (game.up.length !== 2 || ended) return;
    const t = setTimeout(() => setGame(hidePair), LOOK_MS);
    return () => clearTimeout(t);
  }, [game.up, ended]);

  // The last pair is seen before the result comes.
  useEffect(() => {
    if (!done || ended) return;
    const t = setTimeout(finish, END_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, ended]);

  /** The arrows go from card to card, as the cards lie on the table. */
  const onKeys = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const cards = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('.pair-card')];
    const at = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (at < 0) return;
    const row = cards.filter((c) => c.offsetTop === cards[0].offsetTop).length;
    const to = e.key === 'ArrowLeft' ? at - 1 : e.key === 'ArrowRight' ? at + 1 : e.key === 'ArrowUp' ? at - row : e.key === 'ArrowDown' ? at + row : e.key === 'Home' ? 0 : e.key === 'End' ? cards.length - 1 : -1;
    if (to < 0 || to >= cards.length || to === at) return;
    e.preventDefault();
    cards[to].focus();
  };

  // An arrow pressed with no card in hand takes the first one: the table is played from the keyboard without
  // looking for it with the tabulator.
  useEffect(() => {
    if (ended) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || !e.key.startsWith('Arrow')) return;
      const at = document.activeElement;
      if (at && at !== document.body && !(at instanceof HTMLElement && at.matches('main, [tabindex="-1"]'))) return;
      const first = document.querySelector<HTMLButtonElement>('.pair-card');
      if (!first) return;
      e.preventDefault();
      first.focus();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ended]);

  /** A flag that did not come is put out of sight: what a browser draws in its place says nothing. */
  const gone = (e: SyntheticEvent<HTMLImageElement>) => e.currentTarget.classList.add('lost');
  /** …and on the table it is said: its card cannot be told from another without it. */
  const missing = (e: SyntheticEvent<HTMLImageElement>) => {
    gone(e);
    setLost(true);
  };

  const cols = columnsFor(game.cards.length);
  /** What each card of a name says, with a place to be cut in its longest words. */
  const texts = useMemo(() => game.cards.map((card) => softened(flags.get(card.country)?.name ?? '')), [game.cards, flags]);
  const board = useRef<HTMLDivElement>(null);
  const widths = useWidest(texts, board, 'pair-text pair-probe');
  /** What a card says to someone who cannot see it: while it is face down, what its back says and no more. */
  const spoken = (card: PairCard, i: number, shown: boolean, found: boolean): string => {
    const kind = card.face === 'flag' ? L('una bandera', 'a flag') : L('un nombre', 'a name');
    if (!shown) return L(`Carta ${i + 1}, ${kind}, boca abajo`, `Card ${i + 1}, ${kind}, face down`);
    const paired = found ? L(', emparejada', ', paired') : '';
    if (card.face === 'flag') return found ? L(`Bandera de ${title(card.country)}${paired}`, `Flag of ${title(card.country)}${paired}`) : L(`Carta ${i + 1}: una bandera, boca arriba`, `Card ${i + 1}: a flag, face up`);
    return `${title(card.country)}${under(card.country) ? `, ${under(card.country)}` : ''}${paired}`;
  };
  const picture = (card: DeckCard | undefined, className: string, asked = false) =>
    card ? <img key={asked ? `${card.key} ${fetched}` : undefined} className={className} style={{ '--r': String(card.ratio) } as CSSProperties} src={card.small} alt="" decoding="async" draggable={false} onError={asked ? missing : gone} /> : null;

  if (ended) {
    const { ok, bad } = pairTally(game);
    const total = ok + bad;
    const left = game.cards.map((c) => c.country).filter((key, i, all) => all.indexOf(key) === i && !game.found.includes(key));
    return (
      <GameShell
        title={def.name}
        subtitle={name}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        panel={
          <div className="pop fq fp">
            <div className="results">
              <p className="kicker">{L('Resultado', 'Result')}</p>
              <h2 className="results-title">{!done ? L('Partida terminada', 'Game over') : bad === 0 ? L('¡Todas a la primera!', 'All of them first time!') : L('¡Todas las parejas!', 'All the pairs!')}</h2>
              {bad > 0 && (
                <p className="results-note">
                  {L(
                    `${bad === 1 ? 'Una pareja te costó' : `${nf(bad)} parejas te costaron`} un intento de más: ya habías visto dónde estaba su otra mitad, o la juntaste con una carta que ya conocías.`,
                    `${bad === 1 ? 'One pair took' : `${nf(bad)} pairs took`} you a turn too many: you had already seen where its other half was, or you put it with a card you already knew.`,
                  )}
                </p>
              )}
              <div className="results-score">
                <Donut ok={ok} warn={0} bad={bad} label={`${total ? Math.round((100 * ok) / total) : 0} %`} caption={`${nf(ok)} ${L('de', 'of')} ${nf(total)}`} />
                <dl className="results-stats">
                  <div>
                    <dt>{L('A la primera', 'First time')}</dt>
                    <dd className="c-ok">{nf(ok)}</dd>
                  </div>
                  <div>
                    <dt>{L('Con un intento de más', 'With a turn too many')}</dt>
                    <dd className="c-bad">{nf(bad)}</dd>
                  </div>
                  <div>
                    <dt>{L('Intentos', 'Turns')}</dt>
                    <dd>{nf(game.turns)}</dd>
                  </div>
                  <div>
                    <dt>{L('Tiempo', 'Time')}</dt>
                    <dd>{fmtTime(ms)}</dd>
                  </div>
                  {mark && (
                    <div>
                      <dt>{L('Tu marca', 'Your record')}</dt>
                      <dd className="fq-mark">
                        {mark.beaten
                          ? mark.before != null
                            ? L(`¡Nueva! Antes, ${nf(mark.before)} intentos`, `New! Before, ${nf(mark.before)} turns`)
                            : L(`${nf(game.turns)} intentos`, `${nf(game.turns)} turns`)
                          : L(`${nf(mark.before ?? game.turns)} intentos`, `${nf(mark.before ?? game.turns)} turns`)}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
              <div className="results-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  autoFocus
                  onClick={() => {
                    setTable(deal(deck, size));
                    setSaid(null);
                    setMark(null);
                    setLost(false);
                    setEnded(false);
                  }}
                >
                  <RotateCcw size={16} aria-hidden="true" />
                  {L('Otra vez', 'Again')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onExit}>
                  <Settings2 size={16} aria-hidden="true" />
                  {L('Cambiar de juego', 'Change game')}
                </button>
                <button type="button" className="btn btn-ghost" onClick={onSee}>
                  <Images size={16} aria-hidden="true" />
                  {L('Ver estas banderas', 'See these flags')}
                </button>
              </div>
              {(
                [
                  ['bad', L('Con un intento de más', 'With a turn too many'), game.found.filter((key) => game.missed.includes(key))],
                  ['warn', L('Sin encontrar', 'Not found'), left],
                  ['ok', L('A la primera', 'First time'), game.found.filter((key) => !game.missed.includes(key))],
                ] as const
              ).map(([res, label, keys]) =>
                keys.length ? (
                  <details key={res} className={cx('results-group', `g-${res}`)} open={res !== 'ok' || !bad}>
                    <summary>
                      <span className="dot" />
                      {label} <small>{nf(keys.length)}</small>
                    </summary>
                    <ul className="fq-list">
                      {keys.map((key) => (
                        <li key={key}>
                          <span className="fq-thumb">{picture(flag(key), '')}</span>
                          <span className="fq-row">
                            <b>{title(key)}</b>
                            {under(key) && <small>{under(key)}</small>}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </details>
                ) : null,
              )}
            </div>
          </div>
        }
      />
    );
  }

  const lead = L('Levanta una bandera y un nombre: si el nombre es el de esa bandera, son pareja.', 'Turn over a flag and a name: if the name is that of the flag, they are a pair.');
  /** With one card up, the other has to be of the other kind: the rest wait. */
  const first = game.up.length === 1 ? game.cards[game.up[0]].face : null;
  const line = !said
    ? lead
    : 'pair' in said
      ? L(`¡Pareja! Es la bandera de ${title(said.pair)}.`, `A pair! It is the flag of ${title(said.pair)}.`)
      : said.no === 'half'
        ? L('No son pareja, y la otra mitad de la primera ya había salido: cuenta como fallo.', 'Not a pair, and the other half of the first one had already come up: it counts as a miss.')
        : said.no === 'seen'
          ? L('No son pareja, y la segunda ya la habías visto: cuenta como fallo.', 'Not a pair, and you had already seen the second one: it counts as a miss.')
          : L('No son pareja.', 'Not a pair.');

  return (
    <GameShell
      title={def.name}
      subtitle={name}
      onExit={onExit}
      progress={pairs ? game.found.length / pairs : undefined}
      hud={<Hud ms={ms} progress={`${game.found.length} / ${pairs}`} />}
      panel={
        <div className="pop tf pair fp">
          <p className="kicker center">{L('Cada bandera, con su nombre', 'Each flag with its name')}</p>
          <div ref={board} className="pair-board" role="group" aria-label={L('Las cartas', 'The cards')} style={{ '--cols': cols, '--rows': Math.ceil(game.cards.length / cols) } as CSSProperties} onKeyDown={onKeys}>
            {game.cards.map((card, i) => {
              const found = game.found.includes(card.country);
              const up = game.up.includes(i);
              const shown = found || up;
              const text = texts[i];
              const waits = !shown && first === card.face;
              return (
                <button
                  key={i}
                  type="button"
                  className={cx('pair-card', `of-${card.face}`, card.face === 'flag' ? 'half-a' : 'half-b', shown && 'up', found && 'found', up && game.up.length === 2 && 'no', waits && 'waits')}
                  aria-label={spoken(card, i, shown, found)}
                  aria-disabled={found || waits || undefined}
                  onClick={() => turn(i)}
                >
                  {/* The back says which of the two the card is: a turn is one of each. */}
                  {!shown && (
                    <span className="pair-back" aria-hidden="true">
                      {card.face === 'flag' ? <FlagIcon /> : 'Aa'}
                    </span>
                  )}
                  {/* Always drawn, and hidden while the card is face down: every card is as large as its text needs from the start, and its flag is fetched. */}
                  <span className="pair-face" aria-hidden="true">
                    {card.face === 'flag' ? (
                      picture(flag(card.country), 'fp-img', true)
                    ) : (
                      <>
                        <span className="pair-text" style={{ '--w': widths.get(text) ?? guessWidth(text) } as CSSProperties}>
                          {text}
                        </span>
                        {under(card.country) && <small className="fp-under">{under(card.country)}</small>}
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {lost ? (
            <p className="fq-lost" role="alert">
              <span>{L('No se han podido cargar todas las banderas. Comprueba la conexión.', 'Not every flag could be loaded. Check your connection.')}</span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  setLost(false);
                  setFetched((n) => n + 1);
                }}
              >
                {L('Reintentar', 'Retry')}
              </button>
            </p>
          ) : (
            <p className="q-note center pair-said" role="status">
              {line}
            </p>
          )}
          <div className="q-actions center">
            <span className="pair-turns">
              {L('Intentos', 'Turns')}: <b>{nf(game.turns)}</b>
            </span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={finish}>
              <FlagIcon size={15} aria-hidden="true" />
              {L('Terminar', 'Finish')}
            </button>
          </div>
        </div>
      }
    />
  );
}
