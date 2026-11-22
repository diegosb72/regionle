import fs from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { loadIndex, setLoader, type World } from './data';
import { EMBED_HEIGHTS, EMBED_HEIGHT_DEFAULT, EMBED_OPTS, embedCode, embedGame, embedPath, embedSrc, parseEmbed, readOpts, writeOpts, type EmbedWhat } from './embed';
import { setLang } from './i18n';
import { encodeList } from './lists';
import type { MapLink } from './maplink';
import { MODES } from './modes';
import { embeddable } from './rules';
import { DEFAULT_OPTS, type CustomList, type Opts } from './store';
import type { Section } from './types';

const opts = (patch: Partial<Opts> = {}): Opts => ({ ...DEFAULT_OPTS, ...patch });

describe('the options a game takes into another page', () => {
  it('are only those that are not how a game opens', () => {
    expect(writeOpts(DEFAULT_OPTS)).toBe('');
    expect(writeOpts(opts({ answer: 'choice' }))).toBe('answer=choice');
    expect(writeOpts(opts({ answer: 'choice', length: 20, suggest: true, labels: false, format: 'lives', countdown: 300 }))).toBe('answer=choice;length=20;suggest=1;countdown=300;labels=0;format=lives');
    // An option from before it existed is how it opens.
    const { turned: _, ...old } = DEFAULT_OPTS;
    expect(writeOpts(old as Opts)).toBe('');
  });

  it('leave out what is not the author\'s to give: the card of Wikipedia, and the cities, which go with the map', () => {
    expect(writeOpts(opts({ wiki: false, cityPick: 'caps', cityCount: 50 }))).toBe('');
    expect(EMBED_OPTS.wiki).toBe(false);
    expect(readOpts('').wiki).toBe(false);
    // Asking for it in the address does not turn it on.
    expect(readOpts('wiki=1').wiki).toBe(false);
    expect(readOpts('cityPick=caps;cityCount=50')).toEqual(EMBED_OPTS);
  });

  it('are read back as they were written', () => {
    const cases: Partial<Opts>[] = [
      {},
      { answer: 'choice', length: 10 },
      { length: 'endless', suggest: true },
      { pinBy: 'flag', flagLook: 'blur', labels: false },
      { format: 'exam', turned: true },
      { metric: 'density', axis: 'we' },
      { countdown: 600, blind: true, routeRule: 'via' },
      { cardAsk: 'capital', bearingAsk: 'dist', coordsAsk: 'read' },
      { pairOf: 'capital', pairs: 12, lessonSize: 3, lessonOrder: 'abc' },
    ];
    for (const patch of cases) expect(readOpts(writeOpts(opts(patch))), JSON.stringify(patch)).toEqual({ ...EMBED_OPTS, ...patch });
  });

  it('never make a game of two players of a box in another page', () => {
    // Not sent: whoever copies the code while that format is the one chosen gets a game like any other.
    expect(writeOpts(opts({ format: 'duo' }))).toBe('');
    expect(writeOpts(opts({ format: 'duo', answer: 'choice', turned: true }))).toBe('answer=choice;turned=1');
    // Nor read, from an address written by hand.
    expect(readOpts('format=duo')).toEqual(EMBED_OPTS);
    expect(readOpts('answer=choice;format=duo;turned=1')).toEqual({ ...EMBED_OPTS, answer: 'choice', turned: true });
    // The other formats travel as they did.
    expect(readOpts('format=exam').format).toBe('exam');
    expect(readOpts(writeOpts(opts({ format: 'timed' }))).format).toBe('timed');
  });

  it('take from an address only what each option can be', () => {
    expect(readOpts('answer=shout;length=7;suggest=yes;format=;pairs=9;countdown=99999;nothing=1;=3;;lessonOrder=zz')).toEqual(EMBED_OPTS);
    expect(readOpts('answer=choice;length=7;suggest=1;extra=x')).toEqual({ ...EMBED_OPTS, answer: 'choice', suggest: true });
    // The names of what every object has are not options.
    expect(readOpts('constructor=1;toString=1;__proto__=1')).toEqual(EMBED_OPTS);
    expect(readOpts('length=all')).toEqual(EMBED_OPTS);
    expect(readOpts('length=50').length).toBe(50);
  });
});

