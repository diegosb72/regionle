/**
 * How each game is played, written out: what happens step by step, how the answers count, what help
 * there is and a piece of advice. It is what «Cómo se juega» shows during a game and on the screen where
 * one is chosen, and what a player is shown the first time a game is opened.
 *
 * What a game is, in a sentence, is said by its entry in the catalogue (lib/modes.ts): this says the rest.
 * A button is quoted by what it says («Pista», “Hint”), and a test checks that it still says so. The texts
 * are long: nothing that comes with the first page or with a game may import this file.
 */
import { L } from './i18n';
import type { Mode, Section } from './types';

export interface ModeHelp {
  /** How a game goes, a step at a time. */
  steps: string[];
  /** How the answers count. */
  score: string;
  /** The help that can be asked for, and what it costs. */
  aid?: string;
  /** A piece of advice. */
  tip?: string;
}

/** The three marks an answer can get, in the games that ask one thing after another. */
const grades = (): string =>
  L(
    'Cada respuesta cuenta «a la primera» si aciertas sin fallar ni pedir pista, «con ayuda» si aciertas después, y queda «para repasar» si no sale.',
    'Each answer counts as “first time” if you get it with no miss and no hint, as “with help” if you get it after that, and is left “to review” if you do not.',
  );

/** What is missed is asked once more before the game ends. */
const again = (): string => L('Lo que falles vuelve a salir al final de la partida.', 'What you miss comes up again at the end of the game.');

/** …and, in the games that feed it, in the review of the first page. */
const comesBack = (): string =>
  L(
    'Lo que falles vuelve a salir al final de la partida y, pasados unos días, en el repaso de la portada.',
    'What you miss comes up again at the end of the game and, some days later, in the review on the first page.',
  );

/** The other ways the question-by-question games can be played. */
const formats = (): string =>
  L(
    'Si quieres más reto, cambia el formato antes de empezar: «Examen» (no se corrige nada hasta el final, y pone nota), «Contrarreloj» (un minuto) o «Supervivencia» (tres vidas). En los tres hay un solo intento por pregunta y ninguna pista.',
    'For more of a challenge, change the format before starting: “Exam” (nothing is marked until the end, and it gives a grade), “Time attack” (one minute) or “Survival” (three lives). In all three there is one try for each question and no hints.',
  );

/** The menu of hints of the question-by-question games. */
const moreHints = (): string =>
  L(
    '«Otra pista» abre un menú con lo que el juego sabe de la pieza —su tamaño, hacia dónde cae, con qué limita, su capital…— y eliges tú cuál quieres. Con cualquiera, la respuesta cuenta como dada con ayuda.',
    '“Another hint” opens a menu with what the game knows of the piece — its size, where it lies, what it borders, its capital… — and you choose which you want. With any of them, the answer counts as given with help.',
  );

/** How what is typed is read. */
const typing = (): string =>
  L(
    'Al escribir no importan las mayúsculas ni las tildes, y valen las abreviaturas y los nombres en otros idiomas que el juego conoce.',
    'When typing, capitals and accents do not matter, and the abbreviations and the names in other languages that the game knows are accepted.',
  );

const zoom = (): string => L('Acerca el mapa antes de hacer clic: en lo pequeño, un poco de zum es media respuesta.', 'Zoom in before you click: for small things, a little zoom is half the answer.');

/**
 * The help of a game, as it is played in a section. Null for what has no rules to tell (the editor of
 * lists).
 */
