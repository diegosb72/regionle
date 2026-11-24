/**
 * Where the games of the section «Banderas» are chosen: which flags to play with, which game, and how.
 * It is laid out as the screen of a section with a map (screens/Setup.tsx) and with its styles: what is
 * played with on one side, the game and its settings on the other, and the bar that starts it.
 *
 * `#/banderas` opens it as it was left; `#/banderas/juegos/regiones-ES`, with those flags chosen (it is
 * where the gallery sends whoever wants to play with what is on a page of it).
 */
import { ArrowRight, ChevronDown, Images, ListOrdered, Play, Trophy } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { HelpButton } from '../components/Help';
import { Seg, Spinner } from '../components/ui';
import { groupAt, loadAlike, nearCards, type AlikeFile } from '../lib/flagAlike';
import {
  CLIMB_LIVES,
  FLAG_GAMES,
  FLAG_LENGTHS,
  PAIR_SIZES,
  flagBestKey,
  flagGameDef,
  flagGameHelp,
  flagPlayOf,
  flagPlayPath,
  flagPlayText,
  questionCount,
  type FlagAnswer,
  type FlagExtra,
  type FlagLength,
  type FlagPlay,
  type PairSize,
} from '../lib/flagGames';
import { LAND_MIN, landCards, playsLand } from '../lib/flagLand';
import { oddGroups } from '../lib/flagOdd';
import { PAST_MIN, pastCards, pastPlace } from '../lib/flagPast';
import { FLAG_SET_MIN, alikePlace, deckOf, flagSetName, flagSetOf, galleryPage, loadSame, sameMap, sameSet, setMenu, type FlagSet, type SetChoice, type SetMenu } from '../lib/flagSets';
import { flagsRest, loadFlags, type FlagsFile } from '../lib/flags';
import { L, getLang } from '../lib/i18n';
import { go } from '../lib/router';
import { FLAGS_PATH } from '../lib/routes';
import { PAIR_SIZE_DEFAULT } from '../lib/rules';
import { SCREENS } from '../lib/seo';
import { useStore } from '../lib/store';
import { cx, nf } from '../lib/text';
import type { FlagGame } from '../lib/types';
import type { World } from '../lib/world';
import './flagGames.css';

/** How the kinds of flags are gathered on this screen. */
type Shelf = 'countries' | 'regions' | 'cities' | 'others';
const shelfOf = (set: FlagSet): Shelf => (set.kind === 'countries' || set.kind === 'territories' ? 'countries' : set.kind === 'regions' ? 'regions' : set.kind === 'cities' || set.kind === 'capitals' ? 'cities' : 'others');

/** How many flags of the chosen ones are shown, to see what is going to be played with. */
const PREVIEW = 24;

const levelName = (level: number): string => (level === 1 ? L('Fácil', 'Easy') : level === 2 ? L('Medio', 'Medium') : L('Difícil', 'Hard'));
const lengthName = (length: FlagLength): string => (length === 'all' ? L('Todas', 'All') : String(length));
const answerName = (answer: FlagAnswer): string => (answer === 'type' ? L('Escrita', 'Typed') : L('Opciones', 'Options'));

/** The first set of a shelf: what it opens with when nothing of it was chosen. */
function firstOf(shelf: Shelf, menu: SetMenu): FlagSet | null {
  const home = getLang() === 'en' ? 'US' : 'ES';
  if (shelf === 'countries') return (menu.countries[0] ?? menu.territories)?.set ?? null;
  if (shelf === 'regions') return (menu.regions.find((c) => c.country === home) ?? menu.regions[0])?.set ?? null;
  if (shelf === 'cities') return (menu.capitals ?? menu.cities[0])?.set ?? null;
  return (menu.gone ?? menu.organisations ?? menu.peoples ?? menu.signals)?.set ?? null;
}

