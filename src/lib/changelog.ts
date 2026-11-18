/**
 * What each version brought, newest first, in both languages: the screen "Acerca de" shows it, and
 * `CHANGELOG.md` says the same in Spanish. That file is written from this one (`npm test -- -u`), and
 * the tests fail when the two differ.
 *
 * The first entry is the version of `package.json`: a new entry here goes with a new number there.
 */
export interface Release {
  version: string;
  /** "2026-11-17" */
  date: string;
  es: string[];
  en: string[];
}

export const RELEASES: Release[] = [
  {
    version: '1.8.0',
    date: '2026-11-18',
    es: [
      'Modo examen en Señalar, Identificar, Silueta, Puzle, Capitales, Banderas y ¿A qué pertenece?: un intento por pregunta, sin pistas ni corrección hasta entregar.',
      'Al entregar el examen, la nota sobre 10 y la corrección, con lo que respondiste en cada fallo; se guarda la mejor nota de cada mapa.',
      'Mapa mudo para imprimir en Regiones, Países, Ciudades y Geografía física: el mapa numerado, una línea para cada nombre y, si quieres, la hoja de soluciones.',
      'En la hoja, lo que queda lejos va en un recuadro (Canarias, Alaska y Hawái, Azores y Madeira) y el papel se tumba cuando el mapa lo pide.',
      'La hoja se saca también de una lista a medida, con el título que le pongas, o sin números, para escribir o colorear encima.',
      'El interruptor «Mapa mudo» de Ruta se llama ahora «Mapa sin fronteras».',
    ],
    en: [
      'Exam format in Pin it, Identify, Outline, Jigsaw, Capitals, Flags and Where does it belong?: one try per question, no hints and no marking until handed in.',
      'When the exam is handed in, a mark out of 10 and the marking, with what you answered where you were wrong; the best mark on each map is kept.',
      'Blank map to print in Regions, Countries, Cities and Physical geography: the numbered map, a line for each name and, if you want it, the answer sheet.',
      'On the sheet, what lies far away goes in a box (the Canaries, Alaska and Hawaii, the Azores and Madeira) and the paper lies down when the map calls for it.',
      'The sheet can also be made from a custom list, with the title you give it, or without numbers, to write or colour on.',
      'The “Blank map” switch of Route is now called “Map without borders”.',
    ],
  },
  {
    version: '1.7.0',
    date: '2026-11-18',
    es: [
      'Verdadero o falso: frases sobre los países que elijas (fronteras, capitales, tamaños, vecinos, continentes), con el porqué de cada una.',
      'Los diez primeros: escribe de memoria los primeros de un mapa por su cifra; cada acierto ocupa su puesto y al quinto fallo se acaba.',
      '¿A qué pertenece?: de cada provincia, su comunidad; de cada ciudad, su país o su región.',
      'Norte–sur: cinco lugares del mapa que se ordenan de norte a sur o de oeste a este.',
      'Los juegos de cifras ya no son solo de países: población de las ciudades, superficie de regiones, lagos, islas y mares y altitud de los picos.',
      'Densidad de población, junto a la población y la superficie de los países.',
      'Rellenar el mapa con cuenta atrás: 2, 5, 10 o 15 minutos.',
      '«Más atajos» en la selección de países: OTAN, Schengen, eurozona, BRICS, Liga Árabe, antigua URSS, microestados, sin salida al mar y otros seis.',
      'Los modos de cada sección van agrupados en el menú: para estudiar, en el mapa, por la forma, vecinos y posición, datos y cifras.',
    ],
    en: [
      'True or false: statements about the countries you choose (borders, capitals, sizes, neighbours, continents), each with the reason why.',
      'The top ten: type from memory the first ones of a map by its figure; each right one takes its place and the fifth miss ends the game.',
      'Where does it belong?: the community of each province; the country or the region of each city.',
      'North–south: five places on the map to put in order from north to south or from west to east.',
      'The figure games are no longer only about countries: population of cities, area of regions, lakes, islands and seas, and height of peaks.',
      'Population density, next to the population and the area of countries.',
      'Filling the map against a countdown: 2, 5, 10 or 15 minutes.',
      '“More shortcuts” when choosing countries: NATO, Schengen, the euro area, BRICS, the Arab League, the former USSR, microstates, landlocked and six more.',
      'The modes of each section are grouped in the menu: to study, on the map, by shape, neighbours and position, facts and figures.',
    ],
  },
  {
    version: '1.6.0',
    date: '2026-11-18',
    es: [
      'Cada sección, el reto del día y «Acerca de» tienen página propia en cada idioma, con su título y su descripción para buscadores y enlaces.',
      'El altavoz de un nombre es un interruptor: se ve y se anuncia mientras suena, y al pulsarlo otra vez se calla.',
      'La portada cuenta los retos entre dos y las listas a medida, y cada cosa tiene una página que explica cómo se hace.',
      'La ficha de Wikipedia de las comunidades y regiones agrupadas se busca por su código ISO, para que salga la del territorio y no la de su gobierno.',
      '«Saltar al contenido» lleva al contenido en lugar de a «Esa dirección no existe».',
    ],
    en: [
      'Each section, the daily challenge and “About” have a page of their own in each language, with its own title and description for search engines and links.',
      'The loudspeaker next to a name is a switch: it shows and announces that it is playing, and pressing it again stops it.',
      'The first page tells about challenges for two and custom lists, and each has a page that explains how it is done.',
      'The Wikipedia card of grouped regions is looked up by their ISO code, so that it shows the territory and not its government.',
      '“Skip to content” goes to the content instead of to “That address does not exist”.',
    ],
  },
  {
    version: '1.5.0',
    date: '2026-11-17',
    es: [
      'Los mapas se juegan también con el teclado: las flechas recorren las piezas, Intro elige y +, − y 0 mueven el zoom.',
      'La portada descarga menos de la mitad de código que antes: cada pantalla se pide cuando hace falta.',
      'El enlace del juego se comparte con título, descripción e imagen, y hay una página para cada idioma.',
      'Imagen para compartir el resultado del reto del día.',
      'La portada recuerda los últimos mapas jugados y las selecciones guardadas, para seguir con un clic.',
      'En Progreso, lo que más fallas, mapa por mapa, con una partida para practicarlo; y el repaso se descarga en CSV.',
      'Los menús dicen cuánto dura la partida elegida y qué porcentaje aciertas a la primera en ese modo.',
      'Atajos de teclado en cualquier pantalla (1 a 5, R, P y T) y «?» para verlos todos.',
      'Sonidos y vibración al responder, si se activan en el pie de página.',
      'Página «Acerca de» con las novedades, las licencias y qué se guarda y dónde.',
      'Bienvenida para quien entra por primera vez.',
      'Si una pantalla falla, lo dice y deja seguir; una dirección que no existe lo dice en lugar de enseñar la portada.',
      'Configuración enseña las variantes que acepta cada patrón en lugar del patrón.',
    ],
    en: [
      'Maps can be played with the keyboard too: the arrows move over the pieces, Enter chooses and +, − and 0 move the zoom.',
      'The first page downloads less than half the code it did: each screen is fetched when it is needed.',
      'The link to the game is shared with a title, a description and a picture, and each language has a page of its own.',
      'A picture to share the result of the daily challenge.',
      'The first page remembers the last maps played and the saved selections, to pick up with one click.',
      'In Progress, what you miss most, map by map, with a game to practise it; and the review can be downloaded as CSV.',
      'The menus say how long the chosen game takes and what share you get right first time in that mode.',
      'Keyboard shortcuts on any screen (1 to 5, R, P and T) and “?” to see them all.',
      'Sounds and vibration when you answer, if turned on in the footer.',
      'An “About” page with what is new, the licences and what is kept and where.',
      'A welcome for first-time visitors.',
      'If a screen breaks, it says so and lets you go on; an address that does not exist says so instead of showing the first page.',
      'Settings show the spellings each pattern accepts instead of the pattern.',
    ],
  },
  {
    version: '1.4.0',
    date: '2026-11-17',
    es: [
      'Abreviaturas y variantes de las regiones según la lista de type-ins de un quiz de JetPunk.',
      'Nombres repasados: cambian 276 piezas de 87 países, 59 ciudades y 33 capitales.',
    ],
    en: ['Short forms and spellings of the regions after the type-in list of a JetPunk quiz.', 'Names revised: 276 pieces in 87 countries, 59 cities and 33 capitals change.'],
  },
  {
    version: '1.3.0',
    date: '2026-11-17',
    es: ['Un nombre de varias palabras se puede escribir por sus iniciales.', 'Pantalla de Configuración: qué vale al escribir cada nombre, pieza por pieza.'],
    en: ['A name of several words can be typed by its initials.', 'Settings screen: what counts when typing each name, piece by piece.'],
  },
  {
    version: '1.2.0',
    date: '2026-11-16',
    es: [
      'Aprender por lecciones, Regionle sin límite y Situar a ciegas.',
      'Contrarreloj y supervivencia, listas a medida que se comparten con un enlace, logros y niveles.',
      'La respuesta se escribe; ni el mapa ni las opciones la delatan.',
      'Botón para oír los nombres y colores para daltónicos.',
    ],
    en: [
      'Learn in lessons, Regionle with no limit and Place it blind.',
      'Time attack and survival, custom lists shared with a link, achievements and levels.',
      'Answers are typed; neither the map nor the options give them away.',
      'A button to hear the names and colour-blind friendly colours.',
    ],
  },
  {
    version: '1.1.0',
    date: '2026-11-16',
    es: [
      'Reto del día, repaso espaciado y retos por enlace.',
      'Ciudades y geografía física; Puzle, Vecinos y las capitales de las regiones.',
      'En español y en inglés; se instala y funciona sin conexión.',
    ],
    en: ['Daily challenge, spaced review and challenges by link.', 'Cities and physical geography; Jigsaw, Neighbours and the capitals of the regions.', 'In Spanish and English; it can be installed and works without a connection.'],
  },
  {
    version: '1.0.0',
    date: '2026-11-16',
    es: ['Primera versión: regiones y países de todo el mundo, capitales, banderas y cifras, sin límite de partidas.'],
    en: ['First version: regions and countries of the whole world, capitals, flags and figures, with no limit of games.'],
  },
];

/** "2026-11-17" → "17 de noviembre de 2026" */
function longDate(date: string): string {
  const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const [y, m, d] = date.split('-').map(Number);
  return `${d} de ${MONTHS[m - 1]} de ${y}`;
}

/** The file `CHANGELOG.md`: the same list, in Spanish. */
export function changelogMarkdown(releases: Release[] = RELEASES): string {
  const head = [
    '# Novedades de Regionle ∞',
    '',
    'Lo que ha traído cada versión, de la más reciente a la primera. Es la misma lista que enseña el juego en',
    '«Acerca de»: sale de `src/lib/changelog.ts`, y este archivo se escribe a partir de ella con `npm test -- -u`.',
  ];
  const body = releases.flatMap((r) => ['', `## ${r.version} — ${longDate(r.date)}`, '', ...r.es.map((line) => `- ${line}`)]);
  return `${[...head, ...body].join('\n')}\n`;
}
