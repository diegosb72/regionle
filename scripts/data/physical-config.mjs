// Curated list of the physical features that can be asked: what is in it, under which name and in
// which continent. Natural Earth supplies the shapes; the names here are editorial, because its own
// Spanish labels are uneven and its rivers come cut in stretches under local names.
//
// Every entry: [Spanish name, English name, continents, rank, sources, extra spellings?, options?]
//   continents  EU AS AF AM OC AN, space separated (a sea can wash several)
//   rank        1 = the ones everybody meets at school · 2 = the rest · 3 = only on the map of its own
//               country, where a continent would have no room for it
//   sources     Natural Earth `name` values to merge; "Name@w,s,e,n" keeps only the pieces whose
//               bounding box touches that lon/lat box (needed where several rivers share a name),
//               "Name#w,s,e,n" only the stretches inside the box and "Name!w,s,e,n" the ones outside;
//               a list of [lon, lat] is an outline drawn by hand, for the straits and gulfs that
//               Natural Earth only marks with a label or does not have. And, for Spain, what the
//               Atlas Nacional de España draws (see spain.mjs):
//                 "siane:<code>"   a river by the code the atlas knows it by (several, for the one that
//                                  goes on into Portugal under another code)
//                 "agua:<name>"    a reservoir or a lagoon by the label the atlas gives it
//                 { relief }       the land between two heights inside a box drawn by hand
//                 { land, at }     the island of that country that the point stands on
//                 { coast, box, to }  the corner of the coast of that country that reaches farthest
//                                  towards N, S, E, W… inside the box: a cape
//               And, where Natural Earth has no outline of its own:
//                 { shore, a, b, by }  the coast of that country, as the game draws it, from the corner
//                                  nearest `a` to the one nearest `b` passing by `by`, closed across
//                                  the neck: a peninsula
//                 { tip, to }      the corner of a Natural Earth outline that reaches farthest that way:
//                                  a cape that the source draws as a headland instead of marking it
//   options     h: 1       one of the best known on the map of its country, though not on a continent's
//               co: 'ES'   the countries it is asked in, when the ones worked out from the map are not
//                          the ones wanted
//               t: 'res'   a reservoir, not a lake
//               area: 0    no surface: the outline is only where to click
//               area: 'ocean:pacific' | 'land:Asia'  the surface The World Factbook gives it, instead of the
//                          one of the outline: an ocean with its seas (Natural Earth outlines them apart: its
//                          Arctic Ocean is a third of the Arctic), a continent as the books count it
//                          (Antarctica is drawn without its ice shelves). 'land:A+B' adds two of its entries
//               area: 'outline'  for a continent, which has none otherwise: the surface of what is drawn
//               at: [lon, lat]  where the name is written, when the middle of the biggest piece will not do
//               wd: ''     no link to an encyclopedia, when the one the source gives is about something else
//               kind: 'ocean'  filed under another kind than the list it is in, without changing its id

/** The land above 1000 m on both sides of the border, between the Bay of Biscay and the Mediterranean. */
const PYRENEES = { min: 1000, close: 8, within: [[-2.0, 43.25], [-1.2, 43.3], [0.0, 43.2], [1.5, 43.1], [2.6, 42.85], [3.2, 42.55], [3.2, 42.3], [2.3, 42.1], [1.2, 41.95], [0.2, 42.05], [-0.8, 42.3], [-1.7, 42.65]] };
const CANTABRIAN = { min: 1000, close: 8, within: [[-7.1, 43.15], [-6.0, 43.35], [-4.8, 43.4], [-3.9, 43.35], [-3.3, 43.25], [-3.3, 42.82], [-4.0, 42.7], [-5.0, 42.75], [-6.2, 42.7], [-7.0, 42.6]] };

export const RIVERS = [
  // Africa
  ['Nilo', 'Nile', 'AF', 1, ['Nile', 'El Bahr el Abyad', 'Bahr el Jebel', 'Albert Nile', 'Victoria Nile'], ['Nilo Blanco', 'White Nile']],
  ['Nilo Azul', 'Blue Nile', 'AF', 2, ['El Bahr el Azraq', 'Abay']],
  ['Congo', 'Congo', 'AF', 1, ['Congo', 'Lualaba'], ['Zaire']],
  ['Níger', 'Niger', 'AF', 1, ['Niger']],
  ['Zambeze', 'Zambezi', 'AF', 1, ['Zambezi']],
  ['Orange', 'Orange', 'AF', 1, ['Orange']],
  ['Limpopo', 'Limpopo', 'AF', 2, ['Limpopo']],
  ['Senegal', 'Senegal', 'AF', 2, ['Sénégal']],
  ['Okavango', 'Okavango', 'AF', 2, ['Okavango', 'Cubango'], ['Cubango']],
  ['Ubangui', 'Ubangi', 'AF', 2, ['Ubangi', 'Uele'], ['Oubangui']],
  ['Kasai', 'Kasai', 'AF', 2, ['Kasai']],
  ['Volta', 'Volta', 'AF', 2, ['Volta']],
  ['Benue', 'Benue', 'AF', 2, ['Benue', 'Bénoué'], ['Benué']],
  ['Chari', 'Chari', 'AF', 2, ['Chari']],
  ['Juba', 'Jubba', 'AF', 2, ['Jubba']],
  ['Atbara', 'Atbara', 'AF', 2, ['Atbara']],
  ['Cuanza', 'Cuanza', 'AF', 2, ['Cuanza'], ['Kwanza']],
  ['Cunene', 'Cunene', 'AF', 2, ['Cunene'], ['Kunene']],
  ['Rovuma', 'Ruvuma', 'AF', 2, ['Ruvuma']],
  ['Gambia', 'Gambia', 'AF', 2, ['Gambia']],
  ['Ogooué', 'Ogooué', 'AF', 2, ['Ogooué'], ['Ogoue', 'Ogowe']],
  ['Vaal', 'Vaal', 'AF', 2, ['Vaal']],

  // Asia
  ['Yangtsé', 'Yangtze', 'AS', 1, ['Yangtze', 'Chang Jiang', 'Jinsha', 'Tongtian'], ['Yangtse', 'Yang-Tsé', 'Chang Jiang', 'Río Azul']],
  ['Amarillo', 'Yellow River', 'AS', 1, ['Huang'], ['Huang He', 'Río Amarillo', 'Hoang Ho']],
  ['Mekong', 'Mekong', 'AS', 1, ['Mekong', 'Lancang']],
  ['Ganges', 'Ganges', 'AS', 1, ['Ganges'], ['Ganga']],
  ['Indo', 'Indus', 'AS', 1, ['Indus']],
  ['Brahmaputra', 'Brahmaputra', 'AS', 1, ['Brahmaputra', 'Yarlung', 'Dihang'], ['Yarlung Tsangpo', 'Tsangpo']],
  ['Éufrates', 'Euphrates', 'AS', 1, ['Euphrates', 'Firat', 'Al Furat']],
  ['Tigris', 'Tigris', 'AS', 1, ['Tigris', 'Dicle']],
  ['Obi', 'Ob', 'AS', 1, ['Ob'], ['Ob']],
  ['Irtish', 'Irtysh', 'AS', 2, ['Irtysh', 'Ertis', 'Ertix'], ['Irtysh']],
  ['Yeniséi', 'Yenisey', 'AS', 1, ['Yenisey'], ['Yenisei']],
  ['Lena', 'Lena', 'AS', 1, ['Lena']],
  ['Amur', 'Amur', 'AS', 1, ['Amur', 'Heilong Jiang'], ['Heilong Jiang']],
  ['Kolimá', 'Kolyma', 'AS', 2, ['Kolyma'], ['Kolyma']],
  ['Indigirka', 'Indigirka', 'AS', 2, ['Indigirka']],
  ['Angará', 'Angara', 'AS', 2, ['Angara']],
  ['Aldán', 'Aldan', 'AS', 2, ['Aldan']],
  ['Amu Daria', 'Amu Darya', 'AS', 2, ['Amu  Darya'], ['Amudaria', 'Oxus']],
  ['Sir Daria', 'Syr Darya', 'AS', 2, ['Syr Darya'], ['Sirdaria']],
  ['Salween', 'Salween', 'AS', 2, ['Salween', 'Nu'], ['Saluén', 'Nu']],
  ['Irawadi', 'Irrawaddy', 'AS', 2, ['Ayeyarwady'], ['Irrawaddy', 'Ayeyarwady', 'Irauadi']],
  ['Jordán', 'Jordan', 'AS', 2, ['Jordan']],
  ['Godavari', 'Godavari', 'AS', 2, ['Godävari']],
  ['Krishna', 'Krishna', 'AS', 2, ['Krishna']],
  ['Narmada', 'Narmada', 'AS', 2, ['Narmada']],
  ['Yamuna', 'Yamuna', 'AS', 2, ['Yamuna']],
  ['Sutlej', 'Sutlej', 'AS', 2, ['Sutlej']],
  ['Helmand', 'Helmand', 'AS', 2, ['Helmand']],
  ['Tarim', 'Tarim', 'AS', 2, ['Tarim']],
  ['Rojo (Vietnam)', 'Red River (Vietnam)', 'AS', 2, ['Hong'], ['Río Rojo', 'Song Hong', 'Hong']],
  ['Songhua', 'Songhua', 'AS', 2, ['Songhua'], ['Sungari']],
  ['Chao Phraya', 'Chao Phraya', 'AS', 2, ['Chao Phraya']],
  ['Kurá', 'Kura', 'AS', 2, ['Kura'], ['Kura']],

  // Europe
  ['Volga', 'Volga', 'EU', 1, ['Volga']],
  ['Danubio', 'Danube', 'EU', 1, ['Danube', 'Donau']],
  ['Rin', 'Rhine', 'EU', 1, ['Rhine', 'Rhein', 'Rhin'], ['Rhin']],
  ['Dniéper', 'Dnieper', 'EU', 1, ['Dnipro'], ['Dnipró', 'Dnipro']],
  ['Don', 'Don', 'EU', 1, ['Don@36,45,46,56']],
  ['Ural', 'Ural', 'EU AS', 1, ['Ural']],
  ['Dniéster', 'Dniester', 'EU', 2, ['Dniester']],
  ['Elba', 'Elbe', 'EU', 1, ['Elbe']],
  ['Óder', 'Oder', 'EU', 2, ['Oder'], ['Odra']],
  ['Vístula', 'Vistula', 'EU', 2, ['Vistula']],
  ['Sena', 'Seine', 'EU', 1, ['Seine']],
  ['Loira', 'Loire', 'EU', 1, ['Loire']],
  ['Ródano', 'Rhône', 'EU', 1, ['Rhône'], ['Rhone']],
  ['Garona', 'Garonne', 'EU', 2, ['Garonne']],
  ['Po', 'Po', 'EU', 1, ['Po']],
  ['Tíber', 'Tiber', 'EU', 2, ['Tevere']],
  ['Támesis', 'Thames', 'EU', 1, ['Thames']],
  ['Tajo', 'Tagus', 'EU', 1, ['siane:1006', 'siane:PT301'], ['Tejo']],
  ['Ebro', 'Ebro', 'EU', 1, ['siane:2004'], ['Ebre']],
  ['Duero', 'Douro', 'EU', 1, ['siane:1004', 'siane:PT201'], ['Duero', 'Douro']],
  ['Guadalquivir', 'Guadalquivir', 'EU', 1, ['siane:10094']],
  ['Guadiana', 'Guadiana', 'EU', 1, ['siane:1008', 'siane:PT401']],
  ['Miño', 'Minho', 'EU', 2, ['siane:10038'], ['Miño'], { h: 1 }],
  ['Dvina Septentrional', 'Northern Dvina', 'EU', 2, ['Severnaya Dvina'], ['Dvina del Norte']],
  ['Daugava', 'Daugava', 'EU', 2, ['Daugava'], ['Dvina Occidental', 'Western Dvina']],
  ['Pechora', 'Pechora', 'EU', 2, ['Pechora']],
  ['Kama', 'Kama', 'EU', 2, ['Kama']],
  ['Niemen', 'Neman', 'EU', 2, ['Neman'], ['Nemunas', 'Neman', 'Niemen']],
  ['Sava', 'Sava', 'EU', 2, ['Sava']],
  ['Tisza', 'Tisza', 'EU', 2, ['Tisa'], ['Tisa']],
  ['Mosa', 'Meuse', 'EU', 2, ['Maas'], ['Maas']],
  ['Weser', 'Weser', 'EU', 2, ['Weser']],
  ['Meno', 'Main', 'EU', 2, ['Main']],
  ['Mosela', 'Moselle', 'EU', 2, ['Mosel'], ['Mosel']],
  ['Dordoña', 'Dordogne', 'EU', 2, ['Dordogne']],
  ['Shannon', 'Shannon', 'EU', 2, ['Shannon']],
  ['Severn', 'Severn', 'EU', 2, ['Severn@-5,51,-1,54']],
  ['Neva', 'Neva', 'EU', 2, ['Neva']],
  ['Maritsa', 'Maritsa', 'EU', 2, ['Evros'], ['Evros', 'Meriç']],
  ['Prut', 'Prut', 'EU', 2, ['Prut']],
  ['Moldava', 'Vltava', 'EU', 2, ['Vltava'], ['Vltava']],
  ['Eno', 'Inn', 'EU', 2, ['Inn'], ['Inn']],
  ['Adigio', 'Adige', 'EU', 2, ['Adige']],
  ['Kubán', 'Kuban', 'EU', 2, ['Kuban']],
  ['Donets', 'Donets', 'EU', 2, ['Donets']],
  ['Prípiat', 'Pripyat', 'EU', 2, ['Pripyat'], ['Pripyat', 'Pripiat']],
  ['Varta', 'Warta', 'EU', 2, ['Warta'], ['Warta']],
  ['Escalda', 'Scheldt', 'EU', 2, ['Schelde'], ['Schelde', 'Escaut']],
  ['Marne', 'Marne', 'EU', 2, ['Marne'], ['Marne']],
  ['Oká', 'Oka', 'EU', 2, ['Oka'], ['Oka']],
  ['Drina', 'Drina', 'EU', 2, ['Drina']],

  // The Americas
  ['Misisipi', 'Mississippi', 'AM', 1, ['Mississippi'], ['Mississippi', 'Misisipí']],
  ['Misuri', 'Missouri', 'AM', 1, ['Missouri'], ['Missouri']],
  ['Ohio', 'Ohio', 'AM', 2, ['Ohio']],
  ['Arkansas', 'Arkansas', 'AM', 2, ['Arkansas']],
  ['Tennessee', 'Tennessee', 'AM', 2, ['Tennessee']],
  ['Bravo', 'Rio Grande', 'AM', 1, ['Rio Grande'], ['Río Bravo', 'Río Grande', 'Río Bravo del Norte', 'Bravo del Norte']],
  ['Colorado (EE. UU.)', 'Colorado (USA)', 'AM', 1, ['Colorado@-116,31,-105,41']],
  ['Columbia', 'Columbia', 'AM', 1, ['Columbia@-125,42,-110,53']],
  ['Yukón', 'Yukon', 'AM', 1, ['Yukon']],
  ['Mackenzie', 'Mackenzie', 'AM', 1, ['Mackenzie@-140,60,-110,70']],
  ['San Lorenzo', 'Saint Lawrence', 'AM', 1, ['St. Lawrence'], ['St. Lawrence', 'Saint-Laurent']],
  ['Fraser', 'Fraser', 'AM', 2, ['Fraser@-124,48,-117,55']],
  ['Nelson', 'Nelson', 'AM', 2, ['Nelson']],
  ['Saskatchewan', 'Saskatchewan', 'AM', 2, ['Saskatchewan']],
  ['Churchill', 'Churchill', 'AM', 2, ['Churchill@-109,54,-93,59']],
  ['Peace', 'Peace', 'AM', 2, ['Peace'], ['Río de la Paz']],
  ['Athabasca', 'Athabasca', 'AM', 2, ['Athabasca']],
  ['Ottawa', 'Ottawa', 'AM', 2, ['Ottawa']],
  ['Hudson', 'Hudson', 'AM', 2, ['Hudson']],
  ['Potomac', 'Potomac', 'AM', 2, ['Potomac']],
  ['Snake', 'Snake', 'AM', 2, ['Snake'], ['Río de la Serpiente']],
  ['Sacramento', 'Sacramento', 'AM', 2, ['Sacramento']],
  ['Brazos', 'Brazos', 'AM', 2, ['Brazos']],
  ['Pecos', 'Pecos', 'AM', 2, ['Pecos']],
  ['Platte', 'Platte', 'AM', 2, ['Platte']],
  ['Rojo (EE. UU.)', 'Red River (USA)', 'AM', 2, ['Red@-102,30,-91,36'], ['Río Rojo', 'Red River of the South']],
  ['Usumacinta', 'Usumacinta', 'AM', 2, ['Usumacinta']],
  ['Grijalva', 'Grijalva', 'AM', 2, ['Grijalva']],
  ['Lerma', 'Lerma', 'AM', 2, ['Lerma']],
  ['Balsas', 'Balsas', 'AM', 2, ['Balsas']],
  ['San Juan', 'San Juan', 'AM', 2, ['San Juan@-87,10,-83,13']],
  ['Amazonas', 'Amazon', 'AM', 1, ['Amazonas'], ['Amazonas', 'Solimões']],
  ['Paraná', 'Paraná', 'AM', 1, ['Paraná!-61,-27.25,-56.5,-14']],
  ['Paraguay', 'Paraguay', 'AM', 1, ['Paraná#-61,-27.25,-56.5,-14']],
  ['Orinoco', 'Orinoco', 'AM', 1, ['Orinoco']],
  ['Uruguay', 'Uruguay', 'AM', 1, ['Uruguay']],
  ['Magdalena', 'Magdalena', 'AM', 1, ['Magdalena']],
  ['São Francisco', 'São Francisco', 'AM', 1, ['São  Francisco'], ['San Francisco']],
  ['Madeira', 'Madeira', 'AM', 1, ['Madeira']],
  ['Negro (Amazonia)', 'Rio Negro (Amazon)', 'AM', 1, ['Negro@-71,-4,-59,4'], ['Río Negro']],
  ['Tocantins', 'Tocantins', 'AM', 2, ['Tocantins']],
  ['Araguaia', 'Araguaia', 'AM', 2, ['Araguaia']],
  ['Xingú', 'Xingu', 'AM', 2, ['Xingu'], ['Xingu']],
  ['Tapajós', 'Tapajós', 'AM', 2, ['Tapajós']],
  ['Purús', 'Purus', 'AM', 2, ['Purús']],
  ['Yuruá', 'Juruá', 'AM', 2, ['Juruá'], ['Juruá']],
  ['Caquetá', 'Japurá', 'AM', 2, ['Japurá', 'Caquetá'], ['Japurá', 'Yapurá']],
  ['Putumayo', 'Putumayo', 'AM', 2, ['Putumayo'], ['Içá']],
  ['Marañón', 'Marañón', 'AM', 2, ['Marañón']],
  ['Ucayali', 'Ucayali', 'AM', 2, ['Ucayali']],
  ['Pilcomayo', 'Pilcomayo', 'AM', 2, ['Pilcomayo']],
  ['Bermejo', 'Bermejo', 'AM', 2, ['Bermejo']],
  ['Salado', 'Salado', 'AM', 2, ['Salado@-67,-33,-60,-23'], ['Salado del Norte', 'Juramento']],
  ['Colorado (Argentina)', 'Colorado (Argentina)', 'AM', 2, ['Colorado@-71,-41,-61,-34']],
  ['Negro (Argentina)', 'Río Negro (Argentina)', 'AM', 2, ['Negro@-69,-42,-62,-38'], ['Río Negro']],
  ['Chubut', 'Chubut', 'AM', 2, ['Chubut']],
  ['Biobío', 'Biobío', 'AM', 2, ['Bío-Bío'], ['Bío-Bío', 'Bío Bío']],
  ['Cauca', 'Cauca', 'AM', 2, ['Cauca']],
  ['Atrato', 'Atrato', 'AM', 2, ['Atrato']],
  ['Esequibo', 'Essequibo', 'AM', 2, ['Essequibo']],
  ['Beni', 'Beni', 'AM', 2, ['Beni']],
  ['Mamoré', 'Mamoré', 'AM', 2, ['Mamoré']],
  ['Guaporé', 'Guaporé', 'AM', 2, ['Guaporé'], ['Iténez']],
  ['Parnaíba', 'Parnaíba', 'AM', 2, ['Parnaíba']],
  ['Tieté', 'Tietê', 'AM', 2, ['Tietê']],
  ['Apure', 'Apure', 'AM', 2, ['Apure']],

  // Oceania
  ['Murray', 'Murray', 'OC', 1, ['Murray']],
  ['Darling', 'Darling', 'OC', 1, ['Darling']],
  ['Waikato', 'Waikato', 'OC', 2, ['Waikato']],
  ['Sepik', 'Sepik', 'OC', 2, ['Sepik']],
  ['Fly', 'Fly', 'OC', 2, ['Fly']],

  // Spain, from the Atlas Nacional de España: the slope of the Bay of Biscay
  ['Bidasoa', 'Bidasoa', 'EU', 3, ['siane:1003712'], [], { h: 1 }],
  ['Nervión', 'Nervión', 'EU', 3, ['siane:100372'], ['Nerbioi'], { h: 1 }],
  ['Pas', 'Pas', 'EU', 3, ['siane:1003732']],
  ['Saja', 'Saja', 'EU', 3, ['siane:1003734']],
  ['Deva', 'Deva', 'EU', 3, ['siane:1003736']],
  ['Sella', 'Sella', 'EU', 3, ['siane:1003738']],
  ['Nalón', 'Nalón', 'EU', 3, ['siane:100374'], [], { h: 1 }],
  ['Narcea', 'Narcea', 'EU', 3, ['siane:1003742']],
  ['Navia', 'Navia', 'EU', 3, ['siane:100376'], [], { h: 1 }],
  ['Eo', 'Eo', 'EU', 3, ['siane:1003772'], [], { h: 1 }],
  // Galicia and the Sil, which the Miño takes in
  ['Tambre', 'Tambre', 'EU', 3, ['siane:1003778'], [], { h: 1 }],
  ['Ulla', 'Ulla', 'EU', 3, ['siane:100378'], [], { h: 1 }],
  ['Lérez', 'Lérez', 'EU', 3, ['siane:1003794']],
  ['Sil', 'Sil', 'EU', 3, ['siane:100384'], [], { h: 1 }],
  // The Duero and what it gathers
  ['Pisuerga', 'Pisuerga', 'EU', 3, ['siane:10048'], [], { h: 1 }],
  ['Esla', 'Esla', 'EU', 3, ['siane:10044'], [], { h: 1 }],
  ['Tormes', 'Tormes', 'EU', 3, ['siane:10042'], [], { h: 1 }],
  ['Órbigo', 'Órbigo', 'EU', 3, ['siane:100444']],
  ['Bernesga', 'Bernesga', 'EU', 3, ['siane:1004478']],
  ['Tera', 'Tera', 'EU', 3, ['siane:100442']],
  ['Carrión', 'Carrión', 'EU', 3, ['siane:100484']],
  ['Adaja', 'Adaja', 'EU', 3, ['siane:10046']],
  ['Eresma', 'Eresma', 'EU', 3, ['siane:100462']],
  ['Águeda', 'Águeda', 'EU', 3, ['siane:1004176']],
  // The Tagus
  ['Jarama', 'Jarama', 'EU', 3, ['siane:10068'], [], { h: 1 }],
  ['Alberche', 'Alberche', 'EU', 3, ['siane:100672'], [], { h: 1 }],
  ['Alagón', 'Alagón', 'EU', 3, ['siane:10064'], [], { h: 1 }],
  ['Henares', 'Henares', 'EU', 3, ['siane:100686']],
  ['Manzanares', 'Manzanares', 'EU', 3, ['siane:100684']],
  ['Tajuña', 'Tajuña', 'EU', 3, ['siane:100682']],
  ['Guadarrama', 'Guadarrama', 'EU', 3, ['siane:100674']],
  ['Tiétar', 'Tiétar', 'EU', 3, ['siane:10066']],
  ['Almonte', 'Almonte', 'EU', 3, ['siane:10065422']],
  // What the Guadiana gathers
  ['Zújar', 'Zújar', 'EU', 3, ['siane:10084'], [], { h: 1 }],
  ['Cigüela', 'Cigüela', 'EU', 3, ['siane:10086'], ['Gigüela']],
  ['Záncara', 'Záncara', 'EU', 3, ['siane:10088']],
  ['Jabalón', 'Jabalón', 'EU', 3, ['siane:100854']],
  ['Matachel', 'Matachel', 'EU', 3, ['siane:100836']],
  // The Guadalquivir and the Atlantic coast of Andalusia
  ['Genil', 'Genil', 'EU', 3, ['siane:100942'], [], { h: 1 }],
  ['Guadalimar', 'Guadalimar', 'EU', 3, ['siane:100946']],
  ['Guadiana Menor', 'Guadiana Menor', 'EU', 3, ['siane:100948']],
  ['Jándula', 'Jándula', 'EU', 3, ['siane:100944']],
  ['Guadiato', 'Guadiato', 'EU', 3, ['siane:1009434']],
  ['Odiel', 'Odiel', 'EU', 3, ['siane:10092'], [], { h: 1 }],
  ['Tinto', 'Tinto', 'EU', 3, ['siane:100922'], ['Río Tinto'], { h: 1 }],
  ['Guadalete', 'Guadalete', 'EU', 3, ['siane:10096'], [], { h: 1 }],
  // The Mediterranean coast, from the Strait to the Ebro
  ['Guadiaro', 'Guadiaro', 'EU', 3, ['siane:200116']],
  ['Guadalhorce', 'Guadalhorce', 'EU', 3, ['siane:20012'], [], { h: 1 }],
  ['Guadalfeo', 'Guadalfeo', 'EU', 3, ['siane:200134']],
  ['Andarax', 'Andarax', 'EU', 3, ['siane:200138']],
  ['Almanzora', 'Almanzora', 'EU', 3, ['siane:20014'], [], { h: 1 }],
  ['Segura', 'Segura', 'EU', 3, ['siane:20016'], [], { h: 1 }],
  ['Mundo', 'Mundo', 'EU', 3, ['siane:200168']],
  ['Guadalentín', 'Guadalentín', 'EU', 3, ['siane:200162'], ['Sangonera']],
  ['Vinalopó', 'Vinalopó', 'EU', 3, ['siane:20018']],
  ['Júcar', 'Júcar', 'EU', 3, ['siane:2002'], ['Xúquer'], { h: 1 }],
  ['Cabriel', 'Cabriel', 'EU', 3, ['siane:20026']],
  ['Turia', 'Turia', 'EU', 3, ['siane:20034'], ['Túria', 'Guadalaviar'], { h: 1 }],
  ['Palancia', 'Palancia', 'EU', 3, ['siane:20036']],
  ['Mijares', 'Mijares', 'EU', 3, ['siane:20038'], ['Millars'], { h: 1 }],
  // The Ebro and Catalonia
  ['Aragón', 'Aragón', 'EU', 3, ['siane:20048'], [], { h: 1 }],
  ['Gállego', 'Gállego', 'EU', 3, ['siane:20044'], [], { h: 1 }],
  ['Cinca', 'Cinca', 'EU', 3, ['siane:200422'], [], { h: 1 }],
  ['Segre', 'Segre', 'EU', 3, ['siane:20042'], [], { h: 1 }],
  ['Jalón', 'Jalón', 'EU', 3, ['siane:20046'], [], { h: 1 }],
  ['Arga', 'Arga', 'EU', 3, ['siane:200482']],
  ['Ega', 'Ega', 'EU', 3, ['siane:200492']],
  ['Jiloca', 'Jiloca', 'EU', 3, ['siane:200464']],
  ['Guadalope', 'Guadalope', 'EU', 3, ['siane:200434']],
  ['Noguera Pallaresa', 'Noguera Pallaresa', 'EU', 3, ['siane:200426']],
  ['Noguera Ribagorzana', 'Noguera Ribagorzana', 'EU', 3, ['siane:200424'], ['Noguera Ribagorçana']],
  ['Francolí', 'Francolí', 'EU', 3, ['siane:200512']],
  ['Llobregat', 'Llobregat', 'EU', 3, ['siane:20052'], [], { h: 1 }],
  ['Ter', 'Ter', 'EU', 3, ['siane:20054'], [], { h: 1 }],
  ['Fluvià', 'Fluvià', 'EU', 3, ['siane:200552'], ['Fluviá']],
];

