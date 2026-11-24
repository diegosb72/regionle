/**
 * What the sheets of the countries take from Wikidata and from the two Wikipedias, read by hand here:
 * how a box of facts is read (scripts/data/wikitext.mjs), what is believed of what the sources say and
 * what is left out and told to whoever corrects them (scripts/data/profiles-said.mjs), and how a
 * correction by hand is laid over it (`laid`, scripts/data/profiles.mjs). The sources are made up for
 * each test: a country `AA`, its flag `Q12`, and the boxes that the test says its pages open with.
 */
import { describe, expect, it } from 'vitest';
import type { ProfileFile } from './profiles';
// @ts-expect-error a script of the build, written without types
import { saidOf, ratioText, tongueCodes } from '../../scripts/data/profiles-said.mjs';
// @ts-expect-error a script of the build, written without types
import { laid } from '../../scripts/data/profiles.mjs';
// @ts-expect-error a script of the build, written without types
import { boxFields, calledIn, daysAt, daysIn, monthOf, plain, tidy } from '../../scripts/data/wikitext.mjs';

describe('a box of facts of a Wikipedia', () => {
  it('is read field by field, whatever is written inside each', () => {
    const box = boxFields(`{{Infobox country
| conventional_long_name = Kingdom of Spain<ref name="a">Some [[note|n]] | with = bars</ref>
| native_name = {{native name|es|Reino de España}}<br />{{collapsible list|title=Other|{{lang|ca|Regne d'Espanya}}}}
| image_flag = Flag of Spain.svg <!-- a comment | with = bars -->
| capital = [[Madrid|The city | of Madrid]]
| motto = first
| motto = second
| Area_km2 = 505990
}}
Text after the box | not = a field`);
    expect(box.name).toBe('infobox country');
    expect([...box.fields]).toEqual([
      // A note and a comment say nothing, nor do the bars inside them part a field.
      ['conventional long name', 'Kingdom of Spain'],
      // A template inside a field is kept as it is written: whoever asks for the field reads it.
      ['native name', "{{native name|es|Reino de España}}<br />{{collapsible list|title=Other|{{lang|ca|Regne d'Espanya}}}}"],
      ['image flag', 'Flag of Spain.svg'],
      // The bar of a link is its own.
      ['capital', '[[Madrid|The city | of Madrid]]'],
      // Given twice, it says what the last says, as a wiki reads it.
      ['motto', 'second'],
      // Its name in small letters, its underscores as spaces.
      ['area km2', '505990'],
    ]);
    expect(boxFields('{{ Ficha_de  país\n|nombre_oficial=Reino de España\n}}').name).toBe('ficha de país');
    expect(boxFields('{{Ficha de país|nombre_oficial=Reino de España}}').fields.get('nombre oficial')).toBe('Reino de España');
    // What is not a box has no fields.
    expect(boxFields('Just a text').name).toBe('');
    expect(boxFields('Just a text').fields.size).toBe(0);
    expect(boxFields('').fields.size).toBe(0);
  });

  it('says what a reader reads once its marks are taken away', () => {
    const langs: string[] = [];
    expect(plain("''[[Plus ultra (lema)|Plus ultra]]''<ref>x</ref> {{lang|la|Plus ultra}}<br />(en [[latín]]: «Más allá»)", langs)).toBe('Plus ultra Plus ultra\n(en latín: «Más allá»)');
    // And tells which language a text was said to be in.
    expect(langs).toEqual(['la']);
    // A day, as each Wikipedia writes its template; a note says nothing.
    expect(plain('{{Start date and age|1794|02|15|df=y}}{{efn|name=first|Use has not been continuous}}')).toBe('1794-02-15');
    expect(plain('{{Fecha|15|2|1794|edad}} (como pabellón naval)<br/>1812')).toBe('1794-02-15 (como pabellón naval)\n1812');
    expect(plain('{{ratio|2:3}} · {{nowrap|10:19}} · {{unbulleted list|uno|dos}}')).toBe('2:3 · 10:19 · uno\ndos');
    // A picture is not said; a link out says what it shows; what is written for the machine is written for the reader.
    expect(plain('[[File:Flag.svg|20px|a [[link]] inside]] Text &amp; more&nbsp;here <small>(small)</small> [https://example.com the site]')).toBe('Text & more here (small) the site');
    expect(plain('* uno\n* dos\n\n: tres')).toBe('uno\ndos\ntres');
    expect(plain(undefined)).toBe('');
  });

  it('marks what it does not understand, so that nobody is shown it', () => {
    // A template it does not know, and one that is never closed.
    for (const text of ['{{unknown thing|a|b}} rest', 'never {{closed|a']) {
      const read = plain(text);
      expect(read).toContain(text.includes('rest') ? 'rest' : 'never');
      expect(tidy(read), text).toBe(false);
    }
    expect(tidy('Reino de España')).toBe(true);
    expect(tidy('République d’Aa – «Unité»')).toBe(true);
    for (const left of ['a | b', 'a = b', 'see https://x', 'a &ndash; b', '[x]', '<b>', '{x}']) expect(tidy(left), left).toBe(false);
  });

  it('knows the months of the two languages, by name and by number', () => {
    const months = ['enero', 'Jan', 'setiembre', 'sept.', 'Dec', 'diciembre', 'marzo', 'ago', 'August', '7', '12'];
    expect(months.map(monthOf)).toEqual([1, 1, 9, 9, 12, 12, 3, 8, 8, 7, 12]);
    for (const none of ['13', '0', 'xx', 'de', '']) expect(monthOf(none), none).toBe(0);
  });

  it('finds the days and the years a text names, in the order it names them', () => {
    const text = 'Adopted 19 November 1889; modified May 11, 1992, and the 3rd of nothing in 2001. 12 de octubre de 1981. 1785-05-28';
    expect(daysIn(text)).toEqual(['1889-11-19', '1992-05-11', '2001', '1981-10-12', '1785-05-28']);
    // And where each is, to read what is said of it.
    expect(daysAt(text).map(([at]: [number, string]) => text.slice(at, at + 4))).toEqual(['19 N', 'May ', '2001', '12 d', '1785']);
    expect(daysIn('c. 1300 (first), 1 January 1801 (current)')).toEqual(['1300', '1801-01-01']);
    // A number that is no year, and a day that is none.
    expect(daysIn('99 stars, 12345 people, 40 March 1950')).toEqual(['1950']);
    expect(daysIn('nothing here')).toEqual([]);
  });

  it('reads what something is called in each language, wherever the templates made for it are', () => {
    const names = calledIn(
      "{{native name|de|Republik Österreich}}<br>{{lang|fr|République d'Autriche}} {{unbulleted list|{{lang-it|Repubblica}}|{{native name|sr-latn|Republika}}}} {{name in various languages|sq=Republika|sr=Република|title=x}}",
    );
    expect(names).toEqual([
      ['de', 'Republik Österreich'],
      ['fr', "République d'Autriche"],
      ['it', 'Repubblica'],
      ['sr-latn', 'Republika'],
      ['sq', 'Republika'],
      ['sr', 'Република'],
    ]);
    expect(calledIn('A plain name')).toEqual([]);
    expect(calledIn(undefined)).toEqual([]);
  });
});

