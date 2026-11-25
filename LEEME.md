# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-25

Hecha con `arena/baec5cdd-regionle@63a317a`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `heads/heads.json` | Candidatas a fotografía de cabecera de las fichas de los países | Wikidata (https://www.wikidata.org) y Wikimedia Commons (https://commons.wikimedia.org) | Lo de Wikidata, CC0; cada imagen, la licencia que dice su entrada: dominio público o una licencia libre | 145 kB · 225 candidatas para 15 de 15 países: 225 imágenes traídas (5949 kB); 30 cosas buscadas en Commons por su nombre; 17 que no sirven de cabecera |
