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
    version: '1.13.0',
    date: '2026-11-18',
    es: [
      'Calendario de actividad: en Progreso, un cuadro por cada día del último año, más oscuro cuanto más respondiste. Al pasar por un día dice lo que hiciste.',
      'Días seguidos: cuántos días llevas jugando sin faltar y cuál fue tu mejor racha. Un día que solo ha empezado no la rompe.',
      'Meta diaria: elige cuántas respuestas quieres dar al día: 10, 20, 50, 100 o ninguna. La portada y Progreso dicen cuánto llevas hoy.',
      'Gráficas: las respuestas de cada semana del último medio año, con las que fueron a la primera, y cómo crece lo que tienes aprendido.',
      'Mes a mes: lo que suman este mes y este año, y una tabla con cada mes: días de juego, partidas, respuestas, aciertos a la primera y tiempo.',
      'Once logros nuevos, y ya son 40: todas las capitales, todas las banderas, continentes y océanos, cinco mil respuestas, una semana y un mes sin faltar.',
      'Y también: diez metas diarias cumplidas, un 10 en un examen, cien tarjetas, y un popurrí y un «Oye y señala» sin un fallo.',
      'Un logro conseguido ya no se pierde: antes podía apagarse al borrar una lista o al fallar algo que ya sabías.',
      'Quien ya jugaba empieza con el calendario de sus últimas partidas y de sus retos diarios. La copia de seguridad guarda también el calendario.',
      'La portada pesa menos: lo que es de los logros y de Progreso se descarga cuando hace falta.',
    ],
    en: [
      'Activity calendar: on Progress, a square for each day of the last year, darker the more you answered. Point at a day and it says what you did.',
      'Days in a row: how many days you have played without a miss, and your longest run. A day that has only begun does not break it.',
      'Daily target: choose how many answers you want to give a day: 10, 20, 50, 100 or none. The home page and Progress say how far you are today.',
      'Charts: the answers of each week of the last half year, with those right first time, and how what you have learnt grows.',
      'Month by month: what this month and this year add up to, and a table of each month: days of play, games, answers, right first time and time.',
      'Eleven new achievements, 40 in all: every capital, every flag, continents and oceans, five thousand answers, a week and a month without a miss.',
      'And also: ten daily targets met, a 10 in an exam, a hundred flashcards, and a medley and a “Listen and pin” without a miss.',
      'An achievement earned is no longer lost: it could go out when a list was deleted or when you missed something you already knew.',
      'Whoever played before starts with the calendar of their latest games and daily challenges. The backup keeps the calendar too.',
      'The home page is lighter: what belongs to the achievements and to Progress is downloaded when it is needed.',
    ],
  },
  {
    version: '1.12.0',
    date: '2026-11-18',
    es: [
      'Tarjetas: una por pieza, para estudiar sin escribir ni señalar. Le das la vuelta y dices tú si la sabías; lo que no sabías vuelve al final.',
      'Las tarjetas preguntan lo que elijas: cómo se llama, dónde está, su capital o de qué país es una bandera. Lo que dices cuenta para el repaso.',
      'Popurrí: cada pieza se pregunta de una manera, por sorteo: señalarla, identificarla, colocarla, su silueta, su capital o su bandera.',
      'Oye y señala: el nombre no se escribe, lo dice la voz de tu dispositivo. Se puede oír otra vez, y verlo escrito cuenta como ayuda.',
      'Siluetas giradas: un ajuste de Silueta, Regionle y el popurrí que las enseña sin el norte arriba.',
      'Banderas difíciles: en gris, para reconocerlas por el dibujo, o desenfocadas, para reconocerlas por los colores.',
      'El popurrí y «Oye y señala» se juegan también contrarreloj, en supervivencia y como examen. El popurrí se envía como reto, con las mismas preguntas.',
      'Un reto recibido dice si viene con siluetas giradas o con banderas difíciles: se juega como lo jugó quien lo envía.',
    ],
    en: [
      'Flashcards: one per piece, to study without typing or clicking. Turn it over and say whether you knew it; what you did not know comes back at the end.',
      'The cards ask what you choose: what it is called, where it is, its capital or which country a flag belongs to. What you say counts for the review.',
      'Medley: each piece is asked in a way of its own, drawn by lot: pin it, identify it, place it, its outline, its capital or its flag.',
      'Listen and pin: the name is not written, the voice of your device says it. You can hear it again, and seeing it written counts as help.',
      'Turned outlines: a setting of Outline, Regionle and the medley that shows them without north at the top.',
      'Hard flags: in grey, to know them by their design, or blurred, to know them by their colours.',
      'The medley and “Listen and pin” are also played against the clock, in survival and as an exam. The medley is sent as a challenge, with the same questions.',
      'A challenge you receive says whether it comes with turned outlines or hard flags: it is played the way its sender played it.',
    ],
  },
  {
    version: '1.11.0',
    date: '2026-11-18',
    es: [
      'Continentes y océanos: el mapa del mundo con los seis continentes, cada uno de un color, y los cinco océanos. Se juega a todo, y a las cifras con su superficie.',
      'En ese mapa cada mar responde por su océano: el Mediterráneo y el Caribe son Atlántico, y el mar Arábigo, Índico.',
      'Penínsulas: treinta, de la Ibérica a Kamchatka, y en el mapa de cada país, las suyas.',
      'Mesetas, llanuras y cabos de todo el mundo, no solo de España: la Gran Llanura Europea, el Tíbet y la Pampa; Buena Esperanza, Hornos y el cabo Norte.',
      'Cataratas: Niágara, Salto Ángel, Iguazú y Victoria.',
      'Lo que se pregunta está siempre en pantalla: el Ártico no se veía en el mapa de Europa ni el mar de Bering en el de Asia. Ahora el mapa llega hasta ellos.',
      'Cuando una pieza es mayor que el mapa (el Atlántico en el de Europa), su nombre y su número se escriben en la parte que se ve.',
      'Senegal, Nicaragua, Siria, Tailandia, Uzbekistán y Serbia ya tienen mapa físico propio: son 63 países.',
    ],
    en: [
      'Continents and oceans: the map of the world with the six continents, each in its own colour, and the five oceans. Every game plays on it, the figures by area.',
      'On that map every sea answers for its ocean: the Mediterranean and the Caribbean are Atlantic, and the Arabian Sea, Indian.',
      'Peninsulas: thirty of them, from Iberia to Kamchatka, and on the map of each country, its own.',
      'Plateaus, plains and capes of the whole world, not only of Spain: the European Plain, Tibet and the Pampas; Good Hope, Cape Horn and the North Cape.',
      'Waterfalls: Niagara, Angel Falls, Iguazu and Victoria.',
      'What is asked is always on screen: the Arctic Ocean could not be seen on the map of Europe, nor the Bering Sea on that of Asia. The map now reaches them.',
      'When a piece is bigger than the map (the Atlantic on that of Europe), its name and its number are written on the part in sight.',
      'Senegal, Nicaragua, Syria, Thailand, Uzbekistan and Serbia now have a physical map of their own: 63 countries in all.',
    ],
  },
  {
    version: '1.10.0',
    date: '2026-11-18',
    es: [
      'Geografía física de España, como en un atlas escolar: 81 ríos, las cordilleras, las mesetas y depresiones, cabos, islas, golfos, picos y embalses.',
      'La física de un país: en Geografía física se elige también un país, y el mapa se centra en él con sus ríos, sus cordilleras y sus mares.',
      'Dos clases nuevas de pieza: cabos, y mesetas y llanuras. De momento, las de España.',
      'El mapa mudo de la física de España se imprime con las Canarias en su recuadro.',
      'El estrecho de Gibraltar, Bab el-Mandeb, el canal de Yucatán y el mar del Scotia eran una mota en el mapa: ahora tienen su contorno y se pueden señalar.',
      'Los Pirineos, la Cordillera Cantábrica y Sierra Morena siguen el relieve, y el Tajo, el Ebro, el Duero, el Guadiana, el Guadalquivir y el Miño ganan detalle.',
    ],
    en: [
      'Physical geography of Spain, as in a school atlas: 81 rivers, the ranges, the plateaus and basins, capes, islands, gulfs, peaks and reservoirs.',
      'The physical map of a country: Physical geography takes a country too, and the map centres on it with its rivers, its ranges and its seas.',
      'Two new kinds of feature: capes, and plateaus and plains. Those of Spain, for the time being.',
      'The blank map of the physical geography of Spain prints with the Canary Islands in their box.',
      'The Strait of Gibraltar, Bab el-Mandeb, the Yucatán Channel and the Scotia Sea were a speck on the map: they now have a shape and can be pointed at.',
      'The Pyrenees, the Cantabrian Mountains and Sierra Morena follow the relief, and the Tagus, Ebro, Douro, Guadiana, Guadalquivir and Minho gain detail.',
    ],
  },
  {
    version: '1.9.0',
    date: '2026-11-18',
    es: [
      'Lo que confundes: si respondes otra pieza del mapa, el juego apunta la pareja; «Progreso» las enseña, las más confundidas primero, y deja practicarlas juntas.',
      'A la segunda vez que tomas una pieza por otra, el juego lo dice en el momento.',
      'Objetivo con fecha: «Poner fecha» hace del mapa elegido, o de una lista, un objetivo para un día; la portada dice cada día cuánto toca aprender y repasar.',
      'Cada objetivo tiene su examen de prueba con todas las piezas, y su fecha se puede mover.',
    ],
    en: [
      'What you mix up: when your answer is another piece of the map, the game notes the pair; “Progress” shows them, the most mixed up first, to practise together.',
      'The second time you take one piece for another, the game says so on the spot.',
      'Goal with a date: “Set a date” turns the chosen map, or a list, into a goal for a day; the first page says each day how much to learn and to review.',
      'Each goal has its mock exam with every piece, and its date can be moved.',
    ],
  },
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
