# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-23

Hecha con `main@f13f078`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `wikidata/region-population.json` | Población de las divisiones de los mapas | Wikidata (https://www.wikidata.org) | CC0 1.0 | 286 kB · 3884 de 4477 divisiones tienen cifra (3762 por su identificador, 3 por uno que cambió, 3 por la entidad que la sustituyó, 52 por su código ISO, 64 por su nombre); 1 cuya entidad dice estar en otro país; sin mirar: las entidades que no parecen su división (HTTP 502 Bad Gateway) |

## Sitios que contestan

Una petición pequeña a cada sitio del que saldrían los puntos pendientes de la hoja de ruta:

| Sitio | Servidor | Contesta |
| --- | --- | --- |
| Wikidata, consultas | `query.wikidata.org` | sí (161 ms) |
| Wikidata, fichas | `www.wikidata.org` | sí (97 ms) |
| Wikimedia Commons, fichas de los archivos | `commons.wikimedia.org` | sí (64 ms) |
| Wikimedia Commons, archivos | `upload.wikimedia.org` | sí (18 ms) |
| geoBoundaries, fichas de los mapas | `www.geoboundaries.org` | sí (218 ms) |
| geoBoundaries, archivos | `github.com` | sí (275 ms) |
| GeoNames, descargas | `download.geonames.org` | sí (861 ms) |
