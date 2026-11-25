// The photographs of the sheets of the countries, as the branch `datos` keeps them.
//
// The workflow "Traer datos" brings them from Wikimedia Commons (scripts/data/outside.mjs, source `photos`):
// what Commons says of each (photos/photos.json) and the picture of it that Wikimedia draws, 1920 px wide.
// Each is named here with the Git name of what it holds, so that `npm run data:fetch` takes exactly these
// and what is built from them is the same wherever it is built. Only the ones a sheet shows are listed: the
// branch keeps others, which were brought to choose among.
//
// When a sheet names another photograph: add it to scripts/data/pedido.txt (source `photos`), push, and once
// the workflow has run write here the commit it left and the names `git ls-tree -r <commit> photos/` gives.
//
// Used by fetch.mjs (which downloads them into .cache/src/photos) and by profiles.mjs (which makes the
// pictures the game shows).

/** The commit of the branch `datos` that the photographs are taken from. */
export const PHOTOS_AT = { repo: 'diegosb72/regionle', commit: 'ac8c7de5872541fa23c0d28e9f3cf63cfe231d53', dir: '' };

/** What Commons says of every photograph that was asked for. */
export const PHOTOS_SAID = ['photos/photos.json', '29a5d49966516eb0752940b5b698b54b811e008d'];

