/** Catalogue of sections and game modes shown in the menus. Texts are read when asked for, in the current language. */
import {
  ArrowUpDown,
  CircleCheck,
  CircleHelp,
  Compass,
  Copy,
  Crosshair,
  Ear,
  Fence,
  Grid3x3,
  Flag,
  GalleryVerticalEnd,
  GraduationCap,
  Grid2x2X,
  Hash,
  Landmark,
  LassoSelect,
  Layers,
  Link2,
  ListOrdered,
  MapPin,
  Navigation,
  PaintBucket,
  Printer,
  Puzzle,
  Route,
  ScanSearch,
  Shapes,
  Shuffle,
  Signpost,
  Target,
  Thermometer,
  Trophy,
  VenetianMask,
  Waypoints,
  type LucideIcon,
} from 'lucide-react';
import { L, getLang } from './i18n';
import { distWord } from './units';
import { PATHS } from './routes';
import { SCREENS } from './seo';
import type { CardAsk, Format } from './store';
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
    desc: L('Por lecciones: unas pocas piezas nuevas cada vez, que primero te presentamos y luego te preguntamos mezcladas con las que ya sabes.', 'In lessons: a few new pieces at a time, first shown to you and then asked mixed with the ones you already know.'),
    icon: GraduationCap,
    level: 1,
    group: 'study',
  };
  /** Nothing is typed and nothing is clicked: the player is their own judge. */
  const cards: ModeDef = {
    id: 'cards',
    name: L('Tarjetas', 'Flashcards'),
    desc: L(
      'Una tarjeta por pieza: piensas la respuesta, le das la vuelta y dices si la sabías. Las que no, vuelven al final. Tú eliges qué pregunta cada tarjeta.',
      'A card for each piece: think of the answer, turn it over and say whether you knew it. The ones you did not come back at the end. You choose what each card asks.',
    ),
    icon: GalleryVerticalEnd,
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
  const listen: ModeDef = {
    id: 'listen',
    name: L('Oye y señala', 'Listen and pin'),
    desc: L('Como «Señalar», pero de oído: el nombre no se escribe, te lo dice la voz del navegador las veces que quieras.', 'Like “Pin it”, but by ear: the name is not written, the voice of the browser says it as many times as you like.'),
    icon: Ear,
    level: 2,
    group: 'map',
  };
  /** A click on a map that shows nothing of what is asked. */
  const blind = (desc: string): ModeDef => ({ id: 'blind', name: L('Situar a ciegas', 'Place it blind'), desc, icon: Crosshair, level: 3, group: 'map' });
  const blindLand = blind(
    L(
      'El mapa no enseña las fronteras: haz clic dentro de donde creas que está cada pieza. Las muy pequeñas valen con quedarse cerca.',
      'The map shows no borders: click inside where you think each piece is. For the very small ones, close is enough.',
    ),
  );
  /** The same with several clicks, each one answered with how warm it was. */
  const hotcold: ModeDef = {
    id: 'hotcold',
    name: L('Caliente y frío', 'Hot and cold'),
    desc: L(
      'Como «Situar a ciegas», con seis clics para cada cosa: si no aciertas, te decimos si vas caliente o frío y si te has acercado.',
      'Like “Place it blind”, with six clicks for each thing: if you miss, you are told whether you are hot or cold and whether you got closer.',
    ),
    icon: Thermometer,
    level: 2,
    group: 'map',
  };
  /** Each piece asked in one of the ways the section has, by lot. */
  const mix = (desc: string): ModeDef => ({ id: 'mix', name: L('Popurrí', 'Medley'), desc, icon: Shuffle, level: 2, group: 'map' });
  const mixShapes = mix(
    L(
      'Cada pieza, de una manera, según toque: señalarla, decir cuál se ilumina, colocarla como en el puzle, reconocer su silueta o dar su capital.',
      'Each piece in a different way, as it comes: pin it, say which one lights up, place it as in the jigsaw, recognise its outline or give its capital.',
    ),
  );
  const mixDots = mix(L('Cada una, de una manera, según toque: unas veces la señalas y otras dices cuál es la que se ilumina.', 'Each one in a different way, as it comes: sometimes you pin it and sometimes you say which one lights up.'));
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
  const outline: ModeDef = {
    id: 'outline',
    name: L('Silueta', 'Outline'),
    desc: L('Reconócelas solo por su forma, sin mapa alrededor. Y si se te queda corto, giradas.', 'Recognise them by their shape alone, with no map around. And if that is not enough, turned round.'),
    icon: Shapes,
    level: 3,
    group: 'shape',
  };
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
  /** A set of pieces named, and all of them marked: what the sets are depends on the map. */
  const group = (desc: string): ModeDef => ({ id: 'group', name: L('Marca el grupo', 'Mark the group'), desc, icon: LassoSelect, level: 2, group: 'map' });
  const neighbours: ModeDef = {
    id: 'neighbours',
    name: L('Vecinos', 'Neighbours'),
    desc: L('De cada pieza, escribe todas las que limitan con ella. El mapa no enseña las fronteras: se va dibujando con tus aciertos.', 'For each piece, type every one that borders it. The map shows no borders: it is drawn as you get them right.'),
    icon: Waypoints,
    level: 3,
    group: 'links',
  };
  const border: ModeDef = {
    id: 'border',
    name: L('Fronteras', 'Borders'),
    desc: L(
      'Se ilumina una frontera en el mapa sin nombres y dices qué dos piezas separa: eligiendo entre cuatro fronteras o escribiendo los dos nombres.',
      'A border lights up on a map without names and you say which two pieces it lies between: choosing among four borders or typing the two names.',
    ),
    icon: Fence,
    level: 2,
    group: 'links',
  };
  const chain: ModeDef = {
    id: 'chain',
    name: L('Cadena de vecinos', 'Neighbour chain'),
    desc: L(
      'De una pieza a una vecina, y de esa a otra, sin pasar dos veces por la misma. El mapa no enseña las fronteras: ¿hasta dónde llegas antes de quedarte sin salida?',
      'From one piece to a neighbour, and on from that one, never through the same piece twice. The map shows no borders: how far do you get before there is no way on?',
    ),
    icon: Link2,
    level: 3,
    group: 'links',
  };
  /** A riddle: clues about a piece, from the widest to the narrowest. */
  const whoami = (desc: string): ModeDef => ({ id: 'whoami', name: L('¿Quién soy?', 'Who am I?'), desc, icon: VenetianMask, level: 2, group: 'facts' });
  const compass: ModeDef = {
    id: 'compass',
    name: L('Norte–sur', 'North–south'),
    desc: L('Cinco a la vez, que ordenas de norte a sur o de oeste a este. Después el mapa te enseña dónde está cada una.', 'Five at a time, to put in order from north to south or from west to east. The map then shows where each one is.'),
    icon: Navigation,
    level: 2,
    group: 'links',
  };
  /** Which way and how far, with nothing on the map; `apart` says what is measured between. */
  const bearing = (apart: string): ModeDef => ({
    id: 'bearing',
    name: L('Distancias y rumbos', 'Distances and bearings'),
    desc: `${L(
      `Sin mirar el mapa: ¿hacia dónde queda un sitio desde otro, y a cuántos ${distWord()}? Al responder, el mapa enseña los dos y la línea que los une.`,
      `Without looking at the map: which way is one place from another, and how many ${distWord()} away? Once you answer, the map shows both and the line between them.`,
    )} ${apart}`,
    icon: Signpost,
    level: 2,
    group: 'links',
  });
  const bearingLand = bearing(L('Se mide de centro a centro.', 'Measured from centre to centre.'));
  /** A point by its latitude and its longitude, marked or read; `what` says which points are asked. */
  const coords = (what: string): ModeDef => ({
    id: 'coords',
    name: L('Coordenadas', 'Coordinates'),
    desc: `${L(
      'Te damos una latitud y una longitud y marcas el punto en el mapa, que lleva dibujados sus paralelos y meridianos. O al revés: el mapa marca un punto y eliges sus coordenadas. Al responder, ves qué había allí.',
      'You get a latitude and a longitude and mark the point on the map, which has its parallels and meridians drawn. Or the other way round: the map marks a point and you choose its coordinates. Once you answer, you see what was there.',
    )} ${what}`,
    icon: Grid3x3,
    level: 2,
    group: 'links',
  });
  const coordsLand = coords(L('Cada punto cae dentro de una pieza del mapa.', 'Each point falls inside a piece of the map.'));
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
        cards,
        print,
        pin,
        listen,
        blindLand,
        hotcold,
        identify,
        nameall,
        puzzle,
        group(
          L(
            'Te damos un grupo —las provincias de una comunidad, las regiones de un país, lo que limita con una pieza— y marcas en el mapa todas las que son de él, y ninguna más.',
            'You get a group — the provinces of a community, the regions of a country, what borders a piece — and mark on the map every piece that is in it, and none besides.',
          ),
        ),
        mixShapes,
        outline,
        regionle,
        neighbours,
        border,
        chain,
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
        bearingLand,
        coordsLand,
        {
          id: 'capital',
          name: L('Capitales', 'Capitals'),
          desc: L('De cada región, su capital. Solo en los países que las tienen en los datos; las que se llaman igual que su región no se preguntan.', 'The capital of each region. Only for the countries whose data has them; the ones named after their region are not asked.'),
          icon: Landmark,
          level: 2,
          group: 'facts',
        },
        whoami(
          L(
            'Una pieza habla de sí misma, pista a pista: su tamaño, hacia dónde cae, con cuántas limita, una vecina, su silueta. Adivínala con las menos pistas que puedas.',
            'A piece tells about itself, clue by clue: its size, where it lies, how many it borders, a neighbour, its outline. Guess it with as few clues as you can.',
          ),
        ),
        ...figures(L('Aquí, por la superficie de cada región.', 'Here, by the area of each region.'), L('¿Qué región?', 'Which region?')),
      ];
    case 'countries':
      return [
        explore,
        learn,
        cards,
        print,
        pin,
        listen,
        blindLand,
        hotcold,
        identify,
        nameall,
        puzzle,
        group(
          L(
            'Te damos un grupo —la Unión Europea, los países sin mar, una parte del continente, los vecinos de un país— y marcas en el mapa todos los que son de él, y ninguno más.',
            'You get a group — the European Union, the landlocked countries, a part of the continent, the neighbours of a country — and mark on the map every country that is in it, and none besides.',
          ),
        ),
        mix(
          L(
            'Cada país, de una manera, según toque: señalarlo, decir cuál se ilumina, colocarlo como en el puzle, reconocer su silueta, su capital o su bandera.',
            'Each country in a different way, as it comes: pin it, say which one lights up, place it as in the jigsaw, recognise its outline, its capital or its flag.',
          ),
        ),
        outline,
        regionle,
        neighbours,
        border,
        chain,
        travel,
        compass,
        bearingLand,
        coordsLand,
        { id: 'capital', name: L('Capitales', 'Capitals'), desc: L('De cada país, su capital. Los que se llaman igual que su capital no se preguntan.', 'The capital of each country. The ones named after their capital are not asked.'), icon: Landmark, level: 2, group: 'facts' },
        {
          id: 'flag',
          name: L('Banderas', 'Flags'),
          desc: L('¿De qué país es cada bandera? Para nota, en gris o desenfocadas.', 'Which country does each flag belong to? For extra credit, in grey or out of focus.'),
          icon: Flag,
          level: 2,
          group: 'facts',
        },
        whoami(
          L(
            'Un país habla de sí mismo, pista a pista: su tamaño, su parte del mundo, sus fronteras, un vecino, su capital, su bandera. Adivínalo con las menos pistas que puedas.',
            'A country tells about itself, clue by clue: its size, its part of the world, its borders, a neighbour, its capital, its flag. Guess it with as few clues as you can.',
          ),
        ),
      ];
    case 'cities':
      return [
        explore,
        learn,
        cards,
        { ...print, desc: L('Para imprimir: el mapa con un punto numerado por ciudad y una línea para escribir cada nombre. Si quieres, sin números y con las soluciones en otra hoja.', 'To print: the map with a numbered dot for each city and a line to write each name on. If you like, without numbers and with the answers on another sheet.') },
        { ...pin, desc: L('Te damos una ciudad y la buscas entre los puntos del mapa.', 'You get a city and find it among the dots on the map.') },
        listen,
        blind(
          L(
            `Sin puntos en el mapa: haz clic donde creas que está la ciudad y puntúas según los ${distWord()} de error.`,
            `No dots on the map: click where you think the city is and score by how many ${distWord()} you are off.`,
          ),
        ),
        hotcold,
        { ...identify, desc: L('Se ilumina un punto del mapa y dices qué ciudad es.', 'A dot lights up and you say which city it is.') },
        nameall,
        group(L('Te damos un país, o una región si has elegido un solo país, y marcas en el mapa todas sus ciudades, y ninguna más.', 'You get a country, or a region when a single country is chosen, and mark all its cities on the map, and none besides.')),
        mixDots,
        {
          id: 'parent',
          name: L('¿A qué pertenece?', 'Where does it belong?'),
          desc: L('De cada ciudad, su país; con un solo país elegido, su región.', 'For each city, its country; with a single country chosen, its region.'),
          icon: Layers,
          level: 2,
          group: 'links',
        },
        compass,
        bearing(L('De ciudad a ciudad, en línea recta.', 'From city to city, as the crow flies.')),
        coords(L('Cada punto es una ciudad.', 'Each point is a city.')),
        whoami(
          L(
            'Una ciudad habla de sí misma, pista a pista: su tamaño, su país o su región, hacia dónde cae, a cuánto está de la más grande. Adivínala con las menos pistas que puedas.',
            'A city tells about itself, clue by clue: its size, its country or its region, where it lies, how far it is from the largest. Guess it with as few clues as you can.',
          ),
        ),
        ...figures(L('Aquí, por la población de cada ciudad.', 'Here, by the population of each city.'), L('¿Qué ciudad?', 'Which city?')),
      ];
    case 'physical':
      return [
        explore,
        learn,
        cards,
        { ...print, desc: L('Para imprimir: ríos, mares, cordilleras y picos sin nombre, con un número en cada uno y una línea para escribirlo. Si quieres, sin números y con las soluciones en otra hoja.', 'To print: rivers, seas, ranges and peaks without names, a number on each and a line to write it on. If you like, without numbers and with the answers on another sheet.') },
        pin,
        listen,
        blind(
          L(
            'El mapa no enseña ríos, mares ni montañas: haz clic donde creas que está cada uno. En un mar o una cordillera, dentro; en un río, sobre su curso.',
            'The map shows no rivers, seas or mountains: click where you think each one is. Inside a sea or a range; on the course of a river.',
          ),
        ),
        hotcold,
        { ...identify, desc: L('Se ilumina un río, un mar, una cordillera o un continente y dices cuál es.', 'A river, a sea, a range or a continent lights up and you say which one it is.') },
        nameall,
        mixDots,
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
        {
          id: 'oddone',
          name: L('El intruso', 'Odd one out'),
          desc: L(
            'Cuatro países y una pregunta: tres tienen algo en común —el continente, el mar, un vecino, el tamaño— y uno no. ¿Cuál?',
            'Four countries and a question: three have something in common — the continent, the sea, a neighbour, the size — and one has not. Which one?',
          ),
          icon: Grid2x2X,
          level: 2,
          group: 'facts',
        },
        {
          id: 'pairs',
          name: L('Parejas', 'Pairs'),
          desc: L(
            'Cartas boca abajo: levanta dos y junta cada bandera con su país, o cada capital con el suyo. Memoria y saber de quién es cada una.',
            'Cards face down: turn two over and put each flag with its country, or each capital with its own. Memory, and knowing whose each one is.',
          ),
          icon: Copy,
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
    case 'hotcold':
      return L('Caliente y frío', 'Hot and cold');
    case 'bearing':
      return L('Distancias y rumbos', 'Distances and bearings');
    case 'coords':
      return L('Coordenadas', 'Coordinates');
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
    case 'group':
      return L('Marca el grupo', 'Mark the group');
    case 'neighbours':
      return L('Vecinos', 'Neighbours');
    case 'chain':
      return L('Cadena de vecinos', 'Neighbour chain');
    case 'border':
      return L('Fronteras', 'Borders');
    case 'capital':
      return L('Capitales', 'Capitals');
    case 'flag':
      return L('Banderas', 'Flags');
    case 'whoami':
      return L('¿Quién soy?', 'Who am I?');
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
    case 'oddone':
      return L('El intruso', 'Odd one out');
    case 'pairs':
      return L('Parejas', 'Pairs');
    case 'topten':
      return L('Los diez primeros', 'The top ten');
    case 'cards':
      return L('Tarjetas', 'Flashcards');
    case 'mix':
      return L('Popurrí', 'Medley');
    case 'listen':
      return L('Oye y señala', 'Listen and pin');
    default:
      return L('¿Qué país?', 'Which country?');
  }
}