/** Lakes: Natural Earth `name` (lakes layer, or the marine layer for the two lagoons that sit there). */
export const LAKES = [
  ['Lago Victoria', 'Lake Victoria', 'AF', 1, ['Lake Victoria']],
  ['Lago Tanganica', 'Lake Tanganyika', 'AF', 1, ['Lake Tanganyika'], ['Tanganika', 'Tanganyika']],
  ['Lago Malaui', 'Lake Malawi', 'AF', 1, ['Lake Malawi'], ['Malawi', 'Niasa', 'Nyasa', 'Lago Niasa']],
  ['Lago Chad', 'Lake Chad', 'AF', 1, ['Lake Chad']],
  ['Lago Turkana', 'Lake Turkana', 'AF', 2, ['Lake Turkana'], ['Rodolfo']],
  ['Lago Alberto', 'Lake Albert', 'AF', 2, ['Lake Albert']],
  ['Lago Eduardo', 'Lake Edward', 'AF', 2, ['Lake Edward']],
  ['Lago Kivu', 'Lake Kivu', 'AF', 2, ['Lake Kivu']],
  ['Lago Tana', 'Lake Tana', 'AF', 2, ['Lake Tana']],
  ['Lago Volta', 'Lake Volta', 'AF', 2, ['Lake Volta']],
  ['Lago Kariba', 'Lake Kariba', 'AF', 2, ['Lake Kariba']],
  ['Lago Nasser', 'Lake Nasser', 'AF', 2, ['Lake Nasser']],
  ['Lago Moero', 'Lake Mweru', 'AF', 2, ['Lac Moeru'], ['Mweru']],

  ['Lago Baikal', 'Lake Baikal', 'AS', 1, ['Lake Baikal']],
  ['Lago Baljash', 'Lake Balkhash', 'AS', 1, ['Lake Balkhash'], ['Balkhash', 'Baljash']],
  ['Mar de Aral', 'Aral Sea', 'AS', 1, ['South Aral Sea', 'North Aral Sea']],
  ['Mar Muerto', 'Dead Sea', 'AS', 1, ['Dead Sea']],
  ['Lago Issyk-Kul', 'Issyk-Kul', 'AS', 2, ['Issyk-Kul'], ['Issyk Kul', 'Ysyk-Köl']],
  ['Lago de Van', 'Lake Van', 'AS', 2, ['Lake Van'], ['Lago Van']],
  ['Lago Urmía', 'Lake Urmia', 'AS', 2, ['Lake Urmia'], ['Urmia']],
  ['Lago Qinghai', 'Qinghai Lake', 'AS', 2, ['Qinghai Hu'], ['Koko Nor']],
  ['Tonlé Sap', 'Tonlé Sap', 'AS', 2, ['Tonlé Sap'], ['Lago Tonlé Sap']],
  ['Mar de Galilea', 'Sea of Galilee', 'AS', 2, ['Sea of Galilee'], ['Lago de Tiberíades', 'Lago Kineret', 'Tiberíades']],
  ['Lago Poyang', 'Poyang Lake', 'AS', 2, ['Poyang Hu']],
  ['Lago Janka', 'Lake Khanka', 'AS', 2, ['Lake Khanka'], ['Khanka', 'Xingkai']],
  ['Lago Taimir', 'Lake Taymyr', 'AS', 2, ['Lake Taymyr'], ['Taymyr']],
  ['Lago Toba', 'Lake Toba', 'AS', 2, ['Danau Toba']],
  ['Lago Seván', 'Lake Sevan', 'AS', 2, ['Lake Sevan'], ['Sevan']],
  ['Lago Tuz', 'Lake Tuz', 'AS', 2, ['Lake Tuz']],

  ['Lago Ladoga', 'Lake Ladoga', 'EU', 1, ['Lake Ladoga'], ['Ládoga']],
  ['Lago Onega', 'Lake Onega', 'EU', 1, ['Lake Onega']],
  ['Lago Vänern', 'Vänern', 'EU', 1, ['Vänern'], ['Vanern', 'Väner']],
  ['Lago Vättern', 'Vättern', 'EU', 2, ['Vättern'], ['Vattern', 'Vätter']],
  ['Lago Lemán', 'Lake Geneva', 'EU', 1, ['Lake Geneva'], ['Lago de Ginebra', 'Léman', 'Lake Léman']],
  ['Lago de Constanza', 'Lake Constance', 'EU', 1, ['Bodensee'], ['Bodensee', 'Lago Constanza']],
  ['Lago Balatón', 'Lake Balaton', 'EU', 1, ['Lake Balaton'], ['Balaton']],
  ['Lago de Garda', 'Lake Garda', 'EU', 1, ['Lago di Garda'], ['Lago Garda']],
  ['Lago de Como', 'Lake Como', 'EU', 2, ['Lago di Como'], ['Lago Como']],
  ['Lago Ness', 'Loch Ness', 'EU', 2, ['Loch Ness']],
  ['Lago Peipus', 'Lake Peipus', 'EU', 2, ['Lake Peipus'], ['Peipsi', 'Chudskoye']],
  ['Lago Saimaa', 'Lake Saimaa', 'EU', 2, ['Lake Saimaa']],
  ['Lago Mälaren', 'Mälaren', 'EU', 2, ['Mälaren'], ['Malaren', 'Mälar']],
  ['IJsselmeer', 'IJsselmeer', 'EU', 2, ['IJsselmeer'], ['Lago IJssel', 'Lago de IJssel']],
  ['Lago Neagh', 'Lough Neagh', 'EU', 2, ['Lough Neagh']],
  ['Lago Inari', 'Lake Inari', 'EU', 2, ['Inarijrvi'], ['Inarijärvi']],
  ['Lago Skadar', 'Lake Skadar', 'EU', 2, ['Lake Skadar'], ['Lago de Escútari', 'Scutari', 'Shkodër']],

  ['Lago Superior', 'Lake Superior', 'AM', 1, ['Lake Superior']],
  ['Lago Míchigan', 'Lake Michigan', 'AM', 1, ['Lake Michigan']],
  ['Lago Hurón', 'Lake Huron', 'AM', 1, ['Lake Huron']],
  ['Lago Erie', 'Lake Erie', 'AM', 1, ['Lake Erie']],
  ['Lago Ontario', 'Lake Ontario', 'AM', 1, ['Lake Ontario']],
  ['Gran Lago del Oso', 'Great Bear Lake', 'AM', 1, ['Great Bear Lake'], ['Gran Lago de los Osos']],
  ['Gran Lago del Esclavo', 'Great Slave Lake', 'AM', 1, ['Great Slave Lake'], ['Gran Lago de los Esclavos']],
  ['Lago Winnipeg', 'Lake Winnipeg', 'AM', 1, ['Lake Winnipeg']],
  ['Lago Athabasca', 'Lake Athabasca', 'AM', 2, ['Lake Athabasca']],
  ['Gran Lago Salado', 'Great Salt Lake', 'AM', 2, ['Great Salt Lake']],
  ['Lago de Nicaragua', 'Lake Nicaragua', 'AM', 1, ['Lago de Nicaragua'], ['Cocibolca', 'Lago Cocibolca']],
  ['Lago de Managua', 'Lake Managua', 'AM', 2, ['Lago de Managua'], ['Xolotlán', 'Lago Xolotlán']],
  ['Lago Tahoe', 'Lake Tahoe', 'AM', 2, ['Lake Tahoe']],
  ['Lago Reindeer', 'Reindeer Lake', 'AM', 2, ['Reindeer Lake'], ['Lago del Reno']],
  ['Lago Okeechobee', 'Lake Okeechobee', 'AM', 2, ['Lake Okeechobee']],
  ['Lago de Chapala', 'Lake Chapala', 'AM', 2, ['Lago de Chapala']],
  ['Lago Champlain', 'Lake Champlain', 'AM', 2, ['Lake Champlain']],
  ['Lago Manitoba', 'Lake Manitoba', 'AM', 2, ['Lake Manitoba']],
  ['Lago de los Bosques', 'Lake of the Woods', 'AM', 2, ['Lake of the Woods']],
  ['Lago Titicaca', 'Lake Titicaca', 'AM', 1, ['Lago Titicaca']],
  ['Lago de Maracaibo', 'Lake Maracaibo', 'AM', 1, ['Lago de Maracaibo']],
  ['Lago Argentino', 'Lago Argentino', 'AM', 2, ['Lago Argentino']],
  ['Lago Buenos Aires', 'General Carrera Lake', 'AM', 2, ['Lago Buenos Aires'], ['Lago General Carrera', 'General Carrera', 'Lago Buenos Aires/General Carrera']],
  ['Laguna Merín', 'Lagoon Mirim', 'AM', 2, ['Lagoa Mirim'], ['Lagoa Mirim', 'Laguna Merin']],
  ['Laguna Mar Chiquita', 'Mar Chiquita', 'AM', 2, ['Mar Chiquita'], ['Mar de Ansenuza']],
  ['Laguna de los Patos', 'Lagoa dos Patos', 'AM', 2, ['Lagoa dos Patos'], ['Lagoa dos Patos']],
  ['Lago Llanquihue', 'Llanquihue Lake', 'AM', 2, ['Lago Llanquihue']],

  ['Lago Eyre', 'Lake Eyre', 'OC', 1, ['Lake Eyre North', 'Lake Eyre South'], ['Kati Thanda']],
  ['Lago Taupo', 'Lake Taupo', 'OC', 2, ['Lake Taupo'], ['Taupō']],
  ['Lago Torrens', 'Lake Torrens', 'OC', 2, ['Lake Torrens']],

  // Spain: the reservoirs every map of the country shows, and its best-known lagoon
  ['Embalse de La Serena', 'La Serena Reservoir', 'EU', 3, ['agua:Embalse de la Serena'], ['La Serena'], { h: 1, t: 'res' }],
  ['Embalse de Alcántara', 'Alcántara Reservoir', 'EU', 3, ['agua:Embalse de Alcántara 2'], ['Alcántara', 'Embalse de José María de Oriol'], { h: 1, t: 'res' }],
  ['Embalse de Mequinenza', 'Mequinenza Reservoir', 'EU', 3, ['agua:Embalse de Mequinenza'], ['Mequinenza', 'Mar de Aragón'], { h: 1, t: 'res' }],
  ['Embalse de Almendra', 'Almendra Reservoir', 'EU', 3, ['agua:Embalse de Almendra'], ['Almendra'], { t: 'res' }],
  ['Embalse de Buendía', 'Buendía Reservoir', 'EU', 3, ['agua:Embalse de Buendía'], ['Buendía'], { t: 'res' }],
  ['Embalse de Ricobayo', 'Ricobayo Reservoir', 'EU', 3, ['agua:Embalse de Ricobayo'], ['Ricobayo'], { t: 'res' }],
  ['Embalse de Alarcón', 'Alarcón Reservoir', 'EU', 3, ['agua:Embalse de Alarcón'], ['Alarcón'], { t: 'res' }],
  ['Embalse de Cíjara', 'Cíjara Reservoir', 'EU', 3, ['agua:Embalse de Cijara'], ['Cíjara'], { t: 'res' }],
  ['Embalse de Valdecañas', 'Valdecañas Reservoir', 'EU', 3, ['agua:Embalse de Valdecañas'], ['Valdecañas'], { t: 'res' }],
  ['Embalse de Iznájar', 'Iznájar Reservoir', 'EU', 3, ['agua:Embalse de Iznájar'], ['Iznájar'], { t: 'res' }],
  ['Embalse del Ebro', 'Ebro Reservoir', 'EU', 3, ['agua:Embalse del Ebro'], [], { t: 'res' }],
  ['Embalse de Gabriel y Galán', 'Gabriel y Galán Reservoir', 'EU', 3, ['agua:Embalse de Gabriel y Galán'], ['Gabriel y Galán'], { t: 'res' }],
  ['Embalse de Entrepeñas', 'Entrepeñas Reservoir', 'EU', 3, ['agua:Embalse de Entrepeñas'], ['Entrepeñas'], { t: 'res' }],
  ['Embalse de Riaño', 'Riaño Reservoir', 'EU', 3, ['agua:Embalse de Riaño'], ['Riaño'], { t: 'res' }],
  ['Embalse de Yesa', 'Yesa Reservoir', 'EU', 3, ['agua:Embalse de Yesa'], ['Yesa'], { t: 'res' }],
  ['Albufera de Valencia', 'Albufera of Valencia', 'EU', 3, ["agua:l'Albufera"], ['Albufera', 'La Albufera', "L'Albufera"], { h: 1 }],
];

