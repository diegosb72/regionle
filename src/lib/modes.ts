/** Catalogue of sections and game modes shown in the menus. Texts are read when asked for, in the current language. */
import {
  ArrowUpDown,
  CircleHelp,
  Compass,
  Crosshair,
  Flag,
  GraduationCap,
  Hash,
  Landmark,
  ListOrdered,
  MapPin,
  PaintBucket,
  Puzzle,
  Route,
  ScanSearch,
  Shapes,
  Target,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { L, getLang } from './i18n';
import { PATHS } from './routes';
import { SCREENS } from './seo';
import type { Format } from './store';
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

export { PATHS };

function modesOf(section: Section): ModeDef[] {
  const explore: ModeDef = { id: 'explore', name: L('Explorar', 'Explore'), desc: L('Sin preguntas: recorre el mapa con nombres, datos y enlaces para estudiar.', 'No questions: browse the map with names, facts and links to study.'), icon: Compass, level: 1 };
  const learn: ModeDef = {
    id: 'learn',
    name: L('Aprender', 'Learn'),
    desc: L('Por lecciones: cinco piezas nuevas cada vez, que primero te presentamos y luego te preguntamos mezcladas con las que ya sabes.', 'In lessons: five new pieces at a time, first shown to you and then asked mixed with the ones you already know.'),
    icon: GraduationCap,
    level: 1,
  };
  const pin: ModeDef = { id: 'pin', name: L('Señalar', 'Pin it'), desc: L('Te damos un nombre y lo buscas en el mapa.', 'You get a name and find it on the map.'), icon: MapPin, level: 1 };
  const identify: ModeDef = { id: 'identify', name: L('Identificar', 'Identify'), desc: L('Se ilumina una zona del mapa y dices cuál es.', 'A part of the map lights up and you say which one it is.'), icon: ScanSearch, level: 2 };
  const nameall: ModeDef = {
    id: 'nameall',
    name: L('Rellenar el mapa', 'Fill the map'),
    desc: L('Un mapa vacío que se llena con lo que escribes de memoria. Si quieres, toca antes la pieza que vas a rellenar.', 'A blank map that fills up with what you type from memory. If you like, tap the piece you are about to fill first.'),
    icon: PaintBucket,
    level: 3,
  };
  const outline: ModeDef = { id: 'outline', name: L('Silueta', 'Outline'), desc: L('Reconócelas solo por su forma, sin mapa alrededor.', 'Recognise them by their shape alone, with no map around.'), icon: Shapes, level: 3 };
  const regionle: ModeDef = {
    id: 'regionle',
    name: 'Regionle',
    desc: L('El juego clásico, sin límite: adivina cuál es por su silueta en seis intentos. Cada fallo te dice a qué distancia y hacia dónde está.', 'The classic game, with no limit: guess which one it is from its outline in six tries. Each miss tells you how far away it is and in which direction.'),
    icon: Target,
    level: 3,
  };
  const travel: ModeDef = { id: 'travel', name: L('Ruta', 'Route'), desc: L('Une dos puntos del mapa pasando por las menos fronteras posibles.', 'Join two places crossing as few borders as you can.'), icon: Route, level: 3 };
  const puzzle: ModeDef = { id: 'puzzle', name: L('Puzle', 'Jigsaw'), desc: L('Te damos una pieza sin nombre y la colocas en el mapa mudo.', 'You get an unnamed piece and place it on the blank map.'), icon: Puzzle, level: 2 };
  const neighbours: ModeDef = {
    id: 'neighbours',
    name: L('Vecinos', 'Neighbours'),
    desc: L('De cada pieza, escribe todas las que limitan con ella. El mapa no enseña las fronteras: se va dibujando con tus aciertos.', 'For each piece, type every one that borders it. The map shows no borders: it is drawn as you get them right.'),
    icon: Waypoints,
    level: 3,
  };
  switch (section) {
    case 'regions':
      return [
        explore,
        learn,
        pin,
        identify,
        nameall,
        outline,
        regionle,
        puzzle,
        neighbours,
        {
          id: 'capital',
          name: L('Capitales', 'Capitals'),
          desc: L('De cada región, su capital. Solo en los países que las tienen en los datos; las que se llaman igual que su región no se preguntan.', 'The capital of each region. Only for the countries whose data has them; the ones named after their region are not asked.'),
          icon: Landmark,
          level: 2,
        },
        travel,
      ];
    case 'countries':
      return [
        explore,
        learn,
        pin,
        identify,
        nameall,
        outline,
        regionle,
        puzzle,
        neighbours,
        { id: 'capital', name: L('Capitales', 'Capitals'), desc: L('De cada país, su capital. Los que se llaman igual que su capital no se preguntan.', 'The capital of each country. The ones named after their capital are not asked.'), icon: Landmark, level: 2 },
        { id: 'flag', name: L('Banderas', 'Flags'), desc: L('¿De qué país es cada bandera?', 'Which country does each flag belong to?'), icon: Flag, level: 2 },
        travel,
      ];
    case 'cities':
      return [
        explore,
        learn,
        { ...pin, desc: L('Te damos una ciudad y la buscas entre los puntos del mapa.', 'You get a city and find it among the dots on the map.') },
        {
          id: 'blind',
          name: L('Situar a ciegas', 'Place it blind'),
          desc: L('Sin puntos en el mapa: haz clic donde creas que está la ciudad y puntúas según los kilómetros de error.', 'No dots on the map: click where you think the city is and score by how many kilometres you are off.'),
          icon: Crosshair,
          level: 3,
        },
        { ...identify, desc: L('Se ilumina un punto del mapa y dices qué ciudad es.', 'A dot lights up and you say which city it is.') },
        nameall,
      ];
    case 'physical':
      return [
        explore,
        learn,
        pin,
        { ...identify, desc: L('Se ilumina un río, un mar o una cordillera y dices cuál es.', 'A river, a sea or a range lights up and you say which one it is.') },
        nameall,
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
    case 'learn':
      return L('Aprender', 'Learn');
    case 'regionle':
      return 'Regionle';
    case 'blind':
      return L('Situar a ciegas', 'Place it blind');
    case 'edit':
      return L('Lista a medida', 'Custom list');
    case 'nameall':
      return L('Rellenar el mapa', 'Fill the map');
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

export const formatName = (f: Format): string => (f === 'timed' ? L('Contrarreloj', 'Time attack') : f === 'lives' ? L('Supervivencia', 'Survival') : L('Normal', 'Standard'));

export interface SectionInfo {
  path: string;
  /** Its short name, as the menu says it. */
  name: string;
  /** The heading of its screen, which is also how the title of its page starts (`seo.ts`). */
  title: string;
  blurb: string;
}

function sectionInfo(section: Section): SectionInfo {
  const path = PATHS[section];
  const title = SCREENS[path][getLang()].name;
  switch (section) {
    case 'regions':
      return {
        path,
        name: L('Regiones', 'Regions'),
        title,
        blurb: L('Las divisiones internas de los países que elijas, todas juntas en un mismo mapa.', 'The internal divisions of the countries you choose, all together on one map.'),
      };
    case 'countries':
      return {
        path,
        name: L('Países', 'Countries'),
        title,
        blurb: L('Sitúa, nombra y reconoce los países del mundo o solo los que te interesen.', 'Place, name and recognise the countries of the world, or just the ones you care about.'),
      };
    case 'cities':
      return {
        path,
        name: L('Ciudades', 'Cities'),
        title,
        blurb: L('Las ciudades más pobladas y las capitales de los países que elijas, punto a punto.', 'The largest cities and the capitals of the countries you choose, dot by dot.'),
      };
    case 'physical':
      return {
        path,
        name: L('Física', 'Physical'),
        title,
        blurb: L('Ríos, lagos, mares, cordilleras, picos, desiertos e islas del mundo o de un continente.', 'Rivers, lakes, seas, mountain ranges, peaks, deserts and islands of the world or of one continent.'),
      };
    default:
      return {
        path,
        name: L('Cifras', 'Figures'),
        title,
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

const MODE_IDS: readonly Mode[] = ['explore', 'learn', 'pin', 'identify', 'nameall', 'outline', 'regionle', 'travel', 'puzzle', 'neighbours', 'capital', 'flag', 'blind', 'edit', 'exact', 'which', 'hilo', 'rank'];

export const MODES: Record<Section, ModeDef[]> = lazy(SECTION_IDS, modesOf);
export const MODE_NAME: Record<Mode, string> = lazy(MODE_IDS, modeName);
export const SECTIONS: Record<Section, SectionInfo> = lazy(SECTION_IDS, sectionInfo);
