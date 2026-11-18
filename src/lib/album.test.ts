import fs from 'node:fs';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { OTHER_PAGE, albumOf, missingOf } from './album';
import { setLang } from './i18n';
import { ALBUM_MAX, cleanAlbum, isLearnt, mergeSaved, useStore, withFlags, type Stat } from './store';
import type { Index } from './types';

const index = JSON.parse(fs.readFileSync('public/data/index.json', 'utf8')) as Index;
/** Right first time twice in a row: learnt. */
const LEARNT: Stat = [2, 2, 2, 1];

describe('the album of flags', () => {
  beforeAll(() => setLang('es'));

  it('has a page for each continent with member states, and one for the other territories', () => {
    const album = albumOf(index, {}, {}, 'Otros territorios');
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
    const europe = albumOf(index, {}, {}, 'Otros').pages[0].stickers.map((s) => s.name);
    expect(europe.slice(0, 4)).toEqual(['Albania', 'Alemania', 'Andorra', 'Austria']);
    // An accent does not send a name to the end.
    const africa = albumOf(index, {}, {}, 'Otros').pages[2].stickers.map((s) => s.name);
    expect(africa.indexOf('Túnez')).toBeLessThan(africa.indexOf('Uganda'));
    setLang('en');
    expect(albumOf(index, {}, {}, 'Other').pages[0].stickers.map((s) => s.name).slice(0, 3)).toEqual(['Albania', 'Andorra', 'Austria']);
    expect(albumOf(index, {}, {}, 'Other').pages[0].name).toBe('Europe');
    setLang('es');
  });

  it('fills a place when its flag is learnt, and only then', () => {
    const stats: Record<string, Stat> = {
      'flag:ES': LEARNT,
      'flag:FR': LEARNT,
      // Seen and right once: not yet.
      'flag:DE': [1, 1, 1, 1],
      // Missed twice after two right in a row, with nothing kept about it: these answers alone do not say it was learnt.
      'flag:IT': [5, 3, 0, 1],
      // Knowing where it is does not put its flag in the album.
      'loc:PT': LEARNT,
      'flag:JP': LEARNT,
      // A territory counts on its page, not among the member states.
      'flag:GL': LEARNT,
    };
    const album = albumOf(index, {}, stats, 'Otros territorios');
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

  it('keeps a flag that went in, even when it is missed afterwards', () => {
    // Italy went into the album and has been missed since; Greece is in it with no answer left about it.
    const kept = { IT: 1_700_000_000_000, GR: 1_700_000_000_000 };
    const album = albumOf(index, kept, { 'flag:IT': [5, 3, 0, 1], 'flag:ES': LEARNT }, 'Otros territorios');
    const europe = album.pages[0];
    expect(europe.stickers.filter((s) => s.got).map((s) => s.id)).toEqual(['ES', 'GR', 'IT']);
    expect(album.got).toBe(3);
    expect(missingOf(europe)).not.toContain('IT');
  });
});

describe('what the game keeps of the album', () => {
  const state = () => useStore.getState();
  beforeEach(() => useStore.setState({ stats: {}, where: {}, album: {} }));

  it('takes a flag in when it is learnt, and leaves it there when it is missed', () => {
    state().record('flag', 'FR', 'ok', 'c');
    expect(state().album).toEqual({});
    state().record('flag', 'FR', 'ok', 'c');
    const at = state().album.FR;
    expect(at).toBeGreaterThan(0);
    // Missed: the answer is no longer learnt, the flag stays in the album with the date it went in.
    state().record('flag', 'FR', 'bad', 'c');
    expect(isLearnt(state().stats['flag:FR'])).toBe(false);
    state().record('flag', 'FR', 'ok', 'c');
    state().record('flag', 'FR', 'ok', 'c');
    expect(state().album).toEqual({ FR: at });
    // Only flags: the capital of France, learnt, is no flag.
    state().record('cap', 'DE', 'ok', 'c');
    state().record('cap', 'DE', 'ok', 'c');
    expect(Object.keys(state().album)).toEqual(['FR']);
  });

  it('starts, for whoever played before, with the flags that are learnt', () => {
    const stats: Record<string, Stat> = { 'flag:ES': [3, 3, 3, 1_700_000_000_000], 'flag:DE': [1, 1, 1, 5], 'loc:PT': LEARNT, 'flag:IT': [5, 3, 0, 9] };
    expect(withFlags({}, stats)).toEqual({ ES: 1_700_000_000_000 });
    // What was in stays as it was, and nothing is copied when there is nothing to add.
    const album = { ES: 7, IT: 8 };
    expect(withFlags(album, stats)).toBe(album);
    // Read from the browser: the stored album and what the stored answers add to it.
    const merged = mergeSaved({ stats, album: { IT: 8, bad: 'x', '': 3 } }, state());
    expect(merged.album).toEqual({ IT: 8, ES: 1_700_000_000_000 });
    expect(mergeSaved({ stats }, state()).album).toEqual({ ES: 1_700_000_000_000 });
    expect(mergeSaved({}, state()).album).toEqual({});
  });

  it('travels with the backup and goes with the progress', () => {
    const backup = { stats: { 'flag:JP': [2, 2, 2, 50] }, sessions: [], album: { IT: 8 } };
    expect(state().importData(backup)).toBe(true);
    expect(state().album).toEqual({ IT: 8, JP: 50 });
    // A copy from before the album brings the flags its answers have learnt.
    expect(state().importData({ stats: { 'flag:JP': [2, 2, 2, 50] }, sessions: [] })).toBe(true);
    expect(state().album).toEqual({ JP: 50 });
    state().resetProgress();
    expect(state().album).toEqual({});
  });

  it('does not grow without end, and takes nothing that is not a date', () => {
    const many = Object.fromEntries(Array.from({ length: ALBUM_MAX + 50 }, (_, i) => [`X${i}`, i + 1]));
    expect(Object.keys(cleanAlbum(many))).toHaveLength(ALBUM_MAX);
    expect(cleanAlbum({ ES: 5, FR: -1, DE: 'x', IT: Number.NaN, toolongtobeanidofacountry: 4 })).toEqual({ ES: 5 });
    expect(cleanAlbum(null)).toEqual({});
    expect(cleanAlbum([1, 2])).toEqual({});
    const full = Object.fromEntries(Array.from({ length: ALBUM_MAX }, (_, i) => [`X${i}`, i + 1]));
    expect(withFlags(full, { 'flag:ES': LEARNT })).toBe(full);
  });
});
