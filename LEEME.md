# Datos de fuera

Esta rama no es el juego: guarda datos que el juego necesita y que no están en GitHub, npm ni PyPI.
La escribe el flujo «Traer datos» (pestaña *Actions*), cuando alguien pulsa su botón o cuando una rama del
juego cambia la lista de lo que pide (`scripts/data/pedido.txt`); nadie más escribe aquí.
Qué se trae y de dónde lo dice `scripts/data/outside.mjs`, en la rama del juego.

## Última descarga: 2026-11-24

Hecha con `arena/baec5cdd-regionle@6a65473`. Lo que no se pidió esta vez sigue en la rama `datos` como estaba.

| Archivo | Qué es | De dónde | Licencia | Resultado |
| --- | --- | --- | --- | --- |
| `countries/countries.json` | Lo que Wikidata y Wikipedia dicen de cada país y de su bandera | Wikidata (https://www.wikidata.org) y Wikipedia (https://www.wikipedia.org) | CC0 1.0 lo que dice Wikidata; CC BY-SA 4.0 las fichas de Wikipedia, cada una bajo el título de su página | 4149 kB · nombre oficial de 241 de 251 países, lema de 187, himno de 234, bandera de 243; 235 banderas con fecha; 973 fichas de Wikipedia |