describe('the address of a game inside another page', () => {
  it('is that of its map and its game, after the word that says it is for a box', () => {
    expect(embedPath({ section: 'regions', link: { ids: ['ES', 'PT'], levels: { ES: 'p' }, mode: 'capital' } }, DEFAULT_OPTS)).toBe('incrustar/regiones/ES:p+PT/capital');
    expect(embedPath({ section: 'regions', link: { ids: ['ES'], levels: {}, mode: 'identify' } }, opts({ answer: 'choice', length: 20 }))).toBe('incrustar/regiones/ES/identify/answer=choice;length=20');
    expect(embedPath({ section: 'cities', link: { ids: ['FR'], levels: {}, mode: 'pin', cityPick: 'top', cityCount: 50 } }, opts({ cityPick: 'top', cityCount: 50 }))).toBe('incrustar/ciudades/FR/pin/top50');
    expect(embedPath({ section: 'physical', link: { ids: ['river', 'EU'], levels: {}, mode: 'pin' } }, DEFAULT_OPTS)).toBe('incrustar/fisica/river+EU/pin');
    expect(embedPath({ section: 'pops', link: { ids: ['ES', 'FR'], levels: {}, mode: 'hilo' } }, opts({ metric: 'area' }))).toBe('incrustar/poblaciones/ES+FR/hilo/metric=area');
    expect(embedPath({ list: 'AbC-_9', mode: 'pin' }, DEFAULT_OPTS)).toBe('incrustar/lista/AbC-_9/pin');
    expect(embedPath({ list: 'AbC-_9' }, opts({ suggest: true }))).toBe('incrustar/lista/AbC-_9/suggest=1');
  });

  it('is read back: the map, the game and the options', () => {
    const rest = (p: string) => p.replace(/^incrustar\//, '');
    const sources: { source: { section: Section; link: MapLink }; o: Opts }[] = [
      { source: { section: 'regions', link: { ids: ['ES', 'PT'], levels: { ES: 'p' }, mode: 'capital' } }, o: opts({ answer: 'choice' }) },
      { source: { section: 'cities', link: { ids: ['FR'], levels: {}, mode: 'pin', cityPick: 'caps' } }, o: DEFAULT_OPTS },
      { source: { section: 'physical', link: { ids: ['river', 'in:ES'], levels: {}, mode: 'identify' } }, o: opts({ length: 10, suggest: true }) },
      { source: { section: 'countries', link: { ids: ['ES', 'FR'], levels: {} } }, o: opts({ labels: false }) },
    ];
    for (const { source, o } of sources) {
      const read = parseEmbed(rest(embedPath(source, o)));
      expect(read).toEqual({ kind: 'map', section: source.section, link: source.link, opts: { ...o, wiki: false, cityPick: EMBED_OPTS.cityPick, cityCount: EMBED_OPTS.cityCount } });
    }
    expect(parseEmbed('lista/AbC-_9/pin/answer=choice')).toEqual({ kind: 'list', code: 'AbC-_9', mode: 'pin', opts: { ...EMBED_OPTS, answer: 'choice' } });
    expect(parseEmbed('lista/AbC-_9')).toEqual({ kind: 'list', code: 'AbC-_9', opts: EMBED_OPTS });
    // A section by another of its names.
    expect(parseEmbed('regions/ES/pin')).toEqual({ kind: 'map', section: 'regions', link: { ids: ['ES'], levels: {}, mode: 'pin' }, opts: EMBED_OPTS });
    expect(parseEmbed('Cifras/ES+FR/hilo')?.kind).toBe('map');
  });

  it('is nothing when it names neither a map nor a list', () => {
    for (const bad of ['', 'regiones', 'lista', 'regiones/', 'regiones//pin', 'nada/ES', 'regiones/es', 'regiones/ES/pin/top50', 'regiones/ES/pin/extra/more', 'lista/abc/pin/extra', 'lista/abc/PIN', 'jugar/ES', 'answer=choice', 'regiones/answer=choice']) {
      expect(parseEmbed(bad), bad).toBeNull();
    }
  });

  it('is written whole on the page of a language, so that it is read in it', () => {
    expect(embedSrc('incrustar/regiones/ES/pin', 'es', 'https://example.org/regionle/')).toBe('https://example.org/regionle/es.html#/incrustar/regiones/ES/pin');
    expect(embedSrc('incrustar/regiones/ES/pin', 'en', 'https://example.org/regionle/regiones.html#/regiones?x=1')).toBe('https://example.org/regionle/en.html#/incrustar/regiones/ES/pin');
  });
});

describe('the code that is pasted into the other page', () => {
  it('is a box with the address, a name for whoever cannot see it, and the height asked for', () => {
    const code = embedCode('https://example.org/regionle/es.html#/incrustar/regiones/ES/pin', 'Regionle: España · provincias · Señalar', 640);
    expect(code).toBe(
      '<iframe src="https://example.org/regionle/es.html#/incrustar/regiones/ES/pin" title="Regionle: España · provincias · Señalar" width="100%" height="640" style="border:0;max-width:100%" loading="lazy" allow="fullscreen; clipboard-write" allowfullscreen></iframe>',
    );
    expect(EMBED_HEIGHTS).toContain(EMBED_HEIGHT_DEFAULT);
    for (const h of EMBED_HEIGHTS) expect(embedCode('x', 'y', h)).toContain(`height="${h}"`);
  });

  it('cannot be broken out of by the name of a list', () => {
    const code = embedCode('https://example.org/#/incrustar/lista/abc', 'Regionle: "><script>alert(1)</script> & co', 480);
    expect(code).toContain('title="Regionle: &quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt; &amp; co"');
    expect(code.match(/<script/g)).toBeNull();
    // Seven things said of the box, each between its two quotes: none of them closed early.
    expect(code.match(/"/g)).toHaveLength(14);
  });
});

describe('the game an address asks for', () => {
  let world: World;
  beforeAll(async () => {
    setLang('es');
    setLoader(async (p) => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'public/data', p), 'utf8')));
    world = await loadIndex();
  });
  const map = (section: Section, link: Partial<MapLink> & { ids: string[] }, o: Opts = EMBED_OPTS): EmbedWhat => ({
    kind: 'map',
    section,
    link: { levels: {}, ...link },
    opts: o,
  });

  it('is the map and the game of the address, with its options', () => {
    const game = embedGame(map('regions', { ids: ['ES'], levels: { ES: 'f' }, mode: 'identify' }, { ...EMBED_OPTS, answer: 'choice' }), world)!;
    expect(game.cfg).toEqual({ section: 'regions', mode: 'identify', countries: ['ES'], levels: { ES: 'f' }, opts: { ...EMBED_OPTS, answer: 'choice' } });
    expect(game.title).toBe('España · provincias');
    expect(game.def.id).toBe('identify');
    expect(game.full).toBe('regiones/ES:f/identify');
    // The other level of the same country is another map.
    expect(embedGame(map('regions', { ids: ['ES'], levels: { ES: 'g1' }, mode: 'pin' }), world)!.title).toBe('España · comunidades autónomas');
  });

  it('takes only the countries the atlas has, with something to play in that section', () => {
    const some = embedGame(map('regions', { ids: ['ES', 'ZZ', 'PT'], levels: { ES: 'f', ZZ: 'f', PT: 'nope' }, mode: 'pin' }), world)!;
    expect(some.cfg.countries).toEqual(['ES', 'PT']);
    // A level the country does not have is left out: the map is drawn at the one it opens with.
    expect(some.cfg.levels).toEqual({ ES: 'f' });
    expect(some.full).toBe('regiones/ES:f+PT/pin');
    expect(embedGame(map('regions', { ids: ['ZZ'], mode: 'pin' }), world)).toBeNull();
    // The Vatican has no regions to ask about.
    expect(embedGame(map('regions', { ids: ['VA'], mode: 'pin' }), world)).toBeNull();
    expect(embedGame(map('countries', { ids: ['VA', 'IT'], mode: 'pin' }), world)!.cfg.countries).toEqual(['VA', 'IT']);
  });

  it('plays the first game of the section when the address names none, or one that is not played', () => {
    const first = MODES.regions.filter((m) => embeddable(m.id))[0].id;
    expect(embedGame(map('regions', { ids: ['ES'] }), world)!.def.id).toBe(first);
    expect(embedGame(map('regions', { ids: ['ES'], mode: 'nothing' }), world)!.def.id).toBe(first);
    expect(embedGame(map('regions', { ids: ['ES'], mode: 'print' }), world)!.def.id).toBe(first);
    // A game of another section is not one of this.
    expect(MODES.regions.some((m) => m.id === 'connect')).toBe(false);
    expect(embedGame(map('regions', { ids: ['ES'], mode: 'connect' }), world)!.def.id).toBe(first);
    expect(embedGame(map('pops', { ids: ['ES', 'FR'], mode: 'connect' }), world)!.def.id).toBe('connect');
  });

  it('plays the cities the address says, and a physical map by its words', () => {
    const cities = embedGame(map('cities', { ids: ['FR'], mode: 'pin', cityPick: 'top', cityCount: 50 }), world)!;
    expect(cities.cfg.opts).toMatchObject({ cityPick: 'top', cityCount: 50 });
    expect(cities.full).toBe('ciudades/FR/pin/top50');
    expect(embedGame(map('cities', { ids: ['FR'], mode: 'pin', cityPick: 'caps' }), world)!.cfg.opts.cityPick).toBe('caps');
    const rivers = embedGame(map('physical', { ids: ['river', 'EU', 'in:ZZ'], mode: 'pin' }), world)!;
    expect(rivers.cfg.countries).toEqual(['river', 'EU']);
    expect(rivers.title).toBe('Ríos · Europa');
    // Somewhere with nothing to look for is no map.
    expect(embedGame(map('physical', { ids: ['EU'], mode: 'pin' }), world)).toBeNull();
  });

  it('plays a list: its map, and its pieces alone', () => {
    const list: CustomList = { id: 'l1', name: 'Las del jueves', section: 'regions', countries: ['ES'], levels: { ES: 'f' }, ids: ['ES-M', 'ES-B', 'ES-V'] };
    const code = encodeList(list);
    const game = embedGame({ kind: 'list', code, mode: 'identify', opts: { ...EMBED_OPTS, suggest: true } }, world)!;
    expect(game.cfg).toMatchObject({ section: 'regions', mode: 'identify', countries: ['ES'], levels: { ES: 'f' }, only: ['ES-M', 'ES-B', 'ES-V'], list: 'Las del jueves' });
    expect(game.cfg.opts.suggest).toBe(true);
    expect(game.title).toBe('Las del jueves');
    expect(game.full).toBe(`lista/${code}`);
    // A game that is not played with a list gives way to the first that is.
    const route = embedGame({ kind: 'list', code, mode: 'travel', opts: EMBED_OPTS }, world)!;
    expect(route.def.id).not.toBe('travel');
    expect(route.cfg.only).toEqual(['ES-M', 'ES-B', 'ES-V']);
    expect(embedGame({ kind: 'list', code, opts: EMBED_OPTS }, world)!.def.id).toBe(route.def.id);
    // A list without a name still has one to show.
    expect(embedGame({ kind: 'list', code: encodeList({ ...list, name: '' }), opts: EMBED_OPTS }, world)!.title).toBe('Lista sin nombre');
    // A code that is not one, or a list of a country that is not there.
    expect(embedGame({ kind: 'list', code: 'not-a-list', opts: EMBED_OPTS }, world)).toBeNull();
    expect(embedGame({ kind: 'list', code: encodeList({ ...list, countries: ['ZZ'], levels: {} }), opts: EMBED_OPTS }, world)).toBeNull();
  });
});
