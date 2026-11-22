# Hoja de ruta de Regionle ∞

Lo que se ha pedido añadir, con la numeración de la lista que se propuso, y cómo va cada cosa.
Se hace por lotes: cada lote sale como una versión, con sus pruebas, y se apunta aquí.

- `[x]` hecho, en la versión que se indica · `[~]` hecho en parte (se dice qué falta) · `[ ]` pendiente
- Hecho no quiere decir publicado: la versión que está en la web es la que dice el pie de página del juego
- **datos**: hay que conseguir datos nuevos · **decisión**: falta que el dueño del proyecto elija algo · **decidido**: lo eligió quien hace el encargo, porque el dueño lo dejó en sus manos

Fuera del encargo, por decisión expresa: 17 (ortografía estricta), 82 (globo), 86 (capas de contexto),
89 (celebración), 91 (entrada por voz), 93 (leer cada pregunta) y 104–110 (lo que necesita un servidor o un
servicio de fuera).

## Orden

A petición del dueño del proyecto, desde la 1.18.0 se hace primero lo que menos esfuerzo lleva y se deja para
el final lo que más. La estimación es a ojo y cambia al abrir el código:

- **Corto**: nada pendiente
- **Medio**: 73
- **Largo**: 20, 44 (francés), 65, 67, 68, 83, 90
- **Depende de conseguir datos**, lleve lo que lleve: 30–32, 37–39, 41–43, 95, y lo que falta del 29 y del 35

## Modos de juego en el mapa

- [x] 1. Situar a ciegas en regiones, países y física: el mapa sin fronteras, ríos ni mares; dentro de la pieza es acierto y fuera se mide hasta su borde o su curso — **1.15.0**
- [x] 2. ¿A qué pertenece?: de cada provincia, su comunidad; de cada ciudad, su región o su país — **1.7.0**
- [x] 3. Marca el grupo: se nombra un grupo (la Unión Europea, las provincias de una comunidad, lo que limita con una pieza) y se marcan en el mapa todas sus piezas — **1.16.0**
- [x] 4. Norte–sur y este–oeste — **1.7.0**
- [x] 5. Distancias y rumbos: hacia dónde queda un sitio desde otro, entre los ocho rumbos, y a cuántos kilómetros, entre cuatro distancias; en regiones, países y ciudades — **1.15.0**
- [x] 6. Caliente y frío: seis clics para encontrar cada cosa en el mapa vacío, y cada uno dice lo cerca que ha caído — **1.15.0**
- [x] 7. ¿Quién soy?: una pieza da pistas sobre sí misma, de la más amplia a la más estrecha, hasta que se adivina; en regiones, países y ciudades — **1.16.0**
- [x] 8. Fronteras: se ilumina una frontera y se dice qué dos piezas separa, entre cuatro parejas o escribiendo los dos nombres; en regiones y países — **1.17.0**
- [x] 9. Cadena de vecinos: de una pieza a una vecina y de esa a otra, sin repetir, hasta quedarse sin salida; con récord por mapa — **1.16.0**
- [x] 10. Siluetas difíciles: giradas, sin el norte arriba, en Silueta, en Regionle y en el popurrí — **1.12.0**
- [x] 11. Banderas difíciles: en gris o desenfocadas, en Banderas, en Señalar por bandera, en las tarjetas y en el popurrí — **1.12.0**
- [x] 12. Oye y señala: el nombre lo dice la voz del dispositivo en vez de escribirse — **1.12.0**
- [x] 13. Tarjetas: se les da la vuelta y uno mismo dice si la sabía; preguntan el nombre, el lugar, la capital o la bandera — **1.12.0**
- [x] 14. Popurrí: cada pieza se pregunta de una manera, por sorteo — **1.12.0**
- [x] 15. Rellenar el mapa con cuenta atrás — **1.7.0**
- [x] 16. Modo examen: un intento por pregunta, sin pistas ni corrección hasta entregar, y nota sobre 10 — **1.8.0**
- [x] 18. Coordenadas: se marca en el mapa el punto de una latitud y una longitud, o se leen las de un punto marcado, sobre una cuadrícula de paralelos y meridianos; en regiones, países y ciudades — **1.17.0**
- [x] 19. Ruta con condiciones: antes de empezar una Ruta se elige una condición: una pieza cerrada que hay que rodear, una parada a desmano a la que hay que llegar, o solo por tierra, sin las travesías por mar — **1.28.0**
- [ ] 20. Juegos de palabras: ahorcado, sopa de letras y crucigrama

