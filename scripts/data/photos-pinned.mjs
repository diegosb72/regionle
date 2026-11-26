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
// When a sheet or an independent timeline names another image: request `photos` by changing the number in
// scripts/data/pedido.txt and pushing. Once the workflow has run, write here the commit and Git blob names
// it left (`git ls-tree -r <commit> photos/`); older pictures may keep their original pinned bytes.
//
// Used by fetch.mjs (which downloads them into .cache/src/photos) and by profiles.mjs (which makes the
// pictures the game shows).

/** The commit of the branch `datos` that the photographs are taken from. */
export const PHOTOS_AT = { repo: 'diegosb72/regionle', commit: '2a95dd4bd0fd18af109c36dc59503adc2e4fc7e3', dir: '' };

/** What Commons says of every photograph that was asked for. */
export const PHOTOS_SAID = ['photos/photos.json', '1fbca3bd8104c6fa171ae011d841f1a60574cf8d', '45642b58bfed8394088b056eaa54e85f44a61179'];

/** The pictures, each under the SHA-1 of its original: [where it is in the branch, the Git name of what it holds, the commit it is at where that is another]. */
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

  // Period documents from two independent timelines. The older pinned thumbnails remain unchanged;
  // Commons has since redrawn twelve of them, so these new files use their own verified commit.
  ['photos/files/6864d3137af417653a52e862af852f65bb7593ae.1920.jpg', '98af5020ec7797c86548f1f77b3e75f27153b7d5', '57ea97553400f0cb72a2b4a7c0ff67bc8562e0e1'], // AL · Postcard of the Albanian Flag by Aladro Kastriota (1913).jpg
  ['photos/files/a9862cf589cd56ad1fc22871c2a6063f6b9fda1b.1920.jpg', '58dc4254937dec50287bd3a812718a95f89a2877', '57ea97553400f0cb72a2b4a7c0ff67bc8562e0e1'], // GR · Xenophon - Book of Signals - Flags of the Admirals.jpg

  // Additional photographs after the five unchanged chosen heads; each render is fixed at the verified run.
  ['photos/files/cd079a64ea2c9408f7f67fb83dfe25bef9e139d5.1920.jpg', '7b0d78fc1f6fc790a3df4a675e57de7343bf5f35', '45642b58bfed8394088b056eaa54e85f44a61179'], // AQ · Lemaire Channel, Antarctica.jpg
  ['photos/files/552d4aa2e7acd051ec1e6700997d250c007126ff.1920.jpg', '57f15273758b86e99c2155ce66886be2c9311f31', '45642b58bfed8394088b056eaa54e85f44a61179'], // AQ · McMurdo Station.jpg
  ['photos/files/ebc7dde7422d81d6578ed79e1ddb7eda0461deb7.1920.jpg', '221ee783e03973f10275cac35f1190738abc5e34', '45642b58bfed8394088b056eaa54e85f44a61179'], // BV · Antarktisk pelssel på Bouvetøya, Nyrøysa.jpg
  ['photos/files/8f7a672fefc977c186cac1251bea8945c7e88489.1920.jpg', '8d94fd87d04d5b4d7c772e846f2e0b1b3a5a0203', '45642b58bfed8394088b056eaa54e85f44a61179'], // BV · Bouvet island 0.jpg
  ['photos/files/3df387071057d77770ffc0b3e885448a50ad1389.1920.jpg', '90560c155d0d75c98047c07e0f222326abd73f39', '45642b58bfed8394088b056eaa54e85f44a61179'], // GS · Grytviken Harbour, Island of South Georgia, United Kingdom.jpg
  ['photos/files/36baf18281f2c3f9b24bf2571ea2b15f4749c871.1920.jpg', 'd32fc5ad742be620a165d246c47045232d81ce84', '45642b58bfed8394088b056eaa54e85f44a61179'], // GS · GoldHarbour.JPG
  ['photos/files/1de1f6246da3f8eb65819e5589bc014337039eb8.1920.jpg', '1a90db5160a9eb482ddf0d063629ff9d78777aa3', '45642b58bfed8394088b056eaa54e85f44a61179'], // HM · Heard2.jpg
  ['photos/files/24d154ce3baf361d121450f1b022568b1072120b.1920.jpg', '020019df20deb2e9e4dcedbfb50ad5eb89a412f6', '45642b58bfed8394088b056eaa54e85f44a61179'], // HM · Heard Island 2005-08.jpg
  ['photos/files/db364ec3cbeb5010652871a61963b5aa6f1a4aaf.1920.jpg', 'fe950beb27f5fa86c114cd64ef147a463af802a9', '45642b58bfed8394088b056eaa54e85f44a61179'], // TF · Vagues et manchots à l'assaut de la plage.jpg
  ['photos/files/6e7f24b9b6f157eaa929196089ec9738417d02c2.1920.jpg', '0754a1e5bfadb7d0a206c9f837f5dff1c9f6c8ce', '45642b58bfed8394088b056eaa54e85f44a61179'], // TF · Amsterdam vue du large - panoramio.jpg

  // The one chosen for the head of the sheet of each country nobody has written of (scripts/data/profiles-heads.json)
  ['photos/files/692fd0f034ca1e1755b8c657ca1b13aa762948c0.1920.jpg', '45a7841d966750dbe3ef5d04521f49c50a33a4d5'], // AD · Vista de Andorra la Vieja, Andorra, 2013-12-30, DD 01.JPG
  ['photos/files/3eba322096a76f800440af790de29403903b5f7e.1920.jpg', 'd36af4f968b5306ac6455de6cc74e0c36fa06a0a'], // AF · Lake in Band-e Amir National Park, March 2008.jpg
  ['photos/files/061b8864dfc060bdfc084f308b3c5eaeb58b805b.1920.jpg', 'ef5f8178a1f2b61e962668064eb9178d25d2b349'], // AL · The old city of Berat.jpg
  ['photos/files/d8b1a0236f8d2f9132fb25d17ce8e5f43fc786de.1920.jpg', '0e588878bb5f8b215328575872d40adf14e6a5d2', '93309ab710d7f646db823971bbb1960b65c6f563'], // AO · Quedas-Kalandula 07 queda LWS-2011-08 QD18 (cropped).jpg
  ['photos/files/a7284c67c3f9f0e1a98abaa365965b267e5b9c18.1920.jpg', '3bd61954c9ecb3617f9ab458704170cc02ab513a'], // AR · Perito Moreno Glacier Patagonia Argentina Luca Galuzzi 2005.JPG
  ['photos/files/4b89654ddcbc74c0b5dc3718b4d6d916ce790d8e.1920.jpg', 'f1f2914fac5085d3bb3fafccb2abf7c9fcb4fe77', '93309ab710d7f646db823971bbb1960b65c6f563'], // AT · Hallstatt - Nordansicht.JPG
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
  ['photos/files/3919d4990ce83d06a30f03ae16717bd84dc559f1.1920.jpg', '5f345734f9f965587d528c7fc42d7363672d7798', '93309ab710d7f646db823971bbb1960b65c6f563'], // CY · Roca de Afrodita, Chipre, 2021-12-10, DD 65.jpg
  ['photos/files/8c1492ac61ca4ec60dbdff4a6c7e96442e5ea63d.1920.jpg', 'bcb1bf5c73df7a0d0ee6ba03a66d01ce6d660c7a'], // CZ · Vltava river in Prague.jpg
  ['photos/files/5c8b94222c6c2508c38a5f2524140019da47c690.1920.jpg', 'ba7aa334c968df8c02b37e593fa5b69f8980f2a0'], // DE · Brandenburger Tor nachts 2012-07.jpg
  ['photos/files/ff625fccfb6d812ac48bf0e9da90cc16a9cae70c.1920.jpg', 'c4b729a55415b2a7d191d2d378acd26cee3737f0', '93309ab710d7f646db823971bbb1960b65c6f563'], // DK · Nyhavn, Copenhagen, 20220618 1728 7354.jpg
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
  ['photos/files/46dd616163d1ed0802a43898af08993c5deec820.1920.jpg', 'e671b67155d02a94a948c38502925306e667e76f'], // IN · Taj Mahal, Agra, India edit3.jpg
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
  ['photos/files/36c557a5fc575197a101e63811a8e92611302327.1920.jpg', 'b5e125c21dac6f6c6c43760a5a28c067d4d3a395', '93309ab710d7f646db823971bbb1960b65c6f563'], // MD · Monasterio Orheiul Vechi, Orhei, Moldavia, 2023-11-02, DD 06.jpg
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
  ['photos/files/5a74a622db738dab05bac5f4be96cb9b607a31d2.1920.jpg', '49219e3326fe0a82324b74d3510a7fe31367714c'], // PH · Batad Rice Terraces after the rain.JPG
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
  ['photos/files/40bf6743462fedbd11b56e136f3e46e2d356fe05.1920.jpg', '51dcb8cbc3ba8d06c916e82f52f082c6ba279654'], // UY · ColoniaSacramento.JPG
  ['photos/files/af40d6f01713ed4ae6a1d08e6da3c4632c0b21cf.1920.jpg', 'face1b1f4eced0a31ca5500b22ad023466406068'], // UZ · Самарканд. Площадь-Регистан.jpg
  ['photos/files/93ed31e7ed4e4b4fafd7b7c4460a088bf9c15b9e.1920.jpg', '193183edb3a9da6e832af47a17f7bef26829ed3a', '93309ab710d7f646db823971bbb1960b65c6f563'], // VA · Basilica di San Pietro in Vaticano September 2015-1a.jpg
  ['photos/files/f9e45a330009aa9f41cfcdeebe6d99eb97f4c8e6.1920.jpg', 'f7946491cf1672ae413a0c2b0c53b6c968f0dc5d'], // VE · Canaima 34.JPG
  ['photos/files/32a9ec8f676cfc7207541f67ac033ae36d21b595.1920.jpg', '3111d309db2f7ac3e8db1c5c14469f87e4b74369'], // VN · Hội An, Ancient Town, 2020-01 CN-06.jpg
  ['photos/files/3ea8fd8d447ff794881e341e1fadd824d94b9bcd.1920.jpg', 'cba0627eacae4eea234be6621a37d0b4c881b2cd'], // XK · Stone Bridge in Prizren (by Pudelek).JPG
  ['photos/files/1b3edf52443e8651632110b0285fef1475ad697d.1920.jpg', '37e3a56b0541d384619d764963bf59c34b714901'], // YE · مدينة شبام حضرموت.jpg
  ['photos/files/5b9acba7e2fa142cee61864caf5e42a99dc6cacb.1920.jpg', '59d773b29550534efa801802645aee067b0d9d11'], // ZA · Ciudad del Cabo desde Cabeza de León, Sudáfrica, 2018-07-22, DD 34.jpg

  // The next fifty countries by population (1.52.0)
  ['photos/files/ecc4d9bc7ad94e25af0b6e749b008beb3387a0f5.1920.jpg', '0adab38e7ec8b9c1a743203637342995be8bb7aa'], // AE · Dubai skyline unsplash.jpg
  ['photos/files/557449d60d79ad5fa116444db8d60596555be652.1920.jpg', 'dc226493d6052ec290b28166e74a970894f23912'], // AU · Sydney (AU), Opera House -- 2019 -- 2280.jpg
  ['photos/files/9b48715ecc9d3aab3b2437432d2c457eca33adb9.1920.jpg', '3c11f98f6566475c3aaec1b6d014854245e479e5'], // AZ · Flame Towers von der Uferpromenade.jpg
  ['photos/files/81f7caf7a0c1b8f3d004df5560352d0f79f5a32b.1920.jpg', '46c1ef95144807575b0152bfa8b850baf5596924'], // BF · Moschee von Bobo-Dioulasso.jpg
  ['photos/files/877e433a4098edb137d4c1c8bee970bb85208339.1920.jpg', '9f8860c05299cc628c5be5ae737472816f5f9114'], // BI · Bujumbura Burundi Lac Tanganyika 24.jpg
  ['photos/files/9b6b6cde56472291977c09476c797d53a6f2a338.1920.jpg', 'd5d601d280e90e75b7875423490e900905d01257'], // BJ · The village of Ganvié on Lake Nokoué.jpg
  ['photos/files/159bba72b5a8f53fa4e0bb0cd061add358f04ec2.1920.jpg', '80ffb41018abfb9b126c89d0b17bf67c74cfea0d'], // CF · African forest elephants at Dzanga Bai, Central African Republic.jpg
  ['photos/files/f3df599ff95fb61d6e856175e914d29df52145cd.1920.jpg', 'ee0d8c75fa29679d3ae4c10c9d012ca9d9c4f33d'], // CG · Brazzaville - Basilique Sainte-Anne-du-Congo.jpg
  ['photos/files/8e7558e86170c3ac2790a59eac97c96fc707e72d.1920.jpg', '068aa3c5419ea5030f4ac3b5f3a9afb86f7b5f13'], // CI · Basilique notre Dame de la Paix de Yamoussoukro 1.jpg
  ['photos/files/2092956b7714b6ca0e54fb20201b36bcf1967c47.1920.jpg', 'b7528deae75c96d7b5518190c70fd4ed434d15fc'], // CM · Kapsiki home in Rhumsiki.jpg
  ['photos/files/612802a4eb9b65f5fd248a9e149d088b6c92615d.1920.jpg', 'cf516fc012e0cd13ee04d30220d4dd75862776a2'], // GE · Gergeti Trinity Church and Mt. Kazbeg 01.jpg
  ['photos/files/eeb5a26217ba93e934325535e0534a6c0bb21a4f.1920.jpg', 'a942672cc1ae59a390aa69c98e754d5477806ca7'], // GN · Fouta Djallon (14625360573).jpg
  ['photos/files/8c45aefaf0daa43e981cf8df286a231fc6534b9b.1920.jpg', '0284d025a34e6cd68fb11bd67f525d93e403bab1'], // HT · Citadelle Laferrière Aerial View.jpg
  ['photos/files/91c0b3b6772df2e59b9f2a501ec238c26190314b.1920.jpg', 'c3550693e068fc4d77bc0cb30f092885858e2993'], // IL · ISR-2013-Aerial-Masada-Northern Palace 01.jpg
  ['photos/files/dca24bc1c8c01521cf46b945632b368c8ddc83dc.1920.jpg', 'd5b4aa2b96b1131692585e81c1291917d4ad9ef5'], // JO · The Monastery, Petra, Jordan8.jpg
  ['photos/files/f9a2ffe1b9587ddc7bc21793a95eb4896ed9e24a.1920.jpg', '5cb1080ac01ce4d3ad091e76496a59b98b4f3346'], // KG · Song-Kul, Kyrgyzstan (Unsplash).jpg
  ['photos/files/daa03f8e483d0fb53fe04a91aff1a922e2608d7b.1920.jpg', '058789b349fa1fa2778a0bf257a5edfb3e91733a'], // KH · Angkor Wat with its reflection (cropped).jpg
  ['photos/files/c3fca710a6292ec8837d7bbd5c225dcbbb9ec668.1920.jpg', 'fc47eec2ac21fd98e1b82332cf04214051834144'], // KP · Panoramic view from Juche Tower.jpg
  ['photos/files/f88f8c8ea4bf41f68e82d0fd64df180675327610.1920.jpg', '17ccdaed9a64066db9b9f8679a518999b25f61d5'], // KW · Kuwait City Skyline 2.jpg
  ['photos/files/22fbc520d4af2929bbd8de6cec9ff4f65f69f379.1920.jpg', '2a9d1fe44cd1cbd7febd07de4dec366b063b0fa7'], // KZ · БАО ранней осенью.jpg
  ['photos/files/e376f8b999fd0401c2215c7741c268ac7029ea23.1920.jpg', '87663afd82edb8a56c3d424c972a0226a3381fbb'], // LA · 20171118 Pha That Luang in Vientiane 3169 DxO.jpg
  ['photos/files/9fde15abbe9c312b6a867cd399a4353c62a78e5c.1920.jpg', '9e398bd64a25eb5d7ba6cae5999efc1556a836ec'], // LB · Temple of Bacchus.jpg
  ['photos/files/d36114216929e790f9c077a6be71ff6e98018179.1920.jpg', 'b8f3b80beb4ff4b13aced676e0203e97ed15deac'], // LK · Sigiriya Rock fortress.jpg
  ['photos/files/ae59737448ecfbbf492f851e2b103e460e707a41.1920.jpg', '924f8b168da5fc7801f96bbd633125782e201889'], // LR · Liberia, Africa - panoramio (256).jpg
  ['photos/files/3fa1aaa773d7c948c73e5622bcb4a74b799dcf5b.1920.jpg', '9d48960fece10d76d0b393af2856602c155b03aa'], // LY · Ancient Theatre - Sabratha - Libya 07.jpg
  ['photos/files/936af063e9f8304345919fe9e535ba7cc0691c06.1920.jpg', '333d9d22bea40231b9f061f67621113c74a1463e'], // MG · Avenue of the Baobabs, central axis.jpg
  ['photos/files/ffbdbad4ffbc947aaf657e447d8060ab5cf18fcc.1920.jpg', '2abe4d5ac4735fcbd664f47eed564c82cd662633'], // ML · The Great Clay Mosque in Djenne, Mali.jpg
  ['photos/files/3fa370268983c328a27bad87b6eb173c64c63154.1920.jpg', 'ca2f79559d2d3164528eb6879f17fc1f18e2d657'], // MR · مسجد شنقيط التاريخي.jpg
  ['photos/files/ef86eb28b3a15298d5278bc22f5d775aa0284347.1920.jpg', '94030a7cd05d417c5bf1d3cb5c6c7ddbd9e41a19'], // MW · Cape McLear, Malawi (2498445835).jpg
  ['photos/files/66b707c51fbfccd233a36ebe1005cac83d5f28ce.1920.jpg', '4583739c0ac380a2d43fe14e04927b0dd40e3c4b'], // NE · Niger, Agadez (28), grand mosque, old city.jpg
  ['photos/files/29b947c632c573bd526bb064557ac8bede7fa22d.1920.jpg', '8efd152de94edcd518432fcc82571498765e8033'], // NP · Everest, Nuptse, Khumbu Glacier, Nepal, Himalayas.jpg
  ['photos/files/3364f92d2e9b59523276d7e9e78a6dc664a6dfb1.1920.jpg', 'ad95f13b8afc1234022bf25ae0907794108e3b21'], // NZ · MilfordSound.jpg
  ['photos/files/e7279aa9d5c89516640ebad70e38bf927a95eb4e.1920.jpg', 'efcecdb5f9a91a06c890061841737a391a5d0e0c', '93309ab710d7f646db823971bbb1960b65c6f563'], // OM · Nizwa Fort and Minaret of Friday Mosque.JPG
  ['photos/files/946633fb866555e71f77bc3c9b4a19000c2eade8.1920.jpg', '934289b34a1d1ac1bd3171493aebabefac425161', '93309ab710d7f646db823971bbb1960b65c6f563'], // PG · Turanguna and Kombiu.jpg
  ['photos/files/563e0f882dc8555007767d15dbc3f5e19565b27b.1920.jpg', 'cfd6f161c8af772db08420cd1a5a4b2be2616296'], // PS · Aerial view of Mar Saba 03.jpg
  ['photos/files/96f61a710b371ebcf2295266b3be6b5c2bf14edb.1920.jpg', '5c3ef2794f82496e722cd657380aeee6b2c5dfe5'], // RW · Kigali2018Cropped.jpg
  ['photos/files/d7919b1cf45caba882d6307f21afa2f3c8440432.1920.jpg', '27583d40e49071a04b04a4f7ce3af28ec78ca0f6', '93309ab710d7f646db823971bbb1960b65c6f563'], // SG · Puente Helix, museo ArtScience y hotel Marina Bay Sands, Marina Bay, Singapur, 2023-08-17, DD 67-69 HDR.jpg
  ['photos/files/04f43dacb65168b646eaca2d2ec3d4c2d21529b9.1920.jpg', 'baca438ce3c5c7ab7084e0f41087c7e1589c86fc'], // SL · Flickr - stringer bel - River No. 2 Village Beach, Sierra Leone (3).jpg
  ['photos/files/8d2d02650ccb3b08eee91ca7fae1fd1c8446afd2.1920.jpg', 'ccf22d968b926165b67d642837ec216d9033bae9'], // SN · Côtes de l'île de Gorée au Sénégal 11.jpg
  ['photos/files/b7db7001a99a9d0e95495c4d78d0924aa864c267.1920.jpg', 'd4e08fce614fbd0b9c40995dd6e27d795dd8c465'], // SO · Lido Beach 2023.jpg
  ['photos/files/e221759a8acb66ef5ccaa8d73412e7cace78d1d4.1920.jpg', '91bf408c92f2a63d92cd73b513a7c7a5aaf8d160'], // SS · Campamento de ganado de la tribu Mundari, Terekeka, Sudán del Sur, 2024-01-28, DD 155.jpg
  ['photos/files/5c773669a21677a26bc6db62e612643926616a63.1920.jpg', '1af44315b9f4e520b128260879b398b9a3858e87'], // SY · Palmyra 01.jpg
  ['photos/files/e8355f248eb4bafa8e791574479ad57fe05ed4d4.1920.jpg', '455759c1d041c36b09b4faeec3cdd1bcd1ee7992'], // TD · Camels in the Labyrinthe (Maze) sandstone area of the Ennedi, Chad (42405451704).jpg
  ['photos/files/ee6c04067587099e006d0f4a45033d10bd6b2107.1920.jpg', '6b6a4ef0ee2dc2652370be82751102ee786797da'], // TG · Togo Taberma house 02.jpg
  ['photos/files/ec48d88cd1c09714acc772aec1772d68a4c31efb.1920.jpg', '60c2073c89b276e6896a4142d4e06e69721fc301'], // TJ · Iskanderkul.jpg
  ['photos/files/d98c1268d56db440e8618a57db89b40f3ed4ac3e.1920.jpg', '169b7d298ed4675ace59e336d9e78594dd100cdf'], // TM · The Door to Hell.jpg
  ['photos/files/3b3f55b5ebc6d7b445bbc5141f153e8fab12904e.1920.jpg', '6bacb056c57948a753c939d8f0c794cb74e1c23f'], // TN · Amphithéâtre d’El Jem vue aerienne (2023) 1.jpg
  ['photos/files/56c4f87416aef4f5d9221287f837ec298156798c.1920.jpg', 'c7853912368a31c5ff58b127d511ec6e231cb469'], // TW · 1 taipei sunrise panorama dxr edit pangen 141215 1.jpg
  ['photos/files/8fa0f2f892a829318a63541ab1567ae756fb2172.1920.jpg', '11716424615f4bba0a2d17b12561ae2f07678530'], // ZM · Cataratas Victoria, Zambia-Zimbabue, 2018-07-27, DD 05.jpg
  ['photos/files/ea5adcbdbc1eeb63df0002aebe31994c66ac129c.1920.jpg', '12db822758981c91f8653823a24a9184aa3e517e'], // ZW · Great-zim-aerial-looking-West.JPG

  // The remaining forty-seven States (1.53.0): one photograph per State
  ['photos/files/ee06a7a8172e102015427a9710354b6ed776056e.1920.jpg', 'f72b5e461f73d1b7e8e4a68d54e58a46583dd5e9'], // AG · Antigua and Barbuda, English Harbour (24).jpg
  ['photos/files/2913433b1d341c3f7a50aa3cc4c162f2e32de515.1920.jpg', '44d18fa4c077c1953f44ca68984af147988e5708'], // AM · Monasterio Khor Virap, Armenia, 2016-10-01, DD 25.jpg
  ['photos/files/a6a8c199f000158b09490cc90dbc0ae3e3752754.1920.jpg', '08eae41d1271bf87916efd54acf0f626fe2d0022'], // BB · Bathsheba, Barbados 27.jpg
  ['photos/files/bce11b5c097fa6fc47e4016c6562c7dad66b1d4c.1920.jpg', 'a016421980913fee9058251e232ce79dc5819ce9'], // BH · Bahrain World trade Center .jpg
  ['photos/files/333774ccfec9f3de7223acc00575b6737ed83098.1920.jpg', '9cae9055ac742d898ae997ce480b044d4b5df4f9'], // BN · Sultan Omar Ali Saifuddin Mosque 02.jpg
  ['photos/files/e6728f2afbeafb0fb1cbc61b88e4b97facaa8d79.1920.jpg', 'f496820f6966c0a66c018eb5fc650b297c0d0dc3'], // BS · Nassau Harbour Lighthouse, near Nassau Cruise Port, Bahamas (March 14, 2024) 01.jpg
  ['photos/files/e0569b776d902456cf64d48a199ab7baafd94407.1920.jpg', '867bf916edc8c5e2b3434dfc702c6b693e126a8a'], // BT · Bhutan-Paro-136-Taktshang-Tigernest-gje.jpg
  ['photos/files/1266648284b97be8a031a2402c88e7a72e5f8f12.1920.jpg', '61ca59dd808f5f200a5427b4c755cea9accfee35'], // BW · Cebras de Burchell (Equus quagga burchellii), vista aérea del delta del Okavango, Botsuana, 2018-08-01, DD 30.jpg
  ['photos/files/660b9ed6ae87f256020f35fd6fdbb76818cea9a5.1920.jpg', '9c28c772fcccaa3ec0cd2e6e28b30ceb46cec419'], // BZ · Xunantunich Belize 1 19.jpg
  ['photos/files/a1157cf16c6210cf5455ba5343d6956b39660384.1920.jpg', 'c5cc4246689dc150fd1ff6d541e15ec990c3bb4c'], // CV · Pico de Fogo & summit of 1995 erruption.jpg
  ['photos/files/58d8c3ff1d4436df60b1dc1fe0bae163900161eb.1920.jpg', 'e1d640206f2e3c43c5f6e84e1f3732f1fc96ae6c'], // DJ · Lac Abbe-02.JPG
  ['photos/files/e74201bb5df50cc269e32420a12bad1fd0a177be.1920.jpg', '912fa0640efac446db0ef11fbb77f29353b4095b'], // DM · Cascadas Trafalgar, Dominica.jpg
  ['photos/files/f511b3bb5d2f20358d9f9997607aac992d9716be.1920.jpg', 'c1ed3db7d3d0703ff39c73f66aca4f23521bb35e'], // EH · Atlantic Ocean in Western Sahara.jpg
  ['photos/files/f315f339fd835a8009a5c6c30d68765dd28dcc6d.1920.jpg', '824892d3707cfcb4ec502f3677bb18815d824467'], // ER · Asmara, cinema impero, 07.JPG
  ['photos/files/1d3fa35fb41d196d93443daa225313e650e7c32f.1920.jpg', 'de1632bd0b93c2f54fbe376d88b7ae6a44059e5b'], // FJ · Monuriki Island 20150108.jpg
  ['photos/files/d62239d0e8c2a77fe927f6ce9ec8d6c04d6571af.1920.jpg', '1d570171ad6f7c040573835ba645d63d258a5097'], // FM · Nan madol.jpg
  ['photos/files/f172086b83c959ade2a210343cae0dcadf678981.1920.jpg', '1aa29c86c6191154714ebe92e1ef1674aa796bed'], // GA · Gabon Loango National Park Elephant with offspring.jpeg
  ['photos/files/fc518c7d4825d4a646a4d7a0773fc167db761601.1920.jpg', '85b9f551d5681c46ff6c34bf46bd9304f5577227'], // GD · Grenada - St. George.jpg
  ['photos/files/a582d82aa490420713a40182abc5ec2ca8f98221.1920.jpg', '2d8d88bc1eb840dd58643e9f0eec30d7bd684431'], // GM · Banjul Gambia skyline.jpg
  ['photos/files/c5012ea3c7c3f7802ff85d2bb609e646d74a7a25.1920.jpg', '395bc2e3c8fbbfee4e6b3b56a018aaa8680b6c90'], // GW · Lagoa com hipopótamos 03 (cropped).jpg
  ['photos/files/82e623376b5cf2e15a45fa9642ac733e9b032781.1920.jpg', 'b7e3f6dfad0fdfb40707cf42787ee5fd1085080c'], // GY · Kaieteur Falls Guyana (2) 2007.jpg
  ['photos/files/67ef6dd14621234b23b0bf58063b13094f72a40c.1920.jpg', '2787144b5327b71d8e549b6f53b38782a59d72c0'], // JM · Jamaica Ocho Rios Dunn's River Falls 1.jpg
  ['photos/files/98c2b1222fb74c1b7d0365bf3b152494c51ce4fd.1920.jpg', '806e2bc788ca9cee14e49af0032d6a4c7b1a1bba'], // KI · South Tarawa from the air.jpg
  ['photos/files/8c62d03afbe3fa71d0de035fecbd5082bc836abc.1920.jpg', '7fa9cd653ecafd63963410b84ba64c96d35e36a9'], // KM · Moroni City Comoros.JPG
  ['photos/files/196ee4eedc0cd7473f7b7916e4939ffe987a162c.1920.jpg', '363a8e7c3371ef9982857e8f582a179652190e57'], // KN · BrimstoneHill01.jpg
  ['photos/files/ce6c90864479ccece09e71299fc67ede919062eb.1920.jpg', 'd06a615dae01689e4686afa51b0170ccb953062c'], // LC · Soufriere, St. Lucia Sunset.jpg
  ['photos/files/6fc2b5dd749d1d987eab75fb6fd33cb6c90ec586.1920.jpg', '33e97107b9856177a162bd0175a4f5a250991c2b'], // LS · Maletsunyanefalls.JPG
  ['photos/files/82e184b37bda19a4eaff6964bd37e09a77a9c356.1920.jpg', '833e61c9c0200f5e322cc01a4e07c9b5fda94088'], // MH · Majuro aerial (10703502814).jpg
  ['photos/files/2dab7d24b86cdf92aba5aeb1e7e78aed8fe87ffe.1920.jpg', '7247f0269ac2de498f20622983e165bdbb25a999'], // MN · Khongoryn Els 05.jpg
  ['photos/files/8b64637c3672e4cda982502e123feecc424e4dee.1920.jpg', '2c4ebfb0935da32b6d6564a70b09199ed87d4e08'], // MU · Le Morne Peninsula in Mauritius (53697779236).jpg
  ['photos/files/0a855d6b42bc46f5e6f8ca721396517f72d340cb.1920.jpg', '70c48d2c2b0947e0f619e0d7c75525d152f4d103'], // MV · Guriadhoo-2019-aerial-view-Luka-Peternel.jpg
  ['photos/files/4574557fe1113e7e13867b0b5632d30cd278ab4c.1920.jpg', '2f110b2ed73b6577a70ca626b8944f8f3d882b98'], // NA · Dead Vlei, Sossusvlei, Namibia, 2018-08-06, DD 086.jpg
  ['photos/files/694bdbc3da73fd685dc9ce9bc79a5af79683dbac.1920.jpg', 'bf7fc187bc59eed185f2f57c3ddf09681f5ba171'], // NR · Living on a Blue Planet - Nauru.jpg
  ['photos/files/8f9b98f20bb6ac8240d414b40db9421085da74cd.1920.jpg', '3ba6c8b2369132401533882c1f4f457ff5cdec26'], // PW · Ngerukewid-2016-aerial-view-Luka-Peternel.jpg
  ['photos/files/3f3b027005b9fa58e5490cbc22dd9235c875174d.1920.jpg', 'e75aaf79b0296c9ae88d36c9597935566669f378'], // QA · Doha - West Bay Skyline 03.jpg
  ['photos/files/ced46554a85c62cbfe67cfec085a0168b20113e2.1920.jpg', '1f4c2a5a8ab0e448d3280a9c57a8d9e6c7b3f402'], // SB · Marovo Lagoon (16 August 2008).jpg
  ['photos/files/c946c81ddc6a5e3332037b3fa488c37eddded1ee.1920.jpg', '5fa3375a3868cd2c89e615df92758094d792203a'], // SC · Anse source d argent.jpg
  ['photos/files/3c826166790f082f516296a6136f17efef3b671f.1920.jpg', '408695c735e101a8180bb2f11f451e375d97146b'], // SR · Officiers Woning Paramaribo Suriname.jpg
  ['photos/files/59417b37c515415d187d17ae04cef0d15a9001fc.1920.jpg', '6a66ae03f9ecb6a20328cbb28485fb8a9f30a917'], // ST · Pico Cao Grande.jpg
  ['photos/files/7810e1ffa51f486647715ac3344acebe814be3ca.1920.jpg', 'a2dd52a8f74ad85a27220199c9610aa9ad05ee92'], // SZ · Swaziland (32819536884).jpg
  ['photos/files/8eaced8a02afe76cbc406a3414d53fb270aafb02.1920.jpg', '6ebdf7af562a962ca66d47f4b874ffc743051026'], // TL · Cristo Rei Dili Timor Leste 2.jpg
  ['photos/files/c28cd7b9b64d9e7d4c16c3ef49f75cdfa2ac5cc3.1920.jpg', 'f9898fdd601e4c7f86704f0bcfd1345bd56d997f'], // TO · Leaving Vava'u airport, flying down east side of Vava'u, Tonga - panoramio (12).jpg
  ['photos/files/63a8ea58120c28e6cc8288165ac6c188a210f64e.1920.jpg', 'c7ece7f9583a32ae32aed4c68fdf5cd765bf6a39'], // TT · TnT Maracas Bay 2.jpg
  ['photos/files/fbac2d9e236f4d7d6d5b31bad8812a92f2d78a40.1920.jpg', '7ed344c164c27fe3b8407b3560023c8661e990c6'], // TV · Tuvalu Funafuti Atoll.JPG
  ['photos/files/7e5c3259996911fb1ce72525ee2560a6ed31c8f7.1920.jpg', 'c40455e236062f38cfcc60777992fc31ff57fd70'], // VC · TobagoCaysAerial.jpg
  ['photos/files/179d099782f0d1bb6d1d972bf60d680b4fef522a.1920.jpg', 'e4a730e3a5f7fbf2dfb48afeaf7820f302b88ea9'], // VU · Lava trails at Mount Yasur Volcano, Tanna, Vanuatu (49181693888).jpg
  ['photos/files/6cea9416d864f798ad819fdde2e13ee701e581ef.1920.jpg', 'ee5a4d7b92a7d162d486b511bc91413d2a6e066a'], // WS · To Sua Ocean Trench.jpg

  // The 51 territories: a photograph for each head, checked against its Commons file page
  ['photos/files/8a8778280b11cd072a0fd85625143dd24c02d715.1920.jpg', '29af11ddf5ca583b5fc683b771a68261b84f652c'], // AI · Anguilla Shoal Bay is the BEST beach in the Caribbean. - panoramio.jpg
  ['photos/files/af4f9f696c7f7d2d0249eac5bbe934dbfb9a1767.1920.jpg', 'c5a7517c052373f867614e75be2432590e4a9603'], // AQ · Paradise Harbour, Antarctica (6087280325).jpg
  ['photos/files/695180153cde144b4a3a1b59859cbb9eb463a54d.1920.jpg', '9a2c3a6f616e1afe12c0644b2f9cdff3dea217af'], // AS · Ofu Beach American Samoa US National Park Service.jpg
  ['photos/files/ef9b4079c6d756235957d991ea05e53de4e536d8.1920.jpg', 'ab921d76f42f55eee98dca064040c492185b8ed8'], // AW · Aruba landschap.jpg
  ['photos/files/6d346a86acb9afeb4ea6acf319a998bc5804cc17.1920.jpg', '9aa4bd8ed4a30b219b0c618f678f9d85c16ef464'], // AX · Аландские острова - panoramio.jpg
  ['photos/files/5253ee53dca7db685cd5ad5783ea8048efae98fd.1920.jpg', '250177ce253a11a01fe3e9d94d2c8c5aafac8a05'], // BL · Saint Barth - Vue aérienne (Anse de Lorient) - Octobre 2009.jpg
  ['photos/files/18322a49a200403b04b37c1449b48e96a567c1b0.1920.jpg', 'c4537f57813c7750e1a94478d0f2adf00779202a'], // BM · Horseshoe Bay beach, Bermuda IMG 0349.jpg
  ['photos/files/58040648a5bb8a05a3dc913c59771231cc57f676.1920.jpg', '89bdd30714252bf4cd97c56774e4d769fea25241'], // BQ · Saba with cloud cover.jpg
  ['photos/files/09ffe6a104bc1252dc1296512510027d5fd004c2.1920.jpg', '2e3379f989c9866655611a60d6435725a9d904a6'], // BV · Bouvet Island west coast glacier.jpg
  ['photos/files/293dc7afa93961cd175c8d0a5831e7c15a4fb848.1920.jpg', '835fee695fabdf8f7aad61cbb004040651c21c05'], // CC · Cocos Island Atoll.JPG
  ['photos/files/955f09f3515faa137a8c4d85551c3228f1184787.1920.jpg', '693c95809de3b6b665b381aa2fa117b68551472d'], // CK · Maina Island, Aitutaki Lagoon, Cook Islands.jpg
  ['photos/files/0210f5aa7da7d61186003baa936aef2ab002aef7.1920.jpg', '9bdfda441e97ff2ce3858067b8e58b6da208c650'], // CW · Handelskade Willemstad - Curacao.jpg
  ['photos/files/ea9d02b46aefc5ed9dea237c6ec8854c9985f004.1920.jpg', '9039e0233561e04720d4a36d36b8927e90c4cb00'], // CX · Flying Fish Cove.jpg
  ['photos/files/a775da84f4d583dae0561920dc40cc1c3e7b418a.1920.jpg', '5ab9d905b76023af9ae265f4bc3cda118d7c102d'], // FK · Mount Usborne - Flickr - chris lovelock.jpg
  ['photos/files/bb74ec2923311951dc78e9cd6685e5c9333b4f00.1920.jpg', '80c7ca649f295320dc160fd2c7b9d2ea4c229f7f'], // FO · Gasadalur village and a waterfall.jpg
  ['photos/files/2bb568d17d83e3d23294f2de8342bb5eac1c41ad.1920.jpg', 'c67b3d4f2e54f4bfef1c66bf5b494cb736f0e788'], // GF · Cayenne av Général-de-Gaulle.jpg
  ['photos/files/5552b8a4ba84cc2627ca18e61d0e74db1b7e2144.1920.jpg', '4692283502eaabb274a66c6cced72f992c3450f9'], // GG · StPeterPortSouth.jpg
  ['photos/files/27d184fd85af30c5827cc37803d93d2c80cc2cf9.1920.jpg', 'a12d61aecf589c442259409bd0dd7f1287893314'], // GI · Bay of Gibraltar sunset Aug 2020 - 6.jpg
  ['photos/files/8cebf30706818b5df62b5861e9f25e7b35d02811.1920.jpg', '1a0dd0a63a92729ff151951dd44ad2f1d5a52769'], // GL · Iceberg in the Ilulissat Icefjord, Greenland (54067514893).jpg
  ['photos/files/d6c3c667f0f4892b3289f29a506926c610d78584.1920.jpg', 'e6e0a58e3f856b35afcf23f35ba013f3cc6bd3d3'], // GP · Guadeloupe Iles de la PetiteTerre 1.jpg
  ['photos/files/83cd8a3a2cac0f92d9e8fc78e01bcf9e4273a495.1920.jpg', '7b0cc4c84fde40d0138b525bdb47ff586d11198c'], // GS · King Penguins at Salisbury Plain (5719507571).jpg
  ['photos/files/716046806f2e4f3f2d410bb919971d74eb4aec11.1920.jpg', 'cf4cf28fe6f3afab97519afc8fc07c5da19cd8e5'], // GU · Beach of Tumon Bay, Guam, USA (8532198983).jpg
  ['photos/files/550a93042fb5580f100bf8a7046c0d8a6c04738b.1920.jpg', '94c87104ef86818671648ea0c348c26dde5ad7c1'], // HK · Victoria Harbour skyscrapers.jpg
  ['photos/files/d3d818681fe6eac54ddf7cfe64045e5f65e22c8b.1920.jpg', '76b597bed5f9a3de56d74d571f9ddb4e25036fc7'], // HM · Heard.jpg
  ['photos/files/711b5fbc5c006621e82f21c1465b8c9e1887b826.1920.jpg', 'd310412c430d3ab3a9cf38b786f6aa6ef898d3dd'], // IM · The View From Douglas Head, Isle Of Man..jpg
  ['photos/files/7b19003a968b74ea33790a367a3150c87a9fa220.1920.jpg', '586feec925b63467e46960224a5171990ecc410a'], // IO · Diego Garcia (satellite).jpg
  ['photos/files/23104050fdd54ce2c8a4b5c69bf813f877762e10.1920.jpg', '6d0ac021862457e84ecefef61a09b29dc53d81f6'], // JE · Mont Orgueil and Gorey.jpg
  ['photos/files/750c4cd7f99b098e8de406af38f4bc5fba18db4d.1920.jpg', 'a1c0d507a1e6239484e024fb5aa996fa6da80fef'], // KY · Resorts on Seven Mile Beach, Grand Cayman.jpg
  ['photos/files/ec34a85ba4779f446841b6ea884b98ca6a9102d4.1920.jpg', '172fb5e05f20407a44e3a8ec31a15509ecb94777'], // MF · Marigot, Saint Martin (51332436871).jpg
  ['photos/files/fd601e365316086905ae39712c3febdcc68967bc.1920.jpg', '67279ac3f31f3818ddf36f30040c7828220986fe'], // MO · Restos de la Catedral de San Pablo, Macao, 2013-08-08, DD 02.jpg
  ['photos/files/821141d80a36529daaf69be59b75a5654af947c5.1920.jpg', 'ac861e892a492e07823a19cf2de1e205658292e8'], // MP · Bird island saipan.JPG
  ['photos/files/696ba4007f06cac854a6dad5d83e68c3863ec41e.1920.jpg', '02c3fc0f820c3ad2f27efe41eab043fc5f8f4c21'], // MQ · Ansesdarlet.jpg
  ['photos/files/0233068768034b89b516f7050906ba5872c6f07c.1920.jpg', 'e5b83f5c8cc88bd42921ffc5e2f5c5f1225ca2e6'], // MS · Soufrière Hills volcano (Aerial views, Montserrat, 2007) 02.jpg
  ['photos/files/4a1d873fd31a6f66f4a31d76e7614b72613538a2.1920.jpg', 'a3c0ab6c97de46dff1caa1e9c9bf48d7e217c960'], // NC · Kuto Bay, Isle of Pines, New Caledonia, 2007 (6).jpg
  ['photos/files/9e619faa0c4305c0287ab9138fb0f525cf098930.1920.jpg', 'c9fb6f8cb272470978057d1c3d782fcf4c9cbc1d'], // NF · Kingston, Norfolk Island.jpg
  ['photos/files/a5c0a53b63e8935ec5bc7d936251fcc5624090ce.1920.jpg', 'f9d9bbfa8121b96aa7e0b4ade7555b3325a2d854'], // NU · Main street of Alofi.jpg
  ['photos/files/d543ac14fea4c8df1c5a4df6d3f10b930735b3b3.1920.jpg', '2c9c01ee65aad0cf26236fe18dc3ba2e11c56386'], // PF · Bora-Bora French Polynesia - panoramio (4).jpg
  ['photos/files/0db350890e61cf8d3961cd160dfb7980cd7b6d3d.1920.jpg', 'a67562edec898d19a00051877adc2a7e737fd38c'], // PM · Ile aux Marins 03 08 2019.jpg
  ['photos/files/5d4f6bc5df70dbeacc6c2dbdf31d67c8421a53bf.1920.jpg', 'f60adad589b9711b35757894c7d1640550f7dd03'], // PN · Approaching Bounty Bay - panoramio.jpg
  ['photos/files/ac79e86a46119643fa508dca196c89d884e7175c.1920.jpg', '7616fa8823a8b44bd63cb2320b617c7e95d614ae'], // PR · El Morro - Walls 1.jpg
  ['photos/files/bddcafdeabc8ce63a4dd82b1a28647255d05d920.1920.jpg', 'ae3fc1fdb32c266df99ac4216c192c9f1f60a30a'], // RE · Cirque de Mafate Ile Reunion.jpg
  ['photos/files/766e35a1ed0b8fe94c14cfe5c93e8397ea0afaa0.1920.jpg', 'b620e64be44644722269c1776a3d589ca0aed8b4'], // SH · View of Sandy Bay from Diana's Peak.jpg
  ['photos/files/86187c717e0f602fe05060c8b03a2002708bace6.1920.jpg', '872d7e98ebc5ac667cc75460310f06a2abf2061d'], // SJ · Nathorst glacier, Svalbard, at midnight sun.jpg
  ['photos/files/9fbf61415e416cf368ac734c25131fac0b6d50ba.1920.jpg', 'b0b9f83232b61eb2fca4313ccd4a42a36e8b5424'], // SX · St. Maarten Philipsburg Great Bay Beach.jpg
  ['photos/files/e10b8cf9f755f4182a488e19f451e0aa67be89c1.1920.jpg', 'b83814f6da12099ef2290bd2a64c1d896dce0771'], // TC · Grace Bay - panoramio.jpg
  ['photos/files/270696928b2c27f136e66df32562e4024e3b3c13.1920.jpg', '421da2dfd1a1ab4c37b0be67da017cd7558d824c'], // TF · Mont Ross - Archipel des Kerguelen.jpg
  ['photos/files/f1989ae9147312449b1e1046272420f1928a1011.1920.jpg', '82e5d51ab0cc04e9bf9d4d7659e2ab0096f1b5af'], // TK · Atafu.jpg
  ['photos/files/dbfd219642b29b9cf9fff412db176bcac38e5b66.1920.jpg', '448b72b142e0a49365b9027681e28f292f0d6f67'], // VG · BVI-road town hafen.jpg
  ['photos/files/2f36c3d81a938c3bc9c155a61db3198665a78199.1920.jpg', '9cf3edc0fd9308719db1af813f8e096ecd42239e'], // VI · Trunk Bay, St. John USVI 02.jpg
  ['photos/files/2b72e6839b9546ec7cdba8d89b2343eb69aec51d.1920.jpg', 'f07a03c2b8c6ec2ccacb6dde35fe6574d6e9a8d2'], // WF · Wallis le cratère du lac Lalolao.jpg
  ['photos/files/0be803bb31f7aa4f1e9edc5cbb0b8e0ad5b81ef1.1920.jpg', '2e1a36c5c74b036560801c2a7782af6c9c2e81f8'], // YT · Barrière de corail et lagon vus du Mont Choungui.jpg
];
