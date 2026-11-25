# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-25

Hecha con `arena/baec5cdd-regionle@4b3368f`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `arms/arms.json` | Escudo de cada país | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | Lo de Wikidata, CC0; cada imagen, la licencia que dice su entrada: dominio público o una licencia libre | 130 kB · escudo de 239 de 251 países: 242 imágenes traídas (21.626 kB); 4 elegidos a mano |
