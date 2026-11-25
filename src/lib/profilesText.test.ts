/**
 * How the opening of a page of Wikipedia is made short enough for a sheet (scripts/data/profiles-text.mjs):
 * whole sentences, as they are written, without the marks that plain text leaves behind and without the
 * brackets that only say how a name is written or said in another language.
 */
import { describe, expect, it } from 'vitest';
// @ts-expect-error a script of the build, written without types
import { leadOf as leadOfSaid, paragraphsOf as paragraphsOfSaid, sentencesOf as sentencesOfSaid, spaced as spacedSaid } from '../../scripts/data/profiles-text.mjs';

type Lang = 'es' | 'en';
const leadOf = leadOfSaid as (text: unknown, opts: { lang: Lang; max: number; most?: number; keep?: number }) => string[] | null;
const sentencesOf = sentencesOfSaid as (paragraph: string, lang: Lang) => string[];
const paragraphsOf = paragraphsOfSaid as (text: string) => string[];
const spaced = spacedSaid as (text: string) => string;

/** The whole of a short text, as it would be shown. */
const whole = (text: string, lang: Lang = 'es'): string => (leadOf(text, { lang, max: 2000 }) ?? ['—']).join(' ¶ ');

describe('the sentences of a paragraph', () => {
  it('end at a full stop that another sentence follows, and at nothing else', () => {
    expect(sentencesOf('Es un país. Su capital es Roma. Tiene 20 regiones.', 'es')).toEqual(['Es un país.', 'Su capital es Roma.', 'Tiene 20 regiones.']);
    expect(sentencesOf('Mide 6.8 km2 en total. ¿Y qué más? ¡Nada! Fin.', 'es')).toEqual(['Mide 6.8 km2 en total.', '¿Y qué más?', '¡Nada!', 'Fin.']);
    // What goes on in small letters has not ended.
    expect(sentencesOf('Limita con el mar. al sur hay montañas.', 'es')).toEqual(['Limita con el mar. al sur hay montañas.']);
    expect(sentencesOf('Una sola, sin punto', 'es')).toEqual(['Una sola, sin punto']);
  });

  it('do not end at a short form or at an initial', () => {
    expect(sentencesOf('Fue fundada en el 753 a. C. por Rómulo. Hoy es la capital.', 'es')).toEqual(['Fue fundada en el 753 a. C. por Rómulo.', 'Hoy es la capital.']);
    expect(sentencesOf('Su capital es Washington D. C. y su ciudad más poblada es Nueva York. Limita con Canadá.', 'es')).toEqual(['Su capital es Washington D. C. y su ciudad más poblada es Nueva York.', 'Limita con Canadá.']);
    expect(sentencesOf('Also known as St. Barts and St. Barths. It lies south.', 'en')).toEqual(['Also known as St. Barts and St. Barths.', 'It lies south.']);
    expect(sentencesOf('It is defined in Law No. 34/1944, adopted that year. The law describes it.', 'en')).toEqual(['It is defined in Law No. 34/1944, adopted that year.', 'The law describes it.']);
    expect(sentencesOf('It was designed by George W. Bush Sr. himself. Nobody believes it.', 'en')).toEqual(['It was designed by George W. Bush Sr. himself.', 'Nobody believes it.']);
    expect(sentencesOf('The U.S. Virgin Islands are islands. They are in the Caribbean.', 'en')).toEqual(['The U.S. Virgin Islands are islands.', 'They are in the Caribbean.']);
  });

  it('do not end inside brackets or quotation marks, and take with them what closes with them', () => {
    expect(sentencesOf('Es grande (la mayor. Sin duda) y vieja. Otra.', 'es')).toEqual(['Es grande (la mayor. Sin duda) y vieja.', 'Otra.']);
    expect(sentencesOf('Se la llama «la roja. La de todos» desde 1900. Otra.', 'es')).toEqual(['Se la llama «la roja. La de todos» desde 1900.', 'Otra.']);
    expect(sentencesOf('It is called “the red one.” Nobody knows why.', 'en')).toEqual(['It is called “the red one.” Nobody knows why.']);
    expect(sentencesOf('He said so (twice.) Then he left.', 'en')).toEqual(['He said so (twice.) Then he left.']);
  });
});

