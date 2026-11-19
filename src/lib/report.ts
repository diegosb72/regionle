/**
 * "Avisar de un error": a mistake in the data — a capital that is not, a city on the wrong side of a border,
 * a name misspelt — is told by opening an issue in the repository of the game, already filled in with what
 * the report is about: the piece, the map and the game it was seen in, the version and the language. The
 * game has no server of its own to take reports, and this way they are public and can be followed.
 */
import { L, getLang } from './i18n';
import type { Item } from './types';

export const REPO = 'https://github.com/diegosb72/regionle';

/** What is known about where the mistake was seen. */
export interface ReportAbout {
  item?: Pick<Item, 'id' | 'name' | 'kind' | 'type' | 'country' | 'cat'> | null;
  /** The game in course, as the store keeps it. */
  game?: { section: string; mode: string; countries: string[]; levels: Record<string, string> } | null;
  version: string;
}

/** The lines that say what the report is about, for whoever reads it: ids, not names that change with the language. */
export function reportFacts({ item, game, version }: ReportAbout): string[] {
  const lines: string[] = [];
  if (item) {
    const kind = item.kind === 'feature' ? (item.cat ?? item.type) : item.type;
    lines.push(`${L('Pieza', 'Piece')}: ${item.name} · \`${item.id}\` · ${kind}${item.kind !== 'country' && item.country?.id ? ` (${item.country.id})` : ''}`);
  }
  if (game) {
    // A map of half the world is said by how many countries it has: the address must stay short.
    const countries = game.countries.length > 12 ? `${game.countries.slice(0, 12).join(' ')} … (${game.countries.length})` : game.countries.join(' ');
    const levels = game.countries
      .filter((id) => game.levels[id])
      .slice(0, 12)
      .map((id) => `${id}:${game.levels[id]}`)
      .join(' ');
    lines.push(`${L('Mapa', 'Map')}: \`${game.section}\` · ${countries}${levels ? ` · ${levels}` : ''}`);
    lines.push(`${L('Juego', 'Game')}: \`${game.mode}\``);
  }
  lines.push(`${L('Versión', 'Version')}: ${version} · ${L('idioma', 'language')}: ${getLang()}`);
  return lines;
}

/** The title an issue opens with. */
export function reportTitle(item?: ReportAbout['item']): string {
  return item ? L(`Error en los datos: ${item.name} (${item.id})`, `Mistake in the data: ${item.name} (${item.id})`) : L('Error en el juego: ', 'Mistake in the game: ');
}

/** The text an issue opens with: room for what is wrong, and under it what the game knows. */
export function reportBody(about: ReportAbout): string {
  return [
    L('**Qué está mal** (lo que dice el juego y lo que debería decir; si puedes, con una fuente):', '**What is wrong** (what the game says and what it should say; with a source, if you can):'),
    '',
    '',
    '',
    '---',
    ...reportFacts(about),
  ].join('\n');
}

/** The address that opens a new issue in the repository, filled in. */
export function reportUrl(about: ReportAbout): string {
  const q = encodeURIComponent;
  return `${REPO}/issues/new?title=${q(reportTitle(about.item))}&body=${q(reportBody(about))}`;
}
