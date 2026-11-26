# Correcciones a mano de las fichas de los países

`scripts/data/profiles-said.mjs` lee lo que dicen Wikidata y Wikipedia de cada país y de su bandera, y
`npm run data:profiles -- --review` enseña lo que ha leído y en qué no coinciden las fuentes. Lo que se
corrige a mano después de mirarlo va en `profiles-fixes.json`, por país; ningún programa escribe ese
archivo, así que una nueva pasada de «Traer datos» no deshace nada. Aquí queda por qué está cada cosa.

## Nombres

- **DK, NL**: la ficha de Wikipedia no da el nombre largo. Se pone el del Estado miembro de la ONU («Reino de
  Dinamarca», «Reino de los Países Bajos»).
- **HU, IE, TM**: la Wikipedia en español da «República de Hungría», «República de Irlanda» y «República de
  Turkmenistán»; el nombre oficial es solo «Hungría» (desde 2012), «Irlanda» y «Turkmenistán», como dice la
  Wikipedia en inglés.
- **NR**: la Wikipedia en inglés da «Republic of Naoero», que es el nombre en nauruano.
- **PS, SD, SO**: faltaba el nombre largo en español.
- **VN**: «Viet Nam» pasa a «Vietnam», que es como lo escribe el juego; y al nombre en vietnamita le faltaba
  un espacio.
- **LK**: el nombre en inglés venía cortado («Democratic Socialist Republic of»).
- **PA**: la ficha en español da solo «Panamá»; el nombre largo es «República de Panamá».
- **TF**: faltaban el nombre en inglés y el francés.
- **Nombre en su idioma**: sale del primer idioma oficial que dan las fuentes, y en estos no era el propio
  del país: **BY** (venía en ruso; se pone en bielorruso), **IE** (en inglés; en irlandés, «Éire»), **SZ** (en
  inglés; en suazi), **PH** (en inglés; en filipino), **BW** (en inglés; en setsuana), **LU** (en francés; en
  luxemburgués) y **NO** (no venía ninguno). De **HT** venía el nombre corto en criollo, «Ayiti»; se pone el
  largo. En los demás países con varios idiomas oficiales se deja el que viene.

## Lemas

