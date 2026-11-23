/**
 * What each figure is called and how its order is said: all that the first page and the progress page need
 * of them. The rest (how each is written, what is asked about it, the games) is `figures.ts`, which comes
 * with the games.
 */
import { L } from './i18n';

/**
 * What The World Factbook says of a country, beyond its people and its size (scripts/data/figures.mjs): how
 * long people live there, what each makes in a year, how old they are, how many live in towns, how many
 * children a woman has, how long the coast is and how high the highest point stands.
 */
export const BOOK_FIGS = ['life', 'gdp', 'age', 'urban', 'fert', 'coast', 'high'] as const;
export type BookFig = (typeof BOOK_FIGS)[number];
export const isBookFig = (x: unknown): x is BookFig => (BOOK_FIGS as readonly unknown[]).includes(x);

/** The figure the games of countries can be about. */
export type CountryFig = 'pop' | 'area' | 'density' | BookFig;
export const COUNTRY_FIGS: readonly CountryFig[] = ['pop', 'area', 'density', ...BOOK_FIGS];

export type MetricId = 'pop' | 'area' | 'density' | 'elev' | 'lat' | 'lon' | BookFig;

/** "población" */
export function metricNoun(id: MetricId): string {
  switch (id) {
    case 'pop':
      return L('población', 'population');
    case 'area':
      return L('superficie', 'area');
    case 'density':
      return L('densidad de población', 'population density');
    case 'elev':
      return L('altitud', 'height');
    case 'lat':
      return L('latitud', 'latitude');
    case 'lon':
      return L('longitud', 'longitude');
    case 'life':
      return L('esperanza de vida', 'life expectancy');
    case 'gdp':
      return L('PIB por habitante', 'GDP per head');
    case 'age':
      return L('edad mediana', 'median age');
    case 'urban':
      return L('población urbana', 'urban population');
    case 'fert':
      return L('fecundidad', 'fertility');
    case 'coast':
      return L('longitud de costa', 'length of coast');
    case 'high':
      return L('altitud máxima', 'highest point');
  }
}

/** How five of them are put in order: "de más a menos habitantes". */
export function metricOrder(id: MetricId): string {
  switch (id) {
    case 'pop':
      return L('de más a menos habitantes', 'from most to fewest people');
    case 'area':
      return L('de mayor a menor superficie', 'from largest to smallest');
    case 'density':
      return L('de mayor a menor densidad', 'from most to least densely populated');
    case 'elev':
      return L('de mayor a menor altitud', 'from highest to lowest');
    case 'lat':
      return L('de norte a sur', 'from north to south');
    case 'lon':
      return L('de oeste a este', 'from west to east');
    case 'life':
      return L('de mayor a menor esperanza de vida', 'from longest to shortest life expectancy');
    case 'gdp':
      return L('de mayor a menor PIB por habitante', 'from highest to lowest GDP per head');
    case 'age':
      return L('de mayor a menor edad mediana', 'from highest to lowest median age');
    case 'urban':
      return L('de más a menos población urbana', 'from most to least urban');
    case 'fert':
      return L('de más a menos hijos por mujer', 'from most to fewest children per woman');
    case 'coast':
      return L('de más a menos costa', 'from longest to shortest coast');
    case 'high':
      return L('de mayor a menor altitud máxima', 'from the highest top to the lowest');
  }
}
