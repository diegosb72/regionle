// The photographs of the sheets of the countries, as the branch `datos` keeps them.
//
// The workflow "Traer datos" brings them from Wikimedia Commons (scripts/data/outside.mjs, source `photos`):
// what Commons says of each (photos/photos.json) and the picture of it that Wikimedia draws, 1920 px wide.
// Each is named here with the Git name of what it holds, so that `npm run data:fetch` takes exactly these
// and what is built from them is the same wherever it is built. Only the ones a sheet shows are listed: the
// branch keeps others, which were brought to choose among.
//
// Wikimedia draws a picture again now and then, and not always to the same bytes. One that it has drawn
// again since it was brought here says, after its Git name, the commit of the branch where it is as it was
// brought: the game keeps showing it as it did.
//
// When a sheet names another photograph: add it to scripts/data/pedido.txt (source `photos`), push, and once
// the workflow has run write here the commit it left and the names `git ls-tree -r <commit> photos/` gives.
//
// Used by fetch.mjs (which downloads them into .cache/src/photos) and by profiles.mjs (which makes the
// pictures the game shows).

/** The commit of the branch `datos` that the photographs are taken from. */
export const PHOTOS_AT = { repo: 'diegosb72/regionle', commit: 'c8444f667e417641f2f6a93d109ac1d0c75cb65a', dir: '' };

/** What Commons says of every photograph that was asked for. */
export const PHOTOS_SAID = ['photos/photos.json', '0c0b2654ce8f564f5402fe4b0582e8251ad13cc2'];

