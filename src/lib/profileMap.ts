/**
 * Where a country is, for its sheet (screens/FlagProfile.tsx). Apart from the rest of what a sheet needs
 * (lib/profiles.ts), which the gallery reads to know which countries have one: the gallery draws no map,
 * and should not bring what draws them.
 */
import { geoOrthographic, geoPath } from 'd3-geo';
import type { Geo } from './types';

/**
 * Where a country is, drawn on the half of the globe that has it in the middle: the outline of the globe,
 * the land of every other country as one shape and its own, inside a square of `size`.
 */
export function locator(world: ReadonlyMap<string, Geo>, id: string, at: readonly [number, number], size: number): { globe: string; land: string; own: string } | null {
  const mine = world.get(id);
  if (!mine) return null;
  const projection = geoOrthographic()
    .rotate([-at[0], -at[1] * 0.6])
    .clipAngle(90)
    .precision(0.5)
    .fitExtent(
      [
        [1, 1],
        [size - 1, size - 1],
      ],
      { type: 'Sphere' },
    );
  const draw = geoPath(projection).digits(1);
  const others = [...world].filter(([key]) => key !== id).map(([, geo]) => geo);
  return {
    globe: draw({ type: 'Sphere' }) ?? '',
    land: draw({ type: 'FeatureCollection', features: others }) ?? '',
    own: draw(mine) ?? '',
  };
}
