/**
 * The album of flags: a page for each continent with a place for the flag of each of its countries, which
 * is filled when the flag is learnt (right first time twice in a row, as everywhere else). A flag that has
 * gone in stays: the game keeps which ones have (`album` in the store), so that one missed later is not
 * taken out.
 */
import { getLang, nm } from './i18n';
import { isLearnt, type FlagAlbum, type Stat } from './store';
import type { Index } from './types';

export interface Sticker {
  id: string;
  name: string;
  /** Code of its flag. */
  flag: string;
  /** The flag has been learnt: it is in the album. */
  got: boolean;
}

export interface AlbumPage {
  /** Code of the continent, or "other" for what is not a member state of the UN. */
  id: string;
  name: string;
  stickers: Sticker[];
  got: number;
}

/** The page of the territories that are not member states: dependencies, observers and the partly recognised. */
export const OTHER_PAGE = 'other';

export interface Album {
  /** The continents with member states, in the order the game lists them, and the other territories last. */
  pages: AlbumPage[];
  /** Flags of member states learnt, of how many. */
  got: number;
  total: number;
}

/**
 * `kept` is what has gone in so far; a flag learnt in `stats` counts as well, whether or not it has been
 * written down yet. `otherName` names the last page, which no continent does. A territory without a flag
 * of its own has no place in the album.
 */
export function albumOf(index: Index, kept: FlagAlbum, stats: Record<string, Stat>, otherName: string): Album {
  const sort = (list: Sticker[]) => list.sort((a, b) => a.name.localeCompare(b.name, getLang()));
  const pages = new Map<string, AlbumPage>();
  for (const [id, name] of Object.entries(index.continents)) pages.set(id, { id, name: nm(name), stickers: [], got: 0 });
  const other: AlbumPage = { id: OTHER_PAGE, name: otherName, stickers: [], got: 0 };
  for (const c of index.countries) {
    if (!c.fl) continue;
    const page = c.cl === 'un' ? pages.get(c.ct) : other;
    if (!page) continue;
    const got = !!kept[c.id] || isLearnt(stats[`flag:${c.id}`]);
    page.stickers.push({ id: c.id, name: nm(c.n), flag: c.fl, got });
    if (got) page.got++;
  }
  const members = [...pages.values()].filter((p) => p.stickers.length);
  for (const p of [...members, other]) sort(p.stickers);
  return {
    pages: other.stickers.length ? [...members, other] : members,
    got: members.reduce((n, p) => n + p.got, 0),
    total: members.reduce((n, p) => n + p.stickers.length, 0),
  };
}

/** The flags of a page still to be learnt. */
export const missingOf = (page: AlbumPage): string[] => page.stickers.filter((s) => !s.got).map((s) => s.id);