export function helpOf(mode: Mode, section: Section): ModeHelp | null {
  /** The games of figures are played with countries alone where there is no map. */
  const noMap = section === 'pops';
  const countries = section === 'countries';
  switch (mode) {
    case 'explore':
      return {
        steps: [
          L('Toca cualquier pieza del mapa, o búscala por su nombre en la lista, para abrir su ficha.', 'Tap any piece of the map, or look it up by name in the list, to open its card.'),
          L(
            'La ficha reúne lo que el juego sabe de ella —sus nombres, su capital, su tamaño, con qué limita— y enlaces para aprender más. También puedes dejarle un apunte tuyo.',
            'The card gathers what the game knows of it — its names, its capital, its size, what it borders — and links to learn more. You can leave a note of your own on it too.',
          ),
          L('Con «Regla para medir», marca dos puntos del mapa y verás la distancia en línea recta entre ellos.', 'With “Ruler”, mark two points on the map and you will see the distance between them as the crow flies.'),
        ],
        score: L('Aquí no se pregunta ni se puntúa nada. La lista señala lo que ya tienes aprendido y lo que tiene un apunte.', 'Nothing is asked or scored here. The list marks what you have already learnt and what has a note.'),
        tip: L('Cuando el mapa te suene, «Ponerme a prueba» te lleva a jugar con él.', 'When the map looks familiar, “Test myself” takes you to play with it.'),
      };
    case 'learn':
      return {
        steps: [
          L(
            'Cada lección presenta unas pocas piezas nuevas, una a una: cinco, o las que elijas en «Piezas por lección». Fíjate en dónde está cada una y en qué tiene alrededor.',
            'Each lesson introduces a few new pieces, one at a time: five, or as many as you choose under “Pieces per lesson”. Look at where each one is and what lies around it.',
          ),
          L(
            'Después te las pregunta, mezcladas con las que ya conoces: unas veces señalas en el mapa la que se nombra y otras dices cuál es la que está resaltada.',
            'Then it asks you about them, mixed with the ones you already know: sometimes you pin the one that is named and sometimes you say which one is highlighted.',
          ),
          L('Tienes dos intentos. Lo que falles vuelve a salir al momento, hasta que lo aciertes.', 'You have two tries. What you miss comes up again shortly, until you get it right.'),
          L('Al acabar la lección puedes seguir con la siguiente o dejarlo ahí: la próxima vez empieza donde lo dejaste.', 'At the end of the lesson you can go on to the next one or stop there: next time it starts where you left off.'),
        ],
        score: L(
          'Cuenta como en los demás juegos: a la primera, con ayuda o para repasar. Lo aprendido entra en el repaso de la portada, que te lo trae de vuelta antes de que se te olvide.',
          'It counts as in the other games: first time, with help or to review. What you learn goes into the review on the first page, which brings it back before you forget it.',
        ),
        aid: L('Al escribir un nombre, «Una letra» te enseña la siguiente. «No lo sé» da la respuesta, y la pregunta vuelve más tarde.', 'When typing a name, “A letter” shows you the next one. “I don\'t know” gives the answer, and the question comes back later.'),
        tip: L(
          'Unas pocas lecciones al día rinden más que una tarde entera. Si ya te sabes parte del mapa, «Haz la prueba de nivel», en la primera lección, pregunta cada pieza una vez, sin pistas, y las lecciones se saltan las que aciertes. El orden en que llegan las piezas (por zonas, por tamaño o alfabético) se elige en los ajustes.',
          'A few lessons a day do more than a whole afternoon. If you already know part of the map, “Take the placement test”, in the first lesson, asks each piece once, with no hints, and the lessons skip the ones you get right. The order the pieces come in (by area, by size or by name) is chosen in the settings.',
        ),
      };
    case 'cards':
      return {
        steps: [
          L(
            'Cada tarjeta enseña una cara: un nombre, una pieza resaltada en el mapa, una bandera… Antes de empezar eliges qué pregunta.',
            'Each card shows one side: a name, a piece highlighted on the map, a flag… Before starting you choose what it asks.',
          ),
          L('Piensa la respuesta y dale la vuelta con «Ver la respuesta» (o con Espacio).', 'Think of the answer and turn the card over with “Show the answer” (or with Space).'),
          L('Di con sinceridad cómo te ha ido: «No lo sabía», «Casi» o «Lo sabía» (teclas 1, 2 y 3).', 'Say honestly how it went: “I did not know”, “Nearly” or “I knew it” (keys 1, 2 and 3).'),
          L('Las que no sabías vuelven al final, hasta que las sepas todas.', 'The ones you did not know come back at the end, until you know them all.'),
        ],
        score: L(
          'La nota te la pones tú: «Lo sabía» cuenta como a la primera, «Casi» como con ayuda y «No lo sabía» queda para repasar, también en el repaso de la portada.',
          'You give yourself the mark: “I knew it” counts as first time, “Nearly” as with help and “I did not know” is left to review, in the review on the first page as well.',
        ),
        tip: L(
          'No hay nada que escribir ni que señalar: van bien para repasar deprisa, o en un móvil con una sola mano.',
          'There is nothing to type or to pin: they are good for a quick review, or on a phone with one hand.',
        ),
      };
    case 'print':
      return {
        steps: [
          L(
            'Elige cómo quieres la hoja: con un número en cada pieza y una línea para cada nombre, o sin números; y con las soluciones en otra hoja, si las quieres.',
            'Choose how you want the sheet: with a number on each piece and a line for each name, or without numbers; and with the answers on another sheet, if you want them.',
          ),
          L('Pulsa «Imprimir» y, en el cuadro de tu navegador, elige la impresora, o guardarla como PDF.', 'Press “Print” and, in the box of your browser, choose the printer, or to save it as a PDF.'),
        ],
        score: L('No es un juego: es el mismo mapa en papel, para clase o para estudiar sin pantalla.', 'It is not a game: it is the same map on paper, for class or to study away from a screen.'),
      };
    case 'pin':
      return {
        steps: [
          countries
            ? L(
                'Aparece un nombre —o una capital, o una bandera, si lo eliges así antes de empezar—: busca el país en el mapa y haz clic encima.',
                'A name comes up — or a capital, or a flag, if you choose so before starting: find the country on the map and click it.',
              )
            : L('Aparece un nombre: búscalo en el mapa y haz clic encima.', 'A name comes up: find it on the map and click it.'),
          L('Tienes tres intentos. Tras el tercer fallo, la respuesta parpadea en el mapa: haz clic en ella para seguir.', 'You have three tries. After the third miss, the answer blinks on the map: click it to go on.'),
          L('Lo que ya has resuelto queda coloreado, así que cada vez hay menos donde buscar.', 'What you have already solved stays coloured, so there is less and less to search.'),
        ],
        score: `${grades()} ${comesBack()}`,
        aid: `${L('«Pista» apaga parte del mapa y deja iluminadas unas pocas piezas, entre las que está la buena.', '“Hint” dims part of the map and leaves a few pieces lit, the right one among them.')} ${moreHints()}`,
        tip: formats(),
      };
    case 'listen':
      return {
        steps: [
          L(
            'La voz del navegador dice un nombre. No se escribe en ninguna parte: «Oír otra vez» lo repite cuantas veces quieras.',
            'The voice of the browser says a name. It is written nowhere: “Hear it again” repeats it as often as you like.',
          ),
          L('Búscalo en el mapa y haz clic encima. Tienes tres intentos.', 'Find it on the map and click it. You have three tries.'),
        ],
        score: `${grades()} ${comesBack()}`,
        aid: `${L('«Ver el nombre» lo escribe.', '“Show the name” writes it down.')} ${moreHints()}`,
        tip: L(
          'Sirve para hacer oído con los nombres que solo has leído. Si tu navegador no tiene voz, el juego lo avisa y enseña el nombre escrito.',
          'It trains your ear for the names you have only read. If your browser has no voice, the game says so and shows the name in writing.',
        ),
      };
    case 'puzzle':
      return {
        steps: [
          L('Te damos una pieza suelta, con su forma y sin su nombre.', 'You get a loose piece, with its shape and without its name.'),
          L(
            'Haz clic en el mapa donde va. El mapa no enseña las fronteras de dentro: solo el contorno. Tienes tres intentos.',
            'Click on the map where it goes. The map does not show the borders inside it: only the outline. You have three tries.',
          ),
          L('Cada pieza colocada se queda dibujada en su sitio, y el mapa se va completando.', 'Each piece you place stays drawn where it goes, and the map fills up.'),
        ],
        score: `${grades()} ${comesBack()}`,
        aid: `${L('«Pista» apaga el mapa menos la zona donde va la pieza.', '“Hint” dims the map except for the part where the piece goes.')} ${moreHints()}`,
        tip: L(
          'Mira el tamaño además de la forma: las piezas pequeñas se dibujan más pequeñas que las grandes.',
          'Look at the size as well as the shape: small pieces are drawn smaller than large ones.',
        ),
      };
    case 'identify':
      return {
        steps: [
          L('Se ilumina una pieza del mapa.', 'A piece of the map lights up.'),
          L(
            'Di cuál es: escribiendo su nombre o eligiendo entre cuatro opciones, según lo que hayas puesto antes de empezar.',
            'Say which one it is: by typing its name or by choosing among four options, as you set before starting.',
          ),
          L('Escribiendo tienes tres intentos; entre opciones, uno solo.', 'When typing you have three tries; among options, just one.'),
        ],
        score: `${grades()} ${comesBack()}`,
        aid: `${L('Al escribir, «Una letra» enseña la siguiente letra del nombre.', 'When typing, “A letter” shows the next letter of the name.')} ${moreHints()} ${L(
          'Entre opciones el menú se llama «Pista», y puede quitar dos de las cuatro.',
          'Among options the menu is called “Hint”, and it can take two of the four away.',
        )}`,
        tip: `${typing()} ${formats()}`,
      };
    case 'outline':
      return {
        steps: [
          L('Ves una silueta sola, sin mapa alrededor y sin escala.', 'You see an outline on its own, with no map around it and no scale.'),
          L('Di de qué es: escribiendo su nombre o eligiendo entre cuatro opciones.', 'Say what it is: by typing its name or by choosing among four options.'),
          L('Si antes de empezar pides que salgan giradas, el norte ya no queda arriba.', 'If you ask for them turned before starting, north is no longer at the top.'),
        ],
        score: `${grades()} ${comesBack()}`,
        aid: `${L(
          '«Ver en el mapa» cambia la silueta por su sitio en el mapa; después, al escribir, «Una letra» va enseñando el nombre.',
          '“Show on the map” swaps the outline for its place on the map; after that, when typing, “A letter” shows the name bit by bit.',
        )} ${moreHints()}`,
        tip: L(
          'Fíjate en la costa y en los salientes: el tamaño no ayuda, porque todas las siluetas se dibujan igual de grandes.',
          'Look at the coast and at what sticks out: size is no help, because every outline is drawn as large as the others.',
        ),
      };
    case 'capital':
      return {
        steps: [
          L('Aparece el nombre de una pieza, que además se ilumina en el mapa.', 'The name of a piece comes up, and the piece lights up on the map.'),
          L('Di cuál es su capital: escribiéndola o eligiendo entre cuatro.', 'Say what its capital is: by typing it or by choosing among four.'),
          L('Las capitales que se llaman igual que su territorio no se preguntan: se contestarían solas.', 'Capitals named after their territory are not asked: they would answer themselves.'),
        ],
        score: `${grades()} ${comesBack()}`,
        aid: L(
          'Al escribir, «Una letra» enseña la siguiente y «Cuántas letras» dice cuántas tiene. Entre opciones, «Quitar dos opciones» deja solo dos. Todas cuentan como ayuda.',
          'When typing, “A letter” shows the next one and “How many letters” says how many it has. Among options, “Remove two options” leaves just two. All of them count as help.',
        ),
        tip: `${typing()} ${formats()}`,
      };
    case 'flag':
      return {
        steps: [
          L('Aparece una bandera.', 'A flag comes up.'),
          L('Di de qué país es: escribiendo su nombre o eligiendo entre cuatro.', 'Say which country it belongs to: by typing its name or by choosing among four.'),
          L('Si quieres complicarlo, antes de empezar puedes pedir las banderas sin color o desenfocadas.', 'To make it harder, before starting you can ask for the flags without colour or out of focus.'),
        ],
        score: `${grades()} ${comesBack()} ${L('Las banderas que aprendes se guardan en tu álbum.', 'The flags you learn are kept in your album.')}`,
        aid: `${L('Al escribir, «Una letra» enseña la siguiente letra del nombre.', 'When typing, “A letter” shows the next letter of the name.')} ${moreHints()}`,
        tip: formats(),
      };
    case 'parent':
      return {
        steps: [
          L('Aparece una pieza: una provincia, un departamento, una ciudad.', 'A piece comes up: a province, a department, a city.'),
          L(
            'Di a qué grupo pertenece —su comunidad, su región, su país—, eligiendo entre cuatro opciones o escribiendo el nombre.',
            'Say which group it belongs to — its community, its region, its country — by choosing among four options or by typing the name.',
          ),
        ],
        score: `${grades()} ${again()}`,
        aid: L(
          'Entre opciones, «Quitar dos opciones» deja solo dos. Al escribir, «Una letra» enseña la siguiente y «Cuántas letras» dice cuántas tiene el nombre.',
          'Among options, “Remove two options” leaves just two. When typing, “A letter” shows the next one and “How many letters” says how many the name has.',
        ),
        tip: L('Las piezas que se llaman como su grupo no se preguntan: se contestarían solas.', 'Pieces named after their group are not asked: they would answer themselves.'),
      };
    case 'mix':
      return {
        steps: [
          L(
            'A cada pieza le toca una manera de preguntarla, a suertes, y la conserva: si la fallas, vuelve preguntada igual.',
            'Each piece is dealt one way of being asked, by lot, and keeps it: if you miss it, it comes back asked the same way.',
          ),
          L('El rótulo de arriba dice qué se pide cada vez: léelo antes de contestar.', 'The heading at the top says what is asked each time: read it before you answer.'),
          L(
            'Se responde como en el juego de cada pregunta: con un clic en el mapa, escribiendo o entre cuatro opciones.',
            'You answer as in the game each question comes from: with a click on the map, by typing or among four options.',
          ),
        ],
        score: `${grades()} ${comesBack()}`,
        aid: L('Cada pregunta tiene la pista de su juego y, además, el menú «Otra pista».', 'Each question has the hint of its game and the “Another hint” menu besides.'),
        tip: L('Es un buen repaso general cuando ya has jugado a los demás por separado.', 'It makes a good all-round review once you have played the others one by one.'),
      };
    case 'blind':
      return {
        steps: [
          L('El mapa no enseña lo que se pregunta: ni fronteras, ni puntos, ni nombres.', 'The map shows nothing of what is asked: no borders, no dots, no names.'),
          L('Aparece un nombre: haz clic donde creas que está. El primer clic es tu respuesta.', 'A name comes up: click where you think it is. The first click is your answer.'),
          L('Después el mapa enseña dónde estaba y a qué distancia te has quedado.', 'The map then shows where it was and how far off you were.'),
        ],
        score: L(
          'Acierta un clic dentro de la pieza. Con lo que no tiene superficie (una ciudad, un pico) o es muy pequeño vale quedarse cerca: el juego dice a cuánta distancia cuenta. Lo que falles entra en el repaso de la portada.',
          'A click inside the piece is right. For what has no surface (a city, a peak) or is very small, close is enough: the game says within what distance it counts. What you miss goes into the review on the first page.',
        ),
        tip: zoom(),
      };
    case 'hotcold':
      return {
        steps: [
          L(
            'Como en «Situar a ciegas», el mapa no enseña lo que se busca: haz clic donde creas que está.',
            'As in “Place it blind”, the map does not show what you are looking for: click where you think it is.',
          ),
          L(
            'Si no aciertas, el juego te dice cómo vas —de «Helado» a «¡Te quemas!»— y si estás más cerca o más lejos que antes.',
            'If you miss, the game tells you how you are doing — from “Freezing” to “Burning!” — and whether you are closer or further than before.',
          ),
          L('Tienes seis clics para cada cosa.', 'You have six clicks for each thing.'),
        ],
        score: L(
          'Encontrarla al primer clic cuenta como a la primera; con más clics, como con ayuda; si se acaban los seis, queda para repasar.',
          'Finding it with the first click counts as first time; with more clicks, as with help; if the six run out, it is left to review.',
        ),
        tip: L('Usa los primeros clics para tantear: dos lejos el uno del otro dicen más que dos juntos.', 'Use the first clicks to feel your way: two far apart tell more than two close together.'),
      };
    case 'nameall':
      return {
        steps: [
          L(
            'El mapa empieza sin nombres. Escríbelos de memoria, en el orden que quieras: cada uno se acepta en cuanto lo terminas, y su pieza se colorea.',
            'The map starts without names. Type them from memory, in any order: each is taken as soon as you finish it, and its piece is coloured.',
          ),
          L(
            'Si prefieres elegir tú, toca antes una pieza del mapa y escribe cómo se llama esa. También hay un botón que elige una por ti.',
            'If you would rather choose, tap a piece of the map first and type what that one is called. There is also a button that picks one for you.',
          ),
          L('Antes de empezar decides si juegas sin prisa o con cuenta atrás.', 'Before starting you decide whether to play at your own pace or against a countdown.'),
        ],
        score: L(
          'Cuenta cuántas rellenas, y el tiempo: el más corto con el mapa completo es tu récord. Las que te falten se enseñan al final y entran en el repaso de la portada.',
          'It counts how many you fill, and the time: the shortest with the whole map is your record. The ones you miss are shown at the end and go into the review on the first page.',
        ),
        aid: L(
          'Con una pieza marcada, «Una letra» va enseñando su nombre (esa cuenta como con ayuda) y «No lo sé» lo da (esa queda para repasar). «Me rindo» acaba la partida.',
          'With a piece marked, “A letter” shows its name bit by bit (that one counts as with help) and “I don\'t know” gives it (that one is left to review). “I give up” ends the game.',
        ),
        tip: typing(),
      };
    case 'regionle':
      return {
        steps: [
          L('Ves una silueta. Escribe de qué crees que es.', 'You see an outline. Type what you think it is.'),
          L(
            'Si fallas, el juego te dice a qué distancia está la buena de la que has dicho, y hacia dónde.',
            'If you miss, the game tells you how far the right one is from the one you said, and which way.',
          ),
          L('Tienes seis intentos. Con cada pista, piensa qué queda a esa distancia y en esa dirección.', 'You have six tries. With each clue, think what lies at that distance and in that direction.'),
        ],
        score: L(
          'Adivinarla al primer intento cuenta como a la primera; con las pistas de distancia, como con ayuda; si se acaban los seis, queda para repasar.',
          'Guessing it at the first try counts as first time; with the distance clues, as with help; if the six run out, it is left to review.',
        ),
        tip: L(
          'Un primer intento hacia el centro del mapa reparte bien las distancias. Y si te sobra, antes de empezar puedes pedir las siluetas giradas.',
          'A first guess near the middle of the map spreads the distances well. And if it is too easy, before starting you can ask for the outlines turned.',
        ),
      };
    case 'travel':
      return {
        steps: [
          L('El juego marca dos piezas del mapa: la salida y la llegada.', 'The game marks two pieces of the map: the start and the end.'),
          L(
            'Escribe nombres de piezas hasta unirlas por tierra. El orden no importa: gana quien junta los dos extremos.',
            'Type names of pieces until they are joined by land. The order does not matter: joining the two ends wins.',
          ),
          L(
            'Cada pieza que pones se colorea: está en un camino más corto, cerca pero dando un rodeo, o lejos de la ruta.',
            'Each piece you put down is coloured: on a shortest way, near but making a detour, or far from the route.',
          ),
        ],
        score: L(
          'De una a tres estrellas: las tres, si usas justo las piezas del camino más corto. El juego dice por cuántas pasa.',
          'One to three stars: all three if you use just the pieces of the shortest way. The game says how many it goes through.',
        ),
        aid: L(
          '«Pista» pone por ti una pieza del camino que te falta. «Otra ruta» cambia la salida y la llegada, y «Me rindo» enseña una ruta posible.',
          '“Hint” puts down for you a piece of the way that you are missing. “Another route” changes the start and the end, and “I give up” shows a possible route.',
        ),
        tip: L('Las líneas de puntos son travesías cortas por mar, que también cuentan como paso.', 'The dotted lines are short sea crossings, which count as a way through too.'),
      };
    case 'group':
      return {
        steps: [
          L(
            'Aparece un grupo: lo que pertenece a algo, lo que limita con una pieza, lo que cumple una condición. El contador dice cuántas piezas tiene.',
            'A group comes up: what belongs to something, what borders a piece, what meets a condition. The counter says how many pieces it has.',
          ),
          L('Toca en el mapa cada pieza que sea del grupo; otro toque la desmarca.', 'Tap each piece of the map that is in the group; another tap unmarks it.'),
          L('Cuando creas tenerlas todas, pulsa «Comprobar».', 'When you think you have them all, press “Check”.'),
        ],
        score: L(
          'Un grupo está bien si lo marcas entero y sin nada de más. En los de cuatro piezas o más, cuenta como «Casi» equivocarse en una de cada cinco como mucho.',
          'A group is right if you mark the whole of it and nothing besides. In those of four pieces or more, getting at most one in five wrong counts as “Close”.',
        ),
        tip: L('Sobrar cuenta igual que faltar: si dudas de una pieza, piénsalo antes de marcarla.', 'One too many counts the same as one too few: if you doubt a piece, think before you mark it.'),
      };
    case 'neighbours':
      return {
        steps: [
          L('Se nombra una pieza, que se ilumina en un mapa sin fronteras. El contador dice cuántas vecinas tiene.', 'A piece is named, and lights up on a map without borders. The counter says how many neighbours it has.'),
          L(
            'Escribe, una a una y en cualquier orden, todas las que limitan con ella, y pulsa Intro tras cada una.',
            'Type, one at a time and in any order, every piece that borders it, and press Enter after each.',
          ),
          L('Solo cuentan las fronteras por tierra y las piezas de este mapa. Cada acierto se dibuja.', 'Only land borders and the pieces of this map count. Each right answer is drawn.'),
        ],
        score: L(
          'A la primera, si das todas sin fallar. Al tercer fallo se enseña la respuesta. Lo que falles entra en el repaso de la portada.',
          'First time, if you give them all without a miss. At the third miss the answer is shown. What you miss goes into the review on the first page.',
        ),
        aid: L(
          '«Pista» enseña la primera letra de una vecina que te falta, y después «Otra letra» va dando más. «Ver la respuesta» las enseña todas.',
          '“Hint” shows the first letter of a neighbour you are missing, and “Another letter” then gives more. “Show the answer” shows them all.',
        ),
        tip: L('Recorre el contorno con la vista, en el sentido de las agujas del reloj: así no te dejas ninguna.', 'Go round the edge with your eyes, clockwise: that way you leave none out.'),
      };
    case 'border':
      return {
        steps: [
          L('En un mapa sin nombres se ilumina una frontera: la línea entre dos piezas.', 'On a map without names a border lights up: the line between two pieces.'),
          L(
            'Di qué dos piezas separa: eligiendo entre cuatro fronteras o escribiendo los dos nombres, uno a uno y en cualquier orden.',
            'Say which two pieces it lies between: by choosing among four borders or by typing the two names, one at a time and in any order.',
          ),
        ],
        score: L(
          'Entre opciones hay un solo intento. Escribiendo, al tercer fallo se enseña la respuesta; acertar las dos con algún fallo o con pista cuenta como con ayuda.',
          'Among options there is a single try. When typing, at the third miss the answer is shown; getting both with a miss or with a hint counts as with help.',
        ),
        aid: L(
          'Al escribir, «Pista» enseña la primera letra de uno de los dos lados, y «Otra letra» va dando más.',
          'When typing, “Hint” shows the first letter of one of the two sides, and “Another letter” gives more.',
        ),
        tip: L('En un mapa de varios países solo se preguntan las fronteras de dentro de cada uno.', 'On a map of several countries only the borders inside each one are asked.'),
      };
    case 'chain':
      return {
        steps: [
          L('La cadena empieza en una pieza que elige el juego, y te dice cuántas salidas tiene.', 'The chain starts at a piece the game chooses, and it tells you how many ways out it has.'),
          L(
            'Escribe una vecina suya por tierra y pulsa Intro: la cadena pasa a esa. Y de esa, a otra vecina, y así.',
            'Type one of its neighbours by land and press Enter: the chain moves on to it. And from that one to another neighbour, and so on.',
          ),
          L(
            'No se pasa dos veces por la misma pieza. El mapa no enseña las fronteras: se va dibujando con tu cadena.',
            'No piece is passed twice. The map shows no borders: it is drawn as your chain goes.',
          ),
          L('Se acaba cuando no queda salida, al tercer fallo o cuando pulsas «Me planto».', 'It ends when there is no way on, at the third miss or when you press “I stop here”.'),
        ],
        score: L(
          'Cuenta lo larga que sea la cadena: la mejor de cada mapa es tu récord. Al final el juego te dice por dónde se podía seguir y si conoce una más larga desde la misma salida.',
          'What counts is how long the chain is: the best on each map is your record. At the end the game tells you where you could have gone on and whether it knows a longer one from the same start.',
        ),
        aid: L(
          '«Pista» enseña la primera letra de una vecina por la que puedes seguir, y «Otra letra» va dando más.',
          '“Hint” shows the first letter of a neighbour you can go on through, and “Another letter” gives more.',
        ),
        tip: L('No te metas pronto en una península o en un rincón del mapa: de ahí no se sale.', 'Do not go into a peninsula or a corner of the map too soon: there is no way out of it.'),
      };
    case 'whoami':
      return {
        steps: [
          L('Una pieza habla de sí misma, pista a pista: cada una afina más que la anterior.', 'A piece tells about itself, clue by clue: each one narrows it down more than the last.'),
          L('Escribe su nombre cuando creas saberlo.', 'Type its name when you think you know it.'),
          L(
            'Un nombre equivocado trae la pista siguiente. También puedes pedirla tú con «Otra pista», sin arriesgar.',
            'A wrong name brings the next clue. You can also ask for it with “Another clue”, without risking anything.',
          ),
        ],
        score: L(
          'Con la primera pista vale seis puntos, y cada pista de más resta uno. Cuenta como a la primera si la adivinas con tres pistas o menos y sin dar un nombre equivocado.',
          'With the first clue it is worth six points, and each further clue takes one off. It counts as first time if you guess it with three clues or fewer and without giving a wrong name.',
        ),
        tip: L(
          'Las primeras pistas descartan mucho aunque no señalen a nadie: ve tachando mentalmente.',
          'The first clues rule out a lot even if they point at no one: cross things off in your head.',
        ),
      };
    case 'compass':
      return {
        steps: [
          L('Salen cinco nombres a la vez.', 'Five names come up at a time.'),
          L(
            'Tócalos en orden: de norte a sur o de oeste a este, según lo que hayas elegido antes de empezar. «Borrar orden» te deja empezar otra vez.',
            'Tap them in order: from north to south or from west to east, as you chose before starting. “Clear order” lets you start again.',
          ),
          L('Pulsa «Comprobar»: el mapa te enseña dónde está cada uno, y el orden correcto.', 'Press “Check”: the map shows you where each one is, and the right order.'),
        ],
        score: L(
          'Cuenta cada nombre que queda en su puesto. Los cinco en su sitio es la ronda perfecta; con solo dos cambiados entre sí, cuenta como con ayuda. Se compara el centro de cada pieza.',
          'Each name that ends up in its place counts. All five in place is the perfect round; with just two swapped, it counts as with help. The centre of each piece is what is compared.',
        ),
        tip: L('Empieza por los extremos, que suelen estar claros, y deja para el final los del medio.', 'Start with the ends, which are usually clear, and leave the ones in the middle for last.'),
      };
    case 'bearing':
      return {
        steps: [
          L('Se nombran dos sitios: uno, y otro desde el que se mira. El mapa no enseña ninguno de los dos.', 'Two places are named: one, and another it is looked at from. The map shows neither.'),
          L(
            'Se pregunta hacia dónde queda el primero desde el segundo (eliges uno de los ocho rumbos de la rosa) o a qué distancia están en línea recta (eliges entre cuatro).',
            'You are asked which way the first lies from the second (you choose one of the eight points of the rose) or how far apart they are as the crow flies (you choose among four).',
          ),
          L('Antes de empezar decides si quieres las dos preguntas, por turnos, o solo una de ellas.', 'Before starting you decide whether you want both questions, in turn, or just one of them.'),
          L('Al responder, el mapa enseña los dos sitios y la línea que los une.', 'Once you answer, the map shows both places and the line between them.'),
        ],
        score: L(
          'En los rumbos, el punto de al lado del bueno cuenta como con ayuda cuando el sitio cae hacia ese lado. En las distancias solo vale la opción correcta.',
          'For bearings, the point next to the right one counts as with help when the place leans that way. For distances only the right option will do.',
        ),
        tip: L(
          'Con teclado, los rumbos se eligen como en un teclado numérico: 8 norte, 6 este, 2 sur y 4 oeste; y las distancias, con 1 a 4.',
          'With a keyboard, bearings are chosen as on a numeric keypad: 8 north, 6 east, 2 south and 4 west; and distances, with 1 to 4.',
        ),
      };
    case 'coords':
      return {
        steps: [
          L('El mapa lleva dibujados sus paralelos y meridianos, con su valor en el borde.', 'The map has its parallels and meridians drawn, with their value on the edge.'),
          L(
            'Según lo que elijas antes de empezar: o te damos una latitud y una longitud y marcas tú el punto con un clic, o el mapa marca un punto y eliges sus coordenadas entre cuatro.',
            'As you choose before starting: either you get a latitude and a longitude and mark the point yourself with a click, or the map marks a point and you choose its coordinates out of four.',
          ),
          L('Al responder ves qué había en ese punto.', 'Once you answer, you see what was at that point.'),
        ],
        score: L(
          'Al marcar, cuenta la distancia al punto: el juego dice a menos de cuánto es acierto. Al elegir coordenadas solo vale la opción correcta.',
          'When marking, the distance to the point is what counts: the game says within how far it is right. When choosing coordinates only the right option will do.',
        ),
        tip: L(
          'Primero la latitud (norte o sur del ecuador), luego la longitud (este u oeste de Greenwich). Mira entre qué dos líneas cae el punto.',
          'Latitude first (north or south of the equator), then longitude (east or west of Greenwich). Look between which two lines the point falls.',
        ),
      };
    case 'hilo':
      return {
        steps: [
          noMap ? L('Sale un país con su cifra, y a su lado otro sin ella.', 'A country comes up with its figure, and beside it another without it.') : L('Sale una pieza con su cifra, y a su lado otra sin ella.', 'A piece comes up with its figure, and beside it another without it.'),
          L(
            'Di si la cifra de la segunda es mayor o menor que la de la primera (también con las flechas ↑ y ↓ del teclado).',
            'Say whether the figure of the second is higher or lower than that of the first (with the ↑ and ↓ arrow keys too).',
          ),
          L('Si aciertas, la segunda pasa a ser la referencia y sale otra.', 'If you are right, the second becomes the one to compare with and another comes up.'),
        ],
        score: L(
          'Cuenta la racha: cuántos aciertos seguidos llevas. El primer fallo la termina, y la más larga es tu récord.',
          'What counts is the streak: how many you get right in a row. The first miss ends it, and the longest is your record.',
        ),
        tip: L('Las cifras que ya han salido dan la medida: quédate con dos o tres de referencia.', 'The figures that have come up give you the scale: keep two or three in mind to compare with.'),
      };
    case 'rank':
      return {
        steps: [
          L('Salen cinco nombres a la vez.', 'Five names come up at a time.'),
          L('Tócalos en orden, de mayor a menor. «Borrar orden» te deja empezar otra vez.', 'Tap them in order, from largest to smallest. “Clear order” lets you start again.'),
          L('Pulsa «Comprobar»: verás el orden correcto y la cifra de cada uno.', 'Press “Check”: you will see the right order and the figure of each.'),
        ],
        score: L(
          'Cuenta cada nombre que queda en su puesto. Los cinco en su sitio es la ronda perfecta; con solo dos cambiados entre sí, cuenta como con ayuda.',
          'Each name that ends up in its place counts. All five in place is the perfect round; with just two swapped, it counts as with help.',
        ),
        tip: L('Coloca primero el mayor y el menor, que suelen estar claros.', 'Place the largest and the smallest first, which are usually clear.'),
      };
    case 'exact':
      return {
        steps: [
          L('Sale un nombre y lo que se mide de él.', 'A name comes up, and what is measured of it.'),
          L(
            'Escribe la cifra que creas y elige al lado en qué unidad la das. Los decimales, con coma.',
            'Type the figure you think and choose beside it the unit you give it in. Decimals, with a point.',
          ),
          L(
            'Al responder ves la cifra real y en qué tanto por ciento te has quedado corto o largo.',
            'Once you answer, you see the real figure and by what per cent you fell short or went over.',
          ),
        ],
        score: L('Acierto, a menos de un 10 % de la cifra real; cerca, a menos de un 30 %.', 'Right, within 10% of the real figure; near, within 30%.'),
        aid: L('«Pista» te da un intervalo en el que cae la cifra; con ella, un acierto cuenta como con ayuda.', '“Hint” gives you a range the figure falls in; with it, a right answer counts as with help.'),
        tip: L('No hace falta saberla de memoria: compara con otra que conozcas y ajusta a ojo.', 'You need not know it by heart: compare with one you do know and adjust by eye.'),
      };
    case 'which':
      return {
        steps: [
          L('Te damos una cifra, sin decir de quién es.', 'You get a figure, without being told whose it is.'),
          L('Escribe un nombre: el juego te dice si la cifra del tuyo se pasa o se queda corta.', 'Type a name: the game tells you whether the figure of yours is over or under.'),
          L('Tienes seis intentos para dar con el dueño de la cifra.', 'You have six tries to find whose figure it is.'),
        ],
        score: L(
          'Adivinarlo al primer intento cuenta como a la primera; con más intentos, como con ayuda; si se acaban los seis, queda para repasar.',
          'Guessing it at the first try counts as first time; with more tries, as with help; if the six run out, it is left to review.',
        ),
        tip: L('Cada intento parte lo que queda en dos: prueba con uno que caiga por el medio.', 'Each try splits what is left in two: try one that falls about the middle.'),
      };
    case 'topten':
      return {
        steps: [
          L(
            'El juego dice qué lista es: los diez primeros por una cifra, o la mitad de lo que haya si son menos de veinte.',
            'The game says which list it is: the top ten by a figure, or half of what there is if there are fewer than twenty.',
          ),
          L(
            'Escribe sus nombres de memoria, en cualquier orden: cada acierto se coloca solo en su puesto.',
            'Type their names from memory, in any order: each right one goes to its place by itself.',
          ),
          L(
            'Un nombre que no está en la lista es un fallo, y el juego te dice en qué puesto queda.',
            'A name that is not on the list is a miss, and the game tells you where it stands.',
          ),
        ],
        score: L('Cuenta cuántos puestos rellenas. Con cinco fallos se acaba la partida.', 'What counts is how many places you fill. Five misses end the game.'),
        aid: L('«Me rindo» enseña los que faltaban.', '“I give up” shows the ones that were missing.'),
        tip: L(
          'Empieza por los seguros y deja los dudosos para cuando te queden fallos de sobra.',
          'Start with the sure ones and leave the doubtful ones for when you have misses to spare.',
        ),
      };
    case 'truefalse':
      return {
        steps: [
          L(
            'Sale una afirmación sobre un país: su población, su superficie, su capital, sus vecinos…',
            'A statement about a country comes up: its population, its area, its capital, its neighbours…',
          ),
          L('Di si es verdadera o falsa, con los botones o con las teclas V y F.', 'Say whether it is true or false, with the buttons or with the T and F keys.'),
          L('El juego te da siempre el dato que hay detrás, aciertes o no.', 'The game always gives you the fact behind it, whether you are right or not.'),
        ],
        score: L(
          'Cuenta cada acierto. Al final puedes volver a leer las que fallaste, con su explicación.',
          'Each right answer counts. At the end you can read again the ones you missed, with their explanation.',
        ),
        tip: L('Lo que se aprende es el dato, no el acierto: léelo aunque hayas acertado.', 'What you learn is the fact, not the right answer: read it even if you got it right.'),
      };
    case 'oddone':
      return {
        steps: [
          L(
            'Salen cuatro países y una pregunta que dice qué tienen tres de ellos en común: el continente, la salida al mar, un vecino, el tamaño, los habitantes…',
            'Four countries come up with a question that says what three of them have in common: the continent, a coast, a neighbour, the size, the people…',
          ),
          L('Elige el que no es como los otros tres, con un clic o con las teclas 1 a 4.', 'Choose the one that is not like the other three, with a click or with the keys 1 to 4.'),
          L('El juego te dice siempre por qué, aciertes o no, con el dato de cada uno.', 'The game always tells you why, whether you are right or not, with the fact about each one.'),
        ],
        score: L(
          'Cuenta cada acierto. Al final puedes volver a leer las que fallaste, con su explicación.',
          'Each right answer counts. At the end you can read again the ones you missed, with their explanation.',
        ),
        tip: L(
          'Cuando compara tamaños o habitantes, sitúa primero el país con el que se miden: tres quedan a un lado de él y uno al otro.',
          'When it compares sizes or people, place first the country they are measured against: three lie on one side of it and one on the other.',
        ),
      };
    case 'pairs':
      return {
        steps: [
          L(
            'Las cartas están boca abajo, dos por cada país: su bandera y su nombre, o su capital y el país, según lo que elijas antes de empezar.',
            'The cards lie face down, two for each country: its flag and its name, or its capital and the country, as you choose before starting.',
          ),
          L(
            'Levanta dos, con un clic o con las flechas e Intro. Si son del mismo país se quedan a la vista; si no, vuelven a su sitio al cabo de un momento, o en cuanto levantes otra.',
            'Turn two over, with a click or with the arrows and Enter. If they belong to the same country they stay in sight; if not, they go back after a moment, or as soon as you turn another.',
          ),
          L('La partida acaba cuando todas tienen pareja.', 'The game ends when every card has its pair.'),
        ],
        score: L(
          'Cuenta cuántas parejas juntas sin un intento de más. Es un fallo levantar una carta cuya otra mitad ya había salido y no ir a por ella, o juntarla con una que ya habías visto y no era la suya. Levantar dos cartas nuevas que no casan no es fallo: no hay otra manera de saber qué son. El juego guarda tu partida con menos intentos de cada tamaño.',
          'What counts is how many pairs you put together without a turn too many. It is a miss to turn a card whose other half had already come up and not go for it, or to put it with one you had already seen that was not its own. Turning two new cards that do not match is not a miss: there is no other way to find out what they are. The game keeps your game with the fewest turns of each size.',
        ),
        tip: L(
          'Si sabes de quién es la bandera, o de qué país es la capital, te basta con recordar dónde está una carta, no dos.',
          'If you know whose flag it is, or which country the capital belongs to, you only have to remember where one card is, not two.',
        ),
      };
    case 'alphabet':
      return {
        steps: [
          L(
            'Hay una letra por cada inicial de los países que has elegido, de la A a la Z. De cada letra sale un país y una pista sobre él: su capital, su bandera, sus vecinos, dónde está o en qué es el primero de su letra.',
            'There is a letter for each initial among the countries you chose, from A to Z. For each letter there is a country and a clue about it: its capital, its flag, its neighbours, where it is or what it is the first of its letter in.',
          ),
          L(
            'Escribe el país. Tienes un intento por letra: si aciertas, pasas a la siguiente; si no, el juego te dice cuál era.',
            'Type the country. You have one try for each letter: if you are right you go on to the next; if not, the game tells you which it was.',
          ),
          L(
            'Si dudas, pulsa «Paso» o escribe «paso»: la letra se queda pendiente y vuelve cuando hayas dado la vuelta a las demás. Puedes pasar las veces que quieras.',
            'If in doubt, press "Pass" or type "pass": the letter stays open and comes back when you have gone round the others. You can pass as often as you like.',
          ),
        ],
        score: L(
          'Cuenta cada letra acertada. Un país que no empieza por la letra, o que no está entre los elegidos, no gasta el intento. Si terminas antes, las letras pendientes no cuentan como fallos.',
          'Each letter you get right counts. A country that does not begin with the letter, or is not among the ones chosen, does not use up the try. If you finish early, the letters left open are not counted as misses.',
        ),
        tip: L(
          'La pista solo tiene que distinguir al país de los demás de su letra: repasa mentalmente los que empiezan por ella antes de escribir.',
          'The clue only has to tell the country from the others of its letter: go through the ones that begin with it in your head before typing.',
        ),
      };
    case 'connect':
      return {
        steps: [
          L(
            'En la mesa hay dieciséis países que van de cuatro en cuatro. Los de cada grupo tienen algo en común que no se dice: una parte del mundo, el mar, un país con el que limitan, una organización o una lengua, el tamaño, la letra de su capital o algo de su nombre (la inicial, la terminación, una palabra).',
            'There are sixteen countries on the table, and they go four by four. Those of each group have something in common that is not said: a part of the world, the sea, a country they border, an organisation or a language, their size, the letter of their capital or something of their name (how it begins, how it ends, a word in it).',
          ),
          L(
            'Elige cuatro y pulsa «Comprobar». Si son un grupo, sube arriba con lo que tienen en común. Si no, el juego te dice si tres de los cuatro van juntos.',
            'Pick four and press "Check". If they are a group, it goes up with what they have in common. If not, the game tells you whether three of the four go together.',
          ),
          L(
            'Algún país encajaría en dos grupos, pero el tablero solo tiene una solución: si sobra uno, es que hace falta en otro grupo.',
            'A country or two would fit two groups, but the board has one answer only: if there is one too many, it is needed in another group.',
          ),
          L('Al cuarto fallo se acaba la partida, y el juego enseña los grupos que faltaban.', 'The fourth miss ends the game, and the game shows the groups that were left.'),
        ],
        score: L(
          'Cuenta cada grupo que encuentras sin haber fallado antes y sin pista; el que sale después de un fallo o con su pista cuenta «con ayuda». Cuatro países que tienen en común algo que no es ninguno de los grupos no son un fallo: el juego te dice qué es. Si te quedas sin intentos, los grupos que faltaban cuentan como fallos; si terminas tú antes, no cuentan.',
          'Each group you find with no miss before it and no hint counts; one found after a miss or with its hint counts as “with help”. Four countries that have in common something that is none of the groups are no miss: the game tells you what it is. If you run out of guesses, the groups that were left count as misses; if you end the game before that, they are not counted.',
        ),
        aid: L(
          '«Pista» te dice lo que tienen en común los de uno de los grupos que faltan; ese grupo ya no cuenta «a la primera». «Barajar» cambia los países de sitio, que a veces basta para ver un grupo.',
          '"Hint" tells you what those of one of the groups still to be found have in common; that group no longer counts as “first time”. "Shuffle" moves the countries about, which is sometimes enough to see a group.',
        ),
        tip: L(
          'Empieza por el grupo del que estés más seguro y deja para el final los países que podrían ir en dos.',
          'Start with the group you are surest of, and leave for the end the countries that could go in two.',
        ),
      };
    default:
      return null;
  }
}
