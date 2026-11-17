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
    version: '1.5.0',
    date: '2026-11-17',
    es: [
      'Los mapas se juegan también con el teclado: las flechas recorren las piezas, Intro elige y +, − y 0 mueven el zoom.',
      'La portada descarga menos de la mitad de código que antes: cada pantalla se pide cuando hace falta.',
      'El enlace del juego se comparte con título, descripción e imagen, y hay una página para cada idioma.',
      'Imagen para compartir el resultado del reto del día.',
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
