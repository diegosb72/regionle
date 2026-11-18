/** The map a game is played on, built from its configuration. */
import { buildDeck, loadIndex } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import type { GameConfig } from './store';
import type { Deck } from './types';

/** The deck a configuration asks for, whatever its section. */
export async function deckFor(cfg: GameConfig, onProgress?: (done: number, total: number) => void): Promise<Deck> {
  let countries = cfg.countries;
  // A review of countries or of capitals is played on the whole of their continents, not among the few that are due.
  if (cfg.review && (cfg.section === 'countries' || (cfg.section === 'cities' && cfg.opts.cityPick === 'caps'))) {
    const { index, byId } = await loadIndex();
    const mine = new Set(countries);
    const continents = new Set(countries.map((id) => byId.get(id)?.ct));
    countries = index.countries.filter((c) => mine.has(c.id) || (c.cl === 'un' && continents.has(c.ct))).map((c) => c.id);
  }
  // A review and a custom list are about given pieces: the map has to hold them whatever else it shows.
  const listed = !!cfg.list || cfg.mode === 'edit';
  const must = cfg.review || listed ? cfg.only : undefined;
  if (cfg.section === 'cities') return buildCityDeck(countries, cfg.opts.cityPick, cfg.opts.cityCount, must, cfg.mode === 'parent');
  if (cfg.section === 'physical') return buildPhysicalDeck(countries, must, listed && !cfg.review);
  return buildDeck({ scope: cfg.section === 'regions' ? 'regions' : 'countries', countries, levels: cfg.levels }, onProgress);
}
