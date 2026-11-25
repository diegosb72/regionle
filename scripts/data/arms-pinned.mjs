// The coats of arms of the sheets of the countries, as the branch `datos` keeps them.
//
// The workflow "Traer datos" brings them from Wikidata and Wikimedia Commons (scripts/data/outside.mjs,
// source `arms`): which file Wikidata shows each country with and what Commons says of each (arms/arms.json),
// and the picture of it that Wikimedia draws, 330 px wide. Each is named here with the Git name of what it
// holds, so that `npm run data:fetch` takes exactly these and what is built from them is the same wherever
// it is built. Only the ones a sheet shows are listed: the branch keeps the others that Wikidata names.
//
// When a sheet is to show another (scripts/data/profiles-fixes.json, `arms`): ask for the source `arms`
// (scripts/data/pedido.txt), push, and once the workflow has run write here the commit it left and the names
// `git ls-tree -r <commit> arms/` gives.
//
// Used by fetch.mjs (which downloads them into .cache/src/arms) and by profiles.mjs (which makes the
// pictures the game shows).

/** The commit of the branch `datos` that the coats of arms are taken from. */
export const ARMS_AT = { repo: 'diegosb72/regionle', commit: 'c8444f667e417641f2f6a93d109ac1d0c75cb65a', dir: '' };

/** Which file each country is shown with, and what Commons says of every one of them. */
export const ARMS_SAID = ['arms/arms.json', '9d03a20a7cdb5a533f959162a64a2248756acd1c'];

