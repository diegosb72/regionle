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
- **Reto del día**: cada día un país y cinco pruebas cortas, las mismas para todo el mundo (adivinar una región por su silueta, señalar cinco, una ruta entre dos países, un país por su población y cinco preguntas de banderas y capitales). Hasta 100 puntos, racha, calendario con los días anteriores y resultado para compartir, como texto o como **imagen**: una tarjeta cuadrada con el país, su mapa, los puntos y las cinco pruebas, que se dibuja en el propio navegador (en el ordenador se descarga; en el móvil se comparte directamente).
- **Sin límite**: todo lo demás se puede repetir, barajar y jugar en modo sin fin, en el que lo fallado vuelve a salir hasta que se acierta. **Regionle** es el juego clásico tantas veces como se quiera: una silueta, seis intentos y, en cada fallo, la distancia y la dirección. El modo Ruta conserva su «ruta del día» y, después, todas las rutas que se quieran.
- **Aprender**: lecciones de cinco piezas nuevas. Primero se enseñan una a una, luego se pregunta dónde está cada una y cómo se llama, y al final se mezclan con las de lecciones anteriores. Lo que se falla vuelve a salir hasta que se acierta, y la lección siguiente empieza donde se dejó.
- **Listas a medida**: se marcan en el mapa las piezas que se quieren practicar («las doce del examen del jueves»), se les pone nombre y se juega solo con ellas en cualquier modo. Una lista se comparte con un enlace que la contiene entera. La portada lo cuenta y `#/lista` explica cómo se hace una.
- **Contrarreloj y supervivencia**: en Señalar, Identificar, Silueta, Puzle, Capitales y Banderas se puede jugar un minuto contra el reloj o hasta el tercer fallo, con un intento por pregunta y sin pistas. Se guarda el récord de cada mapa.
- **Las preguntas no se contestan solas**: la respuesta se escribe (las cuatro opciones siguen en los ajustes). En Vecinos el mapa no dibuja las fronteras interiores y cada nombre se envía y se juzga; en Puzle, el puntero no ilumina las piezas del mapa mudo; las capitales que se llaman como su región o su país («Madrid», «Ciudad de México») no se preguntan, y con cuatro opciones tampoco las que se parecen a ella («Valencia», «Brasilia»); donde no hay tres capitales falsas que haya que saberse (Costa Rica, Portugal, Turquía…), la capital se escribe aunque se hayan pedido opciones; en los mapas físicos, las opciones falsas son del mismo tipo que la buena (ríos entre ríos).
- **Abreviaturas y variantes al escribir**: además de por su nombre (con o sin tildes, en español, en inglés o en la lengua local), cada pieza responde a una lista de formas cortas y variantes.
  - En las **regiones**, la lista es la de un quiz de JetPunk, [ALL First-Level Subdivisions of the World With a Map](https://www.jetpunk.com/user-quizzes/309965/all-first-level-subdivisions-of-the-world-with-a-map): «Mancha» o «León» bastan para las dos Castillas, «Vasco» para el País Vasco, BC y PEI valen en Canadá, «Capital» es el Territorio de la Capital Australiana, y muchas son patrones que admiten varias grafías («Galizia», «Estremadura», «Cattalonia»). En Estados Unidos valen además NH, NJ, NM, NY, NC, SC, ND, SD y WV. Donde la lista dice algo de una región no hay siglas automáticas: vale lo que dice la lista (NSW o CLM ya no, salvo que se enciendan).
  - En los **países, las ciudades y las capitales**, y en las regiones de las que la lista no habla, un nombre de varias palabras se puede escribir por sus iniciales: RD o NZ entre los países, LA o NY entre las ciudades, KL entre las capitales, LP por Las Palmas. Un nombre de una sola palabra no tiene siglas: MA no es Massachusetts ni TX es Texas, porque eso son códigos que hay que saberse de memoria y no algo que el nombre diga. Tampoco valen las siglas que en ese mapa pueden ser dos nombres; el juego lo dice y no lo cuenta como fallo. En geografía física no hay siglas: «Lago», «Mar» o «Golfo» no son parte del nombre.
  - Nada de esto vale mientras haya letras del nombre a la vista como pista: entonces se escribe entero, y el juego lo avisa sin contarlo como fallo. RI viene apagada, así que Rhode Island se escribe entero; como cualquier otra, se enciende en Configuración.
- **Configuración** (el engranaje de la cabecera): la lista de todo lo que se puede escribir en el juego (países, regiones de cada país y en cada nivel, ciudades, capitales y geografía física), cada pieza con su **id**, sus nombres y las abreviaturas y variantes por las que responde. Cada una se apaga o se enciende con un toque y a cualquier pieza se le pueden añadir las que se quieran: una grafía (MA para Massachusetts, o «Mass») o un patrón como los de JetPunk, que empieza por `r:` (una expresión regular: `r:^GALI[CZ]I?A`) o por `c:` (letras que basta con que aparezcan: `c:CAPITAL`). Un patrón no se enseña como se escribe sino por las variantes que acepta, todas juntas en una pieza que se enciende y se apaga de una vez: en Galicia se lee GALICIA · GALIZA · GALICA · GALIZIA, y donde son muchas (las 208 de Castilla y León) salen las primeras y un «+202» que las despliega. Van como se comparan, sin espacios ni tildes, primero las que salen de los nombres de la pieza; una letra que puede repetirse sale una y dos veces (vale también con tres), no aparece la que en ese mapa es el nombre de otra («Shanxi» entre las de Shaanxi), los pocos patrones que admiten cualquier letra en un sitio lo dicen con «…» y los que dan para más de 240 variantes enseñan esas y avisan de que hay más. Un interruptor quita de una vez todas las siglas automáticas. Se busca por nombre, id, abreviatura o variante, y un aviso señala las que no nombran nada porque en ese mapa podrían ser dos piezas. Los cambios se guardan en el navegador, valen en todos los modos en los que se escribe y se exportan e importan en un archivo.
- **Situar a ciegas**: el mapa no muestra ninguna ciudad y hay que hacer clic donde se cree que está. Cuenta la distancia en kilómetros, con un margen que depende del tamaño del mapa.
- **Repaso espaciado**: cada respuesta vuelve cuando está a punto de olvidarse (al día siguiente, a los 3 días, a los 7, 16, 35 y 75); un fallo la trae de vuelta el mismo día. La portada propone el repaso de hoy, agrupado por mapas. Si una corrección de los datos retira algo que estaba pendiente (una ciudad que la fuente situaba en el país de al lado, la capital de una división que ya no existe), sale del repaso en lugar de quedarse pendiente para siempre.
- **Filtros**: por continente y subregión, tipo de territorio, litoral, población, superficie y número de divisiones; atajos (Mundo, Unión Europea, hispanohablantes, G20…) y selecciones guardadas.
- **Para estudiar**: cada respuesta enlaza con Wikipedia, OpenStreetMap y vídeos, y tiene un botón para **oír el nombre** con la voz del navegador, que es un interruptor: mientras suena se ve y se anuncia (`aria-pressed`), y pulsarlo otra vez lo calla; al fallar se muestra un resumen de Wikipedia con su foto (se puede desactivar), en el idioma del juego o, si ahí no hay artículo o no dice nada, en el otro; el modo Explorar muestra la ficha y los vecinos de cada pieza, y al terminar se puede repasar solo lo fallado.
- **Retos por enlace**: al acabar una partida se puede enviar un enlace con las mismas preguntas en el mismo orden y el resultado que hay que superar. No hace falta servidor: todo viaja en el propio enlace. El botón solo aparece al acabar una partida, así que la portada lo cuenta y `#/duelo` explica cómo se envía un reto y en qué juegos.
- **Logros y niveles**: 29 logros (continentes completos, un país al detalle, rachas del reto diario, récords de cada modo…) y diez niveles, de Turista a Atlas viviente. Se calculan con lo que ya está guardado, así que quien jugaba antes empieza con lo que tenía ganado.
- **Progreso**: nivel y logros, mapa de lo que se sabe (aprendido, aprendiendo, toca repasar), previsión de repasos de la semana, aciertos por habilidad, últimas partidas y récords, con exportación e importación en un archivo (incluye las listas y las abreviaturas de Configuración).
- **Lo que más fallas** (en Progreso): las respuestas falladas dos veces o más que siguen sin salir, por su nombre y mapa por mapa, con las más falladas primero y un botón que abre una partida solo con ellas. Dos aciertos seguidos a la primera las sacan de la lista.
- **El repaso en una tabla**: «Descargar el repaso (CSV)» guarda una fila por respuesta (nombre, capital si es lo que se pregunta, mapa, qué se pregunta, estado, veces preguntada, aciertos a la primera, racha, última vez y próximo repaso) para abrirla en una hoja de cálculo o importarla en Anki. Va en UTF-8 con marca, con `;` en español y `,` en inglés.
- **Sin conexión**: la aplicación se guarda en el navegador la primera vez que se abre y los mapas, según se van usando; el botón «Descargar todo» del pie de página baja de una vez todos los mapas y banderas (unos 3 MB comprimidos). Cuando hay una versión nueva, se avisa y no cambia nada hasta que se acepta.
- **Con teclado**: todo el juego se usa sin ratón ni pantalla táctil. En los mapas en los que hay que elegir una pieza (Señalar, Puzle, Aprender, el reto del día…) se llega al mapa con Tab, las flechas llevan un cursor a la pieza vecina por ese lado, AvPág y RePág las recorren de oeste a este (Inicio y Fin van a la primera y a la última), Intro o Espacio eligen y `+`, `−` y `0` mueven el zoom. En Situar a ciegas las flechas mueven una cruz (con Mayús, a pasos cortos). Mientras se pregunta por una pieza, el cursor dice su lugar en la cuenta y no su nombre, que sería la respuesta. Las teclas están en «Acerca de».
- **Atajos**: en cualquier pantalla, `1` a `5` abren las secciones, `R` el reto del día, `P` el progreso y `T` cambia el tema; `?` (o «Atajos de teclado», en el pie) enseña todas las teclas. Son teclas sueltas: no hacen nada mientras se escribe, mientras un mapa tiene el teclado ni durante una partida (salvo `?`), y se apagan con un interruptor en ese mismo panel.
- **Primera vez**: quien entra sin haber jugado encuentra en la portada cómo se juega, en tres pasos. Desaparece al cerrarla o al jugar la primera partida.
- **Sigue donde lo dejaste**: la portada enseña los últimos mapas jugados (qué juego, qué mapa y a qué nivel, cómo fue y cuándo) y cada uno se vuelve a empezar con un clic, tal como era: contrarreloj si lo era, con las mismas ciudades o con superficie en lugar de población. Debajo están las selecciones de países guardadas en los menús. No entran los repasos, los retos recibidos, las rondas de fallos ni las listas, que tienen su sitio.
- **Cuánto dura y cómo se te da**: bajo la descripción de cada modo, los menús dicen cuántas preguntas tendrá la partida elegida y los minutos que llevará (con tu ritmo en ese modo en cuanto has jugado una partida; antes, con una cifra general), y el porcentaje que aciertas a la primera en ese modo. La etiqueta Fácil, Medio o Difícil es la misma para todos; esto no.
- **Sonidos y vibración**: apagados hasta que se piden, en el pie de página. Dos notas hacia arriba al acertar, una si hizo falta ayuda, dos hacia abajo al fallar y una grave en un intento fallido con intentos por delante; en el móvil, un toque o dos. Las notas las hace el navegador: no se descarga ningún sonido.
- **Acerca de** (en el pie de página): la versión y las novedades de cada una, las teclas, qué se guarda y dónde (nada sale del navegador) y las fuentes con sus licencias.
- **Si algo falla**: una pantalla que se rompe, o que no llega a cargarse, lo dice y deja reintentar, recargar o volver al inicio sin perder el progreso; una dirección que no existe lo dice y enlaza con todo lo demás, en lugar de enseñar la portada.
- Español e inglés (se elige en la cabecera; por defecto, el idioma del navegador), tema claro y oscuro, **colores para daltónicos** (azul, amarillo y bermellón, con tramas en el mapa; se activan en el pie de página) y diseño adaptado al móvil.

## Puesta en marcha

Hace falta Node.js 20.19 o posterior (22.12 o posterior en la rama 22; se ha desarrollado con Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Orden | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba los tipos, genera `dist/`, le añade el *service worker* (`sw.js`) y la lista de la descarga completa (`offline.json`) y comprueba que la primera carga no pasa de su tamaño (véase «Tamaño») |
| `npm run build:pages` | Lo mismo, pero en `docs/`, la carpeta que publica GitHub Pages |
| `npm run preview` | Sirve `dist/` en el puerto 4173 |
| `npm test` | Pruebas (Vitest), incluidas las comprobaciones de los datos generados |
| `npm run typecheck` | Solo la comprobación de tipos |
| `npm run e2e` | Pruebas en un navegador de verdad (Playwright, carpeta `e2e/`): compila el sitio, lo sirve y juega con él, con ratón, con teclado, con el dedo y sin conexión. La primera vez hay que bajar el navegador con `npx playwright install chromium` |
| `npm run social` | Vuelve a dibujar las imágenes que acompañan al enlace del juego en redes y mensajería (`public/social-es.png` y `public/social-en.png`), con ese mismo navegador |

### Publicación

`npm run build` deja en `dist/` un sitio estático de unos 13 MB (la aplicación, los mapas y las banderas). Las rutas van en el `#` de la dirección y los recursos se piden con rutas relativas, así que sirve tal cual en cualquier alojamiento estático y en cualquier subcarpeta (GitHub Pages, Netlify, un directorio de un servidor propio…).

#### Páginas, buscadores y enlaces compartidos

La compilación escribe diecisiete páginas. Todas son el mismo juego: lo que cambia de una a otra es lo que dice la cabecera, que es lo que leen los buscadores y lo que enseña un enlace al compartirlo.

- **Tres del juego**, que solo se distinguen en el idioma: `index.html`, `es.html` y `en.html`.
- **Catorce de pantalla**, una por pantalla e idioma, que abren el juego directamente en ella:

  | Pantalla | Español | Inglés |
  | --- | --- | --- |
  | Regiones | `regiones.html` | `regions.html` |
  | Países | `paises.html` | `countries.html` |
  | Ciudades | `ciudades.html` | `cities.html` |
  | Geografía física | `fisica.html` | `physical.html` |
  | Cifras | `cifras.html` | `figures.html` |
  | Reto del día | `reto.html` | `daily.html` |
  | Acerca de | `acerca.html` | `about.html` |

Cada una lleva su título y su descripción, su dirección canónica, sus alternativas por idioma (`hreflang`), lo que leen las redes y la mensajería para enseñar el enlace con título, descripción e imagen (Open Graph y Twitter Card, con `social-es.png` o `social-en.png`, de 1200 × 630), los datos estructurados (`WebApplication` en las del juego; `WebPage` o `AboutPage` en las de pantalla, con el juego del que forman parte y su ruta de migas) y, para quien no ejecuta guiones, un texto que dice qué hay en ella. Se escriben también `sitemap.xml`, con las diecisiete, y `robots.txt`.

Los nombres, los títulos y las descripciones están una sola vez, en `SCREENS` (`src/lib/seo.ts`): de ahí los toman la compilación, el título de la pestaña y el encabezado de cada sección. Una pantalla nueva con página propia es una entrada más en esa lista.

Dentro del juego las pantallas siguen yendo en el `#` de la dirección. Una página de pantalla es la puerta de entrada a una de ellas:

- `regiones.html` abre Regiones en español y `regions.html`, en inglés. Al pasar a otra pantalla la dirección queda en `es.html#/paises` (o `en.html#/…`), porque `regiones.html#/paises` nombraría dos pantallas; atrás y adelante funcionan.
- El juego habla el idioma que se haya elegido en él; si no se ha elegido ninguno, el de la página por la que se entra y, en la portada, el del navegador. Quien tiene elegido el español y abre `regions.html` ve el juego en español y la dirección pasa a `regiones.html`; al cambiar de idioma en una página de pantalla se pasa a su gemela.
- Las tarjetas de la portada y el enlace a «Acerca de» del pie apuntan a esas páginas (es lo que siguen los buscadores), pero un clic no recarga nada: se queda en el juego.
- `#/regions`, `#/countries`, `#/figures` y los demás nombres en inglés valen también como direcciones.

Todo eso lleva la dirección pública del sitio, que sale del campo `homepage` de `package.json`. Para publicar en otro lugar se cambia ahí o se da al compilar: `SITE_URL=https://ejemplo.org/juego/ npm run build`.

Dos cosas no dependen del código:

- Los buscadores solo leen el `robots.txt` de la raíz del dominio. En `usuario.github.io/regionle/` el que se genera no lo lee nadie (tampoco estorba, y vale tal cual si el juego se publica en un dominio propio). El mapa del sitio se da de alta a mano en Google Search Console o en Bing Webmaster Tools.
- Los buscadores no siguen lo que va detrás del `#`: lo que pueden indexar son esas diecisiete páginas. Progreso, Configuración, una partida y los retos y listas recibidos no tienen página propia: son de cada jugador.

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

El último paso de la compilación (`scripts/pwa/build.mjs`) escribe en la carpeta compilada un *service worker* (`sw.js`, a partir de `scripts/pwa/sw.js`) con la lista de archivos de la aplicación y un número de versión calculado a partir de su contenido. Solo se registra en el sitio compilado (no en `npm run dev`) y necesita HTTPS o `localhost`, como cualquier *service worker*. Qué guarda y cómo lo sirve:

| Qué | Cuándo se guarda | Cómo se sirve |
| --- | --- | --- |
| **La aplicación**: las tres páginas del juego, los guiones de todas las pantallas, los estilos, las tipografías y los iconos | En la primera visita, al instalarse el *service worker* | Siempre de la copia |
| **El índice de países y el mapa del mundo** (`data/index.json` y `data/world.json`), sin los que el juego no abre | También al instalarse | Como los mapas: primero la red |
| **Los mapas** de cada país y los demás archivos de `data/` | La primera vez que se usan, o todos de una vez con «Descargar todo» | Primero se piden a la red; si no responde (o tarda más de 2,5 s habiendo copia), la copia |
| **Las banderas** (`flags/`) | Igual que los mapas | De la copia si la hay: no cambian |
| `robots.txt`, `sitemap.xml` y las imágenes para redes | Nunca | De la red: no son para quien juega |
| Las catorce **páginas de pantalla** (`regiones.html`, `regions.html`…) | Nunca | Con la página de su idioma, que abre esa pantalla: solo cambia la cabecera, que quien juega no lee |

- Lo que se guarda al instalarse son unos 40 archivos, 1 MB comprimido, en una copia que se llama `regionle-shell-<versión>`. Una versión nueva se descarga entera aparte y **no sustituye a la anterior hasta que se acepta el aviso** «Hay una versión nueva»; entonces se recarga la página y se borra la copia vieja. Así no se mezclan nunca archivos de dos versiones.
- Los mapas y las banderas están en otra copia, `regionle-data`, que se conserva de una versión a otra.
- Una visita a `es.html` o a `en.html` recibe esa página; una visita a la página de una pantalla, la de su idioma (`regions.html` recibe `en.html`, y el juego abre Regiones porque lee la dirección); cualquier otra dirección del juego, `index.html`. Los archivos que no son páginas (el mapa del sitio, una imagen) se responden como lo que son.
- Una copia se busca solo por su dirección: no cuenta lo que vaya detrás de un `?` ni la cabecera `Vary` con la que algunos servidores acompañan todo lo que sirven.
- Para verlo en local: `npm run build && npm run preview`, y en las herramientas del navegador, *Application → Service workers* y *Cache storage*. `npm run e2e` comprueba que el juego abre sin conexión, en los dos idiomas, en pantallas que aún no se habían visitado y por la página de una pantalla.

### Versiones y novedades

El número de versión está en `package.json` y se ve en el pie de página y en «Acerca de». Lo que trae cada versión se escribe en `src/lib/changelog.ts`, en los dos idiomas: de ahí salen la lista de «Acerca de» y el archivo [`CHANGELOG.md`](CHANGELOG.md), que no se edita a mano. Las pruebas fallan si la primera entrada de la lista no es la versión de `package.json` o si `CHANGELOG.md` no dice lo mismo que la lista.

Para sacar una versión: `npm version minor --no-git-tag-version` (o `patch`), añadir su entrada al principio de `RELEASES`, `npm test -- -u` (reescribe `CHANGELOG.md`) y `npm run build:pages`.

### Tamaño

La portada no descarga el juego entero: cada pantalla va en un archivo aparte que se pide cuando hace falta y, si el navegador no pide ahorrar datos, por adelantado en cuanto la página está ociosa. `scripts/budget.mjs`, al final de la compilación, suma lo que pesa comprimido (gzip) lo que una primera visita tiene que descargar y **detiene la compilación** si pasa de su límite:

| | Hoy | Límite |
| --- | --- | --- |
| La página (la mayor de las diecisiete) | 2,6 kB | 5 kB |
| Guiones de la primera carga | 116 kB | 130 kB |
| Estilos | 20 kB | 26 kB |
| Tipografías pedidas con la página | 102 kB | 110 kB |
| El mayor de los guiones que se piden después | 32 kB | 60 kB |

Antes de repartirlo, el juego era un solo guion de 247 kB comprimido. Los límites dejan algo de margen sobre lo que hay; subir uno es una decisión, no un trámite: se cambia en `scripts/budget.mjs`.

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
- Un **patrón** se enseña en Configuración por lo que acepta y no por cómo se escribe (`spellingsOf`, en `src/lib/spellings.ts`): la expresión se lee signo a signo, se escriben sus variantes y cada una se comprueba contra el propio patrón antes de salir. La pantalla le pregunta además al emparejador de los juegos (`Matcher.spoken`) cuáles son en ese mapa el nombre o las siglas de otra pieza, y esas no las enseña. Las pruebas (`src/lib/spellings.test.ts`) repasan con los datos del juego que los más de 2000 patrones de fábrica se deletrean todos y que cada una de las más de 50 000 variantes que se enseñan la acepta el juego para su pieza. Un patrón escrito con signos que no se saben deletrear (`\d`, `[^A]`) se enseña como se escribió.
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
scripts/social/    Dibuja las imágenes que acompañan al enlace del juego en redes
scripts/budget.mjs Límites de tamaño de la primera carga
e2e/               Pruebas en un navegador de verdad (Playwright)
public/data/       Datos generados que usa el juego
public/icons/      Iconos de la aplicación instalada
docs/              El juego compilado que publica GitHub Pages (no se edita a mano)
src/lib/           Tipos, carga de datos, geometría, texto, abreviaturas, idiomas, estado guardado, repaso y su tabla (CSV), partidas recientes, ritmo de cada modo, atajos, sonidos, retos, listas, logros, enlaces, direcciones, metadatos de las páginas y novedades
src/components/    Mapa (d3-geo + SVG) y su teclado, selector de países, campo de respuesta, ficha de Wikipedia, voz, logros, lista de teclas y su panel, aviso de error y carga de pantallas
src/games/         Lógica y pantallas de cada modo
src/daily/         Reto del día y la imagen de su resultado
src/screens/       Inicio, preparación de la partida, partida, reto o lista recibidos (y cómo se hace cada cosa), progreso, configuración, acerca de y dirección desconocida
src/styles.css     Hoja de estilos única
CHANGELOG.md       Novedades de cada versión (se escribe a partir de src/lib/changelog.ts)
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
- La **ficha de Wikipedia** se localiza por el id de Wikidata de la pieza. Las piezas que el juego forma agrupando otras (las comunidades autónomas, las regiones de Francia o de Italia) no lo traen: para ellas se pregunta a Wikidata qué elemento tiene su código ISO 3166-2 (la propiedad P300) y, solo si la pieza no tiene código o Wikidata no lo conoce, se busca por el nombre, que es menos fiable («Canarias, España» daba con el Gobierno de Canarias antes que con las islas).
- El reto del día se calcula en el dispositivo a partir de la fecha: es el mismo para todo el mundo, pero no hay clasificación ni se comprueba en ningún servidor.
- La **imagen del resultado** se comparte como archivo donde el navegador sabe hacerlo (los móviles) y se descarga en los demás. El enlace de un reto enseña en redes la imagen general del juego, no la del resultado: para eso haría falta un servidor.
- Con el **teclado**, el cursor del mapa va de pieza en pieza por cercanía: en un mapa de miles de piezas se tarda en llegar lejos (AvPág, Inicio y Fin ayudan). Un lector de pantalla oye el lugar de la pieza en la cuenta («Pieza, 6 de 19») mientras se pregunta por ella, y su nombre solo donde no es la respuesta.
- Los **buscadores** ven la portada y una página por sección, por el reto del día y por «Acerca de», en los dos idiomas, y de cada una leen el título, la descripción y un párrafo: el contenido lo dibuja el juego al ejecutarse. Dentro del juego las pantallas siguen yendo en el `#` de la dirección, que es lo que permite que funcione en cualquier carpeta de cualquier alojamiento estático y sin conexión.

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