## Juegos de datos y cifras

- [x] 21. Verdadero o falso — **1.7.0** (con países; no hay frases sobre regiones ni ciudades)
- [x] 22. Los diez primeros — **1.7.0** (en Cifras, Regiones, Ciudades y Física)
- [x] 23. Alfabeto: una letra por cada inicial de los países elegidos y, de cada una, un país que hay que escribir a partir de una pista (su capital, su bandera, sus vecinos, dónde está o en qué es el primero de su letra); un intento por letra, y se puede pasar: la letra vuelve después; en Cifras, con países — **1.25.0**
- [x] 24. Parejas: cartas boca abajo, dos por país (su bandera y su nombre, o su capital y el país), de 12 a 24; solo es fallo el intento que se podía ahorrar, y se guarda la partida con menos intentos; en Cifras, con países — **1.25.0**
- [x] 25. El intruso: cuatro países, tres de ellos con algo en común (el continente, la costa, las fronteras, un vecino, el tamaño o los habitantes frente a otro), y hay que elegir el que no; en Cifras, con países — **1.24.0**
- [x] 26. Conexiones: dieciséis países que van de cuatro en cuatro por algo que no se dice (una región, el mar, un vecino, una organización, una lengua, el tamaño, la letra de la capital o algo del nombre); cada tablero tiene una sola solución, al cuarto fallo se acaba y cuatro países que comparten otra cosa no cuentan como fallo; en Cifras, con dieciséis países o más — **1.26.0**
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

- [x] 45. Retos del día por continente o por país: en la portada, diez preguntas al día, las mismas para todos, de los países de un continente (los cinco) o de las regiones de un país (los 137 con diez piezas o más); cuenta la primera vez que se termina cada día, con sus días seguidos por zona, y los países jugados en el último mes quedan a la vista — **1.30.0**
- [x] 46. Reto semanal largo: en la portada, una partida de 50 preguntas sobre países, la misma para todos de lunes a domingo, con doce temas que se turnan (banderas, capitales, siluetas, señalar, identificar y popurrí, del mundo o de un continente); cuenta la primera vez que se termina, y después se puede repetir para practicar — **1.30.0**
- [x] 47. Comparar el reto del día por enlace: el enlace del resultado lleva los puntos de las cinco pruebas y el nombre; quien lo abre juega el mismo reto y ve los resultados cara a cara, prueba a prueba, de hasta ocho personas — **1.20.0**
- [x] 48. Estadísticas del reto: bajo el resultado, retos terminados, media, mejor resultado, racha y mejor racha, reparto de los puntos en cinco tramos y media de cada prueba, con la que mejor se da y la que más cuesta — **1.20.0**
- [x] 49. Comodín de racha: cada 7 días seguidos de reto se gana un comodín, se guardan hasta 2, y el día que no se juega se gasta solo para que la racha siga — **1.20.0**
- [x] 50. Reto difícil: las mismas cinco pruebas del día con menos ayudas (silueta girada y cuatro intentos, un intento al señalar, ruta sin pistas, país sin continente y respuestas escritas), elegido antes de empezar y marcado en el resultado — **1.20.0**
- [x] 51. Retos de fechas señaladas: 32 días del año (días internacionales y fiestas de 17 países) traen un reto propio, el mismo para todos, que se abre ese día y dura una semana; cuenta la primera vez que se termina cada año, la portada lo pone el primero mientras está abierto, y un calendario deja practicar cualquiera el resto del año — **1.31.0**
- [x] 52. Enlace directo a un mapa y un modo: una dirección abre la sección con el mapa y el juego ya elegidos, y cada sección tiene un botón que la copia — **1.18.0**
- [x] 53. Imagen para compartir de cualquier partida: la pantalla de resultados guarda o comparte una imagen con el juego, el mapa, el porcentaje, los aciertos, el tiempo y el mapa pintado según cómo fue cada pieza — **1.20.0**
- [x] 54. Contra tu fantasma: de cada juego de preguntas en cada mapa se guarda la mejor partida, pregunta a pregunta, y se vuelve a jugar con ella avanzando al lado en su carril; gana quien saca más porcentaje y, con el mismo, quien tarda menos, y la que gana pasa a ser el fantasma. Va en la copia de seguridad — **1.32.0**

