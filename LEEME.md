# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-23

Hecha con `arena/baec5cdd-regionle@624706f`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `flags/regions.json` | Banderas de las divisiones de los mapas | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 968 kB · 2014 de 4647 tienen bandera; 2001 archivos: 849 descargados (72.600 kB), 1152 sin traer; sin mirar: 1152 de 2001 archivos (HTTP 429 Your bot is making too many requests. Please reduce your request rate or contact bot-traffic@wikimedia.org (f263c81)) |
| `flags/capitals.json` | Banderas de las capitales de los países | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | La de cada archivo, que su entrada dice: dominio público o una licencia libre | 76 kB · 144 de 243 tienen bandera; 144 archivos: 141 descargados (16.175 kB), 3 sin traer; sin mirar: 3 de 144 archivos (HTTP 429 Your bot is making too many requests. Please reduce your request rate or contact bot-traffic@wikimedia.org (f263c81)) |