/**
 * Seas, gulfs and straits: `name` in the 1:10m marine layer. Natural Earth has some of them only as a
 * speck that carries the label (the Strait of Gibraltar, Bab el-Mandeb, the Yucatán Channel, the Scotia
 * Sea, the Luzon Strait, the Drake Passage): those are outlines drawn by hand over the water, with no
 * surface to compare. The land is drawn on top of every sea, so an outline may run inland.
 */
/**
 * The seas that The World Factbook counts with an ocean, where it calls them otherwise than Natural Earth
 * does. An empty name: a strait that Natural Earth does not outline.
 */
export const OCEAN_SEA_NAMES = {
  'Gulf of America': 'Gulf of Mexico',
  'Northwest Passage': 'The North Western Passages',
  'Bering Strait': '',
};

export const SEAS = [
  // The five oceans are a kind of their own («Continentes y océanos»), filed here because their ids begin like a sea's.
  ['Océano Atlántico', 'Atlantic Ocean', 'EU AF AM', 1, ['North Atlantic Ocean', 'South Atlantic Ocean'], ['Atlántico'], { kind: 'ocean', area: 'ocean:atlantic' }],
  ['Océano Pacífico', 'Pacific Ocean', 'AS AM OC', 1, ['North Pacific Ocean', 'South Pacific Ocean'], ['Pacífico'], { kind: 'ocean', area: 'ocean:pacific' }],
  ['Océano Índico', 'Indian Ocean', 'AF AS OC', 1, ['INDIAN OCEAN'], ['Índico'], { kind: 'ocean', area: 'ocean:indian' }],
  ['Océano Ártico', 'Arctic Ocean', 'EU AS AM', 1, ['Arctic Ocean'], ['Ártico', 'Océano Glacial Ártico'], { kind: 'ocean', area: 'ocean:arctic' }],
  ['Océano Antártico', 'Southern Ocean', 'AN', 1, ['SOUTHERN OCEAN'], ['Antártico', 'Océano Austral', 'Océano Glacial Antártico', 'Antarctic Ocean'], { kind: 'ocean', area: 'ocean:southern' }],

  ['Mar Mediterráneo', 'Mediterranean Sea', 'EU AF AS', 1, ['Mediterranean Sea'], ['Mediterráneo']],
  ['Mar Negro', 'Black Sea', 'EU AS', 1, ['Black Sea']],
  ['Mar Caspio', 'Caspian Sea', 'EU AS', 1, ['Caspian Sea'], ['Caspio']],
  ['Mar Rojo', 'Red Sea', 'AF AS', 1, ['Red Sea']],
  ['Mar Báltico', 'Baltic Sea', 'EU', 1, ['Baltic Sea'], ['Báltico']],
  ['Mar del Norte', 'North Sea', 'EU', 1, ['North Sea']],
  ['Mar de Noruega', 'Norwegian Sea', 'EU', 1, ['Norwegian Sea']],
  ['Mar de Barents', 'Barents Sea', 'EU', 1, ['Barents Sea']],
  ['Mar Adriático', 'Adriatic Sea', 'EU', 1, ['Adriatic Sea'], ['Adriático']],
  ['Mar Egeo', 'Aegean Sea', 'EU AS', 1, ['Aegean Sea'], ['Egeo']],
  ['Mar Tirreno', 'Tyrrhenian Sea', 'EU', 1, ['Tyrrhenian Sea'], ['Tirreno']],
  ['Mar Jónico', 'Ionian Sea', 'EU', 1, ['Ionian Sea'], ['Jónico']],
  // On the map of Spain the sea off its northern coast goes by its own name: see `Mar Cantábrico` below.
  ['Golfo de Vizcaya', 'Bay of Biscay', 'EU', 1, ['Bay of Biscay'], ['Mar Cantábrico', 'Cantábrico'], { co: 'FR' }],
  ['Canal de la Mancha', 'English Channel', 'EU', 1, ['English Channel'], ['La Mancha']],
  ['Estrecho de Gibraltar', 'Strait of Gibraltar', 'EU AF', 1, [[[-6.03, 36.19], [-5.92, 35.78], [-5.6, 35.75], [-5.28, 35.88], [-5.33, 36.13], [-5.6, 36.1]]], ['Gibraltar'], { area: 0 }],
  ['Mar Balear', 'Balearic Sea', 'EU', 2, ['Balearic Sea']],
  ['Mar de Alborán', 'Alboran Sea', 'EU AF', 2, ['Alboran Sea'], ['Alborán']],
  ['Golfo de León', 'Gulf of Lion', 'EU', 2, ['Golfe du Lion'], [], { co: 'FR' }],
  ['Mar de Liguria', 'Ligurian Sea', 'EU', 2, ['Ligurian Sea'], ['Mar Ligur']],
  ['Mar de Creta', 'Sea of Crete', 'EU', 2, ['Sea of Crete']],
  ['Mar de Azov', 'Sea of Azov', 'EU', 2, ['Sea of Azov'], ['Azov']],
  ['Mar de Mármara', 'Sea of Marmara', 'EU AS', 2, ['Sea of Marmara'], ['Mármara']],
  ['Bósforo', 'Bosporus', 'EU AS', 2, ['Bosporus'], ['Estrecho del Bósforo', 'Bosphorus']],
  ['Dardanelos', 'Dardanelles', 'EU AS', 2, ['Dardanelles'], ['Estrecho de los Dardanelos']],
  ['Mar de Irlanda', 'Irish Sea', 'EU', 2, ['Irish Sea']],
  ['Mar Blanco', 'White Sea', 'EU', 2, ['White Sea']],
  ['Golfo de Botnia', 'Gulf of Bothnia', 'EU', 2, ['Gulf of Bothnia']],
  ['Golfo de Finlandia', 'Gulf of Finland', 'EU', 2, ['Gulf of Finland']],
  ['Golfo de Riga', 'Gulf of Riga', 'EU', 2, ['Gulf of Riga']],
  ['Skagerrak', 'Skagerrak', 'EU', 2, ['Skagerrak'], ['Estrecho de Skagerrak']],
  ['Kattegat', 'Kattegat', 'EU', 2, ['Kattegat'], ['Categat', 'Estrecho de Kattegat']],
  ['Mar de Groenlandia', 'Greenland Sea', 'EU AM', 2, ['Greenland Sea']],
  ['Estrecho de Dinamarca', 'Denmark Strait', 'EU AM', 2, ['Denmark Strait']],
  ['Golfo de Sidra', 'Gulf of Sidra', 'AF', 2, ['Gulf of Sidra'], ['Golfo de Sirte', 'Gran Sirte']],

  ['Golfo de Guinea', 'Gulf of Guinea', 'AF', 1, ['Gulf of Guinea']],
  ['Canal de Mozambique', 'Mozambique Channel', 'AF', 1, ['Mozambique Channel']],
  ['Golfo de Adén', 'Gulf of Aden', 'AF AS', 2, ['Gulf of Aden']],
  ['Golfo de Suez', 'Gulf of Suez', 'AF', 2, ['Gulf of Suez']],
  ['Golfo de Áqaba', 'Gulf of Aqaba', 'AF AS', 2, ['Gulf of Aqaba'], ['Golfo de Aqaba', 'Golfo de Eilat']],
  ['Bab el-Mandeb', 'Bab-el-Mandeb', 'AF AS', 2, [[[43.05, 12.95], [43.1, 12.5], [43.3, 12.3], [43.65, 12.45], [43.6, 12.8], [43.35, 13.05]]], ['Estrecho de Bab el-Mandeb', 'Bab el Mandeb'], { area: 0 }],

  ['Mar Arábigo', 'Arabian Sea', 'AS', 1, ['Arabian Sea'], ['Mar de Arabia', 'Mar de Omán']],
  ['Golfo de Bengala', 'Bay of Bengal', 'AS', 1, ['Bay of Bengal'], ['Bahía de Bengala']],
  ['Golfo Pérsico', 'Persian Gulf', 'AS', 1, ['Persian Gulf'], ['Golfo Arábigo']],
  ['Golfo de Omán', 'Gulf of Oman', 'AS', 2, ['Gulf of Oman']],
  ['Mar de la China Meridional', 'South China Sea', 'AS', 1, ['South China Sea'], ['Mar de China Meridional', 'Mar del Sur de China', 'Mar de China']],
  ['Mar de la China Oriental', 'East China Sea', 'AS', 1, ['East China Sea'], ['Mar de China Oriental', 'Mar del Este de China']],
  ['Mar Amarillo', 'Yellow Sea', 'AS', 1, ['Yellow Sea']],
  ['Mar del Japón', 'Sea of Japan', 'AS', 1, ['Sea of Japan'], ['Mar de Japón', 'Mar del Este']],
  ['Mar de Ojotsk', 'Sea of Okhotsk', 'AS', 1, ['Sea of Okhotsk'], ['Mar de Okhotsk']],
  ['Mar de Bering', 'Bering Sea', 'AS AM', 1, ['Bering Sea']],
  ['Mar de Filipinas', 'Philippine Sea', 'AS', 1, ['Philippine Sea']],
  ['Mar de Andamán', 'Andaman Sea', 'AS', 2, ['Andaman Sea']],
  ['Golfo de Tailandia', 'Gulf of Thailand', 'AS', 2, ['Gulf of Thailand'], ['Golfo de Siam']],
  ['Golfo de Tonkín', 'Gulf of Tonkin', 'AS', 2, ['Gulf of Tonkin']],
  ['Mar de Java', 'Java Sea', 'AS', 2, ['Java Sea']],
  ['Mar de Célebes', 'Celebes Sea', 'AS', 2, ['Celebes Sea']],
  ['Mar de Banda', 'Banda Sea', 'AS', 2, ['Banda Sea']],
  ['Mar de Sulú', 'Sulu Sea', 'AS', 2, ['Sulu Sea'], ['Mar de Joló']],
  ['Mar de Bohai', 'Bohai Sea', 'AS', 2, ['Bo Hai'], ['Golfo de Bohai', 'Bo Hai']],
  ['Mar de Laquedivas', 'Laccadive Sea', 'AS', 2, ['Laccadive Sea'], ['Mar de las Laquedivas']],
  ['Estrecho de Malaca', 'Strait of Malacca', 'AS', 1, ['Strait of Malacca']],
  ['Estrecho de Taiwán', 'Taiwan Strait', 'AS', 2, ['Taiwan Strait'], ['Estrecho de Formosa']],
  ['Estrecho de Corea', 'Korea Strait', 'AS', 2, ['Korea Strait']],
  ['Estrecho de Luzón', 'Luzon Strait', 'AS', 2, [[[120.2, 21.9], [122.2, 21.9], [122.6, 18.9], [120.4, 18.7], [120.2, 21.9]]]],
  ['Estrecho de Macasar', 'Makassar Strait', 'AS', 2, ['Makassar Strait'], ['Estrecho de Makassar']],
  ['Mar de Kara', 'Kara Sea', 'AS', 2, ['Kara Sea']],
  ['Mar de Láptev', 'Laptev Sea', 'AS', 2, ['Laptev Sea'], ['Mar de Laptev']],
  ['Mar de Siberia Oriental', 'East Siberian Sea', 'AS', 2, ['East Siberian Sea']],
  ['Mar de Chukotka', 'Chukchi Sea', 'AS AM', 2, ['Chukchi Sea'], ['Mar de Chukchi']],

  ['Mar Caribe', 'Caribbean Sea', 'AM', 1, ['Caribbean Sea'], ['Caribe', 'Mar de las Antillas']],
  ['Golfo de México', 'Gulf of Mexico', 'AM', 1, ['Gulf of Mexico']],
  ['Bahía de Hudson', 'Hudson Bay', 'AM', 1, ['Hudson Bay']],
  ['Golfo de Alaska', 'Gulf of Alaska', 'AM', 1, ['Gulf of Alaska']],
  ['Golfo de California', 'Gulf of California', 'AM', 1, ['Golfo de California'], ['Mar de Cortés', 'Mar Bermejo']],
  ['Mar de Labrador', 'Labrador Sea', 'AM', 2, ['Labrador Sea'], ['Mar del Labrador']],
  ['Bahía de Baffin', 'Baffin Bay', 'AM', 2, ['Baffin Bay']],
  ['Mar de Beaufort', 'Beaufort Sea', 'AM', 2, ['Beaufort Sea']],
  ['Estrecho de Davis', 'Davis Strait', 'AM', 2, ['Davis Strait']],
  ['Estrecho de Hudson', 'Hudson Strait', 'AM', 2, ['Hudson Strait']],
  ['Bahía James', 'James Bay', 'AM', 2, ['James Bay'], ['Bahía de James']],
  ['Golfo de San Lorenzo', 'Gulf of Saint Lawrence', 'AM', 2, ['Gulf of Saint Lawrence']],
  ['Bahía de Fundy', 'Bay of Fundy', 'AM', 2, ['Bay of Fundy']],
  ['Mar de los Sargazos', 'Sargasso Sea', 'AM', 2, ['Sargasso Sea']],
  ['Estrecho de Florida', 'Straits of Florida', 'AM', 2, ['Straits of Florida'], ['Estrecho de la Florida', 'Florida Strait']],
  ['Canal de Yucatán', 'Yucatán Channel', 'AM', 2, [[[-87.1, 22.4], [-87.1, 21.0], [-86.7, 20.8], [-84.9, 21.3], [-84.8, 22.4]]], ['Estrecho de Yucatán'], { area: 0 }],
  ['Golfo de Campeche', 'Bay of Campeche', 'AM', 2, ['Bahía de Campeche'], ['Bahía de Campeche', 'Sonda de Campeche']],
  ['Golfo de Honduras', 'Gulf of Honduras', 'AM', 2, ['Gulf of Honduras']],
  ['Golfo de Panamá', 'Gulf of Panama', 'AM', 2, ['Golfo de Panamá']],
  ['Río de la Plata', 'Río de la Plata', 'AM', 1, ['Río de la Plata'], ['Estuario del Plata', 'River Plate']],
  ['Estrecho de Magallanes', 'Strait of Magellan', 'AM', 1, ['Estrecho de Magellanes'], ['Magallanes']],
  ['Paso de Drake', 'Drake Passage', 'AM AN', 1, [[[-68.5, -56.3], [-65, -55.6], [-58, -55.8], [-55, -60.8], [-58, -62.2], [-62.5, -63.4], [-67, -64.8], [-72, -63], [-71, -59], [-68.5, -56.3]]], ['Pasaje de Drake', 'Mar de Hoces']],
  ['Golfo San Jorge', 'San Jorge Gulf', 'AM', 2, ['Golfo San Jorge'], ['Golfo de San Jorge']],

  ['Mar del Coral', 'Coral Sea', 'OC', 1, ['Coral Sea'], ['Mar de Coral', 'Mar de los Corales']],
  ['Mar de Tasmania', 'Tasman Sea', 'OC', 1, ['Tasman Sea'], ['Mar de Tasman']],
  ['Mar de Timor', 'Timor Sea', 'OC AS', 2, ['Timor Sea']],
  ['Mar de Arafura', 'Arafura Sea', 'OC AS', 2, ['Arafura Sea']],
  ['Golfo de Carpentaria', 'Gulf of Carpentaria', 'OC', 2, ['Gulf of Carpentaria']],
  ['Gran Bahía Australiana', 'Great Australian Bight', 'OC', 2, ['Great Australian Bight']],
  ['Estrecho de Bass', 'Bass Strait', 'OC', 2, ['Bass Strait']],
  ['Estrecho de Torres', 'Torres Strait', 'OC', 2, ['Torres Strait']],
  ['Estrecho de Cook', 'Cook Strait', 'OC', 2, ['Cook Strait']],
  ['Mar de Bismarck', 'Bismarck Sea', 'OC', 2, ['Bismarck Sea']],
  ['Mar de Salomón', 'Solomon Sea', 'OC', 2, ['Solomon Sea'], ['Mar de las Salomón']],

  ['Mar de Weddell', 'Weddell Sea', 'AN', 2, ['Weddell Sea']],
  ['Mar de Ross', 'Ross Sea', 'AN', 2, ['Ross Sea']],
  ['Mar de Bellingshausen', 'Bellingshausen Sea', 'AN', 2, ['Bellingshausen Sea']],
  ['Mar de Amundsen', 'Amundsen Sea', 'AN', 2, ['Amundsen Sea']],
  ['Mar del Scotia', 'Scotia Sea', 'AN AM', 2, [[[-58, -55.2], [-48, -53.2], [-38, -53.6], [-28, -55.5], [-26, -58.5], [-30, -60.5], [-44, -61], [-55, -61.2], [-56.5, -58.5]]], ['Mar de Scotia', 'Mar de Escocia'], { area: 0 }],

  // Spain: outlines drawn by hand over the water, as loose as the names are. The land is drawn on top.
  ['Mar Cantábrico', 'Cantabrian Sea', 'EU', 3, [[[-7.72, 43.5], [-7.78, 44.6], [-5.0, 44.7], [-3.0, 44.6], [-1.9, 44.25], [-1.45, 43.75], [-1.4, 43.3], [-3.0, 43.0], [-5.5, 43.0], [-7.5, 43.2]]], ['Cantábrico'], { h: 1, area: 0, co: 'ES' }],
  ['Golfo de Cádiz', 'Gulf of Cádiz', 'EU', 3, [[[-7.9, 36.9], [-7.9, 36.3], [-7.0, 35.95], [-6.25, 36.0], [-6.0, 36.15], [-5.95, 36.5], [-6.3, 37.0], [-7.0, 37.4], [-7.9, 37.3]]], ['Gulf of Cadiz'], { h: 1, area: 0, co: 'ES PT' }],
  ['Golfo de Valencia', 'Gulf of Valencia', 'EU', 3, [[[0.25, 38.7], [0.75, 39.5], [1.0, 40.2], [0.92, 40.74], [0.3, 40.6], [-0.4, 39.6], [-0.2, 38.8]]], ['Golf de València'], { h: 1, area: 0, co: 'ES' }],
  ['Mar Menor', 'Mar Menor', 'EU', 3, [[[-0.9, 37.62], [-0.9, 37.84], [-0.775, 37.84], [-0.745, 37.8], [-0.725, 37.72], [-0.715, 37.655], [-0.72, 37.62]]], [], { h: 1, area: 0, co: 'ES' }],
];