function Chooser({ world, file, same, asked }: { world: World; file: FlagsFile; same: ReadonlyMap<string, string>; asked: FlagSet | null }) {
  const menu = useMemo(() => setMenu(world.index, file, same), [world, file, same]);
  const enough = (set: FlagSet | null | undefined): FlagSet | null => (set && deckOf(set, world.index, file, same).length >= FLAG_SET_MIN ? set : null);
  // What was left chosen the last time, read once: from then on this screen is what writes it.
  const [left] = useState(() => flagPlayOf(useStore.getState().flagLast));
  const [set, setSet] = useState<FlagSet>(() => enough(asked) ?? enough(left?.set) ?? firstOf('countries', menu) ?? { kind: 'countries' });
  const [game, setGame] = useState<FlagGame>(left?.game ?? 'flag-whose');
  // How long a game of questions is, and how many pairs «Parejas» deals: each is kept while the other game is chosen.
  const [length, setLength] = useState<FlagLength>(left && left.game !== 'flag-pairs' && left.game !== 'flag-climb' ? (left.length as FlagLength) : 10);
  const [pairs, setPairs] = useState<PairSize>(left?.game === 'flag-pairs' ? (left.length as PairSize) : PAIR_SIZE_DEFAULT);
  const [answer, setAnswer] = useState<FlagAnswer>(left?.answer ?? 'choice');
  const modeRef = useRef<HTMLElement>(null);

  // A link that names other flags, followed while this screen is open.
  const askedText = asked ? JSON.stringify(asked) : '';
  useEffect(() => {
    const next = enough(asked);
    if (next) setSet(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [askedText]);

  const def = flagGameDef(game);
  const paired = game === 'flag-pairs';
  /** «Escalada» has no length to choose: it lasts as long as its lives. */
  const climb = game === 'flag-climb';
  const play: FlagPlay = useMemo(() => ({ game, set, length: paired ? pairs : climb ? 'all' : length, answer: def.typed ? answer : 'choice' }), [game, set, paired, climb, pairs, length, answer, def.typed]);
  const text = flagPlayText(play);
  const setFlagLast = useStore((s) => s.setFlagLast);
  useEffect(() => setFlagLast(text), [text, setFlagLast]);

  const deck = useMemo(() => deckOf(set, world.index, file, same), [set, world, file, same]);
  const name = flagSetName(set, world.index);
  const shelf = shelfOf(set);

  // «Casi iguales» asks only the flags that have others like them: how many there are is in a file of its own.
  const place = alikePlace(set);
  const [alike, setAlike] = useState<{ kind: string; file: AlikeFile } | null>(null);
  const [alikeFailed, setAlikeFailed] = useState(false);
  const needsAlike = game === 'flag-alike';
  useEffect(() => {
    if (!needsAlike || alike?.kind === place.file) return;
    let alive = true;
    setAlikeFailed(false);
    loadAlike(place.file).then(
      (f) => alive && setAlike({ kind: place.file, file: f }),
      () => alive && setAlikeFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [needsAlike, place.file, alike?.kind]);
  const near = useMemo(() => (needsAlike && alike?.kind === place.file ? nearCards(groupAt(alike.file, place), deck) : null), [needsAlike, alike, place.file, place.group, place.wider, deck]);
  // What «Antes y ahora», «El intruso» and «¿De qué país es?» are counted with: the countries of the set that flew another flag, its groups of three, and its countries that have flags of regions.
  const extra = useMemo<FlagExtra>(() => {
    if (game === 'flag-past') {
      const at = pastPlace(set);
      return at ? { past: { cards: pastCards(deck, file), data: null, place: at } } : {};
    }
    if (game === 'flag-land') return playsLand(set) ? { land: { cards: landCards(deck, world.index, file, same), data: null, where: new Map() } } : {};
    return game === 'flag-odd' ? { odd: { groups: oddGroups(set, deck, world.index) } } : {};
  }, [game, set, deck, file, same, world]);
  const questions = needsAlike ? (near ? questionCount(play, deck, near) : null) : questionCount(play, deck, undefined, extra);
  const problem =
    needsAlike && alikeFailed
      ? L('No se han podido cargar las banderas parecidas: elige otro juego.', 'The look-alikes could not be loaded: choose another game.')
      : questions !== 0
        ? null
        : needsAlike
          ? L('Estas banderas no se parecen lo bastante entre sí: elige otras, u otro juego.', 'These flags are not enough alike: choose others, or another game.')
          : game === 'flag-past' && !extra.past
            ? L('«Antes y ahora» se juega con países: elige los del mundo, los de un continente o los territorios.', '“Then and now” is played with countries: choose those of the world, of a continent, or the territories.')
            : game === 'flag-past'
              ? L(`De estos países, menos de ${PAST_MIN} han tenido otra bandera: elige otros, u otro juego.`, `Of these countries, fewer than ${PAST_MIN} have flown another flag: choose others, or another game.`)
              : game === 'flag-land' && !extra.land
                ? L('«¿De qué país es?» se juega con países: elige los del mundo o los de un continente.', '“Which country?” is played with countries: choose those of the world or those of a continent.')
                : game === 'flag-land'
                  ? L(`De estos países, menos de ${LAND_MIN} tienen banderas de regiones: elige otros, u otro juego.`, `Of these countries, fewer than ${LAND_MIN} have flags of regions: choose others, or another game.`)
                  : L('Con estas banderas no hay bastante para este juego: elige otras, u otro juego.', 'There is not enough for this game with these flags: choose others, or another game.');

  const best = useStore((s) => s.best[flagBestKey(play)]);
  const begin = () => {
    if (!problem) go(flagPlayPath(play));
  };

  const chip = (choice: SetChoice) => (
    <button key={JSON.stringify(choice.set)} type="button" className={cx('chip', sameSet(choice.set, set) && 'on')} aria-pressed={sameSet(choice.set, set)} onClick={() => setSet(choice.set)}>
      {choice.name} <small>{nf(choice.n)}</small>
    </button>
  );
  const land = set.kind === 'regions' ? menu.regions.find((c) => c.country === set.country) : undefined;
  const others = [menu.gone, menu.organisations, menu.peoples, menu.signals].filter((c): c is SetChoice => !!c);
  const shelves = [
    { value: 'countries' as const, label: L('Países', 'Countries'), on: menu.countries.length > 0 || !!menu.territories },
    { value: 'regions' as const, label: L('Regiones', 'Regions'), on: menu.regions.length > 0 },
    { value: 'cities' as const, label: L('Ciudades', 'Cities'), on: !!menu.capitals || menu.cities.length > 0 },
    { value: 'others' as const, label: L('Otras', 'Others'), on: others.length > 0 },
  ].filter((s) => s.on);

  return (
    <div className="setup fgm">
      <header className="setup-head">
        <p className="kicker">{L('Banderas', 'Flags')}</p>
        {/* The heading its page has before the game starts (lib/seo.ts), as on the screen of every section. */}
        <h1>{SCREENS[FLAGS_PATH][getLang()].name}</h1>
        <p className="lead">
          {L(
            'Juega con las de los países, las de sus regiones y sus ciudades, las de países que ya no existen, las de organizaciones y pueblos y las del código de señales: elige con cuáles y a qué.',
            'Play with those of the countries, of their regions and their cities, of countries that are no more, of organisations and peoples and those of the code of signals: choose which, and what.',
          )}{' '}
          <a className="fgm-gallery" href={`#/${FLAGS_PATH}/${flagsRest({ tab: 'countries' })}`}>
            <Images size={15} aria-hidden="true" />
            {L('Ver la galería de banderas', 'See the gallery of flags')}
          </a>
        </p>
      </header>

      <section className="step setup-main">
        <h2>
          <span className="step-n">01</span> {L('Banderas', 'Flags')}
        </h2>
        <Seg
          label={L('Qué banderas', 'Which flags')}
          value={shelf}
          options={shelves}
          onChange={(to) => {
            const next = to === shelf ? null : firstOf(to, menu);
            if (next) setSet(next);
          }}
        />
        {shelf === 'countries' && (
          <div className="chips">
            {menu.countries.map(chip)}
            {menu.territories && chip(menu.territories)}
          </div>
        )}
        {shelf === 'regions' && (
          <div className="fgm-pick">
            <label className="select">
              <span>{L('País', 'Country')}</span>
              <select value={set.kind === 'regions' ? set.country : ''} onChange={(e) => setSet({ kind: 'regions', country: e.target.value })}>
                {menu.regions.map((c) => (
                  <option key={c.country} value={c.country}>
                    {c.name} ({nf(c.n)})
                  </option>
                ))}
              </select>
            </label>
            {land && land.levels.length > 0 && (
              <div className="chips" role="group" aria-label={L('Qué divisiones', 'Which divisions')}>
                {chip({ set: land.set, name: L('Todas', 'All'), n: land.n })}
                {land.levels.map(chip)}
              </div>
            )}
          </div>
        )}
        {shelf === 'cities' && (
          <div className="fgm-pick">
            <label className="select">
              <span>{L('De dónde', 'Where from')}</span>
              <select
                value={set.kind === 'cities' ? set.country : ''}
                onChange={(e) => {
                  const next: FlagSet | null = e.target.value ? { kind: 'cities', country: e.target.value } : (menu.capitals?.set ?? null);
                  if (next) setSet(next);
                }}
              >
                {menu.capitals && <option value="">{L(`Las capitales de los países (${nf(menu.capitals.n)})`, `The capitals of the countries (${nf(menu.capitals.n)})`)}</option>}
                {menu.cities.map((c) => (
                  <option key={JSON.stringify(c.set)} value={c.set.kind === 'cities' ? c.set.country : ''}>
                    {c.name} ({nf(c.n)})
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {shelf === 'others' && <div className="chips">{others.map(chip)}</div>}

        <div className="fgm-set">
          <p className="fgm-set-name">
            <strong>{name}</strong> · {L(`${nf(deck.length)} banderas`, `${nf(deck.length)} flags`)}
          </p>
          <ul className="fgm-strip" aria-hidden="true">
            {deck.slice(0, PREVIEW).map((card) => (
              <li key={card.key}>
                <img src={card.small} alt="" loading="lazy" decoding="async" draggable={false} />
              </li>
            ))}
            {deck.length > PREVIEW && <li className="fgm-more">+{nf(deck.length - PREVIEW)}</li>}
          </ul>
          <a className="fgm-see" href={`#/${FLAGS_PATH}/${flagsRest(galleryPage(set))}`}>
            {L('Verlas con su nombre en la galería', 'See them with their names in the gallery')}
            <ArrowRight size={15} aria-hidden="true" />
          </a>
        </div>
      </section>

      <aside className="setup-side">
        <div className="setup-scroll">
          <section className="step step-mode" ref={modeRef}>
            <h2>
              <span className="step-n">02</span> {L('Juego', 'Game')}
            </h2>
            <div className="modes">
              {FLAG_GAMES.map((id) => {
                const m = flagGameDef(id);
                const Icon = m.icon;
                return (
                  <button key={id} type="button" className={cx('mode', id === game && 'on')} aria-pressed={id === game} title={m.desc} onClick={() => setGame(id)}>
                    <span className="mode-icon">
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className="mode-name">
                      {m.name}
                      <span className="mode-level" title={levelName(m.level)} aria-label={levelName(m.level)}>
                        {[1, 2, 3].map((n) => (
                          <i key={n} className={n <= m.level ? 'on' : undefined} />
                        ))}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mode-about" aria-live="polite">
              <strong>{levelName(def.level)}. </strong>
              {def.desc} <HelpButton key={game} own={{ name: def.name, desc: def.desc, icon: def.icon, help: flagGameHelp(game) }} />
            </p>
            <ul className="mode-facts">
              {questions != null && questions > 0 && (
                <li>
                  <ListOrdered size={14} aria-hidden="true" />
                  <span>
                    {paired
                      ? L(`${nf(questions)} parejas, ${nf(questions * 2)} cartas`, `${nf(questions)} pairs, ${nf(questions * 2)} cards`)
                      : climb
                        ? L(`${CLIMB_LIVES} vidas, hasta ${nf(questions)} banderas`, `${CLIMB_LIVES} lives, up to ${nf(questions)} flags`)
                        : L(questions === 1 ? '1 pregunta' : `${nf(questions)} preguntas`, questions === 1 ? '1 question' : `${nf(questions)} questions`)}
                  </span>
                </li>
              )}
              {best != null && (
                <li title={L('Tu mejor resultado en este juego con estas banderas y estos ajustes.', 'Your best result in this game with these flags and these settings.')}>
                  <Trophy size={14} aria-hidden="true" />
                  <span>
                    {L('Tu marca', 'Your record')}: {paired ? L(`${nf(best)} intentos`, `${nf(best)} turns`) : climb ? L(best === 1 ? '1 peldaño' : `${nf(best)} peldaños`, best === 1 ? '1 rung' : `${nf(best)} rungs`) : `${nf(best)} %`}
                  </span>
                </li>
              )}
            </ul>
          </section>

          <section className="step">
            <h2>
              <span className="step-n">03</span> {L('Ajustes', 'Settings')}
            </h2>
            <div className="options">
              {paired ? (
                <div className="opt">
                  <span className="opt-label">{L('Parejas', 'Pairs')}</span>
                  <Seg<PairSize> label={L('Cuántas parejas', 'How many pairs')} value={pairs} onChange={setPairs} options={PAIR_SIZES.map((value) => ({ value, label: String(value) }))} />
                  {questions != null && questions > 0 && questions < pairs && <span className="opt-hint">{L(`De estas banderas solo salen ${nf(questions)} parejas.`, `These flags only make ${nf(questions)} pairs.`)}</span>}
                </div>
              ) : climb ? (
                <div className="opt">
                  <span className="opt-label">{L('Duración', 'Length')}</span>
                  <span className="opt-hint">
                    {L('No hay nada que elegir: la escalada dura hasta que te quedas sin vidas, o hasta que se acaban las banderas.', 'There is nothing to choose: the climb lasts until you run out of lives, or until the flags run out.')}
                  </span>
                </div>
              ) : (
                <div className="opt">
                  <span className="opt-label">{L('Preguntas', 'Questions')}</span>
                  <Seg<FlagLength> label={L('Cuántas preguntas', 'How many questions')} value={length} onChange={setLength} options={FLAG_LENGTHS.map((value) => ({ value, label: lengthName(value) }))} />
                  {game === 'flag-alike' && length === 'all' && <span className="opt-hint">{L('Todas las que tienen con quién confundirse, no todas las del grupo.', 'All that have something to be mixed up with, not every flag of the group.')}</span>}
                  {game === 'flag-land' && !problem && <span className="opt-hint">{L('Una bandera por cada país que tiene banderas de regiones: en cada partida puede salir una distinta.', 'One flag for each country that has flags of regions: each game may bring a different one.')}</span>}
                  {game === 'flag-past' && <span className="opt-hint">{L('Una bandera por cada país que ha tenido otra: en cada partida puede salir una distinta.', 'One flag for each country that has flown another: each game may bring a different one.')}</span>}
                </div>
              )}
              {def.typed && (
                <div className="opt">
                  <span className="opt-label">{L('Respuesta', 'Answer')}</span>
                  <Seg<FlagAnswer>
                    label={L('Cómo se responde', 'How to answer')}
                    value={answer}
                    onChange={setAnswer}
                    options={[
                      { value: 'choice', label: answerName('choice'), title: L('Eliges entre cuatro nombres', 'You choose among four names') },
                      { value: 'type', label: answerName('type'), title: L('Escribes el nombre', 'You type the name') },
                    ]}
                  />
                </div>
              )}
            </div>
          </section>
        </div>
        <div className="startbar">
          <button type="button" className="startbar-info" title={L('Ver juego y ajustes', 'See game and settings')} onClick={() => modeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            <strong>
              {name} · {L(`${nf(deck.length)} banderas`, `${nf(deck.length)} flags`)}
            </strong>
            <span>
              <b className={problem ? 'problem' : undefined}>{problem ?? `${def.name}${def.typed && answer === 'type' ? ` · ${answerName('type').toLowerCase()}` : ''}`}</b>
              <ChevronDown size={14} aria-hidden="true" />
            </span>
          </button>
          <div className="startbar-flags" aria-hidden="true">
            {deck.slice(0, 6).map((card) => (
              <img key={card.key} className="flag flag-sm" src={card.small} alt="" loading="lazy" decoding="async" draggable={false} />
            ))}
            {deck.length > 6 && <small>+{deck.length - 6}</small>}
          </div>
          <button type="button" className="btn btn-primary btn-lg" onClick={begin} disabled={!!problem}>
            <Play size={18} aria-hidden="true" />
            {L('Empezar', 'Start')}
          </button>
        </div>
      </aside>
    </div>
  );
}

export function FlagGames({ world, rest }: { world: World; rest: string }) {
  const [data, setData] = useState<{ file: FlagsFile; same: ReadonlyMap<string, string> } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setFailed(null);
    // Without the list of pictures that are the same the games still work: two of them may then share a question.
    Promise.all([loadFlags(), loadSame().catch(() => null)]).then(
      ([file, same]) => alive && setData({ file, same: sameMap(same) }),
      (err: unknown) => alive && setFailed(err instanceof Error ? err.message : String(err)),
    );
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (failed) {
    return (
      <div className="empty-state" role="alert">
        <p>{L(`No se han podido cargar las banderas (${failed}).`, `The flags could not be loaded (${failed}).`)}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
          {L('Reintentar', 'Retry')}
        </button>
      </div>
    );
  }
  if (!data) return <Spinner label={L('Cargando las banderas…', 'Loading the flags…')} />;
  // `juegos/regiones-ES`: the flags a link asks for.
  return <Chooser world={world} file={data.file} same={data.same} asked={flagSetOf(rest.split('/')[1] ?? '')} />;
}
