# Novedades de Regionle ∞

Lo que ha traído cada versión, de la más reciente a la primera. Es la misma lista que enseña el juego en
«Acerca de»: sale de `src/lib/changelog.ts`, y este archivo se escribe a partir de ella con `npm test -- -u`.

## 1.20.0 — 19 de noviembre de 2026

- Comodín de racha: cada 7 días seguidos de reto ganas un comodín, y guardas hasta 2. Si un día no juegas, se gasta solo y la racha sigue.
- Estadísticas del reto, bajo el resultado: retos terminados, media, mejor resultado, rachas, cómo se reparten tus puntos y la media de cada prueba.
- Comparar el reto: el enlace del resultado lleva tus puntos. Quien lo abre juega el mismo reto y os veis cara a cara, prueba a prueba; caben hasta ocho.
- Reto difícil: las mismas cinco pruebas con menos ayudas. Silueta girada y cuatro intentos, un intento al señalar, ruta sin pistas y respuestas escritas.
- Imagen de cualquier partida: en los resultados, «Guardar imagen» dibuja el porcentaje, los aciertos, el tiempo y el mapa pintado según fue cada pieza.
- El reto del día carga antes: sus estilos ya no viajan con la primera página. Y la barra de hoy en la previsión de repasos deja de salir hinchada.

## 1.19.0 — 19 de noviembre de 2026

- Colores del mapa: al pie se elige entre tres paletas, «Papel» (la de siempre), «Océano» y «Pizarra», cada una con su lado claro y su lado oscuro.
- Pantalla completa: un botón más en los controles de cualquier mapa y un enlace al pie. Se amplía el juego entero, con la pregunta al lado.
- Millas: con «Distancias en millas», al pie, el juego dice las distancias en millas y las superficies en millas cuadradas. Las altitudes siguen en metros.
- Repaso ajustable: en Progreso se elige el ritmo (más seguido, normal o más espaciado) y cuántas preguntas hace cada repaso. Cambiarlo no borra nada.
- Copia de seguridad: al importar se ve qué trae el archivo junto a lo que hay, antes de sustituir nada, y la copia lleva también las preferencias.
- La copia se puede enviar a otra aplicación desde el móvil, y Progreso recuerda hacer una cuando van muchas respuestas sin ella.
- En un mapa con regiones de varios países, al preguntar por una pieza cuenta la abreviatura de su país; la que comparten dos países no nombra ninguna.

## 1.18.0 — 19 de noviembre de 2026

- Enlace directo a un mapa y un juego: en los ajustes de cada sección, «Copiar enlace a este mapa». Quien lo abre lo encuentra ya elegido, listo para empezar.
- Avisar de un error: bajo cada respuesta, un enlace abre un aviso en GitHub con la pieza, el mapa, el juego y la versión ya escritos.
- Regla para medir, en Explorar: marcas dos puntos en el mapa y ves los kilómetros que hay de uno a otro en línea recta.
- Con el juego instalado, su icono lleva el número de repasos que te esperan, donde el navegador lo permite. Se apaga al pie de la página.
- En un móvil estrecho, las últimas partidas de Progreso se leen sin desplazar de lado: cada una ocupa tres líneas en vez de una fila que no cabía.
- En el selector de países, los continentes pasan a dos líneas en el móvil: ya no hay que adivinar que América y Oceanía estaban a la derecha.

## 1.17.0 — 19 de noviembre de 2026

- Fronteras: se ilumina una frontera y dices qué dos piezas separa, entre cuatro parejas o escribiendo los dos nombres, en el orden que quieras.
- El mapa enseña enteras las dos piezas y se acerca cuando la frontera es corta. Con una lista a medida, pregunta solo las fronteras entre sus piezas.
- Coordenadas: te damos una latitud y una longitud y marcas el punto en el mapa. Cuenta lo cerca que caigas; después ves la distancia y qué había allí.
- El mapa lleva dibujados sus paralelos y meridianos, con los grados escritos en los bordes: de décimas de grado en un país pequeño a 30° en el mundo.
- O al revés: el mapa marca un punto y eliges sus coordenadas entre cuatro. Las falsas son despistes de verdad: una línea de más, el otro hemisferio.
- Si las coordenadas que eliges caen en el mapa, una cruz enseña dónde están en realidad y a cuántos kilómetros del punto.
- Los dos juegos se llevan con el teclado: las teclas 1 a 4 eligen opción y, para marcar un punto, las flechas mueven una cruz.

## 1.16.0 — 19 de noviembre de 2026