/** Mountain ranges and massifs: `NAME` in the 1:10m regions layer. */
export const RANGES = [
  // Germany holds a fifteenth of them and Slovenia a hundredth, less than the rule asks for: they are theirs all the same.
  ['Alpes', 'Alps', 'EU', 1, ['ALPS'], [], { co: 'AT CH DE FR IT LI SI' }],
  ['Pirineos', 'Pyrenees', 'EU', 1, [{ relief: PYRENEES }], ['Pirineo']],
  ['Apeninos', 'Apennines', 'EU', 1, ['APPENNINI']],
  ['Cárpatos', 'Carpathians', 'EU', 1, ['CARPATHIAN MOUNTAINS'], ['Montes Cárpatos', 'Carpathian Mountains']],
  ['Montes Urales', 'Ural Mountains', 'EU AS', 1, ['URAL MOUNTAINS'], ['Urales', 'Urals']],
  ['Cáucaso', 'Caucasus', 'EU AS', 1, ['CAUCASUS MTS.'], ['Gran Cáucaso', 'Caucasus Mountains']],
  ['Alpes Escandinavos', 'Scandinavian Mountains', 'EU', 1, ['KJØLEN MOUNTAINS'], ['Montes Escandinavos', 'Kjølen', 'Scandes']],
  ['Cordillera Cantábrica', 'Cantabrian Mountains', 'EU', 1, [{ relief: CANTABRIAN }], ['Montes Cantábricos']],
  // Natural Earth draws it as wide as the whole Penibaetic range, which the map of Spain has under that name.
  ['Sierra Nevada (España)', 'Sierra Nevada (Spain)', 'EU', 2, ['S. Nevada'], ['Sierra Nevada'], { co: '' }],
  ['Sierra Morena', 'Sierra Morena', 'EU', 2, [{ relief: { min: 400, within: [[-7.3, 37.85], [-7.0, 38.25], [-6.0, 38.3], [-5.0, 38.5], [-4.0, 38.65], [-3.2, 38.65], [-2.85, 38.7], [-2.85, 38.42], [-3.3, 38.3], [-4.1, 38.15], [-5.1, 37.95], [-6.0, 37.75], [-6.9, 37.6]] } }], [], { h: 1 }],
  ['Balcanes', 'Balkan Mountains', 'EU', 2, ['Balkan Mts.'], ['Montes Balcanes', 'Stara Planina']],
  ['Alpes Dináricos', 'Dinaric Alps', 'EU', 2, ['Dinaric Alps'], ['Dinárides']],
  ['Macizo Central', 'Massif Central', 'EU', 2, ['Massif Central'], ['Macizo Central francés']],
  ['Vosgos', 'Vosges', 'EU', 2, ['Vosges']],
  ['Jura', 'Jura', 'EU', 2, ['Jura'], ['Macizo del Jura']],
  ['Tatras', 'Tatra Mountains', 'EU', 2, ['Tatra Mts.'], ['Montes Tatras', 'Tatra']],
  ['Alpes de Transilvania', 'Transylvanian Alps', 'EU', 2, ['Transylvanian Alps'], ['Cárpatos Meridionales', 'Southern Carpathians']],
  ['Pindo', 'Pindus', 'EU', 2, ['Pindus Mts.'], ['Montes Pindo']],
  ['Sudetes', 'Sudetes', 'EU', 2, ['Sudetes Mts.']],
  ['Montes Metálicos', 'Ore Mountains', 'EU', 2, ['Erzgebirge'], ['Erzgebirge']],
  ['Ardenas', 'Ardennes', 'EU', 2, ['Ardennes']],
  ['Montes Grampianos', 'Grampian Mountains', 'EU', 2, ['Grampian Mts.'], ['Grampianos']],

  ['Himalaya', 'Himalayas', 'AS', 1, ['HIMALAYAS'], ['Himalayas']],
  ['Karakórum', 'Karakoram', 'AS', 2, ['KARAKORAM RA.'], ['Karakorum']],
  ['Hindú Kush', 'Hindu Kush', 'AS', 1, ['HINDU KUSH'], ['Hindu Kush']],
  ['Pamir', 'Pamir Mountains', 'AS', 2, ['PAMIRS'], ['Cordillera del Pamir']],
  // Kazakhstan has a twentieth of it, the ridge above Almaty: little for the rule, and the mountains of that country.
  ['Tian Shan', 'Tian Shan', 'AS', 1, ['TIAN SHAN'], ['Tien Shan', 'Montañas Celestiales'], { co: 'CN KG KZ' }],
  ['Kunlun', 'Kunlun Mountains', 'AS', 2, ['KUNLUN MOUNTAINS'], ['Montes Kunlun']],
  ['Altái', 'Altai Mountains', 'AS', 1, ['ALTAY MOUNTAINS'], ['Macizo de Altái', 'Altay']],
  ['Montes Zagros', 'Zagros Mountains', 'AS', 1, ['ZAGROS MOUNTAINS'], ['Zagros']],
  ['Montes Elburz', 'Alborz', 'AS', 2, ['ELBURZ MTS.'], ['Elburz', 'Alborz']],
  ['Montes Tauro', 'Taurus Mountains', 'AS', 2, ['Taurus Mts.'], ['Tauro']],
  ['Montes Pónticos', 'Pontic Mountains', 'AS', 2, ['PONTIC MOUNTAINS']],
  ['Ghats Occidentales', 'Western Ghats', 'AS', 2, ['WESTERN GHATS']],
  ['Ghats Orientales', 'Eastern Ghats', 'AS', 2, ['EASTERN GHATS']],
  ['Montes Verjoyansk', 'Verkhoyansk Range', 'AS', 2, ['VERKHOYANSK RANGE'], ['Cordillera Verjoyansk']],
  ['Montes Stanovói', 'Stanovoy Range', 'AS', 2, ['STANOVOY RANGE'], ['Stanovoi']],
  ['Gran Khingan', 'Greater Khingan', 'AS', 2, ['GREATER KHINGAN RANGE'], ['Gran Jingan']],
  ['Sijoté-Alín', 'Sikhote-Alin', 'AS', 2, ['SIKHOTE-ALIN’ RANGE']],
  ['Cordillera Annamita', 'Annamite Range', 'AS', 2, ['CHAÎNE ANNAMITIQUE'], ['Annamitas']],

  ['Atlas', 'Atlas Mountains', 'AF', 1, ['ATLAS MOUNTAINS'], ['Montes Atlas', 'Cordillera del Atlas']],
  ['Macizo Etíope', 'Ethiopian Highlands', 'AF', 1, ['ETHIOPIAN HIGHLANDS'], ['Tierras Altas de Etiopía', 'Altiplano etíope']],
  ['Drakensberg', 'Drakensberg', 'AF', 1, ['DRAKENSBERG'], ['Montes Drakensberg', 'Montañas del Dragón']],
  ['Tibesti', 'Tibesti Mountains', 'AF', 2, ['TIBESTI MTS.'], ['Macizo del Tibesti']],
  ['Ahaggar', 'Hoggar Mountains', 'AF', 2, ['AHAGGAR MTS.'], ['Hoggar', 'Macizo de Ahaggar']],
  ['Ruwenzori', 'Rwenzori Mountains', 'AF', 2, ['Ruwenzori Range'], ['Rwenzori', 'Montañas de la Luna']],
  ['Rif', 'Rif', 'AF', 2, ['Er Rif'], ['Cordillera del Rif']],

  ['Montañas Rocosas', 'Rocky Mountains', 'AM', 1, ['ROCKY MOUNTAINS'], ['Rocosas', 'Rocallosas', 'Montañas Rocallosas', 'Rockies']],
  ['Apalaches', 'Appalachian Mountains', 'AM', 1, ['APPALACHIAN MTS.'], ['Montes Apalaches', 'Appalachians']],
  ['Sierra Nevada (EE. UU.)', 'Sierra Nevada (USA)', 'AM', 2, ['SIERRA NEVADA'], ['Sierra Nevada']],
  ['Cordillera de las Cascadas', 'Cascade Range', 'AM', 2, ['CASCADE RANGE'], ['Cascadas', 'Cascades']],
  ['Montañas Costeras', 'Coast Mountains', 'AM', 2, ['COAST MOUNTAINS'], ['Cadena Costera']],
  ['Cordillera de Alaska', 'Alaska Range', 'AM', 2, ['ALASKA RANGE']],
  ['Cordillera de Brooks', 'Brooks Range', 'AM', 2, ['BROOKS RANGE']],
  ['Montes Mackenzie', 'Mackenzie Mountains', 'AM', 2, ['MACKENZIE MTS.']],
  ['Sierra Madre Occidental', 'Sierra Madre Occidental', 'AM', 1, ['SIERRA MADRE OCCIDENTAL']],
  ['Sierra Madre Oriental', 'Sierra Madre Oriental', 'AM', 1, ['SIERRA MADRE ORIENTAL']],
  ['Sierra Madre del Sur', 'Sierra Madre del Sur', 'AM', 2, ['Sierra Madre del Sur']],
  ['Andes', 'Andes', 'AM', 1, ['ANDES'], ['Cordillera de los Andes']],
  ['Macizo de las Guayanas', 'Guiana Highlands', 'AM', 2, ['GUIANA HIGHLANDS'], ['Macizo Guayanés', 'Escudo Guayanés']],
  ['Sierra del Mar', 'Serra do Mar', 'AM', 2, ['Serra do Mar'], ['Serra do Mar']],

  ['Gran Cordillera Divisoria', 'Great Dividing Range', 'OC', 1, ['GREAT DIVIDING RANGE'], ['Cordillera Australiana']],
  ['Alpes del Sur', 'Southern Alps', 'OC', 2, ['SOUTHERN ALPS'], ['Alpes Neozelandeses']],
  ['Montes Transantárticos', 'Transantarctic Mountains', 'AN', 2, ['Transantarctic Mountains'], ['Montañas Transantárticas']],

  // Spain: the high ground of the Atlas Nacional de España inside a box drawn by hand for each range.
  ['Sistema Central', 'Central System', 'EU', 3, [{ relief: { min: 1000, within: [[-5.9, 40.02], [-5.9, 40.7], [-5.0, 40.8], [-4.15, 41.1], [-3.45, 41.42], [-2.95, 41.38], [-2.95, 41.12], [-3.85, 40.6], [-4.5, 40.25], [-5.4, 40.02]], also: [{ min: 700, within: [[-7.05, 40.1], [-7.05, 40.5], [-5.9, 40.68], [-5.9, 40.12]] }] } }], ['Cordillera Central'], { h: 1 }],
  ['Sistema Ibérico', 'Iberian System', 'EU', 3, [{ relief: { min: 1000, within: [[-3.65, 42.45], [-2.3, 42.42], [-1.55, 41.95], [-1.2, 41.3], [-0.3, 40.95], [0.15, 40.55], [-0.25, 39.9], [-0.9, 39.72], [-1.75, 39.7], [-2.45, 40.0], [-2.55, 40.7], [-2.7, 41.05], [-2.95, 41.12], [-2.95, 41.5], [-3.7, 42.0]] } }], ['Cordillera Ibérica'], { h: 1 }],
  ['Montes de Toledo', 'Montes de Toledo', 'EU', 3, [{ relief: { min: 700, within: [[-5.9, 39.2], [-5.55, 39.75], [-4.6, 39.78], [-3.8, 39.62], [-3.45, 39.4], [-3.7, 39.12], [-4.6, 39.18], [-5.3, 39.08]] } }], ['Mountains of Toledo'], { h: 1 }],
  ['Macizo Galaico', 'Galician Massif', 'EU', 3, [{ relief: { min: 400, within: [[-8.75, 41.95], [-8.65, 43.15], [-7.9, 43.7], [-7.1, 43.5], [-7.1, 43.15], [-7.0, 42.6], [-7.0, 42.55], [-6.85, 42.25], [-6.95, 41.95], [-7.7, 41.85], [-8.2, 41.85]] } }], ['Macizo Galaico-Leonés'], { h: 1 }],
  ['Montes de León', 'Montes de León', 'EU', 3, [{ relief: { min: 1000, within: [[-6.85, 42.25], [-7.0, 42.55], [-6.4, 42.75], [-5.95, 42.45], [-6.05, 42.0], [-6.6, 41.9], [-6.95, 41.95]] } }], ['Mountains of León']],
  ['Montes Vascos', 'Basque Mountains', 'EU', 3, [{ relief: { min: 700, within: [[-3.3, 43.3], [-1.8, 43.3], [-1.72, 42.8], [-2.4, 42.6], [-3.3, 42.82]] } }], ['Montañas Vascas']],
  ['Cordillera Costero-Catalana', 'Catalan Coastal Range', 'EU', 3, [{ relief: { min: 400, keep: 0.5, within: [[3.05, 42.1], [3.0, 41.75], [2.1, 41.32], [1.25, 41.03], [0.7, 40.72], [0.15, 40.6], [0.05, 40.95], [0.9, 41.38], [1.6, 41.72], [2.3, 42.02]] } }], ['Cordilleras Costero-Catalanas', 'Cordilleras Costeras Catalanas', 'Sistema Costero-Catalán', 'Sistema Mediterráneo Catalán'], { h: 1 }],
  ['Cordillera Penibética', 'Penibaetic System', 'EU', 3, [{ relief: { min: 700, close: 8, within: [[-5.55, 36.42], [-5.45, 36.9], [-4.6, 37.02], [-3.9, 37.12], [-3.0, 37.3], [-2.0, 37.42], [-1.85, 37.1], [-2.15, 36.78], [-3.0, 36.72], [-4.3, 36.68], [-5.1, 36.38]] } }], ['Sistema Penibético', 'Penibética'], { h: 1 }],
  ['Cordillera Subbética', 'Subbaetic System', 'EU', 3, [{ relief: { min: 700, close: 8, within: [[-5.55, 36.95], [-5.0, 37.3], [-4.2, 37.62], [-3.2, 37.97], [-2.6, 38.6], [-1.8, 38.75], [-0.6, 38.87], [0.2, 38.85], [0.15, 38.5], [-0.9, 38.2], [-1.7, 37.7], [-2.0, 37.48], [-3.0, 37.36], [-3.9, 37.18], [-4.6, 37.08], [-5.45, 36.95]] } }], ['Sistema Subbético', 'Subbética'], { h: 1 }],
];

/** Deserts: `NAME` in the 1:10m regions layer. */
export const DESERTS = [
  ['Sahara', 'Sahara', 'AF', 1, ['SAHARA'], ['Desierto del Sahara']],
  ['Kalahari', 'Kalahari', 'AF', 1, ['KALAHARI DESERT'], ['Desierto del Kalahari']],
  ['Namib', 'Namib', 'AF', 1, ['NAMIB DESERT'], ['Desierto del Namib', 'Desierto de Namibia']],
  ['Desierto Líbico', 'Libyan Desert', 'AF', 2, ['LIBYAN DESERT'], ['Desierto de Libia']],
  ['Desierto de Nubia', 'Nubian Desert', 'AF', 2, ['NUBIAN DESERT']],
  ['Gobi', 'Gobi', 'AS', 1, ['GOBI DESERT'], ['Desierto de Gobi', 'Desierto del Gobi']],
  ['Rub al-Jali', "Rub' al Khali", 'AS', 1, ['RUB’ AL KHALI'], ['Rub al Khali', 'Desierto de Rub al-Jali', 'Cuarto Vacío', 'Empty Quarter']],
  ['Desierto de Thar', 'Thar Desert', 'AS', 2, ['THAR DESERT'], ['Thar', 'Gran Desierto Indio']],
  ['Taklamakán', 'Taklamakan', 'AS', 2, ['TAKLIMAKAN DESERT'], ['Desierto de Taklamakán', 'Takla Makan']],
  ['Karakum', 'Karakum', 'AS', 2, ['GARAGUM DESERT'], ['Desierto de Karakum', 'Garagum']],
  ['Kyzyl Kum', 'Kyzylkum', 'AS', 2, ['QIZILQUM DESERT'], ['Kizil Kum', 'Desierto de Kyzyl Kum', 'Kyzylkum']],
  ['Desierto Sirio', 'Syrian Desert', 'AS', 2, ['SYRIAN DESERT'], ['Desierto de Siria']],
  ['Desierto de Lut', 'Lut Desert', 'AS', 2, ['LUT DESERT'], ['Dasht-e Lut']],
  ['Desierto de Atacama', 'Atacama Desert', 'AM', 1, ['DESIERTO DE ATACAMA'], ['Atacama']],
  ['Desierto de Sonora', 'Sonoran Desert', 'AM', 2, ['SONORAN DESERT'], ['Sonora']],
  ['Desierto de Chihuahua', 'Chihuahuan Desert', 'AM', 2, ['CHIHUAHUAN DESERT'], ['Desierto chihuahuense']],
  ['Gran Desierto de Victoria', 'Great Victoria Desert', 'OC', 1, ['GREAT VICTORIA DESERT'], ['Gran Desierto Victoria']],
  ['Gran Desierto Arenoso', 'Great Sandy Desert', 'OC', 2, ['GREAT SANDY DESERT'], ['Gran Desierto de Arena']],
  ['Desierto de Gibson', 'Gibson Desert', 'OC', 2, ['Gibson Desert']],
];