describe('the proportions of a flag, as a sheet writes them', () => {
  it('are the smallest whole numbers that say them', () => {
    const said: [[number, number], string][] = [
      [[2, 3], '2:3'],
      [[4, 6], '2:3'],
      [[1, 1.5], '2:3'],
      [[1, 1], '1:1'],
      [[10, 19], '10:19'],
      [[0.625, 1], '5:8'],
      [[1, 1.6], '5:8'],
      [[1, 2.5], '2:5'],
      [[3, 2], '3:2'],
      [[189, 335], '189:335'],
    ];
    for (const [ratio, text] of said) expect(ratioText(ratio), ratio.join(':')).toBe(text);
  });

  it('are told against one where no whole numbers say them', () => {
    expect(ratioText([1, 1.618])).toBe('1:1.618');
    expect(ratioText([500, 809])).toBe('1:1.618');
    expect(ratioText([1.61803, 1])).toBe('1.618:1');
  });
});

/** What was brought of the made-up country `AA` and of whatever else a test says. */
interface Over {
  item?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  names?: Record<string, { es?: string; en?: string }>;
  boxes?: Record<string, string>;
}
const CODES = tongueCodes({ l: { fr: ['francés', 'French'], de: ['alemán', 'German'], gn: ['guaraní', 'Guarani'], es: ['español', 'Spanish'], en: ['inglés', 'English'] } });
const brought = (over: Over = {}) => ({
  // `Q90` is the anthem of two others as well; `Q91` is that of `AA` alone.
  items: { AA: { wd: 'Q1', pages: { es: 'Aa', en: 'Aa' }, ...over.item }, ZZ: { anthem: ['Q90'] }, YY: { anthem: ['Q90'] } },
  flags: over.flags ?? {},
  names: {
    Q90: { es: 'himno de todos', en: 'anthem of all' },
    Q91: { es: 'la mía', en: 'mine' },
    Q21: { en: '3:2' },
    Q22: { en: '2:1' },
    Q41: { en: 'red' },
    Q42: { en: 'white' },
    Q43: { en: 'gold' },
    Q44: { en: 'yellow' },
    Q45: { en: 'Blue' },
    Q46: { en: 'puce' },
    Q51: { es: 'Ana', en: 'Anne' },
    Q52: { en: 'Bob' },
    ...over.names,
  },
  boxes: over.boxes ?? {},
});
/** What `saidOf` gives: what a sheet would say, and what whoever corrects the sources should look at. */
interface Read {
  given: Pick<ProfileFile, 'official' | 'local' | 'localLang' | 'anthem' | 'flag' | 'read' | 'readFlag'> & { motto?: { text: string; lang?: string; es?: string; en?: string } };
  notes: string[];
}
const read = (over: Over = {}, extra: { tongues?: string[]; flown?: [number, number][] } = {}): Read =>
  saidOf({ country: { id: 'AA' }, said: brought(over), tongues: extra.tongues ?? ['de', 'fr'], codes: CODES, flown: extra.flown ?? [] });
