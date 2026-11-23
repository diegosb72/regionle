/**
 * What The World Factbook says of each country (public/data/figures.json, written by
 * scripts/data/figures.mjs): seven figures that the games of figures can be about. They are in a file of
 * their own, fetched only where they are needed, so that the first page does not pay for them.
 */
import type { BookFig } from './metricNames';
import { loadFile } from './world';

/** The figures of one country: only the ones it has. `y`: the year of those that are not of the usual year. */
export type BookRec = Partial<Record<BookFig, number>> & { y?: Partial<Record<BookFig, number>> };

export interface BookFile {
  /** The year most countries have each figure of. A coast and a summit are of no year. */
  y: Partial<Record<BookFig, number>>;
  /** The countries that have some figure, by their id. */
  c: Record<string, BookRec>;
}

export const loadBook = (): Promise<BookFile> => loadFile<BookFile>('figures.json');

/** A figure of a country; 0 when the book does not give it (no figure of these is ever nothing). */
export function bookValue(book: BookFile | null | undefined, id: string, fig: BookFig): number {
  const v = book?.c[id]?.[fig];
  return typeof v === 'number' && v > 0 ? v : 0;
}

/** The year a figure of a country is of: its own where it has one, the usual one where not. */
export function bookYear(book: BookFile, id: string, fig: BookFig): number | undefined {
  return book.c[id]?.y?.[fig] ?? book.y[fig];
}

/** How many of these countries have the figure. */
export function bookCount(book: BookFile, ids: readonly string[], fig: BookFig): number {
  return ids.filter((id) => bookValue(book, id, fig) > 0).length;
}
