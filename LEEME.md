# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-23

Hecha con `arena/baec5cdd-regionle@2f2162b`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `flags/candidates.json` | Todo lo que tiene bandera y es conocido, para hacer las listas | Wikidata (https://www.wikidata.org) | CC0 1.0 | 1852 kB · 13427 cosas con bandera de las que hablan 40 páginas o más; 2975 ya están en el juego |
| `flags/signals.json` | Banderas que son señales | Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 24 kB · 59 señales; 59 archivos: 59 descargados (187 kB) |
| `flags/countries.json` | Banderas anteriores de los países | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 202 kB · 345 banderas anteriores de 92 de 251 países; 337 archivos: 337 descargados (39.949 kB, con 8 imágenes) |
| `flags/capitals.json` | Banderas de las capitales de los países | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 88 kB · 168 de 243 tienen bandera; 165 archivos: 20 descargados (5630 kB, con 2 imágenes), 145 que ya estaban |
| `flags/regions.json` | Banderas de las divisiones de los mapas | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 1229 kB · 2308 de 4647 tienen bandera; 2297 archivos: 269 descargados (38.198 kB, con 11 imágenes), 2028 que ya estaban |
