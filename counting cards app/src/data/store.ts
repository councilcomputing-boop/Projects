export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_META: Record<Rarity, {label: string;ring: string;text: string;bg: string;glow: string;}> = {
  common: {
    label: 'Common',
    ring: 'ring-charcoal/25',
    text: 'text-charcoal-soft',
    bg: 'bg-charcoal/10',
    glow: 'rgba(120, 110, 100, 0.55)'
  },
  rare: {
    label: 'Rare',
    ring: 'ring-gold',
    text: 'text-gold-deep',
    bg: 'bg-gold/25',
    glow: 'rgba(200, 169, 75, 0.75)'
  },
  epic: {
    label: 'Epic',
    ring: 'ring-[#7c4dbe]',
    text: 'text-[#7c4dbe]',
    bg: 'bg-[#7c4dbe]/20',
    glow: 'rgba(124, 77, 190, 0.8)'
  },
  legendary: {
    label: 'Legendary',
    ring: 'ring-blood',
    text: 'text-blood',
    bg: 'bg-blood/20',
    glow: 'rgba(224, 24, 79, 0.85)'
  }
};

export interface StoreItem {
  id: string;
  name: string;
  /** Blood drops granted (vials) or shown as contents (chests). */
  drops?: number;
  contents?: string;
  /** Cash price for vials, blood-drop cost for chests. */
  price: string;
  dropCost?: number;
  bonus?: string;
  icon: string;
  /** Chests only: the odds of each rarity inside. */
  odds?: Record<Rarity, number>;
}

export const storeItems: StoreItem[] = [
{
  id: 'v-tiny',
  name: 'Tiny Vial',
  drops: 1000,
  price: '$0.99',
  icon: "/b14b2030-91f8-40f6-97a5-92f8c9e2fb52.jpg"
},
{
  id: 'v-small',
  name: 'Small Vial',
  drops: 3500,
  price: '$2.99',
  bonus: '+15% Bonus',
  icon: "/c849d8b0-3b5b-4565-b055-220f22527b85.jpg"
},
{
  id: 'v-large',
  name: 'Large Vial',
  drops: 13000,
  price: '$9.99',
  bonus: '+30% Bonus',
  icon: "/90759698-9edc-4887-90c4-9d802b10b7ed.jpg"
},
{
  id: 'v-coffin',
  name: 'Coffin Hoard',
  drops: 45000,
  price: '$29.99',
  bonus: '+50% Bonus',
  icon: "/1d356869-de48-4bd8-a594-d13d51814bfb.jpg"
},
{
  id: 'v-ancient',
  name: 'Ancient Hoard',
  drops: 105000,
  price: '$59.99',
  bonus: '+75% Bonus',
  icon: "/2f108898-2f27-4f60-9917-07a5284266c6.jpg"
},
{
  id: 'c-crypt',
  name: 'Crypt Chest',
  contents: '1 card back · common odds',
  price: '5,000',
  dropCost: 5000,
  icon: "/831f35e1-350a-4e76-9c74-72f4a106eb2b.jpg",
  odds: { common: 70, rare: 25, epic: 5, legendary: 0 }
},
{
  id: 'c-royal',
  name: 'Blood Royal Chest',
  contents: '1 card back · rare odds',
  price: '20,000',
  dropCost: 20000,
  bonus: 'Rare',
  icon: "/c4a159ab-1509-40e3-a3dd-edefc96a3ea9.jpg",
  odds: { common: 30, rare: 45, epic: 20, legendary: 5 }
},
{
  id: 'c-vault',
  name: 'Ancient Vault Chest',
  contents: '1 card back · legendary odds',
  price: '50,000',
  dropCost: 50000,
  bonus: 'Legendary',
  icon: "/82a06eb8-01ad-45f0-8de1-d903103e3bc4.jpg",
  odds: { common: 0, rare: 25, epic: 45, legendary: 30 }
}];


/** The uploaded 5 × 4 card-back sheet, cropped per design via CSS. */
export const CARD_BACK_SHEET = {
  url: "/cardbacks-sheet.png",
  sheetWidth: 1264,
  sheetHeight: 1163,
  cardWidth: 160,
  cardHeight: 228,
  originX: 63,
  originY: 80,
  stepX: 244.5,
  stepY: 268
};

