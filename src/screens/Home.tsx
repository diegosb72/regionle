import { ArrowRight, BookOpen, CalendarClock, Filter, Infinity as InfinityIcon, X } from 'lucide-react';
import { useMemo } from 'react';
import { LevelChip } from '../components/Badges';
import { ReviewCard } from '../components/ReviewCard';
import { Flag } from '../components/ui';
import { DailyCard } from '../daily/Card';
import type { World } from '../lib/world';
import { L } from '../lib/i18n';
import { MODES, MODE_NAME, SECTIONS, SECTION_IDS } from '../lib/modes';
import { go } from '../lib/router';
import { PATHS, PLAY_PATH } from '../lib/routes';
import { useStore } from '../lib/store';
import { nf } from '../lib/text';
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

const goLabel = (id: Section): string => (id === 'physical' ? L('Elegir qué y dónde', 'Choose what and where') : L('Elegir países', 'Choose countries'));

export function Home({ world }: { world: World }) {
  const sessions = useStore((s) => s.sessions);
  const game = useStore((s) => s.game);
  // Someone who has never played: no game finished or in course, no daily challenge, nothing answered.
  const fresh = useStore((s) => !s.welcomed && !s.sessions.length && !s.game && !s.tot.g && !Object.keys(s.daily).length && !Object.keys(s.stats).length);

  const totals = useMemo(() => {
    const cs = world.index.countries.filter((c) => c.cl !== 'other');
    return {
      countries: cs.length,
      units: cs.reduce((n, c) => n + (c.lv[c.lv.length - 1]?.n ?? 0), 0),
      modes: new Set(SECTION_IDS.flatMap((s) => MODES[s].map((m) => m.id))).size,
    };
  }, [world]);

  const last = sessions[0];

  return (
    <div className="home">
      {/* The first heading of the page; the headline further down is drawn as large as ever. */}
      <h1 className="sr-only">{L('Regionle ∞: juego de geografía para aprender el mapa del mundo', 'Regionle ∞: a geography game to learn the map of the world')}</h1>
      <DailyCard world={world} />
      <ReviewCard world={world} />

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
              {L('Seguir', 'Resume')}: {MODE_NAME[game.mode]}
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

      <section className="sections">
        {SECTION_IDS.map((id, i) => {
          const s = SECTIONS[id];
          return (
            <a key={id} className="scard" href={`#/${s.path}`}>
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
                  {['river', 'lake', 'sea', 'range', 'peak', 'desert', 'island'].map((k) => (
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
      </section>

      {last && <LevelChip world={world} />}
      {last && (
        <p className="home-last">
          {L('Última partida', 'Last game')}: <b>{MODE_NAME[last.mode]}</b> · {last.label} · {L(`${last.ok} de ${last.total} a la primera`, `${last.ok} of ${last.total} first time`)}. <a href="#/progreso">{L('Ver tu progreso', 'See your progress')}</a>
        </p>
      )}
    </div>
  );
}
