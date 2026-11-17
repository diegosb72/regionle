/** What a game can be played as. Kept apart from the menus, which bring their icons: the saved state asks too. */
import type { Mode } from './types';

/** Games that can also be played against the clock or until the lives run out. */
export const FORMAT_MODES: readonly Mode[] = ['pin', 'identify', 'outline', 'puzzle', 'capital', 'flag'];