describe('the paragraphs of a text', () => {
  it('are its lines, with the one that was broken in the middle of a sentence put together again', () => {
    expect(paragraphsOf('Uno.\n\n \nDos.')).toEqual(['Uno.', 'Dos.']);
    expect(paragraphsOf('Es un país, y uno de los \nveintisiete Estados de la Unión.\nOtro.')).toEqual(['Es un país, y uno de los veintisiete Estados de la Unión.', 'Otro.']);
    // A bracket left open goes on in the next line, whatever that begins with.
    expect(paragraphsOf('Mauritania (en árabe: X \nAl-Y, en francés: Z), es un país.')).toEqual(['Mauritania (en árabe: X Al-Y, en francés: Z), es un país.']);
    expect(paragraphsOf('La bandera (rojo) \n(French: Drapeau) is a flag.')).toEqual(['La bandera (rojo) (French: Drapeau) is a flag.']);
  });

  it('end with a full stop where a sentence ended with nothing, and are left alone where they are no sentence', () => {
    expect(paragraphsOf('La bandera nacional de los Emiratos Árabes Unidos fue adoptada el 2 de diciembre de 1971\nContiene cuatro colores.')).toEqual([
      'La bandera nacional de los Emiratos Árabes Unidos fue adoptada el 2 de diciembre de 1971.',
      'Contiene cuatro colores.',
    ]);
    expect(paragraphsOf('En el medio hay un círculo blanco con una grulla de corona gris (símbolo del Estado)\nBuganda es un reino.')).toEqual(['En el medio hay un círculo blanco con una grulla de corona gris (símbolo del Estado).', 'Buganda es un reino.']);
    // What leads to something, and the names of the things of a list, are not sentences that lack their stop.
    expect(paragraphsOf('Los colores tienen los siguientes significados:\nVerde: la fertilidad\nIslas Kerguelen')).toEqual(['Los colores tienen los siguientes significados:', 'Verde: la fertilidad', 'Islas Kerguelen']);
  });
});

describe('the spaces of a text', () => {
  it('are put right where a note was taken from between two words', () => {
    expect(spaced('Es árabe y musulmán.Su capital es Argel.')).toBe('Es árabe y musulmán. Su capital es Argel.');
    expect(spaced('Su capital es Ámsterdam;no obstante, la sede está en La Haya.')).toBe('Su capital es Ámsterdam; no obstante, la sede está en La Haya.');
    expect(spaced('Tiene  dos   islas , y ( pocas ) más .')).toBe('Tiene dos islas, y (pocas) más.');
    expect(spaced('una población de 11 754 004habitantes')).toBe('una población de 11 754 004 habitantes');
    expect(spaced('de Santa Lucía de Siracusa..')).toBe('de Santa Lucía de Siracusa.');
    // Figures and short forms are not words that were stuck together.
    expect(spaced('Mide 6.8 km2, el 11th del mundo, en los 1970s; EE.UU. y U.S.A. lo saben...')).toBe('Mide 6.8 km2, el 11th del mundo, en los 1970s; EE.UU. y U.S.A. lo saben...');
  });
});