## Para aprender mejor

- [x] 55. Lo que confundes: las parejas que se toman una por otra, en «Progreso» y al momento, y un botón para practicarlas juntas — **1.9.0**
- [x] 56. Objetivo con fecha: un mapa o una lista para un día, con lo que toca aprender y repasar cada día y un examen de prueba — **1.9.0**
- [x] 57. Apuntes propios: una línea por pieza, que se escribe en su ficha, tras una respuesta, en una lección o en una tarjeta, y sale cuando se pregunta por ella — **1.14.0**
- [x] 58. Prueba de nivel inicial: en la primera lección de un mapa, una prueba que pregunta cada pieza una vez (dónde está y cómo se llama), con un intento y sin pistas; las lecciones se saltan lo que se acierta, y lo que no se sabe no cuenta como fallo — **1.23.0**
- [x] 59. Lecciones a tu gusto: en los ajustes de «Aprender», cuántas piezas nuevas trae cada lección (3, 5, 8 o 10) y en qué orden llegan (por zonas, por tamaño o alfabético) — **1.23.0**
- [x] 60. Repaso ajustable: en Progreso se elige el ritmo (más seguido, normal o más espaciado) y cuántas preguntas hace cada repaso (10, 20, 30 o 50) — **1.19.0**
- [x] 61. Sesión del día: sobre el repaso de hoy, la portada propone lo del día en hasta tres pasos (repasar lo que toca, lo que más fallas y una lección nueva del mapa que se estaba aprendiendo); un botón empieza por el que falte, cada partida ofrece el siguiente y lo hecho queda marcado hasta mañana — **1.24.0**
- [x] 62. Más tipos de pista: junto a la pista de cada juego, un menú «Otra pista» con lo que el juego sabe de la pieza (cuántas letras, su tamaño, dónde cae, a qué pertenece, qué tiene cerca, su capital, su bandera, quitar dos opciones, su nombre); solo lo que la pregunta ni enseña ni pide, y cada una cuenta como ayuda — **1.22.0**
- [x] 63. Las que más te cuestan: «Lo que más fallas» estaba en Progreso desde la 1.5.0; ahora la portada dice cuántas son y las practica con un clic — **1.14.0**
- [x] 64. Ficha de cada pieza con tu historial: en Explorar, cómo va cada tipo de pregunta, cuándo vuelve al repaso y con qué se confunde — **1.14.0**
- [ ] 65. Modo infantil

## Con otras personas y para clase

