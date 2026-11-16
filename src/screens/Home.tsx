import { ArrowRight, BookOpen, CalendarClock, Filter, Infinity as InfinityIcon } from 'lucide-react';
import { useMemo } from 'react';
import { LevelChip } from '../components/Badges';
import { ReviewCard } from '../components/ReviewCard';
import { Flag } from '../components/ui';
import { DailyCard } from '../daily/Daily';
import type { World } from '../lib/data';
import { L } from '../lib/i18n';
import { MODES, MODE_NAME, SECTIONS, SECTION_IDS } from '../lib/modes';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { nf } from '../lib/text';
import type { Section } from '../lib/types';

const SAMPLE: Record<Section, string[]> = {
  regions: ['ES', 'FR', 'IT', 'DE', 'US', 'MX', 'BR', 'JP'],
  countries: ['ZA', 'KE', 'NG', 'EG', 'IN', 'ID', 'AR', 'CA'],
  cities: ['ES', 'GB', 'TR', 'CN', 'AU', 'CO', 'MA', 'PL'],
  physical: [],
  pops: ['CN', 'IN', 'US', 'NG', 'BR', 'RU', 'AU', 'DE'],
};

const goLabel = (id: Section): string => (id === 'physical' ? L('Elegir qué y dónde', 'Choose what and where') : L('Elegir países', 'Choose countries'));

export function Home({ world }: { world: World }) {
  const sessions = useStore((s) => s.sessions);
  const game = useStore((s) => s.game);

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
      <DailyCard world={world} />
      <ReviewCard world={world} />

      <section className="hero">
        <p className="kicker">{L('Geografía para aprender jugando', 'Geography you learn by playing')}</p>
        <h1>
          {L('El mapa del mundo,', 'The map of the world,')}
          <br />
          <em>{L('pieza a pieza.', 'piece by piece.')}</em>
        </h1>
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
            <button type="button" className="btn btn-lg" onClick={() => go('jugar')}>
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
              <InfinityIcon size={44} strokeWidth={2.4} aria-label={L('sin límite', 'no limit')} />
            </dd>
          </div>
        </dl>
      </section>

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
