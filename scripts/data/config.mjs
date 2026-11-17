// Curated knowledge layered on top of Natural Earth.
// Everything here is editorial: who counts as a country, how odd units are
// repaired, which Spanish names we prefer, and which countries get a coarser
// "regions" level on top of their finest subdivisions.

/** The 193 UN member states, by ISO 3166-1 alpha-2. */
export const UN_MEMBERS = new Set(
  (
    // Africa (54)
    'DZ AO BJ BW BF BI CV CM CF TD KM CG CD CI DJ EG GQ ER SZ ET GA GM GH GN GW KE LS LR LY MG MW ML MR MU MA MZ NA NE NG RW ST SN SC SL SO ZA SS SD TZ TG TN UG ZM ZW ' +
    // Asia (47)
    'AF AM AZ BH BD BT BN KH CN CY GE IN ID IR IQ IL JP JO KZ KW KG LA LB MY MV MN MM NP KP OM PK PH QA SA SG KR LK SY TJ TH TL TR TM AE UZ VN YE ' +
    // Europe (43)
    'AL AD AT BY BE BA BG HR CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT MD MC ME NL MK NO PL PT RO RU SM RS SK SI ES SE CH UA GB ' +
    // Americas (35)
    'AG AR BS BB BZ BO BR CA CL CO CR CU DM DO EC SV GD GT GY HT HN JM MX NI PA PY PE KN LC VC SR TT US UY VE ' +
    // Oceania (14)
    'AU FJ KI MH FM NR NZ PW PG WS SB TO TV VU'
  ).split(' '),
);

/** UN observer states. */
export const OBSERVERS = new Set(['VA', 'PS']);
/** Widely mapped but only partially recognised or non-self-governing. */
export const PARTIAL = new Set(['XK', 'TW', 'EH']);

/**
 * Natural Earth ADM0_A3 → our entity id, where the default (ISO alpha-2)
 * is missing or not what we want. `null` drops the unit entirely.
 */
export const A3_TO_ENTITY = {
  CYN: 'CY', // Northern Cyprus → Cyprus (UN view)
  ESB: 'CY', // Dhekelia base
  WSB: 'CY', // Akrotiri base
  SOL: 'SO', // Somaliland → Somalia (UN view)
  KAB: 'KZ', // Baikonur (leased) → Kazakhstan
  USG: 'CU', // Guantanamo Bay (leased) → Cuba
  KAS: 'X1', // Siachen Glacier: drawn, never asked
  SPI: 'X2', // Southern Patagonian Ice Field (undefined border): drawn, never asked
  PGA: null, // Spratly Islands
  CLP: null, // Clipperton
  ATC: null, // Ashmore and Cartier
  CSI: null, // Coral Sea Islands
  UMI: null, // US Minor Outlying Islands (scattered across two oceans)
  IOA: null, // split below into CX / CC
};

/** Split parts of a country into their own entity (overseas territories). */
export function splitEntity(p) {
  const g = p.geonunit;
  if (p.adm0_a3 === 'FRA') {
    if (g === 'French Guiana') return 'GF';
    if (g === 'Guadeloupe') return 'GP';
    if (g === 'Martinique') return 'MQ';
    if (g === 'Reunion') return 'RE';
    if (g === 'Mayotte') return 'YT';
  }
  if (p.adm0_a3 === 'NOR') {
    if (g === 'Svalbard') return 'SJ';
    if (g === 'Bouvet Island') return 'BV';
  }
  if (p.adm0_a3 === 'NLD' && /^NL-BQ/.test(p.iso_3166_2 || '')) return 'BQ';
  if (p.adm0_a3 === 'NZL' && p.iso_a2 === 'TK') return 'TK';
  if (p.adm0_a3 === 'IOA') return g === 'Christmas Island' ? 'CX' : 'CC';
  if (p.adm0_a3 === 'CHN' && g === 'Paracel Islands') return null;
  // Crimea and Sevastopol: internationally recognised as Ukraine (UNGA 68/262).
  if (p.iso_3166_2 === 'UA-43' || p.iso_3166_2 === 'UA-40') return 'UA';
  return undefined;
}

/** Metadata for entities that Natural Earth does not carry as admin-0 rows. */
export const EXTRA_ENTITIES = {
  GF: { a3: 'GUF', sov: 'FR', es: 'Guayana Francesa', en: 'French Guiana', ct: 'AM', sr: 'AM-S', wd: 'Q3769' },
  GP: { a3: 'GLP', sov: 'FR', es: 'Guadalupe', en: 'Guadeloupe', ct: 'AM', sr: 'AM-K', wd: 'Q17012' },
  MQ: { a3: 'MTQ', sov: 'FR', es: 'Martinica', en: 'Martinique', ct: 'AM', sr: 'AM-K', wd: 'Q17054' },
  RE: { a3: 'REU', sov: 'FR', es: 'Reunión', en: 'Réunion', ct: 'AF', sr: 'AF-E', wd: 'Q17070' },
  YT: { a3: 'MYT', sov: 'FR', es: 'Mayotte', en: 'Mayotte', ct: 'AF', sr: 'AF-E', wd: 'Q17063' },
  SJ: { a3: 'SJM', sov: 'NO', es: 'Svalbard', en: 'Svalbard', ct: 'EU', sr: 'EU-N', wd: 'Q25231' },
  BV: { a3: 'BVT', sov: 'NO', es: 'Isla Bouvet', en: 'Bouvet Island', ct: 'AN', sr: 'AN', wd: 'Q23408' },
  BQ: { a3: 'BES', sov: 'NL', es: 'Caribe Neerlandés', en: 'Caribbean Netherlands', ct: 'AM', sr: 'AM-K', wd: 'Q27561' },
  TK: { a3: 'TKL', sov: 'NZ', es: 'Tokelau', en: 'Tokelau', ct: 'OC', sr: 'OC-P', wd: 'Q36823' },
  CX: { a3: 'CXR', sov: 'AU', es: 'Isla de Navidad', en: 'Christmas Island', ct: 'AS', sr: 'AS-SE', wd: 'Q31063' },
  CC: { a3: 'CCK', sov: 'AU', es: 'Islas Cocos', en: 'Cocos (Keeling) Islands', ct: 'AS', sr: 'AS-SE', wd: 'Q36004' },
  X1: { a3: 'KAS', es: 'Glaciar de Siachen', en: 'Siachen Glacier', ct: 'AS', sr: 'AS-S', wd: 'Q333946', cl: 'other' },
  X2: { a3: 'SPI', es: 'Campo de Hielo Patagónico Sur', en: 'Southern Patagonian Ice Field', ct: 'AM', sr: 'AM-S', wd: 'Q1031467', cl: 'other' },
};

// ---------------------------------------------------------------------------
// Continents and subregions
// ---------------------------------------------------------------------------

export const CONTINENTS = {
  EU: { es: 'Europa', en: 'Europe' },
  AS: { es: 'Asia', en: 'Asia' },
  AF: { es: 'África', en: 'Africa' },
  AM: { es: 'América', en: 'Americas' },
  OC: { es: 'Oceanía', en: 'Oceania' },
  AN: { es: 'Antártida', en: 'Antarctica' },
};

export const SUBREGIONS = {
  'EU-N': { es: 'Europa del Norte', en: 'Northern Europe' },
  'EU-W': { es: 'Europa Occidental', en: 'Western Europe' },
  'EU-S': { es: 'Europa del Sur', en: 'Southern Europe' },
  'EU-E': { es: 'Europa del Este', en: 'Eastern Europe' },
  'AS-W': { es: 'Asia Occidental', en: 'Western Asia' },
  'AS-C': { es: 'Asia Central', en: 'Central Asia' },
  'AS-S': { es: 'Asia del Sur', en: 'Southern Asia' },
  'AS-E': { es: 'Asia Oriental', en: 'Eastern Asia' },
  'AS-SE': { es: 'Sudeste Asiático', en: 'South-Eastern Asia' },
  'AF-N': { es: 'África del Norte', en: 'Northern Africa' },
  'AF-W': { es: 'África Occidental', en: 'Western Africa' },
  'AF-C': { es: 'África Central', en: 'Middle Africa' },
  'AF-E': { es: 'África Oriental', en: 'Eastern Africa' },
  'AF-S': { es: 'África Austral', en: 'Southern Africa' },
  'AM-N': { es: 'América del Norte', en: 'North America' },
  'AM-C': { es: 'América Central', en: 'Central America' },
  'AM-K': { es: 'Caribe', en: 'Caribbean' },
  'AM-S': { es: 'América del Sur', en: 'South America' },
  'OC-A': { es: 'Australia y Nueva Zelanda', en: 'Australia and New Zealand' },
  'OC-ME': { es: 'Melanesia', en: 'Melanesia' },
  'OC-MI': { es: 'Micronesia', en: 'Micronesia' },
  'OC-P': { es: 'Polinesia', en: 'Polynesia' },
  AN: { es: 'Antártida y océano Austral', en: 'Antarctica and Southern Ocean' },
};

/** Natural Earth SUBREGION → our subregion code. */
export const NE_SUBREGION = {
  'Northern Europe': 'EU-N',
  'Western Europe': 'EU-W',
  'Southern Europe': 'EU-S',
  'Eastern Europe': 'EU-E',
  'Western Asia': 'AS-W',
  'Central Asia': 'AS-C',
  'Southern Asia': 'AS-S',
  'Eastern Asia': 'AS-E',
  'South-Eastern Asia': 'AS-SE',
  'Northern Africa': 'AF-N',
  'Western Africa': 'AF-W',
  'Middle Africa': 'AF-C',
  'Eastern Africa': 'AF-E',
  'Southern Africa': 'AF-S',
  'Northern America': 'AM-N',
  'Central America': 'AM-C',
  Caribbean: 'AM-K',
  'South America': 'AM-S',
  'Australia and New Zealand': 'OC-A',
  Melanesia: 'OC-ME',
  Micronesia: 'OC-MI',
  Polynesia: 'OC-P',
  Antarctica: 'AN',
};

/** Subregion overrides by entity id. */
export const SUBREGION_OVERRIDE = {
  MX: 'AM-N', // Spanish-language convention: México is in América del Norte
  CY: 'EU-S', // EU member; shown on every Spanish map of Europe
  AQ: 'AN',
  TF: 'AN',
  HM: 'AN',
  GS: 'AN',
  IO: 'AS-S',
  SH: 'AF-W',
  SC: 'AF-E',
  MU: 'AF-E',
  MV: 'AS-S',
  FK: 'AM-S',
};

/** Landlocked states (the canonical 44 plus Kosovo). */
export const LANDLOCKED = new Set(
  'AD AF AM AT AZ BF BI BO BT BW BY CF CH CZ ET HU KG KZ LA LI LS LU MD MK ML MN MW NE NP PY RS RW SK SM SS SZ TD TJ TM UG UZ VA ZM ZW XK'.split(' '),
);

// ---------------------------------------------------------------------------
// Country names
// ---------------------------------------------------------------------------

/** Preferred display names (Spanish / English) where Natural Earth's are off. */
export const COUNTRY_NAME = {
  TW: { es: 'Taiwán', en: 'Taiwan' },
  CZ: { es: 'Chequia', en: 'Czechia' },
  SZ: { es: 'Esuatini', en: 'Eswatini' },
  MM: { es: 'Myanmar', en: 'Myanmar' },
  CN: { es: 'China', en: 'China' },
  US: { es: 'Estados Unidos', en: 'United States' },
  FM: { es: 'Micronesia', en: 'Micronesia' },
  VA: { es: 'Ciudad del Vaticano', en: 'Vatican City' },
  BS: { es: 'Bahamas', en: 'Bahamas' },
  GM: { es: 'Gambia', en: 'Gambia' },
  CI: { es: 'Costa de Marfil', en: 'Ivory Coast' },
  TL: { es: 'Timor Oriental', en: 'Timor-Leste' },
  CV: { es: 'Cabo Verde', en: 'Cape Verde' },
  ST: { es: 'Santo Tomé y Príncipe', en: 'São Tomé and Príncipe' },
  FK: { es: 'Islas Malvinas', en: 'Falkland Islands' },
  SH: { es: 'Santa Elena', en: 'Saint Helena' },
  UM: { es: 'Islas Ultramarinas de EE. UU.', en: 'U.S. Minor Outlying Islands' },
  VI: { es: 'Islas Vírgenes de EE. UU.', en: 'U.S. Virgin Islands' },
  AX: { es: 'Åland', en: 'Åland' },
  PS: { es: 'Palestina', en: 'Palestine' },
  MF: { es: 'San Martín (Francia)', en: 'Saint Martin' },
  SX: { es: 'Sint Maarten', en: 'Sint Maarten' },
  BL: { es: 'San Bartolomé', en: 'Saint Barthélemy' },
  PM: { es: 'San Pedro y Miquelón', en: 'Saint Pierre and Miquelon' },
  GS: { es: 'Georgias del Sur y Sandwich del Sur', en: 'South Georgia and the South Sandwich Islands' },
  TF: { es: 'Tierras Australes Francesas', en: 'French Southern Territories' },
  CD: { es: 'República Democrática del Congo', en: 'DR Congo' },
  CG: { es: 'República del Congo', en: 'Republic of the Congo' },
  KP: { es: 'Corea del Norte', en: 'North Korea' },
  KR: { es: 'Corea del Sur', en: 'South Korea' },
  MK: { es: 'Macedonia del Norte', en: 'North Macedonia' },
  HK: { es: 'Hong Kong', en: 'Hong Kong' },
  MO: { es: 'Macao', en: 'Macau' },
};

