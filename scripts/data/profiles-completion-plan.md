# Acabar las fichas de países y territorios: 15 tandas, mitad y mitad

Este plan **asigna trabajo editorial**, no afirma que ya estén terminadas las fichas ni modifica los datos publicados. Lo acompaña [`profiles-completion-batches.json`](profiles-completion-batches.json), lista comprobable de códigos: **248 fichas por completar, excluida Brasil; 124 para la persona usuaria y 124 para el agente; sin repeticiones**. Los países se reparten de forma equilibrada: cada mitad contiene 43 fichas con cronología ilustrada y 28 territorios/dependencias u otros casos no clasificados como Estados miembros. Igual número de fichas no garantiza idénticas horas: los casos difíciles se revisan conjuntamente.

## Qué significa «como Brasil»

**Mismo rigor y autoría, no un molde literal.** Cada ficha cerrada debe tener una presentación original bilingüe (en lugar de la entradilla copiada de Wikipedia), historia territorial cotejada, explicación fundada de la enseña que **muestra el juego**, referencias precisas, fotografías con pies y créditos y una historia de banderas que distinga tipos y fechas. Puede mantener hitos textuales si no hay dibujos históricos verificables; no se exigirán seis banderas ni ocho fotografías por sistema, ni se inventarán significados, escudos o fechas. Cuando una fuente no permite resolver un dato, se deja explícito y documentado.

Punto de partida: las 249 fichas ya tienen historia territorial; 87 conservan cronología ilustrada y 162 tienen hitos textuales; seis tienen presentación escrita para el juego y cinco explican la bandera por partes. Las 249 tienen entre tres y ocho fotografías, incluido Brasil (ocho). **No convertir una ficha en `scripts/data/profiles/<código>.json` por copiar la estructura de Brasil**: ese camino manual reemplazaría las fotos y cronologías que el generador ya preserva. Primero prepararemos una capa editorial que añada solo textos y fuentes; seguirá respetando `scripts/data/profiles-history.json`, `profiles-times.json`, las correcciones y todas las galerías actuales.

## Reparto y cadencia

- **Piloto P0 (10 fichas):** cinco tuyas y cinco mías, de lugares y situaciones distintos. Definimos plantilla, nueva capa de textos, pruebas de no regresión y revisión visual antes de escalar.
- **Rondas T1–T7:** en cada ronda tú investigas y redactas **17** fichas de tu lista y yo otras **17**; podemos trabajar en paralelo. Siete rondas × 34, más las diez del piloto = **248**. Son **15 tandas editoriales** (piloto conjunto + 14 tandas de 17), sin contar una auditoría final.
- **Entrega por tanda:** un archivo de investigación `scripts/data/profiles-research/<CÓDIGO>.md` por ficha siguiendo la [plantilla](profiles-research/TEMPLATE.md), con borradores en español e inglés, hechos comprobados, enlaces concretos, problemas y posibles imágenes. Es una aportación revisable, no se importa automáticamente al sitio.
- **Integración por el agente:** reviso tus 17 y preparo mis 17; `scripts/data/profiles-editorial.json` superpone únicamente `about`, `flag.text`/`parts` y fuentes ES/EN. El generador rechaza sobrescribir texto ya escrito, historias, datos o fotografías; para enseñas compartidas reutiliza la explicación con fuentes del país titular. AQ y la bandera de UG ya tenían texto propio: no se duplican. Corro generación, pruebas y revisión visual, y te enseño los cambios. Publicamos cada ronda **solo tras revisión y CI**, en vez de esperar a tener las 248.

## Qué haces tú, exactamente, en cada ficha de tu tanda

