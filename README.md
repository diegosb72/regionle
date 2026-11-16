# Regionle ∞

Juego web de geografía para aprender las regiones, provincias y estados de los países del mundo, además de sus capitales, banderas y cifras. Está inspirado en [regionle.xyz](https://regionle.xyz) y le añade tres cosas: **partidas sin límite**, **filtros** para elegir qué estudiar y **enlaces para aprender** en cada respuesta.

Todo funciona en el navegador: no hay servidor, registro ni anuncios, y el progreso se guarda en `localStorage`.

## Qué incluye

| Sección | Modos |
| --- | --- |
| **Regiones** (divisiones internas de uno o varios países en un mismo mapa) | Explorar · Señalar · Identificar · Nombrarlas todas · Silueta · Ruta |
| **Países** | Los seis anteriores, más Capitales y Banderas |
| **Cifras** (población o superficie) | Mayor o menor · Ordena cinco · Cifra exacta · ¿Qué país? |

- **251 países y territorios** y unas **4500 divisiones** de primer nivel. España, Francia, Italia, el Reino Unido y algunos países más se pueden jugar a dos o tres niveles (comunidades o provincias, regiones o departamentos…).
- **Sin límite**: se puede repetir, barajar y jugar en modo sin fin, en el que lo fallado vuelve a salir hasta que se acierta. Hay además una «ruta del día», igual para todo el mundo, y después todas las rutas que se quieran.
- **Filtros**: por continente y subregión, tipo de territorio, litoral, población, superficie y número de divisiones; atajos (Mundo, Unión Europea, hispanohablantes, G20…) y selecciones guardadas.
- **Para estudiar**: cada respuesta enlaza con Wikipedia, OpenStreetMap y vídeos; el modo Explorar muestra la ficha y los vecinos de cada pieza, y al terminar se puede repasar solo lo fallado.
- **Progreso**: aciertos por pieza, piezas aprendidas, últimas partidas y mejores marcas, con exportación e importación en un archivo.
- Tema claro y oscuro, uso con teclado y diseño adaptado al móvil.

## Puesta en marcha

Hace falta Node.js 20.19 o posterior (22.12 o posterior en la rama 22; se ha desarrollado con Node 22).

```bash
npm install
npm run dev        # http://localhost:5173
```

| Orden | Para qué |
| --- | --- |
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Comprueba los tipos y genera `dist/` |
| `npm run preview` | Sirve `dist/` en el puerto 4173 |
| `npm test` | Pruebas (Vitest), incluidas las comprobaciones de los datos generados |
| `npm run typecheck` | Solo la comprobación de tipos |

### Publicación

`npm run build` deja en `dist/` un sitio estático de unos 11 MB (la aplicación, los mapas y las banderas). Las rutas van en el `#` de la dirección y los recursos se piden con rutas relativas, así que sirve tal cual en cualquier alojamiento estático y en cualquier subcarpeta (GitHub Pages, Netlify, un directorio de un servidor propio…).

## Datos

Los mapas ya generados están en `public/data/` y se versionan, de modo que no hace falta reconstruirlos para ejecutar o publicar el juego. Para rehacerlos:

```bash
npm run data:fetch   # descarga las fuentes a .cache/src (no se versiona)
npm run data:build   # genera public/data y el informe .cache/report.txt
```

- `data:fetch` descarga archivos de GitHub fijados por *commit* y verificados por su SHA. Usa la API si hay un token (`GH_TOKEN`, `GITHUB_TOKEN` o la CLI `gh`) y, si no, `raw.githubusercontent.com`.
- `data:build` puede usar hasta unos 3 GB de memoria. Une las divisiones de Natural Earth en una topología por país, las simplifica, calcula vecinos por tierra y travesías cortas por mar (hasta 40 km), y escribe:
  - `index.json`: países con nombre, capital, población, superficie, vecinos y niveles disponibles;
  - `world.json`: el mapa del mundo por países;
  - `r/<ISO>.json`: las divisiones de cada país (TopoJSON).
- Las decisiones editoriales (nombres en español, agrupaciones, niveles, correcciones de la fuente) están en `scripts/data/config.mjs`.

### Criterios

- Las fronteras siguen el criterio de Naciones Unidas y no suponen ninguna toma de postura: Crimea figura en Ucrania, el Sáhara Occidental aparece completo y los Altos del Golán en Siria.
- Los territorios de ultramar con código ISO propio (Guayana Francesa, Reunión, Svalbard…) son piezas aparte de su metrópoli y están ocultos por defecto tras el filtro «Territorios dependientes».
- Los nombres están en español cuando la fuente ofrece uno fiable; en caso contrario se usa el nombre local o el inglés. Al escribir se aceptan también los nombres alternativos y se ignoran tildes y mayúsculas.

## Estructura

```
scripts/data/      Descarga y construcción de los datos
public/data/       Datos generados que usa el juego
src/lib/           Tipos, carga de datos, geometría, texto, estado guardado, enlaces
src/components/    Mapa (d3-geo + SVG), selector de países, campo de respuesta
src/games/         Lógica y pantallas de cada modo
src/screens/       Inicio, preparación de la partida, partida y progreso
src/styles.css     Hoja de estilos única
```

Hecho con React 19, TypeScript, Vite, d3-geo, TopoJSON y Zustand.

## Limitaciones conocidas

- El mapa de **todas las regiones del mundo a la vez** (más de 3000 piezas) funciona, pero es pesado: tarda unos segundos en cargar y el zoom va menos fluido en equipos modestos.
- El progreso vive solo en el navegador en el que se juega; para llevarlo a otro hay que exportarlo e importarlo desde «Progreso».
- Los nombres en español de algunas divisiones poco conocidas proceden directamente de la fuente y pueden contener erratas.

## Fuentes y licencias

- **Mapas**: [Natural Earth](https://www.naturalearthdata.com/) 1:10m, dominio público.
- **Población**: Banco Mundial (indicador `SP.POP.TOTL`, dato de 2025 para la mayoría de los países), a través de [datasets/population](https://github.com/datasets/population), ODC-PDDL.
- **Capitales, superficies y otros datos de países**: [GeoNames](https://www.geonames.org/), CC BY 4.0.
- **Banderas**: [flag-icons](https://github.com/lipis/flag-icons), MIT.
- **Tipografías**: Fraunces y DM Sans, SIL Open Font License 1.1, empaquetadas por [Fontsource](https://fontsource.org/).
- **Iconos**: [Lucide](https://lucide.dev/), ISC.

La idea original es de [regionle.xyz](https://regionle.xyz); este proyecto no usa su código ni sus datos.