Wikidata llama lema a muchos eslóganes de turismo («There's NOTHING like Australia»), así que el lema sale
de la ficha de la Wikipedia en español, con su traducción; la traducción al inglés, de la ficha en inglés
cuando cuenta el mismo lema.

- **Se quitan** (no son el lema del país): AU (no tiene lema oficial; «Advance Australia» lo fue del escudo
  antiguo), AW, AX, PW (eslóganes de turismo), AZ (un apodo: «Tierra de Fuego»), ER (es el nombre del país),
  ET y MD (son palabras del himno), MV (un nombre antiguo del Estado), UA (un saludo, no un lema oficial).
- **Se corrigen**: BM y NL (el lema es el latino «Quo Fata Ferunt» y el francés «Je maintiendrai»; la ficha
  daba su traducción), BI y MG (la ficha en español daba el lema anterior), HT (daba la versión en criollo
  como traducción), KH (le faltaba la última letra), MY (se pone en alfabeto latino, que es como se usa),
  NC (daba el lema de Francia), NF y NU (cortados), VN (una letra equivocada), FK y PN (faltaba el idioma),
  CU (la traducción inglesa decía más que el lema), BR (con sus mayúsculas, «Ordem e Progresso», como va
  escrito en la bandera y en el resto de su ficha).
- **Se añade** PA («Pro Mundi Beneficio»), que la ficha no traía.
- **Se añade la traducción al inglés** donde la ficha en inglés no la da o cuenta otro lema: AF, AL, AM, AO,
  CD, CG, DE, DJ, DO, DZ, GB, GQ, IN, IO, IQ, LT, MA, ME, MK, MZ, NE, NO, RE, RS, RW, SA, SE, SR, TN, TO, UZ,
  WS, YE.

## Himnos

- **ES, PT**: Wikidata no daba nombre al himno (ES) o no daba himno (PT).
- **CN, HK, MO, DZ, TM, MV, ZA**: el nombre venía mal escrito o en broma («national anthem of Mzansi»).
- **DE**: se dice cuál es («Das Lied der Deutschen», tercera estrofa).
- **MX**: Wikidata añade el «Toque de Bandera», que no es un himno.
- **IE**: en español venía «Himno nacional de Irlanda»; se pone su nombre, «Amhrán na bhFiann».

## Banderas

La fecha de adopción solo se da sola cuando Wikidata y una ficha de Wikipedia coinciden. Donde no coinciden
se toma el primer día que dan las dos fichas, y si tampoco, nada. Estos se han puesto a mano:

- **AD** 1866 · **CU** 20-5-1902 · **CX** 26-1-2002 · **EC** 26-9-1860 (Wikidata da 1830, la bandera de la
  Gran Colombia) · **HN** 16-2-1866 (diseño original con estrellas; normalizado en 1949) · **PR** 24-7-1952 ·
  **RS** 17-8-2004, como es hoy desde el 11-11-2010 · **SV** 27-5-1912.
- **AF**: el gobierno talibán volvió a usar de facto la bandera blanca con la *shahada* en 2021; la
  tricolor republicana sigue en ciertos contextos internacionales y está en la cronología
  ([Britannica](https://www.britannica.com/topic/flag-of-Afghanistan),
  [FOTW](https://www.crwflags.com/fotw/flags/af2021.html)). A petición del dueño, la **ficha y los juegos**
  sustituyen el icono tricolor de `flag-icons/af.svg` por el original de Commons
  [«Flag of the Taliban.svg»](https://commons.wikimedia.org/wiki/File:Flag_of_the_Taliban.svg), de Lexicon,
  dominio público, sin modificar (SHA-1 `fbfe78dee5dbaefbd21b488c0ae0231f3c5e2c9e`). La copia fuente está
  en `scripts/data/flag-overrides/af.svg`; el servidor y el build la sirven en `flags/af.svg` en vez de
  editar `node_modules`, y `flag.drawing` lleva el crédito y el contexto bilingüe. Se da **1997**, no un
  día exacto: las fuentes discrepan entre el 25 y el 27 de octubre para su introducción; el 15-8-2021 es
  su *retorno*, no una adopción nueva. Se oculta la entradilla inglesa de Wikipedia que lo llama adopción
  y se conserva su enlace; la cronología explica las fechas. En la bandera monárquica, el 1348 equivalente
  a 1929 es **lunar**, no solar: [FOTW 2002](https://www.crwflags.com/fotw/flags/af2002.html#coa) lo precisa;
  [FOTW 1931](https://www.crwflags.com/fotw/flags/af1930.html#des) se contradice al llamarlo solar.
  El 1298 de la tricolor de 2004–2021 sí pertenece al calendario solar (1919).
- **AS**: 17-4-1960, día en que se izó la bandera territorial de Samoa Estadounidense, según la historia de
  su bandera; las fuentes traídas daban por error el 27 de abril.
- **MR**: 25-10-2017, fecha del decreto de la bandera con franjas rojas, según la historia de la bandera de
  Mauritania; las fuentes traídas daban el 15 de agosto, posterior al referéndum pero anterior al decreto.
- **HT**: se quita el día exacto: Britannica fecha la restitución de la bicolor el 25 de febrero de 1986 y
  la ficha de Wikipedia el 26. La cronología de Haití dice solamente «febrero de 1986».
- **JE**: se deja la fecha contrastada del 7-4-1981 en que se izó oficialmente la enseña de Jersey. Se oculta
  la entradilla española de Wikipedia sobre la bandera: da el 1 de abril, mientras la inglesa y la historia
  local citada por ella dan el 7; la cronología explica en español las fechas de aprobación e izado.
- **RW**: 31-12-2001, día en que se izó y adoptó la nueva bandera de Ruanda según Britannica y la historia
  de la bandera en inglés. El 25 de octubre fue la votación parlamentaria sobre los símbolos: se oculta
  la entradilla española, que lo confunde con la adopción, y se explica en la cronología en ambos idiomas.
- **TN**: se quita el 20-10-1827: fue la batalla naval tras la que se decidió crear otra enseña, no su
  adopción. Wikipedia la sitúa en 1831 y Britannica en 1835; se ocultan ambas entradillas de Wikipedia
  sobre la bandera porque afirman sin reservas una de esas fechas. La cronología fecha solo el siglo y
  distingue la ley que precisó el dibujo en 1999 de la creación de la bandera.
- **GQ**: se oculta la entradilla española, que fecha sin matices el cambio del escudo en 1973:
  [FOTW](https://www.crwflags.com/fotw/flags/gq_1973.html) da ese año, mientras
  [Britannica](https://www.britannica.com/topic/flag-of-Equatorial-Guinea) lo sitúa en 1978. Ambas
  coinciden en el izado de la bandera sin escudo en 1968 y la restauración del escudo del árbol el 21-8-1979;
  no se atribuye una fecha de fin a la imagen de la independencia.
- **HN**: se conserva el 16-2-1866 para la incorporación de las cinco estrellas
  ([Britannica](https://www.britannica.com/topic/flag-of-Honduras)); se añade `changed: 1949-01-26`,
  publicación del decreto de 18-1-1949 que fija su disposición y el turquesa. Se oculta la entradilla
  inglesa, que afirma sin matices que las franjas son azul marino aunque el dibujo que usa el juego sigue
  la norma turquesa: en 2022 volvió a usarse en actos oficiales y en enero de 2026 el Congreso recuperó
  el azul oscuro, sin que conste la derogación del decreto de 1949
  ([La Prensa, 25-1-2026](https://www.laprensa.hn/fotogalerias/honduras/honduras-congreso-nacional-regresa-color-azul-marino-bandera-nacional-OO29055391);
  [El Heraldo, 23-1-2026](https://www.elheraldo.hn/honduras/cambia-color-bandera-honduras-vuelve-azul-marino-congreso-nacional-PI29037459)).
- **RS**: se corta la entradilla española antes de la anécdota no verificada que sitúa una delegación a
  Rusia antes del primer levantamiento serbio; se conservan la descripción y el enlace a Wikipedia. La
  versión civil sin escudo no es una etapa posterior a la estatal con armas
  ([Britannica](https://www.britannica.com/topic/flag-of-Serbia)).
- **SY**: 13-3-2025 es la adopción *oficial* del diseño de tres estrellas rojas según el
  [artículo 6 de la Declaración Constitucional](https://constitutionnet.org/sites/default/files/2025-03/2025.03.13%20-%20Constitutional%20declaration%20(English).pdf).
  El 8-12-2024 fue su vuelta al uso estatal *de facto*, no la fecha de su definición constitucional;
  la cronología distingue ambas y reutiliza los dibujos de 1930 y 1958 para sus dos etapas históricas.
- **TW**: 28-10-1928 es la adopción de la bandera roja por la República de China en el continente;
  en Taiwán se usa desde 1945, no desde 1928. La entradilla de
  [su bandera](https://en.wikipedia.org/wiki/Flag_of_the_Republic_of_China) atribuye a Lu Haodong el
  sol del cantón y a Sun Yat-sen el campo rojo: se nombran ambos en lugar de atribuirle a uno el conjunto.
- **VE**: 9-3-2006 es la fecha de publicación en la Gaceta Oficial n.º 38.394 de la
  [ley que fija ocho estrellas en arco](https://es.wikisource.org/wiki/Ley_de_Bandera_Nacional,_Himno_Nacional_y_Escudo_de_Armas_de_la_Rep%C3%BAblica_Bolivariana_de_Venezuela),
  aprobada el día 7; no se confunde con su primer izado posterior. Las banderas federalistas de 1859
  fueron enseñas de los rebeldes, no sustituyeron a las del Gobierno
  ([FOTW](https://www.crwflags.com/fotw/flags/ve-hist4.html)).
- **DK**: se quita; la fecha de las fichas (15-6-1219) es la de la leyenda.
- **AR**: proporción 9:14, la oficial (Wikidata y la ficha en inglés dan 5:8).
- **KP**: se quita el diseñador (atribución discutida). La proporción 20:33 es la de las dos fichas, que
  cuentan el cambio de marzo de 2026; Wikidata aún da 1:2.
- **NP**: se quita la proporción; la bandera no es un rectángulo.
- **ID, KR, MM**: se quita el diseñador (un imperio, un rey al que se le atribuye, un gobierno).
- **DO**: nombres de las diseñadoras mal escritos en inglés.
- **PE**: se quita el diseñador; Wikidata da a San Martín, que ideó la primera bandera y no la de hoy, y la
  ficha en español dice «autor anónimo».
- **TH**: el diseñador es el rey Vajiravudh; se le nombra como se le conoce, Rama VI.
- Gobernantes como diseñadores: se dejan **PH** (Aguinaldo), **UY** (Joaquín Suárez), **QA** (el emir
  Abdullah bin Jassim Al Thani) y **KE** (el ministro Tom Mboya), porque los nombran Wikidata y la ficha de la
  Wikipedia en inglés. Queda apuntado como dudoso en los dos últimos, por si al escribir su ficha se ve que
  solo mandaban cuando se adoptó.
- **NC**: Wikidata nombra primero la bandera de Francia, y de ella salían la fecha (1794), los colores y el
  diseñador. El juego dibuja la bandera canaca, que ondea junto a la tricolor desde julio de 2010: se ponen
  su año, su proporción (1:2, la de las dos fichas), sus colores y sus páginas de Wikipedia.

### Banderas de las que las fuentes no traían nada

De tres no vino ningún dato de la bandera, y se han puesto a mano leyendo la ficha de su página de Wikipedia:

- **PS**: el elemento de Wikidata que el juego tiene de Palestina es el de la región, que no nombra bandera.
  De «Bandera de Palestina» y «Flag of Palestine»: adoptada el 28 de mayo de 1964 (por la OLP; el Estado la
  hizo suya el 15 de noviembre de 1988), proporción 1:2, y sus cuatro colores.
- **EH**: el juego dibuja la de la República Saharaui. De «Flag of Western Sahara»: adoptada el 27 de febrero
  de 1976, proporción 1:2. No se nombra diseñador: la página dice que «se cuenta» que fue El Uali.
- **AQ**: la Antártida no tiene bandera oficial. El juego dibuja la propuesta de Graham Bartram (1996), que es
  la de flag-icons y la del emoji; se dice de quién es y que no es oficial, y no se da fecha de adopción.

### Territorios que ondean la bandera de su país

El juego dibuja con la bandera de su país a los territorios que no tienen otra oficial (`SAME_FLAG`, en
`src/lib/pairs.ts`): **BL, GF, GP, MF, PM, RE, WF, YT** con la de Francia, **BV, SJ** con la de Noruega,
**BQ** con la de los Países Bajos, **HM** con la de Australia y **SH** con la del Reino Unido. Wikidata y
Wikipedia hablan en cambio de la bandera local, que no es oficial y que la ficha no enseña (la de San Pedro
y Miquelón «adoptada en 1982», la de Santa Elena en 1984). En cada uno se dice de quién es la bandera
(`flag.of`) y el programa copia de la ficha de ese país lo que es de la bandera: fecha, proporción, colores,
diseñador y la página de Wikipedia. Una prueba (`src/lib/profiles.test.ts`) comprueba que son los mismos
territorios que dice el juego.

## El texto de Wikipedia

Desde la 1.49.0 cada ficha cuenta cómo empieza el artículo de Wikipedia del país y el de su bandera
(`scripts/data/profiles-text.mjs`), abreviado. El texto no se corrige: se corta o no se enseña. Lo que se ha
decidido a mano (`leads`, o la página de la que sale):

- **PS**: la ficha llevaba al artículo de la región histórica («Palestina (región)»), porque ese es el
  elemento de Wikidata que el juego tiene. La ficha es la del Estado de Palestina: se cambian sus páginas
  por las del Estado, «Palestina» y «Palestine», y de ellas sale el texto.
- **AQ**: el comienzo del artículo en español sobre la bandera habla de la del Tratado Antártico, que no es
  la que el juego dibuja: no se enseña. El inglés, que habla de las propuestas, sí.
- **BO**: la segunda frase del artículo en español tiene una errata («ciento doce provincias. trescientos
  cuarenta municipios»): se deja la primera, que dice lo que es el país.
- **AM**: en el artículo en español sobre la bandera, la segunda frase sigue tras un punto con minúscula
  («1990. la Ley de la Bandera…»): se deja la primera. La fecha de adopción está entre los datos.

Lo que es de Wikipedia y se queda como está, porque quitarlo dejaría la ficha sin lo que cuenta: «es el
bandera» (Japón, en español), «(símbolo Estado)» (Uganda, en español), una coma por una conjunción en la de
Costa Rica. Se arreglan en Wikipedia, no aquí.

## El escudo

Desde la 1.51.0 cada ficha enseña el escudo del país: el dibujo de Wikimedia Commons que Wikidata da como
su escudo (propiedad P94), que trae la fuente `arms` de «Traer datos». Wikidata no siempre da el vigente ni
el oficial, y Commons no siempre dice en pocas palabras de quién es el dibujo, así que se miraron los 238
uno por uno. Lo que se ha decidido a mano (`arms`):

- **Otro archivo** (`file`):
  - **ES**: Wikidata da «Escudo de España (variant).svg», que es una copia retocada por otro usuario. Se pone
    el archivo del que sale, «Escudo de España (mazonado).svg», dibujado según el modelo oficial (Real
    Decreto 2964/1981); dominio público.
  - **BF**: Wikidata da el escudo de 1997 a 2025. En 2025 cambió el lema; se pone «Coat of arms of Burkina
    Faso (2025-present).svg».
  - **LA**: Wikidata da el emblema de 1991 a 2025. Se modificó en 2025; se pone «Emblem of Laos (2025-).svg».
  - **PS**: el elemento de Wikidata que el juego tiene es el de la región histórica, que no tiene escudo. La
    ficha es la del Estado de Palestina: se pone el suyo, «Coat of arms of Palestine.svg».
- **Qué es** (`kind`): la ficha lo llama «escudo», «emblema» o «sello» según el nombre del archivo («Emblem
  of…», «Seal of…», «…國徽», «…kamon»). En dos el nombre dice «Arms of…» y no lo es: **AF** (el emblema del
  Emirato) y **FR** (el emblema de la República: Francia no tiene escudo oficial).
- **De quién es el dibujo** (`by`): Commons no lo decía en un nombre («See File history», «Own work», una
  lista de archivos de los que sale…) y la licencia pide nombrarlo. Se leyó la página de cada archivo:
  **BB** Neville C. Connell; **BF** Gobierno de Burkina Faso, sobre el dibujo de F l a n k e r; **CA**
  Sodacan; **DK** Galico, con elementos de Sodacan; **GB** Sodacan, retocado por Colohisto; **JE** PaD;
  **LA** Hlticgh; **LI** Added Ramos; **MC** Denelson83 y Echando una mano; **NI** C records; **SG** Fry1989
  y Ahk Heraldry; **SL** Yuma, a partir de archivos de Bluebear2, Rinaldum, S@m, Zigeuner y Thommy9. El de
  **ES** es de dominio público y no hace falta nombrar a nadie, pero su página lo dice y se pone: Gobierno
  de España, con los gráficos vectoriales de SanchoPanzaXXI.
- **Ninguno** (`null`):
  - **CC**: Wikidata da las armas de la familia Clunies-Ross, que fue dueña de las islas; no son las del
    territorio.
  - **NU**: lo que da es una fotografía, no un dibujo.
  - **TG**: el archivo tiene abierta una petición de borrado en Commons. Cuando se resuelva, se quita esta
    línea o se elige otro.

Lo que no se enseña sin que nadie lo haya decidido a mano, porque lo dice una regla del programa
(`scripts/data/profiles.mjs`):

- Solo se enseña un dibujo de dominio público, CC0, CC BY, CC BY-SA o «Attribution» (uso libre nombrando al
  autor). **OM** queda fuera: su emblema está en Commons con la licencia abierta del Gobierno de Omán
  (OGL-om 1.0), que la ficha no sabe citar.
- Si la licencia pide nombrar al autor y no hay a quién nombrar, no se enseña. **DM** queda fuera: su página
  remite al historial del archivo.
- Los trece territorios que el juego dibuja con la bandera de su país (`flag.of`) no enseñan escudo, y nadie
  puede elegirles uno. De los ocho franceses Wikidata da armas locales que rara vez son oficiales (las de
  la Guayana Francesa son las de Cayena); de los otros cinco no da nada.
- De **AQ**, **CX**, **EH**, **MQ** y **TR** Wikidata no da ninguno. Turquía no tiene escudo oficial.

El dibujo no se toca: se le quita el margen, se reduce a 264 px y se guarda en WebP con su transparencia.
Bajo él van su autor, cuando se conoce, su licencia y el enlace a su página de Commons.
