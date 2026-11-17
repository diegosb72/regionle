import { afterEach, describe, expect, it, vi } from 'vitest';
import { setLang } from '../lib/i18n';
import type { Item } from '../lib/types';
import { shorten, wikiSummary } from './WikiCard';

describe('what is shown of an article', () => {
  it('keeps a short text whole', () => {
    expect(shorten('Soria es una ciudad de España.')).toBe('Soria es una ciudad de España.');
    expect(shorten('')).toBe('');
  });

  it('cuts between sentences, never inside one', () => {
    const a = `Burgos es una ciudad de España situada en el norte de la península ibérica, ${'a orillas del río Arlanzón, '.repeat(6)}en Castilla y León.`;
    const b = `Tiene una catedral gótica declarada Patrimonio de la Humanidad, ${'muy visitada, '.repeat(14)}desde 1984.`;
    const c = 'Fue capital del reino de Castilla.';
    expect(a.length).toBeGreaterThan(200);
    expect(a.length + b.length).toBeGreaterThan(420);
    expect(shorten(`${a} ${b} ${c}`)).toBe(a);
    // Two short sentences fit; the third would go past what is wanted.
    const s = 'Una frase de las de relleno que no dice gran cosa pero ocupa su sitio en la tarjeta, como tantas otras que hay.';
    expect(shorten(`${s} ${s} ${s} ${s} ${s}`)).toBe(`${s} ${s} ${s}`);
  });

  it('does not take an abbreviation or a figure for the end of a sentence', () => {
    const text = 'Tiene 1.234 habitantes (aprox. en 2020) y está a 3.5 km del mar. ¿Algo más? Sí: es capital. «Muy noble», dice su escudo.';
    expect(shorten(text)).toBe(text);
    const long = `El municipio tiene 1.234 habitantes y está a 3.5 km del mar, ${'entre montes, '.repeat(22)}en la costa. Otra frase que ya no cabe porque la primera es larga de sobra.`;
    expect(shorten(long)).toBe(long.slice(0, long.indexOf(' Otra frase')));
  });

  it('cuts a single endless sentence at a word, with an ellipsis', () => {
    const out = shorten(`${'palabra '.repeat(100)}fin.`);
    expect(out.length).toBeLessThanOrEqual(501);
    expect(out.endsWith('palabra…')).toBe(true);
  });
});