/** Islands: `NAME` in the 1:10m regions layer. */
export const ISLANDS = [
  ['Gran Bretaña', 'Great Britain', 'EU', 1, ['GREAT BRITAIN']],
  ['Irlanda', 'Ireland', 'EU', 1, ['IRELAND']],
  ['Islandia', 'Iceland', 'EU', 1, ['ICELAND']],
  ['Sicilia', 'Sicily', 'EU', 1, ['Sicilia']],
  ['Cerdeña', 'Sardinia', 'EU', 1, ['Sardegna']],
  ['Córcega', 'Corsica', 'EU', 1, ['Corse']],
  ['Creta', 'Crete', 'EU', 1, ['Crete']],
  ['Mallorca', 'Majorca', 'EU', 1, ['Mallorca'], ['Mallorca']],
  ['Menorca', 'Minorca', 'EU', 2, ['Menorca'], ['Menorca'], { h: 1 }],
  ['Ibiza', 'Ibiza', 'EU', 2, ['Ibiza'], ['Eivissa'], { h: 1 }],
  ['Chipre', 'Cyprus', 'EU AS', 1, ['Cyprus']],
  ['Nueva Zembla', 'Novaya Zemlya', 'EU', 2, ['NOVAYA ZEMLYA'], ['Nóvaya Zemliá']],
  ['Svalbard', 'Svalbard', 'EU', 2, ['SVALBARD'], ['Spitsbergen']],
  ['Madagascar', 'Madagascar', 'AF', 1, ['MADAGASCAR']],
  ['Borneo', 'Borneo', 'AS', 1, ['BORNEO'], ['Kalimantan']],
  ['Sumatra', 'Sumatra', 'AS', 1, ['SUMATRA']],
  ['Java', 'Java', 'AS', 1, ['JAVA']],
  ['Célebes', 'Sulawesi', 'AS', 2, ['SULAWESI'], ['Sulawesi', 'Celebes']],
  ['Honshu', 'Honshu', 'AS', 1, ['HONSHÜ'], ['Honshū']],
  ['Hokkaido', 'Hokkaido', 'AS', 2, ['HOKKAIDÖ'], ['Hokkaidō']],
  ['Kyushu', 'Kyushu', 'AS', 2, ['KYÜSHÜ'], ['Kyūshū']],
  ['Sajalín', 'Sakhalin', 'AS', 2, ['SAKHALIN']],
  ['Taiwán', 'Taiwan', 'AS', 1, ['TAIWAN'], ['Formosa']],
  ['Luzón', 'Luzon', 'AS', 2, ['LUZON']],
  ['Mindanao', 'Mindanao', 'AS', 2, ['MINDANAO']],
  ['Sri Lanka', 'Sri Lanka', 'AS', 1, ['SRI LANKA'], ['Ceilán', 'Ceylon']],
  ['Hainan', 'Hainan', 'AS', 2, ['HAINAN'], ['Hainán']],
  ['Timor', 'Timor', 'AS', 2, ['TIMOR']],
  ['Groenlandia', 'Greenland', 'AM', 1, ['GREENLAND']],
  ['Cuba', 'Cuba', 'AM', 1, ['CUBA']],
  ['La Española', 'Hispaniola', 'AM', 1, ['HISPANIOLA'], ['Santo Domingo']],
  ['Jamaica', 'Jamaica', 'AM', 2, ['Jamaica']],
  ['Puerto Rico', 'Puerto Rico', 'AM', 2, ['Puerto Rico']],
  ['Terranova', 'Newfoundland', 'AM', 2, ['ISLAND OF NEWFOUNDLAND'], ['Isla de Terranova']],
  ['Isla de Baffin', 'Baffin Island', 'AM', 2, ['BAFFIN ISLAND'], ['Tierra de Baffin', 'Baffin']],
  ['Isla Victoria', 'Victoria Island', 'AM', 2, ['VICTORIA ISLAND']],
  ['Isla de Ellesmere', 'Ellesmere Island', 'AM', 2, ['ELLESMERE  ISLAND'], ['Ellesmere']],
  ['Isla de Vancouver', 'Vancouver Island', 'AM', 2, ['Vancouver Island'], ['Vancouver']],
  ['Tierra del Fuego', 'Tierra del Fuego', 'AM', 1, ['TIERRA DEL FUEGO'], ['Isla Grande de Tierra del Fuego']],
  ['Nueva Guinea', 'New Guinea', 'OC', 1, ['NEW GUINEA'], ['Papúa']],
  ['Tasmania', 'Tasmania', 'OC', 1, ['TASMANIA']],
  ['Isla Norte', 'North Island', 'OC', 2, ['NORTH ISLAND'], ['Isla del Norte']],
  ['Isla Sur', 'South Island', 'OC', 2, ['SOUTH ISLAND'], ['Isla del Sur']],

  // Spain: the rest of the Balearic Islands, and the Canary Islands one by one.
  // The game's own map of the world is too coarse to have it: the countries cannot be worked out from there.
  ['Formentera', 'Formentera', 'EU', 3, [{ land: 'ES', at: [1.45, 38.7] }], [], { h: 1, co: 'ES' }],
  ['Tenerife', 'Tenerife', 'EU AF', 3, ['Tenerife'], [], { h: 1 }],
  ['Gran Canaria', 'Gran Canaria', 'EU AF', 3, ['Gran Canaria'], [], { h: 1 }],
  ['Lanzarote', 'Lanzarote', 'EU AF', 3, ['Lanzarote'], [], { h: 1 }],
  ['Fuerteventura', 'Fuerteventura', 'EU AF', 3, ['Fuerteventura'], [], { h: 1 }],
  ['La Palma', 'La Palma', 'EU AF', 3, ['La Palma'], [], { h: 1 }],
  ['La Gomera', 'La Gomera', 'EU AF', 3, [{ land: 'ES', at: [-17.23, 28.12] }], ['Gomera'], { h: 1 }],
  ['El Hierro', 'El Hierro', 'EU AF', 3, ['Hierro'], ['Hierro'], { h: 1 }],
];

/** Plains, plateaus and river basins. */
export const PLAINS = [
  // The world: `NAME` in the 1:10m regions layer, among its plateaus, plains, basins and lowlands.
  // From the Pyrenees to the Urals, as Natural Earth outlines it: its widest part is in the north of Russia,
  // and the name is better read in the middle of the way.
  ['Gran Llanura Europea', 'European Plain', 'EU', 1, ['NORTHERN EUROPEAN PLAIN'], ['Llanura Europea', 'Llanura Nordeuropea', 'Gran Llanura del Norte de Europa', 'Great European Plain', 'North European Plain'], { at: [21, 52.7] }],
  ['Gran Llanura Húngara', 'Great Hungarian Plain', 'EU', 2, ['Alföld'], ['Alföld', 'Llanura Panónica', 'Pannonian Plain']],
  ['Depresión del Caspio', 'Caspian Depression', 'EU AS', 2, ['CASPIAN DEPRESSION'], ['Depresión Cáspica', 'Caspian Lowland']],
  // The source draws it over the Himalaya, down to the plains: two thirds of Nepal would be Tibet. On a map of
  // Asia that is a blot in the right place; on a map of Nepal it is wrong.
  ['Meseta del Tíbet', 'Tibetan Plateau', 'AS', 1, ['PLATEAU OF TIBET'], ['Meseta Tibetana', 'Tíbet', 'Plateau of Tibet', 'Tibet'], { co: 'CN' }],
  ['Llanura de Siberia Occidental', 'West Siberian Plain', 'AS', 1, ['WESTERN SIBERIAN PLAIN'], ['Llanura Siberiana Occidental', 'Western Siberian Plain']],
  ['Meseta Central Siberiana', 'Central Siberian Plateau', 'AS', 1, ['CENTRAL SIBERIAN PLATEAU'], ['Meseta de Siberia Central']],
  ['Meseta del Decán', 'Deccan Plateau', 'AS', 1, ['DECCAN PLATEAU'], ['Decán', 'Deccan', 'Meseta del Deccan']],
  ['Gran Llanura China', 'North China Plain', 'AS', 1, ['NORTH CHINA PLAIN'], ['Llanura del Norte de China', 'Gran Llanura del Norte de China']],
  ['Llanura Indogangética', 'Indo-Gangetic Plain', 'AS', 1, ['GANGES PLAIN'], ['Llanura del Ganges', 'Llanura Indo-Gangética', 'Ganges Plain']],
  ['Meseta de Mongolia', 'Mongolian Plateau', 'AS', 2, ['MONGOLIAN PLATEAU']],
  ['Llanura de Manchuria', 'Manchurian Plain', 'AS', 2, ['MANCHURIAN PLAIN'], ['Llanura del Nordeste de China', 'Northeast China Plain']],
  ['Estepa kazaja', 'Kazakh Steppe', 'AS', 2, ['KAZAKH STEPPE']],
  ['Depresión de Turán', 'Turan Lowland', 'AS', 2, ['TURAN LOWLAND'], ['Llanura de Turán', 'Depresión del Turán', 'Turan Depression']],
  ['Cuenca del Tarim', 'Tarim Basin', 'AS', 2, ['TARIM BASIN'], ['Tarim']],
  ['Cuenca de Sichuan', 'Sichuan Basin', 'AS', 2, ['SICHUAN BASIN'], ['Cuenca Roja']],
  ['Mesopotamia', 'Mesopotamia', 'AS', 2, ['Mesopotamia']],
  ['Cuenca del Congo', 'Congo Basin', 'AF', 1, ['CONGO BASIN']],
  ['Sahel', 'Sahel', 'AF', 1, ['SAHEL']],
  ['Grandes Llanuras', 'Great Plains', 'AM', 1, ['GREAT PLAINS'], ['Grandes Praderas']],
  ['Escudo Canadiense', 'Canadian Shield', 'AM', 1, ['CANADIAN SHIELD'], ['Escudo Laurentino', 'Laurentian Shield']],
  ['Altiplanicie Mexicana', 'Mexican Plateau', 'AM', 1, ['ALTI-PLANICIE MEXICANA'], ['Altiplano Mexicano', 'Meseta Central de México', 'Mesa Central']],
  ['Gran Cuenca', 'Great Basin', 'AM', 2, ['GREAT BASIN']],
  ['Meseta del Colorado', 'Colorado Plateau', 'AM', 2, ['COLORADO PLATEAU']],
  ['Llanura amazónica', 'Amazon Basin', 'AM', 1, ['AMAZON BASIN'], ['Cuenca del Amazonas', 'Amazonia', 'Llanura del Amazonas', 'Cuenca amazónica']],
  ['Los Llanos', 'Llanos', 'AM', 1, ['LLANOS'], ['Llanos', 'Llanos del Orinoco']],
  ['Gran Chaco', 'Gran Chaco', 'AM', 1, ['GRAN CHACO'], ['Chaco', 'El Chaco']],
  ['La Pampa', 'Pampas', 'AM', 1, ['PAMPAS'], ['Pampa', 'Llanura pampeana', 'Región pampeana', 'Las Pampas', 'The Pampas']],
  ['Meseta Brasileña', 'Brazilian Highlands', 'AM', 1, ['BRAZILIAN HIGHLANDS'], ['Macizo Brasileño', 'Planalto Brasileiro', 'Brazilian Plateau']],
  ['Altiplano andino', 'Altiplano', 'AM', 1, ['ALTIPLANO'], ['Altiplano', 'Meseta del Collao', 'Andean Plateau']],
  ['Meseta del Mato Grosso', 'Mato Grosso Plateau', 'AM', 2, ['PLANALTO DO MATO GROSSO'], ['Planalto do Mato Grosso']],
  ['Gran Cuenca Artesiana', 'Great Artesian Basin', 'OC', 1, ['GREAT ARTESIAN BASIN']],
  ['Meseta Occidental', 'Western Plateau', 'OC', 2, ['WESTERN PLATEAU'], ['Meseta Occidental Australiana', 'Meseta Australiana']],
  ['Llanura de Nullarbor', 'Nullarbor Plain', 'OC', 2, ['NULLARBOR PLAIN'], ['Nullarbor']],
  ['Cuenca del Murray-Darling', 'Murray–Darling Basin', 'OC', 2, ['MURRAY-DARLING BASIN'], ['Cuenca Murray-Darling', 'Murray-Darling Basin']],

  // Spain: the land between two heights of the Atlas Nacional de España, inside a box drawn by hand.
  ['Submeseta Norte', 'Northern Meseta', 'EU', 3, [{ relief: { min: 700, max: 1000, within: [[-6.4, 41.2], [-6.2, 42.6], [-5.0, 42.85], [-3.9, 42.75], [-3.75, 42.2], [-3.1, 41.75], [-2.95, 41.55], [-3.5, 41.5], [-4.2, 41.12], [-5.0, 40.82], [-5.9, 40.7]] } }], ['Meseta Norte', 'Submeseta Septentrional', 'Northern Sub-plateau'], { h: 1 }],
  ['Submeseta Sur', 'Southern Meseta', 'EU', 3, [{ relief: { min: 400, max: 1000, open: 4, within: [[-7.0, 39.7], [-6.3, 39.95], [-5.4, 40.0], [-4.5, 40.22], [-3.85, 40.57], [-3.0, 41.0], [-2.6, 40.6], [-2.45, 40.05], [-1.9, 39.65], [-1.5, 39.5], [-1.45, 38.9], [-2.85, 38.75], [-3.2, 38.68], [-4.0, 38.68], [-5.0, 38.53], [-6.0, 38.33], [-7.0, 38.28]] } }], ['Meseta Sur', 'Submeseta Meridional', 'Southern Sub-plateau'], { h: 1 }],
  ['Depresión del Ebro', 'Ebro Depression', 'EU', 3, [{ relief: { max: 400, within: [[-2.75, 42.7], [-1.4, 42.6], [-0.3, 42.2], [0.6, 42.0], [1.2, 41.75], [1.0, 41.3], [0.3, 40.95], [-0.6, 41.1], [-1.3, 41.5], [-2.0, 42.0], [-2.8, 42.35]] } }], ['Valle del Ebro', 'Ebro Basin', 'Ebro Valley'], { h: 1 }],
  ['Depresión del Guadalquivir', 'Guadalquivir Depression', 'EU', 3, [{ relief: { max: 400, within: [[-7.0, 37.2], [-6.4, 37.75], [-5.3, 37.95], [-4.2, 38.12], [-3.1, 38.2], [-2.9, 37.9], [-3.7, 37.72], [-4.5, 37.4], [-5.3, 37.05], [-5.9, 36.6], [-6.45, 36.7]] } }], ['Valle del Guadalquivir', 'Depresión Bética', 'Guadalquivir Basin', 'Guadalquivir Valley'], { h: 1 }],
];

/**
 * Capes: points on the coast. Those of the world are among the capes of Natural Earth's points layer,
 * which says where each one is. Those of Spain are not in it: each one is the corner of the coastline of
 * the game's own map that reaches farthest in one direction inside a small box, so the dot sits on the
 * tip of the land as it is drawn. Nothing is placed from memory.
 *
 * The points layer is made for writing names on a map, and a few of its capes stand beside the cape and
 * not on it: across a border (Palmas), on the wrong side of the headland (Verde, Blanco) or on the next
 * corner of the coast (São Roque, Frio). Those are found like the Spanish ones, by the corner of the
 * coast, and `named` says which point of the layer they are, for the link.
 */