1. **Mira lo existente.** Abre `#/banderas/paises/<CÓDIGO>` en el sitio o `public/data/profiles/<CÓDIGO>.json`; busca el código en `scripts/data/profiles-history.json`, `profiles-times.json` si tiene cronología ilustrada y `profiles-fixes.json` si tiene correcciones. Anota qué presentación es de Wikipedia, qué ya es texto propio, cuántas fotos hay y si la bandera dibujada es ajena, local o propuesta. **No edites** `public/data/profiles/`, `docs/`, `public/photos/` ni la ficha manuscrita de Brasil.
2. **Busca y registra fuentes que realmente hayas abierto.** Para cada fecha, estatus o significado importante apunta URL HTTPS, título, apartado y afirmación que demuestra. Prioriza legislación, instituciones, archivos y fuentes especializadas. Contrasta los hechos controvertidos con otra referencia; si discrepan, deja ambas fechas y la duda. Wikipedia y el Factbook fijado ayudan, pero un archivo de dibujo o una página que no abre no justifican por sí solos una fecha de adopción.
3. **Escribe una presentación original en ES y EN**, de uno o dos párrafos paralelos: dónde está, qué es, rasgos geográficos y culturales sustentados. No repitas la sección histórica ni traduzcas literalmente un texto ajeno. Relee la historia territorial ya publicada y marca en la plantilla **conservar** o una corrección concreta con sus fuentes; no la rehagas si ya es sólida.
4. **Explica la bandera de hoy** en ambos idiomas: quién la eligió o modificó si se sabe, qué representan los elementos **según fuentes**, y qué interpretaciones no están acreditadas. Desglosa partes solo si tienen sentido. Distingue bandera nacional de pabellón civil/naval, bandera local, enseña de facto y propuesta; en territorios como SH no atribuyas al dibujo del juego una adopción insular.
5. **Revisa sus hitos/etapas uno por uno.** Escribe fecha o intervalo contrastado, clase de enseña y fuente de cada cambio. Propón imagen histórica solo con archivo exacto de Wikimedia Commons, licencia válida y otra fuente que confirme *ese* periodo y estatus; si no, conserva la cronología textual y explica el hueco. No uses automáticamente los años técnicos de `flags.json`.
6. **Revisa la galería existente.** Señala pies, identidades o créditos erróneos. Propón **cero a dos** fotos más solo si muestran algo relevante que falta y la ficha tiene espacio; facilita URL exacta de Commons, autor, licencia libre y pie ES/EN. No descargues, conviertas ni sustituyas fotografías. Ocho no es una cuota obligatoria y una bandera histórica no es una foto del país.
7. **Entrega un archivo por código** en `scripts/data/profiles-research/<CÓDIGO>.md` y avísame de los códigos al cerrar la tanda. Marca «PENDIENTE» si falta una fuente, la licencia o la traducción; no declares lista una ficha con bloqueos. No hace falta que compiles el juego para entregar notas: yo me encargo de integración, pruebas, créditos y PR de la tanda.

**Ejemplo para empezar:** copia `scripts/data/profiles-research/TEMPLATE.md` como `scripts/data/profiles-research/AD.md`, cambia `XX` por `AD`, consulta la ficha de Andorra y rellena sus ocho apartados con fuentes verificadas. Repite para CA, JP, SH y NZ. Si te resulta imposible escribir inglés fiable, completa ES y los enlaces y marca EN como pendiente; la traduzco, pero no contaremos la ficha como terminada hasta revisarla en ambos idiomas.

## Tus tandas y mis tandas: códigos exactos

El código es el identificador del fichero de datos y de la ruta de la ficha. Las listas con nombres que siguen son para trabajar; el JSON de reparto es el registro que impide omisiones o duplicados. En cada ronda, **tus códigos son los de la primera viñeta**. No hace falta esperar a que yo termine mi tanda paralela para investigar los tuyos.

### P0 · Piloto de tipos distintos (5 + 5)

- **Tú (5):** `AD` Andorra · `CA` Canadá · `JP` Japón · `SH` Santa Elena · `NZ` Nueva Zelanda
- **Yo (5):** `ES` España · `AU` Australia · `UG` Uganda · `LK` Sri Lanka · `AQ` Antártida
- **Antes de pasar a T1:** comprobaremos especialmente los textos propios, la bandera insular de SH, el cambio de estatus de AQ y que una cronología ya ilustrada no se pierda.

### T1 · Europa (17 + 17)

- **Tú (17):** `AT` Austria · `AX` Åland · `BE` Bélgica · `BG` Bulgaria · `CH` Suiza · `CY` Chipre · `FI` Finlandia · `GB` Reino Unido · `GG` Guernsey · `GR` Grecia · `HU` Hungría · `IE` Irlanda · `IT` Italia · `LT` Lituania · `LU` Luxemburgo · `LV` Letonia · `MD` Moldavia
- **Yo (17):** `AL` Albania · `BA` Bosnia y Herzegovina · `BY` Bielorrusia · `CZ` Chequia · `DE` Alemania · `DK` Dinamarca · `EE` Estonia · `FO` Islas Feroe · `FR` Francia · `GI` Gibraltar · `HR` Croacia · `IM` Isla de Man · `IS` Islandia · `JE` Jersey · `LI` Liechtenstein · `MC` Mónaco · `MT` Malta
- **Atención en esta ronda:** contrastad leyes y fechas de símbolos, y no confundáis bandera civil, estatal o regional.

