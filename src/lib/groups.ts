/**
 * Groups of countries offered as shortcuts by the picker: one click chooses them all.
 *
 * Organisations change their members: the lists are as they stood at the start of 2026 (Bulgaria in the
 * euro area since January 2026, Bulgaria and Romania wholly in the Schengen area since 2025, Sweden in
 * NATO since 2024, Indonesia in the BRICS since 2025). They are kept by hand, here and nowhere else.
 */
import { L } from './i18n';
import type { Country } from './types';

const ids = (codes: string): string[] => codes.split(' ');

export const EU = ids('AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE');
export const SPANISH = ids('ES MX GT HN SV NI CR PA CU DO PR CO VE EC PE BO CL AR UY PY GQ');
export const G20 = ids('AR AU BR CA CN DE FR GB ID IN IT JP KR MX RU SA TR US ZA');
export const NATO = ids('AL BE BG CA HR CZ DK EE FI FR DE GR HU IS IT LV LT LU ME NL MK NO PL PT RO SK SI ES SE TR GB US');
/** The members of the Union but Ireland and Cyprus, with Iceland, Liechtenstein, Norway and Switzerland. */
export const SCHENGEN = ids('AT BE BG HR CZ DK EE FI FR DE GR HU IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH');
export const EUROZONE = ids('AT BE BG HR CY EE FI FR DE GR IE IT LV LT LU MT NL PT SK SI ES');
export const BRICS = ids('BR RU IN CN ZA EG ET IR AE ID');
export const ARAB_LEAGUE = ids('DZ BH KM DJ EG IQ JO KW LB LY MR MA OM PS QA SA SO SD SY TN AE YE');
export const USSR = ids('RU UA BY MD EE LV LT GE AM AZ KZ UZ TM KG TJ');
export const YUGOSLAVIA = ids('SI HR BA RS ME MK XK');
/** Community of Portuguese Language Countries. */
export const PORTUGUESE = ids('PT BR AO MZ CV GW ST TL GQ');
/** Countries with a coast on the Mediterranean. */
export const MEDITERRANEAN = ids('ES FR MC IT SI HR BA ME AL GR TR CY SY LB IL PS EG LY TN DZ MA MT');

/** Smaller than this, a country is a microstate here. */
export const MICRO_KM2 = 1000;

export interface Shortcut {
  id: string;
  /** Read when drawn, so that it follows the language. */
  name(): string;
  /** Said when the name alone does not tell which ones they are. */
  title?(): string;
  /** The countries it chooses, among the ones the section can play with. */
  pick(pool: readonly Country[]): string[];
}

/** Sovereign states: what a ranking of countries is made with. */
const states = (pool: readonly Country[]) => pool.filter((c) => c.cl === 'un');
const top = (pool: readonly Country[], by: (c: Country) => number, n = 10) =>
  states(pool)
    .filter((c) => by(c) > 0)
    .sort((a, b) => by(b) - by(a))
    .slice(0, n)
    .map((c) => c.id);
const bottom = (pool: readonly Country[], by: (c: Country) => number, n = 10) =>
  states(pool)
    .filter((c) => by(c) > 0)
    .sort((a, b) => by(a) - by(b))
    .slice(0, n)
    .map((c) => c.id);
const fixed = (list: string[]) => () => list;

/** The ones always in sight. */
export const SHORTCUTS: Shortcut[] = [
  { id: 'world', name: () => L('Mundo', 'World'), pick: (pool) => pool.filter((c) => c.cl !== 'dep').map((c) => c.id) },
  { id: 'eu', name: () => L('Unión Europea', 'European Union'), pick: fixed(EU) },
  { id: 'spanish', name: () => L('Hispanohablantes', 'Spanish-speaking'), pick: fixed(SPANISH) },
  { id: 'g20', name: () => 'G20', pick: fixed(G20) },
  { id: 'pop10', name: () => L('10 más poblados', '10 most populous'), pick: (pool) => top(pool, (c) => c.pop ?? 0) },
  { id: 'area10', name: () => L('10 más extensos', '10 largest'), pick: (pool) => top(pool, (c) => c.ar) },
];

/** The rest, shown when asked for. */
export const MORE_SHORTCUTS: Shortcut[] = [
  { id: 'nato', name: () => L('OTAN', 'NATO'), pick: fixed(NATO) },
  { id: 'schengen', name: () => L('Espacio Schengen', 'Schengen Area'), pick: fixed(SCHENGEN) },
  { id: 'euro', name: () => L('Eurozona', 'Euro area'), pick: fixed(EUROZONE) },
  { id: 'brics', name: () => 'BRICS', pick: fixed(BRICS) },
  { id: 'arab', name: () => L('Liga Árabe', 'Arab League'), pick: fixed(ARAB_LEAGUE) },
  { id: 'ussr', name: () => L('Antigua URSS', 'Former USSR'), pick: fixed(USSR) },
  { id: 'yugoslavia', name: () => L('Antigua Yugoslavia', 'Former Yugoslavia'), pick: fixed(YUGOSLAVIA) },
  { id: 'portuguese', name: () => L('Lengua portuguesa', 'Portuguese-speaking'), pick: fixed(PORTUGUESE) },
  { id: 'mediterranean', name: () => L('Mediterráneos', 'Mediterranean'), title: () => L('Países con costa en el Mediterráneo', 'Countries with a coast on the Mediterranean'), pick: fixed(MEDITERRANEAN) },
  {
    id: 'micro',
    name: () => L('Microestados', 'Microstates'),
    title: () => L(`Estados de menos de ${MICRO_KM2} km²`, `States smaller than ${MICRO_KM2} km²`),
    pick: (pool) => pool.filter((c) => (c.cl === 'un' || c.cl === 'obs') && c.ar > 0 && c.ar < MICRO_KM2).map((c) => c.id),
  },
  { id: 'noborders', name: () => L('Sin fronteras terrestres', 'No land borders'), pick: (pool) => states(pool).filter((c) => !c.nb?.length).map((c) => c.id) },
  { id: 'landlocked', name: () => L('Sin salida al mar', 'Landlocked'), pick: (pool) => pool.filter((c) => c.cl !== 'dep' && c.cl !== 'other' && c.ll).map((c) => c.id) },
  { id: 'pop10low', name: () => L('10 menos poblados', '10 least populous'), pick: (pool) => bottom(pool, (c) => c.pop ?? 0) },
  { id: 'area10low', name: () => L('10 más pequeños', '10 smallest'), pick: (pool) => bottom(pool, (c) => c.ar) },
];
