import { ArrowRight, BookOpen, Filter, Infinity as InfinityIcon, Route } from 'lucide-react';
import { useMemo } from 'react';
import { Flag } from '../components/ui';
import { eligible, type World } from '../lib/data';
import { MODES, MODE_NAME, SECTIONS } from '../lib/modes';
import { go } from '../lib/router';
import { useStore } from '../lib/store';
import { nf, today } from '../lib/text';
import type { Section } from '../lib/types';

const ORDER: Section[] = ['regions', 'countries', 'pops'];
const SAMPLE: Record<Section, string[]> = {
  regions: ['ES', 'FR', 'IT', 'DE', 'US', 'MX', 'BR', 'JP'],
  countries: ['ZA', 'KE', 'NG', 'EG', 'IN', 'ID', 'AR', 'CA'],
  pops: ['CN', 'IN', 'US', 'NG', 'BR', 'RU', 'AU', 'DE'],
};

export function Home({ world }: { world: World }) {
  const sessions = useStore((s) => s.sessions);
  const game = useStore((s) => s.game);
  const opts = useStore((s) => s.opts);
  const start = useStore((s) => s.start);

  const totals = useMemo(() => {
    const cs = world.index.countries.filter((c) => c.cl !== 'other');
    return {
      countries: cs.length,
      units: cs.reduce((n, c) => n + (c.lv[c.lv.length - 1]?.n ?? 0), 0),
      modes: new Set(ORDER.flatMap((s) => MODES[s].map((m) => m.id))).size,
    };
  }, [world]);

  const daily = () => {
    const ids = world.index.countries.filter((c) => c.cl !== 'dep' && eligible('countries', c)).map((c) => c.id);
    start({ section: 'countries', mode: 'travel', countries: ids, levels: {}, opts: { ...opts, blind: false, suggest: true }, daily: today() });
    go('jugar');
  };
  const playedToday = sessions.some((s) => s.mode === 'travel' && new Date(s.t).toDateString() === new Date().toDateString());
  const last = sessions[0];

  return (
    <div className="home">
      <section className="hero">
        <p className="kicker">Geografía para aprender jugando</p>
        <h1>
          El mapa del mundo,
          <br />
          <em>pieza a pieza.</em>
        </h1>
        <p className="lead">
          Provincias, estados y regiones de casi todos los países, además de capitales, banderas y cifras. Elige qué quieres aprender, juega las veces que quieras y repasa lo que falles.
        </p>
        <div className="hero-cta">
          <button type="button" className="btn btn-primary btn-lg" onClick={() => go(SECTIONS.regions.path)}>
            Empezar con las regiones
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          {game && (
            <button type="button" className="btn btn-lg" onClick={() => go('jugar')}>
              Seguir: {MODE_NAME[game.mode]}
            </button>
          )}
        </div>
        <dl className="hero-figures">
          <div>
            <dt>países y territorios</dt>
            <dd>{nf(totals.countries)}</dd>
          </div>
          <div>
            <dt>regiones en el mapa</dt>
            <dd>{nf(totals.units)}</dd>
          </div>
          <div>
            <dt>modos de juego</dt>
            <dd>{totals.modes}</dd>
          </div>
          <div>
            <dt>partidas al día</dt>
            <dd className="inf">
              <InfinityIcon size={44} strokeWidth={2.4} aria-label="sin límite" />
            </dd>
          </div>
        </dl>
      </section>

      <section className="sections">
        {ORDER.map((id, i) => {
          const s = SECTIONS[id];
          return (
            <a key={id} className="scard" href={`#/${s.path}`}>
              <span className="scard-n">{String(i + 1).padStart(2, '0')}</span>
              <h2>{s.name}</h2>
              <p>{s.blurb}</p>
              <ul className="scard-modes">
                {MODES[id].map((m) => (
                  <li key={m.id}>{m.name}</li>
                ))}
              </ul>
              <span className="scard-flags" aria-hidden="true">
                {SAMPLE[id].map((c) => (
                  <Flag key={c} code={world.byId.get(c)?.fl} size="sm" />
                ))}
              </span>
              <span className="scard-go">
                Elegir países
                <ArrowRight size={16} aria-hidden="true" />
              </span>
            </a>
          );
        })}
      </section>

      <section className="daily">
        <div>
          <p className="kicker">Ruta del día · {today().split('-').reverse().join('/')}</p>
          <h2>Dos países, el camino más corto</h2>
          <p>Un reto igual para todo el mundo cada día: une los dos países pasando por las menos fronteras posibles. Cuando lo termines puedes pedir todas las rutas que quieras.</p>
        </div>
        <button type="button" className="btn btn-accent btn-lg" onClick={daily}>
          <Route size={18} aria-hidden="true" />
          {playedToday ? 'Volver a la ruta de hoy' : 'Jugar la ruta de hoy'}
        </button>
      </section>

      <section className="why">
        <article>
          <InfinityIcon size={22} aria-hidden="true" />
          <h3>Sin límite</h3>
          <p>Nada de un intento al día. Repite, baraja y activa el modo sin fin: lo que fallas vuelve a salir hasta que te lo sabes.</p>
        </article>
        <article>
          <Filter size={22} aria-hidden="true" />
          <h3>A tu medida</h3>
          <p>Filtra por continente, tamaño, población, litoral o tipo de territorio, mezcla países en un solo mapa y guarda tus combinaciones.</p>
        </article>
        <article>
          <BookOpen size={22} aria-hidden="true" />
          <h3>Para aprender de verdad</h3>
          <p>Cada respuesta enlaza con Wikipedia, el mapa y vídeos para estudiar. Tu progreso se guarda en este navegador, sin registro.</p>
        </article>
      </section>

      {last && (
        <p className="home-last">
          Última partida: <b>{MODE_NAME[last.mode]}</b> · {last.label} · {last.ok} de {last.total} a la primera. <a href="#/progreso">Ver tu progreso</a>
        </p>
      )}
    </div>
  );
}
