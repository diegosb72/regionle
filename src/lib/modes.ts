/** Catalogue of sections and game modes shown in the menus. Texts are read when asked for, in the current language. */
import {
  ArrowUpDown,
  CircleHelp,
  Compass,
  Flag,
  Hash,
  Keyboard,
  Landmark,
  ListOrdered,
  MapPin,
  Puzzle,
  Route,
  ScanSearch,
  Shapes,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { L } from './i18n';
import type { Mode, Section } from './types';

export interface ModeDef {
  id: Mode;
  name: string;
  desc: string;
  icon: LucideIcon;
  /** 1 easy … 3 hard */
  level: 1 | 2 | 3;
}

export const SECTION_IDS: readonly Section[] = ['regions', 'countries', 'cities', 'physical', 'pops'];

/** Address of each section; the same in every language, so that links keep working. */
export const PATHS: Record<Section, string> = { regions: 'regiones', countries: 'paises', cities: 'ciudades', physical: 'fisica', pops: 'poblaciones' };

function modesOf(section: Section): ModeDef[] {
  const explore: ModeDef = { id: 'explore', name: L('Explorar', 'Explore'), desc: L('Sin preguntas: recorre el mapa con nombres, datos y enlaces para estudiar.', 'No questions: browse the map with names, facts and links to study.'), icon: Compass, level: 1 };
  const pin: ModeDef = { id: 'pin', name: L('Señalar', 'Pin it'), desc: L('Te damos un nombre y lo buscas en el mapa.', 'You get a name and find it on the map.'), icon: MapPin, level: 1 };
  const identify: ModeDef = { id: 'identify', name: L('Identificar', 'Identify'), desc: L('Se ilumina una zona del mapa y dices cuál es.', 'A part of the map lights up and you say which one it is.'), icon: ScanSearch, level: 2 };
  const nameall: ModeDef = { id: 'nameall', name: L('Nombrarlas todas', 'Name them all'), desc: L('Escribe todos los nombres de memoria mientras el mapa se llena.', 'Type every name from memory while the map fills up.'), icon: Keyboard, level: 3 };
  const outline: ModeDef = { id: 'outline', name: L('Silueta', 'Outline'), desc: L('Reconócelas solo por su forma, sin mapa alrededor.', 'Recognise them by their shape alone, with no map around.'), icon: Shapes, level: 3 };
  const travel: ModeDef = { id: 'travel', name: L('Ruta', 'Route'), desc: L('Une dos puntos del mapa pasando por las menos fronteras posibles.', 'Join two places crossing as few borders as you can.'), icon: Route, level: 3 };
  const puzzle: ModeDef = { id: 'puzzle', name: L('Puzle', 'Jigsaw'), desc: L('Te damos una pieza sin nombre y la colocas en el mapa mudo.', 'You get an unnamed piece and place it on the blank map.'), icon: Puzzle, level: 2 };
  const neighbours: ModeDef = { id: 'neighbours', name: L('Vecinos', 'Neighbours'), desc: L('De cada pieza, señala todas las que limitan con ella.', 'For each piece, pick every one that borders it.'), icon: Waypoints, level: 3 };
  switch (section) {
    case 'regions':
      return [
        explore,
        pin,
        identify,
        nameall,
        outline,
        puzzle,
        neighbours,
        { id: 'capital', name: L('Capitales', 'Capitals'), desc: L('De cada región, su capital. Solo en los países que las tienen en los datos.', 'The capital of each region. Only for the countries whose data has them.'), icon: Landmark, level: 2 },
        travel,
      ];
    case 'countries':
      return [
        explore,
        pin,
        identify,
        { ...nameall, name: L('Nombrarlos todos', 'Name them all') },
        outline,
        puzzle,
        neighbours,
        { id: 'capital', name: L('Capitales', 'Capitals'), desc: L('De cada país, su capital.', 'The capital of each country.'), icon: Landmark, level: 2 },
        { id: 'flag', name: L('Banderas', 'Flags'), desc: L('¿De qué país es cada bandera?', 'Which country does each flag belong to?'), icon: Flag, level: 2 },
        travel,
      ];
    case 'cities':
      return [
        explore,
        { ...pin, name: L('Situar', 'Place it'), desc: L('Te damos una ciudad y la buscas entre los puntos del mapa.', 'You get a city and find it among the dots on the map.') },
        { ...identify, desc: L('Se ilumina un punto del mapa y dices qué ciudad es.', 'A dot lights up and you say which city it is.') },
        nameall,
      ];
    case 'physical':
      return [
        explore,
        pin,
        { ...identify, desc: L('Se ilumina un río, un mar o una cordillera y dices cuál es.', 'A river, a sea or a range lights up and you say which one it is.') },
        { ...nameall, name: L('Nombrarlos todos', 'Name them all') },
      ];
    default:
      return [
        { id: 'hilo', name: L('Mayor o menor', 'Higher or lower'), desc: L('Compara cada país con el anterior y encadena aciertos.', 'Compare each country with the one before and keep the streak going.'), icon: ArrowUpDown, level: 1 },
        { id: 'rank', name: L('Ordena cinco', 'Sort five'), desc: L('Cinco países, de mayor a menor.', 'Five countries, from largest to smallest.'), icon: ListOrdered, level: 2 },
        { id: 'exact', name: L('Cifra exacta', 'Exact figure'), desc: L('Escribe la cifra: cuanto más te acerques, mejor.', 'Type the figure: the closer, the better.'), icon: Hash, level: 3 },
        { id: 'which', name: L('¿Qué país?', 'Which country?'), desc: L('Te damos la cifra y adivinas el país con pistas de más y menos.', 'You get the figure and guess the country with higher and lower clues.'), icon: CircleHelp, level: 3 },
      ];
  }
}

function modeName(mode: Mode): string {
  switch (mode) {
    case 'explore':
      return L('Explorar', 'Explore');
    case 'pin':
      return L('Señalar', 'Pin it');
    case 'identify':
      return L('Identificar', 'Identify');
    case 'nameall':
      return L('Nombrar todo', 'Name them all');
    case 'outline':
      return L('Silueta', 'Outline');
    case 'travel':
      return L('Ruta', 'Route');
    case 'puzzle':
      return L('Puzle', 'Jigsaw');
    case 'neighbours':
      return L('Vecinos', 'Neighbours');
    case 'capital':
      return L('Capitales', 'Capitals');
    case 'flag':
      return L('Banderas', 'Flags');
    case 'hilo':
      return L('Mayor o menor', 'Higher or lower');
    case 'rank':
      return L('Ordena cinco', 'Sort five');
    case 'exact':
      return L('Cifra exacta', 'Exact figure');
    default:
      return L('¿Qué país?', 'Which country?');
  }
}

export interface SectionInfo {
  path: string;
  name: string;
  title: string;
  blurb: string;
}

function sectionInfo(section: Section): SectionInfo {
  const path = PATHS[section];
  switch (section) {
    case 'regions':
      return {
        path,
        name: L('Regiones', 'Regions'),
        title: L('Regiones, provincias y estados', 'Regions, provinces and states'),
        blurb: L('Las divisiones internas de los países que elijas, todas juntas en un mismo mapa.', 'The internal divisions of the countries you choose, all together on one map.'),
      };
    case 'countries':
      return {
        path,
        name: L('Países', 'Countries'),
        title: L('Países, capitales y banderas', 'Countries, capitals and flags'),
        blurb: L('Sitúa, nombra y reconoce los países del mundo o solo los que te interesen.', 'Place, name and recognise the countries of the world, or just the ones you care about.'),
      };
    case 'cities':
      return {
        path,
        name: L('Ciudades', 'Cities'),
        title: L('Ciudades y capitales', 'Cities and capitals'),
        blurb: L('Las ciudades más pobladas y las capitales de los países que elijas, punto a punto.', 'The largest cities and the capitals of the countries you choose, dot by dot.'),
      };
    case 'physical':
      return {
        path,
        name: L('Física', 'Physical'),
        title: L('Ríos, mares y montañas', 'Rivers, seas and mountains'),
        blurb: L('Ríos, lagos, mares, cordilleras, desiertos e islas del mundo o de un continente.', 'Rivers, lakes, seas, mountain ranges, deserts and islands of the world or of one continent.'),
      };
    default:
      return {
        path,
        name: L('Cifras', 'Figures'),
        title: L('Población y superficie', 'Population and area'),
        blurb: L('Compara, ordena y afina las cifras de cada país.', 'Compare, sort and pin down the figures of each country.'),
      };
  }
}

/** An object whose entries are worked out each time they are read, so that they follow the language. */
function lazy<K extends string, V>(keys: readonly K[], make: (key: K) => V): Record<K, V> {
  const out = {} as Record<K, V>;
  for (const key of keys) Object.defineProperty(out, key, { enumerable: true, get: () => make(key) });
  return out;
}

const MODE_IDS: readonly Mode[] = ['explore', 'pin', 'identify', 'nameall', 'outline', 'travel', 'puzzle', 'neighbours', 'capital', 'flag', 'exact', 'which', 'hilo', 'rank'];

export const MODES: Record<Section, ModeDef[]> = lazy(SECTION_IDS, modesOf);
export const MODE_NAME: Record<Mode, string> = lazy(MODE_IDS, modeName);
export const SECTIONS: Record<Section, SectionInfo> = lazy(SECTION_IDS, sectionInfo);
