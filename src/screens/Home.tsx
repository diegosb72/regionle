import { ArrowRight, BookOpen, CalendarClock, Filter, Flame, Infinity as InfinityIcon, ListChecks, Star, Swords, X } from 'lucide-react';
import { Suspense, useMemo } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { lazyScreen, useHere } from '../components/lazy';
import { ReviewCard } from '../components/ReviewCard';
import { Flag } from '../components/ui';
import { DailyCard } from '../daily/Card';
import { studyStreak } from '../lib/days';
import { countriesOf, describeMap, type MapSpec } from '../lib/describe';
import { commonPlace, type World } from '../lib/world';
import { metricNoun, metricOrder } from '../lib/metricNames';
import { L, getLang } from '../lib/i18n';
import { MODES, SECTIONS, SECTION_IDS, cardAskName, formatName, modeNameIn, routeRuleName } from '../lib/modes';
import { recentKey, type Recent } from '../lib/recent';
import { NOT_GAMES } from '../lib/rules';
import { go, inGame } from '../lib/router';
import { DUEL_PATH, LIST_PATH, PATHS, PLAY_PATH, screenPage } from '../lib/routes';
import { useStore, type Fav, type State } from '../lib/store';
import { nf, today } from '../lib/text';
import type { Mode, Section } from '../lib/types';

const SAMPLE: Record<Section, string[]> = {
  regions: ['ES', 'FR', 'IT', 'DE', 'US', 'MX', 'BR', 'JP'],
  countries: ['ZA', 'KE', 'NG', 'EG', 'IN', 'ID', 'AR', 'CA'],
  cities: ['ES', 'GB', 'TR', 'CN', 'AU', 'CO', 'MA', 'PL'],
  physical: [],
  pops: ['CN', 'IN', 'US', 'NG', 'BR', 'RU', 'AU', 'DE'],
};

/** The first sentence of a description (no look-behind: old Safari does not read it). */
const firstSentence = (text: string): string => /^.*?\.(?=\s|$)/.exec(text)?.[0] ?? text;

/** The ways of playing a newcomer is told about, from looking to knowing them all by heart. */
const FIRST_MODES: Mode[] = ['explore', 'learn', 'pin', 'identify', 'nameall'];

/**
 * How the game works, for whoever has never played: what to choose, what each way of playing is and what
 * comes back later. It goes away with the first game, or when it is put away.
 */
function Welcome() {
  const setWelcomed = useStore((s) => s.setWelcomed);
  const setMode = useStore((s) => s.setMode);
  const modes = FIRST_MODES.flatMap((id) => MODES.regions.find((m) => m.id === id) ?? []);
  return (
    <section className="welcome" aria-labelledby="welcome-title">
      <button type="button" className="welcome-close" onClick={setWelcomed} aria-label={L('Cerrar la bienvenida', 'Close the welcome')} title={L('Cerrar', 'Close')}>
        <X size={18} aria-hidden="true" />
      </button>
      <p className="kicker">{L('¿Primera vez por aquí?', 'First time here?')}</p>
      <h2 id="welcome-title">{L('Así se juega, en tres pasos', 'How to play, in three steps')}</h2>
      <ol className="welcome-steps">
        <li>
          <h3>{L('Elige un mapa', 'Choose a map')}</h3>
          <p>
            {L(
              'Arriba tienes las cinco secciones: regiones, países, ciudades, geografía física y cifras. Dentro de cada una eliges los países que quieras, de uno solo al mundo entero.',
              'The five sections are at the top: regions, countries, cities, physical geography and figures. Inside each one you choose the countries you want, from a single one to the whole world.',
            )}
          </p>
        </li>
        <li>
          <h3>{L('Elige cómo jugar', 'Choose how to play')}</h3>
          <dl className="welcome-modes">
            {modes.map((m) => (
              <div key={m.id}>
                <dt>
                  <m.icon size={15} aria-hidden="true" />
                  {m.name}
                </dt>
                <dd>{firstSentence(m.desc)}</dd>
              </div>
            ))}
          </dl>
        </li>
        <li>
          <h3>{L('Y vuelve', 'And come back')}</h3>
          <p>
            {L(
              'Lo que fallas vuelve a los pocos días hasta que se queda: es el repaso que te propone esta página. Y cada día hay un reto de cinco pruebas, el mismo para todo el mundo. Todo se guarda en este navegador, sin registro.',
              'What you miss comes back a few days later until it sticks: that is the review this page offers you. And every day there is a challenge of five tests, the same for everyone. It is all kept in this browser, with no sign-up.',
            )}
          </p>
        </li>
      </ol>
      <div className="welcome-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setMode('regions', 'learn');
            go(PATHS.regions);
          }}
        >
          {L('Empezar por «Aprender»', 'Start with “Learn”')}
          <ArrowRight size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-ghost" onClick={setWelcomed}>
          {L('Ya sé cómo va', 'I know how it works')}
        </button>
      </div>
    </section>
  );
}

