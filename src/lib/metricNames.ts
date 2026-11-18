/**
 * What each figure is called and how its order is said: all that the first page and the progress page need
 * of them. The rest (how each is written, what is asked about it, the games) is `figures.ts`, which comes
 * with the games.
 */
import { L } from './i18n';

export type MetricId = 'pop' | 'area' | 'density' | 'elev' | 'lat' | 'lon';

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
  }
}