### T2 · Europa y Asia (17 + 17)

- **Tú (17):** `ME` Montenegro · `MK` Macedonia del Norte · `NL` Países Bajos · `PL` Polonia · `RU` Rusia · `SI` Eslovenia · `SJ` Svalbard · `SK` Eslovaquia · `XK` Kosovo · `AE` Emiratos Árabes Unidos · `AF` Afganistán · `AZ` Azerbaiyán · `BD` Bangladés · `BH` Baréin · `CC` Islas Cocos · `CN` China · `HK` Hong Kong
- **Yo (17):** `NO` Noruega · `PT` Portugal · `RO` Rumania · `RS` Serbia · `SE` Suecia · `SM` San Marino · `UA` Ucrania · `VA` Ciudad del Vaticano · `AM` Armenia · `BN` Brunéi · `BT` Bután · `CX` Isla de Navidad · `GE` Georgia · `ID` Indonesia · `IL` Israel · `IN` India · `IQ` Irak
- **Atención en esta ronda:** revisad las transiciones políticas y los estatus discutidos sin atribuir a una bandera más de lo que documentan las fuentes.

### T3 · Asia (17 + 17)

- **Tú (17):** `IO` Territorio Británico del Océano Índico · `IR` Irán · `JO` Jordania · `KG` Kirguistán · `KR` Corea del Sur · `KW` Kuwait · `KZ` Kazajistán · `LA` Laos · `MM` Myanmar · `MV` Maldivas · `NP` Nepal · `PH` Filipinas · `SG` Singapur · `TH` Tailandia · `TJ` Tayikistán · `TR` Turquía · `VN` Vietnam
- **Yo (17):** `KH` Camboya · `KP` Corea del Norte · `LB` Líbano · `MN` Mongolia · `MO` Macao · `MY` Malasia · `OM` Omán · `PK` Pakistán · `PS` Palestina · `QA` Catar · `SA` Arabia Saudita · `SY` Siria · `TL` Timor Oriental · `TM` Turkmenistán · `TW` Taiwán · `UZ` Uzbekistán · `YE` Yemen
- **Atención en esta ronda:** comprobad por separado fechas de diseño, primer izado, adopción legal y variantes en uso.

### T4 · África (17 + 17)

- **Tú (17):** `BF` Burkina Faso · `BI` Burundi · `BJ` Benín · `CD` República Democrática del Congo · `CM` Camerún · `CV` Cabo Verde · `DJ` Yibuti · `DZ` Argelia · `EH` Sahara Occidental · `ER` Eritrea · `GA` Gabón · `GH` Ghana · `GQ` Guinea Ecuatorial · `KM` Comoras · `MA` Marruecos · `MU` Mauricio · `MZ` Mozambique
- **Yo (17):** `AO` Angola · `BW` Botsuana · `CF` República Centroafricana · `CG` República del Congo · `CI` Costa de Marfil · `EG` Egipto · `ET` Etiopía · `GM` Gambia · `GN` Guinea · `GW` Guinea-Bisáu · `KE` Kenia · `LR` Liberia · `LS` Lesoto · `LY` Libia · `MG` Madagascar · `ML` Malí · `MR` Mauritania
- **Atención en esta ronda:** distinguid dominio colonial, independencia, federaciones y cambios posteriores en el dibujo.

### T5 · África y América (17 + 17)

- **Tú (17):** `NE` Níger · `NG` Nigeria · `RE` Reunión · `RW` Ruanda · `SO` Somalia · `SZ` Esuatini · `TD` Chad · `TG` Togo · `TZ` Tanzania · `ZM` Zambia · `ZW` Zimbabue · `AG` Antigua y Barbuda · `AI` Anguila · `AR` Argentina · `AW` Aruba · `BL` San Bartolomé · `BO` Bolivia
- **Yo (17):** `MW` Malaui · `NA` Namibia · `SC` Seychelles · `SD` Sudán · `SL` Sierra Leona · `SN` Senegal · `SS` Sudán del Sur · `ST` Santo Tomé y Príncipe · `TN` Túnez · `YT` Mayotte · `ZA` Sudáfrica · `BB` Barbados · `BM` Bermudas · `CL` Chile · `CO` Colombia · `CR` Costa Rica · `CU` Cuba
- **Atención en esta ronda:** comprobad que las palabras de las historias concuerden con cada periodo y que la imagen corresponda a esa época.