export const CAPES = [
  // The world: `name` among the capes of the 1:10m points layer ("Name@w,s,e,n" where two share a name).
  ['Cabo Norte', 'North Cape', 'EU', 1, ['Nordkapp'], ['Nordkapp']],
  ['Cabo de San Vicente', 'Cape St. Vincent', 'EU', 1, ['Cabo de São Vicente'], ['Cabo de São Vicente', 'San Vicente', 'Cape Saint Vincent', 'Cape St Vincent']],
  ["Land's End", "Land's End", 'EU', 2, ['Lands End'], ['Lands End', 'Fin de la Tierra']],
  ['Cabo de Buena Esperanza', 'Cape of Good Hope', 'AF', 1, ['Cape of Good Hope'], ['Buena Esperanza']],
  ['Cabo de las Agujas', 'Cape Agulhas', 'AF', 1, ['Cape Agulhas'], ['Cabo Agulhas', 'Agulhas', 'Las Agujas']],
  ['Cabo Guardafui', 'Cape Guardafui', 'AF', 1, ['Gees Gwardafuy'], ['Guardafui', 'Ras Asir', 'Gees Gwardafuy']],
  ['Cabo Bon', 'Cape Bon', 'AF', 2, ['Cap Bon'], ['Cap Bon', 'Ras Addar']],
  ['Cabo Bojador', 'Cape Bojador', 'AF', 2, ['Cabo Bojador'], ['Bojador']],
  // The southern end of the long spit: the source's point is half way up its western shore.
  ['Cabo Blanco', 'Cape Blanc', 'AF', 2, [{ coast: 'MR', box: [-17.2, 20.7, -16.95, 20.9], to: 'S', named: 'Cap Blanc' }], ['Cap Blanc', 'Ras Nuadibú', 'Ras Nouadhibou']],
  ['Cabo Delgado', 'Cape Delgado', 'AF', 2, ['Cabo Delgado']],
  // Liberia's, by the town of Harper, some twenty kilometres west of the river that is the border: the source's
  // point is a quarter of a degree too far east, in Côte d'Ivoire.
  ['Cabo Palmas', 'Cape Palmas', 'AF', 2, [{ coast: 'LR', box: [-7.76, 4.33, -7.68, 4.4], to: 'S', named: 'Cape Palmas' }]],
  // The western tip of Africa, not the bay behind it.
  ['Cabo Verde', 'Cap-Vert', 'AF', 2, [{ coast: 'SN', box: [-17.6, 14.6, -17.3, 14.9], to: 'W', named: 'Cape Verde' }], ['Cap-Vert', 'Península de Cabo Verde', 'Cape Verde']],
  ['Cabo Comorín', 'Cape Comorin', 'AS', 1, ['Cape Comorin'], ['Kanyakumari', 'Cabo Comorin', 'Kanniyakumari']],
  ['Cabo Lopatka', 'Cape Lopatka', 'AS', 2, ['Cape Lopatka@155,50,158,52'], ['Lopatka']],
  ['Cabo Cheliuskin', 'Cape Chelyuskin', 'AS', 2, [{ tip: 'Cape Chelyuskin', to: 'N' }], ['Cheliuskin', 'Cabo Chelyuskin']],
  ['Ras al-Hadd', 'Ras al Hadd', 'AS', 2, ["Ra's al Had"], ['Ras al Had', 'Cabo Hadd', "Ra's al Hadd"]],
  ['Cabo de Hornos', 'Cape Horn', 'AM', 1, ['Cabo de Hornos'], ['Hornos']],
  ['Cabo Cañaveral', 'Cape Canaveral', 'AM', 1, ['Cape Canaveral'], ['Cañaveral', 'Cabo Kennedy', 'Cape Kennedy']],
  ['Cabo Cod', 'Cape Cod', 'AM', 1, ['Cape Cod']],
  ['Cabo San Lucas', 'Cabo San Lucas', 'AM', 1, ['Cabo San Lucas'], ['Cape San Lucas']],
  ['Cabo Farewell', 'Cape Farewell', 'AM', 1, ['Nunap Isua'], ['Cabo Farvel', 'Nunap Isua', 'Uummannarsuaq', 'Kap Farvel']],
  ['Cabo Hatteras', 'Cape Hatteras', 'AM', 2, ['Cape Hatteras'], ['Hatteras']],
  ['Cabo Mendocino', 'Cape Mendocino', 'AM', 2, ['Cape Mendocino'], ['Mendocino']],
  ['Punta Barrow', 'Point Barrow', 'AM', 2, ['Point Barrow'], ['Nuvuk', 'Cabo Barrow']],
  ['Cabo Gracias a Dios', 'Cape Gracias a Dios', 'AM', 2, ['Cabo Gracias a Dios'], ['Gracias a Dios']],
  // The source writes the name on the corner where Brazil's coast turns west (Touros); the cape is the next
  // corner to the south-east.
  ['Cabo de São Roque', 'Cape São Roque', 'AM', 2, [{ coast: 'BR', box: [-35.4, -5.6, -35.1, -5.35], to: 'E', named: 'Cabo de São Roque' }], ['Cabo San Roque', 'Cabo de San Roque']],
  // Where the coast of Rio de Janeiro turns north: the source's point is on the headland of Búzios, the next one up.
  ['Cabo Frío', 'Cabo Frio', 'AM', 2, [{ coast: 'BR', box: [-42.2, -23.1, -41.95, -22.85], to: 'S', named: 'Cabo Frio' }], ['Cape Frio']],
  ['Cabo York', 'Cape York', 'OC', 1, ['Cape York@140,-12,144,-9']],
  ['Cabo Leeuwin', 'Cape Leeuwin', 'OC', 2, ['Cape Leeuwin'], ['Leeuwin']],
  ['Cabo Byron', 'Cape Byron', 'OC', 2, ['Cape Byron'], ['Byron']],
  ['Cabo Reinga', 'Cape Reinga', 'OC', 2, ['Cape Reinga'], ['Te Rerenga Wairua']],
  ['Cabo Adare', 'Cape Adare', 'AN', 2, ['Cape Adare'], ['Adare']],

  // Spain: the corners of its coast, as the game draws it.
  // Finisterre is one of the four capes of Europe that Natural Earth marks: it is asked on the continent too.
  ['Cabo Finisterre', 'Cape Finisterre', 'EU', 2, [{ coast: 'ES', box: [-9.4, 42.8, -9.1, 43.0], to: 'W' }], ['Finisterre', 'Cabo Fisterra', 'Fisterra', 'Cabo de Finisterre'], { h: 1 }],
  ['Cabo Ortegal', 'Cape Ortegal', 'EU', 3, [{ coast: 'ES', box: [-7.95, 43.7, -7.82, 43.82], to: 'N' }], ['Ortegal']],
  ['Estaca de Bares', 'Estaca de Bares', 'EU', 3, [{ coast: 'ES', box: [-7.8, 43.7, -7.6, 43.85], to: 'N' }], ['Punta de la Estaca de Bares', 'Cabo de Estaca de Bares', 'Estaca de Vares'], { h: 1 }],
  ['Cabo de Peñas', 'Cape Peñas', 'EU', 3, [{ coast: 'ES', box: [-6.0, 43.55, -5.7, 43.7], to: 'N' }], ['Cabo Peñas', 'Peñas'], { h: 1 }],
  ['Cabo de Ajo', 'Cape Ajo', 'EU', 3, [{ coast: 'ES', box: [-3.7, 43.45, -3.5, 43.55], to: 'N' }], ['Cabo Ajo', 'Ajo']],
  ['Cabo Machichaco', 'Cape Matxitxako', 'EU', 3, [{ coast: 'ES', box: [-2.9, 43.4, -2.65, 43.5], to: 'N' }], ['Machichaco', 'Cabo Matxitxako', 'Matxitxako', 'Cabo de Machichaco', 'Cape Machichaco'], { h: 1 }],
  ['Cabo de Creus', 'Cap de Creus', 'EU', 3, [{ coast: 'ES', box: [3.15, 42.2, 3.4, 42.4], to: 'E' }], ['Cap de Creus', 'Creus', 'Cape Creus'], { h: 1 }],
  ['Cabo de Tortosa', 'Cape Tortosa', 'EU', 3, [{ coast: 'ES', box: [0.75, 40.6, 1.0, 40.8], to: 'E' }], ['Cap de Tortosa', 'Tortosa']],
  ['Cabo de la Nao', 'Cap de la Nau', 'EU', 3, [{ coast: 'ES', box: [0.1, 38.65, 0.3, 38.8], to: 'E' }], ['Cap de la Nau', 'La Nao', 'Cabo La Nao', 'Cape La Nao'], { h: 1 }],
  ['Cabo de Palos', 'Cape Palos', 'EU', 3, [{ coast: 'ES', box: [-0.8, 37.55, -0.6, 37.7], to: 'E' }], ['Palos', 'Cabo Palos'], { h: 1 }],
  ['Cabo de Gata', 'Cape Gata', 'EU', 3, [{ coast: 'ES', box: [-2.3, 36.65, -2.0, 36.8], to: 'S' }], ['Gata', 'Cabo Gata'], { h: 1 }],
  ['Punta de Tarifa', 'Punta de Tarifa', 'EU', 3, [{ coast: 'ES', box: [-5.7, 35.95, -5.5, 36.05], to: 'S' }], ['Tarifa', 'Punta Marroquí', 'Cabo de Tarifa', 'Point Tarifa'], { h: 1 }],
  ['Cabo de Trafalgar', 'Cape Trafalgar', 'EU', 3, [{ coast: 'ES', box: [-6.1, 36.12, -5.95, 36.25], to: 'SW' }], ['Trafalgar', 'Cabo Trafalgar'], { h: 1 }],
  ['Cabo de Formentor', 'Cap de Formentor', 'EU', 3, [{ coast: 'ES', box: [3.1, 39.9, 3.3, 40.0], to: 'NE' }], ['Cap de Formentor', 'Formentor', 'Cabo Formentor', 'Cape Formentor']],
];

/**
 * Peninsulas: `NAME` in the 1:10m regions layer. The Italian one is not there: it is the coast of Italy
 * south of the line from La Spezia to Rimini, where the textbooks have the peninsula begin.
 */
export const PENINSULAS = [
  ['Península Ibérica', 'Iberian Peninsula', 'EU', 1, ['PENÍNSULA IBÉRICA'], ['Iberia']],
  ['Península Itálica', 'Italian Peninsula', 'EU', 1, [{ shore: 'IT', a: [9.83, 44.08], b: [12.57, 44.06], by: [15.65, 38.0] }], ['Península Italiana', 'Península Apenina', 'Italia peninsular', 'Apennine Peninsula']],
  ['Península Escandinava', 'Scandinavian Peninsula', 'EU', 1, ['SCANDINAVIA'], ['Escandinavia', 'Scandinavia']],
  ['Península Balcánica', 'Balkan Peninsula', 'EU', 1, ['BALKAN PEN.'], ['Península de los Balcanes']],
  ['Península de Crimea', 'Crimea', 'EU', 2, ['CRIMEA'], ['Crimea', 'Crimean Peninsula']],
  ['Península de Kola', 'Kola Peninsula', 'EU', 2, ['KOLA PENINSULA'], ['Kola']],
  ['Península de Jutlandia', 'Jutland', 'EU', 2, ['JUTLAND'], ['Jutlandia', 'Jutland Peninsula']],
  ['Peloponeso', 'Peloponnese', 'EU', 2, ['Pelopónnisos'], ['Península del Peloponeso', 'Morea', 'Peloponnesus']],
  ['Península de Bretaña', 'Brittany', 'EU', 2, ['Bretagne'], ['Bretaña', 'Península Bretona', 'Brittany Peninsula']],
  ['Península Arábiga', 'Arabian Peninsula', 'AS', 1, ['ARABIAN PENINSULA'], ['Arabia', 'Península de Arabia']],
  ['Península del Indostán', 'Indian subcontinent', 'AS', 1, ['INDIA'], ['Indostán', 'Subcontinente indio', 'Península Índica', 'Península de la India', 'India', 'Hindustan', 'Indian Peninsula']],
  ['Indochina', 'Indochina', 'AS', 1, ['INDOCHINA PENINSULA'], ['Península de Indochina', 'Indochinese Peninsula', 'Indochina Peninsula']],
  ['Anatolia', 'Anatolia', 'AS', 1, ['ANATOLIA'], ['Península de Anatolia', 'Asia Menor', 'Asia Minor']],
  // The whole of both countries: on the map of either there is nothing to point at. (The source draws its neck
  // south of the border, and by the rule it would be asked in the North and not in the South.)
  ['Península de Corea', 'Korean Peninsula', 'AS', 1, ['KOREA'], ['Corea', 'Korea'], { co: '' }],
  ['Península de Kamchatka', 'Kamchatka Peninsula', 'AS', 1, ['KAMCHATKA PENINSULA'], ['Kamchatka']],
  ['Península de Malaca', 'Malay Peninsula', 'AS', 2, ['MALAY PENINSULA'], ['Península Malaya', 'Malaca']],
  ['Península de Taimir', 'Taymyr Peninsula', 'AS', 2, ['TAYMYR PENINSULA'], ['Taimir', 'Taymyr', 'Península de Taimyr']],
  ['Península de Yamal', 'Yamal Peninsula', 'AS', 2, ['YAMAL PENINSULA'], ['Yamal']],
  ['Península de Chukotka', 'Chukchi Peninsula', 'AS', 2, ['CHUKCHI PENINSULA'], ['Chukotka', 'Península de Chukchi']],
  ['Península de Shandong', 'Shandong Peninsula', 'AS', 2, ['Shandong Pen.'], ['Shandong']],
  // The source draws the Somali peninsula: Somalia and the east of Ethiopia. Under the name everyone knows it by,
  // the whole of Ethiopia is in it, and its eastern third would be the wrong answer to learn on that map.
  ['Cuerno de África', 'Horn of Africa', 'AF', 1, ['SOMALI PENINSULA'], ['Península de Somalia', 'Somali Peninsula'], { co: '' }],
  ['Península de Yucatán', 'Yucatán Peninsula', 'AM', 1, ['PEN. DE YUCATÁN'], ['Yucatán', 'Yucatan']],
  ['Península de Baja California', 'Baja California Peninsula', 'AM', 1, ['BAJA CALIFORNIA'], ['Baja California', 'Península de California']],
  // The source ties its outline to the state of that name, which is more than the peninsula: no link is kept.
  ['Península de Florida', 'Florida Peninsula', 'AM', 1, ['FLORIDA'], ['Florida', 'La Florida'], { wd: '' }],
  ['Península de Alaska', 'Alaska Peninsula', 'AM', 2, ['ALASKA PENINSULA']],
  ['Península de Ungava', 'Ungava Peninsula', 'AM', 2, ['PÉNINSULE D’UNGAVA'], ['Ungava']],
  ['Península Valdés', 'Valdés Peninsula', 'AM', 2, ['Península Valdés'], ['Valdés', 'Península de Valdés', 'Valdes Peninsula']],
  ['Península de la Guajira', 'Guajira Peninsula', 'AM', 2, ['Pen. de la Guajira'], ['La Guajira', 'Guajira']],
  ['Península del Cabo York', 'Cape York Peninsula', 'OC', 2, ['CAPE YORK PEN.'], ['Península de York']],
  ['Península Antártica', 'Antarctic Peninsula', 'AN', 1, ['Antarctic Peninsula'], ['Tierra de O’Higgins', 'Tierra de San Martín']],
];

/**
 * Waterfalls: `name` among the four that the 1:10m points layer has.
 *
 * Two of the four are marked away from the falls, and no layer of the source has anything to find them by:
 * `at` gives the longitude and latitude that any atlas does, to the hundredth of a degree. They are the only
 * places in this file written down as numbers.
 */
export const FALLS = [
  ['Cataratas del Niágara', 'Niagara Falls', 'AM', 1, ['Niagara Falls'], ['Niágara', 'Niagara']],
  // The source's point is some sixty kilometres to the south-east; the falls drop from the Auyantepui at 5°58′ N, 62°32′ W.
  ['Salto Ángel', 'Angel Falls', 'AM', 1, ['Salto Angel'], ['Salto del Ángel', 'Kerepakupai Merú', 'Kerepakupai Vená'], { at: [-62.54, 5.97] }],
  // The source marks the town where the Iguazú meets the Paraná, at the three-way border; the falls are twenty
  // kilometres up the river (25°41′ S, 54°26′ W), between Argentina and Brazil, and Paraguay has no part in them.
  ['Cataratas del Iguazú', 'Iguazu Falls', 'AM', 1, ['Iguazu Falls'], ['Iguazú', 'Cataratas do Iguaçu', 'Iguaçu', 'Iguazu'], { at: [-54.44, -25.69], co: 'AR BR' }],
  ['Cataratas Victoria', 'Victoria Falls', 'AF', 1, ['Victoria Falls'], ['Mosi-oa-Tunya', 'Cataratas de Victoria']],
];

/**
 * Continents, as the game counts them: six, with America as one. The sources are the outlines that Natural
 * Earth draws of each mainland; the islands are added from the game's own map (see `ISLANDS_OF`). `at` is
 * where the name is written, when the middle of the biggest piece would not do. They belong to no country's
 * map (`co: ''`): a continent is not a feature of Spain.
 *
 * Their surface is the one The World Factbook gives each landmass, the figure the books carry. It has none
 * for Oceania, only for Australia: that one is the surface of what the map paints as Oceania, the whole of
 * New Guinea and Hawaii included.
 */
export const CONTINENTS = [
  // The widest of it is Russia: its name goes in the middle of what everybody calls Europe.
  ['Europa', 'Europe', 'EU', 1, ['EUROPE'], ['Continente europeo'], { co: '', at: [24, 52], area: 'land:Europe' }],
  ['Asia', 'Asia', 'AS', 1, ['ASIA'], ['Continente asiático'], { co: '', area: 'land:Asia' }],
  ['África', 'Africa', 'AF', 1, ['AFRICA'], ['Continente africano'], { co: '', area: 'land:Africa' }],
  // One continent in two masses: its name goes between them, not on the northern one.
  ['América', 'Americas', 'AM', 1, ['NORTH AMERICA', 'CENTRAL AMERICA', 'Darien Gap', 'SOUTH AMERICA'], ['America', 'Continente americano', 'Américas', 'The Americas'], { co: '', at: [-85.5, 13], area: 'land:North America+South America' }],
  ['Oceanía', 'Oceania', 'OC', 1, ['AUSTRALIA'], ['Continente oceánico'], { co: '', area: 'outline' }],
  ['Antártida', 'Antarctica', 'AN', 1, ['ANTARCTICA'], ['Antártica', 'Continente antártico'], { co: '', area: 'land:Antarctica' }],
];

/**
 * What Natural Earth outlines with one continent and belongs to another. The stretch of the outline of
 * `from` that runs from the corner nearest `a` to the one nearest `b`, passing by `by`, becomes a piece of
 * `to`. Only the Sinai: Africa ends at the Suez Canal, from Port Said to Suez.
 */
export const CONTINENT_MOVES = [{ what: 'the Sinai', from: 'AF', to: 'AS', a: [32.31, 31.27], b: [32.55, 29.95], by: [34.25, 27.75] }];

/**
 * The islands that those outlines leave out are of the continent of their country, as the game files it,
 * but for these: [country, box [w, s, e, n] or null for all of them, continent or null for none].
 */
export const ISLANDS_OF = [
  // Cyprus is filed under Europe and lies off Asia.
  ['CY', null, 'AS'],
  // Russia is filed under Europe; its islands east of the Urals are Asia.
  ['RU', [68, 40, 180, 90], 'AS'],
  ['RU', [-180, 40, -160, 90], 'AS'],
  // The Canaries and Madeira lie off Africa.
  ['ES', [-19, 27, -13, 30], 'AF'],
  ['PT', [-18, 32, -16, 34], 'AF'],
  // Hawaii is Polynesia. New Guinea is Oceania, though half of it is Indonesia, with the islands that stand
  // on its shelf: the Raja Ampat, Biak and Yapen to the north, the Aru to the south. The Moluccas are Asia.
  ['US', [-162, 18, -154, 23], 'OC'],
  ['ID', [129.5, -2.5, 141.5, 1], 'OC'],
  ['ID', [133.8, -9.5, 141.5, -2.5], 'OC'],
  // Islands in mid-ocean that the game files under Antarctica for want of a better place.
  ['TF', null, null],
  ['GS', null, null],
  ['HM', null, null],
  ['BV', null, null],
];

/**
 * Peaks and volcanoes: points, not shapes. Every entry is looked up by name among the mountains of
 * Natural Earth's elevation points, which supply the place, the height and the Wikidata id; nothing
 * here is written from memory. Two rules decided what stays out: a peak that Natural Earth does not
 * have (Annapurna, Cotopaxi, Mount St. Helens…) and a peak that sits so close to another one of the
 * list that the two dots could not be told apart on the map of a continent (Monte Rosa by the
 * Matterhorn, Mauna Loa by Mauna Kea).
 */
