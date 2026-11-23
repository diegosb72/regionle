/** The map a game is played on, built from its configuration. */
import { buildDeck, loadIndex } from './data';
import { buildCityDeck, buildPhysicalDeck } from './extra';
import { FACT_EXTRAS, factOf } from './rules';
import type { GameConfig } from './store';
import type { Deck, Facts } from './types';

/**
 * What is said of the countries besides their figures (lib/facts.ts), for the map of a game that asks about
 * it or shows it: undefined for any other game, which fetches neither the file nor the code. A game about one
 * of those things cannot start without them; one that only shows them beside what it asks goes on as it was.
 */
async function factsFor(cfg: GameConfig): Promise<Facts | undefined> {
  if (cfg.section !== 'countries') return undefined;
  const needed = factOf(cfg.section, cfg.mode, cfg.opts) != null;
  if (!needed && !FACT_EXTRAS.includes(cfg.mode)) return undefined;
  const coming = import('./facts').then((m) => m.loadFacts());
  return needed ? coming : coming.catch(() => undefined);
}

/** The deck a configuration asks for, whatever its section. */
export async function deckFor(cfg: GameConfig, onProgress?: (done: number, total: number) => void): Promise<Deck> {
  const [deck, facts] = await Promise.all([mapFor(cfg, onProgress), factsFor(cfg)]);
  return facts ? { ...deck, facts } : deck;
}

async function mapFor(cfg: GameConfig, onProgress?: (done: number, total: number) => void): Promise<Deck> {
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
  if (cfg.section === 'cities') return buildCityDeck(countries, cfg.opts.cityPick, cfg.opts.cityCount, must, cfg.mode === 'parent' || cfg.mode === 'group' || cfg.mode === 'whoami');
  if (cfg.section === 'physical') return buildPhysicalDeck(countries, must, listed && !cfg.review);
  return buildDeck({ scope: cfg.section === 'regions' ? 'regions' : 'countries', countries, levels: cfg.levels }, onProgress);
}