/** The pictures, each under the SHA-1 of its original: [where it is in the branch, the Git name of what it holds]. */
export const PHOTOS = [
  // Brazil
  ['photos/files/3fb858c9b7ebc692ddfca4d93d0eff3e067adb0e.1920.jpg', '2767ccdb2d3e728f307ee30ab9528d5125496a8f'], // Rio de Janeiro skyline and Sugarloaf Mountain at sunset, Brazil 3.jpg
  ['photos/files/e88d03cfad1272ccb1ce412d575026d92b1e60cf.1920.jpg', '40bd57c5d0cb3102722f4ab11a7d7dc6d478aa65'], // Cataratas do Iguaçu - Vista de cima alt.jpg
  ['photos/files/df9f5a916ad881477729bab9429752021fc159c1.1920.jpg', 'a6114a1f0767a456e85e0ac27a30b8e9e863d77d'], // Aurora amazônica no Lago do Cuniã.jpg
  ['photos/files/6c69a66ec7c2d751bcc1fce5a35652951cc7e381.1920.jpg', '34ebef15117a82a27448c203fd38e091c0633a9f'], // Lençóis Maranhenses 2018.jpg
  ['photos/files/bcb8323aceec610554f337e4855b6361aedb6a5a.1920.jpg', '56cd2659697337aaec2d8e56f06e9be710ab93a9'], // Brazilian National Congress.jpg
  ['photos/files/786408c8e6ab4f8caec60252ff61885cf5f4f517.1920.jpg', '40a5914dbd75fdb262ff3b2a3771694a1953395f'], // Largo do Pelourinho Salvador 2019-9754 (cropped).jpg
  ['photos/files/c99a798303d51d25fcf753c12d60a2b0d6acaa95.1920.jpg', '17ef523d3281a986dfb902d5729717a78537ef36'], // Ponte estaiada Octavio Frias - Sao Paulo.jpg
  ['photos/files/c642015fde6a5821353b0bd7f1391ce70fcd4893.1920.jpg', '5477d8d5dad83f81a44686da73d93e25d5875c6a'], // 011 Jaguar drinking in Encontro das Águas State Park Photo by Giles Laurent.jpg
  ['photos/files/1d59587d31c376719c3767bfbbab1b93e3a635bd.1920.jpg', '7f18d924513cc42d63f3c73c986fdd496497a1d1'], // Pedro Américo - Independência ou Morte - Google Art Project.jpg
  ['photos/files/bc6dac877532ca052e259488de9cceb59865ba0d.1920.jpg', '0822beb8fa38e898544b5f1d512f4d06341e1425'], // Proclamação da República by Benedito Calixto 1893.jpg

  // The one chosen for the head of the sheet of each country nobody has written of (scripts/data/profiles-heads.json)
  ['photos/files/a7284c67c3f9f0e1a98abaa365965b267e5b9c18.1920.jpg', '3bd61954c9ecb3617f9ab458704170cc02ab513a'], // AR · Perito Moreno Glacier Patagonia Argentina Luca Galuzzi 2005.JPG
  ['photos/files/1b680881286ba48b847770e6fef743ff70f35818.1920.jpg', '4172abd184631a9786b3e33399d6eb07031df136'], // BD · পাহাড়পুর বৌদ্ধ বিহার 22.jpg
  ['photos/files/86ca43d6d1902a0ab675a83f7fb1a74358b351e8.1920.jpg', 'a775e163f1d5cfade8cf0f65b0cf2bbfba7257bb'], // BO · Isla del Pescado, Salar de Uyuni, Bolivia, 2016-02-04, DD 42.JPG
  ['photos/files/3ea16f13e34a88661c320c3e94eae0de7915108e.1920.jpg', 'b9d07792c401d8cb29e5070457857938e7f06ea8'], // CD · Virunga 01.jpg
  ['photos/files/c578a856908af77b287cb053aed617ca82ce6fa1.1920.jpg', '3e2c1495d32fd09e72674b202e70298517fdbf13'], // CL · Torres del Paine, Laguna Azul 09.jpg
  ['photos/files/2349f782792284013cdaf70bc6b065bf7fc11f92.1920.jpg', '365c7c940e85c402756252370936202ab5df6a65'], // CN · Badaling China Great-Wall-of-China-01.jpg
  ['photos/files/8d63f453b6392bd3d1f71716165ff59bab6d1de3.1920.jpg', '99ba4f2f94636d7cb805127c77b1cca44f2cdf72'], // CO · Valle de Cocora, Colombia 02.jpg
  ['photos/files/a7779333e4e921ebbe699e26061a2cf75173e94f.1920.jpg', '321fa3882ea5408ed5bb504a1bd65e60570f7724'], // CR · Arenal Volcano 02.jpg
  ['photos/files/dc76f039848179173b70d21a79f5ab63e766096e.1920.jpg', 'ac73cc75c26cd28ec345e975c78e9ca202f885d4'], // CU · Viñales Valley.jpg
  ['photos/files/5c8b94222c6c2508c38a5f2524140019da47c690.1920.jpg', 'ba7aa334c968df8c02b37e593fa5b69f8980f2a0'], // DE · Brandenburger Tor nachts 2012-07.jpg
  ['photos/files/5035feb746ad529794ae3d2dd566b1bb60edef59.1920.jpg', '17aa199779ed51db721f74e914cc7c510b388a6a'], // DO · Isla Saona III.jpg
  ['photos/files/cd5706dc2d888de61f5e8e49bf29bcef04a45248.1920.jpg', 'fc2edc1260060743d7f4840a9777eabed38ad21f'], // DZ · Tassili Desert Algeria.jpg
  ['photos/files/429eb8f84da4088410337d2175a7ea2c72816832.1920.jpg', '6e355bcc32bc91ced2c423648c22e69d377fec92'], // EC · Volcán Chimborazo desde Riobamba.jpg
  ['photos/files/feb78b162f18e5562e6d15f045f21912f0874911.1920.jpg', '2da2e605b1456412de00a930b8a5d1ac0ec38aa0'], // EG · All Gizah Pyramids.jpg
  ['photos/files/b3a6fdd089118447cf90625314d455c41d50f75b.1920.jpg', 'd278b9246b10fa6fa411d809a9afb75111f020cc'], // ES · Granada - View from Mirador de San Nicolás - 02.jpg
  ['photos/files/49ef64940f95504dc097e670f76324e732508355.1920.jpg', 'a2815a3fbba89e18665a74483b48bacea50e1619'], // ET · Lalibela, san giorgio, esterno 07.jpg
  ['photos/files/faa27bf8b9d97ac97a8e38d516d8913652d6586d.1920.jpg', '247cae12f0ff22e95f693d2f4c0ecf413056c4cb'], // FR · Mont Saint Michel and sheep - 2026.jpg
  ['photos/files/25a4edbec6ebd332d79f2d30c6977a1d4ea5f5cd.1920.jpg', '356b008a189acea77ad1dd98d5edd3213a3e3d32'], // GB · London Skyline (125508655).jpeg
  ['photos/files/276177a155e86a31898398df9dccf8a5c544cccc.1920.jpg', '165882bb59d40833aa58c990e85d5832112cdf05'], // GQ · Pico Basilé.jpg
  ['photos/files/5a3ad88a502bf10c398c2fe55dca54c9f9f7badb.1920.jpg', 'd035cad35d444628ef0e99cf22a2b5f96107555c'], // GT · Semuc Champey natural wonder.jpg
  ['photos/files/653daacd173fcda8e63488b502f2131d167bf7cf.1920.jpg', '411256fb8ce554efe625d73f914ee55cce2fe437'], // HN · West Bay Beach -Roatan -Honduras-23May2009-b.jpg
  ['photos/files/ea098cd915c3349f75acc2026ed59125e2c0ab3b.1920.jpg', '7aa99cfef6e9bb7b1c875390c1382d073f8903e2'], // ID · Prambanan Complex 1.jpg
  ['photos/files/46dd616163d1ed0802a43898af08993c5deec820.1920.jpg', 'e671b67155d02a94a948c38502925306e667e76f'], // IN · Taj Mahal, Agra, India edit3.jpg
  ['photos/files/c6eb409de56efce99ef2846338e04e3b0b16b0aa.1920.jpg', '9d8015b9efa024f045c4d895f359ec11273f02ba'], // IQ · Hawler Castle.jpg
  ['photos/files/75c37c7f0c52beabcbfe89fe91afc5572f48ea61.1920.jpg', 'e6cdaeebf0dfad0c8c36b4484419957f3451d651'], // IR · Persépolis, Irán, 2016-09-24, DD 56.jpg
  ['photos/files/1768f9a0807087ca9f15c914e8d556c19313431a.1920.jpg', '387a04c0d47ab70c7ec474ee2a1ac5903f879e90'], // IT · Colosseum in Rome-April 2007-1- copie 2B.jpg
  ['photos/files/bb63dc093b31d3cad896b3b11f58a87a6da11d4e.1920.jpg', '1bed5b84eab86403900764601aa35b875a1d5ca8'], // JP · Kodaki fuji frm shojinko refurb.jpg
  ['photos/files/27519c27fdb9c0c226e3b7949f6124fc099bd468.1920.jpg', 'dee2ffa7d1689609bd57a052435383885412df6e'], // KE · Three giraffes 01.jpg
  ['photos/files/98cc20148c3fb31c8daf8f11e70e49df8196e36f.1920.jpg', '4590dea5a902f8adde7f0432cf8640e00bea193f'], // KR · 덕수궁의 가을.jpg
  ['photos/files/51fb9b0b3119cde1bc0f719e2be3a19ca6308539.1920.jpg', 'f092e0004abbfa5094e0898a41d67ef9e66b0606'], // MM · Bagan, Myanmar, Htilominlo Temple and other Buddhist stupas in Bagan plain.jpg
  ['photos/files/089323019df7169ee09aa9eadaba6888939fd564.1920.jpg', '4d3e728c2b962b12a6cc3354ea501e5e0ecb11fc'], // MX · Chichen Itza 3.jpg
  ['photos/files/5f35bf1ac58b407e263f1671b95577186250f09c.1920.jpg', '2a09ec8624a9924e272330e1b8969019f6841993'], // NG · The National Assembly Globe.jpg
  ['photos/files/64b11f55802fbbcaa9204be52dab1fa2302e85a4.1920.jpg', 'be54b81cc62ec335f60326801225ccfcff39544c'], // NI · Nicaragua 2017-03-13 (32976253324).jpg
  ['photos/files/b3ad3e6601318e4da40f925572c321d3312ff390.1920.jpg', 'a014f9d272d6d377ca24e43713908870494c6a6c'], // PA · Panama City Skyline 1.jpg
  ['photos/files/7df08731943d66b4131105648d88b0706d967dcd.1920.jpg', 'bfd5b17d4f09096553f2169aa63dac189aa528d6'], // PE · Machu Picchu, Perú, 2015-07-30, DD 47.JPG
  ['photos/files/5a74a622db738dab05bac5f4be96cb9b607a31d2.1920.jpg', '49219e3326fe0a82324b74d3510a7fe31367714c'], // PH · Batad Rice Terraces after the rain.JPG
  ['photos/files/d4bf9d1f0485e290d26f4655d6041410d8712ee6.1920.jpg', '4d8de135acf8fa0316a6e9d4b83c45464c44c105'], // PK · King Faisal Mosque.jpg
  ['photos/files/945ea1c0052868b4dbe724961bc0921942582555.1920.jpg', '8e7f67c5326ead5296fd6984afbc26585b5f05df'], // PY · J37 730 Jesús de Tavarangüe, colegio.jpg
  ['photos/files/663b4cf5b1fe25b757ce24e0f19f65fd474e5290.1920.jpg', '871e04c5befe721ba568ad4156d840a35586a715'], // RU · Вид на Исторический музей в сторону Красной площади.jpg
  ['photos/files/c0c51d6a83e46ac9a12a479c5222e2d983418ab3.1920.jpg', 'b2c2758a6739199c0598a608d666eae5ea9565f7'], // SD · Amun Tempel Barkal SW.jpg
  ['photos/files/c61c09634e93a5a8c8b0d0a765997cd6ada0e2a2.1920.jpg', '7cc5db182428a9646865f9f7cfb382c06e12cd01'], // SV · Izalco Volcano from Santa Ana Volcano close up.jpg
  ['photos/files/37a223ae3083a49c680dcf356b270f3399e1e6f0.1920.jpg', '0d9e8ed750f3946003ba3fb295ca886f50bbed95'], // TH · Ayutthaya Thailand 2004.jpg
  ['photos/files/8ba5744aa4e1f3ae80c534405c8eda4a53f00dc2.1920.jpg', '9679690ea46a69037763f6ee7676d9611a43db19'], // TR · Hagia Sophia Mars 2013.jpg
  ['photos/files/13420c59e8c11a4fb44a387e40269928ccf76836.1920.jpg', '6ea979edbea824dbd71de912ea326f3b2323c53a'], // TZ · Serengeti-Landscape-2012.JPG
  ['photos/files/98922cebae54ee14b20b05abc304596028976a45.1920.jpg', '62c55fde1e7fa1f3c686300e5460c176faa93f95'], // UG · Kasubi Tombs 20250815 1.jpg
  ['photos/files/618981b52f620318f0c60c86d67319d31ca0ec25.1920.jpg', '45de19a9c7670adb4bec2f7996cda006bb32aa78'], // US · Statue of Liberty and a sightseeing boat, Liberty Island, New York.jpg
  ['photos/files/40bf6743462fedbd11b56e136f3e46e2d356fe05.1920.jpg', '51dcb8cbc3ba8d06c916e82f52f082c6ba279654'], // UY · ColoniaSacramento.JPG
  ['photos/files/f9e45a330009aa9f41cfcdeebe6d99eb97f4c8e6.1920.jpg', 'f7946491cf1672ae413a0c2b0c53b6c968f0dc5d'], // VE · Canaima 34.JPG
  ['photos/files/32a9ec8f676cfc7207541f67ac033ae36d21b595.1920.jpg', '3111d309db2f7ac3e8db1c5c14469f87e4b74369'], // VN · Hội An, Ancient Town, 2020-01 CN-06.jpg
  ['photos/files/5b9acba7e2fa142cee61864caf5e42a99dc6cacb.1920.jpg', '59d773b29550534efa801802645aee067b0d9d11'], // ZA · Ciudad del Cabo desde Cabeza de León, Sudáfrica, 2018-07-22, DD 34.jpg
];