### T6 · América (17 + 17)

- **Tú (17):** `BQ` Caribe Neerlandés · `BS` Bahamas · `BZ` Belice · `CW` Curazao · `DO` República Dominicana · `FK` Islas Malvinas · `GL` Groenlandia · `HN` Honduras · `HT` Haití · `JM` Jamaica · `KN` San Cristóbal y Nieves · `KY` Islas Caimán · `MX` México · `NI` Nicaragua · `PE` Perú · `PM` San Pedro y Miquelón · `SV` El Salvador
- **Yo (17):** `DM` Dominica · `EC` Ecuador · `GD` Granada · `GF` Guayana Francesa · `GP` Guadalupe · `GT` Guatemala · `GY` Guyana · `LC` Santa Lucía · `MF` San Martín (Francia) · `MQ` Martinica · `MS` Montserrat · `PA` Panamá · `PR` Puerto Rico · `PY` Paraguay · `SR` Surinam · `SX` Sint Maarten · `TC` Islas Turcas y Caicos
- **Atención en esta ronda:** auditad pabellones locales, variantes estatales y el crédito de las galerías existentes.

### T7 · América, Oceanía y territorios polares (17 + 17)

- **Tú (17):** `VC` San Vicente y las Granadinas · `VE` Venezuela · `VG` Islas Vírgenes Británicas · `CK` Islas Cook · `FM` Micronesia · `GU` Guam · `MP` Islas Marianas del Norte · `NR` Nauru · `NU` Niue · `PG` Papúa Nueva Guinea · `PN` Islas Pitcairn · `TK` Tokelau · `TV` Tuvalu · `VU` Vanuatu · `WS` Samoa · `BV` Isla Bouvet · `TF` Tierras Australes Francesas
- **Yo (17):** `TT` Trinidad y Tobago · `US` Estados Unidos · `UY` Uruguay · `VI` Islas Vírgenes de EE. UU. · `AS` Samoa Estadounidense · `FJ` Fiyi · `KI` Kiribati · `MH` Islas Marshall · `NC` Nueva Caledonia · `NF` Isla Norfolk · `PF` Polinesia Francesa · `PW` Palaos · `SB` Islas Salomón · `TO` Tonga · `WF` Wallis y Futuna · `GS` Georgias del Sur y Sandwich del Sur · `HM` Islas Heard y McDonald
- **Atención en esta ronda:** tratad banderas compartidas, propuestas y territorios sin enseña propia; justificad los huecos en vez de inventar fotos o escudos.

## Criterios de aceptación por ronda

- Están entregados los **17 archivos de tu lista y los 17 de la mía** (en P0, cinco y cinco); cada afirmación difícil tiene fuente concreta, y cada texto publicable tiene ES y EN equivalentes. Las excepciones «sin dato/imagen demostrable» están justificadas, no rellenadas.
- El agente integra sin borrar cabeceras, galerías, escudos o cronologías existentes; Brasil y las fotos de la release quedan intactos. Cualquier fotografía nueva pasa por el flujo fijado de Commons y la revisión de licencia/autor, nunca por reemplazar WebP a mano.
- `npm run data:profiles`, pruebas unitarias, comprobación de tipos, E2E de fichas, revisión visual móvil/escritorio y `npm run build:pages` pasan antes de publicar. La PR de cada ronda permite revisar las diferencias y las comprobaciones de GitHub; no se fusiona con pruebas fallidas.
- Al acabar T7, se hace una auditoría cruzada de las **249** fichas: cada una con presentación y bandera fundadas o con la razón explícita de lo no verificable. Una entrada de investigación entregada pero no integrada y revisada **no cuenta** como terminada.

Esta PR solo propone el **plan y el modelo de entrega**. No adjudica fuentes que no se hayan leído ni convierte un borrador en ficha publicada.