/** The country, with the boxes its two pages open with. */
const country = (es: string, en: string, item: Record<string, unknown> = {}, tongues?: string[]) =>
  read({ item, boxes: { ...(es ? { 'es:Aa': `{{Ficha de país|${es}}}` } : {}), ...(en ? { 'en:Aa': `{{Infobox country|${en}}}` } : {}) } }, { tongues });
/** Its flag, with what Wikidata says of it and the boxes the two pages of the flag open with. */
const flag = (said: Record<string, unknown>, boxes: { es?: string; en?: string } = {}, flown?: [number, number][]) =>
  read(
    {
      item: { flag: ['Q12'] },
      flags: { Q12: { pages: { es: 'Bandera de Aa', en: 'Flag of Aa' }, ...said } },
      boxes: {
        ...(boxes.es !== undefined ? { 'es:Bandera de Aa': `{{Ficha de bandera|${boxes.es}}}` } : {}),
        ...(boxes.en !== undefined ? { 'en:Flag of Aa': `{{Infobox flag|${boxes.en}}}` } : {}),
      },
    },
    { flown },
  );

describe('what the sources say of a country', () => {
  it('is nothing of one that nothing was brought of, and says so', () => {
    expect(saidOf({ country: { id: 'QQ' }, said: brought() })).toEqual({ given: {}, notes: ['nothing was brought of it'] });
  });

  it('is where to read of it, of one that only has its pages', () => {
    expect(read()).toEqual({ given: { read: { es: 'https://es.wikipedia.org/wiki/Aa', en: 'https://en.wikipedia.org/wiki/Aa' } }, notes: [] });
    // An address is written as a browser asks for it, with the signs a title may have.
    expect(read({ item: { pages: { es: 'Aa (país)', en: "Côte d'Aa" } } }).given.read).toEqual({ es: 'https://es.wikipedia.org/wiki/Aa_(pa%C3%ADs)', en: "https://en.wikipedia.org/wiki/C%C3%B4te_d'Aa" });
  });

  it('calls it in full as the box of each Wikipedia does, and as Wikidata does where the box does not', () => {
    const wikidata = { official: [['es', 'Aa'], ['es', 'República de Aa (wd)'], ['en', 'Aa-land'], ['de', 'Republik Aa'], ['fr', 'la République d’Aa']], native: [['de', 'Aa']] };
    // The first line of the field, without its note.
    const boxes = country('nombre_oficial = República de Aa<ref>ley</ref><br />otra cosa', 'conventional_long_name = Republic of Aa', wikidata);
    expect(boxes.given.official).toEqual({ es: 'República de Aa', en: 'Republic of Aa' });
    // In its own language, the first of its official ones that anybody gives it in: the longest name there is.
    expect(boxes.given).toMatchObject({ local: 'Republik Aa', localLang: 'de' });
    // A name with years or a bracket in the box is not a name alone: the longest of Wikidata in that language.
    const fallen = country('nombre_oficial = República de Aa (1990-2000)', '', { official: wikidata.official.filter(([lang]) => lang !== 'de') });
    expect(fallen.given.official).toEqual({ es: 'República de Aa (wd)', en: 'Aa-land' });
    // German was not given: French is the next; the article it is written with is not part of the name.
    expect(fallen.given).toMatchObject({ local: 'République d’Aa', localLang: 'fr' });
    // What the English box says it calls itself comes before Wikidata, each in its language.
    const native = country('', "native_name = {{native name|fr|République d'Aa}}<br>{{native name|de|Republik Aa}}", { official: [['de', 'Aa']] });
    expect(native.given).toMatchObject({ local: 'Republik Aa', localLang: 'de' });
    // A country that speaks one of the languages of the game calls itself what it is called in it.
    const spanish = country('nombre_oficial = República de Aa', '', {}, ['es', 'gn']);
    expect(spanish.given).toMatchObject({ official: { es: 'República de Aa' }, local: 'República de Aa', localLang: 'es' });
    // With no name anywhere, none is said.
    expect(read().given.official).toBeUndefined();
    expect(read().given.local).toBeUndefined();
  });

  it('tells its motto as the Spanish box does: how it is said, in which language and what it means', () => {
    const motto = (es: string, en: string, item = {}, tongues?: string[]) => country(`lema_nacional = ${es}`, `national_motto = ${en}`, item, tongues);
    // The language by its name in Spanish; what it means in English is what the English box says in quotes of the same motto.
    expect(motto("''Plus ultra''<br />(en [[latín]]: «Más allá»)", '{{lang|la|Plus ultra}}<br />"Further beyond"').given.motto).toEqual({ text: 'Plus ultra', lang: 'la', es: 'Más allá', en: 'Further beyond' });
    // All in a line; a language the game has no code of is not named.
    expect(motto('Слобода или смрт (en macedonio: Libertad o muerte)', '"Слобода или смрт"<br />"Freedom or Death"').given.motto).toEqual({ text: 'Слобода или смрт', es: 'Libertad o muerte', en: 'Freedom or Death' });
    // Said in Spanish, with nothing told of what it means: it is in the language of the country, and means itself.
    expect(motto('«Libertad y orden»', '"Libertad y Orden"<br/>"Freedom and Order"', {}, ['es']).given.motto).toEqual({ text: 'Libertad y orden', lang: 'es', es: 'Libertad y orden', en: 'Freedom and Order' });
    // The language is the one Wikidata gives the same words in, where the box names none.
    expect(motto('In God We Trust<br />(«En Dios confiamos»)', '"In God We Trust"', { motto: [['en', 'In God we trust']] }).given.motto).toEqual({ text: 'In God We Trust', lang: 'en', es: 'En Dios confiamos', en: 'In God We Trust' });
    // An apostrophe inside the motto does not end it.
    expect(motto("''L'union fait la force''<br />(en francés: «La unión hace la fuerza»)", "\"L'union fait la force\"<br />''\"Unity makes strength\"''").given.motto).toEqual({
      text: "L'union fait la force",
      lang: 'fr',
      es: 'La unión hace la fuerza',
      en: 'Unity makes strength',
    });
    // The English box tells another motto: nothing is taken from it.
    expect(motto("''Einigkeit''<br />(en [[idioma alemán|alemán]]: «Unidad»)", '"Something else"<br />"Other motto"').given.motto).toEqual({ text: 'Einigkeit', lang: 'de', es: 'Unidad' });
  });

  it('says no motto of one that has none, and tells of one it could not read', () => {
    for (const none of ['Ninguno', 'No tiene', 'Sin lema oficial', '—']) {
      const said = country(`lema_nacional = ${none}`, '');
      expect(said.given.motto, none).toBeUndefined();
      expect(said.notes, none).toEqual([]);
    }
    // What Wikidata calls a motto is not one: it is as often the slogan of a tourist board.
    expect(read({ item: { motto: [['en', "There's nothing like Aa"]] } }).given.motto).toBeUndefined();
    const unread = country('lema_nacional = {{raro|x}} algo', '');
    expect(unread.given.motto).toBeUndefined();
    expect(unread.notes).toHaveLength(1);
    expect(unread.notes[0]).toMatch(/^motto not read: .*algo$/);
  });

  it('names its anthems, its own before the one it shares with others', () => {
    expect(read({ item: { anthem: ['Q90', 'Q91'] } }).given.anthem).toEqual({ es: 'La mía · Himno de todos', en: 'Mine · Anthem of all' });
    expect(read({ item: { anthem: ['Q90'] } }).given.anthem).toEqual({ es: 'Himno de todos', en: 'Anthem of all' });
    // One that nobody has named is not said.
    expect(read({ item: { anthem: ['Q999'] } }).given.anthem).toBeUndefined();
  });
});

