/**
 * Pairs: a table of cards face down, two for each country, turned two at a time. A game with no map, in a
 * file of its own that is fetched when it is played. What is dealt and what a turn does is in lib/pairs.ts.
 */
import { Earth, Flag as FlagIcon, Landmark } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { BASE, Flag } from '../components/ui';
import { L, nm } from '../lib/i18n';
import { modeNameIn } from '../lib/modes';
import { PAIR_FACES, canTurn, hidePair, newPairs, pairCount, pairTally, pairsDone, pairsKey, softened, turnCard, type PairCard, type PairFace, type PairGame } from '../lib/pairs';
import { PAIR_SIZES, PAIR_SIZE_DEFAULT, type PairOf } from '../lib/rules';
import { useStore, type GameConfig } from '../lib/store';
import { cx, nf } from '../lib/text';
import type { Country } from '../lib/types';
import { GameShell, Hud, Results, useElapsed } from './common';
import { guessWidth, useWidest } from './useWidest';
import './pairs.css';

/** How long two cards that do not match stay in sight, unless another is turned first. */
export const LOOK_MS = 1500;
/** The last pair is left in sight this long before the result takes its place. */
const END_MS = 900;

/** What was said about the last turn. */
type Said = { pair: string } | { no: 'new' | 'half' | 'seen' } | null;

/** How many cards go in a row where there is room for them: a table as square as the cards allow. */
const columnsFor = (cards: number): number => (cards <= 6 ? 3 : cards <= 16 ? 4 : cards <= 20 ? 5 : 6);

/** What a card is, as its back says it: «una bandera», «un nombre». */
const kindOf = (face: PairFace): string =>
  face === 'flag' ? L('una bandera', 'a flag') : face === 'capital' ? L('una capital', 'a capital') : face === 'country' ? L('un país', 'a country') : L('un nombre', 'a name');

