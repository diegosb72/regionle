import fs from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { OTHER_PAGE, albumOf, missingOf } from './album';
import { setLang } from './i18n';
import type { Stat } from './store';
import type { Index } from './types';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;
/** Right first time twice in a row: learnt. */
const LEARNT: Stat = [2, 2, 2, 1];

describe('the album of flags', () => {
  beforeAll(() => setLang('es'));

  it('has a page for each continent with member states, and one for the other territories', () => {
    const album = albumOf(index, {}, 'Otros territorios');
    expect(album.pages.map((p) => [p.id, p.name, p.stickers.length])).toEqual([
      ['EU', 'Europa', 44],
      ['AS', 'Asia', 46],
      ['AF', 'África', 54],
      ['AM', 'América', 35],
      ['OC', 'Oceanía', 14],
      [OTHER_PAGE, 'Otros territorios', 56],
    ]);
    // The 193 member states of the UN, none of them yet.
    expect(album.total).toBe(193);
    expect(album.got).toBe(0);
    // Every place has a flag to put in it, and no country is on two pages.
    const all = album.pages.flatMap((p) => p.stickers);
    expect(all.every((s) => s.flag && s.name)).toBe(true);
    expect(new Set(all.map((s) => s.id)).size).toBe(all.length);
  });

  it('lists each page by name, as the language in use sorts them', () => {
    const europe = albumOf(index, {}, 'Otros').pages[0].stickers.map((s) => s.name);
    expect(europe.slice(0, 4)).toEqual(['Albania', 'Alemania', 'Andorra', 'Austria']);
    // An accent does not send a name to the end.
    const africa = albumOf(index, {}, 'Otros').pages[2].stickers.map((s) => s.name);
    expect(africa.indexOf('Túnez')).toBeLessThan(africa.indexOf('Uganda'));
    setLang('en');
    expect(albumOf(index, {}, 'Other').pages[0].stickers.map((s) => s.name).slice(0, 3)).toEqual(['Albania', 'Andorra', 'Austria']);
    expect(albumOf(index, {}, 'Other').pages[0].name).toBe('Europe');
    setLang('es');
  });

  it('fills a place when its flag is learnt, and only then', () => {
    const stats: Record<string, Stat> = {
      'flag:ES': LEARNT,
      'flag:FR': LEARNT,
      // Seen and right once: not yet.
      'flag:DE': [1, 1, 1, 1],
      // Learnt and missed since: the run starts again.
      'flag:IT': [5, 3, 0, 1],
      // Knowing where it is does not put its flag in the album.
      'loc:PT': LEARNT,
      'flag:JP': LEARNT,
      // A territory counts on its page, not among the member states.
      'flag:GL': LEARNT,
    };
    const album = albumOf(index, stats, 'Otros territorios');
    expect(album.got).toBe(3);
    const page = (id: string) => album.pages.find((p) => p.id === id)!;
    expect(page('EU').got).toBe(2);
    expect(page('EU').stickers.filter((s) => s.got).map((s) => s.id)).toEqual(['ES', 'FR']);
    expect(page('AS').got).toBe(1);
    expect(page(OTHER_PAGE).got).toBe(1);
    expect(page(OTHER_PAGE).stickers.find((s) => s.id === 'GL')!.got).toBe(true);
    expect(missingOf(page('EU'))).toHaveLength(42);
    expect(missingOf(page('EU'))).not.toContain('ES');
    expect(missingOf(page('EU'))).toContain('DE');
  });
});