describe('what the sources say of its flag', () => {
  const adopted = (since: [string, number][], boxes: { es?: string; en?: string }) => {
    const said = flag({ since }, boxes);
    return [said.given.flag?.adopted ?? null, said.notes];
  };

  it('was adopted on the day Wikidata gives when a box names it too, or its year', () => {
    expect(adopted([['1950-01-02', 11]], { en: 'adoption = 2 January 1950' })).toEqual(['1950-01-02', []]);
    expect(adopted([['1950-01-02', 11]], { es: 'adopción = 1950' })).toEqual(['1950-01-02', []]);
    // Wikidata knows the year alone: the day of it that both boxes name; the year, where one box alone names a day.
    expect(adopted([['1950-01-01', 9]], { en: 'adoption = 2 January 1950', es: 'adopción = 2 de enero de 1950' })).toEqual(['1950-01-02', []]);
    expect(adopted([['1950-01-01', 9]], { en: 'adoption = 2 January 1950' })).toEqual(['1950', []]);
    // Nobody else says anything: it is taken, and told.
    expect(adopted([['1950-01-02', 11]], {})).toEqual(['1950-01-02', ['adopted 1950-01-02: only Wikidata says it']]);
  });

  it('was adopted on the day both boxes give when Wikidata says another, on the year both name, or on none', () => {
    expect(adopted([['1949-12-31', 11]], { en: 'adoption = {{start date|1950|1|2}}', es: 'adopción = {{fecha|2|1|1950}}' })).toEqual([
      '1950-01-02',
      ['adopted: Wikidata 1949-12-31, en [1950-01-02], es [1950-01-02] → 1950-01-02'],
    ]);
    expect(adopted([['1949-12-31', 11]], { en: 'adoption = 2 January 1950', es: 'adopción = 1950' })).toEqual(['1950', ['adopted: Wikidata 1949-12-31, en [1950-01-02], es [1950] → 1950']]);
    expect(adopted([['1949-12-31', 11]], { en: 'adoption = 2 January 1950', es: 'adopción = 3 de marzo de 1960' })).toEqual([null, ['adopted: Wikidata 1949-12-31, en [1950-01-02], es [1960-03-03] → none']]);
    // Wikidata says nothing, or two things: the boxes, when they agree.
    expect(adopted([], { en: 'adoption = 2 January 1950', es: 'adopción = 2 de enero de 1950' })).toEqual(['1950-01-02', ['adopted: Wikidata nothing, en [1950-01-02], es [1950-01-02] → 1950-01-02']]);
    expect(
      adopted(
        [
          ['1950-01-02', 11],
          ['1960-01-01', 9],
        ],
        { en: 'adoption = 2 January 1950', es: 'adopción = 2 de enero de 1950' },
      ),
    ).toEqual(['1950-01-02', ['adopted: Wikidata 1950-01-02, 1960, en [1950-01-02], es [1950-01-02] → 1950-01-02']]);
    // Nothing anywhere: nothing said, nothing to tell.
    expect(adopted([], {})).toEqual([null, []]);
  });

  it('came to be as it is on a day only where the game has the flag that was flown before', () => {
    const since: [string, number][] = [['1950-01-02', 11]];
    const marked = { en: 'adoption = 2 January 1950 (original)<br />4 March 1990 (current version)', es: 'adopción = 2 de enero de 1950' };
    // The flag before was lowered in 1990: the day a box says the one of today is from.
    expect(flag({ since }, marked, [[1950, 1990]]).given.flag).toEqual({ adopted: '1950-01-02', changed: '1990-03-04' });
    // Or the only day of that year that the boxes name.
    expect(flag({ since }, { en: 'adoption = 2 January 1950; 4 March 1990' }, [[1950, 1990]]).given.flag).toEqual({ adopted: '1950-01-02', changed: '1990-03-04' });
    // Two days of that year and neither said to be the one: none.
    expect(flag({ since }, { en: 'adoption = 2 January 1950; 4 March 1990; 5 May 1990' }, [[1950, 1990]]).given.flag).toEqual({ adopted: '1950-01-02' });
    // With no earlier flag in the game the sheet would tell of a change and show none.
    expect(flag({ since }, marked, []).given.flag).toEqual({ adopted: '1950-01-02' });
    // Nor when the flag before was lowered before this one was adopted.
    expect(flag({ since }, marked, [[1900, 1950]]).given.flag).toEqual({ adopted: '1950-01-02' });
  });

  it('has the proportions that Wikidata and a box agree on, told as height to width', () => {
    const ratio = (said: Record<string, unknown>, boxes: { es?: string; en?: string }) => {
      const r = flag(said, boxes);
      return [r.given.flag?.ratio ?? null, r.notes];
    };
    // Wikidata writes them as width to height: 3:2 is the 2:3 of the box.
    expect(ratio({ ratio: ['Q21'] }, { en: 'proportion = 2:3' })).toEqual(['2:3', []]);
    expect(ratio({ ratio: ['Q21'] }, { es: 'proporción = 2∶3' })).toEqual(['2:3', []]);
    // The two boxes alike against Wikidata: the boxes, and it is told.
    expect(ratio({ ratio: ['Q22'] }, { en: 'proportion = 2:3', es: 'proporción = 2:3' })).toEqual(['2:3', ['ratio: Wikidata 1:2, both boxes 2:3']]);
    expect(ratio({ ratio: ['Q21'] }, {})).toEqual(['2:3', ['ratio 2:3: only Wikidata says it']]);
    // Nothing agrees, or one box alone says it: none.
    expect(ratio({ ratio: ['Q21'] }, { en: 'proportion = 1:2', es: 'proporción = 3:5' })).toEqual([null, ['ratio: Wikidata 2:3, en 1:2, es 3:5 → none']]);
    expect(ratio({}, { en: 'proportion = 1:2' })).toEqual([null, ['ratio: Wikidata nothing, en 1:2, es — → none']]);
    expect(ratio({}, {})).toEqual([null, []]);
  });

  it('has its colours by their names, each once and in an order of their own', () => {
    // The gold of heraldry is the yellow that everybody sees; a name is the same whatever its capitals.
    expect(flag({ colours: ['Q42', 'Q43', 'Q41', 'Q44', 'Q45'] }).given.flag).toEqual({ colours: { es: ['rojo', 'amarillo', 'azul', 'blanco'], en: ['red', 'yellow', 'blue', 'white'] } });
    // One that has no name here is told, and a single colour is no list of them.
    const unknown = flag({ colours: ['Q41', 'Q46'] });
    expect(unknown.given.flag).toBeUndefined();
    expect(unknown.notes).toEqual(['colour Q46 (puce) has no name here']);
    expect(flag({ colours: ['Q41'] }).given.flag).toBeUndefined();
  });

  it('was designed by whoever Wikidata names or, failing that, by whoever both boxes name alike', () => {
    // Named in each language as it is known in it, and as it is known where it is not.
    expect(flag({ by: ['Q51', 'Q52'] }, { en: 'designer = Somebody else' }).given.flag).toEqual({ by: { es: 'Ana, Bob', en: 'Anne, Bob' } });
    expect(flag({}, { en: 'designer = [[Ana Pérez]]', es: 'diseñador = Ana Pérez' }).given.flag).toEqual({ by: { es: 'Ana Pérez', en: 'Ana Pérez' } });
    // A box alone is not believed: where the two differ, one tells a legend and the other a committee.
    expect(flag({}, { en: 'designer = Ana Pérez' }).given.flag).toBeUndefined();
    expect(flag({}, { en: 'designer = Ana Pérez', es: 'diseñador = Una comisión' }).given.flag).toBeUndefined();
    expect(flag({}, { en: 'designer = Unknown', es: 'diseñador = Unknown' }).given.flag).toBeUndefined();
  });

  it('is, where Wikidata names two, the one a Wikipedia has a page of', () => {
    const said = read({
      item: { flag: ['Q13', 'Q12'] },
      flags: { Q13: { since: [['1900-01-01', 9]] }, Q12: { since: [['1950-01-02', 11]], pages: { en: 'Flag of Aa (b)/c' } } },
    });
    expect(said.given.flag).toEqual({ adopted: '1950-01-02' });
    expect(said.given.readFlag).toEqual({ en: 'https://en.wikipedia.org/wiki/Flag_of_Aa_(b)/c' });
    expect(said.notes).toEqual(['2 flags in Wikidata: Q13, Q12 → Q12', 'adopted 1950-01-02: only Wikidata says it']);
    // A country with no flag in Wikidata says nothing of it, and leads nowhere.
    expect(read().given.flag).toBeUndefined();
    expect(read().given.readFlag).toBeUndefined();
  });
});