/** Extra accepted spellings when typing a country (on top of es/en/long names). */
export const COUNTRY_ALIASES = {
  US: ['EEUU', 'EE UU', 'USA', 'US', 'Estados Unidos de América', 'United States of America', 'América'],
  GB: ['Gran Bretaña', 'UK', 'GB', 'Great Britain', 'Reino Unido de Gran Bretaña e Irlanda del Norte'],
  NL: ['Holanda', 'Holland', 'The Netherlands'],
  CZ: ['República Checa', 'Czech Republic'],
  SZ: ['Suazilandia', 'Swazilandia', 'Swaziland', 'eSwatini'],
  MM: ['Birmania', 'Burma'],
  BY: ['Belarús', 'Belarus', 'Rusia Blanca'],
  CD: ['RDC', 'RD Congo', 'RD del Congo', 'Congo Kinshasa', 'Congo Democrático', 'DRC', 'Zaire'],
  CG: ['Congo', 'Congo Brazzaville'],
  CF: ['RCA', 'Centroáfrica', 'CAR'],
  AE: ['EAU', 'Emiratos', 'UAE', 'Emiratos Árabes'],
  SA: ['Arabia Saudí'],
  RO: ['Rumanía'],
  KG: ['Kirguizistán', 'Kirguisia', 'Kirguizia'],
  KZ: ['Kazajstán', 'Kazakstán'],
  TJ: ['Tadjikistán', 'Tayikistan'],
  BH: ['Bahrein', 'Bahréin', 'Baréin'],
  QA: ['Qatar', 'Catar'],
  BD: ['Bangladesh', 'Bangladés'],
  BW: ['Botswana', 'Botsuana'],
  ZW: ['Zimbabwe', 'Zimbabue'],
  MW: ['Malawi', 'Malaui'],
  RW: ['Rwanda', 'Ruanda'],
  DJ: ['Djibouti', 'Yibuti'],
  FJ: ['Fiji', 'Fiyi', 'Islas Fiyi'],
  IQ: ['Iraq', 'Irak'],
  KE: ['Kenya', 'Kenia'],
  LS: ['Lesotho', 'Lesoto'],
  SR: ['Suriname', 'Surinam'],
  PW: ['Palau', 'Palaos'],
  MU: ['Mauritius', 'Isla Mauricio'],
  MD: ['Moldova', 'Moldavia'],
  BT: ['Bhután', 'Bhutan'],
  TR: ['Türkiye', 'Turkiye'],
  CI: ["Côte d'Ivoire", 'Cote dIvoire'],
  TL: ['Timor Leste', 'Timor Este', 'East Timor'],
  CV: ['Cape Verde', 'Cabo Verde'],
  VA: ['Vaticano', 'Santa Sede', 'Holy See', 'El Vaticano'],
  BA: ['Bosnia', 'Bosnia Herzegovina'],
  KN: ['Saint Kitts y Nevis', 'San Cristóbal y Nevis', 'St Kitts and Nevis', 'San Cristóbal'],
  VC: ['San Vicente', 'St Vincent'],
  AG: ['Antigua'],
  TT: ['Trinidad', 'Trinidad y Tabago'],
  ST: ['Santo Tomé', 'Sao Tome', 'São Tomé e Príncipe'],
  PG: ['Papúa', 'Nueva Guinea', 'Papua New Guinea'],
  FM: ['Estados Federados de Micronesia', 'Federated States of Micronesia'],
  KP: ['Corea Norte', 'RPDC', 'DPRK'],
  KR: ['Corea', 'Corea Sur', 'República de Corea'],
  RU: ['Federación Rusa', 'Federación de Rusia'],
  CN: ['República Popular China', "People's Republic of China", 'RPC'],
  TW: ['República de China', 'Taiwan', 'Formosa'],
  IR: ['Persia'],
  LA: ['Lao'],
  SY: ['Siria'],
  MK: ['Macedonia'],
  GW: ['Guinea Bissau', 'Guinea-Bissau'],
  GQ: ['Guinea Ecuatorial'],
  ZA: ['Suráfrica', 'República Sudafricana'],
  EH: ['Sáhara Occidental', 'Sahara', 'RASD', 'República Árabe Saharaui Democrática', 'Sahara Español'],
  PS: ['Palestina', 'Estado de Palestina', 'Territorios Palestinos', 'State of Palestine'],
  XK: ['Kósovo', 'Kosova'],
  DO: ['Dominicana', 'Rep Dominicana', 'República Dominicana'],
  NZ: ['Nueva Zelandia', 'Aotearoa'],
  SB: ['Salomón'],
  MH: ['Marshall'],
  IE: ['Eire', 'República de Irlanda'],
  LK: ['Ceilán', 'Ceylon'],
  BN: ['Brunei', 'Brunéi Darussalam', 'Brunei Darussalam'],
  IN: ['La India'],
  MX: ['Méjico'],
  FK: ['Malvinas', 'Falkland', 'Islas Falkland'],
  GL: ['Groenlandia'],
  HK: ['Hong Kong'],
  CW: ['Curazao', 'Curaçao'],
};

// ---------------------------------------------------------------------------
// Capitals
// ---------------------------------------------------------------------------

/**
 * Capital overrides. `es`/`en` set the display name, `alt` lists other
 * accepted answers (alternative or former capitals, other spellings),
 * `ll` gives coordinates when the city is missing from the gazetteer.
 */
export const CAPITAL_OVERRIDE = {
  ZA: { es: 'Pretoria', en: 'Pretoria', pick: 'Pretoria', alt: ['Ciudad del Cabo', 'Cape Town', 'Bloemfontein', 'Tshwane'] },
  BO: { es: 'Sucre', en: 'Sucre', pick: 'Sucre', alt: ['La Paz'] },
  CI: { es: 'Yamusukro', en: 'Yamoussoukro', pick: 'Yamoussoukro', alt: ['Abiyán', 'Abidjan', 'Abidján'] },
  BJ: { es: 'Porto Novo', en: 'Porto-Novo', pick: 'Porto-Novo', alt: ['Cotonú', 'Cotonou'] },
  TZ: { es: 'Dodoma', en: 'Dodoma', pick: 'Dodoma', alt: ['Dar es Salaam', 'Dar es-Salam'] },
  LK: { es: 'Sri Jayawardenapura Kotte', en: 'Sri Jayawardenepura Kotte', pick: 'Sri Jayawardenepura Kotte', alt: ['Colombo', 'Kotte'] },
  MM: { es: 'Naipyidó', en: 'Naypyidaw', pick: 'Naypyidaw', alt: ['Naypyitaw', 'Nay Pyi Taw', 'Naipyidaw'] },
  NL: { es: 'Ámsterdam', en: 'Amsterdam', pick: 'Amsterdam', alt: ['La Haya', 'The Hague'] },
  MY: { es: 'Kuala Lumpur', en: 'Kuala Lumpur', pick: 'Kuala Lumpur', alt: ['Putrajaya'] },
  IL: { es: 'Jerusalén', en: 'Jerusalem', pick: 'Jerusalem', alt: ['Tel Aviv'] },
  SZ: { es: 'Mbabane', en: 'Mbabane', pick: 'Mbabane', alt: ['Lobamba'] },
  CL: { es: 'Santiago', en: 'Santiago', pick: 'Santiago', alt: ['Santiago de Chile'] },
  BI: { es: 'Gitega', en: 'Gitega', ll: [29.9246, -3.4271], alt: ['Buyumbura', 'Bujumbura'] },
  KZ: { es: 'Astaná', en: 'Astana', alt: ['Nur-Sultán', 'Nursultán', 'Nur-Sultan', 'Astana'] },
  // One spelling in Spanish for the capital and for the emirate and the division named after it.
  AE: { es: 'Abu Dabi', en: 'Abu Dhabi', alt: ['Abu Dhabi', 'Abu Zabi'] },
  BD: { es: 'Daca', en: 'Dhaka', alt: ['Dacca'] },
  PW: { es: 'Ngerulmud', en: 'Ngerulmud', alt: ['Melekeok'] },
  PS: { es: 'Ramala', en: 'Ramallah', ll: [35.2063, 31.9038], alt: ['Jerusalén Este', 'East Jerusalem', 'Ramallah', 'Jerusalén'] },
  SS: { es: 'Yuba', en: 'Juba', alt: ['Juba'] },
  NR: { es: 'Yaren', en: 'Yaren', ll: [166.9209, -0.5477] },
  US: { es: 'Washington D. C.', en: 'Washington, D.C.', alt: ['Washington', 'Washington DC'] },
  MX: { es: 'Ciudad de México', en: 'Mexico City', alt: ['México', 'México D. F.', 'CDMX', 'Mexico DF'] },
  GT: { es: 'Ciudad de Guatemala', en: 'Guatemala City', alt: ['Guatemala'] },
  PA: { es: 'Ciudad de Panamá', en: 'Panama City', alt: ['Panamá'] },
  KW: { es: 'Ciudad de Kuwait', en: 'Kuwait City', alt: ['Kuwait', 'Al Kuwait'] },
  LU: { es: 'Luxemburgo', en: 'Luxembourg', alt: ['Ciudad de Luxemburgo'] },
  SG: { es: 'Singapur', en: 'Singapore' },
  MC: { es: 'Mónaco', en: 'Monaco' },
  VA: { es: 'Ciudad del Vaticano', en: 'Vatican City', alt: ['Vaticano'] },
  SM: { es: 'San Marino', en: 'San Marino', alt: ['Ciudad de San Marino'] },
  DJ: { es: 'Yibuti', en: 'Djibouti', alt: ['Ciudad de Yibuti', 'Djibouti'] },
  IN: { es: 'Nueva Delhi', en: 'New Delhi', alt: ['Delhi'] },
  ET: { es: 'Adís Abeba', en: 'Addis Ababa', alt: ['Addis Abeba'] },
  UA: { es: 'Kiev', en: 'Kyiv', alt: ['Kyiv', 'Kyiv'] },
  CN: { es: 'Pekín', en: 'Beijing', alt: ['Beijing'] },
  SA: { es: 'Riad', en: 'Riyadh', alt: ['Riyadh', 'Riyad'] },
  KR: { es: 'Seúl', en: 'Seoul' },
  KP: { es: 'Pionyang', en: 'Pyongyang', alt: ['Pyongyang'] },
  MD: { es: 'Chisináu', en: 'Chișinău', alt: ['Chisinau', 'Kishinev'] },
  GE: { es: 'Tiflis', en: 'Tbilisi', alt: ['Tbilisi'] },
  AM: { es: 'Ereván', en: 'Yerevan', alt: ['Yerevan'] },
  BT: { es: 'Timbu', en: 'Thimphu', alt: ['Thimphu', 'Thimbu'] },
  TO: { es: 'Nukualofa', en: "Nukuʻalofa", alt: ["Nuku'alofa"] },
  FM: { es: 'Palikir', en: 'Palikir' },
  TW: { es: 'Taipéi', en: 'Taipei', alt: ['Taipei'] },
  EH: { es: 'El Aaiún', en: 'Laayoune', ll: [-13.2033, 27.1536], alt: ['Laâyoune', 'Laayoune', 'Aaiún', 'Tifariti'] },
  XK: { es: 'Pristina', en: 'Pristina', alt: ['Prishtina', 'Priština'] },
  ME: { es: 'Podgorica', en: 'Podgorica' },
  ID: { es: 'Yakarta', en: 'Jakarta', alt: ['Jakarta', 'Nusantara'] },
  KI: { es: 'Tarawa', en: 'Tarawa', alt: ['Tarawa Sur', 'South Tarawa', 'Bairiki'] },
  MH: { es: 'Majuro', en: 'Majuro' },
  CH: { es: 'Berna', en: 'Bern', alt: ['Bern'] },
  HN: { es: 'Tegucigalpa', en: 'Tegucigalpa' },
  BN: { es: 'Bandar Seri Begawan', en: 'Bandar Seri Begawan' },
  TV: { es: 'Funafuti', en: 'Funafuti', alt: ['Vaiaku', 'Fongafale'] },
  GQ: { es: 'Malabo', en: 'Malabo', alt: ['Ciudad de la Paz'] },
  AG: { es: 'Saint John\'s', en: 'St. John\'s', alt: ['Saint John', 'San Juan', 'St Johns', 'Saint Johns'] },
  GD: { es: 'Saint George\'s', en: 'St. George\'s', alt: ['Saint George', 'San Jorge', 'St Georges', 'Saint Georges'] },
  GS: { es: 'Grytviken', en: 'King Edward Point', alt: ['King Edward Point', 'Punta Coronel Zelaya', 'Puerto Grytviken'] },
  FK: { es: 'Stanley', en: 'Stanley', alt: ['Puerto Argentino', 'Puerto Stanley', 'Port Stanley'] },
};

// ---------------------------------------------------------------------------
// Subdivision repairs
// ---------------------------------------------------------------------------

