/**
 * Seas that are part of a bigger one.
 *
 * The map data cuts the sea into pieces that do not overlap: "the Mediterranean" is what is left of it once
 * the Balearic Sea, the Adriatic and the rest are taken out, and "the Arctic" is the water around the pole,
 * without the seas of Siberia. That is right for a map where every piece is drawn and clicked. It is not what
 * the name means when somebody is asked where the Mediterranean is with nothing to go by: there, a click off
 * Valencia is right.
 *
 * So each line gives a sea and the one it is part of. Only what everyday speech puts inside the bigger one:
 * its gulfs and the seas that open onto it along a wide front. What lies behind a strait is a piece of its
 * own: the Black Sea is not Mediterranean, nor the Mediterranean Atlantic, nor the North Sea.
 */
export const PART_OF: Readonly<Record<string, string>> = {
  // The Mediterranean, basin by basin.
  's:alboran-sea': 's:mediterranean-sea',
  's:balearic-sea': 's:mediterranean-sea',
  's:gulf-of-valencia': 's:balearic-sea',
  's:gulf-of-lion': 's:mediterranean-sea',
  's:ligurian-sea': 's:mediterranean-sea',
  's:tyrrhenian-sea': 's:mediterranean-sea',
  's:ionian-sea': 's:mediterranean-sea',
  's:adriatic-sea': 's:mediterranean-sea',
  's:aegean-sea': 's:mediterranean-sea',
  's:sea-of-crete': 's:aegean-sea',
  's:gulf-of-sidra': 's:mediterranean-sea',

  // Seas with gulfs of their own.
  's:gulf-of-bothnia': 's:baltic-sea',
  's:gulf-of-finland': 's:baltic-sea',
  's:gulf-of-riga': 's:baltic-sea',
  's:gulf-of-suez': 's:red-sea',
  's:gulf-of-aqaba': 's:red-sea',
  's:gulf-of-thailand': 's:south-china-sea',
  's:gulf-of-tonkin': 's:south-china-sea',
  's:bohai-sea': 's:yellow-sea',
  's:bay-of-campeche': 's:gulf-of-mexico',
  's:gulf-of-honduras': 's:caribbean-sea',
  's:james-bay': 's:hudson-bay',
  's:gulf-of-aden': 's:arabian-sea',
  's:gulf-of-oman': 's:arabian-sea',
  's:cantabrian-sea': 's:bay-of-biscay',

  // The Atlantic.
  's:bay-of-biscay': 's:atlantic-ocean',
  's:gulf-of-cadiz': 's:atlantic-ocean',
  's:gulf-of-guinea': 's:atlantic-ocean',
  's:sargasso-sea': 's:atlantic-ocean',
  's:labrador-sea': 's:atlantic-ocean',
  's:san-jorge-gulf': 's:atlantic-ocean',

  // The Pacific.
  's:gulf-of-alaska': 's:pacific-ocean',
  's:gulf-of-panama': 's:pacific-ocean',
  's:philippine-sea': 's:pacific-ocean',
  's:coral-sea': 's:pacific-ocean',
  's:tasman-sea': 's:pacific-ocean',

  // The Indian.
  's:arabian-sea': 's:indian-ocean',
  's:bay-of-bengal': 's:indian-ocean',
  's:laccadive-sea': 's:indian-ocean',
  's:mozambique-channel': 's:indian-ocean',
  's:great-australian-bight': 's:indian-ocean',

  // The Arctic: the seas along the coasts of Siberia, Alaska and Canada.
  's:barents-sea': 's:arctic-ocean',
  's:kara-sea': 's:arctic-ocean',
  's:laptev-sea': 's:arctic-ocean',
  's:east-siberian-sea': 's:arctic-ocean',
  's:chukchi-sea': 's:arctic-ocean',
  's:beaufort-sea': 's:arctic-ocean',
  's:greenland-sea': 's:arctic-ocean',

  // The Southern Ocean: the seas along the coast of Antarctica.
  's:weddell-sea': 's:southern-ocean',
  's:ross-sea': 's:southern-ocean',
  's:bellingshausen-sea': 's:southern-ocean',
  's:amundsen-sea': 's:southern-ocean',
};

/** Every sea that is part of this one, the parts of its parts too: the nearest ones first. */
export function seaParts(id: string): string[] {
  const out: string[] = [];
  let round = [id];
  // A sea is never part of itself, however the table is written.
  const seen = new Set(round);
  while (round.length) {
    const next: string[] = [];
    for (const [part, whole] of Object.entries(PART_OF)) {
      if (!round.includes(whole) || seen.has(part)) continue;
      seen.add(part);
      next.push(part);
    }
    out.push(...next);
    round = next;
  }
  return out;
}