export interface CardBackItem {
  id: string;
  name: string;
  row: number;
  col: number;
  cost: number;
  rarity: Rarity;
  owned: boolean;
  /** Backs that get a slow sheen sweep over the artwork. */
  animated?: boolean;
}

export const cardBacks: CardBackItem[] = [
{ id: 'classic', name: 'Classic', row: 0, col: 0, cost: 0, rarity: 'common', owned: true },
{ id: 'slate', name: 'Slate', row: 0, col: 1, cost: 1500, rarity: 'common', owned: true },
{ id: 'bone', name: 'Bone', row: 0, col: 2, cost: 2500, rarity: 'common', owned: true },
{ id: 'coffin', name: 'Coffin', row: 0, col: 3, cost: 3000, rarity: 'common', owned: false },
{ id: 'bloodfade', name: 'Bloodfade', row: 0, col: 4, cost: 4000, rarity: 'common', owned: false },
{ id: 'silvermist', name: 'Silvermist', row: 1, col: 0, cost: 5000, rarity: 'rare', owned: false },
{ id: 'ivoryrose', name: 'Ivoryrose', row: 1, col: 1, cost: 5500, rarity: 'rare', owned: false },
{ id: 'onyxgold', name: 'Onyxgold', row: 1, col: 2, cost: 8000, rarity: 'rare', owned: false },
{ id: 'garnet', name: 'Garnet', row: 1, col: 3, cost: 8500, rarity: 'rare', owned: false },
{ id: 'moonstone', name: 'Moonstone', row: 1, col: 4, cost: 9000, rarity: 'rare', owned: false },
{ id: 'velvetplum', name: 'Velvetplum', row: 2, col: 0, cost: 12000, rarity: 'epic', owned: false },
{ id: 'champagne', name: 'Champagne', row: 2, col: 1, cost: 14000, rarity: 'epic', owned: false, animated: true },
{
  id: 'crimsonpulse',
  name: 'Crimsonpulse',
  row: 2,
  col: 2,
  cost: 16000,
  rarity: 'epic',
  owned: false,
  animated: true
},
{
  id: 'silvershimmer',
  name: 'Silvershimmer',
  row: 2,
  col: 3,
  cost: 18000,
  rarity: 'epic',
  owned: false,
  animated: true
},
{ id: 'batsigil', name: 'Batsigil', row: 2, col: 4, cost: 20000, rarity: 'epic', owned: false },
{ id: 'frostbite', name: 'Frostbite', row: 3, col: 0, cost: 25000, rarity: 'legendary', owned: false, animated: true },
{ id: 'draculaseal', name: 'Draculaseal', row: 3, col: 1, cost: 30000, rarity: 'legendary', owned: false },
{
  id: 'eternalnight',
  name: 'Eternalnight',
  row: 3,
  col: 2,
  cost: 35000,
  rarity: 'legendary',
  owned: false,
  animated: true
},
{ id: 'fullmoon', name: 'Fullmoon', row: 3, col: 3, cost: 40000, rarity: 'legendary', owned: false, animated: true },
{
  id: 'vampirehoard',
  name: 'Vampirehoard',
  row: 3,
  col: 4,
  cost: 50000,
  rarity: 'legendary',
  owned: false,
  animated: true
}];


export function getCardBack(id: string): CardBackItem {
  return cardBacks.find((back) => back.id === id) ?? cardBacks[0];
}

/** Rolls a rarity from the chest's odds, then a card back of that rarity. */
export function rollCardBack(odds: Record<Rarity, number>, ownedIds: string[]): CardBackItem {
  const total = Object.values(odds).reduce((sum, weight) => sum + weight, 0);
  let ticket = Math.random() * total;
  let rarity: Rarity = 'common';
  (Object.keys(odds) as Rarity[]).forEach((key) => {
    if (ticket >= 0) {
      ticket -= odds[key];
      if (ticket < 0) rarity = key;
    }
  });

  const pool = cardBacks.filter((back) => back.rarity === rarity);
  const fresh = pool.filter((back) => !ownedIds.includes(back.id));
  const from = fresh.length > 0 ? fresh : pool;
  return from[Math.floor(Math.random() * from.length)];
}

/** Any card back that is still missing from the collection. */
export function randomUnownedBack(ownedIds: string[]): CardBackItem {
  const pool = cardBacks.filter((back) => !ownedIds.includes(back.id));
  const from = pool.length > 0 ? pool : cardBacks;
  return from[Math.floor(Math.random() * from.length)];
}