/** adm1 features whose ISO code is duplicated but which are NOT the same unit. */
export const RECODE = [
  // [match(properties) , patch]
  [(p) => p.iso_3166_2 === 'CO-CUN' && /Bogot/i.test(p.name), { iso_3166_2: 'CO-DC' }],
  [(p) => p.iso_3166_2 === 'HR-12' && /Eslavonia/.test(p.name_es || ''), { iso_3166_2: 'HR-11', name: 'Požeško-slavonska', name_en: 'Požega-Slavonia' }],
  [(p) => p.iso_3166_2 === 'IR-07' && p.name === 'Alborz', { iso_3166_2: 'IR-32' }],
  // Polygons that Natural Earth labels as a duplicate of their neighbour; GeoNames gives them away.
  [(p) => p.iso_3166_2 === 'AF-PAR' && p.gn_name === 'Panjshir', { iso_3166_2: 'AF-PAN', name: 'Panjshir', name_es: 'Panjshir', name_en: 'Panjshir', wikidataid: null }],
  [(p) => p.iso_3166_2 === 'AF-URU' && /Daykundi/.test(p.gn_name || ''), { iso_3166_2: 'AF-DAY', name: 'Daykundi', name_es: 'Daikondi', name_en: 'Daykundi', wikidataid: null }],
  [(p) => p.iso_3166_2 === 'MW-CT' && /Karonga/.test(p.gn_name || ''), { iso_3166_2: 'MW-KR', name: 'Karonga', name_es: 'Karonga', name_en: 'Karonga', region: 'Northern', wikidataid: null }],
  [(p) => p.iso_3166_2 === 'UG-410' && /Kiruhura/.test(p.gn_name || ''), { iso_3166_2: 'UG-419', name: 'Kiruhura', name_es: 'Kiruhura', name_en: 'Kiruhura', wikidataid: null }],
  [(p) => p.iso_3166_2 === 'MZ-L' && /Cidade/.test(p.gn_name || ''), { iso_3166_2: 'MZ-MPM', name: 'Maputo (cidade)', name_es: 'Maputo (ciudad)', name_en: 'Maputo City' }],
  [(p) => p.iso_3166_2 === 'MD-RE' && !p.gn_name, { iso_3166_2: 'MD-RIB', name: 'Rîbnița', name_es: 'Rîbnița', name_en: 'Rîbnița', wikidataid: null }],
  [(p) => p.iso_3166_2 === 'RU-MOW' && /Oblast/.test(p.gn_name || ''), { iso_3166_2: 'RU-MOS' }],
  [(p) => p.iso_3166_2 === 'RU-MOS' && p.type_en === 'Federal City', { iso_3166_2: 'RU-MOW' }],
  [(p) => p.iso_3166_2 === 'KZ-ALA' && /City/.test(p.name), { iso_3166_2: 'KZ-75', name: 'Almaty (ciudad)', name_es: 'Almaty (ciudad)', name_en: 'Almaty (city)' }],
  [(p) => p.iso_3166_2 === 'LA-VI' && /prefecture/i.test(p.name), { iso_3166_2: 'LA-VT', name: 'Vientiane (prefectura)', name_es: 'Vientián (prefectura)', name_en: 'Vientiane Prefecture' }],
  [(p) => p.iso_3166_2 === 'MV-12' && /Mal/.test(p.name), { iso_3166_2: 'MV-MLE' }],
  [(p) => p.iso_3166_2 === 'PE-LIM' && /Province/.test(p.name), { iso_3166_2: 'PE-LMA', name: 'Lima Metropolitana', name_es: 'Lima Metropolitana', name_en: 'Metropolitan Lima' }],
  [(p) => p.iso_3166_2 === 'SB-CH' && p.name === 'Western', { iso_3166_2: 'SB-WE' }],
  [(p) => p.iso_3166_2 === 'SD-DE' && /Central/.test(p.name), { iso_3166_2: 'SD-DC' }],
  [(p) => p.iso_3166_2 === 'SD-DS' && /Eastern/.test(p.name), { iso_3166_2: 'SD-DE' }],
  [(p) => p.iso_3166_2 === 'GL-UO' && /Pituffik/.test(p.name), { iso_3166_2: 'GL-PIT' }],
  [(p) => p.iso_3166_2 === 'MX-DIF', { iso_3166_2: 'MX-CMX' }],
  [(p) => p.adm0_a3 === 'SOL', { iso_3166_2: 'SO-SOL' }],
  [(p) => p.adm0_a3 === 'SAH', { iso_3166_2: 'EH-WS' }],
  [(p) => p.adm0_a3 === 'CYN', { iso_3166_2: 'CY-NC' }],
  [(p) => p.adm0_a3 === 'ESB', { iso_3166_2: 'CY-DH' }],
  [(p) => p.adm0_a3 === 'WSB', { iso_3166_2: 'CY-AK' }],
  [(p) => p.geonunit === 'UNDOF', { iso_3166_2: 'SY-UN' }],
  // The kind of unit, where a whole country has it wrong: the 22 regions of Madagascar are filed as the
  // "autonomous provinces" they replaced, and five zones of Nepal as districts.
  [(p) => p.adm0_a3 === 'MDG', { type_en: 'Region' }],
  [(p) => p.adm0_a3 === 'NPL', { type_en: 'Administrative Zone' }],
];

/** The same name in the three fields of the source, unless the Spanish or the English one differs. */
const named = (name, es = name, en = name) => ({ name, name_es: es, name_en: en });

/**
 * Attributes that Natural Earth has wrong, by the `adm1_code` of the feature: the one code that no two
 * features share and that nothing here changes. What is given replaces what the source says (after
 * RECODE); the rest of the feature stays as it is. `wikidataid: null` takes away an id that is another
 * place's, and the game then looks the unit up by its name.
 *
 * Three kinds of mistake, all found by asking a second witness which place each polygon is (`gn_name`,
 * the name GeoNames gives it, which Natural Earth carries along; the area; the cities inside):
 *
 *  1. Names on the wrong polygons. In Guyana eight of the ten regions carried the name and the code of
 *     another one (the south-eastern third of the country was "Mahaica-Berbice", which is a strip of
 *     coast), in Eritrea four of six (Asmara lay in "Anseba") and in Ecuador Napo and Tungurahua were
 *     swapped (Ambato was the capital of "Napo"). The capitals of regions are found by where they lie,
 *     so each of these also taught a capital that was not the region's.
 *  2. A name that is another place's: a district called like its neighbour (Lachin was a second
 *     "Lankaran", Wirral a second "Halton"), like the county, the region or the country it belongs to
 *     (St Helens was "Merseyside", Bolzano "Trentino-Alto Adigio", Saint-Pierre "San Pedro y Miquelón"),
 *     like its capital (Gagauzia was "Comrat") or like a place of another country (Prizren was
 *     "Plužine", which is in Montenegro).
 *  3. A name the place no longer goes by: Leninabad (Sughd), La Estrelleta (Elías Piña), Caprivi
 *     (Zambezi since 2013), Geylegphug (Sarpang). The old one stays as an alias in UNIT_NAME.
 */