- Marca el grupo: te damos un grupo y marcas en el mapa todas sus piezas: la Unión Europea, las provincias de Andalucía, lo que limita con Francia.
- Al comprobar, el mapa pinta en verde lo acertado, en amarillo lo que faltaba y en rojo lo que sobraba. En un grupo grande, un desliz cuenta como casi.
- Cadena de vecinos: de una pieza a una vecina, y de esa a otra, sin pasar dos veces por la misma. El mapa no enseña fronteras: se dibuja con tu cadena.
- La cadena acaba cuando no queda salida, al tercer fallo o cuando te plantas. El juego te dice hasta dónde ha llegado él, y guarda tu récord de cada mapa.
- ¿Quién soy?: una pieza habla de sí misma, pista a pista: su tamaño, sus fronteras, un vecino, su bandera o su silueta. Adivínala con las menos que puedas.
- Un nombre equivocado trae la pista siguiente. La primera pista vale seis puntos y cada una de más, uno menos.
- Al marcar piezas en un mapa, la que acabas de tocar ya se ve marcada sin apartar el ratón.
- La partida carga más deprisa: los juegos nuevos se descargan solo cuando los juegas.

## 1.15.0 — 18 de noviembre de 2026

- Situar a ciegas, también en regiones, países y geografía física: el mapa no enseña fronteras, ríos ni mares, y haces clic donde crees que está cada cosa.
- Dentro de la pieza es acierto; fuera, se mide hasta su borde o hasta el curso del río. Con lo muy pequeño basta con quedarse cerca.
- Un mar cuenta con los mares que forman parte de él: el Mediterráneo también se acierta en el mar Balear, y se te dice que esa parte tiene nombre propio.
- Caliente y frío: seis clics para encontrar cada cosa en el mapa vacío. Cada uno dice si te quemas o te hielas, y si te acercas o te alejas.
- Distancias y rumbos: sin mirar el mapa, ¿hacia dónde queda un sitio desde otro y a cuántos kilómetros? Al responder, el mapa enseña los dos y su línea.
- En los rumbos eliges entre los ocho puntos de la brújula; el de al lado cuenta como acierto con ayuda cuando el sitio cae hacia él.
- Los tres juegos se llevan con el teclado: una cruz que mueven las flechas para marcar un punto, y el teclado numérico para los rumbos.
- El código del juego tiene ya licencia: MIT. Los datos de los mapas siguen las condiciones de sus fuentes.

## 1.14.0 — 18 de noviembre de 2026

- Apuntes propios: escribe en cada pieza un truco para acordarte. Se escribe en su ficha de Explorar, tras una respuesta, en una lección o en una tarjeta.
- Tu apunte sale cuando respondes sobre esa pieza, en el reverso de su tarjeta y en su lección, y ahí mismo se cambia. Solo lo ves tú.
- Los apuntes van en la copia de seguridad y siguen ahí si borras el progreso. En la lista de Explorar, una marca dice qué piezas tienen uno.
- Tu historial de cada pieza: su ficha de Explorar dice cómo te va en el mapa, con su nombre, su capital y su bandera, y cuándo vuelve al repaso.
- La ficha dice también con qué otras piezas la confundes, y cuántas veces.
- Álbum de banderas: en Progreso, una página por continente con un hueco para la bandera de cada país. Se llena cuando la aprendes y ya no se vacía.
- Desde cada página del álbum se juega con las banderas que le faltan, de veinte en veinte.
- Lo que más fallas, también en la portada: bajo el repaso de hoy, cuántas respuestas se te resisten y un botón para practicarlas.

## 1.13.0 — 18 de noviembre de 2026

- Calendario de actividad: en Progreso, un cuadro por cada día del último año, más oscuro cuanto más respondiste. Al pasar por un día dice lo que hiciste.
- Días seguidos: cuántos días llevas jugando sin faltar y cuál fue tu mejor racha. Un día que solo ha empezado no la rompe.
- Meta diaria: elige cuántas respuestas quieres dar al día: 10, 20, 50, 100 o ninguna. La portada y Progreso dicen cuánto llevas hoy.
- Gráficas: las respuestas de cada semana del último medio año, con las que fueron a la primera, y cómo crece lo que tienes aprendido.
- Mes a mes: lo que suman este mes y este año, y una tabla con cada mes: días de juego, partidas, respuestas, aciertos a la primera y tiempo.
- Once logros nuevos, y ya son 40: todas las capitales, todas las banderas, continentes y océanos, cinco mil respuestas, una semana y un mes sin faltar.
- Y también: diez metas diarias cumplidas, un 10 en un examen, cien tarjetas, y un popurrí y un «Oye y señala» sin un fallo.
- Un logro conseguido ya no se pierde: antes podía apagarse al borrar una lista o al fallar algo que ya sabías.
- Quien ya jugaba empieza con el calendario de sus últimas partidas y de sus retos diarios. La copia de seguridad guarda también el calendario.
- La portada pesa menos: lo que es de los logros y de Progreso se descarga cuando hace falta.

