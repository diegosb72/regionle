/** Catalogue of sections and game modes shown in the menus. Texts are read when asked for, in the current language. */
import {
  ArrowUpDown,
  CircleCheck,
  CircleHelp,
  Compass,
  Crosshair,
  Flag,
  GraduationCap,
  Hash,
  Landmark,
  Layers,
  ListOrdered,
  MapPin,
  Navigation,
  PaintBucket,
  Printer,
  Puzzle,
  Route,
  ScanSearch,
  Shapes,
  Target,
  Trophy,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { L, getLang } from './i18n';
import { PATHS } from './routes';
import { SCREENS } from './seo';
import type { Format } from './store';
import type { Mode, Section } from './types';

/** What the modes of a section are gathered by in its menu. */
export type ModeGroup = 'study' | 'map' | 'shape' | 'links' | 'facts' | 'figures';
export const MODE_GROUPS: readonly ModeGroup[] = ['study', 'map', 'shape', 'links', 'facts', 'figures'];

export interface ModeDef {
  id: Mode;
  name: string;
  desc: string;
  icon: LucideIcon;
  /** 1 easy … 3 hard; 0 for what is not played and so is neither. */
  level: 0 | 1 | 2 | 3;
  group: ModeGroup;
}

export const SECTION_IDS: readonly Section[] = ['regions', 'countries', 'cities', 'physical', 'pops'];

export { PATHS };

function groupName(group: ModeGroup): string {
  switch (group) {
    case 'study':
      return L('Para estudiar', 'To study');
    case 'map':
      return L('En el mapa', 'On the map');
    case 'shape':
      return L('Por la forma', 'By shape');
    case 'links':
      return L('Vecinos y posición', 'Neighbours and position');
    case 'facts':
      return L('Datos', 'Facts');
    default:
      return L('Cifras', 'Figures');
  }
}

function modesOf(section: Section): ModeDef[] {
  const explore: ModeDef = { id: 'explore', name: L('Explorar', 'Explore'), desc: L('Sin preguntas: recorre el mapa con nombres, datos y enlaces para estudiar.', 'No questions: browse the map with names, facts and links to study.'), icon: Compass, level: 1, group: 'study' };
  const learn: ModeDef = {
    id: 'learn',
    name: L('Aprender', 'Learn'),
    desc: L('Por lecciones: cinco piezas nuevas cada vez, que primero te presentamos y luego te preguntamos mezcladas con las que ya sabes.', 'In lessons: five new pieces at a time, first shown to you and then asked mixed with the ones you already know.'),
    icon: GraduationCap,
    level: 1,
    group: 'study',
  };
  /** Not a game: the same map on paper. It sits with what is there to study with. */
  const print: ModeDef = {
    id: 'print',
    name: L('Mapa mudo', 'Blank map'),
    desc: L(
      'Para imprimir: el mapa sin nombres, con un número en cada pieza y una línea para escribir cada nombre. Si quieres, sin números y con las soluciones en otra hoja.',
      'To print: the map without names, a number on each piece and a line to write each name on. If you like, without numbers and with the answers on another sheet.',
    ),
    icon: Printer,
    level: 0,
    group: 'study',
  };
  const pin: ModeDef = { id: 'pin', name: L('Señalar', 'Pin it'), desc: L('Te damos un nombre y lo buscas en el mapa.', 'You get a name and find it on the map.'), icon: MapPin, level: 1, group: 'map' };
  const identify: ModeDef = { id: 'identify', name: L('Identificar', 'Identify'), desc: L('Se ilumina una zona del mapa y dices cuál es.', 'A part of the map lights up and you say which one it is.'), icon: ScanSearch, level: 2, group: 'map' };
  const nameall: ModeDef = {
    id: 'nameall',
    name: L('Rellenar el mapa', 'Fill the map'),
    desc: L(
      'Un mapa vacío que se llena con lo que escribes de memoria, sin prisa o con cuenta atrás. Si quieres, toca antes la pieza que vas a rellenar.',
      'A blank map that fills up with what you type from memory, at your own pace or against a countdown. If you like, tap the piece you are about to fill first.',
    ),
    icon: PaintBucket,
    level: 3,
    group: 'map',
  };
  const outline: ModeDef = { id: 'outline', name: L('Silueta', 'Outline'), desc: L('Reconócelas solo por su forma, sin mapa alrededor.', 'Recognise them by their shape alone, with no map around.'), icon: Shapes, level: 3, group: 'shape' };
  const regionle: ModeDef = {
    id: 'regionle',
    name: 'Regionle',
    desc: L('El juego clásico, sin límite: adivina cuál es por su silueta en seis intentos. Cada fallo te dice a qué distancia y hacia dónde está.', 'The classic game, with no limit: guess which one it is from its outline in six tries. Each miss tells you how far away it is and in which direction.'),
    icon: Target,
    level: 3,
    group: 'shape',
  };
  const travel: ModeDef = { id: 'travel', name: L('Ruta', 'Route'), desc: L('Une dos puntos del mapa pasando por las menos fronteras posibles.', 'Join two places crossing as few borders as you can.'), icon: Route, level: 3, group: 'links' };
  const puzzle: ModeDef = { id: 'puzzle', name: L('Puzle', 'Jigsaw'), desc: L('Te damos una pieza sin nombre y la colocas en el mapa mudo.', 'You get an unnamed piece and place it on the blank map.'), icon: Puzzle, level: 2, group: 'map' };
  const neighbours: ModeDef = {
    id: 'neighbours',
    name: L('Vecinos', 'Neighbours'),
    desc: L('De cada pieza, escribe todas las que limitan con ella. El mapa no enseña las fronteras: se va dibujando con tus aciertos.', 'For each piece, type every one that borders it. The map shows no borders: it is drawn as you get them right.'),
    icon: Waypoints,
    level: 3,
    group: 'links',
  };
  const compass: ModeDef = {
    id: 'compass',
    name: L('Norte–sur', 'North–south'),
    desc: L('Cinco a la vez, que ordenas de norte a sur o de oeste a este. Después el mapa te enseña dónde está cada una.', 'Five at a time, to put in order from north to south or from west to east. The map then shows where each one is.'),
    icon: Navigation,
    level: 2,
    group: 'links',
  };
  /** The number games, said for what each section measures. */
  const figures = (by: string, which: string): ModeDef[] => [
    { id: 'hilo', name: L('Mayor o menor', 'Higher or lower'), desc: `${L('Compara cada cifra con la anterior y encadena aciertos.', 'Compare each figure with the one before and keep the streak going.')} ${by}`, icon: ArrowUpDown, level: 1, group: 'figures' },
    { id: 'rank', name: L('Ordena cinco', 'Sort five'), desc: `${L('Cinco a la vez, de mayor a menor.', 'Five at a time, from largest to smallest.')} ${by}`, icon: ListOrdered, level: 2, group: 'figures' },
    { id: 'exact', name: L('Cifra exacta', 'Exact figure'), desc: `${L('Escribe la cifra: cuanto más te acerques, mejor.', 'Type the figure: the closer, the better.')} ${by}`, icon: Hash, level: 3, group: 'figures' },
    { id: 'which', name: which, desc: `${L('Te damos la cifra y adivinas de quién es, con pistas de más y menos.', 'You get the figure and guess whose it is, with higher and lower clues.')} ${by}`, icon: CircleHelp, level: 3, group: 'figures' },
    { id: 'topten', name: L('Los diez primeros', 'The top ten'), desc: `${L('Escribe de memoria los diez primeros, en cualquier orden; con cinco fallos se acaba.', 'Type the top ten from memory, in any order; five misses end the game.')} ${by}`, icon: Trophy, level: 3, group: 'figures' },
  ];
  switch (section) {
    case 'regions':
      return [
        explore,
        learn,
        print,
        pin,
        identify,
        nameall,
        puzzle,
        outline,
        regionle,
        neighbours,
        travel,
        {
          id: 'parent',
          name: L('¿A qué pertenece?', 'Where does it belong?'),
          desc: L(
            'De cada pieza, el grupo en el que está: la comunidad de una provincia, la región de un departamento. Solo en los países que se juegan a varios niveles, y en el más fino.',
            'For each piece, the group it is part of: the community of a province, the region of a department. Only in the countries played at several levels, and at the finest one.',
          ),
          icon: Layers,
          level: 2,
          group: 'links',
        },
        compass,
        {
          id: 'capital',
          name: L('Capitales', 'Capitals'),
          desc: L('De cada región, su capital. Solo en los países que las tienen en los datos; las que se llaman igual que su región no se preguntan.', 'The capital of each region. Only for the countries whose data has them; the ones named after their region are not asked.'),
          icon: Landmark,
          level: 2,
          group: 'facts',
        },
        ...figures(L('Aquí, por la superficie de cada región.', 'Here, by the area of each region.'), L('¿Qué región?', 'Which region?')),
      ];
    case 'countries':
      return [
        explore,
        learn,
        print,
        pin,
        identify,
        nameall,
        puzzle,
        outline,
        regionle,
        neighbours,
        travel,
        compass,
        { id: 'capital', name: L('Capitales', 'Capitals'), desc: L('De cada país, su capital. Los que se llaman igual que su capital no se preguntan.', 'The capital of each country. The ones named after their capital are not asked.'), icon: Landmark, level: 2, group: 'facts' },
        { id: 'flag', name: L('Banderas', 'Flags'), desc: L('¿De qué país es cada bandera?', 'Which country does each flag belong to?'), icon: Flag, level: 2, group: 'facts' },
      ];
    case 'cities':
      return [
        explore,
        learn,
        { ...print, desc: L('Para imprimir: el mapa con un punto numerado por ciudad y una línea para escribir cada nombre. Si quieres, sin números y con las soluciones en otra hoja.', 'To print: the map with a numbered dot for each city and a line to write each name on. If you like, without numbers and with the answers on another sheet.') },
        { ...pin, desc: L('Te damos una ciudad y la buscas entre los puntos del mapa.', 'You get a city and find it among the dots on the map.') },
        {
          id: 'blind',
          name: L('Situar a ciegas', 'Place it blind'),
          desc: L('Sin puntos en el mapa: haz clic donde creas que está la ciudad y puntúas según los kilómetros de error.', 'No dots on the map: click where you think the city is and score by how many kilometres you are off.'),
          icon: Crosshair,
          level: 3,
          group: 'map',
        },
        { ...identify, desc: L('Se ilumina un punto del mapa y dices qué ciudad es.', 'A dot lights up and you say which city it is.') },
        nameall,
        {
          id: 'parent',
          name: L('¿A qué pertenece?', 'Where does it belong?'),
          desc: L('De cada ciudad, su país; con un solo país elegido, su región.', 'For each city, its country; with a single country chosen, its region.'),
          icon: Layers,
          level: 2,
          group: 'links',
        },
        compass,
        ...figures(L('Aquí, por la población de cada ciudad.', 'Here, by the population of each city.'), L('¿Qué ciudad?', 'Which city?')),
      ];
    case 'physical':
      return [
        explore,
        learn,
        { ...print, desc: L('Para imprimir: ríos, mares, cordilleras y picos sin nombre, con un número en cada uno y una línea para escribirlo. Si quieres, sin números y con las soluciones en otra hoja.', 'To print: rivers, seas, ranges and peaks without names, a number on each and a line to write it on. If you like, without numbers and with the answers on another sheet.') },
        pin,
        { ...identify, desc: L('Se ilumina un río, un mar, una cordillera o un continente y dices cuál es.', 'A river, a sea, a range or a continent lights up and you say which one it is.') },
        nameall,
        ...figures(L('Aquí, por la altitud de los picos y la superficie de continentes, océanos, mares, lagos e islas.', 'Here, by the height of peaks and the area of continents, oceans, seas, lakes and islands.'), L('¿Cuál es?', 'Which one?')),
      ];
    default:
      return [
        ...figures(L('Con la población, la superficie o la densidad de los países.', 'With the population, the area or the density of the countries.'), L('¿Qué país?', 'Which country?')),
        {
          id: 'truefalse',
          name: L('Verdadero o falso', 'True or false'),
          desc: L('Frases sobre los países que has elegido: fronteras, capitales, tamaños, continentes. ¿Verdadero o falso?', 'Statements about the countries you chose: borders, capitals, sizes, continents. True or false?'),
          icon: CircleCheck,
          level: 1,
          group: 'facts',
        },
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
    case 'print':
      return L('Mapa mudo', 'Blank map');
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
    case 'compass':
      return L('Norte–sur', 'North–south');
    case 'parent':
      return L('¿A qué pertenece?', 'Where does it belong?');
    case 'truefalse':
      return L('Verdadero o falso', 'True or false');
    case 'topten':
      return L('Los diez primeros', 'The top ten');
    default:
      return L('¿Qué país?', 'Which country?');
  }
}

export const formatName = (f: Format): string =>
  f === 'timed' ? L('Contrarreloj', 'Time attack') : f === 'lives' ? L('Supervivencia', 'Survival') : f === 'exam' ? L('Examen', 'Exam') : L('Normal', 'Standard');

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
        blurb: L(
          'Continentes y océanos, ríos, mares, cordilleras, picos, penínsulas, cabos e islas del mundo, de un continente o de un país. España, con el detalle de un atlas escolar.',
          'Continents and oceans, rivers, seas, mountain ranges, peaks, peninsulas, capes and islands of the world, of one continent or of one country. Spain, in the detail of a school atlas.',
        ),
      };
    default:
      return {
        path,
        name: L('Cifras', 'Figures'),
        title,
        blurb: L('Compara, ordena y afina las cifras de cada país, y pon a prueba lo que sabes de ellos.', 'Compare, sort and pin down the figures of each country, and test what you know about them.'),
      };
  }
}