export const SOURCE_FIX = {
  // --- 1. Names on the wrong polygons ----------------------------------------------------------
  // Guyana. GeoNames, the areas and the borders agree on every one: the polygon that touches Brazil
  // and Suriname (36 500 km²) is East Berbice-Corentyne and not Mahaica-Berbice (4 200 km²), and so on.
  'GUY-671': { iso_3166_2: 'GY-EB', ...named('East Berbice-Corentyne', 'Berbice Oriental-Corentyne'), wikidataid: 'Q1277758' },
  'GUY-677': { iso_3166_2: 'GY-DE', ...named('Demerara-Mahaica'), wikidataid: 'Q1185362' },
  'GUY-678': { iso_3166_2: 'GY-ES', ...named('Essequibo Islands-West Demerara', 'Islas Esequibo-Demerara Occidental'), wikidataid: null },
  'GUY-679': { iso_3166_2: 'GY-MA', ...named('Mahaica-Berbice'), wikidataid: 'Q1466671' },
  'GUY-676': { iso_3166_2: 'GY-CU', ...named('Cuyuni-Mazaruni'), wikidataid: 'Q1146777' },
  'GUY-680': { iso_3166_2: 'GY-PM', ...named('Pomeroon-Supenaam'), wikidataid: 'Q680382' },
  'GUY-674': { iso_3166_2: 'GY-UT', ...named('Upper Takutu-Upper Essequibo', 'Alto Takutu-Alto Esequibo'), wikidataid: 'Q1516381' },
  'GUY-673': { iso_3166_2: 'GY-UD', ...named('Upper Demerara-Berbice', 'Alto Demerara-Berbice'), wikidataid: 'Q1309042' },
  // Eritrea. The small polygon around Asmara is Maekel (the Central region), the one around Mendefera
  // Debub, the one around Keren Anseba, and the northern coast with Massawa the Northern Red Sea.
  'ERI-1561': { iso_3166_2: 'ER-MA', ...named('Maekel'), wikidataid: 'Q27710' },
  'ERI-1564': { iso_3166_2: 'ER-DU', ...named('Debub'), wikidataid: 'Q27728' },
  'ERI-1563': { iso_3166_2: 'ER-AN', ...named('Anseba'), wikidataid: 'Q569468' },
  'ERI-1562': { iso_3166_2: 'ER-SK', ...named('Semenawi Keyih Bahri', 'Semenawi Keyih Bahri', 'Northern Red Sea'), wikidataid: 'Q27910' },
  // Ecuador. The small one in the Andes (3 400 km², with Ambato) is Tungurahua; the large one in the
  // Amazon (12 600 km², with Tena) is Napo.
  'ECU-1289': { iso_3166_2: 'EC-T', ...named('Tungurahua'), wikidataid: 'Q504252' },
  'ECU-1290': { iso_3166_2: 'EC-N', ...named('Napo'), wikidataid: 'Q211900' },

  // --- 2. A name that is another place's -------------------------------------------------------
  // Azerbaijan: the district between Kalbajar, Qubadli and Armenia is Lachin. The real Lankaran is on
  // the Caspian, four hundred kilometres away, and has a polygon of its own (AZ-LA).
  'AZE-1735': { iso_3166_2: 'AZ-LAC', ...named('Laçın', 'Lachín', 'Lachin'), wikidataid: null },
  // United Kingdom: GB-WRL is Wirral and GB-SHN St Helens, as their codes say; and the square mile of
  // the City is not London, which is all the boroughs around it.
  'GBR-2108': named('Wirral'),
  'GBR-5669': named('St Helens'),
  'GBR-4809': named('City of London', 'City de Londres', 'City of London'),
  // Italy: two provinces under the name of their region.
  'ITA-5459': { ...named('Bolzano', 'Bolzano', 'South Tyrol'), wikidataid: null },
  'ITA-5367': { name_es: 'Génova', name_en: 'Genoa', wikidataid: null },
  // Vietnam and Nepal: three provinces under the name of the region they belong to («Đông Nam Bộ» is
  // the south-east, «Đông Bắc» the north-east, «Đồng Bằng Sông Hồng» the Red River delta), and the zone
  // of Kosi under that of one of its districts.
  'VNM-497': { ...named('Đồng Nai'), type_en: 'Province' },
  'VNM-451': { ...named('Bắc Kạn'), type_en: 'Province', wikidataid: null },
  'VNM-461': { ...named('Hưng Yên'), type_en: 'Province' },
  'NPL-1134': { ...named('Kosi', 'Kosi', 'Koshi'), wikidataid: null },
  // Moldova: Gagauzia under the name of its capital. Mali: Sikasso under that of Wassoulou, a region of
  // history that lies partly in it. Philippines: Surigao del Norte under that of the Dinagat Islands,
  // which were part of it until 2006. Libya: the district of the capital under that of a former one.
  'MDA-1626': named('Găgăuzia', 'Gagauzia', 'Gagauzia'),
  'MLI-2794': { name_es: 'Sikasso', name_en: 'Sikasso' },
  'PHL-2593': { name_es: 'Surigao del Norte', name_en: 'Surigao del Norte', wikidataid: null },
  'LBY-2978': named('Tarabulus', 'Trípoli', 'Tripoli'),
  // Kosovo: Pristina under the name of the Serbian province («Autónoma de Kosovo y Metohija») and
  // Prizren under that of Plužine, in Montenegro. Serbia: Rasina, a second «Pomoravski» in the local name.
  'KOS-5902': { name_es: 'Pristina', name_en: 'Pristina', wikidataid: null },
  'KOS-5908': { name_es: 'Prizren', name_en: 'Prizren', wikidataid: null },
  'SRB-833': { name: 'Rasinski' },
  // A piece of a territory under the name of the whole of it.
  'SPM-4866': { name_en: 'Saint-Pierre', name_es: 'Saint-Pierre', wikidataid: null },
  'MNP-4940': { name_en: 'Northern Islands', name_es: 'Islas del Norte', wikidataid: null },
  'DNK-3419': { name_en: 'Capital Region' }, // "Capital Region of Denmark", cut down to "Denmark"
  // Seychelles and Malta: two districts of the same name on different islands, and the English name of
  // one given to both (or to the wrong one). Their own names tell them apart in UNIT_NAME.
  'SYC-5210': { ...named("Grand'Anse Mahé"), wikidataid: null },
  'SYC-5211': named("Grand'Anse Praslin"),
  'MLT-5977': { wikidataid: 'Q179243' }, // Żebbuġ of Gozo: the id sat on the one of Malta
  'MLT-5946': { name_en: 'Żebbuġ', wikidataid: null },
  // Trinidad and Tobago: Tobago is one unit (TT-TOB); the eastern and western halves were both «Tobago».
  'TTO-50': { iso_3166_2: 'TT-TOB', ...named('Tobago') },
  'TTO-5090': { iso_3166_2: 'TT-TOB', ...named('Tobago') },
  // Madagascar: Atsimo-Andrefana (the south-west) under the Spanish name of Atsimo-Atsinanana (the south-east).
  'MDG-5866': { name_es: 'Atsimo-Andrefana' },
  // The two neutral zones on the border of the Emirates and Oman: one was «Fujairah» in English. They
  // are not emirates either: see NON_QUIZ.
  'ARE-344': { name_en: 'Neutral Zone' },
  'ARE-347': { name_en: 'Neutral Zone' },
  // Labels that are a slip of the source: a misspelling («Chiayai», «Saint Andréws», «Cusco Departament»),
  // an abbreviation, a name in Sinhala, half a name («las Naciones», «Hermanas», «Nacional», «Ho Chi Minh»
  // for the city), an adjective with its noun cut off («Oriental del Cabo», «Especial de Yogyakarta»), the
  // word for the kind of place left in another language («Občina Dobrna»), the largest island for all of
  // them («Lantau Island» for the Islands district).
  'TWN-1170': { name_es: 'Chiayi' },
  'COL-1342': { name_en: 'San Andrés and Providencia' },
  'PER-571': { name_en: 'Cusco' },
  'DOM-1985': named('Distrito Nacional'),
  'PHL-2552': { name_en: 'Mountain Province' },
  'ASM-5002': { name_es: 'Occidental' }, // «Occidente», beside «Oriental»
  'ASM-4999': { name: "Manu'a", name_es: "Manu'a" }, // «Manu's»
  'SDN-5858': { name_es: 'Darfur del Oeste', name_en: 'West Darfur' }, // «Soudan del Oeste», «West Soudan»
  'KHM-1787': { name_en: 'Kampong Speu' }, // «Kam»
  'CZE-10369': { name_en: 'Plzeň' }, // «Plzeň-»
  'BMU-5136': { name_es: 'Devonshire' }, // «Devon»
  'SYC-5213': { name_es: 'La Rivière Anglaise' }, // «La Riviere Anglaise»
  'AIA-5126': { name_es: 'The Valley' }, // «El Valle»: the capital of Anguilla, The Valley everywhere else
  'AIA-5119': { name_es: 'North Side' }, // «Lado norte», the only district of the fourteen that was translated
  // A slip of the pen in one label: two letters swapped, one too many, one for another.
  'SVN-978': { name_es: 'Postojna' }, // «Postojina»
  'SVN-981': { name_es: 'Radlje ob Dravi' }, // «Radjle del Dravi»
  'SVN-270': { name_es: 'Velika Polana' }, // «Vekila Polana»
  'SWZ-537': { name_es: 'Shiselweni' }, // «Shishelweni»
  'PLW-5259': { name_es: 'Sonsorol' }, // «Sonsoral»
  'PLW-5247': { name: 'Hatohobei' }, // «Hatobohei»
  'BTN-2484': { name_es: 'Trashiyangtse' }, // «Trashiyangste»
  'ITA-5392': { name: 'Crotone' }, // «Crotene»
  'ITA-5373': { name: 'Oristano' }, // «Oristrano»
  'ETH-3132': { name: 'Benishangul-Gumuz', name_es: 'Benishangul-Gumuz' }, // «Benshangul-Gumaz», «Benishangul-Gumaz»
  'FRA-5296': { name: 'Haut-Rhin' }, // «Haute-Rhin»
  'FRA-5342': { name: 'Seine-et-Marne' }, // «Seien-et-Marne»
  'GBR-2006': { name: 'North Ayrshire' }, // «North Ayshire»
  'GAB-2187': { name: 'Woleu-Ntem' }, // «Wouleu-Ntem»
  'LBR-1459': { name: 'Gbarpolu' }, // «Gbapolu»
  'TUR-3010': { name: 'Zonguldak' }, // «Zinguldak»
  'MHL-4968': { name: 'Ralik Chain' }, // «Railik Chain»
  'QAT-1106': { name: 'Madinat ash Shamal' }, // «Madinat ach Shamal»
  'IRQ-3223': { name: 'Al-Muthanna' }, // «Al-Muthannia»
  'AZE-5563': { name: 'Şirvan', name_en: 'Shirvan' }, // the two were the other way round
  // Zanzibar and Pemba, whose Spanish labels are English («Pemba North», «Zanzibar Urban/West»), and the
  // two halves of Al Batinah and of Ash Sharqiyah in Oman: «Al Batnah North» beside «Al Batinah Sur», and
  // the south of Ash Sharqiyah under the labels of the region before it was split, «Oriental».
  'TZA-3380': { name_es: 'Pemba Norte' },
  'TZA-3381': { name_es: 'Pemba Sur' },
  'TZA-3383': { name_es: 'Zanzíbar Norte' },
  'TZA-3337': { name_es: 'Zanzíbar Central/Sur' },
  'TZA-3384': { name_es: 'Zanzíbar Urbano/Oeste' },
  'OMN-2424': { name: 'Al Batinah North', name_es: 'Al Batinah Norte' },
  'OMN-5497': { name: 'Al Batinah South' },
  'OMN-2406': { name_es: 'Ash Sharqiyah Sur', name_en: 'Ash Sharqiyah South', wikidataid: null },
  'OMN-5496': { name_es: 'Ash Sharqiyah Norte' },
  // Shusha, the town and the district around it: the district was «Susa» in English and the town «Şuşa»
  // in Spanish, so that the two did not look like one name (see HOMONYMS).
  'AZE-1737': { name_en: 'Shusha' },
  'AZE-5565': { name_es: 'Shusha' },
  'TON-4947': { name_es: 'Niuas' }, // «Grupo Niuas», alone among the five
  'DOM-1968': named('Hermanas Mirabal'),
  'VNM-501': { name_en: 'Ho Chi Minh City' },
  'IDN-540': { name_es: 'Yogyakarta' },
  'NCL-1258': { name_es: 'Islas de la Lealtad' },
  'SVN-239': { name_es: 'Dobrna' },
  'SVN-1011': { name_en: 'Gorenja vas-Poljane' },
  'CAF-807': { name_en: 'Nana-Grébizi' },
  'KOS-5913': { name_en: 'Uroševac/Ferizaj' },
  'HKG-5170': { name_en: 'Islands' },
  'PAK-1110': { name_es: 'Islamabad' },
  'LKA-2448': { name_es: 'Kandy' },
  'ETH-3129': { name_es: 'Naciones, Nacionalidades y Pueblos del Sur', name_en: 'Southern Nations, Nationalities and Peoples' },
  'ZAF-1926': { name_es: 'Cabo Oriental' },
  'ZAF-1188': { name_es: 'Cabo Septentrional' },
  'ZAF-1189': { name_es: 'Cabo Occidental' },
  // An id that is another place's, on a unit whose names are right: the city instead of the region
  // around it (Lima, Kiev, Saná), a namesake (the Altai Republic on the Altai Krai, the Romanian county
  // of Călărași on the Moldovan district, the Centre of Burkina Faso on the Centrale of Togo), a
  // neighbour (the comarca Ngäbe-Buglé on Bocas del Toro).
  'PER-591': { wikidataid: null },
  'UKR-321': { wikidataid: null },
  'YEM-3496': { wikidataid: null },
  'RUS-2399': { name_en: 'Altai Krai', wikidataid: null },
  'MDA-1632': { wikidataid: null },
  'TGO-89': { wikidataid: null },
  'PAN-1958': { wikidataid: null },
  // …or a namesake in another country: the province of Comoé in Burkina Faso on the district of Comoé
  // in Côte d'Ivoire, the parish of Saint George in Barbados on the one in Montserrat, the parish of
  // Saint John in Antigua on the island of Saint John in the Virgin Islands, label and all.
  'CIV-3460': { wikidataid: null },
  'MSR-5088': { wikidataid: null },
  'VIR-4869': { name_es: 'San Juan', wikidataid: null },
  // The kind of unit, where it is all that tells two pieces of one name apart: Minsk the city and Minsk
  // the region had theirs swapped, and the cities of Tashkent and Saná and the two towns of Bermuda (the
  // rest are its nine parishes: see FINE_LABEL) had none.
  'BLR-4825': { type_en: 'City' },
  'BLR-2345': { type_en: 'Region' },
  'UZB-4828': { type_en: 'City' },
  'YEM-3498': { type_en: 'City' },
  'BMU-5134': { type_en: 'City' },
  'BMU-5135': { type_en: 'Town' },

  // --- 3. A name the place no longer goes by ---------------------------------------------------
  'TJK-369': { ...named('Sughd'), wikidataid: null }, // the id was that of Khujand, its capital
  'DOM-1972': named('Elías Piña'),
  'NAM-3356': named('Zambezi'),
  'BTN-2482': named('Sarpang'),
  // Here only the local name was the old one, and it pulled the English label down with it (a label
  // that does not resemble the local name is not believed).
  'TKM-353': { name: 'Daşoguz' }, // Tashauz, as the Soviet province was called
  'TKM-359': { name: 'Lebap' }, // the province of Chardzhou
  'AZE-1680': { name: 'Göygöl' }, // Xanlar until 2008
  'AZE-1701': { name: 'Şabran' }, // Dəvəçi until 2010
  'BTN-2438': { name: 'Samtse' }, // Samchi
  'PHL-2592': { name: 'Davao de Oro' }, // Compostela Valley until 2019
  'PNG-1245': { name: 'Bougainville', name_en: 'Bougainville' }, // North Solomons; in English, «of Bougainville»
  'NIC-657': { name: 'Costa Caribe Norte', name_es: 'Costa Caribe Norte' }, // Atlántico Norte until 2014
  'NIC-644': { name: 'Costa Caribe Sur', name_es: 'Costa Caribe Sur' },
  'TJK-368': { name: 'Districts of Republican Subordination', name_en: 'Districts of Republican Subordination' }, // «Tadzhikistan Territories»
};

/** Countries where units sharing an ISO code are genuinely different and must keep separate ids. */
export const NO_ISO_MERGE = new Set(['BA', 'MG', 'LV']);

/** Units to fold into another unit of the same entity (by final id). */
export const MERGE_INTO = [
  // [match(properties, entity) , target id]
  [(p) => p.adm0_a3 === 'KAB', 'KZ-KZY'],
  [(p) => p.adm0_a3 === 'USG', 'CU-14'],
  [(p) => p.iso_3166_2 === 'AU-X03~', 'AU-TAS'], // Macquarie Island
  [(p) => p.iso_3166_2 === 'AU-X02~', 'AU-NSW'], // Jervis Bay Territory (too small to ask)
  [(p) => p.iso_3166_2 === 'CO-X01~', 'CO-VAC'], // Malpelo
  [(p) => p.iso_3166_2 === 'VE-X01~', 'VE-W'], // Isla de Aves
  [(p) => p.iso_3166_2 === 'MX-X01~', 'MX-YUC'], // Arrecife Alacranes
  [(p) => p.iso_3166_2 === 'RU-X01~', 'RU-YAN'],
  [(p) => p.iso_3166_2 === 'GL-PIT', '~nearest'],
  [(p) => p.iso_3166_2 === 'SY-UN', 'SY-QU'], // UNDOF zone lies within Quneitra governorate
];

/** Display name for units created by merging same-ISO parts. */
export const MERGED_NAME = {
  'IE-D': { name: 'Dublin', es: 'Dublín', en: 'Dublin' },
  'IE-TA': { name: 'Tipperary', es: 'Tipperary', en: 'Tipperary' },
  'PH-MNL': { name: 'Metro Manila', es: 'Gran Manila', en: 'Metro Manila' },
  'MD-SN': { name: 'Transnistria', es: 'Transnistria', en: 'Transnistria' },
};

/**
 * Units that are drawn but never asked: territories nobody governs or two parties share. The two neutral
 * zones between the Emirates and Oman were asked as an eighth and a ninth emirate, both called «Zona neutral».
 */
export const NON_QUIZ = [(p) => ['CYN', 'ESB', 'WSB', 'KAS', 'SPI'].includes(p.adm0_a3), (p) => p.adm1_code === 'ARE-344' || p.adm1_code === 'ARE-347'];

/**
 * Territorial claims where Natural Earth's default (de facto) linework differs
 * from the UN view we follow. Each claim polygon comes from the disputed-areas
 * layer and is moved from one set of units to another:
 *   `from`: these units are merged into the first id, then the claim is cut out;
 *   `to`  : the claim polygon is added to this unit.
 */
export const CLAIMS = [
  {
    // Western Sahara west of the berm is administered by Morocco; the UN lists
    // the whole territory as non-self-governing, which is how Spanish maps draw it.
    name: 'Sahara Occidental',
    match: (p) => p.BRK_NAME === 'W. Sahara' && p.ADM0_A3 === 'MAR',
    from: ['MA-14', 'MA-15', 'MA-16'],
    to: 'EH-WS',
  },
  {
    // The Golan Heights are Syrian territory occupied by Israel (UNSC 497).
    name: 'Altos del Golán',
    match: (p) => p.BRK_NAME === 'Golan Heights',
    from: ['IL-Z'],
    to: 'SY-QU',
  },
];

/**
 * Countries whose `name` field (the local name) is already Spanish, so we
 * prefer it to the Wikidata-derived `name_es`, which has stray mislinks.
 */
export const HISPANOPHONE = new Set('ES MX GT SV HN NI CR PA CU DO PR CO VE EC PE BO CL AR UY PY GQ'.split(' '));

/** Countries whose Wikidata Spanish labels are good enough to trust exonyms blindly. */
export const TRUST_ES = new Set(
  'US CA BR PT FR IT DE GB IE NL BE CH AT PL CZ GR RU UA CN JP IN AU NZ ZA TR SE NO DK FI EG MA DZ SA IR IQ IL KR KP ID TH VN HU RO BG HR RS SK LT EE BY IS LU AD CY MT TN LY SY JO LB KZ UZ PK BD NP LK MY SG MN AE QA KW OM YE ET KE NG GH SN CM AO MZ TZ CD HT JM BS TT'.split(
    ' ',
  ),
);