## 1.12.0 — 18 de noviembre de 2026

- Tarjetas: una por pieza, para estudiar sin escribir ni señalar. Le das la vuelta y dices tú si la sabías; lo que no sabías vuelve al final.
- Las tarjetas preguntan lo que elijas: cómo se llama, dónde está, su capital o de qué país es una bandera. Lo que dices cuenta para el repaso.
- Popurrí: cada pieza se pregunta de una manera, por sorteo: señalarla, identificarla, colocarla, su silueta, su capital o su bandera.
- Oye y señala: el nombre no se escribe, lo dice la voz de tu dispositivo. Se puede oír otra vez, y verlo escrito cuenta como ayuda.
- Siluetas giradas: un ajuste de Silueta, Regionle y el popurrí que las enseña sin el norte arriba.
- Banderas difíciles: en gris, para reconocerlas por el dibujo, o desenfocadas, para reconocerlas por los colores.
- El popurrí y «Oye y señala» se juegan también contrarreloj, en supervivencia y como examen. El popurrí se envía como reto, con las mismas preguntas.
- Un reto recibido dice si viene con siluetas giradas o con banderas difíciles: se juega como lo jugó quien lo envía.

## 1.11.0 — 18 de noviembre de 2026

- Continentes y océanos: el mapa del mundo con los seis continentes, cada uno de un color, y los cinco océanos. Se juega a todo, y a las cifras con su superficie.
- En ese mapa cada mar responde por su océano: el Mediterráneo y el Caribe son Atlántico, y el mar Arábigo, Índico.
- Penínsulas: treinta, de la Ibérica a Kamchatka, y en el mapa de cada país, las suyas.
- Mesetas, llanuras y cabos de todo el mundo, no solo de España: la Gran Llanura Europea, el Tíbet y la Pampa; Buena Esperanza, Hornos y el cabo Norte.
- Cataratas: Niágara, Salto Ángel, Iguazú y Victoria.
- Lo que se pregunta está siempre en pantalla: el Ártico no se veía en el mapa de Europa ni el mar de Bering en el de Asia. Ahora el mapa llega hasta ellos.
- Cuando una pieza es mayor que el mapa (el Atlántico en el de Europa), su nombre y su número se escriben en la parte que se ve.
- Senegal, Nicaragua, Siria, Tailandia, Uzbekistán y Serbia ya tienen mapa físico propio: son 63 países.

## 1.10.0 — 18 de noviembre de 2026

- Geografía física de España, como en un atlas escolar: 81 ríos, las cordilleras, las mesetas y depresiones, cabos, islas, golfos, picos y embalses.
- La física de un país: en Geografía física se elige también un país, y el mapa se centra en él con sus ríos, sus cordilleras y sus mares.
- Dos clases nuevas de pieza: cabos, y mesetas y llanuras. De momento, las de España.
- El mapa mudo de la física de España se imprime con las Canarias en su recuadro.
- El estrecho de Gibraltar, Bab el-Mandeb, el canal de Yucatán y el mar del Scotia eran una mota en el mapa: ahora tienen su contorno y se pueden señalar.
- Los Pirineos, la Cordillera Cantábrica y Sierra Morena siguen el relieve, y el Tajo, el Ebro, el Duero, el Guadiana, el Guadalquivir y el Miño ganan detalle.

## 1.9.0 — 18 de noviembre de 2026

- Lo que confundes: si respondes otra pieza del mapa, el juego apunta la pareja; «Progreso» las enseña, las más confundidas primero, y deja practicarlas juntas.
- A la segunda vez que tomas una pieza por otra, el juego lo dice en el momento.
- Objetivo con fecha: «Poner fecha» hace del mapa elegido, o de una lista, un objetivo para un día; la portada dice cada día cuánto toca aprender y repasar.
- Cada objetivo tiene su examen de prueba con todas las piezas, y su fecha se puede mover.

## 1.8.0 — 18 de noviembre de 2026

- Modo examen en Señalar, Identificar, Silueta, Puzle, Capitales, Banderas y ¿A qué pertenece?: un intento por pregunta, sin pistas ni corrección hasta entregar.
- Al entregar el examen, la nota sobre 10 y la corrección, con lo que respondiste en cada fallo; se guarda la mejor nota de cada mapa.
- Mapa mudo para imprimir en Regiones, Países, Ciudades y Geografía física: el mapa numerado, una línea para cada nombre y, si quieres, la hoja de soluciones.
- En la hoja, lo que queda lejos va en un recuadro (Canarias, Alaska y Hawái, Azores y Madeira) y el papel se tumba cuando el mapa lo pide.
- La hoja se saca también de una lista a medida, con el título que le pongas, o sin números, para escribir o colorear encima.
- El interruptor «Mapa mudo» de Ruta se llama ahora «Mapa sin fronteras».

