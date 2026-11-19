# Hoja de ruta de Regionle ∞

Lo que se ha pedido añadir, con la numeración de la lista que se propuso, y cómo va cada cosa.
Se hace por lotes: cada lote sale como una versión, con sus pruebas, y se apunta aquí.

- `[x]` hecho, en la versión que se indica · `[~]` hecho en parte (se dice qué falta) · `[ ]` pendiente
- Hecho no quiere decir publicado: la versión que está en la web es la que dice el pie de página del juego
- **datos**: hay que conseguir datos nuevos · **decisión**: falta que el dueño del proyecto elija algo · **decidido**: lo eligió quien hace el encargo, porque el dueño lo dejó en sus manos

Fuera del encargo, por decisión expresa: 17 (ortografía estricta), 82 (globo), 86 (capas de contexto),
89 (celebración), 91 (entrada por voz), 93 (leer cada pregunta) y 104–110 (lo que necesita un servidor o un
servicio de fuera).

## Modos de juego en el mapa

- [x] 1. Situar a ciegas en regiones, países y física: el mapa sin fronteras, ríos ni mares; dentro de la pieza es acierto y fuera se mide hasta su borde o su curso — **1.15.0**
- [x] 2. ¿A qué pertenece?: de cada provincia, su comunidad; de cada ciudad, su región o su país — **1.7.0**
- [x] 3. Marca el grupo: se nombra un grupo (la Unión Europea, las provincias de una comunidad, lo que limita con una pieza) y se marcan en el mapa todas sus piezas — **1.16.0**
- [x] 4. Norte–sur y este–oeste — **1.7.0**
- [x] 5. Distancias y rumbos: hacia dónde queda un sitio desde otro, entre los ocho rumbos, y a cuántos kilómetros, entre cuatro distancias; en regiones, países y ciudades — **1.15.0**
- [x] 6. Caliente y frío: seis clics para encontrar cada cosa en el mapa vacío, y cada uno dice lo cerca que ha caído — **1.15.0**
- [x] 7. ¿Quién soy?: una pieza da pistas sobre sí misma, de la más amplia a la más estrecha, hasta que se adivina; en regiones, países y ciudades — **1.16.0**
- [ ] 8. Fronteras
- [x] 9. Cadena de vecinos: de una pieza a una vecina y de esa a otra, sin repetir, hasta quedarse sin salida; con récord por mapa — **1.16.0**
- [x] 10. Siluetas difíciles: giradas, sin el norte arriba, en Silueta, en Regionle y en el popurrí — **1.12.0**
- [x] 11. Banderas difíciles: en gris o desenfocadas, en Banderas, en Señalar por bandera, en las tarjetas y en el popurrí — **1.12.0**
- [x] 12. Oye y señala: el nombre lo dice la voz del dispositivo en vez de escribirse — **1.12.0**
- [x] 13. Tarjetas: se les da la vuelta y uno mismo dice si la sabía; preguntan el nombre, el lugar, la capital o la bandera — **1.12.0**
- [x] 14. Popurrí: cada pieza se pregunta de una manera, por sorteo — **1.12.0**
- [x] 15. Rellenar el mapa con cuenta atrás — **1.7.0**
- [x] 16. Modo examen: un intento por pregunta, sin pistas ni corrección hasta entregar, y nota sobre 10 — **1.8.0**
- [ ] 18. Coordenadas
- [ ] 19. Ruta con condiciones
- [ ] 20. Juegos de palabras: ahorcado, sopa de letras y crucigrama

## Juegos de datos y cifras

- [x] 21. Verdadero o falso — **1.7.0** (con países; no hay frases sobre regiones ni ciudades)
- [x] 22. Los diez primeros — **1.7.0** (en Cifras, Regiones, Ciudades y Física)
- [ ] 23. Alfabeto
- [ ] 24. Parejas
- [ ] 25. El intruso
- [ ] 26. Conexiones
- [x] 27. Densidad de población — **1.7.0**
- [x] 28. Cifras de ciudades, picos, lagos e islas — **1.7.0**
- [~] 29. Cifras de regiones: superficie y población (la población, **datos**) — la superficie, en **1.7.0**; falta la población, que no está en los datos
- [ ] 30. Más cifras de países (**datos**)
- [ ] 31. Datos de países: moneda, idioma, dominio, prefijo (**datos**)
- [ ] 32. Línea del tiempo (**datos**)

## Contenido nuevo

- [x] 33. Geografía física de España: ríos, cordilleras, mesetas y depresiones, cabos, islas, golfos, picos y embalses, del Atlas Nacional de España — **1.10.0**
- [x] 34. Física de cualquier país: el mapa de un país con lo que le toca de los mapas de los continentes (57 países; 63 desde la 1.11.0) — **1.10.0**
- [~] 35. Más accidentes: picos que faltan, cabos, penínsulas, cataratas, longitud de los ríos (**datos**) — los cabos y las mesetas y llanuras de España, en **1.10.0**; los cabos, las mesetas y llanuras y las penínsulas del mundo, y las cuatro cataratas que trae la fuente, en **1.11.0**; faltan los picos y las cataratas que la fuente no trae y la longitud de los ríos
- [x] 36. Continentes y océanos: los seis continentes y los cinco océanos en el mapa del mundo, con su superficie; donde no se preguntan mares, cada mar responde por su océano — **1.11.0**
- [ ] 37. Banderas de regiones (**datos**)
- [ ] 38. Mapas al día: Kenia, Ghana, Marruecos, Sudán del Sur (**datos**)
- [ ] 39. Más países a varios niveles y comarcas (**datos**)
- [x] 40. Más atajos de selección — **1.7.0** (catorce más, en «Más atajos»)
- [ ] 41. Mapas históricos (**datos** y licencia)
- [ ] 42. Mapas temáticos: husos horarios, placas tectónicas, aeropuertos y puertos (**datos**)
- [ ] 43. Lugares famosos (**datos**)
- [ ] 44. Tercer idioma (**decidido**: francés). Es el segundo idioma extranjero que más se estudia en España y es oficial en más de veinte países; y Natural Earth, de donde salen los mapas, ya trae en francés los nombres de países, regiones y ciudades (en catalán, gallego o euskera habría que buscarlos en otra fuente). Es lo más largo de la lista y va en tres partes:
  - [ ] 44a. Que el juego admita un tercer idioma: el selector de la cabecera, fechas y cifras, y unos textos que solo se descargan al elegirlo (hoy van los dos idiomas juntos en cada frase, unas 2.000)
  - [ ] 44b. Los textos del juego en francés
  - [ ] 44c. Los nombres en francés de países, regiones, ciudades y accidentes, y que se acepten al escribir (**datos**: Natural Earth y GeoNames)

