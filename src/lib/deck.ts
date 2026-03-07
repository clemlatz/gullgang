export type CardPower =
  | 'look-own'       // value 8: look at one of your own cards
  | 'look-opponent'  // value 9: look at one opponent's card
  | 'swap-blind'     // value 10: swap one of your cards with opponent's (blind)
  | 'look-and-swap'  // value 15: look at opponent's card, optionally swap
  | 'discard-own';   // value 20: discard one of your own cards

export interface CardDefinition {
  value: number;
  nameEn: string;
  nameFr: string;
  latinName: string | null;
  power: CardPower | null;
  imageFile: string; // filename in /cards/
  badgeColor: 'green' | 'yellow' | 'red';
}

export const CARD_DEFINITIONS: CardDefinition[] = [
  {
    value: 0,
    nameEn: 'Dark Gull',
    nameFr: 'Mouette obscure',
    latinName: 'Leucophaeus fuliginosus',
    power: null,
    imageFile: 'card_0.png',
    badgeColor: 'green',
  },
  {
    value: 1,
    nameEn: 'Rosy Gull',
    nameFr: 'Mouette rosée',
    latinName: 'Rhodostethia rosea',
    power: null,
    imageFile: 'card_1.png',
    badgeColor: 'green',
  },
  {
    value: 2,
    nameEn: 'Silver Gull',
    nameFr: 'Mouette argentée',
    latinName: 'Chroicocephalus novaehollandiae',
    power: null,
    imageFile: 'card_2.png',
    badgeColor: 'green',
  },
  {
    value: 3,
    nameEn: 'White Gull',
    nameFr: 'Mouette blanche',
    latinName: 'Pagophila eburnea',
    power: null,
    imageFile: 'card_3.png',
    badgeColor: 'green',
  },
  {
    value: 4,
    nameEn: 'Swallow-tailed Gull',
    nameFr: 'Mouette à queue fourchue',
    latinName: 'Creagrus furcatus',
    power: null,
    imageFile: 'card_4.png',
    badgeColor: 'yellow',
  },
  {
    value: 5,
    nameEn: 'Relict Gull',
    nameFr: 'Mouette relique',
    latinName: 'Ichthyaetus relictus',
    power: null,
    imageFile: 'card_5.png',
    badgeColor: 'yellow',
  },
  {
    value: 6,
    nameEn: 'Mist Gull',
    nameFr: 'Mouette des brumes',
    latinName: 'Rissa brevirostris',
    power: null,
    imageFile: 'card_6.png',
    badgeColor: 'yellow',
  },
  {
    value: 7,
    nameEn: 'Grey-headed Gull',
    nameFr: 'Mouette à tête grise',
    latinName: 'Chroicocephalus cirrocephalus',
    power: null,
    imageFile: 'card_7.png',
    badgeColor: 'yellow',
  },
  {
    value: 8,
    nameEn: 'Accountant Gull',
    nameFr: 'Mouette comptable',
    latinName: null,
    power: 'look-own',
    imageFile: 'card_8.png',
    badgeColor: 'red',
  },
  {
    value: 9,
    nameEn: 'Spy Gull',
    nameFr: 'Mouette espionne',
    latinName: null,
    power: 'look-opponent',
    imageFile: 'card_9.png',
    badgeColor: 'red',
  },
  {
    value: 10,
    nameEn: 'Thief Gull',
    nameFr: 'Mouette voleuse',
    latinName: null,
    power: 'swap-blind',
    imageFile: 'card_10.png',
    badgeColor: 'red',
  },
  {
    value: 15,
    nameEn: 'Strategist Gull',
    nameFr: 'Mouette stratège',
    latinName: null,
    power: 'look-and-swap',
    imageFile: 'card_15.png',
    badgeColor: 'red',
  },
  {
    value: 20,
    nameEn: 'Laughing Gull',
    nameFr: 'Mouette rieuse',
    latinName: null,
    power: 'discard-own',
    imageFile: 'card_20.png',
    badgeColor: 'red',
  },
];

// Quantities per card value
const CARD_QUANTITIES: Record<number, number> = {
  0: 2,
  1: 4,
  2: 4,
  3: 4,
  4: 4,
  5: 4,
  6: 4,
  7: 4,
  8: 8,
  9: 8,
  10: 8,
  15: 2,
  20: 2,
};

export interface Card {
  id: string; // unique instance id
  value: number;
}

export function buildDeck(): Card[] {
  const deck: Card[] = [];
  let counter = 0;
  for (const def of CARD_DEFINITIONS) {
    const qty = CARD_QUANTITIES[def.value] ?? 0;
    for (let i = 0; i < qty; i++) {
      deck.push({ id: `card-${counter++}`, value: def.value });
    }
  }
  return deck;
}

export function shuffleDeck(deck: Card[]): Card[] {
  const arr = [...deck];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function getCardDef(value: number): CardDefinition {
  return CARD_DEFINITIONS.find((d) => d.value === value)!;
}