describe('which article is shown', () => {
  /** What Wikidata and Wikipedia would answer: by address, the body or the status of a failure. */
  type Answers = Record<string, unknown>;
  const asked: string[] = [];
  const serve = (answers: Answers) => {
    asked.length = 0;
    vi.stubGlobal('fetch', async (url: string) => {
      asked.push(url);
      const hit = Object.keys(answers).find((part) => url.includes(part));
      const body = hit ? answers[hit] : 404;
      return typeof body === 'number' ? { ok: false, status: body, json: async () => ({}) } : { ok: true, status: 200, json: async () => body };
    });
  };
  const links = (wd: string, titles: Record<string, string>) => ({ entities: { [wd]: { sitelinks: Object.fromEntries(Object.entries(titles).map(([l, title]) => [`${l}wiki`, { title }])) } } });
  const summary = (title: string, extract: string, extra: Record<string, unknown> = {}) => ({ type: 'standard', title, extract, ...extra });
  let n = 0;
  // The answers are kept by piece for the session: each case asks about a piece of its own.
  const piece = (over: Partial<Item> = {}): Item => ({ id: `T-${++n}`, kind: 'unit', name: 'Soria', country: { n: { es: 'España', en: 'Spain' } }, ...over }) as unknown as Item;

  afterEach(() => {
    vi.unstubAllGlobals();
    setLang('es');
  });

  it('is the one in the language of the player when it has something to say', async () => {
    setLang('es');
    serve({
      'wbgetentities&ids=Q1': links('Q1', { es: 'Provincia de Soria', en: 'Province of Soria' }),
      'es.wikipedia.org/api/rest_v1/page/summary/Provincia_de_Soria': summary('Provincia de Soria', 'Soria es una provincia de España.', { thumbnail: { source: 'https://upload.example/soria.jpg' }, content_urls: { desktop: { page: 'https://es.wikipedia.org/wiki/Provincia_de_Soria' } } }),
    });
    expect(await wikiSummary(piece({ wd: 'Q1' }))).toEqual({ title: 'Provincia de Soria', text: 'Soria es una provincia de España.', image: 'https://upload.example/soria.jpg', url: 'https://es.wikipedia.org/wiki/Provincia_de_Soria', lang: 'es' });
    // The other language is not asked for when there is no need.
    expect(asked.some((url) => url.includes('en.wikipedia.org'))).toBe(false);
  });

  it('is the one in the other language when there is none in the player’s', async () => {
    setLang('es');
    serve({
      'wbgetentities&ids=Q2': links('Q2', { en: 'Hhohho Region' }),
      'en.wikipedia.org/api/rest_v1/page/summary/Hhohho_Region': summary('Hhohho Region', 'Hhohho is a region of Eswatini.'),
    });
    const got = await wikiSummary(piece({ wd: 'Q2' }));
    expect(got).toMatchObject({ title: 'Hhohho Region', lang: 'en', text: 'Hhohho is a region of Eswatini.', url: 'https://en.wikipedia.org/wiki/Hhohho_Region' });
  });

  it('is the one in the other language when the player’s is empty, a list of meanings or does not answer', async () => {
    setLang('en');
    const english = { 'en.wikipedia.org/api/rest_v1/page/summary/': 500 };
    const spanish = { 'es.wikipedia.org/api/rest_v1/page/summary/Soria': summary('Soria', 'Soria es una ciudad de España.') };
    for (const [wd, broken] of [
      ['Q3', { 'en.wikipedia.org/api/rest_v1/page/summary/': summary('Soria', '') }],
      ['Q4', { 'en.wikipedia.org/api/rest_v1/page/summary/': { type: 'disambiguation', title: 'Soria', extract: 'Soria may refer to:' } }],
      ['Q5', english],
    ] as const) {
      serve({ [`wbgetentities&ids=${wd}`]: links(wd, { en: 'Soria', es: 'Soria' }), ...broken, ...spanish });
      expect(await wikiSummary(piece({ wd })), wd).toMatchObject({ lang: 'es', text: 'Soria es una ciudad de España.' });
      // The player's own language was tried first.
      const pages = asked.filter((url) => url.includes('/page/summary/')).map((url) => new URL(url).hostname);
      expect(pages, wd).toEqual(['en.wikipedia.org', 'es.wikipedia.org']);
    }
  });

  it('is none when nothing can be shown, and the card is left out', async () => {
    setLang('es');
    serve({ 'wbgetentities&ids=Q6': links('Q6', {}) });
    expect(await wikiSummary(piece({ wd: 'Q6' }))).toBeNull();
    serve({ 'wbgetentities&ids=Q7': links('Q7', { es: 'Nada', en: 'Nothing' }) });
    expect(await wikiSummary(piece({ wd: 'Q7' }))).toBeNull();
    // Wikidata itself does not answer.
    serve({});
    expect(await wikiSummary(piece({ wd: 'Q8' }))).toBeNull();
  });

  it('is looked up by name, in the language of the player, for a piece without a Wikidata id', async () => {
    setLang('es');
    serve({
      'es.wikipedia.org/w/api.php?action=query&list=search': { query: { search: [{ title: 'Soria' }] } },
      'es.wikipedia.org/api/rest_v1/page/summary/Soria': summary('Soria', 'Soria es una ciudad de España.'),
    });
    expect(await wikiSummary(piece())).toMatchObject({ lang: 'es', title: 'Soria' });
    expect(asked[0]).toContain(`srsearch=${encodeURIComponent('Soria, España')}`);
    expect(asked.some((url) => url.includes('wikidata.org'))).toBe(false);
  });

  it('asks once for each piece and language, however many times the card is shown', async () => {
    setLang('es');
    serve({
      'wbgetentities&ids=Q9': links('Q9', { es: 'Soria' }),
      'es.wikipedia.org/api/rest_v1/page/summary/Soria': summary('Soria', 'Soria es una ciudad de España.'),
    });
    const item = piece({ wd: 'Q9' });
    const [a, b] = await Promise.all([wikiSummary(item), wikiSummary(item)]);
    expect(a).toBe(b);
    await wikiSummary(item);
    expect(asked).toHaveLength(2);
  });
});
