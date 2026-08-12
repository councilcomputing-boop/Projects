export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_META: Record<Rarity, {label: string;ring: string;text: string;bg: string;glow: string;fragmentsNeeded: number;}> = {
  common: {
    label: 'Common',
    ring: 'ring-charcoal/25',
    text: 'text-charcoal-soft',
    bg: 'bg-charcoal/10',
    glow: 'rgba(120, 110, 100, 0.55)',
    fragmentsNeeded: 3
  },
  rare: {
    label: 'Rare',
    ring: 'ring-gold',
    text: 'text-gold-deep',
    bg: 'bg-gold/25',
    glow: 'rgba(200, 169, 75, 0.75)',
    fragmentsNeeded: 5
  },
  epic: {
    label: 'Epic',
    ring: 'ring-[#7c4dbe]',
    text: 'text-[#7c4dbe]',
    bg: 'bg-[#7c4dbe]/20',
    glow: 'rgba(124, 77, 190, 0.8)',
    fragmentsNeeded: 8
  },
  legendary: {
    label: 'Legendary',
    ring: 'ring-blood',
    text: 'text-blood',
    bg: 'bg-blood/20',
    glow: 'rgba(224, 24, 79, 0.85)',
    fragmentsNeeded: 12
  }
};

// ── Blood Vials (real Stripe Payment Links — exact amounts matter, these are
// cross-checked server-side by netlify/functions/verify-payment.js) ──
export interface VialItem {
  id: string;
  name: string;
  drops: number;
  price: string;
  bonus?: string;
  stripeLink: string;
}

export const vialItems: VialItem[] = [
{ id: 'tiny_vial', name: 'Tiny Vial', drops: 1000, price: '$0.99', stripeLink: 'https://buy.stripe.com/fZu4gz1Im6MN6WXfmDgnK03' },
{ id: 'small_vial', name: 'Small Vial', drops: 3500, price: '$2.99', bonus: '+15% Bonus', stripeLink: 'https://buy.stripe.com/fZueVddr41sta99gqHgnK04' },
{ id: 'large_vial', name: 'Large Vial', drops: 13000, price: '$9.99', bonus: '+30% Bonus', stripeLink: 'https://buy.stripe.com/00w8wP86K2wxa99cargnK05' },
{ id: 'coffin_hoard', name: 'Coffin Hoard', drops: 45000, price: '$29.99', bonus: '+50% Bonus', stripeLink: 'https://buy.stripe.com/00wcN5aeS6MNepp1vNgnK06' },
{ id: 'ancient_hoard', name: 'Ancient Hoard', drops: 105000, price: '$59.99', bonus: '+75% Bonus', stripeLink: 'https://buy.stripe.com/3cI7sL9aO1stbdd4HZgnK07' }];

// ── Crypt Chests (bought with Blood Drops, award one card-back fragment) ──
export interface ChestItem {
  id: string;
  name: string;
  icon: string;
  dropCost: number;
  odds: Record<Rarity, number>;
}

export const chestItems: ChestItem[] = [
{ id: 'crypt', name: 'Crypt Chest', icon: '🪦', dropCost: 5000, odds: { common: 70, rare: 25, epic: 5, legendary: 0 } },
{ id: 'royal', name: 'Blood Royal Chest', icon: '👑', dropCost: 20000, odds: { common: 30, rare: 45, epic: 20, legendary: 5 } },
{ id: 'vault', name: 'Ancient Vault Chest', icon: '🏺', dropCost: 50000, odds: { common: 0, rare: 25, epic: 45, legendary: 30 } }];

export function findChest(id: string): ChestItem | undefined {
  return chestItems.find((c) => c.id === id);
}

// ── Spin Wheel (1 free spin/day) ──
export type WheelSegment = { type: 'drops'; value: number } | { type: 'card' };
export const WHEEL_SEGMENTS: WheelSegment[] = [
{ type: 'drops', value: 50 },
{ type: 'card' },
{ type: 'card' },
{ type: 'drops', value: 150 },
{ type: 'drops', value: 250 },
{ type: 'drops', value: 500 },
{ type: 'drops', value: 1000 }];

export const WHEEL_SEGMENT_ANGLE = 360 / WHEEL_SEGMENTS.length;
export const WHEEL_SPIN_MS = 3000;
export const WHEEL_CARD_DUPLICATE_REFUND = 1000;

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
  price: number;
  rarity: Rarity;
  fx?: boolean;
}