/** Per-unit name overrides, keyed by final unit id. */
export const UNIT_NAME = {
  // México
  'MX-CMX': { es: 'Ciudad de México', en: 'Mexico City', lo: 'Ciudad de México', al: ['CDMX', 'Distrito Federal', 'México D. F.', 'DF'] },
  'MX-MEX': { es: 'Estado de México', en: 'State of Mexico', lo: 'Estado de México', al: ['México', 'Edomex', 'Mexico'] },
  'MX-COA': { es: 'Coahuila', al: ['Coahuila de Zaragoza'] },
  'MX-MIC': { es: 'Michoacán', al: ['Michoacán de Ocampo'] },
  'MX-VER': { es: 'Veracruz', al: ['Veracruz de Ignacio de la Llave'] },
  'MX-QUE': { es: 'Querétaro', al: ['Querétaro de Arteaga'] },
  // Argentina
  'AR-C': { es: 'Ciudad de Buenos Aires', en: 'Buenos Aires City', lo: 'Ciudad Autónoma de Buenos Aires', al: ['CABA', 'Ciudad Autónoma de Buenos Aires', 'Capital Federal', 'Buenos Aires ciudad'] },
  'AR-B': { es: 'Buenos Aires', en: 'Buenos Aires Province', lo: 'Provincia de Buenos Aires', al: ['Provincia de Buenos Aires'] },
  'AR-V': { es: 'Tierra del Fuego', al: ['Tierra del Fuego, Antártida e Islas del Atlántico Sur'] },
  // Brasil
  'BR-DF': { es: 'Distrito Federal', en: 'Federal District', lo: 'Distrito Federal', al: ['Brasilia', 'Brasília'] },
  // Colombia
  'CO-DC': { es: 'Bogotá', en: 'Bogotá', lo: 'Bogotá, D. C.', al: ['Bogotá D. C.', 'Distrito Capital', 'Bogota'] },
  'CO-SAP': { es: 'San Andrés y Providencia', al: ['San Andrés', 'Archipiélago de San Andrés, Providencia y Santa Catalina'] },
  'CO-VAC': { es: 'Valle del Cauca', al: ['Valle'] },
  // Perú
  'PE-LMA': { es: 'Lima Metropolitana', en: 'Metropolitan Lima', lo: 'Lima Metropolitana', al: ['Provincia de Lima', 'Lima ciudad'] },
  'PE-LIM': { es: 'Lima', en: 'Lima Region', lo: 'Lima', al: ['Departamento de Lima', 'Lima Provincias', 'Lima región'] },
  'PE-CUS': { es: 'Cusco', al: ['Cuzco'] },
  // Chile
  'CL-RM': { es: 'Región Metropolitana', en: 'Santiago Metropolitan', lo: 'Región Metropolitana de Santiago', al: ['Santiago', 'Metropolitana', 'Metropolitana de Santiago', 'RM', 'Región Metropolitana de Santiago'] },
  'CL-LI': { es: "O'Higgins", en: "O'Higgins", lo: "Libertador General Bernardo O'Higgins", al: ["Libertador General Bernardo O'Higgins", 'Libertador', 'OHiggins'] },
  'CL-AI': { es: 'Aysén', en: 'Aysén', lo: 'Aysén del General Carlos Ibáñez del Campo', al: ['Aisén', 'Aysén del General Carlos Ibáñez del Campo'] },
  'CL-MA': { es: 'Magallanes', en: 'Magallanes', lo: 'Magallanes y de la Antártica Chilena', al: ['Magallanes y de la Antártica Chilena', 'Magallanes y Antártica Chilena'] },
  'CL-BI': { es: 'Biobío', en: 'Biobío', al: ['Bío-Bío', 'Bio Bio'] },
  'CL-AR': { es: 'La Araucanía', al: ['Araucanía'] },
  // Kazajistán: la capital recuperó su nombre en 2022 y Kazajistán Meridional se llama Turkestán desde 2018
  'KZ-AST': { es: 'Astaná', en: 'Astana', lo: 'Astana', al: ['Nur-Sultán', 'Nur-Sultan', 'Nursultán', 'Astana ciudad'] },
  'KZ-YUZ': { es: 'Turkestán', en: 'Turkistan', lo: 'Türkistan', al: ['Kazajistán Meridional', 'Turquestán', 'South Kazakhstan', 'Turkestan'] },
  // Venezuela
  'VE-A': { es: 'Distrito Capital', en: 'Capital District', al: ['Caracas'] },
  'VE-X': { es: 'La Guaira', en: 'La Guaira', al: ['Vargas'] },
  // Bolivia / Ecuador / Paraguay
  'BO-B': { es: 'Beni', al: ['El Beni'] },
  // España (provincias): Spanish exonym first, official/co-official form as "local"
  'ES-BI': { es: 'Vizcaya', en: 'Biscay', lo: 'Bizkaia', al: ['Bizkaia'] },
  'ES-SS': { es: 'Guipúzcoa', en: 'Gipuzkoa', lo: 'Gipuzkoa', al: ['Gipuzkoa'] },
  'ES-VI': { es: 'Álava', en: 'Álava', lo: 'Araba/Álava', al: ['Araba'] },
  'ES-C': { es: 'La Coruña', en: 'A Coruña', lo: 'A Coruña', al: ['A Coruña', 'Coruña'] },
  'ES-OR': { es: 'Orense', en: 'Ourense', lo: 'Ourense', al: ['Ourense'] },
  'ES-GI': { es: 'Gerona', en: 'Girona', lo: 'Girona', al: ['Girona'] },
  'ES-L': { es: 'Lérida', en: 'Lleida', lo: 'Lleida', al: ['Lleida'] },
  'ES-PM': { es: 'Islas Baleares', en: 'Balearic Islands', lo: 'Illes Balears', al: ['Baleares', 'Illes Balears', 'Islas Baleares'] },
  'ES-CS': { es: 'Castellón', en: 'Castellón', lo: 'Castelló/Castellón', al: ['Castelló', 'Castellón de la Plana'] },
  'ES-A': { es: 'Alicante', en: 'Alicante', lo: 'Alacant/Alicante', al: ['Alacant'] },
  'ES-V': { es: 'Valencia', en: 'Valencia', lo: 'València/Valencia', al: ['València'] },
  'ES-O': { es: 'Asturias', en: 'Asturias', al: ['Principado de Asturias', 'Oviedo'] },
  'ES-S': { es: 'Cantabria', en: 'Cantabria', al: ['Santander'] },
  'ES-NA': { es: 'Navarra', en: 'Navarre', lo: 'Navarra', al: ['Nafarroa', 'Comunidad Foral de Navarra'] },
  'ES-LO': { es: 'La Rioja', en: 'La Rioja', al: ['Rioja', 'Logroño'] },
  'ES-M': { es: 'Madrid', en: 'Madrid', al: ['Comunidad de Madrid'] },
  'ES-MU': { es: 'Murcia', en: 'Murcia', al: ['Región de Murcia'] },
  'ES-GC': { es: 'Las Palmas', en: 'Las Palmas', al: ['Las Palmas de Gran Canaria', 'Gran Canaria'] },
  'ES-TF': { es: 'Santa Cruz de Tenerife', en: 'Santa Cruz de Tenerife', al: ['Tenerife', 'Santa Cruz'] },
  // Estados Unidos
  'US-DC': { es: 'Washington D. C.', en: 'District of Columbia', lo: 'District of Columbia', al: ['Distrito de Columbia', 'Washington DC', 'DC'] },
  'US-WA': { es: 'Washington', en: 'Washington', al: ['Estado de Washington', 'Washington State'] },
  'US-NY': { es: 'Nueva York', en: 'New York', al: ['Estado de Nueva York'] },
  // Suiza / Alemania
  'CH-GR': { es: 'Grisones', en: 'Grisons', lo: 'Graubünden', al: ['Graubünden', 'Grigioni', 'Grischun'] },
  'DE-HB': { es: 'Bremen', en: 'Bremen', lo: 'Bremen', al: ['Brema'] },
  'DE-NW': { es: 'Renania del Norte-Westfalia', al: ['Renania Westfalia', 'Renania del Norte Westfalia', 'NRW'] },
  'DE-MV': { es: 'Mecklemburgo-Pomerania Occidental', al: ['Mecklemburgo Antepomerania', 'Mecklemburgo'] },
  // Rusia / Ucrania
  'RU-MOS': { es: 'Óblast de Moscú', en: 'Moscow Oblast', lo: 'Moskovskaya oblast', al: ['Región de Moscú', 'Provincia de Moscú'] },
  'RU-MOW': { es: 'Moscú', en: 'Moscow', lo: 'Moskva', al: ['Moscú ciudad'] },
  'RU-AL': { es: 'República de Altái', en: 'Altai Republic', lo: 'Respublika Altay', al: ['Altái República', 'Gorno-Altái', 'Gorno-Altay'] },
  'RU-ALT': { es: 'Krai de Altái', en: 'Altai Krai', lo: 'Altayskiy kray', al: ['Altái Krai', 'Territorio de Altái'] },
  'RU-LEN': { es: 'Óblast de Leningrado', en: 'Leningrad Oblast', lo: 'Leningradskaya oblast', al: ['Leningrado'] },
  'RU-SPE': { es: 'San Petersburgo', en: 'Saint Petersburg', lo: 'Sankt-Peterburg' },
  'UA-43': { es: 'Crimea', en: 'Crimea', lo: 'Krym', al: ['República Autónoma de Crimea'] },
  'UA-40': { es: 'Sebastopol', en: 'Sevastopol', lo: 'Sevastopol' },
  // Otros
  'SY-RD': { es: 'Campiña de Damasco', en: 'Rif Dimashq', lo: 'Rif Dimashq', al: ['Damasco Campo', 'Rural Damascus'] },
  'CU-03': { es: 'La Habana', en: 'Havana', lo: 'La Habana', al: ['Ciudad de La Habana'] },
  'SO-SOL': { es: 'Somalilandia', en: 'Somaliland', lo: 'Somaliland' },
  'EH-WS': { es: 'Sahara Occidental', en: 'Western Sahara', lo: 'Sahara Occidental' },
  'CY-NC': { es: 'Chipre del Norte', en: 'Northern Cyprus', lo: 'Kuzey Kıbrıs' },
  'CY-DH': { es: 'Dekelia (base británica)', en: 'Dhekelia', lo: 'Dhekelia' },
  'CY-AK': { es: 'Akrotiri (base británica)', en: 'Akrotiri', lo: 'Akrotiri' },
  'MA-14': { es: 'Guelmim-Esmara', en: 'Guelmim-Es Semara', lo: 'Guelmim-Es Semara', al: ['Guelmim', 'Guelmim Es Semara'] },
  'SY-QU': { es: 'Quneitra', en: 'Quneitra', lo: 'Al-Qunayṭirah', al: ['Kuneitra', 'Al Qunaytirah'] },
  'CA-QC': { es: 'Quebec', en: 'Quebec', lo: 'Québec' },
  'AU-ACT': { es: 'Territorio de la Capital Australiana', al: ['ACT', 'Canberra'] },
  // Abbreviations in common use that the initials of the name do not spell (those are accepted by rule).
  'CA-NT': { al: ['NWT'] },
  'ZA-NL': { al: ['KZN'] },
  'CN-XZ': { es: 'Tíbet', en: 'Tibet', lo: 'Xizang', al: ['Xizang'] },
  'CN-NM': { es: 'Mongolia Interior', en: 'Inner Mongolia', lo: 'Nei Mongol', al: ['Nei Mongol', 'Inner Mongol'] },
  'CN-XJ': { es: 'Xinjiang', en: 'Xinjiang', al: ['Sinkiang'] },
  'IN-OR': { es: 'Odisha', en: 'Odisha', al: ['Orissa'] },
  'JP-13': { es: 'Tokio', en: 'Tokyo', lo: 'Tōkyō', al: ['Tokyo'] },
  'JP-26': { es: 'Kioto', en: 'Kyoto', lo: 'Kyōto', al: ['Kyoto'] },
  'JP-27': { es: 'Osaka', en: 'Osaka', lo: 'Ōsaka' },
  // Names put right in SOURCE_FIX: other names they go by, and the one they went by before.
  'IT-BZ': { al: ['Bozen', 'Alto Adigio', 'Alto Adige', 'Tirol del Sur', 'Südtirol'] },
  'GB-LND': { al: ['City', 'La City', 'Square Mile'] },
  'LY-TN': { al: ["Tajura' wa an Nawahi al Arba", 'Tripoli District'] },
  'ET-SN': { al: ['Naciones del Sur', 'Pueblos del Sur', 'Southern Nations', 'SNNPR', 'SNNP'] },
  'ZA-EC': { al: ['Provincia Oriental del Cabo', 'Oriental del Cabo', 'Cabo del Este'] },
  'ZA-NC': { al: ['Provincia Septentrional del Cabo', 'Septentrional del Cabo', 'Cabo del Norte'] },
  'ZA-WC': { al: ['Provincia Occidental del Cabo', 'Occidental del Cabo', 'Cabo del Oeste'] },
  'TJ-SU': { al: ['Leninabad', 'Sogdia', 'Sugd'] },
  'DO-07': { al: ['La Estrelleta'] },
  'DO-19': { al: ['Salcedo'] },
  'NA-CA': { al: ['Caprivi'] },
  'BT-31': { al: ['Geylegphug', 'Gelephu'] },
  'BT-14': { al: ['Samchi'] },
  'TM-D': { al: ['Tashauz', 'Dashoguz'] },
  'TM-L': { al: ['Chardzhou'] },
  'AZ-GYG': { al: ['Xanlar', 'Khanlar'] },
  'AZ-SBN': { al: ['Dəvəçi', 'Davachi'] },
  'PH-COM': { al: ['Compostela Valley', 'Valle de Compostela'] },
  'PG-NSB': { al: ['North Solomons', 'Salomón del Norte'] },
  'NI-AN': { al: ['Atlántico Norte', 'RACCN', 'RAAN'] },
  'NI-AS': { al: ['Atlántico Sur', 'RACCS', 'RAAS'] },
  'TJ-x368': { es: 'Región bajo subordinación republicana', al: ['Subordinación republicana', 'Tadzhikistan Territories', 'Region of Republican Subordination', 'RRP', 'DRS'] },
  'PK-IS': { al: ['Territorio Capital de Islamabad', 'FCT'] },
  // Two districts of one name on different islands: the island in brackets is shown and need not be typed.
  'MT-65': { es: 'Żebbuġ (Gozo)', en: 'Żebbuġ (Gozo)', lo: 'Iż-Żebbuġ', al: ['Żebbuġ Għawdex'] },
  'MT-66': { es: 'Żebbuġ (Malta)', en: 'Żebbuġ (Malta)', lo: 'Ħaż-Żebbuġ' },
  // Names the source has right in a field the rules do not believe (the country is not among those whose
  // Spanish labels are trusted, and the label does not resemble the local name), or cut short.
  'PM-x4866': { al: ['San Pedro'] },
  'AE-x344': { es: 'Zona neutral', en: 'Neutral Zone' },
  'AE-x347': { es: 'Zona neutral', en: 'Neutral Zone' },
  'BH-14': { es: 'Sur', al: ['Meridional'] },
  'KM-G': { es: 'Gran Comora', en: 'Grande Comore', al: ['Ngazidja'] },
  'GM-W': { es: 'West Coast', al: ['Western'] },
  'FJ-N': { es: 'Norte' },
  'FJ-E': { es: 'Oriental', al: ['Este'] },
  'FJ-W': { es: 'Occidental', al: ['Oeste'] },
  'RU-YEV': { en: 'Jewish Autonomous Oblast' },
  // The name in use in Spanish where the source gives another one that is right too, and the other way round.
  'PS-WBK': { es: 'Cisjordania', al: ['Ribera Occidental'] },
  'SD-DW': { al: ['Darfur Occidental'] },
  'VN-SG': { al: ['Ho Chi Minh', 'Saigón', 'Saigon'] },
  'TZ-06': { al: ['Pemba North'] },
  'TZ-10': { al: ['Pemba South'] },
  'TZ-07': { al: ['Zanzibar North'] },
  'TZ-11': { al: ['Zanzibar Central/South', 'Zanzíbar Sur'] },
  'TZ-15': { al: ['Zanzibar Urban/West', 'Zanzíbar Oeste'] },
  'OM-BA': { al: ['Al Batnah North'] },
  'OM-BJ': { al: ['Al Batnah South'] },
  'OM-SH': { al: ['Oriental', 'Ash Sharqiyah'] },
  'OM-SS': { al: ['Norte del Ash Sharqiyah'] },
  'AI-x5126': { al: ['El Valle'] },
  'AI-x5119': { al: ['Lado norte'] },
  // Eritrea's two regions on the Red Sea keep their names in Tigrinya, as the other four do; what they mean is taken too.
  'ER-SK': { al: ['Mar Rojo Septentrional', 'Mar Rojo del Norte'] },
  'ER-DK': { al: ['Mar Rojo Meridional', 'Mar Rojo del Sur'] },
  'AZ-XA': { al: ['Khankendi', 'Xankəndi', 'Jankendi'] },
  'HK-x5158': { es: 'Kowloon City', al: ['Ciudad de Kowloon'] }, // not Kowloon, which is five districts
  // The Spanish name of the capital, for the unit that is called after it.
  'AD-07': { es: 'Andorra la Vieja' },
  'JO-AM': { es: 'Amán' },
  'MW-LI': { es: 'Lilongüe' },
  'OM-MA': { es: 'Mascate' },
  'AE-SH': { es: 'Sarja' },
  'SS-JG': { al: ['Junqali'] },
  'TW-PEN': { al: ['Islas Pescadores', 'Pescadores'] },
};