export function PairsGame({ countries, cfg, onExit }: { countries: Country[]; cfg: GameConfig; onExit(): void }) {
  const title = modeNameIn(cfg.section, 'pairs');
  const what = `${nf(countries.length)} ${L('países', 'countries')}`;
  const of: PairOf = cfg.opts.pairOf === 'capital' ? 'capital' : 'flag';
  const size = (PAIR_SIZES as readonly number[]).includes(cfg.opts.pairs) ? cfg.opts.pairs : PAIR_SIZE_DEFAULT;
  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const [game, setGame] = useState<PairGame>(() => newPairs(countries, of, size));
  const [said, setSaid] = useState<Said>(null);
  const [ended, setEnded] = useState(false);
  /** The fewest turns of a table like this one before this game, and whether this game beat them. */
  const [mark, setMark] = useState<{ before: number | null; beaten: boolean } | null>(null);
  const addSession = useStore((s) => s.addSession);
  const setBest = useStore((s) => s.setBest);
  const ms = useElapsed(!ended);
  const pairs = pairCount(game);
  const done = pairsDone(game);

  const finish = () => {
    const { ok, bad } = pairTally(game);
    if (ok + bad > 0) addSession({ t: Date.now(), section: cfg.section, mode: cfg.mode, label: what, total: ok + bad, ok, warn: 0, bad, ms });
    if (done) {
      const key = pairsKey(of, pairs);
      const before = useStore.getState().best[key] ?? null;
      setMark({ before, beaten: setBest(key, game.turns, true) });
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

  const cols = columnsFor(game.cards.length);
  const name = (id: string): string => {
    const c = byId.get(id);
    return c ? nm(c.n) : id;
  };
  const capital = (id: string): string => {
    const c = byId.get(id);
    return c?.cap ? nm(c.cap) : '';
  };
  /** What each card says, with a place to be cut in its longest words. */
  const texts = useMemo(() => game.cards.map((card) => softened(card.face === 'capital' ? capital(card.country) : name(card.country))), [game.cards, byId]); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useRef<HTMLDivElement>(null);
  const widths = useWidest(texts, table, 'pair-text pair-probe');
  /** What a card says to someone who cannot see it: while it is face down, what its back says and no more. */
  const spoken = (card: PairCard, i: number, shown: boolean, found: boolean): string => {
    if (!shown) return L(`Carta ${i + 1}, ${kindOf(card.face)}, boca abajo`, `Card ${i + 1}, ${kindOf(card.face)}, face down`);
    const paired = found ? L(', emparejada', ', paired') : '';
    if (card.face === 'flag') return found ? L(`Bandera de ${name(card.country)}${paired}`, `Flag of ${name(card.country)}${paired}`) : L(`Carta ${i + 1}: una bandera, boca arriba`, `Card ${i + 1}: a flag, face up`);
    if (card.face === 'capital') return L(`${capital(card.country)}, capital${paired}`, `${capital(card.country)}, a capital${paired}`);
    return `${name(card.country)}${paired}`;
  };

  if (ended) {
    const { ok, bad } = pairTally(game);
    const left = game.cards.map((c) => c.country).filter((id, i, all) => all.indexOf(id) === i && !game.found.includes(id));
    return (
      <GameShell
        title={title}
        subtitle={what}
        onExit={onExit}
        hud={<Hud ms={ms} />}
        panel={
          <div className="pop">
            <Results
              title={!done ? L('Partida terminada', 'Game over') : bad === 0 ? L('¡Todas a la primera!', 'All of them first time!') : L('¡Todas las parejas!', 'All the pairs!')}
              rows={[]}
              counts={{ ok, warn: 0, bad }}
              ms={ms}
              stats={[
                { label: L('Intentos', 'Turns'), value: nf(game.turns) },
                ...(mark ? [{ label: L('Récord', 'Best'), value: mark.beaten ? L('¡Nuevo!', 'New!') : nf(mark.before ?? game.turns) }] : []),
              ]}
              note={
                bad > 0
                  ? L(
                      `${bad === 1 ? 'Una pareja te costó' : `${nf(bad)} parejas te costaron`} un intento de más: ya habías visto dónde estaba su otra mitad, o la juntaste con una carta que ya conocías.`,
                      `${bad === 1 ? 'One pair took' : `${nf(bad)} pairs took`} you a turn too many: you had already seen where its other half was, or you put it with a card you already knew.`,
                    )
                  : undefined
              }
              onAgain={() => {
                setGame(newPairs(countries, of, size));
                setSaid(null);
                setMark(null);
                setEnded(false);
              }}
              onExit={onExit}
            >
              {pairs > 0 && (
                <section className="tf-review pair-list">
                  <h3>{L('Las parejas', 'The pairs')}</h3>
                  <ul>
                    {[...game.found, ...left].map((id) => {
                      const c = byId.get(id);
                      const missed = game.missed.includes(id);
                      const found = game.found.includes(id);
                      return (
                        <li key={id} className={cx(!found && 'left', found && missed && 'missed')}>
                          <Flag code={c?.fl} size="sm" />
                          <b>{name(id)}</b>
                          {of === 'capital' && <span>{L(`capital: ${capital(id)}`, `capital: ${capital(id)}`)}</span>}
                          {!found ? <small>{L('sin encontrar', 'not found')}</small> : missed ? <small>{L('con un intento de más', 'with a turn too many')}</small> : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </Results>
          </div>
        }
      />
    );
  }

  const lead =
    of === 'capital'
      ? L('Levanta una capital y un país: si la capital es de ese país, son pareja.', 'Turn over a capital and a country: if the capital is that of the country, they are a pair.')
      : L('Levanta una bandera y un nombre: si la bandera es de ese país, son pareja.', 'Turn over a flag and a name: if the flag is that of the country, they are a pair.');
  /** With one card up, the other has to be of the other kind: the rest wait. */
  const first = game.up.length === 1 ? game.cards[game.up[0]].face : null;
  const line = !said
    ? lead
    : 'pair' in said
      ? of === 'capital'
        ? L(`¡Pareja! ${capital(said.pair)} es la capital de ${name(said.pair)}.`, `A pair! ${capital(said.pair)} is the capital of ${name(said.pair)}.`)
        : L(`¡Pareja! Es la bandera de ${name(said.pair)}.`, `A pair! It is the flag of ${name(said.pair)}.`)
      : said.no === 'half'
        ? L('No son pareja, y la otra mitad de la primera ya había salido: cuenta como fallo.', 'Not a pair, and the other half of the first one had already come up: it counts as a miss.')
        : said.no === 'seen'
          ? L('No son pareja, y la segunda ya la habías visto: cuenta como fallo.', 'Not a pair, and you had already seen the second one: it counts as a miss.')
          : L('No son pareja.', 'Not a pair.');

  return (
    <GameShell
      title={title}
      subtitle={what}
      onExit={onExit}
      progress={pairs ? game.found.length / pairs : undefined}
      hud={<Hud ms={ms} progress={`${game.found.length} / ${pairs}`} />}
      panel={
        <div className="pop tf pair">
          <p className="kicker center">{of === 'capital' ? L('Cada capital, con su país', 'Each capital with its country') : L('Cada bandera, con su país', 'Each flag with its country')}</p>
          <div ref={table} className="pair-board" role="group" aria-label={L('Las cartas', 'The cards')} style={{ '--cols': cols, '--rows': Math.ceil(game.cards.length / cols) } as CSSProperties} onKeyDown={onKeys}>
            {game.cards.map((card, i) => {
              const found = game.found.includes(card.country);
              const up = game.up.includes(i);
              const shown = found || up;
              const c = byId.get(card.country);
              const text = texts[i];
              const waits = !shown && first === card.face;
              return (
                <button
                  key={i}
                  type="button"
                  className={cx('pair-card', `of-${card.face}`, card.face === PAIR_FACES[of][0] ? 'half-a' : 'half-b', shown && 'up', found && 'found', up && game.up.length === 2 && 'no', waits && 'waits')}
                  aria-label={spoken(card, i, shown, found)}
                  aria-disabled={found || waits || undefined}
                  onClick={() => turn(i)}
                >
                  {/* The back says which of the two the card is: a turn is one of each. */}
                  {!shown && (
                    <span className="pair-back" aria-hidden="true">
                      {card.face === 'flag' ? <FlagIcon /> : card.face === 'capital' ? <Landmark /> : card.face === 'country' ? <Earth /> : 'Aa'}
                    </span>
                  )}
                  {/* Always drawn, and hidden while the card is face down: every card is as large as its text needs from the start. */}
                  <span className="pair-face" aria-hidden="true">
                    {card.face === 'flag' ? (
                      <img className="pair-img" src={`${BASE}flags/${c?.fl}.svg`} alt="" draggable={false} />
                    ) : (
                      <>
                        {card.face === 'capital' && (
                          <small className="pair-kind">
                            <Landmark size={12} aria-hidden="true" />
                            {L('capital', 'capital')}
                          </small>
                        )}
                        {card.face === 'country' && <Flag code={c?.fl} size="sm" />}
                        <span className="pair-text" style={{ '--w': widths.get(text) ?? guessWidth(text) } as CSSProperties}>
                          {text}
                        </span>
                      </>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="q-note center pair-said" role="status">
            {line}
          </p>
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