describe('the code of a language, by its name in Spanish', () => {
  it('is that of the languages the game names and of those only a motto is said in', () => {
    const codes = tongueCodes({ l: { fr: ['francés', 'French'], gn: ['guaraní', 'Guarani', 'guarani'] } });
    // As it is compared: no accents, no capitals.
    expect(codes.get('frances')).toBe('fr');
    expect(codes.get('guarani')).toBe('gn');
    expect(codes.get('latin')).toBe('la');
    expect(codes.get('criollo haitiano')).toBe('ht');
    expect(codes.get('klingon')).toBeUndefined();
    expect(tongueCodes(undefined).get('latin')).toBe('la');
  });
});

describe('a correction by hand, laid over what the sources say', () => {
  it('replaces what it names, removes what it gives as nothing, and leaves the rest', () => {
    expect(laid({ a: 1, b: { c: 2, d: 3 } }, { b: { c: null, e: 4 }, f: 5 })).toEqual({ a: 1, b: { d: 3, e: 4 }, f: 5 });
    // A list is replaced whole: two lists of colours are not one.
    expect(laid({ a: [1, 2] }, { a: [3] })).toEqual({ a: [3] });
    // Over nothing it is itself.
    expect(laid(undefined, { a: 1 })).toEqual({ a: 1 });
    expect(laid({ a: 'x' }, { a: { b: 1 } })).toEqual({ a: { b: 1 } });
  });

  it('changes neither what it is laid over nor itself', () => {
    const given = { flag: { adopted: '1950', ratio: '2:3' } };
    const fix = { flag: { adopted: null, by: { es: 'Ana' } } };
    expect(laid(given, fix)).toEqual({ flag: { ratio: '2:3', by: { es: 'Ana' } } });
    expect(given).toEqual({ flag: { adopted: '1950', ratio: '2:3' } });
    expect(fix).toEqual({ flag: { adopted: null, by: { es: 'Ana' } } });
  });
});