/**
 * Units whose Spanish label is right although nothing in the rules says so: the country is not in
 * TRUST_ES and the label looks nothing like the local name, because it is a translation («Nilo Azul» for
 * Blue Nile, «Tierras Altas Orientales» for Eastern Highlands) or the name the place has in Spanish
 * («Jartum», «Tiflis», «Yibuti», «Yamena»). Without it the game showed the English or French name and did
 * not even take the Spanish one when typed.
 *
 * The build lists every label it turns down at the end of .cache/report.txt: these are the ones that,
 * read one by one, are right. The rest of that list are labels of another place, and stay out.
 */
export const TRUST_ES_UNIT = new Set(
  [
    'SD-KH SD-NB SD-NR SD-NW SD-RS', // Jartum, Nilo Azul, Río Nilo, Nilo Blanco, Mar Rojo
    'SS-EE SS-EW SS-LK SS-NU SS-UY', // Ecuatoria Oriental y Occidental, Lagos, Alto Nilo, Unidad
    'GE-AB GE-KA GE-TB', // Abjasia, Kajetia, Tiflis
    'PG-EBR PG-WBK PG-EHG PG-SHM PG-WHM PG-NIK PG-GPK', // Nueva Bretaña, Tierras Altas, Nueva Irlanda, Golfo
    'AF-BAL AF-KHO', // Balj, Jost
    'MR-01 MR-02', // Hod Oriental, Hod Occidental
    'BT-15 DJ-DJ TD-ND X1-x00', // Timbu, Yibuti, Yamena, Cachemira
    'SH-HL VI-x4869 VI-x4870 TC-x5008', // Santa Elena; San Juan, Santa Cruz; Cayo Sal
    'PH-MOU', // La Montaña
    'GL-UO', // Parque nacional del noreste de Groenlandia
  ]
    .join(' ')
    .split(' '),
);

/**
 * The same for the English label: the name the place has in English («Northern Red Sea», «Lower Juba»,
 * «Capital», «French Guiana») or the usual spelling of it («Sheki», «Kratié») where the local name is in
 * another language or another alphabet's spelling.
 */
export const TRUST_EN_UNIT = new Set(
  [
    'AZ-QAX AZ-SA AZ-SMI AZ-XAC AZ-XCI AZ-XIZ AZ-XVD', // Qakh, Sheki, Shamakhi, Khachmaz, Khojali, Khizi, Khojavend
    'SO-JD SO-JH SO-SD SO-SH', // Middle and Lower Juba, Middle and Lower Shebelle
    'BH-13 BH-14 BH-16 BH-17', // Capital, Southern, Central, Northern
    'ER-DK ER-SK', // Southern and Northern Red Sea
    'KH-10 KH-15', // Kratié, Pursat
    'NC-x1259 NC-x559', // South, North
    'PG-NPP SB-CT', // Oro, Honiara
    'FR-GF LA-XA', // French Guiana, Sainyabuli
  ]
    .join(' ')
    .split(' '),
);

/**
 * Pieces that share their name with another piece of their map, and rightly so: a city and the district,
 * the county or the region around it, each a unit of its own, both called after the city. They are told
 * apart by the kind of unit shown under the name. The build warns of any two pieces of a level that go by
 * one name and are not both listed here, because every other case so far was a label that had come from
 * another place.
 */
export const HOMONYMS = new Set(
  `AZ-SUS AZ-x5565  BG-22 BG-23  BM-HA BM-HAM  BY-HM BY-MI  HR-01 HR-21  HU-VE HU-VM  LA-VI LA-VT  TW-HSQ TW-HSZ  TW-CYI TW-CYQ  UA-30 UA-32  UZ-TK UZ-TO  YE-SA YE-SN
   LV-x1081 LV-x4850  LV-x1084 LV-x4849  LV-x1085 LV-x5725  LV-x4852 LV-x934  LV-x1066 LV-x4851`.split(/\s+/),
);

// ---------------------------------------------------------------------------
// Levels: countries that get a coarser grouping on top of their units
// ---------------------------------------------------------------------------

const lv = (es, en, sg) => ({ es, en, sg });

/**
 * `fine`  : label for the finest level (always present).
 * `groups`: optional coarser levels, each grouping fine units by a key.
 *           `key(p)` returns the group key; `names[key]` gives id + names.
 *           Units whose key is null stay out of that level (it is skipped
 *           entirely if any quiz unit is left out, unless `patch` fixes it).
 * `def`   : which level opens by default ('fine' or a group id).
 */