- [x] 66. Dos jugadores en el mismo dispositivo: un quinto formato de los nueve juegos de preguntas (**decidido**: por turnos, una pregunta para cada uno; 2 puntos a la primera y 1 con ayuda; sin ronda de fallos; no cuenta para el progreso). Marcador bajo la cabecera, el mapa pintado por quién acertó cada pieza, y al final quién gana y qué contestó cada uno — **1.33.0**
- [ ] 67. Modo clase
- [ ] 68. Varios perfiles en un navegador
- [x] 69. Mapas mudos para imprimir: el mapa numerado con sus líneas, la hoja de soluciones y recuadros para lo que queda lejos — **1.8.0**
- [x] 70. Tarea con justificante: «Poner de tarea», junto al enlace de un mapa o en una lista, da un enlace y un QR con el juego, sus reglas y un título; quien lo abre escribe su nombre, juega eso mismo y recibe un justificante (un enlace o un QR) con su nombre, el resultado, la fecha y el intento; quien puso la tarea lo abre, ve si su cifra de control cuadra y junta los de una misma tarea en una tabla que se copia a una hoja de cálculo (**decidido**: sin servidor, todo viaja en los enlaces; la cifra descubre un retoque a mano, pero no es a prueba de trampas, y el juego lo dice; cada vez que se empieza es un intento, contado por nombre; lo que se deja sin responder cuenta como fallado) — **1.34.0**
- [x] 71. Diploma: al acabar una partida con la mitad o más bien, una hoja apaisada para imprimir o guardar como PDF con el nombre (que no se guarda), el mapa, el juego, los aciertos, el tiempo, la fecha, un sello con el porcentaje y sitio para una firma — **1.21.0**
- [x] 72. Códigos QR: junto al enlace a un mapa y un juego, al de una lista, al de un reto y al del resultado del día, un código que se abre grande, se guarda como imagen o se imprime; lo calcula el propio juego, sin servicios de fuera — **1.21.0**
- [ ] 73. Bingo geográfico
- [x] 74. Incrustar un mapa o una lista en otra web: junto al enlace de un mapa y en la tarjeta de una lista, «Incrustar» da el código de un recuadro (`<iframe>`) con ese mapa, ese juego y sus opciones, sin menús; quien llega ve una tarjeta con «Empezar» y hasta entonces no se descarga ni el mapa ni el juego, no se piden fichas de Wikipedia ni se guarda copia del juego en su dispositivo, y un enlace bajo el recuadro abre el juego entero — **1.29.0**
- [x] 75. Tarjeta «mi mapa del mundo»: en Progreso, bajo el mapa de lo que se sabe, un botón guarda o comparte una imagen con el mapa que se está viendo (el mundo o las regiones de un país) pintado según lo que se sabe de cada pieza, cuántas se saben, el reparto en una barra y la leyenda — **1.27.0**

## Progreso y logros

- [x] 76. Más logros: once nuevos, y ya son 40; uno conseguido ya no se pierde — **1.13.0**
- [x] 77. Racha de estudio y calendario de actividad: días seguidos jugando, mejor racha y un cuadro por cada día del último año — **1.13.0**
- [x] 78. Gráficas de evolución: respuestas de cada semana y cómo crece lo aprendido — **1.13.0**
- [x] 79. Álbum de banderas: en Progreso, una página por continente; cada bandera entra al aprenderla y ya no sale — **1.14.0**
- [x] 80. Resumen del mes y del año: lo que suman este mes y este año, y la tabla de cada mes — **1.13.0**
- [x] 81. Meta diaria: 10, 20, 50 o 100 respuestas al día, o ninguna; se ve en Progreso y en la portada — **1.13.0**

## El mapa

- [ ] 83. Recuadros para territorios lejanos
- [x] 84. Comparador de tamaños: en Explorar, se eligen dos piezas del mapa y salen una sobre otra a la misma escala, con la superficie de cada una, una barra de escala y una frase que dice cuánto más grande es una que otra — **1.27.0**
- [x] 85. Regla para medir distancias: en Explorar, dos clics en el mapa y se ven los kilómetros que hay entre los dos puntos — **1.18.0**
- [x] 87. Pintar el mapa a mano: en Explorar, seis colores y una goma para colorear países o regiones, con una leyenda que dice qué significa cada color; se guarda como imagen y viaja en la copia de seguridad — **1.28.0**
- [x] 88. Más paletas y pantalla completa: tres paletas para el mapa (Papel, Océano y Pizarra), cada una en claro y en oscuro, y un botón de pantalla completa en cada mapa y en el pie — **1.19.0**
- [ ] 90. Mapa de todas las regiones del mundo más fluido

## Ajustes y accesibilidad