/** Maps played lately that the first page shows. */
const RECENT_SHOWN = 4;

const specOf = (r: Recent): MapSpec => ({ section: r.section, countries: r.countries, levels: r.levels, cityPick: r.o.cityPick, cityCount: r.o.cityCount });

/** A map played before in words: "Europa · 45 países", "España · provincias", "Ríos · Europa". */
function recentMap(r: Recent, world: World): string {
  const text = describeMap(specOf(r), world);
  if (r.section === 'physical') return text;
  const chosen = countriesOf(specOf(r), world);
  const place = chosen.length > 3 ? commonPlace(chosen, world.index, r.section) : null;
  const what = r.section === 'pops' && r.o.metric ? ` · ${metricNoun(r.o.metric)}` : r.mode === 'compass' ? ` · ${metricOrder(r.o.axis === 'we' ? 'lon' : 'lat')}` : '';
  return `${place ? `${place} · ` : ''}${text}${what}`;
}

/** How long ago, by the day: "hoy", "ayer", "hace 3 días", and a date from a week on. */
function ago(t: number): string {
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(t).setHours(0, 0, 0, 0)) / 864e5);
  if (days <= 0) return L('hoy', 'today');
  if (days === 1) return L('ayer', 'yesterday');
  if (days < 7) return L(`hace ${days} días`, `${days} days ago`);
  return new Date(t).toLocaleDateString(getLang() === 'en' ? 'en-GB' : 'es-ES', { day: 'numeric', month: 'short' });
}

/**
 * What was being practised, one click away: the maps played lately, each as the game it was, and the
 * selections of countries saved in the menus.
 */