export const LEVELS = {
  ES: {
    fine: lv('provincias', 'provinces', 'provincia'),
    def: 'g1',
    groups: [
      {
        id: 'g1',
        label: lv('comunidades autónomas', 'autonomous communities', 'comunidad autónoma'),
        key: (p) => p.region,
        names: {
          Andalucía: ['ES-AN', 'Andalucía', 'Andalusia'],
          Aragón: ['ES-AR', 'Aragón', 'Aragon'],
          Asturias: ['ES-AS', 'Asturias', 'Asturias', null, ['Principado de Asturias']],
          'Islas Baleares': ['ES-IB', 'Islas Baleares', 'Balearic Islands', 'Illes Balears', ['Baleares', 'Illes Balears']],
          'Canary Is.': ['ES-CN', 'Canarias', 'Canary Islands', null, ['Islas Canarias']],
          Cantabria: ['ES-CB', 'Cantabria', 'Cantabria'],
          'Castilla y León': ['ES-CL', 'Castilla y León', 'Castile and León'],
          'Castilla-La Mancha': ['ES-CM', 'Castilla-La Mancha', 'Castilla–La Mancha', null, ['Castilla la Mancha']],
          Cataluña: ['ES-CT', 'Cataluña', 'Catalonia', 'Catalunya', ['Catalunya']],
          Valenciana: ['ES-VC', 'Comunidad Valenciana', 'Valencian Community', 'Comunitat Valenciana', ['Valencia', 'Comunitat Valenciana', 'País Valenciano', 'Comunidad de Valencia']],
          Extremadura: ['ES-EX', 'Extremadura', 'Extremadura'],
          Galicia: ['ES-GA', 'Galicia', 'Galicia', null, ['Galiza']],
          'La Rioja': ['ES-RI', 'La Rioja', 'La Rioja', null, ['Rioja']],
          Madrid: ['ES-MD', 'Comunidad de Madrid', 'Community of Madrid', null, ['Madrid']],
          Murcia: ['ES-MC', 'Región de Murcia', 'Region of Murcia', null, ['Murcia']],
          'Foral de Navarra': ['ES-NC', 'Navarra', 'Navarre', null, ['Comunidad Foral de Navarra', 'Nafarroa']],
          'País Vasco': ['ES-PV', 'País Vasco', 'Basque Country', 'Euskadi', ['Euskadi', 'Vascongadas']],
          Ceuta: ['ES-CE', 'Ceuta', 'Ceuta'],
          Melilla: ['ES-ML', 'Melilla', 'Melilla'],
        },
      },
    ],
  },
  FR: {
    fine: lv('departamentos', 'departments', 'departamento'),
    def: 'g1',
    groups: [
      {
        id: 'g1',
        label: lv('regiones', 'regions', 'región'),
        key: (p) => p.region,
        names: {
          'Auvergne-Rhône-Alpes': ['FR-ARA', 'Auvernia-Ródano-Alpes', 'Auvergne-Rhône-Alpes', 'Auvergne-Rhône-Alpes'],
          'Bourgogne-Franche-Comté': ['FR-BFC', 'Borgoña-Franco Condado', 'Bourgogne-Franche-Comté', 'Bourgogne-Franche-Comté', ['Borgoña']],
          Bretagne: ['FR-BRE', 'Bretaña', 'Brittany', 'Bretagne'],
          'Centre-Val de Loire': ['FR-CVL', 'Centro-Valle de Loira', 'Centre-Val de Loire', 'Centre-Val de Loire', ['Centro', 'Centro Valle del Loira']],
          Corse: ['FR-COR', 'Córcega', 'Corsica', 'Corse'],
          'Grand Est': ['FR-GES', 'Gran Este', 'Grand Est', 'Grand Est'],
          'Hauts-de-France': ['FR-HDF', 'Alta Francia', 'Hauts-de-France', 'Hauts-de-France'],
          'Île-de-France': ['FR-IDF', 'Isla de Francia', 'Île-de-France', 'Île-de-France'],
          Normandie: ['FR-NOR', 'Normandía', 'Normandy', 'Normandie'],
          'Nouvelle-Aquitaine': ['FR-NAQ', 'Nueva Aquitania', 'Nouvelle-Aquitaine', 'Nouvelle-Aquitaine', ['Aquitania']],
          Occitanie: ['FR-OCC', 'Occitania', 'Occitania', 'Occitanie'],
          'Pays de la Loire': ['FR-PDL', 'Países del Loira', 'Pays de la Loire', 'Pays de la Loire', ['País del Loira']],
          "Provence-Alpes-Côte-d'Azur": ['FR-PAC', 'Provenza-Alpes-Costa Azul', "Provence-Alpes-Côte d'Azur", "Provence-Alpes-Côte d'Azur", ['Provenza', 'PACA']],
        },
      },
    ],
  },
  IT: {
    fine: lv('provincias', 'provinces', 'provincia'),
    def: 'g1',
    groups: [
      {
        id: 'g1',
        label: lv('regiones', 'regions', 'región'),
        key: (p) => p.region,
        names: {
          "Valle d'Aosta": ['IT-23', 'Valle de Aosta', 'Aosta Valley', "Valle d'Aosta"],
          Abruzzo: ['IT-65', 'Abruzos', 'Abruzzo', 'Abruzzo', ['Abruzzo']],
          Apulia: ['IT-75', 'Apulia', 'Apulia', 'Puglia', ['Puglia', 'Pulla']],
          Basilicata: ['IT-77', 'Basilicata', 'Basilicata', 'Basilicata'],
          Calabria: ['IT-78', 'Calabria', 'Calabria', 'Calabria'],
          Campania: ['IT-72', 'Campania', 'Campania', 'Campania'],
          'Emilia-Romagna': ['IT-45', 'Emilia-Romaña', 'Emilia-Romagna', 'Emilia-Romagna'],
          'Friuli-Venezia Giulia': ['IT-36', 'Friul-Venecia Julia', 'Friuli-Venezia Giulia', 'Friuli-Venezia Giulia', ['Friuli']],
          Lazio: ['IT-62', 'Lacio', 'Lazio', 'Lazio'],
          Liguria: ['IT-42', 'Liguria', 'Liguria', 'Liguria'],
          Lombardia: ['IT-25', 'Lombardía', 'Lombardy', 'Lombardia'],
          Marche: ['IT-57', 'Marcas', 'Marche', 'Marche', ['Las Marcas']],
          Molise: ['IT-67', 'Molise', 'Molise', 'Molise'],
          Piemonte: ['IT-21', 'Piamonte', 'Piedmont', 'Piemonte'],
          Sardegna: ['IT-88', 'Cerdeña', 'Sardinia', 'Sardegna'],
          Sicily: ['IT-82', 'Sicilia', 'Sicily', 'Sicilia'],
          Toscana: ['IT-52', 'Toscana', 'Tuscany', 'Toscana'],
          'Trentino-Alto Adige': ['IT-32', 'Trentino-Alto Adigio', 'Trentino-South Tyrol', 'Trentino-Alto Adige', ['Trentino', 'Tirol del Sur']],
          Umbria: ['IT-55', 'Umbría', 'Umbria', 'Umbria'],
          Veneto: ['IT-34', 'Véneto', 'Veneto', 'Veneto'],
        },
      },
    ],
  },
  GB: {
    fine: lv('condados y distritos', 'counties and districts', 'condado o distrito'),
    def: 'g2',
    groups: [
      {
        id: 'g1',
        label: lv('naciones', 'nations', 'nación'),
        key: (p) => p.geonunit,
        names: {
          England: ['GB-ENG', 'Inglaterra', 'England', 'England'],
          Scotland: ['GB-SCT', 'Escocia', 'Scotland', 'Scotland'],
          Wales: ['GB-WLS', 'Gales', 'Wales', 'Cymru', ['Cymru', 'País de Gales']],
          'Northern Ireland': ['GB-NIR', 'Irlanda del Norte', 'Northern Ireland', 'Northern Ireland', ['Ulster']],
        },
      },
      {
        id: 'g2',
        label: lv('naciones y regiones', 'nations and regions', 'nación o región'),
        key: (p) => (p.geonunit === 'England' ? 'E:' + p.region : p.geonunit),
        names: {
          'E:East Midlands': ['GB-E-EM', 'Midlands Orientales', 'East Midlands', 'East Midlands'],
          'E:East': ['GB-E-EE', 'Este de Inglaterra', 'East of England', 'East of England', ['Este']],
          'E:Greater London': ['GB-E-LN', 'Londres', 'London', 'London', ['Gran Londres', 'Greater London']],
          'E:North East': ['GB-E-NE', 'Nordeste de Inglaterra', 'North East England', 'North East', ['Nordeste', 'Noreste', 'Noreste de Inglaterra']],
          'E:North West': ['GB-E-NW', 'Noroeste de Inglaterra', 'North West England', 'North West', ['Noroeste']],
          'E:South East': ['GB-E-SE', 'Sudeste de Inglaterra', 'South East England', 'South East', ['Sudeste', 'Sureste', 'Sureste de Inglaterra']],
          'E:South West': ['GB-E-SW', 'Sudoeste de Inglaterra', 'South West England', 'South West', ['Sudoeste', 'Suroeste', 'Suroeste de Inglaterra']],
          'E:West Midlands': ['GB-E-WM', 'Midlands Occidentales', 'West Midlands', 'West Midlands'],
          'E:Yorkshire and the Humber': ['GB-E-YH', 'Yorkshire y Humber', 'Yorkshire and the Humber', 'Yorkshire and the Humber', ['Yorkshire']],
          Scotland: ['GB-SCT', 'Escocia', 'Scotland', 'Scotland'],
          Wales: ['GB-WLS', 'Gales', 'Wales', 'Cymru', ['Cymru', 'País de Gales']],
          'Northern Ireland': ['GB-NIR', 'Irlanda del Norte', 'Northern Ireland', 'Northern Ireland', ['Ulster']],
        },
      },
    ],
  },
  BE: {
    fine: lv('provincias', 'provinces', 'provincia'),
    def: 'fine',
    groups: [
      {
        id: 'g1',
        label: lv('regiones', 'regions', 'región'),
        key: (p) => p.geonunit,
        names: {
          'Flemish Region': ['BE-VLG', 'Flandes', 'Flanders', 'Vlaanderen', ['Región Flamenca', 'Vlaanderen']],
          'Walloon Region': ['BE-WAL', 'Valonia', 'Wallonia', 'Wallonie', ['Región Valona', 'Wallonie']],
          'Brussels Capital Region': ['BE-BRU', 'Bruselas', 'Brussels', 'Bruxelles', ['Región de Bruselas-Capital', 'Bruselas-Capital', 'Bruxelles']],
        },
      },
    ],
  },
  JP: {
    fine: lv('prefecturas', 'prefectures', 'prefectura'),
    def: 'fine',
    groups: [
      {
        id: 'g1',
        label: lv('regiones', 'regions', 'región'),
        key: (p) => ({ 'JP-41': 'Kyushu', 'JP-42': 'Kyushu', 'JP-47': 'Kyushu' })[p.iso_3166_2] || p.region,
        names: {
          Hokkaido: ['JP-R1', 'Hokkaidō', 'Hokkaido', 'Hokkaidō', ['Hokkaido']],
          Tohoku: ['JP-R2', 'Tōhoku', 'Tohoku', 'Tōhoku', ['Tohoku']],
          Kanto: ['JP-R3', 'Kantō', 'Kanto', 'Kantō', ['Kanto']],
          Chubu: ['JP-R4', 'Chūbu', 'Chubu', 'Chūbu', ['Chubu']],
          Kinki: ['JP-R5', 'Kansai', 'Kansai', 'Kansai', ['Kinki']],
          Chugoku: ['JP-R6', 'Chūgoku', 'Chugoku', 'Chūgoku', ['Chugoku']],
          Shikoku: ['JP-R7', 'Shikoku', 'Shikoku', 'Shikoku'],
          Kyushu: ['JP-R8', 'Kyūshū y Okinawa', 'Kyushu and Okinawa', 'Kyūshū', ['Kyushu', 'Kyūshū']],
        },
      },
    ],
  },
  US: {
    fine: lv('estados', 'states', 'estado'),
    def: 'fine',
    groups: [
      {
        id: 'g1',
        label: lv('regiones censales', 'census regions', 'región'),
        key: (p) => p.region,
        names: {
          West: ['US-R-W', 'Oeste', 'West', 'West'],
          Midwest: ['US-R-MW', 'Medio Oeste', 'Midwest', 'Midwest'],
          South: ['US-R-S', 'Sur', 'South', 'South'],
          Northeast: ['US-R-NE', 'Nordeste', 'Northeast', 'Northeast', ['Noreste']],
        },
      },
    ],
  },
  SI: { fine: lv('municipios', 'municipalities', 'municipio'), def: 'g1', groups: [{ id: 'g1', label: lv('regiones estadísticas', 'statistical regions', 'región'), key: (p) => p.region }] },
  LV: { fine: lv('municipios', 'municipalities', 'municipio'), def: 'g1', groups: [{ id: 'g1', label: lv('regiones', 'regions', 'región'), key: (p) => p.region }] },
  UG: { fine: lv('distritos', 'districts', 'distrito'), def: 'g1', groups: [{ id: 'g1', label: lv('regiones', 'regions', 'región'), key: (p) => p.region, es: { Central: 'Central', Eastern: 'Oriental', Northern: 'Norte', Western: 'Occidental' } }] },
  // The Philippines, Azerbaijan, Burkina Faso and Guinea are asked by region, and the name of a region
  // was whatever the source writes in the `region` field of its provinces: «Bicol (Region V)», «Absheron
  // Economic Region», «Centre-Est», and «Dinagat Islands (Region XIII)» for Caraga. The ids stay the ones
  // made from those labels (a `null` first), so that nobody's progress is lost.
  PH: {
    fine: lv('provincias', 'provinces', 'provincia'),
    def: 'g1',
    groups: [
      {
        id: 'g1',
        label: lv('regiones', 'regions', 'región'),
        key: (p) => p.region,
        names: {
          'Autonomous Region in Muslim Mindanao (ARMM)': [null, 'Bangsamoro', 'Bangsamoro', null, ['Mindanao Musulmán', 'Muslim Mindanao', 'ARMM', 'BARMM']],
          'Bicol (Region V)': [null, 'Bicol', 'Bicol', null, ['Bicolandia', 'Región V', 'Region V']],
          'Cagayan Valley (Region II)': [null, 'Valle del Cagayán', 'Cagayan Valley', null, ['Valle de Cagayán', 'Cagayán', 'Región II', 'Region II']],
          'CALABARZON (Region IV-A)': [null, 'Calabarzon', 'Calabarzon', null, ['Región IV-A', 'Region IV-A']],
          'Central Luzon (Region III)': [null, 'Luzón Central', 'Central Luzon', null, ['Región III', 'Region III']],
          'Central Visayas (Region VII)': [null, 'Bisayas Centrales', 'Central Visayas', null, ['Visayas Centrales', 'Región VII', 'Region VII']],
          'Cordillera Administrative Region (CAR)': [null, 'La Cordillera', 'Cordillera', null, ['Región Administrativa de La Cordillera', 'Cordillera Administrative Region', 'CAR']],
          'Davao (Region XI)': [null, 'Davao', 'Davao', null, ['Dávao', 'Región XI', 'Region XI']],
          'Dinagat Islands (Region XIII)': [null, 'Caraga', 'Caraga', null, ['Región XIII', 'Region XIII']],
          'Eastern Visayas (Region VIII)': [null, 'Bisayas Orientales', 'Eastern Visayas', null, ['Visayas Orientales', 'Región VIII', 'Region VIII']],
          'Ilocos (Region I)': [null, 'Ilocos', 'Ilocos', null, ['Región I', 'Region I']],
          'MIMAROPA (Region IV-B)': [null, 'Mimaropa', 'Mimaropa', null, ['Región IV-B', 'Region IV-B']],
          'National Capital Region': [null, 'Gran Manila', 'Metro Manila', null, ['Región de la Capital Nacional', 'National Capital Region', 'NCR', 'Manila']],
          'Northern Mindanao (Region X)': [null, 'Mindanao del Norte', 'Northern Mindanao', null, ['Mindanao Septentrional', 'Región X', 'Region X']],
          'SOCCSKSARGEN (Region XII)': [null, 'Soccsksargen', 'Soccsksargen', null, ['Región XII', 'Region XII']],
          'Western Visayas (Region VI)': [null, 'Bisayas Occidentales', 'Western Visayas', null, ['Visayas Occidentales', 'Región VI', 'Region VI']],
          'Zamboanga Peninsula (Region IX)': [null, 'Península de Zamboanga', 'Zamboanga Peninsula', null, ['Zamboanga', 'Región IX', 'Region IX']],
        },
      },
    ],
  },
  AZ: {
    fine: lv('distritos', 'districts', 'distrito'),
    def: 'g1',
    groups: [
      {
        id: 'g1',
        label: lv('regiones económicas', 'economic regions', 'región'),
        key: (p) => p.region,
        names: {
          'Absheron Economic Region': [null, 'Absheron', 'Absheron', 'Abşeron', ['Apsheron', 'Absherón']],
          'Aran Economic Region': [null, 'Aran', 'Aran'],
          'Daghlig Shirvan Economic Region': [null, 'Daghlig Shirvan', 'Daghlig Shirvan', 'Dağlıq Şirvan', ['Shirvan Montañoso', 'Mountainous Shirvan']],
          'Ganja-Gazakh Economic Region': [null, 'Ganja-Gazakh', 'Ganja-Gazakh', 'Gəncə-Qazax', ['Ganja-Qazakh', 'Ganyá-Qazaj']],
          'Guba-Khachmaz Economic Region': [null, 'Guba-Khachmaz', 'Guba-Khachmaz', 'Quba-Xaçmaz', ['Quba-Khachmaz', 'Quba-Jachmaz']],
          'Kalbajar-Lachin Economic Region': [null, 'Kalbajar-Lachín', 'Kalbajar-Lachin', 'Kəlbəcər-Laçın', ['Kelbajar-Lachin']],
          'Lankaran Economic Region': [null, 'Lankaran', 'Lankaran', 'Lənkəran', ['Lenkoran']],
          'Naxçıvan Autonomous Republic': [null, 'Najicheván', 'Nakhchivan', 'Naxçıvan', ['Nakhichevan', 'Najichevan']],
          'Shaki-Zaqatala Economic Region': [null, 'Shaki-Zaqatala', 'Shaki-Zaqatala', 'Şəki-Zaqatala', ['Sheki-Zagatala', 'Sheki-Zaqatala']],
          'Yukhari Garabakh Economic Region': [null, 'Alto Karabaj', 'Upper Karabakh', 'Yuxarı Qarabağ', ['Yukhari Garabakh', 'Yukhari Karabakh', 'Karabaj', 'Karabakh', 'Garabakh']],
        },
      },
    ],
  },
  MT: { fine: lv('localidades', 'localities', 'localidad'), def: 'g1', groups: [{ id: 'g1', label: lv('regiones', 'regions', 'región'), key: (p) => p.region }] },
  BF: {
    fine: lv('provincias', 'provinces', 'provincia'),
    def: 'g1',
    groups: [
      {
        id: 'g1',
        label: lv('regiones', 'regions', 'región'),
        key: (p) => p.region,
        // The names in French stay as the English and the local ones.
        es: { Centre: 'Centro', 'Centre-Est': 'Centro-Este', 'Centre-Nord': 'Centro-Norte', 'Centre-Ouest': 'Centro-Oeste', 'Centre-Sud': 'Centro-Sur', Est: 'Este', Nord: 'Norte', 'Sud-Ouest': 'Sudoeste' },
      },
    ],
  },
  GN: { fine: lv('prefecturas', 'prefectures', 'prefectura'), def: 'g1', groups: [{ id: 'g1', label: lv('regiones', 'regions', 'región'), key: (p) => p.region, es: { Boke: 'Boké', Conakry: 'Conakri' } }] },
  LK: {
    fine: lv('distritos', 'districts', 'distrito'),
    def: 'g1',
    groups: [
      {
        id: 'g1',
        label: lv('provincias', 'provinces', 'provincia'),
        key: (p) => p.region,
        names: {
          'Basnāhira paḷāta': ['LK-1', 'Occidental', 'Western', 'Western'],
          'Madhyama paḷāta': ['LK-2', 'Central', 'Central', 'Central'],
          'Dakuṇu paḷāta': ['LK-3', 'Sur', 'Southern', 'Southern'],
          'Uturu paḷāta': ['LK-4', 'Norte', 'Northern', 'Northern'],
          'Næ̆gĕnahira paḷāta': ['LK-5', 'Oriental', 'Eastern', 'Eastern'],
          'Vayamba paḷāta': ['LK-6', 'Noroeste', 'North Western', 'North Western'],
          'Uturumæ̆da paḷāta': ['LK-7', 'Centro-Norte', 'North Central', 'North Central'],
          'Ūva paḷāta': ['LK-8', 'Uva', 'Uva', 'Uva'],
          'Sabaragamuva paḷāta': ['LK-9', 'Sabaragamuwa', 'Sabaragamuwa', 'Sabaragamuwa'],
        },
      },
    ],
  },
  TH: {
    fine: lv('provincias', 'provinces', 'provincia'),
    def: 'fine',
    groups: [{ id: 'g1', label: lv('regiones', 'regions', 'región'), key: (p) => p.region, es: { Central: 'Central', Eastern: 'Oriental', Northeastern: 'Nordeste', Northern: 'Norte', Southern: 'Sur', Western: 'Occidental' } }],
  },
  MG: {
    fine: lv('regiones', 'regions', 'región'),
    def: 'fine',
    groups: [
      {
        id: 'g1',
        label: lv('provincias', 'provinces', 'provincia'),
        key: (p) => p.iso_3166_2,
        names: {
          'MG-A': ['MG-A', 'Toamasina', 'Toamasina', 'Toamasina'],
          'MG-D': ['MG-D', 'Antsiranana', 'Antsiranana', 'Antsiranana', ['Diego Suárez']],
          'MG-F': ['MG-F', 'Fianarantsoa', 'Fianarantsoa', 'Fianarantsoa'],
          'MG-M': ['MG-M', 'Mahajanga', 'Mahajanga', 'Mahajanga'],
          'MG-T': ['MG-T', 'Antananarivo', 'Antananarivo', 'Antananarivo'],
          'MG-U': ['MG-U', 'Toliara', 'Toliara', 'Toliara', ['Tulear']],
        },
      },
    ],
  },
};