## 1.7.0 — 18 de noviembre de 2026

- Verdadero o falso: frases sobre los países que elijas (fronteras, capitales, tamaños, vecinos, continentes), con el porqué de cada una.
- Los diez primeros: escribe de memoria los primeros de un mapa por su cifra; cada acierto ocupa su puesto y al quinto fallo se acaba.
- ¿A qué pertenece?: de cada provincia, su comunidad; de cada ciudad, su país o su región.
- Norte–sur: cinco lugares del mapa que se ordenan de norte a sur o de oeste a este.
- Los juegos de cifras ya no son solo de países: población de las ciudades, superficie de regiones, lagos, islas y mares y altitud de los picos.
- Densidad de población, junto a la población y la superficie de los países.
- Rellenar el mapa con cuenta atrás: 2, 5, 10 o 15 minutos.
- «Más atajos» en la selección de países: OTAN, Schengen, eurozona, BRICS, Liga Árabe, antigua URSS, microestados, sin salida al mar y otros seis.
- Los modos de cada sección van agrupados en el menú: para estudiar, en el mapa, por la forma, vecinos y posición, datos y cifras.

## 1.6.0 — 18 de noviembre de 2026

- Cada sección, el reto del día y «Acerca de» tienen página propia en cada idioma, con su título y su descripción para buscadores y enlaces.
- El altavoz de un nombre es un interruptor: se ve y se anuncia mientras suena, y al pulsarlo otra vez se calla.
- La portada cuenta los retos entre dos y las listas a medida, y cada cosa tiene una página que explica cómo se hace.
- La ficha de Wikipedia de las comunidades y regiones agrupadas se busca por su código ISO, para que salga la del territorio y no la de su gobierno.
- «Saltar al contenido» lleva al contenido en lugar de a «Esa dirección no existe».

## 1.5.0 — 17 de noviembre de 2026

- Los mapas se juegan también con el teclado: las flechas recorren las piezas, Intro elige y +, − y 0 mueven el zoom.
- La portada descarga menos de la mitad de código que antes: cada pantalla se pide cuando hace falta.
- El enlace del juego se comparte con título, descripción e imagen, y hay una página para cada idioma.
- Imagen para compartir el resultado del reto del día.
- La portada recuerda los últimos mapas jugados y las selecciones guardadas, para seguir con un clic.
- En Progreso, lo que más fallas, mapa por mapa, con una partida para practicarlo; y el repaso se descarga en CSV.
- Los menús dicen cuánto dura la partida elegida y qué porcentaje aciertas a la primera en ese modo.
- Atajos de teclado en cualquier pantalla (1 a 5, R, P y T) y «?» para verlos todos.
- Sonidos y vibración al responder, si se activan en el pie de página.
- Página «Acerca de» con las novedades, las licencias y qué se guarda y dónde.
- Bienvenida para quien entra por primera vez.
- Si una pantalla falla, lo dice y deja seguir; una dirección que no existe lo dice en lugar de enseñar la portada.
- Configuración enseña las variantes que acepta cada patrón en lugar del patrón.

## 1.4.0 — 17 de noviembre de 2026

- Abreviaturas y variantes de las regiones según la lista de type-ins de un quiz de JetPunk.
- Nombres repasados: cambian 276 piezas de 87 países, 59 ciudades y 33 capitales.

## 1.3.0 — 17 de noviembre de 2026

- Un nombre de varias palabras se puede escribir por sus iniciales.
- Pantalla de Configuración: qué vale al escribir cada nombre, pieza por pieza.

## 1.2.0 — 16 de noviembre de 2026

- Aprender por lecciones, Regionle sin límite y Situar a ciegas.
- Contrarreloj y supervivencia, listas a medida que se comparten con un enlace, logros y niveles.
- La respuesta se escribe; ni el mapa ni las opciones la delatan.
- Botón para oír los nombres y colores para daltónicos.

## 1.1.0 — 16 de noviembre de 2026

- Reto del día, repaso espaciado y retos por enlace.
- Ciudades y geografía física; Puzle, Vecinos y las capitales de las regiones.
- En español y en inglés; se instala y funciona sin conexión.

## 1.0.0 — 16 de noviembre de 2026

- Primera versión: regiones y países de todo el mundo, capitales, banderas y cifras, sin límite de partidas.
