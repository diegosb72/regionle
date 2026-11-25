# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-25

Hecha con `arena/baec5cdd-regionle@0af412c`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `heads/heads.json` | Candidatas a fotografía de cabecera de las fichas de los países | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | Lo de Wikidata, CC0; cada imagen, la licencia que dice su entrada: dominio público o una licencia libre | 206 kB · 326 candidatas para 50 de 50 países: 326 imágenes traídas (9408 kB); 293 que no sirven de cabecera |