- [x] 92. Letra grande, alto contraste y tipografía para dislexia: tres ajustes al pie. La letra, normal, grande o muy grande, también en los nombres del mapa; el contraste alto, en claro y en oscuro, y solo si el dispositivo lo pide; y Lexend con más aire y sin cursivas (**decidido**: Lexend y no OpenDyslexic, que es un 60 % más ancha y no cabía en un móvil) — **1.21.0**
- [x] 94. Reglas a medida: en los nueve juegos de preguntas se eligen los intentos de cada pregunta (1, 2 o 3) y si hay pistas, lo que dura la contrarreloj (30 s, 1, 2 o 5 min) y las vidas de la supervivencia (1, 3 o 5); se quedan como se dejan, se dicen antes de empezar y viajan en el reto por enlace y en el juego incrustado (**decidido**: las de siempre son el juego como era; cada duración y cada número de vidas guarda su récord aparte; el repaso, la sesión del día y los retos con fecha van siempre con las de siempre) — **1.34.0**
- [ ] 95. Nombres en el idioma local
- [x] 96. Millas además de kilómetros: un ajuste del pie pasa a millas y millas cuadradas todo lo que el juego dice en kilómetros; las altitudes siguen en metros — **1.19.0**

## La aplicación y el sitio

- [x] 97. Contador de repasos pendientes en el icono: con el juego instalado, donde el navegador sabe poner un número en un icono — **1.18.0**
- [x] 98. Una página por país para buscadores: dos por cada país con mapa de regiones, una en cada idioma (`mapa-es-espana.html`, `map-es-spain.html`), con su título («España: provincias en el mapa»), cuántas piezas tiene en cada nivel, sus datos estructurados y su sitio en `sitemap.xml`; abren el juego en ese mapa, en su nivel más fino (**decidido**: son el juego mismo con otra cabecera, como las páginas de pantalla, y no páginas de texto aparte) — **1.33.0**
- [x] 99. Botón «Avisar de un error»: bajo cada respuesta, un enlace abre un aviso en GitHub ya rellenado con la pieza, el mapa, el juego y la versión — **1.18.0**
- [x] 100. Ayuda y tutorial de cada modo: «Cómo se juega» explica cada juego (los pasos, cómo cuenta, las ayudas y un consejo); sale solo la primera vez que se abre un juego, con el tiempo parado, y está en el botón «?» de la partida y donde se elige el juego — **1.22.0**
- [x] 101. Copia de seguridad más cómoda: al importar se ve qué trae el archivo antes de sustituir nada, la copia lleva las preferencias, se puede enviar desde el móvil y Progreso recuerda hacerla — **1.19.0**
- [x] 102. Pruebas y publicación automáticas en GitHub: en cada cambio propuesto y en cada cambio de `main`, GitHub pasa las pruebas, compila con el control de tamaño y juega en un navegador (`.github/workflows/pruebas.yml`); publica él mismo si en GitHub se elige publicar desde Actions. Lo puso el dueño el 19 de noviembre de 2026, y la primera pasada salió bien — **1.21.0**
- [x] 103. Licencia del repositorio (**decidido**: MIT): el código se puede usar, cambiar y redistribuir citando al autor; los datos de los mapas siguen las condiciones de sus fuentes — **1.15.0**

## Arreglos pendientes

- [x] 111a. Desbordes en móviles de 360 px en Progreso y en las pestañas del selector: las últimas partidas van en tres líneas y los continentes en dos — **1.18.0**
- [x] 111b. Abreviaturas por defecto para países, ciudades y capitales: una lista corta escrita a mano (EUA, RSA, BCN, ZGZ, CDMX, DF, BsAs, DC, SF, KL…) de 9 países y 52 ciudades, que vale igual cuando la ciudad se pregunta como capital — **1.22.0**
- [x] 111c. Abreviaturas cortas limitadas a su país en los mapas de varios países: al preguntar por una pieza cuenta la abreviatura de su país, y la que comparten dos países no nombra ninguna hasta que se toca la pieza — **1.19.0**
- [x] 111d. Una sola grafía en español para una ciudad y su región: 43 parejas se escriben ya igual (Rangún, Trebisonda, Almaty, Cusco), la grafía anterior se sigue aceptando y la construcción de los datos avisa si aparece otra — **1.22.0**
- [x] 111e. Capitales de región con su nombre inglés cuando el juego está en inglés: 421 capitales (The Hague, Seville, Munich); al escribir se aceptan todos los nombres — **1.22.0**