function Recents({ world }: { world: World }) {
  const recent = useStore((s) => s.recent);
  const favs = useStore((s) => s.favs);
  const resume = useStore((s) => s.resume);
  const setSel = useStore((s) => s.setSel);
  const setLevel = useStore((s) => s.setLevel);
  // A game this version does not have, or a map whose countries the data no longer has, cannot be played again.
  const shown = recent
    .filter((r) => MODES[r.section]?.some((m) => m.id === r.mode))
    .filter((r) => r.section === 'physical' || countriesOf(specOf(r), world).length > 0)
    .slice(0, RECENT_SHOWN);
  // What is kept may come from another version, or from a file edited by hand: only what can be shown is.
  const saved = favs.filter((f) => !!f && typeof f.name === 'string' && Object.hasOwn(SECTIONS, f.section) && Array.isArray(f.ids) && f.ids.length > 0);
  if (!shown.length && !saved.length) return null;

  const again = (r: Recent) => {
    resume(r);
    go(PLAY_PATH);
  };
  const openFav = (fav: Fav) => {
    setSel(fav.section, fav.ids);
    for (const [id, k] of Object.entries(fav.levels ?? {})) setLevel(id, k);
    go(SECTIONS[fav.section].path);
  };

  return (
    <section className="recent" aria-labelledby="recent-h">
      <h2 id="recent-h">{shown.length ? L('Sigue donde lo dejaste', 'Pick up where you left off') : L('Tus selecciones guardadas', 'Your saved selections')}</h2>
      {shown.length > 0 && (
        <ul className="recent-list">
          {shown.map((r) => {
            const flags = countriesOf(specOf(r), world).slice(0, 3);
            const paced = r.o.format && r.o.format !== 'normal' ? ` · ${formatName(r.o.format).toLowerCase()}` : r.o.countdown ? ` · ${r.o.countdown / 60} min` : '';
            // Two packs of cards on the same map are told apart by what they ask.
            const asked =
              r.mode === 'cards' && r.o.cardAsk
                ? ` · ${cardAskName(r.o.cardAsk)}`
                : r.mode === 'bearing' && r.o.bearingAsk && r.o.bearingAsk !== 'both'
                  ? ` · ${r.o.bearingAsk === 'dir' ? L('solo rumbos', 'bearings only') : L('solo distancias', 'distances only')}`
                  : r.mode === 'coords' && r.o.coordsAsk === 'read'
                    ? ` · ${L('leer el punto', 'reading the point')}`
                    : r.mode === 'pairs' && r.o.pairOf
                      ? ` · ${r.o.pairOf === 'capital' ? L('capitales', 'capitals') : L('banderas', 'flags')}`
                      : r.mode === 'travel' && r.o.routeRule && r.o.routeRule !== 'none'
                        ? ` · ${routeRuleName(r.o.routeRule)}`
                        : '';
            return (
              <li key={recentKey(r)}>
                <button type="button" onClick={() => again(r)}>
                  <span className="recent-what">
                    {SECTIONS[r.section].name} · {modeNameIn(r.section, r.mode)}
                    {paced}
                    {asked}
                  </span>
                  <span className="recent-map">
                    {r.countries.length <= 3 && flags.length > 0 && (
                      <span className="recent-flags" aria-hidden="true">
                        {flags.map((c) => (
                          <Flag key={c.id} code={c.fl} size="sm" />
                        ))}
                      </span>
                    )}
                    {recentMap(r, world)}
                  </span>
                  <span className="recent-how">
                    {r.total > 0 ? `${L(`${r.ok} de ${r.total} a la primera`, `${r.ok} of ${r.total} first time`)} · ` : ''}
                    {ago(r.t)}
                  </span>
                  <span className="recent-go">
                    {L('Jugar otra vez', 'Play again')}
                    <ArrowRight size={15} aria-hidden="true" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {saved.length > 0 && (
        <div className="recent-favs">
          {shown.length > 0 && <h3>{L('Tus selecciones guardadas', 'Your saved selections')}</h3>}
          <ul>
            {saved.map((fav) => (
              <li key={`${fav.section}:${fav.name}`}>
                <button type="button" className="chip" onClick={() => openFav(fav)} title={L(`${fav.ids.length} países guardados`, `${fav.ids.length} countries saved`)}>
                  <Star size={13} aria-hidden="true" />
                  {fav.name}
                  <small>{SECTIONS[fav.section].name}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/** Someone who has never played: no game finished or in course, no daily challenge, nothing answered. */
const isFresh = (s: State): boolean => !s.welcomed && !s.sessions.length && !s.game && !s.tot.g && !Object.keys(s.daily).length && !Object.keys(s.stats).length;

const goLabel = (id: Section): string => (id === 'physical' ? L('Elegir qué y dónde', 'Choose what and where') : L('Elegir países', 'Choose countries'));

/** The goals with a date are fetched only by those who have one. */
const GoalCards = lazyScreen(() => import('../components/GoalCard').then((m) => m.GoalCards));
/** The session of the day: fetched for whoever has something answered, which is who can have one. */
const DayCard = lazyScreen(() => import('../components/DayCard').then((m) => m.DayCard));
/** The challenges of the week and of the zones: fetched for whoever has played before, who is the one that sees them. */
const MoreChallenges = lazyScreen(() => import('../components/MoreChallenges').then((m) => m.MoreChallenges));
/** The level, at the foot of the page: it comes with the achievements, which the first page does not carry. */
const LevelChip = lazyScreen(() => import('../components/Badges').then((m) => m.LevelChip));

/**
 * Whether the first page can be drawn whole. The goals and the session of the day go above the review, which
 * comes with the page: whoever is going to see them has their code fetched as soon as that is known, and the
 * page waits for it, so that nothing arrives a moment later and pushes the rest down.
 */
export function useHomeWhole(): boolean {
  const hasGoals = useStore((s) => s.goals.length > 0);
  const hasAnswers = useStore((s) => Object.keys(s.stats).length > 0);
  const fresh = useStore(isFresh);
  return useHere([fresh ? null : MoreChallenges, hasGoals ? GoalCards : null, hasAnswers ? DayCard : null]);
}

/**
 * What today adds up to, in a line that opens Progress: the days played in a row and how far the daily
 * target is. Nothing until there is a day with something done.
 */
function TodayLine() {
  const days = useStore((s) => s.days);
  const goal = useStore((s) => s.dayGoal);
  if (!Object.keys(days).length) return null;
  const now = today();
  const streak = studyStreak(days, now);
  const done = days[now]?.[1] ?? 0;
  const answers = L(`${nf(done)} ${done === 1 ? 'respuesta' : 'respuestas'}`, `${nf(done)} ${done === 1 ? 'answer' : 'answers'}`);
  return (
    <a className="today" href="#/progreso">
      {streak > 0 && (
        <b>
          <Flame size={17} aria-hidden="true" />
          {streak === 1 ? L('Racha de 1 día', 'A run of 1 day') : L(`${nf(streak)} días seguidos`, `${nf(streak)} days in a row`)}
        </b>
      )}
      {goal > 0 && (
        <span className="bar" aria-hidden="true">
          <i style={{ width: `${Math.min(100, Math.round((done / goal) * 100))}%` }} />
        </span>
      )}
      <span>
        {goal <= 0
          ? L(`Hoy llevas ${answers}.`, `${answers} today.`)
          : done >= goal
            ? L(`Meta de hoy cumplida: ${answers}.`, `Today’s target met: ${answers}.`)
            : L(`Hoy llevas ${nf(done)} de ${nf(goal)} respuestas.`, `${nf(done)} of ${nf(goal)} answers today.`)}
      </span>
    </a>
  );
}

export function Home({ world }: { world: World }) {
  const sessions = useStore((s) => s.sessions);
  const hasGoals = useStore((s) => s.goals.length > 0);
  const hasAnswers = useStore((s) => Object.keys(s.stats).length > 0);
  const game = useStore((s) => s.game);
  const fresh = useStore(isFresh);

  const totals = useMemo(() => {
    const cs = world.index.countries.filter((c) => c.cl !== 'other');
    return {
      countries: cs.length,
      units: cs.reduce((n, c) => n + (c.lv[c.lv.length - 1]?.n ?? 0), 0),
      // The sheet to print is in the menus and is not a way to play.
      modes: new Set(SECTION_IDS.flatMap((s) => MODES[s].map((m) => m.id)).filter((id) => !NOT_GAMES.includes(id))).size,
    };
  }, [world]);

  const last = sessions[0];

  return (
    <div className="home">
      {/* The first heading of the page; the headline further down is drawn as large as ever. */}
      <h1 className="sr-only">{L('Regionle ∞: juego de geografía para aprender el mapa del mundo', 'Regionle ∞: a geography game to learn the map of the world')}</h1>
      <DailyCard world={world} />
      {/* Whoever has just arrived has enough with the challenge of the day and what the game is. */}
      {!fresh && (
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <MoreChallenges world={world} />
          </Suspense>
        </ErrorBoundary>
      )}
      {hasGoals && (
        <ErrorBoundary>
          <Suspense fallback={null}>
            <GoalCards />
          </Suspense>
        </ErrorBoundary>
      )}
      {hasAnswers && (
        <ErrorBoundary fallback={() => null}>
          <Suspense fallback={null}>
            <DayCard world={world} />
          </Suspense>
        </ErrorBoundary>
      )}
      <ReviewCard world={world} />
      <TodayLine />

      <section className="hero">
        <p className="kicker">{L('Geografía para aprender jugando', 'Geography you learn by playing')}</p>
        <h2 className="hero-title">
          {L('El mapa del mundo,', 'The map of the world,')}
          <br />
          <em>{L('pieza a pieza.', 'piece by piece.')}</em>
        </h2>
        <p className="lead">
          {L(
            'Provincias, estados y regiones de casi todos los países, además de capitales, banderas, ciudades, ríos, mares, picos y cifras. Elige qué quieres aprender, juega las veces que quieras y repasa lo que falles.',
            'Provinces, states and regions of almost every country, plus capitals, flags, cities, rivers, seas, peaks and figures. Choose what you want to learn, play as often as you like and review what you miss.',
          )}
        </p>
        <div className="hero-cta">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => go(SECTIONS.regions.path)}>
            {L('Empezar con las regiones', 'Start with the regions')}
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {game && !game.review && (
            <button type="button" className="btn btn-lg" onClick={() => go(PLAY_PATH)}>
              {L('Seguir', 'Resume')}: {modeNameIn(game.section, game.mode)}
            </button>
          )}
        </div>
        <dl className="hero-figures">
          <div>
            <dt>{L('países y territorios', 'countries and territories')}</dt>
            <dd>{nf(totals.countries)}</dd>
          </div>
          <div>
            <dt>{L('regiones en el mapa', 'regions on the map')}</dt>
            <dd>{nf(totals.units)}</dd>
          </div>
          <div>
            <dt>{L('modos de juego', 'game modes')}</dt>
            <dd>{totals.modes}</dd>
          </div>
          <div>
            <dt>{L('partidas al día', 'games a day')}</dt>
            <dd className="inf">
              <InfinityIcon size={44} strokeWidth={2.4} role="img" aria-label={L('sin límite', 'no limit')} />
            </dd>
          </div>
        </dl>
      </section>

      {fresh && <Welcome />}
      <Recents world={world} />

      <section className="sections">
        {SECTION_IDS.map((id, i) => {
          const s = SECTIONS[id];
          return (
            // Written as the page of the section, which a search engine can follow; a click moves inside the game.
            <a key={id} className="scard" href={screenPage(PATHS[id], getLang())} onClick={inGame(s.path)}>
              <span className="scard-n">{String(i + 1).padStart(2, '0')}</span>
              <h2>{id === 'physical' ? L('Geografía física', 'Physical geography') : s.name}</h2>
              <p>{s.blurb}</p>
              <ul className="scard-modes">
                {MODES[id].map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
              {id === 'physical' ? (
                <span className="scard-flags scard-kinds" aria-hidden="true">
                  {['continent', 'river', 'lake', 'sea', 'range', 'plain', 'peninsula', 'peak', 'cape', 'desert', 'island', 'fall'].map((k) => (
                    <i key={k} className={`kdot kdot-${k}`} />
                  ))}
                </span>
              ) : (
                <span className="scard-flags" aria-hidden="true">
                  {SAMPLE[id].map((c) => (
                    <Flag key={c} code={world.byId.get(c)?.fl} size="sm" />
                  ))}
                </span>
              )}
              <span className="scard-go">
                {goLabel(id)}
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </a>
          );
        })}
      </section>

      <section className="why">
        <article>
          <InfinityIcon size={22} aria-hidden="true" />
          <h3>{L('Sin límite', 'No limit')}</h3>
          <p>
            {L(
              'Nada de un intento al día. Repite, baraja y activa el modo sin fin: lo que fallas vuelve a salir hasta que te lo sabes.',
              'No one-try-a-day rule. Repeat, shuffle and turn on endless mode: what you miss keeps coming back until you know it.',
            )}
          </p>
        </article>
        <article>
          <Filter size={22} aria-hidden="true" />
          <h3>{L('A tu medida', 'Made to measure')}</h3>
          <p>
            {L(
              'Filtra por continente, tamaño, población, litoral o tipo de territorio, mezcla países en un solo mapa y guarda tus combinaciones.',
              'Filter by continent, size, population, coast or kind of territory, mix countries on a single map and save your combinations.',
            )}
          </p>
        </article>
        <article>
          <CalendarClock size={22} aria-hidden="true" />
          <h3>{L('Repaso que se acuerda por ti', 'A review that remembers for you')}</h3>
          <p>
            {L(
              'Cada respuesta vuelve cuando está a punto de olvidarse: al día siguiente, a los tres días, a la semana, al mes. El repaso de hoy te espera en esta página.',
              'Each answer comes back when it is about to be forgotten: the next day, three days later, a week, a month. Today’s review waits for you on this page.',
            )}
          </p>
        </article>
        <article>
          <BookOpen size={22} aria-hidden="true" />
          <h3>{L('Para aprender de verdad', 'To really learn')}</h3>
          <p>
            {L(
              'Cada respuesta enlaza con Wikipedia, el mapa y vídeos para estudiar. Tu progreso se guarda en este navegador, sin registro.',
              'Every answer links to Wikipedia, the map and videos to study. Your progress is kept in this browser, with no sign-up.',
            )}
          </p>
        </article>
        {/* What can be done with someone else: neither shows until a game is over or a list is made, so it is told here. */}
        <article>
          <Swords size={22} aria-hidden="true" />
          <h3>{L('Reta a quien quieras', 'Challenge anyone you like')}</h3>
          <p>
            {L(
              'Al acabar una partida, «Retar a alguien» crea un enlace con tus mismas preguntas y tu resultado: quien lo abre juega contra ti, cuando quiera.',
              'At the end of a game, “Challenge someone” makes a link with your own questions and your result: whoever opens it plays against you, whenever they like.',
            )}{' '}
            <a href={`#/${DUEL_PATH}`}>{L('Cómo funcionan los retos', 'How challenges work')}</a>
          </p>
        </article>
        <article>
          <ListChecks size={22} aria-hidden="true" />
          <h3>{L('Listas para pasar', 'Lists to pass on')}</h3>
          <p>
            {L(
              'Haz una lista con las piezas que tú elijas, las del examen del jueves o las de un viaje, y pásala con un enlace para que otros jueguen con ella.',
              'Make a list with the pieces you choose, the ones for Thursday’s exam or for a trip, and pass it on with a link for others to play.',
            )}{' '}
            <a href={`#/${LIST_PATH}`}>{L('Cómo se hace una lista', 'How to make a list')}</a>
          </p>
        </article>
      </section>

      {last && (
        <ErrorBoundary fallback={() => null}>
          {/* Its room is kept while it comes, so that what is under it does not jump. */}
          <Suspense fallback={<span className="level-chip level-wait" aria-hidden="true" />}>
            <LevelChip world={world} />
          </Suspense>
        </ErrorBoundary>
      )}
      {last && (
        <p className="home-last">
          {L('Última partida', 'Last game')}: <b>{modeNameIn(last.section, last.mode)}</b> · {last.label} · {L(`${last.ok} de ${last.total} a la primera`, `${last.ok} of ${last.total} first time`)}. <a href="#/progreso">{L('Ver tu progreso', 'See your progress')}</a>
        </p>
      )}
    </div>
  );
}
