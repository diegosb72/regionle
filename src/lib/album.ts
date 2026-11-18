/**
 * The album of flags: a page for each continent with a place for the flag of each of its countries, which
 * is filled when the flag is learnt (right first time twice in a row, as everywhere else). Nothing is
 * kept for it: it is read from the answers.
 */
import { getLang, nm } from './i18n';
import { isLearnt, type Stat } from './store';
import type { Index } from './types';

export interface Sticker {
  id: string;
  name: string;
  /** Code of its flag. */
  flag: string;
  /** The flag is learnt: it is in the album. */
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
 * `otherName` names the last page, which no continent does. A territory without a flag of its own has no
 * place in the album.
 */
export function albumOf(index: Index, stats: Record<string, Stat>, otherName: string): Album {
  const sort = (list: Sticker[]) => list.sort((a, b) => a.name.localeCompare(b.name, getLang()));
  const pages = new Map<string, AlbumPage>();
  for (const [id, name] of Object.entries(index.continents)) pages.set(id, { id, name: nm(name), stickers: [], got: 0 });
  const other: AlbumPage = { id: OTHER_PAGE, name: otherName, stickers: [], got: 0 };
  for (const c of index.countries) {
    if (!c.fl) continue;
    const page = c.cl === 'un' ? pages.get(c.ct) : other;
    if (!page) continue;
    const got = isLearnt(stats[`flag:${c.id}`]);
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
