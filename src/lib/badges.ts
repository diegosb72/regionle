/**
 * Achievements and levels. Both are worked out from what is already stored (answers, sessions,
 * records, tallies), so that players who were here before start with what they have earned.
 */
import { L } from './i18n';
import { parseOrigin } from './review';
import { isLearnt, type CustomList, type SessionRec, type Stat, type Totals } from './store';
import type { Index } from './types';

export interface BadgeCtx {
  stats: Record<string, Stat>;
  where: Record<string, string>;
  sessions: SessionRec[];
  best: Record<string, number>;
  tot: Totals;
  lists: CustomList[];
  index: Index;
}

export type BadgeGroup = 'play' | 'daily' | 'know' | 'modes';

export interface Badge {
  id: string;
  group: BadgeGroup;
  name: string;
  /** What has to be done to earn it. */
  desc: string;
  done: number;
  goal: number;
}

export const groupName = (g: BadgeGroup): string =>
  g === 'play' ? L('Constancia', 'Keeping at it') : g === 'daily' ? L('Reto diario', 'Daily challenge') : g === 'know' ? L('Lo que sabes', 'What you know') : L('Modos de juego', 'Game modes');

export const BADGE_GROUPS: BadgeGroup[] = ['know', 'play', 'daily', 'modes'];

/** Continents with a badge of their own, in the order they are shown. */
const CONTINENTS = ['EU', 'AM', 'AF', 'AS', 'OC'] as const;

const continentBadge = (ct: string): { name: string; desc: string } => {
  switch (ct) {
    case 'EU':
      return { name: L('Europa completa', 'All of Europe'), desc: L('Sitúa en el mapa todos los países de Europa.', 'Place every country of Europe on the map.') };
    case 'AM':
      return { name: L('América completa', 'All of the Americas'), desc: L('Sitúa en el mapa todos los países de América.', 'Place every country of the Americas on the map.') };
    case 'AF':
      return { name: L('África completa', 'All of Africa'), desc: L('Sitúa en el mapa todos los países de África.', 'Place every country of Africa on the map.') };
    case 'AS':
      return { name: L('Asia completa', 'All of Asia'), desc: L('Sitúa en el mapa todos los países de Asia.', 'Place every country of Asia on the map.') };
    default:
      return { name: L('Oceanía completa', 'All of Oceania'), desc: L('Sitúa en el mapa todos los países de Oceanía.', 'Place every country of Oceania on the map.') };
  }
};

/**
 * Every achievement with how far along it is. "Placed" and "learnt" mean what they mean everywhere
 * else in the game: right first time twice in a row.
 */