describe('the opening of a page, made short', () => {
  const SPAIN =
    'España, formalmente Reino de España,\u200b es un país soberano transcontinental situado principalmente en el suroeste de Europa, con territorios en el norte de África. Constituido en un Estado social y Estado de Derecho, su forma de gobierno es la monarquía parlamentaria. Es uno de los veintisiete Estados de la Unión Europea y su capital y ciudad más poblada es Madrid.\u200b \n' +
    'El territorio español ocupa la mayor parte de la península ibérica, así como los archipiélagos de las islas Baleares en el mar Mediterráneo y de las Canarias en el océano Atlántico. El Estado se organiza en diecisiete comunidades autónomas y dos ciudades autónomas.';

  it('is its first sentences, whole and as they are written, as many as fit', () => {
    expect(leadOf(SPAIN, { lang: 'es', max: 640 })).toEqual([
      'España, formalmente Reino de España, es un país soberano transcontinental situado principalmente en el suroeste de Europa, con territorios en el norte de África. Constituido en un Estado social y Estado de Derecho, su forma de gobierno es la monarquía parlamentaria. Es uno de los veintisiete Estados de la Unión Europea y su capital y ciudad más poblada es Madrid.',
    ]);
    // With less room, fewer sentences: never a piece of one.
    expect(leadOf(SPAIN, { lang: 'es', max: 300 })).toEqual([
      'España, formalmente Reino de España, es un país soberano transcontinental situado principalmente en el suroeste de Europa, con territorios en el norte de África. Constituido en un Estado social y Estado de Derecho, su forma de gobierno es la monarquía parlamentaria.',
    ]);
    // The first is kept even when it alone is longer than the room there is, up to a point; past it, nothing.
    expect(leadOf(SPAIN, { lang: 'es', max: 110 })).toEqual(['España, formalmente Reino de España, es un país soberano transcontinental situado principalmente en el suroeste de Europa, con territorios en el norte de África.']);
    expect(leadOf(SPAIN, { lang: 'es', max: 110, most: 120 })).toBeNull();
  });

  it('goes on into a second paragraph only while little has been said', () => {
    const text = 'Jamaica es una isla del Caribe.\nSu capital es Kingston.\nEl país está formado por una isla principal y varios cayos pequeños frente a su costa sur.';
    expect(leadOf(text, { lang: 'es', max: 120 })).toEqual(['Jamaica es una isla del Caribe.', 'Su capital es Kingston.', 'El país está formado por una isla principal y varios cayos pequeños frente a su costa sur.'].slice(0, 2));
    expect(leadOf(text, { lang: 'es', max: 400 })).toHaveLength(3);
    // More than half the room is taken by the first paragraph: the second is not begun.
    expect(leadOf(SPAIN, { lang: 'es', max: 700 })).toHaveLength(1);
  });

  it('keeps as many sentences as whoever read it says', () => {
    expect(leadOf(SPAIN, { lang: 'es', max: 640, keep: 1 })).toEqual(['España, formalmente Reino de España, es un país soberano transcontinental situado principalmente en el suroeste de Europa, con territorios en el norte de África.']);
    expect(leadOf(SPAIN, { lang: 'es', max: 100, keep: 4 })?.join(' ¶ ')).toMatch(/Madrid\. ¶ El territorio español ocupa .* océano Atlántico\.$/);
  });

  it('takes out the brackets that say how a name is written or said in another language', () => {
    expect(whole('Catar\u200b\u200b (en árabe: قطر\u200e, romanizado: Qaṭar; AFI: [ˈqɑtˁɑr]; árabe del Golfo [ɡɪtˤɑr]), cuyo nombre oficial es Estado de Catar\u200b (en árabe: دولة قطر\u200e, romanizado: Dawlat Qaṭar), es un Estado soberano árabe.')).toBe(
      'Catar, cuyo nombre oficial es Estado de Catar, es un Estado soberano árabe.',
    );
    expect(whole('Japón (en japonés: 日本, , formalmente 日本国, Nippon-koku) es un país insular en Asia Oriental.')).toBe('Japón es un país insular en Asia Oriental.');
    expect(whole('La República Popular China (en chino, 中华人民共和国; pinyin, ), mayormente conocida como China (中国, ), es un país soberano.')).toBe('La República Popular China, mayormente conocida como China, es un país soberano.');
    expect(whole('Alemania (en alemán: ), oficialmente la República Federal de Alemania, es un país.')).toBe('Alemania, oficialmente la República Federal de Alemania, es un país.');
    expect(whole('Anguila (en inglés Anguilla) es un territorio británico de ultramar.')).toBe('Anguila es un territorio británico de ultramar.');
    expect(whole('Guatemala, oficialmente República de Guatemala (del náhuatl: Cuauhtemallan ‘lugar de muchos árboles’), es un país.')).toBe('Guatemala, oficialmente República de Guatemala, es un país.');
    expect(whole('Ghana o Gana, oficialmente la República de Ghana (inglés: Republic of Ghana), es un país.')).toBe('Ghana o Gana, oficialmente la República de Ghana, es un país.');
    expect(whole('Kiribati (pronunciado en gilbertés /kíribas/), oficialmente la República de Kiribati, es un archipiélago.')).toBe('Kiribati, oficialmente la República de Kiribati, es un archipiélago.');
    expect(whole('Filipinas —oficialmente la República de Filipinas (en tagalo: Republika ng Pilipinas)— es un país insular.')).toBe('Filipinas —oficialmente la República de Filipinas— es un país insular.');

    expect(whole('Gibraltar (  jih-BRAWL-tər, -\u2060BROL-, Spanish: [xiβɾalˈtaɾ]) is a British Overseas Territory.', 'en')).toBe('Gibraltar is a British Overseas Territory.');
    expect(whole('Nauru (), also known by its native name Naoero () and officially as the Republic of Naoero (), is an island country.', 'en')).toBe('Nauru, also known by its native name Naoero and officially as the Republic of Naoero, is an island country.');
    expect(whole('The national flag of Spain (Spanish: Bandera de España), as it is defined in the Constitution of 1978, consists of three lines.', 'en')).toBe(
      'The national flag of Spain, as it is defined in the Constitution of 1978, consists of three lines.',
    );
    expect(whole('The national flag of Poland (flaga Polski [ˈfla.ɡa ˈpɔl.ski]) consists of two horizontal stripes.', 'en')).toBe('The national flag of Poland consists of two horizontal stripes.');
    // What is left of a bracket that began with how the name sounds.
    expect(whole('The Isle of Man (Manx: Mannin [ˈmanɪnʲ]), also known simply as Man or Mann ( man), is a Crown Dependency.', 'en')).toBe('The Isle of Man, also known simply as Man or Mann, is a Crown Dependency.');
    expect(whole('Saint Helena (, US: ; US:  ) is a volcanic tropical island.', 'en')).toBe('Saint Helena is a volcanic tropical island.');
    expect(whole('Turks and Caicos Islands (  and  ) is a British Overseas Territory.', 'en')).toBe('Turks and Caicos Islands is a British Overseas Territory.');
  });

  it('keeps the brackets that tell something else, and of one that tells several things, those that are not such a name', () => {
    expect(whole('Es el segundo país más poblado del mundo (hasta 2023 era el primero, cuando fue superado por India).')).toBe('Es el segundo país más poblado del mundo (hasta 2023 era el primero, cuando fue superado por India).');
    expect(whole('South Sudan (), officially the Republic of South Sudan (RoSS), is a landlocked country.', 'en')).toBe('South Sudan, officially the Republic of South Sudan (RoSS), is a landlocked country.');
    expect(whole('La bandera, salvo en la Segunda República (1931-1939), no ha cambiado (en el centro lleva el escudo).')).toBe('La bandera, salvo en la Segunda República (1931-1939), no ha cambiado (en el centro lleva el escudo).');
    expect(whole('Jordania, oficialmente Reino Hachemita de Jordania (en algunas fuentes oficiales también Reino Hachemí de Jordania), es un país.')).toBe(
      'Jordania, oficialmente Reino Hachemita de Jordania (en algunas fuentes oficiales también Reino Hachemí de Jordania), es un país.',
    );
    expect(whole('Las Islas Cocos, el Territorio de las Islas Cocos (Keeling) (en inglés, Territory of Cocos (Keeling) Islands), son un territorio.')).toBe('Las Islas Cocos, el Territorio de las Islas Cocos (Keeling), son un territorio.');
    expect(whole('Estados Unidos (EE. UU.; en inglés: United States, US), oficialmente Estados Unidos de América (EUA; United States of America, USA), es una federación.')).toBe(
      'Estados Unidos (EE. UU.), oficialmente Estados Unidos de América (EUA; United States of America, USA), es una federación.',
    );
    expect(whole('La República Democrática del Congo (RDC; en francés: République démocratique du Congo; en lingala: Republiki ya Kongó) es un país.')).toBe('La República Democrática del Congo (RDC) es un país.');
    // A name in another language is only taken from the first sentence: later, a bracket says what it says.
    expect(whole('Es un país del sur de Europa. Su lema (en latín: Plus ultra) es antiguo.')).toBe('Es un país del sur de Europa. Su lema (en latín: Plus ultra) es antiguo.');
    // But how something sounds, or a text in another script, is taken from anywhere.
    expect(whole('Es un país del sur de Europa. Su capital (AFI: [maˈðɾið]) es grande, y su río (نهر) es largo.')).toBe('Es un país del sur de Europa. Su capital es grande, y su río es largo.');
  });

  it('takes out the places of the notes and the marks that are not seen', () => {
    expect(whole('Las Maldivas, oficialmente la República de Maldivas  [1] (en divehi: ދިވެހިރާއްޖޭ), es un país[nota 2] insular.[a]')).toBe('Las Maldivas, oficialmente la República de Maldivas, es un país insular.');
    expect(whole('Está cubierto por el desierto de Kalahari.[cita requerida] Limita al norte con Zambia[citation needed].')).toBe('Está cubierto por el desierto de Kalahari. Limita al norte con Zambia.');
    expect(whole('Es un territorio administrado por el Reino Unido\u200bque comprende dos archipiélagos,\u200b\u200by poco más.')).toBe('Es un territorio administrado por el Reino Unido que comprende dos archipiélagos, y poco más.');
    expect(whole('Mide\u00a021\u2009km² y tiene\u202f12 000 habitantes.')).toBe('Mide 21 km² y tiene 12 000 habitantes.');
    // What a bracket of another kind holds is part of the text.
    expect(whole('Se llama Pulu Cocos [Keeling] desde entonces.')).toBe('Se llama Pulu Cocos [Keeling] desde entonces.');
  });

  it('stops before a sentence that leads to what plain text did not keep, or that was left broken', () => {
    expect(whole('La bandera fue adoptada en 1944. La ley la describe así:\nEs azul con una cruz blanca y otra roja.')).toBe('La bandera fue adoptada en 1944.');
    expect(whole('Es un territorio de ultramar de Francia. Consta de lo siguiente.\nUna isla muy grande. Otra isla más pequeña.')).toBe('Es un territorio de ultramar de Francia.');
    expect(whole('Es una isla del Atlántico Sur. Se la conoce como «la roca, y nadie sabe por qué. Tiene un faro en su extremo norte.')).toBe('Es una isla del Atlántico Sur.');
    expect(whole('Es una isla del Atlántico Sur. Tiene un pico (el mayor del océano. Tiene un faro en su extremo norte.')).toBe('Es una isla del Atlántico Sur.');
    // What is too short to be a sentence was something else; a short sentence is one.
    expect(whole('Es una isla del Atlántico Sur. Corta. Tiene un faro en su extremo norte.')).toBe('Es una isla del Atlántico Sur.');
    expect(whole('Austria es un país de Europa central. Su capital es Viena. Limita con ocho países.')).toBe('Austria es un país de Europa central. Su capital es Viena. Limita con ocho países.');
    // The names of the things of a list are not told as if they were sentences.
    expect(whole('Las Tierras Australes son un territorio de Francia en el océano Índico.\nIslas Kerguelen\nIslas Crozet')).toBe('Las Tierras Australes son un territorio de Francia en el océano Índico.');
    // And a page that begins with one says nothing.
    expect(leadOf('Los colores son:\nRojo. Verde.', { lang: 'es', max: 600 })).toBeNull();
    expect(leadOf('', { lang: 'es', max: 600 })).toBeNull();
    expect(leadOf(undefined, { lang: 'es', max: 600 })).toBeNull();
  });
});