/** The pictures, each under the SHA-1 of its original: [where it is in the branch, the Git name of what it holds, the commit it is at where that is another]. */
export const PHOTOS = [
  // Brazil
  ['photos/files/3fb858c9b7ebc692ddfca4d93d0eff3e067adb0e.1920.jpg', '2767ccdb2d3e728f307ee30ab9528d5125496a8f'], // Rio de Janeiro skyline and Sugarloaf Mountain at sunset, Brazil 3.jpg
  ['photos/files/e88d03cfad1272ccb1ce412d575026d92b1e60cf.1920.jpg', '40bd57c5d0cb3102722f4ab11a7d7dc6d478aa65'], // Cataratas do Iguaçu - Vista de cima alt.jpg
  ['photos/files/df9f5a916ad881477729bab9429752021fc159c1.1920.jpg', 'a6114a1f0767a456e85e0ac27a30b8e9e863d77d'], // Aurora amazônica no Lago do Cuniã.jpg
  ['photos/files/6c69a66ec7c2d751bcc1fce5a35652951cc7e381.1920.jpg', '34ebef15117a82a27448c203fd38e091c0633a9f'], // Lençóis Maranhenses 2018.jpg
  ['photos/files/bcb8323aceec610554f337e4855b6361aedb6a5a.1920.jpg', '56cd2659697337aaec2d8e56f06e9be710ab93a9'], // Brazilian National Congress.jpg
  ['photos/files/786408c8e6ab4f8caec60252ff61885cf5f4f517.1920.jpg', '40a5914dbd75fdb262ff3b2a3771694a1953395f', 'ac8c7de5872541fa23c0d28e9f3cf63cfe231d53'], // Largo do Pelourinho Salvador 2019-9754 (cropped).jpg
  ['photos/files/c99a798303d51d25fcf753c12d60a2b0d6acaa95.1920.jpg', '17ef523d3281a986dfb902d5729717a78537ef36'], // Ponte estaiada Octavio Frias - Sao Paulo.jpg
  ['photos/files/c642015fde6a5821353b0bd7f1391ce70fcd4893.1920.jpg', '5477d8d5dad83f81a44686da73d93e25d5875c6a'], // 011 Jaguar drinking in Encontro das Águas State Park Photo by Giles Laurent.jpg
  ['photos/files/1d59587d31c376719c3767bfbbab1b93e3a635bd.1920.jpg', '7f18d924513cc42d63f3c73c986fdd496497a1d1'], // Pedro Américo - Independência ou Morte - Google Art Project.jpg
  ['photos/files/bc6dac877532ca052e259488de9cceb59865ba0d.1920.jpg', '0822beb8fa38e898544b5f1d512f4d06341e1425'], // Proclamação da República by Benedito Calixto 1893.jpg

  // The one chosen for the head of the sheet of each country nobody has written of (scripts/data/profiles-heads.json)
  ['photos/files/692fd0f034ca1e1755b8c657ca1b13aa762948c0.1920.jpg', '45a7841d966750dbe3ef5d04521f49c50a33a4d5'], // AD · Vista de Andorra la Vieja, Andorra, 2013-12-30, DD 01.JPG
  ['photos/files/3eba322096a76f800440af790de29403903b5f7e.1920.jpg', 'd36af4f968b5306ac6455de6cc74e0c36fa06a0a'], // AF · Lake in Band-e Amir National Park, March 2008.jpg
  ['photos/files/061b8864dfc060bdfc084f308b3c5eaeb58b805b.1920.jpg', 'ef5f8178a1f2b61e962668064eb9178d25d2b349'], // AL · The old city of Berat.jpg
  ['photos/files/d8b1a0236f8d2f9132fb25d17ce8e5f43fc786de.1920.jpg', '0e588878bb5f8b215328575872d40adf14e6a5d2'], // AO · Quedas-Kalandula 07 queda LWS-2011-08 QD18 (cropped).jpg
  ['photos/files/a7284c67c3f9f0e1a98abaa365965b267e5b9c18.1920.jpg', '3bd61954c9ecb3617f9ab458704170cc02ab513a'], // AR · Perito Moreno Glacier Patagonia Argentina Luca Galuzzi 2005.JPG
  ['photos/files/4b89654ddcbc74c0b5dc3718b4d6d916ce790d8e.1920.jpg', 'f1f2914fac5085d3bb3fafccb2abf7c9fcb4fe77'], // AT · Hallstatt - Nordansicht.JPG
  ['photos/files/b429f8e3c970e9e5b2a55dcda42db5aec705d15b.1920.jpg', '303249c55baf03b37188d8685885440dac5f9eea'], // BA · Mostar Old Town Panorama 2007.jpg
  ['photos/files/1b680881286ba48b847770e6fef743ff70f35818.1920.jpg', '4172abd184631a9786b3e33399d6eb07031df136'], // BD · পাহাড়পুর বৌদ্ধ বিহার 22.jpg
  ['photos/files/ab8ec3a93db66ad9f700791ec6e121101d6eaaad.1920.jpg', '65fdcc7e7a27fd2f2e34e3665d7925808a304fc6'], // BE · Edificios en la Grand-Place, Bruselas, Bélgica, 2021-12-15, DD 184-186 HDR.jpg
  ['photos/files/a8999f403289dcb471c4cc7fc68d50ed352e56f7.1920.jpg', '92a619c1ed7f18ba0d4c59c260aa4d6024cdfdd3'], // BG · AlexanderNevskyCathedral-Sofia-6.jpg
  ['photos/files/86ca43d6d1902a0ab675a83f7fb1a74358b351e8.1920.jpg', 'a775e163f1d5cfade8cf0f65b0cf2bbfba7257bb'], // BO · Isla del Pescado, Salar de Uyuni, Bolivia, 2016-02-04, DD 42.JPG
  ['photos/files/57a5da2d17dc08251710323f74f3aa8795d16113.1920.jpg', '006490b74da5645580054d6a2c2199fe63bb8813'], // BY · Комплекс Мирского замка.JPG
  ['photos/files/c7770f79918ad094a6cd442e74281834dd5bd3e2.1920.jpg', '8f8ac0bedc1fc9c27de18878aa490e83622df97e'], // CA · Peyto Lake-Banff NP-Canada.jpg
  ['photos/files/3ea16f13e34a88661c320c3e94eae0de7915108e.1920.jpg', 'b9d07792c401d8cb29e5070457857938e7f06ea8'], // CD · Virunga 01.jpg
  ['photos/files/c5c1e1c85f7083ffae2ac419126c2e960fe7314f.1920.jpg', 'a4ec0b41294bb7e34b756a19f8278c2ec8ed3b56'], // CH · CH.VS.Zermatt Sunnegga Grindjisee Matterhorn 9034 16x9-R 16K.jpg
  ['photos/files/c578a856908af77b287cb053aed617ca82ce6fa1.1920.jpg', '3e2c1495d32fd09e72674b202e70298517fdbf13'], // CL · Torres del Paine, Laguna Azul 09.jpg
  ['photos/files/2349f782792284013cdaf70bc6b065bf7fc11f92.1920.jpg', '365c7c940e85c402756252370936202ab5df6a65'], // CN · Badaling China Great-Wall-of-China-01.jpg
  ['photos/files/8d63f453b6392bd3d1f71716165ff59bab6d1de3.1920.jpg', '99ba4f2f94636d7cb805127c77b1cca44f2cdf72'], // CO · Valle de Cocora, Colombia 02.jpg
  ['photos/files/a7779333e4e921ebbe699e26061a2cf75173e94f.1920.jpg', '321fa3882ea5408ed5bb504a1bd65e60570f7724'], // CR · Arenal Volcano 02.jpg
  ['photos/files/dc76f039848179173b70d21a79f5ab63e766096e.1920.jpg', 'ac73cc75c26cd28ec345e975c78e9ca202f885d4'], // CU · Viñales Valley.jpg
  ['photos/files/3919d4990ce83d06a30f03ae16717bd84dc559f1.1920.jpg', '5f345734f9f965587d528c7fc42d7363672d7798'], // CY · Roca de Afrodita, Chipre, 2021-12-10, DD 65.jpg
  ['photos/files/8c1492ac61ca4ec60dbdff4a6c7e96442e5ea63d.1920.jpg', 'bcb1bf5c73df7a0d0ee6ba03a66d01ce6d660c7a'], // CZ · Vltava river in Prague.jpg
  ['photos/files/5c8b94222c6c2508c38a5f2524140019da47c690.1920.jpg', 'ba7aa334c968df8c02b37e593fa5b69f8980f2a0'], // DE · Brandenburger Tor nachts 2012-07.jpg
  ['photos/files/ff625fccfb6d812ac48bf0e9da90cc16a9cae70c.1920.jpg', 'c4b729a55415b2a7d191d2d378acd26cee3737f0'], // DK · Nyhavn, Copenhagen, 20220618 1728 7354.jpg
  ['photos/files/5035feb746ad529794ae3d2dd566b1bb60edef59.1920.jpg', '17aa199779ed51db721f74e914cc7c510b388a6a'], // DO · Isla Saona III.jpg
  ['photos/files/cd5706dc2d888de61f5e8e49bf29bcef04a45248.1920.jpg', 'fc2edc1260060743d7f4840a9777eabed38ad21f'], // DZ · Tassili Desert Algeria.jpg
  ['photos/files/429eb8f84da4088410337d2175a7ea2c72816832.1920.jpg', '6e355bcc32bc91ced2c423648c22e69d377fec92'], // EC · Volcán Chimborazo desde Riobamba.jpg
  ['photos/files/d3fff2035bed27216b10b19772f740c7242f4157.1920.jpg', '6e935a462c686be2718f947a0bf44c3037326f79'], // EE · Old Town of Tallinn, Tallinn, Estonia - panoramio (58).jpg
  ['photos/files/feb78b162f18e5562e6d15f045f21912f0874911.1920.jpg', '2da2e605b1456412de00a930b8a5d1ac0ec38aa0'], // EG · All Gizah Pyramids.jpg
  ['photos/files/b3a6fdd089118447cf90625314d455c41d50f75b.1920.jpg', 'd278b9246b10fa6fa411d809a9afb75111f020cc'], // ES · Granada - View from Mirador de San Nicolás - 02.jpg
  ['photos/files/49ef64940f95504dc097e670f76324e732508355.1920.jpg', 'a2815a3fbba89e18665a74483b48bacea50e1619'], // ET · Lalibela, san giorgio, esterno 07.jpg
  ['photos/files/fab3a99ee02bd8e71818213a262bec51bb81d799.1920.jpg', '6bb542ae3434c5085d737f9d2876f413dc9efca6'], // FI · Koli 14052011 01.JPG
  ['photos/files/faa27bf8b9d97ac97a8e38d516d8913652d6586d.1920.jpg', '247cae12f0ff22e95f693d2f4c0ecf413056c4cb'], // FR · Mont Saint Michel and sheep - 2026.jpg
  ['photos/files/25a4edbec6ebd332d79f2d30c6977a1d4ea5f5cd.1920.jpg', '356b008a189acea77ad1dd98d5edd3213a3e3d32'], // GB · London Skyline (125508655).jpeg
  ['photos/files/cc16f10e3a99bc442ee27b7db91e90513145e77e.1920.jpg', '14fda1b5dc77f4f3e47a094873bcd7a7de959f6d'], // GH · Castle, Elmina (P1100198).jpg
  ['photos/files/276177a155e86a31898398df9dccf8a5c544cccc.1920.jpg', '165882bb59d40833aa58c990e85d5832112cdf05'], // GQ · Pico Basilé.jpg
  ['photos/files/457dedd84a9d5fc68e83f4261f29d2fb8ee8fb33.1920.jpg', '1f10c9484f2cca07f1ab12eea686978f7b8f92c9'], // GR · Attica 06-13 Athens 50 View from Philopappos - Acropolis Hill.jpg
  ['photos/files/5a3ad88a502bf10c398c2fe55dca54c9f9f7badb.1920.jpg', 'd035cad35d444628ef0e99cf22a2b5f96107555c'], // GT · Semuc Champey natural wonder.jpg
  ['photos/files/653daacd173fcda8e63488b502f2131d167bf7cf.1920.jpg', '411256fb8ce554efe625d73f914ee55cce2fe437'], // HN · West Bay Beach -Roatan -Honduras-23May2009-b.jpg
  ['photos/files/2be91e7999bed25d9e057e9e93ed5e8afc7bfc5a.1920.jpg', 'a90858b4fa5308394e120c611dd683c47a585249'], // HR · Dubrovnik as seen from Srđ - September 2017.jpg
  ['photos/files/5640628b7f288c644bb9ab7a42ffcd6b5e5ed65f.1920.jpg', '779ec22950a74ea4bfc59f70b158b4978d7fdbf8'], // HU · HUN-2015-Budapest-Hungarian Parliament (Budapest) 2015-02.jpg
  ['photos/files/ea098cd915c3349f75acc2026ed59125e2c0ab3b.1920.jpg', '7aa99cfef6e9bb7b1c875390c1382d073f8903e2'], // ID · Prambanan Complex 1.jpg
  ['photos/files/7a7b2a1cfcf3ae50f20a90bb2bcb9323488093cb.1920.jpg', '7be4e3d9992039470af054b47e7622d6867d18fb'], // IE · Ireland Cliffs of Moher BW 2025-09-11 13-47-21.jpg
  ['photos/files/46dd616163d1ed0802a43898af08993c5deec820.1920.jpg', 'e671b67155d02a94a948c38502925306e667e76f', 'ac8c7de5872541fa23c0d28e9f3cf63cfe231d53'], // IN · Taj Mahal, Agra, India edit3.jpg
  ['photos/files/c6eb409de56efce99ef2846338e04e3b0b16b0aa.1920.jpg', '9d8015b9efa024f045c4d895f359ec11273f02ba'], // IQ · Hawler Castle.jpg
  ['photos/files/75c37c7f0c52beabcbfe89fe91afc5572f48ea61.1920.jpg', 'e6cdaeebf0dfad0c8c36b4484419957f3451d651'], // IR · Persépolis, Irán, 2016-09-24, DD 56.jpg
  ['photos/files/932d251ae34449d76f1ab0569a45e7e520836c41.1920.jpg', '07dfd88c4368707e72bc98288d648881448caeff'], // IS · Skógafoss Waterfall, Iceland, 20240720 1318 2975.jpg
  ['photos/files/1768f9a0807087ca9f15c914e8d556c19313431a.1920.jpg', '387a04c0d47ab70c7ec474ee2a1ac5903f879e90'], // IT · Colosseum in Rome-April 2007-1- copie 2B.jpg
  ['photos/files/bb63dc093b31d3cad896b3b11f58a87a6da11d4e.1920.jpg', '1bed5b84eab86403900764601aa35b875a1d5ca8'], // JP · Kodaki fuji frm shojinko refurb.jpg
  ['photos/files/27519c27fdb9c0c226e3b7949f6124fc099bd468.1920.jpg', 'dee2ffa7d1689609bd57a052435383885412df6e'], // KE · Three giraffes 01.jpg
  ['photos/files/98cc20148c3fb31c8daf8f11e70e49df8196e36f.1920.jpg', '4590dea5a902f8adde7f0432cf8640e00bea193f'], // KR · 덕수궁의 가을.jpg
  ['photos/files/2e7f70b920f52c5e7e5bb0fa76a0b1fc22e8ab53.1920.jpg', '777407ae8d968d575ccab57fbc25c4738df47529'], // LI · Château de Vaduz - 2022.jpg
  ['photos/files/49042097bc19b657934180a82131a48a5d554346.1920.jpg', 'b8fca1bfffc59b8e3b8afba8f6815ca2bcf10fac'], // LT · Trakai Island 11.jpg
  ['photos/files/74ac6e702dc71424e9bbac5ccd07a112a2ec723f.1920.jpg', '28f9f5874c56443dba50ef8a093fa270d44cac69'], // LU · Abadía Neumünster, ciudad de Luxemburgo, Luxemburgo, 2023-12-17, DD 22-24 HDR.jpg
  ['photos/files/1e3128a36aabaa95021d4a0f0d0e466293981849.1920.jpg', 'e93e85f5e80b1c2e63cbbf35bae8ec9f0e88c1b0'], // LV · Riga (33844464828).jpg
  ['photos/files/cf8a51afde2d59d430ab42dfcbe43d249528f278.1920.jpg', 'e149517cc8c4fbbec39914b49ab9014454454f45'], // MA · Ksar Aït Benhaddou, Marocco (أيت بن حدو، المغرب, ⴰⵢⵜ ⵃⴰⴷⴷⵓ).jpg
  ['photos/files/1bdab673b49d7b9468c5b6013c25047f092a4fce.1920.jpg', '3392fd224a808fa073ce8bdc65352a07fe838eaf'], // MC · Panorama von Monaco-La Turbie.jpg
  ['photos/files/36c557a5fc575197a101e63811a8e92611302327.1920.jpg', 'b5e125c21dac6f6c6c43760a5a28c067d4d3a395'], // MD · Monasterio Orheiul Vechi, Orhei, Moldavia, 2023-11-02, DD 06.jpg
  ['photos/files/2ef66d820f90d68dcf17bb767bdadead5d568f07.1920.jpg', '07268d791497375292cfeb73c82a06db6eec620a'], // ME · 20090719 Crkva Gospa od Zdravlja Kotor Bay Montenegro.jpg
  ['photos/files/c210e0d53a7e8029c74dec48e35f27f1908eda12.1920.jpg', 'a5ca5c5aa6bb3d8d99495f17733f42c60586f5cb'], // MK · Church of St. John at Kaneo 6.jpg
  ['photos/files/51fb9b0b3119cde1bc0f719e2be3a19ca6308539.1920.jpg', 'f092e0004abbfa5094e0898a41d67ef9e66b0606'], // MM · Bagan, Myanmar, Htilominlo Temple and other Buddhist stupas in Bagan plain.jpg
  ['photos/files/7f564eb3a400de32c87affea76c75edd14ff32e3.1920.jpg', 'cf378665e1a44f5b420090447a8518591f4b3fc0'], // MT · Our Lady of Mount Carmel and St Pauls Pro-Cathedral.jpg
  ['photos/files/089323019df7169ee09aa9eadaba6888939fd564.1920.jpg', '4d3e728c2b962b12a6cc3354ea501e5e0ecb11fc'], // MX · Chichen Itza 3.jpg
  ['photos/files/2e235a96ef131fa78d63d20c7fc073acf767418e.1920.jpg', 'ffeafadd82bcac5227fb16df434210ba4918aebc'], // MY · The Twins SE Asia 2019 (49171985716).jpg
  ['photos/files/e24db2b9f7e288ebe6a376b52d4335b6bd1aa5e3.1920.jpg', '62793f99fb31475ca853ff026b401dfe77ba0b9b'], // MZ · Ilha de Mocambique.jpg
  ['photos/files/5f35bf1ac58b407e263f1671b95577186250f09c.1920.jpg', '2a09ec8624a9924e272330e1b8969019f6841993'], // NG · The National Assembly Globe.jpg
  ['photos/files/64b11f55802fbbcaa9204be52dab1fa2302e85a4.1920.jpg', 'be54b81cc62ec335f60326801225ccfcff39544c'], // NI · Nicaragua 2017-03-13 (32976253324).jpg
  ['photos/files/f9dc793ff7cabcc00f40a94a06d21e37d5ad5cd8.1920.jpg', '5fe8794dd276ad526f65449805723561217e7d55'], // NL · The windmills of Kinderdijk.JPG
  ['photos/files/1f88c118add77da8e6acee236c83831928c3a991.1920.jpg', '1b6146ad84acb852dedf247edde302070f019a66'], // NO · Geirangerfjord from Ørnesvingen, 2013 June.jpg
  ['photos/files/b3ad3e6601318e4da40f925572c321d3312ff390.1920.jpg', 'a014f9d272d6d377ca24e43713908870494c6a6c'], // PA · Panama City Skyline 1.jpg
  ['photos/files/7df08731943d66b4131105648d88b0706d967dcd.1920.jpg', 'bfd5b17d4f09096553f2169aa63dac189aa528d6'], // PE · Machu Picchu, Perú, 2015-07-30, DD 47.JPG
  ['photos/files/5a74a622db738dab05bac5f4be96cb9b607a31d2.1920.jpg', '49219e3326fe0a82324b74d3510a7fe31367714c', 'ac8c7de5872541fa23c0d28e9f3cf63cfe231d53'], // PH · Batad Rice Terraces after the rain.JPG
  ['photos/files/d4bf9d1f0485e290d26f4655d6041410d8712ee6.1920.jpg', '4d8de135acf8fa0316a6e9d4b83c45464c44c105'], // PK · King Faisal Mosque.jpg
  ['photos/files/cde40cd6b74f8e8387547413df4e12205dcfd714.1920.jpg', 'ee4326cd1fff16590164a4c00f09c689714853e5'], // PL · Krakow - Cloth Hall from Basilica - 1.jpg
  ['photos/files/bbead22d0c621c544247853cc63806eaec526d61.1920.jpg', '8cc29b34a5ad3f9e6f2925aa4cffa59deee1a84d'], // PT · Torre de Belém and wooden bridge - landscape view - Lisbon - 2026-05-14.jpg
  ['photos/files/945ea1c0052868b4dbe724961bc0921942582555.1920.jpg', '8e7f67c5326ead5296fd6984afbc26585b5f05df'], // PY · J37 730 Jesús de Tavarangüe, colegio.jpg
  ['photos/files/35882a7c42f91f30532015fa473df639ae8ab557.1920.jpg', 'e4dbc1f3a3fce53d5686b5047d796a4721bd4cbb'], // RO · The legendary Bran Castle (28141036003).jpg
  ['photos/files/7e849c359a38e6d82f5f5e003d0ee1a2fbbb3691.1920.jpg', '74463b051ac2e88f586024eb1037d50ce8a9078c'], // RS · Belgrade. View to Kalemegdan fortress in evening sunset light.jpg
  ['photos/files/663b4cf5b1fe25b757ce24e0f19f65fd474e5290.1920.jpg', '871e04c5befe721ba568ad4156d840a35586a715'], // RU · Вид на Исторический музей в сторону Красной площади.jpg
  ['photos/files/e110c450577be09e73fc00d75d7b54afa0caab25.1920.jpg', 'ba3f6391aa25cd436f18adb817fd551ded789d76'], // SA · Mada'in Saleh 2017.jpg
  ['photos/files/c0c51d6a83e46ac9a12a479c5222e2d983418ab3.1920.jpg', 'b2c2758a6739199c0598a608d666eae5ea9565f7'], // SD · Amun Tempel Barkal SW.jpg
  ['photos/files/0163f98e228fc5ad909495d021f1853123d57995.1920.jpg', '8aad18bee9b70fa18967ce34b96b0fb9bcba8325'], // SE · Kornhamnstorg March 2026 01.jpg
  ['photos/files/a9892dc39079d83a8cc73b43b324bfc531a136a3.1920.jpg', '9058f0a7467a5ce6ecc513627f91a379bf9c4d20'], // SI · Bled Overview.JPG
  ['photos/files/c78c3c2ebe3df4e546c447a27ad6e41a3db85cab.1920.jpg', 'b43149ab73a4fcd39fbb07406a9e04c2fe12382c'], // SK · Spissky hrad west.jpg
  ['photos/files/56a480139af1feb2061d3602d051cd53962c4ef8.1920.jpg', 'e3386b76ef0c3beaf3f1cc1d52883f399fef912c'], // SM · Fortress of Guaita 2013-09-19.jpg
  ['photos/files/c61c09634e93a5a8c8b0d0a765997cd6ada0e2a2.1920.jpg', '7cc5db182428a9646865f9f7cfb382c06e12cd01'], // SV · Izalco Volcano from Santa Ana Volcano close up.jpg
  ['photos/files/37a223ae3083a49c680dcf356b270f3399e1e6f0.1920.jpg', '0d9e8ed750f3946003ba3fb295ca886f50bbed95'], // TH · Ayutthaya Thailand 2004.jpg
  ['photos/files/8ba5744aa4e1f3ae80c534405c8eda4a53f00dc2.1920.jpg', '9679690ea46a69037763f6ee7676d9611a43db19'], // TR · Hagia Sophia Mars 2013.jpg
  ['photos/files/13420c59e8c11a4fb44a387e40269928ccf76836.1920.jpg', '6ea979edbea824dbd71de912ea326f3b2323c53a'], // TZ · Serengeti-Landscape-2012.JPG
  ['photos/files/db0d8615f9b424462fe0c18bd760ec7a0ccb5fa9.1920.jpg', '8d939f10a2f677c9cbdbfb4716c9f2c2bf857372'], // UA · Dormition and Refectory Churches Lavra.jpg
  ['photos/files/98922cebae54ee14b20b05abc304596028976a45.1920.jpg', '62c55fde1e7fa1f3c686300e5460c176faa93f95'], // UG · Kasubi Tombs 20250815 1.jpg
  ['photos/files/618981b52f620318f0c60c86d67319d31ca0ec25.1920.jpg', '45de19a9c7670adb4bec2f7996cda006bb32aa78'], // US · Statue of Liberty and a sightseeing boat, Liberty Island, New York.jpg
  ['photos/files/40bf6743462fedbd11b56e136f3e46e2d356fe05.1920.jpg', '51dcb8cbc3ba8d06c916e82f52f082c6ba279654', 'ac8c7de5872541fa23c0d28e9f3cf63cfe231d53'], // UY · ColoniaSacramento.JPG
  ['photos/files/af40d6f01713ed4ae6a1d08e6da3c4632c0b21cf.1920.jpg', 'face1b1f4eced0a31ca5500b22ad023466406068'], // UZ · Самарканд. Площадь-Регистан.jpg
  ['photos/files/93ed31e7ed4e4b4fafd7b7c4460a088bf9c15b9e.1920.jpg', '193183edb3a9da6e832af47a17f7bef26829ed3a'], // VA · Basilica di San Pietro in Vaticano September 2015-1a.jpg
  ['photos/files/f9e45a330009aa9f41cfcdeebe6d99eb97f4c8e6.1920.jpg', 'f7946491cf1672ae413a0c2b0c53b6c968f0dc5d'], // VE · Canaima 34.JPG
  ['photos/files/32a9ec8f676cfc7207541f67ac033ae36d21b595.1920.jpg', '3111d309db2f7ac3e8db1c5c14469f87e4b74369'], // VN · Hội An, Ancient Town, 2020-01 CN-06.jpg
  ['photos/files/3ea8fd8d447ff794881e341e1fadd824d94b9bcd.1920.jpg', 'cba0627eacae4eea234be6621a37d0b4c881b2cd'], // XK · Stone Bridge in Prizren (by Pudelek).JPG
  ['photos/files/1b3edf52443e8651632110b0285fef1475ad697d.1920.jpg', '37e3a56b0541d384619d764963bf59c34b714901'], // YE · مدينة شبام حضرموت.jpg
  ['photos/files/5b9acba7e2fa142cee61864caf5e42a99dc6cacb.1920.jpg', '59d773b29550534efa801802645aee067b0d9d11', 'ac8c7de5872541fa23c0d28e9f3cf63cfe231d53'], // ZA · Ciudad del Cabo desde Cabeza de León, Sudáfrica, 2018-07-22, DD 34.jpg
];