export function badgesOf(ctx: BadgeCtx): Badge[] {
  const { stats, where, best, tot, sessions, lists, index } = ctx;

  // One pass over the answers: what is learnt, by skill and by the map it belongs to.
  const placed = new Set<string>();
  let caps = 0;
  let flags = 0;
  let nbs = 0;
  let regions = 0;
  let cities = 0;
  let phys = 0;
  const perLevel = new Map<string, number>();
  for (const [k, st] of Object.entries(stats)) {
    if (!isLearnt(st)) continue;
    const at = k.indexOf(':');
    const skill = k.slice(0, at);
    const id = k.slice(at + 1);
    if (skill === 'cap') caps++;
    else if (skill === 'flag') flags++;
    else if (skill === 'nb') nbs++;
    else if (skill === 'loc') {
      const o = parseOrigin(id, where[id]);
      if (!o) continue;
      if (o.section === 'countries') placed.add(id);
      else if (o.section === 'cities') cities++;
      else if (o.section === 'physical') phys++;
      else if (o.section === 'regions' && o.country) {
        regions++;
        const key = `${o.country}|${o.level ?? ''}`;
        perLevel.set(key, (perLevel.get(key) ?? 0) + 1);
      }
    }
  }

  const members = index.countries.filter((c) => c.cl === 'un');
  const inContinent = (ct: string) => members.filter((c) => c.ct === ct);
  const placedOf = (list: { id: string }[]) => list.reduce((n, c) => n + (placed.has(c.id) ? 1 : 0), 0);

  // The country whose regions are nearest to complete, at the level they were played.
  let detail: [number, number] = [0, 1];
  for (const [key, n] of perLevel) {
    const [cid, lv] = key.split('|');
    const c = index.countries.find((x) => x.id === cid);
    const level = c?.lv.find((l) => l.k === lv) ?? c?.lv.find((l) => l.k === c.dl);
    if (!level || level.n < 5) continue;
    const got = Math.min(n, level.n);
    if (got / level.n > detail[0] / detail[1]) detail = [got, level.n];
  }

  const top = (prefix: string) => Object.entries(best).reduce((m, [k, v]) => (k.startsWith(prefix) ? Math.max(m, v) : m), 0);
  const streak = best['daily:streak'] ?? 0;
  const perfect = sessions.some((r) => r.total >= 10 && r.ok === r.total) ? 1 : 0;
  const filled = Object.keys(best).some((k) => k.startsWith('nameall:')) ? 1 : 0;

  const out: Badge[] = [];
  const add = (id: string, group: BadgeGroup, name: string, desc: string, done: number, goal: number) => out.push({ id, group, name, desc, done: Math.max(0, Math.min(done, goal)), goal });

  for (const ct of CONTINENTS) {
    const list = inContinent(ct);
    if (list.length) add(`ct-${ct}`, 'know', continentBadge(ct).name, continentBadge(ct).desc, placedOf(list), list.length);
  }
  add('world', 'know', L('El mundo entero', 'The whole world'), L(`Sitúa en el mapa los ${members.length} países miembros de la ONU.`, `Place the ${members.length} member states of the UN on the map.`), placedOf(members), members.length);
  add('detail', 'know', L('Un país al detalle', 'A country in detail'), L('Sitúa todas las regiones de un país.', 'Place every region of one country.'), detail[0], detail[1]);
  add('regions100', 'know', L('Cien regiones', 'A hundred regions'), L('Sitúa 100 regiones, provincias o estados.', 'Place 100 regions, provinces or states.'), regions, 100);
  add('regions500', 'know', L('Quinientas regiones', 'Five hundred regions'), L('Sitúa 500 regiones, provincias o estados.', 'Place 500 regions, provinces or states.'), regions, 500);
  add('caps50', 'know', L('Capitales', 'Capitals'), L('Aprende 50 capitales.', 'Learn 50 capitals.'), caps, 50);
  add('flags50', 'know', L('Banderas', 'Flags'), L('Aprende 50 banderas.', 'Learn 50 flags.'), flags, 50);
  add('cities100', 'know', L('Cien ciudades', 'A hundred cities'), L('Sitúa 100 ciudades.', 'Place 100 cities.'), cities, 100);
  add('phys50', 'know', L('Ríos y montañas', 'Rivers and mountains'), L('Sitúa 50 ríos, mares, cordilleras, picos, islas, cabos o lo que sea de la geografía física.', 'Place 50 rivers, seas, ranges, peaks, islands, capes or anything else of physical geography.'), phys, 50);
  add('nb25', 'know', L('Buen vecino', 'Good neighbour'), L('Aprende los vecinos de 25 países o regiones.', 'Learn the neighbours of 25 countries or regions.'), nbs, 25);

  add('first', 'play', L('Primer paso', 'First step'), L('Termina tu primera partida.', 'Finish your first game.'), tot.g ?? 0, 1);
  add('g25', 'play', L('Con constancia', 'Regular'), L('Juega 25 partidas.', 'Play 25 games.'), tot.g ?? 0, 25);
  add('g100', 'play', L('Veterano', 'Veteran'), L('Juega 100 partidas.', 'Play 100 games.'), tot.g ?? 0, 100);
  add('q1000', 'play', L('Mil respuestas', 'A thousand answers'), L('Responde 1000 preguntas.', 'Answer 1,000 questions.'), tot.q ?? 0, 1000);
  add('perfect', 'play', L('Pleno', 'Full marks'), L('Termina una partida de 10 preguntas o más con todo a la primera.', 'Finish a game of 10 questions or more with everything right first time.'), perfect, 1);

  add('streak3', 'daily', L('Tres días seguidos', 'Three days running'), L('Completa el reto diario tres días seguidos.', 'Complete the daily challenge three days running.'), streak, 3);
  add('streak7', 'daily', L('Racha de 7 días', '7-day streak'), L('Completa el reto diario siete días seguidos.', 'Complete the daily challenge seven days running.'), streak, 7);
  add('streak30', 'daily', L('Racha de 30 días', '30-day streak'), L('Completa el reto diario treinta días seguidos.', 'Complete the daily challenge thirty days running.'), streak, 30);

  add('lessons10', 'modes', L('Buen alumno', 'Good student'), L('Completa 10 lecciones de «Aprender».', 'Complete 10 lessons of “Learn”.'), tot.lessons ?? 0, 10);
  add('regionle1', 'modes', L('A la primera', 'First go'), L('Acierta un Regionle al primer intento.', 'Get a Regionle right at the first try.'), tot.regionle1 ?? 0, 1);
  add('fill', 'modes', L('Mapa completo', 'Map complete'), L('Rellena un mapa entero escribiendo todos sus nombres.', 'Fill a whole map by typing all its names.'), filled, 1);
  add('near', 'modes', L('Puntería', 'Marksman'), L('Sitúa una ciudad a ciegas a menos de 10 km.', 'Place a city blind within 10 km.'), tot.near ?? 0, 1);
  add('timed20', 'modes', L('Contrarreloj', 'Against the clock'), L('Consigue 20 aciertos en un minuto.', 'Get 20 right in a minute.'), top('timed:'), 20);
  add('lives30', 'modes', L('Superviviente', 'Survivor'), L('Consigue 30 aciertos en supervivencia.', 'Get 30 right in survival.'), top('lives:'), 30);
  add('list', 'modes', L('A tu medida', 'Made to measure'), L('Crea una lista a medida.', 'Make a custom list.'), lists.length, 1);
  return out;
}