/** The pictures, each under the SHA-1 of its original: [where it is in the branch, the Git name of what it holds]. */
export const ARMS = [
  ['arms/files/b35fd410eae0b4752d33b7a94262a0ee152d2042.330.png', '82eece7237bf2493967202aa4cec76a00dac9961'], // AD · Coat of Arms of Andorra.svg
  ['arms/files/81f6ae245c0b478d629f9b3fa71cd8e7b663989e.330.png', '2bc916d9fff8aebcabd2c3a30a057af45e78f04c'], // AE · Emblem of the United Arab Emirates.svg
  ['arms/files/583c314069359d43d0177b9a2b54e04e07d59f8e.330.png', 'aa9ea7b302897472f9b213a54e89ea3a085a526b'], // AF · Arms of the Islamic Emirate of Afghanistan.svg
  ['arms/files/afab8156868d4adc31d5c935e8d317d291e78be4.330.png', '5356f6e4e7d72ac8d3566d7cde707f8cc0eea5a7'], // AG · Coat of arms of Antigua and Barbuda.svg
  ['arms/files/debb72da0247a5ba67ffef51f08f152417f91826.330.png', '5e96dfe3efc60159324af23611c18f66d95b6830'], // AI · Coat of arms of Anguilla.svg
  ['arms/files/539f262d8c767a7b714b74ec7e4e2638e96ca37b.330.png', '8b60b9d2d54fd0b92ebbff68b204a7efd89df94b'], // AL · Coat of arms of Albania.svg
  ['arms/files/a6d0700d533d97293dee88648d8f31b7e18df3e8.330.png', 'fade8a8ed9e23323c325100836ebbbfc0d9bd2e7'], // AM · Coat of arms of Armenia.svg
  ['arms/files/91fb2fcc6b1734fc047e85545a1db2cbc84b50f6.330.png', '56f6ed3be898b150b5a9a01277de5d1014192fe7'], // AO · Emblem of Angola.svg
  ['arms/files/e0ab3392505bb9c6677e630803d7ee47345d676d.330.png', 'bcbb77c41f01824270a4d82bf40016f98a757a07'], // AR · Coat of arms of Argentina.svg
  ['arms/files/6985a8f5812e271bfb81e5388df20d3a146ce276.330.png', '7524ddf40ca90d0182e9fc7a0f97e7378c8b250f'], // AS · Seal of American Samoa.svg
  ['arms/files/799eb503c43d81f2eb618959337cd274f0a5a335.330.png', '33a0ca3c5a11121c7c1193d7440a28a087b80198'], // AT · Coat of arms of Austria.svg
  ['arms/files/1fb9de03a8768d2cea3a673b7bb791dd3a78fb69.330.png', '53054d8572369e5b1aefc667ce98eb16fd923c3b'], // AU · Coat of arms of the Commonwealth of Australia.svg
  ['arms/files/c0e8105ac8fa8042e589fd42e8e7708f46504e6f.330.png', '899ccca065b055c8e9192ac121bdb05833127f52'], // AW · Aruba wapen.svg
  ['arms/files/741688e536edc3bf442a1e2ac8d21798c905f501.330.png', '5f885bfcd03b9c31bc32493e0e05ced659fcdc2a'], // AX · Coat of arms of Åland.svg
  ['arms/files/7c2e61ce5a505b90449582ebb4c08f05048e8eb7.330.png', 'c1e816c3504bc9cb6dc93f813608485e84f4b14f'], // AZ · Emblem of Azerbaijan.svg
  ['arms/files/47a33fe9146d9e9d9e57736042264dcdb8202503.330.png', '9f02fe85a1b55183786f3b808a49934a045dd2cf'], // BA · Coat of arms of Bosnia and Herzegovina.svg
  ['arms/files/89a91980be316b65017a816f96a19f025a6c1c2a.330.png', 'cd3532c237e0fc5808be82ba4efbcf7c9773a6fc'], // BB · Coat of arms of Barbados (2).svg
  ['arms/files/cce081c51e6ec80bf18bbe723ba68826a7a0fe4a.330.png', 'ba74a36abb3f097130741323ad5c99eb48a1aaeb'], // BD · National emblem of Bangladesh.svg
  ['arms/files/83500985d21d926b13582f06e1c6097c962fa630.330.png', '690dfaf275078f3c4eee1707064dd45d52a9f5ec'], // BE · Great coat of arms of Belgium.svg
  ['arms/files/bf90cbbb0fdc06244db258a552b56532c9ffd955.330.png', '9334d3127fb149f6b67fbe95fcf92244c10662e0'], // BF · Coat of arms of Burkina Faso (2025-present).svg
  ['arms/files/2d52cea093bac0dbcfc70153accac9aa94626b35.330.png', 'd232cc7127b6c42c0057c646a0b7c5c861848b16'], // BG · Coat of arms of Bulgaria.svg
  ['arms/files/ec4d295eb2cc5fe6fdeda3475f6b301fea696e83.330.png', 'a1adfdc6a5387e6bd5bf5d98417f899b7f58ab1d'], // BH · Coat of Arms of The Kingdom of Bahrain.svg
  ['arms/files/1155ee6f2f5a1ee0408b3d1c8e01026936e1bb33.330.png', '4e8b30e979b59845269c6acf403b59ba450af16c'], // BI · Coat of arms of Burundi.svg
  ['arms/files/fe0aefbe25cc21b0ac492a3c6051e3e7cf8d2261.330.png', 'dfcc60a30a2e1796469104f8357324e5688ee4ca'], // BJ · Coat of arms of Benin.svg
  ['arms/files/d7ef57ff0f3a373b498057c529afb80fffa4e2e9.330.png', '0ae77c5c3ec518e627f28c7dd55c8aed47679135'], // BM · Coat of arms of Bermuda.svg
  ['arms/files/0836884b54c7d5d3aa44f9abc4fb17ca2bcd4c44.330.png', 'f61c8fde3a0c3df7461c9f4b4dcb4ef2b67e7448'], // BN · Emblem of Brunei.svg
  ['arms/files/b9628a069dfcc48940e3451671a2c560247fb84b.330.png', 'cf9d18718a2645253eaa277b094e80fe0b7353d9'], // BO · Escudo de Bolivia.svg
  ['arms/files/b6cecd796d59d3117014ba0ca9aee9c0ad785d75.330.png', '4419e18bb349cbc8eac0f52852983b6123137838'], // BR · Coat of arms of Brazil.svg
  ['arms/files/bc256018cb4d7eed20a4a1b13f3a5121a6b201d8.330.png', '750383e4f0889fb7515dbf185a6bda8d26d7bcdd'], // BS · Coat of arms of the Bahamas.svg
  ['arms/files/7de2517492bc1a000cb335ced509c0e0109fb0b6.330.png', '3e5bed30337f47174f65b9549595f172836e6658'], // BT · Emblem of Bhutan.svg
  ['arms/files/2fe0c9f91a05a1cdc000bb60414a9bf17fe7a466.330.png', 'd9135fe962b6b504b77670192c9f099e5bcedbd2'], // BW · Coat of arms of Botswana.svg
  ['arms/files/5c121d8dbb7a63c6e702d69547d0600dee7758da.330.png', 'e572b6cbb5717415de4143da6013af506be4b592'], // BY · Coat of arms of Belarus (2020–present).svg
  ['arms/files/5d3790e061c59adc7a9e2f7f158969eb3577d138.330.png', 'c7df0d980241dba647a50bf52edda5cc82221c9d'], // BZ · Coat of arms of Belize.svg
  ['arms/files/93e74ac0737db417779a81aeca597627e7dab6fe.330.png', '0a5b3361c87212ba6f9a02aad1c806971d967632'], // CA · Royal Coat of arms of Canada.svg
  ['arms/files/7a9af179aa14891c7b7d2c9641a63673b305b4eb.330.png', '2c6cd3fd103c30a93de5b73ee7cfb6a67f44b2f9'], // CD · Coat of arms of the Democratic Republic of the Congo (black spear).svg
  ['arms/files/e196b0895299a8fa3ccc660290156fe3a25a2a8a.330.png', 'a2f1f4f3506b015bf900c13c32cdbfbb652f8b5a'], // CF · Coat of arms of Central African Republic.svg
  ['arms/files/b21aa45b753221efef53530f06207cd0b12c5f74.330.png', '9020e4599f2afcf8e56fc9db6295b1e8bed51a78'], // CG · Coat of arms of the Republic of the Congo.svg
  ['arms/files/97369b23e8ee2bb9bb3cc17cab07927418735c46.330.png', '97be8c38b60c292fefe6a2116e7d78a7e4eb9de9'], // CH · Coat of arms of Switzerland.svg
  ['arms/files/4c470467911f1e341b4e4c7d4c12cfc56eef4d82.330.png', 'f92e01897c6c5d4bbc7c303e268bcfb6dcc7e50a'], // CI · Coat of arms of Ivory Coast (2).svg
  ['arms/files/0e774e4c41794e455f252f065450966e55e23ef9.330.png', 'db653c4d7794310ab81246f1193fc1a5292910f2'], // CK · Coat of arms of the Cook Islands.svg
  ['arms/files/a3bd4dd7b39bc47e7062a10375ec8c7289fa2bd8.330.png', '926d4c68f38691c5f98c1df9ba9d0a249d7e69ac'], // CL · Coat of arms of Chile (c).svg
  ['arms/files/b6234e0eccba2309c20c9d8be55038eaa83ef90e.330.png', '0426e41ed3990d282c5356b587e1e76e6b1864eb'], // CM · Coat of arms of Cameroon.svg
  ['arms/files/53d64b3056ea682e76680820776135cfeba88436.330.png', '1bd3bf61bdcf15f09dfed638b3137cb2d13a0a91'], // CN · 中華人民共和國國徽.svg
  ['arms/files/4f05f595617b6b7e755043360bf251ddb5bca275.330.png', '4213cfe03217f005c3773328bc75959d42594db6'], // CO · Coat of arms of Colombia.svg
  ['arms/files/920fedd058125d0a41d6ca93916a41e06028b923.330.png', 'd1337d8f1a7b6120a8355d1d4c676f632e7d61a1'], // CR · Coat of arms of Costa Rica.svg
  ['arms/files/648e8f7a7cedf7e390ece02a562440d6ab3ea5c5.330.png', 'c488bf7862cde0ef53129109642e8f1d1a5db8d9'], // CU · Coat of arms of Cuba.svg
  ['arms/files/4ab92920d26c00856d0b4faf257782444cdd767c.330.png', '87484d07fa163ee3040be83ae36285f693ca0251'], // CV · Coat of arms of Cape Verde.svg
  ['arms/files/88235a95cde9889ac8d6cc5ee31d6ff9e587841b.330.png', 'cb7f8ac0dcb633820f4d799e2c89a13e1befb030'], // CW · Coat of arms of Curaçao.svg
  ['arms/files/c2369f5d47078a419280eabe665afe3f7e2b193c.330.png', 'c2b317aff8ee8b1f6b0e408374bfbd43915e745c'], // CY · Coat of arms of Cyprus (2006).svg
  ['arms/files/66740cc43708c483d0660cb7b36194ad672dfee4.330.png', 'e229bea5e7c50e70297fb5d4955dfad06e16784c'], // CZ · Coat of arms of the Czech Republic.svg
  ['arms/files/01625c79ff2d305e7151be256ae72d781e3e57b1.330.png', '33583e693903d92115959936bbb893aeed283e0e'], // DE · Coat of arms of Germany.svg
  ['arms/files/cdb7d4566d3d545d3077b50a1cc06eb1d61e1ff2.330.png', 'a42006a46502e4bc4309d41975496a721fdd69f0'], // DJ · Emblem of Djibouti.svg
  ['arms/files/c1a58cebdfe40b68a9dd92e3ab0c576eeac1ebe5.330.png', '146ceea23f198e604f90f781888c5a62069daba8'], // DK · National coat of arms of Denmark.svg
  ['arms/files/e6817ed5ca7cdbe7df413d46c7d79a4e4b771d66.330.png', 'e8ae5250cd5878c7e2a52827cc89d9ec8a858d80'], // DO · Coat of arms of the Dominican Republic.svg
  ['arms/files/e72dd6e4c0ea04913a271fdb42d9ce4542cf76ee.330.png', '0afde39f2f27762d6bbc012f7e0e045f2fa6ceb1'], // DZ · National Emblem of Algeria (bronze effect).svg
  ['arms/files/237a7daa8d4b48f6656668ecbb45921485280685.330.png', '4e351eebc4d62daa4c5842d5871aa346a60dc76a'], // EC · Coat of arms of Ecuador.svg
  ['arms/files/4448b0a25a715904bf24e9bdaf61dc3e4343f87e.330.png', 'f48d5a72f700bcb654d4cbd0cc7e2e22d4a8f3fa'], // EE · Coat of arms of Estonia.svg
  ['arms/files/40c2e0235a90aec22f0f0885041acec155a38319.330.png', 'af4a97519fa0c543cad6b2a161bd1ab8cdaecdec'], // EG · Coat of arms of Egypt (Official).svg
  ['arms/files/28eb1140ad5e298b18cffddf0edd5f415800a859.330.png', 'acaab37ab7660d401747071a2f069e4134516dae'], // ER · Emblem of Eritrea (or argent azur).svg
  ['arms/files/872ddffd8d1bfc5e6e20bd593a0c8a12fa950571.330.png', '04c94383270dca8947ba6982c4b175d084bf5958'], // ES · Escudo de España (mazonado).svg
  ['arms/files/6c1e84e9e00a23dcc793264704725355bf762d8a.330.png', 'f759bab0b48426c4d982e5c42fabc8a09d8aab18'], // ET · Emblem of Ethiopia.svg
  ['arms/files/3b42dfa46fcb3f0c0f5bae5db4c9d1cbf68dc377.330.png', 'd0a923bd92643c1ec6e0436453a965c4e58df072'], // FI · Coat of arms of Finland.svg
  ['arms/files/165e8b21d9677b334de83b919dfc2e1fad939b1b.330.png', 'b9f12ce03b60a5f25d0b72a76bc6fdff3f73cd53'], // FJ · Coat of arms of Fiji.svg
  ['arms/files/b4f5fe3b9455cf9738b9e9d5166042583f869344.330.png', 'b1f3681d1024839d6db3e058ea667ee85356c00b'], // FK · Coat of Arms of the Falkland Islands (relief).svg
  ['arms/files/2062c58f1cfa93e3f6dc1ab4b96aaa7b95cdb62b.330.png', '8f4864cbd65c5eab854a335baa4ee2fb66372906'], // FM · Seal of the Federated States of Micronesia.svg
  ['arms/files/2d77cc32994f961e199a63d19421e6b196a90a0e.330.png', '7fd13cda2197f28d28d17b63d029cfccd7d71f03'], // FO · Coat of arms of the Faroe Islands.svg
  ['arms/files/24a0171d816e3fa92ae43a5739902fa863291921.330.png', 'ab243adc18214f74f35354c3a8175628d3e212ef'], // FR · Arms of the French Republic.svg
  ['arms/files/7b3ea3f76a43a9ac0a260d263ff824eef7427d2e.330.png', '5b1d4445f970fa1a67112aa551331d6dc39dc625'], // GA · Coat of arms of Gabon.svg
  ['arms/files/e1f5ab9fe33b4944345263d80bc1e5287ed6c3c0.330.png', 'ad030dd3a608ae36691be80c21fc8aa52ec9ac12'], // GB · Coat of arms of the United Kingdom (2022, variant 2).svg
  ['arms/files/23f60242c47149350dd1046216f2722d43281219.330.png', '1777738c0644b2eb2aa36a51666acb1b96a59b96'], // GD · Coat of arms of Grenada.svg
  ['arms/files/d86856bc55dad0189c11e200a163705690c83ced.330.png', 'b05868ad3883e8c9115d697162a3ec199a3aeab7'], // GE · Greater coat of arms of Georgia.svg
  ['arms/files/90868ff46a17dd89643749edf50ca6a62ef83fad.330.png', 'dfa8ad8fb2fa3dc0e5816bd48d41b9e47626b92a'], // GG · Coat of arms of Guernsey.svg
  ['arms/files/668e04c0a2099ceac3de886fa9c021583114a958.330.png', '4646772ae0462f327b88f4662f01ef83d79e0e72'], // GH · Coat of arms of Ghana.svg
  ['arms/files/1022977700d1772bf2f8ded0b8d35308103b2c77.330.png', '9043cc425481718eb598d920c85ae68f14cc14dd'], // GI · Coat of arms of Gibraltar1.svg
  ['arms/files/abd2cca2c33021c763ea2b84174950d5b02bf454.330.png', '41a4a1c65f0360a548fa477f617ba126be502cbc'], // GL · Coat of arms of Greenland.svg
  ['arms/files/dc7d43ffac70a476ef95803793487a917ee9d4ff.330.png', '24cde3a44170ede10e518329e965e05e8442c1e6'], // GM · Coat of arms of The Gambia.svg
  ['arms/files/ee284fe107cc4a546828c17ebfb807b6bdbb6f58.330.png', 'e83f0677559f34853b215e3ccd6c2dcb98aae4bd'], // GN · Coat of arms of Guinea.svg
  ['arms/files/19e06200a80901d7d608452fe6c6b972b0e5eadb.330.png', '74aaa00cc47da2952d138a1bdaa99feb930f7418'], // GQ · Coat of arms of Equatorial Guinea.svg
  ['arms/files/69ae5e251812bdbe9c1ef901988d07ba7d556609.330.png', 'c9e6e0f629c44a9e6b501574e66f0bf5401768d0'], // GR · Coat of arms of Greece.svg
  ['arms/files/658e188cd189598eabafecdad7e245d1a615d8a1.330.png', '54c313b2235edc5061656e57cb5ce752c58513cd'], // GS · Coat of arms of South Georgia and the South Sandwich Islands.svg
  ['arms/files/56475443eacfc8b112998a5ab8f9d244fc5a7e1b.330.png', '52407de69762706d4914105df1a934a3b4b4ff16'], // GT · Coat of arms of Guatemala.svg
  ['arms/files/e21a755988f0faec2648ae75223bd96f020da35f.330.png', '6648659b4ae9baa40898b2a4fd824ea262737eda'], // GU · Seal of Guam.svg
  ['arms/files/30772df889bd352a0926cb17e64c7adef79ea5fe.330.png', 'dab2de4157cd9e90c7f3867a3e486e506e4d8f51'], // GW · Emblem of Guinea-Bissau.svg
  ['arms/files/307b54fcbba0975f435152f99a038c769804c1a1.330.png', 'c4e66798e8c7e562ebcb12e997f802b88edbe224'], // GY · Coat of arms of Guyana.svg
  ['arms/files/3c837d67497e74a8a9fd794cbd8f5a6587d0d198.330.png', 'c0d6c06026fff0b2fa71f3e83f4b42d4478e577c'], // HK · Regional Emblem of Hong Kong.svg
  ['arms/files/78082ddf2a5fc26609262c2b168fc9bb8ed07341.330.png', '200a28ccaf6f4f2813f997a5d9878d4a6a3b997a'], // HN · Coat of arms of Honduras.svg
  ['arms/files/74e2c09a167c9d854c3c076acb63aac9a952457f.330.png', '9c7628d0f3fa4ab12392d1070988190525cb66fb'], // HR · Coat of arms of Croatia.svg
  ['arms/files/2f1e2c38c7840de7616adbc20683db5f782b4e40.330.png', 'fe459ba5f17a0b6fde96b142d8191b14095f74eb'], // HT · Coat of arms of Haiti.svg
  ['arms/files/0a5a2a962546d5bf4ee46693bbf43c185af29140.330.png', '3625592357fa9dbfc45ebbb1d16ee20fca94e164'], // HU · Coat of arms of Hungary.svg
  ['arms/files/7f91a7a6fc7d308fc0f8539ffc054f17e0d05027.330.png', 'b565b24eb53e0e88c0225fe93e85827b3503a0d5'], // ID · National emblem of Indonesia Garuda Pancasila.svg
  ['arms/files/2082f7d4238c71ef0b64e500117df5040c5e04cf.330.png', '2e6f8c3383b84cec8a641003915bfebf79341445'], // IE · Coat of arms of Ireland.svg
  ['arms/files/329ca87a2fb8d0ea8c1c3a3708e53fcc0a440813.330.png', 'bbcea24e6cad5d398d6b7905ce225a5f1273eb81'], // IL · Emblem of Israel.svg
  ['arms/files/41d32fe5e6191b8327c88a993e916850e640f480.330.png', '0ece3bd530fbf94edeb12890c1704f2c6d76b30c'], // IM · Coat of arms of the Isle of Man.svg
  ['arms/files/4b7a721ff6fc288d5d933ff3b51da7dbe6870921.330.png', '03b464bfc59371b695200b5e4d6404b6f7bdf7a2'], // IN · Emblem of India.svg
  ['arms/files/3ebec5700230f481205d718da8a22bb177dbfbb1.330.png', '07a0b1738e5065f28d1ac9adb3193546cf2a3ea0'], // IO · Coat of arms of the British Indian Ocean Territory.svg
  ['arms/files/c5834164f6dc99c33d3828b03c2ee6ad7ef1cea8.330.png', '28f77372d17b4a2313f38ec896ff553a46f3949f'], // IQ · Coat of arms of Iraq.svg
  ['arms/files/eedd92c60f305c4b74bd8fe32d749c9544d91ed0.330.png', 'fceb4c65b9071e1c2861777a6944437df43b4f7d'], // IR · Emblem of Iran.svg
  ['arms/files/ef5fac9ffd6d503c1833859aae1a77140cd0ecf7.330.png', 'c9a2269bc4f2ab534bf2ba078c20df9d3a75811d'], // IS · Coat of arms of Iceland.svg
  ['arms/files/5144093e4e0c5914c2048e8ff1ddc7631112ce66.330.png', '35ed40daa2acce8186fbd7b2fe4b559260c0be16'], // IT · Emblem of Italy.svg
  ['arms/files/626367ca40e9e016a0c946a9b070eef2a1251ba9.330.png', 'fb48a2f0d8fddc2767044ae0bbc994a520a72d48'], // JE · Coat of Arms of Jersey.svg
  ['arms/files/ad4149ccc3c079ef01ce0f971af03a92566a137e.330.png', '82931076e79582c20ed602616ead5d3f2c9bda05'], // JM · Coat of arms of Jamaica.svg
  ['arms/files/b20c35dbe88e3a5c3d68ad731db2f09e58aff302.330.png', '0bfcc32c8074c5156a9b0beb94e8cff5c08c7a18'], // JO · Coat of arms of Jordan.svg
  ['arms/files/da4d0b45341a4f30b8444873c825547d331df50c.330.png', 'b9c1723aac052ebbe6dae23d5b2952210c328670'], // JP · Kamon of the Imperial House of Japan.svg
  ['arms/files/e283837589e5000bf5f460d01a63cdbff5fb4c9b.330.png', 'b3dbd6eaddc2bf360e046381161a124b35c6e6fe'], // KE · Coat of arms of Kenya (Official).svg
  ['arms/files/45679ac684581fa1e5ed9611ac40e35d924b5838.330.png', 'ebb988ab30f43be8da3169c23b36c9f41387811e'], // KG · Emblem of Kyrgyzstan.svg
  ['arms/files/baa8783c183694fb9f1c8b954146949e5de3651d.330.png', '510954b8161f4436f22ab520d58428e6ee535a7a'], // KH · Royal arms of Cambodia.svg
  ['arms/files/bf7e2616ee255c0bcc4ed02439f94877dd23663b.330.png', '0ac4ae99b7c529d64b57896ce11624e9c3f3e3c2'], // KI · Coat of arms of Kiribati.svg
  ['arms/files/bce2ce4eec86babaa8564a449058fbf2728bf43a.330.png', 'd4d7f52d76961e2bc610aefd4fec16f945f0b9f1'], // KM · Seal of the Comoros.svg
  ['arms/files/0a40a37dd321c0d780195d81d2f1ba9a8fc781db.330.png', '6d46eb0d4a526ddd7de676619173389584fab001'], // KN · Coat of Arms of Saint Kitts and Nevis.svg
  ['arms/files/d3476f83b1282688b4df86c5c211c3d38a9e08e6.330.png', 'd3ee110d9efc86861e42b1cfde933ef3d6b2d712'], // KP · Emblem of North Korea.svg
  ['arms/files/72add30fefd9fb5c668e4ae1cfa9e6cd2858c0b2.330.png', '9515cdb9ac9af4283ebda11b5b55de8595491fca'], // KR · Emblem of South Korea.svg
  ['arms/files/e7bccf6725ebc40ed7597919d10bbda08388e0b3.330.png', '3f13a0f2d151a3a50804b72caa3099cc56038b41'], // KW · Emblem of the State of Kuwait.svg
  ['arms/files/db7813f10e6ca515e0322970447e4d149eb16661.330.png', '79197b79972b9c767ba1d6e7230f628abe71b602'], // KY · Cayman Islands Coat of Arms.svg
  ['arms/files/bc33eb773234c2cd24faad5d2b4a6b56dd75e5b6.330.png', 'c019502c8aaf2d3fc2c2d6489e24182bea104f46'], // KZ · Emblem of Kazakhstan latin.svg
  ['arms/files/8edc88ebcd93998b871cd19a6689824e026b09a1.330.png', 'cb8cc313b51e6ef68c8d25660ea960a22e456a2f'], // LA · Emblem of Laos (2025-).svg
  ['arms/files/bdd2cb20dc9a60093990bc714aaa63cf67fe17dc.330.png', '96a29b6e42c3c25b4468ed1f29a5ffc559086bc1'], // LB · Coat of arms of Lebanon.svg
  ['arms/files/df02d555503e69d6e8c6668e557dbb73d289ef3f.330.png', '5df9e4405189901ded42afe454f764d8fe0f6ce5'], // LC · Coat of arms of Saint Lucia.svg
  ['arms/files/a7a34f42983c60aa3ae4b2cf10c38028cdb7c46e.330.png', 'efac020e99321d5efd2095b01fbe2fcde07deff5'], // LI · Staatswappen-Liechtensteins.svg
  ['arms/files/f1b54c5874c18361ff7edca9c4382b81e5f904a3.330.png', 'f6eaa2411a10ded0e0e750dbc9e1e4f2be8eb6b4'], // LK · Emblem of Sri Lanka.svg
  ['arms/files/5fd40ad16b911e8a50feeca0cc47a0d6b2672fd7.330.png', 'aa7cf8cc3106549164664392399cb41d35d3cbea'], // LR · Coat of arms of Liberia.svg
  ['arms/files/77e8c887adbbb775f54377e7b7da16cd700df199.330.png', 'd365dd32d28bf17c991b7ad43eafa88639aaacc0'], // LS · Coat of arms of Lesotho.svg
  ['arms/files/627fd9ed0e78561216913dfedd43b20a54c611e7.330.png', '38b543fc35aa1f8318606e8c72091e85ee91bb30'], // LT · Coat of arms of Lithuania.svg
  ['arms/files/aeab8bacdce676fece72f0ba47f0f95c37fe69df.330.png', '76e63459c111be103ef9627d26b90d114834bdca'], // LU · Greater coat of arms of the grand-duchy of Luxembourg.svg
  ['arms/files/a4889f1c8db2a320d3bc3c34ace3e66ac8f9c28d.330.png', '307baa7e878ab4e42ee51c30489461c9ef6d0700'], // LV · Coat of arms of Latvia.svg
  ['arms/files/90ad2db0539ad377683e1a864b693d13cd72a8f4.330.png', 'd0382084a8b6d5302dff16730577e3ff3f28ac73'], // LY · Seal of the Government of National Unity (Libya).svg
  ['arms/files/2629e262407c1f19c6390c530dc6424aeda27515.330.png', '7feeb8ddb2cedc5cc0e56b217b267abbc5e52592'], // MA · Coat of arms of Morocco.svg
  ['arms/files/cbf1297f6cd1c171600bb4f71f2ce2bff340b3ee.330.png', '0282d599baba0c0158221b7aa103bcc103fe69a8'], // MC · Coat of arms of Monaco.svg
  ['arms/files/5dece2dc2e968d41f82f925d06e8df85f6ef0ca3.330.png', '23e5487af3adbf72cefe372722d0724bd82aa1d4'], // MD · Coat of arms of Moldova.svg
  ['arms/files/e505a2156107967b16853497f08abc62e2776aa3.330.png', '263e7912a969fb274278e1da507484d5618f073c'], // ME · Coat of arms of Montenegro.svg
  ['arms/files/31c23fa0e8df61b88aa0f96de7f9d0e9ca4cd6a0.330.png', 'a57ec2267656cb980e68d56288dbadacbf79c909'], // MG · Seal of Madagascar.svg
  ['arms/files/16b25f7190701a0efd70e01438faa1ce9c6cac1f.330.png', 'bc223baa43d4f6e0ece2b8aafc82e96e8b449d0f'], // MH · Seal of the Marshall Islands.svg
  ['arms/files/4b41c16a089efe6ab76ec2d91ddaf410e2207fd9.330.png', '1a309039a255aafa9bc0fc6b30ef2e8eed427330'], // MK · Coat of arms of North Macedonia.svg
  ['arms/files/6cf653c9a7326f0ecb5c26114cadf57c5a4c82af.330.png', '3933c3e7d7982983b7deb718aa7ce0b51c951147'], // ML · Coat of arms of Mali.svg
  ['arms/files/5ab7658468d4c56d2a3112fa668facb7c2854491.330.png', '93104dac5ea7f1ba76047bc8e40b7d4d811d8b59'], // MM · State Seal of the Republic of the Union of Myanmar.svg
  ['arms/files/c2b6a36758a6e6ae4744daa017de74e58a399766.330.png', '25fb5b67b50bb9ad99dbf24a5ca0f49aee1a3b25'], // MN · State emblem of Mongolia.svg
  ['arms/files/391fb7c000535a52fb8b7fb431a8d98a1329972d.330.png', 'e80fc2527d81acb6ca9c35e1ee2a57fa7bd014e1'], // MO · Regional Emblem of Macau.svg
  ['arms/files/8110b83ed23f0128dc394844862005a2c0575328.330.png', '787c2c6c5fe3fd312966c1a5edfc80c8cf3a9087'], // MP · Seal of the Northern Mariana Islands.svg
  ['arms/files/3608cc22977e4304c8b26513860545b03fbbd611.330.png', 'd78ab91a9d647152ffebc33d2a141b2ff97ce9f7'], // MR · National Seal of Mauritania.svg
  ['arms/files/e4d9f95671b86176229bb2767fba8008c5b68a18.330.png', '24e27d369e795e83214436857c12e81c27ad6c11'], // MS · Coat of arms of Montserrat.svg
  ['arms/files/4a6b03abc7bcf90d2d64466de9e8ee0307ca9202.330.png', 'a0d07df7d107c3a3b8c8a8cc31aef4d788b394e8'], // MT · Coat of arms of Malta.svg
  ['arms/files/7ea200b9cf86da3913af801a183258ae4628678f.330.png', '0871c48f95e28c4a6abfd88eddde95c29ab5a230'], // MU · Coat of arms of Mauritius.svg
  ['arms/files/08e7248a13880bdda00732365974e1ef5fe57445.330.png', '26adabe54ef844686c290cdb27a81cee8f1d7a9d'], // MV · Emblem of Maldives.svg
  ['arms/files/cf2ba322ee216c4192f9294f55fa963a107cd886.330.png', 'c9bb54e5df1bff5886dd0cfc4af6db58ecdef086'], // MW · Coat of arms of Malawi.svg
  ['arms/files/140084198096841dbb9702464259ee673d4bb7b7.330.png', '62f97c78f0d15d2184098860ce11d16deb9b8418'], // MX · Coat of arms of Mexico.svg
  ['arms/files/4c3a2d6dbf89df83ab16dabb6a978e137a307c28.330.png', '358eda639ceea81fcfceb519743d0f2864990f2c'], // MY · Coat of arms of Malaysia.svg
  ['arms/files/d244dd1c23968ed113f0d5a90ca23578d77b95f6.330.png', '5d3261b891371aaca048a7d69d1c974ea91bae8a'], // MZ · Emblem of Mozambique.svg
  ['arms/files/def820832db9308da36fa425f71fd525db2ece25.330.png', 'f239a60a5ae7d58bf183aab37b105895fb6c1557'], // NA · Coat of arms of Namibia.svg
  ['arms/files/d3d1c5d382ab89b70178f145a33692e3ed9fcf08.330.png', '9aa206d812f4f281c342323f5c840f2d9f3562bb'], // NC · Emblem of New Caledonia.svg
  ['arms/files/ea17719af291aec973742588b5c891483faa4fb8.330.png', '0c9a635427db04ae5703b4b5ba20f82a792e791d'], // NE · Coat of arms of Niger.svg
  ['arms/files/79a1b8fb0acd7b78fccf767a8e71acc944df3e10.330.png', 'bc55f47487872d3621886a3df4b104682a7edd05'], // NF · Coat of arms of Norfolk Island.svg
  ['arms/files/845f6596ead955e777a2b07de5820d1ca425dfde.330.png', 'ad0396e502ef4283040d55a2d385bd3b02d3717d'], // NG · Coat of arms of Nigeria.svg
  ['arms/files/4a9ab9d513c6cd97e93395c551f466eecc0e3f93.330.png', '94c63733a86acbb5b971a6ad6f69f22c504c3ec3'], // NI · Coat of arms of Nicaragua.svg
  ['arms/files/03717058d5a047d8d64d1ee38d56bde813132b69.330.png', '57b449a074a819fa5abd8b62ac5f8d16049cf32d'], // NL · Royal coat of arms of the Netherlands.svg
  ['arms/files/8763f5aeb31a57b0a127bb08fabf0a74f646476a.330.png', 'a08e5a75b0d092ee1466c6404e23d5d224826735'], // NO · Coat of arms of Norway.svg
  ['arms/files/e1297efb8aa9a40cf471bc1eee4aa1c8d0bb0c5a.330.png', 'c9a0c64bbdbbf9a39a8189f6837d2ef5a1cdf7df'], // NP · Emblem of Nepal.svg
  ['arms/files/9723ef80134b99e9e969fd5d10bb40199573ef37.330.png', '998d04422fedc1835e3b38d8d0af6764d4e2b709'], // NR · Coat of arms of Nauru (2020).svg
  ['arms/files/906b1345830d462f49b674b9b6c4fe77eb7248d9.330.png', '07e975f7b95a0e7fab2d085ec42f9236675cfe3e'], // NZ · Coat of arms of New Zealand.svg
  ['arms/files/3975f2f209ecc211eadf553bd128a3986c2a56d7.330.png', '656093db61125bead654c5dfd51861ab83571fec'], // PA · Coat of arms of Panama.svg
  ['arms/files/c908dbd59d8ac8718e77d95e6ae8b5890a01b0dd.330.png', '813dda73fbaabbe2b99b7cf176531884b23b1110'], // PE · Escudo nacional del Perú.svg
  ['arms/files/e2125ca39a1d5134fe7699f857ccb054350bbc96.330.png', 'fa2711974654e98dde0f68b9a91e95689f10ec82'], // PF · Coat of arms of French Polynesia.svg
  ['arms/files/edd6450ccce9b63e8786ca1fcf2a5280545a7477.330.png', '1012ab9d27f75f89478eb1b436554a9d05e6579e'], // PG · National emblem of Papua New Guinea.svg
  ['arms/files/04a6924815eb17a10494d91f12651d2363fbc563.330.png', 'a12e6b6b8c7b03281135e12567b33910e7c84115'], // PH · Coat of arms of the Philippines.svg
  ['arms/files/b864a9c3857b5d750939a202833eea05701f1dc4.330.png', '9644cdba500ba66423448fb7d44e024bf31f5083'], // PK · State emblem of Pakistan.svg
  ['arms/files/b4ab0e12e203d9bf1c6b6bbe19bb4304914944ea.330.png', 'fc16f616c5af544b19f37ff15b0b3f0ad52f460c'], // PL · Herb Polski.svg
  ['arms/files/0ea59bf9fcb4a8b17001e34183d1d3b0aa37c65e.330.png', '72bbfb8f8093ce3a1e0b3a023ad0af36ef1a94cb'], // PN · Coat of arms of the Pitcairn Islands.svg
  ['arms/files/8ad753cc26197c72c309ec6f96a73be5b068d7db.330.png', '8ea5ee38a55d98af65b37ce6c13cbd3d29bb1c5e'], // PR · Coat of arms of the Commonwealth of Puerto Rico.svg
  ['arms/files/6647fea7b43c3c775971c14e4a709b3e31d761c1.330.png', '66c6e131fb3d3457044401235c2ccb7801ad178e'], // PS · Coat of arms of Palestine.svg
  ['arms/files/b972ab1836b27c13ac8246da98f48e51e8c01a87.330.png', '1479909198bfd0cf6b7d578e5c3bb86b83e83980'], // PT · Coat of arms of Portugal.svg
  ['arms/files/80a8a39f67721da5b9da744aa5ec496e436d9e9d.330.png', 'a96f73cf60cea7873e74b10a55bb2c95b3767368'], // PW · Seal of Palau.svg
  ['arms/files/4f58414f65560ec25e9c12d73028c13971ba1568.330.png', '852a21e3d15caad74795e1d237a21aec6face6fe'], // PY · Coat of arms of Paraguay.svg
  ['arms/files/24be819cc8a79c40bb7ad0d01dc2d3ce5ce3cb72.330.png', '1599682a5a4accf4fc3e4a91c475d11f932c1ccf'], // QA · Emblem of Qatar-2022.svg
  ['arms/files/9a504c1cac271730c2b823410b7e32afc89cad84.330.png', '93809e54917ce9ba9b291db5bc6bb3d11996d0fc'], // RO · Coat of arms of Romania.svg
  ['arms/files/47ef3d27259854edb7f493a717223145f6ea74b1.330.png', '4366b414aca528eb9c354e07619a9626a34aa041'], // RS · Coat of arms of Serbia.svg
  ['arms/files/271c3e89c6fd4baee2eabc0ffe016fe746666fbb.330.png', 'bc8f96531f2b32382476ade85a71b99a83bd6548'], // RU · Coat of Arms of the Russian Federation.svg
  ['arms/files/3f21bda40a638e99da5535e85064e4d1134e0bd9.330.png', '7e3ce4c1ad8ed5a01f6127b6dec3256fb03e334d'], // RW · Coat of arms of Rwanda.svg
  ['arms/files/f08760197723f24238aa3a5ca3face52bf8fb617.330.png', '54974c6878ac326cc3ca312dc025349b7cb392e7'], // SA · Emblem of Saudi Arabia.svg
  ['arms/files/a84710d18f13907e164da40655494f409edee126.330.png', '064abddea847c92281ffa70ddbd10893aada5b5c'], // SB · Coat of arms of the Solomon Islands.svg
  ['arms/files/39bcf44875df3b7a46a649065b0c80d734c3bebf.330.png', '314c36724765eadc6a81338fde82c51d04595061'], // SC · Coat of arms of Seychelles.svg
  ['arms/files/c7f617932997ea6bf6054592efd2e0f26fba5a17.330.png', '678de8d9d615318c946817e5f0883bddbeec4ff3'], // SD · Emblem of Sudan.svg
  ['arms/files/3f995a9b78a076b3e39d4fa61311c7fed4614197.330.png', 'c6d8debfd684df7b4aa07264c53accc9af651a2e'], // SE · Great coat of arms of Sweden.svg
  ['arms/files/de95265de615b966853c07fb0d49e9399a190633.330.png', 'b30e8734e5d721375c1ed957de5ddacdd69358b1'], // SG · Coat of arms of Singapore.svg
  ['arms/files/6ff3131667f8c871e3e282fb5dbd2d4d65257e2d.330.png', '4e2cbe049929212da9270bd418f7406bfdc15d3d'], // SI · Coat of arms of Slovenia.svg
  ['arms/files/6e99d7d9561f0757fa2a2d56c8fe71cce9e493dc.330.png', '11d77d91150c933c59c282594deb3c77e16e2015'], // SK · Coat of arms of Slovakia.svg
  ['arms/files/2bae3a8b56e58b2c3f06a6da8849411071f69a4d.330.png', '594182f424b6e6867de80679bd8913307aefeab3'], // SL · Coat of arms of Sierra Leone.svg
  ['arms/files/8a37e456548803f9b6a8bee67f777b603d3b5866.330.png', 'fb71ace4763ca083f9bbec81501f61c45b80ede5'], // SM · Coat of arms of San Marino.svg
  ['arms/files/b87d3488180a2aaf130b59e4473611c37b2ccaf7.330.png', '54a2f455cf057cc240bd7bd8ed24a4ee7057ff7c'], // SN · Coat of arms of Senegal (official version).svg
  ['arms/files/273a27fa75c1338b04da7f6e9b82fc7db7d7ccf1.330.png', '171bab8c101aaf5fe34e351497325c2376e57d38'], // SO · Coat of arms of Somalia.svg
  ['arms/files/00537debe1bc1085fdad98e3be6df10900acbed1.330.png', 'bf0ba02588a573eab1f5bd68f1f6de5596253b27'], // SR · Coat of arms of Suriname.svg
  ['arms/files/863a012b4a4b49c905b44c723a1f07328c7a354d.330.png', 'bd0fe854f2b831386a7c93ea7c7e2527123d0f99'], // SS · Coat of arms of South Sudan.svg
  ['arms/files/65b46980e172d9615ce37532e9ce33a661022572.330.png', 'e0cf3d4db6efd4a41b0292c1141280a53586c3f7'], // ST · Coat of arms of São Tomé and Príncipe.svg
  ['arms/files/bf6a293bdaa184cdde05537f3d3ac6fa44f6cba2.330.png', 'd92226296f929d2484ca62a741c4fe4f9b2808b1'], // SV · Coat of arms of El Salvador.svg
  ['arms/files/2917fbb9b647fcf915941c3ed347a5437d3af411.330.png', 'fd9594739f57d25ced11f087ad1c9d53ea51e14d'], // SX · Wapen van Sint Maarten.svg
  ['arms/files/bb62fa43f94c5ad5f9bead1d3f1ddedcf415a128.330.png', '4514f8a8bc77b89b1b9bb9d7ce4c9b4dfe1dd8a2'], // SY · Emblem of Syria (2025–present).svg
  ['arms/files/0dea118cac27c44f06338a5319a470a15273982f.330.png', '73338a065de9670ec0b6bfb8b8d825c90414b4d4'], // SZ · Coat of arms of Eswatini.svg
  ['arms/files/b4cdbc326137ee98bbc5c0951e4887602364e9ba.330.png', '3b9a39c32c59294a5bec3499f0383f83bb93bf3b'], // TC · Coat of arms of the Turks and Caicos Islands.svg
  ['arms/files/a021e120aa2532de25813c944b3172d390de1a47.330.png', '6e42b2f11a431fba6652d61e71f1bbeff4933e5e'], // TD · Coat of arms of Chad.svg
  ['arms/files/c257b3af6971950e20d25cccadfce0ceac1bb49b.330.png', '9b4680653c5c5dc33b860829438f9fd8dd9d8922'], // TF · Armoiries Terres australes et antarctiques françaises.svg
  ['arms/files/d9d020c06dbf0f3edea70db83bba080ef9a0b4a0.330.png', 'ec783fa9f26e1cac7ce85160b6908b506d16ca48'], // TH · Emblem of Thailand.svg
  ['arms/files/5dd46bad27bb0037c3bba3c681341d4ea4861715.330.png', '1ff92c8456b04cce0d11a2ca47cdd103a1d51d54'], // TJ · Emblem of Tajikistan.svg
  ['arms/files/607c0045fa8cb6f1de3127e978591cc72f62665c.330.png', '18b8e3da087357070177cc11d4ffef1fba99c0e4'], // TK · Badge of Tokelau.svg
  ['arms/files/d57194539e578215bf7c752d47e79e0589d8c6f4.330.png', '530529bf82b286875eca19a53797a2d233084e67'], // TL · Coat of arms of East Timor.svg
  ['arms/files/da2d3c4c7fdb7b3fd34464293def7a495838b580.330.png', '89736bb3c5d0a979b9578dd1e342e3ef3dbb6263'], // TM · Emblem of Turkmenistan.svg
  ['arms/files/207fb7caaec6a96059faed9c6f38a23a74678659.330.png', '8bc04bc34b71d7170cd434da3e1defd30288df66'], // TN · Coat of arms of Tunisia.svg
  ['arms/files/eee2f5418e99faaa023fbf84093c8d8f6f133ea6.330.png', '5a895e0b7f40f39a249f53405de0ccc60173817b'], // TO · Coat of arms of Tonga.svg
  ['arms/files/3a563840ecc3f90044c55167d0b70a5f632f6072.330.png', '674af04fb2563a7fa55fe994c16bbe9e48be3fbe'], // TT · Coat of arms of Trinidad and Tobago (2025).svg
  ['arms/files/70fd31b94a74be9e42e1123fd55f7f8211138532.330.png', '0aef6f2dbf616fa7eb88b852b1045627477a6ea3'], // TV · Coat of arms of Tuvalu.svg
  ['arms/files/38525b3e8539544818b48f7766be5e5c28d839b6.330.png', '2da6b2e60116d895764dc1b0b71279d51213d500'], // TW · National Emblem of the Republic of China.svg
  ['arms/files/51b7c628e1346d7d29f1c535a1edd7707762240e.330.png', '1d5bb0fe941fc83e38a3ddc5cf6d7be66e1ee55a'], // TZ · Coat of arms of Tanzania.svg
  ['arms/files/96e727488ad87685619dd72a206959929825028f.330.png', 'd2e9e14245bfedf84341d143a2a15d66b8bc855f'], // UA · Coat of Arms of Ukraine (Pantone).svg
  ['arms/files/bd3b49057914f7ed3e519f112d4c3b0fad1f1b65.330.png', 'e1fdb7d8af9aaac09d39c4230a432ef4a5a7395f'], // UG · Coat of arms of Uganda.svg
  ['arms/files/96b24ef01140302a106c6517ac5a9df2611cdaff.330.png', 'e4e176bca774bde5941ae35741b9ed3a1845e41e'], // US · Greater coat of arms of the United States.svg
  ['arms/files/eda3f600554f8f5b2215e01d1628ccc0c8995fc9.330.png', '243461682f9f909d39a63c6ab4c1e2ee12d692ad'], // UY · Coat of arms of Uruguay.svg
  ['arms/files/f5c45160dec2c90df865340cdb4efa8a41947a1c.330.png', '656589406652b3efe9cc323518e6f13c223e7393'], // UZ · Emblem of Uzbekistan.svg
  ['arms/files/30a21b1f9506eafa2bdcc117ff0c280ef1f2d35d.330.png', '624bcee3f6e0cfb8b7e1dc01a355a76a3253e901'], // VA · Coat of arms of Vatican City (2023–present).svg
  ['arms/files/f9e4a54a9740d142f3bd85474986b312f0a36f74.330.png', '4ebbfe83b58ec4105dd6cdf4f0d78bfbf3441896'], // VC · Coat of arms of Saint Vincent and the Grenadines.svg
  ['arms/files/93701775d609edb96f45804d0aaa8327a6b128a5.330.png', '589dc831441c6ef62bad404abb7855d18977c3bc'], // VE · Coat of arms of Venezuela.svg
  ['arms/files/f910cd4e74080b3c9cecaf275ba96f0e2bffdf1f.330.png', 'd2489251d37d3a7478ba60f88da59b10fedcdad9'], // VG · Coat of arms of the British Virgin Islands.svg
  ['arms/files/6f9a4f79eee231e247ae42bd7d769a22dbeeb260.330.png', '7453c9d258e996069ab4cbe37ad39ffc284ac7b3'], // VI · Seal of the United States Virgin Islands.svg
  ['arms/files/7c3ca69cf4f7d9724275dcde859c960d9fb7f663.330.png', '323890820a3f5f08c759dc9f79945693bdbacae9'], // VN · Emblem of Vietnam.svg
  ['arms/files/b615ca79053c5b9da9e791820b9bbf33a69cc5f0.330.png', 'b60d352a95ad992c13b49b2898ba527b84fc67bc'], // VU · Coat of arms of Vanuatu.svg
  ['arms/files/55ff0e22a86e52a4b77d708dfeb51795bf6e4983.330.png', 'c2b73444249e742a620bb79c1193bc8a8f9e9d12'], // WS · Public Seal of Samoa.svg
  ['arms/files/73106d63d219b6006f818313013bd58f73cbe9a9.330.png', '82708bc5fe9bfdf5c12d792b0fc3318137b7f3be'], // XK · Emblem of the Republic of Kosovo.svg
  ['arms/files/c664b0034d5a74403a53fd0f6f0991654b0955f0.330.png', '01e36fb2db5d8fe9e2189ec7c8a0381d5f55a4d1'], // YE · Emblem of Yemen (2).svg
  ['arms/files/106ec47263c48985e5a4c235a8229feb5da380e8.330.png', '511e24200899a404bc8dc4bf57bef38b4c56f44b'], // ZA · Coat of arms of South Africa (heraldic).svg
  ['arms/files/a4f6289290e4c3402516ee45f5f316b6f288402c.330.png', 'f9a5a307b8c0206c8f8cd0d0fab50253e6a6214d'], // ZM · Coat of arms of Zambia.svg
  ['arms/files/46411e4a63f6be60167486e9b5ab95276d476b7d.330.png', 'f5dc922dc65b5de82b0a68232d9e79283651e9bd'], // ZW · Coat of arms of Zimbabwe.svg
];
