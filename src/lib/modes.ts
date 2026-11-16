/** Catalogue of sections and game modes shown in the menus. */
import { ArrowUpDown, CircleHelp, Compass, Flag, Hash, Keyboard, Landmark, ListOrdered, MapPin, Route, ScanSearch, Shapes, type LucideIcon } from 'lucide-react';
import type { Mode, Section } from './types';

export interface ModeDef {
  id: Mode;
  name: string;
  desc: string;
  icon: LucideIcon;
  /** 1 easy … 3 hard */
  level: 1 | 2 | 3;
}

const explore: ModeDef = { id: 'explore', name: 'Explorar', desc: 'Sin preguntas: recorre el mapa con nombres, datos y enlaces para estudiar.', icon: Compass, level: 1 };
const pin: ModeDef = { id: 'pin', name: 'Señalar', desc: 'Te damos un nombre y lo buscas en el mapa.', icon: MapPin, level: 1 };
const identify: ModeDef = { id: 'identify', name: 'Identificar', desc: 'Se ilumina una zona del mapa y dices cuál es.', icon: ScanSearch, level: 2 };
const nameall: ModeDef = { id: 'nameall', name: 'Nombrarlas todas', desc: 'Escribe todos los nombres de memoria mientras el mapa se llena.', icon: Keyboard, level: 3 };
const outline: ModeDef = { id: 'outline', name: 'Silueta', desc: 'Reconócelas solo por su forma, sin mapa alrededor.', icon: Shapes, level: 3 };
const travel: ModeDef = { id: 'travel', name: 'Ruta', desc: 'Une dos puntos del mapa pasando por las menos fronteras posibles.', icon: Route, level: 3 };

export const MODES: Record<Section, ModeDef[]> = {
  regions: [explore, pin, identify, nameall, outline, travel],
  countries: [
    explore,
    pin,
    identify,
    { ...nameall, name: 'Nombrarlos todos' },
    outline,
    { id: 'capital', name: 'Capitales', desc: 'De cada país, su capital.', icon: Landmark, level: 2 },
    { id: 'flag', name: 'Banderas', desc: '¿De qué país es cada bandera?', icon: Flag, level: 2 },
    travel,
  ],
  pops: [
    { id: 'hilo', name: 'Mayor o menor', desc: 'Compara cada país con el anterior y encadena aciertos.', icon: ArrowUpDown, level: 1 },
    { id: 'rank', name: 'Ordena cinco', desc: 'Cinco países, de mayor a menor.', icon: ListOrdered, level: 2 },
    { id: 'exact', name: 'Cifra exacta', desc: 'Escribe la cifra: cuanto más te acerques, mejor.', icon: Hash, level: 3 },
    { id: 'which', name: '¿Qué país?', desc: 'Te damos la cifra y adivinas el país con pistas de más y menos.', icon: CircleHelp, level: 3 },
  ],
};

export const MODE_NAME: Record<Mode, string> = {
  explore: 'Explorar',
  pin: 'Señalar',
  identify: 'Identificar',
  nameall: 'Nombrar todo',
  outline: 'Silueta',
  travel: 'Ruta',
  capital: 'Capitales',
  flag: 'Banderas',
  hilo: 'Mayor o menor',
  rank: 'Ordena cinco',
  exact: 'Cifra exacta',
  which: '¿Qué país?',
};

export const SECTIONS: Record<Section, { path: string; name: string; title: string; blurb: string }> = {
  regions: {
    path: 'regiones',
    name: 'Regiones',
    title: 'Regiones, provincias y estados',
    blurb: 'Las divisiones internas de los países que elijas, todas juntas en un mismo mapa.',
  },
  countries: {
    path: 'paises',
    name: 'Países',
    title: 'Países, capitales y banderas',
    blurb: 'Sitúa, nombra y reconoce los países del mundo o solo los que te interesen.',
  },
  pops: {
    path: 'poblaciones',
    name: 'Cifras',
    title: 'Población y superficie',
    blurb: 'Compara, ordena y afina las cifras de cada país.',
  },
};