## Reto del día y retos

- [ ] 45. Retos del día por continente o por país
- [ ] 46. Reto semanal largo
- [ ] 47. Comparar el reto del día por enlace
- [ ] 48. Estadísticas del reto
- [ ] 49. Comodín de racha
- [ ] 50. Reto difícil
- [ ] 51. Retos de fechas señaladas
- [ ] 52. Enlace directo a un mapa y un modo
- [ ] 53. Imagen para compartir de cualquier partida
- [ ] 54. Contra tu fantasma

## Para aprender mejor

- [x] 55. Lo que confundes: las parejas que se toman una por otra, en «Progreso» y al momento, y un botón para practicarlas juntas — **1.9.0**
- [x] 56. Objetivo con fecha: un mapa o una lista para un día, con lo que toca aprender y repasar cada día y un examen de prueba — **1.9.0**
- [x] 57. Apuntes propios: una línea por pieza, que se escribe en su ficha, tras una respuesta, en una lección o en una tarjeta, y sale cuando se pregunta por ella — **1.14.0**
- [ ] 58. Prueba de nivel inicial
- [ ] 59. Lecciones a tu gusto
- [ ] 60. Repaso ajustable
- [ ] 61. Sesión del día
- [ ] 62. Más tipos de pista
- [x] 63. Las que más te cuestan: «Lo que más fallas» estaba en Progreso desde la 1.5.0; ahora la portada dice cuántas son y las practica con un clic — **1.14.0**
- [x] 64. Ficha de cada pieza con tu historial: en Explorar, cómo va cada tipo de pregunta, cuándo vuelve al repaso y con qué se confunde — **1.14.0**
- [ ] 65. Modo infantil

## Con otras personas y para clase

- [ ] 66. Dos jugadores en el mismo dispositivo
- [ ] 67. Modo clase
- [ ] 68. Varios perfiles en un navegador
- [x] 69. Mapas mudos para imprimir: el mapa numerado con sus líneas, la hoja de soluciones y recuadros para lo que queda lejos — **1.8.0**
- [ ] 70. Tarea con justificante
- [ ] 71. Diploma
- [ ] 72. Códigos QR
- [ ] 73. Bingo geográfico
- [ ] 74. Incrustar un mapa o una lista en otra web
- [ ] 75. Tarjeta «mi mapa del mundo»

## Progreso y logros

- [x] 76. Más logros: once nuevos, y ya son 40; uno conseguido ya no se pierde — **1.13.0**
- [x] 77. Racha de estudio y calendario de actividad: días seguidos jugando, mejor racha y un cuadro por cada día del último año — **1.13.0**
- [x] 78. Gráficas de evolución: respuestas de cada semana y cómo crece lo aprendido — **1.13.0**
- [x] 79. Álbum de banderas: en Progreso, una página por continente; cada bandera entra al aprenderla y ya no sale — **1.14.0**
- [x] 80. Resumen del mes y del año: lo que suman este mes y este año, y la tabla de cada mes — **1.13.0**
- [x] 81. Meta diaria: 10, 20, 50 o 100 respuestas al día, o ninguna; se ve en Progreso y en la portada — **1.13.0**

## El mapa

- [ ] 83. Recuadros para territorios lejanos
- [ ] 84. Comparador de tamaños
- [ ] 85. Regla para medir distancias
- [ ] 87. Pintar el mapa a mano
- [ ] 88. Más paletas y pantalla completa
- [ ] 90. Mapa de todas las regiones del mundo más fluido

## Ajustes y accesibilidad

- [ ] 92. Letra grande, alto contraste y tipografía para dislexia
- [ ] 94. Reglas a medida
- [ ] 95. Nombres en el idioma local
- [ ] 96. Millas además de kilómetros

## La aplicación y el sitio

- [ ] 97. Contador de repasos pendientes en el icono
- [ ] 98. Una página por país para buscadores
- [ ] 99. Botón «Avisar de un error»
- [ ] 100. Ayuda y tutorial de cada modo
- [ ] 101. Copia de seguridad más cómoda
- [ ] 102. Pruebas y publicación automáticas en GitHub
- [x] 103. Licencia del repositorio (**decidido**: MIT): el código se puede usar, cambiar y redistribuir citando al autor; los datos de los mapas siguen las condiciones de sus fuentes — **1.15.0**

## Arreglos pendientes

- [ ] 111a. Desbordes en móviles de 360 px en Progreso y en las pestañas del selector
- [ ] 111b. Abreviaturas por defecto para países, ciudades y capitales
- [ ] 111c. Abreviaturas cortas limitadas a su país en los mapas de varios países
- [ ] 111d. Una sola grafía en español para una ciudad y su región
- [ ] 111e. Capitales de región con su nombre inglés cuando el juego está en inglés