// Exact catalog from the live app — price is the direct-buy cost in drops;
// rarity drives fragment collection via chests/the spin wheel (RARITY_META).
export const CARD_BACKS: CardBackItem[] = [
{ id: 'classic', name: 'Classic Wine', row: 0, col: 0, price: 0, rarity: 'common' },
{ id: 'slate', name: 'Midnight Slate', row: 0, col: 1, price: 400, rarity: 'common' },
{ id: 'bone', name: 'Bone White', row: 0, col: 2, price: 600, rarity: 'common' },
{ id: 'coffin', name: 'Coffin Black', row: 0, col: 3, price: 600, rarity: 'common' },
{ id: 'bloodfade', name: 'Blood Fade', row: 0, col: 4, price: 1200, rarity: 'common' },
{ id: 'silvermist', name: 'Silver Mist', row: 1, col: 0, price: 1500, rarity: 'rare' },
{ id: 'ivoryrose', name: 'Ivory Rose', row: 1, col: 1, price: 1500, rarity: 'rare' },
{ id: 'onyxgold', name: 'Onyx Gold', row: 1, col: 2, price: 1800, rarity: 'rare' },
{ id: 'garnet', name: 'Garnet Sheen', row: 1, col: 3, price: 3500, rarity: 'rare' },
{ id: 'moonstone', name: 'Moonstone', row: 1, col: 4, price: 4000, rarity: 'rare' },
{ id: 'velvetplum', name: 'Velvet Plum', row: 2, col: 0, price: 4500, rarity: 'epic' },
{ id: 'champagne', name: 'Champagne', row: 2, col: 1, price: 5000, rarity: 'epic' },
{ id: 'crimsonpulse', name: 'Crimson Pulse', row: 2, col: 2, price: 9000, rarity: 'epic', fx: true },
{ id: 'silvershimmer', name: 'Silver Shimmer', row: 2, col: 3, price: 11000, rarity: 'epic', fx: true },
{ id: 'batsigil', name: 'Bat Sigil', row: 2, col: 4, price: 13000, rarity: 'epic', fx: true },
{ id: 'frostbite', name: 'Frostbite', row: 3, col: 0, price: 15000, rarity: 'legendary', fx: true },
{ id: 'draculaseal', name: "Dracula's Seal", row: 3, col: 1, price: 25000, rarity: 'legendary', fx: true },
{ id: 'eternalnight', name: 'Eternal Night', row: 3, col: 2, price: 30000, rarity: 'legendary', fx: true },
{ id: 'fullmoon', name: 'Full Moon Curse', row: 3, col: 3, price: 40000, rarity: 'legendary', fx: true },
{ id: 'vampirehoard', name: "Vampire's Hoard", row: 3, col: 4, price: 60000, rarity: 'legendary', fx: true }];

export function findCardBack(id: string): CardBackItem {
  return CARD_BACKS.find((b) => b.id === id) ?? CARD_BACKS[0];
}

export function backsByRarity(rarity: Rarity): CardBackItem[] {
  return CARD_BACKS.filter((b) => b.rarity === rarity);
}

/**
 * Rolls a rarity from a chest/wheel's odds, then a target back within that rarity to
 * award a fragment toward — preferring a back already in progress, then any unfinished
 * back of that rarity, falling back to an owned one only if the whole rarity is done.
 */
export function rollFragmentTarget(
odds: Record<Rarity, number>,
owned: string[],
fragments: Record<string, number>)
: CardBackItem {
  const total = (Object.values(odds) as number[]).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let rarity: Rarity = 'common';
  for (const key of ['common', 'rare', 'epic', 'legendary'] as Rarity[]) {
    const w = odds[key] || 0;
    if (r < w) { rarity = key; break; }
    r -= w;
  }
  const pool = backsByRarity(rarity);
  const unfinished = pool.filter((b) => !owned.includes(b.id));
  const inProgress = unfinished.filter((b) => (fragments[b.id] || 0) > 0);
  const choices = inProgress.length ? inProgress : unfinished.length ? unfinished : pool;
  return choices[Math.floor(Math.random() * choices.length)];
}

/** Any not-fully-owned back, regardless of rarity — used by the wheel's plain "CARD" segments. */
export function randomUnownedBack(owned: string[]): CardBackItem {
  const unowned = CARD_BACKS.filter((b) => !owned.includes(b.id));
  const pool = unowned.length ? unowned : CARD_BACKS;
  return pool[Math.floor(Math.random() * pool.length)];
}
