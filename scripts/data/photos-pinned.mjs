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
export const PHOTOS_AT = { repo: 'diegosb72/regionle', commit: '607a78afc0e9965910b6aa8578a3f38f8d8eb5b3', dir: '' };

/** What Commons says of every photograph that was asked for. */
export const PHOTOS_SAID = ['photos/photos.json', '3962c9224be550f40177f3edf9eabaef32e556ff'];

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
];