export const formatName = (f: Format): string =>
  f === 'timed' ? L('Contrarreloj', 'Time attack') : f === 'lives' ? L('Supervivencia', 'Survival') : f === 'exam' ? L('Examen', 'Exam') : L('Normal', 'Standard');

/** What a pack of flashcards asks, as the question it is. */
export const cardAskName = (ask: CardAsk): string =>
  ask === 'where' ? L('¿Dónde está?', 'Where is it?') : ask === 'capital' ? L('¿Su capital?', 'Its capital?') : ask === 'flag' ? L('¿Qué bandera es?', 'Which flag is it?') : L('¿Cómo se llama?', 'What is it called?');

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

const MODE_IDS: readonly Mode[] = ['explore', 'learn', 'pin', 'identify', 'nameall', 'outline', 'regionle', 'travel', 'puzzle', 'group', 'neighbours', 'border', 'chain', 'capital', 'flag', 'whoami', 'blind', 'hotcold', 'bearing', 'coords', 'edit', 'print', 'exact', 'which', 'hilo', 'rank', 'compass', 'parent', 'truefalse', 'oddone', 'pairs', 'topten', 'cards', 'mix', 'listen'];

export const MODES: Record<Section, ModeDef[]> = lazy(SECTION_IDS, modesOf);
export const MODE_NAME: Record<Mode, string> = lazy(MODE_IDS, modeName);
export const GROUP_NAME: Record<ModeGroup, string> = lazy(MODE_GROUPS, groupName);

/** The name a mode goes by in a section: "¿Qué país?" is "¿Qué ciudad?" among the cities. */
export function modeNameIn(section: Section, mode: Mode): string {
  return MODES[section].find((m) => m.id === mode)?.name ?? MODE_NAME[mode];
}
export const SECTIONS: Record<Section, SectionInfo> = lazy(SECTION_IDS, sectionInfo);