export const PEAKS = [
  // Europe
  ['Mont Blanc', 'Mont Blanc', 'EU', 1, ['Mont Blanc'], ['Monte Blanco', 'Monte Bianco']],
  ['Elbrús', 'Mount Elbrus', 'EU', 1, ['Gora Elbrus'], ['Elbrus', 'Monte Elbrús', 'Monte Elbrus']],
  ['Cervino', 'Matterhorn', 'EU', 1, ['Matterhorn'], ['Monte Cervino']],
  ['Teide', 'Teide', 'EU AF', 1, ['Pico del Teide'], ['Pico del Teide', 'El Teide', 'Mount Teide']],
  ['Mulhacén', 'Mulhacén', 'EU', 1, ['Mulhacén']],
  ['Aneto', 'Aneto', 'EU', 1, ['Pico de Aneto'], ['Pico Aneto', 'Pico de Aneto']],
  ['Etna', 'Mount Etna', 'EU', 1, ['Monte Etna'], ['Monte Etna']],
  ['Vesubio', 'Mount Vesuvius', 'EU', 1, ['Vesuvio'], ['Monte Vesubio', 'Vesuvio', 'Vesuvius']],
  ['Olimpo', 'Mount Olympus', 'EU', 1, ['Mount Olympus@20,38,25,42'], ['Monte Olimpo', 'Olympus']],
  ['Zugspitze', 'Zugspitze', 'EU', 2, ['Zugspitze']],
  ['Grossglockner', 'Grossglockner', 'EU', 2, ['Grossglockner'], ['Großglockner']],
  ['Triglav', 'Triglav', 'EU', 2, ['Triglav']],
  ['Musala', 'Musala', 'EU', 2, ['Musala']],
  ['Pico Gerlach', 'Gerlachovský štít', 'EU', 2, ['Gerlach'], ['Gerlach', 'Gerlachovsky stit']],
  ['Moldoveanu', 'Moldoveanu', 'EU', 2, ['Moldoveanu']],
  ['Hoverla', 'Hoverla', 'EU', 2, ['Gora Goverla'], ['Goverla']],
  ['Galdhøpiggen', 'Galdhøpiggen', 'EU', 2, ['Galdhpiggen'], ['Galdhopiggen']],
  ['Kebnekaise', 'Kebnekaise', 'EU', 2, ['Kebnekaise']],
  ['Hvannadalshnúkur', 'Hvannadalshnúkur', 'EU', 2, ['Hvannadalshnkur'], ['Hvannadalshnjúkur', 'Hvannadalshnukur']],
  ['Ben Nevis', 'Ben Nevis', 'EU', 2, ['Ben Nevis']],
  ['Snowdon', 'Snowdon', 'EU', 2, ['Snowdon'], ['Yr Wyddfa']],
  ['Carrauntoohil', 'Carrauntoohil', 'EU', 2, ['Carrauntoohil'], ['Carrantuohill']],
  ['Torrecerredo', 'Torre Cerredo', 'EU', 2, ['Torre de Cerredo'], ['Torre de Cerredo', 'Torre Cerredo'], { h: 1 }],
  ['Almanzor', 'Pico Almanzor', 'EU', 2, ['Pico de Almanzor'], ['Pico de Almanzor', 'Moro Almanzor'], { h: 1 }],
  ['Moncayo', 'Moncayo', 'EU', 2, ['Moncayo'], ['Pico de San Miguel'], { h: 1 }],
  ['Puig Major', 'Puig Major', 'EU', 2, ['Puig Mayor'], ['Puig Mayor']],
  ['Corno Grande', 'Corno Grande', 'EU', 2, ['Corno Grande'], ['Gran Sasso']],
  ['Monte Cinto', 'Monte Cinto', 'EU', 2, ['Monte Cinto'], ['Cinto']],
  ['Puy de Sancy', 'Puy de Sancy', 'EU', 2, ['Puy de Sancy'], ['Sancy']],
  ['Monte Ida', 'Mount Ida', 'EU', 2, ['Psiloritis'], ['Psiloritis', 'Ida']],
  ['Naródnaya', 'Mount Narodnaya', 'EU AS', 2, ['Gora Narodnaya'], ['Narodnaya']],

  // Asia
  ['Everest', 'Mount Everest', 'AS', 1, ['Mount Everest'], ['Monte Everest', 'Chomolungma', 'Sagarmatha']],
  ['K2', 'K2', 'AS', 1, ['K2'], ['Godwin-Austen', 'Chogori']],
  ['Monte Fuji', 'Mount Fuji', 'AS', 1, ['Fuji'], ['Fuji', 'Fujiyama', 'Fuji-san']],
  ['Ararat', 'Mount Ararat', 'AS', 1, ['Mount Ararat'], ['Monte Ararat']],
  ['Krakatoa', 'Krakatoa', 'AS', 1, ['Krakatau'], ['Krakatau', 'Volcán Krakatoa']],
  ['Kanchenjunga', 'Kangchenjunga', 'AS', 2, ['Kanchenjunga'], ['Kanchenjunga']],
  ['Dhaulagiri', 'Dhaulagiri', 'AS', 2, ['Dhaulagiri']],
  ['Nanga Parbat', 'Nanga Parbat', 'AS', 2, ['Nanga Parbat']],
  ['Kailash', 'Mount Kailash', 'AS', 2, ['Kailash'], ['Monte Kailash', 'Kailas']],
  ['Damavand', 'Mount Damavand', 'AS', 2, ['Mount Damavand'], ['Monte Damavand']],
  ['Monte Hermón', 'Mount Hermon', 'AS', 2, ['Jabal ash Shaykh'], ['Hermón', 'Hermon', 'Jabal al-Shaykh']],
  ['Pico Ismail Samani', 'Ismoil Somoni Peak', 'AS', 2, ['Pik Imeni Ismail Samani'], ['Ismail Samani', 'Ismoil Somoni', 'Pico Comunismo', 'Communism Peak']],
  ['Pico Pobeda', 'Jengish Chokusu', 'AS', 2, ['Pik Pobeda'], ['Pobeda', 'Pico Victoria', 'Victory Peak']],
  ['Beluja', 'Belukha', 'AS', 2, ['Belukha'], ['Monte Beluja']],
  ['Kliuchevskói', 'Klyuchevskaya Sopka', 'AS', 2, ['Klyuchevskaya Sopka'], ['Kliuchévskaya Sopka', 'Klyuchevskoy', 'Kliuchevskoi']],
  ['Kinabalu', 'Mount Kinabalu', 'AS', 2, ['Gunung Kinabalu'], ['Monte Kinabalu']],
  ['Pinatubo', 'Mount Pinatubo', 'AS', 2, ['Mount Pinatubo'], ['Monte Pinatubo']],
  ['Tambora', 'Mount Tambora', 'AS', 2, ['Gunung Tambora'], ['Monte Tambora']],
  ['Merapi', 'Mount Merapi', 'AS', 2, ['Gunung Merapi'], ['Monte Merapi']],

  // Africa
  ['Kilimanjaro', 'Mount Kilimanjaro', 'AF', 1, ['Mount Kilimanjaro'], ['Monte Kilimanjaro', 'Kilimanyaro']],
  ['Monte Kenia', 'Mount Kenya', 'AF', 1, ['Mount Kenya'], ['Kenia', 'Kenya']],
  ['Toubkal', 'Toubkal', 'AF', 1, ['Jebel Toubkal'], ['Jebel Toubkal', 'Yebel Tubqal', 'Tubqal']],
  ['Monte Stanley', 'Mount Stanley', 'AF', 2, ['Mount Stanley'], ['Stanley', 'Pico Margarita', 'Margherita Peak']],
  ['Ras Dashen', 'Ras Dashen', 'AF', 2, ['Ras Dejen'], ['Ras Dejen', 'Ras Dashan']],
  ['Monte Camerún', 'Mount Cameroon', 'AF', 2, ['Mont Cameroun'], ['Camerún', 'Fako']],
  ['Monte Elgon', 'Mount Elgon', 'AF', 2, ['Mount Elgon'], ['Elgon']],
  ['Emi Koussi', 'Emi Koussi', 'AF', 2, ['Emi Koussi']],
  ['Tahat', 'Mount Tahat', 'AF', 2, ['Tahat'], ['Monte Tahat']],
  ['Thabana Ntlenyana', 'Thabana Ntlenyana', 'AF', 2, ['Thabana Ntlenyana']],
  ['Monte Catalina', 'Mount Catherine', 'AF', 2, ['Gebel Katherna'], ['Santa Catalina', 'Jebel Katrina', 'Gebel Katherina']],
  ['Pico Basilé', 'Pico Basilé', 'AF', 2, ['Pico de Santa Isabel'], ['Pico de Santa Isabel']],
  ['Pico de Fogo', 'Pico do Fogo', 'AF', 2, ['Pico de Cano'], ['Fogo']],
  ['Pitón de las Nieves', 'Piton des Neiges', 'AF', 2, ['Piton des Neiges']],

  // The Americas
  ['Aconcagua', 'Aconcagua', 'AM', 1, ['Cerro Aconcagua'], ['Cerro Aconcagua']],
  ['Denali', 'Denali', 'AM', 1, ['Denali'], ['McKinley', 'Monte McKinley', 'Mount McKinley']],
  ['Pico de Orizaba', 'Pico de Orizaba', 'AM', 1, ['Pico de Orizaba'], ['Citlaltépetl', 'Orizaba']],
  ['Popocatépetl', 'Popocatépetl', 'AM', 1, ['Volcán Popocatépetl'], ['Volcán Popocatépetl']],
  ['Chimborazo', 'Chimborazo', 'AM', 1, ['Chimborazo'], ['Volcán Chimborazo']],
  ['Monte Logan', 'Mount Logan', 'AM', 2, ['Mount Logan'], ['Logan']],
  ['Monte Whitney', 'Mount Whitney', 'AM', 2, ['Mount Whitney'], ['Whitney']],
  ['Monte Rainier', 'Mount Rainier', 'AM', 2, ['Mount Rainier'], ['Rainier']],
  ['Monte Elbert', 'Mount Elbert', 'AM', 2, ['Mount Elbert'], ['Elbert']],
  ['Monte Mitchell', 'Mount Mitchell', 'AM', 2, ['Mount Mitchell'], ['Mitchell']],
  ['Gunnbjørn', 'Gunnbjørn Fjeld', 'AM', 2, ['Gunnbjørn Fjeld'], ['Gunnbjorn', 'Gunnbjörn']],
  ['Tajumulco', 'Tajumulco', 'AM', 2, ['Volcán Tajumulco'], ['Volcán Tajumulco']],
  ['Chirripó', 'Chirripó', 'AM', 2, ['Cerro Chirripó'], ['Cerro Chirripó']],
  ['Pico Duarte', 'Pico Duarte', 'AM', 2, ['Pico Duarte'], ['Duarte']],
  ['Pico Turquino', 'Pico Turquino', 'AM', 2, ['Pico Turquino'], ['Turquino']],
  ['Monte Pelée', 'Mount Pelée', 'AM', 2, ['Montagne Pelée'], ['Montaña Pelada', 'Mont Pelée', 'Montagne Pelée', 'Pelée']],
  ['Pico Cristóbal Colón', 'Pico Cristóbal Colón', 'AM', 2, ['Pico Cristóbal Colón'], ['Cristóbal Colón']],
  ['Pico Bolívar', 'Pico Bolívar', 'AM', 2, ['Pico Bolívar'], ['Bolívar']],
  ['Nevado del Ruiz', 'Nevado del Ruiz', 'AM', 2, ['Nevado del Ruiz'], ['Ruiz']],
  ['Monte Roraima', 'Mount Roraima', 'AM', 2, ['Mount Roraima'], ['Roraima']],
  ['Pico da Neblina', 'Pico da Neblina', 'AM', 2, ['Pico da Neblina'], ['Pico de la Neblina']],
  ['Huascarán', 'Huascarán', 'AM', 2, ['Nevado Huascarán'], ['Nevado Huascarán']],
  ['Illimani', 'Illimani', 'AM', 2, ['Nevado Illimani'], ['Nevado Illimani']],
  ['Ojos del Salado', 'Ojos del Salado', 'AM', 2, ['Nevado Ojos del Salado'], ['Nevado Ojos del Salado']],
  ['Volcán Villarrica', 'Villarrica', 'AM', 2, ['Volcaán Villarrica'], ['Villarrica']],
  ['Fitz Roy', 'Fitz Roy', 'AM', 2, ['Monte Fitz Roy'], ['Monte Fitz Roy', 'Chaltén', 'Cerro Chaltén', 'Fitzroy']],
  ['Torres del Paine', 'Torres del Paine', 'AM', 2, ['Torres del Paine'], ['Paine']],

  // Oceania and Antarctica
  ['Kosciuszko', 'Mount Kosciuszko', 'OC', 1, ['Mount Kosciuszko'], ['Monte Kosciuszko']],
  ['Puncak Jaya', 'Puncak Jaya', 'OC', 1, ['Puncak Jaya'], ['Pirámide de Carstensz', 'Carstensz Pyramid', 'Jaya']],
  ['Monte Cook', 'Aoraki / Mount Cook', 'OC', 1, ['Aoraki (Mount Cook)'], ['Aoraki', 'Mount Cook', 'Cook']],
  ['Mauna Kea', 'Mauna Kea', 'OC', 1, ['Mauna Kea']],
  ['Monte Wilhelm', 'Mount Wilhelm', 'OC', 2, ['Mount Wilhelm'], ['Wilhelm']],
  ['Ruapehu', 'Mount Ruapehu', 'OC', 2, ['Mount Ruapehu'], ['Monte Ruapehu']],
  ['Taranaki', 'Mount Taranaki', 'OC', 2, ['Mount Taranaki'], ['Monte Taranaki', 'Monte Egmont', 'Mount Egmont']],
  ['Uluru', 'Uluru', 'OC', 2, ['Uluru (Ayers Rock)'], ['Ayers Rock']],
  ['Macizo Vinson', 'Vinson Massif', 'AN', 1, ['Vinson Massif'], ['Monte Vinson', 'Mount Vinson', 'Vinson']],
  ['Monte Erebus', 'Mount Erebus', 'AN', 2, ['Mount Erebus'], ['Erebus']],

  // Spain: two more tops of its ranges that Natural Earth has.
  ['San Lorenzo', 'San Lorenzo', 'EU', 3, ['Mount San Lorenzo'], ['Pico San Lorenzo', 'Monte San Lorenzo', 'Mount San Lorenzo']],
  ['Teleno', 'Teleno', 'EU', 3, ['El Teleno'], ['El Teleno', 'Monte Teleno']],
];

/**
 * Capitals of regions written by hand, for the countries where Natural Earth marks the capitals of a
 * different level (Spanish provinces), of an older map (French regions) or none at all (French
 * departments, whose capital is the seat of the prefecture). Keys are unit ids or names; the first name
 * is the one shown, the rest are also accepted.
 *
 * The Italian provinces are left out on purpose: nearly every one is named after its capital (Milano,
 * Torino, Bari…), so there would be nothing to ask.
 */
export const REGION_CAPITALS = {
  ES: {
    f: {
      'ES-A': ['Alicante', 'Alacant'], 'ES-AB': ['Albacete'], 'ES-AL': ['Almería'], 'ES-AV': ['Ávila'], 'ES-B': ['Barcelona'], 'ES-BA': ['Badajoz'],
      'ES-BI': ['Bilbao', 'Bilbo'], 'ES-BU': ['Burgos'], 'ES-C': ['La Coruña', 'A Coruña', 'Coruña'], 'ES-CA': ['Cádiz'], 'ES-CC': ['Cáceres'], 'ES-CE': ['Ceuta'],
      'ES-CO': ['Córdoba'], 'ES-CR': ['Ciudad Real'], 'ES-CS': ['Castellón de la Plana', 'Castelló de la Plana', 'Castellón', 'Castelló'], 'ES-CU': ['Cuenca'],
      'ES-GC': ['Las Palmas de Gran Canaria', 'Las Palmas'], 'ES-GI': ['Gerona', 'Girona'], 'ES-GR': ['Granada'], 'ES-GU': ['Guadalajara'], 'ES-H': ['Huelva'],
      'ES-HU': ['Huesca'], 'ES-J': ['Jaén'], 'ES-L': ['Lérida', 'Lleida'], 'ES-LE': ['León'], 'ES-LO': ['Logroño'], 'ES-LU': ['Lugo'], 'ES-M': ['Madrid'],
      'ES-MA': ['Málaga'], 'ES-ML': ['Melilla'], 'ES-MU': ['Murcia'], 'ES-NA': ['Pamplona', 'Iruña', 'Iruñea'], 'ES-O': ['Oviedo', 'Uviéu'], 'ES-OR': ['Orense', 'Ourense'],
      'ES-P': ['Palencia'], 'ES-PM': ['Palma', 'Palma de Mallorca'], 'ES-PO': ['Pontevedra'], 'ES-S': ['Santander'], 'ES-SA': ['Salamanca'], 'ES-SE': ['Sevilla'],
      'ES-SG': ['Segovia'], 'ES-SO': ['Soria'], 'ES-SS': ['San Sebastián', 'Donostia', 'Donostia-San Sebastián'], 'ES-T': ['Tarragona'], 'ES-TE': ['Teruel'],
      'ES-TF': ['Santa Cruz de Tenerife', 'Santa Cruz'], 'ES-TO': ['Toledo'], 'ES-V': ['Valencia', 'València'], 'ES-VA': ['Valladolid'],
      'ES-VI': ['Vitoria', 'Vitoria-Gasteiz', 'Gasteiz'], 'ES-Z': ['Zaragoza'], 'ES-ZA': ['Zamora'],
    },
    g1: {
      'ES-AN': ['Sevilla'], 'ES-AR': ['Zaragoza'], 'ES-AS': ['Oviedo', 'Uviéu'], 'ES-CN': ['Las Palmas de Gran Canaria', 'Santa Cruz de Tenerife', 'Las Palmas', 'Santa Cruz'],
      'ES-CB': ['Santander'], 'ES-CL': ['Valladolid'], 'ES-CM': ['Toledo'], 'ES-CT': ['Barcelona'], 'ES-CE': ['Ceuta'], 'ES-EX': ['Mérida'],
      'ES-NC': ['Pamplona', 'Iruña', 'Iruñea'], 'ES-GA': ['Santiago de Compostela', 'Santiago'], 'ES-IB': ['Palma', 'Palma de Mallorca'], 'ES-RI': ['Logroño'],
      'ES-MD': ['Madrid'], 'ES-ML': ['Melilla'], 'ES-MC': ['Murcia'], 'ES-PV': ['Vitoria', 'Vitoria-Gasteiz', 'Gasteiz'], 'ES-VC': ['Valencia', 'València'],
    },
  },
  FR: {
    g1: {
      'Auvergne-Rhône-Alpes': ['Lyon', 'Lion'], 'Bourgogne-Franche-Comté': ['Dijon'], 'Bretagne': ['Rennes'], 'Centre-Val de Loire': ['Orleans', 'Orléans'],
      'Corse': ['Ajaccio', 'Ayacio'], 'Grand Est': ['Estrasburgo', 'Strasbourg'], 'Hauts-de-France': ['Lille', 'Lila'], 'Île-de-France': ['París', 'Paris'],
      'Normandie': ['Ruan', 'Rouen'], 'Nouvelle-Aquitaine': ['Burdeos', 'Bordeaux'], 'Occitanie': ['Toulouse', 'Tolosa'], 'Pays de la Loire': ['Nantes'],
      "Provence-Alpes-Côte d'Azur": ['Marsella', 'Marseille'],
    },
    f: {
      'FR-01': ['Bourg-en-Bresse'], 'FR-02': ['Laon'], 'FR-03': ['Moulins'], 'FR-04': ['Digne-les-Bains', 'Digne'], 'FR-05': ['Gap'], 'FR-06': ['Niza', 'Nice'],
      'FR-07': ['Privas'], 'FR-08': ['Charleville-Mézières', 'Charleville'], 'FR-09': ['Foix'], 'FR-10': ['Troyes'], 'FR-11': ['Carcasona', 'Carcassonne'],
      'FR-12': ['Rodez'], 'FR-13': ['Marsella', 'Marseille'], 'FR-14': ['Caen'], 'FR-15': ['Aurillac'], 'FR-16': ['Angulema', 'Angoulême'],
      'FR-17': ['La Rochelle', 'La Rochela'], 'FR-18': ['Bourges'], 'FR-19': ['Tulle'], 'FR-21': ['Dijon'], 'FR-22': ['Saint-Brieuc'], 'FR-23': ['Guéret'],
      'FR-24': ['Périgueux'], 'FR-25': ['Besançon', 'Besanzón'], 'FR-26': ['Valence'], 'FR-27': ['Évreux'], 'FR-28': ['Chartres'], 'FR-29': ['Quimper'],
      'FR-2A': ['Ajaccio', 'Ayacio'], 'FR-2B': ['Bastia'], 'FR-30': ['Nimes', 'Nîmes'], 'FR-31': ['Toulouse', 'Tolosa'], 'FR-32': ['Auch'],
      'FR-33': ['Burdeos', 'Bordeaux'], 'FR-34': ['Montpellier'], 'FR-35': ['Rennes'], 'FR-36': ['Châteauroux'], 'FR-37': ['Tours'], 'FR-38': ['Grenoble'],
      'FR-39': ['Lons-le-Saunier'], 'FR-40': ['Mont-de-Marsan'], 'FR-41': ['Blois'], 'FR-42': ['Saint-Étienne'], 'FR-43': ['Le Puy-en-Velay', 'Le Puy'],
      'FR-44': ['Nantes'], 'FR-45': ['Orleans', 'Orléans'], 'FR-46': ['Cahors'], 'FR-47': ['Agen'], 'FR-48': ['Mende'], 'FR-49': ['Angers'], 'FR-50': ['Saint-Lô'],
      'FR-51': ['Châlons-en-Champagne', 'Châlons', 'Châlons-sur-Marne'], 'FR-52': ['Chaumont'], 'FR-53': ['Laval'], 'FR-54': ['Nancy'], 'FR-55': ['Bar-le-Duc'],
      'FR-56': ['Vannes'], 'FR-57': ['Metz'], 'FR-58': ['Nevers'], 'FR-59': ['Lille', 'Lila'], 'FR-60': ['Beauvais'], 'FR-61': ['Alençon'], 'FR-62': ['Arras', 'Arrás'],
      'FR-63': ['Clermont-Ferrand', 'Clermont'], 'FR-64': ['Pau'], 'FR-65': ['Tarbes'], 'FR-66': ['Perpiñán', 'Perpignan'], 'FR-67': ['Estrasburgo', 'Strasbourg'],
      'FR-68': ['Colmar'], 'FR-69': ['Lyon', 'Lion'], 'FR-70': ['Vesoul'], 'FR-71': ['Mâcon'], 'FR-72': ['Le Mans'], 'FR-73': ['Chambéry'], 'FR-74': ['Annecy'],
      'FR-75': ['París', 'Paris'], 'FR-76': ['Ruan', 'Rouen'], 'FR-77': ['Melun'], 'FR-78': ['Versalles', 'Versailles'], 'FR-79': ['Niort'], 'FR-80': ['Amiens'],
      'FR-81': ['Albi'], 'FR-82': ['Montauban'], 'FR-83': ['Tolón', 'Toulon'], 'FR-84': ['Aviñón', 'Avignon'], 'FR-85': ['La Roche-sur-Yon'], 'FR-86': ['Poitiers'],
      'FR-87': ['Limoges'], 'FR-88': ['Épinal'], 'FR-89': ['Auxerre'], 'FR-90': ['Belfort'], 'FR-91': ['Évry-Courcouronnes', 'Évry'], 'FR-92': ['Nanterre'],
      'FR-93': ['Bobigny'], 'FR-94': ['Créteil'], 'FR-95': ['Pontoise', 'Cergy', 'Cergy-Pontoise'],
    },
  },
};