export const isEarned = (b: Badge): boolean => b.done >= b.goal;

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

/** Points for each first-time right answer, each right answer with help, and each achievement. */
export const POINTS = { ok: 10, warn: 5, badge: 100 } as const;

/** Points each level starts at. */
export const LEVEL_AT = [0, 200, 600, 1500, 3000, 6000, 10_000, 16_000, 25_000, 40_000] as const;

export function levelName(n: number): string {
  switch (n) {
    case 1:
      return L('Turista', 'Tourist');
    case 2:
      return L('Excursionista', 'Day-tripper');
    case 3:
      return L('Viajero', 'Traveller');
    case 4:
      return L('Mochilero', 'Backpacker');
    case 5:
      return L('Explorador', 'Explorer');
    case 6:
      return L('Navegante', 'Navigator');
    case 7:
      return L('Cartógrafo', 'Cartographer');
    case 8:
      return L('Geógrafo', 'Geographer');
    case 9:
      return L('Trotamundos', 'Globetrotter');
    default:
      return L('Atlas viviente', 'Living atlas');
  }
}

export function pointsOf(tot: Totals, badges: number): number {
  return (tot.ok ?? 0) * POINTS.ok + (tot.warn ?? 0) * POINTS.warn + badges * POINTS.badge;
}

export interface LevelInfo {
  /** 1 … 10 */
  n: number;
  name: string;
  points: number;
  /** Points the level started at and the ones the next one needs; `next` is null at the top. */
  from: number;
  next: number | null;
  /** 0 … 1 of the way to the next level. */
  part: number;
}

export function levelOfPoints(points: number): LevelInfo {
  let n = 1;
  while (n < LEVEL_AT.length && points >= LEVEL_AT[n]) n++;
  const from = LEVEL_AT[n - 1];
  const next = n < LEVEL_AT.length ? LEVEL_AT[n] : null;
  return { n, name: levelName(n), points, from, next, part: next == null ? 1 : (points - from) / (next - from) };
}