/** An object whose entries are worked out each time they are read, so that they follow the language. */
function lazy<K extends string, V>(keys: readonly K[], make: (key: K) => V): Record<K, V> {
  const out = {} as Record<K, V>;
  for (const key of keys) Object.defineProperty(out, key, { enumerable: true, get: () => make(key) });
  return out;
}

const MODE_IDS: readonly Mode[] = ['explore', 'learn', 'pin', 'identify', 'nameall', 'outline', 'regionle', 'travel', 'puzzle', 'neighbours', 'capital', 'flag', 'blind', 'edit', 'print', 'exact', 'which', 'hilo', 'rank', 'compass', 'parent', 'truefalse', 'topten'];

export const MODES: Record<Section, ModeDef[]> = lazy(SECTION_IDS, modesOf);
export const MODE_NAME: Record<Mode, string> = lazy(MODE_IDS, modeName);
export const GROUP_NAME: Record<ModeGroup, string> = lazy(MODE_GROUPS, groupName);

/** The name a mode goes by in a section: "¿Qué país?" is "¿Qué ciudad?" among the cities. */
export function modeNameIn(section: Section, mode: Mode): string {
  return MODES[section].find((m) => m.id === mode)?.name ?? MODE_NAME[mode];
}
export const SECTIONS: Record<Section, SectionInfo> = lazy(SECTION_IDS, sectionInfo);
