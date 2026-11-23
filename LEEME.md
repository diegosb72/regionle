# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*) cuando alguien pulsa su botón; nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-23

Hecha con `main@9910d04`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `wikidata/region-population.json` | Población de las divisiones de los mapas | Wikidata (https://www.wikidata.org) | CC0 1.0 | 152 kB · 3783 de 4243 divisiones tienen cifra |

## Sitios que contestan

Una petición pequeña a cada sitio del que saldrían los puntos pendientes de la hoja de ruta:

| Sitio | Servidor | Contesta |
| --- | --- | --- |
| Wikidata, consultas | `query.wikidata.org` | sí (109 ms) |
| Wikidata, fichas | `www.wikidata.org` | sí (142 ms) |
| Wikimedia Commons, fichas de los archivos | `commons.wikimedia.org` | sí (96 ms) |
| Wikimedia Commons, archivos | `upload.wikimedia.org` | sí (33 ms) |
| geoBoundaries, fichas de los mapas | `www.geoboundaries.org` | sí (225 ms) |
| geoBoundaries, archivos | `github.com` | sí (344 ms) |
| GeoNames, descargas | `download.geonames.org` | sí (992 ms) |