/** Plural noun for a country's finest level when it has no LEVELS entry. */
export const FINE_LABEL = {
  BM: lv('parroquias', 'parishes', 'parroquia'),
  DE: lv('estados federados', 'states', 'estado'),
  AT: lv('estados federados', 'states', 'estado'),
  CH: lv('cantones', 'cantons', 'cantón'),
  PT: lv('distritos y regiones autónomas', 'districts', 'distrito'),
  NL: lv('provincias', 'provinces', 'provincia'),
  IE: lv('condados', 'counties', 'condado'),
  PL: lv('voivodatos', 'voivodeships', 'voivodato'),
  CZ: lv('regiones', 'regions', 'región'),
  SK: lv('regiones', 'regions', 'región'),
  HU: lv('condados', 'counties', 'condado'),
  RO: lv('distritos', 'counties', 'distrito'),
  BG: lv('provincias', 'provinces', 'provincia'),
  GR: lv('periferias', 'regions', 'periferia'),
  SE: lv('provincias', 'counties', 'provincia'),
  NO: lv('provincias', 'counties', 'provincia'),
  FI: lv('regiones', 'regions', 'región'),
  DK: lv('regiones', 'regions', 'región'),
  IS: lv('regiones', 'regions', 'región'),
  EE: lv('condados', 'counties', 'condado'),
  LT: lv('condados', 'counties', 'condado'),
  UA: lv('óblasts', 'oblasts', 'óblast'),
  BY: lv('provincias', 'regions', 'provincia'),
  RU: lv('sujetos federales', 'federal subjects', 'sujeto federal'),
  HR: lv('condados', 'counties', 'condado'),
  RS: lv('distritos', 'districts', 'distrito'),
  AL: lv('condados', 'counties', 'condado'),
  TR: lv('provincias', 'provinces', 'provincia'),
  CA: lv('provincias y territorios', 'provinces and territories', 'provincia o territorio'),
  MX: lv('estados', 'states', 'estado'),
  GT: lv('departamentos', 'departments', 'departamento'),
  HN: lv('departamentos', 'departments', 'departamento'),
  SV: lv('departamentos', 'departments', 'departamento'),
  NI: lv('departamentos', 'departments', 'departamento'),
  CR: lv('provincias', 'provinces', 'provincia'),
  PA: lv('provincias y comarcas', 'provinces', 'provincia'),
  CU: lv('provincias', 'provinces', 'provincia'),
  DO: lv('provincias', 'provinces', 'provincia'),
  CO: lv('departamentos', 'departments', 'departamento'),
  VE: lv('estados', 'states', 'estado'),
  EC: lv('provincias', 'provinces', 'provincia'),
  PE: lv('departamentos', 'regions', 'departamento'),
  BO: lv('departamentos', 'departments', 'departamento'),
  CL: lv('regiones', 'regions', 'región'),
  AR: lv('provincias', 'provinces', 'provincia'),
  UY: lv('departamentos', 'departments', 'departamento'),
  PY: lv('departamentos', 'departments', 'departamento'),
  BR: lv('estados', 'states', 'estado'),
  AU: lv('estados y territorios', 'states and territories', 'estado o territorio'),
  NZ: lv('regiones', 'regions', 'región'),
  CN: lv('provincias', 'provinces', 'provincia'),
  IN: lv('estados y territorios', 'states and territories', 'estado o territorio'),
  PK: lv('provincias y territorios', 'provinces', 'provincia'),
  ID: lv('provincias', 'provinces', 'provincia'),
  MY: lv('estados', 'states', 'estado'),
  VN: lv('provincias', 'provinces', 'provincia'),
  KR: lv('provincias y ciudades', 'provinces', 'provincia'),
  KP: lv('provincias', 'provinces', 'provincia'),
  IR: lv('provincias', 'provinces', 'provincia'),
  IQ: lv('gobernaciones', 'governorates', 'gobernación'),
  SA: lv('provincias', 'provinces', 'provincia'),
  EG: lv('gobernaciones', 'governorates', 'gobernación'),
  MA: lv('regiones', 'regions', 'región'),
  DZ: lv('provincias', 'provinces', 'provincia'),
  TN: lv('gobernaciones', 'governorates', 'gobernación'),
  NG: lv('estados', 'states', 'estado'),
  ZA: lv('provincias', 'provinces', 'provincia'),
  KE: lv('provincias', 'provinces', 'provincia'),
  ET: lv('regiones', 'regions', 'región'),
  AE: lv('emiratos', 'emirates', 'emirato'),
  KZ: lv('regiones', 'regions', 'región'),
  MN: lv('provincias', 'provinces', 'provincia'),
  AF: lv('provincias', 'provinces', 'provincia'),
  BA: lv('cantones y regiones', 'cantons and regions', 'cantón o región'),
  MK: lv('municipios', 'municipalities', 'municipio'),
  US: lv('estados', 'states', 'estado'),
  JP: lv('prefecturas', 'prefectures', 'prefectura'),
};

/** Natural Earth `type_en` → Spanish [singular, plural]. */
export const TYPE_ES = {
  Province: ['provincia', 'provincias'],
  District: ['distrito', 'distritos'],
  Region: ['región', 'regiones'],
  State: ['estado', 'estados'],
  County: ['condado', 'condados'],
  Department: ['departamento', 'departamentos'],
  Departamento: ['departamento', 'departamentos'],
  'Commune|Municipality': ['municipio', 'municipios'],
  Municipality: ['municipio', 'municipios'],
  Prefecture: ['prefectura', 'prefecturas'],
  Préfecture: ['prefectura', 'prefecturas'],
  'Metropolitan department': ['departamento', 'departamentos'],
  'Overseas department': ['departamento de ultramar', 'departamentos de ultramar'],
  'Statistical Region': ['región', 'regiones'],
  Governorate: ['gobernación', 'gobernaciones'],
  'Municipality|Governarate': ['distrito', 'distritos'],
  Parish: ['parroquia', 'parroquias'],
  'Unitary Authority': ['autoridad unitaria', 'autoridades unitarias'],
  'Unitary Authority (wales)': ['autoridad unitaria', 'autoridades unitarias'],
  'Unitary District': ['distrito', 'distritos'],
  'Unitary District (city)': ['distrito', 'distritos'],
  'Unitary Single-Tier County': ['condado', 'condados'],
  'Autonomous Community': ['provincia', 'provincias'],
  'Autonomous City': ['ciudad autónoma', 'ciudades autónomas'],
  Canton: ['cantón', 'cantones'],
  'Metropolitan Borough': ['municipio metropolitano', 'municipios metropolitanos'],
  'London Borough': ['municipio de Londres', 'municipios de Londres'],
  'London Borough (royal)': ['municipio de Londres', 'municipios de Londres'],
  'London Borough (city)': ['municipio de Londres', 'municipios de Londres'],
  'Highly Urbanized City': ['ciudad', 'ciudades'],
  'Independent Component City': ['ciudad', 'ciudades'],
  City: ['ciudad', 'ciudades'],
  'Independent City': ['ciudad', 'ciudades'],
  'Republican City': ['ciudad', 'ciudades'],
  'Provincial City': ['ciudad', 'ciudades'],
  'Federal City': ['ciudad federal', 'ciudades federales'],
  'Capital City': ['capital', 'capitales'],
  'Special City': ['ciudad especial', 'ciudades especiales'],
  'Metropolitan City': ['ciudad metropolitana', 'ciudades metropolitanas'],
  'Capital Metropolitan City': ['capital', 'capitales'],
  'Special self-governing city': ['ciudad autónoma', 'ciudades autónomas'],
  'Autonomous Province': ['provincia autónoma', 'provincias autónomas'],
  'Administrative County': ['condado', 'condados'],
  Division: ['división', 'divisiones'],
  'Urban county': ['ciudad', 'ciudades'],
  Republic: ['república', 'repúblicas'],
  'Autonomous Republic': ['república autónoma', 'repúblicas autónomas'],
  Atoll: ['atolón', 'atolones'],
  Territory: ['territorio', 'territorios'],
  'Voivodeship|Province': ['voivodato', 'voivodatos'],
  'District|Regencies': ['distrito', 'distritos'],
  'Administrative State': ['estado', 'estados'],
  Quarter: ['distrito', 'distritos'],
  'Regional Council': ['región', 'regiones'],
  'Administrative Zone': ['zona', 'zonas'],
  'Union Territory': ['territorio de la Unión', 'territorios de la Unión'],
  Emirate: ['emirato', 'emiratos'],
  'Special Municipality': ['municipio especial', 'municipios especiales'],
  'Autonomous Region': ['región autónoma', 'regiones autónomas'],
  'Automonous Region': ['región autónoma', 'regiones autónomas'],
  'Autonomous region': ['región autónoma', 'regiones autónomas'],
  'Federal District': ['distrito federal', 'distritos federales'],
  'Capital District': ['distrito capital', 'distritos capitales'],
  'Captial District': ['distrito capital', 'distritos capitales'],
  'National District': ['distrito nacional', 'distritos nacionales'],
  'National Capital Area': ['área capital', 'áreas capitales'],
  'Capital Region': ['región capital', 'regiones capitales'],
  'Capital Territory': ['territorio de la capital', 'territorios'],
  Capital: ['capital', 'capitales'],
  Commissiary: ['departamento', 'departamentos'],
  Intendancy: ['departamento', 'departamentos'],
  Dependency: ['dependencia', 'dependencias'],
  'Federal Dependency': ['dependencia federal', 'dependencias federales'],
  'Indigenous Territory': ['comarca indígena', 'comarcas indígenas'],
  'Federal Territory': ['territorio federal', 'territorios federales'],
  'National Territory': ['provincia', 'provincias'],
  Town: ['ciudad', 'ciudades'],
  'Centrally Administered Area': ['territorio', 'territorios'],
  'Economic Prefecture': ['prefectura', 'prefecturas'],
  'Urban Prefecture': ['prefectura', 'prefecturas'],
  Metropolis: ['prefectura', 'prefecturas'],
  Circuit: ['prefectura', 'prefecturas'],
  Commune: ['comuna', 'comunas'],
  'Island Area': ['área insular', 'áreas insulares'],
  'Special Island Authority': ['territorio', 'territorios'],
  Township: ['municipio', 'municipios'],
  Kingdom: ['reino', 'reinos'],
  Principality: ['principado', 'principados'],
};
