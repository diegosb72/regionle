# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-24

Hecha con `arena/baec5cdd-regionle@cadc219`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `flags/cities.json` | Banderas de las ciudades que no son capital de un país | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 779 kB · 1642 de 4295 tienen bandera; 1618 archivos: 404 descargados (51.298 kB, con 4 imágenes), 436 que ya estaban, 778 sin traer; sin mirar: 778 de 1618 archivos (HTTP 429 Your bot is making too many requests. Please reduce your request rate or contact bot-traffic@wikimedia.org (f263c81)) |
