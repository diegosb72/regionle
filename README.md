# Regionle ∞

Juego web de geografía para aprender las regiones, provincias y estados de los países del mundo, además de sus capitales, banderas, ciudades, ríos, mares, montañas y cifras. Está inspirado en [regionle.xyz](https://regionle.xyz) y le añade **partidas sin límite**, **filtros** para elegir qué estudiar, un **repaso espaciado** que recuerda lo que toca volver a ver y **enlaces para aprender** en cada respuesta.

**Jugar: <https://diegosb72.github.io/regionle/>**

Todo funciona en el navegador: no hay servidor, registro ni anuncios, y el progreso se guarda en `localStorage`. Está en **español e inglés**, se puede **instalar** como aplicación y funciona **sin conexión**.

## Qué incluye

| Sección | Modos |
| --- | --- |
| **Regiones** (divisiones internas de uno o varios países en un mismo mapa) | Explorar · Señalar · Identificar · Nombrarlas todas · Silueta · Puzle · Vecinos · Capitales · Ruta |
| **Países** | Los nueve anteriores, más Banderas |
| **Ciudades** (las más pobladas, las capitales de país o las capitales de región) | Explorar · Situar · Identificar · Nombrarlas todas |
| **Geografía física** (ríos, lagos, mares y océanos, cordilleras, desiertos e islas, del mundo o de un continente) | Explorar · Señalar · Identificar · Nombrarlos todos |
| **Cifras** (población o superficie) | Mayor o menor · Ordena cinco · Cifra exacta · ¿Qué país? |

- **251 países y territorios** y unas **4500 divisiones** de primer nivel. España, Francia, Italia, el Reino Unido y algunos países más se pueden jugar a dos o tres niveles (comunidades o provincias, regiones o departamentos…). Hay además **4560 ciudades** de 227 países, **492 accidentes geográficos** y las capitales de las regiones de 122 países.
- **Reto del día**: cada día un país y cinco pruebas cortas, las mismas para todo el mundo (adivinar una región por su silueta, señalar cinco, una ruta entre dos países, un país por su población y cinco preguntas de banderas y capitales). Hasta 100 puntos, racha, calendario con los días anteriores y resultado para compartir.
- **Sin límite**: todo lo demás se puede repetir, barajar y jugar en modo sin fin, en el que lo fallado vuelve a salir hasta que se acierta. El modo Ruta conserva su «ruta del día» y, después, todas las rutas que se quieran.
- **Repaso espaciado**: cada respuesta vuelve cuando está a punto de olvidarse (al día siguiente, a los 3 días, a los 7, 16, 35 y 75); un fallo la trae de vuelta el mismo día. La portada propone el repaso de hoy, agrupado por mapas.
- **Filtros**: por continente y subregión, tipo de territorio, litoral, población, superficie y número de divisiones; atajos (Mundo, Unión Europea, hispanohablantes, G20…) y selecciones guardadas.
- **Para estudiar**: cada respuesta enlaza con Wikipedia, OpenStreetMap y vídeos; al fallar se muestra un resumen de Wikipedia con su foto (se puede desactivar); el modo Explorar muestra la ficha y los vecinos de cada pieza, y al terminar se puede repasar solo lo fallado.
- **Retos por enlace**: al acabar una partida se puede enviar un enlace con las mismas preguntas en el mismo orden y el resultado que hay que superar. No hace falta servidor: todo viaja en el propio enlace.
- **Progreso**: mapa de lo que se sabe (aprendido, aprendiendo, toca repasar), previsión de repasos de la semana, aciertos por habilidad, últimas partidas y mejores marcas, con exportación e importación en un archivo.
- **Sin conexión**: la aplicación se guarda en el navegador la primera vez que se abre y los mapas, según se van usando; el botón «Descargar todo» del pie de página baja de una vez todos los mapas y banderas (unos 3 MB comprimidos). Cuando hay una versión nueva, se avisa y no cambia nada hasta que se acepta.
- Español e inglés (se elige en la cabecera; por defecto, el idioma del navegador), tema claro y oscuro, uso con teclado y diseño adaptado al móvil.

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
```

- `data:fetch` descarga archivos de GitHub fijados por *commit* y verificados por su SHA. Usa la API si hay un token (`GH_TOKEN`, `GITHUB_TOKEN` o la CLI `gh`) y, si no, `raw.githubusercontent.com`.
- `data:build` puede usar hasta unos 3 GB de memoria. Une las divisiones de Natural Earth en una topología por país, las simplifica, calcula vecinos por tierra y travesías cortas por mar (hasta 40 km), y escribe:
  - `index.json`: países con nombre, capital, población, superficie, vecinos y niveles disponibles;
  - `world.json`: el mapa del mundo por países;
  - `r/<ISO>.json`: las divisiones de cada país (TopoJSON).
- `data:physical` necesita que `data:build` se haya ejecutado antes (sitúa cada ciudad en su región) y escribe:
  - `physical.json`: 177 ríos, 113 mares y océanos, 76 lagos, 64 cordilleras, 43 islas y 19 desiertos, con nombre en español e inglés y una marca para los más conocidos, que son los que se juegan por defecto;
  - `cities.json`: las 60 ciudades más pobladas de cada país y todas las capitales;
  - `capitals.json`: la capital de cada región, en los países y niveles en los que la fuente la señala para al menos el 70 % de las regiones (las de España y Francia están escritas a mano).
- Las decisiones editoriales (nombres en español, agrupaciones, niveles, correcciones de la fuente) están en `scripts/data/config.mjs` y, para la geografía física, en `scripts/data/physical-config.mjs`.

### Criterios

- Las fronteras siguen el criterio de Naciones Unidas y no suponen ninguna toma de postura: Crimea figura en Ucrania, el Sáhara Occidental aparece completo y los Altos del Golán en Siria.
- Los territorios de ultramar con código ISO propio (Guayana Francesa, Reunión, Svalbard…) son piezas aparte de su metrópoli y están ocultos por defecto tras el filtro «Territorios dependientes».
- Los nombres están en español cuando la fuente ofrece uno fiable; en caso contrario se usa el nombre local o el inglés. Al escribir se aceptan también los nombres alternativos y se ignoran tildes y mayúsculas.

## Estructura

```
scripts/data/      Descarga y construcción de los datos
scripts/pwa/       Service worker y paso final de la compilación
public/data/       Datos generados que usa el juego
public/icons/      Iconos de la aplicación instalada
docs/              El juego compilado que publica GitHub Pages (no se edita a mano)
src/lib/           Tipos, carga de datos, geometría, texto, idiomas, estado guardado, repaso, retos, enlaces
src/components/    Mapa (d3-geo + SVG), selector de países, campo de respuesta, ficha de Wikipedia
src/games/         Lógica y pantallas de cada modo
src/daily/         Reto del día
src/screens/       Inicio, preparación de la partida, partida, reto recibido y progreso
src/styles.css     Hoja de estilos única
```

Hecho con React 19, TypeScript, Vite, d3-geo, TopoJSON y Zustand. Los textos de la interfaz están junto al código que los muestra, en los dos idiomas (`L('español', 'English')` en `src/lib/i18n.ts`).

## Limitaciones conocidas

- El mapa de **todas las regiones del mundo a la vez** (más de 3000 piezas) funciona, pero es pesado: tarda unos segundos en cargar y el zoom va menos fluido en equipos modestos.
- El progreso vive solo en el navegador en el que se juega; para llevarlo a otro hay que exportarlo e importarlo desde «Progreso».
- Los nombres en español de algunas divisiones, ciudades y accidentes geográficos poco conocidos proceden directamente de la fuente y pueden contener erratas.
- La población de las ciudades es la de su **área urbana** según Natural Earth, no la del municipio, y la lista de ciudades de cada país es la de esa fuente: puede faltar alguna ciudad grande y sobrar alguna pequeña.
- Las **capitales de región** no están disponibles en todos los países ni en todos los niveles (por ejemplo, faltan en los departamentos de Francia, las provincias de Italia o los estados de Estados Unidos).
- La ficha de Wikipedia y los enlaces externos necesitan conexión; sin ella, simplemente no aparecen.
- El reto del día se calcula en el dispositivo a partir de la fecha: es el mismo para todo el mundo, pero no hay clasificación ni se comprueba en ningún servidor.

## Fuentes y licencias

- **Mapas, ciudades y geografía física**: [Natural Earth](https://www.naturalearthdata.com/) 1:10m y 1:50m, dominio público.
- **Población**: Banco Mundial (indicador `SP.POP.TOTL`, dato de 2025 para la mayoría de los países), a través de [datasets/population](https://github.com/datasets/population), ODC-PDDL.
- **Capitales, superficies y otros datos de países**: [GeoNames](https://www.geonames.org/), CC BY 4.0.
- **Banderas**: [flag-icons](https://github.com/lipis/flag-icons), MIT.
- **Resúmenes y fotos de la ficha**: [Wikipedia](https://www.wikipedia.org/) y [Wikidata](https://www.wikidata.org/), consultadas desde el navegador de quien juega; los textos son CC BY-SA 4.0 y cada ficha enlaza con su artículo.
- **Tipografías**: Fraunces y DM Sans, SIL Open Font License 1.1, empaquetadas por [Fontsource](https://fontsource.org/).
- **Iconos**: [Lucide](https://lucide.dev/), ISC.

La idea original es de [regionle.xyz](https://regionle.xyz); este proyecto no usa su código ni sus datos.