/**
 * Countries left without capitals of regions: Nepal's zones were abolished in 2015 and their seats are
 * unreliable, and each of the seven emirates is called after its capital, so there is nothing to ask.
 */
export const REGION_CAPITALS_SKIP = new Set(['NP', 'AE']);

/**
 * Capitals of regions put right by hand, `{ country: { level: { unit: names } } }`; the first name is the
 * one shown, the rest are accepted too, and `null` takes a capital out.
 *
 * Natural Earth marks "capital of a first-order division" on cities that are not one (a former seat, the
 * biggest town, a neighbour across the river), and leaves a few true ones unmarked. Every capital was
 * compared with the seats GeoNames records (`npm run data:check`), and each difference settled one by one:
 * these are the ones where Natural Earth was wrong. Where two cities share the role (Lubusz, Cuyavia and
 * Pomerania), either is accepted.
 */
export const REGION_CAPITAL_FIXES = {
  AF: { f: { 'AF-BGL': ['Pul-e Khumri', 'Puli Khumri', 'Pol-e Khomri'], 'AF-LOG': ['Pul-e Alam', 'Puli Alam', 'Pol-e Alam'], 'AF-PIA': ['Sharana', 'Sharan', 'Zareh Sharan'] } },
  AO: { f: { 'AO-LNO': ['Dundo'] } },
  AR: { f: { 'AR-R': ['Viedma'] } },
  BD: { f: { 'BD-C': ['Daca', 'Dacca', 'Dhaka'] } },
  BI: { f: { 'BI-MW': ['Mwaro'], 'BI-GI': ['Gitega', 'Guitega'] } },
  BZ: { f: { 'BZ-CY': ['San Ignacio'] } },
  CI: { f: { 'CI-07': ['Yamusukro', 'Yamoussoukro'] } },
  CU: { f: { 'CU-12': ['Bayamo'] } },
  CY: { f: { 'CY-01': ['Nicosia', 'Lefkosia'] } },
  EG: { f: { 'EG-DK': ['El Mansurá', 'Mansura', 'Mansoura', 'Al Mansurah'] } },
  GT: { f: { 'GT-PR': ['Guastatoya'] } },
  GW: { f: { 'GW-QU': ['Buba'] } },
  IQ: { f: { 'IQ-SD': ['Tikrit'], 'IQ-MA': ['Amara', 'Al Amarah', 'Amarah'] } },
  JM: { f: { 'JM-03': ['Morant Bay'] } },
  JP: { f: { 'JP-35': ['Yamaguchi'] } },
  KH: { f: { 'KH-16': ['Banlung', 'Ban Lung'], 'KH-5': ['Chbar Mon', 'Kampong Speu', 'Kompung Speu'] } },
  KP: { f: { 'KP-02': ['Pyongsong', "P'yŏngsŏng"], 'KP-06': ['Sariwon', 'Sariwŏn'] } },
  KZ: { f: { 'KZ-YUZ': ['Turkestán', 'Turkistan', 'Turkestan'] } },
  LK: { g1: { 'LK-1': ['Colombo'], 'LK-6': ['Kurunegala'] } },
  LR: { f: { 'LR-BM': ['Tubmanburg'] } },
  LS: { f: { 'LS-B': ['Butha-Buthe'], 'LS-C': ['Hlotse', 'Leribe'] } },
  MA: { f: { 'MA-03': ['Alhucemas', 'Al Hoceima', 'Al-Hoceima'] } },
  MR: { f: { 'MR-11': ['Zuérate', 'Zouérat', 'Zouerate', 'Zouérate'] } },
  MY: { f: { 'MY-10': ['Shah Alam'] } },
  MZ: { f: { 'MZ-I': ['Inhambane'] } },
  NG: { f: { 'NG-DE': ['Asaba'] } },
  NL: { f: { 'NL-FL': ['Lelystad'], 'NL-ZH': ['La Haya', 'The Hague', 'Den Haag'] } },
  NO: { f: { 'NO-01': ['Sarpsborg'], 'NO-02': ['Oslo'] } },
  PE: { f: { 'PE-LIM': ['Huacho'] } },
  PG: { f: { 'PG-EBR': ['Kokopo'], 'PG-NSB': ['Buka'] } },
  PL: { f: { 'PL-LB': ['Zielona Góra', 'Gorzów Wielkopolski', 'Gorzów'], 'PL-KP': ['Bydgoszcz', 'Toruń'] } },
  PY: { f: { 'PY-11': ['Areguá'], 'PY-15': ['Villa Hayes'], 'PY-19': ['Filadelfia'] } },
  RU: { f: { 'RU-IN': ['Magás', 'Magas'], 'RU-KK': ['Abakán', 'Abakan'] } },
  SD: { f: { 'SD-KH': ['Jartum', 'Khartoum'], 'SD-NW': ['Rabak'] } },
  SN: { f: { 'SN-MT': ['Matam'] } },
  SO: { f: { 'SO-SOL': ['Hargeisa', 'Hargeysa'] } },
  SS: { f: { 'SS-EC': ['Yuba', 'Juba'], 'SS-EE': ['Torit'] } },
  SZ: { f: { 'SZ-HH': ['Mbabane'], 'SZ-SH': ['Nhlangano'] } },
  TG: { f: { 'TG-K': ['Kara', 'Lama-Kara'], 'TG-P': ['Atakpamé', 'Atakpame'] } },
  // Ashgabat is not the seat of the region around it, and which town is has changed of late.
  TM: { f: { 'TM-A': null } },
  UY: { f: { 'UY-MA': ['Maldonado'] } },
  VE: { f: { 'VE-A': ['Caracas'], 'VE-M': ['Los Teques'] } },
  VN: {
    f: {
      'VN-25': ['Đông Hà', 'Dong Ha'], 'VN-43': ['Bà Rịa', 'Ba Ria'], 'VN-71': ['Điện Biên Phủ', 'Dien Bien Phu'], 'VN-73': ['Vị Thanh', 'Vi Thanh'],
      'VN-CT': ['Cần Thơ', 'Can Tho'],
    },
  },
  ZA: { f: { 'ZA-GT': ['Johannesburgo', 'Johannesburg'], 'ZA-NW': ['Mahikeng', 'Mafikeng', 'Mmabatho'] } },
  ZM: { f: { 'ZM-07': ['Choma'] } },
};

/**
 * What the capital of a region is called in English, by country and by the name the table shows, where the
 * English label of its city does not say it: the city is not among those of Natural Earth, or its label is
 * not the name English uses. An empty string leaves it with the name shown.
 */
export const REGION_CAPITAL_EN = {
  // Where Spanish is spoken, only what English calls otherwise.
  ES: { Sevilla: 'Seville', 'La Coruña': 'A Coruña', Orense: 'Ourense', Gerona: 'Girona', Lérida: 'Lleida', Vitoria: 'Vitoria-Gasteiz' },
  CU: { 'La Habana': 'Havana' },
  MX: { 'Ciudad de México': 'Mexico City' },
  GT: { 'Ciudad de Guatemala': 'Guatemala City' },
  PA: { 'Ciudad de Panamá': 'Panama City' },
  // Cities that Natural Earth does not have.
  FR: { Carcasona: 'Carcassonne', Angulema: 'Angoulême', Aviñón: 'Avignon' },
  MA: { Alhucemas: 'Al Hoceima' },
  RU: { Magás: 'Magas' },
  // Labels that are not the name English uses: an accent or an apostrophe of difference, the kind of place
  // added to the name, the name of the governorate.
  BR: { Vitória: '' },
  ID: { Yogyakarta: '' },
  IT: { "L'Aquila": '' },
  MY: { Malaca: 'Malacca' },
  SA: { Sakaka: 'Sakakah' },
  SD: { 'El Obeid': '', 'El Fasher': '', Gadarif: '' },
  UA: { Odesa: '' },
};

/** Spanish names of cities that Natural Earth gets wrong or gives in an unusual form, by its own `NAME`. */
export const CITY_NAMES = { Castello: 'Castellón de la Plana', 'Las Palmas': 'Las Palmas de Gran Canaria', Guaira: 'Salto del Guairá' };

/**
 * Labels of cities that Natural Earth has wrong, as "NAME|ADM0_A3" → what stands for its NAME_ES (`es`)
 * and its NAME_EN (`en`); `al` adds names that are accepted too. The label that is replaced is dropped:
 * it does not stay as another name of the city, because it is not one.
 *
 * Found by listing the cities whose Spanish label, English label and own name do not resemble each
 * other, and reading the list: most are the names a city has in Spanish (Amberes, Ratisbona) or a
 * new name (Mumbai), and these are the rest.
 */
export const CITY_FIX = {
  // The label of something else: another town, the province, a football club, the country.
  'Puerto Plata|DOM': { es: 'Puerto Plata' }, // «El higo luperon»
  'Coquimbo|CHL': { en: 'Coquimbo' }, // «Atlético Morelia»
  'Vallenar|CHL': { en: 'Vallenar' }, // «Trehuaco»
  'Tampico|MEX': { en: 'Tampico' }, // «Ciudad Madero Tamaulipas»
  'Mazatlán|MEX': { en: 'Mazatlán' }, // «Juarez»
  'Colón|PAN': { es: 'Colón', en: 'Colón' }, // «Bucaramanga», which is in Colombia
  'Hail|SAU': { en: "Ha'il" }, // «Saudi Arabia»
  'El Mansura|EGY': { en: 'Mansoura' }, // «sharkia», the governorate next door
  'Al Amarah|IRQ': { en: 'Amarah' }, // «Thi Qar», another governorate
  'Bafang|CMR': { en: 'Bafang' }, // «Baham»
  'Mbanza-Ngungu|COD': { en: 'Mbanza-Ngungu' }, // «Nkamba»
  'Sotik|KEN': { en: 'Sotik' }, // «Chamagel»
  'Dongola|SDN': { en: 'Dongola' }, // «Karma»
  'Quissico|MOZ': { en: 'Quissico' }, // «Zavala», its district
  'Caibarién|CUB': { es: 'Caibarién' }, // «Placetas», a second one
  'Kampong Spoe|KHM': { en: 'Chbar Mon', al: ['Kampong Speu'] }, // «Kam»
  'Phnum Tbeng Meanchey|KHM': { es: 'Tbeng Meanchey' }, // «Preah Wijía», its province
  'El Cayo|BLZ': { es: 'San Ignacio' }, // «Cayo», its district; El Cayo is what the town was called
  'Jinxi|CHN': { es: 'Huludao', en: 'Huludao', al: ['Lianshan'] }, // «Lianshan», one of its districts
  'El Porvenir|PAN': { es: 'El Porvenir', al: ['Gaigirgordub'] }, // its name in Guna
  // The kind of place for the place: «Condado de Kilju», «Distrito de Sambava», «Ciudad Davao».
  'Kilchu|PRK': { es: 'Kilju', en: 'Kilju' },
  'Musan|PRK': { en: 'Musan' },
  'Sambava|MDG': { es: 'Sambava' },
  'Karibib|NAM': { es: 'Karibib' },
  'Masindi-Port|UGA': { es: 'Masindi Port' },
  'Buzmeyin|TKM': { en: 'Abadan' },
  'Thongwa|MMR': { en: 'Thongwa' },
  'El Kharga|EGY': { en: 'Kharga' },
  'Battambang|KHM': { es: 'Battambang' },
  'Kampot|KHM': { es: 'Kompot' },
  'Jeju|KOR': { es: 'Jeju' },
  'Altai|MNG': { es: 'Altai' },
  'Yilan|TWN': { es: 'Yilan' },
  'Roxas|PHL': { es: 'Roxas' },
  'Davao|PHL': { es: 'Davao' },
  'Cebu|PHL': { es: 'Cebú' },
  'Zamboanga|PHL': { es: 'Zamboanga' },
  'Batangas|PHL': { es: 'Batangas' },
  'Iloilo|PHL': { es: 'Iloílo' },
  'Cotabato|PHL': { es: 'Cotabato' },
  'Tarlac|PHL': { es: 'Tarlac' },
  'Surigao|PHL': { es: 'Surigao' },
  // A spelling: the one the region of the same name has in the game, or the one the name has.
  'Balykchy|KGZ': { es: 'Balykchy' }, // «Balikci»
  'Umm al Qaywayn|ARE': { es: 'Umm al-Qaywayn', al: ['Um el Kaiwain'] },
  'Ras al Khaymah|ARE': { es: 'Ras al-Jaima' },
  // The same for the cities whose region is the one that had it right (see UNIT_NAME in config.mjs for the
  // regions that follow their city): the label that goes stays as a name that is accepted.
  'Saki|AZE': { es: 'Shaki', al: ['Şəki'] },
  'Messina|ITA': { es: 'Mesina' },
  'Reggio di Calabria|ITA': { es: 'Reggio Calabria', al: ['Regio de Calabria'] },
  'Sassari|ITA': { es: 'Sassari', al: ['Sácer'] },
  'At Tafilah|JOR': { es: 'Tafila', al: ['Tafilah'] },
  'Al Jahra|KWT': { es: 'Al Yahra', al: ['Jahra', 'Yahra'] },
  'Almaty|KAZ': { es: 'Almaty', al: ['Alma Ata', 'Alma Atá'] },
  'Nabatiye et Tahta|LBN': { es: 'Nabatiye', al: ['Nabatieh'] },
  'Bago|MMR': { es: 'Bago', al: ['Pegu', 'Pegú'] },
  'Suchboatar|MNG': { es: 'Sühbaatar', al: ['Sujbaatar'] },
  'Bragança|PRT': { es: 'Braganza' },
  'As Suwayda|SYR': { es: 'Sueida', al: ['As-Suwayda'] },
  'Qairouan|TUN': { es: 'Kairuán', al: ['Cairuán'] },
  'Dar es Salaam|TZA': { es: 'Dar es Salam', al: ['Dar es-Salaam'] },
  'Kibale|UGA': { es: 'Kibaale' },
  'Andijan|UZB': { es: 'Andiyán', al: ['Andiján'] },
  'Al Bayda|YEM': { es: 'Al Bayda', al: ['Al Baida'] },
  'Lahij|YEM': { es: 'Lahij', al: ['Lahej'] },
  'Marib|YEM': { es: 'Marib' },
  'Lamphun|THA': { es: 'Lamphun', al: ['Muang Lamphun'] },
  'Cusco|PER': { es: 'Cusco', en: 'Cusco', al: ['Cuzco'] },
  'Harar|ETH': { es: 'Harar', en: 'Harar', al: ['Harrar Jugol', 'Harar Jugol'] },
};

/**
 * Regions that are not spelt like the city of the same name, and are right: `data:physical` warns of every
 * other region and city of one country that share a name in English, or in the language of the place, and
 * not in Spanish.
 */
export const SPELT_APART = new Set([
  'LV-x1066', // «Rezeknes», the municipality around Rēzekne, which is a piece of its own («Rezekne»)
  'IT-TN', // «Trentino», the province of Trento
  'RU-ZAB', // «Zabaikalie»: the source still calls it Chita, after the oblast it was made from
]);

/**
 * Places left out, as "NAME|ADM1NAME": entries of Natural Earth that are plainly wrong. Nearly all are a
 * hamlet, or nothing at all, carrying the population of a well-known namesake (the Natal of Rio Grande
 * do Norte in the middle of the Amazon, the Iranian Arak in the Algerian Sahara), which put them among
 * the largest cities of their country.
 */
export const CITY_DROP = new Set([
  'Mazatlán|Sonora', 'Natal|Amazonas', 'Vila Velha|Amapi', 'Crato|Amazonas', 'Arak|Tamanghasset', 'Al Hillah|Ar Riyad', 'Santa Ana|El Beni',
  'Noginsk|Evenk', 'Nakhodka|Yamal-Nenets',
]);

/**
 * Towns on a border that Natural Earth files under the neighbour, as "NAME|ADM0_A3" → the country they
 * are in. Found by looking each city up in GeoNames; left alone, Saint-Louis was a city of Mauritania and
 * the capital of one of its regions.
 */
export const CITY_COUNTRY = {
  'Saint-Louis|MRT': 'SN', 'Kaédi|SEN': 'MR', 'Ebebiyín|GAB': 'GQ', 'Kapan|AZE': 'AM', "Qacha's Nek|ZAF": 'LS', 'Mandera|SOM': 'KE',
  'Luangwa|MOZ': 'ZM', 'Yacuíba|ARG': 'BO', 'Guaira|BRA': 'PY',
};
