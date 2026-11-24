# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-24

Hecha con `arena/baec5cdd-regionle@805fd07`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `flags/listed.json` | Banderas de países que ya no existen, de organizaciones y de pueblos | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 220 kB · 290 de 290 tienen bandera; 380 archivos: 308 descargados (26.058 kB, con 14 imágenes), 72 que ya estaban |
| `flags/signals.json` | Banderas que son señales | Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 27 kB · 65 señales; 65 archivos: 6 descargados (6,9 kB), 59 que ya estaban |
| `flags/cities.json` | Banderas de las ciudades que no son capital de un país | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 745 kB · 1642 de 4295 tienen bandera; 1618 archivos: 346 descargados (68.552 kB, con 26 imágenes), 22 que ya estaban, 1250 sin traer; sin mirar: 1250 de 1618 archivos (HTTP 429 Your bot is making too many requests. Please reduce your request rate or contact bot-traffic@wikimedia.org (f263c81)) |
