# Regionle ∞

Juego web de geografía para aprender las regiones, provincias y estados de los países del mundo, además de sus capitales, banderas, ciudades, ríos, mares, montañas y cifras. Está inspirado en [regionle.xyz](https://regionle.xyz) y le añade **partidas sin límite**, **filtros** para elegir qué estudiar, un **repaso espaciado** que recuerda lo que toca volver a ver y **enlaces para aprender** en cada respuesta.

**Jugar: <https://diegosb72.github.io/regionle/>**

Todo funciona en el navegador: no hay servidor, registro ni anuncios, y el progreso se guarda en `localStorage`. Está en **español e inglés**, se puede **instalar** como aplicación y funciona **sin conexión**.

## Qué incluye

| Sección | Modos |
| --- | --- |
| **Regiones** (divisiones internas de uno o varios países en un mismo mapa) | Explorar · Aprender · Señalar · Identificar · Rellenar el mapa · Silueta · Regionle · Puzle · Vecinos · Capitales · Ruta |
| **Países** | Los once anteriores, más Banderas |
| **Ciudades** (las más pobladas, las capitales de país o las capitales de región) | Explorar · Aprender · Señalar · Situar a ciegas · Identificar · Rellenar el mapa |
| **Geografía física** (ríos, lagos, mares y océanos, cordilleras, picos y volcanes, desiertos e islas, del mundo o de un continente) | Explorar · Aprender · Señalar · Identificar · Rellenar el mapa |
| **Cifras** (población o superficie) | Mayor o menor · Ordena cinco · Cifra exacta · ¿Qué país? |

- **251 países y territorios** y unas **4500 divisiones** de primer nivel. España, Francia, Italia, el Reino Unido y algunos países más se pueden jugar a dos o tres niveles (comunidades o provincias, regiones o departamentos…). Hay además **4538 ciudades** de 227 países, **593 accidentes geográficos** (entre ellos 101 picos y volcanes con su altitud) y las capitales de las regiones de 122 países.
- **Reto del día**: cada día un país y cinco pruebas cortas, las mismas para todo el mundo (adivinar una región por su silueta, señalar cinco, una ruta entre dos países, un país por su población y cinco preguntas de banderas y capitales). Hasta 100 puntos, racha, calendario con los días anteriores y resultado para compartir.
- **Sin límite**: todo lo demás se puede repetir, barajar y jugar en modo sin fin, en el que lo fallado vuelve a salir hasta que se acierta. **Regionle** es el juego clásico tantas veces como se quiera: una silueta, seis intentos y, en cada fallo, la distancia y la dirección. El modo Ruta conserva su «ruta del día» y, después, todas las rutas que se quieran.
- **Aprender**: lecciones de cinco piezas nuevas. Primero se enseñan una a una, luego se pregunta dónde está cada una y cómo se llama, y al final se mezclan con las de lecciones anteriores. Lo que se falla vuelve a salir hasta que se acierta, y la lección siguiente empieza donde se dejó.
- **Listas a medida**: se marcan en el mapa las piezas que se quieren practicar («las doce del examen del jueves»), se les pone nombre y se juega solo con ellas en cualquier modo. Una lista se comparte con un enlace que la contiene entera.
- **Contrarreloj y supervivencia**: en Señalar, Identificar, Silueta, Puzle, Capitales y Banderas se puede jugar un minuto contra el reloj o hasta el tercer fallo, con un intento por pregunta y sin pistas. Se guarda el récord de cada mapa.
- **Las preguntas no se contestan solas**: la respuesta se escribe (las cuatro opciones siguen en los ajustes). En Vecinos el mapa no dibuja las fronteras interiores y cada nombre se envía y se juzga; en Puzle, el puntero no ilumina las piezas del mapa mudo; las capitales que se llaman como su región o su país («Madrid», «Ciudad de México») no se preguntan, y con cuatro opciones tampoco las que se parecen a ella («Valencia», «Brasilia»); donde no hay tres capitales falsas que haya que saberse (Costa Rica, Portugal, Turquía…), la capital se escribe aunque se hayan pedido opciones; en los mapas físicos, las opciones falsas son del mismo tipo que la buena (ríos entre ríos).
- **Abreviaturas y variantes al escribir**: además de por su nombre (con o sin tildes, en español, en inglés o en la lengua local), cada pieza responde a una lista de formas cortas y variantes.
  - En las **regiones**, la lista es la de un quiz de JetPunk, [ALL First-Level Subdivisions of the World With a Map](https://www.jetpunk.com/user-quizzes/309965/all-first-level-subdivisions-of-the-world-with-a-map): «Mancha» o «León» bastan para las dos Castillas, «Vasco» para el País Vasco, BC y PEI valen en Canadá, «Capital» es el Territorio de la Capital Australiana, y muchas son patrones que admiten varias grafías («Galizia», «Estremadura», «Cattalonia»). En Estados Unidos valen además NH, NJ, NM, NY, NC, SC, ND, SD y WV. Donde la lista dice algo de una región no hay siglas automáticas: vale lo que dice la lista (NSW o CLM ya no, salvo que se enciendan).
  - En los **países, las ciudades y las capitales**, y en las regiones de las que la lista no habla, un nombre de varias palabras se puede escribir por sus iniciales: RD o NZ entre los países, LA o NY entre las ciudades, KL entre las capitales, LP por Las Palmas. Un nombre de una sola palabra no tiene siglas: MA no es Massachusetts ni TX es Texas, porque eso son códigos que hay que saberse de memoria y no algo que el nombre diga. Tampoco valen las siglas que en ese mapa pueden ser dos nombres; el juego lo dice y no lo cuenta como fallo. En geografía física no hay siglas: «Lago», «Mar» o «Golfo» no son parte del nombre.
  - Nada de esto vale mientras haya letras del nombre a la vista como pista: entonces se escribe entero, y el juego lo avisa sin contarlo como fallo. RI viene apagada, así que Rhode Island se escribe entero; como cualquier otra, se enciende en Configuración.
- **Configuración** (el engranaje de la cabecera): la lista de todo lo que se puede escribir en el juego (países, regiones de cada país y en cada nivel, ciudades, capitales y geografía física), cada pieza con su **id**, sus nombres y las abreviaturas y variantes por las que responde. Cada una se apaga o se enciende con un toque y a cualquier pieza se le pueden añadir las que se quieran: una grafía (MA para Massachusetts, o «Mass») o un patrón como los de JetPunk, que empieza por `r:` (una expresión regular: `r:^GALI[CZ]I?A`) o por `c:` (letras que basta con que aparezcan: `c:CAPITAL`). Un interruptor quita de una vez todas las siglas automáticas. Se busca por nombre, id o abreviatura, y un aviso señala las que no nombran nada porque en ese mapa podrían ser dos piezas. Los cambios se guardan en el navegador, valen en todos los modos en los que se escribe y se exportan e importan en un archivo.
- **Situar a ciegas**: el mapa no muestra ninguna ciudad y hay que hacer clic donde se cree que está. Cuenta la distancia en kilómetros, con un margen que depende del tamaño del mapa.
- **Repaso espaciado**: cada respuesta vuelve cuando está a punto de olvidarse (al día siguiente, a los 3 días, a los 7, 16, 35 y 75); un fallo la trae de vuelta el mismo día. La portada propone el repaso de hoy, agrupado por mapas. Si una corrección de los datos retira algo que estaba pendiente (una ciudad que la fuente situaba en el país de al lado, la capital de una división que ya no existe), sale del repaso en lugar de quedarse pendiente para siempre.
- **Filtros**: por continente y subregión, tipo de territorio, litoral, población, superficie y número de divisiones; atajos (Mundo, Unión Europea, hispanohablantes, G20…) y selecciones guardadas.
- **Para estudiar**: cada respuesta enlaza con Wikipedia, OpenStreetMap y vídeos, y tiene un botón para **oír el nombre** con la voz del navegador; al fallar se muestra un resumen de Wikipedia con su foto (se puede desactivar); el modo Explorar muestra la ficha y los vecinos de cada pieza, y al terminar se puede repasar solo lo fallado.
- **Retos por enlace**: al acabar una partida se puede enviar un enlace con las mismas preguntas en el mismo orden y el resultado que hay que superar. No hace falta servidor: todo viaja en el propio enlace.
- **Logros y niveles**: 29 logros (continentes completos, un país al detalle, rachas del reto diario, récords de cada modo…) y diez niveles, de Turista a Atlas viviente. Se calculan con lo que ya está guardado, así que quien jugaba antes empieza con lo que tenía ganado.
- **Progreso**: nivel y logros, mapa de lo que se sabe (aprendido, aprendiendo, toca repasar), previsión de repasos de la semana, aciertos por habilidad, últimas partidas y récords, con exportación e importación en un archivo (incluye las listas y las abreviaturas de Configuración).
- **Sin conexión**: la aplicación se guarda en el navegador la primera vez que se abre y los mapas, según se van usando; el botón «Descargar todo» del pie de página baja de una vez todos los mapas y banderas (unos 3 MB comprimidos). Cuando hay una versión nueva, se avisa y no cambia nada hasta que se acepta.
- Español e inglés (se elige en la cabecera; por defecto, el idioma del navegador), tema claro y oscuro, **colores para daltónicos** (azul, amarillo y bermellón, con tramas en el mapa; se activan en el pie de página), uso con teclado y diseño adaptado al móvil.

## Puesta en marcha

Hace falta Node.js 20.19 o posterior (22.12 o posterior en la rama 22; se ha desarrollado con Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Orden | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba los tipos, genera `dist/` y le añade el *service worker* (`sw.js`) y la lista de la descarga completa (`offline.json`) |
| `npm run build:pages` | Lo mismo, pero en `docs/`, la carpeta que publica GitHub Pages |
| `npm run preview` | Sirve `dist/` en el puerto 4173 |
| `npm test` | Pruebas (Vitest), incluidas las comprobaciones de los datos generados |
| `npm run typecheck` | Solo la comprobación de tipos |

### Publicación

`npm run build` deja en `dist/` un sitio estático de unos 13 MB (la aplicación, los mapas y las banderas). Las rutas van en el `#` de la dirección y los recursos se piden con rutas relativas, así que sirve tal cual en cualquier alojamiento estático y en cualquier subcarpeta (GitHub Pages, Netlify, un directorio de un servidor propio…).

#### GitHub Pages

Lo que se publica es la carpeta `docs/` de la rama `main`, que contiene el juego ya compilado. Hay que activarlo una sola vez en GitHub:

1. Abrir **Settings → Pages** en el repositorio.
2. En **Build and deployment**, elegir **Source: Deploy from a branch**.
3. En **Branch**, elegir `main` y la carpeta `/docs`, y pulsar **Save**.

Al cabo de un minuto el juego estará en <https://diegosb72.github.io/regionle/>.

Para publicar una versión nueva hay que recompilar esa carpeta y subirla:

```bash
npm run build:pages
git add docs
git commit -m "Publica la última versión"
git push
```

El archivo `docs/.nojekyll` (se copia desde `public/`) hace que GitHub Pages sirva los archivos tal cual, sin pasarlos por Jekyll.

#### Instalación y uso sin conexión

El último paso de la compilación (`scripts/pwa/build.mjs`) escribe en la carpeta compilada un *service worker* con la lista de archivos de la aplicación y un número de versión calculado a partir de su contenido. Solo se registra en el sitio compilado (no en `npm run dev`) y necesita HTTPS o `localhost`, como cualquier *service worker*. La aplicación se sirve desde la copia guardada; los mapas se piden primero a la red y, si no responde, se usa la copia; las banderas se toman siempre de la copia si la hay.

## Datos

Los mapas ya generados están en `public/data/` y se versionan, de modo que no hace falta reconstruirlos para ejecutar o publicar el juego. Para rehacerlos:

```bash
npm run data:fetch      # descarga las fuentes a .cache/src (no se versiona)
npm run data:build      # países y regiones: genera public/data y el informe .cache/report.txt
npm run data:physical   # ciudades, capitales de región y geografía física
npm run data            # las tres cosas seguidas

npm i --no-save all-the-cities@3.1.0 && npm run data:check   # segunda opinión sobre ciudades y capitales
```

- `data:fetch` descarga archivos de GitHub fijados por *commit* y verificados por su SHA. Usa la API si hay un token (`GH_TOKEN`, `GITHUB_TOKEN` o la CLI `gh`) y, si no, `raw.githubusercontent.com`.
- `data:build` puede usar hasta unos 3 GB de memoria. Une las divisiones de Natural Earth en una topología por país, las simplifica, calcula vecinos por tierra y travesías cortas por mar (hasta 40 km), y escribe:
  - `index.json`: países con nombre, capital, población, superficie, vecinos y niveles disponibles;
  - `world.json`: el mapa del mundo por países;
  - `r/<ISO>.json`: las divisiones de cada país (TopoJSON).
- `data:physical` necesita que `data:build` se haya ejecutado antes (sitúa cada ciudad en su región) y escribe:
  - `physical.json`: 177 ríos, 113 mares y océanos, 101 picos y volcanes, 76 lagos, 64 cordilleras, 43 islas y 19 desiertos, con nombre en español e inglés y una marca para los más conocidos, que son los que se juegan por defecto. Los picos son un punto con su altitud; su posición y su altura salen de Natural Earth, y la lista de cuáles entran está en `physical-config.mjs`;
  - `cities.json`: las 60 ciudades más pobladas de cada país y todas las capitales. La marca de «capital de región» de una ciudad sale de `capitals.json` y no de la fuente, así que las dos secciones dicen lo mismo;
  - `capitals.json`: la capital de cada región, en los países y niveles en los que la fuente la señala para al menos el 70 % de las regiones (las de España y Francia, incluidos los 96 departamentos, están escritas a mano): 2151 capitales de 122 países.
- `data:check` no genera nada: compara lo construido con [GeoNames](https://www.geonames.org/) (el paquete `all-the-cities`, que no es una dependencia del proyecto y hay que instalar antes) y lista lo que no coincide. Natural Earth marca como capital de región ciudades que no lo son (la antigua capital, la ciudad más grande, la vecina del otro lado del río), sitúa algunos pueblos fronterizos en el país de al lado y da a alguna aldea la población de una tocaya famosa; nada en la propia fuente dice cuáles. Cada diferencia se ha revisado una a una: las correcciones están en `physical-config.mjs` (`REGION_CAPITAL_FIXES`, 70 capitales de 45 países; `CITY_COUNTRY`, 9 ciudades; `CITY_DROP`, 9 lugares) y lo que difiere y está bien, con su motivo, en el propio `check.mjs`. De GeoNames no se distribuye ningún dato.
- Los **nombres** de las divisiones vienen de Natural Earth en varios campos (el nombre local, el inglés, el español, el de GeoNames, el id de Wikidata) que no siempre hablan del mismo sitio: hay etiquetas de la división de al lado, de la provincia en vez de la región, de la capital, de otro país, cortadas a medias («The», «Kam»), con una errata («Vekila Polana» por Velika Polana) o repetidas en veinte piezas. `data:build` contrasta unos campos con otros, no usa la etiqueta que no cuadra y **avisa** de lo que solo se arregla a mano: dos piezas de un mapa con el mismo nombre, dos con el mismo id de Wikidata, una corrección que ya no hace falta y las cadenas en las que GeoNames llama a una pieza con el nombre de otra y a esta con el de una tercera, que es la huella de los nombres puestos sobre el polígono que no es (pasaba en Guyana, Eritrea y Ecuador). El informe `.cache/report.txt` trae los avisos y, al final, las etiquetas que no se han creído; `.cache/names.json`, de qué campo sale cada nombre. Las pruebas de `src/lib/dataset.test.ts` repasan lo generado (ningún nombre repetido sin motivo en un mapa, ninguno que sea solo un artículo, los casos corregidos uno a uno). Lo corregido está en `config.mjs`:
  - `SOURCE_FIX` corrige los campos de la fuente, pieza por pieza, por su `adm1_code` (134 piezas) antes de que nada los lea. `UNIT_NAME` queda para los nombres que se eligen, no para los que estaban mal: con él, el nombre equivocado seguiría valiendo al escribir.
  - `HOMONYMS` son las piezas que se llaman igual de verdad (la ciudad de Minsk y su provincia, las dos Hsinchu).
  - `TRUST_ES_UNIT` y `TRUST_EN_UNIT` son las etiquetas que no se parecen al nombre local y aun así son buenas (Jartum, Tiflis, Nueva Irlanda), leídas una a una. Los puntos cardinales no hace falta listarlos: «Noroeste» se da por traducción de «North-Western».
  - `NON_QUIZ` son las piezas que se dibujan y no se preguntan, porque no son una división del país (las dos zonas neutrales de los Emiratos).
  - En las ciudades hace lo mismo `CITY_FIX`, en `physical-config.mjs` (45 ciudades: la etiqueta de otra cosa, «Ciudad» o «Distrito» delante, alguna grafía).
- Las decisiones editoriales (nombres en español, agrupaciones, niveles, correcciones de la fuente) están en `scripts/data/config.mjs` y, para la geografía física, en `scripts/data/physical-config.mjs`.

### Criterios

- Las fronteras siguen el criterio de Naciones Unidas y no suponen ninguna toma de postura: Crimea figura en Ucrania, el Sáhara Occidental aparece completo y los Altos del Golán en Siria.
- Los territorios de ultramar con código ISO propio (Guayana Francesa, Reunión, Svalbard…) son piezas aparte de su metrópoli y están ocultos por defecto tras el filtro «Territorios dependientes».
- Los nombres están en español cuando la fuente ofrece uno fiable; en caso contrario se usa el nombre local o el inglés. Al escribir se aceptan también los nombres alternativos y se ignoran tildes y mayúsculas.
- Las **siglas** no están escritas en ninguna lista: salen de los nombres (`initialsOf` y `Matcher` en `src/lib/text.ts`). Manda el nombre con el que se muestra la pieza en el idioma del juego: si tiene varias palabras, valen sus iniciales y las de sus nombres en los otros idiomas, contando o saltando las palabras de enlace («Trinidad y Tobago» es TT y TYT; «República Democrática del Congo», RDC y RDDC); si tiene una sola, no hay siglas aunque en otro idioma tenga más («Komi» no es KR por llamarse «Komi Republic» en inglés, ni «Sudáfrica» es SA en español). Las siglas que deletrean dos piezas del mapa, o que son el código ISO de otra pieza (ES no es El Salvador en un mapa en el que está España), no nombran a ninguna. Las abreviaturas de uso común que no salen de las iniciales (EEUU, CDMX, DF, CABA, NWT, KZN…) están a mano entre los nombres alternativos de `scripts/data/config.mjs`.
- Sobre esa regla manda lo que diga **Configuración**, pieza por pieza y por su id (`src/lib/typeins.ts`): qué formas están apagadas, cuáles se han añadido y si la pieza tiene siglas automáticas (`"rule": false` se las quita). El juego trae las suyas en `src/lib/typeins.default.json`, con el mismo formato que el archivo que exporta la pantalla. Lo que elige cada jugador se guarda aparte, como diferencia respecto a lo que trae el juego. Una forma añadida a mano vale tal cual, también donde unas siglas automáticas no valdrían (MG para Minas Gerais, aunque Mato Grosso empiece igual); las capitales llevan su propio id (`cap:` y el de su país o región) porque «BA» puede ser Buenos Aires sin ser Argentina.
- Lo que el juego trae **de fábrica para las regiones** sale de la lista de type-ins de un quiz de JetPunk y no se edita a mano: lo escribe `npm run typeins` (`scripts/typeins/build.mjs`) a partir de tres archivos de esa carpeta.
  - `jetpunk.txt` es la lista: por cada respuesta, su código, su nombre y sus type-ins, que son grafías (`BC`) o patrones (`r:` y una expresión regular, o `c:` y unas letras).
  - Cada respuesta se casa con las piezas del juego que se llaman igual en su país, o con la de su mismo código si el nombre se parece; `match.json` guarda las que hubo que casar a mano.
  - `extra.json` es lo que el juego cambia de la lista: lo que **añade** (las siglas de los estados de EE. UU. con nombre de varias palabras, que la lista no trae) y lo que **quita** (un descuido en Kazajistán, y «Győr» y «Sopron» como type-ins de su condado, porque en el mapa del juego esas dos ciudades son piezas aparte). Para cambiar lo que vale de fábrica se toca ese archivo, se ejecuta `npm run typeins` y se compila (`npm run build:pages`); una prueba falla si `typeins.default.json` no es lo que escribe el script.
  - `informe.md`, que el script escribe a la vez, dice qué ha entrado y qué no: las respuestas que no casan con ninguna pieza (el quiz va más al día que el mapa del juego, y a veces a otro nivel), las casadas a mano y los type-ins que comparten dos piezas de un mismo mapa.
  - Una pieza casada lleva los type-ins de su respuesta y, si su nombre tiene varias palabras, ninguna sigla automática. Las piezas de las que la lista no habla, y los países, las ciudades, las capitales y la geografía física, quedan como estaban.
- Un **patrón** se prueba sobre lo escrito con las letras y las cifras seguidas, sin tildes, espacios ni mayúsculas. El nombre escrito entero va siempre antes: «Shanxi» es Shanxi aunque el patrón de Shaanxi también lo acepte. Al rellenar un mapa, lo que un patrón acepta de principio a fin se toma al momento si ningún nombre del mapa puede seguir desde ahí, y con Intro en caso contrario («South» espera, porque puede ir hacia «South Australia», y también lo que parece el principio del nombre de esa misma pieza con una errata); con Intro vale además lo que el patrón encuentra dentro de lo escrito, como en JetPunk.
- Lo que se escribe vale para **todas las piezas que responden a ello**: la lista da «Basel» a los dos cantones de Basilea y el nombre de Santo Domingo al Distrito Nacional (y al revés), y al rellenar el mapa se rellenan los dos. En los juegos que toman una sola respuesta (Regionle, Ruta, el reto del día) va primero la pieza que se llama así, y mientras haya letras a la vista una pieza solo responde a sus nombres.

## Estructura

```
scripts/data/      Descarga y construcción de los datos
scripts/typeins/   Lista de type-ins de JetPunk y el script que escribe lo que el juego trae de fábrica
scripts/pwa/       Service worker y paso final de la compilación
public/data/       Datos generados que usa el juego
public/icons/      Iconos de la aplicación instalada
docs/              El juego compilado que publica GitHub Pages (no se edita a mano)
src/lib/           Tipos, carga de datos, geometría, texto, abreviaturas, idiomas, estado guardado, repaso, retos, listas, logros, enlaces
src/components/    Mapa (d3-geo + SVG), selector de países, campo de respuesta, ficha de Wikipedia, voz, logros
src/games/         Lógica y pantallas de cada modo
src/daily/         Reto del día
src/screens/       Inicio, preparación de la partida, partida, reto o lista recibidos, progreso y configuración
src/styles.css     Hoja de estilos única
```

Hecho con React 19, TypeScript, Vite, d3-geo, TopoJSON y Zustand. Los textos de la interfaz están junto al código que los muestra, en los dos idiomas (`L('español', 'English')` en `src/lib/i18n.ts`).

## Limitaciones conocidas

- El mapa de **todas las regiones del mundo a la vez** (más de 3000 piezas) funciona, pero es pesado: tarda unos segundos en cargar y el zoom va menos fluido en equipos modestos.
- El progreso vive solo en el navegador en el que se juega; para llevarlo a otro hay que exportarlo e importarlo desde «Progreso».
- Los **nombres** se han repasado contrastando los campos de la fuente entre sí (véase «Datos») y leyendo lo que no cuadraba, no con una segunda fuente completa: en las divisiones pequeñas y poco conocidas puede quedar alguno mal. Cerca de treinta etiquetas de la fuente que no se han podido comprobar se quedan sin usar (están al final de `.cache/report.txt`), y esas piezas salen con su otro nombre, el local o el inglés. Una ciudad y la región que lleva su nombre no siempre se escriben igual en español (Rangún y Yangon, Trebisonda y Trabzon, Alma Ata y Almaty): cada una sigue su etiqueta. Los nombres de los accidentes geográficos poco conocidos proceden directamente de la fuente.
- La población de las ciudades es la de su **área urbana** según Natural Earth, no la del municipio, y la lista de ciudades de cada país es la de esa fuente: puede faltar alguna ciudad grande y sobrar alguna pequeña.
- Las **capitales de región** no están disponibles en todos los países ni en todos los niveles (faltan, por ejemplo, las de las provincias de Italia y las zonas de Nepal, que ya no existen). Donde casi todas las capitales se llaman como su región queda poco que preguntar: de las 52 provincias de España solo se preguntan las ocho en las que el nombre no coincide, en siete países queda una sola pregunta y en doce, ninguna (el juego lo dice al empezar). En total se preguntan 1219 de las 2151. Los Emiratos no tienen capitales de región: cada emirato se llama como la suya.
- La **lista de type-ins** de las regiones es la de un quiz de primer nivel hecho sobre un mapa más reciente que el del juego: de sus 4299 respuestas, unas 860 no casan con ninguna pieza (casi todas, divisiones que el juego no tiene) y sus type-ins se quedan fuera; están en `scripts/typeins/informe.md`. La lista entra tal como viene: un mismo type-in puede valer para dos piezas de un mapa («Berbice» rellena dos regiones de Guyana) y los patrones son tan laxos como están escritos. Está pensada país por país: en un mapa con varios países a la vez, un type-in corto como «North» o «West» vale para todas las piezas que lo tienen, sean del país que sean. Las provincias y demás niveles por debajo del primero solo reciben type-ins cuando se llaman igual que una respuesta de la lista.
- Las **siglas** se deducen de los nombres tal como se muestran, y en un mapa con varios países a la vez son más las que se pisan entre sí y dejan de valer.
- Un **patrón** añadido a mano en Configuración es una expresión regular que se ejecuta tal cual en el navegador de quien la escribe: el juego comprueba que se puede leer y que no pasa de 160 caracteres, no que sea rápida.
- Las abreviaturas de **Configuración** son de cada pieza, por su id: la provincia de Madrid (`ES-M`) y la Comunidad de Madrid (`ES-MD`) se cambian por separado, lo mismo que un país y su capital. Viven en el navegador, como el progreso, así que en un reto por enlace o en el reto del día cada jugador escribe con las suyas. El juego avisa de las que chocan dentro de un mapa de la lista, pero no puede saber con qué otros países se va a mezclar ese mapa en una partida; y una abreviatura añadida a mano a dos piezas vale para las dos.
- En **inglés**, las capitales de región se muestran con su nombre en español cuando lo tienen («La Haya»); al escribir se acepta también el inglés.
- Algunos mapas siguen una **división administrativa antigua** (las provincias de Kenia, las regiones de Ghana o de Marruecos anteriores a sus reformas, los diez estados de Sudán del Sur): es la que trae la fuente. Donde la división es la misma y solo ha cambiado el nombre (Sughd, Elías Piña, Davao de Oro), el juego muestra el de hoy y acepta el anterior.
- Los **picos y volcanes** son los que trae Natural Earth: faltan algunos conocidos (Annapurna, Cotopaxi, Santa Helena, Mauna Loa…) y no se han añadido a mano.
- El botón de **oír el nombre** usa la voz que tenga el navegador para el idioma de la interfaz: los nombres que se conservan en su lengua (Bouches-du-Rhône) suenan con ese acento, y donde no hay voz instalada no se oye nada.
- La ficha de Wikipedia y los enlaces externos necesitan conexión; sin ella, simplemente no aparecen.
- El reto del día se calcula en el dispositivo a partir de la fecha: es el mismo para todo el mundo, pero no hay clasificación ni se comprueba en ningún servidor.

## Fuentes y licencias

- **Mapas, ciudades y geografía física**: [Natural Earth](https://www.naturalearthdata.com/) 1:10m y 1:50m, dominio público.
- **Población**: Banco Mundial (indicador `SP.POP.TOTL`, dato de 2025 para la mayoría de los países), a través de [datasets/population](https://github.com/datasets/population), ODC-PDDL.
- **Capitales, superficies y otros datos de países**: [GeoNames](https://www.geonames.org/), CC BY 4.0. GeoNames es también el contraste con el que se han corregido las capitales de región y el país de las ciudades fronterizas (`npm run data:check`) y, por el campo `gn_name` de Natural Earth, uno de los contrastes de los nombres de las divisiones. En el repaso de esos nombres se usó además, una sola vez y sin distribuir nada de ella, la lista de divisiones con coordenadas de [countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database), para ver qué código cae en qué polígono.
- **Abreviaturas y variantes de las regiones**: los type-ins del quiz de JetPunk [ALL First-Level Subdivisions of the World With a Map](https://www.jetpunk.com/user-quizzes/309965/all-first-level-subdivisions-of-the-world-with-a-map), de Vicky, tal como vienen en la tabla del quiz (`scripts/typeins/jetpunk.txt`).
- **Banderas**: [flag-icons](https://github.com/lipis/flag-icons), MIT.
- **Resúmenes y fotos de la ficha**: [Wikipedia](https://www.wikipedia.org/) y [Wikidata](https://www.wikidata.org/), consultadas desde el navegador de quien juega; los textos son CC BY-SA 4.0 y cada ficha enlaza con su artículo.
- **Tipografías**: Fraunces y DM Sans, SIL Open Font License 1.1, empaquetadas por [Fontsource](https://fontsource.org/).
- **Iconos**: [Lucide](https://lucide.dev/), ISC.

La idea original es de [regionle.xyz](https://regionle.xyz); este proyecto no usa su código ni sus datos.
